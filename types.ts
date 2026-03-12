
// ==================== BD 客戶開發 ====================

export type BDStatus = '開發中' | '接洽中' | '提案中' | '合約階段' | '合作中' | '暫停' | '流失';

export interface Client {
  id: string;
  company_name: string;
  industry?: string;
  company_size?: string;
  website?: string;
  bd_status: BDStatus;
  bd_source?: string;
  contact_name?: string;
  contact_title?: string;
  contact_email?: string;
  contact_phone?: string;
  contact_linkedin?: string;
  consultant?: string;
  contract_type?: string;
  fee_percentage?: number;
  contract_start?: string;
  contract_end?: string;
  notes?: string;
  url_104?: string;
  url_1111?: string;
  job_count?: number;
  created_at: string;
  updated_at: string;
}

export interface BDContact {
  id: string;
  client_id: string;
  contact_date: string;
  contact_type?: string;  // 電話/Email/拜訪/視訊/LINE
  summary?: string;
  next_action?: string;
  next_action_date?: string;
  by_user?: string;
  created_at: string;
}

export const BD_STATUS_CONFIG: Record<BDStatus, { label: string; color: string; bg: string; icon: string }> = {
  '開發中':  { label: '開發中',  color: 'text-slate-700',  bg: 'bg-slate-100',  icon: '🔍' },
  '接洽中':  { label: '接洽中',  color: 'text-blue-700',   bg: 'bg-blue-100',   icon: '📞' },
  '提案中':  { label: '提案中',  color: 'text-indigo-700', bg: 'bg-indigo-100', icon: '📋' },
  '合約階段': { label: '合約階段', color: 'text-amber-700',  bg: 'bg-amber-100',  icon: '📄' },
  '合作中':  { label: '合作中',  color: 'text-green-700',  bg: 'bg-green-100',  icon: '✅' },
  '暫停':    { label: '暫停',    color: 'text-orange-700', bg: 'bg-orange-100', icon: '⏸️' },
  '流失':    { label: '流失',    color: 'text-red-700',    bg: 'bg-red-100',    icon: '❌' },
};

// ==================== 原有型別 ====================

export enum Role {
  ADMIN = 'ADMIN',
  REVIEWER = 'REVIEWER'
}

export enum ContactStatus {
  UNRESPONDED = '未回覆',
  RESPONDED = '已回覆',
  LINE_ADDED = '已加賴',
  CALLED = '已通話'
}

export enum Platform {
  FB = 'FB',
  THREADS = 'Threads',
  PRO360 = 'PRO360',
  OTHER = '其他'
}

export enum LeadStatus {
  TO_IMPORT = '待匯入',
  TO_FILTER = '待篩選',
  CONTACTED = '已接洽',
  QUOTING = '報價中',
  IN_PROGRESS = '製作中',
  WON = '已成交',
  CLOSED = '結案',
  CANCELLED = '取消',
  DECLINED = '婉拒/無法聯繫'
}

export enum Decision {
  ACCEPT = 'accept',
  REJECT = 'reject',
  PENDING = 'pending'
}

export enum RejectReason {
  LOW_BUDGET = '預算太低',
  TECH_MISMATCH = '不符合技術',
  TIGHT_SCHEDULE = '時程太趕',
  HIGH_RISK = '風險高',
  OTHER = '其他'
}

export interface UserProfile {
  uid: string;
  email: string;
  role: Role;
  displayName: string;
  password?: string; // 密碼（可選，用於內部員工）
  isActive?: boolean; // 是否啟用
  createdAt?: string; // 創建時間
  avatar?: string; // 大頭照（Base64 或 URL）
  status?: string; // 個人狀態（例如：在線、忙碌、離開等）
  isOnline?: boolean; // 是否在線
  lastSeen?: string; // 最後上線時間
  // 顧問聯絡資訊（供 AIbot 使用）
  contactPhone?: string;  // 工作電話
  contactEmail?: string;  // 工作 Email
  lineId?: string;        // LINE ID
  telegramHandle?: string; // Telegram 帳號
  githubToken?: string;   // GitHub Personal Access Token（供 talent sourcing 使用）
  braveApiKey?: string;   // Brave Search API Key（LinkedIn 搜尋第三層備援）
}

