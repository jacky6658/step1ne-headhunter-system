# Step1ne API Reference（AI 專用文檔）

> 本文檔供 Step1ne AI Bot / OpenClaw / 外部 AI 工具使用。
> 最後更新：2026-03-15

## 連線資訊

| 項目 | 值 |
|------|-----|
| **Production Base URL** | `https://backendstep1ne.zeabur.app` |
| **Local Dev Base URL** | `http://localhost:3001` |
| **Rate Limit** | 200 requests / 60s |
| **Body Limit** | 10 MB JSON |

## 認證方式

| 認證方式 | Header | 適用端點 |
|---------|--------|---------|
| **Bearer Token** | `Authorization: Bearer <API_SECRET_KEY>` | 所有 `/api/*`（除公開端點） |
| **OpenClaw Key** | `X-OpenClaw-Key: <OPENCLAW_API_KEY>` | `/api/openclaw/*` |
| **無需認證** | — | `GET /`、`GET /api/health`、`POST /api/webhooks/github` |

---

## 1. 候選人 Candidates

### `GET /api/candidates`
列出候選人（分頁）

| 參數 | 類型 | 說明 |
|------|------|------|
| `limit` | query | 每頁數量（預設 500，最大 2000） |
| `offset` | query | 偏移量 |
| `status` | query | 篩選狀態 |
| `source` | query | 篩選來源 |
| `created_today` | query | `true` 僅顯示今日建立 |

**回應：**
```json
{ "success": true, "data": [Candidate...], "count": 50, "total": 1200, "pagination": { "limit": 500, "offset": 0, "hasMore": true } }
```

---

### `GET /api/candidates/:id`
取得單一候選人完整資料

**回應：**
```json
{ "success": true, "data": { "id": "1", "name": "王小明", "email": "", "phone": "", "position": "", "years": 5, "skills": "", "education": "", "status": "", "notes": "", "progressTracking": [], "aiMatchResult": null, "aiSummary": null, "industry": "", "languages": "", "certifications": "", "currentSalary": "", "expectedSalary": "", "noticePeriod": "", "managementExperience": false, "teamSize": "", "biography": "", "portfolioUrl": "", "voiceAssessments": [], "consultantNote": "", "consultantEvaluation": null, "workHistory": [], "educationJson": [], ... } }
```

---

### `GET /api/candidates/:id/match-input`
取得 Layer 1 結構化匹配欄位（AI 比對專用，乾淨結構化資料）

**回應：**
```json
{ "success": true, "data": { "candidateId": "1", "name": "王小明", "currentTitle": "Backend Engineer", "currentCompany": "Shopline", "roleFamily": "Backend", "canonicalRole": "Backend Engineer", "seniorityLevel": "Senior", "totalYears": 5, "location": "台北", "industryTag": "SaaS", "normalizedSkills": ["Java", "Spring Boot"], "educationLevel": "Bachelor", "currentSalaryMin": 80000, "currentSalaryMax": 100000, "expectedSalaryMin": 100000, "expectedSalaryMax": 130000, "salaryCurrency": "TWD", "salaryPeriod": "monthly", "noticePeriodEnum": "1month", "jobSearchStatusEnum": "active", "dataQualityScore": 75, "precisionEligible": true } }
```

---

### `PATCH /api/candidates/:id`
局部更新候選人（⭐ 最常用，支援所有欄位）

**重要欄位（支援 camelCase 和 snake_case）：**

