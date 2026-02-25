# 部署 + 使用指南 - 方案 A + B

## 📋 快速檢查清單

- [ ] PostgreSQL 連線字串已取得
- [ ] Node.js 環境 (`npm install` 完成)
- [ ] 環境變數已設定
- [ ] 初始化腳本已執行
- [ ] 服務器已啟動
- [ ] 前端 API 端點已改進

---

## 1️⃣ PostgreSQL 初始化（Zeabur）

### 步驟 1：連線到 PostgreSQL

```bash
# 使用 psql 或任何 PostgreSQL 客戶端
psql postgresql://root:etUh2zkR4Mr8gfWLs059S7Dm1T6Yby3Q@tpe1.clusters.zeabur.com:27883/zeabur
```

### 步驟 2：執行初始化腳本

```bash
# 在 PostgreSQL 提示符下執行
\i server/db/init-postgres.sql
```

或者直接：

```bash
psql postgresql://root:etUh2zkR4Mr8gfWLs059S7Dm1T6Yby3Q@tpe1.clusters.zeabur.com:27883/zeabur < server/db/init-postgres.sql
```

### 步驟 3：驗證表已建立

```sql
\dt
-- 應該看到：
-- - candidates_pipeline
-- - google_sheets_sync_log
-- - candidates_sync
```

---

## 2️⃣ 後端設定（Node.js）

### 步驟 1：安裝依賴

```bash
cd /Users/user/clawd/projects/step1ne-headhunter-skill
npm install express cors body-parser pg dotenv
```

### 步驟 2：建立 `.env` 檔案

```bash
cat > server/.env << 'EOF'
# PostgreSQL 連線
DATABASE_URL=postgresql://root:etUh2zkR4Mr8gfWLs059S7Dm1T6Yby3Q@tpe1.clusters.zeabur.com:27883/zeabur

# Google Sheets
SHEET_ID=1PunpaDAFBPBL_I76AiRYGXKaXDZvMl1c262SEtxRk6Q

# 伺服器設定
PORT=3001
NODE_ENV=development

# 前端 URL（CORS）
FRONTEND_URL=http://localhost:3000,https://step1ne.com
EOF
```

### 步驟 3：本地測試

```bash
cd server
node server.js
```

應該看到：
```
✅ PostgreSQL connected at [timestamp]
🚀 Step1ne Backend Started
📍 http://localhost:3001
```

### 步驟 4：測試 API

```bash
# 健康檢查
curl http://localhost:3001/api/health

# 應該返回：
# {"success":true,"status":"ok","database":"ok"}
```

---

## 3️⃣ 前端改進（React）

### 步驟 1：改進 API 工具函數

參考 `FRONTEND-INTEGRATION.md` 的「4️⃣ 新增 API 工具函數」

### 步驟 2：改進關鍵元件

- `AIMatchingPage.tsx` → 改 `handleStatusChange`
- `Pipeline.tsx` → 改 `saveProgress`
- `CandidateList.tsx` → 改 `loadCandidates`

### 步驟 3：設定環境變數

```bash
# .env.local（本地）
REACT_APP_API_URL=http://localhost:3001/api

# .env.production（Zeabur）
REACT_APP_API_URL=https://backendstep1ne.zeabur.app/api
```

---

## 4️⃣ 部署到 Zeabur

### 步驟 1：推送代碼到 GitHub

```bash
cd /Users/user/clawd/projects/step1ne-headhunter-skill
git add server/
git commit -m "feat: add SQL + Google Sheets sync (Plan A+B)"
git push
```

### 步驟 2：Zeabur 後端部署

1. 登入 Zeabur Dashboard
2. 找到 `backendstep1ne` 服務
3. 確認環境變數已設定：
   ```
   DATABASE_URL=postgresql://root:...
   SHEET_ID=1PunpaDAFBPBL_I76AiRYGXKaXDZvMl1c262SEtxRk6Q
   FRONTEND_URL=https://step1ne.com
   ```
4. 點擊「Redeploy」
5. 等待部署完成（5-10 分鐘）

### 步驟 3：驗證部署

```bash
curl https://backendstep1ne.zeabur.app/api/health

# 應該返回：
# {"success":true,"status":"ok","database":"ok"}
```

### 步驟 4：前端部署

1. Zeabur Dashboard → 找到前端服務
2. 確認 `REACT_APP_API_URL=https://backendstep1ne.zeabur.app/api`
3. 點擊「Redeploy」
4. 驗證：打開 https://step1ne.zeabur.app，改狀態測試

