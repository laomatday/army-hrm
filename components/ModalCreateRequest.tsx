
import React, { useState, useEffect } from 'react';
import { Employee } from '../types';
import { submitRequest } from '../services/api';
import { formatDateString } from '../utils/helpers';

interface Props {
  user: Employee;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onAlert: (title: string, msg: string, type: 'success' | 'error') => void;
  initialData?: { type: string, date: string, reason: string } | null;
}

const ModalCreateRequest: React.FC<Props> = ({ user, isOpen, onClose, onSuccess, onAlert, initialData }) => {
  const [formData, setFormData] = useState({
      type: 'Nghỉ phép năm',
      fromDate: '',
      toDate: '',
      expirationDate: '',
      reason: ''
  });
  const [loading, setLoading] = useState(false);
  const [isTypeOpen, setIsTypeOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
        if (initialData) {
            setFormData({
                type: initialData.type,
                fromDate: initialData.date,
                toDate: initialData.date,
                expirationDate: '',
                reason: initialData.reason
            });
        } else {
             setFormData({ type: 'Nghỉ phép năm', fromDate: '', toDate: '', expirationDate: '', reason: '' });
        }
    }
  }, [isOpen, initialData]);

  const requestTypes = [
      "Nghỉ phép năm",
      "Nghỉ ốm",
      "Nghỉ không lương",
      "Công tác",
      "Làm việc tại nhà"
  ];

  const handleSubmit = async () => {
      if(!formData.fromDate || !formData.toDate || !formData.reason) {
          onAlert("Thiếu thông tin", "Vui lòng nhập đầy đủ ngày và lý do.", 'error');
          return;
      }
      
      if (new Date(formData.fromDate) > new Date(formData.toDate)) {
          onAlert("Lỗi ngày tháng", "Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.", 'error');
          return;
      }

      if (formData.type === 'Nghỉ phép năm') {
          if ((user.annual_leave_balance || 0) <= 0) {
              onAlert("Hết phép năm", "Bạn đã hết quỹ phép năm. Vui lòng chọn hình thức nghỉ khác (VD: Nghỉ không lương).", 'error');
              return;
          }
      }

      setLoading(true);
      const res = await submitRequest({
          employeeId: user.employee_id,
          name: user.name,
          ...formData
      });
      setLoading(false);
      
      onAlert(res.success ? "Thành công" : "Lỗi", res.message, res.success ? 'success' : 'error');

      if(res.success) {
          setFormData({ type: 'Nghỉ phép năm', fromDate: '', toDate: '', expirationDate: '', reason: '' });
          onSuccess();
          onClose();
      }
  };

  const formatDateDisplay = (dateStr: string) => {
    return formatDateString(dateStr);
  };

  if (!isOpen) return null;

  // Use z-[50] to sit above standard content (z-0) and header (z-40) but below BottomNav (z-100)
  return (
    <div className="fixed inset-0 z-[50] bg-slate-50 flex flex-col animate-slide-up overflow-y-auto no-scrollbar pb-32 pt-safe">
        <div className="relative">
            <div className="absolute top-0 left-0 w-full h-48 bg-gradient-to-br from-emerald-500/10 to-teal-500/10"></div>
            
            <div className="relative z-10 flex flex-col items-center pt-20 pb-8 px-6">
                 <div className="w-24 h-24 rounded-full p-2 bg-white shadow-xl shadow-emerald-100 mb-4 mt-2 flex items-center justify-center">
                     <div className="w-full h-full rounded-full bg-emerald-50 flex items-center justify-center border border-emerald-100 text-emerald-500">
                         <i className="fa-solid fa-paper-plane text-3xl"></i>
                     </div>
                 </div>
            </div>
        </div>

        <div className="flex-1 px-6 pb-12">
             <div className="bg-white p-6 rounded-[24px] shadow-sm border border-slate-100 space-y-5">
                 <div className="relative">
                     <label className="text-xs font-bold text-emerald-700 block mb-2 uppercase tracking-widest">Loại đề xuất</label>
                     <button 
                        onClick={() => setIsTypeOpen(!isTypeOpen)}
                        className={`w-full p-4 flex justify-between items-center bg-white border rounded-2xl text-base font-semibold outline-none transition-all ${isTypeOpen ? 'border-emerald-500 ring-4 ring-emerald-500/10' : 'border-slate-200'}`}
                     >
                         <span className="text-slate-800">{formData.type}</span>
                         <i className={`fa-solid fa-chevron-down text-slate-400 text-xs transition-transform ${isTypeOpen ? 'rotate-180' : ''}`}></i>
                     </button>
                     
                     {isTypeOpen && (
                        <div className="absolute top-full left-0 w-full mt-2 bg-white border border-slate-100 rounded-2xl shadow-xl z-50 overflow-hidden animate-fade-in p-2 space-y-1">
                            {requestTypes.map((type) => (
                                <div 
                                    key={type}
                                    onClick={() => {
                                        setFormData({...formData, type: type});
                                        setIsTypeOpen(false);
                                    }}
                                    className={`flex items-center justify-between p-3.5 rounded-xl cursor-pointer transition-all ${
                                        formData.type === type 
                                        ? 'bg-emerald-50 text-emerald-700' 
                                        : 'text-slate-600 hover:bg-slate-50'
                                    }`}
                                >
                                    <span className="font-semibold text-sm">{type}</span>
                                    {formData.type === type && (
                                        <i className="fa-solid fa-check text-emerald-600"></i>
                                    )}
                                </div>
                            ))}
                        </div>
                     )}
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                     <div>
                         <label className="text-xs font-bold text-emerald-700 block mb-2 uppercase tracking-widest">Từ ngày</label>
                         <div className="relative h-14 w-full">
                             <input 
                                 type="date" 
                                 className="absolute inset-0 w-full h-full z-20 opacity-0 cursor-pointer"
                                 value={formData.fromDate} 
                                 onChange={e => setFormData({...formData, fromDate: e.target.value})}
                                 onClick={(e) => { try { e.currentTarget.showPicker() } catch(err) {} }}
                             />
                             <div className={`absolute inset-0 w-full h-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold flex items-center justify-between pointer-events-none z-10 transition-colors ${formData.fromDate ? 'text-slate-800 bg-white' : 'text-slate-400'}`}>
                                 <span>{formData.fromDate ? formatDateDisplay(formData.fromDate) : 'dd/mm/yyyy'}</span>
                                 <i className="fa-regular fa-calendar text-slate-400"></i>
                             </div>
                         </div>
                     </div>
                     <div>
                         <label className="text-xs font-bold text-emerald-700 block mb-2 uppercase tracking-widest">Đến ngày</label>
                         <div className="relative h-14 w-full">
                             <input 
                                 type="date" 
                                 className="absolute inset-0 w-full h-full z-20 opacity-0 cursor-pointer"
                                 value={formData.toDate} 
                                 onChange={e => setFormData({...formData, toDate: e.target.value})}
                                 onClick={(e) => { try { e.currentTarget.showPicker() } catch(err) {} }}
                             />
                             <div className={`absolute inset-0 w-full h-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold flex items-center justify-between pointer-events-none z-10 transition-colors ${formData.toDate ? 'text-slate-800 bg-white' : 'text-slate-400'}`}>
                                 <span>{formData.toDate ? formatDateDisplay(formData.toDate) : 'dd/mm/yyyy'}</span>
                                 <i className="fa-regular fa-calendar text-slate-400"></i>
                             </div>
                         </div>
                     </div>
                 </div>

                 <div>
                     <label className="text-xs font-bold text-emerald-700 block mb-2 uppercase tracking-widest">Ngày hết hạn (Tuỳ chọn)</label>
                     <div className="relative h-14 w-full">
                         <input 
                             type="date" 
                             className="absolute inset-0 w-full h-full z-20 opacity-0 cursor-pointer"
                             value={formData.expirationDate} 
                             onChange={e => setFormData({...formData, expirationDate: e.target.value})}
                             onClick={(e) => { try { e.currentTarget.showPicker() } catch(err) {} }}
                         />
                         <div className={`absolute inset-0 w-full h-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold flex items-center justify-between pointer-events-none z-10 transition-colors ${formData.expirationDate ? 'text-slate-800 bg-white' : 'text-slate-400'}`}>
                             <span>{formData.expirationDate ? formatDateDisplay(formData.expirationDate) : 'dd/mm/yyyy'}</span>
                             <i className="fa-regular fa-clock text-slate-400"></i>
                         </div>
                     </div>
                 </div>

                 <div>
                     <label className="text-xs font-bold text-emerald-700 block mb-2 uppercase tracking-widest">Lý do chi tiết</label>
                     <textarea className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-800 outline-none h-32 resize-none focus:border-emerald-500 transition-colors placeholder:text-slate-400" placeholder="Nhập lý do nghỉ..."
                        value={formData.reason} onChange={e => setFormData({...formData, reason: e.target.value})}></textarea>
                 </div>
                 
                 <button onClick={handleSubmit} disabled={loading} className="w-full bg-emerald-600 text-white font-bold py-4 rounded-2xl shadow-xl shadow-emerald-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2 uppercase tracking-wide">
                        {loading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <>Gửi đề xuất <i className="fa-solid fa-paper-plane"></i></>}
                 </button>
             </div>
        </div>
    </div>
  );
};

export default ModalCreateRequest;
