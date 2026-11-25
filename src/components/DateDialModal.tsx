import React, { useEffect, useState } from 'react';
import { DAY_NAMES_AR, MONTHS_AR, pad2, WEEK_ORDER_SAT_FRI } from '../data/seed';

interface DateDialModalProps {
  open: boolean;
  year: number;
  month1: number; // 1-12
  day: number; // 1-31
  onlyMonth?: boolean;
  onCancel: () => void;
  onConfirm: (result: { year: number; month1: number; day: number; iso: string }) => void;
}

const SIZE = 256;
const C = SIZE / 2;
const R = 98;

function daysIn(m1: number, y: number) {
  return new Date(y, m1, 0).getDate();
}

export const DateDialModal: React.FC<DateDialModalProps> = ({
  open,
  year,
  month1,
  day,
  onlyMonth = false,
  onCancel,
  onConfirm,
}) => {
  const [m, setM] = useState(month1);
  const [d, setD] = useState(day);
  const [step, setStep] = useState<'month' | 'day'>('month');
  const [more, setMore] = useState(day > 15);

  useEffect(() => {
    if (!open) return;
    setM(month1);
    setD(day);
    setStep('month');
    setMore(day > 15);
  }, [open, month1, day]);

  if (!open) return null;

  const maxDay = daysIn(m, year);
  const lo = more ? 16 : 1;
  const hi = more ? maxDay : 15;
  const count = hi - lo + 1;

  const handAngle =
    step === 'month'
      ? ((m - 1) / 12) * 2 * Math.PI - Math.PI / 2
      : ((d - lo) / count) * 2 * Math.PI - Math.PI / 2;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-[320px] rounded-2xl border border-[#d1d7db] bg-white p-5 shadow-xl dark:border-white/10 dark:bg-[#202C33]"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-3 text-center text-base font-extrabold text-[#111b21] dark:text-[#E9EDEF]">
          {step === 'month' ? 'اختر الشهر' : 'اختر اليوم'}
        </h3>

        <div className="mb-3 flex items-center justify-center gap-3 rounded-xl bg-[#f0f2f5] p-2.5 dark:bg-[#111B21]">
          <button
            type="button"
            onClick={() => setStep('month')}
            className={`rounded-lg border px-3 py-1 text-sm font-bold transition-colors ${
              step === 'month'
                ? 'border-[#008069] bg-[#008069] text-white dark:border-[#00A884] dark:bg-[#00A884] dark:text-[#111B21]'
                : 'border-[#d1d7db] bg-white text-[#54656f] dark:border-white/10 dark:bg-[#202C33] dark:text-[#8696A0]'
            }`}
          >
            {MONTHS_AR[m - 1]}
          </button>
          {!onlyMonth && (
            <button
              type="button"
              onClick={() => setStep('day')}
              className={`font-mono-num rounded-lg border px-3 py-1 text-base font-bold transition-colors ${
                step === 'day'
                  ? 'border-[#008069] bg-[#008069] text-white dark:border-[#00A884] dark:bg-[#00A884] dark:text-[#111B21]'
                  : 'border-[#d1d7db] bg-white text-[#54656f] dark:border-white/10 dark:bg-[#202C33] dark:text-[#8696A0]'
              }`}
            >
              {d}
            </button>
          )}
        </div>

        {step === 'day' && !onlyMonth && (
          <button
            type="button"
            onClick={() => {
              const nextMore = !more;
              setMore(nextMore);
              if (nextMore && d <= 15) setD(16);
              if (!nextMore && d > 15) setD(15);
            }}
            className="mb-3 w-full rounded-lg border border-dashed border-[#008069] bg-[#e7fce3] py-1.5 text-xs font-extrabold text-[#006e5a] hover:bg-[#d9fdd3] dark:border-[#00A884] dark:bg-[#005C4B]/40 dark:text-[#00A884]"
          >
            {more ? 'العودة للأيام (1 - 15)' : `أكثر (16 - ${maxDay})`}
          </button>
        )}

        <div
          dir="ltr"
          className="relative mx-auto mb-4 rounded-full border border-[#d1d7db] bg-[#f8fafc] dark:border-white/10 dark:bg-[#111B21]"
          style={{ width: SIZE, height: SIZE }}
        >
          <div
            className="pointer-events-none absolute top-1/2 left-1/2 h-0.5 origin-left bg-[#008069] transition-transform duration-150 dark:bg-[#00A884]"
            style={{
              width: R,
              marginTop: -1,
              transform: `rotate(${handAngle}rad)`,
            }}
          />
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#008069] dark:bg-[#00A884]" />

          {step === 'month'
            ? MONTHS_AR.map((mName, idx) => {
                const mNum = idx + 1;
                const a = (idx / 12) * 2 * Math.PI - Math.PI / 2;
                const isSel = mNum === m;
                return (
                  <button
                    key={mNum}
                    type="button"
                    onClick={() => {
                      setM(mNum);
                      setD((prev) => Math.min(prev, daysIn(mNum, year)));
                      if (!onlyMonth) {
                        setStep('day');
                        setMore(d > 15);
                      }
                    }}
                    style={{ left: C + R * Math.cos(a), top: C + R * Math.sin(a) }}
                    className={`absolute flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[11px] font-bold transition-colors ${
                      isSel
                        ? 'bg-[#008069] text-white dark:bg-[#00A884] dark:text-[#111B21]'
                        : 'text-[#111b21] hover:bg-[#e9edef] dark:text-[#E9EDEF] dark:hover:bg-[#202C33]'
                    }`}
                  >
                    {mName}
                  </button>
                );
              })
            : Array.from({ length: count }).map((_, i) => {
                const dayVal = lo + i;
                const a = (i / count) * 2 * Math.PI - Math.PI / 2;
                const isSel = dayVal === d;
                return (
                  <button
                    key={dayVal}
                    type="button"
                    onClick={() => setD(dayVal)}
                    style={{ left: C + R * Math.cos(a), top: C + R * Math.sin(a) }}
                    className={`font-mono-num absolute flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                      isSel
                        ? 'bg-[#008069] text-white dark:bg-[#00A884] dark:text-[#111B21]'
                        : 'text-[#111b21] hover:bg-[#e9edef] dark:text-[#E9EDEF] dark:hover:bg-[#202C33]'
                    }`}
                  >
                    {dayVal}
                  </button>
                );
              })}
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-[#d1d7db] bg-white px-4 py-2 text-xs font-bold text-[#3b4a54] hover:bg-[#f0f2f5] dark:border-white/10 dark:bg-[#202C33] dark:text-[#AEBAC1] dark:hover:bg-white/10"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={() => {
              if (step === 'month' && !onlyMonth) {
                setStep('day');
                setMore(d > 15);
                return;
              }
              onConfirm({
                year,
                month1: m,
                day: d,
                iso: `${year}-${pad2(m)}-${pad2(d)}`,
              });
            }}
            className="rounded-full bg-[#008069] px-5 py-2 text-xs font-extrabold text-white hover:bg-[#016b58] dark:bg-[#00A884] dark:text-[#111B21]"
          >
            {step === 'month' && !onlyMonth ? 'التالي لليوم' : 'تأكيد'}
          </button>
        </div>
      </div>
    </div>
  );
};

