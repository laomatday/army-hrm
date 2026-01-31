const API_URL = "https://script.google.com/macros/s/AKfycbzdeTDLWipn5sb7qbLdow6isEC6UoS7HuSHWdLpc3B7wbbXtQE_c4KDJ8lwopx4iCHX/exec";

// ==========================================
// 1. CÁC HÀM TIỆN ÍCH GIAO DIỆN (UTILS) - Đặt đầu file để tránh lỗi
// ==========================================

// Hàm gọi API sang Google Apps Script
async function callBackend(functionName, params = []) {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: functionName, params: params }),
    });

    if (!response.ok) throw new Error("HTTP Error: " + response.status);
    const text = await response.text();
    // Xử lý trường hợp response rỗng
    return text ? JSON.parse(text) : {};
  } catch (error) {
    console.error("Lỗi Backend:", error);
    return { success: false, message: "Lỗi kết nối server: " + error.message };
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

function toggleGlobalNav(show) {
  var nav = document.getElementById("global-nav");
  if (!nav) return;
  if (show) nav.classList.remove("hidden");
  else nav.classList.add("hidden");
}

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

function setText(id, t) {
  var e = document.getElementById(id);
  if (e) e.innerText = t;
}

function showLoading(s) {
  var el = document.getElementById("loader");
  if (el)
    el.className = s
      ? "fixed inset-0 z-[999] bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center"
      : "hidden";
}

function showToast(type, m) {
  var x = document.getElementById("toast");
  if (!x) return;
  document.getElementById("toast-msg").innerText = m;
  var iconBox = x.querySelector("div");
  iconBox.className =
    "w-8 h-8 rounded-full flex items-center justify-center shadow-sm " +
    (type === "error" ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-600");
  x.classList.remove("hidden");
  void x.offsetWidth;
  x.style.opacity = "1";
  x.style.transform = "translate(-50%, 0)";
  setTimeout(function () {
    x.style.opacity = "0";
    x.style.transform = "translate(-50%, -20px)";
    setTimeout(function () {
      x.classList.add("hidden");
    }, 300);
  }, 3000);
}

function showDialog(t, tl, m, cb) {
  var d = document.getElementById("custom-dialog");
  if (!d) return;
  document.getElementById("dialog-title").innerText = tl;
  document.getElementById("dialog-msg").innerText = m;
  var icon = document.getElementById("dialog-icon");
  if (t === "error") icon.className = "fa-solid fa-circle-exclamation text-4xl text-red-500";
  else icon.className = "fa-solid fa-circle-check text-4xl text-emerald-600";
  d.classList.remove("hidden");
  var oldBtn = document.getElementById("btn-dialog-ok");
  var newBtn = oldBtn.cloneNode(true);
  oldBtn.parentNode.replaceChild(newBtn, oldBtn);
  newBtn.onclick = function () {
    d.classList.add("hidden");
    if (cb) cb();
  };
  document.getElementById("btn-dialog-cancel").onclick = function () {
    d.classList.add("hidden");
  };
}

function updateClock() {
  var d = new Date();
  var timeStr = d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false });
  var days = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
  var dateStr = days[d.getDay()] + ", Ngày " + d.getDate() + "/" + (d.getMonth() + 1);
  setText("clock-display", timeStr);
  setText("date-display", dateStr);
}

function toggleHomeState(state) {
  var loadingEl = document.getElementById("state-loading");
  var idleEl = document.getElementById("state-idle");
  var workEl = document.getElementById("state-working");
  if (!loadingEl || !idleEl || !workEl) return;

  const hide = (el) => {
    el.classList.remove("opacity-100", "scale-100", "z-30", "z-20", "z-10");
    el.classList.add("opacity-0", "scale-90", "pointer-events-none");
  };
  const show = (el, zIndex) => {
    el.classList.remove("opacity-0", "scale-90", "pointer-events-none");
    el.classList.add("opacity-100", "scale-100", zIndex);
  };

  [loadingEl, idleEl, workEl].forEach(hide);

  if (state === "loading") show(loadingEl, "z-30");
  else if (state === "working") show(workEl, "z-20");
  else show(idleEl, "z-20");
}

// ==========================================
// 2. BIẾN TOÀN CỤC & CẤU HÌNH
// ==========================================
var currentUser = null;
var videoStream = null;
var allHistoryData = [];
var cachedContacts = [];
var cachedLocations = [];
var cachedNotifications = null;
var cachedMyRequests = null;
var refreshInterval = null;

var myDeviceId = getDeviceId();
var currentHistoryPage = 0;
const HISTORY_PAGE_SIZE = 7;

var tempAvatarBase64 = null;
var currentReqType = "Nghỉ phép";
var currentProfileLocation = "";
var currentRejectId = null;

// --- HTML SKELETON ---
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
// 3. RENDER UI FUNCTIONS (GLOBAL SCOPE)
// ==========================================

