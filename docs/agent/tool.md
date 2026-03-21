# API 工具完整參考

> 版本：v2.1（對應 commit 2918502）
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
| GET | `/api/candidates` | 候選人列表（支援 limit, offset, status, source, created_today） |
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
| POST | `/api/candidates/:id/check-submission-rules` | 檢查送件規則（三層篩選） |
| POST | `/api/candidates/:id/ai-grade-suggest` | AI 評級建議（需有履歷附件） |

### 履歷管理

| 方法 | 端點 | 說明 |
|------|------|------|
| POST | `/api/candidates/:id/resume` | 上傳 PDF 履歷 |
| GET | `/api/candidates/:id/resume/:fileId` | 下載履歷（需 token） |
| DELETE | `/api/candidates/:id/resume/:fileId` | 刪除履歷 |
| POST | `/api/candidates/:id/resume-parse` | 解析已上傳的履歷 |
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
| POST | `/api/jobs` | 新增職缺（回傳 missing_fields 提醒） |
| PUT | `/api/jobs/:id` | 更新職缺（僅更新非空欄位） |
| PATCH | `/api/jobs/:id/status` | 更新職缺狀態 |
| DELETE | `/api/jobs/:id` | 刪除職缺 |

---

## 三、客戶 API

### 基本 CRUD

| 方法 | 端點 | 說明 |
|------|------|------|
| GET | `/api/clients` | 客戶列表（支援 bd_status, consultant） |
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
| POST | `/api/clients/:id/contract-files` | 上傳合約 |
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
| GET | `/api/notifications` | 取得通知（支援 uid） |
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

> 以下 API 需要主人明確開啟爬蟲權限才可使用

**呼叫方式有兩種**：
1. **透過獵頭系統轉發**（推薦）：`https://api-hr.step1ne.com/api/crawler/...`
2. **直接呼叫爬蟲系統**：`https://crawler.step1ne.com/api/...`（閉環提示詞使用此方式）

兩者功能相同，差異在於路徑前綴。下方端點以方式 1 為準。

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
| GET | `/api/crawler/system/jobs` | 系統職缺 |
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

## 八、候選人欄位參考

### 🔴 匯入必填欄位

以下欄位在新增候選人時**必須填寫**，缺少任一項龍蝦應提醒補填：

| 欄位 | 類型 | 說明 |
|------|------|------|
| `name` | string | 姓名（必填） |
| `current_title` | string | 現職職稱（必填）。API 別名：`position`、`current_position` 皆可 |
| `current_company` | string | 現職公司（必填） |
| `skills` | string | 技能，逗號分隔（必填） |
| `years_experience` | string | 年資（必填） |
| `work_history` | JSON | 工作經歷陣列（必填） |
| `education_details` | JSON | 教育背景陣列（必填） |
| `linkedin_url` 或 `github_url` | string | 至少一個外部連結（必填擇一） |
| `recruiter` | string | 負責顧問（必填，自動帶入主人名稱） |
| `status` | string | Pipeline 狀態（必填，預設「未開始」） |
| `source` | string | 來源（必填：手動 / 爬蟲匯入 / AI推薦） |

### 履歷附件

| 欄位 | 類型 | 說明 |
|------|------|------|
| `resume_files` | JSON | 履歷附件清單（PDF 上傳後自動填入） |
| `resume_assets` | JSON | 履歷資產（結構化履歷資料） |

> **重要**：匯入後應盡快上傳 PDF 履歷（`POST /api/candidates/:id/resume`），AI 評級需要有履歷附件。

### 核心匹配欄位（AI 解析自動填入）

| 欄位 | 類型 | 說明 |
|------|------|------|
| `role_family` | string | 角色家族（如 Backend, Frontend, DevOps） |
| `canonical_role` | string | 標準化職稱 |
| `seniority_level` | string | 資歷等級（Junior/Mid/Senior/Lead/Manager） |
| `total_years` | numeric | 總年資（數值） |
| `industry_tag` | string | 產業標籤 |
| `normalized_skills` | JSON | 標準化技能清單 |
| `skill_evidence` | JSON | 技能證據（來自哪段經歷） |
| `education_level` | string | 學歷等級 |
| `education_summary` | text | 教育摘要 |
| `grade_level` | string | 年級等級 |
| `source_tier` | string | 來源等級 |
| `heat_level` | string | 熱度等級 |
| `precision_eligible` | boolean | 是否符合精準配對資格 |
| `data_quality` | JSON | 資料品質評分 |

