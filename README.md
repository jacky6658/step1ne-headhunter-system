# Step1ne 獵頭顧問 AI 協作系統

> AI 驅動的候選人管理、職缺配對、客戶開發、顧問學習一站式平台

**後端 API**：`https://backendstep1ne.zeabur.app`
**前端部署**：Zeabur 自動部署

---

## 系統功能總覽

### 📊 總覽 Dashboard
| 功能 | 說明 |
|------|------|
| 總攬看板 | 核心營運數據一覽：候選人數、職缺數、客戶數、Pipeline 轉換率 |
| 運營儀表板 | 詳細運營指標、趨勢圖表、顧問績效追蹤 |

### 👤 人才管理
| 功能 | 說明 |
|------|------|
| 候選人總表 | 全量候選人搜尋、篩選、排序、批次操作 |
| 人才看板 | Kanban 拖拉式看板，按 Grade / Tier / Heat / Pipeline 四種模式切換 |
| 人才地圖 | 視覺化人才分佈：技能雷達圖、公司來源排行、薪資分佈 |
| 顧問追蹤表 | 個人 Pipeline 追蹤，候選人階段進度管理 |

### 💼 職缺 & BD 客戶
| 功能 | 說明 |
|------|------|
| 職缺管理 | 職缺 CRUD、104/1111 一鍵匯入、AI 自動生成公司畫像與人才畫像 |
| BD 客戶開發 | 客戶管理、產業自動偵測標注、聯絡人追蹤、合約管理 |

### 🤖 AI & 自動化
| 功能 | 說明 |
|------|------|
| 爬蟲儀表板 | GitHub / LinkedIn 爬蟲狀態監控、任務管理 |
| AI 工作進度 | AI 評分、履歷解析等非同步任務進度追蹤 |
| AI Bot 教學 | 通用 AI Bot 對話介面，內建系統知識、可呼叫 API 操作資料 |

### 🛠️ 工具
| 功能 | 說明 |
|------|------|
| 履歷批量匯入 | PDF / Word 批次上傳，AI 自動解析至候選人資料庫 |
| 提示詞資料庫 | Prompt 模板管理、職缺/客戶變數智能填入、一鍵複製 |
| 對外頁面設定 | 顧問個人網站設定（5 種模板）、即時預覽（桌機/平板/手機）、URL 分享 |
| 操作日誌 | 系統操作審計紀錄 |

### 🎓 學習 & 指南
| 功能 | 說明 |
|------|------|
| 顧問 SOP 手冊 | Playbook / Pipeline 階段 / 日常工作流程 / 系統功能速查 / 學習路徑，含 7 步驟導覽 Tour |
| 學習中心 | 6 大模組：Prompt 工具箱、Job Analyzer、產業地圖（10 產業）、角色百科（16 角色）、電話腳本、面試秘笈 |
| 使用說明 | 系統操作說明、快速上手教學 |

### 🔧 管理 (Admin)
| 功能 | 說明 |
|------|------|
| 成員管理 | 團隊成員帳號與權限管理 |
| 資料維護 | DB Migration、資料修復工具 |

---

## AI 候選人評分

五維度自動評分系統（基於 Claude API）：

| 維度 | 權重 | 說明 |
|------|------|------|
| 人才畫像符合度 | 30% | 與目標職缺的技能、經歷匹配 |
| JD 匹配度 | 25% | 職缺描述需求吻合程度 |
| 公司適配度 | 20% | 公司文化、產業經驗匹配 |
| 可觸達性 | 15% | 聯繫管道、回應可能性 |
| 活躍信號 | 10% | GitHub 活躍度、職涯動態 |

評級：**S** → **A+** → **A** → **B** → **C**

---

## 文件總覽

### AI 提示詞（直接餵給 AI 使用）

| 文件 | API URL | 說明 |
|------|---------|------|
| [AIbot 操作手冊](./server/guides/AIBOT-API-GUIDE.md) | `/api/guide` | AIbot 完整學習手冊，讀完後可操作所有功能 |
| [評分 Bot 指南](./server/guides/SCORING-GUIDE.md) | `/api/scoring-guide` | OpenClaw 定時評分任務，自動對新增候選人評分 |
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

## 技術架構

| 層級 | 技術 |
|------|------|
| 前端 | React 19 + TypeScript + Vite + Tailwind CSS |
| 後端 | Node.js + Express + PostgreSQL |
| 部署 | Zeabur（前後端分離、自動部署） |
| AI | Claude API（評分 / 生成畫像 / 履歷分析 / 學習中心 Prompt） |
| 爬蟲 | GitHub API + LinkedIn Scraper |

---

## 專案結構

