import React from 'react';
import { X } from 'lucide-react';
import type { ScoreBreakdown } from '../../crawlerTypes';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  candidateName: string;
  detail: ScoreBreakdown | null;
  loading: boolean;
}

const GRADE_COLORS: Record<string, string> = {
  A: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  B: 'bg-blue-100 text-blue-700 border-blue-300',
  C: 'bg-amber-100 text-amber-700 border-amber-300',
  D: 'bg-red-100 text-red-700 border-red-300',
};

const GRADE_LABELS: Record<string, string> = {
  A: '強推薦', B: '推薦', C: '待評估', D: '不推薦',
};

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-500 w-10 text-right">{pct}%</span>
    </div>
  );
}

function SkillTags({ matched, missing }: { matched: string[]; missing: string[] }) {
  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {matched.map(s => (
        <span key={s} className="text-[10px] px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
          {s}
        </span>
      ))}
      {missing.map(s => (
        <span key={s} className="text-[10px] px-1.5 py-0.5 bg-red-50 text-red-500 border border-red-200 rounded line-through">
          {s}
        </span>
      ))}
    </div>
  );
}

export const ScoreDetailModal: React.FC<Props> = ({ isOpen, onClose, candidateName, detail, loading }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-slate-900">技能評分細項</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
            </div>
          ) : detail ? (
            <>
              {/* 總覽 */}
              <div className="flex items-center justify-between bg-slate-50 rounded-xl p-4">
                <div>
                  <p className="text-sm text-slate-500">候選人</p>
                  <p className="font-bold text-slate-900">{candidateName}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm text-slate-500">總分</p>
                    <p className="text-2xl font-black text-slate-900">{detail.total_score}<span className="text-sm text-slate-400">/100</span></p>
                  </div>
                  <span className={`px-3 py-1.5 rounded-lg text-sm font-bold border ${GRADE_COLORS[detail.grade] || 'bg-slate-100 text-slate-600'}`}>
                    {detail.grade} {GRADE_LABELS[detail.grade] || ''}
                  </span>
                </div>
              </div>

              {/* 各項技能 */}
              {detail.breakdown && (
                <div className="space-y-3">
                  {/* Must Have */}
                  {detail.breakdown.must_have && detail.breakdown.must_have.max > 0 && (
                    <div className="bg-white border border-gray-100 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-slate-700">必備技能</span>
                        <span className="text-xs text-slate-400">{detail.breakdown.must_have.score}/{detail.breakdown.must_have.max}</span>
                      </div>
                      <ProgressBar value={detail.breakdown.must_have.score} max={detail.breakdown.must_have.max} color="bg-emerald-500" />
                      <SkillTags matched={detail.breakdown.must_have.matched} missing={detail.breakdown.must_have.missing} />
                    </div>
                  )}

                  {/* Core */}
                  {detail.breakdown.core && detail.breakdown.core.max > 0 && (
                    <div className="bg-white border border-gray-100 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-slate-700">核心技能</span>
                        <span className="text-xs text-slate-400">{detail.breakdown.core.score}/{detail.breakdown.core.max}</span>
                      </div>
                      <ProgressBar value={detail.breakdown.core.score} max={detail.breakdown.core.max} color="bg-blue-500" />
                      <SkillTags matched={detail.breakdown.core.matched} missing={detail.breakdown.core.missing} />
                    </div>
                  )}

                  {/* Nice to Have */}
                  {detail.breakdown.nice_to_have && detail.breakdown.nice_to_have.max > 0 && (
                    <div className="bg-white border border-gray-100 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-slate-700">加分技能</span>
                        <span className="text-xs text-slate-400">{detail.breakdown.nice_to_have.score}/{detail.breakdown.nice_to_have.max}</span>
                      </div>
                      <ProgressBar value={detail.breakdown.nice_to_have.score} max={detail.breakdown.nice_to_have.max} color="bg-violet-500" />
                      <SkillTags matched={detail.breakdown.nice_to_have.matched} missing={detail.breakdown.nice_to_have.missing} />
                    </div>
                  )}

                  {/* Context */}
                  {detail.breakdown.context && detail.breakdown.context.max > 0 && (
                    <div className="bg-white border border-gray-100 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-slate-700">產業場景</span>
                        <span className="text-xs text-slate-400">{detail.breakdown.context.score}/{detail.breakdown.context.max}</span>
                      </div>
                      <ProgressBar value={detail.breakdown.context.score} max={detail.breakdown.context.max} color="bg-amber-500" />
                      <SkillTags matched={detail.breakdown.context.matched} missing={detail.breakdown.context.missing} />
                    </div>
                  )}

                  {/* GitHub Bonus */}
                  {detail.breakdown.github_bonus > 0 && (
                    <div className="flex items-center justify-between bg-slate-50 rounded-xl p-3">
                      <span className="text-xs font-bold text-slate-700">GitHub 加分</span>
                      <span className="text-sm font-bold text-indigo-600">+{detail.breakdown.github_bonus}</span>
                    </div>
                  )}
                </div>
              )}

              {/* 底部摘要 */}
              <div className="bg-slate-50 rounded-xl p-3 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">技能匹配率</span>
                  <span className="font-bold text-slate-700">{Math.round((detail.skill_match_rate || 0) * 100)}%</span>
                </div>
                {detail.matched_skills && detail.matched_skills.length > 0 && (
                  <div>
                    <span className="text-xs text-slate-500">匹配技能：</span>
                    <span className="text-xs text-emerald-600">{detail.matched_skills.join(', ')}</span>
                  </div>
                )}
                {detail.missing_critical && detail.missing_critical.length > 0 && (
                  <div>
                    <span className="text-xs text-slate-500">缺少必備：</span>
                    <span className="text-xs text-red-500">{detail.missing_critical.join(', ')}</span>
                  </div>
                )}
                {detail.constraints_pass !== undefined && (
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">限制條件</span>
                    <span className={detail.constraints_pass ? 'text-emerald-600' : 'text-red-500'}>
                      {detail.constraints_pass ? '通過' : '未通過'}
                      {detail.constraint_flags?.length > 0 && ` (${detail.constraint_flags.join(', ')})`}
                    </span>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-center text-slate-400 py-8">無法載入評分資料</div>
          )}
        </div>

        <div className="px-6 py-3 border-t border-gray-100 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200">
            關閉
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScoreDetailModal;
