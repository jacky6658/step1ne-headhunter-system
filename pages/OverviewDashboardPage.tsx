import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile } from '../types';
import { getApiUrl, getAuthHeaders } from '../config/api';
import {
  Users, Briefcase, TrendingUp, RefreshCw, Phone, UserCheck,
  Target, ChevronDown, ChevronUp, Eye, Award, AlertTriangle,
  BarChart3, ArrowRight
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

interface OverviewDashboardPageProps {
  userProfile: UserProfile;
}

interface Candidate {
  id: string;
  name: string;
  status: string;
  consultant?: string;
  position: string;
  years: number;
  targetJobLabel?: string | null;
  createdAt?: string;
  interviewRound?: number | null;
}

interface Job {
  id: number;
  position_name: string;
  client_company: string;
  job_status: string;
}

// 狀態顏色配置
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  '未開始':   { label: '未開始',   color: 'text-gray-600',   bg: 'bg-gray-100' },
  'AI推薦':   { label: 'AI推薦',   color: 'text-blue-600',   bg: 'bg-blue-100' },
  '聯繫階段': { label: '聯繫階段', color: 'text-amber-600',  bg: 'bg-amber-100' },
  '面試階段': { label: '面試階段', color: 'text-purple-600', bg: 'bg-purple-100' },
  'Offer':    { label: 'Offer',    color: 'text-emerald-600',bg: 'bg-emerald-100' },
  'on board': { label: 'On Board', color: 'text-green-700',  bg: 'bg-green-100' },
  '婉拒':     { label: '婉拒',     color: 'text-red-600',    bg: 'bg-red-100' },
  '備選人才': { label: '備選人才', color: 'text-cyan-600',   bg: 'bg-cyan-100' },
  '爬蟲初篩': { label: '爬蟲初篩', color: 'text-slate-500',  bg: 'bg-slate-100' },
};

// 活躍狀態（排除爬蟲初篩、婉拒、備選人才）
const ACTIVE_STATUSES = ['未開始', 'AI推薦', '聯繫階段', '面試階段', 'Offer', 'on board'];
// 進行中狀態（聯繫、面試、Offer）
const PIPELINE_STATUSES = ['聯繫階段', '面試階段', 'Offer'];

