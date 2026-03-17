# 🎯 AI 候選人評分工作流程指南

*給 AI 助理和自動化系統的標準操作手冊*

---

## 📖 目錄

1. [整體流程](#整體流程)
2. [Step 1: 取得候選人名單](#step-1-取得候選人名單)
3. [Step 2: AI 匹配評分系統](#step-2-ai-匹配評分系統6-維度)
4. [Step 3: 生成面試問題](#step-3-生成面試問題5-條人)
5. [Step 4: 批量更新後端](#step-4-批量更新後端數據庫)
6. [Step 5: 驗證前端顯示](#step-5-驗證前端顯示)
7. [常見陷阱](#常見陷阱)
8. [工作量估算](#工作量估算)
9. [完整範例](#完整範例java-developer)

---

## 整體流程

```
1. 取得候選人名單（GitHub/LinkedIn 爬蟲）
   ↓
2. 對每位候選人進行 AI 匹配評分（6 維度評分系統）
   ↓
3. 生成面試探詢問題（5 條/人）
   ↓
4. 批量更新後端數據庫（保留原有欄位）
   ↓
5. 驗證前端顯示正確
```

---

## Step 1: 取得候選人名單

### 資料來源

- **GitHub**: `github-talent-search.py`
- **LinkedIn**: 困難，暫時跳過（需破解反爬蟲）
- **本地履歷池**: Google Sheets

### API 查詢現有候選人

```bash
curl "https://api-hr.step1ne.com/api/candidates?limit=1000" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  | jq '.data[] | {id, name, status, skills}'
```

---

## Step 2: AI 匹配評分系統（6 維度）

### 評分維度

| 維度 | 權重 | 說明 | 範例 |
|------|------|------|------|
| 人才畫像符合度 | 40% | 技能棧完整度 | Java、Spring Boot、Docker 等 |
| JD 職責匹配度 | 30% | 工作經驗相關性 | 後端開發、微服務架構 |
| 公司適配性 | 15% | 業界背景、規模適配 | 金融科技、新創規模 |
| 可觸達性 | 10% | GitHub/LinkedIn 活躍度 | 個人檔案完整、最近活動 |
| 活躍信號 | 5% | 最近提交、開源參與 | 30 天內有 commit |

### 最終分數計算

```
Score = (人才×0.4 + JD×0.3 + 公司×0.15 + 觸達×0.1 + 活躍×0.05) × 100
```

### 等級劃分

- **85+** → **A+** (強力推薦)
- **70-84** → **A** (推薦)
- **55-69** → **B** (觀望)
- **<55** → **C** (不推薦)

### Python 實現

```python
def evaluate_candidate(candidate, job_config):
    """對單一候選人進行 6 維度評分"""
    
    # 維度 1: 人才畫像符合度 (40%)
    skill_match_score = calculate_skill_match(
        candidate.skills, 
        job_config['required_skills']
    )
    
    # 維度 2: JD 職責匹配度 (30%)
    job_match_score = calculate_job_match(
        candidate.experience, 
        job_config['responsibilities']
    )
    
    # 維度 3: 公司適配性 (15%)
    company_fit_score = assess_company_fit(
        candidate.industry, 
        job_config['company_type']
    )
    
    # 維度 4: 可觸達性 (10%)
    reachability_score = assess_github_linkedin_presence(candidate)
    
    # 維度 5: 活躍信號 (5%)
    activity_score = assess_recent_activity(candidate.github_activity)
    
    # 計算最終分數
    final_score = (
        skill_match_score * 0.40 +
        job_match_score * 0.30 +
        company_fit_score * 0.15 +
        reachability_score * 0.10 +
        activity_score * 0.05
    )
    
    return {
        "score": round(final_score, 0),
        "grade": get_grade(final_score),
        "recommendation": get_recommendation(final_score),
        "strengths": extract_strengths(candidate),
        "missing_skills": extract_missing_skills(candidate)
    }
```

---

## Step 3: 生成面試問題（5 條/人）

### 框架

每條問題對應一個技能維度，涵蓋：
1. Q1: 核心技術深度
2. Q2: 分佈式系統經驗
3. Q3: API/架構設計
4. Q4: 性能優化
5. Q5: DevOps/CI/CD

### Python 實現

```python
def generate_probing_questions(position, candidate_skills):
    """為候選人生成 5 個具體的面試問題"""
    
    questions = [
        # Q1: 核心技術深度
        f"在您的 {candidate_skills[0]} 項目中，如何實現 XXX 功能？",
        
        # Q2: 分佈式系統經驗
        f"在使用 {candidate_skills[2]} 時，遇過什麼生產環境的挑戰？",
        
        # Q3: API 設計
        f"您如何使用 {candidate_skills[3]} 規範設計微服務 API？",
        
        # Q4: 性能優化
        f"在高併發場景下，您如何利用 {candidate_skills[6]} 來優化系統？",
        
        # Q5: DevOps / CI/CD
        f"您對 CI/CD 流程的理解程度如何？有實戰經驗嗎？"
    ]
    
    return questions
```

### ⚠️ 重點

- ✅ 問題要**具體**，涉及實際工作經驗
- ✅ 每條問題對應不同技能/維度
- ✅ 共 **5 條**（不多不少）
- ❌ 不要問虛無飄渺的問題（如「你的優點是什麼」）

---

## Step 4: 批量更新後端數據庫

### ⚠️ 關鍵：保留原有 status，只更新 aiMatchResult

#### ❌ 錯誤做法（會清空 status）

```bash
curl -X PUT "https://api-hr.step1ne.com/api/candidates/540" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"aiMatchResult": {...}}'
```

#### ✅ 正確做法（保留 status）

```bash
curl -X PUT "https://api-hr.step1ne.com/api/candidates/540" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"status": "AI推薦", "aiMatchResult": {...}}'
```

### aiMatchResult 完整結構

```json
{
  "score": 89,
  "grade": "A+",
  "recommendation": "強力推薦",
  "job_title": "Java Developer",
  "company": "UnityTech",
  "matched_skills": ["Java", "Spring Boot", "Docker"],
  "missing_skills": ["金融科技經驗", "CI/CD 經驗"],
  "strengths": ["Java", "Spring Boot", ...],
  "probing_questions": [
    "在 Spring Boot 微服務中...",
    "使用 Docker 時...",
    "...",
    "...",
    "..."
  ],
  "salary_fit": "期望薪資待確認 | 職缺薪資範圍：80-120k | 符合度：需進一步討論",
  "conclusion": "本候選人在 Java 後端... 整體評估：強力推薦進行技術面試。",
  "suggestion": "技能與職缺完全對口，建議透過 GitHub/LinkedIn 聯繫",
  "evaluated_by": "AIBot",
  "evaluated_at": "2026-02-27",
  "github_url": "https://github.com/..."
}
```

### Python 批量更新腳本

```python
#!/usr/bin/env python3
import requests
import json

def batch_update_candidates(candidate_ids, ai_match_results):
    """批量更新候選人的 AI 評分"""
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": "Bearer YOUR_API_KEY"
    }
    updated = 0
    failed = 0

    for cid, ai_match in zip(candidate_ids, ai_match_results):
        try:
            url = f"https://api-hr.step1ne.com/api/candidates/{cid}"
            
            # ⚠️ 務必包含 status！
            payload = {
                "status": "AI推薦",
                "aiMatchResult": ai_match
            }
            
            response = requests.put(url, json=payload, headers=headers, timeout=10)
            
            if response.status_code in [200, 201]:
                updated += 1
                print(f"✅ #{cid}: 更新成功")
            else:
                failed += 1
                print(f"❌ #{cid}: HTTP {response.status_code}")
        
        except Exception as e:
            failed += 1
            print(f"❌ #{cid}: {str(e)}")
    
    print(f"\n📊 總結：{updated} 成功，{failed} 失敗")
    return updated, failed
```

---

## Step 5: 驗證前端顯示

### 查詢單一候選人評分

```bash
curl -s "https://api-hr.step1ne.com/api/candidates/540" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  | jq '.data.aiMatchResult'
```

### 前端檢查清單

- [ ] 「AI評分」tab 顯示分數（例：89）
- [ ] 「優勢亮點」區塊顯示技能列表
- [ ] 「待確認」區塊顯示缺少的技能
- [ ] **「面談重點」區塊顯示 Q1-Q5**（最容易遺漏！）
- [ ] 「AI 完整結論」區塊顯示完整評論
- [ ] 手機版 RWD 所有內容完整可見

### 手機快取清除方式

**iOS Safari**：
- 上方地址欄長按 → 選「重新載入」
- 或：設定 → Safari → 清除歷史記錄與網站資料

**Android Chrome**：
- 右上角⋮ → 設定 → 隱私設定 → 清除瀏覽資料 → 全選

---

## 常見陷阱

| 問題 | 原因 | 解決方案 |
|------|------|--------|
| 面談重點不顯示 | `probing_questions` 為空陣列或缺失 | 確保傳 5 個問題，檢查是否為陣列 |
| 狀態被清空 | PUT 只傳 `aiMatchResult` | **必須同時傳 `status: "AI推薦"`** |
| 前端顯示「未評分」 | DB 欄位返回 null | 確認 `ai_match_result` 已寫入 DB |
| 手機內容溢出 | RWD 沒做好 | 使用 `w-[95vw] sm:w-full` 等響應式類 |
| 批量更新超時 | 網路慢或請求太多 | 分批處理，每批 10-20 人，間隔 1 秒 |

---

## 工作量估算

| 任務 | 時間 | 備註 |
|------|------|------|
| 爬蟲取得 20-50 人 | 5-10 分鐘 | 取決於 API 限流 |
| 對每人進行 AI 評分（自動） | 30 秒 | Python 快速評分 |
| 生成 5 個面試問題 | 10 秒 | 模板化生成 |
| 批量更新後端（50 人） | 2-3 分鐘 | 包含 API 調用 |
| 驗證前端（抽查 5 筆） | 2-3 分鐘 | 確保顯示無誤 |
| **總計（50 人）** | **15-20 分鐘** | 完整流程 |

---

## 完整範例：Java Developer

### 1. 定義職缺配置

```python
JOB_CONFIG = {
    "position": "Java Developer (後端工程師)",
    "company": "UnityTech",
    "required_skills": [
        "Java", "Spring Boot", "微服務", "OpenAPI", 
        "Message Queue", "Docker", "Kubernetes", "Redis"
    ],
    "nice_to_have": ["金融科技經驗", "CI/CD 經驗"],
    "min_score": 85
}
```

### 2. 爬蟲取得候選人

```python
candidates = scrape_github_developers(
    keywords="Java Engineer",
    location="Taiwan",
    min_followers=100
)
```

### 3. 評分 + 生成問題

```python
ai_evaluations = []
for candidate in candidates:
    evaluation = evaluate_candidate(candidate, JOB_CONFIG)
    
    if evaluation['score'] >= JOB_CONFIG['min_score']:
        evaluation['probing_questions'] = generate_probing_questions(
            position=JOB_CONFIG['position'],
            skills=candidate.skills
        )
        ai_evaluations.append(evaluation)
```

### 4. 批量更新後端

```python
batch_update_candidates(
    candidate_ids=[c.id for c in candidates if c.score >= 85],
    ai_match_results=ai_evaluations
)
```

### 5. 驗證結果

```bash
# 查詢評分結果
curl -s "https://api-hr.step1ne.com/api/candidates?limit=100" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  | jq '.data[] | select(.status == "AI推薦") | {id, name, score: .aiMatchResult.score}'
```

---

## 相關 API 端點

| 方法 | 端點 | 說明 |
|------|------|------|
| GET | `/api/candidates` | 查詢所有候選人 |
| GET | `/api/candidates/:id` | 查詢單一候選人 |
| PUT | `/api/candidates/:id` | 更新候選人（含 aiMatchResult） |
| POST | `/api/candidates` | 新增候選人 |

### GET /api/candidates

```bash
curl -s "https://api-hr.step1ne.com/api/candidates?limit=50&offset=0" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  | jq '.data | length'
```

### PUT /api/candidates/:id

```bash
curl -X PUT "https://api-hr.step1ne.com/api/candidates/540" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "status": "AI推薦",
    "aiMatchResult": {
      "score": 89,
      "grade": "A+",
      ...
    }
  }'
```

---

## 相關檔案位置

- 📁 爬蟲腳本：`/hr-tools/github-talent-search.py`
- 📁 評分系統：`/hr-tools/candidate-scoring-system-v2.py`
- 📁 API 文檔：`./API.md`
- 🌐 前端頁面：https://hrsystem.step1ne.com (需 Jacky 帳號登入)
- 🔌 後端 API：https://api-hr.step1ne.com/api

---

## 重點提醒

### 必做清單

- ✅ **永遠保留 `status`** 在 PUT 請求中
- ✅ **`probing_questions` 必須有 5 項**（不能少）
- ✅ **批量操作後驗證** - 抽查 3-5 筆確認前端顯示
- ✅ **手機版驗證** - 確保 RWD 正常顯示

### 避免陷阱

- ❌ 不要只傳 `aiMatchResult`（會清空 status）
- ❌ 不要傳少於 5 個面試問題
- ❌ 不要跳過前端驗證（踩過坑了！）
- ❌ 不要在 `probing_questions` 放物件，必須是字串陣列

---

## 聯繫與支援

如有問題或發現 bug，請：
1. 檢查本文檔的「常見陷阱」部分
2. 查詢 `/api/candidates/:id` 確認 DB 資料
3. 清除前端快取後再驗證
4. 若問題持續，聯繫 Jacky

---

**最後更新**: 2026-02-27  
**維護者**: YuQi AI Assistant
