# AI 操作手冊：人選匯入與管理模組

> **版本**：v1.0｜**更新日期**：2026-03-16
> **適用對象**：AIbot / OpenClaw / 任何 AI Agent
> **認證方式**：`Authorization: Bearer {API_SECRET_KEY}`

---

## 基本資訊

- **Base URL**：依環境選擇（詳見主手冊 `GET /api/guide/index`）
  - 🏢 公司內網：`http://localhost:3003`
  - 🌐 外部存取：`https://api-hr.step1ne.com`
- **Content-Type**：`application/json`
- **認證**：`Authorization: Bearer {API_SECRET_KEY}`
- **資料表**：`candidates_pipeline`（88 欄位）

---

## 端點總覽

| 方法 | 路徑 | 用途 |
|------|------|------|
| GET | `/api/candidates` | 人選列表（分頁） |
| GET | `/api/candidates/:id` | 單一人選 |
| POST | `/api/candidates` | 智慧匯入（單筆） |
| PATCH | `/api/candidates/:id` | 局部更新（**主力端點**） |
| PUT | `/api/candidates/:id` | 簡易更新 |
| DELETE | `/api/candidates/:id` | 刪除人選 |
| PATCH | `/api/candidates/batch-status` | 批次改狀態 |
| DELETE | `/api/candidates/batch` | 批次刪除 |
| POST | `/api/candidates/bulk` | 批次匯入（同步，max 100） |
| POST | `/api/candidates/bulk-async` | 批次匯入（非同步，max 500） |
| GET | `/api/imports/:id` | 查詢非同步匯入進度 |

---

## ⚠️ 重要：POST vs PATCH 行為差異

| 操作 | POST `/api/candidates` | PATCH `/api/candidates/:id` |
|------|------------------------|----------------------------|
| 已存在人選 | **只補空欄位**（COALESCE，不覆蓋已有值） | **直接覆寫**（傳什麼就寫什麼） |
| work_history | 只有原本是 NULL 才寫入 | 直接覆寫 |
| 判斷已存在 | 用 `name` 比對（LOWER + TRIM） | 用 `id` 指定 |

> **結論**：
> - 新增人選 → 用 **POST**
> - 更新已有人選的欄位（如工作經歷、AI 總結）→ 用 **PATCH**
> - 想強制覆蓋某欄位 → 必須用 **PATCH**，POST 不會覆蓋非空值

---

## 1. 人選列表

```
GET /api/candidates
GET /api/candidates?status=追蹤中&limit=50&offset=0
GET /api/candidates?source=GitHub&created_today=true
```

**查詢參數**：

| 參數 | 說明 |
|------|------|
| `status` | 篩選狀態 |
| `source` | 篩選來源 |
| `created_today` | `true` 只看今天新增 |
| `limit` | 每頁筆數（預設 500，最大 2000） |
| `offset` | 偏移量 |
| `page` | 頁碼（替代 offset） |

---

## 2. 單一人選

```
GET /api/candidates/:id
```

回傳完整人選資料，包含 camelCase 和 snake_case 兩種格式的欄位。

---

## 3. 智慧匯入（單筆）

```
POST /api/candidates
```

**必填**：`name`

### 基本匯入

```json
{
  "name": "王大明",
  "phone": "0912-345-678",
  "email": "wang@gmail.com",
  "linkedin_url": "https://linkedin.com/in/wang",
  "github_url": "https://github.com/wang",
  "location": "台北",
  "current_position": "Senior Backend Engineer",
  "years_experience": "5",
  "skills": "Node.js, Python, PostgreSQL, Docker, K8s",
  "education": "台灣大學 資訊工程所 碩士",
  "source": "LinkedIn",
  "recruiter": "Jacky",
  "notes": "對 AI 相關職缺有興趣"
}
```

### 完整匯入（含工作經歷 + 學歷 + AI 分析）

```json
{
  "name": "王大明",
  "phone": "0912-345-678",
  "email": "wang@gmail.com",
  "linkedin_url": "https://linkedin.com/in/wang",
  "github_url": "https://github.com/wang",
  "location": "台北",
  "current_position": "Senior Backend Engineer",
  "years_experience": "5",
  "skills": "Node.js, Python, PostgreSQL, Docker, K8s",
  "education": "台灣大學 資訊工程所 碩士",
  "source": "LinkedIn",
  "status": "追蹤中",
  "recruiter": "Jacky",
  "notes": "對 AI 相關職缺有興趣",
  "talent_level": "A+",

  "work_history": [
    {
      "company": "Google",
      "title": "Senior Software Engineer",
      "start": "2022-01",
      "end": "present",
      "description": "負責 Cloud Platform 後端 API 開發"
    },
    {
      "company": "LINE",
      "title": "Backend Engineer",
      "start": "2019-06",
      "end": "2021-12",
      "description": "負責 Messaging API 維護與效能優化"
    },
    {
      "company": "新創公司",
      "title": "Junior Developer",
      "start": "2017-07",
      "end": "2019-05",
      "description": "全端開發"
    }
  ],

  "education_details": [
    {
      "school": "台灣大學",
      "degree": "碩士",
      "major": "資訊工程",
      "start": "2015",
      "end": "2017"
    },
    {
      "school": "成功大學",
      "degree": "學士",
      "major": "資訊工程",
      "start": "2011",
      "end": "2015"
    }
  ],

  "stability_score": "85",
  "job_changes": "3",
  "avg_tenure_months": "24",
  "recent_gap_months": "0",
  "leaving_reason": "追求更大的技術挑戰",
  "personality_type": "INTJ",

  "current_salary": "150K",
  "expected_salary": "180K-200K",

  "ai_match_result": {
    "overall_score": 87,
    "dimensions": {
      "talent_profile_match": 90,
      "jd_match": 85,
      "company_fit": 80,
      "reachability": 95,
      "activity_signal": 85
    },
    "recommendation": "強烈推薦",
    "summary": "經驗豐富的後端工程師，技術棧完美匹配"
  }
}
```

