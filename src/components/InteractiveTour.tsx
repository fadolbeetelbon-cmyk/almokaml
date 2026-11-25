import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Compass, MousePointerClick, X } from 'lucide-react';

export interface TourStep {
  id: string;
  title: string;
  text: string;
  targetId?: string;
  fallbackTargetId?: string;
  requireTargetClick?: boolean;
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
  const [cardPlacement, setCardPlacement] = useState<'top' | 'bottom'>('bottom');
  const stepsRef = useRef(steps);
  stepsRef.current = steps;
  const lastEnteredRef = useRef<string | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const activeTargetRef = useRef<HTMLElement | null>(null);

  const computePlacement = useCallback((targetEl: HTMLElement | null) => {
    if (!targetEl) {
      setCardPlacement('bottom');
      return;
    }
    const rect = targetEl.getBoundingClientRect();
    const vh = window.innerHeight || 720;
    const cardHeight = cardRef.current?.offsetHeight || 210;
    const spaceAbove = rect.top - 12;
    const spaceBelow = vh - rect.bottom - 12;

    const fitsBottom = spaceBelow >= cardHeight + 8;
    const fitsTop = spaceAbove >= cardHeight + 8;

    if (fitsBottom && !fitsTop) {
      setCardPlacement('bottom');
      return;
    }
    if (fitsTop && !fitsBottom) {
      setCardPlacement('top');
      return;
    }
    if (rect.bottom > vh * 0.52 || spaceAbove > spaceBelow + 16) {
      setCardPlacement('top');
    } else {
      setCardPlacement('bottom');
    }
  }, []);

