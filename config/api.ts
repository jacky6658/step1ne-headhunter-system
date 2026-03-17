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

// API 呼叫輔助函數
export async function apiGet<T>(endpoint: string): Promise<T> {
  const response = await fetch(getApiUrl(endpoint), {
    ...defaultFetchConfig,
    method: 'GET',
  });
  
  if (!response.ok) {
    throw new Error(`API 錯誤: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

export async function apiPost<T>(endpoint: string, data?: any): Promise<T> {
  const response = await fetch(getApiUrl(endpoint), {
    ...defaultFetchConfig,
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined,
  });
  
  if (!response.ok) {
    throw new Error(`API 錯誤: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

export async function apiPut<T>(endpoint: string, data?: any): Promise<T> {
  const response = await fetch(getApiUrl(endpoint), {
    ...defaultFetchConfig,
    method: 'PUT',
    body: data ? JSON.stringify(data) : undefined,
  });

  if (!response.ok) {
    throw new Error(`API 錯誤: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export async function apiPatch<T>(endpoint: string, data?: any): Promise<T> {
  const response = await fetch(getApiUrl(endpoint), {
    ...defaultFetchConfig,
    method: 'PATCH',
    body: data ? JSON.stringify(data) : undefined,
  });

  if (!response.ok) {
    throw new Error(`API 錯誤: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export async function apiDelete<T>(endpoint: string): Promise<T> {
  const response = await fetch(getApiUrl(endpoint), {
    ...defaultFetchConfig,
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(`API 錯誤: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

