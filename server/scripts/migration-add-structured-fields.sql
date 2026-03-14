-- =====================================================
-- Step1ne: Sprint 1 - Add Structured Candidate Fields
-- Purpose: Layer 1 (Match Core) + Layer 2 (Deal/Timing) + Layer 3 (Enrichment) + Talent Board
-- Strategy: ADD COLUMN IF NOT EXISTS - safe to re-run
-- =====================================================

-- ==================== Layer 1: Match Core ====================
-- These fields power AI first-round matching

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

-- ==================== Layer 2: Deal / Timing ====================
-- Fields that types.ts references but migration scripts were missing

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

-- ==================== Layer 3: Enrichment / Meta ====================

ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS education_summary TEXT;
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS resume_assets JSONB;
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS auto_derived JSONB;
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS data_quality JSONB;

-- ==================== Talent Board: 3-Layer Classification ====================

ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS grade_level VARCHAR(2);
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS source_tier VARCHAR(2);
ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS heat_level VARCHAR(10);

-- ==================== Indexes ====================

CREATE INDEX IF NOT EXISTS idx_cp_role_family ON candidates_pipeline(role_family);
CREATE INDEX IF NOT EXISTS idx_cp_industry_tag ON candidates_pipeline(industry_tag);
CREATE INDEX IF NOT EXISTS idx_cp_grade_level ON candidates_pipeline(grade_level);
CREATE INDEX IF NOT EXISTS idx_cp_heat_level ON candidates_pipeline(heat_level);
CREATE INDEX IF NOT EXISTS idx_cp_source_tier ON candidates_pipeline(source_tier);
CREATE INDEX IF NOT EXISTS idx_cp_seniority ON candidates_pipeline(seniority_level);
CREATE INDEX IF NOT EXISTS idx_cp_notice_period_enum ON candidates_pipeline(notice_period_enum);
CREATE INDEX IF NOT EXISTS idx_cp_job_search_status_enum ON candidates_pipeline(job_search_status_enum);

-- GIN index for JSONB skill search
CREATE INDEX IF NOT EXISTS idx_cp_normalized_skills ON candidates_pipeline USING GIN (normalized_skills);
