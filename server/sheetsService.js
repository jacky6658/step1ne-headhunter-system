// Google Sheets Service - 使用 googleapis 直接連接
import { google } from 'googleapis';

const SHEET_ID = process.env.SHEET_ID || '1PunpaDAFBPBL_I76AiRYGXKaXDZvMl1c262SEtxRk6Q';
const API_KEY = process.env.GOOGLE_API_KEY;
const CANDIDATES_TAB = '履歷池v2';

// 初始化 Google Sheets API
const sheets = google.sheets('v4');

/**
 * 取得所有候選人資料
 */
export async function getCandidates() {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${CANDIDATES_TAB}!A2:T`, // 從第2行開始（跳過標題）
      key: API_KEY,
    });
    
    const rows = response.data.values || [];
    
    return rows.map((row, index) => {
      const safeParseJSON = (jsonString, defaultValue = []) => {
        try {
          return jsonString && jsonString.trim() ? JSON.parse(jsonString) : defaultValue;
        } catch {
          return defaultValue;
        }
      };
      
      return {
        id: `candidate-${index + 2}`, // +2 因為第 1 行是標題
        _sheetRow: index + 2,
        
        // A-L: 基本資訊
        name: row[0] || '',
        email: row[1] || '',
        phone: row[2] || '',
        location: row[3] || '',
        position: row[4] || '',
        years: parseFloat(row[5]) || 0,
        jobChanges: parseInt(row[6]) || 0,
        stabilityScore: parseInt(row[7]) || 0,
        skills: row[8] || '',
        status: row[9] || 'pending',
        source: row[10] || 'manual',
        consultant: row[11] || '',
        
        // M-P: JSON 欄位
        workHistory: safeParseJSON(row[12]),
        education: safeParseJSON(row[15]),
        
        // Q-T: 其他資訊
        resumeUrl: row[16] || '',
        notes: row[17] || '',
        createdAt: row[18] || new Date().toISOString(),
        updatedAt: row[19] || new Date().toISOString(),
      };
    });
  } catch (error) {
    console.error('讀取 Google Sheets 失敗:', error.message);
    throw new Error(`無法讀取候選人資料: ${error.message}`);
  }
}

/**
 * 取得單一候選人
 */
export async function getCandidate(candidateId) {
  const candidates = await getCandidates();
  return candidates.find(c => c.id === candidateId);
}

/**
 * 更新候選人狀態
 */
export async function updateCandidateStatus(candidateId, newStatus) {
  try {
    // 取得所有候選人，找到對應的行號
    const candidates = await getCandidates();
    const candidate = candidates.find(c => c.id === candidateId);
    
    if (!candidate) {
      throw new Error('找不到候選人');
    }
    
    const rowNumber = candidate._sheetRow;
    
    // 更新狀態欄位 (J欄) 和更新時間 (T欄)
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SHEET_ID,
      key: API_KEY,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: [
          {
            range: `${CANDIDATES_TAB}!J${rowNumber}`,
            values: [[newStatus]],
          },
          {
            range: `${CANDIDATES_TAB}!T${rowNumber}`,
            values: [[new Date().toISOString()]],
          },
        ],
      },
    });
    
    return { success: true, candidateId, newStatus };
  } catch (error) {
    console.error('更新候選人狀態失敗:', error.message);
    throw new Error(`無法更新候選人狀態: ${error.message}`);
  }
}

/**
 * 新增候選人
 */
export async function addCandidate(candidateData) {
  try {
    const now = new Date().toISOString();
    
    const row = [
      candidateData.name || '',
      candidateData.email || '',
      candidateData.phone || '',
      candidateData.location || '',
      candidateData.position || '',
      candidateData.years || 0,
      candidateData.jobChanges || 0,
      candidateData.stabilityScore || 0,
      candidateData.skills || '',
      candidateData.status || 'pending',
      candidateData.source || 'manual',
      candidateData.consultant || '',
      JSON.stringify(candidateData.workHistory || []),
      '', // N: 保留
      '', // O: 保留
      JSON.stringify(candidateData.education || []),
      candidateData.resumeUrl || '',
      candidateData.notes || '',
      now, // createdAt
      now, // updatedAt
    ];
    
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${CANDIDATES_TAB}!A:T`,
      valueInputOption: 'USER_ENTERED',
      key: API_KEY,
      requestBody: {
        values: [row],
      },
    });
    
    return { success: true, message: '候選人新增成功' };
  } catch (error) {
    console.error('新增候選人失敗:', error.message);
    throw new Error(`無法新增候選人: ${error.message}`);
  }
}

/**
 * 刪除候選人（軟刪除：更新狀態為 'deleted'）
 */
export async function deleteCandidate(candidateId) {
  try {
    await updateCandidateStatus(candidateId, 'deleted');
    return { success: true, candidateId };
  } catch (error) {
    console.error('刪除候選人失敗:', error.message);
    throw new Error(`無法刪除候選人: ${error.message}`);
  }
}

/**
 * 批量更新候選人狀態
 */
export async function batchUpdateStatus(updates) {
  try {
    const results = [];
    
    for (const update of updates) {
      const result = await updateCandidateStatus(update.candidateId, update.newStatus);
      results.push(result);
    }
    
    return { success: true, results };
  } catch (error) {
    console.error('批量更新失敗:', error.message);
    throw new Error(`批量更新失敗: ${error.message}`);
  }
}
