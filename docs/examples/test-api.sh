#!/bin/bash

# Step1ne API 快速測試腳本
# 測試所有主要 API 端點

API_BASE="http://localhost:3001/api"

echo "🧪 Step1ne API 快速測試"
echo "================================"
echo ""

# 測試 1: Health Check
echo "1️⃣ 測試 Health Check"
curl -s "${API_BASE}/health" | python3 -m json.tool
echo ""
echo ""

# 測試 2: 取得所有候選人
echo "2️⃣ 測試候選人列表 API"
CANDIDATES=$(curl -s "${API_BASE}/candidates")
echo $CANDIDATES | python3 -c "import sys, json; data = json.load(sys.stdin); print(f'總候選人數: {data[\"count\"]}')"
echo ""

# 測試 3: 取得單一候選人
echo "3️⃣ 測試單一候選人 API"
CANDIDATE_ID=$(echo $CANDIDATES | python3 -c "import sys, json; data = json.load(sys.stdin); print(data['data'][0]['id'] if data['data'] else '')")
if [ -n "$CANDIDATE_ID" ]; then
  curl -s "${API_BASE}/candidates/${CANDIDATE_ID}" | python3 -c "import sys, json; data = json.load(sys.stdin); print(f'候選人: {data[\"data\"][\"name\"]} - {data[\"data\"][\"currentJobTitle\"]}')"
else
  echo "❌ 沒有候選人資料"
fi
echo ""
echo ""

# 測試 4: 取得所有職缺
echo "4️⃣ 測試職缺列表 API"
JOBS=$(curl -s "${API_BASE}/jobs")
echo $JOBS | python3 -c "import sys, json; data = json.load(sys.stdin); print(f'總職缺數: {data[\"count\"]}')"
echo ""

# 測試 5: 取得單一職缺
echo "5️⃣ 測試單一職缺 API"
JOB_ID=$(echo $JOBS | python3 -c "import sys, json; data = json.load(sys.stdin); print(data['data'][0]['id'] if data['data'] else '')")
if [ -n "$JOB_ID" ]; then
  curl -s "${API_BASE}/jobs/${JOB_ID}" | python3 -c "import sys, json; data = json.load(sys.stdin); print(f'職缺: {data[\"data\"][\"title\"]} ({data[\"data\"][\"company\"][\"name\"]})')"
else
  echo "❌ 沒有職缺資料"
fi
echo ""
echo ""

# 測試 6: 批量配對 API（需要 Python 環境）
echo "6️⃣ 測試 AI 批量配對 API"
if command -v python3 &> /dev/null; then
  python3 python-bot.py > /dev/null 2>&1
  if [ $? -eq 0 ]; then
    echo "✅ AI 配對測試成功（詳細結果請執行 python3 python-bot.py）"
  else
    echo "⚠️ AI 配對測試失敗（請檢查 Python 環境）"
  fi
else
  echo "⚠️ 未安裝 Python3，跳過配對測試"
fi
echo ""

echo "================================"
echo "✅ 測試完成！"
echo ""
echo "📚 完整 API 文檔: docs/API.md"
echo "🤖 Bot 整合範例: docs/bot-examples/"
