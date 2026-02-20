
import React, { useState, useEffect, useRef } from 'react';
import { Employee } from '../types';
import { doCheckIn, doCheckOut } from '../services/api';
import { getDeviceId, triggerHaptic, calculateDistance } from '../utils/helpers';
import { useDashboardData } from '../hooks/useDashboardData';
import { useScrollControl } from '../hooks/useScrollControl';

import { db } from '../services/firebase';
import TabHome from './TabHome';
import TabHistory from './TabHistory';
import TabRequests from './TabRequests';
import TabContacts from './TabContacts';
import TabProfile from './TabProfile';
import TabManager from './TabManager'; 
import ModalCamera from './ModalCamera';
import ModalQRScanner from './ModalQRScanner';
import NotificationsModal from './NotificationsModal';
import ModalCreateRequest from './ModalCreateRequest';
import BottomNav, { TabType } from './BottomNav';
import Header from './Header';
import Spinner from './Spinner';
import ConfirmDialog from './ConfirmDialog';
import { DashboardSkeleton } from './Skeleton';

interface Props {
  user: Employee;
  onLogout: () => void;
}

const Dashboard: React.FC<Props> = ({ user, onLogout }) => {
  // --- UI STATE FOR ALERTS (Defined early for usage in hook) ---
  const [alertMessage, setAlertMessage] = useState<{title: string, msg: string, type: 'success' | 'error' | 'warning'} | null>(null);

  const handleShowAlert = (title: string, msg: string, type: 'success' | 'error' | 'warning' = 'success') => {
      triggerHaptic(type === 'success' ? 'success' : 'error');
      setAlertMessage({ title, msg, type }); 
  };

  // --- CORE STATE ---
  // Pass handleShowAlert as callback for in-app notifications
  const { data, loading, currentUser, refresh } = useDashboardData(
      user, 
      onLogout,
      (title, body) => handleShowAlert(title, body, 'warning')
  );
  
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [direction, setDirection] = useState<'left' | 'right'>('right');
  const [lastActiveTab, setLastActiveTab] = useState<TabType>('home');
  
  // --- UI STATE ---
  const [isNavVisible, setIsNavVisible] = useState(true);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [showCamera, setShowCamera] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkInStatus, setCheckInStatus] = useState("");
  const [showCheckoutConfirm, setShowCheckoutConfirm] = useState(false);
  
  // --- FEATURE STATE ---
  const [showCreateRequestModal, setShowCreateRequestModal] = useState(false);
  const [createRequestInitialData, setCreateRequestInitialData] = useState<{type: string, date: string, reason: string} | null>(null);
  const [contactsResetTrigger, setContactsResetTrigger] = useState(0);
  const [seenNotiCount, setSeenNotiCount] = useState(() => {
      try { return parseInt(localStorage.getItem('army_seen_noti_count') || '0', 10); } catch { return 0; }
  });

  // --- HEADER CONTROLS STATE ---
  const [managerDate, setManagerDate] = useState(new Date());

  // --- HOOKS ---
  const { handleScroll } = useScrollControl(setIsNavVisible);
  const touchStart = useRef<{x: number, y: number} | null>(null);
  const touchEnd = useRef<{x: number, y: number} | null>(null);
  const minSwipeDistance = 50;

  // --- EFFECTS ---
  useEffect(() => {
    // Attach scroll listener to the main scroll container
    const scrollContainer = document.querySelector('.overflow-y-auto');
    if (scrollContainer) {
        scrollContainer.addEventListener('scroll', handleScroll as any, { passive: true });
        return () => scrollContainer.removeEventListener('scroll', handleScroll as any);
    }
  }, [activeTab, loading]); // Re-attach when tab changes

  // --- ACTIONS ---
  const handleTabChange = (tab: TabType) => {
      triggerHaptic('light');
      if (activeTab === tab && tab === 'contacts') {
          setContactsResetTrigger(prev => prev + 1);
          return;
      }
      if (activeTab !== tab) {
          setIsHeaderVisible(true);
          const tabsOrder: TabType[] = ['home', 'history', 'requests', 'contacts', 'manager', 'notifications'];
          setDirection(tabsOrder.indexOf(tab) > tabsOrder.indexOf(activeTab) ? 'right' : 'left');
          if (activeTab !== 'profile' && activeTab !== 'notifications') setLastActiveTab(activeTab);
          setActiveTab(tab);
      }
      if (tab === 'notifications') {
          setSeenNotiCount(rawNotiCount);
          localStorage.setItem('army_seen_noti_count', String(rawNotiCount));
      }
      if (showCreateRequestModal) setShowCreateRequestModal(false);
  };

  const handleCheckIn = async (base64: string, lat: number, lng: number) => {
    setCheckingIn(true);
    setCheckInStatus("Đang xử lý dữ liệu chấm công...");
    setShowCamera(false);
    const res = await doCheckIn({
        employeeId: currentUser.employee_id, lat, lng, deviceId: getDeviceId(), imageBase64: base64
    }, currentUser);
    if(res.success) await refresh();
    setCheckingIn(false);
    handleShowAlert(res.success ? "Thành công" : "Lỗi", res.message, res.success ? 'success' : 'error');
  };

  const handleQRScan = async (qrString: string) => {
      setShowQRScanner(false);
      try {
          const qrData = JSON.parse(qrString);
          if (!qrData.kiosk_id || !qrData.token) {
              handleShowAlert("Lỗi", "Mã QR không hợp lệ", "error");
              return;
          }

          setCheckingIn(true);
          setCheckInStatus("Đang xác thực vị trí...");

          navigator.geolocation.getCurrentPosition(async (pos) => {
              // Verify location against office geofence
              if (data && data.locations) {
                  const userLoc = data.locations.find(l => l.center_id === currentUser.center_id);
                  if (userLoc) {
                      const dist = calculateDistance(pos.coords.latitude, pos.coords.longitude, userLoc.latitude, userLoc.longitude);
                      const maxDist = userLoc.radius_meters || data.systemConfig?.MAX_DISTANCE_METERS || 200;
                      
                      if (dist > maxDist) {
                          setCheckingIn(false);
                          handleShowAlert("Sai vị trí", `Bạn cần ở văn phòng để chấm công Kiosk. Khoảng cách hiện tại: ${Math.round(dist)}m.`, 'error');
                          return;
                      }
                  }
              }

              setCheckInStatus("Đang kết nối với Kiosk...");

              // Create session in Firestore
              const sessionRef = await db.collection('kiosk_sessions').add({
                  kiosk_id: qrData.kiosk_id,
                  token: qrData.token,
                  employee_id: currentUser.employee_id,
                  employee_name: currentUser.name,
                  center_id: currentUser.center_id,
                  status: 'pending',
                  created_at: new Date().toISOString(),
                  // Store verified location from personal device
                  user_lat: pos.coords.latitude,
                  user_lng: pos.coords.longitude
              });

              // Timeout for safety
              const timeoutId = setTimeout(() => {
                  setCheckingIn(false);
                  handleShowAlert("Hết thời gian", "Kiosk không phản hồi. Vui lòng thử lại.", "error");
              }, 45000);

              // Listen for completion
              const unsubscribe = db.collection('kiosk_sessions').doc(sessionRef.id)
                  .onSnapshot(async (doc) => {
                      const session = doc.data();
                      if (!session) return;

                      if (session.status === 'camera_ready') {
                          setCheckInStatus("Kiosk đã sẵn sàng. Vui lòng nhìn vào camera trên Kiosk!");
                      } else if (session.status === 'completed') {
                          clearTimeout(timeoutId);
                          unsubscribe();
                          setCheckingIn(false);
                          triggerHaptic('success');
                          handleShowAlert("Thành công", "Đã ghi nhận chấm công từ Kiosk", "success");
                          await refresh();
                      } else if (session.status === 'failed') {
                          clearTimeout(timeoutId);
                          unsubscribe();
                          setCheckingIn(false);
                          handleShowAlert("Lỗi", session.error || "Chấm công thất bại", "error");
                      }
                  });
          }, (err) => {
              setCheckingIn(false);
              handleShowAlert("Lỗi định vị", "Vui lòng bật GPS để xác thực vị trí khi quét mã Kiosk.", 'error');
          }, { enableHighAccuracy: true, timeout: 8000 });

      } catch (e) {
          handleShowAlert("Lỗi", "Không thể đọc mã QR", "error");
      }
  };

  const processCheckOut = async () => {
      triggerHaptic('medium');
      setShowCheckoutConfirm(false);
      setCheckingIn(true);
      setCheckInStatus("Đang xác thực vị trí...");
      navigator.geolocation.getCurrentPosition(async (pos) => {
          if (data && data.locations) {
              const userLoc = data.locations.find(l => l.center_id === currentUser.center_id);
              if (userLoc) {
                  const dist = calculateDistance(pos.coords.latitude, pos.coords.longitude, userLoc.latitude, userLoc.longitude);
                  const maxDist = userLoc.radius_meters || data.systemConfig?.MAX_DISTANCE_METERS || 200;
                  if (dist > maxDist) {
                      setCheckingIn(false);
                      handleShowAlert("Sai vị trí", `Bạn đang cách văn phòng ${Math.round(dist)}m (Cho phép ${maxDist}m).`, 'error');
                      return;
                  }
              }
          }
          setCheckInStatus("Đang gửi yêu cầu Check-out...");
          const res = await doCheckOut(currentUser.employee_id, pos.coords.latitude, pos.coords.longitude);
          if(res.success) await refresh(); 
          setCheckingIn(false);
          handleShowAlert(res.success ? "Thành công" : "Lỗi", res.message, res.success ? 'success' : 'error');
      }, (err) => {
          setCheckingIn(false);
          handleShowAlert("Lỗi định vị", "Vui lòng bật GPS.", 'error');
      }, { enableHighAccuracy: true, timeout: 8000 });
  };

  // --- SWIPE LOGIC ---
  const onTouchEnd = () => {
    if (!touchStart.current || !touchEnd.current) return;
    const dX = touchStart.current.x - touchEnd.current.x;
    const dY = touchStart.current.y - touchEnd.current.y;
    
    if (Math.abs(dX) > Math.abs(dY)) {
         const tabs: TabType[] = ['home', 'history', 'requests', 'contacts'];
         if (['Admin', 'Manager'].includes(currentUser.role || '')) tabs.push('manager');
         tabs.push('notifications'); // Add notifications to swipe flow
         
         const idx = tabs.indexOf(activeTab);
         if (dX > minSwipeDistance && idx < tabs.length - 1 && idx >= 0) handleTabChange(tabs[idx + 1]);
         if (dX < -minSwipeDistance) {
             if (idx > 0) handleTabChange(tabs[idx - 1]);
             else if (activeTab === 'profile') { setDirection('left'); setActiveTab(lastActiveTab); }
         }
    }
  };

  // --- RENDER HELPERS ---
  const rawNotiCount = (data?.notifications.approvals.length || 0) + 
                       (data?.notifications.explanationApprovals.length || 0) + 
                       (data?.notifications.myRequests.filter(r => r.status !== 'Pending').length || 0) + 
                       (data?.notifications.myExplanations.filter(r => r.status !== 'Pending').length || 0);
  const badgeCount = Math.max(0, rawNotiCount - seenNotiCount);

  // Loading Skeleton
  if (loading) return <DashboardSkeleton />;

  return (
    <div className="h-full w-full bg-slate-50 dark:bg-slate-900 relative flex flex-col font-sans transition-colors duration-300">
       {checkingIn && (
         <div className="fixed inset-0 z-[5000] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-6 text-center">
           <div className="bg-white dark:bg-slate-800 rounded-[32px] p-8 max-w-sm w-full shadow-2xl">
             <div className="relative w-20 h-20 mx-auto mb-6">
               <div className="absolute inset-0 border-4 border-slate-100 dark:border-slate-700 rounded-full"></div>
               <div className="absolute inset-0 border-4 border-emerald-500 rounded-full border-t-transparent animate-spin"></div>
             </div>
             <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Đang xử lý...</h3>
             <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
               {checkInStatus || "Vui lòng đợi trong giây lát"}
             </p>
             <button 
               onClick={() => setCheckingIn(false)}
               className="mt-8 text-slate-400 text-xs font-bold uppercase tracking-widest hover:text-slate-600 transition-colors"
             >
               Hủy bỏ
             </button>
           </div>
         </div>
       )}

       {activeTab !== 'profile' && isHeaderVisible && (
           <Header 
              user={currentUser} 
              activeTab={activeTab}
              onOpenProfile={() => setActiveTab('profile')} 
              setIsNavVisible={setIsNavVisible}
           />
       )}

       <div 
         className="flex-1 relative overflow-hidden bg-slate-50 dark:bg-slate-900"
         onTouchStart={(e) => { touchEnd.current = null; touchStart.current = { x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY }; }}
         onTouchMove={(e) => { touchEnd.current = { x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY }; }}
         onTouchEnd={onTouchEnd}
       >
          <div key={activeTab} className={`w-full h-full ${direction === 'right' ? 'animate-slide-in-right' : 'animate-slide-in-left'}`}>
              {activeTab === 'home' && (
                <TabHome 
                    data={data} loading={loading} onCheckIn={() => setShowCamera(true)} onCheckOut={() => setShowCheckoutConfirm(true)} 
                    onScanKiosk={() => setShowQRScanner(true)}
                    onChangeTab={handleTabChange} onCreateRequest={() => setShowCreateRequestModal(true)} onRefresh={refresh}
                    onAlert={handleShowAlert}
                />
              )}
              {activeTab === 'history' && (
                <TabHistory data={data} user={currentUser} onRefresh={refresh} onAlert={handleShowAlert} 
                    onExplain={(d, r) => { setCreateRequestInitialData({type: 'Giải trình công', date: d, reason: r}); setShowCreateRequestModal(true); }} 
                />
              )}
              {activeTab === 'requests' && (
                <TabRequests data={data} user={currentUser} onRefresh={refresh} onCreateClick={() => setShowCreateRequestModal(true)} />
              )}
              {activeTab === 'contacts' && (
                <TabContacts 
                    data={data} 
                    resetTrigger={contactsResetTrigger} 
                    onClose={() => handleTabChange('home')} 
                    setIsNavVisible={setIsNavVisible}
                    setIsHeaderVisible={setIsHeaderVisible}
                />
              )}
              {activeTab === 'manager' && (
                 <TabManager data={data} user={currentUser} onRefresh={refresh} onAlert={handleShowAlert} currentDate={managerDate}/>
              )}
              {activeTab === 'profile' && (
                  <TabProfile 
                    user={currentUser} 
                    locations={data?.locations || []} 
                    contacts={data?.contacts || []} 
                    onLogout={onLogout} 
                    onUpdate={refresh} 
                    onClose={() => {setDirection('left'); setActiveTab(lastActiveTab);}}
                    onAlert={handleShowAlert}
                  />
              )}
              {activeTab === 'notifications' && (
                  <NotificationsModal data={data} onClose={() => {setDirection('left'); setActiveTab(lastActiveTab);}} user={currentUser} activeTab={activeTab} onSwitchTab={handleTabChange} onRefresh={refresh}/>
              )}
          </div>
       </div>

       <ModalCreateRequest 
            user={currentUser} isOpen={showCreateRequestModal} onClose={() => setShowCreateRequestModal(false)}
            onSuccess={refresh} onAlert={handleShowAlert} initialData={createRequestInitialData}
       />

       {!showCamera && !showCheckoutConfirm && !alertMessage && (
           <BottomNav activeTab={activeTab} onChange={handleTabChange} isVisible={isNavVisible} user={currentUser} notiCount={badgeCount} onOpenNoti={() => activeTab === 'notifications' ? setActiveTab(lastActiveTab) : setActiveTab('notifications')}/>
       )}

       {showCamera && <ModalCamera onClose={() => setShowCamera(false)} onCapture={handleCheckIn} onError={(msg) => handleShowAlert("Lỗi thiết bị", msg, 'error')} />}
       
       {showQRScanner && <ModalQRScanner onClose={() => setShowQRScanner(false)} onScan={handleQRScan} onError={(msg) => handleShowAlert("Lỗi thiết bị", msg, 'error')} />}
       
       <ConfirmDialog 
          isOpen={showCheckoutConfirm} title="Kết thúc ca làm việc?" message="Hệ thống sẽ ghi nhận giờ ra (Check-out)."
          confirmLabel="Xác nhận" onConfirm={processCheckOut} onCancel={() => setShowCheckoutConfirm(false)} type="danger"
       />

       <ConfirmDialog 
          isOpen={!!alertMessage} title={alertMessage?.title || ""} message={alertMessage?.msg || ""}
          confirmLabel="Đóng" cancelLabel="" onConfirm={() => setAlertMessage(null)} onCancel={() => setAlertMessage(null)} type={alertMessage?.type || 'info'}
       />
    </div>
  );
};

export default Dashboard;
