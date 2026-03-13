// Step1ne 顧問評估雷達圖 — 純 SVG，零依賴
import React from 'react';
import { Candidate, ConsultantEvaluation } from '../types';

// ═══════════════════════════════════════════════════════════════
// 5 維度定義
// ═══════════════════════════════════════════════════════════════

export interface RadarDimension {
  key: keyof ConsultantEvaluation;
  label: string;
  shortLabel: string;
  auto: boolean;        // true = 系統自動預填，false = 顧問手動
  description: string;
}

export const RADAR_DIMENSIONS: RadarDimension[] = [
  { key: 'technicalDepth', label: '技術深度', shortLabel: '技術', auto: true, description: '技能 vs 職缺需求命中率 + 年資' },
  { key: 'stability',      label: '穩定度',   shortLabel: '穩定', auto: true, description: '穩定性評分（轉職次數、平均任期）' },
  { key: 'industryMatch',  label: '產業匹配', shortLabel: '產業', auto: true, description: '人選產業 vs 職缺產業背景' },
  { key: 'communication',  label: '溝通能力', shortLabel: '溝通', auto: false, description: '面談後由顧問評估' },
  { key: 'personality',    label: '個性/態度', shortLabel: '態度', auto: false, description: '面談後由顧問評估' },
];

// ═══════════════════════════════════════════════════════════════
// 自動評分邏輯
// ═══════════════════════════════════════════════════════════════

interface AutoScoreContext {
  candidate: Candidate;
  targetJob?: {
    key_skills?: string;
    industry_background?: string;
    experience_required?: string;
  } | null;
}

/** 技術深度自動評分：skills 命中率 × 0.6 + 年資匹配 × 0.4 → 1-5 */
function scoreTechnicalDepth(ctx: AutoScoreContext): number {
  const { candidate, targetJob } = ctx;

  // 技能命中率
  let skillScore = 3; // default 中等
  if (targetJob?.key_skills && candidate.skills) {
    const jobSkills = targetJob.key_skills.toLowerCase().split(/[,、;]+/).map(s => s.trim()).filter(Boolean);
    const candSkills = (Array.isArray(candidate.skills) ? candidate.skills : candidate.skills.split(/[,、;]+/))
      .map(s => s.toLowerCase().trim()).filter(Boolean);

    if (jobSkills.length > 0) {
      const matched = jobSkills.filter(js =>
        candSkills.some(cs => cs.includes(js) || js.includes(cs))
      ).length;
      const rate = matched / jobSkills.length;
      skillScore = rate >= 0.8 ? 5 : rate >= 0.6 ? 4 : rate >= 0.4 ? 3 : rate >= 0.2 ? 2 : 1;
    }
  } else if (candidate.skills) {
    // 沒有目標職缺時，依技能數量給分
    const count = (Array.isArray(candidate.skills) ? candidate.skills : candidate.skills.split(/[,、;]+/)).filter(Boolean).length;
    skillScore = count >= 8 ? 5 : count >= 5 ? 4 : count >= 3 ? 3 : count >= 1 ? 2 : 1;
  }

  // 年資匹配
  let yearScore = 3;
  const years = candidate.years || 0;
  if (targetJob?.experience_required) {
    const reqMatch = targetJob.experience_required.match(/(\d+)/);
    const reqYears = reqMatch ? parseInt(reqMatch[1]) : 0;
    if (reqYears > 0) {
      const ratio = years / reqYears;
      yearScore = ratio >= 1.2 ? 5 : ratio >= 1.0 ? 4 : ratio >= 0.7 ? 3 : ratio >= 0.5 ? 2 : 1;
    }
  } else {
    yearScore = years >= 10 ? 5 : years >= 7 ? 4 : years >= 4 ? 3 : years >= 2 ? 2 : 1;
  }

  return Math.round(skillScore * 0.6 + yearScore * 0.4);
}

/** 穩定度自動評分：stabilityScore (20-100) → 1-5 */
function scoreStability(ctx: AutoScoreContext): number {
  const s = ctx.candidate.stabilityScore || 0;
  if (s >= 80) return 5;
  if (s >= 65) return 4;
  if (s >= 50) return 3;
  if (s >= 35) return 2;
  return 1;
}

/** 產業匹配自動評分：candidate.industry vs job.industry_background */
function scoreIndustryMatch(ctx: AutoScoreContext): number {
  const { candidate, targetJob } = ctx;
  const candIndustry = (candidate.industry || '').toLowerCase().trim();
  const jobIndustry = (targetJob?.industry_background || '').toLowerCase().trim();

  if (!candIndustry || !jobIndustry) return 3; // 資料不足，給中等

  // 完全包含
  if (jobIndustry.includes(candIndustry) || candIndustry.includes(jobIndustry)) return 5;

  // 關鍵字交叉比對
  const candWords = candIndustry.split(/[/、,\s]+/).filter(Boolean);
  const jobWords = jobIndustry.split(/[/、,\s]+/).filter(Boolean);
  const matched = candWords.filter(cw => jobWords.some(jw => cw.includes(jw) || jw.includes(cw))).length;

  if (matched >= 2) return 4;
  if (matched >= 1) return 3;
  return 2;
}

/** 計算所有自動維度的預填分數 */
export function computeAutoScores(ctx: AutoScoreContext): Partial<ConsultantEvaluation> {
  return {
    technicalDepth: scoreTechnicalDepth(ctx),
    stability: scoreStability(ctx),
    industryMatch: scoreIndustryMatch(ctx),
  };
}

