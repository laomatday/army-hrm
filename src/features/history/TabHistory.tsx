
import React, { useState, useMemo, useEffect } from 'react';
import { DashboardData, Employee } from '../../shared/types';
import { submitExplanation } from '../../shared/services/api';
import { formatDateString, triggerHaptic } from '../../shared/utils/helpers';
import PullToRefresh from '../../shared/components/PullToRefresh';
import ConfirmDialog from '../../shared/components/ConfirmDialog';

interface Props {
  data: DashboardData | null;
  user: Employee;
  onRefresh: () => Promise<void>;
  onAlert: (title: string, msg: string, type: 'success' | 'error') => void;
  onExplain: (date: string, reason: string) => void;
}

const TabHistory: React.FC<Props> = ({ data, user, onRefresh, onAlert, onExplain }) => {
  const [viewMode, setViewMode] = useState<'week' | 'month'>(() => 
      (localStorage.getItem('army_history_view_mode') as 'week'|'month') || 'week'
  );

  useEffect(() => {
    localStorage.setItem('army_history_view_mode', viewMode);
  }, [viewMode]);

  const [viewDate, setViewDate] = useState<Date>(new Date()); 
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  const [explainModal, setExplainModal] = useState<{isOpen: boolean, date: string, reason: string}>({
      isOpen: false, date: '', reason: ''
  });
  const [confirmDialog, setConfirmDialog] = useState<{isOpen: boolean, isPastMonth: boolean}>({
      isOpen: false, isPastMonth: false
  });
  const [loading, setLoading] = useState(false);

  const formatDateISO = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
  };

  const handleExplainClick = (e: React.MouseEvent, dateStr: string, defaultReason: string) => {
      e.stopPropagation();
      triggerHaptic('light');
      if (!data) return;

      const attDate = new Date(dateStr);
      const now = new Date();
      
      const nextMonth = new Date(attDate.getFullYear(), attDate.getMonth() + 1, 1);
      const deadline = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 5);
      deadline.setHours(23, 59, 59);

      if (now > deadline) {
          onAlert("Quá hạn giải trình", "Chỉ được giải trình trước ngày 5 của tháng kế tiếp.", "error");
          return;
      }

      const targetMonth = attDate.getMonth();
      const targetYear = attDate.getFullYear();
      
      const count = data.myExplanations.filter(r => {
          const rDate = new Date(r.date);
          return r.status !== 'Rejected' && 
                 rDate.getMonth() === targetMonth && 
                 rDate.getFullYear() === targetYear;
      }).length;

      if (count >= 5) {
          onAlert("Đạt giới hạn", "Bạn chỉ được gửi tối đa 5 giải trình mỗi tháng.", "error");
          return;
      }

      setExplainModal({
          isOpen: true,
          date: dateStr,
          reason: defaultReason
      });
  };

  const handlePreSubmit = () => {
      if (!explainModal.reason.trim()) {
          onAlert("Thiếu thông tin", "Vui lòng nhập lý do giải trình.", "error");
          return;
      }

      const attDate = new Date(explainModal.date);
      const now = new Date();
      const isPast = attDate.getMonth() !== now.getMonth() || attDate.getFullYear() !== now.getFullYear();

      setConfirmDialog({
          isOpen: true,
          isPastMonth: isPast
      });
  };

  const handleSubmitExplanation = async () => {
      setLoading(true);
      const res = await submitExplanation({
          employeeId: user.employee_id,
          name: user.name,
          date: explainModal.date,
          reason: explainModal.reason
      });
      setLoading(false);

      setConfirmDialog({ isOpen: false, isPastMonth: false });
      setExplainModal({ isOpen: false, date: '', reason: '' });

      onAlert(res.success ? "Thành công" : "Lỗi", res.message, res.success ? 'success' : 'error');
      if (res.success) {
          onRefresh();
      }
  };

  const processedData = useMemo(() => {
      if (!data) return { stats: { workDays: 0, lateMins: 0, errors: 0 }, list: [], title: '', calendarGrid: [] };

      const stats = { workDays: 0, lateMins: 0, errors: 0 };
      const list: any[] = [];
      const today = new Date();
      today.setHours(0,0,0,0);
      
      const { systemConfig } = data;
      const minFull = systemConfig?.MIN_HOURS_FULL || 7;
      const minHalf = systemConfig?.MIN_HOURS_HALF || 3.5;
      const offDays = Array.isArray(systemConfig?.OFF_DAYS) ? systemConfig.OFF_DAYS : [0];

      let startDate: Date, endDate: Date, title: string;

      if (viewMode === 'month') {
          const year = viewDate.getFullYear();
          const month = viewDate.getMonth();
          startDate = new Date(year, month, 1);
          endDate = new Date(year, month + 1, 0); 
          title = `THÁNG ${month + 1}/${year}`;
      } else {
          endDate = new Date(viewDate);
          endDate.setHours(23, 59, 59);

          startDate = new Date(endDate);
          startDate.setDate(endDate.getDate() - 6);
          startDate.setHours(0, 0, 0, 0);

          const sD = startDate.getDate();
          const eD = endDate.getDate();
          const sM = startDate.getMonth() + 1;
          const eM = endDate.getMonth() + 1;
          
          title = (sM === eM) 
            ? `${sD} - ${eD} THG ${sM}` 
            : `${sD}/${sM} - ${eD}/${eM}`;
      }

      let ptr = new Date(startDate);
      const dateInfoMap: Record<string, any> = {};

      const loopEnd = new Date(endDate);
      const loopPtr = new Date(startDate);

      while(loopPtr <= loopEnd) {
          const dateStr = formatDateISO(loopPtr);
          const dayOfWeek = loopPtr.getDay(); 
          
          let dayItem: any = {
              date: dateStr,
              dayOfWeek: dayOfWeek,
              dayNum: loopPtr.getDate(),
              status: 'Absent',
              workHours: 0,
              lateMins: 0,
              earlyMins: 0,
              shiftInfo: "Không chấm công", 
              icon: 'fa-xmark',
              iconClass: 'bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400', 
              dotClass: 'bg-red-500',
              showExplain: false,
              isExplained: false,
              explainReason: '',
              isMissingCheckout: false,
              isLate: false,
              isEarly: false,
              leaveType: '',
              isHoliday: false,
              raw: null
          };

          const existingExplain = data.myExplanations.find(r => 
              r.date === dateStr && 
              r.status !== 'Rejected'
          );

          if (existingExplain) {
              dayItem.isExplained = true;
          }

          const leave = data.myRequests.find(r => 
              r.status === 'Approved' && 
              r.from_date <= dateStr && r.to_date >= dateStr
          );

          if (leave) {
              dayItem.status = 'Leave';
              dayItem.shiftInfo = "Nghỉ phép";
              dayItem.leaveType = leave.type;
              dayItem.icon = 'fa-gift';
              dayItem.iconClass = 'bg-purple-50 dark:bg-purple-900/20 text-purple-500 dark:text-purple-400';
              dayItem.dotClass = 'bg-purple-500';
              dayItem.workHours = 8;
              stats.workDays += 1;
          } else {
              const holiday = data.holidays?.find(h => h.from_date <= dateStr && h.to_date >= dateStr);
              if (holiday) {
                  dayItem.status = 'Holiday';
                  dayItem.shiftInfo = holiday.name || "Ngày Lễ";
                  dayItem.isHoliday = true;
                  dayItem.icon = 'fa-champagne-glasses';
                  dayItem.iconClass = 'bg-pink-50 dark:bg-pink-900/20 text-pink-500 dark:text-pink-400 shadow-sm ring-1 ring-pink-100 dark:ring-pink-900/30';
                  dayItem.dotClass = 'bg-pink-500';
                  dayItem.workHours = 8;
                  stats.workDays += 1;
              } else {
                  const dailyRecords = data.history.history.filter(h => h.date === dateStr);
                  
                  if (dailyRecords.length > 0) {
                      dayItem.raw = dailyRecords[0];
                      let totalHours = 0;
                      let totalLate = 0;
                      let totalEarly = 0;
                      
                      dailyRecords.forEach(att => {
                          totalHours += Number(att.work_hours || 0);
                          totalLate += Number(att.late_minutes || 0);
                          totalEarly += Number(att.early_minutes || 0);
                      });

                      dayItem.workHours = totalHours;
                      dayItem.lateMins = totalLate;
                      dayItem.earlyMins = totalEarly;
                      stats.lateMins += totalLate;
                      dayItem.shiftInfo = `Đã chấm công`; 

                      if(dailyRecords[0].shift_name) dayItem.shiftInfo = dailyRecords[0].shift_name;

                      if (totalHours >= minFull) {
                          stats.workDays += 1;
                          dayItem.status = 'Full';
                          dayItem.icon = 'fa-check';
                          dayItem.iconClass = 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500 dark:text-emerald-400';
                          dayItem.dotClass = 'bg-emerald-500';
                      } else if (totalHours >= minHalf) {
                          stats.workDays += 0.5;
                          dayItem.status = 'Half';
                          dayItem.icon = 'fa-star-half-stroke';
                          dayItem.iconClass = 'bg-blue-50 dark:bg-blue-900/20 text-blue-500 dark:text-blue-400';
                          dayItem.dotClass = 'bg-blue-500';
                      } else {
                           dayItem.status = 'Working';
                           dayItem.icon = 'fa-briefcase';
                           dayItem.iconClass = 'bg-orange-50 dark:bg-orange-900/20 text-orange-500 dark:text-orange-400';
                           dayItem.dotClass = 'bg-orange-500';
                      }

                      const hasMissingOut = dailyRecords.some(r => !r.time_out);
                      if (hasMissingOut && dateStr !== formatDateISO(today)) {
                          dayItem.isMissingCheckout = true;
                          stats.errors += 1;
                          dayItem.showExplain = true;
                          dayItem.explainReason = "Quên Check-out";
                          dayItem.dotClass = 'bg-red-500';
                      }
                      
                      if (totalLate > 0) {
                          dayItem.isLate = true;
                          dayItem.showExplain = true;
                          if (!dayItem.explainReason) dayItem.explainReason = `Đi muộn ${totalLate} phút`;
                          if (!dayItem.isMissingCheckout) dayItem.dotClass = 'bg-orange-500';
                      }

                      if (totalEarly > 0) {
                          dayItem.isEarly = true;
                          dayItem.showExplain = true;
                          if (!dayItem.explainReason) dayItem.explainReason = `Về sớm ${totalEarly} phút`;
                          if (!dayItem.isMissingCheckout && !dayItem.isLate) dayItem.dotClass = 'bg-orange-500';
                      }
                  } else {
                       if (offDays.includes(dayOfWeek)) {
                          dayItem.status = 'Weekend';
                          dayItem.shiftInfo = "Nghỉ toàn hệ thống";
                          dayItem.icon = 'fa-mug-hot';
                          dayItem.iconClass = 'bg-slate-50 dark:bg-slate-800 text-slate-300 dark:text-slate-600';
                          dayItem.dotClass = 'bg-slate-300 dark:bg-slate-600';
                       } else if (loopPtr <= today) {
                          dayItem.status = 'Absent';
                          dayItem.shiftInfo = "Vắng mặt"; 
                          dayItem.showExplain = true;
                          dayItem.explainReason = "Quên chấm công";
                          dayItem.icon = 'fa-xmark';
                          dayItem.iconClass = 'bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400';
                          dayItem.dotClass = 'bg-red-500';
                          
                          const todayStr = formatDateISO(today);
                          if (dateStr < todayStr) {
                              stats.errors += 1;
                          }
                       } else {
                           dayItem.status = 'Future';
                           dayItem.shiftInfo = "-";
                           dayItem.dotClass = 'bg-transparent';
                           dayItem.iconClass = 'bg-slate-50 dark:bg-slate-800 text-slate-300 dark:text-slate-600';
                       }
                  }
              }
          }
          
          dateInfoMap[dateStr] = dayItem;
          list.push(dayItem);
          
          loopPtr.setDate(loopPtr.getDate() + 1);
      }
      
      const filteredList = [...list];
      filteredList.reverse();

      let calendarGrid: any[] = [];
      if (viewMode === 'month') {
          const firstDay = startDate.getDay();
          for(let i=0; i<firstDay; i++) {
              calendarGrid.push(null);
          }
          const ptrMonth = new Date(startDate);
          while(ptrMonth <= endDate) {
              const dStr = formatDateISO(ptrMonth);
              calendarGrid.push(dateInfoMap[dStr]);
              ptrMonth.setDate(ptrMonth.getDate() + 1);
          }
      }
      
      return { stats, list: filteredList, title, calendarGrid };
  }, [data, viewDate, viewMode]);

  const changeDate = (delta: number) => {
      triggerHaptic('light');
      const newDate = new Date(viewDate);
      if (viewMode === 'month') {
          newDate.setMonth(newDate.getMonth() + delta);
      } else {
          newDate.setDate(newDate.getDate() + (delta * 7));
      }
      setViewDate(newDate);
  };
  
  const isCurrentView = useMemo(() => {
      const today = new Date();
      if (viewMode === 'week') {
          const d = new Date(viewDate);
          return d.setHours(0,0,0,0) >= today.setHours(0,0,0,0);
      } else {
          return viewDate.getMonth() === today.getMonth() && viewDate.getFullYear() === today.getFullYear();
      }
  }, [viewDate, viewMode]);

  const getDayName = (idx: number) => ["CN", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"][idx];

  const { stats, list, title, calendarGrid } = processedData;

  const displayList = (viewMode === 'week' 
        ? list 
        : (list.filter(item => item.date === selectedDate))
    ).filter(item => item.status !== 'Future');

  const switchViewMode = (mode: 'week' | 'month') => {
      triggerHaptic('light');
      setViewMode(mode);
  };

  return (
    <PullToRefresh onRefresh={onRefresh} className="bg-slate-50 dark:bg-slate-900">
        <div className="pt-28 px-4 animate-fade-in flex flex-col h-full pb-20">
            
            {/* VIEW TOGGLE CAPSULE */}
            <div className="flex justify-center mb-6">
                 <div className="bg-slate-200/60 dark:bg-slate-800/60 p-1 rounded-full flex relative shadow-inner">
                     <button 
                        onClick={() => switchViewMode('week')}
                        className={`px-6 py-2 rounded-full text-xs font-extrabold uppercase tracking-widest transition-all duration-300 relative z-10 ${viewMode === 'week' ? 'text-emerald-600 dark:text-emerald-400 bg-white dark:bg-slate-700 shadow-md' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                     >
                         Tuần
                     </button>
                     <button 
                        onClick={() => switchViewMode('month')}
                        className={`px-6 py-2 rounded-full text-xs font-extrabold uppercase tracking-widest transition-all duration-300 relative z-10 ${viewMode === 'month' ? 'text-emerald-600 dark:text-emerald-400 bg-white dark:bg-slate-700 shadow-md' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                     >
                         Tháng
                     </button>
                 </div>
            </div>

            {/* Summary Widgets */}
            <div className="grid grid-cols-3 gap-3 mb-8">
                <div className="bg-white dark:bg-slate-800 rounded-[24px] border border-slate-100 dark:border-slate-700 p-4 flex flex-col items-center justify-center h-28 shadow-sm">
                    <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mb-1 tabular-nums tracking-tighter">{stats.workDays}</span>
                    <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Ngày công</span>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-[24px] border border-slate-100 dark:border-slate-700 p-4 flex flex-col items-center justify-center h-28 shadow-sm">
                    <span className="text-3xl font-black text-orange-500 dark:text-orange-400 mb-1 tabular-nums tracking-tighter">{stats.lateMins}</span>
                    <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Phút trễ</span>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-[24px] border border-slate-100 dark:border-slate-700 p-4 flex flex-col items-center justify-center h-28 shadow-sm">
                    <span className="text-3xl font-black text-red-500 dark:text-red-400 mb-1 tabular-nums tracking-tighter">{stats.errors}</span>
                    <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Lỗi chấm</span>
                </div>
            </div>

            {/* CONTROL ROW (Section Title + Date Navigator) */}
            <div className="flex items-center justify-between mb-4">
                {/* Fixed font class to text-[11px] font-extrabold */}
                <h4 className="text-[11px] font-extrabold text-emerald-700 dark:text-emerald-400 uppercase ml-1 tracking-widest">
                    {viewMode === 'month' ? 'Nhật ký tháng' : 'Nhật ký tuần'}
                </h4>
                
                {/* Modern Date Navigator */}
                <div className="flex items-center bg-white dark:bg-slate-800 rounded-full shadow-sm border border-slate-100 dark:border-slate-700 pl-1 pr-1 py-1">
                    <button onClick={() => changeDate(-1)} className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 active:bg-slate-100 dark:active:bg-slate-600 transition-colors">
                        <i className="fa-solid fa-chevron-left text-[10px]"></i>
                    </button>
                    <span className="text-xs font-black text-slate-800 dark:text-white uppercase px-3 min-w-[90px] text-center tabular-nums tracking-wide">
                        {title}
                    </span>
                    <button 
                        disabled={isCurrentView}
                        onClick={() => changeDate(1)} 
                        className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${isCurrentView ? 'text-slate-200 dark:text-slate-600 cursor-not-allowed' : 'text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 active:bg-slate-100 dark:active:bg-slate-600'}`}
                    >
                        <i className="fa-solid fa-chevron-right text-[10px]"></i>
                    </button>
                </div>
            </div>

            {/* CALENDAR VIEW (Only displays in month mode) */}
            {viewMode === 'month' && (
                <div className="mb-8 bg-white dark:bg-slate-800 p-5 rounded-[24px] shadow-sm border border-slate-100 dark:border-slate-700 animate-scale-in">
                    <div className="grid grid-cols-7 mb-4">
                        {["CN", "T2", "T3", "T4", "T5", "T6", "T7"].map((d, i) => (
                            <div key={i} className="text-center text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{d}</div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7 gap-y-3 gap-x-1">
                        {calendarGrid.map((day, idx) => {
                            if (!day) return <div key={idx} className="h-10"></div>; 
                            const isSelected = day.date === selectedDate;
                            return (
                                <div 
                                    key={idx} 
                                    onClick={() => { triggerHaptic('light'); setSelectedDate(day.date); }}
                                    className={`h-10 flex flex-col items-center justify-center relative cursor-pointer rounded-xl transition-all ${isSelected ? 'bg-slate-100 dark:bg-slate-700 ring-2 ring-emerald-500 text-emerald-700 dark:text-emerald-400' : 'hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'}`}
                                >
                                    <span className={`text-base font-black tabular-nums tracking-tight ${day.dayOfWeek === 0 && !isSelected ? 'text-red-500 dark:text-red-400' : ''}`}>{day.dayNum}</span>
                                    {day.status !== 'Future' && (
                                        <div className={`w-1.5 h-1.5 rounded-full mt-1 ${day.dotClass}`}></div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
            
            {/* List Items */}
            <div className="flex flex-col gap-3 pb-12">
                {displayList.length === 0 ? (
                        <div className="w-full text-center py-12 text-sm font-bold text-slate-400 dark:text-slate-600 bg-white dark:bg-slate-800 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700">
                            {viewMode === 'month' ? 'Chọn ngày để xem chi tiết' : 'Không có dữ liệu'}
                        </div>
                ) : displayList.map((item, idx) => {
                    const isExpanded = expandedDate === item.date;
                    
                    return (
                    <div key={idx} 
                        onClick={() => { triggerHaptic('light'); setExpandedDate(isExpanded ? null : item.date); }}
                        className="w-full bg-white dark:bg-slate-800 rounded-[24px] shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden animate-slide-up transition-all active:scale-[0.99]"
                    >
                        <div className="p-5 flex items-center justify-between">
                            <div className="flex flex-col items-center justify-center w-14 border-r border-slate-100 dark:border-slate-700 pr-4 mr-1">
                                <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase leading-none mb-1.5 tracking-wide">{getDayName(item.dayOfWeek)}</span>
                                <span className={`text-2xl font-black leading-none tabular-nums tracking-tighter ${item.dayOfWeek === 0 ? 'text-red-500 dark:text-red-400' : 'text-slate-800 dark:text-white'}`}>{item.dayNum}</span>
                            </div>

                            <div className="flex-1 pl-3">
                                <h4 className="text-base font-bold text-slate-800 dark:text-white mb-1.5">{item.shiftInfo}</h4>
                                
                                <div className="flex flex-wrap gap-1.5 items-center">
                                    {item.status !== 'Future' && item.status !== 'Absent' && item.status !== 'Weekend' && (
                                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30 flex items-center gap-1 uppercase tracking-wider">
                                            <i className="fa-regular fa-clock mr-1"></i> {item.workHours.toFixed(1)}h
                                        </span>
                                    )}

                                    {item.isLate && (
                                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 border border-orange-100 dark:border-orange-900/30 flex items-center gap-1 uppercase tracking-wider">
                                            <i className="fa-solid fa-person-running mr-1"></i> Trễ {item.lateMins}p
                                        </span>
                                    )}

                                    {item.isEarly && (
                                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30 flex items-center gap-1 uppercase tracking-wider">
                                            <i className="fa-solid fa-person-walking-arrow-right mr-1"></i> Sớm {item.earlyMins}p
                                        </span>
                                    )}

                                    {item.isMissingCheckout && (
                                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/30 flex items-center gap-1 uppercase tracking-wider">
                                            <i className="fa-solid fa-circle-exclamation mr-1"></i> Thiếu giờ ra
                                        </span>
                                    )}

                                    {(item.status === 'Holiday') && (
                                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-pink-50 dark:bg-pink-900/20 text-pink-500 dark:text-pink-400 border border-pink-100 dark:border-pink-900/30 uppercase tracking-wider flex items-center gap-1">
                                            <i className="fa-solid fa-champagne-glasses"></i> Lễ
                                        </span>
                                    )}

                                    {item.status === 'Leave' && (
                                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/30 uppercase tracking-wider">
                                            <i className="fa-solid fa-umbrella-beach mr-1"></i> {item.leaveType}
                                        </span>
                                    )}
                                    
                                    {item.showExplain && (
                                        item.isExplained ? (
                                            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-400 text-[10px] font-extrabold border border-slate-200 dark:border-slate-600 uppercase tracking-wider">
                                                <i className="fa-solid fa-check text-[10px] mr-1"></i> Đã giải trình
                                            </span>
                                        ) : (
                                            <button 
                                                onClick={(e) => handleExplainClick(e, item.date, item.explainReason)}
                                                className="px-2.5 py-0.5 rounded-md bg-orange-500 text-white text-[10px] font-extrabold shadow-sm active:scale-95 transition-all uppercase tracking-wider"
                                            >
                                                Giải trình
                                            </button>
                                        )
                                    )}
                                </div>
                            </div>

                            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ml-2 transition-transform duration-300 ${item.iconClass} ${isExpanded ? 'rotate-180' : ''}`}>
                                {isExpanded ? <i className="fa-solid fa-chevron-down text-lg"></i> : <i className={`fa-solid ${item.icon} text-lg`}></i>}
                            </div>
                        </div>

                        {/* EXPANDED DETAIL VIEW */}
                        {isExpanded && item.raw && (
                            <div className="bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700 p-5 animate-fade-in text-sm text-slate-600 dark:text-slate-400 space-y-3">
                                 <div className="grid grid-cols-2 gap-4">
                                     <div>
                                         <p className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase mb-1 tracking-wide">Giờ vào</p>
                                         <p className="font-bold text-slate-800 dark:text-slate-200 text-base">{item.raw.time_in}</p>
                                     </div>
                                     <div>
                                         <p className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase mb-1 tracking-wide">Giờ ra</p>
                                         <p className="font-bold text-slate-800 dark:text-slate-200 text-base">{item.raw.time_out || "--:--"}</p>
                                     </div>
                                 </div>
                                 
                                 {(item.raw.checkin_lat || item.raw.checkout_lat) && (
                                     <div>
                                         <p className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase mb-1 tracking-wide">Vị trí check-in</p>
                                         <p className="font-medium text-slate-700 dark:text-slate-300 text-xs truncate">
                                             {item.raw.checkin_lat}, {item.raw.checkin_lng}
                                         </p>
                                     </div>
                                 )}

                                 {item.raw.selfie_url && (
                                     <div className="pt-2">
                                          <a href={item.raw.selfie_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs uppercase bg-white dark:bg-slate-700 border border-emerald-100 dark:border-emerald-900/30 px-3 py-2 rounded-xl shadow-sm tracking-wide">
                                              <i className="fa-solid fa-image"></i> Xem ảnh Check-in
                                          </a>
                                     </div>
                                 )}
                            </div>
                        )}
                    </div>
                )})}
            </div>
        </div>

        {/* Explain Modal */}
        {explainModal.isOpen && (
            <div className="fixed inset-0 z-[2000] bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm flex flex-col justify-end animate-fade-in">
                <div className="bg-white dark:bg-slate-900 rounded-t-[32px] p-6 animate-slide-up shadow-2xl pb-safe">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="text-xl font-extrabold text-slate-800 dark:text-white uppercase tracking-tight">Giải trình công</h3>
                            <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1 uppercase tracking-wide">
                                <i className="fa-regular fa-calendar-check mr-1"></i>
                                {formatDateString(explainModal.date)}
                            </p>
                        </div>
                        <button onClick={() => setExplainModal({...explainModal, isOpen: false})} className="w-10 h-10 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700">
                            <i className="fa-solid fa-xmark"></i>
                        </button>
                    </div>

                    <div className="space-y-4 mb-6">
                         <div>
                             <label className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase mb-2 block tracking-wide">Lý do</label>
                             <textarea 
                                autoFocus
                                className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-base font-medium text-slate-800 dark:text-white outline-none h-32 resize-none focus:bg-white dark:focus:bg-slate-900 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all placeholder:text-slate-400 placeholder:font-normal"
                                placeholder="Nhập lý do chi tiết..."
                                value={explainModal.reason}
                                onChange={e => setExplainModal({...explainModal, reason: e.target.value})}
                             ></textarea>
                         </div>
                    </div>

                    <button 
                        onClick={handlePreSubmit}
                        className="w-full py-4 rounded-2xl bg-orange-500 text-white font-extrabold text-base shadow-xl shadow-orange-200/50 active:scale-[0.98] transition-all flex items-center justify-center gap-2 uppercase tracking-wide"
                    >
                        Gửi giải trình <i className="fa-solid fa-paper-plane"></i>
                    </button>
                </div>
            </div>
        )}

        <ConfirmDialog 
            isOpen={confirmDialog.isOpen}
            title="Gửi giải trình?"
            message={confirmDialog.isPastMonth ? 
                <span className="text-red-500 font-bold"><i className="fa-solid fa-triangle-exclamation mr-1"></i> Bạn đang giải trình cho tháng trước. Đơn này có thể bị tính là trễ hạn.</span> 
                : 
                <span>Hệ thống sẽ ghi nhận giải trình của bạn cho ngày <span className="text-slate-800 dark:text-white font-bold">{formatDateString(explainModal.date)}</span>.</span>
            }
            confirmLabel="Xác nhận gửi"
            onConfirm={handleSubmitExplanation}
            onCancel={() => setConfirmDialog({...confirmDialog, isOpen: false})}
            isLoading={loading}
            type={confirmDialog.isPastMonth ? 'warning' : 'success'}
        />
    </PullToRefresh>
  );
};
export default TabHistory;
