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
5. [健康檢查](#五健康檢查)
6. [狀態值對照表](#狀態值對照表)
7. [操作範例情境](#操作範例情境)

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

## 二、更新 Pipeline 階段狀態（推薦 AIbot 主要操作）

```
PUT /api/candidates/:id/pipeline-status
```

**這是 AIbot 更新候選人進度的主要端點。** 呼叫後會：
1. 更新 `status` 欄位
2. 自動在 `progress_tracking` 新增一筆進度事件（含日期、操作者）

### 請求 Body

```json
{
  "status": "已面試",
  "by": "AIbot-Phoebe"
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
        "by": "AIbot-Phoebe"
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
  "progressTracking": [
    {
      "date": "2026-02-25",
      "event": "已聯繫",
      "by": "AIbot"
    }
  ]
}
```

| 欄位 | 類型 | 說明 |
|------|------|------|
| `status` | string | Pipeline 狀態（見對照表） |
| `recruiter` | string | 指派顧問姓名（如 `"Phoebe"`） |
| `notes` | string | 備註內容（**整個覆蓋**，非追加） |
| `talent_level` | string | 人才等級：`S`、`A+`、`A`、`B`、`C` |
| `name` | string | 候選人姓名 |
| `progressTracking` | array | 完整進度記錄陣列（**整個覆蓋**） |

> ⚠️ **注意**：`notes` 與 `progressTracking` 是整個覆蓋（非追加）。
> 若要追加進度，請先 GET 取得現有資料，append 後再傳回。
> 若只是更新 Pipeline 狀態，**建議使用 `PUT /pipeline-status`**，它會自動追加進度記錄。

### 成功回應

```json
{
  "success": true,
  "message": "Candidate patched successfully",
  "data": { ... }
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

## 五、健康檢查

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
    "by": "AIbot-Phoebe"
  }'
```

---

### 情境二：將候選人指派給顧問 Phoebe

```bash
curl -X PATCH https://backendstep1ne.zeabur.app/api/candidates/123 \
  -H "Content-Type: application/json" \
  -d '{
    "recruiter": "Phoebe"
  }'
```

---

### 情境三：更新備註並設定人才等級

```bash
curl -X PATCH https://backendstep1ne.zeabur.app/api/candidates/123 \
  -H "Content-Type: application/json" \
  -d '{
    "notes": "候選人 CTO 背景，主動找尋 100-150 萬機會，可立即上班",
    "talent_level": "S"
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
    "by": "AIbot-Jacky"
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
   - 建議更新 Pipeline 狀態一律用 `PUT /pipeline-status`，它自動寫進度記錄
   - `PATCH` 適合更新 recruiter、notes、talent_level 等其他欄位

4. **並發注意**：目前無鎖定機制，多個 AIbot 同時操作同一候選人可能造成進度記錄順序混亂，建議序列化操作
