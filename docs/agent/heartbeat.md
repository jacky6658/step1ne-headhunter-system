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
