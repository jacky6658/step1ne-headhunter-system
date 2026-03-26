-- =====================================================================
-- Step1ne: 全量合併 Migration（安全重複執行版）
-- 用途：一次性確保所有欄位、表格、索引都存在
-- 策略：全部使用 IF NOT EXISTS / ADD COLUMN IF NOT EXISTS
-- 執行方式：在本機 PostgreSQL 中執行即可
-- 最後更新：2026-03-15
-- =====================================================================

-- ======================= 1. candidates_pipeline 欄位 =======================

-- 基礎欄位
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS progress_tracking JSONB DEFAULT '[]';
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS linkedin_url VARCHAR(500);
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS github_url VARCHAR(500);
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS ai_match_result JSONB;

-- OpenClaw 分析欄位
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS ai_score INTEGER;
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS ai_grade VARCHAR(10);
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS ai_report TEXT;
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS ai_recommendation VARCHAR(50);

-- 薪資欄位
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS current_salary VARCHAR(100);
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS expected_salary VARCHAR(100);

-- GitHub 分析快取
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS github_analysis_cache JSONB;

-- 面試關卡
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS interview_round INTEGER;

-- 出生年月日 + 年齡推估
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS birthday DATE;
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS age_estimated BOOLEAN DEFAULT true;

-- 性別 + 英文名
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS english_name TEXT;

-- AI 總結 + 履歷附件
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS ai_summary JSONB;
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS resume_files JSONB DEFAULT '[]';

-- 語音評估 + 自傳 + 作品集
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS voice_assessments JSONB DEFAULT '[]';
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS biography TEXT;
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS portfolio_url VARCHAR(500);

-- 顧問備註
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS consultant_note TEXT;

-- 目標職缺 FK
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS target_job_id INTEGER;

-- Precision Evaluation Gate
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS precision_eligible BOOLEAN DEFAULT FALSE;

-- ==================== Sprint 1: Layer 1 - Match Core ====================

ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS current_title VARCHAR(200);
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS current_company VARCHAR(200);
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS role_family VARCHAR(50);
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS canonical_role VARCHAR(200);
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS seniority_level VARCHAR(50);
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS total_years NUMERIC(4,1);
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS industry_tag VARCHAR(100);
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS normalized_skills JSONB DEFAULT '[]';
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS skill_evidence JSONB DEFAULT '[]';
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS education_level VARCHAR(50);
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS current_salary_min INTEGER;
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS current_salary_max INTEGER;
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS expected_salary_min INTEGER;
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS expected_salary_max INTEGER;
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS salary_currency VARCHAR(10) DEFAULT 'TWD';
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS salary_period VARCHAR(20) DEFAULT 'monthly';
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS notice_period_enum VARCHAR(20);
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS job_search_status_enum VARCHAR(20);

-- ==================== Sprint 1: Layer 2 - Deal / Timing ====================

ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS age INTEGER;
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS industry VARCHAR(200);
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS languages TEXT;
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS certifications TEXT;
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS notice_period VARCHAR(100);
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS management_experience BOOLEAN DEFAULT FALSE;
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS team_size VARCHAR(50);
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS consultant_evaluation JSONB;
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS job_search_status VARCHAR(50);
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS reason_for_change TEXT;
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS motivation VARCHAR(200);
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS deal_breakers TEXT;
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS competing_offers TEXT;
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS relationship_level VARCHAR(50);

-- ==================== Sprint 1: Layer 3 - Enrichment + Talent Board ====================

ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS education_summary TEXT;
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS resume_assets JSONB;
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS auto_derived JSONB;
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS data_quality JSONB;
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS grade_level VARCHAR(2);
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS source_tier VARCHAR(2);
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS heat_level VARCHAR(10);

-- ==================== VARCHAR 擴充（避免爬蟲資料超長） ====================

ALTER TABLE candidates_pipeline ALTER COLUMN location TYPE VARCHAR(255);
ALTER TABLE candidates_pipeline ALTER COLUMN education TYPE VARCHAR(255);
ALTER TABLE candidates_pipeline ALTER COLUMN source TYPE VARCHAR(255);
ALTER TABLE candidates_pipeline ALTER COLUMN recruiter TYPE VARCHAR(255);
ALTER TABLE candidates_pipeline ALTER COLUMN personality_type TYPE VARCHAR(255);

