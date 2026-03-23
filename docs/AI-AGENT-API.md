# AI Agent API 操作手冊

> **對象**：任何能讀懂此文檔的 AI Agent（TG Bot、Claude Code、GPT 等）
> **用途**：自動執行人選匹配分析 + 開發信產生
> **版本**：v1.0 | 2026-03-20

---

## 概述

```
AI Agent 工作流程：

1. 取提示詞     GET /api/ai-agent/prompts/matching
2. 取人選資料   GET /api/ai-agent/candidates/:id/full-profile
3. 取履歷 PDF   GET /api/ai-agent/candidates/:id/resume-text
4. 取匹配職缺   GET /api/ai-agent/jobs/match-candidates?candidateId=X
5. 將「提示詞 + 履歷解析文字 + 人選資料 + 職缺 JD」組合後執行分析，依照提示詞規定的 JSON schema 產出結構化分析結果
6. 寫回結果     PUT /api/ai-agent/candidates/:id/ai-analysis

Bonus: 開發信產出
B1. 取提示詞   GET /api/ai-agent/prompts/outreach
B2. 產出開發信（AI 自行執行）
B3. 寫回結果   PUT /api/ai-agent/candidates/:id/outreach-letter
```

---

## 認證

所有 API 需要 Bearer Token：

```
Authorization: Bearer <API_SECRET_KEY>
```

---

## Step 1：取匹配提示詞

```
GET /api/ai-agent/prompts/matching
```

**Response:**
```json
{
  "success": true,
  "data": {
    "prompt_id": 42,
    "title": "AI 顧問分析 v1",
    "content": "... 完整提示詞 ...",
    "updated_at": "2026-03-20T..."
  }
}
```

**用法**：取得 `content` 欄位作為你的系統提示詞。

---

## Step 2：取人選完整資料

```
GET /api/ai-agent/candidates/:id/full-profile
```

**Response（主要欄位）:**
```json
{
  "success": true,
  "data": {
    "id": 2991,
    "name": "某某某",
    "current_title": "Backend Engineer",
    "current_company": "XX公司",
    "total_years": 5,
    "location": "台北",
    "skills": "Java, Spring Boot, Docker",
    "normalized_skills": ["Java", "Spring Boot", "Docker"],
    "work_history": [
      {
        "company": "XX公司",
        "title": "Backend Engineer",
        "start": "2022-01",
        "end": "present",
        "description": "...",
        "duration_months": 36
      }
    ],
    "education_details": [
      { "school": "台大", "degree": "碩士", "major": "資工", "start": "2016", "end": "2018" }
    ],
    "salary_info": {
      "current_salary": "80K",
      "expected_salary": "100K",
      "current_min": 80000,
      "expected_min": 100000,
      "currency": "TWD",
      "period": "monthly"
    },
    "notice_period": "1個月",
    "languages": "中文、英文",
    "certifications": "AWS SAA",
    "reason_for_change": "想挑戰微服務架構",
    "resume_files": [
      { "id": "rf_xxx", "filename": "resume.pdf", "size": 204800 }
    ],
    "target_job_id": 52,
    "target_job_label": "Java Developer (一通數位)"
  }
}
```

**用法**：將此 JSON 作為「履歷資料」餵給提示詞。

---

## Step 3：取履歷 PDF（base64）

```
GET /api/ai-agent/candidates/:id/resume-text
GET /api/ai-agent/candidates/:id/resume-text?fileId=rf_xxx
```

**Response:**
```json
{
  "success": true,
  "data": {
    "file_id": "rf_xxx",
    "filename": "resume.pdf",
    "mimetype": "application/pdf",
    "base64": "JVBERi0xLj..."
  }
}
```

**用法**：將 base64 解碼為 PDF 後解析文字內容，作為「履歷原文」補充資料。若你無法解析 PDF，可以只用 Step 2 的結構化資料。

---

## Step 4：取最匹配的職缺

```
GET /api/ai-agent/jobs/match-candidates?candidateId=2991&limit=3
```

**Response（主要欄位）:**
```json
{
  "success": true,
  "data": {
    "candidate_id": 2991,
    "candidate_name": "某某某",
    "total_matched": 3,
    "matched_jobs": [
      {
        "job_id": 52,
        "position_name": "Java Developer",
        "client_company": "一通數位",
        "department": "技術部",
        "salary_range": "60K-80K",
        "salary_min": 60000,
        "salary_max": 80000,
        "key_skills": "Java, Spring Boot, Docker, K8s, MQ",
        "experience_required": "3年以上",
        "education_required": "大學以上",
        "location": "台北",
        "job_description": "... 完整 JD ...",
        "company_profile": "... 公司介紹 ...",
        "talent_profile": "... 理想人才畫像 ...",
        "attractive_points": "... 吸引點 ...",
        "rejection_criteria": "... 拒絕條件 ...",
        "submission_criteria": "... 送件規範 ...",
        "interview_process": "... 面試流程 ..."
      }
    ]
  }
}
```

**用法**：每個 `matched_jobs` 物件就是一份 JD，餵給提示詞的 STEP 1。

---

## Step 5：執行分析

