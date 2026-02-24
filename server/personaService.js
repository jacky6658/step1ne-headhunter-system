// Persona Matching Service - 呼叫 persona-matching Python 模組
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// persona-matching 模組的路徑（本地專案內）
const PERSONA_MODULE_PATH = path.join(__dirname, 'persona-matching');

const GENERATE_CANDIDATE_SCRIPT = path.join(PERSONA_MODULE_PATH, 'generate-candidate-persona.py');
const GENERATE_COMPANY_SCRIPT = path.join(PERSONA_MODULE_PATH, 'generate-company-persona.py');
const MATCH_SCRIPT = path.join(PERSONA_MODULE_PATH, 'match-personas.py');
const BATCH_MATCH_SCRIPT = path.join(PERSONA_MODULE_PATH, 'batch-match.py');

/**
 * 準備候選人資料（Google Sheets 格式 → Python 需要的格式）
 */
function prepareCandidateResume(candidate) {
  return {
    name: candidate.name || '',
    email: candidate.email || '',
    phone: candidate.phone || '',
    current_position: candidate.position || '',
    
    education: candidate.education || [],
    work_history: candidate.workHistory || [],
    
    total_years: parseFloat(candidate.years) || 0,
    job_changes: parseInt(candidate.jobChanges) || 0,
    skills: candidate.skills || '', // 保持字串格式，Python 腳本會自己處理
    
    github_url: candidate.githubUrl || '',
    linkedin_url: candidate.linkedinUrl || '',
    languages: candidate.languages || {}
  };
}

/**
 * 準備職缺資料（前端表單 → Python 需要的格式）
 */
function prepareJobData(job) {
  return {
    title: job.title || '',
    department: job.department || '',
    required_skills: job.requiredSkills || [],
    preferred_skills: job.preferredSkills || [],
    years_required: job.yearsRequired || 0,
    education_required: job.educationRequired || '',
    responsibilities: job.responsibilities || [],
    benefits: job.benefits || []
  };
}

/**
 * 準備公司資料（前端表單 → Python 需要的格式）
 */
function prepareCompanyData(company) {
  return {
    name: company.name || '',
    industry: company.industry || '',
    size: company.size || '',
    stage: company.stage || '',
    culture: company.culture || '',
    tech_stack: company.techStack || [],
    work_location: company.workLocation || '',
    remote_policy: company.remotePolicy || ''
  };
}

/**
 * 生成候選人畫像
 * @param {Object} candidate - 候選人資料（從 Google Sheets 來的格式）
 * @returns {Object} - 人才畫像
 */
export async function generateCandidatePersona(candidate) {
  try {
    console.log('📊 生成候選人畫像:', candidate.name);
    
    // 準備資料
    const resumeData = prepareCandidateResume(candidate);
    
    // 建立臨時檔案
    const tempDir = path.join(__dirname, 'temp');
    await fs.mkdir(tempDir, { recursive: true });
    
    const tempInputFile = path.join(tempDir, `resume-${Date.now()}.json`);
    const tempOutputFile = path.join(tempDir, `persona-${Date.now()}.json`);
    
    await fs.writeFile(
      tempInputFile,
      JSON.stringify(resumeData, null, 2),
      'utf-8'
    );
    
    // 呼叫 Python 腳本
    const command = `python3 "${GENERATE_CANDIDATE_SCRIPT}" --resume "${tempInputFile}" --output "${tempOutputFile}"`;
    
    console.log('執行命令:', command);
    const { stdout, stderr } = await execAsync(command);
    
    if (stderr && !stderr.includes('warning')) {
      console.error('generate-candidate-persona stderr:', stderr);
    }
    
    // 讀取結果
    const personaJSON = await fs.readFile(tempOutputFile, 'utf-8');
    const persona = JSON.parse(personaJSON);
    
    // 清理臨時檔案
    await fs.unlink(tempInputFile).catch(() => {});
    await fs.unlink(tempOutputFile).catch(() => {});
    
    console.log('✅ 人才畫像生成成功');
    
    return {
      success: true,
      persona,
      candidateId: candidate.id,
      candidateName: candidate.name
    };
    
  } catch (error) {
    console.error('❌ 生成人才畫像失敗:', error);
    throw new Error(`生成人才畫像失敗: ${error.message}`);
  }
}

