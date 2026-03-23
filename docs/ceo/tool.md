# 執行長 AI — 稽核用 API 參考

> 版本：v1.0（對應 commit b88503b）
> 最後更新：2026-03-22

---

## 環境配置

| 項目 | 值 |
|------|-----|
| 後端 API | `https://api-hr.step1ne.com` |
| 認證方式 | `Authorization: Bearer <API_SECRET_KEY>` |
| Content-Type | `application/json` |

---

## 你的 API 使用原則

你主要是**讀取**資料來稽核，不是寫入。

| 動作 | 是否允許 | 說明 |
|------|---------|------|
| GET（查詢） | ✅ 完全允許 | 這是你的主要工作 |
| POST/PUT/PATCH（寫入） | ⚠️ 需老闆授權 | 老闆說可以才能寫 |
| DELETE（刪除） | ❌ 禁止 | 任何情況都不刪資料 |

---

## 一、稽核常用查詢

### 取得全部候選人（稽核用）

```bash
GET /api/candidates?limit=2000
```

返回所有候選人，用於：
- 統計 Pipeline 分佈
- 檢查資料品質
- 找出卡關候選人

### 取得單一候選人詳情（驗證用）

```bash
GET /api/candidates/:id
```

返回完整欄位，用於：
- 驗證必填欄位是否齊全
- 比對 work_history 與 years_experience 是否一致
- 檢查三層篩選結果

### 下載候選人履歷 PDF（驗證用）

```bash
GET /api/candidates/:id/resume/:fileId?token=<API_KEY>
```

下載 PDF 履歷，用於：
- 驗證候選人資料與履歷內容是否一致
- 確認龍蝦的評級依據是否正確

> `resume_files` 欄位中可取得 `fileId`。

### 取得全部職缺

```bash
GET /api/jobs
```

返回所有職缺，用於：
- 檢查三層篩選欄位是否齊全
- 確認 JD、人才畫像完整度

### 取得單一職缺詳情

```bash
GET /api/jobs/:id
```

返回完整欄位，用於：
- 驗證候選人-職缺匹配時，取得職缺的三層條件

### 取得候選人互動記錄

```bash
GET /api/candidates/:id/interactions
```

用於：
- 確認狀態變更時有沒有記錄互動
- 追蹤龍蝦的聯繫頻率

### 取得系統操作日誌

```bash
GET /api/system-logs
```

用於：
- 追蹤龍蝦的所有系統操作
- 確認任務完成時間
- 發現異常操作

### 取得候選人匹配結果

```bash
GET /api/candidates/:id/job-rankings
```

用於：
- 驗證龍蝦的配對推薦是否合理
- 比對匹配排名與實際條件

### 取得候選人匹配 Profile

```bash
GET /api/candidates/:id/match-input
```

用於：
- 查看候選人被標準化後的匹配資料
- 驗證核心匹配欄位是否完整

---

## 二、完整 API 端點清單

以下是你可以使用的所有 API（以 GET 為主）。

### 候選人

| 方法 | 端點 | 稽核用途 |
|------|------|---------|
| GET | `/api/candidates` | 全量查詢，統計分析 |
| GET | `/api/candidates/:id` | 個別驗證 |
| GET | `/api/candidates/:id/interactions` | 互動記錄檢查 |
| GET | `/api/candidates/:id/job-rankings` | 匹配排名驗證 |
| GET | `/api/candidates/:id/match-input` | 匹配 Profile 檢查 |
| GET | `/api/candidates/:id/resume/:fileId` | 履歷 PDF 下載驗證 |
| GET | `/api/candidates/:id/github-stats` | GitHub 分析結果 |

### 職缺

| 方法 | 端點 | 稽核用途 |
|------|------|---------|
| GET | `/api/jobs` | 全量查詢，欄位完整度檢查 |
| GET | `/api/jobs/:id` | 個別職缺詳情，三層條件取得 |

### 客戶

| 方法 | 端點 | 稽核用途 |
|------|------|---------|
| GET | `/api/clients` | 客戶列表，BD 狀態追蹤 |
| GET | `/api/clients/:id` | 客戶詳情 |
| GET | `/api/clients/:id/jobs` | 客戶的職缺清單 |
| GET | `/api/clients/:id/contacts` | 客戶聯絡人 |
| GET | `/api/clients/:id/submission-rules` | 送件規則 |

### 用戶

| 方法 | 端點 | 稽核用途 |
|------|------|---------|
| GET | `/api/users/all` | 用戶列表 |
| GET | `/api/users/names` | 顧問名稱（用於篩選） |

### 系統

| 方法 | 端點 | 稽核用途 |
|------|------|---------|
| GET | `/api/health` | 系統健康檢查 |
| GET | `/api/system-logs` | 操作日誌（核心稽核資料） |
| GET | `/api/notifications` | 系統通知 |
| GET | `/api/system-config/:key` | 系統配置 |
| GET | `/api/imports/:id` | 匯入進度 |

### 分類資料

| 方法 | 端點 | 稽核用途 |
|------|------|---------|
| GET | `/api/taxonomy/skills` | 技能分類（驗證技能標準化） |
| GET | `/api/taxonomy/roles` | 角色分類 |
| GET | `/api/taxonomy/industries` | 產業分類 |

