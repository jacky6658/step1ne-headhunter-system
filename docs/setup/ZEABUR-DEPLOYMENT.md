# Zeabur 部署指南

**更新日期**：2026-02-24  
**版本**：v1.0（系統架構修復）

---

## 📋 部署前檢查

### 本地驗證 ✅
- [x] 後端運行：`node server.js`
- [x] 前端運行：`npm run dev`
- [x] API 連接正常（235 位候選人）
- [x] 所有頁面改用 api.ts（自動環境偵測）

### GitHub 檢查 ✅
- [x] 所有檔案已 commit（134b744）
- [x] 推送到 GitHub

---

## 🚀 Zeabur 部署步驟

### 步驟 1：設置環境變數

在 **Zeabur Dashboard** → **Environment Variables** 中添加：

**前端環境變數**：
```
VITE_API_URL=https://api-hr.step1ne.com/api
```

**後端環境變數**：
```
NODE_ENV=production
SHEET_ID=1PunpaDAFBPBL_I76AiRYGXKaXDZvMl1c262SEtxRk6Q
GOOGLE_ACCOUNT=aijessie88@step1ne.com
PORT=3001
```

### 步驟 2：重新部署

1. 進入 **Zeabur Dashboard**
2. 選擇 **step1ne-headhunter-system** 專案
3. 選擇 **前端** 和 **後端** 服務
4. 點擊 **Redeploy**
5. 等待部署完成（約 5-10 分鐘）

### 步驟 3：驗證部署

部署完成後，檢查：

```bash
# 檢查後端
# health 不需認證
curl https://api-hr.step1ne.com/api/health

# 檢查前端
open https://hrsystem.step1ne.com
```

**應該看到**：
- 前端頁面正常顯示
- 職缺管理頁面顯示 27 個職缺
- 候選人池顯示 235 位候選人

---

## 🔧 環境變數配置說明

### 為什麼需要 VITE_API_URL？

`config/api.ts` 會自動偵測環境：

```typescript
const isDevelopment = import.meta.env.DEV || window.location.hostname === 'localhost';

export const API_BASE_URL = isDevelopment
  ? 'http://localhost:3001/api'        // 本地開發
  : 'https://api-hr.step1ne.com/api';  // 生產環境
```

但在 Zeabur 中，`import.meta.env.DEV` 會被設為 `false`，所以需要確保 `VITE_API_URL` 被正確設置。

**如果手動設置 VITE_API_URL**，則會覆蓋預設值：

```typescript
export const API_BASE_URL = import.meta.env.VITE_API_URL || (isDevelopment ? ... : ...);
```

### 後端環境變數

- **NODE_ENV=production**：啟用生產最佳化
- **SHEET_ID**：Google Sheets ID（履歷池v2）
- **GOOGLE_ACCOUNT**：gog CLI 認證帳號
- **PORT=3001**：後端埠號

---

## 📊 部署檢查清單

### 前端部署
- [ ] VITE_API_URL 已設置
- [ ] 前端頁面正常載入
- [ ] API 呼叫正確（檢查瀏覽器 DevTools → Network）
- [ ] 職缺、候選人數據顯示正常

### 後端部署
- [ ] NODE_ENV=production
- [ ] Google Sheets 連接正常（API 回應 235 位候選人）
- [ ] CORS 已正確配置（允許 https://hrsystem.step1ne.com）

### 整體系統
- [ ] 雲端域名可訪問
- [ ] 無 404 錯誤
- [ ] 無 CORS 錯誤
- [ ] API 回應正常

---

## 🐛 常見問題排查

### 問題 1：前端顯示空白

**原因**：API_BASE_URL 設置錯誤

**解決**：
1. 檢查瀏覽器 DevTools → Console
2. 確認 VITE_API_URL 環境變數已設置
3. 檢查後端是否正常運行

### 問題 2：CORS 錯誤

**原因**：後端未允許 Zeabur 前端域名

**解決**（在 server.js 添加）：
```javascript
app.use(cors({
  origin: ['https://hrsystem.step1ne.com', 'http://localhost:3000'],
  credentials: true
}));
```

### 問題 3：無法讀取候選人資料

**原因**：gog CLI 認證失敗

**解決**：
1. 確認 GOOGLE_ACCOUNT=aijessie88@step1ne.com
2. 檢查後端日誌：`❌ sheetsService v2 連線失敗`
3. 在 Zeabur 環境中重新認證 gog

---

## 📝 快速參考

### 本地開發
```bash
# 終端 1：後端
cd server && node server.js

# 終端 2：前端
npm run dev

# 訪問
open http://localhost:3000
```

### 生產環境（Zeabur）
- 前端：https://hrsystem.step1ne.com
- 後端 API：https://api-hr.step1ne.com/api
- 健康檢查：https://api-hr.step1ne.com/api/health

### 環境檢測（config/api.ts）
```typescript
// 自動偵測
- localhost → 本地開發
- Zeabur 域名 → 生產環境
```

---

## 📞 部署支持

如果部署時遇到問題：

1. **檢查後端日誌**：
   ```bash
   # health 不需認證
   curl https://api-hr.step1ne.com/api/health
   ```

2. **檢查前端控制台**（F12）：
   - Network 標籤：API 呼叫是否成功？
   - Console 標籤：是否有錯誤訊息？

3. **檢查環境變數**：
   - Zeabur Dashboard → Environment Variables
   - 確認 VITE_API_URL 已設置

---

**部署者**：YuQi  
**完成時間**：2026-02-24 02:50
