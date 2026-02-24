// Google Sheets Service v2 - 使用 gog CLI（正確讀取履歷池v2）
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

const SHEET_ID = '1PunpaDAFBPBL_I76AiRYGXKaXDZvMl1c262SEtxRk6Q';
const ACCOUNT = 'aijessie88@step1ne.com';
const SHEET_NAME = '履歷池v2';

/**
 * 執行 gog sheets 指令（使用 JSON 輸出）
 */
async function runGogSheets(range) {
  try {
    const command = `gog sheets get "${SHEET_ID}" "${SHEET_NAME}!${range}" --account "${ACCOUNT}" --json`;
    const { stdout, stderr } = await execPromise(command);
    
    if (stderr && !stderr.includes('INFO')) {
      console.error('gog sheets 錯誤:', stderr);
    }
    
    return JSON.parse(stdout.trim());
  } catch (error) {
    console.error('gog sheets 執行失敗:', error);
    throw error;
  }
}

/**
 * 解析 gog sheets 輸出（JSON 格式）
 */
function parseGogOutput(jsonData) {
  if (!jsonData.values || jsonData.values.length === 0) {
    return [];
  }
  
  // jsonData.values 是二維陣列，每個內層陣列代表一行
  const rows = jsonData.values;
  
  return rows.map((fields, index) => {
    
    // 20 個欄位（履歷池v2 標準格式）
    const [
      name,              // 1. 姓名
      email,             // 2. Email
      phone,             // 3. 電話
      location,          // 4. 地點
      currentPosition,   // 5. 目前職位
      totalYears,        // 6. 總年資(年)
      jobChanges,        // 7. 轉職次數
      avgTenure,         // 8. 平均任職(月)
      recentGap,         // 9. 最近gap(月)
      skills,            // 10. 技能
      education,         // 11. 學歷
      source,            // 12. 來源
      workHistory,       // 13. 工作經歷JSON
      leaveReason,       // 14. 離職原因
      stabilityScore,    // 15. 穩定性評分
      educationDetail,   // 16. 學歷JSON
      personality,       // 17. DISC/Big Five
      status,            // 18. 狀態
      consultant,        // 19. 獵頭顧問
      notes              // 20. 備註
    ] = fields;
    
    return {
      id: (index + 2).toString(), // 從第 2 行開始（第 1 行是標題）
      name: name || '',
      email: email || '',
      phone: phone || '',
      currentJobTitle: currentPosition || '',
      workExperience: totalYears ? `${totalYears}年` : '',
      skills: skills ? skills.split('、').map(s => s.trim()) : [],
      currentCompany: '',  // 從工作經歷提取
      desiredSalary: '',   // 從備註提取
      status: status || '待聯繫',
      grade: '',           // 需要 AI 評級
      consultant: consultant || '',
      source: source || '',
      notes: notes || '',
      location: location || '',
      education: education || '',
      stability: stabilityScore || '',
      // 原始資料（供詳細頁面使用）
      _raw: {
        totalYears,
        jobChanges,
        avgTenure,
        recentGap,
        workHistory,
        leaveReason,
        stabilityScore,
        educationDetail,
        personality
      }
    };
  });
}

/**
 * 取得所有候選人
 */
export async function getCandidates() {
  try {
    // 讀取所有資料（A2:T1000，跳過標題行，最多 998 位候選人）
    const output = await runGogSheets('A2:T1000');
    const candidates = parseGogOutput(output);
    
    console.log(`✅ 成功載入 ${candidates.length} 位候選人（來自履歷池v2）`);
    return candidates;
  } catch (error) {
    console.error('讀取候選人失敗:', error);
    return [];
  }
}

/**
 * 取得單一候選人（使用簡單的線性搜尋，因為 ID 就是行號）
 */
export async function getCandidateById(id) {
  try {
    const row = parseInt(id);
    if (isNaN(row) || row < 2) {
      throw new Error('Invalid candidate ID');
    }
    
    // 讀取單一行（A{row}:T{row}）
    const output = await runGogSheets(`A${row}:T${row}`);
    const candidates = parseGogOutput(output);
    
    if (candidates.length === 0) {
      console.log(`❌ 第 ${row} 行無資料`);
      return null;
    }
    
    // 確保 ID 設定正確
    candidates[0].id = String(row);
    return candidates[0];
  } catch (error) {
    console.error(`讀取候選人 ${id} 失敗:`, error);
    return null;
  }
}


/**
 * 測試連線
 */
export async function testConnection() {
  try {
    const output = await runGogSheets('A1:A1');
    return output.values && output.values[0] && output.values[0][0] === '姓名';
  } catch (error) {
    console.error('測試連線失敗:', error);
    return false;
  }
}

// 測試（開發環境）
if (process.env.NODE_ENV === 'development') {
  testConnection().then(result => {
    if (result) {
      console.log('✅ sheetsService v2 連線成功');
    } else {
      console.error('❌ sheetsService v2 連線失敗');
    }
  });
}

// ========================================
// 候選人 CRUD 操作（完整實作）
// ========================================

/**
 * 新增候選人
 */
