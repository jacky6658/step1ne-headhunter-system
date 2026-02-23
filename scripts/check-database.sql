-- 檢查資料庫結構是否完整

-- 1. 檢查表是否存在
SELECT 
    'Tables' as type,
    table_name as name,
    'OK' as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('users', 'leads', 'audit_logs')
ORDER BY table_name;

-- 2. 檢查 leads 表的所有欄位
SELECT 
    'Columns' as type,
    column_name as name,
    data_type as info,
    CASE 
        WHEN column_name IN ('estimated_duration', 'contact_method', 'case_code', 'cost_records', 'profit_records', 'contracts', 'contact_status') 
        THEN '✅ 新欄位'
        ELSE '標準欄位'
    END as status
FROM information_schema.columns 
WHERE table_name = 'leads' 
ORDER BY ordinal_position;

-- 3. 檢查索引
SELECT 
    'Indexes' as type,
    indexname as name,
    'OK' as status
FROM pg_indexes 
WHERE tablename IN ('users', 'leads', 'audit_logs')
ORDER BY tablename, indexname;

-- 4. 檢查觸發器
SELECT 
    'Triggers' as type,
    trigger_name as name,
    event_manipulation as event,
    'OK' as status
FROM information_schema.triggers 
WHERE event_object_table = 'leads';

-- 5. 檢查函數
SELECT 
    'Functions' as type,
    routine_name as name,
    'OK' as status
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name = 'update_updated_at_column';
