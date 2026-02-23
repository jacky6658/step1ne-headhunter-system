
import React, { useState } from 'react';
import { Lead, UserProfile, LeadStatus, Decision, Role } from '../types';
import Badge from '../components/Badge';
import { DECISION_COLORS } from '../constants';
import DecisionModal from '../components/DecisionModal';
import LeadModal from '../components/LeadModal';
import { Clock, DollarSign, User, AlertCircle, CheckSquare, MessageSquare } from 'lucide-react';
import { updateLead } from '../services/leadService';

interface ReviewPageProps {
  leads: Lead[];
  userProfile: UserProfile;
}

const ReviewPage: React.FC<ReviewPageProps> = ({ leads, userProfile }) => {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailLead, setDetailLead] = useState<Lead | null>(null);

  const reviewLeads = leads.filter(l => 
    l.status === LeadStatus.TO_FILTER || l.assigned_to === userProfile.uid
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
        {reviewLeads.map((lead) => (
          <div 
            key={lead.id} 
            onClick={() => {
              setDetailLead(lead);
              setShowDetailModal(true);
            }}
            className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col group cursor-pointer"
          >
            <div className="p-7 flex-1">
              <div className="flex items-center justify-between mb-5">
                <Badge className="bg-slate-900 text-white uppercase tracking-widest font-black text-[10px] px-3 py-1 rounded-lg">{lead.platform}</Badge>
                <Badge className={`${DECISION_COLORS[lead.decision]} font-black text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md`}>{lead.decision}</Badge>
              </div>
              
              <h3 className="font-black text-slate-900 mb-3 truncate text-lg">案主: {lead.platform_id}</h3>
              <p className="text-slate-500 text-sm line-clamp-3 mb-6 min-h-[4.5rem] leading-relaxed font-medium">
                {lead.need}
              </p>

              {lead.internal_remarks && (
                <div className="mb-6 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-50">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <MessageSquare size={12} className="text-indigo-500" />
                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">內部備註</span>
                  </div>
                  <p className="text-xs text-indigo-700 italic font-medium">"{lead.internal_remarks}"</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 pt-5 border-t border-gray-50">
                <div className="flex items-center gap-2 text-slate-400">
                  <DollarSign size={16} className="text-emerald-500" />
                  <span className="text-xs font-black text-slate-700">{lead.budget_text || '不詳'}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <Clock size={16} className="text-indigo-400" />
                  <span className="text-[10px] font-bold">{new Date(lead.posted_at || lead.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            <div className="p-5 bg-slate-50/50 border-t border-gray-50">
              <button 
                onClick={(e) => {
                  e.stopPropagation(); // 阻止觸發卡片點擊
                  setSelectedLead(lead);
                }}
                className="w-full flex items-center justify-center gap-2 bg-white border border-slate-200 py-4 rounded-2xl text-sm font-black text-slate-700 hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all shadow-sm active:scale-95"
              >
                <AlertCircle size={18} />
                進入審核流程
              </button>
            </div>
          </div>
        ))}

        {reviewLeads.length === 0 && (
          <div className="col-span-full py-24 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-100">
            <h3 className="text-xl font-black text-slate-900 mb-2">太棒了！目前沒有待審案件</h3>
          </div>
        )}
      </div>

      {selectedLead && (
        <DecisionModal 
          lead={selectedLead}
          isOpen={!!selectedLead}
          onClose={() => setSelectedLead(null)}
          onSuccess={() => setSelectedLead(null)}
          userProfile={userProfile}
        />
      )}

      {/* 案件詳細內容 Modal */}
      {detailLead && (
        <LeadModal
          isOpen={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setDetailLead(null);
          }}
          onSubmit={async (data) => {
            if (detailLead) {
              await updateLead(detailLead.id, data);
              // 更新本地狀態
              const updatedLead = { ...detailLead, ...data };
              setDetailLead(updatedLead);
            }
          }}
          initialData={detailLead}
          userRole={userProfile.role}
          userName={userProfile.displayName}
        />
      )}
    </div>
  );
};

export default ReviewPage;
