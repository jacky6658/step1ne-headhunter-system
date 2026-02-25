# Step1ne 獵頭系統 — AIbot 操作 API 指南

> **Base URL（生產環境）**：`https://backendstep1ne.zeabur.app`
> **Base URL（本地開發）**：`http://localhost:3001`
> **所有請求 Content-Type**：`application/json`
> **認證**：目前無需 Token，所有端點公開存取

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
9. [狀態值對照表](#狀態值對照表)
10. [操作範例情境](#操作範例情境)

---

## AIbot 身份識別規則

> ⚠️ **重要**：所有 AIbot 呼叫 API 時，**必須**在請求中帶入自己的身份識別。
> 系統會根據此欄位自動判斷操作者類型（HUMAN vs AIBOT），並記錄到操作日誌。

### 命名格式（擇一使用）

| 格式 | 範例 | 說明 |
|------|------|------|
| `{顧問名稱}bot` | `Jackeybot`、`Phoebebot` | **推薦格式**：主人名稱 + bot |
| `AIbot-{顧問名稱}` | `AIbot-Jacky`、`AIbot-Phoebe` | 舊格式，仍相容 |

> 📌 **你是誰的 AIbot？請填寫你的主人名稱 + bot**
> 例如：你是 Jacky 的助理 → 填 `Jackeybot`；你是 Phoebe 的助理 → 填 `Phoebebot`

### 各端點身份欄位

| 欄位 | 端點 | 範例值 |
|------|------|--------|
| `by` | PUT /pipeline-status | `"Jackeybot"` |
| `actor` | POST /candidates/bulk | `"Phoebebot"` |
| `actor` | POST /candidates | `"Jackeybot"` |
| `actor` | PATCH /candidates/:id | `"Phoebebot"`（優先於 recruiter） |

### AIBOT 判斷規則

系統以以下條件識別 AIBOT（大小寫不敏感）：
- 包含 `aibot`（如 `AIbot-Phoebe`）
- 以 `bot` 結尾（如 `Jackeybot`、`Phoebebot`）

---

## 一、候選人查詢

### 取得所有候選人

```
GET /api/candidates
```

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
      "status": "已聯繫",
      "consultant": "Phoebe",
      "notes": "應徵：前端工程師 (某科技公司)",
      "progressTracking": [
        {
          "date": "2026-02-20",
          "event": "已聯繫",
          "by": "Phoebe"
        }
      ],
      "updatedAt": "2026-02-20T10:30:00.000Z"
    }
  ]
}
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
  "actor": "Phoebebot"
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
  "actor": "Phoebebot"
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
  "by": "Phoebebot"
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
        "by": "Phoebebot"
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

## 三、局部更新候選人資料

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
      "by": "Phoebebot"
    }
  ],
  "actor": "Phoebebot"
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

## 四、職缺查詢

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

---

## 五、查詢操作日誌

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
      "actor": "Phoebebot",
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
      "actor": "Jackeybot",
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

## 六、顧問聯絡資訊

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

## 七、AI 履歷分析評分（穩定度 + 綜合評級）

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
  "actor": "Phoebebot"
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
    "actor": "Phoebebot"
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

## 八、健康檢查

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
    "by": "Phoebebot"
  }'
```

---

### 情境二：將候選人指派給顧問 Phoebe

```bash
curl -X PATCH https://backendstep1ne.zeabur.app/api/candidates/123 \
  -H "Content-Type: application/json" \
  -d '{
    "recruiter": "Phoebe",
    "actor": "Phoebebot"
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
    "actor": "Jackeybot"
  }'

# 使用 remarks（效果完全相同）
curl -X PATCH https://backendstep1ne.zeabur.app/api/candidates/123 \
  -H "Content-Type: application/json" \
  -d '{
    "remarks": "候選人 CTO 背景，主動找尋 100-150 萬機會，可立即上班",
    "talent_level": "S",
    "actor": "Jackeybot"
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
    "by": "Jackeybot"
  }'
```

---

### 情境六：AIbot 代發信件前，取得顧問聯絡資訊

```bash
# 取得 Phoebe 的聯絡方式，作為信件寄件人簽名
curl https://backendstep1ne.zeabur.app/api/users/Phoebe/contact
```

---

### 情境七：AIbot 首次啟動 — 載入完整操作指南

**AIbot 在每次對話開始時，執行以下指令取得完整指南：**

```bash
curl https://backendstep1ne.zeabur.app/api/guide
```

指南包含：所有 API 端點用法、欄位說明、穩定度計算公式、綜合評級標準、操作範例情境。

> 💡 **建議寫入 AIbot 的 System Prompt：**
> ```
> 對話開始時，先執行：
> curl https://backendstep1ne.zeabur.app/api/guide
> 取得完整 API 指南後，再回應顧問的請求。
> ```
>
> 這樣顧問只需要說「分析這份履歷」或「更新候選人狀態」，AIbot 就能自行查找正確的端點與參數格式。

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
    "actor": "Phoebebot"
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
    "actor": "Phoebebot"
  }'
```

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
