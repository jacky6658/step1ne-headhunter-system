import React from 'react';
import { Candidate } from '../types';
import { GRADE_CONFIG, TIER_CONFIG, HEAT_CONFIG, computeHeatLevel } from '../constants';
import { Briefcase, Clock, AlertTriangle, ShieldCheck, Zap } from 'lucide-react';

interface TalentCardProps {
  candidate: Candidate;
  onClick: (c: Candidate) => void;
}

export function TalentCard({ candidate, onClick }: TalentCardProps) {
  const c = candidate as any;
  const grade = (c.gradeLevel || c.grade_level) as string | undefined;
  const tier = (c.sourceTier || c.source_tier) as string | undefined;
  const heat = computeHeatLevel(c);

  const gradeConf = grade ? GRADE_CONFIG[grade] : null;
  const tierConf = tier ? TIER_CONFIG[tier] : null;
  const heatConf = HEAT_CONFIG[heat] || HEAT_CONFIG.Cold;

  // Skills: prefer normalizedSkills/normalized_skills, fallback to skills string
  const rawSkills = c.normalizedSkills || c.normalized_skills;
  const skills: string[] = Array.isArray(rawSkills)
    ? rawSkills
    : typeof c.skills === 'string'
      ? c.skills.split(/[,，、|]+/).map((s: string) => s.trim()).filter(Boolean)
      : [];
  const topSkills = skills.slice(0, 3);

  // Salary display (支援 camelCase + snake_case)
  const salaryText = (() => {
    const min = c.expectedSalaryMin || c.expected_salary_min || c.currentSalaryMin || c.current_salary_min;
    const max = c.expectedSalaryMax || c.expected_salary_max || c.currentSalaryMax || c.current_salary_max;
    if (!min && !max) return null;
    const cur = c.salaryCurrency || c.salary_currency || 'TWD';
    const per = (c.salaryPeriod || c.salary_period) === 'annual' ? '/Y' : '/M';
    const fmt = (v: number) => v >= 1000 ? `${Math.round(v / 1000)}K` : String(v);
    return `${min ? fmt(min) : '?'}~${max ? fmt(max) : '?'} ${cur}${per}`;
  })();

  // Last contact
  const lastContact = c.lastContactAt || c.updatedAt;
  const daysAgo = lastContact
    ? Math.floor((Date.now() - new Date(lastContact).getTime()) / 86400000)
    : null;

  // Data quality & Precision Pool
  const isPrecision = c.precisionEligible === true || c.precision_eligible === true;
  const qualityScore = c.data_quality?.completenessScore ?? c.dataQuality?.completenessScore ?? null;
  const missingCount = c.data_quality?.missingCoreFields?.length ?? c.dataQuality?.missingCoreFields?.length ?? 0;
  const isAlmostReady = !isPrecision && qualityScore !== null && qualityScore >= 60 && qualityScore < 80;

  return (
    <div
      onClick={() => onClick(candidate)}
      className="bg-white rounded-xl border border-gray-200 p-3.5 cursor-pointer
        hover:shadow-md hover:border-blue-300 transition-all duration-200 group"
    >
      {/* Header: Name + Badges */}
      <div className="flex items-start justify-between mb-2">
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-bold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
            {c.name}
          </h4>
          <p className="text-xs text-gray-500 truncate mt-0.5">
            {c.current_title || c.position || '—'}
          </p>
        </div>
        <div className="flex items-center gap-1 ml-2 shrink-0">
          {gradeConf && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${gradeConf.bg} ${gradeConf.color} ${gradeConf.border} border`}>
              {grade}
            </span>
          )}
          <span className={`w-2 h-2 rounded-full ${heatConf.dot} shrink-0`} title={heatConf.label} />
        </div>
      </div>

      {/* Company */}
      {(c.current_company || c.workHistory?.[0]?.company) && (
        <div className="flex items-center gap-1 text-xs text-gray-500 mb-1.5">
          <Briefcase size={11} className="shrink-0" />
          <span className="truncate">{c.current_company || c.workHistory[0].company}</span>
        </div>
      )}

      {/* Skills */}
      {topSkills.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {topSkills.map((s) => (
            <span key={s} className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded font-medium">
              {s}
            </span>
          ))}
          {skills.length > 3 && (
            <span className="text-[10px] px-1 py-0.5 text-gray-400">+{skills.length - 3}</span>
          )}
        </div>
      )}

      {/* Footer: Salary + Tier + Contact */}
      <div className="flex items-center justify-between text-[10px] text-gray-400 mt-1 pt-1.5 border-t border-gray-100">
        <div className="flex items-center gap-2">
          {salaryText && <span className="font-medium text-gray-600">{salaryText}</span>}
          {tierConf && (
            <span className={`font-bold px-1 py-0.5 rounded ${tierConf.bg} ${tierConf.color}`}>
              {tier}
            </span>
          )}
        </div>
        {daysAgo !== null && (
          <div className="flex items-center gap-0.5" title="最後更新">
            <Clock size={10} />
            <span>{daysAgo === 0 ? '今天' : `${daysAgo}天前`}</span>
          </div>
        )}
      </div>

      {/* Consultant + Precision / Quality */}
      <div className="flex items-center justify-between mt-1">
        {c.consultant && (
          <span className="text-[10px] text-gray-400 truncate">
            {c.consultant}
          </span>
        )}
        {isPrecision ? (
          <span className="flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200" title="已進入精準匹配池">
            <ShieldCheck size={10} />
            Precision
          </span>
        ) : isAlmostReady ? (
          <span className="flex items-center gap-0.5 text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 animate-pulse" title={`差 ${missingCount} 個欄位即可進入 Precision Pool（${qualityScore}%）`}>
            <Zap size={10} />
            即將達標 {qualityScore}%
          </span>
        ) : qualityScore !== null ? (
          <span className="flex items-center gap-0.5 text-[10px] text-gray-400" title={`資料完整度 ${qualityScore}%，缺少 ${missingCount} 個核心欄位`}>
            <AlertTriangle size={10} className={qualityScore < 40 ? 'text-red-400' : 'text-amber-500'} />
            {qualityScore}%
          </span>
        ) : null}
      </div>
    </div>
  );
}
