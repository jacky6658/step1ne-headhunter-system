/**
 * routes-api.js - 完整 API 路由（candidates + jobs）
 * 整合 SQL 資料層
 */
const express = require('express');
const router = express.Router();
const https = require('https');
const { exec, execFile } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const execFilePromise = util.promisify(execFile);
const { enrichCandidate, saveEnrichment } = require('./perplexityService');
const crypto = require('crypto');
const { pool, withClient } = require('./db'); // 共享連線池 + 安全 helper
const { safeError } = require('./safeError');

/**
 * 根據請求的 Host header 動態替換 guide 文件中的 API base URL
 * 讓同一份 guide 在外網 (Cloudflare Tunnel) 和本機 (localhost) 都能正確運作
 */
function replaceGuideBaseUrl(content, req) {
  const host = req.hostname || req.headers.host || '';
  let baseUrl;
  if (host.includes('api-hr.step1ne.com')) {
    baseUrl = 'https://api-hr.step1ne.com';
  } else {
    // localhost 或其他本地環境
    const port = process.env.PORT || 3003;
    baseUrl = `http://localhost:${port}`;
  }
  return content.replace(/https:\/\/backendstep1ne\.zeabur\.app/g, baseUrl);
}

/**
 * 正規化 progressTracking 陣列：
 * - 確保每筆都有 date 欄位（從 at 取年月日，或用今天日期）
 * - 防止 AI Bot 傳入 "at" 卻沒有 "date" 造成前端欄位錯亂
 */
function normalizeProgressTracking(pt) {
  if (!Array.isArray(pt)) return pt;
  return pt.map(entry => {
    if (entry.date) return entry;  // 已有 date，不動
    if (entry.at) {
      return { ...entry, date: entry.at.split('T')[0] };  // 從 at 取 YYYY-MM-DD
    }
    return { ...entry, date: new Date().toISOString().split('T')[0] };  // fallback 今天
  });
}

/**
 * 清洗 URL param 中的 id：移除 AI Bot 可能帶來的多餘 JSON 引號
 * e.g. '"184"' → '184'，'\"184\"' → '184'
 * 使用 router.param() 讓所有路由自動套用，無需逐一修改。
 */
function sanitizeId(rawId) {
  if (rawId == null) return rawId;
  return String(rawId).replace(/^["']+|["']+$/g, '').trim();
}

// 全局 id 參數清洗：所有 :id 路由在進入 handler 前自動去除多餘引號
router.param('id', (req, _res, next, value) => {
  req.params.id = sanitizeId(value);
  next();
});

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

// 確保職缺卡片搜尋欄位存在（爬蟲多維度搜尋用）
pool.query(`
  ALTER TABLE jobs_pipeline
  ADD COLUMN IF NOT EXISTS target_companies TEXT,
  ADD COLUMN IF NOT EXISTS title_variants TEXT,
  ADD COLUMN IF NOT EXISTS exclusion_keywords TEXT
`).catch(err => console.warn('jobs search fields migration:', err.message));

// 確保 OpenClaw 分析欄位存在
pool.query(`
  ALTER TABLE candidates_pipeline
  ADD COLUMN IF NOT EXISTS ai_score INTEGER,
  ADD COLUMN IF NOT EXISTS ai_grade VARCHAR(10),
  ADD COLUMN IF NOT EXISTS ai_report TEXT,
  ADD COLUMN IF NOT EXISTS ai_recommendation VARCHAR(50)
`).catch(err => console.warn('openclaw columns migration:', err.message));

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

// 確保 TG 通知欄位存在（telegram_bot_token + telegram_chat_id）
pool.query(`
  ALTER TABLE user_contacts
  ADD COLUMN IF NOT EXISTS telegram_bot_token VARCHAR(500),
  ADD COLUMN IF NOT EXISTS telegram_chat_id VARCHAR(100)
`).catch(err => console.warn('telegram columns migration:', err.message));

// 確保系統級 TG 群組設定存在
pool.query(`
  CREATE TABLE IF NOT EXISTS system_config (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMP DEFAULT NOW()
  )
`).then(() => {
  // 預設空值，管理員可在 ProfileSettings 裡設定
  pool.query(`
    INSERT INTO system_config (key, value) VALUES ('telegram_group_chat_id', '')
    ON CONFLICT (key) DO NOTHING
  `).catch(() => {});
  pool.query(`
    INSERT INTO system_config (key, value) VALUES ('telegram_group_bot_token', '')
    ON CONFLICT (key) DO NOTHING
  `).catch(() => {});
}).catch(err => console.warn('system_config migration:', err.message));

// 確保 candidate_job_rankings_cache 資料表存在（職缺匹配推薦 v2 快取）
pool.query(`
  CREATE TABLE IF NOT EXISTS candidate_job_rankings_cache (
    candidate_id INTEGER NOT NULL PRIMARY KEY,
    rankings JSONB NOT NULL,
    computed_at TIMESTAMP DEFAULT NOW()
  )
`).catch(err => console.warn('candidate_job_rankings_cache migration:', err.message));

// ── 提示詞資料庫（需依序建立，votes 有 FK 依賴 library）──
pool.query(`
  CREATE TABLE IF NOT EXISTS prompt_library (
    id SERIAL PRIMARY KEY,
    category VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    author VARCHAR(100) NOT NULL,
    is_pinned BOOLEAN DEFAULT FALSE,
    upvote_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )
`).then(() => {
  pool.query(`
    CREATE TABLE IF NOT EXISTS prompt_votes (
      id SERIAL PRIMARY KEY,
      prompt_id INTEGER NOT NULL REFERENCES prompt_library(id) ON DELETE CASCADE,
      voter VARCHAR(100) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(prompt_id, voter)
    )
  `).catch(err => console.warn('prompt_votes migration:', err.message));
  pool.query(`CREATE INDEX IF NOT EXISTS idx_prompt_lib_category ON prompt_library(category)`).catch(() => {});
  pool.query(`CREATE INDEX IF NOT EXISTS idx_prompt_lib_pinned ON prompt_library(is_pinned)`).catch(() => {});
}).catch(err => console.warn('prompt_library migration:', err.message));

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

// 確保 site_config 欄位存在（顧問對外頁面設定）
pool.query(`
  ALTER TABLE user_contacts
  ADD COLUMN IF NOT EXISTS site_config JSONB DEFAULT '{}'
`).catch(err => console.warn('site_config migration:', err.message));

// 狀態名稱遷移：已聯繫→聯繫階段、已面試→面試階段、已上職→on board
pool.query(`
  UPDATE candidates_pipeline SET status = '聯繫階段' WHERE status = '已聯繫';
  UPDATE candidates_pipeline SET status = '面試階段' WHERE status = '已面試';
  UPDATE candidates_pipeline SET status = 'on board' WHERE status = '已上職';
`).then(r => console.log('✅ 狀態名稱遷移完成'))
  .catch(err => console.warn('status name migration:', err.message));

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

// 確保 marketing_description 欄位存在（對外行銷用職缺描述）
pool.query(`
  ALTER TABLE jobs_pipeline ADD COLUMN IF NOT EXISTS marketing_description TEXT
`).catch(err => console.warn('marketing_description migration:', err.message));

// 確保 candidates_pipeline 薪資欄位存在
pool.query(`
  ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS current_salary VARCHAR(100);
  ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS expected_salary VARCHAR(100);
`).catch(err => console.warn('candidates salary migration:', err.message));

// 確保 github_analysis_cache 欄位存在（GitHub v2 分析快取）
pool.query(`
  ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS github_analysis_cache JSONB;
`).catch(err => console.warn('github_analysis_cache migration:', err.message));

// 確保 interview_round 欄位存在（面試關卡 1/2/3）
pool.query(`
  ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS interview_round INTEGER;
`).catch(err => console.warn('interview_round migration:', err.message));

// 確保職缺卡片新增欄位存在（送人條件、面試階段、優先級、薪資上下限、淘汰條件）
pool.query(`
  ALTER TABLE jobs_pipeline ADD COLUMN IF NOT EXISTS submission_criteria TEXT;
  ALTER TABLE jobs_pipeline ADD COLUMN IF NOT EXISTS interview_stages INTEGER DEFAULT 0;
  ALTER TABLE jobs_pipeline ADD COLUMN IF NOT EXISTS interview_stage_detail TEXT;
  ALTER TABLE jobs_pipeline ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT '一般';
  ALTER TABLE jobs_pipeline ADD COLUMN IF NOT EXISTS salary_min INTEGER;
  ALTER TABLE jobs_pipeline ADD COLUMN IF NOT EXISTS salary_max INTEGER;
  ALTER TABLE jobs_pipeline ADD COLUMN IF NOT EXISTS rejection_criteria TEXT;
`).catch(err => console.warn('job card new fields migration:', err.message));

// 擴充 VARCHAR(100) 欄位，避免爬蟲匯入資料超長
pool.query(`
  ALTER TABLE candidates_pipeline ALTER COLUMN location TYPE VARCHAR(255);
  ALTER TABLE candidates_pipeline ALTER COLUMN education TYPE VARCHAR(255);
  ALTER TABLE candidates_pipeline ALTER COLUMN source TYPE VARCHAR(255);
  ALTER TABLE candidates_pipeline ALTER COLUMN recruiter TYPE VARCHAR(255);
  ALTER TABLE candidates_pipeline ALTER COLUMN personality_type TYPE VARCHAR(255);
`).catch(err => console.warn('column resize migration:', err.message));

// 出生年月日欄位
pool.query(`
  ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS birthday DATE;
`).catch(err => console.warn('birthday migration:', err.message));

// 年齡是否為推估值
pool.query(`
  ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS age_estimated BOOLEAN DEFAULT true;
`).catch(err => console.warn('age_estimated migration:', err.message));

// 性別欄位
pool.query(`
  ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS gender TEXT;
`).catch(err => console.warn('gender migration:', err.message));

// 英文名欄位
pool.query(`
  ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS english_name TEXT;
`).catch(err => console.warn('english_name migration:', err.message));

// AI 總結結果欄位（AI 分析後回寫的結構化總結）
pool.query(`
  ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS ai_summary JSONB;
`).catch(err => console.warn('ai_summary migration:', err.message));

// 履歷 PDF 附件（base64 存於 JSONB 陣列，最多 3 個）
pool.query(`
  ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS resume_files JSONB DEFAULT '[]';
`).catch(err => console.warn('resume_files migration:', err.message));

// 語音評估 + 自傳 + 作品集欄位
pool.query(`
  ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS voice_assessments JSONB DEFAULT '[]';
  ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS biography TEXT;
  ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS portfolio_url VARCHAR(500);
`).catch(err => console.warn('voice/bio/portfolio migration:', err.message));

// 顧問備註欄位（顧問與人選聊過後的重點記錄）
pool.query(`
  ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS consultant_note TEXT;
`).catch(err => console.warn('consultant_note migration:', err.message));

// 客戶送件規範（JSONB 欄位，每個客戶一組規則）
pool.query(`
  ALTER TABLE clients ADD COLUMN IF NOT EXISTS submission_rules JSONB DEFAULT '[]'
`).catch(err => console.warn('submission_rules migration:', err.message));

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

// 顧問名稱清理：合併爬蟲帳號 → 待指派，Jacky Chen → Jacky
pool.query(`
  UPDATE candidates_pipeline SET recruiter = '待指派', updated_at = NOW()
  WHERE LOWER(recruiter) IN ('crawler', 'crawler-webui', 'crawler-autopush', 'd級人才庫重整')
`).then(r => {
  if (r.rowCount > 0) console.log(`✅ 顧問名稱清理：${r.rowCount} 位爬蟲帳號已改為「待指派」`);
}).catch(err => console.warn('consultant cleanup (bots):', err.message));

pool.query(`
  UPDATE candidates_pipeline SET recruiter = 'Jacky', updated_at = NOW()
  WHERE recruiter = 'Jacky Chen'
`).then(r => {
  if (r.rowCount > 0) console.log(`✅ 顧問名稱合併：${r.rowCount} 位「Jacky Chen」已合併為「Jacky」`);
}).catch(err => console.warn('consultant cleanup (alias):', err.message));

// 確保 notifications 資料表存在（站內通知系統）
pool.query(`
  CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    recipient TEXT NOT NULL DEFAULT 'all',
    type VARCHAR(50) NOT NULL DEFAULT 'system_update',
    title VARCHAR(255) NOT NULL,
    message TEXT,
    link VARCHAR(500),
    data JSONB,
    actor VARCHAR(100),
    is_read JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
  )
`).then(() => {
  pool.query(`CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC)`).catch(() => {});
  pool.query(`CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient)`).catch(() => {});
}).catch(err => console.warn('notifications migration:', err.message));

// P0 DBA: 加入 indexes + partial unique constraint 防止重複
// candidates_pipeline 索引
pool.query(`CREATE INDEX IF NOT EXISTS idx_candidates_status ON candidates_pipeline(status)`).catch(() => {});
pool.query(`CREATE INDEX IF NOT EXISTS idx_candidates_created ON candidates_pipeline(created_at DESC)`).catch(() => {});
pool.query(`CREATE INDEX IF NOT EXISTS idx_candidates_name_lower ON candidates_pipeline(LOWER(TRIM(name)))`).catch(() => {});
pool.query(`CREATE INDEX IF NOT EXISTS idx_candidates_recruiter ON candidates_pipeline(recruiter)`).catch(() => {});
pool.query(`CREATE INDEX IF NOT EXISTS idx_candidates_target_job ON candidates_pipeline(target_job_id) WHERE target_job_id IS NOT NULL`).catch(() => {});
// LinkedIn URL 部分唯一約束（排除空值）— 防止 TOCTOU race condition
// 先清除重複的 LinkedIn URL（保留最新的那筆），再建 unique index
(async () => {
  try {
    // 將重複 LinkedIn URL 中較舊的紀錄清空 linkedin_url（保留 id 最大的）
    await pool.query(`
      UPDATE candidates_pipeline SET linkedin_url = NULL
      WHERE id NOT IN (
        SELECT MAX(id) FROM candidates_pipeline
        WHERE linkedin_url IS NOT NULL AND linkedin_url != ''
        GROUP BY LOWER(TRIM(linkedin_url))
      )
      AND linkedin_url IS NOT NULL AND linkedin_url != ''
    `);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_candidates_linkedin_unique
      ON candidates_pipeline(LOWER(TRIM(linkedin_url)))
      WHERE linkedin_url IS NOT NULL AND linkedin_url != ''`);
  } catch (e) {
    console.warn('⚠️ LinkedIn unique index migration:', e.message);
  }
})();
// jobs_pipeline 索引
pool.query(`CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs_pipeline(job_status)`).catch(() => {});
pool.query(`CREATE INDEX IF NOT EXISTS idx_jobs_created ON jobs_pipeline(created_at DESC)`).catch(() => {});
pool.query(`CREATE INDEX IF NOT EXISTS idx_jobs_priority ON jobs_pipeline(priority)`).catch(() => {});

// ====================== Sprint 1: Structured Candidate Fields ======================
// Auto-migration for Layer 1 (Match Core) + Layer 2 (Deal/Timing) + Layer 3 (Enrichment) + Talent Board

// Layer 1: Match Core
pool.query(`
  ALTER TABLE candidates_pipeline
  ADD COLUMN IF NOT EXISTS current_title VARCHAR(200),
  ADD COLUMN IF NOT EXISTS current_company VARCHAR(200),
  ADD COLUMN IF NOT EXISTS role_family VARCHAR(50),
  ADD COLUMN IF NOT EXISTS canonical_role VARCHAR(200),
  ADD COLUMN IF NOT EXISTS seniority_level VARCHAR(50),
  ADD COLUMN IF NOT EXISTS total_years NUMERIC(4,1),
  ADD COLUMN IF NOT EXISTS industry_tag VARCHAR(100),
  ADD COLUMN IF NOT EXISTS normalized_skills JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS skill_evidence JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS education_level VARCHAR(50),
  ADD COLUMN IF NOT EXISTS current_salary_min INTEGER,
  ADD COLUMN IF NOT EXISTS current_salary_max INTEGER,
  ADD COLUMN IF NOT EXISTS expected_salary_min INTEGER,
  ADD COLUMN IF NOT EXISTS expected_salary_max INTEGER,
  ADD COLUMN IF NOT EXISTS salary_currency VARCHAR(10) DEFAULT 'TWD',
  ADD COLUMN IF NOT EXISTS salary_period VARCHAR(20) DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS notice_period_enum VARCHAR(20),
  ADD COLUMN IF NOT EXISTS job_search_status_enum VARCHAR(20)
`).catch(err => console.warn('Sprint1 Layer1 migration:', err.message));

// Layer 2: Deal/Timing (fields types.ts references but were missing)
pool.query(`
  ALTER TABLE candidates_pipeline
  ADD COLUMN IF NOT EXISTS age INTEGER,
  ADD COLUMN IF NOT EXISTS industry VARCHAR(200),
  ADD COLUMN IF NOT EXISTS languages TEXT,
  ADD COLUMN IF NOT EXISTS certifications TEXT,
  ADD COLUMN IF NOT EXISTS notice_period VARCHAR(100),
  ADD COLUMN IF NOT EXISTS management_experience BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS team_size VARCHAR(50),
  ADD COLUMN IF NOT EXISTS consultant_evaluation JSONB,
  ADD COLUMN IF NOT EXISTS job_search_status VARCHAR(50),
  ADD COLUMN IF NOT EXISTS reason_for_change TEXT,
  ADD COLUMN IF NOT EXISTS motivation VARCHAR(200),
  ADD COLUMN IF NOT EXISTS deal_breakers TEXT,
  ADD COLUMN IF NOT EXISTS competing_offers TEXT,
  ADD COLUMN IF NOT EXISTS relationship_level VARCHAR(50)
`).catch(err => console.warn('Sprint1 Layer2 migration:', err.message));

// Layer 3: Enrichment + Meta + Talent Board
pool.query(`
  ALTER TABLE candidates_pipeline
  ADD COLUMN IF NOT EXISTS education_summary TEXT,
  ADD COLUMN IF NOT EXISTS resume_assets JSONB,
  ADD COLUMN IF NOT EXISTS auto_derived JSONB,
  ADD COLUMN IF NOT EXISTS data_quality JSONB,
  ADD COLUMN IF NOT EXISTS grade_level VARCHAR(2),
  ADD COLUMN IF NOT EXISTS source_tier VARCHAR(2),
  ADD COLUMN IF NOT EXISTS heat_level VARCHAR(10)
`).catch(err => console.warn('Sprint1 Layer3+Board migration:', err.message));

// Indexes for new fields
pool.query(`CREATE INDEX IF NOT EXISTS idx_cp_role_family ON candidates_pipeline(role_family)`).catch(() => {});
pool.query(`CREATE INDEX IF NOT EXISTS idx_cp_industry_tag ON candidates_pipeline(industry_tag)`).catch(() => {});
pool.query(`CREATE INDEX IF NOT EXISTS idx_cp_grade_level ON candidates_pipeline(grade_level)`).catch(() => {});
pool.query(`CREATE INDEX IF NOT EXISTS idx_cp_heat_level ON candidates_pipeline(heat_level)`).catch(() => {});
pool.query(`CREATE INDEX IF NOT EXISTS idx_cp_source_tier ON candidates_pipeline(source_tier)`).catch(() => {});
pool.query(`CREATE INDEX IF NOT EXISTS idx_cp_normalized_skills ON candidates_pipeline USING GIN (normalized_skills)`).catch(() => {});

// ── Precision Evaluation Gate: precision_eligible 欄位 ──
pool.query(`ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS precision_eligible BOOLEAN DEFAULT FALSE`).catch(err => console.warn('Precision eligible migration:', err.message));
pool.query(`CREATE INDEX IF NOT EXISTS idx_cp_precision_eligible ON candidates_pipeline(precision_eligible)`).catch(() => {});

// ── Sprint 5: interactions 互動紀錄表 ──
pool.query(`
  CREATE TABLE IF NOT EXISTS interactions (
    id SERIAL PRIMARY KEY,
    candidate_id INTEGER NOT NULL,
    interaction_type VARCHAR(30) NOT NULL,
    interaction_date TIMESTAMP NOT NULL DEFAULT NOW(),
    channel VARCHAR(30),
    summary TEXT,
    next_action TEXT,
    next_action_date DATE,
    response_level VARCHAR(20),
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )
`).then(() => {
  pool.query(`CREATE INDEX IF NOT EXISTS idx_interactions_candidate ON interactions(candidate_id)`).catch(() => {});
  pool.query(`CREATE INDEX IF NOT EXISTS idx_interactions_next_action ON interactions(next_action_date) WHERE next_action_date IS NOT NULL`).catch(() => {});
}).catch(err => console.warn('interactions table migration:', err.message));

// Telegram 發送輔助函數
async function sendTelegram(botToken, chatId, text) {
  if (!botToken || !chatId) return;
  try {
    const https = require('https');
    const postData = JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' });
    const options = {
      hostname: 'api.telegram.org',
      path: `/bot${botToken}/sendMessage`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
    };
    await new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => resolve(body));
      });
      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  } catch (err) {
    console.warn('⚠️ Telegram 發送失敗:', err.message);
  }
}

// 寫入 notifications 輔助函數（同時推送 Telegram 重要通知）
// TG 推送規則：system_update / github_push → 群組；candidate_assign → 個人私訊
async function writeNotification({ recipient, type, title, message, link, data, actor }) {
  try {
    await pool.query(
      `INSERT INTO notifications (recipient, type, title, message, link, data, actor)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [recipient || 'all', type || 'system_update', title,
       message || null, link || null,
       data ? JSON.stringify(data) : null, actor || 'system']
    );
  } catch (err) {
    console.warn('⚠️ writeNotification 失敗:', err.message);
  }

  // Telegram 推送（非阻塞）
  const tgTypes = ['system_update', 'github_push', 'candidate_assign'];
  if (!tgTypes.includes(type)) return;

  try {
    const tgText = `<b>${title}</b>\n${message || ''}`;

    if (type === 'system_update' || type === 'github_push') {
      // 全體通知 → 推群組
      const cfg = await pool.query(
        `SELECT key, value FROM system_config WHERE key IN ('telegram_group_bot_token', 'telegram_group_chat_id')`
      );
      const cfgMap = {};
      cfg.rows.forEach(r => { cfgMap[r.key] = r.value; });
      if (cfgMap.telegram_group_bot_token && cfgMap.telegram_group_chat_id) {
        sendTelegram(cfgMap.telegram_group_bot_token, cfgMap.telegram_group_chat_id, tgText);
      }
    }

    if (type === 'candidate_assign' && recipient && recipient !== 'all') {
      // 個人通知 → 查該用戶的 TG 設定
      const uidToName = { 'phoebe': 'Phoebe', 'jacky': 'Jacky', 'jim': 'Jim', 'admin': 'Admin' };
      const displayName = uidToName[recipient] || recipient;
      const userTg = await pool.query(
        `SELECT telegram_bot_token, telegram_chat_id FROM user_contacts WHERE display_name = $1`,
        [displayName]
      );
      if (userTg.rows[0] && userTg.rows[0].telegram_bot_token && userTg.rows[0].telegram_chat_id) {
        sendTelegram(userTg.rows[0].telegram_bot_token, userTg.rows[0].telegram_chat_id, tgText);
      }
    }
  } catch (err) {
    console.warn('⚠️ TG 推送查詢失敗（非阻塞）:', err.message);
  }
}

// 寫入 system_logs 輔助函數
async function writeLog({ action, actor, candidateId, candidateName, detail }) {
  // 判斷 AIBOT：包含 "aibot" 或以 "bot" 結尾（如 Jackeybot、Phoebebot）
  const actorType = /aibot|bot$/i.test(actor) ? 'AIBOT' : 'HUMAN';
  try {
    await pool.query(
      `INSERT INTO system_logs (action, actor, actor_type, candidate_id, candidate_name, detail)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [action, actor || 'system', actorType, candidateId || null, candidateName || null,
       detail ? JSON.stringify(detail) : null]
    );
  } catch (err) {
    console.warn('⚠️ writeLog 失敗（非阻塞）:', err.message);
  }
}

// ==================== SQL → Google Sheets 同步 ====================

const GOG_SHEET_ID = process.env.SHEET_ID || '1PunpaDAFBPBL_I76AiRYGXKaXDZvMl1c262SEtxRk6Q';
const GOG_SHEET_NAME = 'candidates';

/**
 * SQL → Sheets 非同步同步（匯入後自動觸發）
 * 新增的人選 → append 到 Sheets
 * 更新的人選 → 找到行號並更新
 */
async function syncSQLToSheets(candidateRows) {
  if (!candidateRows || candidateRows.length === 0) return;

  // 檢查 gog 是否可用
  try {
    await execFilePromise('which', ['gog'], { timeout: 5000 });
  } catch {
    console.warn('⚠️ gog CLI 不可用，跳過 Sheets 同步');
    return;
  }

  console.log(`📤 SQL → Sheets 同步 ${candidateRows.length} 筆...`);

  for (const row of candidateRows) {
    try {
      // 從 SQL 取得完整資料
      const full = await pool.query('SELECT * FROM candidates_pipeline WHERE id = $1', [row.id]);
      if (full.rows.length === 0) continue;
      const c = full.rows[0];

      // 先搜尋 Sheets 中是否已有此人
      let sheetsRowNum = null;
      try {
        const { stdout } = await execFilePromise('gog', [
          'sheets', 'get', GOG_SHEET_ID, `${GOG_SHEET_NAME}!A2:A1000`, '--json'
        ], { timeout: 15000, maxBuffer: 5 * 1024 * 1024 });
        const names = JSON.parse(stdout);
        const idx = names.findIndex(r => (r[0] || '').trim().toLowerCase() === (c.name || '').trim().toLowerCase());
        if (idx >= 0) sheetsRowNum = idx + 2; // 第 2 行開始
      } catch (e) {
        console.warn(`⚠️ Sheets 查詢失敗: ${e.message}`);
      }

      // 構建行資料（A-W 共 23 欄）
      const rowData = [
        c.name || '',                                   // A 姓名
        '',                                             // B Email
        c.phone || '',                                  // C 電話
        c.location || '',                               // D 地點
        c.current_position || '',                       // E 職位
        c.years_experience || '',                       // F 年資
        c.job_changes || '',                            // G 轉職次數
        c.avg_tenure_months || '',                      // H 平均任職
        c.recent_gap_months || '',                      // I 最近gap
        c.skills || '',                                 // J 技能
        c.education || '',                              // K 學歷
        c.source || '',                                 // L 來源
        c.work_history ? JSON.stringify(c.work_history) : '', // M 工作經歷
        c.leaving_reason || '',                         // N 離職原因
        c.stability_score || '',                        // O 穩定性
        c.education_details ? JSON.stringify(c.education_details) : '', // P 學歷JSON
        c.personality_type || '',                       // Q DISC
        c.status || '未開始',                             // R 狀態
        c.recruiter || '',                              // S 顧問
        c.notes || '',                                  // T 備註
        c.contact_link || '',                           // U 履歷連結
        c.talent_level || '',                           // V 人才等級
        c.progress_tracking ? JSON.stringify(c.progress_tracking) : '' // W 進度
      ].map(v => String(v).replace(/\n/g, ' ').replace(/\r/g, ' ').replace(/"/g, "'")).join('|');

      if (sheetsRowNum) {
        // 更新既有行（使用 execFile 避免 shell injection）
        await execFilePromise('gog', [
          'sheets', 'update', GOG_SHEET_ID,
          `${GOG_SHEET_NAME}!A${sheetsRowNum}:W${sheetsRowNum}`, rowData
        ], { timeout: 15000 });
        console.log(`  ✅ Sheets 更新: ${c.name} (row ${sheetsRowNum})`);
      } else {
        // 新增行（使用 execFile 避免 shell injection）
        await execFilePromise('gog', [
          'sheets', 'append', GOG_SHEET_ID, GOG_SHEET_NAME, rowData
        ], { timeout: 15000 });
        console.log(`  ✅ Sheets 新增: ${c.name}`);
      }

      // 延遲 500ms，避免 Google API 限流（原 2 秒太久）
      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      console.warn(`  ⚠️ Sheets 同步 ${row.name} 失敗: ${err.message}`);
    }
  }

  console.log('📤 SQL → Sheets 同步完成');
}

// ==================== 候選人 API ====================

/**
 * GET /api/candidates
 * 列出候選人（支援分頁）
 *
 * Query params:
 *   limit   - 每頁筆數，預設 500，最大 2000
 *   offset  - 偏移量，預設 0（用於分頁）
 *   page    - 頁碼（從 1 開始），與 offset 二擇一
 *   status  - 依狀態篩選
 *   source  - 依來源篩選
 *   created_today - 只取今日新增
 *
 * Response 新增 pagination 欄位：
 *   { success, data, count, total, pagination: { limit, offset, hasMore } }
 */
router.get('/candidates', async (req, res) => {
  try {
    const client = await pool.connect();
    try {

    // 支援查詢參數篩選
    const { status, source, limit: rawLimit, offset: rawOffset, page, created_today } = req.query;
    const conditions = [];
    const params = [];

    if (status) {
      params.push(status);
      conditions.push(`c.status = $${params.length}`);
    }
    if (source) {
      params.push(source);
      conditions.push(`c.source = $${params.length}`);
    }
    if (created_today === 'true') {
      conditions.push(`DATE(c.created_at AT TIME ZONE 'Asia/Taipei') = DATE(NOW() AT TIME ZONE 'Asia/Taipei')`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // 分頁參數
    const parsedLimit = rawLimit ? Math.min(Math.max(1, parseInt(rawLimit)), 2000) : 500;
    let parsedOffset = 0;
    if (rawOffset) {
      parsedOffset = Math.max(0, parseInt(rawOffset) || 0);
    } else if (page) {
      const pageNum = Math.max(1, parseInt(page) || 1);
      parsedOffset = (pageNum - 1) * parsedLimit;
    }

    // 先取 total count
    const countResult = await client.query(
      `SELECT COUNT(*) AS total FROM candidates_pipeline c ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);

    // 加入分頁 params
    const dataParams = [...params];
    dataParams.push(parsedLimit);
    const limitIdx = dataParams.length;
    dataParams.push(parsedOffset);
    const offsetIdx = dataParams.length;

    const result = await client.query(`
      SELECT
        c.id, c.name, c.contact_link, c.phone, c.email,
        c.linkedin_url, c.github_url, c.location, c.current_position,
        c.years_experience, c.job_changes, c.avg_tenure_months, c.recent_gap_months,
        c.skills, c.education, c.source, c.work_history, c.leaving_reason,
        c.stability_score, c.education_details, c.personality_type,
        c.status, c.recruiter, c.notes, c.talent_level, c.progress_tracking,
        c.created_at, c.updated_at, c.ai_match_result, c.target_job_id, c.interview_round,
        c.age, c.industry, c.languages, c.certifications,
        c.current_salary, c.expected_salary, c.notice_period,
        c.management_experience, c.team_size, c.consultant_evaluation,
        c.job_search_status, c.reason_for_change, c.motivation,
        c.deal_breakers, c.competing_offers, c.relationship_level,
        c.voice_assessments, c.biography, c.portfolio_url, c.ai_summary,
        c.consultant_note, c.birthday, c.gender, c.english_name,
        c.current_title, c.current_company, c.role_family, c.canonical_role,
        c.seniority_level, c.total_years, c.industry_tag, c.normalized_skills,
        c.education_level, c.current_salary_min, c.current_salary_max,
        c.expected_salary_min, c.expected_salary_max, c.salary_currency, c.salary_period,
        c.notice_period_enum, c.job_search_status_enum,
        c.ai_score, c.ai_grade, c.ai_report, c.ai_recommendation,
        c.auto_derived, c.data_quality, c.precision_eligible, c.grade_level, c.source_tier, c.heat_level,
        (SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'id', elem->>'id', 'filename', elem->>'filename',
            'mimetype', elem->>'mimetype', 'size', (elem->>'size')::int,
            'uploaded_at', elem->>'uploaded_at', 'uploaded_by', elem->>'uploaded_by'
          )
        ), '[]'::jsonb)
        FROM jsonb_array_elements(COALESCE(c.resume_files, '[]'::jsonb)) elem
        ) AS resume_files,
        j.position_name AS target_job_label, j.client_company AS target_job_company
      FROM candidates_pipeline c
      LEFT JOIN jobs_pipeline j ON j.id = c.target_job_id
      ${whereClause}
      ORDER BY c.id ASC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `, dataParams);

    const candidates = result.rows.map(row => ({
      // 基本必需欄位（Candidate interface）
      id: row.id.toString(),
      name: row.name || '',
      email: row.email || '',
      phone: row.phone || '',
      location: row.location || '', // 數據庫沒有，使用空值
      position: row.current_position || '',
      years: (() => { const v = parseInt(row.years_experience); if (!isNaN(v) && v > 0 && v <= 60) return v; const c = computeYearsFromWorkHistory(row.work_history); return (c && c > 0) ? c : 0; })(),
      jobChanges: (() => { const v = parseInt(row.job_changes); return (!isNaN(v) && v >= 0 && v <= 30) ? v : 0; })(),
      avgTenure: (() => { const v = parseInt(row.avg_tenure_months); return (!isNaN(v) && v >= 0 && v <= 600) ? v : 0; })(),
      lastGap: (() => { const v = parseInt(row.recent_gap_months); return (!isNaN(v) && v >= 0 && v <= 600) ? v : 0; })(),
      skills: row.skills || '',
      education: row.education || '',
      source: row.source || '其他', // CandidateSource enum
      status: row.status || '未開始', // CandidateStatus enum
      consultant: row.recruiter || '待指派',
      notes: row.notes || '',
      stabilityScore: isNaN(parseInt(row.stability_score)) ? 0 : parseInt(row.stability_score),
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
      createdBy: 'system',
      
      // 可選欄位（詳細資訊）
      linkedinUrl: row.linkedin_url || '',
      githubUrl: row.github_url || '',
      resumeLink: row.contact_link || '',
      workHistory: (() => { const v = row.work_history; if (!v) return []; if (Array.isArray(v)) return v; if (typeof v === 'string') { try { const p = JSON.parse(v); if (Array.isArray(p)) return p; } catch {} } return []; })(),
      quitReasons: row.leaving_reason || '',
      educationJson: (() => { const v = row.education_details; if (!v) return []; if (Array.isArray(v)) return v; if (typeof v === 'string') { try { const p = JSON.parse(v); if (Array.isArray(p)) return p; } catch {} } return []; })(),
      discProfile: row.personality_type || '',
      progressTracking: row.progress_tracking || [],
      // OpenClaw AI 評分欄位
      aiScore: row.ai_score != null ? row.ai_score : null,
      aiGrade: row.ai_grade || '',
      aiReport: row.ai_report || '',
      aiRecommendation: row.ai_recommendation || '',
      ai_score: row.ai_score != null ? row.ai_score : null,
      ai_grade: row.ai_grade || '',
      ai_report: row.ai_report || '',
      ai_recommendation: row.ai_recommendation || '',
      aiMatchResult: row.ai_match_result ? (() => {
        // 支援新舊格式，直接傳遞完整的 ai_match_result 物件
        const am = row.ai_match_result;
        // 確保陣列欄位始終是陣列（AI Bot 有時會寫入字串）
        const toArr = (v) => Array.isArray(v) ? v : (typeof v === 'string' && v.trim() ? v.split(/[,、\n]+/).map(s => s.trim()).filter(Boolean) : []);
        return {
          score: am.score || 0,
          grade: am.grade || 'B',
          recommendation: am.recommendation || (am.grade === 'A+' ? '強力推薦' : am.grade === 'A' ? '推薦' : am.grade === 'B' ? '觀望' : '不推薦'),
          job_title: am.job_title || am.position || '',
          company: am.company || '',
          matched_skills: toArr(am.matched_skills || am.strengths),
          missing_skills: toArr(am.missing_skills || am.to_confirm),
          strengths: toArr(am.strengths),
          probing_questions: toArr(am.probing_questions),
          salary_fit: am.salary_fit || '',
          conclusion: am.conclusion || '',
          suggestion: am.suggestion || '',
          evaluated_by: am.evaluated_by || 'AIBot',
          evaluated_at: am.evaluated_at || am.date || new Date().toISOString(),
          github_url: am.github_url || ''
        };
      })() : null,
      
      // 向後相容：保留 DB 字段名（snake_case，供 AIbot 讀取）
      contact_link: row.contact_link || '',
      current_position: row.current_position || '',
      current_title: row.current_title || '',
      current_company: row.current_company || '',
      linkedin_url: row.linkedin_url || '',
      github_url: row.github_url || '',
      years_experience: row.years_experience || '',
      job_changes: row.job_changes || '',
      avg_tenure_months: row.avg_tenure_months || '',
      recent_gap_months: row.recent_gap_months || '',
      work_history: (() => { const v = row.work_history; if (!v) return []; if (Array.isArray(v)) return v; if (typeof v === 'string') { try { const p = JSON.parse(v); if (Array.isArray(p)) return p; } catch {} } return []; })(),
      leaving_reason: row.leaving_reason || '',
      stability_score: row.stability_score || '',
      education_details: (() => { const v = row.education_details; if (!v) return []; if (Array.isArray(v)) return v; if (typeof v === 'string') { try { const p = JSON.parse(v); if (Array.isArray(p)) return p; } catch {} } return []; })(),
      personality_type: row.personality_type || '',
      recruiter: row.recruiter || '待指派',
      talent_level: row.talent_level || '',
      targetJobId: row.target_job_id || null,
      targetJobLabel: row.target_job_label
        ? `${row.target_job_label}${row.target_job_company ? ` (${row.target_job_company})` : ''}`
        : null,
      interviewRound: row.interview_round || null,
      // Phase 1 新增欄位
      birthday: row.birthday || null,
      age: row.age != null ? parseInt(row.age) : estimateAgeFromEducation(row.education_details),
      ageEstimated: row.birthday ? false : (row.age == null), // 有生日 = 確定值
      gender: row.gender || '',
      englishName: row.english_name || '',
      consultantNote: row.consultant_note || '',
      industry: row.industry || '',
      languages: row.languages || '',
      certifications: row.certifications || '',
      currentSalary: row.current_salary || '',
      expectedSalary: row.expected_salary || '',
      noticePeriod: row.notice_period || '',
      managementExperience: row.management_experience || false,
      teamSize: row.team_size || '',
      consultantEvaluation: row.consultant_evaluation || null,
      // Phase 3 動機與交易條件
      jobSearchStatus: row.job_search_status || '',
      reasonForChange: row.reason_for_change || '',
      motivation: row.motivation || '',
      dealBreakers: row.deal_breakers || '',
      competingOffers: row.competing_offers || '',
      relationshipLevel: row.relationship_level || '',
      // 語音評估 + 自傳 + 作品集
      voiceAssessments: (() => { const v = row.voice_assessments; if (!v) return []; if (Array.isArray(v)) return v; if (typeof v === 'string') { try { const p = JSON.parse(v); if (Array.isArray(p)) return p; } catch {} } return []; })(),
      biography: row.biography || '',
      portfolioUrl: row.portfolio_url || '',
      aiSummary: row.ai_summary || null,
      resumeFiles: row.resume_files || [],
      // Sprint 1: Structured fields
      currentTitle: row.current_title || '',
      currentCompany: row.current_company || '',
      roleFamily: row.role_family || '',
      canonicalRole: row.canonical_role || '',
      seniorityLevel: row.seniority_level || '',
      totalYears: row.total_years != null ? parseFloat(row.total_years) : null,
      industryTag: row.industry_tag || '',
      normalizedSkills: (() => { const v = row.normalized_skills; if (!v) return []; if (Array.isArray(v)) return v; if (typeof v === 'string') { try { const p = JSON.parse(v); if (Array.isArray(p)) return p; } catch {} } return []; })(),
      educationLevel: row.education_level || '',
      currentSalaryMin: row.current_salary_min != null ? parseInt(row.current_salary_min) : null,
      currentSalaryMax: row.current_salary_max != null ? parseInt(row.current_salary_max) : null,
      expectedSalaryMin: row.expected_salary_min != null ? parseInt(row.expected_salary_min) : null,
      expectedSalaryMax: row.expected_salary_max != null ? parseInt(row.expected_salary_max) : null,
      salaryCurrency: row.salary_currency || 'TWD',
      salaryPeriod: row.salary_period || 'monthly',
      noticePeriodEnum: row.notice_period_enum || '',
      jobSearchStatusEnum: row.job_search_status_enum || '',
      autoDerived: (() => { const v = row.auto_derived; if (!v) return null; if (typeof v === 'object') return v; if (typeof v === 'string') { try { return JSON.parse(v); } catch {} } return null; })(),
      dataQuality: (() => { const v = row.data_quality; if (!v) return null; if (typeof v === 'object') return v; if (typeof v === 'string') { try { return JSON.parse(v); } catch {} } return null; })(),
      gradeLevel: row.grade_level || '',
      sourceTier: row.source_tier || '',
      heatLevel: row.heat_level || '',
      precisionEligible: row.precision_eligible || false,
    }));

    res.json({
      success: true,
      data: candidates,
      count: candidates.length,
      total,
      pagination: {
        limit: parsedLimit,
        offset: parsedOffset,
        hasMore: (parsedOffset + candidates.length) < total
      }
    });
    } finally {
      client.release();
    }
  } catch (error) {
    safeError(res, error, 'GET /candidates');
  }
});

