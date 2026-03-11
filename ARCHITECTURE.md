# Step1ne 獵頭顧問 AI 協作系統 — 專案架構文件

> 最後更新：2026-03-11

---

## 一、系統總覽

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ZEABUR 雲端平台                               │
│                                                                      │
│   ┌────────────────────┐    /api     ┌────────────────────────┐     │
│   │    FRONTEND         │◄──────────►│      BACKEND            │     │
│   │  React 19 + Vite 6  │            │  Node.js + Express 5    │     │
│   │  TypeScript          │            │  CommonJS               │     │
│   │  Tailwind CSS 3      │            │                         │     │
│   │                      │            │  Services:              │     │
│   │  step1ne.zeabur.app  │            │  - resumePDFService     │     │
│   └────────────────────┘            │  - githubAnalysisService│     │
│                                      │  - talentSourceService  │     │
│                                      │  - personaService       │     │
│                                      │  - jobsService          │     │
│                                      │                         │     │
│                                      │  backendstep1ne.        │     │
│                                      │  zeabur.app/api         │     │
│                                      └───────────┬────────────┘     │
│                                                   │                  │
│                                      ┌────────────▼────────────┐    │
│                                      │     PostgreSQL           │    │
│                                      │   Zeabur 託管            │    │
│                                      │   tpe1.clusters.        │    │
│                                      │   zeabur.com:27883      │    │
│                                      └─────────────────────────┘    │
│                                                                      │
│   外部整合：                                                         │
│   Google Sheets / Drive ─ GitHub API ─ Perplexity AI ─ Gemini AI    │
│   LinkedIn 爬蟲 ─ 104/1111 人力銀行 ─ OpenClaw (選用)               │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 二、技術棧

| 層級 | 技術 | 版本 |
|------|------|------|
| **前端框架** | React + TypeScript | 19.0.0 |
| **建置工具** | Vite | 6.0.0 |
| **CSS** | Tailwind CSS | 3.4.17 |
| **圖示** | Lucide React | 0.474.0 |
| **PDF 匯出** | html2canvas + jsPDF | 1.4.1 / 2.5.1 |
| **OCR** | tesseract.js | 7.0.0 |
| **試算表** | xlsx (SheetJS) | 0.18.5 |
| **後端** | Express | 5.2.1 |
| **資料庫** | PostgreSQL (pg) | 8.18.0 |
| **AI** | Google Generative AI (Gemini) | @google/genai 1.36.0 |
| **PDF 解析** | pdf-parse | 2.4.5 |
| **檔案上傳** | Multer | 2.1.0 |
| **Python 腳本** | 人才搜尋 / AI 分析 | 3.x |

---

## 三、目錄結構

