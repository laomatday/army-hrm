
import React, { useState, useEffect } from 'react';
import LoginView from './components/ui/LoginView';
import AppShell from './components/ui/AppShell';
import AdminPanel from './components/admin/AdminPanel';
import AdminModeSelection from './components/admin/AdminModeSelection';
import KioskMode from './components/ui/KioskMode';
import { Employee } from './types';
import { messaging, db } from './services/firebase';
import { saveDeviceToken } from './services/api';
import { ToastProvider, useToast } from './contexts/ToastContext';

type AppMode = 'selection' | 'app' | 'admin' | 'kiosk';

function AppContent() {
  const [user, setUser] = useState<Employee | null>(() => {
    try {
      const saved = localStorage.getItem('army_user_v2026');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      localStorage.removeItem('army_user_v2026');
      return null;
    }
  });

  const [appMode, setAppMode] = useState<AppMode>(() => {
       const savedMode = localStorage.getItem('army_app_mode');
       return (savedMode as AppMode) || 'selection';
  });

  const { showToast } = useToast();

  useEffect(() => {
    const applyTheme = () => {
        const savedTheme = localStorage.getItem('army_theme');
        const sysDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        const isDark = savedTheme === 'dark' || (!savedTheme && sysDark);
        
        if (isDark) {
            document.documentElement.classList.add('dark');
            document.querySelector('meta[name="theme-color"]')?.setAttribute("content", "#0f172a");
        } else {
            document.documentElement.classList.remove('dark');
            document.querySelector('meta[name="theme-color"]')?.setAttribute("content", "#ffffff");
        }
    };

    applyTheme();

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = () => applyTheme();
    
    mediaQuery.addEventListener('change', handleSystemChange);
    window.addEventListener('army_theme_update', applyTheme);

    return () => {
        mediaQuery.removeEventListener('change', handleSystemChange);
        window.removeEventListener('army_theme_update', applyTheme);
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    if (user.role === 'Admin') {
        const validAdminModes: AppMode[] = ['app', 'admin', 'kiosk', 'selection'];
        if (!validAdminModes.includes(appMode)) {
            setAppMode('selection');
        }
    } else if (user.role === 'Kiosk') {
        if (appMode !== 'kiosk') {
            setAppMode('kiosk');
        }
    } else { // Staff, Manager, HR
        if (appMode !== 'app') {
            setAppMode('app');
        }
    }
}, [user, appMode]);

  const handleLoginSuccess = (userData: Employee) => {
    localStorage.setItem('army_user_v2026', JSON.stringify(userData));
    setUser(userData);
    
    if (userData.role === 'Admin') {
        setAppMode('selection');
        localStorage.setItem('army_app_mode', 'selection');
    } else if (userData.role === 'Kiosk') {
        setAppMode('kiosk');
        localStorage.setItem('army_app_mode', 'kiosk');
    } else {
        setAppMode('app');
        localStorage.setItem('army_app_mode', 'app');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('army_user_v2026');
    localStorage.removeItem('army_app_mode');
    setUser(null);
    setAppMode('selection');
  };

  const handleModeSelect = (mode: AppMode) => {
      setAppMode(mode);
      localStorage.setItem('army_app_mode', mode);
  };
  
  const handleExitKiosk = () => {
      if (user?.role === 'Kiosk') {
          handleLogout();
      } else {
          handleModeSelect('selection');
      }
  }

  const initNotifications = async (empId: string) => {
      if (!messaging) return;
      try {
          const permission = await Notification.requestPermission();
          if (permission === 'granted' && messaging) {
              const token = await messaging.getToken({ 
                  vapidKey: "BOP_H9z_XJ-5_Y2P-3o_R-1_Q0_S...w-8_Z" 
              });
              if (token) {
                  await saveDeviceToken(empId, token);
              }
          }
      } catch (error) {
      }
  };

  useEffect(() => {
      if (!user) return;

      const unsubscribe = db.collection('user_notifications')
          .where("employee_id", "==", user.employee_id)
          .where("is_read", "==", false)
          .onSnapshot((snapshot) => {
              snapshot.docChanges().forEach((change) => {
                  if (change.type === "added") {
                      const data = change.doc.data();
                      showToast({
                          title: data.title,
                          body: data.body,
                          type: data.type || 'info'
                      });
                      
                      if (document.hidden && Notification.permission === 'granted') {
                           new Notification(data.title, {
                               body: data.body,
                               icon: "https://lh3.googleusercontent.com/d/1r_FuqN4QJbch0FYXAwX8efW9s0ucreiO=w500"
                           });
                      }

                      db.collection('user_notifications').doc(change.doc.id).update({ is_read: true });
                  }
              });
          });

      return () => unsubscribe();
  }, [user, showToast]);

  useEffect(() => {
      if (user && messaging && user.role !== 'Kiosk') {
          initNotifications(user.employee_id);
          
          const unsubscribe = messaging.onMessage((payload) => {
              if (payload.notification) {
                   showToast({
                       title: payload.notification.title || 'Thông báo',
                       body: payload.notification.body || '',
                       type: 'info'
                   });
              }
          });
          return () => unsubscribe && unsubscribe();
      }
  }, [user, showToast]);

  if (!user) {
      return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  if (appMode === 'selection' && user.role === 'Admin') {
      return <AdminModeSelection onSelectMode={handleModeSelect} onLogout={handleLogout} />;
  }

  if (appMode === 'admin' && user.role === 'Admin') {
      return <AdminPanel user={user} onLogout={handleLogout} onBackToApp={() => handleModeSelect('app')} />;
  }

  if (appMode === 'kiosk' && (user.role === 'Admin' || user.role === 'Kiosk')) {
      return <KioskMode onExit={handleExitKiosk} />;
  }

  return <AppShell user={user} onLogout={handleLogout} />;
}

function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}

export default App;
