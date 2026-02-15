import React, { useState } from 'react';
import { DashboardData } from '../types';
import { getAvatarHtml } from '../utils/helpers';

interface Props {
  data: DashboardData | null;
}

const TabContacts: React.FC<Props> = ({ data }) => {
  const [term, setTerm] = useState('');
  
  const contacts = data?.contacts || [];
  const filtered = contacts.filter(c => 
      c.name.toLowerCase().includes(term.toLowerCase()) || 
      String(c.phone).includes(term) ||
      c.department.toLowerCase().includes(term.toLowerCase())
  );

  return (
    <div className="absolute inset-0 overflow-y-auto no-scrollbar pt-safe pb-32 px-4 bg-slate-50">
        <h3 className="pt-24 text-xl font-bold text-slate-800 mb-6 px-1 tracking-tight">Danh bạ nhân viên</h3>
        
        <div className="mb-6 relative group">
             <i className="fa-solid fa-search absolute left-4 top-3.5 text-slate-400 text-sm group-focus-within:text-emerald-500 transition-colors"></i>
             <input type="text" placeholder="Tìm kiếm tên, phòng ban..." 
                className="w-full bg-white pl-11 pr-4 py-3.5 rounded-2xl border border-slate-200 shadow-sm text-sm font-medium outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all placeholder:text-slate-400"
                value={term} onChange={e => setTerm(e.target.value)}
             />
        </div>

        <div className="space-y-3">
            {filtered.map(c => {
                const ava = getAvatarHtml(c.name, c.face_ref_url);
                return (
                    <div key={c.employee_id} className="bg-white p-3.5 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 flex items-center gap-4 transition-transform active:scale-[0.99]">
                        <div className="flex-shrink-0 relative">
                             {ava.type === 'img' ? (
                                 <img src={ava.src} className="w-12 h-12 rounded-2xl object-cover bg-slate-100 shadow-sm" />
                             ) : (
                                 <div className="w-12 h-12 rounded-2xl bg-slate-800 text-white flex items-center justify-center font-bold text-sm shadow-sm">{ava.text}</div>
                             )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-bold text-slate-800 truncate">{c.name}</h4>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{c.department}</span>
                                <span className="text-[10px] text-slate-400 truncate">• {c.position}</span>
                            </div>
                        </div>
                        <a href={`tel:${c.phone}`} className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center active:scale-95 transition-all hover:bg-emerald-100 shadow-sm">
                            <i className="fa-solid fa-phone text-sm"></i>
                        </a>
                    </div>
                );
            })}
        </div>
    </div>
  );
};
export default TabContacts;