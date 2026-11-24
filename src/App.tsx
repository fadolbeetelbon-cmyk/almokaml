import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Compass,
  Eye,
  EyeOff,
  LogOut,
  RotateCcw,
} from 'lucide-react';
import { AdminControlView } from './components/AdminControlView';
import { BranchAvailabilityView } from './components/BranchAvailabilityView';
import { InteractiveTour, TourStep } from './components/InteractiveTour';
import { OnboardingModal } from './components/OnboardingModal';
import { PlannerModule, PlannerTab } from './components/PlannerModule';
import {
  addDaysIso,
  buildPlannedRowsForShift,
  createSeedState,
  evaluateAvailabilityCompliance,
  fmtDateAr,
  getCairoToday,
  loadState,
  normalizeDigits,
  saveState,
  SHIFTS_AR,
  submissionKey,
} from './data/seed';
import {
  AppState,
  ComplianceReport,
  NotificationItem,
  SessionState,
  ShiftType,
} from './types';

export default function App() {
  const tomorrowIso = useMemo(() => addDaysIso(getCairoToday().iso, 1), []);
  const [state, setState] = useState<AppState>(() => loadState());
  const [showOnboarding, setShowOnboarding] = useState<boolean>(true);
  const [pinInput, setPinInput] = useState<string>('');
  const [showPin, setShowPin] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string>('');
  const [toast, setToast] = useState<string | null>(null);
  const [notifOpen, setNotifOpen] = useState<boolean>(false);
  const [tourOpen, setTourOpen] = useState<boolean>(false);
  const [selectedCompliance, setSelectedCompliance] = useState<ComplianceReport | null>(null);
  const [plannerTabReq, setPlannerTabReq] = useState<{ tab: PlannerTab; nonce: number } | null>(
    null
  );

  const [session, setSession] = useState<SessionState>({
    role: null,
    branchId: null,
    workspace: 'availability',
    branchScreen: 'home',
    activeShift: 'morning',
    adminScreen: 'control',
    adminShift: 'morning',
  });

  useEffect(() => {
    saveState(state);
  }, [state]);

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
    setSession((prev) => ({
      ...prev,
      role: null,
      branchId: null,
      workspace: 'availability',
      branchScreen: 'home',
      adminScreen: 'control',
    }));
    setSelectedCompliance(null);
    setNotifOpen(false);
  };

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

  const unreadCount = useMemo(
    () => myNotifs.filter((n) => !n.read).length,
    [myNotifs]
  );

  const handleNotificationClick = (n: NotificationItem) => {
    updateState((prev) => ({
      ...prev,
      notifications: prev.notifications.map((x) =>
        x.id === n.id ? { ...x, read: true } : x
      ),
    }));
    setNotifOpen(false);

    if (session.role === 'central') {
      setSession((prev) => ({
        ...prev,
        workspace: 'availability',
        adminScreen: 'control',
        adminShift: n.shift,
      }));
      if (n.complianceReport) {
        setSelectedCompliance(n.complianceReport);
      }
    } else if (session.role === 'branch') {
      setSession((prev) => ({
        ...prev,
        workspace: 'availability',
        branchScreen: 'home',
        activeShift: n.shift,
      }));
    }
  };

  // Interactive Tour tailored to Next-Day Availability + Weekly Planner Compliance
  const tourSteps: TourStep[] = useMemo(
    () => [
      {
        id: 't_login',
        title: 'دخول سريع بدون تعقيد',
        text: 'ده النموذج الموحد البسيط: موقع توفر وردية الغد الأساسي (0000 للأدمن و12341–12348 للفروع) مدمج مع إضافة تخطيط الورديات الأسبوعية. هندخل دلوقتي بفرع «الصنادلي» (12341).',
        targetId: 'loginCard',
        actionLabel: 'دخول فرع الصنادلي',
        onEnter: () => {
          setShowOnboarding(false);
          setSession((prev) => ({
            ...prev,
            role: null,
            branchId: null,
            branchScreen: 'home',
            adminScreen: 'control',
          }));
        },
        onNext: () => {
          setSession((prev) => ({
            ...prev,
            role: 'branch',
            branchId: 'b1',
            workspace: 'planner',
          }));
        },
      },
      {
        id: 't_planner_today',
        title: '1. الإضافة: خطة الورديات الأسبوعية',
        text: 'هنا مدير الفرع بيظبّط خطته الأسبوعية (الصباحي والمسائي وأيام الإجازات الأسبوعية والشهرية). الخطة دي هي المرجع اللي النظام هيقارن بيه توفر الغد تلقائياً.',
        targetId: 'plannerDaySummary',
        onEnter: () => {
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
        title: '2. تنظيم الموظفين والإجازات في بطاقات خفيفة',
        text: 'من هنا تضيف موظفاً أو تعدل شفته وإجازته الأسبوعية أو الشهرية بكل سهولة في بطاقات مقسمة وواضحة، ثم تنتقل لإرسال توفر الغد.',
        targetId: 'plannerTab_team',
        onEnter: () => {
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
        id: 't_go_availability',
        title: '3. الانتقال لتوفر وردية الغد (الموقع الأساسي)',
        text: 'رجعنا للشاشة الأساسية السريعة لمدير الفرع عشان يبعت أفراد فرعه قبل الشفت الحقيقي بيوم.',
        targetId: 'navAvailabilityTab',
        onEnter: () => {
          setSession((prev) => ({
            ...prev,
            role: 'branch',
            branchId: 'b1',
            workspace: 'planner',
          }));
        },
        onNext: () => {
          setSession((prev) => ({
            ...prev,
            workspace: 'availability',
            branchScreen: 'home',
          }));
        },
      },
      {
        id: 't_branch_home',
        title: '4. شاشة مدير الفرع البسيطة — توفر الغد',
        text: 'المدير بيشوف الوردية الصباحية والمسائية للغد، وكمان ظاهر قدّامه ملخص الخطة الأسبوعية للغد. يضغط «تسجيل الحاضر غداً» عشان يفتح قائمة الأسماء.',
        targetId: 'registerTomorrowBtn_morning',
        actionLabel: 'فتح قائمة الغد',
        onEnter: () => {
          setSession((prev) => ({
            ...prev,
            role: 'branch',
            branchId: 'b1',
            workspace: 'availability',
            branchScreen: 'home',
            activeShift: 'morning',
          }));
        },
        onNext: () => {
          setSession((prev) => ({
            ...prev,
            workspace: 'availability',
            branchScreen: 'submit',
            activeShift: 'morning',
          }));
        },
      },
      {
        id: 't_submit_screen',
        title: '5. تعبئة حسب خطة الغد وإرسال التوفر',
        text: 'لكل موظف زرارين بس: ✓ حضور أو ✕ غير متاح. وبضغطة «تعبئة حسب خطة الغد» النظام بيطابق القائمة تلقائياً، ولما نضغط «إرسال التوفر» بيوصل إشعار فوري للأدمن بالمطابقة.',
        targetId: 'sendAvailabilityBtn',
        actionLabel: 'إرسال حسب الخطة والانتقال للأدمن',
        onEnter: () => {
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
          setState((prev) => {
            const rows = buildPlannedRowsForShift(prev, 'b1', 'morning', tomorrowIso);
            const compliance = evaluateAvailabilityCompliance(
              prev,
              'b1',
              'morning',
              tomorrowIso,
              rows
            );
            const key = submissionKey('b1', 'morning', tomorrowIso);
            const timeNow = new Date().toLocaleTimeString('ar-EG', {
              hour: '2-digit',
              minute: '2-digit',
            });
            return {
              ...prev,
              submissions: {
                ...prev.submissions,
                [key]: {
                  key,
                  branchId: 'b1',
                  shift: 'morning',
                  shiftDate: tomorrowIso,
                  submittedAt: timeNow,
                  rows,
                  compliance,
                },
              },
              notifications: [
                ...prev.notifications,
                {
                  id: `ntour_${Date.now()}`,
                  kind: compliance.status === 'matched' ? 'compliance_ok' : 'compliance_diff',
                  senderRole: 'branch',
                  senderName: 'فرع الصنادلي',
                  recipientRole: 'central',
                  branchId: 'b1',
                  shift: 'morning',
                  shiftDate: tomorrowIso,
                  text: `إرسال فرع الصنادلي (صباحي - غداً) مطابق للخطة الأسبوعية (${compliance.actualCount} متاح)`,
                  time: timeNow,
                  read: false,
                  complianceReport: compliance,
                },
              ],
              audit: [
                ...prev.audit,
                {
                  id: Date.now(),
                  time: timeNow,
                  text: `إرسال توفر الغد (الوردية الصباحية): فرع الصنادلي — مطابق للخطة الأسبوعية`,
                },
              ],
            };
          });
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
        id: 't_admin_notif',
        title: '6. غرفة التحكم للأدمن (0000) — الإشعار الفوري',
        text: 'دخلنا بحساب الأدمن المركزي (0000). فوراً في جرس الإشعارات وأعلى غرفة التحكم وصل تنبيه إن إرسال فرع الصنادلي للغد مطابق للخطة الأسبوعية.',
        targetId: 'notifBellBtn',
        onEnter: () => {
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
        id: 't_admin_control',
        title: '7. متابعة الفروع (عجز / فائض / مستقر) قبل الحدث بيوم',
        text: 'الأدمن بيشوف حالة كل الفروع للغد مصنّفة (عجز / فائض / مستقر) مع شارة «مطابق للخطة» أو «اختلاف»، ويقدر ينقل أي موظف مؤقتاً أو نهائياً لسد العجز.',
        targetId: 'adminBranchCard_b1',
        onEnter: () => {
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
        id: 't_final',
        title: 'انتهت الجولة — جاهز لتجربتك الحرة',
        text: 'كده الصورتين اكتملوا ببساطة تامة:\n• مدير الفرع: يرسل توفر الغد في ثوانٍ (✓ حضور / ✕ غير متاح).\n• الإضافة: خطة الأسبوع تسهل التعبئة وتطلع اختلافاتها للأدمن فوراً.\n\nجرب الآن تدخل فرع (12341–12348) وتغير موظف عكس خطة الغد، وشوف التنبيه الفوري عند الأدمن (0000)!',
        isFinal: true,
      },
    ],
    [tomorrowIso]
  );

  const currentBranch =
    state.branches.find((b) => b.id === session.branchId) || state.branches[0];

  return (
    <>
      {showOnboarding ? (
        <OnboardingModal
          onSkip={() => setShowOnboarding(false)}
          onStartTour={() => {
            setShowOnboarding(false);
            setTourOpen(true);
          }}
        />
      ) : !session.role ? (
        <div className="flex min-h-screen flex-col items-center justify-center bg-slate-100 px-4 py-8">
          <div
            id="loginCard"
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-sm"
          >
            <div className="mb-6 text-center">
              <div className="text-xs font-bold text-amber-700">
                Roast Shift · توفر الغد + تخطيط الورديات
              </div>
              <h1 className="mt-1 text-xl font-extrabold text-slate-900">
                تسجيل الدخول للنظام
              </h1>
              <p className="mt-1 text-xs text-slate-500">
                الأدمن المركزي ({state.adminPin}) أو مدير الفرع برمز فرعه
              </p>
            </div>

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
                  className="font-mono-num w-full rounded-xl border-2 border-slate-200 bg-slate-50 py-3 pl-11 pr-11 text-center text-2xl font-bold tracking-[0.4em] text-slate-900 outline-none focus:border-slate-900"
                />
                <button
                  type="button"
                  onClick={() => setShowPin((v) => !v)}
                  aria-label={showPin ? 'إخفاء الرمز' : 'إظهار الرمز'}
                  className="absolute left-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-700"
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
                    className="font-mono-num rounded-xl border border-slate-200 bg-white py-3 text-base font-bold text-slate-800 hover:bg-slate-50"
                  >
                    {k}
                  </button>
                ))}
              </div>

              {loginError && (
                <div className="mb-3 text-center text-xs font-bold text-rose-600">
                  {loginError}
                </div>
              )}

              <button
                type="submit"
                className="w-full rounded-xl bg-slate-900 py-3.5 text-sm font-extrabold text-white hover:bg-slate-800"
              >
                دخول للنظام
              </button>
            </form>

            {/* Quick Demo Strip */}
            <div className="mt-6 border-t border-slate-100 pt-4">
              <div className="mb-2 flex items-center justify-between text-xs font-bold text-slate-500">
                <span>دخول سريع للتجربة:</span>
                <button
                  type="button"
                  onClick={() => setTourOpen(true)}
                  className="flex items-center gap-1 text-amber-700 hover:underline"
                >
                  <Compass className="h-3.5 w-3.5" />
                  <span>تشغيل الدليل التفاعلي</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => handleLogin(state.adminPin)}
                className="mb-2 w-full rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-extrabold text-amber-950 hover:bg-amber-100"
              >
                الأدمن المركزي — غرفة التحكم ({state.adminPin})
              </button>

              <div className="grid grid-cols-2 gap-1.5">
                {state.branches.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => handleLogin(b.pin)}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-right text-[11px] font-bold text-slate-700 hover:bg-slate-100"
                  >
                    {b.name} <span className="font-mono-num text-slate-400">({b.pin})</span>
                  </button>
                ))}
              </div>

              <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
                <button
                  type="button"
                  onClick={() => setShowOnboarding(true)}
                  className="hover:text-slate-700"
                >
                  عرض الشاشة الترحيبية
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const fresh = createSeedState();
                    setState(fresh);
                    notify('تمت إعادة تعيين البيانات التجريبية');
                  }}
                  className="flex items-center gap-1 hover:text-rose-700"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>تصفير التجربة</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="min-h-screen bg-slate-50 pb-20 text-slate-900">
          {/* Top Bar */}
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
              <div className="flex items-center gap-3">
                <span className="whitespace-nowrap text-lg font-extrabold tracking-tight text-slate-900">
                  Roast Shift
                </span>
                <span className="hidden text-xs font-semibold text-slate-400 sm:inline">
                  {session.role === 'central'
                    ? 'غرفة التحكم · الأدمن المركزي'
                    : `فرع ${currentBranch.name}`}
                </span>
              </div>

              <nav className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
                <button
                  id="navAvailabilityTab"
                  type="button"
                  onClick={() =>
                    changeSession({
                      workspace: 'availability',
                      branchScreen: 'home',
                      adminScreen: 'control',
                    })
                  }
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-3.5 py-1.5 text-xs font-bold transition-colors ${
                    session.workspace === 'availability'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <ClipboardCheck className="h-3.5 w-3.5" />
                  <span>
                    {session.role === 'central' ? 'غرفة التحكم (الغد)' : 'توفر وردية الغد'}
                  </span>
                </button>

                <button
                  id="navPlannerTab"
                  type="button"
                  onClick={() => changeSession({ workspace: 'planner' })}
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-3.5 py-1.5 text-xs font-bold transition-colors ${
                    session.workspace === 'planner'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <CalendarDays className="h-3.5 w-3.5" />
                  <span>تخطيط الورديات (الإضافة)</span>
                </button>
              </nav>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  id="notifBellBtn"
                  type="button"
                  onClick={() => setNotifOpen(true)}
                  className="relative flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  <Bell className="h-4 w-4" />
                  <span className="hidden sm:inline">الإشعارات</span>
                  {unreadCount > 0 && (
                    <span className="font-mono-num rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                      {unreadCount}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setTourOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg bg-amber-100 px-3 py-2 text-xs font-extrabold text-amber-950 hover:bg-amber-200"
                >
                  <Compass className="h-4 w-4" />
                  <span className="hidden sm:inline">الدليل التفاعلي</span>
                </button>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                  title="تسجيل الخروج"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">خروج</span>
                </button>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
            {session.workspace === 'planner' ? (
              <PlannerModule
                state={state}
                branchId={currentBranch.id}
                isAdmin={session.role === 'central'}
                externalTab={plannerTabReq}
                onSelectBranch={(bId) => changeSession({ branchId: bId })}
                onUpdateState={updateState}
                onNotify={notify}
                onGoToAvailability={
                  session.role === 'branch'
                    ? (sh: ShiftType) =>
                        changeSession({
                          workspace: 'availability',
                          branchScreen: 'submit',
                          activeShift: sh,
                        })
                    : undefined
                }
              />
            ) : session.role === 'central' ? (
              <AdminControlView
                state={state}
                session={session}
                selectedCompliance={selectedCompliance}
                onCloseComplianceModal={() => setSelectedCompliance(null)}
                onSelectCompliance={(rep) => setSelectedCompliance(rep)}
                onChangeSession={changeSession}
                onUpdateState={updateState}
                onNotify={notify}
                onOpenBranchPlanner={(bId) =>
                  changeSession({ branchId: bId, workspace: 'planner' })
                }
              />
            ) : (
              <BranchAvailabilityView
                state={state}
                session={session}
                branch={currentBranch}
                onChangeSession={changeSession}
                onUpdateState={updateState}
                onNotify={notify}
                onOpenPlanner={() => changeSession({ workspace: 'planner' })}
              />
            )}
          </main>

          {/* Notifications Modal */}
          {notifOpen && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
              onClick={() => setNotifOpen(false)}
            >
              <div
                className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-base font-extrabold text-slate-900">
                    الإشعارات وإشعارات المطابقة
                  </h3>
                  <button
                    type="button"
                    onClick={() => setNotifOpen(false)}
                    className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-bold"
                  >
                    إغلاق
                  </button>
                </div>

                {myNotifs.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-400">
                    لا توجد إشعارات حتى الآن.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {[...myNotifs].reverse().map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => handleNotificationClick(n)}
                        className={`w-full rounded-xl border p-3.5 text-right transition-colors hover:border-slate-400 ${
                          !n.read
                            ? n.kind === 'compliance_ok'
                              ? 'border-emerald-300 bg-emerald-50/70'
                              : n.kind === 'compliance_diff' || n.kind === 'emergency'
                              ? 'border-rose-300 bg-rose-50/70'
                              : 'border-amber-300 bg-amber-50/60'
                            : 'border-slate-200 bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="flex items-center gap-1.5 text-slate-900">
                            {n.kind === 'compliance_ok' && (
                              <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                            )}
                            {(n.kind === 'compliance_diff' || n.kind === 'emergency') && (
                              <AlertTriangle className="h-4 w-4 text-rose-700" />
                            )}
                            <span>{n.senderName}</span>
                          </span>
                          <span className="font-mono-num text-[11px] font-normal text-slate-400">
                            {n.time}
                          </span>
                        </div>
                        <p className="mt-1.5 text-xs font-semibold leading-relaxed text-slate-800">
                          {n.text}
                        </p>
                        <div className="mt-1 text-[11px] font-bold text-slate-500">
                          {SHIFTS_AR[n.shift]} · {fmtDateAr(n.shiftDate)}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Interactive Tour */}
      <InteractiveTour
        open={tourOpen}
        steps={tourSteps}
        onClose={() => setTourOpen(false)}
      />

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white shadow-lg">
          {toast}
        </div>
      )}
    </>
  );
}
