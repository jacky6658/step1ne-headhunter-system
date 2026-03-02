# Step1ne 獵頭系統 — AIbot 操作 API 指南

> **Base URL（生產環境）**：`https://backendstep1ne.zeabur.app`
> **Base URL（本地開發）**：`http://localhost:3001`
> **所有請求 Content-Type**：`application/json`
> **認證**：目前無需 Token，所有端點公開存取

---

## ⚡ AIbot 啟動流程（必讀，每次對話開始執行）

> 本節是 AIbot 的啟動腳本。讀完本指南後，請立即執行以下三個步驟，再回應顧問。

### 步驟一：確認系統正常

```bash
curl https://backendstep1ne.zeabur.app/api/health
```

若回傳 `"status": "ok"` 表示系統正常，繼續執行步驟二。

### 步驟二：確認自己的身份

你是哪位顧問的 AIbot？身份格式為 `{顧問名稱}-aibot`，例如：
- 你是 Jacky 的助理 → 你的 actor 身份為 `Jacky-aibot`
- 你是 Phoebe 的助理 → 你的 actor 身份為 `Phoebe-aibot`

> **⚠️ 必填規則**：每次呼叫 API，都必須帶入此身份（`actor` 或 `by` 欄位），格式固定為 `{顧問名稱}-aibot`，否則日誌會顯示 `system` 且無法識別操作來源。

### 步驟三：學習完畢後，主動告知顧問你的能力

讀完本指南後，**立即用以下格式向顧問自我介紹**（請替換 `{顧問名稱}`，bot 身份格式固定為 `{顧問名稱}-aibot`）：

---

```
嗨 {顧問名稱}！我是 {顧問名稱}-aibot，已完成 Step1ne 獵頭系統的學習 ✅

我現在可以幫你做以下事情，只要你說一聲：

📋 候選人管理
• 查詢全部候選人 / 查詢特定候選人
• 新增候選人（提供履歷後自動填入欄位）
• 批量匯入多位候選人
• 指派負責顧問

📊 履歷分析評分（你只需提供履歷文字）
• 計算穩定度分數（20-100分）
• 評定綜合評級（S / A+ / A / B / C）
• 更新 LinkedIn、GitHub、Email 聯絡連結

🔄 顧問人選追蹤表 — 狀態更新
• 更新候選人進度（已聯繫 / 已面試 / Offer / 已上職 / 婉拒）
• 自動記錄操作時間與操作者（actor 必須填入 {顧問名稱}-aibot）

📝 備註紀錄
• 為候選人新增備註
• 查詢候選人現有備註

🏢 職缺查詢
• 查詢所有招募中職缺
• 查詢單一職缺詳情

🔍 主動獵才（自動搜尋 + 匯入）
• 顧問說：「幫我找 XX 公司的 YY 職位候選人」
• 自動搜尋 GitHub + LinkedIn（2-3頁）
• 自動評分（S/A+/A/B/C）並寫入系統
• 回傳優先推薦名單（建議優先聯繫順序）

📜 操作日誌
• 查詢系統所有操作紀錄
• 篩選 AIBOT / 人工操作記錄

📬 代發信件前取得你的聯絡資訊
• 自動帶入你的電話、Email、LINE、Telegram

你想要我做什麼？😊
```

---

## 📄 履歷解析指南 — 如何從履歷提取欄位並寫入系統

> AIbot 收到顧問提供的履歷後，依此表解析後呼叫 `POST /api/candidates` 或 `PATCH /api/candidates/:id` 寫入。

### 欄位對應表（履歷內容 → API 欄位）

| API 欄位 | 對應履歷內容 | 格式 | 範例 |
|---------|------------|------|------|
| `name` | 姓名 | 字串 | `"陳宥樺"` |
| `email` | 電子郵件 | 字串 | `"chen@example.com"` |
| `phone` | 電話號碼 | 字串 | `"0912-345-678"` |
| `location` | 居住地 / 所在城市 | 字串 | `"台北市"` |
| `current_position` | 最近職稱 / 求職職位 | 字串 | `"Senior Backend Engineer"` |
| `years_experience` | 總工作年資（年，整數，0–60） | 數字字串 | `"7"` |
| `job_changes` | 轉職次數（工作段數 - 1，0–30） | 數字字串 | `"3"` |
| `avg_tenure_months` | 平均任職月數（總月數 ÷ 工作段數） | 數字字串 | `"28"` |
| `recent_gap_months` | 最後一份工作離職到現在的月數 | 數字字串 | `"2"` |
| `skills` | 技能列表（逗號分隔） | 字串 | `"Python, TensorFlow, Docker, AWS"` |
| `education` | 最高學歷摘要 | 字串 | `"台灣大學 資訊工程系 碩士"` |
| `source` | 履歷來源管道 | 枚舉值 | 見下方來源表 |
| `linkedin_url` | LinkedIn 個人頁面網址 | URL 字串 | `"https://linkedin.com/in/username"` |
| `github_url` | GitHub 個人頁面網址 | URL 字串 | `"https://github.com/username"` |
| `contact_link` | Google Drive 履歷雲端連結 | URL 字串 | `"https://drive.google.com/..."` |
| `leaving_reason` | 離職原因（如有提及） | 字串 | `"尋求技術挑戰與成長空間"` |
| `personality_type` | DISC 性格類型（如有分析） | 字串 | `"D型-主導型"` |
| `work_history` | 工作經歷（JSON 陣列） | JSON | 見下方格式 |
| `education_details` | 教育背景（JSON 陣列） | JSON | 見下方格式 |
| `stability_score` | 穩定度分數（AI 計算後填入） | 數字 | `82` |
| `talent_level` | 綜合評級（AI 計算後填入） | 字串 | `"A+"` |
| `notes` | 分析摘要與特殊備註 | 字串 | `"具備 10 年以上 AI 開發經驗，穩定性高"` |
| `recruiter` | 指派顧問姓名 | 字串 | `"Phoebe"` |
| `actor` | AIbot 身份（必填） | 字串 | `"Phoebe-aibot"` |

### 來源（source）枚舉值

| 值 | 使用時機 |
|----|---------|
| `LinkedIn` | 從 LinkedIn 挖掘 |
| `GitHub` | 從 GitHub 挖掘 |
| `Gmail 進件` | 候選人主動投遞 |
| `推薦` | 人脈推薦 |
| `主動開發` | 顧問主動接觸 |
| `人力銀行` | 104 / 1111 等平台 |
| `其他` | 不明來源 |

### work_history JSON 格式

