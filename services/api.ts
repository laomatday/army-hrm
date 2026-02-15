import { db, storage } from "./firebase";
import { 
  collection, getDocs, query, where, addDoc, updateDoc, 
  doc, setDoc, getDoc 
} from "firebase/firestore";
import { ref, uploadString, getDownloadURL } from "firebase/storage";
import { Employee, Attendance, LeaveRequest, LocationConfig, ShiftConfig, HolidayConfig, SystemConfig } from "../types";
import { calculateDistance, timeToMinutes, calculateNetWorkHours, getCurrentTimeStr, formatDate } from "../utils/helpers";

const COLLECTIONS = {
  EMPLOYEES: "employees",
  ATTENDANCE: "attendance",
  LOCATIONS: "config_locations",
  LEAVE: "leave_requests",
  SHIFTS: "config_shifts",
  HOLIDAYS: "config_holidays",
  SYSTEM: "config_system"
};

// Roles that have management privileges
const PRIVILEGED_ROLES = ["Admin", "Manager", "HR", "Board", "Accountant"];

// --- HELPER CONFIG LOADING ---
async function getShifts(): Promise<ShiftConfig[]> {
  const defaultShifts: ShiftConfig[] = [
      { name: "Ca Sáng", start: "08:30", end: "12:00", break_point: "13:00" },
      { name: "Ca Chiều", start: "14:00", end: "17:30", break_point: "17:30" },
      { name: "Ca Tối", start: "17:30", end: "21:00", break_point: "23:59" }
  ];

  try {
      const q = query(collection(db, COLLECTIONS.SHIFTS));
      const snap = await getDocs(q);
      
      if (snap.empty) {
          console.log("No shift configuration found in Firestore. Using defaults.");
          return defaultShifts;
      }
      
      const shifts = snap.docs.map(d => {
          const data = d.data();
          // Ensure we map Firestore fields correctly to our internal ShiftConfig type
          return {
              name: data.name || "Unnamed Shift",
              start: data.start_time || "00:00",
              end: data.end_time || "00:00",
              break_point: data.break_point || "23:59"
          } as ShiftConfig;
      });

      // Sort by break_point to ensure the shift determination logic works sequentially
      return shifts.sort((a, b) => timeToMinutes(a.break_point) - timeToMinutes(b.break_point));
  } catch(e) { 
      console.error("Error loading shifts from DB:", e);
      return defaultShifts; 
  }
}

async function getSystemConfig(): Promise<SystemConfig> {
    const defaults: SystemConfig = {
        LATE_TOLERANCE: 15,
        MIN_HOURS_FULL: 7,
        MIN_HOURS_HALF: 3.5,
        LUNCH_START: "12:00",
        LUNCH_END: "13:30",
        OFF_DAYS: [0], // Sunday
        MAX_DISTANCE_METERS: 200
    };
    
    try {
        const q = query(collection(db, COLLECTIONS.SYSTEM));
        const snap = await getDocs(q);
        if (snap.empty) return defaults;

        const config: any = { ...defaults };
        snap.forEach(doc => {
            const data = doc.data();
            if (data.key && data.value !== undefined) {
                if (data.key === 'OFF_DAYS') {
                     // Strict handling for OFF_DAYS to ensure array
                     if (typeof data.value === 'string') {
                         config.OFF_DAYS = data.value.split(',').map((s: string) => Number(s.trim()));
                     } else if (typeof data.value === 'number') {
                         config.OFF_DAYS = [data.value];
                     } else if (Array.isArray(data.value)) {
                         config.OFF_DAYS = data.value;
                     }
                } else if (!isNaN(Number(data.value)) && data.key !== 'LUNCH_START' && data.key !== 'LUNCH_END') {
                     config[data.key] = Number(data.value);
                } else {
                     config[data.key] = data.value;
                }
            }
        });
        return config as SystemConfig;
    } catch(e) {
        console.error("Error loading system config", e);
        return defaults;
    }
}

function determineShift(timeStr: string, shifts: ShiftConfig[]) {
  const currentMins = timeToMinutes(timeStr);
  
  for (const shift of shifts) {
      const breakMins = timeToMinutes(shift.break_point);
      if (currentMins < breakMins) {
          return shift;
      }
  }
  return shifts[shifts.length - 1];
}