/**
 * GET /api/candidates/:id
 * 獲取單一候選人
 */
router.get('/candidates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!/^\d+$/.test(id)) {
      return res.status(404).json({ success: false, error: 'Candidate not found' });
    }
    const client = await pool.connect();
    let result;
    try {
      result = await client.query(
        `SELECT c.*, j.position_name AS target_job_label, j.client_company AS target_job_company
         FROM candidates_pipeline c
         LEFT JOIN jobs_pipeline j ON j.id = c.target_job_id
         WHERE c.id = $1`,
        [id]
      );
    } finally {
      client.release();
    }

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Candidate not found'
      });
    }

    const row = result.rows[0];
    const candidate = {
      id: row.id.toString(),
      name: row.name || '',
      email: row.email || '',
      phone: row.phone || '',
      location: row.location || '',
      position: row.current_position || '',
      years: (() => { const v = parseInt(row.years_experience); if (!isNaN(v) && v > 0 && v <= 60) return v; const c = computeYearsFromWorkHistory(row.work_history); return (c && c > 0) ? c : 0; })(),
      jobChanges: parseInt(row.job_changes) || 0,
      avgTenure: parseInt(row.avg_tenure_months) || 0,
      lastGap: parseInt(row.recent_gap_months) || 0,
      skills: row.skills || '',
      education: row.education || '',
      source: row.source || '',
      status: row.status || '',
      consultant: row.recruiter || '',
      notes: row.notes || '',
      stabilityScore: parseInt(row.stability_score) || 0,
      linkedinUrl: row.linkedin_url || '',
      githubUrl: row.github_url || '',
      resumeLink: row.contact_link || '',
      targetJobId: row.target_job_id || null,
      targetJobLabel: row.target_job_label
        ? `${row.target_job_label}${row.target_job_company ? ` (${row.target_job_company})` : ''}`
        : null,
      birthday: row.birthday || null,
      age: row.age != null ? parseInt(row.age) : estimateAgeFromEducation(row.education_details),
      ageEstimated: row.birthday ? false : (row.age == null),
      gender: row.gender || '',
      englishName: row.english_name || '',
      // JSONB / 詳細欄位
      workHistory: (() => { const v = row.work_history; if (!v) return []; if (Array.isArray(v)) return v; if (typeof v === 'string') { try { const p = JSON.parse(v); if (Array.isArray(p)) return p; } catch {} } return []; })(),
      quitReasons: row.leaving_reason || '',
      educationJson: (() => { const v = row.education_details; if (!v) return []; if (Array.isArray(v)) return v; if (typeof v === 'string') { try { const p = JSON.parse(v); if (Array.isArray(p)) return p; } catch {} } return []; })(),
      discProfile: row.personality_type || '',
      progressTracking: row.progress_tracking || [],
      talentLevel: row.talent_level || '',
      interviewRound: row.interview_round || null,
      // OpenClaw AI 評分欄位
      aiScore: row.ai_score != null ? row.ai_score : null,
      aiGrade: row.ai_grade || '',
      aiReport: row.ai_report || '',
      aiRecommendation: row.ai_recommendation || '',
      ai_score: row.ai_score != null ? row.ai_score : null,
      ai_grade: row.ai_grade || '',
      ai_report: row.ai_report || '',
      ai_recommendation: row.ai_recommendation || '',
      // Phase 3 動機與交易條件
      jobSearchStatus: row.job_search_status || '',
      reasonForChange: row.reason_for_change || '',
      motivation: row.motivation || '',
      dealBreakers: row.deal_breakers || '',
      competingOffers: row.competing_offers || '',
      relationshipLevel: row.relationship_level || '',

      // Phase 1 新增欄位（與 list API 一致）
      consultantNote: row.consultant_note || '',
      industry: row.industry || '',
      languages: row.languages || '',
      certifications: row.certifications || '',
      currentSalary: row.current_salary || '',
      expectedSalary: row.expected_salary || '',
      noticePeriod: row.notice_period || '',
      managementExperience: row.management_experience || false,
      teamSize: row.team_size || '',
      consultantEvaluation: row.consultant_evaluation || null,
      // 語音評估 + 自傳 + 作品集 + AI
      voiceAssessments: (() => { const v = row.voice_assessments; if (!v) return []; if (Array.isArray(v)) return v; if (typeof v === 'string') { try { const p = JSON.parse(v); if (Array.isArray(p)) return p; } catch {} } return []; })(),
      biography: row.biography || '',
      portfolioUrl: row.portfolio_url || '',
      aiSummary: row.ai_summary || null,
      resumeFiles: row.resume_files || [],
      createdBy: 'system',

      // 向後相容：保留 DB 字段名（snake_case，供 AIbot 讀取）
      current_position: row.current_position || '',
      current_title: row.current_title || '',
      current_company: row.current_company || '',
      linkedin_url: row.linkedin_url || '',
      github_url: row.github_url || '',
      work_history: (() => { const v = row.work_history; if (!v) return []; if (Array.isArray(v)) return v; if (typeof v === 'string') { try { const p = JSON.parse(v); if (Array.isArray(p)) return p; } catch {} } return []; })(),
      leaving_reason: row.leaving_reason || '',
      stability_score: row.stability_score || '',
      education_details: (() => { const v = row.education_details; if (!v) return []; if (Array.isArray(v)) return v; if (typeof v === 'string') { try { const p = JSON.parse(v); if (Array.isArray(p)) return p; } catch {} } return []; })(),
      personality_type: row.personality_type || '',
      talent_level: row.talent_level || '',
      progress_tracking: row.progress_tracking || [],

      aiMatchResult: row.ai_match_result ? (() => {
        // 支援新舊格式，直接傳遞完整的 ai_match_result 物件
        const am = row.ai_match_result;
        // 確保陣列欄位始終是陣列（AI Bot 有時會寫入字串）
        const toArr = (v) => Array.isArray(v) ? v : (typeof v === 'string' && v.trim() ? v.split(/[,、\n]+/).map(s => s.trim()).filter(Boolean) : []);
        return {
          score: am.score || 0,
          grade: am.grade || 'B',
          recommendation: am.recommendation || (am.grade === 'A+' ? '強力推薦' : am.grade === 'A' ? '推薦' : am.grade === 'B' ? '觀望' : '不推薦'),
          job_title: am.job_title || am.position || '',
          company: am.company || '',
          matched_skills: toArr(am.matched_skills || am.strengths),
          missing_skills: toArr(am.missing_skills || am.to_confirm),
          strengths: toArr(am.strengths),
          probing_questions: toArr(am.probing_questions),
          salary_fit: am.salary_fit || '',
          conclusion: am.conclusion || '',
          suggestion: am.suggestion || '',
          evaluated_by: am.evaluated_by || 'AIBot',
          evaluated_at: am.evaluated_at || am.date || new Date().toISOString(),
          github_url: am.github_url || ''
        };
      })() : null,
      // Sprint 1: Structured fields (Layer 1 Match Core)
      currentTitle: row.current_title || row.current_position || '',
      currentCompany: row.current_company || '',
      roleFamily: row.role_family || '',
      canonicalRole: row.canonical_role || '',
      seniorityLevel: row.seniority_level || '',
      totalYears: row.total_years != null ? parseFloat(row.total_years) : (parseInt(row.years_experience) || 0),
      industryTag: row.industry_tag || '',
      normalizedSkills: (() => { const v = row.normalized_skills; if (!v) return []; if (Array.isArray(v)) return v; return []; })(),
      skillEvidence: row.skill_evidence || [],
      educationLevel: row.education_level || '',
      currentSalaryMin: row.current_salary_min || null,
      currentSalaryMax: row.current_salary_max || null,
      expectedSalaryMin: row.expected_salary_min || null,
      expectedSalaryMax: row.expected_salary_max || null,
      salaryCurrency: row.salary_currency || 'TWD',
      salaryPeriod: row.salary_period || 'monthly',
      noticePeriodEnum: row.notice_period_enum || '',
      jobSearchStatusEnum: row.job_search_status_enum || '',
      // Layer 3: Enrichment / Meta
      educationSummary: row.education_summary || '',
      autoDerived: row.auto_derived || null,
      dataQuality: row.data_quality || null,
      // Talent Board: 3-Layer Classification
      gradeLevel: row.grade_level || '',
      sourceTier: row.source_tier || '',
      heatLevel: row.heat_level || '',
      // Precision Evaluation Gate
      precisionEligible: row.precision_eligible || false,

      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
    };

    res.json({
      success: true,
      data: candidate
    });
  } catch (error) {
    safeError(res, error, 'GET /candidates/:id');
  }
});

/**
 * GET /api/candidates/:id/match-input
 * Sprint 1: Return ONLY Layer 1 (Match Core) structured fields for AI matching.
 * This endpoint gives AI a clean, structured input — no noise from biography, notes, etc.
 */
router.get('/candidates/:id/match-input', async (req, res) => {
  try {
    const { id } = req.params;
    if (!/^\d+$/.test(id)) {
      return res.status(404).json({ success: false, error: 'Candidate not found' });
    }
    const { rows } = await pool.query(
      `SELECT id, name, current_title, current_position, current_company,
              role_family, canonical_role, seniority_level,
              total_years, years_experience, location, industry_tag,
              normalized_skills, skills, education_level,
              current_salary_min, current_salary_max,
              expected_salary_min, expected_salary_max,
              salary_currency, salary_period,
              notice_period_enum, job_search_status_enum,
              data_quality, precision_eligible
       FROM candidates_pipeline WHERE id = $1`, [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Candidate not found' });
    }
    const r = rows[0];
    // Fallback to old fields if new fields not yet populated
    const normalizedSkills = (() => {
      if (Array.isArray(r.normalized_skills) && r.normalized_skills.length > 0) return r.normalized_skills;
      // Fallback: parse old skills field
      const { normalizeSkillsArray } = require('./taxonomy/matchSkills');
      return normalizeSkillsArray(r.skills);
    })();

    res.json({
      success: true,
      data: {
        candidateId: r.id.toString(),
        name: r.name || '',
        currentTitle: r.current_title || r.current_position || '',
        currentCompany: r.current_company || '',
        roleFamily: r.role_family || '',
        canonicalRole: r.canonical_role || '',
        seniorityLevel: r.seniority_level || '',
        totalYears: r.total_years != null ? parseFloat(r.total_years) : (parseInt(r.years_experience) || 0),
        location: r.location || '',
        industryTag: r.industry_tag || '',
        normalizedSkills,
        educationLevel: r.education_level || '',
        currentSalaryMin: r.current_salary_min || null,
        currentSalaryMax: r.current_salary_max || null,
        expectedSalaryMin: r.expected_salary_min || null,
        expectedSalaryMax: r.expected_salary_max || null,
        salaryCurrency: r.salary_currency || 'TWD',
        salaryPeriod: r.salary_period || 'monthly',
        noticePeriodEnum: r.notice_period_enum || '',
        jobSearchStatusEnum: r.job_search_status_enum || '',
        dataQualityScore: (() => { const dq = r.data_quality; if (!dq) return 0; if (typeof dq === 'object') return dq.completenessScore || 0; if (typeof dq === 'string') { try { return JSON.parse(dq).completenessScore || 0; } catch { return 0; } } return 0; })(),
        precisionEligible: r.precision_eligible || false,
      }
    });
  } catch (error) {
    safeError(res, error, 'GET /candidates/:id/match-input');
  }
});

/**
 * PUT /api/candidates/:id
 * 更新候選人狀態
 */
router.put('/candidates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!/^\d+$/.test(id)) {
      return res.status(404).json({ success: false, error: 'Candidate not found' });
    }
    const { status, notes, consultant, name, progressTracking, aiMatchResult } = req.body;

    // 支援 aiMatchResult 或 ai_match_result
    const matchResult = aiMatchResult || req.body.ai_match_result || null;

    const client = await pool.connect();
    let result;
    try {

    // 如果沒有傳遞 status，保留原本值；否則使用傳遞的值
    const hasStatus = status !== undefined && status !== null;
    const statusValue = hasStatus ? status : undefined;

    result = await client.query(
      hasStatus
        ? `UPDATE candidates_pipeline
           SET status = $1, notes = $2, recruiter = $3,
               progress_tracking = $4, ai_match_result = $5, updated_at = NOW()
           WHERE id = $6
           RETURNING *`
        : `UPDATE candidates_pipeline
           SET notes = $1, recruiter = $2,
               progress_tracking = $3, ai_match_result = $4, updated_at = NOW()
           WHERE id = $5
           RETURNING *`,
      hasStatus
        ? [status, notes || '', consultant || '',
           JSON.stringify(normalizeProgressTracking(progressTracking || [])),
           matchResult ? JSON.stringify(matchResult) : null,
           id]
        : [notes || '', consultant || '',
           JSON.stringify(normalizeProgressTracking(progressTracking || [])),
           matchResult ? JSON.stringify(matchResult) : null,
           id]
    );
    } finally {
      client.release();
    }

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Candidate not found'
      });
    }

    // 寫入操作日誌
    const actor = consultant || 'system';
    writeLog({
      action: 'PIPELINE_CHANGE',
      actor,
      candidateId: parseInt(id),
      candidateName: result.rows[0].name,
      detail: { status, notes: notes?.substring(0, 100), aiMatchResult: matchResult ? '已更新' : undefined }
    });

    // 清除該候選人的職缺匹配快取
    pool.query('DELETE FROM candidate_job_rankings_cache WHERE candidate_id = $1', [id]).catch(() => {});

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Candidate updated successfully'
    });
  } catch (error) {
    safeError(res, error, 'PUT /candidates/:id');
  }
});

/**
 * 從 AIbot 寫入的評分備註文字，自動解析並構建 ai_match_result 結構
 * 支援格式：【xxx評分】86/100 分 ... 6維度評分: ...
 */
function parseNotesToAiMatchResult(notesText, actor) {
  if (!notesText || typeof notesText !== 'string') return null;
  // 只處理含「評分」+ 分數的備註
  if (!/評分.*\d+\/100|\d+\/100.*評分/.test(notesText)) return null;

  try {
    // 提取整體分數
    const scoreMatch = notesText.match(/(\d+)\/100/);
    if (!scoreMatch) return null;
    const score = parseInt(scoreMatch[1]);

    // 推薦等級
    const recommendation =
      score >= 85 ? '強力推薦' :
      score >= 70 ? '推薦' :
      score >= 55 ? '觀望' : '不推薦';

    // 對應職缺（從備註內的「職位:」或「職缺:」取得）
    const jobTitleMatch = notesText.match(/職位[：:]\s*(.+)/);
    const job_title = jobTitleMatch ? jobTitleMatch[1].trim() : undefined;

    // 技能列表
    const skillsMatch = notesText.match(/技能[：:]\s*(.+)/);
    const skillsRaw = skillsMatch ? skillsMatch[1].split(/[,，、]/).map(s => s.trim()).filter(Boolean) : [];

    // 6 維度分數 → 推算 matched/missing
    const dimScores = {};
    const dimRegex = /([^:：\n]{2,8})\s*\(\d+%\)[：:]\s*(\d+)\/(\d+)/g;
    let m;
    while ((m = dimRegex.exec(notesText)) !== null) {
      const ratio = parseInt(m[2]) / parseInt(m[3]);
      dimScores[m[1].trim()] = ratio;
    }

    // 技能匹配維度分數
    const skillMatchRatio = dimScores['技能匹配'] || dimScores['技能'] || 0;
    const matched_skills = skillMatchRatio >= 0.6 ? skillsRaw : skillsRaw.slice(0, Math.ceil(skillsRaw.length * skillMatchRatio));
    const missing_skills = skillMatchRatio < 1.0 && skillsRaw.length > matched_skills.length
      ? skillsRaw.slice(matched_skills.length)
      : [];

    // 構建優勢
    const strengths = Object.entries(dimScores)
      .filter(([, ratio]) => ratio >= 0.8)
      .map(([dim, ratio]) => `${dim}符合度高（${Math.round(ratio * 100)}%）`);
    if (strengths.length === 0 && score >= 70) strengths.push('整體評分良好，具備基本條件');

    // 建議顧問詢問問題（依弱項動態生成）
    const probing_questions = [];
    if ((dimScores['技能匹配'] || 1) < 0.8) probing_questions.push('目前使用的主要技術棧為何？是否有學習相關技能的計劃？');
    if ((dimScores['職場信號'] || dimScores['招聘意願'] || 1) < 0.9) probing_questions.push('目前求職狀態如何？是否已在面試其他機會？');
    probing_questions.push('期望薪資範圍與到職時間？');
    probing_questions.push('離開現職的主要考量為何？');

    // 從備註取得 LinkedIn
    const liMatch = notesText.match(/LinkedIn[：:\s]+(https?:\/\/\S+)/i);

    return {
      score,
      recommendation,
      job_title,
      matched_skills,
      missing_skills,
      strengths,
      probing_questions,
      conclusion: notesText.replace(/LinkedIn[：:\s]+https?:\/\/\S+/gi, '').trim(),
      evaluated_at: new Date().toISOString(),
      evaluated_by: actor || 'AIbot',
      _linkedin_url: liMatch ? liMatch[1] : null,  // 內部用，供 PATCH 一起更新
    };
  } catch (e) {
    return null;
  }
}

