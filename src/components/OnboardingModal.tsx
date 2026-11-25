import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowLeftRight,
  Bell,
  BookOpen,
  CalendarDays,
  CheckCheck,
  CheckCircle2,
  Clock,
  Compass,
  MessageCircle,
  Moon,
  ShieldCheck,
  Smartphone,
  Sun,
  UserCheck,
} from 'lucide-react';

interface OnboardingModalProps {
  onSkip: () => void;
  onStartTour: () => void;
  onQuickLogin?: (pin: string) => void;
}

type GuideSectionId = 'overview' | 'branch' | 'admin' | 'live';

interface GuideSection {
  id: GuideSectionId;
  shortLabel: string;
  kicker: string;
  title: string;
  subtitle: string;
  desc: string;
}

const SECTIONS: GuideSection[] = [
  {
    id: 'overview',
    shortLabel: '1. الفكرة والفرق',
    kicker: 'نظرة سريعة على طريقة العمل',
    title: 'كل الفروع في شاشة واحدة بطابع الواتساب وبالألوان',
    subtitle: 'نموذج عملي حي يعرض دورة العمل اليومية بين الفروع والأدمن في ثوانٍ',
    desc: 'بدلاً من تشتت رسائل 8 فروع وعدّ الأسماء يدوياً كل يوم، يرسل الفرع كشف حضور الغد بضغطة واحدة من الهاتف، فتظهر حالة جميع الفروع بالألوان في لحظتها مع إمكانية نقل أي موظف لسد العجز فوراً.',
  },
  {
    id: 'branch',
    shortLabel: '2. حساب الفرع',
    kicker: 'تجربة مصممة 100% للهاتف وبأبسط خطوات',
    title: 'لوحة اليوم أفقية + أيام بتتغير أوتوماتيك + ساعة دائرية للإجازات',
    subtitle: 'إرسال الحضور الفعلي في ثوانٍ بدون أي تعقيد أو كشف لأرقام العجز والزيادة',
    desc: 'تظهر ورديتا الصباحي والمسائي جنباً إلى جنب أفقياً على الهاتف مع الوضع الليلي والنهاري وتكبير حجم الخط، والأيام والتواريخ بتتغير أوتوماتيك كل يوم حسب التقويم. وعند إضافة موظف تُضبط راحته الأسبوعية أو إجازته الشهرية المتكررة (مثل يوم 5 كل شهر لمدة يومين) بالساعة الدائرية.',
  },
  {
    id: 'admin',
    shortLabel: '3. الأدمن',
    kicker: 'لوحة متابعة سريعة ومباشرة للمراجعة واتخاذ القرار',
    title: 'زراران كبار صباحي ومسائي + كشف أي تعديل + من الإشعار للرسالة',
    subtitle: 'مراجعة فورية بالألوان وقرار نقل سريع بدون تعديل يدوي في جداول الفروع',
    desc: 'في الواجهة الرئيسية زراران كبيران للصباحي والمسائي وتحتهما بطاقات الفروع بالألوان: الأحمر للعجز، الأصفر للفائض، والأخضر للمستقر. وأي تعديل يرسله الفرع بعد الإرسال في نفس اليوم يظهر عليه تنبيه باسم الموظف المتغير، والضغط على أي إشعار ينقلك مباشرة إلى الرسالة المقصودة.',
  },
  {
    id: 'live',
    shortLabel: '4. التجربة المباشرة',
    kicker: 'ابدأ المعاينة التفاعلية خطوة بخطوة',
    title: 'جولة تعليمية إجبارية + دخول مباشر بحساب الأدمن أو أي فرع',
    subtitle: 'اتبع الجولة العملية بالضغط على الأزرار المضيئة أو جرّب شاشة الأدمن والفروع فوراً',
    desc: 'تأخذك الجولة التعليمية عبر كل شاشات النظام بالتسلسل من تسجيل الدخول إلى خطة الأسبوع وإضافة الموظف وإرسال التوفر حتى مراجعة الأدمن والإشعارات.',
  },
];

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  onSkip,
  onStartTour,
  onQuickLogin,
}) => {
  const [idx, setIdx] = useState(0);
  const current = SECTIONS[idx];
  const isLast = idx === SECTIONS.length - 1;

  return (
    <div className="wa-chat-bg flex min-h-[100dvh] flex-col items-center justify-center px-2.5 py-4 sm:px-4 sm:py-6">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-[#d1d7db] bg-white shadow-xl dark:border-white/10 dark:bg-[#202C33]">
        {/* Top WhatsApp-Styled Guide Banner */}
        <div className="flex flex-wrap items-center justify-between gap-2 bg-[#008069] px-4 py-3.5 text-white sm:px-6 dark:bg-[#202C33]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 dark:bg-[#00A884] dark:text-[#111B21]">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-extrabold sm:text-base">
                الدليل التعريفي التفاعلي — Roast Shift
              </div>
              <div className="text-[11px] font-semibold text-white/85 dark:text-[#8696A0]">
                شرح عملي واضح لتجربة الفروع والأدمن
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onStartTour}
              className="flex min-h-[38px] items-center gap-1.5 rounded-full bg-[#25d366] px-4 py-1.5 text-xs font-extrabold text-[#111b21] hover:bg-[#1fc45b]"
            >
              <Compass className="h-4 w-4" />
              <span>ابدأ الجولة التعليمية</span>
            </button>
            <button
              type="button"
              onClick={onSkip}
              className="min-h-[38px] rounded-full bg-white/15 px-3.5 py-1.5 text-xs font-extrabold text-white hover:bg-white/25"
            >
              دخول مباشر
            </button>
          </div>
        </div>

        {/* 4-Step Interactive Section Tabs */}
        <div className="grid grid-cols-2 gap-1.5 border-b border-[#e9edef] bg-[#f0f2f5] p-2 sm:grid-cols-4 sm:px-4 dark:border-white/10 dark:bg-[#111B21]">
          {SECTIONS.map((sec, sIdx) => (
            <button
              key={sec.id}
              type="button"
              onClick={() => setIdx(sIdx)}
              className={`min-h-[42px] rounded-xl px-2 py-2 text-[11px] font-extrabold transition-colors sm:text-xs ${
                sIdx === idx
                  ? 'bg-[#008069] text-white shadow-xs dark:bg-[#00A884] dark:text-[#111B21]'
                  : 'border border-[#e9edef] bg-white text-[#54656f] hover:bg-[#f0f2f5] hover:text-[#111b21] dark:border-white/10 dark:bg-[#202C33] dark:text-[#AEBAC1] dark:hover:bg-[#2A3942]'
              }`}
            >
              {sec.shortLabel}
            </button>
          ))}
        </div>

        <div className="p-4 sm:p-6">
          <div className="mb-2 flex items-center justify-between gap-2 text-xs font-extrabold text-[#006e5a] dark:text-[#00A884]">
            <span>{current.kicker}</span>
            <span className="font-mono-num text-[#667781] dark:text-[#8696A0]">
              {idx + 1} / {SECTIONS.length}
            </span>
          </div>

          <h1
            className="mb-1.5 text-lg font-extrabold leading-snug text-[#111b21] sm:text-xl dark:text-[#E9EDEF]"
            style={{ textWrap: 'balance' }}
          >
            {current.title}
          </h1>
          <p className="mb-2.5 text-xs font-extrabold text-[#008069] sm:text-sm dark:text-[#25D366]">
            {current.subtitle}
          </p>
          <p className="mb-4 text-xs leading-6 text-[#3b4a54] sm:text-sm sm:leading-7 dark:text-[#D1D7DB]">
            {current.desc}
          </p>

          {/* Interactive Visual Preview Area per Guide Tab */}
          <div className="wa-chat-bg mb-5 rounded-2xl border border-[#e9edef] p-3 sm:p-4 dark:border-white/10">
            {current.id === 'overview' && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-950 dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-200">
                    <div className="mb-1.5 flex items-center gap-1.5 font-extrabold text-rose-900 dark:text-rose-300">
                      <AlertTriangle className="h-4 w-4 text-rose-700 dark:text-rose-400" />
                      <span>الوضع التقليدي</span>
                    </div>
                    <ul className="list-disc space-y-1 pr-4 text-[11px] font-semibold">
                      <li>رسائل متفرقة في 8 محادثات منفصلة</li>
                      <li>عد يدوي ومراجعة مرهقة للخطة الأسبوعية</li>
                      <li>صعوبة ملاحظة تعديل اسم موظف وسط الرسائل</li>
                      <li>مفاجآت عجز قبل الوردية بدون بديل سريع</li>
                    </ul>
                  </div>

                  <div className="rounded-xl border border-[#86efac] bg-[#e7fce3] p-3 text-xs text-[#006e5a] dark:border-[#00A884]/40 dark:bg-[#005C4B]/40 dark:text-[#D9FDD3]">
                    <div className="mb-1.5 flex items-center gap-1.5 font-extrabold">
                      <CheckCircle2 className="h-4 w-4 text-[#008069] dark:text-[#25D366]" />
                      <span>مع Roast Shift</span>
                    </div>
                    <ul className="list-disc space-y-1 pr-4 text-[11px] font-semibold">
                      <li>أسلوب واتساب مألوف بالوضعين الليلي والنهاري</li>
                      <li>تمييز فوري بالألوان: أحمر / أصفر / أخضر</li>
                      <li>تنبيه تلقائي لأي تعديل بعد الإرسال باسم الموظف</li>
                      <li>نقل موظف بين الفروع في خطوة واحدة</li>
                    </ul>
                  </div>
                </div>

                <div className="flex items-start gap-2 rounded-xl border border-[#d1d7db] bg-white p-3 text-xs text-[#111b21] dark:border-white/10 dark:bg-[#202C33] dark:text-[#E9EDEF]">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#008069] dark:text-[#00A884]" />
                  <div>
                    <span className="font-extrabold">توزيع الصلاحيات بوضوح: </span>
                    <span className="text-[#54656f] dark:text-[#AEBAC1]">
                      الفرع يرسل حضوره الفعلي فقط ولا يرى عجزاً أو فائضاً، والأدمن يراجع البيانات بالألوان فقط بدون تعديل جداول الفرع.
                    </span>
                  </div>
                </div>
              </div>
            )}

            {current.id === 'branch' && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs font-extrabold text-[#111b21] dark:text-[#E9EDEF]">
                  <span className="flex items-center gap-1.5">
                    <Smartphone className="h-4 w-4 text-[#008069] dark:text-[#00A884]" />
                    <span>لوحة اليوم أفقية على الهاتف</span>
                  </span>
                  <span className="text-[11px] text-[#54656f] dark:text-[#8696A0]">
                    الأيام والتواريخ بتتغير أوتوماتيك كل يوم
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-[#d1d7db] bg-white p-2.5 text-[11px] dark:border-white/10 dark:bg-[#202C33]">
                    <div className="mb-1 flex items-center gap-1 font-extrabold text-[#111b21] dark:text-[#E9EDEF]">
                      <Sun className="h-3.5 w-3.5 text-amber-500" />
                      <span>صباحي</span>
                    </div>
                    <div className="text-[#54656f] dark:text-[#8696A0]">07:00 ص — 05:00 م</div>
                    <div className="mt-1 font-extrabold text-[#006e5a] dark:text-[#25D366]">
                      3 + 1 بتوين
                    </div>
                  </div>
                  <div className="rounded-xl border border-[#d1d7db] bg-white p-2.5 text-[11px] dark:border-white/10 dark:bg-[#202C33]">
                    <div className="mb-1 flex items-center gap-1 font-extrabold text-[#111b21] dark:text-[#E9EDEF]">
                      <Moon className="h-3.5 w-3.5 text-[#008069] dark:text-[#00A884]" />
                      <span>مسائي</span>
                    </div>
                    <div className="text-[#54656f] dark:text-[#8696A0]">04:00 م — 02:00 ص</div>
                    <div className="mt-1 font-extrabold text-[#006e5a] dark:text-[#25D366]">
                      3 + 1 بتوين
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-[#86efac] bg-[#e7fce3] px-3 py-2 text-[11px] font-extrabold text-[#006e5a] dark:border-[#00A884]/40 dark:bg-[#005C4B]/40 dark:text-[#D9FDD3]">
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    <span>الساعة الدائرية للإجازات (عند إضافة موظف)</span>
                  </span>
                  <span>مثلاً يوم 5 كل شهر · 2 يوم</span>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-[#d1d7db] bg-white px-3 py-2 text-[11px] font-bold text-[#111b21] dark:border-white/10 dark:bg-[#202C33] dark:text-[#E9EDEF]">
                  <span className="flex items-center gap-1.5">
                    <UserCheck className="h-4 w-4 text-[#008069] dark:text-[#00A884]" />
                    <span>تعبئة حسب خطة الغد + رسائل صوتية</span>
                  </span>
                  <span className="text-[#54656f] dark:text-[#8696A0]">بدون كشف عجز أو زيادة</span>
                </div>
              </div>
            )}

            {current.id === 'admin' && (
              <div className="space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center justify-center gap-1.5 rounded-xl bg-[#008069] py-2.5 text-xs font-extrabold text-white">
                    <Sun className="h-4 w-4 text-amber-300" />
                    <span>صباحي (زرار كبير)</span>
                  </div>
                  <div className="flex items-center justify-center gap-1.5 rounded-xl border border-[#d1d7db] bg-white py-2.5 text-xs font-extrabold text-[#111b21] dark:border-white/10 dark:bg-[#202C33] dark:text-[#E9EDEF]">
                    <Moon className="h-4 w-4 text-[#008069] dark:text-[#00A884]" />
                    <span>مسائي (زرار كبير)</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1.5 text-center text-[11px] font-extrabold">
                  <div className="rounded-xl border border-rose-300 bg-rose-50 px-2 py-2 text-rose-950 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-200">
                    أحمر · عجز
                  </div>
                  <div className="rounded-xl border border-amber-300 bg-amber-50 px-2 py-2 text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200">
                    أصفر · فائض
                  </div>
                  <div className="rounded-xl border border-[#86efac] bg-[#e7fce3] px-2 py-2 text-[#006e5a] dark:border-[#00A884]/40 dark:bg-[#005C4B]/40 dark:text-[#D9FDD3]">
                    أخضر · مستقر
                  </div>
                </div>

                <div className="rounded-xl border-2 border-amber-400 bg-white p-2.5 text-xs dark:bg-[#202C33]">
                  <div className="mb-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-[11px] font-extrabold text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200">
                    تنبيه تعديل جديد: محمد تغيّر إلى غير متاح (إجازة رسمية)
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-[#54656f] dark:text-[#AEBAC1]">
                    <span className="flex items-center gap-1 font-bold text-[#111b21] dark:text-[#E9EDEF]">
                      <Bell className="h-3.5 w-3.5 text-[#008069] dark:text-[#00A884]" />
                      <span>الضغط على الإشعار يفتح الرسالة نفسها</span>
                    </span>
                    <span className="flex items-center gap-1 font-extrabold text-[#0284c7] dark:text-[#53BDEB]">
                      <CheckCheck className="h-3.5 w-3.5 text-[#53bdeb]" />
                      <span>تم الاطلاع</span>
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-[#d1d7db] bg-white px-3 py-2 text-[11px] font-bold text-[#111b21] dark:border-white/10 dark:bg-[#202C33] dark:text-[#E9EDEF]">
                  <span className="flex items-center gap-1.5">
                    <ArrowLeftRight className="h-4 w-4 text-[#008069] dark:text-[#00A884]" />
                    <span>نقل موظف (مؤقت غداً أو نهائي)</span>
                  </span>
                  <span className="flex items-center gap-1 text-[#54656f] dark:text-[#8696A0]">
                    <CalendarDays className="h-3.5 w-3.5" />
                    <span>مراجعة الخطة للقراءة فقط</span>
                  </span>
                </div>
              </div>
            )}

            {current.id === 'live' && (
              <div className="space-y-3">
                <div className="rounded-xl border border-[#86efac] bg-[#e7fce3] p-3.5 text-xs text-[#006e5a] dark:border-[#00A884]/40 dark:bg-[#005C4B]/40 dark:text-[#D9FDD3]">
                  <div className="mb-1.5 flex items-center gap-1.5 font-extrabold">
                    <Compass className="h-4 w-4 text-[#008069] dark:text-[#25D366]" />
                    <span>ملخص سريع للتشغيل اليومي:</span>
                  </div>
                  <ul className="list-disc space-y-1 pr-4 text-[11px] font-semibold">
                    <li>الأيام والتواريخ بتتغير أوتوماتيك كل يوم في خطة الأسبوع وإرسال الغد</li>
                    <li>من داخل محادثة أي فرع: خطة الأسبوع، طاقم الفرع، إضافة موظف، والإشعارات</li>
                    <li>الضغط على اسم «الأدمن · فرع ...» بالأعلى يفتح نفس الخيارات الأربعة فوراً</li>
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={onStartTour}
                  className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-[#25d366] px-4 py-2.5 text-xs font-extrabold text-[#111b21] shadow-xs hover:bg-[#1fc45b] sm:text-sm"
                >
                  <Compass className="h-4 w-4" />
                  <span>بدء الجولة التعليمية خطوة بخطوة</span>
                </button>

                {onQuickLogin && (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => onQuickLogin('0000')}
                      className="min-h-[42px] rounded-xl border border-[#86efac] bg-[#e7fce3] px-3 py-2 text-xs font-extrabold text-[#006e5a] hover:bg-[#d9fdd3] dark:border-[#00A884]/40 dark:bg-[#005C4B]/40 dark:text-[#D9FDD3]"
                    >
                      دخول شاشة الأدمن (0000)
                    </button>
                    <button
                      type="button"
                      onClick={() => onQuickLogin('12341')}
                      className="min-h-[42px] rounded-xl border border-[#d1d7db] bg-white px-3 py-2 text-xs font-extrabold text-[#111b21] hover:bg-[#f0f2f5] dark:border-white/10 dark:bg-[#202C33] dark:text-[#E9EDEF]"
                    >
                      دخول فرع الصنادلي (12341)
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bottom Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#e9edef] pt-4 dark:border-white/10">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onStartTour}
                className="flex min-h-[44px] items-center gap-1.5 rounded-full bg-[#25d366] px-4 py-2 text-xs font-extrabold text-[#111b21] shadow-xs hover:bg-[#1fc45b] sm:text-sm"
              >
                <Compass className="h-4 w-4" />
                <span>بدء الجولة التعليمية خطوة بخطوة</span>
              </button>

              <button
                type="button"
                onClick={onSkip}
                className="flex min-h-[44px] items-center gap-1.5 rounded-full border border-[#d1d7db] bg-white px-4 py-2 text-xs font-extrabold text-[#3b4a54] hover:bg-[#f0f2f5] sm:text-sm dark:border-white/10 dark:bg-[#202C33] dark:text-[#E9EDEF]"
              >
                <MessageCircle className="h-4 w-4" />
                <span>شاشة الرموز</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              {idx > 0 && (
                <button
                  type="button"
                  onClick={() => setIdx((prev) => prev - 1)}
                  className="min-h-[44px] rounded-full border border-[#d1d7db] bg-[#f8fafc] px-4 py-2 text-xs font-extrabold text-[#111b21] hover:bg-[#f0f2f5] dark:border-white/10 dark:bg-[#111B21] dark:text-[#E9EDEF]"
                >
                  السابق
                </button>
              )}

              {isLast ? (
                <button
                  type="button"
                  onClick={onSkip}
                  className="flex min-h-[44px] items-center gap-2 rounded-full bg-[#008069] px-5 py-2 text-xs font-extrabold text-white hover:bg-[#016b58] sm:text-sm dark:bg-[#00A884] dark:text-[#111B21]"
                >
                  <span>ابدأ التجربة الحية</span>
                  <ArrowLeft className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIdx((prev) => prev + 1)}
                  className="flex min-h-[44px] items-center gap-2 rounded-full bg-[#008069] px-6 py-2 text-xs font-extrabold text-white hover:bg-[#016b58] sm:text-sm dark:bg-[#00A884] dark:text-[#111B21]"
                >
                  <span>التالي في الدليل</span>
                  <ArrowLeft className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
