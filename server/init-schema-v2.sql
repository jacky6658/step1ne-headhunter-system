-- 重設表結構（完全匹配 CSV 欄位）
-- 執行前：DROP TABLE 舊表
-- 執行方式：psql < init-schema-v2.sql

DROP TABLE IF EXISTS candidates_pipeline CASCADE;
DROP TABLE IF EXISTS jobs_pipeline CASCADE;

-- ==================== 職缺表 ====================
CREATE TABLE jobs_pipeline (
  id SERIAL PRIMARY KEY,
  position_name VARCHAR(255),              -- 職位名稱
  client_company VARCHAR(255),              -- 客戶公司
  department VARCHAR(100),                  -- 部門
  open_positions VARCHAR(50),               -- 需求人數
  salary_range VARCHAR(100),                -- 薪資範圍
  key_skills TEXT,                          -- 主要技能（CSV）
  experience_required VARCHAR(255),         -- 經驗要求
  education_required VARCHAR(100),          -- 學歷要求
  location VARCHAR(100),                    -- 工作地點
  job_status VARCHAR(50),                   -- 職位狀態
  created_date VARCHAR(50),                 -- 建立日期
  last_updated VARCHAR(50),                 -- 最後更新
  language_required VARCHAR(100),           -- 語言要求
  special_conditions TEXT,                  -- 特殊條件
  industry_background VARCHAR(255),        -- 產業背景要求
  team_size VARCHAR(100),                   -- 團隊規模
  key_challenges TEXT,                      -- 關鍵挑戰
  attractive_points TEXT,                   -- 吸引亮點
  recruitment_difficulty TEXT,              -- 招募困難點
  interview_process TEXT,                   -- 面試流程
  consultant_notes TEXT,                    -- 顧問面談備註
  
  -- 系統欄位
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  sync_to_sheets_at TIMESTAMP
);

-- ==================== 候選人表 ====================
CREATE TABLE candidates_pipeline (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255),                        -- 姓名
  contact_link VARCHAR(500),                -- 連結／信箱
  phone VARCHAR(50),                        -- 電話
  location VARCHAR(100),                    -- 地點
  current_position VARCHAR(255),            -- 目前職位
  years_experience VARCHAR(50),             -- 總年資(年)
  job_changes VARCHAR(50),                  -- 轉職次數
  avg_tenure_months VARCHAR(50),            -- 平均任職(月)
  recent_gap_months VARCHAR(50),            -- 最近gap(月)
  skills TEXT,                              -- 技能（CSV）
  education VARCHAR(100),                   -- 學歷
  source VARCHAR(100),                      -- 來源
  work_history JSONB,                       -- 工作經歷JSON
  leaving_reason TEXT,                      -- 離職原因
  stability_score VARCHAR(50),              -- 穩定性評分
  education_details JSONB,                  -- 學歷JSON
  personality_type VARCHAR(100),            -- DISC/Big Five
  status VARCHAR(50),                       -- 狀態
  recruiter VARCHAR(100),                   -- 獵頭顧問
  notes TEXT,                               -- 備註
  talent_level VARCHAR(50),                 -- 人才等級
  
  -- 系統欄位
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  sync_to_sheets_at TIMESTAMP
);

-- 建立索引以提升查詢效率
CREATE INDEX idx_candidates_status ON candidates_pipeline(status);
CREATE INDEX idx_candidates_recruiter ON candidates_pipeline(recruiter);
CREATE INDEX idx_candidates_name ON candidates_pipeline(name);
CREATE INDEX idx_jobs_status ON jobs_pipeline(job_status);
CREATE INDEX idx_jobs_company ON jobs_pipeline(client_company);
CREATE INDEX idx_jobs_position ON jobs_pipeline(position_name);
