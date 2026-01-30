// ==============================================
// 1. CẤU HÌNH HỆ THỐNG & HÀM TIỆN ÍCH
// ==============================================
const SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();
const TIME_ZONE = "Asia/Ho_Chi_Minh";
const FOLDER_ID = "1nJLVu5LndBp4zWs808oIuH6brgULRQlj"; 

const SHEETS = {
  EMPLOYEES: "EMPLOYEES",
  ATTENDANCE: "ATTENDANCE",
  ROLES: "CONFIG_ROLES",
  LOCATIONS: "CONFIG_LOCATIONS",
  SYSTEM: "CONFIG_SYSTEM",
  LEAVE: "LEAVE_REQUESTS",
  CACHE: "SYS_CACHE" // [CACHE] Sheet Database mới
};

const SHIFTS = [
  { name: "Ca Sáng",  start: "09:00", end: "12:00", break_point: "13:00" }, 
  { name: "Ca Chiều", start: "14:00", end: "18:00", break_point: "17:30" }, 
  { name: "Ca Tối",   start: "18:00", end: "21:00", break_point: "23:59" } 
];

const LUNCH_BREAK = { start: "12:00", end: "14:00" };

function doGet(e) {
  const template = HtmlService.createTemplateFromFile("index");
  template.qrToken = e && e.parameter && e.parameter.token ? e.parameter.token : "";
  return template
    .evaluate()
    .setTitle("Army HRM V2026")
    .addMetaTag("viewport", "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// --- HÀM CỐT LÕI: CHUYỂN DATA SHEET -> OBJECT ---
function getData(sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return [];
  const data = sheet.getDataRange().getDisplayValues();
  if (data.length < 2) return [];
  const headers = data[0].map((h) => h.toString().trim());
  const result = [];
  for (let i = 1; i < data.length; i++) {
    let obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = data[i][j];
    }
    obj["_rowIndex"] = i + 1; 
    result.push(obj);
  }
  return result;
}

function updateCellByHeader(sheetName, rowIndex, headerName, value) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => h.toString().trim());
  const colIndex = headers.indexOf(headerName) + 1;
  
  if (colIndex > 0) {
    sheet.getRange(rowIndex, colIndex).setValue(value);
    return true;
  }
  return false;
}

