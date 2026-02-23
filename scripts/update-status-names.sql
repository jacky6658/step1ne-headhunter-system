-- 更新狀態名稱的遷移腳本
-- 將舊的狀態名稱更新為新的狀態名稱

-- 1. 將「拒絕」狀態更新為「取消」
UPDATE leads 
SET status = '取消'
WHERE status = '拒絕';

-- 2. 將「婉拒」狀態更新為「婉拒/無法聯繫」（如果資料庫中有舊的「婉拒」狀態）
UPDATE leads 
SET status = '婉拒/無法聯繫'
WHERE status = '婉拒';

-- 3. 驗證更新結果
SELECT 
    status,
    COUNT(*) as count
FROM leads
GROUP BY status
ORDER BY count DESC;

-- 4. 顯示更新前後的對照
SELECT 
    CASE 
        WHEN status = '取消' THEN '✅ 已更新為「取消」'
        WHEN status = '婉拒/無法聯繫' THEN '✅ 已更新為「婉拒/無法聯繫」'
        ELSE '其他狀態：' || status
    END as status_info,
    COUNT(*) as count
FROM leads
GROUP BY status
ORDER BY count DESC;
