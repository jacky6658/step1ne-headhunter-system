import React, { useState, useEffect, useCallback } from 'react';
import { UserProfile } from '../types';
import { API_BASE_URL } from '../constants';
import {
  Bot, Clock, Play, Pause, Save, RefreshCw, CheckCircle2,
  XCircle, AlertCircle, Briefcase, Calendar, Activity,
  ChevronDown, ChevronUp, Info, Zap, Timer, Search, X as XIcon, User
} from 'lucide-react';

// ──────────────── 型別定義 ────────────────

type ScheduleType = 'daily' | 'weekly' | 'interval' | 'once';

interface BotConfig {
  enabled: boolean;
  schedule_type: ScheduleType;
  schedule_time: string;          // "HH:MM"，daily / weekly 用
  schedule_days: number[];        // 0=週日 … 6=週六，weekly 用
  schedule_interval_hours: number; // interval 用
  schedule_once_at: string;       // ISO datetime，once 用
  target_job_ids: number[];
  consultant: string;             // 負責顧問 displayName
  last_run_at: string | null;
  last_run_status: 'success' | 'error' | 'running' | null;
  last_run_summary: string | null;
}

interface JobOption {
  id: number;
  title: string;
  company: string;
  status: string;
}

interface BotLog {
  id: number;
  action: string;
  actor: string;
  candidate_name: string | null;
  detail: any;
  created_at: string;
}

interface Props { userProfile: UserProfile; }

// ──────────────── 輔助 ────────────────

const DAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

/** 根據設定產生可讀的排程說明 */
function describeSchedule(cfg: BotConfig): string {
  if (!cfg.enabled) return '排程已停用';
  switch (cfg.schedule_type) {
    case 'daily':
      return `每天 ${cfg.schedule_time}`;
    case 'weekly': {
      const days = cfg.schedule_days.map(d => `週${DAY_LABELS[d]}`).join('、');
      return `每週 ${days} ${cfg.schedule_time}`;
    }
    case 'interval':
      return `每 ${cfg.schedule_interval_hours} 小時執行一次`;
    case 'once':
      return cfg.schedule_once_at
        ? `一次性：${new Date(cfg.schedule_once_at).toLocaleString('zh-TW', { hour12: false })}`
        : '一次性（未設定時間）';
    default:
      return '—';
  }
}

/** 根據設定產生 cron expression（供 Zeabur Scheduler 使用） */
function toCronExpr(cfg: BotConfig): string {
  if (!cfg.enabled) return '（排程停用）';
  const [hh, mm] = cfg.schedule_time.split(':').map(Number);
  switch (cfg.schedule_type) {
    case 'daily':
      return `${mm ?? 0} ${hh ?? 9} * * *`;
    case 'weekly': {
      const days = cfg.schedule_days.join(',') || '1';
      return `${mm ?? 0} ${hh ?? 9} * * ${days}`;
    }
    case 'interval':
      return `0 */${cfg.schedule_interval_hours} * * *`;
    case 'once':
      if (!cfg.schedule_once_at) return '（未設定時間）';
      const d = new Date(cfg.schedule_once_at);
      return `${d.getMinutes()} ${d.getHours()} ${d.getDate()} ${d.getMonth() + 1} *`;
    default:
      return '—';
  }
}

const DEFAULT_CONFIG: BotConfig = {
  enabled: false,
  schedule_type: 'daily',
  schedule_time: '09:00',
  schedule_days: [1],            // 週一
  schedule_interval_hours: 12,
  schedule_once_at: '',
  target_job_ids: [],
  consultant: '',
  last_run_at: null,
  last_run_status: null,
  last_run_summary: null,
};

// ──────────────── 主元件 ────────────────

