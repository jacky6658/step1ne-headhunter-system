#!/bin/bash
# Simplified E2E Integration Test

set -e

API_URL="http://localhost:3001"
FRONTEND_URL="http://localhost:3000"

echo "=========================================="
echo "AI 配對推薦系統 - 簡化整合測試"
echo "=========================================="
echo ""

# Test 1: Health Check
echo "Test 1: 服務健康檢查"
curl -s "$API_URL/api/health" | jq '{status, service}'
echo ""

# Test 2: Get Candidates
echo "Test 2: 候選人資料載入"
CANDIDATES=$(curl -s "$API_URL/api/candidates")
TOTAL=$(echo "$CANDIDATES" | jq -r '.count')
echo "✓ 成功載入 $TOTAL 位候選人"
echo ""
echo "前 3 位候選人："
echo "$CANDIDATES" | jq -r '.data[0:3] | .[] | "  - \(.name) (\(.position))"'
echo ""

# Test 3: Batch Match (核心功能測試)
echo "Test 3: 批量配對測試（5 位候選人）"
echo ""

BATCH_RESULT=$(curl -s -X POST "$API_URL/api/personas/batch-match" \
  -H "Content-Type: application/json" \
  -d '{
    "job": {
      "title": "AI 工程師",
      "department": "技術部",
      "requiredSkills": ["Python", "Machine Learning"],
      "preferredSkills": ["PyTorch"],
      "yearsRequired": 3,
      "educationRequired": "大學",
      "responsibilities": ["開發 AI 模型"],
      "benefits": ["彈性工時"]
    },
    "company": {
      "name": "創新科技股份有限公司",
      "industry": "軟體科技",
      "size": "100-500",
      "stage": "成長期",
      "culture": "自主型",
      "techStack": ["Python", "PyTorch"],
      "workLocation": "台北",
      "remotePolicy": "混合辦公"
    },
    "candidateIds": ["candidate-2", "candidate-3", "candidate-4", "candidate-5", "candidate-6"]
  }')

SUCCESS=$(echo "$BATCH_RESULT" | jq -r '.success')

if [ "$SUCCESS" = "true" ]; then
    echo "✓ 批量配對成功"
    echo ""
    echo "配對摘要："
    echo "$BATCH_RESULT" | jq '.result.summary | {
      total_candidates,
      average_score,
      grade_distribution
    }'
    echo ""
    echo "Top 5 推薦："
    echo "$BATCH_RESULT" | jq -r '.result.summary.top_5[] | "  \(.name) - \(.total_score)分 (\(.grade)級)"'
    echo ""
    echo "✓ 所有測試通過！"
else
    echo "✗ 批量配對失敗"
    echo "$BATCH_RESULT" | jq '.'
    exit 1
fi

echo ""
echo "=========================================="
echo "手動測試指引"
echo "=========================================="
echo ""
echo "1. 訪問前端: $FRONTEND_URL"
echo "2. 登入系統（任意帳號，例如 admin / jacky / phoebe）"
echo "3. 點擊側邊欄「🤖 AI 配對推薦」"
echo "4. 預覽職缺與公司資訊 → 點擊「選擇候選人開始配對」"
echo "5. 選擇 3-5 位候選人 → 點擊「開始 AI 配對」"
echo "6. 等待配對完成（約 30-60 秒）"
echo "7. 查看配對結果："
echo "   - 摘要統計（總候選人、平均分、等級分布）"
echo "   - Top 5 推薦"
echo "   - 詳細配對報告（維度評分、適配亮點、風險提示、建議）"
echo ""
echo "=========================================="