將 Step 1 的提示詞 + Step 2~4 的資料組合後執行分析，依照提示詞規定的 JSON schema 產出結構化分析結果。

**組合方式：**
```
[提示詞（Step 1 取得的 content）]

═══ 履歷資料 ═══
[Step 2 的 full-profile JSON — 人選結構化資料]

═══ 履歷 PDF 解析文字 ═══
[Step 3 的 PDF 解析後文字內容]

═══ 職缺 JD #1 ═══
[Step 4 的 matched_jobs[0] JSON]

═══ 職缺 JD #2 ═══
[Step 4 的 matched_jobs[1] JSON]

═══ 職缺 JD #3 ═══
[Step 4 的 matched_jobs[2] JSON]

以上資料已全部提供，請依照提示詞規定的 JSON schema 產出完整分析結果。
```

**執行重點：**
- 履歷 PDF 必須先解析為文字，分析基於解析後的文字內容
- 分析結果必須嚴格遵守提示詞規定的 JSON 結構
- 所有判斷必須基於履歷中的實際內容，資料不足標示「❓ 資料不足，需電話確認」
- match_score 0~100、result 只能是 pass/warning/fail、verdict 只能是 建議送出/勉強送出/不建議

---

## Step 6：寫回分析結果

```
PUT /api/ai-agent/candidates/:id/ai-analysis
Content-Type: application/json
```

**Request Body:**
```json
{
  "ai_analysis": {
    "version": "1.0",
    "analyzed_at": "2026-03-20T15:30:00Z",
    "analyzed_by": "claude-opus-4-20250514",

    "candidate_evaluation": {
      "career_curve": {
        "summary": "從中型 SI 起步，逐步進入產品型公司，技術穩定成長",
        "pattern": "穩定成長型",
        "details": [
          {
            "company": "哲煜科技",
            "industry": "SI/軟體外包",
            "title": "PHP Developer",
            "duration": "1年1個月",
            "move_reason": "技術瓶頸，想接觸更大規模系統"
          },
          {
            "company": "JKF",
            "industry": "內容平台",
            "title": "Backend Engineer",
            "duration": "2年2個月",
            "move_reason": "（現職）"
          }
        ]
      },
      "personality": {
        "type": "效能導向後端工程師",
        "top3_strengths": ["高併發優化", "SQL 效能調校", "系統穩定性"],
        "weaknesses": ["缺乏微服務架構經驗"],
        "evidence": "將 SQL 查詢從 8-11 秒優化到 0-2 秒（提升 80%），降低系統資源消耗 75%"
      },
      "role_positioning": {
        "actual_role": "偏後端效能優化 + 資料處理",
        "spectrum_position": "應用層偏底層",
        "best_fit": ["高流量後端", "效能工程師"],
        "not_fit": ["純前端", "PM"]
      },
      "salary_estimate": {
        "actual_years": 3,
        "current_level": "中階工程師",
        "current_estimate": "55-65K",
        "expected_range": "65-75K",
        "risks": ["年資較淺，只有 2 段經歷"]
      }
    },

    "job_matchings": [
      {
        "job_id": 52,
        "job_title": "Java Developer",
        "company": "一通數位",
        "match_score": 45,
        "verdict": "條件式",
        "company_analysis": "Nasdaq 上市公司，穩定技術環境",
        "must_have": [
          { "condition": "Java 3年+", "actual": "無 Java 經驗，主力為 PHP/Golang", "result": "fail" },
          { "condition": "Spring Boot", "actual": "未使用過", "result": "fail" },
          { "condition": "微服務架構", "actual": "有高併發經驗但非微服務", "result": "warning" },
          { "condition": "Docker/K8s", "actual": "❓ 資料不足，需電話確認", "result": "warning" }
        ],
        "nice_to_have": [
          { "condition": "MQ 經驗", "actual": "未提及", "result": "fail" }
        ],
        "strongest_match": "後端效能優化能力強，有高併發實戰",
        "main_gap": "核心語言不符（PHP/Golang vs Java），需語言轉換",
        "hard_block": "無 Java 經驗，需確認轉換意願",
        "salary_fit": "期望 65-75K 在職缺範圍 60-80K 內"
      }
    ],

    "phone_scripts": [
      {
        "job_id": 52,
        "opening": "嗨，我是 AIJob 的獵頭顧問，注意到您在後端效能優化方面很有經驗，將 SQL 查詢速度提升了 80%，相當厲害。",
        "motivation_probes": [
          {
            "answer_type": "想學新語言",
            "interpretation": "正面，對 Java 轉換有意願",
            "strategy": "強調公司有完整 Java 培訓資源"
          },
          {
            "answer_type": "薪資導向",
            "interpretation": "確認期望是否在 60-80K 內",
            "strategy": "若超過 80K 直接停止推進"
          }
        ],
        "technical_checks": [
          "有沒有碰過 Java？自學或專案經驗都算",
          "Docker 和 K8s 有沒有實際使用經驗？",
          "有用過訊息佇列（RabbitMQ/Kafka）嗎？"
        ],
        "job_pitch": "這個職缺在一通數位，是 Nasdaq 上市公司，技術環境很穩定，他們正在擴展微服務架構，你在高併發方面的經驗他們會很看重。",
        "closing": "薪資帶 60-80K，如果有興趣我這邊會準備匿名履歷先送給企業方。",
        "must_ask": [
          { "number": 1, "question": "你目前有在看機會嗎？", "meaning": "主動=好/被動=需追蹤", "is_veto": false },
          { "number": 2, "question": "期望薪資大概在什麼範圍？", "meaning": ">80K = 超預算", "is_veto": true },
          { "number": 3, "question": "有考慮轉 Java 嗎？", "meaning": "無意願 = 直接停止", "is_veto": true }
        ]
      }
    ],

    "recommendation": {
      "summary_table": [
        { "job_id": 52, "job_title": "Java Developer", "company": "一通數位", "score": 45, "verdict": "條件式", "priority": 1 }
      ],
      "first_call_job_id": 52,
      "first_call_reason": "雖然語言不符，但後端基底扎實，先確認轉 Java 意願",
      "overall_pushability": "中低",
      "pushability_detail": "核心語言不符是主要障礙，若有 Java 自學經驗則提升至中高",
      "fallback_note": "更適合 Golang/PHP 後端職缺，建議留庫待匹配"
    }
  },
  "actor": "claude-opus-4-20250514"
}
```

