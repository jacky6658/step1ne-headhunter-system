import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Play, Trash2, RefreshCw, CheckCircle2, XCircle, Clock, Loader2, Search } from 'lucide-react';
import { getCrawlerTasks, createCrawlerTask, runCrawlerTask, deleteCrawlerTask, getTaskStatus } from '../../services/crawlerService';
import { CreateTaskModal } from '../../components/crawler/CreateTaskModal';
import type { CrawlerTask } from '../../crawlerTypes';

interface Props {
  crawlerOnline: boolean;
}

const STATUS_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  completed: { icon: CheckCircle2, color: 'text-emerald-500', label: '已完成' },
  running: { icon: Loader2, color: 'text-blue-500', label: '執行中' },
  pending: { icon: Clock, color: 'text-amber-500', label: '等待中' },
  failed: { icon: XCircle, color: 'text-red-500', label: '失敗' },
  paused: { icon: Clock, color: 'text-slate-400', label: '暫停' },
};

export const CrawlerManagementTab: React.FC<Props> = ({ crawlerOnline }) => {
  const [tasks, setTasks] = useState<CrawlerTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const pollingRef = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  const loadTasks = useCallback(async () => {
    if (!crawlerOnline) return;
    setLoading(true);
    try {
      const data = await getCrawlerTasks();
      const list = Array.isArray(data) ? data : (data.tasks || []);
      setTasks(list);
    } catch { /* ignore */ }
    setLoading(false);
  }, [crawlerOnline]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      Object.values(pollingRef.current).forEach(clearInterval);
    };
  }, []);

  const handleCreate = async (taskData: any) => {
    try {
      await createCrawlerTask(taskData);
      await loadTasks();
    } catch { /* ignore */ }
  };

  const handleRun = async (taskId: string) => {
    try {
      await runCrawlerTask(taskId);
      // 更新本地狀態
      setTasks(prev => prev.map(t =>
        t.id === taskId ? { ...t, status: 'running', progress: 0 } : t
      ));
      // 開始 polling
      startPolling(taskId);
    } catch { /* ignore */ }
  };

  const handleDelete = async (taskId: string) => {
    if (!confirm('確定要刪除此任務嗎？')) return;
    try {
      await deleteCrawlerTask(taskId);
      setTasks(prev => prev.filter(t => t.id !== taskId));
      // 停止 polling
      if (pollingRef.current[taskId]) {
        clearInterval(pollingRef.current[taskId]);
        delete pollingRef.current[taskId];
      }
    } catch { /* ignore */ }
  };

  const startPolling = (taskId: string) => {
    // 避免重複 polling
    if (pollingRef.current[taskId]) return;

    pollingRef.current[taskId] = setInterval(async () => {
      try {
        const status = await getTaskStatus(taskId);
        setTasks(prev => prev.map(t =>
          t.id === taskId ? {
            ...t,
            status: status.status || t.status,
            progress: status.progress ?? t.progress,
            progress_detail: status.progress_detail || t.progress_detail,
            last_result_count: status.last_result_count ?? t.last_result_count,
          } : t
        ));
        // 完成或失敗時停止 polling
        if (status.status === 'completed' || status.status === 'failed') {
          clearInterval(pollingRef.current[taskId]);
          delete pollingRef.current[taskId];
          // 重新載入完整列表
          setTimeout(loadTasks, 1000);
        }
      } catch {
        clearInterval(pollingRef.current[taskId]);
        delete pollingRef.current[taskId];
      }
    }, 5000);
  };

  // 自動 polling running tasks
  useEffect(() => {
    tasks.forEach(t => {
      if (t.status === 'running') startPolling(t.id);
    });
  }, [tasks.length]); // eslint-disable-line

  if (!crawlerOnline) {
    return (
      <div className="text-center py-16 text-slate-400">
        <Search size={48} className="mx-auto mb-4 opacity-30" />
        <p className="text-lg font-medium">爬蟲服務未連線</p>
        <p className="text-sm mt-1">請確認爬蟲服務已啟動後刷新頁面</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 頂部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-slate-900">任務列表</h3>
          <span className="text-xs text-slate-400">{tasks.length} 個任務</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadTasks}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            刷新
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            <Plus size={13} />
            新增任務
          </button>
        </div>
      </div>

      {/* 任務列表 */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-16">
          <Clock size={48} className="mx-auto mb-4 text-slate-200" />
          <p className="text-slate-400 font-medium">尚無爬蟲任務</p>
          <p className="text-xs text-slate-300 mt-1">點擊「新增任務」開始搜尋候選人</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map(task => {
            const statusConfig = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending;
            const StatusIcon = statusConfig.icon;
            const isRunning = task.status === 'running';

            return (
              <div key={task.id} className="bg-white border border-gray-100 rounded-xl p-4 hover:shadow-sm transition-all">
                <div className="flex items-center justify-between gap-3">
                  {/* 左側資訊 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold text-slate-900 truncate">{task.client_name}</span>
                      <span className="text-xs text-slate-400">|</span>
                      <span className="text-xs text-slate-600 truncate">{task.job_title}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-slate-400">
                      <span className={`flex items-center gap-1 font-medium ${statusConfig.color}`}>
                        <StatusIcon size={12} className={isRunning ? 'animate-spin' : ''} />
                        {statusConfig.label}
                      </span>
                      {task.primary_skills?.length > 0 && (
                        <span>技能: {task.primary_skills.slice(0, 3).join(', ')}{task.primary_skills.length > 3 ? '...' : ''}</span>
                      )}
                      {task.last_run && (
                        <span>最後執行: {new Date(task.last_run).toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                      )}
                      {task.last_result_count > 0 && (
                        <span className="font-medium text-emerald-500">{task.last_result_count} 人</span>
                      )}
                    </div>
                  </div>

                  {/* 進度條 */}
                  {isRunning && (
                    <div className="w-24 sm:w-32">
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${task.progress || 0}%` }} />
                      </div>
                      <p className="text-[10px] text-blue-500 mt-0.5 text-center">{task.progress || 0}%</p>
                    </div>
                  )}

                  {/* 操作按鈕 */}
                  <div className="flex items-center gap-1">
                    {!isRunning && (
                      <button
                        onClick={() => handleRun(task.id)}
                        className="p-1.5 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all"
                        title="立即執行"
                      >
                        <Play size={14} />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(task.id)}
                      disabled={isRunning}
                      className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-all disabled:opacity-30"
                      title="刪除"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* 執行中的詳細進度 */}
                {isRunning && task.progress_detail && (
                  <div className="mt-2 px-2 py-1.5 bg-blue-50 rounded-lg text-[10px] text-blue-600">
                    {task.progress_detail}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 建立任務 Modal */}
      <CreateTaskModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={handleCreate}
      />
    </div>
  );
};

export default CrawlerManagementTab;
