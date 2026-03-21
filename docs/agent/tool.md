# API 工具完整參考

> 版本：v1.0（對應 commit c65167f）
> 最後更新：2026-03-21

---

## 環境配置

| 項目 | 值 |
|------|-----|
| 後端 API | `https://api-hr.step1ne.com` |
| 認證方式 | `Authorization: Bearer <API_SECRET_KEY>` |
| Content-Type | `application/json` |
| Rate Limit | 200 requests / minute / IP |

---

## 一、候選人 API

### 基本 CRUD

| 方法 | 端點 | 說明 |
|------|------|------|
| GET | `/api/candidates` | 候選人列表（支援 limit, offset, status, source, created_today 篩選） |
| GET | `/api/candidates/:id` | 單一候選人詳情 |
| POST | `/api/candidates` | 新增候選人（同名則更新） |
| PUT | `/api/candidates/:id` | 完整更新候選人 |
| PATCH | `/api/candidates/:id` | 部分更新候選人 |
| DELETE | `/api/candidates/:id` | 刪除候選人 |

### 批量操作

| 方法 | 端點 | 說明 |
|------|------|------|
| POST | `/api/candidates/bulk` | 批量匯入（同步） |
| POST | `/api/candidates/bulk-async` | 批量匯入（非同步，回傳 import_id） |
| PATCH | `/api/candidates/batch-status` | 批量更新狀態 |
| DELETE | `/api/candidates/batch` | 批量刪除 |

### Pipeline 狀態

| 方法 | 端點 | 說明 |
|------|------|------|
| PUT | `/api/candidates/:id/pipeline-status` | 更新 Pipeline 狀態 |

**狀態值**：`未開始` → `聯繫階段` → `面試階段` → `已送件` → `已上職` / `婉拒` / `人才庫`

### 匹配與評分

| 方法 | 端點 | 說明 |
|------|------|------|
| GET | `/api/candidates/:id/match-input` | 取得候選人匹配 Profile |
| GET | `/api/candidates/:id/job-rankings` | 候選人與各職缺的匹配排名 |
| POST | `/api/candidates/:id/check-submission-rules` | 檢查送件規則 |
| POST | `/api/candidates/:id/ai-grade-suggest` | AI 評級建議（需有履歷附件） |

### 履歷管理

| 方法 | 端點 | 說明 |
|------|------|------|
| POST | `/api/candidates/:id/resume` | 上傳 PDF 履歷 |
| GET | `/api/candidates/:id/resume/:fileId` | 下載履歷（需 token 認證） |
| DELETE | `/api/candidates/:id/resume/:fileId` | 刪除履歷 |
| POST | `/api/candidates/:id/resume-parse` | 解析候選人已上傳的履歷 |
| POST | `/api/resume/parse` | 解析履歷文字 |
| POST | `/api/resume/parse-url` | 從 URL 解析履歷 |
| POST | `/api/resume/batch-parse` | 批量解析履歷 |

### AI 分析

| 方法 | 端點 | 說明 |
|------|------|------|
| POST | `/api/candidates/:id/enrich` | AI 資料充實（Perplexity） |
| POST | `/api/candidates/enrich-batch` | 批量 AI 充實 |
| POST | `/api/candidates/backfill-computed` | 回填 AI 計算欄位 |
| GET | `/api/candidates/:id/github-stats` | GitHub 分析快取 |

### 互動記錄

| 方法 | 端點 | 說明 |
|------|------|------|
| GET | `/api/candidates/:id/interactions` | 取得互動記錄 |
| POST | `/api/candidates/:id/interactions` | 新增互動記錄 |
| PATCH | `/api/interactions/:id` | 更新互動 |
| DELETE | `/api/interactions/:id` | 刪除互動 |

---

## 二、職缺 API

