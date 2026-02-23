// Jobs Service - 職缺管理服務（整合雲端 Google Sheets）
import https from 'https';

const SHEET_ID = '1QPaeOm-slNVFCeM8Q3gg3DawKjzp2tYwyfquvdHlZFE'; // step1ne 職缺管理
const JOBS_TAB_GID = '0'; // 第一個 tab

/**
 * 從 Google Sheets 匯出職缺管理 CSV
 */
async function fetchJobsAsCSV() {
  return new Promise((resolve, reject) => {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${JOBS_TAB_GID}`;
    
    https.get(url, (res) => {
      // 處理重定向
      if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) {
        const redirectUrl = res.headers.location;
        https.get(redirectUrl, (redirectRes) => {
          if (redirectRes.statusCode !== 200) {
            reject(new Error(`HTTP ${redirectRes.statusCode}: 無法存取職缺管理 Sheet`));
            return;
          }
          
          let data = '';
          redirectRes.on('data', chunk => data += chunk);
          redirectRes.on('end', () => resolve(data));
        }).on('error', reject);
        return;
      }
      
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}: 無法存取職缺管理 Sheet`));
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
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

/**
 * 根據公司名稱推測公司畫像
 */
function inferCompanyPersona(companyName, industry) {
  // 預設公司畫像
  const defaultPersona = {
    name: companyName || '未指定公司',
    industry: industry || '一般產業',
    size: '100-500',
    stage: '成長期',
    culture: '自主型',
    techStack: [],
    workLocation: '台北',
    remotePolicy: '混合辦公'
  };
  
  // 根據公司名稱特徵推測
  const name = companyName.toLowerCase();
  
  // 遊戲/數位娛樂公司
  if (name.includes('遊戲') || name.includes('橘子') || name.includes('gamania')) {
    return {
      ...defaultPersona,
      industry: '遊戲/數位娛樂',
      size: '500+',
      stage: '穩定企業',
      culture: 'SOP型',
      remotePolicy: '辦公室為主'
    };
  }
  
  // 新創公司
  if (name.includes('新創') || name.includes('startup') || name.includes('lab')) {
    return {
      ...defaultPersona,
      size: '10-50',
      stage: '新創',
      culture: '創業型',
      remotePolicy: '彈性遠端'
    };
  }
  
  // 科技公司
  if (name.includes('科技') || name.includes('tech') || name.includes('ai') || name.includes('軟體')) {
    return {
      ...defaultPersona,
      industry: '軟體科技',
      stage: '成長期',
      culture: '自主型',
      remotePolicy: '混合辦公'
    };
  }
  
  // 建築相關
  if (name.includes('建築') || name.includes('營造') || name.includes('工程')) {
    return {
      ...defaultPersona,
      industry: '建築工程',
      culture: 'SOP型',
      remotePolicy: '辦公室為主'
    };
  }
  
  // 金融相關
  if (name.includes('金融') || name.includes('銀行') || name.includes('投資')) {
    return {
      ...defaultPersona,
      industry: '金融服務',
      size: '500+',
      stage: '穩定企業',
      culture: 'SOP型',
      remotePolicy: '辦公室為主'
    };
  }
  
  return defaultPersona;
}

/**
 * 解析 CSV 為職缺陣列（處理多行欄位）
 */
function parseJobsCSV(csvText) {
  // 先用正則表達式正確分割 CSV 行（處理引號內的換行）
  const rows = [];
  let currentRow = '';
  let inQuotes = false;
  
  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
      currentRow += char;
    } else if (char === '\n' && !inQuotes) {
      if (currentRow.trim()) {
        rows.push(currentRow);
      }
      currentRow = '';
    } else {
      currentRow += char;
    }
  }
  
  // 最後一行
  if (currentRow.trim()) {
    rows.push(currentRow);
  }
  
  if (rows.length < 2) {
    console.warn('職缺 Sheet 資料不足（少於 2 行）');
    return [];
  }
  
  // 跳過標題行
  const dataLines = rows.slice(1);
  
  return dataLines.map((line, index) => {
    const fields = parseCSVLine(line);
    
    // 過濾空行（至少要有職位名稱和客戶公司）
    if (!fields[0] || !fields[1]) return null;
    
    // 過濾掉非職位資料（以 • 或 - 開頭的列表項目）
    if (fields[0].trim().startsWith('•') || fields[0].trim().startsWith('-')) return null;
    
    // 解析主要技能
    const skillsStr = fields[5] || '';
    const requiredSkills = skillsStr
      .split(/[、,，]/)
      .map(s => s.trim())
      .filter(s => s);
    
    // 客戶公司
    const companyName = fields[1] || '未指定公司';
    const industry = fields[14] || ''; // 產業背景要求欄位
    
    // 推測公司畫像
    const company = inferCompanyPersona(companyName, industry);
    company.techStack = requiredSkills.slice(0, 3); // 使用前 3 個技能作為 techStack
    
    return {
      id: `job-${index + 1}`,
      
      // 基本資訊
      title: fields[0] || '',              // A: 職位名稱
      department: fields[2] || '',         // C: 部門
      headcount: parseInt(fields[3]) || 1, // D: 需求人數
      salaryRange: fields[4] || '',        // E: 薪資範圍
      
      // 技能與要求
      requiredSkills: requiredSkills,      // F: 主要技能
      preferredSkills: [],                 // 目前沒有對應欄位，留空
      yearsRequired: parseYearsRequired(fields[6]), // G: 經驗要求
      educationRequired: fields[7] || '',  // H: 學歷要求
      
      // 工作地點與狀態
      workLocation: fields[8] || '台北',   // I: 工作地點
      status: fields[9] || '開放中',       // J: 職位狀態
      
      // 日期資訊
      createdDate: fields[10] || '',       // K: 建立日期
      lastUpdated: fields[11] || '',       // L: 最後更新
      
      // 額外資訊
      languageRequirement: fields[12] || '', // M: 語言要求
      specialConditions: fields[13] || '',   // N: 特殊條件
      industryBackground: fields[14] || '',  // O: 產業背景要求
      teamSize: fields[15] || '',            // P: 團隊規模
      keyChallenge: fields[16] || '',        // Q: 關鍵挑戰
      highlights: fields[17] || '',          // R: 吸引亮點
      recruitmentDifficulty: fields[18] || '', // S: 招募困難點
      interviewProcess: fields[19] || '',  // T: 面試流程
      consultantNotes: fields[20] || '',   // U: 顧問面談備註
      
      // 職缺描述（組合多個欄位）
      responsibilities: [
        fields[16] ? `關鍵挑戰：${fields[16]}` : null,
        fields[15] ? `團隊規模：${fields[15]}` : null
      ].filter(Boolean),
      
      benefits: [
        fields[17] ? fields[17] : null,
        company.remotePolicy ? company.remotePolicy : null
      ].filter(Boolean),
      
      // 公司畫像
      company: {
        ...company,
        workLocation: fields[8] || company.workLocation
      }
    };
  }).filter(job => {
    // 過濾條件
    if (!job) return false;
    
    // 只顯示「開放中」或「招募中」的職缺
    const validStatuses = ['開放中', '招募中', '急徵', 'open'];
    return validStatuses.some(s => job.status.toLowerCase().includes(s.toLowerCase()));
  });
}

