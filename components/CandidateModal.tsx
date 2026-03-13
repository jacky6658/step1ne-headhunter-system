// Step1ne Headhunter System - 候選人詳情 Modal
import React, { useState, useRef } from 'react';
import { Candidate, CandidateStatus, AiMatchResult, JobRankingEntry, ExternalJobSuggestion, ConsultantEvaluation, VoiceAssessment, ResumeFile } from '../types';
import { ResumePreview } from './ResumeGenerator';
import { RadarChart, RADAR_DIMENSIONS, computeAutoScores, computeOverallRating } from './RadarChart';
import { CANDIDATE_STATUS_CONFIG } from '../constants';
import { apiPatch, apiGet, getApiUrl } from '../config/api';
import { toast } from './Toast';
import {
  X, User, Mail, Phone, MapPin, Briefcase, Calendar,
  TrendingUp, Award, FileText, MessageSquare, Clock,
  CheckCircle2, AlertCircle, Bot, Star, ThumbsUp, ThumbsDown,
  HelpCircle, Sparkles, Target, Globe, Trash2, Brain, Copy, ChevronDown,
  Download, Eye, Upload
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
  const [activeTab, setActiveTab] = useState<'info' | 'history' | 'notes' | 'ai_summary' | 'ai_match'>('info');
  const [promptCopied, setPromptCopied] = useState(false);
  const [matchPromptCopied, setMatchPromptCopied] = useState(false);
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
  // 作品集
  const [editingPortfolio, setEditingPortfolio] = useState(false);
  const [portfolioInput, setPortfolioInput] = useState((candidate as any).portfolioUrl || (candidate as any).portfolio_url || '');
  const [savingPortfolio, setSavingPortfolio] = useState(false);
  // 自傳
  const [editingBio, setEditingBio] = useState(false);
  const [bioInput, setBioInput] = useState((candidate as any).biography || '');
  const [savingBio, setSavingBio] = useState(false);
  // 電話腳本
  const [showPhoneScript, setShowPhoneScript] = useState(false);
  const [phoneScriptLoading, setPhoneScriptLoading] = useState(false);
  const [phoneScriptContent, setPhoneScriptContent] = useState('');
  const [phoneScriptCopied, setPhoneScriptCopied] = useState(false);
  // 語音評估
  const [showAddVoice, setShowAddVoice] = useState(false);
  const [voiceAudioUrl, setVoiceAudioUrl] = useState('');
  const [voiceAnalysis, setVoiceAnalysis] = useState('');
  const [savingVoice, setSavingVoice] = useState(false);
  const [expandedVoiceId, setExpandedVoiceId] = useState<string | null>(null);
  // ── 履歷 PDF 附件 ──
  const [resumeFiles, setResumeFiles] = useState<ResumeFile[]>(candidate.resumeFiles || []);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDraggingResume, setIsDraggingResume] = useState(false);
  const resumeInputRef = useRef<HTMLInputElement>(null);
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

  // Phase 1 新增欄位
  const [editBirthday, setEditBirthday] = useState(candidate.birthday || '');
  const [editAge, setEditAge] = useState(String(candidate.age ?? ''));
  const [editGender, setEditGender] = useState(candidate.gender || '');
  const [editEnglishName, setEditEnglishName] = useState(candidate.englishName || '');
  const [editConsultantNote, setEditConsultantNote] = useState(candidate.consultantNote || '');
  const [editIndustry, setEditIndustry] = useState(candidate.industry || '');

  // 從出生日期自動計算年齡
  const calcAgeFromBirthday = (bd: string): number | null => {
    if (!bd) return null;
    const birth = new Date(bd);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age > 0 && age < 120 ? age : null;
  };
  const [editEducation, setEditEducation] = useState(
    typeof candidate.education === 'string' ? candidate.education : '');
  const [editLanguages, setEditLanguages] = useState(candidate.languages || '');
  const [editCertifications, setEditCertifications] = useState(candidate.certifications || '');
  const [editCurrentSalary, setEditCurrentSalary] = useState(candidate.currentSalary || '');
  const [editExpectedSalary, setEditExpectedSalary] = useState(candidate.expectedSalary || '');
  const [editNoticePeriod, setEditNoticePeriod] = useState(candidate.noticePeriod || '');
  const [editManagement, setEditManagement] = useState(candidate.managementExperience || false);
  const [editTeamSize, setEditTeamSize] = useState(candidate.teamSize || '');

  // Phase 3 動機與交易條件
  const [editJobSearchStatus, setEditJobSearchStatus] = useState(candidate.jobSearchStatus || '');
  const [editReasonForChange, setEditReasonForChange] = useState(candidate.reasonForChange || '');
  const [editMotivation, setEditMotivation] = useState(candidate.motivation || '');
  const [editDealBreakers, setEditDealBreakers] = useState(candidate.dealBreakers || '');
  const [editCompetingOffers, setEditCompetingOffers] = useState(candidate.competingOffers || '');
  const [editRelationshipLevel, setEditRelationshipLevel] = useState(candidate.relationshipLevel || '');

  // 顧問評估
  const [consultEval, setConsultEval] = useState<ConsultantEvaluation>(candidate.consultantEvaluation || {});
  const [editingEval, setEditingEval] = useState(false);
  const [savingEval, setSavingEval] = useState(false);

  // PDF 履歷匯入
  const [showImport, setShowImport] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importParsed, setImportParsed] = useState<any | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSelected, setImportSelected] = useState<Set<string>>(new Set());
  const [applyingImport, setApplyingImport] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [importFormat, setImportFormat] = useState<string>('auto');

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

      toast.success('進度新增成功！看板與 Pipeline 欄位已同步更新');
      // 即時更新 UI 而非整頁重載
      onCandidateUpdate?.(candidate.id, {
        status: newStatus,
        progressTracking: updatedProgress,
      } as Partial<Candidate>);

    } catch (error) {
      console.error('❌ 新增進度失敗:', error);
      toast.error('新增進度失敗，請稍後再試');
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
      onAssignRecruiter?.(candidate.id, recruiterInput);
      onCandidateUpdate?.(candidate.id, { consultant: recruiterInput });
      setEditingRecruiter(false);
    } catch (err) {
      toast.error('指派失敗，請稍後再試');
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
      toast.error('儲存目標職缺失敗，請稍後再試');
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
      toast.error('儲存備註失敗，請稍後再試');
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
      toast.error('刪除備註失敗，請稍後再試');
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
      toast.error('儲存 LinkedIn 失敗，請稍後再試');
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
      toast.error('儲存 GitHub 失敗，請稍後再試');
    } finally {
      setSavingGithub(false);
    }
  };

  // 生成電話腳本
  const handleGeneratePhoneScript = async () => {
    if (!targetJobId) return;
    setPhoneScriptLoading(true);
    setShowPhoneScript(true);
    setPhoneScriptCopied(false);
    try {
      // 取得完整職缺資料
      const jobRes = await apiGet<any>(`/api/jobs/${targetJobId}`);
      const job = jobRes?.data || jobRes || {};
      // 取得 BD 客戶資料（如果有 client_id）
      let client: any = {};
      if (job.client_id) {
        try {
          const cRes = await apiGet<any>(`/api/clients/${job.client_id}`);
          client = cRes?.data || cRes || {};
        } catch {}
      }
      // 組裝變數
      const cName = candidate.name || '候選人';
      const cPos = candidate.position || '未知職位';
      const cYears = candidate.years || 0;
      const cSkillStr = Array.isArray(candidate.skills) ? candidate.skills.join(', ') : (candidate.skills || '');
      const jTitle = job.position_name || '職缺';
      const jLocation = job.location || '未提供';
      const jSalary = job.salary_range || '面議';
      const jSkillStr = job.key_skills || '';
      const jResponsibilities = (job.job_description || '').split('\n').filter((l: string) => l.trim());
      const jBenefits = (job.welfare_tags || '').split(/[,、]/).filter((b: string) => b.trim());
      const clCompany = job.client_company || client.company_name || '公司';
      const clIndustry = job.industry_background || client.industry || '未提供';
      const clSize = client.company_size || '未提供';
      const clWebsite = client.website || '';
      // 候選人動機資料
      const cSalary = candidate.currentSalary || '未提供';
      const cExpectedSalary = candidate.expectedSalary || '未提供';
      const cNoticePeriod = candidate.noticePeriod || '未提供';
      const cJobSearchStatus = candidate.jobSearchStatus || '';
      const cReasonForChange = candidate.reasonForChange || '';
      const cDealBreakers = candidate.dealBreakers || '';

      const script = `【結構化電話篩選 & 職缺介紹指南】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 目標職缺：${jTitle}（${clCompany}）
👤 候選人：${cName}
📋 目前：${cPos} ｜ ${cYears} 年經驗
🔧 技能：${cSkillStr}

═══════════════════════════════════
📢 PART A — 公司 & 職缺介紹話術
═══════════════════════════════════

▎ A1. 公司介紹重點
┌───────────────────────────────────────┐
│ 🏢 公司：${clCompany}
│ 🏭 產業：${clIndustry}
│ 📏 規模：${clSize}${clWebsite ? `\n│ 🌐 官網：${clWebsite}` : ''}
└───────────────────────────────────────┘

📌 建議話術：
「這是一間${clIndustry}領域的公司——${clCompany}，在業界的口碑很不錯。他們目前在積極擴編技術團隊，我覺得蠻適合跟你聊聊的。」

▎ A2. 職缺介紹重點
• 職位：${jTitle}
• 地點：${jLocation}
• 薪資範圍：${jSalary}
• 核心技術需求：${jSkillStr}
${jResponsibilities.length > 0 ? `• 主要職責：\n${jResponsibilities.slice(0, 3).map((r: string) => `  ‣ ${r.trim()}`).join('\n')}` : ''}
${jBenefits.length > 0 ? `• 福利亮點：\n${jBenefits.slice(0, 3).map((b: string) => `  ✦ ${b.trim()}`).join('\n')}` : ''}

📌 建議話術：
「這個 ${jTitle} 的角色主要會負責 ${jSkillStr} 相關的開發，薪資的話客戶端給的範圍是 ${jSalary}，整體 package 可以再細談。」

▎ A3. 關鍵賣點（吸引人選的角度）
✅ 技術面：使用 ${jSkillStr}，技術棧有挑戰性
✅ 發展面：${clCompany} 正在擴張，有升遷空間
✅ 團隊文化：可在面試時進一步了解${jBenefits.length > 0 ? `\n✅ 福利面：${jBenefits[0].trim()}` : ''}

═══════════════════════════════════
👤 PART B — 已知人選資訊
═══════════════════════════════════
${cJobSearchStatus ? `• 求職狀態：${cJobSearchStatus}` : ''}
${cReasonForChange ? `• 轉職原因：${cReasonForChange}` : ''}
${cSalary !== '未提供' ? `• 目前薪資：${cSalary}` : ''}
${cExpectedSalary !== '未提供' ? `• 期望薪資：${cExpectedSalary}` : ''}
${cNoticePeriod !== '未提供' ? `• 可到職時間：${cNoticePeriod}` : ''}
${cDealBreakers ? `• ⛔ 不接受條件：${cDealBreakers}` : ''}

═══════════════════════════════════
🎙️ PART C — 結構化電話篩選問題
═══════════════════════════════════

▎ C1. 開場（2 分鐘）
• 簡單自我介紹 + 說明通話目的
• 確認通話時間（約 25-30 分鐘）
• 「在開始之前，我先簡單介紹一下這個機會...」→ 用 Part A 話術

▎ C2. 動機探測（5 分鐘）
1. 目前的工作狀態如何？有在看外面的機會嗎？
2. 如果要換工作，最看重什麼？（技術、薪資、文化、遠端）
3. 有什麼是「絕對不接受」的條件嗎？
4. 聽完剛才介紹的機會，你的初步感覺如何？

▎ C3. 技術驗證（8 分鐘）
5. 能否用 1 分鐘描述你目前專案中最有挑戰的部分？
6. ${jSkillStr} — 這些技術你的熟練程度如何？（1-5 分）
7. 你在團隊中通常扮演什麼角色？（執行者/架構師/mentor）
8. 有帶人的經驗嗎？帶過多少人的團隊？

▎ C4. 條件確認（5 分鐘）
9. 目前薪資大概在什麼範圍？（含年終、股票等）
10. 期望薪資是多少？有什麼硬性底線嗎？
11. 最快什麼時候可以到職？
12. 對 ${jLocation} 的工作地點 OK 嗎？

▎ C5. 收尾 & 興趣確認（3 分鐘）
13. 目前手上有其他面試或 offer 嗎？
14. 綜合剛才聊的，你對 ${clCompany} 這個機會有興趣進一步了解嗎？
15. 如果安排面試，你的時間偏好？

═══════════════════════════════════
📝 通話後顧問 Checklist
═══════════════════════════════════
☐ 人選對公司/職缺的興趣程度（1-5）：__
☐ 技術匹配度評估：__
☐ 薪資期望 vs 客戶預算是否有落差：__
☐ 預計到職時間：__
☐ 下一步：□ 安排面試 □ 再考慮 □ 暫不適合`;

      setPhoneScriptContent(script);
    } catch (err) {
      setPhoneScriptContent('⚠️ 無法載入職缺資料，請確認目標職缺已正確指定。');
    } finally {
      setPhoneScriptLoading(false);
    }
  };

  const handleCopyPhoneScript = () => {
    navigator.clipboard.writeText(phoneScriptContent).then(() => {
      setPhoneScriptCopied(true);
      setTimeout(() => setPhoneScriptCopied(false), 2000);
    });
  };

  // 儲存作品集 URL
  const handleSavePortfolio = async () => {
    setSavingPortfolio(true);
    try {
      await apiPatch(`/api/candidates/${candidate.id}`, {
        portfolio_url: portfolioInput.trim(),
        actor: currentUserName || 'system',
      });
      (candidate as any).portfolioUrl = portfolioInput.trim();
      setEditingPortfolio(false);
    } catch (err) {
      toast.error('儲存作品集失敗，請稍後再試');
    } finally {
      setSavingPortfolio(false);
    }
  };

  // 儲存自傳
  const handleSaveBio = async () => {
    setSavingBio(true);
    try {
      await apiPatch(`/api/candidates/${candidate.id}`, {
        biography: bioInput.trim(),
        actor: currentUserName || 'system',
      });
      (candidate as any).biography = bioInput.trim();
      setEditingBio(false);
    } catch (err) {
      toast.error('儲存自傳失敗，請稍後再試');
    } finally {
      setSavingBio(false);
    }
  };

  // 新增語音評估
  const handleAddVoiceAssessment = async () => {
    if (!voiceAnalysis.trim()) return;
    setSavingVoice(true);
    try {
      const existing: any[] = (candidate as any).voiceAssessments || (candidate as any).voice_assessments || [];
      const newEntry = {
        id: `va_${Date.now()}`,
        audio_url: voiceAudioUrl.trim() || undefined,
        analysis: voiceAnalysis.trim(),
        created_at: new Date().toISOString(),
        evaluator: currentUserName || 'system',
      };
      const updated = [newEntry, ...existing];
      await apiPatch(`/api/candidates/${candidate.id}`, {
        voice_assessments: updated,
        actor: currentUserName || 'system',
      });
      (candidate as any).voiceAssessments = updated;
      setShowAddVoice(false);
      setVoiceAudioUrl('');
      setVoiceAnalysis('');
    } catch (err) {
      toast.error('儲存語音評估失敗，請稍後再試');
    } finally {
      setSavingVoice(false);
    }
  };

  // 刪除語音評估
  const handleDeleteVoice = async (voiceId: string) => {
    if (!confirm('確定要刪除此語音評估記錄嗎？')) return;
    try {
      const existing: any[] = (candidate as any).voiceAssessments || (candidate as any).voice_assessments || [];
      const updated = existing.filter((v: any) => v.id !== voiceId);
      await apiPatch(`/api/candidates/${candidate.id}`, {
        voice_assessments: updated,
        actor: currentUserName || 'system',
      });
      (candidate as any).voiceAssessments = updated;
      setExpandedVoiceId(null);
    } catch (err) {
      toast.error('刪除失敗');
    }
  };

  // ── 履歷 PDF 附件上傳 / 預覽 / 下載 / 刪除 ──
  const handleResumeUpload = async (file: File) => {
    if (file.type !== 'application/pdf') { toast.warning('僅接受 PDF 檔案'); return; }
    if (file.size > 10 * 1024 * 1024) { toast.warning('檔案大小不可超過 10MB'); return; }
    if (resumeFiles.length >= 3) { toast.warning('每位候選人最多上傳 3 個 PDF 檔案'); return; }

    setUploadingResume(true);
    setUploadProgress(0);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('uploaded_by', currentUserName || 'system');

      const result = await new Promise<any>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', getApiUrl(`/api/candidates/${candidate.id}/resume`));
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          try {
            const json = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300 && json.success) resolve(json);
            else reject(new Error(json.error || '上傳失敗'));
          } catch { reject(new Error('回應格式錯誤')); }
        };
        xhr.onerror = () => reject(new Error('網路錯誤'));
        xhr.send(formData);
      });

      setResumeFiles(prev => [...prev, result.file]);
      (candidate as any).resumeFiles = [...resumeFiles, result.file];
    } catch (err: any) {
      toast.error('上傳失敗：' + err.message);
    } finally {
      setUploadingResume(false);
      setUploadProgress(0);
    }
  };

  const handlePreviewResume = (fileId: string) => {
    window.open(getApiUrl(`/api/candidates/${candidate.id}/resume/${fileId}`), '_blank');
  };
  const handleDownloadResume = (fileId: string) => {
    window.open(getApiUrl(`/api/candidates/${candidate.id}/resume/${fileId}?download=true`), '_blank');
  };
  const handleDeleteResume = async (fileId: string) => {
    if (!confirm('確定要刪除此履歷檔案嗎？')) return;
    try {
      const resp = await fetch(getApiUrl(`/api/candidates/${candidate.id}/resume/${fileId}`), { method: 'DELETE' });
      const json = await resp.json();
      if (!json.success) throw new Error(json.error || '刪除失敗');
      const updated = resumeFiles.filter(f => f.id !== fileId);
      setResumeFiles(updated);
      (candidate as any).resumeFiles = updated;
    } catch (err: any) {
      toast.error('刪除失敗：' + err.message);
    }
  };

  const handleResumeDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDraggingResume(true); };
  const handleResumeDragLeave = () => setIsDraggingResume(false);
  const handleResumeDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingResume(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf');
    if (files.length > 0) handleResumeUpload(files[0]);
  };

  // PDF 履歷匯入處理
  const IMPORT_FIELD_LABELS: Record<string, string> = {
    name: '姓名', position: '職稱', location: '地點',
    phone: '電話', email: 'Email', age: '年齡', years: '年資',
    skills: '技能', education: '學歷', linkedinUrl: 'LinkedIn URL',
    industry: '產業', languages: '語言能力', certifications: '證照',
    expectedSalary: '期望薪資', noticePeriod: '到職時間', jobSearchStatus: '求職狀態',
    notes: '個人簡介（自傳）', workHistory: '工作經歷', educationJson: '學歷詳情',
  };
  const IMPORT_FIELDS = Object.keys(IMPORT_FIELD_LABELS);

  const handleImportPDF = async (file: File) => {
    setImportLoading(true);
    setImportError(null);
    setImportParsed(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('format', importFormat);
      const resp = await fetch(getApiUrl('/api/resume/parse'), { method: 'POST', body: formData });
      const json = await resp.json();
      if (!json.success) throw new Error(json.error || '解析失敗');
      setImportParsed(json.parsed);
      // 預設全選有值的欄位（名字若與現有不同則不預選，避免 PDF 解析錯誤覆蓋）
      const defaultSelected = new Set(
        IMPORT_FIELDS.filter(f => {
          const v = json.parsed[f];
          if (v === null || v === undefined) return false;
          if (Array.isArray(v)) return v.length > 0;
          if (typeof v === 'string') return v.trim().length > 0;
          // 名字若跟現有不同，預設不勾選
          if (f === 'name' && candidate.name && v && candidate.name !== v) return false;
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
      // camelCase → snake_case 對照表
      const fieldMap: Record<string, string> = {
        linkedinUrl: 'linkedin_url',
        workHistory: 'work_history',
        educationJson: 'education_details',
        expectedSalary: 'expected_salary',
        noticePeriod: 'notice_period',
        jobSearchStatus: 'job_search_status',
        notes: 'biography',
      };
      const updates: any = { actor: currentUserName || 'system' };
      for (const field of importSelected) {
        const v = importParsed[field];
        if (v === null || v === undefined) continue;
        if (field === 'skills') {
          updates.skills = Array.isArray(v) ? v.join('、') : v;
        } else if (field === 'workHistory' || field === 'educationJson') {
          updates[fieldMap[field]] = JSON.stringify(v);
        } else {
          const key = fieldMap[field] || field;
          updates[key] = v;
        }
      }
      await apiPatch(`/api/candidates/${candidate.id}`, updates);

      // 更新本地 edit state
      const p = importParsed;
      if (importSelected.has('name') && p.name) setEditName(p.name);
      if (importSelected.has('position') && p.position) setEditPosition(p.position);
      if (importSelected.has('location') && p.location) setEditLocation(p.location);
      if (importSelected.has('phone') && p.phone) setEditPhone(p.phone);
      if (importSelected.has('email') && p.email) setEditEmail(p.email);
      if (importSelected.has('age') && p.age) setEditAge(String(p.age));
      if (importSelected.has('years') && p.years) setEditYears(String(p.years));
      if (importSelected.has('skills') && p.skills) setEditSkills(Array.isArray(p.skills) ? p.skills.join('、') : p.skills);
      if (importSelected.has('industry') && p.industry) setEditIndustry(p.industry);
      if (importSelected.has('languages') && p.languages) setEditLanguages(p.languages);
      if (importSelected.has('certifications') && p.certifications) setEditCertifications(p.certifications);
      if (importSelected.has('expectedSalary') && p.expectedSalary) setEditExpectedSalary(p.expectedSalary);
      if (importSelected.has('noticePeriod') && p.noticePeriod) setEditNoticePeriod(p.noticePeriod);
      if (importSelected.has('jobSearchStatus') && p.jobSearchStatus) setEditJobSearchStatus(p.jobSearchStatus);

      onCandidateUpdate?.(candidate.id, {
        ...(importSelected.has('name') && p.name && { name: p.name }),
        ...(importSelected.has('position') && p.position && { position: p.position }),
        ...(importSelected.has('location') && p.location && { location: p.location }),
        ...(importSelected.has('years') && p.years && { years: p.years }),
        ...(importSelected.has('skills') && p.skills && { skills: p.skills }),
        ...(importSelected.has('phone') && p.phone && { phone: p.phone }),
        ...(importSelected.has('email') && p.email && { email: p.email }),
        ...(importSelected.has('age') && p.age && { age: p.age }),
        ...(importSelected.has('education') && p.education && { education: p.education }),
        ...(importSelected.has('industry') && p.industry && { industry: p.industry }),
        ...(importSelected.has('languages') && p.languages && { languages: p.languages }),
        ...(importSelected.has('certifications') && p.certifications && { certifications: p.certifications }),
        ...(importSelected.has('expectedSalary') && p.expectedSalary && { expectedSalary: p.expectedSalary }),
        ...(importSelected.has('noticePeriod') && p.noticePeriod && { noticePeriod: p.noticePeriod }),
        ...(importSelected.has('jobSearchStatus') && p.jobSearchStatus && { jobSearchStatus: p.jobSearchStatus }),
        ...(importSelected.has('linkedinUrl') && p.linkedinUrl && { linkedinUrl: p.linkedinUrl }),
        ...(importSelected.has('workHistory') && p.workHistory && { workHistory: p.workHistory }),
        ...(importSelected.has('educationJson') && p.educationJson && { educationJson: p.educationJson }),
      });
      setShowImport(false);
      setImportParsed(null);
      toast.success('已成功套用 PDF 解析資料！');
    } catch (e: any) {
      toast.error('套用失敗：' + e.message);
    } finally {
      setApplyingImport(false);
    }
  };

  // 儲存基本資料（含 Phase 1 新增欄位）
  const handleSaveBasicInfo = async () => {
    setSavingBasicInfo(true);
    try {
      const updates: Record<string, any> = {
        name: editName.trim(),
        position: editPosition.trim(),
        location: editLocation.trim(),
        phone: editPhone.trim(),
        email: editEmail.trim(),
        years: parseInt(editYears) || 0,
        skills: editSkills.trim(),
        // Phase 1 新增欄位
        birthday: editBirthday || null,
        age: editBirthday ? calcAgeFromBirthday(editBirthday) : (editAge ? parseInt(editAge) : null),
        age_estimated: editBirthday ? false : (candidate.ageEstimated ?? true),
        gender: editGender,
        english_name: editEnglishName.trim(),
        consultant_note: editConsultantNote.trim(),
        education: editEducation.trim(),
        industry: editIndustry.trim(),
        languages: editLanguages.trim(),
        certifications: editCertifications.trim(),
        current_salary: editCurrentSalary.trim(),
        expected_salary: editExpectedSalary.trim(),
        notice_period: editNoticePeriod.trim(),
        management_experience: editManagement,
        team_size: editTeamSize.trim(),
        // Phase 3 動機與交易條件
        job_search_status: editJobSearchStatus.trim(),
        reason_for_change: editReasonForChange.trim(),
        motivation: editMotivation.trim(),
        deal_breakers: editDealBreakers.trim(),
        competing_offers: editCompetingOffers.trim(),
        relationship_level: editRelationshipLevel.trim(),
        actor: currentUserName || 'system',
      };
      await apiPatch(`/api/candidates/${candidate.id}`, updates);
      // 傳送所有更新的欄位，確保 UI 即時同步
      const { actor, ...uiUpdates } = updates;
      onCandidateUpdate?.(candidate.id, uiUpdates);
      setEditingBasicInfo(false);
    } catch (err) {
      toast.error('儲存基本資料失敗，請稍後再試');
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
      toast.error('儲存工作經歷失敗');
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
      toast.error('儲存教育背景失敗');
    } finally {
      setSavingEdu(false);
      setAddingEdu(false);
      setEditingEduIdx(null);
    }
  };

  // 複製邀請訊息到剪貼簿
  const handleCopyInviteMessage = () => {
    navigator.clipboard.writeText(inviteMessage).then(() => {
      toast.success('邀請訊息已複製到剪貼簿！');
    }).catch(err => {
      console.error('複製失敗:', err);
      toast.error('複製失敗，請手動複製');
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
                {(candidate.age != null && candidate.age > 0 || candidate.birthday) && (
                  <div className="flex items-center gap-0.5 sm:gap-1.5 whitespace-nowrap" title={candidate.birthday ? `生日：${candidate.birthday}` : ''}>
                    <Calendar className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
                    <span>
                      {candidate.birthday
                        ? `${calcAgeFromBirthday(candidate.birthday)} 歲`
                        : `${candidate.ageEstimated ? '~' : ''}${candidate.age} 歲`
                      }
                    </span>
                  </div>
                )}
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
              onClick={() => setActiveTab('ai_summary')}
              className={`px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'ai_summary'
                  ? 'text-purple-600 border-b-2 border-purple-600 bg-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-1 sm:gap-2">
                <Brain className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">AI 總結</span>
                <span className="sm:hidden">總結</span>
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

              {/* 📞 電話腳本按鈕 */}
              {targetJobId && (
                <button
                  onClick={handleGeneratePhoneScript}
                  disabled={phoneScriptLoading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-lg hover:from-teal-600 hover:to-emerald-600 transition-all shadow-sm disabled:opacity-60 text-sm font-medium"
                >
                  <Phone className="w-4 h-4" />
                  {phoneScriptLoading ? '生成電話腳本中...' : '📞 生成電話篩選腳本'}
                </button>
              )}

              {/* 電話腳本面板 */}
              {showPhoneScript && (
                <div className="bg-teal-50 rounded-lg border border-teal-200 overflow-hidden">
                  <div className="flex items-center justify-between p-3 border-b border-teal-100">
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-teal-600" />
                      <span className="text-xs font-semibold text-teal-700">電話篩選腳本</span>
                      <span className="text-xs text-teal-500">({targetJobInput})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleCopyPhoneScript}
                        disabled={!phoneScriptContent || phoneScriptLoading}
                        className="text-xs px-3 py-1 bg-teal-600 text-white rounded hover:bg-teal-700 disabled:opacity-60 flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" />
                        {phoneScriptCopied ? '已複製 ✓' : '複製腳本'}
                      </button>
                      <button
                        onClick={() => { setShowPhoneScript(false); setPhoneScriptContent(''); }}
                        className="text-teal-400 hover:text-teal-600 text-lg leading-none"
                      >
                        &times;
                      </button>
                    </div>
                  </div>
                  <div className="p-3 max-h-96 overflow-y-auto">
                    {phoneScriptLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600"></div>
                        <span className="ml-2 text-sm text-teal-600">正在載入職缺資料並生成腳本...</span>
                      </div>
                    ) : (
                      <pre className="text-xs text-teal-900 whitespace-pre-wrap font-mono leading-relaxed">{phoneScriptContent}</pre>
                    )}
                  </div>
                </div>
              )}

              {/* 基本資料卡片（可編輯） */}
              <div className="bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between p-3 border-b border-gray-100">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">基本資料</span>
                  {!editingBasicInfo ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => { setShowImport(v => !v); setImportParsed(null); setImportError(null); setImportFormat('auto'); }}
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
                      <button onClick={() => { setEditingBasicInfo(false); setEditName(candidate.name); setEditPosition(candidate.position||''); setEditLocation(candidate.location||''); setEditPhone(candidate.phone||''); setEditEmail(candidate.email||''); setEditYears(String(candidate.years||'')); setEditSkills(Array.isArray(candidate.skills)?candidate.skills.join('、'):(candidate.skills||'')); setEditAge(String(candidate.age??'')); setEditEducation(typeof candidate.education === 'string' ? candidate.education : ''); setEditEnglishName(candidate.englishName||''); setEditIndustry(candidate.industry||''); setEditLanguages(candidate.languages||''); setEditCertifications(candidate.certifications||''); setEditCurrentSalary(candidate.currentSalary||''); setEditExpectedSalary(candidate.expectedSalary||''); setEditNoticePeriod(candidate.noticePeriod||''); setEditManagement(candidate.managementExperience||false); setEditTeamSize(candidate.teamSize||''); setEditJobSearchStatus(candidate.jobSearchStatus||''); setEditReasonForChange(candidate.reasonForChange||''); setEditMotivation(candidate.motivation||''); setEditDealBreakers(candidate.dealBreakers||''); setEditCompetingOffers(candidate.competingOffers||''); setEditRelationshipLevel(candidate.relationshipLevel||''); setEditConsultantNote(candidate.consultantNote||''); }} className="text-xs px-2 py-1 border border-gray-200 rounded text-gray-600 hover:bg-white">取消</button>
                    </div>
                  )}
                </div>
                {/* PDF 履歷匯入面板 — 放在 header 下方方便立即看到 */}
                {showImport && (
                  <div className="border-b border-blue-200 bg-blue-50/40 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-blue-700">📄 匯入 PDF 履歷</span>
                      <button onClick={() => { setShowImport(false); setImportParsed(null); setImportError(null); setIsDragging(false); setImportFormat('auto'); }} className="text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
                    </div>

                    {/* 格式選擇器 */}
                    {!importParsed && !importLoading && (
                      <div className="space-y-1.5">
                        <span className="text-xs text-gray-500">選擇履歷格式：</span>
                        <div className="flex flex-wrap gap-1.5">
                          {([
                            { value: 'auto', label: '🔍 自動偵測' },
                            { value: '104', label: '📋 104 人力銀行' },
                            { value: 'linkedin', label: '💼 LinkedIn' },
                            { value: 'generic', label: '📄 通用格式' },
                          ] as const).map(opt => (
                            <button
                              key={opt.value}
                              onClick={() => setImportFormat(opt.value)}
                              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                                importFormat === opt.value
                                  ? 'bg-blue-600 text-white border-blue-600'
                                  : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 檔案選擇 + 拖曳 */}
                    {!importParsed && !importLoading && (
                      <label
                        className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 cursor-pointer transition-colors ${
                          isDragging
                            ? 'border-blue-500 bg-blue-100 scale-[1.01]'
                            : 'border-blue-300 hover:bg-blue-50'
                        }`}
                        onDragEnter={e => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
                        onDragOver={e => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
                        onDragLeave={e => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }}
                        onDrop={e => {
                          e.preventDefault(); e.stopPropagation(); setIsDragging(false);
                          const f = e.dataTransfer.files?.[0];
                          if (f && f.type === 'application/pdf') {
                            handleImportPDF(f);
                          } else if (f) {
                            setImportError('請上傳 PDF 格式的檔案');
                          }
                        }}
                      >
                        <span className="text-3xl mb-2">{isDragging ? '📥' : '📂'}</span>
                        <span className="text-sm text-blue-600 font-medium">
                          {isDragging ? '放開以匯入 PDF' : '拖曳 PDF 到這裡，或點擊選擇檔案'}
                        </span>
                        <span className="text-xs text-gray-400 mt-1">支援 LinkedIn / 104 人力銀行 PDF，最大 10 MB</span>
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
                      <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3 space-y-1">
                        <div>❌ {importError}</div>
                        {importFormat === 'auto' && (
                          <div className="text-xs text-orange-600">💡 若自動偵測失敗，請選擇正確的履歷格式後重試</div>
                        )}
                        <button onClick={() => setImportError(null)} className="text-xs underline">重試</button>
                      </div>
                    )}

                    {/* 解析結果預覽 */}
                    {importParsed && !importLoading && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">
                            來源：<span className="font-semibold text-blue-600">{importParsed.source || 'LinkedIn'}</span>
                            &nbsp;·&nbsp;信心 {Math.round((importParsed._meta?.confidence || 0) * 100)}%
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
                            // 名字警告：解析出的名字跟人選卡片現有名字不同
                            const isNameMismatch = field === 'name' && candidate.name && val && candidate.name !== val;
                            return (
                              <label key={field} className={`grid grid-cols-[1.5rem_5rem_1fr] gap-2 px-3 py-2 items-start cursor-pointer hover:bg-blue-50/40 ${isNameMismatch ? 'bg-red-50' : ''}`}>
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
                                <div className="min-w-0">
                                  <span className={`break-all ${isNameMismatch ? 'text-red-600 font-medium' : 'text-gray-800'}`}>{displayVal}</span>
                                  {isNameMismatch && (
                                    <div className="text-[10px] text-red-500 mt-0.5">⚠️ 與現有姓名「{candidate.name}」不同，PDF 解析可能有誤，請確認</div>
                                  )}
                                </div>
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
                    {/* Phase 1 新增欄位 */}
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">出生年月日</label>
                      <input
                        value={editBirthday}
                        onChange={e => {
                          const bd = e.target.value;
                          setEditBirthday(bd);
                          const age = calcAgeFromBirthday(bd);
                          if (age !== null) setEditAge(String(age));
                        }}
                        type="date"
                        max={new Date().toISOString().split('T')[0]}
                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      {editBirthday && calcAgeFromBirthday(editBirthday) !== null && (
                        <span className="text-xs text-blue-600 mt-0.5 block">→ {calcAgeFromBirthday(editBirthday)} 歲</span>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">年齡（無生日時手動填）</label>
                      <input value={editAge} onChange={e => setEditAge(e.target.value)} type="number" min="18" max="70" placeholder="例：32" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" disabled={!!editBirthday} />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">性別</label>
                      <select value={editGender} onChange={e => setEditGender(e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500">
                        <option value="">— 請選擇 —</option>
                        <option value="男">男</option>
                        <option value="女">女</option>
                        <option value="其他">其他</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">英文名（匿名履歷用）</label>
                      <input value={editEnglishName} onChange={e => setEditEnglishName(e.target.value)} placeholder="例：Iris、Jack Chen" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">學歷</label>
                      <input value={editEducation} onChange={e => setEditEducation(e.target.value)} placeholder="例：台大資工碩士" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">產業</label>
                      <input value={editIndustry} onChange={e => setEditIndustry(e.target.value)} placeholder="例：半導體、金融科技" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">語言能力</label>
                      <input value={editLanguages} onChange={e => setEditLanguages(e.target.value)} placeholder="例：中文母語、英文流利" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs text-gray-500 mb-1">證照（以逗號或頓號分隔）</label>
                      <textarea value={editCertifications} onChange={e => setEditCertifications(e.target.value)} placeholder="例：PMP、AWS SAA、Google Cloud" rows={2} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">目前薪資</label>
                      <input value={editCurrentSalary} onChange={e => setEditCurrentSalary(e.target.value)} placeholder="例：90K" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">期望薪資</label>
                      <input value={editExpectedSalary} onChange={e => setEditExpectedSalary(e.target.value)} placeholder="例：100K+" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">到職時間</label>
                      <input value={editNoticePeriod} onChange={e => setEditNoticePeriod(e.target.value)} placeholder="例：1個月" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">管理人數</label>
                      <input value={editTeamSize} onChange={e => setEditTeamSize(e.target.value)} placeholder="例：5-10人" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    </div>
                    <div className="sm:col-span-2 flex items-center gap-2">
                      <input type="checkbox" id="edit-mgmt" checked={editManagement} onChange={e => setEditManagement(e.target.checked)} className="rounded border-gray-300" />
                      <label htmlFor="edit-mgmt" className="text-xs text-gray-600">具備管理經驗</label>
                    </div>
                    {/* Phase 3 動機與交易條件 */}
                    <div className="sm:col-span-2 pt-2 border-t border-gray-200">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">動機與交易條件</span>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">求職狀態</label>
                      <select value={editJobSearchStatus} onChange={e => setEditJobSearchStatus(e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white">
                        <option value="">— 請選擇 —</option>
                        <option value="主動求職">主動求職</option>
                        <option value="被動觀望">被動觀望</option>
                        <option value="暫不考慮">暫不考慮</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">主要動機</label>
                      <select value={editMotivation} onChange={e => setEditMotivation(e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white">
                        <option value="">— 請選擇 —</option>
                        <option value="薪資提升">薪資提升</option>
                        <option value="技術成長">技術成長</option>
                        <option value="管理發展">管理發展</option>
                        <option value="產業轉型">產業轉型</option>
                        <option value="出國發展">出國發展</option>
                        <option value="離開現職">離開現職</option>
                        <option value="Work-Life Balance">Work-Life Balance</option>
                        <option value="其他">其他</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs text-gray-500 mb-1">轉職原因</label>
                      <input value={editReasonForChange} onChange={e => setEditReasonForChange(e.target.value)} placeholder="例：現公司發展有限、想挑戰新領域" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs text-gray-500 mb-1">不適配條件</label>
                      <input value={editDealBreakers} onChange={e => setEditDealBreakers(e.target.value)} placeholder="例：不接受輪班、不考慮傳產" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">競爭 Offer</label>
                      <input value={editCompetingOffers} onChange={e => setEditCompetingOffers(e.target.value)} placeholder="例：已有 Google Offer" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">顧問關係程度</label>
                      <select value={editRelationshipLevel} onChange={e => setEditRelationshipLevel(e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white">
                        <option value="">— 請選擇 —</option>
                        <option value="初次接觸">初次接觸</option>
                        <option value="已建立關係">已建立關係</option>
                        <option value="深度信任">深度信任</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-gray-500 mb-1">📝 顧問備註（與人選溝通後的重點記錄）</label>
                      <textarea value={editConsultantNote} onChange={e => setEditConsultantNote(e.target.value)} placeholder="例：人選目前在 A 公司做到主管，主要想換的原因是加班太多。薪資底線 80K，可接受新竹。英文口說流利但沒有證照。" rows={3} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y" />
                    </div>
                  </div>
                ) : (
                  <div className="p-3 grid grid-cols-2 gap-x-4 gap-y-2">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="text-xs text-gray-500">地點</span>
                      <span className="text-sm font-medium text-gray-800 truncate">{editLocation || '—'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Briefcase className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="text-xs text-gray-500">年資</span>
                      <span className="text-sm font-medium text-gray-800">{editYears && Number(editYears) > 0 ? `${editYears} 年` : '—'}</span>
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
                    {/* Phase 1 新增欄位顯示 — 始終顯示所有欄位 */}
                    <div className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="text-xs text-gray-500">性別</span>
                      <span className="text-sm font-medium text-gray-800">{editGender || '—'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Globe className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="text-xs text-gray-500">英文名</span>
                      <span className="text-sm font-medium text-gray-800">{editEnglishName || '—'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="text-xs text-gray-500">年齡</span>
                      <span className="text-sm font-medium text-gray-800">
                        {(editAge || candidate.age) ? (<>{candidate.ageEstimated ? '~' : ''}{editAge || candidate.age} 歲</>) : '—'}
                      </span>
                      {candidate.ageEstimated && (editAge || candidate.age) && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded">推估</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Award className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="text-xs text-gray-500">學歷</span>
                      <span className="text-sm font-medium text-gray-800 truncate">{editEducation || '—'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Briefcase className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="text-xs text-gray-500">產業</span>
                      <span className="text-sm font-medium text-gray-800 truncate">{editIndustry || '—'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Globe className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="text-xs text-gray-500">語言</span>
                      <span className="text-sm font-medium text-gray-800 truncate">{editLanguages || '—'}</span>
                    </div>
                    <div className="col-span-2 flex items-start gap-2 pt-1 border-t border-gray-100">
                      <Award className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                      <span className="text-xs text-gray-500 shrink-0">證照</span>
                      <div className="flex flex-wrap gap-1">
                        {editCertifications ? editCertifications.split(/[,、;，\n–—]/).filter(s => s.trim()).map((s, i) => (
                          <span key={i} className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs">{s.trim().replace(/^\*\*|\*\*$/g, '')}</span>
                        )) : <span className="text-xs text-gray-400">—</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="text-xs text-gray-500">目前薪資</span>
                      <span className="text-sm font-medium text-gray-800">{editCurrentSalary || '—'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="text-xs text-gray-500">期望薪資</span>
                      <span className="text-sm font-medium text-gray-800">{editExpectedSalary || '—'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="text-xs text-gray-500">到職時間</span>
                      <span className="text-sm font-medium text-gray-800">{editNoticePeriod || '—'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="text-xs text-gray-500">管理經驗</span>
                      <span className="text-sm font-medium text-gray-800">
                        {editManagement ? `有${editTeamSize ? `（${editTeamSize}）` : ''}` : (editTeamSize || '—')}
                      </span>
                    </div>
                    {/* Phase 3 動機與交易條件 */}
                    <div className="col-span-2 pt-2 border-t border-gray-200">
                      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">動機與交易條件</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Target className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="text-xs text-gray-500">求職狀態</span>
                      {editJobSearchStatus ? (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          editJobSearchStatus === '主動求職' ? 'bg-green-50 text-green-700' :
                          editJobSearchStatus === '被動觀望' ? 'bg-amber-50 text-amber-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>{editJobSearchStatus}</span>
                      ) : <span className="text-sm font-medium text-gray-400">—</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="text-xs text-gray-500">動機</span>
                      <span className="text-sm font-medium text-gray-800">{editMotivation || '—'}</span>
                    </div>
                    <div className="col-span-2 flex items-start gap-2">
                      <FileText className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                      <span className="text-xs text-gray-500 shrink-0">轉職原因</span>
                      <span className="text-sm text-gray-800">{editReasonForChange || '—'}</span>
                    </div>
                    <div className="col-span-2 flex items-start gap-2">
                      <AlertCircle className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                      <span className="text-xs text-gray-500 shrink-0">不適配條件</span>
                      <span className={`text-sm ${editDealBreakers ? 'text-red-700' : 'text-gray-400'}`}>{editDealBreakers || '—'}</span>
                    </div>
                    <div className="col-span-2 flex items-start gap-2">
                      <Star className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                      <span className="text-xs text-gray-500 shrink-0">競爭 Offer</span>
                      <span className={`text-sm font-medium ${editCompetingOffers ? 'text-amber-700' : 'text-gray-400'}`}>{editCompetingOffers || '—'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="text-xs text-gray-500">顧問關係</span>
                      {editRelationshipLevel ? (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          editRelationshipLevel === '深度信任' ? 'bg-green-50 text-green-700' :
                          editRelationshipLevel === '已建立關係' ? 'bg-blue-50 text-blue-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>{editRelationshipLevel}</span>
                      ) : <span className="text-sm font-medium text-gray-400">—</span>}
                    </div>
                    {editConsultantNote && (
                      <div className="col-span-2 mt-1 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                        <div className="flex items-center gap-1 mb-1">
                          <FileText className="w-3 h-3 text-amber-600" />
                          <span className="text-[10px] font-semibold text-amber-600 uppercase">顧問備註</span>
                        </div>
                        <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{editConsultantNote}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>


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

                {/* 作品集 */}
                <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <svg className="w-5 h-5 text-purple-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-500 mb-1">作品集</div>
                    {editingPortfolio ? (
                      <div className="flex items-center gap-2">
                        <input
                          value={portfolioInput}
                          onChange={e => setPortfolioInput(e.target.value)}
                          placeholder="https://portfolio.example.com"
                          className="flex-1 border border-purple-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                          autoFocus
                        />
                        <button onClick={handleSavePortfolio} disabled={savingPortfolio} className="text-xs px-2 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-60">儲存</button>
                        <button onClick={() => { setEditingPortfolio(false); setPortfolioInput((candidate as any).portfolioUrl || (candidate as any).portfolio_url || ''); }} className="text-xs px-2 py-1 border border-slate-200 rounded text-slate-600 hover:bg-slate-50">取消</button>
                      </div>
                    ) : portfolioInput ? (
                      <div className="flex items-center gap-2">
                        <a href={portfolioInput} target="_blank" rel="noopener noreferrer"
                          className="text-sm font-medium text-purple-600 hover:underline truncate flex-1">
                          {portfolioInput}
                        </a>
                        <button onClick={() => setEditingPortfolio(true)} className="text-xs px-2 py-0.5 border border-purple-200 rounded text-purple-600 hover:bg-purple-100 shrink-0">編輯</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-400 italic flex-1">未設定</span>
                        <button onClick={() => setEditingPortfolio(true)} className="text-xs px-2 py-0.5 border border-purple-200 rounded text-purple-600 hover:bg-purple-100 shrink-0">+ 新增</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 📄 履歷 PDF 附件 */}
              <div className="bg-gradient-to-br from-rose-50 to-pink-50 border border-rose-200 rounded-xl p-3 sm:p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Upload className="w-4 h-4 text-rose-500" />
                    <h3 className="text-xs sm:text-sm font-bold text-rose-800">履歷附件</h3>
                    <span className="text-[10px] text-rose-400 font-normal">PDF，最多 3 份</span>
                  </div>
                  <span className="text-[10px] text-rose-400 font-medium">{resumeFiles.length}/3</span>
                </div>

                {/* 拖放 / 選擇上傳區域 */}
                {resumeFiles.length < 3 && (
                  <div
                    onDragOver={handleResumeDragOver}
                    onDragLeave={handleResumeDragLeave}
                    onDrop={handleResumeDrop}
                    onClick={() => !uploadingResume && resumeInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-lg p-3 sm:p-4 text-center cursor-pointer transition-colors ${
                      isDraggingResume
                        ? 'border-rose-400 bg-rose-100/50'
                        : 'border-rose-200 hover:border-rose-300 hover:bg-rose-100/30'
                    }`}
                  >
                    {uploadingResume ? (
                      <div className="space-y-2">
                        <div className="text-xs sm:text-sm text-rose-600 font-medium">上傳中... {uploadProgress}%</div>
                        <div className="w-full bg-rose-200 rounded-full h-1.5">
                          <div className="bg-rose-500 h-1.5 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                        </div>
                      </div>
                    ) : (
                      <>
                        <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-rose-300 mx-auto mb-1" />
                        <div className="text-[10px] sm:text-xs text-gray-500">
                          拖放 PDF 至此，或<span className="text-rose-500 font-medium">點擊選擇</span>
                        </div>
                        <div className="text-[10px] text-gray-400 mt-0.5">最大 10MB</div>
                      </>
                    )}
                    <input
                      ref={resumeInputRef}
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleResumeUpload(file);
                        e.target.value = '';
                      }}
                    />
                  </div>
                )}

                {/* 已上傳檔案列表 */}
                {resumeFiles.length > 0 && (
                  <div className="space-y-1.5">
                    {resumeFiles.map((rf) => (
                      <div key={rf.id} className="flex items-center gap-2 p-2 sm:p-2.5 bg-white/80 rounded-lg border border-rose-200">
                        <FileText className="w-4 h-4 text-rose-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs sm:text-sm text-gray-800 truncate" title={rf.filename}>{rf.filename}</div>
                          <div className="text-[10px] text-gray-400">
                            {(rf.size / 1024).toFixed(0)} KB · {rf.uploaded_by} · {new Date(rf.uploaded_at).toLocaleDateString('zh-TW')}
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                          <button onClick={() => handlePreviewResume(rf.id)} title="預覽" className="p-1 sm:p-1.5 text-rose-500 hover:bg-rose-100 rounded transition-colors">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDownloadResume(rf.id)} title="下載" className="p-1 sm:p-1.5 text-rose-500 hover:bg-rose-100 rounded transition-colors">
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDeleteResume(rf.id)} title="刪除" className="p-1 sm:p-1.5 text-red-400 hover:bg-red-100 rounded transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 自傳 */}
              <div className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📝</span>
                    <h3 className="text-sm font-bold text-orange-800">自傳 / 自我介紹</h3>
                  </div>
                  {!editingBio && (
                    <button onClick={() => setEditingBio(true)} className="text-xs px-3 py-1.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 shadow-sm transition-all">
                      {bioInput ? '✏️ 編輯' : '+ 新增自傳'}
                    </button>
                  )}
                </div>
                {editingBio ? (
                  <div className="space-y-2">
                    <textarea
                      value={bioInput}
                      onChange={e => setBioInput(e.target.value)}
                      placeholder="輸入人選的自傳或自我介紹..."
                      rows={6}
                      className="w-full border border-orange-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 resize-y bg-white"
                    />
                    <div className="flex justify-end gap-2">
                      <button onClick={() => { setEditingBio(false); setBioInput((candidate as any).biography || ''); }} className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-white transition-all">取消</button>
                      <button onClick={handleSaveBio} disabled={savingBio} className="text-xs px-3 py-1.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-60 shadow-sm">
                        {savingBio ? '儲存中...' : '💾 儲存'}
                      </button>
                    </div>
                  </div>
                ) : bioInput ? (
                  <div className="bg-white/80 border border-orange-100 rounded-lg p-4">
                    <pre className="whitespace-pre-wrap text-sm text-slate-700 font-sans leading-relaxed max-h-[200px] overflow-y-auto">{bioInput}</pre>
                  </div>
                ) : (
                  <div className="text-sm text-orange-400 italic p-3 bg-white/60 rounded-lg border border-dashed border-orange-200 text-center">
                    尚未填寫自傳，點擊右上角「+ 新增自傳」開始編輯
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
              
              {/* 顧問 5 維度評估 + 雷達圖 */}
              <div className="bg-emerald-50/50 rounded-lg border border-emerald-200">
                <div className="flex items-center justify-between p-3 border-b border-emerald-100">
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">顧問評估</span>
                  </div>
                  {!editingEval ? (
                    <button onClick={() => {
                      // 開始評估時，自動預填系統可算的 3 維度（若尚未填過）
                      const auto = computeAutoScores({ candidate, targetJob: null });
                      setConsultEval(prev => ({
                        ...auto,
                        ...prev, // 已有值的不覆蓋
                        // 確保 overallRating 同步
                        overallRating: prev.overallRating || computeOverallRating({ ...auto, ...prev }),
                      }));
                      setEditingEval(true);
                    }} className="text-xs px-2 py-1 border border-emerald-200 rounded text-emerald-600 hover:bg-emerald-100">
                      {consultEval.overallRating ? '✏️ 修改' : '+ 評估'}
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        disabled={savingEval}
                        onClick={async () => {
                          setSavingEval(true);
                          try {
                            const evalData = {
                              ...consultEval,
                              overallRating: consultEval.overallRating || computeOverallRating(consultEval),
                              evaluatedBy: currentUserName || 'system',
                              evaluatedAt: new Date().toISOString(),
                            };
                            await apiPatch(`/api/candidates/${candidate.id}`, {
                              consultant_evaluation: evalData,
                              actor: currentUserName || 'system',
                            });
                            setConsultEval(evalData);
                            setEditingEval(false);
                          } catch { toast.error('儲存評估失敗'); } finally { setSavingEval(false); }
                        }}
                        className="text-xs px-2 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-60"
                      >
                        {savingEval ? '儲存中...' : '儲存'}
                      </button>
                      <button onClick={() => { setEditingEval(false); setConsultEval(candidate.consultantEvaluation || {}); }} className="text-xs px-2 py-1 border border-gray-200 rounded text-gray-600 hover:bg-white">取消</button>
                    </div>
                  )}
                </div>
                <div className="p-3">
                  {editingEval ? (
                    <div className="space-y-3">
                      {/* 自動預填維度（綠色標籤） */}
                      <div className="text-[10px] text-emerald-600 bg-emerald-50 rounded px-2 py-1 border border-emerald-100">
                        🤖 技術深度、穩定度、產業匹配已由系統自動預填，可手動調整
                      </div>
                      {RADAR_DIMENSIONS.map(dim => (
                        <div key={dim.key} className="flex items-center gap-3">
                          <span className={`text-xs w-16 shrink-0 ${dim.auto ? 'text-gray-600' : 'text-amber-700 font-semibold'}`}>
                            {dim.label}
                            {!dim.auto && <span className="text-amber-500 ml-0.5">*</span>}
                          </span>
                          <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map(v => (
                              <button
                                key={v}
                                onClick={() => setConsultEval(prev => ({ ...prev, [dim.key]: v }))}
                                className={`w-7 h-7 rounded-full text-xs font-medium transition-all ${
                                  ((consultEval[dim.key] as number) || 0) >= v
                                    ? dim.auto ? 'bg-emerald-500 text-white shadow-sm' : 'bg-amber-500 text-white shadow-sm'
                                    : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                }`}
                              >
                                {v}
                              </button>
                            ))}
                          </div>
                          <span className="text-[10px] text-gray-400 hidden sm:inline">{dim.description}</span>
                        </div>
                      ))}
                      {/* 手動維度提醒 */}
                      {(!consultEval.communication || !consultEval.personality) && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                          <span className="text-xs text-amber-700">
                            <b>溝通能力</b>與<b>個性/態度</b>需面談後填寫，直接影響匹配準確度
                          </span>
                        </div>
                      )}
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">
                          顧問總評（1-5）
                          <span className="text-[10px] text-gray-400 ml-1">
                            — 建議值：{computeOverallRating(consultEval) || '—'}
                          </span>
                        </label>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map(v => (
                            <button
                              key={v}
                              onClick={() => setConsultEval(prev => ({ ...prev, overallRating: v }))}
                              className={`w-8 h-8 rounded-lg text-sm font-bold transition-all ${
                                (consultEval.overallRating || 0) >= v
                                  ? 'bg-amber-400 text-white shadow-sm'
                                  : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                              }`}
                            >
                              {v}
                            </button>
                          ))}
                          <span className="text-xs text-gray-400 ml-2 self-center">
                            {consultEval.overallRating === 5 ? '頂尖' : consultEval.overallRating === 4 ? '優秀' : consultEval.overallRating === 3 ? '合格' : consultEval.overallRating === 2 ? '待加強' : consultEval.overallRating === 1 ? '不適合' : ''}
                          </span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">評語（選填）</label>
                        <textarea
                          value={consultEval.comment || ''}
                          onChange={e => setConsultEval(prev => ({ ...prev, comment: e.target.value }))}
                          rows={2}
                          placeholder="對此人選的整體印象..."
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
                        />
                      </div>
                    </div>
                  ) : consultEval.overallRating || consultEval.technicalDepth ? (
                    <div className="flex gap-4 items-start">
                      {/* 雷達圖 */}
                      <RadarChart evaluation={consultEval} size={180} />
                      {/* 分數 + 資訊 */}
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <Star className="w-4 h-4 text-amber-500" />
                          <span className="text-sm font-bold text-amber-600">{consultEval.overallRating || computeOverallRating(consultEval)}/5</span>
                          <span className="text-xs text-gray-500">總評</span>
                          {consultEval.evaluatedBy && (
                            <span className="text-[10px] text-gray-400 ml-auto">by {consultEval.evaluatedBy}</span>
                          )}
                        </div>
                        {RADAR_DIMENSIONS.map(dim => {
                          const val = (consultEval[dim.key] as number) || 0;
                          return (
                            <div key={dim.key} className="flex items-center gap-2">
                              <span className="text-[10px] text-gray-500 w-12">{dim.shortLabel}</span>
                              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    val >= 4 ? 'bg-emerald-500' : val >= 3 ? 'bg-blue-500' : val >= 2 ? 'bg-amber-400' : val > 0 ? 'bg-red-400' : 'bg-gray-200'
                                  }`}
                                  style={{ width: `${(val / 5) * 100}%` }}
                                />
                              </div>
                              <span className={`text-xs font-bold w-4 text-right ${
                                val === 0 ? 'text-amber-400' : val >= 4 ? 'text-emerald-600' : 'text-gray-600'
                              }`}>
                                {val || '—'}
                              </span>
                              {!dim.auto && val === 0 && (
                                <span className="text-[9px] text-amber-500 font-medium">待填</span>
                              )}
                            </div>
                          );
                        })}
                        {consultEval.comment && (
                          <div className="text-xs text-gray-600 bg-white/50 rounded p-2 mt-1 border border-gray-100">{consultEval.comment}</div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <div className="text-xs text-gray-400 mb-2">尚未評估，點擊右上角開始</div>
                      <div className="text-[10px] text-emerald-500">系統將自動預填技術深度、穩定度、產業匹配 3 項</div>
                    </div>
                  )}
                </div>
              </div>

              {/* 🎙 語音評估 */}
              <div className="bg-violet-50/50 rounded-lg border border-violet-200">
                <div className="flex items-center justify-between p-3 border-b border-violet-100">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🎙</span>
                    <span className="text-sm font-bold text-violet-800">語音評估</span>
                    {(() => {
                      const vas: any[] = (candidate as any).voiceAssessments || (candidate as any).voice_assessments || [];
                      return vas.length > 0 ? <span className="text-[10px] px-1.5 py-0.5 bg-violet-100 text-violet-600 rounded-full font-medium">{vas.length} 筆</span> : null;
                    })()}
                  </div>
                  <button
                    onClick={() => setShowAddVoice(!showAddVoice)}
                    className="text-xs px-2 py-1 border border-violet-200 rounded text-violet-600 hover:bg-violet-100"
                  >
                    {showAddVoice ? '取消' : '+ 新增'}
                  </button>
                </div>
                <div className="p-3 space-y-3">
                  {/* 新增表單 */}
                  {showAddVoice && (
                    <div className="bg-white rounded-lg border border-violet-200 p-3 space-y-2">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">音檔 URL（選填）</label>
                        <input
                          value={voiceAudioUrl}
                          onChange={e => setVoiceAudioUrl(e.target.value)}
                          placeholder="https://... 音檔連結"
                          className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-violet-400"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">分析結果 *</label>
                        <textarea
                          value={voiceAnalysis}
                          onChange={e => setVoiceAnalysis(e.target.value)}
                          placeholder="貼上 OpenClaw 的語音分析結果..."
                          rows={4}
                          className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-violet-400 resize-y"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button onClick={() => { setShowAddVoice(false); setVoiceAudioUrl(''); setVoiceAnalysis(''); }} className="text-xs px-3 py-1.5 border border-slate-200 rounded text-slate-600 hover:bg-slate-50">取消</button>
                        <button
                          onClick={handleAddVoiceAssessment}
                          disabled={savingVoice || !voiceAnalysis.trim()}
                          className="text-xs px-3 py-1.5 bg-violet-600 text-white rounded hover:bg-violet-700 disabled:opacity-60"
                        >
                          {savingVoice ? '儲存中...' : '儲存評估'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 歷史記錄 */}
                  {(() => {
                    const vas: any[] = (candidate as any).voiceAssessments || (candidate as any).voice_assessments || [];
                    if (vas.length === 0) return (
                      <div className="text-center py-4">
                        <div className="text-xs text-gray-400">尚無語音評估記錄</div>
                        <div className="text-[10px] text-violet-400 mt-1">可透過 OpenClaw AI 分析後上傳，或手動新增</div>
                      </div>
                    );
                    return vas.map((va: any) => {
                      const isExpanded = expandedVoiceId === va.id;
                      const scores = va.scores;
                      return (
                        <div key={va.id} className="bg-white rounded-lg border border-violet-100 overflow-hidden">
                          <div
                            className="flex items-center gap-3 p-3 cursor-pointer hover:bg-violet-50/50"
                            onClick={() => setExpandedVoiceId(isExpanded ? null : va.id)}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500">{va.created_at ? new Date(va.created_at).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '未知時間'}</span>
                                <span className="text-xs text-violet-500 font-medium">{va.evaluator || '系統'}</span>
                                {scores?.overall && (
                                  <span className="text-xs px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded font-bold">{scores.overall}/10</span>
                                )}
                              </div>
                              <div className="text-sm text-gray-700 truncate mt-0.5">{(va.analysis || '').slice(0, 80)}{(va.analysis || '').length > 80 ? '...' : ''}</div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {va.audio_url && <span className="text-violet-400 text-xs">🔊</span>}
                              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            </div>
                          </div>
                          {isExpanded && (
                            <div className="border-t border-violet-100 p-3 space-y-2 bg-violet-50/30">
                              {/* 音檔播放 */}
                              {va.audio_url && (
                                <div>
                                  <div className="text-xs text-gray-500 mb-1">音檔</div>
                                  <audio controls src={va.audio_url} className="w-full h-8" preload="none" />
                                </div>
                              )}
                              {/* 評分 */}
                              {scores && (
                                <div>
                                  <div className="text-xs text-gray-500 mb-1">評分</div>
                                  <div className="flex flex-wrap gap-2">
                                    {scores.fluency != null && <span className="text-xs px-2 py-1 bg-white rounded border border-violet-100">流暢度 <b>{scores.fluency}</b>/10</span>}
                                    {scores.terminology != null && <span className="text-xs px-2 py-1 bg-white rounded border border-violet-100">專業度 <b>{scores.terminology}</b>/10</span>}
                                    {scores.logic != null && <span className="text-xs px-2 py-1 bg-white rounded border border-violet-100">邏輯性 <b>{scores.logic}</b>/10</span>}
                                    {scores.confidence != null && <span className="text-xs px-2 py-1 bg-white rounded border border-violet-100">自信度 <b>{scores.confidence}</b>/10</span>}
                                    {scores.overall != null && <span className="text-xs px-2 py-1 bg-violet-200 rounded border border-violet-300 font-bold text-violet-800">綜合 {scores.overall}/10</span>}
                                  </div>
                                </div>
                              )}
                              {/* 分析文字 */}
                              {va.analysis && (
                                <div>
                                  <div className="text-xs text-gray-500 mb-1">分析結果</div>
                                  <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans leading-relaxed bg-white rounded p-2 border border-gray-100 max-h-[300px] overflow-y-auto">{va.analysis}</pre>
                                </div>
                              )}
                              {/* 轉錄文字 */}
                              {va.transcript && (
                                <div>
                                  <div className="text-xs text-gray-500 mb-1">轉錄文字</div>
                                  <pre className="whitespace-pre-wrap text-xs text-gray-600 font-sans leading-relaxed bg-white rounded p-2 border border-gray-100 max-h-[200px] overflow-y-auto">{va.transcript}</pre>
                                </div>
                              )}
                              {/* 刪除 */}
                              <div className="flex justify-end">
                                <button onClick={() => handleDeleteVoice(va.id)} className="text-xs text-red-400 hover:text-red-600">刪除此筆</button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    });
                  })()}
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
                      <textarea value={workForm.description} onChange={e => setWorkForm(p => ({...p, description: e.target.value}))} rows={4} placeholder="主要負責的專案、技術棧、成就..." className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y min-h-[80px]" />
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
                            <label className="block text-xs text-gray-500 mb-1">工作描述</label>
                            <textarea value={workForm.description} onChange={e => setWorkForm(p => ({...p, description: e.target.value}))} rows={4} placeholder="主要負責的專案、技術棧、成就..." className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y min-h-[80px]" />
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
                      {/* 快速原因按鈕 */}
                      {(() => {
                        const quickReasons: Record<string, string[]> = {
                          '聯繫階段': [
                            '已加人選 LinkedIn 待回覆',
                            '已發送 InMail 待回覆',
                            '已電話聯繫，人選有興趣',
                            '已電話聯繫，人選考慮中',
                            '已 LINE 聯繫待回覆',
                            '已 Email 寄出待回覆',
                            '人選已讀未回，擇日再聯繫',
                          ],
                          '面試階段': [
                            '已安排客戶面試',
                            '第一輪面試完成，等待回饋',
                            '第二輪面試安排中',
                            '技術測驗已送出',
                            '面試順利，客戶評價正面',
                            '面試後人選需要考慮',
                          ],
                          'Offer': [
                            '客戶已發 Offer',
                            'Offer 條件確認中',
                            '人選正在評估 Offer',
                            '薪資議價中',
                            'Counter Offer 處理中',
                          ],
                          'on board': [
                            '人選已確認到職日',
                            '已完成入職手續',
                            '已正式到職',
                          ],
                          '婉拒': [
                            '人選婉拒 — 薪資不符',
                            '人選婉拒 — 接受其他 Offer',
                            '人選婉拒 — 不想換工作',
                            '人選婉拒 — 工作內容不符',
                            '人選婉拒 — 地點不方便',
                            '客戶端婉拒 — 技術不符',
                            '客戶端婉拒 — 文化不符',
                            '客戶端婉拒 — 薪資預算不符',
                          ],
                          '備選人才': [
                            '暫不適合目前職缺，保持聯繫',
                            '技能接近但經驗不足，列入備選',
                            '人選暫時不看機會，未來跟進',
                          ],
                          'AI推薦': [
                            'AI 評分推薦，待顧問確認',
                            'AI 評分通過，準備聯繫',
                          ],
                          '未開始': [
                            '新匯入人選，待分配顧問',
                            '待 AI 評分',
                            '資料補充中',
                          ],
                        };
                        const reasons = quickReasons[newProgressEvent] || [];
                        if (reasons.length === 0) return null;
                        return (
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-2">
                              ⚡ 快速選擇原因
                            </label>
                            <div className="flex flex-wrap gap-1.5">
                              {reasons.map(reason => (
                                <button
                                  key={reason}
                                  onClick={() => {
                                    setNewProgressNote(prev => prev ? `${prev}；${reason}` : reason);
                                  }}
                                  className={`text-xs px-2.5 py-1.5 rounded-full border transition-colors ${
                                    newProgressNote.includes(reason)
                                      ? 'bg-blue-100 border-blue-400 text-blue-700'
                                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600'
                                  }`}
                                >
                                  {reason}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })()}

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          備註原因{newProgressNote ? '' : '（必填）'}
                        </label>
                        <textarea
                          value={newProgressNote}
                          onChange={(e) => setNewProgressNote(e.target.value)}
                          placeholder="輸入原因，或點選上方快速按鈕..."
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
                          disabled={!newProgressNote.trim()}
                          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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

          {activeTab === 'ai_summary' && (() => {
            const c = enrichedCandidate;
            const skillsArr: string[] = Array.isArray(c.skills)
              ? c.skills
              : (c.skills || '').split(/[,、]+/).map(s => s.trim()).filter(Boolean);

            // 從工作經歷取得現職：優先用最新一筆 workHistory，否則用 c.position
            const latestWork = (c.workHistory || [])[0];
            const currentPosition = latestWork
              ? `${latestWork.title || ''}${latestWork.company ? ` @ ${latestWork.company}` : ''}`
              : (c.position || '');

            // 一句話定位
            const parts: string[] = [];
            if (c.years) parts.push(`${c.years}年`);
            if (c.industry) parts.push(c.industry);
            if (currentPosition) parts.push(currentPosition);
            if (c.managementExperience && c.teamSize) parts.push(`管理 ${c.teamSize} 團隊`);
            else if (c.managementExperience) parts.push('具管理經驗');
            const oneLiner = parts.length > 0 ? parts.join(' ') : currentPosition || '資料不足';

            // 組裝 AI 提示詞
            const generateAiPrompt = () => {
              const wh = c.workHistory || [];
              // 🐛 Fix: w.period 可能為空，改用 w.start + w.end 組合
              const workHistoryText = wh.map((w: any, i: number) => {
                const period = w.period || [w.start, w.end].filter(Boolean).join(' ~ ') || '時間不詳';
                return `${i + 1}. ${w.company || ''} — ${w.title || ''} (${period})${w.description ? '\n   ' + w.description : ''}`;
              }).join('\n');

              // 從工作經歷智慧補全空白基本資料
              const latestW = wh[0];
              const inferredPosition = currentPosition || (latestW ? `${latestW.title || ''} @ ${latestW.company || ''}` : '');
              const inferredIndustry = c.industry || '';
              // 從工作描述中提取可能的技能關鍵字
              const allDescriptions = wh.map((w: any) => w.description || '').join(' ');
              const inferredSkillsNote = skillsArr.length === 0 && allDescriptions.length > 20
                ? `\n（⚡ 技能欄未填，但工作經歷描述中包含以下內容可供推斷技能：「${allDescriptions.substring(0, 300)}...」）`
                : '';

              // 🐛 Fix: 自傳去重（有時 biography 內容會重複）
              let biographyText = c.biography || '';
              if (biographyText.length > 100) {
                const half = Math.floor(biographyText.length / 2);
                const firstHalf = biographyText.substring(0, half);
                const secondHalf = biographyText.substring(half);
                if (firstHalf === secondHalf) biographyText = firstHalf;
              }

              // 🐛 Fix: 證照清除 markdown
              const certsText = c.certifications ? c.certifications.replace(/\*\*/g, '') : '';

              // 🆕 語音評估完整帶入
              const voiceAssessmentText = (() => {
                const va: VoiceAssessment[] = c.voiceAssessments || [];
                if (va.length === 0) return '❌ 尚無面談評估紀錄';
                return va.map((v, i) => {
                  let line = `${i + 1}. [${v.created_at || ''}] 面談者：${v.evaluator || '未知'}`;
                  if (v.scores) {
                    const s = v.scores;
                    line += ` ｜評分：流暢度 ${s.fluency || '?'}/10、專業術語 ${s.terminology || '?'}/10、邏輯性 ${s.logic || '?'}/10、自信度 ${s.confidence || '?'}/10、綜合 ${s.overall || '?'}/10`;
                  }
                  if (v.analysis) line += `\n   AI 分析：${v.analysis.substring(0, 300)}`;
                  if (v.transcript) line += `\n   轉錄摘要：${v.transcript.substring(0, 200)}...`;
                  return line;
                }).join('\n');
              })();

              // 🆕 顧問評估五維度雷達圖資料
              const evalData = consultEval || {};
              const radarText = (evalData.technicalDepth || evalData.stability || evalData.communication || evalData.personality || evalData.industryMatch)
                ? `### 顧問評估（五維度雷達圖）
- 技術深度：${evalData.technicalDepth || '未評'}/5
- 穩定度：${evalData.stability || '未評'}/5
- 產業匹配：${evalData.industryMatch || '未評'}/5
- 溝通能力：${evalData.communication || '未評'}/5（${evalData.communication ? '顧問手動評估' : '待面談填寫'}）
- 個性/態度：${evalData.personality || '未評'}/5（${evalData.personality ? '顧問手動評估' : '待面談填寫'}）
- 綜合評分：${evalData.overallRating || '未評'}/5
${evalData.comment ? `- 顧問評語：${evalData.comment}` : ''}`
                : '';

              // 🆕 目標職缺深度資訊
              const targetJobSection = targetJobId
                ? `
## 🎯 目標職缺詳細資訊
請先呼叫以下 API 獲取目標職缺完整資料：
\`\`\`
GET https://backendstep1ne.zeabur.app/api/jobs/${targetJobId}
\`\`\`

取得資料後，請特別注意以下欄位（如有值）：
- **客戶送人條件**（submission_criteria）：⚠️ 顧問注意：以上條件為客戶要求，分析時需逐條比對人選是否符合。不完全符合仍可推薦，但需在報告中明確標示差距讓顧問自行判斷。
- **面試階段數**（interview_stages）+ **各階段說明**（interview_stage_detail）：⚠️ 請在行動建議中提醒顧問此職缺面試階段，協助人選做好準備。
- **淘汰條件**（rejection_criteria）：⛔ 若人選觸及淘汰條件，需明確警告。
- **薪資範圍**（salary_min ~ salary_max）：用於和人選的期望薪資做數字比對。
- **必備技能**（key_skills）、語言要求、經驗要求、學歷要求、特殊條件
- **JD 摘要**（job_description 前 500 字）
`
                : '';

              // 🆕 穩定性數據改進（避免 0 值誤導）
              const jobChanges = c.jobChanges || wh.length;
              const avgTenure = jobChanges > 0 ? (c.years / jobChanges).toFixed(1) : '0';

              return `你是一位擁有 10 年以上經驗的資深獵頭顧問 AI 助手，專精人才評估與職缺匹配分析。

⚠️ 重要規則：
- 你「只能」使用下方提供的候選人資料進行分析，嚴禁自行編造、猜測或補充任何未提供的資訊
- 如果某個欄位標示「❌ 未填」，但工作經歷中有相關線索，你可以標註「根據工作經歷推斷：...」來輔助分析，但必須明確區分「已確認資料」vs「推斷資料」
- 如果完全無法推斷，請標註「資料不足，無法判斷」，不要自行編造
- 工作經歷是本次分析的核心資料來源，請仔細閱讀每一段工作描述
- 所有分析結論都必須能追溯到下方提供的具體資料
- 請以繁體中文回覆

---

## Step 1：獲取系統職缺資料
請先呼叫以下 API 獲取目前所有開放的職缺：
\`\`\`
GET https://backendstep1ne.zeabur.app/api/jobs
\`\`\`
${targetJobSection}
---

## Step 2：候選人完整資料（以下為唯一事實來源）

### 基本資訊
- 姓名：${c.name || '❌ 未填'}
- 現職：${inferredPosition || '❌ 未填'}
- 總年資：${c.years ? `${c.years} 年` : '❌ 未填'}
- 學歷：${c.education || '❌ 未填'}
- 所在地：${c.location || '❌ 未填'}
- 產業：${inferredIndustry || '❌ 未填（請從工作經歷的公司與職稱推斷）'}
- 年齡：${c.age ? `${c.age} 歲` : '❌ 未填'}

### 技能
${skillsArr.length > 0 ? skillsArr.join('、') : '❌ 未填（請從工作經歷描述中提取關鍵技能）'}${inferredSkillsNote}

### 語言 & 證照
- 語言能力：${c.languages || '❌ 未填'}
- 證照：${certsText || '❌ 未填'}

### 管理經驗
- 有管理經驗：${c.managementExperience ? '是' : '否'}
${c.managementExperience && c.teamSize ? `- 團隊規模：${c.teamSize}` : ''}

### 薪資 & 到職
- 目前薪資：${c.currentSalary || '❌ 未填'}
- 期望薪資：${c.expectedSalary || '❌ 未填'}
- 到職時間：${c.noticePeriod || '❌ 未填'}

### 求職動機
- 求職狀態：${c.jobSearchStatus || '❌ 未填'}
- 轉職原因：${c.reasonForChange || '❌ 未填'}
- 主要動機：${c.motivation || '❌ 未填'}
- 不接受條件：${c.dealBreakers || '❌ 未填'}
- 競爭 Offer：${c.competingOffers || '❌ 未填'}

### 顧問備註（顧問與人選實際溝通後的重點記錄，⚠️ 優先參考）
${c.consultantNote || '❌ 無顧問備註'}

### 自傳（候選人自我介紹，⚠️ 重要深度資訊）
${biographyText || '❌ 未填寫自傳'}

### 作品集
${c.portfolioUrl ? `🔗 ${c.portfolioUrl}` : '❌ 無作品集連結'}

${radarText}

### 語音/面談評估紀錄
${voiceAssessmentText}

### 工作經歷（依時間由近到遠）
${workHistoryText || '❌ 無工作經歷資料'}

### 穩定性數據
- 穩定度評分：${c.stabilityScore || '未評估'}
- 換工作次數：${jobChanges} 次
- 平均任期：${avgTenure} 年

${c.aiMatchResult ? `### 系統既有 AI 評分（僅供參考）
- 綜合分數：${c.aiMatchResult.score}
- 推薦等級：${c.aiMatchResult.recommendation}
- 結論：${c.aiMatchResult.conclusion || '無'}
` : ''}
---

## Step 3：分析任務

請根據「Step 2 的人選資料」+「Step 1 取得的系統職缺」完成以下分析。
${targetJobId ? `\n⚠️ 本次分析有指定目標職缺（ID: ${targetJobId}），請特別深度分析此職缺的匹配度，並在 Top 3 中優先放入此職缺。\n` : ''}
📌 分析策略：
- 基本資料如有「❌ 未填」，請優先從「工作經歷」中交叉比對推斷，並標註「（根據工作經歷推斷）」
- 「顧問備註」是顧問與人選實際溝通後的第一手記錄，優先級最高，若與其他欄位矛盾以顧問備註為準
- 工作經歷是最重要的分析依據，請仔細分析每一段的職稱、公司、任期、工作描述
- 從工作經歷的職稱變化判斷職涯發展軌跡（升遷 / 平轉 / 降級）
- 從公司規模與類型推斷產業經驗
- **若有自傳**：務必仔細分析候選人的職涯動機、自我定位、軟實力信號，這是了解候選人內心想法的關鍵資料
- **若有作品集連結**：評估作品與目標職缺的相關性
- **若有語音/面談評估**：參考顧問的第一手觀察（評分和評語），這反映候選人的溝通能力與態度
- **若有顧問五維度評估**：結合雷達圖數據分析人選的整體素質
- 如果完全無法從任何資料推斷，才標註「資料不足」

### 1️⃣ 一句話定位
用一句話精準描述這位候選人的核心價值與市場定位。

### 2️⃣ Top 3 最匹配職缺
從 Step 1 取得的系統職缺中挑出最適合的 3 個，每個說明：
- ✅ 匹配原因（引用具體的技能、年資、產業等資料）
- ⚠️ 可能的落差或風險
- 📊 匹配度評分（0-100）及評分依據
- 📋 送人條件比對：逐條列出該職缺的「客戶送人條件」（submission_criteria），標示人選是否符合（✅/⚠️/❌）
- 🔢 面試流程：列出該職缺需要幾關面試（interview_stages），提醒顧問協助人選準備
- 💰 薪資比對：人選期望薪資 vs 職缺薪資範圍（salary_min ~ salary_max）

### 3️⃣ 能力分析
- 核心優勢：列出 3-5 項（必須基於已提供的技能和工作經歷）
- 能力缺口：相對於匹配職缺缺少什麼？是否可透過短期培訓補足？

### 4️⃣ 自傳與深度資訊洞察（如有自傳/作品集/面談評估）
- 從自傳提取的職涯動機與自我定位
- 軟實力信號（表達力、邏輯性、主動性、團隊合作）
- 作品集展現的實際能力（若有連結）
- 顧問面談觀察摘要（若有評估紀錄）
- 自傳中的期望是否與目標職缺吻合
（若無自傳/作品集/面談紀錄，請標註「尚無深度資訊」並跳過此節）

### 5️⃣ 風險評估
- 穩定性風險（根據換工作次數、平均任期判斷）
- 薪資風險（期望 vs 職缺薪資範圍的數字比對）
- 到職時間風險
- 淘汰條件觸及風險（⛔ 若人選觸及任何職缺的 rejection_criteria，明確標紅警告）
- 其他紅旗（如有，包含自傳中的紅旗信號）

### 6️⃣ 建議顧問提問
提供 5 個針對此候選人應深入了解的問題，分類如下：
- 🔍 技能驗證題（確認關鍵技能的實際深度）
- 💼 行為面試題（過去如何處理困難情境）
- ❤️ 動機探索題（真實轉職原因與期望，可結合自傳內容設計問題）
- ⚠️ 風險確認題（針對履歷中的疑點）

### 7️⃣ 顧問行動建議
給獵頭顧問的具體下一步行動方案（安排面試 / 補充資料 / 先釐清疑點 / 暫不推薦等）
- 若推薦特定職缺，請引用該職缺的送人條件，說明人選符合哪些、不符合哪些
- 提醒顧問此職缺面試共幾關，建議如何協助人選準備各階段面試
- 若有淘汰條件觸及風險，明確標紅警告

---

## Step 4：將分析結果回寫系統 ⚠️ 必做

分析完成後，你**必須**呼叫以下 API 將結果寫入系統：

\`\`\`
PATCH https://backendstep1ne.zeabur.app/api/candidates/${c.id}
Content-Type: application/json

{
  "ai_summary": {
    "one_liner": "一句話定位（20字內精準描述此人核心價值）",
    "top_matches": [
      {
        "job_id": "職缺ID（用於系統連結）",
        "job_title": "最匹配職缺1名稱",
        "company": "公司名",
        "match_score": 85,
        "match_reason": "匹配原因簡述",
        "gaps": "可能落差",
        "submission_check": "送人條件比對摘要",
        "interview_stages": 3
      },
      {
        "job_id": "職缺ID",
        "job_title": "最匹配職缺2名稱",
        "company": "公司名",
        "match_score": 72,
        "match_reason": "匹配原因簡述",
        "gaps": "可能落差",
        "submission_check": "送人條件比對摘要",
        "interview_stages": 0
      },
      {
        "job_id": "職缺ID",
        "job_title": "最匹配職缺3名稱",
        "company": "公司名",
        "match_score": 65,
        "match_reason": "匹配原因簡述",
        "gaps": "可能落差",
        "submission_check": "送人條件比對摘要",
        "interview_stages": 0
      }
    ],
    "strengths": ["核心優勢1", "核心優勢2", "核心優勢3"],
    "risks": ["風險1", "風險2"],
    "salary_risk": "薪資風險評估（人選期望 vs 職缺範圍）",
    "stability_risk": "穩定性風險評估",
    "deep_insight": "從自傳/作品集/面談中提取的深度洞察（若無則設為 null）",
    "suggested_questions": ["建議顧問提問1", "建議顧問提問2", "建議顧問提問3"],
    "next_steps": "顧問行動建議一句話",
    "evaluated_at": "當前 ISO 8601 時間戳",
    "evaluated_by": "AI 模型名稱"
  },
  "actor": "AI-summary"
}
\`\`\`

> ⚠️ \`ai_summary\` 必須是 JSON 物件，不是字串。各欄位說明：
> - \`one_liner\`: 一句話定位（必填）
> - \`top_matches\`: 最匹配的 Top 3 職缺（必填，從 Step 1 取得的職缺中選取，含 job_id + submission_check + interview_stages）
> - \`strengths\`: 核心優勢陣列，3-5 項（必填）
> - \`risks\`: 風險/劣勢陣列，2-4 項（必填）
> - \`salary_risk\`: 薪資風險評估文字（必填）
> - \`stability_risk\`: 穩定性風險評估文字（必填）
> - \`deep_insight\`: 自傳/作品集/面談的深度洞察（若無深度資訊則填 null）
> - \`suggested_questions\`: 建議顧問提問，3-5 題（必填）
> - \`next_steps\`: 行動建議一句話（必填）

**分析結果寫回系統後，再將完整分析報告（含 1️⃣ 到 7️⃣ 所有內容）輸出給顧問閱讀。**`;
            };

            const handleCopyAiPrompt = () => {
              navigator.clipboard.writeText(generateAiPrompt()).then(() => {
                setPromptCopied(true);
                setTimeout(() => setPromptCopied(false), 2500);
              });
            };

            const tagColors = [
              'bg-blue-100 text-blue-700', 'bg-emerald-100 text-emerald-700',
              'bg-amber-100 text-amber-700', 'bg-rose-100 text-rose-700',
              'bg-purple-100 text-purple-700', 'bg-cyan-100 text-cyan-700',
              'bg-indigo-100 text-indigo-700', 'bg-orange-100 text-orange-700',
            ];

            const aiSummaryData = c.aiSummary || null;

            return (
              <div className="space-y-5">

                {/* ━━━ AI 總結結果（AI 回寫後顯示）━━━ */}
                {aiSummaryData && (
                  <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-emerald-600" />
                        <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">🤖 AI 總結分析結果</span>
                      </div>
                      <span className="text-[10px] text-emerald-500">
                        {aiSummaryData.evaluated_by || 'AI'} · {aiSummaryData.evaluated_at ? new Date(aiSummaryData.evaluated_at).toLocaleDateString('zh-TW') : ''}
                      </span>
                    </div>

                    {/* 一句話定位 */}
                    {aiSummaryData.one_liner && (
                      <div className="bg-white/70 rounded-lg p-3">
                        <p className="text-sm font-bold text-slate-800">📌 {aiSummaryData.one_liner}</p>
                      </div>
                    )}

                    {/* Top 匹配職缺 */}
                    {aiSummaryData.top_matches && aiSummaryData.top_matches.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-emerald-600 mb-1.5">🎯 Top 匹配職缺</p>
                        <div className="space-y-1.5">
                          {aiSummaryData.top_matches.map((m: any, i: number) => (
                            <div key={i} className="bg-white/70 rounded-lg px-3 py-2 flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <span className="text-xs font-bold text-slate-700">#{i + 1} {m.job_title}</span>
                                {m.company && <span className="text-xs text-slate-500 ml-1">({m.company})</span>}
                                {m.match_reason && <p className="text-[10px] text-slate-500 mt-0.5 truncate">{m.match_reason}</p>}
                              </div>
                              <span className={`text-sm font-black ml-2 ${m.match_score >= 80 ? 'text-emerald-600' : m.match_score >= 65 ? 'text-blue-600' : 'text-amber-600'}`}>
                                {m.match_score}分
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 優勢 & 風險 */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {aiSummaryData.strengths && aiSummaryData.strengths.length > 0 && (
                        <div className="bg-white/70 rounded-lg p-2.5">
                          <p className="text-xs font-semibold text-emerald-600 mb-1">✅ 核心優勢</p>
                          {aiSummaryData.strengths.map((s: string, i: number) => (
                            <p key={i} className="text-[11px] text-slate-700">• {s}</p>
                          ))}
                        </div>
                      )}
                      {aiSummaryData.risks && aiSummaryData.risks.length > 0 && (
                        <div className="bg-white/70 rounded-lg p-2.5">
                          <p className="text-xs font-semibold text-rose-600 mb-1">⚠️ 風險/待確認</p>
                          {aiSummaryData.risks.map((r: string, i: number) => (
                            <p key={i} className="text-[11px] text-slate-700">• {r}</p>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 深度洞察 */}
                    {aiSummaryData.deep_insight && (
                      <div className="bg-white/70 rounded-lg p-2.5">
                        <p className="text-xs font-semibold text-purple-600 mb-1">🔍 深度洞察（自傳/作品集/面談）</p>
                        <p className="text-[11px] text-slate-700">{aiSummaryData.deep_insight}</p>
                      </div>
                    )}

                    {/* 行動建議 */}
                    {aiSummaryData.next_steps && (
                      <div className="bg-emerald-100/50 rounded-lg p-2.5">
                        <p className="text-xs font-semibold text-emerald-700">💡 行動建議：{aiSummaryData.next_steps}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* ━━━ 一句話定位 ━━━ */}
                <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Brain className="w-4 h-4 text-purple-600" />
                    <span className="text-xs font-semibold text-purple-500 uppercase tracking-wider">一句話定位</span>
                  </div>
                  <p className="text-base sm:text-lg font-bold text-slate-800 leading-relaxed">
                    {oneLiner}
                  </p>
                </div>

                {/* ━━━ 關鍵資訊摘要 ━━━ */}
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-3">
                    <FileText className="w-3 h-3 text-blue-500" /> 關鍵資訊
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: '現職', value: currentPosition },
                      { label: '年資', value: c.years ? `${c.years} 年` : null },
                      { label: '產業', value: c.industry },
                      { label: '學歷', value: c.education },
                      { label: '語言', value: c.languages },
                      { label: '證照', value: c.certifications },
                      { label: '管理經驗', value: c.managementExperience ? (c.teamSize ? `是（${c.teamSize}）` : '是') : '否' },
                      { label: '目前薪資', value: c.currentSalary },
                      { label: '期望薪資', value: c.expectedSalary },
                      { label: '到職時間', value: c.noticePeriod },
                      { label: '求職狀態', value: c.jobSearchStatus },
                      { label: '轉職原因', value: c.reasonForChange },
                    ].filter(item => item.value).map((item, i) => (
                      <div key={i} className="bg-slate-50 border border-slate-100 rounded-lg p-2.5">
                        <span className="text-[10px] text-slate-400 font-medium block">{item.label}</span>
                        <span className="text-xs sm:text-sm text-slate-700 font-medium">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ━━━ 能力標籤 ━━━ */}
                {skillsArr.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-3">
                      <Award className="w-3 h-3 text-emerald-500" /> 能力標籤
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {skillsArr.map((skill, i) => (
                        <span
                          key={i}
                          className={`px-2.5 py-1 rounded-full text-xs font-medium ${tagColors[i % tagColors.length]}`}
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* ━━━ 動機 & 風險 ━━━ */}
                {(c.motivation || c.dealBreakers || c.competingOffers) && (
                  <div>
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-3">
                      <AlertCircle className="w-3 h-3 text-amber-500" /> 動機 & 注意事項
                    </h3>
                    <div className="space-y-2">
                      {c.motivation && (
                        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-800">
                          <span className="font-semibold">主要動機：</span>{c.motivation}
                        </div>
                      )}
                      {c.dealBreakers && (
                        <div className="bg-rose-50 border border-rose-100 rounded-lg p-3 text-xs text-rose-800">
                          <span className="font-semibold">不接受條件：</span>{c.dealBreakers}
                        </div>
                      )}
                      {c.competingOffers && (
                        <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-xs text-amber-800">
                          <span className="font-semibold">競爭 Offer：</span>{c.competingOffers}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ━━━ 複製 AI 分析提示詞 ━━━ */}
                <div className="pt-2 border-t border-slate-100">
                  <button
                    onClick={handleCopyAiPrompt}
                    className={`w-full py-3 px-4 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                      promptCopied
                        ? 'bg-emerald-500 text-white'
                        : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700 shadow-md hover:shadow-lg'
                    }`}
                  >
                    {promptCopied ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        已複製！貼到 ChatGPT / Claude 即可使用
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        複製 AI 分析提示詞
                      </>
                    )}
                  </button>
                  <p className="text-center text-[10px] text-slate-400 mt-2">
                    提示詞包含人選完整資料 + API 端點，AI 會自動獲取職缺並進行匹配分析
                  </p>
                </div>

              </div>
            );
          })()}

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

                {/* ━━━━━ 複製 AI 匹配提示詞 ━━━━━ */}
                {(() => {
                  const c = enrichedCandidate;
                  const latestWork = (c.workHistory || [])[0];
                  const currentPos = latestWork
                    ? `${latestWork.title || ''}${latestWork.company ? ` @ ${latestWork.company}` : ''}`
                    : (c.position || '未填');
                  const candidateSkills = Array.isArray(c.skills)
                    ? c.skills.join('、')
                    : (c.skills || '未填');
                  const workHistoryText = (c.workHistory || []).map((w: any, i: number) =>
                    `${i + 1}. ${w.company || ''} — ${w.title || ''} (${w.period || ''})${w.description ? '\n   ' + w.description : ''}`
                  ).join('\n');

                  const targetJobText = targetJobInput || '未指定目標職缺';

                  const generateMatchPrompt = () => `你是一位擁有 10 年以上經驗的資深獵頭顧問 AI 助手，精通人才評估、職缺匹配與客戶溝通策略。

## 任務
請針對以下候選人與目標職缺，進行深度匹配分析並提供專業顧問建議。

---

## Step 1：獲取目標職缺完整資料
${targetJobId ? `請呼叫以下 API 取得職缺詳細資訊：
\`\`\`
GET https://backendstep1ne.zeabur.app/api/jobs/${targetJobId}
\`\`\`` : `⚠️ 目標職缺：${targetJobText}（未綁定系統職缺，請根據職缺名稱推斷需求）`}

---

## Step 2：候選人完整資料

### 基本資訊
- 現職：${currentPos}
- 總年資：${c.years || '未填'} 年
- 學歷：${c.education || '未填'}
- 所在地：${c.location || '未填'}
- 產業：${c.industry || '未填'}
- 年齡：${c.age ? `${c.age} 歲` : '未填'}
- 性別：${c.gender || '未填'}

### 技能
${candidateSkills}

### 語言 & 證照
- 語言能力：${c.languages || '未填'}
- 證照：${c.certifications || '未填'}

### 管理經驗
- 有管理經驗：${c.managementExperience ? '是' : '否'}
- 團隊規模：${c.teamSize || '未填'}

### 薪資 & 到職
- 目前薪資：${c.currentSalary || '未填'}
- 期望薪資：${c.expectedSalary || '未填'}
- 到職時間：${c.noticePeriod || '未填'}

### 求職動機
- 求職狀態：${c.jobSearchStatus || '未填'}
- 轉職原因：${c.reasonForChange || '未填'}
- 主要動機：${c.motivation || '未填'}
- 不接受條件：${c.dealBreakers || '未填'}
- 競爭 Offer：${c.competingOffers || '未填'}

### 顧問備註（顧問與人選實際溝通後的重點記錄，⚠️ 此為第一手資訊，優先參考）
${c.consultantNote || '無顧問備註'}

### 自傳（候選人自我介紹，⚠️ 重要深度資訊）
${c.biography || '❌ 未填寫自傳'}

### 作品集
${c.portfolioUrl ? `🔗 ${c.portfolioUrl}` : '❌ 無作品集連結'}

### 語音/面談評估紀錄
${(() => {
  const va = c.voiceAssessments || [];
  if (va.length === 0) return '❌ 尚無面談評估紀錄';
  return va.map((v: any, i: number) => `${i + 1}. [${v.date || ''}] 面談者：${v.interviewer || '未知'} ｜評分：${v.score || '?'}/5 ｜評語：${v.notes || '無'}`).join('\n');
})()}

### 工作經歷
${workHistoryText || '無資料'}

### 穩定性分數
- Stability Score：${c.stabilityScore || '未評估'}
- 換工作次數：${c.jobChanges || 0} 次
- 平均任期：${c.avgTenure || 0} 年

---

## Step 3：請完成以下分析（以繁體中文回覆）

📌 分析策略：
- 「顧問備註」為第一手資訊，優先級最高
- **若有自傳**：務必分析候選人的職涯動機、自我定位、軟實力信號，用於評估人才畫像符合度和文化適配
- **若有作品集**：評估作品與目標職缺的技術要求是否相關
- **若有面談評估**：參考顧問的評分和評語，反映候選人的溝通能力與態度
- 有深度資訊的候選人應獲得更精準的評估，沒有的不扣分

### 1️⃣ 匹配度總評（0-100 分）
- 給出總分及各維度評分：技能匹配、經驗匹配、薪資匹配、文化適配、穩定性、深度資訊加分（自傳/作品集/面談）
- 推薦等級：強力推薦 / 推薦 / 觀望 / 不推薦

### 2️⃣ 核心優勢（Strengths）
- 列出 3-5 項此人選相對於目標職缺的核心競爭力
- 說明為什麼這些優勢對該職缺有價值
- 若有自傳/作品集，從中提取額外的優勢亮點

### 3️⃣ 風險與劣勢（Risks & Gaps）
- 列出 3-5 項潛在風險或能力缺口
- 區分「硬傷」（可能導致不錄用）vs「可補足」（可透過培訓或時間補足）
- 穩定性風險評估（離職頻率、任期模式）
- 若自傳中有紅旗信號（如抱怨前雇主、目標不切實際），需在此提出

### 4️⃣ 自傳與深度洞察（如有自傳/作品集/面談評估）
- 從自傳提取的職涯動機與自我定位
- 軟實力信號（表達力、邏輯性、主動性、團隊合作）
- 自傳中的期望是否與目標職缺條件吻合
- 作品集展現的實際能力（若有）
- 顧問面談觀察摘要（若有）
（若無深度資訊，標註「尚無深度資訊」並跳過）

### 5️⃣ 薪資分析
- 人選期望 vs 職缺預算是否匹配
- 如有落差，建議的談判策略

### 6️⃣ 建議顧問提問（Interview Questions）
- 提供 5-8 個針對性問題，分為：
  - 🔍 技能驗證題（驗證關鍵技能的實際深度）
  - 💼 行為面試題（了解過去處理問題的方式）
  - ❤️ 動機探索題（了解真實轉職原因與期望，可結合自傳內容設計問題）
  - ⚠️ 風險確認題（針對履歷中的疑點或風險）

### 7️⃣ 推薦話術（Pitch to Client）
- 如果要向用人主管推薦此人選，請撰寫一段 3-5 句的推薦話術
- 用正面但誠實的語氣，突出核心賣點
- 若有自傳中的關鍵亮點，融入推薦話術中

### 8️⃣ 顧問行動建議（Next Steps）
- 接下來顧問應該做什麼？（安排面試 / 補充資料 / 先釐清疑點 / 暫不推薦等）
- 如果推薦，建議的推薦順序和時間點
- 若有自傳中提到的動機線索，建議如何作為切入點

---

## Step 4：將匹配分析結果回寫系統 ⚠️ 必做

分析完成後，你**必須**呼叫以下 API 將結果寫入系統：

\`\`\`
PATCH https://backendstep1ne.zeabur.app/api/candidates/${c.id}
Content-Type: application/json

{
  "ai_match_result": {
    "score": 匹配度總分(0-100整數),
    "recommendation": "強力推薦|推薦|觀望|不推薦",
    "job_title": "${targetJobInput || '目標職缺名稱'}",
    "matched_skills": ["匹配技能1", "匹配技能2", "匹配技能3"],
    "missing_skills": ["缺少技能1", "缺少技能2"],
    "strengths": ["核心優勢1", "核心優勢2", "核心優勢3"],
    "probing_questions": ["建議提問1", "建議提問2", "建議提問3"],
    "conclusion": "顧問建議一句話，說明切入點與推薦理由",
    "biography_insight": "從自傳提取的洞察（若無自傳設為 null）",
    "portfolio_assessment": "作品集評估（若無設為 null）",
    "voice_summary": "面談評估摘要（若無設為 null）",
    "evaluated_at": "當前 ISO 8601 時間戳",
    "evaluated_by": "AI 模型名稱"
  },
  "actor": "AI-match"
}
\`\`\`

> ⚠️ \`ai_match_result\` 必須是 JSON 物件，不是字串。
> - \`score\` 85-100 → recommendation 填 "強力推薦"
> - \`score\` 70-84 → recommendation 填 "推薦"
> - \`score\` 55-69 → recommendation 填 "觀望"
> - \`score\` < 55 → recommendation 填 "不推薦"

**寫入系統後，再將完整分析報告（含 1️⃣ 到 8️⃣ 所有內容）輸出給顧問閱讀。**`;

                  const handleCopyMatchPrompt = () => {
                    navigator.clipboard.writeText(generateMatchPrompt()).then(() => {
                      setMatchPromptCopied(true);
                      setTimeout(() => setMatchPromptCopied(false), 2500);
                    });
                  };

                  return (
                    <div className="pt-3">
                      <button
                        onClick={handleCopyMatchPrompt}
                        className={`w-full py-3 px-4 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                          matchPromptCopied
                            ? 'bg-emerald-500 text-white'
                            : 'bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:from-violet-700 hover:to-purple-700 shadow-md hover:shadow-lg'
                        }`}
                      >
                        {matchPromptCopied ? (
                          <>
                            <CheckCircle2 className="w-4 h-4" />
                            已複製！貼到 ChatGPT / Claude 即可分析
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            複製 AI 匹配分析提示詞
                          </>
                        )}
                      </button>
                      <p className="text-center text-[10px] text-slate-400 mt-2">
                        針對目標職缺「{targetJobInput || '未指定'}」深度匹配分析 · 含優劣勢、面試問題、推薦話術
                      </p>
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
        candidate={{ ...candidate, consultantEvaluation: consultEval, consultantNote: editConsultantNote, certifications: editCertifications, languages: editLanguages, education: editEducation, industry: editIndustry, currentSalary: editCurrentSalary, expectedSalary: editExpectedSalary, noticePeriod: editNoticePeriod }}
        candidateLabel={`Candidate ${candidate.id}`}
        onClose={() => setShowResumeGen(false)}
        targetJobId={targetJobId}
      />
    )}
    </>
  );
}
