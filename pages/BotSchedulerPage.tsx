import React, { useState, useEffect, useCallback } from 'react';
import { UserProfile } from '../types';
import { API_BASE_URL } from '../constants';
import {
  Bot, Clock, Play, Pause, Save, RefreshCw, CheckCircle2,
  XCircle, AlertCircle, Briefcase, Calendar, Activity,
  ChevronDown, ChevronUp, Info
} from 'lucide-react';

interface BotConfig {
  enabled: boolean;
  schedule_hours: number;
  target_job_ids: number[];
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

interface Props {
  userProfile: UserProfile;
}

export const BotSchedulerPage: React.FC<Props> = ({ userProfile }) => {
  const [config, setConfig] = useState<BotConfig>({
    enabled: false,
    schedule_hours: 12,
    target_job_ids: [],
    last_run_at: null,
    last_run_status: null,
    last_run_summary: null,
  });
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [logs, setLogs] = useState<BotLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [logsExpanded, setLogsExpanded] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [cfgRes, jobsRes, logsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/bot-config`),
        fetch(`${API_BASE_URL}/api/jobs`),
        fetch(`${API_BASE_URL}/api/bot-logs`),
      ]);
      const cfgJson = await cfgRes.json();
      const jobsJson = await jobsRes.json();
      const logsJson = await logsRes.json();

      if (cfgJson.success) setConfig(cfgJson.data);
      if (jobsJson.success) {
        setJobs((jobsJson.data || []).map((j: any) => ({
          id: j.id,
          title: j.title,
          company: j.client_name || j.company || '',
          status: j.status || '',
        })));
      }
      if (logsJson.success) setLogs(logsJson.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/bot-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: config.enabled,
          schedule_hours: config.schedule_hours,
          target_job_ids: config.target_job_ids,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSaveMsg('設定已儲存');
      } else {
        setSaveMsg('儲存失敗：' + json.error);
      }
    } catch (e: any) {
      setSaveMsg('儲存失敗：' + e.message);
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(null), 3000);
    }
  };

  const toggleJobSelection = (jobId: number) => {
    setConfig(prev => {
      const ids = prev.target_job_ids.includes(jobId)
        ? prev.target_job_ids.filter(id => id !== jobId)
        : [...prev.target_job_ids, jobId];
      return { ...prev, target_job_ids: ids };
    });
  };

  const formatTime = (iso: string | null) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false });
  };

  const nextRunText = () => {
    if (!config.enabled) return '排程已停用';
    if (!config.last_run_at) return '尚未執行過';
    const last = new Date(config.last_run_at).getTime();
    const next = new Date(last + config.schedule_hours * 3600000);
    const now = Date.now();
    if (next.getTime() <= now) return '即將執行';
    const diffH = Math.floor((next.getTime() - now) / 3600000);
    const diffM = Math.floor(((next.getTime() - now) % 3600000) / 60000);
    return `約 ${diffH > 0 ? diffH + ' 小時 ' : ''}${diffM} 分後`;
  };

  const statusIcon = (status: string | null) => {
    if (status === 'success') return <CheckCircle2 size={16} className="text-green-500" />;
    if (status === 'error') return <XCircle size={16} className="text-red-500" />;
    if (status === 'running') return <RefreshCw size={16} className="text-blue-500 animate-spin" />;
    return <AlertCircle size={16} className="text-slate-400" />;
  };

  const activeJobs = jobs.filter(j => j.status === '招募中');
  const otherJobs = jobs.filter(j => j.status !== '招募中');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* 頁首說明 */}
      <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 flex gap-3">
        <Info size={18} className="text-violet-600 mt-0.5 shrink-0" />
        <div className="text-sm text-violet-800">
          <p className="font-semibold mb-1">Bot 閉環流程說明</p>
          <p>Bot 會定時執行：<span className="font-medium">爬取 LinkedIn 候選人 → 匯入 DB → 確定性評分（6 維演算法）→ 自動移入「AI推薦」欄</span>。</p>
          <p className="mt-1">不接 LLM，評分成本 <span className="font-semibold">$0</span>；若需 AI 結論文字，可在 Python 腳本中啟用 Claude API（約 NT$100-200/月）。</p>
        </div>
      </div>

      {/* 狀態卡 */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
          <Activity size={18} className="text-indigo-600" />
          <h2 className="font-bold text-slate-800">Bot 目前狀態</h2>
        </div>
        <div className="p-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {/* 啟用狀態 */}
          <div className="text-center">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2 ${config.enabled ? 'bg-green-100' : 'bg-slate-100'}`}>
              {config.enabled
                ? <Play size={22} className="text-green-600" />
                : <Pause size={22} className="text-slate-400" />}
            </div>
            <p className="text-xs text-slate-500">狀態</p>
            <p className={`text-sm font-bold ${config.enabled ? 'text-green-600' : 'text-slate-500'}`}>
              {config.enabled ? '運行中' : '已停用'}
            </p>
          </div>
          {/* 排程間隔 */}
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center mx-auto mb-2">
              <Clock size={22} className="text-indigo-600" />
            </div>
            <p className="text-xs text-slate-500">排程間隔</p>
            <p className="text-sm font-bold text-indigo-700">每 {config.schedule_hours} 小時</p>
          </div>
          {/* 上次執行 */}
          <div className="text-center">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2 ${config.last_run_status === 'success' ? 'bg-green-100' : config.last_run_status === 'error' ? 'bg-red-100' : 'bg-slate-100'}`}>
              {statusIcon(config.last_run_status)}
            </div>
            <p className="text-xs text-slate-500">上次執行</p>
            <p className="text-sm font-bold text-slate-700 text-xs">{formatTime(config.last_run_at)}</p>
          </div>
          {/* 下次執行 */}
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-2">
              <Calendar size={22} className="text-amber-600" />
            </div>
            <p className="text-xs text-slate-500">預計下次</p>
            <p className="text-sm font-bold text-amber-700">{nextRunText()}</p>
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

      {/* 排程設定 */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
          <Clock size={18} className="text-indigo-600" />
          <h2 className="font-bold text-slate-800">排程設定</h2>
        </div>
        <div className="p-6 space-y-5">
          {/* 啟用開關 */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-700">啟用定時爬蟲</p>
              <p className="text-xs text-slate-500 mt-0.5">開啟後 Bot 將按排程間隔自動執行</p>
            </div>
            <button
              onClick={() => setConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
              className={`relative w-12 h-6 rounded-full transition-colors ${config.enabled ? 'bg-green-500' : 'bg-slate-300'}`}
            >
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${config.enabled ? 'translate-x-7' : 'translate-x-1'}`} />
            </button>
          </div>

