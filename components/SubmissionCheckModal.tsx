// 送件規範檢查結果彈窗（下載匿名履歷前自動檢查）
import React from 'react';
import { Candidate, SubmissionRule, SubmissionCheckResult } from '../types';
import { X, CheckCircle, XCircle, AlertTriangle, ArrowLeft, Download } from 'lucide-react';

interface SubmissionCheckModalProps {
  companyName: string;
  results: SubmissionCheckResult[];
  failCount: number;
  onClose: () => void;        // 返回補資料
  onForceDownload: () => void; // 強制下載
}

// 前端即時檢查引擎（不需 API round-trip）
export function evaluateRulesLocally(candidate: Candidate, rules: SubmissionRule[]): SubmissionCheckResult[] {
  const fieldMap: Record<string, keyof Candidate> = {
    expected_salary: 'expectedSalary',
    current_salary: 'currentSalary',
    english_name: 'englishName',
    resume_link: 'resumeLink',
    github_url: 'githubUrl',
    linkedin_url: 'linkedinUrl',
    name: 'name',
    languages: 'languages',
    certifications: 'certifications',
  };

  return rules.filter(r => r.enabled).map(rule => {
    if (!rule.is_auto_checkable) {
      return { rule_id: rule.id, label: rule.label, passed: null, message: '需人工確認', type: 'manual' as const };
    }

    let passed = true;
    let message = '';

    switch (rule.rule_type) {
      case 'field_required': {
        const key = fieldMap[rule.field_key || ''] || rule.field_key as keyof Candidate;
        const val = candidate[key];
        passed = !!val && String(val).trim() !== '';
        message = passed ? '已填寫' : '尚未填寫';
        break;
      }
      case 'content_format':
        if (rule.check_config?.format === 'chinese_name') {
          passed = /[\u4e00-\u9fff]/.test(candidate.name || '');
          message = passed ? '已使用中文姓名' : '姓名未包含中文';
        }
        break;
      case 'link_required': {
        const linkKey = fieldMap[rule.check_config?.link_type || rule.field_key || ''] || rule.field_key as keyof Candidate;
        const linkVal = candidate[linkKey];
        passed = !!linkVal && String(linkVal).trim() !== '';
        message = passed ? '已提供連結' : '尚未提供';
        break;
      }
      case 'resume_version':
        return { rule_id: rule.id, label: rule.label, passed: null, message: '需確認是否已生成英文版', type: 'manual' as const };
      default:
        return { rule_id: rule.id, label: rule.label, passed: null, message: '需人工確認', type: 'manual' as const };
    }

    return { rule_id: rule.id, label: rule.label, passed, message, type: 'auto' as const };
  });
}

export function SubmissionCheckModal({ companyName, results, failCount, onClose, onForceDownload }: SubmissionCheckModalProps) {
  const manualCount = results.filter(r => r.passed === null).length;
  const passCount = results.filter(r => r.passed === true).length;

  return (
    <div
      className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-700 to-slate-800 text-white p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">🔍</span>
              <h3 className="text-base font-bold">送件檢查結果</h3>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-sm text-slate-300 mt-1">{companyName}</p>
        </div>

        {/* Results List */}
        <div className="p-4 space-y-2 max-h-[50vh] overflow-y-auto">
          {results.map((result, i) => (
            <div
              key={result.rule_id}
              className={`flex items-center gap-3 p-3 rounded-lg border ${
                result.passed === true
                  ? 'bg-green-50 border-green-200'
                  : result.passed === false
                    ? 'bg-red-50 border-red-200'
                    : 'bg-amber-50 border-amber-200'
              }`}
            >
              {/* Icon */}
              {result.passed === true && <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />}
              {result.passed === false && <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />}
              {result.passed === null && <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />}

              {/* Text */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${
                  result.passed === true ? 'text-green-800' : result.passed === false ? 'text-red-800' : 'text-amber-800'
                }`}>
                  {result.label}
                </p>
                <p className={`text-xs mt-0.5 ${
                  result.passed === true ? 'text-green-600' : result.passed === false ? 'text-red-600' : 'text-amber-600'
                }`}>
                  {result.message}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Summary + Actions */}
        <div className="border-t border-slate-200 p-4">
          {/* Stats */}
          <div className="flex items-center justify-center gap-4 mb-4 text-sm">
            {passCount > 0 && (
              <span className="flex items-center gap-1 text-green-700">
                <CheckCircle className="w-4 h-4" /> {passCount} 通過
              </span>
            )}
            {failCount > 0 && (
              <span className="flex items-center gap-1 text-red-700 font-bold">
                <XCircle className="w-4 h-4" /> {failCount} 未通過
              </span>
            )}
            {manualCount > 0 && (
              <span className="flex items-center gap-1 text-amber-600">
                <AlertTriangle className="w-4 h-4" /> {manualCount} 需確認
              </span>
            )}
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              返回補資料
            </button>
            <button
              onClick={onForceDownload}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              {failCount > 0 ? '強制下載' : '確認下載'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
