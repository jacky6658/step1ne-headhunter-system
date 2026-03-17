# AI 操作手冊：人才 AI 分析與進階操作模組

> **版本**：v1.0｜**更新日期**：2026-03-16
> **適用對象**：AIbot / OpenClaw / 任何 AI Agent
> **認證方式**：`Authorization: Bearer {API_SECRET_KEY}`（一般端點）/ `X-OpenClaw-Key: {KEY}`（OpenClaw 端點）

---

## 基本資訊

- **Base URL**：依環境選擇（詳見主手冊 `GET /api/guide/index`）
  - 🏢 公司內網：`http://localhost:3003`
  - 🌐 外部存取：`https://api-hr.step1ne.com`
- **Content-Type**：`application/json`

---

## 端點總覽

### AI 分析

| 方法 | 路徑 | 認證 | 用途 |
|------|------|------|------|
| POST | `/api/candidates/:id/enrich` | Bearer | Perplexity AI 深度分析 |
| POST | `/api/candidates/enrich-batch` | Bearer | 批次 enrichment（max 10） |
| POST | `/api/candidates/:id/ai-grade-suggest` | Bearer | AI 評級建議 |
| POST | `/api/candidates/:id/check-submission-rules` | Bearer | 送件規範檢查 |
| POST | `/api/candidates/backfill-computed` | Bearer | 批次回填年資+推估年齡 |
| GET | `/api/candidates/:id/job-rankings` | Bearer | 職缺匹配排名 |

### GitHub 分析

| 方法 | 路徑 | 認證 | 用途 |
|------|------|------|------|
| GET | `/api/github/analyze/:username` | Bearer | GitHub 帳號分析 |
| POST | `/api/github/ai-analyze` | Bearer | AI 強化 GitHub 分析 |
| GET | `/api/candidates/:id/github-stats` | Bearer | 候選人 GitHub 統計 |

### 履歷解析

| 方法 | 路徑 | 認證 | 用途 |
|------|------|------|------|
| POST | `/api/resume/parse` | Bearer | 單一 PDF 解析 |
| POST | `/api/resume/parse-url` | Bearer | URL 履歷解析 |
| POST | `/api/resume/batch-parse` | Bearer | 批次履歷解析（max 20） |
| POST | `/api/candidates/:id/resume` | Bearer | 上傳履歷到人選卡片 |
| GET | `/api/candidates/:id/resume/:fileId` | Bearer | 下載履歷 |
| DELETE | `/api/candidates/:id/resume/:fileId` | Bearer | 刪除履歷 |

### OpenClaw 評分

| 方法 | 路徑 | 認證 | 用途 |
|------|------|------|------|
| GET | `/api/openclaw/pending` | X-OpenClaw-Key | 待評分佇列 |
| POST | `/api/openclaw/batch-update` | X-OpenClaw-Key | 批次回寫評分結果 |

---

## 1. AI Enrichment（深度分析）

### 單一人選 enrichment

```
POST /api/candidates/:id/enrich
```

```json
{
  "actor": "jacky-aibot"
}
```

使用 Perplexity AI 搜尋候選人的公開資訊，自動補充：
- `biography`（自傳）
- `portfolio_url`（作品集）
- `voice_assessments`（評估）
- 其他可找到的資訊

**回應**：
```json
{
  "success": true,
  "enriched_fields": ["biography", "portfolio_url"],
  "data": { ... }
}
```

> ⚠️ 需要設定 `PERPLEXITY_API_KEY` 環境變數。

### 批次 enrichment

```
POST /api/candidates/enrich-batch
```

```json
{
  "ids": [1, 2, 3],
  "actor": "jacky-aibot"
}
```

限制：最多 10 筆。

---

## 2. AI 評級建議

```
POST /api/candidates/:id/ai-grade-suggest
```

請求 body 傳入完整候選人資料，LLM 會回傳評級建議：

```json
{
  "success": true,
  "data": {
    "suggestedGrade": "A",
    "suggestedTier": "T1",
    "confidence": 0.85,
    "reasons": [
      "Google 大廠經驗",
      "技術棧完整匹配",
      "穩定性良好（平均任期 2 年）"
    ],
    "detailedAnalysis": "..."
  }
}
```

**評級**：A（優秀）、B（良好）、C（普通）、D（不推薦）
**來源層級**：T1（FAANG/大廠）、T2（知名公司）、T3（一般公司）

> ⚠️ 需要 OpenClaw/Ollama 本地 LLM 服務。

---

## 3. 送件規範檢查

```
POST /api/candidates/:id/check-submission-rules
```

```json
{
  "client_id": 5
}
```