/**
 * PATCH /api/candidates/:id
 * 局部更新候選人（支援欄位：status, progressTracking, recruiter, notes, talent_level, name）
 * 適用於前端操作及 AIbot 呼叫
 */
router.patch('/candidates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!/^\d+$/.test(id)) {
      return res.status(404).json({ success: false, error: 'Candidate not found' });
    }
    const { status, progressTracking, recruiter, talent_level, name,
            stability_score, ai_match_result } = req.body;
    // 支援 notes 與 remarks 兩種欄位名稱（AIbot 相容性）
    const notes = req.body.notes !== undefined ? req.body.notes : req.body.remarks;
    // 支援 snake_case 與 camelCase 兩種格式（AIbot 相容性）
    const linkedin_url = req.body.linkedin_url !== undefined ? req.body.linkedin_url : req.body.linkedinUrl;
    const github_url   = req.body.github_url   !== undefined ? req.body.github_url   : req.body.githubUrl;
    const email = req.body.email;
    // 人工編輯欄位
    const phone = req.body.phone;
    const location = req.body.location;
    const position = req.body.position !== undefined ? req.body.position : req.body.current_position;
    const years = req.body.years !== undefined ? req.body.years : req.body.years_experience;
    const skills = req.body.skills;
    const education = req.body.education;
    const work_history = req.body.work_history;
    const education_details = req.body.education_details;
    const target_job_id = req.body.target_job_id !== undefined ? req.body.target_job_id : undefined;
    const interview_round = req.body.interview_round !== undefined ? req.body.interview_round : req.body.interviewRound;
    // Phase 1 新增欄位
    const birthday = req.body.birthday;
    const age = req.body.age;
    const age_estimated = req.body.age_estimated !== undefined ? req.body.age_estimated : req.body.ageEstimated;
    const gender = req.body.gender;
    const english_name = req.body.english_name !== undefined ? req.body.english_name : req.body.englishName;
    const consultant_note = req.body.consultant_note !== undefined ? req.body.consultant_note : req.body.consultantNote;
    const industry = req.body.industry;
    const languages = req.body.languages;
    const certifications = req.body.certifications;
    const current_salary = req.body.current_salary !== undefined ? req.body.current_salary : req.body.currentSalary;
    const expected_salary = req.body.expected_salary !== undefined ? req.body.expected_salary : req.body.expectedSalary;
    const notice_period = req.body.notice_period !== undefined ? req.body.notice_period : req.body.noticePeriod;
    const management_experience = req.body.management_experience !== undefined ? req.body.management_experience : req.body.managementExperience;
    const team_size = req.body.team_size !== undefined ? req.body.team_size : req.body.teamSize;
    const consultant_evaluation = req.body.consultant_evaluation !== undefined ? req.body.consultant_evaluation : req.body.consultantEvaluation;
    // Phase 3 動機與交易條件
    const job_search_status = req.body.job_search_status !== undefined ? req.body.job_search_status : req.body.jobSearchStatus;
    const reason_for_change = req.body.reason_for_change !== undefined ? req.body.reason_for_change : req.body.reasonForChange;
    const motivation = req.body.motivation;
    const deal_breakers = req.body.deal_breakers !== undefined ? req.body.deal_breakers : req.body.dealBreakers;
    const competing_offers = req.body.competing_offers !== undefined ? req.body.competing_offers : req.body.competingOffers;
    const relationship_level = req.body.relationship_level !== undefined ? req.body.relationship_level : req.body.relationshipLevel;
    // 語音評估 + 自傳 + 作品集
    const voice_assessments = req.body.voice_assessments !== undefined ? req.body.voice_assessments : req.body.voiceAssessments;
    const biography = req.body.biography;
    const portfolio_url = req.body.portfolio_url !== undefined ? req.body.portfolio_url : req.body.portfolioUrl;
    // AI 總結結果
    const ai_summary = req.body.ai_summary !== undefined ? req.body.ai_summary : req.body.aiSummary;
    // OpenClaw AI 評分欄位
    const ai_score = req.body.ai_score !== undefined ? req.body.ai_score : req.body.aiScore;
    const ai_grade = req.body.ai_grade !== undefined ? req.body.ai_grade : req.body.aiGrade;
    const ai_report = req.body.ai_report !== undefined ? req.body.ai_report : req.body.aiReport;
    const ai_recommendation = req.body.ai_recommendation !== undefined ? req.body.ai_recommendation : req.body.aiRecommendation;
    // Sprint 1: Structured fields (Layer 1 Match Core)
    const current_title = req.body.current_title !== undefined ? req.body.current_title : req.body.currentTitle;
    const current_company = req.body.current_company !== undefined ? req.body.current_company : req.body.currentCompany;
    const role_family = req.body.role_family !== undefined ? req.body.role_family : req.body.roleFamily;
    const canonical_role = req.body.canonical_role !== undefined ? req.body.canonical_role : req.body.canonicalRole;
    const seniority_level = req.body.seniority_level !== undefined ? req.body.seniority_level : req.body.seniorityLevel;
    const total_years = req.body.total_years !== undefined ? req.body.total_years : req.body.totalYears;
    const industry_tag = req.body.industry_tag !== undefined ? req.body.industry_tag : req.body.industryTag;
    const normalized_skills = req.body.normalized_skills !== undefined ? req.body.normalized_skills : req.body.normalizedSkills;
    const skill_evidence = req.body.skill_evidence !== undefined ? req.body.skill_evidence : req.body.skillEvidence;
    const education_level = req.body.education_level !== undefined ? req.body.education_level : req.body.educationLevel;
    const current_salary_min = req.body.current_salary_min !== undefined ? req.body.current_salary_min : req.body.currentSalaryMin;
    const current_salary_max = req.body.current_salary_max !== undefined ? req.body.current_salary_max : req.body.currentSalaryMax;
    const expected_salary_min = req.body.expected_salary_min !== undefined ? req.body.expected_salary_min : req.body.expectedSalaryMin;
    const expected_salary_max = req.body.expected_salary_max !== undefined ? req.body.expected_salary_max : req.body.expectedSalaryMax;
    const salary_currency = req.body.salary_currency !== undefined ? req.body.salary_currency : req.body.salaryCurrency;
    const salary_period = req.body.salary_period !== undefined ? req.body.salary_period : req.body.salaryPeriod;
    const notice_period_enum = req.body.notice_period_enum !== undefined ? req.body.notice_period_enum : req.body.noticePeriodEnum;
    const job_search_status_enum = req.body.job_search_status_enum !== undefined ? req.body.job_search_status_enum : req.body.jobSearchStatusEnum;
    // Talent Board classification
    const grade_level = req.body.grade_level !== undefined ? req.body.grade_level : req.body.gradeLevel;
    const source_tier = req.body.source_tier !== undefined ? req.body.source_tier : req.body.sourceTier;
    const heat_level = req.body.heat_level !== undefined ? req.body.heat_level : req.body.heatLevel;

    const actor = req.body.actor || req.body.by || '';
    const isAIBot = /aibot|bot$|openclaw|yuqi|ai$/i.test(actor);

    const client = await pool.connect();
    try {

    // 預先抓取現有資料（用於 status 自動附加 + recruiter 轉派通知）
    let existingProgressForStatus = null;
    let oldRecruiter = null;
    if (status !== undefined || recruiter !== undefined) {
      const pData = await client.query(
        'SELECT progress_tracking, recruiter, name FROM candidates_pipeline WHERE id = $1', [id]
      );
      if (pData.rows[0]) {
        if (status !== undefined && progressTracking === undefined) {
          existingProgressForStatus = pData.rows[0].progress_tracking || [];
        }
        oldRecruiter = pData.rows[0].recruiter || '';
      }
    }

    const setClauses = [];
    const values = [];
    let idx = 1;

    if (status !== undefined) {
      setClauses.push(`status = $${idx++}`);
      values.push(status);
    }
    if (progressTracking !== undefined) {
      setClauses.push(`progress_tracking = $${idx++}`);
      values.push(JSON.stringify(normalizeProgressTracking(progressTracking)));
    }
    if (recruiter !== undefined) {
      setClauses.push(`recruiter = $${idx++}`);
      values.push(recruiter);
    }
    if (notes !== undefined) {
      setClauses.push(`notes = $${idx++}`);
      values.push(notes);
    }
    if (talent_level !== undefined) {
      setClauses.push(`talent_level = $${idx++}`);
      values.push(talent_level);
    }
    if (name !== undefined) {
      setClauses.push(`name = $${idx++}`);
      values.push(name);
    }
    if (stability_score !== undefined) {
      setClauses.push(`stability_score = $${idx++}`);
      values.push(String(stability_score));
    }
    if (linkedin_url !== undefined) {
      setClauses.push(`linkedin_url = $${idx++}`);
      values.push(linkedin_url);
    }
    if (github_url !== undefined) {
      setClauses.push(`github_url = $${idx++}`);
      values.push(github_url);
    }
    if (email !== undefined) {
      setClauses.push(`email = $${idx++}`);
      values.push(email);
    }
    if (phone !== undefined) {
      setClauses.push(`phone = $${idx++}`);
      values.push(phone);
    }
    if (location !== undefined) {
      setClauses.push(`location = $${idx++}`);
      values.push(location);
    }
    if (position !== undefined) {
      setClauses.push(`current_position = $${idx++}`);
      values.push(position);
    }
    if (years !== undefined) {
      setClauses.push(`years_experience = $${idx++}`);
      values.push(String(years));
    }
    if (skills !== undefined) {
      setClauses.push(`skills = $${idx++}`);
      values.push(Array.isArray(skills) ? skills.join('、') : skills);
    }
    if (education !== undefined) {
      setClauses.push(`education = $${idx++}`);
      values.push(education);
    }
    if (work_history !== undefined) {
      setClauses.push(`work_history = $${idx++}`);
      values.push(JSON.stringify(work_history));
    }
    if (education_details !== undefined) {
      setClauses.push(`education_details = $${idx++}`);
      values.push(JSON.stringify(education_details));
    }
    if (target_job_id !== undefined) {
      setClauses.push(`target_job_id = $${idx++}`);
      values.push(target_job_id === null ? null : Number(target_job_id));
    }
    if (interview_round !== undefined) {
      setClauses.push(`interview_round = $${idx++}`);
      values.push(interview_round === null ? null : Number(interview_round));
    }
    // Phase 1 新增欄位
    if (birthday !== undefined) {
      setClauses.push(`birthday = $${idx++}`);
      values.push(birthday || null);
    }
    if (age !== undefined) {
      setClauses.push(`age = $${idx++}`);
      values.push(age === null ? null : Number(age));
    }
    if (age_estimated !== undefined) {
      setClauses.push(`age_estimated = $${idx++}`);
      values.push(!!age_estimated);
    }
    if (gender !== undefined) {
      setClauses.push(`gender = $${idx++}`);
      values.push(gender);
    }
    if (english_name !== undefined) {
      setClauses.push(`english_name = $${idx++}`);
      values.push(english_name);
    }
    if (consultant_note !== undefined) {
      setClauses.push(`consultant_note = $${idx++}`);
      values.push(consultant_note);
    }
    if (industry !== undefined) {
      setClauses.push(`industry = $${idx++}`);
      values.push(industry);
    }
    if (languages !== undefined) {
      setClauses.push(`languages = $${idx++}`);
      values.push(languages);
    }
    if (certifications !== undefined) {
      setClauses.push(`certifications = $${idx++}`);
      values.push(certifications);
    }
    if (current_salary !== undefined) {
      setClauses.push(`current_salary = $${idx++}`);
      values.push(current_salary);
    }
    if (expected_salary !== undefined) {
      setClauses.push(`expected_salary = $${idx++}`);
      values.push(expected_salary);
    }
    if (notice_period !== undefined) {
      setClauses.push(`notice_period = $${idx++}`);
      values.push(notice_period);
    }
    if (management_experience !== undefined) {
      setClauses.push(`management_experience = $${idx++}`);
      values.push(management_experience);
    }
    if (team_size !== undefined) {
      setClauses.push(`team_size = $${idx++}`);
      values.push(team_size);
    }
    if (consultant_evaluation !== undefined) {
      setClauses.push(`consultant_evaluation = $${idx++}`);
      values.push(JSON.stringify(consultant_evaluation));
    }
    // Phase 3 動機與交易條件
    if (job_search_status !== undefined) { setClauses.push(`job_search_status = $${idx++}`); values.push(job_search_status); }
    if (reason_for_change !== undefined) { setClauses.push(`reason_for_change = $${idx++}`); values.push(reason_for_change); }
    if (motivation !== undefined) { setClauses.push(`motivation = $${idx++}`); values.push(motivation); }
    if (deal_breakers !== undefined) { setClauses.push(`deal_breakers = $${idx++}`); values.push(deal_breakers); }
    if (competing_offers !== undefined) { setClauses.push(`competing_offers = $${idx++}`); values.push(competing_offers); }
    if (relationship_level !== undefined) { setClauses.push(`relationship_level = $${idx++}`); values.push(relationship_level); }
    // 語音評估 + 自傳 + 作品集
    if (voice_assessments !== undefined) { setClauses.push(`voice_assessments = $${idx++}`); values.push(JSON.stringify(voice_assessments)); }
    if (biography !== undefined) { setClauses.push(`biography = $${idx++}`); values.push(biography); }
    if (portfolio_url !== undefined) { setClauses.push(`portfolio_url = $${idx++}`); values.push(portfolio_url); }
    // AI 總結結果
    if (ai_summary !== undefined) { setClauses.push(`ai_summary = $${idx++}`); values.push(JSON.stringify(ai_summary)); }
    // OpenClaw AI 評分欄位
    if (ai_score !== undefined) { setClauses.push(`ai_score = $${idx++}`); values.push(ai_score === null ? null : Number(ai_score)); }
    if (ai_grade !== undefined) { setClauses.push(`ai_grade = $${idx++}`); values.push(ai_grade); }
    if (ai_report !== undefined) { setClauses.push(`ai_report = $${idx++}`); values.push(ai_report); }
    if (ai_recommendation !== undefined) { setClauses.push(`ai_recommendation = $${idx++}`); values.push(ai_recommendation); }
    // Sprint 1: Structured fields
    if (current_title !== undefined) { setClauses.push(`current_title = $${idx++}`); values.push(current_title); }
    if (current_company !== undefined) { setClauses.push(`current_company = $${idx++}`); values.push(current_company); }
    if (role_family !== undefined) { setClauses.push(`role_family = $${idx++}`); values.push(role_family); }
    if (canonical_role !== undefined) { setClauses.push(`canonical_role = $${idx++}`); values.push(canonical_role); }
    if (seniority_level !== undefined) { setClauses.push(`seniority_level = $${idx++}`); values.push(seniority_level); }
    if (total_years !== undefined) { setClauses.push(`total_years = $${idx++}`); values.push(total_years === null ? null : Number(total_years)); }
    if (industry_tag !== undefined) { setClauses.push(`industry_tag = $${idx++}`); values.push(industry_tag); }
    if (normalized_skills !== undefined) { setClauses.push(`normalized_skills = $${idx++}`); values.push(JSON.stringify(normalized_skills)); }
    if (skill_evidence !== undefined) { setClauses.push(`skill_evidence = $${idx++}`); values.push(JSON.stringify(skill_evidence)); }
    if (education_level !== undefined) { setClauses.push(`education_level = $${idx++}`); values.push(education_level); }
    if (current_salary_min !== undefined) { setClauses.push(`current_salary_min = $${idx++}`); values.push(current_salary_min === null ? null : Number(current_salary_min)); }
    if (current_salary_max !== undefined) { setClauses.push(`current_salary_max = $${idx++}`); values.push(current_salary_max === null ? null : Number(current_salary_max)); }
    if (expected_salary_min !== undefined) { setClauses.push(`expected_salary_min = $${idx++}`); values.push(expected_salary_min === null ? null : Number(expected_salary_min)); }
    if (expected_salary_max !== undefined) { setClauses.push(`expected_salary_max = $${idx++}`); values.push(expected_salary_max === null ? null : Number(expected_salary_max)); }
    if (salary_currency !== undefined) { setClauses.push(`salary_currency = $${idx++}`); values.push(salary_currency); }
    if (salary_period !== undefined) { setClauses.push(`salary_period = $${idx++}`); values.push(salary_period); }
    if (notice_period_enum !== undefined) { setClauses.push(`notice_period_enum = $${idx++}`); values.push(notice_period_enum); }
    if (job_search_status_enum !== undefined) { setClauses.push(`job_search_status_enum = $${idx++}`); values.push(job_search_status_enum); }
    if (grade_level !== undefined) { setClauses.push(`grade_level = $${idx++}`); values.push(grade_level); }
    if (source_tier !== undefined) { setClauses.push(`source_tier = $${idx++}`); values.push(source_tier); }
    if (heat_level !== undefined) { setClauses.push(`heat_level = $${idx++}`); values.push(heat_level); }

    // Auto-normalization: when skills/salary/work_history change, auto-derive structured fields
    if (skills !== undefined && normalized_skills === undefined) {
      const { normalizeSkillsArray } = require('./taxonomy/matchSkills');
      const autoNormalized = normalizeSkillsArray(skills);
      if (autoNormalized.length > 0) {
        setClauses.push(`normalized_skills = $${idx++}`);
        values.push(JSON.stringify(autoNormalized));
      }
    }
    if (current_salary !== undefined && current_salary_min === undefined) {
      const { parseSalaryText } = require('./taxonomy/matchSkills');
      const parsed = parseSalaryText(current_salary);
      if (parsed.min != null) {
        setClauses.push(`current_salary_min = $${idx++}`); values.push(parsed.min);
        setClauses.push(`current_salary_max = $${idx++}`); values.push(parsed.max || parsed.min);
      }
    }
    if (expected_salary !== undefined && expected_salary_min === undefined) {
      const { parseSalaryText } = require('./taxonomy/matchSkills');
      const parsed = parseSalaryText(expected_salary);
      if (parsed.min != null) {
        setClauses.push(`expected_salary_min = $${idx++}`); values.push(parsed.min);
        setClauses.push(`expected_salary_max = $${idx++}`); values.push(parsed.max || parsed.min);
      }
    }
    if (notice_period !== undefined && notice_period_enum === undefined) {
      const { parseNoticePeriod } = require('./taxonomy/matchSkills');
      const parsed = parseNoticePeriod(notice_period);
      if (parsed) { setClauses.push(`notice_period_enum = $${idx++}`); values.push(parsed); }
    }
    if (job_search_status !== undefined && job_search_status_enum === undefined) {
      const { parseJobSearchStatus } = require('./taxonomy/matchSkills');
      const parsed = parseJobSearchStatus(job_search_status);
      if (parsed) { setClauses.push(`job_search_status_enum = $${idx++}`); values.push(parsed); }
    }
    if (work_history !== undefined) {
      const { computeAutoDerived } = require('./taxonomy/matchSkills');
      const wh = Array.isArray(work_history) ? work_history : [];
      if (wh.length > 0) {
        const derived = computeAutoDerived(wh);
        setClauses.push(`auto_derived = $${idx++}`);
        values.push(JSON.stringify(derived));
      }
    }
    if (position !== undefined && current_title === undefined) {
      setClauses.push(`current_title = $${idx++}`);
      values.push(position);
    }
    if (years !== undefined && total_years === undefined) {
      setClauses.push(`total_years = $${idx++}`);
      values.push(Number(years) || 0);
    }

    // ── Auto-recalculate data_quality + precision_eligible on every save ──
    try {
      const precisionRow = await client.query(
        `SELECT canonical_role, role_family, normalized_skills, total_years, years_experience,
                location, current_company, industry_tag, industry, expected_salary_min,
                expected_salary_max, notice_period_enum, notice_period,
                job_search_status_enum, job_search_status, skills
         FROM candidates_pipeline WHERE id = $1`, [id]
      );
      if (precisionRow.rows.length > 0) {
        const merged = { ...precisionRow.rows[0] };
        // Apply incoming updates on top of current DB values
        if (canonical_role !== undefined) merged.canonical_role = canonical_role;
        if (role_family !== undefined) merged.role_family = role_family;
        if (normalized_skills !== undefined) merged.normalized_skills = normalized_skills;
        if (total_years !== undefined) merged.total_years = total_years;
        else if (years !== undefined) merged.total_years = Number(years) || 0;
        if (location !== undefined) merged.location = location;
        if (current_company !== undefined) merged.current_company = current_company;
        if (industry_tag !== undefined) merged.industry_tag = industry_tag;
        else if (industry !== undefined) merged.industry_tag = industry;
        if (expected_salary_min !== undefined) merged.expected_salary_min = expected_salary_min;
        if (expected_salary_max !== undefined) merged.expected_salary_max = expected_salary_max;
        if (notice_period_enum !== undefined) merged.notice_period_enum = notice_period_enum;
        if (job_search_status_enum !== undefined) merged.job_search_status_enum = job_search_status_enum;
        // If skills changed but normalized_skills not explicitly set, auto-normalize
        if (skills !== undefined && normalized_skills === undefined) {
          const { normalizeSkillsArray } = require('./taxonomy/matchSkills');
          merged.normalized_skills = normalizeSkillsArray(skills);
        }

        const { computePrecisionEligible } = require('./taxonomy/matchSkills');
        const precision = computePrecisionEligible(merged);

        setClauses.push(`data_quality = $${idx++}`);
        values.push(JSON.stringify({
          completenessScore: precision.dataQualityScore,
          missingCoreFields: precision.missingCoreFields,
          normalizationWarnings: [],
        }));
        setClauses.push(`precision_eligible = $${idx++}`);
        values.push(precision.precisionEligible);
      }
    } catch (precErr) {
      console.warn('Precision recalc error:', precErr.message);
    }

    // 優先使用顯式傳入的 ai_match_result；若未傳但 AIBot 寫了評分備註，自動解析
    let resolvedAiMatch = ai_match_result;

    // 若 ai_match_result 是字串（AI 寫成純文字），自動轉為結構化 JSON
    if (typeof resolvedAiMatch === 'string' && resolvedAiMatch.trim()) {
      const text = resolvedAiMatch.trim();
      const scoreMatch = text.match(/AI評分\s*(\d+)\s*分/);
      const levelMatch = text.match(/(\d+)\s*分\s*[\/／]\s*([SA+ABCS]+)/);
      const jobMatch = text.match(/配對職位[：:]\s*(.+?)(?:（|$)/);
      const score = scoreMatch ? parseInt(scoreMatch[1]) : (stability_score || 0);
      const level = levelMatch ? levelMatch[2] : (talent_level || '');
      const recommendation = score >= 85 ? '強力推薦' : score >= 70 ? '推薦' : score >= 55 ? '觀望' : '不推薦';

      // 提取優勢列表
      const strengthsMatch = text.match(/優勢[：:]?\s*\n([\s\S]+?)(?=⚠️|待確認|💡|$)/);
      const strengths = strengthsMatch
        ? strengthsMatch[1].split('\n').map(l => l.replace(/^[-•*]\s*/, '').trim()).filter(Boolean)
        : [];

      // 提取待確認列表
      const pendingMatch = text.match(/待確認[：:]?\s*\n([\s\S]+?)(?=💡|顧問建議|$)/);
      const pending = pendingMatch
        ? pendingMatch[1].split('\n').map(l => l.replace(/^[-•*]\s*/, '').trim()).filter(Boolean)
        : [];

      // 提取顧問建議
      const conclusionMatch = text.match(/顧問建議[：:]\s*([\s\S]+?)(?:\n---|\s*$)/);
      const conclusion = conclusionMatch ? conclusionMatch[1].trim() : text;

      resolvedAiMatch = {
        score,
        recommendation,
        job_title: jobMatch ? jobMatch[1].trim() : undefined,
        matched_skills: [],
        missing_skills: pending.slice(0, 3),
        strengths,
        probing_questions: pending,
        conclusion,
        evaluated_at: new Date().toISOString(),
        evaluated_by: actor || 'AIbot',
      };
    }

    if (resolvedAiMatch === undefined && isAIBot && notes) {
      const parsed = parseNotesToAiMatchResult(notes, actor);
      if (parsed) {
        resolvedAiMatch = parsed;
        // 若備註裡有 LinkedIn URL 且 linkedin_url 未被顯式設定，一起更新
        if (parsed._linkedin_url && linkedin_url === undefined) {
          setClauses.push(`linkedin_url = $${idx++}`);
          values.push(parsed._linkedin_url);
        }
        delete parsed._linkedin_url;
      }
    }
    if (resolvedAiMatch !== undefined) {
      setClauses.push(`ai_match_result = $${idx++}`);
      values.push(JSON.stringify(resolvedAiMatch));
    }

    // 自動附加 progressTracking 條目（任何 status 更新都觸發，讓卡片欄位正確移動）
    if (existingProgressForStatus !== null) {
      const today = new Date().toISOString().split('T')[0];
      const autoEntry = {
        date: today,
        event: status,
        by: actor || 'system',
        ...(resolvedAiMatch?.score != null ? { note: `AI評分 ${resolvedAiMatch.score}分` } : {}),
      };
      setClauses.push(`progress_tracking = $${idx++}`);
      values.push(JSON.stringify([...existingProgressForStatus, autoEntry]));
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    setClauses.push(`updated_at = NOW()`);
    values.push(id);

    const result = await client.query(
      `UPDATE candidates_pipeline SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Candidate not found' });
    }

    // 寫入操作日誌
    const candidateName = result.rows[0].name;
    writeLog({
      action: 'UPDATE',
      actor: req.body.actor || req.body.recruiter || 'system',
      candidateId: parseInt(id),
      candidateName,
      detail: { fields: Object.keys(req.body).filter(k => k !== 'actor') }
    });

    // 人選轉派通知：recruiter 改變時通知新顧問
    if (recruiter !== undefined && recruiter !== oldRecruiter && recruiter !== '待指派') {
      const uidMap = { 'Phoebe': 'phoebe', 'Jacky': 'jacky', 'Jim': 'jim', 'Admin': 'admin' };
      const recipientUid = uidMap[recruiter] || recruiter.toLowerCase();
      writeNotification({
        recipient: recipientUid,
        type: 'candidate_assign',
        title: `📋 新人選指派：${candidateName || '未知'}`,
        message: `${actor || oldRecruiter || '系統'} 將人選「${candidateName}」指派給你`,
        link: 'candidates',
        data: { candidate_id: parseInt(id), candidate_name: candidateName, from: oldRecruiter },
        actor: actor || 'system'
      });
    }

    // 清除該候選人的職缺匹配快取
    pool.query('DELETE FROM candidate_job_rankings_cache WHERE candidate_id = $1', [id]).catch(() => {});

    res.json({ success: true, data: result.rows[0], message: 'Candidate patched successfully' });
    } finally {
      client.release();
    }
  } catch (error) {
    // LinkedIn URL 重複衝突 → 409 + 告知衝突的人選
    if (error.code === '23505' && error.constraint && error.constraint.includes('linkedin')) {
      try {
        const linkedin_url = req.body.linkedin_url || req.body.linkedinUrl || '';
        const dup = await pool.query(
          `SELECT id, name FROM candidates_pipeline WHERE LOWER(TRIM(linkedin_url)) = LOWER(TRIM($1)) AND id != $2 LIMIT 1`,
          [linkedin_url, req.params.id]
        );
        const dupInfo = dup.rows[0] ? ` 與 #${dup.rows[0].id} ${dup.rows[0].name} 重複` : '';
        return res.status(409).json({
          success: false,
          error: `LinkedIn URL 已被其他人選使用${dupInfo}`,
          conflictWith: dup.rows[0] || null
        });
      } catch (_) { /* fall through */ }
    }
    safeError(res, error, 'PATCH /candidates/:id');
  }
});

/**
 * PUT /api/candidates/:id/pipeline-status
 * 專用端點：更新候選人 Pipeline 階段狀態
 * 給 AIbot 及外部系統使用
 *
 * Body: {
 *   status: '未開始' | '聯繫階段' | '面試階段' | 'Offer' | 'on board' | '婉拒' | '其他',
 *   by: '操作者名稱（顧問名或 AIbot）'
 * }
 */
