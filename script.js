// ==========================================
// 1. CẤU HÌNH & BIẾN TOÀN CỤC
// ==========================================
const API_URL = "https://script.google.com/macros/s/AKfycbxbuZVUPQ3W8QB-qrOxz0Y2GRMYbhJyrTtALToLn3fnz_HUDtDv5k-XZyKgjJj1qmhuKA/exec"; 

var currentUser = null;
var videoStream = null;
var allHistoryData = [];
var cachedContacts = [];
var cachedLocations = [];

var myDeviceId = getDeviceId();
var currentHistoryPage = 0; 
const HISTORY_PAGE_SIZE = 7; 

var tempAvatarBase64 = null;
var currentReqType = "Nghỉ phép";
var currentProfileLocation = "";
var currentRejectId = null;

// Helper: Gọi Backend Google Apps Script qua Fetch API
async function callBackend(functionName, params = []) {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      // Lưu ý: Không dùng mode: "no-cors" vì sẽ không đọc được JSON trả về
      body: JSON.stringify({
        action: functionName,
        params: params
      })
    });
    
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      console.error("Lỗi parse JSON:", text);
      return { success: false, message: "Dữ liệu trả về không đúng định dạng." };
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
    } catch (e) {
      logout();
    }
  } else {
    showLoginScreen();
  }

  setInterval(updateClock, 1000);
  updateClock();

  var btnReject = document.getElementById("btn-confirm-reject");
  if(btnReject) {
      btnReject.onclick = handleConfirmReject;
  }
});

