import React, { useState } from 'react';
import { doLogin } from '../services/api';
import { getDeviceId, triggerHaptic } from '../utils/helpers';
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
      triggerHaptic('success');
      onLoginSuccess(res.data);
    } else {
      triggerHaptic('error');
      setError(res.message || "Đăng nhập thất bại");
    }
  };

  const LOGO_URL = "https://firebasestorage.googleapis.com/v0/b/army-hrm-70615.firebasestorage.app/o/logo%2Flogo.png?alt=media";

  return (
    <div className="w-full h-full bg-slate-50 dark:bg-slate-900 flex flex-col justify-between p-8 relative overflow-hidden font-sans transition-colors duration-300">
      {/* Background Decor */}
      <div className="absolute top-[-20%] right-[-20%] w-[80%] h-[50%] bg-emerald-500/10 dark:bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[60%] h-[40%] bg-blue-500/10 dark:bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>

      <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full z-10 animate-slide-up">
        {/* Brand */}
        <div className="mb-12 flex flex-col items-center">
           <div className="w-40 h-40 mb-8 relative shadow-2xl shadow-emerald-500/10 rounded-[2.5rem] bg-white dark:bg-slate-800 p-2 flex items-center justify-center border border-slate-100 dark:border-slate-700 transform hover:scale-105 transition-transform duration-500">
              <img 
                src={LOGO_URL} 
                className="w-full h-full object-contain" 
                alt="Army HRM Logo" 
              />
           </div>
           <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">Xin chào,</h1>
           <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium text-base tracking-wide">Đăng nhập để bắt đầu làm việc</p>
        </div>

        {/* Form */}
        <form 
            className="space-y-6"
            onSubmit={(e) => {
                e.preventDefault();
                handleLogin();
            }}
        >
          {error && (
            <div className="flex items-center gap-3 bg-red-50 dark:bg-red-900/20 p-4 rounded-2xl border border-red-100 dark:border-red-900/30 animate-scale-in">
                <i className="fa-solid fa-circle-exclamation text-red-500 dark:text-red-400 text-lg"></i>
                <span className="text-red-600 dark:text-red-400 text-sm font-bold">{error}</span>
            </div>
          )}
          
          <div className="space-y-2">
            <label className="text-xs font-extrabold text-slate-400 uppercase ml-1 tracking-wider">Tài khoản</label>
            <div className="relative group">
                <i className="fa-solid fa-user absolute left-4 top-4 text-slate-400 group-focus-within:text-emerald-600 dark:group-focus-within:text-emerald-500 transition-colors text-base"></i>
                <input 
                  type="text" 
                  value={email}
                  inputMode="email"
                  enterKeyHint="next"
                  autoComplete="username"
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white font-bold text-base outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600 placeholder:font-semibold shadow-sm tracking-tight" 
                  placeholder="Mã nhân viên / Email" 
                />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-extrabold text-slate-400 uppercase ml-1 tracking-wider">Mật khẩu</label>
            <div className="relative group">
                <i className="fa-solid fa-lock absolute left-4 top-4 text-slate-400 group-focus-within:text-emerald-600 dark:group-focus-within:text-emerald-500 transition-colors text-base"></i>
                <input 
                  type="password" 
                  value={password}
                  enterKeyHint="go"
                  autoComplete="current-password"
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white font-bold text-base outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600 placeholder:font-semibold shadow-sm tracking-widest" 
                  placeholder="••••••••" 
                />
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full mt-4 bg-emerald-600 text-white shadow-xl shadow-emerald-600/20 py-4 rounded-2xl font-extrabold text-base hover:bg-emerald-700 active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 uppercase tracking-widest"
          >
            {loading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <span>Đăng Nhập</span>}
            {!loading && <i className="fa-solid fa-arrow-right text-base"></i>}
          </button>
        </form>
      </div>

      <div className="text-center pb-safe z-10">
        <p className="text-[10px] text-slate-300 dark:text-slate-600 font-extrabold uppercase tracking-widest">Army HRM © 2026 Enterprise</p>
      </div>
    </div>
  );
};

export default LoginView;