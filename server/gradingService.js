// Talent Grading Service - 呼叫 grading-logic.py 進行評級
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// grading-logic.py 的路徑
const GRADING_SCRIPT_PATH = path.join(
  __dirname,
  '../../step1ne-headhunter-skill/modules/talent-grading/grading-logic.py'
);

const SHEET_ID = process.env.SHEET_ID || '1PunpaDAFBPBL_I76AiRYGXKaXDZvMl1c262SEtxRk6Q';
const GOOGLE_ACCOUNT = process.env.GOOGLE_ACCOUNT || 'aijessie88@step1ne.com';

/**
 * 準備候選人資料（轉換為 grading-logic.py 所需格式）
 */
function prepareCandidateData(candidate) {
  return {
    name: candidate.name || '',
    email: candidate.email || '',
    phone: candidate.phone || '',
    position: candidate.position || '',
    
    education: candidate.education || [],
    work_history: candidate.workHistory || [],
    
    total_years: parseFloat(candidate.years) || 0,
    job_changes: parseInt(candidate.jobChanges) || 0,
    skills: candidate.skills || '',
    stability: parseInt(candidate.stabilityScore) || 50,
    
    github_url: candidate.githubUrl || '',
    linkedin_url: candidate.linkedinUrl || '',
    languages: candidate.languages || []
  };
}

/**
 * 呼叫 grading-logic.py 進行評級
 */
export async function gradeCandidate(candidate) {
  try {
    // 準備資料
    const candidateData = prepareCandidateData(candidate);
    
    // 建立臨時 JSON 檔案
    const tempDir = path.join(__dirname, 'temp');
    await fs.mkdir(tempDir, { recursive: true });
    
    const tempInputFile = path.join(tempDir, `candidate-${Date.now()}.json`);
    const tempOutputFile = path.join(tempDir, `result-${Date.now()}.json`);
    
    await fs.writeFile(
      tempInputFile,
      JSON.stringify(candidateData, null, 2),
      'utf-8'
    );
    
    // 呼叫 Python 腳本
    const command = `python3 "${GRADING_SCRIPT_PATH}" --resume "${tempInputFile}" --output "${tempOutputFile}"`;
    
    console.log(`執行評級: ${command}`);
    const { stdout, stderr } = await execAsync(command);
    
    if (stderr && !stderr.includes('warning')) {
      console.error('grading-logic.py stderr:', stderr);
    }
    
    // 讀取結果
    const resultJSON = await fs.readFile(tempOutputFile, 'utf-8');
    const result = JSON.parse(resultJSON);
    
    // 清理臨時檔案
    await fs.unlink(tempInputFile).catch(() => {});
    await fs.unlink(tempOutputFile).catch(() => {});
    
    return {
      success: true,
      grade: result.grade,
      total_score: result.total_score,
      dimension_scores: result.dimension_scores,
      breakdown: result.breakdown,
      timestamp: result.timestamp
    };
    
  } catch (error) {
    console.error('評級失敗:', error);
    throw new Error(`評級失敗: ${error.message}`);
  }
}

/**
 * 將評級結果寫入 Google Sheets Column U
 */
export async function saveGradeToSheet(candidateRow, grade) {
  try {
    // Column U 是第 21 欄（A=1, B=2, ..., U=21）
    const columnU = 'U';
    const range = `履歷池v2!${columnU}${candidateRow}`;
    
    // 使用 gog CLI 更新 Google Sheets
    const command = `gog sheets update "${SHEET_ID}" --range "${range}" --values "${grade}" --account "${GOOGLE_ACCOUNT}"`;
    
    console.log(`更新 Google Sheets: ${command}`);
    const { stdout, stderr } = await execAsync(command);
    
    if (stderr) {
      console.error('gog stderr:', stderr);
    }
    
    console.log('Google Sheets 更新成功:', stdout);
    
    return {
      success: true,
      range,
      value: grade
    };
    
  } catch (error) {
    console.error('寫入 Google Sheets 失敗:', error);
    throw new Error(`寫入失敗: ${error.message}`);
  }
}

/**
 * 完整評級流程：評級 + 寫入 Sheet
 */
export async function gradeAndSave(candidate) {
  try {
    // 1. 評級
    const gradingResult = await gradeCandidate(candidate);
    
    // 2. 寫入 Google Sheets（如果有 _sheetRow）
    if (candidate._sheetRow) {
      await saveGradeToSheet(candidate._sheetRow, gradingResult.grade);
    }
    
    return {
      success: true,
      candidate: {
        id: candidate.id,
        name: candidate.name,
        position: candidate.position
      },
      grading: gradingResult,
      sheetUpdate: candidate._sheetRow ? {
        row: candidate._sheetRow,
        column: 'U',
        value: gradingResult.grade
      } : null
    };
    
  } catch (error) {
    console.error('gradeAndSave 失敗:', error);
    throw error;
  }
}
