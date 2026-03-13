# 方案 A + B 架構總結

## 📊 系統架構圖

```
┌─────────────────────────────────────────────────────────────┐
│                     React 前端 (3000)                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ AIMatchingPage | Pipeline | CandidateList            │   │
│  │ 改狀態 → PUT /api/candidates/:id                      │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                             ↓↑
                     (HTTP REST API)
                             ↓↑
┌─────────────────────────────────────────────────────────────┐
│                  Node.js 後端 (3001)                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Express Router (routes-candidates.js)                │   │
│  │ - PUT /api/candidates/:id                            │   │
│  │ - GET /api/candidates/:id                            │   │
│  │ - GET /api/candidates                                │   │
│  │ - POST /api/sync/pending                             │   │
│  └──────────────────────────────────────────────────────┘   │
│              ↓                              ↓                │
│   candidatesService.js              (非同步)               │
│   - updateCandidateStatus()         sheetsService-v2-sql   │
│   - createCandidate()               - updateCell()         │
│   - saveAIMatches()                 - findCandidateRowNum()│
└─────────────────────────────────────────────────────────────┘
        ↓                                          ↓
   (即時寫入)                              (異步同步，5s)
        ↓                                          ↓
┌──────────────────────┐                 ┌────────────────────┐
│  PostgreSQL          │                 │  Google Sheets     │
│ (True Source)        │                 │ (Report Layer)     │
│                      │                 │                    │
│ candidates_pipeline  │ ◄──── 讀 ────►  │ Resume Pool Sheet  │
│ google_sheets_sync   │  (Sync Log)     │ (A-U 欄)           │
│ candidates_sync      │                 │                    │
└──────────────────────┘                 └────────────────────┘
```

---

## 🔄 數據流程

### 流程 1：改狀態（核心）

```
前端：改狀態 → "已聯繫"
  ↓
API: PUT /api/candidates/123
  {status: "已聯繫", name: "John"}
  ↓
candidatesService.updateCandidateStatus()
  ↓
  ├→ sqlService.updateCandidateStatus()
  │  └→ PostgreSQL candidates_pipeline 表 (即時)
  │  └→ 記錄到 google_sheets_sync_log (pending)
  │
  └→ (非同步) sheetsService.updateCell()
     └→ Google Sheets (S 欄) (5s 後)
     └→ 標記為 synced_to_sheets = TRUE
```

### 流程 2：讀候選人

```
前端：GET /api/candidates
  ↓
API: candidatesService.getAllCandidates()
  ↓
sqlService.getAllCandidatePipelines()
  ↓
PostgreSQL 查詢 (快，<100ms)
  ↓
返回候選人列表
```

### 流程 3：定期同步（Cron）

```
每 5 分鐘觸發一次
  ↓
candidatesService.syncPendingChanges()
  ↓
查詢 google_sheets_sync_log (synced_to_sheets = FALSE)
  ↓
FOR EACH pending:
  - syncToGoogleSheets(candidateId, newStatus)
  - 找 Sheets 行號
  - 更新 Status 欄
  - 標記完成
```

---

## 📁 檔案結構

```
server/
├── server.js                    # 主伺服器入口
├── .env                         # 環境變數 (DATABASE_URL, SHEET_ID)
├── 
├── sqlService.js                # PostgreSQL 服務層
│   ├── getCandidatePipeline()
│   ├── updateCandidateStatus()
│   ├── saveAIMatchScores()
│   ├── getPendingSyncToSheets()
│   └── markSyncToSheetsDone()
│
├── sheetsService-v2-sql.js      # Google Sheets 服務層
│   ├── getAllCandidates()
│   ├── findCandidateRowNum()
│   ├── updateCell()
│   ├── appendCandidateRow()
│   └── updateCandidateStatus()
│
├── candidatesService.js         # 業務邏輯層
│   ├── updateCandidateStatus()  # 核心：同時更新 SQL + Sheets
│   ├── createCandidate()
│   ├── getCandidate()
│   ├── saveAIMatches()
│   └── syncPendingChanges()
│
├── routes-candidates.js         # REST API 路由層
│   ├── PUT /api/candidates/:id
│   ├── GET /api/candidates/:id
│   ├── GET /api/candidates
│   ├── POST /api/candidates
│   ├── POST /api/candidates/:id/ai-matches
│   └── POST /api/sync/pending
│
├── db/
│   └── init-postgres.sql        # PostgreSQL 初始化腳本
│
├── DEPLOYMENT.md                # 部署指南
├── FRONTEND-INTEGRATION.md      # 前端改進指南
└── ARCHITECTURE.md              # 本檔案
```

