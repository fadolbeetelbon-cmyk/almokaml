import React, { useMemo, useState } from 'react';
import {
  CalendarDays,
  Check,
  Edit3,
  Moon,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Sun,
  Trash2,
  Users,
} from 'lucide-react';
import {
  computeDayPlanForBranch,
  createSeedState,
  DAY_NAMES_AR,
  formatTime12,
  getCairoToday,
  getRollingWeekQueue,
  SHIFTS_AR,
  WEEK_ORDER_SAT_FRI,
} from '../data/seed';
import {
  AppState,
  Branch,
  Employee,
  MonthlyLeave,
  ShiftType,
} from '../types';
import { DateDialModal } from './DateDialModal';

export type PlannerTab = 'today' | 'team' | 'branch';

interface PlannerModuleProps {
  state: AppState;
  branchId: string;
  isAdmin: boolean;
  externalTab?: { tab: PlannerTab; nonce: number } | null;
  onSelectBranch: (bId: string) => void;
  onUpdateState: (updater: (prev: AppState) => AppState) => void;
  onNotify: (msg: string) => void;
  onGoToAvailability?: (shift: ShiftType) => void;
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
}) => {
  const cairoToday = useMemo(() => getCairoToday(), []);
  const weekQueue = useMemo(() => getRollingWeekQueue(cairoToday.iso), [cairoToday.iso]);

  const [tab, setTab] = useState<PlannerTab>('today');
  const [selectedIso, setSelectedIso] = useState<string>(cairoToday.iso);
  const [editModalShift, setEditModalShift] = useState<'morning' | 'evening' | null>(null);

  React.useEffect(() => {
    if (externalTab) {
      setTab(externalTab.tab);
    }
  }, [externalTab?.nonce, externalTab?.tab]);

  // Team settings state
  const [teamSearch, setTeamSearch] = useState('');
  const [newEmpName, setNewEmpName] = useState('');
  const [newEmpShift, setNewEmpShift] = useState<ShiftType>('morning');
  const [newEmpOffDay, setNewEmpOffDay] = useState<string>('5');

  // Monthly leave modal
  const [leaveEmpId, setLeaveEmpId] = useState<string | null>(null);
  const [leaveStartIso, setLeaveStartIso] = useState<string>(cairoToday.iso);
  const [leaveDaysCount, setLeaveDaysCount] = useState<number>(3);
  const [leaveSkipWeekly, setLeaveSkipWeekly] = useState<boolean>(true);
  const [leaveNote, setLeaveNote] = useState<string>('');
  const [dialOpen, setDialOpen] = useState(false);

  const branch: Branch =
    state.branches.find((b) => b.id === branchId) || state.branches[0];

  const [branchNameDraft, setBranchNameDraft] = useState(branch.name);
  const [schedulesDraft, setSchedulesDraft] = useState(branch.shiftSchedules);

  React.useEffect(() => {
    setBranchNameDraft(branch.name);
    setSchedulesDraft(branch.shiftSchedules);
  }, [branch.id, branch.name, branch.shiftSchedules]);

  const activeDayObj = useMemo(() => {
    return weekQueue.find((d) => d.iso === selectedIso) || weekQueue[0];
  }, [weekQueue, selectedIso]);

  const activeDayPlan = useMemo(
    () => computeDayPlanForBranch(state, branch.id, activeDayObj.iso),
    [state, branch.id, activeDayObj.iso]
  );

  // Split day plan into the 2 main horizontal shift cards (Morning & Evening) with Between embedded in both
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
    const newEmp: Employee = {
      id: `e_${branch.id}_${Date.now()}`,
      name,
      shift: newEmpShift,
      suspended: false,
      weeklyOffDay: newEmpOffDay === '' ? null : Number(newEmpOffDay),
      extraOffDay1: null,
      extraOffDay2: null,
      monthlyLeaves: [],
    };
    onUpdateState((prev) => ({
      ...prev,
      branches: prev.branches.map((b) =>
        b.id === branch.id ? { ...b, emps: [...b.emps, newEmp] } : b
      ),
    }));
    setNewEmpName('');
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

  const leaveEmp = branch.emps.find((e) => e.id === leaveEmpId) || null;

  const handleSaveMonthlyLeave = () => {
    if (!leaveEmp) return;
    const item: MonthlyLeave = {
      id: `ml_${Date.now()}`,
      startDate: leaveStartIso,
      daysCount: Math.max(1, leaveDaysCount),
      skipWeeklyInSameWeek: leaveSkipWeekly,
      note: leaveNote.trim() || undefined,
    };
    updateEmployee(leaveEmp.id, {
      monthlyLeaves: [...(leaveEmp.monthlyLeaves || []), item],
    });
    setLeaveNote('');
    onNotify(`تم حفظ الإجازة الشهرية لـ ${leaveEmp.name}`);
  };

  const handleDeleteMonthlyLeave = (leaveId: string) => {
    if (!leaveEmp) return;
    updateEmployee(leaveEmp.id, {
      monthlyLeaves: (leaveEmp.monthlyLeaves || []).filter((m) => m.id !== leaveId),
    });
    onNotify('تم حذف الإجازة الشهرية');
  };

  const filteredTeam = branch.emps.filter(
    (e) => !e.suspended && e.name.toLowerCase().includes(teamSearch.trim().toLowerCase())
  );

  const teamByShift = useMemo(
    () => ({
      morning: filteredTeam.filter((e) => e.shift === 'morning'),
      between: filteredTeam.filter((e) => e.shift === 'between'),
      evening: filteredTeam.filter((e) => e.shift === 'evening'),
    }),
    [filteredTeam]
  );

  const morningCfg = branch.shiftSchedules.morning;
  const eveningCfg = branch.shiftSchedules.evening;
  const betweenCfg = branch.shiftSchedules.between;

  const editModalItems = useMemo(() => {
    if (!editModalShift) return [];
    return activeDayPlan.filter(
      (p) =>
        p.plannedShift === editModalShift ||
        p.plannedShift === 'between' ||
        (p.plannedShift === 'off' &&
          (p.emp.shift === editModalShift || p.emp.shift === 'between'))
    );
  }, [activeDayPlan, editModalShift]);

  return (
    <div className="space-y-5">
      {/* Top Planner Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <div className="text-xs font-bold text-amber-700">
            خطة الورديات الأسبوعية · تتجدد التواريخ تلقائياً
          </div>
          <h2 className="mt-0.5 text-lg font-extrabold text-slate-900">
            فرع {branch.name}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {isAdmin && (
            <select
              value={branch.id}
              onChange={(e) => onSelectBranch(e.target.value)}
              className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-800 outline-none focus:border-slate-900"
            >
              {state.branches.map((b) => (
                <option key={b.id} value={b.id}>
                  فرع {b.name}
                </option>
              ))}
            </select>
          )}

          {/* 3 Clean Spacious Tabs */}
          <div className="flex flex-wrap items-center gap-1 rounded-xl bg-slate-100 p-1">
            {[
              { id: 'today', label: 'لوحة اليوم', icon: CalendarDays },
              { id: 'team', label: 'الموظفون والإجازات', icon: Users },
              { id: 'branch', label: 'إعدادات الشفتات', icon: Settings },
            ].map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  id={`plannerTab_${t.id}`}
                  type="button"
                  onClick={() => setTab(t.id as PlannerTab)}
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-extrabold transition-colors ${
                    active
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* TAB 1: لوحة اليوم (الأيام ثابتة كطابور + بطاقتان أفقيتان فقط) */}
      {tab === 'today' && (
        <div className="space-y-4">
          {/* Rolling 7-Day Fixed Queue Ribbon (No Previous/Next Week buttons needed!) */}
          <div className="rounded-xl border border-slate-200 bg-white p-3.5">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
              {weekQueue.map((wd) => {
                const isSel = wd.iso === activeDayObj.iso;
                const isToday = wd.offsetFromToday === 0;
                const isTomorrow = wd.offsetFromToday === 1;
                return (
                  <button
                    key={wd.dayOfWeek}
                    type="button"
                    onClick={() => setSelectedIso(wd.iso)}
                    className={`rounded-xl border px-3 py-2.5 text-right transition-colors ${
                      isSel
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-extrabold">
                      <span>{wd.arName}</span>
                      {isToday && (
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] ${
                            isSel
                              ? 'bg-amber-400/20 text-amber-300'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          اليوم
                        </span>
                      )}
                      {isTomorrow && (
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] ${
                            isSel
                              ? 'bg-emerald-400/20 text-emerald-300'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          غداً
                        </span>
                      )}
                    </div>
                    <div
                      className={`font-mono-num mt-1 text-xs font-bold ${
                        isSel ? 'text-slate-300' : 'text-slate-500'
                      }`}
                    >
                      {wd.shortDate}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Simplified Day Header + 2 Side-by-Side Horizontal Cards */}
          <div
            id="plannerDaySummary"
            className="rounded-2xl border border-slate-200 bg-white p-5"
          >
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">
                  توزيع ورديات يوم {activeDayObj.arName} · {activeDayObj.shortDate}
                </h3>
                <p className="mt-1 text-xs font-bold text-slate-500">
                  إجمالي الحضور: {dayGroups.totalWorking} · غير المتاحين اليوم: {dayGroups.totalOff}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTab('team')}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-xs font-extrabold text-slate-800 hover:bg-slate-100"
                >
                  <Users className="h-4 w-4 text-amber-700" />
                  <span>إدارة الموظفين والإجازات</span>
                </button>
                {onGoToAvailability && (
                  <button
                    type="button"
                    onClick={() => onGoToAvailability('morning')}
                    className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-extrabold text-white hover:bg-slate-800"
                  >
                    تسجيل وإرسال توفر الغد
                  </button>
                )}
              </div>
            </div>

            {/* Horizontal 2-Column Layout: Morning Card | Evening Card */}
            <div className="grid gap-5 md:grid-cols-2">
              {/* CARD 1: الوردية الصباحية + بتوين */}
              <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50/40 p-5">
                <div>
                  <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                        <Sun className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-base font-extrabold text-slate-900">
                          {morningCfg.label}
                        </h4>
                        <div className="font-mono-num text-xs font-semibold text-slate-500">
                          {formatTime12(morningCfg.tin)} — {formatTime12(morningCfg.tout)}
                        </div>
                      </div>
                    </div>

                    <span className="rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-extrabold text-emerald-800">
                      {dayGroups.morningAvail.length} متاح
                      {dayGroups.betweenAvail.length > 0
                        ? ` + ${dayGroups.betweenAvail.length} بتوين`
                        : ''}
                    </span>
                  </div>

                  {/* Available in Morning + Between */}
                  <div className="mb-2 text-xs font-extrabold text-emerald-700">
                    ✓ المتاحون في الصباحي ({dayGroups.morningAvail.length})
                    {dayGroups.betweenAvail.length > 0 && (
                      <span className="text-amber-700">
                        {' '}
                        + {dayGroups.betweenAvail.length} بتوين (من{' '}
                        {formatTime12(betweenCfg.tin)})
                      </span>
                    )}
                  </div>

                  {dayGroups.morningAvail.length === 0 &&
                  dayGroups.betweenAvail.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-slate-200 bg-white py-4 text-center text-xs text-slate-400">
                      لا يوجد متاحون في الصباحي لهذا اليوم
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {dayGroups.morningAvail.map((p) => (
                        <div
                          key={p.emp.id}
                          className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3"
                        >
                          <div>
                            <div className="text-sm font-extrabold text-slate-900">
                              {p.emp.name}
                            </div>
                            {p.isOverridden && (
                              <div className="text-[11px] font-bold text-amber-700">
                                معدل لهذا اليوم
                              </div>
                            )}
                          </div>
                          <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                            متاح
                          </span>
                        </div>
                      ))}

                      {dayGroups.betweenAvail.map((p) => (
                        <div
                          key={`${p.emp.id}_btw_m`}
                          className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50/50 px-4 py-3"
                        >
                          <div>
                            <div className="text-sm font-extrabold text-slate-900">
                              {p.emp.name}
                            </div>
                            <div className="text-[11px] font-bold text-amber-800">
                              بتوين · من {formatTime12(betweenCfg.tin)}
                            </div>
                          </div>
                          <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                            متاح
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Unavailable in Morning (embedded cleanly inside same card) */}
                  {dayGroups.morningOff.length > 0 && (
                    <div className="mt-4">
                      <div className="mb-2 text-xs font-extrabold text-rose-700">
                        غير المتاحين (صباحي):
                      </div>
                      <div className="space-y-2">
                        {dayGroups.morningOff.map((p) => (
                          <div
                            key={`${p.emp.id}_off_m`}
                            className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50/70 px-4 py-2.5"
                          >
                            <div>
                              <span className="text-sm font-bold text-rose-950">
                                {p.emp.name}
                              </span>
                              {p.emp.shift === 'between' && (
                                <span className="mr-1.5 text-[11px] font-bold text-amber-800">
                                  (بتوين)
                                </span>
                              )}
                            </div>
                            <span className="rounded-md bg-rose-100 px-2.5 py-1 text-xs font-bold text-rose-800">
                              {p.reason}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setEditModalShift('morning')}
                  className="mt-5 flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white py-2.5 text-xs font-extrabold text-slate-800 hover:bg-slate-100"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  <span>+ تعديل أفراد الصباحي لهذا اليوم</span>
                </button>
              </div>

              {/* CARD 2: الوردية المسائية + بتوين */}
              <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50/40 p-5">
                <div>
                  <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-amber-300">
                        <Moon className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-base font-extrabold text-slate-900">
                          {eveningCfg.label}
                        </h4>
                        <div className="font-mono-num text-xs font-semibold text-slate-500">
                          {formatTime12(eveningCfg.tin)} — {formatTime12(eveningCfg.tout)}
                        </div>
                      </div>
                    </div>

                    <span className="rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-extrabold text-emerald-800">
                      {dayGroups.eveningAvail.length} متاح
                      {dayGroups.betweenAvail.length > 0
                        ? ` + ${dayGroups.betweenAvail.length} بتوين`
                        : ''}
                    </span>
                  </div>

                  {/* Available in Evening + Between */}
                  <div className="mb-2 text-xs font-extrabold text-emerald-700">
                    ✓ المتاحون في المسائي ({dayGroups.eveningAvail.length})
                    {dayGroups.betweenAvail.length > 0 && (
                      <span className="text-amber-700">
                        {' '}
                        + {dayGroups.betweenAvail.length} بتوين (حتى{' '}
                        {formatTime12(betweenCfg.tout)})
                      </span>
                    )}
                  </div>

                  {dayGroups.eveningAvail.length === 0 &&
                  dayGroups.betweenAvail.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-slate-200 bg-white py-4 text-center text-xs text-slate-400">
                      لا يوجد متاحون في المسائي لهذا اليوم
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {dayGroups.eveningAvail.map((p) => (
                        <div
                          key={p.emp.id}
                          className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3"
                        >
                          <div>
                            <div className="text-sm font-extrabold text-slate-900">
                              {p.emp.name}
                            </div>
                            {p.isOverridden && (
                              <div className="text-[11px] font-bold text-amber-700">
                                معدل لهذا اليوم
                              </div>
                            )}
                          </div>
                          <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                            متاح
                          </span>
                        </div>
                      ))}

                      {dayGroups.betweenAvail.map((p) => (
                        <div
                          key={`${p.emp.id}_btw_e`}
                          className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50/50 px-4 py-3"
                        >
                          <div>
                            <div className="text-sm font-extrabold text-slate-900">
                              {p.emp.name}
                            </div>
                            <div className="text-[11px] font-bold text-amber-800">
                              بتوين · حتى {formatTime12(betweenCfg.tout)}
                            </div>
                          </div>
                          <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                            متاح
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Unavailable in Evening (embedded cleanly inside same card) */}
                  {dayGroups.eveningOff.length > 0 && (
                    <div className="mt-4">
                      <div className="mb-2 text-xs font-extrabold text-rose-700">
                        غير المتاحين (مسائي):
                      </div>
                      <div className="space-y-2">
                        {dayGroups.eveningOff.map((p) => (
                          <div
                            key={`${p.emp.id}_off_e`}
                            className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50/70 px-4 py-2.5"
                          >
                            <div>
                              <span className="text-sm font-bold text-rose-950">
                                {p.emp.name}
                              </span>
                              {p.emp.shift === 'between' && (
                                <span className="mr-1.5 text-[11px] font-bold text-amber-800">
                                  (بتوين)
                                </span>
                              )}
                            </div>
                            <span className="rounded-md bg-rose-100 px-2.5 py-1 text-xs font-bold text-rose-800">
                              {p.reason}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setEditModalShift('evening')}
                  className="mt-5 flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white py-2.5 text-xs font-extrabold text-slate-800 hover:bg-slate-100"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  <span>+ تعديل أفراد المسائي لهذا اليوم</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: الموظفون والإجازات (مقسم حسب الشفت + بطاقات خفيفة وبسيطة) */}
      {tab === 'team' && (
        <div className="space-y-5">
          {/* Add Employee Card — Spacious & Simple */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="mb-1 text-base font-extrabold text-slate-900">
              إضافة موظف جديد
            </h3>
            <p className="mb-4 text-xs text-slate-500">
              اكتب الاسم واختر الشفت ويوم الإجازة الأسبوعية فقط
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-600">
                  اسم الموظف
                </label>
                <input
                  type="text"
                  placeholder="مثال: أحمد طارق"
                  value={newEmpName}
                  onChange={(e) => setNewEmpName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-bold outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-600">
                  الشفت
                </label>
                <select
                  value={newEmpShift}
                  onChange={(e) => setNewEmpShift(e.target.value as ShiftType)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-bold outline-none focus:border-slate-900"
                >
                  <option value="morning">الوردية الصباحية</option>
                  <option value="between">بتوين (يغطي الصباحي والمسائي)</option>
                  <option value="evening">الوردية المسائية</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-600">
                  الإجازة الأسبوعية
                </label>
                <select
                  value={newEmpOffDay}
                  onChange={(e) => setNewEmpOffDay(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-bold outline-none focus:border-slate-900"
                >
                  <option value="">بدون إجازة</option>
                  {WEEK_ORDER_SAT_FRI.map((d) => (
                    <option key={d} value={d}>
                      {DAY_NAMES_AR[d]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={handleAddEmployee}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-slate-900 py-2.5 text-sm font-extrabold text-white hover:bg-slate-800"
                >
                  <Plus className="h-4 w-4 text-amber-300" />
                  <span>إضافة للطاقم</span>
                </button>
              </div>
            </div>
          </div>

          {/* Search + Light Divided Cards per Shift */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  تنظيم الموظفين والإجازات ({filteredTeam.length})
                </h3>
                <p className="text-xs text-slate-500">
                  كل موظف في بطاقة خفيفة لتعديل الشفت أو الإجازة بسهولة
                </p>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="بحث بالاسم..."
                  value={teamSearch}
                  onChange={(e) => setTeamSearch(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 py-2 pl-3 pr-9 text-sm outline-none focus:border-slate-900"
                />
              </div>
            </div>

            <div className="space-y-6">
              {(
                [
                  {
                    sh: 'morning' as ShiftType,
                    title: 'الوردية الصباحية',
                    hint: `${formatTime12(morningCfg.tin)} — ${formatTime12(morningCfg.tout)}`,
                    items: teamByShift.morning,
                    accent: 'border-amber-200 bg-amber-50/40',
                  },
                  {
                    sh: 'between' as ShiftType,
                    title: 'موظفو بتوين',
                    hint: `يظهرون ضمن الصباحي والمسائي (${formatTime12(betweenCfg.tin)} — ${formatTime12(betweenCfg.tout)})`,
                    items: teamByShift.between,
                    accent: 'border-amber-300 bg-amber-50/60',
                  },
                  {
                    sh: 'evening' as ShiftType,
                    title: 'الوردية المسائية',
                    hint: `${formatTime12(eveningCfg.tin)} — ${formatTime12(eveningCfg.tout)}`,
                    items: teamByShift.evening,
                    accent: 'border-slate-200 bg-slate-50/60',
                  },
                ]
              ).map((sec) => (
                <section key={sec.sh}>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-extrabold text-slate-900">
                        {sec.title} ({sec.items.length})
                      </h4>
                      <p className="text-xs text-slate-500">{sec.hint}</p>
                    </div>
                  </div>

                  {sec.items.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 py-4 text-center text-xs text-slate-400">
                      لا يوجد موظفون في هذا القسم
                    </div>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2">
                      {sec.items.map((emp) => (
                        <div
                          key={emp.id}
                          className={`rounded-xl border p-4 transition-colors ${sec.accent}`}
                        >
                          <div className="mb-3 flex items-center justify-between gap-2">
                            <div className="text-base font-extrabold text-slate-900">
                              {emp.name}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteEmployee(emp)}
                              aria-label={`حذف ${emp.name}`}
                              className="rounded-lg border border-rose-200 bg-white p-1.5 text-rose-700 hover:bg-rose-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-2.5">
                            <div>
                              <label className="mb-1 block text-[11px] font-bold text-slate-500">
                                الشفت
                              </label>
                              <select
                                value={emp.shift}
                                onChange={(e) =>
                                  updateEmployee(emp.id, {
                                    shift: e.target.value as ShiftType,
                                  })
                                }
                                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-extrabold text-slate-800"
                              >
                                <option value="morning">صباحي</option>
                                <option value="between">بتوين</option>
                                <option value="evening">مسائي</option>
                              </select>
                            </div>

                            <div>
                              <label className="mb-1 block text-[11px] font-bold text-slate-500">
                                الإجازة الأسبوعية
                              </label>
                              <select
                                value={
                                  emp.weeklyOffDay === null
                                    ? ''
                                    : String(emp.weeklyOffDay)
                                }
                                onChange={(e) =>
                                  updateEmployee(emp.id, {
                                    weeklyOffDay:
                                      e.target.value === ''
                                        ? null
                                        : Number(e.target.value),
                                  })
                                }
                                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-extrabold text-slate-800"
                              >
                                <option value="">بدون</option>
                                {WEEK_ORDER_SAT_FRI.map((d) => (
                                  <option key={d} value={d}>
                                    {DAY_NAMES_AR[d]}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setLeaveEmpId(emp.id);
                              setLeaveStartIso(cairoToday.iso);
                              setLeaveDaysCount(3);
                              setLeaveSkipWeekly(true);
                              setLeaveNote('');
                            }}
                            className="mt-3 w-full rounded-lg border border-amber-300 bg-white py-2 text-xs font-extrabold text-amber-900 hover:bg-amber-50"
                          >
                            إجازة شهرية ({(emp.monthlyLeaves || []).length})
                          </button>
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

      {/* TAB 3: إعدادات الشفتات والفرع (بدون تغيير كلمة السر) */}
      {tab === 'branch' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="mb-1 text-base font-extrabold text-slate-900">
              بيانات الفرع ومواعيد الشفتات
            </h3>
            <p className="mb-4 text-xs text-slate-500">
              تعديل اسم الفرع ومواعيد الوردية الصباحية والمسائية وبتوين
            </p>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-600">
                  اسم الفرع
                </label>
                <input
                  type="text"
                  value={branchNameDraft}
                  onChange={(e) => setBranchNameDraft(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold outline-none focus:border-slate-900"
                />
              </div>

              {(['morning', 'evening', 'between'] as ShiftType[]).map((sh) => (
                <div key={sh} className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                  <div className="mb-2 text-xs font-extrabold text-slate-800">
                    {SHIFTS_AR[sh]}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={schedulesDraft[sh].label}
                      onChange={(e) =>
                        setSchedulesDraft((prev) => ({
                          ...prev,
                          [sh]: { ...prev[sh], label: e.target.value },
                        }))
                      }
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold"
                    />
                    <input
                      type="time"
                      value={schedulesDraft[sh].tin}
                      onChange={(e) =>
                        setSchedulesDraft((prev) => ({
                          ...prev,
                          [sh]: { ...prev[sh], tin: e.target.value },
                        }))
                      }
                      className="font-mono-num rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs"
                    />
                    <input
                      type="time"
                      value={schedulesDraft[sh].tout}
                      onChange={(e) =>
                        setSchedulesDraft((prev) => ({
                          ...prev,
                          [sh]: { ...prev[sh], tout: e.target.value },
                        }))
                      }
                      className="font-mono-num rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs"
                    />
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={() => {
                  onUpdateState((prev) => ({
                    ...prev,
                    branches: prev.branches.map((b) =>
                      b.id === branch.id
                        ? {
                            ...b,
                            name: branchNameDraft.trim() || b.name,
                            shiftSchedules: schedulesDraft,
                          }
                        : b
                    ),
                  }));
                  onNotify('تم حفظ إعدادات الفرع ومواعيد الورديات');
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-sm font-extrabold text-white hover:bg-slate-800"
              >
                <Check className="h-4 w-4" />
                <span>حفظ إعدادات الفرع</span>
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="mb-1 text-base font-extrabold text-slate-900">
                استعادة القائمة الافتراضية
              </h3>
              <p className="mb-4 text-xs text-slate-500">
                استعادة الفريق الأساسي للفرع وإزالة التعديلات اليومية المؤقتة
              </p>
              <button
                type="button"
                onClick={() => {
                  const fresh = createSeedState();
                  const freshBranch = fresh.branches.find((b) => b.id === branch.id);
                  if (!freshBranch) {
                    onNotify('هذا الفرع مضاف حديثاً ولا توجد له قائمة افتراضية مسبقة');
                    return;
                  }
                  onUpdateState((prev) => ({
                    ...prev,
                    branches: prev.branches.map((b) =>
                      b.id === branch.id ? { ...freshBranch, pin: b.pin } : b
                    ),
                  }));
                  onNotify(`تمت استعادة القائمة الافتراضية لفرع ${branch.name}`);
                }}
                className="flex items-center gap-2 rounded-xl border border-rose-300 bg-rose-50 px-4 py-2.5 text-xs font-extrabold text-rose-800 hover:bg-rose-100"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>استعادة القائمة الافتراضية</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: تعديل أفراد الصباحي أو المسائي لهذا اليوم */}
      {editModalShift && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          onClick={() => setEditModalShift(null)}
        >
          <div
            className="max-h-[88vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  تعديل أفراد {editModalShift === 'morning' ? 'الصباحي' : 'المسائي'} —{' '}
                  {activeDayObj.arName} ({activeDayObj.shortDate})
                </h3>
                <p className="text-xs text-slate-500">
                  بدّل شفت أو إجازة الموظف لهذا اليوم فقط دون تعديل الجدول الأساسي
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditModalShift(null)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                إغلاق
              </button>
            </div>

            <div className="space-y-2.5">
              {editModalItems.map((p) => (
                <div
                  key={p.emp.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3"
                >
                  <div>
                    <div className="text-sm font-extrabold text-slate-900">{p.emp.name}</div>
                    <div className="text-xs text-slate-500">
                      الأساسي: {SHIFTS_AR[p.emp.shift]}
                      {p.isOverridden ? ' · معدل لهذا اليوم' : ''}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={p.plannedShift}
                      onChange={(e) =>
                        setDailyOverride(p.emp.id, {
                          shift: e.target.value as ShiftType | 'off',
                        })
                      }
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-extrabold"
                    >
                      <option value="morning">صباحي</option>
                      <option value="between">بتوين</option>
                      <option value="evening">مسائي</option>
                      <option value="off">إجازة يومية</option>
                    </select>

                    {p.isOverridden && (
                      <button
                        type="button"
                        onClick={() => setDailyOverride(p.emp.id, null)}
                        className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
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

      {/* Modal: الإجازة الشهرية بالساعة الدائرية */}
      {leaveEmp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          onClick={() => setLeaveEmpId(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  إجازة شهرية — {leaveEmp.name}
                </h3>
                <p className="text-xs text-slate-500">
                  اختيار الشهر واليوم عبر الساعة الدائرية
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLeaveEmpId(null)}
                className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-bold"
              >
                إغلاق
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-600">
                  بداية الإجازة (الشهر واليوم)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={leaveStartIso}
                    onClick={() => setDialOpen(true)}
                    className="font-mono-num w-full cursor-pointer rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-bold"
                  />
                  <button
                    type="button"
                    onClick={() => setDialOpen(true)}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white"
                  >
                    اختيار
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-600">
                  عدد أيام الإجازة
                </label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={leaveDaysCount}
                  onChange={(e) => setLeaveDaysCount(Number(e.target.value) || 1)}
                  className="font-mono-num w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold"
                />
              </div>

              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={leaveSkipWeekly}
                  onChange={(e) => setLeaveSkipWeekly(e.target.checked)}
                />
                <span>لا يأخذ إجازته الأسبوعية في نفس الأسبوع بعد الإجازة الشهرية</span>
              </label>

              <input
                type="text"
                placeholder="ملاحظة (اختياري) مثال: إجازة شهر نوفمبر"
                value={leaveNote}
                onChange={(e) => setLeaveNote(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />

              <button
                type="button"
                onClick={handleSaveMonthlyLeave}
                className="w-full rounded-xl bg-slate-900 py-2.5 text-sm font-bold text-white hover:bg-slate-800"
              >
                حفظ الإجازة الشهرية
              </button>
            </div>

            <div className="mt-5 border-t border-slate-100 pt-4">
              <div className="mb-2 text-xs font-extrabold text-slate-700">
                الإجازات الشهرية المسجلة ({(leaveEmp.monthlyLeaves || []).length})
              </div>
              {(leaveEmp.monthlyLeaves || []).length === 0 ? (
                <p className="text-xs text-slate-400">
                  لا توجد إجازات شهرية مسجلة لهذا الموظف بعد.
                </p>
              ) : (
                <ul className="space-y-2">
                  {(leaveEmp.monthlyLeaves || []).map((ml) => (
                    <li
                      key={ml.id}
                      className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
                    >
                      <div>
                        <span className="font-mono-num font-bold">{ml.startDate}</span> ·{' '}
                        <span>{ml.daysCount} أيام</span>
                        <div className="text-[11px] text-slate-500">
                          {ml.skipWeeklyInSameWeek
                            ? 'بدون إجازة أسبوعية في نفس الأسبوع'
                            : 'مع احتساب الإجازة الأسبوعية'}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteMonthlyLeave(ml.id)}
                        className="font-bold text-rose-700 hover:underline"
                      >
                        حذف
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      <DateDialModal
        open={dialOpen}
        year={Number(leaveStartIso.split('-')[0]) || cairoToday.year}
        month1={Number(leaveStartIso.split('-')[1]) || cairoToday.month + 1}
        day={Number(leaveStartIso.split('-')[2]) || cairoToday.day}
        onCancel={() => setDialOpen(false)}
        onConfirm={(res) => {
          setLeaveStartIso(res.iso);
          setDialOpen(false);
        }}
      />
    </div>
  );
};