window.handleLogin = async function () {
  var emailEl = document.getElementById("login-user");
  var passEl = document.getElementById("login-pass");
  if (!emailEl || !passEl) return;
  if (!emailEl.value || !passEl.value) {
    showToast("error", "Vui lòng nhập đầy đủ thông tin!");
    return;
  }
  
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

function showMainApp() {
  document.getElementById("view-main").classList.remove("hidden");
  toggleGlobalNav(true);
  renderUserInfo();
  switchTab("home");
  toggleHomeState("loading");
  
  checkNewNotifications();
  loadHistoryFull(); 
  loadMyRequests();
  loadLocations();
}

// ==========================================
// 3. UI HELPERS & NAVIGATION
// ==========================================
window.changeHistoryPage = function (direction) {
  if(!allHistoryData || allHistoryData.length === 0) return;
  var maxPage = Math.ceil(allHistoryData.length / HISTORY_PAGE_SIZE) - 1;
  var newPage = currentHistoryPage - direction;
  if (newPage < 0) newPage = 0;
  if (newPage > maxPage) newPage = maxPage;
  if (newPage !== currentHistoryPage) {
    currentHistoryPage = newPage;
    renderActivityHistory();
  }
};

function getShortNameClient(fullName) {
  if (!fullName) return "...";
  var parts = fullName.trim().split(" ");
  return parts.length > 0 ? parts[parts.length - 1] : fullName;
}

function getAvatarHtml(name, url, sizeClass = "w-12 h-12", textSize = "text-sm") {
  if (url && url.length > 5 && !url.includes("ui-avatars.com")) {
    return `<img src="${url}" class="${sizeClass} rounded-2xl object-cover border border-slate-100 shadow-sm bg-slate-200">`;
  }
  var initials = "--";
  if (name) {
    var parts = name.trim().split(" ");
    initials = parts.length === 1 ? parts[0].substring(0, 2) : parts[0].charAt(0) + parts[parts.length - 1].charAt(0);
    initials = initials.toUpperCase();
  }
  return `<div class="${sizeClass} rounded-2xl bg-slate-100 text-slate-600 border border-slate-200 shadow-sm flex items-center justify-center font-black ${textSize}">${initials}</div>`;
}

function toggleGlobalNav(show) {
  var nav = document.getElementById("global-nav");
  if (!nav) return;
  nav.classList.toggle("hidden", !show);
}

function renderUserInfo() {
  if (!currentUser) return;
  setText("user-name", getShortNameClient(currentUser.Name));
  setText("p-id", currentUser.Employee_ID);
  setText("p-email-display", currentUser.Email);
  setText("edit-phone", currentUser.Phone || "");
  setText("p-dept-display", currentUser.Department || "Chưa cập nhật");
  
  const displayTitle = currentUser.Position || "Staff";
  const displayLocation = currentUser.Location_Name || "Chưa cập nhật";

  ["user", "req", "profile", "contact"].forEach((prefix) => {
    var posBadge = document.getElementById(prefix + "-position-badge");
    if(posBadge) posBadge.innerText = displayTitle;
    var locBadge = document.getElementById(prefix + "-location-badge");
    if(locBadge) locBadge.innerText = displayLocation;
  });

  const adminRoles = ["Admin", "Manager", "HR"];
  const btnApproval = document.getElementById("btn-profile-approval");
  if (btnApproval) btnApproval.classList.toggle("hidden", !adminRoles.includes(currentUser.Role));

  const avatarUrl = (currentUser.Avatar && currentUser.Avatar.startsWith("http")) 
      ? currentUser.Avatar 
      : "https://ui-avatars.com/api/?name=" + encodeURIComponent(currentUser.Name) + "&background=059669&color=fff";
  
  document.querySelectorAll("#user-avatar, #profile-user-avatar, #edit-avatar-preview").forEach(img => {
      img.src = avatarUrl;
  });
}

window.switchTab = function (tabName) {
  ["modal-notifications", "modal-request", "modal-profile", "modal-contact-detail", "modal-search-contact"].forEach(id => {
      var el = document.getElementById(id);
      if(el) el.classList.add("hidden");
  });
  toggleGlobalNav(true);
  ["home", "requests", "contacts", "profile"].forEach(t => {
    var el = document.getElementById("tab-" + t);
    if(el) el.classList.add("hidden");
  });
  var target = document.getElementById("tab-" + tabName);
  if (target) target.classList.remove("hidden");

  var navItems = document.querySelectorAll(".nav-item");
  var idxMap = { home: 0, requests: 1, contacts: 2, profile: 3 };
  navItems.forEach((item, index) => {
    item.classList.toggle("active", index === idxMap[tabName]);
  });

  if (tabName === "contacts" && (!cachedContacts || cachedContacts.length === 0)) loadContacts();
  else if (tabName === "requests") switchActivityMode('history');
};

function toggleHomeState(state) {
  var loadingEl = document.getElementById("state-loading");
  var idleEl = document.getElementById("state-idle");
  var workEl = document.getElementById("state-working");
  if (!loadingEl || !idleEl || !workEl) return;
  [loadingEl, idleEl, workEl].forEach(el => {
     el.classList.add("opacity-0", "scale-90", "pointer-events-none");
     el.classList.remove("z-30", "z-20", "z-10");
  });
  if (state === "loading") { loadingEl.classList.remove("opacity-0", "scale-90", "pointer-events-none"); loadingEl.classList.add("z-30"); }
  else if (state === "working") { workEl.classList.remove("opacity-0", "scale-90", "pointer-events-none"); workEl.classList.add("z-20"); }
  else { idleEl.classList.remove("opacity-0", "scale-90", "pointer-events-none"); idleEl.classList.add("z-20"); }
}

// ==========================================
// 4. LOGIC LỊCH SỬ & CHECK-IN
// ==========================================
window.loadHistoryFull = async function() {
  if (!currentUser) return;
  var d = new Date();
  var currentMonth = d.getMonth() + 1;
  var currentYear = d.getFullYear();
  setText("current-month-badge", "Tháng " + currentMonth + "/" + currentYear);
  setText("hist-month-badge", "Tháng " + currentMonth + "/" + currentYear);
  
  const res = await callBackend("getHistory", [currentUser.Employee_ID]);
  allHistoryData = res.history || [];
  var stats = res.summary || { workDays: 0, lateMins: 0, errorCount: 0, remainingLeave: 12, leaveDays: 0 };
  
  setText("home-stat-days", stats.workDays);
  setText("home-stat-leave", stats.leaveDays || 0);
  setText("leave-stat-label", (stats.remainingLeave || 12) + " phép còn lại");
  setText("hist-total-days", stats.workDays);
  setText("hist-late-mins", stats.lateMins);
  setText("hist-errors", stats.errorCount);

  // Update Progress Bars
  var workBar = document.getElementById("work-progress-bar");
  if(workBar) workBar.style.width = Math.min(100, (stats.workDays / 26) * 100) + "%";
  var leaveBar = document.getElementById("leave-progress-bar");
  if(leaveBar) leaveBar.style.width = Math.min(100, (stats.remainingLeave / 12) * 100) + "%";

  var vnDate = ("0" + d.getDate()).slice(-2) + "/" + ("0" + (d.getMonth() + 1)).slice(-2) + "/" + d.getFullYear();
  var isCurrentlyCheckedIn = allHistoryData.some(r => r.Date === vnDate && r.Time_List && r.Time_List.some(t => t.out === "..."));
  toggleHomeState(isCurrentlyCheckedIn ? "working" : "idle");
  if (!document.getElementById("view-act-history").classList.contains("hidden")) renderActivityHistory();
};

window.triggerCheckIn = function () {
    document.getElementById("modal-camera").classList.remove("hidden");
    toggleGlobalNav(false);
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } })
      .then(function (s) {
        videoStream = s;
        document.getElementById("video").srcObject = s;
      })
      .catch(function () {
        showToast("error", "Không thể truy cập Camera!");
        closeCamera();
      });
};

