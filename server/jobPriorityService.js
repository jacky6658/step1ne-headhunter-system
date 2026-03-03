/**
 * jobPriorityService.js - 職缺優先級評分系統
 * 
 * 評分公式（滿分 100）：
 * 總分 = 成交速度(40%) + 佣金收益(30%) + 搜索成本(15%) + 成交機率(10%) + 客戶穩定(5%)
 */

// 實際數據映射表（從評分腳本移植）
const RESUME_POOL_DATA = {
  52: 26,  // Java Developer（一通數位）
  51: 5,   // C++ Developer（一通數位）
  53: 3,   // DevOps（一通數位）
};

const HEADCOUNT_DATA = {
  52: 2.5,  // Java Developer
  51: 2,    // C++ Developer
  53: 1,    // DevOps
  8: 1,     // BIM工程師
  7: 1,     // 文件管理師
};

// 客戶職缺數量
const CLIENT_JOB_COUNT = {
  "一通數位有限公司": 3,
  "創樂科技有限公司": 3,
  "遊戲橘子集團": 8,
  "優服": 8,
  "士芃科技股份有限公司": 1,
  "律准科技股份有限公司": 1,
};

// 客戶類型（新/老客戶）
const CLIENT_TYPE = {
  "一通數位有限公司": "new",
  "創樂科技有限公司": "new",
  "遊戲橘子集團": "old",
  "優服": "old",
};

// 遊戲橘子實際招募職缺（非派遣）
const GAMANIA_ACTIVE_JOBS = [
  "遊戲測試人員",
  "餐飲品牌客服",
  "會計專員",
  "雲端機房技術客服"
];

// 派遣職缺關鍵字
const DISPATCH_KEYWORDS = [
  "資安工程師",
  "雲端維運工程師",
  "後端開發工程師",
  "系統工程師"
];

/**
 * 解析薪資範圍，返回平均月薪（單位：萬）
 */
function parseSalary(salaryStr) {
  if (!salaryStr || salaryStr === "面議" || salaryStr.includes("待遇面議")) {
    return 5.0; // 默認 5 萬
  }

  // 移除逗號
  salaryStr = salaryStr.replace(/,/g, '');

  // 提取數字
  const numbers = salaryStr.match(/\d+/g);
  if (!numbers || numbers.length === 0) {
    return 5.0;
  }

  const nums = numbers.map(n => parseFloat(n));

  // 月薪格式
  if (salaryStr.includes('月薪') || salaryStr.includes('元/月') || /k/i.test(salaryStr)) {
    let avg = nums.length >= 2 ? (nums[0] + nums[1]) / 2 : nums[0];
    
    // 如果是 k 格式（例如 40k）
    if (/k/i.test(salaryStr) && avg < 100) {
      avg = avg * 1000;
    }
    
    // 如果數字很小，可能已經是萬為單位
    if (avg < 100) {
      return avg;
    }
    
    return avg / 10000;
  }

  // 已經是萬為單位
  if (salaryStr.includes('萬') || salaryStr.includes('万')) {
    return nums.length >= 2 ? (nums[0] + nums[1]) / 2 : nums[0];
  }

  // 默認認為是千為單位
  let avg = nums.length >= 2 ? (nums[0] + nums[1]) / 2 : nums[0];
  
  // 如果數字很大（>1000），認為是元
  if (avg > 1000) {
    return avg / 10000;
  }

  return avg / 10000;
}

/**
 * 計算實際佣金（單位：萬）
 */
function calculateCommission(job) {
  const company = job.client_company || '';
  const position = job.position_name || '';
  const jobId = job.id;

  const monthlySalary = parseSalary(job.salary_range);
  const annualSalary = monthlySalary * 12;
  const headcount = HEADCOUNT_DATA[jobId] || 1;

  // 一通數位：按年薪分級
  if (company === "一通數位有限公司") {
    let rate;
    if (annualSalary <= 100) {
      rate = 0.23;
    } else if (annualSalary <= 200) {
      rate = 0.25;
    } else {
      rate = 0.27;
    }
    
    const commissionPerPerson = annualSalary * rate;
    return commissionPerPerson * headcount;
  }

  // 士芃科技（BIM工程師）：1.5個月月薪（一般職員）
  if (company === "士芃科技股份有限公司") {
    const months = (position.includes('管理') || position.includes('經理')) ? 2 : 1.5;
    return monthlySalary * months * headcount;
  }

  // 律准科技（文件管理師）：約聘職缺
  if (company === "律准科技股份有限公司") {
    const contractMonths = 12; // 假設 12 個月
    const totalSalary = monthlySalary * contractMonths;
    const rate = 0.20; // 12個月以上
    return totalSalary * rate * headcount;
  }

  // 其他客戶：保守估計 1.5個月月薪
  return monthlySalary * 1.5 * headcount;
}

