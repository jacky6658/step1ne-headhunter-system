import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile } from '../types';
import { getApiUrl } from '../config/api';
import {
  BarChart3, Users, Briefcase, TrendingUp, AlertTriangle, CheckCircle,
  RefreshCw, UserCheck, UserX, Globe, Github, Mail, Bot, Filter, Eye,
  X, MapPin, DollarSign, GraduationCap, Clock, Building2, Zap, MessageSquare, ExternalLink,
  Target, CalendarDays, ArrowUpRight, Handshake, ChevronLeft, ChevronRight
} from 'lucide-react';

interface OperationsDashboardPageProps {
  userProfile: UserProfile;
}

interface Candidate {
  id: string;
  name: string;
  status: string;
  source: string;
  position: string;
  years: number;
  skills: string | string[];
  linkedinUrl?: string;
  githubUrl?: string;
  targetJobId?: number | null;
  targetJobLabel?: string | null;
  workHistory?: any[];
  consultant?: string;
  createdAt?: string;
  interviewRound?: number | null;
}

interface Job {
  id: number;
  position_name: string;
  client_company: string;
  department: string;
  open_positions: string;
  salary_range: string;
  key_skills: string;
  experience_required: string;
  education_required: string;
  location: string;
  job_status: string;
  language_required: string;
  special_conditions: string;
  industry_background: string;
  team_size: string;
  key_challenges: string;
  attractive_points: string;
  recruitment_difficulty: string;
  interview_process: string;
  consultant_notes: string;
  job_description: string;
  remote_work: string;
  business_trip: string;
  work_hours: string;
  welfare_tags: string;
  welfare_detail: string;
  job_url: string;
  lastUpdated: string;
}

