#!/bin/bash

# Step1ne Headhunter System - Stop Local Development Servers

echo "🛑 停止 Step1ne 獵頭系統本地服務..."

# 找到並停止 Vite Dev Server (Port 5173)
VITE_PID=$(lsof -ti:5173)
if [ ! -z "$VITE_PID" ]; then
    kill $VITE_PID
    echo "✅ 前端服務已停止 (Port 5173)"
else
    echo "ℹ️  前端服務未運行"
fi

# 找到並停止 Backend Server (Port 3001)
BACKEND_PID=$(lsof -ti:3001)
if [ ! -z "$BACKEND_PID" ]; then
    kill $BACKEND_PID
    echo "✅ 後端服務已停止 (Port 3001)"
else
    echo "ℹ️  後端服務未運行"
fi

echo ""
echo "✅ 所有服務已停止"
