import React, { useState, useEffect } from 'react';
import { Employee, DashboardData } from '../types';
import { getDashboardData, doCheckIn, doCheckOut } from '../services/api';
import { getShortName, getDeviceId, getAvatarHtml } from '../utils/helpers';
import TabHome from './TabHome';
import TabHistory from './TabHistory';
// TabRequests is now used inside TabHistory
import TabContacts from './TabContacts';
import TabProfile from './TabProfile';
import ModalCamera from './ModalCamera';
import NotificationsModal from './NotificationsModal';

interface Props {
  user: Employee;
  onLogout: () => void;
}

const Dashboard: React.FC<Props> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'home' | 'requests' | 'contacts' | 'profile'>('home');
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCamera, setShowCamera] = useState(false);
  const [showNoti, setShowNoti] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(user);

  // Custom Modals State
  const [showCheckoutConfirm, setShowCheckoutConfirm] = useState(false);
  const [alertMessage, setAlertMessage] = useState<{title: string, msg: string, type: 'success' | 'error'} | null>(null);

  const fetchData = async () => {
    // Background refresh
    const res = await getDashboardData(currentUser);
    if (res.success && res.data) {
      setData(res.data);
      if(res.data.userProfile) setCurrentUser(res.data.userProfile);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleCheckIn = async (base64: string, lat: number, lng: number) => {
    setCheckingIn(true);
    setShowCamera(false);
    const res = await doCheckIn({
        employeeId: currentUser.employee_id,
        lat, lng, deviceId: getDeviceId(), imageBase64: base64
    }, currentUser);
    
    setCheckingIn(false);
    
    // Replace alert with custom modal
    setAlertMessage({
        title: res.success ? "Thành công" : "Lỗi",
        msg: res.message,
        type: res.success ? 'success' : 'error'
    });

    if(res.success) fetchData();
  };

  // Triggered by "Ra về" button
  const handleCheckOutClick = () => {
      setShowCheckoutConfirm(true);
  };

  // Actual Logic when user confirms
  const processCheckOut = async () => {
      setShowCheckoutConfirm(false);
      setCheckingIn(true);
      const res = await doCheckOut(currentUser.employee_id);
      setCheckingIn(false);
      
      // Replace alert with custom modal
      setAlertMessage({
          title: res.success ? "Thành công" : "Lỗi",
          msg: res.message,
          type: res.success ? 'success' : 'error'
      });

      if(res.success) fetchData();
  };

  const navItemClass = (tab: string) => `relative flex flex-col items-center justify-center w-14 h-14 rounded-2xl transition-all duration-300 ${activeTab === tab ? 'text-emerald-600 bg-emerald-50' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`;
  
  const avatarData = getAvatarHtml(currentUser.name, currentUser.face_ref_url, "w-10 h-10", "text-sm");
  const notiCount = (data?.notifications.approvals.length || 0) + (data?.notifications.myRequests.filter(r => r.status !== 'Pending').length || 0);

  if (loading) {
    return (
      <div className="h-full w-full bg-slate-50 relative flex flex-col overflow-hidden">
        {/* Skeleton Top Bar */}
        <div className="fixed top-0 left-0 w-full z-40 bg-slate-50/95 backdrop-blur-sm pt-safe px-6 pb-2 border-b border-transparent">
            <div className="flex justify-between items-center h-20">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-full bg-slate-200 animate-pulse"></div>
                  <div className="flex flex-col gap-2 justify-center">
                    <div className="w-14 h-2.5 bg-slate-200 rounded-full animate-pulse"></div>
                    <div className="w-24 h-4 bg-slate-200 rounded-full animate-pulse"></div>
                  </div>
                </div>
                <div className="w-11 h-11 rounded-full bg-slate-200 animate-pulse border border-slate-100"></div>
            </div>
        </div>

        {/* Skeleton Body (TabHome imitation) */}
        <div className="flex-1 flex flex-col items-center pt-32 px-6 overflow-hidden">
            {/* Clock Skeleton */}
            <div className="flex flex-col items-center mb-8 w-full">
                <div className="w-48 h-20 bg-slate-200 rounded-3xl animate-pulse mb-4 opacity-50"></div>
                <div className="w-32 h-7 bg-slate-200 rounded-full animate-pulse opacity-50"></div>
            </div>
            
            {/* Main Action Circle Skeleton */}
            <div className="relative w-full flex justify-center mb-10">
                 <div className="w-44 h-44 rounded-full bg-slate-100 border-4 border-slate-200 animate-pulse flex items-center justify-center shadow-inner">
                 </div>
            </div>

            {/* Stats Grid Skeleton */}
            <div className="w-full max-w-sm grid grid-cols-2 gap-4 mt-auto mb-32">
                <div className="h-36 bg-white rounded-[24px] border border-slate-100 p-5 shadow-sm animate-pulse">
                     <div className="w-8 h-8 rounded-full bg-slate-100 mb-6"></div>
                     <div className="w-16 h-8 bg-slate-100 rounded mb-2"></div>
                     <div className="w-full h-1.5 bg-slate-100 rounded-full"></div>
                </div>
                <div className="h-36 bg-white rounded-[24px] border border-slate-100 p-5 shadow-sm animate-pulse">
                     <div className="w-8 h-8 rounded-full bg-slate-100 mb-6"></div>
                     <div className="w-16 h-8 bg-slate-100 rounded mb-2"></div>
                     <div className="w-full h-1.5 bg-slate-100 rounded-full"></div>
                </div>
            </div>
        </div>

        {/* Skeleton Bottom Nav */}
        <div className="fixed bottom-6 left-0 w-full flex justify-center px-4 z-[300]">
             <div className="w-[310px] h-16 bg-white rounded-[24px] shadow-sm border border-slate-100 flex items-center justify-around px-2">
                 {[1,2,3,4].map(i => (
                     <div key={i} className="w-14 h-14 flex items-center justify-center">
                        <div className="w-6 h-6 bg-slate-100 rounded-lg animate-pulse"></div>
                     </div>
                 ))}
             </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-slate-50 relative flex flex-col">
       {/* Global Loader Overlay */}
       {checkingIn && (
         <div className="fixed inset-0 z-[999] bg-white/80 backdrop-blur-md flex flex-col items-center justify-center">
             <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-200 border-t-emerald-600"></div>
             <p className="mt-4 text-xs font-bold text-slate-500 uppercase tracking-wider animate-pulse">Đang đồng bộ...</p>
         </div>
       )}

       {/* Global Top Bar - Fixed & Styled like screenshot */}
       <div className="fixed top-0 left-0 w-full z-40 bg-slate-50/95 backdrop-blur-sm pt-safe px-6 pb-2 transition-all">
            <div className="flex justify-between items-center h-20">
                <div className="flex items-center gap-3.5 animate-fade-in">
                  <div className="relative group cursor-pointer active:scale-95 transition-transform" onClick={() => setActiveTab('profile')}>
                    {avatarData.type === 'img' ? (
                        <img src={avatarData.src} className="w-11 h-11 rounded-full object-cover ring-2 ring-white shadow-sm" />
                    ) : (
                        <div className="w-11 h-11 rounded-full bg-slate-800 text-white ring-2 ring-white shadow-sm flex items-center justify-center font-bold text-sm">{avatarData.text}</div>
                    )}
                    <div className="absolute bottom-0.5 right-0.5 w-3 h-3 bg-emerald-500 ring-2 ring-white rounded-full"></div>
                  </div>
                  <div className="flex flex-col justify-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">XIN CHÀO,</p>
                    <h2 className="text-xl font-black text-slate-800 leading-none tracking-tight">{getShortName(currentUser.name)}</h2>
                  </div>
                </div>
                
                <button onClick={() => setShowNoti(true)} className="w-11 h-11 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center relative hover:bg-slate-50 active:scale-90 transition-all">
                   <i className="fa-regular fa-bell text-slate-600 text-lg"></i>
                   {notiCount > 0 && <span className="absolute top-2.5 right-3 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white animate-pulse"></span>}
                </button>
            </div>
        </div>

       {/* Content Area - Adjusted top padding for fixed header */}
       <div className="flex-1 relative overflow-hidden bg-slate-50">
          {activeTab === 'home' && <TabHome data={data} loading={loading} onCheckIn={() => setShowCamera(true)} onCheckOut={handleCheckOutClick} onChangeTab={setActiveTab} />}
          {activeTab === 'requests' && <TabHistory data={data} user={currentUser} onRefresh={fetchData} />}
          {activeTab === 'contacts' && <TabContacts data={data} />}
          {activeTab === 'profile' && <TabProfile user={currentUser} locations={data?.locations || []} onLogout={onLogout} onUpdate={fetchData} />}
       </div>

       {/* Bottom Navigation */}
       {!showCamera && !showNoti && !showCheckoutConfirm && !alertMessage && (
       <div className="fixed bottom-6 left-0 w-full flex justify-center z-[300] px-4 pointer-events-none">
          <div className="glass pointer-events-auto rounded-[24px] shadow-[0_15px_40px_-10px_rgba(0,0,0,0.1)] flex items-center justify-between px-2 py-2 gap-1 min-w-[310px] bg-white/90">
              <button onClick={() => setActiveTab('home')} className={navItemClass('home')}>
                  <i className="fa-solid fa-house text-lg mb-0.5"></i>
                  {activeTab === 'home' && <span className="w-1 h-1 bg-emerald-500 rounded-full absolute bottom-2"></span>}
              </button>
              <button onClick={() => setActiveTab('requests')} className={navItemClass('requests')}>
                  <i className="fa-solid fa-file-contract text-lg mb-0.5"></i>
                  {activeTab === 'requests' && <span className="w-1 h-1 bg-emerald-500 rounded-full absolute bottom-2"></span>}
              </button>
              <div className="w-px h-6 bg-slate-200 mx-1"></div>
              <button onClick={() => setActiveTab('contacts')} className={navItemClass('contacts')}>
                  <i className="fa-solid fa-users text-lg mb-0.5"></i>
                  {activeTab === 'contacts' && <span className="w-1 h-1 bg-emerald-500 rounded-full absolute bottom-2"></span>}
              </button>
              <button onClick={() => setActiveTab('profile')} className={navItemClass('profile')}>
                  <i className="fa-solid fa-user-gear text-lg mb-0.5"></i>
                  {activeTab === 'profile' && <span className="w-1 h-1 bg-emerald-500 rounded-full absolute bottom-2"></span>}
              </button>
          </div>
       </div>
       )}

       {/* Modals */}
       {showCamera && <ModalCamera onClose={() => setShowCamera(false)} onCapture={handleCheckIn} />}
       {showNoti && <NotificationsModal data={data} onClose={() => setShowNoti(false)} onRefresh={fetchData} user={currentUser} />}

       {/* CUSTOM CHECKOUT CONFIRMATION MODAL */}
       {showCheckoutConfirm && (
           <div className="fixed inset-0 z-[500] bg-black/40 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in">
               <div className="bg-white rounded-[32px] p-6 w-full max-w-sm shadow-2xl animate-scale-in">
                   <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                       <i className="fa-solid fa-person-walking-arrow-right text-2xl"></i>
                   </div>
                   <h3 className="text-xl font-bold text-slate-800 text-center mb-2">Kết thúc làm việc?</h3>
                   <p className="text-sm text-slate-500 text-center mb-6">Hệ thống sẽ ghi nhận giờ ra của bạn ngay bây giờ.</p>
                   <div className="flex gap-3">
                       <button onClick={() => setShowCheckoutConfirm(false)} className="flex-1 py-3.5 rounded-2xl bg-slate-100 text-slate-600 font-bold text-sm active:scale-95 transition-transform">
                           Quay lại
                       </button>
                       <button onClick={processCheckOut} className="flex-1 py-3.5 rounded-2xl bg-red-500 text-white font-bold text-sm shadow-lg shadow-red-200 active:scale-95 transition-transform">
                           Xác nhận
                       </button>
                   </div>
               </div>
           </div>
       )}

       {/* CUSTOM ALERT MESSAGE MODAL */}
       {alertMessage && (
           <div className="fixed inset-0 z-[500] bg-black/40 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in">
               <div className="bg-white rounded-[32px] p-6 w-full max-w-sm shadow-2xl animate-scale-in text-center">
                   <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${alertMessage.type === 'success' ? 'bg-emerald-50 text-emerald-500' : 'bg-red-50 text-red-500'}`}>
                       <i className={`fa-solid ${alertMessage.type === 'success' ? 'fa-check' : 'fa-xmark'} text-2xl`}></i>
                   </div>
                   <h3 className="text-xl font-bold text-slate-800 mb-2">{alertMessage.title}</h3>
                   <p className="text-sm text-slate-500 mb-6">{alertMessage.msg}</p>
                   <button onClick={() => setAlertMessage(null)} className="w-full py-3.5 rounded-2xl bg-slate-900 text-white font-bold text-sm shadow-lg active:scale-95 transition-transform">
                       Đóng
                   </button>
               </div>
           </div>
       )}

    </div>
  );
};

export default Dashboard;