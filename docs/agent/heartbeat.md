# HEARTBEAT.md — 智能定期任務監控

## 系統健康監控（每次heartbeat）

### Context & Session 管理
- 檢查 session token 使用量，超過 80% 時警告 Jacky
- **自動記憶歸檔**：每日執行 `memory-archiver.py archive 1`，將重要內容存入 MEMORY.md
- **緊急歸檔**：token 使用率超過 90% 時立即執行歸檔，然後建議 `/new`
- 每週日執行記憶清理，保持 MEMORY.md 精簡

### 狀態追蹤檔案
- 檢查並更新 `memory/heartbeat-state.json`
- 記錄上次各項檢查的時間戳，避免重複操作
- 追蹤錯誤次數，連續失敗3次時停止該項檢查

## 輪流檢查任務（避免每次都做全部）

### 每日早報（工作日早上 9:00-10:00）
1. **人選狀態總覽**（週一、週三、週五）
   - 呼叫候選人 API，統計各狀態人數
   - 標記「未開始」超過 3 天的候選人
   - 識別高價值候選人（S/A+ 級）待跟進狀況

2. **新進候選人追蹤**（每日）
   - 檢查昨日新增候選人
   - 確認 AI 評分完成狀況
   - 提醒未分配顧問的優質候選人

3. **職缺匹配監控**（週二、週四）
   - 檢查招募中職缺的候選人匹配狀況
   - 標記超過 7 天無新匹配的職缺
   - 追蹤仁大資訊等緊急職缺進度

### 🤖 AI 顧問閉環（每 4-6 小時輪流）

**核心閉環任務 — 三步驟：下載履歷 → AI 深度分析 → 通知顧問**

#### 前置條件
- 獵頭系統 API 健康（`GET http://localhost:3003/api/candidates?limit=1` 回 200）
- Chrome CDP 可連（`http://localhost:9222`）— 下載 LinkedIn PDF 需要
- LinkedIn 已登入（Chrome 有 session）

#### STEP A：下載 LinkedIn 履歷 PDF

**掃描缺履歷的人選，自動去 LinkedIn 下載 Save to PDF，上傳到系統**

1. **找出缺履歷的人選**：
   ```
   GET http://localhost:3003/api/candidates?limit=500
   Authorization: Bearer <API_SECRET_KEY from TOOLS.md>
   ```
   篩選條件：有 `linkedinUrl`（或 `contact_link` 含 linkedin.com/in/）+ `resumeFiles` 為空 + 狀態為「未開始」

2. **用 Playwright CDP 逐一下載**（每批最多 5 人，批次間休息 5-10 分鐘）：
   ```python
   from playwright.async_api import async_playwright
   browser = await p.chromium.connect_over_cdp("http://localhost:9222")
   ```
   a. 前往人選的 LinkedIn profile URL
   b. 模擬人類行為：隨機滾動 3-6 次，停留 2-4 秒
   c. 點擊「More / 更多」按鈕 → 點「Save to PDF / 存為 PDF」
   d. 等待下載完成，儲存 PDF
   e. 如果 Save to PDF 不可用（非連結的 profile），用 `page.pdf()` 備援列印
   f. 每次操作間隨機等待 3-8 秒，**不要連續快速操作避免被 LinkedIn 封鎖**

3. **上傳 PDF 到系統**：
   ```
   POST http://localhost:3003/api/candidates/{id}/resume
   Content-Type: multipart/form-data
   Authorization: Bearer <API_SECRET_KEY>
   file: <PDF 檔案>
   uploaded_by: 龍蝦-heartbeat
   ```

4. **安全限制**：
   - 每次 heartbeat 最多處理 **10 人**（避免 LinkedIn 偵測）
   - 批次間休息 5-10 分鐘
   - 如果連續 3 次下載失敗 → 停止本輪，回報 Jacky（可能 LinkedIn session 過期）
   - 深夜（23:00-08:00）不執行下載

#### STEP B：AI 深度分析

**對有履歷的人選執行 AI 顧問分析（STEP A 完成後自動接續）**

