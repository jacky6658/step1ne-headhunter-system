/**
 * migrations.js - DB schema migrations（啟動時執行）
 */
const { pool } = require('./db');

// 確保 progress_tracking 欄位存在
pool.query(`
  ALTER TABLE candidates_pipeline
  ADD COLUMN IF NOT EXISTS progress_tracking JSONB DEFAULT '[]'
`).catch(err => console.warn('progress_tracking migration:', err.message));

// 確保 linkedin_url / github_url / email 欄位存在
pool.query(`
  ALTER TABLE candidates_pipeline
  ADD COLUMN IF NOT EXISTS linkedin_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS github_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS email VARCHAR(255)
`).catch(err => console.warn('linkedin_url/github_url/email migration:', err.message));

// 確保 ai_match_result 欄位存在
pool.query(`
  ALTER TABLE candidates_pipeline
  ADD COLUMN IF NOT EXISTS ai_match_result JSONB
`).catch(err => console.warn('ai_match_result migration:', err.message));

// 確保 system_logs 資料表存在
pool.query(`
  CREATE TABLE IF NOT EXISTS system_logs (
    id SERIAL PRIMARY KEY,
    action VARCHAR(50) NOT NULL,
    actor VARCHAR(100) NOT NULL,
    actor_type VARCHAR(10) NOT NULL DEFAULT 'HUMAN',
    candidate_id INTEGER,
    candidate_name VARCHAR(255),
    detail JSONB,
    created_at TIMESTAMP DEFAULT NOW()
  )
`).catch(err => console.warn('system_logs migration:', err.message));

// 確保 user_contacts 資料表存在
pool.query(`
  CREATE TABLE IF NOT EXISTS user_contacts (
    display_name VARCHAR(100) PRIMARY KEY,
    contact_phone VARCHAR(50),
    contact_email VARCHAR(255),
    line_id VARCHAR(100),
    telegram_handle VARCHAR(100),
    updated_at TIMESTAMP DEFAULT NOW()
  )
`).catch(err => console.warn('user_contacts migration:', err.message));

// 確保 github_token 欄位存在
pool.query(`
  ALTER TABLE user_contacts
  ADD COLUMN IF NOT EXISTS github_token VARCHAR(500)
`).catch(err => console.warn('github_token migration:', err.message));

// 確保 linkedin_token 欄位存在（保留欄位，未使用）
pool.query(`
  ALTER TABLE user_contacts
  ADD COLUMN IF NOT EXISTS linkedin_token TEXT
`).catch(err => console.warn('linkedin_token migration:', err.message));

// 確保 brave_api_key 欄位存在（Brave Search API）
pool.query(`
  ALTER TABLE user_contacts
  ADD COLUMN IF NOT EXISTS brave_api_key VARCHAR(500)
`).catch(err => console.warn('brave_api_key migration:', err.message));

// 確保 job_description 欄位存在（職缺完整 JD）
pool.query(`
  ALTER TABLE jobs_pipeline
  ADD COLUMN IF NOT EXISTS job_description TEXT
`).catch(err => console.warn('job_description migration:', err.message));

// 確保爬蟲搜尋設定欄位存在（公司畫像、人才畫像、搜尋關鍵字）
pool.query(`
  ALTER TABLE jobs_pipeline ADD COLUMN IF NOT EXISTS company_profile TEXT;
  ALTER TABLE jobs_pipeline ADD COLUMN IF NOT EXISTS talent_profile TEXT;
  ALTER TABLE jobs_pipeline ADD COLUMN IF NOT EXISTS search_primary TEXT;
  ALTER TABLE jobs_pipeline ADD COLUMN IF NOT EXISTS search_secondary TEXT;
`).catch(err => console.warn('search profile migration:', err.message));

// 確保 104 富文本欄位存在（福利、上班時段、休假制度、遠端、出差、連結）
pool.query(`
  ALTER TABLE jobs_pipeline ADD COLUMN IF NOT EXISTS welfare_tags TEXT;
  ALTER TABLE jobs_pipeline ADD COLUMN IF NOT EXISTS welfare_detail TEXT;
  ALTER TABLE jobs_pipeline ADD COLUMN IF NOT EXISTS work_hours TEXT;
  ALTER TABLE jobs_pipeline ADD COLUMN IF NOT EXISTS vacation_policy TEXT;
  ALTER TABLE jobs_pipeline ADD COLUMN IF NOT EXISTS remote_work TEXT;
  ALTER TABLE jobs_pipeline ADD COLUMN IF NOT EXISTS business_trip TEXT;
  ALTER TABLE jobs_pipeline ADD COLUMN IF NOT EXISTS job_url TEXT;
`).catch(err => console.warn('104 fields migration:', err.message));

// 確保 github_analysis_cache 欄位存在（GitHub v2 分析快取）
pool.query(`
  ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS github_analysis_cache JSONB;
`).catch(err => console.warn('github_analysis_cache migration:', err.message));

