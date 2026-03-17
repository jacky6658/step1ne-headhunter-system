# Step1ne AI 操作手冊 — 統一入口

> **版本**：v1.1｜**更新日期**：2026-03-16
> **用途**：AI Agent 啟動後首先讀取此頁，依需求載入對應模組手冊

---

## ⚠️ 系統架構（2026-03 更新）

Step1ne 獵頭系統目前 **架設在公司本地**，同時保留雲端部署。系統有三個存取入口：

| 環境 | API Base URL | 說明 |
|------|-------------|------|
| 🏢 **公司內網** | `http://localhost:3003` | 本地直連，最快 |
| 🌐 **外部存取** | `https://api-hr.step1ne.com` | 透過 Cloudflare Tunnel，外部 AI / 手機可用 |

> **🔑 如何判斷用哪個 Base URL？**
> - 你能直接 `curl http://localhost:3003/api/health` 成功 → 用 `http://localhost:3003`
> - 不行的話 → 用 `https://api-hr.step1ne.com`

> **前端網址**：`https://hrsystem.step1ne.com`（外部）/ `http://localhost:3002`（內網）

---

## 快速導航

| 模組 | API 端點 | 說明 | 端點數 |
|------|---------|------|--------|
| 📋 **客戶模組** | `GET /api/guide/clients` | BD 客戶卡片 CRUD、聯絡紀錄、送件規範 | 11 |
| 💼 **職缺模組** | `GET /api/guide/jobs` | 職缺卡片 CRUD、104/1111 匯入 | 6 |
| 👤 **人選模組** | `GET /api/guide/candidates` | 人選匯入、更新、工作經歷、學歷、批次操作 | 11 |
| 🤖 **人才AI模組** | `GET /api/guide/talent-ops` | AI 評分、履歷解析、GitHub 分析、OpenClaw | 19 |
| 📄 **履歷處理SOP** | `GET /api/guide/resume-sop` | 收到履歷後的 6 步驟標準作業流程 | — |

**共 47 個 API 端點**

---

## 認證方式

> **⚠️ 重要**：所有 API 端點（除了 `/api/health` 和 `/api/guide*`）都需要認證！

### 一般端點
```
Authorization: Bearer {API_SECRET_KEY}
Content-Type: application/json
```

### OpenClaw 端點（僅 `/api/openclaw/*`）
```
X-OpenClaw-Key: {OPENCLAW_API_KEY}
```

### 不需認證的端點
- `GET /api/health` — 系統健康檢查
- `GET /api/guide*` — AI 操作手冊（本文件及所有模組手冊）

---

## 使用指南

### 1. 新增客戶 + 開職缺
```
→ 讀取客戶模組：GET /api/guide/clients
→ 讀取職缺模組：GET /api/guide/jobs
```

### 2. 匯入人選（含工作經歷、學歷、AI 總結）
```
→ 讀取人選模組：GET /api/guide/candidates
```

### 3. AI 分析（評分、履歷解析、GitHub、匹配）
```
→ 讀取人才AI模組：GET /api/guide/talent-ops
```

### 4. 完整流程（從客戶開發到人選推薦）
```
→ 依序讀取全部 4 個模組
```

---

## 🗄️ 直連 PostgreSQL（進階 — SQL 操作）

系統架設在本地，AI Agent 可以直接連線 PostgreSQL 進行查詢或批次更新，適合大量資料操作或 API 無法滿足的複雜查詢。

### 連線資訊

| 項目 | 值 |
|------|-----|
| **Host** | `localhost` |
| **Port** | `5432` |
| **Database** | `step1ne` |
| **User** | `step1ne` |
| **Password** | （無，本地免密碼） |
| **連線字串** | `postgresql://step1ne@localhost:5432/step1ne` |

### 連線指令

```bash
# psql 直連
psql -h localhost -U step1ne -d step1ne

# 或使用連線字串
psql postgresql://step1ne@localhost:5432/step1ne
```

### 主要資料表

