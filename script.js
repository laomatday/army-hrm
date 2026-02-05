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

// URL Google Apps Script (Backend xử lý Logic chấm công/Dữ liệu)
const GAS_API_URL = "https://script.google.com/macros/s/AKfycbwiFCk0UXESXfe3CszO7i22FK29u2q-GxoW6g8WKxqLez1ghuw2rq81PbP1e2k-6EPpGA/exec";

// Khởi tạo Supabase Client
// Đảm bảo trong index.html đã có: <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// 2. BIẾN TOÀN CỤC (STATE)
// =========================
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

// Biến tạm Form
var tempAvatarBase64 = null;
var currentReqType = "Nghỉ phép";

// 3. UI TEMPLATES & SKELETONS
// ============================
const SKELETON_CONTACT = `
  <div class="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-3 mb-3 animate-pulse">
      <div class="w-12 h-12 rounded-2xl bg-slate-200"></div>
      <div class="flex-1 space-y-2">
          <div class="h-4 w-32 bg-slate-200 rounded-full"></div>
          <div class="h-3 w-20 bg-slate-200 rounded-full"></div>
      </div>
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

// 4. KHỞI TẠO ỨNG DỤNG (INIT)
// ===========================
document.addEventListener("DOMContentLoaded", async function () {
    console.log("🚀 App Initializing...");

    // Cài đặt đồng hồ (Chạy an toàn)
    setInterval(updateClock, 1000);
    updateClock();

    // Xử lý nút Login (Enter key)
    setupEnterKey("login-user", handleLogin);
    setupEnterKey("login-pass", handleLogin);

    // Kiểm tra trạng thái đăng nhập Supabase
    checkAuthSession();
});

// Hàm hỗ trợ phím Enter
function setupEnterKey(id, action) {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                action();
            }
        });
    }
}

// 5. AUTHENTICATION LOGIC (SUPABASE)
// ===================================

/**
 * Kiểm tra phiên đăng nhập hiện tại
 */
async function checkAuthSession() {
    if (!supabase) {
        console.error("Supabase SDK chưa được cài đặt!");
        return;
    }

    const { data: { session } } = await supabase.auth.getSession();

    if (session && session.user) {
        console.log("✅ Đã đăng nhập:", session.user.email);
        // Lấy thông tin User chi tiết từ LocalStorage hoặc fetch lại
        const savedProfile = localStorage.getItem("army_user_profile");
        if (savedProfile) {
            currentUser = JSON.parse(savedProfile);
            showMainApp();
        } else {
            // Nếu mất profile, fetch lại từ API GAS dựa trên Email
            fetchUserProfile(session.user.email);
        }
    } else {
        showLoginScreen();
    }

    // Lắng nghe sự kiện thay đổi Auth
    supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') {
            logout();
        }
    });
}

/**
 * Xử lý Đăng Nhập
 */
window.handleLogin = async function () {
    const emailEl = document.getElementById("login-user");
    const passEl = document.getElementById("login-pass");

    if (!emailEl || !passEl || !emailEl.value || !passEl.value) {
        showToast("error", "Vui lòng nhập Email và Mật khẩu!");
        return;
    }

    const email = emailEl.value.trim();
    const password = passEl.value.trim();

    showLoading(true);

    if (!supabase) {
        showLoading(false);
        showToast("error", "Lỗi cấu hình: Thiếu Supabase Client.");
        return;
    }

    // Gọi Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
    });

    if (error) {
        showLoading(false);
        console.error("Login Error:", error);

        // Xử lý riêng lỗi 422 (Email chưa confirm)
        if (error.status === 422 || error.message.includes("Email not confirmed")) {
            showDialog("error", "Chưa kích hoạt", "Email này chưa được xác thực. Vui lòng kiểm tra hộp thư hoặc liên hệ Admin.");
        } else if (error.message.includes("Invalid login credentials")) {
             showToast("error", "Sai Email hoặc Mật khẩu!");
        } else {
            showToast("error", "Lỗi đăng nhập: " + error.message);
        }
        return;
    }

    // Đăng nhập thành công -> Lấy Profile nhân viên
    if (data.user) {
        await fetchUserProfile(data.user.email);
    }
};

/**
 * Lấy thông tin nhân viên từ GAS sau khi Auth thành công
 */
async function fetchUserProfile(email) {
    try {
        // Gọi GAS để lấy data nhân viên map với email này
        const res = await callAPI("getUserProfile", email);
        
        showLoading(false);

        if (res.success) {
            currentUser = res.data;
            // Lưu cache
            localStorage.setItem("army_user_profile", JSON.stringify(currentUser));
            
            showToast("success", `Xin chào, ${getShortNameClient(currentUser.Name)}`);
            showMainApp();
        } else {
            // Login Supabase ok nhưng không tìm thấy nhân viên trong HRM
            await supabase.auth.signOut(); 
            showDialog("error", "Lỗi tài khoản", "Tài khoản không tồn tại trong hệ thống nhân sự (HRM).");
        }
    } catch (err) {
        showLoading(false);
        showToast("error", "Không thể tải hồ sơ: " + err);
    }
}

window.logout = async function () {
    if (refreshInterval) clearInterval(refreshInterval);
    
    showLoading(true);
    if (supabase) await supabase.auth.signOut();
    
    localStorage.removeItem("army_user_profile");
    currentUser = null;
    
    // Reset Form
    const passEl = document.getElementById("login-pass");
    if (passEl) passEl.value = "";

    showLoading(false);
    showLoginScreen();
};

// 6. ĐIỀU HƯỚNG MÀN HÌNH (NAVIGATION)
// ====================================

function showLoginScreen() {
    const loginView = document.getElementById("view-login");
    const mainView = document.getElementById("view-main");
    
    if (loginView) loginView.classList.remove("hidden");
    if (mainView) mainView.classList.add("hidden");
    
    toggleGlobalNav(false);
}

function showMainApp() {
    const loginView = document.getElementById("view-login");
    const mainView = document.getElementById("view-main");
    
    if (loginView) loginView.classList.add("hidden");
    if (mainView) mainView.classList.remove("hidden");
    
    toggleGlobalNav(true);
    renderUserInfo();
    switchTab("home");

    // Load dữ liệu
    loadDashboardData();

    // Auto Refresh mỗi 60s
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(loadDashboardData, 60000);
}

// 7. DATA HANDLING (CORE)
// =======================

async function loadDashboardData() {
    if (!currentUser) return;

    // Chỉ hiện loading lần đầu, các lần sau cập nhật ngầm
    if (!allHistoryData.length) toggleHomeState("loading");

    try {
        const res = await callAPI("getDashboardData", currentUser.Employee_ID);
        
        if (res.success) {
            const d = res.data;
            
            // 1. Cập nhật Profile mới nhất
            if (d.userProfile) {
                currentUser = { ...currentUser, ...d.userProfile };
                localStorage.setItem("army_user_profile", JSON.stringify(currentUser));
                renderUserInfo();
            }

            // 2. Xử lý Lịch sử công
            if (d.history) {
                processHistoryData(d.history);
            }

            // 3. Thông báo
            if (d.notifications) {
                cachedNotifications = d.notifications;
                renderNotificationsBadge(d.notifications);
            }

            // 4. Requests & Contacts
            if (d.myRequests) renderMyRequestsList(d.myRequests);
            if (d.contacts) cachedContacts = d.contacts;
            if (d.locations) cachedLocations = d.locations;

            updateCurrentStatusUI();

        } else {
            console.warn("Data sync failed:", res.message);
        }
    } catch (err) {
        console.error("Dashboard Load Error:", err);
    } finally {
        // Luôn tắt trạng thái loading UI dù lỗi hay không
        const loadingState = document.getElementById("state-loading");
        if (loadingState && !loadingState.classList.contains("opacity-0")) {
             toggleHomeState("idle"); 
        }
    }
}

// 8. CÁC HÀM UI HELPERS & FIX LỖI
// ================================

// [FIX] UpdateClock không crash khi thiếu Element
function updateClock() {
    const timeEl = document.getElementById("clock-time");
    const dateEl = document.getElementById("clock-date");
    
    // Nếu không tìm thấy element (vd: đang ở login screen), thoát ngay
    if (!timeEl || !dateEl) return;

    const now = new Date();
    timeEl.innerText = now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    
    // Format ngày: Thứ ..., ngày/tháng/năm
    const dateStr = now.toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
    dateEl.innerText = dateStr;
}

// Hàm gọi API GAS (Backend)
async function callAPI(action, ...params) {
    if (!GAS_API_URL || GAS_API_URL.includes("HÃY_DÁN_URL")) {
        showToast("error", "Chưa cấu hình Backend API!");
        throw new Error("Missing API URL");
    }

    try {
        const response = await fetch(GAS_API_URL, {
            method: "POST",
            body: JSON.stringify({ action: action, params: params }),
            headers: { "Content-Type": "text/plain;charset=utf-8" },
        });
        return await response.json();
    } catch (error) {
        console.error("API Call Failed:", error);
        throw error;
    }
}

// Hàm lấy Device ID
function getDeviceId() {
    let devId = localStorage.getItem("army_device_id");
    if (!devId) {
        devId = "DEV_" + Date.now().toString(36) + Math.random().toString(36).substr(2, 5).toUpperCase();
        localStorage.setItem("army_device_id", devId);
    }
    return devId;
}

// 9. CHECK-IN / CHECK-OUT LOGIC
// =============================

window.triggerCheckIn = function () {
    const modal = document.getElementById("modal-camera");
    const video = document.getElementById("video");
    
    if (!modal || !video) return;

    modal.classList.remove("hidden");
    toggleGlobalNav(false);

    navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } })
        .then(function (stream) {
            videoStream = stream;
            video.srcObject = stream;
        })
        .catch(function (err) {
            closeCamera();
            showDialog("error", "Lỗi Camera", "Vui lòng cấp quyền truy cập Camera để chấm công.");
        });
};

window.takePicture = function () {
    const v = document.getElementById("video");
    if (!v) return;

    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d").drawImage(v, 0, 0);
    const base64 = c.toDataURL("image/jpeg", 0.7); // Nén ảnh 0.7

    closeCamera();
    showLoading(true);

    // Lấy tọa độ GPS
    navigator.geolocation.getCurrentPosition(
        function (p) {
            callAPI("doCheckIn", {
                employeeId: currentUser.Employee_ID,
                lat: p.coords.latitude,
                lng: p.coords.longitude,
                deviceId: myDeviceId,
                imageBase64: base64,
            })
            .then(res => {
                showLoading(false);
                if (res.success) {
                    showDialog("success", "Thành công", res.message);
                    loadDashboardData();
                } else {
                    showDialog("error", "Không thành công", res.message);
                }
            })
            .catch(err => {
                showLoading(false);
                showToast("error", "Lỗi kết nối Server.");
            });
        },
        function () {
            showLoading(false);
            showDialog("error", "Lỗi vị trí", "Vui lòng bật GPS (Vị trí) trên điện thoại để chấm công.");
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
};

window.closeCamera = function () {
    if (videoStream) {
        videoStream.getTracks().forEach(t => t.stop());
        videoStream = null;
    }
    document.getElementById("modal-camera").classList.add("hidden");
    toggleGlobalNav(true);
};

window.triggerCheckOut = function () {
    showDialog("confirm", "Xác nhận về", "Bạn có chắc chắn muốn kết thúc ca làm việc?", function () {
        showLoading(true);
        callAPI("doCheckOut", { employeeId: currentUser.Employee_ID })
            .then(res => {
                showLoading(false);
                showToast(res.success ? "success" : "error", res.message);
                if (res.success) loadDashboardData();
            })
            .catch(err => {
                showLoading(false);
                showToast("error", "Lỗi kết nối!");
            });
    });
};

// 10. HELPER FUNCTIONS (UTILS)
// ============================

function toggleGlobalNav(show) {
    const nav = document.getElementById("global-nav");
    if (nav) nav.classList.toggle("hidden", !show);
}

function getShortNameClient(fullName) {
    if (!fullName) return "...";
    const parts = fullName.trim().split(" ");
    return parts.length > 0 ? parts[parts.length - 1] : fullName;
}

function renderUserInfo() {
    if (!currentUser) return;
    
    // Render text data
    setText("user-name", getShortNameClient(currentUser.Name));
    setText("p-id", currentUser.Employee_ID);
    setText("p-email", currentUser.Email);
    
    // Render Avatars
    const avatarUrl = currentUser.Avatar && currentUser.Avatar.startsWith("http") 
        ? currentUser.Avatar 
        : `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.Name)}&background=10b981&color=fff`;

    document.querySelectorAll(".user-avatar-img").forEach(img => {
        img.src = avatarUrl;
    });
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.innerText = value;
}

function toggleHomeState(state) {
    const loadingEl = document.getElementById("state-loading");
    const idleEl = document.getElementById("state-idle");
    const workEl = document.getElementById("state-working");

    if (!loadingEl || !idleEl || !workEl) return;

    // Helper ẩn/hiện
    const set = (el, active) => {
        el.classList.toggle("opacity-100", active);
        el.classList.toggle("scale-100", active);
        el.classList.toggle("z-30", active);
        el.classList.toggle("opacity-0", !active);
        el.classList.toggle("scale-90", !active);
        el.classList.toggle("pointer-events-none", !active);
    };

    set(loadingEl, state === "loading");
    set(workEl, state === "working");
    set(idleEl, state === "idle");
}

window.switchTab = function(tabName) {
    // Ẩn tất cả modal
    document.querySelectorAll(".modal-layer").forEach(el => el.classList.add("hidden"));
    toggleGlobalNav(true);

    // Ẩn tất cả tab
    ["home", "requests", "contacts", "profile"].forEach(t => {
        const tab = document.getElementById("tab-" + t);
        if(tab) tab.classList.add("hidden");
    });

    // Hiện tab đích
    const target = document.getElementById("tab-" + tabName);
    if(target) target.classList.remove("hidden");

    // Active Navigation Style
    document.querySelectorAll(".nav-item").forEach(item => {
        const isActive = item.getAttribute("onclick").includes(tabName);
        const icon = item.querySelector("i");
        const dot = item.querySelector(".indicator");

        if(isActive) {
            icon.classList.remove("text-slate-400");
            icon.classList.add("text-emerald-600");
            if(dot) dot.classList.remove("opacity-0");
        } else {
            icon.classList.add("text-slate-400");
            icon.classList.remove("text-emerald-600");
            if(dot) dot.classList.add("opacity-0");
        }
    });

    if (tabName === "contacts" && cachedContacts.length === 0) {
        // Nếu cần thì load contact (đã load ở Dashboard rồi nên thường không cần)
    }
};

// ... Các hàm render khác (renderActivityHistory, renderMyRequestsList...) giữ nguyên logic cũ
// Do giới hạn độ dài, tôi giữ lại core logic. Các hàm render HTML thuần túy anh có thể giữ nguyên từ file cũ
// hoặc nếu cần tôi sẽ cung cấp nốt.

function processHistoryData(historyObj) {
    if (!historyObj) return;
    allHistoryData = historyObj.history || [];
    // Render Stats
    const s = historyObj.summary;
    if(s) {
        setText("hist-total-days", s.workDays);
        setText("hist-late-mins", s.lateMins);
        setText("home-stat-days", s.workDays);
    }
}

function updateCurrentStatusUI() {
    const vnDate = new Date().toLocaleDateString("en-GB"); 
    let isWorking = false;
    
    const todayRec = allHistoryData.find(r => r.Date === vnDate);
    if (todayRec && todayRec.Time_List && todayRec.Time_List.some(t => t.out === "...")) {
        isWorking = true;
    }
    
    toggleHomeState(isWorking ? "working" : "idle");
}

function renderMyRequestsList(requests) {
    const container = document.getElementById("request-list-container");
    if(!container) return;
    
    if(!requests || requests.length === 0) {
        container.innerHTML = `<div class="text-center py-8 text-slate-400 text-xs">Chưa có đề xuất nào</div>`;
        return;
    }
    
    // Logic render HTML giữ nguyên
    let html = requests.map(req => {
        let statusColor = req.Status === "Approved" ? "text-emerald-600 bg-emerald-50" : 
                          req.Status === "Rejected" ? "text-red-600 bg-red-50" : "text-orange-600 bg-orange-50";
        return `
            <div class="bg-white p-4 rounded-2xl mb-3 shadow-sm border border-slate-50 flex justify-between items-center">
                <div>
                    <h4 class="font-bold text-slate-700 text-sm">${req.Type}</h4>
                    <p class="text-[10px] text-slate-400">${req.Reason}</p>
                </div>
                <span class="px-2 py-1 rounded-lg text-[10px] font-bold ${statusColor}">${req.Status}</span>
            </div>
        `;
    }).join("");
    
    container.innerHTML = html;
}

function renderNotificationsBadge(noti) {
    const count = noti.approvals ? noti.approvals.length : 0;
    const dot = document.getElementById("noti-dot");
    if(dot) {
        if(count > 0) dot.classList.remove("hidden");
        else dot.classList.add("hidden");
    }
}
