-- PostgreSQL 完整 Schema 初始化
-- 支援：361 筆候選人 + 53 筆職缺 + 同步機制

-- ==================== 候選人表 ====================

-- 1. 候選人基本資訊表（從履歷池索引匯入）
CREATE TABLE IF NOT EXISTS candidates (
  id SERIAL PRIMARY KEY,
  candidate_id VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  location VARCHAR(100),
  current_title VARCHAR(255),
  years_experience NUMERIC,
  job_changes NUMERIC,
  avg_tenure NUMERIC,
  recent_gap NUMERIC,
  skills TEXT,
  education VARCHAR(255),
  source VARCHAR(100),
  work_history TEXT,
  resign_reason TEXT,
  stability_score NUMERIC,
  education_json JSONB,
  disc TEXT,
  status VARCHAR(100) DEFAULT '待聯繫',
  consultant VARCHAR(100),
  remarks TEXT,
  talent_grade VARCHAR(10),
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. 候選人 Pipeline 狀態表
CREATE TABLE IF NOT EXISTS candidates_pipeline (
  id VARCHAR(100) PRIMARY KEY,
  candidate_id VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255),
  status VARCHAR(100) DEFAULT '待聯繫',
  progress_tracking JSONB,
  notes TEXT,
  consultant VARCHAR(100),
  job_matches JSONB,
  ai_match_scores JSONB,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== 職缺表 ====================

-- 3. 職缺基本資訊表（從職缺管理匯入）
CREATE TABLE IF NOT EXISTS jobs (
  id SERIAL PRIMARY KEY,
  job_id VARCHAR(100) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  client_company VARCHAR(255),
  department VARCHAR(100),
  headcount NUMERIC,
  salary_range VARCHAR(100),
  main_skills TEXT,
  experience_required VARCHAR(255),
  education_required VARCHAR(100),
  work_location VARCHAR(100),
  job_status VARCHAR(50),
  created_date DATE,
  last_updated_date DATE,
  language_required VARCHAR(255),
  special_conditions TEXT,
  industry_background VARCHAR(255),
  team_size VARCHAR(100),
  key_challenges TEXT,
  attractions TEXT,
  recruitment_difficulty TEXT,
  interview_process TEXT,
  consultant_notes TEXT,
  last_sync TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== 同步日誌表 ====================

-- 4. Google Sheets 同步日誌
CREATE TABLE IF NOT EXISTS google_sheets_sync_log (
  id SERIAL PRIMARY KEY,
  table_name VARCHAR(50),
  record_id VARCHAR(100),
  action VARCHAR(50),
  synced_to_sheets BOOLEAN DEFAULT FALSE,
  sheets_row_number INTEGER,
  sync_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  error_message TEXT
);

-- 5. 同步追蹤表
CREATE TABLE IF NOT EXISTS sync_tracker (
  id SERIAL PRIMARY KEY,
  table_name VARCHAR(50),
  record_id VARCHAR(100),
  sheets_row_number INTEGER,
  last_synced TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(table_name, record_id)
);

-- ==================== 索引 ====================

CREATE INDEX idx_candidates_status ON candidates(status);
CREATE INDEX idx_candidates_consultant ON candidates(consultant);
CREATE INDEX idx_candidates_email ON candidates(email);
CREATE INDEX idx_jobs_status ON jobs(job_status);
CREATE INDEX idx_jobs_title ON jobs(title);
CREATE INDEX idx_sync_log_table ON google_sheets_sync_log(table_name, sync_timestamp);

-- ==================== 視圖 ====================

CREATE OR REPLACE VIEW candidates_view AS
SELECT 
  candidate_id,
  name,
  email,
  consultant,
  status,
  stability_score,
  last_updated
FROM candidates
ORDER BY last_updated DESC;

CREATE OR REPLACE VIEW jobs_view AS
SELECT 
  job_id,
  title,
  client_company,
  department,
  job_status,
  headcount,
  salary_range,
  last_updated
FROM jobs
ORDER BY last_updated DESC;