function renderUserInfo() {
  if (!currentUser) return;

  setText("user-name", getShortNameClient(currentUser.Name));
  setText("p-id", currentUser.Employee_ID);

  // Profile Modal Fields
  var emailDisplay = document.getElementById("edit-email");
  if (emailDisplay) emailDisplay.value = currentUser.Email || "";

  var phoneDisplay = document.getElementById("edit-phone");
  if (phoneDisplay) phoneDisplay.value = currentUser.Phone || "";

  var deptDisplay = document.getElementById("edit-dept");
  if (deptDisplay) deptDisplay.value = currentUser.Department || "";

  // Text Display Fields (nếu có)
  setText("p-email", currentUser.Email);
  setText("p-phone", currentUser.Phone || "Chưa cập nhật");
  setText("p-dept", currentUser.Department || "Chưa cập nhật");

  // Các ID mới thêm vào Modal Profile
  setText("p-email-display", currentUser.Email);
  setText("p-dept-display", currentUser.Department || "Chưa cập nhật");

  setText("leave-balance", currentUser.Annual_Leave_Balance !== undefined ? currentUser.Annual_Leave_Balance : 12);

  ["req-user-name", "profile-user-name", "contact-user-name"].forEach((id) => setText(id, currentUser.Name));

  const displayTitle = currentUser.Position || "Staff";
  const displayLocation = currentUser.Location_Name || "Chưa cập nhật";

  ["user", "req", "profile", "contact"].forEach((prefix) => {
    setText(prefix + "-position-badge", displayTitle);
    setText(prefix + "-location-badge", displayLocation);
  });

  // Location Input trong Modal
  var locDisplay = document.getElementById("profile-location-display");
  if (locDisplay) locDisplay.value = displayLocation;

  // Quyền Admin/Manager
  const adminRoles = ["Admin", "Manager", "HR"];
  const btnApproval = document.getElementById("btn-profile-approval");
  if (btnApproval) {
    btnApproval.classList.toggle("hidden", adminRoles.indexOf(currentUser.Role) === -1);
  }

  const avatarUrl =
    currentUser.Avatar && currentUser.Avatar.startsWith("http")
      ? currentUser.Avatar
      : "https://ui-avatars.com/api/?name=" + encodeURIComponent(currentUser.Name) + "&background=059669&color=fff";

  document
    .querySelectorAll(
      "#user-avatar, #profile-user-avatar, #req-user-avatar, #contact-user-avatar, #edit-avatar-preview"
    )
    .forEach((img) => {
      img.src = avatarUrl;
      img.style.objectFit = "cover";
    });
}

function renderHistoryStats(summary) {
  if (!summary) return;

  var d = new Date();
  var timeLabel = "Tháng " + (d.getMonth() + 1) + "/" + d.getFullYear();
  setText("current-month-badge", timeLabel);
  setText("hist-month-badge", timeLabel);
  setText("stat-year-label", "Năm " + d.getFullYear());

  var daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  var standardDays = 0;
  for (var i = 1; i <= daysInMonth; i++) {
    var tempDate = new Date(d.getFullYear(), d.getMonth(), i);
    if (tempDate.getDay() !== 0) standardDays++;
  }

  setText("home-stat-days", summary.workDays);
  setText("home-stat-label", "Công chuẩn: " + standardDays);

  var percent = standardDays > 0 ? Math.round((summary.workDays / standardDays) * 100) : 0;
  if (percent > 100) percent = 100;
  setText("work-percentage", percent + "%");

  var workBar = document.getElementById("work-progress-bar");
  if (workBar) workBar.style.width = percent + "%";

  var used = summary.leaveDays !== undefined ? summary.leaveDays : 0;
  setText("home-stat-leave", used);

  var remaining = summary.remainingLeave !== undefined ? summary.remainingLeave : 12;
  var labelEl = document.getElementById("leave-stat-label");
  if (labelEl) labelEl.innerText = remaining + " phép còn lại";

  var estimatedMax = used + remaining;
  if (estimatedMax === 0) estimatedMax = 12;
  var leavePercent = (remaining / estimatedMax) * 100;
  if (leavePercent < 0) leavePercent = 0;
  if (leavePercent > 100) leavePercent = 100;

  var leaveBar = document.getElementById("leave-progress-bar");
  if (leaveBar) leaveBar.style.width = leavePercent + "%";

  setText("hist-total-days", summary.workDays);
  setText("hist-late-mins", summary.lateMins);
  setText("hist-errors", summary.errorCount);
}

function renderNotificationsBadge(notiData) {
  // notiData ở đây là nội dung của res.data từ getMobileNotifications
  // Trong code.js: data: { approvals: [...], myRequests: [...] }

  var count = notiData.approvals ? notiData.approvals.length : 0;

  var notiDot = document.getElementById("noti-dot");
  var profileDot = document.getElementById("profile-noti-dot");
  var homePendingEl = document.getElementById("home-stat-pending");

  if (homePendingEl) homePendingEl.innerText = count;

  // Đếm đơn chưa đọc của tôi
  var myUnreadCount = 0;
  if (notiData.myRequests) {
    notiData.myRequests.forEach(function (r) {
      if (checkIsUnread(r.Request_ID, r.Status)) {
        myUnreadCount++;
      }
    });
  }

  if (count > 0 || myUnreadCount > 0) {
    if (notiDot) notiDot.classList.remove("hidden");
    if (profileDot) profileDot.classList.remove("hidden");
  } else {
    if (notiDot) notiDot.classList.add("hidden");
    if (profileDot) profileDot.classList.add("hidden");
  }
}

