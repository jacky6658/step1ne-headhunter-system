# Step1ne 獵頭 AI 協作系統 — 系統架構 & 敏捷看板

> 最後更新：2026-03-11

---

## 系統健康總覽

```
╔══════════════════════════════════════════════════════════════════════════╗
║                      STEP1NE SYSTEM HEALTH DASHBOARD                     ║
╠══════════════════════════════════════════════════════════════════════════╣
║                                                                          ║
║  前端 (React 19)  ████████████████████████████████████  95%  🟢 良好     ║
║  後端 (Express 5) ██████████████████████████████████░░  90%  🟢 良好     ║
║  資料庫 (PG)      ████████████████████████████████████  98%  🟢 良好     ║
║  AI 整合          ██████████████████████████░░░░░░░░░░  70%  🟡 進行中   ║
║  爬蟲系統         ████████████████████░░░░░░░░░░░░░░░░  55%  🟡 進行中   ║
║  安全性           ██████████████░░░░░░░░░░░░░░░░░░░░░░  40%  🔴 需改善   ║
║  測試覆蓋         ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  10%  🔴 缺少     ║
║  CI/CD            ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░  20%  🔴 基本     ║
║                                                                          ║
╚══════════════════════════════════════════════════════════════════════════╝
```

---

## 一、系統架構全景圖

```
                              ┌─────────────┐
                              │   使用者      │
                              │  (顧問/管理)  │
                              └──────┬──────┘
                                     │ HTTPS
                              ┌──────▼──────┐
                              │   Zeabur CDN │
                              └──────┬──────┘
                                     │
          ┌──────────────────────────┼──────────────────────────┐
          │                          │                          │
   ┌──────▼──────┐           ┌──────▼──────┐           ┌──────▼──────┐
   │  前端 SPA    │           │  後端 API    │           │  PostgreSQL  │
   │  React 19    │◄─────────►│  Express 5   │◄─────────►│  Zeabur DB   │
   │  Vite 6      │   /api    │  Node.js     │    pg     │  12+ 資料表   │
   │  TypeScript   │           │  4300+ 行    │           │  1347 人選   │
   │  Tailwind 3   │           │  55+ 端點    │           │  53+ 職缺    │
   └──────────────┘           └──────┬──────┘           └──────────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
             ┌──────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐
             │  Google AI   │ │  GitHub API  │ │  爬蟲引擎    │
             │  Gemini      │ │  Profile分析  │ │  104/1111   │
             │  Perplexity  │ │  Repo 統計   │ │  LinkedIn   │
             └─────────────┘ └─────────────┘ └─────────────┘
```

---

## 二、功能模組看板（敏捷 Sprint 視角）

### 🟢 已完成 (Done)

```
┌────────────────────────────────────────────────────────────────────┐
│ 模組                     │ 功能                    │ 涵蓋檔案      │
├────────────────────────────────────────────────────────────────────┤
│ ✅ 人選管理（核心）       │ CRUD + 40+ 欄位編輯     │ CandidateModal │
│ ✅ 人選卡片 Phase 1       │ 年齡/產業/語言/證照/薪資 │ types.ts       │
│ ✅ 人選卡片 Phase 3       │ 動機/轉職原因/競爭Offer  │ routes-api.js  │
│ ✅ 五維雷達圖             │ 自動計算 + 手動調整      │ RadarChart.tsx │
│ ✅ 匿名履歷               │ 雷達圖+評語+Phase3欄位  │ ResumeGenerator│
│ ✅ 履歷解析 (LinkedIn)    │ PDF→結構化資料           │ resumePDFSvc   │
│ ✅ 履歷解析 (104)         │ 自動偵測+完整解析        │ resumePDFSvc   │
│ ✅ 拖曳匯入履歷           │ Drag & Drop PDF         │ CandidateModal │
│ ✅ 職缺管理               │ CRUD + 狀態追蹤         │ JobsPage       │
│ ✅ AI 配對推薦            │ 加權評分 + P0/P1/P2     │ AIMatchingPage │
│ ✅ 看板視圖               │ Kanban 拖拉狀態         │ KanbanBoard    │
│ ✅ BD 客戶管理            │ 公司+聯繫人+合約        │ BDClientsPage  │
│ ✅ 案件管理 (Leads)       │ 進度追蹤+成本+利潤      │ LeadsPage      │
│ ✅ GitHub 分析            │ Profile+Repo+語言統計   │ githubAnalysis │
│ ✅ Google Sheets 同步     │ 雙向同步               │ sheetsService  │
│ ✅ 操作日誌               │ 完整稽核軌跡            │ AuditLogsPage  │
│ ✅ 年齡/年資自動計算       │ 從學歷推估+批次回填     │ routes-api.js  │
│ ✅ 使用者權限              │ ADMIN / REVIEWER        │ App.tsx        │
│ ✅ 運營儀表板              │ KPI 統計               │ OperationsDash │
│ ✅ 使用說明                │ 完整操作指南            │ HelpPage       │
│ ✅ 專案架構文件            │ 本文件                  │ ARCHITECTURE   │
└────────────────────────────────────────────────────────────────────┘
```