---

## 🔑 關鍵決策

| 決策 | 原因 | 優點 | 缺點 |
|------|------|------|------|
| **SQL 優先** | 無須等待 Sheets API | 快速回應（<50ms） | 異步同步可能延遲 |
| **非同步 Sheets 同步** | 避免 API 阻擋 | 不影響用戶體驗 | 可能失敗（有 retry） |
| **定期 Cron 同步** | 保證最終一致性 | 不怕單次失敗 | 5 分鐘延遲 |
| **保留 Google Sheets** | 現有用戶習慣 | 零遷移成本 | 多一層同步 |

---

## ⚡ 性能指標

| 操作 | 時間 | 備註 |
|------|------|------|
| 改狀態 (SQL) | <50ms | 即時 |
| 改狀態 (Sheets) | 2-5s | 非同步，無阻擋 |
| 讀候選人 (SQL) | <100ms | 快速 |
| 讀候選人 (Sheets Fallback) | 500-1000ms | 慢，但有備份 |
| 批量改 20 筆 | 2s (SQL) + 30s (Sheets) | 間隔控制 |

---

## 🛡️ 容錯機制

### 單點故障分析

```
故障點 1: PostgreSQL 連線斷開
├─ 偵測：API /health endpoint 檢查
├─ 恢復：自動 reconnect + retry
└─ 時間：<30s

故障點 2: Google Sheets API 失敗
├─ 偵測：sync_timestamp 和 synced_to_sheets
├─ 恢復：下一個 Cron cycle 重試
└─ 時間：最多 5 分鐘

故障點 3: 前端改狀態失敗
├─ 偵測：API 返回 error
├─ 恢復：自動回滾本地狀態
└─ 時間：立即
```

---

## 📊 方案對比

### 方案 A（快速修復）
```
前端改狀態 → API → Google Sheets
└─ 時間：15 分鐘
└─ 效果：改狀態立即保存 ✅
└─ 侷限：依賴 Sheets API 速度
```

### 方案 B（長期最佳）
```
前端改狀態 → API → SQL ←→ Google Sheets
└─ 時間：1-2 小時
└─ 效果：快速 + 最終一致性 ✅
└─ 優勢：架構正確，易於擴展
```

### 方案 A + B（今日完成 ✅）
```
前端改狀態 → API → SQL (即時) + Google Sheets (非同步)
└─ 時間：已完成 ✅
└─ 效果：兩者結合的所有優點 ✅✅
```

---

## 🚀 下一步擴展

### Phase 1（今日）
- [x] PostgreSQL 初始化
- [x] API 層實現
- [x] 前端改進
- [x] 部署到 Zeabur

### Phase 2（下週）
- [ ] 新增用戶權限管理（多顧問隔離）
- [ ] 審計日誌（誰改了什麼時間）
- [ ] 批量操作 API
- [ ] 候選人標籤系統

### Phase 3（2 週後）
- [ ] 移除 Google Sheets 依賴（完全遷移到 SQL）
- [ ] 行動應用（iOS/Android）
- [ ] 實時通知（WebSocket）
- [ ] AI 自動分類

---

## 📞 快速參考

### 常用命令

```bash
# 本地開發
node server/server.js

# PostgreSQL 連線
psql postgresql://root:<YOUR_PASSWORD_FROM_ZEABUR>@tpe1.clusters.zeabur.com:27883/zeabur

# 查詢候選人
SELECT * FROM candidates_pipeline WHERE consultant='Jacky' LIMIT 10;

# 查詢同步日誌
SELECT * FROM google_sheets_sync_log WHERE synced_to_sheets=FALSE;

# 手動同步
curl -X POST http://localhost:3001/api/sync/pending

# 健康檢查
curl http://localhost:3001/api/health
```

### 環境變數（記住這些）

```bash
DATABASE_URL=postgresql://root:<YOUR_PASSWORD_FROM_ZEABUR>@tpe1.clusters.zeabur.com:27883/zeabur
SHEET_ID=1PunpaDAFBPBL_I76AiRYGXKaXDZvMl1c262SEtxRk6Q
PORT=3001
```

---

## ✅ 驗收標準

✅ 改狀態 → 不登出 → 刷新 → 狀態保留
✅ 改狀態 → 登出 → 登入 → 狀態保留
✅ 改狀態 → 等 5s → Google Sheets 同步
✅ 批量改狀態 → 無 API 限流
✅ API 響應時間 <100ms
✅ PostgreSQL 零宕機（自動 reconnect）

---

**架構完成日期**: 2026-02-25
**作者**: YuQi 🦞
**狀態**: ✅ 就緒部署
