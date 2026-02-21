
import React, { useState, useEffect } from 'react';
import { Employee } from '../types';
import Avatar from './Avatar';
import { TabType } from './BottomNav';
import SettingsModal from './SettingsModal';

interface Props {
  user: Employee;
  activeTab: TabType;
  onOpenProfile: () => void;
  notiCount?: number;
  onOpenNoti?: () => void;
  customIcon?: string;
  setIsNavVisible?: (visible: boolean) => void;
  onCreateRequest?: () => void; 
  onContactSearch?: () => void;
}

const Header: React.FC<Props> = ({ user, activeTab, onOpenProfile, onOpenNoti, customIcon, setIsNavVisible, onCreateRequest, onContactSearch }) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Automatically close settings when switching tabs
  useEffect(() => {
      setIsSettingsOpen(false);
  }, [activeTab]);

  const getTitle = () => {
      switch (activeTab) {
          case 'home': return 'Trang chủ';
          case 'contacts': return 'Danh bạ';
          case 'manager': return 'Quản lý';
          case 'notifications': return 'Thông báo';
          case 'history': return 'Lịch sử';
          case 'requests': return 'Yêu cầu';
          case 'profile': return 'Hồ sơ';
          default: return '';
      }
  };

  const title = getTitle();

  return (
    <>
        <div className="fixed top-0 left-0 w-full z-40 bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-md pt-safe transition-all border-b border-transparent shadow-sm/30">
            {/* Adjusted height to h-14 (56px) for better mobile proportion */}
            <div className="flex items-center justify-between h-14 px-4 relative">
                
                {/* LEFT AREA: Hamburger & Title */}
                <div className="flex items-center z-20 gap-3">
                    
                    {/* Hamburger Button - Smaller & Cleaner */}
                    <button 
                        onClick={() => setIsSettingsOpen(true)}
                        className="w-9 h-9 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 transition-all active:scale-90 shadow-sm"
                    >
                        <i className="fa-solid fa-bars text-sm"></i>
                    </button>

                    {/* Tab Title - Adjusted Typography */}
                    <div className="flex items-center gap-2">
                        {title && (
                            <span className="text-xl font-extrabold text-slate-800 dark:text-white tracking-tight animate-fade-in">
                                {title}
                            </span>
                        )}
                        {customIcon && (
                            <i className={`${customIcon} text-emerald-500 text-sm mb-0.5`}></i>
                        )}
                    </div>
                </div>
                
                {/* RIGHT SLOT: Actions & Avatar */}
                <div className="flex items-center justify-end z-20 gap-2.5">
                    
                    {/* SEARCH BUTTON (Unified Size w-9 h-9) */}
                    {activeTab === 'contacts' && onContactSearch && (
                        <button 
                            onClick={onContactSearch}
                            className="w-9 h-9 rounded-full bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 flex items-center justify-center active:scale-90 transition-all shadow-sm"
                        >
                            <i className="fa-solid fa-magnifying-glass text-sm"></i>
                        </button>
                    )}

                    {/* CREATE REQUEST BUTTON (Unified Size w-9 h-9) */}
                    {activeTab === 'requests' && onCreateRequest && (
                        <button 
                            onClick={onCreateRequest}
                            className="w-9 h-9 rounded-full bg-emerald-500 text-white flex items-center justify-center active:scale-90 transition-all shadow-lg shadow-emerald-500/20"
                        >
                            <i className="fa-solid fa-plus text-sm"></i>
                        </button>
                    )}

                    {onOpenNoti ? (
                        <button onClick={onOpenNoti} className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white flex items-center justify-center transition-colors shadow-sm active:scale-95 border border-slate-200 dark:border-slate-700">
                            <i className="fa-solid fa-xmark text-sm"></i>
                        </button>
                    ) : (
                        <div className="relative group cursor-pointer active:scale-95 transition-transform" onClick={onOpenProfile}>
                            {/* Avatar Size Reduced to w-9 h-9 to match buttons */}
                            <Avatar 
                                src={user.face_ref_url} 
                                name={user.name} 
                                className="w-9 h-9 ring-2 ring-white dark:ring-slate-800 shadow-sm" 
                                textSize="text-xs"
                            />
                            {/* Online Status Dot - Scaled down */}
                            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 ring-2 ring-white dark:ring-slate-900 rounded-full"></div>
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* Settings Modal (Sidebar) */}
        <SettingsModal 
            isOpen={isSettingsOpen} 
            onClose={() => setIsSettingsOpen(false)} 
            setIsNavVisible={setIsNavVisible}
        />
    </>
  );
};

export default Header;
