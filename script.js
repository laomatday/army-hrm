// ==========================================
// 1. CẤU HÌNH & BIẾN TOÀN CỤC
// ==========================================
const API_URL = "https://script.google.com/macros/s/AKfycbxoJMK84REKqWB5ZMNWfX9Ut_UBLHsnVYQ2a14zeXW750NMmk7zvPkMhiCtRTsqAXgvew/exec";

var currentUser = null;
var videoStream = null;

// --- BIẾN CACHE (LƯU TRỮ TẠM THỜI ĐỂ TĂNG TỐC) ---
var allHistoryData = []; 
var cachedContacts = [];
var cachedLocations = [];
var cachedMyRequests = null; // [NEW] Cache cho danh sách đề xuất

var myDeviceId = getDeviceId();
var currentHistoryPage = 0; 
const HISTORY_PAGE_SIZE = 7; 

var tempAvatarBase64 = null;
var currentReqType = "Nghỉ phép";
var currentProfileLocation = "";
var currentRejectId = null;

// --- HTML SKELETONS ---
const SKELETON_CONTACT = `<div class="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-3 mb-3 animate-pulse"><div class="w-12 h-12 rounded-2xl bg-slate-200"></div><div class="flex-1 space-y-2"><div class="h-4 w-32 bg-slate-200 rounded-full"></div><div class="h-3 w-20 bg-slate-200 rounded-full"></div></div><div class="w-10 h-10 rounded-2xl bg-slate-200"></div></div>`.repeat(5);
const SKELETON_REQUEST = `<div class="bg-white p-5 rounded-[24px] shadow-sm border border-white mb-4 animate-pulse"><div class="flex justify-between items-start mb-4"><div class="flex gap-4"><div class="w-11 h-11 rounded-2xl bg-slate-200"></div><div class="space-y-2"><div class="h-4 w-24 bg-slate-200 rounded-full"></div><div class="h-3 w-16 bg-slate-200 rounded-full"></div></div></div><div class="w-16 h-6 bg-slate-200 rounded-lg"></div></div><div class="h-10 w-full bg-slate-200 rounded-2xl"></div></div>`.repeat(3);

// --- CALL BACKEND ---
async function callBackend(functionName, params = []) {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: functionName, params: params })
    });
    const text = await response.text();
    // Thử parse JSON, nếu lỗi thì trả về object lỗi
    try {
        return JSON.parse(text);
    } catch (e) {
        console.error("Lỗi Parse JSON:", text);
        return { success: false, message: "Dữ liệu trả về không đúng định dạng JSON" };
    }
  } catch (error) {
    console.error("Lỗi Backend:", error);
    return { success: false, message: "Không thể kết nối máy chủ!" };
  }
}

function getDeviceId() {
  var devId = localStorage.getItem("army_device_id");
  if (!devId) {
    devId = "DEV_" + Date.now().toString(36) + Math.random().toString(36).substr(2, 5).toUpperCase();
    localStorage.setItem("army_device_id", devId);
  }
  return devId;
}

// ==========================================
// 2. KHỞI TẠO & ĐĂNG NHẬP
// ==========================================
document.addEventListener("DOMContentLoaded", function () {
  var savedUser = localStorage.getItem("army_user_v2026");
  if (savedUser) {
    try {
      currentUser = JSON.parse(savedUser);
      routeUserFlow();
    } catch (e) { logout(); }
  } else { showLoginScreen(); }

  setInterval(updateClock, 1000);
  updateClock();

  var btnReject = document.getElementById("btn-confirm-reject");
  if(btnReject) btnReject.onclick = handleConfirmReject;
});

