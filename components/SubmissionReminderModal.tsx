// 送件提醒彈窗（推薦候選人給客戶時，提醒顧問注意事項）
import React, { useState } from 'react';
import { SubmissionRule } from '../types';
import { X, AlertTriangle, CheckSquare, Square } from 'lucide-react';

interface SubmissionReminderModalProps {
  companyName: string;
  rules: SubmissionRule[];
  onConfirm: () => void;   // 全部確認後繼續送件
  onCancel: () => void;
}

export function SubmissionReminderModal({ companyName, rules, onConfirm, onCancel }: SubmissionReminderModalProps) {
  const enabledRules = rules.filter(r => r.enabled);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const toggleCheck = (ruleId: string) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(ruleId)) next.delete(ruleId);
      else next.add(ruleId);
      return next;
    });
  };

  const allChecked = enabledRules.every(r => checked.has(r.id));

  return (
    <div
      className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-base font-bold">{companyName} 送件注意事項</h3>
            </div>
            <button onClick={onCancel} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-sm text-amber-100 mt-1">請確認以下事項後再進行送件</p>
        </div>

        {/* Checklist */}
        <div className="p-4 space-y-2 max-h-[50vh] overflow-y-auto">
          {enabledRules.map(rule => (
            <button
              key={rule.id}
              onClick={() => toggleCheck(rule.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                checked.has(rule.id)
                  ? 'bg-green-50 border-green-200'
                  : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              {checked.has(rule.id) ? (
                <CheckSquare className="w-5 h-5 text-green-600 flex-shrink-0" />
              ) : (
                <Square className="w-5 h-5 text-slate-300 flex-shrink-0" />
              )}
              <span className={`text-sm ${checked.has(rule.id) ? 'text-green-800' : 'text-slate-700'}`}>
                {rule.label}
              </span>
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="border-t border-slate-200 p-4 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            disabled={!allChecked}
            className={`flex-1 px-4 py-2.5 text-sm font-bold rounded-xl transition-colors ${
              allChecked
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            確認已知悉，繼續送件
          </button>
        </div>
      </div>
    </div>
  );
}