// File: js.html
// Thay thế hàm này để bỏ chấm đỏ trên thẻ đơn
function renderNotificationContent(data, mode) {
  var content = document.getElementById("noti-content-area");
  var hasApp = data.approvals && data.approvals.length > 0;
  var hasMy = data.myRequests && data.myRequests.length > 0;

  // Reset mảng chọn khi mở lại popup
  selectedRequests = [];
  updateBatchActions();

  if (!hasApp && !hasMy)
    return (content.innerHTML = `<div class="text-center py-24 opacity-60"><p>Không có thông báo</p></div>`);

  var html = "";

  // --- 1. PHẦN DUYỆT ĐƠN (CÓ CHECKBOX) ---
  if (hasApp) {
    html += `
        <div class="mb-6">
            <div class="flex justify-between items-center mb-3 px-1">
                <h3 class="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
                    <i class="fa-solid fa-layer-group"></i> Cần duyệt (${data.approvals.length})
                </h3>
                <button onclick="toggleSelectAll(${data.approvals.length})" class="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                    Chọn tất cả
                </button>
            </div>
            <div class="space-y-4">`;

    data.approvals.forEach((req) => {
      var chkId = `chk-req-${req.Request_ID}`;
      html += `
            <div class="bg-white p-4 rounded-[20px] shadow-sm border border-slate-50 relative overflow-hidden flex gap-3">
                <div class="flex flex-col justify-center">
                    <input type="checkbox" id="${chkId}" onchange="toggleSelectRequest('${req.Request_ID}')" 
                    class="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600 transition-all">
                </div>
                <div class="flex-1 min-w-0" onclick="document.getElementById('${chkId}').click()">
                    <div class="flex justify-between items-start mb-2">
                       <div>
                          <h4 class="font-bold text-slate-800 text-sm leading-tight">${req.Name}</h4>
                          <p class="text-[11px] font-bold text-slate-500 mt-1 flex items-center gap-1.5">
                             <span class="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">${req.Position || "NV"}</span>
                             <span>${req.Location_Name || ""}</span>
                          </p>
                       </div>
                       <span class="px-2 py-1 rounded-lg text-[10px] font-bold bg-purple-50 text-purple-600 border border-purple-100 uppercase tracking-wide">${req.Type}</span>
                    </div>
                    <div class="bg-slate-50 rounded-xl p-2.5 mb-2 border border-slate-100">
                         <div class="flex items-center gap-2 text-xs font-bold text-slate-700 mb-0.5">
                            <i class="fa-regular fa-calendar text-emerald-500"></i> ${req.Dates}
                         </div>
                         <p class="text-xs text-slate-500 italic pl-5 line-clamp-1">"${req.Reason}"</p>
                    </div>
                </div>
            </div>`;
    });
    html += `</div></div>`;
  }

  // --- 2. PHẦN ĐƠN CỦA TÔI (ĐÃ BỎ CHẤM ĐỎ) ---
  if (mode !== "approve" && hasMy) {
    html += `<div><h3 class="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2"><i class="fa-regular fa-bell"></i> Đơn của tôi</h3><div class="space-y-3">`;
    data.myRequests.forEach((req) => {
      var st = req.Status;
      var col =
        st === "Approved"
          ? "text-emerald-500 bg-emerald-50"
          : st === "Rejected"
            ? "text-red-500 bg-red-50"
            : "text-orange-500 bg-orange-50";
      // Đã xóa biến dot và ${dot} trong HTML dưới đây
      html += `
             <div class="bg-white p-4 rounded-[20px] border border-slate-100 flex items-center gap-4 shadow-sm relative overflow-hidden">
                <div class="w-10 h-10 rounded-2xl ${col} flex items-center justify-center text-lg shadow-sm shrink-0"><i class="fa-solid ${st === "Approved" ? "fa-check" : st === "Rejected" ? "fa-xmark" : "fa-hourglass"}"></i></div>
                <div class="flex-1 min-w-0">
                    <div class="flex justify-between items-center mb-0.5"><span class="font-bold text-sm text-slate-800">${req.Type}</span><span class="text-[9px] font-extrabold ${col} px-2 py-0.5 rounded border border-current opacity-80">${st}</span></div>
                    <p class="text-[10px] text-slate-400 font-bold">${req.Dates}</p>
                    ${req.Note ? `<p class="text-[10px] text-slate-500 bg-slate-50 px-2 py-1 rounded mt-1.5 italic line-clamp-1"><i class="fa-solid fa-reply mr-1"></i>${req.Note}</p>` : ""}
                </div>
             </div>`;
    });
    html += `</div></div>`;
  }

  content.innerHTML = html;
}

