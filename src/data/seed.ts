import {
  AppState,
  AvailabilityRow,
  Branch,
  ComplianceDiffItem,
  ComplianceReport,
  Employee,
  PlannedEmployeeDay,
  ShiftScheduleConfig,
  ShiftType,
} from '../types';

export const DAY_NAMES_AR = [
  'الأحد',
  'الإثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
  'السبت',
] as const;

export const WEEK_ORDER_SAT_FRI = [6, 0, 1, 2, 3, 4, 5] as const;

export const MONTHS_AR = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
] as const;

export const SHIFTS_AR: Record<ShiftType, string> = {
  morning: 'صباحي',
  evening: 'مسائي',
  between: 'بتوين',
};

export const SHIFT_FULL_AR: Record<ShiftType, string> = {
  morning: 'الوردية الصباحية',
  between: 'وردية بتوين',
  evening: 'الوردية المسائية',
};

export const SHIFT_START_DESC: Record<ShiftType, string> = {
  morning: '07:00 ص — 05:00 م',
  between: '10:00 ص — 11:00 م',
  evening: '04:00 م — 02:00 ص',
};

export const UNAVAILABLE_REASONS = [
  'إجازة أسبوعية حسب الخطة',
  'إجازة شهرية حسب الخطة',
  'إجازة رسمية',
  'مرض طارئ',
  'إذن شخصي',
  'غياب بدون إذن',
] as const;

export const DEFAULT_SHIFT_SCHEDULES: Record<ShiftType, ShiftScheduleConfig> = {
  morning: { label: 'الوردية الصباحية', tin: '07:00', tout: '17:00' },
  between: { label: 'بتوين', tin: '10:00', tout: '23:00' },
  evening: { label: 'الوردية المسائية', tin: '16:00', tout: '02:00' },
};

export const ADMIN_PIN = '0000';
export const STORE_KEY = 'roast_shift_unified_v5';

export const BRANCH_NAMES = [
  'الصنادلي',
  'ميدان لبنان',
  'مراد',
  'حسن محمد',
  'رمسيس',
  'المريوطية',
  'العشرين',
  'البحوث',
] as const;

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function normalizeDigits(input: string): string {
  return input
    .replace(/[\u0660-\u0669]/g, (c) => String(c.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (c) => String(c.charCodeAt(0) - 0x06f0))
    .replace(/[\s\u200E\u200F\u202A-\u202E]/g, '')
    .trim();
}

export function getCairoToday(): { year: number; month: number; day: number; iso: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const y = Number(parts.find((p) => p.type === 'year')?.value || 2026);
  const m = Number(parts.find((p) => p.type === 'month')?.value || 1);
  const d = Number(parts.find((p) => p.type === 'day')?.value || 1);
  return { year: y, month: m - 1, day: d, iso: `${y}-${pad2(m)}-${pad2(d)}` };
}

export function parseIsoParts(iso: string): { year: number; month0: number; day: number } {
  const [y, m, d] = iso.split('-').map(Number);
  return { year: y || 2026, month0: (m || 1) - 1, day: d || 1 };
}

export function addDaysIso(isoDate: string, offset: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + offset));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