-- ======================= 2. jobs_pipeline 欄位 =======================

ALTER TABLE jobs_pipeline ADD COLUMN IF NOT EXISTS target_companies TEXT;
ALTER TABLE jobs_pipeline ADD COLUMN IF NOT EXISTS title_variants TEXT;
ALTER TABLE jobs_pipeline ADD COLUMN IF NOT EXISTS exclusion_keywords TEXT;
ALTER TABLE jobs_pipeline ADD COLUMN IF NOT EXISTS job_description TEXT;
ALTER TABLE jobs_pipeline ADD COLUMN IF NOT EXISTS company_profile TEXT;
ALTER TABLE jobs_pipeline ADD COLUMN IF NOT EXISTS talent_profile TEXT;
ALTER TABLE jobs_pipeline ADD COLUMN IF NOT EXISTS search_primary TEXT;
ALTER TABLE jobs_pipeline ADD COLUMN IF NOT EXISTS search_secondary TEXT;
ALTER TABLE jobs_pipeline ADD COLUMN IF NOT EXISTS welfare_tags TEXT;
ALTER TABLE jobs_pipeline ADD COLUMN IF NOT EXISTS welfare_detail TEXT;
ALTER TABLE jobs_pipeline ADD COLUMN IF NOT EXISTS work_hours TEXT;
ALTER TABLE jobs_pipeline ADD COLUMN IF NOT EXISTS vacation_policy TEXT;
ALTER TABLE jobs_pipeline ADD COLUMN IF NOT EXISTS remote_work TEXT;
ALTER TABLE jobs_pipeline ADD COLUMN IF NOT EXISTS business_trip TEXT;
ALTER TABLE jobs_pipeline ADD COLUMN IF NOT EXISTS job_url TEXT;
ALTER TABLE jobs_pipeline ADD COLUMN IF NOT EXISTS marketing_description TEXT;
ALTER TABLE jobs_pipeline ADD COLUMN IF NOT EXISTS submission_criteria TEXT;
ALTER TABLE jobs_pipeline ADD COLUMN IF NOT EXISTS interview_stages INTEGER DEFAULT 0;
ALTER TABLE jobs_pipeline ADD COLUMN IF NOT EXISTS interview_stage_detail TEXT;
ALTER TABLE jobs_pipeline ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT '一般';
ALTER TABLE jobs_pipeline ADD COLUMN IF NOT EXISTS salary_min INTEGER;
ALTER TABLE jobs_pipeline ADD COLUMN IF NOT EXISTS salary_max INTEGER;
ALTER TABLE jobs_pipeline ADD COLUMN IF NOT EXISTS rejection_criteria TEXT;

-- ======================= 3. 其他表格 =======================

-- system_logs
CREATE TABLE IF NOT EXISTS system_logs (
  id SERIAL PRIMARY KEY,
  action VARCHAR(50) NOT NULL,
  actor VARCHAR(100) NOT NULL,
  actor_type VARCHAR(10) NOT NULL DEFAULT 'HUMAN',
  candidate_id INTEGER,
  candidate_name VARCHAR(255),
  detail JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- user_contacts
CREATE TABLE IF NOT EXISTS user_contacts (
  display_name VARCHAR(100) PRIMARY KEY,
  contact_phone VARCHAR(50),
  contact_email VARCHAR(255),
  line_id VARCHAR(100),
  telegram_handle VARCHAR(100),
  updated_at TIMESTAMP DEFAULT NOW()
);
ALTER TABLE user_contacts ADD COLUMN IF NOT EXISTS telegram_bot_token VARCHAR(500);
ALTER TABLE user_contacts ADD COLUMN IF NOT EXISTS telegram_chat_id VARCHAR(100);
ALTER TABLE user_contacts ADD COLUMN IF NOT EXISTS github_token VARCHAR(500);
ALTER TABLE user_contacts ADD COLUMN IF NOT EXISTS linkedin_token TEXT;
ALTER TABLE user_contacts ADD COLUMN IF NOT EXISTS brave_api_key VARCHAR(500);
ALTER TABLE user_contacts ADD COLUMN IF NOT EXISTS site_config JSONB DEFAULT '{}';

-- system_config
CREATE TABLE IF NOT EXISTS system_config (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);
INSERT INTO system_config (key, value) VALUES ('telegram_group_chat_id', '') ON CONFLICT (key) DO NOTHING;
INSERT INTO system_config (key, value) VALUES ('telegram_group_bot_token', '') ON CONFLICT (key) DO NOTHING;

-- candidate_job_rankings_cache
CREATE TABLE IF NOT EXISTS candidate_job_rankings_cache (
  candidate_id INTEGER NOT NULL PRIMARY KEY,
  rankings JSONB NOT NULL,
  computed_at TIMESTAMP DEFAULT NOW()
);

-- prompt_library + prompt_votes
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
);
CREATE TABLE IF NOT EXISTS prompt_votes (
  id SERIAL PRIMARY KEY,
  prompt_id INTEGER NOT NULL REFERENCES prompt_library(id) ON DELETE CASCADE,
  voter VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(prompt_id, voter)
);

