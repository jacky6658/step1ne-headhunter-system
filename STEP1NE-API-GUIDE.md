# Step1ne API 完整指南（給 AI Bot 使用）

**版本**: v1.0  
**最後更新**: 2026-02-24  
**適用對象**: 所有 AI Bot（YuQi, Phoebe Bot, 其他顧問的 Bot）

---

## 🎯 系統概述

**Step1ne = B2B SaaS 獵頭協作平台**

```
顧問 Jacky → YuQi Bot → Step1ne API → Jacky 的資料
顧問 Phoebe → Phoebe Bot → Step1ne API → Phoebe 的資料
其他顧問 → 他們的 Bot → Step1ne API → 他們的資料
```

**核心特點**：
- ✅ **多租戶架構**：每個顧問有獨立資料
- ✅ **公開 API**：無需認證（目前）
- ✅ **權限隔離**：後端自動過濾資料
- ✅ **REST API**：標準 HTTP + JSON

---

## 🌐 API 基本資訊

### Base URL

**生產環境**（Zeabur）:
```
https://backendstep1ne.zeabur.app/api
```

**本地開發**:
```
http://localhost:3001/api
```

### 認證

**目前**: 無需認證（公開 API）

**未來**: API Key 機制（防止濫用）

### 回應格式

所有 API 返回標準 JSON 格式：

**成功回應**:
```json
{
  "success": true,
  "data": { ... }
}
```

**錯誤回應**:
```json
{
  "success": false,
  "error": "錯誤訊息"
}
```

---

## 📋 API 端點列表

### 1. Candidates（候選人）

#### 1.1 取得候選人列表

```http
GET /api/candidates
```

**Query 參數**（權限過濾）:
- `userRole=REVIEWER` - 顧問角色
- `consultant=Jacky` - 顧問名稱

**範例請求**:
```bash
# Jacky 的候選人
curl "https://backendstep1ne.zeabur.app/api/candidates?userRole=REVIEWER&consultant=Jacky"

# Phoebe 的候選人
curl "https://backendstep1ne.zeabur.app/api/candidates?userRole=REVIEWER&consultant=Phoebe"

# Admin 看全部
curl "https://backendstep1ne.zeabur.app/api/candidates"
```

**回應範例**:
```json
{
  "success": true,
  "data": [
    {
      "id": "1",
      "name": "張三",
      "email": "zhang@example.com",
      "phone": "0912345678",
      "position": "前端工程師",
      "location": "台北市",
      "years": 3,
      "jobChanges": 2,
      "avgTenure": 18,
      "skills": ["React", "TypeScript", "Node.js"],
      "education": "國立台灣大學資訊工程學系",
      "source": "104",
      "workHistory": "...",
      "reasonForLeaving": "...",
      "stabilityScore": 85,
      "status": "待聯繫",
      "consultant": "Jacky",
      "notes": "...",
      "talentGrade": "A"
    }
  ]
}
```

---

#### 1.2 取得單一候選人

```http
GET /api/candidates/:id
```

**範例**:
```bash
curl "https://backendstep1ne.zeabur.app/api/candidates/1"
```

---

#### 1.3 新增候選人

```http
POST /api/candidates
```

**請求 Body**:
```json
{
  "name": "李四",
  "email": "li@example.com",
  "phone": "0923456789",
  "position": "後端工程師",
  "years": 5,
  "skills": ["Java", "Spring", "MySQL"],
  "education": "碩士",
  "source": "LinkedIn",
  "consultant": "Phoebe"
}
```

**範例**:
```bash
curl -X POST "https://backendstep1ne.zeabur.app/api/candidates" \
  -H "Content-Type: application/json" \
  -d '{"name":"李四","email":"li@example.com","consultant":"Phoebe"}'
```

---

#### 1.4 更新候選人

```http
PUT /api/candidates/:id
```

**請求 Body**（任意欄位）:
```json
{
  "status": "面試中",
  "notes": "已安排 2/25 面試",
  "consultant": "Phoebe"
}
```

**範例**:
```bash
curl -X PUT "https://backendstep1ne.zeabur.app/api/candidates/1" \
  -H "Content-Type: application/json" \
  -d '{"status":"面試中","notes":"已安排面試"}'
```

---

#### 1.5 更新候選人狀態（專用）

