-- 添加缺失的欄位：estimated_duration 和 contact_method

-- 添加 estimated_duration 欄位（預計製作週期）
ALTER TABLE leads ADD COLUMN IF NOT EXISTS estimated_duration TEXT;

-- 添加 contact_method 欄位（客戶聯繫方式）
ALTER TABLE leads ADD COLUMN IF NOT EXISTS contact_method TEXT;

-- 驗證欄位是否添加成功
SELECT 
    column_name, 
    data_type,
    CASE 
        WHEN column_name IN ('estimated_duration', 'contact_method') 
        THEN '✅ 新添加'
        ELSE '已存在'
    END as status
FROM information_schema.columns 
WHERE table_name = 'leads' 
  AND column_name IN ('estimated_duration', 'contact_method', 'case_code', 'cost_records', 'profit_records', 'contracts', 'contact_status')
ORDER BY column_name;
