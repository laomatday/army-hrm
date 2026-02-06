// ==========================================
// 1. CẤU HÌNH & BIẾN TOÀN CỤC
// ==========================================
// Firebase Config (Dùng đúng thông tin của bạn)
const firebaseConfig = {
    apiKey: "AIzaSyC0zYfNJS7rXo5FBfFw43HHZ8ahDdI9P24",
    authDomain: "army-hrm-cbe58.firebaseapp.com",
    projectId: "army-hrm-cbe58",
    storageBucket: "army-hrm-cbe58.firebasestorage.app",
    messagingSenderId: "501706879552",
    appId: "1:501706879552:web:76eba9e412651938cc25a5"
};

// Khởi tạo Firebase (Compat Mode)
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
const storage = firebase.storage();

// --- BIẾN TOÀN CỤC (GIỮ NGUYÊN 100% TỪ JS.HTML) ---
var currentUser = null;
var videoStream = null;
var allHistoryData = [];
var viewHistoryDate = new Date();
var cachedContacts = [];
var cachedLocations = [];
var cachedNotifications = null;
var refreshInterval = null;
var selectedRequests = [];

var myDeviceId = getDeviceId();
var currentHistoryPage = 0; 
const HISTORY_PAGE_SIZE = 5; 

var tempAvatarBase64 = null;
var currentReqType = "Nghỉ phép";
var currentProfileLocation = "";
var currentRejectId = null;

// --- HTML SKELETONS (GIỮ NGUYÊN) ---
const SKELETON_CONTACT = `
    <div class="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-3 mb-3 animate-pulse">
        <div class="w-12 h-12 rounded-2xl bg-slate-200"></div>
        <div class="flex-1 space-y-2">
            <div class="h-4 w-32 bg-slate-200 rounded-full"></div>
            <div class="h-3 w-20 bg-slate-200 rounded-full"></div>
        </div>
        <div class="w-10 h-10 rounded-2xl bg-slate-200"></div>
    </div>`.repeat(5);

const SKELETON_REQUEST = `
    <div class="bg-white p-5 rounded-[24px] shadow-sm border border-white mb-4 animate-pulse">
       <div class="flex justify-between items-start mb-4">
          <div class="flex gap-4">
             <div class="w-11 h-11 rounded-2xl bg-slate-200"></div>
             <div class="space-y-2">
                <div class="h-4 w-24 bg-slate-200 rounded-full"></div>
                <div class="h-3 w-16 bg-slate-200 rounded-full"></div>
             </div>
          </div>
          <div class="w-16 h-6 bg-slate-200 rounded-lg"></div>
       </div>
       <div class="h-10 w-full bg-slate-200 rounded-2xl"></div>
    </div>`.repeat(3);

// ==========================================
// 2. KHỞI ĐỘNG HỆ THỐNG
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
    // Khôi phục trạng thái chấm đỏ ngay lập tức nếu có hàm này
    if (typeof restoreBadgeState === "function") restoreBadgeState();

    // --- THAY ĐỔI: Lắng nghe trạng thái đăng nhập Realtime từ Firebase ---
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            console.log("🔓 Session Active:", user.email);
            
            // Logic lấy ID từ email
            let empId = user.email.split('@')[0];
            
            // FIX: Nếu là admin@test.com, ép lấy dữ liệu của laomatday để có dữ liệu hiển thị
            if(user.email === 'admin@test.com') empId = 'laomatday'; 

            try {
                const doc = await db.collection('employees').doc(empId).get();
                if (doc.exists) {
                    currentUser = doc.data();
                    // Đảm bảo Object luôn có ID để không bị undefined trong .where()
                    currentUser.employee_id = empId; 
                    
                    localStorage.setItem("army_user_v2026", JSON.stringify(currentUser));
                    showMainApp();
                } else {
                    console.error("❌ Không tìm thấy hồ sơ cho ID:", empId);
                    showToast("error", "Tài khoản chưa có hồ sơ nhân viên!");
                    // Nếu muốn vẫn cho admin vào dù ko có profile thì bỏ logout()
                    // logout(); 
                }
            } catch(e) {
                console.error("Lỗi Auth:", e);
            }
        } else {
            showLoginScreen();
        }
    });

    setInterval(updateClock, 1000);
    updateClock();

    // Event listeners cho phím Enter
    var inputUser = document.getElementById("login-user");
    var inputPass = document.getElementById("login-pass");
    const triggerLoginOnEnter = (e) => { if (e.key === "Enter") { e.preventDefault(); handleLogin(); } };
    if (inputUser) inputUser.addEventListener("keydown", triggerLoginOnEnter);
    if (inputPass) inputPass.addEventListener("keydown", triggerLoginOnEnter);
});

// ==========================================
// 3. LOGIC AUTH (LOGIN / LOGOUT)
// ==========================================

