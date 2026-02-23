-- 初始化預設用戶到資料庫
-- 如果資料庫是空的，執行此腳本創建預設用戶

-- 插入預設用戶（如果不存在）
INSERT INTO users (id, email, display_name, role, created_at, is_active, is_online)
VALUES 
  ('admin', 'admin@aijob.internal', 'Admin', 'ADMIN', NOW(), true, false),
  ('phoebe', 'phoebe@aijob.internal', 'Phoebe', 'REVIEWER', NOW(), true, false),
  ('jacky', 'jacky@aijob.internal', 'Jacky', 'REVIEWER', NOW(), true, false),
  ('jim', 'jim@aijob.internal', 'Jim', 'REVIEWER', NOW(), true, false)
ON CONFLICT (id) DO NOTHING;

-- 驗證用戶是否創建成功
SELECT id, email, display_name, role, is_active 
FROM users 
ORDER BY role, display_name;
