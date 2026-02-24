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
 * 新增候選人（寫入到下一個空行）
 */
export async function addCandidate(candidateData) {
  try {
    // 簡單實作：找到下一個空行並寫入
    // 實際應該呼叫 gog sheets append
    console.log('addCandidate: 簽章已實作（需要完整 gog sheets append）');
    return { success: false, message: 'Not implemented' };
  } catch (error) {
    console.error('新增候選人失敗:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 更新候選人狀態
 */
export async function updateCandidateStatus(candidateId, newStatus) {
  try {
    const row = parseInt(candidateId);
    if (isNaN(row) || row < 2) {
      throw new Error('Invalid candidate ID');
    }
    
    // 狀態在第 18 列（R 欄）
    // 簡單實作：記錄操作
    console.log(`updateCandidateStatus: 第 ${row} 行狀態更新為 "${newStatus}"（需要完整 gog sheets update）`);
    return { success: false, message: 'Not implemented' };
  } catch (error) {
    console.error('更新候選人狀態失敗:', error);
    return { success: false, error: error.message };
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
    
    console.log(`deleteCandidate: 第 ${row} 行刪除（需要完整 gog sheets clear）`);
    return { success: false, message: 'Not implemented' };
  } catch (error) {
    console.error('刪除候選人失敗:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 批量更新狀態
 */
export async function batchUpdateStatus(updates) {
  try {
    // updates 格式：[{ id: '2', status: '面試中' }, ...]
    console.log(`batchUpdateStatus: ${updates.length} 位候選人狀態更新（需要完整 gog sheets batch update）`);
    return { success: false, total: updates.length, message: 'Not implemented' };
  } catch (error) {
    console.error('批量更新失敗:', error);
    return { success: false, error: error.message };
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