/**
 * 生成公司畫像
 * @param {Object} job - 職缺資料
 * @param {Object} company - 公司資料
 * @returns {Object} - 公司畫像
 */
export async function generateCompanyPersona(job, company) {
  try {
    console.log('🏢 生成公司畫像:', company.name);
    
    // 準備資料
    const jobData = prepareJobData(job);
    const companyData = prepareCompanyData(company);
    
    // 建立臨時檔案
    const tempDir = path.join(__dirname, 'temp');
    await fs.mkdir(tempDir, { recursive: true });
    
    const tempJobFile = path.join(tempDir, `job-${Date.now()}.json`);
    const tempCompanyFile = path.join(tempDir, `company-${Date.now()}.json`);
    const tempOutputFile = path.join(tempDir, `company-persona-${Date.now()}.json`);
    
    await fs.writeFile(tempJobFile, JSON.stringify(jobData, null, 2), 'utf-8');
    await fs.writeFile(tempCompanyFile, JSON.stringify(companyData, null, 2), 'utf-8');
    
    // 呼叫 Python 腳本
    const command = `python3 "${GENERATE_COMPANY_SCRIPT}" --job "${tempJobFile}" --company "${tempCompanyFile}" --output "${tempOutputFile}"`;
    
    console.log('執行命令:', command);
    const { stdout, stderr } = await execAsync(command);
    
    if (stderr && !stderr.includes('warning')) {
      console.error('generate-company-persona stderr:', stderr);
    }
    
    // 讀取結果
    const personaJSON = await fs.readFile(tempOutputFile, 'utf-8');
    const persona = JSON.parse(personaJSON);
    
    // 清理臨時檔案
    await fs.unlink(tempJobFile).catch(() => {});
    await fs.unlink(tempCompanyFile).catch(() => {});
    await fs.unlink(tempOutputFile).catch(() => {});
    
    console.log('✅ 公司畫像生成成功');
    
    return {
      success: true,
      persona,
      companyName: company.name,
      jobTitle: job.title
    };
    
  } catch (error) {
    console.error('❌ 生成公司畫像失敗:', error);
    throw new Error(`生成公司畫像失敗: ${error.message}`);
  }
}

/**
 * 執行單一配對（候選人畫像 vs 公司畫像）
 * @param {Object} candidatePersona - 人才畫像
 * @param {Object} companyPersona - 公司畫像
 * @returns {Object} - 配對報告
 */
export async function matchPersonas(candidatePersona, companyPersona) {
  try {
    console.log('🤝 執行配對分析');
    
    // 建立臨時檔案
    const tempDir = path.join(__dirname, 'temp');
    await fs.mkdir(tempDir, { recursive: true });
    
    const tempCandidateFile = path.join(tempDir, `candidate-persona-${Date.now()}.json`);
    const tempCompanyFile = path.join(tempDir, `company-persona-${Date.now()}.json`);
    const tempOutputFile = path.join(tempDir, `match-result-${Date.now()}.json`);
    
    await fs.writeFile(tempCandidateFile, JSON.stringify(candidatePersona, null, 2), 'utf-8');
    await fs.writeFile(tempCompanyFile, JSON.stringify(companyPersona, null, 2), 'utf-8');
    
    // 呼叫 Python 腳本
    const command = `python3 "${MATCH_SCRIPT}" --candidate "${tempCandidateFile}" --company "${tempCompanyFile}" --output "${tempOutputFile}"`;
    
    console.log('執行命令:', command);
    const { stdout, stderr } = await execAsync(command);
    
    if (stderr && !stderr.includes('warning')) {
      console.error('match-personas stderr:', stderr);
    }
    
    // 讀取結果
    const resultJSON = await fs.readFile(tempOutputFile, 'utf-8');
    const matchResult = JSON.parse(resultJSON);
    
    // 清理臨時檔案
    await fs.unlink(tempCandidateFile).catch(() => {});
    await fs.unlink(tempCompanyFile).catch(() => {});
    await fs.unlink(tempOutputFile).catch(() => {});
    
    console.log('✅ 配對分析完成:', matchResult.grade, matchResult.total_score);
    
    return {
      success: true,
      result: matchResult
    };
    
  } catch (error) {
    console.error('❌ 配對分析失敗:', error);
    throw new Error(`配對分析失敗: ${error.message}`);
  }
}

