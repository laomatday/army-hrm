import React, { useState, useMemo } from 'react';
import { DashboardData, Employee } from '../types';
import { submitRequest } from '../services/api';
import TabRequests from './TabRequests';

interface Props {
  data: DashboardData | null;
  user: Employee;
  onRefresh: () => void;
}

const TabHistory: React.FC<Props> = ({ data, user, onRefresh }) => {
  const [activeView, setActiveView] = useState<'history' | 'requests'>('history');
  const [viewDate, setViewDate] = useState(new Date()); // Current month view
  // Removed displayLimit state as we now use horizontal scroll for all items
  const [explainModal, setExplainModal] = useState<{show: boolean, date: string, type: string} | null>(null);
  const [explainReason, setExplainReason] = useState("");
  const [loadingExplain, setLoadingExplain] = useState(false);

  // Helper: Date -> YYYY-MM-DD
  const formatDateISO = (d: Date) => d.toISOString().split('T')[0];
  const formatDayDisplay = (dStr: string) => {
      const [y, m, d] = dStr.split('-');
      return `${d}`;
  };

  const processedData = useMemo(() => {
      if (!data) return { stats: { workDays: 0, lateMins: 0, errors: 0 }, list: [] };

      const year = viewDate.getFullYear();
      const month = viewDate.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      
      const stats = { workDays: 0, lateMins: 0, errors: 0 };
      const list: any[] = [];
      const today = new Date();
      
      const { systemConfig } = data;
      const minFull = systemConfig?.MIN_HOURS_FULL || 7;
      const minHalf = systemConfig?.MIN_HOURS_HALF || 3.5;
      // Ensure offDays is an array
      const offDays = Array.isArray(systemConfig?.OFF_DAYS) ? systemConfig.OFF_DAYS : [0];

      // Iterate backwards (newest first)
      for (let d = daysInMonth; d >= 1; d--) {
          const current = new Date(year, month, d);
          const dateStr = formatDateISO(current);
          const dayOfWeek = current.getDay(); // 0 = Sun
          
          // Check if future
          const isFuture = current > today;
          
          // Requirement: Do not show future days
          if (isFuture) continue;
          
          let dayItem: any = {
              date: dateStr,
              dayOfWeek: dayOfWeek,
              status: 'Absent',
              workHours: 0,
              lateMins: 0,
              shifts: [], // Array to hold multiple shifts
              label: 'Vắng',
              color: 'slate',
              icon: 'fa-user-slash',
              isFuture: isFuture,
              canExplain: false
          };

          // 1. Holiday Check
          const holiday = data.holidays?.find(h => h.from_date <= dateStr && h.to_date >= dateStr);
          if (holiday) {
              dayItem.status = 'Holiday';
              dayItem.label = holiday.name;
              dayItem.color = 'purple';
              dayItem.icon = 'fa-gift';
              dayItem.workHours = 8;
              stats.workDays += 1;
              list.push(dayItem);
              continue;
          }

          // 2. Leave Check
          const leave = data.myRequests.find(r => 
              r.status === 'Approved' && 
              r.from_date <= dateStr && r.to_date >= dateStr
          );
          if (leave) {
              dayItem.status = 'Leave';
              dayItem.label = leave.type;
              dayItem.color = 'blue';
              dayItem.icon = 'fa-umbrella-beach';
              dayItem.workHours = 8;
              stats.workDays += 1;
              list.push(dayItem);
              continue;
          }

          // 3. Attendance Check (Aggregation)
          const dailyRecords = data.history.history.filter(h => h.date === dateStr);
          
          if (dailyRecords.length > 0) {
              // Aggregate data from all shifts in this day
              let totalHours = 0;
              let totalLate = 0;
              let hasError = false;
              let hasLate = false;
              const isToday = current.toDateString() === today.toDateString();

              dailyRecords.forEach(att => {
                  totalHours += Number(att.work_hours || 0);
                  totalLate += Number(att.late_minutes || 0);
                  
                  // Collect shift info
                  dayItem.shifts.push({
                      name: (att as any).shift_name || "Ca làm việc", // Cast generic
                      in: att.time_in,
                      out: att.time_out
                  });

                  if (!att.time_out && !isToday) {
                      hasError = true;
                  }
                  if (att.status === 'Late' || att.late_minutes > 0) {
                      hasLate = true;
                  }
              });

              dayItem.workHours = totalHours;
              dayItem.lateMins = totalLate;

              // Determine Daily Status
              if (hasError) {
                  dayItem.status = 'Error';
                  dayItem.label = 'Quên Checkout';
                  dayItem.color = 'red';
                  dayItem.icon = 'fa-circle-exclamation';
                  dayItem.canExplain = true;
                  stats.errors += 1;
              } else if (hasLate) {
                  dayItem.status = 'Late';
                  dayItem.label = `Trễ ${dayItem.lateMins}p`;
                  dayItem.color = 'red';
                  dayItem.icon = 'fa-clock';
                  dayItem.canExplain = true;
                  // Made Up Logic: Late but worked enough hours
                  if (totalHours >= minFull) {
                      dayItem.status = 'MadeUp';
                      dayItem.label = 'Bù trễ';
                      dayItem.color = 'emerald';
                      dayItem.icon = 'fa-check-double';
                      stats.workDays += 1;
                  } else if (totalHours >= minHalf) {
                      stats.workDays += 0.5;
                  }
                  stats.lateMins += dayItem.lateMins;
              } else if (totalHours >= minFull) { 
                  dayItem.status = 'Standard';
                  dayItem.label = '1.0 Công';
                  dayItem.color = 'emerald';
                  dayItem.icon = 'fa-check';
                  stats.workDays += 1;
              } else if (totalHours >= minHalf) {
                  dayItem.status = 'Half';
                  dayItem.label = '0.5 Công';
                  dayItem.color = 'orange';
                  dayItem.icon = 'fa-hourglass-half';
                  stats.workDays += 0.5;
              } else if (isToday && dailyRecords.some(r => !r.time_out)) {
                   dayItem.status = 'Working';
                   dayItem.label = 'Đang làm';
                   dayItem.color = 'blue';
                   dayItem.icon = 'fa-briefcase';
              } else {
                  dayItem.status = 'Low';
                  dayItem.label = 'Thiếu giờ';
                  dayItem.color = 'orange';
                  dayItem.icon = 'fa-battery-quarter';
                  dayItem.canExplain = true;
              }
          } else {
              // Absent or Future
              if (isFuture) {
                  // This block is unreachable now due to 'continue' above, 
                  // but kept for logic consistency if requirement changes.
                  dayItem.status = 'Future';
                  dayItem.label = '...';
              } else if (offDays.includes(dayOfWeek)) {
                  dayItem.status = 'Weekend';
                  dayItem.label = 'Cuối tuần';
                  dayItem.icon = 'fa-mug-hot';
              } else {
                  dayItem.canExplain = true; // Explain why absent
              }
          }
          list.push(dayItem);
      }
      return { stats, list };
  }, [data, viewDate]);

  const changeMonth = (delta: number) => {
      const newDate = new Date(viewDate);
      newDate.setMonth(newDate.getMonth() + delta);
      setViewDate(newDate);
  };

  const handleExplain = async () => {
      if(!explainReason.trim()) return alert("Nhập lý do");
      setLoadingExplain(true);
      const res = await submitRequest({
          employeeId: user.employee_id,
          name: user.name,
          type: "Giải trình công",
          fromDate: explainModal!.date,
          toDate: explainModal!.date,
          reason: `[${explainModal!.type}] ${explainReason}`
      });
      setLoadingExplain(false);
      alert(res.message);
      if(res.success) {
          setExplainModal(null);
          setExplainReason("");
          onRefresh();
      }
  };

  const handleQuickExplain = (type: 'Late' | 'Error') => {
      // Find the most recent day with this issue
      const item = list.find(i => {
          if (type === 'Late') return i.lateMins > 0;
          if (type === 'Error') return i.status === 'Error';
          return false;
      });

      if (item) {
          setExplainModal({ 
              show: true, 
              date: item.date, 
              type: item.label 
          });
          setExplainReason("");
      }
  };

  const getDayName = (idx: number) => ["CN", "T2", "T3", "T4", "T5", "T6", "T7"][idx];

  const renderBadge = (item: any) => {
      const colors: any = {
          purple: "bg-purple-50 text-purple-600 border-purple-100",
          blue: "bg-blue-50 text-blue-600 border-blue-100",
          red: "bg-red-50 text-red-600 border-red-100",
          emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
          orange: "bg-orange-50 text-orange-600 border-orange-100",
          slate: "bg-slate-100 text-slate-500 border-slate-200"
      };
      return (
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-wider ${colors[item.color]}`}>
              <i className={`fa-solid ${item.icon}`}></i> {item.label}
          </div>
      );
  };

  const { stats, list } = processedData;

  return (
    <div className="absolute inset-0 overflow-y-auto no-scrollbar pt-safe pb-32 bg-slate-50">
        <div className="pt-24 px-4 flex justify-between items-center mb-6">
             <div className="flex bg-slate-200/80 p-1 rounded-[14px]">
                 <button onClick={() => setActiveView('history')} className={`px-4 py-2 rounded-[12px] text-xs font-bold transition-all ${activeView === 'history' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>Bảng công</button>
                 <button onClick={() => setActiveView('requests')} className={`px-4 py-2 rounded-[12px] text-xs font-bold transition-all ${activeView === 'requests' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>Đơn từ</button>
             </div>
        </div>

        {activeView === 'requests' ? (
            <div className="px-4">
                <TabRequests data={data} user={user} onRefresh={onRefresh} />
            </div>
        ) : (
            <div className="animate-fade-in flex flex-col h-full">
                {/* Stats Header */}
                <div className="px-4 mb-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-black text-slate-800 tracking-tight">Tháng {viewDate.getMonth() + 1}</h3>
                        <div className="flex items-center bg-white rounded-xl shadow-sm border border-slate-200 p-1">
                            <button onClick={() => changeMonth(-1)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50 active:scale-95 transition-all"><i className="fa-solid fa-chevron-left text-xs"></i></button>
                            <span className="text-xs font-bold text-slate-700 w-16 text-center select-none">{viewDate.getMonth() + 1}/{viewDate.getFullYear()}</span>
                            <button onClick={() => changeMonth(1)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50 active:scale-95 transition-all"><i className="fa-solid fa-chevron-right text-xs"></i></button>
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center h-20">
                            <span className="text-[9px] font-bold text-slate-400 uppercase">Ngày công</span>
                            <span className="text-2xl font-black text-emerald-600">{stats.workDays}</span>
                        </div>
                        
                        <div 
                            onClick={() => stats.lateMins > 0 && handleQuickExplain('Late')}
                            className={`bg-white p-3 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center h-20 relative overflow-hidden transition-all ${stats.lateMins > 0 ? 'active:scale-95 cursor-pointer hover:border-orange-200' : ''}`}>
                            <span className="text-[9px] font-bold text-slate-400 uppercase">Phút trễ</span>
                            <span className={`text-2xl font-black ${stats.lateMins > 0 ? 'text-orange-500' : 'text-slate-800'}`}>{stats.lateMins}</span>
                            {stats.lateMins > 0 && (
                                <div className="absolute top-1 right-1 w-5 h-5 bg-orange-50 rounded-full flex items-center justify-center">
                                    <i className="fa-solid fa-pen text-[10px] text-orange-500"></i>
                                </div>
                            )}
                        </div>

                        <div 
                            onClick={() => stats.errors > 0 && handleQuickExplain('Error')}
                            className={`bg-white p-3 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center h-20 relative overflow-hidden transition-all ${stats.errors > 0 ? 'active:scale-95 cursor-pointer hover:border-red-200' : ''}`}>
                            <span className="text-[9px] font-bold text-slate-400 uppercase">Lỗi chấm</span>
                            <span className={`text-2xl font-black ${stats.errors > 0 ? 'text-red-500' : 'text-slate-800'}`}>{stats.errors}</span>
                            {stats.errors > 0 && (
                                <div className="absolute top-1 right-1 w-5 h-5 bg-red-50 rounded-full flex items-center justify-center">
                                     <i className="fa-solid fa-pen text-[10px] text-red-500"></i>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Horizontal Scroll List */}
                <h4 className="px-4 text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Chi tiết ngày ({list.length})</h4>
                <div className="flex overflow-x-auto gap-4 px-4 pb-8 -mx-0 snap-x no-scrollbar">
                    {list.length === 0 ? (
                        <div className="w-full text-center text-slate-400 py-10 text-sm bg-white rounded-2xl border border-dashed border-slate-200 mx-4">
                            Không có dữ liệu
                        </div>
                    ) : list.map((item, idx) => (
                        <div key={idx} className={`snap-center flex-shrink-0 w-[85%] sm:w-[320px] p-5 rounded-[24px] flex flex-col justify-between transition-all relative overflow-hidden
                            ${item.status === 'Absent' || item.status === 'Future' 
                                ? 'bg-white border-2 border-dashed border-slate-200' 
                                : 'bg-white shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-slate-100'
                            }`}>
                            
                            {/* Card Header: Date & Badge */}
                            <div className="flex justify-between items-start mb-4">
                                <div className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center border
                                    ${item.dayOfWeek === 0 ? 'bg-red-50 border-red-100 text-red-500' : 'bg-slate-50 border-slate-100 text-slate-600'}`}>
                                    <span className="text-[10px] font-bold uppercase">{getDayName(item.dayOfWeek)}</span>
                                    <span className="text-lg font-black">{formatDayDisplay(item.date)}</span>
                                </div>
                                {renderBadge(item)}
                            </div>

                            {/* Card Content: Time Segments */}
                            <div className="space-y-2 mb-4">
                                {item.shifts && item.shifts.length > 0 ? (
                                    item.shifts.map((shift: any, sIdx: number) => (
                                        <div key={sIdx} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{shift.name}</span>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-sm font-mono font-bold text-slate-800">{shift.in || "--:--"}</span>
                                                    <i className="fa-solid fa-arrow-right text-[10px] text-slate-300"></i>
                                                    <span className="text-sm font-mono font-bold text-slate-800">{shift.out || "--:--"}</span>
                                                </div>
                                            </div>
                                            {(shift.in && !shift.out && item.status !== 'Working') && (
                                                <i className="fa-solid fa-circle-exclamation text-red-500 text-sm"></i>
                                            )}
                                        </div>
                                    ))
                                ) : (
                                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                                        <span className="text-xs font-bold text-slate-400">Không có dữ liệu ca</span>
                                    </div>
                                )}
                            </div>

                            {/* Footer: Hours & Explain */}
                            <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-50">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Tổng giờ</span>
                                    <span className="text-xl font-black text-slate-800">{item.workHours.toFixed(1)}h</span>
                                </div>
                                
                                {item.canExplain && (
                                    <button onClick={() => { setExplainModal({ show: true, date: item.date, type: item.label }); setExplainReason(""); }} 
                                        className="px-4 py-2 bg-white border border-slate-200 shadow-sm text-xs font-bold text-slate-600 rounded-xl active:scale-95 hover:border-emerald-500 hover:text-emerald-600 transition-all flex items-center gap-1.5">
                                        <i className="fa-regular fa-pen-to-square"></i> Giải trình
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                    {/* Spacer for last item scrolling */}
                    <div className="w-2 flex-shrink-0"></div>
                </div>
            </div>
        )}

        {/* Explain Modal */}
        {explainModal && (
            <div className="fixed inset-0 z-[600] bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in">
                <div className="bg-white rounded-[24px] w-full max-w-sm p-6 shadow-2xl animate-scale-in">
                    <div className="flex justify-between items-center mb-4">
                        <h4 className="font-bold text-slate-800">Giải trình công</h4>
                        <button onClick={() => setExplainModal(null)} className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center"><i className="fa-solid fa-xmark"></i></button>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl mb-4 border border-slate-100 flex justify-between"><span className="text-xs font-bold text-slate-500">Ngày: {explainModal.date}</span><span className="text-[10px] font-bold text-red-500 bg-red-50 px-2 rounded border border-red-100">{explainModal.type}</span></div>
                    <textarea className="w-full h-24 bg-white border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none focus:border-emerald-500 mb-4" placeholder="Nhập lý do..." value={explainReason} onChange={e => setExplainReason(e.target.value)}></textarea>
                    <button onClick={handleExplain} disabled={loadingExplain} className="w-full bg-emerald-600 text-white font-bold py-3.5 rounded-xl shadow-lg">{loadingExplain ? "..." : "Gửi giải trình"}</button>
                </div>
            </div>
        )}
    </div>
  );
};
export default TabHistory;