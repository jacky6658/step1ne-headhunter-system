# AI 操作手冊：BD 客戶模組

> **版本**：v1.0｜**更新日期**：2026-03-16
> **適用對象**：AIbot / OpenClaw / 任何 AI Agent
> **認證方式**：`Authorization: Bearer {API_SECRET_KEY}`

---

## 基本資訊

- **Base URL**：`https://backendstep1ne.zeabur.app`（生產）/ `http://localhost:3001`（本地）
- **Content-Type**：`application/json`
- **資料表**：`clients`（22 欄位）

---

## 端點總覽

| 方法 | 路徑 | 用途 |
|------|------|------|
| GET | `/api/clients` | 客戶列表 |
| GET | `/api/clients/:id` | 單一客戶 |
| POST | `/api/clients` | 新增客戶 |
| PATCH | `/api/clients/:id` | 更新客戶 |
| PATCH | `/api/clients/:id/status` | 改 BD 狀態 |
| DELETE | `/api/clients/:id` | 刪除客戶 |
| GET | `/api/clients/:id/jobs` | 該客戶的職缺 |
| GET | `/api/clients/:id/contacts` | BD 聯絡紀錄 |
| POST | `/api/clients/:id/contacts` | 新增聯絡紀錄 |
| GET | `/api/clients/:id/submission-rules` | 送件規範 |
| PUT | `/api/clients/:id/submission-rules` | 更新送件規範 |

---

## 1. 客戶列表

```
GET /api/clients
GET /api/clients?bd_status=合作中
GET /api/clients?consultant=Jacky
```

**回應格式**：
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "company_name": "台積電",
      "industry": "半導體",
      "company_size": "5000+",
      "website": "https://www.tsmc.com",
      "bd_status": "合作中",
      "bd_source": "轉介紹",
      "contact_name": "王大明",
      "contact_title": "HR Manager",
      "contact_email": "wang@tsmc.com",
      "contact_phone": "0912-345-678",
      "contact_linkedin": "https://linkedin.com/in/wang",
      "consultant": "Jacky",
      "contract_type": "獨家",
      "fee_percentage": 20.00,
      "contract_start": "2026-01-01",
      "contract_end": "2026-12-31",
      "notes": "Q2 有大量 AI 職缺需求",
      "url_104": "https://www.104.com.tw/company/xxx",
      "url_1111": null,
      "submission_rules": [],
      "job_count": 5,
      "created_at": "2026-01-15T08:00:00Z",
      "updated_at": "2026-03-10T12:00:00Z"
    }
  ]
}
```

---

## 2. 新增客戶

```
POST /api/clients
```

**必填**：`company_name`

**完整欄位**：
```json
{
  "company_name": "台積電",
  "industry": "半導體",
  "company_size": "5000+",
  "website": "https://www.tsmc.com",
  "bd_status": "開發中",
  "bd_source": "轉介紹",
  "contact_name": "王大明",
  "contact_title": "HR Manager",
  "contact_email": "wang@tsmc.com",
  "contact_phone": "0912-345-678",
  "contact_linkedin": "https://linkedin.com/in/wang",
  "consultant": "Jacky",
  "contract_type": "獨家",
  "fee_percentage": 20,
  "contract_start": "2026-01-01",
  "contract_end": "2026-12-31",
  "notes": "Q2 有大量需求"
}
```

**注意**：
- 若不填 `industry`，後端會根據 `company_name` 自動偵測產業
- 回應會包含 `auto_industry: true` 表示產業是自動偵測的

---

## 3. 更新客戶

```
PATCH /api/clients/:id
```

只傳你要更新的欄位：
```json
{
  "bd_status": "合作中",
  "fee_percentage": 25,
  "notes": "簽約完成，開始收 JD"
}
```

**可更新欄位**：company_name, industry, company_size, website, bd_status, bd_source, contact_name, contact_title, contact_email, contact_phone, contact_linkedin, consultant, contract_type, fee_percentage, contract_start, contract_end, notes, url_104, url_1111, submission_rules

---

## 4. 改 BD 狀態

```
PATCH /api/clients/:id/status
```

```json
{
  "bd_status": "合作中",
  "actor": "jacky-aibot"
}
```

**有效狀態值**：`開發中`、`接洽中`、`合作中`、`暫停`、`終止`

**特殊行為**：當狀態改為 `合作中` 時，回應會包含 `prompt_add_job: true`，提示 AI 可以接著新增職缺。

---

## 5. 刪除客戶

```
DELETE /api/clients/:id
```

```json
{
  "actor": "jacky-aibot"
}
```

> ⚠️ 會同時刪除該客戶的所有 BD 聯絡紀錄。

---

## 6. 查詢客戶的職缺

```
GET /api/clients/:id/jobs
```

回傳該客戶關聯的所有職缺（從 `jobs_pipeline` 表 WHERE `client_id = :id`）。

---

## 7. BD 聯絡紀錄

### 查詢紀錄
```
GET /api/clients/:id/contacts
```

### 新增紀錄
```
POST /api/clients/:id/contacts
```

```json
{
  "contact_date": "2026-03-16",
  "contact_type": "電話",
  "summary": "確認 Q2 需求，需要 3 位 Backend Engineer",
  "next_action": "寄送公司介紹簡報",
  "next_action_date": "2026-03-20",
  "by_user": "Jacky"
}
```

**contact_type 建議值**：`電話`、`Email`、`LinkedIn`、`會議`、`餐敘`

---

## 8. 送件規範

### 查詢
```
GET /api/clients/:id/submission-rules
```

### 更新
```
PUT /api/clients/:id/submission-rules
```

```json
{
  "rules": [
    {
      "rule_id": "min_years",
      "label": "最低年資",
      "field": "years_experience",
      "operator": ">=",
      "value": "3"
    },
    {
      "rule_id": "required_skill",
      "label": "必備技能",
      "field": "skills",
      "operator": "contains",
      "value": "React"
    }
  ]
}
```

---

## 常用操作流程

### 流程 1：新客戶開發完整流程

```
1. POST /api/clients              → 建立客戶卡片
2. PATCH /api/clients/:id/status   → 狀態改為「接洽中」
3. POST /api/clients/:id/contacts  → 記錄每次聯絡
4. PATCH /api/clients/:id/status   → 簽約後改為「合作中」
5. POST /api/jobs                  → 開始建立職缺（見職缺手冊）
```

### 流程 2：查詢客戶 + 職缺概覽

```
1. GET /api/clients?bd_status=合作中  → 列出合作中客戶
2. GET /api/clients/:id/jobs         → 查看該客戶職缺
```
