// Google Sheets Service - 資料存取層

import { Candidate, WorkHistory, Education, CandidateSource, CandidateStatus } from '../types';
import { SHEETS_CONFIG, STORAGE_KEYS, CACHE_EXPIRY } from '../constants';

/**
 * 解析 Google Sheets 的一行資料為 Candidate 物件
 */
function parseCandidate(row: string, rowNumber: number): Candidate {
  const fields = row.split(/\s{2,}/); // 用 2+ 空格分隔（gog sheets 輸出格式）
  
  // 安全解析 JSON
  const safeParseJSON = (jsonString: string, defaultValue: any = []) => {
    try {
      return jsonString && jsonString.trim() ? JSON.parse(jsonString) : defaultValue;
    } catch {
      return defaultValue;
    }
  };
  
  return {
    id: `candidate-${rowNumber}`,
    _sheetRow: rowNumber,
    
    // A-L: 基本資訊
    name: fields[0] || '',
    email: fields[1] || '',
    phone: fields[2] || '',
    location: fields[3] || '',
    position: fields[4] || '',
    years: parseFloat(fields[5]) || 0,
    jobChanges: parseInt(fields[6]) || 0,
    avgTenure: parseFloat(fields[7]) || 0,
    lastGap: parseInt(fields[8]) || 0,
    skills: fields[9] || '',
    education: fields[10] || '',
    source: (fields[11] as CandidateSource) || CandidateSource.OTHER,
    
    // M-T: 進階資訊
    workHistory: safeParseJSON(fields[12], []),
    quitReasons: fields[13] || '',
    stabilityScore: parseInt(fields[14]) || 0,
    educationJson: safeParseJSON(fields[15], []),
    discProfile: fields[16] || '',
    status: (fields[17] as CandidateStatus) || CandidateStatus.TO_CONTACT,
    consultant: fields[18] || '',
    notes: fields[19] || '',
    
    // 系統欄位
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'system'
  };
}

/**
 * 將 Candidate 物件轉換為 Google Sheets 的一行資料
 */
function candidateToRow(candidate: Candidate): string[] {
  return [
    candidate.name,
    candidate.email,
    candidate.phone,
    candidate.location,
    candidate.position,
    candidate.years.toString(),
    candidate.jobChanges.toString(),
    candidate.avgTenure.toString(),
    candidate.lastGap.toString(),
    candidate.skills,
    candidate.education,
    candidate.source,
    JSON.stringify(candidate.workHistory || []),
    candidate.quitReasons || '',
    candidate.stabilityScore.toString(),
    JSON.stringify(candidate.educationJson || []),
    candidate.discProfile || '',
    candidate.status,
    candidate.consultant || '',
    candidate.notes || ''
  ];
}

/**
 * 從 Google Sheets 讀取所有候選人
 */
export async function getCandidates(): Promise<Candidate[]> {
  // 檢查快取
  const cached = localStorage.getItem(STORAGE_KEYS.CANDIDATES_CACHE);
  const lastSync = localStorage.getItem(STORAGE_KEYS.LAST_SYNC);
  
  if (cached && lastSync) {
    const cacheAge = Date.now() - parseInt(lastSync);
    if (cacheAge < CACHE_EXPIRY) {
      console.log('使用快取資料');
      return JSON.parse(cached);
    }
  }
  
  try {
    console.log('從 Google Sheets 讀取候選人...');
    
    // 使用 fetch 呼叫本地的 gog CLI（需要在 dev server 設定 proxy）
    // 或直接在前端執行（需要 OAuth）
    // 這裡假設有後端 API endpoint
    const response = await fetch(`/api/candidates`);
    
    if (!response.ok) {
      throw new Error('無法讀取候選人資料');
    }
    
    const data = await response.json();
    const candidates = data.candidates as Candidate[];
    
    // 更新快取
    localStorage.setItem(STORAGE_KEYS.CANDIDATES_CACHE, JSON.stringify(candidates));
    localStorage.setItem(STORAGE_KEYS.LAST_SYNC, Date.now().toString());
    
    return candidates;
  } catch (error) {
    console.error('讀取候選人失敗:', error);
    
    // 如果有快取，即使過期也返回
    if (cached) {
      console.warn('使用過期快取資料');
      return JSON.parse(cached);
    }
    
    // 返回空陣列
    return [];
  }
}

