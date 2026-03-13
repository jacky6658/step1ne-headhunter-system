# Step1ne Headhunter System - API 完整文檔

**版本**: 3.1.0（2026-03-13 新增 API 認證 + 安全強化）
**Base URL**: `http://localhost:3001/api`（開發環境）
**Production URL**: `https://backendstep1ne.zeabur.app/api`

---

## 目錄

1. [認證](#認證)
2. [候選人管理 API](#候選人管理-api)（16 端點）
3. [職缺管理 API](#職缺管理-api)（6 端點）
4. [BD 客戶管理 API](#bd-客戶管理-api)（9 端點）
5. [GitHub 分析 API](#github-分析-api)（2 端點）
6. [履歷解析 API](#履歷解析-api)（2 端點）
7. [人才搜尋系統 API](#人才搜尋系統-api)（5 端點）
8. [OpenClaw AI 評分 API](#openclaw-ai-評分-api)（2 端點）
9. [爬蟲整合 API](#爬蟲整合-api)（20 端點）
10. [使用者與顧問 API](#使用者與顧問-api)（4 端點）
11. [系統管理 API](#系統管理-api)（5 端點）
12. [Guide 文件 API](#guide-文件-api)（6 端點）
13. [錯誤處理](#錯誤處理)

---

## 認證

**所有 API 端點都需要 Bearer Token 認證**（2026-03-13 起）

### 一般 API 認證

每個請求都必須在 Header 帶上 `Authorization`：

```bash
curl -H "Authorization: Bearer <API_SECRET_KEY>" \
  https://backendstep1ne.zeabur.app/api/candidates
```

| Header | 值 | 說明 |
|--------|-----|------|
| `Authorization` | `Bearer <API_SECRET_KEY>` | 後端環境變數 `API_SECRET_KEY` 的值 |
| `Content-Type` | `application/json` | POST/PUT/PATCH 請求必須 |

### 白名單端點（不需認證）

| 端點 | 說明 |
|------|------|
| `GET /api/health` | 健康檢查 |
| `POST /api/webhooks/github` | GitHub Webhook（有自己的 HMAC 簽名驗證） |

### OpenClaw API 認證

OpenClaw 端點使用獨立的認證方式：

```bash
curl -H "X-OpenClaw-Key: <OPENCLAW_API_KEY>" \
  https://backendstep1ne.zeabur.app/api/openclaw/pending
```

### 認證失敗回應

```json
{ "success": false, "error": "未授權：缺少或無效的 API Key" }
```

### Rate Limiting

所有 `/api` 端點限制 **200 次/分鐘**（per IP）。超過時回傳 HTTP 429。

---

## 候選人管理 API

### 1. 列出所有候選人

```http
GET /api/candidates?limit=2000
```

> ⚠️ **重要：請務必帶 `?limit=2000`**，否則預設只回傳前 1000 筆，會漏掉較新的候選人。

**查詢參數**（可選）：

| 參數 | 類型 | 說明 | 範例 |
|------|------|------|------|
| `limit` | 整數 | 最多回傳筆數（預設 1000，**建議帶 2000**） | `?limit=2000` |
| `status` | 字串 | 篩選狀態 | `?status=AI推薦` |
| `source` | 字串 | 篩選來源 | `?source=LinkedIn` |
| `created_today` | `true` | 只回傳今日（台北時間）建立的候選人 | `?created_today=true` |

**合法 status 值**：`未開始`、`AI推薦`、`聯繫階段`、`面試階段`、`Offer`、`on board`、`婉拒`、`備選人才`、`爬蟲初篩`

**合法 source 值**：`LinkedIn`、`GitHub`、`Gmail 進件`、`推薦`、`主動開發`、`人力銀行`、`爬蟲匯入`、`其他`

**回應範例**：
```json
{
  "success": true,
  "count": 1361,
  "data": [
    {
      "id": "4",
      "name": "陳宥樺",
      "position": "SRE（系統維運工程師）",
      "email": "example@email.com",
      "phone": "0912-345-678",
      "linkedinUrl": "https://linkedin.com/in/...",
      "githubUrl": "https://github.com/...",
      "location": "台北",
      "years": 5,
      "skills": "Java, Spring Boot, Docker",
      "education": "國立台灣大學 資工系",
      "status": "AI推薦",
      "source": "LinkedIn",
      "recruiter": "Phoebe",
      "consultant": "Phoebe",
      "talent_level": "A",
      "stabilityScore": 72,
      "age": 28,
      "industry": "科技業",
      "languages": "中文, 英文",
      "currentSalary": "80K",
      "expectedSalary": "100K",
      "noticePeriod": "1個月",
      "motivation": "尋求技術成長",
      "aiMatchResult": { ... },
      "targetJobId": 5,
      "targetJobLabel": "SRE 工程師",
      "createdAt": "2026-02-20T08:00:00.000Z",
      "updatedAt": "2026-03-10T15:30:00.000Z"
    }
  ]
}
```

**候選人完整欄位清單**（62 個）：

| 分類 | 欄位 |
|------|------|
| 基本資料 | `id`, `name`, `email`, `phone`, `contact_link`, `location`, `age`, `ageEstimated` |
| 職業資料 | `position`(`current_position`), `years`(`years_experience`), `industry`, `skills`, `education`, `education_details`, `educationJson` |
| 工作經歷 | `workHistory`(`work_history`), `jobChanges`(`job_changes`), `avgTenure`(`avg_tenure_months`), `lastGap`(`recent_gap_months`), `leaving_reason`, `stabilityScore`(`stability_score`) |
| 社群連結 | `linkedinUrl`(`linkedin_url`), `githubUrl`(`github_url`), `resumeLink` |
| 獵頭管理 | `status`, `source`, `recruiter`, `consultant`, `talent_level`, `notes`, `progressTracking` |
| 薪資待遇 | `currentSalary`, `expectedSalary`, `noticePeriod` |
| Phase 3 動機 | `motivation`, `reasonForChange`, `jobSearchStatus`, `dealBreakers`, `competingOffers`, `relationshipLevel` |
| 管理經驗 | `managementExperience`, `teamSize` |
| 個性 | `personality_type`, `discProfile` |
| AI 相關 | `aiMatchResult`(`ai_match_result`), `consultantEvaluation`, `interviewRound`, `targetJobId`, `targetJobLabel` |
| 時間戳 | `createdAt`, `updatedAt`, `createdBy` |

> 注意：API 同時回傳 camelCase 和 snake_case 版本，前端用 camelCase。

---

### 2. 取得單一候選人

```http
GET /api/candidates/:id
```

回傳該候選人的完整資料（同上方欄位）。

**回應**：`{ "success": true, "data": { ... } }`
**404**：`{ "success": false, "error": "找不到候選人" }`

---

### 3. 新增候選人

```http
POST /api/candidates
```

**必填欄位**：`name`

**選填欄位**：所有上方列出的候選人欄位

**自動計算**：
- `stability_score`：從 `job_changes`、`avg_tenure_months`、`recent_gap_months` 計算
- `talent_level`：綜合評級 S/A+/A/B/C
- `age`：若未提供，從學歷推估

**回應**：
```json
{
  "success": true,
  "data": { "id": "1362", "name": "新候選人", ... },
  "message": "候選人已新增"
}
```

---

### 4. 更新候選人（PUT）

```http
PUT /api/candidates/:id
```

**Request Body**：`status`、`notes`、`consultant`、`name`、`progressTracking`、`aiMatchResult`

**回應**：`{ "success": true, "data": { ... }, "message": "候選人已更新" }`

---

### 5. 部分更新候選人（PATCH）

```http
PATCH /api/candidates/:id
```

**Request Body**：任何候選人欄位（支援 camelCase 和 snake_case）

**回應**：`{ "success": true, "data": { ... }, "message": "候選人資料已更新" }`

---

### 6. 刪除候選人

```http
DELETE /api/candidates/:id
```

**Request Body**（選填）：`{ "actor": "Jacky" }`

**回應**：`{ "success": true, "message": "候選人已刪除" }`

---

### 7. 更新 Pipeline 狀態（AIbot 專用）

```http
PUT /api/candidates/:id/pipeline-status
```

**Request Body**：
```json
{
  "status": "AI推薦",
  "by": "Phoebe-aibot"
}
```

會自動寫入 `progressTracking` 和系統日誌。

---

### 8. 批次更新狀態

```http
PATCH /api/candidates/batch-status
```

**Request Body**：
```json
{
  "ids": [1, 2, 3],
  "status": "聯繫階段",
  "actor": "Phoebe",
  "note": "批次推進"
}
```

限制：最多 200 筆。

---

### 9. 批次刪除

```http
DELETE /api/candidates/batch
```

**Request Body**：`{ "ids": [1, 2, 3], "actor": "Admin" }`

限制：最多 200 筆。`actor` 必填。

---

### 10. 批次匯入（Upsert）

```http
POST /api/candidates/bulk
```

**Request Body**：
```json
{
  "candidates": [ { "name": "...", ... }, ... ],
  "actor": "Crawler-WebUI"
}
```

---

### 11. AI 深度分析候選人（Perplexity）

```http
POST /api/candidates/:id/enrich
```

**Request Body**：`{ "actor": "Phoebe" }`

---

### 12. 批次 AI 深度分析

```http
POST /api/candidates/enrich-batch
```

**Request Body**：`{ "ids": [1, 2, 3], "actor": "Phoebe" }`

---

### 13. 職缺配對排名

```http
GET /api/candidates/:id/job-rankings
```

**查詢參數**：`force=1`（選填，強制重算不用快取）

回傳五維度評分 + 排序後的職缺配對列表。

---

### 14. GitHub 快速統計

```http
GET /api/candidates/:id/github-stats
```

**查詢參數**：`jobId`（選填，提供職缺上下文）

---

### 15. 回填年資/年齡

```http
POST /api/candidates/backfill-computed
```

批次回填所有缺少年資/年齡的候選人。

---

## 職缺管理 API

### 1. 列出所有職缺

```http
GET /api/jobs
```

**回應範例**：
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "position_name": "SRE 工程師",
      "client_company": "一通數位",
      "salary_range": "80-120K",
      "key_skills": "Kubernetes, Docker, AWS",
      "job_description": "...",
      "talent_profile": "...",
      "company_profile": "...",
      "search_primary": "SRE, DevOps, Kubernetes",
      "search_secondary": "Docker, AWS, GCP",
      "job_status": "招募中",
      "industry": "科技業",
      "interview_process": "技術面→主管面→HR面",
      "consultant": "Jacky",
      "consultant_notes": "...",
      "created_at": "2026-02-10",
      "updated_at": "2026-03-01"
    }
  ],
  "count": 53
}
```

---

### 2. 取得單一職缺

```http
GET /api/jobs/:id
```

---

### 3. 新增職缺

```http
POST /api/jobs
```

**必填**：`position_name`

**選填**：`client_company`, `salary_range`, `key_skills`, `job_description`, `talent_profile`, `company_profile`, `search_primary`, `search_secondary`, `job_status`, `industry`, `interview_process`, `consultant`, `consultant_notes`, `headcount`, `education_requirement`, `experience_requirement`, `language_requirement`, `location`, `remote_policy`, `url_104`, `url_1111`

---

### 4. 更新職缺

```http
PUT /api/jobs/:id
```

只更新有提供的欄位。

---

### 5. 更新職缺狀態

```http
PATCH /api/jobs/:id/status
```

**Request Body**：
```json
{
  "job_status": "招募中",
  "actor": "Jacky"
}
```

合法狀態：`招募中`、`暫停`、`已滿額`、`關閉`

---

### 6. 刪除職缺

```http
DELETE /api/jobs/:id
```

---

## BD 客戶管理 API

### 1. 列出所有客戶

```http
GET /api/clients
```

**查詢參數**：`bd_status`、`consultant`

---

### 2. 取得單一客戶

```http
GET /api/clients/:id
```

---

### 3. 新增客戶

```http
POST /api/clients
```

**欄位**：`company_name`, `industry`, `company_size`, `website`, `bd_status`, `bd_source`, `contact_name`, `contact_title`, `contact_email`, `contact_phone`, `contact_linkedin`, `consultant`, `contract_type`, `fee_percentage`, `contract_start`, `contract_end`, `notes`, `url_104`, `url_1111`

---

### 4. 更新客戶

```http
PATCH /api/clients/:id
```

---

### 5. 更新 BD 狀態

```http
PATCH /api/clients/:id/status
```

**Request Body**：`{ "bd_status": "合作中", "actor": "Jacky" }`

合法狀態：`開發中`、`接洽中`、`提案中`、`合約階段`、`合作中`、`暫停`、`流失`

---

### 6. 刪除客戶

```http
DELETE /api/clients/:id
```

---

### 7. 取得客戶的職缺

```http
GET /api/clients/:id/jobs
```

---

### 8. 取得客戶聯繫紀錄

```http
GET /api/clients/:id/contacts
```

---

### 9. 新增聯繫紀錄

```http
POST /api/clients/:id/contacts
```

**Request Body**：`contact_date`, `contact_type`, `summary`, `next_action`, `next_action_date`, `by_user`

---

## GitHub 分析 API

### 1. 完整 GitHub 分析

```http
GET /api/github/analyze/:username
```

**查詢參數**：`jobId`（選填，提供職缺上下文以分析技能匹配度）

回傳：GitHub Profile、Repo 統計、語言分佈、活躍度分析。

---

### 2. AI GitHub 分析

```http
POST /api/github/ai-analyze
```

**Request Body**：`{ "candidateId": 123, "jobId": 5 }`

---

## 履歷解析 API

### 1. 解析單份履歷

```http
POST /api/resume/parse
```

**Content-Type**：`multipart/form-data`

| 欄位 | 說明 |
|------|------|
| `file` | PDF 檔案 |
| `useAI` | `true`/`false`（是否使用 AI 增強解析） |

---

### 2. 批次解析履歷

```http
POST /api/resume/batch-parse
```

**Content-Type**：`multipart/form-data`

| 欄位 | 說明 |
|------|------|
| `files` | 多個 PDF 檔案 |
| `useAI` | `true`/`false` |

---

## 人才搜尋系統 API

### 1. 完整獵才流程（核心端點）

```http
POST /api/talent-sourcing/find-candidates
```

自動執行 6 步驟：分析畫像 → GitHub 搜尋 → LinkedIn 搜尋 → 去重 → 評分 → 寫入系統

**Request Body**：

| 欄位 | 必填 | 說明 |
|------|------|------|
| `company` | ✅ | 客戶公司名稱 |
| `jobTitle` | ✅ | 職位名稱 |
| `actor` | 建議 | 呼叫者名稱（如 `Phoebe-aibot`） |
| `github_token` | 選填 | GitHub PAT（提升到 5000 次/小時） |
| `pages` | 選填 | 搜尋頁數（預設 2，最多 3） |

---

### 2. 搜尋候選人

```http
POST /api/talent-sourcing/search
```

**Request Body**：`jobTitle`（必填）, `industry`（必填）, `requiredSkills`, `layer`

---

### 3. 評分候選人

```http
POST /api/talent-sourcing/score
```

**Request Body**：`candidates`（必填）, `jobRequirement`

---

### 4. 跨產業遷移分析

```http
POST /api/talent-sourcing/migration
```

**Request Body**：`candidates`（必填）, `targetIndustry`（必填）

---

### 5. 健康檢查

```http
GET /api/talent-sourcing/health
```

---

## OpenClaw AI 評分 API

> 需要 `X-OpenClaw-Key` Header 認證。

### 1. 取得待評分候選人

```http
GET /api/openclaw/pending
```

**Header**：`X-OpenClaw-Key: <key>`

**查詢參數**：`limit`（預設 50，最大 200）, `offset`, `job_id`

---

### 2. 批次更新評分結果

```http
POST /api/openclaw/batch-update
```

**Header**：`X-OpenClaw-Key: <key>`

**Request Body**：
```json
{
  "candidates": [
    {
      "id": 123,
      "ai_match_result": { ... },
      "ai_score": 85,
      "ai_grade": "A+",
      "status": "AI推薦",
      "talent_level": "A+"
    }
  ]
}
```

限制：每批最多 100 筆。

---

## 爬蟲整合 API

### 基礎

| 端點 | 說明 |
|------|------|
| `GET /api/crawler/health` | 爬蟲健康檢查 |
| `GET /api/crawler/stats` | 儀表板統計 |
| `GET /api/crawler/config` | 取得爬蟲 URL 設定 |
| `POST /api/crawler/config` | 更新爬蟲 URL（`{ "url": "..." }`） |

### 候選人

| 端點 | 說明 |
|------|------|
| `GET /api/crawler/candidates` | 爬蟲候選人列表 |
| `GET /api/crawler/candidates/:id` | 單一爬蟲候選人 |
| `POST /api/crawler/import` | 匯入爬蟲候選人到系統（`{ "candidates": [...], "actor": "...", "filters": { "min_grade": "B" } }`） |
| `GET /api/crawler/import-status` | 檢查候選人是否已存在（`?names=name1,name2`） |
| `POST /api/crawler/fix-source` | 修正來源欄位 |

### 任務管理

| 端點 | 說明 |
|------|------|
| `GET /api/crawler/tasks` | 列出爬蟲任務 |
| `POST /api/crawler/tasks` | 建立爬蟲任務 |
| `PATCH /api/crawler/tasks/:id` | 更新任務 |
| `DELETE /api/crawler/tasks/:id` | 刪除任務 |
| `POST /api/crawler/tasks/:id/run` | 執行任務 |
| `GET /api/crawler/tasks/:id/status` | 任務執行狀態 |

### 評分與關鍵字

| 端點 | 說明 |
|------|------|
| `POST /api/crawler/score/candidates` | 重新評分候選人 |
| `GET /api/crawler/score/detail/:id` | 評分細節 |
| `POST /api/crawler/keywords/generate` | 生成搜尋關鍵字 |

### 效率指標

| 端點 | 說明 |
|------|------|
| `POST /api/crawler/metrics/snapshot` | 建立效率快照 |
| `GET /api/crawler/metrics/history` | 歷史指標（`?from=2026-01-01&to=2026-03-11`） |
| `GET /api/crawler/metrics/efficiency` | 即時 KPI |

### 其他

| 端點 | 說明 |
|------|------|
| `GET /api/crawler/clients` | 客戶列表（Google Sheets fallback） |
| `GET /api/crawler/system/jobs` | 系統職缺 |
| `POST /api/crawler/sheet-cache/clear` | 清除 Sheets 快取 |

---

## 使用者與顧問 API

### 1. 列出所有顧問

```http
GET /api/users
```

---

### 2. 註冊新顧問

```http
POST /api/users/register
```

**Request Body**：`{ "displayName": "NewConsultant" }`

---

### 3. 取得顧問聯絡資訊

```http
GET /api/users/:displayName/contact
```

回傳：`contactPhone`, `contactEmail`, `lineId`, `telegramHandle`, `githubToken`, `braveApiKey`, `linkedinToken`

---

### 4. 更新顧問聯絡資訊

```http
PUT /api/users/:displayName/contact
```

**Request Body**：
```json
{
  "contact_phone": "0912-345-678",
  "contact_email": "jacky@step1ne.com",
  "line_id": "jacky_hr",
  "telegram_handle": "@jacky",
  "github_token": "ghp_xxx",
  "brave_api_key": "bsk-xxx",
  "linkedin_token": "xxx"
}
```

---

## 系統管理 API

### 1. 健康檢查

```http
GET /api/health
```

---

### 2. 系統日誌

```http
GET /api/system-logs
```

**查詢參數**：

| 參數 | 說明 | 範例 |
|------|------|------|
| `limit` | 回傳筆數（預設 200，最大 1000） | `?limit=50` |
| `actor` | 操作者（模糊比對） | `?actor=Phoebe` |
| `action` | 操作類型（精確比對） | `?action=PIPELINE_CHANGE` |
| `type` | 操作者類型 | `?type=AIBOT` |

---

### 3. Google Sheets 同步到 SQL

```http
POST /api/sync/sheets-to-sql
```

---

### 4. 提取社群連結

```http
POST /api/migrate/extract-links
```

從 email/notes 欄位提取 LinkedIn/GitHub 連結到專屬欄位。

---

### 5. 修復 AI Match Result

```http
POST /api/migrate/fix-ai-match-result
```

修復格式不正確的 ai_match_result 記錄。

---

## Guide 文件 API

| 端點 | 說明 |
|------|------|
| `GET /api/guide` | AIbot 操作手冊（AIBOT-API-GUIDE.md） |
| `GET /api/scoring-guide` | 評分 Bot 指南（SCORING-GUIDE.md） |
| `GET /api/jobs-import-guide` | 職缺匯入指南（JOB-IMPORT-GUIDE.md） |
| `GET /api/resume-guide` | 履歷分析指南（RESUME-ANALYSIS-GUIDE.md） |
| `GET /api/resume-import-guide` | 履歷匯入+評分指南（RESUME-IMPORT-GUIDE.md） |
| `GET /api/github-analysis-guide` | GitHub 分析指南（GITHUB-ANALYSIS-GUIDE.md） |

---

## 錯誤處理

所有 API 錯誤遵循統一格式：

```json
{
  "success": false,
  "error": "錯誤訊息"
}
```

**常見 HTTP 狀態碼**：
- `200` - 成功
- `201` - 創建成功
- `400` - 請求參數錯誤
- `401` - 未授權（OpenClaw API）
- `404` - 找不到資源
- `500` - 伺服器錯誤

---

## 版本歷史

### v3.0.0 (2026-03-11)
- 依實際後端程式碼全面重寫，涵蓋全部 88+ 端點
- 修正候選人欄位清單（62 個欄位）
- 新增 BD 客戶管理、爬蟲整合、OpenClaw API 文件
- 修正 limit 預設值說明，建議帶 `?limit=2000`
- 新增 Guide 文件 API 列表

### v2.0.0 (2026-02-26)
- 新增人才搜尋系統 API
- 新增顧問設定 API

### v1.0.0 (2026-02-23)
- 候選人管理 API、職缺管理 API、AI 配對 API
