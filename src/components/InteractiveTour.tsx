import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, X } from 'lucide-react';

export interface TourStep {
  id: string;
  title: string;
  text: string;
  targetId?: string;
  actionLabel?: string;
  onEnter?: () => void;
  onNext?: () => void;
  isFinal?: boolean;
}

interface InteractiveTourProps {
  open: boolean;
  steps: TourStep[];
  onClose: () => void;
}

export const InteractiveTour: React.FC<InteractiveTourProps> = ({ open, steps, onClose }) => {
  const [stepIdx, setStepIdx] = useState(0);
  const stepsRef = useRef(steps);
  stepsRef.current = steps;
  const lastEnteredRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) {
      setStepIdx(0);
      lastEnteredRef.current = null;
      document.querySelectorAll('.tour-highlight').forEach((el) => {
        el.classList.remove('tour-highlight');
      });
      return;
    }

    const key = `${open}:${stepIdx}`;
    if (lastEnteredRef.current !== key) {
      lastEnteredRef.current = key;
      const step = stepsRef.current[stepIdx];
      if (step?.onEnter) {
        step.onEnter();
      }
    }
  }, [open, stepIdx]);

  useEffect(() => {
    if (!open) return;
    const step = stepsRef.current[stepIdx];
    document.querySelectorAll('.tour-highlight').forEach((el) => {
      el.classList.remove('tour-highlight');
    });

    if (step?.targetId) {
      const targetId = step.targetId;
      let attempts = 0;
      let timerId: ReturnType<typeof setTimeout> | null = null;

      const tryAttach = () => {
        const el = document.getElementById(targetId);
        if (el) {
          el.classList.add('tour-highlight');
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
        attempts += 1;
        if (attempts < 10) {
          timerId = setTimeout(tryAttach, 80);
        }
      };

      timerId = setTimeout(tryAttach, 60);
      return () => {
        if (timerId) clearTimeout(timerId);
        document.querySelectorAll('.tour-highlight').forEach((el) => {
          el.classList.remove('tour-highlight');
        });
      };
    }
  }, [open, stepIdx]);

  if (!open || steps.length === 0) return null;
  const current = steps[stepIdx] || steps[0];
  const isLast = stepIdx === steps.length - 1;

  const handleNext = () => {
    if (current.onNext) {
      current.onNext();
    }
    if (isLast) {
      onClose();
    } else {
      setStepIdx((i) => Math.min(steps.length - 1, i + 1));
    }
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 text-white shadow-2xl">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="font-bold text-amber-300">
            الدليل التفاعلي · {stepIdx + 1} / {steps.length}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1 text-slate-400 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
            <span>إغلاق</span>
          </button>
        </div>

        <h4 className="mb-1.5 text-sm font-extrabold text-white">{current.title}</h4>
        <p className="whitespace-pre-line text-xs leading-relaxed text-slate-200">
          {current.text}
        </p>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-800 pt-3">
          {stepIdx > 0 ? (
            <button
              type="button"
              onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
              className="text-xs font-semibold text-slate-400 hover:text-white"
            >
              السابق
            </button>
          ) : (
            <span />
          )}

          <button
            type="button"
            onClick={handleNext}
            className="flex items-center gap-1.5 rounded-lg bg-amber-400 px-4 py-2 text-xs font-extrabold text-slate-950 hover:bg-amber-300"
          >
            <span>{isLast ? 'إنهاء الدليل' : current.actionLabel || 'التالي'}</span>
            {!isLast && <ArrowLeft className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
};
