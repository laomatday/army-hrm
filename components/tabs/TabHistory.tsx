import React, { useState, useMemo, useEffect } from 'react';
import { DashboardData, Employee } from '../../types';
import { formatDateString, triggerHaptic } from '../../utils/helpers';
import PullToRefresh from '../ui/PullToRefresh';

interface Props {
  data: DashboardData | null;
  user: Employee;
  onRefresh: () => Promise<void>;
  onAlert: (title: string, msg: string, type: 'success' | 'error' | 'warning') => void;
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

      onExplain(dateStr, defaultReason);
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
              iconClass: 'bg-secondary-red/10 dark:bg-secondary-red/20 text-secondary-red dark:text-secondary-red', 
              dotClass: 'bg-secondary-red',
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
              dayItem.iconClass = 'bg-secondary-purple/10 dark:bg-secondary-purple/20 text-secondary-purple dark:text-secondary-purple';
              dayItem.dotClass = 'bg-secondary-purple';
              dayItem.workHours = 8;
              stats.workDays += 1;
          } else {
              const holiday = data.holidays?.find(h => h.from_date <= dateStr && h.to_date >= dateStr);
              if (holiday) {
                  dayItem.status = 'Holiday';
                  dayItem.shiftInfo = holiday.name || "Ngày Lễ";
                  dayItem.isHoliday = true;
                  dayItem.icon = 'fa-champagne-glasses';
                  dayItem.iconClass = 'bg-secondary-red/10 dark:bg-secondary-red/20 text-secondary-red dark:text-secondary-red ring-1 ring-secondary-red/20 dark:ring-secondary-red/30';
                  dayItem.dotClass = 'bg-secondary-red';
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
                          dayItem.iconClass = 'bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary';
                          dayItem.dotClass = 'bg-primary';
                      } else if (totalHours >= minHalf) {
                          stats.workDays += 0.5;
                          dayItem.status = 'Half';
                          dayItem.icon = 'fa-star-half-stroke';
                          dayItem.iconClass = 'bg-secondary-green/10 dark:bg-secondary-green/20 text-secondary-green dark:text-secondary-green';
                          dayItem.dotClass = 'bg-secondary-green';
                      } else {
                           dayItem.status = 'Working';
                           dayItem.icon = 'fa-briefcase';
                           dayItem.iconClass = 'bg-secondary-yellow/10 dark:bg-secondary-yellow/20 text-secondary-yellow dark:text-secondary-yellow';
                           dayItem.dotClass = 'bg-secondary-yellow';
                      }

                      const hasMissingOut = dailyRecords.some(r => !r.time_out);
                      if (hasMissingOut && dateStr !== formatDateISO(today)) {
                          dayItem.isMissingCheckout = true;
                          stats.errors += 1;
                          dayItem.showExplain = true;
                          dayItem.explainReason = "[Lỗi] ";
                          dayItem.dotClass = 'bg-secondary-red';
                      }
                      
                      if (totalLate > 0) {
                          dayItem.isLate = true;
                          dayItem.showExplain = true;
                          if (!dayItem.explainReason) dayItem.explainReason = "[Trễ] ";
                          if (!dayItem.isMissingCheckout) dayItem.dotClass = 'bg-secondary-yellow';
                      }

                      if (totalEarly > 0) {
                          dayItem.isEarly = true;
                          dayItem.showExplain = true;
                          if (!dayItem.explainReason) dayItem.explainReason = "[Sớm] ";
                          if (!dayItem.isMissingCheckout && !dayItem.isLate) dayItem.dotClass = 'bg-secondary-yellow';
                      }
                  } else {
                       if (offDays.includes(dayOfWeek)) {
                          dayItem.status = 'Weekend';
                          dayItem.shiftInfo = "Nghỉ toàn hệ thống";
                          dayItem.icon = 'fa-mug-hot';
                          dayItem.iconClass = 'bg-slate-50 dark:bg-dark-surface/50 text-slate-400 dark:text-dark-text-secondary';
                          dayItem.dotClass = 'bg-slate-300 dark:bg-dark-border';
                       } else if (loopPtr <= today) {
                          dayItem.status = 'Absent';
                          dayItem.shiftInfo = "Vắng mặt"; 
                          dayItem.showExplain = true;
                          dayItem.explainReason = "[Vắng] ";
                          dayItem.icon = 'fa-xmark';
                          dayItem.iconClass = 'bg-secondary-red/10 dark:bg-secondary-red/20 text-secondary-red dark:text-secondary-red';
                          dayItem.dotClass = 'bg-secondary-red';
                          
                          const todayStr = formatDateISO(today);
                          if (dateStr < todayStr) {
                              stats.errors += 1;
                          }
                       } else {
                           dayItem.status = 'Future';
                           dayItem.shiftInfo = "-";
                           dayItem.dotClass = 'bg-transparent';
                           dayItem.iconClass = 'bg-slate-50 dark:bg-dark-surface/50 text-slate-300 dark:text-dark-text-secondary/50';
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

  const explainableItems = useMemo(() => {
      return list.filter(item => item.showExplain && !item.isExplained);
  }, [list]);

  const displayList = (viewMode === 'week' 
        ? list 
        : (list.filter(item => item.date === selectedDate))
    ).filter(item => item.status !== 'Future');

  const switchViewMode = (mode: 'week' | 'month') => {
      triggerHaptic('light');
      setViewMode(mode);
  };

  return (
    <PullToRefresh onRefresh={onRefresh} className="bg-slate-50 dark:bg-dark-bg">
        <div className="pt-28 px-4 animate-fade-in flex flex-col h-full pb-20">
            
            <div className="flex justify-center mb-8">
                 <div className="bg-slate-200/50 dark:bg-dark-surface p-1.5 rounded-2xl flex relative w-full max-w-[280px] shadow-inner border border-transparent dark:border-dark-border">
                     <button 
                        onClick={() => switchViewMode('week')}
                        className={`flex-1 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all duration-300 relative z-10 ${viewMode === 'week' ? 'text-primary bg-neutral-white dark:bg-dark-border shadow-sm' : 'text-slate-500 dark:text-dark-text-secondary hover:text-slate-700 dark:hover:text-dark-text-primary'}`}
                     >
                         Tuần
                     </button>
                     <button 
                        onClick={() => switchViewMode('month')}
                        className={`flex-1 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all duration-300 relative z-10 ${viewMode === 'month' ? 'text-primary bg-neutral-white dark:bg-dark-border shadow-sm' : 'text-slate-500 dark:text-dark-text-secondary hover:text-slate-700 dark:hover:text-dark-text-primary'}`}
                     >
                         Tháng
                     </button>
                 </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-8">
                <div className="bg-neutral-white dark:bg-dark-surface rounded-[24px] border border-slate-100 dark:border-dark-border p-4 flex flex-col items-center justify-center h-28 shadow-sm">
                    <span className="text-3xl font-black text-primary dark:text-primary mb-1 tabular-nums tracking-tighter drop-shadow-sm">{stats.workDays}</span>
                    <span className="text-[10px] font-extrabold text-slate-400 dark:text-dark-text-secondary uppercase tracking-widest text-center leading-tight mt-1">Ngày công</span>
                </div>
                <div className="bg-neutral-white dark:bg-dark-surface rounded-[24px] border border-slate-100 dark:border-dark-border p-4 flex flex-col items-center justify-center h-28 shadow-sm">
                    <span className="text-3xl font-black text-secondary-yellow dark:text-secondary-yellow mb-1 tabular-nums tracking-tighter drop-shadow-sm">{stats.lateMins}</span>
                    <span className="text-[10px] font-extrabold text-slate-400 dark:text-dark-text-secondary uppercase tracking-widest text-center leading-tight mt-1">Phút trễ</span>
                </div>
                <div className="bg-neutral-white dark:bg-dark-surface rounded-[24px] border border-slate-100 dark:border-dark-border p-4 flex flex-col items-center justify-center h-28 shadow-sm">
                    <span className="text-3xl font-black text-secondary-red dark:text-secondary-red mb-1 tabular-nums tracking-tighter drop-shadow-sm">{stats.errors}</span>
                    <span className="text-[10px] font-extrabold text-slate-400 dark:text-dark-text-secondary uppercase tracking-widest text-center leading-tight mt-1">Lỗi chấm</span>
                </div>
            </div>

            <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-black text-primary dark:text-primary uppercase ml-2 tracking-widest flex items-center gap-2">
                    <i className="fa-solid fa-clock-rotate-left text-[10px]"></i>
                    {viewMode === 'month' ? 'Nhật ký tháng' : 'Nhật ký tuần'}
                </h3>
                
                <div className="flex items-center bg-neutral-white dark:bg-dark-surface rounded-full border border-slate-100 dark:border-dark-border pl-1 pr-1 py-1">
                    <button onClick={() => changeDate(-1)} className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 dark:text-dark-text-secondary hover:bg-slate-50 dark:hover:bg-dark-border/50 active:bg-slate-100 dark:active:bg-dark-border transition-colors">
                        <i className="fa-solid fa-chevron-left text-[10px]"></i>
                    </button>
                    <span className="text-xs font-black text-neutral-black dark:text-dark-text-primary uppercase px-3 min-w-[90px] text-center tabular-nums tracking-wide">
                        {title}
                    </span>
                    <button 
                        disabled={isCurrentView}
                        onClick={() => changeDate(1)} 
                        className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${isCurrentView ? 'text-slate-200 dark:text-dark-border cursor-not-allowed' : 'text-slate-400 dark:text-dark-text-secondary hover:bg-slate-50 dark:hover:bg-dark-border/50 active:bg-slate-100 dark:active:bg-dark-border'}`}
                    >
                        <i className="fa-solid fa-chevron-right text-[10px]"></i>
                    </button>
                </div>
            </div>

            {viewMode === 'month' && (
                <div className="mb-8 bg-neutral-white dark:bg-dark-surface p-5 rounded-[24px] border border-slate-100 dark:border-dark-border animate-scale-in">
                    <div className="grid grid-cols-7 mb-4">
                        {["CN", "T2", "T3", "T4", "T5", "T6", "T7"].map((d, i) => (
                            <div key={i} className="text-center text-[10px] font-extrabold text-slate-400 dark:text-dark-text-secondary uppercase tracking-wider">{d}</div>
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
                                    className={`h-10 flex flex-col items-center justify-center relative cursor-pointer rounded-xl transition-all ${isSelected ? 'bg-primary/10 dark:bg-primary/20 ring-2 ring-primary/50 dark:ring-primary/40 text-primary dark:text-primary' : 'hover:bg-slate-50 dark:hover:bg-dark-border/50 text-slate-700 dark:text-dark-text-primary'}`}
                                >
                                    <span className={`text-base font-black tabular-nums tracking-tight ${day.dayOfWeek === 0 && !isSelected ? 'text-secondary-red dark:text-secondary-red' : ''}`}>{day.dayNum}</span>
                                    {day.status !== 'Future' && (
                                        <div className={`w-1.5 h-1.5 rounded-full mt-1 ${day.dotClass}`}></div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
            
            {displayList.length === 0 ? (
                <div className="w-full text-center py-12 text-sm font-bold text-slate-400 dark:text-dark-text-secondary bg-neutral-white dark:bg-dark-surface rounded-3xl border border-dashed border-slate-200 dark:border-dark-border mb-12">
                    {viewMode === 'month' ? 'Chọn ngày để xem chi tiết' : 'Không có dữ liệu'}
                </div>
            ) : (
                <div className="bg-neutral-white dark:bg-dark-surface rounded-[24px] overflow-hidden border border-slate-100 dark:border-dark-border divide-y divide-slate-50 dark:divide-dark-border mb-12 shadow-sm animate-slide-up">
                    {displayList.map((item, idx) => {
                        const isExpanded = expandedDate === item.date;
                        
                        return (
                        <div key={idx} 
                            onClick={() => { triggerHaptic('light'); setExpandedDate(isExpanded ? null : item.date); }}
                            className="w-full bg-neutral-white dark:bg-dark-surface overflow-hidden transition-colors active:bg-slate-50 dark:active:bg-dark-border/50"
                        >
                            <div className="p-5 flex items-center justify-between">
                                <div className="flex flex-col items-center justify-center w-14 border-r border-slate-100 dark:border-dark-border pr-4 mr-1">
                                    <span className="text-[10px] font-extrabold text-slate-400 dark:text-dark-text-secondary uppercase leading-none mb-1.5 tracking-wide">{getDayName(item.dayOfWeek)}</span>
                                    <span className={`text-2xl font-black leading-none tabular-nums tracking-tighter ${item.dayOfWeek === 0 ? 'text-secondary-red dark:text-secondary-red' : 'text-neutral-black dark:text-dark-text-primary'}`}>{item.dayNum}</span>
                                </div>

                                <div className="flex-1 pl-3">
                                    <h4 className="text-base font-bold text-neutral-black dark:text-dark-text-primary mb-1.5 leading-tight">{item.shiftInfo}</h4>
                                    
                                    <div className="flex flex-wrap gap-1.5 items-center">
                                        {item.status !== 'Future' && item.status !== 'Absent' && item.status !== 'Weekend' && (
                                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary border border-primary/20 dark:border-primary/30 flex items-center gap-1 uppercase tracking-wider">
                                                <i className="fa-regular fa-clock mr-1"></i> {item.workHours.toFixed(1)}h
                                            </span>
                                        )}

                                        {item.isLate && (
                                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-secondary-yellow/10 dark:bg-secondary-yellow/20 text-secondary-yellow dark:text-secondary-yellow border border-secondary-yellow/20 dark:border-secondary-yellow/30 flex items-center gap-1 uppercase tracking-wider">
                                                <i className="fa-solid fa-person-running mr-1"></i> Trễ {item.lateMins}p
                                            </span>
                                        )}

                                        {item.isEarly && (
                                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-secondary-yellow/10 dark:bg-secondary-yellow/20 text-secondary-yellow dark:text-secondary-yellow border border-secondary-yellow/20 dark:border-secondary-yellow/30 flex items-center gap-1 uppercase tracking-wider">
                                                <i className="fa-solid fa-person-walking-arrow-right mr-1"></i> Sớm {item.earlyMins}p
                                            </span>
                                        )}

                                        {item.isMissingCheckout && (
                                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-secondary-red/10 dark:bg-secondary-red/20 text-secondary-red dark:text-secondary-red border border-secondary-red/20 dark:border-secondary-red/30 flex items-center gap-1 uppercase tracking-wider">
                                                <i className="fa-solid fa-circle-exclamation mr-1"></i> Thiếu giờ ra
                                            </span>
                                        )}

                                        {(item.status === 'Holiday') && (
                                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-secondary-red/10 dark:bg-secondary-red/20 text-secondary-red dark:text-secondary-red border border-secondary-red/20 dark:border-secondary-red/30 uppercase tracking-wider flex items-center gap-1">
                                                <i className="fa-solid fa-champagne-glasses"></i> Lễ
                                            </span>
                                        )}

                                        {item.status === 'Leave' && (
                                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-secondary-purple/10 dark:bg-secondary-purple/20 text-secondary-purple dark:text-secondary-purple border border-secondary-purple/20 dark:border-secondary-purple/30 uppercase tracking-wider">
                                                <i className="fa-solid fa-umbrella-beach mr-1"></i> {item.leaveType}
                                            </span>
                                        )}
                                        
                                        {item.showExplain && (
                                            item.isExplained ? (
                                                <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-dark-border/50 text-slate-400 dark:text-dark-text-secondary text-[10px] font-extrabold border border-slate-200 dark:border-dark-border uppercase tracking-wider">
                                                    <i className="fa-solid fa-check text-[10px] mr-1"></i> Đã giải trình
                                                </span>
                                            ) : (
                                                <button 
                                                    onClick={(e) => handleExplainClick(e, item.date, item.explainReason)}
                                                    className="px-2.5 py-0.5 rounded-md bg-secondary-orange hover:bg-secondary-orange/90 text-neutral-white text-[10px] font-extrabold active:scale-95 transition-all uppercase tracking-wider shadow-sm"
                                                >
                                                    Giải trình
                                                </button>
                                            )
                                        )}
                                    </div>
                                </div>

                                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ml-2 transition-transform duration-300 ${item.iconClass} ${isExpanded ? 'rotate-180' : ''}`}>
                                    {isExpanded ? <i className="fa-solid fa-chevron-down text-lg text-slate-400 dark:text-dark-text-secondary"></i> : <i className={`fa-solid ${item.icon} text-lg`}></i>}
                                </div>
                            </div>

                            {isExpanded && item.raw && (
                                <div className="bg-slate-50/50 dark:bg-dark-bg/50 border-t border-slate-100 dark:border-dark-border p-5 animate-fade-in text-sm text-slate-600 dark:text-dark-text-secondary space-y-3">
                                     <div className="grid grid-cols-2 gap-4">
                                         <div>
                                             <p className="text-[10px] font-extrabold text-slate-400 dark:text-dark-text-secondary uppercase mb-1 tracking-wide">Giờ vào</p>
                                             <p className="font-bold text-neutral-black dark:text-dark-text-primary text-base font-mono">{item.raw.time_in}</p>
                                         </div>
                                         <div>
                                             <p className="text-[10px] font-extrabold text-slate-400 dark:text-dark-text-secondary uppercase mb-1 tracking-wide">Giờ ra</p>
                                             <p className="font-bold text-neutral-black dark:text-dark-text-primary text-base font-mono">{item.raw.time_out || "--:--"}</p>
                                         </div>
                                     </div>
                                     
                                     {(item.raw.checkin_lat || item.raw.checkout_lat) && (
                                         <div>
                                             <p className="text-[10px] font-extrabold text-slate-400 dark:text-dark-text-secondary uppercase mb-1 tracking-wide">Vị trí check-in</p>
                                             <p className="font-medium text-slate-700 dark:text-dark-text-secondary text-xs truncate font-mono">
                                                 {item.raw.checkin_lat}, {item.raw.checkin_lng}
                                             </p>
                                         </div>
                                     )}

                                     {item.raw.selfie_url && (
                                         <div className="pt-2">
                                              <a href={item.raw.selfie_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-primary dark:text-primary font-bold text-xs uppercase bg-neutral-white dark:bg-dark-surface border border-primary/20 dark:border-primary/30 px-4 py-2.5 rounded-xl tracking-wide hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors">
                                                  <i className="fa-solid fa-image"></i> Xem ảnh Check-in
                                              </a>
                                         </div>
                                     )}
                                </div>
                            )}
                        </div>
                    )})}
                </div>
            )}
        </div>
    </PullToRefresh>
  );
};
export default TabHistory;