**驗證規則（400 Bad Request 觸發條件）：**
- `version` 不是 `"1.0"`
- 缺少 `analyzed_at` 或 `analyzed_by`
- 缺少 `candidate_evaluation` 的任何子物件
- `job_matchings` 不是陣列或長度 > 3
- `match_score` 不在 0-100 範圍
- `must_have[].result` 不是 `pass` / `warning` / `fail`
- 缺少 `recommendation`

**成功 Response:**
```json
{
  "success": true,
  "message": "AI 分析結果已儲存",
  "candidate_id": "2991",
  "candidate_name": "Hansheng Huang"
}
```

---

## Bonus：開發信產出

### B1. 取開發信提示詞

```
GET /api/ai-agent/prompts/outreach
```

Response 格式同 Step 1。

### B2. AI 產出開發信

使用提示詞 + 人選 STEP 0 的核心強項 + 職缺賣點，產出開發信。

### B3. 寫回開發信

```
PUT /api/ai-agent/candidates/:id/outreach-letter
Content-Type: application/json
```

**Request Body:**
```json
{
  "outreach_letter": {
    "job_id": 52,
    "channel": "linkedin",
    "subject": null,
    "body": "Hi，注意到您在高併發後端方面有實戰經驗，SQL 效能提升 80% 非常出色。目前有一個 Nasdaq 上市公司的後端工程師機會，薪資帶 60-80K，技術棧穩定，想跟您聊聊？"
  },
  "actor": "claude-opus-4-20250514"
}
```

**channel 選項：** `linkedin` / `email` / `sms`
- `linkedin`：150 字內，口語
- `email`：300 字內，需填 `subject`
- `sms`：50 字內

**成功 Response:**
```json
{
  "success": true,
  "message": "開發信已儲存",
  "candidate_id": "2991",
  "letter_id": "ol_1710912345_a3b4"
}
```

---

## 錯誤碼

| HTTP Code | 含義 |
|-----------|------|
| 200 | 成功 |
| 400 | JSON 驗證失敗（details 欄位列出所有錯誤） |
| 401 | 未授權（缺少或無效 Bearer Token） |
| 404 | 找不到資源（候選人/提示詞/檔案） |
| 500 | 伺服器錯誤 |

---

## 限制規則（AI Agent 必須遵守）

1. **只能使用系統提供的資料**（full-profile + resume PDF + jobs），不可使用外部資訊
2. **不可自行推測未提供的資訊**，資料不足時標示「❓ 資料不足，需電話確認」
3. **所有判斷必須基於履歷實際內容**，引用具體數字或案例
4. **輸出必須是完整的 JSON 結構**，不可省略必要欄位
5. **match_score 必須是 0-100 的整數**
6. **must_have/nice_to_have 的 result 只能是 pass/warning/fail**
7. **job_matchings 最多 3 個職缺**
8. **話術必須口語化**，可以直接唸出來

---

## 完整端點一覽

| Method | Path | 用途 |
|--------|------|------|
| GET | `/api/ai-agent/prompts/matching` | 取匹配提示詞 |
| GET | `/api/ai-agent/prompts/outreach` | 取開發信提示詞 |
| GET | `/api/ai-agent/candidates/:id/full-profile` | 取人選完整資料 |
| GET | `/api/ai-agent/candidates/:id/resume-text` | 取履歷 PDF base64 |
| GET | `/api/ai-agent/jobs/match-candidates?candidateId=X&limit=3` | 取匹配職缺 |
| PUT | `/api/ai-agent/candidates/:id/ai-analysis` | 寫入分析結果 |
| PUT | `/api/ai-agent/candidates/:id/outreach-letter` | 寫入開發信 |

**Base URL:** `https://你的域名` 或 `http://localhost:3003`

---

*文檔版本：v1.0 | 建立日期：2026-03-20*
