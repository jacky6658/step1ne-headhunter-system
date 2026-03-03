/**
 * resumePDFService.js
 * LinkedIn PDF 履歷解析服務
 *
 * 支援兩種路徑：
 *   1. rule-based（本地，零 API 費用）
 *   2. rule-based + OpenClaw 技能增強（可選）
 *
 * Zeabur 雲端友善：全程 in-memory，不寫磁碟
 */

const pdfParse = require('pdf-parse');
const axios = require('axios');

// ─────────────────────────────────────────────
// 公開入口
// ─────────────────────────────────────────────

/**
 * parseResumePDF(buffer, useAI)
 * @param {Buffer} buffer  - PDF 二進位資料
 * @param {boolean} useAI  - 是否呼叫 OpenClaw 做技能增強
 * @returns {object}       - 候選人欄位物件
 */
async function parseResumePDF(buffer, useAI = false) {
  const rawText = await extractPDFText(buffer);
  const parsed = parseLinkedInPDF(rawText);

  if (useAI && parsed && rawText.length > 50) {
    try {
      const aiSkills = await enrichSkillsWithOpenClaw(rawText);
      if (aiSkills.length > 0) {
        // 合併，去重
        const combined = [...new Set([...(parsed.skills || []), ...aiSkills])];
        parsed.skills = combined;
        parsed._meta.parseMethod = 'rule-based+openclaw';
      }
    } catch (e) {
      // OpenClaw 不可用時靜默跳過
      console.warn('[resumePDF] OpenClaw enrichment skipped:', e.message);
    }
  }

  return parsed;
}

module.exports = { parseResumePDF };

// ─────────────────────────────────────────────
// Step 1: 提取純文字
// ─────────────────────────────────────────────

async function extractPDFText(buffer) {
  const data = await pdfParse(buffer);
  return data.text || '';
}

// ─────────────────────────────────────────────
// Step 2: rule-based 主解析器
// ─────────────────────────────────────────────

