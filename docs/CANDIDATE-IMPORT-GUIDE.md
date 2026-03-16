# Step1ne 候選人匯入指南 v1.0
> 適用對象：AI 助理（Mike / YuQi）
> 更新日期：2026-03-16

---

## 方法：直接寫入 PostgreSQL（推薦）

> API PUT 端點目前需要 API Key，建議使用 Node.js pg 直連 DB。

```bash
DB_URL="postgresql://root:etUh2zkR4Mr8gfWLs059S7Dm1T6Yby3Q@tpe1.clusters.zeabur.com:27883/zeabur"
```

---

## 第一步：新增候選人（INSERT）

```javascript
const { Pool } = require('pg');
const pool = new Pool({ connectionString: DB_URL });

await pool.query(`
  INSERT INTO candidates_pipeline (
    name, email, phone, location,
    current_position, total_years, job_changes,
    avg_tenure_months, recent_gap_months,
    skills, education, source,
    work_history,
    stability_score, status, recruiter, notes,
    linkedin_url, created_at, updated_at
  ) VALUES (
    $1,$2,$3,$4,
    $5,$6,$7,
    $8,$9,
    $10,$11,$12,
    $13::jsonb,
    $14,$15,$16,$17,
    $18, NOW(), NOW()
  ) RETURNING id, name
`, [
  '姓名', 'email@example.com', '0900-000-000', '台北市, 台灣',
  '現職職稱 @ 公司名', 8, 3,
  36, 0,
  'PHP, Vue.js, MySQL, Redis', '大學 資管系 學士 (2012-2016)', 'LinkedIn PDF',
  JSON.stringify(workHistory),  // 見下方格式
  85, '新進', 'Jacky', '備註文字',
  'https://www.linkedin.com/in/xxx'
]);
```

### ⚠️ 常見錯誤欄位名稱

| ❌ 錯誤（不存在） | ✅ 正確 |
|----------------|--------|
| `consultant` | `recruiter` |
| `years_experience` | `total_years` |
| `job_title` | `current_position` |
| `linkedin` | `linkedin_url` |

---

## work_history 格式（必須是 JSON 陣列）

```javascript
const workHistory = [
  {
    start: "2019-03",        // 格式：YYYY-MM
    end: "present",          // 或 "2022-06"
    title: "Application Engineer",
    company: "公司名稱",
    description: "工作描述，重點職責與成就。",
    duration_months: 73      // 任職月數
  },
  {
    start: "2017-08",
    end: "2019-02",
    title: "Backend Developer",
    company: "前公司",
    description: "描述",
    duration_months: 18
  }
];
```

> **注意**：`work_history` 寫入時要加 `::jsonb`，否則會報錯。

---

## 第二步：寫入 AI 評級與總結（UPDATE）

新增候選人後，取得 `id`，再更新 AI 分析：

```javascript
const aiSummary = {
  one_liner: "一句話介紹（中文）",
  grade: "B",           // A / B / C / D
  tier: "T3",           // T1 / T2 / T3
  score: 65,            // 0-100
  confidence: 78,       // AI 信心值 0-100
  strengths: [
    "優勢1",
    "優勢2"
  ],
  risks: [
    "風險1",
    "風險2"
  ],
  top_matches: [
    {
      job_id: 19,
      company: "台灣遊戲橘子",
      title: "後端開發工程師",
      score: 70,
      reason: "技能吻合原因"
    }
  ],
  suggested_questions: [
    "初篩問題1",
    "初篩問題2"
  ],
  next_steps: "建議下一步行動"
};

await pool.query(`
  UPDATE candidates_pipeline SET
    ai_grade = $1,
    ai_score = $2,
    talent_level = $3,
    source_tier = $4,
    ai_summary = $5::jsonb,
    target_job_id = $6,
    updated_at = NOW()
  WHERE id = $7
  RETURNING id, name, ai_grade, ai_score
`, ['B', 65, 'B', 'T3', JSON.stringify(aiSummary), 19, candidateId]);
```

---

## Grade & Tier 定義

