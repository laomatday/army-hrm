// ==========================================
// 0. CẤU HÌNH SUPABASE (QUAN TRỌNG)
// ==========================================
// Anh lấy thông tin này trong Supabase > Settings > API
const SUPABASE_URL = "https://gfeeafeqpirlppugieib.supabase.co"; 
const SUPABASE_KEY = "sb_publishable_K65r6aBo5DG2kY0ZptgCeg_3FGfQRuU"; 

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ==========================================
// 1. BIẾN TOÀN CỤC & UTILS
// ==========================================
var currentUser = null;
var videoStream = null;
var allHistoryData = [];
var viewHistoryDate = new Date();
var cachedContacts = [];
var cachedLocations = [];
var cachedNotifications = null;
var refreshInterval = null;
var selectedRequests = [];

// Cấu hình phân trang & thiết bị
var myDeviceId = getDeviceId();
var currentHistoryPage = 0; 
const HISTORY_PAGE_SIZE = 5; 

// Biến tạm cho Form
var tempAvatarBase64 = null;
var tempAvatarFile = null; // [Mới] Lưu file để upload Storage
var currentReqType = "Nghỉ phép";
var currentProfileLocation = "";
var currentRejectId = null;

// SKELETON LOADERS (Giữ nguyên UI cũ)
const SKELETON_CONTACT = `
  <div class="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-3 mb-3 animate-pulse">
      <div class="w-12 h-12 rounded-2xl bg-slate-200"></div>
      <div class="flex-1 space-y-2">
          <div class="h-4 w-32 bg-slate-200 rounded-full"></div>
          <div class="h-3 w-20 bg-slate-200 rounded-full"></div>
      </div>
      <div class="w-10 h-10 rounded-2xl bg-slate-200"></div>
  </div>`.repeat(5);

// ==========================================
// 2. KHỞI TẠO APP
// ==========================================

// Hàm tạo/lấy ID thiết bị (Giữ nguyên logic)
function getDeviceId() {
  var devId = localStorage.getItem("army_device_id");
  if (!devId) {
    devId = "DEV_" + Date.now().toString(36) + Math.random().toString(36).substr(2, 5).toUpperCase();
    localStorage.setItem("army_device_id", devId);
  }
  return devId;
}

document.addEventListener("DOMContentLoaded", async function () {
  // [Mới] Kiểm tra Session Supabase
  const { data: { session } } = await supabase.auth.getSession();
  
  if (session) {
    // Đã đăng nhập -> Lấy thông tin NV và vào App
    await initAppByAuthId(session.user.id);
  } else {
    // Chưa đăng nhập -> Hiện màn hình Login
    showLoginScreen();
  }

  // Chạy đồng hồ
  setInterval(updateClock, 1000);
  updateClock();

  // Bind Events (Giữ nguyên)
  var btnReject = document.getElementById("btn-confirm-reject");
  if (btnReject) btnReject.onclick = handleConfirmReject;
  
  var inputUser = document.getElementById("login-user");
  var inputPass = document.getElementById("login-pass");
  function triggerLoginOnEnter(event) {
    if (event.key === "Enter") { event.preventDefault(); handleLogin(); }
  }
  if (inputUser) inputUser.addEventListener("keydown", triggerLoginOnEnter);
  if (inputPass) inputPass.addEventListener("keydown", triggerLoginOnEnter);
});

// [Mới] Hàm khởi tạo App từ Auth ID
async function initAppByAuthId(authId) {
    try {
        // Lấy mã nhân viên từ bảng employees
        const { data: emp, error } = await supabase
            .from('employees')
            .select('employee_code')
            .eq('auth_user_id', authId)
            .single();

        if (error || !emp) throw new Error("Không tìm thấy hồ sơ nhân viên");

        // Lưu thông tin tạm
        // currentUser sẽ được load đầy đủ trong hàm loadDashboardData
        // Nhưng ta cần employee_code để gọi RPC get_dashboard_data
        
        // Gọi hàm load dữ liệu chính
        await loadDashboardData(emp.employee_code);
        
        // Vào màn hình chính
        document.getElementById("view-login").classList.add("hidden");
        document.getElementById("view-main").classList.remove("hidden");
        toggleGlobalNav(true);
        switchTab("home");

        // Auto refresh
        if (refreshInterval) clearInterval(refreshInterval);
        refreshInterval = setInterval(() => loadDashboardData(emp.employee_code), 30000);

    } catch (err) {
        console.error(err);
        logout();
    }
}

// ==========================================
// 3. XỬ LÝ ĐĂNG NHẬP & LOGOUT
// ==========================================