// --- Color palette ---
const STATUS_COLORS: Record<string, { bg: string; text: string; ring: string }> = {
  '聯繫階段': { bg: 'bg-blue-50', text: 'text-blue-700', ring: 'ring-blue-200' },
  '面試階段': { bg: 'bg-purple-50', text: 'text-purple-700', ring: 'ring-purple-200' },
  'AI推薦': { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200' },
  '備選人才': { bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-200' },
  '未開始': { bg: 'bg-slate-50', text: 'text-slate-600', ring: 'ring-slate-200' },
  '婉拒': { bg: 'bg-red-50', text: 'text-red-600', ring: 'ring-red-200' },
  '不推薦': { bg: 'bg-rose-50', text: 'text-rose-600', ring: 'ring-rose-200' },
  '人才庫': { bg: 'bg-cyan-50', text: 'text-cyan-700', ring: 'ring-cyan-200' },
  '爬蟲初篩': { bg: 'bg-orange-50', text: 'text-orange-600', ring: 'ring-orange-200' },
  'Offer': { bg: 'bg-green-50', text: 'text-green-700', ring: 'ring-green-200' },
  'on board': { bg: 'bg-indigo-50', text: 'text-indigo-700', ring: 'ring-indigo-200' },
};

const SOURCE_ICONS: Record<string, React.ReactNode> = {
  'LinkedIn': <Globe size={14} className="text-blue-500" />,
  'GitHub': <Github size={14} className="text-slate-700" />,
  'Gmail': <Mail size={14} className="text-red-500" />,
  '爬蟲匯入': <Bot size={14} className="text-orange-500" />,
};

// --- Helpers ---
function normalizeSource(src: string): string {
  if (src.startsWith('LinkedIn') || src === 'LinkedIn PDF') return 'LinkedIn';
  if (src === 'Gmail' || src === 'Gmail 進件') return 'Gmail';
  if (src === 'Direct Submission' || src === 'Phoebe直傳') return '主動投遞';
  if (src === 'GitHub') return 'GitHub';
  if (src === '爬蟲匯入') return '爬蟲匯入';
  return '其他';
}

function normalizeStatus(st: string): string {
  if (st === '已連繫' || st === '已聯繫') return '聯繫階段';
  if (st === '已面試') return '面試階段';
  if (st === '客戶婉拒') return '面試沒過';
  return st;
}

function normalizeConsultant(name: string): string {
  if (name === 'Jacky Chen' || name === 'Jacky') return 'Jacky';
  if (name === 'Crawler-AutoPush' || name === 'Crawler' || name === 'Crawler-WebUI') return '爬蟲系統匯入';
  if (name === 'D級人才庫重整') return '爬蟲系統匯入';
  if (name === '待指派') return '待指派';
  return name;
}

function classifyContactable(c: Candidate, activeJobs: Job[], jobKeywordSets: { keywords: string[] }[]): 'contactable' | 'not_contactable' {
  const hasUrl = !!(c.linkedinUrl?.trim()) || !!(c.githubUrl?.trim());
  const cText = ((typeof c.skills === 'string' ? c.skills : (c.skills || []).join(',')) + ' ' + (c.position || '') + ' ' ).toLowerCase();

  let matchesJob = false;
  if (c.targetJobId) {
    if (activeJobs.find(j => j.id === c.targetJobId)) matchesJob = true;
  }
  if (!matchesJob) {
    for (const jk of jobKeywordSets) {
      if (jk.keywords.filter(kw => cText.includes(kw)).length >= 2) { matchesJob = true; break; }
    }
  }

  const wh = c.workHistory;
  const hasWH = Array.isArray(wh) && wh.length > 0;
  const hasSufficientExp = hasWH || (c.years && c.years > 0) || (c.position && c.position.trim().length > 5);

  return (hasUrl && matchesJob && hasSufficientExp) ? 'contactable' : 'not_contactable';
}

// --- Bar component (pure CSS) ---
function HBar({ items, total }: { items: { label: string; value: number; color: string }[]; total: number }) {
  if (total === 0) return <div className="h-6 bg-slate-100 rounded-full" />;
  return (
    <div className="flex h-6 rounded-full overflow-hidden bg-slate-100">
      {items.filter(i => i.value > 0).map((item, idx) => (
        <div
          key={idx}
          className={`${item.color} relative group flex items-center justify-center transition-all`}
          style={{ width: `${Math.max((item.value / total) * 100, 2)}%` }}
        >
          <span className="absolute -top-8 bg-slate-800 text-white text-[10px] px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
            {item.label}: {item.value} ({((item.value / total) * 100).toFixed(1)}%)
          </span>
          {(item.value / total) > 0.06 && (
            <span className="text-[10px] font-bold text-white/90">{item.value}</span>
          )}
        </div>
      ))}
    </div>
  );
}

// --- Stat Card ---
function StatCard({ icon, label, value, sub, color = 'bg-white' }: { icon: React.ReactNode; label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className={`${color} rounded-2xl border border-slate-100 p-4 sm:p-5 shadow-sm`}>
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 bg-slate-100 rounded-xl">{icon}</div>
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-2xl sm:text-3xl font-black text-slate-900">{value}</div>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

// --- Urgent detection: 檢查職缺欄位是否包含「急缺」---
function isJobUrgent(job: Job): boolean {
  const fields = [
    job.consultant_notes,
    job.special_conditions,
    job.recruitment_difficulty,
    job.key_challenges,
    job.job_description,
  ];
  return fields.some(f => f && f.includes('急缺'));
}

// --- Detail Row ---
function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string }) {
  if (!value || !value.trim()) return null;
  return (
    <div className="flex items-start gap-3 py-2 border-b border-slate-50 last:border-0">
      <div className="p-1.5 bg-slate-100 rounded-lg shrink-0 mt-0.5">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{label}</div>
        <div className="text-sm text-slate-700 whitespace-pre-wrap break-words mt-0.5">{value}</div>
      </div>
    </div>
  );
}

// --- Job Detail Modal ---
function JobDetailModal({ job, matchCount, onClose }: { job: Job; matchCount: number; onClose: () => void }) {
  const isUrgent = isJobUrgent(job);
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`p-5 sm:p-6 border-b ${isUrgent ? 'bg-red-50 border-red-100' : 'border-slate-100'}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-black text-slate-900">{job.position_name}</h3>
                {isUrgent && (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-red-500 text-white font-black animate-pulse">急缺</span>
                )}
                <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-green-50 text-green-700">招募中</span>
              </div>
              {job.client_company && (
                <div className="flex items-center gap-1.5 mt-1 text-sm text-slate-500">
                  <Building2 size={14} />
                  {job.client_company}
                </div>
              )}
              <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                <span>{matchCount} 位配對人選</span>
                {job.lastUpdated && <span>更新於 {new Date(job.lastUpdated).toLocaleDateString('zh-TW')}</span>}
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-all shrink-0">
              <X size={20} className="text-slate-400" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-1">
          {/* Quick info chips */}
          <div className="flex flex-wrap gap-2 mb-4">
            {job.salary_range && (
              <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg">
                <DollarSign size={12} /> {job.salary_range}
              </span>
            )}
            {job.location && (
              <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg">
                <MapPin size={12} /> {job.location}
              </span>
            )}
            {job.department && (
              <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 bg-purple-50 text-purple-700 rounded-lg">
                <Building2 size={12} /> {job.department}
              </span>
            )}
            {job.remote_work && (
              <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 bg-amber-50 text-amber-700 rounded-lg">
                {job.remote_work}
              </span>
            )}
          </div>

          {/* Key skills */}
          {job.key_skills && (
            <div className="mb-4">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">關鍵技能</div>
              <div className="flex flex-wrap gap-1.5">
                {job.key_skills.split(/[,，、]+/).map((skill, i) => (
                  <span key={i} className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full font-medium">
                    {skill.trim()}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Detail rows */}
          <DetailRow icon={<GraduationCap size={14} className="text-purple-500" />} label="學歷要求" value={job.education_required} />
          <DetailRow icon={<Clock size={14} className="text-blue-500" />} label="經驗要求" value={job.experience_required} />
          <DetailRow icon={<Globe size={14} className="text-cyan-500" />} label="語言要求" value={job.language_required} />
          <DetailRow icon={<Users size={14} className="text-amber-500" />} label="團隊規模" value={job.team_size} />
          <DetailRow icon={<Zap size={14} className="text-yellow-500" />} label="吸引力" value={job.attractive_points} />
          <DetailRow icon={<AlertTriangle size={14} className="text-orange-500" />} label="招募難度" value={job.recruitment_difficulty} />
          <DetailRow icon={<MessageSquare size={14} className="text-green-500" />} label="面試流程" value={job.interview_process} />
          <DetailRow icon={<Eye size={14} className="text-slate-500" />} label="特殊條件" value={job.special_conditions} />
          <DetailRow icon={<Briefcase size={14} className="text-indigo-500" />} label="產業背景" value={job.industry_background} />

          {/* Job description - larger section */}
          {job.job_description && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">職缺描述</div>
              <div className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 rounded-xl p-4 max-h-60 overflow-y-auto">
                {job.job_description}
              </div>
            </div>
          )}

          {/* Consultant notes */}
          {job.consultant_notes && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">顧問備註</div>
              <div className="text-sm text-slate-700 whitespace-pre-wrap bg-amber-50 rounded-xl p-4">
                {job.consultant_notes}
              </div>
            </div>
          )}

          {/* Welfare */}
          {(job.welfare_tags || job.welfare_detail) && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">福利</div>
              {job.welfare_tags && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {job.welfare_tags.split(/[,，、]+/).map((tag, i) => (
                    <span key={i} className="text-xs px-2 py-0.5 bg-green-50 text-green-700 rounded-full font-medium">
                      {tag.trim()}
                    </span>
                  ))}
                </div>
              )}
              {job.welfare_detail && <div className="text-sm text-slate-600 whitespace-pre-wrap">{job.welfare_detail}</div>}
            </div>
          )}
        </div>

        {/* Footer */}
        {job.job_url && (
          <div className="p-4 border-t border-slate-100 bg-slate-50">
            <a href={job.job_url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-800 transition-colors">
              <ExternalLink size={14} /> 查看原始職缺連結
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Main Component ---
export const OperationsDashboardPage: React.FC<OperationsDashboardPageProps> = ({ userProfile }) => {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [selectedJob, setSelectedJob] = useState<{ job: Job; matchCount: number } | null>(null);
  const [monthIdx, setMonthIdx] = useState(-1); // -1 means "latest month", set after data loads

  const fetchData = async () => {
    setLoading(true);
    try {
      const [candRes, jobsRes] = await Promise.all([
        fetch(getApiUrl('/candidates?limit=2000')),
        fetch(getApiUrl('/jobs')),
      ]);
      const candJson = await candRes.json();
      const jobsJson = await jobsRes.json();
      setCandidates(candJson.data || candJson.candidates || candJson);
      setJobs(jobsJson.data || jobsJson.jobs || jobsJson);
      setLastRefresh(new Date());
    } catch (e) {
      console.error('Dashboard fetch error:', e);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // --- Computed data ---
  const activeJobs = useMemo(() => jobs.filter(j => j.job_status === '招募中' || j.job_status === '開放中'), [jobs]);

  const jobKeywordSets = useMemo(() => {
    return activeJobs.map(j => {
      const skills = (j.key_skills || '').split(/[,，、\s]+/).map(s => s.trim().toLowerCase()).filter(s => s.length > 1);
      const titleWords = (j.position_name || '').toLowerCase().replace(/[()（）\n]/g, ' ').split(/[\s/]+/).filter(s => s.length > 1);
      return { keywords: [...skills, ...titleWords] };
    });
  }, [activeJobs]);

  const stats = useMemo(() => {
    const total = candidates.length;
    const byStatus: Record<string, number> = {};
    const bySource: Record<string, number> = {};
    const byConsultant: Record<string, number> = {};
    const byJob: Record<string, number> = {};
    let contactable = 0;
    let notContactable = 0;

    // Pipeline funnel
    const pipeline = { crawlerScreened: 0, notStarted: 0, aiRecommended: 0, contacted: 0, interview: 0, interview1: 0, interview2: 0, interview3: 0, offer: 0, onboard: 0, rejected: 0, notRecommended: 0, talentPool: 0, backup: 0, interviewFailed: 0 };

    // Monthly-weekly import stats: { '2026-02': { w1: 0, w2: 0, w3: 0, w4: 0, w5: 0 }, ... }
    const monthlyWeekly: Record<string, Record<string, number>> = {};

    candidates.forEach(c => {
      const st = normalizeStatus(c.status || '未知');
      const src = normalizeSource(c.source || '');
      byStatus[st] = (byStatus[st] || 0) + 1;
      bySource[src] = (bySource[src] || 0) + 1;
      if (c.consultant) {
        const cn = normalizeConsultant(c.consultant);
        byConsultant[cn] = (byConsultant[cn] || 0) + 1;
      }

      // Job distribution
      if (c.targetJobLabel) {
        byJob[c.targetJobLabel] = (byJob[c.targetJobLabel] || 0) + 1;
      }

      // Classification
      const cls = classifyContactable(c, activeJobs, jobKeywordSets);
      if (cls === 'contactable') contactable++;
      else notContactable++;

      // Pipeline
      switch (st) {
        case '爬蟲初篩': pipeline.crawlerScreened++; break;
        case '未開始': pipeline.notStarted++; break;
        case 'AI推薦': pipeline.aiRecommended++; break;
        case '聯繫階段': pipeline.contacted++; break;
        case '面試階段':
          pipeline.interview++;
          if (c.interviewRound === 1) pipeline.interview1++;
          else if (c.interviewRound === 2) pipeline.interview2++;
          else if (c.interviewRound === 3) pipeline.interview3++;
          else pipeline.interview1++; // 未設定預設第一階段
          break;
        case 'Offer': pipeline.offer++; break;
        case 'on board': pipeline.onboard++; break;
        case '婉拒': pipeline.rejected++; break;
        case '不推薦': pipeline.notRecommended++; break;
        case '人才庫': pipeline.talentPool++; break;
        case '備選人才': pipeline.backup++; break;
        case '面試沒過': pipeline.interviewFailed++; break;
      }

      // Monthly-weekly import
      if (c.createdAt) {
        try {
          const d = new Date(c.createdAt);
          const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          const weekOfMonth = Math.ceil(d.getDate() / 7); // 1-5
          const weekKey = `W${weekOfMonth}`;
          if (!monthlyWeekly[monthKey]) monthlyWeekly[monthKey] = {};
          monthlyWeekly[monthKey][weekKey] = (monthlyWeekly[monthKey][weekKey] || 0) + 1;
        } catch {}
      }
    });

    const statusSorted = Object.entries(byStatus).sort((a, b) => b[1] - a[1]);
    const sourceSorted = Object.entries(bySource).sort((a, b) => b[1] - a[1]);
    const consultantSorted = Object.entries(byConsultant).sort((a, b) => b[1] - a[1]);
    const jobSorted = Object.entries(byJob).sort((a, b) => b[1] - a[1]);
    // Build monthly data sorted by month
    const monthlyData = Object.entries(monthlyWeekly)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, weeks]) => ({
        month,
        label: (() => { const [y, m] = month.split('-'); return `${y}年${parseInt(m)}月`; })(),
        weeks: ['W1', 'W2', 'W3', 'W4', 'W5'].map(w => ({ week: w, count: weeks[w] || 0 })),
        total: Object.values(weeks).reduce((s, v) => s + v, 0),
      }));

    // BD metrics
    const clientSet = new Set<string>();
    const clientJobCount: Record<string, number> = {};
    let urgentCount = 0;
    let totalPositions = 0;
    activeJobs.forEach(j => {
      if (j.client_company) {
        clientSet.add(j.client_company);
        clientJobCount[j.client_company] = (clientJobCount[j.client_company] || 0) + 1;
      }
      if (isJobUrgent(j)) urgentCount++;
      totalPositions += parseInt(j.open_positions) || 1;
    });
    const clientJobSorted = Object.entries(clientJobCount).sort((a, b) => b[1] - a[1]);

    return {
      total, contactable, notContactable,
      byStatus: statusSorted, bySource: sourceSorted,
      byConsultant: consultantSorted, byJob: jobSorted,
      pipeline, monthlyData,
      bd: { clientCount: clientSet.size, urgentCount, totalPositions, clientJobSorted }
    };
  }, [candidates, activeJobs, jobKeywordSets]);

  // --- Render ---
  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <RefreshCw className="animate-spin text-indigo-500" size={32} />
      </div>
    );
  }

  const contactableRate = stats.total > 0 ? ((stats.contactable / stats.total) * 100).toFixed(1) : '0';

  // Pipeline stages for funnel
  const funnelStages = [
    { label: '爬蟲初篩', value: stats.pipeline.crawlerScreened, color: 'bg-orange-400' },
    { label: '未開始', value: stats.pipeline.notStarted, color: 'bg-slate-400' },
    { label: 'AI推薦', value: stats.pipeline.aiRecommended, color: 'bg-emerald-400' },
    { label: '備選人才', value: stats.pipeline.backup, color: 'bg-amber-400' },
    { label: '聯繫階段', value: stats.pipeline.contacted, color: 'bg-blue-400' },
    { label: '第一階段面試', value: stats.pipeline.interview1, color: 'bg-purple-400' },
    { label: '第二階段面試', value: stats.pipeline.interview2, color: 'bg-purple-500' },
    { label: '第三階段面試', value: stats.pipeline.interview3, color: 'bg-purple-600' },
    { label: 'Offer', value: stats.pipeline.offer, color: 'bg-green-500' },
    { label: 'On Board', value: stats.pipeline.onboard, color: 'bg-indigo-500' },
  ];

  const sideStages = [
    { label: '人才庫', value: stats.pipeline.talentPool, color: 'bg-cyan-400' },
    { label: '不推薦', value: stats.pipeline.notRecommended, color: 'bg-rose-400' },
    { label: '婉拒', value: stats.pipeline.rejected, color: 'bg-red-400' },
    { label: '面試沒過', value: stats.pipeline.interviewFailed, color: 'bg-orange-500' },
  ];

  // Current month for bar chart
  const currentMonthData = stats.monthlyData.length > 0
    ? stats.monthlyData[monthIdx >= 0 && monthIdx < stats.monthlyData.length ? monthIdx : stats.monthlyData.length - 1]
    : null;
  const effectiveMonthIdx = monthIdx >= 0 && monthIdx < stats.monthlyData.length ? monthIdx : stats.monthlyData.length - 1;
  const hasPrevMonth = effectiveMonthIdx > 0;
  const hasNextMonth = effectiveMonthIdx < stats.monthlyData.length - 1;
  // Max across ALL months for consistent bar scaling
  const allWeekCounts = stats.monthlyData.flatMap(m => m.weeks.map(w => w.count));
  const weeklyBarMax = Math.max(...allWeekCounts, 1);

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
            <BarChart3 className="text-indigo-500" size={28} />
            運營儀表板
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            最後更新: {lastRefresh.toLocaleTimeString('zh-TW')}
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm"
        >
          <RefreshCw size={16} />
          重新整理
        </button>
      </div>

      {/* ═══════════════════════════════════════════ */}
      {/* 招募區塊 — Recruitment Section              */}
      {/* ═══════════════════════════════════════════ */}
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-100 rounded-xl">
            <Users size={22} className="text-indigo-600" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900">招募</h3>
            <p className="text-xs text-slate-400">人選管理、招募漏斗、顧問工作量</p>
          </div>
        </div>

        {/* Recruitment KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={<Users size={20} className="text-indigo-500" />}
            label="系統總人選"
            value={stats.total}
            sub={`${activeJobs.length} 個進行中職缺`}
          />
          <StatCard
            icon={<UserCheck size={20} className="text-emerald-500" />}
            label="可聯繫"
            value={stats.contactable}
            sub={`佔 ${contactableRate}%`}
            color="bg-emerald-50/50"
          />
          <StatCard
            icon={<UserX size={20} className="text-orange-500" />}
            label="待處理（爬蟲初篩）"
            value={stats.pipeline.crawlerScreened}
            sub={`佔 ${stats.total > 0 ? ((stats.pipeline.crawlerScreened / stats.total) * 100).toFixed(1) : 0}%`}
            color="bg-orange-50/50"
          />
          <StatCard
            icon={<TrendingUp size={20} className="text-blue-500" />}
            label="聯繫中 + 面試"
            value={stats.pipeline.contacted + stats.pipeline.interview}
            sub={`轉化率 ${stats.total > 0 ? (((stats.pipeline.contacted + stats.pipeline.interview) / stats.total) * 100).toFixed(1) : 0}%`}
            color="bg-blue-50/50"
          />
        </div>

        {/* Monthly-Weekly Import Bar Chart — single month with navigation */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black text-slate-700 uppercase tracking-wide flex items-center gap-2">
              <CalendarDays size={16} className="text-indigo-400" />
              每週匯入人選
            </h3>
            {currentMonthData && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setMonthIdx(effectiveMonthIdx - 1)}
                  disabled={!hasPrevMonth}
                  className={`p-1.5 rounded-lg transition-all ${hasPrevMonth ? 'hover:bg-slate-100 text-slate-600' : 'text-slate-200 cursor-not-allowed'}`}
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="text-sm font-black text-slate-800 min-w-[100px] text-center">
                  {currentMonthData.label}
                </span>
                <button
                  onClick={() => setMonthIdx(effectiveMonthIdx + 1)}
                  disabled={!hasNextMonth}
                  className={`p-1.5 rounded-lg transition-all ${hasNextMonth ? 'hover:bg-slate-100 text-slate-600' : 'text-slate-200 cursor-not-allowed'}`}
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            )}
          </div>
          {!currentMonthData ? (
            <p className="text-sm text-slate-400">尚無匯入記錄</p>
          ) : (
            <div>
              {/* Vertical bar chart — 5 weeks */}
              <div className="flex items-end gap-3 sm:gap-6 justify-center px-4" style={{ height: 220 }}>
                {currentMonthData.weeks.map((w) => {
                  const barH = weeklyBarMax > 0 ? (w.count / weeklyBarMax) * 180 : 0;
                  return (
                    <div key={w.week} className="flex flex-col items-center gap-1.5 flex-1 max-w-[80px]">
                      <span className="text-xs font-black text-slate-600 tabular-nums h-5">
                        {w.count > 0 ? w.count : ''}
                      </span>
                      <div
                        className={`w-full rounded-t-lg transition-all duration-500 ${w.count > 0 ? 'bg-indigo-400' : 'bg-slate-100'}`}
                        style={{ height: Math.max(barH, 4) }}
                      />
                      <span className="text-xs font-bold text-slate-400">{w.week}</span>
                    </div>
                  );
                })}
              </div>
              {/* Summary for this month */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-sm">
                <span className="text-slate-400">本月合計</span>
                <span className="font-black text-slate-900">{currentMonthData.total} 位人選</span>
                <span className="text-slate-400">週平均</span>
                <span className="font-black text-indigo-600">
                  {(() => {
                    const activeWeeks = currentMonthData.weeks.filter(w => w.count > 0).length;
                    return activeWeeks > 0 ? Math.round(currentMonthData.total / activeWeeks) : 0;
                  })()}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Pipeline Funnel */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 shadow-sm">
          <h3 className="text-sm font-black text-slate-700 uppercase tracking-wide mb-4 flex items-center gap-2">
            <Filter size={16} className="text-indigo-400" />
            招募漏斗
          </h3>
          <div className="space-y-2">
            {funnelStages.map((stage) => {
              const pct = stats.total > 0 ? (stage.value / stats.total) * 100 : 0;
              return (
                <div key={stage.label} className="flex items-center gap-3">
                  <div className="w-8 text-right text-sm font-black text-slate-900 tabular-nums shrink-0">{stage.value}</div>
                  <div className="w-20 sm:w-24 text-right text-xs font-bold text-slate-500 shrink-0">{stage.label}</div>
                  <div className="flex-1 bg-slate-100 rounded-full h-7 overflow-hidden">
                    <div
                      className={`${stage.color} h-full rounded-full transition-all duration-700`}
                      style={{ width: `${Math.max(pct, 1)}%` }}
                    />
                  </div>
                  <div className="w-14 text-right text-xs font-mono text-slate-400 shrink-0">{pct.toFixed(1)}%</div>
                </div>
              );
            })}
            <div className="border-t border-dashed border-slate-200 my-2" />
            {sideStages.map((stage) => {
              const pct = stats.total > 0 ? (stage.value / stats.total) * 100 : 0;
              return (
                <div key={stage.label} className="flex items-center gap-3 opacity-70">
                  <div className="w-8 text-right text-sm font-black text-slate-600 tabular-nums shrink-0">{stage.value}</div>
                  <div className="w-20 sm:w-24 text-right text-xs font-bold text-slate-400 shrink-0">{stage.label}</div>
                  <div className="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden">
                    <div
                      className={`${stage.color} h-full rounded-full transition-all duration-700`}
                      style={{ width: `${Math.max(pct, 1)}%` }}
                    />
                  </div>
                  <div className="w-14 text-right text-xs font-mono text-slate-300 shrink-0">{pct.toFixed(1)}%</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Source Distribution */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 shadow-sm">
          <h3 className="text-sm font-black text-slate-700 uppercase tracking-wide mb-4 flex items-center gap-2">
            <Globe size={16} className="text-blue-400" />
            來源分佈
          </h3>
          <HBar
            items={stats.bySource.map(([label, value]) => ({
              label,
              value,
              color: label === 'LinkedIn' ? 'bg-blue-500' :
                     label === 'GitHub' ? 'bg-slate-700' :
                     label === '爬蟲匯入' ? 'bg-orange-400' :
                     label === 'Gmail' ? 'bg-red-400' :
                     label === '主動投遞' ? 'bg-emerald-400' : 'bg-slate-400',
            }))}
            total={stats.total}
          />
          <div className="mt-4 space-y-2">
            {stats.bySource.map(([label, value]) => (
              <div key={label} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  {SOURCE_ICONS[label] || <Eye size={14} className="text-slate-400" />}
                  <span className="font-medium text-slate-700">{label}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-black text-slate-900">{value}</span>
                  <span className="text-xs text-slate-400 w-12 text-right font-mono">
                    {((value / stats.total) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Consultant Workload */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 shadow-sm">
          <h3 className="text-sm font-black text-slate-700 uppercase tracking-wide mb-4 flex items-center gap-2">
            <Users size={16} className="text-amber-400" />
            顧問工作量
          </h3>
          {(() => {
            const realConsultants = stats.byConsultant.filter(([name]) => name !== '待指派' && name !== '爬蟲系統匯入');
            const systemEntries = stats.byConsultant.filter(([name]) => name === '待指派' || name === '爬蟲系統匯入');
            return (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {realConsultants.map(([name, count]) => (
                    <div key={name} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                      <div className="w-9 h-9 bg-slate-800 rounded-xl flex items-center justify-center text-white text-xs font-black shrink-0">
                        {name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-slate-800 truncate">{name}</div>
                        <div className="text-xs text-slate-400">{count} 位人選</div>
                      </div>
                      <div className="text-lg font-black text-slate-900">{count}</div>
                    </div>
                  ))}
                </div>
                {systemEntries.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">系統 / 未分配</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {systemEntries.map(([name, count]) => (
                        <div key={name} className="flex items-center gap-3 p-2.5 bg-slate-50/70 rounded-lg border border-dashed border-slate-200">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0 ${
                            name === '待指派' ? 'bg-orange-100 text-orange-600' : 'bg-slate-200 text-slate-500'
                          }`}>
                            {name === '待指派' ? '?' : <Bot size={14} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-slate-500 truncate">{name}</div>
                          </div>
                          <div className="text-base font-black text-slate-500">{count}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      </div>

      {/* ═══════════════════════════════════════════ */}
      {/* 開發區塊 — BD / Client Development Section  */}
      {/* ═══════════════════════════════════════════ */}
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-100 rounded-xl">
            <Handshake size={22} className="text-amber-600" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900">開發</h3>
            <p className="text-xs text-slate-400">BD 客戶開發、職缺管理、客戶分佈</p>
          </div>
        </div>

        {/* BD KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={<Building2 size={20} className="text-amber-500" />}
            label="合作客戶數"
            value={stats.bd.clientCount}
            sub="進行中客戶"
            color="bg-amber-50/50"
          />
          <StatCard
            icon={<Briefcase size={20} className="text-indigo-500" />}
            label="進行中職缺"
            value={activeJobs.length}
            sub={`共 ${stats.bd.totalPositions} 個開放名額`}
          />
          <StatCard
            icon={<AlertTriangle size={20} className="text-red-500" />}
            label="急缺職缺"
            value={stats.bd.urgentCount}
            sub={stats.bd.urgentCount > 0 ? '需優先處理' : '目前無急缺'}
            color={stats.bd.urgentCount > 0 ? 'bg-red-50/50' : 'bg-white'}
          />
          <StatCard
            icon={<Target size={20} className="text-purple-500" />}
            label="已配對人選"
            value={stats.byJob.reduce((sum, [, v]) => sum + v, 0)}
            sub={`未配對 ${stats.total - stats.byJob.reduce((sum, [, v]) => sum + v, 0)}`}
            color="bg-purple-50/50"
          />
        </div>

        {/* Client Distribution */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 shadow-sm">
          <h3 className="text-sm font-black text-slate-700 uppercase tracking-wide mb-4 flex items-center gap-2">
            <Building2 size={16} className="text-amber-400" />
            客戶職缺分佈
          </h3>
          {stats.bd.clientJobSorted.length === 0 ? (
            <p className="text-sm text-slate-400">尚無客戶資料</p>
          ) : (
            <div className="space-y-2">
              {stats.bd.clientJobSorted.map(([client, count]) => {
                const maxC = stats.bd.clientJobSorted[0]?.[1] || 1;
                const pct = (count / maxC) * 100;
                return (
                  <div key={client} className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center text-amber-700 text-xs font-black shrink-0">
                      {client[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-800 truncate">{client}</span>
                      </div>
                      <div className="mt-1 bg-slate-100 rounded-full h-3 overflow-hidden">
                        <div
                          className="bg-amber-400 h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(pct, 5)}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-lg font-black text-slate-900">{count}</div>
                      <div className="text-[10px] text-slate-400">職缺</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Candidate-Job Distribution */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 shadow-sm">
          <h3 className="text-sm font-black text-slate-700 uppercase tracking-wide mb-4 flex items-center gap-2">
            <Briefcase size={16} className="text-purple-400" />
            人選職缺分佈（已配對）
          </h3>
          {stats.byJob.length === 0 ? (
            <p className="text-sm text-slate-400">尚無人選配對職缺</p>
          ) : (
            <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
              {stats.byJob.map(([label, value], idx) => {
                const maxVal = stats.byJob[0]?.[1] || 1;
                return (
                  <div key={label} className="flex items-center gap-3 group">
                    <div className="w-6 text-right text-xs font-mono text-slate-300 shrink-0">{idx + 1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-5 bg-indigo-400/80 rounded transition-all duration-500 shrink-0"
                          style={{ width: `${Math.max((value / maxVal) * 60, 2)}%` }}
                        />
                        <span className="text-xs font-medium text-slate-600 truncate">{label}</span>
                      </div>
                    </div>
                    <span className="text-sm font-black text-slate-900 shrink-0 w-10 text-right">{value}</span>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-sm">
            <span className="text-slate-400">已配對人選</span>
            <span className="font-black text-slate-900">
              {stats.byJob.reduce((sum, [, v]) => sum + v, 0)} / {stats.total}
            </span>
            <span className="text-slate-400">未配對</span>
            <span className="font-black text-orange-600">
              {stats.total - stats.byJob.reduce((sum, [, v]) => sum + v, 0)}
            </span>
          </div>
        </div>

        {/* Active Jobs Grid */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 shadow-sm">
          <h3 className="text-sm font-black text-slate-700 uppercase tracking-wide mb-4 flex items-center gap-2">
            <Briefcase size={16} className="text-indigo-400" />
            進行中職缺 ({activeJobs.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[...activeJobs].sort((a, b) => {
              const aMatched = stats.byJob.find(([label]) => label.includes(a.position_name));
              const bMatched = stats.byJob.find(([label]) => label.includes(b.position_name));
              const aCount = aMatched ? aMatched[1] : 0;
              const bCount = bMatched ? bMatched[1] : 0;
              return bCount - aCount;
            }).map(j => {
              const matched = stats.byJob.find(([label]) => label.includes(j.position_name));
              const matchCount = matched ? matched[1] : 0;
              const isUrgent = isJobUrgent(j);
              return (
                <div
                  key={j.id}
                  onClick={() => setSelectedJob({ job: j, matchCount })}
                  className={`p-3 border rounded-xl transition-all cursor-pointer ${
                    isUrgent ? 'border-red-200 bg-red-50/30 hover:border-red-300' : 'border-slate-100 hover:border-indigo-200 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-bold text-slate-800 truncate flex-1">{j.position_name}</div>
                    {isUrgent && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500 text-white font-black shrink-0 animate-pulse">
                        急缺
                      </span>
                    )}
                  </div>
                  {j.client_company && <div className="text-xs text-slate-400 truncate">{j.client_company}</div>}
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-green-50 text-green-700">
                      招募中
                    </span>
                    <span className="text-xs text-slate-400">{matchCount} 位人選</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Job Detail Modal */}
      {selectedJob && (
        <JobDetailModal
          job={selectedJob.job}
          matchCount={selectedJob.matchCount}
          onClose={() => setSelectedJob(null)}
        />
      )}
    </div>
  );
};

export default OperationsDashboardPage;
