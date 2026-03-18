
import { UserProfile, Role } from '../types';
import { API_BASE_URL } from '../constants';

const PROFILE_KEY = 'caseflow_profile';

// ==================== API 呼叫（多裝置同步） ====================

const apiBase = API_BASE_URL || '';

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  // 先從快取中找
  const cached = localStorage.getItem(PROFILE_KEY);
  if (cached) {
    const profile = JSON.parse(cached) as UserProfile;
    if (profile.uid === uid) return profile;
  }
  // 從後端取所有用戶找到對應的
  const users = await getAllUsers();
  return users.find(u => u.uid === uid) || null;
};

export const getUserByDisplayName = async (displayName: string): Promise<UserProfile | null> => {
  const users = await getAllUsers();
  return users.find(u => u.displayName?.toLowerCase() === displayName.toLowerCase()) || null;
};

export const getAllUsers = async (): Promise<UserProfile[]> => {
  try {
    const res = await fetch(`${apiBase}/api/users/all`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) {
      return json.data.map((u: any) => ({
        uid: u.uid,
        displayName: u.displayName,
        email: u.email,
        role: u.role as Role,
        isActive: u.isActive,
        avatar: u.avatar || '',
        status: u.status || '',
        createdAt: u.createdAt,
      }));
    }
    return [];
  } catch (err) {
    console.warn('getAllUsers API 失敗，嘗試 localStorage fallback:', err);
    // Fallback: 如果後端不可用，嘗試從 localStorage 讀取
    return getAllUsersFromLocalStorage();
  }
};

export const verifyPassword = async (displayName: string, password: string): Promise<UserProfile | false> => {
  try {
    const res = await fetch(`${apiBase}/api/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName, password }),
    });
    if (!res.ok) return false;
    const json = await res.json();
    if (json.success && json.data) {
      const profile: UserProfile = {
        uid: json.data.uid,
        displayName: json.data.displayName,
        email: json.data.email,
        role: json.data.role as Role,
        isActive: json.data.isActive,
        avatar: json.data.avatar || '',
        status: json.data.status || '',
        createdAt: json.data.createdAt,
        contactPhone: json.data.contactPhone || '',
        lineId: json.data.lineId || '',
        telegramHandle: json.data.telegramHandle || '',
      };
      // 存到 localStorage 做本機 session 快取
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
      return profile;
    }
    return false;
  } catch (err) {
    console.warn('verifyPassword API 失敗:', err);
    return false;
  }
};

export const createUserProfile = async (
  uid: string, email: string, role: Role, displayName: string, password?: string
): Promise<UserProfile> => {
  const res = await fetch(`${apiBase}/api/users/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uid, displayName, email, password, role }),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || '建立用戶失敗');
  }
  return {
    uid: json.data.uid,
    displayName: json.data.displayName,
    email: json.data.email,
    role: json.data.role as Role,
    isActive: json.data.isActive,
    createdAt: json.data.createdAt,
  };
};

export const updateUserProfile = async (uid: string, updates: Partial<UserProfile>): Promise<UserProfile | null> => {
  const res = await fetch(`${apiBase}/api/users/${uid}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || '更新用戶失敗');
  }
  const profile: UserProfile = {
    uid: json.data.uid,
    displayName: json.data.displayName,
    email: json.data.email,
    role: json.data.role as Role,
    isActive: json.data.isActive,
    avatar: json.data.avatar || '',
    status: json.data.status || '',
    createdAt: json.data.createdAt,
  };
  // 如果更新的是當前登入用戶，同步更新 localStorage session
  const currentProfile = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null');
  if (currentProfile && currentProfile.uid === uid) {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  }
  return profile;
};

export const deleteUser = async (uid: string): Promise<boolean> => {
  const res = await fetch(`${apiBase}/api/users/${uid}`, {
    method: 'DELETE',
  });
  const json = await res.json();
  return json.success === true;
};

export const setUserRole = async (uid: string, role: Role): Promise<void> => {
  await updateUserProfile(uid, { role });
};

// ==================== localStorage Fallback（後端不可用時） ====================

const STORAGE_KEY = 'caseflow_users_db';

const getAllUsersFromLocalStorage = (): UserProfile[] => {
  try {
    const db: Record<string, UserProfile> = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return Object.values(db).filter(u => u.isActive !== false);
  } catch {
    return [];
  }
};

// ==================== 不再需要的函數（保留空實現避免 import 報錯） ====================

export const cleanupDuplicateUsers = async (): Promise<number> => 0;
