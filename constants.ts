import { CandidateStatus, CandidateSource, SubmissionRule } from './types';

// ===== Step1ne Headhunter Extensions =====

// Google Sheets 配置
export const SHEETS_CONFIG = {
  SHEET_ID: import.meta.env.VITE_SHEET_ID || '1PunpaDAFBPBL_I76AiRYGXKaXDZvMl1c262SEtxRk6Q',
  ACCOUNT: import.meta.env.VITE_GOOGLE_ACCOUNT || 'aijessie88@step1ne.com',
  TABS: {
    CANDIDATES: '履歷池v2',
    JOBS: 'step1ne 職缺管理',
    PIPELINE_JACKY: 'Jacky Pipeline',
    PIPELINE_PHOEBE: 'Phoebe Pipeline'
  }
};

// Google Drive 配置
export const DRIVE_CONFIG = {
  FOLDER_ID: import.meta.env.VITE_DRIVE_FOLDER_ID || '12lfoz7qwjhWMwbCJL_SfOf3icCOTCydS'
};

// 本地儲存 Keys (擴充)
export const STORAGE_KEYS_EXT = {
  CANDIDATES_CACHE: 'step1ne_candidates_cache',
  JOBS_CACHE: 'step1ne_jobs_cache',
  LAST_SYNC: 'step1ne_last_sync'
};

// API 端點
export const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// 快取過期時間（毫秒）
export const CACHE_EXPIRY = 30 * 60 * 1000; // 30 分鐘

// ===== Step1ne Headhunter - 候選人相關配置 =====

// 候選人狀態配置
export const CANDIDATE_STATUS_CONFIG = {
  [CandidateStatus.NOT_STARTED]: {
    label: '未開始',
    color: 'slate',
    bgColor: 'bg-slate-100',
    textColor: 'text-slate-700',
    borderColor: 'border-slate-300'
  },
  [CandidateStatus.AI_RECOMMENDED]: {
    label: 'AI推薦',
    color: 'violet',
    bgColor: 'bg-violet-100',
    textColor: 'text-violet-700',
    borderColor: 'border-violet-300'
  },
  [CandidateStatus.CONTACTED]: {
    label: '聯繫階段',
    color: 'blue',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-300'
  },
  [CandidateStatus.INTERVIEWED]: {
    label: '面試階段',
    color: 'indigo',
    bgColor: 'bg-indigo-100',
    textColor: 'text-indigo-700',
    borderColor: 'border-indigo-300'
  },
  [CandidateStatus.OFFER]: {
    label: 'Offer',
    color: 'amber',
    bgColor: 'bg-amber-100',
    textColor: 'text-amber-700',
    borderColor: 'border-amber-300'
  },
  [CandidateStatus.ONBOARDED]: {
    label: 'on board',
    color: 'green',
    bgColor: 'bg-green-100',
    textColor: 'text-green-700',
    borderColor: 'border-green-300'
  },
  [CandidateStatus.REJECTED]: {
    label: '婉拒',
    color: 'rose',
    bgColor: 'bg-rose-100',
    textColor: 'text-rose-700',
    borderColor: 'border-rose-300'
  },
  [CandidateStatus.OTHER]: {
    label: '備選人才',
    color: 'purple',
    bgColor: 'bg-purple-100',
    textColor: 'text-purple-700',
    borderColor: 'border-purple-300'
  },
  [CandidateStatus.CRAWLER_SCREENED]: {
    label: '爬蟲初篩',
    color: 'cyan',
    bgColor: 'bg-cyan-100',
    textColor: 'text-cyan-700',
    borderColor: 'border-cyan-300'
  },
  [CandidateStatus.FOREIGN_FILTERED]: {
    label: '外籍已過濾',
    color: 'gray',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-500',
    borderColor: 'border-gray-300'
  }
};


// 候選人來源配置
export const SOURCE_CONFIG = {
  [CandidateSource.LINKEDIN]: {
    label: 'LinkedIn',
    icon: '💼',
    color: 'blue'
  },
  [CandidateSource.GITHUB]: {
    label: 'GitHub',
    icon: '👨‍💻',
    color: 'gray'
  },
  [CandidateSource.GMAIL]: {
    label: 'Gmail 進件',
    icon: '📧',
    color: 'red'
  },
  [CandidateSource.REFERRAL]: {
    label: '推薦',
    icon: '🤝',
    color: 'green'
  },
  [CandidateSource.HEADHUNT]: {
    label: '主動開發',
    icon: '🎯',
    color: 'purple'
  },
  [CandidateSource.JOB_BOARD]: {
    label: '人力銀行',
    icon: '📋',
    color: 'yellow'
  },
  [CandidateSource.CRAWLER]: {
    label: '爬蟲匯入',
    icon: '🤖',
    color: 'teal'
  },
  [CandidateSource.OTHER]: {
    label: '其他',
    icon: '📁',
    color: 'gray'
  }
};

