import React, { useState } from 'react';
import { DashboardData, Employee } from '../types';
import { submitRequest } from '../services/api';

interface Props {
  data: DashboardData | null;
  user: Employee;
  onRefresh: () => void;
}

const TabRequests: React.FC<Props> = ({ data, user, onRefresh }) => {
  const [mode, setMode] = useState<'list' | 'create'>('list');
  const [formData, setFormData] = useState({
      type: 'Nghỉ phép năm',
      fromDate: '',
      toDate: '',
      reason: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
      if(!formData.fromDate || !formData.toDate || !formData.reason) {
          alert("Vui lòng nhập đủ thông tin");
          return;
      }
      setLoading(true);
      const res = await submitRequest({
          employeeId: user.employee_id,
          name: user.name,
          ...formData
      });
      setLoading(false);
      alert(res.message);
      if(res.success) {
          setMode('list');
          setFormData({ type: 'Nghỉ phép năm', fromDate: '', toDate: '', reason: '' });
          onRefresh();
      }
  };

  const requests = data?.myRequests || [];

  return (
    <div className="animate-slide-up">
        {/* Header moved to parent controller or adapted here */}
        <div className="flex justify-between items-center mb-6 px-1">
            <h3 className="text-xl font-black text-slate-800 tracking-tight">Đề xuất & Đơn từ</h3>
            <button onClick={() => setMode(mode === 'list' ? 'create' : 'list')} className="bg-slate-900 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg active:scale-95 transition-all flex items-center gap-2">
                {mode === 'list' ? <><i className="fa-solid fa-plus"></i> Tạo đơn</> : <><i className="fa-solid fa-list"></i> Danh sách</>}
            </button>
        </div>

        {mode === 'list' ? (
            <div className="space-y-4">
                 {requests.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400 bg-white rounded-2xl border border-slate-100 border-dashed">
                        <i className="fa-solid fa-file-circle-xmark text-3xl mb-3 opacity-50"></i>
                        <span className="text-sm font-medium">Bạn chưa có đề xuất nào</span>
                    </div>
                 ) : requests.map((req) => {
                     let statusColor = 'bg-yellow-50 text-yellow-600 border-yellow-100';
                     let icon = 'fa-clock';
                     if (req.status === 'Approved') {
                         statusColor = 'bg-emerald-50 text-emerald-600 border-emerald-100';
                         icon = 'fa-check';
                     } else if (req.status === 'Rejected') {
                         statusColor = 'bg-red-50 text-red-600 border-red-100';
                         icon = 'fa-xmark';
                     }

                     return (
                     <div key={req.id} className="bg-white p-5 rounded-[20px] shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 relative group transition-all hover:shadow-md">
                         <div className="flex justify-between items-start mb-3">
                             <div className="bg-slate-50 text-slate-600 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-slate-100 inline-block">
                                 {req.type}
                             </div>
                             <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold ${statusColor}`}>
                                 <i className={`fa-solid ${icon}`}></i>
                                 {req.status === 'Approved' ? 'Đã duyệt' : req.status === 'Rejected' ? 'Từ chối' : 'Chờ duyệt'}
                             </div>
                         </div>
                         
                         <div className="flex items-center gap-2 text-sm font-bold text-slate-800 mb-2">
                             <span>{req.from_date}</span>
                             <i className="fa-solid fa-arrow-right text-[10px] text-slate-300"></i>
                             <span>{req.to_date}</span>
                         </div>
                         
                         <div className="bg-slate-50 p-3 rounded-xl">
                            <p className="text-xs text-slate-600 italic line-clamp-2 leading-relaxed">"{req.reason}"</p>
                         </div>
                     </div>
                 )})}
            </div>
        ) : (
            <div className="bg-white p-6 rounded-[24px] shadow-lg shadow-slate-200/50 border border-slate-100 animate-slide-up">
                 <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-6 pb-4 border-b border-slate-100">Thông tin đề xuất</h4>
                 <div className="space-y-5">
                     <div>
                         <label className="text-xs font-bold text-slate-500 block mb-2 uppercase">Loại đơn</label>
                         <div className="relative">
                             <select className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-emerald-500 transition-colors appearance-none"
                                value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                                 <option>Nghỉ phép năm</option>
                                 <option>Nghỉ ốm</option>
                                 <option>Nghỉ không lương</option>
                                 <option>Công tác</option>
                             </select>
                             <i className="fa-solid fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none"></i>
                         </div>
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                         <div>
                             <label className="text-xs font-bold text-slate-500 block mb-2 uppercase">Từ ngày</label>
                             <input type="date" className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-emerald-500 transition-colors"
                                value={formData.fromDate} onChange={e => setFormData({...formData, fromDate: e.target.value})} />
                         </div>
                         <div>
                             <label className="text-xs font-bold text-slate-500 block mb-2 uppercase">Đến ngày</label>
                             <input type="date" className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-emerald-500 transition-colors"
                                value={formData.toDate} onChange={e => setFormData({...formData, toDate: e.target.value})} />
                         </div>
                     </div>
                     <div>
                         <label className="text-xs font-bold text-slate-500 block mb-2 uppercase">Lý do chi tiết</label>
                         <textarea className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 outline-none h-28 resize-none focus:border-emerald-500 transition-colors" placeholder="Nhập lý do nghỉ..."
                            value={formData.reason} onChange={e => setFormData({...formData, reason: e.target.value})}></textarea>
                     </div>
                     <div className="pt-2">
                        <button onClick={handleSubmit} disabled={loading} className="w-full bg-emerald-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                            {loading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <>Gửi đề xuất <i className="fa-solid fa-paper-plane"></i></>}
                        </button>
                     </div>
                 </div>
            </div>
        )}
    </div>
  );
};
export default TabRequests;