import React, { useState, useMemo } from 'react';
import { Bot, Copy, CheckCheck, ChevronDown, ChevronRight, Zap, FileText, Search, BarChart3, Github, Upload, BookOpen, ExternalLink, Phone, Target } from 'lucide-react';
import { getPublicApiBaseUrl } from '../config/api';

interface AIGuidePageNewProps {
  userProfile?: any;
}

// ── Bot 資料定義 ──────────────────────────────────────────
interface BotInfo {
  id: string;
  name: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
  purpose: string;
  identity: string;
  guideUrl: string;
  startupPrompt: string;
  features: string[];
  workflow: string[];
  apiEndpoints: { method: string; path: string; desc: string }[];
}

const BASE_URL = getPublicApiBaseUrl();

const BOTS: BotInfo[] = [
  {
    id: 'aibot',
    name: '通用 AIbot',
    icon: <Bot className="w-5 h-5" />,
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    purpose: '全方位 AI 助理，可查詢候選人、更新狀態、新增備註、指派顧問、代發信件、主動獵才。',
    identity: '{顧問名稱}-aibot',
    guideUrl: `${BASE_URL}/api/guide`,
    startupPrompt: `請先閱讀以下系統文件，學習完畢後立即向我自我介紹你的能力：

1. 系統操作指南（API 操作手冊）：
${BASE_URL}/api/guide

2. 履歷分析教學指南：
${BASE_URL}/api/resume-guide

3. 學習中心 Prompt 模板知識：
你內建了獵頭顧問學習中心的 Prompt 模板系統。能力包括：
- 20 組專業 Prompt 模板（產業分析 5 組 / 公司理解 5 組 / 角色理解 5 組 / 人選評估 5 組）
- 10 大產業地圖知識（軟體SaaS、SI系統整合、BIM營建、金融FinTech、餐旅飯店、製造業、電商零售、AI數據、醫療生技、物流運輸）
- 16 個角色百科卡片（Backend/Frontend/Fullstack/DevOps/QA/Security/PM/UI-UX/資料工程師/資料科學家/iOS/Android/BIM工程師/廚師/行政助理/主管司機）

當顧問要求學習相關分析時，你應該：
1. 先呼叫 GET ${BASE_URL}/api/jobs 取得系統中的職缺資料
2. 呼叫 GET ${BASE_URL}/api/clients 取得客戶資料
3. 根據顧問指定的模板類型，自動將 API 回傳的資料填入對應 Prompt 模板變數
4. 直接執行填入後的 Prompt，產出完整分析報告
5. 如果有部分變數無法從 API 自動填入，標記為「待確認」並詢問顧問

Prompt 模板變數格式（兩種）：
- 格式 A: [填入公司名稱，如 Shopline] → 用 API 資料替換
- 格式 B: {{公司名稱}} → 用 API 資料替換

API 欄位對照表：
- job.position_name → 職位名稱 / {{職位名稱}}
- job.client_company → 公司名稱 / {{公司名稱}} / [填入公司名稱]
- job.key_skills → 核心技能 / {{核心技能}} / [填入技術棧]
- job.salary_range → 薪資範圍 / {{薪資預算}}
- job.job_description → 職缺描述 / {{貼上完整 JD}} / [貼上完整職缺描述]
- job.department → 部門
- job.team_size → 團隊規模 / [填入團隊人數]
- client.company_name → 客戶公司名稱
- client.industry → 產業別 / {{產業名稱}} / [填入產業別]
- client.company_size → 公司規模 / {{員工人數}} / [填入公司規模]

Prompt 模板清單（顧問可用編號或名稱指定）：
【產業分析】1.產業全景分析 2.競爭對手地圖 3.市場趨勢追蹤 4.商業模式拆解 5.產業術語速查
【公司理解】6.公司定位分析 7.組織架構推論 8.企業文化解讀 9.招募策略規劃 10.競品公司比較
【角色理解】11.角色深度解析 12.JD翻譯器 13.人才地圖繪製 14.面試問題設計 15.技能差距分析
【人選評估】16.履歷快篩清單 17.面試評分表 18.紅旗偵測器 19.Offer談判策略 20.Reference Check指南

使用範例：顧問說「幫我用模板 1 分析 SaaS 產業」，你就取得相關職缺資料，填入「產業全景分析」模板，產出分析報告。

讀完後，請用 {顧問名稱}-aibot 作為操作者身份，並告訴我你現在可以幫我做哪些事（包含學習中心 Prompt 模板功能）。`,
    features: [
      '查詢全部/單一候選人資料',
      '新增候選人（含完整履歷解析）',
      '批量匯入多位候選人',
      '更新 Pipeline 狀態（自動追加進度記錄）',
      '指派負責顧問',
      '新增備註紀錄',
      'AI 履歷分析評分（穩定度 + 綜合評級）',
      '查詢所有職缺',
      '查詢操作日誌',
      '取得顧問聯絡資訊',
      '主動獵才（GitHub + LinkedIn 搜尋）',
      '學習中心 Prompt 模板自動填入（20 組模板）',
      '產業地圖知識查詢（10 大產業）',
      '角色百科查詢（16 個角色卡片）',
      '自動取得職缺/客戶資料填入 Prompt 模板',
    ],
    workflow: [
      '1. Bot 讀取兩份指南並確認系統健康',
      '2. Bot 確認自己的身份（{顧問名稱}-aibot）',
      '3. Bot 向顧問報告可操作的所有功能',
      '4. 顧問下達指令，Bot 執行對應 API 操作',
      '5. 顧問要求學習分析 → Bot 自動取得職缺/客戶資料填入 Prompt 模板',
      '6. Bot 執行填入後的 Prompt → 產出完整分析報告',
    ],
    apiEndpoints: [
      { method: 'GET', path: '/api/candidates?limit=500&page=1', desc: '取得所有候選人' },
      { method: 'GET', path: '/api/candidates/:id', desc: '取得單一候選人' },
      { method: 'POST', path: '/api/candidates', desc: '新增候選人' },
      { method: 'POST', path: '/api/candidates/bulk', desc: '批量匯入候選人' },
      { method: 'PUT', path: '/api/candidates/:id/pipeline-status', desc: '更新 Pipeline 狀態' },
      { method: 'PATCH', path: '/api/candidates/:id', desc: '局部更新候選人資料' },
      { method: 'PATCH', path: '/api/candidates/batch-status', desc: '批量更新狀態' },
      { method: 'GET', path: '/api/jobs', desc: '取得所有職缺' },
      { method: 'GET', path: '/api/system-logs', desc: '查詢操作日誌' },
      { method: 'GET', path: '/api/users/:name/contact', desc: '取得顧問聯絡資訊' },
      { method: 'GET', path: '/api/health', desc: '系統健康檢查' },
      { method: 'GET', path: '/api/clients', desc: '取得所有客戶（用於 Prompt 模板填入）' },
    ],
  },
  {
    id: 'scoring',
    name: '評分 Bot (Scoring)',
    icon: <BarChart3 className="w-5 h-5" />,
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    purpose: '自動評分今日新增的候選人，根據目標職缺的人才畫像、JD、公司畫像進行五維度 AI 評分，評完立即寫回系統。',
    identity: '{顧問名稱}-scoring-bot',
    guideUrl: `${BASE_URL}/api/scoring-guide`,
    startupPrompt: `請讀取以下文件後立即執行評分任務：
${BASE_URL}/api/scoring-guide

我是顧問 {顧問名稱}，你的身份為 {顧問名稱}-scoring-bot。
不需要等待進一步指示，直接開始執行。`,
    features: [
      '自動取得今日新增待評分候選人',
      '從職缺 API 取得人才畫像 / JD / 公司畫像',
      '五維度 AI 評分（人才畫像 40% + JD 匹配 30% + 公司適配 15% + 可觸達性 10% + 活躍信號 5%）',
      '自動判定評級（S / A+ / A / B / C）',
      '自動寫回 ai_match_result + talent_level + stability_score',
      '自動更新狀態為「AI推薦」或「備選人才」',
      '評完一個立刻 PATCH，不等全部完成',
    ],
    workflow: [
      '1. GET /api/candidates?created_today=true',
      '2. 篩選 status = "未開始" 或 "爬蟲初篩" 的候選人',
      '3. GET /api/jobs 找到對應職缺的三份畫像',
      '4. AI 五維度評分 + 撰寫配對結語',
      '5. PATCH /api/candidates/:id 寫回結果',
      '6. 回報今日評分摘要',
    ],
    apiEndpoints: [
      { method: 'GET', path: '/api/candidates?created_today=true', desc: '取得今日新增候選人' },
      { method: 'GET', path: '/api/jobs', desc: '取得職缺三份畫像' },
      { method: 'PATCH', path: '/api/candidates/:id', desc: '寫回評分結果 + ai_match_result' },
    ],
  },
  {
    id: 'job-import',
    name: '職缺匯入 Bot',
    icon: <Upload className="w-5 h-5" />,
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    purpose: '讀取 104/1111 職缺連結或顧問貼的 JD 文字，自動解析並建立職缺記錄，包含 AI 生成的公司畫像、人才畫像、搜尋關鍵字。',
    identity: '{顧問名稱}-import-bot',
    guideUrl: `${BASE_URL}/api/jobs-import-guide`,
    startupPrompt: `請讀取以下文件後立即執行職缺匯入任務：
${BASE_URL}/api/jobs-import-guide

我是顧問 {顧問名稱}，你的身份為 {顧問名稱}-import-bot。
以下是我要匯入的職缺連結：
{貼上 104 或 1111 連結，或直接貼上 JD 文字}
不需要等待進一步指示，直接開始執行。`,
    features: [
      '自動讀取 104 / 1111 職缺頁面',
      '提取結構化職缺資訊（30+ 欄位）',
      'AI 生成公司畫像（company_profile）',
      'AI 生成人才畫像（talent_profile）— 最重要的欄位',
      'AI 生成搜尋關鍵字（search_primary / search_secondary）',
      '自動生成顧問備註（consultant_notes）',
      '一次 POST 寫入所有欄位',
    ],
    workflow: [
      '1. 讀取 104 / 1111 職缺頁面內容',
      '2. 從頁面提取結構化職缺資訊',
      '3. AI 生成三份畫像與搜尋設定',
      '4. POST /api/jobs 建立職缺記錄',
      '5. 回報匯入結果',
    ],
    apiEndpoints: [
      { method: 'POST', path: '/api/jobs', desc: '建立職缺記錄' },
      { method: 'GET', path: '/api/jobs', desc: '確認是否已存在同名職缺' },
      { method: 'PUT', path: '/api/jobs/:id', desc: '更新已存在的職缺' },
    ],
  },
  {
    id: 'resume-import',
    name: '履歷匯入 Bot',
    icon: <FileText className="w-5 h-5" />,
    color: 'text-violet-700',
    bgColor: 'bg-violet-50',
    borderColor: 'border-violet-200',
    purpose: '解析顧問貼上的履歷文字，自動萃取所有欄位、計算穩定性評分、匯入系統，並根據目標職缺進行 AI 配對評分。',
    identity: '{顧問名稱}-resume-bot',
    guideUrl: `${BASE_URL}/api/resume-import-guide`,
    startupPrompt: `請讀取以下文件後立即執行履歷匯入與評分任務：
${BASE_URL}/api/resume-import-guide

我是顧問 {顧問名稱}，你的身份為 {顧問名稱}-resume-bot。
目標職缺：{填入職缺名稱，例如：Java Developer (後端工程師)}

以下是候選人履歷：
{貼上履歷文字}

不需要等待進一步指示，直接開始執行。`,
    features: [
      '解析履歷萃取 20+ 欄位（姓名、技能、工作經歷、學歷等）',
      '計算穩定性評分（3 維度：平均任職月數 + 轉職頻率 + 空窗期）',
      '自動匯入候選人記錄',
      '自動取得目標職缺三份畫像',
      'AI 五維度配對評分',
      '自動寫回評分結果與 ai_match_result',
      '支援批量匯入多份履歷',
    ],
    workflow: [
      '1. 解析履歷 → 萃取結構化欄位',
      '2. 計算穩定性評分（stability_score）',
      '3. POST /api/candidates 匯入候選人',
      '4. GET /api/jobs 取得目標職缺三份畫像',
      '5. AI 五維度評分',
      '6. PATCH /api/candidates/:id 寫回評分結果',
      '7. 回報顧問完整結果',
    ],
    apiEndpoints: [
      { method: 'POST', path: '/api/candidates', desc: '匯入候選人' },
      { method: 'GET', path: '/api/jobs', desc: '取得目標職缺畫像' },
      { method: 'PATCH', path: '/api/candidates/:id', desc: '寫回評分結果' },
    ],
  },
  {
    id: 'github-analysis',
    name: 'GitHub 分析 Bot',
    icon: <Github className="w-5 h-5" />,
    color: 'text-gray-700',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
    purpose: '對有 GitHub 的候選人進行深度技術分析，從專案品質、技能匹配、活躍度、影響力四個維度評估，並撰寫 GitHub 分析報告。',
    identity: '{顧問名稱}-github-bot',
    guideUrl: `${BASE_URL}/api/github-analysis-guide`,
    startupPrompt: `請讀取以下文件後立即執行 GitHub 分析任務：
${BASE_URL}/api/github-analysis-guide

我是顧問 {顧問名稱}，你的身份為 {顧問名稱}-github-bot。
不需要等待進一步指示，直接開始執行。`,
    features: [
      '自動搜尋有 GitHub URL 的待分析候選人',
      '呼叫 GitHub v2 分析 API 取得結構化資料',
      '四維度深度分析（技能匹配 40% + 專案品質 30% + 活躍度 20% + 影響力 10%）',
      '語意分析 repo 名稱/描述（不只關鍵字比對）',
      '自動寫回 ai_match_result + GitHub 分析報告',
      '評完一個立刻 PATCH，不等全部完成',
    ],
    workflow: [
      '1. GET /api/candidates?limit=500&page=1 篩選有 github_url 的候選人',
      '2. GET /api/jobs 找到對應職缺',
      '3. GET /api/github/analyze/{username}?jobId={id} 取得分析資料',
      '4. AI 深度判斷 + 撰寫分析報告',
      '5. PATCH /api/candidates/:id 寫回結果',
      '6. 回報分析摘要',
    ],
    apiEndpoints: [
      { method: 'GET', path: '/api/candidates?limit=500&page=1', desc: '取得所有候選人' },
      { method: 'GET', path: '/api/jobs', desc: '取得職缺資料' },
      { method: 'GET', path: '/api/github/analyze/:username?jobId=:id', desc: 'GitHub v2 分析 API' },
      { method: 'PATCH', path: '/api/candidates/:id', desc: '寫回分析結果' },
    ],
  },
];

