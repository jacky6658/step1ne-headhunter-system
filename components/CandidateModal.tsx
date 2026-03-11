// Step1ne Headhunter System - 候選人詳情 Modal
import React, { useState } from 'react';
import { Candidate, CandidateStatus, AiMatchResult, JobRankingEntry, ExternalJobSuggestion } from '../types';
import { ResumePreview } from './ResumeGenerator';
import { CANDIDATE_STATUS_CONFIG } from '../constants';
import { apiPatch, apiGet, getApiUrl } from '../config/api';
import {
  X, User, Mail, Phone, MapPin, Briefcase, Calendar,
  TrendingUp, Award, FileText, MessageSquare, Clock,
  CheckCircle2, AlertCircle, Bot, Star, ThumbsUp, ThumbsDown,
  HelpCircle, Sparkles, Target, Globe, Trash2
} from 'lucide-react';

// ── 系統外職缺建議：rule-based 技能→產業/職缺對照 ──────────────────────────
function generateExternalSuggestions(rawSkills: string | string[]): ExternalJobSuggestion[] {
  const skillsArr: string[] = Array.isArray(rawSkills)
    ? rawSkills
    : (rawSkills || '').split(/[,、]+/).map(s => s.trim()).filter(Boolean);
  const normalized = skillsArr.map(s => s.toLowerCase().trim());

  const rules: Array<{ keywords: string[]; industry: string; role: string; reason: string; priority: number }> = [
    { keywords: ['java', 'spring', 'spring boot'], industry: 'Fintech', role: '後端工程師', reason: 'Java + Spring Boot 是 Fintech 後端核心技術棧，銀行、保險、支付公司需求旺盛', priority: 90 },
    { keywords: ['golang', 'go'], industry: '雲端服務 / SaaS', role: '後端工程師', reason: 'Go 語言高併發特性，適合雲端 SaaS 與高流量後端系統', priority: 85 },
    { keywords: ['python', 'django', 'fastapi', 'flask'], industry: 'AI / 數據平台', role: '後端 / 數據工程師', reason: 'Python 生態廣泛應用於 AI 產品開發與數據工程，各產業均有需求', priority: 82 },
    { keywords: ['node.js', 'nodejs', 'express', 'nestjs'], industry: 'SaaS / 新創', role: '全端工程師', reason: 'Node.js 在新創 SaaS 平台是主流技術棧，適合快速迭代環境', priority: 78 },
    { keywords: ['php', 'laravel'], industry: '電商 / 企業系統', role: '後端工程師', reason: 'PHP / Laravel 是電商平台與內容管理系統的主力語言', priority: 60 },
    { keywords: ['ruby', 'rails'], industry: '新創 SaaS', role: '後端工程師', reason: 'Ruby on Rails 是快速迭代新創的首選框架，MVP 開發需求旺盛', priority: 65 },
    { keywords: ['rust'], industry: '系統軟體 / Web3', role: '系統工程師', reason: 'Rust 高效能與記憶體安全特性，適合底層系統與區塊鏈開發', priority: 72 },
    { keywords: ['docker', 'kubernetes', 'k8s'], industry: 'DevOps / 雲端', role: 'DevOps 工程師 / SRE', reason: 'Container 技術是現代 DevOps 必備，各大雲端廠商及規模化新創均有需求', priority: 88 },
    { keywords: ['aws', 'gcp', 'azure', 'terraform'], industry: '雲端架構', role: '雲端架構師 / Cloud Engineer', reason: '雲端平台經驗在各產業數位轉型需求下，人才嚴重缺口', priority: 85 },
    { keywords: ['react', 'next.js', 'nextjs'], industry: 'B2B SaaS', role: '前端工程師', reason: 'React 生態在 SaaS 產品、數位媒體、B2B 平台需求量最大', priority: 80 },
    { keywords: ['vue', 'nuxt'], industry: '台灣電商 / 新創', role: '前端工程師', reason: 'Vue.js 在台灣本土電商、新創公司廣泛使用，人才相對稀缺', priority: 75 },
    { keywords: ['pytorch', 'tensorflow', 'keras', 'llm', 'ai/ml'], industry: 'AI / 生成式 AI', role: 'ML 工程師 / AI 應用開發', reason: 'AI 框架經驗在 AI 產品公司、研究院、GenAI 新創極度搶手', priority: 95 },
    { keywords: ['spark', 'hadoop', 'kafka', 'databricks', 'flink'], industry: '大數據平台', role: '數據工程師 / Data Engineer', reason: '大數據處理技術在電商、廣告科技、金融數據平台需求穩定', priority: 75 },
    { keywords: ['flutter', 'dart'], industry: 'App 開發（跨平台）', role: '跨平台 App 工程師', reason: 'Flutter 可一人覆蓋 iOS + Android，新創與中小型 App 公司需求旺盛', priority: 80 },
    { keywords: ['swift', 'swiftui', 'ios'], industry: 'iOS App', role: 'iOS 工程師', reason: 'iOS 原生開發需求穩定，Fintech App 與消費品牌 App 尤為搶手', priority: 78 },
    { keywords: ['kotlin', 'android'], industry: 'Android App', role: 'Android 工程師', reason: 'Android 原生開發在東南亞市場及本土 App 公司需求持續', priority: 72 },
    { keywords: ['solidity', 'ethereum', 'web3', 'blockchain'], industry: 'Web3 / 區塊鏈', role: '智能合約工程師 / DeFi 開發', reason: 'Web3 技能稀缺，區塊鏈協議、DeFi 專案、GameFi 均有強烈需求', priority: 88 },
    { keywords: ['security', 'pentest', 'cybersecurity', 'owasp'], industry: '資安', role: '資安工程師 / 滲透測試工程師', reason: '資安人才極度稀缺，金融業、政府機構、上市企業均有高度需求', priority: 92 },
    { keywords: ['redis', 'memcached'], industry: '高效能後端系統', role: '後端工程師', reason: '快取與高併發架構經驗，適合電商大促、即時通訊等高流量場景', priority: 68 },
    { keywords: ['elasticsearch', 'opensearch'], industry: '搜尋 / 數據平台', role: '搜尋工程師 / 後端工程師', reason: 'Elasticsearch 廣泛應用於全文搜尋、日誌分析、BI 平台', priority: 65 },
  ];

  const matched: (ExternalJobSuggestion & { priority: number })[] = [];
  for (const rule of rules) {
    const triggeredOrig = skillsArr.filter(s =>
      rule.keywords.some(kw => s.toLowerCase().includes(kw) || kw.includes(s.toLowerCase()))
    );
    const triggeredNorm = rule.keywords.filter(kw =>
      normalized.some(s => s.includes(kw) || kw.includes(s))
    );
    if (triggeredNorm.length > 0) {
      matched.push({
        industry: rule.industry,
        role: rule.role,
        reason: rule.reason,
        triggered_skills: (triggeredOrig.length > 0 ? triggeredOrig : [triggeredNorm[0]]).slice(0, 3),
        confidence: triggeredNorm.length >= 2 ? 'high' : 'medium',
        priority: rule.priority,
      });
    }
  }

  matched.sort((a, b) => b.priority - a.priority);
  const seen = new Set<string>();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return matched.filter(s => { if (seen.has(s.industry)) return false; seen.add(s.industry); return true; })
    .slice(0, 5)
    .map(({ priority: _p, ...rest }) => rest);
}

// ─────────────────────────────────────────────────────────────────────────────

interface CandidateModalProps {
  candidate: Candidate;
  onClose: () => void;
  onUpdateStatus?: (candidateId: string, newStatus: CandidateStatus) => void;
  currentUserName?: string;
  onAssignRecruiter?: (candidateId: string, recruiter: string) => void;
  onCandidateUpdate?: (candidateId: string, updates: Partial<Candidate>) => void;
}