function parseLinkedInPDF(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  const result = {
    name: null,
    position: null,
    currentCompany: null,
    location: null,
    linkedinUrl: null,
    topSkills: [],
    skills: [],
    summary: null,
    notes: null,
    workHistory: [],
    education: null,
    educationJson: [],
    years: null,
    jobChanges: null,
    avgTenure: null,
    source: 'LinkedIn',
    _meta: { parseMethod: 'rule-based', confidence: 0, rawLineCount: lines.length },
  };

  // ── LinkedIn URL ──
  const urlMatch = text.match(/linkedin\.com\/in\/([a-zA-Z0-9\-_%]+)/);
  if (urlMatch) {
    result.linkedinUrl = 'https://www.linkedin.com/in/' + urlMatch[1].replace(/\/$/, '');
  }

  // ── 熱門技能 ──
  const topSkillsStart = findSectionIndex(lines, /^熱門技能$/);
  const skillsSectionEnd = topSkillsStart >= 0
    ? findSectionIndex(lines, /^聯絡資訊$|^Contact Info$/i, topSkillsStart + 1)
    : -1;

  if (topSkillsStart >= 0) {
    // 熱門技能通常在 header 之前，接下來幾行是技能名稱
    const end = skillsSectionEnd > 0 ? skillsSectionEnd : Math.min(topSkillsStart + 8, lines.length);
    for (let i = topSkillsStart + 1; i < end; i++) {
      const line = lines[i];
      // 跳過看起來像網址或空行
      if (line.match(/linkedin\.com|mailto:|http/i)) continue;
      if (line.length < 2) continue;
      // 熱門技能每行一個
      result.topSkills.push(line);
    }
  }

  // ── 姓名（通常在 PDF 第一非 URL 行，或在技能後） ──
  // LinkedIn PDF 格式：第一行或第二行是姓名
  const nonUrlLines = lines.filter(l => !l.match(/linkedin\.com|mailto:|http/i));
  if (nonUrlLines.length > 0) {
    // 姓名通常是前3行中最短的中文名稱或英文名稱
    for (let i = 0; i < Math.min(5, nonUrlLines.length); i++) {
      const l = nonUrlLines[i];
      // 跳過技能關鍵字、地名含逗號的、含 @ 的
      if (l.match(/熱門技能|聯絡資訊|@|位於|Contact/)) continue;
      if (l.length > 40) continue; // 太長不是名字
      if (l.match(/\d{4}/)) continue; // 含年份不是名字
      result.name = l;
      break;
    }
  }

  // ── 職稱 + 公司（含「位於」的行，或第2~4行） ──
  const locationLineIdx = lines.findIndex(l => l.includes('位於'));
  if (locationLineIdx >= 0) {
    const locationLine = lines[locationLineIdx];
    // 格式可能是「職稱 位於 地點」或「職稱 · 公司 位於 地點」
    const parts = locationLine.split('位於');
    if (parts.length >= 2) {
      const leftPart = parts[0].trim();
      const rightPart = parts[1].trim();

      // 職稱與公司用「·」或「@」分隔
      if (leftPart.includes(' · ') || leftPart.includes(' · ')) {
        const dotParts = leftPart.split(/\s*[·•]\s*/);
        result.position = dotParts[0].trim();
        result.currentCompany = dotParts[1]?.trim() || null;
      } else {
        result.position = leftPart;
      }

      result.location = rightPart;
    }
  } else {
    // fallback: 名字後1~2行找職稱
    const nameIdx = lines.findIndex(l => l === result.name);
    if (nameIdx >= 0 && nameIdx + 1 < lines.length) {
      const nextLine = lines[nameIdx + 1];
      if (!nextLine.match(/熱門技能|聯絡資訊|@/) && nextLine.length < 80) {
        result.position = nextLine;
      }
    }
  }

  // ── 地點（台灣城市 regex 補充） ──
  if (!result.location) {
    const twCityPattern = /台北|新北|桃園|台中|台南|高雄|新竹|嘉義|基隆|宜蘭|花蓮|台東|苗栗|彰化|南投|雲林|屏東|澎湖|金門|連江|Taipei|Hsinchu|Taichung/;
    const cityLine = lines.find(l => twCityPattern.test(l) && l.length < 40);
    if (cityLine) result.location = cityLine;
  }

  // ── 簡介（Summary / 簡介 section） ──
  const summaryStart = findSectionIndex(lines, /^簡介$|^Summary$/i);
  const expStart = findSectionIndex(lines, /^經歷$|^Experience$/i);

  if (summaryStart >= 0) {
    const end = expStart > summaryStart ? expStart : summaryStart + 20;
    const summaryLines = lines.slice(summaryStart + 1, end).filter(l => l.length > 5);
    if (summaryLines.length > 0) {
      result.summary = summaryLines.join('\n');
      result.notes = result.summary;
    }
  }

  // ── 工作經歷 ──
  const eduStart = findSectionIndex(lines, /^學歷$|^Education$/i);

  if (expStart >= 0) {
    const expEnd = eduStart > expStart ? eduStart : lines.length;
    result.workHistory = parseWorkHistory(lines.slice(expStart + 1, expEnd));
  }

  // ── 學歷 ──
  if (eduStart >= 0) {
    const certStart = findSectionIndex(lines, /^證照與認證$|^Licenses|^技能$|^Skills$/i, eduStart + 1);
    const eduEnd = certStart > eduStart ? certStart : lines.length;
    result.educationJson = parseEducation(lines.slice(eduStart + 1, eduEnd));
    if (result.educationJson.length > 0) {
      const edu = result.educationJson[0];
      result.education = [edu.school, edu.major, edu.degree].filter(Boolean).join(' ');
    }
  }

  // ── 技能彙整 ──
  result.skills = [...result.topSkills];

  // ── 計算統計欄位 ──
  if (result.workHistory.length > 0) {
    const totalMonths = result.workHistory.reduce((acc, w) => acc + (w.duration_months || 0), 0);
    result.years = Math.round((totalMonths / 12) * 10) / 10;

    const companies = [...new Set(result.workHistory.map(w => w.company).filter(Boolean))];
    result.jobChanges = companies.length;

    if (companies.length > 0) {
      result.avgTenure = Math.round(totalMonths / companies.length);
    }
  }

  // ── 信心分數 ──
  let score = 0;
  if (result.name) score += 0.2;
  if (result.position) score += 0.15;
  if (result.linkedinUrl) score += 0.15;
  if (result.workHistory.length > 0) score += 0.3;
  if (result.educationJson.length > 0) score += 0.1;
  if (result.skills.length > 0) score += 0.1;
  result._meta.confidence = Math.round(score * 100) / 100;

  return result;
}

