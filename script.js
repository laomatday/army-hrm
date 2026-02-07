// ==========================================
// 1. CẤU HÌNH & KẾT NỐI FIREBASE
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyC0zYfNJS7rXo5FBfFw43HHZ8ahDdI9P24",
    authDomain: "army-hrm-cbe58.firebaseapp.com",
    projectId: "army-hrm-cbe58",
    storageBucket: "army-hrm-cbe58.firebasestorage.app",
    messagingSenderId: "501706879552",
    appId: "1:501706879552:web:76eba9e412651938cc25a5"
};

// Khởi tạo Firebase
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
const storage = firebase.storage();

// --- BIẾN TOÀN CỤC ---
var currentUser = null;
var videoStream = null;
var allHistoryData = [];
var viewHistoryDate = new Date();
var cachedContacts = [];
var cachedLocations = [];
var cachedHolidays = [];
var cachedConfig = { off_days: [0], tolerance: 15 };
var cachedNotifications = null;
var refreshInterval = null;

var myDeviceId = getDeviceId();
var currentHistoryPage = 0;
const HISTORY_PAGE_SIZE = 10;
var currentReqType = "Nghỉ phép";

// ==========================================
// 2. KHỞI ĐỘNG & AUTHENTICATION (FIX LỖI TREO & TÌM USER)
// ==========================================

function getDeviceId() {
    var devId = localStorage.getItem("army_device_id");
    if (!devId) {
        devId = "DEV_" + Date.now().toString(36) + Math.random().toString(36).substr(2, 5).toUpperCase();
        localStorage.setItem("army_device_id", devId);
    }
    return devId;
}

document.addEventListener("DOMContentLoaded", function () {
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            console.log("🔓 Session Active:", user.email);
            
            // Tải cấu hình ngay để tránh lỗi check-in sau này
            await loadSystemConfigs();

            try {
                // --- CHIẾN LƯỢC TÌM KIẾM THÔNG MINH (Smart Lookup) ---
                // Bước 1: Tìm chính xác theo Email (Ưu tiên số 1)
                let userDoc = null;
                let empId = null;

                const emailQuery = await db.collection('employees').where('email', '==', user.email).limit(1).get();
                
                if (!emailQuery.empty) {
                    const doc = emailQuery.docs[0];
                    userDoc = doc.data();
                    empId = doc.id;
                    console.log("✅ Tìm thấy hồ sơ qua Email:", empId);
                } else {
                    // Bước 2: Nếu không thấy Email, thử tìm bằng ID (fallback)
                    // (Dành cho trường hợp email trong DB chưa cập nhật hoặc khác Auth)
                    const fallbackId = user.email.split('@')[0];
                    console.log("⚠️ Không thấy Email, thử tìm ID:", fallbackId);
                    
                    const docSnap = await db.collection('employees').doc(fallbackId).get();
                    if (docSnap.exists) {
                        userDoc = docSnap.data();
                        empId = fallbackId;
                    }
                }

                // --- XỬ LÝ KẾT QUẢ ---
                if (userDoc && empId) {
                    currentUser = userDoc;
                    currentUser.Employee_ID = empId; // Gán ID chuẩn
                    
                    // Kiểm tra thiết bị
                    const devCheck = await verifyAndBindDevice(empId);
                    if (!devCheck.success) {
                        alert(devCheck.msg); // Dùng Alert để chắc chắn user đọc được
                        await auth.signOut();
                        return;
                    }

                    localStorage.setItem("army_user_v2026", JSON.stringify(currentUser));
                    showMainApp();
                } else {
                    // KHÔNG TÌM THẤY -> Logout ngay để tránh treo màn hình trắng
                    alert(`LỖI: Không tìm thấy hồ sơ nhân viên cho email "${user.email}".\nVui lòng liên hệ Admin kiểm tra lại Database.`);
                    await auth.signOut();
                    showLoginScreen();
                }
            } catch (e) {
                console.error("Login Error:", e);
                alert("Lỗi hệ thống: " + e.message);
                await auth.signOut();
                showLoginScreen();
            }
        } else {
            showLoginScreen();
        }
    });

    setInterval(updateClock, 1000);
    updateClock();
    
    const passInput = document.getElementById("login-pass");
    if(passInput) passInput.addEventListener("keydown", (e) => { if (e.key === "Enter") handleLogin(); });
});

