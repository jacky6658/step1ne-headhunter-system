# 資料庫初始化指南

## 快速開始

### 方法 1：使用 Shell 腳本（推薦）

```bash
# 設置環境變數
export POSTGRES_HOST=your_host
export POSTGRES_PORT=5432
export POSTGRES_DATABASE=your_database
export POSTGRES_USER=your_user
export POSTGRES_PASSWORD=your_password

# 執行初始化腳本
./scripts/init-database.sh
```

或直接在命令中提供參數：

```bash
./scripts/init-database.sh host port database user password
```

### 方法 2：直接使用 psql

```bash
# 設置密碼環境變數
export PGPASSWORD=your_password

# 執行 SQL 腳本
psql -h your_host -p 5432 -U your_user -d your_database -f scripts/init-database.sql

# 清除密碼環境變數
unset PGPASSWORD
```

### 方法 3：使用連接字串

```bash
psql "postgresql://user:password@host:port/database" -f scripts/init-database.sql
```

## 本地開發環境

如果使用本地 PostgreSQL：

```bash
# 使用預設的 postgres 用戶
psql -U postgres -d postgres -f scripts/init-database.sql

# 或創建新的資料庫
createdb aijob_db
psql -U postgres -d aijob_db -f scripts/init-database.sql
```

## 雲端部署（Zeabur）

在 Zeabur 環境中，環境變數會自動設置，只需：

```bash
# 在 Zeabur 的終端機中執行
psql $DATABASE_URL -f scripts/init-database.sql
```

## 驗證安裝

執行以下 SQL 查詢驗證表是否創建成功：

```sql
-- 檢查表是否存在
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('users', 'leads', 'audit_logs');

-- 檢查 leads 表的欄位
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'leads' 
ORDER BY ordinal_position;
```

## 注意事項

1. **備份資料**：如果資料庫中已有資料，請先備份
2. **權限**：確保資料庫用戶有創建表和索引的權限
3. **擴展**：腳本會自動啟用 `uuid-ossp` 擴展
4. **重複執行**：腳本使用 `IF NOT EXISTS`，可以安全地重複執行

## 故障排除

### 錯誤：permission denied
```bash
# 確保用戶有足夠權限
GRANT ALL PRIVILEGES ON DATABASE your_database TO your_user;
```

### 錯誤：extension "uuid-ossp" does not exist
```bash
# 手動安裝擴展
psql -U postgres -d your_database -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
```

### 錯誤：relation already exists
這是正常的，腳本使用 `IF NOT EXISTS`，不會重複創建。
