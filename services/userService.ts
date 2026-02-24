
import { UserProfile, Role } from '../types';

const STORAGE_KEY = 'caseflow_users_db';
const PROFILE_KEY = 'caseflow_profile';
const INITIALIZED_KEY = 'caseflow_users_initialized';

// localStorage 操作
const getDb = (): Record<string, UserProfile> => JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
const saveDb = (db: Record<string, UserProfile>) => localStorage.setItem(STORAGE_KEY, JSON.stringify(db));

// 初始化預設用戶
const initializeDefaultUsers = () => {
  if (localStorage.getItem(INITIALIZED_KEY)) return;
  
  const now = new Date().toISOString();
  const defaultUsers: Record<string, UserProfile> = {
    'admin': {
      uid: 'admin',
      email: 'admin@caseflow.internal',
      role: Role.ADMIN,
      displayName: 'Admin',
      password: 'admin123', // 預設密碼
      isActive: true,
      createdAt: now
    },
    'phoebe': {
      uid: 'phoebe',
      email: 'phoebe@caseflow.internal',
      role: Role.REVIEWER,
      displayName: 'Phoebe',
      password: 'phoebe123',
      isActive: true,
      createdAt: now
    },
    'jacky': {
      uid: 'jacky',
      email: 'jacky@caseflow.internal',
      role: Role.REVIEWER,
      displayName: 'Jacky',
      password: 'jacky123',
      isActive: true,
      createdAt: now
    },
    'jim': {
      uid: 'jim',
      email: 'jim@caseflow.internal',
      role: Role.REVIEWER,
      displayName: 'Jim',
      password: 'jim123',
      isActive: true,
      createdAt: now
    }
  };
  
  saveDb(defaultUsers);
  localStorage.setItem(INITIALIZED_KEY, 'true');
};

// 初始化
initializeDefaultUsers();

// 清理重複用戶（在初始化後執行一次）
if (typeof window !== 'undefined') {
  setTimeout(() => {
    cleanupDuplicateUsers().then(count => {
      if (count > 0) {
        console.log(`已清理 ${count} 個重複用戶`);
      }
    });
  }, 100);
}

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  // 🔧 強制使用 localStorage（用戶管理不使用後端 API）
  // 原因：Step1ne 是 B2B SaaS，用戶管理由前端處理
  
  // localStorage 模式
  const db = getDb();
  return db[uid] || JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null');
};

export const getUserByDisplayName = async (displayName: string): Promise<UserProfile | null> => {
  const db = getDb();
  const user = Object.values(db).find(u => 
    u.displayName && u.displayName.toLowerCase() === displayName.toLowerCase()
  );
  return user || null;
};

export const getAllUsers = async (): Promise<UserProfile[]> => {
  // 🔧 強制使用 localStorage（用戶管理不使用後端 API）
  
  // localStorage 模式
  const db = getDb();
  const users = Object.values(db).filter(u => u.isActive !== false);
  
  // 如果 localStorage 也沒有用戶，確保初始化預設用戶
  if (users.length === 0) {
    initializeDefaultUsers();
    return Object.values(getDb()).filter(u => u.isActive !== false);
  }
  
  // 去重：如果有多個相同 displayName 的用戶，只保留第一個（根據 uid 排序）
  const seen = new Map<string, UserProfile>();
  const duplicatesToDelete: string[] = [];
  
  for (const user of users) {
    if (!user.displayName) continue; // 跳過沒有 displayName 的用戶
    const key = user.displayName.toLowerCase();
    if (!seen.has(key)) {
      seen.set(key, user);
    } else {
      // 比較 uid，保留較小的（較早創建的）
      const existing = seen.get(key)!;
      if (user.uid < existing.uid) {
        duplicatesToDelete.push(existing.uid);
        seen.set(key, user);
      } else {
        duplicatesToDelete.push(user.uid);
      }
    }
  }
  
  // 刪除重複的用戶
  if (duplicatesToDelete.length > 0) {
    for (const uid of duplicatesToDelete) {
      await deleteUser(uid);
    }
  }
  
  return Array.from(seen.values());
};

// 清理重複用戶的函數
export const cleanupDuplicateUsers = async () => {
  const db = getDb();
  const users = Object.values(db);
  const nameMap = new Map<string, UserProfile[]>();
  
  // 按 displayName 分組
  users.forEach(user => {
    if (!user.displayName) return; // 跳過沒有 displayName 的用戶
    const key = user.displayName.toLowerCase();
    if (!nameMap.has(key)) {
      nameMap.set(key, []);
    }
    nameMap.get(key)!.push(user);
  });
  
  // 刪除重複的用戶（保留第一個）
  let deletedCount = 0;
  for (const [name, duplicates] of nameMap.entries()) {
    if (duplicates.length > 1) {
      // 按 uid 排序，保留第一個
      duplicates.sort((a, b) => a.uid.localeCompare(b.uid));
      // 刪除除了第一個之外的所有重複用戶
      for (let i = 1; i < duplicates.length; i++) {
        await deleteUser(duplicates[i].uid);
        deletedCount++;
      }
    }
  }
  
  return deletedCount;
};

export const verifyPassword = async (displayName: string, password: string): Promise<boolean> => {
  const user = await getUserByDisplayName(displayName);
  if (!user || !user.password) return false;
  return user.password === password;
};

export const createUserProfile = async (uid: string, email: string, role: Role, displayName: string, password?: string) => {
  const profile: UserProfile = { 
    uid, 
    email, 
    role, 
    displayName,
    password,
    isActive: true,
    createdAt: new Date().toISOString()
  };
  
  // 🔧 強制使用 localStorage（用戶管理不使用後端 API）
  const db = getDb();
  db[uid] = profile;
  saveDb(db);
  // 只在登入時設置當前用戶的 profile
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  return profile;
};

export const updateUserProfile = async (uid: string, updates: Partial<UserProfile>) => {
  // 🔧 強制使用 localStorage（用戶管理不使用後端 API）
  
  // localStorage 模式
  const db = getDb();
  if (db[uid]) {
    db[uid] = { ...db[uid], ...updates };
    saveDb(db);
    
    // 如果更新的是當前用戶，同步更新 localStorage
    const currentProfile = JSON.parse(localStorage.getItem('caseflow_profile') || 'null');
    if (currentProfile && currentProfile.uid === uid) {
      localStorage.setItem('caseflow_profile', JSON.stringify(db[uid]));
    }
    
    return db[uid];
  }
  return null;
};

export const deleteUser = async (uid: string) => {
  const db = getDb();
  if (db[uid]) {
    delete db[uid];
    saveDb(db);
    return true;
  }
  return false;
};

export const setUserRole = async (uid: string, role: Role) => {
  const db = getDb();
  if (db[uid]) {
    db[uid].role = role;
    saveDb(db);
  }
};
