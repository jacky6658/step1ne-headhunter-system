// Step1ne Headhunter System - 候選人服務層（Server-Side Pagination）
import { Candidate, CandidateStatus, CandidateSource } from '../types';
import { STORAGE_KEYS_EXT, CACHE_EXPIRY } from '../constants';
import { apiGet, apiPatch, apiPost } from '../config/api';

// ── 分頁查詢介面 ──

export interface CandidateQuery {
  limit?: number;
  offset?: number;
  page?: number;
  status?: string;
  source?: string;
  consultant?: string;
  job_id?: string;
  search?: string;
  created_today?: boolean;
  include_counts?: boolean;
}

export interface CandidatePageResult {
  data: Candidate[];
  total: number;
  pagination: { limit: number; offset: number; hasMore: boolean };
  statusCounts?: Record<string, number>;
  sourceCounts?: Record<string, number>;
}

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
 * Server-side 分頁查詢（新版：只拉一頁，篩選在後端做）
 */
export async function getCandidatesPage(query: CandidateQuery = {}): Promise<CandidatePageResult> {
  const params = new URLSearchParams();
  params.set('limit', String(query.limit || 50));
  params.set('offset', String(query.offset || 0));
  if (query.status && query.status !== 'all') params.set('status', query.status);
  if (query.source && query.source !== 'all') params.set('source', query.source);
  if (query.consultant && query.consultant !== 'all') params.set('consultant', query.consultant);
  if (query.job_id && query.job_id !== 'all') params.set('job_id', query.job_id);
  if (query.search) params.set('search', query.search);
  if (query.created_today) params.set('created_today', 'true');
  if (query.include_counts) params.set('include_counts', 'true');

  const result = await apiGet<{
    success: boolean;
    data: any[];
    total: number;
    pagination: { limit: number; offset: number; hasMore: boolean };
    statusCounts?: Record<string, number>;
    sourceCounts?: Record<string, number>;
  }>(`/candidates?${params.toString()}`);

  const data = (result.data || []).map((c: any) => ({
    ...c,
    aiMatchResult: c.ai_match_result || c.aiMatchResult || null
  }));

  return {
    data,
    total: result.total || 0,
    pagination: result.pagination || { limit: 50, offset: 0, hasMore: false },
    statusCounts: result.statusCounts || undefined,
    sourceCounts: result.sourceCounts || undefined,
  };
}

/**
 * 從 API 取得全部候選人（舊版 — 保留給龍蝦 AI Agent 批量操作用）
 */
export async function getCandidates(userProfile?: any): Promise<Candidate[]> {
  const PAGE_SIZE = 500;

  const firstResult = await apiGet<{
    success: boolean;
    data: any[];
    total: number;
    pagination?: { limit: number; offset: number; hasMore: boolean };
  }>(`/candidates?limit=${PAGE_SIZE}&offset=0`);

  const mapPage = (data: any[]) => (data || []).map((c: any) => ({
    ...c,
    aiMatchResult: c.ai_match_result || c.aiMatchResult || null
  }));

  const allCandidates = mapPage(firstResult.data);
  const total = firstResult.total || allCandidates.length;

  if (allCandidates.length >= total) {
    return allCandidates;
  }

  const remainingPages: Promise<any>[] = [];
  for (let offset = PAGE_SIZE; offset < total; offset += PAGE_SIZE) {
    remainingPages.push(
      apiGet<{ data: any[] }>(`/candidates?limit=${PAGE_SIZE}&offset=${offset}`)
    );
  }

  const results = await Promise.all(remainingPages);
  for (const result of results) {
    allCandidates.push(...mapPage(result.data));
  }

  return allCandidates;
}

/**
 * 搜尋候選人（舊版保留）
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
  await apiPatch(`/candidates/${candidateId}`, { status: newStatus });
  clearCache();
}

/**
 * 從 Google Sheets 同步到 SQL
 */
export async function syncFromSheets(): Promise<{ success: boolean; message: string }> {
  try {
    const result = await apiPost<{ message: string }>('/sync/sheets-to-sql');
    clearCache();
    return { success: true, message: result.message };
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