// --- LOAD CONFIG ---
async function loadSystemConfigs() {
    console.log("🔄 Đang tải cấu hình...");
    try {
        const [locSnap, holiSnap, confSnap] = await Promise.all([
            db.collection('locations').get(),
            db.collection('holidays').get(),
            db.collection('system_config').get()
        ]);

        // 1. LOCATIONS: Chuẩn hóa Latitude/Longitude
        cachedLocations = [];
        locSnap.forEach(d => {
            const data = d.data();
            cachedLocations.push({ 
                id: d.id, 
                // Fix: Lấy cả Latitude (hoa) hoặc latitude (thường)
                latitude: data.Latitude || data.latitude, 
                longitude: data.Longitude || data.longitude,
                radius: data.Radius_Meters || data.radius_meters || 100, // Mặc định 100m
                name: data.Location_Name || data.location_name
            });
        });

        // 2. HOLIDAYS
        cachedHolidays = [];
        holiSnap.forEach(d => {
            const data = d.data();
            // Fix: Lấy From_Date (hoa) hoặc from_date (thường)
            const fRaw = data.From_Date || data.from_date;
            const tRaw = data.To_Date || data.to_date;
            
            const from = fRaw && fRaw.toDate ? fRaw.toDate() : new Date(fRaw);
            const to = tRaw && tRaw.toDate ? tRaw.toDate() : new Date(tRaw || fRaw);
            
            cachedHolidays.push({ name: data.Name || data.name, from_date: from, to_date: to });
        });

        // 3. CONFIG
        confSnap.forEach(d => {
            const data = d.data();
            const val = data.config_value !== undefined ? data.config_value : data.value;
            // Fix: Check key chữ hoa (OFF_DAYS)
            if (d.id === 'OFF_DAYS' || data.config_key === 'OFF_DAYS') {
                cachedConfig.off_days = String(val).split(',').map(Number);
            }
            if (d.id === 'LATE_TOLERANCE' || data.config_key === 'LATE_TOLERANCE') {
                cachedConfig.tolerance = Number(val);
            }
        });
        
        console.log(`✅ Config Loaded: ${cachedLocations.length} locations`);
    } catch (e) { 
        console.warn("Config Load Error:", e); 
    }
}

// --- LOGIN ---
window.handleLogin = async function () {
    const userEl = document.getElementById("login-user");
    const passEl = document.getElementById("login-pass");
    if (!userEl.value || !passEl.value) return showToast("error", "Nhập thiếu thông tin!");

    showLoading(true);
    const inputId = userEl.value.trim();
    const email = inputId.includes('@') ? inputId : `${inputId}@army.vn`; 
    const password = passEl.value.trim();

    try {
        await auth.signInWithEmailAndPassword(email, password);
    } catch (error) {
        if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
            try {
                // Migration Logic: Tự tạo Auth nếu khớp DB cũ
                const doc = await db.collection('employees').doc(inputId).get();
                if (doc.exists) {
                    const data = doc.data();
                    if (String(data.password) === String(password)) {
                        const realEmail = data.email || email;
                        try {
                            await auth.createUserWithEmailAndPassword(realEmail, password);
                            showToast("success", "Kích hoạt thành công! Đang đăng nhập...");
                        } catch (createErr) {
                            if (createErr.code === 'auth/email-already-in-use') {
                                await auth.signInWithEmailAndPassword(realEmail, password);
                            } else throw createErr;
                        }
                    } else { showToast("error", "Sai mật khẩu hệ thống!"); }
                } else { showToast("error", "Mã nhân viên không tồn tại!"); }
            } catch (dbErr) { showToast("error", "Lỗi DB: " + dbErr.message); }
        } else { showToast("error", error.message); }
        showLoading(false); // Tắt loading nếu lỗi
    }
};