window.handleLogin = async function () {
  var emailEl = document.getElementById("login-user");
  var passEl = document.getElementById("login-pass");
  if (!emailEl?.value || !passEl?.value) return showToast("error", "Vui lòng nhập đầy đủ thông tin!");
  
  showLoading(true);
  const res = await callBackend("doLogin", [emailEl.value.trim(), passEl.value.trim(), myDeviceId]);
  showLoading(false);
  
  if (res.success) {
    currentUser = res.data;
    localStorage.setItem("army_user_v2026", JSON.stringify(currentUser));
    showToast("success", "Xin chào, " + currentUser.Name);
    routeUserFlow();
  } else {
    showDialog("error", "Đăng nhập thất bại", res.message);
  }
};

window.logout = function () {
  localStorage.removeItem("army_user_v2026");
  currentUser = null;
  location.reload();
};

function showLoginScreen() {
  document.getElementById("view-login").classList.remove("hidden");
  document.getElementById("view-main").classList.add("hidden");
  toggleGlobalNav(false);
}

function routeUserFlow() {
  if (!currentUser) return logout();
  document.getElementById("view-login").classList.add("hidden");
  showMainApp();
}

async function showMainApp() {
  document.getElementById("view-main").classList.remove("hidden");
  toggleGlobalNav(true);
  renderUserInfo();
  switchTab("home");
  toggleHomeState("loading");

  // [QUAN TRỌNG] Tải tất cả dữ liệu nền ngay từ đầu để Cache
  await Promise.all([
    checkNewNotifications(),
    loadHistoryFull(), 
    loadMyRequests(true), // Load ép buộc lần đầu để có Cache
    loadLocations()
  ]);
}

// ==========================================
// 3. UI HELPERS & NAVIGATION
// ==========================================
window.switchTab = function (tabName) {
  ["modal-notifications", "modal-request", "modal-profile", "modal-contact-detail", "modal-search-contact"].forEach(id => {
      document.getElementById(id)?.classList.add("hidden");
  });
  toggleGlobalNav(true);
  ["home", "requests", "contacts", "profile"].forEach(t => {
    document.getElementById("tab-" + t)?.classList.add("hidden");
  });
  document.getElementById("tab-" + tabName)?.classList.remove("hidden");

  var navItems = document.querySelectorAll(".nav-item");
  var idxMap = { home: 0, requests: 1, contacts: 2, profile: 3 };
  navItems.forEach((item, index) => {
    item.classList.toggle("active", index === idxMap[tabName]);
  });

  if (tabName === "contacts" && (!cachedContacts || cachedContacts.length === 0)) loadContacts();
  else if (tabName === "requests") switchActivityMode('history');
};

function renderUserInfo() {
  if (!currentUser) return;
  setText("user-name", getShortNameClient(currentUser.Name));
  setText("p-id", currentUser.Employee_ID);
  setText("p-email-display", currentUser.Email);
  setText("p-dept-display", currentUser.Department || "Chưa cập nhật");
  
  const displayTitle = currentUser.Position || "Staff";
  const displayLocation = currentUser.Location_Name || "Chưa cập nhật";

  ["user", "req", "profile", "contact"].forEach((prefix) => {
    setText(prefix + "-position-badge", displayTitle);
    setText(prefix + "-location-badge", displayLocation);
  });

  const adminRoles = ["Admin", "Manager", "HR"];
  document.getElementById("btn-profile-approval")?.classList.toggle("hidden", adminRoles.indexOf(currentUser.Role) === -1);

  const avatarUrl = (currentUser.Avatar && currentUser.Avatar.startsWith("http")) 
      ? currentUser.Avatar 
      : "https://ui-avatars.com/api/?name=" + encodeURIComponent(currentUser.Name) + "&background=059669&color=fff";

  document.querySelectorAll("#user-avatar, #profile-user-avatar, #edit-avatar-preview").forEach(img => img.src = avatarUrl);
}

