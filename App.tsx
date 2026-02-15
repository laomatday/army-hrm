import React, { useState, useEffect } from 'react';
import LoginView from './components/LoginView';
import Dashboard from './components/Dashboard';
import { Employee } from './types';

function App() {
  const [user, setUser] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check local storage for session
    const saved = localStorage.getItem('army_user_v2026');
    if (saved) {
      try {
        setUser(JSON.parse(saved));
      } catch (e) {
        localStorage.removeItem('army_user_v2026');
      }
    }
    setLoading(false);
  }, []);

  const handleLoginSuccess = (userData: Employee) => {
    setUser(userData);
    localStorage.setItem('army_user_v2026', JSON.stringify(userData));
  };

  const handleLogout = () => {
    localStorage.removeItem('army_user_v2026');
    setUser(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-[4px] border-slate-200 border-t-emerald-600"></div>
      </div>
    );
  }

  return (
    <>
      {!user ? (
        <LoginView onLoginSuccess={handleLoginSuccess} />
      ) : (
        <Dashboard user={user} onLogout={handleLogout} />
      )}
    </>
  );
}

export default App;