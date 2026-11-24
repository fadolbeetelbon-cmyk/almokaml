import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Plus,
  Send,
  Settings,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  addDaysIso,
  buildPlannedRowsForShift,
  computeDayPlanForBranch,
  evaluateAvailabilityCompliance,
  fmtDateAr,
  getCairoToday,
  SHIFT_FULL_AR,
  SHIFT_START_DESC,
  SHIFTS_AR,
  submissionKey,
  UNAVAILABLE_REASONS,
} from '../data/seed';
import {
  AppState,
  AvailabilityRow,
  Branch,
  Employee,
  SessionState,
  ShiftType,
} from '../types';

interface BranchAvailabilityViewProps {
  state: AppState;
  session: SessionState;
  branch: Branch;
  onChangeSession: (patch: Partial<SessionState>) => void;
  onUpdateState: (updater: (prev: AppState) => AppState) => void;
  onNotify: (msg: string) => void;
  onOpenPlanner: () => void;
}

export const BranchAvailabilityView: React.FC<BranchAvailabilityViewProps> = ({
  state,
  session,
  branch,
  onChangeSession,
  onUpdateState,
  onNotify,
  onOpenPlanner,
}) => {
  const tomorrowIso = useMemo(() => addDaysIso(getCairoToday().iso, 1), []);
  const { branchScreen, activeShift } = session;

  // Draft rows when branch manager is on the `submit` screen
  const [draftRows, setDraftRows] = useState<AvailabilityRow[]>([]);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  // Emergency modal (after submitting availability)
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [emergencyEmpId, setEmergencyEmpId] = useState<string | null>(null);
  const [emergencyReason, setEmergencyReason] = useState<string>('');

  // Simple add-employee form in branch settings
  const [newName, setNewName] = useState('');
  const [newShift, setNewShift] = useState<ShiftType>('morning');

  const tomorrowPlan = useMemo(
    () => computeDayPlanForBranch(state, branch.id, tomorrowIso),
    [state, branch.id, tomorrowIso]
  );

  // Initialize draft rows whenever entering submit screen or switching shift
  useEffect(() => {
    if (branchScreen !== 'submit') return;
    const key = submissionKey(branch.id, activeShift, tomorrowIso);
    const existing = state.submissions[key];
    const includesBetween = activeShift === 'morning' || activeShift === 'evening';
    const shiftEmps = tomorrowPlan.filter(
      (p) =>
        p.plannedShift === activeShift ||
        (includesBetween && p.plannedShift === 'between') ||
        (p.plannedShift === 'off' &&
          (p.emp.shift === activeShift || (includesBetween && p.emp.shift === 'between')))
    );

    if (existing) {
      // Preserve saved choices while ensuring any newly added shift staff are also visible
      const existingMap = new Map(existing.rows.map((r) => [r.empId, r]));
      const merged: AvailabilityRow[] = shiftEmps.map((p) => {
        const prev = existingMap.get(p.emp.id);
        if (prev) return { ...prev };
        return {
          empId: p.emp.id,
          empName: p.emp.name,
          status: 'available',
          reason: null,
        };
      });
      setDraftRows(merged);
    } else {
      setDraftRows(
        shiftEmps.map((p) => ({
          empId: p.emp.id,
          empName: p.emp.name,
          status: 'available',
          reason: null,
        }))
      );
    }
  }, [branchScreen, activeShift, branch.id, tomorrowIso, state.submissions, tomorrowPlan]);

  // Transfer notices addressed to this branch
  const myTransferNotices = useMemo(
    () =>
      state.transferNotices.filter(
        (t) => t.targetBranchId === branch.id && !t.acknowledged
      ),
    [state.transferNotices, branch.id]
  );

  // Only Morning & Evening main shifts (Between is embedded inside both!)
  const visibleShifts: ShiftType[] = ['morning', 'evening'];

  // All submitted rows across shifts for tomorrow (for the Emergency modal)
  const submittedForTomorrow = useMemo(() => {
    const list: Array<{ shift: ShiftType; rows: AvailabilityRow[] }> = [];
    (['morning', 'evening'] as ShiftType[]).forEach((sh) => {
      const sub = state.submissions[submissionKey(branch.id, sh, tomorrowIso)];
      if (sub) list.push({ shift: sh, rows: sub.rows });
    });
    return list;
  }, [state.submissions, branch.id, tomorrowIso]);

  const liveCompliance = useMemo(
    () =>
      evaluateAvailabilityCompliance(
        state,
        branch.id,
        activeShift,
        tomorrowIso,
        draftRows
      ),
    [state, branch.id, activeShift, tomorrowIso, draftRows]
  );

  const availCount = draftRows.filter((r) => r.status === 'available').length;
  const unavailCount = draftRows.filter((r) => r.status === 'unavailable').length;

  const handleApplyPlanToDraft = () => {
    const plannedRows = buildPlannedRowsForShift(
      state,
      branch.id,
      activeShift,
      tomorrowIso
    );
    setDraftRows(plannedRows);
    onNotify('تم ضبط القائمة حسب الخطة الأسبوعية للغد');
  };

  const handleSubmitAvailability = () => {
    const key = submissionKey(branch.id, activeShift, tomorrowIso);
    const compliance = evaluateAvailabilityCompliance(
      state,
      branch.id,
      activeShift,
      tomorrowIso,
      draftRows
    );
    const isMatched = compliance.status === 'matched';
    const timeNow = new Date().toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
    });

    onUpdateState((prev) => ({
      ...prev,
      submissions: {
        ...prev.submissions,
        [key]: {
          key,
          branchId: branch.id,
          shift: activeShift,
          shiftDate: tomorrowIso,
          submittedAt: timeNow,
          rows: draftRows,
          compliance,
        },
      },
      audit: [
        ...prev.audit,
        {
          id: Date.now(),
          time: timeNow,
          text: isMatched
            ? `إرسال توفر الغد (${SHIFT_FULL_AR[activeShift]}): فرع ${branch.name} — مطابق للخطة الأسبوعية`
            : `إرسال توفر الغد (${SHIFT_FULL_AR[activeShift]}): فرع ${branch.name} — ${compliance.diffs.length} اختلاف عن الخطة`,
        },
      ],
      notifications: [
        ...prev.notifications,
        {
          id: `ncmp_${Date.now()}_${Math.random()}`,
          kind: isMatched ? 'compliance_ok' : 'compliance_diff',
          senderRole: 'branch',
          senderName: `فرع ${branch.name}`,
          recipientRole: 'central',
          branchId: branch.id,
          shift: activeShift,
          shiftDate: tomorrowIso,
          text: isMatched
            ? `إرسال فرع ${branch.name} (${SHIFTS_AR[activeShift]} - غداً) مطابق للخطة الأسبوعية (${compliance.actualCount} متاح)`
            : `تنبيه: إرسال فرع ${branch.name} (${SHIFTS_AR[activeShift]} - غداً) به ${compliance.diffs.length} اختلاف عن الخطة الأسبوعية`,
          time: timeNow,
          read: false,
          complianceReport: compliance,
        },
      ],
    }));

    setConfirmModalOpen(false);
    onChangeSession({ branchScreen: 'home' });
    onNotify(
      isMatched
        ? 'تم إرسال التوفر — مطابق للخطة الأسبوعية وتم إشعار الأدمن'
        : `تم إرسال التوفر — أُبلغ الأدمن بوجود ${compliance.diffs.length} اختلاف عن الخطة`
    );
  };

  const handleAckTransfer = (id: string) => {
    onUpdateState((prev) => ({
      ...prev,
      transferNotices: prev.transferNotices.map((t) =>
        t.id === id ? { ...t, acknowledged: true } : t
      ),
    }));
  };

  const handleConfirmEmergency = (shift: ShiftType, empId: string) => {
    if (!emergencyReason) return;
    const reasonLabel =
      emergencyReason === 'with_permission' ? 'غياب بإذن' : 'غياب بدون إذن';
    const key = submissionKey(branch.id, shift, tomorrowIso);
    const sub = state.submissions[key];
    if (!sub) return;
    const targetRow = sub.rows.find((r) => r.empId === empId);
    if (!targetRow) return;

    const timeNow = new Date().toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const nextRows = sub.rows.map((r) =>
      r.empId === empId
        ? { ...r, status: 'unavailable' as const, reason: reasonLabel, emergency: true }
        : r
    );
    const nextCompliance = evaluateAvailabilityCompliance(
      state,
      branch.id,
      shift,
      tomorrowIso,
      nextRows
    );

    onUpdateState((prev) => ({
      ...prev,
      submissions: {
        ...prev.submissions,
        [key]: {
          ...sub,
          rows: nextRows,
          compliance: nextCompliance,
        },
      },
      emergencyNotices: [
        ...prev.emergencyNotices,
        {
          id: `emg_${Date.now()}`,
          branchId: branch.id,
          branchName: branch.name,
          shift,
          shiftDate: tomorrowIso,
          employeeId: empId,
          employeeName: targetRow.empName,
          reason: reasonLabel,
          time: timeNow,
          acknowledged: false,
        },
      ],
      notifications: [
        ...prev.notifications,
        {
          id: `nemg_${Date.now()}`,
          kind: 'emergency',
          senderRole: 'branch',
          senderName: `فرع ${branch.name}`,
          recipientRole: 'central',
          branchId: branch.id,
          shift,
          shiftDate: tomorrowIso,
          text: `تغيير طارئ في فرع ${branch.name} (${SHIFTS_AR[shift]}): ${targetRow.empName} — ${reasonLabel}`,
          time: timeNow,
          read: false,
          complianceReport: nextCompliance,
        },
      ],
      audit: [
        ...prev.audit,
        {
          id: Date.now(),
          time: timeNow,
          text: `تغيير طارئ: ${targetRow.empName} (${branch.name} - ${SHIFTS_AR[shift]}) · ${reasonLabel}`,
        },
      ],
    }));

    setEmergencyEmpId(null);
    setEmergencyReason('');
    onNotify(`تم تسجيل الغياب الطارئ لـ ${targetRow.empName} وإشعار الأدمن`);
  };

  // ==========================================
  // SCREEN 1: BRANCH HOME (توفر وردية الغد)
  // ==========================================
  if (branchScreen === 'home') {
    return (
      <div className="mx-auto max-w-xl space-y-5">
        {/* Branch Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900">فرع {branch.name}</h1>
            <p className="text-xs font-semibold text-slate-500">
              إرسال توفر ورديات الغد: {fmtDateAr(tomorrowIso)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenPlanner}
              className="flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900 hover:bg-amber-100"
            >
              <CalendarDays className="h-3.5 w-3.5" />
              <span>خطة الورديات</span>
            </button>
            <button
              type="button"
              onClick={() => onChangeSession({ branchScreen: 'settings' })}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              <Settings className="h-3.5 w-3.5" />
              <span>الإعدادات</span>
            </button>
          </div>
        </div>

        {/* Transfer notices from Admin */}
        {myTransferNotices.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-xs font-extrabold text-rose-700">
              تعديلات جديدة على الورديات ({myTransferNotices.length})
            </h2>
            {myTransferNotices.map((n) => (
              <div
                key={n.id}
                className="rounded-xl border border-rose-200 bg-rose-50/70 p-4"
              >
                <div className="text-xs font-bold text-rose-700">
                  {SHIFT_FULL_AR[n.shift]} · {fmtDateAr(n.shiftDate)}
                </div>
                <div className="mt-1 text-sm font-bold text-slate-900">{n.text}</div>
                <div className="text-xs text-slate-600">{n.typeLabel}</div>
                <button
                  type="button"
                  onClick={() => handleAckTransfer(n.id)}
                  className="mt-3 w-full rounded-lg bg-rose-700 py-2 text-xs font-bold text-white hover:bg-rose-800"
                >
                  تم الاطلاع
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Shift Cards: توفر وردية الغد */}
        <div>
          <h2 className="mb-3 text-base font-extrabold text-slate-800">
            توفر وردية الغد
          </h2>

          <div className="space-y-3.5">
            {visibleShifts.map((sh) => {
              const sub = state.submissions[submissionKey(branch.id, sh, tomorrowIso)];
              const plannedMain = tomorrowPlan.filter((p) => p.plannedShift === sh).length;
              const plannedBetween = tomorrowPlan.filter((p) => p.plannedShift === 'between').length;
              const offCount = tomorrowPlan.filter(
                (p) =>
                  p.plannedShift === 'off' &&
                  (p.emp.shift === sh || p.emp.shift === 'between')
              ).length;

              return (
                <div
                  key={sh}
                  id={`branchShiftCard_${sh}`}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-extrabold text-slate-900">
                        {SHIFT_FULL_AR[sh]}
                      </p>
                      <p className="font-mono-num text-xs font-semibold text-slate-500">
                        {SHIFT_START_DESC[sh]}
                      </p>
                      <p className="mt-2 text-xs font-bold text-amber-800">
                        الخطة للغد:{' '}
                        <span className="font-mono-num">{plannedMain}</span> متاح
                        {plannedBetween > 0 && (
                          <span>
                            {' '}
                            + {plannedBetween} بتوين (
                            {sh === 'morning' ? 'من ١٠:٠٠ ص' : 'حتى ١١:٠٠ م'})
                          </span>
                        )}
                        {offCount > 0 ? ` · ${offCount} إجازة` : ''}
                      </p>
                    </div>

                    {sub ? (
                      <span
                        className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold ${
                          sub.compliance.status === 'matched'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {sub.compliance.status === 'matched' ? (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>أُرسل · مطابق للخطة</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="h-3.5 w-3.5" />
                            <span>أُرسل · {sub.compliance.diffs.length} اختلاف</span>
                          </>
                        )}
                      </span>
                    ) : (
                      <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">
                        لم يُرسل بعد
                      </span>
                    )}
                  </div>

                  <button
                    id={`registerTomorrowBtn_${sh}`}
                    type="button"
                    onClick={() =>
                      onChangeSession({ activeShift: sh, branchScreen: 'submit' })
                    }
                    className={`mt-4 w-full rounded-xl py-3.5 text-base font-extrabold transition-colors ${
                      sub
                        ? 'border border-slate-300 bg-slate-50 text-slate-800 hover:bg-slate-100'
                        : 'bg-slate-900 text-white hover:bg-slate-800'
                    }`}
                  >
                    {sub ? 'تعديل توفر الغد' : 'تسجيل وإرسال توفر الغد'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Emergency Changes Button */}
        <div>
          <button
            type="button"
            disabled={submittedForTomorrow.length === 0}
            onClick={() => setEmergencyOpen(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 py-3 text-sm font-extrabold text-rose-800 hover:bg-rose-100 disabled:opacity-45"
          >
            <ClipboardList className="h-4 w-4" />
            <span>موظفو الغد والتغيير الطارئ</span>
          </button>
          {submittedForTomorrow.length === 0 && (
            <p className="mt-1.5 text-center text-xs text-slate-400">
              تظهر القائمة بعد إرسال توفر الوردية.
            </p>
          )}
        </div>

        {/* Emergency Modal */}
        {emergencyOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
            onClick={() => setEmergencyOpen(false)}
          >
            <div
              className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-extrabold text-slate-900">
                  موظفو الغد والتغيير الطارئ
                </h3>
                <button
                  type="button"
                  onClick={() => setEmergencyOpen(false)}
                  className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-bold text-slate-600"
                >
                  إغلاق
                </button>
              </div>

              <div className="space-y-4">
                {submittedForTomorrow.map(({ shift, rows }) => (
                  <div key={shift}>
                    <div className="mb-2 flex items-center justify-between text-xs font-extrabold">
                      <span className="text-slate-900">{SHIFT_FULL_AR[shift]}</span>
                      <span className="text-emerald-700">
                        متاح: {rows.filter((r) => !r.movedOut && r.status === 'available').length}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {rows.map((r) => (
                        <div
                          key={r.empId}
                          className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <span
                                className={`text-sm font-bold ${
                                  r.movedOut
                                    ? 'text-slate-400 line-through'
                                    : r.status === 'available'
                                    ? 'text-slate-900'
                                    : 'text-slate-500'
                                }`}
                              >
                                {r.empName}
                              </span>
                              {r.note && (
                                <p className="mt-0.5 text-xs text-amber-700">{r.note}</p>
                              )}
                            </div>

                            {r.movedOut ? null : r.status === 'available' ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setEmergencyReason('');
                                  setEmergencyEmpId((cur) =>
                                    cur === r.empId ? null : r.empId
                                  );
                                }}
                                className="rounded-lg bg-rose-100 px-2.5 py-1 text-xs font-bold text-rose-800 hover:bg-rose-200"
                              >
                                تغيير طارئ
                              </button>
                            ) : (
                              <span className="text-xs font-bold text-rose-700">
                                {r.emergency ? 'طارئ: ' : 'غائب: '}
                                {r.reason || ''}
                              </span>
                            )}
                          </div>

                          {emergencyEmpId === r.empId &&
                            r.status === 'available' &&
                            !r.movedOut && (
                              <div className="mt-3 space-y-2 border-t border-slate-200 pt-2.5">
                                <select
                                  value={emergencyReason}
                                  onChange={(e) => setEmergencyReason(e.target.value)}
                                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold"
                                >
                                  <option value="">اختر سبب الغياب</option>
                                  <option value="with_permission">غياب بإذن</option>
                                  <option value="without_permission">غياب بدون إذن</option>
                                </select>
                                <button
                                  type="button"
                                  disabled={!emergencyReason}
                                  onClick={() => handleConfirmEmergency(shift, r.empId)}
                                  className="w-full rounded-lg bg-rose-700 py-2 text-xs font-bold text-white disabled:opacity-45"
                                >
                                  تأكيد التغيير الطارئ
                                </button>
                              </div>
                            )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // SCREEN 2: SUBMIT AVAILABILITY (تسجيل الحاضر غداً)
  // ==========================================
  if (branchScreen === 'submit') {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-extrabold text-slate-900">موظفو الفرع</h1>
            <p className="text-xs font-semibold text-slate-500">
              {SHIFT_FULL_AR[activeShift]} · غداً ({fmtDateAr(tomorrowIso)})
            </p>
          </div>
          <button
            type="button"
            onClick={() => onChangeSession({ branchScreen: 'home' })}
            className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            <ArrowRight className="h-3.5 w-3.5" />
            <span>رجوع</span>
          </button>
        </div>

        {/* One-Tap Auto-Fill + Live Compliance Preview */}
        <div
          id="compliancePreviewBox"
          className={`rounded-xl border p-3.5 ${
            liveCompliance.status === 'matched'
              ? 'border-emerald-200 bg-emerald-50/70'
              : 'border-amber-300 bg-amber-50/70'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold">
              {liveCompliance.status === 'matched' ? (
                <>
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" />
                  <span className="text-emerald-900">
                    التحديد الحالي مطابق تماماً لخطة الغد الأسبوعية
                  </span>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700" />
                  <span className="text-amber-950">
                    اختلاف عن خطة الغد الأسبوعية ({liveCompliance.diffs.length}) — سيصل تنبيه للأدمن
                  </span>
                </>
              )}
            </div>

            <button
              id="autoFillFromPlanBtn"
              type="button"
              onClick={handleApplyPlanToDraft}
              className="flex items-center gap-2 rounded-xl border-2 border-amber-400 bg-white px-4 py-2.5 text-sm font-extrabold text-amber-950 hover:bg-amber-100"
            >
              <Sparkles className="h-4 w-4 text-amber-600" />
              <span>تعبئة حسب خطة الغد</span>
            </button>
          </div>
        </div>

        {/* Ultra-Simple Employee Availability Cards */}
        {draftRows.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            لا يوجد موظفون مسجلون في هذه الوردية. أضفهم من الإعدادات أو خطة الورديات أولاً.
          </div>
        ) : (
          <div className="space-y-3">
            {draftRows.map((row) => {
              const planItem = tomorrowPlan.find((p) => p.emp.id === row.empId);
              const isPlannedOff = planItem?.plannedShift === 'off';
              const isBetween =
                planItem?.plannedShift === 'between' || planItem?.emp.shift === 'between';

              return (
                <div
                  key={row.empId}
                  className="rounded-2xl border border-slate-200 bg-white p-4"
                >
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-extrabold text-slate-900">
                        {row.empName}
                      </span>
                      {isBetween && (
                        <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-extrabold text-amber-900">
                          بتوين ({activeShift === 'morning' ? 'من ١٠:٠٠ ص' : 'حتى ١١:٠٠ م'})
                        </span>
                      )}
                    </div>
                    {planItem && (
                      <span
                        className={`rounded-lg px-2.5 py-1 text-xs font-extrabold ${
                          isPlannedOff
                            ? 'bg-rose-50 text-rose-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {isPlannedOff
                          ? `خطة الغد: غير متاح (${planItem.reason})`
                          : `خطة الغد: ${SHIFTS_AR[activeShift]}`}
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setDraftRows((prev) =>
                          prev.map((x) =>
                            x.empId === row.empId
                              ? { ...x, status: 'available', reason: null }
                              : x
                          )
                        )
                      }
                      className={`flex-1 rounded-xl py-2.5 text-sm font-extrabold transition-colors ${
                        row.status === 'available'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      ✓ حضور
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setDraftRows((prev) =>
                          prev.map((x) =>
                            x.empId === row.empId
                              ? {
                                  ...x,
                                  status: 'unavailable',
                                  reason: x.reason || 'إجازة رسمية',
                                }
                              : x
                          )
                        )
                      }
                      className={`flex-1 rounded-xl py-2.5 text-sm font-extrabold transition-colors ${
                        row.status === 'unavailable'
                          ? 'bg-rose-700 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      ✕ غير متاح
                    </button>
                  </div>

                  {row.status === 'unavailable' && (
                    <select
                      value={row.reason || ''}
                      onChange={(e) =>
                        setDraftRows((prev) =>
                          prev.map((x) =>
                            x.empId === row.empId ? { ...x, reason: e.target.value } : x
                          )
                        )
                      }
                      className="mt-2.5 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800"
                    >
                      <option value="">اختر السبب</option>
                      {UNAVAILABLE_REASONS.map((rs) => (
                        <option key={rs} value={rs}>
                          {rs}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Counters + Prominent Primary Send Button */}
        {draftRows.length > 0 && (
          <div className="space-y-3 rounded-2xl border-2 border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex justify-between text-base font-extrabold">
              <span className="text-emerald-700">✓ متاح: {availCount}</span>
              <span className="text-rose-700">✕ غير متاح: {unavailCount}</span>
            </div>

            <button
              id="sendAvailabilityBtn"
              type="button"
              onClick={() => setConfirmModalOpen(true)}
              className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-slate-900 py-5 text-lg font-extrabold text-white shadow-md hover:bg-slate-800"
            >
              <Send className="h-5 w-5 text-amber-300" />
              <span>إرسال توفر وردية الغد</span>
            </button>
          </div>
        )}

        {/* Confirm Modal */}
        {confirmModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
            onClick={() => setConfirmModalOpen(false)}
          >
            <div
              className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="mb-3 text-base font-extrabold text-slate-900">تأكيد الإرسال</h3>
              <div className="space-y-1.5 text-sm font-bold text-slate-700">
                <p className="text-emerald-700">متاح: {availCount}</p>
                <p className="text-rose-700">غير متاح: {unavailCount}</p>
              </div>
              <div
                className={`mt-3 rounded-lg border p-2.5 text-xs font-bold ${
                  liveCompliance.status === 'matched'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-amber-200 bg-amber-50 text-amber-900'
                }`}
              >
                {liveCompliance.status === 'matched'
                  ? '✓ مطابق للخطة الأسبوعية — سيتم إشعار الأدمن بذلك'
                  : `⚠️ يوجد ${liveCompliance.diffs.length} اختلاف عن الخطة الأسبوعية — سيصل تنبيه للأدمن`}
              </div>
              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmModalOpen(false)}
                  className="flex-1 rounded-lg border border-slate-200 py-2.5 text-xs font-bold text-slate-700"
                >
                  رجوع
                </button>
                <button
                  id="confirmSendBtn"
                  type="button"
                  onClick={handleSubmitAvailability}
                  className="flex-1 rounded-lg bg-slate-900 py-2.5 text-xs font-extrabold text-white hover:bg-slate-800"
                >
                  تأكيد الإرسال
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // SCREEN 3: SIMPLE BRANCH EMPLOYEES SETTINGS
  // ==========================================
  const handleAddBranchEmp = () => {
    const name = newName.trim();
    if (!name) {
      onNotify('أدخل اسم الموظف');
      return;
    }
    const emp: Employee = {
      id: `e_${branch.id}_${Date.now()}`,
      name,
      shift: newShift,
      suspended: false,
      weeklyOffDay: 5,
      extraOffDay1: null,
      extraOffDay2: null,
      monthlyLeaves: [],
    };
    onUpdateState((prev) => ({
      ...prev,
      branches: prev.branches.map((b) =>
        b.id === branch.id ? { ...b, emps: [...b.emps, emp] } : b
      ),
    }));
    setNewName('');
    onNotify(`تمت إضافة ${name} لفريق الفرع وخطة الورديات`);
  };

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-extrabold text-slate-900">
          إعدادات موظفي فرع {branch.name}
        </h1>
        <button
          type="button"
          onClick={() => onChangeSession({ branchScreen: 'home' })}
          className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700"
        >
          <ArrowRight className="h-3.5 w-3.5" />
          <span>عودة</span>
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-extrabold text-slate-900">إضافة موظف جديد</h2>
        <div className="space-y-2.5">
          <input
            type="text"
            placeholder="اسم الموظف"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <select
            value={newShift}
            onChange={(e) => setNewShift(e.target.value as ShiftType)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold"
          >
            <option value="morning">الوردية الصباحية</option>
            <option value="between">وردية بتوين</option>
            <option value="evening">الوردية المسائية</option>
          </select>
          <button
            type="button"
            onClick={handleAddBranchEmp}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-slate-900 py-2.5 text-xs font-bold text-white"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>إضافة الموظف</span>
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-extrabold text-slate-900">
          موظفو الفرع ({branch.emps.filter((e) => !e.suspended).length})
        </h2>
        <div className="divide-y divide-slate-100">
          {branch.emps
            .filter((e) => !e.suspended)
            .map((emp) => (
              <div
                key={emp.id}
                className="flex items-center justify-between gap-2 py-2.5 text-sm"
              >
                <div>
                  <div className="font-bold text-slate-900">{emp.name}</div>
                  <div className="text-xs text-slate-500">
                    {SHIFTS_AR[emp.shift]}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onUpdateState((prev) => ({
                      ...prev,
                      branches: prev.branches.map((b) =>
                        b.id === branch.id
                          ? { ...b, emps: b.emps.filter((x) => x.id !== emp.id) }
                          : b
                      ),
                    }));
                    onNotify(`تم حذف ${emp.name}`);
                  }}
                  className="rounded-lg border border-rose-200 bg-rose-50 p-1.5 text-rose-700 hover:bg-rose-100"
                  aria-label={`حذف ${emp.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};
