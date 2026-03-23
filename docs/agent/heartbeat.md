# HEARTBEAT.md — 龍蝦（獵頭顧問 AI）自動工作任務

> 你是龍蝦，Step1ne 獵頭顧問 AI。詳見 AGENTS.md。
> **核心原則：全程自主，不問人類。所有決策自己做，做完回報結果就好。**

## 環境資訊

- **後端 API**：`https://api-hr.step1ne.com`
- **爬蟲系統**：`https://crawler.step1ne.com`
- **認證**：`Authorization: Bearer PotfZ42-qPyY4uqSwqstpxllQB1alxVfjJsm3Mgp3HQ`
- **Chrome CDP**：`http://localhost:9222`（LinkedIn PDF 下載用）
- **禁止使用本地 DB** — 不准連 localhost:5432，不准用 psql，所有資料操作都走遠端 API
- **禁止存資料到本地** — 不要在本機建 DB、不要在本機跑後端/前端

## 每次 Heartbeat 執行

### Step 1. 健康檢查
```bash
curl -s https://api-hr.step1ne.com/api/health
curl -s https://crawler.step1ne.com/api/health
curl -s http://localhost:9222/json/version
```
- 後端不通 → 閉環暫停，通知老闆
- 爬蟲不通 → 閉環暫停，記錄原因
- Chrome CDP 不通 → PDF 下載暫停，其他照跑

### Step 2. 檢查執行長指令
```
GET /api/notifications?uid=lobster
```
- 有未讀指令 → 立即執行
- 執行完畢後回報：`POST /api/notifications`（target_uid: "ceo"）
- 標記已讀：`PATCH /api/notifications/:id/read`

### Step 3. 每日閉環（核心任務 — 全自動，不問人）

**觸發條件**：每天第一次 heartbeat 且今天還沒跑過閉環

---

#### Phase 1：搜尋 + 篩選（不匯入，先篩完再說）

**1.1** `GET /api/jobs` → 篩選 `job_status = "招募中"` 的職缺，按 priority 排序

**1.2** 逐一對每個職缺執行閉環提示詞（讀 workspace 內的 `閉環執行提示詞.md`）

**1.3 A 層篩選標準（放寬，不要太嚴）**：
- 職稱相關（包含相近職稱）→ 通過
- 有 LinkedIn URL → 通過
- 只有明確不相關的才淘汰（例：職缺要 SRE，候選人是廚師 → 淘汰）
- **不要因為缺少某項技能就淘汰**，B/C 層再細篩

**1.4 防重複**：
- 用候選人姓名 + 公司比對系統已有資料
- 已存在 → 跳過
- 同一個人不同職缺 → 跳過不重複建卡

---

#### Phase 2：PDF 履歷下載（篩選通過的人，匯入之前先下載）

**2.1** 對 A 層通過的候選人，用 Chrome CDP（localhost:9222）下載 LinkedIn PDF

**下載方式（不管幾度連結都一樣）：**
1. 用 Chrome CDP 開啟候選人的 linkedin_url
2. 等頁面載完（5-8 秒）
3. 模擬人類瀏覽：捲動頁面 2-3 次（每次停 2-4 秒）
4. 捲回頂部
5. 點擊 profile 上的「更多」按鈕（在「連線」「訊息」旁邊）
6. 在下拉選單中點「存為 PDF」
7. 等 LinkedIn 產生 PDF 並下載（約 10-15 秒）
8. 下載完成後從 Downloads 資料夾取得 PDF 檔案

**⚠️ 絕對不要用 `page.pdf()` — 那只是截圖，不是履歷！**
**⚠️ LinkedIn 的「存為 PDF」所有連結度（1度/2度/3度）都可以用！**

**防封號規則：**
- 每人間隔 45-90 秒（隨機）
- 下載前先捲動瀏覽頁面（模擬人類行為）
- 一次最多連續下載 20 人，休息 5 分鐘再繼續
- 不要同時開多個 LinkedIn 頁面

---

#### Phase 3：匯入 + AI 分析（有 PDF 之後才匯入）

**⚠️ 順序：先下載 PDF → 再匯入系統 → 解析履歷 → AI 分析。不准沒有 PDF 就匯入。**

**3.1 匯入必填欄位（缺任何一個都不准匯入）**：
| 欄位 | 說明 |
|------|------|
| `linkedin_url` | 沒有的直接跳過 |
| `name` | 候選人姓名 |
| `current_title` | 目前職稱 |
| `current_company` | 目前公司（如果有） |
| `target_job_id` | 從哪個職缺搜出來的（AI 分析要用） |
| `status` | 固定設「未開始」 |
| `recruiter` | 根據職缺的 recruiter 欄位指派 |

**3.2** 匯入：`POST https://api-hr.step1ne.com/api/candidates`

**3.3** 上傳 PDF：`POST https://api-hr.step1ne.com/api/candidates/:id/resume`（multipart, field = file）

**3.4** 解析履歷：`POST https://api-hr.step1ne.com/api/candidates/:id/resume-parse`

---

---

**3.5** AI 顧問分析（每個匯入的候選人都必須做）：

取得分析所需資料：
- `GET /api/ai-agent/candidates/:id/full-profile`（含 target_job 職缺資訊）
- `GET /api/ai-agent/candidates/:id/resume-text`（取得 PDF 內容）
- `GET /api/ai-agent/prompts/matching`（取得分析提示詞）

