import React, { useState, useEffect, useCallback } from 'react';
import { UserProfile } from '../types';
import { API_BASE_URL } from '../constants';
import { ScrollText, RefreshCw, Bot, User, Filter } from 'lucide-react';

interface SystemLogPageProps {
  userProfile: UserProfile;
}

interface SystemLog {
  id: number;
  action: string;
  actor: string;
  actor_type: 'HUMAN' | 'AIBOT';
  candidate_id: number | null;
  candidate_name: string | null;
  detail: Record<string, any> | null;
  created_at: string;
}

const ACTION_CONFIG: Record<string, { label: string; color: string }> = {
  PIPELINE_CHANGE: { label: 'Pipeline 異動',  color: 'bg-blue-100 text-blue-700' },
  IMPORT_CREATE:   { label: '新增候選人',      color: 'bg-green-100 text-green-700' },
  IMPORT_UPDATE:   { label: '補充候選人資料',  color: 'bg-teal-100 text-teal-700' },
  BULK_IMPORT:     { label: '批量匯入',        color: 'bg-indigo-100 text-indigo-700' },
  UPDATE:          { label: '更新資料',        color: 'bg-amber-100 text-amber-700' },
  DELETE:          { label: '刪除候選人',      color: 'bg-red-100 text-red-700' },
};

function formatDetail(log: SystemLog): string {
  if (!log.detail) return '';
  const d = log.detail;
  if (log.action === 'PIPELINE_CHANGE' && d.from !== undefined) {
    return `${d.from || '未開始'} → ${d.to}`;
  }
  if (log.action === 'PIPELINE_CHANGE' && d.status) {
    return `更新為「${d.status}」`;
  }
  if (log.action === 'BULK_IMPORT') {
    return `新增 ${d.created} 筆，更新 ${d.updated} 筆，失敗 ${d.failed} 筆（共 ${d.total} 筆）`;
  }
  if (log.action === 'UPDATE' && d.fields) {
    return `更新欄位：${d.fields.join(', ')}`;
  }
  return JSON.stringify(d);
}

export function SystemLogPage({ userProfile }: SystemLogPageProps) {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [actorSearch, setActorSearch] = useState('');

  const loadLogs = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: '500' });
      if (typeFilter !== 'all') params.set('type', typeFilter);
      if (actionFilter !== 'all') params.set('action', actionFilter);
      if (actorSearch.trim()) params.set('actor', actorSearch.trim());

      const res = await fetch(`${API_BASE_URL}/api/system-logs?${params}`);
      const json = await res.json();
      if (json.success) setLogs(json.data);
    } catch (err) {
      console.error('載入操作日誌失敗:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [typeFilter, actionFilter, actorSearch]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadLogs();
  };

  const humanCount = logs.filter(l => l.actor_type === 'HUMAN').length;
  const aibotCount = logs.filter(l => l.actor_type === 'AIBOT').length;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
              <ScrollText className="w-6 h-6 text-indigo-600" />
              操作日誌
            </h2>
            <p className="text-slate-500 mt-1 text-sm">追蹤顧問人為操作與 AIbot API 呼叫的完整紀錄</p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold transition disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            重新整理
          </button>
        </div>

        {/* 統計 */}
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-center">
            <p className="text-xs text-slate-500">總操作筆數</p>
            <p className="text-lg font-black text-slate-900">{logs.length}</p>
          </div>
          <div className="rounded-xl bg-blue-50 border border-blue-100 p-3 text-center">
            <p className="text-xs text-blue-600 flex items-center justify-center gap-1">
              <User className="w-3 h-3" /> 人為操作
            </p>
            <p className="text-lg font-black text-blue-700">{humanCount}</p>
          </div>
          <div className="rounded-xl bg-purple-50 border border-purple-100 p-3 text-center">
            <p className="text-xs text-purple-600 flex items-center justify-center gap-1">
              <Bot className="w-3 h-3" /> AIbot 操作
            </p>
            <p className="text-lg font-black text-purple-700">{aibotCount}</p>
          </div>
        </div>

        {/* 篩選 */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-slate-500">操作者類型</label>
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="all">全部</option>
              <option value="HUMAN">人為操作</option>
              <option value="AIBOT">AIbot</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500">操作類型</label>
            <select
              value={actionFilter}
              onChange={e => setActionFilter(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="all">全部</option>
              {Object.entries(ACTION_CONFIG).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500">搜尋操作者</label>
            <div className="relative mt-1">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={actorSearch}
                onChange={e => setActorSearch(e.target.value)}
                placeholder="顧問名稱 / AIbot-xxx"
                className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 日誌列表 */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-10 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto" />
            <p className="mt-3 text-slate-500 text-sm">載入中...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-16 text-center">
            <ScrollText className="mx-auto w-10 h-10 text-slate-300 mb-3" />
            <p className="text-slate-500 text-sm">尚無操作紀錄</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">時間</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">操作者</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">類型</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">操作</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">候選人</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">詳情</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map(log => {
                  const actionCfg = ACTION_CONFIG[log.action] || { label: log.action, color: 'bg-gray-100 text-gray-700' };
                  return (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3 whitespace-nowrap text-xs text-slate-400 font-mono">
                        {new Date(log.created_at).toLocaleString('zh-TW', {
                          month: '2-digit', day: '2-digit',
                          hour: '2-digit', minute: '2-digit', second: '2-digit'
                        })}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                            log.actor_type === 'AIBOT' ? 'bg-purple-100' : 'bg-blue-100'
                          }`}>
                            {log.actor_type === 'AIBOT'
                              ? <Bot size={12} className="text-purple-600" />
                              : <User size={12} className="text-blue-600" />
                            }
                          </div>
                          <span className="text-sm font-medium text-slate-800">{log.actor}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          log.actor_type === 'AIBOT' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {log.actor_type === 'AIBOT' ? 'AIbot' : '人為'}
                        </span>
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${actionCfg.color}`}>
                          {actionCfg.label}
                        </span>
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap text-sm text-slate-700">
                        {log.candidate_name
                          ? <span>{log.candidate_name} <span className="text-slate-400 text-xs">#{log.candidate_id}</span></span>
                          : <span className="text-slate-400">—</span>
                        }
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-500 max-w-xs truncate">
                        {formatDetail(log)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