| 欄位 | 類型 | 說明 |
|------|------|------|
| `status` | string | 狀態：未開始/AI推薦/聯繫階段/面試階段/Offer/on board/婉拒/備選人才 |
| `progressTracking` | JSON[] | 進度追蹤陣列 `[{ event, date, note, by }]` |
| `notes` | string | 備註文字 |
| `recruiter` | string | 負責顧問 |
| `ai_match_result` | JSON | AI 匹配結果 |
| `ai_summary` | JSON | ⭐ AI 總結分析結果（見下方格式） |
| `name` | string | 姓名 |
| `position` / `current_position` | string | 現職 |
| `skills` | string | 技能（逗號分隔） |
| `years` / `years_experience` | int | 年資 |
| `education` | string | 學歷 |
| `email` | string | Email |
| `phone` | string | 電話 |
| `location` | string | 所在地 |
| `linkedin_url` | string | LinkedIn |
| `github_url` | string | GitHub |
| `birthday` | string | 生日 |
| `age` | int | 年齡 |
| `gender` | string | 性別 |
| `english_name` | string | 英文名 |
| `industry` | string | 產業 |
| `languages` | string | 語言能力 |
| `certifications` | string | 證照 |
| `current_salary` | string | 目前薪資 |
| `expected_salary` | string | 期望薪資 |
| `notice_period` | string | 到職時間 |
| `management_experience` | boolean | 有管理經驗 |
| `team_size` | string | 團隊規模 |
| `consultant_note` | string | 顧問備註 |
| `consultant_evaluation` | JSON | 顧問五維度評估 |
| `voice_assessments` | JSON[] | 語音/面談評估 |
| `biography` | string | 自傳 |
| `portfolio_url` | string | 作品集 URL |
| `job_search_status` | string | 求職狀態 |
| `reason_for_change` | string | 轉職原因 |
| `motivation` | string | 主要動機 |
| `deal_breakers` | string | 不接受條件 |
| `competing_offers` | string | 競爭 Offer |
| `relationship_level` | string | 關係程度 |
| `target_job_id` | int | 目標職缺 ID |
| `work_history` | JSON[] | 工作經歷 |
| `education_details` | JSON[] | 學歷詳情 |
| `grade_level` | string | 評級 A/B/C/D |
| `source_tier` | string | 來源層級 T1/T2/T3 |
| `heat_level` | string | 熱度 |
| `actor` | string | 操作者名稱（記入 log） |

**ai_summary JSON 格式（⭐ AI 深度分析結果）：**
```json
{
  "one_liner": "一句話定位（20字內）",
  "top_matches": [
    {
      "job_id": "職缺ID",
      "job_title": "職缺名稱",
      "company": "公司名",
      "match_score": 85,
      "match_reason": "匹配原因",
      "gaps": "落差",
      "submission_check": "送人條件比對",
      "interview_stages": 3
    }
  ],
  "strengths": ["核心優勢1", "核心優勢2", "核心優勢3"],
  "risks": ["風險1", "風險2"],
  "salary_risk": "薪資風險評估",
  "stability_risk": "穩定性風險評估",
  "deep_insight": "自傳/作品集/面談深度洞察（若無則 null）",
  "suggested_questions": ["建議提問1", "建議提問2", "建議提問3"],
  "next_steps": "顧問行動建議",
  "evaluated_at": "2026-03-15T10:00:00Z",
  "evaluated_by": "AI 模型名稱"
}
```

**範例請求：**
```bash
curl -X PATCH https://backendstep1ne.zeabur.app/api/candidates/123 \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "ai_summary": {
      "one_liner": "5年 Java 後端，Fintech 經驗豐富",
      "top_matches": [{ "job_id": "10", "job_title": "Senior Backend", "company": "Cathay", "match_score": 88, "match_reason": "Java + 金融經驗完全匹配" }],
      "strengths": ["Java Spring Boot 深度", "金融領域經驗", "系統架構能力"],
      "risks": ["期望薪資偏高"],
      "salary_risk": "期望 120K vs 職缺上限 100K，需協商",
      "stability_risk": "平均任期 2.5 年，略短",
      "suggested_questions": ["Spring Boot 微服務架構經驗？", "為何離開前公司？"],
      "next_steps": "安排與客戶面試",
      "evaluated_at": "2026-03-15T10:00:00Z",
      "evaluated_by": "Claude-3.5-Sonnet"
    },
    "actor": "AI-summary"
  }'
```

**回應：**
```json
{ "success": true, "data": { ... }, "message": "Updated fields: ai_summary", "changed": ["ai_summary"] }
```

---

### `PUT /api/candidates/:id/pipeline-status`
更新 Pipeline 狀態（自動附加進度事件）

**Body：**
```json
{ "status": "面試階段", "by": "Jacky" }
```

---

### `PATCH /api/candidates/batch-status`
批量更新狀態（最多 200 筆）

**Body：**
```json
{ "ids": [1, 2, 3], "status": "AI推薦", "actor": "AIBot", "note": "AI 初篩通過" }
```

---

### `POST /api/candidates`
智慧匯入單一候選人（已存在則補充空欄位，不存在則新建）

