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
          case 'Approved': return { label: 'ĐÃ DUYỆT', text: 'bg-primary/10 text-primary border border-primary/20', icon: 'fa-circle-check' };
          case 'Rejected': return { label: 'TỪ CHỐI', text: 'bg-secondary-red/10 text-secondary-red border border-secondary-red/20', icon: 'fa-circle-xmark' };
          default: return { label: 'CHỜ DUYỆT', text: 'bg-secondary-yellow/10 text-secondary-yellow border border-secondary-yellow/20', icon: 'fa-circle-pause' };
      }
  };

  const getTypeConfig = (type: string) => {
      if (type.includes('Nghỉ phép')) return { icon: 'fa-umbrella-beach', bg: 'bg-primary/10', text: 'text-primary' };
      if (type.includes('Nghỉ ốm')) return { icon: 'fa-user-nurse', bg: 'bg-secondary-red/10', text: 'text-secondary-red' };
      if (type.includes('Công tác')) return { icon: 'fa-plane-departure', bg: 'bg-purple-50 dark:bg-purple-900/20', text: 'text-purple-500 dark:text-purple-400' };
      if (type.includes('Giải trình')) return { icon: 'fa-file-signature', bg: 'bg-secondary-yellow/10', text: 'text-secondary-yellow' };
      return { icon: 'fa-file-lines', bg: 'bg-slate-50 dark:bg-slate-700/50', text: 'text-slate-500 dark:text-slate-400' };
  };

  const stats = useMemo(() => {
      if (viewMode === 'leaves') {
          const pending = requests.filter(r => r.status === 'Pending').length;
          const approved = requests.filter(r => r.status === 'Approved').length;
          const balance = user.annual_leave_balance || 0;
          return {
              col1: { label: 'Chờ duyệt', value: pending, color: 'text-secondary-yellow' },
              col2: { label: 'Đã duyệt', value: approved, color: 'text-primary' },
              col3: { label: 'Quỹ phép', value: balance, color: 'text-secondary-blue' }
          };
      } else {
          const pending = explanations.filter(e => e.status === 'Pending').length;
          const approved = explanations.filter(e => e.status === 'Approved').length;
          const rejected = explanations.filter(e => e.status === 'Rejected').length;
          return {
              col1: { label: 'Chờ duyệt', value: pending, color: 'text-secondary-yellow' },
              col2: { label: 'Đã duyệt', value: approved, color: 'text-primary' },
              col3: { label: 'Từ chối', value: rejected, color: 'text-secondary-red' }
          };
      }
  }, [viewMode, requests, explanations, user]);

  const switchViewMode = (mode: 'leaves' | 'explanations') => {
      triggerHaptic('light');
      setViewMode(mode);
  };

  return (
    <>
        <PullToRefresh onRefresh={onRefresh} className="bg-slate-50 dark:bg-slate-900 font-sans">
            <div className="pt-28 space-y-4 animate-fade-in pb-28 px-4">
                
                <div className="flex justify-center mb-6">
                     <div className="bg-slate-200/60 dark:bg-slate-800/60 p-1 rounded-full flex relative">
                         <button 
                            onClick={() => switchViewMode('leaves')}
                            className={`px-5 py-2 rounded-full text-xs font-extrabold uppercase tracking-widest transition-all duration-300 relative z-10 ${viewMode === 'leaves' ? 'text-primary bg-neutral-white dark:bg-slate-700' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                         >
                             Nghỉ phép
                         </button>
                         <button 
                            onClick={() => switchViewMode('explanations')}
                            className={`px-5 py-2 rounded-full text-xs font-extrabold uppercase tracking-widest transition-all duration-300 relative z-10 ${viewMode === 'explanations' ? 'text-primary bg-neutral-white dark:bg-slate-700' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                         >
                             Giải trình
                         </button>
                     </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-8">
                    <div className="bg-neutral-white dark:bg-neutral-black rounded-[24px] border border-slate-100 dark:border-slate-700 p-4 flex flex-col items-center justify-center h-28">
                        <span className={`text-3xl font-black mb-1 tabular-nums tracking-tighter ${stats.col1.color}`}>{stats.col1.value}</span>
                        <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{stats.col1.label}</span>
                    </div>
                    <div className="bg-neutral-white dark:bg-neutral-black rounded-[24px] border border-slate-100 dark:border-slate-700 p-4 flex flex-col items-center justify-center h-28">
                        <span className={`text-3xl font-black mb-1 tabular-nums tracking-tighter ${stats.col2.color}`}>{stats.col2.value}</span>
                        <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{stats.col2.label}</span>
                    </div>
                    <div className="bg-neutral-white dark:bg-neutral-black rounded-[24px] border border-slate-100 dark:border-slate-700 p-4 flex flex-col items-center justify-center h-28">
                        <span className={`text-3xl font-black mb-1 tabular-nums tracking-tighter ${stats.col3.color}`}>{stats.col3.value}</span>
                        <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{stats.col3.label}</span>
                    </div>
                </div>

                {viewMode === 'leaves' && (
                    <div className="animate-slide-up">
                        <h3 className="text-xs font-black text-primary dark:text-primary uppercase ml-2 mb-3 tracking-widest flex items-center gap-2">
                            <i className="fa-solid fa-umbrella-beach text-[10px]"></i>
                            Danh sách đơn nghỉ phép
                        </h3>
                        {requests.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-600 opacity-60 bg-neutral-white dark:bg-neutral-black rounded-[24px] border border-dashed border-slate-200 dark:border-slate-700">
                                <div className="w-16 h-16 bg-slate-50 dark:bg-slate-700 rounded-full flex items-center justify-center mb-3">
                                    <i className="fa-regular fa-folder-open text-2xl text-slate-300 dark:text-slate-500"></i>
                                </div>
                                <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Chưa có đề xuất nào</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {requests.map((req) => {
                                    const statusInfo = getStatusConfig(req.status);
                                    const typeInfo = getTypeConfig(req.type);

                                    return (
                                        <div key={req.id} className="bg-neutral-white dark:bg-neutral-black p-5 rounded-[28px] border border-slate-100 dark:border-slate-700 relative overflow-hidden active:scale-[0.99] transition-all group">
                                            <div className="flex gap-4">
                                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${typeInfo.bg} ${typeInfo.text}`}>
                                                    <i className={`fa-solid ${typeInfo.icon} text-xl`}></i>
                                                </div>

                                                <div className="flex-1 min-w-0 pt-0.5">
                                                    <div className="flex justify-between items-start gap-2 mb-1">
                                                        <h4 className="font-black text-slate-800 dark:text-white text-sm leading-tight">
                                                            {req.type}
                                                        </h4>
                                                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-widest flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap ${statusInfo.text}`}>
                                                            <i className={`fa-solid ${statusInfo.icon}`}></i> {statusInfo.label}
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center gap-2 text-xs font-bold text-slate-400 dark:text-slate-500 font-mono">
                                                        <i className="fa-regular fa-calendar-days"></i>
                                                        {req.from_date === req.to_date ? 
                                                            formatDateString(req.from_date) : 
                                                            `${formatDateString(req.from_date)} - ${formatDateString(req.to_date)}`
                                                        }
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mt-4 bg-slate-50 dark:bg-neutral-black/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                                                <p className="text-sm text-slate-600 dark:text-slate-300 font-medium italic leading-relaxed">"{req.reason}"</p>
                                            </div>
                                            
                                            {req.manager_note && (
                                                <div className={`mt-3 px-4 py-3 rounded-2xl border text-xs font-medium flex items-start gap-2 ${req.status === 'Approved' ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-secondary-red/10 border-secondary-red/20 text-secondary-red'}`}>
                                                    <i className="fa-solid fa-comment-dots mt-0.5"></i>
                                                    <div>
                                                        <span className="font-extrabold opacity-80 uppercase block mb-0.5 text-[10px] tracking-wide">Phản hồi quản lý:</span>
                                                        {req.manager_note}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {viewMode === 'explanations' && (
                    <div className="animate-slide-up">
                        <h3 className="text-xs font-black text-primary uppercase ml-2 mb-3 tracking-widest flex items-center gap-2">
                            <i className="fa-solid fa-file-signature text-[10px]"></i>
                            Danh sách giải trình
                        </h3>
                        {explanations.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-600 opacity-60 bg-neutral-white dark:bg-neutral-black rounded-[24px] border border-dashed border-slate-200 dark:border-slate-700">
                                <div className="w-16 h-16 bg-slate-50 dark:bg-slate-700 rounded-full flex items-center justify-center mb-3">
                                    <i className="fa-solid fa-file-signature text-2xl text-slate-300 dark:text-slate-500"></i>
                                </div>
                                <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Chưa có giải trình nào</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {explanations.map((exp) => {
                                    const statusInfo = getStatusConfig(exp.status);
                                    
                                    return (
                                        <div key={exp.id} className="bg-neutral-white dark:bg-neutral-black p-5 rounded-[28px] border border-slate-100 dark:border-slate-700 relative overflow-hidden active:scale-[0.99] transition-all group">
                                            <div className="flex gap-4">
                                                <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 bg-secondary-yellow/10 text-secondary-yellow border border-secondary-yellow/20">
                                                    <i className="fa-solid fa-file-signature text-xl"></i>
                                                </div>
                                                
                                                <div className="flex-1 min-w-0 pt-0.5">
                                                    <div className="flex justify-between items-start gap-2 mb-1">
                                                        <h4 className="font-black text-slate-800 dark:text-white text-sm leading-tight">
                                                            Giải trình công
                                                        </h4>
                                                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-widest flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap ${statusInfo.text}`}>
                                                            <i className={`fa-solid ${statusInfo.icon}`}></i> {statusInfo.label}
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center gap-2 text-xs font-bold text-slate-400 dark:text-slate-500 font-mono">
                                                        <i className="fa-regular fa-clock"></i>
                                                        {formatDateString(exp.date)}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mt-4 bg-slate-50 dark:bg-neutral-black/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                                                <p className="text-sm text-slate-600 dark:text-slate-300 font-medium italic leading-relaxed">"{exp.reason}"</p>
                                            </div>

                                            {exp.manager_note && (
                                                <div className={`mt-3 px-4 py-3 rounded-2xl border text-xs font-medium flex items-start gap-2 ${exp.status === 'Approved' ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-secondary-red/10 border-secondary-red/20 text-secondary-red'}`}>
                                                    <i className="fa-solid fa-comment-dots mt-0.5"></i>
                                                    <div>
                                                        <span className="font-extrabold opacity-80 uppercase block mb-0.5 text-[10px] tracking-wide">Phản hồi quản lý:</span>
                                                        {exp.manager_note}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </PullToRefresh>
    </>
  );
};
export default TabRequests;
