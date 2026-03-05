import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, TrendingUp, Calendar } from 'lucide-react';
import { getEfficiencyMetrics, getMetricsHistory, takeMetricsSnapshot } from '../../services/crawlerService';
import type { EfficiencyData, MetricsSnapshot } from '../../crawlerTypes';

// ── SVG 折線圖 ──
function LineChart({ data, keys, colors, labels, height = 180 }: {
  data: { label: string; values: Record<string, number> }[];
  keys: string[];
  colors: string[];
  labels: string[];
  height?: number;
}) {
  if (data.length === 0) return <div className="text-center text-slate-300 py-8 text-xs">暫無資料</div>;

  const W = 600, H = height, PX = 50, PY = 20;
  const allValues = data.flatMap(d => keys.map(k => d.values[k] || 0));
  const maxVal = Math.max(...allValues, 1);
  const stepX = data.length > 1 ? (W - PX * 2) / (data.length - 1) : 0;

  const getY = (v: number) => H - PY - ((v / maxVal) * (H - PY * 2));
  const getX = (i: number) => PX + i * stepX;

  return (
    <svg viewBox={`0 0 ${W} ${H + 30}`} className="w-full" style={{ maxHeight: height + 30 }}>
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map(pct => (
        <g key={pct}>
          <line x1={PX} y1={getY(maxVal * pct)} x2={W - PX} y2={getY(maxVal * pct)} stroke="#f1f5f9" strokeWidth={1} />
          <text x={PX - 6} y={getY(maxVal * pct) + 4} textAnchor="end" fill="#94a3b8" fontSize={9}>
            {Math.round(maxVal * pct)}
          </text>
        </g>
      ))}

      {/* Lines */}
      {keys.map((key, ki) => {
        const points = data.map((d, i) => `${getX(i)},${getY(d.values[key] || 0)}`).join(' ');
        return (
          <g key={key}>
            <polyline points={points} fill="none" stroke={colors[ki]} strokeWidth={2} strokeLinejoin="round" />
            {data.map((d, i) => (
              <circle key={i} cx={getX(i)} cy={getY(d.values[key] || 0)} r={3} fill={colors[ki]} />
            ))}
          </g>
        );
      })}

      {/* X labels */}
      {data.map((d, i) => (
        <text key={i} x={getX(i)} y={H + 5} textAnchor="middle" fill="#94a3b8" fontSize={9}>
          {d.label}
        </text>
      ))}

      {/* Legend */}
      {labels.map((label, i) => (
        <g key={label} transform={`translate(${PX + i * 100}, ${H + 20})`}>
          <rect width={10} height={10} rx={2} fill={colors[i]} />
          <text x={14} y={9} fill="#64748b" fontSize={9}>{label}</text>
        </g>
      ))}
    </svg>
  );
}

// ── Bar 圖 ──
function HorizontalBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max * 100) : 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-16 text-slate-500 text-right shrink-0">{label}</span>
      <div className="flex-1 h-4 bg-slate-50 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className="w-8 text-slate-700 font-medium text-right">{value}</span>
    </div>
  );
}

type DateRange = '7d' | '30d' | '90d';

