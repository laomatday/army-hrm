/**
 * =======================================================================
 * ARMY HRM - CORE LOGIC SCRIPT (REBUILT v2026)
 * Fix: Login Flow, Clock Crash, UI/UX Animations
 * =======================================================================
 */

// 1. CẤU HÌNH HỆ THỐNG
// =====================

// [QUAN TRỌNG] Điền thông tin Supabase của anh vào đây
const SUPABASE_URL = "https://gfeeafeqpirlppugieib.supabase.co"; 
const SUPABASE_KEY = "sb_publishable_K65r6aBo5DG2kY0ZptgCeg_3FGfQRuU"; 

// Khởi tạo Supabase
const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// 2. BIẾN TOÀN CỤC
// =================
var currentUser = null;
var videoStream = null;
var allHistoryData = [];
var cachedContacts = [];
var refreshInterval = null;
var myDeviceId = getDeviceId();
var currentReqType = "Nghỉ phép";

// 3. KHỞI TẠO ỨNG DỤNG
// ====================
document.addEventListener("DOMContentLoaded", async () => {
    // 1. Chạy đồng hồ
    setInterval(updateClock, 1000);
    updateClock();

    // 2. Xử lý phím Enter đăng nhập
    setupEnterKey("login-user", handleLogin);
    setupEnterKey("login-pass", handleLogin);

    // 3. Kiểm tra Session Supabase
    if (supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            console.log("✅ Auto Login:", session.user.email);
            // Thử lấy profile từ cache trước cho nhanh
            const cachedProfile = localStorage.getItem("army_user_profile");
            if (cachedProfile) {
                currentUser = JSON.parse(cachedProfile);
                showMainApp();
            }
            // Sau đó fetch lại mới nhất
            fetchUserProfile(session.user.email);
        } else {
            showLoginScreen();
        }
    } else {
        console.error("Thiếu thư viện Supabase!");
    }
});

function setupEnterKey(id, action) {
    const el = document.getElementById(id);
    if (el) el.addEventListener("keydown", (e) => { if (e.key === "Enter") action(); });
}

// 4. XỬ LÝ ĐĂNG NHẬP (SUPABASE)
// ==============================
window.handleLogin = async function () {
    const email = document.getElementById("login-user").value.trim();
    const password = document.getElementById("login-pass").value.trim();

    if (!email || !password) return showToast("error", "Vui lòng nhập đủ thông tin!");

    showLoading(true);

    // Bước 1: Login qua Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
        showLoading(false);
        console.error("Login Error:", error);
        if (error.message.includes("Email not confirmed")) {
            showDialog("error", "Chưa kích hoạt", "Email này chưa được xác thực.");
        } else {
            showToast("error", "Đăng nhập thất bại: " + error.message);
        }
        return;
    }

    // Bước 2: Lấy thông tin nhân viên từ Google Sheet (Backend)
    await fetchUserProfile(email);
};

async function fetchUserProfile(email) {
    try {
        const res = await callAPI("getUserProfile", email);
        showLoading(false);

        if (res.success) {
            currentUser = res.data;
            localStorage.setItem("army_user_profile", JSON.stringify(currentUser));
            showToast("success", `Xin chào, ${getShortName(currentUser.Name)}`);
            showMainApp();
        } else {
            // Có acc Supabase nhưng không có trong Sheet nhân sự
            await supabase.auth.signOut();
            showDialog("error", "Lỗi dữ liệu", "Không tìm thấy hồ sơ nhân viên của bạn.");
        }
    } catch (e) {
        showLoading(false);
        showToast("error", "Lỗi tải hồ sơ: " + e.message);
    }
}

window.logout = async function () {
    if (refreshInterval) clearInterval(refreshInterval);
    showLoading(true);
    if (supabase) await supabase.auth.signOut();
    localStorage.removeItem("army_user_profile");
    currentUser = null;
    document.getElementById("login-pass").value = "";
    showLoading(false);
    showLoginScreen();
};

// 5. ĐIỀU HƯỚNG & UI
// ===================
function showLoginScreen() {
    toggleView("view-login");
    toggleGlobalNav(false);
}

function showMainApp() {
    toggleView("view-main");
    toggleGlobalNav(true);
    renderUserInfo();
    switchTab("home");
    loadDashboardData();
    
    // Auto refresh 60s
    refreshInterval = setInterval(loadDashboardData, 60000);
}

function toggleView(viewId) {
    document.getElementById("view-login").classList.add("hidden");
    document.getElementById("view-main").classList.add("hidden");
    document.getElementById(viewId).classList.remove("hidden");
}

// 6. XỬ LÝ DỮ LIỆU (DASHBOARD)
// ============================
async function loadDashboardData() {
    if (!currentUser) return;
    try {
        // Gọi API GAS lấy tất cả dữ liệu cần thiết
        const res = await callAPI("getDashboardData", currentUser.Employee_ID);
        if (res.success) {
            const d = res.data;
            
            // Cập nhật Profile
            if (d.userProfile) {
                currentUser = { ...currentUser, ...d.userProfile };
                localStorage.setItem("army_user_profile", JSON.stringify(currentUser));
                renderUserInfo();
            }

            // Render Lịch sử công
            if (d.history) {
                allHistoryData = d.history.history || [];
                renderHistoryStats(d.history.summary);
                renderActivityHistory(); // Tự động render list
            }

            // Render Thông báo
            renderNotificationsBadge(d.notifications || {});

            // Render Requests
            renderMyRequestsList(d.myRequests || []);
            
            // Cache danh bạ
            cachedContacts = d.contacts || [];

            updateCurrentStatusUI();
        }
    } catch (e) {
        console.error("Dashboard Sync Error:", e);
    }
}

