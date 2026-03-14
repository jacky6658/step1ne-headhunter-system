import React, { useState, useEffect } from 'react';
import { BookOpen, X, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';

export interface GuideStep {
  icon: React.ReactNode;
  title: string;
  desc: string;
}

interface PageGuideProps {
  storageKey: string;
  title: string;
  steps: GuideStep[];
  onStartTour?: () => void;
}

export function PageGuide({ storageKey, title, steps, onStartTour }: PageGuideProps) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(storageKey);
    if (!dismissed) setExpanded(true);
  }, [storageKey]);

  const handleDismiss = () => {
    setExpanded(false);
    localStorage.setItem(storageKey, '1');
  };

  const handleExpand = () => {
    setExpanded(true);
  };

  const handleRestartTour = () => {
    onStartTour?.();
  };

  // Collapsed: small button
  if (!expanded) {
    return (
      <button
        onClick={handleExpand}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600
          bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors mb-3"
      >
        <BookOpen size={13} />
        使用說明
      </button>
    );
  }

  // Expanded: full guide card
  return (
    <div className="relative bg-gradient-to-br from-blue-50 via-blue-50 to-indigo-50
      border border-blue-200 rounded-xl p-4 sm:p-5 mb-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center">
            <BookOpen size={15} className="text-blue-600" />
          </div>
          <h3 className="text-sm font-bold text-blue-900">{title}</h3>
        </div>
        <div className="flex items-center gap-1.5">
          {onStartTour && (
            <button
              onClick={handleRestartTour}
              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-blue-600
                bg-white border border-blue-200 rounded-md hover:bg-blue-50 transition-colors"
            >
              <RotateCcw size={11} />
              重新導覽
            </button>
          )}
          <button
            onClick={handleDismiss}
            className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-blue-600
              bg-white border border-blue-200 rounded-md hover:bg-blue-50 transition-colors"
          >
            我知道了
          </button>
        </div>
      </div>

      {/* Steps grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {steps.map((step, i) => (
          <div key={i} className="flex items-start gap-2.5 bg-white/70 rounded-lg px-3 py-2.5">
            <div className="w-6 h-6 bg-blue-100 rounded-md flex items-center justify-center shrink-0 mt-0.5">
              {step.icon}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-blue-900">{step.title}</p>
              <p className="text-[11px] text-blue-700/80 leading-relaxed mt-0.5">{step.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
