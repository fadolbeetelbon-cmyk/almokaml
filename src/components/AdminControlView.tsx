import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  History,
  KeyRound,
  Plus,
  Settings,
  Users,
} from 'lucide-react';
import {
  addDaysIso,
  DEFAULT_SHIFT_SCHEDULES,
  evaluateAvailabilityCompliance,
  fmtDateAr,
  getCairoToday,
  normalizeDigits,
  SHIFT_FULL_AR,
  SHIFTS_AR,
  submissionKey,
} from '../data/seed';
import {
  AppState,
  AvailabilityRow,
  Branch,
  ComplianceReport,
  Employee,
  SessionState,
  ShiftType,
} from '../types';

interface AdminControlViewProps {
  state: AppState;
  session: SessionState;
  selectedCompliance: ComplianceReport | null;
  onCloseComplianceModal: () => void;
  onSelectCompliance: (rep: ComplianceReport) => void;
  onChangeSession: (patch: Partial<SessionState>) => void;
  onUpdateState: (updater: (prev: AppState) => AppState) => void;
  onNotify: (msg: string) => void;
  onOpenBranchPlanner: (branchId: string) => void;
}

interface BranchStatusRow {
  branch: Branch;
  required: number;
  available: number;
  diff: number;
  submitted: boolean;
  availableRows: AvailabilityRow[];
  compliance: ComplianceReport | null;
  category: 'deficit' | 'surplus' | 'stable';
}

