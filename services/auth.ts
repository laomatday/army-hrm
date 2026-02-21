import firebase, { db } from "./firebase";
import { Employee } from "../types";
import { COLLECTIONS } from "./constants";
import { hashPassword } from "../utils/helpers";

export async function doLogin(loginId: string, password: string, deviceId: string) {
  try {
    const usersRef = db.collection(COLLECTIONS.EMPLOYEES);
    
    // 1. Find user by Email or Employee ID
    const qEmail = usersRef.where("email", "==", loginId);
    const qId = usersRef.where("employee_id", "==", loginId);
    
    let userSnap = await qEmail.get();
    if(userSnap.empty) userSnap = await qId.get();

    if (userSnap.empty) return { success: false, message: "Tài khoản không tồn tại." };

    const doc = userSnap.docs[0];
    let userData = doc.data() as Employee;
    const docId = doc.id; 
    
    // 2. Check password
    const dbPass = String(userData.password || "").trim();
    const inputHash = await hashPassword(password);
    
    const isMatch = dbPass === password || dbPass === inputHash;

    if (!isMatch) {
      return { success: false, message: "Mật khẩu không đúng." };
    }

    // 3. Check status
    if (userData.status !== "Active") {
      return { success: false, message: "Tài khoản bị khóa hoặc ngưng hoạt động." };
    }

    // 4. Trusted Device Check
    const role = (userData.role || "").trim();
    
    if (role !== 'Admin') {
        const storedTrustedId = (userData.trusted_device_id || "").trim();
        const currentDeviceId = (deviceId || "").trim();

        if (!currentDeviceId) {
             return { success: false, message: "Lỗi: Không xác định được ID thiết bị." };
        }

        if (!storedTrustedId) {
            await usersRef.doc(docId).update({ 
                trusted_device_id: currentDeviceId
            });
            userData.trusted_device_id = currentDeviceId;
        } else {
            if (storedTrustedId !== currentDeviceId) {
                return { 
                    success: false, 
                    message: `THIẾT BỊ LẠ! Tài khoản ${userData.employee_id} đã gắn liền với thiết bị khác. Vui lòng liên hệ Admin để reset.` 
                };
            }
        }
    }

    const safeUser = { ...userData, id: docId };
    delete safeUser.password;

    return { success: true, data: safeUser };
  } catch (e: any) {
    console.error("Login Error:", e);
    return { success: false, message: "Lỗi Server: " + e.message };
  }
}

export async function saveDeviceToken(employeeDocId: string, token: string) {
    try {
        await db.collection(COLLECTIONS.EMPLOYEES).doc(employeeDocId).update({ 
            fcm_tokens: firebase.firestore.FieldValue.arrayUnion(token)
        });
    } catch(e) {}
}
