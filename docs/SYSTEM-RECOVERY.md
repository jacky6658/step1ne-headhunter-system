# Step1ne System Recovery Guide

> Last updated: 2026-03-25
> 用途：電腦掛掉時，在新電腦上完整復原所有服務

---

## 1. 系統架構總覽

```
                    Cloudflare Tunnel (eb9fdf74)
                           │
          ┌────────────────┼────────────────┐
          │                │                │
  hrsystem.step1ne.com  api-hr.step1ne.com  agile.step1ne.com
          │                │                │
     :3002 (HR前端)   :3003 (HR後端)    :3000 (Agile前端)
                           │                │
                      PostgreSQL 16     :3001 (Agile後端)
                      ├─ step1ne DB
                      └─ agile_hub DB
```

---

## 2. 硬體需求

| 項目 | 最低需求 | 目前使用 |
|------|----------|----------|
| CPU | 4 核 | i7-9750H 6C/12T |
| RAM | 8 GB | 16 GB（服務佔 ~1.5GB） |
| Disk | 20 GB | 233 GB（用 10GB） |
| OS | macOS 12+ | macOS |

---

## 3. 必裝軟體

```bash
# Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 核心工具
brew install node@22 postgresql@16 python@3.9 cloudflared pm2

# 確認版本
node --version    # v25.8.1
npm --version     # 11.11.0
psql --version    # 16.13
python3 --version # 3.9.x

# PM2 全域安裝
npm install -g pm2
```

---

## 4. 專案路徑

| 專案 | 路徑 | GitHub |
|------|------|--------|
| HR System（主系統） | `/Users/step1ne/step1ne-headhunter-system` | `jacky6658/step1ne-headhunter-system` |
| Agile Hub | `/Users/step1ne/Downloads/agile-hub` | — |
| Lobster Dashboard | `/Users/step1ne/lobster-dashboard` | — |
| Crawler | `/Users/step1ne/headhunter-crawler` | — |

```bash
# Clone 主系統
git clone https://github.com/jacky6658/step1ne-headhunter-system.git
cd step1ne-headhunter-system
npm install
cd server && npm install && cd ..
```

---

## 5. 資料庫

### 5.1 建立資料庫

```bash
# 啟動 PostgreSQL
brew services start postgresql@16

# 建立資料庫
createdb step1ne
createdb agile_hub
```

### 5.2 匯入資料（從備份）

```bash
# 從舊電腦匯出
pg_dump step1ne > step1ne_backup.sql
pg_dump agile_hub > agile_hub_backup.sql

# 在新電腦匯入
psql -d step1ne < step1ne_backup.sql
psql -d agile_hub < agile_hub_backup.sql
```

### 5.3 資料庫規格

| DB | 大小 | 主要表 | 筆數 |
|----|------|--------|------|
| step1ne | 788 MB | candidates_pipeline | 2,802 |
| step1ne | — | jobs_pipeline | 50 |
| agile_hub | 8 MB | — | — |

### 5.4 重要 Index

```sql
-- 這些 index 已存在，但如果從頭建要跑
CREATE INDEX IF NOT EXISTS idx_jobs_pipeline_status ON jobs_pipeline(job_status);
CREATE INDEX IF NOT EXISTS idx_candidates_updated ON candidates_pipeline(updated_at);
CREATE INDEX IF NOT EXISTS idx_candidates_created ON candidates_pipeline(created_at);
```

---

## 6. 環境變數

### HR System `.env`

```env
# API Key (前後端需一致)
VITE_API_KEY=PotfZ42-qPyY4uqSwqstpxllQB1alxVfjJsm3Mgp3HQ
# Vite Proxy Target
VITE_PROXY_TARGET=http://localhost:3003
# DB
DATABASE_URL=postgresql://step1ne@localhost:5432/step1ne
```

### HR Server `.env`

```env
DATABASE_URL=postgresql://step1ne@localhost:5432/step1ne
```

---

## 7. Cloudflare Tunnel

### 7.1 設定檔

路徑：`~/.cloudflared/config.yml`