// --- CÁC HÀM XỬ LÝ DỮ LIỆU (HELPER FUNCTIONS) ---
function parseNumber(val) {
  if (val === undefined || val === null || val === "") return 0;
  if (typeof val === "number") return val;
  let str = String(val).trim();
  const isVietnameseFormat = str.includes(",") && !str.includes(".") || (str.includes(".") && str.includes(",") && str.lastIndexOf(",") > str.lastIndexOf("."));
  if (isVietnameseFormat) {
     str = str.replace(/\./g, "").replace(",", ".");
  } else {
     str = str.replace(/,/g, "");
  }
  str = str.replace(/'/g, "").trim();
  let num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

function cleanCoordinate(val) {
  if (!val) return 0;
  let num = parseNumber(val);
  while (Math.abs(num) > 180) { 
     num = num / 10;
  }
  return num;
}

function getShortName(fullName) {
  if (!fullName) return "";
  const parts = String(fullName).trim().split(" ");
  return parts.length > 0 ? parts[parts.length - 1] : "";
}

function formatRequestType(type) {
  if (!type) return "";
  const t = String(type).trim();
  if (t === "Explanation" || t === "Giải trình") return "Giải trình công";
  if (t === "Business Trip" || t === "Công tác") return "Đi công tác";
  if (t === "Leave" || t === "Nghỉ phép") return "Nghỉ phép";
  return t; 
}

function getSystemConfigValue(key) {
  const configs = getData(SHEETS.SYSTEM);
  const found = configs.find(c => c["Key"] == key || c["Config_Key"] == key);
  return found ? found["Value"] : 0;
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; 
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  if (typeof timeStr === "object") {
    timeStr = Utilities.formatDate(timeStr, TIME_ZONE, "HH:mm");
  }
  const p = String(timeStr).split(":").map(Number);
  if (p.length < 2) return 0;
  return p[0] * 60 + p[1];
}

function calculateNetWorkHours(inTime, outTime) {
  const inMins = timeToMinutes(inTime);
  const outMins = timeToMinutes(outTime);
  const breakStart = timeToMinutes(LUNCH_BREAK.start); 
  const breakEnd = timeToMinutes(LUNCH_BREAK.end);     
  let totalMins = outMins - inMins;
  let overlap = Math.max(0, Math.min(outMins, breakEnd) - Math.max(inMins, breakStart));
  let netMins = totalMins - overlap;
  if (netMins < 0) netMins = 0;
  return (netMins / 60).toFixed(2);
}

function determineShift(timeStr) {
  const currentMins = timeToMinutes(timeStr);
  let selectedShift = SHIFTS[0]; 
  if (currentMins < timeToMinutes(SHIFTS[0].break_point)) {
      selectedShift = SHIFTS[0]; 
  } else if (currentMins < timeToMinutes(SHIFTS[1].break_point)) {
      selectedShift = SHIFTS[1]; 
  } else {
      selectedShift = SHIFTS[2]; 
  }
  return selectedShift;
}

// ==============================================
// 2. XỬ LÝ ĐĂNG NHẬP
// ==============================================
function doLogin(loginId, password, deviceId) {
  const lock = LockService.getScriptLock();
  lock.tryLock(5000);

  try {
    const employees = getData(SHEETS.EMPLOYEES);
    const roles = getData(SHEETS.ROLES);
    const locations = getData(SHEETS.LOCATIONS);

    const user = employees.find(
      (e) =>
        String(e["Email"]).toLowerCase() === String(loginId).toLowerCase() ||
        String(e["Employee_ID"] || e["Employee ID"]).toUpperCase() === String(loginId).toUpperCase()
    );

    if (!user) return { success: false, message: "Tài khoản không tồn tại!" };
    if (String(user["Password"]).trim() !== String(password).trim())
      return { success: false, message: "Mật khẩu không đúng!" };
    if (user["Status"] && user["Status"] !== "Active") return { success: false, message: "Tài khoản đang bị khóa!" };

    const userRole = user["Role"];
    const isAdmin = ["Admin", "Manager", "HR", "Accountant", "Board"].includes(userRole);

    if (!isAdmin) {
      const trustedId = (user["Trusted_Device_ID"] || "").trim();
      if (trustedId === "") {
        updateCellByHeader(SHEETS.EMPLOYEES, user["_rowIndex"], "Trusted_Device_ID", deviceId);
      } else if (trustedId !== String(deviceId).trim()) {
        return { success: false, message: "Thiết bị lạ! Vui lòng liên hệ Admin." };
      }
    }

    const roleConfig = roles.find((r) => r["Role_ID"] === userRole) || {};
    const centerId = user["Center_ID"];
    const locationObj = locations.find((l) => String(l["Location_ID"]) === String(centerId));
    const finalID = user["Employee_ID"] || user["Employee ID"];

    return {
      success: true,
      data: {
        Employee_ID: finalID,
        Name: user["Name"],
        Role: userRole,
        RoleName: roleConfig["Role_Name"] || userRole,
        Center_ID: centerId,
        Location_Name: locationObj ? locationObj["Location_Name"] : centerId,
        Position: user["Position"] || "Nhân viên",
        Avatar: user["Face_Ref_URL"] || "",
        Annual_Leave_Balance: user["Annual_Leave_Balance"] || 12,
        Email: user["Email"],
        Phone: user["Phone"] || "Chưa cập nhật",
        Department: user["Department"] || "",
      },
    };
  } catch (e) {
    return { success: false, message: "Lỗi Server: " + e.toString() };
  } finally {
    lock.releaseLock();
  }
}

function processRequestAdmin(reqId, status, managerNote, managerName, managerId) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return { success: false, message: "Hệ thống bận. Vui lòng thử lại." };

  let reqOwnerId = null; 

  try {
    const employees = getData(SHEETS.EMPLOYEES);
    const approverId = String(managerId).trim().toLowerCase();
    const approver = employees.find(e => String(e["Employee_ID"] || e["Employee ID"]).trim().toLowerCase() === approverId);
    
    if (!approver) throw new Error("Người duyệt không tồn tại");

    const rows = getData(SHEETS.LEAVE);
    const targetRowData = rows.find(r => String(r["Request_ID"]).trim() === String(reqId).trim());

    if (!targetRowData) return { success: false, message: "Không tìm thấy đơn!" };

    // Lấy thông tin người tạo đơn
    const ownerId = String(targetRowData["Employee_ID"] || targetRowData["Employee ID"]).trim().toLowerCase();
    const requestOwner = employees.find(e => String(e["Employee_ID"] || e["Employee ID"]).trim().toLowerCase() === ownerId);

    // --- BẢO MẬT: Tận dụng hàm checkApprovalPermission ---
    if (!checkApprovalPermission(approver, requestOwner)) {
         return { success: false, message: "⛔ Bạn không có quyền duyệt đơn của nhân sự này!" };
    }
    // ----------------------------------------------------

    const rowIndex = targetRowData["_rowIndex"];
    updateCellByHeader(SHEETS.LEAVE, rowIndex, "Status", status);
    
    if (managerNote || managerName) {
       let shortName = getShortName(managerName);
       let noteContent = managerNote + (managerName ? ` (${shortName})` : "");
       updateCellByHeader(SHEETS.LEAVE, rowIndex, "Note", noteContent);
    }

    SpreadsheetApp.flush(); // Lưu ngay lập tức

    reqOwnerId = targetRowData["Employee_ID"] || targetRowData["Employee ID"];

  } catch (e) {
    return { success: false, message: "Lỗi: " + e.toString() };
  } finally {
    lock.releaseLock();
  }

  // Rebuild Cache
  try {
    if (reqOwnerId) {
      cache_rebuildUserRequest(reqOwnerId); 
      cache_rebuildUserHistory(reqOwnerId); 
      cache_rebuildUserNoti(reqOwnerId);    
    }
    if (managerId) cache_rebuildUserNoti(managerId);
  } catch(e) {}

  return { success: true, message: "Thao tác thành công!" };
}

function submitRequest(payload) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return { success: false, message: "Hệ thống bận, thử lại sau." };
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.LEAVE);
    const requestId = "REQ_" + Math.floor(Math.random() * 90000000 + 10000000);
    
    sheet.appendRow([
      requestId, payload.employeeId, payload.name,
      Utilities.formatDate(new Date(), TIME_ZONE, "dd/MM/yyyy HH:mm"),
      payload.type, payload.fromDate, payload.toDate, payload.reason, "Pending", ""
    ]);
    SpreadsheetApp.flush(); // Ép lưu xuống Sheet

    // --- CẬP NHẬT CACHE TỨC THÌ (Write-Through) ---
    // 1. Rebuild đơn của nhân viên (Trang Đề xuất)
    cache_rebuildUserRequest(payload.employeeId);
    
    // 2. Rebuild Thông báo cho Sếp trực tiếp (Để Sếp thấy ngay)
    const employees = getData(SHEETS.EMPLOYEES);
    const staff = employees.find(e => String(e["Employee_ID"]).trim() === String(payload.employeeId).trim());
    if (staff && staff["Direct_Manager_ID"]) {
      cache_rebuildUserNoti(staff["Direct_Manager_ID"]);
    }
    
    // 3. Rebuild cho Admin (Nếu cần thấy ngay đơn toàn hệ thống)
    // cache_rebuildUserNoti("nghia"); 

    return { success: true, message: "Gửi đề xuất thành công!" };
  } catch (e) {
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

// 3. CHECK-IN (Tối ưu tương tự)
function doCheckIn(data) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return { success: false, message: "Hệ thống bận." }; // Checkin cần nhanh, để 10s
  
  let currentShiftName = "";

  try {
    const employees = getData(SHEETS.EMPLOYEES);
    const locations = getData(SHEETS.LOCATIONS);
    
    const user = employees.find(
      (e) => String(e["Employee_ID"] || e["Employee ID"]).trim() === String(data.employeeId).trim()
    );
    if (!user) return { success: false, message: "Lỗi User ID" };
    
    const targetLoc = locations.find((l) => String(l["Location_ID"]) === String(user["Center_ID"]));
    if (!targetLoc) return { success: false, message: "Chưa cấu hình địa điểm." };

    const locLat = cleanCoordinate(targetLoc["Latitude"]);
    const locLng = cleanCoordinate(targetLoc["Longitude"]);
    const radius = parseNumber(targetLoc["Radius_Meters"]) || 200;
    
    const dist = calculateDistance(data.lat, data.lng, locLat, locLng);
    const valid = dist <= radius;

    if (!valid) {
        return { 
            success: false, 
            message: `Sai vị trí! Bạn cách văn phòng ${Math.round(dist)}m (Cho phép: ${radius}m).` 
        };
    }

    const now = new Date();
    const timeStr = Utilities.formatDate(now, TIME_ZONE, "HH:mm");
    const currentShift = determineShift(timeStr);
    currentShiftName = currentShift.name;
    
    const shiftStart = timeToMinutes(currentShift.start);
    const currentMins = timeToMinutes(timeStr);
    const tolerance = Number(getSystemConfigValue("LATE_TOLERANCE")) || 15;

    let lateMinutes = 0;
    let status = "Valid";
    
    if (currentMins > shiftStart + tolerance) {
      lateMinutes = currentMins - shiftStart;
      status = "Late";
    }

    let imageUrl = "";
    if (data.imageBase64) {
      const blob = Utilities.newBlob(
        Utilities.base64Decode(data.imageBase64.split(",")[1]),
        "image/jpeg",
        `ATT_${data.employeeId}_${timeStr.replace(":","")}.jpg`
      );
      try {
        const file = DriveApp.getFolderById(FOLDER_ID).createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        imageUrl = "https://drive.google.com/thumbnail?id=" + file.getId() + "&sz=w1000";
      } catch (e) {}
    }

    const userIdToSave = user["Employee_ID"] || user["Employee ID"];
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    ss.getSheetByName(SHEETS.ATTENDANCE).appendRow([
      Utilities.formatDate(now, TIME_ZONE, "dd/MM/yyyy"), 
      userIdToSave,     
      user["Name"],     
      user["Center_ID"],
      currentShift.start, 
      currentShift.end,   
      timeStr,            
      "",                 
      "GPS",
      data.lat, 
      data.lng,
      dist,
      data.deviceId,
      imageUrl,
      lateMinutes,
      0, 0, status, "Yes", 
      `[${currentShift.name}]` 
    ]);
    
  } catch (err) {
    return { success: false, message: err.toString() };
  } finally {
    lock.releaseLock();
  }

  // Rebuild Cache sau khi nhả lock
  try {
     cache_rebuildUserHistory(data.employeeId);
  } catch(e){}

  return { success: true, message: `Check-in ${currentShiftName} thành công!` };
}