### 🟡 進行中 / 部分完成 (In Progress)

```
┌────────────────────────────────────────────────────────────────────┐
│ 模組                     │ 現況             │ 缺什麼              │
├────────────────────────────────────────────────────────────────────┤
│ 🟡 履歷解析穩定性         │ v2 API 已修      │ 工作經歷解析待驗證   │
│ 🟡 爬蟲系統               │ UI+路由已建      │ Python 腳本未整合    │
│ 🟡 AI Bot 排程            │ UI+設定已建      │ 實際排程引擎未串接   │
│ 🟡 Perplexity AI 擴充     │ Service 已寫     │ API Key 管理不完整  │
│ 🟡 104/1111 職缺爬取       │ URL 欄位已加     │ 自動同步未實作      │
└────────────────────────────────────────────────────────────────────┘
```

### 🔴 待開發 / 缺少 (To Do)

```
┌────────────────────────────────────────────────────────────────────┐
│ 模組                     │ 優先級   │ 說明                        │
├────────────────────────────────────────────────────────────────────┤
│ 🔴 自動化測試             │ 高 ‼️    │ 完全沒有單元/整合測試       │
│ 🔴 安全性：密碼外洩       │ 高 ‼️    │ DB 密碼硬寫在 27 個檔案    │
│ 🔴 安全性：環境變數       │ 高 ‼️    │ vite.config 暴露全部 env   │
│ 🔴 本地開發 .env          │ 高       │ 缺 .env 檔案無法本地啟動   │
│ 🔴 錯誤監控 (Sentry等)    │ 中       │ 生產環境無錯誤追蹤         │
│ 🔴 Docker 容器化          │ 中       │ 無 Dockerfile              │
│ 🔴 CI/CD Pipeline         │ 中       │ 無 GitHub Actions          │
│ 🔴 效能優化               │ 中       │ 主 bundle 1.1MB（應拆分）  │
│ 🔴 通知系統               │ 中       │ 無 Email/Line 推播         │
│ 🔴 完整認證系統            │ 中       │ 目前用 localStorage 模擬   │
│ 🔴 API Rate Limiting      │ 低       │ 無請求限流                 │
│ 🔴 API 文件 (Swagger)     │ 低       │ 無自動化 API 文件          │
│ 🔴 多語系 (i18n)          │ 低       │ 目前僅中文                 │
│ 🔴 行動裝置適配           │ 低       │ 無 RWD 優化                │
└────────────────────────────────────────────────────────────────────┘
```

---

## 三、安全性問題報告 🚨

```
╔══════════════════════════════════════════════════════════════════════╗
║  🚨 嚴重：資料庫密碼寫死在原始碼（27 個檔案）                       ║
║                                                                      ║
║  受影響檔案：                                                        ║
║  server.js, routes-api.js, routes-openclaw.js, routes-crawler.js     ║
║  talentSourceService.js, sqlService.js, init-db.js                   ║
║  import-*.js (8個), check-*.js (5個), verify-db.js 等               ║
║                                                                      ║
║  風險：任何能存取 Git Repo 的人都能看到正式環境的 DB 帳密             ║
║  建議：改用 process.env.DATABASE_URL，移除所有 hardcoded 值           ║
╠══════════════════════════════════════════════════════════════════════╣
║  ⚠️ 中等：vite.config.ts 暴露全部環境變數到瀏覽器                    ║
║                                                                      ║
║  問題行：'process.env': JSON.stringify(process.env)                  ║
║  風險：如果 .env 含敏感資訊，會被打包進前端 JS                       ║
║  建議：只暴露 VITE_ 開頭的變數                                      ║
╠══════════════════════════════════════════════════════════════════════╣
║  ⚠️ 中等：認證系統使用 localStorage 模擬                             ║
║                                                                      ║
║  現況：firebase.ts 用 localStorage 存登入狀態                        ║
║  風險：任何人可直接存取系統，無實際身份驗證                           ║
║  建議：導入 JWT 或 Firebase Auth 真實認證                            ║
╚══════════════════════════════════════════════════════════════════════╝
```

