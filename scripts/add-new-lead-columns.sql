-- 添加新欄位到 leads 表
-- 執行此腳本以添加「預計製作週期」和「客戶聯繫方式」欄位

-- 1. 添加 estimated_duration 欄位（預計製作週期）
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'leads' AND column_name = 'estimated_duration'
    ) THEN
        ALTER TABLE leads ADD COLUMN estimated_duration TEXT;
        RAISE NOTICE '已添加 estimated_duration 欄位';
    ELSE
        RAISE NOTICE 'estimated_duration 欄位已存在';
    END IF;
END $$;

-- 2. 添加 contact_method 欄位（客戶聯繫方式）
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'leads' AND column_name = 'contact_method'
    ) THEN
        ALTER TABLE leads ADD COLUMN contact_method TEXT;
        RAISE NOTICE '已添加 contact_method 欄位';
    ELSE
        RAISE NOTICE 'contact_method 欄位已存在';
    END IF;
END $$;