// ==========================================
// 4. LOGIC LỊCH SỬ & CHECK-IN
// ==========================================
window.loadHistoryFull = async function() {
  var d = new Date();
  var timeLabel = "Tháng " + (d.getMonth() + 1) + "/" + d.getFullYear();
  setText("current-month-badge", timeLabel);
  setText("hist-month-badge", timeLabel);

  const res = await callBackend("getHistory", [currentUser.Employee_ID]);
  allHistoryData = res.history || [];
  var stats = res.summary || { workDays: 0, lateMins: 0, errorCount: 0, remainingLeave: 12, leaveDays: 0 };
  
  setText("home-stat-days", stats.workDays);
  setText("home-stat-leave", stats.leaveDays || 0);
  setText("leave-stat-label", (stats.remainingLeave || 12) + " phép còn lại");
  setText("hist-total-days", stats.workDays);
  setText("hist-late-mins", stats.lateMins);
  setText("hist-errors", stats.errorCount);

  var workPercent = Math.min(100, Math.round((stats.workDays / 26) * 100));
  setText("work-percentage", workPercent + "%");
  var workBar = document.getElementById("work-progress-bar");
  if (workBar) workBar.style.width = workPercent + "%";

  var vnDate = d.toLocaleDateString("vi-VN", {day: '2-digit', month: '2-digit', year: 'numeric'}).replace(/\./g, '/');
  var isCheckedIn = allHistoryData.some(r => r.Date === vnDate && r.Time_List?.some(t => t.out === "..."));
  toggleHomeState(isCheckedIn ? "working" : "idle");
  renderActivityHistory();
};

window.triggerCheckIn = function () {
  document.getElementById("modal-camera").classList.remove("hidden");
  toggleGlobalNav(false);
  navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } })
    .then(s => { videoStream = s; document.getElementById("video").srcObject = s; })
    .catch(() => showToast("error", "Không thể truy cập Camera!"));
};

window.closeCamera = function () {
  if (videoStream) videoStream.getTracks().forEach(t => t.stop());
  document.getElementById("modal-camera").classList.add("hidden");
  toggleGlobalNav(true);
};

window.takePicture = function () {
  var v = document.getElementById("video");
  var c = document.createElement("canvas");
  c.width = v.videoWidth; c.height = v.videoHeight;
  c.getContext("2d").drawImage(v, 0, 0);
  var b64 = c.toDataURL("image/jpeg", 0.6);
  closeCamera();
  showLoading(true);
  
  navigator.geolocation.getCurrentPosition(async (p) => {
    const r = await callBackend("doCheckIn", {
      employeeId: currentUser.Employee_ID,
      lat: p.coords.latitude, lng: p.coords.longitude,
      deviceId: myDeviceId, imageBase64: b64
    });
    showLoading(false);
    if (r.success) { showToast("success", r.message); loadHistoryFull(); }
    else showDialog("error", "Thất bại", r.message);
  }, () => { showLoading(false); showDialog("error", "Lỗi GPS", "Vui lòng bật định vị!"); }, { timeout: 10000 });
};

window.triggerCheckOut = function () {
  showDialog("confirm", "Check-out", "Bạn muốn kết thúc ca làm việc?", async () => {
    showLoading(true);
    const r = await callBackend("doCheckOut", { employeeId: currentUser.Employee_ID });
    showLoading(false);
    showToast(r.success ? "success" : "error", r.message);
    if (r.success) loadHistoryFull();
  });
};

// ==========================================
// 5. THÔNG BÁO & DUYỆT ĐƠN
// ==========================================
window.openNotifications = async function (mode) {
  var modal = document.getElementById("modal-notifications");
  var content = document.getElementById("noti-content-area");
  if (!modal || !content) return;
  modal.classList.remove("hidden");
  content.innerHTML = SKELETON_REQUEST;
  const res = await callBackend("getMobileNotifications", [currentUser.Employee_ID]);
  renderNotificationUI(res, mode);
};

