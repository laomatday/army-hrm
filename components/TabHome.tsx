import React, { useState, useEffect } from 'react';
import { DashboardData } from '../types';
import { formatDate } from '../utils/helpers';

interface Props {
  data: DashboardData | null;
  loading: boolean;
  onCheckIn: () => void;
  onCheckOut: () => void;
  onChangeTab: (t: any) => void;
}

const TabHome: React.FC<Props> = ({ data, loading, onCheckIn, onCheckOut, onChangeTab }) => {
  const [timeStr, setTimeStr] = useState("00:00");
  const [dateStr, setDateStr] = useState("...");

  useEffect(() => {
    const update = () => {
        const d = new Date();
        setTimeStr(d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false }));
        const days = ["CHỦ NHẬT", "THỨ HAI", "THỨ BA", "THỨ TƯ", "THỨ NĂM", "THỨ SÁU", "THỨ BẢY"];
        setDateStr(`${days[d.getDay()]}, ${d.getDate()} THG ${d.getMonth() + 1}`);
    };
    update();
    const i = setInterval(update, 1000);
    return () => clearInterval(i);
  }, []);

  const isCheckedIn = () => {
      if(!data || !data.history.history.length) return false;
      
      // Convert now to YYYY-MM-DD
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      
      // Robust check: Look for ANY record today that has NO time_out.
      // This handles cases where multiple shifts exist and ensures we find the active one.
      return data.history.history.some(h => h.date === todayStr && !h.time_out);
  };

  const working = isCheckedIn();
  const summary = data?.history.summary || { workDays: 0, standardDays: 26, leaveDays: 0, remainingLeave: 12 };

  // Calculate percentages
  const workPct = Math.min(100, Math.round((summary.workDays / summary.standardDays) * 100)) || 0;
  const leavePct = Math.min(100, Math.round(((summary.leaveDays) / 12) * 100)) || 0; 

  return (
    <div className="absolute inset-0 overflow-y-auto no-scrollbar pt-safe pb-32 bg-slate-50">
        <div className="flex flex-col items-center pt-28 px-6">
            
            {/* Header: Time & Date */}
            <div className="flex flex-col items-center justify-center mb-8 animate-fade-in">
                <div className="text-[6rem] leading-[0.9] font-black text-slate-800 tracking-tighter tabular-nums font-sans">
                    {timeStr}
                </div>
                <div className="text-slate-400 font-bold text-xs mt-4 uppercase tracking-widest bg-slate-100/80 px-4 py-1.5 rounded-full shadow-sm border border-white">
                    {dateStr}
                </div>
            </div>

            {/* Main Action Area */}
            <div className="relative w-full flex flex-col items-center mt-2 min-h-[300px]">
                {loading ? (
                    <div className="absolute top-0 w-full flex justify-center pt-10">
                         <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                    </div>
                ) : working ? (
                    <div className="w-full flex flex-col items-center animate-scale-in">
                        <div className="bg-emerald-50/80 backdrop-blur-sm px-6 py-3 rounded-full shadow-sm mb-8 flex items-center gap-3 border border-emerald-100 ring-4 ring-white">
                            <span className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                            </span>
                            <span className="text-xs font-extrabold text-emerald-700 uppercase tracking-widest">Đang làm việc</span>
                        </div>

                        <div className="flex gap-4 w-full max-w-[340px]">
                            <div className="flex-1 aspect-square bg-slate-900 text-white flex flex-col items-center justify-center gap-4 rounded-[32px] shadow-xl shadow-slate-200 relative overflow-hidden group">
                                <div className="absolute top-0 left-0 w-full h-full bg-white/5 rounded-[32px] pointer-events-none"></div>
                                <div className="w-14 h-14 rounded-full bg-slate-800/80 flex items-center justify-center backdrop-blur-sm group-hover:scale-110 transition-transform border border-white/10">
                                    <i className="fa-solid fa-location-dot text-2xl text-white"></i>
                                </div>
                                <span className="text-sm font-bold tracking-wide text-white">Văn phòng</span>
                            </div>

                            <button onClick={onCheckOut} className="flex-1 aspect-square bg-white hover:bg-red-50 flex flex-col items-center justify-center gap-4 rounded-[32px] shadow-xl shadow-slate-100 border border-slate-100 active:scale-[0.97] transition-all group">
                                <div className="w-14 h-14 rounded-full bg-red-50 text-red-500 flex items-center justify-center group-hover:bg-red-100 transition-colors">
                                    <i className="fa-solid fa-person-walking-arrow-right text-2xl transform group-hover:translate-x-1 transition-transform"></i>
                                </div>
                                <span className="text-sm font-bold text-slate-900 group-hover:text-red-600">Ra về</span>
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="absolute top-0 w-full flex justify-center animate-scale-in pt-4">
                         <div className="relative w-64 h-64 flex items-center justify-center group">
                            <div className="absolute inset-0 rounded-full border border-emerald-500/30 scale-110"></div>
                            <div className="absolute inset-0 rounded-full border border-emerald-500/10 scale-125"></div>
                            <div className="absolute inset-4 rounded-full bg-emerald-500/5 animate-pulse"></div>
                            <button onClick={onCheckIn} className="relative w-44 h-44 rounded-full bg-emerald-500 shadow-[0_20px_40px_-10px_rgba(16,185,129,0.4)] flex flex-col items-center justify-center text-white active:scale-95 transition-all border-4 border-white z-20 hover:bg-emerald-600 hover:shadow-[0_25px_50px_-10px_rgba(16,185,129,0.5)]">
                                <i className="fa-solid fa-fingerprint text-5xl mb-2"></i>
                                <span className="text-[11px] font-extrabold uppercase tracking-wider">Chấm công</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <div className="w-full mt-12 max-w-sm animate-slide-up" style={{animationDelay: '0.1s'}}>
                <div className="flex justify-between items-center mb-4 px-1">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Hiệu suất tháng</h3>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                     <div className="bg-white p-5 rounded-[24px] shadow-sm border border-slate-100 flex flex-col justify-between h-36 relative overflow-hidden hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between mb-2">
                            <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-sm"><i className="fa-solid fa-briefcase"></i></div>
                        </div>
                        <div>
                            <div className="flex items-baseline gap-1">
                                <span className="text-3xl font-extrabold text-slate-800 tracking-tight">{summary.workDays}</span>
                                <span className="text-xs text-slate-400 font-bold">/ {summary.standardDays}</span>
                            </div>
                            <p className="text-xs font-semibold text-slate-500 mt-1">Ngày công</p>
                            <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden">
                                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${workPct}%` }}></div>
                            </div>
                        </div>
                     </div>

                     <div className="bg-white p-5 rounded-[24px] shadow-sm border border-slate-100 flex flex-col justify-between h-36 relative overflow-hidden hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between mb-2">
                            <div className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-sm"><i className="fa-solid fa-umbrella-beach"></i></div>
                        </div>
                        <div>
                            <div className="flex items-baseline gap-1">
                                <span className="text-3xl font-extrabold text-slate-800 tracking-tight">{summary.leaveDays}</span>
                                <span className="text-xs text-slate-400 font-bold">/ {summary.remainingLeave}</span>
                            </div>
                            <p className="text-xs font-semibold text-slate-500 mt-1">Nghỉ phép</p>
                            <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden">
                                <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${leavePct}%` }}></div>
                            </div>
                        </div>
                     </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => onChangeTab('requests')} className="bg-white p-4 rounded-[20px] border border-slate-100 shadow-sm flex items-center gap-3 active:scale-[0.98] hover:border-emerald-200 hover:shadow-md transition-all">
                    <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center text-sm">
                      <i className="fa-solid fa-plus"></i>
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-slate-700">Tạo đề xuất</p>
                    </div>
                  </button>

                  <button onClick={() => onChangeTab('contacts')} className="bg-white p-4 rounded-[20px] border border-slate-100 shadow-sm flex items-center gap-3 active:scale-[0.98] hover:border-blue-200 hover:shadow-md transition-all">
                    <div className="w-10 h-10 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center text-sm">
                      <i className="fa-solid fa-magnifying-glass"></i>
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-slate-700">Tìm nhân sự</p>
                    </div>
                  </button>
                </div>
            </div>
        </div>
    </div>
  );
};

export default TabHome;