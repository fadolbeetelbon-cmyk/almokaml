import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  ArrowRight,
  Building2,
  CalendarDays,
  Check,
  CheckCheck,
  KeyRound,
  Moon,
  Plus,
  Search,
  Send,
  Sun,
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
  ChatMessage,
  ComplianceReport,
  Employee,
  SessionState,
  ShiftType,
} from '../types';

interface AdminControlViewProps {
  state: AppState;
  session: SessionState;
  selectedCompliance: ComplianceReport | null;
  focusEvent?: {
    branchId: string;
    shift: ShiftType;
    messageId?: string;
    complianceReport?: ComplianceReport;
    nonce: number;
  } | null;
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
  hasEdit: boolean;
  lastEditAt?: string;
  lastEditSummary?: string;
  availableRows: AvailabilityRow[];
  compliance: ComplianceReport | null;
  category: 'deficit' | 'surplus' | 'stable';
  unreadCount: number;
  lastMsg: ChatMessage | null;
}

type AdminSettingsSub = 'hub' | 'add_branch' | 'pins' | 'targets';

export const AdminControlView: React.FC<AdminControlViewProps> = ({
  state,
  session,
  selectedCompliance,
  focusEvent,
  onCloseComplianceModal,
  onSelectCompliance,
  onChangeSession,
  onUpdateState,
  onNotify,
  onOpenBranchPlanner,
}) => {
  const tomorrowIso = useMemo(() => addDaysIso(getCairoToday().iso, 1), []);
  const { adminScreen, adminShift } = session;

  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [chatSearch, setChatSearch] = useState('');
  const [chatFilter, setChatFilter] = useState<
    'all' | 'deficit' | 'surplus' | 'stable' | 'pending'
  >('all');
  const [adminReplyInput, setAdminReplyInput] = useState('');
  const [settingsSub, setSettingsSub] = useState<AdminSettingsSub>('hub');
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const msgRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Transfer modal
  const [transferModalBranchId, setTransferModalBranchId] = useState<string | null>(null);
  const [transferEmp, setTransferEmp] = useState<AvailabilityRow | null>(null);
  const [transferToBranchId, setTransferToBranchId] = useState<string>('');
  const [transferMode, setTransferMode] = useState<'temporary' | 'final'>('temporary');

  const [reqDrafts, setReqDrafts] = useState<Record<string, Record<ShiftType, number>>>(() => {
    const map: Record<string, Record<ShiftType, number>> = {};
    state.branches.forEach((b) => {
      map[b.id] = { ...b.requiredByShift };
    });
    return map;
  });

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

  useEffect(() => {
    if (adminScreen === 'settings') {
      setSettingsSub('hub');
    }
  }, [adminScreen]);

  const computeStatusesForShift = (shift: 'morning' | 'evening'): BranchStatusRow[] => {
    return state.branches.map((b) => {
      const sub = state.submissions[submissionKey(b.id, shift, tomorrowIso)];
      const required = b.requiredByShift[shift] ?? 3;
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
      const msgs = state.messages.filter((m) => m.branchId === b.id);
      const unreadMsgs = msgs.filter((m) => m.sender === 'branch' && !m.readByAdmin).length;
      const unreadEmg = state.emergencyNotices.filter(
        (e) => e.branchId === b.id && !e.acknowledged
      ).length;

      return {
        branch: b,
        required,
        available,
        diff,
        submitted: !!sub,
        hasEdit: Boolean(sub?.hasEdit),
        lastEditAt: sub?.lastEditAt,
        lastEditSummary: sub?.lastEditSummary,
        availableRows,
        compliance: sub?.compliance || null,
        category,
        unreadCount: unreadMsgs > 0 ? unreadMsgs : unreadEmg,
        lastMsg: msgs.length > 0 ? msgs[msgs.length - 1] : null,
      };
    });
  };

  const morningStatuses = useMemo(
    () => computeStatusesForShift('morning'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.branches, state.submissions, state.messages, state.emergencyNotices, tomorrowIso]
  );

  const eveningStatuses = useMemo(
    () => computeStatusesForShift('evening'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.branches, state.submissions, state.messages, state.emergencyNotices, tomorrowIso]
  );

  const branchStatuses = adminShift === 'evening' ? eveningStatuses : morningStatuses;

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

  const filteredChats = useMemo(() => {
    const list = branchStatuses.filter((row) => {
      if (chatSearch.trim() && !row.branch.name.includes(chatSearch.trim())) return false;
      if (chatFilter === 'deficit') return row.submitted && row.category === 'deficit';
      if (chatFilter === 'surplus') return row.submitted && row.category === 'surplus';
      if (chatFilter === 'stable') return row.submitted && row.category === 'stable';
      if (chatFilter === 'pending') return !row.submitted;
      return true;
    });
    return [...list].sort((a, b) => b.unreadCount - a.unreadCount);
  }, [branchStatuses, chatSearch, chatFilter]);

  const activeBranchRow = selectedChat
    ? branchStatuses.find((s) => s.branch.id === selectedChat) || null
    : null;

  const activeChatMessages = useMemo(() => {
    if (!activeBranchRow) return [];
    return state.messages.filter((m) => m.branchId === activeBranchRow.branch.id);
  }, [state.messages, activeBranchRow]);

  useEffect(() => {
    if (!focusEvent) return;
    setSelectedChat(focusEvent.branchId);
    const branchMsgs = state.messages.filter((m) => m.branchId === focusEvent.branchId);
    const targetId =
      focusEvent.messageId ||
      [...branchMsgs]
        .reverse()
        .find((m) => m.shift === focusEvent.shift && m.sender === 'branch')?.id ||
      branchMsgs[branchMsgs.length - 1]?.id;

    if (targetId) {
      setHighlightedMsgId(targetId);
      setTimeout(() => {
        msgRefs.current[targetId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 90);
      const timer = setTimeout(() => setHighlightedMsgId(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [focusEvent?.nonce]);

  useEffect(() => {
    if (selectedChat && !highlightedMsgId) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedChat, activeChatMessages.length, highlightedMsgId]);

  const transferSourceRow =
    branchStatuses.find((s) => s.branch.id === transferModalBranchId) || null;
  const transferOtherBranches = useMemo(() => {
    const others = branchStatuses.filter((s) => s.branch.id !== transferModalBranchId);
    return [...others].sort((a, b) => {
      const aDef = a.submitted && a.diff < 0 ? 1 : 0;
      const bDef = b.submitted && b.diff < 0 ? 1 : 0;
      return bDef - aDef;
    });
  }, [branchStatuses, transferModalBranchId]);

  const handleMarkBranchMessagesRead = (branchId: string, singleMsgId?: string) => {
    onUpdateState((prev) => ({
      ...prev,
      messages: prev.messages.map((m) => {
        if (m.branchId !== branchId || m.sender !== 'branch') return m;
        if (singleMsgId && m.id !== singleMsgId) return m;
        return { ...m, readByAdmin: true };
      }),
      emergencyNotices: prev.emergencyNotices.map((e) =>
        e.branchId === branchId ? { ...e, acknowledged: true } : e
      ),
      notifications: prev.notifications.map((n) =>
        n.recipientRole === 'central' && n.branchId === branchId
          ? { ...n, read: true }
          : n
      ),
    }));
    onNotify('تم تأكيد الاطلاع — تحولت علامة الصح للون الأزرق عند الفرع');
  };

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

  const handleSendAdminReply = () => {
    if (!activeBranchRow) return;
    const txt = adminReplyInput.trim();
    if (!txt) return;

    const timeNow = new Date().toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const msgId = `msg_adm_${Date.now()}`;
    const msg: ChatMessage = {
      id: msgId,
      branchId: activeBranchRow.branch.id,
      sender: 'admin',
      kind: 'text',
      text: txt,
      shift: adminShift,
      shiftDate: tomorrowIso,
      time: timeNow,
      readByAdmin: true,
      readByBranch: false,
    };

    onUpdateState((prev) => ({
      ...prev,
      messages: [
        ...prev.messages.map((m) =>
          m.branchId === activeBranchRow.branch.id && m.sender === 'branch'
            ? { ...m, readByAdmin: true }
            : m
        ),
        msg,
      ],
      notifications: [
        ...prev.notifications,
        {
          id: `nadm_txt_${Date.now()}`,
          kind: 'message',
          senderRole: 'central',
          senderName: 'الأدمن',
          recipientRole: 'branch',
          recipientBranchId: activeBranchRow.branch.id,
          branchId: activeBranchRow.branch.id,
          shift: adminShift,
          shiftDate: tomorrowIso,
          messageId: msgId,
          text: `رسالة من الأدمن: ${txt}`,
          time: timeNow,
          read: false,
        },
      ],
    }));

    setAdminReplyInput('');
  };

  const handleConfirmTransfer = () => {
    if (!transferSourceRow || !transferEmp || !transferToBranchId) return;
    const fromB = transferSourceRow.branch;
    const toB = state.branches.find((b) => b.id === transferToBranchId);
    if (!toB) return;

    const timeNow = new Date().toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const typeLabel =
      transferMode === 'final' ? 'نقل نهائي' : 'نقل مؤقت لهذه الوردية';
    const toText = `انضم إلى فرعكم الموظف ${transferEmp.empName} قادماً من فرع ${fromB.name} (${typeLabel})`;
    const fromText = `تم نقل الموظف ${transferEmp.empName} من فرعكم إلى فرع ${toB.name} (${typeLabel})`;

    onUpdateState((prev) => {
      const fromKey = submissionKey(fromB.id, adminShift, tomorrowIso);
      const toKey = submissionKey(toB.id, adminShift, tomorrowIso);
      const nextSubmissions = { ...prev.submissions };

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

      const msgInId = `msg_tr_in_${Date.now()}`;
      const msgOutId = `msg_tr_out_${Date.now() + 1}`;
      const transferMsgs: ChatMessage[] = [
        {
          id: msgInId,
          branchId: toB.id,
          sender: 'admin',
          kind: 'transfer',
          text: `${toText}\n(${SHIFT_FULL_AR[adminShift]} · ${fmtDateAr(tomorrowIso)})`,
          shift: adminShift,
          shiftDate: tomorrowIso,
          time: timeNow,
          readByAdmin: true,
          readByBranch: false,
        },
        {
          id: msgOutId,
          branchId: fromB.id,
          sender: 'admin',
          kind: 'transfer',
          text: `${fromText}\n(${SHIFT_FULL_AR[adminShift]} · ${fmtDateAr(tomorrowIso)})`,
          shift: adminShift,
          shiftDate: tomorrowIso,
          time: timeNow,
          readByAdmin: true,
          readByBranch: false,
        },
      ];

      return {
        ...prev,
        branches: nextBranches,
        submissions: nextSubmissions,
        messages: [...prev.messages, ...transferMsgs],
        notifications: [
          ...prev.notifications,
          {
            id: `ntr_in_${Date.now()}`,
            kind: 'transfer',
            senderRole: 'central',
            senderName: 'الأدمن',
            recipientRole: 'branch',
            recipientBranchId: toB.id,
            branchId: toB.id,
            shift: adminShift,
            shiftDate: tomorrowIso,
            messageId: msgInId,
            text: toText,
            time: timeNow,
            read: false,
          },
          {
            id: `ntr_out_${Date.now() + 1}`,
            kind: 'transfer',
            senderRole: 'central',
            senderName: 'الأدمن',
            recipientRole: 'branch',
            recipientBranchId: fromB.id,
            branchId: fromB.id,
            shift: adminShift,
            shiftDate: tomorrowIso,
            messageId: msgOutId,
            text: fromText,
            time: timeNow,
            read: false,
          },
        ],
        transferNotices: [
          ...prev.transferNotices,
          {
            id: `tr_in_${Date.now()}`,
            targetBranchId: toB.id,
            shift: adminShift,
            shiftDate: tomorrowIso,
            text: toText,
            typeLabel,
            time: timeNow,
            acknowledged: false,
          },
          {
            id: `tr_out_${Date.now() + 1}`,
            targetBranchId: fromB.id,
            shift: adminShift,
            shiftDate: tomorrowIso,
            text: fromText,
            typeLabel,
            time: timeNow,
            acknowledged: false,
          },
        ],
      };
    });

    onNotify(`تم إرسال قرار نقل ${transferEmp.empName} في محادثتي الفرعين`);
    setTransferEmp(null);
    setTransferModalBranchId(null);
  };

  // =========================================================
  // SCREEN: CENTERED ADMIN SETTINGS HUB (NO HISTORY)
  // =========================================================
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

      onUpdateState((prev) => ({
        ...prev,
        branches: [...prev.branches, newBranch],
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
      onUpdateState((prev) => ({
        ...prev,
        adminPin: next,
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
      onUpdateState((prev) => ({
        ...prev,
        branches: prev.branches.map((item) =>
          item.id === b.id ? { ...item, pin: nextPin } : item
        ),
      }));
      onNotify(`تم تحديث كلمة سر فرع ${b.name}`);
    };

    if (settingsSub === 'hub') {
      const hubCards = [
        {
          id: 'targets' as AdminSettingsSub,
          title: 'العدد المطلوب لكل فرع',
          desc: 'تحديد العدد المطلوب للصباحي والمسائي لحساب العجز والفائض',
          icon: Users,
          badge: `${state.branches.length} فرع`,
          color: 'bg-[#e7fce3] text-[#008069]',
        },
        {
          id: 'add_branch' as AdminSettingsSub,
          title: 'إضافة فرع جديد',
          desc: 'تسجيل فرع جديد وإعطاؤه رمز دخول خاص',
          icon: Building2,
          badge: 'جديد',
          color: 'bg-amber-100 text-amber-800',
        },
        {
          id: 'pins' as AdminSettingsSub,
          title: 'كلمات السر',
          desc: 'تعديل كلمة سر الأدمن أو أي فرع (صلاحية الأدمن فقط)',
          icon: KeyRound,
          badge: 'أمان',
          color: 'bg-[#e7fce3] text-[#008069]',
        },
      ];

      return (
        <div className="flex min-h-[68vh] items-center justify-center px-2 py-4">
          <div className="w-full max-w-3xl rounded-2xl border border-[#d1d7db] bg-white p-6 shadow-sm sm:p-8">
            <div className="mb-6 text-center">
              <div className="text-xs font-extrabold text-[#008069]">
                الأدمن
              </div>
              <h1 className="mt-1 text-xl font-extrabold text-[#111b21]">
                الإعدادات الأساسية
              </h1>
              <p className="mt-1 text-xs font-semibold text-[#54656f]">
                اختر الإعداد الذي تريد فتحه مباشرة
              </p>
            </div>

            <div className="grid gap-3.5 sm:grid-cols-3">
              {hubCards.map((card) => {
                const Icon = card.icon;
                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => setSettingsSub(card.id)}
                    className="flex flex-col justify-between rounded-2xl border border-[#d1d7db] bg-[#f8fafc] p-5 text-right transition-all hover:border-[#008069] hover:bg-[#f0f9f4]"
                  >
                    <div>
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <div
                          className={`flex h-11 w-11 items-center justify-center rounded-full ${card.color}`}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-extrabold text-[#54656f] shadow-xs">
                          {card.badge}
                        </span>
                      </div>
                      <div className="text-base font-extrabold text-[#111b21]">
                        {card.title}
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-[#54656f]">
                        {card.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={() => onChangeSession({ adminScreen: 'control' })}
                className="flex min-h-[42px] items-center gap-1.5 rounded-full border border-[#d1d7db] bg-[#f0f2f5] px-6 py-2 text-xs font-extrabold text-[#111b21] hover:bg-[#e9edef]"
              >
                <ArrowRight className="h-4 w-4 text-[#008069]" />
                <span>عودة لمحادثات الفروع</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="mx-auto max-w-2xl space-y-4 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#d1d7db] bg-white px-4 py-3 shadow-xs">
          <button
            type="button"
            onClick={() => setSettingsSub('hub')}
            className="flex min-h-[38px] items-center gap-1.5 rounded-full border border-[#d1d7db] bg-[#f0f2f5] px-4 py-1.5 text-xs font-extrabold text-[#111b21] hover:bg-[#e9edef]"
          >
            <ArrowRight className="h-3.5 w-3.5 text-[#008069]" />
            <span>قائمة الإعدادات</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeSession({ adminScreen: 'control' })}
            className="flex min-h-[38px] items-center gap-1 rounded-full bg-[#008069] px-4 py-1.5 text-xs font-extrabold text-white hover:bg-[#016b58]"
          >
            <span>عودة للمحادثات</span>
          </button>
        </div>

        {settingsSub === 'add_branch' && (
          <div className="rounded-2xl border border-[#d1d7db] bg-white p-5 shadow-xs">
            <div className="mb-3 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-[#008069]" />
              <h2 className="text-base font-extrabold text-[#111b21]">إضافة فرع جديد</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-bold text-[#54656f]">
                  اسم الفرع الجديد
                </label>
                <input
                  type="text"
                  placeholder="مثال: المعادي"
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  className="min-h-[44px] w-full rounded-xl border border-[#d1d7db] px-3 py-2 text-sm font-bold outline-none focus:border-[#008069]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-[#54656f]">
                  كلمة سر الفرع (PIN)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  dir="ltr"
                  placeholder={`مثال: 1234${state.branches.length + 1}`}
                  value={newBranchPin}
                  onChange={(e) => setNewBranchPin(normalizeDigits(e.target.value))}
                  className="font-mono-num min-h-[44px] w-full rounded-xl border border-[#d1d7db] px-3 py-2 text-sm font-bold outline-none focus:border-[#008069]"
                />
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              {(['morning', 'evening'] as ShiftType[]).map((sh) => (
                <div key={sh}>
                  <label className="mb-1 block text-xs font-bold text-[#54656f]">
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
                    className="font-mono-num min-h-[42px] w-full rounded-xl border border-[#d1d7db] px-2.5 py-1.5 text-center text-sm font-bold"
                  />
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={handleAddBranch}
              className="mt-4 flex min-h-[46px] w-full items-center justify-center gap-1.5 rounded-full bg-[#008069] py-2.5 text-sm font-extrabold text-white hover:bg-[#016b58]"
            >
              <Plus className="h-4 w-4" />
              <span>إضافة الفرع</span>
            </button>
          </div>
        )}

        {settingsSub === 'pins' && (
          <div className="space-y-5 rounded-2xl border border-[#d1d7db] bg-white p-5 shadow-xs">
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-[#008069]" />
              <h2 className="text-base font-extrabold text-[#111b21]">
                كلمات السر (صلاحية الأدمن فقط)
              </h2>
            </div>

            <div className="rounded-xl border border-[#e9edef] bg-[#f8fafc] p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-extrabold text-[#111b21]">
                  تغيير كلمة سر الأدمن
                </span>
                <span className="font-mono-num text-xs font-bold text-[#54656f]">
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
                  className="font-mono-num rounded-xl border border-[#d1d7db] bg-white px-3 py-2 text-sm outline-none focus:border-[#008069]"
                />
                <input
                  type="password"
                  inputMode="numeric"
                  dir="ltr"
                  placeholder="الرمز الجديد (4+)"
                  value={adminPinNew}
                  onChange={(e) => setAdminPinNew(normalizeDigits(e.target.value))}
                  className="font-mono-num rounded-xl border border-[#d1d7db] bg-white px-3 py-2 text-sm outline-none focus:border-[#008069]"
                />
                <input
                  type="password"
                  inputMode="numeric"
                  dir="ltr"
                  placeholder="تأكيد الجديد"
                  value={adminPinConfirm}
                  onChange={(e) => setAdminPinConfirm(normalizeDigits(e.target.value))}
                  className="font-mono-num rounded-xl border border-[#d1d7db] bg-white px-3 py-2 text-sm outline-none focus:border-[#008069]"
                />
              </div>
              <button
                type="button"
                onClick={handleChangeAdminPin}
                className="mt-3 min-h-[40px] rounded-full bg-[#008069] px-5 py-2 text-xs font-extrabold text-white hover:bg-[#016b58]"
              >
                تحديث كلمة سر الأدمن
              </button>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-extrabold text-[#54656f]">
                كلمات سر دخول الفروع
              </h3>
              <div className="divide-y divide-[#e9edef] rounded-xl border border-[#e9edef]">
                {state.branches.map((b) => (
                  <div
                    key={b.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5"
                  >
                    <div>
                      <span className="text-sm font-extrabold text-[#111b21]">{b.name}</span>
                      <span className="font-mono-num mr-2 text-xs text-[#667781]">
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
                        className="font-mono-num w-28 rounded-xl border border-[#d1d7db] px-2.5 py-1.5 text-center text-xs font-bold"
                      />
                      <button
                        type="button"
                        onClick={() => handleUpdateBranchPin(b)}
                        className="rounded-full border border-[#d1d7db] bg-white px-3.5 py-1.5 text-xs font-extrabold text-[#111b21] hover:bg-[#f0f2f5]"
                      >
                        حفظ الرمز
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {settingsSub === 'targets' && (
          <div className="rounded-2xl border border-[#d1d7db] bg-white p-5 shadow-xs">
            <h2 className="mb-1 text-base font-extrabold text-[#111b21]">
              العدد المطلوب لكل فرع
            </h2>
            <p className="mb-4 text-xs text-[#54656f]">
              تحديد العدد المطلوب لتصنيف الفروع تلقائياً (أحمر عجز · أصفر فائض · أخضر مستقر)
            </p>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-right text-xs">
                <thead>
                  <tr className="border-b border-[#e9edef] bg-[#f0f2f5] font-bold text-[#54656f]">
                    <th className="px-3 py-2.5">الفرع</th>
                    <th className="px-3 py-2.5 text-center">صباحي</th>
                    <th className="px-3 py-2.5 text-center">مسائي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e9edef]">
                  {state.branches.map((b) => (
                    <tr key={b.id}>
                      <td className="px-3 py-2.5 font-extrabold text-[#111b21]">
                        {b.name}
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
                            className="font-mono-num w-16 rounded-xl border border-[#d1d7db] px-2 py-1 text-center text-sm font-bold"
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
              className="mt-4 min-h-[46px] w-full rounded-full bg-[#008069] py-2.5 text-sm font-extrabold text-white hover:bg-[#016b58]"
            >
              حفظ الأعداد المطلوبة
            </button>
          </div>
        )}
      </div>
    );
  }

  // =========================================================
  // TRAFFIC-LIGHT STYLING HELPERS (Red=Deficit, Yellow=Surplus, Green=Stable)
  // =========================================================
  const getTrafficStyles = (row: BranchStatusRow) => {
    if (!row.submitted) {
      return {
        card: 'border-[#e9edef] bg-[#f8fafc] text-[#54656f]',
        avatar: 'bg-[#f0f2f5] text-[#54656f]',
        badge: 'bg-white text-[#54656f] border border-[#e9edef]',
        dot: 'bg-[#aebac1]',
        label: 'انتظار',
      };
    }
    if (row.category === 'deficit') {
      return {
        card: 'border-rose-300 bg-rose-50 text-rose-950',
        avatar: 'bg-rose-100 text-rose-800',
        badge: 'bg-rose-600 text-white',
        dot: 'bg-rose-600',
        label: `عجز ${Math.abs(row.diff)}`,
      };
    }
    if (row.category === 'surplus') {
      return {
        card: 'border-amber-300 bg-amber-50 text-amber-950',
        avatar: 'bg-amber-100 text-amber-900',
        badge: 'bg-amber-400 text-amber-950',
        dot: 'bg-amber-500',
        label: `فائض +${row.diff}`,
      };
    }
    return {
      card: 'border-[#86efac] bg-[#e7fce3] text-[#006e5a]',
      avatar: 'bg-[#d9fdd3] text-[#006e5a]',
      badge: 'bg-[#008069] text-white',
      dot: 'bg-[#008069]',
      label: 'مستقر',
    };
  };

  const renderShiftColumnCard = (
    shiftKey: 'morning' | 'evening',
    rows: BranchStatusRow[]
  ) => {
    const sorted = [...rows].sort((a, b) => {
      const rank = (r: BranchStatusRow) =>
        !r.submitted ? 3 : r.category === 'deficit' ? 0 : r.category === 'surplus' ? 1 : 2;
      return rank(a) - rank(b);
    });

    return (
      <div className="rounded-2xl border border-[#d1d7db] bg-white p-4 shadow-xs">
        <div className="mb-3 flex items-center gap-2.5 border-b border-[#e9edef] pb-3">
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-full ${
              shiftKey === 'morning'
                ? 'bg-amber-100 text-amber-700'
                : 'bg-[#008069] text-white'
            }`}
          >
            {shiftKey === 'morning' ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-[#111b21] sm:text-base">
              {shiftKey === 'morning' ? 'الوردية الصباحية (غداً)' : 'الوردية المسائية (غداً)'}
            </h3>
            <p className="text-[11px] font-bold text-[#54656f]">
              أحمر: عجز · أصفر: فائض · أخضر: مستقر
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {sorted.map((row) => {
            const st = getTrafficStyles(row);
            return (
              <button
                key={`${shiftKey}_${row.branch.id}`}
                type="button"
                onClick={() => {
                  onChangeSession({ adminShift: shiftKey });
                  setSelectedChat(row.branch.id);
                }}
                className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-right transition-all hover:opacity-90 ${st.card}`}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className={`h-3 w-3 shrink-0 rounded-full ${st.dot}`} />
                  <span className="truncate text-sm font-extrabold">
                    فرع {row.branch.name}
                  </span>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-mono-num text-xs font-extrabold">
                    {row.submitted ? `${row.available}/${row.required}` : `--/${row.required}`}
                  </span>
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${st.badge}`}>
                    {st.label}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // =========================================================
  // SCREEN: DIRECT BRANCH LIST & CHATS (NO SUMMARY / NO HISTORY)
  // =========================================================
  const showSidebarOnMobile = selectedChat === null;

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-[#d1d7db] bg-white shadow-sm lg:grid lg:h-[calc(100dvh-5.75rem)] lg:grid-cols-[360px_1fr]">
      {/* RIGHT PANE: Direct Branch List with Side-by-Side Morning & Evening Status Pills */}
      <aside
        className={`flex flex-col border-l border-[#e9edef] bg-white ${
          showSidebarOnMobile ? 'flex' : 'hidden lg:flex'
        }`}
      >
        <div className="border-b border-[#e9edef] bg-[#f0f2f5] px-3 py-3">
          <div className="mb-2 flex items-center justify-between text-xs font-extrabold text-[#111b21]">
            <span>الفروع (غداً · {fmtDateAr(tomorrowIso)})</span>
            <span className="text-[11px] font-bold text-[#54656f]">اختر الوردية</span>
          </div>
          {/* Big Prominent Morning & Evening Shift Buttons (100% Mobile-Friendly) */}
          <div id="adminShiftButtons" className="grid grid-cols-2 gap-2">
            <button
              id="adminShiftBtn_morning"
              type="button"
              onClick={() => onChangeSession({ adminShift: 'morning' })}
              className={`flex min-h-[54px] items-center justify-center gap-2 rounded-2xl px-3 py-2.5 text-base font-extrabold shadow-xs transition-all ${
                adminShift === 'morning'
                  ? 'bg-[#008069] text-white ring-2 ring-[#008069]/30'
                  : 'border border-[#d1d7db] bg-white text-[#111b21] hover:bg-[#f8fafc]'
              }`}
            >
              <Sun
                className={`h-5 w-5 shrink-0 ${
                  adminShift === 'morning' ? 'text-amber-300' : 'text-amber-600'
                }`}
              />
              <span>صباحي</span>
            </button>

            <button
              id="adminShiftBtn_evening"
              type="button"
              onClick={() => onChangeSession({ adminShift: 'evening' })}
              className={`flex min-h-[54px] items-center justify-center gap-2 rounded-2xl px-3 py-2.5 text-base font-extrabold shadow-xs transition-all ${
                adminShift === 'evening'
                  ? 'bg-[#008069] text-white ring-2 ring-[#008069]/30'
                  : 'border border-[#d1d7db] bg-white text-[#111b21] hover:bg-[#f8fafc]'
              }`}
            >
              <Moon
                className={`h-5 w-5 shrink-0 ${
                  adminShift === 'evening' ? 'text-[#25d366]' : 'text-[#008069]'
                }`}
              />
              <span>مسائي</span>
            </button>
          </div>
        </div>

        <div className="space-y-2 border-b border-[#e9edef] bg-white p-2.5">
          <div className="relative">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#667781]" />
            <input
              type="text"
              placeholder="ابحث عن فرع..."
              value={chatSearch}
              onChange={(e) => setChatSearch(e.target.value)}
              className="w-full rounded-full bg-[#f0f2f5] py-2 pl-3 pr-9 text-xs font-bold text-[#111b21] outline-none focus:ring-1 focus:ring-[#008069]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1">
            {[
              { id: 'all', label: `الكل (${branchStatuses.length})`, active: 'bg-[#111b21] text-white' },
              { id: 'deficit', label: `عجز (${deficits.length})`, active: 'bg-rose-600 text-white' },
              { id: 'surplus', label: `فائض (${surpluses.length})`, active: 'bg-amber-400 text-amber-950' },
              { id: 'stable', label: `مستقر (${stables.length})`, active: 'bg-[#008069] text-white' },
              { id: 'pending', label: `انتظار (${pendings.length})`, active: 'bg-[#54656f] text-white' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setChatFilter(f.id as typeof chatFilter)}
                className={`flex-1 whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-extrabold transition-colors ${
                  chatFilter === f.id
                    ? f.active
                    : 'bg-[#f0f2f5] text-[#54656f] hover:bg-[#e9edef]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-[#e9edef] lg:flex-1 lg:overflow-y-auto">
          {filteredChats.map((row) => {
            const isSel = selectedChat === row.branch.id;
            const st = getTrafficStyles(row);
            const mRow = morningStatuses.find((x) => x.branch.id === row.branch.id)!;
            const eRow = eveningStatuses.find((x) => x.branch.id === row.branch.id)!;
            const mSt = getTrafficStyles(mRow);
            const eSt = getTrafficStyles(eRow);

            return (
              <button
                key={row.branch.id}
                id={`adminBranchCard_${row.branch.id}`}
                type="button"
                onClick={() => setSelectedChat(row.branch.id)}
                className={`flex w-full items-center gap-3 px-3.5 py-3 text-right transition-colors ${
                  isSel ? 'bg-[#f0f2f5]' : 'bg-white hover:bg-[#f8fafc]'
                }`}
              >
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${st.avatar}`}
                >
                  {row.branch.name.slice(0, 2)}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-extrabold text-[#111b21]">
                      فرع {row.branch.name}
                    </span>
                    {row.unreadCount > 0 && (
                      <span className="font-mono-num flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-[#25d366] px-1.5 text-[11px] font-extrabold text-white">
                        {row.unreadCount}
                      </span>
                    )}
                  </div>

                  {/* Side-by-side Morning & Evening Color Pills + Edited Indicator */}
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span
                      className={`font-mono-num rounded-full px-2 py-0.5 text-[10px] font-extrabold ${mSt.badge}`}
                    >
                      صباحي {mRow.submitted ? `${mRow.available}/${mRow.required}` : 'انتظار'}
                    </span>
                    <span
                      className={`font-mono-num rounded-full px-2 py-0.5 text-[10px] font-extrabold ${eSt.badge}`}
                    >
                      مسائي {eRow.submitted ? `${eRow.available}/${eRow.required}` : 'انتظار'}
                    </span>
                    {(mRow.hasEdit || eRow.hasEdit) && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold text-amber-900">
                        تعديل
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* LEFT PANE: Active Branch Chat OR Direct Side-by-Side Morning & Evening Columns */}
      <section
        className={`flex flex-col bg-[#f0f2f5] lg:overflow-hidden ${
          showSidebarOnMobile ? 'hidden lg:flex' : 'flex'
        }`}
      >
        {activeBranchRow ? (
          <>
            {/* Branch Chat Header */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e9edef] bg-[#f0f2f5] px-4 py-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedChat(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#111b21] lg:hidden"
                  aria-label="العودة لقائمة الفروع"
                >
                  <ArrowRight className="h-4 w-4" />
                </button>
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${
                    getTrafficStyles(activeBranchRow).avatar
                  }`}
                >
                  {activeBranchRow.branch.name.slice(0, 2)}
                </div>
                <div>
                  <h2 className="text-sm font-extrabold text-[#111b21] sm:text-base">
                    فرع {activeBranchRow.branch.name}
                  </h2>
                  <p className="text-[11px] font-bold text-[#54656f]">
                    {SHIFT_FULL_AR[adminShift]} ·{' '}
                    {activeBranchRow.submitted
                      ? `المتاح: ${activeBranchRow.available} من ${activeBranchRow.required}`
                      : `لم يُرسل بعد (المطلوب ${activeBranchRow.required})`}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {activeBranchRow.unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={() => handleMarkBranchMessagesRead(activeBranchRow.branch.id)}
                    className="flex min-h-[36px] items-center gap-1 whitespace-nowrap rounded-full bg-[#008069] px-3.5 py-1.5 text-xs font-extrabold text-white hover:bg-[#016b58]"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>تم الاطلاع على الكل</span>
                  </button>
                )}

                {activeBranchRow.availableRows.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setTransferModalBranchId(activeBranchRow.branch.id);
                      setTransferEmp(null);
                    }}
                    className="flex min-h-[36px] items-center gap-1.5 whitespace-nowrap rounded-full border border-[#d1d7db] bg-white px-3.5 py-1.5 text-xs font-extrabold text-[#111b21] hover:bg-[#e9edef]"
                  >
                    <ArrowLeftRight className="h-3.5 w-3.5 text-[#008069]" />
                    <span>نقل موظف</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onOpenBranchPlanner(activeBranchRow.branch.id)}
                  className="flex min-h-[36px] items-center gap-1.5 whitespace-nowrap rounded-full border border-[#d1d7db] bg-white px-3.5 py-1.5 text-xs font-extrabold text-[#111b21] hover:bg-[#e9edef]"
                >
                  <CalendarDays className="h-3.5 w-3.5 text-[#008069]" />
                  <span>خطة الفرع</span>
                </button>
              </div>
            </div>

            {/* Clean Uncluttered WhatsApp Chat Thread */}
            <div className="wa-chat-bg min-h-[320px] flex-1 space-y-3 overflow-y-auto px-3 py-4 sm:px-5">
              <div className="flex justify-center">
                <span className="rounded-lg bg-white/90 px-3 py-1 text-[11px] font-extrabold text-[#54656f] shadow-xs">
                  غداً · {fmtDateAr(tomorrowIso)}
                </span>
              </div>

              {activeChatMessages.length === 0 ? (
                <div className="mx-auto max-w-md rounded-xl bg-white/95 p-5 text-center text-xs font-semibold text-[#54656f] shadow-xs">
                  لا توجد رسائل من فرع {activeBranchRow.branch.name} بعد.
                  <br />
                  يمكنك كتابة رسالة للفرع من الأسفل.
                </div>
              ) : (
                activeChatMessages.map((msg) => {
                  const isFromAdmin = msg.sender === 'admin';
                  const subForMsg =
                    msg.submissionKey && state.submissions[msg.submissionKey]
                      ? state.submissions[msg.submissionKey]
                      : null;

                  const isHighlighted = highlightedMsgId === msg.id;

                  if (isFromAdmin) {
                    return (
                      <div
                        key={msg.id}
                        ref={(el) => {
                          msgRefs.current[msg.id] = el;
                        }}
                        className="flex justify-start"
                      >
                        <div
                          className={`max-w-[90%] rounded-xl rounded-tl-sm bg-[#d9fdd3] px-4 py-3 text-[#111b21] shadow-xs transition-all sm:max-w-[75%] ${
                            isHighlighted ? 'ring-3 ring-[#008069]' : ''
                          }`}
                        >
                          <div className="mb-1 text-xs font-extrabold text-[#008069]">
                            أنت (الأدمن)
                          </div>
                          <div className="whitespace-pre-line text-xs font-semibold leading-relaxed sm:text-sm">
                            {msg.text}
                          </div>
                          <div className="mt-1.5 flex items-center justify-end gap-1.5 text-[10px] font-bold text-[#54656f]">
                            <span className="font-mono-num">{msg.time}</span>
                            <CheckCheck
                              className={`h-4 w-4 ${
                                msg.readByBranch ? 'text-[#53bdeb]' : 'text-[#667781]'
                              }`}
                            />
                            <span
                              className={
                                msg.readByBranch ? 'text-[#0284c7]' : 'text-[#667781]'
                              }
                            >
                              {msg.readByBranch ? 'تم الاطلاع' : 'مرسلة'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={msg.id}
                      ref={(el) => {
                        msgRefs.current[msg.id] = el;
                      }}
                      className="flex justify-end"
                    >
                      <div
                        className={`max-w-[92%] rounded-xl rounded-tr-sm px-4 py-3 text-[#111b21] shadow-xs transition-all sm:max-w-[78%] ${
                          msg.kind === 'emergency'
                            ? 'border border-rose-300 bg-[#fff1f2]'
                            : msg.supersededByMsgId
                            ? 'border border-[#d1d7db] bg-[#f8fafc] opacity-75'
                            : msg.isEditedResend
                            ? 'border-2 border-amber-400 bg-white'
                            : 'bg-white'
                        } ${isHighlighted ? 'ring-3 ring-[#008069]' : ''}`}
                      >
                        {msg.isEditedResend && (
                          <div className="mb-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-extrabold text-amber-950">
                            <div>تعديل جديد على التوفر المرسل</div>
                            {msg.editSummary && (
                              <div className="mt-0.5 text-[11px] font-bold text-amber-900">
                                {msg.editSummary}
                              </div>
                            )}
                          </div>
                        )}

                        {msg.supersededByMsgId && (
                          <div className="mb-1.5 inline-block rounded-full bg-[#e9edef] px-2.5 py-0.5 text-[10px] font-extrabold text-[#54656f]">
                            نسخة سابقة — تم تعديلها برسالة أحدث
                          </div>
                        )}

                        <div className="mb-1 flex items-center justify-between gap-3">
                          <span className="text-xs font-extrabold text-[#008069]">
                            فرع {activeBranchRow.branch.name}
                          </span>
                          <span className="font-mono-num text-[10px] text-[#667781]">
                            {msg.time}
                          </span>
                        </div>

                        <div className="whitespace-pre-line text-xs font-semibold leading-relaxed sm:text-sm">
                          {msg.text}
                        </div>

                        <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-[#e9edef] pt-2">
                          {!msg.readByAdmin ? (
                            <button
                              type="button"
                              onClick={() =>
                                handleMarkBranchMessagesRead(
                                  activeBranchRow.branch.id,
                                  msg.id
                                )
                              }
                              className="flex items-center gap-1 rounded-full bg-[#008069] px-4 py-1.5 text-xs font-extrabold text-white hover:bg-[#016b58]"
                            >
                              <Check className="h-3.5 w-3.5" />
                              <span>تم الاطلاع</span>
                            </button>
                          ) : (
                            <span className="flex items-center gap-1 text-[11px] font-bold text-[#0284c7]">
                              <CheckCheck className="h-3.5 w-3.5 text-[#53bdeb]" />
                              <span>تم الاطلاع</span>
                            </span>
                          )}

                          {subForMsg?.compliance && (
                            <button
                              type="button"
                              onClick={() => onSelectCompliance(subForMsg.compliance)}
                              className="rounded-full border border-[#d1d7db] bg-[#f8fafc] px-3 py-1 text-[11px] font-bold text-[#111b21] hover:bg-[#e9edef]"
                            >
                              تفاصيل المطابقة
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Clean Free-Text Composer */}
            <div className="border-t border-[#e9edef] bg-[#f0f2f5] p-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendAdminReply();
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={adminReplyInput}
                  onChange={(e) => setAdminReplyInput(e.target.value)}
                  placeholder={`اكتب رسالة لفرع ${activeBranchRow.branch.name} لو عايز...`}
                  className="min-h-[44px] flex-1 rounded-full border border-[#d1d7db] bg-white px-4 py-2 text-sm text-[#111b21] outline-none focus:border-[#008069]"
                />
                <button
                  type="submit"
                  disabled={!adminReplyInput.trim()}
                  aria-label="إرسال رسالة للفرع"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#008069] text-white hover:bg-[#016b58] disabled:bg-[#aebac1]"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </div>
          </>
        ) : (
          /* DESKTOP DIRECT 2-SHIFT QUICK ACTION BOARD (NO SUMMARY CLUTTER) */
          <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
            {unreadEmergency.length > 0 && (
              <div className="space-y-2">
                {unreadEmergency.map((e) => (
                  <div
                    key={e.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-300 bg-rose-50 p-3.5"
                  >
                    <div>
                      <div className="text-xs font-bold text-rose-700">
                        طارئ · {SHIFT_FULL_AR[e.shift]} — فرع {e.branchName}
                      </div>
                      <div className="text-sm font-extrabold text-[#111b21]">
                        {e.employeeName}: {e.reason}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedChat(e.branchId)}
                        className="rounded-full border border-rose-300 bg-white px-3 py-1.5 text-xs font-bold text-rose-800"
                      >
                        فتح المحادثة
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAckEmergency(e.id)}
                        className="rounded-full bg-rose-700 px-4 py-1.5 text-xs font-extrabold text-white"
                      >
                        تم الاطلاع
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {unreadComplianceNotifs.length > 0 && (
              <div className="space-y-2">
                {unreadComplianceNotifs.map((n) => (
                  <div
                    key={n.id}
                    className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 ${
                      n.kind === 'compliance_ok'
                        ? 'border-[#86efac] bg-[#e7fce3]'
                        : 'border-amber-300 bg-amber-50'
                    }`}
                  >
                    <span className="text-xs font-extrabold text-[#111b21]">{n.text}</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedChat(n.branchId)}
                        className="rounded-full border border-[#d1d7db] bg-white px-3 py-1 text-xs font-bold text-[#111b21]"
                      >
                        فتح المحادثة
                      </button>
                      {n.complianceReport && (
                        <button
                          type="button"
                          onClick={() => onSelectCompliance(n.complianceReport!)}
                          className="rounded-full border border-[#d1d7db] bg-white px-3 py-1 text-xs font-bold text-[#111b21]"
                        >
                          التفاصيل
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleAckNotification(n.id)}
                        className="rounded-full bg-[#008069] px-3 py-1 text-xs font-extrabold text-white"
                      >
                        تم الاطلاع
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {renderShiftColumnCard('morning', morningStatuses)}
              {renderShiftColumnCard('evening', eveningStatuses)}
            </div>
          </div>
        )}
      </section>

      {/* Transfer Modal */}
      {transferSourceRow && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => {
            setTransferModalBranchId(null);
            setTransferEmp(null);
          }}
        >
          <div
            className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-2xl border border-[#d1d7db] bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {transferEmp ? (
              <div className="space-y-3">
                <h3 className="text-base font-extrabold text-[#111b21]">
                  تحويل {transferEmp.empName} إلى فرع...
                </h3>
                <p className="text-xs text-[#54656f]">
                  من فرع: {transferSourceRow.branch.name}
                </p>

                <div className="max-h-56 space-y-1.5 overflow-y-auto rounded-xl border border-[#e9edef] bg-[#f8fafc] p-2">
                  {transferOtherBranches.map((ob) => {
                    const isDef = ob.submitted && ob.diff < 0;
                    const isPicked = transferToBranchId === ob.branch.id;
                    return (
                      <button
                        key={ob.branch.id}
                        type="button"
                        onClick={() => setTransferToBranchId(ob.branch.id)}
                        className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-right text-xs font-extrabold transition-colors ${
                          isPicked
                            ? 'bg-[#008069] text-white'
                            : 'bg-white text-[#111b21] hover:bg-[#f0f2f5]'
                        }`}
                      >
                        <span>فرع {ob.branch.name}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] ${
                            isPicked
                              ? 'bg-white/20 text-white'
                              : isDef
                              ? 'bg-rose-600 text-white'
                              : ob.submitted && ob.diff > 0
                              ? 'bg-amber-400 text-amber-950'
                              : ob.submitted
                              ? 'bg-[#008069] text-white'
                              : 'bg-[#f0f2f5] text-[#54656f]'
                          }`}
                        >
                          {!ob.submitted
                            ? 'انتظار'
                            : isDef
                            ? `عجز ${Math.abs(ob.diff)}`
                            : ob.diff > 0
                            ? `فائض +${ob.diff}`
                            : 'مستقر'}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-[#3b4a54]">
                    نوع النقل
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setTransferMode('temporary')}
                      className={`flex-1 rounded-full py-2 text-xs font-extrabold ${
                        transferMode === 'temporary'
                          ? 'bg-[#008069] text-white'
                          : 'bg-[#f0f2f5] text-[#3b4a54]'
                      }`}
                    >
                      مؤقت لهذه الوردية
                    </button>
                    <button
                      type="button"
                      onClick={() => setTransferMode('final')}
                      className={`flex-1 rounded-full py-2 text-xs font-extrabold ${
                        transferMode === 'final'
                          ? 'bg-[#008069] text-white'
                          : 'bg-[#f0f2f5] text-[#3b4a54]'
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
                    className="min-h-[42px] flex-1 rounded-full border border-[#d1d7db] py-2 text-xs font-bold text-[#3b4a54]"
                  >
                    رجوع
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmTransfer}
                    className="min-h-[42px] flex-1 rounded-full bg-[#008069] py-2 text-xs font-extrabold text-white hover:bg-[#016b58]"
                  >
                    إرسال قرار النقل
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="mb-4 flex items-center justify-between border-b border-[#e9edef] pb-3">
                  <div>
                    <h3 className="text-base font-extrabold text-[#111b21]">
                      اختر موظفاً للنقل — {transferSourceRow.branch.name}
                    </h3>
                    <p className="text-xs text-[#54656f]">
                      {SHIFT_FULL_AR[adminShift]} · {fmtDateAr(tomorrowIso)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTransferModalBranchId(null)}
                    className="rounded-full border border-[#d1d7db] px-3 py-1 text-xs font-bold text-[#54656f]"
                  >
                    إغلاق
                  </button>
                </div>

                <div className="space-y-2">
                  {transferSourceRow.availableRows.map((emp) => {
                    const empRecord = transferSourceRow.branch.emps.find(
                      (e) => e.id === emp.empId
                    );
                    const isBtw = empRecord?.shift === 'between';
                    return (
                      <div
                        key={emp.empId}
                        className="flex items-center justify-between rounded-xl border border-[#e9edef] bg-[#f8fafc] p-3"
                      >
                        <div>
                          <div className="flex items-center gap-2 text-sm font-bold text-[#111b21]">
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
                            const preferred =
                              deficits[0]?.branch.id ||
                              transferOtherBranches[0]?.branch.id ||
                              '';
                            setTransferToBranchId(preferred);
                            setTransferMode('temporary');
                          }}
                          className="rounded-full bg-[#008069] px-3.5 py-1.5 text-xs font-extrabold text-white hover:bg-[#016b58]"
                        >
                          تحويل لفرع آخر
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Compliance Comparison Modal */}
      {selectedCompliance && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={onCloseComplianceModal}
        >
          <div
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#d1d7db] bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between border-b border-[#e9edef] pb-3">
              <div>
                <h3 className="text-base font-extrabold text-[#111b21]">
                  تقرير مطابقة توفر الغد مع الخطة الأسبوعية
                </h3>
                <p className="text-xs text-[#54656f]">
                  فرع {selectedCompliance.branchName} · {SHIFTS_AR[selectedCompliance.shift]} ·{' '}
                  {fmtDateAr(selectedCompliance.shiftDate)}
                </p>
              </div>
              <button
                type="button"
                onClick={onCloseComplianceModal}
                className="rounded-full border border-[#d1d7db] px-3 py-1 text-xs font-bold"
              >
                إغلاق
              </button>
            </div>

            <div
              className={`mb-4 rounded-xl border p-4 ${
                selectedCompliance.status === 'matched'
                  ? 'border-[#86efac] bg-[#e7fce3] text-[#006e5a]'
                  : 'border-amber-300 bg-amber-50 text-amber-950'
              }`}
            >
              <div className="text-sm font-extrabold">
                {selectedCompliance.status === 'matched'
                  ? 'الإرسال مطابق تماماً للخطة الأسبوعية'
                  : `رصد ${selectedCompliance.diffs.length} اختلاف عن الخطة الأسبوعية`}
              </div>
              <div className="mt-2 flex gap-6 text-xs font-bold">
                <span>المجدولون بالخطة: {selectedCompliance.plannedCount}</span>
                <span>المتاحون المُرسلون: {selectedCompliance.actualCount}</span>
              </div>
            </div>

            {selectedCompliance.diffs.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-[#e9edef]">
                <table className="w-full border-collapse text-right text-xs">
                  <thead>
                    <tr className="border-b border-[#e9edef] bg-[#f0f2f5] font-bold text-[#54656f]">
                      <th className="px-3 py-2">الموظف</th>
                      <th className="px-3 py-2">الخطة الأسبوعية</th>
                      <th className="px-3 py-2">الإرسال الفعلي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e9edef]">
                    {selectedCompliance.diffs.map((df, idx) => (
                      <tr key={idx}>
                        <td className="px-3 py-2 font-bold text-[#111b21]">{df.empName}</td>
                        <td className="px-3 py-2 text-[#54656f]">{df.expected}</td>
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
                className="flex items-center gap-1.5 rounded-full border border-[#d1d7db] bg-white px-4 py-2 text-xs font-bold text-[#111b21]"
              >
                <CalendarDays className="h-3.5 w-3.5 text-[#008069]" />
                <span>فتح خطة الفرع</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const bId = selectedCompliance.branchId;
                  onCloseComplianceModal();
                  setSelectedChat(bId);
                }}
                className="flex items-center gap-1.5 rounded-full bg-[#008069] px-4 py-2 text-xs font-extrabold text-white"
              >
                <Users className="h-3.5 w-3.5" />
                <span>فتح محادثة الفرع</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
