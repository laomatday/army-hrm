import { useState, useEffect, useRef } from 'react';
import { DashboardData, Employee } from '../../shared/types';
import { getDashboardData } from '../../shared/services/api';
import { timeToMinutes, getCurrentTimeStr, triggerHaptic } from '../../shared/utils/helpers';

export const useDashboardData = (
    user: Employee, 
    onLogout: () => void,
    onNotification?: (title: string, body: string) => void
) => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(user);
  
  // Use a ref to store the stringified version of data to avoid expensive stringify on every render
  // and to prevent infinite re-render loops caused by new object references from API.
  const prevDataJson = useRef<string>("");

  const fetchData = async () => {
    // Silent update if data exists, loading spinner only for first load
    if (!data && prevDataJson.current === "") setLoading(true);
    
    try {
        const res = await getDashboardData(currentUser);
        if (res.success && res.data) {
          if (res.data.userProfile && res.data.userProfile.status !== 'Active') {
              onLogout();
              return;
          }
          
          // OPTIMIZATION: Only update currentUser if the data actually changed.
          if (res.data.userProfile) {
              const isProfileChanged = JSON.stringify(res.data.userProfile) !== JSON.stringify(currentUser);
              if (isProfileChanged) {
                  setCurrentUser(res.data.userProfile);
              }
          }

          // CRITICAL FIX: Deep compare dashboard data before calling setData
          // This prevents React from re-rendering the entire tree when data content is identical
          // but object reference is different (which happens on every API call).
          const newDataJson = JSON.stringify(res.data);
          if (newDataJson !== prevDataJson.current) {
              prevDataJson.current = newDataJson;
              setData(res.data);
              checkShiftEndReminder(res.data);
          }
        }
    } catch (e) {
        console.error("Dashboard data fetch error", e);
    } finally {
        setLoading(false);
    }
  };

  const checkShiftEndReminder = (d: DashboardData) => {
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const activeSession = d.history.history.find(h => h.date === todayStr && !h.time_out);

      if (activeSession && activeSession.shift_end) {
          const shiftEndMins = timeToMinutes(activeSession.shift_end);
          const currentMins = timeToMinutes(getCurrentTimeStr());
          const tolerance = 15; 

          if (currentMins > shiftEndMins + tolerance) {
              const lastRemindKey = `remind_checkout_${todayStr}`;
              if (!localStorage.getItem(lastRemindKey)) {
                  const title = "Nhắc nhở Check-out";
                  const body = `Ca làm việc của bạn đã kết thúc lúc ${activeSession.shift_end}. Vui lòng Check-out!`;

                  // 1. Browser Push Notification
                  if (Notification.permission === 'granted') {
                      new Notification(title, {
                          body: body,
                          icon: "https://firebasestorage.googleapis.com/v0/b/army-hrm-70615.firebasestorage.app/o/logo%2Flogo_white.png?alt=media"
                      });
                  }

                  // 2. In-App Alert via Callback
                  if (onNotification) {
                      triggerHaptic('warning');
                      onNotification(title, body);
                  }

                  localStorage.setItem(lastRemindKey, 'true');
              }
          }
      }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [currentUser.employee_id]);

  return { data, loading, currentUser, refresh: fetchData };
};