async function verifyAndBindDevice(empId) {
    const devRef = db.collection('employee_devices').doc(empId);
    try {
        const doc = await devRef.get();
        if (!doc.exists) {
            await devRef.set({
                employee_id: empId, device_id: myDeviceId,
                first_login: firebase.firestore.FieldValue.serverTimestamp(),
                last_login: firebase.firestore.FieldValue.serverTimestamp(),
                status: 'Trusted'
            });
            return { success: true, msg: "Liên kết thiết bị thành công" };
        } else {
            const data = doc.data();
            if (data.status === 'Locked') return { success: false, msg: "Tài khoản bị khóa thiết bị!" };
            if (data.device_id === myDeviceId) {
                await devRef.update({ last_login: firebase.firestore.FieldValue.serverTimestamp() });
                return { success: true, msg: "Thiết bị hợp lệ" };
            } else {
                return { success: false, msg: "Thiết bị lạ! Vui lòng liên hệ Admin." };
            }
        }
    } catch (e) { return { success: false, msg: "Lỗi kiểm tra thiết bị" }; }
}

window.logout = function () {
    if (refreshInterval) clearInterval(refreshInterval);
    auth.signOut();
    localStorage.removeItem("army_user_v2026");
    currentUser = null;
    showLoginScreen();
};

function showLoginScreen() {
    document.getElementById("view-login").classList.remove("hidden");
    document.getElementById("view-main").classList.add("hidden");
    toggleGlobalNav(false);
}

// ==========================================
// 3. CORE: DASHBOARD (FIX LỖI TREO VĨNH VIỄN)
// ==========================================

function showMainApp() {
    document.getElementById("view-login").classList.add("hidden");
    document.getElementById("view-main").classList.remove("hidden");
    toggleGlobalNav(true);
    renderUserInfo();
    switchTab("home");
    toggleHomeState("loading");

    loadDashboardData();
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(loadDashboardData, 60000); 
}

async function loadDashboardData() {
    if (!currentUser) return;
    const empId = currentUser.Employee_ID || currentUser.employee_id; // Lấy ID an toàn

    try {
        // 1. Sync Profile
        const uDoc = await db.collection('employees').doc(empId).get();
        if(uDoc.exists) {
            currentUser = { ...currentUser, ...uDoc.data() };
            renderUserInfo();
        }

        // 2. Load History
        const now = new Date();
        const curM = now.getMonth() + 1;
        const curY = now.getFullYear();
        setText("current-month-badge", `${curM}/${curY}`);

        const stdDays = calculateStandardDays(curM, curY);
        const startM = new Date(curY, curM - 1, 1);
        
        // --- QUAN TRỌNG: TRUY VẤN NÀY CẦN INDEX ---
        // Nếu Console báo lỗi đỏ có link, anh phải bấm vào link đó để tạo Index
        const logsSnap = await db.collection('attendance_logs')
            .where('employee_id', '==', empId)
            .where('time_in', '>=', startM)
            .orderBy('time_in', 'desc').get();

        const leaveSnap = await db.collection('leave_requests')
            .where('employee_id', '==', empId)
            .where('status', '==', 'Approved').get();

        // Xử lý dữ liệu hiển thị
        processHistoryData(logsSnap, leaveSnap, stdDays);

        // 3. Notifications
        await loadNotifications(empId);

        // 4. Contacts (Lazy)
        if(cachedContacts.length === 0) loadContacts();

    } catch(e) {
        console.error("Dashboard Error:", e);
        // Nếu lỗi do thiếu Index, hiển thị hướng dẫn
        if(e.message.includes("index")) {
            console.log("⚠️ CẦN TẠO INDEX: Anh hãy mở Console (F12) và bấm vào đường link trong thông báo lỗi màu đỏ của Firebase.");
            alert("Hệ thống cần tạo Index lần đầu. Vui lòng xem Console (F12) để lấy link kích hoạt.");
        }
    } finally {
        // [QUAN TRỌNG] Luôn tắt loading để không bị treo
        checkTodayStatus(); 
        
        // Buộc tắt loading UI nếu checkTodayStatus không tắt được
        const loadingEl = document.getElementById("state-loading");
        if(loadingEl && !loadingEl.classList.contains("hidden")) {
             // Nếu vẫn đang loading -> chuyển về idle
             toggleHomeState("idle");
        }
    }
}

