// API 配置 - 自動偵測開發/生產環境

// API Base URL - 本地開發透過 Vite proxy，外網透過 Cloudflare Tunnel
import { API_BASE_URL as BASE } from '../constants';
export const API_BASE_URL = BASE ? `${BASE}/api` : '/api';

/**
 * 取得「外部可存取」的完整 API Base URL
 * 用於 AI Prompt 模板等需要完整 URL 的場景
 * 根據目前的 hostname 自動判斷：
 *  - hrsystem.step1ne.com → https://api-hr.step1ne.com
 *  - localhost             → http://localhost:3003
 */
export function getPublicApiBaseUrl(): string {
  if (typeof window === 'undefined') return 'https://api-hr.step1ne.com';
  const host = window.location.hostname;
  if (host === 'hrsystem.step1ne.com') return 'https://api-hr.step1ne.com';
  // 本地開發
  return 'http://localhost:3003';
}

// 完整 URL 生成器
export function getApiUrl(endpoint: string): string {
  // 移除開頭的 /api（如果有）
  const cleanEndpoint = endpoint.startsWith('/api') 
    ? endpoint.substring(4) 
    : endpoint;
  
  // 移除開頭的 /（如果有）
  const path = cleanEndpoint.startsWith('/') 
    ? cleanEndpoint 
    : `/${cleanEndpoint}`;
  
  return `${API_BASE_URL}${path}`;
}

// API 認證 Key（從環境變數注入，build 時寫入 bundle）
const API_KEY = import.meta.env.VITE_API_KEY || '';

// 取得 API Token（用於 URL query string 認證，如履歷下載）
export function getApiToken(): string {
  return API_KEY;
}

// 取得含認證的 headers
export function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (API_KEY) {
    headers['Authorization'] = `Bearer ${API_KEY}`;
  }
  return headers;
}

// 預設 fetch 配置（含認證）
export const defaultFetchConfig: RequestInit = {
  get headers() {
    return getAuthHeaders();
  },
};

// Timeout 等級（配合後端 + Cloudflare Tunnel 的 timeout 鏈）
// DB: 5-15s < 後端 HTTP: 30-120s < Cloudflare: 100s < 前端: 以下設定
const TIMEOUT_LEVELS = {
  fast: 15_000,      // 一般 CRUD 操作 (15 秒)
  medium: 30_000,    // 列表查詢、搜尋 (30 秒)
  slow: 120_000,     // AI 分析、報表產生 (2 分鐘)
  upload: 300_000,   // 檔案上傳 (5 分鐘)
} as const;

type TimeoutLevel = keyof typeof TIMEOUT_LEVELS;

// 帶 timeout 的 fetch
async function fetchWithTimeout<T>(
  url: string,
  options: RequestInit & { timeoutLevel?: TimeoutLevel } = {}
): Promise<T> {
  const { timeoutLevel = 'fast', ...fetchOptions } = options;
  const timeout = TIMEOUT_LEVELS[timeoutLevel];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`API 錯誤: ${response.status} ${response.statusText}`);
    }
    return response.json();
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error(`API 請求超時 (${timeout / 1000}s): ${url}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// API 呼叫輔助函數
export async function apiGet<T>(endpoint: string, timeoutLevel: TimeoutLevel = 'medium'): Promise<T> {
  return fetchWithTimeout<T>(getApiUrl(endpoint), {
    ...defaultFetchConfig,
    method: 'GET',
    timeoutLevel,
  });
}

export async function apiPost<T>(endpoint: string, data?: any, timeoutLevel: TimeoutLevel = 'fast'): Promise<T> {
  return fetchWithTimeout<T>(getApiUrl(endpoint), {
    ...defaultFetchConfig,
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined,
    timeoutLevel,
  });
}

export async function apiPut<T>(endpoint: string, data?: any, timeoutLevel: TimeoutLevel = 'fast'): Promise<T> {
  return fetchWithTimeout<T>(getApiUrl(endpoint), {
    ...defaultFetchConfig,
    method: 'PUT',
    body: data ? JSON.stringify(data) : undefined,
    timeoutLevel,
  });
}

export async function apiPatch<T>(endpoint: string, data?: any, timeoutLevel: TimeoutLevel = 'fast'): Promise<T> {
  return fetchWithTimeout<T>(getApiUrl(endpoint), {
    ...defaultFetchConfig,
    method: 'PATCH',
    body: data ? JSON.stringify(data) : undefined,
    timeoutLevel,
  });
}

export async function apiDelete<T>(endpoint: string, timeoutLevel: TimeoutLevel = 'fast'): Promise<T> {
  return fetchWithTimeout<T>(getApiUrl(endpoint), {
    ...defaultFetchConfig,
    method: 'DELETE',
    timeoutLevel,
  });
}

