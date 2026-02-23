
import { auth } from '../mockBackend';
import { AuditLog, AuditAction } from '../types';
import { getUserProfile } from './userService';
import { apiRequest, useApiMode } from './apiConfig';

const STORAGE_KEY = 'caseflow_audit_db';

// localStorage 操作（降級方案）
const getLogs = (): AuditLog[] => JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
const saveLogs = (logs: AuditLog[]) => localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));

export const logAction = async (
  lead_id: string, 
  action: AuditAction, 
  before?: any, 
  after?: any
) => {
  const user = auth.currentUser;
  if (!user) return;

  const profile = await getUserProfile(user.uid);
  const actor_name = profile?.displayName || 'Unknown';

  const newLog: AuditLog = {
    id: 'log_' + Math.random().toString(36).substr(2, 9),
    lead_id,
    actor_uid: user.uid,
    actor_name,
    action,
    before: before ? JSON.parse(JSON.stringify(before)) : null,
    after: after ? JSON.parse(JSON.stringify(after)) : null,
    created_at: new Date().toISOString()
  };

  const logs = getLogs();
  logs.unshift(newLog);
  saveLogs(logs.slice(0, 500));
};

export const fetchLogs = async (leadId?: string) => {
  // 如果使用 API 模式
  if (useApiMode()) {
    try {
      const endpoint = leadId ? `/api/audit-logs?leadId=${leadId}` : '/api/audit-logs';
      return await apiRequest(endpoint);
    } catch (error) {
      console.error('API 獲取審計日誌失敗，降級到 localStorage:', error);
      // 降級到 localStorage
    }
  }

  // localStorage 模式（降級方案）
  const logs = getLogs();
  if (leadId) return logs.filter(l => l.lead_id === leadId);
  return logs;
};