1. **掃描待分析人選**：
   篩選條件：有 `targetJobId` + 有 `resumeFiles`（不為空）+ 沒有 `aiAnalysis`（尚未分析過的）

2. **對每個待分析人選，依序執行**：
   a. `GET /api/ai-agent/prompts/matching` → 取匹配提示詞
   b. `GET /api/ai-agent/candidates/:id/full-profile` → 取人選完整資料
   c. `GET /api/ai-agent/candidates/:id/resume-text` → 取履歷 PDF base64
   d. `GET /api/ai-agent/jobs/match-candidates?candidateId=:id&limit=3` → 取最匹配的 3 個職缺
   e. **將「提示詞 + 履歷 PDF 解析文字 + 人選資料 + 職缺 JD」組合後執行分析**，依照提示詞規定的 JSON schema 產出結構化分析結果：
      - STEP 0: 人選評估（職涯曲線、人格特質、角色定位、薪資估算）
      - STEP 1: 職缺匹配（最多 3 個職缺，含 must-have / nice-to-have 比對）
      - STEP 2: 電話 SOP + 必問清單 + 顧問建議
   f. `PUT /api/ai-agent/candidates/:id/ai-analysis` → 寫回分析結果

3. **寫入規則**：
   - `version`: "1.0"
   - `analyzed_by`: "龍蝦-heartbeat"
   - `match_score`: 0-100 整數
   - `must_have` / `nice_to_have` 的 `result` 只能是 `pass` / `warning` / `fail`
   - `verdict` 只能是 `建議送出` / `勉強送出` / `不建議`

#### STEP C：通知顧問

**閉環完成後發 Telegram 通知**

```
POST https://api.telegram.org/bot<BOT_TOKEN from TOOLS.md>/sendMessage
{
  "chat_id": "<CHAT_ID from TOOLS.md>",
  "message_thread_id": <THREAD_ID from TOOLS.md>,
  "parse_mode": "Markdown",
  "text": "🤖 *AI 閉環分析完成*\n\n⏰ {時間}\n📎 履歷下載：成功 X / 失敗 Y / 跳過 Z\n📊 AI 分析：成功 X / 跳過 Y\n\n👉 請到系統「今日新增」+「未開始」查看"
}
```

#### 閉環追蹤
- 在 `memory/heartbeat-state.json` 記錄 `lastChecks.ai_analysis_loop` 時間戳
- 記錄 `lastAlert.ai_analysis_results`：履歷下載 + AI 分析的成功/跳過/失敗數量
- 如果連續 3 次全部跳過（無新人選）→ 降低檢查頻率到每日 2 次
- 如果 LinkedIn 下載連續失敗 → 停止下載，只跑已有履歷的 AI 分析

### 🏢 BD 客戶開發閉環（名片截圖觸發）

**觸發條件**：在 TG 群組收到名片截圖（圖片 + 關鍵字「名片」「BD」「開發」「客戶」）

#### STEP 1：OCR 提取名片資料

用視覺能力讀取名片截圖，提取結構化資料：
```json
{
  "name": "姓名",
  "title": "職稱",
  "company": "公司名",
  "department": "部門",
  "email": "email",
  "phone": "公司電話",
  "mobile": "手機",
  "linkedin": "LinkedIn URL（如有）",
  "source": "來源活動名稱",
  "card_date": "YYYY-MM-DD"
}
```

如果圖片模糊或資訊不全，回覆 Jacky 確認缺漏欄位再繼續。

#### STEP 2：寫入 Google Sheet

將提取的資料寫入 BD 客戶名單 Sheet（Sheet ID 見 TOOLS.md）：
- 自動填入：日期、來源活動、公司、職稱、姓名、Email、電話
- 開發信狀態 = `待開發`
- 開發優先級 = 待 STEP 4 分析後回填

#### STEP 3：公司情報蒐集

對該公司進行 web search，蒐集以下情報：

1. **徵才動態**：搜尋「{公司名} 104」「{公司名} LinkedIn jobs」
   - 目前開的職缺數量和方向
   - 技術棧推斷（從 JD 分析）