  useEffect(() => {
    if (!open) {
      setStepIdx(0);
      setCardPlacement('bottom');
      lastEnteredRef.current = null;
      activeTargetRef.current = null;
      document.body.classList.remove('tour-spotlight-mode');
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
    if (!open) {
      document.body.classList.remove('tour-spotlight-mode');
      return;
    }

    const step = stepsRef.current[stepIdx];
    document.querySelectorAll('.tour-highlight').forEach((el) => {
      el.classList.remove('tour-highlight');
    });

    if (step?.isFinal || (!step?.targetId && !step?.fallbackTargetId)) {
      activeTargetRef.current = null;
      setCardPlacement('bottom');
      document.body.classList.remove('tour-spotlight-mode');
      return;
    }

    // Activate Spotlight Blur Mode around the target button
    document.body.classList.add('tour-spotlight-mode');

    const ids = [step.targetId, step.fallbackTargetId].filter(Boolean) as string[];
    let attempts = 0;
    let timerId: ReturnType<typeof setTimeout> | null = null;
    let settleTimerId: ReturnType<typeof setTimeout> | null = null;
    let advanceTimerId: ReturnType<typeof setTimeout> | null = null;
    let attachedEl: HTMLElement | null = null;
    let clickHandler: (() => void) | null = null;

    const isElementVisible = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      return (el.offsetParent !== null || (r.width > 0 && r.height > 0)) && r.width > 0 && r.height > 0;
    };

    const handleReposition = () => {
      if (activeTargetRef.current) {
        computePlacement(activeTargetRef.current);
      }
    };

    const tryAttach = () => {
      const candidates = ids
        .map((id) => document.getElementById(id))
        .filter((el): el is HTMLElement => Boolean(el));
      const visibleEl = candidates.find(isElementVisible) || candidates[0];

      if (visibleEl && isElementVisible(visibleEl)) {
        activeTargetRef.current = visibleEl;
        visibleEl.classList.add('tour-highlight');
        visibleEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        computePlacement(visibleEl);
        settleTimerId = setTimeout(() => computePlacement(visibleEl), 240);

        if (step.requireTargetClick) {
          let handled = false;
          clickHandler = () => {
            if (handled) return;
            handled = true;
            visibleEl.classList.remove('tour-highlight');
            advanceTimerId = setTimeout(() => {
              const curr = stepsRef.current[stepIdx];
              if (curr?.onNext) {
                curr.onNext();
              }
              setStepIdx((i) => {
                if (i >= stepsRef.current.length - 1) {
                  onClose();
                  return i;
                }
                return i + 1;
              });
            }, 95);
          };
          visibleEl.addEventListener('click', clickHandler);
          attachedEl = visibleEl;
        }
        return;
      }

      attempts += 1;
      if (attempts < 28) {
        timerId = setTimeout(tryAttach, 75);
      }
    };

    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);
    timerId = setTimeout(tryAttach, 65);

    return () => {
      if (timerId) clearTimeout(timerId);
      if (settleTimerId) clearTimeout(settleTimerId);
      if (advanceTimerId) clearTimeout(advanceTimerId);
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
      if (attachedEl && clickHandler) {
        attachedEl.removeEventListener('click', clickHandler);
      }
      document.querySelectorAll('.tour-highlight').forEach((el) => {
        el.classList.remove('tour-highlight');
      });
      document.body.classList.remove('tour-spotlight-mode');
    };
  }, [open, stepIdx, onClose, computePlacement]);

  if (!open || steps.length === 0) return null;
  const current = steps[stepIdx] || steps[0];
  const isLast = stepIdx === steps.length - 1;
  const isMandatoryTargetStep = Boolean(current.requireTargetClick && !isLast);
  const progressPct = Math.round(((stepIdx + 1) / steps.length) * 100);

  const handleManualNext = () => {
    if (isMandatoryTargetStep) return;
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
    <div
      className={`tour-card-keep pointer-events-none fixed inset-x-0 z-[70] flex justify-center px-3 transition-all duration-200 ${
        cardPlacement === 'top' ? 'top-3' : 'bottom-3'
      }`}
    >
      <div
        ref={cardRef}
        className="tour-card-keep pointer-events-auto max-h-[42dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-[#2A3942] bg-[#202C33] text-[#E9EDEF] shadow-2xl"
      >
        {/* Progress bar */}
        <div className="h-1.5 w-full bg-[#111B21]">
          <div
            className="h-full bg-[#25D366] transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div className="p-3.5 sm:p-4">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 font-extrabold text-[#25D366]">
              <Compass className="h-3.5 w-3.5" />
              <span>
                جولة Roast Shift · {stepIdx + 1} من {steps.length}
              </span>
            </span>
            <button
              type="button"
              onClick={onClose}
              className="tour-card-keep flex min-h-[30px] items-center gap-1 rounded-full px-2.5 text-[#AEBAC1] hover:bg-white/10 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
              <span>إغلاق</span>
            </button>
          </div>

          <h4 className="mb-1 text-sm font-extrabold text-[#E9EDEF] sm:text-base">
            {current.title}
          </h4>
          <p className="whitespace-pre-line text-xs leading-relaxed text-[#D1D7DB] sm:text-[13px]">
            {current.text}
          </p>

          <div className="mt-3 flex items-center justify-between gap-2 border-t border-[#2A3942] pt-2.5">
            {stepIdx > 0 ? (
              <button
                type="button"
                onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
                className="tour-card-keep min-h-[36px] rounded-full px-3 text-xs font-bold text-[#AEBAC1] hover:bg-white/10 hover:text-white"
              >
                رجوع
              </button>
            ) : (
              <span />
            )}

            {isMandatoryTargetStep ? (
              <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-[#25D366]">
                <MousePointerClick className="h-4 w-4 shrink-0 animate-pulse" />
                <span>اضغط على الزر المضيء للمتابعة</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleManualNext}
                className="tour-card-keep flex min-h-[40px] items-center gap-1.5 rounded-full bg-[#25D366] px-5 py-1.5 text-xs font-extrabold text-[#111B21] hover:bg-[#1FC45B]"
              >
                <span>{isLast ? 'بدء الاستخدام الآن' : current.actionLabel || 'التالي'}</span>
                {!isLast && <ArrowLeft className="h-3.5 w-3.5" />}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
