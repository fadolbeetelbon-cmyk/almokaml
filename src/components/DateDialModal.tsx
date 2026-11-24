import React, { useEffect, useState } from 'react';
import { MONTHS_AR, pad2 } from '../data/seed';

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-[320px] rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-3 text-center text-base font-bold text-slate-900">
          {step === 'month' ? 'اختر الشهر' : 'اختر اليوم'}
        </h3>

        <div className="mb-3 flex items-center justify-center gap-3 rounded-xl bg-slate-100 p-2.5">
          <button
            type="button"
            onClick={() => setStep('month')}
            className={`rounded-lg border px-3 py-1 text-sm font-bold transition-colors ${
              step === 'month'
                ? 'border-slate-900 bg-slate-900 text-amber-300'
                : 'border-slate-200 bg-white text-slate-600'
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
                  ? 'border-slate-900 bg-slate-900 text-amber-300'
                  : 'border-slate-200 bg-white text-slate-600'
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
            className="mb-3 w-full rounded-lg border border-dashed border-amber-500 bg-amber-50 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100"
          >
            {more ? 'العودة للأيام (1 - 15)' : `أكثر (16 - ${maxDay})`}
          </button>
        )}

        <div
          dir="ltr"
          className="relative mx-auto mb-4 rounded-full border border-slate-200 bg-slate-50"
          style={{ width: SIZE, height: SIZE }}
        >
          <div
            className="pointer-events-none absolute top-1/2 left-1/2 h-0.5 origin-left bg-slate-900 transition-transform duration-150"
            style={{
              width: R,
              marginTop: -1,
              transform: `rotate(${handAngle}rad)`,
            }}
          />
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-900" />

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
                        ? 'bg-slate-900 text-amber-300'
                        : 'text-slate-700 hover:bg-slate-200'
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
                        ? 'bg-slate-900 text-amber-300'
                        : 'text-slate-700 hover:bg-slate-200'
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
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
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
            className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-bold text-white hover:bg-slate-800"
          >
            {step === 'month' && !onlyMonth ? 'التالي لليوم' : 'تأكيد'}
          </button>
        </div>
      </div>
    </div>
  );
};
