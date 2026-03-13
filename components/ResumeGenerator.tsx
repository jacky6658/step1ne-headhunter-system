// Step1ne 匿名履歷產生器 — 從候選人資料一鍵產生 PDF（支援中/英文切換）
import React from 'react';
import { Candidate, SubmissionRule, SubmissionCheckResult } from '../types';

import { RADAR_DIMENSIONS, computeAutoScores, computeOverallRating } from './RadarChart';
import { ConsultantEvaluation } from '../types';
import { apiGet } from '../config/api';
import { SubmissionCheckModal, evaluateRulesLocally } from './SubmissionCheckModal';

// ═══════════════════════════════════════════════════════════════
// 中英文翻譯字典
// ═══════════════════════════════════════════════════════════════
export type ResumeLanguage = 'zh' | 'en';

const RESUME_I18N = {
  zh: {
    // HTML title / header
    pageTitle: '候選人摘要',
    headerTitle: 'CANDIDATE PROFILE',
    // Section titles
    summary: '推薦摘要',
    basicInfo: '基本資料',
    skills: '核心技能',
    languages: '語言能力',
    certifications: '專業證照',
    achievements: '代表性成就 / 優勢',
    workHistory: '工作經驗',
    education: '教育背景',
    radarChart: '顧問評估',
    consultantNote: '顧問備註',
    dealTerms: '轉職條件',
    // Basic info labels
    field_position: '現職',
    field_years: '年資',
    field_industry: '產業',
    field_location: '地點',
    field_gender: '性別',
    field_age: '年齡',
    field_education: '學歷',
    field_languages: '語言',
    field_certifications: '證照',
    field_currentSalary: '目前薪資',
    field_expectedSalary: '期望薪資',
    field_noticePeriod: '到職時間',
    field_management: '管理經驗',
    field_jobSearchStatus: '求職狀態',
    field_motivation: '主要動機',
    field_reasonForChange: '轉職原因',
    // Deal terms labels
    deal_currentSalary: '目前薪資',
    deal_expectedSalary: '期望薪資',
    deal_noticePeriod: '到職時間',
    deal_management: '管理經驗',
    deal_jobSearchStatus: '求職狀態',
    deal_motivation: '主要動機',
    deal_reasonForChange: '轉職原因',
    deal_dealBreakers: '不適配條件',
    deal_competingOffers: '競爭 Offer',
    deal_relationshipLevel: '顧問關係',
    // Misc
    yearsExp: '年經驗',
    years: '年',
    months: '個月',
    yesLabel: '是',
    age_suffix: '歲',
    zodiac_prefix: '屬',
    overallScore: '綜合評分',
    noEdu: '（暫無教育背景資料）',
    noTitle: '（職稱未提供）',
    fallbackCompany: '某企業',
    present: '至今',
    // Summary fallbacks
    summaryFallback: '具備相關領域專業經驗之人才，詳見以下履歷內容。',
    // Footer
    footerBrand: 'Step1ne 德仁管理顧問',
    footerConfidential: 'Confidential — For Recruitment Use Only',
    // Company anonymization
    anonTechGiant: '全球知名科技巨頭',
    anonCnTech: '中國頭部科技公司',
    anonTwTech: '台灣知名科技/半導體企業',
    anonBank: '知名金融機構',
    anonConsulting: '國際頂級顧問公司',
    anonTech: '科技公司',
    anonBiotech: '生技醫療公司',
    anonManufacturing: '製造業公司',
    anonEcommerce: '電商/零售公司',
    anonMedia: '媒體/廣告公司',
    anonEducation: '教育機構',
    anonConsultingGeneral: '顧問公司',
    anonArchitecture: '建築/設計事務所',
    anonConstruction: '營造/工程公司',
    anonLaw: '法律事務所',
    anonAccounting: '會計事務所',
    anonStartup: '新創公司',
    // Preview UI
    previewTitle: '匿名履歷預覽',
    hidePanel: '隱藏面板',
    fieldSettings: '欄位設定',
    editSummary: '編輯摘要',
    print: '列印',
    download: '另開下載',
    summaryEditHint: '推薦摘要（可自由編輯，即時更新預覽）',
    resetAuto: '重置為自動生成',
    displayFields: '顯示欄位',
    selectAll: '全選',
    deselectAll: '全取消',
    sectionGroup: '區塊',
    subFieldGroup: '基本資料子欄位',
    langToggle: '中文',
  },
  en: {
    pageTitle: 'Candidate Profile',
    headerTitle: 'CANDIDATE PROFILE',
    summary: 'Recommendation Summary',
    basicInfo: 'Basic Information',
    skills: 'Core Skills',
    languages: 'Language Proficiency',
    certifications: 'Professional Certifications',
    achievements: 'Key Achievements / Strengths',
    workHistory: 'Work Experience',
    education: 'Education',
    radarChart: 'Consultant Assessment',
    consultantNote: 'Consultant Notes',
    dealTerms: 'Career Change Requirements',
    field_position: 'Current Role',
    field_years: 'Experience',
    field_industry: 'Industry',
    field_location: 'Location',
    field_gender: 'Gender',
    field_age: 'Age',
    field_education: 'Education',
    field_languages: 'Languages',
    field_certifications: 'Certifications',
    field_currentSalary: 'Current Salary',
    field_expectedSalary: 'Expected Salary',
    field_noticePeriod: 'Availability',
    field_management: 'Management Exp.',
    field_jobSearchStatus: 'Job Search Status',
    field_motivation: 'Motivation',
    field_reasonForChange: 'Reason for Change',
    deal_currentSalary: 'Current Salary',
    deal_expectedSalary: 'Expected Salary',
    deal_noticePeriod: 'Availability',
    deal_management: 'Management Exp.',
    deal_jobSearchStatus: 'Job Search Status',
    deal_motivation: 'Motivation',
    deal_reasonForChange: 'Reason for Change',
    deal_dealBreakers: 'Deal Breakers',
    deal_competingOffers: 'Competing Offers',
    deal_relationshipLevel: 'Relationship Level',
    yearsExp: 'yrs exp.',
    years: 'yr',
    months: 'mo',
    yesLabel: 'Yes',
    age_suffix: '',
    zodiac_prefix: '',
    overallScore: 'Overall Score',
    noEdu: '(No education data available)',
    noTitle: '(Title not provided)',
    fallbackCompany: 'Company',
    present: 'Present',
    summaryFallback: 'A professional with relevant industry experience. See resume details below.',
    footerBrand: 'Step1ne Management Consulting',
    footerConfidential: 'Confidential — For Recruitment Use Only',
    anonTechGiant: 'Global Tech Giant',
    anonCnTech: 'Leading Chinese Tech Company',
    anonTwTech: 'Prominent Taiwan Tech / Semiconductor Firm',
    anonBank: 'Leading Financial Institution',
    anonConsulting: 'Top-tier International Consultancy',
    anonTech: 'Technology Company',
    anonBiotech: 'Biotech / Healthcare Company',
    anonManufacturing: 'Manufacturing Company',
    anonEcommerce: 'E-commerce / Retail Company',
    anonMedia: 'Media / Advertising Company',
    anonEducation: 'Educational Institution',
    anonConsultingGeneral: 'Consulting Firm',
    anonArchitecture: 'Architecture / Design Studio',
    anonConstruction: 'Construction / Engineering Firm',
    anonLaw: 'Law Firm',
    anonAccounting: 'Accounting Firm',
    anonStartup: 'Startup',
    previewTitle: 'Anonymous Resume Preview',
    hidePanel: 'Hide Panel',
    fieldSettings: 'Field Settings',
    editSummary: 'Edit Summary',
    print: 'Print',
    download: 'Download',
    summaryEditHint: 'Recommendation Summary (edit freely, preview updates in real-time)',
    resetAuto: 'Reset to auto-generated',
    displayFields: 'Visible Fields',
    selectAll: 'All',
    deselectAll: 'None',
    sectionGroup: 'Sections',
    subFieldGroup: 'Basic Info Sub-fields',
    langToggle: 'EN',
  }
} as const;

