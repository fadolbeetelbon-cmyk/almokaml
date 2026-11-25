import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Building2,
  CalendarDays,
  CheckCheck,
  CheckCircle2,
  Compass,
  Eye,
  EyeOff,
  LogOut,
  MessageCircle,
  Moon,
  RotateCcw,
  Settings,
  Sun,
  Users,
} from 'lucide-react';
import { AdminControlView } from './components/AdminControlView';
import { BranchAvailabilityView } from './components/BranchAvailabilityView';
import { InteractiveTour, TourStep } from './components/InteractiveTour';
import { OnboardingModal } from './components/OnboardingModal';
import { PlannerModule, PlannerTab } from './components/PlannerModule';
import {
  addDaysIso,
  BRANCH_LARGE_FONT_KEY,
  BRANCH_SESSION_KEY,
  BRANCH_THEME_KEY,
  createSeedState,
  fmtDateAr,
  getCairoToday,
  loadState,
  normalizeDigits,
  saveState,
  SHIFTS_AR,
} from './data/seed';
import {
  AppState,
  BranchThemeMode,
  ComplianceReport,
  NotificationItem,
  SessionState,
  ShiftType,
} from './types';

export default function App() {
  const tomorrowIso = useMemo(() => addDaysIso(getCairoToday().iso, 1), []);
  const [state, setState] = useState<AppState>(() => loadState());
  const [branchTheme, setBranchTheme] = useState<BranchThemeMode>(() => {
    try {
      return localStorage.getItem(BRANCH_THEME_KEY) === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });
  const [largeFont, setLargeFont] = useState<boolean>(() => {
    try {
      return localStorage.getItem(BRANCH_LARGE_FONT_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [showOnboarding, setShowOnboarding] = useState<boolean>(() => {
    try {
      return !localStorage.getItem(BRANCH_SESSION_KEY);
    } catch {
      return true;
    }
  });
  const [pinInput, setPinInput] = useState<string>('');
  const [showPin, setShowPin] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string>('');
  const [toast, setToast] = useState<string | null>(null);
  const [notifOpen, setNotifOpen] = useState<boolean>(false);
  const [tourOpen, setTourOpen] = useState<boolean>(false);
  const [selectedCompliance, setSelectedCompliance] = useState<ComplianceReport | null>(null);
  const [mobileBranchShowList, setMobileBranchShowList] = useState<boolean>(false);
  const [focusEvent, setFocusEvent] = useState<{
    branchId: string;
    shift: ShiftType;
    messageId?: string;
    complianceReport?: ComplianceReport;
    nonce: number;
  } | null>(null);
  const [plannerTabReq, setPlannerTabReq] = useState<{ tab: PlannerTab; nonce: number } | null>(
    null
  );

  // Auto-restore saved Branch Manager session directly into WhatsApp chat
  const [session, setSession] = useState<SessionState>(() => {
    try {
      const savedRaw = localStorage.getItem(BRANCH_SESSION_KEY);
      if (savedRaw) {
        const parsed = JSON.parse(savedRaw) as { branchId?: string };
        const matchedBranch = state.branches.find((b) => b.id === parsed?.branchId);
        if (matchedBranch) {
          return {
            role: 'branch',
            branchId: matchedBranch.id,
            workspace: 'availability',
            branchScreen: 'home',
            activeShift: 'morning',
            adminScreen: 'control',
            adminShift: 'morning',
          };
        }
      }
    } catch {
      // ignore storage errors
    }
    return {
      role: null,
      branchId: null,
      workspace: 'availability',
      branchScreen: 'home',
      activeShift: 'morning',
      adminScreen: 'control',
      adminShift: 'morning',
    };
  });

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    try {
      localStorage.setItem(BRANCH_THEME_KEY, branchTheme);
    } catch {
      // ignore storage errors
    }
  }, [branchTheme]);

  useEffect(() => {
    try {
      localStorage.setItem(BRANCH_LARGE_FONT_KEY, largeFont ? '1' : '0');
    } catch {
      // ignore storage errors
    }
  }, [largeFont]);

  // WhatsApp Dark Mode default for Login & Branch Manager; keep Central Admin in crisp Light Mode
  useEffect(() => {
    const shouldUseDark = session.role !== 'central' && branchTheme === 'dark';
    document.documentElement.classList.toggle('dark', shouldUseDark);
  }, [session.role, branchTheme]);

  // Large Font mode for senior Branch Managers
  useEffect(() => {
    document.documentElement.style.fontSize =
      session.role === 'branch' && largeFont ? '18px' : '';
    return () => {
      document.documentElement.style.fontSize = '';
    };
  }, [session.role, largeFont]);

  const toggleBranchTheme = () => {
    setBranchTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const toggleLargeFont = () => {
    setLargeFont((prev) => {
      const next = !prev;
      setToast(next ? 'تم تفعيل الخط الكبير' : 'تمت العودة للخط العادي');
      return next;
    });
  };

  const notify = (msg: string) => {
    setToast(msg);
  };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  const updateState = (updater: (prev: AppState) => AppState) => {
    setState((prev) => updater(prev));
  };

  const changeSession = (patch: Partial<SessionState>) => {
    setSession((prev) => ({ ...prev, ...patch }));
  };

  const handleLogin = (rawPin?: string) => {
    const val = normalizeDigits(rawPin ?? pinInput);
    if (!val) {
      setLoginError('أدخل رمز الدخول السري');
      return;
    }
    if (val === state.adminPin) {
      setLoginError('');
      setPinInput('');
      setSession((prev) => ({
        ...prev,
        role: 'central',
        branchId: state.branches[0].id,
        workspace: 'availability',
        adminScreen: 'control',
      }));
      return;
    }
    const br = state.branches.find((b) => b.pin === val);
    if (br) {
      setLoginError('');
      setPinInput('');
      setMobileBranchShowList(false);
      try {
        localStorage.setItem(BRANCH_SESSION_KEY, JSON.stringify({ branchId: br.id }));
      } catch {
        // ignore storage errors
      }
      setSession((prev) => ({
        ...prev,
        role: 'branch',
        branchId: br.id,
        workspace: 'availability',
        branchScreen: 'home',
      }));
      return;
    }
    setLoginError('الرمز غير صحيح — تأكد من رمز الأدمن أو رمز الفرع');
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem(BRANCH_SESSION_KEY);
    } catch {
      // ignore storage errors
    }
    setSession((prev) => ({
      ...prev,
      role: null,
      branchId: null,
      workspace: 'availability',
      branchScreen: 'home',
      adminScreen: 'control',
    }));
    setMobileBranchShowList(false);
    setSelectedCompliance(null);
    setNotifOpen(false);
  };

  const startInteractiveTour = () => {
    setShowOnboarding(false);
    setNotifOpen(false);
    setSelectedCompliance(null);
    setMobileBranchShowList(false);
    setSession((prev) => ({
      ...prev,
      role: null,
      branchId: null,
      workspace: 'availability',
      branchScreen: 'home',
      adminScreen: 'control',
    }));
    setTourOpen(true);
  };

  const currentBranch =
    state.branches.find((b) => b.id === session.branchId) || state.branches[0];

  const myNotifs = useMemo(() => {
    if (session.role === 'central') {
      return state.notifications.filter((n) => n.recipientRole === 'central');
    }
    if (session.role === 'branch') {
      return state.notifications.filter(
        (n) => n.recipientRole === 'branch' && n.recipientBranchId === session.branchId
      );
    }
    return [];
  }, [state.notifications, session.role, session.branchId]);

  const unreadCount = useMemo(() => myNotifs.filter((n) => !n.read).length, [myNotifs]);

  const handleNotificationClick = (n: NotificationItem) => {
    updateState((prev) => ({
      ...prev,
      notifications: prev.notifications.map((x) =>
        x.id === n.id ? { ...x, read: true } : x
      ),
    }));
    setNotifOpen(false);
    setSelectedCompliance(null);

    const targetBranchId = n.branchId || n.recipientBranchId || currentBranch.id;

    if (session.role === 'central') {
      setSession((prev) => ({
        ...prev,
        branchId: targetBranchId,
        workspace: 'availability',
        adminScreen: 'control',
        adminShift: n.shift,
      }));
      setFocusEvent({
        branchId: targetBranchId,
        shift: n.shift,
        messageId: n.messageId,
        complianceReport: n.complianceReport,
        nonce: Date.now(),
      });
    } else if (session.role === 'branch') {
      setMobileBranchShowList(false);
      setSession((prev) => ({
        ...prev,
        workspace: 'availability',
        branchScreen: 'home',
        activeShift: n.shift,
      }));
      setFocusEvent({
        branchId: targetBranchId,
        shift: n.shift,
        messageId: n.messageId,
        nonce: Date.now(),
      });
    }
  };

  // Sequential, Mandatory-Click Spotlight Interactive Tour
  const tourSteps: TourStep[] = useMemo(
    () => [
      {
        id: 't_login',
        title: 'السلام عليكم أ/ همام',
        text: 'أهلاً بحضرتك في جولة سريعة لتجربة Roast Shift. كل فرع يدخل برمزه الخاص مثل الواتساب تماماً.\nاضغط الآن على زر «فرع الصنادلي» المضيء لتبدأ معاينة خطوات الفرع بنفسك.',
        targetId: 'tourQuickBranch_b1',
        requireTargetClick: true,
        onEnter: () => {
          setShowOnboarding(false);
          setNotifOpen(false);
          setSession((prev) => ({
            ...prev,
            role: null,
            branchId: null,
            branchScreen: 'home',
            adminScreen: 'control',
          }));
        },
      },
      {
        id: 't_open_planner',
        title: '1. الدخول إلى خطة الأسبوع',
        text: 'نبدأ أولاً باستعراض خطة الفرع الأسبوعية وجدول الإجازات قبل إرسال الحضور.\nاضغط الآن على زر «خطة الأسبوع» المضيء أسفل المحادثة.',
        targetId: 'branchActionPlannerBtn',
        requireTargetClick: true,
        onEnter: () => {
          setNotifOpen(false);
          setMobileBranchShowList(false);
          setSession((prev) => ({
            ...prev,
            role: 'branch',
            branchId: 'b1',
            workspace: 'availability',
            branchScreen: 'home',
            activeShift: 'morning',
          }));
        },
      },
      {
        id: 't_planner_today',
        title: '2. لوحة اليوم الأفقية على الهاتف',
        text: 'تظهر ورديتا الصباحي والمسائي جنباً إلى جنب أفقياً حتى على شاشة الهاتف بمواعيدهما الثابتة والبتوين، مع شريط الأيام السبعة الذي يتغير أوتوماتيك كل يوم حسب التقويم.\nاضغط الآن على زر «الإجازات» المضيء في الأعلى لمعاينة إعدادات الفريق.',
        targetId: 'plannerTab_team',
        requireTargetClick: true,
        onEnter: () => {
          setMobileBranchShowList(false);
          setSession((prev) => ({
            ...prev,
            role: 'branch',
            branchId: 'b1',
            workspace: 'planner',
          }));
          setPlannerTabReq((r) => ({ tab: 'today', nonce: (r?.nonce || 0) + 1 }));
        },
      },
      {
        id: 't_planner_team',
        title: '3. الموظفون والإجازات بالساعة الدائرية',
        text: 'عند إضافة موظف يختار الفرع الراحة الأسبوعية أو الإجازة الشهرية المتكررة (مثل يوم 5 كل شهر لمدة يومين) عبر الساعة الدائرية بكل سهولة.\nاضغط الآن على «المحادثة» المضيئة للرجوع إلى شات التوفر.',
        targetId: 'navAvailabilityTab',
        fallbackTargetId: 'navAvailabilityTabMobile',
        requireTargetClick: true,
        onEnter: () => {
          setMobileBranchShowList(false);
          setSession((prev) => ({
            ...prev,
            role: 'branch',
            branchId: 'b1',
            workspace: 'planner',
          }));
          setPlannerTabReq((r) => ({ tab: 'team', nonce: (r?.nonce || 0) + 1 }));
        },
      },
      {
        id: 't_branch_home',
        title: '4. واجهة الفرع — مباشرة وبدون زحمة',
        text: 'هنا يظهر زرا الصباحي والمسائي وكتابة أو تسجيل رسالة صوتية، مع خيارات خطة الأسبوع وطاقم الفرع وإضافة موظف والإشعارات في متناول اليد، ودون إظهار أي أرقام عجز أو فائض.\nاضغط الآن على زر «إرسال الصباحي» المضيء لفتح قائمة الغد.',
        targetId: 'registerTomorrowBtn_morning',
        requireTargetClick: true,
        onEnter: () => {
          setMobileBranchShowList(false);
          setSession((prev) => ({
            ...prev,
            role: 'branch',
            branchId: 'b1',
            workspace: 'availability',
            branchScreen: 'home',
            activeShift: 'morning',
          }));
        },
      },
      {
        id: 't_submit_screen',
        title: '5. تعبئة تلقائية وكشف أي تعديل لاحق',
        text: 'القائمة مضبوطة تلقائياً حسب خطة الغد، وإذا عدّل الفرع أي اسم لاحقاً في نفس اليوم يصلك تنبيه باسم الموظف المتغير.\nاضغط الآن على زر الإرسال المضيء لننتقل مباشرة إلى شاشة الأدمن.',
        targetId: 'sendAvailabilityBtn',
        requireTargetClick: true,
        onEnter: () => {
          setMobileBranchShowList(false);
          setSession((prev) => ({
            ...prev,
            role: 'branch',
            branchId: 'b1',
            workspace: 'availability',
            branchScreen: 'submit',
            activeShift: 'morning',
          }));
        },
        onNext: () => {
          setSession((prev) => ({
            ...prev,
            role: 'central',
            branchId: 'b1',
            workspace: 'availability',
            adminScreen: 'control',
            adminShift: 'morning',
          }));
        },
      },
      {
        id: 't_admin_shifts',
        title: '6. شاشة الأدمن — زرا الصباحي والمسائي',
        text: 'واجهة واضحة للمستعجلين: تظهر حالة الفروع بالألوان (أحمر عجز، أصفر فائض، أخضر مستقر) مع زرين كبيرين للصباحي والمسائي.\nاضغط الآن على زر «مسائي» المضيء لتجربة التبديل بين الورديتين.',
        targetId: 'adminShiftBtn_evening',
        requireTargetClick: true,
        onEnter: () => {
          setNotifOpen(false);
          setSession((prev) => ({
            ...prev,
            role: 'central',
            branchId: 'b1',
            workspace: 'availability',
            adminScreen: 'control',
            adminShift: 'morning',
          }));
        },
      },
      {
        id: 't_admin_branch_card',
        title: '7. فتح محادثة الفرع ونقل الموظفين',
        text: 'بالضغط على أي فرع تفتح محادثته وتستطيع مراجعة خطته للقراءة فقط، أو عمل نقل فوري لموظف من فرع فائض إلى فرع عجز، أو تأكيد الاطلاع.\nاضغط الآن على بطاقة «فرع الصنادلي» المضيئة لفتح المحادثة.',
        targetId: 'adminBranchCard_b1',
        requireTargetClick: true,
        onEnter: () => {
          setNotifOpen(false);
          setSession((prev) => ({
            ...prev,
            role: 'central',
            branchId: 'b1',
            workspace: 'availability',
            adminScreen: 'control',
          }));
        },
      },
      {
        id: 't_admin_notif',
        title: '8. الإشعار يفتح الحدث نفسه مباشرة',
        text: 'أي إرسال أو تعديل جديد يصل هنا فوراً؛ والضغط على الإشعار يدخلك إلى محادثة الفرع والرسالة المقصودة مباشرة.\nاضغط الآن على جرس «الإشعارات» المضيء في الأعلى.',
        targetId: 'notifBellBtn',
        requireTargetClick: true,
        onEnter: () => {
          setNotifOpen(false);
          setSession((prev) => ({
            ...prev,
            role: 'central',
            branchId: 'b1',
            workspace: 'availability',
            adminScreen: 'control',
          }));
        },
      },
      {
        id: 't_admin_notif_close',
        title: '9. معاينة التنبيهات الحية',
        text: 'تظهر هنا التنبيهات مرتبة زمنياً، وبمجرد الضغط على أي تنبيه تنتقل تلقائياً إلى الرسالة نفسها في محادثة الفرع.\nاضغط على زر «إغلاق» المضيء لإتمام الجولة.',
        targetId: 'notifCloseBtn',
        requireTargetClick: true,
        onEnter: () => {
          setNotifOpen(true);
        },
      },
      {
        id: 't_final',
        title: 'ختام الجولة — تشغيل يومي أكثر وضوحاً وهدوءاً',
        text: 'بهذه الخطوات السريعة تكتمل دورة العمل اليومية بين الفروع والأدمن: إرسال واضح من الفرع، متابعة لونية فورية بلا عناء، وتنبيه مباشر عند أي تغيير في اللحظة نفسها، مع تحديث الأيام والتواريخ أوتوماتيك كل يوم.\n\nحرصنا على أن تكون هذه الجولة عملية وبسيطة لتخرج بأفضل صورة تليق بطريقة عملكم وتوفر الجهد والوقت كل يوم. يمكنك الآن استخدام النظام بحرية كاملة برمز الأدمن (0000) أو أي فرع (12341–12348).',
        isFinal: true,
        onEnter: () => {
          setNotifOpen(false);
        },
      },
    ],
    []
  );

  // Branch sidebar / chats summary
  const branchUnreadFromAdmin = useMemo(() => {
    if (session.role !== 'branch') return 0;
    return state.messages.filter(
      (m) => m.branchId === currentBranch.id && m.sender === 'admin' && !m.readByBranch
    ).length;
  }, [state.messages, session.role, currentBranch.id]);

  const branchLastMessage = useMemo(() => {
    if (session.role !== 'branch') return null;
    const list = state.messages.filter((m) => m.branchId === currentBranch.id);
    return list.length > 0 ? list[list.length - 1] : null;
  }, [state.messages, session.role, currentBranch.id]);

  const activeStaffCount = useMemo(
    () => currentBranch.emps.filter((e) => !e.suspended).length,
    [currentBranch.emps]
  );

  // Shared Branch Chats List Items (Desktop Sidebar & Mobile WhatsApp Home)
  const renderBranchChatListItems = (isMobileList: boolean) => {
    const isChatActive =
      session.workspace === 'availability' && session.branchScreen !== 'settings';
    const isPlannerActive = session.workspace === 'planner';
    const isStaffActive =
      session.workspace === 'availability' && session.branchScreen === 'settings';

    return (
      <div className="divide-y divide-black/5 dark:divide-white/5">
        <button
          id={isMobileList ? undefined : 'navAvailabilityTab'}
          type="button"
          onClick={() => {
            setMobileBranchShowList(false);
            changeSession({ workspace: 'availability', branchScreen: 'home' });
          }}
          className={`flex min-h-[72px] w-full items-center gap-3 px-4 py-3 text-right transition-colors ${
            isChatActive && !isMobileList
              ? 'bg-[#F0F2F5] dark:bg-[#2A3942]'
              : 'hover:bg-black/[0.03] dark:hover:bg-[#202C33]'
          }`}
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#008069] text-white dark:bg-[#00A884] dark:text-[#111B21]">
            <Building2 className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[15px] font-extrabold text-[#111B21] dark:text-[#E9EDEF]">
                الأدمن
              </span>
              <span className="font-mono-num text-[11px] font-semibold text-[#667781] dark:text-[#8696A0]">
                {branchLastMessage?.time || 'الآن'}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between gap-2">
              <span className="truncate text-xs font-medium text-[#54656F] dark:text-[#8696A0]">
                {branchLastMessage
                  ? branchLastMessage.text.split('\n')[0]
                  : 'إرسال طاقم الصباحي والمسائي للغد'}
              </span>
              {branchUnreadFromAdmin > 0 ? (
                <span className="font-mono-num flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#25D366] px-1.5 text-[11px] font-extrabold text-[#111B21]">
                  {branchUnreadFromAdmin}
                </span>
              ) : branchLastMessage?.sender === 'branch' ? (
                <CheckCheck
                  className={`h-4 w-4 shrink-0 ${
                    branchLastMessage.readByAdmin
                      ? 'text-[#53BDEB]'
                      : 'text-[#667781] dark:text-[#8696A0]'
                  }`}
                />
              ) : null}
            </div>
          </div>
        </button>

        <button
          id={isMobileList ? undefined : 'navPlannerTab'}
          type="button"
          onClick={() => {
            setMobileBranchShowList(false);
            changeSession({ workspace: 'planner' });
            setPlannerTabReq((r) => ({ tab: 'today', nonce: (r?.nonce || 0) + 1 }));
          }}
          className={`flex min-h-[72px] w-full items-center gap-3 px-4 py-3 text-right transition-colors ${
            isPlannerActive && !isMobileList
              ? 'bg-[#F0F2F5] dark:bg-[#2A3942]'
              : 'hover:bg-black/[0.03] dark:hover:bg-[#202C33]'
          }`}
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#e7fce3] text-[#008069] dark:bg-[#005C4B] dark:text-[#E9EDEF]">
            <CalendarDays className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-extrabold text-[#111B21] dark:text-[#E9EDEF]">
              خطة الأسبوع
            </div>
            <div className="mt-1 truncate text-xs font-medium text-[#54656F] dark:text-[#8696A0]">
              جدول الأيام السبعة والإجازات المجدولة
            </div>
          </div>
        </button>

        <button
          id={isMobileList ? undefined : 'navSettingsTab'}
          type="button"
          onClick={() => {
            setMobileBranchShowList(false);
            changeSession({ workspace: 'availability', branchScreen: 'settings' });
          }}
          className={`flex min-h-[72px] w-full items-center gap-3 px-4 py-3 text-right transition-colors ${
            isStaffActive && !isMobileList
              ? 'bg-[#F0F2F5] dark:bg-[#2A3942]'
              : 'hover:bg-black/[0.03] dark:hover:bg-[#202C33]'
          }`}
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
            <Users className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-extrabold text-[#111B21] dark:text-[#E9EDEF]">
              طاقم الفرع
            </div>
            <div className="mt-1 truncate text-xs font-medium text-[#54656F] dark:text-[#8696A0]">
              {activeStaffCount} موظف مسجل · الإجازات الأسبوعية والشهرية
            </div>
          </div>
        </button>
      </div>
    );
  };

  // Mobile WhatsApp Bottom Tab Bar (for Chats List Home, Planner, and Staff Contacts)
  const renderBranchMobileBottomTabs = () => {
    const isChatTab =
      !mobileBranchShowList &&
      session.workspace === 'availability' &&
      session.branchScreen !== 'settings';
    const isPlannerTab = !mobileBranchShowList && session.workspace === 'planner';
    const isStaffTab =
      !mobileBranchShowList &&
      session.workspace === 'availability' &&
      session.branchScreen === 'settings';

    return (
      <nav className="grid h-[62px] shrink-0 grid-cols-3 border-t border-black/10 bg-white dark:border-white/10 dark:bg-[#202C33] lg:hidden">
        <button
          id="navAvailabilityTabMobile"
          type="button"
          onClick={() => {
            setMobileBranchShowList(false);
            changeSession({ workspace: 'availability', branchScreen: 'home' });
          }}
          className={`relative flex flex-col items-center justify-center gap-1 text-[11px] font-extrabold ${
            isChatTab
              ? 'text-[#008069] dark:text-[#00A884]'
              : 'text-[#54656F] dark:text-[#8696A0]'
          }`}
        >
          <div
            className={`flex h-7 w-12 items-center justify-center rounded-full ${
              isChatTab ? 'bg-[#D9FDD3] dark:bg-[#005C4B]' : ''
            }`}
          >
            <MessageCircle className="h-5 w-5" />
          </div>
          <span>المحادثة</span>
          {branchUnreadFromAdmin > 0 && (
            <span className="font-mono-num absolute left-6 top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#25D366] px-1 text-[10px] font-extrabold text-[#111B21]">
              {branchUnreadFromAdmin}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setMobileBranchShowList(false);
            changeSession({ workspace: 'planner' });
            setPlannerTabReq((r) => ({ tab: 'today', nonce: (r?.nonce || 0) + 1 }));
          }}
          className={`flex flex-col items-center justify-center gap-1 text-[11px] font-extrabold ${
            isPlannerTab
              ? 'text-[#008069] dark:text-[#00A884]'
              : 'text-[#54656F] dark:text-[#8696A0]'
          }`}
        >
          <div
            className={`flex h-7 w-12 items-center justify-center rounded-full ${
              isPlannerTab ? 'bg-[#D9FDD3] dark:bg-[#005C4B]' : ''
            }`}
          >
            <CalendarDays className="h-5 w-5" />
          </div>
          <span>خطة الأسبوع</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setMobileBranchShowList(false);
            changeSession({ workspace: 'availability', branchScreen: 'settings' });
          }}
          className={`flex flex-col items-center justify-center gap-1 text-[11px] font-extrabold ${
            isStaffTab
              ? 'text-[#008069] dark:text-[#00A884]'
              : 'text-[#54656F] dark:text-[#8696A0]'
          }`}
        >
          <div
            className={`flex h-7 w-12 items-center justify-center rounded-full ${
              isStaffTab ? 'bg-[#D9FDD3] dark:bg-[#005C4B]' : ''
            }`}
          >
            <Users className="h-5 w-5" />
          </div>
          <span>الطاقم</span>
        </button>
      </nav>
    );
  };

  return (
    <>
      {showOnboarding ? (
        <OnboardingModal
          onSkip={() => setShowOnboarding(false)}
          onStartTour={startInteractiveTour}
          onQuickLogin={(pin) => {
            setShowOnboarding(false);
            handleLogin(pin);
          }}
        />
      ) : !session.role ? (
        /* WhatsApp-Styled Login Screen (Dark Mode Default with 1-Tap Toggle) */
        <div className="wa-chat-bg flex min-h-[100dvh] flex-col items-center justify-center px-4 py-8">
          <div
            id="loginCard"
            className="w-full max-w-md overflow-hidden rounded-2xl border border-[#d1d7db] bg-white shadow-xl dark:border-white/10 dark:bg-[#202C33]"
          >
            <div className="flex items-center justify-between gap-3 bg-[#008069] px-5 py-4 text-white dark:bg-[#111B21]">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 dark:bg-[#00A884] dark:text-[#111B21]">
                  <MessageCircle className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-lg font-extrabold">Roast Shift · واتساب الشفتات</h1>
                  <p className="text-xs text-white/85 dark:text-[#8696A0]">
                    أدخل رمز الأدمن ({state.adminPin}) أو رمز فرعك للفتح
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={toggleBranchTheme}
                aria-label={branchTheme === 'dark' ? 'تبديل للوضع النهاري' : 'تبديل للوضع الليلي'}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"
              >
                {branchTheme === 'dark' ? (
                  <Sun className="h-5 w-5 text-amber-300" />
                ) : (
                  <Moon className="h-5 w-5" />
                )}
              </button>
            </div>

            <div className="p-6">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleLogin();
                }}
              >
                <div className="relative mb-4">
                  <input
                    type={showPin ? 'text' : 'password'}
                    inputMode="numeric"
                    value={pinInput}
                    onChange={(e) => {
                      if (loginError) setLoginError('');
                      setPinInput(normalizeDigits(e.target.value));
                    }}
                    placeholder="••••"
                    dir="ltr"
                    className="font-mono-num w-full rounded-xl border-2 border-[#d1d7db] bg-[#f8fafc] py-3 pl-11 pr-11 text-center text-2xl font-bold tracking-[0.4em] text-[#111b21] outline-none focus:border-[#008069] dark:border-white/10 dark:bg-[#111B21] dark:text-[#E9EDEF] dark:focus:border-[#00A884]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin((v) => !v)}
                    aria-label={showPin ? 'إخفاء الرمز' : 'إظهار الرمز'}
                    className="absolute left-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#667781] hover:text-[#111b21] dark:text-[#8696A0] dark:hover:text-[#E9EDEF]"
                  >
                    {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                <div className="mb-4 grid grid-cols-3 gap-2" dir="ltr">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'مسح', '0', '←'].map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => {
                        if (loginError) setLoginError('');
                        if (k === 'مسح') setPinInput('');
                        else if (k === '←') setPinInput((p) => p.slice(0, -1));
                        else setPinInput((p) => p + k);
                      }}
                      className="font-mono-num min-h-[48px] rounded-xl border border-[#e9edef] bg-[#f8fafc] py-2.5 text-base font-bold text-[#111b21] hover:bg-[#f0f2f5] active:scale-95 dark:border-white/10 dark:bg-[#111B21] dark:text-[#E9EDEF] dark:hover:bg-[#2A3942]"
                    >
                      {k}
                    </button>
                  ))}
                </div>

                {loginError && (
                  <div className="mb-3 text-center text-xs font-bold text-rose-500">
                    {loginError}
                  </div>
                )}

                <button
                  type="submit"
                  className="min-h-[50px] w-full rounded-full bg-[#008069] py-3 text-sm font-extrabold text-white shadow-sm hover:bg-[#016b58] dark:bg-[#00A884] dark:text-[#111B21] dark:hover:bg-[#06CF9C]"
                >
                  فتح المحادثات
                </button>
              </form>

              {/* Quick Demo Strip */}
              <div className="mt-6 border-t border-[#e9edef] pt-4 dark:border-white/10">
                <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={startInteractiveTour}
                    className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#25D366] px-3 py-2 text-xs font-extrabold text-[#111B21] shadow-xs hover:bg-[#1fc45b]"
                  >
                    <Compass className="h-4 w-4" />
                    <span>بدء الجولة التعليمية</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowOnboarding(true)}
                    className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[#008069] bg-[#e7fce3] px-3 py-2 text-xs font-extrabold text-[#006e5a] hover:bg-[#d9fdd3] dark:border-[#00A884]/40 dark:bg-[#005C4B] dark:text-[#E9EDEF] dark:hover:bg-[#017561]"
                  >
                    <Compass className="h-4 w-4 text-[#008069] dark:text-[#00A884]" />
                    <span>الدليل التعريفي</span>
                  </button>
                </div>

                <div className="mb-2 flex items-center justify-between text-xs font-bold text-[#54656f] dark:text-[#8696A0]">
                  <span>دخول سريع للتجربة:</span>
                </div>

                <button
                  type="button"
                  onClick={() => handleLogin(state.adminPin)}
                  className="mb-2 min-h-[42px] w-full rounded-xl border border-[#86efac] bg-[#e7fce3] px-3 py-2 text-xs font-extrabold text-[#006e5a] hover:bg-[#d9fdd3] dark:border-[#00A884]/40 dark:bg-[#111B21] dark:text-[#00A884] dark:hover:bg-[#202C33]"
                >
                  الأدمن — واتساب الفروع ({state.adminPin})
                </button>

                <div className="grid grid-cols-2 gap-1.5">
                  {state.branches.map((b) => (
                    <button
                      key={b.id}
                      id={b.id === 'b1' ? 'tourQuickBranch_b1' : undefined}
                      type="button"
                      onClick={() => handleLogin(b.pin)}
                      className="min-h-[40px] rounded-xl border border-[#e9edef] bg-[#f8fafc] px-2.5 py-1.5 text-right text-xs font-bold text-[#111b21] hover:bg-[#f0f2f5] dark:border-white/10 dark:bg-[#111B21] dark:text-[#E9EDEF] dark:hover:bg-[#2A3942]"
                    >
                      {b.name}{' '}
                      <span className="font-mono-num text-[#667781] dark:text-[#8696A0]">
                        ({b.pin})
                      </span>
                    </button>
                  ))}
                </div>

                <div className="mt-3 flex items-center justify-end text-[11px] text-[#667781] dark:text-[#8696A0]">
                  <button
                    type="button"
                    onClick={() => {
                      const fresh = createSeedState();
                      setState(fresh);
                      notify('تمت إعادة تعيين المحادثات التجريبية');
                    }}
                    className="flex items-center gap-1 hover:text-rose-500"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>تصفير التجربة</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : session.role === 'branch' ? (
        /* =================================================================== */
        /* BRANCH MANAGER: FULL-BLEED WHATSAPP SHELL (Dark Default + Toggle)   */
        /* =================================================================== */
        <div className="h-[100dvh] w-full overflow-hidden bg-[#EFEAE2] text-[#111B21] dark:bg-[#0B141A] dark:text-[#E9EDEF]">
          <div className="grid h-full w-full lg:grid-cols-[340px_1fr]">
            {/* Desktop WhatsApp Web Sidebar */}
            <aside className="hidden h-full flex-col border-l border-black/10 bg-white dark:border-white/10 dark:bg-[#111B21] lg:flex">
              <header className="flex h-[56px] shrink-0 items-center justify-between gap-2 bg-[#008069] px-3.5 text-white dark:bg-[#202C33]">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#00A884] text-[#111B21]">
                    <MessageCircle className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-extrabold">
                      فرع {currentBranch.name}
                    </div>
                    <div className="truncate text-[11px] text-white/80 dark:text-[#8696A0]">
                      واتساب الشفتات
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => setNotifOpen(true)}
                    aria-label="الإشعارات"
                    className="relative flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/10"
                  >
                    <Bell className="h-4 w-4" />
                    {unreadCount > 0 && (
                      <span className="font-mono-num absolute left-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#25D366] px-1 text-[10px] font-extrabold text-[#111B21]">
                        {unreadCount}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={toggleBranchTheme}
                    aria-label={branchTheme === 'dark' ? 'الوضع النهاري' : 'الوضع الليلي'}
                    className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/10"
                  >
                    {branchTheme === 'dark' ? (
                      <Sun className="h-4 w-4 text-amber-300" />
                    ) : (
                      <Moon className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={startInteractiveTour}
                    aria-label="الجولة التعليمية"
                    className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/10"
                  >
                    <Compass className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    aria-label="تسجيل الخروج"
                    className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/10"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </div>
              </header>
              <div className="wa-scroll flex-1 overflow-y-auto">
                {renderBranchChatListItems(false)}
              </div>
            </aside>

            {/* Active Workspace (Desktop Right/Left Pane + Mobile Full Screen) */}
            <div className="flex h-full min-w-0 flex-col overflow-hidden">
              {/* Mobile Only: WhatsApp Chats List Home */}
              {mobileBranchShowList ? (
                <div className="flex h-full flex-col overflow-hidden bg-white dark:bg-[#111B21] lg:hidden">
                  <header className="flex h-[56px] shrink-0 items-center justify-between gap-2 bg-[#008069] px-4 text-white dark:bg-[#202C33]">
                    <div className="min-w-0">
                      <h1 className="truncate text-base font-extrabold">
                        Roast Shift · فرع {currentBranch.name}
                      </h1>
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => setNotifOpen(true)}
                        aria-label="الإشعارات"
                        className="relative flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/10"
                      >
                        <Bell className="h-5 w-5" />
                        {unreadCount > 0 && (
                          <span className="font-mono-num absolute left-1.5 top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#25D366] px-1 text-[10px] font-extrabold text-[#111B21]">
                            {unreadCount}
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={toggleBranchTheme}
                        aria-label={branchTheme === 'dark' ? 'الوضع النهاري' : 'الوضع الليلي'}
                        className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/10"
                      >
                        {branchTheme === 'dark' ? (
                          <Sun className="h-5 w-5 text-amber-300" />
                        ) : (
                          <Moon className="h-5 w-5" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={startInteractiveTour}
                        aria-label="الجولة التعليمية"
                        className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/10"
                      >
                        <Compass className="h-5 w-5" />
                      </button>
                      <button
                        type="button"
                        onClick={handleLogout}
                        aria-label="خروج"
                        className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/10"
                      >
                        <LogOut className="h-5 w-5" />
                      </button>
                    </div>
                  </header>
                  <div className="wa-scroll flex-1 overflow-y-auto">
                    {renderBranchChatListItems(true)}
                  </div>
                  {renderBranchMobileBottomTabs()}
                </div>
              ) : null}

              {/* Desktop always shows active view; Mobile shows it when mobileBranchShowList is false */}
              <div
                className={`${
                  mobileBranchShowList ? 'hidden lg:flex' : 'flex'
                } h-full min-h-0 flex-1 flex-col overflow-hidden`}
              >
                <div className="min-h-0 flex-1 overflow-hidden">
                  {session.workspace === 'planner' ? (
                    <PlannerModule
                      state={state}
                      branchId={currentBranch.id}
                      isAdmin={false}
                      externalTab={plannerTabReq}
                      onSelectBranch={(bId) => changeSession({ branchId: bId })}
                      onUpdateState={updateState}
                      onNotify={notify}
                      onGoToAvailability={(sh: ShiftType) => {
                        setMobileBranchShowList(false);
                        changeSession({
                          workspace: 'availability',
                          branchScreen: 'submit',
                          activeShift: sh,
                        });
                      }}
                      onBackToBranchChats={() => setMobileBranchShowList(true)}
                    />
                  ) : (
                    <BranchAvailabilityView
                      state={state}
                      session={session}
                      branch={currentBranch}
                      branchTheme={branchTheme}
                      largeFont={largeFont}
                      unreadNotifCount={unreadCount}
                      focusEvent={focusEvent}
                      onChangeSession={changeSession}
                      onUpdateState={updateState}
                      onNotify={notify}
                      onOpenPlanner={() => {
                        setMobileBranchShowList(false);
                        changeSession({ workspace: 'planner' });
                        setPlannerTabReq((r) => ({ tab: 'today', nonce: (r?.nonce || 0) + 1 }));
                      }}
                      onBackToChatsList={() => setMobileBranchShowList(true)}
                      onToggleTheme={toggleBranchTheme}
                      onToggleLargeFont={toggleLargeFont}
                      onOpenNotifications={() => setNotifOpen(true)}
                      onOpenTour={startInteractiveTour}
                      onLogout={handleLogout}
                    />
                  )}
                </div>

                {/* Mobile Bottom Tab Bar on Planner & Staff screens (Chat stays clean for composer!) */}
                {(session.workspace === 'planner' ||
                  (session.workspace === 'availability' &&
                    session.branchScreen === 'settings')) &&
                  renderBranchMobileBottomTabs()}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* =================================================================== */
        /* CENTRAL ADMIN (Crisp Light Mode Kept Intact)                         */
        /* =================================================================== */
        <div className="min-h-[100dvh] bg-[#eae6df] pb-6 text-[#111b21]">
          <header className="sticky top-0 z-30 bg-[#008069] text-white shadow-sm">
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-2.5 sm:px-6">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15">
                  <MessageCircle className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-base font-extrabold leading-tight">
                    Roast Shift
                  </div>
                  <div className="truncate text-[11px] font-semibold text-white/85">
                    الأدمن · مراجعة الفروع
                  </div>
                </div>
              </div>

              <nav className="hidden items-center gap-1 rounded-full bg-black/15 p-1 md:flex">
                <button
                  id="navAvailabilityTab"
                  type="button"
                  onClick={() =>
                    changeSession({
                      workspace: 'availability',
                      adminScreen: 'control',
                    })
                  }
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-extrabold transition-colors ${
                    session.workspace === 'availability' && session.adminScreen === 'control'
                      ? 'bg-white text-[#008069]'
                      : 'text-white/90 hover:bg-white/10'
                  }`}
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  <span>الفروع والمحادثات</span>
                </button>

                <button
                  id="navSettingsTab"
                  type="button"
                  onClick={() =>
                    changeSession({
                      workspace: 'availability',
                      adminScreen: 'settings',
                    })
                  }
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-extrabold transition-colors ${
                    session.workspace === 'availability' && session.adminScreen === 'settings'
                      ? 'bg-white text-[#008069]'
                      : 'text-white/90 hover:bg-white/10'
                  }`}
                >
                  <Settings className="h-3.5 w-3.5" />
                  <span>الإعدادات</span>
                </button>
              </nav>

              <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                <button
                  id="notifBellBtn"
                  type="button"
                  onClick={() => setNotifOpen(true)}
                  className="relative flex h-9 items-center gap-1.5 rounded-full bg-white/15 px-3 text-xs font-bold text-white hover:bg-white/25"
                >
                  <Bell className="h-4 w-4" />
                  <span className="hidden sm:inline">الإشعارات</span>
                  {unreadCount > 0 && (
                    <span className="font-mono-num rounded-full bg-[#25d366] px-1.5 py-0.5 text-[10px] font-extrabold text-[#111b21]">
                      {unreadCount}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setShowOnboarding(true)}
                  className="flex h-9 items-center gap-1.5 rounded-full bg-white/15 px-3 text-xs font-extrabold text-white hover:bg-white/25"
                >
                  <span>الدليل</span>
                </button>

                <button
                  type="button"
                  onClick={startInteractiveTour}
                  className="flex h-9 items-center gap-1.5 rounded-full bg-[#25d366] px-3 text-xs font-extrabold text-[#111b21] hover:bg-[#1fc45b]"
                >
                  <Compass className="h-4 w-4" />
                  <span>الجولة</span>
                </button>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex h-9 items-center gap-1 rounded-full bg-white/15 px-3 text-xs font-bold text-white hover:bg-white/25"
                  title="تسجيل الخروج"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">خروج</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 border-t border-white/15 text-center text-xs font-extrabold md:hidden">
              <button
                id="navAvailabilityTabMobile"
                type="button"
                onClick={() =>
                  changeSession({
                    workspace: 'availability',
                    adminScreen: 'control',
                  })
                }
                className={`flex items-center justify-center gap-1.5 border-b-3 py-2.5 transition-colors ${
                  session.workspace === 'availability' && session.adminScreen === 'control'
                    ? 'border-[#25d366] text-white'
                    : 'border-transparent text-white/75'
                }`}
              >
                <MessageCircle className="h-3.5 w-3.5" />
                <span>الفروع</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  changeSession({
                    workspace: 'availability',
                    adminScreen: 'settings',
                  })
                }
                className={`flex items-center justify-center gap-1.5 border-b-3 py-2.5 transition-colors ${
                  session.workspace === 'availability' && session.adminScreen === 'settings'
                    ? 'border-[#25d366] text-white'
                    : 'border-transparent text-white/75'
                }`}
              >
                <Settings className="h-3.5 w-3.5" />
                <span>الإعدادات</span>
              </button>
            </div>
          </header>

          <main className="mx-auto max-w-7xl px-2 pt-3 sm:px-6 sm:pt-4">
            {session.workspace === 'planner' ? (
              <PlannerModule
                state={state}
                branchId={currentBranch.id}
                isAdmin={true}
                externalTab={plannerTabReq}
                onSelectBranch={(bId) => changeSession({ branchId: bId })}
                onUpdateState={updateState}
                onNotify={notify}
                onBackToAdminChats={() =>
                  changeSession({ workspace: 'availability', adminScreen: 'control' })
                }
              />
            ) : (
              <AdminControlView
                state={state}
                session={session}
                selectedCompliance={selectedCompliance}
                focusEvent={focusEvent}
                onCloseComplianceModal={() => setSelectedCompliance(null)}
                onSelectCompliance={(rep) => setSelectedCompliance(rep)}
                onChangeSession={changeSession}
                onUpdateState={updateState}
                onNotify={notify}
                onOpenBranchPlanner={(bId) =>
                  changeSession({ branchId: bId, workspace: 'planner' })
                }
              />
            )}
          </main>
        </div>
      )}

      {/* Notifications Modal (Adapts to Light/Dark via .dark on <html>) */}
      {notifOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
          onClick={() => setNotifOpen(false)}
        >
          <div
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#d1d7db] bg-white p-6 text-[#111b21] shadow-2xl dark:border-white/10 dark:bg-[#202C33] dark:text-[#E9EDEF]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between border-b border-[#e9edef] pb-3 dark:border-white/10">
              <h3 className="text-base font-extrabold">الإشعارات والرسائل الواردة</h3>
              <button
                id="notifCloseBtn"
                type="button"
                onClick={() => setNotifOpen(false)}
                className="min-h-[36px] rounded-full border border-[#d1d7db] px-3.5 py-1 text-xs font-bold dark:border-white/10 dark:bg-[#202C33]"
              >
                إغلاق
              </button>
            </div>

            {myNotifs.length === 0 ? (
              <p className="py-8 text-center text-sm text-[#667781] dark:text-[#8696A0]">
                لا توجد إشعارات حتى الآن.
              </p>
            ) : (
              <div className="space-y-2.5">
                {[...myNotifs].reverse().map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => handleNotificationClick(n)}
                    className={`w-full rounded-xl border p-3.5 text-right transition-colors hover:border-[#00A884] ${
                      !n.read
                        ? n.kind === 'compliance_ok'
                          ? 'border-[#86efac] bg-[#e7fce3] dark:border-[#00A884]/40 dark:bg-[#005C4B]/40'
                          : n.kind === 'compliance_diff' || n.kind === 'emergency'
                          ? 'border-rose-300 bg-rose-50 dark:border-rose-500/40 dark:bg-rose-500/15'
                          : 'border-amber-300 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/15'
                        : 'border-[#e9edef] bg-white dark:border-white/10 dark:bg-[#111B21]'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="flex items-center gap-1.5">
                        {n.kind === 'compliance_ok' && (
                          <CheckCircle2 className="h-4 w-4 text-[#008069] dark:text-[#00A884]" />
                        )}
                        {(n.kind === 'compliance_diff' || n.kind === 'emergency') && (
                          <AlertTriangle className="h-4 w-4 text-rose-500" />
                        )}
                        <span>{n.senderName}</span>
                        {n.isEdit && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold text-amber-900 dark:bg-amber-500/20 dark:text-amber-300">
                            تعديل
                          </span>
                        )}
                      </span>
                      <span className="font-mono-num text-[11px] font-normal text-[#667781] dark:text-[#8696A0]">
                        {n.time}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs font-semibold leading-relaxed">{n.text}</p>
                    <div className="mt-1 flex items-center justify-between text-[11px] font-bold text-[#54656f] dark:text-[#8696A0]">
                      <span>
                        {SHIFTS_AR[n.shift]} · {fmtDateAr(n.shiftDate)}
                      </span>
                      <span className="text-[#008069] dark:text-[#00A884]">
                        اضغط للانتقال للحدث
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Interactive Tour */}
      <InteractiveTour
        open={tourOpen}
        steps={tourSteps}
        onClose={() => setTourOpen(false)}
      />

      {/* WhatsApp-Style Toast */}
      {toast && (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#111b21] px-5 py-2.5 text-xs font-extrabold text-white shadow-lg ring-1 ring-white/10 dark:bg-[#233138]">
          {toast}
        </div>
      )}
    </>
  );
}