---

## 4. 局部更新（主力端點）

```
PATCH /api/candidates/:id
```

**只傳你要更新的欄位**。這是最常用的端點，支援 60+ 欄位。

### 欄位名稱對照表

> API 同時接受 snake_case 和 camelCase，但**建議統一用 snake_case**。

| snake_case（建議） | camelCase（也接受） | 型別 | 說明 |
|---|---|---|---|
| **核心欄位** ||||
| name | — | string | 姓名 |
| phone | — | string | 電話 |
| email | — | string | Email |
| location | — | string | 地點 |
| position / current_position | — | string | 現職 |
| years / years_experience | — | string/number | 年資 |
| skills | — | string | 技能（逗號分隔） |
| education | — | string | 學歷（文字） |
| status | — | string | 狀態 |
| recruiter | — | string | 負責顧問 |
| notes / remarks | — | string | 備註 |
| talent_level | — | string | 人才等級 S/A+/A/B/C |
| **連結** ||||
| linkedin_url | linkedinUrl | string | LinkedIn |
| github_url | githubUrl | string | GitHub |
| **JSON 欄位（重要）** ||||
| work_history | — | JSON array | 工作經歷 |
| education_details | — | JSON array | 學歷詳情 |
| ai_match_result | — | JSON object | AI 匹配結果 |
| ai_summary | aiSummary | JSON object | AI 總結 |
| consultant_evaluation | consultantEvaluation | JSON object | 顧問評估 |
| voice_assessments | voiceAssessments | JSON array | 語音評估 |
| **個人資料** ||||
| birthday | — | date | 生日 |
| age | — | number | 年齡 |
| age_estimated | ageEstimated | boolean | 年齡是否為推估 |
| gender | — | string | 性別 |
| english_name | englishName | string | 英文名 |
| **薪資** ||||
| current_salary | currentSalary | string | 目前薪資 |
| expected_salary | expectedSalary | string | 期望薪資 |
| current_salary_min | currentSalaryMin | number | 目前薪資下限 |
| current_salary_max | currentSalaryMax | number | 目前薪資上限 |
| expected_salary_min | expectedSalaryMin | number | 期望薪資下限 |
| expected_salary_max | expectedSalaryMax | number | 期望薪資上限 |
| salary_currency | salaryCurrency | string | 幣別（預設 TWD） |
| salary_period | salaryPeriod | string | 計薪方式（預設 monthly） |
| **動機與交易** ||||
| job_search_status | jobSearchStatus | string | 求職狀態 |
| reason_for_change | reasonForChange | string | 轉職原因 |
| motivation | — | string | 動機 |
| deal_breakers | dealBreakers | string | 不可接受條件 |
| competing_offers | competingOffers | string | 競爭 offer |
| relationship_level | relationshipLevel | string | 關係深度 |
| notice_period | noticePeriod | string | 到職時間 |
| **結構化匹配欄位** ||||
| current_title | currentTitle | string | 現任職稱 |
| current_company | currentCompany | string | 現任公司 |
| role_family | roleFamily | string | 角色族群 |
| canonical_role | canonicalRole | string | 標準角色 |
| seniority_level | seniorityLevel | string | 資深度 |
| total_years | totalYears | number | 總年資 |
| industry_tag | industryTag | string | 產業標籤 |
| normalized_skills | normalizedSkills | JSON array | 標準化技能 |
| skill_evidence | skillEvidence | JSON array | 技能證據 |
| education_level | educationLevel | string | 學歷等級 |
| **分類** ||||
| grade_level | gradeLevel | string | 人才等級 |
| source_tier | sourceTier | string | 來源層級 |
| heat_level | heatLevel | string | 熱度 |
| **其他** ||||
| biography | — | string | 自傳 |
| portfolio_url | portfolioUrl | string | 作品集 |
| consultant_note | consultantNote | string | 顧問筆記 |
| industry | — | string | 產業 |
| languages | — | string | 語言 |
| certifications | — | string | 證照 |
| management_experience | managementExperience | boolean | 管理經驗 |
| team_size | teamSize | string | 管理團隊規模 |
| interview_round | interviewRound | number | 面試輪次 |
| target_job_id | — | number | 目標職缺 ID |
| stability_score | — | string | 穩定性分數 |

