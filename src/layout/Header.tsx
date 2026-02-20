
import React, { useState, useEffect } from 'react';
import { Employee } from '../shared/types';
import Avatar from '../shared/components/Avatar';
import { TabType } from './BottomNav';
import SettingsModal from '../features/profile/SettingsModal';

interface Props {
  user: Employee;
  activeTab: TabType;
  onOpenProfile: () => void;
  notiCount?: number;
  onOpenNoti?: () => void;
  customIcon?: string;
  setIsNavVisible?: (visible: boolean) => void;
}

const Header: React.FC<Props> = ({ user, activeTab, onOpenProfile, onOpenNoti, customIcon, setIsNavVisible }) => {
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
        <div className="fixed top-0 left-0 w-full z-40 bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-md pt-safe pt-2 transition-all border-b border-transparent shadow-sm/50">
            <div className="flex items-center justify-between h-16 px-4 relative">
                
                {/* LEFT AREA: Hamburger, Icon, Title */}
                <div className="flex items-center z-20 gap-1">
                    
                    {/* Hamburger Button */}
                    <button 
                        onClick={() => setIsSettingsOpen(true)}
                        className="w-12 h-12 rounded-full bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 transition-all active:scale-90 -ml-3"
                    >
                        <i className="fa-solid fa-bars text-2xl"></i>
                    </button>

                    {/* Tab Title */}
                    {title && (
                        <span className="text-2xl font-black text-slate-800 dark:text-white tracking-tight ml-1 animate-fade-in">
                            {title}
                        </span>
                    )}

                    {customIcon && (
                        <div className="w-12 h-12 flex items-center justify-center text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 rounded-full flex-shrink-0">
                            <i className={`${customIcon} text-xl`}></i>
                        </div>
                    )}
                </div>
                
                {/* RIGHT SLOT: Avatar OR Close Button */}
                <div className="w-14 flex-shrink-0 flex items-center justify-end z-20 gap-3 ml-2">
                    {onOpenNoti ? (
                        <button onClick={onOpenNoti} className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white flex items-center justify-center transition-colors shadow-sm active:scale-95">
                            <i className="fa-solid fa-xmark text-xl"></i>
                        </button>
                    ) : (
                        <div className="relative group cursor-pointer active:scale-95 transition-transform" onClick={onOpenProfile}>
                            <Avatar 
                                src={user.face_ref_url} 
                                name={user.name} 
                                className="w-12 h-12 ring-2 ring-white dark:ring-slate-700 shadow-sm" 
                                textSize="text-sm"
                            />
                            {/* Online Status Dot */}
                            <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 ring-2 ring-white dark:ring-slate-900 rounded-full"></div>
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