```yaml
tunnel: eb9fdf74-b40d-48bd-b8a1-2706f42c2ef6
credentials-file: /Users/step1ne/.cloudflared/eb9fdf74-b40d-48bd-b8a1-2706f42c2ef6.json

ingress:
  - hostname: hrsystem.step1ne.com
    service: http://localhost:3002
  - hostname: api-hr.step1ne.com
    service: http://localhost:3003
  - hostname: crawler.step1ne.com
    service: http://localhost:5001
  - hostname: agile.step1ne.com
    service: http://localhost:3000
  - service: http_status:404
```

### 7.2 Credentials

**重要：** `~/.cloudflared/eb9fdf74-*.json` 是 tunnel 認證檔，必須從舊電腦複製過來！

```bash
# 從舊電腦複製
scp old-mac:~/.cloudflared/*.json ~/.cloudflared/
scp old-mac:~/.cloudflared/config.yml ~/.cloudflared/
```

### 7.3 域名對照

| 域名 | 本地 Port | 服務 |
|------|-----------|------|
| hrsystem.step1ne.com | :3002 | HR 前端 |
| api-hr.step1ne.com | :3003 | HR 後端 API |
| crawler.step1ne.com | :5001 | Python 爬蟲 |
| agile.step1ne.com | :3000 | Agile Hub 前端 |

---

## 8. PM2 服務配置

### 8.1 一鍵啟動所有服務

```bash
# 1. Cloudflare Tunnel
pm2 start cloudflared --name cloudflared -- tunnel run

# 2. HR Backend
pm2 start /path/to/step1ne-headhunter-system/server/server.js --name hr-backend

# 3. HR Frontend (Production)
pm2 start bash --name hr-frontend -- -c "cd /path/to/step1ne-headhunter-system && npx vite preview --host 0.0.0.0 --port 3002"

# 4. Agile Backend
pm2 start /path/to/agile-hub/server/server.js --name agile-backend

# 5. Agile Frontend
pm2 start npx --name agile-frontend -- vite preview --host 0.0.0.0 --port 3000

# 6. Crawler
pm2 start /path/to/headhunter-crawler/app.py --name crawler --interpreter python3

# 7. Health Monitor (每 10 分鐘)
pm2 start /path/to/step1ne-headhunter-system/server/cron/health-monitor.js --name health-monitor --cron-restart "*/10 * * * *" --no-autorestart

# 8. Patrol Daily (每天 10:00)
pm2 start /path/to/step1ne-headhunter-system/server/cron/lobster-patrol.js --name patrol-daily --cron-restart "0 10 * * *" --no-autorestart -- --full

# 9. Patrol Hourly (12/14/16/18)
pm2 start /path/to/step1ne-headhunter-system/server/cron/lobster-patrol.js --name patrol-hourly --cron-restart "0 12,14,16,18 * * *" --no-autorestart -- --quick

# 保存 + 開機自啟
pm2 save
pm2 startup
```

### 8.2 Port 對照

| Port | 服務 | PM2 Name |
|------|------|----------|
| 3000 | Agile Frontend | agile-frontend |
| 3001 | Agile Backend | agile-backend |
| 3002 | HR Frontend | hr-frontend |
| 3003 | HR Backend | hr-backend |
| 5001 | Crawler | crawler |

### 8.3 服務狀態

| 服務 | 狀態 | 說明 |
|------|------|------|
| cloudflared | online | Cloudflare Tunnel |
| hr-backend | online | HR 系統後端 |
| hr-frontend | online | HR 系統前端（vite preview） |
| agile-backend | online | Agile Hub 後端 |
| agile-frontend | online | Agile Hub 前端 |
| crawler | online | Python 爬蟲 |
| health-monitor | cron | 每 10 分鐘健康檢查 + 自動修復 |
| patrol-daily | cron | 每天 10:00 龍蝦巡邏早報 |
| patrol-hourly | cron | 12/14/16/18 龍蝦巡邏快報 |
| lobster-dashboard | **stopped** | 已停用（會打爆 DB） |
| daily-closed-loop | **stopped** | 閉環腳本（手動觸發） |

---

