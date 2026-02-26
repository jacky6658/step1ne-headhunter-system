import React from 'react';
import { Lead, CostRecord, ProfitRecord, Role } from '../types';
import { X, TrendingDown, TrendingUp, DollarSign } from 'lucide-react';

interface CaseFinancialDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: Lead | null;
}

const CaseFinancialDetailModal: React.FC<CaseFinancialDetailModalProps> = ({ isOpen, onClose, lead }) => {
  if (!isOpen || !lead) return null;

  const totalCost = (lead.cost_records || []).reduce((sum, r) => sum + r.amount, 0);
  const totalProfit = (lead.profit_records || []).reduce((sum, r) => sum + r.amount, 0);
  const netProfit = totalProfit - totalCost;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-TW', {
      timeZone: 'Asia/Taipei',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md transition-all">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden border border-white/20 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-8 border-b bg-white/50 backdrop-blur-xl z-10">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-600">
              <DollarSign size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 leading-tight">
                {lead.case_code || lead.platform_id} - 財務明細
              </h2>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
                {lead.platform} • {lead.status}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-300 hover:text-slate-900 transition-colors p-2 hover:bg-slate-50 rounded-2xl">
            <X size={32} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 scrollbar-hide">
          {/* 總覽卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-red-50 rounded-2xl p-4 border-2 border-red-200">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown size={20} className="text-red-600" />
                <h3 className="text-sm font-black text-red-900 uppercase tracking-widest">總成本</h3>
              </div>
              <p className="text-2xl font-black text-red-600">${totalCost.toLocaleString()}</p>
              <p className="text-xs text-red-600/70 mt-1">{(lead.cost_records || []).length} 筆記錄</p>
            </div>
            <div className="bg-green-50 rounded-2xl p-4 border-2 border-green-200">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp size={20} className="text-green-600" />
                <h3 className="text-sm font-black text-green-900 uppercase tracking-widest">總利潤</h3>
              </div>
              <p className="text-2xl font-black text-green-600">${totalProfit.toLocaleString()}</p>
              <p className="text-xs text-green-600/70 mt-1">{(lead.profit_records || []).length} 筆記錄</p>
            </div>
            <div className={`rounded-2xl p-4 border-2 ${netProfit >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-center gap-2 mb-2">
                <DollarSign size={20} className={netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'} />
                <h3 className={`text-sm font-black uppercase tracking-widest ${netProfit >= 0 ? 'text-emerald-900' : 'text-red-900'}`}>淨利潤</h3>
              </div>
              <p className={`text-2xl font-black ${netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                ${netProfit.toLocaleString()}
              </p>
              <p className={`text-xs mt-1 ${netProfit >= 0 ? 'text-emerald-600/70' : 'text-red-600/70'}`}>
                {totalProfit > 0 ? ((netProfit / totalProfit) * 100).toFixed(1) : '0'}% 利潤率
              </p>
            </div>
          </div>

          {/* 成本記錄 */}
          <div className="mb-6">
            <h3 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2">
              <TrendingDown size={20} className="text-red-600" />
              成本記錄
            </h3>
            <div className="space-y-3">
              {(lead.cost_records || []).length > 0 ? (
                lead.cost_records.map((cost: CostRecord) => (
                  <div key={cost.id} className="bg-white rounded-xl p-4 border-2 border-red-100 hover:border-red-200 transition-all">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <p className="text-base font-black text-slate-900">{cost.item_name}</p>
                          <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-full">
                            ${cost.amount.toLocaleString()}
                          </span>
                        </div>
                        {cost.note && (
                          <p className="text-sm text-slate-600 mb-2">{cost.note}</p>
                        )}
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <span>記錄者：{cost.author_name}</span>
                          <span>•</span>
                          <span>{formatDate(cost.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="bg-slate-50 rounded-xl p-8 text-center border-2 border-dashed border-slate-200">
                  <p className="text-slate-400 font-bold">尚無成本記錄</p>
                </div>
              )}
            </div>
          </div>

          {/* 利潤記錄 */}
          <div>
            <h3 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2">
              <TrendingUp size={20} className="text-green-600" />
              利潤記錄
            </h3>
            <div className="space-y-3">
              {(lead.profit_records || []).length > 0 ? (
                lead.profit_records.map((profit: ProfitRecord) => (
                  <div key={profit.id} className="bg-white rounded-xl p-4 border-2 border-green-100 hover:border-green-200 transition-all">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <p className="text-base font-black text-slate-900">{profit.item_name}</p>
                          <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full">
                            ${profit.amount.toLocaleString()}
                          </span>
                        </div>
                        {profit.note && (
                          <p className="text-sm text-slate-600 mb-2">{profit.note}</p>
                        )}
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <span>記錄者：{profit.author_name}</span>
                          <span>•</span>
                          <span>{formatDate(profit.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="bg-slate-50 rounded-xl p-8 text-center border-2 border-dashed border-slate-200">
                  <p className="text-slate-400 font-bold">尚無利潤記錄</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CaseFinancialDetailModal;