| 資料表 | 用途 | 筆數（參考） |
|--------|------|-------------|
| `candidates_pipeline` | 🔴 **核心** — 人選資料（88 欄位） | ~1,559 |
| `jobs_pipeline` | 🔴 **核心** — 職缺資料（48 欄位） | ~50 |
| `clients` | 🔴 **核心** — BD 客戶（22 欄位） | ~48 |
| `bd_contacts` | BD 聯絡紀錄 | — |
| `interactions` | 互動紀錄 | — |
| `prompt_library` | Prompt 範本庫 | ~27 |
| `system_logs` | 系統操作日誌 | ~14,000 |
| `notifications` | 系統通知 | ~99 |
| `bot_config` | AIbot 設定 | — |
| `import_queue` | 匯入佇列（非同步） | — |

### 常用 SQL 範例

```sql
-- 查詢人選（含職位、公司、LinkedIn）
SELECT id, name, current_position, current_title, current_company,
       linkedin_url, skills, talent_level, status, recruiter
FROM candidates_pipeline
WHERE status != '淘汰'
ORDER BY updated_at DESC
LIMIT 20;

-- 更新人選的職位與公司
UPDATE candidates_pipeline
SET current_title = 'Senior Engineer',
    current_company = 'Google',
    updated_at = NOW()
WHERE id = 69;

-- 批次更新多位人選的 LinkedIn
UPDATE candidates_pipeline
SET linkedin_url = 'https://linkedin.com/in/xxx'
WHERE id IN (69, 72, 93);

-- 查詢職缺
SELECT id, position_name, client_company, status, salary_range
FROM jobs_pipeline
WHERE status = '招募中';

-- 查詢客戶
SELECT id, company_name, industry, bd_status, bd_owner
FROM clients
ORDER BY updated_at DESC;

-- 人選搜尋（技能 + 地區）
SELECT id, name, current_title, current_company, skills, location
FROM candidates_pipeline
WHERE skills ILIKE '%Python%'
  AND location ILIKE '%台北%';
```

### ⚠️ SQL 操作注意事項

1. **優先用 API**：一般 CRUD 建議走 API（`/api/candidates`），API 會自動觸發日誌記錄、技能正規化、資料品質計算等
2. **SQL 適用場景**：大量資料查詢、批次更新、複雜 JOIN、報表統計
3. **更新時務必加 `updated_at = NOW()`**：否則前端不會偵測到變更
4. **不要直接 DELETE**：刪除請透過 API 或先改 `status = '淘汰'`
5. **JSONB 欄位**：`work_history`、`education_details`、`ai_match_result`、`normalized_skills` 等是 JSONB 格式，查詢時用 `->>`、`@>` 等 PostgreSQL JSON 運算子

---

## 核心注意事項

1. **POST vs PATCH**：POST `/api/candidates` 不會覆蓋已有資料（只補空欄），要強制更新請用 PATCH
2. **欄位命名**：API 同時接受 snake_case 和 camelCase，建議統一用 **snake_case**
3. **GET 回傳格式**：GET API 同時回傳 snake_case 和 camelCase 兩種欄位名（例如 `current_position` 和 `position` 都有），讀取時用 snake_case 即可
4. **work_history 格式**：JSON 陣列，每筆含 company、title、start、end、description
5. **API_SECRET_KEY = VITE_API_KEY**：前後端認證密鑰必須一致
6. **本地部署**：系統主要運行在公司本地 Mac 上，PostgreSQL、Node.js Backend、Vite Frontend 均在本機

---

## 系統狀態檢查

```
GET /api/health  → 確認系統正常（不需認證）
```

回應：`{ "status": "ok", "database": "connected" }`

---

## 舊版手冊（仍可使用，但建議改用上方模組化手冊）

| 端點 | 說明 |
|------|------|
| `GET /api/guide` | 舊版完整手冊（1,852 行，較長） |
| `GET /api/scoring-guide` | OpenClaw 評分指南 |
| `GET /api/jobs-import-guide` | 職缺匯入指南 |
| `GET /api/resume-guide` | 履歷分析指南 |
| `GET /api/resume-import-guide` | 履歷匯入指南 |
| `GET /api/github-analysis-guide` | GitHub 分析指南 |
| `GET /api/consultant-sop` | 顧問 SOP 手冊 |
