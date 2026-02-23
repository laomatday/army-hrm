export const COLLECTIONS = {
  EMPLOYEES: "employees",
  ATTENDANCE: "attendance",
  LOCATIONS: "config_locations",
  LEAVE: "leave_requests",
  EXPLANATIONS: "explanations",
  SHIFTS: "config_shifts",
  HOLIDAYS: "config_holidays",
  SYSTEM: "config_system",
  MONTHLY_STATS: "monthly_stats",
  NOTIFICATIONS: "user_notifications"
};

export const GLOBAL_ADMINS = ["Admin", "HR", "Board", "Accountant"];
export const MANAGERS = ["Manager"];
export const PRIVILEGED_ROLES = [...GLOBAL_ADMINS, ...MANAGERS];

// ADDED: The missing LOGO_URL constant
export const LOGO_URL = "https://lh3.googleusercontent.com/d/1r_FuqN4QJbch0FYXAwX8efW9s0ucreiO=w500";