```
step1ne-headhunter-system-main/
│
├── App.tsx                         # 主應用：Tab 路由、權限控制
├── index.tsx                       # React 入口
├── types.ts                        # TypeScript 型別定義（498 行，20+ 介面）
├── constants.ts                    # 全域常數（狀態顏色、看板欄位、快取設定）
├── crawlerTypes.ts                 # 爬蟲專用型別
├── firebase.ts                     # 認證（localStorage 模擬）
├── index.css                       # 全域樣式 + Tailwind
│
├── components/                     # ── React UI 元件 ──
│   ├── CandidateModal.tsx          #   人選卡片（161KB，最大元件）
│   ├── LeadModal.tsx               #   案件詳情（71KB）
│   ├── ResumeGenerator.tsx         #   匿名履歷產生器（含雷達圖 SVG）
│   ├── RadarChart.tsx              #   五維雷達圖視覺化
│   ├── KanbanBoard.tsx             #   看板佈局
│   ├── Badge.tsx                   #   狀態標籤
│   ├── Sidebar.tsx                 #   主導覽列
│   ├── ProfileSettingsModal.tsx    #   使用者設定
│   ├── CaseFinancialDetailModal.tsx#   案件財務明細
│   ├── ColumnTooltip.tsx           #   欄位說明 Tooltip
│   ├── DecisionModal.tsx           #   案件接單/退件
│   ├── UserDetailModal.tsx         #   顧問資料
│   └── crawler/                    #   爬蟲管理子元件
│       ├── CrawlerManagementTab.tsx
│       ├── CrawlerScoringTab.tsx
│       ├── EfficiencyStatsTab.tsx
│       └── KpiDashboardTab.tsx
│
├── pages/                          # ── 頁面元件（26 頁）──
│   ├── CandidatesPage.tsx          #   候選人總表（搜尋、篩選、排序）
│   ├── AIMatchingPage.tsx          #   AI 配對推薦
│   ├── AIProgressPage.tsx          #   AI 工作進度監控
│   ├── JobsPage.tsx                #   職缺管理
│   ├── PipelinePage.tsx            #   人選漏斗管線
│   ├── LeadsPage.tsx               #   案件管理
│   ├── BDClientsPage.tsx           #   BD 客戶開發
│   ├── OperationsDashboardPage.tsx #   運營儀表板
│   ├── AnalyticsPage.tsx           #   數據分析
│   ├── CandidateKanbanPage.tsx     #   候選人看板
│   ├── BotSchedulerPage.tsx        #   AI Bot 排程
│   ├── CrawlerDashboardPage.tsx    #   爬蟲整合儀表板
│   ├── ImportPage.tsx              #   資料匯入
│   ├── ResumeImportPage.tsx        #   履歷匯入
│   ├── MembersPage.tsx             #   團隊成員（Admin）
│   ├── AuditLogsPage.tsx           #   操作日誌
│   ├── SystemLogPage.tsx           #   系統日誌
│   ├── LoginPage.tsx               #   登入
│   ├── HelpPage.tsx                #   使用說明（70KB）
│   └── ...
│
├── services/                       # ── 前端商業邏輯 ──
│   ├── aiService.ts                #   AI 評估與評分
│   ├── candidateService.ts         #   人選 CRUD
│   ├── leadService.ts              #   案件管理（28KB）
│   ├── userService.ts              #   使用者管理
│   ├── auditService.ts             #   稽核日誌
│   ├── crawlerService.ts           #   爬蟲整合
│   ├── sheetsService.ts            #   Google Sheets 同步
│   ├── onlineService.ts            #   上線狀態
│   └── apiConfig.ts                #   API 設定
│
├── config/                         # ── 設定 ──
│   ├── api.ts                      #   API helper
│   └── columnDescriptions.tsx      #   欄位後設資料
│
├── utils/                          # ── 工具函式 ──
│   ├── dateFormat.ts               #   日期格式化
│   └── pdfGenerator.ts             #   PDF 產生
│
├── server/                         # ══ Node.js 後端 ══
│   ├── server.js                   #   伺服器入口
│   ├── routes-api.js               #   主 API 路由（4323 行，55+ 端點）
│   ├── routes-crawler.js           #   爬蟲路由
│   ├── routes-openclaw.js          #   OpenClaw AI 路由
│   │
│   ├── resumePDFService.js         #   PDF 履歷解析（LinkedIn + 104）
│   ├── githubAnalysisService.js    #   GitHub 分析
│   ├── talentSourceService.js      #   人才搜尋引擎
│   ├── jobsService.js              #   職缺邏輯
│   ├── personaService.js           #   Persona 生成
│   ├── perplexityService.js        #   Perplexity AI
│   ├── anonymousResumeService.js   #   匿名履歷
│   ├── crawlerImportService.js     #   爬蟲匯入
│   ├── gradingService.js           #   人選評分
│   ├── sheetsService*.js           #   Google Sheets 同步（4 版本）
│   │
│   ├── db/                         #   資料庫 Schema
│   │   ├── init-postgres.sql
│   │   └── init-full-schema.sql
│   │
│   ├── guides/                     #   AI Bot 教學文件（API 提供）
│   │   ├── AIBOT-API-GUIDE.md
│   │   ├── SCORING-GUIDE.md
│   │   ├── JOB-IMPORT-GUIDE.md
│   │   └── RESUME-ANALYSIS-GUIDE.md
│   │
│   ├── talent-sourcing/            #   Python AI & 爬蟲腳本
│   │   ├── candidate-scoring-system-v2.py
│   │   ├── one-bot-pipeline.py
│   │   ├── search-plan-executor.py
│   │   ├── profile-reader.py
│   │   ├── job-profile-analyzer.py
│   │   └── requirements.txt
│   │
│   └── package.json                #   後端相依套件
│
├── scripts/                        # ── 資料庫遷移（23 個 SQL）──
│   ├── init-database.sh
│   ├── init-database.sql
│   ├── add-phase1-candidate-fields.sql
│   ├── add-phase3-motivation-fields.sql
│   └── ...
│
├── docs/                           # ── 文件 ──
│   ├── ai-prompts/                 #   AI 系統提示
│   ├── api/                        #   API 文件
│   ├── rules/                      #   商業規則
│   ├── setup/                      #   部署指南
│   └── technical/                  #   技術架構
│
├── public/                         # ── 靜態資源 ──
│   └── step1ne-logo.jpeg
│
└── 設定檔
    ├── vite.config.ts
    ├── tsconfig.json
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── package.json
    └── .env.example
```

