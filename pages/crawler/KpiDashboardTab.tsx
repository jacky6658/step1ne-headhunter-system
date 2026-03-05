import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Download, TrendingUp, TrendingDown, Minus, Target } from 'lucide-react';
import { getEfficiencyMetrics, getMetricsHistory, takeMetricsSnapshot } from '../../services/crawlerService';
import type { CrawlerStats, EfficiencyData, MetricsSnapshot } from '../../crawlerTypes';

interface Props {
  stats: CrawlerStats | null;
}

// ── KPI 卡片 ──
function KpiCard({ label, value, unit, delta, color }: {
  label: string; value: string | number; unit?: string;
  delta?: number | null; color: string;
}) {
  return (
    <div className={`${color} rounded-xl p-3 sm:p-4`}>
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className="text-xl sm:text-2xl font-black text-slate-900">
        {value}{unit && <span className="text-sm text-slate-400 ml-0.5">{unit}</span>}
      </p>
      {delta !== undefined && delta !== null && (
        <div className={`flex items-center gap-0.5 mt-1 text-[10px] font-medium ${
          delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-red-500' : 'text-slate-400'
        }`}>
          {delta > 0 ? <TrendingUp size={10} /> : delta < 0 ? <TrendingDown size={10} /> : <Minus size={10} />}
          {delta > 0 ? '+' : ''}{typeof delta === 'number' ? delta.toFixed(1) : delta}{unit === '%' ? '%' : ''}
        </div>
      )}
    </div>
  );
}

