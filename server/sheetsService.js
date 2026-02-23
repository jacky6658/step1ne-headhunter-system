// Google Sheets Service - 使用 CSV 匯出直接讀取（公開 Sheet）
import https from 'https';

const SHEET_ID = process.env.SHEET_ID || '1PunpaDAFBPBL_I76AiRYGXKaXDZvMl1c262SEtxRk6Q';
const CANDIDATES_TAB_GID = process.env.TAB_GID || '142613837'; // 履歷池v2 的 GID

/**
 * 從 Google Sheets 匯出 CSV（處理重定向）
 */
async function fetchSheetAsCSV() {
  return new Promise((resolve, reject) => {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${CANDIDATES_TAB_GID}`;
    
    https.get(url, (res) => {
      // 處理重定向
      if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) {
        const redirectUrl = res.headers.location;
        https.get(redirectUrl, (redirectRes) => {
          if (redirectRes.statusCode !== 200) {
            reject(new Error(`HTTP ${redirectRes.statusCode}: 無法存取 Google Sheets`));
            return;
          }
          
          let data = '';
          redirectRes.on('data', chunk => data += chunk);
          redirectRes.on('end', () => resolve(data));
        }).on('error', reject);
        return;
      }
      
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}: 無法存取 Google Sheets`));
        return;
      }
      
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

/**
 * 解析 CSV 為候選人陣列
 */
function parseCSV(csvText) {
  const lines = csvText.split('\n');
  const rows = lines.slice(1).filter(line => line.trim()); // 跳過標題行
  
  return rows.map((line, index) => {
    // 簡單的 CSV 解析（處理引號內的逗號）
    const fields = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        fields.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    fields.push(current); // 最後一個欄位
    
    const safeParseJSON = (jsonString, defaultValue = []) => {
      try {
        return jsonString && jsonString.trim() ? JSON.parse(jsonString) : defaultValue;
      } catch {
        return defaultValue;
      }
    };
    
    return {
      id: `candidate-${index + 2}`,
      _sheetRow: index + 2,
      
      // 基本資訊（履歷池v2 實際欄位順序）
      name: fields[0] || '',               // 0: 姓名
      email: fields[1] || '',              // 1: Email
      phone: fields[2] || '',              // 2: 電話
      location: fields[3] || '',           // 3: 地點
      position: fields[4] || '',           // 4: 目前職位
      years: parseFloat(fields[5]) || 0,   // 5: 總年資(年)
      jobChanges: parseInt(fields[6]) || 0, // 6: 轉職次數
      stabilityScore: parseInt(fields[14]) || 0, // 14: 穩定性評分
      skills: fields[9] || '',             // 9: 技能
      status: fields[17] || 'pending',     // 17: 狀態
      source: fields[11] || 'manual',      // 11: 來源
      consultant: fields[18] || '',        // 18: 獵頭顧問
      talentGrade: fields[20] || '',       // 20: 綜合評級 (Column U, S/A+/A/B/C)
      
      // JSON 欄位
      workHistory: safeParseJSON(fields[12]), // 12: 工作經歷JSON
      education: safeParseJSON(fields[15]),   // 15: 學歷JSON
      
      // 其他資訊
      resumeUrl: '',                       // 履歷連結（未存在此sheet）
      notes: fields[19] || '',             // 19: 備註
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  });
}

/**
 * 取得所有候選人資料
 */
export async function getCandidates() {
  try {
    const csvData = await fetchSheetAsCSV();
    return parseCSV(csvData);
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
 * 更新候選人狀態（唯讀模式 - 返回錯誤）
 */
export async function updateCandidateStatus(candidateId, newStatus) {
  throw new Error('CSV 模式不支援寫入操作。請使用 Google Sheets 介面手動更新。');
}

/**
 * 新增候選人（唯讀模式 - 返回錯誤）
 */
export async function addCandidate(candidateData) {
  throw new Error('CSV 模式不支援寫入操作。請使用 Google Sheets 介面手動新增。');
}

/**
 * 刪除候選人（唯讀模式 - 返回錯誤）
 */
export async function deleteCandidate(candidateId) {
  throw new Error('CSV 模式不支援寫入操作。請使用 Google Sheets 介面手動刪除。');
}

/**
 * 批量更新候選人狀態（唯讀模式 - 返回錯誤）
 */
export async function batchUpdateStatus(updates) {
  throw new Error('CSV 模式不支援寫入操作。請使用 Google Sheets 介面手動更新。');
}
