// Step1ne Headhunter System - 候選人詳情 Modal
import React, { useState, useRef } from 'react';
import { Candidate, CandidateStatus, AiMatchResult, JobRankingEntry, ExternalJobSuggestion, ConsultantEvaluation, VoiceAssessment, ResumeFile } from '../types';
import { ResumePreview } from './ResumeGenerator';
import { RadarChart, RADAR_DIMENSIONS, computeAutoScores, computeOverallRating } from './RadarChart';
import { SkillTagInput } from './SkillTagInput';
import { SalaryRangeInput, SalaryRangeDisplay } from './SalaryRangeInput';
import { CANDIDATE_STATUS_CONFIG, GRADE_CONFIG, TIER_CONFIG, computeAutoGradeTier } from '../constants';
import { OnboardingTour, TourStep } from './OnboardingTour';
import { apiPatch, apiGet, getApiUrl, getAuthHeaders, getApiToken, getPublicApiBaseUrl } from '../config/api';
import { toast } from './Toast';
import {
  X, User, Mail, Phone, MapPin, Briefcase, Calendar,
  TrendingUp, Award, FileText, MessageSquare, Clock,
  CheckCircle2, AlertCircle, Bot, Star, ThumbsUp, ThumbsDown,
  HelpCircle, Sparkles, Target, Globe, Trash2, Brain, Copy, ChevronDown,
  Download, Eye, Upload, ChevronRight, AlertTriangle, Building2, Hash, BookOpen,
  BarChart3, Lightbulb, MessageCircle
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
  const [activeTab, setActiveTab] = useState<'info' | 'history' | 'notes' | 'ai_consultant'>('info');
  const [promptCopied, setPromptCopied] = useState(false);
  const [matchPromptCopied, setMatchPromptCopied] = useState(false);
  const [outreachCollapsed, setOutreachCollapsed] = useState(true);
  const [copiedLetterId, setCopiedLetterId] = useState<string | null>(null);
  // 貼上 AI 結果
  const [showPasteAiResult, setShowPasteAiResult] = useState(false);
  const [pasteAiText, setPasteAiText] = useState('');
  const [savingAiResult, setSavingAiResult] = useState(false);
  const [pasteAiError, setPasteAiError] = useState('');
  const [addingProgress, setAddingProgress] = useState(false);
  const [newProgressEvent, setNewProgressEvent] = useState('');
  const [newProgressNote, setNewProgressNote] = useState('');
  const [showInviteMessage, setShowInviteMessage] = useState(false);
  const [showResumeGen, setShowResumeGen] = useState(false);
  const [inviteMessage, setInviteMessage] = useState('');
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [tourActive, setTourActive] = useState(false);

  // 互動式新手導覽步驟
  const modalTourSteps: TourStep[] = [
    { target: 'modal-tabs', title: '五大功能分頁', content: '基本資訊、進度追蹤、備註紀錄、AI 總結、AI 匹配結語 — 點擊切換不同功能面板。', placement: 'bottom' },
    { target: 'modal-recruiter', title: '負責顧問', content: '指派或更換負責此人選的顧問。點「指派給我」可快速認領人選。', placement: 'bottom' },
    { target: 'modal-target-job', title: '目標職缺', content: '為人選指定目標職缺，指定後可自動產生電話篩選腳本與 AI 匹配分析。', placement: 'bottom' },
    { target: 'modal-precision-gate', title: '資料完整度', content: '系統自動檢查 10 項 Match Core 欄位，填寫越完整，AI 匹配精準度越高（目標 80% 以上）。', placement: 'bottom' },
    { target: 'modal-candidate-data', title: '候選人資料', content: '點「✏️ 編輯」進入編輯模式，可修改基本資料、技能、薪資、職位分類等欄位。', placement: 'top' },
    { target: 'modal-work-history', title: '工作經歷 & 學歷', content: '新增或編輯工作經歷與教育背景，這部分影響 AI 評級中 35% 的權重。', placement: 'top' },
    { target: 'modal-update-status', title: '更新狀態', content: '點此按鈕快速切換人選狀態：聯繫階段、面試、Offer、婉拒等，狀態會同步到看板。', placement: 'top' },
  ];
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
  const contentScrollRef = useRef<HTMLDivElement>(null);
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

  // Sprint 2: 結構化欄位 edit states
  const [editCurrentCompany, setEditCurrentCompany] = useState(candidate.currentCompany || '');
  const [editCurrentTitle, setEditCurrentTitle] = useState(candidate.currentTitle || candidate.position || '');
  const [editRoleFamily, setEditRoleFamily] = useState(candidate.roleFamily || '');
  const [editCanonicalRole, setEditCanonicalRole] = useState(candidate.canonicalRole || '');
  const [editSeniorityLevel, setEditSeniorityLevel] = useState(candidate.seniorityLevel || '');
  const [editIndustryTag, setEditIndustryTag] = useState(candidate.industryTag || '');
  const [editNormalizedSkills, setEditNormalizedSkills] = useState<string[]>(() => {
    if (candidate.normalizedSkills && candidate.normalizedSkills.length > 0) return candidate.normalizedSkills;
    // Fallback: parse from skills string
    const raw = candidate.skills;
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string' && raw.trim()) return raw.split(/[,、，]+/).map(s => s.trim()).filter(Boolean);
    return [];
  });
  const [editCurrentSalaryMin, setEditCurrentSalaryMin] = useState(String(candidate.currentSalaryMin ?? ''));
  const [editCurrentSalaryMax, setEditCurrentSalaryMax] = useState(String(candidate.currentSalaryMax ?? ''));
  const [editExpectedSalaryMin, setEditExpectedSalaryMin] = useState(String(candidate.expectedSalaryMin ?? ''));
  const [editExpectedSalaryMax, setEditExpectedSalaryMax] = useState(String(candidate.expectedSalaryMax ?? ''));
  const [editSalaryCurrency, setEditSalaryCurrency] = useState(candidate.salaryCurrency || 'TWD');
  const [editSalaryPeriod, setEditSalaryPeriod] = useState(candidate.salaryPeriod || 'monthly');
  const [editNoticePeriodEnum, setEditNoticePeriodEnum] = useState(candidate.noticePeriodEnum || '');
  const [editJobSearchStatusEnum, setEditJobSearchStatusEnum] = useState(candidate.jobSearchStatusEnum || '');

  // Grade / Source Tier
  const [editGradeLevel, setEditGradeLevel] = useState(candidate.gradeLevel || '');
  const [editSourceTier, setEditSourceTier] = useState(candidate.sourceTier || '');

  // Sprint 2: Collapsible section states
  const [sectionDealOpen, setSectionDealOpen] = useState(false);
  const [sectionSupplementOpen, setSectionSupplementOpen] = useState(false);

  // 新手使用指南（必須在頂層呼叫 useState，不能放在 JSX IIFE 裡）
  const [guideExpanded, setGuideExpanded] = useState(() => !localStorage.getItem('step1ne-candidate-modal-guide'));

  // Sprint 2: Taxonomy data for dropdowns
  const [roleTaxonomy, setRoleTaxonomy] = useState<Record<string, { label: string; canonicalRoles: string[] }>>({});
  const [industryTaxonomy, setIndustryTaxonomy] = useState<Array<{ tag: string; label: string }>>([]);

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

  // Layer 1: Rule-based Grade/Tier auto-suggestion (instant, frontend-only)
  const autoSuggestion = React.useMemo(() => computeAutoGradeTier({
    currentCompany: editCurrentCompany,
    currentTitle: editCurrentTitle,
    roleFamily: editRoleFamily,
    canonicalRole: editCanonicalRole,
    seniorityLevel: editSeniorityLevel,
    totalYears: parseFloat(editYears) || 0,
    normalizedSkills: editNormalizedSkills,
    industryTag: editIndustryTag,
    expectedSalaryMin: editExpectedSalaryMin ? parseInt(editExpectedSalaryMin) : undefined,
    noticePeriodEnum: editNoticePeriodEnum,
    jobSearchStatusEnum: editJobSearchStatusEnum,
    workHistory: workItems,
    dataQuality: candidate.dataQuality,
  }), [editCurrentCompany, editCurrentTitle, editRoleFamily, editCanonicalRole, editSeniorityLevel, editYears, editNormalizedSkills, editIndustryTag, editExpectedSalaryMin, editNoticePeriodEnum, editJobSearchStatusEnum, workItems, candidate.dataQuality]);

  // Layer 2: AI prompt template for deep analysis
  const [showPromptTemplate, setShowPromptTemplate] = useState(false);

  const generatePromptTemplate = () => {
    const workSummary = workItems
      .slice(0, 5)
      .map((w: any, i: number) => `  ${i + 1}. ${w.company || '?'} / ${w.title || w.position || '?'} (${w.start || '?'} ~ ${w.end || '在職'})${w.description ? '\n     ' + w.description.substring(0, 100) : ''}`)
      .join('\n');
    const eduSummary = (candidate.educationJson || [])
      .slice(0, 3)
      .map((e: any, i: number) => `  ${i + 1}. ${e.school || '?'} / ${e.degree || '?'} / ${e.major || e.field || '?'}`)
      .join('\n');
    const skillsList = editNormalizedSkills.length > 0 ? editNormalizedSkills.join(', ') : (candidate.skills || '無資料');
    const cur = editSalaryCurrency || 'TWD';
    const per = editSalaryPeriod === 'annual' ? '/年' : '/月';
    const salaryParts: string[] = [];
    if (editCurrentSalaryMin || editCurrentSalaryMax) salaryParts.push(`目前: ${editCurrentSalaryMin || '?'}~${editCurrentSalaryMax || '?'} ${cur}${per}`);
    if (editExpectedSalaryMin || editExpectedSalaryMax) salaryParts.push(`期望: ${editExpectedSalaryMin || '?'}~${editExpectedSalaryMax || '?'} ${cur}${per}`);

    return `## 系統指令（System Prompt）
你是一位資深獵頭顧問 AI 助理，專精於科技業人才評估。
請根據以下候選人資料，評估其 Grade（人選等級）和 Source Tier（來源層級）。

### Grade 定義
- A 級（核心人選）：技術深度出色、經歷亮眼（知名企業/重要產品線）、年資匹配、資料完整
- B 級（合格人選）：技術紮實、經歷中等偏上、多數條件符合
- C 級（觀察人選）：有潛力但某些維度不足（經驗淺、技能不完全匹配、資料不完整）
- D 級（不適合）：多數維度明顯不符、資料嚴重不足

### Source Tier 定義
- T1（FAANG / 獨角獸）：Google, Meta, Apple, Amazon, Microsoft, NVIDIA, TSMC, MediaTek 等
- T2（知名企業 / 上市）：LINE, Shopee, Appier, ASUS, Trend Micro, KKday, 91APP 等
- T3（一般企業 / 中小型）：其他企業

### 評估維度（按權重）
1. 公司背景 (25%) — 現職/過往公司等級
2. 年資匹配 (20%) — 總年資是否在合理範圍
3. 技能豐富度 (20%) — 標準化技能數量與深度
4. 資深程度 (15%) — 職級 (IC/Senior/Lead/Manager/Director)
5. 資料完整度 (10%) — 核心欄位填寫比例
6. 職涯穩定度 (10%) — 平均任期、跳槽頻率

請回覆 JSON 格式：
{ "suggestedGrade": "A"|"B"|"C"|"D", "suggestedTier": "T1"|"T2"|"T3"|null, "confidence": 0-100, "reasons": ["原因1","原因2",...], "detailedAnalysis": "完整分析（2-3 段）" }

---
## 候選人資料

- 姓名：${candidate.name}
- 現職公司：${editCurrentCompany || '未提供'}
- 現職職稱：${editCurrentTitle || candidate.position || '未提供'}
- 標準職能：${editRoleFamily || '未分類'} / ${editCanonicalRole || '未分類'}
- 資深程度：${editSeniorityLevel || '未分類'}
- 總年資：${editYears || '未知'} 年
- 產業標籤：${editIndustryTag || '未分類'}
- 地區：${editLocation || '未提供'}

### 技能
${skillsList}

### 薪資
${salaryParts.length > 0 ? salaryParts.join(' | ') : '無資料'}

### 工作經歷
${workSummary || '  無經歷資料'}

### 教育背景
${eduSummary || '  無學歷資料'}

### 求職狀態
- 求職狀態：${editJobSearchStatusEnum || '未知'}
- 到職時間：${editNoticePeriodEnum || '未知'}
- 穩定度評分：${candidate.stabilityScore || '未知'}
- 跳槽次數：${candidate.jobChanges || '未知'}
- 平均任期：${candidate.avgTenure || '未知'} 個月

### 其他
- 資料完整度：${candidate.dataQuality?.completenessScore ?? '未知'}%
- 離職原因：${candidate.quitReasons || '未提供'}
- 備註：${(candidate.notes || '').substring(0, 200) || '無'}

---
## API 串接方式（OpenClaw）

GET /api/candidates/${candidate.id} 可取得完整人選資料
POST /api/candidates/${candidate.id}/ai-grade-suggest 可送出分析請求

### 建議 LLM 模型
- OpenAI: gpt-4o / gpt-4o-mini（推薦 gpt-4o，評估品質最佳）
- Anthropic: claude-sonnet-4-20250514 / claude-3.5-haiku
- 本地部署: Qwen2.5-72B / Llama-3.1-70B / Mistral-Large
- Temperature: 0.3（低溫度確保穩定評級）`;
  };

  // 切換 Tab 時重置滾動位置（防止從長 info tab 切換到短 tab 時看起來空白）
  React.useEffect(() => {
    if (contentScrollRef.current) {
      contentScrollRef.current.scrollTop = 0;
    }
  }, [activeTab]);

  // 禁止背景滾動
  React.useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);
  
  // 重新 fetch 候選人資料以獲得最新欄位
  React.useEffect(() => {
    let cancelled = false;
    const fetchLatest = async () => {
      try {
        const response = await fetch(getApiUrl(`/candidates/${candidate.id}`), { headers: getAuthHeaders() });
        if (response.ok && !cancelled) {
          const result = await response.json();
          const data = result.data || {};
          // 只合併關鍵欄位，避免 snake_case 汙染和空字串覆蓋
          setEnrichedCandidate({
            ...candidate,
            aiMatchResult: data.aiMatchResult || data.ai_match_result || candidate.aiMatchResult || null,
            aiSummary: data.aiSummary || data.ai_summary || (candidate as any).aiSummary || null,
            aiAnalysis: data.aiAnalysis || data.ai_analysis || (candidate as any).aiAnalysis || null,
            outreachLetters: data.outreachLetters || data.outreach_letters || (candidate as any).outreachLetters || [],
            progressTracking: data.progressTracking || data.progress_tracking || candidate.progressTracking || [],
            notes: (data.notes != null && data.notes !== '') ? data.notes : (candidate.notes || ''),
          });
          // 同步更新備註的 local state
          const latestNotes = (data.notes != null && data.notes !== '') ? data.notes : '';
          if (latestNotes) setLocalNotes(latestNotes);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Fetch candidate detail failed:', error);
          setEnrichedCandidate(candidate);
        }
      }
    };
    fetchLatest();
    return () => { cancelled = true; };
  }, [candidate.id, candidate]);

  // Sprint 2: Load taxonomy data for dropdowns
  React.useEffect(() => {
    apiGet<any>('/api/taxonomy/roles').then(res => {
      // API 回傳 { success, data: [{ roleFamily, label, canonicalRoles }] }
      const items = res?.data || res || [];
      if (Array.isArray(items)) {
        const families: Record<string, { label: string; canonicalRoles: string[] }> = {};
        for (const item of items) {
          if (item.roleFamily) {
            families[item.roleFamily] = { label: item.label, canonicalRoles: item.canonicalRoles || [] };
          }
        }
        setRoleTaxonomy(families);
      } else {
        // Fallback: 舊格式（直接是 { Backend: { label, canonicalRoles }, ... }）
        const { _meta, success, data, ...families } = items;
        setRoleTaxonomy(families);
      }
    }).catch(() => {});
    apiGet<any>('/api/taxonomy/industries').then(res => {
      // API 回傳 { success, data: [{ tag, label, aliases }] }
      const items = res?.data || res || [];
      if (Array.isArray(items)) {
        setIndustryTaxonomy(items);
      } else {
        const { _meta, success, data, ...rest } = items;
        setIndustryTaxonomy(Object.values(rest) as any[]);
      }
    }).catch(() => {});
  }, []);

  // 職缺匹配排名：切換到 ai_match tab 時才載入（懶加載）
  const fetchJobRankings = React.useCallback(async () => {
    if (rankingsLoaded || loadingRankings) return;
    setLoadingRankings(true);
    try {
      const res = await fetch(getApiUrl(`/candidates/${candidate.id}/job-rankings`), { headers: getAuthHeaders() });
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

      const currentTracking = enrichedCandidate.progressTracking || candidate.progressTracking || [];
      const updatedProgress = [...currentTracking, newEvent];
      const newStatus = eventToStatus[newProgressEvent] || candidate.status;

      // 用 PATCH 同時更新 status + progressTracking
      await apiPatch(`/api/candidates/${candidate.id}`, {
        status: newStatus,
        progressTracking: updatedProgress,
        actor: currentUserName || userName,
      });

      toast.success('進度新增成功！看板與 Pipeline 欄位已同步更新');
      // 即時更新 enrichedCandidate 讓 UI 立刻反映
      setEnrichedCandidate(prev => ({ ...prev, progressTracking: updatedProgress, status: newStatus }));
      // 同步通知父元件
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
      // 同步更新 enrichedCandidate
      setEnrichedCandidate(prev => ({ ...prev, notes: merged }));
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
⚡ 通話前準備 Checklist（1 分鐘快速掃）
═══════════════════════════════════
☐ 看過人選 LinkedIn / 履歷，記住 2-3 個亮點
☐ 了解職缺核心需求 & 客戶在意的 Top 3 條件
☐ 確認薪資範圍，心裡有底線數字
☐ 準備好「為什麼這個機會值得聊」的 30 秒 elevator pitch

═══════════════════════════════════
📢 PART A — 公司 & 職缺介紹話術
═══════════════════════════════════

▎ A1. 公司介紹重點
┌───────────────────────────────────────┐
│ 🏢 公司：${clCompany}
│ 🏭 產業：${clIndustry}
│ 📏 規模：${clSize}${clWebsite ? `\n│ 🌐 官網：${clWebsite}` : ''}
└───────────────────────────────────────┘

📌 開場話術（先建立關係再介紹職缺）：
「嗨 ${cName} 你好，我是 Step1ne 的獵頭顧問。我看到你在${cPos}方面的經歷蠻精彩的，特別是 ${cSkillStr} 的部分，想跟你分享一個蠻符合你背景的機會，方便聊個 15-20 分鐘嗎？」

📌 公司介紹話術（簡短有力，不超過 30 秒）：
「${clCompany} 是${clIndustry}領域的公司，${clSize !== '未提供' ? `規模大概${clSize}，` : ''}目前正在擴編${jTitle}的團隊。我們幾位顧問跟他們合作一段時間了，整體回饋都蠻正面的。」

▎ A2. 職缺亮點（只講最吸引人的 3 點）
• 職位：${jTitle}
• 地點：${jLocation}
• 薪資範圍：${jSalary}
• 核心技術：${jSkillStr}
${jResponsibilities.length > 0 ? `• 主要職責：\n${jResponsibilities.slice(0, 3).map((r: string) => `  ‣ ${r.trim()}`).join('\n')}` : ''}
${jBenefits.length > 0 ? `• 福利亮點：\n${jBenefits.slice(0, 3).map((b: string) => `  ✦ ${b.trim()}`).join('\n')}` : ''}

📌 職缺話術（聚焦人選可能在意的點）：
「這個角色主要是 ${jSkillStr} 的方向，薪資大概在 ${jSalary}，但我覺得以你的經歷應該有談的空間。你比較在意的是技術深度還是管理路線？」

▎ A3. 關鍵賣點（根據人選背景客製化）
✅ 技術面：使用 ${jSkillStr}，技術棧有挑戰性
✅ 發展面：${clCompany} 正在擴張，有升遷空間
✅ 團隊文化：可在面試時進一步了解${jBenefits.length > 0 ? `\n✅ 福利面：${jBenefits[0].trim()}` : ''}

💡 Tips：根據人選反應調整賣點順序，被動求職者先講「為什麼值得看」

═══════════════════════════════════
👤 PART B — 已知人選資訊（通話前複習）
═══════════════════════════════════
${cJobSearchStatus ? `• 求職狀態：${cJobSearchStatus}` : '• 求職狀態：未知（需確認）'}
${cReasonForChange ? `• 轉職原因：${cReasonForChange}` : ''}
${cSalary !== '未提供' ? `• 目前薪資：${cSalary}` : '• 目前薪資：未知（需確認）'}
${cExpectedSalary !== '未提供' ? `• 期望薪資：${cExpectedSalary}` : ''}
${cNoticePeriod !== '未提供' ? `• 可到職時間：${cNoticePeriod}` : ''}
${cDealBreakers ? `• ⛔ 不接受條件：${cDealBreakers}\n  → 注意！通話中避免踩到這些地雷` : ''}

═══════════════════════════════════
🎙️ PART C — 結構化電話篩選（約 20 分鐘）
═══════════════════════════════════

▎ C1. 開場暖身（2 分鐘）
• 簡單自我介紹 + 確認通話時間
• 先聊 1 句對方背景的亮點，讓對方感受到你做過功課
• 「在聊這個機會之前，想先了解一下你目前的狀態...」

▎ C2. 動機 & 狀態探測（5 分鐘）
1. 目前工作狀態如何？整體開心嗎？（開放式，先聽再引導）
2. 如果有更好的機會，最看重什麼？（排序：技術/薪資/文化/遠端/title）
3. 有沒有「絕對不碰」的條件？（早點排雷）
4. 是主動在看機會，還是只是願意聽聽？

💡 Tips：被動人選要先創造「不安全感」—「你覺得目前公司未來 2-3 年的成長空間如何？」

▎ C3. 技術 & 經歷驗證（5 分鐘）
5. 你目前專案最有挑戰的部分是什麼？你怎麼解決的？
6. ${jSkillStr} — 實際用在哪些專案？（要具體案例，不只是「會用」）
7. 你在團隊中扮演什麼角色？有沒有帶人或 mentor 經驗？
8. 如果讓你自己打分，${jSkillStr} 你給自己幾分？（1-10）

▎ C4. 條件對焦（5 分鐘）
9. 目前整包大概什麼水位？（月薪×幾個月 + bonus + stock）
10. 期望薪資？有硬性底線嗎？（如果超出客戶預算，這裡就要管理期望）
11. 最快什麼時候可以 on board？
12. ${jLocation} 的工作地點 OK 嗎？通勤大概多久？

▎ C5. 介紹機會 & 收尾（3 分鐘）
• 用 Part A 的話術簡介公司 & 職缺（30 秒內）
13. 聽完你覺得怎麼樣？有什麼想進一步了解的？
14. 目前有其他面試或 offer 在進行嗎？時程大概到哪？
15. 如果安排視訊面試，這一兩週哪幾天比較方便？

═══════════════════════════════════
📝 通話後顧問 Checklist（必填）
═══════════════════════════════════
☐ 興趣程度（1-5）：__（5=超想去, 3=願意看看, 1=沒興趣）
☐ 技術匹配度（1-5）：__（對照職缺 must-have 技能）
☐ 文化匹配度（1-5）：__（個性/溝通/團隊 fit）
☐ 薪資落差：__ %（正數=期望高於預算, 負數=有空間）
☐ 最快到職：____
☐ 競爭情報：□ 無其他面試 □ 有面試中 □ 有 offer
☐ 風險/紅旗：____________________________
☐ 下一步：□ 安排面試 □ 再跟進 □ 放入人才庫 □ 暫不適合
☐ 預計回覆客戶日期：____`;

      setPhoneScriptContent(script);
    } catch (err) {
      setPhoneScriptContent('⚠️ 無法載入職缺資料，請確認目標職缺已正確指定。');
    } finally {
      setPhoneScriptLoading(false);
    }
  };

  const handleCopyPhoneScript = () => {
    const doCopy = (text: string) => {
      if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text);
      }
      // Fallback for non-secure contexts
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      return Promise.resolve();
    };
    doCopy(phoneScriptContent).then(() => {
      setPhoneScriptCopied(true);
      toast.success('電話腳本已複製到剪貼簿！');
      setTimeout(() => setPhoneScriptCopied(false), 2000);
    }).catch(() => {
      toast.error('複製失敗，請手動選取複製');
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
    window.open(getApiUrl(`/api/candidates/${candidate.id}/resume/${fileId}?token=${getApiToken()}`), '_blank');
  };
  const handleDownloadResume = (fileId: string) => {
    window.open(getApiUrl(`/api/candidates/${candidate.id}/resume/${fileId}?download=true&token=${getApiToken()}`), '_blank');
  };
  const handleDeleteResume = async (fileId: string) => {
    if (!confirm('確定要刪除此履歷檔案嗎？')) return;
    try {
      const resp = await fetch(getApiUrl(`/api/candidates/${candidate.id}/resume/${fileId}`), { method: 'DELETE', headers: getAuthHeaders() });
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
      const authH = getAuthHeaders();
      delete authH['Content-Type'];
      const resp = await fetch(getApiUrl('/api/resume/parse'), { method: 'POST', headers: authH, body: formData });
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

  // 儲存基本資料（含 Phase 1 新增欄位 + Sprint 2 結構化欄位）
  const handleSaveBasicInfo = async () => {
    // 必填驗證
    if (!editName.trim()) { toast.warning('請填寫姓名'); return; }
    // 核心欄位缺失警告（不阻擋儲存）
    const missingCore: string[] = [];
    if (!editCurrentTitle.trim() && !editPosition.trim()) missingCore.push('職稱');
    if (!editRoleFamily) missingCore.push('職位族群');
    if (!editYears || Number(editYears) === 0) missingCore.push('年資');
    if (editNormalizedSkills.length === 0) missingCore.push('核心技能');
    if (!editLocation.trim()) missingCore.push('地點');
    if (missingCore.length > 0) {
      toast.warning(`建議補充：${missingCore.join('、')}（影響 AI 匹配精準度）`);
    }
    setSavingBasicInfo(true);
    try {
      const updates: Record<string, any> = {
        name: editName.trim(),
        position: editPosition.trim(),
        location: editLocation.trim(),
        phone: editPhone.trim(),
        email: editEmail.trim(),
        years: parseInt(editYears) || 0,
        skills: editNormalizedSkills.join(', '),
        // Sprint 2 結構化匹配欄位
        current_title: editCurrentTitle.trim(),
        current_company: editCurrentCompany.trim(),
        role_family: editRoleFamily,
        canonical_role: editCanonicalRole,
        seniority_level: editSeniorityLevel,
        total_years: parseFloat(editYears) || 0,
        industry_tag: editIndustryTag,
        normalized_skills: editNormalizedSkills,
        current_salary_min: editCurrentSalaryMin ? parseInt(editCurrentSalaryMin) : null,
        current_salary_max: editCurrentSalaryMax ? parseInt(editCurrentSalaryMax) : null,
        expected_salary_min: editExpectedSalaryMin ? parseInt(editExpectedSalaryMin) : null,
        expected_salary_max: editExpectedSalaryMax ? parseInt(editExpectedSalaryMax) : null,
        salary_currency: editSalaryCurrency,
        salary_period: editSalaryPeriod,
        notice_period_enum: editNoticePeriodEnum,
        job_search_status_enum: editJobSearchStatusEnum,
        // Grade / Source Tier
        grade_level: editGradeLevel || null,
        source_tier: editSourceTier || null,
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

  // 貼上 AI 總結結果並存入系統
  const handlePasteAiResult = async () => {
    setPasteAiError('');
    const raw = pasteAiText.trim();
    if (!raw) { setPasteAiError('請先貼上 AI 回覆的內容'); return; }

    // 嘗試從文字中提取 JSON（支援 markdown 包裹的 ```json...```）
    let jsonStr = raw;
    const codeBlockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) jsonStr = codeBlockMatch[1].trim();

    // 嘗試找到 ai_summary 物件或直接解析
    let aiSummary: any;
    try {
      const parsed = JSON.parse(jsonStr);
      // 支援兩種格式：完整 PATCH body { ai_summary: {...} } 或直接 ai_summary 物件
      aiSummary = parsed.ai_summary || parsed;
      // 基本驗證
      if (!aiSummary.one_liner && !aiSummary.strengths && !aiSummary.top_matches) {
        setPasteAiError('JSON 格式不正確：缺少 one_liner / strengths / top_matches 等必要欄位');
        return;
      }
    } catch {
      setPasteAiError('無法解析 JSON，請確認貼上的內容是有效的 JSON 格式');
      return;
    }

    // 格式相容：將 AI 回傳的各種欄位名映射到系統標準格式
    // suggestion → next_steps（行動建議欄位名相容）
    if (aiSummary.suggestion && !aiSummary.next_steps) {
      aiSummary.next_steps = aiSummary.suggestion;
    }
    // 自動補上時間戳
    if (!aiSummary.evaluated_at) aiSummary.evaluated_at = new Date().toISOString();
    if (!aiSummary.evaluated_by) aiSummary.evaluated_by = '手動貼入';

    setSavingAiResult(true);
    try {
      await apiPatch(`/candidates/${candidate.id}`, { ai_summary: aiSummary, actor: 'AI-summary-paste' });
      // 更新本地狀態
      setEnrichedCandidate(prev => ({ ...prev, aiSummary: aiSummary }));
      onCandidateUpdate?.(candidate.id, { aiSummary: aiSummary } as any);
      toast.success('AI 總結已儲存至系統');
      setShowPasteAiResult(false);
      setPasteAiText('');
    } catch (err: any) {
      setPasteAiError(`儲存失敗：${err.message || '請檢查網路連線'}`);
    } finally {
      setSavingAiResult(false);
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
      {/* 互動式新手導覽 */}
      <OnboardingTour
        storageKey="step1ne-candidate-modal-tour"
        steps={modalTourSteps}
        active={tourActive}
        onComplete={() => setTourActive(false)}
      />

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

              {/* 匿名履歷產生 */}
              <button
                onClick={() => setShowResumeGen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xs sm:text-sm font-medium transition-colors mt-2"
              >
                <FileText className="w-3.5 h-3.5" />
                產生匿名履歷
              </button>
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
        <div className="border-b border-gray-200 bg-gray-50 overflow-x-auto" data-tour="modal-tabs">
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
              onClick={() => setActiveTab('ai_consultant')}
              className={`px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'ai_consultant'
                  ? 'text-violet-600 border-b-2 border-violet-600 bg-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-1 sm:gap-2">
                <Sparkles className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">AI 顧問分析</span>
                <span className="sm:hidden">AI分析</span>
                {(candidate as any).aiAnalysis?.job_matchings?.[0] && (
                  <span className="text-[8px] sm:text-[10px] px-1 sm:px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 font-bold">
                    {(candidate as any).aiAnalysis.job_matchings[0].match_score}
                  </span>
                )}
              </div>
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div ref={contentScrollRef} className="flex-1 overflow-y-auto p-4 sm:p-6">
          {activeTab === 'info' && (
            <div className="space-y-6">
              {/* 負責顧問 */}
              <div className="bg-indigo-50 rounded-lg border border-indigo-100" data-tour="modal-recruiter">
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
              <div className="bg-amber-50 rounded-lg border border-amber-100" data-tour="modal-target-job">
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

              {/* ── Precision Evaluation Gate 提示 ── */}
              {(() => {
                const dq = candidate.dataQuality;
                const score = dq?.completenessScore;
                const missing = dq?.missingCoreFields || [];
                const isPrecision = candidate.precisionEligible === true;

                // 中文欄位名映射
                const fieldLabelMap: Record<string, string> = {
                  canonicalRole: '職務類別',
                  normalizedSkills: '核心技能',
                  totalYears: '總年資',
                  location: '地區',
                  currentCompany: '目前公司',
                  industryTag: '產業標籤',
                  expectedSalaryMin: '期望薪資下限',
                  expectedSalaryMax: '期望薪資上限',
                  noticePeriodEnum: '到職時間',
                  jobSearchStatusEnum: '求職狀態',
                };

                return missing.length > 0 ? (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg" data-tour="modal-precision-gate">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                        <span className="text-xs font-bold text-amber-800">
                          AI 匹配精準度不足{score != null ? ` — 資料完整度 ${score}%` : ''}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                        Precision Pool: NO
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-700 ml-6">
                      缺少以下 Match Core 欄位：
                      {missing.map((f, i) => (
                        <span key={f} className="inline-flex items-center mx-0.5">
                          {i > 0 && '、'}
                          <span className="font-bold text-amber-900">{fieldLabelMap[f] || f}</span>
                        </span>
                      ))}
                    </p>
                    <p className="text-[10px] text-amber-600 ml-6 mt-1">
                      填寫完整後即可進入精準匹配池，AI 推薦準確度可提升 2-3 倍
                    </p>
                  </div>
                ) : isPrecision ? (
                  <div className="flex items-center justify-between p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg" data-tour="modal-precision-gate">
                    <span className="text-xs text-emerald-700 font-medium">
                      Match Core 欄位已齊全 — 資料完整度 {score || 100}%
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                      Precision Pool: YES
                    </span>
                  </div>
                ) : score != null ? (
                  <div className="flex items-center justify-between p-2.5 bg-blue-50 border border-blue-200 rounded-lg" data-tour="modal-precision-gate">
                    <span className="text-xs text-blue-700 font-medium">
                      資料完整度 {score}% — 部分條件未達精準匹配標準
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                      Precision Pool: NO
                    </span>
                  </div>
                ) : null;
              })()}

              {/* ── 新手使用指南 ── */}
              {guideExpanded ? (
                  <div className="bg-gradient-to-br from-blue-50 via-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center">
                          <BookOpen size={15} className="text-blue-600" />
                        </div>
                        <h3 className="text-sm font-bold text-blue-900">如何使用人選卡片</h3>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => { setGuideExpanded(false); localStorage.setItem('step1ne-candidate-modal-guide', '1'); localStorage.removeItem('step1ne-candidate-modal-tour'); setTourActive(true); }}
                          className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-indigo-600 bg-white border border-indigo-200 rounded-md hover:bg-indigo-50"
                        >🔄 互動導覽</button>
                        <button
                          onClick={() => { setGuideExpanded(false); localStorage.setItem('step1ne-candidate-modal-guide', '1'); }}
                          className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-blue-600 bg-white border border-blue-200 rounded-md hover:bg-blue-50"
                        >我知道了</button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="flex items-start gap-2.5 bg-white/70 rounded-lg px-3 py-2.5">
                        <div className="w-6 h-6 bg-blue-100 rounded-md flex items-center justify-center shrink-0 mt-0.5">
                          <Target size={13} className="text-blue-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-blue-900">步驟 1：檢查核心匹配資料</p>
                          <p className="text-[11px] text-blue-700/80 leading-relaxed mt-0.5">標有 <span className="text-orange-500 font-bold">* Match Core</span> 的 10 個欄位是 AI 比對關鍵，有 <span className="text-orange-500">⚠ 待填寫</span> 的要優先補齊</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2.5 bg-white/70 rounded-lg px-3 py-2.5">
                        <div className="w-6 h-6 bg-purple-100 rounded-md flex items-center justify-center shrink-0 mt-0.5">
                          <Award size={13} className="text-purple-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-blue-900">步驟 2：參考 AI 評級建議</p>
                          <p className="text-[11px] text-blue-700/80 leading-relaxed mt-0.5">系統自動計算 Grade（A~D）和 Source Tier（T1~T3），點「採用建議」或手動選擇</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2.5 bg-white/70 rounded-lg px-3 py-2.5">
                        <div className="w-6 h-6 bg-green-100 rounded-md flex items-center justify-center shrink-0 mt-0.5">
                          <Briefcase size={13} className="text-green-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-blue-900">步驟 3：補充工作經歷與學歷</p>
                          <p className="text-[11px] text-blue-700/80 leading-relaxed mt-0.5">工作經歷影響評級 35%（公司背景 + 穩定度），部分客戶職缺會要求學歷</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2.5 bg-white/70 rounded-lg px-3 py-2.5">
                        <div className="w-6 h-6 bg-indigo-100 rounded-md flex items-center justify-center shrink-0 mt-0.5">
                          <Brain size={13} className="text-indigo-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-blue-900">步驟 4：AI 深度分析（進階）</p>
                          <p className="text-[11px] text-blue-700/80 leading-relaxed mt-0.5">點「AI 深度分析提示詞」複製 Prompt，貼到 ChatGPT / Claude / OpenClaw 做深度評估</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2.5 bg-white/70 rounded-lg px-3 py-2.5 sm:col-span-2">
                        <div className="w-6 h-6 bg-amber-100 rounded-md flex items-center justify-center shrink-0 mt-0.5">
                          <TrendingUp size={13} className="text-amber-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-blue-900">步驟 5：更新進度與狀態</p>
                          <p className="text-[11px] text-blue-700/80 leading-relaxed mt-0.5">使用「進度追蹤」分頁更新人選狀態（聯繫 → AI 推薦 → 面試 → 錄取），用「備註紀錄」記錄溝通內容</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setGuideExpanded(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      <BookOpen size={13} />
                      使用說明
                    </button>
                    <button
                      onClick={() => { localStorage.removeItem('step1ne-candidate-modal-tour'); setTourActive(true); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors"
                    >
                      🔄 互動導覽
                    </button>
                  </div>
              )}

              {/* ── 外部連結 & 履歷附件（候選人資料上方） ── */}
              <div className="space-y-3">
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
              </div>

              {/* ── 全域編輯控制列 ── */}
              <div className="flex items-center justify-between" data-tour="modal-candidate-data">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">候選人資料</span>
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
                    <button onClick={() => { setEditingBasicInfo(false); setEditName(candidate.name); setEditPosition(candidate.position||''); setEditCurrentTitle(candidate.currentTitle||candidate.position||''); setEditLocation(candidate.location||''); setEditPhone(candidate.phone||''); setEditEmail(candidate.email||''); setEditYears(String(candidate.years||'')); setEditSkills(Array.isArray(candidate.skills)?candidate.skills.join('、'):(candidate.skills||'')); setEditAge(String(candidate.age??'')); setEditEducation(typeof candidate.education === 'string' ? candidate.education : ''); setEditEnglishName(candidate.englishName||''); setEditIndustry(candidate.industry||''); setEditCurrentCompany(candidate.currentCompany||''); setEditRoleFamily(candidate.roleFamily||''); setEditCanonicalRole(candidate.canonicalRole||''); setEditSeniorityLevel(candidate.seniorityLevel||''); setEditIndustryTag(candidate.industryTag||''); setEditNormalizedSkills(candidate.normalizedSkills||[]); setEditCurrentSalaryMin(String(candidate.currentSalaryMin??'')); setEditCurrentSalaryMax(String(candidate.currentSalaryMax??'')); setEditExpectedSalaryMin(String(candidate.expectedSalaryMin??'')); setEditExpectedSalaryMax(String(candidate.expectedSalaryMax??'')); setEditSalaryCurrency(candidate.salaryCurrency||'TWD'); setEditSalaryPeriod(candidate.salaryPeriod||'monthly'); setEditNoticePeriodEnum(candidate.noticePeriodEnum||''); setEditJobSearchStatusEnum(candidate.jobSearchStatusEnum||''); setEditLanguages(candidate.languages||''); setEditCertifications(candidate.certifications||''); setEditCurrentSalary(candidate.currentSalary||''); setEditExpectedSalary(candidate.expectedSalary||''); setEditNoticePeriod(candidate.noticePeriod||''); setEditManagement(candidate.managementExperience||false); setEditTeamSize(candidate.teamSize||''); setEditJobSearchStatus(candidate.jobSearchStatus||''); setEditReasonForChange(candidate.reasonForChange||''); setEditMotivation(candidate.motivation||''); setEditDealBreakers(candidate.dealBreakers||''); setEditCompetingOffers(candidate.competingOffers||''); setEditRelationshipLevel(candidate.relationshipLevel||''); setEditConsultantNote(candidate.consultantNote||''); setEditGradeLevel(candidate.gradeLevel||''); setEditSourceTier(candidate.sourceTier||''); }} className="text-xs px-2 py-1 border border-gray-200 rounded text-gray-600 hover:bg-white">取消</button>
                  </div>
                )}
              </div>

              {/* ════════════════════════════════════════════════════════ */}
              {/* Block 1: Core Match (核心匹配) — 預設展開               */}
              {/* ════════════════════════════════════════════════════════ */}
              <div className="bg-blue-50/50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2 p-3 border-b border-blue-100">
                  <Target className="w-4 h-4 text-blue-500" />
                  <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider">核心匹配資料</span>
                  <span className="text-[10px] text-blue-400 ml-auto">AI 第一輪比對用</span>
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
                    {/* Row 1: Name + Email + Phone + Location */}
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">姓名 *</label>
                      <input value={editName} onChange={e => setEditName(e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Email</label>
                      <input value={editEmail} onChange={e => setEditEmail(e.target.value)} placeholder="example@email.com" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">電話</label>
                      <input value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="0912-345-678" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">地點 <span className="text-red-500">*</span> <span className="text-[10px] text-orange-500 bg-orange-50 px-1 rounded">Match Core</span></label>
                      <input value={editLocation} onChange={e => setEditLocation(e.target.value)} placeholder="台北市" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    </div>
                    {/* Row 2: Company + Title */}
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">目前公司 <span className="text-red-500">*</span> <span className="text-[10px] text-orange-500 bg-orange-50 px-1 rounded">Match Core</span></label>
                      <input value={editCurrentCompany} onChange={e => setEditCurrentCompany(e.target.value)} placeholder="例：Google" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">目前職稱 *</label>
                      <input value={editCurrentTitle} onChange={e => { setEditCurrentTitle(e.target.value); setEditPosition(e.target.value); }} placeholder="資深後端工程師" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    </div>
                    {/* Row 3: Role Family + Canonical Role + Seniority */}
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">職位族群 *</label>
                      <select value={editRoleFamily} onChange={e => { setEditRoleFamily(e.target.value); setEditCanonicalRole(''); }} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white">
                        <option value="">— 請選擇 —</option>
                        {Object.entries(roleTaxonomy).map(([key, val]) => (
                          <option key={key} value={key}>{val.label} ({key})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">標準職稱 <span className="text-red-500">*</span> <span className="text-[10px] text-orange-500 bg-orange-50 px-1 rounded">Match Core</span></label>
                      <select value={editCanonicalRole} onChange={e => setEditCanonicalRole(e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white" disabled={!editRoleFamily}>
                        <option value="">— 請選擇 —</option>
                        {(roleTaxonomy[editRoleFamily]?.canonicalRoles || []).map(r => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">資歷等級</label>
                      <select value={editSeniorityLevel} onChange={e => setEditSeniorityLevel(e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white">
                        <option value="">— 請選擇 —</option>
                        <option value="IC">IC (Individual Contributor)</option>
                        <option value="Senior">Senior</option>
                        <option value="Lead">Lead / Staff</option>
                        <option value="Manager">Manager</option>
                        <option value="Director">Director+</option>
                      </select>
                    </div>
                    {/* Row 4: Years + Industry */}
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">總年資 <span className="text-red-500">*</span> <span className="text-[10px] text-orange-500 bg-orange-50 px-1 rounded">Match Core</span></label>
                      <input value={editYears} onChange={e => setEditYears(e.target.value)} type="number" min="0" step="0.5" placeholder="0" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">產業標籤 <span className="text-red-500">*</span> <span className="text-[10px] text-orange-500 bg-orange-50 px-1 rounded">Match Core</span></label>
                      <select value={editIndustryTag} onChange={e => setEditIndustryTag(e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white">
                        <option value="">— 請選擇 —</option>
                        {industryTaxonomy.map(ind => (
                          <option key={ind.tag} value={ind.tag}>{ind.label} ({ind.tag})</option>
                        ))}
                      </select>
                    </div>
                    {/* Row 5: Normalized Skills (tag input) */}
                    <div className="sm:col-span-2">
                      <label className="block text-xs text-gray-500 mb-1">核心技能 <span className="text-red-500">*</span> <span className="text-[10px] text-orange-500 bg-orange-50 px-1 rounded">Match Core</span>（輸入後按 Enter 或逗號新增）</label>
                      <SkillTagInput value={editNormalizedSkills} onChange={setEditNormalizedSkills} placeholder="React, Python, Docker..." />
                    </div>
                    {/* Row 6: Salary (structured) */}
                    <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <SalaryRangeInput label="目前薪資" min={editCurrentSalaryMin} max={editCurrentSalaryMax} currency={editSalaryCurrency} period={editSalaryPeriod} onMinChange={setEditCurrentSalaryMin} onMaxChange={setEditCurrentSalaryMax} onCurrencyChange={setEditSalaryCurrency} onPeriodChange={setEditSalaryPeriod} />
                      <SalaryRangeInput label="期望薪資" required min={editExpectedSalaryMin} max={editExpectedSalaryMax} currency={editSalaryCurrency} period={editSalaryPeriod} onMinChange={setEditExpectedSalaryMin} onMaxChange={setEditExpectedSalaryMax} onCurrencyChange={setEditSalaryCurrency} onPeriodChange={setEditSalaryPeriod} />
                    </div>
                    {/* Row 7: Notice Period + Job Search Status (enum dropdowns) */}
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">到職時間 <span className="text-red-500">*</span> <span className="text-[10px] text-orange-500 bg-orange-50 px-1 rounded">Match Core</span></label>
                      <select value={editNoticePeriodEnum} onChange={e => setEditNoticePeriodEnum(e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white">
                        <option value="">— 請選擇 —</option>
                        <option value="immediate">即刻到職</option>
                        <option value="2weeks">2 週內</option>
                        <option value="1month">1 個月</option>
                        <option value="2months">2 個月</option>
                        <option value="3months">3 個月</option>
                        <option value="negotiable">可議</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">求職狀態 <span className="text-red-500">*</span> <span className="text-[10px] text-orange-500 bg-orange-50 px-1 rounded">Match Core</span></label>
                      <select value={editJobSearchStatusEnum} onChange={e => setEditJobSearchStatusEnum(e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white">
                        <option value="">— 請選擇 —</option>
                        <option value="active">主動求職</option>
                        <option value="passive">被動觀望</option>
                        <option value="not_open">暫不考慮</option>
                      </select>
                    </div>
                    {/* ── Grade / Source Tier 評級 ── */}
                    <div className="sm:col-span-2 pt-2 mt-1 border-t border-blue-100">
                      <div className="flex items-center gap-2 mb-2">
                        <Award className="w-3.5 h-3.5 text-purple-500" />
                        <span className="text-xs font-semibold text-purple-700">顧問評級</span>
                        <span className="text-[10px] text-gray-400">— 評估人選等級與來源公司層級</span>
                      </div>
                      {/* AI Auto-Suggestion Card (Layer 1 rule-based + Layer 2 LLM) */}
                      {(autoSuggestion.suggestedGrade || autoSuggestion.suggestedTier) && (
                        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-2.5 mb-2">
                          {/* Layer 1: Rule-based instant suggestion */}
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                              <span className="text-[11px] font-bold text-purple-700">快速建議</span>
                              <span className="text-[9px] px-1 py-0.5 bg-purple-100 text-purple-600 rounded">Layer 1</span>
                              <span className="text-[10px] text-gray-400">信心度 {autoSuggestion.confidence}%</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {autoSuggestion.suggestedGrade && GRADE_CONFIG[autoSuggestion.suggestedGrade] && (
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${GRADE_CONFIG[autoSuggestion.suggestedGrade].bg} ${GRADE_CONFIG[autoSuggestion.suggestedGrade].color} ${GRADE_CONFIG[autoSuggestion.suggestedGrade].border} border`}>
                                  {GRADE_CONFIG[autoSuggestion.suggestedGrade].label}
                                </span>
                              )}
                              {autoSuggestion.suggestedTier && TIER_CONFIG[autoSuggestion.suggestedTier] && (
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${TIER_CONFIG[autoSuggestion.suggestedTier].bg} ${TIER_CONFIG[autoSuggestion.suggestedTier].color} ${TIER_CONFIG[autoSuggestion.suggestedTier].border} border`}>
                                  {TIER_CONFIG[autoSuggestion.suggestedTier].label}
                                </span>
                              )}
                            </div>
                          </div>
                          {autoSuggestion.reasons.length > 0 && (
                            <div className="text-[10px] text-gray-600 ml-5 space-y-0.5">
                              {autoSuggestion.reasons.slice(0, 4).map((r, i) => (
                                <div key={i}>• {r}</div>
                              ))}
                            </div>
                          )}
                          <div className="flex items-center gap-1.5 mt-2 ml-5">
                            <button
                              type="button"
                              onClick={() => {
                                if (autoSuggestion.suggestedGrade) setEditGradeLevel(autoSuggestion.suggestedGrade);
                                if (autoSuggestion.suggestedTier) setEditSourceTier(autoSuggestion.suggestedTier);
                                toast.success('已採用建議');
                              }}
                              className="text-[10px] px-2 py-0.5 bg-purple-600 text-white rounded hover:bg-purple-700 font-medium"
                            >
                              ✅ 採用建議
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowPromptTemplate(!showPromptTemplate)}
                              className="text-[10px] px-2 py-0.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 font-medium flex items-center gap-1"
                            >
                              <Brain className="w-3 h-3" />
                              {showPromptTemplate ? '收起提示詞' : 'AI 深度分析提示詞'}
                            </button>
                            <span className="text-[10px] text-gray-400">或在下方手動選擇</span>
                          </div>
                        </div>
                      )}

                      {/* Layer 2: AI Prompt Template (copy to external AI) */}
                      {showPromptTemplate && (
                        <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-300 rounded-lg p-2.5 mb-2">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-1.5">
                              <Brain className="w-3.5 h-3.5 text-indigo-600" />
                              <span className="text-[11px] font-bold text-indigo-700">AI 深度分析提示詞</span>
                              <span className="text-[9px] px-1 py-0.5 bg-indigo-100 text-indigo-600 rounded">Layer 2</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(generatePromptTemplate());
                                  toast.success('已複製提示詞到剪貼簿');
                                }}
                                className="text-[10px] px-2 py-0.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 font-medium flex items-center gap-1"
                              >
                                <Copy className="w-3 h-3" />
                                複製提示詞
                              </button>
                              <button
                                type="button"
                                onClick={() => setShowPromptTemplate(false)}
                                className="text-[10px] px-1 py-0.5 text-gray-500 hover:text-gray-700"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                          <p className="text-[10px] text-indigo-600 mb-1.5 ml-0.5">
                            複製以下提示詞，貼到 ChatGPT / Claude / 本地 OpenClaw AI 進行深度評估
                          </p>
                          <div className="relative">
                            <pre className="text-[10px] text-gray-700 bg-white/80 border border-indigo-100 rounded p-2.5 whitespace-pre-wrap leading-relaxed max-h-[240px] overflow-y-auto font-mono">
                              {generatePromptTemplate()}
                            </pre>
                          </div>
                          <div className="mt-2 p-2 bg-indigo-100/50 rounded text-[10px] text-indigo-700">
                            <span className="font-bold">API 串接：</span> OpenClaw 可透過 <code className="bg-white/80 px-1 rounded text-[9px]">GET /api/candidates/{candidate.id}</code> 取得人選資料，搭配上述 System Prompt 送入 LLM 自動評級
                          </div>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        Grade（人選等級）
                        <HelpCircle className="inline w-3 h-3 ml-1 text-gray-400" />
                      </label>
                      <select value={editGradeLevel} onChange={e => setEditGradeLevel(e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 bg-white">
                        <option value="">— 請選擇 —</option>
                        {Object.entries(GRADE_CONFIG).map(([key, conf]) => (
                          <option key={key} value={key}>{conf.label} — {conf.description}</option>
                        ))}
                      </select>
                      {editGradeLevel && GRADE_CONFIG[editGradeLevel] && (
                        <p className={`text-[10px] mt-1 ${GRADE_CONFIG[editGradeLevel].color}`}>
                          {GRADE_CONFIG[editGradeLevel].description}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        Source Tier（來源層級）
                        <HelpCircle className="inline w-3 h-3 ml-1 text-gray-400" />
                      </label>
                      <select value={editSourceTier} onChange={e => setEditSourceTier(e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 bg-white">
                        <option value="">— 請選擇 —</option>
                        {Object.entries(TIER_CONFIG).map(([key, conf]) => (
                          <option key={key} value={key}>{conf.label} — {conf.description}</option>
                        ))}
                      </select>
                      {editSourceTier && TIER_CONFIG[editSourceTier] && (
                        <p className={`text-[10px] mt-1 ${TIER_CONFIG[editSourceTier].color}`}>
                          {TIER_CONFIG[editSourceTier].description}
                        </p>
                      )}
                    </div>
                    {/* 評分參考指南 */}
                    <div className="sm:col-span-2 bg-purple-50 rounded-lg p-2.5 border border-purple-100">
                      <details className="text-xs">
                        <summary className="cursor-pointer text-purple-700 font-semibold flex items-center gap-1">
                          <HelpCircle className="w-3 h-3" /> 評分參考指南
                        </summary>
                        <div className="mt-2 space-y-1.5 text-[11px] text-gray-600">
                          <div><span className="font-bold text-emerald-700">A 級</span>：技能高度匹配、來自 T1 公司、3+ 年相關經驗、有量化成果</div>
                          <div><span className="font-bold text-blue-700">B 級</span>：基本條件符合、技能 70%+ 匹配、有發展潛力</div>
                          <div><span className="font-bold text-amber-700">C 級</span>：部分條件不符、需要培訓或轉型、經驗不足</div>
                          <div><span className="font-bold text-red-700">D 級</span>：條件明顯不符、技能差距大、不建議推薦</div>
                          <hr className="border-purple-200 my-1.5" />
                          <div><span className="font-bold text-violet-700">T1</span>：FAANG / 獨角獸 / 市值 Top 50（Google, TSMC, Meta...）</div>
                          <div><span className="font-bold text-indigo-700">T2</span>：上市公司 / 知名新創 / 行業領導者（Shopee, LINE, Appier...）</div>
                          <div><span className="font-bold text-slate-600">T3</span>：中小型企業 / 傳統產業 / 新創早期</div>
                        </div>
                      </details>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 grid grid-cols-2 gap-x-4 gap-y-2">
                    {/* Display: Company + Title */}
                    <div className="flex items-center gap-2">
                      <Building2 className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="text-xs text-gray-500">公司</span>
                      {editCurrentCompany ? (
                        <span className="text-sm font-medium text-gray-800 truncate">{editCurrentCompany}</span>
                      ) : <span className="text-[10px] text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-200">⚠ 待填寫</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Briefcase className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="text-xs text-gray-500">職稱</span>
                      <span className="text-sm font-medium text-gray-800 truncate">{editCurrentTitle || editPosition || '—'}</span>
                    </div>
                    {/* Role Family + Seniority */}
                    <div className="flex items-center gap-2">
                      <Target className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="text-xs text-gray-500">職位族群</span>
                      {editRoleFamily ? (
                        <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full font-medium">{editRoleFamily}</span>
                      ) : <span className="text-sm text-gray-400">—</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Hash className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="text-xs text-gray-500">資歷</span>
                      <span className="text-sm font-medium text-gray-800">{editSeniorityLevel || '—'}</span>
                    </div>
                    {/* Location + Years */}
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="text-xs text-gray-500">地點</span>
                      {editLocation ? (
                        <span className="text-sm font-medium text-gray-800 truncate">{editLocation}</span>
                      ) : <span className="text-[10px] text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-200">⚠ 待填寫</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="text-xs text-gray-500">年資</span>
                      {editYears && Number(editYears) > 0 ? (
                        <span className="text-sm font-medium text-gray-800">{editYears} 年</span>
                      ) : <span className="text-[10px] text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-200">⚠ 待填寫</span>}
                    </div>
                    {/* Phone + Email */}
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
                      ) : <span className="text-sm text-gray-400">—</span>}
                    </div>
                    {/* Industry */}
                    <div className="flex items-center gap-2">
                      <Briefcase className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="text-xs text-gray-500">產業</span>
                      {editIndustryTag ? (
                        <span className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full font-medium">{editIndustryTag}</span>
                      ) : <span className="text-[10px] text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-200">⚠ 待填寫</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Briefcase className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="text-xs text-gray-500">標準職稱</span>
                      {editCanonicalRole ? (
                        <span className="text-sm font-medium text-gray-800 truncate">{editCanonicalRole}</span>
                      ) : <span className="text-[10px] text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-200">⚠ 待填寫</span>}
                    </div>
                    {/* Skills */}
                    <div className="col-span-2 flex items-start gap-2 pt-1 border-t border-gray-100">
                      <Award className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                      <span className="text-xs text-gray-500 shrink-0">技能</span>
                      <div className="flex flex-wrap gap-1">
                        {editNormalizedSkills.length > 0 ? editNormalizedSkills.map((s, i) => (
                          <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs">{s}</span>
                        )) : <span className="text-[10px] text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-200">⚠ 待填寫</span>}
                      </div>
                    </div>
                    {/* Salary */}
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="text-xs text-gray-500">目前薪資</span>
                      <SalaryRangeDisplay min={editCurrentSalaryMin ? Number(editCurrentSalaryMin) : candidate.currentSalaryMin} max={editCurrentSalaryMax ? Number(editCurrentSalaryMax) : candidate.currentSalaryMax} currency={editSalaryCurrency} period={editSalaryPeriod} />
                    </div>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="text-xs text-gray-500">期望薪資</span>
                      {(editExpectedSalaryMin || candidate.expectedSalaryMin || editExpectedSalaryMax || candidate.expectedSalaryMax) ? (
                        <SalaryRangeDisplay min={editExpectedSalaryMin ? Number(editExpectedSalaryMin) : candidate.expectedSalaryMin} max={editExpectedSalaryMax ? Number(editExpectedSalaryMax) : candidate.expectedSalaryMax} currency={editSalaryCurrency} period={editSalaryPeriod} />
                      ) : <span className="text-[10px] text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-200">⚠ 待填寫</span>}
                    </div>
                    {/* Notice Period + Job Search Status */}
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="text-xs text-gray-500">到職時間</span>
                      {editNoticePeriodEnum ? (
                        <span className="text-sm font-medium text-gray-800">{
                          editNoticePeriodEnum === 'immediate' ? '即刻到職' :
                          editNoticePeriodEnum === '2weeks' ? '2 週內' :
                          editNoticePeriodEnum === '1month' ? '1 個月' :
                          editNoticePeriodEnum === '2months' ? '2 個月' :
                          editNoticePeriodEnum === '3months' ? '3 個月' :
                          editNoticePeriodEnum === 'negotiable' ? '可議' : editNoticePeriodEnum
                        }</span>
                      ) : <span className="text-[10px] text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-200">⚠ 待填寫</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Target className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="text-xs text-gray-500">求職狀態</span>
                      {editJobSearchStatusEnum ? (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          editJobSearchStatusEnum === 'active' ? 'bg-green-50 text-green-700' :
                          editJobSearchStatusEnum === 'passive' ? 'bg-amber-50 text-amber-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>{editJobSearchStatusEnum === 'active' ? '主動求職' : editJobSearchStatusEnum === 'passive' ? '被動觀望' : '暫不考慮'}</span>
                      ) : <span className="text-[10px] text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-200">⚠ 待填寫</span>}
                    </div>
                    {/* Grade / Source Tier display */}
                    <div className="col-span-2 flex items-center gap-3 pt-1.5 mt-1 border-t border-gray-100">
                      <div className="flex items-center gap-2">
                        <Award className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                        <span className="text-xs text-gray-500">Grade</span>
                        {editGradeLevel && GRADE_CONFIG[editGradeLevel] ? (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${GRADE_CONFIG[editGradeLevel].bg} ${GRADE_CONFIG[editGradeLevel].color} ${GRADE_CONFIG[editGradeLevel].border} border`}>
                            {GRADE_CONFIG[editGradeLevel].label}
                          </span>
                        ) : <span className="text-xs text-gray-400">未評級</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Source Tier</span>
                        {editSourceTier && TIER_CONFIG[editSourceTier] ? (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${TIER_CONFIG[editSourceTier].bg} ${TIER_CONFIG[editSourceTier].color} ${TIER_CONFIG[editSourceTier].border} border`}>
                            {TIER_CONFIG[editSourceTier].label}
                          </span>
                        ) : <span className="text-xs text-gray-400">未分類</span>}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ════════════════════════════════════════════════════════ */}
              {/* Block 3: Deal Terms (成交條件) — 預設收合               */}
              {/* ════════════════════════════════════════════════════════ */}
              <div className="bg-amber-50/50 rounded-lg border border-amber-200">
                <button
                  onClick={() => setSectionDealOpen(v => !v)}
                  className="w-full flex items-center gap-2 p-3 hover:bg-amber-50 transition-colors"
                >
                  <MessageSquare className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">成交條件</span>
                  <span className="text-[10px] text-amber-400 ml-1">轉職原因 / 動機 / 不適配</span>
                  <ChevronDown className={`w-4 h-4 text-amber-400 ml-auto transition-transform ${sectionDealOpen ? 'rotate-180' : ''}`} />
                </button>
                {sectionDealOpen && (
                  editingBasicInfo ? (
                    <div className="p-3 border-t border-amber-100 grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                      <div className="sm:col-span-2">
                        <label className="block text-xs text-gray-500 mb-1">顧問備註</label>
                        <textarea value={editConsultantNote} onChange={e => setEditConsultantNote(e.target.value)} placeholder="例：人選目前在 A 公司做到主管，主要想換的原因是加班太多..." rows={3} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y" />
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 border-t border-amber-100 grid grid-cols-2 gap-x-4 gap-y-2">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className="text-xs text-gray-500">動機</span>
                        <span className="text-sm font-medium text-gray-800">{editMotivation || '—'}</span>
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
                        ) : <span className="text-sm text-gray-400">—</span>}
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
                  )
                )}
              </div>


              {/* ════════════════════════════════════════════════════════ */}
              {/* Block 4: Supplementary (補充資料) — 預設收合            */}
              {/* ════════════════════════════════════════════════════════ */}
              <div className="bg-gray-50/50 rounded-lg border border-gray-200">
                <button
                  onClick={() => setSectionSupplementOpen(v => !v)}
                  className="w-full flex items-center gap-2 p-3 hover:bg-gray-50 transition-colors"
                >
                  <FileText className="w-4 h-4 text-gray-500" />
                  <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">補充資料</span>
                  <span className="text-[10px] text-gray-400 ml-1">學歷 / 語言 / 證照 / Google Drive / 作品集</span>
                  <ChevronDown className={`w-4 h-4 text-gray-400 ml-auto transition-transform ${sectionSupplementOpen ? 'rotate-180' : ''}`} />
                </button>
                {sectionSupplementOpen && (
                <div className="border-t border-gray-100 p-3 space-y-4">

                  {/* Supplementary edit fields */}
                  {editingBasicInfo && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">出生年月日</label>
                        <input value={editBirthday} onChange={e => { setEditBirthday(e.target.value); const a = calcAgeFromBirthday(e.target.value); if (a !== null) setEditAge(String(a)); }} type="date" max={new Date().toISOString().split('T')[0]} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                        {editBirthday && calcAgeFromBirthday(editBirthday) !== null && (
                          <span className="text-xs text-blue-600 mt-0.5 block">→ {calcAgeFromBirthday(editBirthday)} 歲</span>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">年齡（無生日時手動填）</label>
                        <input value={editAge} onChange={e => setEditAge(e.target.value)} type="number" min="18" max="70" placeholder="32" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" disabled={!!editBirthday} />
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
                        <input value={editEnglishName} onChange={e => setEditEnglishName(e.target.value)} placeholder="Iris, Jack Chen" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">學歷</label>
                        <input value={editEducation} onChange={e => setEditEducation(e.target.value)} placeholder="台大資工碩士" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">語言能力</label>
                        <input value={editLanguages} onChange={e => setEditLanguages(e.target.value)} placeholder="中文母語、英文流利" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs text-gray-500 mb-1">證照</label>
                        <textarea value={editCertifications} onChange={e => setEditCertifications(e.target.value)} placeholder="PMP、AWS SAA、Google Cloud" rows={2} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">管理人數</label>
                        <input value={editTeamSize} onChange={e => setEditTeamSize(e.target.value)} placeholder="5-10人" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </div>
                      <div className="flex items-center gap-2 pt-6">
                        <input type="checkbox" id="edit-mgmt" checked={editManagement} onChange={e => setEditManagement(e.target.checked)} className="rounded border-gray-300" />
                        <label htmlFor="edit-mgmt" className="text-xs text-gray-600">具備管理經驗</label>
                      </div>
                    </div>
                  )}

                  {/* Supplementary display fields (when not editing) */}
                  {!editingBasicInfo && (
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
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
                      </div>
                      <div className="flex items-center gap-2">
                        <Award className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className="text-xs text-gray-500">學歷</span>
                        <span className="text-sm font-medium text-gray-800 truncate">{editEducation || '—'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Globe className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className="text-xs text-gray-500">語言</span>
                        <span className="text-sm font-medium text-gray-800 truncate">{editLanguages || '—'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className="text-xs text-gray-500">管理經驗</span>
                        <span className="text-sm font-medium text-gray-800">{editManagement ? `有${editTeamSize ? `（${editTeamSize}）` : ''}` : '—'}</span>
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
                    </div>
                  )}

              {/* 外部連結：Google Drive / 作品集 */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">外部連結</h3>

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

                </div>
                )}
              </div>
              {/* ═══ End Block 4 ═══ */}

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
              <div data-tour="modal-work-history">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-blue-600" />
                    工作經歷
                    <span className="text-[10px] text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200 font-normal">影響 Grade 評級</span>
                  </h3>
                  <button
                    onClick={() => { setWorkForm({ company: '', title: '', start: '', end: '', description: '' }); setAddingWork(true); setEditingWorkIdx(null); }}
                    className="text-xs px-2 py-1 border border-blue-200 rounded text-blue-600 hover:bg-blue-50"
                  >
                    + 新增
                  </button>
                </div>
                <p className="text-[10px] text-gray-400 mb-3 ml-7">公司背景佔評級 25%、職涯穩定度佔 10%，AI 深度分析也會參考完整經歷</p>
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
                  <div className="p-4 bg-amber-50/50 rounded-lg text-center border border-amber-100">
                    <Briefcase className="w-8 h-8 mx-auto mb-2 text-amber-300" />
                    <p className="text-sm text-gray-500">尚無工作經歷</p>
                    <p className="text-[10px] text-amber-600 mt-1">⚠ 缺少工作經歷將影響 Grade 評級準確度（公司背景 25% + 穩定度 10%）</p>
                    <button onClick={() => { setWorkForm({ company: '', title: '', start: '', end: '', description: '' }); setAddingWork(true); }} className="mt-2 text-xs text-blue-600 hover:underline">+ 手動新增</button>
                  </div>
                )}
              </div>
              
              {/* Education */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Award className="w-5 h-5 text-blue-600" />
                    教育背景
                    <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 font-normal">部分職缺要求</span>
                  </h3>
                  <button
                    onClick={() => { setEduForm({ school: '', degree: '', major: '', start: '', end: '' }); setAddingEdu(true); setEditingEduIdx(null); }}
                    className="text-xs px-2 py-1 border border-blue-200 rounded text-blue-600 hover:bg-blue-50"
                  >
                    + 新增
                  </button>
                </div>
                <p className="text-[10px] text-gray-400 mb-3 ml-7">部分客戶職缺會要求學歷條件，AI 深度分析也會參考教育背景</p>
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
                  <div className="p-4 bg-blue-50/30 rounded-lg text-center border border-blue-100">
                    <Award className="w-8 h-8 mx-auto mb-2 text-blue-200" />
                    <p className="text-sm text-gray-500">尚無教育背景資料</p>
                    <p className="text-[10px] text-blue-500 mt-1">部分客戶職缺會要求學歷，建議填寫以提升推薦完整度</p>
                    <button onClick={() => { setEduForm({ school: '', degree: '', major: '', start: '', end: '' }); setAddingEdu(true); }} className="mt-2 text-xs text-blue-600 hover:underline">+ 手動新增</button>
                  </div>
                )}
              </div>
              
              {/* Action Buttons */}
              <div className="flex gap-3">
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
              </div>
              
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
          
          {activeTab === 'history' && (() => {
            const trackingArr = enrichedCandidate.progressTracking || candidate.progressTracking || [];
            return (
            <div className="space-y-4 min-h-[300px]">
              {/* Progress Timeline */}
              {trackingArr.length > 0 ? (
                <div className="space-y-3">
                  {trackingArr.map((event: any, i: number) => {
                    const isLast = i === trackingArr.length - 1;
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
                <div className="text-center py-6 bg-gray-50 border border-dashed border-gray-200 rounded-xl">
                  <Clock className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm font-medium text-gray-500">尚無進度追蹤記錄</p>
                  <p className="text-xs text-gray-400 mt-1">請點擊下方按鈕，開始追蹤候選人的招聘進度</p>
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
            );
          })()}

          {activeTab === 'notes' && (
            <div className="space-y-4 min-h-[300px]">
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
                  <div className="text-center py-6 bg-gray-50 border border-dashed border-gray-200 rounded-xl">
                    <MessageSquare className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm font-medium text-gray-500">尚無備註紀錄</p>
                    <p className="text-xs text-gray-400 mt-1">在下方輸入備註，系統會自動附加時間戳與您的名稱</p>
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

          {activeTab === 'ai_consultant' && (() => {
            const analysis = (enrichedCandidate as any).aiAnalysis as any;
            const letters = (enrichedCandidate as any).outreachLetters as any[] || [];

            if (!analysis) {
              return (
                <div className="p-8 text-center">
                  <Sparkles className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                  <h3 className="text-lg font-medium text-gray-600 mb-2">尚未執行 AI 顧問分析</h3>
                  <p className="text-sm text-gray-400 mb-4">請透過 AI Agent 觸發分析，結果將自動顯示在此頁面。</p>
                  <div className="inline-block bg-gray-50 rounded-lg p-4 text-left text-xs text-gray-500 max-w-md">
                    <p className="font-medium mb-1">API 端點：</p>
                    <code className="text-violet-600">PUT /api/ai-agent/candidates/{enrichedCandidate.id}/ai-analysis</code>
                  </div>
                </div>
              );
            }

            const eval0 = analysis.candidate_evaluation;
            const jobs = analysis.job_matchings || [];
            const scripts = analysis.phone_scripts || [];
            const rec = analysis.recommendation;

            const resultIcon = (r: string) => {
              if (r === 'pass') return <span className="text-emerald-600">✅</span>;
              if (r === 'warning') return <span className="text-amber-500">⚠️</span>;
              return <span className="text-red-500">❌</span>;
            };

            const verdictBadge = (v: string, score: number) => {
              const cfg = v === '建議送出' ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                : v === '條件式' ? 'bg-amber-100 text-amber-700 border-amber-200'
                : 'bg-red-100 text-red-700 border-red-200';
              return (
                <div className="flex items-center gap-2">
                  <span className={`text-2xl font-bold ${score >= 65 ? 'text-emerald-600' : score >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{score}</span>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded border ${cfg}`}>{v}</span>
                </div>
              );
            };

            return (
              <div className="space-y-4 p-4">
                {/* ① 開發信產生器 */}
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setOutreachCollapsed(!outreachCollapsed)}
                    className="w-full px-4 py-3 bg-gray-50 flex items-center justify-between hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-violet-600" />
                      <span className="font-medium text-sm">開發信產生器</span>
                      {letters.length > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700">{letters.length}</span>
                      )}
                    </div>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${outreachCollapsed ? '' : 'rotate-180'}`} />
                  </button>
                  {!outreachCollapsed && (
                    <div className="p-4 space-y-3">
                      {letters.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-2">尚未產生開發信。請透過 AI Agent 產生。</p>
                      ) : (
                        letters.map((letter: any) => (
                          <div key={letter.id} className="border border-gray-100 rounded-lg p-3 bg-white">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                  letter.channel === 'linkedin' ? 'bg-blue-100 text-blue-700' :
                                  letter.channel === 'email' ? 'bg-green-100 text-green-700' :
                                  'bg-orange-100 text-orange-700'
                                }`}>
                                  {letter.channel === 'linkedin' ? 'LinkedIn' : letter.channel === 'email' ? 'Email' : '簡訊'}
                                </span>
                                <span className="text-xs text-gray-500">{letter.job_title} — {letter.company}</span>
                              </div>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(letter.body);
                                  setCopiedLetterId(letter.id);
                                  setTimeout(() => setCopiedLetterId(null), 2000);
                                }}
                                className="text-xs text-violet-600 hover:text-violet-800"
                              >
                                {copiedLetterId === letter.id ? '已複製' : '📋 複製'}
                              </button>
                            </div>
                            {letter.subject && <p className="text-xs text-gray-500 mb-1">主旨：{letter.subject}</p>}
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">{letter.body}</p>
                            <p className="text-[10px] text-gray-400 mt-2">
                              {letter.generated_by} · {new Date(letter.generated_at).toLocaleDateString('zh-TW')}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* ② 人選評估報告 (STEP 0) */}
                {eval0 && (
                  <div className="border border-gray-200 rounded-lg p-4 space-y-4">
                    <h3 className="font-medium text-sm flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-blue-600" />
                      人選評估報告
                    </h3>

                    {/* 職涯曲線 */}
                    {eval0.career_curve && (
                      <div className="bg-blue-50 rounded-lg p-3">
                        <h4 className="text-xs font-medium text-blue-800 mb-1">職涯曲線</h4>
                        <p className="text-sm text-gray-700">{eval0.career_curve.summary}</p>
                        <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                          {eval0.career_curve.pattern}
                        </span>
                        {eval0.career_curve.details?.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {eval0.career_curve.details.map((d: any, i: number) => (
                              <div key={i} className="text-xs text-gray-600 flex items-center gap-1">
                                <span className="font-medium">{d.company}</span>
                                <span className="text-gray-400">·</span>
                                <span>{d.title}</span>
                                <span className="text-gray-400">·</span>
                                <span>{d.duration}</span>
                                {d.move_reason && <span className="text-gray-400 ml-1">→ {d.move_reason}</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* 人選調性 */}
                    {eval0.personality && (
                      <div className="bg-purple-50 rounded-lg p-3">
                        <h4 className="text-xs font-medium text-purple-800 mb-1">人選調性</h4>
                        <p className="text-sm font-medium text-gray-700 mb-1">{eval0.personality.type}</p>
                        <div className="flex flex-wrap gap-1 mb-1">
                          {eval0.personality.top3_strengths?.map((s: string, i: number) => (
                            <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">💪 {s}</span>
                          ))}
                        </div>
                        {eval0.personality.weaknesses?.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {eval0.personality.weaknesses.map((w: string, i: number) => (
                              <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-600">⚠️ {w}</span>
                            ))}
                          </div>
                        )}
                        {eval0.personality.evidence && (
                          <p className="text-xs text-gray-500 mt-1 italic">{eval0.personality.evidence}</p>
                        )}
                      </div>
                    )}

                    {/* 角色定位 */}
                    {eval0.role_positioning && (
                      <div className="bg-indigo-50 rounded-lg p-3">
                        <h4 className="text-xs font-medium text-indigo-800 mb-1">角色定位</h4>
                        <p className="text-sm text-gray-700 mb-1">{eval0.role_positioning.actual_role}</p>
                        <p className="text-xs text-gray-500 mb-2">技術光譜：{eval0.role_positioning.spectrum_position}</p>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-[10px] text-emerald-600 font-medium mb-1">適合</p>
                            {eval0.role_positioning.best_fit?.map((f: string, i: number) => (
                              <p key={i} className="text-xs text-gray-600">✅ {f}</p>
                            ))}
                          </div>
                          <div>
                            <p className="text-[10px] text-red-600 font-medium mb-1">不適合</p>
                            {eval0.role_positioning.not_fit?.map((f: string, i: number) => (
                              <p key={i} className="text-xs text-gray-600">❌ {f}</p>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 薪資推估 */}
                    {eval0.salary_estimate && (
                      <div className="bg-amber-50 rounded-lg p-3">
                        <h4 className="text-xs font-medium text-amber-800 mb-1">薪資推估</h4>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div><span className="text-gray-500">年資：</span>{eval0.salary_estimate.actual_years}年</div>
                          <div><span className="text-gray-500">職級：</span>{eval0.salary_estimate.current_level}</div>
                          <div><span className="text-gray-500">現職估薪：</span>{eval0.salary_estimate.current_estimate}</div>
                          <div><span className="text-gray-500">跳槽期望：</span>{eval0.salary_estimate.expected_range}</div>
                        </div>
                        {eval0.salary_estimate.risks?.length > 0 && (
                          <div className="mt-2">
                            {eval0.salary_estimate.risks.map((r: string, i: number) => (
                              <p key={i} className="text-xs text-red-600">⚠️ {r}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* ②-B 顧問必問清單 */}
                {analysis.consultant_questions?.questions?.length > 0 && (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <button
                      onClick={() => {
                        const el = document.getElementById('cq-collapse');
                        if (el) el.classList.toggle('hidden');
                      }}
                      className="w-full px-4 py-3 bg-gradient-to-r from-teal-50 to-cyan-50 flex items-center justify-between hover:from-teal-100 hover:to-cyan-100 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <MessageCircle className="w-4 h-4 text-teal-600" />
                        <span className="font-medium text-sm">顧問必問清單</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-700">
                          {analysis.consultant_questions.questions.length} 題
                        </span>
                      </div>
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    </button>
                    <div id="cq-collapse" className="p-4 space-y-2">
                      {analysis.consultant_questions.purpose && (
                        <p className="text-xs text-gray-500 italic mb-3">{analysis.consultant_questions.purpose}</p>
                      )}
                      {analysis.consultant_questions.questions.map((q: any) => (
                        <details key={q.number} className="bg-gray-50 rounded-lg group">
                          <summary className="px-3 py-2.5 cursor-pointer flex items-start gap-2 hover:bg-gray-100 rounded-lg transition-colors">
                            <span className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5 ${
                              q.related_jobs?.length > 0
                                ? 'bg-violet-100 text-violet-700'
                                : 'bg-teal-100 text-teal-700'
                            }`}>{q.number}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-800 font-medium leading-snug">{q.question}</p>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                  q.related_jobs?.length > 0
                                    ? 'bg-violet-50 text-violet-600'
                                    : 'bg-teal-50 text-teal-600'
                                }`}>
                                  {q.related_jobs?.length > 0 ? '職缺探測' : '通用背景'}
                                </span>
                                {q.related_jobs?.map((rj: any) => (
                                  <span key={rj.job_id} className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">
                                    #{rj.job_id} {rj.job_title}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </summary>
                          <div className="px-3 pb-3 pt-1 ml-7 space-y-2 text-xs">
                            <div className="bg-white rounded p-2 space-y-1.5">
                              <p><span className="font-medium text-teal-700">為什麼問：</span><span className="text-gray-700">{q.why_ask}</span></p>
                              {q.trust_signal && (
                                <p><span className="font-medium text-blue-700">信任訊號：</span><span className="text-gray-700">{q.trust_signal}</span></p>
                              )}
                              {q.good_answer_hint && (
                                <p><span className="font-medium text-emerald-700">好回答：</span><span className="text-gray-600">{q.good_answer_hint}</span></p>
                              )}
                              {q.red_flag && (
                                <p><span className="font-medium text-red-600">⚠️ 警訊：</span><span className="text-gray-600">{q.red_flag}</span></p>
                              )}
                            </div>
                            {q.related_jobs?.length > 0 && (
                              <div className="space-y-1">
                                {q.related_jobs.map((rj: any) => (
                                  <div key={rj.job_id} className="bg-violet-50 rounded p-2 text-xs">
                                    <span className="font-medium text-violet-700">{rj.job_title}：</span>
                                    <span className="text-gray-700">{rj.if_answer}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </details>
                      ))}
                    </div>
                  </div>
                )}

                {/* ③ 職缺匹配 (STEP 1) */}
                {jobs.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-medium text-sm flex items-center gap-2 px-1">
                      <Target className="w-4 h-4 text-violet-600" />
                      職缺匹配分析
                    </h3>
                    {jobs.map((job: any, idx: number) => (
                      <div key={idx} className="border border-gray-200 rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-800">
                              {job.job_title} — {job.company}
                            </p>
                            {job.company_analysis && (
                              <p className="text-xs text-gray-500 mt-0.5">{job.company_analysis}</p>
                            )}
                          </div>
                          {verdictBadge(job.verdict, job.match_score)}
                        </div>

                        {/* 必要條件 */}
                        {job.must_have?.length > 0 && (
                          <div>
                            <h5 className="text-xs font-medium text-gray-600 mb-1">必要條件</h5>
                            <table className="w-full text-xs">
                              <thead><tr className="text-gray-500 border-b">
                                <th className="text-left py-1 font-medium">條件</th>
                                <th className="text-left py-1 font-medium">人選實際</th>
                                <th className="text-center py-1 font-medium w-10">結果</th>
                              </tr></thead>
                              <tbody>
                                {job.must_have.map((h: any, i: number) => (
                                  <tr key={i} className="border-b border-gray-50">
                                    <td className="py-1 text-gray-700">{h.condition}</td>
                                    <td className="py-1 text-gray-600">{h.actual}</td>
                                    <td className="py-1 text-center">{resultIcon(h.result)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {/* 加分條件 */}
                        {job.nice_to_have?.length > 0 && (
                          <div>
                            <h5 className="text-xs font-medium text-gray-600 mb-1">加分條件</h5>
                            <table className="w-full text-xs">
                              <thead><tr className="text-gray-500 border-b">
                                <th className="text-left py-1 font-medium">條件</th>
                                <th className="text-left py-1 font-medium">人選實際</th>
                                <th className="text-center py-1 font-medium w-10">結果</th>
                              </tr></thead>
                              <tbody>
                                {job.nice_to_have.map((h: any, i: number) => (
                                  <tr key={i} className="border-b border-gray-50">
                                    <td className="py-1 text-gray-700">{h.condition}</td>
                                    <td className="py-1 text-gray-600">{h.actual}</td>
                                    <td className="py-1 text-center">{resultIcon(h.result)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="bg-emerald-50 rounded p-2">
                            <span className="text-emerald-700 font-medium">最強命中：</span>
                            <span className="text-gray-700">{job.strongest_match}</span>
                          </div>
                          <div className="bg-red-50 rounded p-2">
                            <span className="text-red-700 font-medium">主要缺口：</span>
                            <span className="text-gray-700">{job.main_gap}</span>
                          </div>
                        </div>

                        {job.hard_block && (
                          <div className="bg-red-100 border border-red-300 rounded p-2 text-xs text-red-800">
                            🚨 硬性門檻：{job.hard_block}
                          </div>
                        )}

                        {job.salary_fit && (
                          <p className="text-xs text-gray-500">💰 薪資：{job.salary_fit}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* ④ 電話 SOP & 必問清單 (STEP 2-B,C) */}
                {scripts.length > 0 && (
                  <div className="border border-gray-200 rounded-lg p-4 space-y-3">
                    <h3 className="font-medium text-sm flex items-center gap-2">
                      <Phone className="w-4 h-4 text-green-600" />
                      電話 SOP & 必問清單
                    </h3>
                    {scripts.map((script: any, idx: number) => {
                      const jobMatch = jobs.find((j: any) => j.job_id === script.job_id);
                      return (
                        <details key={idx} className="bg-gray-50 rounded-lg" open={idx === 0}>
                          <summary className="px-3 py-2 cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
                            {jobMatch?.job_title || `Job #${script.job_id}`} — {jobMatch?.company || ''}
                          </summary>
                          <div className="px-3 pb-3 space-y-3">
                            {/* 開場 */}
                            <div>
                              <h5 className="text-xs font-medium text-green-700 mb-1">開場</h5>
                              <p className="text-xs text-gray-700 bg-white rounded p-2 italic">{script.opening}</p>
                            </div>

                            {/* 動機探索 */}
                            {script.motivation_probes?.length > 0 && (
                              <div>
                                <h5 className="text-xs font-medium text-blue-700 mb-1">異動動機探索</h5>
                                {script.motivation_probes.map((p: any, i: number) => (
                                  <div key={i} className="text-xs bg-white rounded p-2 mb-1">
                                    <span className="font-medium text-gray-700">若答「{p.answer_type}」</span>
                                    <span className="text-gray-500"> → {p.interpretation}</span>
                                    <span className="text-blue-600 ml-1">策略：{p.strategy}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* 技術確認 */}
                            {script.technical_checks?.length > 0 && (
                              <div>
                                <h5 className="text-xs font-medium text-purple-700 mb-1">技術確認（缺口）</h5>
                                {script.technical_checks.map((t: string, i: number) => (
                                  <p key={i} className="text-xs text-gray-700 ml-2">• {t}</p>
                                ))}
                              </div>
                            )}

                            {/* 職缺介紹 */}
                            {script.job_pitch && (
                              <div>
                                <h5 className="text-xs font-medium text-violet-700 mb-1">職缺介紹話術</h5>
                                <p className="text-xs text-gray-700 bg-white rounded p-2 italic">{script.job_pitch}</p>
                              </div>
                            )}

                            {/* 收尾 */}
                            {script.closing && (
                              <div>
                                <h5 className="text-xs font-medium text-gray-600 mb-1">收尾</h5>
                                <p className="text-xs text-gray-700 bg-white rounded p-2 italic">{script.closing}</p>
                              </div>
                            )}

                            {/* 必問清單 */}
                            {script.must_ask?.length > 0 && (
                              <div>
                                <h5 className="text-xs font-medium text-red-700 mb-1">必問清單</h5>
                                <table className="w-full text-xs">
                                  <thead><tr className="text-gray-500 border-b">
                                    <th className="text-left py-1 font-medium w-6">#</th>
                                    <th className="text-left py-1 font-medium">提問</th>
                                    <th className="text-left py-1 font-medium">答案意義</th>
                                    <th className="text-center py-1 font-medium w-16">一票否決</th>
                                  </tr></thead>
                                  <tbody>
                                    {script.must_ask.map((q: any) => (
                                      <tr key={q.number} className={`border-b border-gray-50 ${q.is_veto ? 'bg-red-50' : ''}`}>
                                        <td className="py-1">{q.number}</td>
                                        <td className="py-1 text-gray-700">{q.question}</td>
                                        <td className="py-1 text-gray-600">{q.meaning}</td>
                                        <td className="py-1 text-center">{q.is_veto ? '❌ 是' : '否'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </details>
                      );
                    })}
                  </div>
                )}

                {/* ⑤ 顧問建議 (STEP 2-A,D) */}
                {rec && (
                  <div className="border border-gray-200 rounded-lg p-4 space-y-3">
                    <h3 className="font-medium text-sm flex items-center gap-2">
                      <Lightbulb className="w-4 h-4 text-amber-600" />
                      顧問建議
                    </h3>

                    {/* 匹配總覽表 */}
                    {rec.summary_table?.length > 0 && (
                      <table className="w-full text-xs">
                        <thead><tr className="text-gray-500 border-b">
                          <th className="text-left py-1 font-medium">職缺</th>
                          <th className="text-center py-1 font-medium">分數</th>
                          <th className="text-center py-1 font-medium">判定</th>
                          <th className="text-center py-1 font-medium">優先序</th>
                        </tr></thead>
                        <tbody>
                          {rec.summary_table.map((row: any) => (
                            <tr key={row.job_id} className="border-b border-gray-50">
                              <td className="py-1.5 text-gray-700">{row.job_title} — {row.company}</td>
                              <td className="py-1.5 text-center font-bold">{row.score}</td>
                              <td className="py-1.5 text-center">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                                  row.verdict === '建議送出' ? 'bg-emerald-100 text-emerald-700' :
                                  row.verdict === '條件式' ? 'bg-amber-100 text-amber-700' :
                                  'bg-red-100 text-red-700'
                                }`}>{row.verdict}</span>
                              </td>
                              <td className="py-1.5 text-center">
                                {row.priority === 1 ? '🥇' : row.priority === 2 ? '🥈' : '🥉'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}

                    {/* 建議 */}
                    <div className="bg-amber-50 rounded-lg p-3 space-y-2 text-xs">
                      {rec.first_call_reason && (
                        <p><span className="font-medium text-amber-800">先打：</span>
                        <span className="text-gray-700">{rec.first_call_reason}</span></p>
                      )}
                      {rec.overall_pushability && (
                        <p><span className="font-medium text-amber-800">整體可推性：</span>
                        <span className={`font-bold ${
                          rec.overall_pushability === '高' ? 'text-emerald-700' :
                          rec.overall_pushability.includes('中') ? 'text-amber-700' :
                          'text-red-700'
                        }`}>{rec.overall_pushability}</span>
                        {rec.pushability_detail && <span className="text-gray-600 ml-1">— {rec.pushability_detail}</span>}
                        </p>
                      )}
                      {rec.fallback_note && (
                        <p className="text-gray-500 italic">💡 {rec.fallback_note}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* ⑥ 底部資訊 */}
                <div className="flex items-center justify-between text-[10px] text-gray-400 px-1">
                  <span>
                    分析時間：{analysis.analyzed_at ? new Date(analysis.analyzed_at).toLocaleString('zh-TW') : '—'}
                    {' · '}
                    模型：{analysis.analyzed_by || '—'}
                  </span>
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
                <div className="relative" data-tour="modal-update-status">
                  <button
                    onClick={() => setShowStatusMenu(!showStatusMenu)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5"
                  >
                    更新狀態
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showStatusMenu ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Status dropdown menu (opens upward) */}
                  {showStatusMenu && (
                    <>
                      {/* Backdrop to close on outside click */}
                      <div className="fixed inset-0 z-40" onClick={() => setShowStatusMenu(false)} />
                      <div className="absolute bottom-full right-0 mb-2 w-48 bg-white border border-gray-200 rounded-xl shadow-xl z-50 py-1.5 overflow-hidden">
                        <div className="px-3 py-1.5 text-[10px] text-gray-400 font-medium border-b border-gray-100 mb-1">選擇新狀態</div>
                        {(Object.keys(CANDIDATE_STATUS_CONFIG) as Array<CandidateStatus>).map((statusKey) => {
                          const config = CANDIDATE_STATUS_CONFIG[statusKey];
                          const isCurrent = candidate.status === statusKey;
                          const dotColorMap: Record<string, string> = {
                            slate: 'bg-slate-400', violet: 'bg-violet-500', blue: 'bg-blue-500',
                            indigo: 'bg-indigo-500', amber: 'bg-amber-500', green: 'bg-green-500',
                            rose: 'bg-rose-500', purple: 'bg-purple-500', cyan: 'bg-cyan-500'
                          };
                          return (
                            <button
                              key={statusKey}
                              type="button"
                              disabled={isCurrent}
                              onClick={() => {
                                setShowStatusMenu(false);
                                onUpdateStatus(candidate.id, statusKey);
                              }}
                              className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2.5 transition-colors ${
                                isCurrent
                                  ? 'bg-blue-50 font-medium cursor-default'
                                  : 'hover:bg-gray-50 cursor-pointer'
                              }`}
                            >
                              <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotColorMap[config.color] || 'bg-gray-400'}`} />
                              <span className={isCurrent ? 'text-blue-700' : 'text-gray-700'}>{config.label}</span>
                              {isCurrent && <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 ml-auto" />}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
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