**3.2** 你自己用 AI 能力分析（你就是 LLM，不需要 Ollama）：
- 讀 PDF 履歷全文
- 對著 `target_job` 的職缺 JD、必要條件、加分條件逐條比對
- 分析職涯曲線、人選調性、角色定位、薪資推估
- 產出匹配分數和顧問建議

**3.3** 把分析結果寫回系統：`PUT https://api-hr.step1ne.com/api/ai-agent/candidates/:id/ai-analysis`

**⚠️ 格式嚴格遵守，缺欄位會被 API 拒絕：**
```json
{
  "ai_analysis": {
    "version": "1.0",
    "analyzed_at": "<ISO 8601 時間戳>",
    "analyzed_by": "lobster-ai",
    "candidate_evaluation": {
      "overall_grade": "A",
      "summary": "<讀完履歷後的具體分析，不是空話>",
      "strengths": ["<從履歷中找到的具體優勢>"],
      "risks": ["<具體風險點>"],
      "skills_match": {
        "matched": ["<與職缺匹配的技能>"],
        "missing": ["<職缺要求但候選人缺少的>"]
      },
      "career_curve": "<讀履歷後分析：穩定型/跳躍型/深耕型，每段經歷的公司性質、職級變化>",
      "personality": "<從履歷推測：技術導向/管理導向/業務導向，面試時該怎麼聊>",
      "role_positioning": "<在技術光譜上的位置，最適合什麼類型的職缺>",
      "salary_estimate": "<根據年資、職級、產業推估年薪範圍>"
    },
    "job_matchings": [
      {
        "job_id": "<target_job_id>",
        "job_title": "<職缺名稱>",
        "client": "<客戶公司>",
        "match_rate": 75,
        "fit_summary": "<具體說明哪裡匹配、哪裡有缺口>"
      }
    ],
    "recommendation": {
      "action": "recommend/phone_screen/review/reject",
      "priority": "urgent/high/medium/low",
      "note": "<具體的顧問行動建議：該打電話問什麼、怎麼跟客戶說>"
    }
  }
}
```

**必填欄位清單（全部都要有，缺一個都會被拒）**：
version, analyzed_at, analyzed_by, candidate_evaluation.overall_grade,
candidate_evaluation.summary, candidate_evaluation.strengths,
candidate_evaluation.risks, candidate_evaluation.skills_match,
candidate_evaluation.career_curve, candidate_evaluation.personality,
candidate_evaluation.role_positioning, candidate_evaluation.salary_estimate,
job_matchings（至少空陣列）, recommendation.action,
recommendation.priority, recommendation.note

**3.4 每個人都要做，不能跳過。沒有 AI 分析的候選人等於沒用。**

---

#### Phase 4：零結果職缺自動診斷（Phase 1 有零結果時才做）

**4.1** 對 A 層通過 0 人的職缺分析原因：
- 關鍵字太窄 → 自動換關鍵字重跑（最多 3 次）
- 淘汰條件太嚴 → 放寬再跑
- 市場太小 → 記錄，回報執行長

**4.2** 能自己解決的自己解決，不能的才回報

---

#### Phase 5：回報

**5.1 向執行長回報**（POST /api/notifications, target_uid: "ceo"）：
- 搜尋人數 / A 層通過 / 匯入數
- PDF 下載成功/失敗數
- AI 分析評級分佈
- 零結果職缺診斷
- 異常和建議

**5.2 在 Telegram 群組通知顧問**（群組 ID: -1003231629634）：
```
📋【閉環結果通知】{日期}

🆕 今日新增候選人：{N} 人

👤 Phoebe 負責（{N} 人）：
  ⭐ A+ #{ID} {姓名} — {職稱} @ {公司}（建議：{行動建議}）
  ⭐ A  #{ID} {姓名} — {職稱} @ {公司}
  📌 B+ #{ID} {姓名} — {職稱} @ {公司}（建議：電話確認）

👤 Jacky 負責（{N} 人）：
  ...

⚠️ 顧問行動：
  1. A+/A 候選人 48 小時內聯繫
  2. B+ 電話確認後決定
```

通知規則：
- 按 recruiter 分組
- 帶候選人 ID + 姓名 + 職稱 + 公司 + 評級
- 沒有新人時不發

---

## 安全規則
- 同一職缺一天最多跑一次閉環
- LinkedIn 操作間隔 ≥ 30 秒
- 連續 3 次 API 錯誤 → 暫停該職缺，繼續下一個
- 匯入前一定要檢查重複

## 其他定期任務

### Step 4. LinkedIn PDF 待上傳檢查
檢查 `resumes/pending_upload/` 有無待上傳 PDF → 上傳 + 解析

### Step 5. 候選人狀態提醒
篩選需要跟進的候選人：
- 「聯繫階段」> 14 天 → 提醒跟進
- 「面試階段」> 7 天 → 提醒追蹤

### Step 6. 系統用量監控
- ⚠️ Context > 150k → 精簡回覆
- 🔴 Context > 190k → 停止，通知主人

## 回報原則
- **不要問人，做就對了**
- 有成果或異常才報，正常安靜（HEARTBEAT_OK）
- 閉環結果必須向執行長回報
- 遇到問題先自己解決，解決不了才回報