          {/* 排程間隔 */}
          <div>
            <p className="text-sm font-semibold text-slate-700 mb-2">執行間隔</p>
            <div className="flex gap-2 flex-wrap">
              {[6, 12, 24, 48].map(h => (
                <button
                  key={h}
                  onClick={() => setConfig(prev => ({ ...prev, schedule_hours: h }))}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                    config.schedule_hours === h
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                  }`}
                >
                  每 {h} 小時
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 目標職缺 */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Briefcase size={18} className="text-indigo-600" />
            <h2 className="font-bold text-slate-800">目標職缺</h2>
            <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              已選 {config.target_job_ids.length} 個
            </span>
          </div>
          <button
            onClick={() => setConfig(prev => ({
              ...prev,
              target_job_ids: prev.target_job_ids.length === activeJobs.length
                ? [] : activeJobs.map(j => j.id)
            }))}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
          >
            {config.target_job_ids.length === activeJobs.length ? '取消全選' : '全選招募中'}
          </button>
        </div>
        <div className="p-4">
          {jobs.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">尚無職缺資料</p>
          ) : (
            <>
              {activeJobs.length > 0 && (
                <div className="space-y-1 mb-3">
                  <p className="text-xs font-semibold text-green-700 uppercase tracking-wide px-2 mb-1">招募中</p>
                  {activeJobs.map(job => (
                    <label
                      key={job.id}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                        config.target_job_ids.includes(job.id)
                          ? 'bg-indigo-50 border border-indigo-200'
                          : 'hover:bg-slate-50 border border-transparent'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={config.target_job_ids.includes(job.id)}
                        onChange={() => toggleJobSelection(job.id)}
                        className="w-4 h-4 rounded accent-indigo-600"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{job.title}</p>
                        <p className="text-xs text-slate-500 truncate">{job.company}</p>
                      </div>
                      <span className="text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded-full shrink-0">招募中</span>
                    </label>
                  ))}
                </div>
              )}
              {otherJobs.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-2 mb-1">其他職缺</p>
                  {otherJobs.map(job => (
                    <label
                      key={job.id}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                        config.target_job_ids.includes(job.id)
                          ? 'bg-indigo-50 border border-indigo-200'
                          : 'hover:bg-slate-50 border border-transparent'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={config.target_job_ids.includes(job.id)}
                        onChange={() => toggleJobSelection(job.id)}
                        className="w-4 h-4 rounded accent-indigo-600"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">{job.title}</p>
                        <p className="text-xs text-slate-500 truncate">{job.company}</p>
                      </div>
                      <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full shrink-0">{job.status || '—'}</span>
                    </label>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* 儲存按鈕 */}
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

      {/* Bot 執行紀錄 */}
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
                        {log.candidate_name && (
                          <span className="text-xs text-slate-700 font-medium">{log.candidate_name}</span>
                        )}
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

      {/* Zeabur 部署提示 */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
        <p className="text-xs font-semibold text-slate-600 mb-2">Zeabur Cron Job 設定方式</p>
        <ol className="text-xs text-slate-500 space-y-1 list-decimal list-inside">
          <li>Zeabur 專案 → Bot 服務 → <strong>Scheduler</strong> 分頁</li>
          <li>新增排程：<code className="bg-slate-100 px-1 rounded">0 */12 * * *</code>（每 12 小時）</li>
          <li>Command：<code className="bg-slate-100 px-1 rounded">python one-bot-pipeline.py</code></li>
          <li>Bot 啟動後讀取此頁面設定，僅爬取已勾選的目標職缺</li>
        </ol>
      </div>

    </div>
  );
};

export default BotSchedulerPage;
