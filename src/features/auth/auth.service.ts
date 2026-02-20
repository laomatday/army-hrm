import { db, firebase } from "../../shared/services/firebase";
import { Employee } from "../../shared/types";
import { COLLECTIONS } from "../../shared/constants";
import { hashPassword } from "../../shared/utils/helpers";

export async function doLogin(loginId: string, password: string, deviceId: string) {
  try {
    const usersRef = db.collection(COLLECTIONS.EMPLOYEES);
    
    // 1. Tìm user theo Email hoặc Employee ID
    const qEmail = usersRef.where("email", "==", loginId);
    const qId = usersRef.where("employee_id", "==", loginId);
    
    let userSnap = await qEmail.get();
    if(userSnap.empty) userSnap = await qId.get();

    if (userSnap.empty) return { success: false, message: "Tài khoản không tồn tại." };

    const doc = userSnap.docs[0];
    let userData = doc.data() as Employee; // Use let to allow local modification
    const docId = doc.id; 
    
    // 2. Kiểm tra mật khẩu
    const dbPass = String(userData.password || "").trim();
    const inputHash = await hashPassword(password);
    
    // Hỗ trợ cả plain text (cũ) và hash (mới)
    const isMatch = dbPass === password || dbPass === inputHash;

    if (!isMatch) {
      return { success: false, message: "Mật khẩu không đúng." };
    }

    // 3. Kiểm tra trạng thái
    if (userData.status !== "Active") {
      return { success: false, message: "Tài khoản bị khóa hoặc ngưng hoạt động." };
    }

    // 4. Kiểm tra Thiết bị tin cậy (Trusted Device)
    const role = (userData.role || "").trim();
    
    // CẬP NHẬT: Chỉ duy nhất vai trò 'Admin' được phép đăng nhập tự do.
    // Tất cả các vai trò khác (Manager, HR, Staff...) đều phải check thiết bị.
    if (role !== 'Admin') {
        const storedTrustedId = (userData.trusted_device_id || "").trim();
        const currentDeviceId = (deviceId || "").trim();

        if (!currentDeviceId) {
             return { success: false, message: "Lỗi: Không xác định được ID thiết bị." };
        }

        if (!storedTrustedId) {
            // Lần đầu đăng nhập: Lưu ID thiết bị vào DB
            await usersRef.doc(docId).update({ 
                trusted_device_id: currentDeviceId
            });
            // Cập nhật biến local để trả về client đúng ngay lập tức cho session này
            userData.trusted_device_id = currentDeviceId;
        } else {
            // Các lần sau: So sánh ID
            if (storedTrustedId !== currentDeviceId) {
                return { 
                    success: false, 
                    message: `THIẾT BỊ LẠ! Tài khoản ${userData.employee_id} đã gắn liền với thiết bị khác. Vui lòng liên hệ Admin để reset.` 
                };
            }
        }
    }

    // Prepare data for client (remove sensitive info like password)
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