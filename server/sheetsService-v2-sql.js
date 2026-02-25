/**
 * sheetsService-v2-sql.js - Google Sheets 服務層（整合 SQL）
 * 
 * 功能：
 * - 讀取 Google Sheets 資料
 * - 寫入 Google Sheets（用於報表層）
 * - 同步狀態變更
 */

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const SHEET_ID = process.env.SHEET_ID || '1PunpaDAFBPBL_I76AiRYGXKaXDZvMl1c262SEtxRk6Q';
const SHEET_NAME = 'candidates';

/**
 * 執行 gog 指令的輔助函數
 */
async function runGogCommand(args) {
  try {
    const { stdout, stderr } = await execPromise(`gog sheets ${args}`, {
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024
    });

    if (stderr && stderr.includes('error')) {
      throw new Error(stderr);
    }

    return stdout;
  } catch (error) {
    console.error(`❌ gog command error: ${error.message}`);
    throw error;
  }
}

/**
 * 讀取 Google Sheets 的所有候選人
 */
async function getAllCandidates() {
  try {
    console.log('📖 Reading all candidates from Google Sheets...');

    const output = await runGogCommand(
      `read "${SHEET_ID}" "${SHEET_NAME}" --json --range A2:T`
    );

    const rows = JSON.parse(output);
    const candidates = rows.map((row, index) => ({
      sheetsRowNum: index + 2, // A2 開始
      name: row[0],
      email: row[1],
      phone: row[2],
      location: row[3],
      currentTitle: row[4],
      yearsExperience: row[5],
      jobChanges: row[6],
      avgTenure: row[7],
      recentGap: row[8],
      skills: row[9],
      education: row[10],
      source: row[11],
      workHistory: row[12],
      resignReason: row[13],
      stabilityScore: row[14],
      educationJson: row[15],
      disc: row[16],
      status: row[17], // S 欄
      consultant: row[18], // T 欄
      remarks: row[19]
    }));

    console.log(`✅ Loaded ${candidates.length} candidates from Sheets`);
    return candidates;
  } catch (error) {
    console.error('❌ getAllCandidates error:', error.message);
    throw error;
  }
}

/**
 * 查找候選人在 Sheet 中的行號
 */
async function findCandidateRowNum(name) {
  try {
    const candidates = await getAllCandidates();
    const match = candidates.find(c => c.name === name);

    if (match) {
      console.log(`✅ Found ${name} at row ${match.sheetsRowNum}`);
      return match.sheetsRowNum;
    }

    console.warn(`⚠️ Candidate not found: ${name}`);
    return null;
  } catch (error) {
    console.error('❌ findCandidateRowNum error:', error.message);
    throw error;
  }
}

/**
 * 更新單個儲存格
 */
async function updateCell(rowNum, colLetter, value) {
  try {
    console.log(`📝 Updating cell ${colLetter}${rowNum}: ${value}`);

    // 清理特殊字符，防止 Shell 注入
    const cleanValue = String(value).replace(/"/g, '\\"').replace(/\$/g, '\\$');

    const cellRef = `${colLetter}${rowNum}`;
    const output = await runGogCommand(
      `update "${SHEET_ID}" "${cellRef}" "${cleanValue}"`
    );

    console.log(`✅ Cell updated: ${cellRef}`);
    return output;
  } catch (error) {
    console.error(`❌ updateCell error: ${error.message}`);
    throw error;
  }
}

/**
 * 新增候選人行（方案 A）
 */
async function appendCandidateRow(candidateData) {
  try {
    console.log(`📝 Appending candidate: ${candidateData.name}`);

    // 構建行數據（20 個欄位，用 | 分隔）
    const rowData = [
      candidateData.name || '',
      candidateData.email || '',
      candidateData.phone || '',
      candidateData.location || '',
      candidateData.currentTitle || '',
      candidateData.yearsExperience || '',
      candidateData.jobChanges || '',
      candidateData.avgTenure || '',
      candidateData.recentGap || '',
      candidateData.skills || '',
      candidateData.education || '',
      candidateData.source || '自動匯入',
      candidateData.workHistory || '',
      candidateData.resignReason || '',
      candidateData.stabilityScore || '',
      candidateData.educationJson || '',
      candidateData.disc || '',
      candidateData.status || '待聯繫',
      candidateData.consultant || '',
      candidateData.remarks || ''
    ].join('|');

    // 防止換行符號破壞資料
    const cleanData = rowData.replace(/\n/g, ' ').replace(/\r/g, ' ');

    const output = await runGogCommand(
      `append "${SHEET_ID}" "${SHEET_NAME}" "${cleanData}"`
    );

    console.log(`✅ Candidate appended: ${candidateData.name}`);
    return output;
  } catch (error) {
    console.error(`❌ appendCandidateRow error: ${error.message}`);
    throw error;
  }
}

/**
 * 更新候選人狀態（方案 A 核心）
 * 從 SQL 同步狀態回 Google Sheets
 */
async function updateCandidateStatus(name, newStatus) {
  try {
    console.log(`🔄 Updating candidate status in Sheets: ${name} → ${newStatus}`);

    // 找到行號
    const rowNum = await findCandidateRowNum(name);
    
    if (!rowNum) {
      throw new Error(`Candidate not found: ${name}`);
    }

    // 更新 Status 欄（S 欄，第 18 欄）
    const colLetter = 'S';
    await updateCell(rowNum, colLetter, newStatus);

    console.log(`✅ Status updated in Sheets: ${name} → ${newStatus}`);
    return rowNum;
  } catch (error) {
    console.error(`❌ updateCandidateStatus error: ${error.message}`);
    throw error;
  }
}

/**
 * 更新 AI 配對分數
 */
async function updateAIScores(name, scores) {
  try {
    console.log(`📊 Updating AI scores for: ${name}`);

    const rowNum = await findCandidateRowNum(name);
    if (!rowNum) return null;

    // 假設有個「AI 評分」欄或備註欄
    const scoresStr = JSON.stringify(scores);
    const cleanScores = scoresStr.replace(/"/g, '\\"');

    // 更新到備註欄（U 欄）
    await updateCell(rowNum, 'U', cleanScores);

    console.log(`✅ AI scores updated: ${name}`);
    return rowNum;
  } catch (error) {
    console.error(`❌ updateAIScores error: ${error.message}`);
    throw error;
  }
}

/**
 * 批量更新狀態（用於 Cron Job）
 */
async function batchUpdateStatus(updates) {
  try {
    console.log(`📝 Batch updating ${updates.length} records...`);

    const results = [];
    
    // 控制速率：每次更新間隔 2 秒
    for (const update of updates) {
      try {
        const result = await updateCandidateStatus(update.name, update.status);
        results.push({ name: update.name, success: true, rowNum: result });
      } catch (err) {
        results.push({ name: update.name, success: false, error: err.message });
      }

      // 延遲 2 秒，防止 API 限流
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log(`✅ Batch update completed: ${results.filter(r => r.success).length}/${updates.length}`);
    return results;
  } catch (error) {
    console.error(`❌ batchUpdateStatus error: ${error.message}`);
    throw error;
  }
}

module.exports = {
  getAllCandidates,
  findCandidateRowNum,
  updateCell,
  appendCandidateRow,
  updateCandidateStatus,
  updateAIScores,
  batchUpdateStatus
};
