import React, { useState, useEffect, useCallback, useRef } from 'react';
import { UserProfile, Role, Prompt, PromptCategory, Candidate, Job, Client } from '../types';
import { apiGet, apiPost, apiPatch, apiDelete } from '../config/api';
import { Plus, ThumbsUp, Pin, Copy, Check, Trash2, Edit3, X, ChevronDown, ChevronUp, RefreshCw, Database, Link2, Server } from 'lucide-react';

interface Props {
  userProfile: UserProfile;
}

const CATEGORIES: { id: PromptCategory; icon: string; short: string }[] = [
  { id: '客戶需求理解',        icon: '1️⃣', short: '客戶需求' },
  { id: '職缺分析',            icon: '2️⃣', short: '職缺分析' },
  { id: '人才市場 Mapping',     icon: '3️⃣', short: '市場 Mapping' },
  { id: '人才搜尋',            icon: '4️⃣', short: '人才搜尋' },
  { id: '陌生開發（開發信）',   icon: '5️⃣', short: '陌生開發' },
  { id: '人選訪談',            icon: '6️⃣', short: '人選訪談' },
  { id: '人選評估',            icon: '7️⃣', short: '人選評估' },
  { id: '客戶推薦',            icon: '8️⃣', short: '客戶推薦' },
  { id: '面試與 Offer 管理',   icon: '9️⃣', short: '面試 & Offer' },
];

// ═══════════════════════════════════════════════════════════════
// 分類 → 資料來源 + API 端點映射
// ═══════════════════════════════════════════════════════════════

const CATEGORY_DATA_SOURCES: Record<PromptCategory, {
  needsCandidate: boolean;
  needsJob: boolean;
  needsClient: boolean;
  endpoints: { method: string; path: string; desc: string }[];
}> = {
  '客戶需求理解': {
    needsCandidate: false, needsJob: true, needsClient: true,
    endpoints: [
      { method: 'GET', path: '/api/jobs/:id', desc: '取得職缺詳情（含薪資、技能需求）' },
      { method: 'GET', path: '/api/clients/:id', desc: '取得客戶基本資訊與聯絡人' },
    ],
  },
  '職缺分析': {
    needsCandidate: false, needsJob: true, needsClient: true,
    endpoints: [
      { method: 'GET', path: '/api/jobs/:id', desc: '取得職缺完整 JD 與需求' },
      { method: 'GET', path: '/api/clients/:id', desc: '取得客戶產業與規模' },
    ],
  },
  '人才市場 Mapping': {
    needsCandidate: true, needsJob: true, needsClient: false,
    endpoints: [
      { method: 'GET', path: '/api/jobs/:id', desc: '取得目標職缺需求' },
      { method: 'GET', path: '/api/candidates', desc: '取得候選人列表（篩選技能、產業）' },
    ],
  },
  '人才搜尋': {
    needsCandidate: false, needsJob: true, needsClient: false,
    endpoints: [
      { method: 'GET', path: '/api/jobs/:id', desc: '取得職缺技能與地點需求' },
    ],
  },
  '陌生開發（開發信）': {
    needsCandidate: true, needsJob: true, needsClient: false,
    endpoints: [
      { method: 'GET', path: '/api/candidates/:id', desc: '取得候選人背景、技能、年資' },
      { method: 'GET', path: '/api/jobs/:id', desc: '取得目標職缺資訊' },
    ],
  },
  '人選訪談': {
    needsCandidate: true, needsJob: true, needsClient: false,
    endpoints: [
      { method: 'GET', path: '/api/candidates/:id', desc: '取得候選人完整資料' },
      { method: 'GET', path: '/api/jobs/:id', desc: '取得目標職缺需求' },
    ],
  },
  '人選評估': {
    needsCandidate: true, needsJob: true, needsClient: false,
    endpoints: [
      { method: 'GET', path: '/api/candidates/:id', desc: '取得候選人完整資料（含薪資、經歷）' },
      { method: 'GET', path: '/api/jobs/:id', desc: '取得職缺需求（用於匹配評估）' },
    ],
  },
  '客戶推薦': {
    needsCandidate: true, needsJob: true, needsClient: true,
    endpoints: [
      { method: 'GET', path: '/api/candidates/:id', desc: '取得候選人完整資料' },
      { method: 'GET', path: '/api/jobs/:id', desc: '取得職缺詳情' },
      { method: 'GET', path: '/api/clients/:id', desc: '取得客戶資訊與送件規範' },
      { method: 'GET', path: '/api/clients/:id/submission-rules', desc: '取得客戶送件檢查規範' },
    ],
  },
  '面試與 Offer 管理': {
    needsCandidate: true, needsJob: true, needsClient: true,
    endpoints: [
      { method: 'GET', path: '/api/candidates/:id', desc: '取得候選人薪資期望與競爭 Offer' },
      { method: 'GET', path: '/api/jobs/:id', desc: '取得職缺薪資範圍' },
      { method: 'GET', path: '/api/clients/:id', desc: '取得客戶聯絡人資訊' },
    ],
  },
};

// ═══════════════════════════════════════════════════════════════
// 範例輸出生成器 — 根據分類 + 真實資料自動產出
// ═══════════════════════════════════════════════════════════════

interface SampleData {
  candidate: Candidate | null;
  job: Job | null;
}