---

## 四、資料庫 Schema（PostgreSQL）

### 核心資料表

```
┌─────────────────────────┐     ┌─────────────────────────┐
│  candidates_pipeline     │     │  jobs_pipeline           │
├─────────────────────────┤     ├─────────────────────────┤
│ id (VARCHAR PK)          │     │ id (SERIAL PK)           │
│ name                     │     │ title                    │
│ status                   │     │ client_company           │
│ current_position         │     │ salary_range             │
│ phone, email             │     │ main_skills              │
│ location                 │     │ experience_required      │
│ years_experience         │     │ education_required       │
│ age                      │     │ work_location            │
│ skills                   │     │ job_status               │
│ education_details (JSONB)│     │ industry_background      │
│ work_history (TEXT/JSON)  │     │ interview_process        │
│ linkedin_url, github_url │     │ consultant_notes         │
│ ai_match_result (JSONB)  │◄───►│                          │
│ consultant_evaluation    │     │ search_primary (TEXT)     │
│   (JSONB)                │     │ welfare_tags             │
│ industry, languages      │     │ job_url                  │
│ certifications           │     └─────────────────────────┘
│ expected_salary          │
│ notice_period            │     ┌─────────────────────────┐
│ job_search_status        │     │  bd_clients              │
│ reason_for_change        │     ├─────────────────────────┤
│ motivation               │     │ id (SERIAL PK)           │
│ deal_breakers            │     │ company_name             │
│ competing_offers         │     │ industry                 │
│ relationship_level       │     │ bd_status                │
│ management_experience    │     │ contact_name/email/phone │
│ team_size                │     │ contract_terms (JSONB)   │
│ target_job_id (FK)       │     └─────────────────────────┘
│ progress_tracking (JSONB)│
│ consultant               │     ┌─────────────────────────┐
│ created_at, last_updated │     │  leads                   │
└─────────────────────────┘     ├─────────────────────────┤
                                  │ id (TEXT PK)             │
┌─────────────────────────┐     │ case_code, platform      │
│  users                   │     │ need, budget_text        │
├─────────────────────────┤     │ status, decision         │
│ id (TEXT PK)             │     │ assigned_to              │
│ email, display_name      │     │ progress_updates (JSONB) │
│ role (ADMIN/REVIEWER)    │     │ cost_records (JSONB)     │
│ is_active, is_online     │     │ profit_records (JSONB)   │
└─────────────────────────┘     └─────────────────────────┘

┌─────────────────────────┐     ┌─────────────────────────┐
│  audit_logs              │     │  system_logs             │
├─────────────────────────┤     ├─────────────────────────┤
│ id (TEXT PK)             │     │ id (SERIAL PK)           │
│ lead_id (FK)             │     │ action                   │
│ actor_uid, actor_name    │     │ actor, actor_type        │
│ action                   │     │ candidate_id/name        │
│ before, after (JSONB)    │     │ detail (JSONB)           │
│ created_at               │     │ created_at               │
└─────────────────────────┘     └─────────────────────────┘

┌─────────────────────────┐     ┌─────────────────────────┐
│  user_contacts           │     │  candidate_job_rankings  │
├─────────────────────────┤     │  _cache                  │
│ display_name (PK)        │     ├─────────────────────────┤
│ contact_phone/email      │     │ candidate_id (PK)        │
│ line_id, telegram_handle │     │ rankings (JSONB)         │
│ github_token             │     │ computed_at              │
│ linkedin_token           │     └─────────────────────────┘
│ brave_api_key            │
└─────────────────────────┘
```

---

## 五、API 路由一覽（55+ 端點）

