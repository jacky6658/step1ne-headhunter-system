# Step1ne 獵頭顧問 AI 協作系統

> 🦞 完整的候選人管理、AI 智慧配對、進度追蹤平台

基於 React 19 的專業獵頭管理系統，整合 AI 配對、穩定度預測、文化匹配等智慧功能。

---

## 🎯 核心功能

### 📋 候選人管理
- **候選人總表**：228+ 筆候選人資料，支援搜尋、篩選、排序
- **候選人詳情**：完整履歷、工作經歷時間軸、穩定度評分
- **Kanban 看板**：視覺化追蹤候選人流程（待聯繫 → 面試 → Offer → 上職）
- **進度記錄**：每次聯繫、面試、Offer 的完整歷程

### 🤖 AI 智慧功能
- **AI 智慧配對**：職缺 ↔ 候選人自動推薦（P0/P1/P2 分級）
- **穩定度預測**：基於工作經歷預測候選人穩定性（0-100 分）
- **文化匹配**：10 維度文化契合度分析
- **履歷自動解析**：PDF 自動提取結構化資訊

### 💼 職缺管理
- **職缺列表**：招募中職缺管理
- **AI 推薦**：自動推薦最適合候選人
- **進度追蹤**：每個職缺的候選人 Pipeline

### 👥 多顧問協作
- **獨立 Pipeline**：Jacky、Phoebe 各自的候選人追蹤
- **協作看板**：共享候選人池，避免重複聯繫
- **績效追蹤**：成功推薦、保證期追蹤

### 📊 數據分析
- **儀表板**：候選人來源、狀態分布、成功率統計
- **財務分析**：推薦費用、保證期追蹤、退費率
- **趨勢圖表**：招募效率、AI 配對準確率

---

## 📚 文檔 & 工作流程

| 文檔 | 說明 |
|------|------|
| **[🎯 AI 候選人評分工作流程](./docs/CANDIDATE_EVALUATION.md)** | **新手必讀！** 完整的 AI 評分、面試問題生成、批量更新指南。包含 Python 範例、常見陷阱、完整案例。 |
| [📡 API 文檔](./docs/API.md) | 後端 API 端點完整說明 |
| [🚀 Zeabur 部署指南](./docs/ZEABUR-DEPLOYMENT.md) | 雲端部署步驟 |

---

## 🏗️ 技術架構

### 前端
- **框架**: React 19 + TypeScript + Vite
- **樣式**: Tailwind CSS
- **圖表**: Recharts
- **拖放**: React DnD (Kanban)

### 資料層
- **主要儲存**: Google Sheets (履歷池 v2)
- **本地快取**: LocalStorage (離線支援)
- **同步**: 雙向同步 (前端 ↔ Sheets)

### AI 功能
- **AI 配對**: Python (`ai_matcher_v3.py`)
- **穩定度預測**: Python (`stability_predictor.py`)
- **文化匹配**: Python (`culture_matcher.py`)
- **履歷解析**: Python (`resume-parser-v2.py`)

---

## 🚀 快速開始

### 1. 安裝依賴
```bash
npm install
```

### 2. 環境變數設定
建立 `.env` 檔案：
```env
# Google Sheets
VITE_SHEET_ID=1PunpaDAFBPBL_I76AiRYGXKaXDZvMl1c262SEtxRk6Q
VITE_GOOGLE_ACCOUNT=aijessie88@step1ne.com

# Google Drive (履歷檔案儲存)
VITE_DRIVE_FOLDER_ID=12lfoz7qwjhWMwbCJL_SfOf3icCOTCydS
```

### 3. 啟動開發伺服器
```bash
npm run dev
```

應用程式將在 `http://localhost:5173` 啟動。

### 4. 登入系統
預設帳號：
- **Jacky**: `jacky` / `jacky123`
- **Phoebe**: `phoebe` / `phoebe123`

---

## 📂 專案結構

```
├── /components          # UI 元件
│   ├── /candidates      # 候選人相關組件
│   │   ├── CandidateCard.tsx
│   │   ├── CandidateModal.tsx
│   │   ├── StabilityGauge.tsx
│   │   └── CultureRadar.tsx
│   ├── /jobs            # 職缺相關組件
│   │   ├── JobCard.tsx
│   │   └── MatchList.tsx
│   ├── /kanban          # Kanban 看板
│   │   ├── KanbanBoard.tsx
│   │   └── KanbanColumn.tsx
│   └── /shared          # 共用組件
│       ├── Badge.tsx
│       └── Sidebar.tsx
├── /pages              # 頁面路由
│   ├── DashboardPage.tsx        # 儀表板
│   ├── CandidatesPage.tsx       # 候選人總表
│   ├── KanbanPage.tsx           # 看板
│   ├── JobsPage.tsx             # 職缺管理
│   ├── MatchingPage.tsx         # AI 智慧配對
│   └── AnalyticsPage.tsx        # 數據分析
├── /services            # 業務邏輯層
│   ├── candidateService.ts      # 候選人 CRUD
│   ├── sheetsService.ts         # Google Sheets 同步
│   ├── aiMatchingService.ts     # AI 配對
│   └── analyticsService.ts      # 數據分析
├── types.ts             # TypeScript 型別定義
├── constants.ts         # 常數定義
└── App.tsx              # 主應用程式
```

---

## 🔧 核心服務說明

