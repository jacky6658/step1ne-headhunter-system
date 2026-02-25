import React, { useState } from 'react';
import { Database, Download, Upload, CheckCircle, AlertCircle, Zap, Link } from 'lucide-react';
import { apiRequest, useApiMode } from '../services/apiConfig';
import { apiPost } from '../config/api';

interface MigrationPageProps {
  userProfile: any;
}

const MigrationPage: React.FC<MigrationPageProps> = ({ userProfile }) => {
  const [migrationSQL, setMigrationSQL] = useState<string>('');
  const [status, setStatus] = useState<'idle' | 'generating' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string>('');
  const [linkMigStatus, setLinkMigStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [linkMigResult, setLinkMigResult] = useState<any>(null);

  // 從 localStorage 讀取資料
  const getLocalStorageData = () => {
    const leads = JSON.parse(localStorage.getItem('caseflow_leads_db') || '[]');
    const users = JSON.parse(localStorage.getItem('caseflow_users_db') || '{}');
    const auditLogs = JSON.parse(localStorage.getItem('caseflow_audit_db') || '[]');
    return { leads, users, auditLogs };
  };

  // 生成 SQL 插入語句
  const generateInsertSQL = (data: any[], tableName: string, columns: string[]) => {
    if (data.length === 0) return '';
    
    const values = data.map((item: any) => {
      const row = columns.map(col => {
        const value = item[col];
        if (value === null || value === undefined) return 'NULL';
        if (typeof value === 'string') {
          return `'${value.replace(/'/g, "''")}'`;
        }
        if (typeof value === 'object') {
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
    if (userList.length === 0) return '';
    
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
    if (leads.length === 0) return '';
    
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
    if (auditLogs.length === 0) return '';
    
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

  // 生成遷移 SQL
  const handleGenerateSQL = () => {
    setStatus('generating');
    setMessage('');
    
    try {
      const { leads, users, auditLogs } = getLocalStorageData();
      
      const stats = {
        users: Object.keys(users).length,
        leads: leads.length,
        auditLogs: auditLogs.length,
      };
      
      const sqlStatements: string[] = [];
      
      const usersSQL = migrateUsers(users);
      if (usersSQL) sqlStatements.push(usersSQL);
      
      const leadsSQL = migrateLeads(leads);
      if (leadsSQL) sqlStatements.push(leadsSQL);
      
      const auditLogsSQL = migrateAuditLogs(auditLogs);
      if (auditLogsSQL) sqlStatements.push(auditLogsSQL);
      
      const fullSQL = sqlStatements.join('\n\n');
      
      setMigrationSQL(fullSQL);
      setStatus('success');
      setMessage(`成功生成遷移 SQL！包含 ${stats.users} 個使用者、${stats.leads} 筆案件、${stats.auditLogs} 筆審計日誌`);
    } catch (error: any) {
      setStatus('error');
      setMessage(`生成失敗：${error.message}`);
    }
  };

  // 複製 SQL 到剪貼簿
  const handleCopySQL = () => {
    navigator.clipboard.writeText(migrationSQL);
    setMessage('SQL 已複製到剪貼簿！');
    setTimeout(() => setMessage(''), 2000);
  };

  // 下載 SQL 文件
  const handleDownloadSQL = () => {
    const blob = new Blob([migrationSQL], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `migration_${new Date().toISOString().split('T')[0]}.sql`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage('SQL 文件已下載！');
    setTimeout(() => setMessage(''), 2000);
  };

  // 從舊欄位提取 LinkedIn / GitHub 連結
  const handleExtractLinks = async () => {
    setLinkMigStatus('running');
    setLinkMigResult(null);
    try {
      const result = await apiPost('/api/migrate/extract-links', {});
      setLinkMigResult(result);
      setLinkMigStatus('done');
    } catch (err: any) {
      setLinkMigResult({ error: err.message });
      setLinkMigStatus('error');
    }
  };

  // 自動匯入到資料庫
  const handleAutoMigrate = async () => {
    if (!useApiMode()) {
      setStatus('error');
      setMessage('❌ 自動匯入需要設置 VITE_API_URL 環境變數！請在 Zeabur 前端服務中設置環境變數後重新部署。');
      return;
    }

    setStatus('generating');
    setMessage('正在讀取本地資料...');

    try {
      const { leads, users, auditLogs } = getLocalStorageData();
      
      const stats = {
        users: Object.keys(users).length,
        leads: leads.length,
        auditLogs: auditLogs.length,
      };

      if (stats.users === 0 && stats.leads === 0 && stats.auditLogs === 0) {
        setStatus('error');
        setMessage('❌ 本地沒有資料可遷移！');
        return;
      }

      setMessage(`正在匯入 ${stats.users} 個使用者、${stats.leads} 筆案件、${stats.auditLogs} 筆審計日誌...`);

      const result = await apiRequest('/api/migrate', {
        method: 'POST',
        body: JSON.stringify({ users, leads, auditLogs }),
      });

      if (result.success) {
        setStatus('success');
        setMessage(`✅ ${result.message}`);
        
        // 3 秒後自動重新載入頁面以顯示新資料
        setTimeout(() => {
          window.location.reload();
        }, 3000);
      } else {
        setStatus('error');
        setMessage(`❌ 匯入失敗：${result.error || '未知錯誤'}`);
      }
    } catch (error: any) {
      setStatus('error');
      setMessage(`❌ 匯入失敗：${error.message || '請檢查後端連接和資料庫狀態'}`);
      console.error('自動匯入失敗:', error);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 p-8">
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 bg-indigo-50 rounded-2xl">
            <Database size={24} className="text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900">資料遷移到 PostgreSQL</h1>
            <p className="text-sm text-slate-400 font-bold uppercase tracking-widest mt-1">
              將本地 localStorage 資料同步到雲端資料庫
            </p>
          </div>
        </div>

        {/* 說明 */}
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-6 mb-8">
          <h3 className="font-black text-green-900 mb-3 flex items-center gap-2">
            <Zap size={18} />
            快速自動匯入（推薦）
          </h3>
          <p className="text-sm text-green-800 mb-4">
            點擊「⚡ 一鍵自動匯入」按鈕，系統會自動將<strong>當前瀏覽器本地</strong>的資料匯入到雲端資料庫，無需手動執行 SQL！
          </p>
          <div className="bg-white rounded-xl p-4 border border-green-200 mb-3">
            <p className="text-xs text-green-700 font-bold mb-2">📋 使用條件：</p>
            <ul className="list-disc list-inside space-y-1 text-xs text-green-800">
              <li>已設置 <code className="bg-green-100 px-1 rounded">VITE_API_URL</code> 環境變數</li>
              <li>後端服務已正常運行並連接到資料庫</li>
              <li>資料表已建立（如果沒有，請先執行下方的建表語句）</li>
            </ul>
          </div>
          <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
            <p className="text-xs text-amber-700 font-bold mb-2">⚠️ 重要提醒：</p>
            <ul className="list-disc list-inside space-y-1 text-xs text-amber-800">
              <li>匯入的是<strong>當前瀏覽器本地</strong>保存的資料，不是雲端資料庫的資料</li>
              <li>如果雲端已有相同 ID 的案件，會<strong>跳過不覆蓋</strong>（使用 ON CONFLICT DO NOTHING）</li>
              <li>如果雲端有新案件但本地沒有，這些案件<strong>不會被匯入</strong></li>
              <li>建議在首次部署時使用，後續直接在雲端操作即可</li>
            </ul>
          </div>
        </div>

        {/* 手動匯入說明 */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 mb-8">
          <h3 className="font-black text-blue-900 mb-3 flex items-center gap-2">
            <AlertCircle size={18} />
            手動匯入方式（備用）
          </h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
            <li>首先在您的 PostgreSQL 資料庫執行建表語句（見下方）</li>
            <li>點擊「生成遷移 SQL」按鈕，系統會讀取本地 localStorage 資料</li>
            <li>複製生成的 SQL 語句，在資料庫中執行</li>
            <li>執行完成後，您的本地資料就會同步到雲端資料庫</li>
          </ol>
        </div>

        {/* LinkedIn / GitHub 連結提取區塊 */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-6 mb-8">
          <h3 className="font-black text-blue-900 mb-2 flex items-center gap-2">
            <Link size={18} />
            提取外部連結（LinkedIn / GitHub）
          </h3>
          <p className="text-sm text-blue-800 mb-4">
            掃描現有候選人資料，將儲存在 <code className="bg-white px-1 rounded">phone</code> 或 <code className="bg-white px-1 rounded">contact_link</code> 欄位中的
            LinkedIn / GitHub 連結，自動填入對應的專屬欄位。只會更新空白欄位，不覆蓋已有資料。
          </p>
          <button
            onClick={handleExtractLinks}
            disabled={linkMigStatus === 'running'}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-black hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center gap-2"
          >
            <Link size={16} />
            {linkMigStatus === 'running' ? '提取中...' : '🔗 開始提取連結'}
          </button>

          {linkMigStatus === 'done' && linkMigResult && (
            <div className="mt-4 p-4 bg-white rounded-xl border border-blue-200">
              <p className="font-bold text-emerald-700 mb-2">
                ✅ {linkMigResult.message}（共掃描 {linkMigResult.total_scanned} 筆）
              </p>
              {linkMigResult.details && linkMigResult.details.length > 0 && (
                <div className="text-xs text-slate-600 space-y-1 max-h-48 overflow-y-auto">
                  {linkMigResult.details.map((d: any) => (
                    <div key={d.id} className="flex gap-2 border-b border-slate-100 py-1">
                      <span className="text-slate-400">#{d.id}</span>
                      <span className="font-semibold">{d.name}</span>
                      {d.linkedin && <span className="text-blue-600 truncate">LinkedIn: {d.linkedin}</span>}
                      {d.github   && <span className="text-gray-700 truncate">GitHub: {d.github}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {linkMigStatus === 'error' && (
            <div className="mt-4 p-3 bg-red-50 rounded-xl border border-red-200 text-sm text-red-700">
              ❌ 提取失敗：{linkMigResult?.error || '請檢查後端連線'}
            </div>
          )}
        </div>

        {/* 操作按鈕 */}
        <div className="flex flex-wrap gap-4 mb-6">
          {/* 自動匯入按鈕（優先顯示） */}
          <button
            onClick={handleAutoMigrate}
            disabled={status === 'generating'}
            className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-black hover:from-green-700 hover:to-emerald-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg"
          >
            <Zap size={18} />
            {status === 'generating' ? '匯入中...' : '⚡ 一鍵自動匯入'}
          </button>

          <button
            onClick={handleGenerateSQL}
            disabled={status === 'generating'}
            className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-black hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2"
          >
            <Database size={18} />
            {status === 'generating' ? '生成中...' : '生成遷移 SQL'}
          </button>
          
          {migrationSQL && (
            <>
              <button
                onClick={handleCopySQL}
                className="px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-black hover:bg-slate-200 transition-all flex items-center gap-2"
              >
                <Upload size={18} />
                複製 SQL
              </button>
              <button
                onClick={handleDownloadSQL}
                className="px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-black hover:bg-slate-200 transition-all flex items-center gap-2"
              >
                <Download size={18} />
                下載 SQL 文件
              </button>
            </>
          )}
        </div>

        {/* 狀態訊息 */}
        {message && (
          <div className={`mb-6 p-4 rounded-xl flex items-center gap-2 ${
            status === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'
          }`}>
            {status === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
            <span className="font-bold">{message}</span>
          </div>
        )}

        {/* SQL 顯示區域 */}
        {migrationSQL && (
          <div className="space-y-4">
            <div className="bg-slate-900 rounded-2xl p-6 overflow-x-auto">
              <pre className="text-sm text-slate-100 font-mono whitespace-pre-wrap">
                {migrationSQL}
              </pre>
            </div>
          </div>
        )}

        {/* 建表語句 */}
        <div className="mt-8">
          <h3 className="font-black text-slate-900 mb-4">PostgreSQL 建表語句</h3>
          <div className="bg-slate-50 rounded-2xl p-6 overflow-x-auto">
            <pre className="text-sm text-slate-800 font-mono whitespace-pre-wrap">
{`-- 啟用 UUID 擴展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. 使用者表
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT CHECK (role IN ('ADMIN', 'REVIEWER')) DEFAULT 'REVIEWER',
  avatar TEXT,
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 案件表
CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL DEFAULT 'FB',
  platform_id TEXT,
  need TEXT NOT NULL,
  budget_text TEXT,
  posted_at TIMESTAMPTZ,
  phone TEXT,
  email TEXT,
  location TEXT,
  note TEXT,
  internal_remarks TEXT,
  remarks_author TEXT,
  status TEXT DEFAULT '待篩選',
  decision TEXT DEFAULT 'pending',
  decision_by TEXT,
  reject_reason TEXT,
  review_note TEXT,
  assigned_to TEXT,
  assigned_to_name TEXT,
  priority INTEGER DEFAULT 3,
  created_by TEXT,
  created_by_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_action_by TEXT,
  progress_updates JSONB,
  change_history JSONB
);

-- 3. 審計日誌表
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  lead_id TEXT REFERENCES leads(id) ON DELETE CASCADE,
  actor_uid TEXT,
  actor_name TEXT NOT NULL,
  action TEXT NOT NULL,
  before JSONB,
  after JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);
CREATE INDEX IF NOT EXISTS idx_leads_created_by ON leads(created_by);
CREATE INDEX IF NOT EXISTS idx_audit_logs_lead_id ON audit_logs(lead_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- 建立更新時間自動更新觸發器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MigrationPage;
