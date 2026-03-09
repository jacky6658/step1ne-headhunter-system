import React, { useEffect, useMemo, useState } from 'react';
import { Candidate, CandidateStatus, ProgressEvent, UserProfile } from '../types';
import { getCandidates, clearCache } from '../services/candidateService';
import { CandidateModal } from '../components/CandidateModal';
import { apiPut, getApiUrl } from '../config/api';
import { RefreshCw, Shield, Clock3, BarChart3, AlertTriangle, Download, Search, X, Trash2, Linkedin, Github, Star } from 'lucide-react';

interface PipelinePageProps {
  userProfile: UserProfile;
}

type PipelineStageKey = 'today_new' | 'ai_recommended' | 'contacted' | 'interviewed' | 'offer' | 'onboarded' | 'rejected' | 'other' | 'not_started';

interface PipelineItem {
  candidate: Candidate;
  stage: PipelineStageKey;
  latestProgress?: ProgressEvent;
  idleDays: number;
  targetJob: string;        // 第一個目標職缺（顯示用）
  allTargetJobs: string[];  // 所有目標職缺（篩選用）
}

interface GithubStats {
  score: number;
  stars: number;
  activity: {
    status: string;
    statusText: string;
    daysAgo: number;
    activeMonths?: number;
    score?: number;
  };
  topLanguage: string;
  followers: number;
  totalStars: number;
  // v2 新增維度
  skillMatch?: {
    score: number;
    matchedSkills: string[];
    missingSkills: string[];
  };
  projectQuality?: {
    score: number;
    originalCount: number;
    forkCount: number;
  };
  influence?: {
    score: number;
  };
  version?: number;
}

/** 判斷是否為台灣時區今天新增 */
function isTodayTaiwan(createdAt?: string): boolean {
  if (!createdAt) return false;
  const fmt = (d: Date) =>
    new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  return fmt(new Date(createdAt)) === fmt(new Date());
}

const PIPELINE_STAGES: Array<{ key: PipelineStageKey; title: string; color: string; bg: string; locked?: boolean }> = [
  { key: 'today_new',       title: '今日新增', color: 'text-teal-700',   bg: 'bg-teal-100',   locked: true },
  { key: 'not_started',     title: '未開始',   color: 'text-slate-700',  bg: 'bg-slate-100' },
  { key: 'ai_recommended',  title: 'AI推薦',   color: 'text-violet-700', bg: 'bg-violet-100' },
  { key: 'contacted',       title: '聯繫階段', color: 'text-blue-700',   bg: 'bg-blue-100' },
  { key: 'interviewed',     title: '面試階段', color: 'text-indigo-700', bg: 'bg-indigo-100' },
  { key: 'offer',           title: 'Offer',    color: 'text-amber-700',  bg: 'bg-amber-100' },
  { key: 'onboarded',       title: 'on board', color: 'text-green-700',  bg: 'bg-green-100' },
  { key: 'rejected',        title: '婉拒',     color: 'text-rose-700',   bg: 'bg-rose-100' },
  { key: 'other',           title: '備選人才', color: 'text-purple-700', bg: 'bg-purple-100' },
];

function mapEventToStage(event?: string): PipelineStageKey {
  const e = (event || '').trim();
  if (!e) return 'not_started';

  if (e.includes('爬蟲初篩')) return 'not_started';  // 初篩不顯示在追蹤表，fallback 到未開始
  if (e.includes('AI推薦')) return 'ai_recommended';
  if (e.includes('未開始')) return 'not_started';
  if (e.includes('聯繫階段') || e.includes('已聯繫')) return 'contacted';
  if (e.includes('面試階段') || e.includes('已面試') || e.includes('面試')) return 'interviewed';
  if (e.toLowerCase().includes('offer')) return 'offer';
  if (e.includes('on board') || e.includes('已上職') || e.includes('到職')) return 'onboarded';
  if (e.includes('婉拒') || e.includes('拒絕')) return 'rejected';
  return 'other';
}

function mapStatusToStage(status: CandidateStatus | string): PipelineStageKey {
  switch (status) {
    case CandidateStatus.AI_RECOMMENDED:
      return 'ai_recommended';
    case CandidateStatus.CONTACTED:
      return 'contacted';
    case CandidateStatus.INTERVIEWED:
      return 'interviewed';
    case CandidateStatus.OFFER:
      return 'offer';
    case CandidateStatus.ONBOARDED:
      return 'onboarded';
    case CandidateStatus.REJECTED:
      return 'rejected';
    case CandidateStatus.OTHER:
      return 'other';
    // 歷史遺留狀態：歸入「未開始」欄
    case '待聯繫':
    case '待審核':
      return 'not_started';
    default:
      return 'not_started';
  }
}

function stageToStatus(stage: PipelineStageKey): CandidateStatus {
  switch (stage) {
    case 'today_new':
      return CandidateStatus.NOT_STARTED;
    case 'ai_recommended':
      return CandidateStatus.AI_RECOMMENDED;
    case 'contacted':
      return CandidateStatus.CONTACTED;
    case 'interviewed':
      return CandidateStatus.INTERVIEWED;
    case 'offer':
      return CandidateStatus.OFFER;
    case 'onboarded':
      return CandidateStatus.ONBOARDED;
    case 'rejected':
      return CandidateStatus.REJECTED;
    case 'other':
      return CandidateStatus.OTHER;
    default:
      return CandidateStatus.NOT_STARTED;
  }
}

