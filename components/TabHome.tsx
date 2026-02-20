
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

const TabHome: React.FC<Props> = ({ data, loading, onCheckIn, onCheckOut, onScanKiosk, onRefresh, onAlert }) => {
  const [timeStr, setTimeStr] = useState(() => new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false }));
  const [dateStr, setDateStr] = useState(() => {
    const d = new Date();
    const days = ["CHỦ NHẬT", "THỨ HAI", "THỨ BA", "THỨ TƯ", "THỨ NĂM", "THỨ SÁU", "THỨ BẢY"];
    return `${days[d.getDay()]}, ${d.getDate()} THÁNG ${d.getMonth() + 1}`;
  });

  const [isPausing, setIsPausing] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [holidayConfirm, setHolidayConfirm] = useState<{ isOpen: boolean, name: string }>({ isOpen: false, name: '' });

  useEffect(() => {
    const update = () => {
      const d = new Date();
      setTimeStr(d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false }));
      const days = ["CHỦ NHẬT", "THỨ HAI", "THỨ BA", "THỨ TƯ", "THỨ NĂM", "THỨ SÁU", "THỨ BẢY"];
      setDateStr(`${days[d.getDay()]}, ${d.getDate()} THÁNG ${d.getMonth() + 1}`);
    };
    update();
    const i = setInterval(update, 1000);
    return () => clearInterval(i);
  }, []);

  const getCurrentAttendance = () => {
    if (!data || !data.history.history.length) return null;
    const openSession = data.history.history.find(h => !h.time_out);
    if (!openSession) return null;
    const todayStr = new Date().toISOString().split('T')[0];
    return openSession.date === todayStr ? openSession : null;
  };

  const currentAtt = getCurrentAttendance();
  const working = !!currentAtt;
  const paused = !!currentAtt?.break_start;

  const currentShift = useMemo(() => {
    if (currentAtt?.shift_name) {
      return { name: currentAtt.shift_name, start: currentAtt.shift_start || "00:00", end: currentAtt.shift_end || "00:00" };
    }
    return data?.shifts ? determineShift(getCurrentTimeStr(), data.shifts) : { name: "--", start: "00:00", end: "00:00" };
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
      if (currentAtt?.late_minutes && currentAtt.late_minutes > 0) return { text: `Đi trễ ${currentAtt.late_minutes}p`, color: 'text-orange-500' };
      if (displayNowMins > endMins) return { text: `Tăng ca ${Math.floor(displayNowMins - endMins)}p`, color: 'text-purple-500' };
      return { text: 'Đúng giờ', color: 'text-emerald-500' };
    }
    if (nowMins > startMins + tolerance) return { text: `Đang trễ ${nowMins - startMins}p`, color: 'text-red-500' };
    if (nowMins < startMins - 15) return { text: 'Sẵn sàng', color: 'text-blue-500' };
    return { text: 'Vào ca ngay', color: 'text-emerald-600 dark:text-emerald-400' };
  }, [working, currentAtt, timeStr, currentShift, data?.systemConfig]);

  const handleCheckInClick = () => {
    triggerHaptic('medium');
    const todayStr = new Date().toISOString().split('T')[0];
    const holiday = data?.holidays?.find(h => todayStr >= h.from_date && todayStr <= h.to_date);
    if (holiday) {
      setHolidayConfirm({ isOpen: true, name: holiday.name });
    } else {
      onScanKiosk();
    }
  };

  const confirmHolidayWork = () => {
    setHolidayConfirm({ isOpen: false, name: '' });
    onScanKiosk();
  };

  const getBackgroundClass = () => {
    if (working) return paused ? 'bg-orange-50/50 dark:bg-orange-900/10' : 'bg-emerald-50/50 dark:bg-emerald-900/10';
    return 'bg-slate-50 dark:bg-slate-900';
  };

  const renderActionButton = () => {
    if (loading || isPausing) {
      return <div className="w-40 h-40 flex items-center justify-center"><Spinner size="lg" /></div>;
    }
    if (working) {
      return (
        <div className="relative flex flex-col items-center py-6 animate-scale-in">
          <button 
            onClick={() => { triggerHaptic('medium'); onCheckOut(); }} 
            className="w-48 h-48 rounded-full bg-gradient-to-br from-red-500 to-red-600 shadow-[0_25px_60px_-12px_rgba(239,68,68,0.4)] flex flex-col items-center justify-center text-white relative z-10 active:scale-95 transition-all group border-[6px] border-white dark:border-slate-800 ring-1 ring-slate-100 dark:ring-slate-700"
          >
            <i className="fa-solid fa-person-walking-arrow-right text-5xl mb-2 group-hover:translate-x-1 transition-transform"></i>
            <span className="text-xl font-extrabold uppercase tracking-widest">Ra về</span>
            <span className="text-[10px] font-bold opacity-80 mt-1 uppercase tracking-wide">Kết thúc ca</span>
          </button>
        </div>
      );
    }
    return (
      <div className="relative flex flex-col items-center py-6 animate-scale-in">
        <button 
          onClick={handleCheckInClick} 
          className="w-48 h-48 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-[0_25px_60px_-12px_rgba(5,150,105,0.4)] flex flex-col items-center justify-center text-white relative z-10 active:scale-95 transition-all group border-[6px] border-white dark:border-slate-800 ring-1 ring-slate-100 dark:ring-slate-700"
        >
          <i className="fa-solid fa-qrcode text-7xl mb-3"></i>
          <span className="text-xl font-extrabold uppercase tracking-widest">Chấm công</span>
        </button>
      </div>
    );
  };

  return (
    <>
      <PullToRefresh onRefresh={onRefresh} className={`transition-colors duration-1000 ${getBackgroundClass()}`}>
        <div className="pt-28 pb-32 px-4 animate-fade-in flex flex-col h-full justify-center">
          
          <div className="flex flex-col items-center mb-8">
            <h1 className="text-7xl leading-none font-black text-slate-900 dark:text-white mb-2 tabular-nums tracking-tighter">{timeStr}</h1>
            <p className="text-xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{dateStr}</p>
          </div>

          <div className="flex flex-col items-center justify-center flex-grow">
            {renderActionButton()}
          </div>
          
          <div className="flex flex-col items-center gap-2 w-full max-w-xs mx-auto transition-all relative z-20 mt-8">
            <button 
              onClick={() => { triggerHaptic('light'); setIsDetailsOpen(!isDetailsOpen); }}
              className="active:scale-95 transition-transform outline-none relative z-20"
              type="button"
            >
              <div className={`
                pl-4 pr-5 py-2.5 rounded-full flex items-center gap-3 shadow-lg backdrop-blur-md
                ${working 
                  ? (paused ? 'bg-orange-100/80 dark:bg-orange-900/50 border border-orange-200 dark:border-orange-800' : 'bg-emerald-100/80 dark:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800')
                  : 'bg-white/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700'}
              `}>
                <div className={`relative flex h-3 w-3 ${!working && 'hidden'}`}>
                  {working && !paused && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>}
                  <span className={`relative inline-flex rounded-full h-3 w-3 ${paused ? 'bg-orange-500' : 'bg-emerald-500'}`}></span>
                </div>
                <span className={`text-xs font-extrabold uppercase tracking-widest ${
                  working ? (paused ? 'text-orange-700 dark:text-orange-400' : 'text-emerald-700 dark:text-emerald-400') : 'text-slate-500 dark:text-slate-400'
                }`}>
                  {working ? (paused ? 'Đang tạm dừng' : 'Đang làm việc') : 'Chưa vào ca'}
                </span>
                <i className={`fa-solid fa-chevron-down text-[10px] ml-1 transition-transform ${isDetailsOpen ? 'rotate-180' : ''} ${
                   working ? (paused ? 'text-orange-400' : 'text-emerald-400') : 'text-slate-400'
                }`}></i>
              </div>
            </button>

            <div className={`overflow-hidden transition-all duration-300 ease-in-out w-full ${isDetailsOpen ? 'max-h-52 opacity-100 mt-2' : 'max-h-0 opacity-0'}`}>
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
      </PullToRefresh>

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
