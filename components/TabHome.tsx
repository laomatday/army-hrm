import React, { useState, useEffect, useMemo } from 'react';
import { DashboardData } from '../types';
import { triggerHaptic, timeToMinutes, getCurrentTimeStr } from '../utils/helpers';
import { togglePause, determineShift } from '../services/api';
import PullToRefresh from './PullToRefresh';
import Spinner from './Spinner';

interface Props {
  data: DashboardData | null;
  loading: boolean;
  onCheckIn: () => void;
  onCheckOut: () => void;
  onScanKiosk: () => void;
  onChangeTab: (t: any) => void;
  onCreateRequest: () => void;
  onRefresh: () => Promise<void>;
  onAlert: (title: string, msg: string, type: 'success' | 'error' | 'warning') => void;
}

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
        <div className="bg-white dark:bg-slate-800 p-4 rounded-[24px] border border-slate-100 dark:border-slate-700/50 flex items-center gap-3 active:scale-[0.98] transition-all relative overflow-hidden min-h-[110px]">
             <div className={`w-12 h-12 rounded-2xl ${t.bg} ${t.text} flex items-center justify-center text-xl flex-shrink-0`}>
                 <i className={`fa-solid ${icon}`}></i>
             </div>

             <div className="flex flex-col flex-1 min-w-0 z-10">
                 <span className="text-3xl font-black text-slate-800 dark:text-white tracking-tighter leading-none mb-1 tabular-nums">{value}</span>
                 <h4 className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-tight whitespace-normal">{title}</h4>
             </div>
             
             <div className={`absolute -right-3 -bottom-5 text-[4.5rem] opacity-5 ${t.text} pointer-events-none`}>
                 <i className={`fa-solid ${icon}`}></i>
             </div>
        </div>
    );
};