---

## 四、環境配置狀態

```
                    本地開發                    Zeabur 生產
                 ─────────────              ─────────────
前端啟動          npm run dev                 自動部署 ✅
                  ├─ Port 3000               ├─ step1ne.zeabur.app
                  ├─ 需要 .env ❌ 缺少       ├─ 環境變數已設定 ✅
                  └─ Proxy → :3001           └─ 直連後端 API

後端啟動          npm run backend             自動部署 ✅
                  ├─ Port 3001               ├─ backendstep1ne.zeabur.app
                  ├─ 需要 server/.env ❌     ├─ POSTGRES_URI 自動注入 ✅
                  └─ DB 連線 (hardcoded)     └─ DB 連線 ✅

資料庫            需連線遠端 DB               Zeabur 託管 PostgreSQL ✅
                  └─ 密碼在原始碼 ⚠️         └─ 1347 候選人 / 53 職缺
```

### 本地啟動 Checklist

```
[ ] 1. 複製 .env.example → .env（前端）
[ ] 2. 複製 server/.env.example → server/.env（後端）
[ ] 3. 在 server/.env 加入 DATABASE_URL=postgresql://...
[ ] 4. npm install（前端）
[ ] 5. cd server && npm install（後端）
[ ] 6. npm run dev（前端，Port 3000）
[ ] 7. npm run backend（後端，Port 3001）
```

---

## 五、技術棧詳情

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                              │
│                                                              │
│  Framework:  React 19.0.0 + TypeScript                      │
│  Build:      Vite 6.0.0                                     │
│  Styling:    Tailwind CSS 3.4.17                             │
│  Icons:      Lucide React 0.474.0                            │
│  PDF Export: html2canvas 1.4.1 + jsPDF 2.5.1                │
│  OCR:        tesseract.js 7.0.0                              │
│  Excel:      xlsx (SheetJS) 0.18.5                           │
│                                                              │
│  Pages: 26    Components: 15+    Services: 8                 │
│  Bundle: ~1.1MB (gzip ~325KB)   ← 需要 code-split           │
└─────────────────────────────────────────────────────────────┘
                              │
                           /api
                              │
┌─────────────────────────────────────────────────────────────┐
│                        BACKEND                               │
│                                                              │
│  Runtime:    Node.js (≥14, 建議 ≥18)                        │
│  Framework:  Express 5.2.1                                   │
│  Database:   PostgreSQL via pg 8.18.0                        │
│  AI:         @google/genai 1.36.0 (Gemini)                  │
│  PDF Parse:  pdf-parse 2.4.5 (v2 API)                       │
│  Upload:     Multer 2.1.0                                    │
│  HTTP:       Axios 1.7.0                                     │
│                                                              │
│  Routes: 55+   Services: 10+   Python Scripts: 7            │
│  DB Tables: 12+                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 六、資料流程圖

### 人選從匯入到配對的完整流程

```
  PDF 履歷             CSV/Excel              爬蟲
  (LinkedIn/104)       (Google Sheets)        (GitHub/104)
       │                    │                     │
       ▼                    ▼                     ▼
  ┌─────────┐        ┌─────────┐          ┌─────────┐
  │ 解析 PDF │        │ 匯入資料 │          │ 爬蟲匯入 │
  │ 自動偵測 │        │ 欄位對應 │          │ 自動評分 │
  └────┬────┘        └────┬────┘          └────┬────┘
       │                  │                    │
       └──────────────────┼────────────────────┘
                          │
                          ▼
                 ┌────────────────┐
                 │  候選人卡片      │
                 │  (40+ 欄位)     │
                 │                 │
                 │  基本資料        │
                 │  工作經歷        │
                 │  學歷背景        │
                 │  技能標籤        │
                 │  Phase 1 擴充   │
                 │  Phase 3 動機   │
                 └────────┬───────┘
                          │
              ┌───────────┼───────────┐
              │           │           │
              ▼           ▼           ▼
        ┌──────────┐ ┌────────┐ ┌──────────┐
        │ 顧問評估  │ │ AI 配對 │ │ 匿名履歷  │
        │ 五維雷達圖│ │ 職缺排名│ │ PDF 輸出  │
        │ 評語備註  │ │ P0~P2  │ │ 雷達圖    │
        └──────────┘ └────────┘ └──────────┘
              │           │
              ▼           ▼
        ┌──────────────────────┐
        │    Pipeline 管線      │
        │                      │
        │  未開始 → AI推薦      │
        │    → 聯繫 → 面試     │
        │    → Offer → 到職    │
        │    → 婉拒 / 備選     │
        └──────────────────────┘
```

