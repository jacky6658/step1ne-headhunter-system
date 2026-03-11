-- Phase 1: 新增候選人卡片欄位（匿名履歷 + 顧問評估）
-- 執行方式：psql -d headhunter < scripts/add-candidate-card-fields.sql

-- 基本識別 & 職涯
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS age INTEGER;
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS industry VARCHAR(255);
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS languages VARCHAR(500);
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS certifications TEXT;

-- 轉職條件
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS current_salary VARCHAR(100);
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS expected_salary VARCHAR(100);
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS notice_period VARCHAR(100);

-- 管理經驗
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS management_experience BOOLEAN DEFAULT FALSE;
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS team_size VARCHAR(50);

-- 顧問 5 維度評估（JSONB）
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS consultant_evaluation JSONB;

-- 索引
CREATE INDEX IF NOT EXISTS idx_candidates_industry ON candidates_pipeline(industry);
CREATE INDEX IF NOT EXISTS idx_candidates_age ON candidates_pipeline(age);
