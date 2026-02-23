#!/bin/bash
# End-to-End Integration Test
# AI 配對推薦系統完整測試

set -e

API_URL="http://localhost:3001"
FRONTEND_URL="http://localhost:3000"

echo "=========================================="
echo "AI 配對推薦系統 - 端到端整合測試"
echo "=========================================="
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

success() {
    echo -e "${GREEN}✓${NC} $1"
}

error() {
    echo -e "${RED}✗${NC} $1"
}

info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

# Test 1: 檢查服務運行狀態
echo "=========================================="
echo "Test 1: 服務健康檢查"
echo "=========================================="
echo ""

info "檢查後端 API..."
if curl -s "$API_URL/api/health" > /dev/null 2>&1; then
    HEALTH=$(curl -s "$API_URL/api/health" | jq -r '.status')
    if [ "$HEALTH" = "ok" ]; then
        success "後端 API 運行正常 ($API_URL)"
    else
        error "後端 API 狀態異常"
        exit 1
    fi
else
    error "無法連接後端 API"
    exit 1
fi

info "檢查前端服務..."
if curl -s "$FRONTEND_URL" > /dev/null 2>&1; then
    success "前端服務運行正常 ($FRONTEND_URL)"
else
    error "無法連接前端服務"
    exit 1
fi

echo ""

# Test 2: 候選人資料載入
echo "=========================================="
echo "Test 2: 候選人資料載入"
echo "=========================================="
echo ""

CANDIDATES_RESPONSE=$(curl -s "$API_URL/api/candidates")
CANDIDATES_COUNT=$(echo "$CANDIDATES_RESPONSE" | jq -r '.count')

if [ "$CANDIDATES_COUNT" -gt 0 ]; then
    success "成功載入 $CANDIDATES_COUNT 位候選人"
    
    # 顯示前 3 位候選人
    echo ""
    echo "前 3 位候選人："
    echo "$CANDIDATES_RESPONSE" | jq -r '.data[0:3] | .[] | "  - \(.name) (\(.position))"'
else
    error "無候選人資料"
    exit 1
fi

echo ""

# Test 3: 生成候選人畫像
echo "=========================================="
echo "Test 3: 生成候選人畫像"
echo "=========================================="
echo ""

CANDIDATE_ID=$(echo "$CANDIDATES_RESPONSE" | jq -r '.data[0].id')
CANDIDATE_NAME=$(echo "$CANDIDATES_RESPONSE" | jq -r '.data[0].name')

info "測試候選人: $CANDIDATE_NAME ($CANDIDATE_ID)"

PERSONA_RESPONSE=$(curl -s -X POST "$API_URL/api/personas/generate-candidate" \
    -H "Content-Type: application/json" \
    -d "{\"candidateId\": \"$CANDIDATE_ID\"}")

PERSONA_SUCCESS=$(echo "$PERSONA_RESPONSE" | jq -r '.success')

if [ "$PERSONA_SUCCESS" = "true" ]; then
    success "成功生成候選人畫像"
    
    # 顯示人才畫像關鍵資訊
    echo ""
    echo "人才畫像預覽："
    echo "$PERSONA_RESPONSE" | jq -r '.persona["基本結構"]["職稱"] // "N/A" | "  職稱: \(.)"'
    echo "$PERSONA_RESPONSE" | jq -r '.persona["性格與工作風格"]["類型"] // "N/A" | "  工作風格: \(.)"'
else
    error "生成人才畫像失敗"
    echo "$PERSONA_RESPONSE" | jq '.'
    exit 1
fi

echo ""

# Test 4: 批量配對測試
echo "=========================================="
echo "Test 4: 批量配對測試（核心功能）"
echo "=========================================="
echo ""

# 選擇前 5 位候選人
CANDIDATE_IDS=$(echo "$CANDIDATES_RESPONSE" | jq -r '[.data[0:5] | .[] | .id] | join("\", \"")')
CANDIDATE_COUNT=$(echo "$CANDIDATES_RESPONSE" | jq -r '.data[0:5] | length')

info "選擇 $CANDIDATE_COUNT 位候選人進行批量配對..."

BATCH_MATCH_RESPONSE=$(curl -s -X POST "$API_URL/api/personas/batch-match" \
    -H "Content-Type: application/json" \
    -d "{
        \"job\": {
            \"title\": \"AI 工程師\",
            \"department\": \"技術部\",
            \"requiredSkills\": [\"Python\", \"Machine Learning\", \"Deep Learning\"],
            \"preferredSkills\": [\"PyTorch\", \"TensorFlow\"],
            \"yearsRequired\": 3,
            \"educationRequired\": \"大學\",
            \"responsibilities\": [\"開發 AI 模型\", \"資料處理\"],
            \"benefits\": [\"彈性工時\", \"遠端辦公\"]
        },
        \"company\": {
            \"name\": \"創新科技股份有限公司\",
            \"industry\": \"軟體科技\",
            \"size\": \"100-500\",
            \"stage\": \"成長期\",
            \"culture\": \"自主型\",
            \"techStack\": [\"Python\", \"PyTorch\", \"AWS\"],
            \"workLocation\": \"台北\",
            \"remotePolicy\": \"混合辦公\"
        },
        \"candidateIds\": [\"$CANDIDATE_IDS\"]
    }")