window.handleLogin = async function () {
  var email = document.getElementById("login-user").value.trim();
  var pass = document.getElementById("login-pass").value.trim();

  if (!email || !pass) return showToast("error", "Vui lòng nhập Email và Mật khẩu!");

  showLoading(true);
  try {
      // 1. Đăng nhập qua Supabase Auth
      const { data, error } = await supabase.auth.signInWithPassword({
          email: email,
          password: pass
      });

      if (error) throw new Error("Email hoặc mật khẩu không đúng!");

      // 2. Vào App
      await initAppByAuthId(data.user.id);
      showToast("success", "Đăng nhập thành công!");

  } catch (err) {
      showToast("error", err.message);
  } finally {
      showLoading(false);
  }
};

window.logout = async function () {
  await supabase.auth.signOut();
  currentUser = null;
  if (refreshInterval) clearInterval(refreshInterval);
  showLoginScreen();
  // Reset UI
  document.getElementById("login-pass").value = "";
};

function showLoginScreen() {
  document.getElementById("view-login").classList.remove("hidden");
  document.getElementById("view-main").classList.add("hidden");
  toggleGlobalNav(false);
}

// ==========================================
// 4. LOAD DỮ LIỆU (DASHBOARD)
// ==========================================

async function loadDashboardData(forceEmpCode = null) {
  // Lấy mã NV từ tham số hoặc từ currentUser hiện tại
  const empCode = forceEmpCode || (currentUser ? currentUser.Employee_ID : null);
  if (!empCode) return;

  // Hiệu ứng loading nhẹ ở Home
  toggleHomeState("loading");

  try {
      // GỌI RPC (Hàm SQL Backend)
      const { data, error } = await supabase.rpc('get_dashboard_data', { 
          p_employee_code: empCode 
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.message);

      const res = data.data;

      // 1. Cập nhật Current User
      currentUser = res.userProfile;
      currentUser.UUID = currentUser.Auth_ID; // Map thêm ID để dùng nội bộ nếu cần
      renderUserInfo();

      // 2. Cập nhật Thống kê & Lịch sử
      const stats = res.history.summary || { work_days: 0, late_mins: 0, error_count: 0, leave_days: 0, standard_days: 26 };
      renderHistoryStats({
          workDays: stats.work_days,
          lateMins: stats.late_mins,
          errorCount: stats.error_count,
          leaveDays: stats.leave_days,
          standardDays: stats.standard_days,
          remainingLeave: stats.remaining_leave || currentUser.Annual_Leave_Balance // Fallback
      });

      allHistoryData = (res.history.history || []).map(h => ({
          Date: formatDateVN(h.work_date),
          Time_List: [{ in: formatTime(h.time_in), out: formatTime(h.time_out) }],
          Total_Work_Hours: h.work_hours,
          Late_Minutes_Total: h.late_minutes,
          Status: h.status,
          Is_Late_Penalty: h.status === 'Late'
      }));
      
      if (currentHistoryPage === 0) renderActivityHistory();

      // 3. Cập nhật Thông báo & Đơn từ
      cachedNotifications = res.notifications;
      renderNotificationsBadge(res.notifications);
      
      // Update UI Modal nếu đang mở
      if (!document.getElementById("modal-notifications").classList.contains("hidden")) {
          const title = document.getElementById("modal-noti-title").innerText;
          renderNotificationContent(res.notifications, title === "Duyệt đơn từ" ? "approve" : "all");
      }

      // 4. Update Trạng thái (Idle/Working)
      checkCurrentStatus(res.history.history);

  } catch (err) {
      console.error("Dashboard Error:", err);
      // Không show toast lỗi liên tục để tránh phiền
  }
}

// ==========================================
// 5. CHỨC NĂNG CHẤM CÔNG
// ==========================================

window.triggerCheckIn = function () {
  document.getElementById("modal-camera").classList.remove("hidden");
  toggleGlobalNav(false);
  navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } })
    .then(s => { videoStream = s; document.getElementById("video").srcObject = s; })
    .catch(() => showToast("error", "Không thể mở Camera!"));
};