## 9. OpenClaw / 龍蝦

### 9.1 設定路徑

```
~/.openclaw/openclaw.json     # 主設定
~/.openclaw/agents/            # Agent 設定
~/.openclaw/workspace/         # 工作空間
```

### 9.2 目前設定

- **Model:** `claude-sonnet-4-20250514`
- **Auth:** Anthropic token mode
- **Telegram Bot:** `8375770979:AAFuC3emSd05sjRxSyxpP6kTmd7LyKpA2cg`

### 9.3 啟動

```bash
openclaw gateway restart
```

---

## 10. Telegram 推播設定

| 用途 | Chat ID | Topic ID |
|------|---------|----------|
| 系統監控（工程師） | -1003231629634 | 1360 |
| 龍蝦巡邏（顧問） | -1003231629634 | 1247 |

Bot Token: `8375770979:AAFuC3emSd05sjRxSyxpP6kTmd7LyKpA2cg`

---

## 11. API 快速參考

### 認證

```
Authorization: Bearer PotfZ42-qPyY4uqSwqstpxllQB1alxVfjJsm3Mgp3HQ
```

### 常用端點

```bash
# Health (不查 DB)
GET /api/health

# Health (查 DB)
GET /api/health?db=true

# 職缺（招募中）
GET /api/jobs?status=招募中&limit=50

# 候選人列表（輕量）
GET /api/candidates?fields=light&limit=50

# 候選人（cursor 分頁）
GET /api/candidates?cursor_id=100&limit=100

# 候選人（今日更新）
GET /api/candidates?updated_after=2026-03-25

# 候選人詳情
GET /api/candidates/:id

# AI Agent 完整 profile
GET /api/ai-agent/candidates/:id/full-profile
```

---

## 12. 需要從舊電腦複製的檔案

```bash
# 必要（無法重建）
~/.cloudflared/eb9fdf74-*.json          # Tunnel credentials
~/.cloudflared/config.yml               # Tunnel config
~/.openclaw/                            # OpenClaw 全部設定
~/step1ne-headhunter-system/.env        # 環境變數
~/step1ne-headhunter-system/server/.env # 後端環境變數

# 資料庫（最重要）
pg_dump step1ne > step1ne_backup.sql
pg_dump agile_hub > agile_hub_backup.sql

# 可選（可從 GitHub clone）
~/step1ne-headhunter-system/            # git clone 即可
~/Downloads/agile-hub/                  # 需要原始碼
~/lobster-dashboard/                    # 需要原始碼
~/headhunter-crawler/                   # 需要原始碼
```

---

## 13. 快速復原步驟（TL;DR）

```bash
# 1. 安裝軟體
brew install node@22 postgresql@16 python@3.9 cloudflared
npm install -g pm2

# 2. 複製設定檔
scp old-mac:~/.cloudflared/* ~/.cloudflared/
scp old-mac:~/.openclaw/ ~/.openclaw/ -r

# 3. Clone 專案
git clone https://github.com/jacky6658/step1ne-headhunter-system.git
cd step1ne-headhunter-system && npm install && cd server && npm install && cd ..

# 4. 匯入資料庫
brew services start postgresql@16
createdb step1ne && createdb agile_hub
psql -d step1ne < step1ne_backup.sql

# 5. Build 前端
npx vite build

# 6. 啟動所有服務（參考 Section 8.1）
pm2 start ...
pm2 save && pm2 startup

# 7. 驗證
curl http://localhost:3003/api/health
curl https://hrsystem.step1ne.com/
```

---

## 14. 已知問題與注意事項

1. **lobster-dashboard 不要啟動** — 會無限重啟打爆 DB（已重啟 188,000+ 次）
2. **前端用 `vite preview`** — 不要用 `vite dev`，dev mode 會讓 LCP 30+ 秒
3. **DB 備份** — 建議每週 `pg_dump step1ne > backup_$(date +%Y%m%d).sql`
4. **電腦不能睡眠** — 睡眠會斷所有外網服務（Cloudflare Tunnel）
5. **Response Cache** — candidates/jobs API 有 30 秒快取，寫入後自動清除