function renderNotificationUI(res, mode) {
  var content = document.getElementById("noti-content-area");
  if (!res.success) return content.innerHTML = `<p class="text-center py-10">${res.message}</p>`;
  
  var html = "";
  if (res.data.approvals?.length > 0) {
    html += `<h3 class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Cần duyệt (${res.data.approvals.length})</h3>`;
    res.data.approvals.forEach(req => {
      html += `<div class="bg-white p-5 rounded-[24px] shadow-sm border border-slate-50 mb-4 animate-slide-up"><div class="flex justify-between items-start mb-3"><div class="flex items-center gap-3">${getAvatarHtml(req.Name, req.Avatar, "w-10 h-10", "text-xs")}<div><h4 class="font-bold text-slate-800 text-sm">${req.Name}</h4><p class="text-[9px] font-bold text-slate-400 uppercase">${req.Position}</p></div></div><span class="badge badge-info">${req.Type}</span></div><div class="bg-slate-50 p-3 rounded-2xl mb-4"><p class="text-xs text-slate-500 italic">"${req.Reason}"</p></div><div class="grid grid-cols-2 gap-3"><button onclick="openRejectModal('${req.Request_ID}')" class="btn-danger-soft py-2.5 rounded-xl text-xs">Từ chối</button><button onclick="processRequestMobile('${req.Request_ID}', 'Approved')" class="btn-success py-2.5 rounded-xl text-xs">Duyệt</button></div></div>`;
    });
  }
  if (mode !== "approve" && res.data.myRequests?.length > 0) {
    html += `<h3 class="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-6 mb-3">Đơn của tôi</h3>`;
    res.data.myRequests.forEach(req => {
      var sCls = req.Status === "Approved" ? "badge-success" : "badge-info";
      html += `<div class="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 mb-2 flex justify-between items-center"><div><p class="text-sm font-bold text-slate-800">${req.Type}</p><p class="text-[9px] text-slate-400">${req.Dates}</p></div><span class="badge ${sCls}">${req.Status}</span></div>`;
    });
  }
  content.innerHTML = html || `<p class="text-center py-20 text-slate-400">Không có dữ liệu</p>`;
}

window.processRequestMobile = async function (id, status, note) {
  showLoading(true);
  const r = await callBackend("processRequestAdmin", [id, status, note || "Đã duyệt", currentUser.Name]);
  showLoading(false);
  showToast(r.success ? "success" : "error", r.message);
  if (r.success) { openNotifications("approve"); checkNewNotifications(); }
};

// ==========================================
// 6. TẠO ĐỀ XUẤT (FIX LỖI FOREACH & CÓ CACHE)
// ==========================================

