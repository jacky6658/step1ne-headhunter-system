/**
 * crawlerService.ts - 爬蟲整合 API 呼叫封裝
 *
 * 爬蟲路由只存在於本地 Express 後端 (:3001)，
 * 所以這裡使用相對 URL（走 Vite dev proxy）而非 API_BASE_URL。
 * 生產環境部署後，會走同一台 Express server 所以也是相對路徑。
 */
import type {
  CrawlerStats,
  CrawlerCandidate,
  CrawlerTask,
  MetricsSnapshot,
  ScoreBreakdown,
  EfficiencyData,
  ImportResult,
  ImportStatusResult,
} from '../crawlerTypes';

// 爬蟲 API 基礎路徑 — 使用相對路徑走 Vite proxy
const CRAWLER_BASE = '/api/crawler';

async function crawlerGet<T>(path: string): Promise<T> {
  const resp = await fetch(`${CRAWLER_BASE}${path}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!resp.ok) throw new Error(`API error: ${resp.status}`);
  return resp.json();
}

async function crawlerPost<T>(path: string, data?: any): Promise<T> {
  const resp = await fetch(`${CRAWLER_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: data ? JSON.stringify(data) : undefined,
  });
  if (!resp.ok) throw new Error(`API error: ${resp.status}`);
  return resp.json();
}

async function crawlerDelete<T>(path: string): Promise<T> {
  const resp = await fetch(`${CRAWLER_BASE}${path}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!resp.ok) throw new Error(`API error: ${resp.status}`);
  return resp.json();
}

// ── Health ──
export const getCrawlerHealth = () =>
  crawlerGet<any>('/health');

// ── Stats ──
export const getCrawlerStats = () =>
  crawlerGet<CrawlerStats>('/stats');

// ── Candidates ──
export const getCrawlerCandidates = (params?: {
  client?: string;
  grade?: string;
  limit?: number;
  page?: number;
}) => {
  const qs = new URLSearchParams();
  if (params?.client) qs.set('client', params.client);
  if (params?.grade) qs.set('grade', params.grade);
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.page) qs.set('page', String(params.page));
  const qsStr = qs.toString();
  return crawlerGet<any>(`/candidates${qsStr ? '?' + qsStr : ''}`);
};

export const getCrawlerCandidate = (id: string) =>
  crawlerGet<CrawlerCandidate>(`/candidates/${id}`);

// ── Tasks ──
export const getCrawlerTasks = () =>
  crawlerGet<any>('/tasks');

export const createCrawlerTask = (task: Partial<CrawlerTask>) =>
  crawlerPost<any>('/tasks', task);

export const runCrawlerTask = (id: string) =>
  crawlerPost<any>(`/tasks/${id}/run`);

export const deleteCrawlerTask = (id: string) =>
  crawlerDelete<any>(`/tasks/${id}`);

export const getTaskStatus = (id: string) =>
  crawlerGet<any>(`/tasks/${id}/status`);

// ── Scoring ──
export const rescoreCandidates = (params: {
  client_name?: string;
  job_title?: string;
}) =>
  crawlerPost<any>('/score/candidates', params);

export const getScoreDetail = (id: string) =>
  crawlerGet<ScoreBreakdown>(`/score/detail/${id}`);

// ── Keywords ──
export const generateKeywords = (jobTitle: string, existingSkills?: string[]) =>
  crawlerPost<any>('/keywords/generate', {
    job_title: jobTitle,
    existing_skills: existingSkills || [],
  });

// ── Clients ──
export const getCrawlerClients = () =>
  crawlerGet<string[]>('/clients');

// ── Metrics ──
export const getMetricsHistory = (from?: string, to?: string) => {
  const qs = new URLSearchParams();
  if (from) qs.set('from', from);
  if (to) qs.set('to', to);
  const qsStr = qs.toString();
  return crawlerGet<{ success: boolean; data: MetricsSnapshot[] }>(
    `/metrics/history${qsStr ? '?' + qsStr : ''}`
  );
};

export const takeMetricsSnapshot = () =>
  crawlerPost<any>('/metrics/snapshot');

export const getEfficiencyMetrics = () =>
  crawlerGet<EfficiencyData & { success: boolean }>('/metrics/efficiency');

// ── Config ──
export const getCrawlerConfig = () =>
  crawlerGet<{ success: boolean; config: { url: string } }>('/config');

export const saveCrawlerConfig = (url: string) =>
  crawlerPost<any>('/config', { url });

// ── Import (匯入爬蟲候選人到系統) ──

export const importToSystem = (
  candidates: CrawlerCandidate[],
  actor: string,
  filters?: { min_grade?: string }
) =>
  crawlerPost<ImportResult>('/import', { candidates, actor, filters });

export const checkImportStatus = (names: string[]) =>
  crawlerGet<ImportStatusResult>(
    `/import-status?names=${encodeURIComponent(names.join(','))}`
  );