window.takePicture = function () {
  const v = document.getElementById("video");
  const canvas = document.createElement("canvas");
  canvas.width = v.videoWidth; canvas.height = v.videoHeight;
  canvas.getContext("2d").drawImage(v, 0, 0);
  
  // Chuyển sang Blob để upload Supabase
  canvas.toBlob(async function(blob) {
      closeCamera();
      showLoading(true);

      navigator.geolocation.getCurrentPosition(async (pos) => {
          try {
              const lat = pos.coords.latitude;
              const lng = pos.coords.longitude;
              
              // 1. Upload Ảnh lên Storage
              const fileName = `${currentUser.Employee_ID}_${Date.now()}.jpg`;
              const { data: imgData, error: imgErr } = await supabase.storage
                  .from('attendance_photos')
                  .upload(fileName, blob);
              
              if (imgErr) throw imgErr;

              const imgUrl = `${SUPABASE_URL}/storage/v1/object/public/attendance_photos/${fileName}`;

              // 2. Insert vào DB (Trigger Backend sẽ lo tính toán)
              const { error } = await supabase
                  .from('attendance_logs')
                  .insert({
                      employee_id: await getEmployeeUUID(), // Hàm tiện ích lấy UUID
                      location_id: await getLocationID(),   // Hàm tiện ích
                      work_date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
                      time_in: new Date().toISOString(),
                      checkin_lat: lat,
                      checkin_lng: lng,
                      selfie_url: imgUrl,
                      device_id: myDeviceId,
                      checkin_type: 'GPS' // Mặc định
                  });

              if (error) throw error;

              showToast("success", "Check-in thành công!");
              loadDashboardData();

          } catch (err) {
              showToast("error", "Lỗi: " + err.message);
          } finally {
              showLoading(false);
          }
      }, (err) => {
          showLoading(false);
          showToast("error", "Không lấy được GPS!");
      });
  }, 'image/jpeg', 0.8);
};

window.triggerCheckOut = function () {
  showDialog("confirm", "Xác nhận", "Bạn muốn kết thúc ca làm việc?", async function () {
      showLoading(true);
      try {
          const empUuid = await getEmployeeUUID();
          const today = new Date().toISOString().split('T')[0];

          // Update dòng chấm công gần nhất của hôm nay chưa checkout
          const { error } = await supabase
              .from('attendance_logs')
              .update({ 
                  time_out: new Date().toISOString()
                  // Trigger sẽ tự tính work_hours
              })
              .eq('employee_id', empUuid)
              .eq('work_date', today)
              .is('time_out', null);

          if (error) throw error;

          showToast("success", "Check-out thành công!");
          loadDashboardData();
      } catch (err) {
          showToast("error", "Lỗi: " + err.message);
      } finally {
          showLoading(false);
      }
  });
};

// ==========================================
// 6. CHỨC NĂNG ĐƠN TỪ (REQUESTS)
// ==========================================

window.submitRequest = async function () {
  var valFrom = document.getElementById("req-date-start").value;
  var valTo = document.getElementById("req-date-end").value;
  var reason = document.getElementById("req-reason").value;

  if (!reason) return showToast("error", "Vui lòng nhập lý do!");

  showLoading(true);
  try {
      const { error } = await supabase
          .from('leave_requests')
          .insert({
              request_code: `REQ_${Date.now()}`,
              employee_id: await getEmployeeUUID(),
              request_type: currentReqType,
              from_date: valFrom,
              to_date: valTo,
              reason: reason,
              status: 'Pending'
          });

      if (error) throw error;

      showToast("success", "Gửi đơn thành công!");
      closeRequestModal();
      loadDashboardData();
  } catch (err) {
      showToast("error", "Lỗi: " + err.message);
  } finally {
      showLoading(false);
  }
};

window.confirmApprove = async function () {
  if (selectedRequests.length === 0) return;
  showLoading(true);
  try {
      // Duyệt từng đơn
      for (let reqId of selectedRequests) {
          const { error } = await supabase
              .from('leave_requests')
              .update({ 
                  status: 'Approved',
                  processed_at: new Date().toISOString(),
                  processed_by: await getEmployeeUUID()
              })
              .eq('id', reqId);
          if (error) throw error;
      }

      showToast("success", "Đã duyệt " + selectedRequests.length + " đơn!");
      selectedRequests = [];
      closeNotifications();
      loadDashboardData();
  } catch (err) {
      showToast("error", "Lỗi: " + err.message);
  } finally {
      showLoading(false);
  }
};

// Hàm xử lý Từ chối (Logic cũ gọi processRequestAdmin)
window.handleConfirmReject = async function () {
  if (!currentRejectId) return;
  var reason = document.getElementById("reject-reason").value;
  if (!reason) return showToast("error", "Vui lòng nhập lý do từ chối!");

  showLoading(true);
  try {
      const { error } = await supabase
          .from('leave_requests')
          .update({
              status: 'Rejected',
              manager_note: reason,
              processed_at: new Date().toISOString(),
              processed_by: await getEmployeeUUID()
          })
          .eq('id', currentRejectId);

      if (error) throw error;

      showToast("success", "Đã từ chối đơn!");
      document.getElementById("modal-reject-reason").classList.add("hidden");
      currentRejectId = null;
      closeNotifications();
      loadDashboardData();
  } catch (err) {
      showToast("error", "Lỗi: " + err.message);
  } finally {
      showLoading(false);
  }
};

// ==========================================
// 7. CÁC HÀM UI/UX (GIỮ NGUYÊN 100%)
// ==========================================