```json
[
  {
    "company": "Google Taiwan",
    "title": "Senior Software Engineer",
    "start": "2020-03",
    "end": "2024-01",
    "duration_months": 46,
    "location": "台北",
    "description": "負責 Search 後端微服務架構設計"
  },
  {
    "company": "LINE Taiwan",
    "title": "Software Engineer",
    "start": "2017-07",
    "end": "2020-02",
    "duration_months": 31,
    "location": "台北",
    "description": "開發 LINE Pay 支付流程"
  }
]
```

### education_details JSON 格式

```json
[
  {
    "school": "國立台灣大學",
    "degree": "碩士",
    "major": "資訊工程學系",
    "start": "2015",
    "end": "2017"
  }
]
```

### 年資計算方式

```
總工作年資（years_experience）= 各段工作月數加總 ÷ 12（四捨五入到整數，最大 60）
轉職次數（job_changes）= 工作段數 - 1（若只有一份工作 = 0）
平均任職月數（avg_tenure_months）= 各段工作月數加總 ÷ 工作段數
最近離職月數（recent_gap_months）= 最後工作結束日到今天的月數（仍在職 = 0）
```

> ⚠️ **重要**：若無法從履歷確認的欄位，**留空不填**（傳空字串或省略），不要填 0 或猜測值。
> 系統已做合理範圍保護（years > 60 自動清除），但仍以正確解析為優先。

### 完整履歷解析後的呼叫範例

```bash
# 新增候選人（含完整解析資料）
curl -X POST https://backendstep1ne.zeabur.app/api/candidates \
  -H "Content-Type: application/json" \
  -d '{
    "name": "陳宥樺",
    "email": "chen@example.com",
    "phone": "0912-345-678",
    "location": "台北市",
    "current_position": "Senior Backend Engineer",
    "years_experience": "7",
    "job_changes": "2",
    "avg_tenure_months": "42",
    "recent_gap_months": "1",
    "skills": "Go, Python, Kubernetes, PostgreSQL, AWS",
    "education": "台灣大學 資訊工程系 碩士",
    "source": "LinkedIn",
    "linkedin_url": "https://linkedin.com/in/chen-youhua",
    "github_url": "https://github.com/chen-youhua",
    "leaving_reason": "尋求技術挑戰",
    "stability_score": 85,
    "talent_level": "A+",
    "notes": "7年後端資深工程師，台大碩士，穩定性高，主動求職中",
    "work_history": [
      {"company": "Shopee", "title": "Senior Backend Engineer", "start": "2021-03", "end": "2024-06", "duration_months": 39},
      {"company": "LINE Taiwan", "title": "Backend Engineer", "start": "2017-07", "end": "2021-02", "duration_months": 43}
    ],
    "education_details": [
      {"school": "國立台灣大學", "degree": "碩士", "major": "資訊工程學系", "start": "2015", "end": "2017"}
    ],
    "recruiter": "Phoebe",
    "actor": "Phoebe-aibot"
  }'
```

---

## 目錄