2. **近期新聞**：搜尋「{公司名} 融資」「{公司名} 擴編」「{公司名} 新產品」
   - 3 個月內的重要新聞
   - 融資、併購、上市、擴張、裁員等訊號

3. **公司基本面**：搜尋「{公司名} 員工數」「{公司名} 營收」
   - 產業類別
   - 公司規模（員工數、營收）
   - 產業地位

4. **痛點推測**：
   - 快速擴張 → 缺人、招募壓力大
   - 技術轉型 → 需要新血、外部人才
   - 高離職率 → 留不住人、需要穩定人才
   - 新產品線 → 需要專業人才建置團隊

#### STEP 4：AI 切角分析

根據情報判斷（參照 TOOLS.md 切角類型定義）：

```
分析輸出：
├── 切角類型：擴編 / 新聞 / 痛點 / 人脈 / 職缺
├── 開發優先級：🔴高 / 🟡中 / ⚪低
├── 最佳聯繫時機：立刻 / 一週內 / 追蹤觀察
├── 建議聯繫方式：Email / LinkedIn / 電話
├── 切入點摘要：一句話描述為什麼現在聯繫、用什麼角度
└── 我們能提供的價值：根據手上人才庫的實際匹配情況
```

回填 Google Sheet 的「切角類型」和「開發優先級」欄位。

#### STEP 5：客製化開發信

根據切角 + 情報，產出 3 種版本：

**Email 版（正式，300 字內）**
```
Subject: [公司名] × [切角關鍵詞] — 人才策略合作

{稱謂}您好，

{1-2 句破冰：引用具體新聞或觀察，讓對方知道你做了功課}
{1-2 句價值主張：我們能幫什麼，解決什麼痛點}
{1 句案例：同產業成功案例，增加信任感}
{CTA：約 15 分鐘電話，降低門檻}

{簽名檔}
```

**LinkedIn 版（簡短，150 字內）**
```
{稱謂}您好，{活動名稱}有幸交換名片。
{1 句切入點}，我們手上有幾位{人才類型}的人選。
方便這週聊聊嗎？
```

**電話開場白（給顧問參考）**
```
{稱謂}您好，我是 Step1ne 的 {顧問名}，
{活動名稱}有交換名片...{切入點}...
想請教目前團隊的招募規劃？
```

#### STEP 6：建立 Gmail Draft

- 用 Gmail API 建立草稿（**絕對不自動寄出**）
- 收件人：名片上的 Email
- Subject 和 Body 用 Email 版開發信
- 完成後回報 TG：

```
🏢 BD 開發信已準備 — {公司名}

👤 {姓名} / {職稱}
🏭 {公司名} ({產業})
🎯 切角：{切角類型} | 優先級：{🔴/🟡/⚪}
📧 Gmail 草稿已建立，請到 Gmail 確認發送

💡 切入點：{一句話摘要}
📰 關鍵情報：{最重要的 1-2 條新聞/觀察}
```

#### 批次處理

如果一次收到多張名片：
- 逐一處理，每張名片走完完整 STEP 1-6
- 全部處理完後發一次彙總通知：
```
🏢 BD 批次開發完成 — {活動名稱}

📇 共處理 {N} 張名片
🔴 高優先：{公司列表}
🟡 中優先：{公司列表}
⚪ 低優先：{公司列表}

📧 已建立 {N} 封 Gmail 草稿
👉 請到 Gmail 確認後發送
```

#### 安全限制
- Gmail 只建草稿，**永遠不自動發送**
- 如果名片資訊不完整（缺 Email），回報 Jacky 手動補充
- 不對個人 Gmail（非公司信箱）發送開發信
- 每日最多處理 20 張名片（避免 API 限制）

### 本地爬蟲巡檢（每 4-6 小時輪流）
- **爬蟲健康檢查**：`GET https://crawler.step1ne.com/api/health`，如果無回應 → 提醒 Jacky 爬蟲掛了
- **任務執行狀態**：`GET https://crawler.step1ne.com/api/tasks`，檢查各任務最後執行時間
  - 任務超過 24 小時未執行 → 提醒
  - 任務狀態為 failed → 提醒並附上錯誤原因