### Google Sheets 服務 (`services/sheetsService.ts`)
```typescript
// 讀取所有候選人
getCandidates(): Promise<Candidate[]>

// 更新候選人
updateCandidate(candidate: Candidate): Promise<void>

// 新增候選人
addCandidate(candidate: Candidate): Promise<void>

// 刪除候選人
deleteCandidate(id: string): Promise<void>
```

### AI 配對服務 (`services/aiMatchingService.ts`)
```typescript
// 為職缺推薦候選人
matchCandidatesForJob(job: Job): Promise<Match[]>

// 計算配對分數
calculateMatchScore(candidate: Candidate, job: Job): Promise<number>

// 取得推薦理由
getMatchReason(candidate: Candidate, job: Job): Promise<string>
```

---

## 📊 資料結構

### Candidate (候選人)
```typescript
interface Candidate {
  id: string;
  name: string;                    // 姓名
  email: string;                   // Email
  phone: string;                   // 電話
  location: string;                // 地點
  position: string;                // 目前職位
  years: number;                   // 總年資
  jobChanges: number;              // 工作次數
  avgTenure: number;               // 平均任期
  lastGap: number;                 // 最後空窗期（月）
  skills: string;                  // 技能（逗號分隔）
  education: string;               // 學歷
  source: string;                  // 來源（LinkedIn/GitHub/Gmail）
  workHistory: WorkHistory[];      // 工作經歷 (JSON)
  quitReasons: string;             // 離職原因
  stabilityScore: number;          // 穩定度評分 (0-100)
  educationJson: Education[];      // 教育背景 (JSON)
  discProfile: string;             // DISC 性格
  status: string;                  // 狀態（待聯繫/面試中/...）
  consultant: string;              // 負責顧問
  notes: string;                   // 備註
  createdAt: Date;
  updatedAt: Date;
}
```

### Job (職缺)
```typescript
interface Job {
  id: string;
  code: string;                    // 職缺代碼 (JD-001)
  title: string;                   // 職位名稱
  company: string;                 // 公司名稱
  department: string;              // 部門
  location: string;                // 工作地點
  salaryMin: number;               // 最低薪資
  salaryMax: number;               // 最高薪資
  requiredSkills: string[];        // 必備技能
  requiredYears: number;           // 年資要求
  status: string;                  // 狀態（招募中/已關閉）
  createdAt: Date;
}
```

### Match (AI 配對結果)
```typescript
interface Match {
  candidateId: string;
  jobId: string;
  totalScore: number;              // 總分 (0-100)
  skillScore: number;              // 技能匹配 (30%)
  stabilityScore: number;          // 穩定度 (30%)
  cultureScore: number;            // 文化匹配 (20%)
  experienceScore: number;         // 經驗匹配 (20%)
  grade: 'P0' | 'P1' | 'P2' | 'REJECT';
  reason: string;                  // 推薦理由
  createdAt: Date;
}
```

---

## 🎨 UI 截圖

### 儀表板
![Dashboard](./docs/screenshots/dashboard.png)

### 候選人總表
![Candidates](./docs/screenshots/candidates.png)

### Kanban 看板
![Kanban](./docs/screenshots/kanban.png)

### AI 智慧配對
![Matching](./docs/screenshots/matching.png)

---

## 📦 部署到 Zeabur

### 1. 提交程式碼到 GitHub
```bash
git add .
git commit -m "Initial commit: Step1ne Headhunter AI System"
git remote add origin https://github.com/jacky6658/step1ne-headhunter-system.git
git push -u origin main
```

### 2. Zeabur 部署
1. 登入 [Zeabur](https://zeabur.com)
2. 創建新服務
3. 連接 GitHub: `jacky6658/step1ne-headhunter-system`
4. Zeabur 自動偵測 Vite (React)
5. 設定環境變數（見上方 `.env` 範例）
6. 部署！

### 3. 線上存取
部署完成後，你的系統將可透過 Zeabur 提供的網址存取。

---

## 🔐 安全性說明

- **Google Sheets API**：使用 `gog` CLI，需要在 Zeabur 設定 OAuth 認證
- **本地快取**：敏感資訊不存在 LocalStorage
- **權限控制**：不同顧問只能看到自己的 Pipeline（可選功能）

---

## 🚧 開發路線圖

### ✅ Phase 1: MVP (已完成)
- [x] 候選人總表
- [x] Kanban 看板
- [x] AI 智慧配對
- [x] 基本 CRUD

### 🚀 Phase 2: AI 增強 (進行中)
- [ ] 履歷自動解析（PDF 上傳）
- [ ] 穩定度視覺化（儀表盤）
- [ ] 文化匹配雷達圖
- [ ] 進度時間軸

### 📊 Phase 3: 數據分析
- [ ] 儀表板（數據總覽）
- [ ] 財務分析（推薦費用、退費率）
- [ ] 成功推薦 + 保證期追蹤

### 🔄 Phase 4: 系統升級
- [ ] PostgreSQL 資料庫（取代 Google Sheets）
- [ ] 即時協作（WebSocket）
- [ ] 行動 App（React Native）

---

## 🤝 貢獻

歡迎提出 Issue 或 Pull Request！

---

## 📄 授權

MIT License

---

## 👥 開發團隊

- **開發**: YuQi AI 助理 🦞
- **產品負責人**: Jacky Chen
- **專案**: Step1ne 獵頭系統

---

*Last updated: 2026-02-23*
