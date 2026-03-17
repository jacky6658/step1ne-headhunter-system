/**
 * resumePDFService.js
 * LinkedIn PDF 履歷解析服務
 *
 * 支援兩種路徑：
 *   1. rule-based（本地，零 API 費用）
 *   2. rule-based + OpenClaw 技能增強（可選）
 *
 * 全程 in-memory，不寫磁碟
 */

const { PDFParse } = require('pdf-parse');
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
async function parseResumePDF(buffer, useAI = false, format = 'auto') {
  const rawText = await extractPDFText(buffer);

  let parsed;
  if (format === '104') {
    // 使用者指定 104 人力銀行格式
    console.log('[resumePDF] User selected format: 104');
    parsed = parse104PDF(rawText);
  } else if (format === 'linkedin') {
    // 使用者指定 LinkedIn 格式
    console.log('[resumePDF] User selected format: LinkedIn');
    parsed = parseLinkedInPDF(rawText);
  } else if (format === 'generic') {
    // 使用者指定通用格式
    console.log('[resumePDF] User selected format: generic');
    parsed = parseGenericPDF(rawText);
  } else {
    // 自動偵測格式：104 vs LinkedIn vs 通用
    const is104 = detect104Format(rawText);
    const isLinkedIn = detectLinkedInFormat(rawText);
    if (is104) {
      parsed = parse104PDF(rawText);
    } else if (isLinkedIn) {
      parsed = parseLinkedInPDF(rawText);
    } else {
      // 通用格式 fallback（先嘗試 LinkedIn parser，若工作經歷為空再用通用）
      parsed = parseLinkedInPDF(rawText);
      if (parsed.workHistory.length === 0) {
        console.log('[resumePDF] LinkedIn parser found 0 work entries, trying generic parser...');
        parsed = parseGenericPDF(rawText);
      }
    }
  }

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
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    let text = result.text || '';
    // pdf-parse v2 會插入頁碼分隔符 "-- X of Y --"，移除以免干擾解析
    text = text.replace(/--\s*\d+\s*of\s*\d+\s*--/g, '');
    return text;
  } finally {
    await parser.destroy().catch(() => {});
  }
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

  // ── 熱門技能 (Top Skills) ──
  const topSkillsStart = findSectionIndex(lines, /^(熱門技能|Top Skills)$/i);
  const skillsSectionEnd = topSkillsStart >= 0
    ? findSectionIndex(lines, /^(聯絡資訊|Contact Info|Contact|Languages|語言)$/i, topSkillsStart + 1)
    : -1;

  if (topSkillsStart >= 0) {
    const end = skillsSectionEnd > 0 ? skillsSectionEnd : Math.min(topSkillsStart + 12, lines.length);
    for (let i = topSkillsStart + 1; i < end; i++) {
      const line = lines[i];
      if (line.match(/linkedin\.com|mailto:|http/i)) continue;
      if (line.length < 2) continue;
      // 可能是逗號/頓號分隔的一行多個技能
      const splitSkills = line.split(/[、,，]\s*/).filter(s => s.trim().length > 0);
      result.topSkills.push(...splitSkills.map(s => s.trim()));
    }
  }

  // ── Languages / 語言 ──
  const langStart = findSectionIndex(lines, /^(Languages|語言)$/i);
  if (langStart >= 0) {
    const langItems = [];
    for (let i = langStart + 1; i < Math.min(langStart + 6, lines.length); i++) {
      const line = lines[i];
      if (line.length < 2) continue;
      // 遇到 section header 或明顯不是語言的行就停止
      if (line.match(/^(Summary|Experience|Education|簡介|經歷|學歷|Certifications|Honors|Awards|證照|榮譽|Top Skills|熱門技能)$/i)) break;
      // 語言行通常含括號程度描述，如 "English (Limited Working)" 或 "中文 (母語)"
      // 或者只是語言名稱如 "中文" "English"
      if (line.match(/\(.*\)/) || line.match(/^(English|Chinese|中文|日文|日本語|韓文|French|German|Spanish|Japanese|Korean|Mandarin|Cantonese)/i)) {
        langItems.push(line);
      } else {
        // 不像語言的行 → 可能是下一段（名字、headline 等），停止
        break;
      }
    }
    result.languages = langItems.join(', ');
  }

  // ── 姓名 ──
  // LinkedIn PDF 兩欄佈局，文字交織：
  //   英文版: Contact → URL → Top Skills → ... → Languages → English (...) → [名字] → Headline → Location → Summary
  //   中文版: [名字] → URL → 熱門技能 → ...
  //
  // 策略：找 Summary 前面、不是 section header 也不是語言/技能的行
  const summaryIdx = findSectionIndex(lines, /^(簡介|Summary)$/i);
  const expIdx = findSectionIndex(lines, /^(經歷|Experience)$/i);
  const nameSearchEnd = summaryIdx > 0 ? summaryIdx : (expIdx > 0 ? expIdx : Math.min(30, lines.length));

  // 已知的 section headers 和雜項
  const skipPatterns = /^(Contact|Contact Info|熱門技能|Top Skills|聯絡資訊|Languages|語言|Summary|簡介|Experience|經歷|Education|學歷|Certifications|Embedded Systems|Page \d|linkedin\.com)/i;

  // 語言描述模式（帶括號的如 "English (Limited Working)"）
  const langDescPattern = /\((Native|Full|Professional|Limited|Elementary|母語|精通|流利|基礎|工作)/i;

  // 找名字：從 Languages 段之後開始找，跳過語言描述行
  const nameSearchStart = langStart >= 0 ? langStart + 1 : (topSkillsStart >= 0 ? topSkillsStart + 1 : 0);
  for (let i = nameSearchStart; i < nameSearchEnd; i++) {
    const l = lines[i];
    if (skipPatterns.test(l)) continue;
    if (l.match(/linkedin\.com|mailto:|http|@/i)) continue;
    if (l.length > 60 || l.length < 2) continue;
    if (l.match(/\d{4}/)) continue;
    if (l.match(/^\(.*\)$/)) continue;
    if (langDescPattern.test(l)) continue; // 跳過語言描述
    if (l.includes('、') && l.length > 15) continue; // 跳過技能行
    // 這行看起來像名字
    result.name = l;
    break;
  }

  // fallback：最前面的非 URL/非 header 行
  if (!result.name) {
    const nonUrlLines = lines.filter(l => !l.match(/linkedin\.com|mailto:|http/i));
    for (let i = 0; i < Math.min(5, nonUrlLines.length); i++) {
      const l = nonUrlLines[i];
      if (skipPatterns.test(l)) continue;
      if (langDescPattern.test(l)) continue;
      if (l.length > 40) continue;
      if (l.match(/\d{4}/)) continue;
      result.name = l;
      break;
    }
  }

  // ── 職稱 + 公司 + 地點 ──
  // 中文版：「職稱 位於 地點」
  // 英文版：名字下一行是 headline（公司 + 職稱），再下一行是地點
  const locationLineIdx = lines.findIndex(l => l.includes('位於'));
  if (locationLineIdx >= 0) {
    const locationLine = lines[locationLineIdx];
    const parts = locationLine.split('位於');
    if (parts.length >= 2) {
      const leftPart = parts[0].trim();
      const rightPart = parts[1].trim();
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
    // 英文版 fallback: 名字後面找 headline 和 location
    const nameIdx = lines.findIndex(l => l === result.name);
    if (nameIdx >= 0) {
      // Headline（職稱 + 公司）通常在名字後 1~2 行
      for (let ni = nameIdx + 1; ni < Math.min(nameIdx + 3, lines.length); ni++) {
        const nextLine = lines[ni];
        if (nextLine.match(/^(Summary|簡介|Experience|經歷)$/i)) break;
        if (nextLine.match(/linkedin\.com|@/i)) continue;
        if (nextLine.length > 80 || nextLine.length < 3) continue;
        // 地點行通常含逗號+國家/城市
        if (nextLine.match(/,.*(?:Taiwan|台灣|Taipei|Hsinchu|Taichung|China|Japan|USA|Singapore|Hong Kong)/i)) {
          result.location = nextLine;
        } else if (!result.position) {
          // headline 行 — 可能包含公司名+職稱
          result.position = nextLine;
          // 嘗試拆分公司和職稱（如 "SK hynix Flash Solution Taiwan Software Engineer"）
          // 保持整行作為 position，因為無法可靠拆分
        }
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

  // ── 技能彙整（修正跨行拆分問題如 C+ / + → C++） ──
  const mergedSkills = [];
  for (let si = 0; si < result.topSkills.length; si++) {
    const s = result.topSkills[si];
    // 如果當前項只有符號（如 "+"），嘗試合併到前一個
    if (s.match(/^[+#.]+$/) && mergedSkills.length > 0) {
      mergedSkills[mergedSkills.length - 1] += s;
    } else {
      mergedSkills.push(s);
    }
  }
  result.skills = mergedSkills.filter(s => s.length > 0);

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
   * LinkedIn 工作經歷 block 格式：
   *
   * 中文版：
   *   公司名稱 / 職稱 / YYYY年MM月 - YYYY年MM月 (X年Y個月)
   *
   * 英文版：
   *   Company Name / Title / Month YYYY - Month YYYY (X years Y months)
   */
  const history = [];
  let i = 0;

  // 英文月份映射
  const engMonths = { january:1,february:2,march:3,april:4,may:5,june:6,july:7,august:8,september:9,october:10,november:11,december:12 };

  // 中文日期：2014年8月 - 2017年6月
  const cnDatePattern = /(\d{4})\s*年\s*(\d{1,2})\s*月\s*[-–]\s*(?:(\d{4})\s*年\s*(\d{1,2})\s*月|現在|至今)/;
  // 英文日期：August 2014 - June 2017 或 August 2014 - Present
  const enDatePattern = /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\s*[-–]\s*(?:(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})|Present|Current)/i;
  // 通用中文 duration
  const cnDurationPattern = /(\d+)\s*年\s*(\d+)\s*個月|(\d+)\s*年|(\d+)\s*個月/;
  // 英文 duration：(2 years 11 months) 或 (1 year) 或 (3 months)
  const enDurationPattern = /(\d+)\s*years?\s*(\d+)\s*months?|(\d+)\s*years?|(\d+)\s*months?/i;

  function isDateLine(line) {
    return cnDatePattern.test(line) || enDatePattern.test(line);
  }

  function parseDateLine(line) {
    const cnM = line.match(cnDatePattern);
    const enM = line.match(enDatePattern);

    let startY, startM, endY, endM, durationMonths = 0;

    if (cnM) {
      startY = parseInt(cnM[1]); startM = parseInt(cnM[2]);
      endY = cnM[3] ? parseInt(cnM[3]) : new Date().getFullYear();
      endM = cnM[4] ? parseInt(cnM[4]) : new Date().getMonth() + 1;
    } else if (enM) {
      startM = engMonths[enM[1].toLowerCase()]; startY = parseInt(enM[2]);
      endM = enM[3] ? engMonths[enM[3].toLowerCase()] : new Date().getMonth() + 1;
      endY = enM[4] ? parseInt(enM[4]) : new Date().getFullYear();
    } else {
      return null;
    }

    // duration from parentheses
    const durMatch = line.match(/\(([^)]+)\)/);
    if (durMatch) {
      const dm = durMatch[1].match(cnDurationPattern) || durMatch[1].match(enDurationPattern);
      if (dm) {
        if (dm[1] && dm[2]) durationMonths = parseInt(dm[1]) * 12 + parseInt(dm[2]);
        else if (dm[3]) durationMonths = parseInt(dm[3]) * 12;
        else if (dm[4]) durationMonths = parseInt(dm[4]);
      }
    }
    if (!durationMonths) {
      durationMonths = (endY - startY) * 12 + (endM - startM);
      if (durationMonths < 0) durationMonths = 0;
    }

    const startDate = `${startY}-${String(startM).padStart(2, '0')}`;
    const isPresent = /現在|至今|Present|Current/i.test(line);
    const endDate = isPresent ? '現在' : `${endY}-${String(endM).padStart(2, '0')}`;

    return { startDate, endDate, durationMonths };
  }

  while (i < lines.length) {
    const line = lines[i];

    if (isDateLine(line)) {
      const dateInfo = parseDateLine(line);
      if (!dateInfo) { i++; continue; }

      // 往上找職稱（日期行前1行）
      const titleLine = i >= 1 ? lines[i - 1] : null;
      // 往上找公司（日期行前2行）
      const companyLine = i >= 2 ? lines[i - 2] : null;

      const title = titleLine && !isDateLine(titleLine) && !titleLine.match(/^\d+$/) ? titleLine : null;
      const company = companyLine && !isDateLine(companyLine) && !companyLine.match(/^\d+$|個職位|\d+ positions?/i) ? companyLine : null;

      // 往下找地點
      let locationStr = null;
      let descStart = i + 1;
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        if (nextLine.match(/台北|新北|桃園|台中|台南|高雄|新竹|遠端|Remote|Hybrid|Taipei|Hsinchu|Taichung|Taiwan|全台/i) && nextLine.length < 40) {
          locationStr = nextLine;
          descStart = i + 2;
        }
      }

      // 往下找描述
      const descLines = [];
      for (let j = descStart; j < Math.min(descStart + 20, lines.length); j++) {
        if (isDateLine(lines[j])) break;
        // 跳過 "Page X of Y"
        if (lines[j].match(/^Page \d+ of \d+$/i)) continue;
        if (lines[j].match(/^[A-Z\u4e00-\u9fff][A-Za-z\u4e00-\u9fff\s.,']{1,50}$/) && j > descStart) {
          const nextJ = j + 1;
          if (nextJ < lines.length && isDateLine(lines[nextJ])) break;
          // 可能是下一個公司名（後面接職稱+日期行）
          if (nextJ + 1 < lines.length && isDateLine(lines[nextJ + 1])) break;
        }
        descLines.push(lines[j]);
      }

      history.push({
        company: company || null,
        title: title || null,
        start: dateInfo.startDate,
        end: dateInfo.endDate,
        duration_months: dateInfo.durationMonths,
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
   *
   * 中文版：
   *   學校名稱
   *   碩士, 資訊工程
   *   2007年9月 - 2009年6月
   *
   * 英文版：
   *   National University of Tainan
   *   Master's degree, Computer Science · (2007 - 2009)
   *
   * 或者年份在同一行：
   *   Master's degree, Computer Science · (2007 - 2009)
   */
  const edus = [];
  // 中文年份：2007年
  const cnYearPattern = /(\d{4})\s*年/;
  // 英文年份在括號中或 · 後面：(2007 - 2009)
  const enYearInLinePattern = /[·\(]\s*\(?\s*(\d{4})\s*[-–]\s*(\d{4})\s*\)?/;
  // 通用年份
  const anyYearPattern = /(\d{4})/g;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    // 跳過 "Page X of Y"
    if (line.match(/^Page \d+ of \d+$/i)) { i++; continue; }

    // 檢測含年份的行（學歷日期行）
    const hasCnYear = cnYearPattern.test(line);
    const hasEnYear = enYearInLinePattern.test(line);
    const hasYears = line.match(anyYearPattern);

    if (hasCnYear || hasEnYear || (hasYears && hasYears.length >= 2 && line.length < 80)) {
      let school = null, degree = null, major = null, start = null, end = null;

      // 英文格式：學位+科系+年份在同一行（如 "Master's degree, Computer Science · (2007 - 2009)"）
      if (hasEnYear || (line.match(/degree|bachelor|master|doctor|phd|mba|碩士|學士|博士/i) && hasYears)) {
        // 學校在前一行
        school = i >= 1 ? lines[i - 1] : null;
        if (school && (school.match(/^Page \d/i) || school.length < 3)) school = null;

        // 解析學位、科系
        const degreeText = line.replace(/[·\(]\s*\(?\s*\d{4}\s*[-–]\s*\d{4}\s*\)?/, '').trim();
        const degParts = degreeText.split(/[,，]\s*/);
        degree = degParts[0]?.trim() || null;
        major = degParts[1]?.trim() || null;

        // 解析年份
        const yearMatches = line.match(anyYearPattern);
        start = yearMatches?.[0] || null;
        end = yearMatches?.[1] || null;
      } else if (hasCnYear) {
        // 中文格式：年份行，學校和學位在前面
        school = i >= 2 ? lines[i - 2] : null;
        const degreeRaw = i >= 1 ? lines[i - 1] : null;
        if (degreeRaw && !cnYearPattern.test(degreeRaw)) {
          const degParts = degreeRaw.split(/[,，、]/);
          degree = degParts[0]?.trim() || null;
          major = degParts[1]?.trim() || null;
        }
        const yearMatches = line.match(anyYearPattern);
        start = yearMatches?.[0] || null;
        end = yearMatches?.[1] || null;
      }

      if (school && school.length > 2 && !school.match(/^\d{4}/)) {
        edus.push({ school, degree, major, start, end });
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
// 104 人力銀行 格式偵測 + 解析器
// ─────────────────────────────────────────────

function detectLinkedInFormat(text) {
  // 支援中文與英文 LinkedIn PDF
  const markers = [
    'linkedin.com/in/',
    '熱門技能', 'Top Skills',
    '經歷', 'Experience',
    '簡介', 'Summary',
    '學歷', 'Education',
    'Languages', '語言',
    'Page 1 of', 'Page 2 of',
  ];
  let hits = 0;
  for (const m of markers) { if (text.includes(m)) hits++; }
  return hits >= 3;
}

function detect104Format(text) {
  // 104 履歷特徵關鍵字
  const markers = ['個人資料', '就業狀態', '主要手機', '工作經驗', '求職條件', '希望職稱'];
  let hits = 0;
  for (const m of markers) { if (text.includes(m)) hits++; }
  return hits >= 2;
}

function parse104PDF(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const fullText = text;

  const result = {
    name: null,
    position: null,
    currentCompany: null,
    location: null,
    linkedinUrl: null,
    phone: null,
    email: null,
    age: null,
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
    languages: null,
    certifications: null,
    industry: null,
    noticePeriod: null,
    expectedSalary: null,
    jobSearchStatus: null,
    source: '104',
    _meta: { parseMethod: '104-rule-based', confidence: 0, rawLineCount: lines.length },
  };

  // ── 姓名：通常在最前面，或在 header 區塊 ──
  // 104 格式: 第一行往往是姓名（中文 2-4 字）
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const l = lines[i];
    if (/^[\u4e00-\u9fff]{2,4}$/.test(l) && !l.match(/個人|學歷|工作|求職|專長|語言|證照|自傳/)) {
      result.name = l;
      break;
    }
  }

  // ── 標籤式欄位提取 (主要手機、E-mail 等) ──
  function findLabelValue(label) {
    const idx = lines.findIndex(l => l.startsWith(label) || l === label);
    if (idx < 0) return null;
    // 值可能在同一行（"主要手機 0987-407-585"）或下一行
    const sameLine = lines[idx].replace(label, '').trim();
    if (sameLine.length > 0) return sameLine;
    if (idx + 1 < lines.length) return lines[idx + 1].trim();
    return null;
  }

  // 電話
  const phoneRaw = findLabelValue('主要手機') || findLabelValue('聯絡電話');
  if (phoneRaw) result.phone = phoneRaw;
  // 若標籤式沒找到，嘗試 regex
  if (!result.phone) {
    const phoneMatch = fullText.match(/(?:手機|電話|聯絡)[^\d]*?(09\d{2}[-\s]?\d{3}[-\s]?\d{3})/);
    if (phoneMatch) result.phone = phoneMatch[1];
  }

  // Email
  const emailRaw = findLabelValue('E-mail') || findLabelValue('Email');
  if (emailRaw) {
    const em = emailRaw.match(/[\w.%+-]+@[\w.-]+\.[a-zA-Z]{2,}/);
    if (em) result.email = em[0];
  }
  if (!result.email) {
    const emMatch = fullText.match(/[\w.%+-]+@[\w.-]+\.[a-zA-Z]{2,}/);
    if (emMatch) result.email = emMatch[0];
  }

  // 年齡
  const ageMatch = fullText.match(/(\d{2,3})\s*歲/);
  if (ageMatch) result.age = parseInt(ageMatch[1]);

  // 就業狀態 → jobSearchStatus
  const statusRaw = findLabelValue('就業狀態');
  if (statusRaw) {
    if (statusRaw.includes('在職')) result.jobSearchStatus = '被動觀望';
    else if (statusRaw.includes('待業') || statusRaw.includes('求職')) result.jobSearchStatus = '主動求職';
  }

  // 地點
  const locationRaw = findLabelValue('通訊地址') || findLabelValue('希望地點');
  if (locationRaw) {
    // 取城市部分
    const cityMatch = locationRaw.match(/(台北|新北|桃園|台中|台南|高雄|新竹|嘉義|基隆|宜蘭|花蓮|台東|苗栗|彰化|南投|雲林|屏東)[市縣]?/);
    result.location = cityMatch ? cityMatch[0] : locationRaw.slice(0, 10);
  }

  // 期望薪資
  const salaryRaw = findLabelValue('希望待遇');
  if (salaryRaw) result.expectedSalary = salaryRaw;

  // 到職時間
  const noticeRaw = findLabelValue('可上班日');
  if (noticeRaw) result.noticePeriod = noticeRaw;

  // ── 職稱 + 公司：從 header 或工作經驗第一筆取 ──
  // 104 header 格式: "公司名 | 職稱"
  for (let i = 0; i < Math.min(15, lines.length); i++) {
    const l = lines[i];
    if (l.includes('|') && (l.includes('工程師') || l.includes('經理') || l.includes('主管') || l.includes('設計') || l.includes('專員'))) {
      const parts = l.split('|').map(s => s.trim());
      if (parts.length >= 2) {
        result.currentCompany = parts[0];
        result.position = parts[parts.length - 1];
      }
      break;
    }
  }

  // ── 總年資 ──
  const yearsMatch = fullText.match(/總年資\s*(\d+)[~～]?(\d+)?\s*年/);
  if (yearsMatch) {
    result.years = parseInt(yearsMatch[2] || yearsMatch[1]);
  }

  // ── 工作經驗 ──
  const workStart = lines.findIndex(l => l === '工作經驗');
  const eduStart = lines.findIndex(l => l === '學歷');
  const jobSectionEnd = lines.findIndex((l, idx) => idx > (workStart + 2) && /^(求職條件|語言能力|專長|自傳|證照)$/.test(l));

  if (workStart >= 0) {
    // 104 工作經歷格式: 職稱 → 公司名（產業 人數） → 職類 | 地點 → 日期 + 年資 → 描述
    const datePattern104 = /(\d{4})\/(\d{1,2})[~～](?:(\d{4})\/(\d{1,2})|仍在職|迄今)/;
    const endIdx = jobSectionEnd > workStart ? jobSectionEnd : lines.length;

    let i = workStart + 1;
    // 跳過「總年資」行
    if (i < endIdx && lines[i].match(/總年資/)) i++;

    while (i < endIdx) {
      // 找日期行
      const dateLine = lines.findIndex((l, idx) => idx >= i && datePattern104.test(l));
      if (dateLine < 0 || dateLine >= endIdx) break;

      const dateStr = lines[dateLine];
      const dateM = dateStr.match(datePattern104);

      // 往上找職稱和公司
      let title = null, company = null, locationStr = null, industryStr = null;

      // 日期行前的幾行包含：職稱、公司（產業）、職類|地點
      for (let j = Math.max(i, dateLine - 5); j < dateLine; j++) {
        const l = lines[j];
        if (l.match(/\|/) && l.match(/(市|區|縣|鎮)/)) {
          // 「職類 | 地點」行
          const parts = l.split('|').map(s => s.trim());
          locationStr = parts[parts.length - 1];
        } else if (l.match(/（.*業.*人）/) || l.match(/\(.*業.*人\)/)) {
          // 公司行：「公司名（產業 人數）」
          company = l.replace(/（[^）]*）|\([^)]*\)/g, '').trim();
          const indM = l.match(/[（(]([^）)]*業)[^）)]*[）)]/);
          if (indM && !result.industry) result.industry = indM[1];
        } else if (!l.match(/總年資/) && l.length > 2 && l.length < 40 && !datePattern104.test(l)) {
          // 可能是職稱
          if (!title) title = l;
        }
      }

      // 計算 duration
      let durationMonths = 0;
      const durMatch = dateStr.match(/(\d+)年(\d+)個月|(\d+)年|(\d+)個月/);
      if (durMatch) {
        if (durMatch[1] && durMatch[2]) durationMonths = parseInt(durMatch[1]) * 12 + parseInt(durMatch[2]);
        else if (durMatch[3]) durationMonths = parseInt(durMatch[3]) * 12;
        else if (durMatch[4]) durationMonths = parseInt(durMatch[4]);
      } else if (dateM) {
        const sY = parseInt(dateM[1]), sM = parseInt(dateM[2]);
        const eY = dateM[3] ? parseInt(dateM[3]) : new Date().getFullYear();
        const eM = dateM[4] ? parseInt(dateM[4]) : new Date().getMonth() + 1;
        durationMonths = (eY - sY) * 12 + (eM - sM);
      }

      const startDate = dateM ? `${dateM[1]}-${String(dateM[2]).padStart(2, '0')}` : null;
      const endDate = dateM && dateM[3] ? `${dateM[3]}-${String(dateM[4]).padStart(2, '0')}` : '現在';

      // 往下找描述
      const descLines = [];
      for (let j = dateLine + 1; j < Math.min(dateLine + 30, endIdx); j++) {
        if (datePattern104.test(lines[j])) break;
        // 若遇到下一個職稱 block 標記（短行 + 後面有公司行），停止
        if (j + 1 < endIdx && (lines[j + 1].match(/（.*業/) || lines[j + 1].match(/\(.*業/))) break;
        if (lines[j].match(/^(求職條件|語言能力|專長|自傳|證照)$/)) break;
        descLines.push(lines[j]);
      }

      if (title || company) {
        result.workHistory.push({
          company: company || null,
          title: title || null,
          start: startDate,
          end: endDate,
          duration_months: Math.max(0, durationMonths),
          location: locationStr,
          description: descLines.join('\n').trim() || null,
        });
      }

      i = dateLine + 1 + descLines.length;
    }
  }

  // ── 學歷 ──
  if (eduStart >= 0) {
    const eduEnd = workStart > eduStart ? workStart : (jobSectionEnd > eduStart ? jobSectionEnd : eduStart + 30);
    // 104 學歷格式: 學校名 → 科系|學位 → 日期
    const eduDatePattern = /(\d{4})\/\d{1,2}[~～](\d{4})\/\d{1,2}/;
    for (let i = eduStart + 1; i < Math.min(eduEnd, lines.length); i++) {
      const dateM = lines[i].match(eduDatePattern);
      if (!dateM) continue;
      const school = i >= 2 ? lines[i - 2] : null;
      const degreeRaw = i >= 1 ? lines[i - 1] : null;
      let degree = null, major = null;
      if (degreeRaw && !eduDatePattern.test(degreeRaw)) {
        // "資訊管理|大學畢業" 或 "資訊管理 大學畢業"
        const parts = degreeRaw.split(/[|｜]/).map(s => s.trim());
        if (parts.length >= 2) {
          major = parts[0]; degree = parts[1].replace('畢業', '');
        } else {
          // "資訊管理 大學畢業"
          const dm = degreeRaw.match(/(.*?)\s*(碩士|學士|博士|大學|高中|專科|研究所).*$/);
          if (dm) { major = dm[1].trim(); degree = dm[2]; }
          else major = degreeRaw;
        }
      }
      if (school && school.length > 2 && !eduDatePattern.test(school) && !school.match(/^(學歷|工作)/)) {
        result.educationJson.push({
          school, degree, major,
          start: dateM[1], end: dateM[2],
        });
      }
    }
    if (result.educationJson.length > 0) {
      const e = result.educationJson[0];
      result.education = [e.school, e.major, e.degree].filter(Boolean).join(' ');
    }
  }

  // ── 語言能力 ──
  const langStart = lines.findIndex(l => l === '語言能力');
  if (langStart >= 0) {
    const langEnd = lines.findIndex((l, idx) => idx > langStart && /^(專長|自傳|證照|求職條件|工作技能)$/.test(l));
    const end = langEnd > langStart ? langEnd : langStart + 20;
    const langParts = [];
    for (let i = langStart + 1; i < end; i++) {
      const l = lines[i];
      if (l.match(/^(英文|日文|中文|台語|韓文|法文|德文|西班牙文|粵語|閩南語|客語)/)) {
        langParts.push(l);
      } else if (l.match(/^(聽|說|讀|寫)\//)) {
        // 程度行，附加到前一語言
        if (langParts.length > 0) langParts[langParts.length - 1] += ' ' + l;
      }
    }
    if (langParts.length > 0) result.languages = langParts.join('、');
  }

  // ── 證照 ──
  const certStart = lines.findIndex(l => l === '證照');
  if (certStart >= 0) {
    const certEnd = lines.findIndex((l, idx) => idx > certStart + 1 && /^(專長|自傳|語言能力|求職條件)$/.test(l));
    const end = certEnd > certStart ? certEnd : certStart + 20;
    const certs = [];
    for (let i = certStart + 1; i < end; i++) {
      const l = lines[i];
      if (l.match(/證照$/) || l.length < 3) continue; // 跳過子標題
      if (l.match(/技術士|證照|證書|認證/)) certs.push(l);
    }
    if (certs.length > 0) result.certifications = certs.join('、');
  }

  // ── 技能（專長 + 工作技能） ──
  const skillStart = lines.findIndex(l => l === '專長' || l === '工作技能');
  if (skillStart >= 0) {
    const skillEnd = lines.findIndex((l, idx) => idx > skillStart + 1 && /^(自傳|證照|語言能力|求職條件)$/.test(l));
    const end = skillEnd > skillStart ? skillEnd : skillStart + 30;
    for (let i = skillStart + 1; i < end; i++) {
      const l = lines[i];
      // 提取 #tag 格式
      const tags = l.match(/#[^\s#]+/g);
      if (tags) {
        tags.forEach(t => result.skills.push(t.replace('#', '')));
      }
    }
  }
  // 工作技能 section 也可能有 #tag
  const skillStart2 = lines.findIndex((l, idx) => idx > (skillStart || 0) + 1 && (l === '工作技能' || l === '其他工作技能'));
  if (skillStart2 >= 0) {
    const end2 = lines.findIndex((l, idx) => idx > skillStart2 + 1 && /^(自傳|證照|語言能力|求職條件|專長)$/.test(l));
    const end = end2 > skillStart2 ? end2 : skillStart2 + 20;
    for (let i = skillStart2 + 1; i < end; i++) {
      const tags = lines[i].match(/#[^\s#]+/g);
      if (tags) tags.forEach(t => { const s = t.replace('#', ''); if (!result.skills.includes(s)) result.skills.push(s); });
    }
  }

  // ── 自傳 → notes ──
  const bioStart = lines.findIndex(l => l === '自傳');
  if (bioStart >= 0) {
    const bioEnd = lines.findIndex((l, idx) => idx > bioStart + 1 && /^(證照|專長|語言能力|求職條件)$/.test(l));
    const end = bioEnd > bioStart ? bioEnd : Math.min(bioStart + 50, lines.length);
    const bioLines = lines.slice(bioStart + 1, end).filter(l => l.length > 5);
    if (bioLines.length > 0) {
      result.notes = bioLines.slice(0, 10).join('\n'); // 限制長度
    }
  }

  // ── 統計 ──
  if (!result.years && result.workHistory.length > 0) {
    const totalMonths = result.workHistory.reduce((a, w) => a + (w.duration_months || 0), 0);
    result.years = Math.round((totalMonths / 12) * 10) / 10;
  }
  if (result.workHistory.length > 0) {
    const companies = [...new Set(result.workHistory.map(w => w.company).filter(Boolean))];
    result.jobChanges = companies.length;
    if (companies.length > 0) {
      const totalMonths = result.workHistory.reduce((a, w) => a + (w.duration_months || 0), 0);
      result.avgTenure = Math.round(totalMonths / companies.length);
    }
  }

  // ── fallback: 若沒找到職稱，用工作經驗第一筆 ──
  if (!result.position && result.workHistory.length > 0) {
    result.position = result.workHistory[0].title;
    result.currentCompany = result.workHistory[0].company;
  }

  // ── 信心分數 ──
  let score = 0;
  if (result.name) score += 0.15;
  if (result.phone) score += 0.1;
  if (result.email) score += 0.1;
  if (result.position) score += 0.1;
  if (result.workHistory.length > 0) score += 0.25;
  if (result.educationJson.length > 0) score += 0.1;
  if (result.skills.length > 0) score += 0.1;
  if (result.age) score += 0.05;
  if (result.languages) score += 0.05;
  result._meta.confidence = Math.round(score * 100) / 100;

  return result;
}

// ─────────────────────────────────────────────
// 通用履歷解析器（fallback）
// 支援多種日期格式：英文月份、YYYY-MM、YYYY.MM、YYYY/MM、純年份等
// ─────────────────────────────────────────────

function parseGenericPDF(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  const result = {
    name: null, position: null, currentCompany: null, location: null,
    linkedinUrl: null, phone: null, email: null, age: null,
    topSkills: [], skills: [], summary: null, notes: null,
    workHistory: [], education: null, educationJson: [],
    years: null, jobChanges: null, avgTenure: null,
    languages: null, certifications: null, industry: null,
    noticePeriod: null, expectedSalary: null, jobSearchStatus: null,
    source: 'Generic',
    _meta: { parseMethod: 'generic-rule-based', confidence: 0, rawLineCount: lines.length },
  };

  const fullText = text;

  // ── 英文月份對照 ──
  const MONTHS = { jan:1, feb:2, mar:3, apr:4, may:5, jun:6, jul:7, aug:8, sep:9, oct:10, nov:11, dec:12,
    january:1, february:2, march:3, april:4, june:6, july:7, august:8, september:9, october:10, november:11, december:12 };
  const monthNames = Object.keys(MONTHS).join('|');

  // ── 多種日期範圍 regex ──
  // 格式1: "Jan 2020 - Jun 2023" / "January 2020 – Present"
  const engDateRange = new RegExp(
    `(${monthNames})\\s*(\\d{4})\\s*[-–~～至]\\s*(?:(${monthNames})\\s*(\\d{4})|present|current|now|至今|現在|迄今)`, 'i'
  );
  // 格式2: "2020-01 - 2023-06" / "2020.01 - 2023.06" / "2020/01 - 2023/06"
  const numDateRange = /(\d{4})[.\-\/](\d{1,2})\s*[-–~～至]\s*(?:(\d{4})[.\-\/](\d{1,2})|present|current|now|至今|現在|迄今|仍在職)/i;
  // 格式3: "2020 年 1 月 - 2023 年 6 月" (Chinese)
  const cnDateRange = /(\d{4})\s*年\s*(\d{1,2})\s*月\s*[-–~～至]\s*(?:(\d{4})\s*年\s*(\d{1,2})\s*月|現在|至今|迄今)/;
  // 格式4: "2020 - 2023" (year only)
  const yearOnlyRange = /^(\d{4})\s*[-–~～至]\s*(?:(\d{4})|present|current|now|至今|現在|迄今)$/i;
  // 格式5: "2020/01~2023/06" (104 style, no spaces)
  const compactDateRange = /(\d{4})\/(\d{1,2})[~～](?:(\d{4})\/(\d{1,2})|仍在職|迄今)/;

  function parseDateRange(line) {
    let startY, startM, endY, endM;

    // Try each pattern
    let m = line.match(engDateRange);
    if (m) {
      startM = MONTHS[m[1].toLowerCase()]; startY = parseInt(m[2]);
      if (m[3] && m[4]) { endM = MONTHS[m[3].toLowerCase()]; endY = parseInt(m[4]); }
      else { endY = new Date().getFullYear(); endM = new Date().getMonth() + 1; }
      return { startY, startM, endY, endM };
    }

    m = line.match(cnDateRange);
    if (m) {
      startY = parseInt(m[1]); startM = parseInt(m[2]);
      if (m[3]) { endY = parseInt(m[3]); endM = parseInt(m[4]); }
      else { endY = new Date().getFullYear(); endM = new Date().getMonth() + 1; }
      return { startY, startM, endY, endM };
    }

    m = line.match(numDateRange);
    if (m) {
      startY = parseInt(m[1]); startM = parseInt(m[2]);
      if (m[3]) { endY = parseInt(m[3]); endM = parseInt(m[4]); }
      else { endY = new Date().getFullYear(); endM = new Date().getMonth() + 1; }
      return { startY, startM, endY, endM };
    }

    m = line.match(compactDateRange);
    if (m) {
      startY = parseInt(m[1]); startM = parseInt(m[2]);
      if (m[3]) { endY = parseInt(m[3]); endM = parseInt(m[4]); }
      else { endY = new Date().getFullYear(); endM = new Date().getMonth() + 1; }
      return { startY, startM, endY, endM };
    }

    m = line.match(yearOnlyRange);
    if (m) {
      startY = parseInt(m[1]); startM = 1;
      if (m[2]) { endY = parseInt(m[2]); endM = 12; }
      else { endY = new Date().getFullYear(); endM = new Date().getMonth() + 1; }
      return { startY, startM, endY, endM };
    }

    return null;
  }

  function hasDateRange(line) {
    return parseDateRange(line) !== null;
  }

  // ── LinkedIn URL ──
  const urlMatch = fullText.match(/linkedin\.com\/in\/([a-zA-Z0-9\-_%]+)/);
  if (urlMatch) result.linkedinUrl = 'https://www.linkedin.com/in/' + urlMatch[1].replace(/\/$/, '');

  // ── Email ──
  const emMatch = fullText.match(/[\w.%+-]+@[\w.-]+\.[a-zA-Z]{2,}/);
  if (emMatch) result.email = emMatch[0];

  // ── Phone ──
  const phoneMatch = fullText.match(/(?:09\d{2}[-\s]?\d{3}[-\s]?\d{3}|\+?886[-\s]?\d[-\s]?\d{4}[-\s]?\d{4}|\(\d{2,3}\)\s*\d{4}[-\s]?\d{4})/);
  if (phoneMatch) result.phone = phoneMatch[0];

  // ── 年齡 ──
  const ageMatch = fullText.match(/(\d{2,3})\s*歲/);
  if (ageMatch) result.age = parseInt(ageMatch[1]);

  // ── 姓名（前幾行中找短的非標題行） ──
  for (let i = 0; i < Math.min(8, lines.length); i++) {
    const l = lines[i];
    if (l.match(/@|http|linkedin|熱門|聯絡|個人|學歷|工作|經歷|resume|curriculum/i)) continue;
    if (l.length > 40 || l.length < 2) continue;
    if (hasDateRange(l)) continue;
    result.name = l;
    break;
  }

  // ── 地點 ──
  const twCityPattern = /台北|新北|桃園|台中|台南|高雄|新竹|嘉義|基隆|宜蘭|花蓮|台東|Taipei|Hsinchu|Taichung/;
  const cityLine = lines.find(l => twCityPattern.test(l) && l.length < 40);
  if (cityLine) result.location = cityLine;

  // ── 工作經歷區段偵測 ──
  const expHeaders = /^(經歷|工作經歷|工作經驗|Experience|Work Experience|Professional Experience|Employment History|EXPERIENCE|WORK EXPERIENCE)$/i;
  const eduHeaders = /^(學歷|教育|Education|EDUCATION|教育背景|Academic)$/i;
  const skillHeaders = /^(技能|Skills|SKILLS|專長|核心技能|Core Competencies|Technical Skills)$/i;
  const otherHeaders = /^(證照|認證|Certifications?|Licenses?|語言|Languages?|自傳|Summary|SUMMARY|About|Projects?|Awards?)$/i;

  const expStart = lines.findIndex(l => expHeaders.test(l));
  const eduStart = lines.findIndex(l => eduHeaders.test(l));
  const skillStart = lines.findIndex(l => skillHeaders.test(l));

  // ── 工作經歷解析 ──
  if (expStart >= 0) {
    // 確定結束位置
    const possibleEnds = [eduStart, skillStart, lines.findIndex((l, idx) => idx > expStart + 2 && otherHeaders.test(l))].filter(x => x > expStart);
    const expEnd = possibleEnds.length > 0 ? Math.min(...possibleEnds) : lines.length;

    const expLines = lines.slice(expStart + 1, expEnd);
    let i = 0;

    while (i < expLines.length) {
      const line = expLines[i];
      const dateInfo = parseDateRange(line);

      if (dateInfo) {
        const durationMonths = Math.max(0, (dateInfo.endY - dateInfo.startY) * 12 + (dateInfo.endM - dateInfo.startM));
        const startDate = `${dateInfo.startY}-${String(dateInfo.startM).padStart(2, '0')}`;
        const endDate = (dateInfo.endY === new Date().getFullYear() && dateInfo.endM === new Date().getMonth() + 1)
          ? '現在' : `${dateInfo.endY}-${String(dateInfo.endM).padStart(2, '0')}`;

        // 往上找職稱和公司
        let title = null, company = null;

        // 日期行前一行 = 職稱，前兩行 = 公司（常見 pattern）
        if (i >= 1) {
          const prev1 = expLines[i - 1];
          if (!hasDateRange(prev1) && prev1.length > 1 && prev1.length < 80) {
            title = prev1;
          }
        }
        if (i >= 2) {
          const prev2 = expLines[i - 2];
          if (!hasDateRange(prev2) && prev2.length > 1 && prev2.length < 80 && prev2 !== title) {
            company = prev2;
          }
        }

        // 也可能是「公司 | 職稱」在同一行
        if (title && title.includes('|')) {
          const parts = title.split('|').map(s => s.trim());
          company = parts[0]; title = parts[1] || parts[0];
        }
        if (title && (title.includes(' - ') || title.includes(' · '))) {
          const sep = title.includes(' · ') ? ' · ' : ' - ';
          const parts = title.split(sep).map(s => s.trim());
          if (parts.length >= 2 && !company) {
            // "公司 - 職稱" or "職稱 - 公司"
            // 通常較短的是職稱
            if (parts[0].length > parts[1].length) { company = parts[0]; title = parts[1]; }
            else { title = parts[0]; company = parts[1]; }
          }
        }

        // 往下找描述
        const descLines = [];
        for (let j = i + 1; j < Math.min(i + 25, expLines.length); j++) {
          if (hasDateRange(expLines[j])) break;
          // 若短行後面緊跟日期，是下一個 entry 的職稱，停止
          if (j + 1 < expLines.length && hasDateRange(expLines[j + 1]) && expLines[j].length < 60) break;
          if (j + 2 < expLines.length && hasDateRange(expLines[j + 2]) && expLines[j].length < 60) break;
          descLines.push(expLines[j]);
        }

        if (title || company) {
          result.workHistory.push({
            company: company || null,
            title: title || null,
            start: startDate,
            end: endDate,
            duration_months: durationMonths,
            description: descLines.join('\n').trim() || null,
          });
        }
      }
      i++;
    }
  }

  // 若還是沒有工作經歷，嘗試全文掃描日期範圍
  if (result.workHistory.length === 0) {
    let i = 0;
    while (i < lines.length) {
      const dateInfo = parseDateRange(lines[i]);
      if (dateInfo && dateInfo.startY >= 1970 && dateInfo.startY <= 2030) {
        const durationMonths = Math.max(0, (dateInfo.endY - dateInfo.startY) * 12 + (dateInfo.endM - dateInfo.startM));
        if (durationMonths > 0 && durationMonths < 600) { // 合理範圍
          const startDate = `${dateInfo.startY}-${String(dateInfo.startM).padStart(2, '0')}`;
          const endDate = `${dateInfo.endY}-${String(dateInfo.endM).padStart(2, '0')}`;

          let title = null, company = null;
          if (i >= 1 && !hasDateRange(lines[i - 1]) && lines[i - 1].length < 80) title = lines[i - 1];
          if (i >= 2 && !hasDateRange(lines[i - 2]) && lines[i - 2].length < 80 && lines[i - 2] !== title) company = lines[i - 2];

          const descLines = [];
          for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
            if (hasDateRange(lines[j])) break;
            if (j + 1 < lines.length && hasDateRange(lines[j + 1]) && lines[j].length < 60) break;
            descLines.push(lines[j]);
          }

          if (title || company) {
            result.workHistory.push({
              company, title,
              start: startDate, end: endDate,
              duration_months: durationMonths,
              description: descLines.join('\n').trim() || null,
            });
          }
        }
      }
      i++;
    }
  }

  // ── 學歷 ──
  if (eduStart >= 0) {
    const possibleEnds = [expStart, skillStart].filter(x => x > eduStart);
    const eduEnd = possibleEnds.length > 0 ? Math.min(...possibleEnds) : Math.min(eduStart + 30, lines.length);
    const eduLines = lines.slice(eduStart + 1, eduEnd);

    for (let i = 0; i < eduLines.length; i++) {
      const dateInfo = parseDateRange(eduLines[i]);
      if (dateInfo) {
        const school = i >= 2 ? eduLines[i - 2] : (i >= 1 ? eduLines[i - 1] : null);
        const degreeRaw = i >= 1 && i >= 2 ? eduLines[i - 1] : null;
        let degree = null, major = null;
        if (degreeRaw && !hasDateRange(degreeRaw)) {
          const parts = degreeRaw.split(/[,，、|｜]/).map(s => s.trim());
          if (parts.length >= 2) { major = parts[0]; degree = parts[1]; }
          else {
            const dm = degreeRaw.match(/(.*?)\s*(碩士|學士|博士|大學|Master|Bachelor|PhD|MBA|BS|MS|BA|MA).*/i);
            if (dm) { major = dm[1].trim(); degree = dm[2]; }
            else major = degreeRaw;
          }
        }
        if (school && school.length > 2 && !hasDateRange(school) && !expHeaders.test(school) && !eduHeaders.test(school)) {
          result.educationJson.push({
            school, degree, major,
            start: String(dateInfo.startY), end: String(dateInfo.endY),
          });
        }
      }
    }
    if (result.educationJson.length > 0) {
      const e = result.educationJson[0];
      result.education = [e.school, e.major, e.degree].filter(Boolean).join(' ');
    }
  }

  // ── 技能 ──
  if (skillStart >= 0) {
    const skillEnd = lines.findIndex((l, idx) => idx > skillStart + 1 && (expHeaders.test(l) || eduHeaders.test(l) || otherHeaders.test(l)));
    const end = skillEnd > skillStart ? skillEnd : Math.min(skillStart + 30, lines.length);
    for (let i = skillStart + 1; i < end; i++) {
      const l = lines[i];
      // #tag 格式
      const tags = l.match(/#[^\s#]+/g);
      if (tags) { tags.forEach(t => result.skills.push(t.replace('#', ''))); continue; }
      // 逗號/頓號分隔
      if (l.includes(',') || l.includes('、') || l.includes('·')) {
        l.split(/[,、·•|]/).map(s => s.trim()).filter(s => s.length > 0 && s.length < 30).forEach(s => {
          if (!result.skills.includes(s)) result.skills.push(s);
        });
      } else if (l.length > 1 && l.length < 30 && !hasDateRange(l)) {
        result.skills.push(l);
      }
    }
  }

  // ── 職稱 fallback ──
  if (!result.position && result.workHistory.length > 0) {
    result.position = result.workHistory[0].title;
    result.currentCompany = result.workHistory[0].company;
  }

  // ── 統計 ──
  if (result.workHistory.length > 0) {
    const totalMonths = result.workHistory.reduce((a, w) => a + (w.duration_months || 0), 0);
    result.years = Math.round((totalMonths / 12) * 10) / 10;
    const companies = [...new Set(result.workHistory.map(w => w.company).filter(Boolean))];
    result.jobChanges = companies.length;
    if (companies.length > 0) result.avgTenure = Math.round(totalMonths / companies.length);
  }

  // ── 信心分數 ──
  let score = 0;
  if (result.name) score += 0.15;
  if (result.phone) score += 0.1;
  if (result.email) score += 0.1;
  if (result.position) score += 0.1;
  if (result.workHistory.length > 0) score += 0.3;
  if (result.educationJson.length > 0) score += 0.1;
  if (result.skills.length > 0) score += 0.1;
  if (result.age) score += 0.05;
  result._meta.confidence = Math.round(score * 100) / 100;

  console.log(`[resumePDF/generic] Parsed: name=${result.name}, workHistory=${result.workHistory.length}, skills=${result.skills.length}, edu=${result.educationJson.length}`);

  return result;
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
