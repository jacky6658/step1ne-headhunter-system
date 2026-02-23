
import React, { useState, useEffect } from 'react';
import { Lead, UserProfile } from '../types';
import KanbanBoard from '../components/KanbanBoard';
import LeadModal from '../components/LeadModal';
import { updateLead, fetchLeadsFromApi } from '../services/leadService';
import { useApiMode } from '../services/apiConfig';

interface KanbanPageProps {
  leads: Lead[];
  userProfile: UserProfile;
}

const KanbanPage: React.FC<KanbanPageProps> = ({ leads, userProfile }) => {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  // 當 leads 更新時，同步更新 selectedLead（確保顯示最新數據）
  useEffect(() => {
    if (selectedLead) {
      const updatedLead = leads.find(l => l.id === selectedLead.id);
      if (updatedLead) {
        // 比較成本記錄數量，如果有變化則更新
        const currentCostsCount = (selectedLead.cost_records || []).length;
        const updatedCostsCount = (updatedLead.cost_records || []).length;
        if (updatedCostsCount !== currentCostsCount || JSON.stringify(selectedLead.cost_records) !== JSON.stringify(updatedLead.cost_records)) {
          setSelectedLead(updatedLead);
        }
      }
    }
  }, [leads, selectedLead?.id]);

  const handleLeadUpdate = async (data: Partial<Lead>) => {
    if (!selectedLead) return;
    
    try {
      // 如果只更新了 progress_updates、cost_records 或 profit_records，這些是部分更新
      // 這些更新已經通過 addProgressUpdate、addCostRecord、addProfitRecord 保存到後端了
      // 所以不需要再次調用 updateLead，只需要更新本地狀態
      const isPartialUpdate = 
        (data.progress_updates !== undefined && Object.keys(data).length === 1) ||
        (data.cost_records !== undefined && Object.keys(data).length === 1) ||
        (data.profit_records !== undefined && Object.keys(data).length === 1);
      
      if (isPartialUpdate) {
        // 部分更新：立即從後端獲取最新數據，確保顯示正確
        // 這些更新已經通過專用函數保存到後端了
        if (useApiMode()) {
          try {
            // 等待一小段時間確保後端已處理完成
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // 立即從後端獲取最新數據
            const latestLeads = await fetchLeadsFromApi();
            const latestLead = latestLeads.find(l => l.id === selectedLead.id);
            if (latestLead) {
              console.log('✅ 已從後端獲取最新數據:', {
                leadId: latestLead.id,
                caseCode: latestLead.case_code,
                costRecordsCount: (latestLead.cost_records || []).length,
                profitRecordsCount: (latestLead.profit_records || []).length,
                status: latestLead.status
              });
              
              // 驗證成本記錄是否正確保存
              if (data.cost_records) {
                const savedCostIds = (latestLead.cost_records || []).map(c => c.id);
                const expectedCostIds = data.cost_records.map(c => c.id);
                const missingCosts = expectedCostIds.filter(id => !savedCostIds.includes(id));
                if (missingCosts.length > 0) {
                  console.warn('⚠️ 部分成本記錄未保存:', missingCosts);
                }
              }
              
              setSelectedLead(latestLead);
            } else {
              console.warn('⚠️ 後端找不到案件，使用本地更新的數據');
              // 如果後端找不到，使用本地更新的數據
              setSelectedLead(prev => {
                if (!prev) return null;
                return { ...prev, ...data };
              });
            }
          } catch (error) {
            console.warn('⚠️ 獲取最新數據失敗，使用本地更新:', error);
            // 降級：使用本地更新的數據
            setSelectedLead(prev => {
              if (!prev) return null;
              return { ...prev, ...data };
            });
          }
        } else {
          // localStorage 模式：直接更新本地狀態
          setSelectedLead(prev => {
            if (!prev) return null;
            return { ...prev, ...data };
          });
        }
        return;
      }
      
      // 完整更新：調用 updateLead 並關閉 Modal
      await updateLead(selectedLead.id, data);
      setSelectedLead(null);
    } catch (err) {
      console.error('更新案件失敗:', err);
      alert('❌ 更新失敗，請稍後再試');
    }
  };

  return (
    <div className="h-full">
      <KanbanBoard 
        leads={leads} 
        onSelectLead={setSelectedLead} 
        userRole={userProfile.role}
      />
      {selectedLead && (
        <LeadModal 
          isOpen={!!selectedLead}
          onClose={() => setSelectedLead(null)}
          onSubmit={handleLeadUpdate}
          initialData={selectedLead}
          userRole={userProfile.role}
        />
      )}
    </div>
  );
};

export default KanbanPage;