| 方法 | 端點 | 說明 |
|------|------|------|
| GET | `/api/jobs` | 職缺列表 |
| GET | `/api/jobs/:id` | 職缺詳情 |
| POST | `/api/jobs` | 新增職缺 |
| PUT | `/api/jobs/:id` | 更新職缺（僅更新非空欄位） |
| PATCH | `/api/jobs/:id/status` | 更新職缺狀態 |
| DELETE | `/api/jobs/:id` | 刪除職缺 |

---

## 三、客戶 API

### 基本 CRUD

| 方法 | 端點 | 說明 |
|------|------|------|
| GET | `/api/clients` | 客戶列表（支援 bd_status, consultant 篩選） |
| GET | `/api/clients/:id` | 客戶詳情 |
| POST | `/api/clients` | 新增客戶（自動偵測產業） |
| PATCH | `/api/clients/:id` | 更新客戶 |
| PATCH | `/api/clients/:id/status` | 更新 BD 狀態 |
| DELETE | `/api/clients/:id` | 刪除客戶 |

### 客戶關聯資料

| 方法 | 端點 | 說明 |
|------|------|------|
| GET | `/api/clients/:id/jobs` | 客戶的職缺 |
| GET | `/api/clients/:id/contacts` | 客戶聯絡人 |
| POST | `/api/clients/:id/contacts` | 新增聯絡人 |
| GET | `/api/clients/:id/submission-rules` | 送件規則 |
| PUT | `/api/clients/:id/submission-rules` | 更新送件規則 |

### 客戶文件

| 方法 | 端點 | 說明 |
|------|------|------|
| POST | `/api/clients/:id/documents` | 上傳客戶文件 |
| GET | `/api/clients/:id/documents/:docId` | 下載文件 |
| DELETE | `/api/clients/:id/documents/:docId` | 刪除文件 |
| POST | `/api/clients/:id/contract-files` | 上傳合約檔案 |
| GET | `/api/clients/:id/contract-files/:docId` | 下載合約 |
| DELETE | `/api/clients/:id/contract-files/:docId` | 刪除合約 |

---

## 四、GitHub 分析

| 方法 | 端點 | 說明 |
|------|------|------|
| GET | `/api/github/analyze/:username` | 分析 GitHub Profile |
| POST | `/api/github/ai-analyze` | 批量 GitHub AI 分析 |

---

## 五、用戶管理 API

| 方法 | 端點 | 說明 |
|------|------|------|
| GET | `/api/users/all` | 所有用戶列表 |
| GET | `/api/users/names` | 用戶名稱列表 |
| GET | `/api/users` | 用戶聯絡列表 |
| POST | `/api/users/login` | 用戶登入 |
| POST | `/api/users/create` | 建立新用戶 |
| POST | `/api/users/register` | 註冊新用戶 |
| PUT | `/api/users/:uid` | 更新用戶 |
| DELETE | `/api/users/:uid` | 刪除用戶 |
| GET | `/api/users/:displayName/contact` | 用戶聯絡資訊 |
| PUT | `/api/users/:displayName/contact` | 更新聯絡資訊 |
| GET | `/api/users/:displayName/site-config` | 用戶網站配置 |
| PUT | `/api/users/:displayName/site-config` | 更新網站配置 |

---

## 六、系統管理 API

### 健康檢查與日誌

| 方法 | 端點 | 說明 |
|------|------|------|
| GET | `/api/health` | 健康檢查（無需認證） |
| GET | `/api/system-logs` | 系統操作日誌 |

### 系統配置

| 方法 | 端點 | 說明 |
|------|------|------|
| GET | `/api/system-config/:key` | 取得配置值 |
| PUT | `/api/system-config/:key` | 設定配置值 |

### 通知

| 方法 | 端點 | 說明 |
|------|------|------|
| GET | `/api/notifications` | 取得通知（支援 uid 篩選） |
| POST | `/api/notifications` | 建立通知 |
| PATCH | `/api/notifications/:id/read` | 標記已讀 |
| PATCH | `/api/notifications/read-all` | 全部已讀 |

