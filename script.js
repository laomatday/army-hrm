/**
 * =======================================================================
 * ARMY HRM - PURE SUPABASE EDITION (vFinal)
 * Kết nối trực tiếp Database & Storage (Không qua Google Apps Script)
 * =======================================================================
 */

// 1. CẤU HÌNH (CONFIG)
// ====================
const SUPABASE_URL = "https://gfeeafeqpirlppugieib.supabase.co";
// Anh thay Key Anon (Public) của dự án vào đây
const SUPABASE_KEY = "sb_publishable_K65r6aBo5DG2kY0ZptgCeg_3FGfQRuU"; 

// Khởi tạo Client
var supabase = null;
if (typeof window.supabase !== 'undefined') {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
} else {
    alert("Lỗi: Chưa nhúng thư viện Supabase trong file index.html!");
}

// 2. BIẾN TOÀN CỤC (STATE)
// ========================
var currentUser = null;
var videoStream = null;
var myDeviceId = getDeviceId();
var refreshInterval = null;
var allHistoryData = [];
var selectedRequests = [];

// 3. KHỞI TẠO (INIT)
// ==================
document.addEventListener("DOMContentLoaded", async () => {
    // Chạy đồng hồ
    setInterval(updateClock, 1000);
    updateClock();

    // Xử lý phím Enter đăng nhập
    document.getElementById("login-pass")?.addEventListener("keydown", (e) => {
        if(e.key === "Enter") handleLogin();
    });

    // Kiểm tra phiên đăng nhập
    await checkSession();
});

// 4. AUTHENTICATION
// =================
async function checkSession() {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
        // Đã login -> Lấy thông tin nhân viên từ bảng 'employees'
        showLoading(true);
        const { data: profile, error } = await supabase
            .from('employees')
            .select('*')
            .eq('auth_user_id', session.user.id)
            .single();

        showLoading(false);

        if (profile) {
            // Merge thông tin Auth và thông tin Nhân viên
            currentUser = { ...session.user, ...profile };
            showMainApp();
        } else {
            // Trường hợp user có trong Auth nhưng chưa có trong bảng employees
            // -> Tự động tạo hồ sơ mẫu (Fallback)
            currentUser = session.user;
            currentUser.full_name = session.user.user_metadata.full_name || "Nhân viên mới";
            currentUser.employee_code = "NV-NEW";
            showMainApp();
            showToast("info", "Đang cập nhật dữ liệu lần đầu...");
        }
    } else {
        showLoginScreen();
    }
}

window.handleLogin = async function () {
    const email = document.getElementById("login-user").value.trim();
    const pass = document.getElementById("login-pass").value.trim();
    
    if (!email || !pass) return showToast("error", "Vui lòng nhập đủ thông tin!");
    
    showLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
    showLoading(false);

    if (error) {
        if(error.message.includes("Email not confirmed")) showDialog("error", "Lỗi", "Email chưa xác thực!");
        else showToast("error", "Sai email hoặc mật khẩu!");
    } else {
        checkSession();
    }
};

window.logout = async function () {
    if(refreshInterval) clearInterval(refreshInterval);
    await supabase.auth.signOut();
    currentUser = null;
    showLoginScreen();
};

