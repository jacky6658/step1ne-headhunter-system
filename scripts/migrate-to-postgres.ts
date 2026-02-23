/**
 * 資料遷移腳本：將 localStorage 資料遷移到 PostgreSQL
 * 
 * 使用方式：
 * 1. 在瀏覽器控制台執行此腳本
 * 2. 或使用 Node.js 執行：npx tsx scripts/migrate-to-postgres.ts
 */

// PostgreSQL 連接配置（從環境變數或直接設置）
const DB_CONFIG = {
  host: process.env.DB_HOST || 'tpe1.clusters.zeabur.com',
  port: parseInt(process.env.DB_PORT || '22704'),
  database: process.env.DB_NAME || 'zeabur',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '4if5Z3c87KolJ0Wnp1VIEbjmLC6X92FM',
};

// 從 localStorage 讀取資料
const getLocalStorageData = () => {
  const leads = JSON.parse(localStorage.getItem('caseflow_leads_db') || '[]');
  const users = JSON.parse(localStorage.getItem('caseflow_users_db') || '{}');
  const auditLogs = JSON.parse(localStorage.getItem('caseflow_audit_db') || '[]');
  
  return { leads, users, auditLogs };
};

// 生成 SQL 插入語句
const generateInsertSQL = (data: any, tableName: string, columns: string[]) => {
  if (data.length === 0) return [];
  
  const values = data.map((item: any) => {
    const row = columns.map(col => {
      const value = item[col];
      if (value === null || value === undefined) return 'NULL';
      if (typeof value === 'string') {
        // 轉義單引號
        return `'${value.replace(/'/g, "''")}'`;
      }
      if (typeof value === 'object') {
        // JSON 物件轉為 JSON 字串
        return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
      }
      return value;
    });
    return `(${row.join(', ')})`;
  });
  
  return `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES ${values.join(',\n  ')} ON CONFLICT DO NOTHING;`;
};

// 遷移使用者資料
const migrateUsers = (users: Record<string, any>) => {
  const userList = Object.values(users);
  if (userList.length === 0) return [];
  
  const columns = ['id', 'email', 'display_name', 'role', 'avatar', 'status', 'created_at'];
  const userData = userList.map((user: any) => ({
    id: user.uid,
    email: user.email || '',
    display_name: user.displayName || '',
    role: user.role || 'REVIEWER',
    avatar: user.avatar || null,
    status: user.status || null,
    created_at: user.createdAt || new Date().toISOString(),
  }));
  
  return generateInsertSQL(userData, 'users', columns);
};

// 遷移案件資料
const migrateLeads = (leads: any[]) => {
  if (leads.length === 0) return [];
  
  const columns = [
    'id', 'platform', 'platform_id', 'need', 'budget_text', 'posted_at',
    'phone', 'email', 'location', 'note', 'internal_remarks', 'remarks_author',
    'status', 'decision', 'decision_by', 'reject_reason', 'review_note',
    'assigned_to', 'assigned_to_name', 'priority', 'created_by', 'created_by_name',
    'created_at', 'updated_at', 'last_action_by',
    'progress_updates', 'change_history'
  ];
  
  const leadData = leads.map((lead: any) => ({
    id: lead.id,
    platform: lead.platform || 'FB',
    platform_id: lead.platform_id || '',
    need: lead.need || '',
    budget_text: lead.budget_text || null,
    posted_at: lead.posted_at || null,
    phone: lead.phone || null,
    email: lead.email || null,
    location: lead.location || null,
    note: lead.note || null,
    internal_remarks: lead.internal_remarks || null,
    remarks_author: lead.remarks_author || null,
    status: lead.status || '待篩選',
    decision: lead.decision || 'pending',
    decision_by: lead.decision_by || null,
    reject_reason: lead.reject_reason || null,
    review_note: lead.review_note || null,
    assigned_to: lead.assigned_to || null,
    assigned_to_name: lead.assigned_to_name || null,
    priority: lead.priority || 3,
    created_by: lead.created_by || null,
    created_by_name: lead.created_by_name || '',
    created_at: lead.created_at || new Date().toISOString(),
    updated_at: lead.updated_at || new Date().toISOString(),
    last_action_by: lead.last_action_by || null,
    progress_updates: lead.progress_updates ? JSON.stringify(lead.progress_updates) : null,
    change_history: lead.change_history ? JSON.stringify(lead.change_history) : null,
  }));
  
  return generateInsertSQL(leadData, 'leads', columns);
};

// 遷移審計日誌
const migrateAuditLogs = (auditLogs: any[]) => {
  if (auditLogs.length === 0) return [];
  
  const columns = ['id', 'lead_id', 'actor_uid', 'actor_name', 'action', 'before', 'after', 'created_at'];
  const logData = auditLogs.map((log: any) => ({
    id: log.id,
    lead_id: log.lead_id,
    actor_uid: log.actor_uid,
    actor_name: log.actor_name,
    action: log.action,
    before: log.before ? JSON.stringify(log.before) : null,
    after: log.after ? JSON.stringify(log.after) : null,
    created_at: log.created_at || new Date().toISOString(),
  }));
  
  return generateInsertSQL(logData, 'audit_logs', columns);
};

// 主遷移函數
export const migrateToPostgreSQL = () => {
  console.log('開始遷移資料...');
  
  const { leads, users, auditLogs } = getLocalStorageData();
  
  console.log(`找到 ${Object.keys(users).length} 個使用者`);
  console.log(`找到 ${leads.length} 筆案件`);
  console.log(`找到 ${auditLogs.length} 筆審計日誌`);
  
  const sqlStatements: string[] = [];
  
  // 生成 SQL 語句
  const usersSQL = migrateUsers(users);
  if (usersSQL) sqlStatements.push(usersSQL);
  
  const leadsSQL = migrateLeads(leads);
  if (leadsSQL) sqlStatements.push(leadsSQL);
  
  const auditLogsSQL = migrateAuditLogs(auditLogs);
  if (auditLogsSQL) sqlStatements.push(auditLogsSQL);
  
  const fullSQL = sqlStatements.join('\n\n');
  
  console.log('遷移 SQL 已生成！');
  console.log('請將以下 SQL 語句複製到您的 PostgreSQL 資料庫執行：');
  console.log('\n' + '='.repeat(80));
  console.log(fullSQL);
  console.log('='.repeat(80));
  
  return fullSQL;
};

// 如果在瀏覽器環境中執行
if (typeof window !== 'undefined') {
  (window as any).migrateToPostgreSQL = migrateToPostgreSQL;
  console.log('遷移函數已載入！在控制台執行 migrateToPostgreSQL() 即可生成遷移 SQL');
}
