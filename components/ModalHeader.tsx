import React from 'react';

interface Props {
  title?: string;
  onClose: () => void;
  rightContent?: React.ReactNode;
  bgClass?: string;
}

const ModalHeader: React.FC<Props> = ({ title, onClose, rightContent, bgClass }) => {
  return (
    <div className={`sticky top-0 z-50 pt-safe transition-all border-b border-transparent ${bgClass || 'bg-slate-50/90 dark:bg-neutral-black/90'}`}>
        <div className="flex items-center justify-between h-14 px-4 relative">
            
            <div className="flex-1 flex items-center min-w-0 gap-2">
                {title && (
                    <h2 className="text-xl font-extrabold text-neutral-black dark:text-neutral-white tracking-tight truncate animate-fade-in">
                        {title}
                    </h2>
                )}
            </div>

            <div className="flex items-center gap-3 pl-2 flex-shrink-0">
                {rightContent}
                
                <button 
                    onClick={onClose} 
                    className="w-9 h-9 rounded-full bg-slate-200/50 dark:bg-slate-800 border border-slate-300/30 dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-neutral-black dark:hover:text-neutral-white transition-all active:scale-90"
                >
                    <i className="fa-solid fa-xmark text-lg"></i>
                </button>
            </div>
        </div>
    </div>
  );
};

export default ModalHeader;