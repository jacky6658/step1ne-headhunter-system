import React, { useEffect, useMemo, useState } from 'react';
import { Candidate, CandidateStatus, ProgressEvent, UserProfile } from '../types';
import { getCandidates, clearCache } from '../services/candidateService';
import { CandidateModal } from '../components/CandidateModal';
import { apiPut } from '../config/api';
import { RefreshCw, Shield, Clock3, BarChart3, AlertTriangle, Download } from 'lucide-react';

interface PipelinePageProps {
  userProfile: UserProfile;
}

type PipelineStageKey = 'not_started' | 'contacted' | 'interviewed' | 'offer' | 'onboarded' | 'rejected' | 'other';

interface PipelineItem {
  candidate: Candidate;
  stage: PipelineStageKey;
  latestProgress?: ProgressEvent;
  idleDays: number;
  targetJob: string;
}

const PIPELINE_STAGES: Array<{ key: PipelineStageKey; title: string; color: string; bg: string }> = [
  { key: 'not_started', title: '未開始', color: 'text-slate-700', bg: 'bg-slate-100' },
  { key: 'contacted', title: '已聯繫', color: 'text-blue-700', bg: 'bg-blue-100' },
  { key: 'interviewed', title: '已面試', color: 'text-indigo-700', bg: 'bg-indigo-100' },
  { key: 'offer', title: 'Offer', color: 'text-amber-700', bg: 'bg-amber-100' },
  { key: 'onboarded', title: '已上職', color: 'text-green-700', bg: 'bg-green-100' },
  { key: 'rejected', title: '婉拒', color: 'text-rose-700', bg: 'bg-rose-100' },
  { key: 'other', title: '其他', color: 'text-purple-700', bg: 'bg-purple-100' },
];

function mapEventToStage(event?: string): PipelineStageKey {
  const e = (event || '').trim();
  if (!e) return 'not_started';

  if (e.includes('已聯繫')) return 'contacted';
  if (e.includes('已面試') || e.includes('面試')) return 'interviewed';
  if (e.toLowerCase().includes('offer')) return 'offer';
  if (e.includes('已上職') || e.includes('到職')) return 'onboarded';
  if (e.includes('婉拒') || e.includes('拒絕')) return 'rejected';
  return 'other';
}

function mapStatusToStage(status: CandidateStatus): PipelineStageKey {
  switch (status) {
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
    default:
      return 'not_started';
  }
}

function stageToStatus(stage: PipelineStageKey): CandidateStatus {
  switch (stage) {
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
    case 'contacted':
      return '已聯繫';
    case 'interviewed':
      return '已面試';
    case 'offer':
      return 'Offer';
    case 'onboarded':
      return '已上職';
    case 'rejected':
      return '婉拒';
    case 'other':
      return '其他';
    default:
      return '已聯繫';
  }
}

function getLatestProgress(progress?: ProgressEvent[]): ProgressEvent | undefined {
  if (!progress || progress.length === 0) return undefined;

  return [...progress].sort((a, b) => {
    const aTime = new Date(a.date).getTime();
    const bTime = new Date(b.date).getTime();
    return bTime - aTime;
  })[0];
}

