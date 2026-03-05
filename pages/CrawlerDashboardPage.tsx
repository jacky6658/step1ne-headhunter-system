import React, { useState, useEffect, useCallback } from 'react';
import { UserProfile } from '../types';
import {
  Activity, RefreshCw, Wifi, WifiOff, Settings,
  BarChart3, Search, TrendingUp, Target
} from 'lucide-react';
import { getCrawlerHealth, getCrawlerStats, takeMetricsSnapshot, getCrawlerConfig, saveCrawlerConfig } from '../services/crawlerService';
import { CrawlerScoringTab } from './crawler/CrawlerScoringTab';
import { CrawlerManagementTab } from './crawler/CrawlerManagementTab';
import { EfficiencyStatsTab } from './crawler/EfficiencyStatsTab';
import { KpiDashboardTab } from './crawler/KpiDashboardTab';
import type { CrawlerStats } from '../crawlerTypes';

interface Props {
  userProfile: UserProfile;
}

type TabId = 'scoring' | 'management' | 'efficiency' | 'kpi';

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'scoring', label: '評分總覽', icon: BarChart3 },
  { id: 'management', label: '爬蟲管理', icon: Search },
  { id: 'efficiency', label: '效益統計', icon: TrendingUp },
  { id: 'kpi', label: 'KPI 儀表板', icon: Target },
];

export const CrawlerDashboardPage: React.FC<Props> = ({ userProfile }) => {
  const [activeTab, setActiveTab] = useState<TabId>('scoring');
  const [crawlerOnline, setCrawlerOnline] = useState<boolean | null>(null);
  const [stats, setStats] = useState<CrawlerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [crawlerUrl, setCrawlerUrl] = useState('');

  const checkHealth = useCallback(async () => {
    try {
      const result = await getCrawlerHealth();
      if (result.crawler_offline) {
        setCrawlerOnline(false);
      } else {
        setCrawlerOnline(true);
      }
    } catch {
      setCrawlerOnline(false);
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const data = await getCrawlerStats();
      if (!data.crawler_offline) {
        setStats(data);
      }
    } catch { /* ignore */ }
  }, []);

  const loadConfig = useCallback(async () => {
    try {
      const result = await getCrawlerConfig();
      if (result.config?.url) setCrawlerUrl(result.config.url);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([checkHealth(), loadStats(), loadConfig()]);
      setLoading(false);
    };
    init();
    // 每 30 秒刷新連線狀態
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, [checkHealth, loadStats, loadConfig]);

  const handleSnapshot = async () => {
    setSnapshotLoading(true);
    try {
      await takeMetricsSnapshot();
      await loadStats();
    } catch { /* ignore */ }
    setSnapshotLoading(false);
  };

  const handleSaveConfig = async () => {
    try {
      await saveCrawlerConfig(crawlerUrl);
      setShowConfig(false);
      await checkHealth();
    } catch { /* ignore */ }
  };

  const handleRefresh = async () => {
    setLoading(true);
    await Promise.all([checkHealth(), loadStats()]);
    setLoading(false);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
      {/* 頂部狀態列 */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Activity size={20} className="text-indigo-600" />
            <span className="font-bold text-slate-900">爬蟲整合儀表板</span>
            {crawlerOnline === null ? (
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-slate-300 animate-pulse" />
                檢測中...
              </span>
            ) : crawlerOnline ? (
              <span className="text-xs text-emerald-600 flex items-center gap-1.5 bg-emerald-50 px-2 py-0.5 rounded-full">
                <Wifi size={12} />
                爬蟲已連線
              </span>
            ) : (
              <span className="text-xs text-red-600 flex items-center gap-1.5 bg-red-50 px-2 py-0.5 rounded-full">
                <WifiOff size={12} />
                爬蟲未連線
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-all disabled:opacity-50"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              刷新
            </button>
            <button
              onClick={handleSnapshot}
              disabled={snapshotLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-all disabled:opacity-50"
            >
              {snapshotLoading ? (
                <RefreshCw size={13} className="animate-spin" />
              ) : (
                <TrendingUp size={13} />
              )}
              更新快照
            </button>
            <button
              onClick={() => setShowConfig(!showConfig)}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-all"
              title="爬蟲設定"
            >
              <Settings size={16} />
            </button>
          </div>
        </div>

        {/* 設定面板 */}
        {showConfig && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-3">
            <label className="text-xs text-slate-500 whitespace-nowrap">爬蟲 URL:</label>
            <input
              type="text"
              value={crawlerUrl}
              onChange={(e) => setCrawlerUrl(e.target.value)}
              placeholder="http://localhost:5000"
              className="flex-1 text-xs border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
            />
            <button
              onClick={handleSaveConfig}
              className="px-3 py-1.5 text-xs font-medium bg-slate-800 text-white rounded-lg hover:bg-slate-700"
            >
              儲存
            </button>
          </div>
        )}

        {/* 爬蟲離線警告 */}
        {crawlerOnline === false && (
          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
            <strong>爬蟲服務未啟動</strong>：評分總覽和爬蟲管理功能需要爬蟲服務運行中。效益統計和 KPI 儀表板使用本地資料庫，仍可正常使用。
          </div>
        )}
      </div>

      {/* Tab 切換 */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex border-b border-gray-100">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              <tab.icon size={16} />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden text-xs">{tab.label.slice(0, 4)}</span>
            </button>
          ))}
        </div>

        {/* Tab 內容 */}
        <div className="p-4 sm:p-6">
          {activeTab === 'scoring' && (
            <CrawlerScoringTab crawlerOnline={crawlerOnline || false} stats={stats} />
          )}
          {activeTab === 'management' && (
            <CrawlerManagementTab crawlerOnline={crawlerOnline || false} />
          )}
          {activeTab === 'efficiency' && (
            <EfficiencyStatsTab />
          )}
          {activeTab === 'kpi' && (
            <KpiDashboardTab stats={stats} />
          )}
        </div>
      </div>
    </div>
  );
};

export default CrawlerDashboardPage;
