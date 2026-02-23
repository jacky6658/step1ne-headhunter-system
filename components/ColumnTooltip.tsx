// Step1ne Headhunter System - 欄位說明提示組件
import React, { useState, useRef, useEffect } from 'react';
import { HelpCircle, X } from 'lucide-react';

interface ColumnTooltipProps {
  title: string;
  description: string | React.ReactNode;
  examples?: string[];
}

export function ColumnTooltip({ title, description, examples }: ColumnTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // 點擊外部關閉
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // ESC 鍵關閉
  useEffect(() => {
    function handleEsc(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      return () => document.removeEventListener('keydown', handleEsc);
    }
  }, [isOpen]);

  return (
    <div className="relative inline-block" ref={tooltipRef}>
      {/* ⓘ 圖示按鈕 */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-gray-400 hover:text-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded-full"
        aria-label={`${title} 說明`}
        type="button"
      >
        <HelpCircle className="w-4 h-4" />
      </button>

      {/* 說明彈窗 */}
      {isOpen && (
        <>
          {/* 手機版遮罩層 */}
          <div 
            className="fixed inset-0 bg-black/20 z-40 sm:hidden"
            onClick={() => setIsOpen(false)}
          />
          
          {/* 彈窗內容 */}
          <div className={`
            absolute z-50 mt-2 w-80 max-w-[calc(100vw-2rem)]
            bg-white rounded-lg shadow-xl border border-gray-200
            transform transition-all duration-200
            ${isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}
          `}
          style={{
            // 桌面版：靠左顯示
            // 手機版：置中顯示
            left: window.innerWidth < 640 ? '50%' : '0',
            transform: window.innerWidth < 640 ? 'translateX(-50%)' : 'translateX(0)'
          }}
          >
            {/* 標題列 */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-blue-600" />
                {title}
              </h4>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded hover:bg-gray-100"
                aria-label="關閉"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 內容 */}
            <div className="p-4 space-y-3">
              {/* 說明文字 */}
              <div className="text-sm text-gray-700 leading-relaxed">
                {description}
              </div>

              {/* 範例（可選） */}
              {examples && examples.length > 0 && (
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    範例
                  </p>
                  <ul className="space-y-1.5">
                    {examples.map((example, idx) => (
                      <li key={idx} className="text-xs text-gray-600 flex items-start gap-2">
                        <span className="text-blue-500 shrink-0">•</span>
                        <span>{example}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* 小箭頭（桌面版） */}
            <div className="hidden sm:block absolute -top-2 left-4 w-4 h-4 bg-white border-l border-t border-gray-200 transform rotate-45" />
          </div>
        </>
      )}
    </div>
  );
}
