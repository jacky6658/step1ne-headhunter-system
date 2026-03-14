import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile, Candidate } from '../types';
import { getApiUrl, getAuthHeaders } from '../config/api';
import { GRADE_CONFIG, TIER_CONFIG, HEAT_CONFIG, computeHeatLevel, CANDIDATE_STATUS_CONFIG } from '../constants';
import { TalentCard } from '../components/TalentCard';
import { CandidateModal } from '../components/CandidateModal';
import { PageGuide } from '../components/PageGuide';
import { OnboardingTour, TourStep } from '../components/OnboardingTour';
import {
  Search, Filter, RefreshCw, LayoutGrid, Flame, Building2, GitBranch,
  X, ChevronDown, Users, Shield, MousePointerClick, Zap, Download
} from 'lucide-react';

interface TalentBoardPageProps {
  userProfile: UserProfile;
}

type BoardMode = 'grade' | 'source' | 'heat' | 'pipeline';

// Board column config per mode
const BOARD_COLUMNS: Record<BoardMode, { key: string; label: string; color: string; bg: string }[]> = {
  grade: [
    { key: 'A', label: 'A 級 — 核心人選', color: 'text-emerald-700', bg: 'bg-emerald-50' },
    { key: 'B', label: 'B 級 — 合格人選', color: 'text-blue-700', bg: 'bg-blue-50' },
    { key: 'C', label: 'C 級 — 觀察人選', color: 'text-amber-700', bg: 'bg-amber-50' },
    { key: 'D', label: 'D 級 — 不適合', color: 'text-red-700', bg: 'bg-red-50' },
    { key: 'ungraded', label: '未分級', color: 'text-gray-500', bg: 'bg-gray-50' },
  ],
  source: [
    { key: 'T1', label: 'T1 — 一線大廠', color: 'text-violet-700', bg: 'bg-violet-50' },
    { key: 'T2', label: 'T2 — 知名企業', color: 'text-indigo-700', bg: 'bg-indigo-50' },
    { key: 'T3', label: 'T3 — 一般企業', color: 'text-slate-600', bg: 'bg-slate-50' },
    { key: 'untiered', label: '未分類', color: 'text-gray-500', bg: 'bg-gray-50' },
  ],
  heat: [
    { key: 'Hot', label: '熱門 — 積極求職', color: 'text-red-600', bg: 'bg-red-50' },
    { key: 'Warm', label: '溫和 — 近期互動', color: 'text-amber-600', bg: 'bg-amber-50' },
    { key: 'Cold', label: '冷門 — 無近期互動', color: 'text-blue-500', bg: 'bg-blue-50' },
  ],
  pipeline: [
    { key: '未開始', label: '未開始', color: 'text-slate-600', bg: 'bg-slate-50' },
    { key: 'AI推薦', label: 'AI推薦', color: 'text-violet-700', bg: 'bg-violet-50' },
    { key: '聯繫階段', label: '聯繫階段', color: 'text-blue-700', bg: 'bg-blue-50' },
    { key: '面試階段', label: '面試階段', color: 'text-indigo-700', bg: 'bg-indigo-50' },
    { key: 'Offer', label: 'Offer', color: 'text-amber-700', bg: 'bg-amber-50' },
    { key: 'on board', label: 'On Board', color: 'text-green-700', bg: 'bg-green-50' },
  ],
};

function classifyCandidate(c: any, mode: BoardMode): string {
  switch (mode) {
    case 'grade':
      return c.gradeLevel || c.grade_level || 'ungraded';
    case 'source':
      return c.sourceTier || c.source_tier || 'untiered';
    case 'heat':
      return computeHeatLevel(c);
    case 'pipeline':
      return c.status || '未開始';
  }
}