// --- AUTH ---
export async function doLogin(loginId: string, password: string, deviceId: string) {
  try {
    const usersRef = collection(db, COLLECTIONS.EMPLOYEES);
    const qEmail = query(usersRef, where("email", "==", loginId));
    const qId = query(usersRef, where("employee_id", "==", loginId));
    
    let userSnap = await getDocs(qEmail);
    if(userSnap.empty) userSnap = await getDocs(qId);

    if (userSnap.empty) return { success: false, message: "Tài khoản không tồn tại." };

    const userData = userSnap.docs[0].data() as Employee;
    const docId = userSnap.docs[0].id; 

    const storedPwd = String(userData.password || "").trim();
    if (storedPwd !== String(password).trim()) {
      return { success: false, message: "Mật khẩu không đúng." };
    }
    if (userData.status !== "Active") {
      return { success: false, message: "Tài khoản bị khóa." };
    }

    const isPrivileged = PRIVILEGED_ROLES.includes(userData.role);
    
    if (!isPrivileged) {
      if (!userData.trusted_device_id || userData.trusted_device_id === "") {
        await updateDoc(doc(db, COLLECTIONS.EMPLOYEES, docId), { trusted_device_id: deviceId });
      } else if (userData.trusted_device_id !== deviceId) {
        return { success: false, message: "Thiết bị lạ! Bạn chỉ được dùng 1 thiết bị đã đăng ký." };
      }
    }

    return { success: true, data: { ...userData, id: docId } };
  } catch (e: any) {
    console.error(e);
    return { success: false, message: "Lỗi Server: " + e.message };
  }
}