function getIdleDays(dateString?: string): number {
  if (!dateString) return 999;
  const now = new Date();
  const target = new Date(dateString);
  const diff = now.getTime() - target.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function parseTargetJob(notes?: string): string {
  if (!notes) return '未指定';
  const match = notes.match(/應徵：(.+?)\s*\((.+?)\)/);
  if (match) {
    return `${match[1]} (${match[2]})`;
  }
  return '未指定';
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

  const [consultantFilter, setConsultantFilter] = useState<string>('all');
  const [jobFilter, setJobFilter] = useState<string>('all');

  const loadCandidates = async () => {
    setLoading(true);
    try {
      const data = await getCandidates(userProfile);
      setCandidates(data);
    } catch (error) {
      console.error('載入 Pipeline 失敗:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userProfile) {
      loadCandidates();
    }
  }, [userProfile]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      clearCache();
      const data = await getCandidates(userProfile);
      setCandidates(data);
      setToastMessage('✅ Pipeline 已更新到最新資料');
    } catch (error) {
      console.error('重新整理 Pipeline 失敗:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const candidatesWithStage = useMemo<PipelineItem[]>(() => {
    return candidates.map(candidate => {
      const latestProgress = getLatestProgress(candidate.progressTracking);
      const stage = latestProgress ? mapEventToStage(latestProgress.event) : mapStatusToStage(candidate.status);
      const idleDays = latestProgress?.date ? getIdleDays(latestProgress.date) : getIdleDays(candidate.updatedAt);
      const targetJob = parseTargetJob(candidate.notes);
      return { candidate, stage, latestProgress, idleDays, targetJob };
    });
  }, [candidates]);

  const consultantOptions = useMemo(() => {
    const list = [...new Set(candidatesWithStage.map(item => item.candidate.consultant || '未指派'))];
    return list.sort();
  }, [candidatesWithStage]);

  const jobOptions = useMemo(() => {
    const list = [...new Set(candidatesWithStage.map(item => item.targetJob))];
    return list.sort();
  }, [candidatesWithStage]);

  const filteredItems = useMemo(() => {
    return candidatesWithStage.filter(item => {
      const consultant = item.candidate.consultant || '未指派';
      const consultantMatched = consultantFilter === 'all' || consultant === consultantFilter;
      const jobMatched = jobFilter === 'all' || item.targetJob === jobFilter;
      // REVIEWER 只顯示自己的候選人，ADMIN 顯示全部
      const roleMatched = userProfile.role === 'ADMIN' || consultant === userProfile.displayName;
      return consultantMatched && jobMatched && roleMatched;
    });
  }, [candidatesWithStage, consultantFilter, jobFilter, userProfile]);

  const grouped = useMemo(() => {
    const result: Record<PipelineStageKey, PipelineItem[]> = {
      not_started: [],
      contacted: [],
      interviewed: [],
      offer: [],
      onboarded: [],
      rejected: [],
      other: [],
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

  const handleDropToStage = async (stage: PipelineStageKey) => {
    if (!draggingCandidateId) return;

    const targetCandidate = candidates.find(c => c.id === draggingCandidateId);
    if (!targetCandidate) return;

    const latest = getLatestProgress(targetCandidate.progressTracking);
    const currentStage = latest ? mapEventToStage(latest.event) : mapStatusToStage(targetCandidate.status);
    if (currentStage === stage) {
      setDraggingCandidateId(null);
      return;
    }

    const userName = userProfile.displayName || 'System';
    const newEvent: ProgressEvent = {
      date: new Date().toISOString().split('T')[0],
      event: stageToEvent(stage),
      by: userName,
    };

    const updatedProgress = [...(targetCandidate.progressTracking || []), newEvent];
    const newStatus = stageToStatus(stage);

    try {
      // 方案 A + B：同時更新 SQL + Google Sheets
      // API 會先寫入 SQL（即時），再異步同步到 Google Sheets
      await apiPut(`/api/candidates/${targetCandidate.id}`, {
        status: newStatus,
        name: targetCandidate.name,
        consultant: userProfile.displayName || 'System',
        notes: `改為「${stageToEvent(stage)}」於 ${new Date().toLocaleDateString('zh-TW')}`,
        progressTracking: updatedProgress,
      });

      // 本地更新 UI（快速反應）
      setCandidates(prev =>
        prev.map(c =>
          c.id === targetCandidate.id
            ? {
                ...c,
                status: newStatus,
                progressTracking: updatedProgress,
                updatedAt: new Date().toISOString(),
              }
            : c
        )
      );
      setToastMessage(`✅ ${targetCandidate.name} 已移動到「${PIPELINE_STAGES.find(s => s.key === stage)?.title || stage}」（已同步到後端 + Google Sheets）`);
    } catch (error) {
      console.error('❌ 拖拉更新 Pipeline 失敗:', error);
      alert('❌ 更新失敗，請稍後再試');
    } finally {
      setDraggingCandidateId(null);
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
    link.download = `pipeline-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setToastMessage('✅ Pipeline 報表已匯出 CSV');
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">載入 Pipeline 追蹤資料中...</p>
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
              Pipeline 追蹤
            </h2>
            <p className="text-slate-500 mt-1">依最新進度事件自動分欄，快速掌握整體招聘漏斗</p>
            {userProfile.role !== 'ADMIN' && (
              <p className="text-sm text-blue-600 mt-2 flex items-center gap-1">
                <Shield className="w-4 h-4" />
                只顯示您可查看的候選人
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
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

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-slate-500">顧問篩選</label>
            <select
              value={consultantFilter}
              onChange={(e) => setConsultantFilter(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="all">全部顧問</option>
              {consultantOptions.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500">職缺篩選</label>
            <select
              value={jobFilter}
              onChange={(e) => setJobFilter(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="all">全部職缺</option>
              {jobOptions.map(job => (
                <option key={job} value={job}>{job}</option>
              ))}
            </select>
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
            <p className="text-xs text-green-600">已上職</p>
            <p className="text-lg font-black text-green-700">{grouped.onboarded.length}</p>
          </div>
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
                className="w-80 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col max-h-[70vh]"
                onDragOver={handleDragOver}
                onDrop={() => handleDropToStage(stage.key)}
              >
                <div className={`px-4 py-3 border-b border-slate-100 rounded-t-2xl ${stage.bg}`}>
                  <div className="flex items-center justify-between">
                    <h3 className={`font-black ${stage.color}`}>{stage.title}</h3>
                    <div className="flex items-center gap-1">
                      {overdueInStage > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 border border-orange-200">
                          SLA {overdueInStage}
                        </span>
                      )}
                      <span className="text-xs px-2 py-1 rounded-lg bg-white/70 text-slate-700 font-semibold">{items.length}</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 space-y-3 overflow-y-auto">
                  {items.length === 0 ? (
                    <div className="text-center text-sm text-slate-400 py-8">暫無候選人</div>
                  ) : (
                    items.map((item) => (
                      <button
                        key={item.candidate.id}
                        draggable
                        onDragStart={() => handleDragStart(item.candidate.id)}
                        onClick={() => setSelectedCandidate(item.candidate)}
                        className={`w-full text-left rounded-xl border border-slate-200 bg-slate-50 hover:bg-white hover:shadow-sm transition p-3 ${draggingCandidateId === item.candidate.id ? 'opacity-50' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-bold text-slate-900">{item.candidate.name}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{item.candidate.position || '未填寫職位'}</p>
                          </div>
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-500">
                            #{item.candidate.id}
                          </span>
                        </div>

                        <div className="mt-2 text-xs text-slate-600 space-y-1">
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
                      </button>
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
        />
      )}

      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-slate-900 text-white text-sm px-4 py-2.5 shadow-2xl">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
