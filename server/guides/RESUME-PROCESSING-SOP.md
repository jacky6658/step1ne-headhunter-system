# 履歷處理 SOP — YuQi AI 標準作業流程

> **版本**：v1.0｜**更新日期**：2026-03-16
> **適用對象**：YuQi（OpenClaw）、Mike（Phoebe's AI）
> **系統**：Step1ne HR System — `https://api-hr.step1ne.com`
> **API Key**：`PotfZ42-qPyY4uqSwqstpxllQB1alxVfjJsm3Mgp3HQ`

---

## 📋 完整流程（6步驟）

```
收到履歷 PDF / LinkedIn
     ↓
Step 1：解析履歷內容
     ↓
Step 2：查詢系統是否已有此人
     ↓
Step 3A（新人選）→ POST 新增
Step 3B（已存在）→ PATCH 更新
     ↓
Step 4：AI 評估
     ↓
Step 5：寫入評估結果
     ↓
Step 6：驗證確認
```

---

## Step 1：解析履歷內容

從 PDF / LinkedIn 提取以下資訊：

### 基本資料
| 欄位 | 說明 |
|------|------|
| name | 中英文姓名 |
| email | Email |
| phone | 手機（格式：0912-345-678） |
| linkedin_url | LinkedIn 完整網址 |
| location | 所在地（台北市/新北市/...） |
| gender | 性別（M/F） |
| birthday | 生日（YYYY-MM-DD），或 age_estimated |

### 職涯資料
| 欄位 | 說明 |
|------|------|
| current_position | 現職全名（如 AI Engineer @ Taiwan Mobile）|
| current_title | 職稱（AI Engineer）|
| current_company | 公司（Taiwan Mobile）|
| total_years | 總年資（數字，含研究背景）|
| job_changes | 換工作次數 |
| avg_tenure_months | 平均任期（月）|
| recent_gap_months | 最近空窗期（月，無則填 0）|

### 技能與學歷
| 欄位 | 說明 |
|------|------|
| skills | 技能清單（逗號分隔）|
| education | 最高學歷（碩士/學士/...）|

### 工作經歷（work_history）
JSONB 陣列，每筆格式：
```json
{
  "company": "公司名",
  "position": "職稱",
  "startDate": "YYYY-MM",
  "endDate": "YYYY-MM 或 現在",
  "description": "主要職責與成就描述"
}
```

---

## Step 2：查詢系統是否已有此人

```bash
curl -s "https://api-hr.step1ne.com/api/candidates?limit=5" \
  -H "Authorization: Bearer PotfZ42-qPyY4uqSwqstpxllQB1alxVfjJsm3Mgp3HQ" \
  | grep -i "姓名關鍵字"
```

或直接搜尋：
```bash
curl -s "https://api-hr.step1ne.com/api/candidates?name=王大明" \
  -H "Authorization: Bearer PotfZ42-qPyY4uqSwqstpxllQB1alxVfjJsm3Mgp3HQ"
```

- **找到** → 記下 id，走 Step 3B（PATCH）
- **找不到** → 走 Step 3A（POST 新增）

---

## Step 3A：新增人選（POST）

```bash
curl -s -X POST "https://api-hr.step1ne.com/api/candidates" \
  -H "Authorization: Bearer PotfZ42-qPyY4uqSwqstpxllQB1alxVfjJsm3Mgp3HQ" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "王大明",
    "email": "wang@gmail.com",
    "phone": "0912-345-678",
    "linkedin_url": "https://linkedin.com/in/wang",
    "location": "台北市",
    "current_position": "Senior Backend Engineer @ ABC Corp",
    "current_title": "Senior Backend Engineer",
    "current_company": "ABC Corp",
    "total_years": 7,
    "job_changes": 3,
    "avg_tenure_months": 28,
    "recent_gap_months": 0,
    "skills": "Python, FastAPI, PostgreSQL, Docker, GCP",
    "education": "碩士",
    "stability_score": 80,
    "recruiter": "Jacky",
    "status": "追蹤中",
    "work_history": [
      {"company":"ABC Corp","position":"Senior Backend Engineer","startDate":"2022-03","endDate":"現在","description":"後端API開發、GCP部署"}
    ]
  }'
```