// Hàm vẽ giao diện từ dữ liệu (Tách riêng để dùng chung)
function renderMyRequestsHTML(data) {
  var container = document.getElementById("request-list-container");
  if (!container) return;

  if (!data || data.length === 0) {
    container.innerHTML = `<div class="text-center py-12 opacity-60"><div class="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm border border-slate-100"><i class="fa-solid fa-clipboard-check text-2xl text-slate-300"></i></div><p class="text-xs font-bold text-slate-400">Chưa có đề xuất nào</p></div>`;
    return;
  }

  var html = "";
  data.forEach(function (req) {
    var typeRaw = req["Type"] || "Khác";
    var fDate = req["From Date"] || req["From_Date"] || "";
    var tDate = req["To Date"] || req["To_Date"] || "";
    var dateDisplay = (fDate === tDate && fDate) ? fDate : (fDate + " - " + tDate);
    if (!fDate) dateDisplay = "Đang cập nhật";
    var reason = req["Reason"] || "Không có lý do";
    var status = req["Status"] || "Pending";
    
    var badgeClass = "";
    if (status === "Approved") badgeClass = "bg-emerald-50 text-emerald-600 border-emerald-100";
    else if (status === "Rejected") badgeClass = "bg-red-50 text-red-600 border-red-100";
    else badgeClass = "bg-orange-50 text-orange-600 border-orange-100";
    
    var statusBadge = `<span class="px-2.5 py-1 rounded-lg text-[10px] font-extrabold border ${badgeClass}">${status === "Approved" ? "Đã duyệt" : status === "Rejected" ? "Từ chối" : "Chờ duyệt"}</span>`;

    var icon = "fa-file-lines";
    var colorBg = "bg-slate-50 text-slate-500";
    var typeLower = String(typeRaw).toLowerCase();
    
    if (typeLower.includes("giải trình")) { icon = "fa-file-pen"; colorBg = "bg-orange-50 text-orange-600"; }
    else if (typeLower.includes("nghỉ")) { icon = "fa-umbrella-beach"; colorBg = "bg-blue-50 text-blue-600"; }
    else if (typeLower.includes("công tác")) { icon = "fa-plane-departure"; colorBg = "bg-purple-50 text-purple-600"; }

    html += `
      <div class="bg-white p-5 rounded-[24px] shadow-sm border border-white animate-slide-up mb-4 relative overflow-hidden group hover:shadow-md transition-all">
         <div class="flex justify-between items-start mb-4 relative z-10">
            <div class="flex gap-4">
                <div class="w-11 h-11 rounded-2xl ${colorBg} flex items-center justify-center text-lg shadow-inner border border-white"><i class="fa-solid ${icon}"></i></div>
                <div><h4 class="font-black text-slate-800 text-sm leading-tight mb-1">${typeRaw}</h4><p class="text-[10px] font-bold text-slate-400 flex items-center gap-1">${dateDisplay}</p></div>
            </div>
            ${statusBadge}
         </div>
         <div class="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-100 relative"><p class="text-xs font-medium text-slate-600 line-clamp-2 italic">"${reason}"</p></div>
      </div>`;
  });
  container.innerHTML = html;
}

// [UPDATED] Hàm tải đề xuất An toàn
window.loadMyRequests = async function(forceReload = false) {
  var container = document.getElementById("request-list-container");
  if (!container) return;

  // 1. Kiểm tra Cache (Nếu có và không ép tải lại -> Dùng luôn)
  if (!forceReload && cachedMyRequests !== null && Array.isArray(cachedMyRequests)) {
      renderMyRequestsHTML(cachedMyRequests);
      return;
  }

  // 2. Hiện Skeleton khi đang tải từ Server
  if (forceReload || !cachedMyRequests) {
      container.innerHTML = SKELETON_REQUEST;
  }

  // 3. Gọi Server
  const data = await callBackend("getMyRequests", [currentUser.Employee_ID]);

  // 4. Kiểm tra dữ liệu trả về có phải là Mảng (Array) không
  if (Array.isArray(data)) {
      cachedMyRequests = data; // Lưu Cache
      renderMyRequestsHTML(cachedMyRequests);
  } else {
      // Nếu Server trả về lỗi (Object) thay vì danh sách
      console.error("Lỗi tải đề xuất (Server Error):", data);
      
      container.innerHTML = `
        <div class="text-center py-12 opacity-60">
            <div class="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm border border-red-100">
                <i class="fa-solid fa-triangle-exclamation text-2xl text-red-400"></i>
            </div>
            <p class="text-xs font-bold text-slate-400">Không tải được dữ liệu</p>
            <button onclick="loadMyRequests(true)" class="mt-3 px-4 py-2 bg-white border border-slate-200 rounded-full text-[10px] font-bold shadow-sm active:scale-95 text-slate-600">Thử lại</button>
        </div>`;
        
      if (data && data.message) showToast("error", data.message);
  }
};

window.submitRequest = async function () {
  var reason = document.getElementById("req-reason").value;
  if (!reason) return showToast("error", "Vui lòng nhập lý do!");
  showLoading(true);
  const r = await callBackend("submitRequest", {
    employeeId: currentUser.Employee_ID, name: currentUser.Name, type: currentReqType,
    fromDate: toVNDate(document.getElementById("req-date-start").value),
    toDate: toVNDate(document.getElementById("req-date-end").value), reason: reason
  });
  showLoading(false);
  if (r.success) { 
      showToast("success", r.message); 
      closeRequestModal(); 
      // Xóa Cache để ép tải lại danh sách mới nhất
      cachedMyRequests = null;
      loadMyRequests(true); 
  }
};

