/**
 * AIProgressPage.tsx - AI 工作進度
 *
 * 顯示所有爬蟲匯入的候選人（source='爬蟲匯入'），
 * 支援按「進度狀態」篩選：爬蟲初篩 / AI推薦 / 備選人才 / 其他
 * 以及按 match_tags 分類：符合 Skill / 符合職缺名稱 / 符合工作經歷 / 三者都符合
 */
import React, { useState, useEffect, useCallback } from 'react';
import { UserProfile, Candidate } from '../types';
import { CANDIDATE_STATUS_CONFIG } from '../constants';
import {
  Bot, RefreshCw, Users, CheckCircle2, XCircle, ArrowRightLeft,
  Briefcase, Code, FileText, Star, Filter, ExternalLink, UserCheck, Clock
} from 'lucide-react';
import { apiGet } from '../config/api';
import { CandidateModal } from '../components/CandidateModal';

interface Props {
  userProfile: UserProfile;
}

// match_tags 結構（爬蟲規則式評分產出）
interface MatchTags {
  skill_match?: string[];
  title_match?: boolean;
  experience_match?: string[];
}

type CategoryKey = 'all_match' | 'skill' | 'title' | 'experience' | 'none';

const CATEGORIES: { key: CategoryKey; label: string; icon: React.ElementType; color: string; bg: string }[] = [
  { key: 'all_match',  label: '三者都符合',   icon: Star,       color: 'text-emerald-700', bg: 'bg-emerald-50' },
  { key: 'skill',      label: '符合 Skill',   icon: Code,       color: 'text-blue-700',    bg: 'bg-blue-50' },
  { key: 'title',      label: '符合職缺名稱', icon: Briefcase,  color: 'text-violet-700',  bg: 'bg-violet-50' },
  { key: 'experience', label: '符合工作經歷', icon: FileText,   color: 'text-amber-700',   bg: 'bg-amber-50' },
  { key: 'none',       label: '待分析/不符合', icon: XCircle,    color: 'text-slate-500',   bg: 'bg-slate-50' },
];

