# Step1ne System Changelog（系統更新紀錄）

> AI Bot / 開發團隊參考用。記錄系統端點、功能、資料結構的重大變更。

---

## [2026-03-15] AI 總結貼上功能 + API 欄位補齊 + 全量 Migration

### DB Migration
- **新增 `server/scripts/migration-all-in-one.sql`**：合併所有 migration 的一鍵腳本（可安全重複執行）
- **自動 Migration 機制**：`routes-api.js` 啟動時自動執行 60+ 條 `pool.query()`，確保所有欄位存在
- 涵蓋範圍：Sprint 1 結構化欄位（Layer 1/2/3）、Talent Board、Phase 1/3 候選人欄位、AI 總結、履歷附件、語音/自傳/作品集等

### 新增
- **AI 總結 Tab「貼上 AI 結果」功能**：使用者可手動將 ChatGPT/Claude 的 JSON 結果貼回系統
- **AI 提示詞 Step 5**：要求 AI 在回覆訊息中也輸出 `ai_summary` JSON 區塊，方便複製貼入
- **導覽開關**：個人設定新增導覽 on/off 開關

### 修復
- **React error #300**：`useState` 放在 JSX IIFE 內導致 React crash，移至元件頂層
- **候選人卡片 Tab 空白**：切換 Tab 時滾動位置未重置（scrollTop = 0）
- **GET /api/candidates/:id 缺欄位**：補齊 16 個欄位（aiSummary、industry、languages、certifications 等）
- **導覽開關無效**：OnboardingTour active prop 和 LearningCenter 自動啟動未檢查全域旗標

### API 變更
- `GET /api/candidates/:id` 新增回應欄位：`aiSummary`、`industry`、`languages`、`certifications`、`currentSalary`、`expectedSalary`、`noticePeriod`、`managementExperience`、`teamSize`、`consultantNote`、`consultantEvaluation`、`voiceAssessments`、`biography`、`portfolioUrl`、`resumeFiles`、`createdBy`

---

## [2026-03-14] 學習中心 Smart Fill + TalentBoard 優化

### 新增
- Role Encyclopedia + Industry Map prompt 複製時自動 Smart Fill
- `fillLearningPrompt()` 加入 fallback 機制：`[填入XXX，如 YYY]` → 自動用 `YYY` 填入

### 修復
- TalentBoard 黃色 banner 精簡化
- 看板卡片區域高度增加 60px

---

## [初始版本] 系統核心 API

### 端點總覽
- **候選人 CRUD**：GET/POST/PATCH/DELETE /api/candidates
- **職缺 CRUD**：GET/POST/PUT/DELETE /api/jobs
- **客戶 BD**：GET/POST/PATCH/DELETE /api/clients
- **互動紀錄**：/api/candidates/:id/interactions
- **通知系統**：/api/notifications
- **提示詞庫**：/api/prompts
- **OpenClaw**：/api/openclaw/pending + batch-update
- **爬蟲整合**：/api/crawler/*
- **獵才流程**：/api/talent-sourcing/*
- **履歷解析**：/api/resume/parse
- **GitHub 分析**：/api/github/analyze/:username
- **分類法**：/api/taxonomy/skills + roles + industries

### 資料庫
- PostgreSQL 16（龍蝦主機本機）
- 所有資料一律存 DB SQL，不使用 Google Sheets