window.submitProfileUpdate = async function () {
  var phone = document.getElementById("edit-phone").value;
  showLoading(true);
  const res = await callBackend("updateEmployeeProfile", {
    employeeId: currentUser.Employee_ID, phone: phone, centerId: currentProfileLocation, avatarBase64: tempAvatarBase64
  });
  showLoading(false);
  if (res.success) {
    showToast("success", "Thành công!");
    if (res.newAvatar) currentUser.Avatar = res.newAvatar;
    currentUser.Phone = phone; currentUser.Center_ID = currentProfileLocation;
    localStorage.setItem("army_user_v2026", JSON.stringify(currentUser));
    renderUserInfo(); closeProfileModal();
  }
};

// ==========================================
// 7. DANH BẠ & ĐỊA ĐIỂM
// ==========================================
async function loadContacts() {
  var list = document.getElementById("contacts-list");
  if (list) list.innerHTML = SKELETON_CONTACT;
  const data = await callBackend("getContacts", [currentUser.Role, currentUser.Center_ID]);
  cachedContacts = data;
  renderContactList(data);
}

function renderContactList(data) {
  var list = document.getElementById("contacts-list");
  if (!list) return;
  list.innerHTML = data.map((e, i) => `<div class="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-3 mb-3" onclick="openContactByIndex(${i})">${getAvatarHtml(e.Name, e.Avatar, "w-12 h-12", "text-sm")}<div class="flex-1 min-w-0"><p class="font-bold text-slate-800 truncate">${e.Name}</p><p class="text-[10px] text-slate-400 uppercase font-bold">${e.Position}</p></div><a href="tel:${e.Phone}" onclick="event.stopPropagation()" class="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><i class="fa-solid fa-phone"></i></a></div>`).join('');
}

async function loadLocations() {
  const data = await callBackend("getLocations");
  cachedLocations = data || [];
  renderLocationList();
}

function renderLocationList() {
  var list = document.getElementById("profile-location-list");
  if (list) list.innerHTML = cachedLocations.map(loc => `<div onclick="selectProfileLocation('${loc.id}', '${loc.name}')" class="px-4 py-3.5 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 cursor-pointer mb-1 flex justify-between"><span>${loc.name}</span><i class="fa-solid fa-check text-emerald-500 opacity-0"></i></div>`).join('');
}

// ==========================================
// 8. RENDER LỊCH SỬ CHI TIẾT
// ==========================================
function renderActivityHistory() {
  var container = document.getElementById("activity-history-list");
  if (!container || allHistoryData.length === 0) return;

  var displayData = allHistoryData.slice(currentHistoryPage * HISTORY_PAGE_SIZE, (currentHistoryPage + 1) * HISTORY_PAGE_SIZE);
  var maxPage = Math.ceil(allHistoryData.length / HISTORY_PAGE_SIZE) - 1;
  setText("hist-pagination-label", `${displayData[displayData.length-1].Date.substring(0,5)} - ${displayData[0].Date.substring(0,5)}`);

  container.innerHTML = displayData.map(item => {
    var dateParts = item.Date.split("/");
    var recordDate = new Date(dateParts[2], dateParts[1]-1, dateParts[0]);
    var dayName = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"][recordDate.getDay()];
    var totalH = parseFloat(item.Total_Work_Hours || 0);
    var isErr = item.Late_Minutes_Total > 0 || (totalH > 0 && totalH < 7);

    return `<div class="bg-white p-4 rounded-[24px] shadow-sm border border-slate-100 mb-3 flex items-center justify-between animate-slide-up"><div class="flex items-center gap-4"><div class="text-center w-10"><p class="text-[9px] font-bold text-slate-400 uppercase">${dayName}</p><p class="text-xl font-black text-slate-800">${dateParts[0]}</p></div><div class="w-px h-10 bg-slate-100"></div><div><div class="flex items-center gap-2"><div class="w-2 h-2 rounded-full ${totalH >= 7 ? 'bg-emerald-500' : totalH > 0 ? 'bg-orange-500' : 'bg-slate-300'}"></div><p class="text-sm font-bold text-slate-700">${totalH.toFixed(2)}h công</p></div><div class="text-[10px] text-slate-400 font-medium">${item.Time_List?.map(t => `${t.in}-${t.out}`).join(' | ') || 'No data'}</div></div></div>${isErr && !item.Has_Explained ? `<button onclick="openExplainModal('${item.Date}', 'Lỗi chấm công')" class="h-8 px-4 rounded-full bg-orange-50 text-orange-600 border border-orange-100 text-[10px] font-bold shadow-sm">Giải trình</button>` : `<div class="w-9 h-9 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center border border-emerald-100"><i class="fa-solid fa-check"></i></div>`}</div>`;
  }).join('');
}