export function TalentBoardPage({ userProfile }: TalentBoardPageProps) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [boardMode, setBoardMode] = useState<BoardMode>('grade');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);

  // Filters
  const [filterGrade, setFilterGrade] = useState<string>('');
  const [filterHeat, setFilterHeat] = useState<string>('');
  const [filterConsultant, setFilterConsultant] = useState<string>('');
  const [filterPrecisionOnly, setFilterPrecisionOnly] = useState(false);
  const [filterAlmostReady, setFilterAlmostReady] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [tourActive, setTourActive] = useState(false);

  const guideSteps = [
    { icon: <LayoutGrid size={14} className="text-blue-600" />, title: '四種看板模式', desc: 'Grade / Source / Heat / Pipeline 切換不同分類維度查看人選' },
    { icon: <Search size={14} className="text-blue-600" />, title: '搜尋與篩選', desc: '搜尋姓名、職位、技能，用篩選器縮小範圍' },
    { icon: <MousePointerClick size={14} className="text-blue-600" />, title: '點擊卡片', desc: '點擊人選卡片查看詳細資料並編輯核心欄位' },
    { icon: <Shield size={14} className="text-blue-600" />, title: '權限說明', desc: '非管理員只能看到自己負責的人選' },
  ];

  const tourSteps: TourStep[] = [
    { target: 'board-mode-switcher', title: '看板模式切換', content: '切換 Grade / Source / Heat / Pipeline 四種看板視角，從不同維度管理人選', placement: 'bottom' },
    { target: 'board-search', title: '快速搜尋', content: '輸入姓名、職位、技能或公司名快速找到目標人選', placement: 'bottom' },
    { target: 'board-filter', title: '進階篩選', content: '按等級、熱度、負責顧問篩選，快速縮小範圍', placement: 'bottom' },
    { target: 'board-columns', title: '看板欄位', content: '人選按分類排列在各欄位中，點擊卡片可查看詳情並編輯', placement: 'top' },
    { target: 'board-count', title: '人選統計', content: '顯示目前篩選條件下的人選總數', placement: 'bottom' },
  ];

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(getApiUrl('/candidates?limit=2000'), { headers: getAuthHeaders() });
      const json = await res.json();
      const arr = json.data || json.candidates || json;
      setCandidates(Array.isArray(arr) ? arr : []);
    } catch (e) {
      console.error('TalentBoard fetch error:', e);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // Get unique consultants for filter
  const consultants = useMemo(() => {
    const set = new Set<string>();
    candidates.forEach(c => { if (c.consultant) set.add(c.consultant); });
    return Array.from(set).sort();
  }, [candidates]);

  // Role-based filtering: non-admin only sees their own candidates
  const myCandidates = useMemo(() => {
    if (userProfile.role === 'ADMIN') return candidates;
    return candidates.filter(c => c.consultant === userProfile.displayName);
  }, [candidates, userProfile]);

  // Filtered candidates (from myCandidates, not all)
  const filtered = useMemo(() => {
    let list = myCandidates;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(c => {
        const ca = c as any;
        return (c.name || '').toLowerCase().includes(q) ||
          (c.position || '').toLowerCase().includes(q) ||
          (ca.current_title || '').toLowerCase().includes(q) ||
          (ca.current_company || '').toLowerCase().includes(q) ||
          (typeof c.skills === 'string' && c.skills.toLowerCase().includes(q)) ||
          (Array.isArray(ca.normalized_skills) && ca.normalized_skills.some((s: string) => s.toLowerCase().includes(q)));
      });
    }
    if (filterGrade) list = list.filter(c => { const ca = c as any; return (ca.gradeLevel || ca.grade_level) === filterGrade; });
    if (filterHeat) list = list.filter(c => computeHeatLevel(c as any) === filterHeat);
    if (filterConsultant) list = list.filter(c => c.consultant === filterConsultant);
    if (filterPrecisionOnly) list = list.filter(c => (c as any).precisionEligible === true || (c as any).precision_eligible === true);
    if (filterAlmostReady) list = list.filter(c => {
      const ca = c as any;
      const score = ca.data_quality?.completenessScore ?? ca.dataQuality?.completenessScore ?? 0;
      const isPrecision = ca.precisionEligible === true || ca.precision_eligible === true;
      return !isPrecision && score >= 60 && score < 80;
    });
    return list;
  }, [myCandidates, searchQuery, filterGrade, filterHeat, filterConsultant, filterPrecisionOnly, filterAlmostReady]);

  // Group by board columns
  const columns = BOARD_COLUMNS[boardMode];
  const grouped = useMemo(() => {
    const groups: Record<string, Candidate[]> = {};
    columns.forEach(col => { groups[col.key] = []; });
    filtered.forEach(c => {
      const key = classifyCandidate(c, boardMode);
      if (groups[key]) {
        groups[key].push(c);
      } else {
        // fallback to last column
        const fallback = columns[columns.length - 1].key;
        groups[fallback]?.push(c);
      }
    });
    return groups;
  }, [filtered, boardMode, columns]);

  const activeFilters = [filterGrade, filterHeat, filterConsultant].filter(Boolean).length + (filterPrecisionOnly ? 1 : 0) + (filterAlmostReady ? 1 : 0);

  // Count "almost ready" candidates for badge display
  const almostReadyCount = useMemo(() => {
    return myCandidates.filter(c => {
      const ca = c as any;
      const score = ca.data_quality?.completenessScore ?? ca.dataQuality?.completenessScore ?? 0;
      const isPrecision = ca.precisionEligible === true || ca.precision_eligible === true;
      return !isPrecision && score >= 60 && score < 80;
    }).length;
  }, [myCandidates]);

  // Export "almost ready" candidates as CSV
  const exportAlmostReadyCSV = () => {
    const fieldLabelMap: Record<string, string> = {
      canonicalRole: '標準職務類別',
      industryTag: '產業標籤',
      normalizedSkills: '核心技能(≥3)',
      expectedSalaryMin: '期望薪資下限',
      expectedSalaryMax: '期望薪資上限',
      jobSearchStatusEnum: '求職狀態',
      noticePeriodEnum: '到職時間',
      currentCompany: '目前公司',
      location: '所在地區',
      totalYears: '總年資',
    };
    const almostReady = myCandidates.filter(c => {
      const ca = c as any;
      const score = ca.data_quality?.completenessScore ?? ca.dataQuality?.completenessScore ?? 0;
      const isPrecision = ca.precisionEligible === true || ca.precision_eligible === true;
      return !isPrecision && score >= 60 && score < 80;
    });

    const headers = ['ID', '姓名', '完整度', '目前職位', '目前公司', '職務類別', '產業標籤', '所在地區', '缺少欄位數', '缺少欄位', '建議動作'];
    const rows = almostReady.map(c => {
      const ca = c as any;
      const score = ca.data_quality?.completenessScore ?? ca.dataQuality?.completenessScore ?? 0;
      const missing: string[] = ca.data_quality?.missingCoreFields ?? ca.dataQuality?.missingCoreFields ?? [];
      const missingLabels = missing.map(f => fieldLabelMap[f] || f).join(', ');
      const aiFields = missing.filter(f => ['canonicalRole', 'industryTag', 'normalizedSkills', 'currentCompany', 'location'].includes(f));
      const consultantFields = missing.filter(f => ['expectedSalaryMin', 'expectedSalaryMax', 'noticePeriodEnum', 'jobSearchStatusEnum'].includes(f));
      let action = '';
      if (aiFields.length > 0) action += 'AI可填: ' + aiFields.map(f => fieldLabelMap[f]).join(', ');
      if (consultantFields.length > 0) {
        if (action) action += ' | ';
        action += '顧問需補: ' + consultantFields.map(f => fieldLabelMap[f]).join(', ');
      }
      return [
        ca.id,
        ca.name || '',
        score + '%',
        ca.current_title || ca.position || '',
        ca.current_company || '',
        ca.canonical_role || '',
        ca.industry_tag || '',
        ca.location || '',
        missing.length,
        missingLabels,
        action,
      ].map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',');
    });

    const bom = '\uFEFF';
    const csv = bom + headers.join(',') + '\n' + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `即將達標候選人_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const modeButtons: { mode: BoardMode; icon: React.ElementType; label: string }[] = [
    { mode: 'grade', icon: LayoutGrid, label: 'Grade' },
    { mode: 'source', icon: Building2, label: 'Source' },
    { mode: 'heat', icon: Flame, label: 'Heat' },
    { mode: 'pipeline', icon: GitBranch, label: 'Pipeline' },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Onboarding Tour */}
      <OnboardingTour
        storageKey="step1ne-talent-board-tour"
        steps={tourSteps}
        active={tourActive}
        onComplete={() => setTourActive(false)}
      />

      {/* Page Guide */}
      <PageGuide
        storageKey="step1ne-talent-board-guide"
        title="如何使用人才看板"
        steps={guideSteps}
        onStartTour={() => { localStorage.removeItem('step1ne-talent-board-tour'); setTourActive(true); }}
      />

      {/* Almost Ready Banner */}
      {almostReadyCount > 0 && !filterAlmostReady && (
        <div className="mb-3 flex items-center justify-between bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-amber-500" />
            <span className="text-sm font-medium text-amber-800">
              有 <span className="font-bold text-amber-900">{almostReadyCount}</span> 位候選人即將達標（完整度 60-79%），只需顧問面談補齊 2-3 個欄位即可進入 Precision Pool
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-3">
            <button
              onClick={() => { setFilterAlmostReady(true); setShowFilters(true); }}
              className="text-xs font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-md border border-amber-300 transition-colors"
            >
              查看名單
            </button>
            <button
              onClick={exportAlmostReadyCSV}
              className="flex items-center gap-1 text-xs font-medium text-amber-700 bg-white hover:bg-amber-50 px-3 py-1.5 rounded-md border border-amber-300 transition-colors"
            >
              <Download size={12} />
              匯出 Excel
            </button>
          </div>
        </div>
      )}

      {/* Top bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md w-full" data-tour="board-search">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="搜尋姓名、職位、技能、公司..."
            className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Board mode switcher */}
          <div className="flex bg-gray-100 rounded-lg p-0.5" data-tour="board-mode-switcher">
            {modeButtons.map(({ mode, icon: Icon, label }) => (
              <button
                key={mode}
                onClick={() => setBoardMode(mode)}
                className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  boardMode === mode
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon size={14} />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          {/* Filter toggle */}
          <button
            data-tour="board-filter"
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
              activeFilters > 0
                ? 'bg-blue-50 border-blue-200 text-blue-600'
                : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
            }`}
          >
            <Filter size={14} />
            篩選{activeFilters > 0 ? ` (${activeFilters})` : ''}
          </button>

          {/* Refresh */}
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-all"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>

          {/* Count */}
          <div className="flex items-center gap-1 text-xs text-gray-400" data-tour="board-count">
            <Users size={13} />
            <span>{filtered.length}</span>
          </div>
          {userProfile.role !== 'ADMIN' && (
            <div className="flex items-center gap-1 text-xs text-blue-500">
              <Shield size={12} />
              <span>只顯示您負責的人選</span>
            </div>
          )}
        </div>
      </div>

      {/* Filter row */}
      {showFilters && (
        <div className="flex flex-wrap gap-3 mb-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
          <select
            value={filterGrade}
            onChange={e => setFilterGrade(e.target.value)}
            className="text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white focus:ring-1 focus:ring-blue-500"
          >
            <option value="">全部等級</option>
            {Object.entries(GRADE_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <select
            value={filterHeat}
            onChange={e => setFilterHeat(e.target.value)}
            className="text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white focus:ring-1 focus:ring-blue-500"
          >
            <option value="">全部熱度</option>
            {Object.entries(HEAT_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <select
            value={filterConsultant}
            onChange={e => setFilterConsultant(e.target.value)}
            className="text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white focus:ring-1 focus:ring-blue-500"
          >
            <option value="">全部顧問</option>
            {consultants.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
            <input
              type="checkbox"
              checked={filterPrecisionOnly}
              onChange={e => { setFilterPrecisionOnly(e.target.checked); if (e.target.checked) setFilterAlmostReady(false); }}
              className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span className={`font-medium ${filterPrecisionOnly ? 'text-emerald-700' : 'text-gray-500'}`}>
              Precision Only
            </span>
          </label>
          <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
            <input
              type="checkbox"
              checked={filterAlmostReady}
              onChange={e => { setFilterAlmostReady(e.target.checked); if (e.target.checked) setFilterPrecisionOnly(false); }}
              className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
            />
            <span className={`font-medium ${filterAlmostReady ? 'text-amber-700' : 'text-gray-500'}`}>
              即將達標
              {almostReadyCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[10px] font-bold">{almostReadyCount}</span>
              )}
            </span>
          </label>
          {almostReadyCount > 0 && (
            <button
              onClick={exportAlmostReadyCSV}
              className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 font-medium bg-amber-50 px-2 py-1 rounded-md border border-amber-200 hover:bg-amber-100 transition-colors"
              title="匯出即將達標候選人名單"
            >
              <Download size={12} />
              匯出名單
            </button>
          )}
          {activeFilters > 0 && (
            <button
              onClick={() => { setFilterGrade(''); setFilterHeat(''); setFilterConsultant(''); setFilterPrecisionOnly(false); setFilterAlmostReady(false); }}
              className="text-xs text-blue-500 hover:text-blue-700 font-medium"
            >
              清除篩選
            </button>
          )}
        </div>
      )}

      {/* Board */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto" data-tour="board-columns">
          <div className="flex gap-4 min-w-max h-full pb-4">
            {columns.map(col => {
              const items = grouped[col.key] || [];
              return (
                <div
                  key={col.key}
                  className="w-72 flex flex-col bg-gray-50/80 rounded-xl border border-gray-100 shrink-0"
                >
                  {/* Column header */}
                  <div className={`px-3 py-2.5 rounded-t-xl ${col.bg} border-b border-gray-100`}>
                    <div className="flex items-center justify-between">
                      <h3 className={`text-xs font-bold ${col.color}`}>{col.label}</h3>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${col.bg} ${col.color}`}>
                        {items.length}
                      </span>
                    </div>
                  </div>

                  {/* Cards */}
                  <div className="flex-1 overflow-y-auto p-2 space-y-2 max-h-[calc(100vh-280px)]">
                    {items.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-8">暫無人選</p>
                    ) : (
                      items.map(c => (
                        <TalentCard
                          key={c.id}
                          candidate={c}
                          onClick={setSelectedCandidate}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Candidate Modal */}
      {selectedCandidate && (
        <CandidateModal
          candidate={selectedCandidate}
          onClose={() => setSelectedCandidate(null)}
          currentUserName={userProfile.displayName}
          onCandidateUpdate={(id, updates) => {
            setCandidates(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
          }}
        />
      )}
    </div>
  );
}

export default TalentBoardPage;
