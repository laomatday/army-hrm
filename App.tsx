
import React, { useState, useEffect } from 'react';
import LoginView from './components/LoginView';
import Dashboard from './components/Dashboard';
import AdminPanel from './components/AdminPanel';
import AdminModeSelection from './components/AdminModeSelection';
import KioskMode from './components/KioskMode';
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

  // DARK MODE HANDLER (System + Manual Override)
  useEffect(() => {
    const applyTheme = () => {
        const savedTheme = localStorage.getItem('army_theme');
        const sysDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        // Priority: Manual Setting > System Preference
        const isDark = savedTheme === 'dark' || (!savedTheme && sysDark);
        
        if (isDark) {
            document.documentElement.classList.add('dark');
            document.querySelector('meta[name="theme-color"]')?.setAttribute("content", "#0f172a");
        } else {
            document.documentElement.classList.remove('dark');
            document.querySelector('meta[name="theme-color"]')?.setAttribute("content", "#ffffff");
        }
    };

    // Initial Apply
    applyTheme();

    // Listeners
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
      if (user) {
          if (user.role === 'Admin') {
             if (appMode !== 'app' && appMode !== 'admin') {
                 setAppMode('selection');
             }
          } else {
             setAppMode('app');
          }
      }
  }, [user]);

  const handleLoginSuccess = (userData: Employee) => {
    localStorage.setItem('army_user_v2026', JSON.stringify(userData));
    setUser(userData);
    
    if (userData.role === 'Admin') {
        setAppMode('selection');
        localStorage.setItem('army_app_mode', 'selection');
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

  const initNotifications = async (empId: string) => {
      if (!messaging) return;
      try {
          const permission = await Notification.requestPermission();
          if (permission === 'granted' && messaging) {
              const token = await messaging.getToken({ 
                  vapidKey: "BOP_H9z_X...placeholder_key" 
              });
              if (token) {
                  await saveDeviceToken(empId, token);
              }
          }
      } catch (error) {
          console.log("Notification registration skipped:", error);
      }
  };

  // REAL-TIME NOTIFICATION LISTENER (Firestore)
  useEffect(() => {
      if (!user) return;

      const unsubscribe = db.collection('user_notifications')
          .where("employee_id", "==", user.employee_id)
          .where("is_read", "==", false)
          .onSnapshot((snapshot) => {
              snapshot.docChanges().forEach((change) => {
                  if (change.type === "added") {
                      const data = change.doc.data();
                      // Show In-App Toast
                      showToast({
                          title: data.title,
                          body: data.body,
                          type: data.type || 'info'
                      });
                      
                      // Trigger Browser Notification if in background
                      if (document.hidden && Notification.permission === 'granted') {
                           new Notification(data.title, {
                               body: data.body,
                               icon: "https://firebasestorage.googleapis.com/v0/b/army-hrm-70615.firebasestorage.app/o/logo%2Flogo.png?alt=media"
                           });
                      }

                      // Mark as read immediately to avoid re-toast on refresh
                      db.collection('user_notifications').doc(change.doc.id).update({ is_read: true });
                  }
              });
          });

      return () => unsubscribe();
  }, [user, showToast]);

  // FCM Listener (Foreground & Init)
  useEffect(() => {
      if (user && messaging) {
          // Initialize token registration here (Single source of truth)
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

  if (appMode === 'kiosk' && user.role === 'Admin') {
      return <KioskMode onExit={() => handleModeSelect('selection')} />;
  }

  return <Dashboard user={user} onLogout={handleLogout} />;
}

function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}

export default App;
