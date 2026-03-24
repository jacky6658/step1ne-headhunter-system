# MEMORY.md - 獵頭龍蝦記憶模板

## HR 系統
- API：https://api-hr.step1ne.com
- Auth：`Authorization: Bearer PotfZ42-qPyY4uqSwqstpxllQB1alxVfjJsm3Mgp3HQ`

## ⭐ 匯入候選人（一次到位 API — 必用！）

**端點**：`POST /api/ai-agent/candidates/import-complete`

```json
{
  "candidate": {
    "name": "姓名",
    "email": "email",
    "linkedin_url": "https://...",
    "current_position": "目前職稱",
    "current_company": "目前公司",
    "skills": "技能1、技能2",
    "years_experience": "5",
    "location": "Taipei",
    "target_job_id": 42,
    "talent_level": "A",
    "work_history": [{"company":"...","title":"...","from":"2020","to":"now"}],
    "education_details": [{"school":"...","degree":"MS","major":"CS"}],
    "ai_match_result": {"summary":"...","grade":"A"},
    "status": "未開始"
  },
  "resume_pdf": {
    "base64": "<PDF base64 編碼>",
    "filename": "檔名.pdf",
    "format": "auto"
  },
  "ai_analysis": {
    "version": "1.0",
    "analyzed_at": "ISO時間",
    "analyzed_by": "你的名字",
    "candidate_evaluation": {
      "career_curve": {"summary":"職涯摘要","pattern":"穩定上升","details":[{"company":"公司","industry":"產業","title":"職稱","duration":"年數","move_reason":"原因"}]},
      "personality": {"type":"專家型","top3_strengths":["強項1","強項2","強項3"],"weaknesses":["弱項"],"evidence":"依據"},
      "role_positioning": {"actual_role":"角色","spectrum_position":"Senior","best_fit":["適合"],"not_fit":["不適合"]},
      "salary_estimate": {"actual_years":5,"current_level":"Mid","current_estimate":"年薪100萬","expected_range":"120萬","risks":["風險"]}
    },
    "job_matchings": [{
      "job_id": 42,
      "job_title": "職缺名稱",
      "company": "公司",
      "match_score": 85,
      "verdict": "推薦",
      "company_analysis": "公司分析",
      "must_have": [{"condition":"條件","actual":"實際","result":"pass"}],
      "nice_to_have": [{"condition":"條件","actual":"實際","result":"pass"}],
      "strongest_match": "最強匹配",
      "main_gap": "最大缺口",
      "hard_block": "無",
      "salary_fit": "薪資匹配"
    }],
    "recommendation": {
      "summary_table": [{"job_id":42,"job_title":"職缺","company":"公司","score":85,"verdict":"推薦","priority":1}],
      "first_call_job_id": 42,
      "first_call_reason": "原因",
      "overall_pushability": "高",
      "pushability_detail": "詳細說明",
      "fallback_note": "備選方案"
    }
  },
  "actor": "你的名字",
  "require_complete": true
}
```

### 重要規則
| 規則 | 說明 |
|---|---|
| `require_complete: true` | 缺 PDF/target_job_id/talent_level 會拒絕 |
| 失敗時 | DB 完全沒動，不用清理 |
| 去重 | LinkedIn URL > Email > Name |
| PDF | base64 編碼放 JSON |

## 補既有候選人
- 補 PDF：`POST /api/candidates/{id}/resume-parse`
- 補 AI 分析：`PUT /api/ai-agent/candidates/{id}/ai-analysis`（key 用 `ai_analysis` snake_case）
- 讀取：`GET /api/ai-agent/candidates/{id}/full-profile`（回 `aiAnalysis` camelCase）

## 查詢
- 候選人列表：`GET /api/candidates?limit=200&sort=-id`
- 職缺列表：`GET /api/jobs?status=招募中`
- 職缺詳情：`GET /api/jobs/{id}`

## 顧問指派
- 築楽國際 → Jacky
- 其他所有 → Phoebe

## status 有效值
`爬蟲初篩` / `AI推薦` / `備選人才` / `聯繫階段` / `面試階段` / `已連繫` / `婉拒` / `不推薦` / `人才庫` / `未開始`

## grade 有效值
`A+` / `A` / `B` / `C` / `D`
