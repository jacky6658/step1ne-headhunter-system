
import React, { useState } from 'react';
// Added LeadStatus to imports
import { Lead, Decision, RejectReason, AuditAction, UserProfile, LeadStatus } from '../types';
import { REJECT_REASON_OPTIONS } from '../constants';
import { updateLead } from '../services/leadService';

interface DecisionModalProps {
  lead: Lead;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userProfile: UserProfile; // 新增傳入當前使用者資訊
}

const DecisionModal: React.FC<DecisionModalProps> = ({ lead, isOpen, onClose, onSuccess, userProfile }) => {
  const [decision, setDecision] = useState<Decision>(lead.decision || Decision.PENDING);
  const [rejectReason, setRejectReason] = useState<RejectReason>(lead.reject_reason || RejectReason.LOW_BUDGET);
  const [reviewNote, setReviewNote] = useState(lead.review_note || '');
  const [loading, setLoading] = useState(false);
  const [isDeclined, setIsDeclined] = useState(lead.status === LeadStatus.DECLINED);

  if (!isOpen) return null;

  const handleSave = async () => {
    setLoading(true);
    try {
      // 構建更新對象，只包含有值的欄位
      let status: LeadStatus;
      
      if (decision === Decision.ACCEPT) {
        status = LeadStatus.CONTACTED;
      } else if (decision === Decision.REJECT) {
        // 如果是婉拒/未聯繫，使用 DECLINED 狀態
        status = isDeclined ? LeadStatus.DECLINED : LeadStatus.CANCELLED;
      } else {
        // 待問：保持原狀態
        status = lead.status;
      }
      
      const updates: Partial<Lead> = {
        decision,
        decision_by: userProfile.displayName,
        review_note: reviewNote || null,
        status
      };
      
      // 只有在取消或婉拒時才設置 reject_reason
      if (decision === Decision.REJECT) {
        updates.reject_reason = rejectReason;
      } else {
        // 如果不是取消或婉拒，清除 reject_reason
        updates.reject_reason = null;
      }
      
      await updateLead(lead.id, updates, AuditAction.DECISION);
      
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('❌ 審核決定更新失敗:', err);
      alert(`儲存失敗：${err?.message || '未知錯誤'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md p-8 border border-white/20">
        <h2 className="text-xl font-black text-slate-900 mb-6">審核案件: {lead.platform_id}</h2>
        
        <div className="space-y-6">
          <div>
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">審核決定</label>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <button 
                onClick={() => setDecision(Decision.ACCEPT)}
                className={`py-3 rounded-xl border-2 text-xs font-black transition-all ${decision === Decision.ACCEPT ? 'bg-green-50 border-green-500 text-green-700' : 'bg-white border-slate-100 text-slate-400'}`}
              >
                ✅ 接受
              </button>
              <button 
                onClick={() => {
                  setDecision(Decision.REJECT);
                  setIsDeclined(false);
                }}
                className={`py-3 rounded-xl border-2 text-xs font-black transition-all ${decision === Decision.REJECT && !isDeclined ? 'bg-red-50 border-red-500 text-red-700' : 'bg-white border-slate-100 text-slate-400'}`}
              >
                ❌ 取消
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={() => {
                  setDecision(Decision.PENDING);
                  setIsDeclined(false);
                }}
                className={`py-3 rounded-xl border-2 text-xs font-black transition-all ${decision === Decision.PENDING ? 'bg-amber-50 border-amber-500 text-amber-700' : 'bg-white border-slate-100 text-slate-400'}`}
                title="待問：需要進一步確認或詢問的案件"
              >
                🟡 待問
              </button>
              <button 
                onClick={() => {
                  // 設置為婉拒/未聯繫狀態
                  setDecision(Decision.REJECT);
                  setIsDeclined(true);
                }}
                className={`py-3 rounded-xl border-2 text-xs font-black transition-all ${isDeclined && decision === Decision.REJECT ? 'bg-orange-50 border-orange-500 text-orange-700' : 'bg-white border-slate-100 text-slate-400'}`}
                title="婉拒/未聯繫：已使用 Pro360 索取個資但無法聯繫或決定不做"
              >
                🟠 婉拒/未聯繫
              </button>
            </div>
            {/* 說明文字 */}
            <div className="mt-3 p-3 bg-slate-50 rounded-xl">
              <p className="text-[10px] text-slate-500 font-medium mb-1">
                <span className="font-black">待問：</span>需要進一步確認或詢問的案件，狀態保持不變
              </p>
              <p className="text-[10px] text-slate-500 font-medium">
                <span className="font-black">婉拒/未聯繫：</span>已使用 Pro360 索取個資但無法聯繫或決定不做，狀態會變更為「婉拒/無法聯繫」
              </p>
            </div>
          </div>

          {decision === Decision.REJECT && (
            <div className="animate-in fade-in slide-in-from-top-2">
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                {isDeclined ? '婉拒/未聯繫原因' : '取消原因'}
              </label>
              <select 
                className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm font-bold bg-slate-50 focus:bg-white focus:border-indigo-500 outline-none"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value as RejectReason)}
              >
                {REJECT_REASON_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">審核備註</label>
            <textarea 
              rows={3}
              className="w-full border-2 border-slate-100 rounded-xl p-4 text-sm font-medium bg-slate-50 focus:bg-white focus:border-indigo-500 outline-none"
              placeholder="輸入判斷理由..."
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-8">
          <button onClick={onClose} className="px-6 py-3 text-sm font-black text-slate-400 hover:text-slate-900">取消</button>
          <button 
            disabled={loading}
            onClick={handleSave}
            className="px-8 py-3 bg-slate-900 text-white rounded-xl text-sm font-black hover:bg-black disabled:opacity-50 shadow-xl shadow-slate-200"
          >
            {loading ? '儲存中...' : '提交審核'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DecisionModal;
