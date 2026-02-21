import React, { useState, useMemo } from 'react';
import { DashboardData, Employee } from '../types';
import { formatDateString, triggerHaptic } from '../utils/helpers';
import PullToRefresh from './PullToRefresh';

interface Props {
  data: DashboardData | null;
  user: Employee;
  onRefresh: () => Promise<void>;
}

const TabRequests: React.FC<Props> = ({ data, onRefresh, user }) => {
  const [viewMode, setViewMode] = useState<'leaves' | 'explanations'>('leaves');

  // Thống nhất màu sắc gradient giống TabProfile
  const gradientClass = 'from-emerald-500/10 to-teal-500/10';

  // Sort requests by created_at desc
  const requests = useMemo(() => {
      return [...(data?.myRequests || [])].sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
  }, [data?.myRequests]);

  const explanations = useMemo(() => {
      return [...(data?.myExplanations || [])].sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
  }, [data?.myExplanations]);

  const getStatusConfig = (status: string) => {
      switch (status) {
          case 'Approved': return { label: 'ĐÃ DUYỆT', text: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30' };
          case 'Rejected': return { label: 'TỪ CHỐI', text: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/30' };
          default: return { label: 'CHỜ DUYỆT', text: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 border border-orange-100 dark:border-orange-900/30' };
      }
  };

  const getTypeConfig = (type: string) => {
      if (type.includes('Nghỉ phép')) return { icon: 'fa-umbrella-beach', colorClass: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' };
      if (type.includes('Nghỉ ốm')) return { icon: 'fa-user-nurse', colorClass: 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400' };
      if (type.includes('Công tác')) return { icon: 'fa-plane-departure', colorClass: 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' };
      if (type.includes('Giải trình')) return { icon: 'fa-file-signature', colorClass: 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' };
      return { icon: 'fa-file-lines', colorClass: 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400' };
  };

  // --- Summary Stats ---
  const stats = useMemo(() => {
      if (viewMode === 'leaves') {
          const pending = requests.filter(r => r.status === 'Pending').length;
          const approved = requests.filter(r => r.status === 'Approved').length;
          const balance = user.annual_leave_balance || 0;
          return {
              col1: { label: 'Chờ duyệt', value: pending, color: 'text-orange-500 dark:text-orange-400' },
              col2: { label: 'Đã duyệt', value: approved, color: 'text-emerald-600 dark:text-emerald-400' },
              col3: { label: 'Quỹ phép', value: balance, color: 'text-blue-600 dark:text-blue-400' }
          };
      } else {
          const pending = explanations.filter(e => e.status === 'Pending').length;
          const approved = explanations.filter(e => e.status === 'Approved').length;
          const rejected = explanations.filter(e => e.status === 'Rejected').length;
          return {
              col1: { label: 'Chờ duyệt', value: pending, color: 'text-orange-500 dark:text-orange-400' },
              col2: { label: 'Đã duyệt', value: approved, color: 'text-emerald-600 dark:text-emerald-400' },
              col3: { label: 'Từ chối', value: rejected, color: 'text-red-500 dark:text-red-400' }
          };
      }
  }, [viewMode, requests, explanations, user]);

  const switchViewMode = (mode: 'leaves' | 'explanations') => {
      triggerHaptic('light');
      setViewMode(mode);
  };

  // --- REUSABLE ROW COMPONENT CHO DANH SÁCH ---
  const RequestRow = ({ item, isExplanation = false }: { item: any, isExplanation?: boolean }) => {
      const statusInfo = getStatusConfig(item.status);
      const typeInfo = isExplanation ? getTypeConfig('Giải trình') : getTypeConfig(item.type);
      const title = isExplanation ? 'Giải trình công' : item.type;
      const dateDisplay = isExplanation 
          ? formatDateString(item.date) 
          : (item.from_date === item.to_date ? formatDateString(item.from_date) : `${formatDateString(item.from_date)} - ${formatDateString(item.to_date)}`);

      return (
          <div className="flex gap-4 p-4 active:bg-slate-50 dark:active:bg-slate-700/50 transition-colors group">
              {/* Icon Container (Giống Avatar của TabProfile) */}
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-base flex-shrink-0 shadow-sm border border-white/50 dark:border-slate-700/50 ${typeInfo.colorClass}`}>
                  <i className={`fa-solid ${typeInfo.icon}`}></i>
              </div>
              
              <div className="flex-1 min-w-0">
                  {/* Title & Status */}
                  <div className="flex justify-between items-start gap-2 mb-1">
                      <p className="text-base font-bold text-slate-800 dark:text-white truncate">{title}</p>
                      <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-widest flex-shrink-0 whitespace-nowrap ${statusInfo.text}`}>
                          {statusInfo.label}
                      </span>
                  </div>
                  
                  {/* Date */}
                  <p className="text-xs text-slate-400 dark:text-slate-500 font-bold mb-2 font-mono flex items-center gap-1.5">
                      <i className={isExplanation ? "fa-regular fa-clock" : "fa-regular fa-calendar-days"}></i>
                      {dateDisplay}
                  </p>

                  {/* Reason */}
                  <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700/50 mt-1">
                      <p className="text-xs text-slate-600 dark:text-slate-300 font-medium italic leading-relaxed">"{item.reason}"</p>
                  </div>
                  
                  {/* Manager Note */}
                  {item.manager_note && (
                      <div className={`mt-2 px-3 py-2 rounded-xl border text-[11px] font-medium flex items-start gap-2 ${item.status === 'Approved' ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-900/30 text-emerald-800 dark:text-emerald-300' : 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900/30 text-red-800 dark:text-red-300'}`}>
                          <i className="fa-solid fa-comment-dots mt-0.5"></i>
                          <div>
                              <span className="font-extrabold opacity-80 uppercase block mb-0.5 text-[9px] tracking-wide">Phản hồi quản lý:</span>
                              {item.manager_note}
                          </div>
                      </div>
                  )}
              </div>
          </div>
      );
  };

  return (
    <PullToRefresh onRefresh={onRefresh} className="bg-slate-50 dark:bg-slate-900 font-sans h-full">
        <div className="pt-28 space-y-4 animate-fade-in pb-32 px-4">
            
            {/* THẺ HEADER CARD (Tương tự Avatar Card của TabProfile) */}
            <div className="bg-white dark:bg-slate-800 rounded-[32px] p-6 shadow-sm border border-slate-100 dark:border-slate-700 text-center relative overflow-hidden mb-6 transition-colors mt-4">
                <div className={`absolute top-0 left-0 w-full h-24 bg-gradient-to-br ${gradientClass} rounded-t-[32px] transition-colors duration-500`}></div>
                
                <div className="relative z-10">
                    {/* View Toggle */}
                    <div className="flex justify-center mb-6">
                        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-md p-1 rounded-full flex relative shadow-sm border border-white/50 dark:border-slate-700/50">
                            <button 
                                onClick={() => switchViewMode('leaves')}
                                className={`px-5 py-2 rounded-full text-xs font-extrabold uppercase tracking-widest transition-all duration-300 relative z-10 ${viewMode === 'leaves' ? 'text-emerald-600 dark:text-emerald-400 bg-white dark:bg-slate-700 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                            >
                                Nghỉ phép
                            </button>
                            <button 
                                onClick={() => switchViewMode('explanations')}
                                className={`px-5 py-2 rounded-full text-xs font-extrabold uppercase tracking-widest transition-all duration-300 relative z-10 ${viewMode === 'explanations' ? 'text-emerald-600 dark:text-emerald-400 bg-white dark:bg-slate-700 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                            >
                                Giải trình
                            </button>
                        </div>
                    </div>

                    {/* Stats Widget */}
                    <div className="grid grid-cols-3 gap-2 bg-slate-50 dark:bg-slate-900/50 rounded-[20px] p-3 border border-slate-100 dark:border-slate-700/50">
                        <div className="flex flex-col items-center justify-center p-2">
                            <span className={`text-2xl font-black mb-1 tabular-nums tracking-tighter ${stats.col1.color}`}>{stats.col1.value}</span>
                            <span className="text-[9px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center">{stats.col1.label}</span>
                        </div>
                        <div className="flex flex-col items-center justify-center p-2 border-x border-slate-200 dark:border-slate-700/50">
                            <span className={`text-2xl font-black mb-1 tabular-nums tracking-tighter ${stats.col2.color}`}>{stats.col2.value}</span>
                            <span className="text-[9px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center">{stats.col2.label}</span>
                        </div>
                        <div className="flex flex-col items-center justify-center p-2">
                            <span className={`text-2xl font-black mb-1 tabular-nums tracking-tighter ${stats.col3.color}`}>{stats.col3.value}</span>
                            <span className="text-[9px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center">{stats.col3.label}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* LEAVE REQUESTS SECTION */}
            {viewMode === 'leaves' && (
                <div className="animate-slide-up">
                    <h3 className="text-xs font-black text-emerald-700 dark:text-emerald-400 uppercase mb-3 ml-2 tracking-widest flex items-center gap-2">
                        <i className="fa-solid fa-umbrella-beach text-[10px]"></i>
                        Danh sách đơn nghỉ phép
                    </h3>
                    
                    <div className="bg-white dark:bg-slate-800 rounded-[24px] overflow-hidden shadow-sm border border-slate-100 dark:border-slate-700 divide-y divide-slate-50 dark:divide-slate-700 mb-8">
                        {requests.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-600 opacity-80 bg-slate-50/50 dark:bg-slate-800/50">
                                <div className="w-16 h-16 bg-white dark:bg-slate-700 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-600 flex items-center justify-center mb-3 text-slate-300 dark:text-slate-500">
                                    <i className="fa-regular fa-folder-open text-2xl"></i>
                                </div>
                                <p className="text-xs font-bold uppercase tracking-wide">Chưa có đề xuất nào</p>
                            </div>
                        ) : (
                            requests.map((req) => (
                                <RequestRow key={req.id} item={req} />
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* EXPLANATIONS SECTION */}
            {viewMode === 'explanations' && (
                <div className="animate-slide-up">
                    <h3 className="text-xs font-black text-emerald-700 dark:text-emerald-400 uppercase mb-3 ml-2 tracking-widest flex items-center gap-2">
                        <i className="fa-solid fa-file-signature text-[10px]"></i>
                        Danh sách giải trình
                    </h3>
                    
                    <div className="bg-white dark:bg-slate-800 rounded-[24px] overflow-hidden shadow-sm border border-slate-100 dark:border-slate-700 divide-y divide-slate-50 dark:divide-slate-700 mb-8">
                        {explanations.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-600 opacity-80 bg-slate-50/50 dark:bg-slate-800/50">
                                <div className="w-16 h-16 bg-white dark:bg-slate-700 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-600 flex items-center justify-center mb-3 text-slate-300 dark:text-slate-500">
                                    <i className="fa-solid fa-file-signature text-2xl"></i>
                                </div>
                                <p className="text-xs font-bold uppercase tracking-wide">Chưa có giải trình nào</p>
                            </div>
                        ) : (
                            explanations.map((exp) => (
                                <RequestRow key={exp.id} item={exp} isExplanation={true} />
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    </PullToRefresh>
  );
};
export default TabRequests;