router.put('/candidates/:id/pipeline-status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, by } = req.body;

    const validStatuses = ['未開始', 'AI推薦', '聯繫階段', '面試階段', 'Offer', 'on board', '婉拒', '備選人才', '其他', '爬蟲初篩'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const client = await pool.connect();
    let result, candidate;
    try {

    // 取得目前候選人資料
    const current = await client.query(
      'SELECT * FROM candidates_pipeline WHERE id = $1',
      [id]
    );

    if (current.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Candidate not found' });
    }

    candidate = current.rows[0];
    const currentProgress = candidate.progress_tracking || [];

    // 新增進度事件
    const newEvent = {
      date: new Date().toISOString().split('T')[0],
      event: status,
      by: by || 'AIbot'
    };
    const updatedProgress = [...currentProgress, newEvent];

    result = await client.query(
      `UPDATE candidates_pipeline
       SET status = $1, progress_tracking = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [status, JSON.stringify(updatedProgress), id]
    );
    } finally {
      client.release();
    }

    // 寫入操作日誌
    writeLog({
      action: 'PIPELINE_CHANGE',
      actor: by || 'AIbot',
      candidateId: parseInt(id),
      candidateName: candidate.name,
      detail: { from: candidate.status, to: status }
    });

    res.json({
      success: true,
      data: result.rows[0],
      message: `Pipeline 狀態已更新為「${status}」`
    });
  } catch (error) {
    safeError(res, error, 'PUT /candidates/:id/pipeline-status');
  }
});

/**
 * PATCH /api/candidates/batch-status
 * 批量更新多位候選人的 Pipeline 狀態（AIbot 批量操作專用）
 *
 * Body：
 * {
 *   "ids": [123, 124, 125],          // 候選人 ID 陣列
 *   "status": "面試階段",               // 目標狀態
 *   "actor": "Jacky-aibot",           // 操作者（可選，預設 AIbot）
 *   "note": "批量完成初篩面試"         // 備註（可選，附加到進度記錄）
 * }
 */
router.patch('/candidates/batch-status', async (req, res) => {
  try {
    const { ids, status, actor, note } = req.body;

    const validStatuses = ['未開始', 'AI推薦', '聯繫階段', '面試階段', 'Offer', 'on board', '婉拒', '備選人才', '其他', '爬蟲初篩'];

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: '缺少 ids 陣列' });
    }
    if (ids.length > 200) {
      return res.status(400).json({ success: false, error: '單次最多 200 筆' });
    }
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `無效狀態，必須為：${validStatuses.join('、')}`
      });
    }

    const operator = actor || 'AIbot';
    const today = new Date().toISOString().split('T')[0];
    const succeeded = [];
    const failed = [];

    // ── P1 修復：單一 client + Transaction（原本每個 ID 開一個 client） ──
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 一次查出所有需要更新的候選人
      const current = await client.query(
        'SELECT id, name, status, progress_tracking FROM candidates_pipeline WHERE id = ANY($1::int[])',
        [ids]
      );
      const candidateMap = new Map();
      for (const row of current.rows) candidateMap.set(row.id, row);

      for (const id of ids) {
        const candidate = candidateMap.get(parseInt(id)) || candidateMap.get(id);
        if (!candidate) {
          failed.push({ id, reason: '找不到此候選人' });
          continue;
        }

        try {
          const currentProgress = candidate.progress_tracking || [];
          const newEvent = {
            date: today,
            event: status,
            by: operator,
            ...(note ? { note } : {})
          };
          const updatedProgress = [...currentProgress, newEvent];

          await client.query(
            `UPDATE candidates_pipeline
             SET status = $1, progress_tracking = $2, updated_at = NOW()
             WHERE id = $3`,
            [status, JSON.stringify(updatedProgress), candidate.id]
          );

          writeLog({
            action: 'PIPELINE_CHANGE',
            actor: operator,
            candidateId: parseInt(candidate.id),
            candidateName: candidate.name,
            detail: { from: candidate.status, to: status, batch: true }
          });

          succeeded.push({ id: candidate.id, name: candidate.name });
        } catch (err) {
          failed.push({ id, reason: err.message });
        }
      }

      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK').catch(() => {});
      throw txErr;
    } finally {
      client.release();
    }

    res.json({
      success: true,
      status,
      succeeded_count: succeeded.length,
      failed_count: failed.length,
      total: ids.length,
      succeeded,
      failed,
      message: `批量更新完成：${succeeded.length} 位成功，${failed.length} 位失敗`
    });
  } catch (error) {
    safeError(res, error, 'PATCH /candidates/batch-status');
  }
});

/**
 * DELETE /api/candidates/batch
 * 批量刪除多位候選人（AIbot 批量操作專用）
 *
 * Body：
 * {
 *   "ids": [123, 124, 125],   // 候選人 ID 陣列（最多 200 筆）
 *   "actor": "Jacky-aibot"    // 操作者（必填，用於日誌）
 * }
 *
 * ⚠️ 此操作不可逆，請確認後再執行
 */
router.delete('/candidates/batch', async (req, res) => {
  try {
    const { ids, actor } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'ids 必須為非空陣列' });
    }
    if (ids.length > 200) {
      return res.status(400).json({ success: false, error: '單次最多刪除 200 筆' });
    }
    if (!actor) {
      return res.status(400).json({ success: false, error: 'actor 必填' });
    }

    // ── P1 修復：單一 DELETE + Transaction（原本逐筆 DELETE） ──
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 一次刪除所有 ID，RETURNING 取回被刪的資料
      const result = await client.query(
        'DELETE FROM candidates_pipeline WHERE id = ANY($1::int[]) RETURNING id, name',
        [ids]
      );

      await client.query('COMMIT');

      const deletedMap = new Map();
      const succeeded = [];
      for (const row of result.rows) {
        deletedMap.set(row.id, row.name);
        succeeded.push({ id: row.id, name: row.name });
        writeLog({
          action: 'DELETE',
          actor,
          candidateId: parseInt(row.id),
          candidateName: row.name,
          detail: { batch: true }
        });
      }

      // 找出不存在的 ID
      const failed = ids
        .filter(id => !deletedMap.has(parseInt(id)) && !deletedMap.has(id))
        .map(id => ({ id, reason: '找不到此候選人' }));

      res.json({
        success: true,
        deleted_count: succeeded.length,
        failed_count: failed.length,
        deleted: succeeded,
        failed,
        message: `批量刪除完成：${succeeded.length} 位成功，${failed.length} 位失敗`
      });
    } catch (txErr) {
      await client.query('ROLLBACK').catch(() => {});
      throw txErr;
    } finally {
      client.release();
    }
  } catch (error) {
    safeError(res, error, 'DELETE /candidates/batch');
  }
});

/**
 * DELETE /api/candidates/:id
 * 刪除單一候選人
 *
 * Body：{ "actor": "Jacky-aibot" }  // 操作者（建議填入，用於日誌）
 *
 * ⚠️ 此操作不可逆
 */
router.delete('/candidates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!/^\d+$/.test(id)) {
      return res.status(404).json({ success: false, error: 'Candidate not found' });
    }
    const { actor } = req.body || {};

    const client = await pool.connect();
    let result;
    try {
      result = await client.query(
        'DELETE FROM candidates_pipeline WHERE id = $1 RETURNING id, name',
        [id]
      );
    } finally {
      client.release();
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: `找不到候選人 ID ${id}` });
    }

    writeLog({
      action: 'DELETE',
      actor: actor || 'system',
      candidateId: parseInt(id),
      candidateName: result.rows[0].name,
      detail: { batch: false }
    });

    res.json({
      success: true,
      deleted: { id: result.rows[0].id, name: result.rows[0].name },
      message: `候選人「${result.rows[0].name}」已刪除`
    });
  } catch (error) {
    safeError(res, error, 'DELETE /candidates/:id');
  }
});

/**
 * POST /api/candidates
 * 智慧匯入單一候選人（單一入口 → SQL → Sheets）
 * - 已存在：只補充空欄位
 * - 不存在：建立新紀錄
 */
router.post('/candidates', async (req, res) => {
  try {
    const c = req.body;

    if (!c.name) {
      return res.status(400).json({
        success: false,
        error: 'Name is required'
      });
    }

    const client = await pool.connect();
    let result;
    let action;
    let matchMethod = null;
    try {
    const nameKey = c.name.trim().toLowerCase();

    // 3 層去重：LinkedIn URL > Email > Name（與 bulk import 一致）
    let existing = { rows: [] };

    // 第 1 層：LinkedIn URL（最高優先）
    if (c.linkedin_url && c.linkedin_url.trim()) {
      const normalizedLi = c.linkedin_url.trim().toLowerCase()
        .replace('://www.', '://').replace(/\/+$/, '');
      if (normalizedLi.includes('linkedin.com')) {
        existing = await client.query(
          `SELECT id FROM candidates_pipeline
           WHERE LOWER(TRIM(REPLACE(REGEXP_REPLACE(linkedin_url, '/+$', ''), '://www.', '://')))
                 = $1 AND linkedin_url IS NOT NULL AND linkedin_url <> ''
           LIMIT 1`,
          [normalizedLi]
        );
        if (existing.rows.length > 0) matchMethod = 'linkedin_url';
      }
    }

    // 第 2 層：Email
    if (existing.rows.length === 0 && c.email && c.email.trim() && c.email.includes('@')) {
      const normalizedEmail = c.email.trim().toLowerCase();
      existing = await client.query(
        `SELECT id FROM candidates_pipeline
         WHERE LOWER(TRIM(email)) = $1 AND email IS NOT NULL AND email != ''
         LIMIT 1`,
        [normalizedEmail]
      );
      if (existing.rows.length > 0) matchMethod = 'email';
    }

    // 第 3 層：Name（原有邏輯）
    if (existing.rows.length === 0) {
      existing = await client.query(
        'SELECT id FROM candidates_pipeline WHERE LOWER(TRIM(name)) = $1 LIMIT 1',
        [nameKey]
      );
      if (existing.rows.length > 0) matchMethod = 'name';
    }

    if (existing.rows.length > 0) {
      // 既有人選 → 只補充空欄位
      action = 'updated';
      result = await client.query(
        `UPDATE candidates_pipeline SET
          phone = COALESCE(NULLIF(phone, ''), $1),
          contact_link = COALESCE(NULLIF(contact_link, ''), $2),
          location = COALESCE(NULLIF(location, ''), $3),
          current_position = COALESCE(NULLIF(current_position, ''), $4),
          years_experience = COALESCE(NULLIF(years_experience, ''), NULLIF(years_experience, '0'), $5),
          skills = COALESCE(NULLIF(skills, ''), $6),
          education = COALESCE(NULLIF(education, ''), $7),
          source = COALESCE(NULLIF(source, ''), $8),
          notes = CASE WHEN $9 = '' THEN notes ELSE CONCAT(notes, CASE WHEN notes != '' THEN E'\n' ELSE '' END, $9) END,
          stability_score = COALESCE(NULLIF(stability_score, ''), NULLIF(stability_score, '0'), $10),
          personality_type = COALESCE(NULLIF(personality_type, ''), $11),
          job_changes = COALESCE(NULLIF(job_changes, ''), NULLIF(job_changes, '0'), $12),
          avg_tenure_months = COALESCE(NULLIF(avg_tenure_months, ''), NULLIF(avg_tenure_months, '0'), $13),
          recent_gap_months = COALESCE(NULLIF(recent_gap_months, ''), NULLIF(recent_gap_months, '0'), $14),
          work_history = COALESCE(work_history, $15),
          education_details = COALESCE(education_details, $16),
          leaving_reason = COALESCE(NULLIF(leaving_reason, ''), $17),
          talent_level = COALESCE(NULLIF(talent_level, ''), $18),
          email = COALESCE(NULLIF(email, ''), $19),
          linkedin_url = COALESCE(NULLIF(linkedin_url, ''), $20),
          github_url = COALESCE(NULLIF(github_url, ''), $21),
          ai_match_result = CASE WHEN $22::jsonb IS NOT NULL THEN $22::jsonb ELSE ai_match_result END,
          current_salary = COALESCE(NULLIF(current_salary, ''), $23),
          expected_salary = COALESCE(NULLIF(expected_salary, ''), $24),
          updated_at = NOW()
        WHERE id = $25
        RETURNING id, name, contact_link, current_position, status`,
        [
          c.phone || '', c.contact_link || '', (c.location || '').slice(0, 255),
          (c.current_position || '').slice(0, 255), String(c.years_experience || ''),
          c.skills || '', (c.education || '').slice(0, 255), (c.source || '').slice(0, 255),
          c.notes || '', String(c.stability_score || ''),
          (c.personality_type || '').slice(0, 255), String(c.job_changes || ''),
          String(c.avg_tenure_months || ''), String(c.recent_gap_months || ''),
          c.work_history ? JSON.stringify(c.work_history) : null,
          c.education_details ? JSON.stringify(c.education_details) : null,
          c.leaving_reason || '', c.talent_level || '',
          c.email || '', c.linkedin_url || '', c.github_url || '',
          (c.ai_match_result && typeof c.ai_match_result === 'object') ? JSON.stringify(c.ai_match_result) : null,
          (c.current_salary || '').slice(0, 100),
          (c.expected_salary || '').slice(0, 100),
          existing.rows[0].id
        ]
      );
    } else {
      // 新人選 → 建立
      action = 'created';
      result = await client.query(
        `INSERT INTO candidates_pipeline
         (name, phone, email, linkedin_url, github_url, contact_link,
          location, current_position, years_experience,
          skills, education, source, status, recruiter, notes,
          stability_score, personality_type, job_changes, avg_tenure_months,
          recent_gap_months, work_history, education_details, leaving_reason,
          talent_level, ai_match_result, target_job_id, current_salary, expected_salary,
          created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,NOW(),NOW())
         RETURNING id, name, contact_link, current_position, status`,
        [
          c.name.trim(), c.phone || '', c.email || '',
          c.linkedin_url || '', c.github_url || '', c.contact_link || '',
          (c.location || '').slice(0, 255), (c.current_position || '').slice(0, 255), String(c.years_experience || '0'),
          c.skills || '', (c.education || '').slice(0, 255), (c.source || 'GitHub').slice(0, 255),
          c.status || '未開始', (c.recruiter || '待指派').slice(0, 255), c.notes || '',
          String(c.stability_score || '0'), (c.personality_type || '').slice(0, 255),
          String(c.job_changes || '0'), String(c.avg_tenure_months || '0'),
          String(c.recent_gap_months || '0'),
          c.work_history ? JSON.stringify(c.work_history) : null,
          c.education_details ? JSON.stringify(c.education_details) : null,
          c.leaving_reason || '', c.talent_level || '',
          (c.ai_match_result && typeof c.ai_match_result === 'object') ? JSON.stringify(c.ai_match_result) : null,
          c.target_job_id || null,
          (c.current_salary || '').slice(0, 100),
          (c.expected_salary || '').slice(0, 100)
        ]
      );
    }

    } finally {
      client.release();
    }

    // 非同步觸發 SQL → Sheets 同步
    syncSQLToSheets([result.rows[0]]).catch(err =>
      console.warn('⚠️ Sheets sync failed (non-blocking):', err.message)
    );

    // 寫入操作日誌
    writeLog({
      action: action === 'created' ? 'IMPORT_CREATE' : 'IMPORT_UPDATE',
      actor: c.actor || c.recruiter || 'system',
      candidateId: result.rows[0].id,
      candidateName: c.name,
      detail: { source: c.source, position: c.current_position }
    });

    res.status(action === 'created' ? 201 : 200).json({
      success: true,
      action,
      matchMethod,
      data: result.rows[0],
      message: action === 'created'
        ? `新增候選人：${c.name}`
        : `已存在（透過 ${matchMethod} 比對），已補充 ${c.name} 的空白欄位`
    });
  } catch (error) {
    safeError(res, error, 'POST /candidates');
  }
});

/**
 * POST /api/candidates/bulk
 * 批量智慧匯入候選人（單一入口 → SQL → Sheets）
 * - 已存在的人選：只補充空欄位，不覆蓋既有資料
 * - 新人選：建立新紀錄
 * Body: { candidates: [ { name, contact_link, ... }, ... ] }
 */
// 引入共用匯入函數
const { processBulkImport } = require('./crawlerImportService');
const importQueue = require('./importQueue');

router.post('/candidates/bulk', async (req, res) => {
  try {
    const { candidates, actor } = req.body;  // actor: AIbot 或顧問名稱，例如 "AIbot-Phoebe"

    if (!Array.isArray(candidates) || candidates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'candidates array is required and must not be empty'
      });
    }

    if (candidates.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 100 candidates per request'
      });
    }

    const results = await processBulkImport(pool, candidates, actor || 'system');

    // 非同步觸發 SQL → Sheets 同步（不阻塞回應）
    syncSQLToSheets(results.created.concat(results.updated)).catch(err =>
      console.warn('⚠️ Sheets sync failed (non-blocking):', err.message)
    );

    // 寫入操作日誌（一筆批量 log）
    const bulkActor = actor || 'system';
    writeLog({
      action: 'BULK_IMPORT',
      actor: bulkActor,
      candidateId: null,
      candidateName: null,
      detail: {
        created: results.created.length,
        updated: results.updated.length,
        failed: results.failed.length,
        total: candidates.length
      }
    });

    const total = candidates.length;
    res.status(201).json({
      success: true,
      message: `匯入完成：新增 ${results.created.length} 筆，補充更新 ${results.updated.length} 筆，失敗 ${results.failed.length} 筆（共 ${total} 筆）`,
      created_count: results.created.length,
      updated_count: results.updated.length,
      failed_count: results.failed.length,
      data: { created: results.created, updated: results.updated },
      failed: results.failed
    });
  } catch (error) {
    safeError(res, error, 'POST /candidates/bulk');
  }
});

/**
 * POST /api/candidates/bulk-async
 * 佇列化匯入：立即回 202 + import_id，背景 Worker 非同步處理
 * 適用大批量匯入（>50 筆），避免 HTTP timeout
 */
router.post('/candidates/bulk-async', async (req, res) => {
  try {
    const { candidates, actor } = req.body;

    if (!Array.isArray(candidates) || candidates.length === 0) {
      return res.status(400).json({ success: false, error: 'candidates array is required' });
    }
    if (candidates.length > 500) {
      return res.status(400).json({ success: false, error: 'Maximum 500 candidates per request' });
    }

    const { import_id } = await importQueue.enqueue(candidates, actor || 'system', 'api');

    writeLog({
      action: 'BULK_IMPORT_QUEUED',
      actor: actor || 'system',
      candidateId: null,
      candidateName: null,
      detail: { import_id, total: candidates.length }
    });

    res.status(202).json({
      success: true,
      import_id,
      status: 'pending',
      total: candidates.length,
      message: `已排入佇列（ID: ${import_id}），可透過 GET /api/imports/${import_id} 查詢進度`,
      status_url: `/api/imports/${import_id}`
    });
  } catch (error) {
    safeError(res, error, 'POST /candidates/bulk-async');
  }
});

/**
 * GET /api/imports/:id
 * 查詢匯入佇列狀態
 */
router.get('/imports/:id', async (req, res) => {
  try {
    const importId = parseInt(req.params.id);
    if (isNaN(importId)) {
      return res.status(400).json({ success: false, error: 'Invalid import ID' });
    }

    const status = await importQueue.getStatus(importId);
    if (!status) {
      return res.status(404).json({ success: false, error: 'Import not found' });
    }

    res.json({ success: true, data: status });
  } catch (error) {
    safeError(res, error, 'GET /imports/:id');
  }
});

// ==================== 職缺 API ====================

/**
 * GET /api/jobs
 * 列出所有職缺（從 SQL）
 */
router.get('/jobs', async (req, res) => {
  try {
    const client = await pool.connect();
    try {
    const result = await client.query(`
      SELECT
        id,
        position_name,
        client_company,
        department,
        open_positions,
        salary_range,
        key_skills,
        experience_required,
        education_required,
        location,
        job_status,
        language_required,
        special_conditions,
        industry_background,
        team_size,
        key_challenges,
        attractive_points,
        recruitment_difficulty,
        interview_process,
        consultant_notes,
        job_description,
        marketing_description,
        company_profile,
        talent_profile,
        search_primary,
        search_secondary,
        welfare_tags,
        welfare_detail,
        work_hours,
        vacation_policy,
        remote_work,
        business_trip,
        job_url,
        submission_criteria,
        interview_stages,
        interview_stage_detail,
        priority,
        salary_min,
        salary_max,
        rejection_criteria,
        created_at,
        updated_at
      FROM jobs_pipeline
      ORDER BY created_at DESC
      LIMIT 1000
    `);

    const jobs = result.rows.map(row => ({
      id: row.id,
      position_name: row.position_name,
      client_company: row.client_company,
      department: row.department,
      open_positions: row.open_positions,
      salary_range: row.salary_range,
      key_skills: row.key_skills,
      experience_required: row.experience_required,
      education_required: row.education_required,
      location: row.location,
      job_status: row.job_status,
      language_required: row.language_required,
      special_conditions: row.special_conditions,
      industry_background: row.industry_background,
      team_size: row.team_size,
      key_challenges: row.key_challenges,
      attractive_points: row.attractive_points,
      recruitment_difficulty: row.recruitment_difficulty,
      interview_process: row.interview_process,
      consultant_notes: row.consultant_notes,
      job_description: row.job_description,
      marketing_description: row.marketing_description,
      company_profile: row.company_profile,
      talent_profile: row.talent_profile,
      search_primary: row.search_primary,
      search_secondary: row.search_secondary,
      welfare_tags: row.welfare_tags,
      welfare_detail: row.welfare_detail,
      work_hours: row.work_hours,
      vacation_policy: row.vacation_policy,
      remote_work: row.remote_work,
      business_trip: row.business_trip,
      job_url: row.job_url,
      submission_criteria: row.submission_criteria,
      interview_stages: row.interview_stages || 0,
      interview_stage_detail: row.interview_stage_detail,
      priority: row.priority || '一般',
      salary_min: row.salary_min,
      salary_max: row.salary_max,
      rejection_criteria: row.rejection_criteria,
      created_at: row.created_at,
      lastUpdated: row.updated_at
    }));

    res.json({
      success: true,
      data: jobs,
      count: jobs.length
    });
    } finally {
      client.release();
    }
  } catch (error) {
    safeError(res, error, 'GET /jobs');
  }
});

/**
 * GET /api/jobs/:id
 * 獲取單一職缺
 */
router.get('/jobs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const client = await pool.connect();
    let result;
    try {
      result = await client.query(
        `SELECT * FROM jobs_pipeline WHERE id = $1`,
        [id]
      );
    } finally {
      client.release();
    }

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    safeError(res, error, 'GET /jobs/:id');
  }
});

/**
 * PUT /api/jobs/:id
 * 更新職缺（只更新有傳入的欄位，不覆蓋空值）
 */
router.put('/jobs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      position_name, client_company, department, open_positions,
      salary_range, key_skills, experience_required, education_required,
      location, language_required, special_conditions, industry_background,
      team_size, key_challenges, attractive_points, recruitment_difficulty,
      interview_process,
      job_status, consultant_notes, job_description, marketing_description,
      company_profile, talent_profile, search_primary, search_secondary,
      target_companies, title_variants, exclusion_keywords,
      welfare_tags, welfare_detail, work_hours, vacation_policy,
      remote_work, business_trip, job_url,
      submission_criteria, interview_stages, interview_stage_detail,
      priority, salary_min, salary_max, rejection_criteria,
    } = req.body;

    const client = await pool.connect();
    let result;
    try {

    // 先取得現有資料，避免覆蓋空值
    const current = await client.query('SELECT * FROM jobs_pipeline WHERE id = $1', [id]);
    if (current.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }
    const existing = current.rows[0];

    result = await client.query(
      `UPDATE jobs_pipeline
       SET position_name = $1, job_status = $2, consultant_notes = $3,
           job_description = $4,
           company_profile = $5, talent_profile = $6,
           search_primary = $7, search_secondary = $8,
           welfare_tags = $9, welfare_detail = $10,
           work_hours = $11, vacation_policy = $12,
           remote_work = $13, business_trip = $14, job_url = $15,
           client_company = $17, department = $18, open_positions = $19,
           salary_range = $20, key_skills = $21, experience_required = $22,
           education_required = $23, location = $24, language_required = $25,
           special_conditions = $26, industry_background = $27, team_size = $28,
           key_challenges = $29, attractive_points = $30, recruitment_difficulty = $31,
           interview_process = $32,
           target_companies = $33, title_variants = $34, exclusion_keywords = $35,
           marketing_description = $36,
           submission_criteria = $37, interview_stages = $38,
           interview_stage_detail = $39, priority = $40,
           salary_min = $41, salary_max = $42, rejection_criteria = $43,
           last_updated = NOW()
       WHERE id = $16
       RETURNING *`,
      [
        position_name    !== undefined ? position_name    : existing.position_name,
        job_status       !== undefined ? job_status       : existing.job_status,
        consultant_notes !== undefined ? consultant_notes : existing.consultant_notes,
        job_description  !== undefined ? job_description  : existing.job_description,
        company_profile  !== undefined ? company_profile  : existing.company_profile,
        talent_profile   !== undefined ? talent_profile   : existing.talent_profile,
        search_primary   !== undefined ? search_primary   : existing.search_primary,
        search_secondary !== undefined ? search_secondary : existing.search_secondary,
        welfare_tags     !== undefined ? welfare_tags     : existing.welfare_tags,
        welfare_detail   !== undefined ? welfare_detail   : existing.welfare_detail,
        work_hours       !== undefined ? work_hours       : existing.work_hours,
        vacation_policy  !== undefined ? vacation_policy  : existing.vacation_policy,
        remote_work      !== undefined ? remote_work      : existing.remote_work,
        business_trip    !== undefined ? business_trip    : existing.business_trip,
        job_url          !== undefined ? job_url          : existing.job_url,
        id,
        client_company       !== undefined ? client_company       : existing.client_company,
        department           !== undefined ? department           : existing.department,
        open_positions       !== undefined ? open_positions       : existing.open_positions,
        salary_range         !== undefined ? salary_range         : existing.salary_range,
        key_skills           !== undefined ? key_skills           : existing.key_skills,
        experience_required  !== undefined ? experience_required  : existing.experience_required,
        education_required   !== undefined ? education_required   : existing.education_required,
        location             !== undefined ? location             : existing.location,
        language_required    !== undefined ? language_required    : existing.language_required,
        special_conditions   !== undefined ? special_conditions   : existing.special_conditions,
        industry_background  !== undefined ? industry_background  : existing.industry_background,
        team_size            !== undefined ? team_size            : existing.team_size,
        key_challenges       !== undefined ? key_challenges       : existing.key_challenges,
        attractive_points    !== undefined ? attractive_points    : existing.attractive_points,
        recruitment_difficulty !== undefined ? recruitment_difficulty : existing.recruitment_difficulty,
        interview_process    !== undefined ? interview_process    : existing.interview_process,
        target_companies     !== undefined ? target_companies     : existing.target_companies,
        title_variants       !== undefined ? title_variants       : existing.title_variants,
        exclusion_keywords   !== undefined ? exclusion_keywords   : existing.exclusion_keywords,
        marketing_description !== undefined ? marketing_description : existing.marketing_description,
        submission_criteria      !== undefined ? submission_criteria      : existing.submission_criteria,
        interview_stages         !== undefined ? interview_stages         : (existing.interview_stages || 0),
        interview_stage_detail   !== undefined ? interview_stage_detail   : existing.interview_stage_detail,
        priority                 !== undefined ? priority                 : (existing.priority || '一般'),
        salary_min               !== undefined ? salary_min               : existing.salary_min,
        salary_max               !== undefined ? salary_max               : existing.salary_max,
        rejection_criteria       !== undefined ? rejection_criteria       : existing.rejection_criteria,
      ]
    );

    } finally {
      client.release();
    }

    // 職缺更新 → 清除所有候選人的匹配快取（需重新比對）
    pool.query('DELETE FROM candidate_job_rankings_cache').catch(() => {});

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Job updated successfully'
    });
  } catch (error) {
    safeError(res, error, 'PUT /jobs/:id');
  }
});

/**
 * PATCH /api/jobs/:id/status
 * 專用：只更新職缺狀態（供 AIbot 使用）
 * Body: { job_status: "招募中" | "暫停" | "已滿額" | "關閉", actor: "aibot名稱" }
 */
router.patch('/jobs/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { job_status, actor } = req.body;

    const VALID_STATUSES = ['招募中', '暫停', '已滿額', '關閉'];
    if (!job_status) {
      return res.status(400).json({ success: false, error: '缺少 job_status 欄位' });
    }
    if (!VALID_STATUSES.includes(job_status)) {
      return res.status(400).json({
        success: false,
        error: `無效狀態，允許值：${VALID_STATUSES.join('、')}`
      });
    }

    const client = await pool.connect();
    let result, oldStatus;
    try {

    const current = await client.query('SELECT * FROM jobs_pipeline WHERE id = $1', [id]);
    if (current.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }
    oldStatus = current.rows[0].job_status;

    result = await client.query(
      `UPDATE jobs_pipeline SET job_status = $1, last_updated = NOW() WHERE id = $2 RETURNING *`,
      [job_status, id]
    );

    // 寫入 system_logs
    await client.query(
      `INSERT INTO system_logs (action, actor, actor_type, candidate_id, candidate_name, detail)
       VALUES ('UPDATE', $1, 'AIBOT', $2, $3, $4)`,
      [
        actor || 'aibot',
        id,
        result.rows[0].position_name || `Job#${id}`,
        JSON.stringify({ field: 'job_status', old: oldStatus, new: job_status })
      ]
    ).catch(() => {}); // log 失敗不影響主流程
    } finally {
      client.release();
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: `職缺狀態已從「${oldStatus}」更新為「${job_status}」`,
      changed: { from: oldStatus, to: job_status }
    });
  } catch (error) {
    safeError(res, error, 'PATCH /jobs/:id/status');
  }
});