// 7. CÁC HÀM UI HELPERS
// =====================
function updateClock() {
    const timeEl = document.getElementById("clock-time");
    const dateEl = document.getElementById("clock-date");
    if (!timeEl || !dateEl) return;

    const now = new Date();
    timeEl.innerText = now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    dateEl.innerText = now.toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
}

function renderUserInfo() {
    if (!currentUser) return;
    setText("user-name", getShortName(currentUser.Name));
    setText("p-id", currentUser.Employee_ID);
    setText("p-email", currentUser.Email);
    
    // Avatar
    const avatar = currentUser.Avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.Name)}&background=059669&color=fff`;
    document.querySelectorAll(".user-avatar-img").forEach(img => img.src = avatar);
}

function getShortName(name) {
    if (!name) return "...";
    const parts = name.trim().split(" ");
    return parts[parts.length - 1];
}

function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.innerText = val;
}

// 8. CAMERA & CHẤM CÔNG
// =====================
window.triggerCheckIn = function () {
    const modal = document.getElementById("modal-camera");
    if (!modal) return;
    
    modal.classList.remove("hidden");
    toggleGlobalNav(false);

    navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } })
        .then(stream => {
            videoStream = stream;
            document.getElementById("video").srcObject = stream;
        })
        .catch(() => {
            closeCamera();
            showDialog("error", "Lỗi Camera", "Không thể truy cập Camera. Vui lòng cấp quyền.");
        });
};

window.takePicture = function () {
    const v = document.getElementById("video");
    const c = document.createElement("canvas");
    c.width = v.videoWidth; 
    c.height = v.videoHeight;
    c.getContext("2d").drawImage(v, 0, 0);
    const base64 = c.toDataURL("image/jpeg", 0.6); // Nén ảnh

    closeCamera();
    showLoading(true);

    navigator.geolocation.getCurrentPosition(
        pos => {
            callAPI("doCheckIn", {
                employeeId: currentUser.Employee_ID,
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                deviceId: myDeviceId,
                imageBase64: base64
            }).then(res => {
                showLoading(false);
                if (res.success) {
                    showDialog("success", "Thành công", res.message);
                    loadDashboardData();
                } else {
                    showDialog("error", "Thất bại", res.message);
                }
            });
        },
        () => {
            showLoading(false);
            showDialog("error", "Lỗi GPS", "Vui lòng bật định vị để chấm công.");
        },
        { timeout: 10000, enableHighAccuracy: true }
    );
};

window.closeCamera = function () {
    if (videoStream) videoStream.getTracks().forEach(t => t.stop());
    document.getElementById("modal-camera").classList.add("hidden");
    toggleGlobalNav(true);
};

// 9. CORE API CALLER
// ==================
async function callAPI(action, ...params) {
    try {
        const res = await fetch(GAS_API_URL, {
            method: "POST",
            body: JSON.stringify({ action, params }),
            headers: { "Content-Type": "text/plain;charset=utf-8" }
        });
        return await res.json();
    } catch (e) {
        throw new Error("API Connection Failed");
    }
}

function getDeviceId() {
    let id = localStorage.getItem("army_device_id");
    if (!id) {
        id = "DEV_" + Date.now().toString(36) + Math.random().toString(36).substr(2, 5).toUpperCase();
        localStorage.setItem("army_device_id", id);
    }
    return id;
}

// 10. TAB SWITCHING
// =================
window.switchTab = function(tabName) {
    // Ẩn tất cả nội dung tab
    ["home", "requests", "contacts", "profile"].forEach(t => {
        const el = document.getElementById("tab-" + t);
        if(el) el.classList.add("hidden");
    });
    
    // Hiện tab được chọn
    const target = document.getElementById("tab-" + tabName);
    if(target) target.classList.remove("hidden");

    // Active icon navbar
    document.querySelectorAll(".nav-item").forEach(item => {
        const isActive = item.getAttribute("onclick").includes(tabName);
        const icon = item.querySelector("i");
        if(isActive) {
            icon.classList.remove("text-slate-400");
            icon.classList.add("text-emerald-600");
        } else {
            icon.classList.add("text-slate-400");
            icon.classList.remove("text-emerald-600");
        }
    });
};

function toggleGlobalNav(show) {
    const nav = document.getElementById("global-nav");
    if(nav) nav.classList.toggle("hidden", !show);
}

window.showLoading = function(show) {
    const loader = document.getElementById("loader");
    if(loader) loader.classList.toggle("hidden", !show);
};

window.showToast = function(type, msg) {
    // Hàm hiển thị toast đơn giản (Anh có thể dùng lại code cũ nếu muốn đẹp hơn)
    alert(msg); 
};

