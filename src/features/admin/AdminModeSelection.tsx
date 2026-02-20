
import React from 'react';
import { Employee } from '../../shared/types';
import { db } from '../../shared/services/firebase';

interface AdminModeSelectionProps {
  onSelectMode: (mode: 'app' | 'admin' | 'kiosk') => void;
  onLogout: () => void;
}

export default function AdminModeSelection({ onSelectMode, onLogout }: AdminModeSelectionProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900 p-4 animate-fade-in">
      <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="p-8 text-center">
          <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <img 
              src="https://firebasestorage.googleapis.com/v0/b/army-hrm-70615.firebasestorage.app/o/logo%2Flogo.png?alt=media" 
              alt="Logo" 
              className="w-12 h-12 object-contain"
            />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Army HRM V2026</h2>
          <p className="text-slate-500 dark:text-slate-400 mb-8">Chọn chế độ truy cập</p>

          <div className="space-y-4">
            <button
              onClick={() => onSelectMode('app')}
              className="w-full p-4 flex items-center bg-slate-50 dark:bg-slate-700/50 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 border-2 border-transparent hover:border-emerald-500 rounded-xl transition-all group"
            >
              <div className="w-12 h-12 bg-white dark:bg-slate-700 rounded-lg shadow-sm flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                <i className="fa-solid fa-mobile-screen text-emerald-600 dark:text-emerald-400 text-xl"></i>
              </div>
              <div className="text-left">
                <div className="font-bold text-slate-800 dark:text-white">Ứng dụng Cá nhân</div>
                <div className="text-sm text-slate-500 dark:text-slate-400">Chấm công, xem lịch sử, thông báo</div>
              </div>
            </button>

            <button
              onClick={() => onSelectMode('admin')}
              className="w-full p-4 flex items-center bg-slate-50 dark:bg-slate-700/50 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 border-2 border-transparent hover:border-emerald-500 rounded-xl transition-all group"
            >
              <div className="w-12 h-12 bg-white dark:bg-slate-700 rounded-lg shadow-sm flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                <i className="fa-solid fa-chart-pie text-emerald-600 dark:text-emerald-400 text-xl"></i>
              </div>
              <div className="text-left">
                <div className="font-bold text-slate-800 dark:text-white">Quản trị Hệ thống</div>
                <div className="text-sm text-slate-500 dark:text-slate-400">Duyệt đơn, báo cáo, nhân sự</div>
              </div>
            </button>
            
            <button
              onClick={() => onSelectMode('kiosk')}
              className="w-full p-4 flex items-center bg-slate-50 dark:bg-slate-700/50 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 border-2 border-transparent hover:border-emerald-500 rounded-xl transition-all group"
            >
              <div className="w-12 h-12 bg-white dark:bg-slate-700 rounded-lg shadow-sm flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                <i className="fa-solid fa-camera text-emerald-600 dark:text-emerald-400 text-xl"></i>
              </div>
              <div className="text-left">
                <div className="font-bold text-slate-800 dark:text-white">Station Mode (Kiosk)</div>
                <div className="text-sm text-slate-500 dark:text-slate-400">Biến thiết bị này thành máy chấm công</div>
              </div>
            </button>
          </div>
        </div>
        
        <div className="bg-slate-50 dark:bg-slate-700/30 p-4 text-center border-t border-slate-100 dark:border-slate-700">
          <button 
            onClick={onLogout}
            className="text-slate-500 hover:text-red-500 text-sm font-medium transition-colors"
          >
            Đăng xuất tài khoản
          </button>
        </div>
      </div>
    </div>
  );
}
