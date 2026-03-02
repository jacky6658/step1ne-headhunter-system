# 快速開始指南

> ⚡ 5 分鐘本地開發環境設置

---

## 📋 前置需求

- Node.js 18+ 
- npm 或 pnpm
- `gog` CLI (Google Sheets 存取)

---

## 🚀 本地開發

### 1. Clone 專案
```bash
git clone https://github.com/jacky6658/step1ne-headhunter-system.git
cd step1ne-headhunter-system
```

### 2. 安裝前端依賴
```bash
npm install
```

### 3. 安裝後端依賴
```bash
cd server
npm install
cd ..
```

### 4. 設定環境變數
```bash
cp .env.example .env
```

編輯 `.env`：
```env
VITE_API_URL=http://localhost:3001
VITE_SHEET_ID=1PunpaDAFBPBL_I76AiRYGXKaXDZvMl1c262SEtxRk6Q
VITE_GOOGLE_ACCOUNT=aijessie88@step1ne.com
```

### 5. 啟動後端 API (Terminal 1)
```bash
cd server
npm start
```

後端運行在 `http://localhost:3001`

### 6. 啟動前端 (Terminal 2)
```bash
npm run dev
```

前端運行在 `http://localhost:5173`

### 7. 登入系統
開啟瀏覽器訪問 `http://localhost:5173`

預設帳號：
- **Jacky**: `jacky` / `jacky123`
- **Phoebe**: `phoebe` / `phoebe123`

---

## ✅ 測試 API

### 健康檢查
```bash
curl http://localhost:3001/api/health
```

### 取得候選人列表
```bash
curl http://localhost:3001/api/candidates
```

### 新增候選人
```bash
curl -X POST http://localhost:3001/api/candidates \
  -H "Content-Type: application/json" \
  -d '{
    "name": "測試候選人",
    "email": "test@example.com",
    "phone": "0912345678",
    "position": "軟體工程師",
    "years": 3,
    "jobChanges": 2,
    "avgTenure": 1.5,
    "skills": "Python, React",
    "stabilityScore": 70,
    "status": "待聯繫",
    "source": "LinkedIn"
  }'
```

---

## 🔧 開發工具

### VS Code 推薦擴充
- ESLint
- Prettier
- TypeScript Vue Plugin (Volar)
- Tailwind CSS IntelliSense

### 開發指令
```bash
# 前端開發
npm run dev

# 前端 Build
npm run build

# 前端 Preview (Production mode)
npm run preview

# 後端開發 (Auto-reload)
cd server
npm run dev
```

---

## 📂 專案結構

```
step1ne-headhunter-system/
├── components/          # React 組件
├── pages/              # 頁面路由
├── services/           # 業務邏輯層
├── server/             # 後端 API
│   ├── server.js       # Express 伺服器
│   └── package.json
├── types.ts            # TypeScript 型別
├── constants.ts        # 常數定義
├── App.tsx             # 主應用
└── README.md
```

---

## 🐛 常見問題

### Q: `gog: command not found`
**A**: 安裝 gog CLI：
```bash
npm install -g @openclaw/gog
```

### Q: Google Sheets 認證失敗
**A**: 執行 OAuth 認證：
```bash
gog auth login
```

### Q: 前端無法連接後端
**A**: 檢查：
1. 後端是否運行（`http://localhost:3001/api/health`）
2. `.env` 中的 `VITE_API_URL` 是否正確
3. CORS 設定（後端已啟用）

---

## 🎯 下一步

- 閱讀 [README.md](./README.md) 了解完整功能
- 查看 [DEPLOYMENT-GUIDE.md](./DEPLOYMENT-GUIDE.md) 學習部署到 Zeabur
- 探索 [系統設計文檔](../resume-pool-system/SYSTEM-DESIGN.md)

---

*Happy Coding! 🦞*
