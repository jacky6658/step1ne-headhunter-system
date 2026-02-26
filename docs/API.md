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
5. [🆕 人才搜尋系統 API（AIbot 獵才流程）](#人才搜尋系統-api)
6. [顧問設定 API](#顧問設定-api)
7. [錯誤處理](#錯誤處理)
8. [Bot 整合範例](#bot-整合範例)

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

---

## 人才搜尋系統 API

> **重要：這是 AIbot 獵才流程的核心端點。**
> 當顧問說「幫我找 XXX 公司的 YYY 職位候選人」時，AIbot 應呼叫此端點，系統將自動完成整個 6 步驟流程並回傳優先推薦名單。

---

### 觸發情境識別

AIbot 應在以下對話模式中觸發人才搜尋：

| 顧問說... | 代表要搜尋... |
|-----------|--------------|
| 「幫我找一通數位的 Java Developer 候選人」 | company=一通數位, jobTitle=Java Developer |
| 「幫我搜尋遊戲橘子的後端工程師」 | company=遊戲橘子, jobTitle=後端工程師 |
| 「去找看看有沒有符合 AWS 職缺的人選」 | 需先確認是哪個客戶公司 |
| 「找一下 104 的 React 工程師」 | company=104, jobTitle=React 工程師 |

> **注意**：如果顧問沒有指定公司，AIbot 應先回問「請問是哪家客戶公司的職缺？」，確認後再呼叫 API。

---

### 1. 完整獵才流程（核心端點）

```http
POST /api/talent-sourcing/find-candidates
```

**功能**：觸發 6 步驟自動獵才流程：
1. 分析公司畫像 + 人才畫像（從 DB 讀取客戶/職缺資料）
2. GitHub API 搜尋（2-3頁）+ Google→LinkedIn 搜尋（2-3頁）
3. 去重（比對現有 candidates_pipeline）
4. 自動評分（S/A+/A/B/C）
5. 寫入 candidates_pipeline（含 AI 評估報告）
6. 生成優先推薦名單

**請求 Body**：
```json
{
  "company": "一通數位",
  "jobTitle": "Java Developer",
  "actor": "Jackeybot",
  "github_token": "ghp_xxxxxxxxxxxx",
  "pages": 2
}
```

| 欄位 | 必填 | 說明 |
|------|------|------|
| `company` | ✅ | 客戶公司名稱（模糊匹配） |
| `jobTitle` | ✅ | 職位名稱（模糊匹配） |
| `actor` | 建議填 | 呼叫者名稱（如 Jackeybot、Phoebebot） |
| `github_token` | 選填 | 顧問的 GitHub PAT（從 GET /api/users/:name/contact 取得）；不填則無認證模式（60次/小時） |
| `pages` | 選填 | 搜尋頁數，預設 2，最多 3 |

**如何取得 github_token**：
```http
GET /api/users/{顧問displayName}/contact
```
回應的 `data.githubToken` 即為顧問設定的 GitHub Token。

---

**成功回應範例**：
```json
{
  "success": true,
  "company": "一通數位",
  "job_title": "Java Developer",
  "company_profile": {
    "company": "一通數位",
    "industry": "遊戲/科技",
    "size": "100-500人",
    "key_skills": ["Java", "Spring Boot", "Kubernetes"],
    "job_count": 2,
    "description": "一通數位為遊戲/科技產業，目前有 2 個職缺開放中。"
  },
  "talent_profile": {
    "target_role": "Java Developer",
    "required_skills": ["Java", "Spring Boot", "Kubernetes"],
    "experience_required": "3年以上",
    "ideal_profile": "理想人選應具備 Java、Spring Boot、Kubernetes 等核心技能..."
  },
  "imported_count": 8,
  "skipped_count": 2,
  "skipped": [
    { "name": "john-doe", "reason": "已存在（ID: 42）" }
  ],
  "github_count": 7,
  "linkedin_count": 3,
  "priority_summary": "🎯 建議優先聯繫（依評級 + 符合度排序）：\n\n🥇 第1位：...",
  "full_summary": "✅ 已匯入 8 位候選人到系統\n（略過 2 位重複人選）\n\n🎯 建議優先聯繫...",
  "rate_limit_warning": null,
  "execution_time": "28.3s",
  "candidates": [...]
}
```

---

**AIbot 處理回應的方式**：

收到成功回應後，AIbot 直接將 `full_summary` 的文字內容回傳給顧問：

```
✅ 已匯入 8 位候選人到系統
（略過 2 位重複人選）

🎯 建議優先聯繫（依評級 + 符合度排序）：

🥇 第1位：John Chen（⭐A+, 88分）
   GitHub @john-chen，42 repos
   技能：Java、Spring Boot、Docker
   ⚡ 建議今天聯繫

🥈 第2位：Amy Lin（✅A, 78分）
   LinkedIn amy-lin-tw
   技能：Java、Kubernetes
   📅 建議本週內聯繫

⚠️ 其餘 6 位（B級：4、C級：2）已存入系統備查

📋 前往系統查看完整名單 → 候選人總表
```

---

**GitHub Rate Limit 警告處理**：

當 `rate_limit_warning` 不為 null 時，代表 GitHub API 已達速率限制（無認證模式 60次/小時）。
AIbot 應在回傳搜尋結果後，額外補充以下提示：

```
⚠️ GitHub API 已達每小時上限（無認證模式）

如需搜尋更多開發者，請前往個人設定 → 填入 GitHub Token，即可提升至 5000次/小時。
申請頁面：https://github.com/settings/tokens
```

---

**職缺不存在時的回應**（`success: false`）：

```json
{
  "success": false,
  "error": "找不到職缺：一通數位 / Java Developer，請確認職缺已匯入系統。"
}
```

AIbot 應回覆：
「找不到符合的職缺資料，請確認『一通數位』的『Java Developer』職缺已經在系統中建立，或請提供正確的公司名稱/職位名稱。」

---

### 2. 健康檢查

```http
GET /api/talent-sourcing/health
```

**回應範例**：
```json
{
  "success": true,
  "health": {
    "scriptsReady": true,
    "scriptsAvailable": {
      "scraper": true,
      "scorer": true,
      "migration": true
    }
  },
  "status": "ready"
}
```

---

### 評分規則（供 AIbot 解釋時參考）

| 評級 | 分數 | 代表意義 | 建議行動 |
|------|------|----------|----------|
| 🏆 S | 90+ | 極佳人選，高度符合 | ⚡ 今天聯繫 |
| ⭐ A+ | 85-89 | 優秀人選，強烈推薦 | ⚡ 今天聯繫 |
| ✅ A | 75-84 | 良好人選，推薦 | 📅 本週內聯繫 |
| 📋 B | 60-74 | 一般人選，備選 | 📌 存入備查 |
| 📝 C | 0-59 | 基本符合，低優先 | 📌 存入備查 |

評分組成：
- **技能符合度（60%）**：候選人技能 vs 職缺要求技能的比對比率
- **個人資料品質（40%）**：GitHub 活躍度（repo數、followers）或 LinkedIn 來源基準分

---

### notes 欄位格式（AI 評估報告）

每位匯入的候選人，`candidates_pipeline.notes` 欄位會包含以下結構化報告：

```
【AI 人才評估報告】2026-02-26

▌ 綜合評級：⭐ A+（88分）
⚡ 建議今天聯繫

▌ 為什麼推薦此人選
Java 工程師，專注後端。技能符合度 85%，整體評分 88/100。GitHub 活躍開發者，42 個公開專案。

▌ 最佳匹配職缺（一通數位）
① Java Developer（一通數位）- 符合度 85%
② 後端工程師（一通數位）- 符合度 77%

▌ 優勢
- Java、Spring Boot、Docker 技能符合職缺要求（85%）
- GitHub 活躍（42 個公開 repo，230 followers）
- 現任 Garena

▌ 劣勢 / 風險
- 缺少技能：Kubernetes
- 目前位置：Singapore，需確認是否可配合在地工作

▌ 聯繫時需深入瞭解
1. 目前薪資期望是否符合一通數位職缺範圍？
2. 對遊戲/科技產業的興趣與轉換動機？
3. 最快可到職時間？
4. 目前是否同時在其他公司面試中？
5. 對 Kubernetes 的熟悉程度？是否有實際專案經驗？
6. 是否有意願接受獵頭推薦？目前工作狀態如何？

▌ 資料來源
GitHub @john-chen（公開 repo：42，followers：230）
主要專案：spring-demo、microservice-demo、docker-utils

▌ AI 自動評分產出 by Step1ne 獵頭系統
```

---

## 顧問設定 API

### 取得顧問聯絡資訊

```http
GET /api/users/:displayName/contact
```

**路徑參數**：
- `displayName` - 顧問的暱稱（URL encoded）

**回應範例**：
```json
{
  "success": true,
  "data": {
    "displayName": "Jacky",
    "contactPhone": "0912-345-678",
    "contactEmail": "jacky@step1ne.com",
    "lineId": "jacky_hr",
    "telegramHandle": "@jacky",
    "githubToken": "ghp_xxxxxxxxxxxxxxxxxxxx"
  }
}
```

> **AIbot 使用場景**：在呼叫 `/find-candidates` 前，先呼叫此 API 取得顧問的 `githubToken`，以提升 GitHub 搜尋的速率限制。

**找不到時回傳空物件**（顧問未設定聯絡資訊時）：
```json
{
  "success": true,
  "data": {
    "displayName": "Jacky",
    "contactPhone": null,
    "contactEmail": null,
    "lineId": null,
    "telegramHandle": null,
    "githubToken": null
  }
}
```

---

### 儲存顧問聯絡資訊

```http
PUT /api/users/:displayName/contact
```

**請求 Body**：
```json
{
  "contactPhone": "0912-345-678",
  "contactEmail": "jacky@step1ne.com",
  "lineId": "jacky_hr",
  "telegramHandle": "@jacky",
  "githubToken": "ghp_xxxxxxxxxxxxxxxxxxxx"
}
```

**回應**：
```json
{
  "success": true,
  "message": "聯絡資訊已儲存"
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

### v2.0.0 (2026-02-26)
- ✅ 人才搜尋系統 API（6步驟獵才流程）
- ✅ `POST /api/talent-sourcing/find-candidates`（AIbot 觸發）
- ✅ GitHub API 搜尋（支援 Token 認證 / 無認證模式）
- ✅ Google → LinkedIn 搜尋（BeautifulSoup，無需 Chrome）
- ✅ 自動去重、評分（S/A+/A/B/C）、AI 報告寫入
- ✅ 顧問設定 API（含 GitHub Token 儲存）

### v1.0.0 (2026-02-23)
- ✅ 候選人管理 API
- ✅ 職缺管理 API
- ✅ AI 配對 API
- ✅ 批量操作支援

---

## 聯絡我們

- GitHub: https://github.com/jacky6658/step1ne-headhunter-system
- Email: support@step1ne.com