### 職稱欄位對照

| 欄位 | 類型 | 說明 |
|------|------|------|
| `current_position` | string | 現職職稱（舊欄位，DB 原始欄位名） |
| `current_title` | string | 標準化職稱（新欄位，履歷解析後自動填入） |
| `position` | — | API 別名，寫入時對應 `current_position` |

> 三者互通。查詢時以 `current_title` 優先，若為空則回退到 `current_position`。

### 聯繫與個人資訊

| 欄位 | 類型 | 說明 |
|------|------|------|
| `email` | string | Email |
| `phone` | string | 電話 |
| `contact_link` | string | 聯繫連結 |
| `location` | string | 所在地 |
| `age` | integer | 年齡 |
| `birthday` | date | 生日 |
| `gender` | text | 性別 |
| `english_name` | text | 英文名 |
| `linkedin_url` | string | LinkedIn URL |
| `github_url` | string | GitHub URL |
| `portfolio_url` | string | 作品集連結 |

### 職涯穩定度

| 欄位 | 類型 | 說明 |
|------|------|------|
| `stability_score` | string | 穩定度分數 |
| `avg_tenure_months` | string | 平均每段工作任期（月） |
| `job_changes` | string | 換工作次數 |
| `recent_gap_months` | string | 最近空窗期（月） |
| `leaving_reason` | text | 離職原因 |
| `reason_for_change` | text | 轉職原因 |

### 求職意願

| 欄位 | 類型 | 說明 |
|------|------|------|
| `job_search_status` | string | 求職狀態（積極/被動/不看） |
| `job_search_status_enum` | string | 標準化求職狀態 |
| `motivation` | string | 求職動機 |
| `deal_breakers` | text | 絕對不接受的條件 |
| `competing_offers` | text | 手上的競爭 Offer |
| `notice_period` | string | 到職所需時間 |
| `notice_period_enum` | string | 標準化到職時間 |

### 薪資

| 欄位 | 類型 | 說明 |
|------|------|------|
| `current_salary` | string | 現在薪資（文字） |
| `expected_salary` | string | 期望薪資（文字） |
| `current_salary_min` | integer | 現在薪資下限 |
| `current_salary_max` | integer | 現在薪資上限 |
| `expected_salary_min` | integer | 期望薪資下限 |
| `expected_salary_max` | integer | 期望薪資上限 |
| `salary_currency` | string | 薪資幣別 |
| `salary_period` | string | 薪資週期（月薪/年薪） |

### AI 分析結果

| 欄位 | 類型 | 說明 |
|------|------|------|
| `ai_score` | integer | AI 評分 |
| `ai_grade` | string | AI 評級（S/A+/A/B/C/D） |
| `ai_report` | text | AI 分析報告 |
| `ai_recommendation` | string | AI 推薦意見 |
| `ai_match_result` | JSON | AI 配對結果 |
| `ai_summary` | JSON | AI 摘要 |
| `ai_analysis` | JSON | AI 完整分析 |
| `github_analysis_cache` | JSON | GitHub 分析快取 |

### 顧問評估

| 欄位 | 類型 | 說明 |
|------|------|------|
| `talent_level` | string | 顧問評定等級（S/A+/A/B/C/D） |
| `consultant_evaluation` | JSON | 顧問結構化評估 |
| `consultant_note` | text | 顧問備註（⚠️ 含特殊條件如年齡限制、簽證要求） |
| `relationship_level` | string | 與候選人關係深度 |
| `personality_type` | string | 人格特質 |
| `biography` | text | 人物小傳 |

### 其他