window.handleLogin = async function () {
    var userEl = document.getElementById("login-user");
    var passEl = document.getElementById("login-pass");
    
    if (!userEl || !passEl || !userEl.value || !passEl.value) {
        showToast("error", "Vui lòng nhập mã nhân viên và mật khẩu!");
        return;
    }

    showLoading(true);
    
    // Chuẩn hóa dữ liệu
    const id = userEl.value.trim(); // Ví dụ: laomatday
    const email = id.includes('@') ? id : `${id}@army.vn`;
    const password = passEl.value.trim();

    console.log("🚀 Đang thử đăng nhập:", email);

    try {
        // 1. Thử đăng nhập trực tiếp
        await auth.signInWithEmailAndPassword(email, password);
        console.log("✅ Đăng nhập thành công!");
        // Không cần làm gì thêm, onAuthStateChanged sẽ tự chuyển màn hình
        
    } catch (error) {
        console.warn("❌ Lỗi Firebase Auth (400):", error.code);

        // 2. Xử lý lỗi 400 - Migration Logic (Dành cho lần đầu đăng nhập)
        // Các mã lỗi Firebase thường gặp khi chưa có account: 'auth/user-not-found', 'auth/invalid-credential'
        if (error.code === 'auth/user-not-found' || 
            error.code === 'auth/invalid-credential' || 
            error.code === 'auth/invalid-login-credentials') {
            
            console.log("🔍 Kiểm tra hồ sơ trong Firestore...");
            
            try {
                // Tìm kiếm nhân viên bằng ID (document ID phải là 'laomatday')
                const doc = await db.collection('employees').doc(id).get();
                
                if (doc.exists) {
                    const data = doc.data();
                    // Kiểm tra mật khẩu cũ từ Excel (Firestore)
                    if (String(data.password) === password) {
                        console.log("✨ Mật khẩu khớp! Đang tự động kích hoạt tài khoản...");
                        
                        // Tạo tài khoản Auth mới dựa trên dữ liệu Firestore
                        await auth.createUserWithEmailAndPassword(email, password);
                        showToast("success", "Kích hoạt tài khoản thành công!");
                        return; // onAuthStateChanged sẽ lo phần còn lại
                    } else {
                        showToast("error", "Mật khẩu không chính xác!");
                    }
                } else {
                    showToast("error", "Mã nhân viên không tồn tại trên hệ thống!");
                }
            } catch (dbError) {
                console.error("Lỗi Database:", dbError);
                showToast("error", "Lỗi kết nối dữ liệu: " + dbError.message);
            }
        } else if (error.code === 'auth/too-many-requests') {
            showToast("error", "Bạn đã nhập sai quá nhiều lần. Hãy thử lại sau 5 phút!");
        } else {
            showToast("error", "Lỗi đăng nhập: " + error.message);
        }
        
        showLoading(false);
    }
};

window.logout = function () {
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }
    auth.signOut();
    localStorage.removeItem("army_user_v2026");
    currentUser = null;
    var passEl = document.getElementById("login-pass");
    if (passEl) passEl.value = "";
    showLoginScreen();
};

function showLoginScreen() {
    document.getElementById("view-login").classList.remove("hidden");
    document.getElementById("view-main").classList.add("hidden");
    toggleGlobalNav(false);
}

function routeUserFlow() {
    if (!currentUser) {
        logout();
        return;
    }
    document.getElementById("view-login").classList.add("hidden");
    showMainApp();
}

// Hàm UI Helper
function toggleGlobalNav(show) {
    var nav = document.getElementById("global-nav");
    if (!nav) return;
    if (show) nav.classList.remove("hidden");
    else nav.classList.add("hidden");
}
// ==========================================
// 4. TỐI ƯU HÓA: LOGIC LOAD DATA (SUPER API REPLACEMENT)
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
    refreshInterval = setInterval(loadDashboardData, 30000); 
}

async function loadDashboardData() {
    if (!currentUser) {
        console.error("❌ Không có thông tin User để load dữ liệu");
        return;
    }

    // Đảm bảo lấy được ID (thử tất cả các kiểu viết chữ hoa/thường)
    const empId = currentUser.employee_id || currentUser.employee_code || currentUser.Employee_ID;
    
    if (!empId) {
        console.error("❌ Không tìm thấy ID nhân viên trong Object:", currentUser);
        showToast("error", "Lỗi hồ sơ nhân viên (Thiếu ID)");
        return;
    }

    console.log("📊 Đang load Dashboard cho ID:", empId);

    try {
        // 1. Đồng bộ Profile Realtime
        const userDoc = await db.collection('employees').doc(empId).get();
        if (userDoc.exists) {
            currentUser = { ...currentUser, ...userDoc.data() };
            renderUserInfo();
        }

        // 2. Lấy Lịch sử & Thống kê tháng hiện tại
        const now = new Date();
        const curM = now.getMonth() + 1;
        const curY = now.getFullYear();
        setText("current-month-badge", `${curM}/${curY}`);

        const isViewingCurrentMonth =
            viewHistoryDate.getMonth() === now.getMonth() &&
            viewHistoryDate.getFullYear() === now.getFullYear();

        if (isViewingCurrentMonth) {
            const startOfMonth = new Date(curY, curM - 1, 1);
            
            // TRUY VẤN LỊCH SỬ (Cần Index)
            const logsSnap = await db.collection('attendance_logs')
                .where('employee_id', '==', empId)
                .where('time_in', '>=', startOfMonth)
                .orderBy('time_in', 'desc')
                .get();

            const logs = [];
            logsSnap.forEach(doc => logs.push({ id: doc.id, ...doc.data() }));
            
            allHistoryData = processLogsToHistory(logs);

            // Tải thống kê từ bảng stats (Migration data)
            const statsDoc = await db.collection('monthly_stats').doc(`${empId}_${curM}_${curY}`).get();
            if (statsDoc.exists) renderHistoryStats(statsDoc.data());

            if (currentHistoryPage === 0) renderActivityHistory();
        }

        // 3. XỬ LÝ THÔNG BÁO (Duyệt đơn)
        const approvalsSnap = await db.collection('leave_requests')
            .where('status', '==', 'Pending')
            .get();

        let approvals = [];
        approvalsSnap.forEach(doc => {
            const d = doc.data();
            // Nếu bạn là Manager/Admin thì mới thấy đơn của người khác
            if (d.employee_id !== empId) {
                approvals.push({ Request_ID: doc.id, ...d });
            }
        });

        const myReqsSnap = await db.collection('leave_requests')
            .where('employee_id', '==', empId)
            .orderBy('created_at', 'desc')
            .limit(10)
            .get();
        
        let myRequests = [];
        myReqsSnap.forEach(doc => myRequests.push({ Request_ID: doc.id, ...doc.data() }));

        cachedNotifications = { approvals, myRequests };
        renderNotificationsBadge(cachedNotifications);
        renderMyRequestsList(myRequests);

        // 4. LOAD DANH BẠ (Chỉ load 1 lần)
        if (cachedContacts.length === 0) {
            const cSnap = await db.collection('employees').where('status', '==', 'Active').get();
            cSnap.forEach(doc => cachedContacts.push(doc.data()));
            renderContactList(cachedContacts);
        }

        updateCurrentStatusUI();
        toggleHomeState(allHistoryData.some(d => d.Time_Out === '...') ? "working" : "idle");

    } catch (e) {
        console.error("❌ Lỗi loadDashboardData:", e);
        // Nếu lỗi Index, Firebase sẽ trả về link ở đây
    }
}

