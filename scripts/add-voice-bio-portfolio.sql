-- 語音評估 + 自傳 + 作品集 欄位
-- 執行方式：psql -d headhunter < scripts/add-voice-bio-portfolio.sql

-- 語音評估（JSONB 陣列）
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS voice_assessments JSONB DEFAULT '[]';
-- 自傳
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS biography TEXT;
-- 作品集連結
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS portfolio_url VARCHAR(500);