function processHistoryData(logsSnap, leaveSnap, stdDays) {
    const dailyMap = {};
    const now = new Date();
    const curM = now.getMonth() + 1;
    const curY = now.getFullYear();
    const limitDate = (viewHistoryDate.getMonth() === now.getMonth()) ? now.getDate() : new Date(curY, curM, 0).getDate();

    logsSnap.forEach(doc => {
        const d = doc.data();
        const dateStr = formatDateVN(d.time_in ? d.time_in.toDate() : new Date());
        if (!dailyMap[dateStr]) dailyMap[dateStr] = { logs: [] };
        dailyMap[dateStr].logs.push(d);
    });

    const leaveMap = {};
    leaveSnap.forEach(doc => {
        const req = doc.data();
        const d = new Date(req.from_date);
        leaveMap[formatDateVN(d)] = req;
    });

    allHistoryData = [];
    let summary = { workDays: 0, lateMins: 0, errorCount: 0, leaveDays: 0, standardDays: stdDays };

    for (let d = limitDate; d >= 1; d--) {
        const dateObj = new Date(curY, curM - 1, d);
        const dateStr = formatDateVN(dateObj);
        
        let item = {
            Date: dateStr, Time_In: "...", Time_Out: "...", 
            Late: 0, Status_Html: "", 
            Bg_Class: "bg-slate-50", 
            Icon_Html: `<div class="w-10 h-10 rounded-xl bg-slate-200 text-slate-400 flex items-center justify-center"><i class="fa-solid fa-minus"></i></div>`
        };

        if (dailyMap[dateStr]) {
            const logs = dailyMap[dateStr].logs;
            logs.sort((a,b) => a.time_in.seconds - b.time_in.seconds);
            const first = logs[0];
            const last = logs[logs.length-1];
            
            item.Time_In = formatTimeOnly(first.time_in.toDate());
            item.Time_Out = (last.time_out) ? formatTimeOnly(last.time_out.toDate()) : "...";
            
            let totalLate = 0;
            logs.forEach(l => totalLate += (l.late_minutes || 0));
            item.Late = totalLate;
            summary.lateMins += totalLate;
            summary.workDays += 1;

            if (totalLate > 0) {
                item.Bg_Class = "bg-white";
                item.Icon_Html = `<div class="w-10 h-10 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center shadow-sm"><i class="fa-solid fa-clock"></i></div>`;
                item.Status_Html = `<span class="text-[10px] font-bold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-md">Trễ ${totalLate}p</span>`;
            } else {
                item.Bg_Class = "bg-white";
                item.Icon_Html = `<div class="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-sm"><i class="fa-solid fa-check"></i></div>`;
                item.Status_Html = `<span class="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">Công chuẩn</span>`;
            }
        } 
        else if (leaveMap[dateStr]) {
            item.Bg_Class = "bg-blue-50/50";
            item.Icon_Html = `<div class="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shadow-sm"><i class="fa-solid fa-umbrella-beach"></i></div>`;
            item.Status_Html = `<span class="text-[10px] font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-md">${leaveMap[dateStr].request_type}</span>`;
            summary.workDays += 1;
            summary.leaveDays += 1;
        }
        else {
            const holi = cachedHolidays.find(h => isDateInRange(dateObj, h.from_date, h.to_date));
            if (holi) {
                item.Bg_Class = "bg-purple-50/50";
                item.Icon_Html = `<div class="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center shadow-sm"><i class="fa-solid fa-gift"></i></div>`;
                item.Status_Html = `<span class="text-[10px] font-bold text-purple-600 bg-purple-100 px-2 py-0.5 rounded-md">${holi.name}</span>`;
                summary.workDays += 1;
            } else {
                item.Status_Html = `<span class="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">Vắng</span>`;
            }
        }
        allHistoryData.push(item);
    }

    renderHistoryStats(summary);
    currentHistoryPage = 0;
    renderActivityHistory();
}

