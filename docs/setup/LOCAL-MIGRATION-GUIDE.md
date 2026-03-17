# Step1ne 獵頭系統 — 本地化遷移施工手冊

> **版本**：v1.0｜**建立日期**：2026-03-16
> **目標**：將目前部署在 Zeabur 的系統完整遷移至本地開發環境
> **預估工時**：2–3 小時

---

## 目錄

1. [前置需求](#1-前置需求)
2. [本地 PostgreSQL 建置 + 資料還原](#2-本地-postgresql-建置--資料還原)
3. [後端本地化設定](#3-後端本地化設定)
4. [前端本地化設定](#4-前端本地化設定)
5. [啟動與驗證](#5-啟動與驗證)
6. [Docker 容器化（選做）](#6-docker-容器化選做)
7. [常見問題 FAQ](#7-常見問題-faq)

---

## 1. 前置需求

### 必裝軟體

| 軟體 | 最低版本 | 安裝指令（macOS） |
|------|---------|------------------|
| Node.js | v18+ | `brew install node` |
| npm | v9+ | 隨 Node.js 安裝 |
| PostgreSQL | v14+ | `brew install postgresql@16` |
| Git | v2+ | `brew install git` |

### 選裝軟體

| 軟體 | 用途 | 安裝指令 |
|------|------|---------|
| Docker + Docker Compose | 容器化部署 | `brew install --cask docker` |
| Python 3.9+ | 爬蟲服務 | `brew install python` |

### 需要的 Repo

```bash
# 主系統
git clone https://github.com/jacky6658/step1ne-headhunter-system.git

# DB 備份（Private repo，需要權限）
git clone https://github.com/jacky6658/step1ne-db-backups.git
```

---

## 2. 本地 PostgreSQL 建置 + 資料還原

### 2.1 啟動 PostgreSQL

```bash
# 啟動服務
brew services start postgresql@16

# 確認運行中
pg_isready
# 預期輸出：/tmp:5432 - accepting connections
```

### 2.2 建立資料庫

```bash
createdb step1ne
```

### 2.3 還原備份資料

備份檔位於 `step1ne-db-backups/backups/latest.sql.gz`（約 2MB，含完整 schema + 資料）

```bash
cd step1ne-db-backups

# 方法 A：完整還原（schema + 資料）
gunzip -c backups/latest.sql.gz | psql step1ne

# 方法 B：僅還原 schema（不含資料）
psql step1ne < backups/latest_schema.sql
```

### 2.4 驗證還原結果

```bash
psql step1ne -c "\dt"
```

預期應看到以下主要表格：

| 表格名稱 | 說明 |
|----------|------|
| `candidates` | 候選人資料 |
| `candidates_pipeline` | Pipeline 追蹤 |
| `jobs` | 職缺 |
| `clients` | BD 客戶 |
| `interactions` | 互動紀錄 |
| `prompts` | 提示詞模板 |
| `notifications` | 系統通知 |
| `user_contacts` | 使用者設定 |
| `consultant_sites` | 顧問對外頁面 |
| `import_queue` | 匯入佇列 |
| `operation_logs` | 操作日誌 |

```bash
# 確認資料筆數
psql step1ne -c "SELECT COUNT(*) FROM candidates;"
# 預期：300+ 筆
```

### 2.5 本地連線字串

還原成功後，你的本地連線字串為：

```
postgresql://localhost:5432/step1ne
```

> 如果你的 PostgreSQL 有設密碼：`postgresql://你的使用者:你的密碼@localhost:5432/step1ne`

---

## 3. 後端本地化設定

### 3.1 安裝依賴

```bash
cd step1ne-headhunter-system/server
npm install
```

### 3.2 建立環境變數

在 `server/` 目錄下建立 `.env` 檔案：

```bash
cat > .env << 'EOF'
# ============================================
# Step1ne 後端 - 本地開發環境變數
# ============================================

# ── 必要 ─────────────────────────────────────
# PostgreSQL 連線字串（改成你的本地設定）
DATABASE_URL=postgresql://localhost:5432/step1ne

# ── 認證 ─────────────────────────────────────
# API 認證密鑰（前後端必須一致）
# 如不設定，開發模式下 API 不需認證（方便開發）
API_SECRET_KEY=local-dev-secret-key-change-me

# OpenClaw API Key（AI 評分工具用）
OPENCLAW_API_KEY=local-openclaw-key

# ── 服務設定 ──────────────────────────────────
NODE_ENV=development
PORT=3001

# ── 選填（功能需要時再設）─────────────────────
# GitHub Webhook 驗證（本地開發可不設）
# GITHUB_WEBHOOK_SECRET=

# Google Sheets 同步（本地開發可不設）
# SHEET_ID=

# 爬蟲 Flask API 位址（需另起 Python 服務才用）
# CRAWLER_API_URL=http://localhost:5000

# Perplexity API（候選人資料 enrichment 用）
# PERPLEXITY_API_KEY=

# GitHub Token（提高 API rate limit 60→5000/hr）
# GITHUB_TOKEN=
EOF
```

### 3.3 環境變數說明

| 變數 | 必要性 | 說明 |
|------|--------|------|
| `DATABASE_URL` | ✅ 必要 | PostgreSQL 連線字串，缺少會導致 DB 功能 503 |
| `API_SECRET_KEY` | ⚠️ 建議 | 不設定時 API 無需認證（dev 模式自動跳過） |
| `OPENCLAW_API_KEY` | ⚠️ 建議 | 不設定時 OpenClaw 端點無法使用 |
| `NODE_ENV` | 選填 | `development`（預設）或 `production` |
| `PORT` | 選填 | 預設 `3001` |
| `GITHUB_WEBHOOK_SECRET` | 選填 | 本地不需要 GitHub webhook |
| `SHEET_ID` | 選填 | Google Sheets 同步功能才需要 |
| `PERPLEXITY_API_KEY` | 選填 | 候選人自動 enrichment 功能才需要 |
| `GITHUB_TOKEN` | 選填 | GitHub 分析功能（不設也能用，只是 rate limit 較低） |

### 3.4 注意事項

- **CORS 不需改**：`server.js` 已內建允許所有 `localhost:*` 來源
- **Migration 自動執行**：server 啟動時會自動跑 migration（`IF NOT EXISTS`，冪等安全）
- **降級模式**：即使 DB 連不上，server 也能啟動，DB 相關 API 回 503

---

## 4. 前端本地化設定

### 4.1 安裝依賴

```bash
cd step1ne-headhunter-system  # 回到專案根目錄
npm install
```

### 4.2 建立環境變數

在專案**根目錄**建立 `.env` 檔案：

```bash
cat > .env << 'EOF'
# ============================================
# Step1ne 前端 - 本地開發環境變數
# ============================================

# 後端 API 位址
VITE_API_URL=http://localhost:3001/api

# API 認證密鑰（必須與後端 API_SECRET_KEY 一致）
VITE_API_KEY=local-dev-secret-key-change-me

# Vite proxy 目標（dev server 用）
VITE_PROXY_TARGET=http://localhost:3001
EOF
```

### 4.3 關鍵提醒

> ⚠️ **`VITE_API_KEY` 的值必須與後端 `API_SECRET_KEY` 完全一致**
> 前端 build 時會把 `VITE_API_KEY` 嵌入 bundle，所有 API 請求自動帶 `Authorization: Bearer {key}` header。

### 4.4 前端如何連接後端

前端有兩層機制連接後端 API：

1. **Vite Dev Proxy**（`vite.config.ts`）：開發時 `/api/*` 請求自動 proxy 到 `VITE_PROXY_TARGET`
2. **直連 URL**（`constants.ts`）：`VITE_API_URL` 覆蓋預設的 `https://api-hr.step1ne.com`

兩者都不需改程式碼，只需設定 `.env` 即可。

---

## 5. 啟動與驗證

### 5.1 啟動後端

```bash
# Terminal 1
cd step1ne-headhunter-system/server
npm start
```

預期輸出：
```
🚀 Step1ne API Server running on port 3001
📊 PostgreSQL connected
✅ Migration completed
```

### 5.2 啟動前端

```bash
# Terminal 2
cd step1ne-headhunter-system
npm run dev
```

預期輸出：
```
VITE v6.x.x  ready in xxx ms
➜  Local:   http://localhost:5173/
```

### 5.3 驗證清單

請依序檢查以下項目，全部通過即代表遷移成功：

#### API 層驗證

```bash
# 1. Health check（不需認證）
curl http://localhost:3001/api/health
# 預期：{ "status": "ok", "database": "connected" }

# 2. 候選人列表（需認證）
curl -H "Authorization: Bearer local-dev-secret-key-change-me" \
     http://localhost:3001/api/candidates?limit=5
# 預期：回傳候選人 JSON 陣列

# 3. 職缺列表
curl -H "Authorization: Bearer local-dev-secret-key-change-me" \
     http://localhost:3001/api/jobs?limit=5
# 預期：回傳職缺 JSON 陣列

# 4. OpenClaw 端點
curl -H "X-OpenClaw-Key: local-openclaw-key" \
     http://localhost:3001/api/openclaw/pending
# 預期：回傳待評分候選人列表
```

#### 前端頁面驗證

打開 `http://localhost:5173`，逐一檢查：

| 頁面 | 驗證項目 |
|------|---------|
| 總覽 Dashboard | 數據卡片有數字（候選人數、職缺數等） |
| 候選人總表 | 表格有資料、可搜尋篩選 |
| 人才看板 | Kanban 拖拉功能正常 |
| 職缺管理 | 職缺列表有資料 |
| BD 客戶 | 客戶列表有資料 |
| AI Bot 教學 | 頁面可正常載入 |
| 提示詞資料庫 | Prompt 列表有資料 |

---

## 6. Docker 容器化（選做）

### 6.1 Dockerfile（後端）

在 `server/` 目錄建立 `Dockerfile`：

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3001

CMD ["node", "server.js"]
```

### 6.2 docker-compose.yml

在專案根目錄建立：

```yaml
version: '3.8'

services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: step1ne
      POSTGRES_USER: step1ne
      POSTGRES_PASSWORD: step1ne_local_pw
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
      # 初次啟動自動還原備份（需先解壓）
      # - ./step1ne-db-backups/backups/latest.sql:/docker-entrypoint-initdb.d/init.sql

  backend:
    build: ./server
    ports:
      - "3001:3001"
    environment:
      DATABASE_URL: postgresql://step1ne:step1ne_local_pw@db:5432/step1ne
      API_SECRET_KEY: local-dev-secret-key-change-me
      OPENCLAW_API_KEY: local-openclaw-key
      NODE_ENV: development
      PORT: 3001
    depends_on:
      - db

  frontend:
    build: .
    ports:
      - "5173:5173"
    environment:
      VITE_API_URL: http://localhost:3001/api
      VITE_API_KEY: local-dev-secret-key-change-me
    depends_on:
      - backend

volumes:
  pgdata:
```

### 6.3 啟動

```bash
# 首次啟動（建置 + 啟動）
docker-compose up --build

# 背景執行
docker-compose up -d

# 還原資料到 Docker 內的 PostgreSQL
gunzip -c step1ne-db-backups/backups/latest.sql.gz | \
  docker exec -i $(docker-compose ps -q db) psql -U step1ne step1ne
```

---

## 7. 常見問題 FAQ

### Q1：啟動後端出現 `ECONNREFUSED` 連不到 DB？

```bash
# 確認 PostgreSQL 正在運行
brew services list | grep postgresql
pg_isready

# 確認資料庫存在
psql -l | grep step1ne
```

### Q2：前端打開全部顯示空白/無資料？

1. 打開 DevTools → Network，確認 API 請求是否 401
2. 如果 401：檢查 `.env` 的 `VITE_API_KEY` 是否與後端 `API_SECRET_KEY` 一致
3. 如果 CORS 錯誤：確認後端有在跑（`http://localhost:3001/api/health`）

### Q3：`VITE_API_KEY` 改了但前端沒生效？

Vite 環境變數在 **build 時** 注入，修改後需要**重啟 dev server**：
```bash
# 停止 → 重啟
npm run dev
```

### Q4：Migration 跑失敗？

```bash
# 手動執行完整 migration
psql step1ne < server/scripts/migration-all-in-one.sql
```

### Q5：想連回線上 Zeabur DB 測試？

把 `server/.env` 的 `DATABASE_URL` 改回線上值即可（見 `step1ne-db-backups/.env.production`）。

### Q6：OpenClaw 評分功能不能用？

OpenClaw 需要另外的 LLM 服務（如 Ollama）：
```bash
# 安裝 Ollama
brew install ollama
ollama serve  # 啟動在 localhost:11434

# 在 server/.env 加上：
OPENCLAW_BASE_URL=http://localhost:11434
OPENCLAW_MODEL=llama3
```

### Q7：爬蟲功能不能用？

爬蟲是獨立的 Python Flask 服務：
```bash
cd server/talent-sourcing
pip install -r requirements.txt
python app.py  # 啟動在 localhost:5000
```

---

## 附錄：線上 vs 本地 對照表

| 項目 | 線上（Zeabur） | 本地 |
|------|--------------|------|
| 前端 URL | `https://hrsystem.step1ne.com` | `http://localhost:5173` |
| 後端 URL | `https://api-hr.step1ne.com` | `http://localhost:3001` |
| DB Host | `tpe1.clusters.zeabur.com:27883` | `localhost:5432` |
| DB Name | `zeabur` | `step1ne` |
| 部署方式 | Git push 自動部署 | 手動 `npm start` / Docker |

---

## 附錄：完整檔案結構參考

```
step1ne-headhunter-system/
├── .env                    ← 前端環境變數（你要建立）
├── vite.config.ts          ← Vite 設定（不需改）
├── constants.ts            ← API_BASE_URL（被 .env 覆蓋，不需改）
├── config/api.ts           ← API 請求封裝（不需改）
├── package.json            ← 前端依賴
├── server/
│   ├── .env                ← 後端環境變數（你要建立）
│   ├── server.js           ← Express 主程式（CORS/Auth/Rate Limit）
│   ├── db.js               ← PostgreSQL 連線池
│   ├── routes-api.js       ← 所有 API 端點 + 自動 Migration
│   ├── routes-openclaw.js  ← OpenClaw AI 評分 API
│   ├── routes-crawler.js   ← 爬蟲管理 API
│   ├── package.json        ← 後端依賴
│   ├── db/
│   │   └── init-postgres.sql
│   └── scripts/
│       └── migration-all-in-one.sql
└── docs/
    └── setup/
        └── LOCAL-MIGRATION-GUIDE.md  ← 本文件
```

---

*文件結束。施工完成後請回報 Step 5 驗證清單的結果。*
