#!/bin/bash
# Persona Matching API 測試腳本

API_URL="http://localhost:3001"

echo "=========================================="
echo "Persona Matching API 測試"
echo "=========================================="
echo ""

# Test 1: Health Check
echo "📊 Test 1: Health Check"
curl -s "${API_URL}/api/health" | jq '.'
echo ""
echo ""

# Test 2: 生成候選人畫像
echo "📊 Test 2: 生成候選人畫像"
echo "請求內容:"
cat <<EOF | jq '.'
{
  "candidateId": "1"
}
EOF

curl -s -X POST "${API_URL}/api/personas/generate-candidate" \
  -H "Content-Type: application/json" \
  -d '{
    "candidateId": "1"
  }' | jq '.'
echo ""
echo ""

# Test 3: 生成公司畫像
echo "📊 Test 3: 生成公司畫像"
echo "請求內容:"
cat <<EOF | jq '.'
{
  "job": {
    "title": "AI 工程師",
    "department": "技術部",
    "requiredSkills": ["Python", "Machine Learning", "Deep Learning"],
    "preferredSkills": ["PyTorch", "TensorFlow"],
    "yearsRequired": 3,
    "educationRequired": "大學",
    "responsibilities": ["開發 AI 模型", "資料處理", "模型部署"],
    "benefits": ["彈性工時", "遠端辦公", "教育訓練"]
  },
  "company": {
    "name": "創新科技股份有限公司",
    "industry": "軟體科技",
    "size": "100-500",
    "stage": "成長期",
    "culture": "自主型",
    "techStack": ["Python", "PyTorch", "AWS"],
    "workLocation": "台北",
    "remotePolicy": "混合辦公"
  }
}
EOF

curl -s -X POST "${API_URL}/api/personas/generate-company" \
  -H "Content-Type: application/json" \
  -d '{
    "job": {
      "title": "AI 工程師",
      "department": "技術部",
      "requiredSkills": ["Python", "Machine Learning", "Deep Learning"],
      "preferredSkills": ["PyTorch", "TensorFlow"],
      "yearsRequired": 3,
      "educationRequired": "大學",
      "responsibilities": ["開發 AI 模型", "資料處理", "模型部署"],
      "benefits": ["彈性工時", "遠端辦公", "教育訓練"]
    },
    "company": {
      "name": "創新科技股份有限公司",
      "industry": "軟體科技",
      "size": "100-500",
      "stage": "成長期",
      "culture": "自主型",
      "techStack": ["Python", "PyTorch", "AWS"],
      "workLocation": "台北",
      "remotePolicy": "混合辦公"
    }
  }' | jq '.'
echo ""
echo ""

# Test 4: 批量配對
echo "📊 Test 4: 批量配對（1 個職缺 vs 3 個候選人）"
echo "請求內容:"
cat <<EOF | jq '.'
{
  "job": {
    "title": "AI 工程師",
    "department": "技術部",
    "requiredSkills": ["Python", "Machine Learning"]
  },
  "company": {
    "name": "創新科技股份有限公司",
    "industry": "軟體科技",
    "stage": "成長期"
  },
  "candidateIds": ["1", "2", "3"]
}
EOF

curl -s -X POST "${API_URL}/api/personas/batch-match" \
  -H "Content-Type: application/json" \
  -d '{
    "job": {
      "title": "AI 工程師",
      "department": "技術部",
      "requiredSkills": ["Python", "Machine Learning", "Deep Learning"],
      "preferredSkills": ["PyTorch", "TensorFlow"],
      "yearsRequired": 3,
      "educationRequired": "大學",
      "responsibilities": ["開發 AI 模型", "資料處理", "模型部署"],
      "benefits": ["彈性工時", "遠端辦公", "教育訓練"]
    },
    "company": {
      "name": "創新科技股份有限公司",
      "industry": "軟體科技",
      "size": "100-500",
      "stage": "成長期",
      "culture": "自主型",
      "techStack": ["Python", "PyTorch", "AWS"],
      "workLocation": "台北",
      "remotePolicy": "混合辦公"
    },
    "candidateIds": ["1", "2", "3"]
  }' | jq '.'
echo ""
echo ""

echo "=========================================="
echo "測試完成！"
echo "=========================================="
