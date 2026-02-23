/**
 * API 配置
 * 從環境變數獲取後端 API URL，如果沒有設置則使用 localStorage
 */

// 獲取 API URL（從環境變數或使用默認值）
export const getApiUrl = (): string | null => {
  // 優先使用環境變數
  const apiUrl = import.meta.env.VITE_API_URL;
  
  if (apiUrl) {
    return apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
  }
  
  // 如果沒有設置，返回 null（使用 localStorage）
  return null;
};

// 檢查是否使用 API 模式
export const useApiMode = (): boolean => {
  const apiUrl = getApiUrl();
  return apiUrl !== null;
};

// API 請求封裝
export const apiRequest = async (
  endpoint: string,
  options: RequestInit = {}
): Promise<any> => {
  const apiUrl = getApiUrl();
  if (!apiUrl) {
    throw new Error('API URL 未設置，請設置 VITE_API_URL 環境變數');
  }

  const url = `${apiUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  
  console.log(`🌐 API 請求: ${options.method || 'GET'} ${url}`);
  
  try {
    // 添加超時處理（10秒）
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    
    clearTimeout(timeoutId);

    console.log(`📡 API 響應狀態: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText || response.statusText };
      }
      console.error(`❌ API 請求失敗:`, errorData);
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`✅ API 請求成功，返回資料類型:`, Array.isArray(data) ? `陣列 (${data.length} 項)` : typeof data);
    return data;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error(`❌ API 請求超時（超過 10 秒）:`, url);
      throw new Error('API 請求超時，請檢查網路連接或後端服務狀態');
    }
    
    // 更詳細的錯誤訊息
    let errorMessage = 'API 請求失敗';
    if (error.message) {
      errorMessage = error.message;
    } else if (error.name === 'TypeError') {
      // Safari 和某些瀏覽器在網路錯誤時會拋出 TypeError
      if (error.message?.includes('Load failed') || error.message?.includes('Failed to fetch')) {
        errorMessage = `無法連接到後端服務 (${url})。請檢查：\n1. 後端服務是否正在運行\n2. API URL 是否正確配置\n3. 網路連接是否正常\n4. CORS 設定是否正確\n5. 是否為混合內容問題（HTTPS 頁面請求 HTTP API）`;
      } else {
        errorMessage = `網路請求錯誤: ${error.message || error.name}`;
      }
    }
    
    console.error(`❌ API 請求異常:`, {
      url,
      method: options.method || 'GET',
      error: errorMessage,
      errorType: error.name,
      errorMessage: error.message,
      errorStack: error.stack
    });
    
    // 創建一個包含更多資訊的錯誤對象
    const enhancedError = new Error(errorMessage);
    (enhancedError as any).originalError = error;
    (enhancedError as any).url = url;
    throw enhancedError;
  }
};