export interface Lead {
  id: string;
  case_code?: string; // 案件編號（例如：aijob-001）
  contact_status: ContactStatus;
  platform: Platform;
  platform_id: string;
  need: string;
  budget_text: string;
  posted_at: string; // ISO String
  note: string;
  links: string[];
  
  internal_remarks?: string;
  remarks_author?: string;
  
  phone?: string;
  email?: string;
  location?: string;
  
  // 新增欄位
  estimated_duration?: string; // 預計製作週期（例如：2週、1個月）
  contact_method?: string; // 客戶聯繫方式（例如：電話、Email、Line等）
  
  status: LeadStatus;
  decision: Decision;
  decision_by?: string; // 新增：審核人姓名
  reject_reason?: RejectReason;
  review_note?: string;
  assigned_to?: string; 
  assigned_to_name?: string;
  priority: number; 
  
  created_by: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
  last_action_by?: string; 
  
  // 進度更新和歷史記錄
  progress_updates?: ProgressUpdate[]; // 近期進度更新
  change_history?: ChangeHistory[]; // 修改歷史記錄
  
  // 成本和利潤記錄
  cost_records?: CostRecord[]; // 成本記錄
  profit_records?: ProfitRecord[]; // 利潤記錄
  
  // 合約和文件
  contracts?: string[]; // 合約文件（base64 或 URL）
}

export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DECISION = 'DECISION',
  MOVE_STATUS = 'MOVE_STATUS'
}

export interface AuditLog {
  id: string;
  lead_id: string;
  actor_uid: string;
  actor_name: string;
  action: AuditAction;
  before?: any;
  after?: any;
  created_at: string;
}

// 進度更新記錄
export interface ProgressUpdate {
  id: string;
  lead_id: string;
  content: string; // 進度內容
  author_uid: string;
  author_name: string;
  created_at: string;
  attachments?: string[]; // 附件（圖片 base64 或網址）
}

// 修改歷史記錄
export interface ChangeHistory {
  id: string;
  lead_id: string;
  field: string; // 修改的欄位名稱
  old_value?: any;
  new_value?: any;
  author_uid: string;
  author_name: string;
  created_at: string;
}

// 成本記錄
export interface CostRecord {
  id: string;
  lead_id: string;
  item_name: string; // 成本名目
  amount: number; // 金額
  author_uid: string;
  author_name: string;
  created_at: string;
  note?: string; // 備註
}

// 利潤記錄
export interface ProfitRecord {
  id: string;
  lead_id: string;
  item_name: string; // 利潤名目
  amount: number; // 金額
  author_uid: string;
  author_name: string;
  created_at: string;
  note?: string; // 備註
}

// ===== Step1ne Headhunter Extensions =====

// 候選人狀態
export enum CandidateStatus {
  NOT_STARTED = '未開始',
  AI_RECOMMENDED = 'AI推薦',
  CONTACTED = '聯繫階段',
  INTERVIEWED = '面試階段',
  OFFER = 'Offer',
  ONBOARDED = 'on board',
  REJECTED = '婉拒',
  OTHER = '備選人才',
  CRAWLER_SCREENED = '爬蟲初篩'
}

// 候選人來源
export enum CandidateSource {
  LINKEDIN = 'LinkedIn',
  GITHUB = 'GitHub',
  GMAIL = 'Gmail 進件',
  REFERRAL = '推薦',
  HEADHUNT = '主動開發',
  JOB_BOARD = '人力銀行',
  CRAWLER = '爬蟲匯入',
  OTHER = '其他'
}

// 職缺狀態
export enum JobStatus {
  RECRUITING = '招募中',
  ON_HOLD = '暫緩',
  CLOSED = '已關閉',
  FILLED = '已成交'
}

// AI 配對分級
export enum MatchGrade {
  P0 = 'P0',
  P1 = 'P1',
  P2 = 'P2',
  REJECT = 'REJECT'
}