/** 計算總評（所有已填維度的平均，四捨五入） */
export function computeOverallRating(eval_: ConsultantEvaluation): number {
  const scores = RADAR_DIMENSIONS
    .map(d => eval_[d.key] as number | undefined)
    .filter((v): v is number => typeof v === 'number' && v > 0);
  if (scores.length === 0) return 0;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

// ═══════════════════════════════════════════════════════════════
// RadarChart SVG Component
// ═══════════════════════════════════════════════════════════════

interface RadarChartProps {
  evaluation: ConsultantEvaluation;
  size?: number;          // SVG 尺寸 (default: 200)
  showLabels?: boolean;   // 顯示維度標籤 (default: true)
  className?: string;
}

export const RadarChart: React.FC<RadarChartProps> = ({
  evaluation,
  size = 200,
  showLabels = true,
  className = '',
}) => {
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * 0.38; // 最大半徑
  const labelR = size * 0.48; // 標籤半徑
  const dims = RADAR_DIMENSIONS;
  const n = dims.length;
  const angleStep = (Math.PI * 2) / n;
  const startAngle = -Math.PI / 2; // 從正上方開始

  // 計算座標
  const getPoint = (angle: number, radius: number) => ({
    x: cx + Math.cos(angle) * radius,
    y: cy + Math.sin(angle) * radius,
  });

  // 網格線（5 層）
  const gridLevels = [1, 2, 3, 4, 5];
  const gridPaths = gridLevels.map(level => {
    const r = (level / 5) * maxR;
    const points = Array.from({ length: n }, (_, i) => {
      const p = getPoint(startAngle + i * angleStep, r);
      return `${p.x},${p.y}`;
    });
    return `M${points.join('L')}Z`;
  });

  // 軸線
  const axisLines = Array.from({ length: n }, (_, i) => {
    const p = getPoint(startAngle + i * angleStep, maxR);
    return { x1: cx, y1: cy, x2: p.x, y2: p.y };
  });

  // 數據多邊形
  const dataPoints = dims.map((d, i) => {
    const value = (evaluation[d.key] as number) || 0;
    const r = (Math.max(0, Math.min(5, value)) / 5) * maxR;
    return getPoint(startAngle + i * angleStep, r);
  });
  const dataPath = `M${dataPoints.map(p => `${p.x},${p.y}`).join('L')}Z`;

  // 標籤位置
  const labels = dims.map((d, i) => {
    const p = getPoint(startAngle + i * angleStep, labelR);
    const value = (evaluation[d.key] as number) || 0;
    return { ...d, ...p, value };
  });

  // 是否有缺少手動維度
  const missingManual = dims.filter(d => !d.auto && !evaluation[d.key]);

  return (
    <div className={`inline-flex flex-col items-center ${className}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* 網格 */}
        {gridPaths.map((path, i) => (
          <path
            key={i}
            d={path}
            fill="none"
            stroke={i === 4 ? '#cbd5e1' : '#e2e8f0'}
            strokeWidth={i === 4 ? 1.5 : 0.8}
          />
        ))}

        {/* 軸線 */}
        {axisLines.map((line, i) => (
          <line
            key={i}
            {...line}
            stroke="#e2e8f0"
            strokeWidth={0.8}
          />
        ))}

        {/* 數據多邊形 */}
        <path
          d={dataPath}
          fill="rgba(16, 185, 129, 0.2)"
          stroke="#10b981"
          strokeWidth={2}
        />

        {/* 數據點 */}
        {dataPoints.map((p, i) => {
          const dim = dims[i];
          const value = (evaluation[dim.key] as number) || 0;
          const isMissing = !dim.auto && value === 0;
          return (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={isMissing ? 4 : 3.5}
              fill={isMissing ? '#f59e0b' : '#10b981'}
              stroke="#fff"
              strokeWidth={1.5}
            />
          );
        })}

        {/* 標籤 */}
        {showLabels && labels.map((l, i) => (
          <text
            key={i}
            x={l.x}
            y={l.y}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={size >= 180 ? 10 : 8}
            fontWeight={600}
            fill={!l.auto && l.value === 0 ? '#f59e0b' : '#64748b'}
          >
            {l.shortLabel}
            {l.value > 0 && (
              <tspan fontSize={size >= 180 ? 9 : 7} fill="#10b981"> {l.value}</tspan>
            )}
            {!l.auto && l.value === 0 && (
              <tspan fontSize={7} fill="#f59e0b"> !</tspan>
            )}
          </text>
        ))}
      </svg>

      {/* 手動維度缺填提醒 */}
      {missingManual.length > 0 && (
        <div className="mt-1 flex items-center gap-1 px-2 py-1 bg-amber-50 border border-amber-200 rounded-md">
          <span className="text-amber-500 text-xs font-bold">!</span>
          <span className="text-[10px] text-amber-700">
            面談後請填：{missingManual.map(d => d.label).join('、')}
          </span>
        </div>
      )}
    </div>
  );
};

/** 迷你版雷達圖（用於列表/卡片） */
export const MiniRadarChart: React.FC<{ evaluation: ConsultantEvaluation; size?: number }> = ({
  evaluation,
  size = 48,
}) => <RadarChart evaluation={evaluation} size={size} showLabels={false} />;
