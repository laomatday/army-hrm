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
}

export interface Attendance {
  id?: string; // document id: employee_id_YYYY-MM-DD
  date: string; // YYYY-MM-DD
  employee_id: string;
  name: string;
  center_id: string;
  shift_start: string;
  shift_end: string;
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
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  note?: string; // Ghi chú của quản lý
  manager_note?: string;
}

export interface LocationConfig {
  id?: string;
  location_id: string; // center_id
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
}

export interface DashboardData {
  userProfile: Employee;
  history: {
    history: Attendance[]; // Raw list
    summary: {
        workDays: number;
        lateMins: number;
        leaveDays: number;
        remainingLeave: number;
        standardDays: number;
        errorCount: number;
    };
  };
  notifications: {
    approvals: LeaveRequest[];
    myRequests: LeaveRequest[];
  };
  myRequests: LeaveRequest[];
  locations: LocationConfig[];
  contacts: Employee[];
  holidays: HolidayConfig[];
  systemConfig: SystemConfig;
}