**Body：**
```json
{ "name": "王小明", "phone": "0912345678", "current_position": "Backend Engineer", "skills": "Java, Spring Boot", "years_experience": 5, "source": "LinkedIn", "actor": "AIBot" }
```

---

### `POST /api/candidates/bulk`
批量匯入（同步，最多 100 筆）

**Body：**
```json
{ "candidates": [{ "name": "A", ... }, { "name": "B", ... }], "actor": "AIBot" }
```

---

### `POST /api/candidates/bulk-async`
佇列化批量匯入（非同步，最多 500 筆）

**Body 同上，回應：**
```json
{ "success": true, "import_id": "abc123", "status": "pending", "total": 200 }
```

---

### `DELETE /api/candidates/:id`
刪除候選人

### `DELETE /api/candidates/batch`
批量刪除（最多 200 筆）

**Body：** `{ "ids": [1, 2, 3], "actor": "Jacky" }`

---

### `GET /api/candidates/:id/job-rankings`
取得 Top 5 職缺匹配排名（7 維度評分，含快取）

| 參數 | 說明 |
|------|------|
| `force=1` | 跳過快取重新計算 |

**回應：**
```json
{
  "candidate_id": "1",
  "total_jobs": 30,
  "rankings": [{
    "job_id": 10, "job_title": "Senior Backend", "company": "Cathay",
    "match_score": 88, "skill_score": 90, "experience_score": 85,
    "matched_skills": ["Java", "Spring"], "missing_skills": ["Kafka"],
    "recommendation": "推薦"
  }],
  "cached": true
}
```

---

### `GET /api/candidates/:id/github-stats`
GitHub 快速統計（含 24hr DB 快取）

### `POST /api/candidates/:id/enrich`
Perplexity AI 搜尋候選人公開資料

### `POST /api/candidates/:id/resume`
上傳 PDF 履歷（multipart/form-data，最多 3 個）

### `GET /api/candidates/:id/resume/:fileId`
下載/預覽 PDF 履歷

### `DELETE /api/candidates/:id/resume/:fileId`
刪除 PDF 附件

### `POST /api/candidates/:id/check-submission-rules`
檢查候選人是否符合客戶送件規範

**Body：** `{ "client_id": 5 }`

### `POST /api/candidates/:id/ai-grade-suggest`
本地 LLM 深度分析建議 Grade/Source Tier

---

## 2. 互動紀錄 Interactions

### `GET /api/candidates/:id/interactions`
取得候選人互動紀錄

### `POST /api/candidates/:id/interactions`
新增互動紀錄

**Body：**
```json
{ "interaction_type": "phone_call", "interaction_date": "2026-03-15", "channel": "電話", "summary": "人選有興趣", "next_action": "安排面試", "next_action_date": "2026-03-20", "response_level": "positive", "created_by": "Jacky" }
```

### `PATCH /api/interactions/:id`
更新互動紀錄

### `DELETE /api/interactions/:id`
刪除互動紀錄

---

## 3. 職缺 Jobs

### `GET /api/jobs`
列出所有職缺

**回應含：** `candidate_count`（已連結候選人數）

### `GET /api/jobs/:id`
取得單一職缺完整資料

### `POST /api/jobs`
新增職缺

**Body：**
```json
{
  "position_name": "Senior Backend Engineer",
  "client_company": "國泰金控",
  "department": "數位金融部",
  "salary_range": "80K-120K TWD/月",
  "salary_min": 80000,
  "salary_max": 120000,
  "key_skills": "Java, Spring Boot, PostgreSQL",
  "experience_required": "5年以上",
  "education_required": "大學以上",
  "location": "台北",
  "job_status": "開放",
  "job_description": "...",
  "submission_criteria": "需有金融業經驗...",
  "interview_stages": 3,
  "interview_stage_detail": "HR → 技術主管 → VP",
  "rejection_criteria": "無金融經驗者不考慮",
  "client_id": 5
}
```

### `PUT /api/jobs/:id`
更新職缺（完整覆蓋）

### `PATCH /api/jobs/:id/status`
更新職缺狀態

**Body：** `{ "job_status": "關閉", "actor": "Jacky" }`

### `DELETE /api/jobs/:id`
刪除職缺

---

## 4. BD 客戶 Clients

