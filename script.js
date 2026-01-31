
const API_URL = "https://script.google.com/macros/s/AKfycbzJcBcHFJ9ZL1esLN9xf0bsmcLhJxK87NTCBIS5PwzjS1QYhFY2E-lauKGjuX9PYouIqw/exec";

// ==========================================
// 1. CẤU HÌNH & BIẾN TOÀN CỤC
// ==========================================
var currentUser = null;
var videoStream = null;
var allHistoryData = [];
var cachedContacts = [];
var cachedLocations = [];
var cachedNotifications = null;
var cachedMyRequests = null;

// Cấu hình phân trang & thiết bị
var myDeviceId = getDeviceId();
var currentHistoryPage = 0;
const HISTORY_PAGE_SIZE = 7;

// Biến tạm cho Form
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

// --- HÀM GỌI BACKEND (THAY THẾ GOOGLE.SCRIPT.RUN) ---
async function callBackend(functionName, params = []) {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: functionName, params: params }) 
    });
    
    if (!response.ok) throw new Error("HTTP Error: " + response.status);
    return await response.json();
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

// ==========================================
// 2. KHỞI TẠO & ĐĂNG NHẬP
// ==========================================
document.addEventListener("DOMContentLoaded", function () {
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
  if(btnReject) {
      btnReject.onclick = handleConfirmReject;
  }

  // Xử lý phím Enter đăng nhập
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

// [ASYNC] Đăng nhập
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

// ==========================================
// 3. LOGIC LOAD DATA (SUPER API)
// ==========================================

function showMainApp() {
  document.getElementById("view-main").classList.remove("hidden");
  toggleGlobalNav(true);
  renderUserInfo();
  switchTab("home");
  toggleHomeState("loading");

  // GỌI 1 LẦN DUY NHẤT ĐỂ LẤY TOÀN BỘ DỮ LIỆU
  loadDashboardData(); 
}

// [ASYNC] Hàm tổng quản: Load toàn bộ dữ liệu
async function loadDashboardData() {
  if (!currentUser) return;

  const res = await callBackend("getDashboardData", [currentUser.Employee_ID]);

  if (res.success) {
      const d = res.data;

      // 1. CẬP NHẬT PROFILE
      if (d.userProfile) {
          currentUser = { ...currentUser, ...d.userProfile };
          localStorage.setItem("army_user_v2026", JSON.stringify(currentUser));
          renderUserInfo(); 
      }

      // 2. XỬ LÝ LỊCH SỬ & THỐNG KÊ
      if (d.history) {
          allHistoryData = d.history.history || [];
          renderHistoryStats(d.history.summary);
          
          if (!document.getElementById("view-act-history").classList.contains("hidden")) {
             renderActivityHistory();
          }
      }

      // 3. XỬ LÝ THÔNG BÁO
      if (d.notifications) {
          cachedNotifications = d.notifications;
          renderNotificationsBadge(d.notifications);
          
          if (!document.getElementById("modal-notifications").classList.contains("hidden")) {
              var title = document.getElementById("modal-noti-title").innerText;
              var mode = (title === "Duyệt đơn từ") ? "approve" : "all";
              renderNotificationContent(cachedNotifications, mode);
          }
      }
      
      // 4. XỬ LÝ DANH SÁCH ĐƠN CỦA TÔI
      if (d.myRequests) {
          cachedMyRequests = d.myRequests;
          renderMyRequestsList(d.myRequests);
      }
      
      // 5. CACHE ĐỊA ĐIỂM
      cachedLocations = d.locations || [];

      // 6. CACHE & RENDER DANH BẠ
      if (d.contacts) {
          cachedContacts = d.contacts;
          renderContactList(cachedContacts);
      }

      // 7. CẬP NHẬT TRẠNG THÁI CHECK-IN UI
      updateCurrentStatusUI(); 
      
  } else {
      // Nếu API getDashboardData chưa có trên backend, có thể fallback về load lẻ (tùy chọn)
      // Nhưng theo yêu cầu chuyển code, ta hiển thị lỗi.
      showToast("error", "Lỗi dữ liệu: " + res.message);
      toggleHomeState("idle");
  }
}

// --- CÁC HÀM HELPER RENDER UI ---

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
    var count = notiData.approvals ? notiData.approvals.length : 0;
    
    var notiDot = document.getElementById("noti-dot");
    var profileDot = document.getElementById("profile-noti-dot");
    var homePendingEl = document.getElementById("home-stat-pending");

    if (homePendingEl) homePendingEl.innerText = count;

    if (count > 0) {
      if (notiDot) notiDot.classList.remove("hidden");
      if (profileDot) profileDot.classList.remove("hidden");
    } else {
      if (notiDot) notiDot.classList.add("hidden");
      if (profileDot) profileDot.classList.add("hidden");
    }
}

function renderMyRequestsList(requests) {
    var container = document.getElementById("request-list-container");
    if (!container) return;

    if (!requests || requests.length === 0) {
        container.innerHTML = `<div class="text-center py-12 opacity-60"><div class="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm border border-slate-100"><i class="fa-solid fa-clipboard-check text-2xl text-slate-300"></i></div><p class="text-xs font-bold text-slate-400">Chưa có đề xuất nào</p></div>`;
        return;
    }

    var html = "";
    requests.forEach(function (req) {
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

function updateCurrentStatusUI() {
  var vnDate = new Date().toLocaleDateString('en-GB'); // dd/mm/yyyy
  var isCurrentlyCheckedIn = false;
  
  if (allHistoryData.length > 0) {
      var todayRec = allHistoryData.find(r => r.Date === vnDate);
      if (todayRec && todayRec.Time_List && todayRec.Time_List.some(t => t.out === "...")) {
          isCurrentlyCheckedIn = true;
      }
  }
  toggleHomeState(isCurrentlyCheckedIn ? "working" : "idle");
}

// ==========================================
// 4. CAMERA & CHECK-IN
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
  if (videoStream)
    videoStream.getTracks().forEach(t => t.stop());
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
  
  navigator.geolocation.getCurrentPosition(
    async function (p) {
      const r = await callBackend("doCheckIn", [{
          employeeId: currentUser.Employee_ID,
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          deviceId: myDeviceId,
          imageBase64: b64,
      }]);
      
      showLoading(false);
      if (r.success) {
        showToast("success", r.message);
        loadDashboardData(); 
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
    if (r.success) loadDashboardData();
  });
};

// ==========================================
// 5. THÔNG BÁO & DUYỆT ĐƠN (MOBILE)
// ==========================================

window.openNotifications = async function (mode) {
  var modal = document.getElementById("modal-notifications");
  var content = document.getElementById("noti-content-area");
  var titleEl = document.getElementById("modal-noti-title");
  if (!modal || !content) return;

  titleEl.innerText = (mode === "approve") ? "Duyệt đơn từ" : "Thông báo";
  
  // Ẩn chấm đỏ
  document.querySelectorAll('[id^="noti-dot"], [id^="profile-noti-dot"]').forEach(d => d.classList.add("hidden"));
  modal.classList.remove("hidden");

  if (cachedNotifications) {
      renderNotificationContent(cachedNotifications, mode);
  } else {
      content.innerHTML = SKELETON_REQUEST;
      const res = await callBackend("getMobileNotifications", [currentUser.Employee_ID]);
      if (res.success) {
          cachedNotifications = res.data;
          renderNotificationContent(res.data, mode);
      } else {
          content.innerHTML = '<div class="text-center py-10 text-slate-400">Lỗi tải dữ liệu</div>';
      }
  }
};

function renderNotificationContent(data, mode) {
    var content = document.getElementById("noti-content-area");
    var hasApprovals = data.approvals && data.approvals.length > 0;
    var hasMyRequests = data.myRequests && data.myRequests.length > 0;

    if (!hasApprovals && !hasMyRequests) {
        content.innerHTML = '<div class="text-center py-24 opacity-50"><i class="fa-regular fa-folder-open text-4xl mb-3 text-slate-300"></i><p class="text-xs text-slate-400 font-bold uppercase">Không có dữ liệu</p></div>';
        return;
    }

    var html = "";

    // 1. Phần Duyệt đơn
    if (hasApprovals) {
        html += `<div class="mb-6"><h3 class="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-3 pl-1 flex items-center gap-2"><i class="fa-solid fa-layer-group"></i> Cần duyệt (${data.approvals.length})</h3><div class="space-y-4">`;
        data.approvals.forEach(function (req) {
          var isLeave = (req.Type || "").toLowerCase().includes("nghỉ");
          var badgeClass = isLeave ? "bg-blue-50 text-blue-600 border-blue-100" : "bg-purple-50 text-purple-600 border-purple-100";
          var avatarHtml = getAvatarHtml(req.Name, req.Avatar, "w-10 h-10", "text-xs");

          html += `
              <div class="bg-white p-5 rounded-[24px] shadow-sm border border-slate-50 animate-slide-up relative overflow-hidden group">
                  <div class="flex justify-between items-start mb-3">
                      <div class="flex items-center gap-3">
                          ${avatarHtml}
                          <div>
                              <h4 class="font-bold text-slate-800 text-sm leading-tight">${req.Name}</h4>
                              <p class="text-[10px] font-bold text-slate-400 mt-0.5">${req.Position || "NV"} • ${req.Center_Name || "CN"}</p>
                          </div>
                      </div>
                      <span class="px-2.5 py-1 rounded-lg text-[10px] font-extrabold border ${badgeClass} uppercase tracking-wide">${req.Type}</span>
                  </div>
                  <div class="bg-slate-50/80 rounded-2xl p-3 mb-4 border border-slate-100">
                       <div class="flex items-center gap-2 text-xs font-bold text-slate-700 mb-1">
                          <i class="fa-regular fa-calendar text-emerald-500"></i> ${req.Dates}
                       </div>
                       <p class="text-xs text-slate-500 italic line-clamp-2 pl-6 border-l-2 border-slate-200">"${req.Reason}"</p>
                  </div>
                  <div class="grid grid-cols-2 gap-3">
                      <button onclick="openRejectModal('${req.Request_ID}')" class="py-2.5 rounded-xl bg-white border border-red-100 text-red-500 text-xs font-bold active:scale-95 transition-all shadow-sm">Từ chối</button>
                      <button onclick="processRequestMobile('${req.Request_ID}', 'Approved')" 
                          class="py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold active:scale-95 transition-all shadow-md">
                          Duyệt đơn
                      </button>
                  </div>
              </div>`;
        });
        html += "</div></div>";
    } else if (mode === "approve") {
        html += '<div class="text-center py-20 opacity-50"><i class="fa-solid fa-check-circle text-4xl mb-3 text-emerald-200"></i><p class="text-xs text-slate-400 font-bold uppercase">Đã duyệt hết các đơn!</p></div>';
    }

    // 2. Phần Đơn của tôi
    if (mode !== "approve" && hasMyRequests) {
        html += '<div><h3 class="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-3 pl-1 flex items-center gap-2"><i class="fa-regular fa-bell"></i> Đơn của tôi</h3><div class="space-y-3">';
        data.myRequests.forEach(function (req) {
          var isAppr = req.Status === "Approved";
          var isRej = req.Status === "Rejected";
          var statusIcon = isAppr ? "fa-check" : isRej ? "fa-xmark" : "fa-hourglass-half";
          var statusColor = isAppr ? "text-emerald-500 bg-emerald-50" : isRej ? "text-red-500 bg-red-50" : "text-orange-500 bg-orange-50";
          var cardBg = isAppr ? "border-emerald-100" : isRej ? "border-red-100" : "border-orange-100";

          html += `
              <div class="bg-white p-4 rounded-3xl shadow-sm border ${cardBg} flex items-center gap-4 animate-slide-up">
                  <div class="w-10 h-10 rounded-2xl ${statusColor} flex items-center justify-center text-lg shadow-sm shrink-0">
                      <i class="fa-solid ${statusIcon}"></i>
                  </div>
                  <div class="flex-1 min-w-0">
                      <div class="flex justify-between items-center">
                           <h4 class="text-sm font-bold text-slate-800">${req.Type}</h4>
                           <span class="text-[9px] font-extrabold px-2 py-0.5 rounded ${statusColor} border border-current opacity-80">${req.Status}</span>
                      </div>
                      <p class="text-[10px] text-slate-400 font-bold mt-0.5">${req.Dates}</p>
                      ${req.Note ? `<p class="text-[10px] text-slate-500 bg-slate-50 px-2 py-1 rounded mt-1.5 italic line-clamp-1"><i class="fa-solid fa-reply mr-1"></i>${req.Note}</p>` : ""}
                  </div>
              </div>`;
        });
        html += "</div></div>";
    }
    content.innerHTML = html;
}

window.closeNotifications = function () {
  var modal = document.getElementById("modal-notifications");
  if (modal) modal.classList.add("hidden");
};

// --- Logic Từ chối ---
window.openRejectModal = function (reqId) {
  currentRejectId = reqId;
  document.getElementById("input-reject-reason").value = "";
  document.getElementById("modal-reject-reason").classList.remove("hidden");
};

window.closeRejectModal = function () {
  currentRejectId = null;
  document.getElementById("modal-reject-reason").classList.add("hidden");
};

function handleConfirmReject() {
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
}

window.processRequestMobile = async function (reqId, status, rejectReason) {
  showLoading(true);
  var note = status === "Approved" ? "Đã duyệt" : rejectReason || "";

  const res = await callBackend("processRequestAdmin", [reqId, status, note, currentUser.Name]);
  
  showLoading(false);
  showToast(res.success ? "success" : "error", res.message);
  if (res.success) {
    loadDashboardData(); 
    closeNotifications();
  }
};

// ==========================================
// 6. TẠO ĐỀ XUẤT & PROFILE
// ==========================================

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

window.toVNDate = function(d) {
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
    loadDashboardData(); 
  }
};

// -- Profile --
window.openProfileModal = function () {
  var modal = document.getElementById("modal-profile");
  modal.classList.remove("hidden");
  toggleGlobalNav(false);

  if (currentUser) {
    var avaUrl = currentUser.Avatar;
    if (avaUrl && avaUrl.length > 5 && !avaUrl.includes("ui-avatars.com")) {
      document.getElementById("edit-avatar-preview").src = avaUrl;
    } else {
      document.getElementById("edit-avatar-preview").src = "https://ui-avatars.com/api/?name=" + encodeURIComponent(currentUser.Name) + "&background=059669&color=fff";
    }

    var phoneInput = document.getElementById("edit-phone");
    var emailInput = document.getElementById("edit-email");
    var deptInput = document.getElementById("edit-dept");
    var locationInput = document.getElementById("profile-location-display");
    
    if (phoneInput) phoneInput.value = currentUser.Phone || "";
    if (emailInput) emailInput.value = currentUser.Email || "";
    if (deptInput) deptInput.value = currentUser.Department || "";

    if (locationInput) {
        var userCenterId = currentUser.Center_ID || "";
        var userCenterName = "Chưa cập nhật";
        if (cachedLocations.length > 0) {
            var foundCenter = cachedLocations.find((l) => l.id == userCenterId);
            if (foundCenter) userCenterName = foundCenter.name;
        }
        locationInput.value = userCenterName;
    }
  }
  
  tempAvatarBase64 = null;
};

window.closeProfileModal = function () {
  document.getElementById("modal-profile").classList.add("hidden");
  toggleGlobalNav(true);
};

window.submitProfileUpdate = async function () {
  var phoneInput = document.getElementById("edit-phone");
  var newPhone = phoneInput ? phoneInput.value.trim() : "";
  if (!tempAvatarBase64 && !newPhone && !currentProfileLocation) {
    showToast("error", "Bạn chưa thay đổi thông tin nào!");
    return;
  }
  var p = { 
      employeeId: currentUser.Employee_ID,
      phone: newPhone
  };
  if (tempAvatarBase64) {
      p.avatarBase64 = tempAvatarBase64;
  }
  if (currentProfileLocation) {
      p.centerId = currentProfileLocation;
  }
  
  showLoading(true);
  const res = await callBackend("updateEmployeeProfile", [p]);
  
  showLoading(false);
  if (res.success) {
      showToast("success", "Cập nhật hồ sơ thành công!");
      closeProfileModal();
      loadDashboardData(); 
  } else {
      showDialog("error", "Lỗi cập nhật", res.message);
  }
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

// --- LOCATION DROPDOWN ---
function loadLocations() {
  loadDashboardData();
}

window.toggleLocationDropdown = function () {
  var menu = document.getElementById("profile-location-menu");
  var arrow = document.getElementById("profile-location-arrow");
  var container = document.getElementById("profile-location-container");
  var isOpening = menu.classList.contains("hidden");

  menu.classList.toggle("hidden");
  container.classList.toggle("ring-2", isOpening);
  container.classList.toggle("ring-emerald-100", isOpening);
  container.classList.toggle("bg-white", isOpening);
  if(arrow) arrow.style.transform = isOpening ? "rotate(180deg)" : "rotate(0deg)";
  
  if (isOpening) {
      if (!cachedLocations || cachedLocations.length === 0) loadLocations();
      else renderLocationList();
  }
};

function renderLocationList() {
  var list = document.getElementById("profile-location-list");
  if (!list) return;
  var html = "";
  cachedLocations.forEach(function (loc) {
    var isSelected = loc.id === currentProfileLocation;
    var textClass = isSelected ? "text-emerald-600" : "text-slate-700";
    var checkClass = isSelected ? "opacity-100" : "opacity-0";
    var bgClass = isSelected ? "bg-emerald-50/50" : "hover:bg-slate-50";
    
    html += `
        <div onclick="selectProfileLocation('${loc.id}', '${loc.name}')" class="px-4 py-3.5 rounded-xl text-sm font-bold flex justify-between items-center cursor-pointer transition-all mb-1 ${bgClass}">
            <span class="${textClass}">${loc.name}</span>
            <i class="fa-solid fa-check text-emerald-500 ${checkClass}"></i>
        </div>`;
  });
  list.innerHTML = html;
}

window.selectProfileLocation = function (id, name) {
  currentProfileLocation = id;
  var label = document.getElementById("profile-location-label");
  if (label) {
    label.innerText = name;
    label.className = "text-sm font-bold text-slate-800";
  }
  var menu = document.getElementById("profile-location-menu");
  if (menu && !menu.classList.contains("hidden")) toggleLocationDropdown();
};

// ==========================================
// 7. CÁC LOGIC KHÁC (REQUESTS, CONTACTS...)
// ==========================================

window.toggleReqDropdown = function () {
  const menu = document.getElementById("req-type-menu");
  const arrow = document.getElementById("req-type-arrow");
  const container = document.getElementById("req-type-container");
  const isOpening = menu.classList.contains("hidden");
  
  menu.classList.toggle("hidden");
  container.classList.toggle("ring-2", isOpening);
  container.classList.toggle("ring-emerald-100", isOpening);
  container.classList.toggle("bg-white", isOpening);
  if(arrow) arrow.style.transform = isOpening ? "rotate(180deg)" : "rotate(0deg)";
  
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

window.selectReqType = function (type) {
  currentReqType = type;
  document.getElementById("req-type-label").innerText = type === "Giải trình" ? "Giải trình công" : type;
  toggleReqDropdown();
};

window.autoFillEndDate = function () {
  var start = document.getElementById("req-date-start").value;
  var endInput = document.getElementById("req-date-end");
  if (!endInput.value || endInput.value < start) endInput.value = start;
};

function convertDateToISO(dateStr) {
  if (!dateStr) return "";
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) return dateStr;
  var parts = dateStr.split("/");
  if (parts.length === 3) return parts[2] + "-" + parts[1] + "-" + parts[0];
  return "";
}

// --- CONTACTS ---
function loadContacts() {
  var list = document.getElementById("contacts-list");
  if (!list) return;
  list.innerHTML = SKELETON_CONTACT;
  loadDashboardData();
}

function renderContactList(data) {
  var list = document.getElementById("contacts-list");
  if (!list) return;
  if (!data || data.length === 0) {
    list.innerHTML = '<div class="text-center text-slate-400 py-10">Không tìm thấy nhân sự.</div>';
    return;
  }
  var html = "";
  data.forEach(function (e, i) {
    var avatarHtml = getAvatarHtml(e.Name, e.Avatar, "w-12 h-12", "text-sm");
    var centerTag = e.Center_Name ? `<span class="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">${e.Center_Name}</span>` : "";
    var phoneBtn = e.Phone ? `<a href="tel:${e.Phone}" class="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 active:scale-90 transition-all"><i class="fa-solid fa-phone"></i></a>` : "";

    html += `
      <div class="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-3 active:scale-[0.98] transition-transform cursor-pointer mb-3" onclick="openContactByIndex(${i})">
          <div class="relative flex-none">${avatarHtml}</div>
          <div class="flex-1 min-w-0">
              <p class="font-bold text-slate-800 truncate text-base">${e.Name}</p>
              <div class="flex flex-wrap items-center gap-2 mt-1">
                  <span class="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">${e.Position}</span>
                  ${centerTag}
              </div>
          </div>
          <div class="flex items-center gap-3 flex-none" onclick="event.stopPropagation()">${phoneBtn}</div>
      </div>`;
  });
  list.innerHTML = html;
}

window.openContactByIndex = function (index) {
  var data = cachedContacts[index];
  if (!data) return;
  document.getElementById("modal-contact-detail").classList.remove("hidden");
  document.getElementById("contact-detail-avatar").src = data.Avatar;
  setText("contact-detail-name", data.Name);
  setText("contact-detail-position", data.Position);
  setText("contact-detail-center", data.Center_Name);
  setText("contact-detail-id", data.Employee_ID);
  setText("contact-detail-email", data.Email);
  setText("contact-detail-phone", data.Phone || "N/A");
  setText("contact-detail-dept", data.Department);

  var callRow = document.getElementById("contact-detail-call");
  if (callRow) {
    if (data.Phone) {
      callRow.href = "tel:" + data.Phone;
      callRow.classList.remove("opacity-50", "pointer-events-none");
    } else {
      callRow.href = "#";
      callRow.classList.add("opacity-50", "pointer-events-none");
    }
  }
};

window.closeContactDetail = function () {
  document.getElementById("modal-contact-detail").classList.add("hidden");
};

window.openContactSearch = function () {
  document.getElementById("modal-search-contact").classList.remove("hidden");
  var input = document.getElementById("popup-search-input");
  input.value = "";
  input.focus();
  document.getElementById("popup-search-results").innerHTML = '<div class="text-center py-10 text-slate-400 text-xs">Nhập từ khóa để tìm kiếm...</div>';
};

window.closeContactSearch = function () {
  document.getElementById("modal-search-contact").classList.add("hidden");
};

window.filterContactsPopup = function () {
  var keyword = document.getElementById("popup-search-input").value.toLowerCase().trim();
  var list = document.getElementById("popup-search-results");
  
  if (keyword === "") {
    list.innerHTML = '<div class="flex flex-col items-center justify-center h-40 opacity-50"><i class="fa-solid fa-magnifying-glass text-4xl text-slate-200 mb-2"></i><p class="text-xs font-bold text-slate-400">Nhập từ khóa để tìm kiếm</p></div>';
    return;
  }

  var filtered = cachedContacts.filter(e => (e.Name || "").toLowerCase().includes(keyword) || (e.Phone || "").includes(keyword));

  if (filtered.length === 0) {
    list.innerHTML = '<div class="text-center text-slate-400 py-10 text-xs font-medium">Không tìm thấy kết quả phù hợp.</div>';
    return;
  }
  
  var html = "";
  filtered.forEach(function (e) {
    var originalIndex = cachedContacts.findIndex(c => c.Employee_ID === e.Employee_ID);
    var avatarHtml = getAvatarHtml(e.Name, e.Avatar, "w-10 h-10", "text-xs");
    var centerTag = e.Center_Name ? `<span class="px-2 py-0.5 rounded-md text-[9px] font-bold bg-emerald-50 text-emerald-700">${e.Center_Name}</span>` : "";
    
    html += `
      <div class="bg-slate-50 hover:bg-emerald-50/50 p-3 rounded-2xl border border-transparent hover:border-emerald-100 flex items-center gap-3 active:scale-[0.98] transition-all cursor-pointer mb-1" onclick="openContactByIndex(${originalIndex})">
        <div class="relative flex-none">${avatarHtml}</div>
        <div class="flex-1 min-w-0">
           <p class="font-bold text-slate-800 truncate text-sm">${e.Name}</p>
           <div class="flex flex-wrap items-center gap-1.5 mt-0.5">
              <span class="px-2 py-0.5 rounded-md text-[9px] font-bold bg-white text-slate-500 border border-slate-100 shadow-sm">${e.Position}</span>
              ${centerTag}
           </div>
        </div>
      </div>`;
  });
  list.innerHTML = html;
};

window.switchActivityMode = function (mode) {
  var btnReq = document.getElementById("btn-tab-requests");
  var btnHist = document.getElementById("btn-tab-history");
  var viewReq = document.getElementById("view-act-requests");
  var viewHist = document.getElementById("view-act-history");

  var activeClass = "bg-emerald-600 text-white shadow-md"; 
  var inactiveClass = "text-slate-500 hover:text-slate-800 bg-transparent shadow-none";
  
  if (mode === "requests") {
    btnReq.className = "px-4 py-1.5 rounded-full text-[10px] font-bold transition-all " + activeClass;
    btnHist.className = "px-3 py-1.5 rounded-full text-[10px] font-bold transition-all " + inactiveClass;
    viewReq.classList.remove("hidden");
    viewHist.classList.add("hidden");
    loadDashboardData(); 
  } else {
    btnHist.className = "px-4 py-1.5 rounded-full text-[10px] font-bold transition-all " + activeClass;
    btnReq.className = "px-3 py-1.5 rounded-full text-[10px] font-bold transition-all " + inactiveClass;
    viewHist.classList.remove("hidden");
    viewReq.classList.add("hidden");
    renderActivityHistory();
  }
};


window.openExplainModal = function(dateStr, errorContext) {
  openRequestModal("Giải trình", dateStr);
  var reasonInput = document.getElementById("req-reason");
  if (reasonInput && errorContext) {
      reasonInput.value = "[" + errorContext + "] "; 
      reasonInput.focus(); 
  }
};

// ==========================================
// 9. RENDER LỊCH SỬ (PILL STYLE)
// ==========================================
window.renderActivityHistory = function () {
  var container = document.getElementById("activity-history-list");
  if (!container) return;

  if (!allHistoryData || allHistoryData.length === 0) {
    container.innerHTML = '<div class="text-center py-10 opacity-50"><i class="fa-solid fa-circle-notch fa-spin text-emerald-500"></i></div>';
    return;
  }

  var startIndex = currentHistoryPage * HISTORY_PAGE_SIZE;
  var endIndex = startIndex + HISTORY_PAGE_SIZE;
  var displayData = allHistoryData.slice(startIndex, endIndex);

  var maxPage = Math.ceil(allHistoryData.length / HISTORY_PAGE_SIZE) - 1;
  var btnPrev = document.getElementById("btn-hist-next");
  var btnNext = document.getElementById("btn-hist-prev");
  var label = document.getElementById("hist-pagination-label");

  if (btnPrev) btnPrev.style.opacity = currentHistoryPage === 0 ? "0.3" : "1";
  if (btnNext) btnNext.style.opacity = currentHistoryPage >= maxPage ? "0.3" : "1";
  if (displayData.length > 0 && label) {
     label.innerText = displayData[displayData.length - 1].Date.substring(0, 5) + " - " + displayData[0].Date.substring(0, 5);
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
    
    var timeDetailsHtml = (item.Time_List && item.Time_List.length > 0) 
      ? item.Time_List.map(t => `<div class="text-[10px] font-bold text-slate-500 mt-0.5 flex items-center gap-1"><i class="fa-regular fa-clock text-slate-300"></i> ${t.in} - ${t.out}</div>`).join('')
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
      var errorLabel = isForgotOut ? "Quên ra về" : hasInvalid ? "Sai vị trí" : isLate ? ("Trễ " + item.Late_Minutes_Total + "p") : "Thiếu giờ làm";
      
      var labelHtml = `
          <span class="rounded-full px-3 py-0.5 text-[9px] font-bold bg-red-50 text-red-500 border border-red-100 mb-1.5 shadow-sm inline-block">
              ${errorLabel}
          </span>`;

      var pillStyle = "h-8 px-4 rounded-full text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm";

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
      rightStatus = (totalHours > 0) 
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

// ==========================================
// 10. UTILS
// ==========================================
function setText(id, t) {
  var e = document.getElementById(id);
  if (e) e.innerText = t;
}

window.showLoading = function (s) {
  document.getElementById("loader").className = s
    ? "fixed inset-0 z-[999] bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center"
    : "hidden";
};

window.showToast = function (type, m) {
  var x = document.getElementById("toast");
  document.getElementById("toast-msg").innerText = m;
  var iconBox = x.querySelector("div");
  
  iconBox.className = "w-8 h-8 rounded-full flex items-center justify-center shadow-sm " + 
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
};

window.showDialog = function (t, tl, m, cb) {
  var d = document.getElementById("custom-dialog");
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
};

function updateClock() {
  var d = new Date();
  var timeStr = d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false });
  var days = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
  var dateStr = days[d.getDay()] + ", Ngày " + d.getDate() + "/" + (d.getMonth() + 1);
  
  setText("clock-display", timeStr);
  setText("date-display", dateStr);
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
  // Hàm tạo avatar (ảnh hoặc chữ cái đầu)
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