### 範例：更新工作經歷

```json
PATCH /api/candidates/1890

{
  "work_history": [
    {
      "company": "Google",
      "title": "Senior Software Engineer",
      "start": "2022-01",
      "end": "present",
      "description": "Cloud Platform API 開發"
    },
    {
      "company": "LINE",
      "title": "Backend Engineer",
      "start": "2019-06",
      "end": "2021-12",
      "description": "Messaging API"
    }
  ],
  "actor": "jacky-aibot"
}
```

### 範例：更新 AI 總結

```json
PATCH /api/candidates/1890

{
  "ai_summary": {
    "one_liner": "5年經驗的後端工程師，擅長 Node.js/Python",
    "strengths": ["大廠經驗", "技術棧廣", "穩定性高"],
    "concerns": ["薪資期望偏高"],
    "fit_for": ["後端主管", "Tech Lead"],
    "updated_at": "2026-03-16"
  },
  "actor": "jacky-aibot"
}
```

### 範例：更新結構化匹配欄位

```json
PATCH /api/candidates/1890

{
  "current_title": "Senior Backend Engineer",
  "current_company": "Google",
  "role_family": "Engineering",
  "canonical_role": "Backend Engineer",
  "seniority_level": "Senior",
  "total_years": 5,
  "industry_tag": "科技業",
  "normalized_skills": ["Node.js", "Python", "PostgreSQL", "Docker", "Kubernetes"],
  "education_level": "碩士",
  "current_salary_min": 150000,
  "current_salary_max": 150000,
  "expected_salary_min": 180000,
  "expected_salary_max": 200000,
  "salary_currency": "TWD",
  "salary_period": "monthly",
  "actor": "jacky-aibot"
}
```

### 自動衍生行為

PATCH 會自動觸發以下衍生計算：
- **skills 變更** → 自動更新 `normalized_skills`（如果你沒自己傳）
- **salary 變更** → 自動解析 `current_salary_min/max`、`expected_salary_min/max`
- **work_history 變更** → 自動計算 `auto_derived`（年資、跳槽次數等）
- **job_search_status 變更** → 自動設定 `job_search_status_enum`

---

## 5. 刪除人選

```
DELETE /api/candidates/:id
```

```json
{
  "actor": "jacky-aibot"
}
```

---

## 6. 批次改狀態

```
PATCH /api/candidates/batch-status
```

```json
{
  "ids": [1, 2, 3, 4, 5],
  "status": "追蹤中",
  "actor": "jacky-aibot",
  "note": "批次標記為追蹤中"
}
```

限制：最多 200 筆。

---

## 7. 批次匯入（同步）

```
POST /api/candidates/bulk
```

```json
{
  "candidates": [
    { "name": "人選A", "skills": "React", "source": "GitHub" },
    { "name": "人選B", "skills": "Python", "source": "LinkedIn" }
  ],
  "actor": "jacky-aibot"
}
```

限制：最多 100 筆。回傳 created/updated/failed 統計。

---

## 8. 批次匯入（非同步）

```
POST /api/candidates/bulk-async
```

```json
{
  "candidates": [...最多500筆...],
  "actor": "jacky-aibot"
}
```

回傳 202 + `import_id`，用以下端點查進度：

```
GET /api/imports/:import_id
```

---

## 9. 互動紀錄

### 查詢
```
GET /api/candidates/:id/interactions
```

### 新增
```
POST /api/candidates/:id/interactions
```

```json
{
  "interaction_type": "電話",
  "interaction_date": "2026-03-16",
  "channel": "手機",
  "summary": "確認求職意願，目前在看機會",
  "next_action": "安排與客戶面試",
  "next_action_date": "2026-03-20",
  "response_level": "積極",
  "created_by": "Jacky"
}
```

### 更新
```
PATCH /interactions/:interactionId
```

### 刪除
```
DELETE /interactions/:interactionId
```

---

## 人選狀態值

| 狀態 | 說明 |
|------|------|
| `未開始` | 剛匯入，尚未處理 |
| `追蹤中` | 主動追蹤中 |
| `聯繫中` | 已開始聯繫 |
| `面試中` | 進入面試流程 |
| `已錄取` | 收到 offer |
| `已報到` | 到職 |
| `已拒絕` | 候選人拒絕 |
| `不適合` | 不符合需求 |
| `暫緩` | 暫時擱置 |

---

## 常用操作流程

### 流程 1：完整匯入一位人選

```
1. POST /api/candidates → 基本資料 + work_history + education_details
2. PATCH /api/candidates/:id → 補充 ai_summary、normalized_skills 等
```

### 流程 2：批次匯入 + 後續補充

```
1. POST /api/candidates/bulk → 批次匯入基本資料
2. 對每位人選 PATCH /api/candidates/:id → 補充詳細欄位
```

### 流程 3：更新已有人選的工作經歷

```
⚠️ 不要用 POST！POST 不會覆蓋已有的 work_history

正確做法：
PATCH /api/candidates/:id
{ "work_history": [...] }
```