/**
 * 批量配對（一個職缺 vs 多個候選人）
 * @param {Object} companyPersona - 公司畫像
 * @param {Array} candidatePersonas - 人才畫像陣列
 * @returns {Object} - 批量配對結果
 */
export async function batchMatch(companyPersona, candidatePersonas) {
  try {
    console.log(`🔄 批量配對: 1 個職缺 vs ${candidatePersonas.length} 位候選人`);
    
    // 建立臨時檔案
    const tempDir = path.join(__dirname, 'temp');
    await fs.mkdir(tempDir, { recursive: true });
    
    const tempCompanyFile = path.join(tempDir, `company-persona-${Date.now()}.json`);
    const tempCandidatesFile = path.join(tempDir, `candidates-personas-${Date.now()}.json`);
    const tempOutputFile = path.join(tempDir, `batch-result-${Date.now()}.json`);
    
    await fs.writeFile(tempCompanyFile, JSON.stringify(companyPersona, null, 2), 'utf-8');
    await fs.writeFile(tempCandidatesFile, JSON.stringify(candidatePersonas, null, 2), 'utf-8');
    
    // 呼叫 Python 腳本
    const command = `python3 "${BATCH_MATCH_SCRIPT}" --company "${tempCompanyFile}" --candidates "${tempCandidatesFile}" --output "${tempOutputFile}"`;
    
    console.log('執行命令:', command);
    const { stdout, stderr } = await execAsync(command);
    
    if (stderr && !stderr.includes('warning')) {
      console.error('batch-match stderr:', stderr);
    }
    
    // 讀取結果
    const resultJSON = await fs.readFile(tempOutputFile, 'utf-8');
    const batchResult = JSON.parse(resultJSON);
    
    // 清理臨時檔案
    await fs.unlink(tempCompanyFile).catch(() => {});
    await fs.unlink(tempCandidatesFile).catch(() => {});
    await fs.unlink(tempOutputFile).catch(() => {});
    
    console.log('✅ 批量配對完成');
    console.log(`   總候選人: ${batchResult.summary.total_candidates}`);
    console.log(`   平均分: ${batchResult.summary.average_score.toFixed(1)}`);
    console.log(`   等級分布: S=${batchResult.summary.grade_distribution.S}, A=${batchResult.summary.grade_distribution.A}, B=${batchResult.summary.grade_distribution.B}`);
    
    return {
      success: true,
      result: batchResult
    };
    
  } catch (error) {
    console.error('❌ 批量配對失敗:', error);
    throw new Error(`批量配對失敗: ${error.message}`);
  }
}

/**
 * 完整流程：生成畫像 + 配對
 * @param {Object} candidate - 候選人資料
 * @param {Object} job - 職缺資料
 * @param {Object} company - 公司資料
 * @returns {Object} - 完整配對報告
 */
export async function fullMatch(candidate, job, company) {
  try {
    console.log('🎯 執行完整配對流程');
    
    // Step 1: 生成候選人畫像
    const candidateResult = await generateCandidatePersona(candidate);
    
    // Step 2: 生成公司畫像
    const companyResult = await generateCompanyPersona(job, company);
    
    // Step 3: 執行配對
    const matchResult = await matchPersonas(
      candidateResult.persona,
      companyResult.persona
    );
    
    return {
      success: true,
      candidate: {
        id: candidate.id,
        name: candidate.name,
        persona: candidateResult.persona
      },
      company: {
        name: company.name,
        jobTitle: job.title,
        persona: companyResult.persona
      },
      match: matchResult.result
    };
    
  } catch (error) {
    console.error('❌ 完整配對失敗:', error);
    throw error;
  }
}