| 欄位 | 類型 | 說明 |
|------|------|------|
| `target_job_id` | integer | 目標職缺 ID |
| `interview_round` | integer | 目前面試輪數 |
| `industry` | string | 產業 |
| `languages` | string | 語言能力 |
| `certifications` | text | 證照 |
| `management_experience` | boolean | 是否有管理經驗 |
| `team_size` | string | 管理團隊規模 |
| `progress_tracking` | JSON | 狀態流轉追蹤記錄 |
| `notes` | text | 一般備註 |
| `voice_assessments` | JSON | 語音評估 |
| `outreach_letters` | JSON | 開發信記錄 |
| `auto_derived` | JSON | 自動衍生欄位 |

---

## 九、職缺欄位參考

### 🔴 必填欄位

| 欄位 | 類型 | 說明 |
|------|------|------|
| `position_name` | string | 職缺名稱（必填） |
| `client_company` | string | 客戶公司（必填） |
| `job_description` | text | 職缺描述 / JD（必填） |
| `key_skills` | text | 核心技能（必填） |
| `experience_required` | string | 經驗要求（必填） |
| `job_status` | string | 職缺狀態（必填） |

### 🔴 三層篩選必填欄位

| 欄位 | 類型 | 用於 | 說明 |
|------|------|------|------|
| `rejection_criteria` | text | A 層 | 淘汰條件 — 符合任一條即淘汰（必填） |
| `exclusion_keywords` | text | A 層 | 排除關鍵字（必填） |
| `title_variants` | text | A 層 | 可接受的職稱變體（必填） |
| `submission_criteria` | text | B 層 | 客戶送人條件 — 偏好但不硬性（必填） |
| `talent_profile` | text | C 層 | 人才畫像 — 含加分項目（必填） |

### 薪資

| 欄位 | 類型 | 說明 |
|------|------|------|
| `salary_range` | string | 薪資帶（文字描述） |
| `salary_min` | integer | 薪資下限 |
| `salary_max` | integer | 薪資上限 |

### 面試流程

| 欄位 | 類型 | 說明 |
|------|------|------|
| `interview_stages` | integer | 面試輪數 |
| `interview_stage_detail` | text | 各輪面試說明 |
| `interview_process` | text | 面試流程描述 |

### 職缺詳細

| 欄位 | 類型 | 說明 |
|------|------|------|
| `department` | string | 部門 |
| `open_positions` | string | 開放人數 |
| `education_required` | string | 學歷要求 |
| `language_required` | string | 語言要求 |
| `location` | string | 工作地點 |
| `special_conditions` | text | 特殊條件 |
| `industry_background` | string | 產業背景要求 |
| `team_size` | string | 團隊規模 |
| `key_challenges` | text | 關鍵挑戰 |
| `attractive_points` | text | 職缺吸引力 |
| `recruitment_difficulty` | text | 招募難度 |
| `consultant_notes` | text | 顧問備註（⚠️ 含特殊條件） |
| `priority` | string | 優先度 |
| `marketing_description` | text | 行銷描述 |

### 公司資訊

| 欄位 | 類型 | 說明 |
|------|------|------|
| `company_profile` | text | 公司介紹/企業畫像 |
| `client_id` | integer | 關聯客戶 ID |

### 搜尋與爬蟲

| 欄位 | 類型 | 說明 |
|------|------|------|
| `target_companies` | text | 目標挖角公司 |
| `search_primary` | text | 主要搜尋關鍵字 |
| `search_secondary` | text | 次要搜尋關鍵字 |

### 福利與工時

| 欄位 | 類型 | 說明 |
|------|------|------|
| `welfare_tags` | text | 福利標籤 |
| `welfare_detail` | text | 福利詳情 |
| `work_hours` | text | 工時 |
| `vacation_policy` | text | 假期制度 |
| `remote_work` | text | 遠端工作政策 |
| `business_trip` | text | 出差需求 |
| `job_url` | text | 職缺連結 |

---

## 十、常用操作範例

### 查詢所有候選人

