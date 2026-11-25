export type ShiftType = 'morning' | 'evening' | 'between';

export type BranchThemeMode = 'dark' | 'light';

export interface MonthlyLeave {
  id: string;
  recurringDayOfMonth?: number; // 1-31: repeats every month on this day
  startDate: string; // YYYY-MM-DD (used for fallback / reference)
  daysCount: number;
  skipWeeklyInSameWeek: boolean;
  note?: string;
}

export interface ShiftScheduleConfig {
  label: string;
  tin: string;
  tout: string;
}

export interface Employee {
  id: string;
  name: string;
  shift: ShiftType;
  suspended: boolean;
  weeklyOffDay: number | null; // 0=Sun..6=Sat
  extraOffDay1: number | null;
  extraOffDay2: number | null;
  monthlyLeaves: MonthlyLeave[];
}

export interface DailyOverride {
  shift?: ShiftType | 'off';
}

export interface Branch {
  id: string;
  name: string;
  pin: string;
  requiredByShift: Record<ShiftType, number>;
  emps: Employee[];
  shiftSchedules: Record<ShiftType, ShiftScheduleConfig>;
}

export interface PlannedEmployeeDay {
  emp: Employee;
  plannedShift: ShiftType | 'off';
  reason: string;
  isOverridden: boolean;
  isMonthlyLeave: boolean;
  isWeeklyLeave: boolean;
}

export interface AvailabilityRow {
  empId: string;
  empName: string;
  status: 'available' | 'unavailable';
  reason: string | null;
  emergency?: boolean;
  movedOut?: boolean;
  note?: string;
}

export interface ComplianceDiffItem {
  empId: string;
  empName: string;
  type: 'missing' | 'on_leave_worked';
  expected: string;
  actual: string;
  summary: string;
}

export interface ComplianceReport {
  id: string;
  branchId: string;
  branchName: string;
  shift: ShiftType;
  shiftDate: string; // YYYY-MM-DD (tomorrow)
  submittedAt: string;
  status: 'matched' | 'mismatch';
  plannedCount: number;
  actualCount: number;
  diffs: ComplianceDiffItem[];
}

export interface AvailabilitySubmission {
  key: string; // `${branchId}|${shift}|${shiftDate}`
  branchId: string;
  shift: ShiftType;
  shiftDate: string;
  submittedAt: string;
  rows: AvailabilityRow[];
  compliance: ComplianceReport;
  hasEdit?: boolean;
  lastEditAt?: string;
  lastEditSummary?: string;
}

export interface EmergencyNotice {
  id: string;
  branchId: string;
  branchName: string;
  shift: ShiftType;
  shiftDate: string;
  employeeId: string;
  employeeName: string;
  reason: string;
  time: string;
  acknowledged: boolean;
}

export interface TransferNotice {
  id: string;
  targetBranchId: string;
  shift: ShiftType;
  shiftDate: string;
  text: string;
  typeLabel: string;
  time: string;
  acknowledged: boolean;
}

export interface NotificationItem {
  id: string;
  kind: 'compliance_ok' | 'compliance_diff' | 'emergency' | 'transfer' | 'message';
  senderRole: 'branch' | 'central';
  senderName: string;
  recipientRole: 'branch' | 'central';
  recipientBranchId?: string;
  branchId: string;
  shift: ShiftType;
  shiftDate: string;
  text: string;
  time: string;
  read: boolean;
  messageId?: string;
  isEdit?: boolean;
  complianceReport?: ComplianceReport;
}

export interface ChatMessage {
  id: string;
  branchId: string;
  sender: 'branch' | 'admin' | 'system';
  kind: 'text' | 'availability' | 'emergency' | 'transfer';
  text: string;
  shift?: ShiftType;
  shiftDate?: string;
  submissionKey?: string;
  isEditedResend?: boolean;
  editSummary?: string;
  supersededByMsgId?: string;
  replyTo?: {
    id: string;
    senderLabel: string;
    snippet: string;
  };
  reaction?: string;
  audioNote?: {
    durationSeconds: number;
    audioUrl?: string;
  };
  time: string;
  readByAdmin: boolean;
  readByBranch: boolean;
}

export interface AuditItem {
  id: number | string;
  time: string;
  text: string;
}

export interface AppState {
  adminPin: string;
  branches: Branch[];
  /** Key: `${branchId}|${isoDate}` -> Record<empId, DailyOverride> */
  dailyOverrides: Record<string, Record<string, DailyOverride>>;
  /** Key: `${branchId}|${shift}|${isoDate}` */
  submissions: Record<string, AvailabilitySubmission>;
  emergencyNotices: EmergencyNotice[];
  transferNotices: TransferNotice[];
  notifications: NotificationItem[];
  messages: ChatMessage[];
  audit: AuditItem[];
}

export interface SessionState {
  role: 'central' | 'branch' | null;
  branchId: string | null;
  workspace: 'availability' | 'planner';
  branchScreen: 'home' | 'submit' | 'settings';
  activeShift: ShiftType;
  adminScreen: 'control' | 'settings';
  adminShift: ShiftType;
}
