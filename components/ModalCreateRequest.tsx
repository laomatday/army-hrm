import React, { useState, useEffect, useRef } from 'react';
import { Employee } from '../types';
import { submitRequest } from '../services/api';
import { formatDateString, triggerHaptic } from '../utils/helpers';
import ModalHeader from './ModalHeader';

interface Props {
  user: Employee;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onAlert: (title: string, msg: string, type: 'success' | 'error' | 'warning') => void;
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

  const touchStart = useRef<{x: number, y: number} | null>(null);
  const touchEnd = useRef<{x: number, y: number} | null>(null);

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
      triggerHaptic('light');
      if(!formData.fromDate || !formData.toDate || !formData.reason) {
          onAlert("Thiếu thông tin", "Vui lòng nhập đầy đủ ngày và lý do.", 'warning');
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
          triggerHaptic('success');
          setFormData({ type: 'Nghỉ phép năm', fromDate: '', toDate: '', expirationDate: '', reason: '' });
          onSuccess();
          onClose();
      } else {
          triggerHaptic('error');
      }
  };

  const formatDateDisplay = (dateStr: string) => {
    return formatDateString(dateStr);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    const x = e.targetTouches[0].clientX;
    if (x < 30 || x > window.innerWidth - 30) {
        touchStart.current = null;
        return;
    }
    touchEnd.current = null;
    touchStart.current = { x, y: e.targetTouches[0].clientY };
  };

  const onTouchMove = (e: React.TouchEvent) => {
     touchEnd.current = { x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY };
  };

  const onTouchEnd = () => {
    if (!touchStart.current || !touchEnd.current) return;
    
    const distanceX = touchStart.current.x - touchEnd.current.x;
    const distanceY = touchStart.current.y - touchEnd.current.y;
    
    if (Math.abs(distanceX) > Math.abs(distanceY)) {
         if (distanceX < -60) {
             triggerHaptic('light');
             onClose();
         }
    }
  };

  if (!isOpen) return null;

  const gradientClass = 'from-emerald-500/10 to-teal-500/10 dark:from-emerald-500/20 dark:to-teal-500/20';

  return (
    <div 
        className="fixed inset-0 z-[100] bg-slate-50 dark:bg-slate-900 flex flex-col animate-slide-up transition-colors duration-300"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
    >
        <div className="fixed top-0 left-0 w-full z-[110]">
             <ModalHeader 
                onClose={() => { triggerHaptic('light'); onClose(); }} 
                bgClass="bg-transparent border-none"
             />
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-32 pt-14">
            <div className="animate-fade-in mt-4">
                
                <div className="bg-white dark:bg-slate-800 rounded-[32px] p-8 border border-slate-100 dark:border-slate-700 text-center relative overflow-hidden mb-6 transition-colors">
                    <div className={`absolute top-0 left-0 w-full h-32 bg-gradient-to-br ${gradientClass} rounded-t-[32px] transition-colors duration-500`}></div>
                    
                    <div className="relative z-10 flex flex-col items-center">
                        <div className="w-28 h-28 rounded-full p-1.5 bg-white dark:bg-slate-800 mb-4 mt-2 relative transition-colors">
                            <div className="w-full h-full rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center border border-emerald-100 dark:border-emerald-800/50 text-emerald-500 dark:text-emerald-400">
                                <i className="fa-solid fa-paper-plane text-4xl ml-[-4px]"></i>
                            </div>
                        </div>
                        <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight leading-tight">Tạo Đề Xuất</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-2 uppercase tracking-wide">Điền thông tin chi tiết bên dưới</p>
                    </div>
                </div>

                <h3 className="text-xs font-black text-emerald-700 dark:text-emerald-400 uppercase mb-3 ml-2 tracking-widest flex items-center gap-2">
                    <i className="fa-solid fa-pen-to-square text-[10px]"></i>
                    Thông tin đề xuất
                </h3>
                
                <div className="bg-white dark:bg-slate-800 rounded-[32px] p-6 border border-slate-100 dark:border-slate-700 space-y-5 transition-colors mb-8">
                     
                     <div className="relative">
                         <label className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wide ml-1 block mb-1.5">Loại đề xuất</label>
                         <button 
                            onClick={() => { triggerHaptic('light'); setIsTypeOpen(!isTypeOpen); }}
                            className={`w-full h-14 px-4 flex justify-between items-center bg-slate-50 dark:bg-slate-900 border rounded-2xl text-sm font-bold outline-none transition-all ${isTypeOpen ? 'border-emerald-500 dark:border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-200 dark:border-slate-700'}`}
                         >
                             <span className="text-slate-800 dark:text-white">{formData.type}</span>
                             <i className={`fa-solid fa-chevron-down text-slate-400 dark:text-slate-500 text-xs transition-transform ${isTypeOpen ? 'rotate-180' : ''}`}></i>
                         </button>
                         
                         {isTypeOpen && (
                            <div className="absolute top-[calc(100%+8px)] left-0 w-full bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl z-50 overflow-hidden animate-fade-in p-2 space-y-1">
                                {requestTypes.map((type) => (
                                    <div 
                                        key={type}
                                        onClick={() => {
                                            triggerHaptic('light');
                                            setFormData({...formData, type: type});
                                            setIsTypeOpen(false);
                                        }}
                                        className={`flex items-center justify-between p-3.5 rounded-xl cursor-pointer transition-all ${
                                            formData.type === type 
                                            ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' 
                                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                                        }`}
                                    >
                                        <span className="font-bold text-sm">{type}</span>
                                        {formData.type === type && (
                                            <i className="fa-solid fa-check text-emerald-600 dark:text-emerald-400"></i>
                                        )}
                                    </div>
                                ))}
                            </div>
                         )}
                     </div>

                     <div className="grid grid-cols-2 gap-4">
                         <div>
                             <label className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wide ml-1 block mb-1.5">Từ ngày</label>
                             <div className="relative h-14 w-full">
                                 <input 
                                     type="date" 
                                     className="absolute inset-0 w-full h-full z-20 opacity-0 cursor-pointer"
                                     value={formData.fromDate} 
                                     onChange={e => setFormData({...formData, fromDate: e.target.value})}
                                     onClick={(e) => { try { e.currentTarget.showPicker() } catch(err) {} }}
                                 />
                                 <div className={`absolute inset-0 w-full h-full px-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold flex items-center justify-between pointer-events-none z-10 transition-colors ${formData.fromDate ? 'text-slate-800 dark:text-white' : 'text-slate-400 dark:text-slate-500'}`}>
                                     <span>{formData.fromDate ? formatDateDisplay(formData.fromDate) : 'dd/mm/yyyy'}</span>
                                     <i className="fa-regular fa-calendar text-slate-400 dark:text-slate-500"></i>
                                 </div>
                             </div>
                         </div>
                         <div>
                             <label className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wide ml-1 block mb-1.5">Đến ngày</label>
                             <div className="relative h-14 w-full">
                                 <input 
                                     type="date" 
                                     className="absolute inset-0 w-full h-full z-20 opacity-0 cursor-pointer"
                                     value={formData.toDate} 
                                     onChange={e => setFormData({...formData, toDate: e.target.value})}
                                     onClick={(e) => { try { e.currentTarget.showPicker() } catch(err) {} }}
                                 />
                                 <div className={`absolute inset-0 w-full h-full px-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold flex items-center justify-between pointer-events-none z-10 transition-colors ${formData.toDate ? 'text-slate-800 dark:text-white' : 'text-slate-400 dark:text-slate-500'}`}>
                                     <span>{formData.toDate ? formatDateDisplay(formData.toDate) : 'dd/mm/yyyy'}</span>
                                     <i className="fa-regular fa-calendar text-slate-400 dark:text-slate-500"></i>
                                 </div>
                             </div>
                         </div>
                     </div>

                     <div>
                         <label className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wide ml-1 block mb-1.5">Ngày hết hạn (Tuỳ chọn)</label>
                         <div className="relative h-14 w-full">
                             <input 
                                 type="date" 
                                 className="absolute inset-0 w-full h-full z-20 opacity-0 cursor-pointer"
                                 value={formData.expirationDate} 
                                 onChange={e => setFormData({...formData, expirationDate: e.target.value})}
                                 onClick={(e) => { try { e.currentTarget.showPicker() } catch(err) {} }}
                             />
                             <div className={`absolute inset-0 w-full h-full px-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold flex items-center justify-between pointer-events-none z-10 transition-colors ${formData.expirationDate ? 'text-slate-800 dark:text-white' : 'text-slate-400 dark:text-slate-500'}`}>
                                 <span>{formData.expirationDate ? formatDateDisplay(formData.expirationDate) : 'dd/mm/yyyy'}</span>
                                 <i className="fa-regular fa-clock text-slate-400 dark:text-slate-500"></i>
                             </div>
                         </div>
                     </div>

                     <div>
                         <label className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wide ml-1 block mb-1.5">Lý do chi tiết</label>
                         <textarea 
                            className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-800 dark:text-white outline-none h-32 resize-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 dark:focus:border-emerald-500 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500" 
                            placeholder="Nhập lý do nghỉ..."
                            value={formData.reason} 
                            onChange={e => setFormData({...formData, reason: e.target.value})}
                         ></textarea>
                     </div>
                     
                     <button 
                        onClick={handleSubmit} 
                        disabled={loading} 
                        className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-400 text-white font-extrabold py-4 rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-2 uppercase tracking-widest mt-2"
                     >
                            {loading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <>Gửi đề xuất <i className="fa-solid fa-paper-plane"></i></>}
                     </button>
                </div>
            </div>
        </div>
    </div>
  );
};

export default ModalCreateRequest;