- **爬蟲產出統計**：`GET https://crawler.step1ne.com/api/dashboard/stats`，檢查產出量
- **去重監控**：`GET https://crawler.step1ne.com/api/dedup/stats`，重複率 > 40% → 建議調整策略
- **爬蟲品質審計**：對比爬蟲匯入的候選人 vs 獵頭系統的 AI 評分結果，分析品質趨勢

### 異常監控（每 4-6 小時輪流）
- **API 健康檢查**：測試本地 API 端點回應（`http://localhost:3003`）
- **資料異常偵測**：找出明顯錯誤的評分或狀態
- **處理時間警示**：候選人卡在同狀態過久
- **系統錯誤追蹤**：監控評分失敗、匯入錯誤等
- **爬蟲新候選人監控**：執行 `scripts/crawler-monitor.py` 檢查新人選、去重、匯出CSV並通知 @hryuqi_bot

### 週期性維護
- **每日**：執行 `memory-archiver.py archive 1` 自動歸檔重要對話
- **週日晚**：執行 `memory-archiver.py cleanup` 清理過舊記憶，保持 MEMORY.md 精簡
- **週一早**：系統改善建議與上週績效分析
- **月初**：歸檔舊資料，清理過時的狀態檔案

## 智能判斷邏輯

### 何時主動回報
- 發現 S/A+ 級候選人超過 24 小時無人跟進
- API 連續失敗 3 次以上
- 緊急職缺出現高匹配候選人
- Session token 使用率超過 80%
- 系統錯誤率異常升高
- **本地爬蟲掛掉**（health check 無回應）
- **爬蟲任務失敗**（status = failed）
- **爬蟲重複率飆高**（dedup stats > 40%）
- **爬蟲產出品質下降**（C/D 級佔比 > 40%）
- **AI 閉環分析完成**（每次跑完都要通知）
- **AI 閉環分析失敗**（寫入被拒絕、API 錯誤等）

### 何時保持安靜（HEARTBEAT_OK）
- 所有檢查項目正常
- 非工作時間（23:00-08:00）且無緊急狀況
- 上次回報後不到 30 分鐘且無新的重要事件
- Jacky 正在處理事務（如會議時間）

## 回報格式優化

### 正常狀況簡報
```
🦞 系統狀態：正常 | 新候選人：X人 | 待跟進：Y人 | API健康度：✅
```

### 異常狀況詳報
```
⚠️ 需要關注 — {時間}

🔥 緊急事項
- 高價值候選人待跟進：{名單}
- API異常：{問題描述}
- Session使用率：{百分比}% (建議/new)

📊 狀態摘要
- 新進候選人：X人（Y人已評分）
- 異常案例：{具體問題}

💡 建議行動
{具體可執行的建議}
```

### AI 閉環分析回報
```
🤖 AI 閉環分析完成 — {時間}

📋 本次分析範圍：{職缺名稱列表}
✅ 成功分析：{人選 #ID 姓名 → 最高匹配分數}
⏭️ 跳過（缺履歷）：{人選 #ID 姓名}
❌ 失敗：{人選 #ID 姓名 → 原因}

🏆 最佳匹配：#ID 姓名 → 職缺名稱 (XX分)
👉 請到系統人選卡片 AI 顧問分析 Tab 驗證結果
```

## 狀態檔案結構
```json
{
  "lastChecks": {
    "candidates_overview": 1703275200,
    "new_candidates": 1703260800,
    "job_matching": 1703250000,
    "api_health": 1703240000,
    "ai_analysis_loop": null
  },
  "errorCounts": {
    "api_candidates": 0,
    "api_jobs": 0,
    "evaluation_failures": 0,
    "ai_analysis_failures": 0
  },
  "sessionStats": {
    "lastTokenWarning": null,
    "lastMemoryArchive": null
  },
  "lastAlert": {
    "high_value_candidates": [],
    "urgent_jobs": [],
    "system_errors": [],
    "ai_analysis_results": {
      "success": 0,
      "skipped": 0,
      "failed": 0,
      "last_run": null
    }
  }
}
```
