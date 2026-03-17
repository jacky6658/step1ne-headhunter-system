# AI 操作手冊：職缺模組

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
- **資料表**：`jobs_pipeline`（48 欄位）

---

## 端點總覽

| 方法 | 路徑 | 用途 |
|------|------|------|
| GET | `/api/jobs` | 職缺列表 |
| GET | `/api/jobs/:id` | 單一職缺 |
| POST | `/api/jobs` | 新增職缺 |
| PUT | `/api/jobs/:id` | 更新職缺 |
| PATCH | `/api/jobs/:id/status` | 改狀態 |
| DELETE | `/api/jobs/:id` | 刪除職缺 |

---

## 1. 職缺列表

```
GET /api/jobs
```

回傳最多 1000 筆，按 `created_at DESC` 排序。

---

## 2. 單一職缺

```
GET /api/jobs/:id
```

---

## 3. 新增職缺

```
POST /api/jobs
```

**必填**：`position_name`

### 完整欄位參考

```json
{
  "position_name": "Senior Backend Engineer",
  "client_company": "台積電",
  "department": "AI 研發部",

  "open_positions": 2,
  "salary_range": "80K-120K",
  "salary_min": 80000,
  "salary_max": 120000,

  "key_skills": "Node.js, Python, PostgreSQL, Docker",
  "experience_required": "5年以上",
  "education_required": "大學以上",
  "location": "新竹",
  "language_required": "英文中上",

  "special_conditions": "需配合出差",
  "industry_background": "半導體/AI 優先",
  "team_size": "10人團隊",
  "key_challenges": "需建立全新微服務架構",
  "attractive_points": "技術自由度高、年終4個月",

  "recruitment_difficulty": "中高",
  "interview_process": "技術面試 → 主管面試 → HR 面試",
  "job_description": "負責後端 API 開發與維護...",
  "consultant_notes": "客戶偏好有大廠經驗的候選人",

  "company_profile": "全球半導體龍頭...",
  "talent_profile": "理想人選：5年+ 後端經驗...",
  "search_primary": "Backend Engineer, Node.js",
  "search_secondary": "全端工程師, Python 工程師",

  "welfare_tags": "年終,股票,彈性工時",
  "welfare_detail": "年終保障4個月...",
  "work_hours": "09:00-18:00 彈性",
  "vacation_policy": "到職即有7天",
  "remote_work": "混合制，每週2天WFH",
  "business_trip": "每季出差大陸1次",
  "job_url": "https://www.104.com.tw/job/xxx",

  "job_status": "招募中",
  "source": "104",
  "priority": "急件",

  "submission_criteria": "年資5年以上、需有微服務經驗",
  "interview_stages": 3,
  "interview_stage_detail": "第一關技術、第二關主管、第三關HR",
  "rejection_criteria": "無相關產業經驗者不考慮",
  "marketing_description": "加入全球半導體龍頭..."
}
```

### 欄位說明

| 欄位 | 型別 | 說明 |
|------|------|------|
| `position_name` | string | **必填**，職缺名稱 |
| `client_company` | string | 客戶公司名（也接受 `company_name`） |
| `department` | string | 部門 |
| `open_positions` | number | 招募人數（也接受 `headcount`） |
| `salary_range` | string | 薪資範圍文字 |
| `salary_min` | number | 薪資下限（數字） |
| `salary_max` | number | 薪資上限（數字） |
| `key_skills` | string | 必備技能（也接受 `required_skills`） |
| `experience_required` | string | 年資要求 |
| `education_required` | string | 學歷要求 |
| `location` | string | 工作地點 |
| `job_status` | string | 狀態（也接受 `status`） |
| `source` | string | 來源：`104`、`1111`、`官網`、`其他` |
| `priority` | string | 優先度：`一般`（預設）、`急件`、`高優先` |
| `company_profile` | string | AI 生成的公司畫像 |
| `talent_profile` | string | AI 生成的人才畫像 |
| `search_primary` | string | 主要搜尋關鍵字 |
| `search_secondary` | string | 次要搜尋關鍵字 |

### 回應

回應會包含 `missing_fields` 陣列，提示哪些重要欄位尚未填寫：
```json
{
  "success": true,
  "data": { "id": 1, "position_name": "..." },
  "missing_fields": ["company_profile", "talent_profile", "search_primary"]
}
```

---

## 4. 更新職缺

```
PUT /api/jobs/:id
```

只傳你要更新的欄位，未傳的欄位保持原值：
```json
{
  "salary_min": 90000,
  "salary_max": 130000,
  "company_profile": "台積電是全球最大的半導體代工廠...",
  "talent_profile": "理想候選人需具備 5 年以上後端開發經驗..."
}
```

---

## 5. 改狀態

```
PATCH /api/jobs/:id/status
```

```json
{
  "job_status": "暫停",
  "actor": "jacky-aibot"
}
```

**有效狀態**：`招募中`、`暫停`、`已滿額`、`關閉`

---

## 6. 刪除職缺

```
DELETE /api/jobs/:id
```

```json
{
  "actor": "jacky-aibot"
}
```

---

## 常用操作流程

### 流程 1：從 104/1111 匯入職缺

```
1. 取得 104/1111 網址的職缺資訊（手動或爬蟲）
2. POST /api/jobs  → 建立職缺（帶 job_url + source）
3. PUT /api/jobs/:id → 補充 company_profile + talent_profile（AI 生成）
```

### 流程 2：職缺狀態管理

```
招募中 → 暫停（客戶暫停需求）
招募中 → 已滿額（錄取完成）
招募中 → 關閉（客戶取消）
暫停 → 招募中（客戶恢復需求）
```

### 流程 3：為客戶建立職缺

```
1. GET /api/clients?bd_status=合作中  → 找到客戶
2. POST /api/jobs { "client_company": "台積電", ... }  → 建立職缺
3. GET /api/clients/:id/jobs  → 確認該客戶的職缺列表
```

---

## ⚠️ 注意事項

1. **`company_name` 和 `client_company` 都可以用**：POST 時兩者都接受，存入 `client_company` 欄位
2. **`headcount` 和 `open_positions` 都可以用**：兩者都接受
3. **`required_skills` 和 `key_skills` 都可以用**：兩者都接受
4. **`status` 和 `job_status` 都可以用**：兩者都接受
5. **更新時會清除候選人匹配快取**：PUT 後 `candidate_job_rankings_cache` 會被重新計算
