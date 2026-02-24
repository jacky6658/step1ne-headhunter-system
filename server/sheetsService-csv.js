// Sheets Service CSV - 使用公開 CSV export（Zeabur 相容）
import https from 'https';

const SHEET_ID = '1PunpaDAFBPBL_I76AiRYGXKaXDZvMl1c262SEtxRk6Q';
const CANDIDATES_TAB_GID = '142613837'; // 履歷池v2

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
 * 簡單 CSV 解析（處理引號和逗號）
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current);
  return result;
}

/**
 * 解析 CSV 為候選人陣列
 */
function parseCSV(csvText) {
  const lines = csvText.split('\n').filter(line => line.trim());
  const rows = lines.slice(1); // 跳過標題行
  
  return rows.map((line, index) => {
    const fields = parseCSVLine(line);
    
    // 21 個欄位（履歷池v2 標準格式 + 履歷連結）
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
      workHistory,       // 13. 工作經歷
      leaveReason,       // 14. 離職原因
      stabilityScore,    // 15. 穩定性評分
      educationDetail,   // 16. 學歷JSON
      personality,       // 17. DISC/Big Five
      status,            // 18. 狀態
      consultant,        // 19. 獵頭顧問
      notes,             // 20. 備註
      resumeLink         // 21. 履歷連結（U欄）
    ] = fields;
    
    // 過濾空行
    if (!name || !name.trim()) return null;
    
    return {
      id: String(index + 2), // 從第 2 行開始（第 1 行是標題）
      name: name || '',
      email: email || '',
      phone: phone || '',
      currentJobTitle: currentPosition || '',
      workExperience: totalYears ? `${totalYears}年` : '',
      skills: skills ? skills.split(/[、,，]/).map(s => s.trim()).filter(s => s) : [],
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
      stabilityScore: parseInt(stabilityScore) || 0,  // 前端需要的數字欄位
      resumeLink: resumeLink || '',  // 履歷連結（U欄）
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
  }).filter(c => c !== null);
}

/**
 * 取得所有候選人
 */
export async function getCandidates() {
  try {
    const csvText = await fetchSheetAsCSV();
    const candidates = parseCSV(csvText);
    
    console.log(`✅ 成功載入 ${candidates.length} 位候選人（CSV export）`);
    return candidates;
  } catch (error) {
    console.error('❌ 讀取候選人失敗:', error);
    console.warn('⚠️ 使用降級方案：返回空陣列');
    return [];
  }
}

/**
 * 取得單一候選人
 */
export async function getCandidateById(id) {
  try {
    const candidates = await getCandidates();
    const candidate = candidates.find(c => c.id === id);
    
    if (!candidate) {
      console.log(`❌ 找不到候選人 ID: ${id}`);
      return null;
    }
    
    return candidate;
  } catch (error) {
    console.error(`讀取候選人 ${id} 失敗:`, error);
    return null;
  }
}

// 以下函數返回 "Not implemented"（需要認證的寫入操作）
export async function addCandidate() {
  return { success: false, message: 'CSV mode: write operations not supported' };
}

export async function updateCandidate() {
  return { success: false, message: 'CSV mode: write operations not supported' };
}

export async function deleteCandidate() {
  return { success: false, message: 'CSV mode: write operations not supported' };
}

export async function updateCandidateStatus() {
  return { success: false, message: 'CSV mode: write operations not supported' };
}

export async function batchUpdateStatus() {
  return { success: false, message: 'CSV mode: write operations not supported' };
}

export async function testConnection() {
  try {
    const candidates = await getCandidates();
    return candidates.length > 0;
  } catch (error) {
    return false;
  }
}