檢查候選人是否符合客戶的送件規範：

```json
{
  "success": true,
  "data": [
    { "rule_id": "min_years", "label": "最低年資 3 年", "passed": true, "message": "符合（5年）" },
    { "rule_id": "required_skill", "label": "必備 React", "passed": false, "message": "缺少 React 技能" }
  ]
}
```

---

## 4. 批次回填計算欄位

```
POST /api/candidates/backfill-computed
POST /api/candidates/backfill-computed?force=true
```

自動計算：
- 從 `work_history` 推算 `years_experience`
- 從 `education_details` 推估 `age`

`force=true`：重新計算所有人選（包含已有值的）。

---

## 5. 職缺匹配排名

```
GET /api/candidates/:id/job-rankings
```

回傳該人選最匹配的職缺排名，7 維度評分：

| 維度 | 權重 |
|------|------|
| 技能匹配 | 35% |
| 年資匹配 | 15% |
| 薪資匹配 | 15% |
| 產業匹配 | 10% |
| 可用性 | 10% |
| 地點匹配 | 10% |
| 其他 | 5% |

---

## 6. GitHub 分析

### 基本分析

```
GET /api/github/analyze/username
GET /api/github/analyze/username?jobId=5
```

分析 GitHub 帳號的：技術棧、活躍度、貢獻品質、開源影響力。
如果帶 `jobId`，會額外比對該職缺的技能需求。

### AI 強化分析

```
POST /api/github/ai-analyze
```

使用 LLM 做更深度的 GitHub 分析。

---

## 7. 履歷解析

### 單一 PDF 解析

```
POST /api/resume/parse
Content-Type: multipart/form-data

file: [PDF 檔案]
useAI: true
```

回傳結構化資料：
```json
{
  "success": true,
  "data": {
    "name": "王大明",
    "email": "wang@gmail.com",
    "phone": "0912-345-678",
    "skills": "Node.js, Python, PostgreSQL",
    "workHistory": [...],
    "educationDetails": [...],
    "location": "台北"
  }
}
```

### URL 履歷解析

```
POST /api/resume/parse-url
```

```json
{
  "url": "https://drive.google.com/file/d/xxx/view"
}
```

支援：直接 PDF 連結、Google Drive 分享連結、Dropbox 分享連結。

### 批次履歷解析

```
POST /api/resume/batch-parse
Content-Type: multipart/form-data

files[]: [PDF 1]
files[]: [PDF 2]
useAI: true
```

限制：最多 20 個檔案。回傳包含 `existingMatch`（如果姓名/LinkedIn 已存在）。

### 上傳履歷到人選卡片

```
POST /api/candidates/:id/resume
Content-Type: multipart/form-data

file: [PDF 檔案]
uploaded_by: jacky-aibot
```

限制：每位人選最多 3 個檔案，單檔 10MB，僅接受 PDF。

---

## 8. OpenClaw 評分系統

> ⚠️ OpenClaw 端點使用**不同的認證方式**：`X-OpenClaw-Key` header。

### 取得待評分佇列

```
GET /api/openclaw/pending
X-OpenClaw-Key: {OPENCLAW_API_KEY}
```

回傳所有尚未被 AI 評分的候選人。

### 批次回寫評分結果

```
POST /api/openclaw/batch-update
X-OpenClaw-Key: {OPENCLAW_API_KEY}
```

```json
{
  "results": [
    {
      "id": 1890,
      "ai_score": 87,
      "ai_grade": "A",
      "ai_report": "技術能力強，大廠經驗豐富...",
      "ai_recommendation": "強烈推薦"
    }
  ]
}
```

---

## 常用操作流程

### 流程 1：完整人才分析流程

```
1. POST /api/resume/parse             → 解析履歷 PDF
2. POST /api/candidates               → 匯入基本資料 + work_history
3. GET /api/github/analyze/:username   → GitHub 分析
4. POST /api/candidates/:id/enrich     → Perplexity 深度分析
5. PATCH /api/candidates/:id           → 補充 ai_summary + normalized_skills
6. POST /api/candidates/:id/ai-grade-suggest → AI 評級
7. GET /api/candidates/:id/job-rankings → 職缺匹配排名
```

### 流程 2：OpenClaw 定時評分

```
1. GET /api/openclaw/pending           → 取得待評分人選
2. （AI 在本地計算評分）
3. POST /api/openclaw/batch-update     → 回寫評分結果
```

### 流程 3：批次履歷匯入

```
1. POST /api/resume/batch-parse        → 批次解析 PDF
2. POST /api/candidates/bulk           → 批次匯入（max 100）
3. POST /api/candidates/backfill-computed → 回填計算欄位
```
