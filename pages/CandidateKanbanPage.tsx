// Step1ne Headhunter System - 候選人 Kanban 看板
import React, { useState, useEffect } from 'react';
import { Candidate, CandidateStatus } from '../types';
import { getCandidates, updateCandidateStatus } from '../services/candidateService';
import { KANBAN_COLUMNS, CANDIDATE_STATUS_CONFIG } from '../constants';
import { Users, RefreshCw } from 'lucide-react';

export function CandidateKanbanPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedCandidate, setDraggedCandidate] = useState<Candidate | null>(null);
  
  useEffect(() => {
    loadCandidates();
  }, []);
  
  const loadCandidates = async () => {
    setLoading(true);
    try {
      const data = await getCandidates();
      setCandidates(data);
    } catch (error) {
      console.error('載入候選人失敗:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleDragStart = (candidate: Candidate) => {
    setDraggedCandidate(candidate);
  };
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };
  
  const handleDrop = async (newStatus: CandidateStatus) => {
    if (!draggedCandidate) return;
    
    if (draggedCandidate.status === newStatus) {
      setDraggedCandidate(null);
      return;
    }
    
    try {
      // 更新狀態
      await updateCandidateStatus(draggedCandidate.id, newStatus);
      
      // 更新本地狀態
      setCandidates(prev => 
        prev.map(c => 
          c.id === draggedCandidate.id 
            ? { ...c, status: newStatus, updatedAt: new Date().toISOString() }
            : c
        )
      );
      
      setDraggedCandidate(null);
    } catch (error) {
      console.error('更新狀態失敗:', error);
      alert('更新狀態失敗，請稍後再試');
    }
  };
  
  const getCandidatesByStatus = (status: CandidateStatus) => {
    return candidates.filter(c => c.status === status);
  };
  
  const getStabilityColor = (score: number) => {
    if (score >= 80) return 'border-l-green-500';
    if (score >= 60) return 'border-l-blue-500';
    if (score >= 40) return 'border-l-yellow-500';
    if (score >= 20) return 'border-l-orange-500';
    return 'border-l-red-500';
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">載入看板資料中...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="p-6 h-screen flex flex-col">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Users className="w-8 h-8 text-blue-600" />
              候選人流程看板
            </h1>
            <p className="text-gray-600 mt-1">
              拖放候選人卡片來更新狀態 · 共 {candidates.length} 位候選人
            </p>
          </div>
          
          <button 
            onClick={loadCandidates}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
            重新整理
          </button>
        </div>
      </div>
      
      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto">
        <div className="flex gap-4 h-full min-w-max pb-4">
          {KANBAN_COLUMNS.map(status => {
            const statusConfig = CANDIDATE_STATUS_CONFIG[status];
            const statusCandidates = getCandidatesByStatus(status);
            
            return (
              <div 
                key={status}
                className="flex-shrink-0 w-80 flex flex-col"
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(status)}
              >
                {/* Column Header */}
                <div className={`p-4 rounded-t-lg ${statusConfig.bgColor} ${statusConfig.textColor}`}>
                  <h3 className="font-semibold text-sm uppercase tracking-wide">
                    {statusConfig.label}
                  </h3>
                  <p className="text-xs mt-1 opacity-75">
                    {statusCandidates.length} 位候選人
                  </p>
                </div>
                
                {/* Cards Container */}
                <div className="flex-1 bg-gray-50 p-4 rounded-b-lg space-y-3 overflow-y-auto">
                  {statusCandidates.map(candidate => (
                    <div
                      key={candidate.id}
                      draggable
                      onDragStart={() => handleDragStart(candidate)}
                      className={`
                        bg-white rounded-lg shadow-sm p-4 cursor-move 
                        hover:shadow-md transition-shadow
                        border-l-4 ${getStabilityColor(candidate.stabilityScore)}
                      `}
                    >
                      {/* Candidate Info */}
                      <div className="mb-2">
                        <h4 className="font-semibold text-gray-900">
                          {candidate.name}
                        </h4>
                        <p className="text-sm text-gray-600 truncate">
                          {candidate.position}
                        </p>
                      </div>
                      
                      {/* Stats */}
                      <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
                        <span>📍 {candidate.location}</span>
                        <span>💼 {candidate.years}年</span>
                        <span>
                          {candidate.stabilityScore >= 80 ? '⭐' : 
                           candidate.stabilityScore >= 60 ? '🔵' : 
                           candidate.stabilityScore >= 40 ? '🟡' : '🔴'} 
                          {candidate.stabilityScore}
                        </span>
                      </div>
                      
                      {/* Skills (truncated) */}
                      <div className="text-xs text-gray-500 line-clamp-2">
                        {candidate.skills}
                      </div>
                      
                      {/* Footer */}
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                        <span className="text-xs text-gray-500">
                          {candidate.consultant || '未分配'}
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date(candidate.updatedAt).toLocaleDateString('zh-TW')}
                        </span>
                      </div>
                    </div>
                  ))}
                  
                  {statusCandidates.length === 0 && (
                    <div className="text-center py-8 text-gray-400 text-sm">
                      暫無候選人
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
