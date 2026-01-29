// ==========================================
// 1. CẤU HÌNH & BIẾN TOÀN CỤC
// ==========================================
// QUAN TRỌNG: Thay URL Web App Google Apps Script của bạn vào đây
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
      mode: "no-cors", // Hoặc bỏ nếu Apps Script đã hỗ trợ CORS qua Redirect
      body: JSON.stringify({
        action: functionName,
        params: params
      })
    });
    
    // Lưu ý: Apps Script trả về 302 Redirect. Fetch API tự xử lý.
    // Nếu gặp lỗi CORS "no-cors", bạn cần thiết lập Web App Apps Script chuẩn.
    return await response.json();
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
// (Phần này giữ nguyên logic hiển thị từ code cũ của bạn)
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
  setText("p-email", currentUser.Email);
  setText("p-phone", currentUser.Phone || "Chưa cập nhật");
  setText("p-dept", currentUser.Department || "Chưa cập nhật");
  setText("leave-balance", currentUser.Annual_Leave_Balance !== undefined ? currentUser.Annual_Leave_Balance : 12);
  ["req-user-name", "profile-user-name", "contact-user-name"].forEach(id => setText(id, currentUser.Name));
  const displayTitle = currentUser.Position || "Staff";
  const displayLocation = currentUser.Location_Name || "Chưa cập nhật";
  ["user", "req", "profile", "contact"].forEach((prefix) => {
    setText(prefix + "-position-badge", displayTitle);
    setText(prefix + "-location-badge", displayLocation);
  });
  const adminRoles = ["Admin", "Manager", "HR"];
  const btnApproval = document.getElementById("btn-profile-approval");
  if (btnApproval) btnApproval.classList.toggle("hidden", !adminRoles.includes(currentUser.Role));
  const avatarUrl = (currentUser.Avatar && currentUser.Avatar.startsWith("http")) 
      ? currentUser.Avatar 
      : "https://ui-avatars.com/api/?name=" + encodeURIComponent(currentUser.Name) + "&background=059669&color=fff";
  document.querySelectorAll("#user-avatar, #profile-user-avatar, #req-user-avatar, #contact-user-avatar").forEach(img => {
      img.src = avatarUrl;
      img.style.objectFit = "cover";
  });
}

window.switchTab = function (tabName) {
  ["modal-notifications", "modal-request", "modal-profile", "modal-contact-detail", "view-approvals"].forEach(id => {
      var el = document.getElementById(id);
      if(el) el.classList.add("hidden");
  });
  toggleGlobalNav(true);
  ["home", "requests", "contacts", "profile"].forEach(t => {
    document.getElementById("tab-" + t).classList.add("hidden");
  });
  var target = document.getElementById("tab-" + tabName);
  if (target) target.classList.remove("hidden");
  var navItems = document.querySelectorAll(".nav-item");
  var idxMap = { home: 0, requests: 1, contacts: 2, profile: 3 };
  navItems.forEach((item, index) => {
    var isActive = index === idxMap[tabName];
    item.classList.toggle("active", isActive);
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
// 4. LOGIC LỊCH SỬ & CHECK-IN (ASYNC UPDATED)
// ==========================================
window.loadHistoryFull = async function() {
  if (!currentUser) return;
  var d = new Date();
  var currentMonth = d.getMonth() + 1;
  var currentYear = d.getFullYear();
  setText("current-month-badge", "Tháng " + currentMonth + "/" + currentYear);
  
  const res = await callBackend("getHistory", [currentUser.Employee_ID]);
  allHistoryData = res.history || [];
  var stats = res.summary || { workDays: 0, lateMins: 0, errorCount: 0, remainingLeave: 12, leaveDays: 0 };
  
  // Logic tính toán hiển thị (giữ nguyên từ bản cũ)
  setText("home-stat-days", stats.workDays);
  setText("home-stat-leave", stats.leaveDays || 0);
  setText("leave-stat-label", (stats.remainingLeave || 12) + " phép còn lại");
  setText("hist-total-days", stats.workDays);
  setText("hist-late-mins", stats.lateMins);
  setText("hist-errors", stats.errorCount);

  var vnDate = ("0" + d.getDate()).slice(-2) + "/" + ("0" + (d.getMonth() + 1)).slice(-2) + "/" + d.getFullYear();
  var isCurrentlyCheckedIn = allHistoryData.some(r => r.Date === vnDate && r.Time_List.some(t => t.out === "..."));
  toggleHomeState(isCurrentlyCheckedIn ? "working" : "idle");
  if (!document.getElementById("view-act-history").classList.contains("hidden")) renderActivityHistory();
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
// 5. THÔNG BÁO & DUYỆT ĐƠN (ASYNC UPDATED)
// ==========================================
window.openNotifications = async function (mode) {
  var modal = document.getElementById("modal-notifications");
  var content = document.getElementById("noti-content-area");
  if (!modal || !content) return;
  modal.classList.remove("hidden");
  content.innerHTML = `<div class="text-center py-10"><i class="fa-solid fa-circle-notch fa-spin text-emerald-500"></i></div>`;

  const res = await callBackend("getMobileNotifications", [currentUser.Employee_ID]);
  // (Logic render HTML cho thông báo giữ nguyên như bản cũ của bạn)
  // Lưu ý: Thay res.data.approvals... tùy theo cấu trúc trả về
  renderNotificationUI(res, mode); 
};

window.processRequestMobile = async function (reqId, status, rejectReason) {
  showLoading(true);
  var note = status === "Approved" ? "Đã duyệt" : rejectReason || "";
  const res = await callBackend("processRequestAdmin", [reqId, status, note, currentUser.Name]);
  showLoading(false);
  showToast(res.success ? "success" : "error", res.message);
  if (res.success) { openNotifications("approve"); checkNewNotifications(); }
};

// ==========================================
// 6. TẠO ĐỀ XUẤT & PROFILE (ASYNC UPDATED)
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
// 7. UTILS & OTHERS (Giữ nguyên)
// ==========================================
// (Các hàm loadContacts, loadMyRequests, loadLocations, updateClock... 
// chỉ cần thay google.script.run bằng await callBackend tương ứng)

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

function setText(id, t) {
  var e = document.getElementById(id);
  if (e) e.innerText = t;
}

function updateClock() {
  var d = new Date();
  var timeStr = d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false });
  setText("clock-display", timeStr);
  setText("date-display", d.toLocaleDateString("vi-VN", { weekday: 'long', day: 'numeric', month: 'numeric' }));
}

function showLoading(s) {
  document.getElementById("loader").classList.toggle("hidden", !s);
}

function showToast(type, m) {
  var x = document.getElementById("toast");
  document.getElementById("toast-msg").innerText = m;
  x.style.opacity = "1"; x.style.transform = "translate(-50%, 0)";
  setTimeout(() => { x.style.opacity = "0"; x.style.transform = "translate(-50%, -20px)"; }, 3000);
}

function toVNDate(d) {
  if (!d || !d.includes("-")) return d;
  var p = d.split("-"); return p[2] + "/" + p[1] + "/" + p[0];

}