function renderMyRequestsList(requests) {
    const container = document.getElementById("request-list-container");
    if (!container) return;

    if (!requests || requests.length === 0) {
        container.innerHTML = `<div class="text-center py-10 opacity-50 text-xs">Chưa có đề xuất nào</div>`;
        return;
    }

    let html = "";
    requests.forEach(req => {
        const status = req.status || req.Status || "Pending";
        let badgeClass = "bg-orange-50 text-orange-600 border-orange-100";
        if (status === "Approved") badgeClass = "bg-emerald-50 text-emerald-600 border-emerald-100";
        if (status === "Rejected") badgeClass = "bg-red-50 text-red-600 border-red-100";

        html += `
            <div class="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-3 animate-slide-up">
                <div class="flex justify-between items-start mb-2">
                    <span class="font-bold text-slate-700 text-sm">${req.request_type || req.Type}</span>
                    <span class="px-2 py-0.5 rounded-lg text-[9px] font-black border ${badgeClass} uppercase">${status}</span>
                </div>
                <p class="text-xs text-slate-500 line-clamp-2 italic">"${req.reason || req.Reason}"</p>
                <p class="text-[10px] text-slate-400 mt-2 text-right">${req.from_date || req.Dates || ""}</p>
            </div>`;
    });
    container.innerHTML = html;
}

// HÀM TỔNG QUẢN: Thay thế getDashboardData của GAS
async function loadDashboardData() {
    if (!currentUser) return;

    // Lấy ID an toàn, kiểm tra mọi trường hợp chữ hoa/thường
    const empId = currentUser.employee_id || currentUser.employee_code || currentUser.Employee_ID;
    
    // NẾU KHÔNG CÓ ID THÌ DỪNG LẠI NGAY, KHÔNG CHẠY TRUY VẤN
    if (!empId) {
        console.warn("⚠️ Bỏ qua loadDashboardData do empId đang undefined");
        return;
    }

    try {
        const now = new Date();
        const curM = now.getMonth() + 1;
        const curY = now.getFullYear();
        setText("current-month-badge", `${curM}/${curY}`);

        const startOfMonth = new Date(curY, curM - 1, 1);

        // 1. TẢI LỊCH SỬ (Dùng empId đã kiểm tra)
        const logsSnap = await db.collection('attendance_logs')
            .where('employee_id', '==', empId)
            .where('time_in', '>=', startOfMonth)
            .orderBy('time_in', 'desc')
            .get();

        const logs = [];
        logsSnap.forEach(doc => logs.push(doc.data()));
        allHistoryData = processLogsToHistory(logs);
        
        // 2. TẢI THỐNG KÊ (Dùng empId)
        const statsDoc = await db.collection('monthly_stats').doc(`${empId}_${curM}_${curY}`).get();
        if(statsDoc.exists) renderHistoryStats(statsDoc.data());

        renderActivityHistory();

        // 3. TẢI THÔNG BÁO (Guard: Chỉ chạy .where khi có giá trị)
        const approvalsSnap = await db.collection('leave_requests')
            .where('status', '==', 'Pending')
            .get();

        let approvals = [];
        approvalsSnap.forEach(doc => {
            const d = doc.data();
            // Chỉ hiện đơn của người khác
            if (d.employee_id && d.employee_id !== empId) {
                approvals.push({ Request_ID: doc.id, ...d });
            }
        });

        cachedNotifications = { approvals: approvals };
        renderNotificationsBadge(cachedNotifications);

        updateCurrentStatusUI();

    } catch (e) {
        // Lỗi này thường do thiếu Index, hãy bấm vào link đỏ trong Console nếu thấy
        console.error("❌ Lỗi loadDashboardData thực tế:", e.message);
    }
}

function updateCurrentStatusUI() {
    // Logic: Nếu dòng đầu tiên trong allHistoryData có Time_Out là "..." thì coi là đang làm
    const isWorking = allHistoryData.length > 0 && allHistoryData[0].Time_Out === "...";
    toggleHomeState(isWorking ? "working" : "idle");
}

