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
import ModalExplainWork from './ModalExplainWork';
import BottomNav, { TabType } from './BottomNav';
import Header from './Header';
import Spinner from './Spinner';
import ConfirmDialog from './ConfirmDialog';
import { DashboardSkeleton } from './Skeleton';

interface Props {
  user: Employee;
  onLogout: () => void;
}

const AppShell: React.FC<Props> = ({ user, onLogout }) => {
  const [alertMessage, setAlertMessage] = useState<{title: string, msg: string, type: 'success' | 'error' | 'warning'} | null>(null);

  const handleShowAlert = (title: string, msg: string, type: 'success' | 'error' | 'warning' = 'success') => {
      triggerHaptic(type === 'success' ? 'success' : 'error');
      setAlertMessage({ title, msg, type }); 
  };

  const { data, loading, currentUser, refresh } = useDashboardData(
      user, 
      onLogout,
      (title, body) => handleShowAlert(title, body, 'warning')
  );
  
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [direction, setDirection] = useState<'left' | 'right'>('right');
  const [lastActiveTab, setLastActiveTab] = useState<TabType>('home');
  
  const [isNavVisible, setIsNavVisible] = useState(true);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [showCamera, setShowCamera] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkInStatus, setCheckInStatus] = useState("");
  const [showCheckoutConfirm, setShowCheckoutConfirm] = useState(false);
  const [showImageCropper, setShowImageCropper] = useState(false);
  
  const [showCreateRequestModal, setShowCreateRequestModal] = useState(false);
  const [showExplainWorkModal, setShowExplainWorkModal] = useState(false);
  const [createRequestInitialData, setCreateRequestInitialData] = useState<{type: string, date: string, reason: string} | null>(null);
  const [explainWorkInitialData, setExplainWorkInitialData] = useState<{date: string, reason: string} | null>(null);

  const [contactsResetTrigger, setContactsResetTrigger] = useState(0);
  const [contactsSearchTrigger, setContactsSearchTrigger] = useState(0); 
  const [seenNotiCount, setSeenNotiCount] = useState(() => {
      try { return parseInt(localStorage.getItem('army_seen_noti_count') || '0', 10); } catch { return 0; }
  });

  const managerDate = new Date();

  const { handleScroll } = useScrollControl(setIsNavVisible);
  const touchStart = useRef<{x: number, y: number} | null>(null);
  const touchEnd = useRef<{x: number, y: number} | null>(null);
  const minSwipeDistance = 50;

  // Ref to hold kiosk listener cleanup functions
  const kioskListenerUnsub = useRef<(() => void) | null>(null);

  // Main cleanup effect for the component
  useEffect(() => {
    return () => {
      if (kioskListenerUnsub.current) {
        console.log("Cleaning up active Kiosk listener on component unmount.");
        kioskListenerUnsub.current();
      }
    };
  }, []);

  useEffect(() => {
    const scrollContainer = document.querySelector('.overflow-y-auto');
    if (scrollContainer) {
        scrollContainer.addEventListener('scroll', handleScroll as any, { passive: true });
        return () => scrollContainer.removeEventListener('scroll', handleScroll as any);
    }
  }, [activeTab, loading]); 

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
      if (showExplainWorkModal) setShowExplainWorkModal(false);
  };

  const handleCheckIn = async (base64: string, lat: number, lng: number) => {
    setCheckingIn(true);
    setCheckInStatus("Đang đồng bộ dữ liệu...");
    setShowCamera(false);

    const res = await doCheckIn({
        employeeId: currentUser.employee_id, lat, lng, deviceId: getDeviceId(), imageBase64: base64, checkinType: 'Mobile'
    }, currentUser);

    setCheckingIn(false);
    
    handleShowAlert(res.success ? "Thành công" : "Lỗi", res.message, res.success ? 'success' : 'error');

    if(res.success) {
        refresh(); 
    }
  };

  const handleQRScan = async (qrString: string) => {
    setShowQRScanner(false);
    if (kioskListenerUnsub.current) {
        kioskListenerUnsub.current(); // Clean up any previous listener
    }

    try {
        const qrData = JSON.parse(qrString);
        const targetKioskId = qrData.kiosk_id || 'KIOSK_01';
        
        if (!qrData.token) {
            handleShowAlert("Lỗi", "Mã QR thiếu Token xác thực", "error");
            return;
        }

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
                        handleShowAlert("Sai vị trí", `Bạn cần ở văn phòng để chấm công Kiosk. Khoảng cách hiện tại: ${Math.round(dist)}m.`, 'error');
                        return;
                    }
                }
            }

            setCheckInStatus("Đang kết nối với Kiosk...");

            const sessionRef = await db.collection('kiosk_sessions').add({
                kiosk_id: targetKioskId,
                token: qrData.token,
                employee_id: currentUser.employee_id,
                employee_name: currentUser.name,
                center_id: currentUser.center_id,
                status: 'pending',
                created_at: new Date().toISOString(),
                user_lat: pos.coords.latitude,
                user_lng: pos.coords.longitude
            });

            const timeoutId = setTimeout(() => {
                handleShowAlert("Hết thời gian", "Kiosk không phản hồi. Vui lòng thử lại.", "error");
                if (kioskListenerUnsub.current) {
                  kioskListenerUnsub.current();
                  kioskListenerUnsub.current = null;
                }
                setCheckingIn(false);
            }, 45000);

            const unsubscribe = db.collection('kiosk_sessions').doc(sessionRef.id)
                .onSnapshot((doc) => {
                    const session = doc.data();
                    if (!session) return;

                    const cleanup = () => {
                        clearTimeout(timeoutId);
                        unsubscribe();
                        kioskListenerUnsub.current = null;
                        setCheckingIn(false);
                    };

                    if (session.status === 'camera_ready') {
                        setCheckInStatus("Kiosk đã sẵn sàng. Vui lòng nhìn vào camera trên Kiosk!");
                    } else if (session.status === 'completed') {
                        handleShowAlert("Thành công", "Đã ghi nhận chấm công từ Kiosk", "success");
                        refresh();
                        cleanup();
                    } else if (session.status === 'failed') {
                        handleShowAlert("Lỗi", session.error || "Chấm công thất bại", "error");
                        cleanup();
                    }
                });
            
            kioskListenerUnsub.current = unsubscribe;

        }, (err) => {
            setCheckingIn(false);
            handleShowAlert("Lỗi định vị", "Vui lòng bật GPS để xác thực vị trí khi quét mã Kiosk.", 'error');
        }, { enableHighAccuracy: true, timeout: 8000 });

    } catch (e) {
        handleShowAlert("Lỗi", "Không thể đọc mã QR", "error");
        setCheckingIn(false);
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
          
          setCheckingIn(false);
          handleShowAlert(res.success ? "Thành công" : "Lỗi", res.message, res.success ? 'success' : 'error');
          
          if(res.success) refresh(); 

      }, (err) => {
          setCheckingIn(false);
          handleShowAlert("Lỗi định vị", "Vui lòng bật GPS.", 'error');
      }, { enableHighAccuracy: true, timeout: 8000 });
  };

  const onTouchStart = (e: React.TouchEvent) => {
    const x = e.targetTouches[0].clientX;
    if (x < 30 || x > window.innerWidth - 30) {
        touchStart.current = null;
        return;
    }
    touchEnd.current = null; 
    touchStart.current = { x, y: e.targetTouches[0].clientY }; 
  };

  const onTouchEnd = () => {
    if (!touchStart.current || !touchEnd.current) return;
    const dX = touchStart.current.x - touchEnd.current.x;
    const dY = touchStart.current.y - touchEnd.current.y;
    
    if (Math.abs(dX) > Math.abs(dY)) {
         const tabs: TabType[] = ['home', 'history', 'requests', 'contacts'];
         if (['Admin', 'Manager'].includes(currentUser.role || '')) tabs.push('manager');
         tabs.push('notifications'); 
         
         const idx = tabs.indexOf(activeTab);
         if (dX > minSwipeDistance && idx < tabs.length - 1 && idx >= 0) handleTabChange(tabs[idx + 1]);
         if (dX < -minSwipeDistance) {
             if (idx > 0) handleTabChange(tabs[idx - 1]);
             else if (activeTab === 'profile') { setDirection('left'); setActiveTab(lastActiveTab); }
         }
    }
  };

  const rawNotiCount = (data?.notifications.approvals.length || 0) + 
                       (data?.notifications.explanationApprovals.length || 0) + 
                       (data?.notifications.myRequests.filter(r => r.status !== 'Pending').length || 0) + 
                       (data?.notifications.myExplanations.filter(r => r.status !== 'Pending').length || 0);
  const badgeCount = Math.max(0, rawNotiCount - seenNotiCount);

 const explainableItems = React.useMemo(() => {
    if (!data) return [];
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const list = [];
    
    const loopPtr = new Date();
    loopPtr.setDate(loopPtr.getDate() - 45);

    while(loopPtr <= today) {
        const dateStr = loopPtr.toISOString().split('T')[0];
        const dailyRecords = data.history.history.filter(h => h.date === dateStr);
        let reasons: string[] = [];

        if (dailyRecords.length > 0) {
            const hasMissingOut = dailyRecords.some(r => !r.time_out);
            if (hasMissingOut && dateStr !== today.toISOString().split('T')[0]) {
                reasons.push("Quên Check-out");
            }
            
            const totalLate = dailyRecords.reduce((sum, r) => sum + Number(r.late_minutes || 0), 0);
            if (totalLate > 0) {
                reasons.push(`Trễ ${totalLate} phút`);
            }

            const totalEarly = dailyRecords.reduce((sum, r) => sum + Number(r.early_minutes || 0), 0);
            if (totalEarly > 0) {
                reasons.push(`Về sớm ${totalEarly} phút`);
            }

        } else {
            const offDays = Array.isArray(data.systemConfig?.OFF_DAYS) ? data.systemConfig.OFF_DAYS : [0, 6];
            if (!offDays.includes(loopPtr.getDay())) {
                 reasons.push("Vắng");
            }
        }

        const isExplained = data.myExplanations.some(r => r.date === dateStr && r.status !== 'Rejected');
        const isRequested = data.myRequests.some(r => {
            const from = new Date(r.fromDate + 'T00:00:00');
            const to = new Date(r.toDate + 'T00:00:00');
            const current = new Date(dateStr + 'T00:00:00');
            return current >= from && current <= to && r.status === 'Approved';
        });

        if (reasons.length > 0 && !isExplained && !isRequested) {
            list.push({ date: dateStr, explainReason: reasons.join(', ') });
        }

        loopPtr.setDate(loopPtr.getDate() + 1);
    }
    
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();

    const filterStartDate = new Date(currentYear, currentMonth, 1);
    const filterEndDate = new Date(currentYear, currentMonth + 1, 5);
    filterEndDate.setHours(23, 59, 59, 999); 

    return list.filter(item => {
        const itemDate = new Date(item.date + 'T00:00:00');
        return itemDate >= filterStartDate && itemDate <= filterEndDate;
    });
  }, [data]);

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="h-full w-full bg-slate-50 dark:bg-neutral-black relative flex flex-col font-sans transition-colors duration-300">
       {checkingIn && (
         <div className="fixed inset-0 z-[5000] bg-neutral-black/80 backdrop-blur-sm flex items-center justify-center p-6 text-center animate-fade-in">
           <div className="bg-neutral-white dark:bg-neutral-black/90 rounded-[32px] p-8 max-w-sm w-full shadow-2xl border border-slate-100 dark:border-slate-800 animate-scale-in">
             <div className="relative w-20 h-20 mx-auto mb-6">
               <div className="absolute inset-0 border-4 border-slate-100 dark:border-slate-800 rounded-full"></div>
               <div className="absolute inset-0 border-4 border-primary rounded-full border-t-transparent animate-spin"></div>
             </div>
             <h3 className="text-xl font-black text-neutral-black dark:text-neutral-white mb-2 tracking-tight">Đang xử lý...</h3>
             <p className="text-slate-500 dark:text-slate-400 text-sm font-medium leading-relaxed">
               {checkInStatus || "Vui lòng đợi trong giây lát"}
             </p>
             <button 
               onClick={() => setCheckingIn(false)}
               className="mt-8 text-slate-400 dark:text-slate-500 text-xs font-extrabold uppercase tracking-widest hover:text-neutral-black dark:hover:text-neutral-white transition-colors"
             >
               Ẩn đi (Vẫn chạy nền)
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
              onCreateRequest={() => setShowCreateRequestModal(true)}
              onContactSearch={() => setContactsSearchTrigger(prev => prev + 1)}
           />
       )}

       <div 
         className="flex-1 relative overflow-hidden bg-slate-50 dark:bg-neutral-black"
         onTouchStart={onTouchStart}
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
                <TabHistory 
                    data={data} 
                    user={currentUser} 
                    onRefresh={refresh} 
                    onAlert={handleShowAlert} 
                    onExplain={(date, reason) => { 
                        setExplainWorkInitialData({ date, reason });
                        setShowExplainWorkModal(true);
                    }} 
                />
              )}
              {activeTab === 'requests' && (
                <TabRequests data={data} user={currentUser} onRefresh={refresh} />
              )}
              {activeTab === 'contacts' && (
                <TabContacts 
                    data={data} 
                    resetTrigger={contactsResetTrigger} 
                    searchTrigger={contactsSearchTrigger} 
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
                    setShowImageCropper={setShowImageCropper}
                  />
              )}
              {activeTab === 'notifications' && (
                  <NotificationsModal data={data} onClose={() => {setDirection('left'); setActiveTab(lastActiveTab);}} user={currentUser} activeTab={activeTab} onSwitchTab={handleTabChange} onRefresh={refresh}/>
              )}
          </div>
       </div>

       <ModalCreateRequest 
            user={currentUser} 
            isOpen={showCreateRequestModal} 
            onClose={() => setShowCreateRequestModal(false)}
            onSuccess={refresh} 
            onAlert={handleShowAlert} 
            initialData={createRequestInitialData}
            setIsNavVisible={setIsNavVisible}
       />

        <ModalExplainWork
            user={currentUser}
            isOpen={showExplainWorkModal}
            onClose={() => setShowExplainWorkModal(false)}
            onSuccess={refresh}
            onAlert={handleShowAlert}
            initialData={explainWorkInitialData || undefined}
            explainableItems={explainableItems}
            setIsNavVisible={setIsNavVisible}
        />

       {!showCamera && !showCheckoutConfirm && !alertMessage && !showImageCropper && (
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

export default AppShell;