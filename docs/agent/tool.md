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

## BD 客戶開發（陌生開發信閉環）

### Google Sheet
- **Sheet ID**: `待設定`
- **Sheet 名稱**: `BD 客戶名單`
- **Schema 欄位**: 日期 | 來源活動 | 公司 | 產業 | 規模 | 職稱 | 姓名 | Email | 電話 | LinkedIn | 切角類型 | 開發優先級 | 開發信狀態 | 備註

### Gmail Draft
- **模式**: 只建立草稿，**永遠不自動寄出**
- **寄件人**: Jacky 的 Gmail（需 Gmail API 授權）
- **簽名檔**: Step1ne 獵頭顧問團隊

### Web Search 情報蒐集目標
- 104 人力銀行（該公司目前開的職缺）
- LinkedIn（公司頁面、員工數、近期動態）
- Google 新聞（融資、擴編、併購、產品發布）
- 經濟日報 / 工商時報（產業新聞）
- 公司官網（About、Careers 頁面）

### 切角類型定義
| 切角 | 觸發條件 | 開場白方向 |
|------|---------|-----------|
| 擴編切角 | 104 開 5+ 職缺，或新聞提到擴編 | 「看到貴司正在擴充 XX 團隊...」 |
| 新聞切角 | 近 3 個月有融資/併購/上市新聞 | 「看到貴司剛完成 XX，團隊建置是關鍵...」 |
| 痛點切角 | 同產業普遍缺特定人才 | 「XX 產業普遍面臨 OO 人才短缺...」 |
| 人脈切角 | 我們有該產業成功案例 | 「我們之前協助 [同產業客戶] 成功招募了...」 |
| 職缺切角 | 手上有匹配該公司需求的人選 | 「注意到貴司在找 XX，我們手上有幾位...」 |

### 開發優先級
- 🔴 高：有明確擴編需求、近期新聞熱度高、職缺數 > 5
- 🟡 中：有潛在需求、產業趨勢向上
- ⚪ 低：無明確訊號、觀望追蹤

### 開發信模板規則
- **Email**：300 字內，Subject 必須含公司名 + 切角關鍵詞
- **LinkedIn**：150 字內，口語化，直接切入
- **電話開場白**：提供給顧問參考，不自動撥打

## GitHub

- **Repo**: `jacky6658/step1ne-headhunter-system`
- **Branch**: `main`
- **本地路徑**: `~/step1ne-headhunter-system`
