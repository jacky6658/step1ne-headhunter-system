/**
 * Step1ne Headhunter System - Node.js Bot 整合範例
 * 
 * 這個範例展示如何從 Node.js Bot 呼叫 Step1ne API
 * 適用於任何 Node.js Bot 框架（Telegram、Discord、LINE 等）
 */

const axios = require('axios');

// ========================================
// 設定
// ========================================

const API_BASE = 'http://localhost:3001/api';  // 開發環境
// const API_BASE = 'https://api-hr.step1ne.com/api';  // 正式環境

// 未來版本需要 API Key
// const API_KEY = 'your_api_key_here';
// const headers = { 'Authorization': `Bearer ${API_KEY}` };
const headers = {};

// ========================================
// 候選人管理
// ========================================

/**
 * 搜尋候選人
 * @param {Object} filters - 篩選條件 { status, grade, keyword }
 * @returns {Promise<Array>} 候選人列表
 */
async function searchCandidates(filters = {}) {
  const params = {};
  
  if (filters.status) params.status = filters.status;
  if (filters.grade) params.grade = filters.grade;
  
  const response = await axios.get(`${API_BASE}/candidates`, {
    params,
    headers
  });
  
  let candidates = response.data.data;
  
  // 客戶端過濾關鍵字
  if (filters.keyword) {
    const keyword = filters.keyword.toLowerCase();
    candidates = candidates.filter(c => 
      c.name.toLowerCase().includes(keyword) ||
      c.skills.some(skill => skill.toLowerCase().includes(keyword))
    );
  }
  
  return candidates;
}

/**
 * 取得單一候選人
 * @param {string} candidateId - 候選人 ID
 * @returns {Promise<Object>} 候選人詳細資料
 */
async function getCandidate(candidateId) {
  const response = await axios.get(`${API_BASE}/candidates/${candidateId}`, {
    headers
  });
  
  return response.data.data;
}

/**
 * 更新候選人狀態
 * @param {string} candidateId - 候選人 ID
 * @param {string} newStatus - 新狀態
 * @returns {Promise<Object>} 更新結果
 */
async function updateCandidateStatus(candidateId, newStatus) {
  const response = await axios.put(
    `${API_BASE}/candidates/${candidateId}`,
    { status: newStatus },
    { headers }
  );
  
  return response.data.data;
}

/**
 * AI 自動評級候選人
 * @param {string} candidateId - 候選人 ID
 * @returns {Promise<Object>} 評級結果 { grade, score, breakdown }
 */
async function gradeCandidate(candidateId) {
  const response = await axios.post(
    `${API_BASE}/candidates/${candidateId}/grade`,
    {},
    { headers }
  );
  
  return response.data.data;
}

// ========================================
// 職缺管理
// ========================================

/**
 * 搜尋職缺
 * @param {Object} filters - 篩選條件 { status, company, skills }
 * @returns {Promise<Array>} 職缺列表
 */
async function searchJobs(filters = {}) {
  const params = {};
  
  if (filters.status) params.status = filters.status;
  if (filters.company) params.company = filters.company;
  if (filters.skills) params.skills = filters.skills;
  
  const response = await axios.get(`${API_BASE}/jobs`, {
    params,
    headers
  });
  
  return response.data.data;
}

/**
 * 取得單一職缺
 * @param {string} jobId - 職缺 ID
 * @returns {Promise<Object>} 職缺詳細資料
 */
async function getJob(jobId) {
  const response = await axios.get(`${API_BASE}/jobs/${jobId}`, {
    headers
  });
  
  return response.data.data;
}

// ========================================
// AI 配對
// ========================================

/**
 * 批量配對：一個職缺 vs 多個候選人
 * @param {string} jobId - 職缺 ID
 * @param {Array<string>} candidateIds - 候選人 ID 列表
 * @returns {Promise<Object>} 配對結果（已排序）
 */
async function matchCandidatesToJob(jobId, candidateIds) {
  // 取得職缺資料
  const job = await getJob(jobId);
  
  // 準備配對請求
  const requestData = {
    job: {
      title: job.title,
      department: job.department,
      requiredSkills: job.requiredSkills,
      yearsRequired: job.yearsRequired
    },
    company: job.company,
    candidateIds
  };
  
  // 執行批量配對
  const response = await axios.post(
    `${API_BASE}/personas/batch-match`,
    requestData,
    { headers }
  );
  
  return response.data.result;
}

/**
 * 單一配對：一個候選人 vs 一個職缺
 * @param {string} candidateId - 候選人 ID
 * @param {string} jobId - 職缺 ID
 * @returns {Promise<Object>} 配對結果
 */
async function matchSingleCandidate(candidateId, jobId) {
  const job = await getJob(jobId);
  
  const requestData = {
    candidateId,
    job: {
      title: job.title,
      requiredSkills: job.requiredSkills,
      yearsRequired: job.yearsRequired
    },
    company: job.company
  };
  
  const response = await axios.post(
    `${API_BASE}/personas/full-match`,
    requestData,
    { headers }
  );
  
  return response.data.matchResult;
}

// ========================================
// 使用範例
// ========================================

async function main() {
  console.log('🤖 Step1ne API 測試\n');
  
  try {
    // 範例 1：搜尋 A 級候選人
    console.log('📋 搜尋 A 級候選人...');
    const candidates = await searchCandidates({ grade: 'A' });
    console.log(`找到 ${candidates.length} 位 A 級候選人`);
    if (candidates.length > 0) {
      console.log(`  - ${candidates[0].name} (${candidates[0].position})`);
    }
    console.log();
    
    // 範例 2：搜尋開放中的職缺
    console.log('💼 搜尋開放中的職缺...');
    const jobs = await searchJobs({ status: '開放中' });
    console.log(`找到 ${jobs.length} 個開放中的職缺`);
    if (jobs.length > 0) {
      console.log(`  - ${jobs[0].title} (${jobs[0].company.name})`);
    }
    console.log();
    
    // 範例 3：AI 配對（職缺 vs 候選人）
    if (jobs.length > 0 && candidates.length > 0) {
      console.log('🤖 執行 AI 配對...');
      const jobId = jobs[0].id;
      const candidateIds = candidates.slice(0, 5).map(c => c.id);  // 取前 5 位
      
      const result = await matchCandidatesToJob(jobId, candidateIds);
      
      console.log(`\n配對結果：${result.summary.total} 位候選人`);
      console.log(`平均分數：${result.summary.avgScore.toFixed(1)}`);
      console.log(`評級分布：${JSON.stringify(result.summary.grades)}`);
      
      console.log('\nTop 3 推薦：');
      result.matches.slice(0, 3).forEach((match, i) => {
        console.log(`${i + 1}. ${match.candidate.name} - ${match.score.toFixed(1)}分 (${match.grade}級)`);
        console.log(`   亮點：${match.highlights[0]}`);
      });
    }
    
    console.log('\n✅ 測試完成！');
    
  } catch (error) {
    console.error('❌ 錯誤：', error.message);
    if (error.response) {
      console.error('API 回應：', error.response.data);
    }
  }
}

// 執行測試（如果直接執行此檔案）
if (require.main === module) {
  main();
}

// 匯出函數供其他模組使用
module.exports = {
  searchCandidates,
  getCandidate,
  updateCandidateStatus,
  gradeCandidate,
  searchJobs,
  getJob,
  matchCandidatesToJob,
  matchSingleCandidate
};
