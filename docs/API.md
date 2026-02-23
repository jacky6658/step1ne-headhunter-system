# Step1ne Headhunter System - API 文檔

**版本**: 1.0.0  
**Base URL**: `http://localhost:3001/api` (開發環境)  
**Production URL**: `https://backendstep1ne.zeabur.app/api`

---

## 📚 目錄

1. [認證](#認證)
2. [候選人管理 API](#候選人管理-api)
3. [職缺管理 API](#職缺管理-api)
4. [AI 配對 API](#ai-配對-api)
5. [錯誤處理](#錯誤處理)
6. [Bot 整合範例](#bot-整合範例)

---

## 認證

**目前版本：無需認證**（僅限內部使用）

未來版本將支援：
- API Key 認證
- OAuth 2.0
- JWT Token

---

## 候選人管理 API

### 1. 列出所有候選人

```http
GET /api/candidates
```

**回應範例**：
```json
{
  "success": true,
  "data": [
    {
      "id": "1",
      "name": "張大明",
      "currentJobTitle": "資深 BIM 工程師",
      "email": "example@email.com",
      "phone": "0912-345-678",
      "workExperience": "5年",
      "skills": ["Revit", "AutoCAD", "BIM"],
      "currentCompany": "某建築公司",
      "desiredSalary": "60k-80k",
      "status": "待聯繫",
      "grade": "A",
      "consultant": "Jacky",
      "source": "LinkedIn",
      "notes": "技術能力強，溝通良好"
    }
  ],
  "count": 234
}
```

**查詢參數**（可選）：
- `status` - 篩選狀態（待聯繫/已聯繫/面試中/已錄取/已拒絕）
- `consultant` - 篩選負責顧問
- `grade` - 篩選評級（S/A+/A/B/C）

範例：
```http
GET /api/candidates?status=待聯繫&grade=A
```

---

### 2. 取得單一候選人

```http
GET /api/candidates/:id
```

**路徑參數**：
- `id` - 候選人 ID

**回應範例**：
```json
{
  "success": true,
  "data": {
    "id": "1",
    "name": "張大明",
    "currentJobTitle": "資深 BIM 工程師",
    "email": "example@email.com",
    "phone": "0912-345-678",
    "linkedin": "https://linkedin.com/in/...",
    "github": "https://github.com/...",
    "workExperience": "5年",
    "skills": ["Revit", "AutoCAD", "BIM", "Python", "Dynamo"],
    "currentCompany": "某建築公司",
    "currentSalary": "55k",
    "desiredSalary": "60k-80k",
    "education": "國立台灣科技大學 營建工程系",
    "status": "待聯繫",
    "grade": "A",
    "consultant": "Jacky",
    "source": "LinkedIn",
    "notes": "技術能力強，溝通良好",
    "resumeUrl": "https://drive.google.com/...",
    "appliedJobs": [],
    "interviewHistory": [],
    "createdAt": "2026-02-20",
    "updatedAt": "2026-02-23"
  }
}
```

**錯誤回應** (404):
```json
{
  "success": false,
  "error": "找不到候選人"
}
```

---

### 3. 搜尋候選人

使用 GET /api/candidates 配合查詢參數即可搜尋

範例：
```http
GET /api/candidates?skills=Python&workExperience=3年以上
```

---

### 4. 更新候選人狀態

```http
PUT /api/candidates/:id
```

**請求 Body**：
```json
{
  "status": "面試中"
}
```

**回應範例**：
```json
{
  "success": true,
  "data": {
    "id": "1",
    "name": "張大明",
    "status": "面試中",
    "updatedAt": "2026-02-23T22:30:00Z"
  },
  "message": "候選人狀態已更新"
}
```

---

### 5. 候選人評級

```http
POST /api/candidates/:id/grade
```

**功能**：使用 AI 自動評級候選人（S/A+/A/B/C）

**回應範例**：
```json
{
  "success": true,
  "data": {
    "id": "1",
    "name": "張大明",
    "grade": "A",
    "score": 85,
    "breakdown": {
      "skills": 90,
      "experience": 85,
      "education": 80,
      "stability": 82
    }
  }
}
```

---

### 6. 批量評級

```http
POST /api/candidates/batch-grade
```

**功能**：批量評級所有候選人

**回應範例**：
```json
{
  "success": true,
  "total": 234,
  "graded": 230,
  "errors": 4,
  "results": [...],
  "errors": [
    {
      "candidateId": "5",
      "name": "王小明",
      "error": "缺少必要資料"
    }
  ]
}
```

---

## 職缺管理 API

### 1. 列出所有職缺

```http
GET /api/jobs
```

**回應範例**：
```json
{
  "success": true,
  "data": [
    {
      "id": "job-1",
      "title": "AI工程師",
      "department": "技術部",
      "headcount": 2,
      "salaryRange": "80k-120k",
      "requiredSkills": ["Python", "AI", "Machine Learning"],
      "yearsRequired": 3,
      "educationRequired": "大學以上",
      "workLocation": "台北",
      "status": "開放中",
      "createdDate": "2026-02-10",
      "lastUpdated": "2026-02-23",
      "company": {
        "name": "AIJob內部",
        "industry": "軟體科技",
        "size": "100-500",
        "stage": "成長期",
        "culture": "自主型"
      }
    }
  ],
  "count": 27
}
```

**查詢參數**（可選）：
- `status` - 篩選狀態（開放中/招募中/已關閉）
- `company` - 篩選公司
- `skills` - 篩選技能

範例：
```http
GET /api/jobs?status=開放中&skills=Python
```

---

### 2. 取得單一職缺

```http
GET /api/jobs/:id
```

**回應範例**：
```json
{
  "success": true,
  "data": {
    "id": "job-1",
    "title": "AI工程師",
    "department": "技術部",
    "headcount": 2,
    "salaryRange": "80k-120k",
    "requiredSkills": ["Python", "AI", "Machine Learning"],
    "preferredSkills": ["TensorFlow", "PyTorch"],
    "yearsRequired": 3,
    "educationRequired": "大學以上",
    "workLocation": "台北",
    "status": "開放中",
    "languageRequirement": "英文中等",
    "specialConditions": "",
    "industryBackground": "軟體科技",
    "teamSize": "10-20人",
    "keyChallenge": "快速成長的團隊",
    "highlights": "彈性工時、遠端辦公",
    "recruitmentDifficulty": "競爭激烈",
    "interviewProcess": "1.技術測驗 2.技術面試 3.主管面試",
    "consultantNotes": "客戶希望找有創業經驗的",
    "company": {
      "name": "AIJob內部",
      "industry": "軟體科技",
      "size": "100-500",
      "stage": "成長期",
      "culture": "自主型",
      "techStack": ["Python", "AI", "Machine Learning"],
      "workLocation": "台北",
      "remotePolicy": "混合辦公"
    },
    "createdDate": "2026-02-10",
    "lastUpdated": "2026-02-23"
  }
}
```

---

## AI 配對 API

### 1. 批量配對（推薦使用）

```http
POST /api/personas/batch-match
```

**功能**：一個職缺 vs 多個候選人，返回排序後的配對結果

**請求 Body**：
```json
{
  "job": {
    "title": "AI工程師",
    "department": "技術部",
    "requiredSkills": ["Python", "AI", "Machine Learning"],
    "yearsRequired": 3
  },
  "company": {
    "name": "AIJob內部",
    "industry": "軟體科技",
    "stage": "成長期",
    "culture": "自主型"
  },
  "candidateIds": ["1", "2", "3", "5", "8"]
}
```

**回應範例**：
```json
{
  "success": true,
  "company": {
    "name": "AIJob內部",
    "jobTitle": "AI工程師"
  },
  "result": {
    "summary": {
      "total": 5,
      "avgScore": 76.3,
      "grades": {
        "S": 0,
        "A": 1,
        "B": 4,
        "C": 0,
        "D": 0
      }
    },
    "matches": [
      {
        "candidate": {
          "id": "1",
          "name": "張大明"
        },
        "score": 82.5,
        "grade": "A",
        "breakdown": {
          "skills": 85,
          "growth": 80,
          "culture": 88,
          "motivation": 75
        },
        "highlights": [
          "技術能力與職缺高度匹配",
          "文化適配度優秀（技術宅 vs 自主型）",
          "職涯路徑清晰"
        ],
        "risks": [
          "薪資期待略高於上限"
        ],
        "recommendation": "強烈推薦，優先聯繫"
      },
      {
        "candidate": {
          "id": "2",
          "name": "李小華"
        },
        "score": 75.2,
        "grade": "B",
        "breakdown": {
          "skills": 78,
          "growth": 72,
          "culture": 80,
          "motivation": 68
        },
        "highlights": [
          "基礎技能符合",
          "學習意願強"
        ],
        "risks": [
          "經驗略淺（2年 vs 要求3年）"
        ],
        "recommendation": "可考慮，需加強技術評估"
      }
    ]
  }
}
```

---

### 2. 完整配對流程（單一候選人）

```http
POST /api/personas/full-match
```

**功能**：自動生成候選人畫像 + 公司畫像 + 執行配對

**請求 Body**：
```json
{
  "candidateId": "1",
  "job": {
    "title": "AI工程師",
    "requiredSkills": ["Python", "AI"]
  },
  "company": {
    "name": "AIJob內部",
    "industry": "軟體科技",
    "culture": "自主型"
  }
}
```

**回應範例**：
```json
{
  "success": true,
  "candidatePersona": { ... },
  "companyPersona": { ... },
  "matchResult": {
    "score": 82.5,
    "grade": "A",
    "breakdown": { ... },
    "recommendation": "強烈推薦"
  }
}
```

---

## 錯誤處理

所有 API 錯誤都遵循統一格式：

```json
{
  "success": false,
  "error": "錯誤訊息"
}
```

**常見 HTTP 狀態碼**：
- `200` - 成功
- `201` - 創建成功
- `400` - 請求參數錯誤
- `404` - 找不到資源
- `500` - 伺服器錯誤

---

## Bot 整合範例

請參考：
- [Python 範例](./bot-examples/python-bot.py)
- [Node.js 範例](./bot-examples/nodejs-bot.js)
- [Telegram Bot 範例](./bot-examples/telegram-bot.py)

---

## 速率限制

目前：無限制

未來：
- 免費版：100 requests/hour
- 付費版：1000 requests/hour

---

## 版本歷史

### v1.0.0 (2026-02-23)
- ✅ 候選人管理 API
- ✅ 職缺管理 API
- ✅ AI 配對 API
- ✅ 批量操作支援

---

## 聯絡我們

- GitHub: https://github.com/jacky6658/step1ne-headhunter-system
- Email: support@step1ne.com

