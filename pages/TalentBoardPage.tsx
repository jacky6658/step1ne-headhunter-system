import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile, Candidate } from '../types';
import { getApiUrl, getAuthHeaders } from '../config/api';
import { GRADE_CONFIG, TIER_CONFIG, HEAT_CONFIG, computeHeatLevel, CANDIDATE_STATUS_CONFIG } from '../constants';
import { TalentCard } from '../components/TalentCard';
import { CandidateModal } from '../components/CandidateModal';
import {
  Search, Filter, RefreshCw, LayoutGrid, Flame, Building2, GitBranch,
  X, ChevronDown, Users
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
      return c.grade_level || 'ungraded';
    case 'source':
      return c.source_tier || 'untiered';
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
  const [showFilters, setShowFilters] = useState(false);

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

  // Filtered candidates
  const filtered = useMemo(() => {
    let list = candidates;
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
    if (filterGrade) list = list.filter(c => (c as any).grade_level === filterGrade);
    if (filterHeat) list = list.filter(c => computeHeatLevel(c as any) === filterHeat);
    if (filterConsultant) list = list.filter(c => c.consultant === filterConsultant);
    return list;
  }, [candidates, searchQuery, filterGrade, filterHeat, filterConsultant]);

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

  const activeFilters = [filterGrade, filterHeat, filterConsultant].filter(Boolean).length;

  const modeButtons: { mode: BoardMode; icon: React.ElementType; label: string }[] = [
    { mode: 'grade', icon: LayoutGrid, label: 'Grade' },
    { mode: 'source', icon: Building2, label: 'Source' },
    { mode: 'heat', icon: Flame, label: 'Heat' },
    { mode: 'pipeline', icon: GitBranch, label: 'Pipeline' },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Top bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md w-full">
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
          <div className="flex bg-gray-100 rounded-lg p-0.5">
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
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <Users size={13} />
            <span>{filtered.length}</span>
          </div>
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
          {activeFilters > 0 && (
            <button
              onClick={() => { setFilterGrade(''); setFilterHeat(''); setFilterConsultant(''); }}
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
        <div className="flex-1 overflow-x-auto">
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
