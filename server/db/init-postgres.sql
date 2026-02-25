-- PostgreSQL 初始化腳本
-- 在 Zeabur PostgreSQL 中執行此腳本

-- 1. 創建 candidates_pipeline 表
CREATE TABLE IF NOT EXISTS candidates_pipeline (
  id VARCHAR(100) PRIMARY KEY,
  candidate_id VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
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

-- 2. 創建 google_sheets_sync 日誌表（用來追蹤同步狀態）
CREATE TABLE IF NOT EXISTS google_sheets_sync_log (
  id SERIAL PRIMARY KEY,
  candidate_id VARCHAR(100),
  action VARCHAR(50),
  old_status VARCHAR(100),
  new_status VARCHAR(100),
  synced_to_sheets BOOLEAN DEFAULT FALSE,
  sheets_row_number INTEGER,
  sync_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  error_message TEXT
);

-- 3. 創建 candidates_sync 表（用來管理 SQL <-> Google Sheets 同步）
CREATE TABLE IF NOT EXISTS candidates_sync (
  id SERIAL PRIMARY KEY,
  candidate_id VARCHAR(100) UNIQUE,
  sheets_row_number INTEGER,
  sheets_last_modified TIMESTAMP,
  sql_last_modified TIMESTAMP,
  last_synced TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  sync_direction VARCHAR(20) DEFAULT 'bidirectional'
);

-- 4. 創建索引以提升查詢性能
CREATE INDEX idx_candidates_pipeline_status ON candidates_pipeline(status);
CREATE INDEX idx_candidates_pipeline_consultant ON candidates_pipeline(consultant);
CREATE INDEX idx_sync_log_timestamp ON google_sheets_sync_log(sync_timestamp);

-- 5. 初始化視圖（用於快速查詢）
CREATE OR REPLACE VIEW candidates_pipeline_view AS
SELECT 
  cp.id,
  cp.candidate_id,
  cp.name,
  cp.status,
  cp.consultant,
  cp.notes,
  cp.last_updated,
  gsl.sync_timestamp as last_sync
FROM candidates_pipeline cp
LEFT JOIN google_sheets_sync_log gsl ON cp.candidate_id = gsl.candidate_id
ORDER BY cp.last_updated DESC;

COMMIT;
