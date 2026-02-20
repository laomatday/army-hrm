
import { db, firebase } from "./firebase";
import { HolidayConfig, Attendance, LeaveRequest, Explanation, Employee, MonthlyStats } from "../types";
import { getSystemConfig } from "./config";
import { sendSystemNotification } from "./notification";
import { COLLECTIONS } from "./constants";

export async function calculateAndSaveMonthlyStats(employeeId: string, dateStr: string) {
    try {
        const dateObj = new Date(dateStr);
        const month = dateObj.getMonth() + 1;
        const year = dateObj.getFullYear();
        const keyId = `${employeeId}_${month}_${year}`;
        const todayStr = new Date().toISOString().split('T')[0];

        const daysInMonth = new Date(year, month, 0).getDate();
        const startStr = `${year}-${String(month).padStart(2,'0')}-01`;
        const endStr = `${year}-${String(month).padStart(2,'0')}-${String(daysInMonth).padStart(2,'0')}`;

        // 1. Fetch System Config & Holidays
        const sysConfig = await getSystemConfig();
        const holidaySnap = await db.collection(COLLECTIONS.HOLIDAYS).get();
        const holidays = holidaySnap.docs.map(d => d.data() as HolidayConfig);
        const offDays = sysConfig.OFF_DAYS || [0]; 

        // 2. Fetch Data (Attendance, Leaves, Explanations)
        const startTs = new Date(year, month - 1, 1).getTime(); 
        const endTs = new Date(year, month + 1, 1).getTime();   
        const startId = `${employeeId}_${startTs}`;
        const endId = `${employeeId}_${endTs}`;

        const attRef = db.collection(COLLECTIONS.ATTENDANCE);
        const qAtt = attRef
            .where(firebase.firestore.FieldPath.documentId(), ">=", startId)
            .where(firebase.firestore.FieldPath.documentId(), "<", endId);
        
        const [attSnap, leaveSnap, explainSnap, userSnap] = await Promise.all([
            qAtt.get(),
            db.collection(COLLECTIONS.LEAVE)
                .where("employee_id", "==", employeeId)
                .where("status", "==", "Approved")
                .get(),
            db.collection(COLLECTIONS.EXPLANATIONS)
                .where("employee_id", "==", employeeId)
                .where("status", "==", "Approved")
                .get(),
            db.collection(COLLECTIONS.EMPLOYEES).doc(employeeId).get()
        ]);
        
        const monthAtt = attSnap.docs
            .map(d => d.data() as Attendance)
            .filter(a => a.date >= startStr && a.date <= endStr);
        
        const leaves = leaveSnap.docs.map(d => d.data() as LeaveRequest);
        
        const explanations = explainSnap.docs
            .map(d => d.data() as Explanation)
            .filter(e => e.date >= startStr && e.date <= endStr);

        // 3. Count Standard Working Days
        const holidaySet = new Set<string>();
        holidays.forEach(h => {
             let loop = new Date(h.from_date);
             const end = new Date(h.to_date);
             while(loop <= end) {
                 holidaySet.add(loop.toISOString().split('T')[0]);
                 loop.setDate(loop.getDate() + 1);
             }
        });

        let standard_days = 0;
        for (let d = 1; d <= daysInMonth; d++) {
             const date = new Date(year, month - 1, d);
             const dayOfWeek = date.getDay();
             if (!offDays.includes(dayOfWeek)) {
                 standard_days++;
             }
        }

        // 4. Calculate Stats
        const dailyMap: Record<string, { hours: number, late: number, early: number, error: number, isExcused: boolean }> = {};
        let leave_days = 0;

        // A. Process Attendance
        monthAtt.forEach(att => {
             const dStr = att.date;
             if (!dailyMap[dStr]) dailyMap[dStr] = { hours: 0, late: 0, early: 0, error: 0, isExcused: false };
             
             let hours = 0;
             if (att.time_in && att.time_out) {
                 hours = att.work_hours || 0;
             } 
             // Error if no checkout by end of day (and date is in past)
             if (!att.time_out && dStr < todayStr) {
                 dailyMap[dStr].error = 1;
             }

             dailyMap[dStr].hours += hours;
             dailyMap[dStr].late += (att.late_minutes || 0);
             dailyMap[dStr].early += (att.early_minutes || 0);
        });

        // B. Process Leaves
        leaves.forEach(req => {
            const fromDate = new Date(req.from_date);
            const toDate = new Date(req.to_date);
            const type = req.type;

            let loop = new Date(fromDate);
            while (loop <= toDate) {
                if (loop.getMonth() + 1 === month && loop.getFullYear() === year) {
                    const dStr = loop.toISOString().split('T')[0];
                    if (!dailyMap[dStr]) dailyMap[dStr] = { hours: 0, late: 0, early: 0, error: 0, isExcused: false };

                    dailyMap[dStr].isExcused = true;
                    // Reset errors if excused
                    dailyMap[dStr].error = 0;

                    if (type.includes("Nghỉ phép")) {
                         leave_days++;
                    }
                }
                loop.setDate(loop.getDate() + 1);
            }
        });

        // C. Process Explanations
        explanations.forEach(exp => {
            const dStr = exp.date;
            if (dailyMap[dStr]) {
                dailyMap[dStr].isExcused = true;
                dailyMap[dStr].error = 0; 
            } else {
                // If explanation approved but no attendance record (e.g., completely forgot), treat as excused working day
                dailyMap[dStr] = { hours: 0, late: 0, early: 0, error: 0, isExcused: true };
            }
        });

        // D. Final Aggregation
        let work_days = 0;
        let total_late_minutes = 0;
        let total_early_minutes = 0;
        let error_count = 0;
        let late_count = 0;
        let early_count = 0;

        Object.keys(dailyMap).forEach(d => {
            const day = dailyMap[d];
            
            if (day.isExcused) {
                work_days += 1.0; 
            } else {
                let dayCredit = 0;
                if (day.hours >= sysConfig.MIN_HOURS_FULL) {
                    dayCredit = 1.0;
                } else if (day.hours >= sysConfig.MIN_HOURS_HALF) {
                    dayCredit = 0.5;
                }
                work_days += dayCredit;

                total_late_minutes += day.late;
                total_early_minutes += day.early;
                error_count += day.error;
                
                if (day.late > 0) late_count++;
                if (day.early > 0) early_count++;
            }
        });

        // Add holidays to work_days (Paid holidays)
        holidaySet.forEach(dStr => {
            const dDate = new Date(dStr);
            if (dDate.getMonth() + 1 === month && dDate.getFullYear() === year) {
                 const dayOfWeek = dDate.getDay();
                 if (!offDays.includes(dayOfWeek)) {
                     // If no work/leave recorded on holiday, count it as paid work day
                     if (!dailyMap[dStr]) {
                         work_days += 1.0;
                     }
                 }
            }
        });

        // 5. Update Stats
        const userData = userSnap.data() as Employee;
        const currentBalance = userData?.annual_leave_balance || 12;

        const statsData: MonthlyStats = {
            key_id: keyId,
            employee_id: employeeId,
            month,
            year,
            work_days,
            standard_days,
            late_mins: total_late_minutes,
            late_count,
            early_mins: total_early_minutes, 
            early_leave_minutes: total_early_minutes,
            early_count,
            error_count,
            leave_days,
            remaining_leave: currentBalance,
            last_updated: new Date().toISOString()
        };

        await db.collection(COLLECTIONS.MONTHLY_STATS).doc(keyId).set(statsData, { merge: true });
        
        // Notify if month is locked
        const now = new Date();
        if (now.getDate() === (sysConfig.LOCK_DATE || 5)) {
             await sendSystemNotification(
                 employeeId, 
                 "Chốt công tháng", 
                 `Bảng công tháng ${month - 1} đã được chốt. Vui lòng kiểm tra lại.`,
                 "info"
             );
        }

        return statsData;

    } catch (e) {
        console.error("Error updating stats", e);
        return null;
    }
}