```http
PUT /api/candidates/:id/status
```

**請求 Body**:
```json
{
  "status": "Offer"
}
```

---

#### 1.6 軟刪除候選人

```http
DELETE /api/candidates/:id
```

**說明**: 清空 `name` 欄位，保留歷史記錄

---

#### 1.7 生成匿名履歷

```http
POST /api/candidates/:id/anonymous-resume
```

**請求 Body**（可選）:
```json
{
  "jobId": "job-52"
}
```

**回應**:
```json
{
  "success": true,
  "markdown": "# 候選人代號：Michael\n\n## 專業背景\n...",
  "candidateCode": "Michael"
}
```

**範例**:
```bash
curl -X POST "https://backendstep1ne.zeabur.app/api/candidates/236/anonymous-resume" \
  -H "Content-Type: application/json" \
  -d '{"jobId":"job-52"}'
```

---

### 2. Jobs（職缺）

#### 2.1 取得職缺列表

```http
GET /api/jobs
```

**回應範例**:
```json
{
  "success": true,
  "data": [
    {
      "id": "job-52",
      "title": "C++ Developer (後端工程師)",
      "company": {
        "name": "一通數位有限公司"
      },
      "department": "技術部",
      "headcount": 2,
      "salaryRange": "60,000~80,000元/月",
      "requiredSkills": ["C++", "多執行緒", "網路程式設計"],
      "yearsRequired": 1,
      "educationRequired": "大學以上",
      "workLocation": "台北市內湖區",
      "status": "招募中"
    }
  ]
}
```

---

#### 2.2 取得單一職缺

```http
GET /api/jobs/:id
```

---

#### 2.3 新增職缺

```http
POST /api/jobs
```

**請求 Body**（21 個欄位）:
```json
{
  "title": "Java Developer",
  "company": "一通數位有限公司",
  "department": "技術部",
  "headcount": 3,
  "salaryRange": "70k-100k",
  "skills": ["Java", "Spring Boot", "MySQL"],
  "experience": "2年以上",
  "education": "大學以上",
  "location": "台北市",
  "status": "招募中"
}
```

---

#### 2.4 更新職缺

```http
PUT /api/jobs/:id
```

---

#### 2.5 刪除職缺

```http
DELETE /api/jobs/:id
```

---

### 3. AI Persona Matching（AI 配對）

#### 3.1 生成候選人 Persona

```http
POST /api/personas/generate-candidate
```

**請求 Body**:
```json
{
  "candidate": {
    "name": "張三",
    "years": 3,
    "skills": ["React", "TypeScript"],
    "workHistory": "...",
    "education": "台大資工"
  }
}
```

**回應**:
```json
{
  "success": true,
  "persona": {
    "技能能力": {...},
    "成長潛力": {...},
    "文化特質": {...},
    "動機驅力": {...}
  }
}
```

---

#### 3.2 生成公司 Persona

```http
POST /api/personas/generate-company
```

**請求 Body**:
```json
{
  "job": {...},
  "company": {...}
}
```

---

#### 3.3 單一配對

```http
POST /api/personas/match
```

**請求 Body**:
```json
{
  "candidatePersona": {...},
  "companyPersona": {...}
}
```

**回應**:
```json
{
  "success": true,
  "result": {
    "總分": 75.3,
    "等級": "B",
    "推薦優先級": "P1",
    "維度評分": {
      "技能匹配": 71,
      "成長匹配": 82,
      "文化匹配": 67,
      "動機匹配": 88
    },
    "適配亮點": [...],
    "風險提示": [...],
    "建議": {...}
  }
}
```

---

#### 3.4 批量配對（推薦使用）

```http
POST /api/personas/batch-match
```

**請求 Body**:
```json
{
  "job": {
    "id": "job-52",
    "title": "C++ Developer",
    "requiredSkills": ["C++", "Linux", "Boost.Asio"],
    "yearsRequired": 1,
    "salaryRange": "60k-80k"
  },
  "company": {
    "name": "一通數位有限公司",
    "industry": "金融科技"
  },
  "candidates": [
    {
      "id": "1",
      "name": "張三",
      "years": 3,
      "skills": ["C++", "Linux", "Python"]
    },
    {
      "id": "2",
      "name": "李四",
      "years": 5,
      "skills": ["C++", "Boost.Asio", "TCP/IP"]
    }
  ]
}
```