function calculateStandardDays(month, year) {
    const daysInMonth = new Date(year, month, 0).getDate();
    let count = 0;
    const cleanHolidays = cachedHolidays.map(h => ({
        start: new Date(h.from_date).setHours(0,0,0,0),
        end: new Date(h.to_date).setHours(23,59,59,999)
    }));

    for(let d=1; d<=daysInMonth; d++) {
        const date = new Date(year, month-1, d);
        const day = date.getDay();
        if(cachedConfig.off_days.includes(day)) continue;
        const isHoli = cleanHolidays.some(h => date.getTime() >= h.start && date.getTime() <= h.end);
        if(!isHoli) count++;
    }
    return count;
}

async function loadNotifications(empId) {
    let approvals = [];
    if (["Manager", "Admin", "HR"].includes(currentUser.Role)) {
        const appSnap = await db.collection('leave_requests').where('status', '==', 'Pending').get();
        appSnap.forEach(d => {
            const val = d.data();
            if(val.employee_id !== empId) approvals.push({id: d.id, ...val});
        });
    }
    const mySnap = await db.collection('leave_requests')
        .where('employee_id', '==', empId)
        .orderBy('created_at', 'desc').limit(10).get();
    
    cachedNotifications = { 
        approvals: approvals, 
        myRequests: mySnap.docs.map(d => ({id: d.id, ...d.data()})) 
    };
    renderNotificationsBadge();
    renderMyRequestsList(cachedNotifications.myRequests);
}

// ==========================================
// 4. CHECK-IN
// ==========================================

window.triggerCheckIn = async function () {
    console.log("📍 Check-in Start...");
    // 1. Check Config
    if (!cachedLocations || cachedLocations.length === 0) {
        showLoading(true);
        await loadSystemConfigs();
        showLoading(false);
        if (cachedLocations.length === 0) return alert("Lỗi: Không tải được danh sách địa điểm!");
    }

    // 2. Open Camera
    const modal = document.getElementById("modal-camera");
    if (modal) {
        modal.classList.remove("hidden");
        toggleGlobalNav(false);
        navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } })
            .then(s => {
                videoStream = s;
                const vid = document.getElementById("video");
                if (vid) { vid.srcObject = s; vid.play(); }
            })
            .catch(err => {
                alert("Lỗi Camera: " + err.message);
                closeCamera();
            });
    }
};

window.takePicture = function () {
    const v = document.getElementById("video");
    const c = document.createElement("canvas");
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d").drawImage(v, 0, 0);
    const b64 = c.toDataURL("image/jpeg", 0.6);
    closeCamera();
    showLoading(true);

    navigator.geolocation.getCurrentPosition(async (p) => {
        try {
            const lat = p.coords.latitude;
            const lng = p.coords.longitude;
            
            const ref = storage.ref().child(`attendance/${currentUser.Employee_ID}/${Date.now()}.jpg`);
            await ref.putString(b64, 'data_url');
            const url = await ref.getDownloadURL();

            const distInfo = findNearestOffice(lat, lng);
            const allowDist = cachedConfig.tolerance_dist || 200; 
            const status = distInfo.distance <= allowDist ? "Valid" : "Invalid";
            
            await db.collection('attendance_logs').add({
                employee_id: currentUser.Employee_ID,
                name: currentUser.Name || currentUser.full_name,
                time_in: firebase.firestore.FieldValue.serverTimestamp(),
                checkin_type: "GPS",
                checkin_lat: lat,
                checkin_lng: lng,
                distance_meters: Math.round(distInfo.distance),
                location_id: distInfo.location ? distInfo.location.id : "Unknown",
                selfie_url: url,
                status: status,
                work_date: firebase.firestore.Timestamp.now(), 
                device_id: myDeviceId,
                time_out: null 
            });

            showToast(status==="Valid"?"success":"error", status==="Valid"?"Check-in thành công!":`Xa ${Math.round(distInfo.distance)}m`);
            loadDashboardData();

        } catch(e) { 
            console.error(e);
            alert("Lỗi xử lý: " + e.message);
        } finally { showLoading(false); }
    }, (err) => {
        showLoading(false);
        alert("Lỗi GPS: " + err.message);
    }, { enableHighAccuracy: true, timeout: 15000 });
};

