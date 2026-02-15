import React, { useState } from 'react';
import { DashboardData, Employee } from '../types';
import { processRequest } from '../services/api';

interface Props {
  data: DashboardData | null;
  user: Employee;
  onClose: () => void;
  onRefresh: () => void;
}

const NotificationsModal: React.FC<Props> = ({ data, user, onClose, onRefresh }) => {
  const [processing, setProcessing] = useState<string | null>(null);

  const approvals = data?.notifications.approvals || [];
  
  const handleApprove = async (docId: string, status: 'Approved' | 'Rejected') => {
      if(!docId) return;
      setProcessing(docId);
      const res = await processRequest(docId, status, status === 'Approved' ? 'Approved by ' + user.name : 'Rejected by ' + user.name);
      setProcessing(null);
      alert(res.message);
      if(res.success) onRefresh();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center animate-fade-in">
        <div className="bg-slate-50 w-full max-w-md h-[85%] sm:h-auto sm:max-h-[80%] rounded-t-[32px] sm:rounded-[32px] flex flex-col overflow-hidden animate-slide-up shadow-2xl">
            <div className="p-6 bg-white border-b border-slate-100 flex justify-between items-center sticky top-0 z-10">
                <h3 className="text-xl font-black text-slate-800 tracking-tight">Thông báo</h3>
                <button onClick={onClose} className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 transition-colors flex items-center justify-center text-slate-600">
                    <i className="fa-solid fa-xmark"></i>
                </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {approvals.length > 0 && (
                    <div>
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 ml-2">Cần duyệt ({approvals.length})</h4>
                        <div className="space-y-3">
                            {approvals.map((item: any) => (
                                <div key={item.id} className="bg-white p-5 rounded-[20px] shadow-sm border border-slate-100">
                                     <div className="flex justify-between mb-2">
                                         <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-lg uppercase tracking-wide">{item.type}</span>
                                         <span className="text-[10px] font-bold text-slate-400">{item.created_at?.split('T')[0]}</span>
                                     </div>
                                     <h5 className="font-bold text-slate-800 text-sm">{item.name}</h5>
                                     <p className="text-xs text-slate-500 font-semibold mt-1">{item.from_date} - {item.to_date}</p>
                                     <p className="text-xs text-slate-600 italic mt-3 bg-slate-50 p-3 rounded-xl border border-slate-100">"{item.reason}"</p>
                                     
                                     <div className="flex gap-3 mt-4">
                                         <button 
                                            disabled={!!processing}
                                            onClick={() => handleApprove(item.id, 'Rejected')}
                                            className="flex-1 py-3 bg-white border border-red-100 text-red-500 rounded-xl text-xs font-bold hover:bg-red-50 transition-colors active:scale-95">
                                             Từ chối
                                         </button>
                                         <button 
                                            disabled={!!processing}
                                            onClick={() => handleApprove(item.id, 'Approved')}
                                            className="flex-1 py-3 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-200 active:scale-95">
                                             {processing === item.id ? 'Đang xử lý...' : 'Duyệt đơn'}
                                         </button>
                                     </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                
                {approvals.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                            <i className="fa-regular fa-bell-slash text-2xl opacity-50"></i>
                        </div>
                        <p className="text-sm font-bold text-slate-500">Không có thông báo mới</p>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};
export default NotificationsModal;