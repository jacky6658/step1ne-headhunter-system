import React, { useMemo, useState } from 'react';
import { Lead, UserProfile, Role, CostRecord, ProfitRecord, Decision, LeadStatus } from '../types';
import { DollarSign, TrendingUp, TrendingDown, BarChart3, PieChart, CheckCircle, XCircle, PlayCircle } from 'lucide-react';
import CaseFinancialDetailModal from '../components/CaseFinancialDetailModal';

interface AnalyticsPageProps {
  leads: Lead[];
  userProfile: UserProfile;
}

const AnalyticsPage: React.FC<AnalyticsPageProps> = ({ leads, userProfile }) => {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // 計算案件統計
  const dashboardStats = useMemo(() => {
    const cancelled = leads.filter(l => l.status === LeadStatus.CANCELLED).length;
    const declined = leads.filter(l => l.status === LeadStatus.DECLINED).length;
    const accepted = leads.filter(l => l.decision === Decision.ACCEPT).length;
    const inProgress = leads.filter(l => 
      l.status === LeadStatus.IN_PROGRESS || 
      l.status === LeadStatus.QUOTING || 
      l.status === LeadStatus.CONTACTED
    ).length;
    
    return { cancelled, declined, accepted, inProgress, total: leads.length };
  }, [leads]);

  // 計算總成本和總利潤（排除取消的案件，但包含婉拒的案件）
  const analytics = useMemo(() => {
    let totalCost = 0;
    let totalProfit = 0;
    const costByLead: Record<string, number> = {};
    const profitByLead: Record<string, number> = {};
    const costByItem: Record<string, number> = {};
    const profitByItem: Record<string, number> = {};

    // 過濾掉取消的案件，但保留婉拒的案件（因為婉拒的案件有成本）
    const activeLeads = leads.filter(lead => lead.status !== LeadStatus.CANCELLED);

    activeLeads.forEach(lead => {
      let leadCost = 0;
      let leadProfit = 0;

      // 計算成本
      if (lead.cost_records) {
        lead.cost_records.forEach((record: CostRecord) => {
          leadCost += record.amount;
          totalCost += record.amount;
          costByItem[record.item_name] = (costByItem[record.item_name] || 0) + record.amount;
        });
      }

      // 計算利潤
      if (lead.profit_records) {
        lead.profit_records.forEach((record: ProfitRecord) => {
          leadProfit += record.amount;
          totalProfit += record.amount;
          profitByItem[record.item_name] = (profitByItem[record.item_name] || 0) + record.amount;
        });
      }

      if (leadCost > 0) costByLead[lead.platform_id] = leadCost;
      if (leadProfit > 0) profitByLead[lead.platform_id] = leadProfit;
    });

    const netProfit = totalProfit - totalCost;
    const profitMargin = totalProfit > 0 ? ((netProfit / totalProfit) * 100).toFixed(1) : '0';

    return {
      totalCost,
      totalProfit,
      netProfit,
      profitMargin,
      costByLead,
      profitByLead,
      costByItem,
      profitByItem,
      leadsWithCosts: Object.keys(costByLead).length,
      leadsWithProfits: Object.keys(profitByLead).length
    };
  }, [leads]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* 標題 */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 p-8">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-2xl flex items-center justify-center shadow-lg">
            <BarChart3 size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-gray-900">管理儀表板</h2>
            <p className="text-sm text-gray-500 mt-1">案件統計、財務分析與數據圖表</p>
          </div>
        </div>
      </div>

      {/* 案件統計儀表板 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* 總案件數 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center">
              <BarChart3 size={24} className="text-indigo-600" />
            </div>
          </div>
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-2">總案件數</h3>
          <p className="text-3xl font-black text-indigo-600">{dashboardStats.total}</p>
          <p className="text-xs text-slate-400 mt-2">所有案件</p>
        </div>

        {/* 接受案件 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center">
              <CheckCircle size={24} className="text-green-600" />
            </div>
          </div>
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-2">接受案件</h3>
          <p className="text-3xl font-black text-green-600">{dashboardStats.accepted}</p>
          <p className="text-xs text-slate-400 mt-2">
            {dashboardStats.total > 0 ? ((dashboardStats.accepted / dashboardStats.total) * 100).toFixed(1) : '0'}% 接受率
          </p>
        </div>

        {/* 取消案件 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center">
              <XCircle size={24} className="text-red-600" />
            </div>
          </div>
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-2">取消案件</h3>
          <p className="text-3xl font-black text-red-600">{dashboardStats.cancelled}</p>
          <p className="text-xs text-slate-400 mt-2">
            {dashboardStats.total > 0 ? ((dashboardStats.cancelled / dashboardStats.total) * 100).toFixed(1) : '0'}% 取消率
          </p>
        </div>
        
        {/* 婉拒/無法聯繫案件 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center">
              <XCircle size={24} className="text-orange-600" />
            </div>
          </div>
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-2">婉拒/無法聯繫</h3>
          <p className="text-3xl font-black text-orange-600">{dashboardStats.declined}</p>
          <p className="text-xs text-slate-400 mt-2">
            {dashboardStats.total > 0 ? ((dashboardStats.declined / dashboardStats.total) * 100).toFixed(1) : '0'}% 婉拒率
          </p>
          <p className="text-[10px] text-slate-500 mt-2">已使用 Pro360 索取個資</p>
        </div>

        {/* 正在執行 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
              <PlayCircle size={24} className="text-blue-600" />
            </div>
          </div>
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-2">正在執行</h3>
          <p className="text-3xl font-black text-blue-600">{dashboardStats.inProgress}</p>
          <p className="text-xs text-slate-400 mt-2">進行中的案件</p>
        </div>
      </div>

      {/* 總覽卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* 總成本 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center">
              <TrendingDown size={24} className="text-red-600" />
            </div>
          </div>
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-2">總成本</h3>
          <p className="text-3xl font-black text-red-600">${analytics.totalCost.toLocaleString()}</p>
          <p className="text-xs text-slate-400 mt-2">{analytics.leadsWithCosts} 個案件有成本記錄</p>
        </div>

        {/* 總利潤 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center">
              <TrendingUp size={24} className="text-green-600" />
            </div>
          </div>
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-2">總利潤</h3>
          <p className="text-3xl font-black text-green-600">${analytics.totalProfit.toLocaleString()}</p>
          <p className="text-xs text-slate-400 mt-2">{analytics.leadsWithProfits} 個案件有利潤記錄</p>
        </div>

        {/* 淨利潤 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${analytics.netProfit >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
              <DollarSign size={24} className={analytics.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'} />
            </div>
          </div>
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-2">淨利潤</h3>
          <p className={`text-3xl font-black ${analytics.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            ${analytics.netProfit.toLocaleString()}
          </p>
          <p className="text-xs text-slate-400 mt-2">利潤 - 成本</p>
        </div>

        {/* 利潤率 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center">
              <PieChart size={24} className="text-indigo-600" />
            </div>
          </div>
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-2">利潤率</h3>
          <p className={`text-3xl font-black ${parseFloat(analytics.profitMargin) >= 0 ? 'text-indigo-600' : 'text-red-600'}`}>
            {analytics.profitMargin}%
          </p>
          <p className="text-xs text-slate-400 mt-2">淨利潤 / 總利潤</p>
        </div>
      </div>

      {/* 案件成本利潤列表 */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-lg font-black text-gray-900">各案件成本與利潤</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest">案件名稱</th>
                <th className="px-6 py-4 text-right text-xs font-black text-slate-400 uppercase tracking-widest">成本</th>
                <th className="px-6 py-4 text-right text-xs font-black text-slate-400 uppercase tracking-widest">利潤</th>
                <th className="px-6 py-4 text-right text-xs font-black text-slate-400 uppercase tracking-widest">淨利潤</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {leads
                .filter(lead => lead.status !== LeadStatus.CANCELLED) // 過濾掉取消的案件，但保留婉拒的案件
                .map(lead => {
                const leadCost = (lead.cost_records || []).reduce((sum, r) => sum + r.amount, 0);
                const leadProfit = (lead.profit_records || []).reduce((sum, r) => sum + r.amount, 0);
                const leadNet = leadProfit - leadCost;
                
                if (leadCost === 0 && leadProfit === 0) return null;
                
                return (
                  <tr 
                    key={lead.id} 
                    className="hover:bg-slate-50 cursor-pointer"
                    onClick={() => {
                      setSelectedLead(lead);
                      setIsDetailModalOpen(true);
                    }}
                  >
                    <td className="px-6 py-4">
                      <div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLead(lead);
                            setIsDetailModalOpen(true);
                          }}
                          className="text-sm font-bold text-slate-900 hover:text-indigo-600 transition-colors text-left cursor-pointer"
                        >
                          {lead.case_code ? `${lead.case_code} - ` : ''}{lead.platform_id}
                        </button>
                        <p className="text-xs text-slate-400">{lead.platform}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-bold text-red-600">
                        {leadCost > 0 ? `$${leadCost.toLocaleString()}` : '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-bold text-green-600">
                        {leadProfit > 0 ? `$${leadProfit.toLocaleString()}` : '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`text-sm font-black ${leadNet >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        ${leadNet.toLocaleString()}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {leads.every(lead => {
                const cost = (lead.cost_records || []).reduce((sum, r) => sum + r.amount, 0);
                const profit = (lead.profit_records || []).reduce((sum, r) => sum + r.amount, 0);
                return cost === 0 && profit === 0;
              }) && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                    尚無成本或利潤記錄
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 成本名目分析 */}
      {Object.keys(analytics.costByItem).length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-black text-gray-900 mb-4">成本名目分析</h3>
          <div className="space-y-3">
            {Object.entries(analytics.costByItem)
              .sort(([, a], [, b]) => b - a)
              .map(([item, amount]) => {
                const percentage = analytics.totalCost > 0 ? ((amount / analytics.totalCost) * 100).toFixed(1) : '0.0';
                return (
                  <div key={item} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-700">{item}</span>
                      <span className="text-sm font-black text-red-600">${amount.toLocaleString()} ({percentage}%)</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-red-500 h-2 rounded-full transition-all"
                        style={{ width: `${Math.min(parseFloat(percentage), 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* 利潤名目分析 */}
      {Object.keys(analytics.profitByItem).length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-black text-gray-900 mb-4">利潤名目分析</h3>
          <div className="space-y-3">
            {Object.entries(analytics.profitByItem)
              .sort(([, a], [, b]) => b - a)
              .map(([item, amount]) => {
                const percentage = analytics.totalProfit > 0 ? ((amount / analytics.totalProfit) * 100).toFixed(1) : '0.0';
                return (
                  <div key={item} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-700">{item}</span>
                      <span className="text-sm font-black text-green-600">${amount.toLocaleString()} ({percentage}%)</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full transition-all"
                        style={{ width: `${Math.min(parseFloat(percentage), 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* 案件財務詳細視圖 */}
      <CaseFinancialDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedLead(null);
        }}
        lead={selectedLead}
      />
    </div>
  );
};

export default AnalyticsPage;
