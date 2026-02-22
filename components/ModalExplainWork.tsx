import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Employee } from '../types';
import { submitExplanation } from '../services/api';
import { formatDateString, triggerHaptic } from '../utils/helpers';
import ModalHeader from './ModalHeader';
import ConfirmDialog from './ConfirmDialog';
import { useScrollControl } from '../hooks/useScrollControl';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onAlert: (title: string, msg: string, type: 'success' | 'error' | 'warning') => void;
  user: Employee;
  initialData?: { date: string, reason: string };
  explainableItems: { date: string, explainReason: string }[];
}

const ModalExplainWork: React.FC<Props> = ({ isOpen, onClose, onSuccess, onAlert, user, initialData, explainableItems }) => {
  const [selectedDate, setSelectedDate] = useState(initialData?.date || '');
  const [reason, setReason] = useState(initialData?.reason || '');
  const [confirmDialog, setConfirmDialog] = useState<{isOpen: boolean, isPastMonth: boolean}>({ isOpen: false, isPastMonth: false });
  const [loading, setLoading] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSubmitVisible, setIsSubmitVisible] = useState(true);

  const { handleScroll } = useScrollControl(setIsSubmitVisible);

  const touchStart = useRef<{x: number, y: number} | null>(null);
  const touchEnd = useRef<{x: number, y: number} | null>(null);
  const minSwipeDistance = 60;

  useEffect(() => {
    if (isOpen) {
        setSelectedDate(initialData?.date || '');
        setReason(initialData?.reason || '');
        setIsSubmitVisible(true);
    }
  }, [isOpen, initialData]);

  const handlePreSubmit = () => {
      if (!reason.trim()) {
          onAlert("Thiếu thông tin", "Vui lòng nhập lý do giải trình.", 'error');
          return;
      }
      if (!selectedDate) {
          onAlert("Thiếu thông tin", "Vui lòng chọn ngày.", 'error');
          return;
      }

      const attDate = new Date(selectedDate);
      const now = new Date();
      const isPast = attDate.getMonth() !== now.getMonth() || attDate.getFullYear() !== now.getFullYear();

      setConfirmDialog({
          isOpen: true,
          isPastMonth: isPast
      });
  };

  const handleSubmitExplanation = async () => {
      setLoading(true);
      const res = await submitExplanation({
          employeeId: user.employee_id,
          name: user.name,
          date: selectedDate,
          reason: reason
      });
      
      if (res.success) {
          onAlert("Thành công", "Đã gửi giải trình.", 'success');
          onSuccess();
          onClose();
      } else {
          onAlert("Lỗi", res.message, 'error');
      }
      
      setLoading(false);
      setConfirmDialog({ isOpen: false, isPastMonth: false });
  };

  const onTouchStart = (e: React.TouchEvent) => {
    touchEnd.current = null;
    touchStart.current = { x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY };
  };

  const onTouchMove = (e: React.TouchEvent) => {
     touchEnd.current = { x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY };
  };

  const onTouchEnd = () => {
    if (!touchStart.current || !touchEnd.current) return;
    
    const distanceX = touchStart.current.x - touchEnd.current.x;
    const distanceY = touchStart.current.y - touchEnd.current.y;
    
    if (Math.abs(distanceY) > Math.abs(distanceX)) {
         if (distanceY < -minSwipeDistance) {
             triggerHaptic('light');
             onClose();
         }
    }
  };

  if (!isOpen) return null;

  return (
    <>
        <div 
          className="fixed inset-0 z-[2000] bg-slate-50 dark:bg-slate-900 flex flex-col animate-slide-up transition-colors duration-300"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
            <div className="fixed top-0 left-0 w-full z-[2010]">
                    <ModalHeader 
                    onClose={onClose} 
                    bgClass="bg-transparent border-none"
                    />
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-32 pt-14" onScroll={handleScroll}>
                <div className="animate-fade-in mt-4">
                    <div className="bg-white dark:bg-slate-800 rounded-[32px] p-8 border border-slate-100 dark:border-slate-700 text-center relative overflow-hidden mb-6 transition-colors">
                        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-br from-orange-500/10 to-amber-500/10 dark:from-orange-500/20 dark:to-amber-500/20 rounded-t-[32px] transition-colors duration-500"></div>
                        
                        <div className="relative z-10 flex flex-col items-center">
                            <div className="w-28 h-28 rounded-full p-1.5 bg-white dark:bg-slate-800 mb-4 mt-2 relative transition-colors">
                                <div className="w-full h-full rounded-full bg-orange-50 dark:bg-orange-900/30 flex items-center justify-center border border-orange-100 dark:border-orange-800/50 text-orange-500 dark:text-orange-400">
                                    <i className="fa-solid fa-file-pen text-4xl ml-1"></i>
                                </div>
                            </div>
                            <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight leading-tight">Giải Trình Công</h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-2 uppercase tracking-wide">Bổ sung thông tin chấm công</p>
                        </div>
                    </div>

                    <h3 className="text-xs font-black text-emerald-700 dark:text-emerald-400 uppercase mb-3 ml-2 tracking-widest flex items-center gap-2">
                        <i className="fa-solid fa-list-check text-[10px]"></i>
                        Thông tin chi tiết
                    </h3>

                    <div className="bg-white dark:bg-slate-800 rounded-[32px] p-6 border border-slate-100 dark:border-slate-700 space-y-5 transition-colors mb-8">
                        
                        <div className="relative">
                            <label className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wide ml-1 block mb-1.5">Chọn ngày cần giải trình</label>
                            <button 
                                onClick={() => { triggerHaptic('light'); setIsDropdownOpen(!isDropdownOpen); }}
                                className={`w-full min-h-[56px] px-4 py-3 flex justify-between items-center bg-slate-50 dark:bg-slate-900 border rounded-2xl text-sm font-bold outline-none transition-all ${isDropdownOpen ? 'border-orange-500 dark:border-orange-500 ring-2 ring-orange-500/20' : 'border-slate-200 dark:border-slate-700'}`}
                            >
                                <div className="text-left">
                                    {selectedDate ? (
                                        <>
                                            <span className="block text-slate-800 dark:text-white">{formatDateString(selectedDate)}</span>
                                            <span className="text-xs text-slate-400 dark:text-slate-500 font-normal">
                                                {explainableItems.find(i => i.date === selectedDate)?.explainReason || "Chọn ngày..."}
                                            </span>
                                        </>
                                    ) : (
                                        <span className="text-slate-400 dark:text-slate-500">Chọn ngày...</span>
                                    )}
                                </div>
                                <i className={`fa-solid fa-chevron-down text-slate-400 dark:text-slate-500 text-xs transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}></i>
                            </button>
                            
                            {isDropdownOpen && (
                                <div className="absolute top-[calc(100%+8px)] left-0 w-full bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl z-50 overflow-hidden animate-fade-in p-2 space-y-1 shadow-xl max-h-60 overflow-y-auto no-scrollbar">
                                    {explainableItems.length === 0 ? (
                                        <div className="p-4 text-center text-xs text-slate-400 font-bold">Không có ngày nào cần giải trình</div>
                                    ) : (
                                        explainableItems.map((item) => (
                                            <div 
                                                key={item.date}
                                                onClick={() => {
                                                    triggerHaptic('light');
                                                    setSelectedDate(item.date);
                                                    setReason(item.explainReason || '')
                                                    setIsDropdownOpen(false);
                                                }}
                                                className={`flex items-center justify-between p-3.5 rounded-xl cursor-pointer transition-all ${
                                                    selectedDate === item.date 
                                                    ? 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' 
                                                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                                                }`}
                                            >
                                                <div>
                                                    <span className="font-bold text-sm block">{formatDateString(item.date)}</span>
                                                    <span className="text-[10px] opacity-70">{item.explainReason}</span>
                                                </div>
                                                {selectedDate === item.date && (
                                                    <i className="fa-solid fa-check text-orange-600 dark:text-orange-400"></i>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wide ml-1 block mb-1.5">Lý do giải trình</label>
                            <textarea 
                                id="explain-reason-textarea"
                                className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-800 dark:text-white outline-none h-32 resize-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 dark:focus:border-orange-500 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500" 
                                placeholder="Nhập lý do chi tiết..."
                                value={reason} 
                                onChange={e => setReason(e.target.value)}
                            ></textarea>
                        </div>

                    </div>
                </div>
            </div>

            <div className={`fixed bottom-0 left-0 right-0 z-[2010] p-4 bg-white/80 dark:bg-slate-800/80 backdrop-blur-lg border-t border-slate-100 dark:border-slate-700 transition-transform duration-300 ${isSubmitVisible ? 'translate-y-0' : 'translate-y-full'}`}>
                <button 
                    onClick={handlePreSubmit}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white font-extrabold py-4 rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-2 uppercase tracking-widest"
                >
                    Gửi giải trình <i className="fa-solid fa-paper-plane"></i>
                </button>
            </div>
        </div>

        <ConfirmDialog 
            isOpen={confirmDialog.isOpen}
            title="Gửi giải trình?"
            message={confirmDialog.isPastMonth ? 
                <span className="text-red-500 font-bold"><i className="fa-solid fa-triangle-exclamation mr-1"></i> Bạn đang giải trình cho tháng trước. Đơn này có thể bị tính là trễ hạn.</span> 
                : 
                <span>Hệ thống sẽ ghi nhận giải trình của bạn cho ngày <span className="text-slate-800 dark:text-white font-bold">{formatDateString(selectedDate)}</span>.</span>
            }
            confirmLabel="Xác nhận gửi"
            onConfirm={handleSubmitExplanation}
            onCancel={() => setConfirmDialog({...confirmDialog, isOpen: false})}
            isLoading={loading}
            type={confirmDialog.isPastMonth ? 'warning' : 'success'}
        />
    </>
  );
};

export default ModalExplainWork;
