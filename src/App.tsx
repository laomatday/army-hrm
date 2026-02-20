
import React, { useState, useEffect } from 'react';
import LoginView from './features/auth/LoginView';
import Dashboard from './features/dashboard/Dashboard';
import AdminPanel from './features/admin/AdminPanel';
import AdminModeSelection from './features/admin/AdminModeSelection';
import KioskStation from './features/kiosk/KioskStation'; // Import Kiosk
import { Employee } from './shared/types';
import { ToastProvider, useToast } from './shared/contexts/ToastContext';
import { messaging, db } from './shared/services/firebase';

type AppMode = 'selection' | 'app' | 'admin' | 'kiosk'; // Added 'kiosk'

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
       if (savedMode === 'selection' || savedMode === 'app' || savedMode === 'admin' || savedMode === 'kiosk') {
           return savedMode;
       }
       return 'selection';
  });

  const { showToast } = useToast();

  // DARK MODE HANDLER
  useEffect(() => {
    const applyTheme = () => {
        const savedTheme = localStorage.getItem('army_theme');
        const sysDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        const isDark = savedTheme === 'dark' || (!savedTheme && sysDark);
        
        const htmlEl = document.documentElement;
        const metaThemeColor = document.querySelector('meta[name="theme-color"]');

        if (isDark) {
            htmlEl.classList.add('dark');
            if (metaThemeColor) metaThemeColor.setAttribute("content", "#0f172a");
        } else {
            htmlEl.classList.remove('dark');
            if (metaThemeColor) metaThemeColor.setAttribute("content", "#ffffff");
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

  // Update appMode based on user role changes
  useEffect(() => {
      if (user) {
          if (user.role !== 'Admin') {
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

  // Notification listeners (omitted for brevity, keep existing logic)
  useEffect(() => {
      if (!user) return;
      if (!db) return; 

      try {
          const unsubscribe = db.collection('user_notifications')
              .where("employee_id", "==", user.employee_id)
              .where("is_read", "==", false)
              .onSnapshot((snapshot: any) => {
                  snapshot.docChanges().forEach((change: any) => {
                      if (change.type === "added") {
                          const data = change.doc.data();
                          showToast(data.title || 'Thông báo mới', 'info');
                          
                          if (document.hidden && Notification.permission === 'granted') {
                               new Notification(data.title, {
                                   body: data.body,
                                   icon: "https://firebasestorage.googleapis.com/v0/b/army-hrm-70615.firebasestorage.app/o/logo%2Flogo.png?alt=media"
                               });
                          }
                      }
                  });
              });
          return () => unsubscribe();
      } catch (error) {
          console.error("Firestore listener error:", error);
      }
  }, [user, showToast]);

  // Handle Kiosk Mode (doesn't require standard login to stay on screen, but requires Admin role to activate initially)
  if (appMode === 'kiosk') {
      // For security, Kiosk mode is activated by Admin, then it stays. 
      // Ideally, it should persist even if page reload? 
      // Current implementation: Activated by Admin from selection screen.
      return <KioskStation />;
  }

  if (!user) {
      return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  if (appMode === 'selection' && user.role === 'Admin') {
      return <AdminModeSelection onSelectMode={handleModeSelect} onLogout={handleLogout} />;
  }

  if (appMode === 'admin' && user.role === 'Admin') {
      return <AdminPanel user={user} onLogout={handleLogout} onBackToApp={() => handleModeSelect('selection')} />;
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