interface WeeklyOffDialModalProps {
  open: boolean;
  selectedDay: number | null;
  title?: string;
  onCancel: () => void;
  onConfirm: (day: number | null) => void;
}

export const WeeklyOffDialModal: React.FC<WeeklyOffDialModalProps> = ({
  open,
  selectedDay,
  title = 'اختر يوم الإجازة الأسبوعية',
  onCancel,
  onConfirm,
}) => {
  const [val, setVal] = useState<number | null>(selectedDay);

  useEffect(() => {
    if (open) setVal(selectedDay);
  }, [open, selectedDay]);

  if (!open) return null;

  const selIdx = val === null ? -1 : WEEK_ORDER_SAT_FRI.indexOf(val as 0 | 1 | 2 | 3 | 4 | 5 | 6);
  const handAngle = selIdx >= 0 ? (selIdx / 7) * 2 * Math.PI - Math.PI / 2 : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-[330px] rounded-2xl border border-[#d1d7db] bg-white p-5 shadow-xl dark:border-white/10 dark:bg-[#202C33]"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-1 text-center text-base font-extrabold text-[#111b21] dark:text-[#E9EDEF]">
          {title}
        </h3>
        <p className="mb-4 text-center text-xs font-bold text-[#008069] dark:text-[#00A884]">
          {val === null ? 'بدون إجازة أسبوعية' : `يوم الإجازة: ${DAY_NAMES_AR[val]}`}
        </p>

        <div
          dir="ltr"
          className="relative mx-auto mb-4 rounded-full border border-[#d1d7db] bg-[#f8fafc] dark:border-white/10 dark:bg-[#111B21]"
          style={{ width: SIZE, height: SIZE }}
        >
          {selIdx >= 0 && (
            <div
              className="pointer-events-none absolute top-1/2 left-1/2 h-0.5 origin-left bg-[#008069] transition-transform duration-150 dark:bg-[#00A884]"
              style={{
                width: R - 8,
                marginTop: -1,
                transform: `rotate(${handAngle}rad)`,
              }}
            />
          )}

          <button
            type="button"
            onClick={() => setVal(null)}
            className={`absolute left-1/2 top-1/2 z-10 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border text-xs font-extrabold transition-colors ${
              val === null
                ? 'border-[#008069] bg-[#008069] text-white dark:border-[#00A884] dark:bg-[#00A884] dark:text-[#111B21]'
                : 'border-[#d1d7db] bg-white text-[#54656f] hover:bg-[#f0f2f5] dark:border-white/10 dark:bg-[#202C33] dark:text-[#AEBAC1]'
            }`}
          >
            بدون
          </button>

          {WEEK_ORDER_SAT_FRI.map((dow, idx) => {
            const a = (idx / 7) * 2 * Math.PI - Math.PI / 2;
            const isSel = val === dow;
            return (
              <button
                key={dow}
                type="button"
                onClick={() => setVal(dow)}
                style={{ left: C + R * Math.cos(a), top: C + R * Math.sin(a) }}
                className={`absolute flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[11px] font-extrabold shadow-xs transition-colors ${
                  isSel
                    ? 'bg-[#008069] text-white ring-2 ring-[#25d366] dark:bg-[#00A884] dark:text-[#111B21]'
                    : 'border border-[#e9edef] bg-white text-[#111b21] hover:bg-[#e7fce3] dark:border-white/10 dark:bg-[#202C33] dark:text-[#E9EDEF] dark:hover:bg-[#005C4B]'
                }`}
              >
                {DAY_NAMES_AR[dow]}
              </button>
            );
          })}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[44px] flex-1 rounded-full border border-[#d1d7db] bg-white py-2 text-xs font-bold text-[#3b4a54] hover:bg-[#f0f2f5] dark:border-white/10 dark:bg-[#202C33] dark:text-[#AEBAC1]"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={() => onConfirm(val)}
            className="min-h-[44px] flex-1 rounded-full bg-[#008069] py-2 text-xs font-extrabold text-white hover:bg-[#016b58] dark:bg-[#00A884] dark:text-[#111B21]"
          >
            تأكيد اليوم
          </button>
        </div>
      </div>
    </div>
  );
};

interface MonthlyLeaveDialModalProps {
  open: boolean;
  initialDayOfMonth?: number;
  initialDaysCount?: number;
  initialSkipWeekly?: boolean;
  employeeName?: string;
  onCancel: () => void;
  onConfirm: (result: {
    dayOfMonth: number;
    daysCount: number;
    skipWeeklyInSameWeek: boolean;
  }) => void;
}

export const MonthlyLeaveDialModal: React.FC<MonthlyLeaveDialModalProps> = ({
  open,
  initialDayOfMonth = 5,
  initialDaysCount = 2,
  initialSkipWeekly = true,
  employeeName,
  onCancel,
  onConfirm,
}) => {
  const [step, setStep] = useState<'day' | 'count'>('day');
  const [dayOfMonth, setDayOfMonth] = useState(initialDayOfMonth);
  const [moreDays, setMoreDays] = useState(initialDayOfMonth > 15);
  const [daysCount, setDaysCount] = useState(initialDaysCount);
  const [skipWeekly, setSkipWeekly] = useState(initialSkipWeekly);

  useEffect(() => {
    if (!open) return;
    const clampedDay = Math.min(31, Math.max(1, initialDayOfMonth || 5));
    const clampedCount = Math.min(15, Math.max(1, initialDaysCount || 2));
    setStep('day');
    setDayOfMonth(clampedDay);
    setMoreDays(clampedDay > 15);
    setDaysCount(clampedCount);
    setSkipWeekly(initialSkipWeekly);
  }, [open, initialDayOfMonth, initialDaysCount, initialSkipWeekly]);

  if (!open) return null;

  const lo = moreDays ? 16 : 1;
  const hi = moreDays ? 31 : 15;
  const dayOptionsCount = hi - lo + 1;
  const maxDurationOptions = 15;

  const handAngle =
    step === 'day'
      ? ((dayOfMonth - lo) / dayOptionsCount) * 2 * Math.PI - Math.PI / 2
      : ((daysCount - 1) / maxDurationOptions) * 2 * Math.PI - Math.PI / 2;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-[340px] rounded-2xl border border-[#d1d7db] bg-white p-5 shadow-xl dark:border-white/10 dark:bg-[#202C33]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 text-center text-xs font-extrabold text-[#008069] dark:text-[#00A884]">
          {employeeName ? `إجازة شهرية — ${employeeName}` : 'الإجازة الشهرية المتكررة'}
        </div>
        <h3 className="mb-3 text-center text-base font-extrabold text-[#111b21] dark:text-[#E9EDEF]">
          {step === 'day' ? 'يأخذ إجازته يوم كام في كل شهر؟' : 'كم عدد أيام الإجازة؟'}
        </h3>

        <div className="mb-3 flex items-center justify-center gap-2 rounded-xl bg-[#f0f2f5] p-2 dark:bg-[#111B21]">
          <button
            type="button"
            onClick={() => setStep('day')}
            className={`flex-1 rounded-lg py-1.5 text-xs font-extrabold transition-colors ${
              step === 'day'
                ? 'bg-[#008069] text-white dark:bg-[#00A884] dark:text-[#111B21]'
                : 'bg-white text-[#54656f] dark:bg-[#202C33] dark:text-[#8696A0]'
            }`}
          >
            يوم {dayOfMonth} كل شهر
          </button>
          <button
            type="button"
            onClick={() => setStep('count')}
            className={`flex-1 rounded-lg py-1.5 text-xs font-extrabold transition-colors ${
              step === 'count'
                ? 'bg-[#008069] text-white dark:bg-[#00A884] dark:text-[#111B21]'
                : 'bg-white text-[#54656f] dark:bg-[#202C33] dark:text-[#8696A0]'
            }`}
          >
            المدة: {daysCount} {daysCount === 1 ? 'يوم' : daysCount === 2 ? 'يومان' : 'أيام'}
          </button>
        </div>

        {step === 'day' && (
          <button
            type="button"
            onClick={() => {
              const nextMore = !moreDays;
              setMoreDays(nextMore);
              if (nextMore && dayOfMonth <= 15) setDayOfMonth(16);
              if (!nextMore && dayOfMonth > 15) setDayOfMonth(15);
            }}
            className="mb-3 w-full rounded-full border border-dashed border-[#008069] bg-[#e7fce3] py-1.5 text-xs font-extrabold text-[#006e5a] hover:bg-[#d9fdd3] dark:border-[#00A884] dark:bg-[#005C4B]/40 dark:text-[#00A884]"
          >
            {moreDays ? 'العودة للأيام (1 - 15)' : 'الأيام (16 - 31)'}
          </button>
        )}

        <div
          dir="ltr"
          className="relative mx-auto mb-4 rounded-full border border-[#d1d7db] bg-[#f8fafc] dark:border-white/10 dark:bg-[#111B21]"
          style={{ width: SIZE, height: SIZE }}
        >
          <div
            className="pointer-events-none absolute top-1/2 left-1/2 h-0.5 origin-left bg-[#008069] transition-transform duration-150 dark:bg-[#00A884]"
            style={{
              width: R,
              marginTop: -1,
              transform: `rotate(${handAngle}rad)`,
            }}
          />
          <div className="pointer-events-none absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#008069] text-sm font-extrabold text-white shadow-xs dark:bg-[#00A884] dark:text-[#111B21]">
            {step === 'day' ? dayOfMonth : daysCount}
          </div>

          {step === 'day'
            ? Array.from({ length: dayOptionsCount }).map((_, i) => {
                const dayVal = lo + i;
                const a = (i / dayOptionsCount) * 2 * Math.PI - Math.PI / 2;
                const isSel = dayVal === dayOfMonth;
                return (
                  <button
                    key={dayVal}
                    type="button"
                    onClick={() => setDayOfMonth(dayVal)}
                    style={{ left: C + R * Math.cos(a), top: C + R * Math.sin(a) }}
                    className={`font-mono-num absolute flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                      isSel
                        ? 'bg-[#008069] text-white ring-2 ring-[#25d366] dark:bg-[#00A884] dark:text-[#111B21]'
                        : 'text-[#111b21] hover:bg-[#e7fce3] dark:text-[#E9EDEF] dark:hover:bg-[#202C33]'
                    }`}
                  >
                    {dayVal}
                  </button>
                );
              })
            : Array.from({ length: maxDurationOptions }).map((_, i) => {
                const cntVal = i + 1;
                const a = (i / maxDurationOptions) * 2 * Math.PI - Math.PI / 2;
                const isSel = cntVal === daysCount;
                return (
                  <button
                    key={cntVal}
                    type="button"
                    onClick={() => setDaysCount(cntVal)}
                    style={{ left: C + R * Math.cos(a), top: C + R * Math.sin(a) }}
                    className={`font-mono-num absolute flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                      isSel
                        ? 'bg-[#008069] text-white ring-2 ring-[#25d366] dark:bg-[#00A884] dark:text-[#111B21]'
                        : 'text-[#111b21] hover:bg-[#e7fce3] dark:text-[#E9EDEF] dark:hover:bg-[#202C33]'
                    }`}
                  >
                    {cntVal}
                  </button>
                );
              })}
        </div>

        {step === 'count' && (
          <label className="mb-3 flex cursor-pointer items-center gap-2 rounded-xl border border-[#e9edef] bg-[#f8fafc] p-2.5 text-xs font-semibold text-[#3b4a54] dark:border-white/10 dark:bg-[#111B21] dark:text-[#AEBAC1]">
            <input
              type="checkbox"
              checked={skipWeekly}
              onChange={(e) => setSkipWeekly(e.target.checked)}
              className="accent-[#00A884]"
            />
            <span>لا يأخذ إجازته الأسبوعية في نفس الأسبوع</span>
          </label>
        )}

        <div className="flex gap-2">
          {step === 'day' ? (
            <>
              <button
                type="button"
                onClick={onCancel}
                className="min-h-[44px] flex-1 rounded-full border border-[#d1d7db] bg-white py-2 text-xs font-bold text-[#3b4a54] dark:border-white/10 dark:bg-[#202C33] dark:text-[#AEBAC1]"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => setStep('count')}
                className="min-h-[44px] flex-1 rounded-full bg-[#008069] py-2 text-xs font-extrabold text-white hover:bg-[#016b58] dark:bg-[#00A884] dark:text-[#111B21]"
              >
                التالي: عدد الأيام
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setStep('day')}
                className="min-h-[44px] flex-1 rounded-full border border-[#d1d7db] bg-white py-2 text-xs font-bold text-[#3b4a54] dark:border-white/10 dark:bg-[#202C33] dark:text-[#AEBAC1]"
              >
                رجوع لليوم
              </button>
              <button
                type="button"
                onClick={() =>
                  onConfirm({
                    dayOfMonth,
                    daysCount,
                    skipWeeklyInSameWeek: skipWeekly,
                  })
                }
                className="min-h-[44px] flex-1 rounded-full bg-[#008069] py-2 text-xs font-extrabold text-white hover:bg-[#016b58] dark:bg-[#00A884] dark:text-[#111B21]"
              >
                حفظ الإجازة
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
