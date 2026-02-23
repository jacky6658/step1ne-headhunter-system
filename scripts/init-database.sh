#!/bin/bash

# AI案件管理系統 - 資料庫初始化腳本
# 使用方法：
#   ./scripts/init-database.sh
#   或
#   bash scripts/init-database.sh

# 顏色定義
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== AI案件管理系統 - 資料庫初始化 ===${NC}\n"

# 檢查是否提供了資料庫連接資訊
if [ -z "$POSTGRES_HOST" ] && [ -z "$DB_HOST" ]; then
    echo -e "${YELLOW}提示：如果使用環境變數，請先設置：${NC}"
    echo "  export POSTGRES_HOST=your_host"
    echo "  export POSTGRES_PORT=5432"
    echo "  export POSTGRES_DATABASE=your_database"
    echo "  export POSTGRES_USER=your_user"
    echo "  export POSTGRES_PASSWORD=your_password"
    echo ""
    echo -e "${YELLOW}或直接在命令中提供參數：${NC}"
    echo "  ./scripts/init-database.sh host port database user password"
    echo ""
    
    # 嘗試從 .env 文件讀取（如果存在）
    if [ -f .env ]; then
        echo -e "${GREEN}發現 .env 文件，嘗試讀取資料庫配置...${NC}"
        export $(grep -v '^#' .env | grep -E 'POSTGRES|DB_' | xargs)
    fi
fi

# 從參數或環境變數獲取資料庫連接資訊
DB_HOST=${1:-${POSTGRES_HOST:-${DB_HOST:-localhost}}}
DB_PORT=${2:-${POSTGRES_PORT:-${DB_PORT:-5432}}}
DB_NAME=${3:-${POSTGRES_DATABASE:-${DB_NAME:-${DATABASE_NAME:-postgres}}}}
DB_USER=${4:-${POSTGRES_USER:-${DB_USER:-${DATABASE_USER:-postgres}}}}
DB_PASSWORD=${5:-${POSTGRES_PASSWORD:-${DB_PASSWORD:-${DATABASE_PASSWORD}}}}

# 檢查必要的參數
if [ -z "$DB_HOST" ] || [ -z "$DB_NAME" ] || [ -z "$DB_USER" ]; then
    echo -e "${RED}❌ 錯誤：缺少必要的資料庫連接資訊${NC}"
    echo "請提供：主機、資料庫名稱、用戶名"
    exit 1
fi

# 設置密碼環境變數（PostgreSQL 會自動讀取）
export PGPASSWORD=$DB_PASSWORD

echo -e "${GREEN}連接資訊：${NC}"
echo "  主機: $DB_HOST"
echo "  端口: $DB_PORT"
echo "  資料庫: $DB_NAME"
echo "  用戶: $DB_USER"
echo ""

# 執行 SQL 腳本
SQL_FILE="scripts/init-database.sql"

if [ ! -f "$SQL_FILE" ]; then
    echo -e "${RED}❌ 錯誤：找不到 SQL 文件 $SQL_FILE${NC}"
    exit 1
fi

echo -e "${YELLOW}正在執行資料庫初始化...${NC}\n"

# 執行 SQL
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$SQL_FILE"

# 檢查執行結果
if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}✅ 資料庫初始化成功！${NC}"
    echo -e "${GREEN}   所有表和欄位已創建完成${NC}"
else
    echo -e "\n${RED}❌ 資料庫初始化失敗${NC}"
    echo "請檢查："
    echo "  1. 資料庫連接資訊是否正確"
    echo "  2. 用戶是否有創建表的權限"
    echo "  3. PostgreSQL 服務是否運行"
    exit 1
fi

# 清除密碼環境變數
unset PGPASSWORD
