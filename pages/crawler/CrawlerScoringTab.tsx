import React, { useState, useEffect, useCallback } from 'react';
import { Users, Award, Search, RefreshCw, ExternalLink, Upload, CheckCircle2, Circle } from 'lucide-react';
import { getCrawlerCandidates, getCrawlerStats, rescoreCandidates, getScoreDetail, importToSystem, checkImportStatus } from '../../services/crawlerService';
import { ScoreDetailModal } from '../../components/crawler/ScoreDetailModal';
import type { CrawlerCandidate, CrawlerStats, ScoreBreakdown, ImportResult } from '../../crawlerTypes';

interface Props {
  crawlerOnline: boolean;
  stats: CrawlerStats | null;
}

const GRADE_BADGE: Record<string, string> = {
  A: 'bg-emerald-100 text-emerald-700',
  B: 'bg-blue-100 text-blue-700',
  C: 'bg-amber-100 text-amber-700',
  D: 'bg-red-100 text-red-700',
};

const SOURCE_BADGE: Record<string, string> = {
  linkedin: 'bg-blue-50 text-blue-600',
  github: 'bg-slate-100 text-slate-700',
  'li+ocr': 'bg-purple-50 text-purple-600',
};

export const CrawlerScoringTab: React.FC<Props> = ({ crawlerOnline, stats }) => {
  const [candidates, setCandidates] = useState<CrawlerCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [rescoring, setRescoring] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [filterGrade, setFilterGrade] = useState('');
  const [filterClient, setFilterClient] = useState('');

  // Score detail modal
  const [showDetail, setShowDetail] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState<ScoreBreakdown | null>(null);
  const [detailName, setDetailName] = useState('');

  // Import 匯入功能
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importedNames, setImportedNames] = useState<Set<string>>(new Set());
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [showImportResult, setShowImportResult] = useState(false);

  const loadCandidates = useCallback(async () => {
    if (!crawlerOnline) return;
    setLoading(true);
    try {
      const params: any = { limit: 200 };
      if (filterGrade) params.grade = filterGrade;
      if (filterClient) params.client = filterClient;
      const data = await getCrawlerCandidates(params);
      const list = Array.isArray(data) ? data : (data.candidates || data.data || []);
      setCandidates(list);
    } catch { /* ignore */ }
    setLoading(false);
  }, [crawlerOnline, filterGrade, filterClient]);

  useEffect(() => {
    loadCandidates();
  }, [loadCandidates]);

  // 載入後檢查哪些已匯入
  useEffect(() => {
    if (candidates.length === 0) return;
    const names = candidates.map(c => c.name).filter(Boolean);
    if (names.length === 0) return;

    checkImportStatus(names)
      .then(res => {
        if (res.existing) {
          setImportedNames(new Set(res.existing.map(e => e.name.trim().toLowerCase())));
        }
      })
      .catch(() => { /* ignore */ });
  }, [candidates]);

  const handleRescore = async () => {
    setRescoring(true);
    try {
      const params: any = {};
      if (filterClient) params.client_name = filterClient;
      await rescoreCandidates(params);
      await loadCandidates();
    } catch { /* ignore */ }
    setRescoring(false);
  };

  const handleShowDetail = async (candidate: CrawlerCandidate) => {
    setDetailName(candidate.name);
    setShowDetail(true);
    setDetailLoading(true);
    setDetailData(null);

    try {
      // 嘗試從 score_detail 欄位直接解析
      if (candidate.score_detail) {
        try {
          const parsed = typeof candidate.score_detail === 'string'
            ? JSON.parse(candidate.score_detail)
            : candidate.score_detail;
          setDetailData(parsed);
          setDetailLoading(false);
          return;
        } catch { /* 繼續用 API */ }
      }
      const data = await getScoreDetail(candidate.id);
      setDetailData(data);
    } catch { /* ignore */ }
    setDetailLoading(false);
  };

  // ── 勾選邏輯 ──
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(c => c.id)));
    }
  };

  // ── 匯入 ──
  const handleImport = async () => {
    const selected = candidates.filter(c => selectedIds.has(c.id));
    if (selected.length === 0) return;

    setImporting(true);
    setImportResult(null);
    try {
      const result = await importToSystem(selected, 'Crawler');
      setImportResult(result);
      setShowImportResult(true);

      // 更新已匯入名單
      if (result.data) {
        const newImported = new Set(importedNames);
        [...(result.data.created || []), ...(result.data.updated || [])].forEach(c => {
          newImported.add((c.name || '').trim().toLowerCase());
        });
        setImportedNames(newImported);
      }

      // 清除選取
      setSelectedIds(new Set());

      // 5秒後自動隱藏結果
      setTimeout(() => setShowImportResult(false), 6000);
    } catch (err: any) {
      setImportResult({
        success: false,
        message: `匯入失敗: ${err.message}`,
        created_count: 0,
        updated_count: 0,
        failed_count: 0,
        data: { created: [], updated: [] },
        failed: [],
      });
      setShowImportResult(true);
      setTimeout(() => setShowImportResult(false), 5000);
    }
    setImporting(false);
  };

  const isImported = (name: string) =>
    importedNames.has((name || '').trim().toLowerCase());

  // 前端搜尋
  const filtered = candidates.filter(c => {
    if (!searchText) return true;
    const q = searchText.toLowerCase();
    return (
      (c.name || '').toLowerCase().includes(q) ||
      (c.skills || []).some(s => s.toLowerCase().includes(q)) ||
      (c.title || '').toLowerCase().includes(q) ||
      (c.company || '').toLowerCase().includes(q)
    );
  });

  // KPI 計算
  const gradeA = stats?.grades?.A || filtered.filter(c => c.grade === 'A').length;
  const gradeB = stats?.grades?.B || filtered.filter(c => c.grade === 'B').length;
  const total = stats?.total_candidates || candidates.length;
  const avgScore = candidates.length > 0
    ? Math.round(candidates.reduce((sum, c) => sum + (c.score || 0), 0) / candidates.length * 10) / 10
    : 0;

  const clients = stats?.clients ? Object.keys(stats.clients) : [];

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
      {/* 匯入結果提示 */}
      {showImportResult && importResult && (
        <div className={`rounded-xl p-3 text-sm flex items-center gap-2 transition-all ${
          importResult.success
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {importResult.success ? <CheckCircle2 size={16} /> : <Circle size={16} />}
          <span className="font-medium">{importResult.message}</span>
          <button
            onClick={() => setShowImportResult(false)}
            className="ml-auto text-xs opacity-60 hover:opacity-100"
          >
            &times;
          </button>
        </div>
      )}

      {/* KPI 卡片 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-50 rounded-xl p-3 sm:p-4">
          <p className="text-xs text-slate-500 mb-1">總評分人數</p>
          <p className="text-xl sm:text-2xl font-black text-slate-900">{total}</p>
        </div>
        <div className="bg-emerald-50 rounded-xl p-3 sm:p-4">
          <p className="text-xs text-emerald-600 mb-1">A 級</p>
          <p className="text-xl sm:text-2xl font-black text-emerald-700">{gradeA}</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-3 sm:p-4">
          <p className="text-xs text-blue-600 mb-1">B 級</p>
          <p className="text-xl sm:text-2xl font-black text-blue-700">{gradeB}</p>
        </div>
        <div className="bg-indigo-50 rounded-xl p-3 sm:p-4">
          <p className="text-xs text-indigo-600 mb-1">平均分數</p>
          <p className="text-xl sm:text-2xl font-black text-indigo-700">{avgScore}</p>
        </div>
      </div>

      {/* 篩選列 + 匯入按鈕 */}
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        {clients.length > 0 && (
          <select
            value={filterClient}
            onChange={e => setFilterClient(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="">全部客戶</option>
            {clients.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <select
          value={filterGrade}
          onChange={e => setFilterGrade(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        >
          <option value="">全部等級</option>
          <option value="A">A 級</option>
          <option value="B">B 級</option>
          <option value="C">C 級</option>
          <option value="D">D 級</option>
        </select>
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            placeholder="搜尋姓名、技能、職稱..."
            className="w-full text-xs border border-slate-200 rounded-lg pl-8 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
        <button
          onClick={handleRescore}
          disabled={rescoring}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 whitespace-nowrap"
        >
          <RefreshCw size={13} className={rescoring ? 'animate-spin' : ''} />
          重新評分
        </button>
        {selectedIds.size > 0 && (
          <button
            onClick={handleImport}
            disabled={importing}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 whitespace-nowrap transition-all"
          >
            <Upload size={13} className={importing ? 'animate-bounce' : ''} />
            {importing ? '匯入中...' : `匯入到系統 (${selectedIds.size})`}
          </button>
        )}
      </div>

      {/* 候選人表格 */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <Users size={48} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">尚無候選人資料</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500">
                <th className="px-2 py-2 text-center font-medium w-8">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && selectedIds.size === filtered.length}
                    onChange={toggleSelectAll}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/20 cursor-pointer"
                  />
                </th>
                <th className="px-3 py-2 text-left font-medium">姓名</th>
                <th className="px-3 py-2 text-center font-medium">分數</th>
                <th className="px-3 py-2 text-center font-medium">等級</th>
                <th className="px-3 py-2 text-center font-medium">來源</th>
                <th className="px-3 py-2 text-left font-medium hidden md:table-cell">符合技能</th>
                <th className="px-3 py-2 text-left font-medium hidden lg:table-cell">缺少技能</th>
                <th className="px-3 py-2 text-center font-medium">狀態</th>
                <th className="px-3 py-2 text-center font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(c => {
                let scoreDetail: any = null;
                try {
                  scoreDetail = c.score_detail ? (typeof c.score_detail === 'string' ? JSON.parse(c.score_detail) : c.score_detail) : null;
                } catch { /* ignore */ }
                const matched = scoreDetail?.matched_skills || [];
                const missing = scoreDetail?.missing_critical || [];
                const imported = isImported(c.name);

                return (
                  <tr key={c.id} className={`hover:bg-slate-50/50 transition-colors ${selectedIds.has(c.id) ? 'bg-indigo-50/30' : ''}`}>
                    <td className="px-2 py-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(c.id)}
                        onChange={() => toggleSelect(c.id)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/20 cursor-pointer"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-slate-900">{c.name || '(unnamed)'}</div>
                      <div className="text-[10px] text-slate-400 truncate max-w-[150px]">{c.title || c.bio?.slice(0, 30)}</div>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="font-bold text-slate-800">{c.score || 0}</span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${GRADE_BADGE[c.grade] || 'bg-slate-100 text-slate-500'}`}>
                        {c.grade || '-'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] ${SOURCE_BADGE[c.source] || 'bg-slate-50 text-slate-500'}`}>
                        {c.source === 'linkedin' ? 'LI' : c.source === 'github' ? 'GH' : c.source === 'li+ocr' ? 'OCR' : c.source}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 hidden md:table-cell">
                      <div className="flex flex-wrap gap-0.5">
                        {matched.slice(0, 4).map((s: string) => (
                          <span key={s} className="text-[10px] px-1 py-0.5 bg-emerald-50 text-emerald-600 rounded">{s}</span>
                        ))}
                        {matched.length > 4 && <span className="text-[10px] text-slate-400">+{matched.length - 4}</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 hidden lg:table-cell">
                      <div className="flex flex-wrap gap-0.5">
                        {missing.slice(0, 3).map((s: string) => (
                          <span key={s} className="text-[10px] px-1 py-0.5 bg-red-50 text-red-400 rounded">{s}</span>
                        ))}
                        {missing.length > 3 && <span className="text-[10px] text-slate-400">+{missing.length - 3}</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {imported ? (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-600 font-medium">
                          <CheckCircle2 size={12} />
                          已匯入
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-400">
                          <Circle size={10} />
                          未匯入
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleShowDetail(c)}
                          className="px-2 py-1 text-[10px] font-medium bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100 transition-all"
                        >
                          詳情
                        </button>
                        {(c.linkedin_url || c.github_url) && (
                          <a
                            href={c.linkedin_url || c.github_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 text-slate-400 hover:text-slate-600"
                          >
                            <ExternalLink size={12} />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Score Detail Modal */}
      <ScoreDetailModal
        isOpen={showDetail}
        onClose={() => setShowDetail(false)}
        candidateName={detailName}
        detail={detailData}
        loading={detailLoading}
      />
    </div>
  );
};

export default CrawlerScoringTab;