/**
 * 判斷是否為派遣職缺
 */
function isDispatchJob(job) {
  const company = job.client_company || '';
  const position = job.position_name || '';
  
  if (company !== "遊戲橘子集團" && company !== "優服") {
    return false;
  }
  
  return DISPATCH_KEYWORDS.some(keyword => position.includes(keyword));
}

/**
 * 成交速度評分（40分）
 */
function scoreSpeed(job, resumeCount = 0) {
  let score = 0;

  // 1. 年資要求（10分）
  const exp = (job.experience_required || '').toLowerCase();
  if (exp.includes('無經驗') || exp.includes('无经验')) {
    score += 10;
  } else if (exp.includes('1年') || exp.includes('1 年')) {
    score += 8;
  } else if (exp.includes('2年') || exp.includes('2 年')) {
    score += 6;
  } else if (exp.includes('3年') || exp.includes('3 年')) {
    score += 5;
  } else if (exp.includes('5年') || exp.includes('5 年')) {
    score += 4;
  } else if (exp.includes('10年') || exp.includes('10 年')) {
    score += 2;
  } else {
    score += 6;
  }

  // 2. 技術門檻（10分）
  const skills = (job.key_skills || '').toLowerCase();
  const position = (job.position_name || '').toLowerCase();

  if (['excel', 'office', '客服', '行政', '文書', '助理', '文件管理'].some(k => skills.includes(k) || position.includes(k))) {
    score += 10;
  } else if (['java', 'python', 'mysql', 'javascript', 'react', 'c++', 'c#'].some(k => skills.includes(k))) {
    score += 8;
  } else if (['devops', 'kubernetes', 'kafka', 'spark', 'sre', 'bim'].some(k => skills.includes(k) || position.includes(k))) {
    score += 6;
  } else if (['cpa', 'ca', 'ifrs', 'big 4'].some(k => skills.includes(k))) {
    score += 3;
  } else {
    score += 7;
  }

  // 3. 市場供給量（10分）
  const difficulty = job.recruitment_difficulty || '';
  if (difficulty.includes('高難度')) {
    score += 4;
  } else if (difficulty.includes('中難度')) {
    score += 6;
  } else {
    score += 9;
  }

  // 4. 履歷庫匹配度（5分）
  if (resumeCount >= 20) {
    score += 5;
  } else if (resumeCount >= 10) {
    score += 4;
  } else if (resumeCount >= 5) {
    score += 3;
  } else if (resumeCount >= 1) {
    score += 2;
  } else {
    score += 1;
  }

  // 5. 客戶配合度（5分）
  const company = job.client_company || '';
  const jobCount = CLIENT_JOB_COUNT[company] || 1;
  
  if (jobCount >= 10) {
    score += 5;
  } else if (jobCount >= 5) {
    score += 4;
  } else if (jobCount >= 3) {
    score += 4;
  } else {
    score += 3;
  }

  // 派遣職缺扣分
  if (isDispatchJob(job)) {
    score -= 2;
  }

  return Math.min(score, 40);
}

/**
 * 佣金收益評分（30分）
 */
function scoreCommission(job) {
  let totalCommission = calculateCommission(job);

  // 派遣打折
  if (isDispatchJob(job)) {
    totalCommission *= 0.7;
  }

  // 根據佣金金額評分（單位：萬）
  if (totalCommission >= 50) return 30;
  if (totalCommission >= 40) return 28;
  if (totalCommission >= 30) return 26;
  if (totalCommission >= 25) return 24;
  if (totalCommission >= 20) return 22;
  if (totalCommission >= 15) return 20;
  if (totalCommission >= 10) return 18;
  if (totalCommission >= 5) return 15;
  return 10;
}

/**
 * 搜索成本評分（15分）
 */
