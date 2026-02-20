import { db } from "../../shared/services/firebase";
import { UserNotification } from "../../shared/types";
import { COLLECTIONS } from "../../shared/constants";

export async function sendSystemNotification(employeeId: string, title: string, body: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') {
    try {
        const noti: UserNotification = {
            employee_id: employeeId,
            title,
            body,
            type,
            is_read: false,
            created_at: new Date().toISOString()
        };
        await db.collection(COLLECTIONS.NOTIFICATIONS).add(noti);
    } catch (e) {
        console.error("Failed to send notification", e);
    }
}