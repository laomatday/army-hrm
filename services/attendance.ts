
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
    
    // 1. Verify Location (Geofence)
    let distance = 0;
    if (user.center_id) {
        const locationsSnap = await db.collection(COLLECTIONS.LOCATIONS).where("center_id", "==", user.center_id).get();
        if (!locationsSnap.empty) {
            const targetLoc = locationsSnap.docs[0].data() as LocationConfig;
            distance = calculateDistance(data.lat, data.lng, targetLoc.latitude, targetLoc.longitude);
            
            const allowedRadius = targetLoc.radius_meters || sysConfig.MAX_DISTANCE_METERS || 200;
            if (distance > allowedRadius) {
                return { 
                    success: false, 
                    message: `Bạn đang ở quá xa văn phòng (${Math.round(distance)}m). Khoảng cách cho phép: ${allowedRadius}m.` 
                };
            }
        }
    }

    let imageUrl = "";
    if (data.imageBase64) {
       imageUrl = await uploadSelfie(data.employeeId, data.imageBase64);
    }

    // 2. Determine Shift & Calculate Lateness
    const shifts = await getShifts();
    const nowTimeStr = getCurrentTimeStr();
    // Logic determineShift đã được cập nhật để handle chính xác các giờ sớm (vd: 7h sáng sẽ vào Ca Sáng 8h30)
    const currentShift = determineShift(nowTimeStr, shifts);
    
    const startMins = timeToMinutes(currentShift.start);
    const nowMins = timeToMinutes(nowTimeStr);
    let lateMins = 0;
    
    // Logic đi muộn: Chỉ tính nếu vào sau (start + tolerance)
    if (nowMins > startMins + (sysConfig.LATE_TOLERANCE || 15)) {
        lateMins = nowMins - startMins;
    }

    const now = new Date();
    const docId = `${user.employee_id}_${now.getTime()}`; 

    const newAttendance: Attendance = {
        date: todayStr,
        employee_id: user.employee_id,
        name: user.name,
        center_id: user.center_id,
        shift_name: currentShift.name,
        shift_start: currentShift.start,
        shift_end: currentShift.end,
        time_in: nowTimeStr,
        time_out: "",
        checkin_type: 'GPS',
        checkin_lat: data.lat,
        checkin_lng: data.lng,
        distance_meters: distance,
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

    return { success: true, message: `Check-in thành công! (${currentShift.name})` };
  } catch (e: any) {
    console.error("Check-in Error:", e);
    return { success: false, message: e.message || "Lỗi chấm công" };
  }
}

export async function doCheckOut(employeeId: string, lat?: number, lng?: number) {
  try {
    const attRef = db.collection(COLLECTIONS.ATTENDANCE);
    
    // Find the latest open session
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

    // 3. Calculate Net Hours accounting for Shifts and Breaks
    const netHoursStr = calculateNetWorkHours(
        openDoc.time_in, 
        nowTimeStr, 
        sysConfig.LUNCH_START, 
        sysConfig.LUNCH_END
    );
    let netHours = parseFloat(netHoursStr);

    // Subtract paused minutes if any
    if (openDoc.total_break_mins) {
        netHours = Math.max(0, netHours - (openDoc.total_break_mins / 60));
    }

    // 4. Calculate Early Minutes (Corrected for Overnight)
    let earlyMins = 0;
    if (openDoc.shift_end && openDoc.shift_start) {
        let endMins = timeToMinutes(openDoc.shift_end);
        const startMins = timeToMinutes(openDoc.shift_start);
        let nowMins = timeToMinutes(nowTimeStr);
        
        // Adjust for overnight shift (Shift ends next day)
        // e.g. Start 22:00, End 06:00
        if (endMins < startMins) {
             endMins += 24 * 60;
             // If checking out past midnight (e.g. 05:00), adjust nowMins
             if (nowMins < startMins) {
                 nowMins += 24 * 60;
             }
        } else {
             // Normal day shift: Check if user works past midnight (unlikely but possible)
             if (nowMins < startMins) {
                 nowMins += 24 * 60;
             }
        }

        // Only count early if leaving before end time (with 1 min tolerance)
        // And ensure we don't count early minutes if they worked WAY past the shift end (e.g. forgot checkout)
        if (nowMins < endMins - 1) {
            earlyMins = endMins - nowMins;
        }
    }

    await attRef.doc(openDoc.id).update({
        time_out: nowTimeStr,
        checkout_lat: lat,
        checkout_lng: lng,
        work_hours: parseFloat(netHours.toFixed(2)),
        early_minutes: earlyMins,
        last_updated: new Date().toISOString()
    });

    // Recalculate stats for the DATE OF ATTENDANCE (important if overnight)
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
