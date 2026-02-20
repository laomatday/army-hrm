export interface Employee {
  id?: string;
  employee_id: string; // Khóa chính
  name: string;
  email: string;
  password?: string | number;
  role: string; // "Manager", "Staff", "Admin"
  center_id: string;
  position: string;
  department: string;
  phone: string | number;
  annual_leave_balance: number;
  face_ref_url: string; // Avatar
  trusted_device_id: string;
  status: 'Active' | 'Inactive';
  direct_manager_id?: string;
  join_date?: string;
  theme_color?: string;
  fcm_tokens?: string[];
}

export interface Attendance {
  id?: string; // document id: employee_id_YYYY-MM-DD
  date: string; // YYYY-MM-DD
  employee_id: string;
  name: string;
  center_id: string;
  shift_name?: string;
  shift_start?: string;
  shift_end?: string;
  time_in: string; // HH:mm
  time_out: string; // HH:mm
  checkin_type: 'GPS' | 'Manual';
  checkin_lat: number;
  checkin_lng: number;
  distance_meters: number;
  device_id: string;
  selfie_url: string;
  late_minutes: number;
  early_minutes: number;
  work_hours: number;
  status: 'Valid' | 'Late' | 'Invalid';
  is_valid: 'Yes' | 'No';
  note: string;
  timestamp: number; // Dùng để sort client-side nếu cần
  last_updated?: string;
  checkout_lat?: number;
  checkout_lng?: number;
  checkout_distance?: number;
  
  // New fields for Pause/Resume logic
  break_start?: string | null; // ISO string timestamp when pause started
  total_break_mins?: number; // Total minutes accumulated in breaks
}

export interface LeaveRequest {
  id?: string; // Firestore Doc ID
  request_id: string;
  employee_id: string;
  name: string;
  created_at: string; // ISO String
  type: string;
  from_date: string; // YYYY-MM-DD
  to_date: string; // YYYY-MM-DD
  expiration_date?: string; // YYYY-MM-DD
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  note?: string; // Ghi chú của quản lý
  manager_note?: string;
}

export interface Explanation {
  id?: string;
  employee_id: string;
  name: string;
  date: string; // The date being explained (YYYY-MM-DD)
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  created_at: string;
  manager_note?: string;
}

export interface UserNotification {
  id?: string;
  employee_id: string;
  title: string;
  body: string;
  type: 'info' | 'success' | 'warning' | 'error';
  is_read: boolean;
  created_at: string;
  link?: string;
}

export interface LocationConfig {
  id?: string;
  center_id: string; // Changed from location_id to match DB schema
  location_name: string; // name
  name?: string; // alias for location_name in code
  latitude: number;
  longitude: number;
  radius_meters: number;
}

export interface ShiftConfig {
    name: string;
    start: string; // start_time in DB
    end: string;   // end_time in DB
    break_point: string; // logic point to determine shift
}

export interface HolidayConfig {
    name: string;
    from_date: string;
    to_date: string;
}

export interface SystemConfig {
    LATE_TOLERANCE: number;
    MIN_HOURS_FULL: number;
    MIN_HOURS_HALF: number;
    LUNCH_START: string;
    LUNCH_END: string;
    OFF_DAYS: number[]; // 0=Sun, 6=Sat
    MAX_DISTANCE_METERS: number;
    LOCK_DATE?: number;
}

// Cấu trúc bảng thống kê tháng (Updated to match api.ts implementation)
export interface MonthlyStats {
  key_id: string;        // ID định danh: NV001_2023-10
  employee_id: string;   // Mã nhân viên
  
  // --- THÔNG TIN THỜI GIAN ---
  month: number;         
  year: number;          
  
  // --- SỐ LIỆU SỐ NGÀY CÔNG HÀNG THÁNG ---
  standard_days: number;   // Công chuẩn (Không tính ngày nghỉ tuần)
  work_days: number;  // Tổng công thực tế (Work + Paid Leave + Holiday)

  // --- CHI TIẾT ---
  late_mins: number;   // Tổng phút trễ
  late_count: number;           // Số lần trễ
  early_mins: number;  // Tổng phút về sớm (used for backward compatibility)
  early_leave_minutes?: number; // Explicit field for early leave minutes
  early_count: number;
  error_count: number;          // Số lỗi check-in/out (thiếu checkout)
  
  leave_days: number;      // Số ngày nghỉ phép có lương
  remaining_leave: number;

  // --- META DATA ---
  last_updated: string; 
}

export interface Kiosk {
  id?: string;
  name: string;
  kiosk_id: string; // Unique identifier (e.g., KIOSK_01)
  center_id: string; // Location associated with this Kiosk
  status: 'Active' | 'Inactive';
  created_at: string;
  description?: string;
}

export interface DashboardData {
  userProfile: Employee;
  history: {
    history: Attendance[]; // Raw list for calendar view
    summary: {
        workDays: number;     // Mapped from work_days
        lateMins: number;     // Mapped from late_mins
        leaveDays: number;    // Mapped from leave_days
        remainingLeave: number;
        standardDays: number; // Mapped from standard_days
        errorCount: number;   // Mapped from error_count
    };
  };
  notifications: {
    approvals: LeaveRequest[];
    explanationApprovals: Explanation[];
    myRequests: LeaveRequest[];
    myExplanations: Explanation[];
  };
  myRequests: LeaveRequest[];
  myExplanations: Explanation[];
  teamLeaves: LeaveRequest[];
  locations: LocationConfig[];
  contacts: Employee[];
  holidays: HolidayConfig[];
  shifts: ShiftConfig[];
  systemConfig: SystemConfig;
}