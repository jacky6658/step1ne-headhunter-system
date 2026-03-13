/**
 * Toast.tsx - 全域 Toast 通知元件
 *
 * 使用方式：
 *   import { toast } from './components/Toast';
 *   toast.success('操作成功');
 *   toast.error('操作失敗');
 *   toast.warning('注意');
 *   toast.info('提示訊息');
 *
 * 在 App.tsx 根層加入 <ToastContainer /> 即可。
 *
 * 實作原理：
 *   使用 CustomEvent 廣播機制，避免 Vite HMR / React StrictMode
 *   導致的 closure 捕獲到幽靈實例的問題。
 */
import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
  leaving?: boolean;
}

type ToastPayload = { type: ToastType; message: string };

// ── CustomEvent 名稱（全域唯一）──
const EVENT_NAME = '__step1ne_toast__';
let idCounter = 0;

/** 全域 toast 呼叫介面 — 可在任何元件中直接 import 使用 */
export const toast = {
  success: (msg: string) => window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { type: 'success', message: msg } })),
  error:   (msg: string) => window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { type: 'error',   message: msg } })),
  warning: (msg: string) => window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { type: 'warning', message: msg } })),
  info:    (msg: string) => window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { type: 'info',    message: msg } })),
};

// ── 樣式配置 ──
const STYLES: Record<ToastType, { bg: string; border: string; text: string; Icon: typeof CheckCircle2 }> = {
  success: { bg: 'bg-emerald-50',  border: 'border-emerald-200', text: 'text-emerald-800', Icon: CheckCircle2 },
  error:   { bg: 'bg-red-50',      border: 'border-red-200',     text: 'text-red-800',     Icon: XCircle },
  warning: { bg: 'bg-amber-50',    border: 'border-amber-200',   text: 'text-amber-800',   Icon: AlertTriangle },
  info:    { bg: 'bg-blue-50',     border: 'border-blue-200',    text: 'text-blue-800',    Icon: Info },
};

const DURATION = 4000; // 自動消失時間（ms）

/** 放在 App.tsx 根層，負責渲染所有 Toast 通知 */
export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handler = (e: Event) => {
      const { type, message } = (e as CustomEvent<ToastPayload>).detail;
      const id = ++idCounter;
      setToasts(prev => [...prev, { type, message, id }]);
      // 自動消失：先觸發退場動畫，再移除
      setTimeout(() => {
        setToasts(prev => prev.map(tt => tt.id === id ? { ...tt, leaving: true } : tt));
        setTimeout(() => {
          setToasts(prev => prev.filter(tt => tt.id !== id));
        }, 300);
      }, DURATION);
    };
    window.addEventListener(EVENT_NAME, handler);
    return () => window.removeEventListener(EVENT_NAME, handler);
  }, []);

  // 手動關閉
  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.map(tt => tt.id === id ? { ...tt, leaving: true } : tt));
    setTimeout(() => {
      setToasts(prev => prev.filter(tt => tt.id !== id));
    }, 300);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none max-w-sm w-full">
      {toasts.map(t => {
        const s = STYLES[t.type];
        return (
          <div
            key={t.id}
            className={`
              pointer-events-auto flex items-start gap-2.5 px-4 py-3 rounded-xl border shadow-lg
              ${s.bg} ${s.border} ${s.text}
              ${t.leaving ? 'animate-toast-out' : 'animate-toast-in'}
            `}
          >
            <s.Icon size={18} className="shrink-0 mt-0.5" />
            <p className="text-sm font-medium flex-1 whitespace-pre-line leading-relaxed">{t.message}</p>
            <button
              onClick={() => dismiss(t.id)}
              className="shrink-0 p-0.5 rounded hover:bg-black/5 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default ToastContainer;
