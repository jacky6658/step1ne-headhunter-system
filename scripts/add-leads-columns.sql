-- 添加缺失的欄位到 leads 表
-- 執行此腳本以修復 "更新案件失敗" 錯誤

-- 1. 添加 links 欄位（JSONB，存儲圖片連結）
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'leads' AND column_name = 'links'
    ) THEN
        ALTER TABLE leads ADD COLUMN links JSONB DEFAULT '[]'::jsonb;
        RAISE NOTICE '已添加 links 欄位';
    ELSE
        RAISE NOTICE 'links 欄位已存在';
    END IF;
END $$;

-- 2. 添加 contact_status 欄位（TEXT，聯絡狀態）
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'leads' AND column_name = 'contact_status'
    ) THEN
        ALTER TABLE leads ADD COLUMN contact_status TEXT DEFAULT '未回覆';
        RAISE NOTICE '已添加 contact_status 欄位';
    ELSE
        RAISE NOTICE 'contact_status 欄位已存在';
    END IF;
END $$;

-- 3. 驗證欄位是否添加成功
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'leads' 
  AND column_name IN ('links', 'contact_status')
ORDER BY column_name;
