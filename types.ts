
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
  CONTACTED = '已聯繫',
  INTERVIEWED = '已面試',
  OFFER = 'Offer',
  ONBOARDED = '已上職',
  REJECTED = '婉拒',
  OTHER = '其他'
}

// 候選人來源
export enum CandidateSource {
  LINKEDIN = 'LinkedIn',
  GITHUB = 'GitHub',
  GMAIL = 'Gmail 進件',
  REFERRAL = '推薦',
  HEADHUNT = '主動開發',
  JOB_BOARD = '人力銀行',
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

// 候選人
// 進度追蹤事件
export interface ProgressEvent {
  date: string;  // YYYY-MM-DD
  event: string;  // 已聯繫、已面試、Offer、已上職、婉拒、其他
  by: string;     // 負責顧問
  note?: string;  // 額外備註
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