---

## 三、稽核查詢範例

### 找出必填欄位為空的候選人

```
1. GET /api/candidates?limit=2000
2. 遍歷每位候選人，檢查：
   - name 為空？
   - current_title 和 current_position 都為空？
   - current_company 為空？
   - skills 為空？
   - years_experience 為空？
   - work_history 為 null 或空陣列？
   - education_details 為 null？
   - linkedin_url 和 github_url 都為空？
3. 輸出缺失清單
```

### 找出三層篩選欄位為空的職缺

```
1. GET /api/jobs
2. 遍歷每個職缺，檢查：
   - rejection_criteria 為空？
   - submission_criteria 為空？
   - talent_profile 為空或 < 100 字？
   - exclusion_keywords 為空？
   - title_variants 為空？
   - job_description 為空？
3. 輸出缺失清單
```

### 找出卡關候選人

```
1. GET /api/candidates?limit=2000
2. 取得當前時間
3. 遍歷，計算每位候選人的 updated_at 距今天數：
   - status === "聯繫階段" && 天數 > 14 → 卡關預警
   - status === "面試階段" && 天數 > 7 → 面試超時
   - status === "已送件" && 天數 > 5 → 送件無回音
   - status === "未開始" && 天數 > 7 → 新人未聯繫
   - status === "人才庫" && 天數 > 90 → 沉睡人才
4. 輸出預警清單
```

### 驗證候選人-職缺匹配

```
1. GET /api/candidates/:id → 取得候選人完整資料
2. GET /api/jobs/:target_job_id → 取得目標職缺
3. 如有 resume_files → GET /api/candidates/:id/resume/:fileId 下載 PDF
4. A 層驗證：
   a. work_history 各段 years 加總 ≥ experience_required？
   b. skills vs key_skills 交集？
   c. education_level vs education_required？
   d. current_title / work_history titles vs title_variants？
   e. 全文掃描 vs exclusion_keywords？
   f. consultant_notes 中的特殊條件？
5. B 層驗證：逐條比對 submission_criteria
6. C 層驗證：比對 talent_profile 加分項
7. 輸出驗證報告（含是否同意龍蝦的評級）
```

### 生成顧問績效統計

```
1. GET /api/candidates?limit=2000
2. 按 recruiter 分組
3. 每位顧問統計：
   - 負責候選人總數
   - 各狀態分佈（未開始/聯繫/面試/送件/上職/婉拒/人才庫）
   - 本週新增數
   - 本週狀態推進數
   - 上職數 / 送件數 = 成交率
4. 輸出績效表
```

---

## 四、候選人必填欄位速查

| 欄位 | 說明 | 嚴重度 |
|------|------|--------|
| `name` | 姓名 | 🔴 |
| `current_title` 或 `current_position` | 現職職稱 | 🔴 |
| `current_company` | 現職公司 | 🔴 |
| `skills` | 技能 | 🔴 |
| `years_experience` | 年資 | 🔴 |
| `work_history` | 工作經歷（JSON） | 🔴 |
| `education_details` | 教育背景（JSON） | 🟡 |
| `linkedin_url` 或 `github_url` | 外部連結擇一 | 🟡 |
| `recruiter` | 負責顧問 | 🟡 |
| `resume_files` | 履歷附件 | 🟡 |
| `current_salary` / `expected_salary` | 薪資資訊 | 🔵 |
| `job_search_status` | 求職狀態 | 🔵 |
| `notice_period` | 到職時間 | 🔵 |

---

## 五、職缺必填欄位速查

| 欄位 | 說明 | 嚴重度 |
|------|------|--------|
| `position_name` | 職缺名稱 | 🔴 |
| `client_company` | 客戶公司 | 🔴 |
| `job_description` | JD 描述 | 🔴 |
| `key_skills` | 核心技能 | 🔴 |
| `rejection_criteria` | 淘汰條件（A 層） | 🔴 |
| `submission_criteria` | 送人條件（B 層） | 🔴 |
| `talent_profile` | 人才畫像（C 層）| 🔴 |
| `exclusion_keywords` | 排除關鍵字（A 層） | 🟡 |
| `title_variants` | 職稱變體（A 層） | 🟡 |
| `experience_required` | 經驗要求 | 🟡 |
| `salary_min` / `salary_max` | 薪資帶 | 🟡 |
| `interview_stages` | 面試輪數 | 🟡 |
| `education_required` | 學歷要求 | 🔵 |
| `language_required` | 語言要求 | 🔵 |

---

## 六、老闆授權後可用的寫入 API

以下 API **僅在老闆明確授權後**才能使用：

| 方法 | 端點 | 用途 |
|------|------|------|
| PATCH | `/api/candidates/:id` | 補填缺失欄位 |
| PUT | `/api/jobs/:id` | 補填職缺欄位 |
| POST | `/api/candidates/:id/interactions` | 標記稽核結果 |
| POST | `/api/notifications` | 發送通知給顧問 |

> **絕對禁止使用 DELETE。** 任何刪除操作都需要老闆親自處理。
