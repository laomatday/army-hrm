
import React, { useRef } from 'react';
import { useScrollControl } from '../hooks/useScrollControl';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  setIsNavVisible?: (visible: boolean) => void;
  title?: string;
  subtitle?: string;
  showCloseButton?: boolean;
  className?: string; // Additional classes for the container
}

const BaseModal: React.FC<Props> = ({ 
    isOpen, 
    onClose, 
    children, 
    setIsNavVisible, 
    title, 
    subtitle, 
    showCloseButton = true,
    className = ""
}) => {
  const { handleScroll } = useScrollControl(setIsNavVisible);
  const touchStart = useRef<{x: number, y: number} | null>(null);
  const touchEnd = useRef<{x: number, y: number} | null>(null);

  if (!isOpen) return null;

  // Touch handlers for swipe-to-close (optional, mostly horizontal back)
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
    
    // Swipe Right to Left or Left to Right to close (Horizontal swipe)
    if (Math.abs(distanceX) > Math.abs(distanceY) && Math.abs(distanceX) > 60) {
         onClose();
    }
  };

  return (
    <div 
        className={`fixed inset-0 z-[60] bg-slate-50 dark:bg-slate-900 flex flex-col font-sans animate-slide-up transition-colors duration-300 ${className}`}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
    >
        {/* Close Button Fixed */}
        {showCloseButton && (
            <div className="fixed top-0 right-0 pt-safe p-4 z-[70]">
                <button onClick={onClose} className="w-10 h-10 bg-white/60 dark:bg-slate-800/60 backdrop-blur-md rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300 shadow-sm hover:bg-white dark:hover:bg-slate-700 transition-colors border border-white/20 dark:border-slate-600/20 active:scale-95">
                    <i className="fa-solid fa-xmark"></i>
                </button>
            </div>
        )}

        {/* Header Content (Optional - renders inside flow) */}
        {title && (
             <div className="px-5 pt-safe pt-4 pb-2 flex items-center justify-between shrink-0 z-10 bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-sm sticky top-0">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">{title}</h1>
                    {subtitle && <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{subtitle}</p>}
                </div>
                {/* Spacer for the fixed close button */}
                <div className="w-10"></div>
            </div>
        )}

        {/* Scrollable Content */}
        <div 
            className="flex-1 overflow-y-auto no-scrollbar" 
            onScroll={handleScroll}
        >
            {children}
        </div>
    </div>
  );
};

export default BaseModal;