/**
 * DELETE /api/jobs/:id
 * 刪除職缺
 */
router.delete('/jobs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const client = await pool.connect();
    let result;
    try {

    result = await client.query(
      'DELETE FROM jobs_pipeline WHERE id = $1 RETURNING id, position_name, client_company',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }

    // 寫入 system_logs
    await client.query(
      `INSERT INTO system_logs (action, actor, actor_type, candidate_id, candidate_name, detail)
       VALUES ('DELETE', $1, 'HUMAN', $2, $3, $4)`,
      [
        'user',
        id,
        result.rows[0].position_name || `Job#${id}`,
        JSON.stringify({ type: 'job', company: result.rows[0].client_company })
      ]
    ).catch(() => {}); // log 失敗不影響主流程
    } finally {
      client.release();
    }

    res.json({
      success: true,
      message: `職缺「${result.rows[0].position_name}」已刪除`,
      data: result.rows[0]
    });
  } catch (error) {
    safeError(res, error, 'DELETE /jobs/:id');
  }
});

/**
 * POST /api/jobs
 * 新增職缺（支援所有欄位）
 */
router.post('/jobs', async (req, res) => {
  try {
    const b = req.body;

    if (!b.position_name) {
      return res.status(400).json({ success: false, error: 'position_name 為必填欄位' });
    }

    const dbClient = await pool.connect();
    let createdJob;
    try {

    // 先查表有哪些欄位（動態適應 ALTER TABLE 擴充）
    const tableInfo = await dbClient.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name='jobs_pipeline'
    `);
    const availableCols = new Set(tableInfo.rows.map(r => r.column_name));

    // 所有支援的欄位與對應值
    const allFields = {
      position_name:           b.position_name,
      client_company:          b.client_company || b.company_name || '',
      company_name:            b.company_name || b.client_company || '',
      department:              b.department || '',
      open_positions:          b.open_positions || b.headcount || '',
      salary_range:            b.salary_range || '',
      salary_min:              b.salary_min || null,
      salary_max:              b.salary_max || null,
      key_skills:              b.key_skills || b.required_skills || '',
      required_skills:         b.required_skills || b.key_skills || '',
      experience_required:     b.experience_required || '',
      education_required:      b.education_required || '',
      location:                b.location || '',
      language_required:       b.language_required || '',
      special_conditions:      b.special_conditions || '',
      industry_background:     b.industry_background || '',
      team_size:               b.team_size || '',
      key_challenges:          b.key_challenges || '',
      attractive_points:       b.attractive_points || '',
      recruitment_difficulty:  b.recruitment_difficulty || '',
      interview_process:       b.interview_process || '',
      job_description:         b.job_description || '',
      consultant_notes:        b.consultant_notes || '',
      company_profile:         b.company_profile || '',
      talent_profile:          b.talent_profile || '',
      search_primary:          b.search_primary || '',
      search_secondary:        b.search_secondary || '',
      welfare_tags:            b.welfare_tags || '',
      welfare_detail:          b.welfare_detail || '',
      work_hours:              b.work_hours || '',
      vacation_policy:         b.vacation_policy || '',
      remote_work:             b.remote_work || '',
      business_trip:           b.business_trip || '',
      job_url:                 b.job_url || '',
      job_status:              b.job_status || b.status || '招募中',
      source:                  b.source || '104',
      submission_criteria:     b.submission_criteria || '',
      interview_stages:        b.interview_stages || 0,
      interview_stage_detail:  b.interview_stage_detail || '',
      priority:                b.priority || '一般',
      rejection_criteria:      b.rejection_criteria || '',
    };

    // 只保留表中實際存在的欄位
    const colsToInsert = Object.keys(allFields).filter(f => availableCols.has(f));
    const valsToInsert = colsToInsert.map(f => allFields[f]);
    const placeholders = colsToInsert.map((_, i) => `$${i + 1}`);

    const result = await dbClient.query(
      `INSERT INTO jobs_pipeline (${colsToInsert.join(', ')}, created_at, last_updated)
       VALUES (${placeholders.join(', ')}, NOW(), NOW())
       RETURNING *`,
      valsToInsert
    );

    createdJob = result.rows[0];
    } finally {
      dbClient.release();
    }

    // 新職缺 → 清除所有候選人的匹配快取（需重新比對）
    pool.query('DELETE FROM candidate_job_rankings_cache').catch(() => {});

    // 檢查重要欄位是否為空，回傳 missing_fields 提醒龍蝦 AI / 顧問補填
    const importantFieldChecks = {
      submission_criteria: { label: '客戶送人條件', value: createdJob.submission_criteria },
      interview_stages: { label: '面試階段數', value: createdJob.interview_stages },
      interview_stage_detail: { label: '面試各階段說明', value: createdJob.interview_stage_detail },
      rejection_criteria: { label: '淘汰條件', value: createdJob.rejection_criteria },
      salary_min: { label: '薪資下限', value: createdJob.salary_min },
      salary_max: { label: '薪資上限', value: createdJob.salary_max },
      key_skills: { label: '主要技能', value: createdJob.key_skills },
      experience_required: { label: '經驗要求', value: createdJob.experience_required },
      job_description: { label: '職缺描述', value: createdJob.job_description },
    };
    const missing_fields = Object.entries(importantFieldChecks)
      .filter(([, v]) => !v.value || v.value === '' || v.value === 0)
      .map(([key, v]) => ({ field: key, label: v.label }));

    res.status(201).json({
      success: true,
      data: createdJob,
      missing_fields: missing_fields.length > 0 ? missing_fields : [],
      message: missing_fields.length > 0
        ? `職缺建立成功，但有 ${missing_fields.length} 個重要欄位待補填：${missing_fields.map(f => f.label).join('、')}`
        : 'Job created successfully'
    });
  } catch (error) {
    safeError(res, error, 'POST /jobs');
  }
});

// ==================== 同步 API ====================

const SHEET_ID = process.env.SHEET_ID || '1PunpaDAFBPBL_I76AiRYGXKaXDZvMl1c262SEtxRk6Q';
const CANDIDATES_TAB_GID = process.env.TAB_GID || '142613837';

/**
 * 從 Google Sheets 匯出 CSV（處理重定向）
 */
function fetchSheetAsCSV() {
  return new Promise((resolve, reject) => {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${CANDIDATES_TAB_GID}`;

    const follow = (targetUrl) => {
      https.get(targetUrl, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) {
          return follow(res.headers.location);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode}: 無法存取 Google Sheets`));
        }
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
      }).on('error', reject);
    };

    follow(url);
  });
}

/**
 * 簡單 CSV 解析（處理引號和逗號）
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

// [REMOVED 2026-03-16] POST /api/sync/sheets-to-sql — 已廢棄（系統已遷移至 SQL-only，不再使用 Google Sheets 同步）

// ==================== 系統日誌 API ====================

/**
 * GET /api/system-logs
 * 查詢操作日誌
 * Query params:
 *   limit  - 回傳筆數，預設 200，最大 1000
 *   actor  - 篩選操作者（模糊比對）
 *   action - 篩選操作類型（PIPELINE_CHANGE / IMPORT_CREATE / IMPORT_UPDATE / BULK_IMPORT / UPDATE）
 *   type   - 篩選操作者類型（HUMAN / AIBOT）
 */
router.get('/system-logs', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 200, 1000);
    const { actor, action, type } = req.query;

    const conditions = [];
    const values = [];
    let idx = 1;

    if (actor) {
      conditions.push(`actor ILIKE $${idx++}`);
      values.push(`%${actor}%`);
    }
    if (action) {
      conditions.push(`action = $${idx++}`);
      values.push(action);
    }
    if (type) {
      conditions.push(`actor_type = $${idx++}`);
      values.push(type.toUpperCase());
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    values.push(limit);

    const result = await pool.query(
      `SELECT id, action, actor, actor_type, candidate_id, candidate_name, detail, created_at
       FROM system_logs
       ${where}
       ORDER BY created_at DESC
       LIMIT $${idx}`,
      values
    );

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    safeError(res, error, 'GET /system-logs');
  }
});

// ==================== 系統 API ====================

/**
 * GET /api/health
 * 健康檢查
 */
router.get('/health', async (req, res) => {
  let dbStatus = 'connected';
  try {
    const client = await Promise.race([
      pool.connect(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
    ]);
    try {
      await client.query('SELECT 1');
    } finally {
      client.release();
    }
  } catch (error) {
    dbStatus = 'unavailable';
  }
  // 始終回 200；DB 狀態在 body 中說明
  res.json({
    success: true,
    status: 'ok',
    database: dbStatus,
    timestamp: new Date().toISOString()
  });
});

// ==================== 顧問聯絡資訊 API ====================

/**
 * GET /api/users — 取得所有顧問名單（從 user_contacts + candidates recruiter 合併去重）
 */
router.get('/users', async (req, res) => {
  try {
    // 從 user_contacts 取登入過的顧問
    const uc = await pool.query('SELECT display_name FROM user_contacts ORDER BY display_name');
    // 從 candidates_pipeline 取出現過的 recruiter 名稱（補充未存聯絡資訊的顧問）
    const cp = await pool.query(`
      SELECT DISTINCT recruiter AS display_name
      FROM candidates_pipeline
      WHERE recruiter IS NOT NULL AND recruiter <> '' AND recruiter NOT LIKE 'AIBot%'
      ORDER BY 1
    `);
    const names = Array.from(new Set([
      ...uc.rows.map(r => r.display_name),
      ...cp.rows.map(r => r.display_name),
    ])).filter(Boolean).sort();
    res.json({ success: true, data: names });
  } catch (error) {
    safeError(res, error, 'GET /users');
  }
});

/**
 * POST /api/users/register — 顧問登入時自動呼叫，確保顧問名單完整
 * body: { displayName }
 */
router.post('/users/register', async (req, res) => {
  try {
    const { displayName } = req.body;
    if (!displayName) return res.status(400).json({ success: false, error: 'displayName 必填' });
    // upsert：有就更新 updated_at，沒有就新增（不覆蓋其他欄位）
    await pool.query(
      `INSERT INTO user_contacts (display_name, updated_at)
       VALUES ($1, NOW())
       ON CONFLICT (display_name) DO UPDATE SET updated_at = NOW()`,
      [displayName]
    );
    res.json({ success: true });
  } catch (error) {
    safeError(res, error, 'POST /users/register');
  }
});

/**
 * GET /api/users/:displayName/contact
 * 取得顧問聯絡資訊（供 AIbot 使用）
 */
router.get('/users/:displayName/contact', async (req, res) => {
  try {
    const { displayName } = req.params;
    const result = await pool.query(
      'SELECT * FROM user_contacts WHERE display_name = $1',
      [displayName]
    );
    if (result.rows.length === 0) {
      return res.json({ success: true, data: { display_name: displayName } });
    }
    const row = result.rows[0];
    // 遮罩 token — 只告知前端「有設定」或「未設定」，不回傳實際 token
    const mask = (val) => val ? '••••••••' : '';
    res.json({
      success: true,
      data: {
        displayName: row.display_name,
        contactPhone: row.contact_phone,
        contactEmail: row.contact_email,
        lineId: row.line_id,
        telegramHandle: row.telegram_handle,
        githubToken: mask(row.github_token),
        linkedinToken: mask(row.linkedin_token),
        braveApiKey: mask(row.brave_api_key),
        telegramBotToken: mask(row.telegram_bot_token),
        telegramChatId: row.telegram_chat_id || '',
      }
    });
  } catch (error) {
    safeError(res, error, 'GET /users/:displayName/contact');
  }
});

/**
 * PUT /api/users/:displayName/contact
 * 儲存顧問聯絡資訊（前端儲存設定時呼叫）
 */
router.put('/users/:displayName/contact', async (req, res) => {
  try {
    const { displayName } = req.params;
    const { contactPhone, contactEmail, lineId, telegramHandle, githubToken, linkedinToken, braveApiKey,
            telegramBotToken, telegramChatId } = req.body;

    // 遮罩值代表使用者沒有修改 token，跳過不覆寫
    const MASK = '••••••••';
    const tokenOrKeep = (val) => (val && val !== MASK) ? val : undefined;

    // Token 欄位：若為遮罩值則保留原值（用 COALESCE 邏輯）
    const ghToken = tokenOrKeep(githubToken);
    const liToken = tokenOrKeep(linkedinToken);
    const braveKey = tokenOrKeep(braveApiKey);
    const tgBotToken = tokenOrKeep(telegramBotToken);

    await pool.query(`
      INSERT INTO user_contacts (display_name, contact_phone, contact_email, line_id, telegram_handle, github_token, linkedin_token, brave_api_key, telegram_bot_token, telegram_chat_id, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      ON CONFLICT (display_name) DO UPDATE SET
        contact_phone = EXCLUDED.contact_phone,
        contact_email = EXCLUDED.contact_email,
        line_id = EXCLUDED.line_id,
        telegram_handle = EXCLUDED.telegram_handle,
        github_token = CASE WHEN $6 IS NOT NULL THEN $6 ELSE user_contacts.github_token END,
        linkedin_token = CASE WHEN $7 IS NOT NULL THEN $7 ELSE user_contacts.linkedin_token END,
        brave_api_key = CASE WHEN $8 IS NOT NULL THEN $8 ELSE user_contacts.brave_api_key END,
        telegram_bot_token = CASE WHEN $9 IS NOT NULL THEN $9 ELSE user_contacts.telegram_bot_token END,
        telegram_chat_id = EXCLUDED.telegram_chat_id,
        updated_at = NOW()
    `, [displayName, contactPhone || null, contactEmail || null, lineId || null, telegramHandle || null,
        ghToken || null, liToken || null, braveKey || null,
        tgBotToken || null, telegramChatId || null]);

    res.json({ success: true, message: '聯絡資訊已儲存' });
  } catch (error) {
    safeError(res, error, 'PUT /users/:displayName/contact');
  }
});

/**
 * GET /api/users/:displayName/site-config
 * 取得顧問對外頁面設定（供 consultant-site 使用）
 */
router.get('/users/:displayName/site-config', async (req, res) => {
  try {
    const { displayName } = req.params;
    const result = await pool.query(
      'SELECT display_name, contact_email, contact_phone, site_config FROM user_contacts WHERE display_name = $1',
      [displayName]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Consultant not found' });
    }
    const row = result.rows[0];
    const siteConfig = row.site_config || {};

    // 組合成 consultant-site 需要的格式
    res.json({
      displayName: row.display_name,
      siteConfig: {
        slug: siteConfig.slug || row.display_name.toLowerCase().replace(/\s+/g, '-'),
        template: siteConfig.template || 'minimal',
        primaryColor: siteConfig.primaryColor || '#1a1a1a',
        accentColor: siteConfig.accentColor || '#3b82f6',
        heroTitle: siteConfig.heroTitle || `找到適合你的職涯下一步`,
        heroSubtitle: siteConfig.heroSubtitle || '',
        avatar: siteConfig.avatar || '',
        bio: siteConfig.bio || '',
        specialties: siteConfig.specialties || [],
        yearsExperience: siteConfig.yearsExperience || 0,
        socialLinks: {
          email: row.contact_email || siteConfig.socialLinks?.email || '',
          phone: row.contact_phone || siteConfig.socialLinks?.phone || '',
          linkedin: siteConfig.socialLinks?.linkedin || '',
          github: siteConfig.socialLinks?.github || '',
          line: siteConfig.socialLinks?.line || '',
        },
        featuredJobIds: siteConfig.featuredJobIds || [],
        testimonials: siteConfig.testimonials || [],
        seoTitle: siteConfig.seoTitle || '',
        seoDescription: siteConfig.seoDescription || '',
        isPublished: siteConfig.isPublished || false,
      }
    });
  } catch (error) {
    console.error('❌ GET /users/:displayName/site-config error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/users/:displayName/site-config
 * 更新顧問對外頁面設定
 */
router.put('/users/:displayName/site-config', async (req, res) => {
  try {
    const { displayName } = req.params;
    const siteConfig = req.body;

    if (!siteConfig || typeof siteConfig !== 'object') {
      return res.status(400).json({ success: false, error: 'Invalid site config' });
    }

    await pool.query(`
      UPDATE user_contacts
      SET site_config = $2, updated_at = NOW()
      WHERE display_name = $1
    `, [displayName, JSON.stringify(siteConfig)]);

    res.json({ success: true, message: '對外頁面設定已儲存' });
  } catch (error) {
    console.error('❌ PUT /users/:displayName/site-config error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== AI 指南端點 ====================

/**
 * GET /api/guide
 * 回傳 AIbot 操作指南（Markdown 格式）
 * AIbot 可透過此端點學習所有 API 端點、欄位說明、評分標準
 */
const fs = require('fs');
const path = require('path');

router.get('/guide', (req, res) => {
  try {
    const guidePath = path.join(__dirname, 'guides/AIBOT-API-GUIDE.md');
    if (!fs.existsSync(guidePath)) {
      return res.status(404).json({ success: false, error: 'Guide file not found' });
    }
    const content = replaceGuideBaseUrl(fs.readFileSync(guidePath, 'utf-8'), req);
    // 根據 Accept 標頭決定回傳格式
    const accept = req.headers['accept'] || '';
    if (accept.includes('application/json')) {
      res.json({ success: true, content });
    } else {
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.send(content);
    }
  } catch (error) {
    safeError(res, error, 'GET /guide');
  }
});

// [REMOVED 2026-03-16] POST /api/migrate/extract-links — 已廢棄（一次性 migration 工具，已執行完畢）

// GET /api/consultant-sop — 回傳顧問 SOP 操作手冊
router.get('/consultant-sop', (req, res) => {
  try {
    const guidePath = path.join(__dirname, 'guides/CONSULTANT-SOP-GUIDE.md');
    if (!fs.existsSync(guidePath)) {
      return res.status(404).json({ success: false, error: 'Consultant SOP guide not found' });
    }
    const content = replaceGuideBaseUrl(fs.readFileSync(guidePath, 'utf-8'), req);
    const accept = req.headers['accept'] || '';
    if (accept.includes('application/json')) {
      res.json({ success: true, content });
    } else {
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.send(content);
    }
  } catch (error) {
    safeError(res, error, 'GET /consultant-sop');
  }
});

// GET /api/scoring-guide — 回傳評分 Bot 執行指南（供 openclaw / AI Agent 定時評分使用）
router.get('/scoring-guide', (req, res) => {
  try {
    const guidePath = path.join(__dirname, 'guides/SCORING-GUIDE.md');
    if (!fs.existsSync(guidePath)) {
      return res.status(404).json({ success: false, error: 'Scoring guide not found' });
    }
    const content = replaceGuideBaseUrl(fs.readFileSync(guidePath, 'utf-8'), req);
    const accept = req.headers['accept'] || '';
    if (accept.includes('application/json')) {
      res.json({ success: true, content });
    } else {
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.send(content);
    }
  } catch (error) {
    safeError(res, error, 'GET /scoring-guide');
  }
});

// GET /api/jobs-import-guide — 回傳職缺匯入 Bot 執行指南
router.get('/jobs-import-guide', (req, res) => {
  try {
    const guidePath = path.join(__dirname, 'guides/JOB-IMPORT-GUIDE.md');
    if (!fs.existsSync(guidePath)) {
      return res.status(404).json({ success: false, error: 'Job import guide not found' });
    }
    const content = replaceGuideBaseUrl(fs.readFileSync(guidePath, 'utf-8'), req);
    const accept = req.headers['accept'] || '';
    if (accept.includes('application/json')) {
      res.json({ success: true, content });
    } else {
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.send(content);
    }
  } catch (error) {
    safeError(res, error, 'GET /jobs-import-guide');
  }
});

// GET /api/resume-guide — 回傳履歷分析教學指南（供 AIbot 學習使用）
router.get('/resume-guide', (req, res) => {
  try {
    const guidePath = path.join(__dirname, 'guides/RESUME-ANALYSIS-GUIDE.md');
    if (!fs.existsSync(guidePath)) {
      return res.status(404).json({ success: false, error: 'Resume analysis guide not found' });
    }
    const content = replaceGuideBaseUrl(fs.readFileSync(guidePath, 'utf-8'), req);
    const accept = req.headers['accept'] || '';
    if (accept.includes('application/json')) {
      res.json({ success: true, content });
    } else {
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.send(content);
    }
  } catch (error) {
    safeError(res, error, 'GET /resume-guide');
  }
});

// GET /api/resume-import-guide — 履歷匯入 + 即時評分合併執行指南
router.get('/resume-import-guide', (req, res) => {
  try {
    const guidePath = path.join(__dirname, 'guides/RESUME-IMPORT-GUIDE.md');
    if (!fs.existsSync(guidePath)) {
      return res.status(404).json({ success: false, error: 'Resume import guide not found' });
    }
    const content = replaceGuideBaseUrl(fs.readFileSync(guidePath, 'utf-8'), req);
    const accept = req.headers['accept'] || '';
    if (accept.includes('application/json')) {
      res.json({ success: true, content });
    } else {
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.send(content);
    }
  } catch (error) {
    safeError(res, error, 'GET /resume-import-guide');
  }
});

// GET /api/github-analysis-guide — GitHub 分析指南（供 OpenClaw / AI Agent 使用）
router.get('/github-analysis-guide', (req, res) => {
  try {
    const guidePath = path.join(__dirname, 'guides/GITHUB-ANALYSIS-GUIDE.md');
    if (!fs.existsSync(guidePath)) {
      return res.status(404).json({ success: false, error: 'GitHub analysis guide not found' });
    }
    const content = replaceGuideBaseUrl(fs.readFileSync(guidePath, 'utf-8'), req);
    const accept = req.headers['accept'] || '';
    if (accept.includes('application/json')) {
      res.json({ success: true, content });
    } else {
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.send(content);
    }
  } catch (error) {
    safeError(res, error, 'GET /github-analysis-guide');
  }
});

// ==================== AI 模組化手冊統一入口 (NEW - 2026-03-16) ====================

const AI_GUIDE_FILES = {
  'index':       'AI-GUIDE-INDEX.md',
  'clients':     'AI-CLIENT-GUIDE.md',
  'jobs':        'AI-JOB-GUIDE.md',
  'candidates':  'AI-CANDIDATE-GUIDE.md',
  'talent-ops':  'AI-TALENT-OPS-GUIDE.md',
  'resume-sop':  'RESUME-PROCESSING-SOP.md',
};

// GET /api/ai-guide — 統一入口（索引頁）
// GET /api/guide/clients — 客戶模組
// GET /api/guide/jobs — 職缺模組
// GET /api/guide/candidates — 人選模組
// GET /api/guide/talent-ops — 人才AI模組
router.get('/ai-guide', (req, res) => serveGuide('index', req, res));
router.get('/guide/index', (req, res) => serveGuide('index', req, res));
router.get('/guide/clients', (req, res) => serveGuide('clients', req, res));
router.get('/guide/jobs', (req, res) => serveGuide('jobs', req, res));
router.get('/guide/candidates', (req, res) => serveGuide('candidates', req, res));
router.get('/guide/talent-ops', (req, res) => serveGuide('talent-ops', req, res));
router.get('/guide/resume-sop', (req, res) => serveGuide('resume-sop', req, res));

function serveGuide(key, req, res) {
  try {
    const filename = AI_GUIDE_FILES[key];
    if (!filename) return res.status(404).json({ success: false, error: `Guide "${key}" not found` });
    const guidePath = path.join(__dirname, 'guides', filename);
    if (!fs.existsSync(guidePath)) {
      return res.status(404).json({ success: false, error: `Guide file not found: ${filename}` });
    }
    const content = replaceGuideBaseUrl(fs.readFileSync(guidePath, 'utf-8'), req);
    const accept = req.headers['accept'] || '';
    if (accept.includes('application/json')) {
      res.json({ success: true, guide: key, content });
    } else {
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.send(content);
    }
  } catch (error) {
    safeError(res, error, `GET /guide/${key}`);
  }
}

// ==================== 人才智能爬蟲 API (NEW - 2026-02-26) ====================
// 整合 step1ne-headhunter-skill 的爬蟲系統

const talentSourcingRoutes = require('./talent-sourcing/routes');
router.use('/talent-sourcing', talentSourcingRoutes);
// ==================== BD 客戶開發 API ====================

const BD_STATUSES = ['開發中', '接洽中', '提案中', '合約階段', '合作中', '暫停', '流失'];

/** GET /api/clients - 列表 */
router.get('/clients', async (req, res) => {
  try {
    const { bd_status, consultant } = req.query;
    let query = `
      SELECT c.*,
        COUNT(j.id)::int AS job_count
      FROM clients c
      LEFT JOIN jobs_pipeline j ON j.client_id = c.id
    `;
    const params = [];
    const conditions = [];
    if (bd_status && bd_status !== 'all') { params.push(bd_status); conditions.push(`c.bd_status = $${params.length}`); }
    if (consultant && consultant !== 'all') { params.push(consultant); conditions.push(`c.consultant = $${params.length}`); }
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' GROUP BY c.id ORDER BY c.created_at DESC';
    const result = await withClient(client => client.query(query, params));
    res.json({ success: true, data: result.rows });
  } catch (error) {
    safeError(res, error, 'GET /clients');
  }
});

/** GET /api/clients/:id - 詳情 */
router.get('/clients/:id', async (req, res) => {
  try {
    const result = await withClient(client => client.query('SELECT * FROM clients WHERE id = $1', [req.params.id]));
    if (!result.rows.length) return res.status(404).json({ success: false, error: 'Client not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    safeError(res, error, 'GET /clients/:id');
  }
});

// ===== 產業自動偵測（用於新增客戶時自動標記） =====
const INDUSTRY_DETECT_MAP = [
  { value: '軟體 / SaaS', kw: ['saas','software','軟體','雲端','cloud','crm','erp','shopline','appier','cacafly','91app','omnichat','surveycake','ocard'] },
  { value: '系統整合（SI）', kw: ['si','系統整合','精誠','凌群','中冠','叡揚','雲育鏈','創泓','振邦','紅門','零壹','邦鼎','systex','digiwin','資通'] },
  { value: 'BIM / 營建工程', kw: ['bim','營建','建築','工程','營造','築本','autodesk','衛武'] },
  { value: '金融 / FinTech', kw: ['金融','fintech','銀行','保險','證券','信託','投資','支付','pay','國泰','富邦','中信','玉山','台新','永豐','星展','將來銀行'] },
  { value: '餐旅飯店', kw: ['餐','飯店','旅','飲','食','旅遊','觀光','酒店','hotel','晶華','寒舍','雲品','王品','鼎泰豐','饗賓','雄獅','kkday','klook'] },
  { value: '製造業', kw: ['製造','工廠','半導體','電子','光電','機械','台積電','tsmc','鴻海','聯發科','瑞昱','群創','友達','研華','delta','pcb'] },
  { value: '電商 / 零售', kw: ['電商','零售','商城','commerce','momo','pchome','shopee','蝦皮','統一','全家','家樂福','全聯','誠品'] },
  { value: 'AI / 數據', kw: ['ai','人工智慧','機器學習','數據','data','ml','大數據','gpt','llm','nvidia'] },
  { value: '醫療 / 生技', kw: ['醫療','生技','醫院','藥','生物','基因','biotech','pharma','健康','health'] },
  { value: '物流 / 運輸', kw: ['物流','運輸','快遞','貨運','倉儲','供應鏈','logistics','宅配','嘉里','新竹物流','黑貓'] },
  { value: '顧問 / 專業服務', kw: ['顧問','會計','法律','事務所','consulting','advisory','pwc','deloitte','ey','kpmg'] },
  { value: '媒體 / 廣告 / 行銷', kw: ['媒體','廣告','行銷','media','marketing','公關','品牌','數位行銷'] },
  { value: '教育 / EdTech', kw: ['教育','學校','補習','培訓','edtech','學習','hahow'] },
];
function serverAutoDetectIndustry(companyName) {
  if (!companyName) return '';
  const cn = companyName.toLowerCase().replace(/[\s（）()]/g, '');
  for (const opt of INDUSTRY_DETECT_MAP) {
    for (const k of opt.kw) {
      if (cn.includes(k.toLowerCase())) return opt.value;
    }
  }
  return '';
}

/** POST /api/clients - 新增客戶 */
router.post('/clients', async (req, res) => {
  try {
    let {
      company_name, industry, company_size, website,
      bd_status = '開發中', bd_source,
      contact_name, contact_title, contact_email, contact_phone, contact_linkedin,
      consultant, contract_type, fee_percentage, contract_start, contract_end, notes
    } = req.body;
    if (!company_name) return res.status(400).json({ success: false, error: '缺少 company_name' });
    // 自動產業偵測：前端未填 → 後端兜底推測
    if (!industry) {
      industry = serverAutoDetectIndustry(company_name);
    }
    const result = await withClient(client => client.query(
      `INSERT INTO clients
        (company_name, industry, company_size, website, bd_status, bd_source,
         contact_name, contact_title, contact_email, contact_phone, contact_linkedin,
         consultant, contract_type, fee_percentage, contract_start, contract_end, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       RETURNING *`,
      [company_name, industry, company_size, website, bd_status, bd_source,
       contact_name, contact_title, contact_email, contact_phone, contact_linkedin,
       consultant, contract_type, fee_percentage, contract_start, contract_end, notes]
    ));
    const autoTagged = !req.body.industry && industry;
    res.json({
      success: true,
      data: result.rows[0],
      message: autoTagged ? `客戶已新增，已自動標記產業：${industry}` : '客戶已新增',
      auto_industry: autoTagged ? industry : undefined
    });
  } catch (error) {
    safeError(res, error, 'POST /clients');
  }
});

/** PATCH /api/clients/:id - 更新客戶資料 */
router.patch('/clients/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const fields = ['company_name','industry','company_size','website','bd_status','bd_source',
      'contact_name','contact_title','contact_email','contact_phone','contact_linkedin',
      'consultant','contract_type','fee_percentage','contract_start','contract_end','notes',
      'url_104','url_1111','submission_rules'];
    const result = await withClient(async (db) => {
      const cur = await db.query('SELECT * FROM clients WHERE id = $1', [id]);
      if (!cur.rows.length) { res.status(404).json({ success: false, error: 'Client not found' }); return null; }
      const existing = cur.rows[0];
      const values = fields.map(f => req.body[f] !== undefined ? req.body[f] : existing[f]);
      return db.query(
        `UPDATE clients SET ${fields.map((f, i) => `${f} = $${i + 1}`).join(', ')}, updated_at = NOW()
         WHERE id = $${fields.length + 1} RETURNING *`,
        [...values, id]
      );
    });
    if (!result) return; // 404 already sent
    res.json({ success: true, data: result.rows[0], message: '客戶資料已更新' });
  } catch (error) {
    safeError(res, error, 'PATCH /clients/:id');
  }
});

/**
 * PATCH /api/clients/:id/status
 * 專用：更新 BD 狀態（AIbot 可呼叫）
 * Body: { bd_status, actor }
 * 當狀態轉為「合作中」時，回應包含 prompt_add_job: true
 */
router.patch('/clients/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { bd_status, actor } = req.body;
    if (!bd_status) return res.status(400).json({ success: false, error: '缺少 bd_status' });
    if (!BD_STATUSES.includes(bd_status)) {
      return res.status(400).json({ success: false, error: `無效狀態，允許值：${BD_STATUSES.join('、')}` });
    }
    const { result: statusResult, oldStatus, companyName } = await withClient(async (db) => {
      const cur = await db.query('SELECT * FROM clients WHERE id = $1', [id]);
      if (!cur.rows.length) { res.status(404).json({ success: false, error: 'Client not found' }); return { result: null }; }
      const oldSt = cur.rows[0].bd_status;
      const r = await db.query(
        'UPDATE clients SET bd_status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [bd_status, id]
      );
      // 寫入 system_logs
      await db.query(
        `INSERT INTO system_logs (action, actor, actor_type, candidate_id, candidate_name, detail)
         VALUES ('BD_STATUS_CHANGE', $1, 'AIBOT', $2, $3, $4)`,
        [actor || 'system', id, cur.rows[0].company_name, JSON.stringify({ field: 'bd_status', old: oldSt, new: bd_status })]
      ).catch(() => {});
      return { result: r, oldStatus: oldSt, companyName: cur.rows[0].company_name };
    });
    if (!statusResult) return; // 404 already sent
    res.json({
      success: true,
      data: statusResult.rows[0],
      message: `BD 狀態已從「${oldStatus}」更新為「${bd_status}」`,
      changed: { from: oldStatus, to: bd_status },
      prompt_add_job: bd_status === '合作中' && oldStatus !== '合作中'
    });
  } catch (error) {
    safeError(res, error, 'PATCH /clients/:id/status');
  }
});

/** GET /api/clients/:id/jobs - 該客戶的所有職缺 */
router.get('/clients/:id/jobs', async (req, res) => {
  try {
    const result = await withClient(db => db.query(
      'SELECT * FROM jobs_pipeline WHERE client_id = $1 ORDER BY created_at DESC',
      [req.params.id]
    ));
    res.json({ success: true, data: result.rows });
  } catch (error) {
    safeError(res, error, 'GET /clients/:id/jobs');
  }
});

/** GET /api/clients/:id/contacts - 聯絡記錄 */
router.get('/clients/:id/contacts', async (req, res) => {
  try {
    const result = await withClient(db => db.query(
      'SELECT * FROM bd_contacts WHERE client_id = $1 ORDER BY contact_date DESC',
      [req.params.id]
    ));
    res.json({ success: true, data: result.rows });
  } catch (error) {
    safeError(res, error, 'GET /clients/:id/contacts');
  }
});

/** DELETE /api/clients/:id - 刪除客戶 */
router.delete('/clients/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const clientName = await withClient(async (db) => {
      const cur = await db.query('SELECT * FROM clients WHERE id = $1', [id]);
      if (!cur.rows.length) { res.status(404).json({ success: false, error: 'Client not found' }); return null; }
      const name = cur.rows[0].company_name;
      // 先刪除關聯的聯絡記錄
      await db.query('DELETE FROM bd_contacts WHERE client_id = $1', [id]);
      // 刪除客戶
      await db.query('DELETE FROM clients WHERE id = $1', [id]);
      // 寫入 system_logs
      await db.query(
        `INSERT INTO system_logs (action, actor, actor_type, candidate_id, candidate_name, detail)
         VALUES ('CLIENT_DELETED', $1, 'USER', $2, $3, $4)`,
        [req.body.actor || 'system', id, name, JSON.stringify({ company_name: name })]
      ).catch(() => {});
      return name;
    });
    if (!clientName) return; // 404 already sent
    res.json({ success: true, message: `客戶「${clientName}」已刪除` });
  } catch (error) {
    safeError(res, error, 'DELETE /clients/:id');
  }
});

/** POST /api/clients/:id/contacts - 新增聯絡記錄 */
router.post('/clients/:id/contacts', async (req, res) => {
  try {
    const { contact_date, contact_type, summary, next_action, next_action_date, by_user } = req.body;
    if (!contact_date) return res.status(400).json({ success: false, error: '缺少 contact_date' });
    const result = await withClient(db => db.query(
      `INSERT INTO bd_contacts (client_id, contact_date, contact_type, summary, next_action, next_action_date, by_user)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.params.id, contact_date, contact_type, summary, next_action, next_action_date, by_user]
    ));
    res.json({ success: true, data: result.rows[0], message: '聯絡記錄已新增' });
  } catch (error) {
    safeError(res, error, 'POST /clients/:id/contacts');
  }
});

// ==================== 客戶送件規範 ====================

/** GET /api/clients/:id/submission-rules - 取得客戶送件規範 */
router.get('/clients/:id/submission-rules', async (req, res) => {
  try {
    const result = await withClient(db => db.query('SELECT submission_rules FROM clients WHERE id = $1', [req.params.id]));
    if (!result.rows.length) return res.status(404).json({ success: false, error: 'Client not found' });
    res.json({ success: true, data: result.rows[0].submission_rules || [] });
  } catch (error) {
    safeError(res, error, 'GET /clients/:id/submission-rules');
  }
});

/** PUT /api/clients/:id/submission-rules - 更新客戶送件規範 */
router.put('/clients/:id/submission-rules', async (req, res) => {
  try {
    const { rules } = req.body;
    if (!Array.isArray(rules)) return res.status(400).json({ success: false, error: '缺少 rules 陣列' });
    const result = await withClient(db => db.query(
      'UPDATE clients SET submission_rules = $1, updated_at = NOW() WHERE id = $2 RETURNING submission_rules',
      [JSON.stringify(rules), req.params.id]
    ));
    if (!result.rows.length) return res.status(404).json({ success: false, error: 'Client not found' });
    res.json({ success: true, data: result.rows[0].submission_rules, message: '送件規範已更新' });
  } catch (error) {
    safeError(res, error, 'PUT /clients/:id/submission-rules');
  }
});

/** POST /api/candidates/:candidateId/check-submission-rules - 候選人送件規範檢查 */
router.post('/candidates/:id/check-submission-rules', async (req, res) => {
  try {
    const { client_id } = req.body;
    if (!client_id) return res.status(400).json({ success: false, error: '缺少 client_id' });
    const dbResult = await withClient(async (db) => {
      const candResult = await db.query('SELECT * FROM candidates_pipeline WHERE id = $1', [req.params.id]);
      if (!candResult.rows.length) { res.status(404).json({ success: false, error: 'Candidate not found' }); return null; }
      const clientResult = await db.query('SELECT submission_rules, company_name FROM clients WHERE id = $1', [client_id]);
      if (!clientResult.rows.length) { res.status(404).json({ success: false, error: 'Client not found' }); return null; }
      return { candResult, clientResult };
    });
    if (!dbResult) return; // 404 already sent
    const { candResult, clientResult } = dbResult;

    const candidate = candResult.rows[0];
    const rules = clientResult.rows[0].submission_rules || [];
    const company_name = clientResult.rows[0].company_name;

    const results = rules.filter(r => r.enabled).map(rule => {
      if (!rule.is_auto_checkable) {
        return { rule_id: rule.id, label: rule.label, passed: null, message: '需人工確認', type: 'manual' };
      }
      let passed = true;
      let message = '';
      switch (rule.rule_type) {
        case 'field_required':
          passed = !!candidate[rule.field_key] && String(candidate[rule.field_key]).trim() !== '';
          message = passed ? '已填寫' : '尚未填寫';
          break;
        case 'content_format':
          if (rule.check_config?.format === 'chinese_name') {
            passed = /[\u4e00-\u9fff]/.test(candidate.name || '');
            message = passed ? '已使用中文姓名' : '姓名未包含中文';
          }
          break;
        case 'link_required': {
          const linkField = rule.check_config?.link_type || rule.field_key;
          passed = !!candidate[linkField] && String(candidate[linkField]).trim() !== '';
          message = passed ? '已提供連結' : '尚未提供';
          break;
        }
        case 'resume_version':
          return { rule_id: rule.id, label: rule.label, passed: null, message: '需確認是否已生成', type: 'manual' };
        default:
          return { rule_id: rule.id, label: rule.label, passed: null, message: '需人工確認', type: 'manual' };
      }
      return { rule_id: rule.id, label: rule.label, passed, message, type: 'auto' };
    });

    const failCount = results.filter(r => r.passed === false).length;
    res.json({ success: true, data: { company_name, results, failCount, totalChecked: results.length } });
  } catch (error) {
    safeError(res, error, 'POST /candidates/:id/check-submission-rules');
  }
});

// ==================== REMOVED: Bot 排程設定 ====================
// Bot Scheduler 功能已移除（UI+設定已建，實際排程引擎未串接）
// 相關 API endpoints（bot-config, bot-configs, bot/run-now, bot/run-log, bot-logs）已一併移除
// bot_config 資料表遷移也已移除

/* --- 以下為移除前的 endpoint 列表（僅供參考） ---
 * GET  /api/bot-config       — 取得指定顧問 Bot 設定
 * GET  /api/bot-configs      — 取得所有顧問設定
 * POST /api/bot-config       — 儲存顧問 Bot 設定
 * POST /api/bot/run-now      — 手動觸發 Bot 執行
 * GET  /api/bot/run-log      — 取得 Bot Python stdout/stderr
 * GET  /api/bot-logs         — 取得 Bot 執行紀錄
 * -------------------------------------------------------*/

// [REMOVED 2026-03-16] POST /api/migrate/fix-ai-match-result — 已廢棄（一次性 migration 工具，已執行完畢）


// ==================== GitHub 分析 API ====================
const githubAnalysis = require('./githubAnalysisService');

/**
 * GET /api/github/analyze/:username
 * 完整 GitHub 分析（v2 支援 ?jobId= 查詢參數）
 */
router.get('/github/analyze/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const { jobId } = req.query;

    // 如果有 jobId，取得職缺技能做連動分析
    let options = {};
    if (jobId) {
      const jobResult = await pool.query(
        'SELECT key_skills, talent_profile FROM jobs_pipeline WHERE id = $1',
        [jobId]
      );
      if (jobResult.rows.length > 0) {
        const job = jobResult.rows[0];
        options = { keySkills: job.key_skills, talentProfile: job.talent_profile };
      }
    }

    // 優先使用 v2 分析
    const result = await githubAnalysis.analyzeGithubProfileV2(`https://github.com/${username}`, options);

    if (!result.success) {
      return res.status(404).json({ success: false, error: result.error });
    }

    res.json({ success: true, data: result });
  } catch (error) {
    safeError(res, error, 'GET /github/analyze/:username');
  }
});