### Grade（人選等級）
| 等級 | 說明 |
|------|------|
| A | 頂尖：知名企業、技術深度出色、資料完整 |
| B | 合格：技術紮實、中等偏上、多數條件符合 |
| C | 觀察：有潛力但某維度不足 |
| D | 不適合：多數條件不符 |

### Source Tier（來源層級）
| Tier | 說明 | 範例 |
|------|------|------|
| T1 | FAANG / 獨角獸 | Google, TSMC, NVIDIA, Meta |
| T2 | 知名企業 / 上市 | LINE, ASUS, Shopee, Appier |
| T3 | 一般企業 / 中小型 | 其他 |

---

## 完整範例：一鍵匯入 + AI 評級

```javascript
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://root:etUh2zkR4Mr8gfWLs059S7Dm1T6Yby3Q@tpe1.clusters.zeabur.com:27883/zeabur'
});

async function importCandidate() {
  const workHistory = [
    {
      start: '2019-03', end: 'present',
      title: 'Application Engineer',
      company: 'Xuenn Private Limited',
      description: 'Backend developer. PHP/ASP.NET MVC, Vue.js, MySQL, Redis, CI/CD.',
      duration_months: 73
    }
  ];

  const aiSummary = {
    one_liner: '後端工程師，8年資歷，PHP/ASP.NET MVC + Vue.js，穩定型人才',
    grade: 'B', tier: 'T3', score: 65, confidence: 78,
    strengths: ['8年後端資歷', '高穩定性'],
    risks: ['技術棧較舊', '未換工作7年'],
    top_matches: [{ job_id: 19, company: '台灣遊戲橘子', title: '後端工程師', score: 70, reason: '.NET吻合' }],
    suggested_questions: ['薪資期望？', '.NET Core 深度如何？'],
    next_steps: '推薦台灣遊戲橘子 #19'
  };

  // Step 1: INSERT
  const insertResult = await pool.query(`
    INSERT INTO candidates_pipeline
    (name, email, location, current_position, total_years, job_changes,
     avg_tenure_months, recent_gap_months, skills, education, source,
     work_history, stability_score, status, recruiter, notes, linkedin_url,
     created_at, updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14,$15,$16,$17,NOW(),NOW())
    RETURNING id, name
  `, [
    '李浩瑋 Wayne Li', null, '新北市, 台灣',
    'Application Engineer @ Xuenn Private Limited',
    8, 2, 45, 0,
    'PHP, ASP.NET MVC, Vue.js, MySQL, MSSQL, MongoDB, Redis, CI/CD',
    '大葉大學 資訊管理學系 學士 (2012-2016)',
    'LinkedIn PDF',
    JSON.stringify(workHistory),
    92, '新進', 'Jacky', '備註',
    'https://www.linkedin.com/in/xxx'
  ]);

  const candidateId = insertResult.rows[0].id;
  console.log('✅ 新增成功 ID:', candidateId);

  // Step 2: AI UPDATE
  await pool.query(`
    UPDATE candidates_pipeline SET
      ai_grade = $1, ai_score = $2, talent_level = $3,
      source_tier = $4, ai_summary = $5::jsonb,
      target_job_id = $6, updated_at = NOW()
    WHERE id = $7
  `, ['B', 65, 'B', 'T3', JSON.stringify(aiSummary), 19, candidateId]);

  console.log('✅ AI 評級寫入完成');
  pool.end();
}

importCandidate().catch(console.error);
```

---

## 常見錯誤排查

| 錯誤訊息 | 原因 | 解法 |
|---------|------|------|
| `column "consultant" does not exist` | 欄位名稱錯誤 | 改用 `recruiter` |
| `invalid input syntax for type jsonb` | JSON 格式錯誤或缺少 `::jsonb` | 確認 JSON 格式，加上 `::jsonb` |
| `null value in column violates not-null` | 必填欄位為空 | 補上 `name`、`status` |
| `column "title" does not exist` | 職缺表欄位名錯誤 | 職缺表用 `position_name` |

---

如有問題請聯繫 YuQi (Jacky's AI) 🦞
