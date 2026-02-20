
import React from 'react';

interface Props {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  type?: 'danger' | 'success' | 'info' | 'warning' | 'error';
  isLoading?: boolean;
}

const ConfirmDialog: React.FC<Props> = ({ 
  isOpen, title, message, confirmLabel = "Xác nhận", cancelLabel = "Hủy bỏ", 
  onConfirm, onCancel, type = 'info', isLoading = false 
}) => {
  if (!isOpen) return null;
  
  const colors = {
      danger: { 
          bg: 'bg-red-50', 
          iconColor: 'text-red-500', 
          btn: 'bg-red-500 hover:bg-red-600 shadow-red-200',
          cancelBtn: 'text-red-500 bg-red-50 hover:bg-red-100',
          icon: 'fa-triangle-exclamation'
      },
      error: { 
          bg: 'bg-red-50', 
          iconColor: 'text-red-500', 
          btn: 'bg-red-500 hover:bg-red-600 shadow-red-200',
          cancelBtn: 'text-red-500 bg-red-50 hover:bg-red-100',
          icon: 'fa-xmark'
      },
      success: { 
          bg: 'bg-emerald-50', 
          iconColor: 'text-emerald-500', 
          btn: 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200', 
          cancelBtn: 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100',
          icon: 'fa-check'
      },
      info: { 
          bg: 'bg-blue-50', 
          iconColor: 'text-blue-500', 
          btn: 'bg-blue-600 hover:bg-blue-700 shadow-blue-200', 
          cancelBtn: 'text-blue-600 bg-blue-50 hover:bg-blue-100',
          icon: 'fa-info'
      },
      warning: { 
          bg: 'bg-orange-50', 
          iconColor: 'text-orange-500', 
          btn: 'bg-orange-500 hover:bg-orange-600 shadow-orange-200', 
          cancelBtn: 'text-orange-600 bg-orange-50 hover:bg-orange-100',
          icon: 'fa-exclamation'
      }
  };
  
  const theme = colors[type];
  const isSingleButton = !cancelLabel;

  return (
    <div className="fixed inset-0 z-[3000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in">
        <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-[320px] flex flex-col animate-scale-in overflow-hidden transform transition-all">
            <div className="p-6 flex flex-col items-center text-center">
                {/* Icon */}
                <div className={`w-16 h-16 ${theme.bg} rounded-full flex items-center justify-center mb-5 shadow-inner`}>
                    <i className={`fa-solid ${theme.icon} text-2xl ${theme.iconColor}`}></i>
                </div>

                {/* Content */}
                <h3 className="text-lg font-extrabold text-slate-800 mb-2 leading-tight px-2">{title}</h3>
                <div className="text-sm text-slate-500 font-medium leading-relaxed px-1">
                    {message}
                </div>
            </div>

            {/* Buttons */}
            <div className={`p-5 pt-0 ${isSingleButton ? 'flex' : 'grid grid-cols-2 gap-3'}`}>
                {!isSingleButton && (
                    <button 
                        onClick={onCancel} 
                        disabled={isLoading} 
                        className="py-3 px-4 rounded-xl text-sm font-bold text-slate-500 bg-slate-50 hover:bg-slate-100 transition-colors disabled:opacity-50 active:scale-[0.98]"
                    >
                        {cancelLabel}
                    </button>
                )}
                
                <button 
                    onClick={onConfirm} 
                    disabled={isLoading} 
                    className={`py-3 px-4 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] ${theme.btn} ${isSingleButton ? 'w-full' : ''}`}
                >
                    {isLoading && <i className="fa-solid fa-circle-notch fa-spin"></i>}
                    {confirmLabel}
                </button>
            </div>
        </div>
    </div>
  );
};
export default ConfirmDialog;
