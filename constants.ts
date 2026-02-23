import { Platform, ContactStatus, LeadStatus, Decision, RejectReason } from './types';

export const PLATFORM_OPTIONS = Object.values(Platform);

export const CONTACT_STATUS_OPTIONS = Object.values(ContactStatus);

export const STATUS_OPTIONS = Object.values(LeadStatus);

export const REJECT_REASON_OPTIONS = Object.values(RejectReason);

export const STATUS_COLORS: Record<LeadStatus, string> = {
  [LeadStatus.TO_IMPORT]: 'text-slate-500 bg-slate-50',
  [LeadStatus.TO_FILTER]: 'text-amber-600 bg-amber-50',
  [LeadStatus.CONTACTED]: 'text-blue-600 bg-blue-50',
  [LeadStatus.QUOTING]: 'text-purple-600 bg-purple-50',
  [LeadStatus.IN_PROGRESS]: 'text-indigo-600 bg-indigo-50',
  [LeadStatus.WON]: 'text-emerald-600 bg-emerald-50',
  [LeadStatus.CLOSED]: 'text-gray-600 bg-gray-50',
  [LeadStatus.CANCELLED]: 'text-red-600 bg-red-50',
  [LeadStatus.DECLINED]: 'text-orange-600 bg-orange-50'
};

export const DECISION_COLORS: Record<Decision, string> = {
  [Decision.ACCEPT]: 'text-emerald-600 bg-emerald-50',
  [Decision.REJECT]: 'text-red-600 bg-red-50',
  [Decision.PENDING]: 'text-amber-600 bg-amber-50'
};

// 預設成本名目
export const DEFAULT_COST_ITEMS = [
  'gemini AI 使用費用',
  'cursor 開發軟體費用',
  'zeabur 雲端部署費用',
  '預估人力費用',
  'Pro360 索取個資成本'
];

// Pro360 成本名目
export const PRO360_COST_ITEM = 'Pro360 接案費用';
export const PRO360_CONTACT_COST_ITEM = 'Pro360 索取個資成本';

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
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// 快取過期時間（毫秒）
export const CACHE_EXPIRY = 5 * 60 * 1000; // 5 分鐘
