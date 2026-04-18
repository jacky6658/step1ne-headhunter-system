// Anonymous Resume Service - 匿名履歷生成
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execPromise = promisify(exec);

// 匿名履歷腳本位置
const SCRIPT_PATH = '/Users/user/clawd/projects/step1ne-headhunter-skill/skills/headhunter/scripts/anonymize-resume.py';
const TEMPLATE_PATH = '/Users/user/clawd/projects/step1ne-headhunter-skill/skills/headhunter/templates/anonymous-resume-template.md';

/**
 * 將候選人資料轉換為 anonymize-resume.py 所需的 JSON 格式
 */
function candidateToJSON(candidate, consultant = 'Jacky') {
  return {
    name: candidate.name || '未知候選人',
    email: candidate.email || '',
    phone: candidate.phone || '',
    location: candidate.location || '',
    currentPosition: candidate.currentJobTitle || candidate._raw?.workHistory?.split(';')[0] || '',
    totalYears: parseInt(candidate._raw?.totalYears || candidate.workExperience?.replace('年', '') || '0'),
    jobChanges: parseInt(candidate._raw?.jobChanges || '0'),
    avgTenure: parseInt(candidate._raw?.avgTenure || '12'),
    recentGap: parseInt(candidate._raw?.recentGap || '0'),
    skills: Array.isArray(candidate.skills) 
      ? candidate.skills.join('、') 
      : (candidate.skills || ''),
    education: candidate.education || candidate._raw?.educationDetail || '',
    workHistory: candidate._raw?.workHistory || `${candidate.currentJobTitle || ''} at ${candidate.currentCompany || ''}`,
    leaveReason: candidate._raw?.leaveReason || '尋求更好發展機會',
    stabilityScore: parseInt(candidate._raw?.stabilityScore || candidate.stability || '75'),
    educationDetail: candidate._raw?.educationDetail || candidate.education || '',
    personality: candidate._raw?.personality || '',
    consultant: candidate.consultant || consultant
  };
}

/**
 * 將職缺資料轉換為 anonymize-resume.py 所需的 JSON 格式
 */
function jobToJSON(job) {
  if (!job) {
    return {
      title: '通用職缺',
      requiredSkills: [],
      preferredSkills: [],
      yearsRequired: 0,
      company: {
        name: '目標公司',
        industry: '軟體科技',
        size: '100-500人'
      }
    };
  }

  return {
    title: job.title || '未知職缺',
    requiredSkills: job.requiredSkills || [],
    preferredSkills: job.preferredSkills || [],
    yearsRequired: job.yearsRequired || 0,
    educationRequired: job.educationRequired || '',
    company: {
      name: job.company?.name || '目標公司',
      industry: job.company?.industry || '軟體科技',
      size: job.company?.size || '100-500人',
      stage: job.company?.stage || '',
      culture: job.company?.culture || ''
    }
  };
}

/**
 * 生成匿名履歷（Markdown）
 */
export async function generateAnonymousResume(candidate, job = null, consultant = 'Jacky') {
  try {
    // 1. 準備 JSON 資料
    const candidateJSON = candidateToJSON(candidate, consultant);
    const jobJSON = jobToJSON(job);

    // 2. 寫入臨時檔案
    const tempDir = '/tmp/step1ne-resume';
    await fs.mkdir(tempDir, { recursive: true });

    const candidateFile = path.join(tempDir, `candidate-${candidate.id}.json`);
    const jobFile = path.join(tempDir, `job-${job?.id || 'default'}.json`);

    await fs.writeFile(candidateFile, JSON.stringify(candidateJSON, null, 2));
    await fs.writeFile(jobFile, JSON.stringify(jobJSON, null, 2));

    // 3. 呼叫 Python 腳本
    const command = `python3 "${SCRIPT_PATH}" "${candidateFile}" "${jobFile}" "${consultant}"`;
    console.log('🔄 執行匿名履歷生成:', command);

    // 設置工作目錄為 headhunter/（非 scripts/），這樣輸出檔案會在 headhunter/ 下
    const workDir = path.dirname(path.dirname(SCRIPT_PATH)); // headhunter 目錄
    const { stdout, stderr } = await execPromise(command, {
      cwd: workDir
    });

    if (stderr && !stderr.includes('UserWarning')) {
      console.warn('⚠️ Python 警告:', stderr);
    }

    // 4. 讀取生成的 Markdown 檔案
    // anonymize-resume.py 會在工作目錄生成 anonymous-resume-N.md
    const { stdout: findOutput } = await execPromise(`ls -t anonymous-resume-*.md 2>/dev/null | head -1`, {
      cwd: workDir
    });
    const outputFile = findOutput.trim() ? path.join(workDir, findOutput.trim()) : null;

    if (!outputFile) {
      throw new Error('找不到生成的匿名履歷檔案');
    }

    const markdown = await fs.readFile(outputFile, 'utf-8');

    // 5. 清理臨時檔案
    await fs.unlink(candidateFile).catch(() => {});
    await fs.unlink(jobFile).catch(() => {});

    console.log('✅ 匿名履歷生成成功:', outputFile);

    return {
      success: true,
      markdown,
      outputFile,
      candidateCode: extractCandidateCode(markdown),
      message: '匿名履歷生成成功'
    };

  } catch (error) {
    console.error('❌ 匿名履歷生成失敗:', error);
    throw error;
  }
}

/**
 * 從 Markdown 中提取候選人代號
 */
function extractCandidateCode(markdown) {
  const match = markdown.match(/# (.+?) 履歷/);
  return match ? match[1] : 'Unknown';
}

/**
 * 生成匿名履歷 PDF 所需的資料
 * 後端只負責產出 Markdown，PDF 由前端 utils/pdfGenerator.ts 的
 * generateAnonymousResumePDF(markdown, candidateCode) 完成輸出。
 */
export async function generateAnonymousResumePDF(candidate, job = null, consultant = 'Jacky') {
  const result = await generateAnonymousResume(candidate, job, consultant);

  return {
    ...result,
    renderTarget: 'client',
    clientRenderer: 'utils/pdfGenerator.ts#generateAnonymousResumePDF',
    suggestedFileName: `Step1ne_匿名履歷_${result.candidateCode}_${new Date().toISOString().split('T')[0]}.pdf`
  };
}