// 保證期狀態
export enum GuaranteeStatus {
  WITHIN = '保證期內',
  PASSED = '已通過',
  REFUNDED = '已退費'
}

// 工作經歷
export interface WorkHistory {
  company: string;
  title: string;
  start: string;
  end: string;
  duration_months: number;
  location?: string;
  description?: string;
}

// 教育背景
export interface Education {
  school: string;
  degree: string;
  major: string;
  start: string;
  end: string;
  gpa?: number;
}

// AI 匹配結果
export interface AiMatchResult {
  score: number;                   // 0-100 綜合評分
  recommendation: string;          // 強力推薦 / 推薦 / 觀望 / 不推薦
  job_id?: number;                  // 對應職缺 ID
  job_title?: string;               // 對應職缺名稱
  matched_skills: string[];         // 符合的技能
  missing_skills: string[];         // 缺少的技能
  strengths: string[];              // 優勢亮點（顧問簡報用）
  probing_questions: string[];      // 建議顧問詢問的問題
  salary_fit?: string;              // 薪資符合度說明
  conclusion: string;               // AI 完整結論
  evaluated_at: string;             // ISO datetime
  evaluated_by: string;             // AIBot-xxx
}

export interface JobRankingEntry {
  job_id: number;
  job_title: string;
  company: string;
  department: string;
  salary_range: string;
  job_status: string;
  match_score: number;           // 0-100 加權總分
  skill_score: number;           // 技能比對分數（35%）
  experience_score: number;      // 年資匹配分（25%）
  industry_score: number;        // 產業+職能匹配分（20%）
  education_score: number;       // 學歷匹配分（10%）
  profile_score: number;         // 資料完整度分（10%）
  matched_skills: string[];      // 符合的技能
  missing_skills: string[];      // 缺口技能
  required_skills_count: number; // 職缺要求技能總數
  recommendation: '強力推薦' | '推薦' | '觀望' | '不推薦';
  cached?: boolean;              // 是否來自快取
}

// 系統外職缺建議（rule-based，前端生成）
export interface ExternalJobSuggestion {
  industry: string;           // e.g., "Fintech"
  role: string;               // e.g., "後端工程師"
  reason: string;             // 簡短說明為何推薦
  triggered_skills: string[]; // 觸發此建議的候選人技能
  confidence: 'high' | 'medium'; // high = 2+ 關鍵字命中
}

// 候選人
// 進度追蹤事件
export interface ProgressEvent {
  date: string;  // YYYY-MM-DD
  event: string;  // 聯繫階段、面試階段、Offer、on board、婉拒、其他
  by: string;     // 負責顧問
  note?: string;  // 額外備註
}

// 顧問評估（5 維度：3 自動 + 2 手動）
export interface ConsultantEvaluation {
  // ── 系統自動預填（可被顧問覆蓋）──
  technicalDepth?: number;   // 技術深度 1-5（自動：skills vs job match）
  stability?: number;        // 穩定度 1-5（自動：stabilityScore 轉換）
  industryMatch?: number;    // 產業匹配 1-5（自動：candidate.industry vs job.industry_background）
  // ── 顧問面談後手動填寫 ──
  communication?: number;    // 溝通能力 1-5（手動：面談後填入）
  personality?: number;      // 個性/態度 1-5（手動：面談後填入）
  // ── 總評 ──
  overallRating?: number;    // 顧問總評 1-5（自動平均或顧問覆蓋）
  evaluatedBy?: string;      // 評估顧問
  evaluatedAt?: string;      // 評估時間
  comment?: string;          // 顧問評語
  // 向後相容（舊欄位）
  cultureFit?: number;       // deprecated → 改用 industryMatch
}