window.triggerCheckOut = async function() {
    showDialog("confirm", "Ra về", "Bạn muốn kết thúc ca làm việc?", async () => {
        showLoading(true);
        try {
            const today = new Date(); today.setHours(0,0,0,0);
            const snap = await db.collection('attendance_logs')
                .where('employee_id', '==', currentUser.Employee_ID)
                .where('work_date', '>=', firebase.firestore.Timestamp.fromDate(today))
                .where('time_out', '==', null).limit(1).get();

            if (!snap.empty) {
                const doc = snap.docs[0];
                await db.collection('attendance_logs').doc(doc.id).update({
                    time_out: firebase.firestore.FieldValue.serverTimestamp(),
                    checkin_type: 'CheckOut'
                });
                showToast("success", "Check-out thành công!");
            } else {
                showToast("error", "Không tìm thấy ca đang mở!");
            }
            loadDashboardData();
        } catch(e) { showToast("error", e.message); }
        finally { showLoading(false); }
    });
};

// --- UTILS ---
function findNearestOffice(lat, lng) {
    let minD = 9999999;
    let loc = null;
    
    // Debug: In ra để kiểm tra xem có load được location không
    console.log("📍 Checking location vs:", cachedLocations);

    cachedLocations.forEach(l => {
        // Lưu ý: l.latitude và l.longitude đã được chuẩn hóa ở hàm loadSystemConfigs
        if (l.latitude && l.longitude) {
            const d = getDist(lat, lng, l.latitude, l.longitude);
            if (d < minD) { 
                minD = d; 
                loc = l; 
            }
        }
    });
    
    // Trả về khoảng cách (mét) và location
    return { location: loc, distance: minD }; // getDist đã trả về mét
}

function getDist(lat1, lon1, lat2, lon2) {
    const R = 6371; 
    const dLat = (lat2-lat1) * Math.PI/180;
    const dLon = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)*Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function checkTodayStatus() {
    const todayStr = formatDateVN(new Date());
    const todayItem = allHistoryData.find(d => d.Date === todayStr);
    const isWorking = todayItem && todayItem.Time_In !== "..." && todayItem.Time_Out === "...";
    toggleHomeState(isWorking ? "working" : "idle");
}

function renderUserInfo() {
    if(!currentUser) return;
    
    // Ưu tiên lấy Name (chuẩn Code.gs), sau đó đến name, full_name
    // Anh Nghĩa lưu ý: Dòng này sẽ tìm mọi biến thể của tên
    const name = currentUser.Name || currentUser.name || currentUser.full_name || "User";
    const role = currentUser.Role || currentUser.role || "Staff";
    
    // Xử lý ID
    const empId = currentUser.Employee_ID || currentUser.employee_id || currentUser.employee_code;

    setText("user-name", getShortNameClient(name)); // Tên ngắn (Nghĩa)
    setText("profile-name", name); // Tên đầy đủ
    setText("header-role", role);
    setText("profile-id", `ID: ${empId}`);
    setText("leave-balance", currentUser.Annual_Leave_Balance || currentUser.annual_leave_balance || 0);
    setText("p-dept", currentUser.Department || currentUser.department || "N/A");
    setText("p-phone", currentUser.Phone || currentUser.phone || "Chưa cập nhật");
    setText("p-email", currentUser.Email || currentUser.email || "");
    
    // Avatar: Ưu tiên Face_Ref_URL (chuẩn Code.gs)
    const ava = currentUser.Face_Ref_URL || currentUser.face_ref_url || currentUser.Avatar || currentUser.avatar_url || 
                `https://ui-avatars.com/api/?name=${name}&background=10b981&color=fff`;
                
    document.querySelectorAll("#user-avatar, #profile-user-avatar").forEach(i => i.src = ava);
}

