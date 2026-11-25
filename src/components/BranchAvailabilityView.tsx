import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Building2,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronsDown,
  Clock,
  Compass,
  Edit3,
  LogOut,
  Mic,
  Moon,
  MoreVertical,
  Pause,
  Play,
  Plus,
  Search,
  Square,
  Sun,
  Trash2,
  Type,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  addDaysIso,
  buildPlannedRowsForShift,
  computeDayPlanForBranch,
  DAY_NAMES_AR,
  evaluateAvailabilityCompliance,
  fmtDateAr,
  formatAvailabilityChatText,
  getCairoToday,
  pad2,
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
  BranchThemeMode,
  ChatMessage,
  Employee,
  MonthlyLeave,
  SessionState,
  ShiftType,
} from '../types';
import { MonthlyLeaveDialModal, WeeklyOffDialModal } from './DateDialModal';

const WhatsAppSendIcon: React.FC<{ className?: string }> = ({ className = 'h-5 w-5' }) => (
  <svg
    viewBox="0 0 24 24"
    className={`${className} -scale-x-100 fill-current`}
    aria-hidden="true"
  >
    <path d="M1.101 21.757 23.8 12.028 1.101 2.3l.011 7.912 13.623 1.816-13.623 1.817-.011 7.912z" />
  </svg>
);

function parseAvailabilityBubble(text: string): {
  availList: string[];
  unavailList: string[];
  parsed: boolean;
} {
  const lines = text.split('\n');
  let mode: 'none' | 'avail' | 'unavail' = 'none';
  const availList: string[] = [];
  const unavailList: string[] = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('الحضور')) {
      mode = 'avail';
      continue;
    }
    if (line.startsWith('غير المتاحين')) {
      mode = 'unavail';
      continue;
    }
    if (line.startsWith('•')) {
      const clean = line.slice(1).trim();
      if (clean && clean !== 'لا يوجد') {
        if (mode === 'avail') availList.push(clean);
        else if (mode === 'unavail') unavailList.push(clean);
      }
    }
  }

  return {
    availList,
    unavailList,
    parsed: mode !== 'none',
  };
}

interface BranchAvailabilityViewProps {
  state: AppState;
  session: SessionState;
  branch: Branch;
  branchTheme: BranchThemeMode;
  largeFont: boolean;
  unreadNotifCount: number;
  focusEvent?: {
    branchId: string;
    shift: ShiftType;
    messageId?: string;
    nonce: number;
  } | null;
  onChangeSession: (patch: Partial<SessionState>) => void;
  onUpdateState: (updater: (prev: AppState) => AppState) => void;
  onNotify: (msg: string) => void;
  onOpenPlanner: () => void;
  onBackToChatsList: () => void;
  onToggleTheme: () => void;
  onToggleLargeFont: () => void;
  onOpenNotifications: () => void;
  onOpenTour: () => void;
  onLogout: () => void;
}