// 目標職缺欄位：改為直接 FK 對應 jobs_pipeline（不再存在 notes 文字內）
pool.query(`
  ALTER TABLE candidates_pipeline
  ADD COLUMN IF NOT EXISTS target_job_id INTEGER REFERENCES jobs_pipeline(id) ON DELETE SET NULL
`).catch(err => console.warn('target_job_id migration:', err.message));

// 一次性補寫：notes 裡有「目標職缺：XXX」但 target_job_id 為 NULL 的候選人
// 嘗試反查 jobs_pipeline，找到匹配的職缺後補寫 target_job_id
pool.query(`
  UPDATE candidates_pipeline c
  SET target_job_id = j.id
  FROM jobs_pipeline j
  WHERE c.target_job_id IS NULL
    AND c.notes LIKE '%目標職缺：%'
    AND (
      c.notes LIKE '%' || j.position_name || ' (' || j.client_company || ')%'
      OR c.notes LIKE '%目標職缺：' || j.position_name || ' |%'
      OR c.notes LIKE '%目標職缺：' || j.position_name
    )
`).then(r => {
  if (r.rowCount > 0) {
    console.log(`✅ target_job_id 反查補寫：${r.rowCount} 位候選人的目標職缺已從 notes 回填 target_job_id`);
  }
}).catch(err => console.warn('target_job_id backfill from notes:', err.message));

// 一次性補寫：status 已更新但 progressTracking 最新一筆 event 不符的候選人，補一筆 progressTracking
// 確保卡片欄位以 progressTracking 優先的前端邏輯能正確反映目前狀態
pool.query(`
  UPDATE candidates_pipeline
  SET
    progress_tracking = COALESCE(progress_tracking, '[]'::jsonb) ||
      jsonb_build_array(jsonb_build_object(
        'date', to_char(COALESCE(updated_at, NOW()), 'YYYY-MM-DD'),
        'event', status,
        'by',   'system-migration'
      )),
    updated_at = NOW()
  WHERE status NOT IN ('未開始')
    AND (
      progress_tracking IS NULL
      OR progress_tracking = '[]'::jsonb
      OR (
        jsonb_array_length(progress_tracking) > 0
        AND progress_tracking->-1->>'event' != status
      )
    )
`).then(r => {
  if (r.rowCount > 0) {
    console.log(`✅ progressTracking 補寫：${r.rowCount} 位候選人已補寫狀態紀錄，卡片將移至正確欄位`);
  }
}).catch(err => console.warn('progressTracking backfill:', err.message));

// 一次性資料清理：target_job_id 指向不存在職缺的候選人 → 清為 NULL（顯示「未指定」）
pool.query(`
  UPDATE candidates_pipeline
  SET target_job_id = NULL
  WHERE target_job_id IS NOT NULL
    AND target_job_id NOT IN (SELECT id FROM jobs_pipeline)
`).then(r => {
  if (r.rowCount > 0) {
    console.log(`✅ 孤立職缺清理：${r.rowCount} 位候選人的 target_job_id 已重設為 NULL（職缺不存在）`);
  }
}).catch(err => console.warn('orphan target_job_id cleanup:', err.message));

// 一次性資料清理：將歷史遺留的「待聯繫」「待審核」狀態統一轉為「未開始」，顧問設為「待指派」
pool.query(`
  UPDATE candidates_pipeline
  SET status = '未開始',
      recruiter = '待指派',
      updated_at = NOW()
  WHERE status IN ('待聯繫', '待審核')
`).then(r => {
  if (r.rowCount > 0) {
    console.log(`✅ 歷史狀態清理：${r.rowCount} 位「待聯繫/待審核」候選人已轉為「未開始/待指派」`);
  }
}).catch(err => console.warn('legacy status migration:', err.message));

// 確保 bot_config 資料表存在（Bot 排程設定）
pool.query(`
  CREATE TABLE IF NOT EXISTS bot_config (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB,
    updated_at TIMESTAMP DEFAULT NOW()
  )
`).catch(err => console.warn('bot_config migration:', err.message));

// 確保 candidate_notes 資料表存在（結構化手動備註，與 notes TEXT 並存）
pool.query(`
  CREATE TABLE IF NOT EXISTS candidate_notes (
    id           SERIAL PRIMARY KEY,
    candidate_id INTEGER NOT NULL REFERENCES candidates_pipeline(id) ON DELETE CASCADE,
    content      TEXT    NOT NULL,
    note_type    VARCHAR(50) DEFAULT 'manual',
    created_by   VARCHAR(100),
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
  )
`).catch(err => console.warn('candidate_notes migration:', err.message));

pool.query(`
  CREATE INDEX IF NOT EXISTS idx_candidate_notes_candidate_id
  ON candidate_notes(candidate_id)
`).catch(() => {});
