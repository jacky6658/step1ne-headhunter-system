// 客戶送件規範編輯器
import React, { useState } from 'react';
import { SubmissionRule } from '../types';
import { SUBMISSION_RULE_PRESETS } from '../constants';
import { Plus, Trash2, GripVertical, ChevronDown, ToggleLeft, ToggleRight } from 'lucide-react';

interface SubmissionRulesEditorProps {
  clientId: string;
  rules: SubmissionRule[];
  onSave: (rules: SubmissionRule[]) => Promise<void>;
}

function generateId() {
  return `rule_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function SubmissionRulesEditor({ clientId, rules, onSave }: SubmissionRulesEditorProps) {
  const [localRules, setLocalRules] = useState<SubmissionRule[]>(rules);
  const [saving, setSaving] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [customLabel, setCustomLabel] = useState('');
  const [dirty, setDirty] = useState(false);

  const updateRules = (newRules: SubmissionRule[]) => {
    setLocalRules(newRules);
    setDirty(true);
  };

  const addFromPreset = (preset: Omit<SubmissionRule, 'id' | 'sort_order'>) => {
    const newRule: SubmissionRule = {
      ...preset,
      id: generateId(),
      sort_order: localRules.length,
    };
    updateRules([...localRules, newRule]);
    setShowPresets(false);
  };

  const addCustomRule = () => {
    if (!customLabel.trim()) return;
    const newRule: SubmissionRule = {
      id: generateId(),
      rule_type: 'custom',
      label: customLabel.trim(),
      is_auto_checkable: false,
      enabled: true,
      sort_order: localRules.length,
    };
    updateRules([...localRules, newRule]);
    setCustomLabel('');
  };

  const removeRule = (id: string) => {
    updateRules(localRules.filter(r => r.id !== id).map((r, i) => ({ ...r, sort_order: i })));
  };

  const toggleEnabled = (id: string) => {
    updateRules(localRules.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
  };

  const moveRule = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= localRules.length) return;
    const arr = [...localRules];
    [arr[index], arr[newIndex]] = [arr[newIndex], arr[index]];
    updateRules(arr.map((r, i) => ({ ...r, sort_order: i })));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(localRules);
      setDirty(false);
    } finally {
      setSaving(false);
    }
  };

  // Filter out presets that are already added
  const availablePresets = SUBMISSION_RULE_PRESETS.filter(
    preset => !localRules.some(r => r.label === preset.label)
  );

  const ruleTypeLabel = (type: string) => {
    switch (type) {
      case 'field_required': return '欄位必填';
      case 'content_format': return '格式檢查';
      case 'resume_version': return '履歷版本';
      case 'link_required': return '連結必填';
      case 'custom': return '自訂提醒';
      default: return type;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">送件規範</h3>
          <p className="text-xs text-slate-400 mt-0.5">設定此客戶的候選人送件檢查項目，下載匿名履歷時將自動檢查</p>
        </div>
        <button
          onClick={handleSave}
          disabled={!dirty || saving}
          className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
            dirty ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
          }`}
        >
          {saving ? '儲存中...' : '儲存規範'}
        </button>
      </div>

      {/* Rules List */}
      {localRules.length === 0 ? (
        <div className="text-center py-8 text-slate-400">
          <p className="text-sm">尚未設定送件規範</p>
          <p className="text-xs mt-1">點選下方「從預設新增」開始設定</p>
        </div>
      ) : (
        <div className="space-y-2">
          {localRules.map((rule, index) => (
            <div
              key={rule.id}
              className={`flex items-center gap-2 p-3 rounded-lg border transition-colors ${
                rule.enabled
                  ? 'bg-white border-slate-200'
                  : 'bg-slate-50 border-slate-100 opacity-60'
              }`}
            >
              {/* Reorder */}
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => moveRule(index, -1)}
                  disabled={index === 0}
                  className="text-slate-300 hover:text-slate-500 disabled:opacity-30 text-xs leading-none"
                >
                  ▲
                </button>
                <button
                  onClick={() => moveRule(index, 1)}
                  disabled={index === localRules.length - 1}
                  className="text-slate-300 hover:text-slate-500 disabled:opacity-30 text-xs leading-none"
                >
                  ▼
                </button>
              </div>

              {/* Rule info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-800">{rule.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                    rule.is_auto_checkable
                      ? 'bg-green-100 text-green-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    {rule.is_auto_checkable ? '自動檢查' : '人工確認'}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400">{ruleTypeLabel(rule.rule_type)}</span>
              </div>

              {/* Toggle */}
              <button onClick={() => toggleEnabled(rule.id)} className="flex-shrink-0">
                {rule.enabled ? (
                  <ToggleRight className="w-6 h-6 text-indigo-500" />
                ) : (
                  <ToggleLeft className="w-6 h-6 text-slate-300" />
                )}
              </button>

              {/* Delete */}
              <button
                onClick={() => removeRule(rule.id)}
                className="flex-shrink-0 p-1 text-slate-300 hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add buttons */}
      <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
        {/* Presets dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowPresets(!showPresets)}
            disabled={availablePresets.length === 0}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            從預設新增
            <ChevronDown className={`w-4 h-4 transition-transform ${showPresets ? 'rotate-180' : ''}`} />
          </button>
          {showPresets && availablePresets.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
              {availablePresets.map((preset, i) => (
                <button
                  key={i}
                  onClick={() => addFromPreset(preset)}
                  className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-indigo-50 transition-colors flex items-center justify-between"
                >
                  <span>{preset.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    preset.is_auto_checkable ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {preset.is_auto_checkable ? '自動' : '人工'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Custom rule input */}
        <div className="flex gap-2">
          <input
            value={customLabel}
            onChange={e => setCustomLabel(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addCustomRule()}
            placeholder="輸入自訂規範（僅提醒用）..."
            className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          <button
            onClick={addCustomRule}
            disabled={!customLabel.trim()}
            className="px-3 py-2 text-sm font-medium text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            新增自訂
          </button>
        </div>
      </div>
    </div>
  );
}
