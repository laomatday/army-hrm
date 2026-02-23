import React from 'react';
import { Employee } from '../../types';

export type TabType = 'home' | 'history' | 'requests' | 'contacts' | 'profile' | 'manager' | 'notifications';

interface Props {
  activeTab: TabType;
  onChange: (tab: TabType) => void;
  isVisible: boolean;
  user: Employee;
  notiCount: number;
  onOpenNoti: () => void;
}

// GIẢI PHÁP: Đưa NavItem ra ngoài để React không hủy/tạo lại nó mỗi lần render
const NavItem = ({ name, icon, activeIcon, activeTab, onChange }: { name: TabType, icon: string, activeIcon: string, activeTab: TabType, onChange: (t: TabType) => void }) => {
    const isActive = activeTab === name;
    return (
        <button 
            onClick={() => onChange(name)} 
            className={`relative flex items-center justify-center w-12 h-12 rounded-full transition-all duration-300 active:scale-90 ${
                isActive 
                ? 'bg-primary text-neutral-white translate-y-[-4px]' 
                : 'text-slate-400 dark:text-dark-text-secondary hover:text-slate-600 dark:hover:text-dark-text-primary hover:bg-slate-50 dark:hover:bg-dark-border/50'
            }`}
        >
            <i className={`${isActive ? activeIcon : icon} text-xl z-10 relative`}></i>
        </button>
    );
};

const BottomNav: React.FC<Props> = ({ activeTab, onChange, isVisible, user, notiCount, onOpenNoti }) => {
  const isManagerOrAdmin = ['Admin', 'Manager'].includes(user.role || '');
  
  // Notification styling check
  const isNotiActive = activeTab === 'notifications';

  return (
    <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] transition-all duration-500 ease-out ${isVisible ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-[200%] opacity-0 scale-90'}`}>
      <div className="bg-neutral-white/90 dark:bg-dark-surface/90 rounded-[28px] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.15)] dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] flex items-center justify-between px-2.5 py-2.5 border border-white/20 dark:border-dark-border gap-2 backdrop-blur-2xl">
          
          <NavItem name="home" icon="fa-solid fa-house" activeIcon="fa-solid fa-house" activeTab={activeTab} onChange={onChange} />
          <NavItem name="history" icon="fa-regular fa-calendar" activeIcon="fa-solid fa-calendar-days" activeTab={activeTab} onChange={onChange} />
          <NavItem name="requests" icon="fa-regular fa-file-lines" activeIcon="fa-solid fa-file-lines" activeTab={activeTab} onChange={onChange} />
          <NavItem name="contacts" icon="fa-solid fa-users" activeIcon="fa-solid fa-users" activeTab={activeTab} onChange={onChange} />
          
          {isManagerOrAdmin && (
             <NavItem name="manager" icon="fa-solid fa-briefcase" activeIcon="fa-solid fa-briefcase" activeTab={activeTab} onChange={onChange} />
          )}

          <button 
            onClick={onOpenNoti} 
            className={`relative flex items-center justify-center w-12 h-12 rounded-full transition-all duration-300 active:scale-90 ${
                isNotiActive 
                ? 'bg-primary text-neutral-white shadow-lg shadow-primary/30 translate-y-[-4px]' 
                : 'text-slate-400 dark:text-dark-text-secondary hover:text-slate-600 dark:hover:text-dark-text-primary hover:bg-slate-50 dark:hover:bg-dark-border/50'
            }`}
          >
               <i className={`text-xl z-10 relative ${isNotiActive ? 'fa-solid' : 'fa-regular'} fa-bell ${notiCount > 0 && !isNotiActive ? 'animate-bell-shake origin-top' : ''}`}></i>
               {notiCount > 0 && !isNotiActive && (
                    <span className="absolute top-2.5 right-2.5 bg-secondary-red text-neutral-white text-[9px] font-extrabold px-1 h-3.5 min-w-[14px] flex items-center justify-center rounded-full ring-2 ring-neutral-white dark:ring-dark-surface shadow-sm animate-pulse z-20 leading-none">
                    {notiCount > 9 ? '9+' : notiCount}
                    </span>
                )}
          </button>
      </div>
   </div>
  );
};

export default BottomNav;