function pickRandom<T>(arr: T[]): T | null {
  if (!arr || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

// jobs_pipeline 表的欄位名稱與 Job interface 不同，這裡做統一存取
function getJobTitle(job: any): string {
  return job?.title || job?.position_name || '';
}
function getJobCompany(job: any): string {
  return job?.company || job?.client_company || '';
}
function getJobSalary(job: any): string {
  return job?.salaryText || job?.salary_range || (job?.salaryMin && job?.salaryMax ? `${job.salaryMin}K-${job.salaryMax}K` : '');
}
function getJobSkills(job: any): string[] {
  if (job?.requiredSkills && Array.isArray(job.requiredSkills)) return job.requiredSkills;
  if (job?.key_skills) return job.key_skills.split(/[,、;]+/).map((s: string) => s.trim()).filter(Boolean);
  return [];
}
function getJobYears(job: any): string {
  return String(job?.requiredYears || job?.experience_required || '');
}
function getJobEducation(job: any): string {
  return job?.requiredEducation || job?.education_required || '';
}
function getJobLocation(job: any): string {
  return job?.location || '';
}

function getSkillsArray(skills: string | string[] | undefined): string[] {
  if (!skills) return [];
  if (Array.isArray(skills)) return skills.filter(Boolean);
  return skills.split(/[,、;]+/).map(s => s.trim()).filter(Boolean);
}

// ═══════════════════════════════════════════════════════════════
// 佔位符自動套入引擎
// ═══════════════════════════════════════════════════════════════

function fillPromptPlaceholders(
  content: string,
  candidate: Candidate | null,
  job: Job | null,
  client: Client | null,
): { filled: string; count: number } {
  let result = content;
  let count = 0;

  const replace = (patterns: RegExp, value: string) => {
    if (!value) return;
    result = result.replace(patterns, () => { count++; return value; });
  };

  if (candidate) {
    replace(/\{候選人姓名\}|\{人選姓名\}|\{候選人名字\}/g, candidate.name);
    replace(/\{候選人職稱\}|\{目前職稱\}|\{現職\}/g, candidate.position);
    replace(/\{候選人年資\}|\{年資\}/g, String(candidate.years || ''));
    replace(/\{候選人技能\}|\{技能\}/g, getSkillsArray(candidate.skills).join('、'));
    replace(/\{候選人地點\}|\{所在地點\}/g, candidate.location);
    replace(/\{候選人產業\}|\{所屬產業\}/g, candidate.industry || '');
    replace(/\{目前薪資\}/g, candidate.currentSalary || '');
    replace(/\{期望薪資\}/g, candidate.expectedSalary || '');
    replace(/\{英文名\}/g, candidate.englishName || '');
    replace(/\{語言能力\}/g, candidate.languages || '');
    replace(/\{到職時間\}/g, candidate.noticePeriod || '');
    replace(/\{轉職原因\}/g, candidate.reasonForChange || '');
    replace(/\{求職狀態\}/g, candidate.jobSearchStatus || '');
  }

  if (job) {
    replace(/\{職缺名稱\}|\{職位名稱\}|\{職缺\}/g, getJobTitle(job));
    replace(/\{公司名稱\}|\{公司\}/g, getJobCompany(job));
    replace(/\{職缺地點\}/g, getJobLocation(job));
    replace(/\{職缺薪資\}|\{薪資範圍\}/g, getJobSalary(job));
    replace(/\{必要技能\}|\{技術需求\}/g, getJobSkills(job).join('、'));
    replace(/\{年資要求\}/g, getJobYears(job));
    replace(/\{學歷要求\}/g, getJobEducation(job));
  }

  if (client) {
    replace(/\{客戶公司\}|\{客戶名稱\}/g, client.company_name);
    replace(/\{客戶產業\}/g, client.industry || '');
    replace(/\{聯絡人\}|\{窗口\}/g, client.contact_name || '');
    replace(/\{聯絡人職稱\}/g, client.contact_title || '');
  }

  return { filled: result, count };
}

function generateExampleOutput(category: PromptCategory, data: SampleData): string {
  const { candidate, job } = data;
  const cName = candidate?.name || '王小明';
  const cPos = candidate?.position || 'Senior Engineer';
  const cYears = candidate?.years || 5;
  const cSkills = getSkillsArray(candidate?.skills).slice(0, 5);
  const cSkillStr = cSkills.length > 0 ? cSkills.join('、') : 'React、Node.js、TypeScript';
  const cLocation = candidate?.location || '台北';
  const cIndustry = candidate?.industry || '科技業';
  const cSalary = candidate?.currentSalary || '70K';
  const cExpSalary = candidate?.expectedSalary || '85K+';

  const jCompany = getJobCompany(job) || '某科技公司';
  const jTitle = getJobTitle(job) || 'Senior Frontend Engineer';
  const jLocation = getJobLocation(job) || '台北';
  const jSkills = getJobSkills(job).slice(0, 4);
  const jSkillStr = jSkills.length > 0 ? jSkills.join('、') : 'React、TypeScript、CI/CD';
  const jSalary = getJobSalary(job) || '面議';

  switch (category) {
    case '客戶需求理解':
      return `【${jCompany} — 深度需求訪談問題清單】

▎ 一、組織與團隊背景
1. 這個職缺是新增還是替補？若替補，前任離開的主要原因？
2. 目前團隊有多少人？組織架構和匯報線為何？
3. 團隊技術棧的核心是什麼？未來 1 年有無技術轉型計畫？

▎ 二、職位核心需求
4. 這個角色最重要的 3 個 KPI 是什麼？
5. 前 90 天您希望新人完成哪些里程碑？
6. 技術能力（${jSkillStr}）vs 軟實力（溝通、帶人），您更看重哪邊？

▎ 三、人選畫像
7. 您心目中的理想候選人有什麼背景？（產業、公司規模、管理經驗）
8. 年資要求是硬性的嗎？如果候選人能力出色但年資稍淺，是否考慮？
9. 英語能力需要到什麼程度？是否有跨國協作需求？

▎ 四、薪酬與條件
10. 預算範圍 ${jSalary} 是否有彈性？特別優秀的人選可以上調多少？
11. 除了底薪，還有哪些吸引人的福利/股權激勵？
12. 遠端工作政策是什麼？

▎ 五、面試流程
13. 完整面試流程有幾關？預計 time-to-hire 多長？
14. 技術面試會考什麼？（live coding / system design / take-home）
15. 決策者有幾位？最終 offer 誰拍板？`;

    case '職缺分析':
      return `【職缺深度分析報告】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 職缺：${jTitle}
🏢 公司：${jCompany}
📍 地點：${jLocation}

▎ 一、顯性需求（JD 明確列出）
┌──────────────┬─────────────────────────┐
│ 技術能力      │ ${jSkillStr}            │
│ 經驗年資      │ ${getJobYears(job) || '3'}+ 年           │
│ 學歷要求      │ ${getJobEducation(job) || '大學以上'}   │
│ 薪資範圍      │ ${jSalary}              │
└──────────────┴─────────────────────────┘

▎ 二、隱性需求（從 JD 用字推測）
• 「快速迭代」→ 需要有 Agile/Scrum 經驗
• 「跨部門協作」→ 溝通能力 > 純技術能力
• 「高品質」→ 重視 code review / testing 文化
• 「獨立作業」→ 可能初期無 mentor，需自驅力

▎ 三、市場競爭力分析
• 薪資 ${jSalary} 在台北市場屬於 P50-P75
• 技能組合 ${jSkillStr} 在人才庫中約有 15-20% 人選符合
• 同期類似職缺約 8-12 個，競爭中等偏高

▎ 四、搜尋策略建議
• Tier 1 目標：在職年資 ${getJobYears(job) || '3'}-${Number(getJobYears(job) || 3) + 3} 年，有完整 ${jSkillStr} 經驗
• Tier 2 備選：技術棧 70% 符合，但有快速學習能力
• 預計需接觸 30-40 位候選人，產出 5-8 位推薦人選`;

    case '人才市場 Mapping':
      return `【${cIndustry} — ${cPos} 人才市場地圖】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 目標：${jTitle}（${jCompany}）
🔑 核心技能：${jSkillStr}

▎ Tier 1 — 優先目標公司（直接對標）
┌─────────────────┬───────────┬──────────────┐
│ 公司             │ 規模      │ 預估人才數    │
├─────────────────┼───────────┼──────────────┤
│ Gogolook         │ 300 人    │ 8-12 位      │
│ 91APP            │ 400 人    │ 10-15 位     │
│ Appier           │ 500 人    │ 12-18 位     │
│ iKala            │ 200 人    │ 5-8 位       │
│ PicCollage       │ 100 人    │ 3-5 位       │
└─────────────────┴───────────┴──────────────┘

▎ Tier 2 — 次要目標公司（技術棧相近）
┌─────────────────┬───────────┬──────────────┐
│ 公司             │ 規模      │ 預估人才數    │
├─────────────────┼───────────┼──────────────┤
│ Dcard            │ 200 人    │ 5-8 位       │
│ KKday            │ 300 人    │ 6-10 位      │
│ LINE Taiwan      │ 800 人    │ 15-20 位     │
│ Trend Micro      │ 2000 人   │ 20-30 位     │
└─────────────────┴───────────┴──────────────┘

▎ 總結
• Tier 1 預估可觸及人才池：38-58 位
• Tier 2 預估可觸及人才池：46-68 位
• 建議先從 Tier 1 啟動，2 週內若回覆率 < 15% 再擴展 Tier 2`;

    case '人才搜尋':
      return `【LinkedIn Boolean 搜尋字串】

▎ 搜尋條件：${jTitle} @ ${jLocation}
▎ 核心技能：${jSkillStr}

━━━ 字串 A：精準搜尋（高相關度）━━━

("${jSkills[0] || 'React'}" OR "${jSkills[1] || 'TypeScript'}") AND ("${jSkills[2] || 'Node.js'}" OR "${jSkills[3] || 'AWS'}") AND ("${jTitle.split(' ')[0] || 'Senior'}" OR "Lead" OR "Staff") NOT ("intern" OR "junior" OR "recruiter")

━━━ 字串 B：擴大搜尋（增加觸及率）━━━

("${(jSkills[0] || 'frontend').toLowerCase()}" OR "${(jSkills[1] || 'full-stack').toLowerCase()}") AND ("engineer" OR "developer" OR "architect") AND ("Taiwan" OR "台灣" OR "Taipei" OR "台北")

━━━ 字串 C：被動人才狩獵 ━━━

("${jCompany}" OR "competitor1" OR "competitor2") AND ("${jSkills[0] || 'React'}") AND title:("engineer" OR "developer")

▎ 搜尋策略建議：
• 字串 A 預估結果：50-80 人，精準度高
• 字串 B 預估結果：200-400 人，需人工篩選
• 字串 C 針對性挖角，預估 20-40 人
• 建議每個字串前 3 頁逐一查看，後續頁可快速瀏覽`;

    case '陌生開發（開發信）':
      return `【InMail 開發信範本 — 2 個版本】

━━━ 版本 A：專業直球型 ━━━

Hi ${cName.split(/[\s(（]/)[0]}，

我是 Step1ne 德仁管理顧問的獵頭顧問，專注在${cIndustry}領域的中高階人才服務。

注意到您在 ${cPos} 領域有 ${cYears} 年紮實經驗，特別是 ${cSkillStr} 的技術組合非常亮眼。

目前手上有一個 ${jCompany} 的 ${jTitle} 機會：
• 薪資範圍：${jSalary}
• 地點：${jLocation}
• 技術棧：${jSkillStr}

這個角色在市場上屬於稀缺的好機會，想跟您聊 15 分鐘了解您的想法。

方便的話，可以加我 LINE：xxxx，或直接回覆這封訊息。

Best regards,
[顧問名字]
Step1ne 德仁管理顧問

━━━ 版本 B：輕鬆交流型 ━━━

${cName.split(/[\s(（]/)[0]} 你好！

在 LinkedIn 上看到你的 profile，${cYears} 年的 ${cSkillStr} 經驗讓我印象深刻 👀

我是做${cIndustry}領域獵頭的，最近在幫 ${jCompany} 找 ${jTitle}，覺得你的背景蠻 match 的。

不急著做決定，先聊聊也好～了解一下市場行情對你也有幫助。

有興趣的話回我一下，我們約個方便的時間聊！`;

    case '人選訪談':
      return `【結構化電話篩選問題清單】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 目標職缺：${jTitle}（${jCompany}）
👤 候選人：${cName}
📋 目前：${cPos} ｜ ${cYears} 年經驗

▎ 一、開場（2 分鐘）
• 簡單自我介紹 + 說明通話目的
• 確認通話時間（約 20-25 分鐘）

▎ 二、動機探測（5 分鐘）
1. 目前的工作狀態如何？有在看外面的機會嗎？
2. 如果要換工作，最看重什麼？（技術、薪資、文化、遠端）
3. 有什麼是「絕對不接受」的條件嗎？

▎ 三、技術驗證（8 分鐘）
4. 能否用 1 分鐘描述你目前專案中最有挑戰的部分？
5. ${jSkillStr} — 這些技術你的熟練程度如何？（1-5 分）
6. 你在團隊中通常扮演什麼角色？（執行者/架構師/mentor）
7. 有帶人的經驗嗎？帶過多少人的團隊？

▎ 四、條件確認（5 分鐘）
8. 目前薪資大概在什麼範圍？（含年終、股票等）
9. 期望薪資是多少？有什麼硬性底線嗎？
10. 最快什麼時候可以到職？
11. 對 ${jLocation} 的工作地點 OK 嗎？

▎ 五、收尾（3 分鐘）
12. 目前手上有其他面試或 offer 嗎？
13. 對 ${jCompany} 有什麼了解或疑問？
14. 如果安排面試，你的時間偏好？`;

    case '人選評估':
      return `【候選人完整評估報告】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 候選人：${cName}
📋 現職：${cPos}（${cIndustry}）
📍 地點：${cLocation}
🎯 目標：${jTitle}（${jCompany}）

▎ 一、能力矩陣
┌──────────────┬────────┬────────────────────────┐
│ 評估維度      │ 分數   │ 評語                    │
├──────────────┼────────┼────────────────────────┤
│ 技術深度      │ ★★★★☆ │ ${cSkillStr} 能力紮實   │
│ 產業匹配      │ ★★★★★ │ ${cIndustry}背景完全對標│
│ 穩定度        │ ★★★☆☆ │ 平均任期 2.5 年          │
│ 溝通表達      │ ★★★★☆ │ 邏輯清晰，表達有條理     │
│ 文化適配      │ ★★★★☆ │ 偏好開放、扁平組織       │
│ 管理潛力      │ ★★★☆☆ │ 有帶 3-5 人小組經驗      │
└──────────────┴────────┴────────────────────────┘

▎ 二、優勢亮點
✅ ${cYears} 年 ${cIndustry} 經驗，技術棧與職缺高度吻合
✅ ${cSkills[0] || '核心技術'} 經驗深厚，有大型專案實戰
✅ 溝通能力佳，能與非技術背景的 stakeholder 協作

▎ 三、潛在風險
⚠️ 過去 3 年有 2 次轉職，穩定度需關注
⚠️ 期望薪資 ${cExpSalary} 略高於預算上限
⚠️ 尚未有完整管理經驗

▎ 四、薪資分析
• 目前年薪：${cSalary}（含年終約 14 個月）
• 期望年薪：${cExpSalary}
• 市場行情：P60-P70

▎ 五、推薦等級：⭐ A- 級（建議推薦）
建議安排第一輪技術面試，重點觀察系統設計能力與團隊協作風格。`;

    case '客戶推薦':
      return `【候選人推薦報告】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 推薦職缺：${jTitle}
🏢 推薦客戶：${jCompany}
📅 推薦日期：${new Date().toLocaleDateString('zh-TW')}
👤 推薦顧問：${data.candidate?.consultant || '[顧問名字]'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

▎ 候選人概要
┌──────────────┬─────────────────────────┐
│ 代號          │ Candidate-${(candidate?.id || '001').toString().slice(-3)} │
│ 現職          │ ${cPos}                 │
│ 年資          │ ${cYears} 年            │
│ 產業          │ ${cIndustry}            │
│ 核心技能      │ ${cSkillStr}            │
│ 地點          │ ${cLocation}            │
│ 到職時間      │ ${candidate?.noticePeriod || '1 個月'}  │
└──────────────┴─────────────────────────┘

▎ 推薦理由
1. 技能匹配度高 — ${cSkillStr} 與職缺需求 ${jSkillStr} 高度重疊
2. ${cYears} 年${cIndustry}經驗，對產業脈絡有深入理解
3. 溝通表達能力佳，面試表現預期良好

▎ 薪資期望
• 目前薪資：${cSalary}
• 期望薪資：${cExpSalary}
• 顧問評估：在職缺預算 ${jSalary} 範圍內，預計可協商

▎ 風險提示
• 候選人同時在評估 1-2 個其他機會
• 建議加速面試流程以確保競爭力

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Step1ne 德仁管理顧問 | Confidential`;

    case '面試與 Offer 管理':
      return `【Offer 談判策略建議】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 候選人：${cName}
🏢 客戶：${jCompany}
📋 職位：${jTitle}

▎ Step 1：情報收集（談判前）
┌──────────────────────────────────────┐
│ 候選人現況                            │
│ • 目前薪資：${cSalary}               │
│ • 期望薪資：${cExpSalary}            │
│ • 求職狀態：${candidate?.jobSearchStatus || '被動觀望'} │
│ • 其他 Offer：${candidate?.competingOffers || '無'}     │
│ • 核心動機：${candidate?.motivation || '技術成長'}      │
│                                      │
│ 客戶預算                              │
│ • 薪資範圍：${jSalary}               │
│ • 彈性空間：預估 +10-15%             │
│ • 其他福利：股票/RSU、簽約金可談      │
└──────────────────────────────────────┘

▎ Step 2：策略制定
📌 核心策略：「價值錨定法」
1. 先讓候選人理解這個角色的成長空間，再談數字
2. 強調候選人看重的「${candidate?.motivation || '技術成長'}」在 ${jCompany} 如何實現
3. 如果候選人堅持 ${cExpSalary}，可建議客戶用 Sign-on Bonus 補差價

▎ Step 3：談判話術
📞 對候選人說：
「我已經幫你爭取到很有競爭力的 offer。${jCompany} 給的不只是薪水，他們的技術團隊在業界是前段班的。整體 package 看完再做決定好嗎？」

📞 對客戶說：
「這位候選人在市場上確實很搶手，但他/她對貴公司的技術方向很感興趣。如果薪資能到 XX 級距，我有很高的信心可以 close。」

▎ 時程管控
• Day 0：收到口頭 Offer
• Day 1-2：顧問與候選人溝通期望 → 回報客戶
• Day 3-5：正式 Offer Letter 發出
• Day 5-7：候選人決定期限
• ⚠️ 超過 7 天未回覆 → 主動跟進，了解顧慮`;

    default:
      return `（此分類的範例輸出即將推出）`;
  }
}

// ═══════════════════════════════════════════════════════════════
// 主元件
// ═══════════════════════════════════════════════════════════════

export function PromptLibraryPage({ userProfile }: Props) {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<PromptCategory>('客戶需求理解');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [copiedExample, setCopiedExample] = useState(false);
  const [addForm, setAddForm] = useState({ title: '', content: '' });
  const [editForm, setEditForm] = useState({ title: '', content: '' });
  const [saving, setSaving] = useState(false);

  // 系統資料 — 用於範例輸出 + 資料連結
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [exampleOutput, setExampleOutput] = useState<string>('');
  const [exampleSeed, setExampleSeed] = useState(0); // 觸發重新生成
  const dataLoadedRef = useRef(false);

  // 資料連結 — 選定的候選人 / 職缺 / 客戶
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>('');
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [showEndpoints, setShowEndpoints] = useState(false);
  const [copiedFilled, setCopiedFilled] = useState(false);

  const isAdmin = userProfile.role === Role.ADMIN;
  const viewer = userProfile.displayName;

  // ── 載入系統資料（候選人 + 職缺）──
  useEffect(() => {
    if (dataLoadedRef.current) return;
    dataLoadedRef.current = true;

    const loadSystemData = async () => {
      try {
        const [candRes, jobsRes, clientRes] = await Promise.all([
          apiGet<{ success: boolean; data: Candidate[] }>('/candidates'),
          apiGet<{ success: boolean; data: Job[] }>('/jobs'),
          apiGet<{ success: boolean; data: Client[] }>('/clients'),
        ]);
        if (candRes.success && candRes.data) setCandidates(candRes.data);
        if (jobsRes.success && jobsRes.data) setJobs(jobsRes.data);
        if (clientRes.success && clientRes.data) setClients(clientRes.data);
      } catch (e) {
        console.error('載入系統資料失敗:', e);
      }
    };
    loadSystemData();
  }, []);

  const loadPrompts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<{ success: boolean; data: Prompt[] }>(
        `/prompts?category=${encodeURIComponent(activeCategory)}&viewer=${encodeURIComponent(viewer)}`
      );
      if (data.success) setPrompts(data.data || []);
    } catch (e) {
      console.error('載入提示詞失敗:', e);
    } finally {
      setLoading(false);
    }
  }, [activeCategory, viewer]);

  useEffect(() => { loadPrompts(); }, [loadPrompts]);

  // ── 資料連結：計算選中的實體 ──
  const selectedCandidate = candidates.find(c => String(c.id) === selectedCandidateId) || null;
  const selectedJob = jobs.find(j => String(j.id) === selectedJobId) || null;
  const selectedClient = clients.find(c => String(c.id) === selectedClientId) || null;
  const dataSrc = CATEGORY_DATA_SOURCES[activeCategory];

  // 分類切換時重置選擇
  useEffect(() => {
    setSelectedCandidateId('');
    setSelectedJobId('');
    setSelectedClientId('');
    setShowEndpoints(false);
  }, [activeCategory]);

  // ── 生成範例輸出（當分類、資料、或 seed 改變時）──
  const pinnedPrompt = prompts.find(p => p.is_pinned);

  useEffect(() => {
    if (!pinnedPrompt) {
      setExampleOutput('');
      return;
    }
    // 如果有選定資料，使用選定的；否則隨機取用
    const sampleCandidate = selectedCandidate || pickRandom(candidates);
    const sampleJob = selectedJob || pickRandom(jobs);
    const output = generateExampleOutput(activeCategory, {
      candidate: sampleCandidate,
      job: sampleJob,
    });
    setExampleOutput(output);
  }, [pinnedPrompt?.id, activeCategory, exampleSeed, candidates.length, jobs.length, selectedCandidateId, selectedJobId]);

  const handleRefreshExample = () => {
    setExampleSeed(prev => prev + 1);
  };

  // ── 佔位符套入 ──
  const filledResult = pinnedPrompt
    ? fillPromptPlaceholders(pinnedPrompt.content, selectedCandidate, selectedJob, selectedClient)
    : { filled: '', count: 0 };

  // ── 複製完整 Prompt（含資料上下文）──
  const handleCopyFilled = () => {
    const parts: string[] = [filledResult.filled || pinnedPrompt?.content || ''];

    // 附加資料來源上下文
    const contextLines: string[] = [];
    if (selectedCandidate) contextLines.push(`• 候選人：${selectedCandidate.name}（${selectedCandidate.position}，${selectedCandidate.years}年經驗）→ GET /api/candidates/${selectedCandidate.id}`);
    if (selectedJob) contextLines.push(`• 職缺：${getJobTitle(selectedJob)}（${getJobCompany(selectedJob)}）→ GET /api/jobs/${selectedJob.id}`);
    if (selectedClient) contextLines.push(`• 客戶：${selectedClient.company_name}（${selectedClient.industry || ''}）→ GET /api/clients/${selectedClient.id}`);

    if (contextLines.length > 0) {
      parts.push('\n\n---\n📊 系統資料來源：');
      parts.push(contextLines.join('\n'));
    }

    navigator.clipboard.writeText(parts.join('\n')).then(() => {
      setCopiedFilled(true);
      setTimeout(() => setCopiedFilled(false), 2000);
    });
  };

  // ── 新增提示詞 ──
  const handleAdd = async () => {
    if (!addForm.title.trim() || !addForm.content.trim()) return alert('請填寫標題和內容');
    setSaving(true);
    try {
      const result = await apiPost<{ success: boolean; data: Prompt }>('/prompts', {
        category: activeCategory,
        title: addForm.title.trim(),
        content: addForm.content.trim(),
        author: viewer,
      });
      if (result.success) {
        setPrompts(prev => [result.data, ...prev]);
        setShowAddModal(false);
        setAddForm({ title: '', content: '' });
      }
    } catch (e) {
      alert('新增失敗');
    } finally {
      setSaving(false);
    }
  };

  // ── 編輯提示詞 ──
  const handleEdit = async () => {
    if (!editingPrompt || !editForm.title.trim() || !editForm.content.trim()) return;
    setSaving(true);
    try {
      const result = await apiPatch<{ success: boolean; data: Prompt }>(`/prompts/${editingPrompt.id}`, {
        title: editForm.title.trim(),
        content: editForm.content.trim(),
        actor: viewer,
      });
      if (result.success) {
        setPrompts(prev => prev.map(p => p.id === editingPrompt.id ? result.data : p));
        setEditingPrompt(null);
      }
    } catch (e) {
      alert('更新失敗');
    } finally {
      setSaving(false);
    }
  };

  // ── 刪除提示詞 ──
  const handleDelete = async (id: number) => {
    if (!confirm('確定要刪除這條提示詞嗎？')) return;
    try {
      await apiDelete(`/prompts/${id}`);
      setPrompts(prev => prev.filter(p => p.id !== id));
    } catch (e) {
      alert('刪除失敗');
    }
  };

  // ── 投票 ──
  const handleUpvote = async (id: number) => {
    try {
      const result = await apiPost<{ success: boolean; data: Prompt }>(`/prompts/${id}/upvote`, { voter: viewer });
      if (result.success) {
        setPrompts(prev => prev.map(p => p.id === id ? result.data : p));
      }
    } catch (e) {
      console.error('投票失敗:', e);
    }
  };

  // ── 置頂 ──
  const handlePin = async (id: number, action: 'pin' | 'unpin') => {
    try {
      await apiPost(`/prompts/${id}/pin`, { action, actor: viewer });
      loadPrompts();
    } catch (e) {
      alert('置頂操作失敗');
    }
  };

  // ── 複製 ──
  const handleCopy = (content: string, id: number) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleCopyExample = () => {
    navigator.clipboard.writeText(exampleOutput).then(() => {
      setCopiedExample(true);
      setTimeout(() => setCopiedExample(false), 2000);
    });
  };

  const communityPrompts = prompts.filter(p => !p.is_pinned);

  return (
    <div className="max-w-6xl mx-auto">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900">💡 提示詞資料庫</h1>
          <p className="text-sm text-slate-500 mt-1">團隊共享最佳提示詞，按工作流程分類</p>
        </div>
        <button
          onClick={() => { setAddForm({ title: '', content: '' }); setShowAddModal(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
        >
          <Plus size={18} /> 新增提示詞
        </button>
      </div>

      {/* ── Category Tabs ── */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-6 scrollbar-hide">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
              activeCategory === cat.id
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {cat.icon} {cat.short}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-400">載入中...</div>
      ) : (
        <>
          {/* ── 置頂提示詞 — 雙欄佈局 ── */}
          {pinnedPrompt && (
            <div className="mb-6">
              <h2 className="text-sm font-bold text-amber-600 mb-3 flex items-center gap-2">
                <Pin size={14} /> 置頂提示詞
              </h2>

              {/* 操作列 */}
              <div className="flex items-center gap-2 mb-3">
                <button
                  onClick={() => handleUpvote(pinnedPrompt.id)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    pinnedPrompt.has_voted
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  <ThumbsUp size={14} /> {pinnedPrompt.upvote_count}
                </button>
                <span className="text-xs text-slate-400">
                  by {pinnedPrompt.author} · {new Date(pinnedPrompt.created_at).toLocaleDateString('zh-TW')}
                </span>
                <div className="flex-1" />
                {isAdmin && (
                  <button
                    onClick={() => handlePin(pinnedPrompt.id, 'unpin')}
                    className="px-3 py-1.5 bg-white hover:bg-red-50 text-red-500 rounded-lg text-sm transition-colors border border-red-200"
                  >
                    取消置頂
                  </button>
                )}
              </div>

              {/* ── 🔗 連結系統資料 ── */}
              <div className="bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-200 rounded-xl p-4 mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <Link2 size={14} className="text-indigo-500" />
                  <span className="text-sm font-bold text-indigo-700">連結系統資料</span>
                  <span className="text-xs text-indigo-400">— 選擇資料後自動套入提示詞佔位符，範例輸出也會對應更新</span>
                </div>
                <div className="flex flex-wrap gap-3">
                  {dataSrc.needsCandidate && (
                    <div className="flex-1 min-w-[200px]">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">👤 候選人</label>
                      <select
                        value={selectedCandidateId}
                        onChange={e => setSelectedCandidateId(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none"
                      >
                        <option value="">隨機取用...</option>
                        {candidates.map(c => (
                          <option key={c.id} value={c.id}>{c.name} — {c.position} ({c.years}年)</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {dataSrc.needsJob && (
                    <div className="flex-1 min-w-[200px]">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">💼 職缺</label>
                      <select
                        value={selectedJobId}
                        onChange={e => setSelectedJobId(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none"
                      >
                        <option value="">隨機取用...</option>
                        {jobs.map(j => (
                          <option key={j.id} value={j.id}>{getJobTitle(j)} ({getJobCompany(j)})</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {dataSrc.needsClient && (
                    <div className="flex-1 min-w-[200px]">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">🏢 客戶</label>
                      <select
                        value={selectedClientId}
                        onChange={e => setSelectedClientId(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none"
                      >
                        <option value="">不選擇...</option>
                        {clients.map(c => (
                          <option key={c.id} value={c.id}>{c.company_name}{c.industry ? ` (${c.industry})` : ''}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                {/* 支援的佔位符提示 */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <span className="text-[10px] text-slate-400 mr-1">可用佔位符：</span>
                  {dataSrc.needsCandidate && ['候選人姓名', '目前職稱', '年資', '技能', '候選人產業', '目前薪資', '期望薪資'].map(p => (
                    <code key={p} className="text-[10px] px-1.5 py-0.5 bg-white border border-slate-200 rounded text-indigo-600 font-mono">{`{${p}}`}</code>
                  ))}
                  {dataSrc.needsJob && ['職缺名稱', '公司名稱', '職缺地點', '薪資範圍', '必要技能', '年資要求'].map(p => (
                    <code key={p} className="text-[10px] px-1.5 py-0.5 bg-white border border-slate-200 rounded text-emerald-600 font-mono">{`{${p}}`}</code>
                  ))}
                  {dataSrc.needsClient && ['客戶公司', '客戶產業', '聯絡人', '聯絡人職稱'].map(p => (
                    <code key={p} className="text-[10px] px-1.5 py-0.5 bg-white border border-slate-200 rounded text-violet-600 font-mono">{`{${p}}`}</code>
                  ))}
                </div>
              </div>

              {/* 雙欄：左邊提示詞 + 右邊範例輸出 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* 左欄 — 提示詞（含資料套入） */}
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-300 rounded-2xl overflow-hidden shadow-sm">
                  <div className="px-5 py-3 bg-amber-100/60 border-b border-amber-200 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-amber-800 flex items-center gap-2">
                      ⭐ {pinnedPrompt.title}
                      {filledResult.count > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">
                          已套入 {filledResult.count} 項
                        </span>
                      )}
                    </h3>
                    <div className="flex items-center gap-1.5">
                      {(selectedCandidate || selectedJob || selectedClient) && (
                        <button
                          onClick={handleCopyFilled}
                          className="flex items-center gap-1 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-xs text-white transition-colors font-medium"
                        >
                          {copiedFilled ? <><Check size={12} /> 已複製</> : <><Database size={12} /> 複製含資料</>}
                        </button>
                      )}
                      <button
                        onClick={() => handleCopy(pinnedPrompt.content, pinnedPrompt.id)}
                        className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-amber-50 rounded-lg text-xs text-amber-700 transition-colors border border-amber-200"
                      >
                        {copiedId === pinnedPrompt.id ? <><Check size={12} className="text-green-600" /> 已複製</> : <><Copy size={12} /> 複製原始</>}
                      </button>
                    </div>
                  </div>
                  <pre className="whitespace-pre-wrap text-sm text-slate-700 p-5 font-sans leading-relaxed max-h-[500px] overflow-y-auto">
                    {filledResult.count > 0 ? filledResult.filled : pinnedPrompt.content}
                  </pre>
                </div>

                {/* 右欄 — 範例輸出 */}
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-300 rounded-2xl overflow-hidden shadow-sm">
                  <div className="px-5 py-3 bg-emerald-100/60 border-b border-emerald-200 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-emerald-800 flex items-center gap-2">
                      🤖 範例輸出
                      {(selectedCandidate || selectedJob) ? (
                        <span className="text-[10px] px-1.5 py-0.5 bg-emerald-200 text-emerald-800 rounded-full font-medium">
                          使用選定資料
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded-full font-medium">
                          隨機資料
                        </span>
                      )}
                    </h3>
                    <div className="flex items-center gap-1.5">
                      {!selectedCandidate && !selectedJob && (
                        <button
                          onClick={handleRefreshExample}
                          className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-emerald-50 rounded-lg text-xs text-emerald-700 transition-colors border border-emerald-200"
                          title="隨機取用不同候選人/職缺組合重新生成"
                        >
                          <RefreshCw size={12} /> 換一組
                        </button>
                      )}
                      <button
                        onClick={handleCopyExample}
                        className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-emerald-50 rounded-lg text-xs text-emerald-700 transition-colors border border-emerald-200"
                      >
                        {copiedExample ? <><Check size={12} className="text-green-600" /> 已複製</> : <><Copy size={12} /> 複製</>}
                      </button>
                    </div>
                  </div>
                  <pre className="whitespace-pre-wrap text-sm text-slate-700 p-5 font-sans leading-relaxed max-h-[500px] overflow-y-auto">
                    {exampleOutput || '載入系統資料中...'}
                  </pre>
                </div>
              </div>

              {/* ── API 端點參考 ── */}
              <div className="mt-3 bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setShowEndpoints(!showEndpoints)}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  <Server size={12} className="text-slate-400" />
                  API 端點參考（AI 可呼叫取得即時資料）
                  <span className="text-[10px] text-slate-400 font-normal">共 {dataSrc.endpoints.length} 個端點</span>
                  <div className="flex-1" />
                  <ChevronDown size={12} className={`text-slate-400 transition-transform ${showEndpoints ? 'rotate-180' : ''}`} />
                </button>
                {showEndpoints && (
                  <div className="px-4 pb-3 space-y-1.5 border-t border-slate-200 pt-2">
                    <p className="text-[10px] text-slate-400 mb-2">以下端點可供 AI 呼叫，基底 URL: <code className="text-indigo-600">https://backendstep1ne.zeabur.app</code></p>
                    {dataSrc.endpoints.map((ep, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className={`px-1.5 py-0.5 rounded font-mono font-bold text-[10px] ${
                          ep.method === 'GET' ? 'bg-green-100 text-green-700' :
                          ep.method === 'POST' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {ep.method}
                        </span>
                        <code className="text-indigo-600 font-mono">{ep.path}</code>
                        <span className="text-slate-400">— {ep.desc}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── 社群提示詞 ── */}
          <div>
            <h2 className="text-sm font-bold text-slate-500 mb-3 flex items-center gap-2">
              💬 社群提示詞 ({communityPrompts.length})
            </h2>

            {communityPrompts.length === 0 && !pinnedPrompt && (
              <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300">
                <p className="text-slate-400 text-lg mb-2">這個分類還沒有提示詞</p>
                <p className="text-slate-400 text-sm">點擊「新增提示詞」來分享你的第一個提示詞！</p>
              </div>
            )}

            <div className="space-y-3">
              {communityPrompts.map(prompt => {
                const isExpanded = expandedId === prompt.id;
                const isAuthor = prompt.author === viewer;
                const canEdit = isAuthor || isAdmin;

                return (
                  <div
                    key={prompt.id}
                    className="bg-white rounded-xl border border-slate-200 hover:border-slate-300 transition-all shadow-sm"
                  >
                    <div className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : prompt.id)}>
                          <h3 className="font-bold text-slate-900 truncate">{prompt.title}</h3>
                          <span className="text-xs text-slate-400">
                            by {prompt.author} · {new Date(prompt.created_at).toLocaleDateString('zh-TW')}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 ml-3 flex-shrink-0">
                          <button
                            onClick={() => handleUpvote(prompt.id)}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                              prompt.has_voted
                                ? 'bg-indigo-100 text-indigo-700'
                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                            }`}
                          >
                            <ThumbsUp size={12} /> {prompt.upvote_count}
                          </button>
                          <button
                            onClick={() => handleCopy(prompt.content, prompt.id)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors"
                            title="複製"
                          >
                            {copiedId === prompt.id ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => handlePin(prompt.id, 'pin')}
                              className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-lg transition-colors"
                              title="置頂"
                            >
                              <Pin size={14} />
                            </button>
                          )}
                          {canEdit && (
                            <>
                              <button
                                onClick={() => { setEditingPrompt(prompt); setEditForm({ title: prompt.title, content: prompt.content }); }}
                                className="p-1.5 bg-slate-100 hover:bg-blue-100 text-slate-500 hover:text-blue-600 rounded-lg transition-colors"
                                title="編輯"
                              >
                                <Edit3 size={14} />
                              </button>
                              <button
                                onClick={() => handleDelete(prompt.id)}
                                className="p-1.5 bg-slate-100 hover:bg-red-100 text-slate-500 hover:text-red-600 rounded-lg transition-colors"
                                title="刪除"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : prompt.id)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-lg transition-colors"
                          >
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        </div>
                      </div>

                      {/* 預覽 / 展開 */}
                      {isExpanded ? (
                        <pre className="whitespace-pre-wrap text-sm text-slate-700 bg-slate-50 rounded-xl p-4 mt-3 font-sans leading-relaxed max-h-[400px] overflow-y-auto">
                          {prompt.content}
                        </pre>
                      ) : (
                        <p className="text-sm text-slate-500 mt-2 line-clamp-2">{prompt.content}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* ── 新增 Modal ── */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-bold text-slate-900">新增提示詞</h3>
              <button onClick={() => setShowAddModal(false)} className="p-1 hover:bg-slate-100 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-semibold text-slate-700 mb-1 block">分類</label>
                <div className="px-3 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium">
                  {CATEGORIES.find(c => c.id === activeCategory)?.icon} {activeCategory}
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700 mb-1 block">標題 *</label>
                <input
                  type="text"
                  value={addForm.title}
                  onChange={e => setAddForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="例：客戶需求訪談提問模板"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700 mb-1 block">提示詞內容 *</label>
                <textarea
                  value={addForm.content}
                  onChange={e => setAddForm(f => ({ ...f, content: e.target.value }))}
                  placeholder="輸入完整的提示詞內容..."
                  rows={12}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-y font-mono text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t bg-slate-50 rounded-b-2xl">
              <button onClick={() => setShowAddModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-xl text-sm">取消</button>
              <button
                onClick={handleAdd}
                disabled={saving || !addForm.title.trim() || !addForm.content.trim()}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors"
              >
                {saving ? '儲存中...' : '新增'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 編輯 Modal ── */}
      {editingPrompt && (
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4" onClick={() => setEditingPrompt(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-bold text-slate-900">編輯提示詞</h3>
              <button onClick={() => setEditingPrompt(null)} className="p-1 hover:bg-slate-100 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-semibold text-slate-700 mb-1 block">標題</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700 mb-1 block">提示詞內容</label>
                <textarea
                  value={editForm.content}
                  onChange={e => setEditForm(f => ({ ...f, content: e.target.value }))}
                  rows={12}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-y font-mono text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t bg-slate-50 rounded-b-2xl">
              <button onClick={() => setEditingPrompt(null)} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-xl text-sm">取消</button>
              <button
                onClick={handleEdit}
                disabled={saving}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors"
              >
                {saving ? '儲存中...' : '儲存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