// 5. DATA LOGIC (LẤY DỮ LIỆU TỪ DB)
// =================================
async function loadDashboardData() {
    if (!currentUser) return;

    // Lấy ID để query (Ưu tiên ID từ bảng employees, nếu không có thì dùng Auth ID)
    const userId = currentUser.auth_user_id || currentUser.id;

    // A. LẤY LỊCH SỬ CHẤM CÔNG (Bảng 'attendance')
    const { data: history, error: errHist } = await supabase
        .from('attendance')
        .select('*')
        .eq('employee_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);

    if (!errHist) {
        allHistoryData = history;
        renderActivityHistory(history);
        updateStatusUI(history);
        
        // Tính toán sơ bộ số công (Demo logic)
        const workDays = new Set(history.map(h => new Date(h.check_in).toDateString())).size;
        setText("home-stat-days", workDays);
    }

    // B. LẤY DANH SÁCH YÊU CẦU (Bảng 'requests')
    const { data: requests, error: errReq } = await supabase
        .from('requests')
        .select('*')
        .eq('employee_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

    if (!errReq) {
        renderMyRequestsList(requests);
    }
    
    // C. Render thông tin user
    renderUserInfo();
}

// 6. LOGIC CHẤM CÔNG (CORE FEATURE)
// =================================
window.triggerCheckIn = function() {
    document.getElementById("modal-camera").classList.remove("hidden");
    toggleGlobalNav(false);
    startCamera();
};

window.takePicture = async function() {
    const video = document.getElementById("video");
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    
    closeCamera();
    showLoading(true);

    const userId = currentUser.auth_user_id || currentUser.id;

    // 1. Upload ảnh lên Supabase Storage
    canvas.toBlob(async (blob) => {
        const fileName = `${userId}/${Date.now()}.jpg`; // Tạo folder theo User ID
        
        const { data: uploadData, error: uploadError } = await supabase
            .storage
            .from('attendance-photos') // BẮT BUỘC: Phải tạo bucket này trong Storage rồi
            .upload(fileName, blob);

        if (uploadError) {
            showLoading(false);
            return showDialog("error", "Lỗi Upload", "Không thể lưu ảnh: " + uploadError.message);
        }

        // Lấy link ảnh
        const { data: { publicUrl } } = supabase.storage.from('attendance-photos').getPublicUrl(fileName);

        // 2. Ghi dữ liệu vào Database
        const { error: insertError } = await supabase
            .from('attendance')
            .insert({
                employee_id: userId,
                check_in: new Date().toISOString(),
                check_in_img: publicUrl,
                device_id: myDeviceId,
                location: "Văn phòng (GPS)" // Có thể update logic lấy GPS thật vào đây
            });

        showLoading(false);
        if (insertError) {
            showDialog("error", "Lỗi Ghi Dữ Liệu", insertError.message);
        } else {
            showToast("success", "✅ Chấm công thành công!");
            loadDashboardData();
        }
    }, 'image/jpeg', 0.6);
};

window.triggerCheckOut = function() {
    showDialog("confirm", "Kết thúc ca?", "Bạn xác nhận muốn ra về?", async () => {
        showLoading(true);
        const userId = currentUser.auth_user_id || currentUser.id;

        // Tìm lần check-in gần nhất chưa có check-out
        const { data: latest } = await supabase
            .from('attendance')
            .select('id')
            .eq('employee_id', userId)
            .is('check_out', null)
            .order('check_in', { ascending: false })
            .limit(1)
            .single();

        if (!latest) {
            showLoading(false);
            return showToast("error", "Bạn chưa Check-in hoặc đã Check-out rồi!");
        }

        // Update giờ ra
        const { error } = await supabase
            .from('attendance')
            .update({ check_out: new Date().toISOString() })
            .eq('id', latest.id);

        showLoading(false);
        if (error) showToast("error", error.message);
        else {
            showToast("success", "👋 Đã chấm công ra. Hẹn gặp lại!");
            loadDashboardData();
        }
    });
};

// 7. RENDER UI (ADAPTED FOR SUPABASE DATA STRUCTURE)
// =================================================
function renderActivityHistory(data) {
    const list = document.getElementById("home-recent-activity"); // Hoặc ID list tương ứng ở tab Home
    if (!list) return;

    if (!data || data.length === 0) {
        list.innerHTML = `<div class="text-center text-xs text-slate-400 py-4">Chưa có dữ liệu chấm công</div>`;
        return;
    }

    list.innerHTML = data.map(item => {
        // Format ngày giờ từ ISO String của Supabase
        const d = new Date(item.check_in);
        const dateStr = d.toLocaleDateString("vi-VN", {day: '2-digit', month:'2-digit'});
        const inTime = d.toLocaleTimeString("vi-VN", {hour:'2-digit', minute:'2-digit'});
        const outTime = item.check_out ? new Date(item.check_out).toLocaleTimeString("vi-VN", {hour:'2-digit', minute:'2-digit'}) : "--:--";

        return `
        <div class="bg-white p-3 rounded-2xl border border-slate-100 mb-2 flex justify-between items-center shadow-sm">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-slate-50 flex flex-col items-center justify-center text-slate-600 font-bold border border-slate-100">
                   <span class="text-[10px] uppercase">Thg ${d.getMonth()+1}</span>
                   <span class="text-lg leading-none">${d.getDate()}</span>
                </div>
                <div>
                    <div class="font-bold text-slate-700 text-sm">Ca làm việc</div>
                    <div class="text-[10px] text-slate-400">${item.device_id ? '📱 Mobile' : '💻 PC'}</div>
                </div>
            </div>
            <div class="text-right">
                 <div class="bg-emerald-50 text-emerald-700 px-2 py-1 rounded-lg text-xs font-bold font-mono border border-emerald-100">
                    ${inTime} - ${outTime}
                 </div>
            </div>
        </div>`;
    }).join("");
}

function renderMyRequestsList(data) {
    const list = document.getElementById("request-list-container");
    if (!list) return;
    if (data.length === 0) return list.innerHTML = `<div class="text-center text-xs text-slate-400 py-4">Chưa có đề xuất nào</div>`;

    list.innerHTML = data.map(req => {
        let statusColor = req.status === 'Approved' ? 'text-emerald-600 bg-emerald-50' : (req.status === 'Rejected' ? 'text-red-600 bg-red-50' : 'text-orange-600 bg-orange-50');
        const dateStr = new Date(req.created_at).toLocaleDateString("vi-VN");
        
        return `
        <div class="bg-white p-3 rounded-xl border border-slate-100 mb-2 flex justify-between items-center shadow-sm">
            <div>
                <div class="font-bold text-sm text-slate-700">${req.type || 'Đề xuất'}</div>
                <div class="text-xs text-slate-400">${req.reason} • ${dateStr}</div>
            </div>
            <span class="text-[10px] px-2 py-1 rounded-full font-bold ${statusColor}">${req.status || 'Pending'}</span>
        </div>`;
    }).join("");
}

function renderUserInfo() {
    if (!currentUser) return;
    setText("user-name", getShortName(currentUser.full_name || currentUser.email));
    setText("p-id", currentUser.employee_code || "NV-000");
    setText("p-email", currentUser.email);
    
    // Avatar
    const avatar = currentUser.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.full_name || "User")}&background=10b981&color=fff`;
    document.querySelectorAll(".user-avatar-img").forEach(img => img.src = avatar);
}

// 8. HELPERS & UI UTILS
// =====================
function updateClock() {
    const now = new Date();
    const t = document.getElementById("clock-time");
    const d = document.getElementById("clock-date");
    if(t) t.innerText = now.toLocaleTimeString("vi-VN", {hour:'2-digit', minute:'2-digit'});
    if(d) d.innerText = now.toLocaleDateString("vi-VN", {weekday:'long', day:'2-digit', month:'2-digit', year:'numeric'});
}

function updateStatusUI(history) {
    // Nếu bản ghi mới nhất chưa có checkout -> Đang làm việc
    const latest = history && history[0];
    const isWorking = latest && !latest.check_out;
    
    const idle = document.getElementById("state-idle");
    const working = document.getElementById("state-working");
    const loading = document.getElementById("state-loading");

    if(loading) loading.classList.add("hidden");
    
    if(isWorking) {
        if(idle) idle.classList.add("hidden");
        if(working) working.classList.remove("hidden");
    } else {
        if(idle) idle.classList.remove("hidden");
        if(working) working.classList.add("hidden");
    }
}

function startCamera() {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } })
        .then(stream => {
            videoStream = stream;
            document.getElementById("video").srcObject = stream;
        }).catch(err => showDialog("error", "Lỗi Camera", "Vui lòng cấp quyền truy cập!"));
}
function closeCamera() {
    if(videoStream) videoStream.getTracks().forEach(t => t.stop());
    document.getElementById("modal-camera").classList.add("hidden");
    toggleGlobalNav(true);
}

// Navigation & Views
function showLoginScreen() {
    document.getElementById("view-login").classList.remove("hidden");
    document.getElementById("view-main").classList.add("hidden");
    toggleGlobalNav(false);
}
function showMainApp() {
    document.getElementById("view-login").classList.add("hidden");
    document.getElementById("view-main").classList.remove("hidden");
    toggleGlobalNav(true);
    
    switchTab("home");
    loadDashboardData();
    if(refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(loadDashboardData, 15000); // Live update nhanh hơn
}
window.switchTab = function(tabName) {
    ["home", "requests", "contacts", "profile"].forEach(t => {
        const el = document.getElementById("tab-" + t);
        if(el) el.classList.add("hidden");
    });
    document.getElementById("tab-" + tabName)?.classList.remove("hidden");
    
    // Active Menu
    document.querySelectorAll(".nav-item").forEach(item => {
        const active = item.getAttribute("onclick").includes(tabName);
        const icon = item.querySelector("i");
        if(active) {
            icon?.classList.remove("text-slate-400");
            icon?.classList.add("text-emerald-600");
        } else {
            icon?.classList.add("text-slate-400");
            icon?.classList.remove("text-emerald-600");
        }
    });
};
function toggleGlobalNav(show) { document.getElementById("global-nav")?.classList.toggle("hidden", !show); }

// Utilities
function getDeviceId() {
    let id = localStorage.getItem("did");
    if(!id) { id = "DEV_"+Date.now(); localStorage.setItem("did", id); }
    return id;
}
function getShortName(name) { return name ? name.split(" ").pop() : "..."; }
function setText(id, val) { const el = document.getElementById(id); if(el) el.innerText = val; }
window.showLoading = (s) => document.getElementById("loader")?.classList.toggle("hidden", !s);
window.showToast = (type, msg) => {
    // Simple Toast
    const div = document.createElement("div");
    div.className = `fixed top-5 right-5 z-[9999] px-4 py-3 rounded-xl shadow-lg text-white text-sm font-bold animate-bounce-in ${type==='success'?'bg-emerald-500':'bg-red-500'}`;
    div.innerText = msg;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 3000);
};
window.showDialog = (type, title, msg, cb) => {
    if(type === 'confirm') { if(confirm(msg)) cb && cb(); }
    else alert(title + "\n" + msg);
};