window.renderActivityHistory = function() {
    const list = document.getElementById("activity-history-list");
    if(!list) return;
    
    const start = currentHistoryPage * HISTORY_PAGE_SIZE;
    const end = start + HISTORY_PAGE_SIZE;
    const items = allHistoryData.slice(start, end);

    if (items.length === 0) {
        list.innerHTML = `<div class="text-center py-10 opacity-50"><p class="text-xs">Chưa có dữ liệu</p></div>`;
        return;
    }

    let html = "";
    items.forEach(item => {
        html += `
        <div class="${item.Bg_Class} p-3 rounded-[18px] border mb-3 flex items-start gap-3 shadow-[0_2px_8px_-4px_rgba(0,0,0,0.05)] animate-slide-up border-slate-100">
            <div class="shrink-0 mt-0.5">${item.Icon_Html}</div>
            <div class="flex-1 min-w-0">
                <div class="flex justify-between items-center mb-1">
                    <span class="font-bold text-sm text-slate-700">${item.Date}</span>
                    ${item.Status_Html}
                </div>
                <div class="text-[10px] text-slate-400 mt-1 font-medium">
                    ${item.Time_In} - ${item.Time_Out}
                </div>
            </div>
        </div>`;
    });

    if (end < allHistoryData.length) {
        html += `<div class="text-center pb-10"><button onclick="currentHistoryPage++; renderActivityHistory()" class="text-xs font-bold text-slate-400 hover:text-emerald-600">Xem thêm cũ hơn</button></div>`;
    }
    list.innerHTML = html;
}

function renderHistoryStats(s) {
    setText("hist-total-days", s.workDays);
    setText("hist-late-mins", s.lateMins);
    setText("hist-errors", s.errorCount);
    setText("home-stat-days", s.workDays);
    setText("home-stat-label", "Công chuẩn: " + s.standardDays);
    const bar = document.getElementById("work-progress-bar");
    if(bar) bar.style.width = Math.min((s.workDays/s.standardDays)*100, 100) + "%";
}

window.switchTab = (tabName) => {
    ["home","requests","contacts","profile"].forEach(x => document.getElementById("tab-"+x).classList.add("hidden"));
    document.getElementById("tab-"+tabName).classList.remove("hidden");
    const navItems = document.querySelectorAll(".nav-item");
    navItems.forEach(item => {
        const isActive = item.getAttribute("onclick").includes(`'${tabName}'`);
        if (isActive) {
            item.classList.add("active", "text-emerald-600");
            item.classList.remove("text-slate-400");
        } else {
            item.classList.remove("active", "text-emerald-600");
            item.classList.add("text-slate-400");
        }
    });
    if(tabName === 'requests') switchActivityMode('history');
    if(tabName === 'contacts') loadContacts();
}

// REQUEST & CONTACTS UI
window.submitRequest = async function() {
    const reason = document.getElementById("req-reason").value;
    const start = document.getElementById("req-date-start").value;
    const end = document.getElementById("req-date-end").value;
    if(!reason || !start) return showToast("error", "Thiếu thông tin!");
    showLoading(true);
    try {
        await db.collection('leave_requests').add({
            employee_id: currentUser.Employee_ID,
            name: currentUser.Name,
            request_type: currentReqType,
            from_date: start,
            to_date: end || start,
            reason: reason,
            status: "Pending",
            created_at: firebase.firestore.FieldValue.serverTimestamp()
        });
        showToast("success", "Gửi đơn thành công!");
        closeRequestModal();
        loadDashboardData();
    } catch(e) { showToast("error", e.message); }
    finally { showLoading(false); }
}

function renderMyRequestsList(data) {
    const c = document.getElementById("request-list-container");
    if(!c) return;
    c.innerHTML = (!data || data.length===0) ? `<p class="text-center text-xs text-slate-400 py-10">Chưa có đề xuất</p>` : 
    data.map(r => `<div class="bg-white p-3 rounded-xl border border-slate-100 mb-2 shadow-sm"><div class="flex justify-between mb-1"><span class="font-bold text-sm">${r.request_type}</span><span class="text-[10px] font-bold ${r.status==='Approved'?'text-emerald-500':r.status==='Rejected'?'text-red-500':'text-orange-500'}">${r.status}</span></div><p class="text-xs text-slate-500">${r.reason}</p></div>`).join('');
}