// ============================================================
// 職缺匹配推薦 v2：5 維度評分 + 中英文同義詞 + 快取
// ============================================================

// ── v3 Job Ranking: 7-dimension scoring with unified taxonomy ──
const { matchSkills: unifiedMatchSkills, normalizeSkillsArray: unifiedNormalizeSkills } = require('./taxonomy/matchSkills');

/** 解析 work_history JSONB（可能是字串或陣列）*/
function parseWorkHistory(wh) {
  if (!wh) return [];
  if (Array.isArray(wh)) return wh;
  if (typeof wh === 'string') { try { const p = JSON.parse(wh); return Array.isArray(p) ? p : []; } catch { return []; } }
  return [];
}

/** 從 experience_required 文字提取年資數字 */
function parseExperienceRequired(text) {
  if (!text) return 0;
  const rangeMatch = text.match(/(\d+)\s*[-~～至到]\s*(\d+)/);
  if (rangeMatch) return (parseInt(rangeMatch[1]) + parseInt(rangeMatch[2])) / 2;
  const singleMatch = text.match(/(\d+)/);
  return singleMatch ? parseInt(singleMatch[1]) : 0;
}

/** 解析薪資範圍文字 → { min, max } */
function parseSalaryRange(text) {
  if (!text) return { min: 0, max: 0 };
  const rangeMatch = text.match(/(\d[\d,]*)\s*[-~至到]\s*(\d[\d,]*)/);
  if (rangeMatch) return { min: parseInt(rangeMatch[1].replace(/,/g, '')), max: parseInt(rangeMatch[2].replace(/,/g, '')) };
  const kMatch = text.match(/(\d+)\s*[kK]/);
  if (kMatch) { const v = parseInt(kMatch[1]) * 1000; return { min: v, max: v }; }
  const numMatch = text.match(/(\d[\d,]+)/);
  if (numMatch) { const v = parseInt(numMatch[1].replace(/,/g, '')); return { min: v, max: v }; }
  return { min: 0, max: 0 };
}

/** D1: Role + Skill 匹配分 (35%) — 使用 unified taxonomy */
function calcSkillScoreV3(cand, job) {
  // Prefer normalized_skills, fallback to raw skills
  const candidateSkills = cand.normalized_skills || cand.skills || [];
  const rawJobSkills = [job.key_skills, job.special_conditions].filter(Boolean).join(',');

  const result = unifiedMatchSkills(candidateSkills, rawJobSkills);

  // Bio fallback: check if any missing skills appear in bio text
  const candidateBio = (cand.bio || '').toLowerCase();
  const bioRecovered = [];
  if (candidateBio && result.missingSkills.length > 0) {
    for (const skill of result.missingSkills) {
      if (candidateBio.includes(skill.toLowerCase())) {
        bioRecovered.push(skill);
      }
    }
  }

  const totalMatched = [...result.matchedSkills, ...bioRecovered];
  const totalRequired = result.matchedSkills.length + result.missingSkills.length;
  const score = totalRequired > 0 ? Math.round((totalMatched.length / totalRequired) * 100) : 50;

  // Role family bonus: if candidate's role_family matches job title keywords
  let roleBonus = 0;
  const candRole = (cand.canonical_role || cand.role_family || '').toLowerCase();
  const jobTitle = (job.position_name || '').toLowerCase();
  if (candRole && jobTitle && (jobTitle.includes(candRole) || candRole.includes(jobTitle.split(' ')[0]))) {
    roleBonus = 10;
  }

  return {
    score: Math.min(100, score + roleBonus),
    matched: totalMatched.slice(0, 10),
    missing: result.missingSkills.filter(s => !bioRecovered.includes(s)).slice(0, 10),
    requiredCount: totalRequired,
  };
}

/** D2: 年資匹配分 (15%) */
function calcExperienceScoreV3(cand, job) {
  const candYears = parseFloat(cand.total_years || cand.years_experience) || 0;
  const reqYears = parseExperienceRequired(job.experience_required);
  if (reqYears === 0) return 60;
  if (candYears === 0) return 40;
  const ratio = candYears / reqYears;
  if (ratio >= 1.5) return 90;
  if (ratio >= 1.0) return 100;
  if (ratio >= 0.7) return 70;
  if (ratio >= 0.5) return 50;
  return 30;
}

/** D3: 薪資匹配分 (15%) — 新增維度 */
function calcSalaryScoreV3(cand, job) {
  // Candidate expected salary
  const candMin = parseInt(cand.expected_salary_min) || 0;
  const candMax = parseInt(cand.expected_salary_max) || 0;
  if (candMin === 0 && candMax === 0) return 50; // no data → neutral

  // Job salary range
  const jobSalary = parseSalaryRange(job.salary_range);
  if (jobSalary.min === 0 && jobSalary.max === 0) return 60; // no job salary data

  // Normalize to same period if needed (assume both monthly for now)
  const candMid = candMax > 0 ? (candMin + candMax) / 2 : candMin;
  const jobMid = jobSalary.max > 0 ? (jobSalary.min + jobSalary.max) / 2 : jobSalary.min;

  if (jobMid === 0) return 60;
  const ratio = candMid / jobMid;

  // Perfect overlap or candidate below budget → high score
  if (ratio <= 1.0) return 100;
  if (ratio <= 1.1) return 85; // slightly above budget
  if (ratio <= 1.2) return 65;
  if (ratio <= 1.3) return 45;
  return 25; // way over budget
}

/** D4: 產業匹配分 (10%) */
function calcIndustryScoreV3(cand, job) {
  // Prefer structured industry_tag
  const candIndustry = (cand.industry_tag || cand.industry || '').toLowerCase();
  const jobIndustry = (job.industry_background || '').toLowerCase();
  const jobTitle = (job.position_name || '').toLowerCase();

  let score = 40;

  // Direct industry match
  if (candIndustry && jobIndustry) {
    const industryKeywords = jobIndustry.split(/[,、;；\/\s]/).filter(s => s.length > 1);
    const industryHits = industryKeywords.filter(k => candIndustry.includes(k));
    if (industryHits.length > 0) score += 30;
  }

  // Work history text matching
  const workHistory = parseWorkHistory(cand.work_history);
  if (workHistory.length > 0) {
    const historyText = workHistory.map(w =>
      [w.title, w.company, w.description].filter(Boolean).join(' ')
    ).join(' ').toLowerCase();

    if (jobIndustry) {
      const industryKeywords = jobIndustry.split(/[,、;；\/\s]/).filter(s => s.length > 1);
      const hits = industryKeywords.filter(k => historyText.includes(k));
      if (hits.length > 0) score += Math.min(20, hits.length * 10);
    }
    if (jobTitle) {
      const titleKeywords = jobTitle.split(/[\s\/,、]/).filter(s => s.length > 1);
      const hits = titleKeywords.filter(k => workHistory.some(w => (w.title || '').toLowerCase().includes(k)));
      if (hits.length > 0) score += Math.min(10, hits.length * 5);
    }
  }

  return Math.min(100, score);
}

/** D5: 到職+求職狀態 (10%) — 新增維度 */
function calcAvailabilityScoreV3(cand) {
  let score = 50;

  // Job search status
  const status = cand.job_search_status_enum || cand.job_search_status || '';
  if (/active|主動|積極/.test(status)) score += 30;
  else if (/passive|被動|觀望/.test(status)) score += 15;
  else if (/not.?open|暫不|不考慮/.test(status)) score -= 20;

  // Notice period
  const notice = cand.notice_period_enum || cand.notice_period || '';
  if (/immediate|即刻|立即|隨時/.test(notice)) score += 20;
  else if (/2weeks|兩週/.test(notice)) score += 15;
  else if (/1month|一個月/.test(notice)) score += 10;
  else if (/2months|兩個月/.test(notice)) score += 0;
  else if (/3months|三個月/.test(notice)) score -= 10;

  return Math.max(0, Math.min(100, score));
}

/** D6: 熱度+等級 (10%) — 新增維度 */
function calcGradeHeatScoreV3(cand) {
  let score = 40;

  // Grade level
  const grade = (cand.grade_level || '').toUpperCase();
  if (grade === 'A') score += 30;
  else if (grade === 'B') score += 15;
  else if (grade === 'C') score += 0;
  else if (grade === 'D') score -= 10;

  // Heat level
  const heat = (cand.heat_level || '').toLowerCase();
  if (heat === 'hot') score += 30;
  else if (heat === 'warm') score += 15;
  else if (heat === 'cold') score += 0;

  return Math.max(0, Math.min(100, score));
}

/** D7: 資料完整度 (5%) */
function calcDataQualityScoreV3(cand) {
  // If we have precomputed data_quality, use it
  let dq = cand.data_quality;
  if (typeof dq === 'string') { try { dq = JSON.parse(dq); } catch { dq = null; } }
  if (dq && typeof dq.completenessScore === 'number') return dq.completenessScore;

  // Fallback: compute on the fly
  let score = 30;
  if (cand.normalized_skills || (cand.skills && cand.skills.length > 0)) score += 15;
  if (parseWorkHistory(cand.work_history).length > 0) score += 15;
  if (cand.education) score += 10;
  if (cand.total_years || cand.years_experience) score += 10;
  if (cand.linkedin_url) score += 10;
  if (cand.github_url) score += 5;
  if (cand.role_family) score += 5;
  return Math.min(100, score);
}

/**
 * v3 綜合評分：7 維度加權
 * D1: Role + Skill (35%), D2: Experience (15%), D3: Salary (15%),
 * D4: Industry (10%), D5: Availability (10%), D6: Grade+Heat (10%), D7: Data Quality (5%)
 */
function rankAgainstJobV3(cand, job) {
  const skill = calcSkillScoreV3(cand, job);
  const experienceScore = calcExperienceScoreV3(cand, job);
  const salaryScore = calcSalaryScoreV3(cand, job);
  const industryScore = calcIndustryScoreV3(cand, job);
  const availabilityScore = calcAvailabilityScoreV3(cand);
  const gradeHeatScore = calcGradeHeatScoreV3(cand);
  const dataQualityScore = calcDataQualityScoreV3(cand);

  const totalScore = Math.round(
    skill.score * 0.35 +
    experienceScore * 0.15 +
    salaryScore * 0.15 +
    industryScore * 0.10 +
    availabilityScore * 0.10 +
    gradeHeatScore * 0.10 +
    dataQualityScore * 0.05
  );

  let recommendation;
  if (totalScore >= 80) recommendation = '強力推薦';
  else if (totalScore >= 65) recommendation = '推薦';
  else if (totalScore >= 50) recommendation = '觀望';
  else recommendation = '不推薦';

  return {
    job_id: job.id,
    job_title: job.position_name,
    company: job.client_company || '',
    department: job.department || '',
    salary_range: job.salary_range || '',
    job_status: job.job_status || '',
    match_score: totalScore,
    skill_score: skill.score,
    experience_score: experienceScore,
    salary_score: salaryScore,
    industry_score: industryScore,
    availability_score: availabilityScore,
    grade_heat_score: gradeHeatScore,
    data_quality_score: dataQualityScore,
    matched_skills: skill.matched,
    missing_skills: skill.missing,
    required_skills_count: skill.requiredCount,
    recommendation,
  };
}

/**
 * GET /api/candidates/:id/job-rankings
 * v3：7 維度評分（Role+Skill/Exp/Salary/Industry/Availability/Grade+Heat/DataQuality）
 * 使用 unified taxonomy (matchSkills.js) + Top 5 + 快取
 * 支援 ?force=1 強制重算
 */
router.get('/candidates/:id/job-rankings', async (req, res) => {
  try {
    const { id } = req.params;
    const candidateId = parseInt(id);
    const forceRecalc = req.query.force === '1' || req.query.force === 'true';

    // ── P3 修復：Advisory lock 防雷擊群效應 ──
    // 多人同時查同一人選排名時，只有搶到鎖的 request 會計算，
    // 其他 request 等短暫時間後讀快取結果。

    // 1. 檢查快取（除非強制重算）
    if (!forceRecalc) {
      try {
        const cacheRes = await pool.query(
          'SELECT rankings, computed_at FROM candidate_job_rankings_cache WHERE candidate_id = $1',
          [candidateId]
        );
        if (cacheRes.rows.length > 0) {
          const cached = cacheRes.rows[0];
          return res.json({
            candidate_id: id,
            total_jobs: cached.rankings.length,
            rankings: cached.rankings,
            cached: true,
            computed_at: cached.computed_at,
          });
        }
      } catch (cacheErr) {
        console.warn('Cache read failed, will recalculate:', cacheErr.message);
      }
    }

    // 2. Advisory lock：嘗試搶鎖（key = candidateId），避免多 request 同時計算
    //    使用 session-level lock，在 client.release() 時自動釋放
    const client = await pool.connect();
    try {
      const lockRes = await client.query('SELECT pg_try_advisory_lock($1) AS locked', [candidateId]);
      const gotLock = lockRes.rows[0].locked;

      if (!gotLock) {
        // 沒搶到鎖 = 別人正在計算 → 等一下再查快取
        client.release();
        await new Promise(resolve => setTimeout(resolve, 300));
        const cacheRetry = await pool.query(
          'SELECT rankings, computed_at FROM candidate_job_rankings_cache WHERE candidate_id = $1',
          [candidateId]
        );
        if (cacheRetry.rows.length > 0) {
          const cached = cacheRetry.rows[0];
          return res.json({
            candidate_id: id,
            total_jobs: cached.rankings.length,
            rankings: cached.rankings,
            cached: true,
            computed_at: cached.computed_at,
          });
        }
        // 快取還沒寫入，仍然自己算（fallback）
      }

      // 3. 搶到鎖（或 fallback），開始計算
      const candRes = await pool.query(
        `SELECT id, name, skills, normalized_skills, notes AS bio, source,
                work_history, education, education_details,
                years_experience, total_years, location, current_position,
                current_title, role_family, canonical_role, industry_tag, industry,
                expected_salary_min, expected_salary_max, salary_currency, salary_period,
                notice_period_enum, notice_period, job_search_status_enum, job_search_status,
                grade_level, heat_level, data_quality,
                linkedin_url, github_url
         FROM candidates_pipeline WHERE id = $1`,
        [candidateId]
      );
      if (candRes.rows.length === 0) return res.status(404).json({ error: '候選人不存在' });
      const candidate = candRes.rows[0];
      // Prefer normalized_skills, fallback to parsing raw skills
      if (!candidate.normalized_skills) {
        candidate.normalized_skills = unifiedNormalizeSkills(candidate.skills);
      } else if (typeof candidate.normalized_skills === 'string') {
        try { candidate.normalized_skills = JSON.parse(candidate.normalized_skills); } catch { candidate.normalized_skills = []; }
      }

      // 4. 抓所有非關閉職缺
      const jobsRes = await pool.query(
        `SELECT id, position_name, client_company, department,
                key_skills, experience_required, special_conditions,
                salary_range, job_status,
                industry_background, education_required, language_required, location
         FROM jobs_pipeline
         WHERE job_status IS NULL OR job_status != '已關閉'
         ORDER BY created_at DESC LIMIT 200`
      );

      // 5. 對每個職缺做 7 維度評分，排序取 Top 5
      const allRankings = jobsRes.rows
        .map(job => rankAgainstJobV3(candidate, job))
        .sort((a, b) => b.match_score - a.match_score);

      const top5 = allRankings.slice(0, 5);

      // 6. 存入快取
      try {
        await pool.query(
          `INSERT INTO candidate_job_rankings_cache (candidate_id, rankings, computed_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (candidate_id) DO UPDATE SET rankings = $2, computed_at = NOW()`,
          [candidateId, JSON.stringify(top5)]
        );
      } catch (cacheErr) {
        console.warn('Cache write failed:', cacheErr.message);
      }

      // 7. 釋放 advisory lock
      if (gotLock) {
        await client.query('SELECT pg_advisory_unlock($1)', [candidateId]).catch(() => {});
      }

      res.json({
        candidate_id: id,
        candidate_name: candidate.name,
        total_jobs: top5.length,
        rankings: top5,
        cached: false,
      });
    } finally {
      client.release();
    }
  } catch (error) {
    safeError(res, error, 'GET /candidates/:id/job-rankings');
  }
});