### `GET /api/clients`
列出客戶（含 `job_count`）

| 參數 | 說明 |
|------|------|
| `bd_status` | 篩選 BD 狀態 |
| `consultant` | 篩選負責顧問 |

### `GET /api/clients/:id`
取得單一客戶

### `POST /api/clients`
新增客戶

**Body：**
```json
{
  "company_name": "國泰金控",
  "industry": "金融業",
  "company_size": "10000+",
  "website": "https://cathaybk.com.tw",
  "bd_status": "接洽中",
  "contact_name": "李經理",
  "contact_title": "HR Director",
  "contact_email": "li@cathay.com",
  "consultant": "Jacky",
  "fee_percentage": 20,
  "notes": "年度合作客戶"
}
```

### `PATCH /api/clients/:id`
更新客戶

### `PATCH /api/clients/:id/status`
更新 BD 狀態

**Body：** `{ "bd_status": "合作中", "actor": "Jacky" }`

**BD 狀態值：** 開發中 → 接洽中 → 提案中 → 合約階段 → 合作中 → 暫停 → 流失

### `GET /api/clients/:id/jobs`
取得該客戶所有職缺

### `GET /api/clients/:id/contacts`
取得客戶聯絡紀錄

### `POST /api/clients/:id/contacts`
新增客戶聯絡紀錄

### `GET /api/clients/:id/submission-rules`
取得客戶送件規範

### `PUT /api/clients/:id/submission-rules`
更新客戶送件規範

### `DELETE /api/clients/:id`
刪除客戶

---

## 5. 提示詞庫 Prompts

### `GET /api/prompts`
列出提示詞

| 參數 | 說明 |
|------|------|
| `category` | 分類篩選（或 `all`） |
| `viewer` | 使用者名稱（回傳 has_voted） |

### `GET /api/prompts/:id`
取得單一提示詞

### `POST /api/prompts`
新增提示詞

**Body：** `{ "category": "人才搜尋", "title": "...", "content": "...", "author": "Jacky" }`

### `PATCH /api/prompts/:id`
編輯提示詞

### `DELETE /api/prompts/:id`
刪除提示詞

### `POST /api/prompts/:id/upvote`
投票/取消投票（toggle）

### `POST /api/prompts/:id/pin`
置頂/取消置頂

---

## 6. 分類法 Taxonomy

### `GET /api/taxonomy/skills`
取得技能分類

### `GET /api/taxonomy/roles`
取得角色/職能分類

### `GET /api/taxonomy/industries`
取得產業分類

---

## 7. GitHub 分析

### `GET /api/github/analyze/:username`
完整 GitHub 分析

| 參數 | 說明 |
|------|------|
| `jobId` | 比對特定職缺 |

### `POST /api/github/ai-analyze`
AI 深度 GitHub 分析

**Body：** `{ "candidateId": "1", "jobId": "10" }`

---

## 8. 履歷解析 Resume

### `POST /api/resume/parse`
單筆 PDF 解析（multipart/form-data）

### `POST /api/resume/parse-url`
URL 下載 PDF 解析

**Body：** `{ "url": "https://drive.google.com/..." }`

### `POST /api/resume/batch-parse`
批量 PDF 解析（最多 20 份）

---

## 9. 使用者 / 顧問 Users

### `GET /api/users`
取得所有顧問名單

### `POST /api/users/register`
顧問自動註冊

### `GET /api/users/:displayName/contact`
取得顧問聯絡資訊

### `PUT /api/users/:displayName/contact`
儲存顧問聯絡資訊

### `GET /api/users/:displayName/site-config`
取得顧問對外頁面設定

### `PUT /api/users/:displayName/site-config`
更新顧問對外頁面設定

---

## 10. 通知 Notifications

### `GET /api/notifications`
取得通知（最新 50 筆）

| 參數 | 說明 |
|------|------|
| `uid` | 使用者 ID（必填） |
| `unread_only` | `true` 僅未讀 |

### `POST /api/notifications`
發布站內通知

### `PATCH /api/notifications/:id/read`
標記已讀

### `PATCH /api/notifications/read-all`
全部標記已讀

---

## 11. 系統 System

### `GET /api/health`
健康檢查（公開，無需認證）

### `GET /api/system-logs`
查詢操作日誌

