# Zeabur 環境安裝 gog CLI 方案

## 🎯 目標
在 Zeabur 環境安裝 gog CLI，讓 sheetsService-v2.js 正常運作，恢復完整 CRUD 功能。

---

## 📋 前置需求

### 1. gog CLI 安裝方式
```bash
# 方法 A：npm 安裝（推薦 - Zeabur 支援）
npm install -g @google/gog

# 方法 B：下載二進位檔（如果 npm 不可用）
# 需要在 Dockerfile 中執行
```

### 2. OAuth 認證檔案
需要 `aijessie88@step1ne.com` 的 OAuth token：
```
~/.config/gog/accounts/aijessie88@step1ne.com/
```

---

## 🚀 解決方案（3 種選項）

### **選項 A：使用環境變數 + npm 安裝**（推薦）

#### 步驟 1：修改 package.json
```json
{
  "dependencies": {
    "@google/gog": "^latest"
  },
  "scripts": {
    "postinstall": "gog version || npm install -g @google/gog"
  }
}
```

#### 步驟 2：在 Zeabur 設定環境變數
```bash
GOG_ACCOUNT=aijessie88@step1ne.com
GOG_TOKEN=<從本地複製>
```

#### 步驟 3：啟動腳本自動認證
修改 `server/index.js`（啟動前執行）：
```javascript
// 自動設定 gog 認證
if (process.env.GOG_TOKEN) {
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  
  const configDir = path.join(os.homedir(), '.config', 'gog', 'accounts', process.env.GOG_ACCOUNT);
  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(
    path.join(configDir, 'token.json'),
    process.env.GOG_TOKEN
  );
}
```

---

### **選項 B：Dockerfile 自訂安裝**

新增 `Dockerfile`：
```dockerfile
FROM node:18-alpine

# 安裝 gog CLI
RUN npm install -g @google/gog

# 複製專案
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# 環境變數
ENV GOG_ACCOUNT=aijessie88@step1ne.com

# 啟動
CMD ["npm", "start"]
```

Zeabur 設定：
- 使用自訂 Dockerfile
- 加入環境變數 `GOG_TOKEN`

---

### **選項 C：改用 Google Sheets API**（長期方案）

優點：
- ✅ 不依賴 gog CLI
- ✅ 官方 API，穩定可靠
- ✅ 支援完整 CRUD

缺點：
- ❌ 需要修改程式碼（約 2-3 小時）
- ❌ 需要 Service Account JSON

---

## 📝 推薦執行順序

### 🥇 **立即方案**（今天執行）
使用 **選項 A**（環境變數 + npm）：
1. 本地取得 OAuth token
2. 加入 Zeabur 環境變數
3. 修改啟動腳本
4. 部署驗證

**預估時間**：30 分鐘

---

### 🥈 **備用方案**（明天執行）
如果選項 A 失敗，改用 **選項 B**（Dockerfile）：
1. 撰寫 Dockerfile
2. 測試本地 build
3. Zeabur 部署

**預估時間**：1 小時

---

### 🥉 **長期方案**（下週執行）
實作 **選項 C**（Google Sheets API）：
1. 建立 Service Account
2. 修改 sheetsService-v2.js
3. 完整測試

**預估時間**：2-3 小時

---

## 🔍 取得 OAuth Token 步驟

```bash
# 1. 本地查看 token
cat ~/.config/gog/accounts/aijessie88@step1ne.com/token.json

# 2. 複製完整 JSON（包含 refresh_token）

# 3. 在 Zeabur 設定環境變數
#    名稱：GOG_TOKEN
#    值：<完整 JSON 字串>
```

---

## ⚠️ 注意事項

1. **Token 安全**：
   - 使用 Zeabur 環境變數（加密）
   - 不要提交到 Git

2. **Token 過期**：
   - OAuth token 有效期：60 天
   - 設定自動更新機制

3. **備份方案**：
   - 保留 sheetsService-csv.js
   - server.js 自動降級（gog 不可用時用 CSV）

---

## 📊 方案比較

| 方案 | 難度 | 時間 | 穩定性 | 推薦 |
|------|------|------|--------|------|
| 選項 A（環境變數） | ⭐ | 30min | ⭐⭐⭐ | ✅ 推薦 |
| 選項 B（Dockerfile） | ⭐⭐ | 1h | ⭐⭐⭐⭐ | 🔄 備用 |
| 選項 C（官方 API） | ⭐⭐⭐ | 2-3h | ⭐⭐⭐⭐⭐ | 🔜 長期 |

---

## 🚀 立即執行（選項 A）

要我現在開始執行選項 A 嗎？

步驟：
1. ✅ 讀取本地 OAuth token
2. ✅ 修改 server.js 啟動腳本
3. ✅ 提供環境變數設定指令
4. ✅ 部署驗證

預計 **30 分鐘**完成。