export function CandidateModal({ candidate, onClose, onUpdateStatus, currentUserName, onAssignRecruiter, onCandidateUpdate }: CandidateModalProps) {
  const [activeTab, setActiveTab] = useState<'info' | 'history' | 'notes' | 'ai_match'>('info');
  const [showResume, setShowResume] = useState(false);
  const [addingProgress, setAddingProgress] = useState(false);
  const [newProgressEvent, setNewProgressEvent] = useState('');
  const [newProgressNote, setNewProgressNote] = useState('');
  const [showInviteMessage, setShowInviteMessage] = useState(false);
  const [showResumeGen, setShowResumeGen] = useState(false);
  const [inviteMessage, setInviteMessage] = useState('');
  const [editingRecruiter, setEditingRecruiter] = useState(false);
  const [recruiterInput, setRecruiterInput] = useState(candidate.consultant || '');
  const [newNoteText, setNewNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [localNotes, setLocalNotes] = useState(candidate.notes || '');
  // 目標職缺（使用獨立 target_job_id 欄位，不再存在 notes）
  const [editingTargetJob, setEditingTargetJob] = useState(false);
  const [targetJobId, setTargetJobId] = useState<number | null>(candidate.targetJobId ?? null);
  const [targetJobInput, setTargetJobInput] = useState(candidate.targetJobLabel ?? '');
  const [savingTargetJob, setSavingTargetJob] = useState(false);
  const [editingLinkedin, setEditingLinkedin] = useState(false);
  const [editingGithub, setEditingGithub] = useState(false);
  const [linkedinInput, setLinkedinInput] = useState((candidate as any).linkedinUrl || '');
  const [githubInput, setGithubInput] = useState((candidate as any).githubUrl || '');
  const [savingLinkedin, setSavingLinkedin] = useState(false);
  const [savingGithub, setSavingGithub] = useState(false);
  const [enrichedCandidate, setEnrichedCandidate] = useState(candidate);

  // 基本資料編輯
  const [editingBasicInfo, setEditingBasicInfo] = useState(false);
  const [editName, setEditName] = useState(candidate.name);
  const [editPosition, setEditPosition] = useState(candidate.position || '');
  const [editLocation, setEditLocation] = useState(candidate.location || '');
  const [editPhone, setEditPhone] = useState(candidate.phone || '');
  const [editEmail, setEditEmail] = useState(candidate.email || '');
  const [editYears, setEditYears] = useState(String(candidate.years || ''));
  const [editSkills, setEditSkills] = useState(
    Array.isArray(candidate.skills) ? candidate.skills.join('、') : (candidate.skills || ''));
  const [savingBasicInfo, setSavingBasicInfo] = useState(false);

  // PDF 履歷匯入
  const [showImport, setShowImport] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importParsed, setImportParsed] = useState<any | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSelected, setImportSelected] = useState<Set<string>>(new Set());
  const [applyingImport, setApplyingImport] = useState(false);

  // 工作經歷本地狀態（支援新增/編輯/刪除）
  const [workItems, setWorkItems] = useState<any[]>(() => {
    const raw = candidate.workHistory;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
      try { const p = JSON.parse(raw); if (Array.isArray(p)) return p; } catch {}
      return raw.split(';').map((job: string) => {
        const t = job.trim(); if (!t) return null;
        const m = t.match(/^(.+?)\s+(\d+年?)?\(([^)]+)\):\s*(.+)$/);
        if (m) return { company: m[1].trim(), title: m[4].trim(), start: '', end: '', duration_months: 0, description: m[4].trim() };
        const s = t.match(/^(.+?):\s*(.+)$/);
        if (s) return { company: s[1].trim(), title: s[2].trim(), start: '', end: '', duration_months: 0 };
        return null;
      }).filter(Boolean);
    }
    return [];
  });
  const [addingWork, setAddingWork] = useState(false);
  const [editingWorkIdx, setEditingWorkIdx] = useState<number | null>(null);
  const [workForm, setWorkForm] = useState({ company: '', title: '', start: '', end: '', description: '' });
  const [savingWork, setSavingWork] = useState(false);

  // 教育背景本地狀態（支援新增/編輯/刪除）
  const [eduItems, setEduItems] = useState<any[]>(() => Array.isArray(candidate.educationJson) ? candidate.educationJson : []);
  const [addingEdu, setAddingEdu] = useState(false);
  const [editingEduIdx, setEditingEduIdx] = useState<number | null>(null);
  const [eduForm, setEduForm] = useState({ school: '', degree: '', major: '', start: '', end: '' });
  const [savingEdu, setSavingEdu] = useState(false);

  // 職缺匹配排名
  const [jobRankings, setJobRankings] = useState<JobRankingEntry[]>([]);
  const [loadingRankings, setLoadingRankings] = useState(false);
  const [rankingsLoaded, setRankingsLoaded] = useState(false);
  const [showAllRankings, setShowAllRankings] = useState(false);

  // 負責顧問 / 目標職缺 下拉清單
  const [users, setUsers] = useState<string[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [recruiterSearch, setRecruiterSearch] = useState('');
  const [jobs, setJobs] = useState<{ id: number; position_name: string; client_company: string }[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [targetJobSearch, setTargetJobSearch] = useState('');

  // 禁止背景滾動
  React.useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);
  
  // 重新 fetch 候選人資料以獲得最新的 aiMatchResult
  React.useEffect(() => {
    const fetchLatest = async () => {
      try {
        const response = await fetch(getApiUrl(`/candidates/${candidate.id}`));
        if (response.ok) {
          const result = await response.json();
          const data = result.data || {};
          // 合併後端資料到 candidate，確保 aiMatchResult 存在
          setEnrichedCandidate({
            ...candidate,
            aiMatchResult: data.ai_match_result || data.aiMatchResult || candidate.aiMatchResult || null
          });
        }
      } catch (error) {
        console.error('Fetch candidate detail failed:', error);
        setEnrichedCandidate(candidate);
      }
    };
    fetchLatest();
  }, [candidate.id, candidate]);

  // 職缺匹配排名：切換到 ai_match tab 時才載入（懶加載）
  const fetchJobRankings = React.useCallback(async () => {
    if (rankingsLoaded || loadingRankings) return;
    setLoadingRankings(true);
    try {
      const res = await fetch(getApiUrl(`/candidates/${candidate.id}/job-rankings`));
      if (res.ok) {
        const data = await res.json();
        setJobRankings(data.rankings || []);
      }
    } catch (e) {
      console.error('fetchJobRankings failed:', e);
    } finally {
      setLoadingRankings(false);
      setRankingsLoaded(true);
    }
  }, [candidate.id, rankingsLoaded, loadingRankings]);

  // 預載入顧問清單與職缺清單
  React.useEffect(() => {
    setLoadingUsers(true);
    apiGet<{ success: boolean; data: string[] }>('/api/users')
      .then(res => { if (res.success) setUsers(res.data); })
      .catch(() => {})
      .finally(() => setLoadingUsers(false));

    setLoadingJobs(true);
    apiGet<any>('/api/jobs')
      .then(res => {
        const arr = Array.isArray(res) ? res : (res.data || []);
        setJobs(arr.map((j: any) => ({ id: j.id, position_name: j.position_name || '', client_company: j.client_company || '' })));
      })
      .catch(() => {})
      .finally(() => setLoadingJobs(false));
  }, []);

  // 新增進度記錄
  const handleAddProgress = async (eventType: string) => {
    setNewProgressEvent(eventType);
    setAddingProgress(true);
  };
  
  // 進度事件 → 候選人狀態映射（與 Pipeline 階段一致）
  const eventToStatus: Record<string, string> = {
    '未開始':  '未開始',
    'AI推薦':  'AI推薦',
    '聯繫階段':  '聯繫階段',
    '面試階段':  '面試階段',
    'Offer':   'Offer',
    'on board':  'on board',
    '婉拒':    '婉拒',
    '備選人才': '備選人才',
  };

  // 確認新增進度
  const handleConfirmAddProgress = async () => {
    if (!newProgressEvent) return;

    try {
      const user = JSON.parse(localStorage.getItem('step1ne-user') || '{}');
      const userName = user.name || 'Unknown';

      const newEvent = {
        date: new Date().toISOString().split('T')[0],
        event: newProgressEvent,
        by: userName,
        ...(newProgressNote ? { note: newProgressNote } : {})
      };

      const updatedProgress = [...(candidate.progressTracking || []), newEvent];
      const newStatus = eventToStatus[newProgressEvent] || candidate.status;

      // 用 PATCH 同時更新 status + progressTracking
      await apiPatch(`/api/candidates/${candidate.id}`, {
        status: newStatus,
        progressTracking: updatedProgress,
        actor: currentUserName || userName,
      });

      alert('✅ 進度新增成功！看板與 Pipeline 欄位已同步更新');
      window.location.reload();

    } catch (error) {
      console.error('❌ 新增進度失敗:', error);
      alert('❌ 新增進度失敗，請稍後再試');
    } finally {
      setAddingProgress(false);
      setNewProgressEvent('');
      setNewProgressNote('');
    }
  };
  
  // Task A: 生成 GitHub 候選人邀請訊息
  const handleGenerateInviteMessage = () => {
    const skills = Array.isArray(candidate.skills) 
      ? candidate.skills 
      : candidate.skills.split(/[、,，]/);
    
    const topSkills = skills.slice(0, 3).join('、');
    const targetJob = candidate.notes?.match(/應徵：(.+?) \((.+?)\)/);
    const jobTitle = targetJob ? targetJob[1] : '相關職位';
    const companyName = targetJob ? targetJob[2] : '我們公司';
    
    const message = `Hi ${candidate.name}，

我在 GitHub 上看到您的專案，對您的 ${topSkills} 技術能力印象深刻！

我們目前有一個 ${jobTitle} 的機會，工作內容與您的技術背景非常匹配。${companyName} 是一家【公司簡介】，團隊氛圍開放，技術棧包括【技術棧】。

如果您有興趣了解更多，歡迎回覆這封訊息或加我 LinkedIn，我們可以安排時間聊聊！

期待與您交流 😊

---
最佳問候
${JSON.parse(localStorage.getItem('step1ne-user') || '{}').name || 'HR Team'}
Step1ne Recruitment`;
    
    setInviteMessage(message);
    setShowInviteMessage(true);
  };
  
  // 指派/更新負責顧問
  const handleSaveRecruiter = async () => {
    try {
      await apiPatch(`/api/candidates/${candidate.id}`, {
        recruiter: recruiterInput,
        actor: currentUserName || 'system',
      });
      candidate.consultant = recruiterInput;
      onAssignRecruiter?.(candidate.id, recruiterInput);
      setEditingRecruiter(false);
    } catch (err) {
      alert('❌ 指派失敗，請稍後再試');
    }
  };

  // 儲存目標職缺（更新 notes 中的目標職缺欄位）
  const handleSaveTargetJob = async (jobId: number | null, jobLabel: string) => {
    setSavingTargetJob(true);
    try {
      await apiPatch(`/api/candidates/${candidate.id}`, {
        target_job_id: jobId,
        actor: currentUserName || 'system',
      });
      setTargetJobId(jobId);
      setTargetJobInput(jobLabel);
      setEditingTargetJob(false);
    } catch (err) {
      alert('❌ 儲存目標職缺失敗，請稍後再試');
    } finally {
      setSavingTargetJob(false);
    }
  };

  // 儲存新備註（附加到現有備註後）
  const handleSaveNote = async () => {
    if (!newNoteText.trim()) return;
    setSavingNote(true);
    try {
      const timestamp = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false });
      const author = currentUserName || JSON.parse(localStorage.getItem('step1ne-user') || '{}').name || '顧問';
      const newEntry = `[${timestamp}] ${author}：${newNoteText.trim()}`;
      const merged = localNotes ? `${localNotes}\n${newEntry}` : newEntry;

      await apiPatch(`/api/candidates/${candidate.id}`, {
        notes: merged,
        actor: author,
      });

      setLocalNotes(merged);
      setNewNoteText('');
    } catch (err) {
      alert('❌ 儲存備註失敗，請稍後再試');
    } finally {
      setSavingNote(false);
    }
  };

  // 刪除指定備註區塊（依行號範圍）
  const handleDeleteNoteBlock = async (lineStart: number, lineEnd: number) => {
    if (!confirm('確定要刪除這則備註嗎？')) return;
    const lines = localNotes.split('\n');
    const newLines = [...lines.slice(0, lineStart), ...lines.slice(lineEnd + 1)];
    const newNotes = newLines.join('\n').trim().replace(/\n{3,}/g, '\n\n');
    const author = currentUserName || JSON.parse(localStorage.getItem('step1ne-user') || '{}').name || '顧問';
    try {
      await apiPatch(`/api/candidates/${candidate.id}`, { notes: newNotes, actor: author });
      setLocalNotes(newNotes);
    } catch {
      alert('❌ 刪除備註失敗，請稍後再試');
    }
  };

  // 儲存 LinkedIn URL
  const handleSaveLinkedin = async () => {
    setSavingLinkedin(true);
    try {
      await apiPatch(`/api/candidates/${candidate.id}`, {
        linkedin_url: linkedinInput.trim(),
        actor: currentUserName || 'system',
      });
      (candidate as any).linkedinUrl = linkedinInput.trim();
      setEditingLinkedin(false);
    } catch (err) {
      alert('❌ 儲存 LinkedIn 失敗，請稍後再試');
    } finally {
      setSavingLinkedin(false);
    }
  };

  // 儲存 GitHub URL
  const handleSaveGithub = async () => {
    setSavingGithub(true);
    try {
      await apiPatch(`/api/candidates/${candidate.id}`, {
        github_url: githubInput.trim(),
        actor: currentUserName || 'system',
      });
      (candidate as any).githubUrl = githubInput.trim();
      setEditingGithub(false);
    } catch (err) {
      alert('❌ 儲存 GitHub 失敗，請稍後再試');
    } finally {
      setSavingGithub(false);
    }
  };

  // PDF 履歷匯入處理
  const IMPORT_FIELD_LABELS: Record<string, string> = {
    name: '姓名', position: '職稱', location: '地點', years: '年資',
    skills: '技能', education: '學歷', linkedinUrl: 'LinkedIn URL',
    notes: '個人簡介', workHistory: '工作經歷', educationJson: '學歷詳情',
  };
  const IMPORT_FIELDS = Object.keys(IMPORT_FIELD_LABELS);

  const handleImportPDF = async (file: File) => {
    setImportLoading(true);
    setImportError(null);
    setImportParsed(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const resp = await fetch(getApiUrl('/api/resume/parse'), { method: 'POST', body: formData });
      const json = await resp.json();
      if (!json.success) throw new Error(json.error || '解析失敗');
      setImportParsed(json.parsed);
      // 預設全選有值的欄位
      const defaultSelected = new Set(
        IMPORT_FIELDS.filter(f => {
          const v = json.parsed[f];
          if (v === null || v === undefined) return false;
          if (Array.isArray(v)) return v.length > 0;
          if (typeof v === 'string') return v.trim().length > 0;
          return true;
        })
      );
      setImportSelected(defaultSelected);
    } catch (e: any) {
      setImportError(e.message);
    } finally {
      setImportLoading(false);
    }
  };

  const handleApplyImport = async () => {
    if (!importParsed) return;
    setApplyingImport(true);
    try {
      const updates: any = { actor: currentUserName || 'system' };
      for (const field of importSelected) {
        const v = importParsed[field];
        if (v === null || v === undefined) continue;
        if (field === 'skills') {
          updates.skills = Array.isArray(v) ? v.join('、') : v;
        } else if (field === 'workHistory') {
          updates.work_history = JSON.stringify(v);
        } else if (field === 'educationJson') {
          updates.education_details = JSON.stringify(v);
        } else if (field === 'linkedinUrl') {
          updates.linkedin_url = v;
        } else {
          updates[field] = v;
        }
      }
      await apiPatch(`/api/candidates/${candidate.id}`, updates);
      onCandidateUpdate?.(candidate.id, {
        ...(importSelected.has('name') && { name: importParsed.name }),
        ...(importSelected.has('position') && { position: importParsed.position }),
        ...(importSelected.has('location') && { location: importParsed.location }),
        ...(importSelected.has('years') && { years: importParsed.years }),
        ...(importSelected.has('skills') && { skills: importParsed.skills }),
      });
      setShowImport(false);
      setImportParsed(null);
      alert('✅ 已成功套用 PDF 解析資料！');
    } catch (e: any) {
      alert('❌ 套用失敗：' + e.message);
    } finally {
      setApplyingImport(false);
    }
  };

  // 儲存基本資料（name/position/location/phone/email/years/skills）
  const handleSaveBasicInfo = async () => {
    setSavingBasicInfo(true);
    try {
      const updates = {
        name: editName.trim(),
        position: editPosition.trim(),
        location: editLocation.trim(),
        phone: editPhone.trim(),
        email: editEmail.trim(),
        years: parseInt(editYears) || 0,
        skills: editSkills.trim(),
        actor: currentUserName || 'system',
      };
      await apiPatch(`/api/candidates/${candidate.id}`, updates);
      onCandidateUpdate?.(candidate.id, {
        name: updates.name,
        position: updates.position,
        location: updates.location,
        phone: updates.phone,
        email: updates.email,
        years: updates.years,
        skills: updates.skills,
      });
      setEditingBasicInfo(false);
    } catch (err) {
      alert('❌ 儲存基本資料失敗，請稍後再試');
    } finally {
      setSavingBasicInfo(false);
    }
  };

  // 儲存工作經歷
  const handleSaveWorkHistory = async (items: any[]) => {
    setSavingWork(true);
    try {
      await apiPatch(`/api/candidates/${candidate.id}`, {
        work_history: items,
        actor: currentUserName || 'system',
      });
      setWorkItems(items);
      onCandidateUpdate?.(candidate.id, { workHistory: items as any });
    } catch (err) {
      alert('❌ 儲存工作經歷失敗');
    } finally {
      setSavingWork(false);
      setAddingWork(false);
      setEditingWorkIdx(null);
    }
  };

  // 儲存教育背景
  const handleSaveEducation = async (items: any[]) => {
    setSavingEdu(true);
    try {
      await apiPatch(`/api/candidates/${candidate.id}`, {
        education_details: items,
        actor: currentUserName || 'system',
      });
      setEduItems(items);
      onCandidateUpdate?.(candidate.id, { educationJson: items as any });
    } catch (err) {
      alert('❌ 儲存教育背景失敗');
    } finally {
      setSavingEdu(false);
      setAddingEdu(false);
      setEditingEduIdx(null);
    }
  };

  // 複製邀請訊息到剪貼簿
  const handleCopyInviteMessage = () => {
    navigator.clipboard.writeText(inviteMessage).then(() => {
      alert('✅ 邀請訊息已複製到剪貼簿！');
    }).catch(err => {
      console.error('複製失敗:', err);
      alert('❌ 複製失敗，請手動複製');
    });
  };
  
  const getStabilityGrade = (score: number) => {
    if (score >= 80) return { grade: 'A', color: 'text-green-600', bg: 'bg-green-50' };
    if (score >= 60) return { grade: 'B', color: 'text-blue-600', bg: 'bg-blue-50' };
    if (score >= 40) return { grade: 'C', color: 'text-yellow-600', bg: 'bg-yellow-50' };
    if (score >= 20) return { grade: 'D', color: 'text-orange-600', bg: 'bg-orange-50' };
    return { grade: 'F', color: 'text-red-600', bg: 'bg-red-50' };
  };
  
  const stability = getStabilityGrade(candidate.stabilityScore);
  
  // 安全地取得狀態配置（加上 fallback）
  const currentStatus = CANDIDATE_STATUS_CONFIG[candidate.status] || {
    label: candidate.status || '未知',
    color: 'gray',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-800',
    borderColor: 'border-gray-300'
  };
  
  // 解析工作經歷（支援純文字與 JSON 格式）
  const workHistory = (() => {
    if (!candidate.workHistory) return [];
    
    const rawHistory = candidate.workHistory;
    
    // 嘗試 JSON 格式
    if (typeof rawHistory === 'object' && Array.isArray(rawHistory)) {
      return rawHistory;
    }
    
    if (typeof rawHistory === 'string') {
      // 嘗試解析 JSON 字串
      try {
        const parsed = JSON.parse(rawHistory);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
      
      // 解析純文字格式：「公司名 時間(起-訖): 職位描述; 公司名 時間(起-訖): 職位描述」
      const jobs = rawHistory.split(';').map(job => {
        const trimmed = job.trim();
        if (!trimmed) return null;
        
        // 提取：公司名 時間(...): 職位描述
        const match = trimmed.match(/^(.+?)\s+(\d+年?)?\(([^)]+)\):\s*(.+)$/);
        if (match) {
          const [, company, duration, period, description] = match;
          return {
            company: company.trim(),
            duration: duration?.trim() || '',
            period: period.trim(),
            description: description.trim()
          };
        }
        
        // 簡化格式：公司名: 職位描述
        const simpleMatch = trimmed.match(/^(.+?):\s*(.+)$/);
        if (simpleMatch) {
          return {
            company: simpleMatch[1].trim(),
            duration: '',
            period: '',
            description: simpleMatch[2].trim()
          };
        }
        
        return null;
      }).filter(Boolean);
      
      return jobs;
    }
    
    return [];
  })();
  
  // 解析教育背景 JSON（使用 educationJson 欄位）
  const education = candidate.educationJson || [];
  
  return (
    <>
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        className="bg-white rounded-xl shadow-2xl w-[95vw] sm:w-full max-w-4xl h-[95vh] sm:h-[90vh] overflow-hidden flex flex-col mx-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-3 sm:p-6 flex-shrink-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-2 sm:gap-3 mb-2">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                  <User className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                    <h2 className="text-lg sm:text-2xl font-bold truncate">{candidate.name}</h2>
                    <span className="text-[10px] sm:text-xs font-mono bg-white/20 text-white/80 px-1.5 sm:px-2 py-0.5 rounded shrink-0">#{candidate.id}</span>
                  </div>
                  <p className="text-blue-100 text-xs sm:text-sm truncate">候選人背景：{candidate.position}</p>
                </div>
              </div>
              
              {/* Quick Stats */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-2 sm:mt-4 text-[10px] sm:text-sm">
                <div className="flex items-center gap-0.5 sm:gap-1.5 whitespace-nowrap">
                  <MapPin className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
                  <span className="truncate">{candidate.location}</span>
                </div>
                <div className="flex items-center gap-0.5 sm:gap-1.5 whitespace-nowrap">
                  <Briefcase className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
                  <span>{candidate.years > 0 ? `${candidate.years} 年經驗` : '年資未知'}</span>
                </div>
                <div className={`flex items-center gap-0.5 sm:gap-1.5 px-1.5 sm:px-2 py-0.5 rounded whitespace-nowrap ${currentStatus.bgColor} ${currentStatus.textColor}`}>
                  {currentStatus.label}
                </div>
              </div>
            </div>
            
            <button 
              onClick={onClose}
              className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 sm:p-2 rounded-lg transition-all shrink-0"
            >
              <X className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="border-b border-gray-200 bg-gray-50 overflow-x-auto">
          <div className="flex whitespace-nowrap min-w-max sm:min-w-0">
            <button
              onClick={() => setActiveTab('info')}
              className={`px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'info' 
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-white' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-1 sm:gap-2">
                <FileText className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">基本資訊</span>
                <span className="sm:hidden">資訊</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'history' 
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-white' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-1 sm:gap-2">
                <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">進度追蹤</span>
                <span className="sm:hidden">進度</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('notes')}
              className={`px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'notes'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-1 sm:gap-2">
                <MessageSquare className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">備註紀錄</span>
                <span className="sm:hidden">備註</span>
              </div>
            </button>
            <button
              onClick={() => { setActiveTab('ai_match'); fetchJobRankings(); }}
              className={`px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'ai_match'
                  ? 'text-violet-600 border-b-2 border-violet-600 bg-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-1 sm:gap-2">
                <Sparkles className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">AI 匹配結語</span>
                <span className="sm:hidden">AI評分</span>
                {candidate.aiMatchResult && (
                  <span className="text-[8px] sm:text-[10px] px-1 sm:px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 font-bold">
                    {candidate.aiMatchResult.score}
                  </span>
                )}
              </div>
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {activeTab === 'info' && (
            <div className="space-y-6">
              {/* 負責顧問 */}
              <div className="bg-indigo-50 rounded-lg border border-indigo-100">
                <div className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <User className="w-4 h-4 text-indigo-500 shrink-0" />
                    <span className="text-xs text-indigo-600 font-medium shrink-0">負責顧問</span>
                    {!editingRecruiter && (
                      <span className="ml-2 text-sm font-semibold text-indigo-900 truncate">
                        {recruiterInput || '未指派'}
                      </span>
                    )}
                    {editingRecruiter && recruiterInput && (
                      <span className="ml-2 text-xs text-indigo-700 font-medium truncate">已選：{recruiterInput}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {editingRecruiter ? (
                      <>
                        <button onClick={handleSaveRecruiter} className="text-xs px-2 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700">儲存</button>
                        <button onClick={() => { setEditingRecruiter(false); setRecruiterInput(candidate.consultant || ''); setRecruiterSearch(''); }} className="text-xs px-2 py-1 border border-slate-200 rounded text-slate-600 hover:bg-slate-50">取消</button>
                      </>
                    ) : (
                      <>
                        {currentUserName && (
                          <button
                            onClick={() => { setRecruiterInput(currentUserName); setRecruiterSearch(currentUserName); setEditingRecruiter(true); }}
                            className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                          >
                            指派給我
                          </button>
                        )}
                        <button onClick={() => { setRecruiterSearch(recruiterInput); setEditingRecruiter(true); }} className="text-xs px-2 py-1 border border-indigo-200 rounded text-indigo-600 hover:bg-indigo-100">
                          更改
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {editingRecruiter && (
                  <div className="px-3 pb-3">
                    <input
                      value={recruiterSearch}
                      onChange={e => setRecruiterSearch(e.target.value)}
                      className="border border-indigo-300 rounded px-2 py-1 text-sm w-full focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      placeholder="搜尋顧問..."
                      autoFocus
                    />
                    <div className="mt-1 max-h-36 overflow-y-auto border border-indigo-200 rounded bg-white">
                      {loadingUsers ? (
                        <div className="px-3 py-2 text-xs text-gray-400">載入中...</div>
                      ) : users.filter(u => !recruiterSearch || u.toLowerCase().includes(recruiterSearch.toLowerCase())).length === 0 ? (
                        <div className="px-3 py-2 text-xs text-gray-400">無符合的顧問</div>
                      ) : (
                        users
                          .filter(u => !recruiterSearch || u.toLowerCase().includes(recruiterSearch.toLowerCase()))
                          .map(u => (
                            <button
                              key={u}
                              onClick={() => setRecruiterInput(u)}
                              className={`w-full text-left px-3 py-1.5 text-sm hover:bg-indigo-50 transition-colors ${recruiterInput === u ? 'bg-indigo-100 font-medium text-indigo-700' : 'text-gray-700'}`}
                            >
                              {u}
                            </button>
                          ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 目標職缺 */}
              <div className="bg-amber-50 rounded-lg border border-amber-100">
                <div className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Target className="w-4 h-4 text-amber-500 shrink-0" />
                    <span className="text-xs text-amber-600 font-medium shrink-0">目標職缺</span>
                    {!editingTargetJob && (
                      <span className="ml-2 text-sm font-semibold text-amber-900 truncate">
                        {targetJobInput || '未指定'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {editingTargetJob ? (
                      <>
                        {targetJobId && (
                          <button onClick={() => handleSaveTargetJob(null, '')} disabled={savingTargetJob} className="text-xs px-2 py-1 border border-red-200 rounded text-red-500 hover:bg-red-50 disabled:opacity-60">
                            清除
                          </button>
                        )}
                        <button onClick={() => { setEditingTargetJob(false); setTargetJobSearch(''); }} className="text-xs px-2 py-1 border border-slate-200 rounded text-slate-600 hover:bg-slate-50">取消</button>
                      </>
                    ) : (
                      <button onClick={() => { setTargetJobSearch(''); setEditingTargetJob(true); }} className="text-xs px-2 py-1 border border-amber-200 rounded text-amber-600 hover:bg-amber-100">
                        {targetJobInput ? '更改' : '指定'}
                      </button>
                    )}
                  </div>
                </div>
                {editingTargetJob && (
                  <div className="px-3 pb-3">
                    <input
                      value={targetJobSearch}
                      onChange={e => setTargetJobSearch(e.target.value)}
                      className="border border-amber-300 rounded px-2 py-1 text-sm w-full focus:outline-none focus:ring-1 focus:ring-amber-500"
                      placeholder="搜尋職缺名稱或公司..."
                      autoFocus
                    />
                    <div className="mt-1 max-h-40 overflow-y-auto border border-amber-200 rounded bg-white">
                      {loadingJobs ? (
                        <div className="px-3 py-2 text-xs text-gray-400">載入中...</div>
                      ) : jobs.filter(j => !targetJobSearch || `${j.position_name} ${j.client_company}`.toLowerCase().includes(targetJobSearch.toLowerCase())).length === 0 ? (
                        <div className="px-3 py-2 text-xs text-gray-400">無符合的職缺</div>
                      ) : (
                        jobs
                          .filter(j => !targetJobSearch || `${j.position_name} ${j.client_company}`.toLowerCase().includes(targetJobSearch.toLowerCase()))
                          .map(j => {
                            const label = `${j.position_name}${j.client_company ? ` (${j.client_company})` : ''}`;
                            return (
                              <button
                                key={j.id}
                                onClick={() => handleSaveTargetJob(j.id, label)}
                                disabled={savingTargetJob}
                                className={`w-full text-left px-3 py-2 text-sm hover:bg-amber-50 transition-colors border-b border-gray-50 last:border-0 disabled:opacity-60 ${targetJobId === j.id ? 'bg-amber-100 text-amber-700' : 'text-gray-700'}`}
                              >
                                <div className="font-medium">{j.position_name}</div>
                                {j.client_company && <div className="text-xs text-gray-500 mt-0.5">{j.client_company}</div>}
                              </button>
                            );
                          })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 基本資料卡片（可編輯） */}
              <div className="bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between p-3 border-b border-gray-100">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">基本資料</span>
                  {!editingBasicInfo ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => { setShowImport(v => !v); setImportParsed(null); setImportError(null); }}
                        className="text-xs px-2 py-1 border border-blue-200 rounded text-blue-600 hover:bg-blue-50"
                      >
                        📄 匯入履歷
                      </button>
                      <button onClick={() => setEditingBasicInfo(true)} className="text-xs px-2 py-1 border border-gray-200 rounded text-gray-600 hover:bg-white">
                        ✏️ 編輯
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={handleSaveBasicInfo} disabled={savingBasicInfo} className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-60">
                        {savingBasicInfo ? '儲存中...' : '儲存'}
                      </button>
                      <button onClick={() => { setEditingBasicInfo(false); setEditName(candidate.name); setEditPosition(candidate.position||''); setEditLocation(candidate.location||''); setEditPhone(candidate.phone||''); setEditEmail(candidate.email||''); setEditYears(String(candidate.years||'')); setEditSkills(Array.isArray(candidate.skills)?candidate.skills.join('、'):(candidate.skills||'')); }} className="text-xs px-2 py-1 border border-gray-200 rounded text-gray-600 hover:bg-white">取消</button>
                    </div>
                  )}
                </div>
                {editingBasicInfo ? (
                  <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">姓名</label>
                      <input value={editName} onChange={e => setEditName(e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">職位 / 背景</label>
                      <input value={editPosition} onChange={e => setEditPosition(e.target.value)} placeholder="例：資深工程師" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">地點</label>
                      <input value={editLocation} onChange={e => setEditLocation(e.target.value)} placeholder="例：台北市" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">年資</label>
                      <input value={editYears} onChange={e => setEditYears(e.target.value)} type="number" min="0" placeholder="0" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">電話</label>
                      <input value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="例：0912-345-678" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Email</label>
                      <input value={editEmail} onChange={e => setEditEmail(e.target.value)} placeholder="example@email.com" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs text-gray-500 mb-1">核心技能（以逗號或頓號分隔）</label>
                      <input value={editSkills} onChange={e => setEditSkills(e.target.value)} placeholder="例：React、TypeScript、Node.js" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    </div>
                  </div>
                ) : (
                  <div className="p-3 grid grid-cols-2 gap-x-4 gap-y-2">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="text-xs text-gray-500">地點</span>
                      <span className="text-sm font-medium text-gray-800 truncate">{candidate.location || '—'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Briefcase className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="text-xs text-gray-500">年資</span>
                      <span className="text-sm font-medium text-gray-800">{candidate.years > 0 ? `${candidate.years} 年` : '—'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="text-xs text-gray-500">電話</span>
                      <span className="text-sm font-medium text-gray-800 truncate">{editPhone || '—'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="text-xs text-gray-500">Email</span>
                      {editEmail ? (
                        <a href={`mailto:${editEmail}`} className="text-sm font-medium text-blue-600 hover:underline truncate">{editEmail}</a>
                      ) : (
                        <span className="text-sm font-medium text-gray-400">—</span>
                      )}
                    </div>
                    <div className="col-span-2 flex items-start gap-2 pt-1 border-t border-gray-100">
                      <Award className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                      <span className="text-xs text-gray-500 shrink-0">技能</span>
                      <div className="flex flex-wrap gap-1">
                        {editSkills ? editSkills.split(/[、,，]/).filter(Boolean).map((s, i) => (
                          <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs">{s.trim()}</span>
                        )) : <span className="text-xs text-gray-400">—</span>}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* PDF 履歷匯入面板 */}
              {showImport && (
                <div className="border border-blue-200 rounded-lg bg-blue-50/40 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-blue-700">📄 匯入 LinkedIn PDF 履歷</span>
                    <button onClick={() => { setShowImport(false); setImportParsed(null); setImportError(null); }} className="text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
                  </div>

                  {/* 檔案選擇 */}
                  {!importParsed && !importLoading && (
                    <label className="flex flex-col items-center justify-center border-2 border-dashed border-blue-300 rounded-lg p-6 cursor-pointer hover:bg-blue-50 transition-colors">
                      <span className="text-3xl mb-2">📂</span>
                      <span className="text-sm text-blue-600 font-medium">點擊選擇 LinkedIn PDF 檔案</span>
                      <span className="text-xs text-gray-400 mt-1">最大 10 MB</span>
                      <input
                        type="file"
                        accept="application/pdf"
                        className="hidden"
                        onChange={e => {
                          const f = e.target.files?.[0];
                          if (f) handleImportPDF(f);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  )}

                  {/* 載入中 */}
                  {importLoading && (
                    <div className="flex items-center justify-center gap-2 py-6 text-blue-600">
                      <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                      <span className="text-sm">解析 PDF 中...</span>
                    </div>
                  )}

                  {/* 錯誤 */}
                  {importError && (
                    <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">
                      ❌ {importError}
                      <button onClick={() => setImportError(null)} className="ml-3 text-xs underline">重試</button>
                    </div>
                  )}

                  {/* 解析結果預覽 */}
                  {importParsed && !importLoading && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">
                          信心分數：<span className="font-semibold text-blue-600">{Math.round((importParsed._meta?.confidence || 0) * 100)}%</span>
                          &nbsp;·&nbsp;{importParsed._meta?.parseMethod || 'rule-based'}
                        </span>
                        <button
                          onClick={() => { setImportParsed(null); setImportError(null); }}
                          className="text-xs text-gray-400 hover:text-gray-600 underline"
                        >重新選擇</button>
                      </div>

                      {/* 欄位勾選表格 */}
                      <div className="border border-gray-200 rounded-lg overflow-hidden text-xs bg-white divide-y divide-gray-100">
                        <div className="grid grid-cols-[1.5rem_5rem_1fr] gap-2 px-3 py-2 bg-gray-50 font-semibold text-gray-500">
                          <span></span><span>欄位</span><span>解析值</span>
                        </div>
                        {IMPORT_FIELDS.map(field => {
                          const val = importParsed[field];
                          if (val === null || val === undefined) return null;
                          const displayVal = Array.isArray(val)
                            ? (field === 'workHistory'
                                ? `${val.length} 筆工作經歷`
                                : field === 'educationJson'
                                  ? `${val.length} 筆學歷`
                                  : val.join('、'))
                            : String(val);
                          if (!displayVal || displayVal === '0') return null;
                          return (
                            <label key={field} className="grid grid-cols-[1.5rem_5rem_1fr] gap-2 px-3 py-2 items-start cursor-pointer hover:bg-blue-50/40">
                              <input
                                type="checkbox"
                                checked={importSelected.has(field)}
                                onChange={e => {
                                  const next = new Set(importSelected);
                                  e.target.checked ? next.add(field) : next.delete(field);
                                  setImportSelected(next);
                                }}
                                className="mt-0.5"
                              />
                              <span className="text-gray-500 font-medium">{IMPORT_FIELD_LABELS[field]}</span>
                              <span className="text-gray-800 break-all">{displayVal}</span>
                            </label>
                          );
                        })}
                      </div>

                      <div className="flex items-center gap-2 justify-end">
                        <span className="text-xs text-gray-400">已選 {importSelected.size} 個欄位</span>
                        <button
                          onClick={handleApplyImport}
                          disabled={applyingImport || importSelected.size === 0}
                          className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
                        >
                          {applyingImport ? '套用中...' : '套用選取欄位'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 外部連結：LinkedIn / GitHub / Google Drive（始終顯示，可編輯） */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">外部連結</h3>

                {/* LinkedIn */}
                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <svg className="w-5 h-5 text-blue-600 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                  </svg>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-500 mb-1">LinkedIn</div>
                    {editingLinkedin ? (
                      <div className="flex items-center gap-2">
                        <input
                          value={linkedinInput}
                          onChange={e => setLinkedinInput(e.target.value)}
                          placeholder="https://linkedin.com/in/username"
                          className="flex-1 border border-blue-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                          autoFocus
                        />
                        <button onClick={handleSaveLinkedin} disabled={savingLinkedin} className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-60">儲存</button>
                        <button onClick={() => { setEditingLinkedin(false); setLinkedinInput((candidate as any).linkedinUrl || ''); }} className="text-xs px-2 py-1 border border-slate-200 rounded text-slate-600 hover:bg-slate-50">取消</button>
                      </div>
                    ) : linkedinInput ? (
                      <div className="flex items-center gap-2">
                        <a href={linkedinInput} target="_blank" rel="noopener noreferrer"
                          className="text-sm font-medium text-blue-600 hover:underline truncate flex-1">
                          {linkedinInput}
                        </a>
                        <button onClick={() => setEditingLinkedin(true)} className="text-xs px-2 py-0.5 border border-blue-200 rounded text-blue-600 hover:bg-blue-100 shrink-0">編輯</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-400 italic flex-1">未設定</span>
                        <button onClick={() => setEditingLinkedin(true)} className="text-xs px-2 py-0.5 border border-blue-200 rounded text-blue-600 hover:bg-blue-100 shrink-0">+ 新增</button>
                      </div>
                    )}
                  </div>
                </div>

                {/* GitHub */}
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <svg className="w-5 h-5 text-gray-700 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-500 mb-1">GitHub</div>
                    {editingGithub ? (
                      <div className="flex items-center gap-2">
                        <input
                          value={githubInput}
                          onChange={e => setGithubInput(e.target.value)}
                          placeholder="https://github.com/username"
                          className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-gray-500"
                          autoFocus
                        />
                        <button onClick={handleSaveGithub} disabled={savingGithub} className="text-xs px-2 py-1 bg-gray-700 text-white rounded hover:bg-gray-800 disabled:opacity-60">儲存</button>
                        <button onClick={() => { setEditingGithub(false); setGithubInput((candidate as any).githubUrl || ''); }} className="text-xs px-2 py-1 border border-slate-200 rounded text-slate-600 hover:bg-slate-50">取消</button>
                      </div>
                    ) : githubInput ? (
                      <div className="flex items-center gap-2">
                        <a href={githubInput} target="_blank" rel="noopener noreferrer"
                          className="text-sm font-medium text-gray-700 hover:underline truncate flex-1">
                          {githubInput}
                        </a>
                        <button onClick={() => setEditingGithub(true)} className="text-xs px-2 py-0.5 border border-gray-200 rounded text-gray-600 hover:bg-gray-100 shrink-0">編輯</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-400 italic flex-1">未設定</span>
                        <button onClick={() => setEditingGithub(true)} className="text-xs px-2 py-0.5 border border-gray-200 rounded text-gray-600 hover:bg-gray-100 shrink-0">+ 新增</button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Google Drive 履歷 */}
                {candidate.resumeLink && (
                  <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                    <FileText className="w-5 h-5 text-green-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-gray-500">完整履歷（Google Drive）</div>
                      <a href={candidate.resumeLink} target="_blank" rel="noopener noreferrer"
                        className="text-sm font-medium text-green-700 hover:underline truncate block">
                        查看完整履歷 →
                      </a>
                    </div>
                  </div>
                )}
              </div>
              
              {/* 穩定度 & 綜合評級 並排 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 穩定度 */}
                <div className={`p-4 rounded-lg border-2 ${stability.bg}`}>
                  <div className="flex items-center gap-1 mb-2">
                    <TrendingUp className={`w-4 h-4 ${stability.color}`} />
                    <span className="text-xs font-semibold text-gray-600">穩定度評分</span>
                    <div className="relative group ml-1">
                      <div className="w-4 h-4 rounded-full bg-gray-200 text-gray-500 text-xs flex items-center justify-center cursor-help select-none">?</div>
                      <div className="absolute left-0 bottom-6 w-56 bg-gray-800 text-white text-xs rounded-lg p-2.5 hidden group-hover:block z-20 shadow-lg leading-relaxed">
                        <p className="font-semibold mb-1">穩定度評分說明</p>
                        <p>基於轉職次數、平均任期與工作年資計算（20-100分）</p>
                        <p className="mt-1">🟢 80+分 A級 穩定</p>
                        <p>🔵 60-79分 B級 一般</p>
                        <p>🟡 40-59分 C級 頻繁轉職</p>
                        <p>🔴 &lt;40分 D級 不穩定</p>
                      </div>
                    </div>
                  </div>
                  <div className={`text-2xl font-bold ${stability.color}`}>
                    {candidate.stabilityScore > 0 ? candidate.stabilityScore : '—'}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {candidate.stabilityScore > 0 ? `${stability.grade} 級` : '待評分'} · 離職 {candidate.jobChanges} 次 · 平均 {(candidate.years / Math.max(candidate.jobChanges, 1)).toFixed(1)} 年
                  </div>
                </div>

                {/* 綜合評級 */}
                <div className="p-4 rounded-lg border-2 bg-purple-50 border-purple-200">
                  <div className="flex items-center gap-1 mb-2">
                    <Award className="w-4 h-4 text-purple-600" />
                    <span className="text-xs font-semibold text-gray-600">綜合評級</span>
                    <div className="relative group ml-1">
                      <div className="w-4 h-4 rounded-full bg-gray-200 text-gray-500 text-xs flex items-center justify-center cursor-help select-none">?</div>
                      <div className="absolute left-0 bottom-6 w-60 bg-gray-800 text-white text-xs rounded-lg p-2.5 hidden group-hover:block z-20 shadow-lg leading-relaxed">
                        <p className="font-semibold mb-1">綜合評級說明</p>
                        <p>由 AI 分析技能、年資、學歷、穩定性等 6 大維度後填入</p>
                        <p className="mt-1">🟣 S（90+）頂尖人才（稀缺）</p>
                        <p>🟢 A+（80-89）優秀（強力推薦）</p>
                        <p>🔵 A（70-79）合格（可推薦）</p>
                        <p>🟡 B（60-69）基本合格</p>
                        <p>⚪ C（&lt;60）需補強</p>
                      </div>
                    </div>
                  </div>
                  {(candidate as any).talent_level ? (
                    <div className={`text-2xl font-bold ${
                      (candidate as any).talent_level === 'S' ? 'text-purple-700' :
                      (candidate as any).talent_level.startsWith('A') ? 'text-green-700' :
                      (candidate as any).talent_level === 'B' ? 'text-blue-700' :
                      'text-gray-600'
                    }`}>
                      {(candidate as any).talent_level}
                    </div>
                  ) : (
                    <div className="text-2xl font-bold text-gray-300">—</div>
                  )}
                  <div className="text-xs text-gray-500 mt-1">
                    {(candidate as any).talent_level ? '已評分' : '待 AI 分析後填入'}
                  </div>
                </div>
              </div>
              
              {/* Work History */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-blue-600" />
                    工作經歷
                  </h3>
                  <button
                    onClick={() => { setWorkForm({ company: '', title: '', start: '', end: '', description: '' }); setAddingWork(true); setEditingWorkIdx(null); }}
                    className="text-xs px-2 py-1 border border-blue-200 rounded text-blue-600 hover:bg-blue-50"
                  >
                    + 新增
                  </button>
                </div>
                {/* 新增工作經歷表單 */}
                {addingWork && editingWorkIdx === null && (
                  <div className="mb-3 p-3 bg-blue-50 rounded-lg border border-blue-200 space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">公司名稱 *</label>
                        <input value={workForm.company} onChange={e => setWorkForm(p => ({...p, company: e.target.value}))} placeholder="例：台積電" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" autoFocus />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">職稱 *</label>
                        <input value={workForm.title} onChange={e => setWorkForm(p => ({...p, title: e.target.value}))} placeholder="例：資深工程師" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">開始時間</label>
                        <input value={workForm.start} onChange={e => setWorkForm(p => ({...p, start: e.target.value}))} placeholder="例：2020-01" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">結束時間</label>
                        <input value={workForm.end} onChange={e => setWorkForm(p => ({...p, end: e.target.value}))} placeholder="例：2023-06 或 至今" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">工作描述（選填）</label>
                      <textarea value={workForm.description} onChange={e => setWorkForm(p => ({...p, description: e.target.value}))} rows={2} placeholder="主要負責..." className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none" />
                    </div>
                    <div className="flex gap-2">
                      <button
                        disabled={savingWork || !workForm.company.trim()}
                        onClick={() => {
                          if (!workForm.company.trim()) return;
                          const newItem = { company: workForm.company.trim(), title: workForm.title.trim(), start: workForm.start.trim(), end: workForm.end.trim(), duration_months: 0, description: workForm.description.trim() };
                          handleSaveWorkHistory([...workItems, newItem]);
                        }}
                        className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-60"
                      >
                        {savingWork ? '儲存中...' : '新增'}
                      </button>
                      <button onClick={() => setAddingWork(false)} className="text-xs px-3 py-1.5 border border-gray-200 rounded text-gray-600 hover:bg-white">取消</button>
                    </div>
                  </div>
                )}
                {workItems.length > 0 ? (
                  <div className="space-y-3">
                    {workItems.map((job: any, i: number) => (
                      <div key={i} className="border-l-4 border-blue-400 pl-4 py-2 bg-blue-50/30 rounded-r-lg relative">
                        {editingWorkIdx === i ? (
                          <div className="space-y-2">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">公司名稱</label>
                                <input value={workForm.company} onChange={e => setWorkForm(p => ({...p, company: e.target.value}))} className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" autoFocus />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">職稱</label>
                                <input value={workForm.title} onChange={e => setWorkForm(p => ({...p, title: e.target.value}))} className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">開始</label>
                                <input value={workForm.start} onChange={e => setWorkForm(p => ({...p, start: e.target.value}))} className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">結束</label>
                                <input value={workForm.end} onChange={e => setWorkForm(p => ({...p, end: e.target.value}))} className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                              </div>
                            </div>
                            <textarea value={workForm.description} onChange={e => setWorkForm(p => ({...p, description: e.target.value}))} rows={2} className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none" />
                            <div className="flex gap-2">
                              <button
                                disabled={savingWork}
                                onClick={() => {
                                  const updated = workItems.map((item, idx) => idx === i ? { ...item, company: workForm.company.trim(), title: workForm.title.trim(), start: workForm.start.trim(), end: workForm.end.trim(), description: workForm.description.trim() } : item);
                                  handleSaveWorkHistory(updated);
                                }}
                                className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-60"
                              >
                                {savingWork ? '儲存中...' : '儲存'}
                              </button>
                              <button onClick={() => setEditingWorkIdx(null)} className="text-xs px-3 py-1 border border-gray-200 rounded text-gray-600 hover:bg-white">取消</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-gray-900 text-sm">{job.company}</div>
                                {job.title && <div className="text-sm text-blue-600">{job.title}</div>}
                                {(job.start || job.end) && (
                                  <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                    <Calendar className="w-3 h-3" />
                                    {job.start}{job.start && job.end ? ' – ' : ''}{job.end}
                                  </div>
                                )}
                                {job.description && (
                                  <div className="text-xs text-gray-600 mt-1 leading-relaxed">{job.description}</div>
                                )}
                              </div>
                              <div className="flex gap-1 shrink-0">
                                <button
                                  onClick={() => { setWorkForm({ company: job.company || '', title: job.title || '', start: job.start || '', end: job.end || '', description: job.description || '' }); setEditingWorkIdx(i); setAddingWork(false); }}
                                  className="text-xs px-1.5 py-0.5 border border-gray-200 rounded text-gray-500 hover:bg-white"
                                >編輯</button>
                                <button
                                  onClick={() => { if (confirm('確認刪除此工作經歷？')) handleSaveWorkHistory(workItems.filter((_, idx) => idx !== i)); }}
                                  className="text-xs px-1.5 py-0.5 border border-red-200 rounded text-red-500 hover:bg-red-50"
                                >刪除</button>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 bg-gray-50 rounded-lg text-center">
                    <Briefcase className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm text-gray-400">尚無工作經歷</p>
                    <button onClick={() => { setWorkForm({ company: '', title: '', start: '', end: '', description: '' }); setAddingWork(true); }} className="mt-2 text-xs text-blue-600 hover:underline">+ 手動新增</button>
                  </div>
                )}
              </div>
              
              {/* Education */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Award className="w-5 h-5 text-blue-600" />
                    教育背景
                  </h3>
                  <button
                    onClick={() => { setEduForm({ school: '', degree: '', major: '', start: '', end: '' }); setAddingEdu(true); setEditingEduIdx(null); }}
                    className="text-xs px-2 py-1 border border-blue-200 rounded text-blue-600 hover:bg-blue-50"
                  >
                    + 新增
                  </button>
                </div>
                {/* 新增教育背景表單 */}
                {addingEdu && editingEduIdx === null && (
                  <div className="mb-3 p-3 bg-blue-50 rounded-lg border border-blue-200 space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">學校名稱 *</label>
                        <input value={eduForm.school} onChange={e => setEduForm(p => ({...p, school: e.target.value}))} placeholder="例：台灣大學" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" autoFocus />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">學位</label>
                        <input value={eduForm.degree} onChange={e => setEduForm(p => ({...p, degree: e.target.value}))} placeholder="例：碩士、學士" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">科系</label>
                        <input value={eduForm.major} onChange={e => setEduForm(p => ({...p, major: e.target.value}))} placeholder="例：資訊工程學系" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </div>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="block text-xs text-gray-500 mb-1">入學年</label>
                          <input value={eduForm.start} onChange={e => setEduForm(p => ({...p, start: e.target.value}))} placeholder="2018" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                        </div>
                        <div className="flex-1">
                          <label className="block text-xs text-gray-500 mb-1">畢業年</label>
                          <input value={eduForm.end} onChange={e => setEduForm(p => ({...p, end: e.target.value}))} placeholder="2022" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        disabled={savingEdu || !eduForm.school.trim()}
                        onClick={() => {
                          if (!eduForm.school.trim()) return;
                          const newItem = { school: eduForm.school.trim(), degree: eduForm.degree.trim(), major: eduForm.major.trim(), startYear: eduForm.start.trim(), endYear: eduForm.end.trim(), start: eduForm.start.trim(), end: eduForm.end.trim() };
                          handleSaveEducation([...eduItems, newItem]);
                        }}
                        className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-60"
                      >
                        {savingEdu ? '儲存中...' : '新增'}
                      </button>
                      <button onClick={() => setAddingEdu(false)} className="text-xs px-3 py-1.5 border border-gray-200 rounded text-gray-600 hover:bg-white">取消</button>
                    </div>
                  </div>
                )}
                {eduItems.length > 0 ? (
                  <div className="space-y-2">
                    {eduItems.map((edu: any, i: number) => (
                      <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                        {editingEduIdx === i ? (
                          <div className="flex-1 space-y-2">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">學校</label>
                                <input value={eduForm.school} onChange={e => setEduForm(p => ({...p, school: e.target.value}))} className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" autoFocus />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">學位</label>
                                <input value={eduForm.degree} onChange={e => setEduForm(p => ({...p, degree: e.target.value}))} className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">科系</label>
                                <input value={eduForm.major} onChange={e => setEduForm(p => ({...p, major: e.target.value}))} className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                              </div>
                              <div className="flex gap-2">
                                <input value={eduForm.start} onChange={e => setEduForm(p => ({...p, start: e.target.value}))} placeholder="入學年" className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                                <input value={eduForm.end} onChange={e => setEduForm(p => ({...p, end: e.target.value}))} placeholder="畢業年" className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                disabled={savingEdu}
                                onClick={() => {
                                  const updated = eduItems.map((item, idx) => idx === i ? { ...item, school: eduForm.school.trim(), degree: eduForm.degree.trim(), major: eduForm.major.trim(), startYear: eduForm.start.trim(), endYear: eduForm.end.trim(), start: eduForm.start.trim(), end: eduForm.end.trim() } : item);
                                  handleSaveEducation(updated);
                                }}
                                className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-60"
                              >
                                {savingEdu ? '儲存中...' : '儲存'}
                              </button>
                              <button onClick={() => setEditingEduIdx(null)} className="text-xs px-3 py-1 border border-gray-200 rounded text-gray-600 hover:bg-white">取消</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <Calendar className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-900">{edu.school}</div>
                              <div className="text-sm text-gray-600">{edu.degree}{edu.degree && edu.major ? ' — ' : ''}{edu.major}</div>
                              <div className="text-xs text-gray-500 mt-0.5">{edu.startYear || edu.start}{(edu.startYear || edu.start) && (edu.endYear || edu.end) ? ' ~ ' : ''}{edu.endYear || edu.end}</div>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <button
                                onClick={() => { setEduForm({ school: edu.school||'', degree: edu.degree||'', major: edu.major||'', start: edu.startYear||edu.start||'', end: edu.endYear||edu.end||'' }); setEditingEduIdx(i); setAddingEdu(false); }}
                                className="text-xs px-1.5 py-0.5 border border-gray-200 rounded text-gray-500 hover:bg-white"
                              >編輯</button>
                              <button
                                onClick={() => { if (confirm('確認刪除此教育背景？')) handleSaveEducation(eduItems.filter((_, idx) => idx !== i)); }}
                                className="text-xs px-1.5 py-0.5 border border-red-200 rounded text-red-500 hover:bg-red-50"
                              >刪除</button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 bg-gray-50 rounded-lg text-center">
                    <Award className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm text-gray-400">尚無教育背景資料</p>
                    <button onClick={() => { setEduForm({ school: '', degree: '', major: '', start: '', end: '' }); setAddingEdu(true); }} className="mt-2 text-xs text-blue-600 hover:underline">+ 手動新增</button>
                  </div>
                )}
              </div>
              
              {/* Action Buttons */}
              <div className="flex gap-3">
                {/* Resume Link */}
                {candidate.resumeLink && (
                  <button
                    onClick={() => setShowResume(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                    📄 查看完整履歷
                  </button>
                )}
                
                {/* GitHub Invite Message (Task A) */}
                {candidate.source === 'GitHub' && (
                  <button
                    onClick={handleGenerateInviteMessage}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    <MessageSquare className="w-4 h-4" />
                    💌 生成邀請訊息
                  </button>
                )}

                {/* 匿名履歷產生 */}
                <button
                  onClick={() => setShowResumeGen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  <FileText className="w-4 h-4" />
                  產生匿名履歷
                </button>
              </div>
              
              {/* Resume Preview Modal */}
              {showResume && candidate.resumeLink && (
                <div
                  className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-sm"
                  onClick={() => setShowResume(false)}
                >
                  <div
                    className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[95vh] sm:h-[90vh] flex flex-col"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Resume Modal Header */}
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4 rounded-t-xl flex items-center justify-between">
                      <h3 className="text-lg font-semibold">
                        {candidate.name} - 完整履歷
                      </h3>
                      <button
                        onClick={() => setShowResume(false)}
                        className="text-white/80 hover:text-white hover:bg-white/10 p-2 rounded-lg transition-all"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    
                    {/* Resume iframe */}
                    <div className="flex-1 overflow-hidden">
                      <iframe
                        src={candidate.resumeLink}
                        className="w-full h-full border-0"
                        title={`${candidate.name} 履歷`}
                      />
                    </div>
                  </div>
                </div>
              )}
              
              {/* GitHub Invite Message Modal (Task A) */}
              {showInviteMessage && (
                <div
                  className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-sm"
                  onClick={() => setShowInviteMessage(false)}
                >
                  <div
                    className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Invite Message Header */}
                    <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-4 rounded-t-xl flex items-center justify-between">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <MessageSquare className="w-5 h-5" />
                        GitHub 候選人邀請訊息
                      </h3>
                      <button
                        onClick={() => setShowInviteMessage(false)}
                        className="text-white/80 hover:text-white hover:bg-white/10 p-2 rounded-lg transition-all"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    
                    {/* Invite Message Content */}
                    <div className="flex-1 overflow-y-auto p-6">
                      <div className="mb-4">
                        <div className="text-sm text-gray-600 mb-2">
                          📝 此訊息已根據候選人技能自動生成，請視情況調整後使用：
                        </div>
                        <textarea
                          value={inviteMessage}
                          onChange={(e) => setInviteMessage(e.target.value)}
                          className="w-full h-64 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none font-mono text-sm"
                        />
                      </div>
                      
                      <div className="flex gap-2">
                        <button
                          onClick={handleCopyInviteMessage}
                          className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          複製到剪貼簿
                        </button>
                        <button
                          onClick={() => setShowInviteMessage(false)}
                          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          關閉
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {activeTab === 'history' && (
            <div className="space-y-4">
              {/* Progress Timeline */}
              {candidate.progressTracking && candidate.progressTracking.length > 0 ? (
                <div className="space-y-3">
                  {candidate.progressTracking.map((event: any, i: number) => {
                    const isLast = i === candidate.progressTracking!.length - 1;
                    const eventColors: Record<string, {bg: string, text: string, icon: string}> = {
                      '聯繫階段': {bg: 'bg-blue-100', text: 'text-blue-600', icon: '📞'},
                      '面試階段': {bg: 'bg-purple-100', text: 'text-purple-600', icon: '💼'},
                      'Offer': {bg: 'bg-green-100', text: 'text-green-600', icon: '📝'},
                      'on board': {bg: 'bg-emerald-100', text: 'text-emerald-600', icon: '🎉'},
                      '婉拒': {bg: 'bg-red-100', text: 'text-red-600', icon: '❌'},
                      '其他': {bg: 'bg-gray-100', text: 'text-gray-600', icon: '📌'}
                    };
                    const color = eventColors[event.event] || eventColors['其他'];
                    
                    return (
                      <div key={i} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className={`w-8 h-8 rounded-full ${color.bg} flex items-center justify-center`}>
                            <span className="text-sm">{color.icon}</span>
                          </div>
                          {!isLast && <div className="flex-1 w-0.5 bg-gray-200 my-1 min-h-[24px]" />}
                        </div>
                        <div className="flex-1 pb-4">
                          <div className="flex items-center gap-2">
                            <div className={`font-medium ${color.text}`}>{event.event}</div>
                            <span className="text-xs text-gray-400">by {event.by}</span>
                          </div>
                          {event.note && (
                            <div className="text-sm text-gray-600 mt-1">{event.note}</div>
                          )}
                          <div className="text-xs text-gray-400 mt-1">{event.date}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>尚無進度追蹤記錄</p>
                  <p className="text-sm mt-2">開始追蹤候選人的招聘進度</p>
                </div>
              )}
              
              {/* Quick Add Progress Button */}
              <div className="border-t border-gray-200 pt-4">
                <div className="text-xs text-gray-500 mb-2">快速新增進度</div>
                <div className="grid grid-cols-3 gap-2">
                  {['未開始', 'AI推薦', '聯繫階段', '面試階段', 'Offer', 'on board', '婉拒', '備選人才'].map(eventType => (
                    <button
                      key={eventType}
                      className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-blue-400 transition-colors"
                      onClick={() => handleAddProgress(eventType)}
                    >
                      {eventType}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Add Progress Modal */}
              {addingProgress && (
                <div 
                  className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/50 backdrop-blur-sm"
                  onClick={() => {
                    setAddingProgress(false);
                    setNewProgressEvent('');
                    setNewProgressNote('');
                  }}
                >
                  <div
                    className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      新增進度：{newProgressEvent}
                    </h3>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          備註（選填）
                        </label>
                        <textarea
                          value={newProgressNote}
                          onChange={(e) => setNewProgressNote(e.target.value)}
                          placeholder="例如：電話聯繫順利，候選人有興趣..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                          rows={3}
                        />
                      </div>
                      
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setAddingProgress(false);
                            setNewProgressEvent('');
                            setNewProgressNote('');
                          }}
                          className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          取消
                        </button>
                        <button
                          onClick={handleConfirmAddProgress}
                          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          確認新增
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {activeTab === 'notes' && (
            <div className="space-y-4">
              {/* 現有備註 */}
              <div>
                <h3 className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  備註紀錄
                </h3>
                {localNotes ? (
                  <div className="space-y-2">
                    {(() => {
                      // 智慧分組：帶時間戳格式的行各自一張卡，其餘連續行合併成一張
                      type Block =
                        | { type: 'timestamped'; time: string; author: string; content: string; lineStart: number; lineEnd: number }
                        | { type: 'text'; content: string; lineStart: number; lineEnd: number };
                      const blocks: Block[] = [];
                      const lines = localNotes.split('\n');
                      let textBuf: string[] = [];
                      let textBufStart = 0;
                      const flushText = (endIdx: number) => {
                        const content = textBuf.join('\n').trim();
                        if (content) blocks.push({ type: 'text', content, lineStart: textBufStart, lineEnd: endIdx - 1 });
                        textBuf = [];
                      };
                      for (let li = 0; li < lines.length; li++) {
                        const line = lines[li];
                        const m = line.match(/^\[(.+?)\]\s*(.+?)：(.+)$/);
                        if (m) {
                          flushText(li);
                          blocks.push({ type: 'timestamped', time: m[1], author: m[2], content: m[3], lineStart: li, lineEnd: li });
                          textBufStart = li + 1;
                        } else {
                          if (textBuf.length === 0) textBufStart = li;
                          textBuf.push(line);
                        }
                      }
                      flushText(lines.length);
                      return blocks.map((block, i) => {
                        if (block.type === 'timestamped') {
                          return (
                            <div key={i} className="group relative p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold text-yellow-800">{block.author}</span>
                                  <span className="text-xs text-gray-400">{block.time}</span>
                                </div>
                                <button
                                  onClick={() => handleDeleteNoteBlock(block.lineStart, block.lineEnd)}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-500"
                                  title="刪除此備註"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              <p className="text-sm text-gray-800 whitespace-pre-wrap">{block.content}</p>
                            </div>
                          );
                        }
                        return (
                          <div key={i} className="group relative p-3 bg-gray-50 border border-gray-200 rounded-lg">
                            <button
                              onClick={() => handleDeleteNoteBlock(block.lineStart, block.lineEnd)}
                              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-500"
                              title="刪除此備註"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <p className="text-sm text-gray-800 whitespace-pre-wrap">{block.content}</p>
                          </div>
                        );
                      });
                    })()}
                  </div>
                ) : (
                  <div className="text-center py-6 text-gray-400">
                    <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">尚無備註紀錄</p>
                    <p className="text-xs mt-1">顧問或 AIbot 新增的備註將顯示於此</p>
                  </div>
                )}
              </div>

              {/* 新增備註 */}
              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">新增備註</h3>
                <textarea
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  placeholder="輸入備註內容，儲存後將附加時間戳與您的名稱..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
                  rows={3}
                />
                <div className="flex justify-end mt-2">
                  <button
                    onClick={handleSaveNote}
                    disabled={!newNoteText.trim() || savingNote}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                  >
                    {savingNote ? '儲存中...' : '儲存備註'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'ai_match' && (() => {
            const ai = (enrichedCandidate.aiMatchResult || (enrichedCandidate as any).ai_match_result) as AiMatchResult | null | undefined;

            const recConfig: Record<string, { color: string; bg: string; icon: React.ReactNode }> = {
              '強力推薦': { color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: <ThumbsUp className="w-3 h-3" /> },
              '推薦':     { color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-200',       icon: <ThumbsUp className="w-3 h-3" /> },
              '觀望':     { color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200',     icon: <HelpCircle className="w-3 h-3" /> },
              '不推薦':   { color: 'text-rose-700',    bg: 'bg-rose-50 border-rose-200',       icon: <ThumbsDown className="w-3 h-3" /> },
            };

            const visibleRankings = jobRankings.slice(0, 5); // v2: 後端已只回傳 Top 5

            return (
              <div className="space-y-5">

                {/* ━━━━━ Section 1: 職缺匹配推薦 ━━━━━ */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Target className="w-4 h-4 text-violet-500" />
                    <h3 className="text-sm font-bold text-slate-700">Top 5 職缺匹配</h3>
                    {!loadingRankings && jobRankings.length > 0 && (
                      <span className="text-[10px] text-slate-400 font-medium">最匹配 {jobRankings.length} 個</span>
                    )}
                  </div>

                  {loadingRankings && (
                    <div className="flex items-center gap-2 text-sm text-slate-400 py-6 justify-center">
                      <div className="w-4 h-4 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin" />
                      分析系統職缺中...
                    </div>
                  )}

                  {!loadingRankings && rankingsLoaded && jobRankings.length === 0 && (
                    <div className="text-center py-6 text-slate-400 text-sm">
                      目前系統無可用職缺
                    </div>
                  )}

                  {!loadingRankings && jobRankings.length > 0 && (
                    <div className="space-y-2">
                      {visibleRankings.map((entry, idx) => {
                        const rec = recConfig[entry.recommendation] || recConfig['觀望'];
                        const barWidth = `${entry.match_score}%`;
                        const barColor =
                          entry.match_score >= 80 ? 'bg-emerald-400' :
                          entry.match_score >= 65 ? 'bg-blue-400' :
                          entry.match_score >= 50 ? 'bg-amber-400' : 'bg-slate-300';
                        const scoreText =
                          entry.match_score >= 80 ? 'text-emerald-700' :
                          entry.match_score >= 65 ? 'text-blue-700' :
                          entry.match_score >= 50 ? 'text-amber-700' : 'text-slate-500';
                        return (
                          <div key={entry.job_id} className="border border-slate-200 rounded-xl p-3 bg-white hover:border-violet-200 hover:bg-violet-50/30 transition-colors">
                            {/* 標題列 */}
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex items-start gap-2 min-w-0">
                                <span className="text-[10px] font-bold text-slate-400 shrink-0 mt-0.5">#{idx + 1}</span>
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold text-slate-800 break-words leading-tight">{entry.job_title}</p>
                                  {entry.company && <p className="text-[10px] text-slate-500 mt-0.5">{entry.company}{entry.department ? ` · ${entry.department}` : ''}</p>}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className={`text-base font-black ${scoreText}`}>{entry.match_score}</span>
                                <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-[9px] font-bold ${rec.bg} ${rec.color}`}>
                                  {rec.icon}{entry.recommendation}
                                </span>
                              </div>
                            </div>
                            {/* 分數條 */}
                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-2">
                              <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: barWidth }} />
                            </div>
                            {/* 技能標籤 */}
                            {((Array.isArray(entry.matched_skills) && entry.matched_skills.length > 0) || (Array.isArray(entry.missing_skills) && entry.missing_skills.length > 0)) && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {(Array.isArray(entry.matched_skills) ? entry.matched_skills : []).slice(0, 5).map((s, i) => (
                                  <span key={i} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <CheckCircle2 className="w-2 h-2" />{s}
                                  </span>
                                ))}
                                {(Array.isArray(entry.missing_skills) ? entry.missing_skills : []).slice(0, 3).map((s, i) => (
                                  <span key={i} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-rose-50 text-rose-600 border border-rose-200">
                                    <AlertCircle className="w-2 h-2" />{s}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {/* v2: 後端已只回傳 Top 5，不需展開按鈕 */}
                    </div>
                  )}

                  {!rankingsLoaded && !loadingRankings && (
                    <button
                      onClick={fetchJobRankings}
                      className="w-full py-3 text-sm text-violet-600 hover:text-violet-800 font-medium border border-violet-200 rounded-xl hover:bg-violet-50 transition-colors flex items-center justify-center gap-2"
                    >
                      <Sparkles className="w-4 h-4" />
                      開始分析職缺匹配
                    </button>
                  )}
                </div>

                {/* ━━━━━ Section 1.5: 系統外職缺建議 ━━━━━ */}
                {(() => {
                  const candidateSkillsRaw = enrichedCandidate.skills;
                  const externalSuggestions = generateExternalSuggestions(candidateSkillsRaw || []);
                  if (externalSuggestions.length === 0) return null;
                  return (
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <Globe className="w-4 h-4 text-orange-500" />
                        <h3 className="text-sm font-bold text-slate-700">系統外職缺建議</h3>
                        <span className="text-[10px] text-slate-400">根據技能背景推斷</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mb-3">以下為人選技能可開拓的外部市場職缺方向，供顧問擴展配對範圍參考：</p>
                      <div className="space-y-2">
                        {externalSuggestions.map((s, i) => (
                          <div key={i} className="border border-orange-100 rounded-xl p-3 bg-gradient-to-br from-orange-50/40 to-amber-50/20 hover:border-orange-200 hover:bg-orange-50/60 transition-colors">
                            <div className="flex items-start justify-between gap-2 mb-1.5">
                              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                <span className="text-[9px] font-bold text-orange-700 bg-orange-100 border border-orange-200 px-1.5 py-0.5 rounded shrink-0">{s.industry}</span>
                                <span className="text-xs font-semibold text-slate-800">{s.role}</span>
                              </div>
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${s.confidence === 'high' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-amber-700 bg-amber-50 border-amber-200'}`}>
                                {s.confidence === 'high' ? '高匹配' : '中匹配'}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600 leading-relaxed mb-2">{s.reason}</p>
                            <div className="flex flex-wrap gap-1">
                              {s.triggered_skills.map((skill, j) => (
                                <span key={j} className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/80 text-slate-600 border border-slate-200">
                                  {skill}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* 分隔線 */}
                <div className="border-t border-dashed border-slate-200" />

                {/* ━━━━━ Section 2: 人選分析報告 ━━━━━ */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Bot className="w-4 h-4 text-violet-500" />
                    <h3 className="text-sm font-bold text-slate-700">人選分析報告</h3>
                    {ai && (
                      <span className="text-[10px] text-slate-400">
                        由 <span className="text-violet-600 font-medium">{ai.evaluated_by}</span> 評分
                      </span>
                    )}
                  </div>

                  {!ai ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      <Bot className="w-8 h-8 text-slate-300 mb-2" />
                      <p className="text-slate-500 text-sm font-medium">尚未有 AI 深度分析報告</p>
                      <p className="text-slate-400 text-xs mt-1">請由 AIbot 呼叫評分 API 寫入結果</p>
                      <code className="mt-3 text-[10px] text-violet-600 bg-violet-50 px-3 py-1.5 rounded-lg border border-violet-100">
                        PATCH /api/candidates/{'{id}'} · ai_match_result
                      </code>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* 分數 + 推薦等級 */}
                      <div className="flex items-center gap-4">
                        {(() => {
                          const sc = ai.score >= 85 ? 'text-emerald-600 border-emerald-400' :
                                     ai.score >= 70 ? 'text-blue-600 border-blue-400' :
                                     ai.score >= 55 ? 'text-amber-600 border-amber-400' : 'text-rose-600 border-rose-400';
                          const [scoreColor, ringColor] = sc.split(' ');
                          return (
                            <div className={`w-16 h-16 rounded-full border-4 ${ringColor} flex flex-col items-center justify-center shrink-0 bg-white shadow-sm`}>
                              <span className={`text-xl font-black ${scoreColor}`}>{ai.score}</span>
                              <span className="text-[8px] text-slate-400">/100</span>
                            </div>
                          );
                        })()}
                        <div className="space-y-1.5">
                          {(() => {
                            const rec = recConfig[ai.recommendation] || recConfig['觀望'];
                            return (
                              <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border font-bold text-xs ${rec.bg} ${rec.color}`}>
                                {rec.icon}{ai.recommendation}
                              </div>
                            );
                          })()}
                          {ai.job_title && (
                            <p className="text-xs text-slate-500">
                              針對職缺：<span className="font-medium text-slate-700">{ai.job_title}</span>
                              {ai.job_id && <span className="text-slate-400 ml-1">#{ai.job_id}</span>}
                            </p>
                          )}
                          {ai.evaluated_at && (
                            <p className="text-[10px] text-slate-400">
                              {new Date(ai.evaluated_at).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* 優勢亮點 */}
                      {Array.isArray(ai.strengths) && ai.strengths.length > 0 && (
                        <div>
                          <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-2">
                            <Star className="w-3 h-3 text-amber-500" /> 優勢亮點
                          </h4>
                          <ul className="space-y-1">
                            {ai.strengths.map((s, i) => (
                              <li key={i} className="flex items-start gap-2 text-xs text-slate-700">
                                <span className="mt-0.5 w-4 h-4 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0 text-amber-600 text-[8px] font-bold">{i + 1}</span>
                                {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* 技能缺口 */}
                      {Array.isArray(ai.missing_skills) && ai.missing_skills.length > 0 && (
                        <div>
                          <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-2">
                            <AlertCircle className="w-3 h-3 text-rose-500" /> 技能缺口
                          </h4>
                          <div className="flex flex-wrap gap-1">
                            {ai.missing_skills.map((s, i) => (
                              <span key={i} className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 text-rose-600 border border-rose-200">
                                <AlertCircle className="w-2.5 h-2.5 shrink-0" />{s}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 薪資符合度 */}
                      {ai.salary_fit && (
                        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 flex items-start gap-2">
                          <span className="text-base shrink-0">💰</span>
                          <div>
                            <span className="text-[10px] font-semibold text-slate-500 block mb-0.5">薪資符合度</span>
                            {ai.salary_fit}
                          </div>
                        </div>
                      )}

                      {/* 建議顧問詢問 */}
                      {Array.isArray(ai.probing_questions) && ai.probing_questions.length > 0 && (
                        <div>
                          <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-2">
                            <HelpCircle className="w-3 h-3 text-blue-500" /> 建議顧問詢問
                          </h4>
                          <div className="space-y-1.5">
                            {ai.probing_questions.map((q, i) => (
                              <div key={i} className="flex items-start gap-2 p-2 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-800">
                                <span className="shrink-0 font-bold text-blue-400 min-w-[20px]">Q{i + 1}</span>
                                {q}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* AI 完整結論 */}
                      {ai.conclusion && (
                        <div>
                          <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-2">
                            <Bot className="w-3 h-3 text-violet-500" /> AI 完整結論
                          </h4>
                          <div className="p-3 sm:p-4 bg-violet-50 border border-violet-100 rounded-xl text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
                            {ai.conclusion}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

              </div>
            );
          })()}
        </div>

        {/* Footer Actions */}
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              <span>負責顧問：</span>
              <span className="font-medium text-gray-900 ml-1">
                {candidate.consultant || '未分配'}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
              >
                關閉
              </button>
              
              {onUpdateStatus && (
                <div className="relative group">
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                    更新狀態
                  </button>
                  {/* Dropdown menu (future enhancement) */}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
    {/* 匿名履歷預覽 Modal */}
    {showResumeGen && (
      <ResumePreview
        candidate={candidate}
        candidateLabel={`Candidate ${candidate.id}`}
        onClose={() => setShowResumeGen(false)}
      />
    )}
    </>
  );
}
