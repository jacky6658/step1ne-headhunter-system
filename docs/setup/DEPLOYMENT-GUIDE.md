# Step1ne Headhunter System - Zeabur 部署指南

> 🚀 完整的 Zeabur 部署步驟

---

## 📦 專案架構

本系統包含兩個部分：
1. **前端**：React 19 + Vite (部署為 Static Site)
2. **後端**：Node.js + Express API (連接 Google Sheets)

---

## 🎯 部署步驟

### **Part 1: 部署後端 API**

#### 1. 登入 Zeabur
前往 [https://zeabur.com](https://zeabur.com)

#### 2. 創建新專案
- 點擊 "Create Project"
- 專案名稱：`step1ne-headhunter-api`

#### 3. 添加 Node.js 服務
- 點擊 "Add Service"
- 選擇 "GitHub"
- 選擇倉庫：`jacky6658/step1ne-headhunter-system`
- 選擇分支：`main`
- Root Directory: **留空**（因為 server 在子目錄）

#### 4. 配置環境變數
在 Zeabur 服務設定中，添加以下環境變數：

```env
# Google Sheets 配置
SHEET_ID=1PunpaDAFBPBL_I76AiRYGXKaXDZvMl1c262SEtxRk6Q
GOOGLE_ACCOUNT=aijessie88@step1ne.com

# Port (Zeabur 會自動設定)
PORT=3001
```

#### 5. 設定啟動指令
在 Zeabur 服務設定中：
- Build Command: `cd server && npm install`
- Start Command: `cd server && npm start`

#### 6. 部署
點擊 "Deploy"，等待部署完成。

#### 7. 取得 API URL
部署完成後，Zeabur 會提供一個網址，例如：
```
https://step1ne-headhunter-api-xxx.zeabur.app
```

**記下這個網址**，稍後前端會用到。

---

### **Part 2: 部署前端**

#### 1. 在同一個專案中添加第二個服務
- 點擊 "Add Service"
- 選擇 "GitHub"
- 選擇倉庫：`jacky6658/step1ne-headhunter-system`
- 選擇分支：`main`

#### 2. 配置環境變數
在 Zeabur 服務設定中，添加以下環境變數：

```env
# 後端 API URL（使用 Part 1 取得的網址）
VITE_API_URL=https://step1ne-headhunter-api-xxx.zeabur.app

# Google Sheets
VITE_SHEET_ID=1PunpaDAFBPBL_I76AiRYGXKaXDZvMl1c262SEtxRk6Q
VITE_GOOGLE_ACCOUNT=aijessie88@step1ne.com

# Google Drive
VITE_DRIVE_FOLDER_ID=12lfoz7qwjhWMwbCJL_SfOf3icCOTCydS
```

#### 3. Zeabur 會自動偵測 Vite
- Build Command: `npm install && npm run build`
- Start Command: `npm run preview`
- 或讓 Zeabur 自動偵測

#### 4. 部署
點擊 "Deploy"，等待部署完成。

#### 5. 取得前端 URL
部署完成後，前端網址例如：
```
https://step1ne-headhunter-system-xxx.zeabur.app
```

---

## ✅ 部署檢查清單

### 後端 API
- [ ] 環境變數已設定（SHEET_ID, GOOGLE_ACCOUNT）
- [ ] 啟動指令正確（cd server && npm start）
- [ ] API 健康檢查：訪問 `https://your-api-url/api/health`
- [ ] 測試候選人 API：`https://your-api-url/api/candidates`

### 前端
- [ ] 環境變數已設定（VITE_API_URL）
- [ ] Build 成功（檢查 Zeabur logs）
- [ ] 訪問前端網址，應該看到登入頁面
- [ ] 登入測試：`jacky` / `jacky123`

---

## 🔧 常見問題

### Q1: 後端 API 無法連接 Google Sheets
**A**: 檢查 Zeabur 環境中是否已安裝 `gog` CLI。

**解決方案**：在 `server/package.json` 添加 postinstall script：
```json
{
  "scripts": {
    "postinstall": "npm install -g gog"
  }
}
```

或改用 Google Sheets API（需要 Service Account）。

### Q2: 前端無法讀取候選人資料
**A**: 檢查：
1. `VITE_API_URL` 環境變數是否正確
2. 後端 API 是否正常運行（訪問 `/api/health`）
3. CORS 是否正確設定（後端已包含 `cors()`）

### Q3: gog CLI 認證問題
**A**: Zeabur 環境中需要設定 Google OAuth。

**臨時解決方案**：
1. 使用 Google Sheets API (Service Account)
2. 或使用 Google Apps Script 作為中介層

---

## 🚀 快速測試

部署完成後，測試以下功能：

### 1. 測試後端 API
```bash
# 健康檢查
curl https://your-api-url/api/health

# 取得候選人
curl https://your-api-url/api/candidates
```

### 2. 測試前端
訪問 `https://your-frontend-url`
- 應該看到登入頁面
- 登入：`jacky` / `jacky123`
- 應該看到儀表板

---

## 📝 部署後設定

### 1. Google OAuth 設定（重要！）
由於 `gog` CLI 需要 OAuth 認證，在 Zeabur 環境中需要：

**選項 A：使用環境變數傳遞 Token**
```env
GOG_TOKEN=your_google_oauth_token
```

**選項 B：改用 Google Sheets API**
1. 建立 Google Service Account
2. 下載 JSON key
3. 將 key 設為環境變數：`GOOGLE_SERVICE_ACCOUNT_KEY`

### 2. 更新後端程式碼使用 Google Sheets API
修改 `server/server.js`，使用 `googleapis` 套件取代 `gog` CLI。

---

## 🔄 更新部署

當你修改程式碼後：

```bash
# 1. 提交變更
cd /Users/user/clawd/projects/step1ne-headhunter-system
git add .
git commit -m "Update: 描述你的更新"
git push origin main

# 2. Zeabur 會自動重新部署
```

---

## 📊 監控與日誌

### 查看後端日誌
在 Zeabur Dashboard：
1. 選擇後端服務
2. 點擊 "Logs"
3. 即時查看 console.log 輸出

### 查看前端日誌
1. 選擇前端服務
2. 點擊 "Logs"
3. 查看 Build logs 和 Runtime logs

---

## 🎯 下一步優化

部署成功後，可以考慮：

1. **升級資料庫**
   - 從 Google Sheets 遷移到 PostgreSQL
   - Zeabur 提供一鍵 PostgreSQL 服務

2. **整合 AI 功能**
   - 部署 Python AI 腳本（ai_matcher_v3.py 等）
   - 使用 Zeabur Functions 或另一個 Python 服務

3. **添加認證**
   - 整合 JWT 或 Firebase Auth
   - 目前使用簡單的帳號密碼

4. **效能優化**
   - 添加 Redis 快取
   - 使用 CDN 加速前端

---

## 📞 需要幫助？

如果部署遇到問題：
1. 檢查 Zeabur logs
2. 查看 README.md
3. 聯繫開發團隊

---

*Last updated: 2026-02-23*
*by YuQi AI 助理 🦞*
