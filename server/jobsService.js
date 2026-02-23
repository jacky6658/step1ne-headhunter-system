// Jobs Service - 職缺管理服務
import https from 'https';

const SHEET_ID = '1QPaeOm-slNVFCeM8Q3gg3DawKjzp2tYwyfquvdHlZFE'; // step1ne 職缺管理
const JOBS_TAB_GID = '0'; // 職缺管理 tab 的 GID（通常第一個 tab 是 0）

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
 * 解析 CSV 為職缺陣列
 */
function parseJobsCSV(csvText) {
  const lines = csvText.split('\n');
  const rows = lines.slice(1).filter(line => line.trim()); // 跳過標題行
  
  return rows.map((line, index) => {
    // 簡單 CSV 解析（處理逗號分隔）
    const fields = line.split(',').map(f => f.trim().replace(/^"(.*)"$/, '$1'));
    
    // 過濾空行（至少要有職位名稱）
    if (!fields[0]) return null;
    
    return {
      id: `job-${index + 1}`,
      title: fields[0] || '',           // A: 職位名稱
      department: fields[1] || '',      // B: 部門
      headcount: parseInt(fields[2]) || 1, // C: 需求人數
      salaryRange: fields[3] || '',     // D: 薪資範圍
      requiredSkills: fields[4] ? fields[4].split(/[,、]/).map(s => s.trim()).filter(s => s) : [], // E: 必備技能
      yearsRequired: parseInt(fields[5]) || 0, // F: 年資要求
      educationRequired: fields[6] || '', // G: 學歷要求
      status: fields[7] || '招募中',     // H: 狀態
      
      // 補充預設資訊
      preferredSkills: [],
      responsibilities: ['職缺職責詳見職缺說明'],
      benefits: ['彈性工時', '教育訓練'],
      
      // 公司資訊（暫時使用預設，未來可從職缺管理 Sheet 擴充欄位）
      company: {
        name: fields[8] || '創新科技股份有限公司', // I: 公司名稱（新增欄位）
        industry: fields[9] || '軟體科技',          // J: 產業（新增欄位）
        size: '100-500',
        stage: '成長期',
        culture: '自主型',
        techStack: fields[4] ? fields[4].split(/[,、]/).map(s => s.trim()).filter(s => s).slice(0, 3) : ['Python'],
        workLocation: fields[10] || '台北',         // K: 工作地點（新增欄位）
        remotePolicy: '混合辦公'
      }
    };
  }).filter(job => job !== null && job.status === '招募中'); // 只返回招募中的職缺
}

/**
 * 從 Google Sheets 讀取職缺列表
 */
export async function getJobs() {
  try {
    // 暫時使用測試資料（待 Google Sheets 整合完成後移除）
    const testJobs = [
      {
        id: 'job-1',
        title: 'AI 工程師',
        department: '技術部',
        headcount: 2,
        salaryRange: '80k-120k',
        requiredSkills: ['Python', 'Machine Learning', 'Deep Learning'],
        preferredSkills: ['PyTorch', 'TensorFlow', 'NLP'],
        yearsRequired: 3,
        educationRequired: '大學',
        status: '招募中',
        responsibilities: ['開發 AI 模型', '資料處理與分析', '模型部署與優化'],
        benefits: ['彈性工時', '遠端辦公', '教育訓練補助'],
        company: {
          name: '創新科技股份有限公司',
          industry: '軟體科技',
          size: '100-500',
          stage: '成長期',
          culture: '自主型',
          techStack: ['Python', 'PyTorch', 'AWS', 'Docker'],
          workLocation: '台北',
          remotePolicy: '混合辦公'
        }
      },
      {
        id: 'job-2',
        title: '全端工程師',
        department: '技術部',
        headcount: 3,
        salaryRange: '70k-110k',
        requiredSkills: ['JavaScript', 'React', 'Node.js'],
        preferredSkills: ['TypeScript', 'Vue', 'MongoDB'],
        yearsRequired: 3,
        educationRequired: '大學',
        status: '招募中',
        responsibilities: ['前後端開發', '系統架構設計', 'API 開發'],
        benefits: ['彈性工時', '遠端辦公'],
        company: {
          name: '新創科技有限公司',
          industry: '軟體科技',
          size: '50-100',
          stage: '新創',
          culture: '創業型',
          techStack: ['React', 'Node.js', 'PostgreSQL'],
          workLocation: '台北',
          remotePolicy: '完全遠端'
        }
      },
      {
        id: 'job-3',
        title: 'BIM 工程師',
        department: '技術部',
        headcount: 1,
        salaryRange: '60k-90k',
        requiredSkills: ['BIM', 'Revit', 'AutoCAD'],
        preferredSkills: ['Navisworks', '數位孿生'],
        yearsRequired: 3,
        educationRequired: '大學',
        status: '招募中',
        responsibilities: ['BIM建模', '協調整合', '專案管理'],
        benefits: ['彈性工時', '教育訓練'],
        company: {
          name: '建築科技股份有限公司',
          industry: '建築科技',
          size: '100-500',
          stage: '成長期',
          culture: '自主型',
          techStack: ['Revit', 'AutoCAD', 'BIM 360'],
          workLocation: '台北',
          remotePolicy: '混合辦公'
        }
      },
      {
        id: 'job-4',
        title: '資安工程師',
        department: '資訊安全部',
        headcount: 1,
        salaryRange: '90k-140k',
        requiredSkills: ['Security', 'Penetration Testing', 'SIEM'],
        preferredSkills: ['CEH', 'CISSP', 'Cloud Security'],
        yearsRequired: 5,
        educationRequired: '大學',
        status: '招募中',
        responsibilities: ['資安監控', '滲透測試', '事件應變'],
        benefits: ['彈性工時', '證照獎金', '教育訓練'],
        company: {
          name: '遊戲橘子數位科技',
          industry: '遊戲/數位科技',
          size: '500+',
          stage: '穩定企業',
          culture: 'SOP型',
          techStack: ['SIEM', 'Firewall', 'AWS'],
          workLocation: '台北',
          remotePolicy: '辦公室為主'
        }
      },
      {
        id: 'job-5',
        title: '數據分析師',
        department: '數據部',
        headcount: 1,
        salaryRange: '60k-90k',
        requiredSkills: ['Python', 'SQL', 'Data Analysis'],
        preferredSkills: ['Tableau', 'Power BI', 'R'],
        yearsRequired: 2,
        educationRequired: '大學',
        status: '招募中',
        responsibilities: ['數據分析', '報表製作', '數據視覺化'],
        benefits: ['彈性工時', '遠端辦公'],
        company: {
          name: '創新科技股份有限公司',
          industry: '軟體科技',
          size: '100-500',
          stage: '成長期',
          culture: '自主型',
          techStack: ['Python', 'SQL', 'Tableau'],
          workLocation: '台北',
          remotePolicy: '混合辦公'
        }
      }
    ];
    
    console.log(`✓ 載入 ${testJobs.length} 個測試職缺（TODO: 整合 Google Sheets）`);
    
    return testJobs;
    
    // TODO: 整合 Google Sheets
    // const csvText = await fetchJobsAsCSV();
    // const jobs = parseJobsCSV(csvText);
    // console.log(`✓ 成功載入 ${jobs.length} 個招募中的職缺`);
    // return jobs;
    
  } catch (error) {
    console.error('讀取職缺列表失敗:', error);
    throw new Error(`讀取職缺失敗: ${error.message}`);
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