// 4. CHECK-OUT
function doCheckOut(data) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return { success: false, message: "Hệ thống bận." };
  
  let msg = "";

  try {
    const attData = getData(SHEETS.ATTENDANCE);
    const today = Utilities.formatDate(new Date(), TIME_ZONE, "dd/MM/yyyy");
    const nowTime = Utilities.formatDate(new Date(), TIME_ZONE, "HH:mm");

    const entry = attData.slice().reverse().find(r => 
       String(r["Employee_ID"] || r["Employee ID"]).trim() === String(data.employeeId).trim() &&
       r["Date"] === today &&
       (!r["Time_Out"] || r["Time_Out"] === "")
    );

    if (entry) {
        const rowIdx = entry["_rowIndex"];
        const timeInStr = entry["Time_In"];
        const workedHours = calculateNetWorkHours(timeInStr, nowTime);

        updateCellByHeader(SHEETS.ATTENDANCE, rowIdx, "Time_Out", nowTime);
        updateCellByHeader(SHEETS.ATTENDANCE, rowIdx, "Work_Hours", workedHours);
        msg = "Check-out thành công! (" + workedHours + "h)";
    } else {
        const employees = getData(SHEETS.EMPLOYEES);
        const user = employees.find(e => String(e["Employee_ID"] || e["Employee ID"]).trim() === String(data.employeeId).trim());
        
        if (user) {
            const ss = SpreadsheetApp.getActiveSpreadsheet();
            ss.getSheetByName(SHEETS.ATTENDANCE).appendRow([
              today,
              user["Employee_ID"] || user["Employee ID"],
              user["Name"],
              user["Center_ID"],
              "", "", "", nowTime,
              "Manual", "", "", "", data.deviceId || "", "",
              0, 0, 0, "Invalid", "No", "Quên Check-in"
            ]);
            msg = "Đã ghi nhận giờ về (Thiếu giờ vào)!";
        } else {
            return { success: false, message: "Không tìm thấy thông tin nhân viên!" };
        }
    }

  } catch (e) {
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }

  try {
     cache_rebuildUserHistory(data.employeeId);
  } catch(e){}

  return { success: true, message: msg };
}


// ==============================================
// 5. LẤY DỮ LIỆU GỬI VỀ FRONTEND (CACHE ENABLED)
// ==============================================

// --- WRAPPERS (ĐỌC CACHE TRƯỚC) ---

function getHistory(employeeId) {
  const cached = cache_get(employeeId, "History_JSON");
  if (cached) return cached;
  const freshData = _getHistoryRaw(employeeId);
  cache_set(employeeId, "History_JSON", freshData);
  return freshData;
}

function getMyRequests(employeeId) {
  const cached = cache_get(employeeId, "Requests_JSON");
  if (cached) return cached;
  const freshData = _getMyRequestsRaw(employeeId);
  cache_set(employeeId, "Requests_JSON", freshData);
  return freshData;
}

