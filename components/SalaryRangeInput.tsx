// SalaryRangeInput — structured min/max + currency + period input
import React from 'react';

interface SalaryRangeInputProps {
  label: string;
  min: string;
  max: string;
  currency: string;
  period: string;
  onMinChange: (v: string) => void;
  onMaxChange: (v: string) => void;
  onCurrencyChange: (v: string) => void;
  onPeriodChange: (v: string) => void;
  disabled?: boolean;
}

export function SalaryRangeInput({
  label, min, max, currency, period,
  onMinChange, onMaxChange, onCurrencyChange, onPeriodChange,
  disabled,
}: SalaryRangeInputProps) {
  const inputCls = 'w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white';

  return (
    <div className="space-y-1.5">
      <label className="block text-xs text-gray-500">{label}</label>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          value={min}
          onChange={e => onMinChange(e.target.value)}
          placeholder="Min"
          min="0"
          disabled={disabled}
          className={`${inputCls} flex-1`}
        />
        <span className="text-gray-400 text-xs">~</span>
        <input
          type="number"
          value={max}
          onChange={e => onMaxChange(e.target.value)}
          placeholder="Max"
          min="0"
          disabled={disabled}
          className={`${inputCls} flex-1`}
        />
        <select
          value={currency}
          onChange={e => onCurrencyChange(e.target.value)}
          disabled={disabled}
          className={`${inputCls} w-20`}
        >
          <option value="TWD">TWD</option>
          <option value="USD">USD</option>
          <option value="CNY">CNY</option>
          <option value="JPY">JPY</option>
          <option value="SGD">SGD</option>
        </select>
        <select
          value={period}
          onChange={e => onPeriodChange(e.target.value)}
          disabled={disabled}
          className={`${inputCls} w-20`}
        >
          <option value="monthly">/月</option>
          <option value="annual">/年</option>
        </select>
      </div>
    </div>
  );
}

// Display-only salary range
export function SalaryRangeDisplay({ min, max, currency, period }: {
  min?: number; max?: number; currency?: string; period?: string;
}) {
  if (!min && !max) return <span className="text-sm font-medium text-gray-400">—</span>;
  const cur = currency || 'TWD';
  const per = period === 'annual' ? '/年' : '/月';
  const fmt = (v?: number) => v ? v.toLocaleString() : '?';
  return (
    <span className="text-sm font-medium text-gray-800">
      {fmt(min)} ~ {fmt(max)} {cur}{per}
    </span>
  );
}