### 候選人 (10)
| Method | Path | 說明 |
|--------|------|------|
| GET | `/api/candidates` | 列表（支援分頁、篩選、排序） |
| GET | `/api/candidates/:id` | 單筆詳情 |
| POST | `/api/candidates` | 新增 |
| PATCH | `/api/candidates/:id` | 部分更新 |
| DELETE | `/api/candidates/:id` | 刪除 |
| DELETE | `/api/candidates/batch` | 批次刪除 |
| PATCH | `/api/candidates/batch-status` | 批次更新狀態 |
| POST | `/api/candidates/bulk` | 批次建立 |
| POST | `/api/candidates/:id/enrich` | AI 擴充資料 |
| POST | `/api/candidates/backfill-computed` | 回填年齡/年資 |

### 職缺 (6)
| Method | Path | 說明 |
|--------|------|------|
| GET | `/api/jobs` | 列表 |
| GET | `/api/jobs/:id` | 詳情 |
| POST | `/api/jobs` | 新增 |
| PUT | `/api/jobs/:id` | 更新 |
| PATCH | `/api/jobs/:id/status` | 更新狀態 |
| DELETE | `/api/jobs/:id` | 刪除 |

### 履歷解析 (2)
| Method | Path | 說明 |
|--------|------|------|
| POST | `/api/resume/parse` | 單檔解析（LinkedIn / 104 自動偵測） |
| POST | `/api/resume/batch-parse` | 批次解析 |

### GitHub 整合 (3)
| Method | Path | 說明 |
|--------|------|------|
| GET | `/api/github/analyze/:username` | GitHub 分析 |
| POST | `/api/github/ai-analyze` | AI 深度分析 |
| GET | `/api/candidates/:id/github-stats` | 快取統計 |

### 配對排名 (1)
| Method | Path | 說明 |
|--------|------|------|
| GET | `/api/candidates/:id/job-rankings` | 職缺配對排名 |

### BD 客戶 (8)
| Method | Path | 說明 |
|--------|------|------|
| GET | `/api/clients` | 列表 |
| GET | `/api/clients/:id` | 詳情 |
| POST | `/api/clients` | 新增 |
| PATCH | `/api/clients/:id` | 更新 |
| PATCH | `/api/clients/:id/status` | 更新狀態 |
| DELETE | `/api/clients/:id` | 刪除 |
| GET | `/api/clients/:id/contacts` | 聯繫紀錄 |
| POST | `/api/clients/:id/contacts` | 新增聯繫 |

### Bot 自動化 (5)
| Method | Path | 說明 |
|--------|------|------|
| GET | `/api/bot-config` | 取得設定 |
| GET | `/api/bot-configs` | 列表 |
| POST | `/api/bot-config` | 建立設定 |
| POST | `/api/bot/run-now` | 立即執行 |
| GET | `/api/bot-logs` | 執行日誌 |

### 使用者/系統 (8)
| Method | Path | 說明 |
|--------|------|------|
| GET | `/api/users` | 使用者列表 |
| POST | `/api/users/register` | 註冊 |
| GET | `/api/users/:name/contact` | 聯絡資訊 |
| PUT | `/api/users/:name/contact` | 更新聯絡 |
| GET | `/api/system-logs` | 系統日誌 |
| GET | `/api/health` | 健康檢查 |
| POST | `/api/sync/sheets-to-sql` | Sheets→SQL 同步 |
| POST | `/api/migrate/extract-links` | 提取連結 |

---

## 六、核心功能模組

### 6.1 人選管理
- **人選卡片** (`CandidateModal.tsx` 161KB)：完整的候選人資料編輯，含基本資料、工作經歷、學歷、技能、AI 評估、顧問評分
- **Phase 1 欄位**：年齡、產業、語言、證照、目前/期望薪資、到職時間、管理經驗
- **Phase 3 欄位**：求職狀態、轉職原因、主要動機、不適配條件、競爭 Offer、顧問關係程度

### 6.2 履歷解析（`resumePDFService.js`）
- **自動格式偵測**：`detect104Format()` 判斷 LinkedIn vs 104
- **LinkedIn 解析**：姓名、職稱、地點、技能、工作經歷、學歷、LinkedIn URL
- **104 解析**：額外支援電話、Email、年齡、語言、證照、產業、期望薪資、到職時間
- **前端拖曳匯入**：支援拖曳 PDF 到人選卡片直接解析

### 6.3 五維雷達圖（`RadarChart.tsx`）
```
       技術深度
         ▲
        / \
  穩定度/   \產業適配
      /     \
     /       \
  個性───────溝通
```
- 自動計算分數 + 顧問手動調整
- 匿名履歷內嵌 SVG 雷達圖

