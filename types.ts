// Step1ne Headhunter System - Type Definitions

export enum Role {
  ADMIN = 'ADMIN',
  HEADHUNTER = 'HEADHUNTER'
}

// 候選人狀態
export enum CandidateStatus {
  TO_CONTACT = '待聯繫',
  CONTACTED = '已聯繫',
  INTERVIEWING = '面試中',
  OFFER = 'Offer',
  ONBOARDED = '已上職',
  REJECTED = '已拒絕',
  ON_HOLD = '暫緩'
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
  P0 = 'P0', // 80+ 分
  P1 = 'P1', // 60-80 分
  P2 = 'P2', // 40-60 分
  REJECT = 'REJECT' // <40 分
}

// 保證期狀態
export enum GuaranteeStatus {
  WITHIN = '保證期內',
  PASSED = '已通過',
  REFUNDED = '已退費'
}

// 用戶資料
export interface UserProfile {
  uid: string;
  email: string;
  role: Role;
  displayName: string;
  password?: string;
  isActive?: boolean;
  createdAt?: string;
  avatar?: string;
  status?: string;
  isOnline?: boolean;
  lastSeen?: string;
}

// 工作經歷（JSON 格式）
export interface WorkHistory {
  company: string;
  title: string;
  start: string; // YYYY-MM
  end: string; // YYYY-MM or "present"
  duration_months: number;
  location?: string;
  description?: string;
}

// 教育背景（JSON 格式）
export interface Education {
  school: string;
  degree: string;
  major: string;
  start: string; // YYYY
  end: string; // YYYY
  gpa?: number;
}

// 候選人
export interface Candidate {
  id: string;
  
  // 基本資訊 (A-L)
  name: string; // A: 姓名
  email: string; // B: Email
  phone: string; // C: Phone
  location: string; // D: Location
  position: string; // E: Position (目前職位)
  years: number; // F: Years (總年資)
  jobChanges: number; // G: Job Changes (工作次數)
  avgTenure: number; // H: Avg Tenure (平均任期)
  lastGap: number; // I: Gap (最後空窗期，月)
  skills: string; // J: Skills (逗號分隔)
  education: string; // K: Education (文字版)
  source: CandidateSource; // L: Source
  
  // 進階資訊 (M-T)
  workHistory?: WorkHistory[]; // M: Work JSON
  quitReasons?: string; // N: Quit Reasons
  stabilityScore: number; // O: Stability Score (0-100)
  educationJson?: Education[]; // P: Edu JSON
  discProfile?: string; // Q: DISC
  status: CandidateStatus; // R: Status
  consultant?: string; // S: Consultant (負責顧問)
  notes?: string; // T: Notes
  
  // 系統欄位
  resumeFileUrl?: string; // 履歷檔案連結
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  lastContactAt?: string;
  
  // 前端用（不存資料庫）
  _sheetRow?: number; // Google Sheets 行號
}

// 職缺
export interface Job {
  id: string;
  code: string; // 職缺代碼 (JD-001)
  title: string; // 職位名稱
  company: string; // 公司名稱
  department?: string; // 部門
  location: string; // 工作地點
  
  // 薪資
  salaryMin?: number;
  salaryMax?: number;
  salaryText?: string; // 薪資文字描述
  
  // 需求
  requiredSkills: string[]; // 必備技能
  requiredYears: number; // 年資要求
  requiredEducation?: string; // 學歷要求
  
  // JD 內容
  description?: string; // 職缺描述
  responsibilities?: string[]; // 工作職責
  requirements?: string[]; // 資格要求
  benefits?: string[]; // 福利待遇
  
  // 文化特徵（用於 culture matching）
  cultureProfile?: number[]; // 10 維度分數
  
  // 狀態
  status: JobStatus;
  
  // 系統欄位
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

// AI 配對結果
export interface Match {
  id: string;
  candidateId: string;
  jobId: string;
  
  // 配對分數
  totalScore: number; // 總分 (0-100)
  skillScore: number; // 技能匹配 (30%)
  stabilityScore: number; // 穩定度 (30%)
  cultureScore: number; // 文化匹配 (20%)
  experienceScore: number; // 經驗匹配 (20%)
  
  // 評級與理由
  grade: MatchGrade;
  reason: string; // AI 推薦理由
  
  // 系統欄位
  createdAt: string;
  
  // 關聯資料（前端用）
  candidate?: Candidate;
  job?: Job;
}

// 成功推薦記錄
export interface Placement {
  id: string;
  candidateId: string;
  jobId: string;
  
  // 推薦資訊
  placementDate: string; // 上職日期
  salary: number; // 確認薪資
  fee: number; // 推薦費用
  feePercentage: number; // 費率 %
  
  // 保證期追蹤
  guaranteeDays: number; // 保證期天數 (預設 90)
  guaranteeEndDate: string; // 保證期結束日
  status: GuaranteeStatus;
  
  // 離職記錄
  leftDate?: string; // 離職日期
  leftReason?: string; // 離職原因
  refundAmount?: number; // 退費金額
  
  // 系統欄位
  createdAt: string;
  createdBy: string;
  
  // 關聯資料（前端用）
  candidate?: Candidate;
  job?: Job;
}

// 進度更新記錄
export interface ProgressUpdate {
  id: string;
  candidateId?: string;
  jobId?: string;
  content: string; // 進度內容
  contactType?: string; // 聯繫方式（電話/Email/面試/Offer）
  nextAction?: string; // 下次行動
  nextActionDate?: string; // 下次聯繫日期
  authorUid: string;
  authorName: string;
  createdAt: string;
  attachments?: string[]; // 附件
}

// 修改歷史記錄
export interface ChangeHistory {
  id: string;
  entityType: 'candidate' | 'job' | 'placement';
  entityId: string;
  field: string; // 修改的欄位名稱
  oldValue?: any;
  newValue?: any;
  authorUid: string;
  authorName: string;
  createdAt: string;
}

// 審計日誌
export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  STATUS_CHANGE = 'STATUS_CHANGE',
  MATCH = 'MATCH',
  PLACEMENT = 'PLACEMENT'
}

export interface AuditLog {
  id: string;
  entityType: 'candidate' | 'job' | 'placement';
  entityId: string;
  action: AuditAction;
  actorUid: string;
  actorName: string;
  before?: any;
  after?: any;
  createdAt: string;
}

// 統計資料
export interface Analytics {
  // 候選人統計
  totalCandidates: number;
  byStatus: Record<CandidateStatus, number>;
  bySource: Record<CandidateSource, number>;
  byConsultant: Record<string, number>;
  
  // 職缺統計
  totalJobs: number;
  activeJobs: number;
  
  // 配對統計
  totalMatches: number;
  avgMatchScore: number;
  byGrade: Record<MatchGrade, number>;
  
  // 成功推薦統計
  totalPlacements: number;
  totalRevenue: number;
  avgFee: number;
  guaranteePassRate: number; // 保證期通過率
  
  // 時間範圍
  periodStart: string;
  periodEnd: string;
}
