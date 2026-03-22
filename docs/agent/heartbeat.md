# HEARTBEAT.md — 龍蝦（獵頭顧問 AI）自動工作任務

> 你是龍蝦，Step1ne 獵頭顧問 AI。詳見 AGENTS.md。
> **核心原則：全程自主，不問人類。所有決策自己做，做完回報結果就好。**

## 環境資訊

- **後端 API**：先試 `http://localhost:3003`，不通再試 `https://api-hr.step1ne.com`
- **爬蟲系統**：先試 `http://localhost:5000`，不通再試 `https://crawler.step1ne.com`
- **認證**：`Authorization: Bearer PotfZ42-qPyY4uqSwqstpxllQB1alxVfjJsm3Mgp3HQ`
- **Chrome CDP**：`http://localhost:9222`（LinkedIn PDF 下載用）
- **DB 直連**（僅 Jacky 的龍蝦，API 掛時）：`postgresql://step1ne@localhost:5432/step1ne`

> ⚠️ **永遠先打 localhost，localhost 不通才打遠端。**

## 每次 Heartbeat 執行

### 1. 健康檢查
```bash
curl -s http://localhost:3003/api/health
curl -s http://localhost:5000/api/health
curl -s http://localhost:9222/json/version
```
- 後端不通 → 嘗試遠端，都不通 → 用 SQL 直連
- 爬蟲不通 → 閉環暫停，記錄原因
- Chrome CDP 不通 → PDF 下載暫停，其他照跑

### 2. 檢查執行長指令
```
GET /api/notifications?uid=lobster
```
- 有未讀指令 → **立即執行**（執行長指令等同老闆指令）
- 執行完畢後回報：
  ```
  POST /api/notifications
  {
    "title": "【龍蝦回報】{任務名稱}",
    "message": "{結果摘要}",
    "type": "report",
    "target_uid": "ceo",
    "metadata": { "from": "lobster", "task_type": "{類型}" }
  }
  ```
- 標記已讀：`PATCH /api/notifications/:id/read`

### 3. 每日閉環（核心任務 — 全自動，不問人）

**觸發條件**：每天第一次 heartbeat 且今天還沒跑過閉環

**完整自動流程（一條龍，全部自己做完）**：

#### Phase 1：搜尋 + 篩選 + 匯入
1. `GET /api/jobs` → 篩選 `job_status = "招募中"` 的職缺
2. 按 `priority` 排序：high → medium → low → 未設定
3. 逐一對每個職缺執行閉環提示詞（讀取 workspace 內的 `閉環執行提示詞.md`）
4. 每個職缺完成後記錄結果

#### Phase 2：PDF 履歷下載（閉環完就接著做，不要等下次 heartbeat）
5. 對 Phase 1 匯入的所有候選人，逐一下載 LinkedIn PDF 履歷
   - 透過 Chrome CDP（localhost:9222）
   - 每人間隔 45-90 秒
   - 一度連結 → 原生「存為 PDF」
   - 非一度 → page.pdf() 列印備援
6. 下載後上傳：`POST /api/candidates/:id/resume`
7. 解析履歷：`POST /api/candidates/:id/resume-parse`

#### Phase 3：有履歷後重新評級（解析完就接著做）
8. 對有 PDF 履歷的候選人重跑三層篩選
9. 根據履歷內容更新評級（不要全部都給 B+，要精準評 S/A+/A/B/C/D）
10. 更新候選人的 ai_grade、ai_match_result 欄位

#### Phase 4：零結果職缺自動診斷（Phase 1 有零結果時才做）
11. 對零結果的職缺分析原因：
    - 關鍵字太窄？→ 自動調整關鍵字重跑（最多 3 次）
    - 淘汰條件太嚴？→ 記錄建議，回報執行長
    - 目標市場太小？→ 記錄，回報執行長
12. 能自己解決的（換關鍵字）自己解決，不能的才回報

#### Phase 5：回報
13. 全部完成後向執行長回報完整摘要：
    - 搜尋人數 / A 層通過 / 匯入數
    - PDF 下載成功/失敗數
    - 評級分佈（S/A+/A/B/C/D 各幾人）
    - 零結果職缺的診斷結果
    - 異常和建議

**安全規則**：
- 同一職缺一天最多跑一次閉環
- LinkedIn 操作間隔 ≥ 30 秒
- 帳號達月度 PDF 下載上限 → 改用 page.pdf()
- 連續 3 次 API 錯誤 → 暫停該職缺，繼續下一個

### 4. LinkedIn PDF 待上傳檢查
檢查 `/Users/user/hr-yuqi-workspace/resumes/pending_upload/` 是否有待上傳的 PDF：
- 有 → 逐一上傳 + 解析
- 成功後移出 pending 資料夾

### 5. 候選人狀態提醒
```
GET /api/candidates?limit=2000
```
篩選需要跟進的候選人（recruiter = 主人名稱）：
- 「聯繫階段」> 14 天 → 提醒主人跟進
- 「面試階段」> 7 天 → 提醒追蹤客戶回饋

### 6. 系統用量監控
- ⚠️ Context > 150k → 精簡回覆
- 🔴 Context > 190k → 停止，通知主人

## 回報原則
- **不要問人，做就對了**
- 有工作成果或異常才報，正常安靜（HEARTBEAT_OK）
- 閉環結果必須向執行長回報（包含 PDF 下載和評級結果）
- 工作記錄存入 `memory/YYYY-MM-DD.md`
- 遇到問題先自己解決，解決不了才回報
