
import React from 'react';

interface Props {
  onSelectMode: (mode: 'app' | 'admin') => void;
  onLogout: () => void;
}

const AdminModeSelection: React.FC<Props> = ({ onSelectMode, onLogout }) => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans transition-colors duration-300">
         <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-50 dark:bg-emerald-900/20 rounded-full blur-3xl opacity-60 pointer-events-none"></div>
         <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-50 dark:bg-blue-900/20 rounded-full blur-3xl opacity-60 pointer-events-none"></div>

         <div className="relative z-10 w-full max-w-md animate-slide-up">
             <div className="text-center mb-10">
                 <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight mb-2">Xin chào, Admin</h1>
                 <p className="text-slate-500 dark:text-slate-400 font-medium">Vui lòng chọn chế độ làm việc</p>
             </div>

             <div className="space-y-4">
                 <button 
                    onClick={() => onSelectMode('app')}
                    className="w-full bg-white dark:bg-slate-800 p-6 rounded-[24px] shadow-lg shadow-emerald-500/5 border border-slate-100 dark:border-slate-700 flex items-center gap-6 group hover:border-emerald-500/50 transition-all active:scale-[0.98]"
                 >
                     <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-2xl group-hover:bg-emerald-500 group-hover:text-white transition-colors shadow-sm">
                         <i className="fa-solid fa-mobile-screen"></i>
                     </div>
                     <div className="text-left">
                         <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1 group-hover:text-emerald-700 dark:group-hover:text-emerald-400">Ứng dụng Chấm công</h3>
                         <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Giao diện mobile cho việc check-in, check-out và xem báo cáo cá nhân.</p>
                     </div>
                 </button>

                 <button 
                    onClick={() => onSelectMode('admin')}
                    className="w-full bg-slate-800 dark:bg-slate-700 p-6 rounded-[24px] shadow-lg shadow-slate-800/20 border border-slate-700 flex items-center gap-6 group hover:bg-slate-900 dark:hover:bg-slate-600 transition-all active:scale-[0.98]"
                 >
                     <div className="w-16 h-16 rounded-2xl bg-slate-700 dark:bg-slate-800 text-slate-300 flex items-center justify-center text-2xl group-hover:text-white transition-colors shadow-inner">
                         <i className="fa-solid fa-database"></i>
                     </div>
                     <div className="text-left">
                         <h3 className="text-lg font-bold text-white mb-1">Quản trị Dữ liệu</h3>
                         <p className="text-xs text-slate-400 font-medium">Giao diện Desktop (CMS) để quản lý toàn bộ cơ sở dữ liệu hệ thống.</p>
                     </div>
                 </button>
             </div>
             
             <button onClick={onLogout} className="mt-10 text-slate-400 text-sm font-bold hover:text-red-500 transition-colors">
                 <i className="fa-solid fa-arrow-right-from-bracket mr-2"></i> Đăng xuất
             </button>
         </div>
    </div>
  );
};

export default AdminModeSelection;
