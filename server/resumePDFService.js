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
async function parseResumePDF(buffer, useAI = false) {
  const rawText = await extractPDFText(buffer);

  // 自動偵測格式：104 vs LinkedIn
  const is104 = detect104Format(rawText);
  const parsed = is104 ? parse104PDF(rawText) : parseLinkedInPDF(rawText);

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
// 104 人力銀行 格式偵測 + 解析器
// ─────────────────────────────────────────────

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
// 工具函式
// ─────────────────────────────────────────────

function findSectionIndex(lines, pattern, startFrom = 0) {
  for (let i = startFrom; i < lines.length; i++) {
    if (pattern.test(lines[i])) return i;
  }
  return -1;
}
