# Step1ne 連結指南 - 如何讓其他龍蝦連結到系統

## 🎯 三種連結方式

---

## 方案 1️⃣：直接訪問線上系統（最簡單）

### 適用對象
- 👥 所有團隊成員（Jacky、Phoebe、Admin）
- 💼 客戶或外部顧問
- 📱 任何裝置（電腦/平板/手機）

### 連結步驟

**步驟 1**：開啟瀏覽器

**步驟 2**：訪問以下網址
```
https://hrsystem.step1ne.com
```

**步驟 3**：選擇帳號登入
- **Admin** - 管理員（查看所有候選人）
- **Jacky** - 獵頭顧問（只看 Jacky 負責的候選人）
- **Phoebe** - 獵頭顧問（只看 Phoebe 負責的候選人）

**完成！** 🎉 立刻可以使用系統。

### 功能
- ✅ 查看候選人總表（249 位）
- ✅ 搜尋與篩選（姓名、技能、狀態、顧問）
- ✅ 查看候選人詳情
- ✅ 查看綜合評級（S/A+/A/B/C）
- ✅ 自動快取 30 分鐘（手動刷新按鈕）

### 優點
- 不需安裝任何軟體
- 自動同步 Google Sheets 資料
- PM2 管理本機服務、Cloudflare Tunnel 對外
- 響應式設計（手機友善）

### 缺點
- 需要網路連線
- 唯讀模式（寫入需透過 Google Sheets）

---

## 方案 2️⃣：OpenClaw AI 整合（給 AI 助理）

### 適用對象
- 🤖 Phoebe 的 AI 助理（@HRyuqi_bot）
- 🤖 Jacky 的 AI 助理（@YuQi0923_bot）
- 🛠️ 任何 OpenClaw 用戶的 AI

### 連結步驟

**步驟 1**：在 AI 的 `TOOLS.md` 或 `AGENTS.md` 中加入 API 資訊

```markdown
## Step1ne 獵頭系統 API

### API Endpoint
- **Production**: https://api-hr.step1ne.com/api
- **Local**: http://localhost:3001/api

### 認證（必須）
所有 API 請求都需要帶 Authorization Header：
Authorization: Bearer <API_SECRET_KEY>

OpenClaw 端點用不同的 Header：
X-OpenClaw-Key: <OPENCLAW_API_KEY>

### 可用 API

#### 1. 取得候選人列表
GET /api/candidates?limit=2000

#### 2. 取得單一候選人
GET /api/candidates/:id

#### 3. 新增候選人
POST /api/candidates

#### 4. 批量匯入候選人（最多 100 筆）
POST /api/candidates/bulk

#### 5. 更新 Pipeline 狀態
PUT /api/candidates/:id/pipeline-status

### 範例（使用 curl）

# 取得所有候選人（⚠️ 必須帶 Authorization header）
curl -H "Authorization: Bearer YOUR_API_KEY" \
  'https://api-hr.step1ne.com/api/candidates?limit=2000'

# 新增候選人
curl -X POST -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"王小明","position":"Frontend","email":"wang@test.com","actor":"Jacky-aibot"}' \
  https://api-hr.step1ne.com/api/candidates
```

**步驟 2**：AI 可以直接呼叫 API

```bash
# 方式 A：使用 exec tool（⚠️ 記得帶 -H "Authorization: Bearer KEY"）
openclaw exec 'curl -H "Authorization: Bearer YOUR_API_KEY" https://api-hr.step1ne.com/api/candidates?limit=2000'

# 方式 B：使用 fetch (如果有 web_fetch tool)
# web_fetch("https://api-hr.step1ne.com/api/candidates?limit=2000", headers={"Authorization": "Bearer YOUR_API_KEY"})
```

**步驟 3**：解析 JSON 並使用資料

### 優點
- ✅ AI 可以自動查詢候選人
- ✅ 可以整合到自動化流程
- ✅ 支援評級功能
- ✅ 即時資料

### 缺點
- ❌ 需要網路連線
- ❌ 唯讀模式（寫入需 Google Sheets API 或 gog CLI）

### 範例場景

**場景 1：AI 自動推薦候選人**
```
用戶: "找 3 位 Python 工程師"

AI 流程:
1. curl GET /api/candidates
2. 篩選技能包含 "Python"
3. 按評級排序（S > A+ > A）
4. 返回 Top 3
```

**場景 2：自動評級新履歷**
```
用戶上傳履歷 → AI 解析 → POST /api/candidates/:id/grade → 返回評級
```

---

## 方案 3️⃣：本地開發環境（給開發者）

### 適用對象
- 👨‍💻 開發者（需要修改程式碼）
- 🧪 測試環境
- 🔧 需要完整控制的場景

### 連結步驟

**步驟 1**：Clone 專案

```bash
cd ~/clawd/projects
git clone https://github.com/jacky6658/step1ne-headhunter-system.git
cd step1ne-headhunter-system
```

**步驟 2**：設定環境變數

已有預設設定檔案：
- `.env` - 前端環境變數
- `server/.env` - 後端環境變數

**步驟 3**：啟動系統

```bash
# 方式 A：一鍵啟動（推薦）
./start-local.sh

# 方式 B：手動啟動
cd server && npm install && npm start &
npm install && npm run dev
```

