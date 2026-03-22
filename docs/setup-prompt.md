# 另一台電腦設定提示詞（給 Jacky 的龍蝦）

> 直接貼給另一台電腦的 Claude Code

---

## Workspace 1：整理文檔 + 測試閉環

```
# 任務：同步最新文檔 + 測試閉環系統

## 你的身份
你是 Jacky 的龍蝦（獵頭顧問 AI）。
讀取 docs/agent/agent.md、user.md、tool.md 了解你的完整行為準則。

## 背景
獵頭系統的 AI Agent 文檔和閉環自動化腳本已完成重構，都在 GitHub 上。
你需要 pull 最新版本、確認環境、測試閉環。

目前 API（api-hr.step1ne.com）是掛的（530），所以今天先用 SQL 直連。
你是 Jacky 的龍蝦，有 SQL 直連權限。
連線資訊：postgresql://step1ne@localhost:5432/step1ne

後續 API 恢復後，一律改回走 API。

## Step 1：同步 GitHub

### 獵頭系統（如果本地已有，直接 pull）
cd /path/to/step1ne-headhunter-system
git pull origin main

### 爬蟲系統（如果本地已有，直接 pull）
cd /path/to/headhunter-crawler
git pull origin main

### 如果本地沒有，clone：
git clone https://github.com/jacky6658/step1ne-headhunter-system.git
git clone https://github.com/jacky6658/headhunter-crawler.git

### DB 備份（如果需要還原）
git clone https://github.com/jacky6658/step1ne-db-backups.git
gunzip -c step1ne-db-backups/backups/latest.sql.gz | psql -U step1ne -d step1ne

## Step 2：確認文件完整性

確認以下文件存在且為最新版（讀取第一行的版本號）：

獵頭系統 docs/agent/：
- agent.md (v2.2) — 龍蝦 AI 核心提示詞 + 三層篩選 + 指揮鏈
- user.md (v2.1) — 認主人機制 + Jacky SQL 直連權限
- tool.md (v2.1) — API 參考 + 必填欄位 + 職缺欄位表

獵頭系統 docs/ceo/：
- agent.md — 執行長 AI + 指揮龍蝦 + 排程管理 + 優先度
- user.md — 回報機制 + 通訊機制
- tool.md — 稽核用 API

爬蟲系統：
- docs/閉環執行提示詞.md — 完整閉環流程（含 Playwright CDP）
- docs/啟動指南.md — 手動/Cron 觸發方式
- scripts/daily_closed_loop.py — 每日自動閉環腳本
- scripts/linkedin_pdf_download.py — LinkedIn PDF 下載腳本

## Step 3：確認本地環境

### PostgreSQL（今天用 SQL 直連）
psql -U step1ne -d step1ne -c "SELECT COUNT(*) FROM candidates_pipeline;"
psql -U step1ne -d step1ne -c "SELECT COUNT(*) FROM jobs_pipeline WHERE job_status = '招募中';"
psql -U step1ne -d step1ne -c "SELECT id, position_name, job_status, priority FROM jobs_pipeline WHERE job_status = '招募中' ORDER BY CASE WHEN priority = 'high' THEN 0 WHEN priority = 'medium' THEN 1 ELSE 2 END, id;"

### 後端（嘗試啟動，如果能起來就用 API）
cd step1ne-headhunter-system/server
npm install
node server.js &
curl http://localhost:3001/api/health
# 如果回 200 → 後續用 API
# 如果失敗 → 今天用 SQL 直連

### 爬蟲系統
確認爬蟲在跑（port 5050）：
curl http://localhost:5050/api/health

### 環境變數
export API_SECRET_KEY="PotfZ42-qPyY4uqSwqstpxllQB1alxVfjJsm3Mgp3HQ"
export API_BASE="http://localhost:3001"
export CRAWLER_BASE="http://localhost:5050"

## Step 4：資料品質檢查（用 SQL）

### 檢查職缺三層篩選欄位
SELECT id, position_name, client_company,
  CASE WHEN rejection_criteria IS NOT NULL AND rejection_criteria != '' THEN '✅' ELSE '❌' END as 淘汰條件,
  CASE WHEN submission_criteria IS NOT NULL AND submission_criteria != '' THEN '✅' ELSE '❌' END as 送人條件,
  CASE WHEN talent_profile IS NOT NULL AND LENGTH(talent_profile) > 100 THEN '✅' ELSE '❌' END as 人才畫像,
  CASE WHEN exclusion_keywords IS NOT NULL AND exclusion_keywords != '' THEN '✅' ELSE '❌' END as 排除關鍵字,
  CASE WHEN title_variants IS NOT NULL AND title_variants != '' THEN '✅' ELSE '❌' END as 職稱變體,
  CASE WHEN job_description IS NOT NULL AND job_description != '' THEN '✅' ELSE '❌' END as JD
FROM jobs_pipeline
WHERE job_status = '招募中'
ORDER BY id;

### 列出缺失的，以資深獵頭顧問角度補填

### 檢查候選人必填欄位缺失
SELECT id, name,
  CASE WHEN current_title IS NULL OR current_title = '' THEN '❌' ELSE '✅' END as 職稱,
  CASE WHEN skills IS NULL OR skills = '' THEN '❌' ELSE '✅' END as 技能,
  CASE WHEN work_history IS NULL THEN '❌' ELSE '✅' END as 工作經歷,
  CASE WHEN linkedin_url IS NULL OR linkedin_url = '' THEN
    CASE WHEN github_url IS NULL OR github_url = '' THEN '❌' ELSE '✅' END
  ELSE '✅' END as 外部連結
FROM candidates_pipeline
WHERE updated_at > NOW() - INTERVAL '7 days'
ORDER BY updated_at DESC
LIMIT 50;

## Step 5：測試閉環（單一職缺）

### 前置：啟動 Chrome CDP
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-cdp &

確認 Chrome 已登入 LinkedIn。

### 手動測試
讀取 docs/閉環執行提示詞.md，對職缺 #52 執行完整閉環（Step 1 ~ Step 9）。

確認每一步結果：
1. ✅ 爬蟲搜尋有結果
2. ✅ A 層篩選正常運作
3. ✅ LinkedIn PDF 下載成功（存到 resumes/linkedin_pdfs/）
4. ✅ 候選人匯入含完整必填欄位（name, current_title, current_company, skills, years_experience, work_history, education_details, linkedin_url）
5. ✅ PDF 上傳 + resume-parse 解析成功
6. ✅ 人選卡片有履歷附件

### 如果 API 不通，用 SQL 匯入
候選人匯入用 INSERT INTO candidates_pipeline (...)
PDF 暫存本機 resumes/pending_upload/，等 API 恢復後批量上傳

## Step 6：測試自動排程腳本

cd headhunter-crawler
source venv/bin/activate
python scripts/daily_closed_loop.py

## 回報
完成後告訴我：
1. 每個步驟的執行結果（成功/失敗）
2. 職缺資料品質報告（哪些欄位缺失、已補填什麼）
3. 閉環測試結果（搜到幾人、通過幾人、匯入幾人、PDF 幾個）
4. 發現的問題和建議
```

---

## Workspace 2 提示詞（如果需要）

如果 Workspace 2 有其他用途（例如執行長 AI），另外告訴我。