// ── AI 評分規則 ──────────────────────────────────────────
const SCORING_RULES = {
  talentLevel: [
    { range: '90–100', level: 'S', desc: '頂尖人才（稀缺），強烈推薦' },
    { range: '80–89', level: 'A+', desc: '優秀人才，強力推薦' },
    { range: '70–79', level: 'A', desc: '合格人才，可推薦' },
    { range: '60–69', level: 'B', desc: '基本合格，需評估後推薦' },
    { range: '< 60', level: 'C', desc: '需補強，謹慎推薦' },
  ],
  recommendation: [
    { range: '85–100', label: '強力推薦', status: 'AI推薦' },
    { range: '70–84', label: '推薦', status: 'AI推薦' },
    { range: '55–69', label: '觀望', status: '備選人才' },
    { range: '< 55', label: '不推薦', status: '備選人才' },
  ],
  dimensions: [
    { name: '人才畫像符合度', weight: '40%', desc: '候選人技能/年資/背景 vs 理想人選特質吻合程度' },
    { name: 'JD 職責匹配度', weight: '30%', desc: '候選人技能是否覆蓋 JD 中的核心工作職責' },
    { name: '公司適配性', weight: '15%', desc: '根據公司文化、產業、規模判斷適合度' },
    { name: '可觸達性', weight: '10%', desc: 'LinkedIn + GitHub 存在 = 100 分，只有 LinkedIn = 60 分' },
    { name: '活躍信號', weight: '5%', desc: 'GitHub 有 = 100 分，無 = 50 分' },
  ],
};

