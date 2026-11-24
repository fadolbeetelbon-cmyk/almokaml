import React, { useState } from 'react';
import { ArrowLeft, CalendarCheck2, CheckCircle2, Sparkles } from 'lucide-react';

interface OnboardingModalProps {
  onSkip: () => void;
  onStartTour: () => void;
}

const SLIDES = [
  {
    title: 'إرسال توفر وردية الغد.. ومطابقة تلقائية مع خطتك الأسبوعية',
    subtitle: 'دمج موقع توفر الغد الأساسي مع إضافة تخطيط الورديات الأسبوعية',
    desc: 'يُجهّز مدير الفرع الخطة الأسبوعية مسبقاً في الإضافة، وقبل الشفت الفعلي بيوم يرسل قائمة المتاحين للغد بضغطة واحدة لتصل للأدمن جاهزة للمقارنة.',
  },
  {
    title: 'واجهة سريعة لمدير الفرع: ✓ حضور أو ✕ غير متاح',
    subtitle: 'بدون تعقيد — تعبئة تلقائية من خطة الغد في ثوانٍ',
    desc: 'بدلاً من مراجعة الأسماء يدوياً كل يوم، يضغط المدير «تعبئة حسب خطة الغد» فتظهر الإجازات والأعمال المجدولة تلقائياً، ويمكنه تعديل أي طارئ وإرسال التوفر فوراً.',
  },
  {
    title: 'إشعار فوري للأدمن في غرفة التحكم بالمطابقة أو الاختلاف',
    subtitle: 'متابعة العجز والفائض قبل الشفت بيوم',
    desc: 'بمجرد إرسال التوفر، يُشعر النظام الأدمن هل الإرسال مطابق للخطة الأسبوعية أم به اختلاف، مع تصنيف تلقائي للفروع (عجز / فائض / مستقر) لتغطية النقل بسرعة.',
  },
];

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ onSkip, onStartTour }) => {
  const [idx, setIdx] = useState(0);
  const current = SLIDES[idx];
  const isLast = idx === SLIDES.length - 1;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center justify-between text-xs font-semibold text-slate-500">
          <span>Roast Shift · توفر الغد + خطة الورديات</span>
          <span className="font-mono-num">
            {idx + 1} / {SLIDES.length}
          </span>
        </div>

        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-amber-300">
          {idx === 0 ? (
            <CalendarCheck2 className="h-6 w-6" />
          ) : idx === 1 ? (
            <Sparkles className="h-6 w-6" />
          ) : (
            <CheckCircle2 className="h-6 w-6" />
          )}
        </div>

        <h1
          className="mb-2 text-2xl font-extrabold leading-snug text-slate-900"
          style={{ textWrap: 'balance' }}
        >
          {current.title}
        </h1>
        <p className="mb-4 text-sm font-bold text-amber-700">{current.subtitle}</p>
        <p className="mb-8 text-sm leading-7 text-slate-600">{current.desc}</p>

        <div className="mb-8 flex justify-center gap-2">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIdx(i)}
              aria-label={`الشريحة ${i + 1}`}
              className={`h-2 rounded-full transition-all ${
                i === idx ? 'w-8 bg-slate-900' : 'w-2 bg-slate-300 hover:bg-slate-400'
              }`}
            />
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
          <button
            type="button"
            onClick={onSkip}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            تخطي للدخول
          </button>

          <div className="flex items-center gap-2">
            {isLast ? (
              <>
                <button
                  type="button"
                  onClick={onSkip}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 hover:bg-slate-50"
                >
                  دخول مباشر
                </button>
                <button
                  type="button"
                  onClick={onStartTour}
                  className="flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-800"
                >
                  <span>بدء الدليل التفاعلي</span>
                  <ArrowLeft className="h-4 w-4" />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setIdx((prev) => prev + 1)}
                className="flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-800"
              >
                <span>التالي</span>
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