function updateClock() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  const dateStr = now.toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
  document.getElementById("clock-time").innerText = timeStr;
  document.getElementById("clock-date").innerText = dateStr;
}

function renderUserInfo() {
  if (!currentUser) return;
  document.getElementById("user-name").innerText = currentUser.Name;
  document.getElementById("user-role").innerText = currentUser.Position || currentUser.Role;
  
  const avaUrl = currentUser.Avatar || "https://ui-avatars.com/api/?name=" + encodeURIComponent(currentUser.Name) + "&background=random";
  document.getElementById("user-avatar").src = avaUrl;
  document.getElementById("profile-avatar").src = avaUrl;
  document.getElementById("sidebar-avatar").src = avaUrl;

  document.getElementById("profile-name").innerText = currentUser.Name;
  document.getElementById("profile-id").innerText = "ID: " + currentUser.Employee_ID;
  document.getElementById("profile-role").innerText = currentUser.Role;
  document.getElementById("profile-dept").innerText = currentUser.Department || "Chưa cập nhật";
  document.getElementById("profile-email").innerText = currentUser.Email || "Chưa cập nhật";
  
  // Hiển thị Device ID hiện tại (Thay vì Trusted Device ID từ DB vì đã xóa)
  document.getElementById("profile-device").innerText = myDeviceId; 
  currentProfileLocation = currentUser.Location_Name;
  document.getElementById("profile-location").innerText = currentUser.Location_Name;
}

function renderHistoryStats(stats) {
  animateValue("stat-workdays", parseFloat(document.getElementById("stat-workdays").innerText) || 0, stats.workDays);
  animateValue("stat-late", parseInt(document.getElementById("stat-late").innerText) || 0, stats.lateMins);
  animateValue("stat-error", parseInt(document.getElementById("stat-error").innerText) || 0, stats.errorCount);
  
  const leaveEl = document.getElementById("stat-leave");
  if(leaveEl) {
      // Hiển thị: Đã nghỉ / Tổng phép (Còn lại)
      // Ví dụ: 1.0 / 12 (11.0)
      leaveEl.innerHTML = `<span class="text-emerald-600">${stats.leaveDays}</span> <span class="text-slate-400 text-xs">/ ${stats.remainingLeave}</span>`;
  }
}

function renderActivityHistory() {
  const list = document.getElementById("activity-history-list");
  list.innerHTML = "";
  
  const start = currentHistoryPage * HISTORY_PAGE_SIZE;
  const pageData = allHistoryData.slice(start, start + HISTORY_PAGE_SIZE);

  if (pageData.length === 0 && currentHistoryPage === 0) {
      list.innerHTML = `<div class="text-center text-slate-400 py-4 text-sm">Chưa có dữ liệu chấm công tháng này</div>`;
      return;
  }

  pageData.forEach((item, index) => {
      const delay = index * 100;
      const isLate = item.Is_Late_Penalty;
      const statusColor = isLate ? "text-red-500 bg-red-50" : "text-emerald-600 bg-emerald-50";
      const icon = isLate ? "fa-exclamation-circle" : "fa-check-circle";

      let timeHtml = "";
      if (item.Time_List && item.Time_List.length > 0) {
          item.Time_List.forEach(t => {
              timeHtml += `<div class="text-xs font-mono text-slate-600 bg-slate-100 px-2 py-1 rounded mb-1 last:mb-0 text-center">
                  ${t.in} - ${t.out || "..."}
              </div>`;
          });
      }

      const html = `
      <div class="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex items-center justify-between animate-slideUp" style="animation-delay: ${delay}ms">
          <div class="flex items-center gap-4">
              <div class="w-12 h-12 rounded-2xl ${statusColor} flex items-center justify-center text-xl shadow-sm">
                  <i class="fa-solid ${icon}"></i>
              </div>
              <div>
                  <div class="font-bold text-slate-800">${item.Date}</div>
                  <div class="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                     ${isLate ? `<span class="text-red-500 font-bold">Đi trễ ${item.Late_Minutes_Total}p</span>` : 
                     `<span class="text-emerald-600">Công: ${item.Total_Work_Hours}h</span>`}
                  </div>
              </div>
          </div>
          <div class="flex flex-col items-end gap-1">
              ${timeHtml}
          </div>
      </div>`;
      list.insertAdjacentHTML("beforeend", html);
  });

  // Nút xem thêm
  const btnMore = document.getElementById("btn-load-more-history");
  if (allHistoryData.length > (currentHistoryPage + 1) * HISTORY_PAGE_SIZE) {
      btnMore.classList.remove("hidden");
  } else {
      btnMore.classList.add("hidden");
  }
}