/**
 * GET /api/candidates/:id/github-stats
 * 獲取候選人的 GitHub 快速統計 v2（支援 ?jobId= 查詢參數 + DB 快取）
 */
router.get('/candidates/:id/github-stats', async (req, res) => {
  try {
    const { id } = req.params;
    const { jobId } = req.query;

    // 從數據庫獲取候選人的 GitHub URL 和快取
    const result = await pool.query(
      'SELECT github_url, github_analysis_cache FROM candidates_pipeline WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: '候選人不存在' });
    }

    const { github_url: githubUrl, github_analysis_cache: cache } = result.rows[0];

    if (!githubUrl || !githubUrl.trim()) {
      return res.json({ success: true, data: null }); // 無 GitHub 連結
    }

    // 檢查快取是否有效（24 小時 TTL + 相同 jobId）
    if (cache && cache.analyzedAt) {
      const cacheAge = Date.now() - new Date(cache.analyzedAt).getTime();
      const cacheFresh = cacheAge < 24 * 60 * 60 * 1000; // 24 小時
      const sameJob = !jobId || String(cache.jobId) === String(jobId);
      if (cacheFresh && sameJob) {
        return res.json({ success: true, data: cache, cached: true });
      }
    }

    // 快取過期或 jobId 不同，重新分析
    let options = {};
    if (jobId) {
      const jobResult = await pool.query(
        'SELECT key_skills, talent_profile FROM jobs_pipeline WHERE id = $1',
        [jobId]
      );
      if (jobResult.rows.length > 0) {
        const job = jobResult.rows[0];
        options = { keySkills: job.key_skills, talentProfile: job.talent_profile };
      }
    }

    const stats = await githubAnalysis.getGithubQuickStatsV2(githubUrl, options);

    // 寫入快取
    if (stats) {
      const cacheData = { ...stats, jobId: jobId || null, analyzedAt: new Date().toISOString() };
      await pool.query(
        'UPDATE candidates_pipeline SET github_analysis_cache = $1 WHERE id = $2',
        [JSON.stringify(cacheData), id]
      ).catch(err => console.warn('Failed to cache github stats:', err.message));
    }

    res.json({ success: true, data: stats });
  } catch (error) {
    safeError(res, error, 'GET /candidates/:id/github-stats');
  }
});

/**
 * POST /api/github/ai-analyze
 * 透過 OpenClaw 本地 AI 做 GitHub 深度分析
 * 接收 { candidateId, jobId }，呼叫 OpenClaw API 做 AI 判斷
 */
router.post('/github/ai-analyze', async (req, res) => {
  try {
    const { candidateId, jobId } = req.body;
    if (!candidateId) {
      return res.status(400).json({ success: false, error: '缺少 candidateId' });
    }

    // 1. 取得候選人 GitHub URL
    const candResult = await pool.query(
      'SELECT name, github_url, skills, notes, biography, portfolio_url, voice_assessments FROM candidates_pipeline WHERE id = $1',
      [candidateId]
    );
    if (candResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: '候選人不存在' });
    }
    const candidate = candResult.rows[0];
    if (!candidate.github_url) {
      return res.status(400).json({ success: false, error: '候選人無 GitHub URL' });
    }

    // 2. 取得 GitHub v2 結構化分析
    let jobOptions = {};
    let jobData = null;
    if (jobId) {
      const jobResult = await pool.query(
        'SELECT position_name, key_skills, talent_profile, company_profile, job_description, client_company FROM jobs_pipeline WHERE id = $1',
        [jobId]
      );
      if (jobResult.rows.length > 0) {
        jobData = jobResult.rows[0];
        jobOptions = { keySkills: jobData.key_skills, talentProfile: jobData.talent_profile };
      }
    }

    const githubData = await githubAnalysis.analyzeGithubProfileV2(candidate.github_url, jobOptions);
    if (!githubData.success) {
      return res.status(400).json({ success: false, error: `GitHub 分析失敗: ${githubData.error}` });
    }

    // 3. 組成 prompt 呼叫 OpenClaw
    const openclawUrl = process.env.OPENCLAW_API_URL || 'http://127.0.0.1:18789';
    const openclawModel = process.env.OPENCLAW_MODEL || 'default';

    const prompt = buildGithubAnalysisPrompt(candidate, githubData, jobData);

    const aiResponse = await callOpenClawAPI(openclawUrl, openclawModel, prompt);

    res.json({
      success: true,
      candidateId,
      candidateName: candidate.name,
      githubAnalysis: githubData,
      aiAnalysis: aiResponse,
      jobId: jobId || null
    });
  } catch (error) {
    safeError(res, error, 'POST /github/ai-analyze');
  }
});

/**
 * 組建 GitHub 分析 prompt（給 OpenClaw / AI）
 */
function buildGithubAnalysisPrompt(candidate, githubData, jobData) {
  const jobSection = jobData ? `
## 目標職缺
- 職位：${jobData.position_name || '未知'}（${jobData.client_company || '未知'}）
- 必要技能：${jobData.key_skills || '未提供'}
- 人才畫像：${jobData.talent_profile || '未提供'}
- 企業畫像：${jobData.company_profile || '未提供'}
- JD：${(jobData.job_description || '未提供').substring(0, 500)}
` : '（無指定職缺，請做通用評估）';

  // 組建深度資訊區段（自傳/作品集/語音評估）
  let depthSection = '';
  if (candidate.biography || candidate.portfolio_url || (candidate.voice_assessments && candidate.voice_assessments.length > 0)) {
    depthSection = '\n## 候選人深度資訊（顧問提供）\n';
    if (candidate.biography) {
      depthSection += `### 自傳\n${candidate.biography.substring(0, 800)}\n\n`;
    }
    if (candidate.portfolio_url) {
      depthSection += `### 作品集\n- 連結：${candidate.portfolio_url}\n\n`;
    }
    if (candidate.voice_assessments && Array.isArray(candidate.voice_assessments) && candidate.voice_assessments.length > 0) {
      const latest = candidate.voice_assessments[candidate.voice_assessments.length - 1];
      depthSection += `### 顧問語音面談評估\n- 評分：${latest.score}/5\n- 面談者：${latest.interviewer || '未知'}\n- 評語：${latest.notes || '無'}\n\n`;
    }
  }

  return `你是一位資深獵頭 AI，請分析以下 GitHub 候選人，判斷其技術能力與職缺適配度。

## 候選人
- 姓名：${candidate.name}
- GitHub：${githubData.profileUrl}
- Bio：${githubData.bio || '無'}
- 公司：${githubData.company || '未知'}
- 地點：${githubData.location || '未知'}
- 現有技能標記：${Array.isArray(candidate.skills) ? candidate.skills.join(', ') : candidate.skills || '無'}
- 作品集：${candidate.portfolio_url || '無'}

## GitHub 結構化分析（系統自動計算）
### 技能匹配（權重 40%）— 初步分數：${githubData.skillMatch.score}/100
- 匹配技能：${githubData.skillMatch.matchedSkills.join(', ') || '無'}
- 缺少技能：${githubData.skillMatch.missingSkills.join(', ') || '無'}
- 候選人技術信號：${githubData.skillMatch.candidateSignals.join(', ')}

### 專案品質（權重 30%）— 初步分數：${githubData.projectQuality.score}/100
- 原創 repo：${githubData.projectQuality.originalCount} 個
- Fork repo：${githubData.projectQuality.forkCount} 個
- 總 star 數：${githubData.projectQuality.totalStars}
- 最高 star 專案：${githubData.projectQuality.maxStarRepo ? `${githubData.projectQuality.maxStarRepo.name} (${githubData.projectQuality.maxStarRepo.stars} stars, ${githubData.projectQuality.maxStarRepo.language})` : '無'}

### 活躍度（權重 20%）— 初步分數：${githubData.activity.score}/100
- 最後 commit：${githubData.activity.daysSinceLastCommit} 天前
- 最近 6 個月活躍月數：${githubData.activity.activeMonths}/6
- 狀態：${githubData.activity.statusText}

### 影響力（權重 10%）— 初步分數：${githubData.influence.score}/100
- Followers：${githubData.influence.followers}
- 總 Stars：${githubData.influence.totalStars}
- 公開 Repos：${githubData.influence.publicRepos}

### 語言分布
${githubData.languages.map(l => `- ${l.name}: ${l.percentage}%`).join('\n')}

### 系統初步加權總分：${githubData.totalScore}/100（${githubData.stars} 星）

${jobSection}
${depthSection}
## 請你做的事：
1. 根據以上資料，用你的 AI 判斷力做 4 維度深度分析（不要只看初步分數）
2. 特別注意 repo 名稱/描述是否暗示相關經驗（例如 "payment-gateway" 對 fintech 有加分）
3. 若有自傳，分析其職涯動機是否與目標職缺吻合，並從中提取軟實力信號
4. 若有作品集，評估作品與職缺的相關性
5. 若有顧問語音面談評估，將其評分和評語納入整體建議
6. 給出最終 4 維度分數和加權總分（0-100）
7. 給出評級（S/A+/A/B/C）
8. 寫出優勢、風險、顧問建議

請用以下 JSON 格式回覆：
{
  "finalScore": 數字,
  "grade": "S|A+|A|B|C",
  "dimensions": {
    "skillMatch": { "score": 數字, "comment": "說明" },
    "projectQuality": { "score": 數字, "comment": "說明" },
    "activity": { "score": 數字, "comment": "說明" },
    "influence": { "score": 數字, "comment": "說明" }
  },
  "strengths": ["優勢1", "優勢2"],
  "risks": ["風險1", "風險2"],
  "consultantAdvice": "一句話顧問建議",
  "recommendation": "強力推薦|推薦|觀望|不推薦",
  "biographyInsight": "從自傳提取的洞察（若無自傳則設為 null）",
  "portfolioRelevance": "作品集與職缺的相關性評估（若無作品集則設為 null）",
  "voiceSummary": "語音面談評估摘要（若無評估則設為 null）"
}`;
}

/**
 * 呼叫 OpenClaw API（OpenAI-compatible /v1/chat/completions）
 */
async function callOpenClawAPI(baseUrl, model, prompt) {
  return new Promise((resolve, reject) => {
    const url = new URL('/v1/chat/completions', baseUrl);
    const postData = JSON.stringify({
      model: model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 2000
    });

    const protocol = url.protocol === 'https:' ? require('https') : require('http');
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = protocol.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.message?.content || data;
          // 嘗試解析 AI 回傳的 JSON
          try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              resolve(JSON.parse(jsonMatch[0]));
            } else {
              resolve({ raw: content });
            }
          } catch {
            resolve({ raw: content });
          }
        } catch {
          resolve({ raw: data });
        }
      });
    });

    req.on('error', (err) => {
      console.warn('OpenClaw API call failed:', err.message);
      resolve({ error: `OpenClaw 連線失敗: ${err.message}`, hint: '請確認 OpenClaw 是否正在執行' });
    });

    req.setTimeout(60000, () => {
      req.destroy();
      resolve({ error: 'OpenClaw API timeout (60s)' });
    });

    req.write(postData);
    req.end();
  });
}

// ─────────────────────────────────────────────────────────────
// PDF 履歷解析端點
// ─────────────────────────────────────────────────────────────

const { parseResumePDF } = require('./resumePDFService');

/**
 * POST /api/resume/parse
 * 單筆 PDF 解析
 * Body: multipart/form-data  file=<PDF>  useAI=true|false
 */
router.post('/resume/parse', (req, res) => {
  const upload = req.app.locals.upload;
  if (!upload) return res.status(500).json({ success: false, error: 'multer 未初始化' });

  upload.single('file')(req, res, async (err) => {
    if (err) return res.status(400).json({ success: false, error: err.message });
    if (!req.file) return res.status(400).json({ success: false, error: '請上傳 PDF 檔案（欄位名稱：file）' });

    const useAI = req.body.useAI === 'true';
    const format = req.body.format || 'auto';
    try {
      const parsed = await parseResumePDF(req.file.buffer, useAI, format);
      console.log('[/api/resume/parse] format:', format, 'source:', parsed.source, 'workHistory:', parsed.workHistory?.length, 'confidence:', parsed._meta?.confidence);
      res.json({
        success: true,
        filename: req.file.originalname,
        parsed,
      });
    } catch (e) {
      safeError(res, e, 'POST /resume/parse');
    }
  });
});

/**
 * POST /api/resume/parse-url
 * 透過 URL 下載 PDF 並解析履歷
 * Body: { url: string }
 * 支援：直接 PDF 連結、Google Drive 分享連結、Dropbox 分享連結
 */
router.post('/resume/parse-url', async (req, res) => {
  try {
    let { url } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ success: false, error: '請提供有效的 URL' });
    }

    url = url.trim();

    // LinkedIn 不支援直接抓取
    if (/linkedin\.com\/in\//i.test(url)) {
      return res.status(400).json({
        success: false,
        error: 'LinkedIn 不支援直接解析，請下載 LinkedIn PDF 後上傳',
        hint: 'linkedin_unsupported'
      });
    }

    // Google Drive 連結轉直接下載
    const gdMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (gdMatch) {
      url = `https://drive.google.com/uc?export=download&id=${gdMatch[1]}`;
    }

    // Dropbox 連結轉直接下載
    if (url.includes('dropbox.com')) {
      url = url.replace(/dl=0/, 'dl=1');
      if (!url.includes('dl=1')) {
        url += (url.includes('?') ? '&' : '?') + 'dl=1';
      }
    }

    // 下載檔案
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Step1ne-ResumeParser/1.0)',
      },
      redirect: 'follow',
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return res.status(400).json({
        success: false,
        error: `無法下載檔案 (HTTP ${response.status})`,
      });
    }

    const contentType = response.headers.get('content-type') || '';
    const buffer = Buffer.from(await response.arrayBuffer());

    // 驗證是 PDF（檢查 magic bytes 或 content-type）
    const isPDF = contentType.includes('pdf') ||
                  (buffer.length > 4 && buffer.slice(0, 5).toString() === '%PDF-');

    if (!isPDF) {
      return res.status(400).json({
        success: false,
        error: '連結指向的檔案不是 PDF 格式，請提供 PDF 履歷連結',
      });
    }

    // 限制大小 10MB
    if (buffer.length > 10 * 1024 * 1024) {
      return res.status(400).json({
        success: false,
        error: '檔案大小超過 10MB 限制',
      });
    }

    const parsed = await parseResumePDF(buffer, false);
    res.json({
      success: true,
      source_url: req.body.url,
      parsed,
    });
  } catch (e) {
    console.error('[/api/resume/parse-url]', e.message);
    if (e.name === 'AbortError') {
      return res.status(408).json({ success: false, error: '下載超時（30秒），請確認連結有效' });
    }
    res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * POST /api/resume/batch-parse
 * 批量 PDF 解析（最多 20 份）
 * Body: multipart/form-data  files[]=<PDF>...  useAI=true|false
 * 回傳每份 PDF 解析結果 + 比對現有候選人
 */
router.post('/resume/batch-parse', (req, res) => {
  const upload = req.app.locals.upload;
  if (!upload) return res.status(500).json({ success: false, error: 'multer 未初始化' });

  upload.array('files', 20)(req, res, async (err) => {
    if (err) return res.status(400).json({ success: false, error: err.message });
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: '請上傳至少一個 PDF 檔案（欄位名稱：files）' });
    }

    const useAI = req.body.useAI === 'true';
    const results = [];

    for (const file of req.files) {
      try {
        const parsed = await parseResumePDF(file.buffer, useAI);

        // 比對現有候選人
        let existingMatch = null;

        // 1. 優先：LinkedIn URL 精確比對
        if (parsed.linkedinUrl) {
          const urlResult = await pool.query(
            `SELECT id, name FROM candidates_pipeline WHERE linkedin_url ILIKE $1 LIMIT 1`,
            [parsed.linkedinUrl]
          );
          if (urlResult.rows.length > 0) existingMatch = urlResult.rows[0];
        }

        // 2. Fallback：姓名模糊比對
        if (!existingMatch && parsed.name) {
          const nameResult = await pool.query(
            `SELECT id, name FROM candidates_pipeline WHERE name ILIKE $1 LIMIT 1`,
            [`%${parsed.name}%`]
          );
          if (nameResult.rows.length > 0) existingMatch = nameResult.rows[0];
        }

        results.push({
          filename: file.originalname,
          status: 'ok',
          parsed,
          existingMatch,
        });
      } catch (e) {
        console.error(`[/api/resume/batch-parse] ${file.originalname}:`, e.message);
        results.push({
          filename: file.originalname,
          status: 'error',
          error: e.message,
        });
      }
    }

    res.json({
      success: true,
      total: req.files.length,
      results,
    });
  });
});

// ═══════════════════════════════════════════════════
// 履歷 PDF 附件上傳 / 下載 / 刪除
// ═══════════════════════════════════════════════════

/**
 * POST /api/candidates/:id/resume
 * 上傳 PDF 履歷附件（最多 3 個）
 * Body: multipart/form-data  file=<PDF>  uploaded_by=<string>
 */
router.post('/candidates/:id/resume', async (req, res) => {
  const upload = req.app.locals.upload;
  if (!upload) return res.status(500).json({ success: false, error: 'multer 未初始化' });

  upload.single('file')(req, res, async (err) => {
    if (err) return res.status(400).json({ success: false, error: err.message });
    if (!req.file) return res.status(400).json({ success: false, error: '請上傳 PDF 檔案' });

    try {
      const { id } = req.params;

      // 1. 取得現有附件
      const existing = await pool.query(
        'SELECT resume_files FROM candidates_pipeline WHERE id = $1', [id]
      );
      if (existing.rows.length === 0) {
        return res.status(404).json({ success: false, error: '找不到此候選人' });
      }

      const files = existing.rows[0].resume_files || [];

      // 2. 檢查上限 3 個
      if (files.length >= 3) {
        return res.status(400).json({
          success: false,
          error: '每位候選人最多上傳 3 個 PDF 檔案，請先刪除舊檔案'
        });
      }

      // 3. 建立新檔案紀錄
      const newFile = {
        id: `rf_${Date.now()}`,
        filename: req.file.originalname,
        data: req.file.buffer.toString('base64'),
        mimetype: req.file.mimetype,
        size: req.file.size,
        uploaded_at: new Date().toISOString(),
        uploaded_by: req.body.uploaded_by || 'system',
      };

      // 4. 寫入 DB
      const updated = [...files, newFile];
      await pool.query(
        'UPDATE candidates_pipeline SET resume_files = $1, updated_at = NOW() WHERE id = $2',
        [JSON.stringify(updated), id]
      );

      // 5. 回傳 metadata（不含 base64）
      const { data: _data, ...metadata } = newFile;
      res.json({ success: true, file: metadata, total: updated.length });
    } catch (e) {
      safeError(res, e, 'POST /candidates/:id/resume');
    }
  });
});

/**
 * GET /api/candidates/:id/resume/:fileId
 * 下載/預覽 PDF（回傳二進位 PDF）
 * Query: ?download=true → 強制下載
 */
router.get('/candidates/:id/resume/:fileId', async (req, res) => {
  try {
    const { id, fileId } = req.params;

    const result = await pool.query(
      'SELECT resume_files FROM candidates_pipeline WHERE id = $1', [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: '找不到此候選人' });
    }

    const files = result.rows[0].resume_files || [];
    const file = files.find(f => f.id === fileId);
    if (!file) {
      return res.status(404).json({ success: false, error: '找不到此檔案' });
    }

    const buffer = Buffer.from(file.data, 'base64');
    const disposition = req.query.download === 'true'
      ? `attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`
      : `inline; filename*=UTF-8''${encodeURIComponent(file.filename)}`;

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': disposition,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  } catch (e) {
    safeError(res, e, 'GET /candidates/:id/resume/:fileId');
  }
});

/**
 * DELETE /api/candidates/:id/resume/:fileId
 * 刪除單一 PDF 附件
 */
router.delete('/candidates/:id/resume/:fileId', async (req, res) => {
  try {
    const { id, fileId } = req.params;

    const result = await pool.query(
      'SELECT resume_files FROM candidates_pipeline WHERE id = $1', [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: '找不到此候選人' });
    }

    const files = result.rows[0].resume_files || [];
    const idx = files.findIndex(f => f.id === fileId);
    if (idx === -1) {
      return res.status(404).json({ success: false, error: '找不到此檔案' });
    }

    const updated = files.filter(f => f.id !== fileId);
    await pool.query(
      'UPDATE candidates_pipeline SET resume_files = $1, updated_at = NOW() WHERE id = $2',
      [JSON.stringify(updated), id]
    );

    res.json({ success: true, message: '檔案已刪除', remaining: updated.length });
  } catch (e) {
    safeError(res, e, 'DELETE /candidates/:id/resume/:fileId');
  }
});

// ═══════════════════════════════════════════════════
// Perplexity AI 深度分析
// ═══════════════════════════════════════════════════

/**
 * POST /api/candidates/:id/enrich
 * 使用 Perplexity AI 搜尋候選人公開資料，充實人選卡片
 * Body: { actor: "Jacky" }
 */
router.post('/candidates/:id/enrich', async (req, res) => {
  const { id } = req.params;
  const actor = req.body.actor || 'System';

  try {
    // 1. 取得候選人現有資料
    const candidateResult = await pool.query(
      `SELECT id, name, current_position, linkedin_url, github_url, location, skills, email,
              biography, portfolio_url, voice_assessments
       FROM candidates_pipeline WHERE id = $1`,
      [id]
    );

    if (candidateResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: '找不到候選人' });
    }

    const candidate = candidateResult.rows[0];
    console.log(`🔍 開始 Perplexity 深度分析: #${id} ${candidate.name}`);

    // 2. 呼叫 Perplexity 分析
    const enrichResult = await enrichCandidate(candidate);

    if (!enrichResult.success) {
      return res.status(500).json({
        success: false,
        error: enrichResult.error,
        message: `Perplexity 分析失敗: ${enrichResult.error}`,
      });
    }

    // 3. 寫入資料庫
    const updated = await saveEnrichment(pool, Number(id), enrichResult.data, actor);

    console.log(`✅ Perplexity 分析完成: #${id} ${candidate.name}`);
    res.json({
      success: true,
      message: `候選人 ${candidate.name} 的深度分析已完成`,
      candidate_id: Number(id),
      enriched_fields: Object.entries(enrichResult.data)
        .filter(([_, v]) => v != null)
        .map(([k]) => k),
      data: enrichResult.data,
      updated: updated,
    });
  } catch (error) {
    safeError(res, error, 'POST /candidates/:id/enrich');
  }
});

/**
 * POST /api/candidates/enrich-batch
 * 批量深度分析（最多 10 筆）
 * Body: { ids: [1212, 1213], actor: "Jacky" }
 */
router.post('/candidates/enrich-batch', async (req, res) => {
  const { ids, actor } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ success: false, error: '請提供 ids 陣列' });
  }

  if (ids.length > 10) {
    return res.status(400).json({ success: false, error: '單次最多 10 筆' });
  }

  const results = { success: [], failed: [] };

  for (const id of ids) {
    try {
      const candidateResult = await pool.query(
        `SELECT id, name, current_position, linkedin_url, github_url, location, skills, email,
                biography, portfolio_url, voice_assessments
         FROM candidates_pipeline WHERE id = $1`,
        [id]
      );

      if (candidateResult.rows.length === 0) {
        results.failed.push({ id, error: '找不到候選人' });
        continue;
      }

      const candidate = candidateResult.rows[0];
      console.log(`🔍 批量分析: #${id} ${candidate.name}`);

      const enrichResult = await enrichCandidate(candidate);

      if (!enrichResult.success) {
        results.failed.push({ id, name: candidate.name, error: enrichResult.error });
        continue;
      }

      await saveEnrichment(pool, Number(id), enrichResult.data, actor || 'System');
      results.success.push({
        id: Number(id),
        name: candidate.name,
        fields: Object.entries(enrichResult.data).filter(([_, v]) => v != null).map(([k]) => k),
      });

      // 避免 API rate limit，每筆間隔 1 秒
      await new Promise(r => setTimeout(r, 1000));
    } catch (err) {
      results.failed.push({ id, error: err.message });
    }
  }

  res.json({
    success: true,
    message: `批量分析完成：成功 ${results.success.length} 筆，失敗 ${results.failed.length} 筆`,
    ...results,
  });
});

// ═══════════════════════════════════════════════════════════════
// 年資 / 年齡 自動計算 & 批次回填
// ═══════════════════════════════════════════════════════════════

/** 從 work_history 計算總年資（取最早 startDate 到今天） */
function computeYearsFromWorkHistory(wh) {
  const entries = parseWorkHistory(wh);
  if (entries.length === 0) return null;

  let earliest = null;
  for (const entry of entries) {
    const sd = entry.startDate || entry.start_date || '';
    // 支援 "2015-09", "2015/09", "2015" 等格式
    const match = sd.match(/(\d{4})[-/]?(\d{1,2})?/);
    if (match) {
      const year = parseInt(match[1]);
      const month = match[2] ? parseInt(match[2]) - 1 : 0;
      const d = new Date(year, month, 1);
      if (!earliest || d < earliest) earliest = d;
    }
  }

  if (!earliest) return null;
  const now = new Date();
  const years = (now - earliest) / (365.25 * 24 * 60 * 60 * 1000);
  return Math.round(years);
}

/** 從 education_details 畢業年推估年齡 */
function estimateAgeFromEducation(ed) {
  let details = ed;
  if (!details) return null;
  if (typeof details === 'string') { try { details = JSON.parse(details); } catch { return null; } }
  if (!Array.isArray(details)) return null;

  const currentYear = new Date().getFullYear();

  // 取得畢業年的通用函式（支援 end / end_year / year 三種格式）
  function getEndYear(entry) {
    const raw = entry.end_year || entry.end || entry.year || null;
    if (!raw) return null;
    const yr = parseInt(String(raw).slice(0, 4)); // "2016-08" → 2016
    return (yr >= 1960 && yr <= currentYear) ? yr : null;
  }

  // 判斷是否為正式學位（排除職訓、培訓班）
  function isDegreeProgram(entry) {
    const d = (entry.degree || '').toLowerCase();
    if (d.includes('職訓') || d.includes('培訓') || d.includes('養成班')) return false;
    if (d.includes('學士') || d.includes('碩') || d.includes('博') || d.includes('專')) return true;
    if (d.includes('bachelor') || d.includes('master') || d.includes('mba') || d.includes('phd') || d.includes('doctor') || d.includes('associate')) return true;
    return true; // 未知學位也算
  }

  // 優先找正式學位的第一筆畢業年（最早的正式學歷）
  let gradYear = null;
  let degree = null;

  // 第一輪：找正式學位中最早的畢業年（學士優先）
  for (const entry of details) {
    if (!isDegreeProgram(entry)) continue;
    const yr = getEndYear(entry);
    if (!yr) continue;
    const d = (entry.degree || '').toLowerCase();
    const isBachelor = d.includes('學士') || d.includes('bachelor');
    if (!gradYear || (isBachelor && !degree?.includes('學士')) || yr < gradYear) {
      gradYear = yr;
      degree = d;
    }
  }

  // 第二輪 fallback：若無正式學位，找任何有畢業年的
  if (!gradYear) {
    for (const entry of details) {
      const yr = getEndYear(entry);
      if (!yr) continue;
      if (!gradYear || yr < gradYear) {
        gradYear = yr;
        degree = (entry.degree || '').toLowerCase();
      }
    }
  }

  if (!gradYear) return null;

  // 依學歷推估畢業年齡
  let gradAge = 22; // 學士預設
  if (degree.includes('碩') || degree.includes('master') || degree.includes('mba')) gradAge = 24;
  else if (degree.includes('博') || degree.includes('phd') || degree.includes('doctor')) gradAge = 28;
  else if (degree.includes('專') || degree.includes('associate')) gradAge = 20;

  const birthYear = gradYear - gradAge;
  return currentYear - birthYear;
}

