-- 檢查在線狀態功能是否正常設置
-- 執行此腳本以診斷在線狀態問題

-- 1. 檢查 users 表是否有 is_online 和 last_seen 字段
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND column_name IN ('is_online', 'last_seen')
ORDER BY column_name;

-- 2. 檢查所有用戶的在線狀態
SELECT 
  id,
  display_name,
  is_online,
  last_seen,
  CASE 
    WHEN is_online = true THEN '在線'
    WHEN last_seen IS NOT NULL THEN '離線（最後上線: ' || last_seen::text || '）'
    ELSE '從未上線'
  END AS status
FROM users
ORDER BY is_online DESC, last_seen DESC NULLS LAST;

-- 3. 統計在線用戶數量
SELECT 
  COUNT(*) FILTER (WHERE is_online = true) AS online_count,
  COUNT(*) FILTER (WHERE is_online = false OR is_online IS NULL) AS offline_count,
  COUNT(*) AS total_users
FROM users;