function stageToEvent(stage: PipelineStageKey): string {
  switch (stage) {
    case 'today_new':
      return '未開始';
    case 'ai_recommended':
      return 'AI推薦';
    case 'not_started':
      return '未開始';
    case 'contacted':
      return '聯繫階段';
    case 'interviewed':
      return '面試階段';
    case 'offer':
      return 'Offer';
    case 'onboarded':
      return 'on board';
    case 'rejected':
      return '婉拒';
    case 'other':
      return '備選人才';
    default:
      return '未開始';
  }
}

function getLatestProgress(progress?: ProgressEvent[]): ProgressEvent | undefined {
  if (!progress || progress.length === 0) return undefined;

  // 找最大日期
  const maxTime = progress.reduce((max, p) => {
    const t = new Date(p.date).getTime();
    return t > max ? t : max;
  }, 0);

  // 同一天有多筆時，取陣列最後一筆（最新加入的）
  const sameDay = progress.filter(p => new Date(p.date).getTime() === maxTime);
  return sameDay[sameDay.length - 1];
}

function getIdleDays(dateString?: string, now: Date = new Date()): number {
  if (!dateString) return 999;
  const target = new Date(dateString);
  const diff = now.getTime() - target.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function parseTargetJob(candidate: Candidate): string {
  // 只使用獨立欄位（target_job_id → targetJobLabel），舊 notes 格式由 SQL migration 已回填
  return candidate.targetJobLabel || '未指定';
}

// 解析所有目標職缺（篩選用）
function parseAllTargetJobs(candidate: Candidate): string[] {
  if (candidate.targetJobLabel) return [candidate.targetJobLabel];
  return ['未指定'];
}

function getIdleBadgeClass(idleDays: number): string {
  if (idleDays >= 14) return 'bg-rose-100 text-rose-700 border border-rose-200';
  if (idleDays >= 7) return 'bg-amber-100 text-amber-700 border border-amber-200';
  return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
}

function getStageSlaDays(stage: PipelineStageKey): number {
  switch (stage) {
    case 'contacted':
      return 3;
    case 'interviewed':
      return 7;
    case 'offer':
      return 5;
    case 'not_started':
      return 2;
    default:
      return 999;
  }
}

function isSlaOverdue(stage: PipelineStageKey, idleDays: number): boolean {
  return idleDays > getStageSlaDays(stage);
}

export function PipelinePage({ userProfile }: PipelinePageProps) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [draggingCandidateId, setDraggingCandidateId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string>('');
  const [now, setNow] = useState(() => new Date());

  const [consultantFilter, setConsultantFilter] = useState<string>('all');
  const [jobFilter, setJobFilter] = useState<string>('all');
  const [companyFilter, setCompanyFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [linkedinFilter, setLinkedinFilter] = useState<'all' | 'has' | 'no'>('all');
  const [dataCompletenessFilter, setDataCompletenessFilter] = useState<'all' | 'complete' | 'partial' | 'critical'>('all');
  const [apiJobs, setApiJobs] = useState<Array<{ id: number; position_name: string; client_company: string }>>([]);
  const [githubStatsCache, setGithubStatsCache] = useState<Record<string, GithubStats | null>>({});
  // 婉拒確認 Modal
  const [rejectionModal, setRejectionModal] = useState<{
    candidateId: string;
    candidateName: string;
    targetStage: PipelineStageKey;
  } | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const loadCandidates = async () => {
    setLoading(true);
    try {
      const data = await getCandidates(userProfile);
      setCandidates(data);
    } catch (error) {
      console.error('載入顧問人選追蹤表失敗:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchGithubStats = async (candidateId: string) => {
    if (githubStatsCache[candidateId] !== undefined) {
      return githubStatsCache[candidateId];
    }

    try {
      const response = await fetch(getApiUrl(`/candidates/${candidateId}/github-stats`));
      const result = await response.json();
      
      if (result.success) {
        setGithubStatsCache(prev => ({ ...prev, [candidateId]: result.data }));
        return result.data;
      }
    } catch (error) {
      console.error(`Failed to fetch GitHub stats for candidate ${candidateId}:`, error);
    }
    
    setGithubStatsCache(prev => ({ ...prev, [candidateId]: null }));
    return null;
  };

  useEffect(() => {
    if (userProfile) {
      loadCandidates();
    }
  }, [userProfile]);

  useEffect(() => {
    fetch(getApiUrl('/jobs'))
      .then(r => r.json())
      .then(d => { if (d.success && d.data) setApiJobs(d.data); })
      .catch(() => {});
  }, []);

  const candidatesWithStage = useMemo<PipelineItem[]>(() => {
    return candidates.map(candidate => {
      const latestProgress = getLatestProgress(candidate.progressTracking);
      const baseStage = latestProgress ? mapEventToStage(latestProgress.event) : mapStatusToStage(candidate.status);
      // 今日新增：created_at 是台灣時區今天 且 尚未有任何進度更新（仍在未開始階段）
      // ai_recommended 不受 today_new 邏輯影響
      const stage: PipelineStageKey =
        (baseStage === 'not_started' && isTodayTaiwan(candidate.createdAt))
          ? 'today_new'
          : baseStage;
      const idleDays = latestProgress?.date ? getIdleDays(latestProgress.date, now) : getIdleDays(candidate.updatedAt, now);
      const targetJob = parseTargetJob(candidate);
      const allTargetJobs = parseAllTargetJobs(candidate);
      return { candidate, stage, latestProgress, idleDays, targetJob, allTargetJobs };
    });
  }, [candidates, now]);

  // 異步獲取 AI 推薦候選人的 GitHub 統計數據
  useEffect(() => {
    const aiRecommended = candidatesWithStage.filter(item => item.stage === 'ai_recommended');

    // 只獲取有 GitHub 連結且尚未載入的候選人數據
    aiRecommended.forEach(item => {
      const hasGithub = !!(item.candidate as any).githubUrl && (item.candidate as any).githubUrl.trim() !== '';
      if (hasGithub && githubStatsCache[item.candidate.id] === undefined) {
        fetchGithubStats(item.candidate.id);
      }
    });
  }, [candidatesWithStage]);

  // 每小時更新一次「現在時間」，讓停留天數與 SLA 自動重算
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      clearCache();
      const data = await getCandidates(userProfile);
      setCandidates(data);
      setToastMessage('✅ 顧問人選追蹤表已更新到最新資料');
    } catch (error) {
      console.error('重新整理顧問人選追蹤表失敗:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const consultantOptions = useMemo(() => {
    const list = [...new Set(candidatesWithStage.map(item => item.candidate.consultant || '未指派'))];
    return list.sort();
  }, [candidatesWithStage]);

  const jobOptions = useMemo(() => {
    // 收集所有候選人的「所有目標職缺」，讓篩選器完整顯示所有職位
    const allJobs = candidatesWithStage.flatMap(item => item.allTargetJobs);
    return [...new Set(allJobs)].sort();
  }, [candidatesWithStage]);

  // 判断资料完整度
  const getDataCompleteness = (candidate: Candidate): 'complete' | 'partial' | 'critical' => {
    const hasLinkedin = !!(candidate as any).linkedinUrl && (candidate as any).linkedinUrl.trim() !== '';
    const hasGithub = !!(candidate as any).githubUrl && (candidate as any).githubUrl.trim() !== '';
    const hasEmail = !!candidate.email && candidate.email.trim() !== '';
    const hasPhone = !!candidate.phone && candidate.phone.trim() !== '';
    
    // 完整：有 LinkedIn 或 GitHub 其中之一
    if (hasLinkedin || hasGithub) {
      return 'complete';
    }
    
    // 部分缺失：有電話或 Email，但無外部連結
    if (hasEmail || hasPhone) {
      return 'partial';
    }
    
    // 嚴重缺失：LinkedIn + GitHub 都沒有，且沒有聯絡方式
    return 'critical';
  };

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return candidatesWithStage.filter(item => {
      const consultant = item.candidate.consultant || '未指派';
      // 未指派/待指派候選人：只有明確選擇對應篩選時才顯示，預設不出現在追蹤表
      const isUnassigned = consultant === '未指派' || consultant === '待指派';
      if (isUnassigned && consultantFilter !== consultant) return false;
      const consultantMatched = consultantFilter === 'all' || consultant === consultantFilter;
      const jobMatched = jobFilter === 'all' || item.allTargetJobs.includes(jobFilter);
      const companyMatched = companyFilter === 'all' || (() => {
        if (item.candidate.targetJobId) {
          const job = apiJobs.find(j => j.id === item.candidate.targetJobId);
          if (job) return job.client_company === companyFilter;
        }
        return (item.candidate.targetJobLabel || '').includes(companyFilter);
      })();
      // LinkedIn 筛选
      const hasLinkedin = !!(item.candidate as any).linkedinUrl && (item.candidate as any).linkedinUrl.trim() !== '';
      const linkedinMatched = linkedinFilter === 'all' ||
        (linkedinFilter === 'has' && hasLinkedin) ||
        (linkedinFilter === 'no' && !hasLinkedin);
      // 資料完整度篩選
      const completeness = getDataCompleteness(item.candidate);
      const completenessMatched = dataCompletenessFilter === 'all' || completeness === dataCompletenessFilter;
      // REVIEWER 只顯示自己的候選人，ADMIN 顯示全部（已指派顧問的）
      const roleMatched = userProfile.role === 'ADMIN' || consultant === userProfile.displayName;
      const searchMatched = !q || [
        item.candidate.name,
        item.candidate.position,
        item.candidate.consultant,
        ...item.allTargetJobs,
        item.latestProgress?.note,
      ].some(val => (val || '').toLowerCase().includes(q));
      return consultantMatched && jobMatched && companyMatched && linkedinMatched && completenessMatched && roleMatched && searchMatched;
    });
  }, [candidatesWithStage, consultantFilter, jobFilter, companyFilter, linkedinFilter, dataCompletenessFilter, searchQuery, userProfile, apiJobs]);

  const grouped = useMemo(() => {
    const result: Record<PipelineStageKey, PipelineItem[]> = {
      today_new: [],
      ai_recommended: [],
      contacted: [],
      interviewed: [],
      offer: [],
      onboarded: [],
      rejected: [],
      other: [],
      not_started: [],
    };

    filteredItems.forEach(item => {
      result[item.stage].push(item);
    });

    Object.keys(result).forEach(key => {
      result[key as PipelineStageKey].sort((a, b) => {
        const aTime = a.latestProgress?.date ? new Date(a.latestProgress.date).getTime() : 0;
        const bTime = b.latestProgress?.date ? new Date(b.latestProgress.date).getTime() : 0;
        return bTime - aTime;
      });
    });

    return result;
  }, [filteredItems]);

  // 各欄位未篩選的總數（用於顯示「篩選中 x / 總計 y」）
  const totalByStage = useMemo(() => {
    const result: Record<string, number> = {};
    candidatesWithStage.forEach(item => {
      result[item.stage] = (result[item.stage] || 0) + 1;
    });
    return result;
  }, [candidatesWithStage]);

  const isFiltering = searchQuery.trim() !== '' || jobFilter !== 'all' || companyFilter !== 'all' || consultantFilter !== 'all' || linkedinFilter !== 'all' || dataCompletenessFilter !== 'all';
  
  // 计算每个阶段的 LinkedIn 统计（仅 AI 推荐阶段）
  const linkedinStats = useMemo(() => {
    const aiRecommendedAll = candidatesWithStage.filter(item => item.stage === 'ai_recommended');
    const hasLinkedin = aiRecommendedAll.filter(item => {
      const url = (item.candidate as any).linkedinUrl;
      return url && url.trim() !== '';
    }).length;
    const noLinkedin = aiRecommendedAll.length - hasLinkedin;
    return { total: aiRecommendedAll.length, has: hasLinkedin, no: noLinkedin };
  }, [candidatesWithStage]);
  
  // 计算资料完整度统计（仅 AI 推荐阶段）
  const completenessStats = useMemo(() => {
    const aiRecommendedAll = candidatesWithStage.filter(item => item.stage === 'ai_recommended');
    const complete = aiRecommendedAll.filter(item => getDataCompleteness(item.candidate) === 'complete').length;
    const partial = aiRecommendedAll.filter(item => getDataCompleteness(item.candidate) === 'partial').length;
    const critical = aiRecommendedAll.filter(item => getDataCompleteness(item.candidate) === 'critical').length;
    return { total: aiRecommendedAll.length, complete, partial, critical };
  }, [candidatesWithStage]);

  const totalWithTracking = filteredItems.filter(item => (item.candidate.progressTracking || []).length > 0).length;
  const staleCount = filteredItems.filter(item => item.idleDays >= 7).length;
  const slaOverdueCount = filteredItems.filter(item => isSlaOverdue(item.stage, item.idleDays)).length;

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(''), 2200);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const handleDragStart = (candidateId: string) => {
    setDraggingCandidateId(candidateId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  /** 實際執行 Pipeline 狀態更新（拖拉或確認婉拒後呼叫） */
  const applyStageChange = async (
    candidate: Candidate,
    stage: PipelineStageKey,
    rejectionNote?: string
  ) => {
    const userName = userProfile.displayName || 'System';
    const newStatus = stageToStatus(stage);
    const eventNote = rejectionNote ? `婉拒原因：${rejectionNote}` : undefined;
    const newEvent: ProgressEvent = {
      date: new Date().toISOString().split('T')[0],
      event: eventNote || stageToEvent(stage),
      by: userName,
    };
    const updatedProgress = [...(candidate.progressTracking || []), newEvent];

    try {
      await apiPut(`/api/candidates/${candidate.id}/pipeline-status`, {
        status: newStatus,
        by: userName,
        ...(rejectionNote ? { notes: `${candidate.notes ? candidate.notes + '\n' : ''}婉拒原因：${rejectionNote}` } : {}),
      });

      setCandidates(prev =>
        prev.map(c =>
          c.id === candidate.id
            ? { ...c, status: newStatus, progressTracking: updatedProgress, updatedAt: new Date().toISOString() }
            : c
        )
      );
      setToastMessage(`✅ ${candidate.name} 已移動到「${PIPELINE_STAGES.find(s => s.key === stage)?.title || stage}」`);
    } catch (error) {
      console.error('❌ 更新 Pipeline 失敗:', error);
      alert('❌ 更新失敗，請稍後再試');
    }
  };

  const handleDropToStage = async (stage: PipelineStageKey) => {
    if (!draggingCandidateId) return;
    if (stage === 'today_new') return; // 今日新增欄位為自動，不可手動拖入

    const targetCandidate = candidates.find(c => c.id === draggingCandidateId);
    if (!targetCandidate) return;

    const latest = getLatestProgress(targetCandidate.progressTracking);
    const currentStage = latest ? mapEventToStage(latest.event) : mapStatusToStage(targetCandidate.status);
    if (currentStage === stage) {
      setDraggingCandidateId(null);
      return;
    }

    // 移入婉拒欄：必須填寫婉拒原因，開啟 Modal
    if (stage === 'rejected') {
      setRejectionModal({
        candidateId: targetCandidate.id,
        candidateName: targetCandidate.name,
        targetStage: stage,
      });
      setRejectionReason('');
      setDraggingCandidateId(null);
      return;
    }

    setDraggingCandidateId(null);
    await applyStageChange(targetCandidate, stage);
  };

  /** 婉拒 Modal 確認送出 */
  const handleRejectionConfirm = async () => {
    if (!rejectionModal || !rejectionReason.trim()) return;
    const candidate = candidates.find(c => c.id === rejectionModal.candidateId);
    if (!candidate) return;
    await applyStageChange(candidate, rejectionModal.targetStage, rejectionReason.trim());
    setRejectionModal(null);
    setRejectionReason('');
  };

  const handleDeleteCandidate = async (candidateId: string, candidateName: string, e: React.MouseEvent) => {
    e.stopPropagation(); // 防止觸發卡片點擊事件
    
    if (!window.confirm(`確定要刪除候選人「${candidateName}」嗎？\n\n此操作將永久刪除資料庫中的所有相關記錄，無法復原！`)) {
      return;
    }

    try {
      const response = await fetch(getApiUrl(`/candidates/${candidateId}`), {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`刪除失敗: ${response.status}`);
      }

      // 從本地狀態中移除
      setCandidates(prev => prev.filter(c => c.id !== candidateId));
      setToastMessage(`✅ 已刪除候選人「${candidateName}」`);
    } catch (error) {
      console.error('❌ 刪除候選人失敗:', error);
      alert('❌ 刪除失敗，請稍後再試');
    }
  };

  const handleExportCsv = () => {
    const headers = ['候選人ID', '姓名', '顧問', '職缺', '階段', '最新進度日期', '最新事件', '停留天數'];
    const rows = filteredItems.map(item => [
      item.candidate.id,
      item.candidate.name,
      item.candidate.consultant || '未指派',
      item.targetJob,
      item.stage,
      item.latestProgress?.date || '',
      item.latestProgress?.event || '',
      String(item.idleDays),
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `顧問人選追蹤表-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setToastMessage('✅ 顧問人選追蹤報表已匯出 CSV');
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">載入顧問人選追蹤資料中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-indigo-600" />
              顧問人選追蹤表
            </h2>
            <p className="text-slate-500 mt-1">依最新進度事件自動分欄，追蹤顧問負責候選人的招募流程</p>
            {userProfile.role !== 'ADMIN' && (
              <p className="text-sm text-blue-600 mt-2 flex items-center gap-1">
                <Shield className="w-4 h-4" />
                只顯示您可查看的候選人
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportCsv}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold transition"
            >
              <Download className="w-4 h-4" />
              匯出 CSV
            </button>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold transition disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              重新整理
            </button>
          </div>
        </div>


        <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
            <p className="text-xs text-slate-500">候選人總數</p>
            <p className="text-lg font-black text-slate-900">{filteredItems.length}</p>
          </div>
          <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-3">
            <p className="text-xs text-indigo-600">已追蹤進度</p>
            <p className="text-lg font-black text-indigo-700">{totalWithTracking}</p>
          </div>
          <div className="rounded-xl bg-rose-50 border border-rose-100 p-3">
            <p className="text-xs text-rose-600">逾 7 天未更新</p>
            <p className="text-lg font-black text-rose-700">{staleCount}</p>
          </div>
          <div className="rounded-xl bg-orange-50 border border-orange-100 p-3">
            <p className="text-xs text-orange-600">超過階段 SLA</p>
            <p className="text-lg font-black text-orange-700">{slaOverdueCount}</p>
          </div>
          <div className="rounded-xl bg-green-50 border border-green-100 p-3">
            <p className="text-xs text-green-600">on board</p>
            <p className="text-lg font-black text-green-700">{grouped.onboarded.length}</p>
          </div>
        </div>
      </div>

      {/* 快速篩選列（欄位上方，隨時可見）*/}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* 搜尋 */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="搜尋姓名、職缺關鍵字..."
              className="w-full rounded-lg border border-slate-200 pl-8 pr-7 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* 顧問篩選 */}
          <select
            value={consultantFilter}
            onChange={e => setConsultantFilter(e.target.value)}
            className={`rounded-lg border py-1.5 pl-3 pr-7 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors ${
              consultantFilter !== 'all'
                ? 'border-indigo-400 bg-indigo-50 text-indigo-700 font-medium'
                : 'border-slate-200 bg-white text-slate-600'
            }`}
          >
            <option value="all">👤 全部顧問</option>
            {consultantOptions.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>

          {/* 客戶公司篩選 */}
          {(() => {
            const companyOptions = [...new Set(apiJobs.map(j => j.client_company).filter(Boolean))].sort();
            return (
              <select
                value={companyFilter}
                onChange={e => { setCompanyFilter(e.target.value); setJobFilter('all'); }}
                className={`rounded-lg border py-1.5 pl-3 pr-7 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors max-w-[200px] ${
                  companyFilter !== 'all'
                    ? 'border-indigo-400 bg-indigo-50 text-indigo-700 font-medium'
                    : 'border-slate-200 bg-white text-slate-600'
                }`}
              >
                <option value="all">🏢 全部公司</option>
                {companyOptions.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            );
          })()}

          {/* 職缺篩選（選公司後只顯示該公司職缺）*/}
          <select
            value={jobFilter}
            onChange={e => setJobFilter(e.target.value)}
            className={`rounded-lg border py-1.5 pl-3 pr-7 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors max-w-[240px] ${
              jobFilter !== 'all'
                ? 'border-indigo-400 bg-indigo-50 text-indigo-700 font-medium'
                : 'border-slate-200 bg-white text-slate-600'
            }`}
          >
            <option value="all">💼 全部職缺</option>
            {apiJobs
              .filter(job => companyFilter === 'all' || job.client_company === companyFilter)
              .map(job => {
                const label = `${job.position_name}${job.client_company ? ` (${job.client_company})` : ''}`;
                return <option key={job.id} value={label}>{label}</option>;
              })}
          </select>

          {/* LinkedIn 篩選標籤 */}
          {linkedinFilter !== 'all' && (
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-blue-100 text-blue-700 font-medium">
              <Linkedin className="w-3 h-3" />
              {linkedinFilter === 'has' ? '有LinkedIn' : '無LinkedIn'}
              <button onClick={() => setLinkedinFilter('all')} className="ml-1 hover:text-blue-900">✕</button>
            </span>
          )}

          {/* 資料完整度篩選標籤 */}
          {dataCompletenessFilter !== 'all' && (
            <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
              dataCompletenessFilter === 'complete' ? 'bg-green-100 text-green-700' :
              dataCompletenessFilter === 'partial' ? 'bg-amber-100 text-amber-700' :
              'bg-rose-100 text-rose-700'
            }`}>
              <AlertTriangle className="w-3 h-3" />
              {dataCompletenessFilter === 'complete' ? '完整資料' :
               dataCompletenessFilter === 'partial' ? '部分缺失' :
               '嚴重缺失'}
              <button onClick={() => setDataCompletenessFilter('all')} className="ml-1 hover:opacity-70">✕</button>
            </span>
          )}

          {/* 清除全部 */}
          {(searchQuery || jobFilter !== 'all' || companyFilter !== 'all' || consultantFilter !== 'all' || linkedinFilter !== 'all' || dataCompletenessFilter !== 'all') && (
            <button
              onClick={() => { setSearchQuery(''); setJobFilter('all'); setCompanyFilter('all'); setConsultantFilter('all'); setLinkedinFilter('all'); setDataCompletenessFilter('all'); }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs text-gray-500 hover:bg-gray-100 transition-colors"
            >
              <X className="w-3 h-3" /> 清除
            </button>
          )}

          <span className="ml-auto text-xs text-slate-400 whitespace-nowrap">
            顯示 {filteredItems.length} 位
          </span>

          {/* 匯出 CSV */}
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            匯出 CSV
          </button>
        </div>
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="flex gap-4 min-w-max">
          {PIPELINE_STAGES.map(stage => {
            const items = grouped[stage.key] || [];
            const overdueInStage = items.filter(item => isSlaOverdue(item.stage, item.idleDays)).length;
            return (
              <div
                key={stage.key}
                className="w-72 sm:w-80 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col max-h-[70vh]"
                onDragOver={stage.locked ? undefined : handleDragOver}
                onDrop={stage.locked ? undefined : () => handleDropToStage(stage.key)}
              >
                <div className={`px-4 py-3 border-b border-slate-100 rounded-t-2xl ${stage.bg}`}>
                  <div className="flex items-center justify-between">
                    <h3 className={`font-black flex items-center gap-1.5 ${stage.color}`}>
                      {stage.key === 'today_new' && <span>✨</span>}
                      {stage.key === 'ai_recommended' && <span>🤖</span>}
                      {stage.title}
                      {stage.locked && <span className="text-[9px] font-normal opacity-60">（自動）</span>}
                    </h3>
                    <div className="flex items-center gap-1">
                      {overdueInStage > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 border border-orange-200">
                          SLA {overdueInStage}
                        </span>
                      )}
                      {isFiltering && totalByStage[stage.key] && items.length !== totalByStage[stage.key] ? (
                        <span className="text-xs px-2 py-1 rounded-lg bg-indigo-600 text-white font-semibold">
                          {items.length}
                          <span className="opacity-60 font-normal">/{totalByStage[stage.key]}</span>
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-1 rounded-lg bg-white/70 text-slate-700 font-semibold">{items.length}</span>
                      )}
                    </div>
                  </div>
                  
                  {/* LinkedIn + 資料完整度快速篩選（仅 AI 推荐栏位显示）*/}
                  {stage.key === 'ai_recommended' && linkedinStats.total > 0 && (
                    <div className="mt-2 space-y-1">
                      {/* LinkedIn 篩選 */}
                      <div className="flex gap-1 flex-wrap">
                        <button
                          onClick={() => setLinkedinFilter('all')}
                          className={`text-[10px] px-2 py-1 rounded-md font-medium transition-colors ${
                            linkedinFilter === 'all'
                              ? 'bg-violet-600 text-white shadow-sm'
                              : 'bg-white/70 text-violet-700 hover:bg-white border border-violet-200'
                          }`}
                        >
                          全部 {linkedinStats.total}
                        </button>
                        <button
                          onClick={() => setLinkedinFilter('has')}
                          className={`text-[10px] px-2 py-1 rounded-md font-medium transition-colors flex items-center gap-1 ${
                            linkedinFilter === 'has'
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'bg-white/70 text-blue-700 hover:bg-white border border-blue-200'
                          }`}
                        >
                          <Linkedin className="w-2.5 h-2.5" />
                          有LinkedIn {linkedinStats.has}
                        </button>
                        <button
                          onClick={() => setLinkedinFilter('no')}
                          className={`text-[10px] px-2 py-1 rounded-md font-medium transition-colors ${
                            linkedinFilter === 'no'
                              ? 'bg-gray-600 text-white shadow-sm'
                              : 'bg-white/70 text-gray-700 hover:bg-white border border-gray-200'
                          }`}
                        >
                          無LinkedIn {linkedinStats.no}
                        </button>
                      </div>
                      
                      {/* 資料完整度篩選 */}
                      <div className="flex gap-1 flex-wrap">
                        <button
                          onClick={() => setDataCompletenessFilter('all')}
                          className={`text-[10px] px-2 py-1 rounded-md font-medium transition-colors ${
                            dataCompletenessFilter === 'all'
                              ? 'bg-violet-600 text-white shadow-sm'
                              : 'bg-white/70 text-violet-700 hover:bg-white border border-violet-200'
                          }`}
                        >
                          全部 {completenessStats.total}
                        </button>
                        <button
                          onClick={() => setDataCompletenessFilter('complete')}
                          className={`text-[10px] px-2 py-1 rounded-md font-medium transition-colors ${
                            dataCompletenessFilter === 'complete'
                              ? 'bg-green-600 text-white shadow-sm'
                              : 'bg-white/70 text-green-700 hover:bg-white border border-green-200'
                          }`}
                        >
                          ✓ 完整資料 {completenessStats.complete}
                        </button>
                        <button
                          onClick={() => setDataCompletenessFilter('partial')}
                          className={`text-[10px] px-2 py-1 rounded-md font-medium transition-colors ${
                            dataCompletenessFilter === 'partial'
                              ? 'bg-amber-600 text-white shadow-sm'
                              : 'bg-white/70 text-amber-700 hover:bg-white border border-amber-200'
                          }`}
                        >
                          ⚠️ 部分缺失 {completenessStats.partial}
                        </button>
                        <button
                          onClick={() => setDataCompletenessFilter('critical')}
                          className={`text-[10px] px-2 py-1 rounded-md font-medium transition-colors ${
                            dataCompletenessFilter === 'critical'
                              ? 'bg-rose-600 text-white shadow-sm'
                              : 'bg-white/70 text-rose-700 hover:bg-white border border-rose-200'
                          }`}
                        >
                          ❌ 嚴重缺失 {completenessStats.critical}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-3 space-y-3 overflow-y-auto">
                  {items.length === 0 ? (
                    <div className="text-center text-sm text-slate-400 py-8">
                      {searchQuery.trim() ? `找不到「${searchQuery}」` : '暫無候選人'}
                    </div>
                  ) : (
                    items.map((item) => (
                      <div
                        key={item.candidate.id}
                        draggable
                        onDragStart={() => handleDragStart(item.candidate.id)}
                        className={`w-full text-left rounded-xl border border-slate-200 bg-slate-50 hover:bg-white hover:shadow-sm transition p-3 cursor-pointer relative group ${draggingCandidateId === item.candidate.id ? 'opacity-50' : ''}`}
                        onClick={() => setSelectedCandidate(item.candidate)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-1.5">
                              <p className="font-bold text-slate-900">{item.candidate.name}</p>
                              {(item.candidate as any).linkedinUrl && (item.candidate as any).linkedinUrl.trim() && (
                                <a
                                  href={(item.candidate as any).linkedinUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="p-0.5 rounded hover:bg-blue-100 text-blue-600 transition-colors"
                                  title="查看 LinkedIn 個人檔案"
                                >
                                  <Linkedin className="w-3.5 h-3.5" />
                                </a>
                              )}
                              {(item.candidate as any).githubUrl && (item.candidate as any).githubUrl.trim() && (
                                <a
                                  href={(item.candidate as any).githubUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="p-0.5 rounded hover:bg-slate-100 text-slate-700 transition-colors"
                                  title="查看 GitHub 個人檔案"
                                >
                                  <Github className="w-3.5 h-3.5" />
                                </a>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">{item.candidate.position || '未填寫職位'}</p>
                            
                            {/* GitHub 評分（方案 D）*/}
                            {(() => {
                              const githubStats = githubStatsCache[item.candidate.id];
                              const hasGithub = !!(item.candidate as any).githubUrl && (item.candidate as any).githubUrl.trim();
                              
                              if (!hasGithub) return null;
                              
                              if (githubStats === undefined) {
                                return (
                                  <div className="mt-1 text-[10px] text-slate-400">
                                    載入 GitHub 數據中...
                                  </div>
                                );
                              }
                              
                              if (!githubStats) return null;
                              
                              const renderStars = (count: number) => {
                                const stars = [];
                                for (let i = 0; i < 5; i++) {
                                  stars.push(
                                    <Star
                                      key={i}
                                      className={`w-2.5 h-2.5 ${i < count ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
                                    />
                                  );
                                }
                                return stars;
                              };
                              
                              const activityColor = 
                                githubStats.activity.daysAgo <= 7 ? 'text-green-600' :
                                githubStats.activity.daysAgo <= 30 ? 'text-blue-600' :
                                githubStats.activity.daysAgo <= 90 ? 'text-amber-600' :
                                'text-slate-500';
                              
                              return (
                                <div className="mt-1.5 space-y-0.5">
                                  <div className="flex items-center gap-2 text-[10px]">
                                    <div className="flex items-center gap-0.5">
                                      <Github className="w-3 h-3 text-slate-600" />
                                      <span className="font-medium text-slate-700">{githubStats.score}分</span>
                                    </div>
                                    <div className="flex items-center gap-0.5">
                                      {renderStars(githubStats.stars)}
                                    </div>
                                    <span className={`${activityColor} font-medium`}>
                                      {githubStats.activity.daysAgo}天前
                                    </span>
                                  </div>
                                  {/* v2: 4 維度摘要 */}
                                  {githubStats.version === 2 && githubStats.skillMatch && (
                                    <div className="flex items-center gap-1.5 text-[9px] text-slate-500">
                                      <span title="技能匹配">🎯{githubStats.skillMatch.score}%</span>
                                      <span title="專案品質">📦{githubStats.projectQuality?.score || 0}</span>
                                      <span title={`活躍 ${githubStats.activity.activeMonths || 0}/6 個月`}>⚡{githubStats.activity.activeMonths || 0}/6月</span>
                                      {githubStats.skillMatch.matchedSkills.length > 0 && (
                                        <span className="text-green-600 truncate max-w-[80px]" title={githubStats.skillMatch.matchedSkills.join(', ')}>
                                          ✓{githubStats.skillMatch.matchedSkills.slice(0, 2).join(',')}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-500">
                              #{item.candidate.id}
                            </span>
                            <button
                              onClick={(e) => handleDeleteCandidate(item.candidate.id, item.candidate.name, e)}
                              className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-rose-100 text-slate-400 hover:text-rose-600 transition-all"
                              title="刪除候選人"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="mt-2 text-xs text-slate-600 space-y-1">
                          {/* 資料完整度警告 */}
                          {(() => {
                            const completeness = getDataCompleteness(item.candidate);
                            if (completeness === 'critical') {
                              return (
                                <div className="flex items-center gap-1 text-rose-700 bg-rose-50 border border-rose-200 rounded px-2 py-1">
                                  <AlertTriangle className="w-3 h-3" />
                                  <span className="font-medium">缺少聯絡資訊</span>
                                </div>
                              );
                            }
                            if (completeness === 'partial') {
                              return (
                                <div className="flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                                  <AlertTriangle className="w-3 h-3" />
                                  <span className="font-medium">無外部連結</span>
                                </div>
                              );
                            }
                            return null;
                          })()}
                          
                          <p>👔 {item.candidate.consultant || '未指派'}</p>
                          <p>🎯 {item.targetJob}</p>

                          {item.latestProgress ? (
                            <p className="flex items-center gap-1 text-slate-700">
                              <Clock3 className="w-3 h-3" />
                              {item.latestProgress.date} · {item.latestProgress.by}
                            </p>
                          ) : (
                            <p className="text-slate-400">尚無進度記錄</p>
                          )}

                          <div className="pt-1 flex items-center gap-2 flex-wrap">
                            <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-md ${getIdleBadgeClass(item.idleDays)}`}>
                              {item.idleDays >= 7 && <AlertTriangle className="w-3 h-3" />}
                              停留 {item.idleDays} 天
                            </span>
                            {isSlaOverdue(item.stage, item.idleDays) && (
                              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-orange-100 text-orange-700 border border-orange-200">
                                <AlertTriangle className="w-3 h-3" />
                                超過 SLA（大於 {getStageSlaDays(item.stage)} 天）
                              </span>
                            )}
                          </div>

                          {item.latestProgress?.note && (
                            <p className="text-slate-500 line-clamp-2">📝 {item.latestProgress.note}</p>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selectedCandidate && (
        <CandidateModal
          candidate={selectedCandidate}
          onClose={() => setSelectedCandidate(null)}
          onCandidateUpdate={(id, updates) => {
            setCandidates(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
            setSelectedCandidate(prev => prev && prev.id === id ? { ...prev, ...updates } : prev);
          }}
        />
      )}

      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-slate-900 text-white text-sm px-4 py-2.5 shadow-2xl">
          {toastMessage}
        </div>
      )}

      {/* 婉拒確認 Modal */}
      {rejectionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-black text-slate-900 mb-1 flex items-center gap-2">
              <span className="text-rose-500">婉拒</span> 確認
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              將 <span className="font-semibold text-slate-800">{rejectionModal.candidateName}</span> 移入婉拒，請填寫婉拒原因（必填）
            </p>
            <textarea
              autoFocus
              value={rejectionReason}
              onChange={e => setRejectionReason(e.target.value)}
              placeholder="例：薪資期望過高、技術不符、候選人主動婉拒..."
              className="w-full border border-slate-300 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-rose-400 min-h-[96px]"
            />
            {rejectionReason.trim() === '' && (
              <p className="text-xs text-rose-500 mt-1">* 婉拒原因不可空白</p>
            )}
            <div className="flex gap-2 mt-4 justify-end">
              <button
                onClick={() => { setRejectionModal(null); setRejectionReason(''); }}
                className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleRejectionConfirm}
                disabled={!rejectionReason.trim()}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                確認婉拒
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