### 提示詞庫

| 方法 | 端點 | 說明 |
|------|------|------|
| GET | `/api/prompts` | 取得所有提示詞 |
| GET | `/api/prompts/:id` | 單一提示詞 |
| POST | `/api/prompts` | 新增提示詞 |
| PATCH | `/api/prompts/:id` | 更新提示詞 |
| DELETE | `/api/prompts/:id` | 刪除提示詞 |
| POST | `/api/prompts/:id/upvote` | 按讚 |
| POST | `/api/prompts/:id/pin` | 置頂 |

### 分類資料

| 方法 | 端點 | 說明 |
|------|------|------|
| GET | `/api/taxonomy/skills` | 技能分類 |
| GET | `/api/taxonomy/roles` | 角色分類 |
| GET | `/api/taxonomy/industries` | 產業分類 |

### 匯入狀態

| 方法 | 端點 | 說明 |
|------|------|------|
| GET | `/api/imports/:id` | 查詢匯入進度 |

### 指南文件

| 方法 | 端點 | 說明 |
|------|------|------|
| GET | `/api/guide` | 通用指南 |
| GET | `/api/ai-guide` | AI Agent 指南 |
| GET | `/api/consultant-sop` | 顧問 SOP |
| GET | `/api/scoring-guide` | 評分指南 |
| GET | `/api/jobs-import-guide` | 職缺匯入指南 |
| GET | `/api/resume-guide` | 履歷解析指南 |
| GET | `/api/resume-import-guide` | 履歷匯入指南 |
| GET | `/api/github-analysis-guide` | GitHub 分析指南 |
| GET | `/api/guide/clients` | 客戶操作指南 |
| GET | `/api/guide/jobs` | 職缺操作指南 |
| GET | `/api/guide/candidates` | 候選人操作指南 |
| GET | `/api/guide/talent-ops` | 人才營運指南 |
| GET | `/api/guide/resume-sop` | 履歷 SOP |

### Webhook

| 方法 | 端點 | 說明 |
|------|------|------|
| POST | `/api/webhooks/github` | GitHub Webhook 接收器（無需認證） |

---

## 七、爬蟲系統 API（需用戶授權）

> 以下 API 需要用戶明確開啟爬蟲權限才可使用

### 任務管理

| 方法 | 端點 | 說明 |
|------|------|------|
| GET | `/api/crawler/tasks` | 任務列表 |
| POST | `/api/crawler/tasks` | 建立爬蟲任務 |
| POST | `/api/crawler/tasks/:id/run` | 啟動任務 |
| GET | `/api/crawler/tasks/:id/status` | 任務狀態（輪詢用） |
| PATCH | `/api/crawler/tasks/:id` | 更新任務 |
| DELETE | `/api/crawler/tasks/:id` | 刪除任務 |

### 爬蟲候選人

| 方法 | 端點 | 說明 |
|------|------|------|
| GET | `/api/crawler/candidates` | 爬蟲候選人列表 |
| GET | `/api/crawler/candidates/:id` | 單一爬蟲候選人 |

### 匯入與推送

| 方法 | 端點 | 說明 |
|------|------|------|
| POST | `/api/crawler/import` | 匯入爬蟲候選人（同步） |
| POST | `/api/crawler/import-async` | 非同步匯入 |
| GET | `/api/crawler/import-status` | 檢查姓名是否已存在 |
| POST | `/api/crawler/fix-source` | 修正來源欄位 |

### 評分與關鍵字

| 方法 | 端點 | 說明 |
|------|------|------|
| POST | `/api/crawler/score/candidates` | 候選人評分 |
| GET | `/api/crawler/score/detail/:id` | 評分詳情 |
| POST | `/api/crawler/keywords/generate` | 自動生成搜尋關鍵字 |

### 統計指標