function renderMyRequestsHTML(container, data) {
  if (!data || data.length === 0) {
    container.innerHTML = `<div class="text-center py-12 opacity-60"><div class="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm border border-slate-100"><i class="fa-solid fa-clipboard-check text-2xl text-slate-300"></i></div><p class="text-xs font-bold text-slate-400">Chưa có đề xuất nào</p></div>`;
    return;
  }
  var html = "";
  data.forEach(function (req) {
    var typeRaw = req["Type"] || "Khác";
    var fDate = req["From Date"] || req["From_Date"] || "";
    var tDate = req["To Date"] || req["To_Date"] || "";
    var dateDisplay = fDate === tDate && fDate ? fDate : fDate + " - " + tDate;
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

    if (typeLower.includes("giải trình")) {
      icon = "fa-file-pen";
      colorBg = "bg-orange-50 text-orange-600";
    } else if (typeLower.includes("nghỉ")) {
      icon = "fa-umbrella-beach";
      colorBg = "bg-blue-50 text-blue-600";
    } else if (typeLower.includes("công tác")) {
      icon = "fa-plane-departure";
      colorBg = "bg-purple-50 text-purple-600";
    }

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

// ==========================================
// 4. LOGIC AUTH & INIT
// ==========================================

document.addEventListener("DOMContentLoaded", function () {
  if (typeof restoreBadgeState === "function") restoreBadgeState();

  // Kiểm tra session cũ
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
  if (btnReject) {
    btnReject.onclick = handleConfirmReject;
  }
  var inputUser = document.getElementById("login-user");
  var inputPass = document.getElementById("login-pass");

  function triggerLoginOnEnter(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      handleLogin();
    }
  }

  if (inputUser) inputUser.addEventListener("keydown", triggerLoginOnEnter);
  if (inputPass) inputPass.addEventListener("keydown", triggerLoginOnEnter);
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
    showToast("success", "Xin chào, " + getShortNameClient(currentUser.Name));
    routeUserFlow();
  } else {
    showDialog("error", "Đăng nhập thất bại", res.message);
  }
};

window.logout = function () {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
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

  // Quan trọng: Gọi sau khi hàm đã được định nghĩa
  renderUserInfo();
  switchTab("home");
  toggleHomeState("loading");

  // GỌI API BAN ĐẦU
  loadDashboardData();

  // Auto refresh
  if (refreshInterval) clearInterval(refreshInterval);
  refreshInterval = setInterval(function () {
    // Gọi ngầm các API quan trọng
    Promise.all([
      checkNewNotifications(),
      // Các API khác nếu cần thiết (không nên gọi quá nhiều để tránh spam server)
    ]);
  }, 30000);
}

async function loadDashboardData() {
  if (!currentUser) return;

  // Vì backend KHÔNG CÓ getDashboardData, ta dùng Promise.all gọi song song
  // Các hàm con sẽ tự lo việc update UI của phần mình
  await Promise.all([
    checkNewNotifications(), // Tải thông báo
    loadHistoryFull(), // Tải lịch sử chấm công
    loadMyRequests(), // Tải đơn của tôi
    loadLocations(), // Tải danh sách địa điểm
    loadContacts(), // Tải danh bạ
  ]);

  // Sau khi tất cả xong, update UI tổng thể nếu cần
  updateCurrentStatusUI();
}

// ==========================================
// 5. TƯƠNG TÁC NGƯỜI DÙNG (Events)
// ==========================================

function updateCurrentStatusUI() {
  var vnDate = new Date().toLocaleDateString("en-GB");
  var isCurrentlyCheckedIn = false;

  if (allHistoryData.length > 0) {
    var todayRec = allHistoryData.find((r) => r.Date === vnDate);
    if (todayRec && todayRec.Time_List && todayRec.Time_List.some((t) => t.out === "...")) {
      isCurrentlyCheckedIn = true;
    }
  }
  toggleHomeState(isCurrentlyCheckedIn ? "working" : "idle");
}

window.switchTab = function (tabName) {
  [
    "modal-notifications",
    "modal-request",
    "modal-profile",
    "modal-contact-detail",
    "view-approvals",
    "modal-search-contact",
  ].forEach((id) => {
    var el = document.getElementById(id);
    if (el) el.classList.add("hidden");
  });

  toggleGlobalNav(true);

  ["home", "requests", "contacts", "profile"].forEach((t) => {
    var el = document.getElementById("tab-" + t);
    if (el) el.classList.add("hidden");
  });

  var target = document.getElementById("tab-" + tabName);
  if (target) target.classList.remove("hidden");

  var navItems = document.querySelectorAll(".nav-item");
  var idxMap = { home: 0, requests: 1, contacts: 2, profile: 3 };

  navItems.forEach((item, index) => {
    var isActive = index === idxMap[tabName];
    item.classList.toggle("active", isActive);

    var icon = item.querySelector("i");
    if (icon) {
      icon.className = isActive
        ? icon.className.replace("text-slate-400", "text-emerald-600")
        : icon.className.replace("text-emerald-600", "text-slate-400");
    }

    var ind = item.querySelector(".indicator");
    if (ind) ind.classList.toggle("opacity-0", !isActive);
  });

  if (tabName === "contacts" && (!cachedContacts || cachedContacts.length === 0)) {
    loadContacts();
  } else if (tabName === "requests") {
    switchActivityMode("history");
  }
};

// --- LOCATION & CONTACTS ---
async function loadLocations() {
  const data = await callBackend("getLocations");
  cachedLocations = data || [];
  renderLocationList(); // Render nếu profile modal đang mở
}

async function loadContacts() {
  var list = document.getElementById("contacts-list");
  if (list && !document.getElementById("tab-contacts").classList.contains("hidden")) {
    list.innerHTML = SKELETON_CONTACT;
  }

  const data = await callBackend("getContacts", [currentUser.Role, currentUser.Center_ID]);
  cachedContacts = data;
  renderContactList(data);
}

// --- PROFILE UPDATE ---
window.submitProfileUpdate = async function () {
  var phone = document.getElementById("edit-phone").value;
  var p = {
    employeeId: currentUser.Employee_ID,
    phone: phone,
    centerId: currentProfileLocation,
    avatarBase64: tempAvatarBase64,
  };

  showLoading(true);
  const res = await callBackend("updateEmployeeProfile", [p]);
  showLoading(false);

  if (res.success) {
    showToast("success", "Cập nhật thành công!");
    closeProfileModal();

    currentUser.Phone = p.phone;
    currentUser.Center_ID = p.centerId;
    var loc = cachedLocations.find((l) => l.id == p.centerId);
    if (loc) currentUser.Location_Name = loc.name;

    if (res.newAvatar) currentUser.Avatar = res.newAvatar;
    localStorage.setItem("army_user_v2026", JSON.stringify(currentUser));
    renderUserInfo();
  } else {
    showDialog("error", "Lỗi", res.message);
  }
};

// ==========================================
// 6. CAMERA & CHECK-IN
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
    .catch(function () {
      showToast("error", "Không thể truy cập Camera!");
    });
};

window.closeCamera = function () {
  if (videoStream) videoStream.getTracks().forEach((t) => t.stop());
  document.getElementById("modal-camera").classList.add("hidden");
  toggleGlobalNav(true);
};

window.takePicture = async function () {
  var v = document.getElementById("video");
  var c = document.createElement("canvas");
  c.width = v.videoWidth;
  c.height = v.videoHeight;
  c.getContext("2d").drawImage(v, 0, 0);
  var b64 = c.toDataURL("image/jpeg", 0.6);
  closeCamera();
  showLoading(true);

  navigator.geolocation.getCurrentPosition(
    async function (p) {
      const r = await callBackend("doCheckIn", [
        {
          employeeId: currentUser.Employee_ID,
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          deviceId: myDeviceId,
          imageBase64: b64,
        },
      ]);
      showLoading(false);
      if (r.success) {
        showToast("success", r.message);
        loadHistoryFull(); // Reload history để update status
      } else {
        showDialog("error", "Thất bại", r.message);
      }
    },
    function () {
      showLoading(false);
      showDialog("error", "Lỗi định vị", "Vui lòng bật GPS!");
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
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

// -- Notifications Logic --
// [ĐÃ SỬA] Dùng callBackend
window.checkNewNotifications = async function () {
  if (!currentUser) return;
  const res = await callBackend("getMobileNotifications", [currentUser.Employee_ID]);

  // Nếu thành công thì update cache và badge
  if (res.success) {
    // Lưu ý: res.data bây giờ có cấu trúc { approvals: [], myRequests: [] }
    cachedNotifications = res.data;
    renderNotificationsBadge(res.data);
  }
};

function getReadList() {
  var s = localStorage.getItem("army_read_ids");
  return s ? JSON.parse(s) : [];
}

function checkIsUnread(reqId, status) {
  if (status === "Pending") return false;
  var readList = getReadList();
  return !readList.includes(reqId);
}

function markNotificationsAsRead(data) {
  var readList = getReadList();
  var hasChange = false;

  if (data && data.myRequests) {
    data.myRequests.forEach(function (r) {
      if (r.Status !== "Pending" && !readList.includes(r.Request_ID)) {
        readList.push(r.Request_ID);
        hasChange = true;
      }
    });
  }

  if (hasChange) {
    localStorage.setItem("army_read_ids", JSON.stringify(readList));
    // Gọi lại để cập nhật badge
    renderNotificationsBadge(data);
  }
}

window.openNotifications = async function (mode) {
  var modal = document.getElementById("modal-notifications");
  var content = document.getElementById("noti-content-area");
  var titleEl = document.getElementById("modal-noti-title");
  if (!modal || !content) return;

  titleEl.innerText = mode === "approve" ? "Duyệt đơn từ" : "Thông báo";

  document.querySelectorAll('[id^="noti-dot"], [id^="profile-noti-dot"]').forEach((d) => d.classList.add("hidden"));
  modal.classList.remove("hidden");

  // Hiển thị loading trước
  content.innerHTML =
    '<div class="text-center py-20 opacity-50"><i class="fa-solid fa-circle-notch fa-spin text-emerald-500 text-2xl"></i></div>';

  // Gọi trực tiếp để lấy dữ liệu mới nhất
  const res = await callBackend("getMobileNotifications", [currentUser.Employee_ID]);
  if (res.success) {
    cachedNotifications = res.data;
    renderNotificationContent(res.data, mode);
    markNotificationsAsRead(res.data);
  } else {
    content.innerHTML = `<p class="text-center text-red-500 mt-10">${res.message}</p>`;
  }
};

window.closeNotifications = function () {
  var modal = document.getElementById("modal-notifications");
  if (modal) modal.classList.add("hidden");
};

// -- Requests Logic --
// [ĐÃ SỬA] Dùng callBackend
async function loadMyRequests(forceReload = false) {
  var container = document.getElementById("request-list-container");
  if (!container) return;

  if (cachedMyRequests && !forceReload) {
    renderMyRequestsHTML(container, cachedMyRequests);
    return;
  }

  container.innerHTML = SKELETON_REQUEST;
  const res = await callBackend("getMyRequests", [currentUser.Employee_ID]);

  let data = [];
  if (Array.isArray(res)) data = res;
  else if (res && res.success && Array.isArray(res.data)) data = res.data;
  else if (Array.isArray(res.data)) data = res.data;

  cachedMyRequests = data;
  renderMyRequestsHTML(container, data);
}

// ... (Các hàm helper khác như openRequestModal, toVNDate, submitRequest... giữ nguyên logic UI)
// Chỉ cần đảm bảo submitRequest dùng callBackend

window.openRequestModal = function (type, targetDate) {
  var modal = document.getElementById("modal-request");
  if (!modal) return;
  toggleGlobalNav(false);
  document.getElementById("req-reason").value = "";
  document.getElementById("req-date-start").value = "";
  document.getElementById("req-date-end").value = "";

  type = type || "Nghỉ phép";
  selectReqType(type);

  if (type === "Giải trình" && targetDate) {
    var dateVal = convertDateToISO(targetDate);
    if (dateVal) {
      document.getElementById("req-date-start").value = dateVal;
      document.getElementById("req-date-end").value = dateVal;
    }
  } else {
    var today = new Date().toISOString().split("T")[0];
    document.getElementById("req-date-start").value = today;
    document.getElementById("req-date-end").value = today;
  }
  modal.classList.remove("hidden");
};

window.closeRequestModal = function () {
  document.getElementById("modal-request").classList.add("hidden");
  toggleGlobalNav(true);
};

window.toVNDate = function (d) {
  if (!d) return "";
  if (d.includes("/") && d.split("/")[0].length == 2) return d;
  if (d.includes("-")) {
    var p = d.split("-");
    return p[2] + "/" + p[1] + "/" + p[0];
  }
  return d;
};

window.submitRequest = async function () {
  var valFrom = document.getElementById("req-date-start").value;
  var valTo = document.getElementById("req-date-end").value;
  var finalFrom = toVNDate(valFrom);
  var finalTo = toVNDate(valTo);
  var reason = document.getElementById("req-reason").value;

  var typeVal = currentReqType;
  if (typeVal === "Giải trình" || typeVal === "Explanation") typeVal = "Giải trình công";

  if (!reason) return showToast("error", "Vui lòng nhập nội dung chi tiết!");

  var payload = {
    employeeId: currentUser.Employee_ID,
    name: currentUser.Name,
    type: typeVal,
    fromDate: finalFrom,
    toDate: finalTo,
    reason: reason,
  };

  showLoading(true);
  const r = await callBackend("submitRequest", [payload]);
  showLoading(false);

  showToast(r.success ? "success" : "error", r.message);
  if (r.success) {
    closeRequestModal();
    loadMyRequests(true); // Force reload
    if (typeVal === "Giải trình công") loadHistoryFull();
  }
};

window.selectReqType = function (type) {
  currentReqType = type;
  document.getElementById("req-type-label").innerText = type === "Giải trình" ? "Giải trình công" : type;
  toggleReqDropdown();
};

window.toggleReqDropdown = function () {
  const menu = document.getElementById("req-type-menu");
  const arrow = document.getElementById("req-type-arrow");
  const container = document.getElementById("req-type-container");
  const isOpening = menu.classList.contains("hidden");

  menu.classList.toggle("hidden");
  container.classList.toggle("ring-2", isOpening);
  container.classList.toggle("ring-emerald-100", isOpening);
  container.classList.toggle("bg-white", isOpening);
  if (arrow) arrow.style.transform = isOpening ? "rotate(180deg)" : "rotate(0deg)";

  if (isOpening) renderReqTypeItems();
};

function renderReqTypeItems() {
  const items = document.querySelectorAll(".req-item");
  items.forEach((item) => {
    const val = item.getAttribute("data-val");
    const isSelected = val === currentReqType;
    item.className = `req-item px-4 py-3.5 rounded-xl text-sm font-bold flex justify-between items-center cursor-pointer transition-all mb-1 ${isSelected ? "bg-emerald-50 text-emerald-700" : "hover:bg-slate-50 text-slate-700"}`;
    const check = item.querySelector(".check-icon-req");
    if (check) check.style.opacity = isSelected ? "1" : "0";
  });
}

function convertDateToISO(dateStr) {
  if (!dateStr) return "";
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) return dateStr;
  var parts = dateStr.split("/");
  if (parts.length === 3) return parts[2] + "-" + parts[1] + "-" + parts[0];
  return "";
}

window.autoFillEndDate = function () {
  var start = document.getElementById("req-date-start").value;
  var endInput = document.getElementById("req-date-end");
  if (!endInput.value || endInput.value < start) endInput.value = start;
};

// -- Approval Logic --
window.openRejectModal = function (reqId) {
  currentRejectId = reqId;
  document.getElementById("input-reject-reason").value = "";
  document.getElementById("modal-reject-reason").classList.remove("hidden");
};

window.closeRejectModal = function () {
  currentRejectId = null;
  document.getElementById("modal-reject-reason").classList.add("hidden");
};

window.handleConfirmReject = function () {
  var reason = document.getElementById("input-reject-reason").value.trim();
  if (!reason) {
    showToast("error", "Vui lòng nhập lý do từ chối!");
    return;
  }
  if (currentRejectId) {
    var idToProcess = currentRejectId;
    closeRejectModal();
    processRequestMobile(idToProcess, "Rejected", reason);
  }
};

window.processRequestMobile = async function (reqId, status, rejectReason) {
  showLoading(true);
  var note = status === "Approved" ? "Đã duyệt" : rejectReason || "";

  const res = await callBackend("processRequestAdmin", [
    reqId,
    status,
    note,
    currentUser.Name,
    currentUser.Employee_ID,
  ]);

  showLoading(false);
  showToast(res.success ? "success" : "error", res.message);
  if (res.success) {
    // Reload lại dữ liệu để cập nhật danh sách
    loadDashboardData();
    closeNotifications();
  }
};

// -- Profile Logic --
window.openProfileModal = function () {
  var modal = document.getElementById("modal-profile");
  modal.classList.remove("hidden");
  toggleGlobalNav(false);
  // Re-render info into modal fields
  renderUserInfo();
  tempAvatarBase64 = null;
};

window.closeProfileModal = function () {
  document.getElementById("modal-profile").classList.add("hidden");
  toggleGlobalNav(true);
};

window.previewAvatarInModal = function (input) {
  if (input.files && input.files[0]) {
    var reader = new FileReader();
    reader.onload = function (e) {
      document.getElementById("edit-avatar-preview").src = e.target.result;
      tempAvatarBase64 = e.target.result;
    };
    reader.readAsDataURL(input.files[0]);
  }
};

// --- Lịch sử ---
async function loadHistoryFull() {
  if (!currentUser) return;

  var d = new Date();
  var currentMonth = d.getMonth() + 1;
  var currentYear = d.getFullYear();
  var timeLabel = "Tháng " + currentMonth + "/" + currentYear;

  setText("current-month-badge", timeLabel);
  setText("hist-month-badge", timeLabel);
  setText("home-stat-month-label", timeLabel);
  setText("stat-year-label", "Năm " + currentYear);

  const res = await callBackend("getHistory", [currentUser.Employee_ID]);

  if (res) {
    allHistoryData = res.history || [];
    var stats = res.summary || { workDays: 0, lateMins: 0, errorCount: 0, remainingLeave: 12, leaveDays: 0 };

    currentHistoryPage = 0;
    renderHistoryStats(stats);

    var vnDate = ("0" + d.getDate()).slice(-2) + "/" + ("0" + (d.getMonth() + 1)).slice(-2) + "/" + d.getFullYear();
    var isCurrentlyCheckedIn = false;
    if (allHistoryData.length > 0) {
      var todayRec = allHistoryData.find((r) => r.Date === vnDate);
      if (todayRec && todayRec.Time_List && todayRec.Time_List.some((t) => t.out === "...")) {
        isCurrentlyCheckedIn = true;
      }
    }
    toggleHomeState(isCurrentlyCheckedIn ? "working" : "idle");

    if (!document.getElementById("view-act-history").classList.contains("hidden")) {
      renderActivityHistory();
    }
  }
}

window.renderActivityHistory = function () {
  var container = document.getElementById("activity-history-list");
  if (!container) return;

  if (!allHistoryData || allHistoryData.length === 0) {
    container.innerHTML =
      '<div class="text-center py-10 opacity-50"><i class="fa-solid fa-circle-notch fa-spin text-emerald-500"></i></div>';
    return;
  }

  var startIndex = currentHistoryPage * HISTORY_PAGE_SIZE;
  var endIndex = startIndex + HISTORY_PAGE_SIZE;
  var displayData = allHistoryData.slice(startIndex, endIndex);

  // Pagination Controls
  var maxPage = Math.ceil(allHistoryData.length / HISTORY_PAGE_SIZE) - 1;
  var btnPrev = document.getElementById("btn-hist-next");
  var btnNext = document.getElementById("btn-hist-prev");
  var label = document.getElementById("hist-pagination-label");

  if (btnPrev) btnPrev.style.opacity = currentHistoryPage === 0 ? "0.3" : "1";
  if (btnNext) btnNext.style.opacity = currentHistoryPage >= maxPage ? "0.3" : "1";
  if (displayData.length > 0 && label) {
    label.innerText =
      displayData[displayData.length - 1].Date.substring(0, 5) + " - " + displayData[0].Date.substring(0, 5);
  }

  var html = "";
  var today = new Date();
  today.setHours(0, 0, 0, 0);

  displayData.forEach(function (item) {
    var dateParts = (item.Date || "").split("/");
    var recordDate = new Date(parseInt(dateParts[2]), parseInt(dateParts[1]) - 1, parseInt(dateParts[0]));
    recordDate.setHours(0, 0, 0, 0);

    var dayName = ["CN", "TH 2", "TH 3", "TH 4", "TH 5", "TH 6", "TH 7"][recordDate.getDay()];
    var totalHours = parseFloat(item.Total_Work_Hours);

    var timeDetailsHtml =
      item.Time_List && item.Time_List.length > 0
        ? item.Time_List.map(
            (t) =>
              `<div class="text-[10px] font-bold text-slate-500 mt-0.5 flex items-center gap-1"><i class="fa-regular fa-clock text-slate-300"></i> ${t.in} - ${t.out}</div>`
          ).join("")
        : `<div class="text-[10px] text-slate-400 italic">Chưa có dữ liệu</div>`;

    var isLate = item.Late_Minutes_Total > 0;
    var hasInvalid = item.Status_List && item.Status_List.some((s) => s.includes("Invalid"));
    var isPast = recordDate < today;
    var isForgotOut = isPast && item.Time_List && item.Time_List.some((t) => t.out === "...");
    var isLowHours = isPast && totalHours > 0 && totalHours < 7;

    var needAction = isPast && (isLate || hasInvalid || isForgotOut || isLowHours);
    var isExplanation = item.Has_Explained === true;
    var rightStatus = "";

    if (needAction) {
      var errorLabel = isForgotOut
        ? "Quên ra về"
        : hasInvalid
          ? "Sai vị trí"
          : isLate
            ? "Trễ " + item.Late_Minutes_Total + "p"
            : "Thiếu giờ làm";

      var labelHtml = `
          <span class="rounded-full px-3 py-0.5 text-[9px] font-bold bg-red-50 text-red-500 border border-red-100 mb-1.5 shadow-sm inline-block">
              ${errorLabel}
          </span>`;

      var pillStyle =
        "h-8 px-4 rounded-full text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm";

      if (isExplanation) {
        rightStatus = `
          <div class="flex flex-col items-end">
              ${labelHtml}
              <div class="${pillStyle} bg-blue-50 text-blue-600 border border-blue-100 cursor-default">
                  <i class="fa-solid fa-check"></i> Đã giải trình
              </div>
          </div>`;
      } else {
        rightStatus = `
          <div class="flex flex-col items-end">
              ${labelHtml}
              <button onclick="openExplainModal('${item.Date}', '${errorLabel}')" 
                class="${pillStyle} bg-white text-orange-600 border border-orange-200 hover:bg-orange-50">
                <i class="fa-solid fa-pen-to-square"></i> Giải trình
              </button>
          </div>`;
      }
    } else {
      rightStatus =
        totalHours > 0
          ? `<div class="flex flex-col items-end justify-center h-full"><div class="w-9 h-9 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center border border-emerald-100 shadow-sm"><i class="fa-solid fa-check"></i></div></div>`
          : `<div class="w-9 h-9 rounded-full bg-slate-50 text-slate-300 flex items-center justify-center border border-slate-100"><i class="fa-solid fa-minus"></i></div>`;
    }

    html += `
      <div class="bg-white p-4 rounded-[24px] shadow-sm border border-slate-100 mb-3 flex items-center justify-between animate-slide-up">
          <div class="flex items-center gap-4">
              <div class="flex flex-col items-center justify-center w-10 shrink-0">
                  <span class="text-[9px] font-bold text-slate-400 uppercase">${dayName}</span>
                  <span class="text-xl font-black text-slate-800 leading-none mt-0.5">${dateParts[0]}</span>
              </div>
              <div class="w-px h-10 bg-slate-100"></div>
              <div>
                  <div class="flex items-center gap-2 mb-1">
                      <div class="w-2 h-2 rounded-full ${totalHours > 0 ? (isLowHours ? "bg-orange-500" : "bg-emerald-500") : needAction ? "bg-red-500" : "bg-slate-300"}"></div>
                      <span class="text-sm font-bold text-slate-700">${totalHours > 0 ? totalHours.toFixed(2) + " giờ công" : needAction ? "Cần xử lý" : "--"}</span>
                  </div>
                  <div class="flex flex-col">${timeDetailsHtml}</div>
              </div>
          </div>
          <div class="shrink-0 ml-2">${rightStatus}</div>
      </div>`;
  });
  container.innerHTML = html;
};

window.openExplainModal = function (dateStr, errorContext) {
  openRequestModal("Giải trình", dateStr);
  var reasonInput = document.getElementById("req-reason");
  if (reasonInput && errorContext) {
    reasonInput.value = "[" + errorContext + "] ";
    reasonInput.focus();
  }
};

window.changeHistoryPage = function (direction) {
  if (!allHistoryData || allHistoryData.length === 0) return;
  var maxPage = Math.ceil(allHistoryData.length / HISTORY_PAGE_SIZE) - 1;
  var newPage = currentHistoryPage - direction;
  if (newPage < 0) newPage = 0;
  if (newPage > maxPage) newPage = maxPage;
  if (newPage !== currentHistoryPage) {
    currentHistoryPage = newPage;
    renderActivityHistory();
  }
};
// --- LOGIC BATCH ACTION ---
// 1. Hàm chọn/bỏ chọn 1 đơn
window.toggleSelectRequest = function (reqId) {
  const index = selectedRequests.indexOf(reqId);
  if (index > -1) {
    selectedRequests.splice(index, 1);
  } else {
    selectedRequests.push(reqId);
  }
  updateBatchActions();
};

// 2. Hàm chọn tất cả
window.toggleSelectAll = function (totalCount) {
  // Logic đơn giản: Nếu chưa chọn hết thì chọn hết, nếu chọn hết rồi thì bỏ chọn
  if (!cachedNotifications || !cachedNotifications.approvals) return;

  const allIds = cachedNotifications.approvals.map((r) => r.Request_ID);
  const checkboxes = document.querySelectorAll('input[type="checkbox"][id^="chk-req-"]');

  if (selectedRequests.length < allIds.length) {
    selectedRequests = [...allIds];
    checkboxes.forEach((cb) => (cb.checked = true));
  } else {
    selectedRequests = [];
    checkboxes.forEach((cb) => (cb.checked = false));
  }
  updateBatchActions();
};

// 3. Cập nhật giao diện thanh công cụ
function updateBatchActions() {
  const bar = document.getElementById("batch-action-bar");
  const countSpan = document.getElementById("batch-count");

  // Nếu chưa có thanh bar thì tạo nó (Chèn vào index.html động)
  if (!bar) {
    createBatchActionBar();
    return updateBatchActions(); // Gọi lại sau khi tạo
  }

  if (selectedRequests.length > 0) {
    bar.classList.remove("translate-y-full", "opacity-0");
    countSpan.innerText = selectedRequests.length;
  } else {
    bar.classList.add("translate-y-full", "opacity-0");
  }
}

// 4. Tạo thanh công cụ động (Inject HTML)
function createBatchActionBar() {
  const div = document.createElement("div");
  div.id = "batch-action-bar";
  div.className =
    "fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-md bg-slate-800 text-white p-4 rounded-2xl shadow-2xl z-[300] flex items-center justify-between transition-all duration-300 transform translate-y-full opacity-0";
  div.innerHTML = `
          <div class="font-bold text-sm">Đã chọn <span id="batch-count" class="text-emerald-400">0</span> đơn</div>
          <div class="flex gap-3">
              <button onclick="submitBatchAction('Rejected')" class="px-4 py-2 bg-red-500/20 text-red-400 font-bold text-xs rounded-xl border border-red-500/50">Từ chối</button>
              <button onclick="submitBatchAction('Approved')" class="px-4 py-2 bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/30">Duyệt ngay</button>
          </div>
      `;
  document.body.appendChild(div);
}

// 5. Gửi lệnh về Server
window.submitBatchAction = function (status) {
  if (selectedRequests.length === 0) return;

  const actionName = status === "Approved" ? "Duyệt" : "Từ chối";
  showDialog("confirm", "Xác nhận", `Bạn muốn ${actionName} ${selectedRequests.length} đơn đã chọn?`, () => {
    showLoading(true);

    // Ẩn thanh công cụ ngay
    selectedRequests = [];
    updateBatchActions();
    closeNotifications(); // Đóng popup

    google.script.run
      .withSuccessHandler((res) => {
        showLoading(false);
        showToast(res.success ? "success" : "error", res.message);
        if (res.success) {
          loadDashboardData(); // Tải lại dữ liệu mới
        }
      })
      .withFailureHandler((err) => {
        showLoading(false);
        showToast("error", "Lỗi: " + err);
      })
      .processBatchRequests({
        requestIds: selectedRequests, // Gửi mảng ID cũ (lúc bấm nút) - cần fix logic biến toàn cục
        status: status,
        managerName: currentUser.Name,
      });
  });
};

// FIX BUG NHỎ Ở HÀM submitBatchAction:
// Do selectedRequests bị reset ngay lập tức nên phải copy lại trước khi gửi
window.submitBatchAction = function (status) {
  const idsToSend = [...selectedRequests]; // Copy lại mảng
  if (idsToSend.length === 0) return;

  const actionName = status === "Approved" ? "Duyệt" : "Từ chối";
  showDialog("confirm", "Xác nhận", `Bạn muốn ${actionName} ${idsToSend.length} đơn đã chọn?`, () => {
    showLoading(true);
    // Đóng UI
    document.getElementById("batch-action-bar").classList.add("translate-y-full");
    closeNotifications();

    google.script.run
      .withSuccessHandler((res) => {
        showLoading(false);
        showToast(res.success ? "success" : "error", res.message);
        if (res.success) {
          selectedRequests = []; // Clear hẳn
          loadDashboardData();
        }
      })
      .processBatchRequests({
        requestIds: idsToSend,
        status: status,
        managerName: currentUser.Name,
      });
  });
};