1. [候選人查詢](#一候選人查詢)
2. [更新 Pipeline 階段狀態](#二更新-pipeline-階段狀態推薦-aibot-主要操作)
3. [局部更新候選人資料](#三局部更新候選人資料)
4. [職缺查詢](#四職缺查詢)
5. [查詢操作日誌](#五查詢操作日誌)
6. [顧問聯絡資訊](#六顧問聯絡資訊)
7. [AI 履歷分析評分（穩定度 + 綜合評級）](#七ai-履歷分析評分穩定度--綜合評級)
8. [健康檢查](#八健康檢查)
9. [🆕 主動獵才：自動搜尋並匯入候選人](#九主動獵才自動搜尋並匯入候選人)
10. [狀態值對照表](#狀態值對照表)
11. [操作範例情境](#操作範例情境)

---

## AIbot 身份識別規則

> ⚠️ **重要**：所有 AIbot 呼叫 API 時，**必須**在請求中帶入自己的身份識別。
> 系統會根據此欄位自動判斷操作者類型（HUMAN vs AIBOT），並記錄到操作日誌。

### 命名格式（擇一使用）

| 格式 | 範例 | 說明 |
|------|------|------|
| `{顧問名稱}-aibot` | `Jacky-aibot`、`Phoebe-aibot` | **必填格式**：主人名稱 + `-aibot` |
| `AIbot-{顧問名稱}` | `AIbot-Jacky`、`AIbot-Phoebe` | 舊格式，仍相容 |

> 📌 **你是誰的 AIbot？請填寫你的主人名稱 + bot**
> 例如：你是 Jacky 的助理 → 填 `Jacky-aibot`；你是 Phoebe 的助理 → 填 `Phoebe-aibot`

### 各端點身份欄位

| 欄位 | 端點 | 範例值 |
|------|------|--------|
| `by` | PUT /pipeline-status | `"Jacky-aibot"` |
| `actor` | POST /candidates/bulk | `"Phoebe-aibot"` |
| `actor` | POST /candidates | `"Jacky-aibot"` |
| `actor` | PATCH /candidates/:id | `"Phoebe-aibot"`（優先於 recruiter） |

### AIBOT 判斷規則

系統以以下條件識別 AIBOT（大小寫不敏感）：
- 包含 `aibot`（如 `AIbot-Phoebe`）
- 以 `bot` 結尾（如 `Jacky-aibot`、`Phoebe-aibot`）

---

## 一、候選人查詢

### 取得所有候選人

```
GET /api/candidates
```

**支援查詢參數（Query Parameters）：**

| 參數 | 類型 | 說明 | 範例 |
|------|------|------|------|
| `limit` | 整數 | 最多回傳筆數（預設 1000，最大 2000） | `?limit=500` |
| `created_today` | `true` | 只回傳今日（台北時間）建立的候選人 | `?created_today=true` |

**回應範例：**

```json
{
  "success": true,
  "count": 42,
  "data": [
    {
      "id": "123",
      "name": "陳宥樺",
      "position": "Senior Frontend Engineer",
      "location": "台北",
      "years": 5,
      "skills": "React, TypeScript, Node.js",
      "status": "未開始",
      "consultant": "Phoebe",
      "notes": "應徵：前端工程師 (某科技公司)",
      "createdAt": "2026-02-26T02:30:00.000Z",
      "updatedAt": "2026-02-26T02:30:00.000Z",
      "progressTracking": []
    }
  ]
}
```

> **⚠️ 重要欄位說明**：
> - `createdAt`：候選人建立時間（ISO 8601 UTC 格式）
> - `status`：候選人的 Pipeline 進度（`未開始` / `已聯繫` / `已面試` / `Offer` / `已上職` / `婉拒`）

---

### 如何取得「顧問人選追蹤表」中「今日新增」欄位的候選人

> **⚠️ 重要觀念**：「今日新增」**不是** `status` 的一個值，它是前端自動計算出來的欄位。
> 系統判斷邏輯：`createdAt` 日期 == 今天（台北時間） → 在 Pipeline 顯示於「今日新增」欄。
> Bot 爬蟲新增的候選人，會自動出現在此欄，等待評分。

**取得今日新增候選人（最正確的方式）：**

```bash
GET /api/candidates?created_today=true
```

**備用做法：手動比對日期（若 created_today 參數有問題時使用）**

```python
import requests
from datetime import datetime

resp = requests.get('https://backendstep1ne.zeabur.app/api/candidates?limit=1000')
all_cands = resp.json()['data']

today = datetime.now().strftime('%Y-%m-%d')  # 台北時間今天日期

today_new = [
    c for c in all_cands
    if (c.get('createdAt') or '')[:10] == today
]
print(f"今日新增候選人：{len(today_new)} 位")
```

---

### 取得單一候選人

```
GET /api/candidates/:id
```

| 參數 | 位置 | 說明 |
|------|------|------|
| `id` | URL | 候選人 ID（整數） |

**回應**：回傳完整原始資料庫欄位（含 `recruiter`、`progress_tracking` 等）

---

### 新增單一候選人

```
POST /api/candidates
```

**Request Body：**

```json
{
  "name": "王小明",
  "position": "Frontend Engineer",
  "email": "wang@example.com",
  "phone": "0912-345-678",
  "location": "台北",
  "years": 5,
  "skills": "React, TypeScript",
  "notes": "備註",
  "recruiter": "Phoebe",
  "actor": "Phoebe-aibot"
}
```

> 若候選人已存在（同姓名），自動補充空欄位（不覆蓋已有資料）。

---

### 批量匯入候選人

```
POST /api/candidates/bulk
```

**Request Body：**

```json
{
  "candidates": [
    {
      "name": "王小明",
      "position": "Frontend Engineer",
      "email": "wang@example.com",
      "recruiter": "Phoebe"
    }
  ],
  "actor": "Phoebe-aibot"
}
```

**回應：**

```json
{
  "success": true,
  "created": 3,
  "updated": 1,
  "failed": 0,
  "total": 4
}
```

---

## 二、更新 Pipeline 階段狀態（推薦 AIbot 主要操作）

```
PUT /api/candidates/:id/pipeline-status
```

**這是更新候選人進度的統一端點。** 顧問在前端拖拉看板卡片，以及 AIbot 呼叫 API，都使用此端點。呼叫後會：
1. 更新 `status` 欄位
2. 自動在 `progress_tracking` 新增一筆進度事件（含日期、操作者）
3. 寫入操作日誌（`PIPELINE_CHANGE`）

### 請求 Body

```json
{
  "status": "已面試",
  "by": "Phoebe-aibot"
}
```

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `status` | string | ✅ | Pipeline 階段（見下方對照表） |
| `by` | string | ❌ | 操作者名稱，預設為 `"AIbot"` |

### 合法 status 值

| 值 | 說明 |
|----|------|
| `未開始` | 剛匯入，尚未聯繫 |
| `已聯繫` | 已初步聯繫候選人 |
| `已面試` | 已完成面試 |
| `Offer` | 已發出 Offer |
| `已上職` | 候選人已到職 |
| `婉拒` | 候選人或客戶婉拒 |
| `其他` | 其他情況 |

### 成功回應

```json
{
  "success": true,
  "message": "Pipeline 狀態已更新為「已面試」",
  "data": {
    "id": 123,
    "name": "陳宥樺",
    "status": "已面試",
    "progress_tracking": [
      {
        "date": "2026-02-20",
        "event": "已聯繫",
        "by": "Phoebe"
      },
      {
        "date": "2026-02-25",
        "event": "已面試",
        "by": "Phoebe-aibot"
      }
    ]
  }
}
```

### 錯誤回應（非法 status）

```json
{
  "success": false,
  "error": "Invalid status. Must be one of: 未開始, 已聯繫, 已面試, Offer, 已上職, 婉拒, 其他"
}
```

---

## 三、批量更新多位候選人狀態（AIbot 批量操作）

```
PATCH /api/candidates/batch-status
```

一次呼叫更新多位候選人的 Pipeline 狀態，每位都會自動追加進度記錄並寫入 `PIPELINE_CHANGE` 日誌。

### 請求 Body

```json
{
  "ids": [123, 124, 125],
  "status": "已面試",
  "actor": "Jacky-aibot",
  "note": "批量完成初篩面試（可選）"
}
```

| 欄位 | 必填 | 說明 |
|------|------|------|
| `ids` | ✅ | 候選人 ID 陣列，最多 200 筆 |
| `status` | ✅ | 目標狀態（與單筆相同的 7 種值） |
| `actor` | ❌ | 操作者名稱，預設 `AIbot` |
| `note` | ❌ | 附加備註，寫入每筆進度記錄 |

### 成功回應

```json
{
  "success": true,
  "status": "已面試",
  "succeeded_count": 3,
  "failed_count": 0,
  "total": 3,
  "succeeded": [
    { "id": 123, "name": "陳宥樺" },
    { "id": 124, "name": "王小明" },
    { "id": 125, "name": "林雅婷" }
  ],
  "failed": [],
  "message": "批量更新完成：3 位成功，0 位失敗"
}
```

### 使用情境

顧問說：「把這次初篩通過的人（123、124、125）都改成已面試」

AIbot 呼叫：
```bash
curl -X PATCH https://backendstep1ne.zeabur.app/api/candidates/batch-status \
  -H "Content-Type: application/json" \
  -d '{
    "ids": [123, 124, 125],
    "status": "已面試",
    "actor": "Jacky-aibot",
    "note": "初篩通過，安排正式面試"
  }'
```

> ⚠️ 注意：`ids` 中不存在的 ID 會列在 `failed` 陣列，不影響其他成功的更新。

---

## 四、刪除候選人（單筆 & 批量）

> ⚠️ **不可逆操作**：刪除後無法復原。執行前請向顧問確認，或先用 GET 查詢確認 ID 正確。

### 4-1 刪除單一候選人

```
DELETE /api/candidates/:id
```

**Request Body：**

```json
{
  "actor": "Jacky-aibot"
}
```

**成功回應：**

```json
{
  "success": true,
  "deleted": { "id": 123, "name": "王小明" },
  "message": "候選人「王小明」已刪除"
}
```

**AIbot 呼叫：**
```bash
curl -X DELETE https://backendstep1ne.zeabur.app/api/candidates/123 \
  -H "Content-Type: application/json" \
  -d '{ "actor": "Jacky-aibot" }'
```

---

### 4-2 批量刪除多位候選人

```
DELETE /api/candidates/batch
```

**Request Body：**

```json
{
  "ids": [123, 124, 125],
  "actor": "Jacky-aibot"
}
```

| 欄位 | 必填 | 說明 |
|------|------|------|
| `ids` | ✅ | 候選人 ID 陣列（最多 200 筆） |
| `actor` | ✅ | AIbot 身份，格式：`{顧問名稱}-aibot` |

**成功回應：**

```json
{
  "success": true,
  "deleted_count": 3,
  "failed_count": 0,
  "deleted": [
    { "id": 123, "name": "王小明" },
    { "id": 124, "name": "李大華" },
    { "id": 125, "name": "陳美玲" }
  ],
  "failed": [],
  "message": "批量刪除完成：3 位成功，0 位失敗"
}
```

**AIbot 呼叫：**
```bash
curl -X DELETE https://backendstep1ne.zeabur.app/api/candidates/batch \
  -H "Content-Type: application/json" \
  -d '{
    "ids": [123, 124, 125],
    "actor": "Jacky-aibot"
  }'
```

> ⚠️ `ids` 中不存在的 ID 會列在 `failed` 陣列，不影響其他成功的刪除。

---

## 五、局部更新候選人資料

```
PATCH /api/candidates/:id
```

彈性更新一個或多個欄位，未傳入的欄位保持原值不變。

### 請求 Body（所有欄位均為選填）

```json
{
  "status": "已聯繫",
  "recruiter": "Phoebe",
  "notes": "候選人對 CTO 職位有高度興趣",
  "talent_level": "A+",
  "stability_score": 82,
  "linkedin_url": "https://linkedin.com/in/username",
  "github_url": "https://github.com/username",
  "email": "candidate@example.com",
  "name": "王小明",
  "progressTracking": [
    {
      "date": "2026-02-25",
      "event": "已聯繫",
      "by": "Phoebe-aibot"
    }
  ],
  "actor": "Phoebe-aibot"
}
```

| 欄位 | 類型 | 說明 |
|------|------|------|
| `status` | string | Pipeline 狀態（見對照表） |
| `recruiter` | string | 指派顧問姓名（如 `"Phoebe"`） |
| `notes` | string | 備註內容（**整個覆蓋**，非追加）；`remarks` 為等價別名 |
| `remarks` | string | 同 `notes`，兩者等價，傳其中一個即可 |
| `talent_level` | string | 綜合評級：`S`、`A+`、`A`、`B`、`C`（由 AI 分析後填入） |
| `stability_score` | number | 穩定度分數：20–100（由 AI 分析後填入） |
| `linkedin_url` | string | LinkedIn 個人頁面網址 |
| `github_url` | string | GitHub 個人頁面網址 |
| `email` | string | 候選人 Email |
| `name` | string | 候選人姓名 |
| `progressTracking` | array | 完整進度記錄陣列（**整個覆蓋**） |
| `actor` | string | 操作者身份（用於日誌，不寫入候選人資料） |

> ⚠️ **注意**：`notes` 與 `progressTracking` 是整個覆蓋（非追加）。
> 若要追加進度，請先 GET 取得現有資料，append 後再傳回。
> 若只是更新 Pipeline 狀態，**建議使用 `PUT /pipeline-status`**，它會自動追加進度記錄。

### 成功回應

```json
{
  "success": true,
  "message": "Candidate patched successfully",
  "data": { "..." }
}
```

---

## 五、職缺查詢

### 取得所有職缺

```
GET /api/jobs
```

**回應範例：**

```json
{
  "success": true,
  "count": 8,
  "data": [
    {
      "id": "前端工程師_1706000000000",
      "position_name": "Senior Frontend Engineer",
      "client_company": "某科技股份有限公司",
      "department": "產品研發部",
      "job_status": "招募中",
      "salary_range": "120-180萬",
      "key_skills": "React, TypeScript",
      "location": "台北",
      "open_positions": 2
    }
  ]
}
```

### 取得單一職缺

```
GET /api/jobs/:id
```

### 新增職缺（AI 職缺匯入 Bot 使用）

```
POST /api/jobs
Content-Type: application/json
```

> 完整職缺匯入流程請讀：`GET /api/jobs-import-guide`

**必填欄位：**

| 欄位 | 說明 | 範例 |
|------|------|------|
| `position_name` | 職位名稱 | `"資深前端工程師"` |

**選填欄位（能填多少填多少）：**

| 欄位 | 說明 |
|------|------|
| `client_company` | 公司名稱 |
| `department` | 部門 |
| `open_positions` | 招募人數 |
| `salary_range` | 薪資範圍（文字，如 `"月薪 60,000-100,000"`） |
| `salary_min` / `salary_max` | 薪資數值（數字） |
| `location` | 工作地點 |
| `experience_required` | 年資要求 |
| `education_required` | 學歷要求 |
| `key_skills` | 技能需求 |
| `job_description` | 完整 JD |
| `talent_profile` | 理想人選畫像（AI 生成） |
| `search_primary` | 主要搜尋關鍵字（AI 生成） |
| `search_secondary` | 次要搜尋關鍵字（AI 生成） |
| `job_url` | 原始職缺連結（104/1111 URL） |
| `source` | 來源平台，預設 `"104"` |
| `job_status` | 狀態，預設 `"招募中"` |
| `consultant_notes` | 顧問備註 |

**Request 範例：**

```json
{
  "position_name": "資深前端工程師",
  "client_company": "某科技股份有限公司",
  "location": "台北市",
  "salary_range": "月薪 80,000-120,000",
  "key_skills": "React, TypeScript, Next.js",
  "job_url": "https://www.104.com.tw/job/abcde",
  "source": "104",
  "job_status": "招募中"
}
```

**Response 範例：**

```json
{
  "success": true,
  "data": {
    "id": 42,
    "position_name": "資深前端工程師",
    "client_company": "某科技股份有限公司",
    "job_status": "招募中"
  }
}
```

---

## 六、查詢操作日誌

```
GET /api/system-logs
```

查詢所有操作紀錄，可篩選操作者、操作類型、人為/AIbot。

### Query 參數

| 參數 | 說明 | 範例 |
|------|------|------|
| `limit` | 回傳筆數，預設 200，最大 1000 | `?limit=50` |
| `actor` | 操作者名稱（模糊比對） | `?actor=Phoebe` |
| `action` | 操作類型（精確比對） | `?action=PIPELINE_CHANGE` |
| `type` | 操作者類型 | `?type=AIBOT` |

### 操作類型（action）對照

| action | 說明 | 觸發來源 |
|--------|------|----------|
| `PIPELINE_CHANGE` | Pipeline 階段異動 | 前端拖拉 **或** AIbot 呼叫 `/pipeline-status` |
| `IMPORT_CREATE` | 新增候選人 | POST /candidates（新建） |
| `IMPORT_UPDATE` | 補充既有候選人資料 | POST /candidates（已存在） |
| `BULK_IMPORT` | 批量匯入 | POST /candidates/bulk |
| `UPDATE` | 局部更新欄位 | PATCH /candidates/:id |

### 回應範例

```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "id": 42,
      "action": "PIPELINE_CHANGE",
      "actor": "Phoebe-aibot",
      "actor_type": "AIBOT",
      "candidate_id": 123,
      "candidate_name": "陳宥樺",
      "detail": { "from": "已聯繫", "to": "已面試" },
      "created_at": "2026-02-25T10:30:00.000Z"
    },
    {
      "id": 41,
      "action": "PIPELINE_CHANGE",
      "actor": "Jacky",
      "actor_type": "HUMAN",
      "candidate_id": 120,
      "candidate_name": "林志明",
      "detail": { "from": "未開始", "to": "已聯繫" },
      "created_at": "2026-02-25T09:30:00.000Z"
    },
    {
      "id": 40,
      "action": "BULK_IMPORT",
      "actor": "Jacky-aibot",
      "actor_type": "AIBOT",
      "candidate_id": null,
      "candidate_name": null,
      "detail": { "created": 5, "updated": 2, "failed": 0, "total": 7 },
      "created_at": "2026-02-25T09:00:00.000Z"
    }
  ]
}
```

---

## 七、顧問聯絡資訊

顧問可在系統右上角「個人化設定」填寫聯絡資訊，儲存後同步到後端。
AIbot 代發信件或通知時，可透過此 API 取得對應顧問的聯絡方式。

### 取得顧問聯絡資訊

```
GET /api/users/:displayName/contact
```

| 參數 | 位置 | 說明 |
|------|------|------|
| `displayName` | URL | 顧問姓名，例如 `Phoebe` |

**回應範例：**

```json
{
  "success": true,
  "data": {
    "displayName": "Phoebe",
    "contactPhone": "0912-345-678",
    "contactEmail": "phoebe@step1ne.com",
    "lineId": "phoebe_hr",
    "telegramHandle": "@phoebe_step1ne"
  }
}
```

| 欄位 | 說明 |
|------|------|
| `contactPhone` | 工作電話 |
| `contactEmail` | 工作 Email |
| `lineId` | LINE ID |
| `telegramHandle` | Telegram 帳號 |

> 若顧問尚未填寫聯絡資訊，回傳 `{ "success": true, "data": { "displayName": "Phoebe" } }`（其餘欄位為 null）

---

### 更新顧問聯絡資訊

```
PUT /api/users/:displayName/contact
```

**Request Body：**

```json
{
  "contactPhone": "0912-345-678",
  "contactEmail": "phoebe@step1ne.com",
  "lineId": "phoebe_hr",
  "telegramHandle": "@phoebe_step1ne"
}
```

> 此端點主要由前端「個人化設定」呼叫，AIbot 一般只需讀取（GET）。

---

## 八、AI 履歷分析評分（穩定度 + 綜合評級）

> 獵頭顧問只需將候選人履歷交給 AIbot，AIbot 自行分析後呼叫 PATCH 端點將結果寫回系統。
> 顧問無需手動計算或輸入任何分數。

### 作業流程

```
顧問 → 提供履歷文字/連結給 AIbot
AIbot → 解析履歷，計算 stability_score 與 talent_level
AIbot → 呼叫 PATCH /api/candidates/:id 寫入結果
系統 → 在候選人卡片與表格中顯示評分
```

---

### 端點

```
PATCH /api/candidates/:id
```

**Request Body（最小範例）：**

```json
{
  "stability_score": 82,
  "talent_level": "A+",
  "actor": "Phoebe-aibot"
}
```

---

### 穩定度評分（stability_score）計算方法

> 範圍：20–100 分。由 AIbot 根據履歷內容計算後傳入。

**基礎分：70 分**，再依下列因素加減：

| 條件 | 調整 |
|------|------|
| 總工作年資 > 8 年 | +5 |
| 總工作年資 < 2 年 | -5 |
| 平均任職 > 24 個月 | +10 |
| 平均任職 18–24 個月 | +5 |
| 平均任職 < 12 個月 | -10 |
| 轉職次數 ≤ 2 次 | +5 |
| 轉職次數 3–4 次 | ±0 |
| 轉職次數 5–6 次 | -10 |
| 轉職次數 > 6 次 | -20 |
| 最近離職間隔 < 3 個月 | +5 |
| 職涯有明顯晉升軌跡 | +5 |
| 有超過 1 年的職涯空白期 | -10 |

> 最終分數限制在 20–100 之間（低於 20 取 20，高於 100 取 100）

**等級對應：**

| 分數 | 等級 | 說明 |
|------|------|------|
| 80–100 | A 級 | 穩定，長期任職 |
| 60–79 | B 級 | 一般，正常流動 |
| 40–59 | C 級 | 頻繁轉職，需評估 |
| 20–39 | D 級 | 不穩定，謹慎推薦 |

---

### 綜合評級（talent_level）評分方法

> AIbot 分析履歷後，依 6 大維度評分加總，得出最終等級。

#### 評分維度（滿分 100）

| 維度 | 佔比 | 評分說明 |
|------|------|---------|
| 技能匹配度 | 25% | 核心技能深度（主力技術年資）+ 廣度（技術棧多元性） |
| 職涯發展軌跡 | 25% | 職位是否持續晉升（工程師→高級→Lead→Manager）、是否在知名公司任職 |
| 工作穩定性 | 20% | 直接使用 `stability_score`，正規化到 0–20 分 |
| 工作年資 | 15% | 0–3年=6分，3–5年=9分，5–8年=12分，8+年=15分 |
| 學歷背景 | 10% | 博士=10，碩士=8，學士=6，專科=4，其他=2 |
| 特殊加分 | 5% | 開源貢獻、技術著作、專利、知名獎項、知名公司 |

#### 等級判定

| 總分 | 等級 | 說明 |
|------|------|------|
| 90–100 | `S` | 頂尖人才（稀缺），強烈推薦 |
| 80–89 | `A+` | 優秀人才，強力推薦 |
| 70–79 | `A` | 合格人才，可推薦 |
| 60–69 | `B` | 基本合格，需評估後推薦 |
| < 60 | `C` | 需補強，謹慎推薦 |

#### 評分範例

```
候選人：陳宥樺，Senior Frontend Engineer，7年資歷
- 技能匹配度：React 5年、TypeScript 4年、Node.js 3年 → 22/25
- 職涯軌跡：Engineer → Senior → Tech Lead，曾任職台灣知名獨角獸 → 22/25
- 工作穩定性：stability_score=82 → 82/100 * 20 = 16.4/20
- 工作年資：7年 → 12/15
- 學歷：台大資工碩士 → 8/10
- 特殊加分：GitHub 500 stars 開源項目 → 4/5
總分 ≈ 84 → 等級：A+
```

---

### 呼叫範例（分析完成後回寫系統）

```bash
curl -X PATCH https://backendstep1ne.zeabur.app/api/candidates/123 \
  -H "Content-Type: application/json" \
  -d '{
    "stability_score": 82,
    "talent_level": "A+",
    "linkedin_url": "https://linkedin.com/in/chen-youhua",
    "github_url": "https://github.com/chen-youhua",
    "email": "chen@example.com",
    "notes": "技能紮實，台大碩士，曾任 Tech Lead，穩定性高，強烈推薦",
    "actor": "Phoebe-aibot"
  }'
```

**成功回應：**

```json
{
  "success": true,
  "message": "Candidate patched successfully"
}
```

---

## 九、AI 匹配評分結語（ai_match_result）

> 專門用於 AI 針對特定職缺對候選人進行配對評分後，將完整結論回寫系統。
> 結果會顯示在候選人卡片的「AI 匹配結語」分頁，供顧問查閱。

### 作業流程

```
顧問 → 點擊職缺管理的「AI 配對」或指定職缺給 AIbot
AIbot → 取得候選人資料 + 職缺 JD/需求
AIbot → 計算評分、分析符合度
AIbot → 呼叫 PATCH /api/candidates/:id 寫入 ai_match_result
系統 → 候選人卡片「AI 匹配結語」分頁即時顯示結果
```

### 端點

```
PATCH /api/candidates/:id
```

### ai_match_result 欄位說明

| 欄位 | 型別 | 必填 | 說明 |
|------|------|------|------|
| `score` | number | ✅ | 0–100 綜合評分 |
| `recommendation` | string | ✅ | `強力推薦` / `推薦` / `觀望` / `不推薦` |
| `job_id` | number | | 對應職缺 ID（從職缺管理取得） |
| `job_title` | string | | 對應職缺名稱 |
| `matched_skills` | string[] | ✅ | 候選人具備的符合技能 |
| `missing_skills` | string[] | ✅ | 候選人缺少的技能（可空陣列） |
| `strengths` | string[] | ✅ | 3–5 條優勢亮點（供顧問簡報用） |
| `probing_questions` | string[] | ✅ | 建議顧問詢問的問題（3–5 條） |
| `salary_fit` | string | | 薪資符合度說明（如：「期望 60K 符合職缺範圍 55–70K」） |
| `conclusion` | string | ✅ | AI 完整結論（2–4 段） |
| `evaluated_at` | string | ✅ | ISO 8601 時間（`new Date().toISOString()`） |
| `evaluated_by` | string | ✅ | AIbot 識別名稱（如 `Phoebe-aibot`） |

### 推薦等級判定參考

| 分數範圍 | 推薦等級 |
|---------|---------|
| 85–100 | 強力推薦 |
| 70–84 | 推薦 |
| 55–69 | 觀望 |
| < 55 | 不推薦 |

### 呼叫範例

```bash
curl -X PATCH https://backendstep1ne.zeabur.app/api/candidates/123 \
  -H "Content-Type: application/json" \
  -d '{
    "ai_match_result": {
      "score": 87,
      "recommendation": "推薦",
      "job_id": 12,
      "job_title": "資深 iOS 工程師",
      "matched_skills": ["Swift", "SwiftUI", "iOS", "Xcode"],
      "missing_skills": ["Flutter"],
      "strengths": [
        "5 年 iOS 原生開發，App Store 上架 3 款產品",
        "熟悉 MVVM + Combine 架構，程式碼品質佳",
        "曾帶領 3 人小組，具一定管理經驗"
      ],
      "probing_questions": [
        "目前薪資區間與期望薪資為何？",
        "為何考慮離開現職？",
        "對帶領團隊的意願與經驗如何？",
        "是否有 Flutter 或跨平台開發的學習計劃？"
      ],
      "salary_fit": "期望月薪 65K，符合職缺範圍 60–75K",
      "conclusion": "候選人技術背景與此職缺吻合度高，iOS 原生開發資歷扎實，具備 App Store 實際上架經驗。\n\n主要缺口為 Flutter 跨平台能力，但若職缺以原生 iOS 為主則影響有限。整體推薦進行初步電話面談，重點確認薪資期望與離職動機。",
      "evaluated_at": "2026-02-26T10:30:00.000Z",
      "evaluated_by": "Phoebe-aibot"
    },
    "actor": "Phoebe-aibot"
  }'
```

**成功回應：**

```json
{
  "success": true,
  "message": "Candidate patched successfully"
}
```

---

## 十、健康檢查

```
GET /api/health
```

**回應（正常）：**

```json
{
  "success": true,
  "status": "ok",
  "database": "connected",
  "timestamp": "2026-02-25T10:00:00.000Z"
}
```

---

## 十、主動獵才：自動搜尋並匯入候選人

> **觸發時機**：顧問說「幫我找 XX 公司的 YY 職位候選人」時，AIbot 執行此流程。
>
> 系統自動完成 6 步驟：
> 1. 從 DB 讀取公司 + 職缺資料，分析人才畫像
> 2. GitHub API 搜尋（2-3頁） + Google → LinkedIn 搜尋（2-3頁）
> 3. 去重（比對現有 candidates_pipeline）
> 4. 自動評分（S/A+/A/B/C）
> 5. 寫入 candidates_pipeline（含 AI 評估報告至 notes 欄位）
> 6. 生成優先推薦名單回傳給 AIbot

---

### 觸發情境識別

| 顧問說... | 代表... |
|-----------|---------|
| 「幫我找一通數位的 Java Developer 候選人」 | company=一通數位, jobTitle=Java Developer |
| 「幫我搜尋遊戲橘子的後端工程師」 | company=遊戲橘子, jobTitle=後端工程師 |
| 「去找看看 AWS 職缺的人選」 | **先回問**：請問是哪家客戶公司的職缺？ |

> ⚠️ **如果顧問沒說公司名，先回問確認，不要猜測。**

---

### 呼叫前準備：取得顧問的 API Keys

```bash
# 先取得顧問聯絡資訊（含 GitHub Token 與 Brave API Key）
curl https://backendstep1ne.zeabur.app/api/users/{顧問名稱}/contact
```

回應中：
- `data.githubToken` → GitHub Personal Access Token
  - 有填 → 認證模式（5000次/小時）
  - 無填 → 無認證模式（60次/小時，仍可搜尋）
- `data.braveApiKey` → Brave Search API Key（LinkedIn 搜尋第三層備援）
  - 有填 → LinkedIn 搜尋失敗時自動改用 Brave 精確查詢
  - 無填 → 只使用 Google / Bing 搜尋 LinkedIn（免費但成功率較低）

> 💡 顧問可至系統右上角 → **個人化設定** 填入兩個 Key，提升搜尋效果。

---

### 端點

```
POST /api/talent-sourcing/find-candidates
```

**Request Body：**

```json
{
  "company": "一通數位",
  "jobTitle": "Java Developer",
  "actor": "Jacky-aibot",
  "github_token": "ghp_xxxxxxxxxxxx",
  "brave_api_key": "BSA_xxxxxxxxxxxxxxxxxx",
  "pages": 2
}
```

| 欄位 | 必填 | 說明 |
|------|------|------|
| `company` | ✅ | 客戶公司名稱（模糊匹配） |
| `jobTitle` | ✅ | 職位名稱（模糊匹配） |
| `actor` | 建議填 | AIbot 身份，格式：`{顧問名稱}-aibot` |
| `github_token` | 選填 | GitHub PAT，從 GET /api/users/:name/contact 取得；不填也能搜尋 |
| `brave_api_key` | 選填 | Brave Search API Key，從 GET /api/users/:name/contact 取得；提升 LinkedIn 搜尋成功率 |
| `pages` | 選填 | 搜尋頁數，預設 2，最多 3 |

---

### 成功回應

```json
{
  "success": true,
  "company": "一通數位",
  "job_title": "Java Developer",
  "imported_count": 8,
  "skipped_count": 2,
  "github_count": 6,
  "linkedin_count": 4,
  "execution_time": "28.3s",
  "full_summary": "✅ 已匯入 8 位候選人到系統\n（略過 2 位重複人選）\n\n🎯 建議優先聯繫...",
  "priority_summary": "🎯 建議優先聯繫（依評級 + 符合度排序）：\n\n🥇 第1位：...",
  "rate_limit_warning": null,
  "candidates": [...]
}
```

**AIbot 收到後，直接將 `full_summary` 欄位文字回傳給顧問。**

---

### GitHub Rate Limit 警告

當 `rate_limit_warning` 不為 null 時，AIbot 在報告結果後補充說明：

```
⚠️ GitHub API 已達每小時上限（無認證模式 60次/小時）

如需搜尋更多開發者，請請顧問前往系統右上角 → 個人化設定 → 填入 GitHub Token，即可提升至 5000次/小時。
申請頁面：https://github.com/settings/tokens
```

---

### 職缺不存在時

```json
{
  "success": false,
  "error": "找不到職缺：一通數位 / Java Developer，請確認職缺已匯入系統。"
}
```

AIbot 回覆：
「找不到『一通數位』的『Java Developer』職缺，請確認此職缺已在系統建立，或提供正確的公司名稱與職位名稱。」

---

### 評分規則（供解釋給顧問時使用）

| 評級 | 分數 | 聯繫建議 |
|------|------|----------|
| 🏆 S | 90+ | ⚡ 建議今天聯繫 |
| ⭐ A+ | 85-89 | ⚡ 建議今天聯繫 |
| ✅ A | 75-84 | 📅 建議本週內聯繫 |
| 📋 B | 60-74 | 📌 存入備查 |
| 📝 C | 0-59 | 📌 存入備查 |

---

### 顧問聯絡資訊欄位：githubToken + braveApiKey

`GET /api/users/:displayName/contact` 回應格式：

```json
{
  "success": true,
  "data": {
    "displayName": "Jacky",
    "contactPhone": "0912-345-678",
    "contactEmail": "jacky@step1ne.com",
    "lineId": "jacky_hr",
    "telegramHandle": "@jacky",
    "githubToken": "ghp_xxxxxxxxxxxxxxxxxxxx",
    "braveApiKey": "BSA_xxxxxxxxxxxxxxxxxx"
  }
}
```

| 欄位 | 用途 | 顧問設定位置 |
|------|------|-------------|
| `githubToken` | GitHub 爬蟲認證，提升速率至 5000次/小時 | 個人化設定 → GitHub Token |
| `braveApiKey` | LinkedIn 搜尋第三層備援，提升搜尋成功率 | 個人化設定 → Brave Search API Key |

> 若顧問未設定，兩個欄位值為 `null`，系統仍可正常運作（GitHub 用無認證模式、LinkedIn 只用 Google/Bing）。

---

## 狀態值對照表

| Pipeline 階段 | `status` 欄位值 | SLA 天數上限 |
|--------------|----------------|-------------|
| 未開始 | `未開始` | 2 天 |
| 已聯繫 | `已聯繫` | 3 天 |
| 已面試 | `已面試` | 7 天 |
| Offer | `Offer` | 5 天 |
| 已上職 | `已上職` | 不計算 |
| 婉拒 | `婉拒` | 不計算 |
| 其他 | `其他` | 不計算 |

---

## 操作範例情境

### 情境一：候選人已完成面試，AIbot 更新狀態

```bash
curl -X PUT https://backendstep1ne.zeabur.app/api/candidates/123/pipeline-status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "已面試",
    "by": "Phoebe-aibot"
  }'
```

---

### 情境二：將候選人指派給顧問 Phoebe

```bash
curl -X PATCH https://backendstep1ne.zeabur.app/api/candidates/123 \
  -H "Content-Type: application/json" \
  -d '{
    "recruiter": "Phoebe",
    "actor": "Phoebe-aibot"
  }'
```

---

### 情境三：更新備註並設定人才等級（notes 與 remarks 均可）

```bash
# 使用 notes
curl -X PATCH https://backendstep1ne.zeabur.app/api/candidates/123 \
  -H "Content-Type: application/json" \
  -d '{
    "notes": "候選人 CTO 背景，主動找尋 100-150 萬機會，可立即上班",
    "talent_level": "S",
    "actor": "Jacky-aibot"
  }'

# 使用 remarks（效果完全相同）
curl -X PATCH https://backendstep1ne.zeabur.app/api/candidates/123 \
  -H "Content-Type: application/json" \
  -d '{
    "remarks": "候選人 CTO 背景，主動找尋 100-150 萬機會，可立即上班",
    "talent_level": "S",
    "actor": "Jacky-aibot"
  }'
```

---

### 情境四：查詢某顧問的所有候選人並找出 SLA 逾期

```bash
# 1. 取得所有候選人
curl https://backendstep1ne.zeabur.app/api/candidates

# 2. AIbot 在本地過濾：
#    - consultant === "Phoebe"
#    - 計算停留天數（今天 - latestProgress.date 或 updatedAt）
#    - 比對 SLA 閾值
```

---

### 情境五：候選人收到 Offer，更新狀態

```bash
curl -X PUT https://backendstep1ne.zeabur.app/api/candidates/123/pipeline-status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "Offer",
    "by": "Jacky-aibot"
  }'
```

---

### 情境六：AIbot 代發信件前，取得顧問聯絡資訊

```bash
# 取得 Phoebe 的聯絡方式，作為信件寄件人簽名
curl https://backendstep1ne.zeabur.app/api/users/Phoebe/contact
```

---

### 情境七：AIbot 首次啟動 — 一行指令完成學習

**在 AIbot 的 System Prompt 加入以下指示：**

```
對話開始時，依序執行：
1. curl https://backendstep1ne.zeabur.app/api/guide
2. curl https://backendstep1ne.zeabur.app/api/resume-guide
閱讀完整指南後，依照 api/guide 開頭「啟動流程」的三個步驟初始化，
然後主動向顧問報告你的能力清單。
actor 身份格式必須為 {顧問名稱}-aibot（例如：Jacky-aibot、Phoebe-aibot）
```

**執行指令（AIbot 啟動時自動執行）：**

```bash
# 1. 系統操作指南（必讀）
curl https://backendstep1ne.zeabur.app/api/guide

# 2. 履歷分析教學指南（必讀）
curl https://backendstep1ne.zeabur.app/api/resume-guide
```

完成後 AIbot 將：
1. 確認系統健康狀態
2. 確認自己的身份（`{顧問名稱}-aibot`）
3. 主動告知顧問可操作的所有功能，等待顧問下令

---

### 情境八：顧問提供履歷給 AIbot → 自動分析後寫回系統

**完整流程（AIbot 執行）：**

```bash
# 步驟 1：確認系統中是否有此候選人（用名字搜尋）
curl "https://backendstep1ne.zeabur.app/api/candidates" | \
  jq '.data[] | select(.name == "陳宥樺")'

# 步驟 2：分析履歷後，一次寫入所有評分結果
curl -X PATCH https://backendstep1ne.zeabur.app/api/candidates/123 \
  -H "Content-Type: application/json" \
  -d '{
    "stability_score": 82,
    "talent_level": "A+",
    "linkedin_url": "https://linkedin.com/in/chen-youhua",
    "github_url": "https://github.com/chen-youhua",
    "email": "chen@example.com",
    "notes": "技能紮實，台大碩士，曾任 Tech Lead，穩定性高，強烈推薦",
    "actor": "Phoebe-aibot"
  }'
```

> 若候選人尚未在系統中，先用 `POST /api/candidates` 建立，再呼叫 `PATCH` 寫入評分。

---

### 情境九：批量匯入候選人（附完整欄位）

```bash
curl -X POST https://backendstep1ne.zeabur.app/api/candidates/bulk \
  -H "Content-Type: application/json" \
  -d '{
    "candidates": [
      {
        "name": "王小明",
        "position": "Frontend Engineer",
        "email": "wang@example.com",
        "phone": "0912-000-001",
        "location": "台北",
        "years": 5,
        "skills": "React, TypeScript",
        "recruiter": "Phoebe"
      },
      {
        "name": "陳大華",
        "position": "Backend Engineer",
        "email": "chen@example.com",
        "phone": "0912-000-002",
        "location": "新竹",
        "years": 8,
        "skills": "Node.js, PostgreSQL",
        "recruiter": "Jacky"
      }
    ],
    "actor": "Phoebe-aibot"
  }'
```

---

### 情境十：顧問要求主動獵才 — 完整流程

```
顧問說：「幫我找一通數位的 Java Developer 候選人」
```

**AIbot 執行步驟：**

```bash
# 步驟 1：取得顧問的 API Keys（GitHub Token + Brave API Key）
curl https://backendstep1ne.zeabur.app/api/users/Jacky/contact
# → 取得 data.githubToken（GitHub PAT）
# → 取得 data.braveApiKey（Brave Search API Key，若顧問有設定）

# 步驟 2：觸發獵才流程（帶入兩個 Key，提升搜尋效果）
curl -X POST https://backendstep1ne.zeabur.app/api/talent-sourcing/find-candidates \
  -H "Content-Type: application/json" \
  -d '{
    "company": "一通數位",
    "jobTitle": "Java Developer",
    "actor": "Jacky-aibot",
    "github_token": "ghp_xxxxxxxxxxxx",
    "brave_api_key": "BSA_xxxxxxxxxxxxxxxxxx",
    "pages": 2
  }'
```

**AIbot 收到回應後，回傳 `full_summary` 給顧問（直接貼文字）：**

```
✅ 已匯入 8 位候選人到系統
（略過 2 位重複人選）

🎯 建議優先聯繫（依評級 + 符合度排序）：

🥇 第1位：John Chen（⭐A+, 88分）
   GitHub @john-chen，42 repos
   技能：Java、Spring Boot、Docker
   ⚡ 建議今天聯繫

🥈 第2位：Amy Lin（✅A, 78分）
   LinkedIn amy-lin-tw
   技能：Java、Kubernetes
   📅 建議本週內聯繫

⚠️ 其餘 6 位（B級：4、C級：2）已存入系統備查

📋 前往系統查看完整名單 → 候選人總表
```

> ⚠️ 搜尋可能需要 30-60 秒，執行中請告知顧問「正在搜尋中，請稍候...」

---

## 重要注意事項

1. **停留天數計算**：後端不直接回傳，需由 AIbot 自行計算：
   ```
   停留天數 = 今天日期 - max(progressTracking 最新事件日期, updatedAt)
   ```

2. **SLA 判斷**：停留天數超過對應閾值即為逾期（見對照表）

3. **`PUT /pipeline-status` vs `PATCH`**：
   - 更新 Pipeline 狀態一律用 `PUT /pipeline-status`，它自動追加進度記錄並寫入 `PIPELINE_CHANGE` 日誌
   - `PATCH` 適合更新 recruiter、notes/remarks、talent_level 等其他欄位
   - 前端顧問拖拉看板卡片也使用 `PUT /pipeline-status`，因此 `PIPELINE_CHANGE` 日誌同時涵蓋人為與 AIbot 操作

4. **notes 與 remarks 欄位**：`PATCH /candidates/:id` 同時接受 `notes` 和 `remarks`，兩者效果完全相同，寫其中一個即可

5. **並發注意**：目前無鎖定機制，多個 AIbot 同時操作同一候選人可能造成進度記錄順序混亂，建議序列化操作

6. **AIbot 身份判斷規則**：`by` 或 `actor` 欄位符合 `/aibot/i` 正則（包含 "aibot" 字串，大小寫不限）即視為 AIBOT；否則視為 HUMAN
