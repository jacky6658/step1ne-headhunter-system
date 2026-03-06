# BUG: Worktree 同步問題 — crawlerImportService.js 修改未生效

## 日期
2026-03-06

## 問題描述
爬蟲 Pipeline 大改造後，AI 資料（aiMatchResult, work_history, education_details, talent_level）未正確寫入 Step1ne PostgreSQL 資料庫。

## 根因
Backend dev server 從 `.claude/worktrees/sad-lamarr/` 啟動，但 `crawlerImportService.js` 的修改只寫入了主 repo (`/server/crawlerImportService.js`)，worktree 中的副本仍是舊版。

導致以下修復全部未生效：
1. `ai_match_result` JSONB 欄位未加入 INSERT/UPDATE SQL
2. `work_history` / `education_details` 的 UPDATE 邏輯用 `COALESCE(work_history, $15)` 只填 NULL 值，無法覆寫空 JSONB
3. `talent_level` 不會被 AI 評等覆蓋
4. AI 評等 B 級以上自動設 `status='AI推薦'` 未生效

## 影響
- 50 位候選人推送到 Step1ne 後，`aiMatchResult = null`（0/50 有值）
- `workHistory` 只有 2/50 有值
- 所有候選人 `status = '未開始'`（應有 17 位 `AI推薦`）

## 修復
```bash
# 將修改同步到 worktree
cp server/crawlerImportService.js .claude/worktrees/sad-lamarr/server/crawlerImportService.js
# 重啟 backend
```

## crawlerImportService.js 具體修改

### mapCrawlerCandidate() — AI推薦自動分類
```javascript
// 修改前
status: '未開始',

// 修改後
status: (() => {
  const aiGrade = (raw.ai_grade || raw.grade || '').toUpperCase();
  return (aiGrade === 'A' || aiGrade === 'A+' || aiGrade === 'S' || aiGrade === 'B') ? 'AI推薦' : '未開始';
})(),
```

### processBulkImport() UPDATE — JSONB 覆寫修復
```sql
-- 修改前（只填 NULL）
work_history = COALESCE(work_history, $15)
education_details = COALESCE(education_details, $16)

-- 修改後（非 NULL 即覆寫）
work_history = CASE WHEN $15::jsonb IS NOT NULL THEN $15::jsonb ELSE work_history END
education_details = CASE WHEN $16::jsonb IS NOT NULL THEN $16::jsonb ELSE education_details END
```

### processBulkImport() — 新增 ai_match_result 欄位
INSERT 和 UPDATE 兩條路徑都加入 `ai_match_result` JSONB 欄位（$24/$26）。

## 預防措施
開發時如果使用 worktree 啟動 dev server，修改檔案後需手動同步或改為直接在 worktree 中編輯。

## 狀態
- [x] 代碼已修復並 push 到 GitHub
- [ ] 需重新跑一次爬蟲任務驗證資料正確寫入 DB