export function fmtDateAr(iso: string | null | undefined): string {
  if (!iso) return '--';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${DAY_NAMES_AR[dow]} ${d} ${MONTHS_AR[m - 1]}`;
}

export function formatTime12(t: string): string {
  if (!t) return '--:--';
  const [hRaw, m] = t.split(':').map(Number);
  let h = hRaw % 12;
  if (h === 0) h = 12;
  return `${pad2(h)}:${pad2(m || 0)} ${hRaw >= 12 ? 'م' : 'ص'}`;
}

export function submissionKey(branchId: string, shift: ShiftType, shiftDate: string): string {
  return `${branchId}|${shift}|${shiftDate}`;
}

export function overrideKey(branchId: string, isoDate: string): string {
  return `${branchId}|${isoDate}`;
}

export function getSatToFriWeek(anchorIso: string): {
  iso: string;
  year: number;
  month0: number;
  day: number;
  dayOfWeek: number;
  arName: string;
  shortDate: string;
}[] {
  const [y, m, d] = anchorIso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = dt.getUTCDay();
  const diffFromSat = (dow + 1) % 7;
  const satIso = addDaysIso(anchorIso, -diffFromSat);
  const res = [];
  for (let i = 0; i < 7; i++) {
    const iso = addDaysIso(satIso, i);
    const [iy, im, id] = iso.split('-').map(Number);
    const idow = new Date(Date.UTC(iy, im - 1, id)).getUTCDay();
    res.push({
      iso,
      year: iy,
      month0: im - 1,
      day: id,
      dayOfWeek: idow,
      arName: DAY_NAMES_AR[idow],
      shortDate: `${id}/${im}`,
    });
  }
  return res;
}

/**
 * Keeps day names fixed (السبت ← الجمعة) while each day's date automatically
 * rolls forward as a circular queue starting from today's Cairo date.
 */
export function getRollingWeekQueue(todayIso: string): {
  iso: string;
  year: number;
  month0: number;
  day: number;
  dayOfWeek: number;
  arName: string;
  shortDate: string;
  offsetFromToday: number;
}[] {
  const [y, m, d] = todayIso.split('-').map(Number);
  const todayDow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return WEEK_ORDER_SAT_FRI.map((dow) => {
    const offsetFromToday = (dow - todayDow + 7) % 7;
    const iso = addDaysIso(todayIso, offsetFromToday);
    const [iy, im, id] = iso.split('-').map(Number);
    return {
      iso,
      year: iy,
      month0: im - 1,
      day: id,
      dayOfWeek: dow,
      arName: DAY_NAMES_AR[dow],
      shortDate: `${id}/${im}`,
      offsetFromToday,
    };
  });
}

export function createSeedState(): AppState {
  const firstNames = ['أحمد', 'محمد', 'يوسف', 'كريم', 'عمر', 'مصطفى', 'طارق', 'خالد'];
  const lastNames = ['علي', 'سعيد', 'حسن', 'عادل', 'ناصر', 'سالم', 'إبراهيم', 'فتحي'];

  // Balanced realistic roster per branch:
  // Morning: 4 employees (3 planned available most days, 1 rotating weekly off)
  // Evening: 4 employees
  // Between: 1 employee
  const templateRoster: Array<{
    shift: ShiftType;
    weeklyOffDay: number | null;
  }> = [
    { shift: 'morning', weeklyOffDay: 5 },
    { shift: 'morning', weeklyOffDay: 4 },
    { shift: 'morning', weeklyOffDay: 6 },
    { shift: 'morning', weeklyOffDay: 2 },
    { shift: 'between', weeklyOffDay: 1 },
    { shift: 'evening', weeklyOffDay: 0 },
    { shift: 'evening', weeklyOffDay: 3 },
    { shift: 'evening', weeklyOffDay: 5 },
    { shift: 'evening', weeklyOffDay: 4 },
  ];

  const tomorrowIso = addDaysIso(getCairoToday().iso, 1);

  const branches: Branch[] = BRANCH_NAMES.map((name, bIdx) => {
    const emps: Employee[] = templateRoster.map((tpl, eIdx) => {
      const fname = firstNames[(bIdx + eIdx) % firstNames.length];
      const lname = lastNames[(bIdx * 2 + eIdx) % lastNames.length];
      return {
        id: `e_${bIdx + 1}_${eIdx + 1}`,
        name: `${fname} ${lname}`,
        shift: tpl.shift,
        suspended: false,
        weeklyOffDay: tpl.weeklyOffDay,
        extraOffDay1: null,
        extraOffDay2: null,
        monthlyLeaves: [],
      };
    });

    // Vary required headcounts slightly so Admin control room naturally shows deficit/surplus/stable examples once branches submit
    return {
      id: `b${bIdx + 1}`,
      name,
      pin: `1234${bIdx + 1}`,
      requiredByShift: {
        morning: bIdx === 1 ? 4 : bIdx === 2 ? 2 : 3,
        between: 1,
        evening: 3,
      },
      emps,
      shiftSchedules: {
        morning: { ...DEFAULT_SHIFT_SCHEDULES.morning },
        between: { ...DEFAULT_SHIFT_SCHEDULES.between },
        evening: { ...DEFAULT_SHIFT_SCHEDULES.evening },
      },
    };
  });

  // Pre-seed two neighboring branches' morning submissions for tomorrow so Admin Control Room feels alive (surplus/deficit),
  // while Branch 1 (الصنادلي) remains unsubmitted for the manager / guided tour to test live.
  const seedBase: AppState = {
    adminPin: ADMIN_PIN,
    branches,
    dailyOverrides: {},
    submissions: {},
    emergencyNotices: [],
    transferNotices: [],
    notifications: [],
    audit: [],
  };

  // Pre-seed Branch 3 (مراد - surplus 4/2) and Branch 2 (ميدان لبنان - deficit 2/4) for tomorrow morning
  ['b2', 'b3'].forEach((bId) => {
    const plan = computeDayPlanForBranch(seedBase, bId, tomorrowIso);
    const shiftEmps = plan.filter(
      (p) =>
        p.plannedShift === 'morning' ||
        p.plannedShift === 'between' ||
        (p.plannedShift === 'off' &&
          (p.emp.shift === 'morning' || p.emp.shift === 'between'))
    );
    const rows: AvailabilityRow[] = shiftEmps.map((p, idx) => {
      if (bId === 'b2' && idx < 2) {
        return {
          empId: p.emp.id,
          empName: p.emp.name,
          status: 'unavailable',
          reason: idx === 0 ? 'مرض طارئ' : 'إجازة رسمية',
        };
      }
      const workingHere = p.plannedShift === 'morning' || p.plannedShift === 'between';
      return {
        empId: p.emp.id,
        empName: p.emp.name,
        status: workingHere ? 'available' : 'unavailable',
        reason: workingHere ? null : p.reason,
      };
    });
    const compliance = evaluateAvailabilityCompliance(seedBase, bId, 'morning', tomorrowIso, rows);
    const key = submissionKey(bId, 'morning', tomorrowIso);
    seedBase.submissions[key] = {
      key,
      branchId: bId,
      shift: 'morning',
      shiftDate: tomorrowIso,
      submittedAt: '08:15 م',
      rows,
      compliance,
    };
  });

  return seedBase;
}

export function loadState(): AppState {
  const seed = createSeedState();
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppState>;
      if (
        parsed &&
        Array.isArray(parsed.branches) &&
        parsed.branches.length > 0 &&
        parsed.branches.every(
          (b) => b && b.id && b.pin && Array.isArray(b.emps) && b.shiftSchedules && b.requiredByShift
        )
      ) {
        return {
          adminPin:
            typeof parsed.adminPin === 'string' && parsed.adminPin.trim()
              ? parsed.adminPin.trim()
              : ADMIN_PIN,
          branches: parsed.branches,
          dailyOverrides:
            parsed.dailyOverrides && typeof parsed.dailyOverrides === 'object'
              ? parsed.dailyOverrides
              : {},
          submissions:
            parsed.submissions && typeof parsed.submissions === 'object'
              ? parsed.submissions
              : {},
          emergencyNotices: Array.isArray(parsed.emergencyNotices) ? parsed.emergencyNotices : [],
          transferNotices: Array.isArray(parsed.transferNotices) ? parsed.transferNotices : [],
          notifications: Array.isArray(parsed.notifications) ? parsed.notifications : [],
          audit: Array.isArray(parsed.audit) ? parsed.audit : [],
        };
      }
    }
  } catch {
    // ignore storage errors
  }
  return seed;
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage errors
  }
}

export function computeDayPlanForBranch(
  state: AppState,
  branchId: string,
  isoDate: string
): PlannedEmployeeDay[] {
  const branch = state.branches.find((b) => b.id === branchId);
  if (!branch) return [];

  const { year, month0, day } = parseIsoParts(isoDate);
  const dow = new Date(Date.UTC(year, month0, day)).getUTCDay();
  const overrides = state.dailyOverrides[overrideKey(branchId, isoDate)] || {};
  const weekIsoSet = new Set(getSatToFriWeek(isoDate).map((d) => d.iso));

  return branch.emps
    .filter((e) => !e.suspended)
    .map((emp) => {
      const ov = overrides[emp.id];

      const activeMonthly = (emp.monthlyLeaves || []).find((ml) => {
        const endIso = addDaysIso(ml.startDate, Math.max(0, ml.daysCount - 1));
        return isoDate >= ml.startDate && isoDate <= endIso;
      });

      const suppressWeekly = (emp.monthlyLeaves || []).some((ml) => {
        if (!ml.skipWeeklyInSameWeek) return false;
        for (let i = 0; i < ml.daysCount; i++) {
          if (weekIsoSet.has(addDaysIso(ml.startDate, i))) return true;
        }
        return false;
      });

      const isWeeklyOff =
        !suppressWeekly &&
        (emp.weeklyOffDay === dow || emp.extraOffDay1 === dow || emp.extraOffDay2 === dow);

      let plannedShift: ShiftType | 'off' = emp.shift;
      let reason = 'عمل مجدول';
      let isMonthlyLeave = false;
      let isWeeklyLeave = false;
      let isOverridden = false;

      if (activeMonthly) {
        plannedShift = 'off';
        reason = `إجازة شهرية (${activeMonthly.daysCount} أيام)`;
        isMonthlyLeave = true;
      } else if (isWeeklyOff) {
        plannedShift = 'off';
        reason =
          emp.weeklyOffDay === dow
            ? 'إجازة أسبوعية'
            : emp.extraOffDay1 === dow
            ? 'إجازة إضافية 1'
            : 'إجازة ثالثة';
        isWeeklyLeave = true;
      }

      if (ov) {
        isOverridden = true;
        if (ov.shift !== undefined) {
          plannedShift = ov.shift;
          reason = ov.shift === 'off' ? 'إجازة يومية (تعديل)' : 'تعديل يومي';
        }
      }

      return {
        emp,
        plannedShift,
        reason,
        isOverridden,
        isMonthlyLeave,
        isWeeklyLeave,
      };
    });
}

export function buildPlannedRowsForShift(
  state: AppState,
  branchId: string,
  shift: ShiftType,
  isoDate: string
): AvailabilityRow[] {
  const plan = computeDayPlanForBranch(state, branchId, isoDate);
  const includesBetween = shift === 'morning' || shift === 'evening';
  const relevant = plan.filter(
    (p) =>
      p.plannedShift === shift ||
      (includesBetween && p.plannedShift === 'between') ||
      (p.plannedShift === 'off' &&
        (p.emp.shift === shift || (includesBetween && p.emp.shift === 'between')))
  );
  return relevant.map((p) => {
    const isWorking =
      p.plannedShift === shift || (includesBetween && p.plannedShift === 'between');
    return {
      empId: p.emp.id,
      empName: p.emp.name,
      status: isWorking ? 'available' : 'unavailable',
      reason: isWorking
        ? null
        : p.isMonthlyLeave
        ? 'إجازة شهرية حسب الخطة'
        : p.isWeeklyLeave
        ? 'إجازة أسبوعية حسب الخطة'
        : 'إجازة رسمية',
    };
  });
}

/**
 * Compares what the Branch Manager submitted for tomorrow's shift against
 * the branch's Weekly Shift Plan (oast-shift) for tomorrow's date.
 */
export function evaluateAvailabilityCompliance(
  state: AppState,
  branchId: string,
  shift: ShiftType,
  shiftDate: string,
  rows: AvailabilityRow[]
): ComplianceReport {
  const branch = state.branches.find((b) => b.id === branchId)!;
  const fullPlan = computeDayPlanForBranch(state, branchId, shiftDate);
  const rowMap = new Map(rows.map((r) => [r.empId, r]));
  const diffs: ComplianceDiffItem[] = [];
  const includesBetween = shift === 'morning' || shift === 'evening';

  const plannedInShift = fullPlan.filter(
    (p) => p.plannedShift === shift || (includesBetween && p.plannedShift === 'between')
  );
  const actualAvailable = rows.filter((r) => !r.movedOut && r.status === 'available').length;

  for (const p of fullPlan) {
    const r = rowMap.get(p.emp.id);
    const expectedWorking =
      p.plannedShift === shift || (includesBetween && p.plannedShift === 'between');
    const expectedOff =
      p.plannedShift === 'off' &&
      (p.emp.shift === shift || (includesBetween && p.emp.shift === 'between'));

    if (expectedWorking) {
      if (!r || r.status !== 'available') {
        const reasonTxt = r?.reason ? ` (${r.reason})` : '';
        diffs.push({
          empId: p.emp.id,
          empName: p.emp.name,
          type: 'missing',
          expected: `${SHIFTS_AR[p.plannedShift as ShiftType]} · حضور`,
          actual: `غير متاح${reasonTxt}`,
          summary: `${p.emp.name}: مجدول للعمل في الخطة، وأُرسل غير متاح${reasonTxt}`,
        });
      }
    } else if (expectedOff) {
      if (r && r.status === 'available') {
        diffs.push({
          empId: p.emp.id,
          empName: p.emp.name,
          type: 'on_leave_worked',
          expected: p.reason,
          actual: 'حضور',
          summary: `${p.emp.name}: مجدول في الخطة (${p.reason})، وأُرسل كـ متاح للعمل`,
        });
      }
    }
  }

  return {
    id: `cmp_${branchId}_${shift}_${shiftDate}`,
    branchId,
    branchName: branch.name,
    shift,
    shiftDate,
    submittedAt: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
    status: diffs.length === 0 ? 'matched' : 'mismatch',
    plannedCount: plannedInShift.length,
    actualCount: actualAvailable,
    diffs,
  };
}
