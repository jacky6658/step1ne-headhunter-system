# Step1ne 評分執行指南 — openclaw AI 評分流程

> **本文件供 openclaw 手動執行「今日新增候選人評分」任務**
> 爬蟲 Bot 每日自動匯入候選人，openclaw 的任務是讀取這些候選人、進行 AI 評分、寫回系統。
> 操作者身份格式：`{你的名字}-scoring-bot`，例如 `Jacky-scoring-bot`

---

## ⚠️ 重要觀念：爬蟲候選人的資料特性

爬蟲 Bot 從 LinkedIn/GitHub 搜尋結果匯入的候選人，**只有基本資料**：

| 欄位 | 有無 | 說明 |
|------|------|------|
| `name` | ✅ | 從搜尋結果擷取 |
| `linkedin_url` | ✅ | LinkedIn 個人頁網址 |
| `github_url` | 部分 | GitHub 找到時有 |
| `skills` | ✅ | 職缺關鍵字（不一定完整） |
| `notes` | ✅ | 包含「應徵：{職位名稱}」 |
| `status` | ✅ | 固定為「未開始」 |
| `work_history` | ❌ | 爬蟲未讀頁面，無此資料 |
| `years_experience` | ❌ | 無 |
| `education` | ❌ | 無 |

**這是正常的。** 你的評分任務就是根據現有資料做最佳判斷，並寫入配對結語。

---

## 執行流程

### 步驟一：取得今日新增候選人

```
GET https://backendstep1ne.zeabur.app/api/candidates?created_today=true
```

篩選條件：`status === "未開始"`（只評尚未處理的）

若今日無新增候選人 → 回報「今日無新增候選人，評分任務結束」，停止執行。

---

### 步驟二：對每位候選人執行 AI 評分

#### 2-1. 取得對應職缺資訊

從候選人的 `notes` 欄位找到「應徵：{職位名稱}」，查詢對應職缺：

```
GET https://backendstep1ne.zeabur.app/api/jobs
```

找到 `title` 相符的職缺，取得：
- `required_skills`（必要技能）
- `search_primary`（主要關鍵字）
- `min_years_experience`（最低年資要求）

若找不到對應職缺，以「技能完整度」為主要評分依據。

---

#### 2-2. 執行 5 維評分（適用資料不完整的爬蟲候選人）

| 維度 | 權重 | 計算方式（資料不足時的備援方式） |
|------|------|----------------------------------|
| 技能匹配度 | 35% | 候選人 skills 與職缺 required_skills 的重疊比例 × 100 |
| 可觸達性 | 20% | linkedin_url 有 = 50分；github_url 有 = 再加 50分 |
| 技能廣度 | 20% | skills 欄位中技能數量（≥5個=100分，3-4個=70分，1-2個=40分，0個=0分）|
| 職位相關性 | 15% | 候選人技能是否包含職缺的 search_primary 主關鍵字 |
| 活躍信號 | 10% | github_url 有 = 100分，無 = 50分（無資料給 50 分，不懲罰）|

**綜合分數 = 各維度分數 × 權重加總（0-100）**

**評級對照：**
```
90-100 分 → S   → 狀態：AI推薦
80-89  分 → A+  → 狀態：AI推薦
70-79  分 → A   → 狀態：備選人才
60-69  分 → B   → 狀態：備選人才
< 60   分 → C   → 狀態：備選人才
```

---

#### 2-3. 撰寫配對結語（必填，寫入 notes）

配對結語是人選簡報的核心，格式如下：

```
【AI評分 {分數}分 / {評級}】{日期}

📌 配對職位：{職位名稱}（{公司名稱}）

✅ 優勢：
- {技能優勢 1，說明為何符合職缺}
- {技能優勢 2}
- {可觸達性，例如：LinkedIn 個人頁可直接聯繫}

⚠️ 待確認：
- {資料不足之處，例如：年資尚未確認，建議聯繫後了解}
- {其他需補充的資訊}

💡 顧問建議：
{一句話說明這位候選人是否值得優先聯繫，以及建議的切入點}

---
```

**範例：**
```
【AI評分 82分 / A+】2026-02-26

📌 配對職位：Java Developer 後端工程師（一通數位有限公司）

✅ 優勢：
- 技能完整覆蓋核心要求：Java + Spring Boot + Microservices + Redis
- LinkedIn 個人頁存在，可直接主動接觸
- GitHub 活躍，顯示近期仍在開發中

⚠️ 待確認：
- 工作年資尚未確認，需聯繫後了解（預估 3-7 年）
- 目前是否在職、是否 Open to Work 尚不明

💡 顧問建議：
技能匹配度高，建議優先透過 LinkedIn 傳送 InMail 確認求職意願，切入點可提「Fintech 方向的發展機會」。

---
```

---

### 步驟三：寫回評分結果

對每位候選人呼叫：

```
PATCH https://backendstep1ne.zeabur.app/api/candidates/{id}
Content-Type: application/json

{
  "stability_score": 82,
  "talent_level": "A+",
  "notes": "【AI評分 82分 / A+】...(完整配對結語)",
  "status": "AI推薦",
  "actor": "{你的名字}-scoring-bot"
}
```

> **注意**：`status` 只有 ≥80 分才設為 `AI推薦`，其餘設為 `備選人才`。

---

### 步驟四：回報執行摘要

所有候選人評分完畢後，以以下格式回報：

```
評分完成！今日處理 {N} 位候選人：
- AI推薦（≥80分）：{X} 位
- 備選人才（<80分）：{Y} 位

TOP 3 推薦（依分數排序）：
1. {姓名} — {分數}分 {評級} — {配對職位}
2. {姓名} — {分數}分 {評級} — {配對職位}
3. {姓名} — {分數}分 {評級} — {配對職位}
```

---

## API 端點速查

| 用途 | 端點 |
|------|------|
| 取得今日新增候選人 | `GET /api/candidates?created_today=true` |
| 取得所有職缺 | `GET /api/jobs` |
| 更新候選人評分 | `PATCH /api/candidates/{id}` |
| 寫入系統日誌 | `POST /api/system-log` |

**Base URL**：`https://backendstep1ne.zeabur.app`

---

## 常見問題

**Q: candidates 的 skills 是空的怎麼辦？**
A: 從 `notes` 中的職位名稱推斷所需技能，可觸達性分數仍正常計算，技能匹配度記為 0 即可。

**Q: 找不到對應職缺怎麼辦？**
A: 以「技能廣度」和「可觸達性」為主要評分依據，評級最高給到 B（70分），並在配對結語中說明「職缺資訊未能匹配」。

**Q: 我需要訪問候選人的 LinkedIn 頁面嗎？**
A: 不需要。你只使用系統 API 中的現有資料進行評分。讀取 LinkedIn 頁面是 Python 腳本（profile-reader.py）的工作，不是你的任務。

**Q: 系統有另一個 Python 腳本在評分，我需要配合嗎？**
A: 不需要。Python 腳本和你是兩套獨立流程。你評完的候選人，Python 腳本如果再跑一次，會跳過已評分（非「未開始」）的候選人。

---

## 完整啟動指令（供顧問複製貼給 openclaw）

```
請先閱讀以下系統文件後立即執行今日評分任務：
1. API 操作指南：https://backendstep1ne.zeabur.app/api/guide
2. 評分執行指南：https://backendstep1ne.zeabur.app/api/scoring-guide

你的身份：{你的名字}-scoring-bot
任務：取得今日新增候選人 → 每人 AI 評分 → 寫入配對結語 → 更新狀態 → 回報摘要
不需要等待我進一步指示，直接開始執行。
```