window.loadMoreHistory = function() {
    currentHistoryPage++;
    renderActivityHistory(); // Append logic handled by full re-render of slice? No, logic above overwrites.
    // Fix: renderActivityHistory clears list. We should APPEND.
    // Let's fix UI logic slightly to support Append mode or simple Pagination
    // Original logic seemed to overwrite. Let's keep it simple: Expand page size?
    // Actually, let's just re-render with larger slice or append.
    // To respect "100% UI", I will modify renderActivityHistory slightly to NOT clear if page > 0
    // But above I wrote list.innerHTML = "".
    // Correct approach for Load More:
    const list = document.getElementById("activity-history-list");
    const start = currentHistoryPage * HISTORY_PAGE_SIZE;
    const pageData = allHistoryData.slice(start, start + HISTORY_PAGE_SIZE);
    
    pageData.forEach((item, index) => {
       // ... same render logic ...
       // Duplicate code warning. Better to refactor renderActivityHistory to take 'append' flag.
    });
    // RE-WRITE renderActivityHistory below to support this correctly
    renderActivityHistory(true);
};

// Override hàm trên để hỗ trợ Load More đúng
function renderActivityHistory(isAppend = false) {
    const list = document.getElementById("activity-history-list");
    if (!isAppend) list.innerHTML = "";
    
    const start = currentHistoryPage * HISTORY_PAGE_SIZE;
    const end = start + HISTORY_PAGE_SIZE;
    const pageData = allHistoryData.slice(start, end);

    if (pageData.length === 0 && !isAppend) {
         list.innerHTML = `<div class="text-center text-slate-400 py-4 text-sm">Chưa có dữ liệu</div>`;
         return;
    }

    pageData.forEach((item, index) => {
        const delay = index * 100;
        const isLate = item.Is_Late_Penalty;
        const statusColor = isLate ? "text-red-500 bg-red-50" : "text-emerald-600 bg-emerald-50";
        const icon = isLate ? "fa-exclamation-circle" : "fa-check-circle";
  
        let timeHtml = "";
        if (item.Time_List) {
            item.Time_List.forEach(t => {
                timeHtml += `<div class="text-xs font-mono text-slate-600 bg-slate-100 px-2 py-1 rounded mb-1 last:mb-0 text-center">${t.in} - ${t.out || "..."}</div>`;
            });
        }
  
        const html = `
        <div class="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex items-center justify-between animate-slideUp" style="animation-delay: ${delay}ms">
            <div class="flex items-center gap-4">
                <div class="w-12 h-12 rounded-2xl ${statusColor} flex items-center justify-center text-xl shadow-sm">
                    <i class="fa-solid ${icon}"></i>
                </div>
                <div>
                    <div class="font-bold text-slate-800">${item.Date}</div>
                    <div class="text-xs text-slate-500 mt-0.5">
                       ${isLate ? `<span class="text-red-500 font-bold">Trễ ${item.Late_Minutes_Total}p</span>` : `<span class="text-emerald-600">Công: ${item.Total_Work_Hours}h</span>`}
                    </div>
                </div>
            </div>
            <div class="flex flex-col items-end gap-1">${timeHtml}</div>
        </div>`;
        list.insertAdjacentHTML("beforeend", html);
    });

    const btnMore = document.getElementById("btn-load-more-history");
    if (allHistoryData.length > end) {
        btnMore.classList.remove("hidden");
    } else {
        btnMore.classList.add("hidden");
    }
}

// History Month Control (Logic Query DB trực tiếp)
window.changeHistoryMonth = function (delta) {
  viewHistoryDate.setMonth(viewHistoryDate.getMonth() + delta);
  loadHistoryOnly();
};

async function loadHistoryOnly() {
  const m = viewHistoryDate.getMonth() + 1;
  const y = viewHistoryDate.getFullYear();
  
  const badge = document.getElementById("hist-month-badge");
  if (badge) badge.innerText = "Tháng " + m + "/" + y;

  const list = document.getElementById("activity-history-list");
  list.innerHTML = `<div class="flex flex-col items-center justify-center py-10 opacity-50 space-y-3"><div class="animate-spin rounded-full h-8 w-8 border-2 border-slate-200 border-t-emerald-500"></div></div>`;

  try {
      // Query bảng attendance_logs
      const { data, error } = await supabase
          .from('attendance_logs')
          .select('*')
          .eq('employee_id', await getEmployeeUUID())
          .gte('work_date', `${y}-${m}-01`)
          .lte('work_date', `${y}-${m}-31`)
          .order('work_date', { ascending: false });

      if (error) throw error;

      allHistoryData = (data || []).map(h => ({
          Date: formatDateVN(h.work_date),
          Time_List: [{ in: formatTime(h.time_in), out: formatTime(h.time_out) }],
          Total_Work_Hours: h.work_hours,
          Late_Minutes_Total: h.late_minutes,
          Is_Late_Penalty: h.status === 'Late'
      }));

      currentHistoryPage = 0;
      renderActivityHistory();

  } catch (err) {
      list.innerHTML = `<div class="text-red-500 text-center py-4">Lỗi tải dữ liệu</div>`;
  }
}