**回傳 id** → 記下，後續 PATCH 用

---

## Step 3B：更新現有人選（PATCH）

```bash
curl -s -X PATCH "https://api-hr.step1ne.com/api/candidates/{id}" \
  -H "Authorization: Bearer PotfZ42-qPyY4uqSwqstpxllQB1alxVfjJsm3Mgp3HQ" \
  -H "Content-Type: application/json" \
  -d '{
    "work_history": [...],
    "skills": "...",
    "total_years": 7
  }'
```

> ⚠️ PATCH 直接覆寫，只傳需要更新的欄位

---

## Step 4：AI 評估

根據履歷內容評估：

### 等級定義
| 等級 | 說明 | ai_score |
|------|------|---------|
| A | 優秀，強烈推薦 | 80-100 |
| B | 良好，值得推薦 | 60-79 |
| C | 普通，需進一步了解 | 40-59 |
| D | 不符合，備選 | 0-39 |

### 穩定度評分（stability_score）
- 平均任期 ≥ 36個月 → 90分
- 平均任期 24-36個月 → 75-89分
- 平均任期 12-24個月 → 60-74分
- 平均任期 < 12個月 → 50分以下

### ai_summary 格式（JSONB）
```json
{
  "grade": "A",
  "score": 85,
  "one_liner": "一句話精華描述",
  "strengths": ["優勢1", "優勢2", "優勢3"],
  "risks": ["風險1", "風險2"],
  "next_steps": "下一步建議",
  "evaluated_at": "2026-03-16T12:00:00.000Z",
  "evaluated_by": "claude-sonnet-4-6 / YuQi-marketing-aibot"
}
```

---

## Step 5：寫入評估結果（PATCH）

```bash
curl -s -X PATCH "https://api-hr.step1ne.com/api/candidates/{id}" \
  -H "Authorization: Bearer PotfZ42-qPyY4uqSwqstpxllQB1alxVfjJsm3Mgp3HQ" \
  -H "Content-Type: application/json" \
  -d '{
    "talent_level": "A",
    "ai_grade": "A",
    "ai_score": 85,
    "ai_recommendation": "強烈推薦",
    "ai_report": "詳細評估報告...",
    "ai_summary": {
      "grade": "A",
      "score": 85,
      "one_liner": "...",
      "strengths": [...],
      "risks": [...],
      "next_steps": "...",
      "evaluated_at": "2026-03-16T12:00:00.000Z",
      "evaluated_by": "claude-sonnet-4-6 / YuQi-marketing-aibot"
    }
  }'
```

---

## Step 6：驗證確認

```bash
curl -s "https://api-hr.step1ne.com/api/candidates/{id}" \
  -H "Authorization: Bearer PotfZ42-qPyY4uqSwqstpxllQB1alxVfjJsm3Mgp3HQ" \
  | python3 -c "
import sys,json
d=json.load(sys.stdin)['data']
print(f'✅ {d[\"name\"]} | {d[\"current_position\"]} | 等級:{d[\"talent_level\"]} | 分數:{d[\"ai_score\"]}')
print(f'   技能:{str(d.get(\"skills\",\"\"))[:60]}')
print(f'   工作經歷:{len(d.get(\"work_history\",[]))}筆')
"
```

---

## 常見錯誤處理

| 錯誤 | 原因 | 解法 |
|------|------|------|
| `未授權` | API Key 錯誤 | 確認 Bearer token |
| `PATCH 沒有更新` | 用了 PUT 或 POST | 一律用 PATCH 更新 |
| `work_history 格式錯誤` | JSON 格式有誤 | 確認是 array of objects |
| `ai_summary 未更新` | 舊版 API 不支援 | 確認使用最新版 API |

---

## 注意事項

1. **一律用 PATCH 更新**，不用 PUT
2. **新增一定要用 POST**（PATCH 需要 id）
3. **recruiter 欄位**：Jacky 傳的 → 填 "Jacky"，Phoebe 傳的 → 填 "Phoebe"
4. **工作經歷內分隔**：公司內技能用逗號，欄位之間不要用 `|`
5. **talent_level 只接受**：A / B / C / D（不接受 A+ 等變體）
