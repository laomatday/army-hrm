
import React from 'react';
import { Employee } from '../types';

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
                ? 'bg-emerald-600 dark:bg-emerald-500 text-white translate-y-[-4px]' 
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
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
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] transition-all duration-300 ease-out ${isVisible ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-[200%] opacity-0 scale-95'}`}>
      <div className="bg-white dark:bg-slate-800 rounded-full shadow-[0_20px_40px_-10px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.4)] flex items-center justify-between px-2 py-2 border border-slate-100/80 dark:border-slate-700/80 gap-1.5 backdrop-blur-md bg-opacity-90 dark:bg-opacity-90">
          
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
                ? 'bg-emerald-600 dark:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 dark:shadow-emerald-900/30 translate-y-[-4px]' 
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
            }`}
          >
               <i className={`text-xl z-10 relative ${isNotiActive ? 'fa-solid' : 'fa-regular'} fa-bell ${notiCount > 0 && !isNotiActive ? 'animate-bell-shake origin-top' : ''}`}></i>
               {notiCount > 0 && !isNotiActive && (
                    <span className="absolute top-2.5 right-2.5 bg-red-500 text-white text-[9px] font-extrabold px-1 h-3.5 min-w-[14px] flex items-center justify-center rounded-full ring-2 ring-white dark:ring-slate-800 shadow-sm animate-pulse z-20 leading-none">
                    {notiCount > 9 ? '9+' : notiCount}
                    </span>
                )}
          </button>
      </div>
   </div>
  );
};

export default BottomNav;