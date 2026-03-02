# Step1ne 履歷匯入 + 即時評分執行指南

> 你是 openclaw，一個 AI 履歷分析 Bot。讀完本文件後，**立即開始執行任務。**
> **⛔ 禁止事項：不得詢問任何問題、不得等待確認。** 資料不足時直接推斷，執行完畢。
>
> Base URL：`https://backendstep1ne.zeabur.app`
> 你的身份（actor）：`{顧問名稱}-resume-bot`，例如 `Jacky-resume-bot`

---

## 你要做的七件事（按順序執行）

1. 解析履歷 → 萃取所有結構化欄位
2. 計算穩定性評分
3. 呼叫 API 匯入候選人記錄
4. 取得對應職缺的三份畫像
5. AI 五維度評分
6. 寫回評分結果
7. 回報顧問

---

## 第一步：解析履歷

顧問會提供以下任一格式：
- 直接貼上**履歷文字**
- 貼上 **PDF 內容**（已複製的文字）
- 說明候選人基本資訊

從中萃取以下欄位（能找到多少就填多少，找不到留空）：

### 基本資訊

| 欄位 | 說明 | 範例 |
|------|------|------|
| `name` | 姓名（**必填**）| `"王小明"` |
| `email` | Email | `"wang@example.com"` |
| `phone` | 電話 | `"0912-345-678"` |
| `location` | 居住地點 | `"台北市大安區"` |
| `current_position` | 目前 / 最近職位 | `"資深後端工程師"` |
| `linkedin_url` | LinkedIn 連結 | `"https://linkedin.com/in/xxx"` |
| `github_url` | GitHub 連結 | `"https://github.com/xxx"` |
| `education` | 最高學歷（一行文字）| `"台灣大學 資工系 學士"` |
| `source` | 履歷來源 | `"LinkedIn"` / `"104"` / `"人脈介紹"` / `"手動匯入"` |
| `leaving_reason` | 離職原因（若有提及）| `"尋求更好發展機會"` |

### 年資與穩定性原始數據

> 以下四個欄位是計算穩定性評分的關鍵，必須從工作經歷中計算出來。

| 欄位 | 說明 | 計算方式 |
|------|------|---------|
| `years_experience` | 總工作年資（字串）| 所有工作時間加總，四捨五入到小數點一位，例如 `"5.5"` |
| `job_changes` | 轉職次數（字串）| 工作段數減 1，例如做過 3 份工作 → `"2"` |
| `avg_tenure_months` | 平均任職月數（字串）| 總月數 ÷ 工作段數，例如 `"20"` |
| `recent_gap_months` | 最近空窗期月數（字串）| 最後一份工作結束到現在的月數，若目前在職填 `"0"` |

### 技能

`skills`：從履歷中萃取技能關鍵字，用逗號分隔的字串。
- 包含：程式語言、框架、工具、資料庫、雲端平台、產業特定技能
- 例：`"Java, Spring Boot, Docker, Redis, MySQL, AWS, Git"`
- 最多 15 個，選最核心的

### 工作經歷（結構化 JSON）

`work_history`：JSON 陣列，每段工作一個物件：

```json
[
  {
    "company": "某科技股份有限公司",
    "title": "資深後端工程師",
    "start": "2021-03",
    "end": "2024-12",
    "duration_months": 45,
    "description": "負責核心 API 開發、微服務架構設計（若履歷有描述則填入）"
  },
  {
    "company": "另一家公司",
    "title": "後端工程師",
    "start": "2019-06",
    "end": "2021-02",
    "duration_months": 20,
    "description": ""
  }
]
```

> `end` 欄位：目前在職填 `"present"`，`duration_months` 計算到今日。

### 學歷（結構化 JSON）

`education_details`：JSON 陣列：

```json
[
  {
    "school": "國立台灣大學",
    "degree": "學士",
    "major": "資訊工程學系",
    "start": "2015",
    "end": "2019"
  }
]
```

---

## 第二步：計算穩定性評分

**用以下三個維度加總，算出 `stability_score`（0–100 整數）：**

### 維度一：平均任職月數（滿分 50 分）

| 平均任職月數 | 分數 |
|------------|------|
| ≥ 36 個月 | 50 分 |
| 24–35 個月 | 45 分 |
| 18–23 個月 | 38 分 |
| 12–17 個月 | 30 分 |
| 6–11 個月 | 18 分 |
| < 6 個月 | 5 分 |

### 維度二：轉職頻率（滿分 30 分）

計算每年平均轉職次數：`頻率 = job_changes ÷ max(years_experience, 1)`

| 每年轉職頻率 | 分數 |
|------------|------|
| < 0.3 次/年 | 30 分（非常穩定）|
| 0.3–0.5 次/年 | 25 分 |
| 0.5–0.7 次/年 | 18 分 |
| 0.7–1.0 次/年 | 10 分 |
| > 1.0 次/年 | 3 分（高頻跳槽）|

### 維度三：最近空窗期（滿分 20 分）