export const BotSchedulerPage: React.FC<Props> = ({ userProfile }) => {
  const [config, setConfig] = useState<BotConfig>(DEFAULT_CONFIG);
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [logs, setLogs] = useState<BotLog[]>([]);
  const [consultants, setConsultants] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [runMsg, setRunMsg] = useState<string | null>(null);
  const [jobsExpanded, setJobsExpanded] = useState(false);
  const [logsExpanded, setLogsExpanded] = useState(false);
  const [jobSearch, setJobSearch] = useState('');
  const [filterCompany, setFilterCompany] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // ─── 載入資料 ───
  const safeJson = async (res: Response, fallback: any = { success: false, data: [] }) => {
    if (!res.ok) return fallback;
    try { return await res.json(); } catch { return fallback; }
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const me = userProfile.displayName;
      const [cfgRes, jobsRes, logsRes, usersRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/bot-config?consultant=${encodeURIComponent(me)}`),
        fetch(`${API_BASE_URL}/api/jobs`),
        fetch(`${API_BASE_URL}/api/bot-logs`),
        fetch(`${API_BASE_URL}/api/users`),
      ]);
      const cfgJson   = await safeJson(cfgRes,   { success: false, data: {} });
      const jobsJson  = await safeJson(jobsRes,  { success: false, data: [] });
      const logsJson  = await safeJson(logsRes,  { success: false, data: [] });
      const usersJson = await safeJson(usersRes, { success: false, data: [] });

      if (cfgJson.success) {
        setConfig(prev => ({ ...DEFAULT_CONFIG, ...cfgJson.data, consultant: me }));
      }
      if (jobsJson.success) {
        setJobs((jobsJson.data || []).map((j: any) => ({
          id: j.id,
          title: j.position_name || j.title || '(未命名)',
          company: j.client_company || j.client_name || j.company || '',
          status: j.job_status || j.status || '',
        })));
      }
      if (logsJson.success) setLogs(logsJson.data || []);
      if (usersJson.success) setConsultants(usersJson.data || []);
    } catch {
      // 靜默失敗，本機開發環境部分 API 不存在屬正常
    } finally {
      setLoading(false);
    }
  }, [userProfile.displayName]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ─── 儲存設定 ───
  const handleSave = async () => {
    setSaving(true); setSaveMsg(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/bot-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: config.enabled,
          schedule_type: config.schedule_type,
          schedule_time: config.schedule_time,
          schedule_days: config.schedule_days,
          schedule_interval_hours: config.schedule_interval_hours,
          schedule_once_at: config.schedule_once_at,
          target_job_ids: config.target_job_ids,
          consultant: config.consultant,
        }),
      });
      const json = await res.json();
      setSaveMsg(json.success ? '設定已儲存' : '儲存失敗：' + json.error);
    } catch (e: any) {
      setSaveMsg('儲存失敗：' + e.message);
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(null), 3000);
    }
  };

  // ─── 立即執行 ───
  const handleRunNow = async () => {
    if (config.target_job_ids.length === 0) {
      setRunMsg('請先選擇至少一個目標職缺');
      setTimeout(() => setRunMsg(null), 3000);
      return;
    }
    setRunning(true); setRunMsg(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/bot/run-now`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_job_ids: config.target_job_ids }),
      });
      const json = await res.json();
      setRunMsg(json.success ? 'Bot 已啟動，執行中（背景運行）' : '啟動失敗：' + json.error);
      if (json.success) setTimeout(() => fetchAll(), 3000);
    } catch (e: any) {
      setRunMsg('啟動失敗：' + e.message);
    } finally {
      setRunning(false);
      setTimeout(() => setRunMsg(null), 5000);
    }
  };

  const MAX_JOBS = 5;

  // ─── 職缺勾選 ───
  const toggleJob = (jobId: number) => {
    setConfig(prev => {
      if (prev.target_job_ids.includes(jobId)) {
        return { ...prev, target_job_ids: prev.target_job_ids.filter(id => id !== jobId) };
      }
      if (prev.target_job_ids.length >= MAX_JOBS) return prev; // 超過上限，不加入
      return { ...prev, target_job_ids: [...prev.target_job_ids, jobId] };
    });
  };

  const toggleDay = (d: number) => {
    setConfig(prev => ({
      ...prev,
      schedule_days: prev.schedule_days.includes(d)
        ? prev.schedule_days.filter(x => x !== d)
        : [...prev.schedule_days, d].sort(),
    }));
  };

  const formatTime = (iso: string | null) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false });
  };

  const statusIcon = (status: string | null) => {
    if (status === 'success') return <CheckCircle2 size={16} className="text-green-500" />;
    if (status === 'error')   return <XCircle size={16} className="text-red-500" />;
    if (status === 'running') return <RefreshCw size={16} className="text-blue-500 animate-spin" />;
    return <AlertCircle size={16} className="text-slate-400" />;
  };

  const ACTIVE_STATUSES = ['招募中', '開放中', '開發中'];

  // 下拉選單選項（去重）
  const companyOptions = Array.from(new Set(jobs.map(j => j.company).filter(Boolean))).sort();
  const statusOptions  = Array.from(new Set(jobs.map(j => j.status).filter(Boolean))).sort();

  const filteredJobs = jobs.filter(j => {
    if (filterCompany && j.company !== filterCompany) return false;
    if (filterStatus  && j.status  !== filterStatus)  return false;
    if (jobSearch.trim()) {
      const q = jobSearch.toLowerCase();
      if (!j.title.toLowerCase().includes(q)) return false;
    }
    return true;
  });
  const activeJobs = filteredJobs.filter(j => ACTIVE_STATUSES.includes(j.status));
  const otherJobs  = filteredJobs.filter(j => !ACTIVE_STATUSES.includes(j.status));

  const hasFilter = !!filterCompany || !!filterStatus || !!jobSearch.trim();
  const clearFilters = () => { setFilterCompany(''); setFilterStatus(''); setJobSearch(''); };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* ── 說明橫幅 ── */}
      <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 flex gap-3">
        <Info size={18} className="text-violet-600 mt-0.5 shrink-0" />
        <div className="text-sm text-violet-800">
          <p className="font-semibold mb-1">Bot 閉環流程</p>
          <p>爬取 LinkedIn 候選人 → 匯入 DB → 確定性 6 維評分 → 自動移入「AI推薦」欄。</p>
          <p className="mt-1">不接 LLM，評分成本 <strong>$0</strong>；如需 AI 結論文字可在 Python 腳本啟用 Claude API（約 NT$100-200/月）。</p>
        </div>
      </div>

      {/* ── 狀態卡 ── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
          <Activity size={18} className="text-indigo-600" />
          <h2 className="font-bold text-slate-800">Bot 目前狀態</h2>
        </div>
        <div className="p-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="text-center">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2 ${config.enabled ? 'bg-green-100' : 'bg-slate-100'}`}>
              {config.enabled ? <Play size={22} className="text-green-600" /> : <Pause size={22} className="text-slate-400" />}
            </div>
            <p className="text-xs text-slate-500">排程狀態</p>
            <p className={`text-sm font-bold ${config.enabled ? 'text-green-600' : 'text-slate-500'}`}>
              {config.enabled ? '已啟用' : '已停用'}
            </p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center mx-auto mb-2">
              <Timer size={22} className="text-indigo-600" />
            </div>
            <p className="text-xs text-slate-500">排程設定</p>
            <p className="text-xs font-bold text-indigo-700 leading-tight">{describeSchedule(config)}</p>
          </div>
          <div className="text-center">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2 ${config.last_run_status === 'success' ? 'bg-green-100' : config.last_run_status === 'error' ? 'bg-red-100' : 'bg-slate-100'}`}>
              {statusIcon(config.last_run_status)}
            </div>
            <p className="text-xs text-slate-500">上次執行</p>
            <p className="text-xs font-bold text-slate-700">{formatTime(config.last_run_at)}</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-2">
              <Briefcase size={22} className="text-amber-600" />
            </div>
            <p className="text-xs text-slate-500">目標職缺</p>
            <p className="text-sm font-bold text-amber-700">{config.target_job_ids.length} 個</p>
          </div>
        </div>
        {config.last_run_summary && (
          <div className="px-6 pb-4">
            <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-600">
              <span className="font-semibold text-slate-700">上次摘要：</span>{config.last_run_summary}
            </div>
          </div>
        )}
      </div>

      {/* ── 立即執行 ── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Zap size={18} className="text-amber-500" />
            <h2 className="font-bold text-slate-800">立即執行一次</h2>
          </div>
          <p className="text-sm text-slate-500">不受排程限制，直接觸發 Bot 對已選職缺執行一次完整爬取流程。</p>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <button
            onClick={handleRunNow}
            disabled={running || config.target_job_ids.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 disabled:opacity-50 transition-all"
          >
            {running ? <RefreshCw size={16} className="animate-spin" /> : <Play size={16} />}
            {running ? '執行中...' : '立即執行'}
          </button>
          {runMsg && (
            <span className={`text-xs font-medium ${runMsg.includes('失敗') || runMsg.includes('請先') ? 'text-red-600' : 'text-green-600'}`}>
              {runMsg}
            </span>
          )}
        </div>
      </div>

      {/* ── 負責顧問 ── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
          <User size={18} className="text-indigo-600" />
          <h2 className="font-bold text-slate-800">負責顧問</h2>
        </div>
        <div className="p-5 flex items-center gap-4">
          {/* 顯示目前登入的顧問（設定與自己帳號綁定，無法更改） */}
          <div className="flex items-center gap-3 px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-xl">
            <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">
              {userProfile.displayName?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div>
              <p className="text-sm font-semibold text-indigo-800">{userProfile.displayName}</p>
              <p className="text-xs text-indigo-500">當前登入帳號</p>
            </div>
            <CheckCircle2 size={16} className="text-indigo-600 ml-1" />
          </div>
          <div className="text-sm text-slate-500">
            <p>此頁設定只屬於你自己的帳號。</p>
            <p className="text-xs text-slate-400 mt-0.5">爬取到的候選人將自動指派給你。</p>
          </div>
        </div>

        {/* 其他顧問的 Bot 狀態（只讀，給團隊透明度） */}
        {consultants.filter(n => n !== userProfile.displayName).length > 0 && (
          <div className="px-5 pb-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">其他顧問 Bot 狀態</p>
            <div className="flex flex-wrap gap-2">
              {consultants.filter(n => n !== userProfile.displayName).map(name => (
                <span key={name} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
                  <User size={12} />
                  {name}
                </span>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-2">各顧問設定相互獨立，不會互相干擾。</p>
          </div>
        )}
      </div>

      {/* ── 目標職缺 ── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <button
          onClick={() => setJobsExpanded(v => !v)}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Briefcase size={18} className="text-indigo-600" />
            <h2 className="font-bold text-slate-800">目標職缺</h2>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              config.target_job_ids.length >= MAX_JOBS
                ? 'bg-amber-100 text-amber-700'
                : 'bg-slate-100 text-slate-500'
            }`}>
              已選 {config.target_job_ids.length} / {MAX_JOBS}
            </span>
            {config.target_job_ids.length > 0 && !jobsExpanded && (
              <span className="text-xs text-slate-400 hidden sm:inline">
                （點擊展開修改）
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {jobsExpanded && (
              <span
                role="button"
                tabIndex={0}
                onClick={e => {
                  e.stopPropagation();
                  setConfig(prev => ({
                    ...prev,
                    target_job_ids: prev.target_job_ids.length > 0
                      ? []
                      : activeJobs.slice(0, MAX_JOBS).map(j => j.id),
                  }));
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.stopPropagation();
                    setConfig(prev => ({
                      ...prev,
                      target_job_ids: prev.target_job_ids.length > 0
                        ? []
                        : activeJobs.slice(0, MAX_JOBS).map(j => j.id),
                    }));
                  }
                }}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer select-none"
              >
                {config.target_job_ids.length > 0 ? '清除全部' : `全選前 ${Math.min(activeJobs.length, MAX_JOBS)} 個`}
              </span>
            )}
            {jobsExpanded ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
          </div>
        </button>

        {jobsExpanded && (<>
        {/* 篩選列 */}
        <div className="px-4 pt-3 pb-2 space-y-2">
          {/* 第一列：公司 + 狀態 下拉 */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <select
                value={filterCompany}
                onChange={e => setFilterCompany(e.target.value)}
                className="w-full appearance-none pl-3 pr-7 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50 text-slate-700"
              >
                <option value="">全部公司</option>
                {companyOptions.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
            <div className="flex-1 relative">
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="w-full appearance-none pl-3 pr-7 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50 text-slate-700"
              >
                <option value="">全部狀態</option>
                {statusOptions.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
          {/* 第二列：職缺名稱關鍵字 */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="搜尋職缺名稱..."
              value={jobSearch}
              onChange={e => setJobSearch(e.target.value)}
              className="w-full pl-8 pr-8 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50"
            />
            {jobSearch && (
              <button onClick={() => setJobSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <XIcon size={14} />
              </button>
            )}
          </div>
          {/* 清除篩選 */}
          {hasFilter && (
            <div className="flex items-center justify-between pt-0.5">
              <p className="text-xs text-slate-500">篩選結果：{filteredJobs.length} 個職缺</p>
              <button onClick={clearFilters} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1">
                <XIcon size={11} />清除篩選
              </button>
            </div>
          )}
        </div>

        <div className="p-4 pt-1 space-y-1">
          {jobs.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">尚無職缺資料</p>
          ) : filteredJobs.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">找不到符合條件的職缺</p>
          ) : (
            <>
              {activeJobs.length > 0 && (
                <>
                  <p className="text-xs font-semibold text-green-700 uppercase tracking-wide px-2 mb-1">招募中</p>
                  {activeJobs.map(job => (
                    <JobRow key={job.id} job={job} selected={config.target_job_ids.includes(job.id)} onToggle={() => toggleJob(job.id)} disabled={!config.target_job_ids.includes(job.id) && config.target_job_ids.length >= MAX_JOBS} />
                  ))}
                </>
              )}
              {otherJobs.length > 0 && (
                <>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-2 mt-3 mb-1">其他職缺</p>
                  {otherJobs.map(job => (
                    <JobRow key={job.id} job={job} selected={config.target_job_ids.includes(job.id)} onToggle={() => toggleJob(job.id)} disabled={!config.target_job_ids.includes(job.id) && config.target_job_ids.length >= MAX_JOBS} />
                  ))}
                </>
              )}
            </>
          )}
        </div>
        </>)}
      </div>

      {/* ── 排程設定 ── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
          <Clock size={18} className="text-indigo-600" />
          <h2 className="font-bold text-slate-800">定時排程設定</h2>
        </div>
        <div className="p-6 space-y-6">

          {/* 啟用開關 */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-700">啟用定時排程</p>
              <p className="text-xs text-slate-500 mt-0.5">開啟後依下方設定自動執行</p>
            </div>
            <button
              onClick={() => setConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
              className={`relative w-12 h-6 rounded-full transition-colors ${config.enabled ? 'bg-green-500' : 'bg-slate-300'}`}
            >
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${config.enabled ? 'translate-x-7' : 'translate-x-1'}`} />
            </button>
          </div>

          {/* 排程類型 */}
          <div>
            <p className="text-sm font-semibold text-slate-700 mb-3">排程類型</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {([
                { type: 'daily',    label: '每天定時',   icon: '📅' },
                { type: 'weekly',   label: '每週指定天', icon: '📆' },
                { type: 'interval', label: '固定間隔',   icon: '🔁' },
                { type: 'once',     label: '一次性',     icon: '⚡' },
              ] as { type: ScheduleType; label: string; icon: string }[]).map(({ type, label, icon }) => (
                <button
                  key={type}
                  onClick={() => setConfig(prev => ({ ...prev, schedule_type: type }))}
                  className={`flex flex-col items-center gap-1 px-3 py-3 rounded-xl border text-sm font-medium transition-all ${
                    config.schedule_type === type
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                  }`}
                >
                  <span className="text-lg">{icon}</span>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* 依類型顯示對應輸入 */}
          {(config.schedule_type === 'daily' || config.schedule_type === 'weekly') && (
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-2">執行時間</p>
              <input
                type="time"
                value={config.schedule_time}
                onChange={e => setConfig(prev => ({ ...prev, schedule_time: e.target.value }))}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          )}

          {config.schedule_type === 'weekly' && (
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-2">執行星期</p>
              <div className="flex gap-2 flex-wrap">
                {DAY_LABELS.map((label, d) => (
                  <button
                    key={d}
                    onClick={() => toggleDay(d)}
                    className={`w-10 h-10 rounded-full text-sm font-bold border transition-all ${
                      config.schedule_days.includes(d)
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {config.schedule_type === 'interval' && (
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-2">執行間隔</p>
              <div className="flex gap-2 flex-wrap">
                {[4, 6, 8, 12, 24, 48].map(h => (
                  <button
                    key={h}
                    onClick={() => setConfig(prev => ({ ...prev, schedule_interval_hours: h }))}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                      config.schedule_interval_hours === h
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                    }`}
                  >
                    每 {h} 小時
                  </button>
                ))}
              </div>
            </div>
          )}

          {config.schedule_type === 'once' && (
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-2">執行時間</p>
              <input
                type="datetime-local"
                value={config.schedule_once_at ? config.schedule_once_at.slice(0, 16) : ''}
                onChange={e => setConfig(prev => ({
                  ...prev,
                  schedule_once_at: e.target.value ? new Date(e.target.value).toISOString() : '',
                }))}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          )}

          {/* Cron 表達式預覽 */}
          {config.enabled && (
            <div className="bg-slate-800 rounded-xl p-4">
              <p className="text-xs text-slate-400 mb-1 font-mono">Zeabur Cron Expression</p>
              <p className="text-lg font-mono font-bold text-green-400">{toCronExpr(config)}</p>
              <p className="text-xs text-slate-400 mt-2">{describeSchedule(config)}</p>
              <p className="text-xs text-slate-500 mt-3">複製此表達式至 Zeabur → Bot 服務 → Scheduler → 新增排程</p>
            </div>
          )}
        </div>
      </div>

      {/* ── 儲存按鈕 ── */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-60 transition-all"
        >
          {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? '儲存中...' : '儲存設定'}
        </button>
        {saveMsg && (
          <span className={`text-sm font-medium ${saveMsg.includes('失敗') ? 'text-red-600' : 'text-green-600'}`}>
            {saveMsg}
          </span>
        )}
      </div>

      {/* ── Bot 執行紀錄 ── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <button
          onClick={() => setLogsExpanded(v => !v)}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Bot size={18} className="text-indigo-600" />
            <h2 className="font-bold text-slate-800">Bot 執行紀錄</h2>
            <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{logs.length} 筆</span>
          </div>
          {logsExpanded ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
        </button>
        {logsExpanded && (
          <div className="border-t border-slate-100">
            {logs.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">尚無 Bot 執行紀錄</p>
            ) : (
              <div className="divide-y divide-slate-50 max-h-80 overflow-y-auto">
                {logs.map(log => (
                  <div key={log.id} className="px-5 py-3 hover:bg-slate-50">
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-violet-700 bg-violet-50 px-2 py-0.5 rounded">{log.action}</span>
                        <span className="text-xs text-slate-500">{log.actor}</span>
                        {log.candidate_name && <span className="text-xs text-slate-700 font-medium">{log.candidate_name}</span>}
                      </div>
                      <span className="text-xs text-slate-400">{formatTime(log.created_at)}</span>
                    </div>
                    {log.detail && (
                      <p className="text-xs text-slate-500 truncate">
                        {typeof log.detail === 'string' ? log.detail : JSON.stringify(log.detail)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
};

// ──────────────── 子元件 ────────────────

const ACTIVE_STATUS_COLORS: Record<string, string> = {
  '招募中': 'text-green-700 bg-green-100',
  '開放中': 'text-blue-700 bg-blue-100',
  '開發中': 'text-violet-700 bg-violet-100',
};

const JobRow: React.FC<{ job: JobOption; selected: boolean; onToggle: () => void; disabled?: boolean }> = ({ job, selected, onToggle, disabled }) => (
  <label
    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
      disabled && !selected
        ? 'opacity-40 cursor-not-allowed border border-transparent'
        : selected
          ? 'bg-indigo-50 border border-indigo-200 cursor-pointer'
          : 'hover:bg-slate-50 border border-transparent cursor-pointer'
    }`}
  >
    <input
      type="checkbox"
      checked={selected}
      onChange={onToggle}
      disabled={disabled && !selected}
      className="w-4 h-4 rounded accent-indigo-600 disabled:cursor-not-allowed"
    />
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-slate-800 truncate">{job.title}</p>
      <p className="text-xs text-slate-500 truncate">{job.company}</p>
    </div>
    <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
      ACTIVE_STATUS_COLORS[job.status] || 'text-slate-500 bg-slate-100'
    }`}>
      {job.status || '—'}
    </span>
  </label>
);

export default BotSchedulerPage;