---

## 七、資料庫 ER 圖

```
┌──────────────────────┐         ┌──────────────────────┐
│  candidates_pipeline  │         │  jobs_pipeline        │
├──────────────────────┤         ├──────────────────────┤
│ PK  id               │    ┌───►│ PK  id               │
│     name             │    │    │     title             │
│     status           │    │    │     client_company    │
│     current_position │    │    │     salary_range      │
│     phone, email     │    │    │     main_skills       │
│     location         │    │    │     job_status        │
│     years_experience │    │    │     industry          │
│     age              │    │    │     interview_process │
│     skills           │    │    └──────────────────────┘
│     education_details│    │
│     work_history     │    │    ┌──────────────────────┐
│     linkedin_url     │    │    │  bd_clients           │
│     github_url       │    │    ├──────────────────────┤
│     consultant_eval  │    │    │ PK  id               │
│     ai_match_result  │    │    │     company_name     │
│     industry         │    │    │     bd_status        │
│     languages        │    │    │     contact_name     │
│     certifications   │    │    │     contract_terms   │
│     expected_salary  │    │    └──────────────────────┘
│     job_search_status│    │
│     motivation       │    │    ┌──────────────────────┐
│ FK  target_job_id   ─┼────┘    │  leads               │
│     consultant       │         ├──────────────────────┤
│     progress_tracking│         │ PK  id               │
└──────────┬───────────┘         │     case_code        │
           │                     │     status, decision  │
           │                     │     assigned_to       │
           │                     │     progress_updates  │
           │                     │     cost_records      │
┌──────────▼───────────┐         └──────────────────────┘
│  candidate_job_       │
│  rankings_cache       │         ┌──────────────────────┐
├──────────────────────┤         │  users               │
│ PK  candidate_id     │         ├──────────────────────┤
│     rankings (JSONB) │         │ PK  id               │
│     computed_at      │         │     display_name     │
└──────────────────────┘         │     role (ADMIN/     │
                                 │          REVIEWER)   │
┌──────────────────────┐         └──────────┬───────────┘
│  audit_logs           │                    │
├──────────────────────┤         ┌──────────▼───────────┐
│ PK  id               │         │  user_contacts       │
│     actor_name       │         ├──────────────────────┤
│     action           │         │ PK  display_name     │
│     before/after     │         │     phone, email     │
│     created_at       │         │     line_id          │
└──────────────────────┘         │     api_keys         │
                                 └──────────────────────┘
┌──────────────────────┐
│  system_logs          │
├──────────────────────┤
│ PK  id               │
│     action, actor    │
│     actor_type       │
│     detail (JSONB)   │
└──────────────────────┘
```

---

## 八、API 端點總覽

| 分類 | 數量 | 端點範例 | 狀態 |
|------|------|---------|------|
| 候選人 CRUD | 10 | `GET/POST/PATCH/DELETE /candidates` | ✅ |
| 職缺管理 | 6 | `GET/POST/PUT/DELETE /jobs` | ✅ |
| 履歷解析 | 2 | `POST /resume/parse` | ✅ |
| GitHub 整合 | 3 | `GET /github/analyze/:user` | ✅ |
| 配對排名 | 1 | `GET /candidates/:id/job-rankings` | ✅ |
| BD 客戶 | 8 | `GET/POST/PATCH/DELETE /clients` | ✅ |
| Bot 自動化 | 5 | `POST /bot/run-now` | 🟡 |
| 使用者 | 4 | `GET /users`, `POST /users/register` | ✅ |
| 系統工具 | 4 | `GET /health`, `POST /sync/sheets-to-sql` | ✅ |
| AI Guide | 6 | `GET /guide`, `GET /scoring-guide` | ✅ |
| **合計** | **55+** | | |

---

## 九、前端頁面地圖

