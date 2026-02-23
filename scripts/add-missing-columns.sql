-- 添加缺失的欄位到 leads 表
-- 執行此腳本以添加 case_code, cost_records, profit_records, contracts 欄位

-- 1. 添加 case_code 欄位（案件編號，例如：aijob-001）
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'leads' AND column_name = 'case_code'
    ) THEN
        ALTER TABLE leads ADD COLUMN case_code TEXT;
        RAISE NOTICE '已添加 case_code 欄位';
    ELSE
        RAISE NOTICE 'case_code 欄位已存在';
    END IF;
END $$;

-- 2. 添加 cost_records 欄位（成本記錄，JSONB）
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'leads' AND column_name = 'cost_records'
    ) THEN
        ALTER TABLE leads ADD COLUMN cost_records JSONB DEFAULT '[]'::jsonb;
        RAISE NOTICE '已添加 cost_records 欄位';
    ELSE
        RAISE NOTICE 'cost_records 欄位已存在';
    END IF;
END $$;

-- 3. 添加 profit_records 欄位（利潤記錄，JSONB）
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'leads' AND column_name = 'profit_records'
    ) THEN
        ALTER TABLE leads ADD COLUMN profit_records JSONB DEFAULT '[]'::jsonb;
        RAISE NOTICE '已添加 profit_records 欄位';
    ELSE
        RAISE NOTICE 'profit_records 欄位已存在';
    END IF;
END $$;

-- 4. 添加 contracts 欄位（合約文件，JSONB）
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'leads' AND column_name = 'contracts'
    ) THEN
        ALTER TABLE leads ADD COLUMN contracts JSONB DEFAULT '[]'::jsonb;
        RAISE NOTICE '已添加 contracts 欄位';
    ELSE
        RAISE NOTICE 'contracts 欄位已存在';
    END IF;
END $$;

-- 5. 驗證欄位是否添加成功
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'leads' 
  AND column_name IN ('case_code', 'cost_records', 'profit_records', 'contracts')
ORDER BY column_name;
