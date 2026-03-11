-- Phase 3: 動機與交易條件欄位
-- 執行方式：psql -d headhunter < scripts/add-phase3-motivation-fields.sql

-- 求職狀態
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS job_search_status VARCHAR(50);
-- 轉職原因
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS reason_for_change TEXT;
-- 主要動機
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS motivation VARCHAR(100);
-- 不適配條件（不接受的工作類型/環境）
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS deal_breakers TEXT;
-- 競爭 Offer
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS competing_offers TEXT;
-- 顧問關係程度
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS relationship_level VARCHAR(50);

-- 索引
CREATE INDEX IF NOT EXISTS idx_candidates_job_search_status ON candidates_pipeline(job_search_status);
CREATE INDEX IF NOT EXISTS idx_candidates_relationship_level ON candidates_pipeline(relationship_level);