```
├── components/              # React UI 元件
│   ├── Sidebar.tsx          # 側邊欄導航
│   ├── CandidateModal.tsx   # 候選人詳情 Modal（AI 摘要、電話腳本）
│   ├── OnboardingTour.tsx   # 新手導覽元件
│   └── ConsultantSitePreview.tsx  # 對外頁面 5 模板即時預覽
├── pages/                   # 頁面
│   ├── OverviewDashboardPage.tsx   # 總攬看板
│   ├── OperationsDashboardPage.tsx # 運營儀表板
│   ├── CandidatesPage.tsx          # 候選人總表
│   ├── TalentBoardPage.tsx         # 人才看板
│   ├── TalentMapPage.tsx           # 人才地圖
│   ├── PipelinePage.tsx            # 顧問追蹤表
│   ├── JobsPage.tsx                # 職缺管理
│   ├── BDClientsPage.tsx           # BD 客戶開發
│   ├── CrawlerDashboardPage.tsx    # 爬蟲儀表板
│   ├── AIGuidePageNew.tsx          # AI Bot 教學
│   ├── PromptLibraryPage.tsx       # 提示詞資料庫
│   ├── SiteConfigPage.tsx          # 對外頁面設定
│   ├── SOPGuidePage.tsx            # 顧問 SOP 手冊
│   ├── LearningCenterPage.tsx      # 學習中心
│   └── HelpPage.tsx                # 使用說明
├── config/                  # API 設定（apiGet / apiPut / apiPost）
├── server/                  # Node.js 後端
│   ├── routes-api.js        # 所有 API 端點 + 啟動自動 Migration
│   ├── guides/              # AI 提示詞文件（API 服務用）
│   ├── talent-sourcing/     # 爬蟲與評分腳本
│   └── scripts/             # DB Migration 腳本
├── docs/
│   ├── ai-prompts/          # AI 提示詞（參考用）
│   ├── rules/               # 評分規則與標準
│   ├── api/                 # API 文件
│   ├── setup/               # 部署設定
│   ├── technical/           # 技術架構文件
│   ├── examples/            # 範例程式
│   └── archive/             # 歷史文件
├── ai-docs/                 # AI 專用文檔（CHANGELOG）
├── scripts/                 # 初始化腳本
└── dist/                    # 前端建置產物
```

---

## API 端點總覽

| 分類 | 端點 | 說明 |
|------|------|------|
| 候選人 | `GET/POST/PATCH/DELETE /api/candidates` | 候選人 CRUD |
| 職缺 | `GET/POST/PUT/DELETE /api/jobs` | 職缺 CRUD |
| 客戶 | `GET/POST/PATCH/DELETE /api/clients` | 客戶 CRUD（含產業自動偵測） |
| 互動紀錄 | `/api/candidates/:id/interactions` | 聯絡紀錄管理 |
| 通知 | `/api/notifications` | 系統通知 |
| 提示詞 | `/api/prompts` | Prompt 模板 CRUD |
| OpenClaw | `/api/openclaw/pending` | AI 評分佇列 |
| 爬蟲 | `/api/crawler/*` | 爬蟲任務管理 |
| 獵才 | `/api/talent-sourcing/*` | 主動獵才流程 |
| 履歷 | `/api/resume/parse` | 履歷解析 |
| GitHub | `/api/github/analyze/:username` | GitHub 帳號分析 |
| 分類法 | `/api/taxonomy/skills\|roles\|industries` | 技能/角色/產業分類 |
| 使用者 | `/api/users/:name/site-config` | 對外頁面設定 |
| 指南 | `/api/guide` `/api/scoring-guide` `/api/resume-guide` | AI 提示詞 API |

---

## 資料庫

- **PostgreSQL**（Zeabur 託管）
- 啟動時自動執行 60+ 條 Migration（安全冪等）
- 所有資料一律存 DB SQL，不使用 Google Sheets
- 一鍵完整 Migration 腳本：`server/scripts/migration-all-in-one.sql`

---

## 📋 待做事項 (Roadmap)

> 完整 Issue 追蹤：[GitHub Issues](https://github.com/jacky6658/step1ne-headhunter-system/issues)

### 🚀 系統本地化遷移 [#1](https://github.com/jacky6658/step1ne-headhunter-system/issues/1)
- [ ] 本地 PostgreSQL 建置 + 資料匯入（`pg_dump` → `psql`）
- [ ] 後端本地化（`.env` 設定、CORS 調整、API 驗證）
- [ ] 前端本地化（`VITE_API_URL` 切換、`npm run build`）
- [ ] Docker 容器化（`Dockerfile` + `docker-compose.yml`）

### 🌐 顧問對外公開頁面 [#2](https://github.com/jacky6658/step1ne-headhunter-system/issues/2)
- [x] 設定 UI（5 模板 / 配色 / 內容 / SEO）
- [x] 即時預覽系統（桌機 / 平板 / 手機切換）
- [ ] 獨立 consultant-site 應用（SSR/SSG）
- [ ] 職缺展示 + 投遞表單
- [ ] 公開 API（`/api/public/consultants/:slug`）
- [ ] 瀏覽統計 + 投遞通知

### 🔗 網域遷移 [#3](https://github.com/jacky6658/step1ne-headhunter-system/issues/3)
- [ ] DNS 設定（`app.step1ne.com` / `api.step1ne.com` / `site.step1ne.com`）
- [ ] Zeabur 自訂域名綁定 + SSL
- [ ] 程式碼 URL 全面更新（constants / CORS / guides）
- [ ] 舊域名 301 重導向

### 🧠 AI 進階功能
- [ ] Job Matching 匹配機制 — 輸入 JD 自動計算匹配度（技能 35% / 薪資 15% / 年資 15% / 產業 10%）
- [ ] JD 自動解析（必備技能 / 年資要求 / 產業需求）

---

*Last updated: 2026-03-16*
