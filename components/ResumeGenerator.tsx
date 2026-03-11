// Step1ne 匿名履歷產生器 — 從候選人資料一鍵產生 PDF
import React from 'react';
import { Candidate } from '../types';

import { RADAR_DIMENSIONS, computeAutoScores, computeOverallRating } from './RadarChart';
import { ConsultantEvaluation } from '../types';

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
  // 格式: "Vanessa Chen" — 全英文名直接回傳
  if (/^[A-Za-z]/.test(name) && !/[\u4e00-\u9fff]/.test(name)) return name.trim();
  // 格式: "陳俊豪" — 純中文，無英文名
  return '';
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

function buildResumeHTML(candidate: Candidate, candidateLabel: string, customSummary?: string): string {
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

  // 匿名處理：只顯示英文名，沒有英文名就用 Candidate label
  const englishName = extractEnglishName(candidate.name || '');
  const displayName = englishName || candidateLabel;

  // Headline: Position | N年 | key skills
  const topSkills = skills.slice(0, 3).join(' × ');
  const headline = [position, years > 0 ? `${years} 年經驗` : '', topSkills].filter(Boolean).join(' | ');

  // Skills grouped
  const skillsHTML = skills.map(s => `<span class="skill-tag">${s}</span>`).join('');

  // Work history — 公司名匿名化：用產業/規模描述取代真實公司名
  // 非台灣公司會保留國家/地區標記
  const anonymizeCompany = (company: string): string => {
    if (!company) return '某企業';

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
    if (techGiants.some(t => c.includes(t))) anonName = '全球知名科技巨頭';
    else if (cnTech.some(t => c.includes(t))) anonName = '中國頭部科技公司';
    else if (twTech.some(t => c.includes(t))) anonName = '台灣知名科技/半導體企業';
    else if (banks.some(t => c.includes(t))) anonName = '知名金融機構';
    else if (consulting.some(t => c.includes(t))) anonName = '國際頂級顧問公司';
    // 一般公司 → 用產業關鍵字推測
    else if (/科技|tech|software|資訊|IT|internet|網路/.test(c)) anonName = '科技公司';
    else if (/生技|醫|pharma|biotech|health/.test(c)) anonName = '生技醫療公司';
    else if (/製造|工業|industrial|manufact/.test(c)) anonName = '製造業公司';
    else if (/電商|commerce|零售|retail/.test(c)) anonName = '電商/零售公司';
    else if (/媒體|media|傳播|廣告|advert/.test(c)) anonName = '媒體/廣告公司';
    else if (/教育|education|學/.test(c)) anonName = '教育機構';
    else if (/顧問|consul/.test(c)) anonName = '顧問公司';
    else if (/建築|architect|設計|design|事務所/.test(c)) anonName = '建築/設計事務所';
    else if (/營造|construct|工程/.test(c)) anonName = '營造/工程公司';
    else if (/法律|律師|law/.test(c)) anonName = '法律事務所';
    else if (/會計|account/.test(c)) anonName = '會計事務所';
    else if (/新創|startup/.test(c)) anonName = '新創公司';
    else anonName = '某企業';

    // 3. 如有海外地區標記就附加
    return regionTag ? `${anonName}${regionTag}` : anonName;
  };

  const workHTML = workHistory.map(w => {
    const startStr = w.start || '';
    const endStr = w.end || '至今';
    const period = startStr ? `${startStr} – ${endStr}` : '';
    // 動態計算月數，不用後端靜態的 duration_months
    const months = calcDurationMonths(startStr, w.end || 'present');
    const durationStr = months > 0
      ? (() => {
          const y = Math.floor(months / 12);
          const m = months % 12;
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
    const anonCompany = anonymizeCompany(w.company || '');
    return `
      <div class="work-item">
        <div class="work-role">${w.title || '（職稱未提供）'}</div>
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
  `).join('') || (candidate.education ? `<div class="edu-item"><span class="edu-school">${candidate.education}</span></div>` : '<div class="edu-item"><span class="edu-detail">（暫無教育背景資料）</span></div>');

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
  if (position) infoPills.push(position);              // required
  if (years > 0) infoPills.push(`${years} 年經驗`);    // required
  if (candidate.location) infoPills.push(candidate.location); // required
  if (age) infoPills.push(`${age} 歲`);                // required (年齡)
  if (industry) infoPills.push(industry);               // required (產業)
  const infoPillsHTML = infoPills.map(p => `<span class="info-pill">${p}</span>`).join('');

  // 證照 & 語言 HTML (optional)
  const certsList = certifications ? certifications.split(/[,、;]/).map(s => s.trim()).filter(Boolean) : [];
  const certsHTML = certsList.map(c => `<span class="skill-tag">${c}</span>`).join('');
  const langList = languages ? languages.split(/[,、;]/).map(s => s.trim()).filter(Boolean) : [];
  const langHTML = langList.map(l => `<span class="info-pill-dark">${l}</span>`).join('');

  // 轉職條件 HTML (optional)
  const dealTerms: string[] = [];
  if (currentSalary) dealTerms.push(`目前薪資：${currentSalary}`);
  if (expectedSalary) dealTerms.push(`期望薪資：${expectedSalary}`);
  if (noticePeriod) dealTerms.push(`到職時間：${noticePeriod}`);
  if (hasManagement) dealTerms.push(`管理經驗：是${teamSize ? `（${teamSize}）` : ''}`);
  // Phase 3 動機與交易條件
  if (candidate.jobSearchStatus) dealTerms.push(`求職狀態：${candidate.jobSearchStatus}`);
  if (candidate.motivation) dealTerms.push(`主要動機：${candidate.motivation}`);
  if (candidate.reasonForChange) dealTerms.push(`轉職原因：${candidate.reasonForChange}`);
  if (candidate.dealBreakers) dealTerms.push(`不適配條件：${candidate.dealBreakers}`);
  if (candidate.competingOffers) dealTerms.push(`競爭 Offer：${candidate.competingOffers}`);
  if (candidate.relationshipLevel) dealTerms.push(`顧問關係：${candidate.relationshipLevel}`);

  // 顧問評估雷達圖
  const evalData: ConsultantEvaluation = candidate.consultantEvaluation || {};
  const autoScores = computeAutoScores({ candidate });
  const mergedEval: ConsultantEvaluation = { ...autoScores, ...evalData };
  const overallRating = computeOverallRating(mergedEval);
  const hasEvalData = RADAR_DIMENSIONS.some(d => (mergedEval[d.key] as number) > 0);
  const radarSVG = hasEvalData ? generateRadarSVG(mergedEval) : '';

  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<title>候選人摘要 — ${candidateLabel}</title>
<style>
  @page {
    size: A4;
    margin: 18mm 16mm 16mm 16mm;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: "PingFang TC", "Microsoft JhengHei", "Noto Sans TC", "Helvetica Neue", Arial, sans-serif;
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
    background: rgba(255,255,255,0.2);
    backdrop-filter: blur(4px);
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
    body { background: white; }
    .page { padding: 0; }
    .header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
<div class="page">
  <!-- Header -->
  <div class="header">
    <div class="header-logo">
      <img src="${LOGO_URL}" alt="Step1ne" />
    </div>
    <div class="header-info">
      <div class="header-title">CANDIDATE PROFILE</div>
      <div class="header-name">${displayName}</div>
      ${infoPillsHTML ? `<div class="info-pills">${infoPillsHTML}</div>` : ''}
    </div>
  </div>

  <!-- Summary -->
  <div class="section">
    <div class="section-title">
      <span class="section-icon">✦</span>
      推薦摘要
    </div>
    <div class="summary-card">${summary}</div>
  </div>

  <!-- Skills -->
  ${skills.length > 0 ? `
  <div class="section">
    <div class="section-title">
      <span class="section-icon">◈</span>
      核心技能
    </div>
    <div class="skills-container">${skillsHTML}</div>
  </div>
  ` : ''}

  <!-- Languages (optional) -->
  ${langList.length > 0 ? `
  <div class="section">
    <div class="section-title">
      <span class="section-icon">🌐</span>
      語言能力
    </div>
    <div class="lang-container">${langHTML}</div>
  </div>
  ` : ''}

  <!-- Certifications (optional) -->
  ${certsList.length > 0 ? `
  <div class="section">
    <div class="section-title">
      <span class="section-icon">📜</span>
      專業證照
    </div>
    <div class="skills-container">${certsHTML}</div>
  </div>
  ` : ''}

  <!-- Achievements -->
  ${achievementsHTML ? `
  <div class="section">
    <div class="section-title">
      <span class="section-icon">★</span>
      代表性成就 / 優勢
    </div>
    <ul class="achievements-list">${achievementsHTML}</ul>
  </div>
  ` : ''}

  <!-- Work Experience -->
  ${workHistory.length > 0 ? `
  <div class="section">
    <div class="section-title">
      <span class="section-icon">▸</span>
      工作經驗
    </div>
    <div class="work-timeline">${workHTML}</div>
  </div>
  ` : ''}

  <!-- Education -->
  <div class="section">
    <div class="section-title">
      <span class="section-icon">◉</span>
      教育背景
    </div>
    ${eduHTML}
  </div>

  <!-- Radar Chart (optional) -->
  ${hasEvalData ? `
  <div class="section">
    <div class="section-title">
      <span class="section-icon">📊</span>
      顧問評估
    </div>
    <div class="radar-section">
      <div class="radar-chart">${radarSVG}</div>
      <div>
        <div class="radar-scores">
          ${RADAR_DIMENSIONS.map(d => {
            const v = (mergedEval[d.key] as number) || 0;
            return `<div class="radar-score-item">
              <span class="radar-score-label">${d.shortLabel}</span>
              <div class="radar-score-bar"><div class="radar-score-fill" style="width:${(v / 5) * 100}%"></div></div>
              <span class="radar-score-val">${v || '-'}</span>
            </div>`;
          }).join('')}
        </div>
        ${overallRating > 0 ? `<div class="radar-overall">綜合評分 ${overallRating} / 5</div>` : ''}
      </div>
    </div>
    ${mergedEval.comment ? `<div style="margin-top:8px;padding:8px 12px;background:#f8fafc;border-left:3px solid #10b981;border-radius:4px;font-size:9.5pt;color:#475569;line-height:1.6;">💬 ${mergedEval.comment}</div>` : ''}
  </div>
  ` : ''}

  <!-- Deal Terms (optional) -->
  ${dealTerms.length > 0 ? `
  <div class="section">
    <div class="section-title">
      <span class="section-icon">💼</span>
      轉職條件
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
    <span class="footer-brand">Step1ne 德仁管理顧問</span>
    <span>Confidential — For Recruitment Use Only</span>
  </div>
</div>
</body>
</html>`;
}

export function generateResumePDF(candidate: Candidate, candidateLabel?: string, customSummary?: string): void {
  const label = candidateLabel || `Candidate ${candidate.id}`;
  const html = buildResumeHTML(candidate, label, customSummary);

  const printWindow = window.open('', '_blank', 'width=800,height=1100');
  if (!printWindow) {
    alert('請允許彈出視窗以產生履歷 PDF');
    return;
  }

  printWindow.document.write(html);
  printWindow.document.close();

  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };
}

// React component: renders a preview inside a modal
export const ResumePreview: React.FC<ResumeGeneratorProps & { candidateLabel: string; onClose: () => void }> = ({
  candidate, candidateLabel, onClose
}) => {
  const defaultSummary = generateSummary(candidate);
  const [editingSummary, setEditingSummary] = React.useState(false);
  const [summary, setSummary] = React.useState(defaultSummary);

  const html = buildResumeHTML(candidate, candidateLabel, summary);

  const handlePrint = () => {
    const iframe = document.getElementById('resume-iframe') as HTMLIFrameElement;
    if (iframe?.contentWindow) {
      iframe.contentWindow.print();
    }
  };

  const handleDownload = () => {
    generateResumePDF(candidate, candidateLabel, summary);
  };

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-600 to-cyan-600 text-white p-4 rounded-t-xl flex items-center justify-between">
          <h3 className="text-lg font-semibold">匿名履歷預覽 — {candidateLabel}</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditingSummary(!editingSummary)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${editingSummary ? 'bg-white text-teal-700' : 'bg-white/20 hover:bg-white/30'}`}
            >
              編輯摘要
            </button>
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
            >
              列印
            </button>
            <button
              onClick={handleDownload}
              className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
            >
              另開下載
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
              <span className="text-xs font-bold text-amber-700">推薦摘要（可自由編輯，即時更新預覽）</span>
              <button
                onClick={() => setSummary(defaultSummary)}
                className="text-xs text-amber-600 hover:text-amber-800 underline"
              >
                重置為自動生成
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
  );
};
