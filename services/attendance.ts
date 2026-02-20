
import { db, storage } from "./firebase";
import { Employee, Attendance, LocationConfig } from "../types";
import { COLLECTIONS } from "./constants";
import { getSystemConfig, getShifts, determineShift } from "./config";
import { calculateAndSaveMonthlyStats } from "./stats";
import { calculateDistance, getCurrentTimeStr, timeToMinutes, calculateNetWorkHours } from "../utils/helpers";

// --- CLIENT SIDE HELPERS FOR UPLOAD ONLY ---
async function uploadSelfie(employeeId: string, imageBase64: string): Promise<string> {
    if (!imageBase64) return "";
    try {
        const storageRef = storage.ref(`attendance/${employeeId}_${Date.now()}.jpg`);
        const response = await fetch(imageBase64);
        const blob = await response.blob();
        await storageRef.put(blob);
        return await storageRef.getDownloadURL();
    } catch (error) {
        console.error("Upload failed", error);
        return "";
    }
}

export async function doCheckIn(data: { employeeId: string, lat: number, lng: number, deviceId: string, imageBase64: string }, user: Employee) {
  try {
    const sysConfig = await getSystemConfig();
    
    // 0. CHECK FOR OPEN SESSIONS
    const openSessionQuery = await db.collection(COLLECTIONS.ATTENDANCE)
        .where("employee_id", "==", user.employee_id)
        .where("time_out", "==", "")
        .get();

    const todayStr = new Date().toISOString().split('T')[0];
    
    // Handle existing sessions
    if (!openSessionQuery.empty) {
        const batch = db.batch();
        let hasTodaySession = false;

        openSessionQuery.docs.forEach(doc => {
            const att = doc.data() as Attendance;
            if (att.date === todayStr) {
                hasTodaySession = true;
            } else {
                // AUTO-CLOSE STALE SESSIONS (Forgot to checkout yesterday)
                batch.update(doc.ref, {
                    time_out: "23:59",
                    status: "Invalid",
                    note: "System: Auto-closed (Forgot Checkout)",
                    last_updated: new Date().toISOString()
                });
            }
        });

        if (hasTodaySession) {
            return { 
                success: false, 
                message: "Bạn chưa Check-out ca làm việc hiện tại! Vui lòng Check-out trước." 
            };
        }

        // Commit auto-close updates
        await batch.commit();
    }
    
    // 1. Multi-Branch Logic & Geofencing (Nearest Geofencing)
    const locationsSnap = await db.collection(COLLECTIONS.LOCATIONS).get();
    const allLocations = locationsSnap.docs.map(d => d.data() as LocationConfig);
    
    // Filter allowed locations
    let allowedLocations = allLocations;
    if (!user.allowed_locations?.includes("ALL")) {
        const allowedIds = user.allowed_locations || [user.center_id];
        allowedLocations = allLocations.filter(loc => allowedIds.includes(loc.center_id));
    }

    if (allowedLocations.length === 0) {
        return { success: false, message: "Bạn không có quyền chấm công tại bất kỳ chi nhánh nào." };
    }

    // Find nearest chi nhánh
    let nearestLoc: LocationConfig | null = null;
    let minDistance = Infinity;

    allowedLocations.forEach(loc => {
        const dist = calculateDistance(data.lat, data.lng, loc.latitude, loc.longitude);
        if (dist < minDistance) {
            minDistance = dist;
            nearestLoc = loc;
        }
    });

    if (!nearestLoc) {
        return { success: false, message: "Không thể tìm thấy chi nhánh gần nhất." };
    }

    const allowedRadius = nearestLoc.radius_meters || sysConfig.MAX_DISTANCE_METERS || 200;
    if (minDistance > allowedRadius) {
        return { 
            success: false, 
            message: `Bạn đang ở quá xa chi nhánh ${nearestLoc.location_name} (${Math.round(minDistance)}m). Khoảng cách cho phép: ${allowedRadius}m.` 
        };
    }

    let imageUrl = "";
    if (data.imageBase64) {
       imageUrl = await uploadSelfie(data.employeeId, data.imageBase64);
    }

    // 2. Determine Shift & Calculate Lateness
    const shifts = await getShifts();
    const nowTimeStr = getCurrentTimeStr();
    const currentShift = determineShift(nowTimeStr, shifts);
    
    const startMins = timeToMinutes(currentShift.start);
    const nowMins = timeToMinutes(nowTimeStr);
    let lateMins = 0;
    
    if (nowMins > startMins + (sysConfig.LATE_TOLERANCE || 15)) {
        lateMins = nowMins - startMins;
    }

    const now = new Date();
    const docId = `${user.employee_id}_${now.getTime()}`; 

    const newAttendance: Attendance = {
        date: todayStr,
        employee_id: user.employee_id,
        name: user.name,
        center_id: nearestLoc.center_id, // Lấy mã chi nhánh thực tế phát hiện được
        shift_name: currentShift.name,
        shift_start: currentShift.start,
        shift_end: currentShift.end,
        time_in: nowTimeStr,
        time_out: "",
        checkin_type: 'GPS',
        checkin_lat: data.lat,
        checkin_lng: data.lng,
        distance_meters: minDistance,
        device_id: data.deviceId,
        selfie_url: imageUrl,
        late_minutes: lateMins,
        early_minutes: 0,
        work_hours: 0,
        status: lateMins > 0 ? 'Late' : 'Valid',
        is_valid: 'Yes',
        note: '',
        timestamp: now.getTime(),
        last_updated: now.toISOString()
    };

    await db.collection(COLLECTIONS.ATTENDANCE).doc(docId).set(newAttendance);

    await calculateAndSaveMonthlyStats(user.employee_id, todayStr);

    return { success: true, message: `Check-in thành công tại ${nearestLoc.location_name}! (${currentShift.name})` };
  } catch (e: any) {
    console.error("Check-in Error:", e);
    return { success: false, message: e.message || "Lỗi chấm công" };
  }
}