function getMobileNotifications(employeeId) {
  const cached = cache_get(employeeId, "Noti_JSON");
  if (cached) return cached;
  const freshData = _getMobileNotificationsRaw(employeeId);
  cache_set(employeeId, "Noti_JSON", freshData);
  return freshData;
}

// --- LOGIC GỐC (RAW) ---

function _getHistoryRaw(employeeId) {
  const targetId = String(employeeId).toLowerCase().trim();
  const now = new Date();
  const curMonth = now.getMonth() + 1;
  const curYear = now.getFullYear();

  const statsData = getData("MONTHLY_STATS"); 
  const statRow = statsData.find(r => 
    String(r["Employee_ID"] || r["Employee ID"]).toLowerCase().trim() === targetId &&
    parseInt(r["Month"]) === curMonth &&
    parseInt(r["Year"]) === curYear
  );

  let summaryData = { 
      workDays: 0, lateMins: 0, earlyMins: 0, 
      lateCount: 0, earlyCount: 0, errorCount: 0, 
      leaveDays: 0, remainingLeave: 12
  };
  
  if (statRow) {
      summaryData.workDays = parseNumber(statRow["Work_Days"]);
      summaryData.lateMins = parseNumber(statRow["Late_Mins"]);
      summaryData.earlyMins = parseNumber(statRow["Early_Mins"]);
      summaryData.lateCount = parseNumber(statRow["Late_Count"]);
      summaryData.earlyCount = parseNumber(statRow["Early_Count"]);
      summaryData.errorCount = parseNumber(statRow["Error_Count"]);
      summaryData.leaveDays = parseNumber(statRow["Leave_Days"]);
      
      if (statRow["Remaining_Leave"] !== undefined && statRow["Remaining_Leave"] !== "") {
          summaryData.remainingLeave = parseNumber(statRow["Remaining_Leave"]);
      }
  } else {
      const employees = getData(SHEETS.EMPLOYEES);
      const user = employees.find(e => String(e["Employee_ID"]).toLowerCase() === targetId);
      if (user) {
          summaryData.remainingLeave = parseNumber(user["Annual_Leave_Balance"]) || 12;
      }
  }

  const attData = getData(SHEETS.ATTENDANCE);
  const leaveData = getData(SHEETS.LEAVE);
  
  const explainedDates = [];
  leaveData.forEach(row => {
    const rId = String(row["Employee_ID"] || row["Employee ID"]).toLowerCase().trim();
    const rType = String(row["Type"]).trim();
    if ((rId === targetId) && (rType === "Explanation" || rType.includes("Giải trình"))) {
        const rFrom = String(row["From_Date"] || row["From Date"]).trim();
        const rTo = String(row["To_Date"] || row["To Date"]).trim();
        explainedDates.push(rFrom);
        if(rTo && rTo !== rFrom) explainedDates.push(rTo);
    }
  });

  const userRows = attData.filter(row => String(row["Employee_ID"] || row["Employee ID"]).toLowerCase().trim() === targetId);
  const dailyGroups = {};
  userRows.forEach(row => {
      const date = row["Date"];
      if (!dailyGroups[date]) dailyGroups[date] = { Date: date, Total_Work_Hours: 0, Late_Minutes_Total: 0, Status_List: [], Time_List: [], Has_Explained: explainedDates.includes(date) };
      dailyGroups[date].Total_Work_Hours += parseFloat(row["Work_Hours"] || 0);
      dailyGroups[date].Late_Minutes_Total += parseInt(row["Late_Minutes"] || 0);
      if (row["Status"]) dailyGroups[date].Status_List.push(row["Status"]);
      if (row["Time_In"]) dailyGroups[date].Time_List.push({ in: row["Time_In"], out: row["Time_Out"] || "..." });
      else if (row["Time_Out"]) dailyGroups[date].Time_List.push({ in: "...", out: row["Time_Out"] });
  });

  const historyList = Object.values(dailyGroups).sort((a, b) => {
      const d1 = a.Date.split("/"); const d2 = b.Date.split("/");
      return new Date(d2[2], d2[1]-1, d2[0]) - new Date(d1[2], d1[1]-1, d1[0]); 
  }).slice(0, 31);

  return { history: historyList, summary: summaryData };
}
function checkApprovalPermission(approver, requestOwner) {
  const approverId = String(approver["Employee_ID"] || approver["Employee ID"]).trim().toLowerCase();
  const ownerId = String(requestOwner["Employee_ID"] || requestOwner["Employee ID"]).trim().toLowerCase();
  if (approverId === ownerId) return false;
  const role = approver["Role"];
  if (["Admin", "HR", "Board"].includes(role)) return true;
  if (role === "Manager") {
    const directManagerId = String(requestOwner["Direct_Manager_ID"] || "").trim().toLowerCase();
    return directManagerId === approverId;
  }
  return false;
}

