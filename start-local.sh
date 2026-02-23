#!/bin/bash

# Step1ne Headhunter System - Local Development Starter
# 本地開發環境一鍵啟動腳本

echo "🚀 Step1ne 獵頭系統 - 本地開發環境啟動中..."
echo ""

# 顏色定義
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 檢查 Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js 未安裝${NC}"
    echo "請先安裝 Node.js: https://nodejs.org/"
    exit 1
fi

echo -e "${GREEN}✅ Node.js 版本: $(node -v)${NC}"
echo ""

# 進入專案目錄
cd "$(dirname "$0")"

# 1. 安裝前端依賴（如果需要）
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 安裝前端依賴...${NC}"
    npm install
    echo ""
fi

# 2. 安裝後端依賴（如果需要）
if [ ! -d "server/node_modules" ]; then
    echo -e "${YELLOW}📦 安裝後端依賴...${NC}"
    cd server
    npm install
    cd ..
    echo ""
fi

# 3. 檢查環境變數
if [ ! -f ".env" ]; then
    echo -e "${RED}❌ 前端 .env 檔案不存在${NC}"
    exit 1
fi

if [ ! -f "server/.env" ]; then
    echo -e "${RED}❌ 後端 server/.env 檔案不存在${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 環境變數檔案已就緒${NC}"
echo ""

# 4. 啟動後端
echo -e "${BLUE}🔧 啟動後端 API Server (Port 3001)...${NC}"
cd server
npm start &
BACKEND_PID=$!
cd ..

# 等待後端啟動
echo "等待後端啟動..."
sleep 3

# 5. 啟動前端
echo ""
echo -e "${BLUE}🎨 啟動前端 Dev Server (Port 5173)...${NC}"
npm run dev &
FRONTEND_PID=$!

# 等待前端啟動
sleep 3

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Step1ne 獵頭系統已成功啟動！${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}📍 前端：${NC} http://localhost:5173"
echo -e "${BLUE}📍 後端：${NC} http://localhost:3001"
echo ""
echo -e "${YELLOW}💡 提示：${NC}"
echo "  • 前端會自動開啟瀏覽器"
echo "  • 修改程式碼會自動熱重載"
echo "  • 按 Ctrl+C 停止所有服務"
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# 等待用戶停止
wait $BACKEND_PID $FRONTEND_PID