| 參數 | 說明 |
|------|------|
| `limit` | 筆數（預設 200，最大 1000） |
| `actor` | 模糊比對操作者 |
| `action` | PIPELINE_CHANGE / IMPORT_CREATE / IMPORT_UPDATE / BULK_IMPORT / UPDATE |
| `type` | HUMAN / AIBOT |

### `GET /api/system-config/:key`
取得系統設定

### `PUT /api/system-config/:key`
更新系統設定

---

## 12. OpenClaw（本地 AI 工具專用）

> ⚠️ 認證方式：`X-OpenClaw-Key` header（非 Bearer token）

### `GET /api/openclaw/pending`
取得待分析候選人（status='爬蟲初篩'）

| 參數 | 說明 |
|------|------|
| `limit` | 每頁數量（預設 50，最大 200） |
| `offset` | 偏移量 |
| `job_id` | 篩選特定職缺 |

### `POST /api/openclaw/batch-update`
批量回寫 AI 分析結果（最多 100 筆）

**Body：**
```json
{
  "candidates": [{
    "id": 1,
    "ai_match_result": { "score": 85, "grade": "A", "recommendation": "推薦", ... },
    "status": "AI推薦",
    "talent_level": "精選",
    "notes": "AI 分析完成"
  }]
}
```

---

## 13. 爬蟲 Crawler

### `GET /api/crawler/health`
爬蟲健康檢查

### `GET /api/crawler/stats`
Dashboard 統計

### `GET /api/crawler/candidates`
爬蟲候選人列表

### `POST /api/crawler/import`
將爬蟲候選人匯入系統

**Body：**
```json
{ "candidates": [{...}], "actor": "AIBot", "filters": { "min_grade": "B" } }
```

### `GET /api/crawler/metrics/efficiency`
即時效益 KPI

### `POST /api/crawler/metrics/snapshot`
建立效益指標快照

---

## 14. 獵才 Talent Sourcing

### `POST /api/talent-sourcing/find-candidates`
完整 6 步驟獵才流程

**Body：**
```json
{ "company": "Google", "jobTitle": "Senior Backend Engineer", "actor": "AIBot", "pages": 2 }
```

### `POST /api/talent-sourcing/search`
搜尋候選人

### `POST /api/talent-sourcing/score`
評分候選人

### `POST /api/talent-sourcing/migration`
跨產業遷移分析

### `GET /api/talent-sourcing/health`
獵才系統健康檢查

---

## 15. 指南 Guides（回傳 Markdown 文本）

| 端點 | 說明 |
|------|------|
| `GET /api/guide` | AIBot 操作指南 |
| `GET /api/consultant-sop` | 顧問 SOP 手冊 |
| `GET /api/scoring-guide` | 評分 Bot 指南 |
| `GET /api/jobs-import-guide` | 職缺匯入指南 |
| `GET /api/resume-guide` | 履歷分析教學 |
| `GET /api/resume-import-guide` | 履歷匯入 + 評分合併指南 |
| `GET /api/github-analysis-guide` | GitHub 分析指南 |

---

## 16. 同步 & 遷移

### `POST /api/sync/sheets-to-sql`
Google Sheets → SQL 同步（已棄用，僅保留向後相容）

### `POST /api/migrate/extract-links`
從舊欄位提取 LinkedIn/GitHub URL

### `POST /api/migrate/fix-ai-match-result`
修正格式錯誤的 ai_match_result

---

## 17. Webhooks

### `POST /api/webhooks/github`
GitHub push 事件 Webhook（可選 HMAC-SHA256 驗證）

---

## 附錄：常用狀態值

### 候選人狀態 CandidateStatus
```
未開始 → AI推薦 → 聯繫階段 → 面試階段 → Offer → on board
                                              ↘ 婉拒
                                              ↘ 備選人才
                                              ↘ 爬蟲初篩
```

### 職缺狀態 JobStatus
```
開放 / 暫停 / 關閉 / 草稿
```

### BD 客戶狀態
```
開發中 → 接洽中 → 提案中 → 合約階段 → 合作中 → 暫停 / 流失
```

### 評級 Grade / Source Tier
```
Grade: A (頂尖) / B (優秀) / C (普通) / D (需加強)
Tier:  T1 (一線大廠) / T2 (知名企業) / T3 (一般公司)
```