/** POST /api/candidates/backfill-computed — 批次回填年資+推估年齡 */
router.post('/candidates/backfill-computed', async (req, res) => {
  // ── P1 修復：Transaction 包裝（原本逐筆 UPDATE 無 Transaction） ──
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT id, work_history, education_details, years_experience, age
       FROM candidates_pipeline`
    );

    const forceAge = (req.body && req.body.force === true) || req.query.force === 'true';
    let updatedYears = 0;
    let updatedAge = 0;
    let skipped = 0;

    // 收集所有需要更新的資料
    const yearsUpdates = []; // [{ id, years }]
    const ageUpdates = [];   // [{ id, age }]

    for (const row of rows) {
      let hasUpdate = false;

      // 年資：只在 years_experience 為 0 或空時回填
      const currentYears = parseInt(row.years_experience) || 0;
      if (currentYears === 0) {
        const computed = computeYearsFromWorkHistory(row.work_history);
        if (computed && computed > 0) {
          yearsUpdates.push({ id: row.id, years: String(computed) });
          updatedYears++;
          hasUpdate = true;
        }
      }

      // 年齡：null 時回填；force=true 時全部重新推估
      if (row.age == null || forceAge) {
        const estimated = estimateAgeFromEducation(row.education_details);
        if (estimated && estimated >= 18 && estimated <= 70) {
          if (row.age !== estimated) {
            ageUpdates.push({ id: row.id, age: estimated });
            updatedAge++;
            hasUpdate = true;
          }
        }
      }

      if (!hasUpdate) skipped++;
    }

    // 在 Transaction 內執行所有 UPDATE
    await client.query('BEGIN');

    // 批量更新年資（使用 UNNEST 一次更新多筆）
    if (yearsUpdates.length > 0) {
      const yIds = yearsUpdates.map(u => u.id);
      const yVals = yearsUpdates.map(u => u.years);
      await client.query(
        `UPDATE candidates_pipeline AS cp SET years_experience = v.years
         FROM (SELECT UNNEST($1::int[]) AS id, UNNEST($2::text[]) AS years) AS v
         WHERE cp.id = v.id`,
        [yIds, yVals]
      );
    }

    // 批量更新年齡
    if (ageUpdates.length > 0) {
      const aIds = ageUpdates.map(u => u.id);
      const aVals = ageUpdates.map(u => u.age);
      await client.query(
        `UPDATE candidates_pipeline AS cp SET age = v.age
         FROM (SELECT UNNEST($1::int[]) AS id, UNNEST($2::int[]) AS age) AS v
         WHERE cp.id = v.id`,
        [aIds, aVals]
      );
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      total: rows.length,
      updatedYears,
      updatedAge,
      skipped,
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    safeError(res, err, 'POST /candidates/backfill-computed');
  } finally {
    client.release();
  }
});

// ==================== Sprint 1: Taxonomy APIs ====================

const skillTaxonomy = require('./taxonomy/skill-taxonomy.json');
const roleTaxonomy = require('./taxonomy/role-taxonomy.json');
const industryTaxonomy = require('./taxonomy/industry-taxonomy.json');

/**
 * GET /api/taxonomy/skills
 * Returns the unified skill taxonomy for autocomplete and normalization.
 */
router.get('/taxonomy/skills', (req, res) => {
  const { _meta, ...skills } = skillTaxonomy;
  const result = Object.keys(skills).sort().map(canonical => ({
    canonical,
    aliases: skills[canonical],
  }));
  res.json({ success: true, data: result });
});

/**
 * GET /api/taxonomy/roles
 * Returns role family + canonical roles for dropdown population.
 */
router.get('/taxonomy/roles', (req, res) => {
  const { _meta, ...roles } = roleTaxonomy;
  const result = Object.entries(roles).map(([key, val]) => ({
    roleFamily: key,
    label: val.label,
    canonicalRoles: val.canonicalRoles,
  }));
  res.json({ success: true, data: result });
});

/**
 * GET /api/taxonomy/industries
 * Returns industry taxonomy for dropdown population.
 */
router.get('/taxonomy/industries', (req, res) => {
  res.json({ success: true, data: industryTaxonomy.industries });
});

// ==================== 提示詞資料庫 (Prompt Library) API ====================

const VALID_PROMPT_CATEGORIES = [
  '客戶需求理解', '職缺分析', '人才市場 Mapping', '人才搜尋',
  '陌生開發（開發信）', '人選訪談', '人選評估', '客戶推薦', '面試與 Offer 管理',
];

// GET /api/prompts — 列出提示詞（可按分類篩選）
router.get('/prompts', async (req, res) => {
  try {
    const { category, viewer } = req.query;
    const params = [];
    let where = '';

    if (category && category !== 'all') {
      params.push(category);
      where = `WHERE p.category = $${params.length}`;
    }

    const viewerParam = viewer || '';
    params.push(viewerParam);
    const viewerIdx = params.length;

    const result = await pool.query(`
      SELECT p.*,
        CASE WHEN v.id IS NOT NULL THEN true ELSE false END AS has_voted
      FROM prompt_library p
      LEFT JOIN prompt_votes v ON v.prompt_id = p.id AND v.voter = $${viewerIdx}
      ${where}
      ORDER BY p.is_pinned DESC, p.upvote_count DESC, p.created_at DESC
    `, params);

    res.json({ success: true, data: result.rows });
  } catch (err) {
    safeError(res, err, 'GET /prompts');
  }
});

// GET /api/prompts/:id — 取得單一提示詞
router.get('/prompts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM prompt_library WHERE id = $1', [id]);
    if (!result.rows.length) return res.status(404).json({ success: false, error: '找不到提示詞' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    safeError(res, err, 'GET /prompts/:id');
  }
});

// POST /api/prompts — 新增提示詞
router.post('/prompts', async (req, res) => {
  try {
    const { category, title, content, author } = req.body;
    if (!category || !title || !content || !author) {
      return res.status(400).json({ success: false, error: '請填寫所有必填欄位' });
    }
    if (!VALID_PROMPT_CATEGORIES.includes(category)) {
      return res.status(400).json({ success: false, error: '無效的分類' });
    }
    const result = await pool.query(
      `INSERT INTO prompt_library (category, title, content, author)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [category, title.trim(), content.trim(), author.trim()]
    );
    res.json({ success: true, data: result.rows[0], message: '提示詞已新增' });
  } catch (err) {
    safeError(res, err, 'POST /prompts');
  }
});

// PATCH /api/prompts/:id — 編輯提示詞
router.patch('/prompts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, actor } = req.body;

    const current = await pool.query('SELECT * FROM prompt_library WHERE id = $1', [id]);
    if (!current.rows.length) return res.status(404).json({ success: false, error: '找不到提示詞' });

    const result = await pool.query(
      `UPDATE prompt_library SET
        title = COALESCE($1, title),
        content = COALESCE($2, content),
        updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [title || null, content || null, id]
    );
    res.json({ success: true, data: result.rows[0], message: '提示詞已更新' });
  } catch (err) {
    safeError(res, err, 'PATCH /prompts/:id');
  }
});

// DELETE /api/prompts/:id — 刪除提示詞
router.delete('/prompts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM prompt_library WHERE id = $1 RETURNING id', [id]);
    if (!result.rows.length) return res.status(404).json({ success: false, error: '找不到提示詞' });
    res.json({ success: true, message: '已刪除' });
  } catch (err) {
    safeError(res, err, 'DELETE /prompts/:id');
  }
});

// POST /api/prompts/:id/upvote — 投票/取消投票 toggle
router.post('/prompts/:id/upvote', async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { voter } = req.body;
    if (!voter) return res.status(400).json({ success: false, error: '缺少 voter' });

    await client.query('BEGIN');

    // 檢查是否已投票
    const existing = await client.query(
      'SELECT id FROM prompt_votes WHERE prompt_id = $1 AND voter = $2', [id, voter]
    );

    if (existing.rows.length) {
      // 取消投票
      await client.query('DELETE FROM prompt_votes WHERE prompt_id = $1 AND voter = $2', [id, voter]);
      await client.query('UPDATE prompt_library SET upvote_count = GREATEST(upvote_count - 1, 0) WHERE id = $1', [id]);
    } else {
      // 新增投票
      await client.query('INSERT INTO prompt_votes (prompt_id, voter) VALUES ($1, $2)', [id, voter]);
      await client.query('UPDATE prompt_library SET upvote_count = upvote_count + 1 WHERE id = $1', [id]);
    }

    await client.query('COMMIT');

    // 回傳更新後的提示詞
    const updated = await pool.query(
      `SELECT p.*,
        CASE WHEN v.id IS NOT NULL THEN true ELSE false END AS has_voted
       FROM prompt_library p
       LEFT JOIN prompt_votes v ON v.prompt_id = p.id AND v.voter = $2
       WHERE p.id = $1`,
      [id, voter]
    );
    res.json({ success: true, data: updated.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    safeError(res, err, 'POST /prompts/:id/upvote');
  } finally {
    client.release();
  }
});

// POST /api/prompts/:id/pin — 置頂/取消置頂
router.post('/prompts/:id/pin', async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { action } = req.body; // 'pin' or 'unpin'

    const current = await client.query('SELECT * FROM prompt_library WHERE id = $1', [id]);
    if (!current.rows.length) {
      return res.status(404).json({ success: false, error: '找不到提示詞' });
    }

    await client.query('BEGIN');

    if (action === 'pin') {
      // 先取消同分類的所有置頂
      await client.query(
        'UPDATE prompt_library SET is_pinned = FALSE WHERE category = $1',
        [current.rows[0].category]
      );
      // 再置頂指定的
      await client.query('UPDATE prompt_library SET is_pinned = TRUE WHERE id = $1', [id]);
    } else {
      // 取消置頂
      await client.query('UPDATE prompt_library SET is_pinned = FALSE WHERE id = $1', [id]);
    }

    await client.query('COMMIT');

    const updated = await pool.query('SELECT * FROM prompt_library WHERE id = $1', [id]);
    res.json({ success: true, data: updated.rows[0], message: action === 'pin' ? '已置頂' : '已取消置頂' });
  } catch (err) {
    await client.query('ROLLBACK');
    safeError(res, err, 'POST /prompts/:id/pin');
  } finally {
    client.release();
  }
});

// ==================== 站內通知 API ====================

/**
 * GET /api/notifications?uid=phoebe
 * 取得指定用戶的通知（recipient='all' 或 recipient=uid），最新 50 筆
 * 可選 ?unread_only=true 只取未讀
 */
router.get('/notifications', async (req, res) => {
  try {
    const { uid, unread_only } = req.query;
    if (!uid) return res.status(400).json({ success: false, error: 'uid is required' });

    const result = await pool.query(`
      SELECT id, recipient, type, title, message, link, data, actor, is_read, created_at
      FROM notifications
      WHERE recipient = 'all' OR recipient = $1
      ORDER BY created_at DESC
      LIMIT 50
    `, [uid]);

    const notifications = result.rows.map(row => {
      const isReadMap = row.is_read || {};
      const isRead = row.recipient === 'all' ? (isReadMap[uid] === true) : (isReadMap[uid] === true);
      return {
        id: row.id,
        recipient: row.recipient,
        type: row.type,
        title: row.title,
        message: row.message || '',
        link: row.link || null,
        data: row.data || null,
        actor: row.actor || 'system',
        isRead: isRead,
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()
      };
    });

    // 過濾未讀
    const filtered = unread_only === 'true'
      ? notifications.filter(n => !n.isRead)
      : notifications;

    const unreadCount = notifications.filter(n => !n.isRead).length;

    res.json({ success: true, data: filtered, unreadCount });
  } catch (err) {
    safeError(res, err, 'GET /notifications');
  }
});

/**
 * POST /api/notifications
 * 管理員手動發布通知
 * Body: { title, message, type?, recipient?, link?, actor? }
 */
router.post('/notifications', async (req, res) => {
  try {
    const { title, message, type, recipient, link, data, actor } = req.body;
    if (!title) return res.status(400).json({ success: false, error: 'title is required' });

    await writeNotification({
      recipient: recipient || 'all',
      type: type || 'system_update',
      title,
      message,
      link,
      data,
      actor: actor || 'admin'
    });

    res.json({ success: true, message: '通知已發布' });
  } catch (err) {
    safeError(res, err, 'POST /notifications');
  }
});

/**
 * PATCH /api/notifications/:id/read?uid=phoebe
 * 標記單則通知已讀
 */
router.patch('/notifications/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    const uid = req.query.uid || req.body.uid;
    if (!uid) return res.status(400).json({ success: false, error: 'uid is required' });

    await pool.query(`
      UPDATE notifications
      SET is_read = COALESCE(is_read, '{}'::jsonb) || $1::jsonb
      WHERE id = $2
    `, [JSON.stringify({ [uid]: true }), id]);

    res.json({ success: true });
  } catch (err) {
    safeError(res, err, 'PATCH /notifications/:id/read');
  }
});

/**
 * PATCH /api/notifications/read-all?uid=phoebe
 * 全部標記已讀
 */
router.patch('/notifications/read-all', async (req, res) => {
  try {
    const uid = req.query.uid || req.body.uid;
    if (!uid) return res.status(400).json({ success: false, error: 'uid is required' });

    await pool.query(`
      UPDATE notifications
      SET is_read = COALESCE(is_read, '{}'::jsonb) || $1::jsonb
      WHERE (recipient = 'all' OR recipient = $2)
        AND NOT (COALESCE(is_read, '{}'::jsonb) ? $2 AND (is_read->>$2)::boolean = true)
    `, [JSON.stringify({ [uid]: true }), uid]);

    res.json({ success: true, message: '已全部標記已讀' });
  } catch (err) {
    safeError(res, err, 'PATCH /notifications/read-all');
  }
});

/**
 * POST /api/webhooks/github
 * GitHub Webhook — 接收 push event，自動產生站內通知
 * GitHub repo Settings → Webhooks → Payload URL: https://api-hr.step1ne.com/api/webhooks/github
 * Content type: application/json, Events: Just the push event
 */
router.post('/webhooks/github', async (req, res) => {
  try {
    // HMAC-SHA256 簽名驗證（需在 GitHub Webhook 設定 Secret，並設定 GITHUB_WEBHOOK_SECRET 環境變數）
    const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
    if (webhookSecret) {
      const signature = req.headers['x-hub-signature-256'];
      if (!signature || !req.rawBody) {
        return res.status(401).json({ success: false, error: 'Missing signature' });
      }
      const expected = 'sha256=' + crypto.createHmac('sha256', webhookSecret).update(req.rawBody).digest('hex');
      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
        return res.status(401).json({ success: false, error: 'Invalid signature' });
      }
    }

    const event = req.headers['x-github-event'];

    if (event === 'push') {
      const { commits, pusher, ref } = req.body;
      const branch = (ref || '').replace('refs/heads/', '');

      // 只處理 main branch
      if (branch !== 'main') {
        return res.json({ success: true, skipped: true, reason: 'not main branch' });
      }

      const commitList = commits || [];
      const commitMessages = commitList.map(c => c.message.split('\n')[0]).slice(0, 10).join('\n');

      await writeNotification({
        recipient: 'all',
        type: 'github_push',
        title: `🚀 系統更新（${commitList.length} 項變更）`,
        message: commitMessages,
        actor: (pusher && pusher.name) || 'github',
        data: {
          branch,
          commits_count: commitList.length,
          commits: commitList.slice(0, 5).map(c => ({
            id: c.id ? c.id.substring(0, 7) : '',
            message: c.message.split('\n')[0],
            author: c.author ? c.author.name : ''
          }))
        }
      });

      console.log(`✅ GitHub webhook: ${commitList.length} commits on ${branch} → 通知已發送`);
    }

    // ping event（GitHub 設定 webhook 時會發送）
    if (event === 'ping') {
      console.log('✅ GitHub webhook ping received');
    }

    res.json({ success: true });
  } catch (err) {
    safeError(res, err, 'POST /webhooks/github');
  }
});

// ==================== 系統設定 API ====================

/**
 * GET /api/system-config/:key
 * 取得系統設定值
 */
router.get('/system-config/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const result = await pool.query('SELECT value FROM system_config WHERE key = $1', [key]);
    res.json({ success: true, value: result.rows[0]?.value || '' });
  } catch (err) {
    safeError(res, err, 'GET /system-config/:key');
  }
});

/**
 * PUT /api/system-config/:key
 * 更新系統設定值
 */
// 允許前端修改的設定 key 白名單
const ALLOWED_CONFIG_KEYS = new Set([
  'telegram_group_bot_token',
  'telegram_group_chat_id',
  'ai_model_preference',
  'system_announcement',
]);

router.put('/system-config/:key', async (req, res) => {
  try {
    const { key } = req.params;
    if (!ALLOWED_CONFIG_KEYS.has(key)) {
      return res.status(400).json({ success: false, error: `不允許修改設定：${key}` });
    }
    const { value } = req.body;
    await pool.query(`
      INSERT INTO system_config (key, value, updated_at) VALUES ($1, $2, NOW())
      ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()
    `, [key, value || '']);
    res.json({ success: true, message: '設定已更新' });
  } catch (err) {
    safeError(res, err, 'PUT /system-config/:key');
  }
});

// ========== Sprint 5: Interactions CRUD ==========

// GET /candidates/:id/interactions — 取得候選人互動紀錄
router.get('/candidates/:id/interactions', async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      `SELECT * FROM interactions WHERE candidate_id = $1 ORDER BY interaction_date DESC`,
      [id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    safeError(res, err, 'GET /candidates/:id/interactions');
  }
});

// POST /candidates/:id/interactions — 新增互動紀錄
router.post('/candidates/:id/interactions', async (req, res) => {
  try {
    const candidateId = req.params.id;
    const { interaction_type, interaction_date, channel, summary, next_action, next_action_date, response_level, created_by } = req.body;
    if (!interaction_type) return res.status(400).json({ success: false, error: 'interaction_type 必填' });

    const { rows } = await pool.query(
      `INSERT INTO interactions (candidate_id, interaction_type, interaction_date, channel, summary, next_action, next_action_date, response_level, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [candidateId, interaction_type, interaction_date || new Date(), channel || null, summary || null,
       next_action || null, next_action_date || null, response_level || null, created_by || null]
    );

    // 自動更新候選人 lastContactAt + heat_level
    await pool.query(
      `UPDATE candidates_pipeline SET updated_at = NOW() WHERE id = $1`,
      [candidateId]
    );

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    safeError(res, err, 'POST /candidates/:id/interactions');
  }
});

// PATCH /interactions/:id — 更新互動紀錄
router.patch('/interactions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const fields = ['interaction_type', 'interaction_date', 'channel', 'summary', 'next_action', 'next_action_date', 'response_level'];
    const sets = [];
    const vals = [];
    let idx = 1;
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        sets.push(`${f} = $${idx}`);
        vals.push(req.body[f]);
        idx++;
      }
    }
    if (sets.length === 0) return res.status(400).json({ success: false, error: '沒有要更新的欄位' });
    sets.push(`updated_at = NOW()`);
    vals.push(id);
    const { rows } = await pool.query(
      `UPDATE interactions SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      vals
    );
    if (rows.length === 0) return res.status(404).json({ success: false, error: '找不到互動紀錄' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    safeError(res, err, 'PATCH /interactions/:id');
  }
});

// DELETE /interactions/:id — 刪除互動紀錄
router.delete('/interactions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { rowCount } = await pool.query(`DELETE FROM interactions WHERE id = $1`, [id]);
    if (rowCount === 0) return res.status(404).json({ success: false, error: '找不到互動紀錄' });
    res.json({ success: true, message: '已刪除' });
  } catch (err) {
    safeError(res, err, 'DELETE /interactions/:id');
  }
});

// ==================== AI Grade/Tier Suggestion (Layer 2: LLM-powered) ====================

/**
 * POST /api/candidates/:id/ai-grade-suggest
 * 使用本地 LLM (OpenClaw) 深度分析候選人，回傳建議的 Grade / Source Tier
 *
 * 需要的欄位已由 GET /candidates/:id 提供，前端傳入即可。
 * 回傳格式: { suggestedGrade, suggestedTier, confidence, reasons[], detailedAnalysis }
 */
router.post('/candidates/:id/ai-grade-suggest', async (req, res) => {
  const OPENCLAW_URL = process.env.OPENCLAW_URL || 'http://127.0.0.1:18789/v1/chat/completions';
  const OPENCLAW_MODEL = process.env.OPENCLAW_MODEL || 'openclaw';
  const TIMEOUT_MS = 30000; // 30 秒上限

  try {
    const { id } = req.params;
    const candidateData = req.body; // 前端傳入完整候選人資料

    if (!candidateData || !candidateData.name) {
      return res.status(400).json({ success: false, error: '缺少候選人資料' });
    }

    // 組裝 prompt
    const systemPrompt = `你是一位資深獵頭顧問 AI 助理，專精於科技業人才評估。
你的任務是根據候選人資料，精確評估其 Grade（人選等級）和 Source Tier（來源層級）。

## Grade 定義
- A 級（核心人選）：技術深度出色、經歷亮眼（知名企業/重要產品線）、年資匹配、資料完整
- B 級（合格人選）：技術紮實、經歷中等偏上、多數條件符合
- C 級（觀察人選）：有潛力但某些維度不足（如經驗淺、技能不完全匹配、資料不完整）
- D 級（不適合）：多數維度明顯不符、資料嚴重不足

## Source Tier 定義
- T1（FAANG / 獨角獸）：Google, Meta, Apple, Amazon, Microsoft, NVIDIA, TSMC, MediaTek, Netflix, ByteDance, OpenAI, Stripe, Databricks 等全球頂級企業
- T2（知名企業 / 上市）：LINE, Shopee, Appier, Gogolook, ASUS, Acer, HTC, Trend Micro, KKday, 91APP, PChome, momo, 國泰, 中信, 富邦等區域知名企業
- T3（一般企業 / 中小型）：其他企業

## 評估維度（按權重）
1. 公司背景 (25%) — 現職/過往公司等級
2. 年資匹配 (20%) — 總年資是否在合理範圍
3. 技能豐富度 (20%) — 標準化技能數量與深度
4. 資深程度 (15%) — 職級 (IC/Senior/Lead/Manager/Director)
5. 資料完整度 (10%) — 核心欄位填寫比例
6. 職涯穩定度 (10%) — 平均任期、跳槽頻率

請以 JSON 格式回覆（不要 markdown code block），包含：
{
  "suggestedGrade": "A" | "B" | "C" | "D",
  "suggestedTier": "T1" | "T2" | "T3" | null,
  "confidence": 0-100,
  "reasons": ["原因1", "原因2", ...],
  "detailedAnalysis": "完整分析文字（2-3 段）"
}`;

    // 候選人摘要
    const workHistorySummary = (candidateData.workHistory || [])
      .slice(0, 5)
      .map((w, i) => `  ${i + 1}. ${w.company || '?'} / ${w.title || w.position || '?'} (${w.startDate || '?'} ~ ${w.endDate || '在職'})`)
      .join('\n');

    const educationSummary = (candidateData.educationJson || candidateData.education_details || [])
      .slice(0, 3)
      .map((e, i) => `  ${i + 1}. ${e.school || '?'} / ${e.degree || '?'} / ${e.major || e.field || '?'}`)
      .join('\n');

    const skillsList = Array.isArray(candidateData.normalizedSkills) && candidateData.normalizedSkills.length > 0
      ? candidateData.normalizedSkills.join(', ')
      : candidateData.skills || '無資料';

    const salaryInfo = (() => {
      const cur = candidateData.salaryCurrency || 'TWD';
      const per = candidateData.salaryPeriod === 'annual' ? '/年' : '/月';
      const parts = [];
      if (candidateData.currentSalaryMin || candidateData.currentSalaryMax) {
        parts.push(`目前: ${candidateData.currentSalaryMin || '?'}~${candidateData.currentSalaryMax || '?'} ${cur}${per}`);
      }
      if (candidateData.expectedSalaryMin || candidateData.expectedSalaryMax) {
        parts.push(`期望: ${candidateData.expectedSalaryMin || '?'}~${candidateData.expectedSalaryMax || '?'} ${cur}${per}`);
      }
      return parts.length > 0 ? parts.join(' | ') : '無資料';
    })();

    const userMessage = `請評估以下候選人：

## 基本資料
- 姓名：${candidateData.name}
- 現職公司：${candidateData.currentCompany || candidateData.current_company || '未提供'}
- 現職職稱：${candidateData.currentTitle || candidateData.current_title || candidateData.position || '未提供'}
- 標準職能：${candidateData.roleFamily || '未分類'} / ${candidateData.canonicalRole || '未分類'}
- 資深程度：${candidateData.seniorityLevel || candidateData.seniority_level || '未分類'}
- 總年資：${candidateData.totalYears || candidateData.years || '未知'} 年
- 產業標籤：${candidateData.industryTag || candidateData.industry_tag || '未分類'}
- 地區：${candidateData.location || '未提供'}

## 技能
${skillsList}

## 薪資
${salaryInfo}

## 經歷
${workHistorySummary || '  無經歷資料'}

## 學歷
${educationSummary || '  無學歷資料'}

## 求職狀態
- 求職狀態：${candidateData.jobSearchStatusEnum || candidateData.job_search_status_enum || '未知'}
- 到職時間：${candidateData.noticePeriodEnum || candidateData.notice_period_enum || '未知'}
- 穩定度評分：${candidateData.stabilityScore || candidateData.stability_score || '未知'}
- 跳槽次數：${candidateData.jobChanges || candidateData.job_changes || '未知'}
- 平均任期：${candidateData.avgTenure || candidateData.avg_tenure_months || '未知'} 個月

## 其他
- 資料完整度：${candidateData.dataQuality?.completenessScore ?? candidateData.data_quality?.completenessScore ?? '未知'}%
- 離職原因：${candidateData.quitReasons || candidateData.leaving_reason || '未提供'}
- 備註：${(candidateData.notes || '').substring(0, 300) || '無'}

請根據以上資料給出評級建議。`;

    // 呼叫 LLM
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let llmResponse;
    try {
      llmResponse = await fetch(OPENCLAW_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: OPENCLAW_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          temperature: 0.3,
          max_tokens: 1500,
        }),
        signal: controller.signal,
      });
    } catch (fetchErr) {
      clearTimeout(timeout);
      // LLM 不可用 — 回傳優雅降級
      console.warn(`[AI Grade Suggest] LLM 不可用 (${fetchErr.message}), candidate #${id}`);
      return res.json({
        success: true,
        source: 'fallback',
        data: {
          suggestedGrade: null,
          suggestedTier: null,
          confidence: 0,
          reasons: ['LLM 服務目前不可用，請使用 Layer 1 規則建議或手動評級'],
          detailedAnalysis: null,
          error: fetchErr.name === 'AbortError' ? 'LLM 回應超時' : `LLM 連線失敗: ${fetchErr.message}`,
        },
      });
    }
    clearTimeout(timeout);

    if (!llmResponse.ok) {
      const errText = await llmResponse.text().catch(() => 'unknown');
      console.error(`[AI Grade Suggest] LLM HTTP ${llmResponse.status}: ${errText}`);
      return res.json({
        success: true,
        source: 'fallback',
        data: {
          suggestedGrade: null,
          suggestedTier: null,
          confidence: 0,
          reasons: [`LLM 回應錯誤 (HTTP ${llmResponse.status})`],
          detailedAnalysis: null,
          error: `HTTP ${llmResponse.status}`,
        },
      });
    }

    const llmJson = await llmResponse.json();
    const content = llmJson.choices?.[0]?.message?.content || '';

    // 解析 LLM 回傳的 JSON
    let parsed;
    try {
      // 先嘗試直接解析
      parsed = JSON.parse(content);
    } catch {
      // 嘗試從 markdown code block 提取
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || content.match(/(\{[\s\S]*\})/);
      if (jsonMatch) {
        try { parsed = JSON.parse(jsonMatch[1]); } catch { parsed = null; }
      }
    }

    if (!parsed || !parsed.suggestedGrade) {
      console.warn(`[AI Grade Suggest] 無法解析 LLM 回應:`, content.substring(0, 200));
      return res.json({
        success: true,
        source: 'llm_parse_error',
        data: {
          suggestedGrade: null,
          suggestedTier: null,
          confidence: 0,
          reasons: ['AI 回應格式異常，請使用 Layer 1 規則建議'],
          detailedAnalysis: content.substring(0, 500),
          rawResponse: content.substring(0, 1000),
        },
      });
    }

    // 驗證 + 標準化回傳
    const validGrades = ['A', 'B', 'C', 'D'];
    const validTiers = ['T1', 'T2', 'T3'];

    res.json({
      success: true,
      source: 'llm',
      data: {
        suggestedGrade: validGrades.includes(parsed.suggestedGrade) ? parsed.suggestedGrade : null,
        suggestedTier: validTiers.includes(parsed.suggestedTier) ? parsed.suggestedTier : null,
        confidence: Math.max(0, Math.min(100, parseInt(parsed.confidence) || 50)),
        reasons: Array.isArray(parsed.reasons) ? parsed.reasons.slice(0, 8) : [],
        detailedAnalysis: parsed.detailedAnalysis || null,
      },
    });

    console.log(`[AI Grade Suggest] candidate #${id} → Grade=${parsed.suggestedGrade}, Tier=${parsed.suggestedTier}, confidence=${parsed.confidence}%`);

  } catch (error) {
    console.error('[AI Grade Suggest] Unexpected error:', error);
    safeError(res, error, 'POST /candidates/:id/ai-grade-suggest');
  }
});

module.exports = router;

