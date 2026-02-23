// Step1ne Headhunter System - 候選人總表頁面
import React, { useState, useEffect } from 'react';
import { Candidate, CandidateStatus, CandidateSource, UserProfile } from '../types';
import { getCandidates, searchCandidates, updateCandidateStatus, filterCandidatesByPermission } from '../services/candidateService';
import { Users, Search, Filter, Plus, Download, Upload, Shield } from 'lucide-react';
import { CANDIDATE_STATUS_CONFIG, SOURCE_CONFIG } from '../constants';
import { CandidateModal } from '../components/CandidateModal';

interface CandidatesPageProps {
  userProfile: UserProfile;
}

export function CandidatesPage({ userProfile }: CandidatesPageProps) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [filteredCandidates, setFilteredCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [consultantFilter, setConsultantFilter] = useState<string>('all');
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  
  // 載入候選人資料
  useEffect(() => {
    loadCandidates();
  }, []);
  
  // 套用篩選
  useEffect(() => {
    applyFilters();
  }, [candidates, searchQuery, statusFilter, sourceFilter, consultantFilter]);
  
  const loadCandidates = async () => {
    setLoading(true);
    try {
      const allCandidates = await getCandidates();
      // 根據權限過濾候選人
      const filteredByPermission = filterCandidatesByPermission(allCandidates, userProfile);
      setCandidates(filteredByPermission);
    } catch (error) {
      console.error('載入候選人失敗:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const applyFilters = () => {
    let filtered = [...candidates];
    
    // 搜尋
    if (searchQuery.trim()) {
      filtered = filtered.filter(c => 
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone.includes(searchQuery) ||
        c.position.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.skills.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    // 狀態篩選
    if (statusFilter !== 'all') {
      filtered = filtered.filter(c => c.status === statusFilter);
    }
    
    // 來源篩選
    if (sourceFilter !== 'all') {
      filtered = filtered.filter(c => c.source === sourceFilter);
    }
    
    // 顧問篩選
    if (consultantFilter !== 'all') {
      filtered = filtered.filter(c => c.consultant === consultantFilter);
    }
    
    setFilteredCandidates(filtered);
  };
  
  const getStabilityColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-100';
    if (score >= 60) return 'text-blue-600 bg-blue-100';
    if (score >= 40) return 'text-yellow-600 bg-yellow-100';
    if (score >= 20) return 'text-orange-600 bg-orange-100';
    return 'text-red-600 bg-red-100';
  };
  
  const getStabilityGrade = (score: number) => {
    if (score >= 80) return 'A';
    if (score >= 60) return 'B';
    if (score >= 40) return 'C';
    if (score >= 20) return 'D';
    return 'F';
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">載入候選人資料中...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Users className="w-8 h-8 text-blue-600" />
              候選人總表
            </h1>
            <p className="text-gray-600 mt-1">
              共 {filteredCandidates.length} 位候選人
              {candidates.length !== filteredCandidates.length && ` (篩選自 ${candidates.length} 位)`}
            </p>
            {userProfile.role !== 'ADMIN' && (
              <p className="text-sm text-blue-600 mt-1 flex items-center gap-1">
                <Shield className="w-4 h-4" />
                只顯示您負責的候選人
              </p>
            )}
          </div>
          
          <div className="flex gap-2">
            <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
              <Upload className="w-4 h-4" />
              匯入履歷
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
              <Download className="w-4 h-4" />
              匯出 CSV
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <Plus className="w-4 h-4" />
              新增候選人
            </button>
          </div>
        </div>
      </div>
      
      {/* 篩選區 */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* 搜尋 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜尋姓名、Email、技能..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          {/* 狀態篩選 */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">全部狀態</option>
            {Object.entries(CANDIDATE_STATUS_CONFIG).map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </select>
          
          {/* 來源篩選 */}
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">全部來源</option>
            {Object.entries(SOURCE_CONFIG).map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </select>
          
          {/* 顧問篩選 */}
          <select
            value={consultantFilter}
            onChange={(e) => setConsultantFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">全部顧問</option>
            <option value="Jacky">Jacky</option>
            <option value="Phoebe">Phoebe</option>
          </select>
        </div>
      </div>
      
      {/* 候選人列表 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                姓名
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                職位
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                年資
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                穩定度
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                技能
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                狀態
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                來源
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                顧問
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredCandidates.map((candidate) => {
              const statusConfig = CANDIDATE_STATUS_CONFIG[candidate.status] || {
                label: candidate.status || '未知',
                bgColor: 'bg-gray-100',
                textColor: 'text-gray-800'
              };
              const sourceConfig = SOURCE_CONFIG[candidate.source] || {
                label: candidate.source || '未知',
                icon: '📄'
              };
              
              return (
                <tr 
                  key={candidate.id}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => setSelectedCandidate(candidate)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {candidate.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {candidate.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">{candidate.position}</div>
                    <div className="text-sm text-gray-500">{candidate.location}</div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{candidate.years} 年</div>
                    <div className="text-sm text-gray-500">{candidate.jobChanges} 次</div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStabilityColor(candidate.stabilityScore)}`}>
                      {getStabilityGrade(candidate.stabilityScore)} 級 ({candidate.stabilityScore})
                    </div>
                  </td>
                  
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 truncate max-w-xs">
                      {candidate.skills}
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig.bgColor} ${statusConfig.textColor}`}>
                      {statusConfig.label}
                    </span>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-900">
                      {sourceConfig.icon} {sourceConfig.label}
                    </span>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {candidate.consultant || '-'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        
        {filteredCandidates.length === 0 && (
          <div className="text-center py-12">
            <Users className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">沒有候選人</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchQuery || statusFilter !== 'all' || sourceFilter !== 'all' || consultantFilter !== 'all'
                ? '請調整篩選條件'
                : '開始新增候選人吧！'}
            </p>
          </div>
        )}
      </div>
      
      {/* Candidate Detail Modal */}
      {selectedCandidate && (
        <CandidateModal
          candidate={selectedCandidate}
          onClose={() => setSelectedCandidate(null)}
          onUpdateStatus={async (candidateId, newStatus) => {
            await updateCandidateStatus(candidateId, newStatus);
            setCandidates(prev => 
              prev.map(c => 
                c.id === candidateId 
                  ? { ...c, status: newStatus, updatedAt: new Date().toISOString() }
                  : c
              )
            );
            setSelectedCandidate(null);
          }}
        />
      )}
    </div>
  );
}