/**
 * 解析經驗要求（轉換為數字）
 */
function parseYearsRequired(experienceStr) {
  if (!experienceStr) return 0;
  
  // 提取數字（例如「3年以上」→ 3）
  const match = experienceStr.match(/(\d+)/);
  return match ? parseInt(match[1]) : 0;
}

/**
 * 從 Google Sheets 讀取職缺列表
 */
export async function getJobs() {
  try {
    console.log('📊 從 Google Sheets 讀取職缺資料...');
    
    const csvText = await fetchJobsAsCSV();
    const jobs = parseJobsCSV(csvText);
    
    console.log(`✅ 成功載入 ${jobs.length} 個開放中的職缺`);
    
    // 顯示前 3 個職缺資訊（debug）
    if (jobs.length > 0) {
      console.log('前 3 個職缺：');
      jobs.slice(0, 3).forEach(job => {
        console.log(`  - ${job.title} (${job.company.name}) - ${job.status}`);
      });
    }
    
    return jobs;
    
  } catch (error) {
    console.error('❌ 讀取職缺列表失敗:', error);
    
    // 降級方案：返回空陣列而非拋出錯誤
    console.warn('⚠️ 使用降級方案：返回空職缺列表');
    return [];
  }
}

/**
 * 根據職缺 ID 取得單一職缺
 */
export async function getJob(jobId) {
  const jobs = await getJobs();
  const job = jobs.find(j => j.id === jobId);
  
  if (!job) {
    throw new Error(`找不到職缺: ${jobId}`);
  }
  
  return job;
}
