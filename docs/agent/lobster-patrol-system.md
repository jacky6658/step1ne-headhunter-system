# 龍蝦巡邏推播系統 — Lobster Patrol & Push System

> 版本：v1.0 | 建立日期：2026-03-25 | 維護者：Step1ne Engineering

## 概述

龍蝦巡邏官是 Step1ne 獵頭公司的 AI 自動巡邏系統，負責：
- 定時掃描 HR 系統資料庫
- 找出有價值人選（資料齊全 + 職缺匹配）
- 標記缺資料人選並通知其他 Agent 補齊
- 監控顧問跟進進度
- 將結果推播到 Telegram 群組

---

## 系統架構

```
[定時排程] → [龍蝦巡邏官] → [HR System API] → [分析引擎] → [Telegram 推播]
   │                                                              │
   ├── 每日 10:00（完整早報）                                      ├── 推薦人選
   └── 每 2 小時（快速巡邏）                                       ├── 待認領通知
                                                                   ├── 顧問追蹤提醒
                                                                   └── 缺資料名單
```

---

## 推播設定

| 項目 | 值 |
|------|-----|
| Telegram Bot Token | `8375770979:AAFuC3emSd05sjRxSyxpP6kTmd7LyKpA2cg` |
| Chat ID | `-1003231629634` |
| Topic ID (message_thread_id) | `1360` |
| 推播格式 | `parse_mode: "HTML"` |

### 發送訊息 API

```bash
POST https://api.telegram.org/bot8375770979:AAFuC3emSd05sjRxSyxpP6kTmd7LyKpA2cg/sendMessage
Content-Type: application/json

{
  "chat_id": "-1003231629634",
  "message_thread_id": 1360,
  "parse_mode": "HTML",
  "text": "訊息內容"
}
```

---

## 排程設定

| 任務類型 | Cron 表達式 | 時間 | 說明 |
|----------|-------------|------|------|
| 每日早報 | `0 10 * * *` | 每天 10:00 | 完整巡邏報告 |
| 定時巡邏 | `0 */2 * * *` | 每 2 小時 | 輕量版快報 |

---

## HR System API

### 連線資訊

| 項目 | 值 |
|------|-----|
| Base URL | `https://api-hr.step1ne.com` |
| Auth Header | `Authorization: Bearer PotfZ42-qPyY4uqSwqstpxllQB1alxVfjJsm3Mgp3HQ` |

### 使用的端點

| 用途 | 方法 | 端點 | 說明 |
|------|------|------|------|
| 全部人選（輕量） | GET | `/api/candidates/summary` | 回傳核心欄位，1 次拿全部 |
| 單一人選完整資料 | GET | `/api/ai-agent/candidates/{id}/full-profile` | 含 resumeFiles、aiAnalysis |
| 所有職缺 | GET | `/api/jobs` | 含職缺狀態、需求條件 |

---

## 巡邏邏輯

### STEP 1：掃描全部人選，分類為「資料齊全」vs「資料缺失」

呼叫 `GET /api/candidates/summary` 取得所有人選。

#### 資料齊全的定義（三項全部通過）

| # | 條件 | 檢查方式 |
|---|------|----------|
| 1 | 有履歷附件 | full-profile 的 `resumeFiles` 陣列長度 > 0 |
| 2 | 核心匹配資料已補齊 | `position` 不為空 AND `skills` 不為空 AND `targetJobId` 不為 null AND `talentLevel` 不為空 |
| 3 | AI 深度分析完整 | full-profile 的 `aiAnalysis` 不為 null，且包含 `candidate_evaluation` + `job_matchings`（長度 > 0）+ `recommendation` |

#### 分類結果

- **✅ 齊全人選** → 進入 STEP 2 匹配篩選
- **⚠️ 缺資料人選** → 進入 STEP 3 標記推播

#### 批量檢查策略

> 先用 summary 篩出「可能齊全」的人選（有 targetJobId + talentLevel + skills），再對這批呼叫 full-profile 驗證，避免對全部人選都呼叫。

---

### STEP 2：齊全人選 → 職缺匹配篩選

1. 呼叫 `GET /api/jobs` 取得所有「進行中」職缺
2. 對每位齊全人選，檢查其 `aiAnalysis.job_matchings`：
   - `match_score >= 80` → 標記為「強烈推薦」
   - `match_score >= 65` → 標記為「可推薦」