/**
 * 新增候選人
 */
export async function addCandidate(candidate: Candidate): Promise<Candidate> {
  try {
    const response = await fetch('/api/candidates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(candidate)
    });
    
    if (!response.ok) {
      throw new Error('新增候選人失敗');
    }
    
    const newCandidate = await response.json();
    
    // 清除快取
    localStorage.removeItem(STORAGE_KEYS.CANDIDATES_CACHE);
    
    return newCandidate;
  } catch (error) {
    console.error('新增候選人失敗:', error);
    throw error;
  }
}

/**
 * 更新候選人
 */
export async function updateCandidate(candidate: Candidate): Promise<Candidate> {
  try {
    const response = await fetch(`/api/candidates/${candidate.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(candidate)
    });
    
    if (!response.ok) {
      throw new Error('更新候選人失敗');
    }
    
    const updatedCandidate = await response.json();
    
    // 清除快取
    localStorage.removeItem(STORAGE_KEYS.CANDIDATES_CACHE);
    
    return updatedCandidate;
  } catch (error) {
    console.error('更新候選人失敗:', error);
    throw error;
  }
}

/**
 * 刪除候選人
 */
export async function deleteCandidate(id: string): Promise<void> {
  try {
    const response = await fetch(`/api/candidates/${id}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      throw new Error('刪除候選人失敗');
    }
    
    // 清除快取
    localStorage.removeItem(STORAGE_KEYS.CANDIDATES_CACHE);
  } catch (error) {
    console.error('刪除候選人失敗:', error);
    throw error;
  }
}

/**
 * 批量更新候選人狀態
 */
export async function batchUpdateCandidateStatus(
  candidateIds: string[],
  newStatus: CandidateStatus
): Promise<void> {
  try {
    const response = await fetch('/api/candidates/batch-update-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ candidateIds, newStatus })
    });
    
    if (!response.ok) {
      throw new Error('批量更新失敗');
    }
    
    // 清除快取
    localStorage.removeItem(STORAGE_KEYS.CANDIDATES_CACHE);
  } catch (error) {
    console.error('批量更新失敗:', error);
    throw error;
  }
}

/**
 * 搜尋候選人
 */
export async function searchCandidates(query: string): Promise<Candidate[]> {
  const allCandidates = await getCandidates();
  
  if (!query.trim()) {
    return allCandidates;
  }
  
  const lowerQuery = query.toLowerCase();
  
  return allCandidates.filter(c => 
    c.name.toLowerCase().includes(lowerQuery) ||
    c.email.toLowerCase().includes(lowerQuery) ||
    c.phone.includes(query) ||
    c.position.toLowerCase().includes(lowerQuery) ||
    c.skills.toLowerCase().includes(lowerQuery) ||
    c.notes?.toLowerCase().includes(lowerQuery)
  );
}

/**
 * 依顧問篩選候選人
 */
export async function getCandidatesByConsultant(consultant: string): Promise<Candidate[]> {
  const allCandidates = await getCandidates();
  return allCandidates.filter(c => c.consultant === consultant);
}

/**
 * 依狀態篩選候選人
 */
export async function getCandidatesByStatus(status: CandidateStatus): Promise<Candidate[]> {
  const allCandidates = await getCandidates();
  return allCandidates.filter(c => c.status === status);
}

/**
 * 清除快取（強制重新讀取）
 */
export function clearCache(): void {
  localStorage.removeItem(STORAGE_KEYS.CANDIDATES_CACHE);
  localStorage.removeItem(STORAGE_KEYS.LAST_SYNC);
  console.log('快取已清除');
}