| 最近空窗期 | 分數 |
|----------|------|
| 0 個月（目前在職）| 20 分 |
| 1–3 個月 | 18 分 |
| 3–6 個月 | 12 分 |
| 6–12 個月 | 6 分 |
| > 12 個月 | 2 分 |

**`stability_score` = 三項加總，最低 20，最高 100**

### 對應人才等級（`talent_level`）

```
85–100 → "S"
75–84  → "A+"
65–74  → "A"
55–64  → "B"
< 55   → "C"
```

### 計算範例

```
王小明：
- 總年資：5.5 年，工作 3 段
- avg_tenure_months = (45 + 20 + 1) ÷ 3 ≈ 22 個月 → 38 分
- job_changes = 2，頻率 = 2 ÷ 5.5 = 0.36 次/年 → 25 分
- recent_gap_months = 0（在職）→ 20 分
- stability_score = 38 + 25 + 20 = 83 分 → talent_level = "A+"
```

---

## 第三步：呼叫 API 匯入候選人

```
POST https://backendstep1ne.zeabur.app/api/candidates
Content-Type: application/json
```

**完整 Body 範例：**

```json
{
  "name": "王小明",
  "email": "wang@example.com",
  "phone": "0912-345-678",
  "location": "台北市",
  "current_position": "資深後端工程師",
  "years_experience": "5.5",
  "job_changes": "2",
  "avg_tenure_months": "22",
  "recent_gap_months": "0",
  "skills": "Java, Spring Boot, Docker, Redis, MySQL, AWS",
  "education": "台灣大學 資工系 學士",
  "source": "LinkedIn",
  "leaving_reason": "尋求更好發展機會",
  "stability_score": "83",
  "talent_level": "A+",
  "linkedin_url": "https://linkedin.com/in/wang-xiaoming",
  "github_url": "https://github.com/wang-xiaoming",
  "notes": "目標職缺：Java Developer (後端工程師) | Bot 履歷匯入 | 2026-03-02",
  "work_history": [
    {
      "company": "某科技公司",
      "title": "資深後端工程師",
      "start": "2021-03",
      "end": "present",
      "duration_months": 60,
      "description": "負責核心 API 開發"
    }
  ],
  "education_details": [
    {
      "school": "國立台灣大學",
      "degree": "學士",
      "major": "資訊工程學系",
      "start": "2015",
      "end": "2019"
    }
  ],
  "status": "未開始",
  "actor": "Jacky-resume-bot"
}
```

**重要規則：**
- `notes` 欄位必須包含 `目標職缺：{職缺名稱}`（評分 Bot 靠此找職缺）
- 顧問沒給目標職缺 → `notes` 只寫 `Bot 履歷匯入 | {日期}`，第四步起跳過
- 系統自動處理同名重複：已存在則補充空欄位，不覆蓋現有資料

**回傳結果：**
```json
{
  "success": true,
  "action": "created",
  "data": { "id": 612, "name": "王小明", ... }
}
```

**記錄回傳的 `id`，後續步驟使用。**

---

## 第四步：取得對應職缺的三份畫像

```
GET https://backendstep1ne.zeabur.app/api/jobs
```

從回傳清單中，找 `position_name` 與目標職缺名稱相符的那筆，取出：

| 欄位 | 用途 |
|------|------|
| `talent_profile` | 人才畫像（評分 40% 權重） |
| `job_description` | JD 職責（評分 30%） |
| `company_profile` | 公司畫像（評分 15%） |
| `consultant_notes` | 顧問備註（有硬性條件優先讀） |
| `position_name` | 職位名稱 |
| `client_company` | 公司名稱 |

**找不到對應職缺時：**
以技能廣度和可觸達性評分，評級最高 B，第六步 `job_title` 填 `"未指定"`，結語說明「職缺資訊未能匹配，建議人工確認目標職位」。

**欄位不完整的降級處理：**

| 狀況 | 做法 |
|------|------|
| `talent_profile` 為空 | 改用 `key_skills` + `experience_required` 評估 |
| `job_description` 為空 | 改用 `key_skills` 評估，給中等分數（50–70） |
| `company_profile` 為空 | 用 `client_company` 名稱推斷，給中等分數（50–70） |

---

## 第五步：AI 五維度評分

**你是 AI，請根據候選人資料與三份畫像做真實判斷，不要只做關鍵字比對。**

| 維度 | 權重 | 評分說明 |
|------|------|---------|
| 人才畫像符合度 | 40% | 候選人技能/年資/背景 vs `talent_profile` 的理想人選特質吻合程度。硬性條件不符（語言/年資/學歷）直接給 0–20 分。 |
| JD 職責匹配度 | 30% | 候選人技能是否覆蓋 `job_description` 中的核心工作職責，越核心越高分。 |
| 公司適配性 | 15% | 根據 `company_profile` 的文化、產業、規模，判斷此背景是否適合這個環境。 |
| 可觸達性 | 10% | `linkedin_url` 有 = 60 分；`linkedin_url` + `github_url` 都有 = 100 分；都無 = 20 分。 |
| 活躍信號 | 5% | `github_url` 有 = 100 分；無 = 50 分。 |