function scoreSearchCost(job) {
  let score = 0;

  const skills = (job.key_skills || '').toLowerCase();
  const position = (job.position_name || '').toLowerCase();

  // 管道適配度（7分）
  if (['java', 'python', 'c++', 'devops', 'javascript'].some(k => skills.includes(k) || position.includes(k))) {
    score += 7; // GitHub 免費
  } else {
    score += 5;
  }

  // API 消耗（4分）
  const difficulty = job.recruitment_difficulty || '';
  if (difficulty.includes('高難度')) {
    score += 2;
  } else {
    score += 4;
  }

  // 人工篩選（4分）
  score += 3;

  return score;
}

/**
 * 成交機率評分（10分）
 */
function scoreProbability(job, resumeCount = 0) {
  let score = 0;

  // 1. 履歷庫（4分）
  if (resumeCount >= 20) {
    score += 4;
  } else if (resumeCount >= 10) {
    score += 3;
  } else if (resumeCount >= 5) {
    score += 2;
  } else if (resumeCount >= 1) {
    score += 1;
  }

  // 2. 薪資競爭力（3分）
  const monthlySalary = parseSalary(job.salary_range);
  if (monthlySalary >= 8) {
    score += 3;
  } else if (monthlySalary >= 6) {
    score += 2;
  } else {
    score += 1;
  }

  // 3. 職缺吸引力（3分）
  const company = job.client_company || '';
  const jobCount = CLIENT_JOB_COUNT[company] || 1;

  if (isDispatchJob(job)) {
    score += 1;
  } else {
    score += jobCount >= 5 ? 3 : 2;
  }

  return score;
}

/**
 * 客戶穩定度評分（5分）
 */
function scoreStability(job) {
  const company = job.client_company || '';
  const jobCount = CLIENT_JOB_COUNT[company] || 1;
  const clientType = CLIENT_TYPE[company] || 'new';

  let score = 0;

  // 多職缺客戶（3分）
  if (jobCount >= 10) {
    score += 3;
  } else if (jobCount >= 5) {
    score += 3;
  } else if (jobCount >= 3) {
    score += 3;
  } else if (jobCount >= 2) {
    score += 2;
  } else {
    score += 1;
  }

  // 長期合作（2分）
  if (clientType === 'old') {
    score += 2;
  } else {
    score += 1;
  }

  return Math.min(score, 5);
}

/**
 * 計算總分和詳細評分
 */
function calculateTotalScore(job, resumeCount = 0) {
  const speed = scoreSpeed(job, resumeCount);
  const commission = scoreCommission(job);
  const cost = scoreSearchCost(job);
  const probability = scoreProbability(job, resumeCount);
  const stability = scoreStability(job);

  const total = speed + commission + cost + probability + stability;

  return {
    total,
    speed,
    commission,
    cost,
    probability,
    stability
  };
}

/**
 * 獲取優先級標籤
 */
function getPriorityLabel(score) {
  if (score >= 80) return 'P0';
  if (score >= 70) return 'P1';
  if (score >= 60) return 'P2';
  return 'P3';
}

/**
 * 主函數：計算所有職缺的優先級排序
 */
async function calculateJobPriority(jobs, pool) {
  const results = [];

  for (const job of jobs) {
    // 從資料庫查詢履歷庫數量（實際應該是動態查詢）
    const resumeCount = RESUME_POOL_DATA[job.id] || 0;

    // 計算評分
    const scores = calculateTotalScore(job, resumeCount);
    const estCommission = calculateCommission(job);

    results.push({
      id: job.id,
      position_name: job.position_name,
      client_company: job.client_company,
      job_status: job.job_status,
      salary_range: job.salary_range,
      headcount: HEADCOUNT_DATA[job.id] || 1,
      resume_pool: resumeCount,
      est_commission: parseFloat(estCommission.toFixed(1)),
      is_dispatch: isDispatchJob(job),
      scores: {
        total: scores.total,
        speed: scores.speed,
        commission: scores.commission,
        cost: scores.cost,
        probability: scores.probability,
        stability: scores.stability
      },
      priority: getPriorityLabel(scores.total)
    });
  }

  // 排序
  results.sort((a, b) => b.scores.total - a.scores.total);

  return results;
}

module.exports = {
  calculateJobPriority,
  calculateCommission,
  getPriorityLabel
};