export async function doCheckOut(employeeId: string, lat?: number, lng?: number) {
  try {
    const attRef = db.collection(COLLECTIONS.ATTENDANCE);
    
    const q = attRef
        .where("employee_id", "==", employeeId)
        .where("time_out", "==", ""); 
    
    const snap = await q.get();
    
    const openDoc = snap.docs
        .map(d => ({...d.data(), id: d.id} as Attendance))
        .sort((a,b) => b.timestamp - a.timestamp)[0];

    if (!openDoc || !openDoc.id) {
        return { success: false, message: "Không tìm thấy phiên làm việc để Check-out." };
    }

    const nowTimeStr = getCurrentTimeStr();
    const sysConfig = await getSystemConfig();

    // 1. Verify checkout location if GPS provided
    let checkoutDistance = 0;
    if (lat && lng) {
        const locSnap = await db.collection(COLLECTIONS.LOCATIONS).where("center_id", "==", openDoc.center_id).get();
        if (!locSnap.empty) {
            const loc = locSnap.docs[0].data() as LocationConfig;
            checkoutDistance = calculateDistance(lat, lng, loc.latitude, loc.longitude);
            const allowedRadius = loc.radius_meters || sysConfig.MAX_DISTANCE_METERS || 200;
            if (checkoutDistance > allowedRadius) {
                 return { success: false, message: `Check-out thất bại: Bạn đang ở quá xa chi nhánh đã check-in (${Math.round(checkoutDistance)}m).` };
            }
        }
    }

    // 2. Calculate Net Hours accounting for Shifts and Breaks
    const netHoursStr = calculateNetWorkHours(
        openDoc.time_in, 
        nowTimeStr, 
        sysConfig.LUNCH_START, 
        sysConfig.LUNCH_END
    );
    let netHours = parseFloat(netHoursStr);

    if (openDoc.total_break_mins) {
        netHours = Math.max(0, netHours - (openDoc.total_break_mins / 60));
    }

    let earlyMins = 0;
    if (openDoc.shift_end && openDoc.shift_start) {
        let endMins = timeToMinutes(openDoc.shift_end);
        const startMins = timeToMinutes(openDoc.shift_start);
        let nowMins = timeToMinutes(nowTimeStr);
        
        if (endMins < startMins) {
             endMins += 24 * 60;
             if (nowMins < startMins) {
                 nowMins += 24 * 60;
             }
        } else {
             if (nowMins < startMins) {
                 nowMins += 24 * 60;
             }
        }

        if (nowMins < endMins - 1) {
            earlyMins = endMins - nowMins;
        }
    }

    await attRef.doc(openDoc.id).update({
        time_out: nowTimeStr,
        checkout_lat: lat,
        checkout_lng: lng,
        checkout_distance: checkoutDistance,
        work_hours: parseFloat(netHours.toFixed(2)),
        early_minutes: earlyMins,
        last_updated: new Date().toISOString()
    });

    await calculateAndSaveMonthlyStats(employeeId, openDoc.date);

    return { success: true, message: `Check-out thành công! Công: ${netHours.toFixed(2)}h` };

  } catch (e: any) {
    console.error("Check-out Error:", e);
    return { success: false, message: e.message || "Lỗi chấm công" };
  }
}

export async function togglePause(employeeId: string, isPausing: boolean) {
    try {
        const attRef = db.collection(COLLECTIONS.ATTENDANCE);
        const q = attRef
            .where("employee_id", "==", employeeId)
            .where("time_out", "==", "");
            
        const snap = await q.get();
        
        const openDoc = snap.docs
            .map(d => ({...d.data(), id: d.id} as Attendance))
            .sort((a,b) => b.timestamp - a.timestamp)[0];

        if (!openDoc || !openDoc.id) return { success: false, message: "Không tìm thấy phiên làm việc!" };

        const now = new Date();

        if (isPausing) {
            if (openDoc.break_start) return { success: false, message: "Bạn đang trong thời gian nghỉ rồi." };
            await attRef.doc(openDoc.id).update({
                break_start: now.toISOString(),
                last_updated: now.toISOString()
            });
            return { success: true, message: "Đã tạm dừng công việc." };
        } else {
            if (!openDoc.break_start) return { success: false, message: "Bạn chưa tạm dừng." };
            
            const breakStart = new Date(openDoc.break_start);
            const diffMs = now.getTime() - breakStart.getTime();
            const diffMins = Math.floor(diffMs / 60000);
            const currentTotal = openDoc.total_break_mins || 0;

            await attRef.doc(openDoc.id).update({
                break_start: null, 
                total_break_mins: currentTotal + diffMins,
                last_updated: now.toISOString()
            });
            return { success: true, message: `Đã tiếp tục làm việc! (Nghỉ ${diffMins}p)` };
        }
    } catch(e: any) {
        return { success: false, message: e.message };
    }
}