function renderNotificationsBadge(notiData) {
    if (!notiData) return;
    const count = notiData.approvals ? notiData.approvals.length : 0;
    
    const dots = document.querySelectorAll(".noti-dot");
    dots.forEach(dot => {
        if (count > 0) {
            dot.classList.remove("hidden");
            dot.innerText = count > 9 ? "9+" : count;
        } else {
            dot.classList.add("hidden");
        }
    });
}


// ==========================================
// 5. CAMERA & CHẤM CÔNG (FULL LOGIC)
// ==========================================

window.triggerCheckIn = function () {
    document.getElementById("modal-camera").classList.remove("hidden");
    toggleGlobalNav(false);
    navigator.mediaDevices
        .getUserMedia({ video: { facingMode: "user" } })
        .then(function (s) {
            videoStream = s;
            document.getElementById("video").srcObject = s;
        })
        .catch(function (err) {
            showToast("error", "Không thể truy cập Camera: " + err.message);
        });
};

window.closeCamera = function () {
    if (videoStream) videoStream.getTracks().forEach((t) => t.stop());
    document.getElementById("modal-camera").classList.add("hidden");
    toggleGlobalNav(true);
};

window.takePicture = function () {
    var v = document.getElementById("video");
    var c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d").drawImage(v, 0, 0);
    var b64 = c.toDataURL("image/jpeg", 0.6);
    
    closeCamera();
    showLoading(true);

    // Lấy vị trí và xử lý chấm công
    navigator.geolocation.getCurrentPosition(
        async function (p) {
            try {
                const empId = currentUser.Employee_ID || currentUser.employee_id;
                const lat = p.coords.latitude;
                const lng = p.coords.longitude;

                // 1. Upload ảnh lên Firebase Storage (Thay cho Drive)
                const fileName = `attendance/${empId}/${Date.now()}.jpg`;
                const storageRef = storage.ref().child(fileName);
                const uploadTask = await storageRef.putString(b64, 'data_url');
                const photoUrl = await uploadTask.ref.getDownloadURL();

                // 2. Gửi dữ liệu về Firestore (Thay cho doCheckIn bên GAS)
                // Lưu ý: Logic tính toán "Tại văn phòng nào" và "Trễ bao nhiêu" 
                // có thể thực hiện tại đây hoặc dùng Firebase Cloud Functions.
                // Ở đây tôi thực hiện tính toán khoảng cách tại Client để user thấy ngay.
                
                const nearest = findNearestOffice(lat, lng);
                const workDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

                await db.collection('attendance_logs').add({
                    employee_id: empId,
                    name: currentUser.Name || currentUser.full_name,
                    checkin_type: 'GPS',
                    checkin_lat: lat,
                    checkin_lng: lng,
                    distance_meters: nearest.distance,
                    location_id: nearest.location ? nearest.location.id : "Unknown",
                    selfie_url: photoUrl,
                    device_id: myDeviceId,
                    time_in: firebase.firestore.FieldValue.serverTimestamp(),
                    date: workDate,
                    status: nearest.distance <= 200 ? "Valid" : "Invalid (Too far)"
                });

                showLoading(false);
                showToast("success", "Chấm công thành công!");
                loadDashboardData();

            } catch (err) {
                console.error(err);
                showLoading(false);
                showToast("error", "Lỗi lưu dữ liệu: " + err.message);
            }
        },
        function () {
            showLoading(false);
            showDialog("error", "Lỗi định vị", "Vui lòng bật GPS để chấm công!");
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
};

window.triggerCheckOut = function () {
    showDialog("confirm", "Check-out", "Bạn muốn kết thúc ca làm việc?", async function () {
        showLoading(true);
        try {
            const empId = currentUser.Employee_ID || currentUser.employee_id;
            const workDate = new Date().toISOString().split('T')[0];

            await db.collection('attendance_logs').add({
                employee_id: empId,
                checkin_type: 'CheckOut',
                time_in: firebase.firestore.FieldValue.serverTimestamp(),
                date: workDate,
                device_id: myDeviceId
            });

            showLoading(false);
            showToast("success", "Ra ca thành công!");
            loadDashboardData();
        } catch (e) {
            showLoading(false);
            showToast("error", "Lỗi: " + e.message);
        }
    });
};

// ==========================================
// 6. GPS HELPERS (CALCULATION ON CLIENT)
// ==========================================

function findNearestOffice(lat, lng) {
    let minD = 999999;
    let nearest = null;

    cachedLocations.forEach(loc => {
        const d = getDistanceFromLatLonInKm(lat, lng, loc.latitude, loc.longitude) * 1000;
        if (d < minD) {
            minD = d;
            nearest = loc;
        }
    });
    return { location: nearest, distance: minD };
}

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    var R = 6371; // Bán kính trái đất km
    var dLat = deg2rad(lat2 - lat1);
    var dLon = deg2rad(lon2 - lon1);
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function deg2rad(deg) { return deg * (Math.PI / 180); }

// Helper xử lý gộp Log chấm công thành Object History ngày (Giống GAS trả về)
function processLogsToHistory(logs) {
    const historyMap = {};
    
    logs.forEach(log => {
        // Xử lý ngày tháng từ Firestore Timestamp hoặc String
        let dateStr = "";
        if (log.time_in && log.time_in.toDate) {
            dateStr = log.time_in.toDate().toLocaleDateString('en-GB'); // dd/mm/yyyy
        } else if (log.date) {
            dateStr = log.date.includes('-') ? log.date.split('-').reverse().join('/') : log.date;
        }

        if (!dateStr) return;

        if (!historyMap[dateStr]) {
            historyMap[dateStr] = {
                Date: dateStr,
                Time_In: '...',
                Time_Out: '...',
                Late_Minutes: 0,
                Is_Holiday: log.is_holiday || false,
                Is_Leave: log.is_leave || false,
                Holiday_Name: log.holiday_name || ""
            };
        }

        const time = log.time_in && log.time_in.toDate 
            ? log.time_in.toDate().toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'}) 
            : '...';
        
        if (log.checkin_type === 'CheckOut') {
            historyMap[dateStr].Time_Out = time;
        } else {
            historyMap[dateStr].Time_In = time;
            historyMap[dateStr].Late_Minutes = log.late_minutes || 0;
        }
    });

    return Object.values(historyMap);
}
// ==========================================
// 7. RENDER LỊCH SỬ CHI TIẾT (PILL STYLE)
// ==========================================

// Hàm điều khiển chuyển tháng lịch sử
window.changeHistoryMonth = async function (delta) {
    showLoading(true);
    // Cộng/Trừ tháng
    viewHistoryDate.setMonth(viewHistoryDate.getMonth() + delta);
    
    const m = viewHistoryDate.getMonth() + 1;
    const y = viewHistoryDate.getFullYear();

    // Cập nhật nhãn hiển thị
    setText("hist-month-badge", "Tháng " + m + "/" + y);

    try {
        const empId = currentUser.employee_id || currentUser.employee_code;
        const startOfMonth = new Date(y, m - 1, 1);
        const endOfMonth = new Date(y, m, 0, 23, 59, 59);

        // Tải dữ liệu chấm công của tháng được chọn
        const logsSnap = await db.collection('attendance_logs')
            .where('employee_id', '==', empId)
            .where('time_in', '>=', startOfMonth)
            .where('time_in', '<=', endOfMonth)
            .orderBy('time_in', 'desc')
            .get();

        const logs = [];
        logsSnap.forEach(doc => logs.push(doc.data()));
        
        allHistoryData = processLogsToHistory(logs);
        currentHistoryPage = 0; // Reset về trang đầu
        
        // Tải thống kê tháng tương ứng
        const statsDoc = await db.collection('monthly_stats').doc(`${empId}_${m}_${y}`).get();
        if(statsDoc.exists) renderHistoryStats(statsDoc.data());
        else resetHistoryStats();

        renderActivityHistory();
    } catch (e) {
        console.error(e);
        showToast("error", "Không thể tải lịch sử tháng này");
    } finally {
        showLoading(false);
    }
};

function resetHistoryStats() {
    setText("hist-total-days", 0);
    setText("hist-late-mins", 0);
    setText("hist-errors", 0);
    setText("home-stat-days", 0);
    const barWork = document.getElementById("work-progress-bar");
    if (barWork) barWork.style.width = "0%";
}

// Hàm Render danh sách lịch sử - GIỮ NGUYÊN 100% UI LOGIC TỪ JS.HTML
function renderHistoryStats(s) {
    if (!s) return;
    console.log("📈 Đang render thống kê:", s);

    // Cập nhật các ô Badge ở Tab Lịch sử (3 ô màu)
    setText("hist-total-days", s.work_days || s.workDays || 0);
    setText("hist-late-mins", s.late_mins || s.lateMins || 0);
    setText("hist-errors", s.error_count || s.errorCount || 0);

    // Cập nhật thẻ tiến độ ở Tab Home
    const workDays = s.work_days || s.workDays || 0;
    setText("home-stat-days", workDays);
    
    const std = s.standard_days || s.standardDays || 26;
    setText("home-stat-label", "Công chuẩn: " + std);

    // Tính % thanh tiến độ
    let pWork = std > 0 ? Math.round((workDays / std) * 100) : 0;
    if (pWork > 100) pWork = 100;
    
    const barWork = document.getElementById("work-progress-bar");
    if (barWork) barWork.style.width = pWork + "%";
}


window.renderActivityHistory = function () {
    var container = document.getElementById("activity-history-list");
    if (!container) return;

    if (!allHistoryData || allHistoryData.length === 0) {
        container.innerHTML = `<div class="text-center py-10 opacity-50"><i class="fa-solid fa-calendar-xmark text-4xl mb-2"></i><p class="text-xs">Không có dữ liệu chấm công</p></div>`;
        return;
    }

    // Logic Phân trang
    var startIndex = currentHistoryPage * HISTORY_PAGE_SIZE;
    var endIndex = startIndex + HISTORY_PAGE_SIZE;
    var displayData = allHistoryData.slice(0, endIndex); // Hiển thị dồn (Infinite Scroll style)

    var html = "";
    displayData.forEach(function (day) {
        // Parse ngày để lấy thứ
        var p = day.Date.split("/");
        var dObj = new Date(p[2], p[1] - 1, p[0]);
        var dayName = ["CN", "TH 2", "TH 3", "TH 4", "TH 5", "TH 6", "TH 7"][dObj.getDay()];

        let bgClass = "bg-white", borderClass = "border-slate-100", iconHtml = "", statusHtml = "";

        // --- LOGIC PHÂN LOẠI TRẠNG THÁI (BÁM SÁT FILE GỐC) ---
        if (day.Is_Holiday) {
            bgClass = "bg-purple-50/50"; borderClass = "border-purple-100";
            iconHtml = `<div class="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center shadow-sm"><i class="fa-solid fa-gift"></i></div>`;
            statusHtml = `<span class="text-[10px] font-bold text-purple-600 bg-purple-100 px-2 py-0.5 rounded-md">${day.Holiday_Name || 'Lễ'}</span>`;
        } 
        else if (day.Is_Leave) {
            bgClass = "bg-blue-50/50"; borderClass = "border-blue-100";
            iconHtml = `<div class="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shadow-sm"><i class="fa-solid fa-umbrella-beach"></i></div>`;
            statusHtml = `<span class="text-[10px] font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-md">Nghỉ phép</span>`;
        }
        else if (day.Time_In !== "...") {
            // Kiểm tra trễ (Late_Minutes được tính ở Module 2)
            if (day.Late_Minutes > 0) {
                borderClass = "border-orange-100";
                iconHtml = `<div class="w-10 h-10 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center shadow-sm"><i class="fa-solid fa-clock"></i></div>`;
                statusHtml = `<span class="text-[10px] font-bold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-md">Trễ ${day.Late_Minutes}p</span>`;
            } else {
                borderClass = "border-emerald-100";
                iconHtml = `<div class="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-sm"><i class="fa-solid fa-check"></i></div>`;
                statusHtml = `<span class="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">Công chuẩn</span>`;
            }
        } 
        else {
            bgClass = "bg-slate-50"; borderClass = "border-dashed border-slate-200";
            iconHtml = `<div class="w-10 h-10 rounded-xl bg-slate-200 text-slate-400 flex items-center justify-center"><i class="fa-solid fa-minus"></i></div>`;
            statusHtml = `<span class="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">Vắng mặt</span>`;
        }

        html += `
        <div class="${bgClass} p-4 rounded-[24px] border ${borderClass} mb-3 flex items-center justify-between shadow-sm animate-slide-up">
            <div class="flex items-center gap-4">
                <div class="flex flex-col items-center justify-center w-10 shrink-0">
                    <span class="text-[9px] font-bold text-slate-400 uppercase tracking-widest">${dayName}</span>
                    <span class="text-xl font-black text-slate-800 leading-none mt-1">${p[0]}</span>
                </div>
                <div class="w-px h-8 bg-slate-100"></div>
                <div>
                    <div class="flex items-center gap-2 mb-1">
                        <div class="w-2 h-2 rounded-full ${day.Time_In !== '...' ? 'bg-emerald-500' : 'bg-slate-300'}"></div>
                        <span class="text-sm font-bold text-slate-700">${day.Time_In} - ${day.Time_Out}</span>
                    </div>
                    ${statusHtml}
                </div>
            </div>
            <div class="shrink-0">${iconHtml}</div>
        </div>`;
    });

    // Nút xem thêm
    if (endIndex < allHistoryData.length) {
        html += `
        <div class="text-center py-4">
            <button onclick="loadMoreHistory()" class="px-6 py-2 rounded-full bg-white border border-slate-200 text-xs font-bold text-slate-500 shadow-sm active:scale-95 transition-all">
                Xem cũ hơn <i class="fa-solid fa-chevron-down ml-1"></i>
            </button>
        </div>`;
    }

    container.innerHTML = html;
};

window.loadMoreHistory = function() {
    currentHistoryPage++;
    renderActivityHistory();
};

// ==========================================
// 8. QUẢN LÝ ĐƠN TỪ (REQUESTS)
// ==========================================

window.openRequestModal = function (type, targetDate) {
    document.getElementById("modal-request").classList.remove("hidden");
    toggleGlobalNav(false);
    
    // Reset form
    document.getElementById("req-reason").value = "";
    currentReqType = type || "Nghỉ phép";
    setText("req-type-label", currentReqType);

    const today = new Date().toISOString().split('T')[0];
    document.getElementById("req-date-start").value = targetDate || today;
    document.getElementById("req-date-end").value = targetDate || today;
};

window.submitRequest = async function () {
    const reason = document.getElementById("req-reason").value.trim();
    const fromDate = document.getElementById("req-date-start").value;
    const toDate = document.getElementById("req-date-end").value;

    if (!reason || !fromDate) return showToast("error", "Vui lòng điền đủ thông tin!");

    showLoading(true);
    try {
        const empId = currentUser.employee_id || currentUser.employee_code;
        
        await db.collection('leave_requests').add({
            employee_id: empId,
            name: currentUser.full_name || currentUser.Name,
            request_type: currentReqType,
            from_date: fromDate,
            to_date: toDate || fromDate,
            reason: reason,
            status: 'Pending',
            created_at: firebase.firestore.FieldValue.serverTimestamp(),
            manager_id: currentUser.direct_manager_id || ""
        });

        showToast("success", "Gửi đơn thành công!");
        closeRequestModal();
        loadDashboardData(); // Làm mới danh sách đơn
    } catch (e) {
        showToast("error", "Lỗi: " + e.message);
    } finally {
        showLoading(false);
    }
};

// ==========================================
// 9. DUYỆT ĐƠN HÀNG LOẠT (BATCH ACTIONS)
// ==========================================

window.toggleSelectRequest = function (reqId) {
    const idx = selectedRequests.indexOf(reqId);
    if (idx > -1) selectedRequests.splice(idx, 1);
    else selectedRequests.push(reqId);
    
    updateBatchActionsUI();
};

function updateBatchActionsUI() {
    let bar = document.getElementById("batch-action-bar");
    
    // Nếu chưa có thanh bar trong DOM thì tạo mới (Inject)
    if (!bar) {
        bar = document.createElement("div");
        bar.id = "batch-action-bar";
        bar.className = "fixed bottom-24 left-6 right-6 bg-slate-900 text-white p-4 rounded-[24px] shadow-2xl z-[500] flex items-center justify-between transition-all transform translate-y-32 opacity-0";
        bar.innerHTML = `
            <div class="flex flex-col">
                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Đã chọn</span>
                <span id="batch-count" class="text-lg font-black text-emerald-400 leading-none">0</span>
            </div>
            <div class="flex gap-2">
                <button onclick="submitBatchAction('Rejected')" class="px-4 py-2 rounded-xl bg-red-500/20 text-red-400 font-bold text-xs border border-red-500/50">Từ chối</button>
                <button onclick="submitBatchAction('Approved')" class="px-4 py-2 rounded-xl bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-500/30">Duyệt hết</button>
            </div>`;
        document.body.appendChild(bar);
    }

    if (selectedRequests.length > 0) {
        bar.classList.remove("translate-y-32", "opacity-0");
        document.getElementById("batch-count").innerText = selectedRequests.length;
    } else {
        bar.classList.add("translate-y-32", "opacity-0");
    }
}

window.submitBatchAction = async function (status) {
    const idsToProcess = [...selectedRequests];
    if (idsToProcess.length === 0) return;

    const actionText = status === 'Approved' ? 'duyệt' : 'từ chối';
    if (!confirm(`Bạn chắc chắn muốn ${actionText} ${idsToProcess.length} đơn đã chọn?`)) return;

    showLoading(true);
    try {
        const batch = db.batch();
        const managerName = currentUser.full_name || currentUser.Name;

        idsToProcess.forEach(id => {
            const ref = db.collection('leave_requests').doc(id);
            batch.update(ref, {
                status: status,
                processed_at: firebase.firestore.FieldValue.serverTimestamp(),
                processed_by: managerName,
                note: status === 'Approved' ? "Đã duyệt hàng loạt" : "Từ chối hàng loạt"
            });
        });

        await batch.commit();
        showToast("success", `Đã ${actionText} thành công!`);
        
        // Reset
        selectedRequests = [];
        updateBatchActionsUI();
        closeNotifications();
        loadDashboardData();
    } catch (e) {
        showToast("error", "Lỗi: " + e.message);
    } finally {
        showLoading(false);
    }
};
// ==========================================
// 10. DANH BẠ & TÌM KIẾM (FULL UI LOGIC)
// ==========================================

window.loadContacts = async function () {
    var list = document.getElementById("contacts-list");
    if (!list) return;
    list.innerHTML = SKELETON_CONTACT;

    try {
        const snap = await db.collection('employees').where('status', '==', 'Active').get();
        cachedContacts = [];
        snap.forEach(doc => cachedContacts.push({ id: doc.id, ...doc.data() }));
        cachedContacts.sort((a, b) => (a.full_name || a.Name || "").localeCompare(b.full_name || b.Name || ""));
        renderContactList(cachedContacts);
    } catch (e) {
        list.innerHTML = `<p class="text-center py-10 text-xs text-red-400">Lỗi tải danh bạ</p>`;
    }
};

function renderContactList(data) {
    var list = document.getElementById("contacts-list");
    if (!list) return;
    if (!data || data.length === 0) {
        list.innerHTML = '<div class="text-center py-10 text-xs text-slate-400">Không tìm thấy nhân sự</div>';
        return;
    }

    var html = "";
    data.forEach(function (e, i) {
        const name = e.full_name || e.Name || "Nhân viên";
        const position = e.position || e.Position || "Staff";
        const avatar = e.avatar_url || e.Avatar || e.face_ref_url;
        const phone = e.phone || e.Phone || "";

        var avatarHtml = getAvatarHtml(name, avatar, "w-12 h-12", "text-sm");
        var phoneBtn = phone ? `<a href="tel:${phone}" class="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center active:scale-90 transition-all"><i class="fa-solid fa-phone"></i></a>` : "";

        html += `
        <div class="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-3 active:scale-[0.98] transition-transform cursor-pointer mb-3 animate-slide-up" onclick="openContactByIndex(${i})">
            <div class="relative flex-none">${avatarHtml}</div>
            <div class="flex-1 min-w-0">
                <p class="font-bold text-slate-800 truncate text-base">${name}</p>
                <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wide">${position}</p>
            </div>
            <div class="flex-none" onclick="event.stopPropagation()">${phoneBtn}</div>
        </div>`;
    });
    list.innerHTML = html;
}

window.openContactByIndex = function (index) {
    var data = cachedContacts[index];
    if (!data) return;
    document.getElementById("modal-contact-detail").classList.remove("hidden");
    const name = data.full_name || data.Name;
    document.getElementById("contact-detail-avatar").src = data.avatar_url || data.Avatar || data.face_ref_url || "";
    setText("contact-detail-name", name);
    setText("contact-detail-phone", data.phone || data.Phone || "N/A");
    setText("contact-detail-email", data.email || data.Email || "N/A");
    setText("contact-detail-dept", data.department || data.Department || "N/A");
};

window.closeContactDetail = function () {
    document.getElementById("modal-contact-detail").classList.add("hidden");
};

// ==========================================
// 11. PROFILE & CẬP NHẬT (AVATAR STORAGE)
// ==========================================

window.renderUserInfo = function () {
    if (!currentUser) return;
    const name = currentUser.full_name || currentUser.Name || "User";
    const role = currentUser.role_id || currentUser.role || "STAFF";
    const empId = currentUser.employee_id || currentUser.employee_code || currentUser.Employee_ID;

    // Header & Profile Tab
    setText("user-name", getShortNameClient(name));
    setText("header-role", role);
    setText("profile-name", name);
    setText("profile-id", `ID: ${empId}`);
    setText("p-email", currentUser.email || "Chưa cập nhật");
    setText("p-phone", currentUser.phone || currentUser.Phone || "Chưa có SĐT");
    setText("p-dept", currentUser.department || currentUser.Department || "N/A");
    setText("leave-balance", currentUser.annual_leave_balance || 0);

    const ava = currentUser.avatar_url || currentUser.Avatar || currentUser.face_ref_url || `https://ui-avatars.com/api/?name=${name}&background=059669&color=fff`;
    document.querySelectorAll(".user-avatar-img").forEach(img => img.src = ava);
    const lgAva = document.getElementById("profile-avatar-lg");
    if(lgAva) lgAva.src = ava;
};

window.submitProfileUpdate = async function () {
    const newPhone = document.getElementById("edit-phone").value.trim();
    const empId = currentUser.employee_id || currentUser.employee_code || currentUser.Employee_ID;

    showLoading(true);
    try {
        let updateData = { phone: newPhone };
        if (tempAvatarBase64) {
            const ref = storage.ref().child(`avatars/${empId}.jpg`);
            await ref.putString(tempAvatarBase64, 'data_url');
            updateData.avatar_url = await ref.getDownloadURL();
        }
        await db.collection('employees').doc(empId).update(updateData);
        showToast("success", "Đã cập nhật hồ sơ!");
        closeProfileModal();
        loadDashboardData();
    } catch (e) { showToast("error", e.message); }
    finally { showLoading(false); }
};

// ==========================================
// 12. UI HELPERS (TABS, NAVIGATION, STATES)
// ==========================================

window.switchTab = function (tabName) {
    // Ẩn tất cả modal
    ["modal-notifications", "modal-request", "modal-profile", "modal-contact-detail"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add("hidden");
    });

    toggleGlobalNav(true);

    // Chuyển Tab nội dung
    document.querySelectorAll(".tab-content").forEach(t => t.classList.add("hidden"));
    const target = document.getElementById("tab-" + tabName);
    if (target) target.classList.remove("hidden");

    // UI Nav Bottom (Dựa trên Tailwind của index.html cũ)
    document.querySelectorAll(".nav-item").forEach(item => {
        const isActive = item.id === "nav-" + tabName;
        item.classList.toggle("active", isActive);
        
        const icon = item.querySelector("i");
        if (icon) {
            icon.classList.toggle("text-emerald-600", isActive);
            icon.classList.toggle("text-slate-300", !isActive);
        }
    });

    if (tabName === "contacts") loadContacts();
};

window.toggleHomeState = function (state) {
    const loadingEl = document.getElementById("state-loading");
    const idleEl = document.getElementById("state-idle");
    const workEl = document.getElementById("state-working");
    if (!loadingEl || !idleEl || !workEl) return;

    [loadingEl, idleEl, workEl].forEach(el => {
        el.classList.add("opacity-0", "scale-90", "pointer-events-none");
    });

    const active = state === "loading" ? loadingEl : (state === "working" ? workEl : idleEl);
    active.classList.remove("opacity-0", "scale-90", "pointer-events-none");
    active.classList.add("opacity-100", "scale-100");
};

// ==========================================
// 13. UTILS (TOAST, DIALOG, CLOCK)
// ==========================================

function setText(id, t) {
    const e = document.getElementById(id);
    if (e) e.innerText = t || "...";
}

window.showLoading = function (s) {
    const loader = document.getElementById("loader");
    if (loader) loader.classList.toggle("hidden", !s);
};

window.showToast = function (type, m) {
    const x = document.getElementById("toast");
    if (!x) return;
    x.innerHTML = `<div class="flex items-center gap-3 bg-white px-5 py-3 rounded-full shadow-2xl border border-slate-50 animate-slide-up"><div class="w-8 h-8 rounded-full flex items-center justify-center ${type === 'error' ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}"><i class="fa-solid ${type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'}"></i></div><span class="text-xs font-bold text-slate-700">${m}</span></div>`;
    x.classList.remove("hidden", "opacity-0");
    x.style.opacity = "1"; x.style.transform = "translate(-50%, 0)";
    setTimeout(() => {
        x.style.opacity = "0"; x.style.transform = "translate(-50%, -20px)";
        setTimeout(() => x.classList.add("hidden"), 300);
    }, 3000);
};

window.showDialog = function (type, title, msg, cb) {
    if (confirm(`${title}\n${msg}`)) if (cb) cb();
};

function getShortNameClient(fullName) {
    if (!fullName) return "User";
    const parts = fullName.trim().split(" ");
    return parts[parts.length - 1];
}

function getDayNameVietnamese(dayIndex) {
    return ["CN", "T2", "T3", "T4", "T5", "T6", "T7"][dayIndex];
}

function getAvatarHtml(name, url, sizeClass, textSize) {
    if (url && url.length > 10) return `<img src="${url}" class="${sizeClass} rounded-2xl object-cover border border-slate-100 shadow-sm">`;
    const initials = name ? name.split(" ").pop().substring(0, 2).toUpperCase() : "U";
    return `<div class="${sizeClass} rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black ${textSize}">${initials}</div>`;
}

function updateClock() {
    var d = new Date();
    setText("clock-display", d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false }));
    var days = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
    setText("date-display", `${days[d.getDay()]}, Ngày ${d.getDate()}/${d.getMonth() + 1}`);
}