// ===== 人才看板分類配置 =====

// Grade 等級 (AI + 顧問確認)
export const GRADE_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; description: string }> = {
  A: { label: 'A 級', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', description: '核心人選 — 技能+經歷高度匹配' },
  B: { label: 'B 級', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', description: '合格人選 — 基本條件符合，可培養' },
  C: { label: 'C 級', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', description: '觀察人選 — 部分條件不符，需進一步確認' },
  D: { label: 'D 級', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', description: '不適合 — 條件明顯不符' },
};

// Source Tier (公司來源層級)
export const TIER_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; description: string }> = {
  T1: { label: 'T1', color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200', description: '一線大廠 — FAANG / 獨角獸' },
  T2: { label: 'T2', color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200', description: '知名企業 — 上市/知名新創' },
  T3: { label: 'T3', color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200', description: '一般企業 — 中小型/傳產' },
};

// Heat 熱度 (自動推算 + 顧問覆寫)
export const HEAT_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; dot: string }> = {
  Hot:  { label: '熱門', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', dot: 'bg-red-500' },
  Warm: { label: '溫和', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', dot: 'bg-amber-400' },
  Cold: { label: '冷門', color: 'text-blue-500', bg: 'bg-blue-50', border: 'border-blue-200', dot: 'bg-blue-400' },
};

// Heat 自動推算邏輯
// 注意：API 回傳 camelCase (jobSearchStatusEnum, heatLevel)，
//       但部分場景可能使用 snake_case，因此兩種都支援
export function computeHeatLevel(candidate: {
  job_search_status_enum?: string | null;
  jobSearchStatusEnum?: string | null;
  lastContactAt?: string | null;
  heat_level?: string | null;
  heatLevel?: string | null;
}): string {
  // 顧問手動覆寫優先（支援 camelCase + snake_case）
  const manualHeat = candidate.heat_level || candidate.heatLevel;
  if (manualHeat) return manualHeat;
  // 自動推算：依 job_search_status_enum
  const status = candidate.job_search_status_enum || candidate.jobSearchStatusEnum;
  if (status === 'active') return 'Hot';
  if (status === 'not_open') return 'Cold';
  // passive: 看最後聯絡日期
  if (candidate.lastContactAt) {
    const daysSince = Math.floor((Date.now() - new Date(candidate.lastContactAt).getTime()) / 86400000);
    return daysSince <= 14 ? 'Warm' : 'Cold';
  }
  return 'Cold';
}

// ===== Rule-based Grade / Tier 自動建議（Layer 1, 純前端即時計算）=====

// 知名公司 → Tier 映射
const T1_COMPANIES = [
  'google', 'meta', 'facebook', 'amazon', 'apple', 'microsoft', 'netflix', 'nvidia',
  'tsmc', '台積電', 'broadcom', 'qualcomm', 'intel', 'amd', 'arm', 'asml',
  'uber', 'bytedance', 'tiktok', 'spotify', 'linkedin', 'twitter', 'stripe',
  'salesforce', 'adobe', 'oracle', 'sap', 'vmware', 'snowflake', 'databricks',
  'mediatek', '聯發科', 'synopsys', 'cadence', 'marvell',
  'jpmorgan', 'goldman sachs', 'morgan stanley', 'ubs', 'citadel',
  'tesla', 'spacex',
];
const T2_COMPANIES = [
  'shopee', '蝦皮', 'line', 'grab', 'gojek', 'sea group',
  'appier', 'gogolook', 'dcard', 'ikala', '91app', 'shopline',
  'asus', '華碩', 'acer', '宏碁', 'htc', 'delta', '台達', 'foxconn', '鴻海',
  'quanta', '廣達', 'pegatron', '和碩', 'compal', '仁寶',
  'realtek', '瑞昱', 'novatek', '聯詠', 'micron', '美光',
  'cathay', '國泰', 'ctbc', '中信', 'fubon', '富邦', 'esun', '玉山', 'taishin', '台新',
  'momo', 'pchome', 'foodpanda', 'uber eats',
  'accenture', 'deloitte', 'ey', 'kpmg', 'pwc', 'mckinsey', 'bain', 'bcg',
  'atlassian', 'cloudflare', 'datadog', 'twilio', 'hubspot', 'slack',
  'garena', 'riot', 'blizzard', 'ea', 'ubisoft',
  'gogoro', 'binance', 'coinbase',
  '中華電信', '遠傳', '台灣大哥大',
  '精誠', '資拓宏宇', 'tcs', 'infosys', 'capgemini',
];

function matchCompanyTier(company: string): 'T1' | 'T2' | 'T3' | null {
  if (!company) return null;
  const lower = company.toLowerCase().trim();
  if (T1_COMPANIES.some(c => lower.includes(c) || c.includes(lower))) return 'T1';
  if (T2_COMPANIES.some(c => lower.includes(c) || c.includes(lower))) return 'T2';
  return null; // 不確定時不建議
}

export interface AutoGradeTierSuggestion {
  suggestedGrade: string | null;
  suggestedTier: string | null;
  confidence: number; // 0-100
  reasons: string[];
  scores: {
    companyTier: number;
    yearsScore: number;
    skillsScore: number;
    seniorityScore: number;
    dataCompletenessScore: number;
  };
}

export function computeAutoGradeTier(candidate: {
  currentCompany?: string;
  currentTitle?: string;
  roleFamily?: string;
  canonicalRole?: string;
  seniorityLevel?: string;
  totalYears?: number;
  years?: number;
  normalizedSkills?: string[];
  skills?: string | string[];
  industryTag?: string;
  expectedSalaryMin?: number;
  expectedSalaryMax?: number;
  noticePeriodEnum?: string;
  jobSearchStatusEnum?: string;
  workHistory?: any[];
  dataQuality?: { completenessScore?: number };
}): AutoGradeTierSuggestion {
  const reasons: string[] = [];
  let totalScore = 0;
  let maxScore = 0;

  // ── 1. Company Tier (25 分) ──
  const company = candidate.currentCompany || '';
  const workCompanies = (candidate.workHistory || []).map((w: any) => w.company || '');
  const allCompanies = [company, ...workCompanies].filter(Boolean);

  let companyTierScore = 0;
  let detectedTier: 'T1' | 'T2' | 'T3' | null = null;

  for (const c of allCompanies) {
    const tier = matchCompanyTier(c);
    if (tier === 'T1') { detectedTier = 'T1'; companyTierScore = 25; break; }
    if (tier === 'T2' && detectedTier !== 'T1') { detectedTier = 'T2'; companyTierScore = 18; }
  }
  if (!detectedTier && allCompanies.length > 0) {
    detectedTier = 'T3';
    companyTierScore = 8;
  }

  if (detectedTier === 'T1') reasons.push(`來自 T1 公司（${company || workCompanies[0]}）`);
  else if (detectedTier === 'T2') reasons.push(`來自 T2 知名企業（${company || workCompanies[0]}）`);
  else if (company) reasons.push(`一般企業背景（${company}）`);

  totalScore += companyTierScore;
  maxScore += 25;

  // ── 2. Years of Experience (20 分) ──
  const years = candidate.totalYears || candidate.years || 0;
  let yearsScore = 0;
  if (years >= 10) { yearsScore = 20; reasons.push(`${years} 年資深經驗`); }
  else if (years >= 7) { yearsScore = 17; reasons.push(`${years} 年豐富經驗`); }
  else if (years >= 5) { yearsScore = 14; reasons.push(`${years} 年中高階經驗`); }
  else if (years >= 3) { yearsScore = 10; reasons.push(`${years} 年基礎經驗`); }
  else if (years >= 1) { yearsScore = 6; reasons.push(`${years} 年經驗（偏初階）`); }
  else { yearsScore = 0; }

  totalScore += yearsScore;
  maxScore += 20;

  // ── 3. Skills Richness (20 分) ──
  const skills: string[] = Array.isArray(candidate.normalizedSkills) && candidate.normalizedSkills.length > 0
    ? candidate.normalizedSkills
    : (typeof candidate.skills === 'string'
        ? candidate.skills.split(/[,、，]+/).map(s => s.trim()).filter(Boolean)
        : Array.isArray(candidate.skills) ? candidate.skills : []);

  let skillsScore = 0;
  if (skills.length >= 8) { skillsScore = 20; reasons.push(`技能豐富（${skills.length} 項）`); }
  else if (skills.length >= 5) { skillsScore = 15; reasons.push(`技能良好（${skills.length} 項）`); }
  else if (skills.length >= 3) { skillsScore = 10; reasons.push(`基礎技能（${skills.length} 項）`); }
  else if (skills.length >= 1) { skillsScore = 5; }
  else { skillsScore = 0; }

  totalScore += skillsScore;
  maxScore += 20;

  // ── 4. Seniority Level (15 分) ──
  const seniority = (candidate.seniorityLevel || '').toLowerCase();
  let seniorityScore = 0;
  if (['cxo', 'vp', 'director'].includes(seniority)) { seniorityScore = 15; reasons.push(`高階主管級別`); }
  else if (['principal', 'staff'].includes(seniority)) { seniorityScore = 13; reasons.push(`Staff / Principal 等級`); }
  else if (['lead', 'manager'].includes(seniority)) { seniorityScore = 11; reasons.push(`Lead / Manager 等級`); }
  else if (seniority === 'senior') { seniorityScore = 9; reasons.push(`Senior 等級`); }
  else if (seniority === 'ic') { seniorityScore = 6; }
  else if (seniority === 'junior') { seniorityScore = 3; }
  else if (seniority === 'intern') { seniorityScore = 1; }

  totalScore += seniorityScore;
  maxScore += 15;

  // ── 5. Data Completeness (10 分) ──
  const completeness = candidate.dataQuality?.completenessScore ?? 0;
  let dataScore = Math.round(completeness / 10);
  totalScore += dataScore;
  maxScore += 10;

  // ── 6. Career Stability (10 分) ──
  const workHistory = candidate.workHistory || [];
  let stabilityScore = 0;
  if (workHistory.length >= 2) {
    const avgMonths = workHistory.reduce((sum: number, w: any) => sum + (w.duration_months || 0), 0) / workHistory.length;
    if (avgMonths >= 36) { stabilityScore = 10; reasons.push('職涯穩定（平均任期 3+ 年）'); }
    else if (avgMonths >= 24) { stabilityScore = 7; }
    else if (avgMonths >= 12) { stabilityScore = 4; }
    else { stabilityScore = 1; reasons.push('頻繁跳槽（平均任期 < 1 年）'); }
  }
  totalScore += stabilityScore;
  maxScore += 10;

  // ── 計算百分比 & 映射 Grade ──
  const pct = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

  let suggestedGrade: string | null = null;
  if (pct >= 80) suggestedGrade = 'A';
  else if (pct >= 60) suggestedGrade = 'B';
  else if (pct >= 40) suggestedGrade = 'C';
  else if (pct > 0) suggestedGrade = 'D';

  // 信心度：資料越完整信心越高
  const hasCompany = !!company;
  const hasYears = years > 0;
  const hasSkills = skills.length >= 3;
  const hasSeniority = !!seniority;
  const filledFactors = [hasCompany, hasYears, hasSkills, hasSeniority].filter(Boolean).length;
  const confidence = Math.min(100, Math.round(filledFactors / 4 * 70 + completeness * 0.3));

  return {
    suggestedGrade,
    suggestedTier: detectedTier,
    confidence,
    reasons,
    scores: {
      companyTier: companyTierScore,
      yearsScore,
      skillsScore,
      seniorityScore,
      dataCompletenessScore: dataScore,
    },
  };
}

// 客戶送件規範預設模板
export const SUBMISSION_RULE_PRESETS: Omit<SubmissionRule, 'id' | 'sort_order'>[] = [
  { rule_type: 'content_format', label: '必須使用中文姓名', field_key: 'name', check_config: { format: 'chinese_name' }, is_auto_checkable: true, enabled: true },
  { rule_type: 'field_required', label: '需填寫英文名', field_key: 'english_name', is_auto_checkable: true, enabled: true },
  { rule_type: 'field_required', label: '要求包含期望薪資', field_key: 'expected_salary', is_auto_checkable: true, enabled: true },
  { rule_type: 'field_required', label: '需填寫目前薪資', field_key: 'current_salary', is_auto_checkable: true, enabled: true },
  { rule_type: 'link_required', label: '需附 Portfolio / 作品集連結', field_key: 'resume_link', check_config: { link_type: 'resumeLink' }, is_auto_checkable: true, enabled: true },
  { rule_type: 'link_required', label: '需附 GitHub 連結', field_key: 'github_url', check_config: { link_type: 'githubUrl' }, is_auto_checkable: true, enabled: true },
  { rule_type: 'link_required', label: '需附 LinkedIn 連結', field_key: 'linkedin_url', check_config: { link_type: 'linkedinUrl' }, is_auto_checkable: true, enabled: true },
  { rule_type: 'resume_version', label: '匿名履歷需附英文版', check_config: { resume_lang: 'en' }, is_auto_checkable: false, enabled: true },
  { rule_type: 'field_required', label: '需填寫語言能力', field_key: 'languages', is_auto_checkable: true, enabled: true },
  { rule_type: 'field_required', label: '需填寫證照', field_key: 'certifications', is_auto_checkable: true, enabled: true },
];
