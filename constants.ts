import { CandidateStatus, CandidateSource } from './types';

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
export const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'https://backendstep1ne.zeabur.app';

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