-- notifications
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
);

-- interactions（互動紀錄）
CREATE TABLE IF NOT EXISTS interactions (
  id SERIAL PRIMARY KEY,
  candidate_id INTEGER NOT NULL,
  type VARCHAR(50) NOT NULL,
  summary TEXT,
  detail JSONB,
  actor VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

-- clients 欄位
ALTER TABLE clients ADD COLUMN IF NOT EXISTS submission_rules JSONB DEFAULT '[]';

-- ======================= 4. 索引 =======================

-- candidates_pipeline 索引
CREATE INDEX IF NOT EXISTS idx_candidates_status ON candidates_pipeline(status);
CREATE INDEX IF NOT EXISTS idx_candidates_created ON candidates_pipeline(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_candidates_name_lower ON candidates_pipeline(LOWER(TRIM(name)));
CREATE INDEX IF NOT EXISTS idx_candidates_recruiter ON candidates_pipeline(recruiter);
CREATE INDEX IF NOT EXISTS idx_candidates_target_job ON candidates_pipeline(target_job_id) WHERE target_job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_candidates_industry ON candidates_pipeline(industry);
CREATE INDEX IF NOT EXISTS idx_candidates_age ON candidates_pipeline(age);
CREATE INDEX IF NOT EXISTS idx_candidates_job_search_status ON candidates_pipeline(job_search_status);
CREATE INDEX IF NOT EXISTS idx_candidates_relationship_level ON candidates_pipeline(relationship_level);

-- Sprint 1 索引
CREATE INDEX IF NOT EXISTS idx_cp_role_family ON candidates_pipeline(role_family);
CREATE INDEX IF NOT EXISTS idx_cp_industry_tag ON candidates_pipeline(industry_tag);
CREATE INDEX IF NOT EXISTS idx_cp_grade_level ON candidates_pipeline(grade_level);
CREATE INDEX IF NOT EXISTS idx_cp_heat_level ON candidates_pipeline(heat_level);
CREATE INDEX IF NOT EXISTS idx_cp_source_tier ON candidates_pipeline(source_tier);
CREATE INDEX IF NOT EXISTS idx_cp_seniority ON candidates_pipeline(seniority_level);
CREATE INDEX IF NOT EXISTS idx_cp_notice_period_enum ON candidates_pipeline(notice_period_enum);
CREATE INDEX IF NOT EXISTS idx_cp_job_search_status_enum ON candidates_pipeline(job_search_status_enum);
CREATE INDEX IF NOT EXISTS idx_cp_normalized_skills ON candidates_pipeline USING GIN (normalized_skills);
CREATE INDEX IF NOT EXISTS idx_cp_precision_eligible ON candidates_pipeline(precision_eligible);

-- prompt_library 索引
CREATE INDEX IF NOT EXISTS idx_prompt_lib_category ON prompt_library(category);
CREATE INDEX IF NOT EXISTS idx_prompt_lib_pinned ON prompt_library(is_pinned);

-- jobs_pipeline 索引
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs_pipeline(job_status);
CREATE INDEX IF NOT EXISTS idx_jobs_created ON jobs_pipeline(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_priority ON jobs_pipeline(priority);

-- notifications 索引
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient);

-- ======================= 完成 =======================
-- 全部語句使用 IF NOT EXISTS，可安全重複執行
-- 執行完畢後所有欄位、表格、索引均已就緒