// Contacts Tab (Lấy từ bảng employees)
async function loadContacts() {
    const list = document.getElementById("contact-list");
    list.innerHTML = SKELETON_CONTACT;
    
    try {
        const { data, error } = await supabase
            .from('employees')
            .select('full_name, position, phone, department, avatar_url, locations(location_name)')
            .eq('status', 'Active')
            .order('full_name');
            
        if (error) throw error;
        
        cachedContacts = data.map(e => ({
            Name: e.full_name,
            Position: e.position,
            Phone: e.phone,
            Department: e.department,
            Avatar: e.avatar_url,
            Location: e.locations ? e.locations.location_name : ''
        }));
        
        renderContacts(cachedContacts);
    } catch (err) {
        list.innerHTML = `<div class="text-center text-red-500">Lỗi tải danh bạ</div>`;
    }
}

function renderContacts(data) {
    const list = document.getElementById("contact-list");
    list.innerHTML = "";
    if(!data || data.length === 0) {
        list.innerHTML = `<div class="text-center text-slate-400 mt-10">Không tìm thấy nhân sự</div>`;
        return;
    }
    data.forEach(c => {
        const ava = c.Avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.Name)}&background=random`;
        const html = `
        <div class="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4 hover:shadow-md transition-all">
            <img src="${ava}" class="w-12 h-12 rounded-2xl object-cover bg-slate-200">
            <div class="flex-1">
                <div class="font-bold text-slate-800">${c.Name}</div>
                <div class="text-xs text-slate-500">${c.Position} - ${c.Department}</div>
            </div>
            ${c.Phone ? `<a href="tel:${c.Phone}" class="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center hover:bg-emerald-500 hover:text-white transition-all"><i class="fa-solid fa-phone"></i></a>` : ''}
        </div>`;
        list.insertAdjacentHTML("beforeend", html);
    });
}

window.filterContacts = function(keyword) {
    if(!keyword) {
        renderContacts(cachedContacts);
        return;
    }
    const filtered = cachedContacts.filter(c => 
        c.Name.toLowerCase().includes(keyword.toLowerCase()) || 
        c.Department.toLowerCase().includes(keyword.toLowerCase())
    );
    renderContacts(filtered);
};

// Locations Tab
async function loadLocations() {
    const list = document.getElementById("location-list");
    list.innerHTML = SKELETON_CONTACT; // Reuse skeleton
    try {
        const { data, error } = await supabase.from('locations').select('*');
        if (error) throw error;
        
        list.innerHTML = "";
        data.forEach(l => {
             const html = `
             <div class="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 mb-3">
                 <div class="flex items-center gap-3 mb-2">
                     <div class="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                         <i class="fa-solid fa-map-location-dot"></i>
                     </div>
                     <div>
                         <div class="font-bold text-slate-800">${l.location_name}</div>
                         <div class="text-xs text-slate-500">Bán kính: ${l.radius_meters}m</div>
                     </div>
                 </div>
                 <div class="text-sm text-slate-600 pl-13"><i class="fa-solid fa-location-dot mr-1 text-slate-400"></i> Có thể chấm công tại đây</div>
             </div>`;
             list.insertAdjacentHTML("beforeend", html);
        });
    } catch (err) {
        list.innerHTML = "Lỗi tải địa điểm";
    }
}

// Notifications logic
function renderNotificationsBadge(notiData) {
    const total = (notiData.approvals || []).length + (notiData.myRequests || []).length;
    const badge = document.getElementById("noti-badge");
    if(badge) {
        if(total > 0) {
            badge.innerText = total > 9 ? "9+" : total;
            badge.classList.remove("scale-0");
        } else {
            badge.classList.add("scale-0");
        }
    }
}

window.openNotifications = function (type) {
  if (!cachedNotifications) return;
  document.getElementById("modal-notifications").classList.remove("hidden");
  
  const title = type === 'approve' ? 'Duyệt đơn từ' : 'Thông báo';
  document.getElementById("modal-noti-title").innerText = title;
  
  renderNotificationContent(cachedNotifications, type);
};

function renderNotificationContent(data, type) {
    const list = document.getElementById("noti-list");
    list.innerHTML = "";
    
    // 1. Tab Duyệt đơn (Cho Manager/Admin)
    if(type === 'approve' || type === 'all') {
        const apps = data.approvals || [];
        if(apps.length > 0) {
            list.insertAdjacentHTML("beforeend", `<div class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 mt-2">Cần phê duyệt (${apps.length})</div>`);
            apps.forEach(req => {
                const html = `
                <div class="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 mb-3">
                    <div class="flex items-center gap-3 mb-3">
                        <img src="${req.Avatar || 'https://ui-avatars.com/api/?background=random'}" class="w-10 h-10 rounded-full">
                        <div>
                            <div class="font-bold text-slate-800">${req.Name}</div>
                            <div class="text-xs text-slate-500">${req.Type} • ${req.Dates}</div>
                        </div>
                    </div>
                    <div class="bg-slate-50 p-3 rounded-2xl text-sm text-slate-600 mb-3 italic">"${req.Reason}"</div>
                    <div class="flex gap-2">
                        <button onclick="toggleSelectRequest(${req.Request_ID}, this)" class="flex-1 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-bold active:scale-95 transition-all">Chọn</button>
                        <button onclick="openRejectModal(${req.Request_ID})" class="w-10 flex items-center justify-center rounded-xl bg-red-50 text-red-500 border border-red-100 active:scale-95 transition-all"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                </div>`;
                list.insertAdjacentHTML("beforeend", html);
            });
            // Show nút duyệt hàng loạt
            document.getElementById("action-approve-bar").classList.remove("hidden");
        } else if (type === 'approve') {
            list.innerHTML = `<div class="text-center text-slate-400 py-10">Không có đơn cần duyệt</div>`;
            document.getElementById("action-approve-bar").classList.add("hidden");
        }
    }

    // 2. Tab Đơn của tôi
    if(type === 'all') {
        const my = data.myRequests || [];
        if(my.length > 0) {
            list.insertAdjacentHTML("beforeend", `<div class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 mt-4">Đơn của tôi</div>`);
            my.forEach(req => {
                let statusBadge = "";
                if(req.Status === 'Pending') statusBadge = `<span class="px-2 py-1 rounded-lg bg-yellow-50 text-yellow-600 text-xs font-bold">Chờ duyệt</span>`;
                else if(req.Status === 'Approved') statusBadge = `<span class="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-600 text-xs font-bold">Đã duyệt</span>`;
                else statusBadge = `<span class="px-2 py-1 rounded-lg bg-red-50 text-red-500 text-xs font-bold">Từ chối</span>`;

                const html = `
                <div class="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 mb-3 opacity-80">
                    <div class="flex justify-between items-start mb-2">
                        <div>
                            <div class="font-bold text-slate-800">${req.Type}</div>
                            <div class="text-xs text-slate-500">${req.Dates}</div>
                        </div>
                        ${statusBadge}
                    </div>
                    ${req.Note ? `<div class="text-xs text-red-500 mt-2 bg-red-50 p-2 rounded-lg">Lý do: ${req.Note}</div>` : ''}
                </div>`;
                list.insertAdjacentHTML("beforeend", html);
            });
        }
    }
}

