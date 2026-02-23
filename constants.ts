// Step1ne Headhunter System - Constants

import { CandidateStatus, CandidateSource, JobStatus, MatchGrade, GuaranteeStatus } from './types';

// 候選人狀態配置
export const CANDIDATE_STATUS_CONFIG = {
  [CandidateStatus.TO_CONTACT]: {
    label: '待聯繫',
    color: 'gray',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-800',
    borderColor: 'border-gray-300'
  },
  [CandidateStatus.CONTACTED]: {
    label: '已聯繫',
    color: 'blue',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-800',
    borderColor: 'border-blue-300'
  },
  [CandidateStatus.INTERVIEWING]: {
    label: '面試中',
    color: 'yellow',
    bgColor: 'bg-yellow-100',
    textColor: 'text-yellow-800',
    borderColor: 'border-yellow-300'
  },
  [CandidateStatus.OFFER]: {
    label: 'Offer',
    color: 'purple',
    bgColor: 'bg-purple-100',
    textColor: 'text-purple-800',
    borderColor: 'border-purple-300'
  },
  [CandidateStatus.ONBOARDED]: {
    label: '已上職',
    color: 'green',
    bgColor: 'bg-green-100',
    textColor: 'text-green-800',
    borderColor: 'border-green-300'
  },
  [CandidateStatus.REJECTED]: {
    label: '已拒絕',
    color: 'red',
    bgColor: 'bg-red-100',
    textColor: 'text-red-800',
    borderColor: 'border-red-300'
  },
  [CandidateStatus.ON_HOLD]: {
    label: '暫緩',
    color: 'gray',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-600',
    borderColor: 'border-gray-300'
  }
};

// Kanban 看板欄位順序
export const KANBAN_COLUMNS = [
  CandidateStatus.TO_CONTACT,
  CandidateStatus.CONTACTED,
  CandidateStatus.INTERVIEWING,
  CandidateStatus.OFFER,
  CandidateStatus.ONBOARDED
];

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
  [CandidateSource.OTHER]: {
    label: '其他',
    icon: '📁',
    color: 'gray'
  }
};

// 職缺狀態配置
export const JOB_STATUS_CONFIG = {
  [JobStatus.RECRUITING]: {
    label: '招募中',
    color: 'green',
    bgColor: 'bg-green-100',
    textColor: 'text-green-800'
  },
  [JobStatus.ON_HOLD]: {
    label: '暫緩',
    color: 'yellow',
    bgColor: 'bg-yellow-100',
    textColor: 'text-yellow-800'
  },
  [JobStatus.CLOSED]: {
    label: '已關閉',
    color: 'gray',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-800'
  },
  [JobStatus.FILLED]: {
    label: '已成交',
    color: 'blue',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-800'
  }
};

// AI 配對分級配置
export const MATCH_GRADE_CONFIG = {
  [MatchGrade.P0]: {
    label: 'P0 - 極力推薦',
    color: 'green',
    bgColor: 'bg-green-100',
    textColor: 'text-green-800',
    borderColor: 'border-green-500',
    minScore: 80
  },
  [MatchGrade.P1]: {
    label: 'P1 - 推薦',
    color: 'blue',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-800',
    borderColor: 'border-blue-500',
    minScore: 60
  },
  [MatchGrade.P2]: {
    label: 'P2 - 可考慮',
    color: 'yellow',
    bgColor: 'bg-yellow-100',
    textColor: 'text-yellow-800',
    borderColor: 'border-yellow-500',
    minScore: 40
  },
  [MatchGrade.REJECT]: {
    label: 'REJECT - 不推薦',
    color: 'red',
    bgColor: 'bg-red-100',
    textColor: 'text-red-800',
    borderColor: 'border-red-500',
    minScore: 0
  }
};

// 穩定度評分等級
export const STABILITY_GRADE = {
  A: { min: 80, label: 'A - 極佳', color: 'green' },
  B: { min: 60, label: 'B - 良好', color: 'blue' },
  C: { min: 40, label: 'C - 普通', color: 'yellow' },
  D: { min: 20, label: 'D - 不佳', color: 'orange' },
  F: { min: 0, label: 'F - 極差', color: 'red' }
};

// 保證期狀態配置
export const GUARANTEE_STATUS_CONFIG = {
  [GuaranteeStatus.WITHIN]: {
    label: '保證期內',
    color: 'blue',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-800'
  },
  [GuaranteeStatus.PASSED]: {
    label: '已通過',
    color: 'green',
    bgColor: 'bg-green-100',
    textColor: 'text-green-800'
  },
  [GuaranteeStatus.REFUNDED]: {
    label: '已退費',
    color: 'red',
    bgColor: 'bg-red-100',
    textColor: 'text-red-800'
  }
};

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

// AI 配對權重
export const MATCH_WEIGHTS = {
  SKILL: 0.30, // 技能匹配 30%
  STABILITY: 0.30, // 穩定度 30%
  CULTURE: 0.20, // 文化匹配 20%
  EXPERIENCE: 0.20 // 經驗匹配 20%
};

// 文化維度定義
export const CULTURE_DIMENSIONS = [
  { key: 'innovation', label: '創新導向' },
  { key: 'process', label: '流程導向' },
  { key: 'teamwork', label: '團隊合作' },
  { key: 'independence', label: '獨立作業' },
  { key: 'fast_paced', label: '快節奏' },
  { key: 'stable', label: '穩定環境' },
  { key: 'flexible_hours', label: '彈性工時' },
  { key: 'fixed_hours', label: '固定上班' },
  { key: 'performance_bonus', label: '績效獎金' },
  { key: 'stable_salary', label: '穩定薪資' }
];

// 預設用戶（開發用）
export const DEFAULT_USERS = [
  {
    uid: 'jacky',
    email: 'jacky@step1ne.com',
    displayName: 'Jacky',
    password: 'jacky123',
    role: 'ADMIN',
    isActive: true
  },
  {
    uid: 'phoebe',
    email: 'phoebe@step1ne.com',
    displayName: 'Phoebe',
    password: 'phoebe123',
    role: 'HEADHUNTER',
    isActive: true
  }
];

// 分頁大小
export const PAGE_SIZE = 50;

// 本地儲存 Keys
export const STORAGE_KEYS = {
  USER: 'step1ne_user',
  CANDIDATES_CACHE: 'step1ne_candidates_cache',
  JOBS_CACHE: 'step1ne_jobs_cache',
  LAST_SYNC: 'step1ne_last_sync'
};

// API 端點（如果使用後端 API）
export const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// 快取過期時間（毫秒）
export const CACHE_EXPIRY = 5 * 60 * 1000; // 5 分鐘