window.loadContacts = async () => {
    const list = document.getElementById("contacts-list");
    list.innerHTML = `<div class="text-center py-10"><i class="fa-solid fa-circle-notch fa-spin text-emerald-500"></i></div>`;
    try {
        const snap = await db.collection('employees').where('status','==','Active').get();
        cachedContacts = [];
        snap.forEach(doc => cachedContacts.push({id: doc.id, ...doc.data()}));
        let html = "";
        cachedContacts.forEach((c, i) => {
            const ava = c.face_ref_url || c.avatar_url || `https://ui-avatars.com/api/?name=${c.name}`;
            html += `<div class="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 mb-2 flex items-center gap-3 active:scale-95 transition-transform" onclick="openContactDetail(${i})">
                <img src="${ava}" class="w-10 h-10 rounded-full object-cover bg-slate-200">
                <div><p class="font-bold text-sm text-slate-800">${c.name || 'N/A'}</p><p class="text-xs text-slate-400">${c.position || 'Staff'}</p></div>
            </div>`;
        });
        list.innerHTML = html;
    } catch(e) { list.innerHTML = "Lỗi tải danh bạ"; }
}

window.openContactDetail = (idx) => {
    const c = cachedContacts[idx];
    if(!c) return;
    setText("contact-detail-name", c.name);
    setText("contact-detail-phone", c.phone);
    setText("contact-detail-email", c.email);
    document.getElementById("contact-detail-avatar").src = c.face_ref_url || c.avatar_url;
    document.getElementById("modal-contact-detail").classList.remove("hidden");
}

window.closeCamera = () => { if(videoStream) videoStream.getTracks().forEach(t=>t.stop()); document.getElementById("modal-camera").classList.add("hidden"); toggleGlobalNav(true); }
window.toggleGlobalNav = (show) => { const nav = document.getElementById("global-nav"); if(nav) nav.classList.toggle("hidden", !show); }
window.showToast = (type, msg) => {
    const t = document.getElementById("toast"); if(!t) return alert(msg);
    document.getElementById("toast-msg").innerText = msg;
    t.classList.remove("hidden", "opacity-0"); t.style.opacity = "1"; t.style.transform = "translate(-50%, 0)";
    setTimeout(() => { t.style.opacity = "0"; t.style.transform = "translate(-50%, -20px)"; setTimeout(() => t.classList.add("hidden"), 300); }, 3000);
}
window.showLoading = (s) => document.getElementById("loader").classList.toggle("hidden", !s);
function setText(id, t) { const e = document.getElementById(id); if(e) e.innerText = t; }
function getShortNameClient(n) { return n ? n.split(' ').pop() : 'User'; }
function formatTimeOnly(d) { return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; }
function formatDateVN(d) { return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`; }
function updateClock() { const d = new Date(); setText("clock-display", d.toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'})); setText("date-display", `Thứ ${d.getDay()+1}, ${d.getDate()}/${d.getMonth()+1}`); }
function isDateInRange(t, f, to) { const tg=t.getTime(); const s=new Date(f).setHours(0,0,0,0); const e=new Date(to||f).setHours(23,59,59,999); return tg>=s && tg<=e; }
window.showDialog = (t, ti, m, cb) => { if(confirm(`${ti}\n${m}`)) if(cb) cb(); };
window.switchActivityMode = (m) => { document.getElementById("view-act-history").classList.toggle("hidden", m!=='history'); document.getElementById("view-act-requests").classList.toggle("hidden", m!=='requests'); }
window.openRequestModal = (t) => { currentReqType=t; document.getElementById("modal-request").classList.remove("hidden"); toggleGlobalNav(false); }
window.closeRequestModal = () => { document.getElementById("modal-request").classList.add("hidden"); toggleGlobalNav(true); }
window.closeContactDetail = () => document.getElementById("modal-contact-detail").classList.add("hidden");
window.toggleHomeState = (s) => { ["loading","idle","working"].forEach(x => { const e=document.getElementById("state-"+x); if(e){e.classList.toggle("hidden", x!==s); if(x===s){e.classList.remove("opacity-0"); e.classList.add("opacity-100");}}}); }
function renderNotificationsBadge() { const c = (cachedNotifications?.approvals?.length||0); const dot=document.getElementById("noti-dot"); if(dot) dot.classList.toggle("hidden", c===0); }