window.toggleSelectRequest = function(id, btn) {
    if(selectedRequests.includes(id)) {
        selectedRequests = selectedRequests.filter(x => x !== id);
        btn.classList.remove("bg-emerald-500", "text-white", "border-emerald-500");
        btn.classList.add("border-slate-200", "text-slate-600");
        btn.innerText = "Chọn";
    } else {
        selectedRequests.push(id);
        btn.classList.remove("border-slate-200", "text-slate-600");
        btn.classList.add("bg-emerald-500", "text-white", "border-emerald-500");
        btn.innerText = "Đã chọn";
    }
    // Update nút tổng
    const btnApproveAll = document.getElementById("btn-approve-selected");
    if(selectedRequests.length > 0) {
        btnApproveAll.innerHTML = `Duyệt ${selectedRequests.length} đơn <i class="fa-solid fa-check ml-2"></i>`;
        btnApproveAll.disabled = false;
        btnApproveAll.classList.remove("opacity-50");
    } else {
        btnApproveAll.innerHTML = `Chọn đơn để duyệt`;
        btnApproveAll.disabled = true;
        btnApproveAll.classList.add("opacity-50");
    }
};

window.openRejectModal = function(id) {
    currentRejectId = id;
    document.getElementById("modal-reject-reason").classList.remove("hidden");
};

// ==========================================
// 8. HELPERS (TIỆN ÍCH)
// ==========================================

async function getEmployeeUUID() {
    if (currentUser && currentUser.UUID) return currentUser.UUID;
    // Fallback: Tìm lại từ Auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Chưa đăng nhập");
    const { data } = await supabase.from('employees').select('id').eq('auth_user_id', user.id).single();
    return data.id;
}

