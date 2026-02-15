import { Employee } from "../types";

export const TIME_ZONE = "Asia/Ho_Chi_Minh";

export function getShortName(fullName: string) {
  if (!fullName) return "";
  const parts = String(fullName).trim().split(" ");
  return parts.length > 0 ? parts[parts.length - 1] : "";
}

export function parseDateVN(dateStr: string): Date | null {
  if (!dateStr) return null;
  const parts = String(dateStr).split("/");
  if (parts.length === 3) {
    return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
  }
  return new Date(dateStr);
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

export function calculateNetWorkHours(inTime: string, outTime: string, lunchStart: string = "12:00", lunchEnd: string = "13:30") {
  if(!inTime || !outTime) return 0;
  const inMins = timeToMinutes(inTime);
  const outMins = timeToMinutes(outTime);
  
  const breakStart = timeToMinutes(lunchStart);
  const breakEnd = timeToMinutes(lunchEnd);

  let totalMins = outMins - inMins;
  
  // Calculate overlap with lunch break
  // Overlap = max(0, min(endA, endB) - max(startA, startB))
  // Interval A: [inMins, outMins]
  // Interval B: [breakStart, breakEnd]
  let overlap = Math.max(0, Math.min(outMins, breakEnd) - Math.max(inMins, breakStart));
  
  let netMins = totalMins - overlap;
  if (netMins < 0) netMins = 0;
  return (netMins / 60).toFixed(2);
}

export function formatDate(date: Date) {
  const d = new Date(date);
  let month = '' + (d.getMonth() + 1);
  let day = '' + d.getDate();
  const year = d.getFullYear();

  if (month.length < 2) month = '0' + month;
  if (day.length < 2) day = '0' + day;

  return [day, month, year].join('/');
}

export function getCurrentTimeStr() {
  const now = new Date();
  const h = now.getHours().toString().padStart(2, '0');
  const m = now.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

export const getAvatarHtml = (name: string, url: string, sizeClass = "w-12 h-12", textSize = "text-sm") => {
    // This is a logic helper to determine if we show IMG or Initials
    // Returns an object to be used in JSX
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