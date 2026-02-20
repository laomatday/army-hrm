import { db, storage } from "./firebase";
import { Employee } from "../types";
import { COLLECTIONS } from "./constants";
import { hashPassword } from "../utils/helpers";

export async function updateAvatar(employeeId: string, base64Image: string) {
    try {
        const usersRef = db.collection(COLLECTIONS.EMPLOYEES);
        const qId = usersRef.where("employee_id", "==", employeeId);
        const userSnap = await qId.get();
        if(userSnap.empty) return { success: false, message: "User not found" };
        
        const storageRef = storage.ref(`avatars/${employeeId}_${Date.now()}.jpg`);
        const response = await fetch(base64Image);
        const blob = await response.blob();
        await storageRef.put(blob);
        const imageUrl = await storageRef.getDownloadURL();

        await usersRef.doc(userSnap.docs[0].id).update({ face_ref_url: imageUrl });
        return { success: true, message: "Cập nhật ảnh thành công!", url: imageUrl };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}

export async function changePassword(employeeId: string, oldPass: string, newPass: string) {
    try {
        const usersRef = db.collection(COLLECTIONS.EMPLOYEES);
        const qId = usersRef.where("employee_id", "==", employeeId);
        const userSnap = await qId.get();
        if(userSnap.empty) return { success: false, message: "User not found" };
        
        const userData = userSnap.docs[0].data() as Employee;
        const dbPass = String(userData.password || "");
        
        const oldHash = await hashPassword(oldPass);
        const isMatch = dbPass === oldPass || dbPass === oldHash;

        if (!isMatch) return { success: false, message: "Mật khẩu cũ không đúng." };
        
        const newHash = await hashPassword(newPass);

        await usersRef.doc(userSnap.docs[0].id).update({ password: newHash });
        return { success: true, message: "Đổi mật khẩu thành công!" };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}