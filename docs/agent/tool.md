# TOOLS.md — 環境設定與 API 端點

## 獵頭系統 API（本地端）

- **Base URL**: `http://localhost:3003`
- **啟動方式**: `cd ~/step1ne-headhunter-system/server && node server.js`
- **認證方式**: Bearer Token
- **Header**: `Authorization: Bearer <API_SECRET_KEY>`
- **Key 來源**: `~/step1ne-headhunter-system/server/.env` 中的 `API_SECRET_KEY`

### 健康檢查
- `GET http://localhost:3003/api/candidates?limit=1` → 預期 HTTP 200

### 注意
- 不再使用 Zeabur 雲端（已棄用）
- 所有 API 呼叫一律走本地 localhost:3003
- 如果本地 API 無回應 → 提醒 Jacky 重啟 server

## AI Agent API（閉環分析用）

- **路徑前綴**: `/api/ai-agent/`
- **端點**:
  - `GET /prompts/matching` — 匹配提示詞
  - `GET /prompts/outreach` — 開發信提示詞
  - `GET /candidates/:id/full-profile` — 人選完整資料
  - `GET /candidates/:id/resume-text` — 履歷 PDF base64
  - `GET /jobs/match-candidates?candidateId=X&limit=3` — 匹配職缺
  - `PUT /candidates/:id/ai-analysis` — 寫入分析結果
  - `PUT /candidates/:id/outreach-letter` — 寫入開發信
- **硬性規定**: 人選必須有履歷 PDF 附件才能執行分析
- **文檔**: `~/step1ne-headhunter-system/docs/AI-AGENT-API.md`

## 本地爬蟲系統

- **Base URL**: `https://crawler.step1ne.com`
- **健康檢查**: `GET /api/health`
- **任務狀態**: `GET /api/tasks`
- **儀表板**: `GET /api/dashboard/stats`
- **去重統計**: `GET /api/dedup/stats`

## Telegram 通知

- **Bot Token**: `8375770979:AAFuC3emSd05sjRxSyxpP6kTmd7LyKpA2cg`
- **主群組 Chat ID**: `-1003231629634`
- **閉環結果 Thread ID**: `1247`
- **API**: `https://api.telegram.org/bot<TOKEN>/sendMessage`

## GitHub

- **Repo**: `jacky6658/step1ne-headhunter-system`
- **Branch**: `main`
- **本地路徑**: `~/step1ne-headhunter-system`
