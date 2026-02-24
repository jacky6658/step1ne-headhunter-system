// Step1ne Headhunter System - 候選人總表頁面
import React, { useState, useEffect } from 'react';
import { Candidate, CandidateStatus, CandidateSource, UserProfile } from '../types';
import { getCandidates, searchCandidates, updateCandidateStatus, filterCandidatesByPermission, clearCache } from '../services/candidateService';
import { Users, Search, Filter, Plus, Download, Upload, Shield, RefreshCw } from 'lucide-react';
import { CANDIDATE_STATUS_CONFIG, SOURCE_CONFIG } from '../constants';
import { CandidateModal } from '../components/CandidateModal';
import { ColumnTooltip } from '../components/ColumnTooltip';
import { COLUMN_DESCRIPTIONS } from '../config/columnDescriptions';

interface CandidatesPageProps {
  userProfile: UserProfile;
}

export function CandidatesPage({ userProfile }: CandidatesPageProps) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [filteredCandidates, setFilteredCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [consultantFilter, setConsultantFilter] = useState<string>('all');
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  
  // 載入候選人資料
  useEffect(() => {
    if (userProfile) {
      loadCandidates();
    }
  }, [userProfile]);
  
  // 套用篩選
  useEffect(() => {
    applyFilters();
  }, [candidates, searchQuery, statusFilter, sourceFilter, consultantFilter]);
  
  // 自動重新整理（每 30 秒）- 雙向同步模式
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!loading && !refreshing) {
        console.log('🔄 自動重新整理候選人資料...');
        clearCache();
        const allCandidates = await getCandidates(userProfile);
        setCandidates(allCandidates);
      }
    }, 30000); // 30 秒
    
    return () => clearInterval(interval);
  }, [userProfile, loading, refreshing]);
  
  const loadCandidates = async () => {
    setLoading(true);
    try {
      // 傳入 userProfile，後端會自動過濾
      const allCandidates = await getCandidates(userProfile);
      setCandidates(allCandidates);
    } catch (error) {
      console.error('載入候選人失敗:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // 清除快取
      clearCache();
      console.log('✅ 快取已清除，重新載入候選人資料...');
      
      // 重新載入（傳入 userProfile）
      const allCandidates = await getCandidates(userProfile);
      setCandidates(allCandidates);
    } catch (error) {
      console.error('手動更新失敗:', error);
    } finally {
      setRefreshing(false);
    }
  };
  
  const applyFilters = () => {
    let filtered = [...candidates];
    
    // 搜尋
    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase();
      filtered = filtered.filter(c => {
        // 處理 skills 可能是陣列或字串
        const skillsStr = Array.isArray(c.skills) 
          ? c.skills.join(' ') 
          : (c.skills || '');
        
        return c.name.toLowerCase().includes(lowerQuery) ||
               c.email.toLowerCase().includes(lowerQuery) ||
               c.phone.includes(searchQuery) ||
               c.position.toLowerCase().includes(lowerQuery) ||
               skillsStr.toLowerCase().includes(lowerQuery);
      });
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
  
  const getTalentGradeColor = (grade: string) => {
    switch (grade) {
      case 'S':
        return 'text-purple-700 bg-purple-100 border border-purple-300';
      case 'A+':
        return 'text-blue-700 bg-blue-100 border border-blue-300';
      case 'A':
        return 'text-green-700 bg-green-100 border border-green-300';
      case 'B':
        return 'text-yellow-700 bg-yellow-100 border border-yellow-300';
      case 'C':
        return 'text-gray-700 bg-gray-100 border border-gray-300';
      default:
        return 'text-gray-500 bg-gray-50';
    }
  };
  
  // 下載履歷流程
  const handleDownloadResume = async (candidate: Candidate) => {
    try {
      // 1. 如果候選人有 LinkedIn URL，開啟 LinkedIn 頁面
      if (candidate.linkedinUrl || candidate.resumeUrl) {
        const url = candidate.linkedinUrl || candidate.resumeUrl;
        window.open(url, '_blank');
        
        // 2. 提示獵頭下載 PDF
        const confirmed = confirm(`請在 LinkedIn 頁面點擊右上角「...」→「存為 PDF」下載履歷\n\n下載完成後，請選擇 PDF 檔案上傳。\n\n是否繼續？`);
        
        if (!confirmed) return;
        
        // 3. 開啟檔案選擇器
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.pdf';
        fileInput.onchange = async (e: Event) => {
          const target = e.target as HTMLInputElement;
          if (target.files && target.files.length > 0) {
            await uploadResume(target.files[0], candidate);
          }
        };
        fileInput.click();
      } else {
        // 沒有 LinkedIn URL，直接開啟檔案選擇器
        alert('候選人沒有 LinkedIn 連結，請直接上傳履歷 PDF');
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.pdf';
        fileInput.onchange = async (e: Event) => {
          const target = e.target as HTMLInputElement;
          if (target.files && target.files.length > 0) {
            await uploadResume(target.files[0], candidate);
          }
        };
        fileInput.click();
      }
    } catch (error) {
      console.error('下載履歷失敗:', error);
      alert('下載履歷失敗，請稍後再試');
    }
  };
  
  // 上傳履歷到系統
  const uploadResume = async (file: File, candidate: Candidate) => {
    try {
      // 顯示上傳中
      alert('正在上傳履歷到 Google Drive...');
      
      const formData = new FormData();
      formData.append('resume', file);
      formData.append('candidateId', candidate.id);
      formData.append('candidateName', candidate.name);
      
      // 呼叫後端 API（TODO：實作後端）
      const API_URL = import.meta.env.VITE_API_URL || 'https://backendstep1ne.zeabur.app';
      const response = await fetch(`${API_URL}/candidates/${candidate.id}/upload-resume`, {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error('上傳失敗');
      }
      
      const result = await response.json();
      
      // 顯示成功訊息
      alert(`✅ 履歷上傳成功！
      
📊 已解析資料：
• Email: ${result.parsedData?.email || '未提取'}
• Phone: ${result.parsedData?.phone || '未提取'}
• 技能數量: ${result.parsedData?.skills?.length || 0}

🔄 已觸發重新評分...

[查看 Google Drive](${result.driveUrl})`);
      
      // 重新載入候選人資料
      await loadCandidates();
    } catch (error) {
      console.error('上傳履歷失敗:', error);
      alert('上傳履歷失敗，請稍後再試\n\n錯誤：' + (error as Error).message);
    }
  };
  
  // 指派候選人給自己（雙向同步模式：通知 AI 或手動編輯）
  const handleAssignToMe = async (candidate: Candidate, e: React.MouseEvent) => {
    e.stopPropagation(); // 防止觸發行點擊
    
    if (!userProfile) {
      alert('無法取得用戶資訊');
      return;
    }
    
    // 生成 gog CLI 指令
    const gogCommand = `gog sheets update "1PunpaDAFBPBL_I76AiRYGXKaXDZvMl1c262SEtxRk6Q" "履歷池v2!S${candidate.id}" "${userProfile.displayName}" --account aijessie88@step1ne.com`;
    
    // 顯示操作選項
    const confirmed = confirm(`🎯 指派候選人「${candidate.name}」給 ${userProfile.displayName}

請選擇以下任一方式：

方式 1️⃣ 請 YuQi 協助（推薦）
→ 複製以下指令，貼到 Telegram 給 @YuQi
→ 指令：${gogCommand}

方式 2️⃣ 手動編輯 Google Sheets
→ 開啟履歷池v2
→ 找到第 ${candidate.id} 行
→ 在「獵頭顧問」欄位填入「${userProfile.displayName}」

⏱️ 完成後，30 秒內會自動更新畫面

是否繼續？`);
    
    if (!confirmed) return;
    
    // 複製指令到剪貼簿（如果瀏覽器支援）
    try {
      await navigator.clipboard.writeText(gogCommand);
      alert('✅ 指令已複製到剪貼簿！\n\n請貼到 Telegram 給 YuQi，或手動編輯 Google Sheets。\n\n⏱️ 30 秒後自動重新整理');
    } catch (err) {
      alert('✅ 請手動複製指令或編輯 Google Sheets\n\n⏱️ 30 秒後自動重新整理');
    }
    
    // 30 秒後自動重新載入
    setTimeout(async () => {
      clearCache();
      await loadCandidates();
      alert('✅ 已重新載入候選人資料');
    }, 30000);
    
    console.log(`📋 指派請求：候選人「${candidate.name}」(ID: ${candidate.id}) → ${userProfile.displayName}`);
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
              <span className="text-gray-400 text-sm ml-2">· 資料快取 30 分鐘</span>
            </p>
            {userProfile.role !== 'ADMIN' && (
              <p className="text-sm text-blue-600 mt-1 flex items-center gap-1">
                <Shield className="w-4 h-4" />
                只顯示您負責的候選人
              </p>
            )}
          </div>
          
          <div className="flex gap-2">
            <button 
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              title="手動更新候選人資料（清除快取）"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? '更新中...' : '重新整理'}
            </button>
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
        {/* 滾動提示 */}
        <div className="bg-blue-50 border-b border-blue-100 px-4 py-2 text-xs text-blue-700 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
          <span>💡 表格可左右滑動查看更多資訊（滾動條始終可見於底部）</span>
        </div>
        
        {/* 橫向滾動容器（Sticky Scrollbar）*/}
        <div 
          className="overflow-x-auto overflow-y-visible"
          style={{
            maxHeight: 'calc(100vh - 280px)',
            position: 'relative'
          }}
        >
          <style>{`
            .overflow-x-auto::-webkit-scrollbar {
              height: 14px;
            }
            .overflow-x-auto::-webkit-scrollbar-track {
              background: #f1f5f9;
              border-radius: 4px;
            }
            .overflow-x-auto::-webkit-scrollbar-thumb {
              background: #cbd5e1;
              border-radius: 4px;
              border: 2px solid #f1f5f9;
            }
            .overflow-x-auto::-webkit-scrollbar-thumb:hover {
              background: #94a3b8;
            }
          `}</style>
          <table className="min-w-full divide-y divide-gray-200" style={{ minWidth: '1400px' }}>
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ minWidth: '200px' }}>
                <div className="flex items-center">
                  姓名
                  <ColumnTooltip {...COLUMN_DESCRIPTIONS.name} />
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ minWidth: '200px' }}>
                <div className="flex items-center">
                  職位
                  <ColumnTooltip {...COLUMN_DESCRIPTIONS.position} />
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ minWidth: '100px' }}>
                <div className="flex items-center">
                  年資
                  <ColumnTooltip {...COLUMN_DESCRIPTIONS.experience} />
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ minWidth: '120px' }}>
                <div className="flex items-center">
                  工作穩定性
                  <ColumnTooltip {...COLUMN_DESCRIPTIONS.stability} />
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ minWidth: '80px' }}>
                <div className="flex items-center">
                  綜合評級
                  <ColumnTooltip {...COLUMN_DESCRIPTIONS.talentGrade} />
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ minWidth: '400px' }}>
                <div className="flex items-center">
                  技能
                  <ColumnTooltip {...COLUMN_DESCRIPTIONS.skills} />
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ minWidth: '100px' }}>
                <div className="flex items-center">
                  狀態
                  <ColumnTooltip {...COLUMN_DESCRIPTIONS.status} />
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ minWidth: '120px' }}>
                <div className="flex items-center">
                  來源
                  <ColumnTooltip {...COLUMN_DESCRIPTIONS.source} />
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ minWidth: '100px' }}>
                <div className="flex items-center">
                  顧問
                  <ColumnTooltip {...COLUMN_DESCRIPTIONS.consultant} />
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ minWidth: '150px' }}>
                <div className="flex items-center">
                  操作
                </div>
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
                          {(() => {
                            const email = candidate.email || '';
                            // 檢測 LinkedIn 格式
                            if (email.startsWith('LinkedIn:') || email.startsWith('linkedin:')) {
                              const username = email.replace(/^(LinkedIn|linkedin):\s*/i, '').trim();
                              const linkedinUrl = username.startsWith('http') 
                                ? username 
                                : `https://www.linkedin.com/in/${username}`;
                              return (
                                <a 
                                  href={linkedinUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <span className="inline-flex items-center gap-1">
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                      <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                                    </svg>
                                    LinkedIn
                                  </span>
                                </a>
                              );
                            }
                            // 一般 email
                            return email || '-';
                          })()}
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
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    {candidate.talentGrade ? (
                      <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${getTalentGradeColor(candidate.talentGrade)}`}>
                        {candidate.talentGrade}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">未評級</span>
                    )}
                  </td>
                  
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 max-w-md whitespace-normal">
                      {Array.isArray(candidate.skills) 
                        ? candidate.skills.join(', ') 
                        : candidate.skills}
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
                  
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex gap-2">
                      {/* 指派給我按鈕（只在未指派時顯示）*/}
                      {(!candidate.consultant || candidate.consultant === '' || candidate.consultant === '未指派') && (
                        <button
                          onClick={(e) => handleAssignToMe(candidate, e)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-500 text-white text-xs font-medium rounded hover:bg-green-600 transition-colors"
                          title="將此候選人指派給我"
                        >
                          <Shield className="w-3.5 h-3.5" />
                          指派給我
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
        {/* 橫向滾動容器結束 */}
        
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