function _getMyRequestsRaw(employeeId) {
  const data = getData(SHEETS.LEAVE);
  return data
    .filter((r) => String(r["Employee_ID"] || r["Employee ID"]).trim() === String(employeeId).trim())
    .reverse()
    .slice(0, 20)
    .map(r => ({
        ...r,
        "Type": formatRequestType(r["Type"]),
        "From Date": r["From_Date"] || r["From Date"],
        "To Date": r["To_Date"] || r["To Date"],
        "Note": r["Note"]
    }));
}
function _getMobileNotificationsRaw(employeeId) {
  try {
    const employees = getData(SHEETS.EMPLOYEES);
    const locations = getData(SHEETS.LOCATIONS);
    const currentUserId = String(employeeId).trim().toLowerCase();
    const currentUser = employees.find(e => String(e["Employee_ID"] || e["Employee ID"]).trim().toLowerCase() === currentUserId);
    if (!currentUser) return { success: false, message: "User not found" };

    const now = new Date();
    const curMonth = now.getMonth() + 1;
    const curYear = now.getFullYear();

    const empLookup = {};
    employees.forEach(e => empLookup[String(e["Employee_ID"] || e["Employee ID"]).trim().toLowerCase()] = e);

    const reqData = getData(SHEETS.LEAVE);
    const approvals = []; // Đơn cần duyệt (cho sếp)
    const myHistory = []; // Đơn đã duyệt (của mình trong tháng)

    for (let i = reqData.length - 1; i >= 0; i--) {
      const r = reqData[i];
      const rEmpId = String(r["Employee_ID"] || r["Employee ID"]).trim().toLowerCase();
      const status = String(r["Status"] || "").toLowerCase();

      // A. Đơn của chính tôi (Đã duyệt/Từ chối trong tháng này)
      if (rEmpId === currentUserId && (status === "approved" || status === "rejected")) {
        const dateStr = r["From_Date"] || r["From Date"] || "";
        const p = dateStr.split("/");
        if (p.length === 3 && parseInt(p[1]) === curMonth && parseInt(p[2]) === curYear) {
          myHistory.push(r);
        }
      }

      // B. Đơn cần duyệt (Dành cho Admin/Quản lý)
      if (status === "pending") {
        const owner = empLookup[rEmpId];
        if (owner && checkApprovalPermission(currentUser, owner)) {
          approvals.push(r);
        }
      }
      if (approvals.length >= 20 && myHistory.length >= 20) break;
    }

    return {
      success: true,
      data: { approvals, myHistory },
      isManager: approvals.length > 0 || ["Admin", "Manager", "HR", "Board"].includes(currentUser.Role)
    };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

function getLocations() {
  const data = getData(SHEETS.LOCATIONS);
  return data.map(l => ({ id: l["Location_ID"], name: l["Location_Name"] }));
}

function updateEmployeeProfile(data) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    const employees = getData(SHEETS.EMPLOYEES);
    const user = employees.find(e => String(e["Employee_ID"] || e["Employee ID"]).trim() == String(data.employeeId).trim());
    
    if (!user) return { success: false, message: "User not found" };

    const rowIdx = user["_rowIndex"];
    if (data.newPass) updateCellByHeader(SHEETS.EMPLOYEES, rowIdx, "Password", data.newPass);
    if (data.phone) updateCellByHeader(SHEETS.EMPLOYEES, rowIdx, "Phone", data.phone);
    if (data.centerId) updateCellByHeader(SHEETS.EMPLOYEES, rowIdx, "Center_ID", data.centerId);

    let newAvatarUrl = null;
    if (data.avatarBase64) {
      const blob = Utilities.newBlob(
        Utilities.base64Decode(data.avatarBase64.split(",")[1]),
        "image/jpeg",
        `AVATAR_${data.employeeId}.jpg`
      );
      const file = DriveApp.getFolderById(FOLDER_ID).createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      newAvatarUrl = "https://drive.google.com/thumbnail?id=" + file.getId() + "&sz=w1000";
      
      updateCellByHeader(SHEETS.EMPLOYEES, rowIdx, "Face_Ref_URL", newAvatarUrl);
    }
    return { success: true, message: "Thành công!", newAvatar: newAvatarUrl };
  } finally {
    lock.releaseLock();
  }
}

// --- WRAPPER CONTACTS ---
function getContacts(role, centerId) {
  const isAdmin = ["Admin", "Manager", "HR", "Accountant", "Board"].includes(role);
  const cacheKey = isAdmin ? "SYS_CONTACTS_ALL" : ("SYS_CONTACTS_" + String(centerId).trim());

  const cached = cache_get(cacheKey, "Contacts_JSON");
  if (cached) return cached;

  const freshData = _getContactsRaw(role, centerId);
  cache_set(cacheKey, "Contacts_JSON", freshData);
  return freshData;
}

// --- RAW CONTACTS ---
function _getContactsRaw(role, centerId) {
  const employees = getData(SHEETS.EMPLOYEES);
  const locations = getData(SHEETS.LOCATIONS);
  const locationMap = {};
  locations.forEach((l) => {
    locationMap[String(l["Location_ID"]).trim()] = l["Location_Name"];
  });

  let filtered = employees;
  if (!["Admin", "Manager", "HR", "Accountant", "Board"].includes(role)) {
    filtered = employees.filter((e) => String(e["Center_ID"]).trim() === String(centerId).trim());
  }

  return filtered
    .filter((e) => e["Name"])
    .map((e) => ({
      Employee_ID: e["Employee_ID"] || e["Employee ID"],
      Name: e["Name"],
      Position: e["Position"] || "Nhân viên",
      Phone: e["Phone"] || "",
      Email: e["Email"] || "",
      Department: e["Department"] || "",
      Avatar: normalizeAvatar(e["Face_Ref_URL"], e["Name"]),
      Center_ID: e["Center_ID"],
      Center_Name: locationMap[String(e["Center_ID"]).trim()] || e["Center_ID"],
    }));
}

function normalizeAvatar(url, name) {
  if (!url) return "";
  if (url.includes("drive.google.com")) {
    const m = url.match(/\/d\/([^\/]+)/);
    if (m && m[1]) return `https://drive.google.com/thumbnail?id=${m[1]}&sz=w1000`;
  }
  if (url.startsWith("http")) return url;
  return "";
}

// ==============================================
// 9. THỐNG KÊ & STATS
// ==============================================
function countStandardWorkingDays(month, year) {
  let count = 0;
  const daysInMonth = new Date(year, month, 0).getDate(); 
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    if (date.getDay() !== 0) count++; // 0 là Chủ Nhật
  }
  return count;
}

function parseDateStr(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.split("/");
  return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
}

