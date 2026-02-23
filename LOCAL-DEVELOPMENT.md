# Step1ne 獵頭系統 - 本地開發指南

## 🚀 快速啟動

### 一鍵啟動（推薦）

```bash
./start-local.sh
```

這會自動：
- ✅ 檢查 Node.js 環境
- ✅ 安裝前後端依賴（如果需要）
- ✅ 啟動後端 API Server (Port 3001)
- ✅ 啟動前端 Dev Server (Port 5173)
- ✅ 自動開啟瀏覽器

---

### 手動啟動（進階）

#### 終端 1：啟動後端

```bash
cd server
npm install  # 首次需要
npm start
```

後端運行在：http://localhost:3001

#### 終端 2：啟動前端

```bash
npm install  # 首次需要
npm run dev
```

前端運行在：http://localhost:5173

---

## 🛑 停止服務

### 一鍵停止

```bash
./stop-local.sh
```

### 手動停止

按 `Ctrl+C` 停止各個終端的服務

---

## 📁 專案結構

```
step1ne-headhunter-system/
├── src/                    # 前端源碼
│   ├── components/         # React 組件
│   ├── pages/             # 頁面
│   ├── services/          # API 服務層
│   ├── types.ts           # TypeScript 型別定義
│   └── constants.ts       # 常數配置
├── server/                # 後端 API
│   ├── server.js          # Express 伺服器
│   ├── sheetsService.js   # Google Sheets 服務
│   └── .env               # 後端環境變數
├── .env                   # 前端環境變數
├── start-local.sh         # 啟動腳本
└── stop-local.sh          # 停止腳本
```

---

## ⚙️ 環境變數

### 前端 (`.env`)

```env
VITE_API_URL=http://localhost:3001
VITE_SHEET_ID=1PunpaDAFBPBL_I76AiRYGXKaXDZvMl1c262SEtxRk6Q
VITE_GOOGLE_ACCOUNT=aijessie88@step1ne.com
VITE_DRIVE_FOLDER_ID=12lfoz7qwjhWMwbCJL_SfOf3icCOTCydS
```

### 後端 (`server/.env`)

```env
PORT=3001
SHEET_ID=1PunpaDAFBPBL_I76AiRYGXKaXDZvMl1c262SEtxRk6Q
GOOGLE_ACCOUNT=aijessie88@step1ne.com
```

---

## 🧪 測試功能

1. **登入系統**
   - 訪問：http://localhost:5173
   - 測試帳號：
     - Admin (admin / 管理員)
     - Jacky Chen (jacky / 獵頭顧問)
     - Phoebe (phoebe / 獵頭顧問)

2. **候選人總表**
   - 查看 249 位候選人
   - 測試搜尋、篩選功能
   - 點擊「🔄 重新整理」測試快取清除

3. **候選人看板**
   - 拖放候選人卡片測試狀態更新

4. **權限測試**
   - 登入 Jacky → 只看到 Jacky 負責的候選人
   - 登入 Admin → 看到所有候選人

---

## 🔧 開發工具

### 熱重載

- ✅ 前端：修改 `src/` 檔案自動重新載入
- ✅ 後端：需要手動重啟（或使用 `nodemon`）

### 瀏覽器開發工具

- **React DevTools**：檢查組件狀態
- **Console**：查看 API 呼叫記錄
- **Network**：監控 API 請求

### API 測試

```bash
# 測試後端健康檢查
curl http://localhost:3001/api/health

# 測試用戶列表
curl http://localhost:3001/api/users

# 測試候選人列表
curl http://localhost:3001/api/candidates
```

---

## 📝 常見問題

### Q1: Port 已被占用

**錯誤**：`Error: listen EADDRINUSE: address already in use :::3001`

**解決方案**：
```bash
# 找到並停止佔用的進程
lsof -ti:3001 | xargs kill
lsof -ti:5173 | xargs kill

# 或使用停止腳本
./stop-local.sh
```

---

### Q2: 修改後端程式碼不生效

**原因**：後端沒有自動重載

**解決方案**：
```bash
# 手動重啟後端
cd server
npm start
```

**或安裝 nodemon（推薦）**：
```bash
cd server
npm install --save-dev nodemon
```

修改 `server/package.json`：
```json
"scripts": {
  "start": "node server.js",
  "dev": "nodemon server.js"
}
```

然後使用：
```bash
npm run dev
```

---

### Q3: 候選人資料不顯示

**可能原因**：
1. Google Sheets API 連接問題
2. 快取問題

**解決方案**：
```javascript
// 在瀏覽器 Console 執行
localStorage.clear();
location.reload();
```

---

### Q4: Sidebar 不顯示

**原因**：用戶資料格式錯誤

**解決方案**：
1. 清除 localStorage（同上）
2. 檢查 Console 錯誤訊息
3. 確認後端 `/api/users/:id` 端點正常

---

## 🚀 部署到 Zeabur

確認本地測試無誤後：

```bash
# 1. 提交變更
git add .
git commit -m "本地測試完成，準備部署"
git push

# 2. Zeabur 會自動部署
# 前端：https://step1ne.zeabur.app
# 後端：https://backendstep1ne.zeabur.app
```

**環境變數設定**（Zeabur）：
- 前端：`VITE_API_URL=https://backendstep1ne.zeabur.app`
- 後端：同本地設定

---

## 📚 相關文件

- [README.md](./README.md) - 專案總覽
- [DEPLOYMENT-GUIDE.md](./DEPLOYMENT-GUIDE.md) - Zeabur 部署指南
- [QUICK-START.md](./QUICK-START.md) - 快速開始

---

**建立日期**：2026-02-23  
**最後更新**：2026-02-23
