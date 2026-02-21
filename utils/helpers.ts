import { db, storage } from "./firebase";
import { Employee } from "../types";
import { COLLECTIONS } from "./constants";
import { hashPassword } from "../utils/helpers";

// --- SECURITY UTILS ---
export async function hashPassword(str: string) {
  if (!str) return "";
  const msgBuffer = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
// ----------------------

export function getShortName(fullName: string) {
  if (!fullName) return "";
  const parts = String(fullName).trim().split(" ");
  return parts.length > 0 ? parts[parts.length - 1] : "";
}

export function formatDateString(dateStr: string) {
  if (!dateStr) return "";
  const datePart = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
  const parts = datePart.split('-');
  if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // metres
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function timeToMinutes(timeStr: string) {
  if (!timeStr) return 0;
  const p = String(timeStr).split(":").map(Number);
  if (p.length < 2) return 0;
  return p[0] * 60 + p[1];
}

/**
 * Calculates net work hours excluding lunch break.
 * Handles overnight shifts by adding 24h to outTime if it's smaller than inTime.
 */
export function calculateNetWorkHours(inTime: string, outTime: string, lunchStart: string = "12:00", lunchEnd: string = "13:30") {
  if(!inTime || !outTime) return "0";
  
  const inMins = timeToMinutes(inTime);
  let outMins = timeToMinutes(outTime);
  
  // Handle overnight shift
  if (outMins < inMins) {
      outMins += 24 * 60;
  }
  
  if (outMins <= inMins) return "0"; 

  const breakStart = timeToMinutes(lunchStart);
  const breakEnd = timeToMinutes(lunchEnd);

  let grossMins = outMins - inMins;
  
  // Calculate Intersection with Break
  // Interval A (Work): [inMins, outMins]
  // Interval B (Break): [breakStart, breakEnd]
  // Overlap = Max(0, Min(EndA, EndB) - Max(StartA, StartB))
  
  let overlap = 0;
  if (breakEnd > breakStart) { 
      const startMax = Math.max(inMins, breakStart);
      const endMin = Math.min(outMins, breakEnd);
      if (endMin > startMax) {
          overlap = endMin - startMax;
      }
  }
  
  let netMins = grossMins - overlap;
  if (netMins < 0) netMins = 0;
  
  return (netMins / 60).toFixed(2);
}

export function getCurrentTimeStr() {
  const now = new Date();
  const h = now.getHours().toString().padStart(2, '0');
  const m = now.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

export const getAvatarHtml = (name: string, url: string) => {
    if (url && url.length > 5 && !url.includes("ui-avatars.com")) {
      return { type: 'img', src: url, alt: name };
    }
    let initials = "--";
    if (name) {
      const parts = name.trim().split(" ");
      initials = parts.length === 1 ? parts[0].substring(0, 2) : parts[0].charAt(0) + parts[parts.length - 1].charAt(0);
      initials = initials.toUpperCase();
    }
    return { type: 'initials', text: initials };
};

export function getDeviceId() {
    let devId = localStorage.getItem("army_device_id");
    if (!devId) {
      devId = "DEV_" + Date.now().toString(36) + Math.random().toString(36).substr(2, 5).toUpperCase();
      localStorage.setItem("army_device_id", devId);
    }
    return devId;
}

export const triggerHaptic = (pattern: 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'warning' = 'light') => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
        switch (pattern) {
            case 'light': navigator.vibrate(10); break;
            case 'medium': navigator.vibrate(20); break;
            case 'heavy': navigator.vibrate(40); break;
            case 'success': navigator.vibrate([10, 30, 10]); break;
            case 'warning': navigator.vibrate([30, 50, 30]); break;
            case 'error': navigator.vibrate([50, 30, 50, 30, 50]); break;
        }
    }
};