export const AdminControlView: React.FC<AdminControlViewProps> = ({
  state,
  session,
  selectedCompliance,
  onCloseComplianceModal,
  onSelectCompliance,
  onChangeSession,
  onUpdateState,
  onNotify,
  onOpenBranchPlanner,
}) => {
  const tomorrowIso = useMemo(() => addDaysIso(getCairoToday().iso, 1), []);
  const { adminScreen, adminShift } = session;

  // Transfer modal state (when clicking a branch in Control Room)
  const [inspectBranchId, setInspectBranchId] = useState<string | null>(null);
  const [transferEmp, setTransferEmp] = useState<AvailabilityRow | null>(null);
  const [transferToBranchId, setTransferToBranchId] = useState<string>('');
  const [transferMode, setTransferMode] = useState<'temporary' | 'final'>('temporary');

  // Settings draft for required headcount per branch/shift
  const [reqDrafts, setReqDrafts] = useState<Record<string, Record<ShiftType, number>>>(() => {
    const map: Record<string, Record<ShiftType, number>> = {};
    state.branches.forEach((b) => {
      map[b.id] = { ...b.requiredByShift };
    });
    return map;
  });

  // Admin-only: PIN management drafts & New Branch form
  const [adminPinCurrent, setAdminPinCurrent] = useState('');
  const [adminPinNew, setAdminPinNew] = useState('');
  const [adminPinConfirm, setAdminPinConfirm] = useState('');
  const [branchPinDrafts, setBranchPinDrafts] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    state.branches.forEach((b) => {
      map[b.id] = b.pin;
    });
    return map;
  });

  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchPin, setNewBranchPin] = useState('');
  const [newBranchReq, setNewBranchReq] = useState<Record<ShiftType, number>>({
    morning: 3,
    between: 1,
    evening: 3,
  });

  // Keep drafts synced when branches are added or updated
  useEffect(() => {
    setReqDrafts((prev) => {
      const next = { ...prev };
      state.branches.forEach((b) => {
        if (!next[b.id]) next[b.id] = { ...b.requiredByShift };
      });
      return next;
    });
    setBranchPinDrafts((prev) => {
      const next = { ...prev };
      state.branches.forEach((b) => {
        if (next[b.id] === undefined) next[b.id] = b.pin;
      });
      return next;
    });
  }, [state.branches]);

  // Compute branch statuses for tomorrow's active shift
  const branchStatuses: BranchStatusRow[] = useMemo(() => {
    return state.branches.map((b) => {
      const sub = state.submissions[submissionKey(b.id, adminShift, tomorrowIso)];
      const required = b.requiredByShift[adminShift] ?? 3;
      const availableRows = sub
        ? sub.rows.filter((r) => !r.movedOut && r.status === 'available')
        : [];
      const available = sub ? availableRows.length : 0;
      const diff = sub ? available - required : 0;
      let category: 'deficit' | 'surplus' | 'stable' = 'stable';
      if (sub) {
        if (diff < 0) category = 'deficit';
        else if (diff > 0) category = 'surplus';
      }
      return {
        branch: b,
        required,
        available,
        diff,
        submitted: !!sub,
        availableRows,
        compliance: sub?.compliance || null,
        category,
      };
    });
  }, [state.branches, state.submissions, adminShift, tomorrowIso]);

  const deficits = branchStatuses.filter((b) => b.submitted && b.category === 'deficit');
  const surpluses = branchStatuses.filter((b) => b.submitted && b.category === 'surplus');
  const stables = branchStatuses.filter((b) => b.submitted && b.category === 'stable');
  const pendings = branchStatuses.filter((b) => !b.submitted);

  const unreadEmergency = useMemo(
    () => state.emergencyNotices.filter((n) => !n.acknowledged),
    [state.emergencyNotices]
  );

  const unreadComplianceNotifs = useMemo(
    () =>
      state.notifications.filter(
        (n) =>
          n.recipientRole === 'central' &&
          !n.read &&
          (n.kind === 'compliance_ok' || n.kind === 'compliance_diff')
      ),
    [state.notifications]
  );

  const inspectRow = branchStatuses.find((s) => s.branch.id === inspectBranchId) || null;
  const otherBranches = branchStatuses.filter((s) => s.branch.id !== inspectBranchId);

  const handleAckEmergency = (id: string) => {
    onUpdateState((prev) => ({
      ...prev,
      emergencyNotices: prev.emergencyNotices.map((n) =>
        n.id === id ? { ...n, acknowledged: true } : n
      ),
    }));
  };

  const handleAckNotification = (id: string) => {
    onUpdateState((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
    }));
  };

  const handleConfirmTransfer = () => {
    if (!inspectRow || !transferEmp || !transferToBranchId) return;
    const fromB = inspectRow.branch;
    const toB = state.branches.find((b) => b.id === transferToBranchId);
    if (!toB) return;

    const timeNow = new Date().toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
    });

    onUpdateState((prev) => {
      const fromKey = submissionKey(fromB.id, adminShift, tomorrowIso);
      const toKey = submissionKey(toB.id, adminShift, tomorrowIso);
      const nextSubmissions = { ...prev.submissions };

      // Mark movedOut in source branch submission
      if (nextSubmissions[fromKey]) {
        const updatedFromRows = nextSubmissions[fromKey].rows.map((r) =>
          r.empId === transferEmp.empId
            ? {
                ...r,
                movedOut: true,
                note: `نُقل إلى فرع ${toB.name} (${transferMode === 'final' ? 'نهائي' : 'مؤقت غداً'})`,
              }
            : r
        );
        nextSubmissions[fromKey] = {
          ...nextSubmissions[fromKey],
          rows: updatedFromRows,
          compliance: evaluateAvailabilityCompliance(
            prev,
            fromB.id,
            adminShift,
            tomorrowIso,
            updatedFromRows
          ),
        };
      }

      // Add into target branch submission if already submitted
      if (nextSubmissions[toKey]) {
        const incomingRow: AvailabilityRow = {
          ...transferEmp,
          movedOut: false,
          note: `قادم من فرع ${fromB.name} (${transferMode === 'final' ? 'نهائي' : 'مؤقت غداً'})`,
        };
        const updatedToRows = [
          ...nextSubmissions[toKey].rows.filter((r) => r.empId !== transferEmp.empId),
          incomingRow,
        ];
        nextSubmissions[toKey] = {
          ...nextSubmissions[toKey],
          rows: updatedToRows,
        };
      }

      // If final transfer, move Employee record permanently
      let nextBranches = prev.branches;
      if (transferMode === 'final') {
        const empObj: Employee | undefined = prev.branches
          .find((b) => b.id === fromB.id)
          ?.emps.find((e) => e.id === transferEmp.empId);
        if (empObj) {
          nextBranches = prev.branches.map((b) => {
            if (b.id === fromB.id) {
              return { ...b, emps: b.emps.filter((e) => e.id !== empObj.id) };
            }
            if (b.id === toB.id) {
              return { ...b, emps: [...b.emps, { ...empObj, shift: adminShift }] };
            }
            return b;
          });
        }
      }

      const typeLabel =
        transferMode === 'final' ? 'نقل نهائي' : 'نقل مؤقت لهذه الوردية';

      return {
        ...prev,
        branches: nextBranches,
        submissions: nextSubmissions,
        transferNotices: [
          ...prev.transferNotices,
          {
            id: `tr_in_${Date.now()}`,
            targetBranchId: toB.id,
            shift: adminShift,
            shiftDate: tomorrowIso,
            text: `انضم إلى فرعكم الموظف ${transferEmp.empName} قادماً من فرع ${fromB.name}`,
            typeLabel,
            time: timeNow,
            acknowledged: false,
          },
          {
            id: `tr_out_${Date.now() + 1}`,
            targetBranchId: fromB.id,
            shift: adminShift,
            shiftDate: tomorrowIso,
            text: `تم نقل الموظف ${transferEmp.empName} من فرعكم إلى فرع ${toB.name}`,
            typeLabel,
            time: timeNow,
            acknowledged: false,
          },
        ],
        audit: [
          ...prev.audit,
          {
            id: Date.now(),
            time: timeNow,
            text: `نقل ${transferEmp.empName} من ${fromB.name} إلى ${toB.name} (${typeLabel})`,
          },
        ],
      };
    });

    onNotify(`تم اعتماد نقل ${transferEmp.empName} إلى فرع ${toB.name}`);
    setTransferEmp(null);
    setInspectBranchId(null);
  };

  // ==========================================
  // SCREEN: ADMIN SETTINGS (إضافة فرع + كلمات السر + العدد المطلوب)
  // ==========================================
  if (adminScreen === 'settings') {
    const handleAddBranch = () => {
      const name = newBranchName.trim();
      const pin = normalizeDigits(newBranchPin);
      if (!name) {
        onNotify('أدخل اسم الفرع الجديد');
        return;
      }
      if (state.branches.some((b) => b.name.trim() === name)) {
        onNotify('يوجد فرع مسجل بنفس هذا الاسم بالفعل');
        return;
      }
      if (pin.length < 4) {
        onNotify('يجب أن يتكون رمز دخول الفرع من 4 أرقام على الأقل');
        return;
      }
      if (pin === state.adminPin || state.branches.some((b) => b.pin === pin)) {
        onNotify('هذا الرمز مستخدم بالفعل، اختر رمزاً آخر');
        return;
      }

      const newBranch: Branch = {
        id: `b_${Date.now()}`,
        name,
        pin,
        requiredByShift: { ...newBranchReq },
        emps: [],
        shiftSchedules: {
          morning: { ...DEFAULT_SHIFT_SCHEDULES.morning },
          between: { ...DEFAULT_SHIFT_SCHEDULES.between },
          evening: { ...DEFAULT_SHIFT_SCHEDULES.evening },
        },
      };

      const timeNow = new Date().toLocaleTimeString('ar-EG', {
        hour: '2-digit',
        minute: '2-digit',
      });

      onUpdateState((prev) => ({
        ...prev,
        branches: [...prev.branches, newBranch],
        audit: [
          ...prev.audit,
          {
            id: Date.now(),
            time: timeNow,
            text: `إضافة فرع جديد: ${name} (رمز الدخول ${pin})`,
          },
        ],
      }));
      setNewBranchName('');
      setNewBranchPin('');
      setNewBranchReq({ morning: 3, between: 1, evening: 3 });
      onNotify(`تمت إضافة فرع ${name} بنجاح`);
    };

    const handleChangeAdminPin = () => {
      const cur = normalizeDigits(adminPinCurrent);
      const next = normalizeDigits(adminPinNew);
      const conf = normalizeDigits(adminPinConfirm);
      if (cur !== state.adminPin) {
        onNotify('كلمة سر الأدمن الحالية غير صحيحة');
        return;
      }
      if (next.length < 4) {
        onNotify('يجب أن تتكون كلمة السر الجديدة من 4 أرقام على الأقل');
        return;
      }
      if (next !== conf) {
        onNotify('كلمة السر الجديدة وتأكيدها غير متطابقين');
        return;
      }
      if (state.branches.some((b) => b.pin === next)) {
        onNotify('هذا الرمز مستخدم لأحد الفروع، اختر رمزاً مختلفاً');
        return;
      }
      const timeNow = new Date().toLocaleTimeString('ar-EG', {
        hour: '2-digit',
        minute: '2-digit',
      });
      onUpdateState((prev) => ({
        ...prev,
        adminPin: next,
        audit: [
          ...prev.audit,
          {
            id: Date.now(),
            time: timeNow,
            text: `تحديث كلمة سر الأدمن المركزي`,
          },
        ],
      }));
      setAdminPinCurrent('');
      setAdminPinNew('');
      setAdminPinConfirm('');
      onNotify('تم تحديث كلمة سر الأدمن بنجاح');
    };

    const handleUpdateBranchPin = (b: Branch) => {
      const nextPin = normalizeDigits(branchPinDrafts[b.id] ?? '');
      if (nextPin.length < 4) {
        onNotify('رمز الفرع يجب أن يكون 4 أرقام على الأقل');
        return;
      }
      if (
        nextPin === state.adminPin ||
        state.branches.some((other) => other.id !== b.id && other.pin === nextPin)
      ) {
        onNotify('هذا الرمز مستخدم بالفعل لفرع آخر أو للأدمن');
        return;
      }
      const timeNow = new Date().toLocaleTimeString('ar-EG', {
        hour: '2-digit',
        minute: '2-digit',
      });
      onUpdateState((prev) => ({
        ...prev,
        branches: prev.branches.map((item) =>
          item.id === b.id ? { ...item, pin: nextPin } : item
        ),
        audit: [
          ...prev.audit,
          {
            id: Date.now(),
            time: timeNow,
            text: `تعديل رمز دخول فرع ${b.name} إلى ${nextPin}`,
          },
        ],
      }));
      onNotify(`تم تحديث كلمة سر فرع ${b.name}`);
    };

    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-extrabold text-slate-900">
            إعدادات الأدمن وإدارة الفروع
          </h1>
          <button
            type="button"
            onClick={() => onChangeSession({ adminScreen: 'control' })}
            className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700"
          >
            <ArrowRight className="h-3.5 w-3.5" />
            <span>عودة لغرفة التحكم</span>
          </button>
        </div>

        {/* 1. إضافة فرع جديد */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="mb-3 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-amber-700" />
            <h2 className="text-base font-extrabold text-slate-900">إضافة فرع جديد</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-600">
                اسم الفرع الجديد
              </label>
              <input
                type="text"
                placeholder="مثال: المعادي"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold outline-none focus:border-slate-900"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-600">
                كلمة سر الفرع (PIN)
              </label>
              <input
                type="text"
                inputMode="numeric"
                dir="ltr"
                placeholder={`مثال: 1234${state.branches.length + 1}`}
                value={newBranchPin}
                onChange={(e) => setNewBranchPin(normalizeDigits(e.target.value))}
                className="font-mono-num w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold outline-none focus:border-slate-900"
              />
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            {(['morning', 'evening'] as ShiftType[]).map((sh) => (
              <div key={sh}>
                <label className="mb-1 block text-[11px] font-bold text-slate-500">
                  المطلوب ({SHIFTS_AR[sh]})
                </label>
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={newBranchReq[sh]}
                  onChange={(e) =>
                    setNewBranchReq((prev) => ({
                      ...prev,
                      [sh]: Math.max(0, Number(e.target.value) || 0),
                    }))
                  }
                  className="font-mono-num w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-center text-sm font-bold"
                />
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={handleAddBranch}
            className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl bg-slate-900 py-2.5 text-sm font-extrabold text-white hover:bg-slate-800"
          >
            <Plus className="h-4 w-4 text-amber-300" />
            <span>إضافة الفرع</span>
          </button>
        </div>

        {/* 2. تغيير كلمات السر (للأدمن فقط) */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-5">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-amber-700" />
            <h2 className="text-base font-extrabold text-slate-900">
              إدارة كلمات السر (صلاحية الأدمن فقط)
            </h2>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-800">
                تغيير كلمة سر الأدمن المركزي
              </span>
              <span className="font-mono-num text-xs font-bold text-slate-500">
                الحالي: {state.adminPin}
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <input
                type="password"
                inputMode="numeric"
                dir="ltr"
                placeholder="الرمز الحالي"
                value={adminPinCurrent}
                onChange={(e) => setAdminPinCurrent(normalizeDigits(e.target.value))}
                className="font-mono-num rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-900"
              />
              <input
                type="password"
                inputMode="numeric"
                dir="ltr"
                placeholder="الرمز الجديد (4+)"
                value={adminPinNew}
                onChange={(e) => setAdminPinNew(normalizeDigits(e.target.value))}
                className="font-mono-num rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-900"
              />
              <input
                type="password"
                inputMode="numeric"
                dir="ltr"
                placeholder="تأكيد الجديد"
                value={adminPinConfirm}
                onChange={(e) => setAdminPinConfirm(normalizeDigits(e.target.value))}
                className="font-mono-num rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-900"
              />
            </div>
            <button
              type="button"
              onClick={handleChangeAdminPin}
              className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
            >
              تحديث كلمة سر الأدمن
            </button>
          </div>

          <div>
            <h3 className="mb-2 text-xs font-extrabold text-slate-700">
              كلمات سر دخول الفروع
            </h3>
            <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {state.branches.map((b) => (
                <div
                  key={b.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
                >
                  <div>
                    <span className="text-sm font-bold text-slate-900">{b.name}</span>
                    <span className="font-mono-num mr-2 text-xs text-slate-400">
                      (الحالي: {b.pin})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      dir="ltr"
                      value={branchPinDrafts[b.id] ?? b.pin}
                      onChange={(e) =>
                        setBranchPinDrafts((prev) => ({
                          ...prev,
                          [b.id]: normalizeDigits(e.target.value),
                        }))
                      }
                      className="font-mono-num w-28 rounded-lg border border-slate-300 px-2.5 py-1.5 text-center text-xs font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => handleUpdateBranchPin(b)}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 hover:bg-slate-50"
                    >
                      حفظ الرمز
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 3. إعدادات العدد المطلوب لكل فرع */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-1 text-base font-extrabold text-slate-900">
            إعدادات العدد المطلوب لكل فرع
          </h2>
          <p className="mb-4 text-xs text-slate-500">
            حدد العدد المطلوب في كل وردية ليقوم النظام بتصنيف الفروع تلقائياً (عجز / فائض / مستقر).
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-right text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 font-bold text-slate-600">
                  <th className="px-3 py-2.5">الفرع</th>
                  <th className="px-3 py-2.5 text-center">صباحي</th>
                  <th className="px-3 py-2.5 text-center">مسائي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {state.branches.map((b) => (
                  <tr key={b.id}>
                    <td className="px-3 py-2.5 font-extrabold text-slate-900">
                      {b.name}{' '}
                      <span className="font-mono-num text-[11px] font-normal text-slate-400">
                        ({b.pin})
                      </span>
                    </td>
                    {(['morning', 'evening'] as ShiftType[]).map((sh) => (
                      <td key={sh} className="px-3 py-2 text-center">
                        <input
                          type="number"
                          min={0}
                          max={20}
                          value={reqDrafts[b.id]?.[sh] ?? b.requiredByShift[sh]}
                          onChange={(e) => {
                            const val = Math.max(0, Number(e.target.value) || 0);
                            setReqDrafts((prev) => ({
                              ...prev,
                              [b.id]: { ...prev[b.id], [sh]: val },
                            }));
                          }}
                          className="font-mono-num w-16 rounded-lg border border-slate-300 px-2 py-1 text-center text-sm font-bold"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            onClick={() => {
              onUpdateState((prev) => ({
                ...prev,
                branches: prev.branches.map((b) => ({
                  ...b,
                  requiredByShift: reqDrafts[b.id] || b.requiredByShift,
                })),
              }));
              onNotify('تم حفظ الأعداد المطلوبة للفروع');
              onChangeSession({ adminScreen: 'control' });
            }}
            className="mt-4 w-full rounded-xl bg-slate-900 py-3 text-sm font-extrabold text-white hover:bg-slate-800"
          >
            حفظ الأعداد المطلوبة
          </button>
        </div>
      </div>
    );
  }

  // ==========================================
  // SCREEN: ADMIN HISTORY
  // ==========================================
  if (adminScreen === 'history') {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-extrabold text-slate-900">
            سجل الإرسالات والمطابقة والتحويلات
          </h1>
          <button
            type="button"
            onClick={() => onChangeSession({ adminScreen: 'control' })}
            className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700"
          >
            <ArrowRight className="h-3.5 w-3.5" />
            <span>عودة لغرفة التحكم</span>
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          {state.audit.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              لا توجد حركات مسجلة بعد.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {[...state.audit].reverse().map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-3 py-3 text-sm"
                >
                  <span className="font-semibold text-slate-800">{a.text}</span>
                  <span className="font-mono-num shrink-0 text-xs text-slate-400">
                    {a.time}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

  // ==========================================
  // SCREEN: CONTROL ROOM (غرفة التحكم التشغيلية)
  // ==========================================
  const renderBranchRow = (row: BranchStatusRow) => (
    <button
      key={row.branch.id}
      id={`adminBranchCard_${row.branch.id}`}
      type="button"
      onClick={() => {
        setInspectBranchId(row.branch.id);
        setTransferEmp(null);
      }}
      className="flex w-full flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-right transition-colors hover:border-slate-400"
    >
      <div className="flex items-center gap-3">
        <span className="text-base font-extrabold text-slate-900">
          {row.branch.name}
        </span>
        {row.submitted && row.compliance && (
          <span
            className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold ${
              row.compliance.status === 'matched'
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-amber-50 text-amber-800'
            }`}
          >
            {row.compliance.status === 'matched' ? (
              <>
                <CheckCircle2 className="h-3 w-3" />
                <span>مطابق للخطة</span>
              </>
            ) : (
              <>
                <AlertTriangle className="h-3 w-3" />
                <span>اختلاف عن الخطة ({row.compliance.diffs.length})</span>
              </>
            )}
          </span>
        )}
        {!row.submitted && (
          <span className="flex items-center gap-1 text-xs font-semibold text-slate-400">
            <Clock className="h-3 w-3" />
            <span>لم يُرسل بعد</span>
          </span>
        )}
      </div>

      <div className="font-mono-num text-sm font-extrabold text-slate-800">
        {row.submitted ? (
          <>
            {row.available} / {row.required}{' '}
            {row.diff !== 0 && (
              <span className={row.diff > 0 ? 'text-emerald-700' : 'text-rose-700'}>
                ({row.diff > 0 ? `+${row.diff}` : row.diff})
              </span>
            )}
          </>
        ) : (
          <span className="text-xs font-semibold text-slate-400">
            المطلوب: {row.required}
          </span>
        )}
      </div>
    </button>
  );

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      {/* Control Room Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">
            غرفة التحكم التشغيلية
          </h1>
          <p className="text-xs font-semibold text-slate-500">
            جاهزية الفروع قبل الشفت بيوم · {fmtDateAr(tomorrowIso)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg bg-slate-200/70 p-1">
            {(['morning', 'evening'] as ShiftType[]).map((sh) => (
              <button
                key={sh}
                type="button"
                onClick={() => onChangeSession({ adminShift: sh })}
                className={`rounded-md px-3.5 py-1.5 text-xs font-bold transition-colors ${
                  adminShift === sh
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {SHIFTS_AR[sh]}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => onChangeSession({ adminScreen: 'settings' })}
            className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            <Settings className="h-3.5 w-3.5" />
            <span>الإعدادات</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeSession({ adminScreen: 'history' })}
            className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            <History className="h-3.5 w-3.5" />
            <span>السجل</span>
          </button>
        </div>
      </div>

      {/* Live Plan Compliance Notifications Banner (The Core Merged Value) */}
      {unreadComplianceNotifs.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-extrabold text-amber-800">
            إشعارات مطابقة الخطة الأسبوعية ({unreadComplianceNotifs.length})
          </h2>
          {unreadComplianceNotifs.map((n) => (
            <div
              key={n.id}
              className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3.5 ${
                n.kind === 'compliance_ok'
                  ? 'border-emerald-200 bg-emerald-50/70'
                  : 'border-amber-300 bg-amber-50/70'
              }`}
            >
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                {n.kind === 'compliance_ok' ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" />
                ) : (
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700" />
                )}
                <span>{n.text}</span>
              </div>
              <div className="flex items-center gap-2">
                {n.complianceReport && (
                  <button
                    type="button"
                    onClick={() => onSelectCompliance(n.complianceReport!)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-bold text-slate-800 hover:bg-slate-50"
                  >
                    التفاصيل
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleAckNotification(n.id)}
                  className="rounded-lg bg-slate-900 px-3 py-1 text-xs font-bold text-white"
                >
                  تم الاطلاع
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Emergency Notices from Branches */}
      {unreadEmergency.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-extrabold text-rose-700">
            تغييرات طارئة من الفروع ({unreadEmergency.length})
          </h2>
          {unreadEmergency.map((e) => (
            <div
              key={e.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50/70 p-3.5"
            >
              <div>
                <div className="text-xs font-bold text-rose-700">
                  {SHIFT_FULL_AR[e.shift]} — فرع {e.branchName}
                </div>
                <div className="text-sm font-extrabold text-slate-900">
                  {e.employeeName} غائب: {e.reason}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleAckEmergency(e.id)}
                className="rounded-lg bg-rose-700 px-4 py-1.5 text-xs font-bold text-white hover:bg-rose-800"
              >
                تم الاطلاع
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 3 Operational Control Room Sections (عجز / فائض / مستقر) + بانتظار الإرسال */}
      <div className="space-y-5">
        <section>
          <h2 className="mb-2 text-sm font-extrabold text-rose-700">
            عجز ({deficits.length})
          </h2>
          {deficits.length === 0 ? (
            <p className="text-xs text-slate-400">لا يوجد عجز</p>
          ) : (
            <div className="space-y-2">{deficits.map(renderBranchRow)}</div>
          )}
        </section>

        <section>
          <h2 className="mb-2 text-sm font-extrabold text-emerald-700">
            فائض ({surpluses.length})
          </h2>
          {surpluses.length === 0 ? (
            <p className="text-xs text-slate-400">لا يوجد فائض</p>
          ) : (
            <div className="space-y-2">{surpluses.map(renderBranchRow)}</div>
          )}
        </section>

        <section>
          <h2 className="mb-2 text-sm font-extrabold text-sky-800">
            مستقر ({stables.length})
          </h2>
          {stables.length === 0 ? (
            <p className="text-xs text-slate-400">لا توجد فروع مستقرة مرسلة بعد</p>
          ) : (
            <div className="space-y-2">{stables.map(renderBranchRow)}</div>
          )}
        </section>

        {pendings.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-extrabold text-slate-500">
              بانتظار إرسال التوفر ({pendings.length})
            </h2>
            <div className="space-y-2">{pendings.map(renderBranchRow)}</div>
          </section>
        )}
      </div>

      {/* Modal: Branch Tomorrow Available Staff + Transfers + Plan Link */}
      {inspectRow && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          onClick={() => {
            setInspectBranchId(null);
            setTransferEmp(null);
          }}
        >
          <div
            className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {transferEmp ? (
              <div className="space-y-3">
                <h3 className="text-base font-extrabold text-slate-900">
                  نقل {transferEmp.empName}
                </h3>
                <p className="text-xs text-slate-500">من فرع: {inspectRow.branch.name}</p>

                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">
                    إلى فرع
                  </label>
                  <select
                    value={transferToBranchId}
                    onChange={(e) => setTransferToBranchId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold"
                  >
                    {otherBranches.map((ob) => (
                      <option key={ob.branch.id} value={ob.branch.id}>
                        {ob.branch.name} (
                        {!ob.submitted
                          ? 'لم يرسل'
                          : ob.diff < 0
                          ? `عجز ${Math.abs(ob.diff)}`
                          : ob.diff > 0
                          ? `فائض ${ob.diff}`
                          : 'مستقر'}
                        )
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">
                    نوع النقل
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setTransferMode('temporary')}
                      className={`flex-1 rounded-lg py-2 text-xs font-bold ${
                        transferMode === 'temporary'
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      مؤقت لهذه الوردية
                    </button>
                    <button
                      type="button"
                      onClick={() => setTransferMode('final')}
                      className={`flex-1 rounded-lg py-2 text-xs font-bold ${
                        transferMode === 'final'
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      نقل نهائي
                    </button>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setTransferEmp(null)}
                    className="flex-1 rounded-lg border border-slate-200 py-2.5 text-xs font-bold text-slate-700"
                  >
                    رجوع
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmTransfer}
                    className="flex-1 rounded-lg bg-slate-900 py-2.5 text-xs font-extrabold text-white"
                  >
                    اعتماد النقل
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">
                      الموظفون المتاحون غداً — {inspectRow.branch.name}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {SHIFT_FULL_AR[adminShift]} · {fmtDateAr(tomorrowIso)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setInspectBranchId(null)}
                    className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-bold text-slate-600"
                  >
                    إغلاق
                  </button>
                </div>

                {inspectRow.compliance && (
                  <div
                    className={`mb-4 rounded-xl border p-3 text-xs ${
                      inspectRow.compliance.status === 'matched'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                        : 'border-amber-200 bg-amber-50 text-amber-950'
                    }`}
                  >
                    <div className="font-extrabold">
                      {inspectRow.compliance.status === 'matched'
                        ? '✓ الإرسال مطابق للخطة الأسبوعية'
                        : `⚠️ اختلاف عن الخطة الأسبوعية (${inspectRow.compliance.diffs.length})`}
                    </div>
                    {inspectRow.compliance.diffs.length > 0 && (
                      <ul className="mt-1.5 space-y-1">
                        {inspectRow.compliance.diffs.map((d, idx) => (
                          <li key={idx}>• {d.summary}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {!inspectRow.submitted ? (
                  <p className="py-4 text-center text-sm text-slate-400">
                    لم يرسل مدير الفرع توفر هذه الوردية بعد.
                  </p>
                ) : inspectRow.availableRows.length === 0 ? (
                  <p className="py-4 text-center text-sm text-slate-400">
                    لا يوجد موظفون متاحون لهذه الوردية.
                  </p>
                ) : (
                  <div className="mb-4 space-y-2">
                    {inspectRow.availableRows.map((emp) => {
                      const empRecord = inspectRow.branch.emps.find((e) => e.id === emp.empId);
                      const isBtw = empRecord?.shift === 'between';
                      return (
                        <div
                          key={emp.empId}
                          className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3"
                        >
                          <div>
                            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                              <span>{emp.empName}</span>
                              {isBtw && (
                                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-900">
                                  بتوين
                                </span>
                              )}
                            </div>
                            {emp.note && (
                              <div className="text-[11px] text-amber-700">{emp.note}</div>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setTransferEmp(emp);
                              const preferred = deficits[0]?.branch.id || otherBranches[0]?.branch.id || '';
                              setTransferToBranchId(preferred);
                              setTransferMode('temporary');
                            }}
                            className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800"
                          >
                            خيارات النقل
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    const bId = inspectRow.branch.id;
                    setInspectBranchId(null);
                    onOpenBranchPlanner(bId);
                  }}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 py-2.5 text-xs font-bold text-amber-900 hover:bg-amber-100"
                >
                  <CalendarDays className="h-3.5 w-3.5" />
                  <span>فتح الخطة الأسبوعية للفرع</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Compliance Comparison Modal (Triggered from Notification Bell or Banner) */}
      {selectedCompliance && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          onClick={onCloseComplianceModal}
        >
          <div
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  تقرير مطابقة توفر الغد مع الخطة الأسبوعية
                </h3>
                <p className="text-xs text-slate-500">
                  فرع {selectedCompliance.branchName} · {SHIFTS_AR[selectedCompliance.shift]} ·{' '}
                  {fmtDateAr(selectedCompliance.shiftDate)}
                </p>
              </div>
              <button
                type="button"
                onClick={onCloseComplianceModal}
                className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-bold"
              >
                إغلاق
              </button>
            </div>

            <div
              className={`mb-4 rounded-xl border p-4 ${
                selectedCompliance.status === 'matched'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  : 'border-amber-300 bg-amber-50 text-amber-950'
              }`}
            >
              <div className="flex items-center gap-2 text-sm font-extrabold">
                {selectedCompliance.status === 'matched' ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-emerald-700" />
                    <span>الإرسال مطابق تماماً للخطة الأسبوعية</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-5 w-5 text-amber-700" />
                    <span>
                      رصد {selectedCompliance.diffs.length} اختلاف عن الخطة الأسبوعية
                    </span>
                  </>
                )}
              </div>
              <div className="mt-2 flex gap-6 text-xs font-bold">
                <span>المجدولون بالخطة: {selectedCompliance.plannedCount}</span>
                <span>المتاحون المُرسلون: {selectedCompliance.actualCount}</span>
              </div>
            </div>

            {selectedCompliance.diffs.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full border-collapse text-right text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 font-bold text-slate-600">
                      <th className="px-3 py-2">الموظف</th>
                      <th className="px-3 py-2">الخطة الأسبوعية</th>
                      <th className="px-3 py-2">الإرسال الفعلي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedCompliance.diffs.map((df, idx) => (
                      <tr key={idx}>
                        <td className="px-3 py-2 font-bold text-slate-900">{df.empName}</td>
                        <td className="px-3 py-2 text-slate-600">{df.expected}</td>
                        <td className="px-3 py-2 font-bold text-rose-700">{df.actual}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  const bId = selectedCompliance.branchId;
                  onCloseComplianceModal();
                  onOpenBranchPlanner(bId);
                }}
                className="flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-900"
              >
                <CalendarDays className="h-3.5 w-3.5" />
                <span>فتح خطة الفرع</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const bId = selectedCompliance.branchId;
                  onCloseComplianceModal();
                  setInspectBranchId(bId);
                }}
                className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white"
              >
                <Users className="h-3.5 w-3.5" />
                <span>المتاحون والنقل</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