| 方法 | 端點 | 說明 |
|------|------|------|
| GET | `/api/crawler/stats` | 儀表板統計 |
| GET | `/api/crawler/health` | 爬蟲服務健康檢查 |
| GET | `/api/crawler/clients` | 爬蟲客戶列表 |
| GET | `/api/crawler/system/jobs` | 系統職缺（從爬蟲取） |
| POST | `/api/crawler/metrics/snapshot` | 指標快照 |
| GET | `/api/crawler/metrics/history` | 歷史指標 |
| GET | `/api/crawler/metrics/efficiency` | 即時 KPI |

### 快取管理

| 方法 | 端點 | 說明 |
|------|------|------|
| GET | `/api/crawler/config` | 爬蟲 URL 配置 |
| POST | `/api/crawler/config` | 設定爬蟲 URL |
| POST | `/api/crawler/sheet-cache/clear` | 清除 Sheets 快取 |

---

## 八、常用操作範例

### 查詢所有候選人

```bash
curl -H "Authorization: Bearer <KEY>" \
  'https://api-hr.step1ne.com/api/candidates?limit=2000'
```

### 新增候選人

```bash
curl -X POST -H "Authorization: Bearer <KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "王小明",
    "position": "Frontend Engineer",
    "email": "wang@example.com",
    "skills": "React, TypeScript, Node.js",
    "recruiter": "Jacky",
    "status": "未開始"
  }' \
  https://api-hr.step1ne.com/api/candidates
```

### 更新 Pipeline 狀態

```bash
curl -X PUT -H "Authorization: Bearer <KEY>" \
  -H "Content-Type: application/json" \
  -d '{"status": "面試階段", "note": "已安排 3/25 一面"}' \
  https://api-hr.step1ne.com/api/candidates/123/pipeline-status
```

### 新增職缺

```bash
curl -X POST -H "Authorization: Bearer <KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "position_name": "Senior Backend Engineer",
    "client_company": "ABC Corp",
    "key_skills": "Go, Kubernetes, PostgreSQL",
    "salary_range": "80-120K",
    "job_status": "招募中"
  }' \
  https://api-hr.step1ne.com/api/jobs
```

### 新增互動記錄

```bash
curl -X POST -H "Authorization: Bearer <KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "phone_call",
    "content": "電話聯繫，候選人對職缺有興趣，已安排面試",
    "actor": "Jacky"
  }' \
  https://api-hr.step1ne.com/api/candidates/123/interactions
```

### AI 評級建議

```bash
curl -X POST -H "Authorization: Bearer <KEY>" \
  -H "Content-Type: application/json" \
  https://api-hr.step1ne.com/api/candidates/123/ai-grade-suggest
```

### 健康檢查

```bash
curl 'https://api-hr.step1ne.com/api/health'
```

---

## 九、候選人欄位參考

| 欄位 | 類型 | 說明 |
|------|------|------|
| `name` | string | 姓名 |
| `position` | string | 現職職稱 |
| `email` | string | Email |
| `phone` | string | 電話 |
| `skills` | string | 技能（逗號分隔） |
| `recruiter` | string | 負責顧問 |
| `status` | string | Pipeline 狀態 |
| `talent_level` | string | 等級（S/A+/A/B/C/D） |
| `years_experience` | string | 年資 |
| `current_position` | string | 現職 |
| `location` | string | 地點 |
| `education` | string | 學歷 |
| `linkedin_url` | string | LinkedIn URL |
| `github_url` | string | GitHub URL |
| `notes` | string | 備註 |
| `stability_score` | string | 穩定度分數 |
| `avg_tenure_months` | string | 平均任期（月） |
| `job_changes` | string | 換工作次數 |
| `leaving_reason` | string | 離職原因 |
| `work_history` | JSON | 工作經歷 |
| `education_details` | JSON | 教育背景 |
| `source` | string | 來源（手動/爬蟲匯入/AI推薦） |
| `target_job_id` | number | 目標職缺 ID |
| `personality_type` | string | 人格特質 |