**回應**:
```json
{
  "success": true,
  "company": {
    "name": "一通數位有限公司",
    "jobTitle": "C++ Developer"
  },
  "result": {
    "summary": {
      "total_candidates": 2,
      "grade_distribution": {
        "S": 0,
        "A": 1,
        "B": 1,
        "C": 0,
        "D": 0
      },
      "average_score": 78.5,
      "top_5": [
        {
          "name": "李四",
          "total_score": 85,
          "grade": "A",
          "priority": "P0"
        },
        {
          "name": "張三",
          "total_score": 72,
          "grade": "B",
          "priority": "P1"
        }
      ]
    },
    "matches": [
      {
        "candidate": {
          "id": "2",
          "name": "李四"
        },
        "總分": 85,
        "等級": "A",
        "推薦優先級": "P0",
        "維度評分": {
          "技能匹配": 90,
          "成長匹配": 82,
          "文化匹配": 80,
          "動機匹配": 88
        },
        "適配亮點": [
          "✅ C++ 技能完全匹配",
          "✅ Boost.Asio 經驗豐富",
          "✅ 5年經驗超過要求"
        ],
        "風險提示": [],
        "建議": {
          "面試重點": ["深入探討 Boost.Asio 實戰經驗"],
          "薪資策略": "可提供 80-100k（中高端）",
          "留任策略": "強調技術成長空間"
        }
      }
    ]
  }
}
```

---

#### 3.5 完整配對（推薦使用 - 最簡單）

```http
POST /api/personas/full-match
```

**請求 Body**（只需要 ID）:
```json
{
  "candidateId": "236",
  "jobId": "job-52"
}
```

**說明**: 自動從 Google Sheets 讀取候選人 + 職缺資料，執行完整配對

---

### 4. Health Check

```http
GET /api/health
```

**回應**:
```json
{
  "status": "ok",
  "timestamp": "2026-02-24T10:00:00.000Z",
  "service": "step1ne-headhunter-api",
  "version": "1.0.0"
}
```

---

## 🤖 AI Bot 使用範例

### 範例 1：Phoebe Bot 取得自己的候選人

```javascript
// OpenClaw AI Bot (JavaScript/Node.js)
const fetch = require('node-fetch');

async function getPhoebesCandidates() {
  const response = await fetch(
    'https://backendstep1ne.zeabur.app/api/candidates?userRole=REVIEWER&consultant=Phoebe'
  );
  
  const data = await response.json();
  
  if (data.success) {
    console.log(`Phoebe 共有 ${data.data.length} 位候選人`);
    return data.data;
  } else {
    console.error('取得候選人失敗:', data.error);
    return [];
  }
}

getPhoebesCandidates();
```

---

### 範例 2：AI 配對一通數位 C++ 職缺

```javascript
async function matchCppJob() {
  // 步驟 1：取得職缺
  const jobResp = await fetch('https://backendstep1ne.zeabur.app/api/jobs');
  const jobData = await jobResp.json();
  const cppJob = jobData.data.find(j => j.id === 'job-52');
  
  // 步驟 2：取得候選人（Phoebe 的）
  const candidatesResp = await fetch(
    'https://backendstep1ne.zeabur.app/api/candidates?userRole=REVIEWER&consultant=Phoebe'
  );
  const candidatesData = await candidatesResp.json();
  
  // 步驟 3：篩選 C++ 候選人
  const cppCandidates = candidatesData.data.filter(c => 
    c.skills.some(skill => skill.toLowerCase().includes('c++'))
  );
  
  // 步驟 4：批量配對
  const matchResp = await fetch(
    'https://backendstep1ne.zeabur.app/api/personas/batch-match',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job: cppJob,
        company: cppJob.company,
        candidates: cppCandidates
      })
    }
  );
  
  const matchData = await matchResp.json();
  
  if (matchData.success) {
    console.log('🎯 配對結果：');
    console.log(`平均分數: ${matchData.result.summary.average_score}`);
    console.log('\nTop 5 推薦:');
    matchData.result.summary.top_5.forEach((c, i) => {
      console.log(`${i+1}. ${c.name} - ${c.total_score}分 (${c.grade}級)`);
    });
  }
}

matchCppJob();
```