const TabHome: React.FC<Props> = ({ data, loading, onCheckIn, onCheckOut, onScanKiosk, onChangeTab, onCreateRequest, onRefresh, onAlert }) => {
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
  
  const [viewDate, setViewDate] = useState<Date>(new Date());

  const [holidayConfirm, setHolidayConfirm] = useState<{isOpen: boolean, name: string}>({ isOpen: false, name: '' });
  const [earlyCheckoutConfirm, setEarlyCheckoutConfirm] = useState<{isOpen: boolean, minutes: number}>({ isOpen: false, minutes: 0 });

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
    update();
    const i = setInterval(update, 1000);
    return () => clearInterval(i);
  }, []);

  const getTodaysAttendance = () => {
      if (!data || !data.history.history.length) return null;
      const todayStr = new Date().toISOString().split('T')[0];
      const todaysHistory = data.history.history
          .filter(h => h.date === todayStr)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return todaysHistory[0] || null;
  };

  const todaysAtt = getTodaysAttendance();
  const working = !!(todaysAtt && !todaysAtt.time_out);
  const checkedOut = !!(todaysAtt && todaysAtt.time_out);
  const paused = !!todaysAtt?.break_start;

  const currentShift = useMemo(() => {
      if (working && todaysAtt?.shift_name) {
          return {
              name: todaysAtt.shift_name,
              start: todaysAtt.shift_start || "00:00",
              end: todaysAtt.shift_end || "00:00"
          };
      }
      if (data?.shifts) {
          return determineShift(getCurrentTimeStr(), data.shifts);
      }
      return { name: "--", start: "00:00", end: "00:00" };
  }, [working, todaysAtt, data?.shifts, timeStr]);

  const dayIsOver = useMemo(() => {
      if (!checkedOut || !todaysAtt) return false;
      if (currentShift.name !== '--' && currentShift.name !== todaysAtt.shift_name) {
          return false;
      }
      return true;
  }, [checkedOut, todaysAtt, currentShift]);

  const realTimeStatus = useMemo(() => {
      const nowMins = timeToMinutes(timeStr);
      const startMins = timeToMinutes(currentShift.start);
      let endMins = timeToMinutes(currentShift.end);
      const isOvernight = endMins < startMins;
      if (isOvernight) endMins += 24 * 60;
      let displayNowMins = nowMins;
      if (isOvernight && nowMins < startMins && nowMins < startMins - 720) {
          displayNowMins += 24 * 60;
      }
      const tolerance = data?.systemConfig?.LATE_TOLERANCE || 15;

      if (working && todaysAtt) {
          if (todaysAtt.late_minutes && todaysAtt.late_minutes > 0) {
              return { text: `Đi trễ ${todaysAtt.late_minutes}p`, color: 'text-orange-500', shiftName: currentShift.name };
          }
          if (displayNowMins > endMins) {
              const ot = Math.floor((displayNowMins - endMins));
              return { text: `Tăng ca ${ot}p`, color: 'text-purple-500', shiftName: currentShift.name };
          }
          return { text: 'Đúng giờ', color: 'text-emerald-500', shiftName: currentShift.name };
      }

      if (!dayIsOver) {
          if (nowMins > startMins + tolerance) {
              const late = nowMins - startMins;
              return { text: `Đang trễ ${late}p`, color: 'text-red-500', shiftName: currentShift.name };
          }
          if (nowMins < startMins - 15) {
              return { text: 'Sẵn sàng', color: 'text-blue-500', shiftName: currentShift.name };
          }
          return { text: 'Vào ca ngay', color: 'text-emerald-600 dark:text-emerald-400', shiftName: currentShift.name };
      }

      if (dayIsOver && todaysAtt) {
          if (todaysAtt.late_minutes && todaysAtt.late_minutes > 0) {
              return { text: `Đi trễ ${todaysAtt.late_minutes}p`, color: 'text-orange-500', shiftName: todaysAtt.shift_name };
          }
          const checkoutEndMins = timeToMinutes(todaysAtt.shift_end || '00:00');
          const checkOutMins = timeToMinutes(todaysAtt.time_out || '00:00');
          const earlyMinutes = checkoutEndMins - checkOutMins;
          if (earlyMinutes > 5) {
              return { text: `Về sớm ${earlyMinutes}p`, color: 'text-orange-500', shiftName: todaysAtt.shift_name };
          }
          return { text: 'Hoàn thành', color: 'text-emerald-500', shiftName: todaysAtt.shift_name };
      }

      return { text: 'Ngoài giờ', color: 'text-slate-500', shiftName: '--' };
  }, [working, dayIsOver, todaysAtt, timeStr, currentShift, data?.systemConfig]);

  const handleCheckInClick = () => {
      triggerHaptic('medium');
      if (!data) {
          onScanKiosk();
          return;
      }
      const todayStr = new Date().toISOString().split('T')[0];
      const holiday = data.holidays?.find(h => todayStr >= h.from_date && todayStr <= h.to_date);
      if (holiday) {
          setHolidayConfirm({ isOpen: true, name: holiday.name });
      } else {
          onScanKiosk();
      }
  };

  const handleCheckOutClick = () => {
      triggerHaptic('medium');
      const nowMins = timeToMinutes(getCurrentTimeStr());
      let endMins = timeToMinutes(currentShift.end);
      const startMins = timeToMinutes(currentShift.start);
      if (endMins < startMins && nowMins < startMins) {
          endMins += 24 * 60;
      }
      const earlyMinutes = endMins - nowMins;
      if (earlyMinutes > 5) {
          setEarlyCheckoutConfirm({ isOpen: true, minutes: earlyMinutes });
      } else {
          onCheckOut();
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
      onScanKiosk();
  };
  
  const confirmEarlyCheckout = () => {
      setEarlyCheckoutConfirm({ isOpen: false, minutes: 0 });
      onCheckOut();
  };

  const stats = useMemo(() => {
      const selectedMonth = viewDate.getMonth() + 1;
      const selectedYear = viewDate.getFullYear();
      const res = { standardDays: 26, workDays: 0, holidayDays: 0, usedLeave: 0, totalLeave: 12 };
      if (!data) return res;

      const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
      const offDays = data.systemConfig?.OFF_DAYS || [0];
      let stdDays = 0;
      for (let d = 1; d <= daysInMonth; d++) {
          const dayOfWeek = new Date(selectedYear, selectedMonth - 1, d).getDay();
          if (!offDays.includes(dayOfWeek)) stdDays++;
      }
      res.standardDays = stdDays;

      const validHolidays = data.holidays || [];
      const validLeaves = (data.myRequests || []).filter(r => r.status === 'Approved');
      const validExplanations = (data.myExplanations || []).filter(e => e.status === 'Approved');
      const attendanceList = data.history.history || [];

      let actualWork = 0;
      let holidayCount = 0;
      let specificLeaveCount = 0;

      for (let d = 1; d <= daysInMonth; d++) {
          const currentJsDate = new Date(selectedYear, selectedMonth - 1, d);
          const dateStr = currentJsDate.toISOString().split('T')[0];
          const dayOfWeek = currentJsDate.getDay();
          let dayWorkCredit = 0;

          const att = attendanceList.find(a => a.date === dateStr);
          if (att) {
              const hours = att.work_hours || 0;
              const minFull = data.systemConfig?.MIN_HOURS_FULL || 7;
              const minHalf = data.systemConfig?.MIN_HOURS_HALF || 3.5;
              if (hours >= minFull) dayWorkCredit = 1;
              else if (hours >= minHalf) dayWorkCredit = 0.5;
          }

          const exp = validExplanations.find(e => e.date === dateStr);
          if (exp) dayWorkCredit = 1;

          const request = validLeaves.find(l => dateStr >= l.from_date && dateStr <= l.to_date);
          if (request) {
              const type = request.type.toLowerCase();
              if (type.includes('công tác') || type.includes('làm việc tại nhà')) dayWorkCredit = 1;
          }
          actualWork += dayWorkCredit;

          if (request) {
              const type = request.type.toLowerCase();
              if (type.includes("nghỉ phép") || type.includes("nghỉ ốm")) specificLeaveCount++;
          }

          const holiday = validHolidays.find(h => dateStr >= h.from_date && dateStr <= h.to_date);
          if (holiday && !offDays.includes(dayOfWeek)) holidayCount++;
      }

      res.workDays = actualWork;
      res.holidayDays = holidayCount;
      res.usedLeave = specificLeaveCount;
      res.totalLeave = data.userProfile?.annual_leave_balance ?? 12;
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
      if (newDate > today) {
          triggerHaptic('error');
          return;
      }
      triggerHaptic('light');
      setViewDate(newDate);
  };

  const getBackgroundClass = () => {
      if (working) return paused ? 'bg-orange-50/50 dark:bg-orange-900/10' : 'bg-emerald-50/50 dark:bg-emerald-900/10';
      return 'bg-slate-50 dark:bg-slate-900';
  };

  return (
    <>
        <PullToRefresh onRefresh={onRefresh} className={`transition-colors duration-1000 ${getBackgroundClass()}`}>
            <div className={`pt-28 pb-32 px-4 animate-fade-in flex flex-col h-full`}>
                
                <div className="flex flex-col items-center mb-8 relative z-10">
                    <h1 className="text-[5.5rem] leading-none font-black text-slate-900 dark:text-white mb-1 tabular-nums tracking-tighter">{timeStr}</h1>
                    <p className="text-xs font-extrabold text-slate-400 dark:text-slate-500 uppercase mb-6 mt-2 tracking-widest">{dateStr}</p>
                    
                    <div className="flex flex-col items-center gap-2 w-full max-w-xs transition-all relative z-20">
                        <button 
                            onClick={() => { triggerHaptic('light'); setIsDetailsOpen(!isDetailsOpen); }}
                            className="active:scale-95 transition-transform outline-none relative z-20"
                            type="button"
                        >
                            {working ? (
                                paused ? (
                                    <div className="bg-orange-100/80 dark:bg-orange-900/50 border border-orange-200 dark:border-orange-800 pl-4 pr-5 py-2.5 rounded-full flex items-center gap-3">
                                        <div className="relative flex h-3 w-3"><span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span></div>
                                        <span className="text-xs font-extrabold text-orange-700 dark:text-orange-400 uppercase tracking-widest">Đang tạm dừng</span>
                                        <i className={`fa-solid fa-chevron-down text-orange-400 text-[10px] ml-1 transition-transform ${isDetailsOpen ? 'rotate-180' : ''}`}></i>
                                    </div>
                                ) : (
                                    <div className="bg-emerald-100/80 dark:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800 pl-4 pr-5 py-2.5 rounded-full flex items-center gap-3">
                                        <div className="relative flex h-3 w-3">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                                        </div>
                                        <span className="text-xs font-extrabold text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">Đang làm việc</span>
                                        <i className={`fa-solid fa-chevron-down text-emerald-400 text-[10px] ml-1 transition-transform ${isDetailsOpen ? 'rotate-180' : ''}`}></i>
                                    </div>
                                )
                            ) : dayIsOver ? (
                                <div className="bg-white/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 pl-4 pr-5 py-2.5 rounded-full flex items-center gap-3">
                                    <div className="h-3 w-3 rounded-full bg-slate-300 dark:bg-slate-600"></div>
                                    <span className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Đã check-out</span>
                                    <i className={`fa-solid fa-chevron-down text-slate-400 text-[10px] ml-1 transition-transform ${isDetailsOpen ? 'rotate-180' : ''}`}></i>
                                </div>
                            ) : (
                                <div className="bg-white/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 pl-4 pr-5 py-2.5 rounded-full flex items-center gap-3">
                                    <div className="h-3 w-3 rounded-full bg-slate-300 dark:bg-slate-600"></div>
                                    <span className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Chưa vào ca</span>
                                    <i className={`fa-solid fa-chevron-down text-slate-400 text-[10px] ml-1 transition-transform ${isDetailsOpen ? 'rotate-180' : ''}`}></i>
                                </div>
                            )}
                        </button>

                        <div className={`overflow-hidden transition-all duration-300 ease-in-out w-full ${isDetailsOpen ? 'max-h-52 opacity-100 mt-2' : 'max-h-0 opacity-0'} relative z-10`}>
                            <div className="bg-white/60 dark:bg-slate-800/60 rounded-2xl p-4 border border-white/50 dark:border-slate-700/50 flex flex-col gap-2">
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wide">Ca làm việc</span>
                                    <span className="text-slate-900 dark:text-slate-200 font-extrabold">{realTimeStatus.shiftName}</span>
                                </div>
                                <div className="border-b border-dashed border-slate-300/70 dark:border-slate-600/70 my-1"></div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wide">Thời gian</span>
                                    <span className="text-slate-900 dark:text-slate-200 font-mono font-bold tracking-tight">{currentShift.start} - {currentShift.end}</span>
                                </div>
                                {(working || checkedOut) && (
                                    <>
                                      <div className="flex justify-between items-center text-xs border-t border-slate-200/50 dark:border-slate-700/50 pt-2 mt-1">
                                          <span className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wide">Giờ vào</span>
                                          <span className="text-slate-900 dark:text-slate-200 font-mono font-black tabular-nums">{todaysAtt?.time_in}</span>
                                      </div>
                                      {checkedOut && (
                                        <div className="flex justify-between items-center text-xs border-t border-slate-200/50 dark:border-slate-700/50 pt-2 mt-1">
                                            <span className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wide">Giờ ra</span>
                                            <span className="text-slate-900 dark:text-slate-200 font-mono font-black tabular-nums">{todaysAtt?.time_out}</span>
                                        </div>
                                      )}
                                    </>
                                )}
                                <div className="flex justify-between items-center text-xs border-t border-slate-200/50 dark:border-slate-700/50 pt-2 mt-1">
                                    <span className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wide">Trạng thái</span>
                                    <span className={`font-extrabold uppercase tracking-wide ${realTimeStatus.color}`}>{realTimeStatus.text}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col items-center mb-6 py-6">
                    {loading || isPausing ? (
                        <div className="w-44 h-44 flex items-center justify-center"><Spinner size="lg" /></div>
                    ) : (
                        <div className="relative w-44 h-44 flex items-center justify-center animate-scale-in">
                             {/* Animations - CORRECTED */}
                            {working && !paused && ( // Check out button - red
                                <>
                                    <div className="absolute inset-0 bg-red-200/30 dark:bg-red-500/10 rounded-full blur-xl animate-pulse"></div>
                                    <div className="absolute inset-0 border border-red-500/20 rounded-full animate-spin-slow"></div>
                                </>
                            )}
                            {working && paused && ( // Paused button - orange
                                <>
                                    <div className="absolute inset-0 bg-orange-200/30 dark:bg-orange-500/10 rounded-full blur-xl animate-pulse"></div>
                                    <div className="absolute inset-0 border border-orange-500/20 rounded-full animate-spin-slow"></div>
                                </>
                            )}
                            {!working && !dayIsOver && ( // Check in button - emerald
                                <>
                                    <div className="absolute inset-0 bg-emerald-200/30 dark:bg-emerald-500/10 rounded-full blur-xl animate-pulse"></div>
                                    <div className="absolute inset-0 border border-emerald-500/20 rounded-full animate-spin-slow"></div>
                                </>
                            )}
                            {!working && dayIsOver && ( // Day is over button - slate
                                <>
                                    <div className="absolute inset-0 bg-slate-300/30 dark:bg-slate-500/10 rounded-full blur-xl animate-pulse"></div>
                                    <div className="absolute inset-0 border border-slate-400/20 rounded-full animate-spin-slow"></div>
                                </>
                            )}

                            {/* Buttons */}  
                            {working ? (
                                paused ? (
                                    <button onClick={handlePauseToggle} className="w-full h-full rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex flex-col items-center justify-center text-white relative z-10 active:scale-95 transition-all group border-[6px] border-white dark:border-slate-800 ring-1 ring-slate-100 dark:ring-slate-700">
                                        <i className="fa-solid fa-play text-4xl mb-2 ml-1"></i>
                                        <span className="text-base font-extrabold uppercase tracking-widest">Tiếp tục</span>
                                        <span className="text-[10px] font-bold opacity-80 mt-1 uppercase tracking-wide">Làm việc</span>
                                    </button>
                                ) : (
                                    <button onClick={handleCheckOutClick} className="w-full h-full rounded-full bg-gradient-to-br from-red-500 to-red-600 flex flex-col items-center justify-center text-white relative z-10 active:scale-95 transition-all group border-[6px] border-white dark:border-slate-800 ring-1 ring-slate-100 dark:ring-slate-700">
                                        <i className="fa-solid fa-person-walking-arrow-right text-4xl mb-2 group-hover:translate-x-1 transition-transform"></i>
                                        <span className="text-base font-extrabold uppercase tracking-widest">Ra về</span>
                                        <span className="text-[10px] font-bold opacity-80 mt-1 uppercase tracking-wide">Kết thúc ca</span>
                                    </button>
                                )
                            ) : dayIsOver ? (
                                <div className="w-full h-full rounded-full bg-gradient-to-br from-slate-400 to-slate-500 flex flex-col items-center justify-center text-white relative z-10 border-[6px] border-white dark:border-slate-800 ring-1 ring-slate-100 dark:ring-slate-700">
                                    <i className="fa-solid fa-house-chimney text-4xl mb-2"></i>
                                    <span className="text-base font-extrabold uppercase tracking-widest">ĐÃ VỀ</span>
                                    <span className="text-[10px] font-bold opacity-80 mt-1 uppercase tracking-wide">Hẹn mai gặp lại</span>
                                </div>
                            ) : (
                                <button onClick={handleCheckInClick} className="w-full h-full rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex flex-col items-center justify-center text-white relative z-10 active:scale-95 transition-all group border-[6px] border-white dark:border-slate-800 ring-1 ring-slate-100 dark:ring-slate-700">
                                    <i className="fa-solid fa-qrcode text-6xl mb-3"></i>
                                    <span className="text-base font-extrabold uppercase tracking-widest">Chấm công</span>
                                </button>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-between mb-3 px-1">
                    <h3 className="text-xs font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest ml-2 flex items-center gap-2">
                        <i className="fa-solid fa-chart-pie text-[10px]"></i> Thống kê
                    </h3>
                    <div className="flex items-center bg-white dark:bg-slate-800 rounded-full border border-slate-100 dark:border-slate-700 pl-1 pr-1 py-1">
                        <button onClick={() => changeMonth(-1)} className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 active:bg-slate-100 dark:active:bg-slate-600 transition-colors">
                            <i className="fa-solid fa-chevron-left text-[10px]"></i>
                        </button>
                        <span className="text-xs font-black text-slate-800 dark:text-white uppercase px-3 min-w-[85px] text-center tabular-nums tracking-wide">
                            T{viewDate.getMonth() + 1}/{viewDate.getFullYear()}
                        </span>
                        <button 
                            disabled={isNextMonthDisabled}
                            onClick={() => changeMonth(1)} 
                            className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${isNextMonthDisabled ? 'text-slate-200 dark:text-slate-600 cursor-not-allowed' : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 active:bg-slate-100 dark:active:bg-slate-600'}`}>
                            <i className="fa-solid fa-chevron-right text-[10px]"></i>
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-8 animate-slide-up">
                    <StatCard title="Công chuẩn" value={`${stats.standardDays}`} subValue="ngày / tháng" icon="fa-calendar-day" color="blue" />
                    <StatCard title="Công thực tế" value={`${stats.workDays}`} subValue="đã làm" icon="fa-circle-check" color="emerald" />
                    <StatCard title="Công nghỉ lễ" value={`${stats.holidayDays}`} subValue="ngày" icon="fa-champagne-glasses" color="pink" />
                    <StatCard title="Phép năm" value={`${stats.usedLeave}/${stats.totalLeave}`} subValue="đã dùng / tổng" icon="fa-umbrella-beach" color="orange" />
                </div>
            </div>
        </PullToRefresh>

        {holidayConfirm.isOpen && (
           <div className="fixed inset-0 z-[3000] bg-slate-900/60 flex items-center justify-center p-6 animate-fade-in touch-none">
               <div className="bg-white dark:bg-slate-800 w-full max-w-[320px] rounded-[24px] p-6 flex flex-col items-center text-center animate-scale-in">
                   <div className="w-16 h-16 bg-pink-50 dark:bg-pink-900/30 text-pink-500 dark:text-pink-400 rounded-full flex items-center justify-center mb-4"><i className="fa-solid fa-champagne-glasses text-2xl"></i></div>
                   <h3 className="text-xl font-extrabold text-slate-800 dark:text-white mb-1 tracking-tight">Hôm nay là ngày Lễ</h3>
                   <p className="text-sm font-bold text-pink-500 dark:text-pink-400 mb-3 uppercase tracking-wide">{holidayConfirm.name}</p>
                   <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 font-medium leading-relaxed px-2">Hệ thống ghi nhận hôm nay là ngày nghỉ. Bạn có chắc chắn muốn chấm công làm việc không?</p>
                   <div className="w-full space-y-3">
                       <button onClick={confirmHolidayWork} className="w-full py-3 rounded-xl bg-emerald-600 text-white font-bold text-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2 uppercase tracking-wide hover:bg-emerald-700"><i className="fa-solid fa-briefcase"></i> Vẫn đi làm</button>
                       <button onClick={() => setHolidayConfirm({isOpen: false, name: ''})} className="w-full py-3 rounded-xl bg-slate-50 dark:bg-slate-700 text-slate-500 dark:text-slate-300 font-bold text-sm hover:bg-slate-100 dark:hover:bg-slate-600 active:scale-[0.98] transition-colors uppercase tracking-wide">Hủy bỏ</button>
                   </div>
               </div>
           </div>
        )}
        
        {earlyCheckoutConfirm.isOpen && (
           <div className="fixed inset-0 z-[3000] bg-slate-900/60 flex items-center justify-center p-6 animate-fade-in touch-none">
               <div className="bg-white dark:bg-slate-800 w-full max-w-[320px] rounded-[24px] p-6 flex flex-col items-center text-center animate-scale-in">
                   <div className="w-16 h-16 bg-orange-50 dark:bg-orange-900/30 text-orange-500 dark:text-orange-400 rounded-full flex items-center justify-center mb-4"><i className="fa-solid fa-stopwatch text-2xl"></i></div>
                   <h3 className="text-xl font-extrabold text-slate-800 dark:text-white mb-1 tracking-tight">Bạn muốn về sớm?</h3>
                   <p className="text-sm font-bold text-orange-500 dark:text-orange-400 mb-3 uppercase tracking-wide">Sớm {earlyCheckoutConfirm.minutes} phút</p>
                   <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 font-medium leading-relaxed px-2">Bạn sẽ bị ghi nhận là về sớm nếu check-out ngay bây giờ. Bạn có chắc chắn muốn tiếp tục?</p>
                   <div className="w-full space-y-3">
                       <button onClick={confirmEarlyCheckout} className="w-full py-3 rounded-xl bg-red-600 text-white font-bold text-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2 uppercase tracking-wide hover:bg-red-700"><i className="fa-solid fa-door-open"></i> Vẫn Ra Về</button>
                       <button onClick={() => setEarlyCheckoutConfirm({ isOpen: false, minutes: 0 })} className="w-full py-3 rounded-xl bg-slate-50 dark:bg-slate-700 text-slate-500 dark:text-slate-300 font-bold text-sm hover:bg-slate-100 dark:hover:bg-slate-600 active:scale-[0.98] transition-colors uppercase tracking-wide">Hủy bỏ</button>
                   </div>
               </div>
           </div>
        )}
        <style>{`
            .animate-spin-slow {
                animation: spin 15s linear infinite;
            }
            @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
        `}</style>
    </>
  );
};

export default TabHome;
