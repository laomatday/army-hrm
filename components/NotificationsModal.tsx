import React, { useMemo } from 'react';
import { DashboardData, Employee } from '../types';
import { formatDateString } from '../utils/helpers';
import { TabType } from './BottomNav';
import PullToRefresh from './PullToRefresh';

interface Props {
  data: DashboardData | null;
  user: Employee;
  activeTab: TabType;
  onClose: () => void;
  onSwitchTab: (tab: any) => void;
  onRefresh: () => Promise<void>;
}

const NotificationsModal: React.FC<Props> = ({ data, user, activeTab, onClose, onSwitchTab, onRefresh }) => {
  const approvals = data?.notifications.approvals || [];
  const explanationApprovals = data?.notifications.explanationApprovals || [];
  const pendingCount = approvals.length + explanationApprovals.length;

  const myRequests = (data?.notifications.myRequests || []).filter(r => r.status !== 'Pending');
  const myExplanations = (data?.notifications.myExplanations || []).filter(r => r.status !== 'Pending');

  const myNotifications = useMemo(() => {
      const combined = [
          ...myRequests.map(r => ({ ...r, category: 'leave' })),
          ...myExplanations.map(e => ({ ...e, category: 'explanation' }))
      ];
      return combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [myRequests, myExplanations]);

  const renderDateRange = (from: string, to?: string) => {
      if (!to) return formatDateString(from.split('T')[0]);
      const f = formatDateString(from.split('T')[0]);
      const t = formatDateString(to.split('T')[0]);
      if (from.split('T')[0] === to.split('T')[0]) return f;
      return `${f} - ${t}`;
  };

  return (
    <PullToRefresh onRefresh={onRefresh} className="bg-slate-50 dark:bg-neutral-black font-sans">
        <div className="pt-28 pb-32 px-4 animate-fade-in">
            
            {pendingCount > 0 && (
                <div 
                    onClick={() => { onSwitchTab('manager'); }}
                    className="bg-neutral-white dark:bg-slate-800 rounded-[28px] p-5 mb-8 border border-primary/20 relative overflow-hidden group active:scale-[0.98] transition-all cursor-pointer animate-slide-up"
                >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl pointer-events-none -mr-10 -mt-10 opacity-60"></div>
                    
                    <div className="relative z-10 flex items-center justify-between">
                        <div>
                             <div className="flex items-center gap-2 mb-2">
                                <span className="relative flex h-2.5 w-2.5">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary-red/50 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-secondary-red"></span>
                                </span>
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">Cần duyệt ngay</span>
                            </div>
                            
                            <div className="flex items-baseline gap-1.5">
                                <h3 className="text-4xl font-black text-slate-800 dark:text-neutral-white tracking-tight leading-none tabular-nums">{pendingCount}</h3>
                                <span className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Yêu cầu</span>
                            </div>
                            <p className="text-slate-500 dark:text-slate-400 text-xs font-medium mt-1 group-hover:text-primary transition-colors">
                                Đang chờ bạn xử lý
                            </p>
                        </div>

                        <div className="w-14 h-14 bg-primary/10 text-primary rounded-2xl flex items-center justify-center text-xl border border-primary/20 group-hover:bg-primary group-hover:text-neutral-white transition-all duration-300">
                            <i className="fa-solid fa-arrow-right-long group-hover:translate-x-1 transition-transform"></i>
                        </div>
                    </div>
                </div>
            )}

            <div className="space-y-4">
                {myNotifications.length === 0 && pendingCount === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-600 opacity-60 animate-fade-in">
                        <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4 border border-slate-200 dark:border-slate-700/50">
                            <i className="fa-regular fa-bell-slash text-3xl text-slate-300 dark:text-slate-600"></i>
                        </div>
                        <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Không có thông báo mới</p>
                    </div>
                ) : (
                    <>
                        {myNotifications.length > 0 && <h4 className="text-xs font-bold text-primary uppercase ml-2 mb-2 tracking-widest animate-slide-up">Cập nhật của bạn</h4>}
                        {myNotifications.map((item: any) => {
                            const isApproved = item.status === 'Approved';
                            const isRequest = item.category === 'leave';
                            const statusColor = isApproved 
                                ? 'bg-primary/10 text-primary border border-primary/20' 
                                : 'bg-secondary-red/10 text-secondary-red border border-secondary-red/20';
                            const statusIcon = isApproved ? 'fa-circle-check' : 'fa-circle-xmark';
                            
                            let leftIconConfig = { bg: 'bg-slate-50', text: 'text-slate-500', border: 'border-slate-100' };
                            if (isRequest) {
                                if (item.type.includes('Nghỉ phép')) leftIconConfig = { bg: 'bg-primary/10', text: 'text-primary', border: 'border-primary/20' };
                                else if (item.type.includes('Nghỉ ốm')) leftIconConfig = { bg: 'bg-secondary-red/10', text: 'text-secondary-red', border: 'border-secondary-red/20' };
                                else if (item.type.includes('Công tác')) leftIconConfig = { bg: 'bg-purple-50 dark:bg-purple-900/20', text: 'text-purple-500 dark:text-purple-400', border: 'border-purple-100 dark:border-purple-900/30' };
                                else leftIconConfig = { bg: 'bg-primary/10', text: 'text-primary', border: 'border-primary/20' };
                            } else {
                                leftIconConfig = { bg: 'bg-secondary-yellow/10', text: 'text-secondary-yellow', border: 'border-secondary-yellow/20' };
                            }

                            return (
                                <div key={item.id} className="bg-white dark:bg-slate-800 p-5 rounded-[28px] border border-slate-100 dark:border-slate-700 animate-slide-up relative overflow-hidden group active:scale-[0.98] transition-all">
                                    <div className="flex gap-4">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 text-xl border ${leftIconConfig.bg} ${leftIconConfig.text} ${leftIconConfig.border}`}>
                                            <i className={`fa-solid ${isRequest ? (item.type.includes('Nghỉ phép') ? 'fa-umbrella-beach' : item.type.includes('Công tác') ? 'fa-plane-departure' : item.type.includes('Nghỉ ốm') ? 'fa-user-nurse' : 'fa-file-lines') : 'fa-file-signature'}`}></i>
                                        </div>

                                        <div className="flex-1 min-w-0 pt-0.5">
                                            <div className="flex justify-between items-start gap-2 mb-1">
                                                <h4 className="font-black text-slate-800 dark:text-white text-sm leading-tight">
                                                    {isRequest ? item.type : 'Giải trình công'}
                                                </h4>
                                                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border uppercase tracking-widest flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap ${statusColor}`}>
                                                     <i className={`fa-solid ${statusIcon}`}></i>
                                                     {isApproved ? 'ĐÃ DUYỆT' : 'TỪ CHỐI'}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 dark:text-slate-500 font-mono">
                                                <i className="fa-regular fa-calendar-days"></i>
                                                {renderDateRange(isRequest ? item.from_date : item.date, item.to_date)}
                                            </div>
                                        </div>
                                    </div>

                                    {item.manager_note && (
                                        <div className={`mt-3 px-4 py-3 rounded-2xl border text-xs font-medium flex items-start gap-2 ${isApproved ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-secondary-red/10 border-secondary-red/20 text-secondary-red'}`}>
                                            <i className="fa-solid fa-comment-dots mt-0.5"></i>
                                            <div>
                                                <span className="font-extrabold opacity-80 uppercase block mb-0.5 text-[10px] tracking-wide">Phản hồi quản lý:</span>
                                                {item.manager_note}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </>
                )}
            </div>
        </div>
    </PullToRefresh>
  );
};

export default NotificationsModal;