// ─────────────────────────────────────────────
// 工作經歷解析
// ─────────────────────────────────────────────

function parseWorkHistory(lines) {
  /**
   * LinkedIn 工作經歷 block 格式（繁體中文 PDF）：
   *
   * 公司名稱
   * X 個職位  ← 可選（若有多個職位）
   * 職稱
   * YYYY 年 MM 月 - YYYY 年 MM 月 (X 年 Y 個月)
   * 地點
   * 描述文字...
   */
  const history = [];
  let i = 0;

  const datePattern = /(\d{4})\s*年\s*(\d{1,2})\s*月\s*[-–]\s*(?:(\d{4})\s*年\s*(\d{1,2})\s*月|現在|至今)/;
  const durationPattern = /(\d+)\s*年\s*(\d+)\s*個月|(\d+)\s*年|(\d+)\s*個月/;

  while (i < lines.length) {
    const line = lines[i];

    // 找到日期行 → 往回找職稱與公司
    if (datePattern.test(line)) {
      const dateStr = line;
      const dateM = dateStr.match(datePattern);

      // 計算 duration_months
      let durationMonths = 0;
      const durMatch = dateStr.match(/\(([^)]+)\)/);
      if (durMatch) {
        const dm = durMatch[1].match(durationPattern);
        if (dm) {
          if (dm[1] && dm[2]) durationMonths = parseInt(dm[1]) * 12 + parseInt(dm[2]);
          else if (dm[3]) durationMonths = parseInt(dm[3]) * 12;
          else if (dm[4]) durationMonths = parseInt(dm[4]);
        }
      } else if (dateM) {
        // 從開始/結束年月手動計算
        const startY = parseInt(dateM[1]), startM = parseInt(dateM[2]);
        const endY = dateM[3] ? parseInt(dateM[3]) : new Date().getFullYear();
        const endM = dateM[4] ? parseInt(dateM[4]) : new Date().getMonth() + 1;
        durationMonths = (endY - startY) * 12 + (endM - startM);
        if (durationMonths < 0) durationMonths = 0;
      }

      // 解析開始/結束時間
      const startDate = dateM ? `${dateM[1]}-${String(dateM[2]).padStart(2, '0')}` : null;
      const endDate = dateM && dateM[3] ? `${dateM[3]}-${String(dateM[4]).padStart(2, '0')}` : '現在';

      // 往上找職稱（日期行前1行）
      const titleLine = i >= 1 ? lines[i - 1] : null;
      // 往上找公司（日期行前2行，若無多職位則是公司名）
      const companyLine = i >= 2 ? lines[i - 2] : null;

      // 確認 titleLine 不是日期或純數字
      const title = titleLine && !datePattern.test(titleLine) && !titleLine.match(/^\d+$/) ? titleLine : null;
      const company = companyLine && !datePattern.test(companyLine) && !companyLine.match(/^\d+$|個職位/) ? companyLine : null;

      // 往下找地點（日期行後1行）
      let locationStr = null;
      let descStart = i + 1;
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        // 若下一行是地點（短、含城市 or 台灣/遠端）
        if (nextLine.match(/台北|新北|桃園|台中|台南|高雄|新竹|遠端|Remote|Hybrid|Taipei|全台/i) && nextLine.length < 40) {
          locationStr = nextLine;
          descStart = i + 2;
        }
      }

      // 往下找描述（到下一個日期行或空行結束）
      const descLines = [];
      for (let j = descStart; j < Math.min(descStart + 20, lines.length); j++) {
        if (datePattern.test(lines[j])) break;
        if (lines[j].match(/^[A-Z\u4e00-\u9fff]{1,30}$/) && j > descStart) {
          // 可能是下一個職稱，停止
          const nextJ = j + 1;
          if (nextJ < lines.length && datePattern.test(lines[nextJ])) break;
        }
        descLines.push(lines[j]);
      }

      history.push({
        company: company || null,
        title: title || null,
        start: startDate,
        end: endDate,
        duration_months: durationMonths,
        location: locationStr,
        description: descLines.join('\n').trim() || null,
      });
    }

    i++;
  }

  return history;
}