3. 依 match_score 排序，取前 10 位優先推播

---

### STEP 3：缺資料人選 → 標記名單

按缺少項目分類，每類最多列 10 位，超過顯示「...還有 N 位」：

| 分類 | 標記 | 說明 |
|------|------|------|
| 缺履歷 | 🔴 | 列出人選 ID + 姓名 |
| 缺核心欄位 | 🟡 | 列出人選 ID + 姓名 + 缺哪些欄位 |
| 缺 AI 分析 | 🟠 | 列出人選 ID + 姓名 |

---

### STEP 4：顧問追蹤監控

#### 已指派顧問的人選

- 篩選 `status = '聯繫階段'` 的人選
- 檢查 `updatedAt` 是否超過 3 天沒更新
- 超過 → 推播提醒：`⏰ {顧問名} — {人選名} 已 {N} 天未更新聯繫狀況`

#### 未指派顧問的人選

- 篩選 `consultant = '待指派'` 或空值
- 從中找出資料齊全且有職缺匹配的人選
- 推播認領通知

---

## 推播訊息模板

### 每日早報（10:00）

```html
🦞 <b>龍蝦巡邏早報</b> — {日期}

━━━━━━━━━━━━━━━━
📊 <b>人才庫概況</b>
━━━━━━━━━━━━━━━━
• 總人選：{total} 位
• ✅ 資料齊全：{complete} 位
• ⚠️ 資料缺失：{incomplete} 位
• 🎯 可推薦人選：{matchable} 位

━━━━━━━━━━━━━━━━
🎯 <b>今日推薦 TOP 10</b>
━━━━━━━━━━━━━━━━
1. <b>{人選名}</b> #{id} → {職缺名} ({公司}) | 匹配 {score}分 | 顧問：{consultant}
2. ...

━━━━━━━━━━━━━━━━
🆕 <b>待認領人選</b>（未指派顧問 + 有匹配職缺）
━━━━━━━━━━━━━━━━
• <b>{人選名}</b> #{id} → 適合 {職缺名} | 匹配 {score}分
  如需認領請至系統操作

━━━━━━━━━━━━━━━━
⏰ <b>顧問追蹤提醒</b>
━━━━━━━━━━━━━━━━
• {顧問名} — {人選名} #{id} 聯繫中已 {N} 天未更新
• ...

━━━━━━━━━━━━━━━━
🔧 <b>待補齊資料</b>（請 Agent 協助處理）
━━━━━━━━━━━━━━━━
🔴 缺履歷（{n}位）：{人選1}、{人選2}...
🟡 缺核心欄位（{n}位）：{人選1}(缺技能)、{人選2}(缺職缺指派)...
🟠 缺AI分析（{n}位）：{人選1}、{人選2}...

💡 以上缺資料人選已標記，請資料補齊 Agent 優先處理
```

### 定時巡邏（每 2 小時）

只推送有變動或緊急的項目，格式簡短：

```html
🦞 <b>巡邏快報</b> {時間}

🆕 新增可推薦：<b>{人選名}</b> #{id} → {職缺} {score}分
⏰ <b>{顧問名}</b> — {人選名} 已 {N} 天未更新
🙋 待認領：<b>{人選名}</b> #{id} 適合 {職缺}

（如無變動）
✅ 目前一切正常，無需處理
```

---

## 執行規則

| 規則 | 說明 |
|------|------|
| 推播頻率限制 | 同一位人選 24 小時內不重複推播（除非狀態變動） |
| 優先級排序 | match_score > 80 優先，其次 65-80，再其次未指派 |
| 名單上限 | 每個區塊最多 10 位，超過用「...還有 N 位」 |
| 錯誤處理 | API 失敗時推播 `🚨 巡邏異常：{錯誤描述}，請工程師檢查` |
| 批量檢查 | 先用 summary 篩選再對可能齊全者呼叫 full-profile |

---

## 相關文件

- [AI Agent API 文件](../AI-AGENT-API.md)
- [人選匯入完整流程](../AI-工作說明書-人選匯入到分析完整流程.md)
- [Agent 核心設定](./agent.md)
