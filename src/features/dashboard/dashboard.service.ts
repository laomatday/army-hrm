import { db } from "../../shared/services/firebase";
import { Employee, Attendance, LeaveRequest, Explanation, LocationConfig, HolidayConfig, MonthlyStats, ShiftConfig } from "../../shared/types";
import { getSystemConfig } from "../../shared/services/config";
import { COLLECTIONS, PRIVILEGED_ROLES, GLOBAL_ADMINS, MANAGERS } from "../../shared/constants";

export async function getDashboardData(user: Employee) {
  try {
    const userRole = user.role || "Staff";
    const canViewAll = PRIVILEGED_ROLES.includes(userRole);

    const sysConfig = await getSystemConfig();
    
    const [locSnap, holidaySnap, shiftSnap] = await Promise.all([
        db.collection(COLLECTIONS.LOCATIONS).get(),
        db.collection(COLLECTIONS.HOLIDAYS).get(),
        db.collection(COLLECTIONS.SHIFTS).get()
    ]);

    const locations = locSnap.docs.map(d => ({ ...(d.data() as LocationConfig), id: d.id } as LocationConfig));
    const holidays = holidaySnap.docs.map(d => d.data() as HolidayConfig);
    
    // Map shifts
    const shifts = shiftSnap.docs.map(d => {
        const data = d.data() as any;
        return {
             name: data.name || "Unnamed Shift",
             start: data.start || data.start_time || "00:00",
             end: data.end || data.end_time || "00:00",
             break_point: data.break_point || "23:59"
        } as ShiftConfig;
    });

    let contacts: Employee[] = [];
    if (canViewAll) {
        const empSnap = await db.collection(COLLECTIONS.EMPLOYEES).get();
        contacts = empSnap.docs.map(d => ({ ...(d.data() as Employee), id: d.id } as Employee));
    } else {
        const qEmp = db.collection(COLLECTIONS.EMPLOYEES).where("center_id", "==", user.center_id);
        const empSnap = await qEmp.get();
        contacts = empSnap.docs.map(d => ({ ...(d.data() as Employee), id: d.id } as Employee));
    }

    const today = new Date();
    const pastDate = new Date();
    pastDate.setDate(today.getDate() - 60);
    const dateLimitStr = pastDate.toISOString().split('T')[0];

    const attRef = db.collection(COLLECTIONS.ATTENDANCE);
    const qAtt = attRef.where("employee_id", "==", user.employee_id);
    
    const attSnap = await qAtt.get();
    const historyList = attSnap.docs
      .map(d => ({ ...(d.data() as Attendance), id: d.id } as Attendance))
      .filter(a => a.date >= dateLimitStr)
      .sort((a, b) => b.timestamp - a.timestamp);

    const reqRef = db.collection(COLLECTIONS.LEAVE);
    const qMyReq = reqRef.where("employee_id", "==", user.employee_id);
    const myReqSnap = await qMyReq.get();
    const myRequests = myReqSnap.docs.map(d => ({...(d.data() as LeaveRequest), id: d.id} as LeaveRequest))
                       .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    const expRef = db.collection(COLLECTIONS.EXPLANATIONS);
    const qMyExp = expRef.where("employee_id", "==", user.employee_id);
    const myExpSnap = await qMyExp.get();
    const myExplanations = myExpSnap.docs.map(d => ({...(d.data() as Explanation), id: d.id} as Explanation))
                       .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // --- FETCH TEAM LEAVES FOR CALENDAR ---
    let teamLeaves: LeaveRequest[] = [];
    try {
        const qTeamLeaves = reqRef
            .where("status", "==", "Approved")
            .where("to_date", ">=", dateLimitStr);
        const teamLeavesSnap = await qTeamLeaves.get();
        
        const allLeaves = teamLeavesSnap.docs.map(d => ({ ...(d.data() as LeaveRequest), id: d.id } as LeaveRequest));
        
        // Filter based on visibility (same center)
        teamLeaves = allLeaves.filter(l => {
             if (canViewAll) return true;
             const contact = contacts.find(c => c.employee_id === l.employee_id);
             return contact && contact.center_id === user.center_id;
        });
    } catch (e) {
        console.warn("Failed to fetch team leaves", e);
    }
    // -------------------------------------

    const now = new Date();
    
    const keyId = `${user.employee_id}_${now.getMonth()+1}_${now.getFullYear()}`;
    const statSnap = await db.collection(COLLECTIONS.MONTHLY_STATS).doc(keyId).get();
    
    let summaryData = { workDays: 0, lateMins: 0, leaveDays: 0, remainingLeave: user.annual_leave_balance, standardDays: 26, errorCount: 0 };
    if (statSnap.exists) {
        const s = statSnap.data() as MonthlyStats;
        summaryData = {
            workDays: s.work_days,
            lateMins: s.late_mins,
            leaveDays: s.leave_days,
            remainingLeave: user.annual_leave_balance,
            standardDays: s.standard_days,
            errorCount: s.error_count
        };
    }

    let approvals: LeaveRequest[] = [];
    let explanationApprovals: Explanation[] = [];

    if (PRIVILEGED_ROLES.includes(userRole)) {
        const qPending = reqRef.where("status", "==", "Pending");
        const pSnap = await qPending.get();
        const allPending = pSnap.docs.map(d => ({...(d.data() as LeaveRequest), id: d.id} as LeaveRequest));

        const qExpPending = expRef.where("status", "==", "Pending");
        const eSnap = await qExpPending.get();
        const allExpPending = eSnap.docs.map(d => ({...(d.data() as Explanation), id: d.id} as Explanation));

        if (GLOBAL_ADMINS.includes(userRole)) {
            approvals = allPending.filter(r => r.employee_id !== user.employee_id);
            explanationApprovals = allExpPending.filter(r => r.employee_id !== user.employee_id);
        } else if (MANAGERS.includes(userRole)) {
            approvals = allPending.filter(r => {
                if (r.employee_id === user.employee_id) return false;
                const requester = contacts.find(c => c.employee_id === r.employee_id);
                return requester && String(requester.direct_manager_id) === String(user.employee_id);
            });
            explanationApprovals = allExpPending.filter(r => {
                if (r.employee_id === user.employee_id) return false;
                const requester = contacts.find(c => c.employee_id === r.employee_id);
                return requester && String(requester.direct_manager_id) === String(user.employee_id);
            });
        }
    }

    // Refresh user profile in case it changed (status check happens in UI)
    const userRef = await db.collection(COLLECTIONS.EMPLOYEES).doc(user.id || user.employee_id).get();
    const updatedUserProfile = userRef.exists ? ({...userRef.data(), id: userRef.id} as Employee) : user;


    return {
        success: true,
        data: {
            userProfile: updatedUserProfile,
            history: { history: historyList, summary: summaryData },
            notifications: { approvals, explanationApprovals, myRequests, myExplanations },
            myRequests,
            myExplanations,
            teamLeaves,
            locations,
            contacts,
            holidays,
            shifts,
            systemConfig: sysConfig
        }
    };
  } catch (e: any) {
      console.error("Dashboard Load Error:", e);
      return { success: false, message: e.message };
  }
}