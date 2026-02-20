
import React, { useState, useMemo } from 'react';
import { DashboardData, Employee, LeaveRequest, Explanation } from '../../shared/types';
import { processRequest, processExplanation } from '../../shared/services/api';
import { formatDateString, triggerHaptic } from '../../shared/utils/helpers';
import Avatar from '../../shared/components/Avatar';
import PullToRefresh from '../../shared/components/PullToRefresh';

interface Props {
  data: DashboardData | null;
  user: Employee;
  onRefresh: () => Promise<void>;
  onAlert: (title: string, msg: string, type: 'success' | 'error') => void;
  currentDate: Date;
}

const TabManager: React.FC<Props> = ({ data, user, onRefresh, onAlert, currentDate }) => {
  const [processing, setProcessing] = useState<string | null>(null);
  
  // Rejection Modal State
  const [rejectModal, setRejectModal] = useState<{
      isOpen: boolean;
      docId: string;
      type: 'leave' | 'explanation';
      reason: string;
  }>({ isOpen: false, docId: '', type: 'leave', reason: '' });

  const contacts = data?.contacts || [];
  const teamLeaves = data?.teamLeaves || [];
  const approvals = data?.notifications.approvals || [];
  const explanationApprovals = data?.notifications.explanationApprovals || [];

  const locationsMap = useMemo(() => {
      const map: Record<string, string> = {};
      data?.locations.forEach(l => map[l.center_id] = l.location_name);
      return map;
  }, [data?.locations]);

  // --- CALENDAR LOGIC ---
  const generateCalendar = () => {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const firstDay = new Date(year, month, 1).getDay();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      
      const days = [];
      for (let i = 0; i < firstDay; i++) days.push(null);
      for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));
      
      return days;
  };

  const getLeavesForDate = (date: Date) => {
      const dateStr = date.toISOString().split('T')[0];
      return teamLeaves.filter(l => l.from_date <= dateStr && l.to_date >= dateStr);
  };

  // --- APPROVAL GROUPING LOGIC ---
  const groupedApprovals = useMemo(() => {
      const allItems = [
          ...approvals.map(a => ({ ...a, itemType: 'leave' as const })),
          ...explanationApprovals.map(e => ({ ...e, itemType: 'explanation' as const }))
      ];

      const groups: Record<string, Record<string, any[]>> = {};

      allItems.forEach(item => {
          const emp = contacts.find(c => c.employee_id === item.employee_id);
          const centerId = emp?.center_id || 'Unknown Center';
          const centerName = locationsMap[centerId] || centerId;
          const teamName = emp?.department || 'Khác';

          if (!groups[centerName]) groups[centerName] = {};
          if (!groups[centerName][teamName]) groups[centerName][teamName] = [];

          groups[centerName][teamName].push({ ...item, emp });
      });

      return groups;
  }, [approvals, explanationApprovals, contacts, locationsMap]);

  // --- ACTIONS ---
  const handleAction = async (docId: string, status: 'Approved' | 'Rejected', type: 'leave' | 'explanation') => {
      triggerHaptic('medium');
      if (status === 'Rejected') {
          setRejectModal({ isOpen: true, docId, type, reason: '' });
          return;
      }

      setProcessing(docId);
      const managerNote = `Duyệt bởi ${user.name}`;
      
      let res;
      if (type === 'leave') {
          res = await processRequest(docId, status, managerNote);
      } else {
          res = await processExplanation(docId, status, managerNote);
      }
      
      setProcessing(null);
      
      if(res.success) {
          onAlert("Thành công", "Đã duyệt yêu cầu.", "success");
          onRefresh();
      } else {
          onAlert("Lỗi", res.message || "Có lỗi xảy ra", "error");
      }
  };

  const submitRejection = async () => {
      if (!rejectModal.docId) return;
      const { docId, type, reason } = rejectModal;
      
      setProcessing(docId);
      const managerNote = reason ? `${reason} (Từ chối bởi ${user.name})` : `Từ chối bởi ${user.name}`;

      let res;
      if (type === 'leave') {
          res = await processRequest(docId, 'Rejected', managerNote);
      } else {
          res = await processExplanation(docId, 'Rejected', managerNote);
      }

      setProcessing(null);
      setRejectModal({ ...rejectModal, isOpen: false });

      if (res.success) {
          onAlert("Thành công", "Đã từ chối yêu cầu.", "success");
          onRefresh();
      } else {
           onAlert("Lỗi", res.message || "Có lỗi xảy ra", "error");
      }
  };

  const renderDateRange = (from: string, to: string) => {
      if (!from || !to) return "N/A";
      const dateFromStr = formatDateString(from.split('T')[0]);
      const dateToStr = formatDateString(to.split('T')[0]);
      if (from.split('T')[0] === to.split('T')[0]) return dateFromStr;
      return `${dateFromStr} - ${dateToStr}`;
  };

  const totalPending = approvals.length + explanationApprovals.length;

  return (
    <PullToRefresh onRefresh={onRefresh} className="bg-slate-50 dark:bg-slate-900 font-sans">
        <div className="pt-28 pb-32 px-4 animate-fade-in space-y-8">
            
            {/* --- SECTION 1: CALENDAR --- */}
            <div>
                 {/* Calendar Title - Consistent Style */}
                 <h4 className="text-[11px] font-extrabold text-emerald-700 dark:text-emerald-400 uppercase mb-3 ml-1 tracking-widest">
                     Lịch nghỉ nhân viên
                 </h4>

                 <div className="bg-white dark:bg-slate-800 p-4 rounded-[24px] shadow-sm border border-slate-100 dark:border-slate-700">
                     <div className="grid grid-cols-7 mb-3">
                        {["CN", "T2", "T3", "T4", "T5", "T6", "T7"].map((d, i) => (
                            <div key={i} className="text-center text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wide">{d}</div>
                        ))}
                     </div>

                     <div className="grid grid-cols-7 gap-1">
                         {generateCalendar().map((date, idx) => {
                             if (!date) return <div key={idx} className="h-16 bg-slate-50/30 dark:bg-slate-700/30 rounded-lg"></div>;
                             
                             const leaves = getLeavesForDate(date);
                             const isToday = date.toDateString() === new Date().toDateString();

                             return (
                                 <div key={idx} className={`h-16 p-1 border rounded-xl flex flex-col items-center justify-start overflow-hidden ${isToday ? 'border-emerald-200 bg-emerald-50/30 dark:bg-emerald-900/20 dark:border-emerald-900/50' : 'border-slate-50 dark:border-slate-700 bg-white dark:bg-slate-800'}`}>
                                     <span className={`text-[10px] font-extrabold mb-1 tracking-tight ${date.getDay() === 0 ? 'text-red-500 dark:text-red-400' : 'text-slate-600 dark:text-slate-300'}`}>{date.getDate()}</span>
                                     <div className="w-full flex flex-col gap-0.5">
                                         {leaves.map((l, i) => (
                                             <div key={i} className="w-full h-1.5 rounded-full bg-purple-500 dark:bg-purple-400 opacity-80" title={l.name}></div>
                                         ))}
                                         {leaves.length > 0 && <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500 leading-none text-center">+{leaves.length}</span>}
                                     </div>
                                 </div>
                             );
                         })}
                     </div>
                     <div className="mt-3 text-[10px] font-bold text-slate-400 dark:text-slate-500 text-center uppercase tracking-wide">
                        * Hiển thị lịch nghỉ của nhân viên thuộc quyền quản lý.
                     </div>
                 </div>
            </div>

            {/* --- SECTION 2: APPROVALS --- */}
            <div>
                {/* Approval Header - Consistent Style */}
                <h4 className="text-[11px] font-extrabold text-emerald-700 dark:text-emerald-400 uppercase mb-3 ml-1 tracking-widest flex items-center gap-2">
                    Cần duyệt 
                    {totalPending > 0 && (
                        <span className={`bg-red-500 text-white text-[10px] font-bold h-5 flex items-center justify-center rounded-full shadow-sm shadow-red-200 dark:shadow-red-900/50 ${totalPending < 10 ? 'w-5' : 'px-1.5 min-w-[20px]'}`}>
                            {totalPending}
                        </span>
                    )}
                </h4>

                {totalPending === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-600 opacity-60 bg-white dark:bg-slate-800 rounded-[24px] border border-dashed border-slate-200 dark:border-slate-700">
                        <div className="w-16 h-16 bg-slate-50 dark:bg-slate-700 rounded-full flex items-center justify-center mb-3">
                            <i className="fa-solid fa-clipboard-check text-2xl text-slate-300 dark:text-slate-500"></i>
                        </div>
                        <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Đã xử lý hết yêu cầu</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {Object.keys(groupedApprovals).map(centerName => (
                            <div key={centerName} className="animate-slide-up">
                                <div className="flex items-center gap-2 mb-3 px-1">
                                    <i className="fa-solid fa-location-dot text-emerald-500 text-xs"></i>
                                    <h4 className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{centerName}</h4>
                                </div>
                                
                                <div className="space-y-4">
                                    {Object.keys(groupedApprovals[centerName]).map(teamName => (
                                        <div key={teamName} className="pl-3 border-l-2 border-slate-100 dark:border-slate-700">
                                            <h5 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-2 pl-1 tracking-wider">{teamName}</h5>
                                            <div className="space-y-3">
                                                {groupedApprovals[centerName][teamName].map((item: any) => {
                                                    const isLeave = item.itemType === 'leave';
                                                    const typeLabel = isLeave ? item.type : 'Giải trình công';
                                                    const typeColor = isLeave 
                                                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30' 
                                                        : 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 border border-orange-100 dark:border-orange-900/30';
                                                    const dateInfo = isLeave 
                                                        ? renderDateRange(item.from_date, item.to_date)
                                                        : formatDateString(item.date?.split('T')[0]);

                                                    return (
                                                        <div key={item.id} className="bg-white dark:bg-slate-800 p-4 rounded-[20px] shadow-sm border border-slate-100 dark:border-slate-700 relative group active:scale-[0.99] transition-all">
                                                            <div className="flex justify-between items-start mb-3">
                                                                <div className="flex items-center gap-3">
                                                                    <Avatar 
                                                                        src={item.face_ref_url} 
                                                                        name={item.name} 
                                                                        className="w-10 h-10 rounded-xl"
                                                                        textSize="text-xs"
                                                                    />
                                                                    <div>
                                                                        <h6 className="font-bold text-slate-800 dark:text-white text-sm">{item.name}</h6>
                                                                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border uppercase tracking-widest ${typeColor}`}>
                                                                            {typeLabel}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <span className="text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500">{formatDateString(item.created_at?.split('T')[0])}</span>
                                                            </div>

                                                            <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700 mb-3">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <i className="fa-regular fa-clock text-slate-400 dark:text-slate-500 text-xs"></i>
                                                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{dateInfo}</span>
                                                                </div>
                                                                <p className="text-xs text-slate-600 dark:text-slate-400 italic">"{item.reason}"</p>
                                                            </div>

                                                            <div className="grid grid-cols-2 gap-3">
                                                                <button 
                                                                    disabled={!!processing}
                                                                    onClick={() => handleAction(item.id, 'Rejected', item.itemType)}
                                                                    className="py-2.5 bg-white dark:bg-slate-800 border border-red-100 dark:border-red-900/30 text-red-500 dark:text-red-400 rounded-xl text-xs font-bold hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors uppercase tracking-wide"
                                                                >
                                                                    Từ chối
                                                                </button>
                                                                <button 
                                                                    disabled={!!processing}
                                                                    onClick={() => handleAction(item.id, 'Approved', item.itemType)}
                                                                    className="py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-200 dark:shadow-emerald-900/20 flex items-center justify-center gap-2 uppercase tracking-wide"
                                                                >
                                                                    {processing === item.id ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <span>Duyệt ngay</span>}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>

        {/* REJECTION REASON MODAL */}
        {rejectModal.isOpen && (
             <div className="fixed inset-0 z-[2100] bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in">
                 <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-sm shadow-2xl p-6 animate-scale-in">
                     <div className="text-center mb-6">
                         <div className="w-14 h-14 bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-100 dark:border-red-900/30">
                             <i className="fa-solid fa-triangle-exclamation text-xl"></i>
                         </div>
                         <h3 className="text-lg font-extrabold text-slate-800 dark:text-white tracking-tight">Từ chối yêu cầu?</h3>
                         <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Nhập lý do để nhân viên biết nguyên nhân.</p>
                     </div>

                     <textarea 
                        className="w-full h-24 p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none resize-none mb-4 placeholder:text-slate-400 text-slate-800 dark:text-white"
                        placeholder="Lý do từ chối..."
                        value={rejectModal.reason}
                        onChange={(e) => setRejectModal({...rejectModal, reason: e.target.value})}
                     ></textarea>

                     <div className="flex gap-3">
                         <button 
                            onClick={() => setRejectModal({...rejectModal, isOpen: false})}
                            className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors uppercase tracking-wide"
                         >
                             Hủy
                         </button>
                         <button 
                            onClick={submitRejection}
                            disabled={!rejectModal.reason.trim()}
                            className="flex-1 py-3 rounded-xl bg-red-500 text-white text-sm font-bold shadow-lg shadow-red-200 dark:shadow-red-900/20 hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wide"
                         >
                             Xác nhận
                         </button>
                     </div>
                 </div>
             </div>
        )}
    </PullToRefresh>
  );
};

export default TabManager;
