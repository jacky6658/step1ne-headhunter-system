-- 修復資料庫：添加缺失的欄位
-- 執行此腳本以修復 "column is_online does not exist" 錯誤

-- 1. 添加 is_online 欄位（如果不存在）
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'is_online'
    ) THEN
        ALTER TABLE users ADD COLUMN is_online BOOLEAN DEFAULT false;
        RAISE NOTICE '已添加 is_online 欄位';
    ELSE
        RAISE NOTICE 'is_online 欄位已存在';
    END IF;
END $$;

-- 2. 添加 last_seen 欄位（如果不存在）
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'last_seen'
    ) THEN
        ALTER TABLE users ADD COLUMN last_seen TIMESTAMPTZ;
        RAISE NOTICE '已添加 last_seen 欄位';
    ELSE
        RAISE NOTICE 'last_seen 欄位已存在';
    END IF;
END $$;

-- 3. 添加 is_active 欄位（如果不存在，某些查詢可能需要）
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'is_active'
    ) THEN
        ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT true;
        RAISE NOTICE '已添加 is_active 欄位';
    ELSE
        RAISE NOTICE 'is_active 欄位已存在';
    END IF;
END $$;

-- 4. 創建索引以提升查詢效能
CREATE INDEX IF NOT EXISTS idx_users_is_online ON users(is_online) WHERE is_online = true;
CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users(last_seen);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active) WHERE is_active = true;

-- 5. 驗證欄位是否添加成功
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND column_name IN ('is_online', 'last_seen', 'is_active')
ORDER BY column_name;