```bash
curl -H "Authorization: Bearer <KEY>" \
  'https://api-hr.step1ne.com/api/candidates?limit=2000'
```

### 新增候選人（含必填欄位）

```bash
curl -X POST -H "Authorization: Bearer <KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "王小明",
    "current_title": "Senior Backend Engineer",
    "current_company": "ABC Corp",
    "skills": "Java, Spring Boot, PostgreSQL, Docker",
    "years_experience": "5",
    "linkedin_url": "https://linkedin.com/in/wangxiaoming",
    "recruiter": "Jacky",
    "status": "未開始",
    "source": "手動",
    "education": "碩士",
    "work_history": [
      {"title": "Senior Backend Engineer", "company": "ABC Corp", "duration": "2023/01 - 至今", "years": 2.2},
      {"title": "Backend Engineer", "company": "XYZ Ltd", "duration": "2020/03 - 2022/12", "years": 2.8}
    ],
    "education_details": [
      {"school": "台灣大學", "degree": "碩士", "major": "資訊工程", "year": "2020"}
    ]
  }' \
  https://api-hr.step1ne.com/api/candidates
```

### 新增職缺（含三層篩選必填）

```bash
curl -X POST -H "Authorization: Bearer <KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "position_name": "Senior Java Developer",
    "client_company": "一通數位",
    "job_description": "負責核心金融交易系統開發...",
    "key_skills": "Java, Spring Boot, PostgreSQL, Redis, Kafka",
    "experience_required": "3 年以上 Java 後端開發經驗",
    "education_required": "大學以上",
    "job_status": "招募中",
    "salary_min": 60000,
    "salary_max": 100000,
    "rejection_criteria": "不符合以下任一條件即不送：\n1. 無 Java 開發經驗\n2. 經驗未滿 3 年\n3. 無法接受台北市上班",
    "exclusion_keywords": "實習生, 兼職, iOS, Android",
    "title_variants": "Java Developer, Backend Engineer, Software Engineer, 後端工程師, 軟體工程師",
    "submission_criteria": "【必要條件（全部需符合）】\n1. 年資：3 年以上 Java 後端\n2. 必備技能：Java, Spring Boot\n3. 工作地點：台北市",
    "talent_profile": "【理想人才畫像】\n• 熟悉金融科技領域\n• 有高流量系統經驗\n• 具備微服務架構設計能力\n\n【加分條件】\n• Docker/Kubernetes 容器化經驗\n• Redis/Kafka 訊息佇列經驗\n• 有帶領 2-3 人小組經驗\n• 金融相關證照"
  }' \
  https://api-hr.step1ne.com/api/jobs
```

### 更新 Pipeline 狀態

```bash
curl -X PUT -H "Authorization: Bearer <KEY>" \
  -H "Content-Type: application/json" \
  -d '{"status": "面試階段", "note": "已安排 3/25 一面"}' \
  https://api-hr.step1ne.com/api/candidates/123/pipeline-status
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

### 三層篩選檢查

```bash
curl -X POST -H "Authorization: Bearer <KEY>" \
  -H "Content-Type: application/json" \
  https://api-hr.step1ne.com/api/candidates/123/check-submission-rules
```

### AI 評級建議

```bash
curl -X POST -H "Authorization: Bearer <KEY>" \
  https://api-hr.step1ne.com/api/candidates/123/ai-grade-suggest
```

### 健康檢查

```bash
curl 'https://api-hr.step1ne.com/api/health'
```

---

## work_history 格式

```json
[
  {
    "title": "Senior Backend Engineer",
    "company": "ABC Corp",
    "duration": "2023/01 - 至今",
    "years": 2.2,
    "description": "負責核心交易系統開發與維護"
  },
  {
    "title": "Backend Engineer",
    "company": "XYZ Ltd",
    "duration": "2020/03 - 2022/12",
    "years": 2.8,
    "description": "開發 RESTful API 與微服務"
  }
]
```

## education_details 格式

```json
[
  {
    "school": "台灣大學",
    "degree": "碩士",
    "major": "資訊工程",
    "year": "2020"
  }
]
```
