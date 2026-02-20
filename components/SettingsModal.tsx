

import React, { useState, useEffect, useRef } from 'react';
import UserGuideModal from './UserGuideModal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  setIsNavVisible?: (visible: boolean) => void;
}

const SettingsModal: React.FC<Props> = ({ isOpen, onClose, setIsNavVisible }) => {
  const [isDark, setIsDark] = useState(false);
  const [isAuto, setIsAuto] = useState(true);
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  
  const lastScrollY = useRef(0);

  // Sync state when modal opens
  useEffect(() => {
      if (isOpen) {
          setIsDark(document.documentElement.classList.contains('dark'));
          setIsAuto(!localStorage.getItem('army_theme'));
          if (setIsNavVisible) setIsNavVisible(true);
      } else {
          if (setIsNavVisible) setIsNavVisible(true);
      }
  }, [isOpen]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
      if (!setIsNavVisible) return;
      const currentScrollY = e.currentTarget.scrollTop;
      if (currentScrollY < 0) return;

      const diff = currentScrollY - lastScrollY.current;
      if (Math.abs(diff) < 5) return;

      if (diff > 0 && currentScrollY > 20) {
          setIsNavVisible(false);
      } else if (diff < 0) {
          setIsNavVisible(true);
      }
      lastScrollY.current = currentScrollY;
  };

  const handleThemeToggle = () => {
      const newDark = !isDark;
      setIsDark(newDark);
      setIsAuto(false);
      localStorage.setItem('army_theme', newDark ? 'dark' : 'light');
      // Dispatch event to notify App.tsx
      window.dispatchEvent(new Event('army_theme_update'));
  };

  if (!isOpen) return null;

  const LOGO_URL = "https://firebasestorage.googleapis.com/v0/b/army-hrm-70615.firebasestorage.app/o/logo%2Flogo.png?alt=media";

  // V2026 Styled Setting Item
  const SettingItem = ({ 
    icon, 
    colorClass, 
    title, 
    subtitle, 
    type = 'link', 
    onClick,
    value = false
  }: { 
    icon: string, 
    colorClass: string, 
    title: string, 
    subtitle?: string, 
    type?: 'link' | 'toggle' | 'info',
    onClick?: () => void,
    value?: boolean
  }) => (
    <div 
        onClick={type === 'toggle' ? undefined : onClick}
        className="flex items-center gap-4 p-4 active:bg-slate-50 dark:active:bg-slate-700/50 transition-colors cursor-pointer group"
    >
        {/* Icon Container */}
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl flex-shrink-0 shadow-sm border border-white/50 dark:border-slate-700/50 ${colorClass}`}>
            <i className={`fa-solid ${icon}`}></i>
        </div>

        {/* Text Content */}
        <div className="flex-1 min-w-0">
            <h4 className="text-base font-bold text-slate-800 dark:text-white leading-tight group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">{title}</h4>
            {subtitle && <p className="text-xs text-slate-400 dark:text-slate-500 font-bold mt-0.5 truncate">{subtitle}</p>}
        </div>

        {/* Action/End Content */}
        <div className="pl-2">
            {type === 'link' && (
                <div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800 text-slate-300 dark:text-slate-600 flex items-center justify-center group-hover:bg-emerald-50 dark:group-hover:bg-emerald-900/30 group-hover:text-emerald-500 dark:group-hover:text-emerald-400 transition-colors">
                    <i className="fa-solid fa-chevron-right text-xs"></i>
                </div>
            )}
            {type === 'toggle' && (
                <div 
                    onClick={onClick}
                    className={`w-12 h-7 rounded-full relative transition-colors duration-300 shadow-inner ${value ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`}
                >
                    <div className={`w-5 h-5 bg-white rounded-full shadow-md absolute top-1 transition-transform duration-300 ${value ? 'translate-x-[22px]' : 'translate-x-1'}`}></div>
                </div>
            )}
            {type === 'info' && <i className="fa-solid fa-circle-info text-slate-300 dark:text-slate-600 text-lg"></i>}
        </div>
    </div>
  );

  return (
    <>
    <div className="fixed inset-0 z-[60] bg-slate-50 dark:bg-slate-900 flex flex-col font-sans animate-slide-up">
        {/* Background Blobs (Consistent with Login/App) */}
        <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-[20%] left-[-10%] w-80 h-80 bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>

        {/* HEADER AREA */}
        <div className="pt-safe pt-2 px-4 pb-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl sticky top-0 z-10 border-b border-slate-100/50 dark:border-slate-800/50">
            <div className="flex justify-between items-center h-16 mb-2">
                <div>
                     <h1 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight ml-1">Cài đặt</h1>
                </div>
                <button onClick={onClose} className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors shadow-sm active:scale-95">
                    <i className="fa-solid fa-xmark text-xl"></i>
                </button>
            </div>

            {/* Search Pill - Matched to TabContacts style */}
            <div className="relative group">
                <i className="fa-solid fa-magnifying-glass absolute left-4 top-3.5 text-slate-400 group-focus-within:text-emerald-500 transition-colors"></i>
                <input 
                    type="text" 
                    placeholder="Tìm kiếm cài đặt..."
                    className="w-full h-12 bg-slate-100 dark:bg-slate-800 rounded-2xl pl-11 pr-4 text-base font-bold text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/20 border border-transparent transition-all shadow-sm"
                />
            </div>
        </div>

        {/* SCROLLABLE CONTENT */}
        <div className="flex-1 overflow-y-auto px-4 pb-32 space-y-6 pt-4 relative z-0" onScroll={handleScroll}>
            
            {/* SECTION 1: GENERAL */}
            <div className="space-y-3">
                <h3 className="text-xs font-black text-emerald-700 dark:text-emerald-400 uppercase ml-2 tracking-widest flex items-center gap-2">
                    <i className="fa-solid fa-sliders text-[10px]"></i> Tùy chọn chung
                </h3>
                <div className="bg-white dark:bg-slate-800 rounded-[24px] overflow-hidden shadow-sm border border-slate-100 dark:border-slate-700 divide-y divide-slate-50 dark:divide-slate-700">
                    <SettingItem 
                        icon="fa-moon" 
                        colorClass="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
                        title="Giao diện tối"
                        subtitle={isAuto ? "Tự động theo thiết bị" : (isDark ? "Đang bật (Thủ công)" : "Đang tắt (Thủ công)")}
                        type="toggle"
                        value={isDark} 
                        onClick={handleThemeToggle}
                    />
                    <SettingItem 
                        icon="fa-bell" 
                        colorClass="bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
                        title="Thông báo"
                        subtitle="Âm thanh, rung và cập nhật"
                        type="toggle"
                        value={notifEnabled}
                        onClick={() => setNotifEnabled(!notifEnabled)}
                    />
                     <SettingItem 
                        icon="fa-globe" 
                        colorClass="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                        title="Ngôn ngữ"
                        subtitle="Tiếng Việt (Mặc định)"
                    />
                </div>
            </div>

            {/* SECTION 2: SUPPORT */}
            <div className="space-y-3">
                <h3 className="text-xs font-black text-emerald-700 dark:text-emerald-400 uppercase ml-2 tracking-widest flex items-center gap-2">
                    <i className="fa-solid fa-headset text-[10px]"></i> Trợ giúp & Hỗ trợ
                </h3>
                <div className="bg-white dark:bg-slate-800 rounded-[24px] overflow-hidden shadow-sm border border-slate-100 dark:border-slate-700 divide-y divide-slate-50 dark:divide-slate-700">
                    <a href="tel:19001234" className="no-underline block">
                        <SettingItem 
                            icon="fa-phone-volume" 
                            colorClass="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
                            title="Tổng đài hỗ trợ"
                            subtitle="1900 1234 (Nhánh 1)"
                        />
                    </a>
                    <a href="mailto:support@armyhrm.com" className="no-underline block">
                        <SettingItem 
                            icon="fa-paper-plane" 
                            colorClass="bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400"
                            title="Gửi phản hồi"
                            subtitle="Báo lỗi hoặc góp ý tính năng"
                        />
                    </a>
                     <SettingItem 
                        icon="fa-book-open" 
                        colorClass="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                        title="Hướng dẫn sử dụng"
                        subtitle="Câu hỏi thường gặp (FAQ)"
                        onClick={() => setIsGuideOpen(true)}
                    />
                </div>
            </div>

            {/* SECTION 3: ABOUT */}
            <div className="space-y-3">
                <h3 className="text-xs font-black text-emerald-700 dark:text-emerald-400 uppercase ml-2 tracking-widest flex items-center gap-2">
                    <i className="fa-solid fa-circle-info text-[10px]"></i> Thông tin ứng dụng
                </h3>
                <div className="bg-white dark:bg-slate-800 rounded-[24px] overflow-hidden shadow-sm border border-slate-100 dark:border-slate-700 divide-y divide-slate-50 dark:divide-slate-700">
                    <div className="p-6 flex flex-col items-center justify-center text-center gap-3 bg-gradient-to-b from-slate-50/50 dark:from-slate-800/50 to-white dark:to-slate-800">
                        <div className="w-20 h-20 bg-white dark:bg-slate-700 rounded-[20px] shadow-lg shadow-emerald-500/10 border border-slate-100 dark:border-slate-600 p-3 mb-1 animate-scale-in">
                             <img src={LOGO_URL} className="w-full h-full object-contain" alt="Logo" />
                        </div>
                        <div>
                            <h4 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">Army HRM</h4>
                            <p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-md inline-block mt-1">v2026.2.0 (Build 890)</p>
                        </div>
                    </div>
                    
                    <SettingItem 
                        icon="fa-shield-halved" 
                        colorClass="bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400"
                        title="Chính sách bảo mật"
                        type="link"
                    />
                    <SettingItem 
                        icon="fa-file-contract" 
                        colorClass="bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400"
                        title="Điều khoản dịch vụ"
                        type="link"
                    />
                </div>
            </div>
        </div>
    </div>

    <UserGuideModal 
        isOpen={isGuideOpen} 
        onClose={() => setIsGuideOpen(false)} 
        setIsNavVisible={setIsNavVisible}
    />
    </>
  );
};

export default SettingsModal;