// ==========================================
// 9. CÁC HÀM UTILS HỆ THỐNG
// ==========================================
function switchActivityMode(mode) {
    document.getElementById("btn-tab-history").className = mode === 'history' ? "px-4 py-1.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white shadow-md transition-all" : "px-3 py-1.5 rounded-full text-[10px] font-bold text-slate-500 hover:text-slate-800 transition-all";
    document.getElementById("btn-tab-requests").className = mode === 'requests' ? "px-4 py-1.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white shadow-md transition-all" : "px-3 py-1.5 rounded-full text-[10px] font-bold text-slate-500 hover:text-slate-800 transition-all";
    
    document.getElementById("view-act-history").classList.toggle("hidden", mode !== 'history');
    document.getElementById("view-act-requests").classList.toggle("hidden", mode !== 'requests');

    if (mode === "requests") {
        // Sử dụng CACHE khi chuyển tab (false = không ép tải lại)
        loadMyRequests(false);
    } else {
        renderActivityHistory();
    }
}

window.showDialog = (t, tl, m, cb) => {
  var d = document.getElementById("custom-dialog");
  setText("dialog-title", tl); setText("dialog-msg", m);
  document.getElementById("dialog-icon").className = t === "error" ? "fa-solid fa-circle-exclamation text-4xl text-red-500" : "fa-solid fa-circle-check text-4xl text-emerald-600";
  d.classList.remove("hidden");
  document.getElementById("btn-dialog-ok").onclick = () => { d.classList.add("hidden"); cb?.(); };
  document.getElementById("btn-dialog-cancel").onclick = () => d.classList.add("hidden");
};

window.showToast = (type, m) => {
  var x = document.getElementById("toast");
  setText("toast-msg", m);
  x.querySelector("div").className = `w-8 h-8 rounded-full flex items-center justify-center shadow-sm ${type === "error" ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-600"}`;
  x.classList.remove("hidden"); void x.offsetWidth; x.style.opacity = "1"; x.style.transform = "translate(-50%, 0)";
  setTimeout(() => { x.style.opacity = "0"; x.style.transform = "translate(-50%, -20px)"; setTimeout(() => x.classList.add("hidden"), 300); }, 3000);
};