export async function addCandidate(candidateData) {
  try {
    // 準備資料（20 個欄位，用 | 分隔）
    const fields = [
      candidateData.name || '',
      candidateData.email || '',
      candidateData.phone || '',
      candidateData.location || '',
      candidateData.currentPosition || candidateData.currentJobTitle || '',
      candidateData.totalYears || '0',
      candidateData.jobChanges || '0',
      candidateData.avgTenure || '12',
      candidateData.recentGap || '0',
      Array.isArray(candidateData.skills) ? candidateData.skills.join('、') : (candidateData.skills || ''),
      candidateData.education || '',
      candidateData.source || 'Web',
      candidateData.workHistory || '',
      candidateData.leaveReason || '',
      candidateData.stabilityScore || '75',
      candidateData.educationDetail || candidateData.education || '',
      candidateData.personality || '',
      candidateData.status || '新進',
      candidateData.consultant || 'Jacky',
      candidateData.notes || ''
    ];
    
    const data = fields.join('|');
    const command = `gog sheets append "${SHEET_ID}" "履歷池v2!A:T" "${data}" --account "${ACCOUNT}"`;
    
    console.log('📝 新增候選人:', candidateData.name);
    const { stdout, stderr } = await execPromise(command);
    
    if (stderr && !stderr.includes('INFO')) {
      console.warn('⚠️ gog sheets 警告:', stderr);
    }
    
    console.log('✅ 候選人新增成功:', stdout);
    
    return {
      success: true,
      message: '候選人新增成功',
      candidateId: `${Date.now()}`,
      data: candidateData
    };
    
  } catch (error) {
    console.error('❌ 新增候選人失敗:', error);
    throw error;
  }
}

/**
 * 更新候選人資料
 */
export async function updateCandidate(candidateId, updates) {
  try {
    const row = parseInt(candidateId);
    if (isNaN(row) || row < 2) {
      throw new Error('Invalid candidate ID');
    }
    
    console.log(`📝 更新候選人 ID ${candidateId}（第 ${row} 行）`);
    
    // 讀取現有資料
    const range = `A${row}:T${row}`;
    const output = await runGogSheets(range);
    
    if (!output.values || output.values.length === 0) {
      throw new Error(`找不到候選人 ${candidateId}`);
    }
    
    const currentFields = output.values[0];
    
    // 準備更新後的資料（合併現有資料與更新）
    const fields = [
      updates.name !== undefined ? updates.name : currentFields[0] || '',
      updates.email !== undefined ? updates.email : currentFields[1] || '',
      updates.phone !== undefined ? updates.phone : currentFields[2] || '',
      updates.location !== undefined ? updates.location : currentFields[3] || '',
      updates.currentPosition !== undefined ? updates.currentPosition : currentFields[4] || '',
      updates.totalYears !== undefined ? String(updates.totalYears) : currentFields[5] || '0',
      updates.jobChanges !== undefined ? String(updates.jobChanges) : currentFields[6] || '0',
      updates.avgTenure !== undefined ? String(updates.avgTenure) : currentFields[7] || '12',
      updates.recentGap !== undefined ? String(updates.recentGap) : currentFields[8] || '0',
      updates.skills !== undefined 
        ? (Array.isArray(updates.skills) ? updates.skills.join('、') : updates.skills)
        : currentFields[9] || '',
      updates.education !== undefined ? updates.education : currentFields[10] || '',
      currentFields[11] || 'Web', // source 不更新
      updates.workHistory !== undefined ? updates.workHistory : currentFields[12] || '',
      updates.leaveReason !== undefined ? updates.leaveReason : currentFields[13] || '',
      updates.stabilityScore !== undefined ? String(updates.stabilityScore) : currentFields[14] || '75',
      updates.educationDetail !== undefined ? updates.educationDetail : currentFields[15] || '',
      updates.personality !== undefined ? updates.personality : currentFields[16] || '',
      updates.status !== undefined ? updates.status : currentFields[17] || '新進',
      currentFields[18] || 'Jacky', // consultant 不更新
      updates.notes !== undefined ? updates.notes : currentFields[19] || ''
    ];
    
    // 使用 gog sheets update
    const data = fields.join('|');
    const command = `gog sheets update "${SHEET_ID}" "履歷池v2!A${row}" "${data}" --account "${ACCOUNT}"`;
    
    const { stdout, stderr } = await execPromise(command);
    
    if (stderr && !stderr.includes('INFO')) {
      console.warn('⚠️ gog sheets 警告:', stderr);
    }
    
    console.log('✅ 候選人更新成功');
    
    return {
      success: true,
      message: '候選人更新成功',
      candidateId,
      updatedFields: Object.keys(updates)
    };
    
  } catch (error) {
    console.error('❌ 更新候選人失敗:', error);
    throw error;
  }
}

/**
 * 刪除候選人（清空整行）
 */
export async function deleteCandidate(candidateId) {
  try {
    const row = parseInt(candidateId);
    if (isNaN(row) || row < 2) {
      throw new Error('Invalid candidate ID');
    }
    
    const range = `A${row}:T${row}`;
    
    console.log(`🗑️  刪除候選人 ID ${candidateId}（第 ${row} 行）`);
    
    // 清空整行
    const command = `gog sheets update "${SHEET_ID}" "履歷池v2!${range}" "" --account "${ACCOUNT}"`;
    await execPromise(command);
    
    console.log('✅ 候選人刪除成功');
    
    return {
      success: true,
      message: '候選人刪除成功',
      candidateId
    };
    
  } catch (error) {
    console.error('❌ 刪除候選人失敗:', error);
    throw error;
  }
}

// ========================================
// 向後相容的 wrapper 函數
// ========================================

/**
 * 更新候選人狀態（向後相容）
 */
export async function updateCandidateStatus(candidateId, newStatus) {
  return await updateCandidate(candidateId, { status: newStatus });
}

/**
 * 批量更新狀態（向後相容）
 */
export async function batchUpdateStatus(updates) {
  try {
    const results = [];
    for (const update of updates) {
      try {
        const result = await updateCandidate(update.id, { status: update.status });
        results.push(result);
      } catch (error) {
        results.push({ success: false, candidateId: update.id, error: error.message });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    
    return {
      success: true,
      total: updates.length,
      updated: successCount,
      failed: updates.length - successCount,
      results
    };
  } catch (error) {
    console.error('批量更新失敗:', error);
    throw error;
  }
}
