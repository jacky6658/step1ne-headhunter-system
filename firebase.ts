
/**
 * CaseFlow Mock Backend Bridge
 * 完全模擬 Auth 與實時監聽介面。
 */

export interface User {
  uid: string;
  isAnonymous: boolean;
}

// 模擬持久化狀態
let currentUser: User | null = JSON.parse(localStorage.getItem('caseflow_user') || 'null');
const authListeners: ((user: User | null) => void)[] = [];

export const auth = {
  get currentUser() { return currentUser; }
};

export const onAuthStateChanged = (_: any, callback: (user: User | null) => void) => {
  authListeners.push(callback);
  callback(currentUser);
  return () => {
    const idx = authListeners.indexOf(callback);
    if (idx > -1) authListeners.splice(idx, 1);
  };
};

export const signInAnonymously = async (_: any) => {
  await new Promise(r => setTimeout(r, 150));
  const mockUser: User = { 
    uid: 'mock-id-' + Math.random().toString(36).substring(2, 9), 
    isAnonymous: true 
  };
  currentUser = mockUser;
  localStorage.setItem('caseflow_user', JSON.stringify(mockUser));
  authListeners.forEach(cb => cb(mockUser));
  return { user: mockUser };
};

export const signOut = async (_: any) => {
  currentUser = null;
  localStorage.removeItem('caseflow_user');
  localStorage.removeItem('caseflow_profile');
  authListeners.forEach(cb => cb(null));
};

export const db = {};

console.log('Backend Status: Local Storage Mock Active (Build Safe Mode).');
