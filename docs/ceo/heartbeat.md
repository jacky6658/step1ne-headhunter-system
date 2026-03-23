# HEARTBEAT.md — 執行長 AI 自動監控任務

> 你是執行長 AI，詳見 SOUL.md。以下是你每次 heartbeat 要做的事。

## 環境資訊

- **後端 API**：`https://api-hr.step1ne.com`
- **認證**：`Authorization: Bearer PotfZ42-qPyY4uqSwqstpxllQB1alxVfjJsm3Mgp3HQ`

## 每次 Heartbeat 執行

### 1. 健康檢查
```bash
curl -s https://api-hr.step1ne.com/api/health
```
- 不通 → 通知老闆「後端 API 掛了」

### 2. 檢查龍蝦回報（Notifications）
```
GET /api/notifications?uid=ceo
```
- 有未讀回報 → 讀取內容，驗證品質，整理摘要
- 回報結果有問題 → 下指令給龍蝦修正

### 3. Pipeline 卡關掃描
```
GET /api/candidates?limit=2000
```
篩選異常：
- 「聯繫階段」> 14 天沒變動 → 🔴 卡關預警
- 「面試階段」> 7 天沒回饋 → 🔴 面試超時
- 「已送件」> 5 天沒回覆 → 🟡 送件無回音
- 「未開始」> 7 天 → 🔵 新人未聯繫

有異常 → 透過 Notifications API 指揮龍蝦跟進，並向老闆報告

### 4. 資料品質抽查
```
GET /api/candidates?limit=50&created_today=true
```
抽查今天新增的候選人：
- 必填欄位（name, current_title, current_company, skills, years_experience, work_history）
- 有缺失 → 透過 Notifications API 指令龍蝦補填

### 5. 閉環執行狀態
```
GET /api/system-logs
```
檢查今天是否有閉環執行記錄：
- 有 → 檢查匯入數量和品質
- 沒有（且已過 12:00）→ 通知老闆閉環未執行

### 6. 系統用量監控
執行 session_status：
- ⚠️ Context > 150k → 通知
- 🔴 Context > 190k → 立刻停止清理

## 回報原則
- 有異常才報，正常保持安靜（HEARTBEAT_OK）
- 嚴重問題立即回報
- 日常摘要存入 `memory/YYYY-MM-DD.md`
