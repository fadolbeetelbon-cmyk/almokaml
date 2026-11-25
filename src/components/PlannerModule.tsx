import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  CalendarDays,
  Clock,
  Edit3,
  Moon,
  Plus,
  Search,
  Send,
  Sun,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import {
  computeDayPlanForBranch,
  DAY_NAMES_AR,
  formatTime12,
  getCairoToday,
  getRollingWeekQueue,
  pad2,
  SHIFTS_AR,
} from '../data/seed';
import {
  AppState,
  Branch,
  Employee,
  MonthlyLeave,
  ShiftType,
} from '../types';
import { MonthlyLeaveDialModal, WeeklyOffDialModal } from './DateDialModal';

export type PlannerTab = 'hub' | 'today' | 'team';

interface PlannerModuleProps {
  state: AppState;
  branchId: string;
  isAdmin: boolean;
  externalTab?: { tab: PlannerTab; nonce: number } | null;
  onSelectBranch: (bId: string) => void;
  onUpdateState: (updater: (prev: AppState) => AppState) => void;
  onNotify: (msg: string) => void;
  onGoToAvailability?: (shift: ShiftType) => void;
  onBackToAdminChats?: () => void;
  onBackToBranchChats?: () => void;
}

export const PlannerModule: React.FC<PlannerModuleProps> = ({
  state,
  branchId,
  isAdmin,
  externalTab,
  onSelectBranch,
  onUpdateState,
  onNotify,
  onGoToAvailability,
  onBackToAdminChats,
  onBackToBranchChats,
}) => {
  const cairoToday = useMemo(() => getCairoToday(), []);
  const weekQueue = useMemo(() => getRollingWeekQueue(cairoToday.iso), [cairoToday.iso]);

  const [tab, setTab] = useState<PlannerTab>(isAdmin ? 'today' : 'today');
  const [selectedIso, setSelectedIso] = useState<string>(cairoToday.iso);
  const [editModalShift, setEditModalShift] = useState<'morning' | 'evening' | null>(null);

  React.useEffect(() => {
    if (externalTab) {
      setTab(isAdmin ? 'today' : externalTab.tab);
    }
  }, [externalTab?.nonce, externalTab?.tab, isAdmin]);

  const [teamSearch, setTeamSearch] = useState('');
  const [newEmpName, setNewEmpName] = useState('');
  const [newEmpShift, setNewEmpShift] = useState<ShiftType>('morning');
  const [newEmpOffDay, setNewEmpOffDay] = useState<number | null>(5);
  const [newEmpMonthlyDraft, setNewEmpMonthlyDraft] = useState<{
    dayOfMonth: number;
    daysCount: number;
    skipWeeklyInSameWeek: boolean;
  } | null>(null);

  const [weeklyDialTarget, setWeeklyDialTarget] = useState<
    { mode: 'new' } | { mode: 'emp'; empId: string } | null
  >(null);
  const [monthlyDialTarget, setMonthlyDialTarget] = useState<
    { mode: 'new' } | { mode: 'emp'; empId: string } | null
  >(null);
  const [leaveListEmpId, setLeaveListEmpId] = useState<string | null>(null);

  const branch: Branch =
    state.branches.find((b) => b.id === branchId) || state.branches[0];

  const activeDayObj = useMemo(() => {
    return weekQueue.find((d) => d.iso === selectedIso) || weekQueue[0];
  }, [weekQueue, selectedIso]);

  const activeDayPlan = useMemo(
    () => computeDayPlanForBranch(state, branch.id, activeDayObj.iso),
    [state, branch.id, activeDayObj.iso]
  );

  const dayGroups = useMemo(() => {
    const morningAvail = activeDayPlan.filter((p) => p.plannedShift === 'morning');
    const eveningAvail = activeDayPlan.filter((p) => p.plannedShift === 'evening');
    const betweenAvail = activeDayPlan.filter((p) => p.plannedShift === 'between');

    const morningOff = activeDayPlan.filter(
      (p) => p.plannedShift === 'off' && (p.emp.shift === 'morning' || p.emp.shift === 'between')
    );
    const eveningOff = activeDayPlan.filter(
      (p) => p.plannedShift === 'off' && (p.emp.shift === 'evening' || p.emp.shift === 'between')
    );
    const offAll = activeDayPlan.filter((p) => p.plannedShift === 'off');

    return {
      morningAvail,
      eveningAvail,
      betweenAvail,
      morningOff,
      eveningOff,
      totalWorking: morningAvail.length + eveningAvail.length + betweenAvail.length,
      totalOff: offAll.length,
    };
  }, [activeDayPlan]);

  const morningCfg = branch.shiftSchedules.morning;
  const eveningCfg = branch.shiftSchedules.evening;
  const betweenCfg = branch.shiftSchedules.between;

  const formatLeaveSummary = (ml: MonthlyLeave) => {
    const dLabel = ml.daysCount === 1 ? 'يوم' : ml.daysCount === 2 ? 'يومان' : `${ml.daysCount} أيام`;
    if (ml.recurringDayOfMonth) {
      return `يوم ${ml.recurringDayOfMonth} من كل شهر (${dLabel})`;
    }
    return `${ml.startDate} (${dLabel})`;
  };

  // =========================================================================
  // ADMIN READ-ONLY MODE (Kept intact in light mode)
  // =========================================================================
  if (isAdmin) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#d1d7db] bg-white p-4 shadow-xs">
          <div className="flex items-center gap-3">
            {onBackToAdminChats && (
              <button
                type="button"
                onClick={onBackToAdminChats}
                className="flex min-h-[38px] items-center gap-1.5 rounded-full border border-[#d1d7db] bg-[#f0f2f5] px-4 py-1.5 text-xs font-extrabold text-[#111b21] hover:bg-[#e9edef]"
              >
                <ArrowRight className="h-4 w-4 text-[#008069]" />
                <span>عودة للمحادثات</span>
              </button>
            )}
            <div>
              <div className="text-xs font-extrabold text-[#008069]">
                مراجعة خطة الفرع (للقراءة فقط)
              </div>
              <h2 className="mt-0.5 text-base font-extrabold text-[#111b21] sm:text-lg">
                فرع {branch.name} — {activeDayObj.arName} ({activeDayObj.shortDate})
              </h2>
            </div>
          </div>

          <select
            value={branch.id}
            onChange={(e) => onSelectBranch(e.target.value)}
            className="min-h-[42px] rounded-full border border-[#d1d7db] bg-[#f0f2f5] px-4 py-2 text-sm font-extrabold text-[#111b21] outline-none focus:border-[#008069]"
          >
            {state.branches.map((b) => (
              <option key={b.id} value={b.id}>
                فرع {b.name}
              </option>
            ))}
          </select>
        </div>

        <div className="rounded-2xl border border-[#d1d7db] bg-white p-2.5 shadow-xs sm:p-3">
          <div className="flex gap-1.5 overflow-x-auto pb-1 sm:grid sm:grid-cols-7 sm:pb-0">
            {weekQueue.map((wd) => {
              const isSel = wd.iso === activeDayObj.iso;
              const isToday = wd.offsetFromToday === 0;
              const isTomorrow = wd.offsetFromToday === 1;
              return (
                <button
                  key={wd.dayOfWeek}
                  type="button"
                  onClick={() => setSelectedIso(wd.iso)}
                  className={`min-w-[82px] shrink-0 rounded-xl border px-2.5 py-2 text-right transition-colors sm:min-w-0 ${
                    isSel
                      ? 'border-[#008069] bg-[#008069] text-white'
                      : 'border-[#e9edef] bg-[#f8fafc] text-[#111b21] hover:bg-[#f0f2f5]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 text-[11px] font-extrabold sm:text-xs">
                    <span>{wd.arName}</span>
                    {isToday && (
                      <span
                        className={`rounded px-1 py-0.5 text-[9px] sm:text-[10px] ${
                          isSel ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        اليوم
                      </span>
                    )}
                    {isTomorrow && (
                      <span
                        className={`rounded px-1 py-0.5 text-[9px] sm:text-[10px] ${
                          isSel ? 'bg-[#25d366] text-[#111b21]' : 'bg-[#e7fce3] text-[#008069]'
                        }`}
                      >
                        غداً
                      </span>
                    )}
                  </div>
                  <div
                    className={`font-mono-num mt-0.5 text-[10px] font-bold sm:text-[11px] ${
                      isSel ? 'text-white/85' : 'text-[#54656f]'
                    }`}
                  >
                    {wd.shortDate}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="mt-2 text-center text-[11px] font-bold text-[#54656f]">
            الأيام والتواريخ تتغير أوتوماتيك كل يوم حسب التقويم
          </div>
        </div>

        <div id="plannerDaySummary" className="grid grid-cols-2 gap-2 sm:gap-4">
          <div className="min-w-0 rounded-2xl border border-[#d1d7db] bg-white p-2.5 shadow-xs sm:p-5">
            <div className="mb-2.5 flex flex-wrap items-center justify-between gap-1.5 border-b border-[#e9edef] pb-2 sm:mb-3 sm:pb-3">
              <div className="flex min-w-0 items-center gap-1.5 sm:gap-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 sm:h-9 sm:w-9">
                  <Sun className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-xs font-extrabold text-[#111b21] sm:text-base">
                    صباحي
                  </h3>
                  <div className="font-mono-num truncate text-[10px] text-[#54656f] sm:text-xs">
                    {formatTime12(morningCfg.tin)} — {formatTime12(morningCfg.tout)}
                  </div>
                </div>
              </div>
              <span className="rounded-full bg-[#e7fce3] px-2 py-0.5 text-[10px] font-extrabold text-[#006e5a] sm:px-3 sm:py-1 sm:text-xs">
                {dayGroups.morningAvail.length + dayGroups.betweenAvail.length} متاح
              </span>
            </div>

            <div className="space-y-1.5 sm:space-y-2">
              {dayGroups.morningAvail.map((p) => (
                <div
                  key={p.emp.id}
                  className="flex items-center justify-between gap-1 rounded-xl border border-[#e9edef] bg-[#f8fafc] px-2 py-2 text-xs font-bold text-[#111b21] sm:px-3.5 sm:py-2.5 sm:text-sm"
                >
                  <span className="truncate">{p.emp.name}</span>
                  <span className="shrink-0 text-[10px] text-[#008069] sm:text-xs">حضور</span>
                </div>
              ))}
              {dayGroups.betweenAvail.map((p) => (
                <div
                  key={`${p.emp.id}_rm`}
                  className="flex items-center justify-between gap-1 rounded-xl border border-amber-200 bg-amber-50/50 px-2 py-2 text-xs font-bold text-[#111b21] sm:px-3.5 sm:py-2.5 sm:text-sm"
                >
                  <span className="truncate">{p.emp.name}</span>
                  <span className="shrink-0 text-[10px] text-amber-800 sm:text-xs">
                    بتوين {formatTime12(betweenCfg.tin)}
                  </span>
                </div>
              ))}
              {dayGroups.morningOff.map((p) => (
                <div
                  key={`${p.emp.id}_om`}
                  className="flex items-center justify-between gap-1 rounded-xl border border-rose-200 bg-rose-50/70 px-2 py-1.5 text-[11px] font-bold text-rose-900 sm:px-3.5 sm:py-2 sm:text-xs"
                >
                  <span className="truncate">{p.emp.name}</span>
                  <span className="shrink-0 text-[10px]">{p.reason}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="min-w-0 rounded-2xl border border-[#d1d7db] bg-white p-2.5 shadow-xs sm:p-5">
            <div className="mb-2.5 flex flex-wrap items-center justify-between gap-1.5 border-b border-[#e9edef] pb-2 sm:mb-3 sm:pb-3">
              <div className="flex min-w-0 items-center gap-1.5 sm:gap-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#008069] text-white sm:h-9 sm:w-9">
                  <Moon className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-xs font-extrabold text-[#111b21] sm:text-base">
                    مسائي
                  </h3>
                  <div className="font-mono-num truncate text-[10px] text-[#54656f] sm:text-xs">
                    {formatTime12(eveningCfg.tin)} — {formatTime12(eveningCfg.tout)}
                  </div>
                </div>
              </div>
              <span className="rounded-full bg-[#e7fce3] px-2 py-0.5 text-[10px] font-extrabold text-[#006e5a] sm:px-3 sm:py-1 sm:text-xs">
                {dayGroups.eveningAvail.length + dayGroups.betweenAvail.length} متاح
              </span>
            </div>

            <div className="space-y-1.5 sm:space-y-2">
              {dayGroups.eveningAvail.map((p) => (
                <div
                  key={p.emp.id}
                  className="flex items-center justify-between gap-1 rounded-xl border border-[#e9edef] bg-[#f8fafc] px-2 py-2 text-xs font-bold text-[#111b21] sm:px-3.5 sm:py-2.5 sm:text-sm"
                >
                  <span className="truncate">{p.emp.name}</span>
                  <span className="shrink-0 text-[10px] text-[#008069] sm:text-xs">حضور</span>
                </div>
              ))}
              {dayGroups.betweenAvail.map((p) => (
                <div
                  key={`${p.emp.id}_re`}
                  className="flex items-center justify-between gap-1 rounded-xl border border-amber-200 bg-amber-50/50 px-2 py-2 text-xs font-bold text-[#111b21] sm:px-3.5 sm:py-2.5 sm:text-sm"
                >
                  <span className="truncate">{p.emp.name}</span>
                  <span className="shrink-0 text-[10px] text-amber-800 sm:text-xs">
                    بتوين حتى {formatTime12(betweenCfg.tout)}
                  </span>
                </div>
              ))}
              {dayGroups.eveningOff.map((p) => (
                <div
                  key={`${p.emp.id}_oe`}
                  className="flex items-center justify-between gap-1 rounded-xl border border-rose-200 bg-rose-50/70 px-2 py-1.5 text-[11px] font-bold text-rose-900 sm:px-3.5 sm:py-2 sm:text-xs"
                >
                  <span className="truncate">{p.emp.name}</span>
                  <span className="shrink-0 text-[10px]">{p.reason}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // BRANCH MANAGER PLANNER HELPERS (WhatsApp Dark Mode + Light Toggle)
  // =========================================================================
  const setDailyOverride = (
    empId: string,
    patch: { shift?: ShiftType | 'off' } | null
  ) => {
    const key = `${branch.id}|${activeDayObj.iso}`;
    onUpdateState((prev) => {
      const nextOverrides = { ...prev.dailyOverrides };
      const dayMap = { ...(nextOverrides[key] || {}) };
      if (patch === null) {
        delete dayMap[empId];
      } else {
        dayMap[empId] = { ...(dayMap[empId] || {}), ...patch };
      }
      nextOverrides[key] = dayMap;
      return { ...prev, dailyOverrides: nextOverrides };
    });
  };

  const updateEmployee = (empId: string, patch: Partial<Employee>) => {
    onUpdateState((prev) => ({
      ...prev,
      branches: prev.branches.map((b) =>
        b.id !== branch.id
          ? b
          : {
              ...b,
              emps: b.emps.map((e) => (e.id === empId ? { ...e, ...patch } : e)),
            }
      ),
    }));
  };

  const handleAddEmployee = () => {
    const name = newEmpName.trim();
    if (!name) {
      onNotify('يرجى كتابة اسم الموظف');
      return;
    }

    const monthlyLeaves: MonthlyLeave[] = [];
    if (newEmpMonthlyDraft) {
      const refMonth = pad2(cairoToday.month + 1);
      const refDay = pad2(newEmpMonthlyDraft.dayOfMonth);
      monthlyLeaves.push({
        id: `ml_${Date.now()}`,
        recurringDayOfMonth: newEmpMonthlyDraft.dayOfMonth,
        startDate: `${cairoToday.year}-${refMonth}-${refDay}`,
        daysCount: newEmpMonthlyDraft.daysCount,
        skipWeeklyInSameWeek: newEmpMonthlyDraft.skipWeeklyInSameWeek,
      });
    }

    const newEmp: Employee = {
      id: `e_${branch.id}_${Date.now()}`,
      name,
      shift: newEmpShift,
      suspended: false,
      weeklyOffDay: newEmpOffDay,
      extraOffDay1: null,
      extraOffDay2: null,
      monthlyLeaves,
    };

    onUpdateState((prev) => ({
      ...prev,
      branches: prev.branches.map((b) =>
        b.id === branch.id ? { ...b, emps: [...b.emps, newEmp] } : b
      ),
    }));
    setNewEmpName('');
    setNewEmpMonthlyDraft(null);
    onNotify(`تمت إضافة ${name} بنجاح`);
  };

  const handleDeleteEmployee = (emp: Employee) => {
    onUpdateState((prev) => ({
      ...prev,
      branches: prev.branches.map((b) =>
        b.id === branch.id
          ? { ...b, emps: b.emps.filter((e) => e.id !== emp.id) }
          : b
      ),
    }));
    onNotify(`تم حذف ${emp.name}`);
  };

  const leaveListEmp = branch.emps.find((e) => e.id === leaveListEmpId) || null;
  const weeklyDialEmp =
    weeklyDialTarget?.mode === 'emp'
      ? branch.emps.find((e) => e.id === weeklyDialTarget.empId) || null
      : null;
  const monthlyDialEmp =
    monthlyDialTarget?.mode === 'emp'
      ? branch.emps.find((e) => e.id === monthlyDialTarget.empId) || null
      : null;

  const filteredTeam = branch.emps.filter(
    (e) => !e.suspended && e.name.toLowerCase().includes(teamSearch.trim().toLowerCase())
  );

  const teamByShift = {
    morning: filteredTeam.filter((e) => e.shift === 'morning'),
    between: filteredTeam.filter((e) => e.shift === 'between'),
    evening: filteredTeam.filter((e) => e.shift === 'evening'),
  };

  const editModalItems = !editModalShift
    ? []
    : activeDayPlan.filter(
        (p) =>
          p.plannedShift === editModalShift ||
          p.plannedShift === 'between' ||
          (p.plannedShift === 'off' &&
            (p.emp.shift === editModalShift || p.emp.shift === 'between'))
      );

  // =========================================================================
  // HUB VIEW (WhatsApp Dark Mode styled)
  // =========================================================================
  if (tab === 'hub') {
    const hubItems = [
      {
        id: 'today' as PlannerTab,
        title: 'لوحة اليوم والجدول',
        desc: 'عرض الصباحي والمسائي لأي يوم من السبت للجمعة وتعديل الحضور',
        icon: CalendarDays,
        badge: `${dayGroups.totalWorking} حاضر اليوم`,
        color: 'bg-[#00A884]/15 text-[#008069] dark:text-[#00A884]',
      },
      {
        id: 'team' as PlannerTab,
        title: 'الموظفون والإجازات',
        desc: 'إضافة موظف مع إجازته الأسبوعية والشهرية عبر الساعة الدائرية',
        icon: Users,
        badge: `${branch.emps.filter((e) => !e.suspended).length} موظف`,
        color: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
      },
    ];

    return (
      <div className="wa-chat-bg flex h-full flex-col overflow-y-auto p-4 sm:p-6">
        <div className="mx-auto my-auto w-full max-w-2xl rounded-2xl border border-[#d1d7db] bg-white p-6 shadow-md dark:border-white/10 dark:bg-[#202C33]">
          <div className="mb-6 text-center">
            <div className="text-xs font-extrabold text-[#008069] dark:text-[#00A884]">
              خطة فرع {branch.name}
            </div>
            <h2 className="mt-1 text-xl font-extrabold text-[#111b21] dark:text-[#E9EDEF]">
              اختر القسم الذي تريد فتحه
            </h2>
            <p className="mt-1 text-xs font-semibold text-[#54656f] tabular-nums dark:text-[#8696A0]">
              الصباحي {formatTime12(morningCfg.tin)} — {formatTime12(morningCfg.tout)} · المسائي{' '}
              {formatTime12(eveningCfg.tin)} — {formatTime12(eveningCfg.tout)}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {hubItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  id={`plannerTab_${item.id}`}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className="flex flex-col justify-between rounded-2xl border border-[#d1d7db] bg-[#f8fafc] p-5 text-right transition-all hover:border-[#00A884] hover:bg-[#e7fce3]/40 dark:border-white/10 dark:bg-[#111B21] dark:hover:bg-[#005C4B]/25"
                >
                  <div>
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div
                        className={`flex h-12 w-12 items-center justify-center rounded-full ${item.color}`}
                      >
                        <Icon className="h-6 w-6" />
                      </div>
                      <span className="text-xs font-extrabold text-[#54656f] dark:text-[#8696A0]">
                        {item.badge}
                      </span>
                    </div>
                    <div className="text-base font-extrabold text-[#111b21] dark:text-[#E9EDEF]">
                      {item.title}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-[#54656f] dark:text-[#8696A0]">
                      {item.desc}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#EFEAE2] dark:bg-[#0B141A]">
      {/* WhatsApp-Style Top Header for Weekly Plan */}
      <header className="flex h-[56px] shrink-0 items-center justify-between gap-2 bg-[#008069] px-3 text-white shadow-xs dark:bg-[#202C33]">
        <div className="flex min-w-0 items-center gap-2">
          {onBackToBranchChats && (
            <button
              type="button"
              onClick={onBackToBranchChats}
              aria-label="العودة للمحادثات"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full hover:bg-white/10 lg:hidden"
            >
              <ArrowRight className="h-6 w-6" />
            </button>
          )}
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#00A884] text-white">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-extrabold sm:text-base">
              خطة الأسبوع — فرع {branch.name}
            </h2>
          </div>
        </div>

        {/* Clean Segmented Toggle: Today vs Team */}
        <div className="flex shrink-0 items-center gap-1 rounded-lg bg-black/20 p-1">
          {[
            { id: 'today', label: 'الجدول' },
            { id: 'team', label: 'الإجازات' },
          ].map((t) => (
            <button
              key={t.id}
              id={`plannerTab_${t.id}`}
              type="button"
              onClick={() => setTab(t.id as PlannerTab)}
              className={`min-h-[34px] whitespace-nowrap rounded-md px-3 text-xs font-extrabold transition-colors ${
                tab === t.id
                  ? 'bg-white text-[#008069] dark:bg-[#00A884] dark:text-[#111B21]'
                  : 'text-white/85 hover:bg-white/10'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <div className="wa-chat-bg wa-scroll flex-1 overflow-y-auto p-3 sm:p-5">
        {/* TAB 1: لوحة اليوم */}
        {tab === 'today' && (
          <div className="mx-auto max-w-4xl space-y-3">
            {/* 7-Day Horizontal Scroller */}
            <div className="rounded-2xl border border-[#d1d7db] bg-white p-2.5 shadow-xs sm:p-3 dark:border-white/10 dark:bg-[#202C33]">
              <div className="no-scrollbar flex gap-1.5 overflow-x-auto sm:grid sm:grid-cols-7">
                {weekQueue.map((wd) => {
                  const isSel = wd.iso === activeDayObj.iso;
                  const isToday = wd.offsetFromToday === 0;
                  const isTomorrow = wd.offsetFromToday === 1;
                  return (
                    <button
                      key={wd.dayOfWeek}
                      type="button"
                      onClick={() => setSelectedIso(wd.iso)}
                      className={`min-h-[52px] min-w-[82px] shrink-0 rounded-xl border px-2.5 py-2 text-right transition-colors sm:min-w-0 ${
                        isSel
                          ? 'border-[#008069] bg-[#008069] text-white dark:border-[#00A884] dark:bg-[#00A884] dark:text-[#111B21]'
                          : 'border-[#e9edef] bg-[#f8fafc] text-[#111b21] hover:bg-[#f0f2f5] dark:border-white/5 dark:bg-[#111B21] dark:text-[#E9EDEF] dark:hover:bg-[#182229]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 text-[11px] font-extrabold sm:text-xs">
                        <span>{wd.arName}</span>
                        {(isToday || isTomorrow) && (
                          <span
                            className={`text-[10px] font-extrabold ${
                              isSel
                                ? 'text-white dark:text-[#111B21]'
                                : isTomorrow
                                ? 'text-[#008069] dark:text-[#00A884]'
                                : 'text-amber-600 dark:text-amber-400'
                            }`}
                          >
                            {isToday ? 'اليوم' : 'غداً'}
                          </span>
                        )}
                      </div>
                      <div
                        className={`font-mono-num mt-0.5 text-[10px] font-bold sm:text-xs ${
                          isSel ? 'text-white/85 dark:text-[#111B21]/80' : 'text-[#54656f] dark:text-[#8696A0]'
                        }`}
                      >
                        {wd.shortDate}
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 text-center text-[11px] font-bold text-[#54656f] dark:text-[#8696A0]">
                الأيام والتواريخ تتغير أوتوماتيك كل يوم حسب التقويم
              </div>
            </div>

            <div
              id="plannerDaySummary"
              className="rounded-2xl border border-[#d1d7db] bg-white p-3 shadow-xs sm:p-5 dark:border-white/10 dark:bg-[#202C33]"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-[#e9edef] pb-3 sm:mb-4 dark:border-white/10">
                <div>
                  <h3 className="text-sm font-extrabold text-[#111b21] sm:text-base dark:text-[#E9EDEF]">
                    {activeDayObj.arName} · {activeDayObj.shortDate}
                  </h3>
                  <p className="mt-0.5 text-xs font-bold text-[#54656f] tabular-nums dark:text-[#8696A0]">
                    الحضور: {dayGroups.totalWorking} · الإجازات: {dayGroups.totalOff}
                  </p>
                </div>

                {onGoToAvailability && (
                  <button
                    type="button"
                    id="plannerGoAvailabilityBtn"
                    onClick={() => onGoToAvailability('morning')}
                    className="flex min-h-[42px] items-center gap-1.5 rounded-full bg-[#008069] px-4 py-2 text-xs font-extrabold text-white hover:bg-[#016b58] dark:bg-[#00A884] dark:text-[#111B21] dark:hover:bg-[#06CF9C]"
                  >
                    <Send className="h-3.5 w-3.5 -scale-x-100" />
                    <span>إرسال توفر الغد للمحادثة</span>
                  </button>
                )}
              </div>

              {/* Side-by-side Morning & Evening Cards */}
              <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
                {/* Morning */}
                <div className="flex min-w-0 flex-col justify-between rounded-2xl border border-[#e9edef] bg-[#f8fafc] p-2.5 sm:p-4 dark:border-white/10 dark:bg-[#111B21]">
                  <div>
                    <div className="mb-2.5 flex flex-wrap items-center justify-between gap-1 border-b border-[#e9edef] pb-2 dark:border-white/10">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
                          <Sun className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="truncate text-xs font-extrabold text-[#111b21] sm:text-sm dark:text-[#E9EDEF]">
                            صباحي
                          </h4>
                          <div className="font-mono-num truncate text-[10px] text-[#54656f] dark:text-[#8696A0]">
                            {formatTime12(morningCfg.tin)}
                          </div>
                        </div>
                      </div>
                      <span className="text-[11px] font-extrabold text-[#008069] tabular-nums dark:text-[#00A884]">
                        {dayGroups.morningAvail.length + dayGroups.betweenAvail.length} متاح
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {dayGroups.morningAvail.map((p) => (
                        <div
                          key={p.emp.id}
                          className="flex items-center justify-between gap-1 rounded-xl bg-white px-2.5 py-2 shadow-2xs dark:bg-[#202C33]"
                        >
                          <span className="truncate text-xs font-bold text-[#111b21] sm:text-sm dark:text-[#E9EDEF]">
                            {p.emp.name}
                          </span>
                          <span className="shrink-0 text-[10px] font-extrabold text-[#008069] dark:text-[#00A884]">
                            حضور
                          </span>
                        </div>
                      ))}
                      {dayGroups.betweenAvail.map((p) => (
                        <div
                          key={`${p.emp.id}_bm`}
                          className="flex items-center justify-between gap-1 rounded-xl bg-amber-500/10 px-2.5 py-2"
                        >
                          <span className="truncate text-xs font-bold text-[#111b21] sm:text-sm dark:text-[#E9EDEF]">
                            {p.emp.name}
                          </span>
                          <span className="shrink-0 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                            بتوين
                          </span>
                        </div>
                      ))}
                    </div>

                    {dayGroups.morningOff.length > 0 && (
                      <div className="mt-3 space-y-1.5">
                        <div className="text-[11px] font-bold text-rose-600 dark:text-rose-400">
                          إجازة:
                        </div>
                        {dayGroups.morningOff.map((p) => (
                          <div
                            key={`${p.emp.id}_om`}
                            className="flex items-center justify-between gap-1 rounded-xl bg-rose-500/10 px-2.5 py-1.5"
                          >
                            <span className="truncate text-xs font-bold text-rose-800 dark:text-rose-300">
                              {p.emp.name}
                            </span>
                            <span className="truncate text-[10px] text-rose-700 dark:text-rose-400">
                              {p.reason}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setEditModalShift('morning')}
                    className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl border border-[#d1d7db] bg-white px-2 py-2 text-xs font-extrabold text-[#111b21] hover:bg-[#f0f2f5] dark:border-white/10 dark:bg-[#202C33] dark:text-[#E9EDEF] dark:hover:bg-white/10"
                  >
                    <Edit3 className="h-3.5 w-3.5 text-[#008069] dark:text-[#00A884]" />
                    <span>تعديل الصباحي</span>
                  </button>
                </div>

                {/* Evening */}
                <div className="flex min-w-0 flex-col justify-between rounded-2xl border border-[#e9edef] bg-[#f8fafc] p-2.5 sm:p-4 dark:border-white/10 dark:bg-[#111B21]">
                  <div>
                    <div className="mb-2.5 flex flex-wrap items-center justify-between gap-1 border-b border-[#e9edef] pb-2 dark:border-white/10">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#008069]/15 text-[#008069] dark:bg-[#00A884]/15 dark:text-[#00A884]">
                          <Moon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="truncate text-xs font-extrabold text-[#111b21] sm:text-sm dark:text-[#E9EDEF]">
                            مسائي
                          </h4>
                          <div className="font-mono-num truncate text-[10px] text-[#54656f] dark:text-[#8696A0]">
                            {formatTime12(eveningCfg.tin)}
                          </div>
                        </div>
                      </div>
                      <span className="text-[11px] font-extrabold text-[#008069] tabular-nums dark:text-[#00A884]">
                        {dayGroups.eveningAvail.length + dayGroups.betweenAvail.length} متاح
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {dayGroups.eveningAvail.map((p) => (
                        <div
                          key={p.emp.id}
                          className="flex items-center justify-between gap-1 rounded-xl bg-white px-2.5 py-2 shadow-2xs dark:bg-[#202C33]"
                        >
                          <span className="truncate text-xs font-bold text-[#111b21] sm:text-sm dark:text-[#E9EDEF]">
                            {p.emp.name}
                          </span>
                          <span className="shrink-0 text-[10px] font-extrabold text-[#008069] dark:text-[#00A884]">
                            حضور
                          </span>
                        </div>
                      ))}
                      {dayGroups.betweenAvail.map((p) => (
                        <div
                          key={`${p.emp.id}_be`}
                          className="flex items-center justify-between gap-1 rounded-xl bg-amber-500/10 px-2.5 py-2"
                        >
                          <span className="truncate text-xs font-bold text-[#111b21] sm:text-sm dark:text-[#E9EDEF]">
                            {p.emp.name}
                          </span>
                          <span className="shrink-0 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                            بتوين
                          </span>
                        </div>
                      ))}
                    </div>

                    {dayGroups.eveningOff.length > 0 && (
                      <div className="mt-3 space-y-1.5">
                        <div className="text-[11px] font-bold text-rose-600 dark:text-rose-400">
                          إجازة:
                        </div>
                        {dayGroups.eveningOff.map((p) => (
                          <div
                            key={`${p.emp.id}_oe`}
                            className="flex items-center justify-between gap-1 rounded-xl bg-rose-500/10 px-2.5 py-1.5"
                          >
                            <span className="truncate text-xs font-bold text-rose-800 dark:text-rose-300">
                              {p.emp.name}
                            </span>
                            <span className="truncate text-[10px] text-rose-700 dark:text-rose-400">
                              {p.reason}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setEditModalShift('evening')}
                    className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl border border-[#d1d7db] bg-white px-2 py-2 text-xs font-extrabold text-[#111b21] hover:bg-[#f0f2f5] dark:border-white/10 dark:bg-[#202C33] dark:text-[#E9EDEF] dark:hover:bg-white/10"
                  >
                    <Edit3 className="h-3.5 w-3.5 text-[#008069] dark:text-[#00A884]" />
                    <span>تعديل المسائي</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: الموظفون والإجازات */}
        {tab === 'team' && (
          <div className="mx-auto max-w-4xl space-y-4">
            <div className="rounded-2xl border border-[#d1d7db] bg-white p-4 shadow-xs sm:p-5 dark:border-white/10 dark:bg-[#202C33]">
              <h3 className="mb-1 text-base font-extrabold text-[#111b21] dark:text-[#E9EDEF]">
                إضافة موظف جديد مع إجازته
              </h3>
              <p className="mb-4 text-xs text-[#54656f] dark:text-[#8696A0]">
                اكتب الاسم، اختر الشفت، وحدد الإجازة الأسبوعية والشهرية بالساعة الدائرية
              </p>
              <div className="space-y-3.5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-bold text-[#54656f] dark:text-[#8696A0]">
                      اسم الموظف
                    </label>
                    <input
                      type="text"
                      placeholder="مثال: أحمد طارق"
                      value={newEmpName}
                      onChange={(e) => setNewEmpName(e.target.value)}
                      className="min-h-[46px] w-full rounded-xl border border-[#d1d7db] bg-[#f8fafc] px-3.5 py-2 text-sm font-bold text-[#111b21] outline-none focus:border-[#00A884] dark:border-white/10 dark:bg-[#111B21] dark:text-[#E9EDEF]"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-bold text-[#54656f] dark:text-[#8696A0]">
                      الشفت
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['morning', 'between', 'evening'] as ShiftType[]).map((sh) => (
                        <button
                          key={sh}
                          type="button"
                          onClick={() => setNewEmpShift(sh)}
                          className={`min-h-[46px] rounded-xl text-xs font-extrabold transition-colors ${
                            newEmpShift === sh
                              ? 'bg-[#008069] text-white dark:bg-[#00A884] dark:text-[#111B21]'
                              : 'border border-[#d1d7db] bg-[#f8fafc] text-[#3b4a54] dark:border-white/10 dark:bg-[#111B21] dark:text-[#AEBAC1]'
                          }`}
                        >
                          {SHIFTS_AR[sh]}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setWeeklyDialTarget({ mode: 'new' })}
                    className="flex min-h-[48px] items-center justify-between gap-2 rounded-xl border border-[#d1d7db] bg-[#f8fafc] px-4 py-2.5 text-right transition-colors hover:border-[#00A884] dark:border-white/10 dark:bg-[#111B21]"
                  >
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-[#008069] dark:text-[#00A884]" />
                      <span className="text-xs font-bold text-[#54656f] dark:text-[#8696A0]">
                        الإجازة الأسبوعية:
                      </span>
                    </div>
                    <span className="text-xs font-extrabold text-[#008069] dark:text-[#00A884]">
                      {newEmpOffDay === null ? 'بدون' : DAY_NAMES_AR[newEmpOffDay]}
                    </span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setMonthlyDialTarget({ mode: 'new' })}
                      className="flex min-h-[48px] flex-1 items-center justify-between gap-2 rounded-xl border border-[#d1d7db] bg-[#f8fafc] px-4 py-2.5 text-right transition-colors hover:border-[#00A884] dark:border-white/10 dark:bg-[#111B21]"
                    >
                      <div className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-[#008069] dark:text-[#00A884]" />
                        <span className="text-xs font-bold text-[#54656f] dark:text-[#8696A0]">
                          إجازة شهرية:
                        </span>
                      </div>
                      <span className="text-xs font-extrabold text-[#008069] dark:text-[#00A884]">
                        {newEmpMonthlyDraft
                          ? `يوم ${newEmpMonthlyDraft.dayOfMonth} (${newEmpMonthlyDraft.daysCount} يوم)`
                          : 'تحديد بالدائرية'}
                      </span>
                    </button>
                    {newEmpMonthlyDraft && (
                      <button
                        type="button"
                        onClick={() => setNewEmpMonthlyDraft(null)}
                        aria-label="مسح الإجازة الشهرية"
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-500"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAddEmployee}
                  className="flex min-h-[48px] w-full items-center justify-center gap-1.5 rounded-full bg-[#008069] py-2.5 text-sm font-extrabold text-white hover:bg-[#016b58] dark:bg-[#00A884] dark:text-[#111B21] dark:hover:bg-[#06CF9C]"
                >
                  <Plus className="h-4 w-4" />
                  <span>إضافة للطاقم</span>
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-[#d1d7db] bg-white p-4 shadow-xs sm:p-5 dark:border-white/10 dark:bg-[#202C33]">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[#e9edef] pb-4 dark:border-white/10">
                <div>
                  <h3 className="text-base font-extrabold text-[#111b21] dark:text-[#E9EDEF]">
                    تنظيم الموظفين والإجازات ({filteredTeam.length})
                  </h3>
                  <p className="text-xs text-[#54656f] dark:text-[#8696A0]">
                    اضغط على الإجازة للتعديل بالساعة الدائرية
                  </p>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#667781]" />
                  <input
                    type="text"
                    placeholder="بحث بالاسم..."
                    value={teamSearch}
                    onChange={(e) => setTeamSearch(e.target.value)}
                    className="min-h-[42px] w-full rounded-full bg-[#f0f2f5] py-2 pl-3 pr-9 text-sm text-[#111b21] outline-none focus:ring-1 focus:ring-[#00A884] dark:bg-[#111B21] dark:text-[#E9EDEF]"
                  />
                </div>
              </div>

              <div className="space-y-6">
                {[
                  {
                    sh: 'morning' as ShiftType,
                    title: 'الوردية الصباحية',
                    hint: `${formatTime12(morningCfg.tin)} — ${formatTime12(morningCfg.tout)}`,
                    items: teamByShift.morning,
                  },
                  {
                    sh: 'between' as ShiftType,
                    title: 'موظفو بتوين',
                    hint: `يظهرون ضمن الصباحي والمسائي (${formatTime12(betweenCfg.tin)} — ${formatTime12(betweenCfg.tout)})`,
                    items: teamByShift.between,
                  },
                  {
                    sh: 'evening' as ShiftType,
                    title: 'الوردية المسائية',
                    hint: `${formatTime12(eveningCfg.tin)} — ${formatTime12(eveningCfg.tout)}`,
                    items: teamByShift.evening,
                  },
                ].map((sec) => (
                  <section key={sec.sh}>
                    <div className="mb-2.5">
                      <h4 className="text-sm font-extrabold text-[#111b21] dark:text-[#E9EDEF]">
                        {sec.title} ({sec.items.length})
                      </h4>
                      <p className="text-xs text-[#54656f] dark:text-[#8696A0]">{sec.hint}</p>
                    </div>

                    {sec.items.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-[#d1d7db] py-4 text-center text-xs text-[#667781] dark:border-white/10 dark:text-[#8696A0]">
                        لا يوجد موظفون في هذا القسم
                      </div>
                    ) : (
                      <div className="grid gap-3 md:grid-cols-2">
                        {sec.items.map((emp) => (
                          <div
                            key={emp.id}
                            className="rounded-2xl border border-[#e9edef] bg-[#f8fafc] p-4 dark:border-white/10 dark:bg-[#111B21]"
                          >
                            <div className="mb-3 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2.5">
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#008069] text-sm font-extrabold text-white dark:bg-[#00A884] dark:text-[#111B21]">
                                  {emp.name.slice(0, 1)}
                                </div>
                                <div className="text-base font-extrabold text-[#111b21] dark:text-[#E9EDEF]">
                                  {emp.name}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDeleteEmployee(emp)}
                                aria-label={`حذف ${emp.name}`}
                                className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-full bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 dark:text-rose-400"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>

                            <div className="space-y-2.5">
                              <div className="grid grid-cols-3 gap-1.5">
                                {(['morning', 'between', 'evening'] as ShiftType[]).map((sh) => (
                                  <button
                                    key={sh}
                                    type="button"
                                    onClick={() => updateEmployee(emp.id, { shift: sh })}
                                    className={`min-h-[38px] rounded-xl text-xs font-extrabold ${
                                      emp.shift === sh
                                        ? 'bg-[#008069] text-white dark:bg-[#00A884] dark:text-[#111B21]'
                                        : 'border border-[#d1d7db] bg-white text-[#3b4a54] dark:border-white/10 dark:bg-[#202C33] dark:text-[#AEBAC1]'
                                    }`}
                                  >
                                    {SHIFTS_AR[sh]}
                                  </button>
                                ))}
                              </div>

                              <div className="grid grid-cols-2 gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setWeeklyDialTarget({ mode: 'emp', empId: emp.id })
                                  }
                                  className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-[#d1d7db] bg-white px-2.5 py-1.5 text-xs font-extrabold text-[#111b21] hover:border-[#00A884] dark:border-white/10 dark:bg-[#202C33] dark:text-[#E9EDEF]"
                                >
                                  <Clock className="h-3.5 w-3.5 text-[#008069] dark:text-[#00A884]" />
                                  <span>
                                    {emp.weeklyOffDay === null
                                      ? 'أسبوعية: بدون'
                                      : `أسبوعية: ${DAY_NAMES_AR[emp.weeklyOffDay]}`}
                                  </span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    if ((emp.monthlyLeaves || []).length === 0) {
                                      setMonthlyDialTarget({ mode: 'emp', empId: emp.id });
                                    } else {
                                      setLeaveListEmpId(emp.id);
                                    }
                                  }}
                                  className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-[#008069] bg-white px-2.5 py-1.5 text-xs font-extrabold text-[#008069] hover:bg-[#e7fce3] dark:border-[#00A884] dark:bg-[#202C33] dark:text-[#00A884] dark:hover:bg-[#005C4B]/30"
                                >
                                  <CalendarDays className="h-3.5 w-3.5" />
                                  <span>
                                    {(emp.monthlyLeaves || []).length > 0
                                      ? `شهرية (${emp.monthlyLeaves.length})`
                                      : 'إجازة شهرية'}
                                  </span>
                                </button>
                              </div>

                              {(emp.monthlyLeaves || []).length > 0 && (
                                <div className="flex flex-wrap gap-2 pt-0.5 text-[11px] font-bold text-[#008069] dark:text-[#00A884]">
                                  {emp.monthlyLeaves.map((ml) => (
                                    <span key={ml.id}>{formatLeaveSummary(ml)}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Edit Day Modal */}
      {editModalShift && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
          onClick={() => setEditModalShift(null)}
        >
          <div
            className="max-h-[88vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-[#d1d7db] bg-white p-5 shadow-xl dark:border-white/10 dark:bg-[#202C33]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between border-b border-[#e9edef] pb-3 dark:border-white/10">
              <div>
                <h3 className="text-base font-extrabold text-[#111b21] dark:text-[#E9EDEF]">
                  تعديل أفراد {editModalShift === 'morning' ? 'الصباحي' : 'المسائي'} —{' '}
                  {activeDayObj.arName} ({activeDayObj.shortDate})
                </h3>
                <p className="text-xs text-[#54656f] dark:text-[#8696A0]">
                  اضغط على الشفت أو الإجازة لهذا اليوم فقط
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditModalShift(null)}
                className="min-h-[40px] rounded-full border border-[#d1d7db] px-3.5 py-1 text-xs font-bold text-[#54656f] dark:border-white/10 dark:text-[#AEBAC1]"
              >
                إغلاق
              </button>
            </div>

            <div className="space-y-2.5">
              {editModalItems.map((p) => (
                <div
                  key={p.emp.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e9edef] bg-[#f8fafc] px-4 py-3 dark:border-white/10 dark:bg-[#111B21]"
                >
                  <div>
                    <div className="text-sm font-extrabold text-[#111b21] dark:text-[#E9EDEF]">
                      {p.emp.name}
                    </div>
                    <div className="text-xs text-[#54656f] dark:text-[#8696A0]">
                      الأساسي: {SHIFTS_AR[p.emp.shift]}
                      {p.isOverridden ? ' · معدل لهذا اليوم' : ''}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {(
                      [
                        { val: 'morning', label: 'صباحي' },
                        { val: 'between', label: 'بتوين' },
                        { val: 'evening', label: 'مسائي' },
                        { val: 'off', label: 'إجازة' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() =>
                          setDailyOverride(p.emp.id, { shift: opt.val })
                        }
                        className={`min-h-[38px] rounded-full px-3 py-1.5 text-xs font-extrabold ${
                          p.plannedShift === opt.val
                            ? opt.val === 'off'
                              ? 'bg-rose-600 text-white'
                              : 'bg-[#008069] text-white dark:bg-[#00A884] dark:text-[#111B21]'
                            : 'border border-[#d1d7db] bg-white text-[#3b4a54] dark:border-white/10 dark:bg-[#202C33] dark:text-[#AEBAC1]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                    {p.isOverridden && (
                      <button
                        type="button"
                        onClick={() => setDailyOverride(p.emp.id, null)}
                        className="min-h-[38px] rounded-full border border-[#d1d7db] bg-white px-2.5 py-1.5 text-xs font-bold text-[#54656f] dark:border-white/10 dark:bg-[#202C33] dark:text-[#AEBAC1]"
                      >
                        استعادة
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Monthly Leave List Modal */}
      {leaveListEmp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
          onClick={() => setLeaveListEmpId(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-[#d1d7db] bg-white p-5 shadow-xl dark:border-white/10 dark:bg-[#202C33]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between border-b border-[#e9edef] pb-3 dark:border-white/10">
              <div>
                <h3 className="text-base font-extrabold text-[#111b21] dark:text-[#E9EDEF]">
                  الإجازة الشهرية — {leaveListEmp.name}
                </h3>
                <p className="text-xs text-[#54656f] dark:text-[#8696A0]">
                  يتكرر تلقائياً في الموعد المحدد كل شهر
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLeaveListEmpId(null)}
                className="min-h-[38px] rounded-full border border-[#d1d7db] px-3 py-1 text-xs font-bold dark:border-white/10 dark:text-[#AEBAC1]"
              >
                إغلاق
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                const targetId = leaveListEmp.id;
                setLeaveListEmpId(null);
                setMonthlyDialTarget({ mode: 'emp', empId: targetId });
              }}
              className="mb-4 flex min-h-[46px] w-full items-center justify-center gap-1.5 rounded-full bg-[#008069] py-2.5 text-sm font-extrabold text-white hover:bg-[#016b58] dark:bg-[#00A884] dark:text-[#111B21]"
            >
              <Plus className="h-4 w-4" />
              <span>إضافة إجازة شهرية بالدائرية</span>
            </button>

            <div className="space-y-2">
              {(leaveListEmp.monthlyLeaves || []).map((ml) => (
                <div
                  key={ml.id}
                  className="flex items-center justify-between rounded-xl border border-[#e9edef] bg-[#f8fafc] px-3.5 py-2.5 text-xs dark:border-white/10 dark:bg-[#111B21]"
                >
                  <div>
                    <div className="font-extrabold text-[#111b21] dark:text-[#E9EDEF]">
                      {formatLeaveSummary(ml)}
                    </div>
                    <div className="text-[11px] text-[#54656f] dark:text-[#8696A0]">
                      {ml.skipWeeklyInSameWeek
                        ? 'بدون إجازة أسبوعية في نفس الأسبوع'
                        : 'مع احتساب الإجازة الأسبوعية'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      updateEmployee(leaveListEmp.id, {
                        monthlyLeaves: (leaveListEmp.monthlyLeaves || []).filter(
                          (x) => x.id !== ml.id
                        ),
                      });
                      onNotify('تم حذف الإجازة الشهرية');
                    }}
                    className="rounded-full bg-rose-500/15 px-3 py-1.5 font-bold text-rose-600 dark:text-rose-400"
                  >
                    حذف
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <WeeklyOffDialModal
        open={weeklyDialTarget !== null}
        selectedDay={
          weeklyDialTarget?.mode === 'new'
            ? newEmpOffDay
            : weeklyDialEmp?.weeklyOffDay ?? null
        }
        title={
          weeklyDialTarget?.mode === 'new'
            ? 'اختر يوم الإجازة الأسبوعية'
            : weeklyDialEmp
            ? `الإجازة الأسبوعية — ${weeklyDialEmp.name}`
            : 'اختر يوم الإجازة الأسبوعية'
        }
        onCancel={() => setWeeklyDialTarget(null)}
        onConfirm={(pickedDay) => {
          if (weeklyDialTarget?.mode === 'new') {
            setNewEmpOffDay(pickedDay);
          } else if (weeklyDialEmp) {
            updateEmployee(weeklyDialEmp.id, { weeklyOffDay: pickedDay });
            onNotify(
              pickedDay === null
                ? `تم إلغاء الإجازة الأسبوعية لـ ${weeklyDialEmp.name}`
                : `تم تحديد إجازة ${weeklyDialEmp.name}: ${DAY_NAMES_AR[pickedDay]}`
            );
          }
          setWeeklyDialTarget(null);
        }}
      />

      <MonthlyLeaveDialModal
        open={monthlyDialTarget !== null}
        initialDayOfMonth={
          monthlyDialTarget?.mode === 'new'
            ? newEmpMonthlyDraft?.dayOfMonth ?? 5
            : 5
        }
        initialDaysCount={
          monthlyDialTarget?.mode === 'new'
            ? newEmpMonthlyDraft?.daysCount ?? 2
            : 2
        }
        initialSkipWeekly={
          monthlyDialTarget?.mode === 'new'
            ? newEmpMonthlyDraft?.skipWeeklyInSameWeek ?? true
            : true
        }
        employeeName={
          monthlyDialTarget?.mode === 'new'
            ? newEmpName.trim() || 'موظف جديد'
            : monthlyDialEmp?.name
        }
        onCancel={() => setMonthlyDialTarget(null)}
        onConfirm={(res) => {
          if (monthlyDialTarget?.mode === 'new') {
            setNewEmpMonthlyDraft(res);
          } else if (monthlyDialEmp) {
            const refMonth = pad2(cairoToday.month + 1);
            const refDay = pad2(res.dayOfMonth);
            const newLeave: MonthlyLeave = {
              id: `ml_${Date.now()}`,
              recurringDayOfMonth: res.dayOfMonth,
              startDate: `${cairoToday.year}-${refMonth}-${refDay}`,
              daysCount: res.daysCount,
              skipWeeklyInSameWeek: res.skipWeeklyInSameWeek,
            };
            updateEmployee(monthlyDialEmp.id, {
              monthlyLeaves: [...(monthlyDialEmp.monthlyLeaves || []), newLeave],
            });
            onNotify(
              `تم حفظ إجازة ${monthlyDialEmp.name}: يوم ${res.dayOfMonth} كل شهر (${res.daysCount} يوم)`
            );
          }
          setMonthlyDialTarget(null);
        }}
      />
    </div>
  );
};
