# Step1ne 獵頭顧問 AI 協作系統

> AI 驅動的候選人管理、職缺配對、進度追蹤平台

**後端 API**：`https://backendstep1ne.zeabur.app`

---

## 文件總覽

### AI 提示詞（直接餵給 AI 使用）

| 文件 | API URL | 說明 |
|------|---------|------|
| [AIbot 操作手冊](./server/guides/AIBOT-API-GUIDE.md) | `/api/guide` | AIbot 完整學習手冊，讀完後可操作所有功能 |
| [評分 Bot 指南](./server/guides/SCORING-GUIDE.md) | `/api/scoring-guide` | openclaw 定時評分任務，自動對新增候選人評分 |
| [職缺匯入指南](./server/guides/JOB-IMPORT-GUIDE.md) | `/api/jobs-import-guide` | 從 104/1111 連結自動匯入完整職缺資料 |
| [履歷分析指南](./server/guides/RESUME-ANALYSIS-GUIDE.md) | `/api/resume-guide` | 履歷解析、穩定性評分、技能萃取 |
| [Bot 履歷上傳指南](./docs/ai-prompts/BOT-RESUME-UPLOAD-GUIDE.md) | — | Bot 履歷匯入流程說明 |
| [AI 模組架構](./docs/ai-prompts/HEADHUNTER-AI-MODULES.md) | — | AI 各模組職責與整體架構 |

### 評分規則與標準

| 文件 | 說明 |
|------|------|
| [人才評級規則](./docs/rules/TALENT-GRADING-RULES.md) | S/A+/A/B/C 評級標準、穩定性評分計算 |
| [候選人評估指南](./docs/rules/CANDIDATE_EVALUATION.md) | 各維度評估標準 |

### API 參考文件

| 文件 | 說明 |
|------|------|
| [API 完整文件](./docs/api/API.md) | 所有端點 Request/Response 格式 |
| [主動獵才快速上手](./docs/api/AI_TALENT_SOURCING_QUICK_START.md) | 爬蟲 + 評分完整流程 |

### 部署與環境設定

| 文件 | 說明 |
|------|------|
| [快速開始](./docs/setup/QUICK-START.md) | 新手第一步 |
| [本地開發](./docs/setup/LOCAL-DEVELOPMENT.md) | 本地環境設定 |
| [Zeabur 部署](./docs/setup/ZEABUR-DEPLOYMENT.md) | 雲端部署步驟 |
| [Zeabur + GoG 設定](./docs/setup/ZEABUR-GOG-SETUP.md) | GoG CLI 整合 |
| [連線設定](./docs/setup/CONNECT-GUIDE.md) | 資料庫/服務連線設定 |

### 範例程式

| 文件 | 說明 |
|------|------|
| [Bot 範例目錄](./docs/examples/) | Node.js / Python / Telegram Bot / curl 測試腳本 |

---

## 快速啟動 AIbot

把以下指令貼給你的 AI（把 `{名字}` 換掉）：

```
請先閱讀以下文件，學習完畢後立即向我自我介紹你的能力：
https://backendstep1ne.zeabur.app/api/guide

讀完後，請用 {名字}-aibot 作為操作者身份。
```

---

## 核心功能

- **候選人管理**：新增、查詢、更新候選人；Kanban 看板追蹤進度
- **AI 評分**：五維度自動評分（人才畫像符合度 / JD 匹配 / 公司適配 / 可觸達性 / 活躍信號）
- **職缺管理**：從 104/1111 一鍵匯入，自動生成公司畫像與人才畫像
- **主動獵才**：GitHub + LinkedIn 爬蟲自動搜尋候選人

---

## 技術架構

| 層級 | 技術 |
|------|------|
| 前端 | React 19 + TypeScript + Vite + Tailwind CSS |
| 後端 | Node.js + Express + PostgreSQL |
| 部署 | Zeabur（前後端分離） |
| AI | Claude API（評分 / 生成畫像 / 履歷分析） |

---

## 專案結構

```
├── components/          # React UI 元件
├── pages/               # 頁面
├── config/              # API 設定
├── server/              # Node.js 後端
│   ├── guides/          # AI 提示詞文件（API 服務用）
│   └── talent-sourcing/ # 爬蟲與評分腳本
├── docs/
│   ├── ai-prompts/      # AI 提示詞（參考用）
│   ├── rules/           # 評分規則與標準
│   ├── api/             # API 文件
│   ├── setup/           # 部署設定
│   ├── technical/       # 技術架構文件
│   ├── examples/        # 範例程式
│   └── archive/         # 歷史文件
├── scripts/             # 初始化腳本
└── dist/                # 前端建置產物
```

---

---

## 📋 待做事項 (Roadmap)

### 🎯 人才看板系統 (Talent Board)

> 詳細設計藍圖：[`docs/talent_board_system_blueprint.md`](./docs/talent_board_system_blueprint.md)

新增「人才看板」頁面，以可視化方式管理候選人：

- [ ] **三層分類系統**
  - A/B/C/D 候選人等級（人才品質）
  - T1/T2/T3 來源分層（公司層級）
  - Hot/Warm/Cold 熱度（成交機會）

- [ ] **Talent Board 看板頁面**
  - 搜尋區（職位/技能/公司/姓名/產業/地區）
  - 多篩選器（Grade / Tier / Heat / 薪資 / 年資 / 最後聯絡）
  - 四種看板模式：Grade Board / Source Board / Heat Board / Pipeline Board

- [ ] **Candidate 卡片 UI**
  - 候選人基本資料 + 3 核心技能
  - A/B/C/D + T1/T2/T3 + Hot/Warm/Cold 標籤
  - 薪資區間 + 最後聯絡時間

- [ ] **Talent Map 人才地圖**
  - 按職位搜尋顯示市場分布
  - 公司來源排行 / 技能分布 / 薪資分布 / 年資分布

- [ ] **Job Matching 匹配機制**（進階）
  - 輸入 JD 自動計算匹配度
  - 權重：技能 35% / 薪資 15% / 年資 15% / 產業 10% / Demand 10% / Heat 10% / Grade 5%

- [ ] **Interaction 跟進紀錄**
  - 記錄每次聯絡（call/message/email/meeting/interview/follow_up）
  - 下一步行動與預定日期

- [ ] **AI 擴充功能**（未來）
  - 履歷自動解析（公司/職稱/技能/年資）
  - JD 自動解析（必備技能/年資要求/產業）
  - AI Candidate Summary 自動生成

---

*Last updated: 2026-03-13*
