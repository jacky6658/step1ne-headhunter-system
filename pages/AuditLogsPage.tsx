
import React, { useState, useEffect } from 'react';
import { Lead, UserProfile, AuditLog } from '../types';
import { fetchLogs } from '../services/auditService';
import { History, User, FileText } from 'lucide-react';

interface AuditLogsPageProps {
  leads: Lead[];
  userProfile: UserProfile;
}

const AuditLogsPage: React.FC<AuditLogsPageProps> = ({ leads }) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadLogs = async () => {
      const data = await fetchLogs();
      setLogs(data);
      setLoading(false);
    };
    loadLogs();
  }, []);

  const getLeadIdentifier = (id: string) => {
    const lead = leads.find(l => l.id === id);
    return lead ? `${lead.platform} - ${lead.platform_id}` : id.substring(0, 8);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">時間</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">執行者</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">案件</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">動作</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">變更細節</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500 font-mono">
                    {new Date(log.created_at).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center">
                        <User size={12} className="text-indigo-600" />
                      </div>
                      <span className="text-sm font-medium text-gray-900">{log.actor_name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <FileText size={14} className="text-gray-400" />
                      <span className="text-sm text-gray-700">{getLeadIdentifier(log.lead_id)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest ${
                      log.action === 'CREATE' ? 'bg-green-100 text-green-700' :
                      log.action === 'UPDATE' ? 'bg-blue-100 text-blue-700' :
                      log.action === 'DECISION' ? 'bg-purple-100 text-purple-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs text-gray-500 max-w-xs truncate">
                      {log.after ? Object.keys(log.after).join(', ') : '-'}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading && (
            <div className="p-8 text-center text-gray-400">載入中...</div>
          )}
          {!loading && logs.length === 0 && (
            <div className="p-20 text-center">
              <div className="mx-auto w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                <History size={24} className="text-gray-300" />
              </div>
              <p className="text-gray-500 text-sm">尚無操作紀錄</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuditLogsPage;
