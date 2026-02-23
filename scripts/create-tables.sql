-- CaseFlow CRM 資料庫建表語句
-- 適用於 PostgreSQL

-- 啟用 UUID 擴展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. 使用者表
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT CHECK (role IN ('ADMIN', 'REVIEWER')) DEFAULT 'REVIEWER',
  avatar TEXT,
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 案件表
CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  case_code TEXT, -- 案件編號（例如：aijob-001）
  platform TEXT NOT NULL DEFAULT 'FB',
  platform_id TEXT,
  need TEXT NOT NULL,
  budget_text TEXT,
  posted_at TIMESTAMPTZ,
  phone TEXT,
  email TEXT,
  location TEXT,
  note TEXT,
  internal_remarks TEXT,
  remarks_author TEXT,
  status TEXT DEFAULT '待篩選',
  decision TEXT DEFAULT 'pending',
  decision_by TEXT,
  reject_reason TEXT,
  review_note TEXT,
  assigned_to TEXT,
  assigned_to_name TEXT,
  priority INTEGER DEFAULT 3,
  created_by TEXT,
  created_by_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_action_by TEXT,
  progress_updates JSONB,
  change_history JSONB
);

-- 3. 審計日誌表
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  lead_id TEXT REFERENCES leads(id) ON DELETE CASCADE,
  actor_uid TEXT,
  actor_name TEXT NOT NULL,
  action TEXT NOT NULL,
  before JSONB,
  after JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 建立索引以提升查詢效能
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);
CREATE INDEX IF NOT EXISTS idx_leads_created_by ON leads(created_by);
CREATE INDEX IF NOT EXISTS idx_audit_logs_lead_id ON audit_logs(lead_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- 建立更新時間自動更新觸發器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