// --- CHECK IN ---
export async function doCheckIn(data: { employeeId: string, lat: number, lng: number, deviceId: string, imageBase64: string }, user: Employee) {
  try {
    // 1. Get Configs
    const sysConfig = await getSystemConfig();
    const locRef = collection(db, COLLECTIONS.LOCATIONS);
    const qLoc = query(locRef, where("center_id", "==", user.center_id));
    const locSnap = await getDocs(qLoc);
    
    if (locSnap.empty) return { success: false, message: "Chưa cấu hình địa điểm (center_id) cho user." };
    const locData = locSnap.docs[0].data() as any; 
    const targetLat = locData.latitude;
    const targetLng = locData.longitude;
    const allowedRadius = locData.radius_meters || sysConfig.MAX_DISTANCE_METERS || 200;

    // 2. Location Check
    const dist = calculateDistance(data.lat, data.lng, targetLat, targetLng);
    if (dist > allowedRadius) {
      return { success: false, message: `Sai vị trí! Cách VP ${Math.round(dist)}m (Cho phép ${allowedRadius}m).` };
    }

    // 3. Shift Logic
    const shifts = await getShifts();
    const timeStr = getCurrentTimeStr();
    const currentShift = determineShift(timeStr, shifts);
    
    const shiftStartMins = timeToMinutes(currentShift.start);
    const currentMins = timeToMinutes(timeStr);
    
    let lateMinutes = 0;
    let status: "Valid" | "Late" = "Valid";
    const tolerance = sysConfig.LATE_TOLERANCE || 15;

    if (currentMins > shiftStartMins + tolerance) {
      lateMinutes = currentMins - (shiftStartMins + tolerance);
      status = "Late";
    }

    let imageUrl = "";
    if (data.imageBase64) {
      const storageRef = ref(storage, `attendance/${data.employeeId}_${Date.now()}.jpg`);
      await uploadString(storageRef, data.imageBase64, 'data_url');
      imageUrl = await getDownloadURL(storageRef);
    }

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; 
    const safeShiftName = currentShift.name.replace(/\s+/g, '');
    const docId = `${user.employee_id}_${dateStr}_${safeShiftName}`;
    const attRef = doc(db, COLLECTIONS.ATTENDANCE, docId);

    const existingSnap = await getDoc(attRef);
    if (existingSnap.exists()) {
        const existingData = existingSnap.data() as Attendance;
        if (!existingData.time_out) {
             return { success: false, message: `Bạn đã Check-in ${currentShift.name} rồi!` };
        }
        return { success: false, message: `Bạn đã hoàn thành ${currentShift.name} hôm nay!` };
    }

    const recordData: any = {
      employee_id: user.employee_id,
      name: user.name,
      date: dateStr,
      center_id: user.center_id,
      device_id: data.deviceId,
      last_updated: now.toISOString(),
      distance_meters: dist,
      status: status,
      is_valid: "Yes",
      note: `Checkin ${currentShift.name} tại ${locData.name || locData.location_name}`,
      
      shift_name: currentShift.name,
      time_in: timeStr,
      checkin_lat: data.lat,
      checkin_lng: data.lng,
      checkin_type: "GPS",
      late_minutes: lateMinutes,
      selfie_url: imageUrl,
      
      time_out: "", 
      work_hours: 0,
      timestamp: now.getTime()
    };

    await setDoc(attRef, recordData, { merge: true });
    
    return { success: true, message: `Check-in ${currentShift.name} thành công! (${status === 'Late' ? 'Trễ '+lateMinutes+'p' : 'Đúng giờ'})` };

  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

// --- CHECK OUT ---
export async function doCheckOut(employeeId: string) {
  try {
    const sysConfig = await getSystemConfig();
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; 
    
    const attRef = collection(db, COLLECTIONS.ATTENDANCE);
    const q = query(
        attRef, 
        where("employee_id", "==", employeeId),
        where("date", "==", dateStr),
        where("time_out", "==", "")
    );
    
    const snap = await getDocs(q);
    
    if (snap.empty) {
       return { success: false, message: "Không tìm thấy phiên làm việc đang mở nào để Check-out!" };
    }
    
    const docData = snap.docs[0].data() as Attendance;
    const docId = snap.docs[0].id;
    const docRef = doc(db, COLLECTIONS.ATTENDANCE, docId);

    const timeOutStr = getCurrentTimeStr();
    
    // Calculate Net Work Hours using System Config for Lunch
    const workedHours = Number(calculateNetWorkHours(
        docData.time_in, 
        timeOutStr, 
        sysConfig.LUNCH_START, 
        sysConfig.LUNCH_END
    ));

    await updateDoc(docRef, {
      time_out: timeOutStr,
      work_hours: workedHours,
      last_updated: now.toISOString()
    });

    return { success: true, message: `Check-out thành công! Ca làm: ${workedHours}h` };

  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

// --- DASHBOARD DATA (Main Aggregator) ---
export async function getDashboardData(user: Employee) {
  try {
    const isPrivileged = PRIVILEGED_ROLES.includes(user.role);

    // 1. Fetch System Config & Metadata
    const sysConfig = await getSystemConfig();
    const locSnap = await getDocs(collection(db, COLLECTIONS.LOCATIONS));
    const locations = locSnap.docs.map(d => {
        const data = d.data();
        return { 
            id: d.id, 
            location_id: data.center_id, 
            location_name: data.name,
            latitude: data.latitude,
            longitude: data.longitude,
            radius_meters: data.radius_meters 
        } as LocationConfig;
    });

    const holidaySnap = await getDocs(collection(db, COLLECTIONS.HOLIDAYS));
    const holidays = holidaySnap.docs.map(d => d.data() as HolidayConfig);

    // 2. Fetch Contacts
    let contacts: Employee[] = [];
    if (isPrivileged) {
        const empSnap = await getDocs(collection(db, COLLECTIONS.EMPLOYEES));
        contacts = empSnap.docs.map(d => ({ ...d.data(), id: d.id } as Employee));
    } else {
        const empRef = collection(db, COLLECTIONS.EMPLOYEES);
        const qEmp = query(empRef, where("center_id", "==", user.center_id));
        const empSnap = await getDocs(qEmp);
        contacts = empSnap.docs.map(d => ({ ...d.data(), id: d.id } as Employee));
    }

    // 3. Fetch History
    const attRef = collection(db, COLLECTIONS.ATTENDANCE);
    const qAtt = query(attRef, where("employee_id", "==", user.employee_id));
    const attSnap = await getDocs(qAtt);
    
    const historyList = attSnap.docs
      .map(d => ({ ...d.data(), id: d.id } as Attendance))
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    // Calculate Summary
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    // Dynamic Standard Days Calculation using System Config OFF_DAYS
    const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    // Defensive check to ensure Array
    const offDays = Array.isArray(sysConfig.OFF_DAYS) ? sysConfig.OFF_DAYS : [0]; 
    let offDaysCount = 0;
    
    for (let d = 1; d <= totalDaysInMonth; d++) {
        const dayOfWeek = new Date(currentYear, currentMonth, d).getDay();
        if (offDays.includes(dayOfWeek)) offDaysCount++;
    }
    
    let holidayDays = 0;
    holidays.forEach(h => {
        const hStart = new Date(h.from_date);
        const hEnd = new Date(h.to_date);
        if (hStart.getMonth() === currentMonth && hStart.getFullYear() === currentYear) {
             const startDay = Math.max(1, hStart.getDate());
             const endDay = Math.min(totalDaysInMonth, hEnd.getMonth() === currentMonth ? hEnd.getDate() : totalDaysInMonth);
             // Ensure we don't double count if holiday falls on an OFF_DAY
             // Simplified loop to check overlap
             for(let k = startDay; k <= endDay; k++) {
                 const dw = new Date(currentYear, currentMonth, k).getDay();
                 if(!offDays.includes(dw)) holidayDays++;
             }
        }
    });

    const standardDays = totalDaysInMonth - offDaysCount - holidayDays;

    let summary = { 
        workDays: 0, 
        lateMins: 0, 
        leaveDays: 0, 
        remainingLeave: user.annual_leave_balance, 
        standardDays: Math.max(0, standardDays), 
        errorCount: 0 
    };
    
    const dailyMap: {[key: string]: { hours: number, late: number, error: boolean }} = {};

    historyList.forEach(h => {
        const [y, m, d] = h.date.split('-').map(Number);
        if (!dailyMap[h.date]) dailyMap[h.date] = { hours: 0, late: 0, error: false };

        if (y === currentYear && m - 1 === currentMonth) {
            dailyMap[h.date].hours += Number(h.work_hours || 0);
            dailyMap[h.date].late += Number(h.late_minutes || 0);
            
            if (h.status === 'Invalid' || (h.time_in && !h.time_out && d !== now.getDate())) {
                dailyMap[h.date].error = true;
                summary.errorCount += 1;
            }
        }
    });

    // Use thresholds from config
    const minFull = sysConfig.MIN_HOURS_FULL || 7;
    const minHalf = sysConfig.MIN_HOURS_HALF || 3.5;

    Object.values(dailyMap).forEach(day => {
        if (day.hours >= minFull) summary.workDays += 1;
        else if (day.hours >= minHalf) summary.workDays += 0.5;
        
        summary.lateMins += day.late;
    });

    // 4. Fetch Requests
    const reqRef = collection(db, COLLECTIONS.LEAVE);
    const qMyReq = query(reqRef, where("employee_id", "==", user.employee_id));
    const myReqSnap = await getDocs(qMyReq);
    const myRequests = myReqSnap.docs.map(d => ({...d.data(), id: d.id} as LeaveRequest))
                       .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    myRequests.forEach(r => {
        if(r.status === 'Approved') {
            const d = new Date(r.from_date);
            if(d.getMonth() === currentMonth && d.getFullYear() === currentYear) summary.leaveDays += 1; 
        }
    });

    // 5. Fetch Approvals
    let approvals: LeaveRequest[] = [];
    if (isPrivileged) {
        const qPending = query(reqRef, where("status", "==", "Pending"));
        const pSnap = await getDocs(qPending);
        const allPending = pSnap.docs.map(d => ({...d.data(), id: d.id} as LeaveRequest));

        if (user.role === 'Admin') {
            approvals = allPending.filter(r => r.employee_id !== user.employee_id);
        } else {
            approvals = allPending.filter(r => {
                if (r.employee_id === user.employee_id) return false;
                const requester = contacts.find(c => c.employee_id === r.employee_id);
                return requester && requester.direct_manager_id === user.employee_id;
            });
        }
    }

    return {
        success: true,
        data: {
            userProfile: user,
            history: { history: historyList, summary },
            notifications: { approvals, myRequests },
            myRequests,
            locations,
            contacts,
            holidays,
            systemConfig: sysConfig
        }
    };

  } catch (e: any) {
      console.error(e);
      return { success: false, message: e.message };
  }
}

export async function submitRequest(data: { employeeId: string, name: string, type: string, fromDate: string, toDate: string, reason: string }) {
    try {
        const newReq: any = {
            request_id: "REQ_" + Date.now(),
            employee_id: data.employeeId,
            name: data.name,
            created_at: new Date().toISOString(),
            type: data.type,
            from_date: data.fromDate,
            to_date: data.toDate,
            reason: data.reason,
            status: "Pending"
        };
        await addDoc(collection(db, COLLECTIONS.LEAVE), newReq);
        return { success: true, message: "Gửi đề xuất thành công!" };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}

export async function processRequest(reqDocId: string, status: string, note: string) {
    try {
        const docRef = doc(db, COLLECTIONS.LEAVE, reqDocId);
        await updateDoc(docRef, { 
            status: status, 
            manager_note: note 
        });
        return { success: true, message: "Đã cập nhật trạng thái đơn!" };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}