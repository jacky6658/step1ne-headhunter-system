// API 配置 - 自動偵測開發/生產環境

// 環境偵測
const isDevelopment = import.meta.env.DEV || window.location.hostname === 'localhost';

// API Base URL
export const API_BASE_URL = isDevelopment
  ? 'http://localhost:3001/api'  // 開發環境
  : 'https://backendstep1ne.zeabur.app/api';  // 生產環境（Zeabur）

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

// 預設 fetch 配置
export const defaultFetchConfig: RequestInit = {
  headers: {
    'Content-Type': 'application/json',
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