window.openExplainModal = (d, err) => { openRequestModal("Giải trình", d); var input = document.getElementById("req-reason"); if (input) { input.value = `[${err}] `; input.focus(); } };
window.openRequestModal = (type, date) => { toggleGlobalNav(false); document.getElementById("modal-request").classList.remove("hidden"); selectReqType(type || "Nghỉ phép"); if(date) { var d = toISODate(date); document.getElementById("req-date-start").value = d; document.getElementById("req-date-end").value = d; } };
window.closeRequestModal = () => { document.getElementById("modal-request").classList.add("hidden"); toggleGlobalNav(true); };
window.openProfileModal = () => { document.getElementById("modal-profile").classList.remove("hidden"); toggleGlobalNav(false); };
window.closeProfileModal = () => { document.getElementById("modal-profile").classList.add("hidden"); toggleGlobalNav(true); };
window.openContactByIndex = (i) => { var e = cachedContacts[i]; document.getElementById("modal-contact-detail").classList.remove("hidden"); document.getElementById("contact-detail-avatar").src = e.Avatar; setText("contact-detail-name", e.Name); setText("contact-detail-position", e.Position); setText("contact-detail-phone", e.Phone); document.getElementById("contact-detail-call").href = `tel:${e.Phone}`; };
window.closeContactDetail = () => document.getElementById("modal-contact-detail").classList.add("hidden");
window.changeHistoryPage = (dir) => { var max = Math.ceil(allHistoryData.length/HISTORY_PAGE_SIZE)-1; currentHistoryPage = Math.max(0, Math.min(max, currentHistoryPage - dir)); renderActivityHistory(); };

// --- LOGIC TỪ CHỐI ---
window.openRejectModal = function (reqId) { currentRejectId = reqId; document.getElementById("input-reject-reason").value = ""; document.getElementById("modal-reject-reason").classList.remove("hidden"); };
window.closeRejectModal = function () { currentRejectId = null; document.getElementById("modal-reject-reason").classList.add("hidden"); };
window.handleConfirmReject = function() { var reason = document.getElementById("input-reject-reason").value.trim(); if (!reason) return showToast("error", "Vui lòng nhập lý do!"); if (currentRejectId) { processRequestMobile(currentRejectId, "Rejected", reason); closeRejectModal(); } };

function toVNDate(d) { if (!d || !d.includes("-")) return d; var p = d.split("-"); return `${p[2]}/${p[1]}/${p[0]}`; }
function toISODate(d) { if (!d || d.includes("-")) return d; var p = d.split("/"); return `${p[2]}-${p[1]}-${p[0]}`; }
function setText(id, t) { var e = document.getElementById(id); if (e) e.innerText = t; }
function showLoading(s) { document.getElementById("loader").classList.toggle("hidden", !s); }
function toggleGlobalNav(s) { document.getElementById("global-nav")?.classList.toggle("hidden", !s); }
function getShortNameClient(n) { return n?.split(" ").pop() || "..."; }
function getAvatarHtml(n, u, s, t) { return `<img src="${u || 'https://ui-avatars.com/api/?name='+n}" class="${s} rounded-2xl object-cover shadow-sm bg-slate-200">`; }
function toggleHomeState(s) { document.getElementById("state-loading").classList.add("hidden"); document.getElementById("state-idle").classList.toggle("hidden", s !== "idle"); document.getElementById("state-working").classList.toggle("hidden", s !== "working"); }
function updateClock() { var d = new Date(); setText("clock-display", d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false })); setText("date-display", d.toLocaleDateString("vi-VN", { weekday: 'long', day: 'numeric', month: 'numeric' })); }
async function checkNewNotifications() { const res = await callBackend("getMobileNotifications", [currentUser.Employee_ID]); var dot = document.getElementById("noti-dot"); if(dot) dot.classList.toggle("hidden", !(res.success && res.data.approvals?.length > 0)); }
function selectProfileLocation(id, name) { currentProfileLocation = id; setText("profile-location-label", name); document.getElementById("profile-location-menu").classList.add("hidden"); }
function toggleLocationDropdown() { document.getElementById("profile-location-menu").classList.toggle("hidden"); }
function selectReqType(t) { currentReqType = t; setText("req-type-label", t === "Giải trình" ? "Giải trình công" : t); document.getElementById("req-type-menu").classList.add("hidden"); }
function toggleReqDropdown() { document.getElementById("req-type-menu").classList.toggle("hidden"); }
