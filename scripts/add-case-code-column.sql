-- 添加案件編號欄位
-- 執行此腳本以在現有的 leads 表中添加 case_code 欄位

ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS case_code TEXT;

-- 為現有案件生成編號（可選，如果需要為現有案件添加編號）
-- 注意：這會為所有沒有編號的案件生成編號，從 aijob-001 開始
-- 如果需要，可以手動執行以下查詢來為現有案件添加編號

-- 創建一個函數來為現有案件生成編號
DO $$
DECLARE
  lead_record RECORD;
  counter INTEGER := 1;
BEGIN
  -- 為所有沒有 case_code 的案件生成編號
  FOR lead_record IN 
    SELECT id FROM leads WHERE case_code IS NULL ORDER BY created_at ASC
  LOOP
    UPDATE leads 
    SET case_code = 'aijob-' || LPAD(counter::TEXT, 3, '0')
    WHERE id = lead_record.id;
    counter := counter + 1;
  END LOOP;
END $$;