export const EfficiencyStatsTab: React.FC = () => {
  const [efficiency, setEfficiency] = useState<EfficiencyData | null>(null);
  const [history, setHistory] = useState<MetricsSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<DateRange>('30d');
  const [snapshotting, setSnapshotting] = useState(false);

  const getDateFrom = (r: DateRange): string => {
    const d = new Date();
    d.setDate(d.getDate() - (r === '7d' ? 7 : r === '30d' ? 30 : 90));
    return d.toISOString().split('T')[0];
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [effResult, histResult] = await Promise.all([
        getEfficiencyMetrics(),
        getMetricsHistory(getDateFrom(range)),
      ]);
      if (effResult.success !== false) setEfficiency(effResult as any);
      if (histResult.success !== false && histResult.data) setHistory(histResult.data);
    } catch { /* ignore */ }
    setLoading(false);
  }, [range]);

  useEffect(() => { load(); }, [load]);

  const handleSnapshot = async () => {
    setSnapshotting(true);
    try {
      await takeMetricsSnapshot();
      await load();
    } catch { /* ignore */ }
    setSnapshotting(false);
  };

  // 趨勢圖數據
  const chartData = history.map(h => ({
    label: (h.snapshot_date || '').slice(5), // MM-DD
    values: {
      linkedin: h.linkedin_count || 0,
      github: h.github_count || 0,
      total: (h.linkedin_count || 0) + (h.github_count || 0),
    },
  }));

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-slate-400" />
          <span className="text-sm font-medium text-slate-700">期間：</span>
          {(['7d', '30d', '90d'] as DateRange[]).map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1 text-xs rounded-lg font-medium transition-all ${
                range === r ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
              }`}
            >
              {r === '7d' ? '7 天' : r === '30d' ? '30 天' : '90 天'}
            </button>
          ))}
        </div>
        <button
          onClick={handleSnapshot}
          disabled={snapshotting}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          <RefreshCw size={13} className={snapshotting ? 'animate-spin' : ''} />
          更新快照
        </button>
      </div>

      {/* 每日候選人趨勢 */}
      <div className="bg-white border border-gray-100 rounded-xl p-4">
        <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
          <TrendingUp size={14} className="text-indigo-500" />
          每日候選人趨勢
        </h4>
        <LineChart
          data={chartData}
          keys={['linkedin', 'github']}
          colors={['#3b82f6', '#10b981']}
          labels={['LinkedIn', 'GitHub']}
        />
      </div>

      {/* 來源效益分析 */}
      {efficiency && (
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <h4 className="text-sm font-bold text-slate-800 mb-3">來源效益分析</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500">
                  <th className="px-3 py-2 text-left font-medium">來源</th>
                  <th className="px-3 py-2 text-center font-medium">找到</th>
                  <th className="px-3 py-2 text-center font-medium">聯繫階段</th>
                  <th className="px-3 py-2 text-center font-medium">on board</th>
                  <th className="px-3 py-2 text-center font-medium">聯繫率</th>
                  <th className="px-3 py-2 text-center font-medium">上職率</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {efficiency.sources.map(s => (
                  <tr key={s.name} className="hover:bg-slate-50/50">
                    <td className="px-3 py-2 font-medium text-slate-700">{s.name || '其他'}</td>
                    <td className="px-3 py-2 text-center">{s.total}</td>
                    <td className="px-3 py-2 text-center">{s.contacted}</td>
                    <td className="px-3 py-2 text-center text-emerald-600 font-medium">{s.onboarded}</td>
                    <td className="px-3 py-2 text-center">{s.contactRate}%</td>
                    <td className="px-3 py-2 text-center">{s.placementRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 顧問績效表 */}
      {efficiency && efficiency.consultants.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <h4 className="text-sm font-bold text-slate-800 mb-3">顧問績效表</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500">
                  <th className="px-3 py-2 text-left font-medium">顧問</th>
                  <th className="px-3 py-2 text-center font-medium">負責</th>
                  <th className="px-3 py-2 text-center font-medium">聯繫階段</th>
                  <th className="px-3 py-2 text-center font-medium">面試階段</th>
                  <th className="px-3 py-2 text-center font-medium">Offer</th>
                  <th className="px-3 py-2 text-center font-medium">on board</th>
                  <th className="px-3 py-2 text-center font-medium">聯繫率</th>
                  <th className="px-3 py-2 text-center font-medium">上職率</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {efficiency.consultants.map(c => (
                  <tr key={c.name} className="hover:bg-slate-50/50">
                    <td className="px-3 py-2 font-medium text-slate-700">{c.name}</td>
                    <td className="px-3 py-2 text-center">{c.total}</td>
                    <td className="px-3 py-2 text-center">{c.contacted}</td>
                    <td className="px-3 py-2 text-center">{c.interviewed}</td>
                    <td className="px-3 py-2 text-center">{c.offered}</td>
                    <td className="px-3 py-2 text-center text-emerald-600 font-medium">{c.onboarded}</td>
                    <td className="px-3 py-2 text-center">{c.contactRate}%</td>
                    <td className="px-3 py-2 text-center font-medium text-indigo-600">{c.placementRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 沒有數據提示 */}
      {!efficiency && (
        <div className="text-center py-12 text-slate-400">
          <TrendingUp size={48} className="mx-auto mb-4 opacity-30" />
          <p className="font-medium">尚無效益資料</p>
          <p className="text-xs mt-1">點擊「更新快照」開始收集數據</p>
        </div>
      )}
    </div>
  );
};

export default EfficiencyStatsTab;