export const BranchAvailabilityView: React.FC<BranchAvailabilityViewProps> = ({
  state,
  session,
  branch,
  branchTheme,
  largeFont,
  unreadNotifCount,
  focusEvent,
  onChangeSession,
  onUpdateState,
  onNotify,
  onOpenPlanner,
  onBackToChatsList,
  onToggleTheme,
  onToggleLargeFont,
  onOpenNotifications,
  onOpenTour,
  onLogout,
}) => {
  const cairoToday = useMemo(() => getCairoToday(), []);
  const tomorrowIso = useMemo(() => addDaysIso(cairoToday.iso, 1), [cairoToday.iso]);
  const { branchScreen, activeShift } = session;

  const [draftRows, setDraftRows] = useState<AvailabilityRow[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);
  const [nextShiftPrompt, setNextShiftPrompt] = useState<ShiftType | null>(null);

  // Voice recording inside WhatsApp composer
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSec, setRecordingSec] = useState(0);
  const [playingMsgId, setPlayingMsgId] = useState<string | null>(null);

  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const chatInputRef = useRef<HTMLInputElement | null>(null);
  const msgRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<number | null>(null);
  const recordingSecRef = useRef(0);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Emergency modal
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [emergencyEmpId, setEmergencyEmpId] = useState<string | null>(null);
  const [emergencyReason, setEmergencyReason] = useState<string>('');

  // Branch Staff (Contacts UI)
  const [staffSearch, setStaffSearch] = useState('');
  const [addStaffOpen, setAddStaffOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newShift, setNewShift] = useState<ShiftType>('morning');
  const [newOffDay, setNewOffDay] = useState<number | null>(5);
  const [newMonthlyDraft, setNewMonthlyDraft] = useState<{
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

  const tomorrowPlan = useMemo(
    () => computeDayPlanForBranch(state, branch.id, tomorrowIso),
    [state, branch.id, tomorrowIso]
  );

  // Auto-populate the Bottom Sheet checklist whenever opening submit mode
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
      const existingMap = new Map(existing.rows.map((r) => [r.empId, r]));
      const merged: AvailabilityRow[] = shiftEmps.map((p) => {
        const prev = existingMap.get(p.emp.id);
        if (prev) return { ...prev };
        return {
          empId: p.emp.id,
          empName: p.emp.name,
          status:
            p.plannedShift === activeShift || (includesBetween && p.plannedShift === 'between')
              ? 'available'
              : 'unavailable',
          reason:
            p.plannedShift === 'off'
              ? p.isMonthlyLeave
                ? 'إجازة شهرية حسب الخطة'
                : 'إجازة أسبوعية حسب الخطة'
              : null,
        };
      });
      setDraftRows(merged);
    } else {
      setDraftRows(buildPlannedRowsForShift(state, branch.id, activeShift, tomorrowIso));
    }
  }, [branchScreen, activeShift, branch.id, tomorrowIso, state, tomorrowPlan]);

  const branchMessages = useMemo(
    () => state.messages.filter((m) => m.branchId === branch.id),
    [state.messages, branch.id]
  );

  const scrollToBottom = (smooth = true) => {
    if (!chatScrollRef.current) return;
    chatScrollRef.current.scrollTo({
      top: chatScrollRef.current.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto',
    });
  };

  useEffect(() => {
    if (branchScreen !== 'home' && branchScreen !== 'submit') return;
    if (focusEvent && focusEvent.branchId === branch.id) {
      const targetId =
        focusEvent.messageId ||
        [...branchMessages]
          .reverse()
          .find((m) => m.shift === focusEvent.shift || m.sender === 'admin')?.id;
      if (targetId && msgRefs.current[targetId]) {
        setHighlightedMsgId(targetId);
        setTimeout(() => {
          msgRefs.current[targetId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 60);
        const timer = setTimeout(() => setHighlightedMsgId(null), 3500);
        return () => clearTimeout(timer);
      }
    }
    scrollToBottom(true);
  }, [branchScreen, branchMessages.length, focusEvent?.nonce]);

  useEffect(() => {
    return () => {
      if (recordTimerRef.current) window.clearInterval(recordTimerRef.current);
      if (audioPlayerRef.current) audioPlayerRef.current.pause();
    };
  }, []);

  const handleChatScroll = () => {
    const el = chatScrollRef.current;
    if (!el) return;
    setShowScrollBottom(el.scrollHeight - el.scrollTop - el.clientHeight > 160);
  };

  const morningSub = state.submissions[submissionKey(branch.id, 'morning', tomorrowIso)];
  const eveningSub = state.submissions[submissionKey(branch.id, 'evening', tomorrowIso)];

  const plannedMorningCount = useMemo(
    () =>
      tomorrowPlan.filter((p) => p.plannedShift === 'morning' || p.plannedShift === 'between')
        .length,
    [tomorrowPlan]
  );
  const plannedEveningCount = useMemo(
    () =>
      tomorrowPlan.filter((p) => p.plannedShift === 'evening' || p.plannedShift === 'between')
        .length,
    [tomorrowPlan]
  );

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
      evaluateAvailabilityCompliance(state, branch.id, activeShift, tomorrowIso, draftRows),
    [state, branch.id, activeShift, tomorrowIso, draftRows]
  );

  const availCount = draftRows.filter((r) => r.status === 'available').length;
  const unavailCount = draftRows.filter((r) => r.status === 'unavailable').length;

  const dispatchAvailabilitySubmission = (shift: ShiftType, rowsToSend: AvailabilityRow[]) => {
    const key = submissionKey(branch.id, shift, tomorrowIso);
    const prevSub = state.submissions[key];
    const compliance = evaluateAvailabilityCompliance(
      state,
      branch.id,
      shift,
      tomorrowIso,
      rowsToSend
    );
    const isMatched = compliance.status === 'matched';
    const timeNow = new Date().toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const isEditedResend = Boolean(prevSub);
    const editChanges: string[] = [];
    if (prevSub) {
      const prevMap = new Map<string, AvailabilityRow>(
        prevSub.rows.map((r) => [r.empId, r])
      );
      rowsToSend.forEach((r) => {
        const old = prevMap.get(r.empId);
        if (!old) {
          editChanges.push(
            `إضافة ${r.empName} (${r.status === 'available' ? 'حضور' : r.reason || 'غير متاح'})`
          );
        } else if (old.status !== r.status || old.reason !== r.reason) {
          if (r.status === 'unavailable') {
            editChanges.push(`${r.empName}: تغيّر إلى غير متاح (${r.reason || 'بدون سبب'})`);
          } else {
            editChanges.push(`${r.empName}: تغيّر إلى حضور`);
          }
        }
      });
      prevSub.rows.forEach((old) => {
        if (!rowsToSend.some((r) => r.empId === old.empId)) {
          editChanges.push(`حذف ${old.empName}`);
        }
      });
    }

    const editSummary = prevSub
      ? editChanges.length > 0
        ? `تعديل على إرسال ${prevSub.submittedAt}: ${editChanges.join(' · ')}`
        : `إعادة إرسال وتأكيد بعد ${prevSub.submittedAt}`
      : undefined;

    const formattedText = formatAvailabilityChatText(
      branch.name,
      shift,
      tomorrowIso,
      rowsToSend,
      compliance,
      branch.emps
    );

    const newMsgId = `msg_${Date.now()}_${Math.random()}`;
    const newMsg: ChatMessage = {
      id: newMsgId,
      branchId: branch.id,
      sender: 'branch',
      kind: 'availability',
      text: formattedText,
      shift,
      shiftDate: tomorrowIso,
      submissionKey: key,
      isEditedResend,
      editSummary,
      time: timeNow,
      readByAdmin: false,
      readByBranch: true,
    };

    onUpdateState((prev) => ({
      ...prev,
      submissions: {
        ...prev.submissions,
        [key]: {
          key,
          branchId: branch.id,
          shift,
          shiftDate: tomorrowIso,
          submittedAt: prevSub ? prevSub.submittedAt : timeNow,
          rows: rowsToSend,
          compliance,
          hasEdit: isEditedResend || prevSub?.hasEdit,
          lastEditAt: isEditedResend ? timeNow : prevSub?.lastEditAt,
          lastEditSummary: editSummary || prevSub?.lastEditSummary,
        },
      },
      messages: [
        ...prev.messages.map((m) =>
          m.branchId === branch.id &&
          m.kind === 'availability' &&
          m.submissionKey === key &&
          !m.supersededByMsgId
            ? { ...m, supersededByMsgId: newMsgId }
            : m
        ),
        newMsg,
      ],
      audit: [
        ...prev.audit,
        {
          id: Date.now(),
          time: timeNow,
          text: isEditedResend
            ? `تعديل توفر الغد (${SHIFT_FULL_AR[shift]}): فرع ${branch.name} — ${editChanges.join(' · ') || 'تحديث'}`
            : isMatched
            ? `إرسال توفر الغد (${SHIFT_FULL_AR[shift]}): فرع ${branch.name} — مطابق للخطة`
            : `إرسال توفر الغد (${SHIFT_FULL_AR[shift]}): فرع ${branch.name} — ${compliance.diffs.length} اختلاف عن الخطة`,
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
          shift,
          shiftDate: tomorrowIso,
          messageId: newMsgId,
          isEdit: isEditedResend,
          text: isEditedResend
            ? `تعديل من فرع ${branch.name} (${SHIFTS_AR[shift]} - غداً): ${editChanges.join('، ') || 'إعادة إرسال'}`
            : isMatched
            ? `إرسال فرع ${branch.name} (${SHIFTS_AR[shift]} - غداً) مطابق للخطة (${compliance.actualCount} متاح)`
            : `تنبيه: إرسال فرع ${branch.name} (${SHIFTS_AR[shift]} - غداً) به ${compliance.diffs.length} اختلاف عن الخطة`,
          time: timeNow,
          read: false,
          complianceReport: compliance,
        },
      ],
    }));

    const otherShift: ShiftType = shift === 'morning' ? 'evening' : 'morning';
    const otherShiftDone = Boolean(
      state.submissions[submissionKey(branch.id, otherShift, tomorrowIso)]
    );

    onChangeSession({ branchScreen: 'home' });
    setNextShiftPrompt(!otherShiftDone ? otherShift : null);
    onNotify(
      isEditedResend
        ? `تم إرسال تعديل ${SHIFT_FULL_AR[shift]} في المحادثة`
        : `تم إرسال ${SHIFT_FULL_AR[shift]} في المحادثة`
    );
  };

  const handleApplyPlanToDraft = () => {
    const plannedRows = buildPlannedRowsForShift(state, branch.id, activeShift, tomorrowIso);
    setDraftRows(plannedRows);
    onNotify('تم ضبط القائمة حسب خطة الغد تلقائياً');
  };

  const sendTextOrQuickReply = (textToSend: string) => {
    const txt = textToSend.trim();
    if (!txt) return;
    const timeNow = new Date().toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const msgId = `msg_txt_${Date.now()}`;
    const msg: ChatMessage = {
      id: msgId,
      branchId: branch.id,
      sender: 'branch',
      kind: 'text',
      text: txt,
      shift: activeShift,
      shiftDate: tomorrowIso,
      time: timeNow,
      readByAdmin: false,
      readByBranch: true,
    };

    onUpdateState((prev) => ({
      ...prev,
      messages: [...prev.messages, msg],
      notifications: [
        ...prev.notifications,
        {
          id: `ntxt_${Date.now()}`,
          kind: 'message',
          senderRole: 'branch',
          senderName: `رسالة من فرع ${branch.name}`,
          recipientRole: 'central',
          branchId: branch.id,
          shift: activeShift,
          shiftDate: tomorrowIso,
          messageId: msgId,
          text: `رسالة من فرع ${branch.name}: ${txt}`,
          time: timeNow,
          read: false,
        },
      ],
    }));
  };

  const handleSendTextMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) {
      chatInputRef.current?.focus();
      return;
    }
    sendTextOrQuickReply(chatInput);
    setChatInput('');
  };

  // Voice Note Recording Helpers
  const startRecording = async () => {
    setIsRecording(true);
    setRecordingSec(0);
    recordingSecRef.current = 0;

    recordTimerRef.current = window.setInterval(() => {
      recordingSecRef.current += 1;
      setRecordingSec((prev) => prev + 1);
    }, 1000);

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        audioChunksRef.current = [];
        recorder.ondataavailable = (ev) => {
          if (ev.data.size > 0) audioChunksRef.current.push(ev.data);
        };
        recorder.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
        };
        recorder.start();
        mediaRecorderRef.current = recorder;
      }
    } catch {
      mediaRecorderRef.current = null;
    }
  };

  const cancelRecording = () => {
    if (recordTimerRef.current) {
      window.clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    setIsRecording(false);
    setRecordingSec(0);
  };

  const finishRecording = () => {
    if (recordTimerRef.current) {
      window.clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    const finalDuration = Math.max(1, recordingSecRef.current);

    const postVoiceMsg = (url?: string) => {
      const timeNow = new Date().toLocaleTimeString('ar-EG', {
        hour: '2-digit',
        minute: '2-digit',
      });
      const msgId = `msg_voice_${Date.now()}`;
      const msg: ChatMessage = {
        id: msgId,
        branchId: branch.id,
        sender: 'branch',
        kind: 'text',
        text: `رسالة صوتية (${finalDuration} ثانية)`,
        audioNote: {
          durationSeconds: finalDuration,
          audioUrl: url,
        },
        shift: activeShift,
        shiftDate: tomorrowIso,
        time: timeNow,
        readByAdmin: false,
        readByBranch: true,
      };
      onUpdateState((prev) => ({
        ...prev,
        messages: [...prev.messages, msg],
        notifications: [
          ...prev.notifications,
          {
            id: `nvoice_${Date.now()}`,
            kind: 'message',
            senderRole: 'branch',
            senderName: `فرع ${branch.name}`,
            recipientRole: 'central',
            branchId: branch.id,
            shift: activeShift,
            shiftDate: tomorrowIso,
            messageId: msgId,
            text: `رسالة صوتية من فرع ${branch.name} (${finalDuration} ث)`,
            time: timeNow,
            read: false,
          },
        ],
      }));
    };

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      const recorder = mediaRecorderRef.current;
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = blob.size > 0 ? URL.createObjectURL(blob) : undefined;
        postVoiceMsg(url);
        recorder.stream.getTracks().forEach((t) => t.stop());
      };
      recorder.stop();
      mediaRecorderRef.current = null;
    } else {
      postVoiceMsg();
    }

    setIsRecording(false);
    setRecordingSec(0);
  };

  const togglePlayAudio = (msg: ChatMessage) => {
    if (!msg.audioNote) return;
    if (playingMsgId === msg.id) {
      audioPlayerRef.current?.pause();
      setPlayingMsgId(null);
      return;
    }
    if (audioPlayerRef.current) audioPlayerRef.current.pause();
    if (msg.audioNote.audioUrl) {
      const audio = new Audio(msg.audioNote.audioUrl);
      audioPlayerRef.current = audio;
      audio.onended = () => setPlayingMsgId(null);
      audio.play().catch(() => setPlayingMsgId(null));
      setPlayingMsgId(msg.id);
    } else {
      setPlayingMsgId(msg.id);
      window.setTimeout(() => {
        setPlayingMsgId((curr) => (curr === msg.id ? null : curr));
      }, msg.audioNote.durationSeconds * 1000);
    }
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleAckAdminMessage = (msg: ChatMessage) => {
    onUpdateState((prev) => ({
      ...prev,
      messages: prev.messages.map((m) =>
        m.id === msg.id ? { ...m, readByBranch: true } : m
      ),
      transferNotices: prev.transferNotices.map((t) =>
        t.targetBranchId === branch.id && !t.acknowledged
          ? { ...t, acknowledged: true }
          : t
      ),
      notifications: prev.notifications.map((n) =>
        n.recipientRole === 'branch' && n.recipientBranchId === branch.id && !n.read
          ? { ...n, read: true }
          : n
      ),
    }));
    onNotify('تم تأكيد الاطلاع');
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

    const emgMsgId = `msg_emg_${Date.now()}`;
    const emgMsg: ChatMessage = {
      id: emgMsgId,
      branchId: branch.id,
      sender: 'branch',
      kind: 'emergency',
      text: `بلاغ غياب طارئ (${SHIFT_FULL_AR[shift]})\nالموظف: ${targetRow.empName}\nالسبب: ${reasonLabel}`,
      shift,
      shiftDate: tomorrowIso,
      time: timeNow,
      readByAdmin: false,
      readByBranch: true,
    };

    onUpdateState((prev) => ({
      ...prev,
      submissions: {
        ...prev.submissions,
        [key]: {
          ...sub,
          rows: nextRows,
          compliance: nextCompliance,
          hasEdit: true,
          lastEditAt: timeNow,
          lastEditSummary: `بلاغ غياب طارئ: ${targetRow.empName} (${reasonLabel})`,
        },
      },
      messages: [...prev.messages, emgMsg],
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
          messageId: emgMsgId,
          isEdit: true,
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
    setEmergencyOpen(false);
    onNotify(`تم إرسال بلاغ الغياب الطارئ لـ ${targetRow.empName}`);
  };

  // =========================================================================
  // SCREEN: WHATSAPP CONTACTS STYLE (طاقم الفرع)
  // =========================================================================
  if (branchScreen === 'settings') {
    const handleAddBranchEmp = (e: React.FormEvent) => {
      e.preventDefault();
      const name = newName.trim();
      if (!name) {
        onNotify('أدخل اسم الموظف');
        return;
      }

      const monthlyLeaves: MonthlyLeave[] = [];
      if (newMonthlyDraft) {
        const refMonth = pad2(cairoToday.month + 1);
        const refDay = pad2(newMonthlyDraft.dayOfMonth);
        monthlyLeaves.push({
          id: `ml_${Date.now()}`,
          recurringDayOfMonth: newMonthlyDraft.dayOfMonth,
          startDate: `${cairoToday.year}-${refMonth}-${refDay}`,
          daysCount: newMonthlyDraft.daysCount,
          skipWeeklyInSameWeek: newMonthlyDraft.skipWeeklyInSameWeek,
        });
      }

      const emp: Employee = {
        id: `e_${branch.id}_${Date.now()}`,
        name,
        shift: newShift,
        suspended: false,
        weeklyOffDay: newOffDay,
        extraOffDay1: null,
        extraOffDay2: null,
        monthlyLeaves,
      };

      onUpdateState((prev) => ({
        ...prev,
        branches: prev.branches.map((b) =>
          b.id === branch.id ? { ...b, emps: [...b.emps, emp] } : b
        ),
      }));
      setNewName('');
      setNewMonthlyDraft(null);
      setAddStaffOpen(false);
      onNotify(`تمت إضافة ${name} لطاقم الفرع`);
    };

    const weeklyDialEmp =
      weeklyDialTarget?.mode === 'emp'
        ? branch.emps.find((e) => e.id === weeklyDialTarget.empId) || null
        : null;
    const monthlyDialEmp =
      monthlyDialTarget?.mode === 'emp'
        ? branch.emps.find((e) => e.id === monthlyDialTarget.empId) || null
        : null;

    const visibleStaff = branch.emps.filter(
      (e) => !e.suspended && e.name.toLowerCase().includes(staffSearch.trim().toLowerCase())
    );

    return (
      <div className="flex h-full flex-col overflow-hidden bg-white dark:bg-[#111B21]">
        {/* WhatsApp Contacts Header */}
        <header className="flex h-[56px] shrink-0 items-center justify-between gap-2 bg-[#008069] px-3 text-white shadow-xs dark:bg-[#202C33]">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={onBackToChatsList}
              aria-label="العودة للمحادثات"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full hover:bg-white/10 lg:hidden"
            >
              <ArrowRight className="h-6 w-6" />
            </button>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#00A884] text-white">
              <Users className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-extrabold sm:text-base">
                طاقم فرع {branch.name}
              </h1>
              <p className="truncate text-[11px] text-white/80 tabular-nums dark:text-[#8696A0]">
                {branch.emps.filter((e) => !e.suspended).length} موظف مسجل
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setAddStaffOpen(true)}
            className="flex min-h-[40px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-white/15 px-3.5 py-1.5 text-xs font-extrabold text-white hover:bg-white/25 dark:bg-[#00A884] dark:text-[#111B21]"
          >
            <Plus className="h-4 w-4" />
            <span>إضافة موظف</span>
          </button>
        </header>

        {/* Search Bar */}
        <div className="shrink-0 border-b border-black/10 bg-[#F0F2F5] px-3 py-2.5 dark:border-white/10 dark:bg-[#111B21]">
          <div className="flex min-h-[42px] items-center gap-2 rounded-xl bg-white px-3.5 dark:bg-[#202C33]">
            <Search className="h-4 w-4 shrink-0 text-[#667781] dark:text-[#8696A0]" />
            <input
              type="text"
              value={staffSearch}
              onChange={(e) => setStaffSearch(e.target.value)}
              placeholder="ابحث باسم الموظف..."
              className="w-full bg-transparent py-1.5 text-sm text-[#111b21] placeholder:text-[#667781] focus:outline-none dark:text-[#E9EDEF] dark:placeholder:text-[#8696A0]"
            />
          </div>
        </div>

        {/* WhatsApp Contacts List */}
        <div className="wa-scroll flex-1 divide-y divide-black/5 overflow-y-auto dark:divide-white/5">
          {visibleStaff.map((emp) => (
            <div
              key={emp.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#008069] text-sm font-extrabold text-white dark:bg-[#00A884] dark:text-[#111B21]">
                  {emp.name.slice(0, 1)}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-base font-extrabold text-[#111b21] dark:text-[#E9EDEF]">
                    {emp.name}
                  </div>
                  <div className="text-xs font-semibold text-[#54656f] dark:text-[#8696A0]">
                    {SHIFTS_AR[emp.shift]} · أسبوعية:{' '}
                    {emp.weeklyOffDay === null ? 'بدون' : DAY_NAMES_AR[emp.weeklyOffDay]}
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setWeeklyDialTarget({ mode: 'emp', empId: emp.id })}
                  className="min-h-[40px] rounded-xl border border-[#d1d7db] bg-[#f8fafc] px-3 py-1.5 text-xs font-bold text-[#111b21] hover:border-[#00A884] dark:border-white/10 dark:bg-[#202C33] dark:text-[#E9EDEF]"
                >
                  الأسبوعية
                </button>
                <button
                  type="button"
                  onClick={() => setMonthlyDialTarget({ mode: 'emp', empId: emp.id })}
                  className="min-h-[40px] rounded-xl border border-[#008069] bg-white px-3 py-1.5 text-xs font-bold text-[#008069] hover:bg-[#e7fce3] dark:border-[#00A884] dark:bg-[#202C33] dark:text-[#00A884]"
                >
                  شهرية ({(emp.monthlyLeaves || []).length})
                </button>
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
                  className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 dark:text-rose-400"
                  aria-label={`حذف ${emp.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Add Employee Bottom Sheet */}
        {addStaffOpen && (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs sm:items-center sm:p-4"
            onClick={() => setAddStaffOpen(false)}
          >
            <form
              onSubmit={handleAddBranchEmp}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-t-3xl bg-white p-5 text-[#111b21] shadow-2xl sm:rounded-3xl dark:bg-[#202C33] dark:text-[#E9EDEF]"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-extrabold">إضافة موظف جديد للفرع</h2>
                <button
                  type="button"
                  onClick={() => setAddStaffOpen(false)}
                  aria-label="إغلاق"
                  className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-3">
                <input
                  type="text"
                  required
                  placeholder="اسم الموظف"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="min-h-[48px] w-full rounded-xl border border-[#d1d7db] bg-[#f8fafc] px-3.5 text-sm font-bold outline-none focus:border-[#00A884] dark:border-white/10 dark:bg-[#111B21]"
                />
                <div className="grid grid-cols-3 gap-2">
                  {(['morning', 'between', 'evening'] as ShiftType[]).map((sh) => (
                    <button
                      key={sh}
                      type="button"
                      onClick={() => setNewShift(sh)}
                      className={`min-h-[44px] rounded-xl text-xs font-extrabold ${
                        newShift === sh
                          ? 'bg-[#008069] text-white dark:bg-[#00A884] dark:text-[#111B21]'
                          : 'border border-[#d1d7db] bg-[#f8fafc] text-[#3b4a54] dark:border-white/10 dark:bg-[#111B21] dark:text-[#AEBAC1]'
                      }`}
                    >
                      {SHIFTS_AR[sh]}
                    </button>
                  ))}
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setWeeklyDialTarget({ mode: 'new' })}
                    className="flex min-h-[46px] items-center justify-between rounded-xl border border-[#d1d7db] bg-[#f8fafc] px-3.5 text-xs font-extrabold hover:border-[#00A884] dark:border-white/10 dark:bg-[#111B21]"
                  >
                    <span className="flex items-center gap-1.5 text-[#54656f] dark:text-[#8696A0]">
                      <Clock className="h-4 w-4 text-[#008069] dark:text-[#00A884]" />
                      <span>الأسبوعية:</span>
                    </span>
                    <span className="text-[#008069] dark:text-[#00A884]">
                      {newOffDay === null ? 'بدون' : DAY_NAMES_AR[newOffDay]}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMonthlyDialTarget({ mode: 'new' })}
                    className="flex min-h-[46px] items-center justify-between rounded-xl border border-[#d1d7db] bg-[#f8fafc] px-3.5 text-xs font-extrabold hover:border-[#00A884] dark:border-white/10 dark:bg-[#111B21]"
                  >
                    <span className="flex items-center gap-1.5 text-[#54656f] dark:text-[#8696A0]">
                      <CalendarDays className="h-4 w-4 text-[#008069] dark:text-[#00A884]" />
                      <span>شهرية:</span>
                    </span>
                    <span className="text-[#008069] dark:text-[#00A884]">
                      {newMonthlyDraft
                        ? `يوم ${newMonthlyDraft.dayOfMonth} (${newMonthlyDraft.daysCount} يوم)`
                        : 'بالدائرية'}
                    </span>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="mt-5 flex min-h-[50px] w-full items-center justify-center gap-1.5 rounded-full bg-[#008069] text-sm font-extrabold text-white hover:bg-[#016b58] dark:bg-[#00A884] dark:text-[#111B21]"
              >
                <Plus className="h-4 w-4" />
                <span>حفظ وإضافة للطاقم</span>
              </button>
            </form>
          </div>
        )}

        <WeeklyOffDialModal
          open={weeklyDialTarget !== null}
          selectedDay={
            weeklyDialTarget?.mode === 'new'
              ? newOffDay
              : weeklyDialEmp?.weeklyOffDay ?? null
          }
          onCancel={() => setWeeklyDialTarget(null)}
          onConfirm={(pickedDay) => {
            if (weeklyDialTarget?.mode === 'new') {
              setNewOffDay(pickedDay);
            } else if (weeklyDialEmp) {
              onUpdateState((prev) => ({
                ...prev,
                branches: prev.branches.map((b) =>
                  b.id !== branch.id
                    ? b
                    : {
                        ...b,
                        emps: b.emps.map((e) =>
                          e.id === weeklyDialEmp.id ? { ...e, weeklyOffDay: pickedDay } : e
                        ),
                      }
                ),
              }));
              onNotify(`تم تحديث الإجازة الأسبوعية لـ ${weeklyDialEmp.name}`);
            }
            setWeeklyDialTarget(null);
          }}
        />

        <MonthlyLeaveDialModal
          open={monthlyDialTarget !== null}
          initialDayOfMonth={
            monthlyDialTarget?.mode === 'new' ? newMonthlyDraft?.dayOfMonth ?? 5 : 5
          }
          initialDaysCount={
            monthlyDialTarget?.mode === 'new' ? newMonthlyDraft?.daysCount ?? 2 : 2
          }
          initialSkipWeekly={
            monthlyDialTarget?.mode === 'new'
              ? newMonthlyDraft?.skipWeeklyInSameWeek ?? true
              : true
          }
          employeeName={
            monthlyDialTarget?.mode === 'new'
              ? newName.trim() || 'موظف جديد'
              : monthlyDialEmp?.name
          }
          onCancel={() => setMonthlyDialTarget(null)}
          onConfirm={(res) => {
            if (monthlyDialTarget?.mode === 'new') {
              setNewMonthlyDraft(res);
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
              onUpdateState((prev) => ({
                ...prev,
                branches: prev.branches.map((b) =>
                  b.id !== branch.id
                    ? b
                    : {
                        ...b,
                        emps: b.emps.map((e) =>
                          e.id === monthlyDialEmp.id
                            ? { ...e, monthlyLeaves: [...(e.monthlyLeaves || []), newLeave] }
                            : e
                        ),
                      }
                ),
              }));
              onNotify(
                `تم حفظ إجازة ${monthlyDialEmp.name}: يوم ${res.dayOfMonth} كل شهر (${res.daysCount} يوم)`
              );
            }
            setMonthlyDialTarget(null);
          }}
        />
      </div>
    );
  }

  // =========================================================================
  // MAIN SCREEN: AUTHENTIC WHATSAPP CHAT + INNOVATIVE 1-TAP SHIFT BOTTOM SHEET
  // =========================================================================
  const legacyPendingTransfers = state.transferNotices.filter(
    (t) =>
      t.targetBranchId === branch.id &&
      !t.acknowledged &&
      !branchMessages.some((m) => m.kind === 'transfer' && m.text.includes(t.text))
  );

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-[#EFEAE2] dark:bg-[#0B141A]">
      {/* Authentic WhatsApp Top Bar (Compact 56px) */}
      <header className="relative z-20 flex h-[56px] shrink-0 items-center justify-between gap-2 bg-[#008069] px-2.5 text-white shadow-xs sm:px-4 dark:bg-[#202C33]">
        <div className="relative flex min-w-0 items-center gap-1.5">
          <button
            type="button"
            onClick={onBackToChatsList}
            aria-label="العودة لقائمة المحادثات"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full transition-colors hover:bg-white/10 lg:hidden"
          >
            <ArrowRight className="h-6 w-6" />
          </button>

          <button
            id="branchHeaderProfileBtn"
            type="button"
            onClick={() => {
              setMenuOpen(false);
              setProfileMenuOpen((o) => !o);
            }}
            aria-expanded={profileMenuOpen}
            className="flex min-w-0 items-center gap-2.5 rounded-xl px-1.5 py-1 text-right transition-colors hover:bg-white/10"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-white dark:bg-[#00A884] dark:text-[#111B21]">
              <Building2 className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <h1 className="truncate text-[15px] font-extrabold leading-tight sm:text-base">
                  الأدمن · فرع {branch.name}
                </h1>
                <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-85" />
              </div>
              <p className="truncate text-[11px] font-semibold text-white/85 dark:text-[#8696A0]">
                غداً {fmtDateAr(tomorrowIso)} · اضغط للخيارات
              </p>
            </div>
          </button>

          {profileMenuOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setProfileMenuOpen(false)} />
              <div className="absolute right-0 top-13 z-40 w-60 overflow-hidden rounded-xl bg-white py-1.5 text-[#111B21] shadow-xl ring-1 ring-[#E9EDEF] dark:bg-[#233138] dark:text-[#E9EDEF] dark:ring-[#222E35]">
                <button
                  type="button"
                  onClick={() => {
                    setProfileMenuOpen(false);
                    onOpenPlanner();
                  }}
                  className="flex min-h-[44px] w-full items-center gap-2.5 px-4 text-right text-sm font-bold hover:bg-[#F0F2F5] dark:hover:bg-white/5"
                >
                  <CalendarDays className="h-4 w-4 text-[#008069] dark:text-[#00A884]" />
                  <span>خطة الأسبوع</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setProfileMenuOpen(false);
                    setAddStaffOpen(false);
                    onChangeSession({ branchScreen: 'settings' });
                  }}
                  className="flex min-h-[44px] w-full items-center gap-2.5 px-4 text-right text-sm font-bold hover:bg-[#F0F2F5] dark:hover:bg-white/5"
                >
                  <Users className="h-4 w-4 text-[#008069] dark:text-[#00A884]" />
                  <span>طاقم الفرع</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setProfileMenuOpen(false);
                    setAddStaffOpen(true);
                    onChangeSession({ branchScreen: 'settings' });
                  }}
                  className="flex min-h-[44px] w-full items-center gap-2.5 px-4 text-right text-sm font-bold hover:bg-[#F0F2F5] dark:hover:bg-white/5"
                >
                  <UserPlus className="h-4 w-4 text-[#008069] dark:text-[#00A884]" />
                  <span>إضافة موظف</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setProfileMenuOpen(false);
                    onOpenNotifications();
                  }}
                  className="flex min-h-[44px] w-full items-center justify-between px-4 text-right text-sm font-bold hover:bg-[#F0F2F5] dark:hover:bg-white/5"
                >
                  <span className="flex items-center gap-2.5">
                    <Bell className="h-4 w-4 text-[#008069] dark:text-[#00A884]" />
                    <span>الإشعارات</span>
                  </span>
                  {unreadNotifCount > 0 && (
                    <span className="font-mono-num rounded-full bg-[#25D366] px-2 py-0.5 text-xs font-extrabold text-[#111B21]">
                      {unreadNotifCount}
                    </span>
                  )}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Clean Header Actions: Tour + 1-Tap Theme Switch + 3-Dot Overflow Menu */}
        <div className="relative flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={onOpenTour}
            aria-label="الجولة التعليمية"
            title="الجولة التعليمية"
            className="flex min-h-[40px] items-center gap-1 rounded-full bg-[#25D366] px-2.5 py-1 text-[11px] font-extrabold text-[#111B21] transition-colors hover:bg-[#1FC45B]"
          >
            <Compass className="h-3.5 w-3.5" />
            <span>الجولة</span>
          </button>

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={branchTheme === 'dark' ? 'الوضع النهاري' : 'الوضع الليلي'}
            title={branchTheme === 'dark' ? 'تبديل للوضع النهاري' : 'تبديل للوضع الليلي'}
            className="flex min-h-[44px] min-w-[40px] items-center justify-center rounded-full text-white transition-colors hover:bg-white/10"
          >
            {branchTheme === 'dark' ? (
              <Sun className="h-5 w-5 text-amber-300" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setProfileMenuOpen(false);
              setMenuOpen((o) => !o);
            }}
            aria-label="المزيد من الخيارات"
            className="relative flex min-h-[44px] min-w-[40px] items-center justify-center rounded-full text-white transition-colors hover:bg-white/10"
          >
            <MoreVertical className="h-5 w-5" />
            {unreadNotifCount > 0 && (
              <span className="font-mono-num absolute left-1.5 top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#25D366] px-1 text-[10px] font-extrabold text-[#111B21]">
                {unreadNotifCount}
              </span>
            )}
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
              <div className="absolute left-0 top-12 z-40 w-60 overflow-hidden rounded-xl bg-white py-1.5 text-[#111B21] shadow-xl ring-1 ring-[#E9EDEF] dark:bg-[#233138] dark:text-[#E9EDEF] dark:ring-[#222E35]">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenPlanner();
                  }}
                  className="flex min-h-[44px] w-full items-center gap-2.5 px-4 text-right text-sm font-bold hover:bg-[#F0F2F5] dark:hover:bg-white/5"
                >
                  <CalendarDays className="h-4 w-4 text-[#008069] dark:text-[#00A884]" />
                  <span>خطة الأسبوع</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setAddStaffOpen(false);
                    onChangeSession({ branchScreen: 'settings' });
                  }}
                  className="flex min-h-[44px] w-full items-center gap-2.5 px-4 text-right text-sm font-bold hover:bg-[#F0F2F5] dark:hover:bg-white/5"
                >
                  <Users className="h-4 w-4 text-[#008069] dark:text-[#00A884]" />
                  <span>طاقم الفرع</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setAddStaffOpen(true);
                    onChangeSession({ branchScreen: 'settings' });
                  }}
                  className="flex min-h-[44px] w-full items-center gap-2.5 px-4 text-right text-sm font-bold hover:bg-[#F0F2F5] dark:hover:bg-white/5"
                >
                  <UserPlus className="h-4 w-4 text-[#008069] dark:text-[#00A884]" />
                  <span>إضافة موظف</span>
                </button>
                <button
                  id="notifBellBtn"
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenNotifications();
                  }}
                  className="flex min-h-[44px] w-full items-center justify-between px-4 text-right text-sm font-bold hover:bg-[#F0F2F5] dark:hover:bg-white/5"
                >
                  <span className="flex items-center gap-2.5">
                    <Bell className="h-4 w-4 text-[#008069] dark:text-[#00A884]" />
                    <span>الإشعارات</span>
                  </span>
                  {unreadNotifCount > 0 && (
                    <span className="font-mono-num rounded-full bg-[#25D366] px-2 py-0.5 text-xs font-extrabold text-[#111B21]">
                      {unreadNotifCount}
                    </span>
                  )}
                </button>
                <div className="my-1 border-t border-[#E9EDEF] dark:border-white/10" />
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onToggleLargeFont();
                  }}
                  className="flex min-h-[44px] w-full items-center justify-between px-4 text-right text-sm font-bold hover:bg-[#F0F2F5] dark:hover:bg-white/5"
                >
                  <span className="flex items-center gap-2.5">
                    <Type className="h-4 w-4 text-[#008069] dark:text-[#00A884]" />
                    <span>تكبير حجم الخط</span>
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold ${
                      largeFont
                        ? 'bg-[#D9FDD3] text-[#008069] dark:bg-[#005C4B] dark:text-[#25D366]'
                        : 'bg-[#F0F2F5] text-[#667781] dark:bg-[#111B21] dark:text-[#8696A0]'
                    }`}
                  >
                    {largeFont ? 'مفعّل' : 'عادي'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onToggleTheme();
                  }}
                  className="flex min-h-[44px] w-full items-center justify-between px-4 text-right text-sm font-bold hover:bg-[#F0F2F5] dark:hover:bg-white/5"
                >
                  <span className="flex items-center gap-2.5">
                    {branchTheme === 'dark' ? (
                      <Sun className="h-4 w-4 text-amber-400" />
                    ) : (
                      <Moon className="h-4 w-4 text-[#008069]" />
                    )}
                    <span>{branchTheme === 'dark' ? 'الوضع النهاري' : 'الوضع الليلي'}</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenTour();
                  }}
                  className="flex min-h-[44px] w-full items-center gap-2.5 px-4 text-right text-sm font-bold hover:bg-[#F0F2F5] dark:hover:bg-white/5"
                >
                  <Compass className="h-4 w-4 text-[#008069] dark:text-[#00A884]" />
                  <span>الجولة التعليمية</span>
                </button>
                <div className="my-1 border-t border-[#E9EDEF] dark:border-white/10" />
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onLogout();
                  }}
                  className="flex min-h-[44px] w-full items-center gap-2.5 px-4 text-right text-sm font-bold text-rose-600 hover:bg-[#F0F2F5] dark:text-rose-400 dark:hover:bg-white/5"
                >
                  <LogOut className="h-4 w-4" />
                  <span>تبديل الفرع / خروج</span>
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {/* Slim Pinned Reminder Strip: Clear Missing-Shift Indicator Above Chat */}
      <div className="relative z-10 grid shrink-0 grid-cols-2 gap-1.5 border-b border-[#E9EDEF] bg-[#F0F2F5] px-2.5 py-1.5 dark:border-[#222E35] dark:bg-[#182229] sm:px-4">
        <button
          type="button"
          onClick={() => onChangeSession({ activeShift: 'morning', branchScreen: 'submit' })}
          className={`flex min-h-[34px] items-center justify-center gap-1.5 rounded-lg px-2 py-1 text-xs font-extrabold transition-colors ${
            morningSub
              ? 'bg-[#E7FCE3] text-[#008069] dark:bg-[#005C4B]/60 dark:text-[#25D366]'
              : 'bg-amber-500/15 text-amber-800 hover:bg-amber-500/25 dark:bg-amber-500/15 dark:text-amber-300'
          }`}
        >
          {morningSub ? (
            <>
              <Check className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">الصباحي تم الإرسال ({morningSub.compliance.actualCount})</span>
            </>
          ) : (
            <>
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">الصباحي · لم يُرسل بعد</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => onChangeSession({ activeShift: 'evening', branchScreen: 'submit' })}
          className={`flex min-h-[34px] items-center justify-center gap-1.5 rounded-lg px-2 py-1 text-xs font-extrabold transition-colors ${
            eveningSub
              ? 'bg-[#E7FCE3] text-[#008069] dark:bg-[#005C4B]/60 dark:text-[#25D366]'
              : 'bg-amber-500/15 text-amber-800 hover:bg-amber-500/25 dark:bg-amber-500/15 dark:text-amber-300'
          }`}
        >
          {eveningSub ? (
            <>
              <Check className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">المسائي تم الإرسال ({eveningSub.compliance.actualCount})</span>
            </>
          ) : (
            <>
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">المسائي · لم يُرسل بعد</span>
            </>
          )}
        </button>
      </div>

      {/* Scrollable WhatsApp Chat Canvas */}
      <div className="relative flex-1 overflow-hidden">
        <div
          ref={chatScrollRef}
          onScroll={handleChatScroll}
          className="wa-chat-bg wa-scroll flex h-full flex-col gap-2.5 overflow-y-auto px-3 py-4 sm:px-6"
        >
          {/* Date Separator */}
          <div className="my-1 flex justify-center">
            <span className="rounded-lg bg-white/90 px-3 py-1 text-[11px] font-extrabold text-[#54656F] shadow-xs dark:bg-[#182229] dark:text-[#8696A0]">
              غداً · {fmtDateAr(tomorrowIso)}
            </span>
          </div>

          {/* Incoming Welcome Bubble */}
          <div className="flex justify-end px-1">
            <div className="relative max-w-[88%] rounded-xl rounded-tl-none bg-white px-3.5 py-2.5 text-[#111B21] shadow-xs sm:max-w-[72%] dark:bg-[#202C33] dark:text-[#E9EDEF]">
              <svg
                viewBox="0 0 8 13"
                className="pointer-events-none absolute -left-[7px] top-0 h-[13px] w-[8px] fill-white dark:fill-[#202C33]"
                aria-hidden="true"
              >
                <path d="M1.533 3.568 8 12.193V1H2.812C1.042 1 .474 2.156 1.533 3.568z" />
              </svg>
              <div className="mb-1 text-xs font-extrabold text-[#008069] dark:text-[#00A884]">
                الأدمن
              </div>
              <p className="text-[14.5px] leading-relaxed">
                أهلاً بفرع {branch.name}
                <br />
                ابعت طاقم الصباحي والمسائي لبكره بلمسة واحدة من الأزرار تحت، أو ابعت رسالة صوتية أو مكتوبة هنا.
              </p>
            </div>
          </div>

          {legacyPendingTransfers.map((t) => (
            <div key={t.id} className="flex justify-end px-1">
              <div className="relative max-w-[88%] rounded-xl rounded-tl-none border border-rose-500/40 bg-white px-4 py-3 text-[#111B21] shadow-xs sm:max-w-[72%] dark:bg-[#202C33] dark:text-[#E9EDEF]">
                <div className="mb-1 text-xs font-extrabold text-rose-500">
                  الأدمن · {t.typeLabel}
                </div>
                <p className="text-sm font-bold">{t.text}</p>
                <div className="mt-2.5 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateState((prev) => ({
                        ...prev,
                        transferNotices: prev.transferNotices.map((x) =>
                          x.id === t.id ? { ...x, acknowledged: true } : x
                        ),
                      }))
                    }
                    className="flex min-h-[38px] items-center gap-1 rounded-full bg-[#00A884] px-4 py-1.5 text-xs font-extrabold text-[#111B21]"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>تم الاطلاع</span>
                  </button>
                  <span className="font-mono-num text-[10px] text-[#667781] dark:text-[#8696A0]">
                    {t.time}
                  </span>
                </div>
              </div>
            </div>
          ))}

          {/* Real Messages */}
          {branchMessages.map((msg) => {
            const isBranchSender = msg.sender === 'branch';
            const isHighlighted = highlightedMsgId === msg.id;

            if (isBranchSender) {
              const isEmergency = msg.kind === 'emergency';
              return (
                <div
                  key={msg.id}
                  ref={(el) => {
                    msgRefs.current[msg.id] = el;
                  }}
                  className="flex justify-start px-1"
                >
                  <div
                    className={`relative max-w-[88%] rounded-xl rounded-tr-none px-3.5 py-2.5 shadow-xs transition-all sm:max-w-[72%] ${
                      isEmergency
                        ? 'border border-rose-500/50 bg-[#fff1f2] text-[#111B21] dark:bg-[#3A161B] dark:text-[#FFE4E6]'
                        : msg.supersededByMsgId
                        ? 'bg-[#eef7ec] text-[#111B21] opacity-70 dark:bg-[#004236] dark:text-[#E9EDEF]'
                        : 'bg-[#D9FDD3] text-[#111B21] dark:bg-[#005C4B] dark:text-[#E9EDEF]'
                    } ${isHighlighted ? 'ring-2 ring-[#00A884]' : ''}`}
                  >
                    {!isEmergency && (
                      <svg
                        viewBox="0 0 8 13"
                        className={`pointer-events-none absolute -right-[7px] top-0 h-[13px] w-[8px] -scale-x-100 ${
                          msg.supersededByMsgId
                            ? 'fill-[#eef7ec] dark:fill-[#004236]'
                            : 'fill-[#D9FDD3] dark:fill-[#005C4B]'
                        }`}
                        aria-hidden="true"
                      >
                        <path d="M1.533 3.568 8 12.193V1H2.812C1.042 1 .474 2.156 1.533 3.568z" />
                      </svg>
                    )}
                    {msg.isEditedResend && (
                      <div className="mb-2 rounded-lg bg-amber-500/15 px-2.5 py-1.5 text-[11px] font-extrabold text-amber-800 dark:text-amber-300">
                        <div>تعديل بعد الإرسال</div>
                        {msg.editSummary && (
                          <div className="mt-0.5 font-semibold opacity-90">
                            {msg.editSummary}
                          </div>
                        )}
                      </div>
                    )}

                    {msg.supersededByMsgId && (
                      <div className="mb-1.5 text-[10px] font-extrabold opacity-75">
                        نسخة سابقة — تم تعديلها
                      </div>
                    )}

                    {msg.kind === 'availability' && msg.shift && (
                      <div className="mb-2 flex items-center justify-between gap-3 border-b border-black/10 pb-2 dark:border-white/15">
                        <div>
                          <div className="text-sm font-extrabold text-[#008069] dark:text-[#25D366]">
                            {SHIFT_FULL_AR[msg.shift]}
                          </div>
                          {msg.shiftDate && (
                            <div className="text-[11px] font-semibold text-[#54656F] dark:text-[#AEBAC1]">
                              غداً · {fmtDateAr(msg.shiftDate)}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            onChangeSession({
                              activeShift: msg.shift!,
                              branchScreen: 'submit',
                            })
                          }
                          className="flex min-h-[34px] items-center gap-1 rounded-full bg-black/5 px-3 py-1 text-xs font-extrabold hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          <span>تعديل</span>
                        </button>
                      </div>
                    )}

                    {msg.audioNote ? (
                      <div className="my-1 flex min-w-[200px] items-center gap-3 py-1">
                        <button
                          type="button"
                          onClick={() => togglePlayAudio(msg)}
                          aria-label={playingMsgId === msg.id ? 'إيقاف' : 'تشغيل'}
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#008069] text-white dark:bg-[#00A884] dark:text-[#111B21]"
                        >
                          {playingMsgId === msg.id ? (
                            <Pause className="h-4 w-4" />
                          ) : (
                            <Play className="h-4 w-4 translate-x-[1px]" />
                          )}
                        </button>
                        <div className="flex-1">
                          <div className="flex h-4 items-center gap-0.5">
                            {[40, 70, 95, 50, 80, 45, 90, 60, 40, 75, 55, 85].map((h, i) => (
                              <span
                                key={i}
                                className={`w-1 rounded-full ${
                                  playingMsgId === msg.id
                                    ? 'bg-[#00A884]'
                                    : 'bg-current opacity-40'
                                }`}
                                style={{ height: `${Math.round((h / 100) * 14) + 4}px` }}
                              />
                            ))}
                          </div>
                          <div className="font-mono-num mt-1 text-[11px] opacity-80">
                            {formatTimer(msg.audioNote.durationSeconds)} · رسالة صوتية
                          </div>
                        </div>
                      </div>
                    ) : msg.kind === 'availability' ? (
                      (() => {
                        const parsed = parseAvailabilityBubble(msg.text);
                        if (!parsed.parsed) {
                          return (
                            <div className="whitespace-pre-line text-[15.5px] font-bold leading-relaxed">
                              {msg.text}
                            </div>
                          );
                        }
                        return (
                          <div className="space-y-2.5">
                            {/* Clear Summary Counts Bar */}
                            <div className="flex flex-wrap items-center gap-2 text-xs font-extrabold">
                              <span className="inline-flex items-center gap-1 rounded-lg bg-[#008069]/12 px-2.5 py-1 text-[#008069] dark:bg-[#25D366]/15 dark:text-[#25D366]">
                                <Check className="h-3.5 w-3.5" />
                                <span>حضور: {parsed.availList.length}</span>
                              </span>
                              {parsed.unavailList.length > 0 && (
                                <span className="inline-flex items-center gap-1 rounded-lg bg-rose-500/15 px-2.5 py-1 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300">
                                  <X className="h-3.5 w-3.5" />
                                  <span>غياب / إجازة: {parsed.unavailList.length}</span>
                                </span>
                              )}
                            </div>

                            {/* Present Staff List (Green) */}
                            <div className="space-y-1">
                              {parsed.availList.length === 0 ? (
                                <div className="text-sm font-bold opacity-75">لا يوجد حضور</div>
                              ) : (
                                parsed.availList.map((name, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-center gap-2 text-[15.5px] font-bold leading-snug"
                                  >
                                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#008069]/15 text-[#008069] dark:bg-[#25D366]/20 dark:text-[#25D366]">
                                      <Check className="h-3 w-3 stroke-[3]" />
                                    </span>
                                    <span>{name}</span>
                                  </div>
                                ))
                              )}
                            </div>

                            {/* Absent / Off Staff List (Separated Red Tint) */}
                            {parsed.unavailList.length > 0 && (
                              <div className="space-y-1 rounded-xl bg-rose-500/10 p-2.5 dark:bg-[#111B21]/50">
                                {parsed.unavailList.map((item, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-start gap-2 text-[14.5px] font-bold text-rose-800 dark:text-rose-300"
                                  >
                                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-500/20 text-rose-600 dark:text-rose-300">
                                      <X className="h-3 w-3 stroke-[3]" />
                                    </span>
                                    <span>{item}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })()
                    ) : (
                      <div className="whitespace-pre-line text-[15.5px] font-semibold leading-relaxed">
                        {msg.text}
                      </div>
                    )}

                    <div className="mt-1 flex items-center justify-end gap-1.5 text-[10px] font-bold opacity-80">
                      <span className="font-mono-num">{msg.time}</span>
                      <CheckCheck
                        className={`h-4 w-4 ${
                          msg.readByAdmin
                            ? 'text-[#53BDEB]'
                            : 'text-[#667781] dark:text-[#8696A0]'
                        }`}
                      />
                      <span className={msg.readByAdmin ? 'text-[#53BDEB]' : ''}>
                        {msg.readByAdmin ? 'تم الاطلاع' : 'تم الإرسال'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            }

            // Incoming from Central Admin
            return (
              <div
                key={msg.id}
                ref={(el) => {
                  msgRefs.current[msg.id] = el;
                }}
                className="flex justify-end px-1"
              >
                <div
                  className={`relative max-w-[88%] rounded-xl rounded-tl-none bg-white px-3.5 py-2.5 text-[#111B21] shadow-xs transition-all sm:max-w-[72%] dark:bg-[#202C33] dark:text-[#E9EDEF] ${
                    isHighlighted ? 'ring-2 ring-[#00A884]' : ''
                  }`}
                >
                  <svg
                    viewBox="0 0 8 13"
                    className="pointer-events-none absolute -left-[7px] top-0 h-[13px] w-[8px] fill-white dark:fill-[#202C33]"
                    aria-hidden="true"
                  >
                    <path d="M1.533 3.568 8 12.193V1H2.812C1.042 1 .474 2.156 1.533 3.568z" />
                  </svg>
                  <div className="mb-1 text-xs font-extrabold text-[#008069] dark:text-[#00A884]">
                    الأدمن{msg.kind === 'transfer' ? ' · قرار نقل موظف' : ''}
                  </div>
                  <div className="whitespace-pre-line text-[14.5px] font-semibold leading-relaxed">
                    {msg.text}
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    {!msg.readByBranch ? (
                      <button
                        type="button"
                        onClick={() => handleAckAdminMessage(msg)}
                        className="flex min-h-[36px] items-center gap-1 rounded-full bg-[#008069] px-4 py-1 text-xs font-extrabold text-white hover:bg-[#016b58] dark:bg-[#00A884] dark:text-[#111B21]"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>تم الاطلاع</span>
                      </button>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-[#008069] dark:text-[#00A884]">
                        <Check className="h-3.5 w-3.5" />
                        <span>تم الاطلاع</span>
                      </span>
                    )}
                    <span className="font-mono-num text-[10px] text-[#667781] dark:text-[#8696A0]">
                      {msg.time}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Scroll to bottom button */}
        {showScrollBottom && (
          <button
            type="button"
            onClick={() => scrollToBottom(true)}
            aria-label="النزول لآخر رسالة"
            className="absolute bottom-3 left-3 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#54656F] shadow-lg ring-1 ring-black/10 dark:bg-[#202C33] dark:text-[#AEBAC1] dark:ring-white/10"
          >
            <ChevronsDown className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Auto Next-Shift Prompt after finishing Morning or Evening */}
      {nextShiftPrompt && (
        <div className="relative z-20 shrink-0 border-t border-[#E9EDEF] bg-[#E7FCE3] px-3 py-2.5 dark:border-[#222E35] dark:bg-[#182229] sm:px-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-extrabold text-[#111B21] dark:text-[#E9EDEF] sm:text-sm">
              <Check className="h-4 w-4 shrink-0 text-[#008069] dark:text-[#25D366]" />
              <span>
                تم إرسال {SHIFTS_AR[nextShiftPrompt === 'evening' ? 'morning' : 'evening']} بنجاح — تحب تبعت {SHIFTS_AR[nextShiftPrompt]} دلوقتي؟
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const target = nextShiftPrompt;
                  setNextShiftPrompt(null);
                  onChangeSession({ activeShift: target, branchScreen: 'submit' });
                }}
                className="min-h-[38px] rounded-full bg-[#008069] px-4 py-1 text-xs font-extrabold text-white hover:bg-[#016b58] dark:bg-[#00A884] dark:text-[#111B21]"
              >
                نعم، افتح {SHIFTS_AR[nextShiftPrompt]}
              </button>
              <button
                type="button"
                onClick={() => setNextShiftPrompt(null)}
                className="min-h-[38px] rounded-full px-3 py-1 text-xs font-bold text-[#54656F] hover:bg-black/5 dark:text-[#8696A0] dark:hover:bg-white/10"
              >
                لاحقاً
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Thumb Zone: 1-Tap Shift Buttons + Core Menu Strip + Authentic WhatsApp Composer */}
      <div className="relative z-20 shrink-0 border-t border-[#E9EDEF] bg-[#F0F2F5] px-2.5 pb-2.5 pt-2 dark:border-[#222E35] dark:bg-[#0B141A] sm:px-4">
        {/* Big Shift Action Buttons */}
        <div className="mb-2 flex items-center gap-2">
          <button
            id="registerTomorrowBtn_morning"
            type="button"
            onClick={() => {
              setNextShiftPrompt(null);
              onChangeSession({ activeShift: 'morning', branchScreen: 'submit' });
            }}
            className={`flex min-h-[46px] flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-extrabold transition-transform active:scale-[0.98] sm:text-sm ${
              morningSub
                ? 'border border-[#B8EBD0] bg-[#E7FCE3] text-[#008069] dark:border-[#00A884]/40 dark:bg-[#182229] dark:text-[#25D366]'
                : 'bg-[#008069] text-white shadow-xs hover:bg-[#016b58] dark:bg-[#00A884] dark:text-[#111B21] dark:hover:bg-[#06CF9C]'
            }`}
          >
            <Sun className="h-4 w-4 shrink-0" />
            <span className="truncate">
              {morningSub ? 'الصباحي (تم الإرسال · تعديل)' : `إرسال الصباحي (${plannedMorningCount})`}
            </span>
          </button>

          <button
            id="registerTomorrowBtn_evening"
            type="button"
            onClick={() => {
              setNextShiftPrompt(null);
              onChangeSession({ activeShift: 'evening', branchScreen: 'submit' });
            }}
            className={`flex min-h-[46px] flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-extrabold transition-transform active:scale-[0.98] sm:text-sm ${
              eveningSub
                ? 'border border-[#B8EBD0] bg-[#E7FCE3] text-[#008069] dark:border-[#00A884]/40 dark:bg-[#182229] dark:text-[#25D366]'
                : 'bg-[#008069] text-white shadow-xs hover:bg-[#016b58] dark:bg-[#00A884] dark:text-[#111B21] dark:hover:bg-[#06CF9C]'
            }`}
          >
            <Moon className="h-4 w-4 shrink-0" />
            <span className="truncate">
              {eveningSub ? 'المسائي (تم الإرسال · تعديل)' : `إرسال المسائي (${plannedEveningCount})`}
            </span>
          </button>

          {submittedForTomorrow.length > 0 && (
            <button
              type="button"
              onClick={() => setEmergencyOpen(true)}
              aria-label="بلاغ غياب طارئ"
              className="flex min-h-[46px] shrink-0 items-center justify-center gap-1 rounded-xl border border-rose-500/40 bg-rose-500/15 px-3 py-2 text-xs font-extrabold text-rose-600 hover:bg-rose-500/25 dark:text-rose-300"
            >
              <AlertTriangle className="h-4 w-4" />
              <span className="hidden sm:inline">غياب طارئ</span>
            </button>
          )}
        </div>

        {/* Direct 4-Action Bar (خطة الأسبوع · طاقم الفرع · إضافة موظف · الإشعارات) */}
        <div className="mb-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          <button
            id="branchActionPlannerBtn"
            type="button"
            onClick={onOpenPlanner}
            className="flex min-h-[42px] items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-white px-2 text-xs font-extrabold text-[#111B21] shadow-xs ring-1 ring-black/10 transition-colors hover:bg-[#E7FCE3] active:scale-[0.98] dark:bg-[#202C33] dark:text-[#E9EDEF] dark:ring-white/10 dark:hover:bg-[#2A3942]"
          >
            <CalendarDays className="h-4 w-4 shrink-0 text-[#008069] dark:text-[#00A884]" />
            <span className="truncate">خطة الأسبوع</span>
          </button>

          <button
            id="branchActionStaffBtn"
            type="button"
            onClick={() => {
              setAddStaffOpen(false);
              onChangeSession({ branchScreen: 'settings' });
            }}
            className="flex min-h-[42px] items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-white px-2 text-xs font-extrabold text-[#111B21] shadow-xs ring-1 ring-black/10 transition-colors hover:bg-[#E7FCE3] active:scale-[0.98] dark:bg-[#202C33] dark:text-[#E9EDEF] dark:ring-white/10 dark:hover:bg-[#2A3942]"
          >
            <Users className="h-4 w-4 shrink-0 text-[#008069] dark:text-[#00A884]" />
            <span className="truncate">طاقم الفرع</span>
          </button>

          <button
            id="branchActionAddEmpBtn"
            type="button"
            onClick={() => {
              setAddStaffOpen(true);
              onChangeSession({ branchScreen: 'settings' });
            }}
            className="flex min-h-[42px] items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-white px-2 text-xs font-extrabold text-[#111B21] shadow-xs ring-1 ring-black/10 transition-colors hover:bg-[#E7FCE3] active:scale-[0.98] dark:bg-[#202C33] dark:text-[#E9EDEF] dark:ring-white/10 dark:hover:bg-[#2A3942]"
          >
            <UserPlus className="h-4 w-4 shrink-0 text-[#008069] dark:text-[#00A884]" />
            <span className="truncate">إضافة موظف</span>
          </button>

          <button
            id="branchActionNotifBtn"
            type="button"
            onClick={onOpenNotifications}
            className="relative flex min-h-[42px] items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-white px-2 text-xs font-extrabold text-[#111B21] shadow-xs ring-1 ring-black/10 transition-colors hover:bg-[#E7FCE3] active:scale-[0.98] dark:bg-[#202C33] dark:text-[#E9EDEF] dark:ring-white/10 dark:hover:bg-[#2A3942]"
          >
            <Bell className="h-4 w-4 shrink-0 text-[#008069] dark:text-[#00A884]" />
            <span className="truncate">الإشعارات</span>
            {unreadNotifCount > 0 && (
              <span className="font-mono-num flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#25D366] px-1 text-[10px] font-extrabold text-[#111B21]">
                {unreadNotifCount}
              </span>
            )}
          </button>
        </div>

        {/* Authentic WhatsApp Composer */}
        {isRecording ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={cancelRecording}
              aria-label="إلغاء التسجيل"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-rose-500/15 text-rose-500"
            >
              <Trash2 className="h-5 w-5" />
            </button>
            <div className="flex h-12 flex-1 items-center justify-between rounded-full bg-white px-4 shadow-xs dark:bg-[#202C33]">
              <div className="flex items-center gap-2 text-xs font-bold text-rose-500">
                <Square className="h-3.5 w-3.5 fill-current" />
                <span>جاري تسجيل رسالة صوتية...</span>
              </div>
              <span className="font-mono-num text-sm font-extrabold tabular-nums">
                {formatTimer(recordingSec)}
              </span>
            </div>
            <button
              type="button"
              onClick={finishRecording}
              aria-label="إرسال الصوت"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#008069] text-white shadow-md dark:bg-[#00A884] dark:text-[#111B21]"
            >
              <WhatsAppSendIcon className="h-5 w-5" />
            </button>
          </div>
        ) : (
          <form onSubmit={handleSendTextMessage} className="flex items-center gap-2">
            <div className="flex min-h-[48px] flex-1 items-center gap-1 rounded-full bg-white pl-1.5 pr-4 shadow-xs dark:bg-[#202C33]">
              <input
                ref={chatInputRef}
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="مراسلة..."
                className="w-full flex-1 bg-transparent py-2.5 text-sm font-medium text-[#111B21] outline-none placeholder:text-[#667781] dark:text-[#E9EDEF] dark:placeholder:text-[#8696A0]"
              />
              <button
                type="button"
                onClick={startRecording}
                aria-label="تسجيل رسالة صوتية"
                title="تسجيل رسالة صوتية"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#54656F] transition-colors hover:bg-black/5 hover:text-[#008069] dark:text-[#8696A0] dark:hover:bg-white/10 dark:hover:text-[#00A884]"
              >
                <Mic className="h-5 w-5" />
              </button>
            </div>
            <button
              type="submit"
              aria-label="إرسال رسالة"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#008069] text-white shadow-md transition-transform active:scale-95 hover:bg-[#016b58] dark:bg-[#00A884] dark:text-[#111B21] dark:hover:bg-[#06CF9C]"
            >
              <WhatsAppSendIcon className="h-5 w-5" />
            </button>
          </form>
        )}
      </div>

      {/* ===================================================================== */}
      {/* INNOVATIVE 1-TAP SHIFT BOTTOM SHEET (Over Chat, No Context Loss!)     */}
      {/* ===================================================================== */}
      {branchScreen === 'submit' && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs sm:items-center sm:p-4"
          onClick={() => onChangeSession({ branchScreen: 'home' })}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="flex max-h-[90dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl bg-white text-[#111B21] shadow-2xl sm:rounded-3xl dark:bg-[#202C33] dark:text-[#E9EDEF]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile drag handle */}
            <div className="flex justify-center pt-3 sm:hidden">
              <div className="h-1.5 w-12 rounded-full bg-[#8696A0]/40" />
            </div>

            {/* Sheet Header */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/10 px-4 py-3.5 dark:border-white/10">
              <div className="flex items-center gap-2.5">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                    activeShift === 'morning'
                      ? 'bg-amber-500/15 text-amber-500'
                      : 'bg-[#008069]/15 text-[#008069] dark:bg-[#00A884]/20 dark:text-[#00A884]'
                  }`}
                >
                  {activeShift === 'morning' ? (
                    <Sun className="h-5 w-5" />
                  ) : (
                    <Moon className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <h2 className="text-base font-extrabold">
                    تحضير {SHIFT_FULL_AR[activeShift]}
                  </h2>
                  <p className="text-xs font-semibold text-[#54656F] dark:text-[#8696A0]">
                    غداً ({fmtDateAr(tomorrowIso)}) · {SHIFT_START_DESC[activeShift]}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex rounded-full bg-[#F0F2F5] p-0.5 dark:bg-[#111B21]">
                  {(['morning', 'evening'] as ShiftType[]).map((sh) => (
                    <button
                      key={sh}
                      type="button"
                      onClick={() => onChangeSession({ activeShift: sh })}
                      className={`min-h-[34px] rounded-full px-3 text-xs font-extrabold ${
                        activeShift === sh
                          ? 'bg-[#008069] text-white dark:bg-[#00A884] dark:text-[#111B21]'
                          : 'text-[#54656F] dark:text-[#8696A0]'
                      }`}
                    >
                      {SHIFTS_AR[sh]}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => onChangeSession({ branchScreen: 'home' })}
                  aria-label="إغلاق"
                  className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Live Compliance + Auto-Fill Strip */}
            <div
              id="compliancePreviewBox"
              className="flex flex-wrap items-center justify-between gap-2 border-b border-black/10 bg-[#F0F2F5] px-4 py-2.5 dark:border-white/10 dark:bg-[#111B21]"
            >
              <div className="text-xs font-extrabold">
                {liveCompliance.status === 'matched' ? (
                  <span className="flex items-center gap-1.5 text-[#008069] dark:text-[#00A884]">
                    <Check className="h-4 w-4" />
                    <span>مطابق لخطة الغد ({availCount} حضور)</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="h-4 w-4" />
                    <span>يوجد {liveCompliance.diffs.length} اختلاف عن خطة الغد</span>
                  </span>
                )}
              </div>

              <button
                id="autoFillFromPlanBtn"
                type="button"
                onClick={handleApplyPlanToDraft}
                className="flex min-h-[38px] items-center gap-1.5 rounded-full bg-[#008069]/12 px-3 py-1 text-xs font-extrabold text-[#008069] hover:bg-[#008069]/20 dark:bg-[#005C4B] dark:text-[#E9EDEF]"
              >
                <CalendarDays className="h-3.5 w-3.5" />
                <span>تعبئة حسب خطة الغد</span>
              </button>
            </div>

            {/* Checklist Rows */}
            <div className="wa-scroll flex-1 space-y-2.5 overflow-y-auto p-3.5">
              {draftRows.length === 0 ? (
                <div className="rounded-xl bg-[#F0F2F5] p-6 text-center text-sm text-[#54656F] dark:bg-[#111B21] dark:text-[#8696A0]">
                  لا يوجد موظفون مسجلون في هذه الوردية. أضفهم من «طاقم الفرع».
                </div>
              ) : (
                draftRows.map((row) => {
                  const planItem = tomorrowPlan.find((p) => p.emp.id === row.empId);
                  const isPlannedOff = planItem?.plannedShift === 'off';
                  const isBetween =
                    planItem?.plannedShift === 'between' || planItem?.emp.shift === 'between';

                  return (
                    <div
                      key={row.empId}
                      className="rounded-2xl border border-black/5 bg-[#F8FAFC] p-3.5 dark:border-white/10 dark:bg-[#111B21]"
                    >
                      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${
                              row.status === 'available'
                                ? 'bg-[#00A884] text-[#111B21]'
                                : 'bg-rose-500/20 text-rose-500'
                            }`}
                          >
                            {row.empName.slice(0, 1)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-base font-extrabold">{row.empName}</span>
                              {isBetween && (
                                <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
                                  · بتوين
                                </span>
                              )}
                            </div>
                            {planItem && (
                              <div className="text-xs font-semibold text-[#54656F] dark:text-[#8696A0]">
                                {isPlannedOff
                                  ? `بالخطة: ${planItem.reason}`
                                  : `بالخطة: ${SHIFTS_AR[activeShift]}`}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
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
                          className={`flex min-h-[46px] items-center justify-center gap-1.5 rounded-xl text-sm font-extrabold transition-colors ${
                            row.status === 'available'
                              ? 'bg-[#008069] text-white dark:bg-[#00A884] dark:text-[#111B21]'
                              : 'bg-white text-[#54656F] dark:bg-[#202C33] dark:text-[#8696A0]'
                          }`}
                        >
                          <Check className="h-4 w-4" />
                          <span>حاضر</span>
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
                          className={`flex min-h-[46px] items-center justify-center gap-1.5 rounded-xl text-sm font-extrabold transition-colors ${
                            row.status === 'unavailable'
                              ? 'bg-rose-600 text-white'
                              : 'bg-white text-[#54656F] dark:bg-[#202C33] dark:text-[#8696A0]'
                          }`}
                        >
                          <X className="h-4 w-4" />
                          <span>غائب</span>
                        </button>
                      </div>

                      {row.status === 'unavailable' && (
                        <div className="mt-2.5 border-t border-black/5 pt-2.5 dark:border-white/10">
                          <div className="mb-1.5 text-[11px] font-bold text-[#54656F] dark:text-[#8696A0]">
                            اختر السبب بلمسة:
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {UNAVAILABLE_REASONS.map((rs) => (
                              <button
                                key={rs}
                                type="button"
                                onClick={() =>
                                  setDraftRows((prev) =>
                                    prev.map((x) =>
                                      x.empId === row.empId ? { ...x, reason: rs } : x
                                    )
                                  )
                                }
                                className={`min-h-[34px] rounded-full px-3 py-1 text-xs font-extrabold ${
                                  row.reason === rs
                                    ? 'bg-rose-600 text-white'
                                    : 'bg-white text-[#3b4a54] ring-1 ring-black/10 dark:bg-[#202C33] dark:text-[#AEBAC1] dark:ring-white/10'
                                }`}
                              >
                                {rs}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Sticky Bottom Send CTA */}
            {draftRows.length > 0 && (
              <div className="border-t border-black/10 bg-white p-4 dark:border-white/10 dark:bg-[#202C33]">
                <div className="mb-2 flex justify-between text-xs font-extrabold">
                  <span className="text-[#008069] dark:text-[#00A884]">
                    حضور: {availCount}
                  </span>
                  <span className="text-rose-500">غير متاح: {unavailCount}</span>
                </div>
                <button
                  id="sendAvailabilityBtn"
                  type="button"
                  onClick={() => dispatchAvailabilitySubmission(activeShift, draftRows)}
                  className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-[#008069] py-3 text-base font-extrabold text-white shadow-md transition-transform active:scale-[0.98] hover:bg-[#016b58] dark:bg-[#00A884] dark:text-[#111B21] dark:hover:bg-[#06CF9C]"
                >
                  <WhatsAppSendIcon className="h-5 w-5" />
                  <span>إرسال في المحادثة الآن ({availCount} حضور)</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Emergency Absence Bottom Sheet */}
      {emergencyOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs sm:items-center sm:p-4"
          onClick={() => setEmergencyOpen(false)}
        >
          <div
            className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 text-[#111B21] shadow-2xl sm:rounded-3xl dark:bg-[#202C33] dark:text-[#E9EDEF]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between border-b border-black/10 pb-3 dark:border-white/10">
              <h3 className="text-base font-extrabold">بلاغ غياب طارئ للغد</h3>
              <button
                type="button"
                onClick={() => setEmergencyOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              {submittedForTomorrow.map(({ shift, rows }) => (
                <div key={shift}>
                  <div className="mb-2 flex items-center justify-between text-xs font-extrabold">
                    <span>{SHIFT_FULL_AR[shift]}</span>
                    <span className="text-[#008069] dark:text-[#00A884]">
                      متاح: {rows.filter((r) => !r.movedOut && r.status === 'available').length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {rows.map((r) => (
                      <div
                        key={r.empId}
                        className="rounded-xl border border-black/5 bg-[#F8FAFC] p-3 dark:border-white/10 dark:bg-[#111B21]"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <span
                              className={`text-sm font-bold ${
                                r.movedOut
                                  ? 'line-through opacity-50'
                                  : r.status === 'available'
                                  ? ''
                                  : 'opacity-65'
                              }`}
                            >
                              {r.empName}
                            </span>
                            {r.note && (
                              <p className="mt-0.5 text-xs text-amber-500">{r.note}</p>
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
                              className="min-h-[36px] rounded-full bg-rose-500/15 px-3 py-1 text-xs font-bold text-rose-600 dark:text-rose-300"
                            >
                              غياب طارئ
                            </button>
                          ) : (
                            <span className="text-xs font-bold text-rose-500">
                              {r.emergency ? 'طارئ: ' : 'غائب: '}
                              {r.reason || ''}
                            </span>
                          )}
                        </div>

                        {emergencyEmpId === r.empId &&
                          r.status === 'available' &&
                          !r.movedOut && (
                            <div className="mt-3 space-y-2 border-t border-black/10 pt-2.5 dark:border-white/10">
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  onClick={() => setEmergencyReason('with_permission')}
                                  className={`min-h-[40px] rounded-full py-2 text-xs font-extrabold ${
                                    emergencyReason === 'with_permission'
                                      ? 'bg-rose-600 text-white'
                                      : 'bg-white text-[#111B21] dark:bg-[#202C33] dark:text-[#E9EDEF]'
                                  }`}
                                >
                                  غياب بإذن
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEmergencyReason('without_permission')}
                                  className={`min-h-[40px] rounded-full py-2 text-xs font-extrabold ${
                                    emergencyReason === 'without_permission'
                                      ? 'bg-rose-600 text-white'
                                      : 'bg-white text-[#111B21] dark:bg-[#202C33] dark:text-[#E9EDEF]'
                                  }`}
                                >
                                  غياب بدون إذن
                                </button>
                              </div>
                              <button
                                type="button"
                                disabled={!emergencyReason}
                                onClick={() => handleConfirmEmergency(shift, r.empId)}
                                className="min-h-[44px] w-full rounded-full bg-rose-600 py-2 text-xs font-extrabold text-white disabled:opacity-45"
                              >
                                إرسال البلاغ في المحادثة
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
};
