
import { auth } from '../mockBackend';
import { Lead, LeadStatus, Decision, AuditAction, ProgressUpdate, ChangeHistory, CostRecord, ProfitRecord, Platform } from '../types';
import { logAction } from './auditService';
import { getUserProfile } from './userService';
import { apiRequest, useApiMode, getApiUrl } from './apiConfig';
import { PRO360_CONTACT_COST_ITEM } from '../constants';

const STORAGE_KEY = 'caseflow_leads_db';

// localStorage 操作（降級方案）
const getLeads = (): Lead[] => JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
const saveLeads = (leads: Lead[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));
  window.dispatchEvent(new Event('leads_updated'));
};

// API 模式：從後端獲取資料
export const fetchLeadsFromApi = async (): Promise<Lead[]> => {
  try {
    const leads = await apiRequest('/api/leads');
    return leads || [];
  } catch (error) {
    console.error('❌ 從 API 獲取案件失敗，降級到 localStorage:', error);
    return getLeads(); // 降級到 localStorage
  }
};

// 生成案件編號（從 aijob-001 開始）
const generateCaseCode = async (): Promise<string> => {
  let allLeads: Lead[] = [];
  
  // 獲取所有案件
  if (useApiMode()) {
    try {
      allLeads = await fetchLeadsFromApi();
    } catch (error) {
      console.error('獲取案件列表失敗，使用 localStorage:', error);
      allLeads = getLeads();
    }
  } else {
    allLeads = getLeads();
  }
  
  // 找出所有已有的編號
  const existingCodes = allLeads
    .map(lead => lead.case_code)
    .filter(code => code && code.startsWith('aijob-'))
    .map(code => {
      const match = code.match(/aijob-(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    });
  
  // 找出最大編號
  const maxNumber = existingCodes.length > 0 ? Math.max(...existingCodes) : 0;
  
  // 生成新編號（加1）
  const nextNumber = maxNumber + 1;
  return `aijob-${String(nextNumber).padStart(3, '0')}`;
};

// 檢查重複案件（嚴格模式：所有條件必須完全一致）
const checkDuplicateLead = async (leadData: Partial<Lead>): Promise<Lead | null> => {
  let allLeads: Lead[] = [];
  
  // 獲取所有案件
  if (useApiMode()) {
    try {
      allLeads = await fetchLeadsFromApi();
    } catch (error) {
      console.error('獲取案件列表失敗，使用 localStorage:', error);
      allLeads = getLeads();
    }
  } else {
    allLeads = getLeads();
  }
  
  // 標準化輸入數據
  const platform = leadData.platform;
  const platformId = leadData.platform_id?.trim().toLowerCase() || '';
  const location = leadData.location?.trim().toLowerCase() || '';
  const phone = leadData.phone?.trim() || '';
  const email = leadData.email?.trim().toLowerCase() || '';
  const need = leadData.need?.trim() || '';
  
  // 必須有平台和對方ID/名稱才能判斷重複
  if (!platform || !platformId) {
    return null;
  }
  
  // 必須有客戶需求才能判斷重複
  if (!need) {
    return null;
  }
  
  // 查找重複案件：所有條件必須完全一致
  const duplicate = allLeads.find(lead => {
    // 1. 平台必須相同
    if (lead.platform !== platform) {
      return false;
    }
    
    // 2. 對方ID/名稱必須完全一致（不區分大小寫）
    const existingPlatformId = lead.platform_id?.trim().toLowerCase() || '';
    if (existingPlatformId !== platformId) {
      return false;
    }
    
    // 3. 地點必須完全一致（如果都有地點）
    const existingLocation = lead.location?.trim().toLowerCase() || '';
    if (location && existingLocation) {
      // 如果新數據有地點，現有數據也必須有相同地點
      if (existingLocation !== location) {
        return false;
      }
    } else if (location || existingLocation) {
      // 如果只有一方有地點，不匹配
      return false;
    }
    
    // 4. 電話必須完全一致（如果都有電話）
    const existingPhone = lead.phone?.trim() || '';
    if (phone && existingPhone) {
      // 如果新數據有電話，現有數據也必須有相同電話
      if (existingPhone !== phone) {
        return false;
      }
    } else if (phone || existingPhone) {
      // 如果只有一方有電話，不匹配
      return false;
    }
    
    // 5. Email必須完全一致（如果都有Email）
    const existingEmail = lead.email?.trim().toLowerCase() || '';
    if (email && existingEmail) {
      // 如果新數據有Email，現有數據也必須有相同Email
      if (existingEmail !== email) {
        return false;
      }
    } else if (email || existingEmail) {
      // 如果只有一方有Email，不匹配
      return false;
    }
    
    // 6. 客戶需求必須完全一致
    const existingNeed = lead.need?.trim() || '';
    if (existingNeed !== need) {
      return false;
    }
    
    // 所有條件都匹配，認為是重複案件
    return true;
  });
  
  return duplicate || null;
};

// 合併案件數據
const mergeLeads = (existing: Lead, newData: Partial<Lead>): Lead => {
  // 合併邏輯：保留現有案件的數據，但用新數據填充空欄位
  const merged: Lead = {
    ...existing,
    // 如果新數據有值且現有數據為空，則使用新數據
    need: existing.need || newData.need || '',
    budget_text: existing.budget_text || newData.budget_text || '',
    phone: existing.phone || newData.phone || undefined,
    email: existing.email || newData.email || undefined,
    location: existing.location || newData.location || undefined,
    estimated_duration: existing.estimated_duration || newData.estimated_duration || undefined,
    contact_method: existing.contact_method || newData.contact_method || undefined,
    note: existing.note || newData.note || '',
    // 合併 links（去重）
    links: [...new Set([...(existing.links || []), ...(newData.links || [])])],
    // 合併成本記錄（去重，基於 item_name）
    cost_records: mergeCostRecords(existing.cost_records || [], newData.cost_records || []),
    // 合併利潤記錄（去重，基於 item_name）
    profit_records: mergeProfitRecords(existing.profit_records || [], newData.profit_records || []),
    // 更新時間
    updated_at: new Date().toISOString(),
    last_action_by: newData.created_by_name || existing.last_action_by
  };
  
  return merged;
};

// 合併成本記錄
const mergeCostRecords = (existing: CostRecord[], newRecords: CostRecord[]): CostRecord[] => {
  const merged = [...existing];
  newRecords.forEach(newRecord => {
    // 如果不存在相同 item_name 的記錄，則添加
    if (!merged.find(r => r.item_name === newRecord.item_name)) {
      merged.push(newRecord);
    }
  });
  return merged;
};

// 合併利潤記錄
const mergeProfitRecords = (existing: ProfitRecord[], newRecords: ProfitRecord[]): ProfitRecord[] => {
  const merged = [...existing];
  newRecords.forEach(newRecord => {
    // 如果不存在相同 item_name 的記錄，則添加
    if (!merged.find(r => r.item_name === newRecord.item_name)) {
      merged.push(newRecord);
    }
  });
  return merged;
};

export const createLead = async (leadData: Partial<Lead>, mergeIfDuplicate: boolean = false): Promise<{ success: boolean; leadId: string; isDuplicate: boolean; existingLead?: Lead }> => {
  const user = auth.currentUser;
  if (!user) throw new Error('Unauthorized');
  
  // 檢查重複
  const duplicate = await checkDuplicateLead(leadData);
  
  if (duplicate && !mergeIfDuplicate) {
    // 發現重複，但不合併，返回重複信息
    return {
      success: false,
      leadId: duplicate.id,
      isDuplicate: true,
      existingLead: duplicate
    };
  }
  
  const profile = await getUserProfile(user.uid);
  const creatorName = profile?.displayName || 'Unknown';
  
  const now = new Date().toISOString();
  
  // 如果是合併模式，使用現有案件的 ID 和 case_code
  let id: string;
  let caseCode: string;
  
  if (duplicate && mergeIfDuplicate) {
    // 合併模式：使用現有案件的 ID 和 case_code
    id = duplicate.id;
    caseCode = duplicate.case_code || await generateCaseCode();
    
    // 合併數據
    const mergedLead = mergeLeads(duplicate, leadData);
    
    // 更新案件
    await updateLead(id, mergedLead, AuditAction.UPDATE);
    
    await logAction(id, AuditAction.UPDATE, duplicate, mergedLead);
    return {
      success: true,
      leadId: id,
      isDuplicate: true,
      existingLead: duplicate
    };
  }
  
  // 新建模式
  id = 'lead_' + Math.random().toString(36).substr(2, 9);
  caseCode = await generateCaseCode();
  
  const finalStatus = leadData.status || LeadStatus.TO_FILTER;
  
  const newLead: Lead = {
    ...(leadData as Lead),
    id,
    case_code: caseCode,
    status: finalStatus,
    decision: leadData.decision || Decision.PENDING,
    priority: leadData.priority || 3,
    created_by: user.uid,
    created_by_name: creatorName,
    created_at: now,
    updated_at: now,
    progress_updates: leadData.progress_updates || [],
    change_history: leadData.change_history || [],
    cost_records: leadData.cost_records || [],
    profit_records: leadData.profit_records || [],
    contracts: leadData.contracts || [],
    links: leadData.links || [],
    contact_status: leadData.contact_status || Decision.PENDING
  };

  // 如果使用 API 模式，先調用 API
  if (useApiMode()) {
    try {
      const response = await apiRequest('/api/leads', {
        method: 'POST',
        body: JSON.stringify(newLead),
      });
      await logAction(id, AuditAction.CREATE, null, newLead);
      return {
        success: true,
        leadId: id,
        isDuplicate: false
      };
    } catch (error: any) {
      console.error('❌ API 創建案件失敗，降級到 localStorage:', error);
      console.error('錯誤詳情:', {
        message: error.message,
        name: error.name,
        stack: error.stack
      });
      // 降級到 localStorage，但顯示警告
      if (error.message && !error.message.includes('降級')) {
        console.warn('⚠️ 將使用 localStorage 模式保存案件，但資料不會同步到雲端');
      }
      // 繼續執行 localStorage 模式
    }
  }

  // localStorage 模式（降級方案）
  const leads = getLeads();
  leads.unshift(newLead);
  saveLeads(leads);
  
  await logAction(id, AuditAction.CREATE, null, newLead);
  return {
    success: true,
    leadId: id,
    isDuplicate: false
  };
};

// 記錄欄位變更
const recordFieldChanges = (before: Lead, after: Lead, authorUid: string, authorName: string): ChangeHistory[] => {
  const changes: ChangeHistory[] = [];
  const fieldsToTrack = ['platform', 'platform_id', 'need', 'budget_text', 'phone', 'email', 'location', 'status', 'contact_status', 'internal_remarks', 'note'];
  
  fieldsToTrack.forEach(field => {
    const oldValue = (before as any)[field];
    const newValue = (after as any)[field];
    if (oldValue !== newValue) {
      changes.push({
        id: 'change_' + Math.random().toString(36).substr(2, 9),
        lead_id: after.id,
        field,
        old_value: oldValue,
        new_value: newValue,
        author_uid: authorUid,
        author_name: authorName,
        created_at: new Date().toISOString()
      });
    }
  });
  
  return changes;
};

export const updateLead = async (id: string, updates: Partial<Lead>, actionType: AuditAction = AuditAction.UPDATE) => {
  const user = auth.currentUser;
  if (!user) return;

  const profile = await getUserProfile(user.uid);
  const actorName = profile?.displayName || 'Unknown';
  
  // 如果使用 API 模式
  if (useApiMode()) {
    try {
      // 先獲取當前資料以記錄變更
      const currentLeads = await fetchLeadsFromApi();
      const before = currentLeads.find((l: Lead) => l.id === id);
      if (!before) return;

      // 構建更新對象，確保不會覆蓋已有的成本/利潤記錄
      const after: Partial<Lead> = {
        ...before,
        ...updates,
        last_action_by: actorName,
      };
      
      // 特殊處理：如果 updates 中明確提供了 cost_records 或 profit_records，使用提供的值
      // 否則保留 before 中的值（避免覆蓋）
      if (updates.cost_records !== undefined) {
        after.cost_records = updates.cost_records;
      } else {
        after.cost_records = before.cost_records || [];
      }
      
      if (updates.profit_records !== undefined) {
        after.profit_records = updates.profit_records;
      } else {
        after.profit_records = before.profit_records || [];
      }
      
      // 確保 progress_updates 和 change_history 不會被意外覆蓋
      if (updates.progress_updates === undefined) {
        after.progress_updates = before.progress_updates || [];
      }
      if (updates.change_history === undefined) {
        after.change_history = before.change_history || [];
      }

      // Pro360 自動成本管理已移除，改為人工處理

      // 記錄欄位變更
      const fieldChanges = recordFieldChanges(before, after, user.uid, actorName);
      if (fieldChanges.length > 0) {
        after.change_history = [
          ...(after.change_history || []),
          ...fieldChanges
        ].slice(-50);
      }

      // 更新到 API
      await apiRequest(`/api/leads/${id}`, {
        method: 'PUT',
        body: JSON.stringify(after),
      });
      
      await logAction(id, actionType, before, after);
      return;
    } catch (error) {
      console.error('API 更新失敗，降級到 localStorage:', error);
      // 降級到 localStorage
    }
  }

  // localStorage 模式（降級方案）
  const leads = getLeads();
  const index = leads.findIndex(l => l.id === id);
  if (index === -1) return;

  const before = { ...leads[index] };
  // 確保 cost_records 和 profit_records 正確處理
  const after = {
    ...leads[index],
    ...updates,
    last_action_by: actorName,
    updated_at: new Date().toISOString(),
    // 確保 cost_records 和 profit_records 存在
    cost_records: updates.cost_records !== undefined ? updates.cost_records : (before.cost_records || []),
    profit_records: updates.profit_records !== undefined ? updates.profit_records : (before.profit_records || [])
  };

  // Pro360 自動成本管理已移除，改為人工處理

  // 記錄欄位變更
  const fieldChanges = recordFieldChanges(before, after, user.uid, actorName);
  if (fieldChanges.length > 0) {
    after.change_history = [
      ...(after.change_history || []),
      ...fieldChanges
    ].slice(-50);
  }

  leads[index] = after;
  saveLeads(leads);
  await logAction(id, actionType, before, after);
};

// 添加進度更新
export const addProgressUpdate = async (leadId: string, content: string, attachments?: string[]) => {
  const user = auth.currentUser;
  if (!user) throw new Error('Unauthorized');

  const profile = await getUserProfile(user.uid);
  const authorName = profile?.displayName || 'Unknown';
  
  const progressUpdate: ProgressUpdate = {
    id: 'progress_' + Math.random().toString(36).substr(2, 9),
    lead_id: leadId,
    content: content || '',
    author_uid: user.uid,
    author_name: authorName,
    created_at: new Date().toISOString(),
    attachments: attachments && attachments.length > 0 ? attachments : undefined
  };

  // 如果使用 API 模式
  if (useApiMode()) {
    try {
      // 獲取當前案件
      const currentLeads = await fetchLeadsFromApi();
      const lead = currentLeads.find((l: Lead) => l.id === leadId);
      if (!lead) throw new Error('Lead not found');

      // 更新進度
      const updatedProgress = [
        progressUpdate,
        ...(lead.progress_updates || [])
      ].slice(0, 20);

      // 更新到 API
      await apiRequest(`/api/leads/${leadId}`, {
        method: 'PUT',
        body: JSON.stringify({
          progress_updates: updatedProgress
        }),
      });

      await logAction(leadId, AuditAction.UPDATE, lead, { ...lead, progress_updates: updatedProgress });
      return progressUpdate;
    } catch (error) {
      console.error('API 添加進度失敗，降級到 localStorage:', error);
      // 降級到 localStorage
    }
  }

  // localStorage 模式（降級方案）
  const leads = getLeads();
  const index = leads.findIndex(l => l.id === leadId);
  if (index === -1) throw new Error('Lead not found');

  leads[index].progress_updates = [
    progressUpdate,
    ...(leads[index].progress_updates || [])
  ].slice(0, 20);

  saveLeads(leads);
  await logAction(leadId, AuditAction.UPDATE, leads[index], leads[index]);
  return progressUpdate;
};

export const deleteLead = async (id: string) => {
  // 如果使用 API 模式
  if (useApiMode()) {
    try {
      await apiRequest(`/api/leads/${id}`, {
        method: 'DELETE',
      });
      return;
    } catch (error) {
      console.error('API 刪除失敗，降級到 localStorage:', error);
      // 降級到 localStorage
    }
  }

  // localStorage 模式（降級方案）
  const leads = getLeads().filter(l => l.id !== id);
  saveLeads(leads);
};

export const subscribeToLeads = (callback: (leads: Lead[]) => void) => {
  // 如果使用 API 模式，定期輪詢
  if (useApiMode()) {
    const fetchData = async () => {
      try {
        const leads = await fetchLeadsFromApi();
        callback(leads);
      } catch (error) {
        console.error('❌ 獲取資料失敗:', error);
        callback(getLeads()); // 降級到 localStorage
      }
    };

    // 立即獲取一次
    fetchData();
    
    // 每 5 秒輪詢一次
    const interval = setInterval(fetchData, 5000);
    
    return () => clearInterval(interval);
  }

  // localStorage 模式
  const handler = () => {
    const leads = getLeads();
    callback(leads);
  };
  window.addEventListener('leads_updated', handler);
  handler();
  return () => window.removeEventListener('leads_updated', handler);
};

// 添加成本記錄
export const addCostRecord = async (leadId: string, record: Omit<CostRecord, 'id' | 'lead_id' | 'created_at'>) => {
  const user = auth.currentUser;
  if (!user) throw new Error('Unauthorized');
  const profile = await getUserProfile(user.uid);
  const authorName = profile?.displayName || 'Unknown';

  const newRecord: CostRecord = {
    ...record,
    id: 'cost_' + Math.random().toString(36).substr(2, 9),
    lead_id: leadId,
    author_uid: user.uid,
    author_name: authorName,
    created_at: new Date().toISOString(),
  };

  if (useApiMode()) {
    try {
      const currentLeads = await fetchLeadsFromApi();
      console.log('🔍 獲取案件列表，共', currentLeads.length, '筆，尋找案件 ID:', leadId);
      
      const lead = currentLeads.find((l: Lead) => l.id === leadId);
      if (!lead) {
        console.error('❌ 找不到案件:', {
          leadId,
          availableIds: currentLeads.slice(0, 5).map(l => l.id),
          totalLeads: currentLeads.length
        });
        throw new Error(`Lead not found: ${leadId}`);
      }
      
      const updatedCosts = [...(lead.cost_records || []), newRecord];
      
      console.log('📤 發送成本記錄到後端:', {
        leadId,
        leadPlatform: lead.platform,
        leadPlatformId: lead.platform_id,
        costRecord: newRecord,
        currentCostsCount: (lead.cost_records || []).length,
        updatedCostsCount: updatedCosts.length
      });
      
      // 只更新 cost_records，避免覆蓋其他欄位
      const response = await apiRequest(`/api/leads/${leadId}`, {
        method: 'PUT',
        body: JSON.stringify({ 
          cost_records: updatedCosts,
          // 明確指定只更新 cost_records，不更新其他欄位
        }),
      });
      
      console.log('📥 後端回應:', response);
      
      // 驗證後端返回的數據
      if (response && response.cost_records) {
        const responseCostIds = response.cost_records.map((c: CostRecord) => c.id);
        const expectedCostId = newRecord.id;
        if (!responseCostIds.includes(expectedCostId)) {
          console.error('❌ 後端返回的數據中缺少新添加的成本記錄:', {
            expectedId: expectedCostId,
            responseIds: responseCostIds,
            responseCosts: response.cost_records
          });
        }
      }
      
      // 驗證保存是否成功：重新獲取數據確認
      try {
        // 等待一小段時間確保後端已處理完成
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const verifyLeads = await fetchLeadsFromApi();
        const verifyLead = verifyLeads.find((l: Lead) => l.id === leadId);
        if (verifyLead) {
          const savedCosts = verifyLead.cost_records || [];
          const isSaved = savedCosts.some(c => c.id === newRecord.id);
          
          console.log('🔍 驗證成本記錄保存:', {
            leadId,
            caseCode: verifyLead.case_code,
            expectedCostId: newRecord.id,
            savedCostIds: savedCosts.map(c => c.id),
            isSaved,
            totalCosts: savedCosts.length,
            costDetails: savedCosts.map(c => ({ id: c.id, item: c.item_name, amount: c.amount }))
          });
          
          if (isSaved) {
            console.log('✅ 成本記錄已成功保存到後端並驗證:', newRecord);
          } else {
            console.error('❌ 成本記錄未正確保存！', {
              expected: newRecord,
              actual: savedCosts,
              leadStatus: verifyLead.status
            });
            // 如果驗證失敗，拋出錯誤
            throw new Error(`成本記錄保存失敗：後端數據中找不到 ID ${newRecord.id}`);
          }
        } else {
          console.error('❌ 驗證時找不到案件:', leadId);
        }
      } catch (verifyError: any) {
        console.error('❌ 驗證保存時出錯:', verifyError);
        // 如果是驗證失敗，重新拋出錯誤
        if (verifyError.message && verifyError.message.includes('成本記錄保存失敗')) {
          throw verifyError;
        }
        // 其他錯誤只記錄警告
        console.warn('⚠️ 驗證過程出錯，但可能已成功保存:', verifyError);
      }
      
      await logAction(leadId, AuditAction.UPDATE, lead, { ...lead, cost_records: updatedCosts });
      return newRecord;
    } catch (error: any) {
      console.error('❌ API 添加成本記錄失敗:', error);
      console.error('錯誤詳情:', {
        message: error.message,
        name: error.name,
        leadId: leadId,
        stack: error.stack
      });
      
      // 如果是 Quota Exceeded 錯誤，不降級到 localStorage（因為也會失敗）
      if (error.message && (error.message.includes('Quota Exceeded') || error.message.includes('quota'))) {
        throw new Error('瀏覽器儲存空間已滿，無法保存成本記錄。請清理瀏覽器儲存空間或聯繫管理員。');
      }
      
      // 如果是 Lead not found 錯誤，嘗試從 localStorage 獲取
      if (error.message && error.message.includes('Lead not found')) {
        console.warn('⚠️ API 找不到案件，嘗試從 localStorage 獲取');
        const localLeads = getLeads();
        const localLead = localLeads.find(l => l.id === leadId);
        if (localLead) {
          console.log('✅ 在 localStorage 中找到案件，使用 localStorage 保存');
          // 繼續執行 localStorage 模式
        } else {
          throw new Error(`找不到案件 ID: ${leadId}。請確認案件是否存在。`);
        }
      } else {
        // 其他錯誤：嘗試降級到 localStorage
        console.warn('⚠️ 嘗試降級到 localStorage 模式');
      }
    }
  }

  // localStorage 模式（降級方案）
  try {
    const leads = getLeads();
    const index = leads.findIndex(l => l.id === leadId);
    if (index === -1) {
      console.error('❌ localStorage 中也找不到案件:', {
        leadId,
        availableIds: leads.slice(0, 5).map(l => l.id),
        totalLeads: leads.length
      });
      throw new Error(`找不到案件 ID: ${leadId}。請確認案件是否存在。`);
    }
    leads[index].cost_records = [...(leads[index].cost_records || []), newRecord];
    saveLeads(leads);
    await logAction(leadId, AuditAction.UPDATE, leads[index], leads[index]);
    console.log('✅ 成本記錄已保存到 localStorage:', newRecord);
    return newRecord;
  } catch (error: any) {
    console.error('❌ localStorage 保存失敗:', error);
    // 如果是 Quota Exceeded，拋出明確錯誤
    if (error.message && (error.message.includes('Quota Exceeded') || error.message.includes('quota'))) {
      throw new Error('瀏覽器儲存空間已滿，無法保存成本記錄。請清理瀏覽器儲存空間或聯繫管理員。');
    }
    throw error;
  }
};

// 刪除成本記錄
export const deleteCostRecord = async (leadId: string, costId: string) => {
  if (useApiMode()) {
    try {
      const currentLeads = await fetchLeadsFromApi();
      const lead = currentLeads.find((l: Lead) => l.id === leadId);
      if (!lead) throw new Error('Lead not found');
      const updatedCosts = (lead.cost_records || []).filter(c => c.id !== costId);
      await apiRequest(`/api/leads/${leadId}`, {
        method: 'PUT',
        body: JSON.stringify({ cost_records: updatedCosts }),
      });
      await logAction(leadId, AuditAction.UPDATE, lead, { ...lead, cost_records: updatedCosts });
      return;
    } catch (error) {
      console.error('API 刪除成本記錄失敗:', error);
    }
  }

  const leads = getLeads();
  const index = leads.findIndex(l => l.id === leadId);
  if (index === -1) throw new Error('Lead not found');
  leads[index].cost_records = (leads[index].cost_records || []).filter(c => c.id !== costId);
  saveLeads(leads);
  await logAction(leadId, AuditAction.UPDATE, leads[index], leads[index]);
};

// 添加利潤記錄
export const addProfitRecord = async (leadId: string, record: Omit<ProfitRecord, 'id' | 'lead_id' | 'created_at'>) => {
  const user = auth.currentUser;
  if (!user) throw new Error('Unauthorized');
  const profile = await getUserProfile(user.uid);
  const authorName = profile?.displayName || 'Unknown';

  const newRecord: ProfitRecord = {
    ...record,
    id: 'profit_' + Math.random().toString(36).substr(2, 9),
    lead_id: leadId,
    author_uid: user.uid,
    author_name: authorName,
    created_at: new Date().toISOString(),
  };

  if (useApiMode()) {
    try {
      const currentLeads = await fetchLeadsFromApi();
      const lead = currentLeads.find((l: Lead) => l.id === leadId);
      if (!lead) throw new Error('Lead not found');
      const updatedProfits = [...(lead.profit_records || []), newRecord];
      await apiRequest(`/api/leads/${leadId}`, {
        method: 'PUT',
        body: JSON.stringify({ profit_records: updatedProfits }),
      });
      await logAction(leadId, AuditAction.UPDATE, lead, { ...lead, profit_records: updatedProfits });
      return newRecord;
    } catch (error) {
      console.error('API 添加利潤記錄失敗:', error);
    }
  }

  const leads = getLeads();
  const index = leads.findIndex(l => l.id === leadId);
  if (index === -1) throw new Error('Lead not found');
  leads[index].profit_records = [...(leads[index].profit_records || []), newRecord];
  saveLeads(leads);
  await logAction(leadId, AuditAction.UPDATE, leads[index], leads[index]);
  return newRecord;
};

// 刪除利潤記錄
export const deleteProfitRecord = async (leadId: string, profitId: string) => {
  if (useApiMode()) {
    try {
      const currentLeads = await fetchLeadsFromApi();
      const lead = currentLeads.find((l: Lead) => l.id === leadId);
      if (!lead) throw new Error('Lead not found');
      const updatedProfits = (lead.profit_records || []).filter(p => p.id !== profitId);
      await apiRequest(`/api/leads/${leadId}`, {
        method: 'PUT',
        body: JSON.stringify({ profit_records: updatedProfits }),
      });
      await logAction(leadId, AuditAction.UPDATE, lead, { ...lead, profit_records: updatedProfits });
      return;
    } catch (error) {
      console.error('API 刪除利潤記錄失敗:', error);
    }
  }

  const leads = getLeads();
  const index = leads.findIndex(l => l.id === leadId);
  if (index === -1) throw new Error('Lead not found');
  leads[index].profit_records = (leads[index].profit_records || []).filter(p => p.id !== profitId);
  saveLeads(leads);
  await logAction(leadId, AuditAction.UPDATE, leads[index], leads[index]);
};
