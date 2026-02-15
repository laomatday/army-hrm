import React from 'react';
import { Employee } from '../types';
import { getAvatarHtml } from '../utils/helpers';

interface Props {
  user: Employee;
  locations: any[];
  onLogout: () => void;
  onUpdate: () => void;
}

const TabProfile: React.FC<Props> = ({ user, onLogout }) => {
  const ava = getAvatarHtml(user.name, user.face_ref_url, "w-20 h-20", "text-xl");

  return (
    <div className="absolute inset-0 overflow-y-auto no-scrollbar pt-safe pb-32 px-4 bg-slate-50">
        
        {/* Profile Header Card */}
        <div className="mt-24 bg-white rounded-[32px] p-8 shadow-lg shadow-slate-200/50 border border-slate-100 text-center relative overflow-hidden mb-8">
             <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-br from-emerald-500/10 to-blue-500/10 rounded-t-[32px]"></div>
             
             <div className="relative z-10 flex flex-col items-center">
                 <div className="w-28 h-28 rounded-full p-1.5 bg-white shadow-xl shadow-slate-200 mb-4 mt-2">
                     {ava.type === 'img' ? (
                         <img src={ava.src} className="w-full h-full rounded-full object-cover" />
                     ) : (
                         <div className="w-full h-full rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-3xl">{ava.text}</div>
                     )}
                 </div>
                 <h2 className="text-2xl font-black text-slate-800 tracking-tight">{user.name}</h2>
                 <p className="text-sm text-slate-500 font-bold mt-1">{user.position}</p>
                 
                 <div className="mt-5 flex gap-2">
                     <span className="px-4 py-1.5 bg-slate-100 border border-slate-200 rounded-full text-[10px] font-bold text-slate-600 uppercase tracking-wider">{user.role}</span>
                     <span className="px-4 py-1.5 bg-emerald-50 border border-emerald-100 rounded-full text-[10px] font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1">
                         <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                         {user.status}
                     </span>
                 </div>
             </div>
        </div>

        {/* Info Grid */}
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 px-2">Thông tin cá nhân</h3>
        <div className="grid grid-cols-1 gap-3 mb-8">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                 <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center"><i className="fa-solid fa-id-card"></i></div>
                 <div>
                     <p className="text-[10px] font-bold text-slate-400 uppercase">Mã nhân viên</p>
                     <p className="text-sm font-bold text-slate-800">{user.employee_id}</p>
                 </div>
            </div>
            
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                 <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center"><i className="fa-solid fa-building-user"></i></div>
                 <div>
                     <p className="text-[10px] font-bold text-slate-400 uppercase">Phòng ban</p>
                     <p className="text-sm font-bold text-slate-800">{user.department}</p>
                 </div>
            </div>

            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                 <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center"><i className="fa-solid fa-envelope"></i></div>
                 <div className="overflow-hidden">
                     <p className="text-[10px] font-bold text-slate-400 uppercase">Email</p>
                     <p className="text-sm font-bold text-slate-800 truncate">{user.email}</p>
                 </div>
            </div>

             <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                 <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center"><i className="fa-solid fa-phone"></i></div>
                 <div>
                     <p className="text-[10px] font-bold text-slate-400 uppercase">Số điện thoại</p>
                     <p className="text-sm font-bold text-slate-800">{String(user.phone)}</p>
                 </div>
            </div>

            {user.direct_manager_id && (
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center"><i className="fa-solid fa-user-tie"></i></div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Quản lý trực tiếp</p>
                        <p className="text-sm font-bold text-slate-800">{user.direct_manager_id}</p>
                    </div>
                </div>
            )}
            
            {user.join_date && (
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center"><i className="fa-solid fa-calendar-check"></i></div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Ngày gia nhập</p>
                        <p className="text-sm font-bold text-slate-800">{user.join_date.split('T')[0]}</p>
                    </div>
                </div>
            )}
        </div>

        <button onClick={onLogout} className="w-full bg-white border border-red-100 text-red-500 font-bold py-4 rounded-2xl shadow-sm hover:bg-red-50 hover:shadow-md transition-all flex items-center justify-center gap-2 mb-8">
            <i className="fa-solid fa-arrow-right-from-bracket"></i>
            Đăng xuất
        </button>
        
        <p className="text-center text-[10px] text-slate-300 font-bold uppercase tracking-widest pb-10">
            Army HRM SaaS • v2026.1.0
        </p>
    </div>
  );
};
export default TabProfile;