**步驟 4**：訪問本地系統

- **前端**: http://localhost:3000
- **後端**: http://localhost:3001

**步驟 5**：停止系統

```bash
./stop-local.sh
```

### 優點
- ✅ 完整功能（讀寫）
- ✅ 可離線使用
- ✅ 可自訂修改
- ✅ 熱重載（開發友善）

### 缺點
- ❌ 需要安裝 Node.js
- ❌ 需要 Clone 專案
- ❌ 資料不同步（本地 vs 線上）

### 詳細文檔
請閱讀 `LOCAL-DEVELOPMENT.md` 完整指南。

---

## 🔐 權限管理

### 目前帳號

| 帳號 | Username | 角色 | 權限 |
|------|----------|------|------|
| Admin | admin | ADMIN | 查看所有候選人 |
| Jacky | jacky | REVIEWER | 只看 Jacky 負責的候選人 |
| Phoebe | phoebe | REVIEWER | 只看 Phoebe 負責的候選人 |

### 新增帳號

**方式 A：修改後端程式碼**（永久）

編輯 `server/server.js`：

```javascript
const users = [
  {
    id: '1',
    username: 'admin',
    name: 'Admin',
    email: 'admin@step1ne.com',
    role: 'ADMIN',
    consultant: 'Admin'
  },
  {
    id: '4',  // 新增
    username: 'newuser',
    name: '新顧問',
    email: 'new@step1ne.com',
    role: 'REVIEWER',
    consultant: '新顧問'
  }
];
```

**方式 B：未來支援（待開發）**

- 動態新增用戶（Admin 介面）
- OAuth 登入整合
- 角色權限細化

---

## 📱 Telegram Bot 整合

### 讓 AI Bot 可以查詢候選人

**步驟 1**：在 Bot 的技能包中加入 API

編輯 `~/clawd/TOOLS.md` 或相關技能檔案：

```markdown
## Step1ne API

當用戶詢問候選人相關問題時，使用以下 API：

### 認證
所有請求必須帶 Header：
Authorization: Bearer <API_SECRET_KEY>

### 查詢候選人
curl -H "Authorization: Bearer YOUR_API_KEY" \
  'https://api-hr.step1ne.com/api/candidates?limit=2000'

### 篩選範例
# 找 Python 工程師
curl -H "Authorization: Bearer YOUR_API_KEY" \
  'https://api-hr.step1ne.com/api/candidates?limit=2000' \
  | jq '.data[] | select(.skills | contains("Python"))'

# 找 S 級候選人
curl -H "Authorization: Bearer YOUR_API_KEY" \
  'https://api-hr.step1ne.com/api/candidates?limit=2000' \
  | jq '.data[] | select(.talentGrade == "S")'
```

**步驟 2**：Bot 自動呼叫

當用戶問「有沒有 Python 工程師」時，Bot 會：
1. 執行 `curl -H "Authorization: Bearer KEY" 'https://api-hr.step1ne.com/api/candidates?limit=2000'`
2. 解析 JSON
3. 篩選 `skills` 欄位包含 "Python"
4. 返回候選人名單

---

## 🌐 分享給外部用戶

### 方式 A：分享連結（唯讀）

直接分享 https://hrsystem.step1ne.com

**適合**：
- 客戶查看候選人
- 外部顧問協作
- 快速展示系統

**限制**：
- 需要帳號（目前只有 Admin/Jacky/Phoebe）
- 唯讀模式

### 方式 B：API 金鑰（待開發）

未來可支援：
- 生成 API Token
- 第三方應用整合
- Webhook 通知

---

## 🛠️ 常見問題

### Q1: Phoebe 如何開始使用？

**A**: 最簡單方式：
1. 開啟 https://hrsystem.step1ne.com
2. 點擊「Phoebe」帳號
3. 立刻可以看到 Phoebe 負責的候選人

### Q2: AI 如何自動查詢候選人？

**A**: 在 AI 的工具配置中加入（⚠️ 必須帶認證 Header）：
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  'https://api-hr.step1ne.com/api/candidates?limit=2000'
```

AI 可以用 `exec` tool 呼叫，解析 JSON 後回答用戶問題。

### Q3: 如何讓多個 AI 都能用？

**A**: 
1. 將 API 資訊寫入共享文檔（如 `~/clawd/TOOLS.md`）
2. 所有 AI 讀取此文檔即可知道如何呼叫 API
3. 或使用 OpenClaw Skill 包裝成技能

### Q4: 資料會同步嗎？

**A**: 
- ✅ 龍蝦主機系統：自動同步 Google Sheets（每 30 分鐘快取）
- ✅ API 呼叫：即時資料
- ❌ 本地環境：不同步（獨立資料）

### Q5: 如何新增帳號？

**A**: 目前需要修改 `server/server.js` 的 `users` 陣列。
未來版本會支援 Admin 介面動態新增。

---

## 📞 需要協助？

**問題回報**: GitHub Issues  
**即時協助**: Telegram @YuQi0923_bot  
**文檔**: LOCAL-DEVELOPMENT.md

---

**最後更新**: 2026-03-13
**維護者**: YuQi (@YuQi0923_bot)
