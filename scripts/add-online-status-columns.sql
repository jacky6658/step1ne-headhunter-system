-- 添加在線狀態字段到 users 表
-- 執行此腳本以支持在線狀態功能

-- 添加 is_online 字段（布林值，預設為 false）
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false;

-- 添加 last_seen 字段（時間戳，記錄最後上線時間）
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ;

-- 創建索引以提升查詢效能
CREATE INDEX IF NOT EXISTS idx_users_is_online ON users(is_online) WHERE is_online = true;
CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users(last_seen);
