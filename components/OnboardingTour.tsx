import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, X, Check } from 'lucide-react';

export interface TourStep {
  target: string;       // data-tour attribute value
  title: string;
  content: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

interface OnboardingTourProps {
  storageKey: string;
  steps: TourStep[];
  active?: boolean;       // external control to force start
  onComplete?: () => void;
}

interface TooltipPos {
  top: number;
  left: number;
  arrowDir: 'up' | 'down' | 'left' | 'right';
}

export function OnboardingTour({ storageKey, steps, active, onComplete }: OnboardingTourProps) {
  const [running, setRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [tooltipPos, setTooltipPos] = useState<TooltipPos>({ top: 0, left: 0, arrowDir: 'up' });
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Auto-start on first visit
  useEffect(() => {
    const done = localStorage.getItem(storageKey);
    if (!done) {
      // Delay to let page render
      const timer = setTimeout(() => setRunning(true), 800);
      return () => clearTimeout(timer);
    }
  }, [storageKey]);

  // External trigger
  useEffect(() => {
    if (active) {
      setCurrentStep(0);
      setRunning(true);
    }
  }, [active]);

  // Position tooltip relative to target element
  const positionTooltip = useCallback(() => {
    if (!running || currentStep >= steps.length) return;

    const step = steps[currentStep];
    const el = document.querySelector(`[data-tour="${step.target}"]`);
    if (!el) return;

    // Scroll target into view if not visible
    const elRect = el.getBoundingClientRect();
    if (elRect.top < 0 || elRect.bottom > window.innerHeight) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Re-read rect after scroll settles
      setTimeout(() => positionTooltip(), 400);
      return;
    }

    const rect = el.getBoundingClientRect();
    setHighlightRect(rect);

    const tooltipW = 300;
    const tooltipH = 160;
    const gap = 12;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let placement = step.placement || 'bottom';

    // Auto-adjust if not enough space
    if (placement === 'bottom' && rect.bottom + tooltipH + gap > vh) placement = 'top';
    if (placement === 'top' && rect.top - tooltipH - gap < 0) placement = 'bottom';
    if (placement === 'right' && rect.right + tooltipW + gap > vw) placement = 'left';
    if (placement === 'left' && rect.left - tooltipW - gap < 0) placement = 'right';

    let top = 0;
    let left = 0;
    let arrowDir: TooltipPos['arrowDir'] = 'up';

    switch (placement) {
      case 'bottom':
        top = rect.bottom + gap;
        left = Math.max(8, Math.min(rect.left + rect.width / 2 - tooltipW / 2, vw - tooltipW - 8));
        arrowDir = 'up';
        break;
      case 'top':
        top = rect.top - tooltipH - gap;
        left = Math.max(8, Math.min(rect.left + rect.width / 2 - tooltipW / 2, vw - tooltipW - 8));
        arrowDir = 'down';
        break;
      case 'right':
        top = Math.max(8, rect.top + rect.height / 2 - tooltipH / 2);
        left = rect.right + gap;
        arrowDir = 'left';
        break;
      case 'left':
        top = Math.max(8, rect.top + rect.height / 2 - tooltipH / 2);
        left = rect.left - tooltipW - gap;
        arrowDir = 'right';
        break;
    }

    setTooltipPos({ top, left, arrowDir });
  }, [running, currentStep, steps]);

  useEffect(() => {
    positionTooltip();
    window.addEventListener('resize', positionTooltip);
    window.addEventListener('scroll', positionTooltip, true);
    return () => {
      window.removeEventListener('resize', positionTooltip);
      window.removeEventListener('scroll', positionTooltip, true);
    };
  }, [positionTooltip]);

  const finish = useCallback(() => {
    setRunning(false);
    localStorage.setItem(storageKey, '1');
    onComplete?.();
  }, [storageKey, onComplete]);

  const next = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(s => s + 1);
    } else {
      finish();
    }
  };

  const prev = () => {
    if (currentStep > 0) setCurrentStep(s => s - 1);
  };

  const skip = () => finish();

  if (!running || steps.length === 0) return null;

  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;

  return (
    <div className="fixed inset-0 z-[10000] pointer-events-none">
      {/* Overlay with cutout — visual only, doesn't block scroll */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <defs>
          <mask id="tour-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {highlightRect && (
              <rect
                x={highlightRect.left - 4}
                y={highlightRect.top - 4}
                width={highlightRect.width + 8}
                height={highlightRect.height + 8}
                rx="8"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0" y="0" width="100%" height="100%"
          fill="rgba(0,0,0,0.5)"
          mask="url(#tour-mask)"
        />
      </svg>

      {/* Highlight border */}
      {highlightRect && (
        <div
          className="absolute border-2 border-blue-400 rounded-lg pointer-events-none"
          style={{
            top: highlightRect.top - 4,
            left: highlightRect.left - 4,
            width: highlightRect.width + 8,
            height: highlightRect.height + 8,
            boxShadow: '0 0 0 4px rgba(59,130,246,0.2)',
          }}
        />
      )}

      {/* Tooltip — only this is interactive */}
      <div
        ref={tooltipRef}
        className="absolute bg-white rounded-xl shadow-2xl border border-gray-200 p-4 w-[300px] z-[10001] pointer-events-auto"
        style={{ top: tooltipPos.top, left: tooltipPos.left }}
      >
        {/* Skip button */}
        <button
          onClick={skip}
          className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors"
        >
          <X size={14} />
        </button>

        {/* Step indicator */}
        <div className="flex items-center gap-1 mb-2">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === currentStep ? 'w-4 bg-blue-500' : i < currentStep ? 'w-1.5 bg-blue-300' : 'w-1.5 bg-gray-200'
              }`}
            />
          ))}
          <span className="text-[10px] text-gray-400 ml-1">{currentStep + 1}/{steps.length}</span>
        </div>

        {/* Content */}
        <h4 className="text-sm font-bold text-gray-900 mb-1 pr-6">{step.title}</h4>
        <p className="text-xs text-gray-600 leading-relaxed mb-3">{step.content}</p>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={prev}
            disabled={currentStep === 0}
            className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-md transition-colors ${
              currentStep === 0
                ? 'text-gray-300 cursor-not-allowed'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            <ChevronLeft size={13} />
            上一步
          </button>
          <button
            onClick={next}
            className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-md
              bg-blue-500 text-white hover:bg-blue-600 transition-colors"
          >
            {isLast ? (
              <>
                <Check size={13} />
                完成
              </>
            ) : (
              <>
                下一步
                <ChevronRight size={13} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