window.closeCamera = function () {
    if (videoStream) videoStream.getTracks().forEach(t => t.stop());
    document.getElementById("modal-camera").classList.add("hidden");
    toggleGlobalNav(true);
};

window.takePicture = async function () {
  var v = document.getElementById("video");
  var c = document.createElement("canvas");
  c.width = v.videoWidth; c.height = v.videoHeight;
  c.getContext("2d").drawImage(v, 0, 0);
  var b64 = c.toDataURL("image/jpeg", 0.6);
  closeCamera();
  showLoading(true);
  
  navigator.geolocation.getCurrentPosition(async function (p) {
      const r = await callBackend("doCheckIn", [{
        employeeId: currentUser.Employee_ID,
        lat: p.coords.latitude, lng: p.coords.longitude,
        deviceId: myDeviceId, imageBase64: b64
      }]);
      showLoading(false);
      if (r.success) { showToast("success", r.message); loadHistoryFull(); }
      else { showDialog("error", "Thất bại", r.message); }
  }, function () {
      showLoading(false);
      showDialog("error", "Lỗi định vị", "Vui lòng bật GPS!");
  }, { enableHighAccuracy: true, timeout: 10000 });
};

window.triggerCheckOut = function () {
  showDialog("confirm", "Check-out", "Bạn muốn kết thúc ca làm việc?", async function () {
    showLoading(true);
    const r = await callBackend("doCheckOut", [{ employeeId: currentUser.Employee_ID }]);
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
  content.innerHTML = `<div class="text-center py-10"><i class="fa-solid fa-circle-notch fa-spin text-emerald-500"></i></div>`;

  const res = await callBackend("getMobileNotifications", [currentUser.Employee_ID]);
  renderNotificationUI(res, mode); 
};

function renderNotificationUI(res, mode) {
    var content = document.getElementById("noti-content-area");
    if (!res.success) {
        content.innerHTML = `<p class="text-center text-slate-400 py-10">${res.message}</p>`;
        return;
    }
    var html = "";
    if (res.data.approvals && res.data.approvals.length > 0) {
        html += `<h3 class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Cần duyệt</h3>`;
        res.data.approvals.forEach(req => {
            html += `
            <div class="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 mb-3">
                <div class="flex items-center gap-3 mb-3">
                    ${getAvatarHtml(req.Name, req.Avatar, "w-10 h-10", "text-xs")}
                    <div class="flex-1">
                        <p class="font-bold text-sm text-slate-800">${req.Name}</p>
                        <p class="text-[9px] text-slate-400">${req.Position} • ${req.Center_Name}</p>
                    </div>
                    <span class="badge badge-info">${req.Type}</span>
                </div>
                <div class="bg-slate-50 p-3 rounded-2xl mb-3"><p class="text-xs text-slate-600 italic">"${req.Reason}"</p></div>
                <div class="grid grid-cols-2 gap-2">
                    <button onclick="openRejectModal('${req.Request_ID}')" class="btn-danger-soft py-2 rounded-xl text-xs">Từ chối</button>
                    <button onclick="processRequestMobile('${req.Request_ID}', 'Approved')" class="btn-success py-2 rounded-xl text-xs">Duyệt</button>
                </div>
            </div>`;
        });
    }
    if (mode !== "approve" && res.data.myRequests && res.data.myRequests.length > 0) {
        html += `<h3 class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-6 mb-3">Đơn của tôi</h3>`;
        res.data.myRequests.forEach(req => {
            var statusClass = req.Status === "Approved" ? "badge-success" : "badge-info";
            html += `
            <div class="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 mb-2 flex justify-between items-center">
                <div><p class="text-sm font-bold text-slate-800">${req.Type}</p><p class="text-[9px] text-slate-400">${req.Dates}</p></div>
                <span class="badge ${statusClass}">${req.Status}</span>
            </div>`;
        });
    }
    content.innerHTML = html || `<p class="text-center text-slate-400 py-20">Không có thông báo mới</p>`;
}

window.processRequestMobile = async function (reqId, status, rejectReason) {
  showLoading(true);
  var note = status === "Approved" ? "Đã duyệt" : rejectReason || "";
  const res = await callBackend("processRequestAdmin", [reqId, status, note, currentUser.Name]);
  showLoading(false);
  showToast(res.success ? "success" : "error", res.message);
  if (res.success) { openNotifications("approve"); checkNewNotifications(); }
};

// ==========================================
// 6. TẠO ĐỀ XUẤT & PROFILE
// ==========================================
window.submitRequest = async function () {
  var reason = document.getElementById("req-reason").value;
  if (!reason) return showToast("error", "Vui lòng nhập nội dung!");
  
  showLoading(true);
  const r = await callBackend("submitRequest", [{
    employeeId: currentUser.Employee_ID,
    name: currentUser.Name,
    type: currentReqType,
    fromDate: toVNDate(document.getElementById("req-date-start").value),
    toDate: toVNDate(document.getElementById("req-date-end").value),
    reason: reason
  }]);
  showLoading(false);
  showToast(r.success ? "success" : "error", r.message);
  if (r.success) { closeRequestModal(); loadMyRequests(); loadHistoryFull(); }
};

window.submitProfileUpdate = async function () {
  showLoading(true);
  const res = await callBackend("updateEmployeeProfile", [{
    employeeId: currentUser.Employee_ID,
    phone: document.getElementById("edit-phone").value,
    centerId: currentProfileLocation,
    avatarBase64: tempAvatarBase64
  }]);
  showLoading(false);
  if (res.success) {
    showToast("success", "Cập nhật thành công!");
    if (res.newAvatar) currentUser.Avatar = res.newAvatar;
    localStorage.setItem("army_user_v2026", JSON.stringify(currentUser));
    renderUserInfo(); closeProfileModal();
  }
};

// ==========================================
// 7. LỊCH SỬ & DANH BẠ RENDER
// ==========================================
function renderActivityHistory() {
    var container = document.getElementById("activity-history-list");
    if (!container || !allHistoryData.length) return;
    var start = currentHistoryPage * HISTORY_PAGE_SIZE;
    var data = allHistoryData.slice(start, start + HISTORY_PAGE_SIZE);
    var html = "";
    data.forEach(item => {
        var hours = parseFloat(item.Total_Work_Hours || 0).toFixed(1);
        html += `
        <div class="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 mb-3 flex items-center justify-between">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-2xl bg-slate-50 flex flex-col items-center justify-center">
                    <span class="text-[10px] font-bold text-slate-400">${item.Date.split('/')[0]}</span>
                    <span class="text-[8px] text-slate-300">THG ${item.Date.split('/')[1]}</span>
                </div>
                <div><p class="text-sm font-bold text-slate-800">${hours} giờ công</p><p class="text-[9px] text-slate-400">${item.Status_List.join(', ')}</p></div>
            </div>
            <i class="fa-solid fa-chevron-right text-slate-200 text-xs"></i>
        </div>`;
    });
    container.innerHTML = html;
}

function renderContactList(data) {
    var list = document.getElementById("contacts-list");
    if(!list) return;
    var html = "";
    data.forEach((e, idx) => {
        html += `
        <div class="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-3 mb-2" onclick="openContactByIndex(${idx})">
            ${getAvatarHtml(e.Name, e.Avatar, "w-11 h-11", "text-sm")}
            <div class="flex-1"><p class="font-bold text-slate-800 text-sm">${e.Name}</p><p class="text-[10px] text-slate-400">${e.Position}</p></div>
            <a href="tel:${e.Phone}" class="w-9 h-9 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center"><i class="fa-solid fa-phone text-xs"></i></a>
        </div>`;
    });
    list.innerHTML = html;
}

// ==========================================
// 8. UTILS & MODALS
// ==========================================
async function loadContacts() {
    const data = await callBackend("getContacts", [currentUser.Role, currentUser.Center_ID]);
    cachedContacts = data;
    renderContactList(data);
}

async function loadLocations() {
    const data = await callBackend("getLocations");
    cachedLocations = data || [];
    renderLocationList();
}

function renderLocationList() {
    var list = document.getElementById("profile-location-list");
    if (!list) return;
    list.innerHTML = cachedLocations.map(loc => `
        <div onclick="selectProfileLocation('${loc.id}', '${loc.name}')" class="px-4 py-3 rounded-xl hover:bg-slate-50 cursor-pointer text-sm font-medium text-slate-700">${loc.name}</div>
    `).join('');
}

function selectProfileLocation(id, name) {
    currentProfileLocation = id;
    setText("profile-location-label", name);
    document.getElementById("profile-location-menu").classList.add("hidden");
}

function toggleLocationDropdown() {
    document.getElementById("profile-location-menu").classList.toggle("hidden");
}

window.openContactByIndex = function(idx) {
    var e = cachedContacts[idx];
    document.getElementById("modal-contact-detail").classList.remove("hidden");
    document.getElementById("contact-detail-avatar").src = e.Avatar || "";
    setText("contact-detail-name", e.Name);
    setText("contact-detail-phone", e.Phone);
    setText("contact-detail-email", e.Email);
}

window.handleConfirmReject = function() {
    var reason = document.getElementById("input-reject-reason").value;
    if(!reason) return showToast("error", "Vui lòng nhập lý do");
    processRequestMobile(currentRejectId, "Rejected", reason);
    document.getElementById("modal-reject-reason").classList.add("hidden");
}

window.openRejectModal = (id) => { currentRejectId = id; document.getElementById("modal-reject-reason").classList.remove("hidden"); };
window.closeRequestModal = () => document.getElementById("modal-request").classList.add("hidden");
window.closeProfileModal = () => document.getElementById("modal-profile").classList.add("hidden");

function showDialog(type, title, msg, okCallback) {
    var dialog = document.getElementById("custom-dialog");
    setText("dialog-title", title);
    setText("dialog-msg", msg);
    dialog.classList.remove("hidden");
    document.getElementById("btn-dialog-ok").onclick = () => { dialog.classList.add("hidden"); if(okCallback) okCallback(); };
    document.getElementById("btn-dialog-cancel").onclick = () => dialog.classList.add("hidden");
}

function setText(id, t) { var e = document.getElementById(id); if (e) e.innerText = t; }
function showLoading(s) { document.getElementById("loader").classList.toggle("hidden", !s); }
function showToast(type, m) {
  var x = document.getElementById("toast");
  setText("toast-msg", m);
  x.style.opacity = "1"; x.style.transform = "translate(-50%, 0)";
  setTimeout(() => { x.style.opacity = "0"; x.style.transform = "translate(-50%, -20px)"; }, 3000);
}
function toVNDate(d) { if (!d || !d.includes("-")) return d; var p = d.split("-"); return p[2] + "/" + p[1] + "/" + p[0]; }
function updateClock() {
  var d = new Date();
  setText("clock-display", d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false }));
  setText("date-display", d.toLocaleDateString("vi-VN", { weekday: 'long', day: 'numeric', month: 'numeric' }));
}
async function checkNewNotifications() {
    const res = await callBackend("getMobileNotifications", [currentUser.Employee_ID]);
    var dot = document.getElementById("noti-dot");
    if(dot) dot.classList.toggle("hidden", !(res.success && res.data.approvals.length > 0));
}
function switchActivityMode(mode) {
    document.getElementById("view-act-history").classList.toggle("hidden", mode !== 'history');
    document.getElementById("view-act-requests").classList.toggle("hidden", mode !== 'requests');
}