// ── 漏斗圖 ──
function FunnelChart({ items }: { items: { label: string; value: number; color: string }[] }) {
  const max = Math.max(...items.map(i => i.value), 1);
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={item.label} className="flex items-center gap-2 text-xs">
          <span className="w-14 text-slate-500 text-right shrink-0 font-medium">{item.label}</span>
          <div className="flex-1 h-6 bg-slate-50 rounded-lg overflow-hidden relative">
            <div
              className={`h-full rounded-lg ${item.color} transition-all duration-500`}
              style={{ width: `${Math.max((item.value / max) * 100, 2)}%` }}
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-600">
              {item.value}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── 等級分布 ──
function GradeDistribution({ grades }: { grades: { A: number; B: number; C: number; D: number } }) {
  const total = grades.A + grades.B + grades.C + grades.D;
  const max = Math.max(grades.A, grades.B, grades.C, grades.D, 1);

  const items = [
    { grade: 'A', count: grades.A, color: 'bg-emerald-500', bgColor: 'bg-emerald-50' },
    { grade: 'B', count: grades.B, color: 'bg-blue-500', bgColor: 'bg-blue-50' },
    { grade: 'C', count: grades.C, color: 'bg-amber-500', bgColor: 'bg-amber-50' },
    { grade: 'D', count: grades.D, color: 'bg-red-500', bgColor: 'bg-red-50' },
  ];

  return (
    <div className="space-y-2">
      {items.map(item => (
        <div key={item.grade} className="flex items-center gap-2 text-xs">
          <span className="w-6 font-bold text-slate-700 text-center">{item.grade}</span>
          <div className="flex-1 h-5 bg-slate-50 rounded-lg overflow-hidden relative">
            <div
              className={`h-full rounded-lg ${item.color} transition-all duration-500`}
              style={{ width: `${(item.count / max) * 100}%` }}
            />
          </div>
          <span className="w-12 text-slate-600 font-medium text-right">
            {item.count}
            {total > 0 && <span className="text-slate-400 ml-1">({Math.round(item.count / total * 100)}%)</span>}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── 趨勢折線圖 ──
function TrendLineChart({ data, height = 150 }: { data: MetricsSnapshot[]; height?: number }) {
  if (data.length === 0) return <div className="text-center text-slate-300 py-6 text-xs">暫無歷史數據</div>;

  const W = 500, H = height, PX = 45, PY = 15;
  const maxRate = Math.max(...data.map(d => Math.max(
    parseFloat(String(d.contact_rate || 0)),
    parseFloat(String(d.placement_rate || 0))
  )), 10);

  const getY = (v: number) => H - PY - ((v / maxRate) * (H - PY * 2));
  const stepX = data.length > 1 ? (W - PX * 2) / (data.length - 1) : 0;
  const getX = (i: number) => PX + i * stepX;

  const contactPoints = data.map((d, i) => `${getX(i)},${getY(parseFloat(String(d.contact_rate || 0)))}`).join(' ');
  const placementPoints = data.map((d, i) => `${getX(i)},${getY(parseFloat(String(d.placement_rate || 0)))}`).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H + 25}`} className="w-full" style={{ maxHeight: height + 25 }}>
      {/* Grid */}
      {[0, 0.25, 0.5, 0.75, 1].map(pct => (
        <g key={pct}>
          <line x1={PX} y1={getY(maxRate * pct)} x2={W - PX} y2={getY(maxRate * pct)} stroke="#f1f5f9" />
          <text x={PX - 5} y={getY(maxRate * pct) + 3} textAnchor="end" fill="#94a3b8" fontSize={8}>
            {Math.round(maxRate * pct)}%
          </text>
        </g>
      ))}

      {/* Lines */}
      <polyline points={contactPoints} fill="none" stroke="#6366f1" strokeWidth={2} strokeLinejoin="round" />
      <polyline points={placementPoints} fill="none" stroke="#10b981" strokeWidth={2} strokeLinejoin="round" />

      {/* Dots */}
      {data.map((d, i) => (
        <g key={i}>
          <circle cx={getX(i)} cy={getY(parseFloat(String(d.contact_rate || 0)))} r={2.5} fill="#6366f1" />
          <circle cx={getX(i)} cy={getY(parseFloat(String(d.placement_rate || 0)))} r={2.5} fill="#10b981" />
        </g>
      ))}

      {/* X labels */}
      {data.map((d, i) => (
        i % Math.ceil(data.length / 8) === 0 && (
          <text key={i} x={getX(i)} y={H + 5} textAnchor="middle" fill="#94a3b8" fontSize={8}>
            {(d.snapshot_date || '').slice(5)}
          </text>
        )
      ))}

      {/* Legend */}
      <rect x={PX} y={H + 14} width={8} height={8} rx={2} fill="#6366f1" />
      <text x={PX + 12} y={H + 22} fill="#64748b" fontSize={8}>聯繫率</text>
      <rect x={PX + 60} y={H + 14} width={8} height={8} rx={2} fill="#10b981" />
      <text x={PX + 72} y={H + 22} fill="#64748b" fontSize={8}>上職率</text>
    </svg>
  );
}

export const KpiDashboardTab: React.FC<Props> = ({ stats }) => {
  const [efficiency, setEfficiency] = useState<EfficiencyData | null>(null);
  const [history, setHistory] = useState<MetricsSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [snapshotting, setSnapshotting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [effResult, histResult] = await Promise.all([
        getEfficiencyMetrics(),
        getMetricsHistory(),
      ]);
      if (effResult.success !== false) setEfficiency(effResult as any);
      if (histResult.success !== false && histResult.data) setHistory(histResult.data);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSnapshot = async () => {
    setSnapshotting(true);
    try {
      await takeMetricsSnapshot();
      await load();
    } catch { /* ignore */ }
    setSnapshotting(false);
  };

  const handleExportCSV = () => {
    if (history.length === 0) return;
    const headers = ['日期', '爬取總數', '今日新增', 'LinkedIn', 'GitHub', 'A級', 'B級', 'C級', 'D級',
      'Pipeline總數', '聯繫階段', '面試階段', 'Offer', 'on board', '聯繫率%', '面試率%', 'Offer率%', '上職率%'];
    const rows = history.map(h => [
      h.snapshot_date, h.total_candidates_crawled, h.today_new, h.linkedin_count, h.github_count,
      h.grade_a, h.grade_b, h.grade_c, h.grade_d,
      h.pipeline_total, h.pipeline_contacted, h.pipeline_interviewed, h.pipeline_offered, h.pipeline_onboarded,
      h.contact_rate, h.interview_rate, h.offer_rate, h.placement_rate,
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `crawler_metrics_${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const p = efficiency?.pipeline;
  const rates = efficiency?.rates;
  const prev = efficiency?.previous;

  // Delta calculation
  const contactDelta = prev ? (rates?.contact || 0) - prev.contactRate : null;
  const placementDelta = prev ? (rates?.placement || 0) - prev.placementRate : null;
  const totalDelta = prev ? (p?.total || 0) - prev.pipelineTotal : null;

  const grades = stats?.grades || { A: 0, B: 0, C: 0, D: 0 };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 控制列 */}
      <div className="flex justify-end gap-2">
        <button
          onClick={handleSnapshot}
          disabled={snapshotting}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          <RefreshCw size={13} className={snapshotting ? 'animate-spin' : ''} />
          更新快照
        </button>
        <button
          onClick={handleExportCSV}
          disabled={history.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-50"
        >
          <Download size={13} />
          匯出 CSV
        </button>
      </div>

      {/* KPI 卡片 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard
          label="系統總人數"
          value={p?.total || 0}
          delta={totalDelta}
          color="bg-slate-50"
        />
        <KpiCard
          label="本期爬取"
          value={stats?.total_candidates || 0}
          color="bg-indigo-50"
        />
        <KpiCard
          label="聯繫率"
          value={rates?.contact?.toFixed(1) || '0'}
          unit="%"
          delta={contactDelta}
          color="bg-blue-50"
        />
        <KpiCard
          label="面試→Offer"
          value={rates?.offer?.toFixed(1) || '0'}
          unit="%"
          color="bg-violet-50"
        />
        <KpiCard
          label="上職率"
          value={rates?.placement?.toFixed(1) || '0'}
          unit="%"
          delta={placementDelta}
          color="bg-emerald-50"
        />
      </div>

      {/* 漏斗 + 等級分布 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Target size={14} className="text-indigo-500" />
            招募漏斗
          </h4>
          <FunnelChart items={[
            { label: '總人數', value: p?.total || 0, color: 'bg-slate-400' },
            { label: '聯繫階段', value: p?.contacted || 0, color: 'bg-blue-400' },
            { label: '面試階段', value: p?.interviewed || 0, color: 'bg-indigo-400' },
            { label: 'Offer', value: p?.offered || 0, color: 'bg-violet-400' },
            { label: 'on board', value: p?.onboarded || 0, color: 'bg-emerald-500' },
          ]} />
        </div>

        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <h4 className="text-sm font-bold text-slate-800 mb-4">爬蟲評分等級分布</h4>
          <GradeDistribution grades={grades as any} />
        </div>
      </div>

      {/* 趨勢圖 */}
      <div className="bg-white border border-gray-100 rounded-xl p-4">
        <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
          <TrendingUp size={14} className="text-indigo-500" />
          趨勢圖（近 30 天）
        </h4>
        <TrendLineChart data={history} />
      </div>
    </div>
  );
};

export default KpiDashboardTab;
