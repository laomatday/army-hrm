import { db } from "./firebase";
import { Employee, Attendance, LocationConfig } from "../types";
import { COLLECTIONS } from "./constants";
import { getSystemConfig, getShifts, determineShift } from "./config";
import { calculateAndSaveMonthlyStats } from "./stats";
import { calculateDistance, getCurrentTimeStr, timeToMinutes, calculateNetWorkHours } from "../utils/helpers";

export async function doCheckIn(data: { employeeId: string, lat: number, lng: number, deviceId: string, imageUrl: string }, user: Employee) {
  try {
    const sysConfig = await getSystemConfig();
    
    const openSessionQuery = await db.collection(COLLECTIONS.ATTENDANCE)
        .where("employee_id", "==", user.employee_id)
        .where("time_out", "==", "")
        .get();

    const todayStr = new Date().toISOString().split('T')[0];
    
    if (!openSessionQuery.empty) {
        const batch = db.batch();
        let hasTodaySession = false;

        openSessionQuery.docs.forEach(doc => {
            const att = doc.data() as Attendance;
            if (att.date === todayStr) {
                hasTodaySession = true;
            } else {
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

        await batch.commit();
    }
    
    let userLat = Number(data.lat);
    let userLng = Number(data.lng);

    if (isNaN(userLat) || isNaN(userLng)) {
        return { success: false, message: "Dữ liệu GPS từ thiết bị không hợp lệ (Bị rỗng hoặc NaN)." };
    }

    if (userLat > userLng) {
        console.warn("⚠️ CẢNH BÁO: Tọa độ từ Frontend bị ngược! Hệ thống đang tự động đảo lại.");
        [userLat, userLng] = [userLng, userLat];
    }

    const locationsSnap = await db.collection(COLLECTIONS.LOCATIONS).get();
    const allLocations = locationsSnap.docs.map(d => d.data() as LocationConfig);
    
    let allowedLocations = allLocations;
    const userAllowed = user.allowed_locations || [];
    
    if (!userAllowed.includes("ALL")) {
        const allowedIds = userAllowed.length > 0 ? userAllowed : [user.center_id];
        const cleanAllowedIds = allowedIds.filter(id => !!id).map(id => String(id).trim());
        
        allowedLocations = allLocations.filter(loc => 
            cleanAllowedIds.includes(String(loc.center_id).trim())
        );
    }

    if (allowedLocations.length === 0) {
        return { 
            success: false, 
            message: `Bạn không có quyền chấm công tại bất kỳ chi nhánh nào. (Center ID: ${user.center_id || 'N/A'})` 
        };
    }

    let nearestLoc: LocationConfig | null = null;
    let minDistance = Infinity;

    allowedLocations.forEach(loc => {
        const locLat = Number(loc.latitude);
        const locLng = Number(loc.longitude);
        
        if (isNaN(locLat) || isNaN(locLng) || (locLat === 0 && locLng === 0)) {
            console.warn(`Bỏ qua chi nhánh ${loc.location_name} do tọa độ DB sai.`);
            return;
        }

        const dist = calculateDistance(userLat, userLng, locLat, locLng);
        if (dist < minDistance) {
            minDistance = dist;
            nearestLoc = loc;
        }
    });

    if (!nearestLoc) {
        return { 
            success: false, 
            message: "Không tìm thấy chi nhánh hợp lệ trong danh sách phân quyền của bạn." 
        };
    }

    const allowedRadius = Number(nearestLoc.radius_meters) || sysConfig.MAX_DISTANCE_METERS || 200;
    
    if (minDistance > allowedRadius) {
        return { 
            success: false, 
            message: `Bạn đang ở quá xa chi nhánh ${nearestLoc.location_name} (${Math.round(minDistance)}m). Bán kính cho phép là ${allowedRadius}m. (Vị trí: ${userLat.toFixed(4)}, ${userLng.toFixed(4)})` 
        };
    }

    const shifts = await getShifts();
    const nowTimeStr = getCurrentTimeStr();
    const currentShift = determineShift(nowTimeStr, shifts);
    
    let lateMins = 0;
    const startMins = timeToMinutes(currentShift.start);
    const nowMins = timeToMinutes(nowTimeStr);
    if (nowMins > startMins + (sysConfig.LATE_TOLERANCE || 15)) {
        lateMins = nowMins - startMins;
    }

    const now = new Date();
    const docId = `${user.employee_id}_${now.getTime()}`;

    const newAttendance: Attendance = {
        date: todayStr,
        employee_id: user.employee_id,
        name: user.name,
        center_id: nearestLoc.center_id,
        shift_name: currentShift.name,
        shift_start: currentShift.start,
        shift_end: currentShift.end,
        time_in: nowTimeStr,
        time_out: "",
        checkin_type: 'Kiosk',
        checkin_lat: userLat,
        checkin_lng: userLng,
        distance_meters: minDistance,
        device_id: data.deviceId,
        selfie_url: data.imageUrl,
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

    let checkoutDistance = 0;
    let finalCheckoutLat = lat;
    let finalCheckoutLng = lng;

    if (lat !== undefined && lng !== undefined) {
        let userLat = Number(lat);
        let userLng = Number(lng);

        if (isNaN(userLat) || isNaN(userLng)) {
            return { success: false, message: "Dữ liệu GPS Check-out không hợp lệ." };
        }

        if (userLat > userLng) {
            [userLat, userLng] = [userLng, userLat];
        }

        finalCheckoutLat = userLat;
        finalCheckoutLng = userLng;

        const locSnap = await db.collection(COLLECTIONS.LOCATIONS).where("center_id", "==", openDoc.center_id).get();
        if (!locSnap.empty) {
            const loc = locSnap.docs[0].data() as LocationConfig;
            checkoutDistance = calculateDistance(userLat, userLng, Number(loc.latitude), Number(loc.longitude));
            const allowedRadius = Number(loc.radius_meters) || sysConfig.MAX_DISTANCE_METERS || 200;
            
            if (checkoutDistance > allowedRadius) {
                 return { success: false, message: `Check-out thất bại: Bạn đang ở quá xa chi nhánh ${loc.location_name} (${Math.round(checkoutDistance)}m). Bán kính cho phép: ${allowedRadius}m.` };
            }
        }
    }

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
        
        if (endMins < startMins && nowMins < startMins) {
             endMins += 24 * 60;
             nowMins += 24 * 60;
        } else if (endMins < startMins) {
             endMins += 24 * 60;
        }

        if (nowMins < endMins - 1) {
            earlyMins = endMins - nowMins;
        }
    }

    await attRef.doc(openDoc.id).update({
        time_out: nowTimeStr,
        checkout_lat: finalCheckoutLat,
        checkout_lng: finalCheckoutLng,
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
