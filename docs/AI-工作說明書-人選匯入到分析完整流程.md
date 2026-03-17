# Step1ne 獵頭系統 — AI 工作說明書
# 從「匯入人選」到「分析匹配」完整作業流程

> **目標讀者**：AI Agent（AIbot）
> **最後更新**：2026-03-06
> **系統**：Step1ne Headhunter System v1.0
> **後端 API**：`https://api-hr.step1ne.com/api`（正式環境）

---

## 目錄
1. [系統架構總覽](#1-系統架構總覽)
2. [人選資料結構（全部欄位）](#2-人選資料結構全部欄位)
3. [職缺資料結構](#3-職缺資料結構)
4. [作業流程一：匯入人選](#4-作業流程一匯入人選)
5. [作業流程二：資料充實（Enrichment）](#5-作業流程二資料充實enrichment)
6. [作業流程三：職缺匹配評分](#6-作業流程三職缺匹配評分)
7. [作業流程四：Pipeline 狀態管理](#7-作業流程四pipeline-狀態管理)
8. [API 端點速查表](#8-api-端點速查表)
9. [欄位名稱對照表（camelCase ↔ snake_case）](#9-欄位名稱對照表)
10. [評分算法詳解（v2 五維度）](#10-評分算法詳解v2-五維度)
11. [爬蟲搜尋策略](#11-爬蟲搜尋策略)

---

## 1. 系統架構總覽

```
┌──────────────────────────────────────────────────────────┐
│                     資料來源層                             │
│  LinkedIn │ GitHub │ Gmail │ 爬蟲(Perplexity/Jina) │ CSV  │
└─────┬────────┬───────┬──────────┬──────────────┬─────────┘
      │        │       │          │              │
      └────────┴───────┴──────────┴──────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│                    匯入層 (Import)                        │
│  POST /api/candidates        — 單筆新增/更新              │
│  POST /api/candidates/bulk   — 批次匯入（最多 100 筆）    │
│  crawlerImportService.js     — 爬蟲結果映射              │
└──────────────────────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│               資料庫層 (PostgreSQL)                        │
│  candidates_pipeline  — 人選主表（~30 欄位）              │
│  jobs_pipeline        — 職缺主表（~35 欄位）              │
│  candidate_job_rankings_cache — 匹配快取                 │
│  system_logs          — 操作紀錄                          │
└──────────────────────────────────────────────────────────┘
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
┌──────────────────────┐  ┌──────────────────────┐
│  資料充實 Enrichment  │  │  Google Sheets 同步   │
│  • GitHub 分析 v2     │  │  SQL ↔ Sheets 雙向    │
│  • 履歷解析           │  │  23 個欄位自動同步     │
│  • Perplexity/Jina   │  └──────────────────────┘
└──────────────────────┘
              │
              ▼
┌──────────────────────────────────────────────────────────┐
│              職缺匹配評分（v2 五維度）                     │
│  GET /api/candidates/:id/job-rankings                    │
│  totalScore = skill×0.35 + exp×0.25 + ind×0.20           │
│             + edu×0.10 + profile×0.10                     │
│  → 輸出 Top 5 + 快取                                     │
└──────────────────────────────────────────────────────────┘
              │
              ▼
┌──────────────────────────────────────────────────────────┐
│              Pipeline 管理                                │
│  未開始 → AI推薦 → 聯繫階段 → 面試階段                    │
│         → Offer → on board                               │
│         → 婉拒 / 備選人才                                 │
└──────────────────────────────────────────────────────────┘
```

---

## 2. 人選資料結構（全部欄位）

### 資料庫表：`candidates_pipeline`

#### 基本身份

| 欄位名稱 | 類型 | 必填 | 說明 | 範例 |
|---------|------|------|------|------|
| `id` | SERIAL | 自動 | 系統自動產生的唯一 ID | `1217` |
| `name` | VARCHAR(255) | ✅ | 人選姓名 | `Tsung-Ting Tsai` |
| `email` | VARCHAR(255) | | 電子郵件 | `jason@gmail.com` |
| `phone` | VARCHAR(50) | | 電話 | `0912-345-678` |

#### 外部連結

| 欄位名稱 | 類型 | 說明 | 範例 |
|---------|------|------|------|
| `linkedin_url` | VARCHAR(500) | LinkedIn 個人頁面 URL | `https://www.linkedin.com/in/tsung-ting-tsai/` |
| `github_url` | VARCHAR(500) | GitHub 個人頁面 URL | `https://github.com/example` |
| `contact_link` | VARCHAR(500) | 履歷/作品集連結 | Google Drive 連結 |

#### 職涯資訊

| 欄位名稱 | 類型 | 說明 | 範例 |
|---------|------|------|------|
| `location` | VARCHAR(255) | 所在地區 | `新竹市` |
| `current_position` | VARCHAR(255) | 目前職稱 | `Finance line manager (ASML)` |
| `years_experience` | VARCHAR(50) | 總年資 | `12` |
| `job_changes` | VARCHAR(50) | 換工作次數 | `3` |
| `avg_tenure_months` | VARCHAR(50) | 平均任職月數 | `36` |
| `recent_gap_months` | VARCHAR(50) | 最近待業月數 | `0` |

#### 技能與學歷

| 欄位名稱 | 類型 | 說明 | 範例 |
|---------|------|------|------|
| `skills` | TEXT | 技能列表（逗號分隔） | `IFRS, GAAP, SAP ERP, Transfer Pricing` |
| `education` | VARCHAR(255) | 最高學歷 | `碩士` / `大學` / `博士` |
| `education_details` | JSONB | 詳細學歷 JSON | 見下方 |
| `work_history` | JSONB | 工作經歷 JSON | 見下方 |
| `leaving_reason` | TEXT | 離職原因 | `尋求更好的發展機會` |

**`work_history` JSONB 格式：**
```json
[
  {
    "company": "ASML",
    "position": "Finance Line Manager",
    "startDate": "2020-01",
    "endDate": "present",
    "duration": "6 years",
    "description": "負責財務報表編制、合併報表..."
  },
  {
    "company": "Deloitte",
    "position": "Senior Auditor",
    "startDate": "2015-06",
    "endDate": "2019-12",
    "duration": "4 years 6 months",
    "description": "四大會計師事務所審計..."
  }
]
```

**`education_details` JSONB 格式：**
```json
[
  {
    "school": "國立台灣大學",
    "degree": "碩士",
    "major": "會計學",
    "start": "2012",
    "end": "2014"
  }
]
```

#### 評估與側寫

| 欄位名稱 | 類型 | 說明 | 範例 |
|---------|------|------|------|
| `stability_score` | VARCHAR(50) | 穩定度分數 (0-100) | `75` |
| `personality_type` | VARCHAR(255) | 人格特質 (DISC/Big Five) | `D型主導` |
| `source` | VARCHAR(255) | 資料來源 | `LinkedIn` / `GitHub` / `推薦` / `主動開發` |
| `talent_level` | VARCHAR(50) | 人才等級 | `S` / `A+` / `A` / `B` / `C` |

#### Pipeline 狀態

| 欄位名稱 | 類型 | 說明 | 可用值 |
|---------|------|------|--------|
| `status` | VARCHAR(50) | 人選目前狀態 | `未開始` `AI推薦` `聯繫階段` `面試階段` `Offer` `on board` `婉拒` `備選人才` |
| `recruiter` | VARCHAR(255) | 負責顧問 | `Jacky` |
| `notes` | TEXT | 備註（含 AI 分析報告） | 自由文字 |
| `target_job_id` | INTEGER | 目標職缺 ID (FK → jobs_pipeline.id) | `172` |

#### AI 分析結果

| 欄位名稱 | 類型 | 說明 |
|---------|------|------|
| `ai_match_result` | JSONB | AI 匹配評分結果 |

**`ai_match_result` JSONB 格式：**
```json
{
  "score": 86,
  "grade": "A+",
  "recommendation": "強力推薦",
  "job_title": "Senior Finance Manager",
  "company": "英鉑科",
  "matched_skills": ["IFRS", "合併報表", "財務分析", "Transfer Pricing"],
  "missing_skills": ["SAP S/4HANA"],
  "strengths": ["12年財務經驗", "CPA持照", "四大+外商背景"],
  "probing_questions": ["對於跨國合併報表的經驗深度？", "ERP轉換經驗？"],
  "salary_fit": "符合範圍",
  "conclusion": "該候選人高度匹配此職位...",
  "evaluated_by": "AIbot",
  "evaluated_at": "2026-03-06T10:30:00Z"
}
```

#### 進度追蹤

| 欄位名稱 | 類型 | 說明 |
|---------|------|------|
| `progress_tracking` | JSONB | 狀態變更歷史陣列 |

**`progress_tracking` JSONB 格式：**
```json
[
  { "date": "2026-03-01", "event": "AI推薦", "by": "AIbot", "note": "AI評分 86分" },
  { "date": "2026-03-03", "event": "聯繫階段", "by": "Jacky", "note": "已通電話，候選人有興趣" },
  { "date": "2026-03-05", "event": "面試階段", "by": "Jacky", "note": "安排3/10面試" }
]
```

#### 快取與中繼資料

| 欄位名稱 | 類型 | 說明 |
|---------|------|------|
| `github_analysis_cache` | JSONB | GitHub 分析快取 |
| `created_at` | TIMESTAMP | 建立時間 |
| `updated_at` | TIMESTAMP | 最後更新時間 |
| `sync_to_sheets_at` | TIMESTAMP | 最後 Google Sheets 同步時間 |

---

## 3. 職缺資料結構

### 資料庫表：`jobs_pipeline`

#### 基本資訊

| 欄位名稱 | 類型 | 說明 | 範例 |
|---------|------|------|------|
| `id` | SERIAL | 唯一 ID | `172` |
| `position_name` | VARCHAR(255) | 職位名稱 | `Senior Finance Manager` |
| `client_company` | VARCHAR(255) | 客戶公司 | `英鉑科/Intrum` |
| `department` | VARCHAR(100) | 部門 | `財務部` |
| `open_positions` | VARCHAR(50) | 招募人數 | `1` |
| `salary_range` | VARCHAR(100) | 薪資範圍 | `120-180萬` |
| `job_status` | VARCHAR(50) | 職缺狀態 | `招募中` `暫緩` `已關閉` `已成交` |

#### 要求條件

| 欄位名稱 | 類型 | 說明 | 範例 |
|---------|------|------|------|
| `key_skills` | TEXT | 必要技能 | `IFRS, 合併報表, 財務分析, Transfer Pricing` |
| `experience_required` | VARCHAR(255) | 年資要求 | `10年以上` |
| `education_required` | VARCHAR(100) | 學歷要求 | `大學以上` |
| `language_required` | VARCHAR(100) | 語言要求 | `英文精通` |
| `special_conditions` | TEXT | 特殊條件 | `需有四大或外商經驗` |
| `location` | VARCHAR(100) | 工作地點 | `台北市` |

#### 公司與職缺描述

| 欄位名稱 | 類型 | 說明 |
|---------|------|------|
| `industry_background` | VARCHAR(255) | 產業背景 |
| `team_size` | VARCHAR(100) | 團隊規模 |
| `key_challenges` | TEXT | 職位核心挑戰 |
| `attractive_points` | TEXT | 吸引點/賣點 |
| `job_description` | TEXT | 完整 JD |

#### 爬蟲搜尋設定（⚠️ 影響爬蟲找人精準度）

| 欄位名稱 | 類型 | 說明 | 範例 |
|---------|------|------|------|
| `company_profile` | TEXT | 公司畫像（AI 產出） | `瑞典跨國金融科技公司...` |
| `talent_profile` | TEXT | 理想人才畫像（AI 產出） | `10年以上財務經驗的CPA...` |
| `search_primary` | TEXT | 主要搜尋關鍵字（AND 邏輯） | `IFRS, 合併報表` |
| `search_secondary` | TEXT | 次要搜尋關鍵字（OR 邏輯） | `Transfer Pricing, Tax, Audit` |

---

## 4. 作業流程一：匯入人選

### 4.1 單筆建立

```
POST /api/candidates
Content-Type: application/json

{
  "name": "王小明",                          ← 必填
  "email": "ming@gmail.com",
  "phone": "0912-345-678",
  "linkedin_url": "https://linkedin.com/in/ming",
  "github_url": "https://github.com/ming",
  "location": "台北市",
  "current_position": "Senior Developer",
  "years_experience": "8",
  "skills": "Python, React, Docker, Kubernetes",
  "education": "碩士",
  "source": "LinkedIn",                      ← LinkedIn/GitHub/推薦/主動開發/人力銀行/其他
  "status": "AI推薦",                         ← 預設：未開始
  "recruiter": "Jacky",
  "notes": "透過 LinkedIn 主動開發...",
  "target_job_id": 172,                      ← 目標職缺 ID（可選）
  "talent_level": "A",                       ← S/A+/A/B/C（可選）
  "work_history": [...],                     ← JSONB（可選）
  "education_details": [...],                ← JSONB（可選）
  "stability_score": "75",
  "personality_type": "D型",
  "job_changes": "3",
  "avg_tenure_months": "36",
  "recent_gap_months": "0",
  "leaving_reason": "尋求更好發展",
  "ai_match_result": {...}                   ← JSONB（可選）
}
```

**回應：** 回傳 `{ id, name, ... }` 完整人選資料

### 4.2 批次匯入（最多 100 筆）

```
POST /api/candidates/bulk
Content-Type: application/json

{
  "candidates": [
    { "name": "候選人A", "email": "a@mail.com", "skills": "...", ... },
    { "name": "候選人B", "email": "b@mail.com", "skills": "...", ... }
  ],
  "actor": "AIbot"    ← 操作者識別（會寫入 system_logs）
}
```

**回應：** `{ imported: 2, skipped: 0, errors: [] }`

### 4.3 爬蟲匯入流程

```
POST /api/talent-sourcing/find-candidates

{
  "company": "英鉑科",
  "jobTitle": "Senior Finance Manager",
  "actor": "Jacky-aibot",
  "github_token": "ghp_xxx",         ← 可選，增加 GitHub API 配額
  "brave_api_key": "BSA-xxx",        ← 可選，啟用 Brave 搜尋備援
  "pages": 2                          ← LinkedIn 搜尋頁數（建議 2-3）
}
```

**內部流程：**
1. 查詢 `jobs_pipeline` 找到對應職缺
2. 分析公司畫像 + 人才畫像
3. 執行 Python 爬蟲（GitHub API + LinkedIn 三層搜尋）
4. 對每位候選人去重（比對 email / linkedin_url / github_url）
5. 對每位候選人評分（五維度）
6. 寫入 `candidates_pipeline` + 設定 `target_job_id`
7. 輸出優先推薦名單（Top 3）

### 4.4 匯入後自動行為

- ✅ 自動寫入 `system_logs`（action: `IMPORT_CREATE`）
- ✅ 自動判斷 `actor_type`：包含 `aibot`/`bot`/`ai`/`crawler` → `AIBOT`，否則 → `HUMAN`
- ✅ 自動同步到 Google Sheets（非阻塞，背景執行）
- ✅ 自動設定 `created_at` 和 `updated_at`

---

## 5. 作業流程二：資料充實（Enrichment）

### 5.1 GitHub 分析 v2

**觸發方式：** 人選有 `github_url` 時可呼叫

**四維度評分：**
| 維度 | 權重 | 說明 |
|------|------|------|
| 技能匹配 | 40% | 程式語言/框架與職缺要求比對 |
| 專案品質 | 30% | 程式碼複雜度、文件完整度 |
| 活躍度 | 20% | 最近 commit、頻率、持續性 |
| 影響力 | 10% | Stars、Forks、開源貢獻 |

**產出資料：** 存入 `github_analysis_cache` JSONB

### 5.2 深度分析（Perplexity/Jina）

**自動充實的欄位：**
- `work_history` — 工作經歷（公司、職稱、年份、描述）
- `education_details` — 學歷細節
- `years_experience` — 總年資
- `stability_score` — 穩定度分數
- `job_changes` — 換工作次數
- `avg_tenure_months` — 平均任職月數
- `leaving_reason` — 離職原因
- `personality_type` — 人格特質

### 5.3 履歷解析

**支援格式：** PDF 上傳
**自動擷取：**
- 聯絡資訊（email, phone）
- 工作經歷 → `work_history`
- 學歷 → `education`, `education_details`
- 技能 → `skills`
- 證照/關鍵字

---

## 6. 作業流程三：職缺匹配評分

### 6.1 觸發方式

```
GET /api/candidates/:id/job-rankings
GET /api/candidates/:id/job-rankings?force=1    ← 強制重算（忽略快取）
```

### 6.2 快取機制

1. **第一次呼叫：** 即時計算 → 儲存到 `candidate_job_rankings_cache` → 回傳 Top 5
2. **後續呼叫：** 直接從快取讀取（秒回應）
3. **快取失效時機：**
   - 候選人被更新（PATCH/PUT /api/candidates/:id）→ 清除該候選人快取
   - 職缺被新增/更新（POST/PUT /api/jobs）→ 清除**所有**快取
   - 手動加 `?force=1` → 強制重算

### 6.3 回應格式

```json
{
  "candidate_id": 1217,
  "total_jobs": 5,
  "cached": true,
  "computed_at": "2026-03-06T02:47:30.231Z",
  "rankings": [
    {
      "job_id": 172,
      "job_title": "Senior Finance Manager",
      "company": "英鉑科/Intrum",
      "department": "財務部",
      "salary_range": "120-180萬",
      "job_status": "招募中",
      "match_score": 86,
      "skill_score": 100,
      "experience_score": 100,
      "industry_score": 40,
      "education_score": 100,
      "profile_score": 75,
      "matched_skills": ["IFRS", "合併報表", "財務分析"],
      "missing_skills": [],
      "required_skills_count": 8,
      "recommendation": "強力推薦"
    }
  ]
}
```

### 6.4 推薦等級對照

| 總分範圍 | 推薦等級 | 說明 |
|---------|---------|------|
| 80-100 | 強力推薦 | 高度匹配，優先安排 |
| 65-79 | 推薦 | 條件不錯，值得跟進 |
| 50-64 | 觀望 | 部分匹配，需評估 |
| 0-49 | 不推薦 | 匹配度低 |

---

## 7. 作業流程四：Pipeline 狀態管理

### 7.1 狀態流轉

```
未開始 ──→ AI推薦 ──→ 聯繫階段 ──→ 面試階段 ──→ Offer ──→ on board
  │                      │            │           │
  └───→ 備選人才 ←────────┴────────────┴───────────┘
                         │
                         └───→ 婉拒
```

### 7.2 更新狀態 API

**單筆更新：**
```
PUT /api/candidates/:id/pipeline-status
{
  "status": "聯繫階段",
  "by": "Jacky"
}
```

**批次更新：**
```
PATCH /api/candidates/batch-status
{
  "ids": [1217, 1218, 1220],
  "status": "聯繫階段",
  "actor": "Jacky",
  "note": "批次推進"
}
```

### 7.3 狀態更新自動行為

- ✅ 自動追加到 `progress_tracking` 陣列
- ✅ 自動寫入 `system_logs`（action: `PIPELINE_CHANGE`）
- ✅ 自動更新 `updated_at`
- ✅ 如果 notes 含有 AI 評分 → 自動解析到 `ai_match_result`

---

## 8. API 端點速查表

### 人選 CRUD

| 方法 | 端點 | 說明 |
|------|------|------|
| `GET` | `/api/candidates` | 列出所有人選（支援 ?status=&recruiter= 篩選） |
| `GET` | `/api/candidates/:id` | 取得單一人選完整資料 |
| `POST` | `/api/candidates` | 新增人選（如 email 已存在則更新） |
| `POST` | `/api/candidates/bulk` | 批次匯入（最多 100 筆） |
| `PATCH` | `/api/candidates/:id` | 部分更新（任意欄位） |
| `PUT` | `/api/candidates/:id` | 完整更新 |
| `DELETE` | `/api/candidates/:id` | 刪除人選 |
| `DELETE` | `/api/candidates/batch` | 批次刪除 |

### 人選狀態

| 方法 | 端點 | 說明 |
|------|------|------|
| `PUT` | `/api/candidates/:id/pipeline-status` | 更新 Pipeline 狀態 |
| `PATCH` | `/api/candidates/batch-status` | 批次更新狀態 |

### 職缺匹配

| 方法 | 端點 | 說明 |
|------|------|------|
| `GET` | `/api/candidates/:id/job-rankings` | 取得 Top 5 職缺匹配（自動快取） |
| `GET` | `/api/candidates/:id/job-rankings?force=1` | 強制重算 |

### 職缺 CRUD

| 方法 | 端點 | 說明 |
|------|------|------|
| `GET` | `/api/jobs` | 列出所有職缺 |
| `GET` | `/api/jobs/:id` | 取得單一職缺 |
| `POST` | `/api/jobs` | 新增職缺 |
| `PUT` | `/api/jobs/:id` | 更新職缺 |
| `PATCH` | `/api/jobs/:id/status` | 更新職缺狀態 |
| `DELETE` | `/api/jobs/:id` | 刪除職缺 |

### 爬蟲 / 人才搜尋

| 方法 | 端點 | 說明 |
|------|------|------|
| `POST` | `/api/talent-sourcing/find-candidates` | 執行人才搜尋（GitHub + LinkedIn） |
| `GET` | `/api/crawler/stats` | 爬蟲統計面板 |
| `POST` | `/api/crawler/import` | 匯入爬蟲結果 |

### 系統

| 方法 | 端點 | 說明 |
|------|------|------|
| `GET` | `/api/system-logs` | 查看操作紀錄 |
| `POST` | `/api/sync/sheets-to-sql` | Google Sheets → SQL 同步 |
| `GET` | `/api/health` | 健康檢查 |

---

## 9. 欄位名稱對照表

API 支援兩種命名格式（camelCase 和 snake_case），方便 AI Bot 使用：

| 前端 / API (camelCase) | 資料庫 (snake_case) | 說明 |
|------------------------|-------------------|------|
| `linkedinUrl` | `linkedin_url` | LinkedIn 連結 |
| `githubUrl` | `github_url` | GitHub 連結 |
| `currentPosition` | `current_position` | 目前職稱 |
| `yearsExperience` | `years_experience` | 總年資 |
| `jobChanges` | `job_changes` | 換工作次數 |
| `avgTenure` | `avg_tenure_months` | 平均任職月數 |
| `lastGap` | `recent_gap_months` | 最近待業月數 |
| `progressTracking` | `progress_tracking` | 進度追蹤 |
| `aiMatchResult` | `ai_match_result` | AI 匹配結果 |
| `targetJobId` | `target_job_id` | 目標職缺 ID |
| `stabilityScore` | `stability_score` | 穩定度分數 |
| `educationDetails` | `education_details` | 學歷細節 |
| `personalityType` | `personality_type` | 人格特質 |
| `workHistory` | `work_history` | 工作經歷 |
| `leavingReason` | `leaving_reason` | 離職原因 |
| `talentLevel` | `talent_level` | 人才等級 |
| `resumeLink` | `contact_link` | 履歷連結 |
| `contactLink` | `contact_link` | 履歷連結（同上） |

---

## 10. 評分算法詳解（v2 五維度）

### 總分公式

```
totalScore = skillScore     × 0.35    // 技能匹配
           + experienceScore × 0.25    // 年資匹配
           + industryScore   × 0.20    // 產業+職能匹配
           + educationScore  × 0.10    // 學歷匹配
           + profileScore    × 0.10    // 資料完整度
```

### 10.1 技能匹配 skillScore（35%）

**比對邏輯：**
1. 直接包含比對：`candidateSkill.includes(requiredSkill)` 或反向
2. **中英文同義詞比對**：使用 `SKILL_SYNONYMS` 對照表（~80 組）

**同義詞範例：**
```
IFRS ↔ 國際財務報導準則 ↔ 國際會計準則
合併報表 ↔ Consolidation ↔ 合併報告
審計 ↔ Audit ↔ 稽核
Python ↔ python3
React ↔ React.js ↔ ReactJS
機器學習 ↔ Machine Learning ↔ ML ↔ Deep Learning
```

**計算方式：** `matchedCount / requiredCount × 100`

### 10.2 年資匹配 experienceScore（25%）

| 候選人年資 / 要求年資 | 分數 |
|---------------------|------|
| ≥ 150% | 90（經驗豐富） |
| ≥ 100% | 100（剛好達標，滿分） |
| ≥ 70% | 70（差一點，尚可） |
| ≥ 50% | 50（差較多） |
| < 50% | 30（嚴重不足） |
| 職缺無年資要求 | 60（基本分） |

### 10.3 產業+職能匹配 industryScore（20%）

**資料來源：** `candidate.work_history` + `job.industry_background` + `job.position_name`

**計算方式：**
- 基本分：40
- 產業關鍵字命中：每個 +15（最多 +30）
- 職稱關鍵字命中：每個 +10（最多 +30）
- 上限：100

### 10.4 學歷匹配 educationScore（10%）

**學歷等級：** 博士(5) > 碩士/MBA(4) > 大學/學士(3) > 專科(2) > 高中(1)

| 情況 | 分數 |
|------|------|
| 達標或超過 | 100 |
| 差一級 | 70 |
| 差兩級以上 | 40 |
| 學歷不明 | 50 |
| 職缺無學歷要求 | 70 |

### 10.5 資料完整度 profileScore（10%）

| 有此欄位 | 加分 |
|---------|------|
| 基本分 | 30 |
| `skills`（有技能資料） | +15 |
| `work_history`（有工作經歷） | +20 |
| `education`（有學歷） | +10 |
| `years_experience`（有年資） | +10 |
| `linkedin_url`（有 LinkedIn） | +10 |
| `github_url`（有 GitHub） | +5 |

---

## 11. 爬蟲搜尋策略

### 11.1 LinkedIn 三層搜尋策略

爬蟲用 `key_skills` 建立搜尋查詢，按照三層降級策略執行：

```
第一層：Playwright（真實 Chrome 瀏覽器）
  ↓ 失敗或結果 < 3 筆
第二層：Google urllib（Python HTTP 請求）
  ↓ 被 CAPTCHA 阻擋或結果 < 3 筆
第三層：Bing urllib（備援搜尋引擎）
  ↓ 可選
第四層：Brave Search API（需 API Key）
```

### 11.2 搜尋查詢建立邏輯

從 `key_skills` 拆分：
- **前 2 個技能**：AND 邏輯（候選人**必須同時具備**）
- **後 5 個技能**：OR 邏輯（候選人**至少具備一個**）

**範例：**
```
職缺 key_skills: "IFRS, 合併報表, Transfer Pricing, Tax, Audit, SAP, Excel"

產生查詢：
site:linkedin.com/in/ "IFRS" "合併報表" ("Transfer Pricing" OR "Tax" OR "Audit" OR "SAP" OR "Excel") "台灣"
```

### 11.3 GitHub 搜尋

- 從 key_skills 分離出程式語言（Python, Java, Go 等）→ 使用 `language:` 過濾
- 其餘技能做全文搜尋
- 加上 `location:Taiwan` 地理限制

### 11.4 ⚠️ 為什麼爬蟲找到的人選可能不匹配

| 原因 | 說明 | 建議改善 |
|------|------|---------|
| 搜尋關鍵字太泛 | `key_skills` 只有通用詞如 "管理" | 填入具體技術關鍵字 |
| OR 邏輯太寬鬆 | 候選人只要有 1 個次要技能就被找到 | 減少次要技能數量，確保前 2 個是核心技能 |
| 中英文沒對齊 | 職缺寫 "國際財務報導準則"，但 LinkedIn 用 "IFRS" | 同時寫中英文版本到 key_skills |
| `search_primary` 未設定 | 沒有覆寫搜尋關鍵字，自動使用 key_skills 前兩個 | 手動設定更精準的搜尋詞 |
| 產業不匹配 | 找到有相同技能但不同產業的人 | 加入產業關鍵字到 special_conditions |
| 子字串誤匹 | "Go" 配到 "Going"，"Java" 配到 "JavaScript" | 技能列表用完整名稱 |

### 11.5 優化爬蟲精準度的操作步驟

**步驟 1：** 更新職缺的 `search_primary` 和 `search_secondary`
```
PUT /api/jobs/:id
{
  "search_primary": "IFRS, CPA",
  "search_secondary": "合併報表, Transfer Pricing, 外商財務"
}
```

**步驟 2：** 確保 `key_skills` 包含中英文版本
```
"key_skills": "IFRS/國際財務報導準則, Consolidation/合併報表, Transfer Pricing/移轉訂價"
```

**步驟 3：** 設定最低匹配閾值（在匯入時過濾）
```
POST /api/crawler/import
{
  "candidates": [...],
  "filters": { "min_grade": "A" }    ← 只匯入 A 級以上
}
```

---

## 附錄：AI Bot 操作範例

### 範例一：完整匯入一位人選

```javascript
// 1. 建立人選
const res = await fetch('/api/candidates', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Tsung-Ting Tsai',
    email: 'jasonki0975@gmail.com',
    linkedin_url: 'https://www.linkedin.com/in/tsung-ting-tsai-cpa-a32413b0/',
    location: '新竹市',
    current_position: 'Finance line manager (ASML)',
    years_experience: '12',
    skills: 'IFRS, GAAP, SAP ERP, Transfer Pricing, Tax Compliance, AICPA, Taiwan CPA, Audit, Consolidation, 合併報表編製, 財務分析, 預算規劃, 內部控制, 稅務合規, 移轉訂價, Excel, ERP自動化, M&A, IPO',
    education: '碩士',
    source: 'LinkedIn',
    status: 'AI推薦',
    recruiter: 'Jacky',
    target_job_id: 172,
    talent_level: 'A+',
    work_history: [
      {
        company: 'ASML',
        position: 'Finance Line Manager',
        startDate: '2020-01',
        endDate: 'present',
        duration: '6 years',
        description: '負責亞太區財務報告、合併報表、預算管理'
      },
      {
        company: 'Deloitte',
        position: 'Senior Auditor',
        startDate: '2015-06',
        endDate: '2019-12',
        duration: '4.5 years',
        description: '四大會計師事務所審計工作'
      }
    ],
    education_details: [
      {
        school: '國立台灣大學',
        degree: '碩士',
        major: '會計學',
        start: '2012',
        end: '2014'
      }
    ]
  })
});
const candidate = await res.json();

// 2. 取得職缺匹配推薦
const rankings = await fetch(`/api/candidates/${candidate.id}/job-rankings`).then(r => r.json());
console.log(`Top 1: ${rankings.rankings[0].job_title} (${rankings.rankings[0].match_score}分)`);

// 3. 更新狀態為「聯繫階段」
await fetch(`/api/candidates/${candidate.id}/pipeline-status`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ status: '聯繫階段', by: 'Jacky' })
});
```

### 範例二：查詢並篩選人選

```javascript
// 查詢所有 AI 推薦的人選
const candidates = await fetch('/api/candidates?status=AI推薦').then(r => r.json());

// 查詢特定顧問負責的人選
const myCandidates = await fetch('/api/candidates?recruiter=Jacky').then(r => r.json());

// 查詢今日新增
const todayCandidates = await fetch('/api/candidates?created_today=true').then(r => r.json());
```

---

> **重要提醒給 AI：**
> 1. 匯入人選時，`name` 是唯一必填欄位，其他都是可選的
> 2. 如果提供 `email`，系統會自動檢查是否已存在（去重）
> 3. `skills` 用逗號分隔，建議中英文並列（如 `IFRS/國際財務報導準則`）
> 4. `work_history` 和 `education_details` 用 JSONB 陣列格式
> 5. 欄位名稱支援 camelCase 和 snake_case 兩種格式
> 6. 更新人選會自動清除職缺匹配快取（下次查詢會重新計算）
> 7. 所有操作都會記錄到 `system_logs`