export interface Candidate {
  id: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  position: string;
  years: number;
  jobChanges: number;
  avgTenure: number;
  lastGap: number;
  skills: string | string[];  // 支援字串和陣列兩種格式
  education: string;
  source: CandidateSource;
  workHistory?: WorkHistory[];
  quitReasons?: string;
  stabilityScore: number;
  educationJson?: Education[];
  discProfile?: string;
  status: CandidateStatus;
  consultant?: string;
  notes?: string;
  resumeFileUrl?: string;
  resumeLink?: string;  // 履歷連結（Google Drive 嵌入式預覽 URL）
  linkedinUrl?: string;  // LinkedIn 連結
  githubUrl?: string;    // GitHub 連結
  progressTracking?: ProgressEvent[];  // 進度追蹤（W 欄）
  aiMatchResult?: AiMatchResult | null; // AI 匹配評分結果
  targetJobId?: number | null;          // 目標職缺 FK → jobs_pipeline.id
  targetJobLabel?: string | null;       // 目標職缺顯示名稱（JOIN 計算：職缺名 (公司)）
  // ── Phase 1 新增欄位 ──
  age?: number | null;                    // 年齡
  ageEstimated?: boolean;                  // true = 系統從學歷推估，UI 顯示 ~
  birthday?: string | null;               // 出生年月日（YYYY-MM-DD）
  gender?: string;                        // 性別（男/女/其他）
  englishName?: string;                   // 英文名（匿名履歷用）
  consultantNote?: string;                // 顧問備註（與人選溝通後的重點記錄）
  industry?: string;                      // 所屬產業
  languages?: string;                     // 語言能力（如：中文、英文流利、日文基礎）
  certifications?: string;                // 證照（如：PMP、AWS SAA）
  currentSalary?: string;                 // 目前薪資（概略，如 90K）
  expectedSalary?: string;                // 期望薪資（概略，如 100K+）
  noticePeriod?: string;                  // 到職時間（如 1個月、即刻到職）
  managementExperience?: boolean;         // 是否有管理經驗
  teamSize?: string;                      // 管理人數（如 5-10人）
  consultantEvaluation?: ConsultantEvaluation | null; // 顧問 5 維度評估
  // ── Phase 3 動機與交易條件 ──
  jobSearchStatus?: string;               // 求職狀態：主動求職/被動觀望/暫不考慮
  reasonForChange?: string;               // 轉職原因
  motivation?: string;                    // 主要動機：技術成長/轉型/出國/離開產業
  dealBreakers?: string;                  // 不適配條件（不接受的工作類型/環境）
  competingOffers?: string;               // 競爭 Offer
  relationshipLevel?: string;             // 顧問關係程度：初次接觸/已建立關係/深度信任
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  lastContactAt?: string;
  _sheetRow?: number;
}

// 職缺
export interface Job {
  id: string;
  code: string;
  title: string;
  company: string;
  department?: string;
  location: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryText?: string;
  requiredSkills: string[];
  requiredYears: number;
  requiredEducation?: string;
  description?: string;
  responsibilities?: string[];
  requirements?: string[];
  benefits?: string[];
  cultureProfile?: number[];
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

// AI 配對結果
export interface Match {
  id: string;
  candidateId: string;
  jobId: string;
  totalScore: number;
  skillScore: number;
  stabilityScore: number;
  cultureScore: number;
  experienceScore: number;
  grade: MatchGrade;
  reason: string;
  createdAt: string;
  candidate?: Candidate;
  job?: Job;
}

// 成功推薦記錄
export interface Placement {
  id: string;
  candidateId: string;
  jobId: string;
  placementDate: string;
  salary: number;
  fee: number;
  feePercentage: number;
  guaranteeDays: number;
  guaranteeEndDate: string;
  status: GuaranteeStatus;
  leftDate?: string;
  leftReason?: string;
  refundAmount?: number;
  createdAt: string;
  createdBy: string;
  candidate?: Candidate;
  job?: Job;
}

// ==================== 提示詞資料庫 ====================

export type PromptCategory =
  | '客戶需求理解' | '職缺分析' | '人才市場 Mapping' | '人才搜尋'
  | '陌生開發（開發信）' | '人選訪談' | '人選評估' | '客戶推薦'
  | '面試與 Offer 管理';

export interface Prompt {
  id: number;
  category: PromptCategory;
  title: string;
  content: string;
  author: string;
  is_pinned: boolean;
  upvote_count: number;
  has_voted?: boolean;
  created_at: string;
  updated_at: string;
}