```
App.tsx (主路由)
│
├── 📊 運營儀表板          OperationsDashboardPage    ✅ 完成
├── 📋 候選人總表          CandidatesPage             ✅ 完成
│   └── 人選卡片 Modal     CandidateModal             ✅ 完成（161KB）
│       ├── 基本資料編輯                               ✅
│       ├── 匯入履歷 (拖曳)                            ✅
│       ├── 工作經歷管理                                ✅
│       ├── 顧問五維評分                                ✅
│       ├── 匿名履歷產生                                ✅
│       ├── AI 配對結果                                 ✅
│       ├── 進度追蹤                                    ✅
│       └── 備註紀錄                                    ✅
├── 📊 候選人看板          CandidateKanbanPage        ✅ 完成
├── 💼 職缺管理            JobsPage                   ✅ 完成
├── 🤖 AI 配對推薦         AIMatchingPage             ✅ 完成
├── 🎯 BD 客戶開發         BDClientsPage              ✅ 完成
├── 📈 顧問人選追蹤表      PipelinePage               ✅ 完成
├── 🕷️ 爬蟲整合儀表板      CrawlerDashboardPage       🟡 UI 完成
├── 🤖 AI 工作進度         AIProgressPage             🟡 UI 完成
├── 📋 操作日誌            AuditLogsPage              ✅ 完成
├── 📖 使用說明            HelpPage                   ✅ 完成
└── 🔐 登入頁              LoginPage                  ⚠️ localStorage
```

---

## 十、Sprint 待辦優先排序

### 🔥 P0 — 立即修復（安全 & 可用性）

| # | 任務 | 影響 | 工時估計 |
|---|------|------|---------|
| 1 | 移除 27 個檔案中的 hardcoded DB 密碼 | 安全漏洞 | 2h |
| 2 | 修正 vite.config 不暴露全部 env | 安全漏洞 | 0.5h |
| 3 | 建立完整 .env / server/.env 範本 | 本地無法啟動 | 0.5h |
| 4 | 驗證履歷匯入工作經歷解析 | 功能異常 | 1h |

### 🟠 P1 — 短期改善（1-2 週）

| # | 任務 | 影響 | 工時估計 |
|---|------|------|---------|
| 5 | 前端 bundle code-splitting | 效能（1.1MB→分包） | 2h |
| 6 | 真實認證系統 (JWT/Firebase Auth) | 安全性 | 8h |
| 7 | 基本單元測試 (核心 Services) | 品質保障 | 8h |
| 8 | GitHub Actions CI (build + lint) | 自動化 | 3h |
| 9 | 錯誤監控 (Sentry 整合) | 可觀測性 | 2h |

### 🟡 P2 — 中期規劃（1-2 月）

| # | 任務 | 影響 | 工時估計 |
|---|------|------|---------|
| 10 | Docker 容器化 | 部署一致性 | 4h |
| 11 | 通知系統 (Email/Line) | 業務效率 | 16h |
| 12 | 更多履歷格式支援 (CakeResume等) | 功能完整 | 8h |
| 13 | API Rate Limiting | 安全性 | 2h |
| 14 | 爬蟲引擎完整串接 | 功能完整 | 16h |

### ⚪ P3 — 長期願景

| # | 任務 | 說明 |
|---|------|------|
| 15 | Swagger/OpenAPI 文件 | API 自動化文件 |
| 16 | 多語系 (i18n) | 英文介面 |
| 17 | 行動裝置適配 (RWD) | 手機可用 |
| 18 | WebSocket 即時更新 | 多人協作即時同步 |
| 19 | AI 自動履歷評分 | 無需人工觸發 |

---

## 十一、檔案規模統計

```
程式碼規模：
──────────────
前端元件      15+ 個     最大：CandidateModal (161KB)
頁面          26 個      最大：HelpPage (70KB)
API 端點      55+ 個     主檔：routes-api.js (4323 行)
後端服務      10+ 個     最大：talentSourceService (29KB)
SQL 遷移      23 個
Python 腳本   7 個
文件          30+ 個

資料規模：
──────────────
候選人        1,347 筆
職缺          53 筆
顧問          3 人 (Jacky, Phoebe, Crawler-WebUI)
資料表        12+ 個
```

---

## 十二、CORS & 環境對照表

| 環境 | 前端 URL | 後端 URL | CORS | 狀態 |
|------|---------|---------|------|------|
| 本地開發 | `localhost:3000` | `localhost:3001` | Vite Proxy | ⚠️ 需 .env |
| Zeabur 生產 | `step1ne.zeabur.app` | `backendstep1ne.zeabur.app` | 白名單 ✅ | ✅ 運作中 |
| 其他域名 | `step1ne.com` | 同上 | 白名單 ✅ | ✅ 已設定 |