function updateMonthlyStats() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return;

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const statsSheet = ss.getSheetByName("MONTHLY_STATS");
    
    const now = new Date();
    const currentMonth = now.getMonth() + 1; 
    const currentYear = now.getFullYear();
    
    const toleranceMins = parseNumber(getSystemConfigValue("LATE_TOLERANCE")) || 15;
    const standardDays = countStandardWorkingDays(currentMonth, currentYear);

    const employees = getData(SHEETS.EMPLOYEES);
    const attendance = getData(SHEETS.ATTENDANCE);
    const requests = getData(SHEETS.LEAVE);
    const currentStats = getData("MONTHLY_STATS");

    const SHIFT_CONFIG = [
       { name: "Sáng",  end: "12:00", break_point: "13:00" }, 
       { name: "Chiều", end: "18:00", break_point: "17:30" }, 
       { name: "Tối",   end: "21:00", break_point: "23:59" } 
    ];

    employees.forEach(emp => {
      const empId = String(emp["Employee_ID"] || emp["Employee ID"]).trim();
      if (!empId) return;

      const keyId = `${empId}_${currentMonth}_${currentYear}`;
      const annualBalance = parseNumber(emp["Annual_Leave_Balance"]) || 12;

      // --- 1. XỬ LÝ CHẤM CÔNG ---
      let dailyMap = {}; 

      attendance.forEach(att => {
        const attEmpId = String(att["Employee_ID"] || att["Employee ID"]).trim();
        if (attEmpId !== empId) return;
        
        const dateStr = att["Date"];
        const attDate = parseDateStr(dateStr);
        
        if (attDate && (attDate.getMonth() + 1) === currentMonth && attDate.getFullYear() === currentYear) {
           if (!dailyMap[dateStr]) {
               dailyMap[dateStr] = { 
                   hours: 0, late: 0, early: 0, error: 0, 
                   isLateFreq: 0, isEarlyFreq: 0, hasApprovedReq: false 
               };
           }
           
           const workHours = parseNumber(att["Work_Hours"]);
           const lateMins = parseNumber(att["Late_Minutes"]);
           let earlyMins = 0;

           if (att["Time_In"] && att["Time_Out"]) {
               const checkInMins = timeToMinutes(att["Time_In"]);
               const checkOutMins = timeToMinutes(att["Time_Out"]);
               let currentShiftEnd = 0;
               if (checkInMins < timeToMinutes(SHIFT_CONFIG[0].break_point)) {
                   currentShiftEnd = timeToMinutes(SHIFT_CONFIG[0].end); 
               } else if (checkInMins < timeToMinutes(SHIFT_CONFIG[1].break_point)) {
                   currentShiftEnd = timeToMinutes(SHIFT_CONFIG[1].end); 
               } else {
                   currentShiftEnd = timeToMinutes(SHIFT_CONFIG[2].end); 
               }
               if (checkOutMins < currentShiftEnd) {
                   earlyMins = currentShiftEnd - checkOutMins;
               }
           }

           dailyMap[dateStr].hours += workHours;
           dailyMap[dateStr].late += lateMins;
           dailyMap[dateStr].early += earlyMins;
           
           if (lateMins > 0) dailyMap[dateStr].isLateFreq = 1;
           if (earlyMins > 0) dailyMap[dateStr].isEarlyFreq = 1;

           const isInvalid = String(att["Status"]).includes("Invalid");
           const isMissingOut = att["Time_Out"] === "";
           const isLateViolation = lateMins > toleranceMins;
           const isEarlyViolation = earlyMins > toleranceMins;

           if (isInvalid || isMissingOut || isLateViolation || isEarlyViolation) {
               dailyMap[dateStr].error = 1;
           }
           
           if (att["Status"] === "Valid") dailyMap[dateStr].isValid = true;
        }
      });

      // --- 2. XỬ LÝ ĐƠN TỪ ---
      let approvedLeaveDaysInMonth = 0; 
      let totalLeaveUsedYear = 0;      

      requests.forEach(req => {
        const reqEmpId = String(req["Employee_ID"] || req["Employee ID"]).trim();
        if (reqEmpId !== empId) return;
        if (String(req["Status"]) !== "Approved") return; 

        const type = formatRequestType(req["Type"]);
        const fromDate = parseDateStr(req["From_Date"] || req["From Date"]);
        const toDate = parseDateStr(req["To_Date"] || req["To Date"]);
        
        let daysCount = 1;
        if (fromDate && toDate) {
           const diffTime = Math.abs(toDate - fromDate);
           daysCount = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        }

        if (type === "Nghỉ phép") {
            if (fromDate && fromDate.getFullYear() === currentYear) totalLeaveUsedYear += daysCount;
            if (fromDate && (fromDate.getMonth() + 1) === currentMonth && fromDate.getFullYear() === currentYear) approvedLeaveDaysInMonth += daysCount;
        }

        const isValidForWorkDay = ["Đi công tác", "Nghỉ phép", "Giải trình công"].includes(type);
        if (isValidForWorkDay) {
            let loopDate = new Date(fromDate);
            let endDate = toDate ? new Date(toDate) : new Date(fromDate);
            while (loopDate <= endDate) {
               if ((loopDate.getMonth() + 1) === currentMonth && loopDate.getFullYear() === currentYear) {
                  const dStr = Utilities.formatDate(loopDate, TIME_ZONE, "dd/MM/yyyy");
                  if (!dailyMap[dStr]) dailyMap[dStr] = { hours: 0, late: 0, early: 0, error: 0, isLateFreq: 0, isEarlyFreq: 0, hasApprovedReq: false };
                  dailyMap[dStr].hasApprovedReq = true;
               }
               loopDate.setDate(loopDate.getDate() + 1);
            }
        }
      });

      // --- 3. TỔNG HỢP SỐ LIỆU ---
      let totalWorkDays = 0;
      let lateMinsTotal = 0;
      let earlyMinsTotal = 0;
      let errorCount = 0;
      let lateCountTotal = 0;
      let earlyCountTotal = 0;

      Object.keys(dailyMap).forEach(date => {
         const dayData = dailyMap[date];
         const toleranceHours = toleranceMins / 60;
         const isEnoughHours = dayData.hours >= 7; 
         const isValidLate = dayData.isValid && dayData.hours >= (7 - toleranceHours);
         const isApproved = dayData.hasApprovedReq; 

         if (isEnoughHours || isValidLate || isApproved) totalWorkDays++;
         lateMinsTotal += dayData.late;
         earlyMinsTotal += dayData.early;
         errorCount += dayData.error;
         lateCountTotal += dayData.isLateFreq;
         earlyCountTotal += dayData.isEarlyFreq;
      });

      const remainingLeave = annualBalance - totalLeaveUsedYear;
      const lastUpdated = Utilities.formatDate(new Date(), TIME_ZONE, "dd/MM/yyyy HH:mm");

      // --- 4. GHI VÀO SHEET ---
      const existingStat = currentStats.find(s => String(s["Key_ID"]) === keyId);

      if (existingStat) {
        const rIdx = existingStat["_rowIndex"];
        updateCellByHeader("MONTHLY_STATS", rIdx, "Work_Days", totalWorkDays);
        updateCellByHeader("MONTHLY_STATS", rIdx, "Late_Mins", lateMinsTotal);
        updateCellByHeader("MONTHLY_STATS", rIdx, "Early_Mins", earlyMinsTotal); 
        updateCellByHeader("MONTHLY_STATS", rIdx, "Late_Count", lateCountTotal); 
        updateCellByHeader("MONTHLY_STATS", rIdx, "Early_Count", earlyCountTotal);
        updateCellByHeader("MONTHLY_STATS", rIdx, "Error_Count", errorCount);
        updateCellByHeader("MONTHLY_STATS", rIdx, "Leave_Days", approvedLeaveDaysInMonth);
        updateCellByHeader("MONTHLY_STATS", rIdx, "Remaining_Leave", remainingLeave);
        updateCellByHeader("MONTHLY_STATS", rIdx, "Standard_Days", standardDays);
        updateCellByHeader("MONTHLY_STATS", rIdx, "Last_Updated", lastUpdated);
      } else {
        statsSheet.appendRow([
          keyId, empId, currentMonth, currentYear,
          totalWorkDays, lateMinsTotal, earlyMinsTotal, lateCountTotal, earlyCountTotal,
          errorCount, approvedLeaveDaysInMonth, remainingLeave, standardDays, lastUpdated
        ]);
      }
    });
    console.log("Đã cập nhật Stats: Full Option");
  } catch (e) {
    console.error("Lỗi updateMonthlyStats: " + e.toString());
  } finally {
    lock.releaseLock();
  }
}

