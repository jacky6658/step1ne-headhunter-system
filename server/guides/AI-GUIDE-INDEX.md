# Step1ne AI 操作手冊 — 統一入口

> **版本**：v1.0｜**更新日期**：2026-03-16
> **用途**：AI Agent 啟動後首先讀取此頁，依需求載入對應模組手冊

---

## 快速導航

| 模組 | API 端點 | 說明 | 端點數 |
|------|---------|------|--------|
| 📋 **客戶模組** | `GET /api/guide/clients` | BD 客戶卡片 CRUD、聯絡紀錄、送件規範 | 11 |
| 💼 **職缺模組** | `GET /api/guide/jobs` | 職缺卡片 CRUD、104/1111 匯入 | 6 |
| 👤 **人選模組** | `GET /api/guide/candidates` | 人選匯入、更新、工作經歷、學歷、批次操作 | 11 |
| 🤖 **人才AI模組** | `GET /api/guide/talent-ops` | AI 評分、履歷解析、GitHub 分析、OpenClaw | 19 |

**共 47 個 API 端點**

---

## 認證方式

### 一般端點
```
Authorization: Bearer {API_SECRET_KEY}
```

### OpenClaw 端點（僅 `/api/openclaw/*`）
```
X-OpenClaw-Key: {OPENCLAW_API_KEY}
```

---

## 使用指南

### 1. 新增客戶 + 開職缺
```
→ 讀取客戶模組：GET /api/guide/clients
→ 讀取職缺模組：GET /api/guide/jobs
```

### 2. 匯入人選（含工作經歷、學歷、AI 總結）
```
→ 讀取人選模組：GET /api/guide/candidates
```

### 3. AI 分析（評分、履歷解析、GitHub、匹配）
```
→ 讀取人才AI模組：GET /api/guide/talent-ops
```

### 4. 完整流程（從客戶開發到人選推薦）
```
→ 依序讀取全部 4 個模組
```

---

## 核心注意事項

1. **POST vs PATCH**：POST `/api/candidates` 不會覆蓋已有資料（只補空欄），要強制更新請用 PATCH
2. **欄位命名**：API 同時接受 snake_case 和 camelCase，建議統一用 **snake_case**
3. **work_history 格式**：JSON 陣列，每筆含 company、title、start、end、description
4. **API_SECRET_KEY = VITE_API_KEY**：前後端認證密鑰必須一致

---

## 系統狀態檢查

```
GET /api/health  → 確認系統正常（不需認證）
```

回應：`{ "status": "ok", "database": "connected" }`

---

## 舊版手冊（仍可使用，但建議改用上方模組化手冊）

| 端點 | 說明 |
|------|------|
| `GET /api/guide` | 舊版完整手冊（1,852 行，較長） |
| `GET /api/scoring-guide` | OpenClaw 評分指南 |
| `GET /api/jobs-import-guide` | 職缺匯入指南 |
| `GET /api/resume-guide` | 履歷分析指南 |
| `GET /api/resume-import-guide` | 履歷匯入指南 |
| `GET /api/github-analysis-guide` | GitHub 分析指南 |
| `GET /api/consultant-sop` | 顧問 SOP 手冊 |