export function OverviewDashboardPage({ userProfile }: OverviewDashboardPageProps) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedConsultant, setExpandedConsultant] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'all'>('all');

  const fetchData = async () => {
    setLoading(true);
    try {
      // 並行分頁撈取全部候選人（每頁 500 筆）
      const PAGE_SIZE = 500;
      const [firstRes, jobsRes] = await Promise.all([
        fetch(getApiUrl(`/api/candidates?limit=${PAGE_SIZE}&offset=0`), { headers: getAuthHeaders() }),
        fetch(getApiUrl('/api/jobs'), { headers: getAuthHeaders() })
      ]);
      const firstData = await firstRes.json();
      const allCandidates: Candidate[] = firstData.data || [];
      const total = firstData.total || allCandidates.length;

      if (allCandidates.length < total) {
        const fetches: Promise<Response>[] = [];
        for (let offset = PAGE_SIZE; offset < total; offset += PAGE_SIZE) {
          fetches.push(fetch(getApiUrl(`/api/candidates?limit=${PAGE_SIZE}&offset=${offset}`), { headers: getAuthHeaders() }));
        }
        const responses = await Promise.all(fetches);
        const jsons = await Promise.all(responses.map(r => r.json()));
        for (const d of jsons) {
          allCandidates.push(...(d.data || []));
        }
      }
      const jobsData = await jobsRes.json();
      setCandidates(allCandidates);
      setJobs(jobsData.data || []);
    } catch (e) {
      console.error('Failed to fetch dashboard data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // 時間過濾
  const filteredCandidates = useMemo(() => {
    if (timeRange === 'all') return candidates;
    const now = new Date();
    const cutoff = new Date();
    if (timeRange === 'week') cutoff.setDate(now.getDate() - 7);
    else cutoff.setDate(now.getDate() - 30);
    return candidates.filter(c => {
      if (!c.createdAt) return true;
      return new Date(c.createdAt) >= cutoff;
    });
  }, [candidates, timeRange]);

  // ── 全局 KPI ──
  const globalKPI = useMemo(() => {
    const all = candidates; // KPI 用全量資料
    const active = all.filter(c => ACTIVE_STATUSES.includes(c.status));
    const contacted = all.filter(c => c.status === '聯繫階段').length;
    const interviewing = all.filter(c => c.status === '面試階段').length;
    const offer = all.filter(c => c.status === 'Offer').length;
    const onboard = all.filter(c => c.status === 'on board').length;
    const activeJobs = jobs.filter(j => j.job_status === '招募中' || j.job_status === '開放中').length;

    return { total: all.length, active: active.length, contacted, interviewing, offer, onboard, activeJobs };
  }, [candidates, jobs]);

  // ── 各顧問統計 ──
  // 非真人顧問名稱 → 歸入「系統/爬蟲」
  const BOT_CONSULTANTS = ['crawler', 'crawler-webui', 'crawler-autopush', 'd級人才庫重整'];
  // 顧問名稱合併對照（小寫 key → 標準名稱）
  const CONSULTANT_ALIASES: Record<string, string> = {
    'jacky chen': 'Jacky',
    'jacky': 'Jacky',
    'phoebe': 'Phoebe',
  };

  const normalizeConsultant = (raw: string): string => {
    const trimmed = (raw || '').trim();
    if (!trimmed || trimmed === '待指派') return '未指派';
    const lower = trimmed.toLowerCase();
    if (BOT_CONSULTANTS.includes(lower)) return '系統/爬蟲';
    return CONSULTANT_ALIASES[lower] || trimmed;
  };

  const consultantStats = useMemo(() => {
    const map: Record<string, { name: string; candidates: Candidate[]; byStatus: Record<string, number> }> = {};

    filteredCandidates.forEach(c => {
      const name = normalizeConsultant(c.consultant || '');
      if (!map[name]) {
        map[name] = { name, candidates: [], byStatus: {} };
      }
      map[name].candidates.push(c);
      map[name].byStatus[c.status] = (map[name].byStatus[c.status] || 0) + 1;
    });

    // 計算健康燈號
    return Object.values(map)
      .map(stat => {
        const pipeline = PIPELINE_STATUSES.reduce((sum, s) => sum + (stat.byStatus[s] || 0), 0);
        const total = stat.candidates.length;
        const onboard = stat.byStatus['on board'] || 0;
        const contacted = stat.byStatus['聯繫階段'] || 0;
        const interviewing = stat.byStatus['面試階段'] || 0;
        const offer = stat.byStatus['Offer'] || 0;

        // 健康度判斷
        let health: 'green' | 'yellow' | 'red' = 'green';
        if (total > 10 && pipeline === 0) health = 'red';       // 有人選但沒推進
        else if (total > 5 && contacted === 0 && interviewing === 0) health = 'yellow'; // 卡住

        return { ...stat, pipeline, total, onboard, contacted, interviewing, offer, health };
      })
      .sort((a, b) => {
        // 系統/爬蟲 和 未指派排最後
        const bottomNames = ['系統/爬蟲', '未指派'];
        const aBottom = bottomNames.indexOf(a.name);
        const bBottom = bottomNames.indexOf(b.name);
        if (aBottom >= 0 && bBottom >= 0) return aBottom - bBottom;
        if (aBottom >= 0) return 1;
        if (bBottom >= 0) return -1;
        // 紅燈排前面
        const healthOrder = { red: 0, yellow: 1, green: 2 };
        if (healthOrder[a.health] !== healthOrder[b.health]) return healthOrder[a.health] - healthOrder[b.health];
        return b.pipeline - a.pipeline;
      });
  }, [filteredCandidates]);

  // ── 職缺維度 ──
  const jobStats = useMemo(() => {
    const activeJobs = jobs.filter(j => j.job_status === '招募中' || j.job_status === '開放中');
    return activeJobs.map(job => {
      const matched = candidates.filter(c => c.targetJobLabel?.includes(job.position_name) || c.targetJobLabel?.includes(job.client_company));
      const byStatus: Record<string, number> = {};
      matched.forEach(c => { byStatus[c.status] = (byStatus[c.status] || 0) + 1; });

      const pipeline = PIPELINE_STATUSES.reduce((sum, s) => sum + (byStatus[s] || 0), 0);
      let health: 'green' | 'yellow' | 'red' = 'green';
      if (matched.length === 0) health = 'red';
      else if (pipeline === 0) health = 'yellow';

      return {
        job,
        total: matched.length,
        byStatus,
        pipeline,
        health,
        consultants: [...new Set(matched.map(c => c.consultant || '未指派'))],
      };
    }).sort((a, b) => {
      const healthOrder = { red: 0, yellow: 1, green: 2 };
      if (healthOrder[a.health] !== healthOrder[b.health]) return healthOrder[a.health] - healthOrder[b.health];
      return b.pipeline - a.pipeline;
    });
  }, [jobs, candidates]);

  // ── 圖表資料 ──
  // 1. 各顧問堆疊長條圖
  const consultantBarData = useMemo(() => {
    return consultantStats
      .filter(s => s.name !== '系統/爬蟲' && s.name !== '未指派')
      .map(s => ({
        name: s.name,
        聯繫中: s.contacted,
        面試中: s.interviewing,
        Offer: s.offer,
        'On Board': s.onboard,
        未開始: s.byStatus['未開始'] || 0,
        'AI推薦': s.byStatus['AI推薦'] || 0,
      }));
  }, [consultantStats]);

  // 2. 全狀態分布圓餅圖
  const statusPieData = useMemo(() => {
    const counts: Record<string, number> = {};
    candidates.forEach(c => {
      counts[c.status] = (counts[c.status] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name: STATUS_CONFIG[name]?.label || name, value }))
      .sort((a, b) => b.value - a.value);
  }, [candidates]);

  const PIE_COLORS = ['#6366f1', '#f59e0b', '#8b5cf6', '#10b981', '#059669', '#ef4444', '#06b6d4', '#94a3b8', '#64748b'];

  // 3. Pipeline 對比長條圖
  const pipelineBarData = useMemo(() => {
    return consultantStats
      .filter(s => s.name !== '系統/爬蟲' && s.name !== '未指派')
      .map(s => ({
        name: s.name,
        Pipeline: s.pipeline,
        總負責: s.total,
      }));
  }, [consultantStats]);

  const healthIcon = (h: 'green' | 'yellow' | 'red') => {
    if (h === 'green') return <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />;
    if (h === 'yellow') return <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />;
    return <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block animate-pulse" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ━━━ Header ━━━ */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-indigo-600" />
            總攬看板
          </h1>
          <p className="text-sm text-slate-500 mt-1">全團隊顧問進度一覽</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 rounded-lg p-0.5">
            {(['all', 'month', 'week'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTimeRange(t)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  timeRange === t ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t === 'all' ? '全部' : t === 'month' ? '本月' : '本週'}
              </button>
            ))}
          </div>
          <button onClick={fetchData} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-all" title="重新整理">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ━━━ 全局 KPI 數字卡片 ━━━ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: '總人選', value: globalKPI.total, icon: Users, color: 'text-slate-700', bg: 'bg-slate-50' },
          { label: '活躍人選', value: globalKPI.active, icon: TrendingUp, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: '聯繫中', value: globalKPI.contacted, icon: Phone, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: '面試中', value: globalKPI.interviewing, icon: UserCheck, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Offer', value: globalKPI.offer, icon: Award, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'On Board', value: globalKPI.onboard, icon: Target, color: 'text-green-700', bg: 'bg-green-50' },
          { label: '活躍職缺', value: globalKPI.activeJobs, icon: Briefcase, color: 'text-blue-600', bg: 'bg-blue-50' },
        ].map((kpi, i) => (
          <div key={i} className={`${kpi.bg} rounded-xl p-4 border border-slate-100`}>
            <div className="flex items-center gap-2 mb-2">
              <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
              <span className="text-xs text-slate-500 font-medium">{kpi.label}</span>
            </div>
            <div className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* ━━━ 圖表區 ━━━ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 各顧問人選分布（堆疊長條圖） */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5">
          <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-500" />
            各顧問人選狀態分布
          </h3>
          {consultantBarData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={consultantBarData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="聯繫中" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} />
                <Bar dataKey="面試中" stackId="a" fill="#8b5cf6" />
                <Bar dataKey="Offer" stackId="a" fill="#10b981" />
                <Bar dataKey="On Board" stackId="a" fill="#059669" />
                <Bar dataKey="AI推薦" stackId="a" fill="#6366f1" />
                <Bar dataKey="未開始" stackId="a" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-sm text-slate-400">無資料</div>
          )}
        </div>

        {/* 全狀態分布（圓餅圖） */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5">
          <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
            <Target className="w-4 h-4 text-emerald-500" />
            人選狀態總覽
          </h3>
          {statusPieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={statusPieData}
                  cx="50%"
                  cy="45%"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={{ strokeWidth: 1 }}
                  style={{ fontSize: '10px' }}
                >
                  {statusPieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [`${value} 人`, '數量']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-sm text-slate-400">無資料</div>
          )}
        </div>
      </div>

      {/* Pipeline 對比長條圖 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5">
        <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-purple-500" />
          各顧問 Pipeline 進行中 vs 總負責
        </h3>
        {pipelineBarData.length > 0 ? (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={pipelineBarData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="總負責" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Pipeline" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[240px] flex items-center justify-center text-sm text-slate-400">無資料</div>
        )}
      </div>

      {/* ━━━ 各顧問進度對比 ━━━ */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-500" />
            各顧問進度
          </h2>
          <span className="text-xs text-slate-400">{consultantStats.length} 位顧問</span>
        </div>

        {/* 表頭 */}
        <div className="hidden sm:grid grid-cols-[40px_1fr_80px_80px_80px_80px_80px_80px] gap-2 px-5 py-2 bg-slate-50 text-xs font-semibold text-slate-500 border-b border-slate-100">
          <div></div>
          <div>顧問</div>
          <div className="text-center">負責人選</div>
          <div className="text-center">聯繫中</div>
          <div className="text-center">面試中</div>
          <div className="text-center">Offer</div>
          <div className="text-center">On Board</div>
          <div className="text-center">Pipeline</div>
        </div>

        {/* 各顧問行 — 桌面表格 + 手機卡片 */}
        {consultantStats.map(stat => (
          <div key={stat.name}>
            {/* 桌面版：表格行 */}
            <button
              onClick={() => setExpandedConsultant(expandedConsultant === stat.name ? null : stat.name)}
              className="hidden sm:grid w-full grid-cols-[40px_1fr_80px_80px_80px_80px_80px_80px] gap-2 px-5 py-3 hover:bg-slate-50 transition-all items-center text-sm border-b border-slate-50"
            >
              <div className="flex items-center justify-center">{healthIcon(stat.health)}</div>
              <div className="text-left font-medium text-slate-800 flex items-center gap-2">
                {stat.name}
                {expandedConsultant === stat.name ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
              </div>
              <div className="text-center font-semibold text-slate-700">{stat.total}</div>
              <div className="text-center">
                <span className={`inline-block min-w-[28px] px-1.5 py-0.5 rounded text-xs font-semibold ${stat.contacted > 0 ? 'bg-amber-100 text-amber-700' : 'text-slate-300'}`}>
                  {stat.contacted}
                </span>
              </div>
              <div className="text-center">
                <span className={`inline-block min-w-[28px] px-1.5 py-0.5 rounded text-xs font-semibold ${stat.interviewing > 0 ? 'bg-purple-100 text-purple-700' : 'text-slate-300'}`}>
                  {stat.interviewing}
                </span>
              </div>
              <div className="text-center">
                <span className={`inline-block min-w-[28px] px-1.5 py-0.5 rounded text-xs font-semibold ${stat.offer > 0 ? 'bg-emerald-100 text-emerald-700' : 'text-slate-300'}`}>
                  {stat.offer}
                </span>
              </div>
              <div className="text-center">
                <span className={`inline-block min-w-[28px] px-1.5 py-0.5 rounded text-xs font-semibold ${stat.onboard > 0 ? 'bg-green-100 text-green-700' : 'text-slate-300'}`}>
                  {stat.onboard}
                </span>
              </div>
              <div className="text-center">
                <span className={`inline-block min-w-[28px] px-2 py-0.5 rounded-full text-xs font-bold ${
                  stat.pipeline > 5 ? 'bg-indigo-100 text-indigo-700' : stat.pipeline > 0 ? 'bg-slate-100 text-slate-600' : 'text-slate-300'
                }`}>
                  {stat.pipeline}
                </span>
              </div>
            </button>

            {/* 手機版：卡片 */}
            <button
              onClick={() => setExpandedConsultant(expandedConsultant === stat.name ? null : stat.name)}
              className="sm:hidden w-full px-4 py-3 hover:bg-slate-50 transition-all border-b border-slate-50 text-left"
            >
              <div className="flex items-center gap-2 mb-2">
                {healthIcon(stat.health)}
                <span className="font-semibold text-slate-800 text-sm">{stat.name}</span>
                <span className="text-xs text-slate-400 ml-auto">負責 {stat.total} 人</span>
                {expandedConsultant === stat.name ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {stat.contacted > 0 && <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-xs font-semibold">聯繫 {stat.contacted}</span>}
                {stat.interviewing > 0 && <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs font-semibold">面試 {stat.interviewing}</span>}
                {stat.offer > 0 && <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-xs font-semibold">Offer {stat.offer}</span>}
                {stat.onboard > 0 && <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-semibold">On Board {stat.onboard}</span>}
                {stat.pipeline === 0 && <span className="text-xs text-slate-400">無進行中</span>}
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  stat.pipeline > 5 ? 'bg-indigo-100 text-indigo-700' : stat.pipeline > 0 ? 'bg-slate-100 text-slate-600' : 'text-slate-300'
                }`}>Pipeline {stat.pipeline}</span>
              </div>
            </button>

            {/* 展開：該顧問各狀態人選明細 */}
            {expandedConsultant === stat.name && (
              <div className="bg-slate-50 px-4 sm:px-5 py-3 border-b border-slate-100">
                {/* 狀態分布 bar */}
                <div className="flex gap-1.5 mb-3 flex-wrap">
                  {Object.entries(stat.byStatus)
                    .sort((a, b) => b[1] - a[1])
                    .map(([status, count]) => {
                      const cfg = STATUS_CONFIG[status] || { label: status, color: 'text-slate-600', bg: 'bg-slate-100' };
                      return (
                        <span key={status} className={`${cfg.bg} ${cfg.color} px-2.5 py-1 rounded-full text-xs font-semibold`}>
                          {cfg.label} {count}
                        </span>
                      );
                    })}
                </div>
                {/* Pipeline 人選列表 */}
                {stat.candidates.filter(c => PIPELINE_STATUSES.includes(c.status)).length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-2">進行中人選：</p>
                    <div className="space-y-1">
                      {stat.candidates
                        .filter(c => PIPELINE_STATUSES.includes(c.status))
                        .map(c => {
                          const cfg = STATUS_CONFIG[c.status] || { label: c.status, color: 'text-slate-600', bg: 'bg-slate-100' };
                          return (
                            <div key={c.id} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 bg-white rounded-lg px-3 py-2 text-sm border border-slate-100">
                              <div className="flex items-center gap-2">
                                <span className={`${cfg.bg} ${cfg.color} px-2 py-0.5 rounded text-xs font-semibold shrink-0`}>{cfg.label}</span>
                                <span className="font-medium text-slate-800">{c.name}</span>
                              </div>
                              <span className="text-slate-400 text-xs truncate">{c.position}</span>
                              {c.targetJobLabel && (
                                <span className="text-xs text-indigo-500 sm:ml-auto flex items-center gap-1 shrink-0">
                                  <ArrowRight className="w-3 h-3" /> {c.targetJobLabel}
                                </span>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
                {stat.candidates.filter(c => PIPELINE_STATUSES.includes(c.status)).length === 0 && (
                  <p className="text-xs text-slate-400 italic">目前沒有進行中的人選</p>
                )}
              </div>
            )}
          </div>
        ))}

        {consultantStats.length === 0 && (
          <div className="px-5 py-8 text-center text-sm text-slate-400">暫無資料</div>
        )}
      </div>

      {/* ━━━ 職缺維度進度 ━━━ */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-blue-500" />
            活躍職缺進度
          </h2>
          <span className="text-xs text-slate-400">{jobStats.length} 個職缺</span>
        </div>

        {/* 表頭 */}
        <div className="hidden sm:grid grid-cols-[40px_1.5fr_1fr_80px_80px_80px_80px_1fr] gap-2 px-5 py-2 bg-slate-50 text-xs font-semibold text-slate-500 border-b border-slate-100">
          <div></div>
          <div>職缺</div>
          <div>公司</div>
          <div className="text-center">推薦人選</div>
          <div className="text-center">面試中</div>
          <div className="text-center">Offer</div>
          <div className="text-center">On Board</div>
          <div>負責顧問</div>
        </div>

        {jobStats.map(js => (
          <div key={js.job.id}>
            {/* 桌面版 */}
            <div className="hidden sm:grid grid-cols-[40px_1.5fr_1fr_80px_80px_80px_80px_1fr] gap-2 px-5 py-3 hover:bg-slate-50 transition-all items-center text-sm border-b border-slate-50">
              <div className="flex items-center justify-center">{healthIcon(js.health)}</div>
              <div className="font-medium text-slate-800 truncate">{js.job.position_name}</div>
              <div className="text-slate-500 text-xs truncate">{js.job.client_company}</div>
              <div className="text-center font-semibold text-slate-700">{js.total}</div>
              <div className="text-center">
                <span className={`inline-block min-w-[28px] px-1.5 py-0.5 rounded text-xs font-semibold ${
                  (js.byStatus['面試階段'] || 0) > 0 ? 'bg-purple-100 text-purple-700' : 'text-slate-300'
                }`}>
                  {js.byStatus['面試階段'] || 0}
                </span>
              </div>
              <div className="text-center">
                <span className={`inline-block min-w-[28px] px-1.5 py-0.5 rounded text-xs font-semibold ${
                  (js.byStatus['Offer'] || 0) > 0 ? 'bg-emerald-100 text-emerald-700' : 'text-slate-300'
                }`}>
                  {js.byStatus['Offer'] || 0}
                </span>
              </div>
              <div className="text-center">
                <span className={`inline-block min-w-[28px] px-1.5 py-0.5 rounded text-xs font-semibold ${
                  (js.byStatus['on board'] || 0) > 0 ? 'bg-green-100 text-green-700' : 'text-slate-300'
                }`}>
                  {js.byStatus['on board'] || 0}
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {js.consultants.map(c => (
                  <span key={c} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{c}</span>
                ))}
              </div>
            </div>
            {/* 手機版：卡片 */}
            <div className="sm:hidden px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition-all">
              <div className="flex items-center gap-2 mb-1.5">
                {healthIcon(js.health)}
                <span className="font-semibold text-slate-800 text-sm truncate">{js.job.position_name}</span>
              </div>
              <div className="text-xs text-slate-500 mb-2">{js.job.client_company} · 推薦 {js.total} 人</div>
              <div className="flex gap-1.5 flex-wrap">
                {(js.byStatus['面試階段'] || 0) > 0 && <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs font-semibold">面試 {js.byStatus['面試階段']}</span>}
                {(js.byStatus['Offer'] || 0) > 0 && <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-xs font-semibold">Offer {js.byStatus['Offer']}</span>}
                {(js.byStatus['on board'] || 0) > 0 && <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-semibold">On Board {js.byStatus['on board']}</span>}
                {js.consultants.map(c => (
                  <span key={c} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{c}</span>
                ))}
              </div>
            </div>
          </div>
        ))}

        {jobStats.length === 0 && (
          <div className="px-5 py-8 text-center text-sm text-slate-400">目前沒有活躍職缺</div>
        )}
      </div>

      {/* ━━━ 注意事項 ━━━ */}
      {consultantStats.filter(s => s.health === 'red').length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <h3 className="text-sm font-bold text-red-700 flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4" />
            需要關注
          </h3>
          <ul className="space-y-1">
            {consultantStats.filter(s => s.health === 'red').map(s => (
              <li key={s.name} className="text-sm text-red-600">
                <span className="font-semibold">{s.name}</span>：負責 {s.total} 位人選，但進行中（聯繫/面試/Offer）為 0，需確認是否有推進
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
