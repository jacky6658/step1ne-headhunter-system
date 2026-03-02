// Step1ne Headhunter System - 候選人服務層
import { Candidate, CandidateStatus, CandidateSource } from '../types';
import { API_BASE_URL, STORAGE_KEYS_EXT, CACHE_EXPIRY } from '../constants';

/**
 * 權限過濾：根據用戶角色過濾候選人
 */
export function filterCandidatesByPermission(
  candidates: Candidate[],
  userProfile?: { username: string, role: string }
): Candidate[] {
  if (!userProfile) {
    return candidates;
  }
  
  // 管理員看全部
  if (userProfile.role === 'ADMIN') {
    return candidates;
  }
  
  // 獵頭顧問只看自己負責的候選人
  const consultantName = userProfile.username === 'phoebe' ? 'Phoebe' : 
                         userProfile.username === 'jacky' ? 'Jacky' : '';
  
  return candidates.filter(c => c.consultant === consultantName);
}

/**
 * 從 API 或 Mock 資料取得候選人（支援權限過濾）
 */
export async function getCandidates(userProfile?: any): Promise<Candidate[]> {
  // 【強制】永遠打真實 API，不能 fallback 到 Mock（用於本機開發驗證雲端連線）
  if (API_BASE_URL) {
    let url = `${API_BASE_URL}/candidates?limit=1000`; // 強制取全部候選人
    
    const response = await fetch(url);
    if (response.ok) {
      const text = await response.text();
      // 把 API 響應長度寫到 document.title 便於診斷
      document.title = `API_OK_${text.length}_chars`;
      const result = JSON.parse(text);
      const dataLength = result.data?.length || 0;
      document.title = `CANDIDATES_${dataLength}`;
      const candidates = (result.data || []).map((c: any) => ({
        ...c,
        aiMatchResult: c.ai_match_result || c.aiMatchResult || null
      }));
      return candidates;
    } else {
      const errText = await response.text();
      console.error('❌ API 錯誤:', response.status, errText.substring(0, 100));
      throw new Error(`API 失敗 ${response.status}: ${errText.substring(0, 200)}`);
    }
  }
  
  // 舊快取邏輯（保留）
  if (!userProfile) {
    const cached = localStorage.getItem(STORAGE_KEYS_EXT.CANDIDATES_CACHE);
    const lastSync = localStorage.getItem(STORAGE_KEYS_EXT.LAST_SYNC);
    if (cached && lastSync) {
      const cacheAge = Date.now() - parseInt(lastSync);
      if (cacheAge < CACHE_EXPIRY) {
        return JSON.parse(cached);
      }
    }
  }
  
  throw new Error('無法取得候選人資料：API 不可用且無快取');
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
 * 依狀態取得候選人
 */
export async function getCandidatesByStatus(status: CandidateStatus): Promise<Candidate[]> {
  const allCandidates = await getCandidates();
  return allCandidates.filter(c => c.status === status);
}

/**
 * 依顧問取得候選人
 */
export async function getCandidatesByConsultant(consultant: string): Promise<Candidate[]> {
  const allCandidates = await getCandidates();
  return allCandidates.filter(c => c.consultant === consultant);
}

/**
 * 更新候選人狀態
 */
export async function updateCandidateStatus(
  candidateId: string,
  newStatus: CandidateStatus
): Promise<void> {
  try {
    if (API_BASE_URL) {
      const response = await fetch(`${API_BASE_URL}/candidates/${candidateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      
      if (response.ok) {
        // 清除快取
        clearCache();
        return;
      }
    }
  } catch (error) {
    console.error('更新狀態失敗:', error);
  }
  
  // Fallback: 更新本地快取
  const cached = localStorage.getItem(STORAGE_KEYS_EXT.CANDIDATES_CACHE);
  if (cached) {
    const candidates = JSON.parse(cached);
    const candidate = candidates.find((c: Candidate) => c.id === candidateId);
    if (candidate) {
      candidate.status = newStatus;
      candidate.updatedAt = new Date().toISOString();
      localStorage.setItem(STORAGE_KEYS_EXT.CANDIDATES_CACHE, JSON.stringify(candidates));
    }
  }
}

/**
 * 從 Google Sheets 同步到 SQL
 */
export async function syncFromSheets(): Promise<{ success: boolean; message: string }> {
  try {
    if (API_BASE_URL) {
      const response = await fetch(`${API_BASE_URL}/sync/sheets-to-sql`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (response.ok) {
        const result = await response.json();
        clearCache();
        return { success: true, message: result.message };
      }
    }
    return { success: false, message: 'API 無法連接' };
  } catch (error) {
    console.error('Sheets → SQL 同步失敗:', error);
    return { success: false, message: String(error) };
  }
}

/**
 * 清除快取
 */
export function clearCache(): void {
  localStorage.removeItem(STORAGE_KEYS_EXT.CANDIDATES_CACHE);
  localStorage.removeItem(STORAGE_KEYS_EXT.LAST_SYNC);
}

/**
 * Mock 資料（示範用）
 * 真實資料會從 Google Sheets 履歷池v2 讀取
 */
function getMockCandidates(): Candidate[] {
  return [
    {
      id: 'candidate-228',
      name: '陳宥樺',
      email: 'thisbigsister@gmail.com',
      phone: '(+1)778-926-4272',
      location: '加拿大',
      position: '雙語文件管理師 | 專案行政專家',
      years: 9.7,
      jobChanges: 5,
      avgTenure: 1.9,
      lastGap: 1,
      skills: '雙語文件處理 | 英文讀寫 | MS Office | Google Workspace | Trello | Slack | CRM系統 | 文件管理 | 專案行政 | 跨部門溝通',
      education: '國立臺中科技大學 休閒事業經營系 學士 (2009-2013)',
      source: CandidateSource.GMAIL,
      workHistory: [
        {
          company: 'Quality Inn & Suites Thunder Bay Downtown',
          title: '客務主管 (Guest Service Supervisor)',
          start: '2023-11',
          end: '2026-02',
          duration_months: 28,
          location: '加拿大，安大略省，雷灣'
        },
        {
          company: 'SRS Windows And Doors Inc.',
          title: '資料輸入專員 (Data Entry Clerk)',
          start: '2023-03',
          end: '2023-10',
          duration_months: 8,
          location: '加拿大，安大略省，雷灣'
        }
      ],
      stabilityScore: 44,
      educationJson: [
        {
          school: '國立臺中科技大學',
          degree: '學士',
          major: '休閒事業經營系',
          start: '2009',
          end: '2013'
        }
      ],
      status: CandidateStatus.NOT_STARTED,
      consultant: 'Jacky',
      notes: 'CELPIP 7分 | 具備加拿大工作經驗',
      createdAt: '2026-02-23T13:00:00Z',
      updatedAt: '2026-02-23T13:00:00Z',
      createdBy: 'system',
      _sheetRow: 228
    },
    // 更多 mock 資料...
    {
      id: 'candidate-227',
      name: '張大明',
      email: 'zhang@example.com',
      phone: '0912-345-678',
      location: '台北市',
      position: '資深前端工程師',
      years: 5.5,
      jobChanges: 3,
      avgTenure: 1.8,
      lastGap: 2,
      skills: 'React, TypeScript, Next.js, Tailwind CSS, Node.js, Git',
      education: '國立台灣大學 資訊工程系 學士',
      source: CandidateSource.LINKEDIN,
      stabilityScore: 68,
      status: CandidateStatus.INTERVIEWED,
      consultant: 'Phoebe',
      notes: '熟悉現代前端技術棧，有帶團隊經驗',
      createdAt: '2026-02-20T10:00:00Z',
      updatedAt: '2026-02-22T15:30:00Z',
      createdBy: 'system',
      _sheetRow: 227
    },
    {
      id: 'candidate-226',
      name: '李小華',
      email: 'lee@example.com',
      phone: '0987-654-321',
      location: '新竹市',
      position: 'DevOps 工程師',
      years: 7.2,
      jobChanges: 2,
      avgTenure: 3.6,
      lastGap: 0,
      skills: 'Kubernetes, Docker, AWS, GCP, CI/CD, Terraform, Python',
      education: '交通大學 資訊工程系 碩士',
      source: CandidateSource.GITHUB,
      stabilityScore: 85,
      status: CandidateStatus.OFFER,
      consultant: 'Jacky',
      notes: '目前在科技公司任職，尋求更好發展機會',
      createdAt: '2026-02-18T09:00:00Z',
      updatedAt: '2026-02-23T11:00:00Z',
      createdBy: 'system',
      _sheetRow: 226
    }
  ];
}
