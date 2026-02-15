import React, { useState } from 'react';
import { doLogin } from '../services/api';
import { getDeviceId } from '../utils/helpers';
import { Employee } from '../types';

interface Props {
  onLoginSuccess: (user: Employee) => void;
}

const LoginView: React.FC<Props> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!email || !password) {
      setError("Vui lòng nhập thông tin đăng nhập");
      return;
    }
    setError('');
    setLoading(true);
    
    const deviceId = getDeviceId();
    const res = await doLogin(email, password, deviceId);
    
    setLoading(false);
    if (res.success && res.data) {
      onLoginSuccess(res.data);
    } else {
      setError(res.message || "Đăng nhập thất bại");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
        handleLogin();
    }
  };

  return (
    <div className="w-full h-full bg-white flex flex-col justify-between p-8 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute -top-20 -right-20 w-80 h-80 bg-emerald-50 rounded-full blur-3xl opacity-60 pointer-events-none"></div>
      <div className="absolute top-40 -left-20 w-60 h-60 bg-blue-50 rounded-full blur-3xl opacity-60 pointer-events-none"></div>

      <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full z-10 animate-slide-up">
        {/* Brand */}
        <div className="mb-12">
           <div className="w-14 h-14 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200 mb-6">
              <i className="fa-solid fa-layer-group text-2xl text-white"></i>
           </div>
           <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Chào mừng trở lại</h1>
           <p className="text-slate-500 mt-2 font-medium text-sm">Đăng nhập để tiếp tục vào Army HRM</p>
        </div>

        {/* Form */}
        <div className="space-y-5">
          {error && (
            <div className="flex items-center gap-3 bg-red-50 p-3 rounded-xl border border-red-100">
                <i className="fa-solid fa-circle-exclamation text-red-500"></i>
                <span className="text-red-600 text-xs font-bold">{error}</span>
            </div>
          )}
          
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2 block">Tài khoản</label>
            <input 
              type="text" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold text-sm outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all placeholder:text-slate-400" 
              placeholder="nhanvien@armyhrm.com" 
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2 block">Mật khẩu</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold text-sm outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all placeholder:text-slate-400" 
              placeholder="••••••••" 
            />
          </div>

          <button 
            onClick={handleLogin}
            disabled={loading}
            className="w-full mt-4 bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 py-4 rounded-xl font-bold text-sm hover:bg-emerald-700 active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <span>Đăng Nhập</span>}
          </button>
        </div>
      </div>

      <div className="text-center pb-4 z-10">
        <p className="text-xs text-slate-400 font-semibold">Army HRM © 2026 Enterprise Edition</p>
      </div>
    </div>
  );
};

export default LoginView;