function RUN_standardizeSystem() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let log = [];

  try {
    const sheetPayroll = ss.getSheetByName("PAYROLL_PROFILE");
    if (sheetPayroll) {
      const headers = sheetPayroll.getRange(1, 1, 1, sheetPayroll.getLastColumn()).getValues()[0];
      const badHeaderIndex = headers.indexOf("Bank Account"); 
      if (badHeaderIndex > -1) {
        sheetPayroll.getRange(1, badHeaderIndex + 1).setValue("Bank_Account");
        log.push("✅ PAYROLL_PROFILE: Đã đổi 'Bank Account' -> 'Bank_Account'");
      }
    }

    const sheetLoc = ss.getSheetByName(SHEETS.LOCATIONS);
    if (sheetLoc) {
      const data = sheetLoc.getDataRange().getValues();
      const headers = data[0];
      const latCol = headers.indexOf("Latitude");
      const lngCol = headers.indexOf("Longitude");

      if (latCol > -1 && lngCol > -1) {
        sheetLoc.getRange(2, latCol + 1, sheetLoc.getLastRow(), 2).setNumberFormat("0.000000");
        for (let i = 1; i < data.length; i++) {
          let lat = data[i][latCol];
          let lng = data[i][lngCol];
          let newLat = cleanCoordinate(lat);
          let newLng = cleanCoordinate(lng);
          if (newLat !== lat || newLng !== lng) {
            sheetLoc.getRange(i + 1, latCol + 1).setValue(newLat);
            sheetLoc.getRange(i + 1, lngCol + 1).setValue(newLng);
          }
        }
        log.push(`✅ CONFIG_LOCATIONS: Đã chuẩn hóa tọa độ cho ${data.length - 1} địa điểm.`);
      }
    }

    const sheetAtt = ss.getSheetByName(SHEETS.ATTENDANCE);
    if (sheetAtt) {
      const data = sheetAtt.getDataRange().getValues();
      const headers = data[0];
      const latCol = headers.indexOf("Checkin_Lat");
      const lngCol = headers.indexOf("Checkin_Lng");

      if (latCol > -1 && lngCol > -1) {
         sheetAtt.getRange(2, latCol + 1, sheetAtt.getLastRow(), 2).setNumberFormat("0.000000");
         let fixCount = 0;
         for (let i = 1; i < data.length; i++) {
           let lat = data[i][latCol];
           let lng = data[i][lngCol];
           if (String(lat).includes(",") || String(lat).includes('"') || Math.abs(parseFloat(lat)) > 180) {
              let newLat = cleanCoordinate(lat);
              let newLng = cleanCoordinate(lng);
              sheetAtt.getRange(i + 1, latCol + 1).setValue(newLat);
              sheetAtt.getRange(i + 1, lngCol + 1).setValue(newLng);
              fixCount++;
           }
         }
         log.push(`✅ ATTENDANCE: Đã sửa lỗi định dạng tọa độ cho ${fixCount} dòng.`);
      }
    }

    if (log.length === 0) log.push("Hệ thống sạch sẽ! Không tìm thấy lỗi cần sửa.");
    SpreadsheetApp.getUi().alert("KẾT QUẢ CHUẨN HÓA:\n\n" + log.join("\n"));
  } catch (e) {
    SpreadsheetApp.getUi().alert("LỖI: " + e.toString());
  }
}

// ==============================================
// 10. CACHE ENGINE (TỐI ƯU HÓA TỐC ĐỘ - HARDCODE INDEX)
// ==============================================

const CACHE_MAP = {
  "Employee_ID": 1,
  "Requests_JSON": 2,
  "History_JSON": 3,
  "Noti_JSON": 4,
  "Contacts_JSON": 5, // [NEW] Cột Cache Danh bạ
  "Last_Updated": 6
};