async function getLocationID() {
    // Trả về ID địa điểm (nếu có trong profile), ngược lại tìm theo location_code
    if(currentUser.Location_ID) return currentUser.Location_ID; // Nếu backend trả về
    // Nếu chỉ có Code/Name, query lại (Nhưng hàm get_dashboard_data ở SQL nên trả về Location ID để tối ưu)
    // Tạm thời fallback sang bảng employees query lại
    const uuid = await getEmployeeUUID();
    const { data } = await supabase.from('employees').select('location_id').eq('id', uuid).single();
    return data.location_id;
}

function checkCurrentStatus(history) {
    if (!history || history.length === 0) return toggleHomeState("idle");
    const todayStr = new Date().toISOString().split('T')[0];
    // Tìm log check-in hôm nay
    const todayLog = history.find(h => h.work_date === todayStr);
    
    // Logic: Có Check-in nhưng CHƯA Check-out -> Working
    if (todayLog && todayLog.time_in && !todayLog.time_out) {
        toggleHomeState("working");
    } else {
        toggleHomeState("idle");
    }
}

function toggleHomeState(state) {
    const states = ["loading", "idle", "working"];
    states.forEach(s => document.getElementById(`state-${s}`).classList.add("hidden"));
    document.getElementById(`state-${state}`).classList.remove("hidden");
}

function switchTab(tabName) {
    // Hide all views
    document.querySelectorAll(".view-section").forEach(el => el.classList.add("hidden"));
    document.getElementById(`view-${tabName}`).classList.remove("hidden");
    
    // Update Nav
    document.querySelectorAll(".nav-item").forEach(el => el.classList.remove("active"));
    const activeBtn = document.querySelector(`button[onclick="switchTab('${tabName}')"]`);
    if(activeBtn) activeBtn.classList.add("active");

    // Load data specific
    if(tabName === 'contacts') loadContacts();
    if(tabName === 'requests') loadLocations(); // Tận dụng tab Requests để show thêm info nếu cần
}

function toggleGlobalNav(show) {
    const nav = document.getElementById("global-nav");
    if(show) nav.classList.remove("hidden");
    else nav.classList.add("hidden");
}

function showLoading(show) {
    const loader = document.getElementById("loader");
    if(show) loader.classList.remove("hidden");
    else loader.classList.add("hidden");
}

function showToast(type, msg) {
    const toast = document.getElementById("toast");
    const icon = toast.querySelector("i");
    const text = toast.querySelector("span");
    
    text.innerText = msg;
    toast.className = ""; // Reset
    
    if (type === "success") {
        icon.className = "fa-solid fa-check-circle text-emerald-500 text-xl";
        toast.classList.add("bg-white", "border-emerald-100", "shadow-xl");
    } else {
        icon.className = "fa-solid fa-triangle-exclamation text-red-500 text-xl";
        toast.classList.add("bg-white", "border-red-100", "shadow-xl");
    }
    
    toast.style.opacity = "1";
    toast.style.transform = "translate(-50%, 20px)";
    
    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translate(-50%, -150%)";
    }, 3000);
}

function closeCamera() {
    document.getElementById("modal-camera").classList.add("hidden");
    toggleGlobalNav(true);
    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
    }
}

function openRequestModal(type) {
    currentReqType = type;
    document.getElementById("modal-request-form").classList.remove("hidden");
    document.getElementById("req-form-title").innerText = "Tạo đơn " + type;
    
    // Reset form
    document.getElementById("req-reason").value = "";
    document.getElementById("req-date-start").valueAsDate = new Date();
    document.getElementById("req-date-end").valueAsDate = new Date();
}

function closeRequestModal() {
    document.getElementById("modal-request-form").classList.add("hidden");
}

function closeNotifications() {
    document.getElementById("modal-notifications").classList.add("hidden");
    document.getElementById("modal-reject-reason").classList.add("hidden");
    selectedRequests = [];
}

function formatDateVN(isoDate) {
    if(!isoDate) return "";
    const [y, m, d] = isoDate.split('-');
    return `${d}/${m}/${y}`;
}

function formatTime(isoTime) {
    if(!isoTime) return "";
    // Xử lý chuỗi thời gian PostgreSQL (HH:MM:SS hoặc ISO)
    if(isoTime.includes('T')) {
        const d = new Date(isoTime);
        return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    } else {
        // Cắt giây nếu có
        return isoTime.substring(0, 5);
    }
}

function animateValue(id, start, end) {
    const obj = document.getElementById(id);
    if(!obj) return;
    if (start === end) return;
    
    // Nếu là số thập phân
    const isFloat = end % 1 !== 0;
    const duration = 1000;
    let startTimestamp = null;
    
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const val = progress * (end - start) + start;
        obj.innerHTML = isFloat ? val.toFixed(1) : Math.floor(val);
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}