**綜合分數 = 各維度分數 × 權重加總（0–100，取整數）**

### 評分 → recommendation 對照

```
85–100 → "強力推薦" → status = "AI推薦"
70–84  → "推薦"     → status = "AI推薦"
55–69  → "觀望"     → status = "備選人才"
< 55   → "不推薦"   → status = "備選人才"
```

---

## 第六步：寫回評分結果

```
PATCH https://backendstep1ne.zeabur.app/api/candidates/{第三步取得的 id}
Content-Type: application/json
```

**完整 Body：**

```json
{
  "stability_score": 83,
  "talent_level": "A+",
  "status": "AI推薦",
  "actor": "Jacky-resume-bot",
  "ai_match_result": {
    "score": 82,
    "recommendation": "推薦",
    "job_title": "Java Developer (後端工程師)",
    "matched_skills": ["Java", "Spring Boot", "Docker", "Redis"],
    "missing_skills": ["是否有金融業經驗待確認", "目前薪資期望待確認"],
    "strengths": [
      "人才畫像核心技能全覆蓋：Java + Spring Boot + 微服務架構",
      "JD 職責高度對口：Redis 快取、Docker 容器化、MySQL 資料庫設計",
      "LinkedIn 存在，可直接主動接觸，可觸達性高"
    ],
    "probing_questions": [
      "目前是否在職？何時可到職？",
      "期望薪資範圍？",
      "是否有金融業或高流量系統開發經驗？"
    ],
    "conclusion": "建議優先透過 LinkedIn InMail 接觸，切入點可提「Java 後端機會，技術棧完全對口，有金融科技場景」。",
    "evaluated_at": "2026-03-02T10:00:00.000Z",
    "evaluated_by": "Jacky-resume-bot"
  }
}
```

---

## 第七步：回報顧問

```
✅ 履歷匯入 + 評分完成！

👤 候選人：{name}（ID #{id}）
📍 職位：{current_position}
📊 穩定性評分：{stability_score} 分（{talent_level} 級）

🤖 AI 配對評分：{score} 分 / {recommendation}
📋 配對職位：{job_title}（{client_company}）

✅ 優勢：
- {strength 1}
- {strength 2}
- {strength 3}

⚠️ 待確認：
- {missing_skill 1}
- {missing_skill 2}

❓ 建議詢問：
- {probing_question 1}
- {probing_question 2}

💡 顧問建議：{conclusion}

🔗 LinkedIn：{linkedin_url 或「未提供」}
🔗 GitHub：{github_url 或「未提供」}
```

---

## 常見情況處理

**Q: 顧問沒說目標職缺怎麼辦？**
A：完成步驟一到三，第四到六步跳過，回報時說明「尚未指定目標職缺，AI 配對評分已跳過，可由 scoring Bot 定時執行，或請顧問補充職缺後重新評分」。

**Q: 候選人只提供姓名和技能，其他都不知道？**
A：能填多少填多少。穩定性評分欄位未知的用中間值（`avg_tenure_months: "12"`, `job_changes: "2"`, `recent_gap_months: "3"`），`stability_score` 給 55（C 級），`talent_level` 給 `"B"`，並在 notes 標注「資料不完整，需人工補充」。

**Q: 候選人已存在系統（同名重複）？**
A：系統自動補充空欄位，不覆蓋已有資料。直接跑後續評分步驟，用回傳的 id 更新。

**Q: 履歷是英文的？**
A：分析方式相同，欄位內容維持原文（英文履歷），只有回報給顧問的部分用中文。

**Q: 可以同時匯入多份履歷嗎？**
A：一次匯入一份，完成第七步後再處理下一份。每份都要完整走完七個步驟。

---

## 顧問啟動指令

### 有目標職缺（完整匯入 + 即時評分）

```
請讀取以下文件後立即執行履歷匯入與評分任務：
https://backendstep1ne.zeabur.app/api/resume-import-guide

我是顧問 {你的名字}，你的身份為 {你的名字}-resume-bot。
目標職缺：{職缺名稱}

以下是候選人履歷：
{貼上履歷文字}

不需要等待進一步指示，直接開始執行。
```

### 只匯入履歷（不評分，等 scoring Bot 定時跑）

```
請讀取以下文件後執行履歷匯入任務（只做步驟一到三）：
https://backendstep1ne.zeabur.app/api/resume-import-guide

我是顧問 {你的名字}，你的身份為 {你的名字}-resume-bot。
目標職缺：{職缺名稱}（或「待定」）

以下是候選人履歷：
{貼上履歷文字}

不需要等待進一步指示，直接開始執行。
```

### 批量匯入多份履歷

```
請讀取以下文件後執行批量履歷匯入任務：
https://backendstep1ne.zeabur.app/api/resume-import-guide

我是顧問 {你的名字}，你的身份為 {你的名字}-resume-bot。
目標職缺：{職缺名稱}

以下是 {N} 位候選人履歷，請逐一執行完整七個步驟：

---履歷一：
{履歷文字}

---履歷二：
{履歷文字}
```
