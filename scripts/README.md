# Scripts 資料夾說明

此資料夾包含資料庫相關的腳本和工具。

## 📁 文件說明

### ✅ 可以上傳到 GitHub 的文件

- **`create-tables.sql`** - PostgreSQL 建表語句（不包含敏感資訊）
- **`migrate-to-postgres.ts`** - 資料遷移腳本（不包含敏感資訊）
- **`*.example`** - 示例文件（供參考用）
- **`README.md`** - 本說明文件

### ❌ 不應該上傳到 GitHub 的文件

- **`connect-postgres.sh`** - 包含資料庫密碼的連接腳本
- **`execute-sql.sh`** - 包含資料庫密碼的執行腳本

這些文件已加入 `.gitignore`，不會被提交到版本控制。

## 🚀 使用方式

### 1. 設置資料庫連接腳本

首次使用時，請複製示例文件：

```bash
# 複製連接腳本
cp scripts/connect-postgres.sh.example scripts/connect-postgres.sh

# 複製執行腳本
cp scripts/execute-sql.sh.example scripts/execute-sql.sh
```

然後編輯這些文件，填入實際的資料庫資訊。

### 2. 使用環境變數（推薦）

您也可以通過環境變數設置資料庫連接資訊：

```bash
export DB_HOST="tpe1.clusters.zeabur.com"
export DB_PORT="22704"
export DB_NAME="zeabur"
export DB_USER="root"
export DB_PASSWORD="your-password-here"
```

然後執行腳本，腳本會自動使用環境變數。

### 3. 執行 SQL

```bash
# 連接資料庫
bash scripts/connect-postgres.sh

# 執行建表 SQL
bash scripts/execute-sql.sh scripts/create-tables.sql
```

## 🔒 安全注意事項

1. **永遠不要將包含密碼的文件提交到 GitHub**
2. 使用 `.example` 文件作為模板
3. 在 Zeabur 中，可以使用環境變數設置資料庫連接資訊
4. 定期更換資料庫密碼

## 📝 Zeabur 部署說明

在 Zeabur 中部署時：

1. **不需要上傳包含密碼的腳本** - Zeabur 會自動提供資料庫連接資訊
2. **只需要上傳 SQL 文件** - `create-tables.sql` 可以在部署時執行
3. **使用環境變數** - 在 Zeabur 控制台設置資料庫連接環境變數

## 🔄 資料遷移

使用 `migrate-to-postgres.ts` 腳本可以將本地 localStorage 資料遷移到 PostgreSQL。

詳見主專案的 `pages/MigrationPage.tsx` 頁面，那裡提供了更友好的圖形界面。
