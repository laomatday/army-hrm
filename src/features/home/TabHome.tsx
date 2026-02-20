
import React, { useState, useEffect, useMemo } from 'react';
import { DashboardData } from '../../shared/types';
import { triggerHaptic, timeToMinutes, getCurrentTimeStr } from '../../shared/utils/helpers';
import { togglePause, determineShift } from '../../shared/services/api';
import PullToRefresh from '../../shared/components/PullToRefresh';
import Spinner from '../../shared/components/Spinner';
import StatsCharts from '../stats/StatsCharts';

interface Props {
  data: DashboardData | null;
  loading: boolean;
  onCheckIn: () => void;
  onCheckOut: () => void;
  onChangeTab: (t: any) => void;
  onCreateRequest: () => void;
  onRefresh: () => Promise<void>;
  onAlert: (title: string, msg: string, type: 'success' | 'error' | 'warning') => void;
}

// --- COMPONENT: STAT CARD (RESPONSIVE) ---
const StatCard = ({ 
    title, 
    value, 
    subValue,
    icon, 
    color
}: { 
    title: string, 
    value: string | number, 
    subValue: string,
    icon: string, 
    color: 'emerald' | 'blue' | 'pink' | 'orange'
}) => {
    const theme = {
        emerald: { text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/30' },
        blue: { text: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/30' },
        pink: { text: 'text-pink-600 dark:text-pink-400', bg: 'bg-pink-50 dark:bg-pink-900/30' },
        orange: { text: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/30' },
    };
    
    const t = theme[color];

    return (
        <div className="bg-white dark:bg-slate-800 p-4 rounded-[24px] shadow-sm border border-slate-100 dark:border-slate-700/50 flex items-center gap-3 active:scale-[0.98] transition-all relative overflow-hidden min-h-[110px]">
             {/* Icon Area */}
             <div className={`w-12 h-12 rounded-2xl ${t.bg} ${t.text} flex items-center justify-center text-xl shadow-sm flex-shrink-0`}>
                 <i className={`fa-solid ${icon}`}></i>
             </div>

             {/* Content Area - Fixed width issues */}
             <div className="flex flex-col flex-1 min-w-0 z-10">
                 <span className="text-3xl font-black text-slate-800 dark:text-white tracking-tighter leading-none mb-1 tabular-nums">{value}</span>
                 <h4 className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-tight whitespace-normal">{title}</h4>
             </div>
             
             {/* Decor */}
             <div className={`absolute -right-3 -bottom-5 text-[4.5rem] opacity-5 ${t.text} pointer-events-none`}>
                 <i className={`fa-solid ${icon}`}></i>
             </div>
        </div>
    );
};

const TabHome: React.FC<Props> = ({ data, loading, onCheckIn, onCheckOut, onChangeTab, onCreateRequest, onRefresh, onAlert }) => {
  // Initialize with current time/date to prevent "00:00" flash on mount
  const [timeStr, setTimeStr] = useState(() => {
    return new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false });
  });
  
  const [dateStr, setDateStr] = useState(() => {
    const d = new Date();
    const days = ["CHỦ NHẬT", "THỨ HAI", "THỨ BA", "THỨ TƯ", "THỨ NĂM", "THỨ SÁU", "THỨ BẢY"];
    const dayName = days[d.getDay()];
    const day = d.getDate();
    const month = d.getMonth() + 1;
    return `${dayName}, ${day} THÁNG ${month}`;
  });

  const [isPausing, setIsPausing] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  
  // Month Filter State
  const [viewDate, setViewDate] = useState<Date>(new Date());

  const [holidayConfirm, setHolidayConfirm] = useState<{isOpen: boolean, name: string}>({
      isOpen: false, name: ''
  });

  useEffect(() => {
    const update = () => {
        const d = new Date();
        setTimeStr(d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false }));
        
        const days = ["CHỦ NHẬT", "THỨ HAI", "THỨ BA", "THỨ TƯ", "THỨ NĂM", "THỨ SÁU", "THỨ BẢY"];
        const dayName = days[d.getDay()];
        const day = d.getDate();
        const month = d.getMonth() + 1;
        setDateStr(`${dayName}, ${day} THÁNG ${month}`);
    };
    // Update immediately on mount to be sure
    update();
    const i = setInterval(update, 1000);
    return () => clearInterval(i);
  }, []);

  const getCurrentAttendance = () => {
      if(!data || !data.history.history.length) return null;
      
      // Tìm phiên làm việc chưa check-out
      const openSession = data.history.history.find(h => !h.time_out);
      
      if (!openSession) return null;

      // LOGIC MỚI: Chỉ coi là đang làm việc nếu phiên đó thuộc ngày hôm nay.
      // Nếu là ngày hôm qua (hoặc cũ hơn) mà chưa check-out, ta coi như đã kết thúc (lỗi) 
      // và cho phép hiển thị nút Check-in mới.
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      
      if (openSession.date === todayStr) {
          return openSession;
      }
      
      // Nếu có openSession nhưng date khác today => Đã qua ngày, coi như user chưa vào ca hôm nay.
      return null;
  };

  const currentAtt = getCurrentAttendance();
  const working = !!currentAtt;
  const paused = !!currentAtt?.break_start;

  // --- Real-time Status Calculation ---
  const currentShift = useMemo(() => {
      if (currentAtt && currentAtt.shift_name) {
          return {
              name: currentAtt.shift_name,
              start: currentAtt.shift_start || "00:00",
              end: currentAtt.shift_end || "00:00"
          };
      }
      if (data?.shifts) {
          return determineShift(getCurrentTimeStr(), data.shifts);
      }
      return { name: "--", start: "00:00", end: "00:00" };
  }, [currentAtt, data?.shifts, timeStr]);

  const realTimeStatus = useMemo(() => {
      const nowMins = timeToMinutes(timeStr);
      const startMins = timeToMinutes(currentShift.start);
      let endMins = timeToMinutes(currentShift.end);
      
      if (endMins < startMins) endMins += 24 * 60;
      let displayNowMins = nowMins;
      if (working && nowMins < startMins) displayNowMins += 24 * 60;

      const tolerance = data?.systemConfig?.LATE_TOLERANCE || 15;

      if (working) {
          if (currentAtt?.late_minutes && currentAtt.late_minutes > 0) {
              return { text: `Đi trễ ${currentAtt.late_minutes}p`, color: 'text-orange-500', shiftName: currentShift.name };
          }
          if (displayNowMins > endMins) {
              const ot = Math.floor((displayNowMins - endMins));
              return { text: `Tăng ca ${ot}p`, color: 'text-purple-500', shiftName: currentShift.name };
          }
           return { text: 'Đúng giờ', color: 'text-emerald-500', shiftName: currentShift.name };
      } else {
          if (nowMins > startMins + tolerance) {
               const late = nowMins - startMins;
               return { text: `Đang trễ ${late}p`, color: 'text-red-500', shiftName: currentShift.name };
          }
          if (nowMins < startMins - 15) {
               return { text: 'Sẵn sàng', color: 'text-blue-500', shiftName: currentShift.name };
          }
          return { text: 'Vào ca ngay', color: 'text-emerald-600 dark:text-emerald-400', shiftName: currentShift.name };
      }
  }, [working, currentAtt, timeStr, currentShift, data?.systemConfig]);

  const handleCheckInClick = () => {
      triggerHaptic('medium');
      if (!data) {
          onCheckIn();
          return;
      }

      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      const todayStr = `${y}-${m}-${d}`;

      const holiday = data.holidays?.find(h => todayStr >= h.from_date && todayStr <= h.to_date);

      if (holiday) {
          setHolidayConfirm({ isOpen: true, name: holiday.name });
      } else {
          onCheckIn();
      }
  };

  const handlePauseToggle = async () => {
      if (!data?.userProfile) return;
      triggerHaptic('medium');
      setIsPausing(true);
      
      const res = await togglePause(data.userProfile.employee_id, !paused);
      if (res.success) {
          await onRefresh();
      } else {
          onAlert("Lỗi", res.message, 'error');
      }
      setIsPausing(false);
  };

  const confirmHolidayWork = () => {
      setHolidayConfirm({ isOpen: false, name: '' });
      onCheckIn();
  };

  // --- DYNAMIC STATISTICS CALCULATION ---
  const stats = useMemo(() => {
      const selectedMonth = viewDate.getMonth() + 1;
      const selectedYear = viewDate.getFullYear();
      
      const res = {
          standardDays: 26,
          workDays: 0,
          holidayDays: 0,
          usedLeave: 0,
          totalLeave: 12
      };

      if (!data) return res;

      // 1. Calculate Standard Days (Minus OffDays)
      const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
      const offDays = data.systemConfig?.OFF_DAYS || [0]; // Default Sunday
      let stdDays = 0;
      for (let d = 1; d <= daysInMonth; d++) {
          const dayOfWeek = new Date(selectedYear, selectedMonth - 1, d).getDay();
          if (!offDays.includes(dayOfWeek)) stdDays++;
      }
      res.standardDays = stdDays;

      // 2. Prepare Data Sets
      const validHolidays = data.holidays || [];
      const validLeaves = (data.myRequests || []).filter(r => r.status === 'Approved');
      const validExplanations = (data.myExplanations || []).filter(e => e.status === 'Approved');
      const attendanceList = data.history.history || [];

      // 3. Iterate Days to Calculate Actual Work & Leave
      let actualWork = 0;
      let holidayCount = 0;
      let specificLeaveCount = 0; // Only Annual + Sick

      for (let d = 1; d <= daysInMonth; d++) {
          const currentJsDate = new Date(selectedYear, selectedMonth - 1, d);
          const dateStr = currentJsDate.toISOString().split('T')[0]; // YYYY-MM-DD
          const dayOfWeek = currentJsDate.getDay();

          // Variables for this specific day
          let dayWorkCredit = 0;

          // --- LOGIC 1: TÍNH CÔNG THỰC TẾ ---
          // Bao gồm: Chấm công, Giải trình, Công tác, Làm việc tại nhà
          
          // A. Attendance (Priority 1)
          const att = attendanceList.find(a => a.date === dateStr);
          if (att) {
              const hours = att.work_hours || 0;
              const minFull = data.systemConfig?.MIN_HOURS_FULL || 7;
              const minHalf = data.systemConfig?.MIN_HOURS_HALF || 3.5;
              if (hours >= minFull) dayWorkCredit = 1;
              else if (hours >= minHalf) dayWorkCredit = 0.5;
          }

          // B. Approved Explanation (Priority 2 - Override attendance to 1)
          const exp = validExplanations.find(e => e.date === dateStr);
          if (exp) {
              dayWorkCredit = 1;
          }

          // C. Work-related Approved Requests (Công tác, Làm việc tại nhà)
          const request = validLeaves.find(l => dateStr >= l.from_date && dateStr <= l.to_date);
          if (request) {
              const type = request.type.toLowerCase();
              if (type.includes('công tác') || type.includes('làm việc tại nhà')) {
                  dayWorkCredit = 1;
              }
          }

          // Sum up work credit
          actualWork += dayWorkCredit;

          // --- LOGIC 2: TÍNH PHÉP NĂM ---
          // Chỉ gồm: Nghỉ phép năm, Nghỉ ốm
          if (request) {
              const type = request.type.toLowerCase();
              if (type.includes("nghỉ phép") || type.includes("nghỉ ốm")) {
                   specificLeaveCount++;
              }
          }

          // --- LOGIC 3: TÍNH NGÀY LỄ ---
          const holiday = validHolidays.find(h => dateStr >= h.from_date && dateStr <= h.to_date);
          if (holiday) {
              if (!offDays.includes(dayOfWeek)) {
                  holidayCount++; 
              }
          }
      }

      res.workDays = actualWork;
      res.holidayDays = holidayCount;
      res.usedLeave = specificLeaveCount;
      res.totalLeave = data.userProfile?.annual_leave_balance !== undefined ? 12 : 12; // Or derive from total quota
      
      return res;

  }, [data, viewDate]);

  const isNextMonthDisabled = useMemo(() => {
      const today = new Date();
      return viewDate.getMonth() === today.getMonth() && viewDate.getFullYear() === today.getFullYear();
  }, [viewDate]);

  const changeMonth = (delta: number) => {
      const newDate = new Date(viewDate);
      newDate.setMonth(newDate.getMonth() + delta);
      
      const today = new Date();
      // Block future months
      if (newDate > today) {
          triggerHaptic('error');
          return;
      }

      triggerHaptic('light');
      setViewDate(newDate);
  };

  const getBackgroundClass = () => {
      if (working) {
          return paused ? 'bg-orange-50/50 dark:bg-orange-900/10' : 'bg-emerald-50/50 dark:bg-emerald-900/10';
      }
      return 'bg-slate-50 dark:bg-slate-900';
  };

  return (
    <>
        <PullToRefresh onRefresh={onRefresh} className={`transition-colors duration-1000 ${getBackgroundClass()}`}>
            <div className={`pt-28 pb-32 px-4 animate-fade-in flex flex-col h-full`}>
                
                {/* Clock & Status */}
                <div className="flex flex-col items-center mb-8 relative z-10">
                    <h1 className="text-[5.5rem] leading-none font-black text-slate-900 dark:text-white mb-1 tabular-nums tracking-tighter">{timeStr}</h1>
                    <p className="text-xs font-extrabold text-slate-400 dark:text-slate-500 uppercase mb-6 mt-2 tracking-widest">{dateStr}</p>
                    
                    {/* EXPANDABLE STATUS PILL */}
                    <div className="flex flex-col items-center gap-2 w-full max-w-xs transition-all relative z-20">
                        <button 
                            onClick={() => { triggerHaptic('light'); setIsDetailsOpen(!isDetailsOpen); }}
                            className="active:scale-95 transition-transform outline-none relative z-20"
                            type="button"
                        >
                            {working ? (
                                paused ? (
                                    <div className="bg-orange-100/80 dark:bg-orange-900/50 border border-orange-200 dark:border-orange-800 pl-4 pr-5 py-2.5 rounded-full flex items-center gap-3 shadow-lg shadow-orange-100/50 backdrop-blur-md">
                                        <div className="relative flex h-3 w-3">
                                            <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span>
                                        </div>
                                        <span className="text-xs font-extrabold text-orange-700 dark:text-orange-400 uppercase tracking-widest">Đang tạm dừng</span>
                                        <i className={`fa-solid fa-chevron-down text-orange-400 text-[10px] ml-1 transition-transform ${isDetailsOpen ? 'rotate-180' : ''}`}></i>
                                    </div>
                                ) : (
                                    <div className="bg-emerald-100/80 dark:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800 pl-4 pr-5 py-2.5 rounded-full flex items-center gap-3 shadow-lg shadow-emerald-100/50 backdrop-blur-md">
                                        <div className="relative flex h-3 w-3">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                                        </div>
                                        <span className="text-xs font-extrabold text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">Đang làm việc</span>
                                        <i className={`fa-solid fa-chevron-down text-emerald-400 text-[10px] ml-1 transition-transform ${isDetailsOpen ? 'rotate-180' : ''}`}></i>
                                    </div>
                                )
                            ) : (
                                <div className="bg-white/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 pl-4 pr-5 py-2.5 rounded-full flex items-center gap-3 shadow-lg backdrop-blur-md">
                                    <div className="h-3 w-3 rounded-full bg-slate-300 dark:bg-slate-600"></div>
                                    <span className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Chưa vào ca</span>
                                    <i className={`fa-solid fa-chevron-down text-slate-400 text-[10px] ml-1 transition-transform ${isDetailsOpen ? 'rotate-180' : ''}`}></i>
                                </div>
                            )}
                        </button>

                        {/* EXPANDED DETAILS */}
                        <div className={`overflow-hidden transition-all duration-300 ease-in-out w-full ${isDetailsOpen ? 'max-h-52 opacity-100 mt-2' : 'max-h-0 opacity-0'} relative z-10`}>
                            <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-md rounded-2xl p-4 border border-white/50 dark:border-slate-700/50 shadow-sm flex flex-col gap-2">
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wide">Ca làm việc</span>
                                    <span className="text-slate-900 dark:text-slate-200 font-extrabold">{currentShift.name}</span>
                                </div>
                                <div className="border-b border-dashed border-slate-300/70 dark:border-slate-600/70 my-1"></div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wide">Thời gian</span>
                                    <span className="text-slate-900 dark:text-slate-200 font-mono font-bold tracking-tight">{currentShift.start} - {currentShift.end}</span>
                                </div>
                                {working && (
                                    <div className="flex justify-between items-center text-xs border-t border-slate-200/50 dark:border-slate-700/50 pt-2 mt-1">
                                        <span className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wide">Giờ vào</span>
                                        <span className="text-slate-900 dark:text-slate-200 font-mono font-black tabular-nums">{currentAtt?.time_in}</span>
                                    </div>
                                )}
                                <div className="flex justify-between items-center text-xs border-t border-slate-200/50 dark:border-slate-700/50 pt-2 mt-1">
                                    <span className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wide">Trạng thái</span>
                                    <span className={`font-extrabold uppercase tracking-wide ${realTimeStatus.color}`}>{realTimeStatus.text}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Action Button */}
                <div className="flex flex-col items-center mb-6">
                    {loading || isPausing ? (
                        <div className="w-40 h-40 flex items-center justify-center">
                            <Spinner size="lg" />
                        </div>
                    ) : working ? (
                        paused ? (
                            <div className="relative flex justify-center items-center py-6 animate-scale-in">
                                <div className="absolute w-64 h-64 rounded-full border border-orange-500/10 animate-pulse opacity-40"></div>
                                <button onClick={handlePauseToggle} className="w-44 h-44 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 shadow-[0_25px_60px_-12px_rgba(249,115,22,0.4)] flex flex-col items-center justify-center text-white relative z-10 active:scale-95 transition-all group border-[6px] border-white dark:border-slate-800 ring-1 ring-slate-100 dark:ring-slate-700">
                                    <i className="fa-solid fa-play text-4xl mb-2 ml-1"></i>
                                    <span className="text-base font-extrabold uppercase tracking-widest">Tiếp tục</span>
                                    <span className="text-[10px] font-bold opacity-80 mt-1 uppercase tracking-wide">Làm việc</span>
                                </button>
                            </div>
                        ) : (
                            <div className="relative flex flex-col items-center py-6 animate-scale-in">
                                <div className="relative">
                                    <div className="absolute top-0 left-0 w-full h-full rounded-full border border-red-500/10 animate-ping opacity-20"></div>
                                    <button onClick={() => { triggerHaptic('medium'); onCheckOut(); }} className="w-44 h-44 rounded-full bg-gradient-to-br from-red-500 to-red-600 shadow-[0_25px_60px_-12px_rgba(239,68,68,0.4)] flex flex-col items-center justify-center text-white relative z-10 active:scale-95 transition-all group border-[6px] border-white dark:border-slate-800 ring-1 ring-slate-100 dark:ring-slate-700">
                                        <i className="fa-solid fa-person-walking-arrow-right text-4xl mb-2 group-hover:translate-x-1 transition-transform"></i>
                                        <span className="text-base font-extrabold uppercase tracking-widest">Ra về</span>
                                        <span className="text-[10px] font-bold opacity-80 mt-1 uppercase tracking-wide">Kết thúc ca</span>
                                    </button>
                                </div>
                            </div>
                        )
                    ) : (
                        <div className="relative flex flex-col items-center py-6 animate-scale-in">
                            <div className="relative">
                                <div className="absolute top-0 left-0 w-full h-full rounded-full border border-emerald-500/10 animate-ping opacity-20"></div>
                                <button onClick={handleCheckInClick} className="w-44 h-44 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-[0_25px_60px_-12px_rgba(5,150,105,0.4)] flex flex-col items-center justify-center text-white relative z-10 active:scale-95 transition-all group border-[6px] border-white dark:border-slate-800 ring-1 ring-slate-100 dark:ring-slate-700">
                                    <i className="fa-solid fa-fingerprint text-6xl mb-3"></i>
                                    <span className="text-base font-extrabold uppercase tracking-widest">Chấm công</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* MONTH FILTER (MODERNIZED CAPSULE) */}
                <div className="flex items-center justify-between mb-3 px-1">
                    {/* Update Stats Header to text-[11px] font-extrabold */}
                    <h3 className="text-[11px] font-extrabold text-emerald-700 dark:text-emerald-400 uppercase tracking-widest ml-1">Thống kê</h3>
                    <div className="flex items-center bg-white dark:bg-slate-800 rounded-full shadow-sm border border-slate-100 dark:border-slate-700 pl-1 pr-1 py-1">
                        <button onClick={() => changeMonth(-1)} className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 active:bg-slate-100 dark:active:bg-slate-600 transition-colors">
                            <i className="fa-solid fa-chevron-left text-[10px]"></i>
                        </button>
                        <span className="text-xs font-black text-slate-800 dark:text-white uppercase px-3 min-w-[85px] text-center tabular-nums tracking-wide">
                            T{viewDate.getMonth() + 1}/{viewDate.getFullYear()}
                        </span>
                        <button 
                            disabled={isNextMonthDisabled}
                            onClick={() => changeMonth(1)} 
                            className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${isNextMonthDisabled ? 'text-slate-200 dark:text-slate-600 cursor-not-allowed' : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 active:bg-slate-100 dark:active:bg-slate-600'}`}
                        >
                            <i className="fa-solid fa-chevron-right text-[10px]"></i>
                        </button>
                    </div>
                </div>

                {/* 2x2 STATS GRID */}
                <div className="grid grid-cols-2 gap-3 mb-8 animate-slide-up" style={{animationDelay: '0.1s'}}>
                    <StatCard 
                        title="Công chuẩn" 
                        value={`${stats.standardDays}`}
                        subValue="ngày / tháng"
                        icon="fa-calendar-day" 
                        color="blue"
                    />
                    <StatCard 
                        title="Công thực tế" 
                        value={`${stats.workDays}`}
                        subValue="đã làm"
                        icon="fa-circle-check" 
                        color="emerald"
                    />
                    <StatCard 
                        title="Công nghỉ lễ" 
                        value={`${stats.holidayDays}`}
                        subValue="ngày"
                        icon="fa-champagne-glasses" 
                        color="pink"
                    />
                    <StatCard 
                        title="Phép năm" 
                        value={`${stats.usedLeave}/${stats.totalLeave}`}
                        subValue="đã dùng / tổng"
                        icon="fa-umbrella-beach" 
                        color="orange"
                    />
                </div>

                {/* NEW: CHARTS SECTION */}
                <StatsCharts history={data?.history.history || []} />

                {/* Quick Actions */}
                <div className="grid grid-cols-2 gap-3 mb-8">
                    <button onClick={() => { triggerHaptic('light'); onCreateRequest(); }} className="bg-white dark:bg-slate-800 p-5 rounded-[24px] border border-slate-100 dark:border-slate-700/50 shadow-sm flex items-center gap-3 active:scale-95 transition-all group hover:border-emerald-100 dark:hover:border-emerald-900">
                        <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center text-base border border-emerald-100/50 dark:border-emerald-800/50 group-hover:bg-emerald-600 group-hover:text-white transition-colors shadow-sm">
                            <i className="fa-solid fa-plus"></i>
                        </div>
                        <p className="text-xs font-extrabold text-slate-600 dark:text-slate-300 uppercase group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors tracking-widest">Tạo đề xuất</p>
                    </button>

                    <button onClick={() => { triggerHaptic('light'); onChangeTab('contacts'); }} className="bg-white dark:bg-slate-800 p-5 rounded-[24px] border border-slate-100 dark:border-slate-700/50 shadow-sm flex items-center gap-3 active:scale-95 transition-all group hover:border-blue-100 dark:hover:border-blue-900">
                        <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center text-base border border-blue-100/50 dark:border-blue-800/50 group-hover:bg-blue-600 group-hover:text-white transition-colors shadow-sm">
                            <i className="fa-solid fa-magnifying-glass"></i>
                        </div>
                        <p className="text-xs font-extrabold text-slate-600 dark:text-slate-300 uppercase group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors tracking-widest">Tìm nhân sự</p>
                    </button>
                </div>
            </div>
        </PullToRefresh>

        {/* Holiday Confirm Popup (Dialog Style) */}
        {holidayConfirm.isOpen && (
           <div className="fixed inset-0 z-[3000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in touch-none">
               <div className="bg-white dark:bg-slate-800 w-full max-w-[320px] rounded-[24px] shadow-2xl p-6 flex flex-col items-center text-center animate-scale-in">
                   <div className="w-16 h-16 bg-pink-50 dark:bg-pink-900/30 text-pink-500 dark:text-pink-400 rounded-full flex items-center justify-center mb-4 shadow-inner">
                       <i className="fa-solid fa-champagne-glasses text-2xl"></i>
                   </div>
                   <h3 className="text-xl font-extrabold text-slate-800 dark:text-white mb-1 tracking-tight">Hôm nay là ngày Lễ</h3>
                   <p className="text-sm font-bold text-pink-500 dark:text-pink-400 mb-3 uppercase tracking-wide">{holidayConfirm.name}</p>
                   
                   <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 font-medium leading-relaxed px-2">
                       Hệ thống ghi nhận hôm nay là ngày nghỉ. Bạn có chắc chắn muốn chấm công làm việc không?
                   </p>
                   
                   <div className="w-full space-y-3">
                       <button onClick={confirmHolidayWork} className="w-full py-3 rounded-xl bg-emerald-600 text-white font-bold text-sm shadow-lg shadow-emerald-200 dark:shadow-emerald-900/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 uppercase tracking-wide hover:bg-emerald-700">
                           <i className="fa-solid fa-briefcase"></i> Vẫn đi làm
                       </button>
                       <button onClick={() => setHolidayConfirm({isOpen: false, name: ''})} className="w-full py-3 rounded-xl bg-slate-50 dark:bg-slate-700 text-slate-500 dark:text-slate-300 font-bold text-sm hover:bg-slate-100 dark:hover:bg-slate-600 active:scale-[0.98] transition-colors uppercase tracking-wide">
                           Hủy bỏ
                       </button>
                   </div>
               </div>
           </div>
        )}
    </>
  );
};

export default TabHome;