---

## 5️⃣ 監控 + 調試

### 查看後端日誌

```bash
# Zeabur
Zeabur Dashboard → Logs 標籤

# 本地
# 直接在終端看，或：
tail -f server/logs/server.log
```

### 查看 PostgreSQL 連線狀態

```bash
# 連線到 PostgreSQL
psql postgresql://root:etUh2zkR4Mr8gfWLs059S7Dm1T6Yby3Q@tpe1.clusters.zeabur.com:27883/zeabur

# 查看所有候選人
SELECT name, status, consultant, last_updated FROM candidates_pipeline LIMIT 10;

# 查看同步日誌
SELECT candidate_id, action, new_status, synced_to_sheets, sync_timestamp 
FROM google_sheets_sync_log 
ORDER BY sync_timestamp DESC 
LIMIT 10;
```

### 手動觸發同步

```bash
curl -X POST http://localhost:3001/api/sync/pending
```

---

## 6️⃣ 故障排查

### 問題：改狀態後仍然會回退

**檢查清單**：
1. ✅ 後端是否收到 PUT 請求？
   - 檢查後端日誌
   - 檢查瀏覽器 Network 標籤

2. ✅ PostgreSQL 是否更新？
   ```sql
   SELECT * FROM candidates_pipeline WHERE candidate_id = 'xxx';
   ```

3. ✅ Google Sheets 是否同步？
   - 等待 5 秒
   - 檢查 Sheets 的 Status 欄（S 欄）
   - 檢查 `google_sheets_sync_log` 表

### 問題：API 返回 500 錯誤

**檢查**：
```bash
# 1. 後端日誌
cat server/logs/server.log | tail -50

# 2. PostgreSQL 連線
psql $DATABASE_URL -c "SELECT 1"

# 3. Google Sheets 權限
gog sheets list
```

### 問題：Google Sheets 沒有同步

**原因**：
- gog CLI 沒有授權 → 執行 `gog auth`
- Sheets ID 不對 → 檢查 SHEET_ID 環境變數
- 候選人名稱不匹配 → 檢查拼寫

---

## 7️⃣ 效能優化

### 批量操作最佳實踐

```javascript
// 不好：一次改 100 筆，會很慢
for (let i = 0; i < 100; i++) {
  await updateStatus(ids[i], 'contacted');
}

// 好：分批，間隔延遲
for (let i = 0; i < ids.length; i += 20) {
  const batch = ids.slice(i, i + 20);
  await Promise.all(batch.map(id => updateStatus(id, 'contacted')));
  await new Promise(r => setTimeout(r, 2000)); // 延遲 2 秒
}
```

### 查詢優化

```sql
-- 加速查詢
CREATE INDEX idx_status ON candidates_pipeline(status);
CREATE INDEX idx_consultant ON candidates_pipeline(consultant);
CREATE INDEX idx_updated ON candidates_pipeline(last_updated DESC);
```

---

## 8️⃣ 完整檢查清單

### 本地開發環境
- [ ] Node.js v14+
- [ ] npm/yarn 已安裝
- [ ] PostgreSQL 初始化完成
- [ ] `.env` 檔案已配置
- [ ] 後端啟動 `node server.js`
- [ ] 前端啟動 `npm start`
- [ ] API 健康檢查通過

### 測試驗證
- [ ] 改狀態 + 刷新 = 狀態保留
- [ ] 改狀態 + 登出 = 狀態保留
- [ ] 改狀態 + 等待 = Google Sheets 同步
- [ ] 批量改狀態 = 無 API 限流

### 生產部署（Zeabur）
- [ ] GitHub 推送完成
- [ ] 環境變數設定正確
- [ ] 後端 Redeploy 成功
- [ ] 前端 Redeploy 成功
- [ ] API 端點可訪問
- [ ] PostgreSQL 備份完成

---

## 📞 支援

如有問題，檢查：
1. 後端日誌 → 定位錯誤
2. PostgreSQL 狀態 → 確認連線
3. Google Sheets 同步日誌 → 追蹤同步狀態
4. 前端 Network 標籤 → 確認 API 呼叫

---

**部署時間預估**：
- 本地設定：10-15 分鐘
- 前端改進：30-45 分鐘
- Zeabur 部署：10-15 分鐘
- **總計：50-75 分鐘** ✅