---

### 範例 3：新增候選人到履歷池

```javascript
async function addCandidate(candidateData) {
  const response = await fetch(
    'https://backendstep1ne.zeabur.app/api/candidates',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: candidateData.name,
        email: candidateData.email,
        phone: candidateData.phone,
        position: candidateData.position,
        years: candidateData.years,
        skills: candidateData.skills,
        education: candidateData.education,
        source: 'LinkedIn',
        consultant: 'Phoebe',  // 指定負責顧問
        status: '待聯繫'
      })
    }
  );
  
  const data = await response.json();
  
  if (data.success) {
    console.log('✅ 候選人新增成功！');
    return data.data;
  } else {
    console.error('❌ 新增失敗:', data.error);
    return null;
  }
}

// 使用範例
addCandidate({
  name: '王五',
  email: 'wang@example.com',
  phone: '0934567890',
  position: 'DevOps 工程師',
  years: 4,
  skills: ['Docker', 'Kubernetes', 'AWS', 'CI/CD'],
  education: '碩士'
});
```

---

### 範例 4：更新候選人狀態

```javascript
async function updateCandidateStatus(candidateId, newStatus, notes) {
  const response = await fetch(
    `https://backendstep1ne.zeabur.app/api/candidates/${candidateId}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: newStatus,
        notes: notes
      })
    }
  );
  
  const data = await response.json();
  
  if (data.success) {
    console.log(`✅ 候選人 ${candidateId} 狀態已更新為「${newStatus}」`);
  }
}

// 使用範例
updateCandidateStatus('1', '面試中', '2/25 與一通數位面試');
```

---

## 🔒 權限隔離機制

### 自動過濾規則

**REVIEWER（獵頭顧問）**:
- 只能看到 `consultant` 欄位 = 自己名字的候選人
- 可以看到「未指派」的候選人（`consultant` 為空）

**ADMIN**:
- 可以看到所有候選人

**範例**:
```javascript
// Phoebe Bot 呼叫（自動過濾）
GET /api/candidates?userRole=REVIEWER&consultant=Phoebe
→ 返回: Phoebe 的候選人 + 未指派候選人

// Jacky Bot 呼叫（自動過濾）
GET /api/candidates?userRole=REVIEWER&consultant=Jacky
→ 返回: Jacky 的候選人 + 未指派候選人

// Admin 呼叫（不過濾）
GET /api/candidates
→ 返回: 所有候選人
```

---

## 🎯 實戰任務：完整招募流程

**任務**：為「一通數位 C++ Developer」職缺找到 Top 5 候選人

**步驟 1：取得職缺**
```bash
curl "https://backendstep1ne.zeabur.app/api/jobs" | jq '.data[] | select(.id == "job-52")'
```

**步驟 2：取得候選人（Phoebe 的）**
```bash
curl "https://backendstep1ne.zeabur.app/api/candidates?userRole=REVIEWER&consultant=Phoebe"
```

**步驟 3：批量配對**
```bash
curl -X POST "https://backendstep1ne.zeabur.app/api/personas/batch-match" \
  -H "Content-Type: application/json" \
  -d @match-request.json
```

**步驟 4：查看 Top 5**
```bash
# 從回應中的 result.summary.top_5 取得推薦名單
```

**步驟 5：更新候選人狀態**
```bash
curl -X PUT "https://backendstep1ne.zeabur.app/api/candidates/1" \
  -H "Content-Type: application/json" \
  -d '{"status":"已聯繫","notes":"推薦給一通數位"}'
```

---

## 📚 相關文檔

- **前端使用手冊**: https://step1ne.zeabur.app/#help
- **GitHub Repo**: https://github.com/jacky6658/step1ne-headhunter-system
- **部署文檔**: ZEABUR-DEPLOYMENT.md
- **本地開發**: LOCAL-DEVELOPMENT.md

---

## 💬 技術支援

**問題回報**:
- GitHub Issues: https://github.com/jacky6658/step1ne-headhunter-system/issues
- Telegram: @YuQi0923_bot

**功能建議**:
- 在 GitHub 開 Issue 或直接聯繫 Jacky

---

**文檔版本**: v1.0 (2026-02-24)  
**維護者**: Jacky Chen (@jackyyuqi)  
**授權**: MIT License