BATCH_SUCCESS=$(echo "$BATCH_MATCH_RESPONSE" | jq -r '.success')

if [ "$BATCH_SUCCESS" = "true" ]; then
    success "批量配對成功"
    
    # 顯示配對摘要
    echo ""
    echo "配對摘要："
    TOTAL=$(echo "$BATCH_MATCH_RESPONSE" | jq -r '.result.summary.total_candidates')
    AVG_SCORE=$(echo "$BATCH_MATCH_RESPONSE" | jq -r '.result.summary.average_score')
    GRADE_S=$(echo "$BATCH_MATCH_RESPONSE" | jq -r '.result.summary.grade_distribution.S')
    GRADE_A=$(echo "$BATCH_MATCH_RESPONSE" | jq -r '.result.summary.grade_distribution.A')
    GRADE_B=$(echo "$BATCH_MATCH_RESPONSE" | jq -r '.result.summary.grade_distribution.B')
    GRADE_C=$(echo "$BATCH_MATCH_RESPONSE" | jq -r '.result.summary.grade_distribution.C')
    GRADE_D=$(echo "$BATCH_MATCH_RESPONSE" | jq -r '.result.summary.grade_distribution.D')
    
    echo "  總候選人數: $TOTAL"
    echo "  平均分: $AVG_SCORE"
    echo "  等級分布: S×$GRADE_S, A×$GRADE_A, B×$GRADE_B, C×$GRADE_C, D×$GRADE_D"
    
    # 顯示 Top 3 推薦
    echo ""
    echo "Top 3 推薦："
    echo "$BATCH_MATCH_RESPONSE" | jq -r '.result.summary.top_5[0:3] | .[] | "  \(.name) - \(.total_score)分 (\(.grade)級) [優先級: \(.priority)]"'
    
    # 詳細配對報告（第一位候選人）
    echo ""
    echo "詳細配對報告（Top 1）："
    FIRST_MATCH=$(echo "$BATCH_MATCH_RESPONSE" | jq -r '.result.matches[0]')
    
    echo "$FIRST_MATCH" | jq -r '"  候選人: \(.candidate.name)"'
    echo "$FIRST_MATCH" | jq -r '"  總分: \(.總分) / 100"'
    echo "$FIRST_MATCH" | jq -r '"  等級: \(.等級)級"'
    echo "$FIRST_MATCH" | jq -r '"  推薦優先級: \(.推薦優先級)"'
    
    echo ""
    echo "  維度評分："
    echo "$FIRST_MATCH" | jq -r '.維度評分 | "    技能匹配: \(.技能匹配)"'
    echo "$FIRST_MATCH" | jq -r '.維度評分 | "    成長匹配: \(.成長匹配)"'
    echo "$FIRST_MATCH" | jq -r '.維度評分 | "    文化匹配: \(.文化匹配)"'
    echo "$FIRST_MATCH" | jq -r '.維度評分 | "    動機匹配: \(.動機匹配)"'
    
    echo ""
    echo "  適配亮點："
    echo "$FIRST_MATCH" | jq -r '.適配亮點[] | "    ✓ \(.)"'
    
    if [ $(echo "$FIRST_MATCH" | jq -r '.風險提示 | length') -gt 0 ]; then
        echo ""
        echo "  風險提示:"
        echo "$FIRST_MATCH" | jq -r '.風險提示[] | "    ⚠️  \(.)"'
    fi
    
else
    error "批量配對失敗"
    echo "$BATCH_MATCH_RESPONSE" | jq '.'
    exit 1
fi

echo ""

# Test 5: 前端頁面訪問測試
echo "=========================================="
echo "Test 5: 前端頁面測試"
echo "=========================================="
echo ""

info "檢查前端主頁..."
if curl -s "$FRONTEND_URL" | grep -q "Step1ne"; then
    success "前端主頁載入成功"
else
    error "前端主頁載入失敗"
fi

echo ""

# 測試總結
echo "=========================================="
echo "測試總結"
echo "=========================================="
echo ""

success "所有測試通過！"
echo ""
echo "系統狀態："
echo "  ✓ 後端 API: $API_URL"
echo "  ✓ 前端服務: $FRONTEND_URL"
echo "  ✓ 候選人資料: $CANDIDATES_COUNT 位"
echo "  ✓ 批量配對: 正常運作"
echo "  ✓ AI 畫像生成: 正常運作"
echo ""
echo "手動測試步驟："
echo "  1. 訪問 $FRONTEND_URL"
echo "  2. 登入系統（任意帳號）"
echo "  3. 點擊側邊欄「🤖 AI 配對推薦」"
echo "  4. 選擇候選人並執行配對"
echo "  5. 查看詳細配對報告"
echo ""
echo "=========================================="