/**
 * Helper: Đảm bảo Sheet Cache tồn tại
 */
function cache_ensureSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEETS.CACHE);
  if (!sheet) {
    sheet = ss.insertSheet(SHEETS.CACHE);
    sheet.appendRow(["Employee_ID", "Requests_JSON", "History_JSON", "Noti_JSON", "Contacts_JSON", "Last_Updated"]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function cache_get(employeeId, fieldName) {
  try {
    const colIndex = CACHE_MAP[fieldName];
    if (!colIndex) return null;

    const cacheSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.CACHE);
    if (!cacheSheet) return null;

    const finder = cacheSheet.createTextFinder(String(employeeId).trim());
    const found = finder.findNext();
    
    if (!found) return null;
    
    const cellValue = cacheSheet.getRange(found.getRow(), colIndex).getValue();
    if (!cellValue || cellValue === "") return null;
    return JSON.parse(cellValue);
  } catch (e) {
    console.warn("Cache Miss/Error: " + e.toString());
    return null;
  }
}

function cache_set(employeeId, fieldName, dataObj) {
  try {
    const colIndex = CACHE_MAP[fieldName];
    if (!colIndex) return;

    const cacheSheet = cache_ensureSheet();
    const finder = cacheSheet.createTextFinder(String(employeeId).trim());
    let found = finder.findNext();
    let row;
    
    if (found) {
      row = found.getRow();
    } else {
      row = cacheSheet.getLastRow() + 1;
      cacheSheet.getRange(row, 1).setValue(String(employeeId).trim());
    }
    
    const jsonString = JSON.stringify(dataObj);
    cacheSheet.getRange(row, colIndex).setValue(jsonString);
    cacheSheet.getRange(row, CACHE_MAP["Last_Updated"]).setValue(new Date());

  } catch (e) {
    console.error("Cache Write Error: " + e.toString());
  }
}

// --- INVALIDATION HELPERS ---

function cache_rebuildUserRequest(employeeId) {
  const fresh = _getMyRequestsRaw(employeeId);
  cache_set(employeeId, "Requests_JSON", fresh);
}

function cache_rebuildUserHistory(employeeId) {
  const fresh = _getHistoryRaw(employeeId);
  cache_set(employeeId, "History_JSON", fresh);
}

function cache_rebuildUserNoti(employeeId) {
  // Gọi lại hàm xử lý logic gốc (hàm mà bạn đã dùng để lọc đơn cho Staff/Manager)
  const notiData = _getMobileNotificationsRaw(employeeId);
  
  if (notiData.success) {
    // Ghi đè trực tiếp vào SYS_CACHE
    cache_set(employeeId, "Noti_JSON", notiData.data);
    // Cập nhật flag quản lý nếu cần
    // cache_set(employeeId, "Is_Manager", notiData.isManager); 
  }
}

// ==============================================
// 11. CRON JOB: REBUILD ALL CACHE
// ==============================================

function rebuildAllCache() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const empSheet = ss.getSheetByName(SHEETS.EMPLOYEES);
  const cacheSheet = cache_ensureSheet();
  
  if (!empSheet) return;
  
  const empData = empSheet.getDataRange().getValues();
  const headers = empData[0];
  const idIdx = headers.indexOf("Employee_ID");
  if (idIdx === -1) return;

  if (cacheSheet.getLastRow() > 1) {
    cacheSheet.getRange(2, 1, cacheSheet.getLastRow() - 1, cacheSheet.getLastColumn()).clearContent();
  }

  const cacheRows = [];
  const now = new Date();

  // 1. REBUILD USER CACHE
  for (let i = 1; i < empData.length; i++) {
    const empId = String(empData[i][idIdx]).trim();
    if (!empId) continue;
    
    try {
      const reqData = _getMyRequestsRaw(empId);
      const histData = _getHistoryRaw(empId);
      const notiData = _getMobileNotificationsRaw(empId);
      
      cacheRows.push([
        empId,
        JSON.stringify(reqData),
        JSON.stringify(histData),
        JSON.stringify(notiData),
        "", 
        now
      ]);
    } catch (e) {
      console.error(`Error User Cache ${empId}: ${e.toString()}`);
    }
  }

  // 2. REBUILD CONTACTS CACHE
  try {
    const adminContacts = _getContactsRaw("Admin", "");
    cacheRows.push([
      "SYS_CONTACTS_ALL", "", "", "", 
      JSON.stringify(adminContacts), 
      now
    ]);

    const locations = getData(SHEETS.LOCATIONS);
    locations.forEach(loc => {
       const cId = String(loc["Location_ID"]).trim();
       if(cId) {
         const centerContacts = _getContactsRaw("Staff", cId);
         cacheRows.push([
            "SYS_CONTACTS_" + cId, "", "", "",
            JSON.stringify(centerContacts),
            now
         ]);
       }
    });
  } catch(e) {
     console.error("Error Contact Cache: " + e.toString());
  }

  if (cacheRows.length > 0) {
    cacheSheet.getRange(2, 1, cacheRows.length, 6).setValues(cacheRows);
  }
  
  console.log("Rebuild All Cache (User + Contacts) Completed!");
}

// ==============================================
// 12. API GATEWAY CHO VERCEL (EXTERNAL FRONTEND)
// ==============================================

function doPost(e) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  try {
    if (!e.postData || !e.postData.contents) {
      throw new Error("No data received");
    }

    const requestBody = JSON.parse(e.postData.contents);
    const action = requestBody.action;       
    const params = requestBody.params || []; 

    let result;

    if (typeof this[action] === "function") {
      result = this[action].apply(this, params);
    } else {
      result = { success: false, message: "Function not found or invalid: " + action };
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    const errorResponse = {
      success: false,
      message: "Server Error: " + err.toString()
    };
    return ContentService.createTextOutput(JSON.stringify(errorResponse))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doOptions(e) {
  return ContentService.createTextOutput("")
    .setMimeType(ContentService.MimeType.TEXT)
    .append("CORS OK");
}