### 6.4 匿名履歷（`ResumeGenerator.tsx`）
- 隱藏個人識別資訊
- 包含雷達圖 + 評分 + 顧問評語
- 顯示 Phase 3 交易條件欄位
- HTML 模板 → 新視窗開啟/列印

### 6.5 AI 配對推薦
- **加權評分**：技能 30% + 經驗 25% + 穩定度 20% + 產業 20% + 綜合 5%
- **自動配對**：與所有職缺計算匹配度
- **等級分類**：P0（強推）/ P1（推薦）/ P2（備選）/ REJECT

### 6.6 爬蟲系統
- 104 / 1111 / LinkedIn 人力銀行爬蟲
- GitHub Profile 分析（語言、貢獻、活躍度）
- 自動人才評分與篩選
- KPI 儀表板追蹤效率

---

## 七、TypeScript 型別定義

### 主要介面

```typescript
// 候選人（40+ 欄位）
interface Candidate {
  id, name, email, phone, location, position
  years, age, skills, education, educationJson
  workHistory, source, status, consultant
  linkedinUrl, githubUrl
  // AI 評估
  aiMatchResult, aiScore, aiGrade
  // 顧問評分（五維）
  consultantEvaluation: ConsultantEvaluation
  // Phase 1 擴充
  industry, languages, certifications
  currentSalary, expectedSalary, noticePeriod
  managementExperience, teamSize
  // Phase 3 動機
  jobSearchStatus, reasonForChange, motivation
  dealBreakers, competingOffers, relationshipLevel
}

// 顧問評估
interface ConsultantEvaluation {
  technicalDepth, stability, industryMatch
  communication, personality    // 各 0-100
  comment?: string
}

// 職缺
interface Job {
  id, title, clientCompany, salaryRange
  mainSkills, experienceRequired, jobStatus
  industryBackground, interviewProcess
}

// 案件（Lead）
interface Lead {
  id, caseCode, platform, need, budgetText
  status, decision, assignedTo
  progressUpdates, costRecords, profitRecords
}
```

### 列舉值

| 列舉 | 值 |
|------|-----|
| CandidateStatus | 未開始、AI推薦、聯繫階段、面試階段、Offer、on board、婉拒、備選人才、爬蟲初篩 |
| CandidateSource | LinkedIn、GitHub、Gmail進件、推薦、主動開發、人力銀行、爬蟲匯入、其他 |
| JobStatus | 招募中、暫緩、已關閉、已成交 |
| MatchGrade | P0、P1、P2、REJECT |
| Role | ADMIN、REVIEWER |

---

## 八、環境設定

### 前端 (.env)
```env
VITE_API_URL=https://backendstep1ne.zeabur.app/api
VITE_SHEET_ID=1PunpaDAFBPBL...        # Google Sheets ID
VITE_GOOGLE_ACCOUNT=aijessie88@step1ne.com
VITE_DRIVE_FOLDER_ID=12lfoz7qwjhWMwbCJL_...
PERPLEXITY_API_KEY=pplx-...
```

### 後端 (server/.env)
```env
DATABASE_URL=postgresql://root:***@tpe1.clusters.zeabur.com:27883/zeabur
PORT=3001
NODE_ENV=production
```

---

## 九、部署流程

```
Git Push (main) → Zeabur 自動部署
                    │
                    ├── Frontend：npm run build (Vite) → 靜態檔案
                    │
                    └── Backend：npm install + node server.js
                         └── 自動連接 PostgreSQL (Zeabur 託管)
```

- **前端** 連接 `https://backendstep1ne.zeabur.app/api`
- **後端** 監聽 Port 3001
- **資料庫** Zeabur 託管 PostgreSQL，快取 30 分鐘

---

## 十、檔案統計

| 分類 | 數量 | 備註 |
|------|------|------|
| React 元件 | 15+ | CandidateModal 最大（161KB） |
| 頁面 | 26 | 各業務模組 |
| API 端點 | 55+ | RESTful |
| 資料庫資料表 | 12+ | 核心 + 追蹤 |
| 前端 Services | 8 | TypeScript |
| 後端 Services | 10+ | JavaScript |
| SQL 遷移腳本 | 23 | Schema 演進 |
| Python 腳本 | 7 | AI & 爬蟲 |
| 文件 | 30+ | 指南、規則、範例 |