// 狀態顏色配置
const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  '爬蟲初篩': { bg: 'bg-cyan-50', text: 'text-cyan-700', dot: 'bg-cyan-500' },
  'AI推薦':   { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  '備選人才': { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  '未開始':   { bg: 'bg-slate-50', text: 'text-slate-600', dot: 'bg-slate-400' },
  '不推薦':   { bg: 'bg-red-50', text: 'text-red-600', dot: 'bg-red-400' },
  '聯繫階段': { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  '人才庫':   { bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-500' },
  '婉拒':     { bg: 'bg-gray-50', text: 'text-gray-500', dot: 'bg-gray-400' },
  '外籍已過濾': { bg: 'bg-gray-50', text: 'text-gray-400', dot: 'bg-gray-300' },
};

function parseMatchTags(candidate: Candidate): MatchTags {
  const raw = candidate.aiMatchResult;
  if (!raw) return {};

  const obj = raw as any;

  if (obj.match_tags) {
    return obj.match_tags as MatchTags;
  }

  if (obj.skill_match !== undefined || obj.title_match !== undefined || obj.experience_match !== undefined) {
    return {
      skill_match: obj.skill_match || [],
      title_match: !!obj.title_match,
      experience_match: obj.experience_match || [],
    };
  }

  if (obj.matched_skills) {
    return {
      skill_match: obj.matched_skills || [],
      title_match: false,
      experience_match: [],
    };
  }

  return {};
}

function categorize(candidate: Candidate): CategoryKey {
  const tags = parseMatchTags(candidate);
  const hasSkill = (tags.skill_match?.length ?? 0) > 0;
  const hasTitle = !!tags.title_match;
  const hasExp = (tags.experience_match?.length ?? 0) > 0;

  if (hasSkill && hasTitle && hasExp) return 'all_match';
  if (hasSkill) return 'skill';
  if (hasTitle) return 'title';
  if (hasExp) return 'experience';
  return 'none';
}

function getStatusStyle(status: string) {
  return STATUS_STYLES[status] || { bg: 'bg-slate-50', text: 'text-slate-600', dot: 'bg-slate-400' };
}

export const AIProgressPage: React.FC<Props> = ({ userProfile }) => {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<CategoryKey | 'all'>('all');
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [jobFilter, setJobFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const loadCandidates = useCallback(async () => {
    try {
      setLoading(true);
      // 載入所有爬蟲匯入的候選人（不限狀態）
      const res = await apiGet<{ success: boolean; data: any[] }>('/candidates?source=爬蟲匯入&limit=2000');
      if (res.success && res.data) {
        setCandidates(res.data);
      }
    } catch (err) {
      console.error('載入 AI 工作進度失敗:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCandidates();
  }, [loadCandidates]);

  // 按 match_tags 類別分組
  const grouped: Record<CategoryKey, Candidate[]> = {
    all_match: [],
    skill: [],
    title: [],
    experience: [],
    none: [],
  };

  // 按狀態分組
  const statusGroups: Record<string, Candidate[]> = {};

  // 收集可用的職缺列表
  const jobSet = new Map<string, string>();

  candidates.forEach(c => {
    const cat = categorize(c);
    grouped[cat].push(c);

    const st = c.status || '未知';
    if (!statusGroups[st]) statusGroups[st] = [];
    statusGroups[st].push(c);

    if (c.targetJobId && c.targetJobLabel) {
      jobSet.set(String(c.targetJobId), c.targetJobLabel);
    }
  });

  const jobs = Array.from(jobSet.entries()).map(([id, label]) => ({ id, label }));

  // 顯示順序的狀態列表
  const STATUS_ORDER = ['爬蟲初篩', '未開始', 'AI推薦', '備選人才', '人才庫', '聯繫階段', '不推薦', '婉拒', '外籍已過濾'];
  const availableStatuses = STATUS_ORDER.filter(s => statusGroups[s]?.length > 0);
  // 加入不在預設列表中的狀態
  Object.keys(statusGroups).forEach(s => {
    if (!availableStatuses.includes(s)) availableStatuses.push(s);
  });

  // 篩選後的候選人
  const getFilteredCandidates = () => {
    let list: Candidate[];
    if (activeCategory === 'all') {
      list = candidates;
    } else {
      list = grouped[activeCategory];
    }
    if (statusFilter !== 'all') {
      list = list.filter(c => c.status === statusFilter);
    }
    if (jobFilter !== 'all') {
      list = list.filter(c => String(c.targetJobId) === jobFilter);
    }
    return list;
  };

  const filtered = getFilteredCandidates();

  // KPI 統計
  const totalCrawler = candidates.length;
  const totalAnalyzed = candidates.filter(c => {
    const tags = parseMatchTags(c);
    return (tags.skill_match?.length ?? 0) > 0 || tags.title_match || (tags.experience_match?.length ?? 0) > 0;
  }).length;
  const totalRecommended = (statusGroups['AI推薦']?.length || 0);
  const totalReserved = (statusGroups['備選人才']?.length || 0);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* 頁面標題 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-100 rounded-lg">
            <Bot className="w-6 h-6 text-cyan-700" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900">AI 工作進度</h1>
            <p className="text-sm text-slate-500">爬蟲匯入候選人追蹤 — 從初篩到推薦的完整流程</p>
          </div>
        </div>
        <button
          onClick={loadCandidates}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          重新整理
        </button>
      </div>

      {/* KPI 卡片列 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
            <Users className="w-4 h-4" />
            爬蟲匯入總數
          </div>
          <p className="text-2xl font-bold text-slate-900">{totalCrawler}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-cyan-600 text-sm mb-1">
            <Clock className="w-4 h-4" />
            爬蟲初篩
          </div>
          <p className="text-2xl font-bold text-cyan-700">{statusGroups['爬蟲初篩']?.length || 0}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-emerald-600 text-sm mb-1">
            <CheckCircle2 className="w-4 h-4" />
            AI推薦
          </div>
          <p className="text-2xl font-bold text-emerald-700">{totalRecommended}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-amber-600 text-sm mb-1">
            <UserCheck className="w-4 h-4" />
            備選人才
          </div>
          <p className="text-2xl font-bold text-amber-700">{totalReserved}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-violet-600 text-sm mb-1">
            <ArrowRightLeft className="w-4 h-4" />
            有匹配標籤
          </div>
          <p className="text-2xl font-bold text-violet-700">{totalAnalyzed}</p>
        </div>
      </div>

      {/* 篩選列 */}
      <div className="flex flex-wrap items-center gap-4">
        {/* 狀態篩選 */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-sm text-slate-500">進度狀態：</span>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                statusFilter === 'all'
                  ? 'bg-slate-800 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              全部 ({totalCrawler})
            </button>
            {availableStatuses.map(st => {
              const style = getStatusStyle(st);
              const count = statusGroups[st]?.length || 0;
              return (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 ${
                    statusFilter === st
                      ? `${style.bg} ${style.text} ring-1 ring-current/30`
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                  {st} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* 職缺篩選 */}
        {jobs.length > 0 && (
          <div className="flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-slate-400" />
            <select
              value={jobFilter}
              onChange={(e) => setJobFilter(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white"
            >
              <option value="all">所有職缺</option>
              {jobs.map(j => (
                <option key={j.id} value={j.id}>{j.label}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* 匹配類別 Tab */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveCategory('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeCategory === 'all'
              ? 'bg-cyan-100 text-cyan-800 border border-cyan-300'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          全部 ({candidates.length})
        </button>
        {CATEGORIES.map(cat => (
          <button
            key={cat.key}
            onClick={() => setActiveCategory(cat.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeCategory === cat.key
                ? `${cat.bg} ${cat.color} border border-current/20`
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <cat.icon className="w-3.5 h-3.5" />
            {cat.label} ({grouped[cat.key].length})
          </button>
        ))}
      </div>

      {/* 候選人列表 */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-8 h-8 text-cyan-500 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Bot className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">此篩選條件下暫無候選人</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left py-3 px-4 font-semibold text-slate-600">姓名</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-600">現職</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-600">技能</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-600">目標職缺</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-600">匹配標籤</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-600">進度狀態</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const tags = parseMatchTags(c);
                const cat = categorize(c);
                const statusStyle = getStatusStyle(c.status || '');

                return (
                  <tr
                    key={c.id}
                    className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors"
                    onClick={() => setSelectedCandidate(c)}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">{c.name}</span>
                        {c.linkedinUrl && (
                          <a
                            href={c.linkedinUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-blue-500 hover:text-blue-700"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-[200px] truncate">
                      {c.position || '-'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1 max-w-[250px]">
                        {(typeof c.skills === 'string' ? c.skills.split(/[、,]/) : c.skills || [])
                          .slice(0, 4)
                          .map((s, i) => (
                            <span key={i} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-xs">
                              {typeof s === 'string' ? s.trim() : s}
                            </span>
                          ))}
                        {(typeof c.skills === 'string' ? c.skills.split(/[、,]/) : c.skills || []).length > 4 && (
                          <span className="text-xs text-slate-400">+{(typeof c.skills === 'string' ? c.skills.split(/[、,]/) : c.skills || []).length - 4}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600 text-xs max-w-[180px] truncate">
                      {c.targetJobLabel || '-'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {(tags.skill_match?.length ?? 0) > 0 && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                            Skill ({tags.skill_match!.length})
                          </span>
                        )}
                        {tags.title_match && (
                          <span className="px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full text-xs font-medium">
                            職缺名稱
                          </span>
                        )}
                        {(tags.experience_match?.length ?? 0) > 0 && (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                            工作經歷
                          </span>
                        )}
                        {cat === 'none' && (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-xs">
                            待分析
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} />
                        {c.status || '未知'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 候選人詳情 Modal */}
      {selectedCandidate && (
        <CandidateModal
          candidate={selectedCandidate}
          onClose={() => setSelectedCandidate(null)}
          currentUserName={userProfile.displayName}
          onCandidateUpdate={(candidateId, updates) => {
            setCandidates(prev => prev.map(c => c.id === candidateId ? { ...c, ...updates } : c));
            setSelectedCandidate(prev => prev ? { ...prev, ...updates } : prev);
          }}
        />
      )}
    </div>
  );
};
