// Step1ne 匿名履歷產生器 — 從候選人資料一鍵產生 PDF
import React from 'react';
import { Candidate } from '../types';

// Step1ne logo (loaded from public path at runtime)
const LOGO_URL = '/step1ne-logo.jpeg';

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

    // 第一句：角色定位（獵頭推薦語氣）
    if (position && years > 0) {
      if (years >= 8) {
        parts.push(`資深${position}，擁有 ${years} 年豐富產業經驗`);
      } else if (years >= 4) {
        parts.push(`具備 ${years} 年實戰經驗的${position}`);
      } else {
        parts.push(`${position}，${years} 年工作經驗`);
      }
    } else if (position) {
      parts.push(`現職${position}，具備相關領域實務經驗`);
    } else if (years > 0) {
      parts.push(`擁有 ${years} 年專業工作經驗`);
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
  const years = candidate.years || 0;
  const position = candidate.position || '';

  // 匿名處理：只顯示英文名，沒有英文名就用 Candidate label
  const englishName = extractEnglishName(candidate.name || '');
  const displayName = englishName || candidateLabel;

  // Headline: Position | N年 | key skills
  const topSkills = skills.slice(0, 3).join(' × ');
  const headline = [position, years > 0 ? `${years} 年經驗` : '', topSkills].filter(Boolean).join(' | ');

  // Skills grouped
  const skillsHTML = skills.map(s => `<span class="skill-tag">${s}</span>`).join('');

  // Work history
  const workHTML = workHistory.map(w => {
    const startStr = w.start || '';
    const endStr = w.end || '至今';
    const period = startStr ? `${startStr} – ${endStr}` : '';
    const durationStr = w.duration_months
      ? `${Math.floor(w.duration_months / 12) > 0 ? Math.floor(w.duration_months / 12) + '年' : ''}${w.duration_months % 12 ? w.duration_months % 12 + '個月' : ''}`
      : '';
    const timeDisplay = period
      ? `${period}${durationStr ? `（${durationStr}）` : ''}`
      : durationStr || '';
    const desc = w.description
      ? w.description.split(/[;\n]/).filter(Boolean).map(d => `<li>${d.trim()}</li>`).join('')
      : '';
    return `
      <div class="work-item">
        <div class="work-role">${w.title || '（職稱未提供）'}</div>
        <div class="work-company">${w.company || '（公司未提供）'}</div>
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

  // Info pills for header
  const infoPills: string[] = [];
  if (position) infoPills.push(position);
  if (years > 0) infoPills.push(`${years} 年經驗`);
  if (candidate.location) infoPills.push(candidate.location);
  const infoPillsHTML = infoPills.map(p => `<span class="info-pill">${p}</span>`).join('');

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
