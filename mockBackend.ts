
/**
 * CaseFlow 純本地 Mock 服務
 * 這個檔案模擬了所有的登入與資料通訊邏輯，不需要連網即可運作。
 */

export interface User {
  uid: string;
  isAnonymous: boolean;
}

let currentUser: User | null = JSON.parse(localStorage.getItem('caseflow_user') || 'null');
const authListeners: ((user: User | null) => void)[] = [];

// 模擬 Firebase Auth 對象
export const auth = {
  get currentUser() { return currentUser; }
};

export const onAuthStateChanged = (authObj: any, callback: (user: User | null) => void) => {
  authListeners.push(callback);
  // 模擬網路延遲後回傳狀態
  setTimeout(() => callback(currentUser), 10);
  return () => {
    const idx = authListeners.indexOf(callback);
    if (idx > -1) authListeners.splice(idx, 1);
  };
};

export const signInAnonymously = async (authObj: any, customUid?: string) => {
  // 如果提供了自定義 UID，使用它；否則生成隨機 UID
  const uid = customUid || ('user-' + Math.random().toString(36).substring(2, 9));
  const mockUser: User = { 
    uid: uid, 
    isAnonymous: true 
  };
  currentUser = mockUser;
  localStorage.setItem('caseflow_user', JSON.stringify(mockUser));
  // 使用 setTimeout 確保狀態更新在下一幀執行
  setTimeout(() => {
    authListeners.forEach(cb => cb(mockUser));
  }, 0);
  return { user: mockUser };
};

export const signOut = async (authObj: any) => {
  currentUser = null;
  localStorage.removeItem('caseflow_user');
  localStorage.removeItem('caseflow_profile');
  authListeners.forEach(cb => cb(null));
};

export const db = {};

console.log('系統提示：目前運行於「純本地模式」，無需設定後端金鑰即可使用。');