// ─────────────────────────────────────────────
// 學歷解析
// ─────────────────────────────────────────────

function parseEducation(lines) {
  /**
   * 學歷 block 格式：
   * 學校名稱
   * 學位, 科系
   * YYYY 年 MM 月 - YYYY 年 MM 月
   */
  const edus = [];
  const yearPattern = /(\d{4})\s*年/;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (yearPattern.test(line)) {
      // 找到年份行 → 往上找學校和學位
      const school = i >= 2 ? lines[i - 2] : null;
      const degreeRaw = i >= 1 ? lines[i - 1] : null;

      let degree = null, major = null;
      if (degreeRaw && !yearPattern.test(degreeRaw)) {
        // "碩士, 資訊工程" 或 "Bachelor of Science"
        const degParts = degreeRaw.split(/[,，、]/);
        degree = degParts[0]?.trim() || null;
        major = degParts[1]?.trim() || null;
      }

      // 解析年份
      const yearMatches = line.match(/(\d{4})/g);
      const start = yearMatches?.[0] || null;
      const end = yearMatches?.[1] || null;

      if (school && !yearPattern.test(school) && school.length > 2) {
        edus.push({
          school,
          degree,
          major,
          start,
          end,
        });
      }
    }
    i++;
  }

  return edus;
}

// ─────────────────────────────────────────────
// OpenClaw 技能增強（可選）
// ─────────────────────────────────────────────

async function enrichSkillsWithOpenClaw(rawText) {
  const openClawBase = process.env.OPENCLAW_BASE_URL || 'http://localhost:11434';
  const model = process.env.OPENCLAW_MODEL || 'llama3';

  // 只取工作描述部分（最多 2000 字），避免 token 過多
  const excerpt = rawText.slice(0, 2000);

  const prompt = `請從以下履歷文字中提取所有技術技能名稱（程式語言、框架、工具、平台等），回傳純 JSON 格式：{"skills": ["skill1", "skill2", ...]}。不要解釋，只回傳 JSON。\n\n${excerpt}`;

  const response = await axios.post(`${openClawBase}/api/generate`, {
    model,
    prompt,
    stream: false,
    format: 'json',
  }, { timeout: 15000 });

  const raw = response.data?.response || '';
  const parsed = JSON.parse(raw);
  const skills = parsed?.skills;
  if (Array.isArray(skills)) {
    return skills.filter(s => typeof s === 'string' && s.length > 0);
  }
  return [];
}

// ─────────────────────────────────────────────
// 工具函式
// ─────────────────────────────────────────────

function findSectionIndex(lines, pattern, startFrom = 0) {
  for (let i = startFrom; i < lines.length; i++) {
    if (pattern.test(lines[i])) return i;
  }
  return -1;
}