export function AIGuidePageNew({ userProfile }: AIGuidePageNewProps) {
  const [expandedBot, setExpandedBot] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<'bots' | 'scoring' | 'api'>('bots');

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-500 rounded-2xl p-8 text-white shadow-lg">
        <div className="flex items-center gap-3 mb-2">
          <Bot className="w-8 h-8" />
          <h1 className="text-2xl font-black">AI Bot API 使用教學</h1>
        </div>
        <p className="text-purple-100 mt-2">
          本文件整理所有 AI Bot 的操作方式、API 端點、評分規則。將啟動提示詞複製到 AI 對話視窗即可使用。
        </p>
        <div className="mt-4 flex flex-col gap-2 text-sm text-purple-200">
          <div className="flex items-center gap-2">
            <ExternalLink className="w-4 h-4" />
            <span>Base URL：</span>
            <code className="bg-white/20 px-2 py-0.5 rounded font-mono">{BASE_URL}</code>
          </div>
          <div className="flex items-center gap-2">
            <span>🔒 認證：</span>
            <span>操作型 API 需帶 <code className="bg-white/20 px-1.5 py-0.5 rounded font-mono">Authorization: Bearer {'<API_KEY>'}</code>，指南端點（/api/guide 等）免認證</span>
          </div>
        </div>
      </div>

      {/* Section Tabs */}
      <div className="flex gap-2 bg-white rounded-xl p-2 shadow-sm border border-gray-100">
        {[
          { id: 'bots' as const, label: '🤖 五大 AI Bot', desc: '啟動方式與功能說明' },
          { id: 'scoring' as const, label: '📊 AI 評分規則', desc: '評分維度與等級判定' },
          { id: 'api' as const, label: '🔌 API 端點總覽', desc: '所有端點一覽表' },
        ].map(s => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={`flex-1 py-3 px-4 rounded-lg transition-all text-left ${
              activeSection === s.id
                ? 'bg-violet-600 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <div className="font-semibold text-sm">{s.label}</div>
            <div className={`text-xs mt-0.5 ${activeSection === s.id ? 'text-violet-200' : 'text-gray-400'}`}>{s.desc}</div>
          </button>
        ))}
      </div>

      {/* 五大 AI Bot */}
      {activeSection === 'bots' && (
        <div className="space-y-4">
          {/* 快速使用流程 */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 mb-3">⚡ 快速使用流程</h2>
            <div className="flex items-center gap-3 text-sm flex-wrap">
              <span className="px-3 py-1.5 bg-violet-100 text-violet-700 rounded-full font-medium">1. 複製啟動提示詞</span>
              <span className="text-gray-400">→</span>
              <span className="px-3 py-1.5 bg-violet-100 text-violet-700 rounded-full font-medium">2. 貼到 AI 對話視窗</span>
              <span className="text-gray-400">→</span>
              <span className="px-3 py-1.5 bg-violet-100 text-violet-700 rounded-full font-medium">3. 替換 {'{顧問名稱}'}</span>
              <span className="text-gray-400">→</span>
              <span className="px-3 py-1.5 bg-violet-100 text-violet-700 rounded-full font-medium">4. AI 自動執行</span>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              支援的 AI 平台：OpenClaw、ChatGPT、Claude、Gemini 等具備網路存取能力的 AI
            </p>
          </div>

          {/* AI 統一入口啟動指令 */}
          <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl border border-indigo-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-indigo-600" />
                <h2 className="text-lg font-bold text-indigo-900">🚀 AI 統一入口啟動指令</h2>
              </div>
              <button
                onClick={() => handleCopy(
                  `請先閱讀以下統一入口，了解系統有哪些模組：\n${BASE_URL}/api/ai-guide\n\n然後依你的任務讀取對應模組手冊：\n- 客戶操作：${BASE_URL}/api/guide/clients\n- 職缺操作：${BASE_URL}/api/guide/jobs\n- 人選匯入與管理：${BASE_URL}/api/guide/candidates\n- AI 分析與進階操作：${BASE_URL}/api/guide/talent-ops\n\n讀完後，請用 {顧問名稱}-aibot 作為操作者身份，並告訴我你現在可以幫我做哪些事。`,
                  'unified-entry'
                )}
                className={`text-xs px-4 py-2 rounded-lg font-medium flex items-center gap-1.5 transition-colors ${
                  copiedId === 'unified-entry'
                    ? 'bg-green-600 text-white'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                {copiedId === 'unified-entry' ? <CheckCheck className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedId === 'unified-entry' ? '已複製！' : '複製統一啟動詞'}
              </button>
            </div>
            <p className="text-sm text-indigo-700 mb-3">
              不確定該用哪個 Bot？直接複製以下指令貼給任何 AI，它會自動讀取所有模組手冊並依任務操作。
            </p>
            <div className="bg-white rounded-lg p-4 border border-indigo-100 font-mono text-xs text-gray-800 whitespace-pre-line leading-relaxed">
{`請先閱讀以下統一入口，了解系統有哪些模組：
${BASE_URL}/api/ai-guide

然後依你的任務讀取對應模組手冊：
- 客戶操作：${BASE_URL}/api/guide/clients
- 職缺操作：${BASE_URL}/api/guide/jobs
- 人選匯入與管理：${BASE_URL}/api/guide/candidates
- AI 分析與進階操作：${BASE_URL}/api/guide/talent-ops

讀完後，請用 {顧問名稱}-aibot 作為操作者身份，並告訴我你現在可以幫我做哪些事。`}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <a href={`${BASE_URL}/api/ai-guide`} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 underline">
                <ExternalLink className="w-3 h-3" /> 統一入口
              </a>
              <a href={`${BASE_URL}/api/guide/clients`} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 underline">
                <ExternalLink className="w-3 h-3" /> 客戶模組
              </a>
              <a href={`${BASE_URL}/api/guide/jobs`} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 underline">
                <ExternalLink className="w-3 h-3" /> 職缺模組
              </a>
              <a href={`${BASE_URL}/api/guide/candidates`} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 underline">
                <ExternalLink className="w-3 h-3" /> 人選模組
              </a>
              <a href={`${BASE_URL}/api/guide/talent-ops`} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 underline">
                <ExternalLink className="w-3 h-3" /> 人才AI模組
              </a>
            </div>
          </div>

          {/* 每個 Bot 卡片 */}
          {BOTS.map(bot => (
            <div
              key={bot.id}
              className={`${bot.bgColor} rounded-xl border ${bot.borderColor} overflow-hidden shadow-sm`}
            >
              {/* 標題列 */}
              <div className="flex items-center justify-between p-4">
                <button
                  onClick={() => setExpandedBot(expandedBot === bot.id ? null : bot.id)}
                  className="flex items-center gap-3 text-left flex-1"
                >
                  <span className={bot.color}>{bot.icon}</span>
                  <div>
                    <span className={`font-bold text-lg ${bot.color}`}>{bot.name}</span>
                    <p className="text-xs text-gray-500 mt-0.5">{bot.purpose}</p>
                  </div>
                </button>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleCopy(bot.startupPrompt, bot.id)}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium flex items-center gap-1 transition-colors ${
                      copiedId === bot.id
                        ? 'bg-green-600 text-white'
                        : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {copiedId === bot.id ? <CheckCheck className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedId === bot.id ? '已複製' : '複製啟動詞'}
                  </button>
                  <button
                    onClick={() => setExpandedBot(expandedBot === bot.id ? null : bot.id)}
                    className={`p-1.5 rounded ${bot.color}`}
                  >
                    {expandedBot === bot.id ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* 展開內容 */}
              {expandedBot === bot.id && (
                <div className="px-4 pb-4 space-y-4">
                  {/* 身份格式 */}
                  <div className="bg-white/60 rounded-lg p-3">
                    <div className="text-xs font-semibold text-gray-500 mb-1">🆔 Bot 身份格式</div>
                    <code className="text-sm font-mono text-gray-800">{bot.identity}</code>
                    <span className="text-xs text-gray-400 ml-2">（例如：Jacky-{bot.id === 'aibot' ? 'aibot' : bot.id === 'scoring' ? 'scoring-bot' : bot.id === 'job-import' ? 'import-bot' : bot.id === 'resume-import' ? 'resume-bot' : 'github-bot'}）</span>
                  </div>

                  {/* 功能列表 */}
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">📋 功能清單</h4>
                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-1">
                      {bot.features.map((f, i) => (
                        <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                          <Zap className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* 工作流程 */}
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">🔄 執行流程</h4>
                    <div className="space-y-1">
                      {bot.workflow.map((step, i) => (
                        <div key={i} className="text-sm text-gray-600 flex items-start gap-2">
                          <span className="text-gray-400">▸</span>
                          <code className="text-xs">{step}</code>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* API 端點 */}
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">🔌 使用的 API 端點</h4>
                    <div className="bg-white/60 rounded-lg overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="text-left py-1.5 px-2 font-semibold text-gray-500">方法</th>
                            <th className="text-left py-1.5 px-2 font-semibold text-gray-500">路徑</th>
                            <th className="text-left py-1.5 px-2 font-semibold text-gray-500">說明</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bot.apiEndpoints.map((ep, i) => (
                            <tr key={i} className="border-b border-gray-100 last:border-0">
                              <td className="py-1.5 px-2">
                                <span className={`font-mono font-semibold ${
                                  ep.method === 'GET' ? 'text-green-600' :
                                  ep.method === 'POST' ? 'text-blue-600' :
                                  ep.method === 'PUT' ? 'text-amber-600' :
                                  ep.method === 'PATCH' ? 'text-purple-600' :
                                  'text-red-600'
                                }`}>{ep.method}</span>
                              </td>
                              <td className="py-1.5 px-2 font-mono text-gray-700">{ep.path}</td>
                              <td className="py-1.5 px-2 text-gray-500">{ep.desc}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* 指南連結 */}
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>完整指南：</span>
                    <a href={bot.guideUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-mono">
                      {bot.guideUrl}
                    </a>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* AI 評分規則 */}
      {activeSection === 'scoring' && (
        <div className="space-y-4">
          {/* 五維度評分 */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 mb-4">📊 AI 五維度評分</h2>
            <p className="text-sm text-gray-500 mb-4">AI 根據候選人資料與職缺的三份畫像（人才畫像、JD、公司畫像）進行評分。</p>
            <div className="space-y-3">
              {SCORING_RULES.dimensions.map((d, i) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <span className="shrink-0 px-2 py-0.5 bg-violet-100 text-violet-700 rounded font-mono font-bold text-sm">{d.weight}</span>
                  <div>
                    <div className="font-semibold text-sm text-gray-900">{d.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{d.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 綜合評級 */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 mb-4">🏆 綜合評級（talent_level）</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 font-semibold text-gray-600">分數範圍</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-600">等級</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-600">說明</th>
                  </tr>
                </thead>
                <tbody>
                  {SCORING_RULES.talentLevel.map((r, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="py-2 px-3 font-mono">{r.range}</td>
                      <td className="py-2 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                          r.level === 'S' ? 'bg-yellow-100 text-yellow-700' :
                          r.level === 'A+' ? 'bg-green-100 text-green-700' :
                          r.level === 'A' ? 'bg-blue-100 text-blue-700' :
                          r.level === 'B' ? 'bg-gray-100 text-gray-700' :
                          'bg-red-100 text-red-700'
                        }`}>{r.level}</span>
                      </td>
                      <td className="py-2 px-3 text-gray-600">{r.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 推薦等級 */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 mb-4">💡 推薦等級 → 系統狀態映射</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 font-semibold text-gray-600">分數</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-600">推薦等級</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-600">自動狀態</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-600">顧問建議</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { range: '85–100', label: '強力推薦', status: 'AI推薦', action: '⚡ 建議今天聯繫' },
                    { range: '70–84', label: '推薦', status: 'AI推薦', action: '📅 建議本週內聯繫' },
                    { range: '55–69', label: '觀望', status: '備選人才', action: '📌 存入備查' },
                    { range: '< 55', label: '不推薦', status: '備選人才', action: '📌 存入備查' },
                  ].map((r, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="py-2 px-3 font-mono">{r.range}</td>
                      <td className="py-2 px-3 font-medium">{r.label}</td>
                      <td className="py-2 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          r.status === 'AI推薦' ? 'bg-violet-100 text-violet-700' : 'bg-purple-100 text-purple-700'
                        }`}>{r.status}</span>
                      </td>
                      <td className="py-2 px-3 text-gray-600">{r.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 穩定性評分 */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 mb-4">📈 穩定性評分（stability_score）</h2>
            <p className="text-sm text-gray-500 mb-4">依據平均任職月數（50 分）+ 轉職頻率（30 分）+ 最近空窗期（20 分），滿分 100 分。</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <h4 className="font-semibold text-sm text-blue-700 mb-2">平均任職月數（50 分）</h4>
                <div className="space-y-1 text-xs text-gray-600">
                  <div>≥ 36 個月 → 50 分</div>
                  <div>24–35 個月 → 45 分</div>
                  <div>18–23 個月 → 38 分</div>
                  <div>12–17 個月 → 30 分</div>
                  <div>6–11 個月 → 18 分</div>
                  <div>{'< 6 個月 → 5 分'}</div>
                </div>
              </div>
              <div className="bg-emerald-50 rounded-lg p-4">
                <h4 className="font-semibold text-sm text-emerald-700 mb-2">轉職頻率（30 分）</h4>
                <div className="space-y-1 text-xs text-gray-600">
                  <div>{'< 0.3 次/年 → 30 分'}</div>
                  <div>0.3–0.5 次/年 → 25 分</div>
                  <div>0.5–0.7 次/年 → 18 分</div>
                  <div>0.7–1.0 次/年 → 10 分</div>
                  <div>{'> 1.0 次/年 → 3 分'}</div>
                </div>
              </div>
              <div className="bg-amber-50 rounded-lg p-4">
                <h4 className="font-semibold text-sm text-amber-700 mb-2">最近空窗期（20 分）</h4>
                <div className="space-y-1 text-xs text-gray-600">
                  <div>0 個月（在職）→ 20 分</div>
                  <div>1–3 個月 → 18 分</div>
                  <div>3–6 個月 → 12 分</div>
                  <div>6–12 個月 → 6 分</div>
                  <div>{'> 12 個月 → 2 分'}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* API 端點總覽 */}
      {activeSection === 'api' && (
        <div className="space-y-4">
          {[
            {
              category: '📋 候選人管理',
              endpoints: [
                { method: 'GET', path: '/api/candidates?limit=500&page=1', desc: '取得所有候選人（務必帶 limit=2000）' },
                { method: 'GET', path: '/api/candidates?created_today=true', desc: '取得今日新增候選人' },
                { method: 'GET', path: '/api/candidates/:id', desc: '取得單一候選人完整資料' },
                { method: 'POST', path: '/api/candidates', desc: '新增單一候選人' },
                { method: 'POST', path: '/api/candidates/bulk', desc: '批量匯入候選人' },
                { method: 'PATCH', path: '/api/candidates/:id', desc: '局部更新候選人資料（notes, recruiter, talent_level 等）' },
                { method: 'DELETE', path: '/api/candidates/:id', desc: '刪除單一候選人' },
                { method: 'DELETE', path: '/api/candidates/batch', desc: '批量刪除候選人' },
              ]
            },
            {
              category: '🔄 Pipeline 狀態',
              endpoints: [
                { method: 'PUT', path: '/api/candidates/:id/pipeline-status', desc: '更新狀態（自動追加進度記錄 + 寫入日誌）' },
                { method: 'PATCH', path: '/api/candidates/batch-status', desc: '批量更新多位候選人狀態' },
              ]
            },
            {
              category: '💼 職缺管理',
              endpoints: [
                { method: 'GET', path: '/api/jobs', desc: '取得所有職缺（含三份畫像）' },
                { method: 'GET', path: '/api/jobs/:id', desc: '取得單一職缺' },
                { method: 'POST', path: '/api/jobs', desc: '新增職缺' },
                { method: 'PUT', path: '/api/jobs/:id', desc: '更新職缺' },
              ]
            },
            {
              category: '🔍 GitHub 分析',
              endpoints: [
                { method: 'GET', path: '/api/github/analyze/:username', desc: 'GitHub 通用技術分析' },
                { method: 'GET', path: '/api/github/analyze/:username?jobId=:id', desc: 'GitHub 針對職缺匹配分析' },
              ]
            },
            {
              category: '🎯 主動獵才',
              endpoints: [
                { method: 'POST', path: '/api/talent-sourcing/find-candidates', desc: '自動搜尋 GitHub + LinkedIn 並匯入候選人' },
              ]
            },
            {
              category: '👤 顧問 & 系統',
              endpoints: [
                { method: 'GET', path: '/api/users/:displayName/contact', desc: '取得顧問聯絡資訊（含 GitHub Token、Brave API Key）' },
                { method: 'PUT', path: '/api/users/:displayName/contact', desc: '更新顧問聯絡資訊' },
                { method: 'GET', path: '/api/system-logs', desc: '查詢操作日誌（支援 actor, action, type 篩選）' },
                { method: 'GET', path: '/api/health', desc: '系統健康檢查' },
              ]
            },
            {
              category: '📖 指南 API',
              endpoints: [
                { method: 'GET', path: '/api/guide', desc: 'AIbot 操作 API 指南（Markdown）' },
                { method: 'GET', path: '/api/resume-guide', desc: '履歷分析教學指南（Markdown）' },
                { method: 'GET', path: '/api/scoring-guide', desc: 'AI 評分執行指南（Markdown）' },
                { method: 'GET', path: '/api/jobs-import-guide', desc: '職缺匯入執行指南（Markdown）' },
                { method: 'GET', path: '/api/resume-import-guide', desc: '履歷匯入 + 即時評分指南（Markdown）' },
                { method: 'GET', path: '/api/github-analysis-guide', desc: 'GitHub 分析指南（Markdown）' },
              ]
            },
          ].map((cat, ci) => (
            <div key={ci} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
                <h3 className="font-bold text-gray-900">{cat.category}</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <tbody>
                    {cat.endpoints.map((ep, i) => (
                      <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                        <td className="py-2 px-4 w-20">
                          <span className={`font-mono text-xs font-bold ${
                            ep.method === 'GET' ? 'text-green-600' :
                            ep.method === 'POST' ? 'text-blue-600' :
                            ep.method === 'PUT' ? 'text-amber-600' :
                            ep.method === 'PATCH' ? 'text-purple-600' :
                            'text-red-600'
                          }`}>{ep.method}</span>
                        </td>
                        <td className="py-2 px-2 font-mono text-xs text-gray-700">{ep.path}</td>
                        <td className="py-2 px-4 text-gray-500 text-xs">{ep.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {/* 重要注意事項 */}
          <div className="bg-amber-50 rounded-xl p-6 border border-amber-200">
            <h3 className="font-bold text-amber-800 mb-3">⚠️ 重要注意事項</h3>
            <ul className="space-y-2 text-sm text-amber-700">
              <li className="flex items-start gap-2">
                <span className="text-amber-400 mt-0.5">•</span>
                <strong>API 認證</strong>：所有操作型端點（CRUD）需帶 <code className="bg-white/60 px-1 rounded">Authorization: Bearer {'<API_KEY>'}</code>；指南端點（/api/guide、/api/scoring-guide 等）免認證，AI 可直接讀取
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400 mt-0.5">•</span>
                所有 Bot 呼叫 API 時必須帶入身份（actor / by 欄位），否則日誌顯示 system
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400 mt-0.5">•</span>
                取得候選人清單務必帶 ?limit=2000，預設只回 1000 筆
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400 mt-0.5">•</span>
                更新 Pipeline 狀態用 PUT /pipeline-status（自動追加進度），其他欄位用 PATCH
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400 mt-0.5">•</span>
                ai_match_result 必須是 JSON 物件，不是字串
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400 mt-0.5">•</span>
                notes / progressTracking 是整個覆蓋（非追加），更新前先 GET 取得現有資料
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export default AIGuidePageNew;