// Radar dimension English labels
const RADAR_DIM_EN: Record<string, string> = {
  technicalDepth: 'Technical',
  stability: 'Stability',
  industryMatch: 'Industry',
  communication: 'Communication',
  personality: 'Attitude',
};

// Step1ne logo (loaded from public path at runtime)
const LOGO_URL = '/step1ne-logo.jpeg';

/** 產生純 SVG 字串的雷達圖（用於 HTML 匿名履歷） */
function generateRadarSVG(evaluation: ConsultantEvaluation, size = 180): string {
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * 0.38;
  const labelR = size * 0.48;
  const dims = RADAR_DIMENSIONS;
  const n = dims.length;
  const angleStep = (Math.PI * 2) / n;
  const startAngle = -Math.PI / 2;

  const pt = (angle: number, r: number) => ({
    x: +(cx + Math.cos(angle) * r).toFixed(1),
    y: +(cy + Math.sin(angle) * r).toFixed(1),
  });

  // 網格
  const gridSVG = [1, 2, 3, 4, 5].map(level => {
    const r = (level / 5) * maxR;
    const pts = Array.from({ length: n }, (_, i) => pt(startAngle + i * angleStep, r));
    const d = `M${pts.map(p => `${p.x},${p.y}`).join('L')}Z`;
    return `<path d="${d}" fill="none" stroke="${level === 5 ? '#cbd5e1' : '#e2e8f0'}" stroke-width="${level === 5 ? 1.5 : 0.8}"/>`;
  }).join('');

  // 軸線
  const axisSVG = Array.from({ length: n }, (_, i) => {
    const p = pt(startAngle + i * angleStep, maxR);
    return `<line x1="${cx}" y1="${cy}" x2="${p.x}" y2="${p.y}" stroke="#e2e8f0" stroke-width="0.8"/>`;
  }).join('');

  // 數據多邊形
  const dataPts = dims.map((d, i) => {
    const v = (evaluation[d.key] as number) || 0;
    const r = (Math.max(0, Math.min(5, v)) / 5) * maxR;
    return pt(startAngle + i * angleStep, r);
  });
  const dataPath = `M${dataPts.map(p => `${p.x},${p.y}`).join('L')}Z`;

  // 數據點
  const dotsSVG = dataPts.map((p, i) => {
    const v = (evaluation[dims[i].key] as number) || 0;
    return v > 0 ? `<circle cx="${p.x}" cy="${p.y}" r="3" fill="#10b981"/>` : '';
  }).join('');

  // 標籤
  const labelsSVG = dims.map((d, i) => {
    const p = pt(startAngle + i * angleStep, labelR);
    const v = (evaluation[d.key] as number) || 0;
    const anchor = p.x < cx - 5 ? 'end' : p.x > cx + 5 ? 'start' : 'middle';
    return `<text x="${p.x}" y="${p.y}" text-anchor="${anchor}" dominant-baseline="central" font-size="9" fill="#475569">${d.shortLabel} ${v > 0 ? v : '-'}</text>`;
  }).join('');

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    ${gridSVG}${axisSVG}
    <path d="${dataPath}" fill="rgba(16,185,129,0.2)" stroke="#10b981" stroke-width="2"/>
    ${dotsSVG}${labelsSVG}
  </svg>`;
}

interface ResumeGeneratorProps {
  candidate: Candidate;
}

function parseSkills(raw: string | string[]): string[] {
  if (Array.isArray(raw)) return raw.filter(Boolean);
  return (raw || '').split(/[,、]+/).map(s => s.trim()).filter(Boolean);
}

function parseWorkHistory(candidate: Candidate): Array<{ company: string; title: string; start: string; end: string; duration_months?: number; description?: string }> {
  const wh = candidate.workHistory;
  if (!wh) return [];
  if (Array.isArray(wh)) return wh as any[];
  if (typeof wh === 'string') {
    try {
      const parsed = JSON.parse(wh);
      if (Array.isArray(parsed)) return parsed;
    } catch { /* ignore */ }
  }
  return [];
}

function parseEducation(candidate: Candidate): Array<{ school: string; degree: string; major: string; start?: string; end?: string }> {
  const edu = (candidate as any).educationJson;
  if (!edu) return [];
  if (Array.isArray(edu)) return edu;
  if (typeof edu === 'string') {
    try {
      const parsed = JSON.parse(edu);
      if (Array.isArray(parsed)) return parsed;
    } catch { /* ignore */ }
  }
  return [];
}

/** 從姓名中萃取英文名，隱藏中文名 */
function extractEnglishName(name: string): string {
  if (!name) return '';
  // 格式: "張麗秋 (Iris)" or "張麗秋 (Iris Chang)" → "Iris" or "Iris Chang"
  const parenMatch = name.match(/\(([A-Za-z][A-Za-z\s.\-']+)\)/);
  if (parenMatch) return parenMatch[1].trim();
  // 格式: "張麗秋（Iris）" — 全形括號
  const parenMatch2 = name.match(/（([A-Za-z][A-Za-z\s.\-']+)）/);
  if (parenMatch2) return parenMatch2[1].trim();
  // 格式: "Vanessa Chen" — 全英文名直接回傳
  if (/^[A-Za-z]/.test(name) && !/[\u4e00-\u9fff]/.test(name)) return name.trim();
  // 中英混合，嘗試取出英文部分: "陳俊豪 Jacky" → "Jacky"
  const engPart = name.match(/[A-Za-z][A-Za-z\s.\-']{1,}/);
  if (engPart) return engPart[0].trim();
  // 格式: "陳俊豪" — 純中文，無英文名
  return '';
}

/** 從生日或年齡推算生肖 */
function getZodiac(age: number | null | undefined, birthday?: string | null): string {
  const zodiacAnimals = ['鼠', '牛', '虎', '兔', '龍', '蛇', '馬', '羊', '猴', '雞', '狗', '豬'];
  const toZodiac = (year: number) => zodiacAnimals[((year - 1900) % 12 + 12) % 12];

  // 有精確生日 → 用實際出生年
  if (birthday) {
    const birthYear = new Date(birthday).getFullYear();
    if (birthYear > 1900) return toZodiac(birthYear);
  }

  // 只有年齡 → 出生年可能是 currentYear-age 或 currentYear-age-1
  if (!age || age <= 0) return '';
  const currentYear = new Date().getFullYear();
  const year1 = currentYear - age;
  const year2 = currentYear - age - 1;
  const z1 = toZodiac(year1);
  const z2 = toZodiac(year2);
  // 兩個可能年份如果同生肖就直接顯示
  if (z1 === z2) return z1;
  // 不同就顯示兩個可能
  return `${z2}或${z1}`;
}

/**
 * 摘要生成 — 從候選人已有資料組合出推薦語氣的專業摘要
 * 優先順序：AI 結論 > 結構化資料組合 > education fallback > 通用兜底
 */
function generateSummary(candidate: Candidate): string {
  try {
    const skills = parseSkills(candidate.skills);
    const years = candidate.years || 0;
    const position = candidate.position || '';
    const workHistory = parseWorkHistory(candidate);
    const ai = candidate.aiMatchResult;
    const education = candidate.education || '';
    const stability = candidate.stabilityScore || 0;

    const parts: string[] = [];

    // ── 策略 1: 如果有 AI conclusion 且夠長，直接用作摘要基底 ──
    if (ai?.conclusion && ai.conclusion.length > 20) {
      // AI 結論通常是一段完整的評估，直接作為摘要核心
      // 取前 150 字避免太長
      const trimmed = ai.conclusion.length > 150
        ? ai.conclusion.slice(0, 150).replace(/[，。；]?$/, '') + '…'
        : ai.conclusion;
      parts.push(trimmed);

      // 如果 AI 有推薦等級，補充一句
      if (ai.recommendation && /^(推薦|強力推薦|優秀)$/.test(ai.recommendation)) {
        parts.push(`經 AI 專業評估為「${ai.recommendation}」等級人選`);
      }

      return parts.join('。') + (parts[parts.length - 1]?.endsWith('。') ? '' : '。');
    }

    // ── 策略 2: 從結構化資料組合摘要 ──

    // 第一句：角色定位（獵頭推薦語氣）— 加入產業
    const cIndustry = candidate.industry || '';
    const industryStr = cIndustry ? `${cIndustry}領域` : '';
    if (position && years > 0) {
      if (years >= 8) {
        parts.push(`資深${position}，擁有 ${years} 年${industryStr ? industryStr : '豐富產業'}經驗`);
      } else if (years >= 4) {
        parts.push(`具備 ${years} 年${industryStr}實戰經驗的${position}`);
      } else {
        parts.push(`${position}，${years} 年${industryStr ? industryStr : ''}工作經驗`);
      }
    } else if (position) {
      parts.push(`現職${position}，具備${industryStr || '相關領域'}實務經驗`);
    } else if (years > 0) {
      parts.push(`擁有 ${years} 年${industryStr || '專業'}工作經驗`);
    }

    // 第二句：核心專長領域
    if (skills.length > 0) {
      const topSkills = skills.slice(0, 4).join('、');
      if (skills.length > 4) {
        parts.push(`專精${topSkills}等 ${skills.length} 項核心技術`);
      } else {
        parts.push(`專精${topSkills}等技術`);
      }
    }

    // 第三句：工作經歷亮點
    if (workHistory.length > 0) {
      const latest = workHistory[0];
      if (latest?.company && latest?.title) {
        parts.push(`近期於${latest.company}擔任${latest.title}`);
      } else if (latest?.company) {
        parts.push(`近期任職於${latest.company}`);
      } else if (latest?.title) {
        parts.push(`近期擔任${latest.title}`);
      }
      if (workHistory.length >= 3) {
        parts.push(`歷經 ${workHistory.length} 家企業歷練，具備多元產業視野`);
      }
    }

    // 第四句：AI 評估的優勢
    if (ai) {
      const strengths = Array.isArray(ai.strengths) ? ai.strengths.filter(Boolean) : [];
      if (strengths.length > 0) {
        parts.push(`核心優勢為${strengths.slice(0, 3).join('、')}`);
      }
      if (ai.recommendation && /^(推薦|強力推薦|優秀)$/.test(ai.recommendation)) {
        parts.push(`經 AI 專業評估為「${ai.recommendation}」等級人選`);
      }
    }

    // 第五句：穩定度
    if (stability >= 80) {
      parts.push('職涯穩定度高，適合長期培養');
    } else if (stability >= 60) {
      parts.push('具備良好的職涯穩定度');
    }

    // ── 策略 3: Fallback — 從剩餘資料拼湊 ──
    if (parts.length === 0) {
      // 嘗試從教育背景組合
      const eduList = parseEducation(candidate);
      if (eduList.length > 0) {
        const top = eduList[0];
        const eduParts = [top.school, top.degree, top.major].filter(Boolean);
        if (eduParts.length > 0) {
          parts.push(`${eduParts.join(' ')}背景之專業人才`);
        }
      }

      // 嘗試從 education 純文字
      if (parts.length === 0 && education) {
        parts.push(`${education}背景之專業人才`);
      }

      // 嘗試從 AI score 補充
      if (ai?.score && ai.score > 0) {
        parts.push(`AI 綜合評分 ${ai.score} 分`);
      }

      // 最終兜底
      if (parts.length === 0) {
        parts.push('具備相關領域專業經驗之人才，詳見以下履歷內容');
      }
    }

    return parts.join('。') + '。';
  } catch (err) {
    console.error('generateSummary error:', err);
    return '具備相關領域專業經驗之人才，詳見以下履歷內容。';
  }
}

// 匿名履歷可見欄位設定
export interface ResumeVisibleFields {
  summary: boolean;        // 推薦摘要
  basicInfo: boolean;      // 基本資料區塊
  skills: boolean;         // 核心技能
  languages: boolean;      // 語言能力
  certifications: boolean; // 證照
  dealTerms: boolean;      // 轉職條件
  workHistory: boolean;    // 工作經歷
  education: boolean;      // 教育背景
  achievements: boolean;   // 專業成就
  radarChart: boolean;     // 顧問評估
  consultantNote: boolean; // 顧問備註
  // 基本資料子欄位
  field_position: boolean;
  field_years: boolean;
  field_industry: boolean;
  field_location: boolean;
  field_gender: boolean;
  field_age: boolean;
  field_education: boolean;
  field_languages: boolean;
  field_certifications: boolean;
  field_currentSalary: boolean;
  field_expectedSalary: boolean;
  field_noticePeriod: boolean;
  field_management: boolean;
  field_jobSearchStatus: boolean;
  field_motivation: boolean;
  field_reasonForChange: boolean;
  // 匿名設定
  field_showChineseName: boolean;   // 顯示中文姓名
  field_showCompanyName: boolean;   // 顯示公司名稱
}

export const DEFAULT_VISIBLE_FIELDS: ResumeVisibleFields = {
  summary: true, basicInfo: true, skills: true, languages: true,
  certifications: true, dealTerms: true, workHistory: true,
  education: true, achievements: true, radarChart: true, consultantNote: true,
  field_position: true, field_years: true, field_industry: true,
  field_location: true, field_gender: true, field_age: true,
  field_education: true, field_languages: true, field_certifications: true,
  field_currentSalary: true, field_expectedSalary: true,
  field_noticePeriod: true, field_management: true,
  field_jobSearchStatus: true, field_motivation: true,
  field_reasonForChange: true,
  field_showChineseName: false, field_showCompanyName: false,
};

function buildResumeHTML(candidate: Candidate, candidateLabel: string, customSummary?: string, visibleFields?: ResumeVisibleFields, lang: ResumeLanguage = 'zh'): string {
  const vf = visibleFields || DEFAULT_VISIBLE_FIELDS;
  const t = RESUME_I18N[lang];
  const skills = parseSkills(candidate.skills);
  const workHistory = parseWorkHistory(candidate);
  const education = parseEducation(candidate);
  const summary = customSummary || generateSummary(candidate);
  const position = candidate.position || '';

  // 從 start/end 動態計算月數（不依賴後端靜態 duration_months）
  const calcDurationMonths = (start: string, end: string): number => {
    if (!start) return 0;
    const parseDate = (s: string): Date | null => {
      if (!s || s.toLowerCase() === 'present' || s === '至今') return new Date();
      // 支援 "2025-03", "2025/03", "2025.03", "2025"
      const parts = s.replace(/[\/\.]/g, '-').split('-');
      const y = parseInt(parts[0]);
      const m = parts[1] ? parseInt(parts[1]) - 1 : 0;
      if (isNaN(y)) return null;
      return new Date(y, m, 1);
    };
    const startDate = parseDate(start);
    const endDate = parseDate(end);
    if (!startDate || !endDate) return 0;
    const months = (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth());
    return Math.max(0, months);
  };

  // 動態計算總年資（從工作經歷加總，比後端靜態值準確）
  const totalMonthsFromHistory = workHistory.reduce((sum, w) => {
    return sum + calcDurationMonths(w.start || '', w.end || 'present');
  }, 0);
  const years = totalMonthsFromHistory > 0 ? Math.round(totalMonthsFromHistory / 12) : (candidate.years || 0);

  // 匿名處理：優先使用 englishName 欄位，否則從姓名萃取英文名
  const englishName = (candidate.englishName || '').trim() || extractEnglishName(candidate.name || '');
  const chineseName = (candidate.name || '').replace(/[A-Za-z]/g, '').trim();
  const displayName = vf.field_showChineseName && chineseName
    ? (englishName ? `${chineseName}（${englishName}）` : chineseName)
    : (englishName || '');

  // Headline: Position | N年 | key skills
  const topSkills = skills.slice(0, 3).join(' × ');
  const headline = [position, years > 0 ? (lang === 'en' ? `${years} ${t.yearsExp}` : `${years} 年經驗`) : '', topSkills].filter(Boolean).join(' | ');

  // Skills grouped
  const skillsHTML = skills.map(s => `<span class="skill-tag">${s}</span>`).join('');

  // Work history — 公司名匿名化：用產業/規模描述取代真實公司名
  // 非台灣公司會保留國家/地區標記
  const anonymizeCompany = (company: string): string => {
    if (!company) return t.fallbackCompany;

    // 1. 先提取括號中的國家/地區資訊（全形/半形括號皆支援）
    let regionTag = '';
    const regionMatch = company.match(/[（(]([^）)]+)[）)]/);
    if (regionMatch) {
      const region = regionMatch[1].trim();
      // 判斷是否為非台灣的國家/地區（排除台灣相關字樣與非地區的括號內容）
      const twKeywords = ['台灣', '台北', '台中', '台南', '高雄', 'taiwan', 'tw'];
      const isTW = twKeywords.some(k => region.toLowerCase().includes(k));
      // 常見國家/地區列表，有匹配才保留
      const countryKeywords = [
        '英國', '美國', '日本', '韓國', '中國', '香港', '新加坡', '澳洲', '德國', '法國',
        '加拿大', '荷蘭', '瑞士', '瑞典', '印度', '泰國', '馬來西亞', '越南', '菲律賓',
        '紐西蘭', '以色列', '巴西', '墨西哥', '西班牙', '義大利', '奧地利', '比利時',
        '丹麥', '芬蘭', '挪威', '波蘭', '愛爾蘭', '俄羅斯', '土耳其', '阿聯酋', '沙烏地',
        'uk', 'us', 'usa', 'japan', 'korea', 'china', 'hong kong', 'singapore', 'australia',
        'germany', 'france', 'canada', 'india', 'thailand', 'malaysia', 'vietnam',
        '上海', '北京', '深圳', '廣州', '東京', '大阪', '倫敦', '紐約', '矽谷', '舊金山',
      ];
      const isCountry = countryKeywords.some(k => region.toLowerCase().includes(k.toLowerCase()));
      if (!isTW && isCountry) {
        regionTag = `（${region}）`;
      }
    }

    // 2. 去掉括號部分再做匿名判斷
    const companyClean = company.replace(/[（(][^）)]*[）)]/g, '').trim();
    const c = companyClean.toLowerCase();

    // 知名大廠 → 用規模+產業描述
    const techGiants = ['google', 'meta', 'facebook', 'amazon', 'apple', 'microsoft', 'netflix', 'nvidia', 'tesla', 'openai'];
    const cnTech = ['阿里', '騰訊', '字節', '百度', '華為', '小米', '京東', '美團', '拼多多', '網易'];
    const twTech = ['台積電', 'tsmc', '聯發科', '鴻海', '富士康', '廣達', '華碩', '宏碁', 'acer'];
    const banks = ['銀行', 'bank', '金控', '證券', '投信', '保險', 'insurance'];
    const consulting = ['mckinsey', 'bain', 'bcg', 'deloitte', 'ey', 'pwc', 'kpmg', 'accenture', '麥肯錫', '貝恩', '勤業', '資誠', '安永'];

    let anonName = '';
    if (techGiants.some(x => c.includes(x))) anonName = t.anonTechGiant;
    else if (cnTech.some(x => c.includes(x))) anonName = t.anonCnTech;
    else if (twTech.some(x => c.includes(x))) anonName = t.anonTwTech;
    else if (banks.some(x => c.includes(x))) anonName = t.anonBank;
    else if (consulting.some(x => c.includes(x))) anonName = t.anonConsulting;
    // 一般公司 → 用產業關鍵字推測
    else if (/科技|tech|software|資訊|IT|internet|網路/.test(c)) anonName = t.anonTech;
    else if (/生技|醫|pharma|biotech|health/.test(c)) anonName = t.anonBiotech;
    else if (/製造|工業|industrial|manufact/.test(c)) anonName = t.anonManufacturing;
    else if (/電商|commerce|零售|retail/.test(c)) anonName = t.anonEcommerce;
    else if (/媒體|media|傳播|廣告|advert/.test(c)) anonName = t.anonMedia;
    else if (/教育|education|學/.test(c)) anonName = t.anonEducation;
    else if (/顧問|consul/.test(c)) anonName = t.anonConsultingGeneral;
    else if (/建築|architect|設計|design|事務所/.test(c)) anonName = t.anonArchitecture;
    else if (/營造|construct|工程/.test(c)) anonName = t.anonConstruction;
    else if (/法律|律師|law/.test(c)) anonName = t.anonLaw;
    else if (/會計|account/.test(c)) anonName = t.anonAccounting;
    else if (/新創|startup/.test(c)) anonName = t.anonStartup;
    else anonName = t.fallbackCompany;

    // 3. 如有海外地區標記就附加
    return regionTag ? `${anonName}${regionTag}` : anonName;
  };

  const workHTML = workHistory.map(w => {
    const startStr = w.start || '';
    const endStr = w.end || t.present;
    const period = startStr ? `${startStr} – ${endStr}` : '';
    // 動態計算月數，不用後端靜態的 duration_months
    const months = calcDurationMonths(startStr, w.end || 'present');
    const durationStr = months > 0
      ? (() => {
          const y = Math.floor(months / 12);
          const m = months % 12;
          if (lang === 'en') {
            if (y > 0 && m > 0) return `${y} yr ${m} mo`;
            if (y > 0) return `${y} yr${y > 1 ? 's' : ''}`;
            return `${m} mo`;
          }
          if (y > 0 && m > 0) return `${y}年${m}個月`;
          if (y > 0) return `${y}年`;
          return `${m}個月`;
        })()
      : '';
    const timeDisplay = period
      ? `${period}${durationStr ? `（${durationStr}）` : ''}`
      : durationStr || '';
    const desc = w.description
      ? w.description.split(/[;\n]/).filter(Boolean).map(d => `<li>${d.trim()}</li>`).join('')
      : '';
    const anonCompany = vf.field_showCompanyName ? (w.company || t.fallbackCompany) : anonymizeCompany(w.company || '');
    return `
      <div class="work-item">
        <div class="work-role">${w.title || t.noTitle}</div>
        <div class="work-company">${anonCompany}</div>
        ${timeDisplay ? `<div class="work-period">${timeDisplay}</div>` : ''}
        ${desc ? `<ul class="work-desc">${desc}</ul>` : ''}
      </div>
    `;
  }).join('');

  // Education
  const eduHTML = education.map(e => `
    <div class="edu-item">
      <span class="edu-school">${e.school || ''}</span>
      <span class="edu-detail">${[e.degree, e.major].filter(Boolean).join(' — ')}</span>
      ${e.start || e.end ? `<span class="edu-period">${[e.start, e.end].filter(Boolean).join(' – ')}</span>` : ''}
    </div>
  `).join('') || (candidate.education ? `<div class="edu-item"><span class="edu-school">${candidate.education}</span></div>` : `<div class="edu-item"><span class="edu-detail">${t.noEdu}</span></div>`);

  // AI match highlights
  const ai = candidate.aiMatchResult;
  let achievementsHTML = '';
  if (ai) {
    const items: string[] = [];
    if (ai.strengths && Array.isArray(ai.strengths)) {
      ai.strengths.forEach((s: string) => { if (s) items.push(s); });
    }
    if (ai.matched_skills && Array.isArray(ai.matched_skills)) {
      ai.matched_skills.forEach((s: string) => {
        if (s && !items.includes(s)) items.push(s);
      });
    }
    if (items.length > 0) {
      achievementsHTML = items.map(i => `<li>${i}</li>`).join('');
    }
  }

  // Phase 1 新增欄位
  const age = candidate.age;
  const industry = candidate.industry || '';
  const languages = candidate.languages || '';
  const certifications = candidate.certifications || '';
  const currentSalary = candidate.currentSalary || '';
  const expectedSalary = candidate.expectedSalary || '';
  const noticePeriod = candidate.noticePeriod || '';
  const hasManagement = candidate.managementExperience;
  const teamSize = candidate.teamSize || '';

  // Info pills for header (匿名履歷 required/optional 顯示規則)
  const infoPills: string[] = [];
  if (position) infoPills.push(position);
  if (years > 0) infoPills.push(lang === 'en' ? `${years} ${t.yearsExp}` : `${years} 年經驗`);
  if (candidate.location) infoPills.push(candidate.location);
  const zodiac = getZodiac(age, candidate.birthday);
  if (age) {
    if (lang === 'en') {
      infoPills.push(`Age ${age}`);
    } else {
      infoPills.push(`${age} 歲${zodiac ? `（${zodiac}）` : ''}`);
    }
  }
  if (industry) infoPills.push(industry);
  const infoPillsHTML = infoPills.map(p => `<span class="info-pill">${p}</span>`).join('');

  // 證照解析：清除 markdown、智慧拆分（支援 dash 分隔的複合格式）
  let certsList: string[] = [];
  if (certifications) {
    const cleaned = certifications.replace(/\*\*/g, ''); // strip markdown bold
    // 複合格式：「CertA — desc - CertB — desc」用 " - " 拆（但不拆 "—" 內部描述）
    if (/\s-\s/.test(cleaned) && cleaned.length > 60) {
      certsList = cleaned.split(/\s+-\s+/).map(s => s.trim()).filter(Boolean);
    } else {
      certsList = cleaned.split(/[,、;，]/).map(s => s.trim()).filter(Boolean);
    }
  }
  const certsHTML = certsList.map(c =>
    `<div class="cert-item"><span class="cert-check">✓</span><span class="cert-text">${c}</span></div>`
  ).join('');
  const langList = languages ? languages.split(/[,、;]/).map(s => s.trim()).filter(Boolean) : [];
  const langHTML = langList.map(l => `<span class="info-pill-dark">${l}</span>`).join('');

  // 轉職條件 HTML (optional)
  const dealTerms: string[] = [];
  if (currentSalary) dealTerms.push(`${t.deal_currentSalary}：${currentSalary}`);
  if (expectedSalary) dealTerms.push(`${t.deal_expectedSalary}：${expectedSalary}`);
  if (noticePeriod) dealTerms.push(`${t.deal_noticePeriod}：${noticePeriod}`);
  if (hasManagement) dealTerms.push(`${t.deal_management}：${t.yesLabel}${teamSize ? `（${teamSize}）` : ''}`);
  // Phase 3 動機與交易條件
  if (candidate.jobSearchStatus) dealTerms.push(`${t.deal_jobSearchStatus}：${candidate.jobSearchStatus}`);
  if (candidate.motivation) dealTerms.push(`${t.deal_motivation}：${candidate.motivation}`);
  if (candidate.reasonForChange) dealTerms.push(`${t.deal_reasonForChange}：${candidate.reasonForChange}`);
  if (candidate.dealBreakers) dealTerms.push(`${t.deal_dealBreakers}：${candidate.dealBreakers}`);
  if (candidate.competingOffers) dealTerms.push(`${t.deal_competingOffers}：${candidate.competingOffers}`);
  if (candidate.relationshipLevel) dealTerms.push(`${t.deal_relationshipLevel}：${candidate.relationshipLevel}`);

  // 基本資料區塊（放在摘要和核心技能之間）— 受 vf 控制
  const genderStr = candidate.gender || '';
  const basicInfoItems: Array<{label: string; value: string}> = [];
  if (vf.field_position && position) basicInfoItems.push({ label: t.field_position, value: position });
  if (vf.field_years && years > 0) basicInfoItems.push({ label: t.field_years, value: lang === 'en' ? `${years} yr${years > 1 ? 's' : ''}` : `${years} 年` });
  if (vf.field_industry && industry) basicInfoItems.push({ label: t.field_industry, value: industry });
  if (vf.field_location && candidate.location) basicInfoItems.push({ label: t.field_location, value: candidate.location });
  if (vf.field_gender && genderStr) basicInfoItems.push({ label: t.field_gender, value: genderStr });
  if (vf.field_age && age) basicInfoItems.push({ label: t.field_age, value: lang === 'en' ? `${age}` : `${age} 歲${zodiac ? `（屬${zodiac}）` : ''}` });
  if (vf.field_education && candidate.education) basicInfoItems.push({ label: t.field_education, value: candidate.education.length > 40 ? candidate.education.substring(0, 40) + '…' : candidate.education });
  if (vf.field_languages && languages) basicInfoItems.push({ label: t.field_languages, value: languages });
  // 證照由下方「專業證照」獨立區塊呈現，不在基本資料格重複
  if (vf.field_currentSalary && currentSalary) basicInfoItems.push({ label: t.field_currentSalary, value: currentSalary });
  if (vf.field_expectedSalary && expectedSalary) basicInfoItems.push({ label: t.field_expectedSalary, value: expectedSalary });
  if (vf.field_noticePeriod && noticePeriod) basicInfoItems.push({ label: t.field_noticePeriod, value: noticePeriod });
  if (vf.field_management && hasManagement) basicInfoItems.push({ label: t.field_management, value: `${t.yesLabel}${teamSize ? `（${teamSize}）` : ''}` });
  if (vf.field_jobSearchStatus && candidate.jobSearchStatus) basicInfoItems.push({ label: t.field_jobSearchStatus, value: candidate.jobSearchStatus });
  if (vf.field_motivation && candidate.motivation) basicInfoItems.push({ label: t.field_motivation, value: candidate.motivation });
  if (vf.field_reasonForChange && candidate.reasonForChange) basicInfoItems.push({ label: t.field_reasonForChange, value: candidate.reasonForChange });

  const basicInfoHTML = basicInfoItems.map(item =>
    `<div class="basic-info-item"><span class="basic-info-label">${item.label}</span><span class="basic-info-value">${item.value}</span></div>`
  ).join('');

  // 顧問評估雷達圖
  const evalData: ConsultantEvaluation = candidate.consultantEvaluation || {};
  const autoScores = computeAutoScores({ candidate });
  const mergedEval: ConsultantEvaluation = { ...autoScores, ...evalData };
  const overallRating = computeOverallRating(mergedEval);
  const hasEvalData = RADAR_DIMENSIONS.some(d => (mergedEval[d.key] as number) > 0);
  const radarSVG = hasEvalData ? generateRadarSVG(mergedEval) : '';

  // 使用完整 URL 確保新視窗也能載入 logo
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const logoFullUrl = LOGO_URL.startsWith('http') ? LOGO_URL : `${baseUrl}${LOGO_URL}`;

  return `<!DOCTYPE html>
<html lang="${lang === 'en' ? 'en' : 'zh-TW'}">
<head>
<meta charset="UTF-8">
<base href="${baseUrl}/">
<title>${t.pageTitle} — ${candidateLabel}</title>
<style>
  @page {
    size: A4;
    margin: 18mm 16mm 16mm 16mm;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: "Microsoft JhengHei", "PingFang TC", "Noto Sans TC", "Helvetica Neue", Arial, "微軟正黑體", sans-serif;
    font-size: 10.5pt;
    color: #2d3748;
    line-height: 1.65;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page {
    max-width: 210mm;
    margin: 0 auto;
    padding: 0;
  }

  /* ─── Header ─── */
  .header {
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 18px 22px;
    background: linear-gradient(135deg, #0d9488, #0891b2, #2563eb);
    border-radius: 10px;
    margin-bottom: 18px;
    color: #fff;
  }
  .header-logo {
    width: 64px;
    height: 64px;
    flex-shrink: 0;
    background: rgba(255,255,255,0.95);
    border-radius: 10px;
    padding: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .header-logo img {
    width: 52px;
    height: 52px;
    object-fit: contain;
  }
  .header-info { flex: 1; }
  .header-title {
    font-size: 11pt;
    font-weight: 400;
    opacity: 0.85;
    letter-spacing: 1px;
    text-transform: uppercase;
    margin-bottom: 2px;
  }
  .header-name {
    font-size: 20pt;
    font-weight: 700;
    letter-spacing: 0.5px;
    line-height: 1.2;
  }
  .info-pills {
    display: flex;
    gap: 8px;
    margin-top: 8px;
    flex-wrap: wrap;
  }
  .info-pill {
    display: inline-block;
    background: rgba(255,255,255,0.25);
    padding: 3px 12px;
    border-radius: 20px;
    font-size: 9pt;
    font-weight: 500;
    border: 1px solid rgba(255,255,255,0.3);
  }

  /* ─── Sections ─── */
  .section {
    margin-top: 16px;
  }
  .section-title {
    font-size: 11pt;
    font-weight: 700;
    color: #0d9488;
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
    padding-bottom: 5px;
    border-bottom: 2px solid #e2e8f0;
  }
  .section-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    background: linear-gradient(135deg, #0d9488, #0891b2);
    color: #fff;
    border-radius: 6px;
    font-size: 12px;
    flex-shrink: 0;
  }

  /* ─── Summary Card ─── */
  .summary-card {
    background: linear-gradient(135deg, #f0fdfa, #ecfeff);
    border-left: 4px solid #0d9488;
    border-radius: 0 8px 8px 0;
    padding: 14px 18px;
    font-size: 10.5pt;
    color: #1e4d4d;
    line-height: 1.8;
  }

  /* ─── Skills ─── */
  .skills-container {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .skill-tag {
    display: inline-block;
    background: linear-gradient(135deg, #f0fdfa, #e0f7fa);
    color: #0d6e6e;
    padding: 5px 14px;
    border-radius: 20px;
    font-size: 9pt;
    font-weight: 600;
    border: 1px solid #b2dfdb;
    letter-spacing: 0.3px;
  }

  /* ─── Work History Timeline ─── */
  .work-timeline {
    position: relative;
    padding-left: 20px;
  }
  .work-timeline::before {
    content: '';
    position: absolute;
    left: 4px;
    top: 4px;
    bottom: 4px;
    width: 2px;
    background: linear-gradient(to bottom, #0d9488, #e2e8f0);
    border-radius: 1px;
  }
  .work-item {
    position: relative;
    margin-bottom: 14px;
    padding-bottom: 2px;
  }
  .work-item::before {
    content: '';
    position: absolute;
    left: -20px;
    top: 7px;
    width: 10px;
    height: 10px;
    background: #fff;
    border: 2.5px solid #0d9488;
    border-radius: 50%;
  }
  .work-role {
    font-size: 10.5pt;
    font-weight: 700;
    color: #1a202c;
  }
  .work-company {
    font-size: 10pt;
    color: #4a5568;
    font-weight: 500;
  }
  .work-period {
    font-size: 9pt;
    color: #718096;
    margin: 2px 0 4px 0;
  }
  .work-desc {
    padding-left: 16px;
    font-size: 9.5pt;
    color: #4a5568;
    line-height: 1.6;
  }
  .work-desc li {
    margin-bottom: 2px;
  }

  /* ─── Education ─── */
  .edu-item {
    display: flex;
    align-items: baseline;
    gap: 12px;
    margin-bottom: 8px;
    padding: 8px 14px;
    background: #f7fafc;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
  }
  .edu-school {
    font-weight: 700;
    font-size: 10.5pt;
    color: #1a202c;
  }
  .edu-detail {
    font-size: 10pt;
    color: #4a5568;
  }
  .edu-period {
    font-size: 9pt;
    color: #a0aec0;
    margin-left: auto;
    white-space: nowrap;
  }

  /* ─── Achievements ─── */
  .achievements-list {
    padding-left: 0;
    list-style: none;
  }
  .achievements-list li {
    position: relative;
    padding: 6px 12px 6px 28px;
    margin-bottom: 4px;
    font-size: 10pt;
    background: #fffbeb;
    border-radius: 6px;
    border-left: 3px solid #f59e0b;
  }
  .achievements-list li::before {
    content: '★';
    position: absolute;
    left: 9px;
    top: 6px;
    color: #f59e0b;
    font-size: 10pt;
  }

  /* ─── Certifications List ─── */
  .cert-list {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .cert-item {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 6px 12px;
    background: #fffbeb;
    border-left: 3px solid #f59e0b;
    border-radius: 0 6px 6px 0;
    font-size: 9.5pt;
    color: #78350f;
    line-height: 1.5;
  }
  .cert-check {
    color: #f59e0b;
    font-weight: bold;
    flex-shrink: 0;
    margin-top: 1px;
  }
  .cert-text {
    flex: 1;
  }

  /* ─── Basic Info Grid ─── */
  .basic-info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 6px 16px;
  }
  .basic-info-item {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 5px 10px;
    background: #f8fafc;
    border-radius: 6px;
    border: 1px solid #e2e8f0;
    font-size: 9.5pt;
  }
  .basic-info-label {
    color: #64748b;
    font-size: 8.5pt;
    white-space: nowrap;
    min-width: 52px;
  }
  .basic-info-value {
    font-weight: 600;
    color: #1e293b;
    word-break: break-all;
  }

  /* ─── Footer ─── */
  .footer {
    margin-top: 24px;
    padding: 10px 0;
    border-top: 2px solid #e2e8f0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 8.5pt;
    color: #a0aec0;
  }
  .footer-brand {
    font-weight: 600;
    color: #718096;
  }

  /* ─── Deal Terms ─── */
  .deal-terms {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 8px;
  }
  .deal-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: #f7fafc;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
    font-size: 9.5pt;
    color: #4a5568;
  }
  .deal-label {
    color: #718096;
    font-size: 9pt;
    white-space: nowrap;
  }
  .deal-value {
    font-weight: 600;
    color: #1a202c;
  }

  /* ─── Radar Chart ─── */
  .radar-section {
    display: flex;
    align-items: center;
    gap: 24px;
    padding: 12px 0;
  }
  .radar-chart { flex-shrink: 0; }
  .radar-scores {
    flex: 1;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px 16px;
  }
  .radar-score-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 9.5pt;
  }
  .radar-score-label { color: #64748b; min-width: 56px; }
  .radar-score-bar {
    flex: 1;
    height: 6px;
    background: #e2e8f0;
    border-radius: 3px;
    overflow: hidden;
  }
  .radar-score-fill {
    height: 100%;
    background: linear-gradient(90deg, #10b981, #0d9488);
    border-radius: 3px;
  }
  .radar-score-val {
    font-weight: 600;
    color: #1e293b;
    min-width: 18px;
    text-align: right;
  }
  .radar-overall {
    text-align: center;
    margin-top: 6px;
    padding: 6px 16px;
    background: linear-gradient(135deg, #ecfdf5, #f0fdf4);
    border-radius: 8px;
    border: 1px solid #a7f3d0;
    font-size: 10pt;
    color: #065f46;
    font-weight: 600;
  }

  /* ─── Consultant Note ─── */
  .consultant-note-card {
    background: #fefce8;
    border-left: 4px solid #eab308;
    border-radius: 0 8px 8px 0;
    padding: 14px 18px;
    font-size: 10pt;
    color: #713f12;
    line-height: 1.8;
    white-space: pre-wrap;
    word-break: break-word;
  }

  /* ─── Language pills ─── */
  .info-pill-dark {
    display: inline-block;
    background: #edf2f7;
    color: #2d3748;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 9pt;
    font-weight: 500;
    border: 1px solid #e2e8f0;
  }
  .lang-container {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  @media print {
    body { background: white; margin: 0; padding: 0; }
    .page { padding: 0; }

    /* 保留所有背景色和漸層 */
    *, *::before, *::after {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }

    /* 防止區塊被頁面切斷 */
    .header, .summary-card, .consultant-note-card, .cert-item, .work-item, .edu-item, .deal-item, .section {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .section-title {
      page-break-after: avoid;
      break-after: avoid;
    }

    /* 確保漸層背景在列印時保留 */
    .header {
      background: linear-gradient(135deg, #0d9488, #0891b2, #2563eb) !important;
      color: #fff !important;
    }
    .section-icon {
      background: linear-gradient(135deg, #0d9488, #0891b2) !important;
      color: #fff !important;
    }
    .summary-card {
      background: linear-gradient(135deg, #f0fdfa, #ecfeff) !important;
    }

    /* 頁尾 */
    .footer {
      position: fixed;
      bottom: 0;
    }
  }
</style>
</head>
<body>
<div class="page">
  <!-- Header -->
  <div class="header">
    <div class="header-logo">
      <img src="${LOGO_URL}" alt="Step1ne" onerror="this.style.display='none'" />
    </div>
    <div class="header-info">
      <div class="header-title">${t.headerTitle}</div>
      ${displayName ? `<div class="header-name">${displayName}</div>` : ''}
      ${infoPillsHTML ? `<div class="info-pills">${infoPillsHTML}</div>` : ''}
    </div>
  </div>

  <!-- Summary -->
  ${vf.summary ? `
  <div class="section">
    <div class="section-title">
      <span class="section-icon">✦</span>
      ${t.summary}
    </div>
    <div class="summary-card">${summary}</div>
  </div>
  ` : ''}

  <!-- Basic Info -->
  ${vf.basicInfo && basicInfoItems.length > 0 ? `
  <div class="section">
    <div class="section-title">
      <span class="section-icon">📋</span>
      ${t.basicInfo}
    </div>
    <div class="basic-info-grid">${basicInfoHTML}</div>
  </div>
  ` : ''}

  <!-- Skills -->
  ${vf.skills && skills.length > 0 ? `
  <div class="section">
    <div class="section-title">
      <span class="section-icon">◈</span>
      ${t.skills}
    </div>
    <div class="skills-container">${skillsHTML}</div>
  </div>
  ` : ''}

  <!-- Languages (optional) -->
  ${vf.languages && langList.length > 0 ? `
  <div class="section">
    <div class="section-title">
      <span class="section-icon">🌐</span>
      ${t.languages}
    </div>
    <div class="lang-container">${langHTML}</div>
  </div>
  ` : ''}

  <!-- Certifications (optional) -->
  ${vf.certifications && certsList.length > 0 ? `
  <div class="section">
    <div class="section-title">
      <span class="section-icon">📜</span>
      ${t.certifications}
    </div>
    <div class="cert-list">${certsHTML}</div>
  </div>
  ` : ''}

  <!-- Achievements -->
  ${vf.achievements && achievementsHTML ? `
  <div class="section">
    <div class="section-title">
      <span class="section-icon">★</span>
      ${t.achievements}
    </div>
    <ul class="achievements-list">${achievementsHTML}</ul>
  </div>
  ` : ''}

  <!-- Work Experience -->
  ${vf.workHistory && workHistory.length > 0 ? `
  <div class="section">
    <div class="section-title">
      <span class="section-icon">▸</span>
      ${t.workHistory}
    </div>
    <div class="work-timeline">${workHTML}</div>
  </div>
  ` : ''}

  <!-- Education -->
  ${vf.education ? `
  <div class="section">
    <div class="section-title">
      <span class="section-icon">◉</span>
      ${t.education}
    </div>
    ${eduHTML}
  </div>
  ` : ''}

  <!-- Radar Chart (optional) -->
  ${vf.radarChart && hasEvalData ? `
  <div class="section">
    <div class="section-title">
      <span class="section-icon">📊</span>
      ${t.radarChart}
    </div>
    <div class="radar-section">
      <div class="radar-chart">${radarSVG}</div>
      <div>
        <div class="radar-scores">
          ${RADAR_DIMENSIONS.map(d => {
            const v = (mergedEval[d.key] as number) || 0;
            const dimLabel = lang === 'en' ? (RADAR_DIM_EN[d.key] || d.shortLabel) : d.shortLabel;
            return `<div class="radar-score-item">
              <span class="radar-score-label">${dimLabel}</span>
              <div class="radar-score-bar"><div class="radar-score-fill" style="width:${(v / 5) * 100}%"></div></div>
              <span class="radar-score-val">${v || '-'}</span>
            </div>`;
          }).join('')}
        </div>
        ${overallRating > 0 ? `<div class="radar-overall">${t.overallScore} ${overallRating} / 5</div>` : ''}
      </div>
    </div>
    ${mergedEval.comment ? `<div style="margin-top:8px;padding:8px 12px;background:#f8fafc;border-left:3px solid #10b981;border-radius:4px;font-size:9.5pt;color:#475569;line-height:1.6;">💬 ${mergedEval.comment}</div>` : ''}
  </div>
  ` : ''}

  <!-- Consultant Note (optional) -->
  ${vf.consultantNote && candidate.consultantNote ? `
  <div class="section">
    <div class="section-title">
      <span class="section-icon">📝</span>
      ${t.consultantNote}
    </div>
    <div class="consultant-note-card">${candidate.consultantNote}</div>
  </div>
  ` : ''}

  <!-- Deal Terms (optional) -->
  ${vf.dealTerms && dealTerms.length > 0 ? `
  <div class="section">
    <div class="section-title">
      <span class="section-icon">💼</span>
      ${t.dealTerms}
    </div>
    <div class="deal-terms">
      ${dealTerms.map(d => {
        const [label, value] = d.split('：');
        return `<div class="deal-item"><span class="deal-label">${label}</span><span class="deal-value">${value || ''}</span></div>`;
      }).join('')}
    </div>
  </div>
  ` : ''}

  <!-- Footer -->
  <div class="footer">
    <span class="footer-brand">${t.footerBrand}</span>
    <span>${t.footerConfidential}</span>
  </div>
</div>
</body>
</html>`;
}

export function generateResumePDF(candidate: Candidate, candidateLabel?: string, customSummary?: string, visibleFields?: ResumeVisibleFields, lang: ResumeLanguage = 'zh'): void {
  const label = candidateLabel || `Candidate ${candidate.id}`;
  const html = buildResumeHTML(candidate, label, customSummary, visibleFields, lang);

  const printWindow = window.open('', '_blank', 'width=800,height=1100');
  if (!printWindow) {
    alert('請允許彈出視窗以產生履歷 PDF');
    return;
  }

  printWindow.document.write(html);
  printWindow.document.close();

  // 等待圖片和樣式完全渲染後再列印（Windows 需要更長時間）
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
    }, 1500);
  };
}

// React component: renders a preview inside a modal
// 勾選面板的欄位定義
const SECTION_TOGGLES: Array<{ key: keyof ResumeVisibleFields; label: string; group: 'section' }> = [
  { key: 'summary', label: '推薦摘要', group: 'section' },
  { key: 'basicInfo', label: '基本資料', group: 'section' },
  { key: 'skills', label: '核心技能', group: 'section' },
  { key: 'languages', label: '語言能力', group: 'section' },
  { key: 'certifications', label: '專業證照', group: 'section' },
  { key: 'workHistory', label: '工作經歷', group: 'section' },
  { key: 'education', label: '教育背景', group: 'section' },
  { key: 'achievements', label: '代表性成就', group: 'section' },
  { key: 'radarChart', label: '顧問評估', group: 'section' },
  { key: 'consultantNote', label: '顧問備註', group: 'section' },
  { key: 'dealTerms', label: '轉職條件', group: 'section' },
];

const FIELD_TOGGLES: Array<{ key: keyof ResumeVisibleFields; label: string }> = [
  { key: 'field_position', label: '現職' },
  { key: 'field_years', label: '年資' },
  { key: 'field_industry', label: '產業' },
  { key: 'field_location', label: '地點' },
  { key: 'field_gender', label: '性別' },
  { key: 'field_age', label: '年齡/生肖' },
  { key: 'field_education', label: '學歷' },
  { key: 'field_languages', label: '語言' },
  { key: 'field_currentSalary', label: '目前薪資' },
  { key: 'field_expectedSalary', label: '期望薪資' },
  { key: 'field_noticePeriod', label: '到職時間' },
  { key: 'field_management', label: '管理經驗' },
  { key: 'field_jobSearchStatus', label: '求職狀態' },
  { key: 'field_motivation', label: '主要動機' },
  { key: 'field_reasonForChange', label: '轉職原因' },
];

const ANON_TOGGLES: Array<{ key: keyof ResumeVisibleFields; label: string }> = [
  { key: 'field_showChineseName', label: '顯示中文姓名' },
  { key: 'field_showCompanyName', label: '顯示公司名稱' },
];

export const ResumePreview: React.FC<ResumeGeneratorProps & { candidateLabel: string; onClose: () => void; targetJobId?: number | null }> = ({
  candidate, candidateLabel, onClose, targetJobId
}) => {
  const defaultSummary = generateSummary(candidate);
  const [editingSummary, setEditingSummary] = React.useState(false);
  const [summary, setSummary] = React.useState(defaultSummary);
  const [visibleFields, setVisibleFields] = React.useState<ResumeVisibleFields>({ ...DEFAULT_VISIBLE_FIELDS });
  const [showPanel, setShowPanel] = React.useState(true);
  const [lang, setLang] = React.useState<ResumeLanguage>('zh');

  // 送件規範檢查
  const [showSubmissionCheck, setShowSubmissionCheck] = React.useState(false);
  const [checkResults, setCheckResults] = React.useState<SubmissionCheckResult[]>([]);
  const [checkFailCount, setCheckFailCount] = React.useState(0);
  const [checkCompanyName, setCheckCompanyName] = React.useState('');
  const [pendingAction, setPendingAction] = React.useState<'print' | 'download' | null>(null);

  const t = RESUME_I18N[lang];
  const html = buildResumeHTML(candidate, candidateLabel, summary, visibleFields, lang);

  const toggleField = (key: keyof ResumeVisibleFields) => {
    setVisibleFields(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSelectAll = () => {
    setVisibleFields({ ...DEFAULT_VISIBLE_FIELDS });
  };

  const handleDeselectAll = () => {
    const allOff = {} as ResumeVisibleFields;
    Object.keys(DEFAULT_VISIBLE_FIELDS).forEach(k => { (allOff as any)[k] = false; });
    setVisibleFields(allOff);
  };

  // 送件規範前置檢查
  const runSubmissionCheck = async (action: 'print' | 'download') => {
    if (!targetJobId) {
      // 無目標職缺，直接執行
      executeAction(action);
      return;
    }
    try {
      const jobResp = await apiGet<{ success: boolean; data: any }>(`/jobs/${targetJobId}`);
      if (!jobResp.success || !jobResp.data?.client_id) {
        executeAction(action);
        return;
      }
      const clientResp = await apiGet<{ success: boolean; data: any }>(`/clients/${jobResp.data.client_id}`);
      if (!clientResp.success) {
        executeAction(action);
        return;
      }
      const rules: SubmissionRule[] = clientResp.data.submission_rules || [];
      const enabledRules = rules.filter(r => r.enabled);
      if (enabledRules.length === 0) {
        executeAction(action);
        return;
      }
      // 前端即時檢查
      const results = evaluateRulesLocally(candidate, rules);
      const failCount = results.filter(r => r.passed === false).length;
      setCheckResults(results);
      setCheckFailCount(failCount);
      setCheckCompanyName(clientResp.data.company_name || '');
      setPendingAction(action);
      setShowSubmissionCheck(true);
    } catch {
      // 檢查失敗不阻擋下載
      executeAction(action);
    }
  };

  const executeAction = (action: 'print' | 'download') => {
    if (action === 'print') {
      const iframe = document.getElementById('resume-iframe') as HTMLIFrameElement;
      if (iframe?.contentWindow) iframe.contentWindow.print();
    } else {
      generateResumePDF(candidate, candidateLabel, summary, visibleFields, lang);
    }
  };

  const handlePrint = () => runSubmissionCheck('print');
  const handleDownload = () => runSubmissionCheck('download');

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-600 to-cyan-600 text-white p-4 rounded-t-xl flex items-center justify-between">
          <h3 className="text-lg font-semibold">{t.previewTitle} — {candidateLabel}</h3>
          <div className="flex items-center gap-2">
            {/* 中/英文切換 */}
            <button
              onClick={() => setLang(prev => prev === 'zh' ? 'en' : 'zh')}
              className="px-3 py-1.5 bg-amber-400 hover:bg-amber-500 text-amber-900 rounded-lg text-sm font-bold transition-colors"
              title={lang === 'zh' ? 'Switch to English' : '切換為中文'}
            >
              {lang === 'zh' ? '中→EN' : 'EN→中'}
            </button>
            <button
              onClick={() => setShowPanel(!showPanel)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${showPanel ? 'bg-white text-teal-700' : 'bg-white/20 hover:bg-white/30'}`}
            >
              {showPanel ? t.hidePanel : t.fieldSettings}
            </button>
            <button
              onClick={() => setEditingSummary(!editingSummary)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${editingSummary ? 'bg-white text-teal-700' : 'bg-white/20 hover:bg-white/30'}`}
            >
              {t.editSummary}
            </button>
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
            >
              {t.print}
            </button>
            <button
              onClick={handleDownload}
              className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
            >
              {t.download}
            </button>
            <button
              onClick={onClose}
              className="p-1 hover:bg-white/20 rounded-lg transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Editable Summary */}
        {editingSummary && (
          <div className="px-4 pt-3 pb-2 bg-amber-50 border-b border-amber-200">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-amber-700">{t.summaryEditHint}</span>
              <button
                onClick={() => setSummary(defaultSummary)}
                className="text-xs text-amber-600 hover:text-amber-800 underline"
              >
                {t.resetAuto}
              </button>
            </div>
            <textarea
              value={summary}
              onChange={e => setSummary(e.target.value)}
              className="w-full h-20 px-3 py-2 text-sm border border-amber-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
              placeholder="輸入推薦摘要..."
            />
          </div>
        )}

        {/* Main content: side panel + preview */}
        <div className="flex-1 flex overflow-hidden">
          {/* Side panel: field toggles */}
          {showPanel && (
            <div className="w-56 shrink-0 border-r border-gray-200 bg-gray-50 overflow-y-auto p-3">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">{t.displayFields}</span>
                <div className="flex gap-1">
                  <button onClick={handleSelectAll} className="text-[10px] px-1.5 py-0.5 bg-teal-100 text-teal-700 rounded hover:bg-teal-200">{t.selectAll}</button>
                  <button onClick={handleDeselectAll} className="text-[10px] px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded hover:bg-gray-300">{t.deselectAll}</button>
                </div>
              </div>

              {/* Section toggles */}
              <div className="mb-3">
                <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">{t.sectionGroup}</div>
                {SECTION_TOGGLES.map(t => (
                  <label key={t.key} className="flex items-center gap-2 py-1 cursor-pointer hover:bg-white rounded px-1.5 transition-colors">
                    <input
                      type="checkbox"
                      checked={visibleFields[t.key] as boolean}
                      onChange={() => toggleField(t.key)}
                      className="rounded border-gray-300 text-teal-600 focus:ring-teal-500 w-3.5 h-3.5"
                    />
                    <span className="text-xs text-gray-700">{t.label}</span>
                  </label>
                ))}
              </div>

              {/* Basic info sub-field toggles */}
              {visibleFields.basicInfo && (
                <div>
                  <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 pt-2 border-t border-gray-200">{t.subFieldGroup}</div>
                  {FIELD_TOGGLES.map(t => (
                    <label key={t.key} className="flex items-center gap-2 py-0.5 cursor-pointer hover:bg-white rounded px-1.5 transition-colors">
                      <input
                        type="checkbox"
                        checked={visibleFields[t.key] as boolean}
                        onChange={() => toggleField(t.key)}
                        className="rounded border-gray-300 text-teal-600 focus:ring-teal-500 w-3 h-3"
                      />
                      <span className="text-[11px] text-gray-600">{t.label}</span>
                    </label>
                  ))}
                </div>
              )}

              {/* 匿名設定 toggles */}
              <div>
                <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 pt-2 border-t border-gray-200">匿名設定</div>
                {ANON_TOGGLES.map(t => (
                  <label key={t.key} className="flex items-center gap-2 py-0.5 cursor-pointer hover:bg-white rounded px-1.5 transition-colors">
                    <input
                      type="checkbox"
                      checked={visibleFields[t.key] as boolean}
                      onChange={() => toggleField(t.key)}
                      className="rounded border-gray-300 text-orange-500 focus:ring-orange-400 w-3 h-3"
                    />
                    <span className="text-[11px] text-gray-600">{t.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Preview iframe */}
          <div className="flex-1 overflow-hidden p-4 bg-gray-100">
            <iframe
              id="resume-iframe"
              srcDoc={html}
              className="w-full h-full border border-gray-200 rounded-lg bg-white shadow-inner"
              title="Resume Preview"
            />
          </div>
        </div>
      </div>

      {/* 送件規範檢查彈窗 */}
      {showSubmissionCheck && (
        <SubmissionCheckModal
          companyName={checkCompanyName}
          results={checkResults}
          failCount={checkFailCount}
          onClose={() => {
            setShowSubmissionCheck(false);
            setPendingAction(null);
          }}
          onForceDownload={() => {
            setShowSubmissionCheck(false);
            if (pendingAction) executeAction(pendingAction);
            setPendingAction(null);
          }}
        />
      )}
    </div>
  );
};
