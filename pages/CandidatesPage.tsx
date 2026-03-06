// Step1ne Headhunter System - 候選人總表頁面
import React, { useState, useEffect, useRef } from 'react';
import { Candidate, CandidateStatus, CandidateSource, UserProfile } from '../types';
import { getCandidates, searchCandidates, updateCandidateStatus, filterCandidatesByPermission, clearCache } from '../services/candidateService';
import { Users, Search, Filter, Plus, Download, Upload, Shield, RefreshCw, Sparkles, X } from 'lucide-react';
import { CANDIDATE_STATUS_CONFIG, SOURCE_CONFIG } from '../constants';
import { CandidateModal } from '../components/CandidateModal';
import { ColumnTooltip } from '../components/ColumnTooltip';
import { COLUMN_DESCRIPTIONS } from '../config/columnDescriptions';
import { apiPost, apiPatch, getApiUrl } from '../config/api';

interface CandidatesPageProps {
  userProfile: UserProfile;
  onNavigateToMatching?: (candidateId: string) => void;
}

export function CandidatesPage({ userProfile, onNavigateToMatching }: CandidatesPageProps) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [filteredCandidates, setFilteredCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [consultantFilter, setConsultantFilter] = useState<string>('all');
  const [jobFilter, setJobFilter] = useState<string>('all');
  const [jobs, setJobs] = useState<{id: number, label: string}[]>([]);
  const [todayOnly, setTodayOnly] = useState<boolean>(false);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', position: '', email: '', phone: '', location: '', years: '', skills: '', notes: '' });
  const [addLoading, setAddLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 載入候選人資料
  useEffect(() => {
    if (userProfile) {
      loadCandidates();
    }
  }, [userProfile]);
  
  // 載入職缺列表（供篩選用）
  useEffect(() => {
    fetch(getApiUrl('/jobs'))
      .then(r => r.json())
      .then(data => {
        const list = (data.data || data || [])
          .filter((j: any) => j.job_status !== '已關閉')
          .map((j: any) => ({
            id: j.id,
            label: `${j.position_name}${j.client_company ? ` (${j.client_company})` : ''}`
          }));
        setJobs(list);
      })
      .catch(() => {});
  }, []);

  // 套用篩選
  useEffect(() => {
    applyFilters();
  }, [candidates, searchQuery, statusFilter, sourceFilter, consultantFilter, jobFilter, todayOnly]);
  
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
      // 清除快取，直接從 SQL 重新載入（SQL 是唯一資料來源）
      clearCache();
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

    // 職缺篩選（用 targetJobId 比對）
    if (jobFilter !== 'all') {
      filtered = filtered.filter(c =>
        (c as any).targetJobId?.toString() === jobFilter
      );
    }

    // 今日新增篩選（台北時間 YYYY-MM-DD）
    if (todayOnly) {
      const todayTW = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' }); // YYYY-MM-DD
      filtered = filtered.filter(c => {
        const dateStr = (c as any).auto_sourced_at || c.createdAt || '';
        if (!dateStr) return false;
        // 若是 UTC 格式（含 Z 或 +00:00），轉成台灣時區再比較
        const localDate = (dateStr.endsWith('Z') || dateStr.includes('+00:00'))
          ? new Date(dateStr).toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
          : dateStr.slice(0, 10);
        return localDate === todayTW;
      });
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
  
  // 指派候選人給自己（直接 API）
  const handleAssignToMe = async (candidate: Candidate, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!userProfile) return;
    try {
      await apiPatch(`/api/candidates/${candidate.id}`, {
        recruiter: userProfile.displayName,
        actor: userProfile.displayName,
      });
      setCandidates(prev =>
        prev.map(c => c.id === candidate.id ? { ...c, consultant: userProfile.displayName } : c)
      );
    } catch (error) {
      alert('❌ 指派失敗，請稍後再試');
    }
  };

  // 匯出 CSV
  const handleExportCsv = () => {
    const headers = ['姓名', '職稱', 'Email', '電話', '地點', '年資', '技能', '狀態', '顧問', '備註'];
    const rows = filteredCandidates.map(c => [
      c.name, c.position, c.email, c.phone, c.location,
      String(c.years),
      Array.isArray(c.skills) ? c.skills.join(', ') : (c.skills || ''),
      c.status, c.consultant || '', c.notes || '',
    ]);
    const csv = [headers, ...rows]
      .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `candidates-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  // 匯入 CSV
  const handleImportCsvChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImportLoading(true);
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) throw new Error('CSV 至少需要標題列和一筆資料');

      const parseRow = (line: string) =>
        [...line.matchAll(/("(?:[^"]|"")*"|[^,]*),?/g)]
          .slice(0, -1)
          .map(m => m[1].replace(/^"|"$/g, '').replace(/""/g, '"').trim());

      const headers = parseRow(lines[0]);
      const candidatesList = lines.slice(1)
        .map(line => {
          const vals = parseRow(line);
          const obj: Record<string, string> = {};
          headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
          return obj;
        })
        .filter(c => c['姓名'] || c['name'])
        .map(c => ({
          name: c['姓名'] || c['name'],
          position: c['職稱'] || c['position'] || '',
          email: c['Email'] || c['email'] || '',
          phone: c['電話'] || c['phone'] || '',
          location: c['地點'] || c['location'] || '',
          years: parseInt(c['年資'] || c['years'] || '0') || 0,
          skills: c['技能'] || c['skills'] || '',
          notes: c['備註'] || c['notes'] || '',
          recruiter: userProfile.displayName,
          actor: userProfile.displayName,
        }));

      if (candidatesList.length === 0) throw new Error('找不到有效資料（需要「姓名」或「name」欄位）');

      const result = await apiPost<any>('/api/candidates/bulk', {
        candidates: candidatesList,
        actor: userProfile.displayName,
      });

      if (result.success) {
        alert(`✅ 匯入完成！\n新增 ${result.created} 筆，更新 ${result.updated} 筆，失敗 ${result.failed} 筆`);
        clearCache();
        setCandidates(await getCandidates(userProfile));
      }
    } catch (err) {
      alert('❌ 匯入失敗：' + (err as Error).message);
    } finally {
      setImportLoading(false);
    }
  };

  // 新增候選人
  const handleAddCandidate = async () => {
    if (!addForm.name.trim()) { alert('請填寫姓名'); return; }
    setAddLoading(true);
    try {
      const result = await apiPost<any>('/api/candidates', {
        ...addForm,
        years: parseInt(addForm.years) || 0,
        recruiter: userProfile.displayName,
        actor: userProfile.displayName,
        status: '未開始',
      });
      if (result.success) {
        setShowAddModal(false);
        setAddForm({ name: '', position: '', email: '', phone: '', location: '', years: '', skills: '', notes: '' });
        clearCache();
        setCandidates(await getCandidates(userProfile));
      }
    } catch (err) {
      alert('❌ 新增失敗：' + (err as Error).message);
    } finally {
      setAddLoading(false);
    }
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
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
          
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              title="手動更新候選人資料（清除快取）"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? '更新中...' : '重新整理'}
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importLoading}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-60"
            >
              <Upload className="w-4 h-4" />
              {importLoading ? '匯入中...' : '匯入履歷'}
            </button>
            <button
              onClick={handleExportCsv}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Download className="w-4 h-4" />
              匯出 CSV
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              新增候選人
            </button>
            <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleImportCsvChange} />
          </div>
        </div>
      </div>
      
      {/* 篩選區 */}
      <div className="bg-white rounded-lg shadow mb-6">
        {/* 第一行：搜尋 + 下拉篩選 */}
        <div className="p-4 pb-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* 搜尋 */}
            <div className="relative sm:col-span-2 lg:col-span-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜尋姓名、Email、技能..."
                className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
              />
            </div>

            {/* 狀態篩選 */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-gray-50"
            >
              <option value="all">📋 全部狀態</option>
              {Object.entries(CANDIDATE_STATUS_CONFIG).map(([key, config]) => (
                <option key={key} value={key}>{config.label}</option>
              ))}
            </select>

            {/* 職缺篩選 */}
            <select
              value={jobFilter}
              onChange={(e) => setJobFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-gray-50"
            >
              <option value="all">🎯 全部職缺</option>
              {jobs.map(j => (
                <option key={j.id} value={j.id.toString()}>{j.label}</option>
              ))}
            </select>

            {/* 來源篩選 */}
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-gray-50"
            >
              <option value="all">📂 全部來源</option>
              {Object.entries(SOURCE_CONFIG).map(([key, config]) => (
                <option key={key} value={key}>{config.icon} {config.label}</option>
              ))}
            </select>

            {/* 顧問篩選 */}
            <select
              value={consultantFilter}
              onChange={(e) => setConsultantFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-gray-50"
            >
              <option value="all">👤 全部顧問</option>
              <option value="Jacky">Jacky</option>
              <option value="Phoebe">Phoebe</option>
              <option value="Crawler-WebUI">🤖 Crawler-WebUI</option>
            </select>
          </div>
        </div>

        {/* 第二行：快捷篩選標籤 */}
        <div className="px-4 pb-3 pt-0">
          <div className="flex flex-wrap items-center gap-1.5 pt-3 border-t border-gray-100">
            {/* 狀態標籤組 */}
            <span className="text-[10px] text-gray-400 font-medium uppercase mr-1">狀態</span>
            <button
              onClick={() => { setStatusFilter('all'); setTodayOnly(false); }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                statusFilter === 'all' && !todayOnly
                  ? 'bg-gray-700 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              全部
              <span className={`rounded-full px-1.5 text-[10px] ${statusFilter === 'all' && !todayOnly ? 'bg-white bg-opacity-30' : 'bg-gray-300 text-gray-700'}`}>
                {candidates.length}
              </span>
            </button>

            {Object.entries(CANDIDATE_STATUS_CONFIG).map(([key, config]) => {
              const count = candidates.filter(c => c.status === key).length;
              if (count === 0) return null;
              const isActive = statusFilter === key && !todayOnly;
              const activeColors: Record<string, string> = {
                '未開始': 'bg-slate-500 text-white',
                'AI推薦': 'bg-violet-600 text-white',
                '聯繫階段': 'bg-blue-600 text-white',
                '面試階段': 'bg-indigo-600 text-white',
                'Offer': 'bg-amber-500 text-white',
                'on board': 'bg-green-600 text-white',
                '婉拒': 'bg-rose-500 text-white',
                '備選人才': 'bg-purple-600 text-white',
              };
              return (
                <button
                  key={key}
                  onClick={() => { setStatusFilter(key); setTodayOnly(false); }}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    isActive
                      ? (activeColors[key] || 'bg-gray-700 text-white') + ' shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {config.label}
                  <span className={`rounded-full px-1.5 text-[10px] ${isActive ? 'bg-white bg-opacity-30' : 'bg-gray-300 text-gray-700'}`}>
                    {count}
                  </span>
                </button>
              );
            })}

            {/* 分隔線 */}
            <div className="h-4 w-px bg-gray-200 mx-1.5" />

            {/* 來源標籤組 */}
            <span className="text-[10px] text-gray-400 font-medium uppercase mr-1">來源</span>
            {Object.entries(SOURCE_CONFIG).map(([key, config]) => {
              const count = candidates.filter(c => c.source === key).length;
              if (count === 0) return null;
              const isActive = sourceFilter === key;
              return (
                <button
                  key={key}
                  onClick={() => setSourceFilter(isActive ? 'all' : key)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-teal-600 text-white shadow-sm'
                      : 'bg-gray-50 text-gray-500 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  {config.icon} {config.label}
                  <span className={`rounded-full px-1.5 text-[10px] ${isActive ? 'bg-white bg-opacity-30' : 'bg-gray-200 text-gray-600'}`}>
                    {count}
                  </span>
                </button>
              );
            })}

            {/* 分隔線 */}
            <div className="h-4 w-px bg-gray-200 mx-1.5" />

            {/* 今日新增 */}
            <button
              onClick={() => { setTodayOnly(!todayOnly); setStatusFilter('all'); }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                todayOnly
                  ? 'bg-green-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Sparkles className="w-3 h-3" />
              今日新增
              {todayOnly && (
                <span className="bg-white bg-opacity-30 rounded-full px-1.5 text-[10px]">
                  {filteredCandidates.length}
                </span>
              )}
            </button>

            {/* 清除篩選 */}
            {(searchQuery || statusFilter !== 'all' || sourceFilter !== 'all' || consultantFilter !== 'all' || jobFilter !== 'all' || todayOnly) && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                  setSourceFilter('all');
                  setConsultantFilter('all');
                  setJobFilter('all');
                  setTodayOnly(false);
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors"
              >
                <X className="w-3 h-3" />
                清除篩選
              </button>
            )}
          </div>
        </div>
      </div>
      
      {/* 手機版卡片列表 */}
      <div className="block md:hidden space-y-3">
        {filteredCandidates.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <Users className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">沒有候選人</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchQuery || statusFilter !== 'all' || sourceFilter !== 'all' || consultantFilter !== 'all' || jobFilter !== 'all' || todayOnly
                ? (todayOnly && filteredCandidates.length === 0 ? '今日尚無自動匯入的候選人' : '請調整篩選條件')
                : '開始新增候選人吧！'}
            </p>
          </div>
        ) : (
          filteredCandidates.map((candidate) => {
            const statusConfig = CANDIDATE_STATUS_CONFIG[candidate.status] || {
              label: candidate.status || '未知',
              bgColor: 'bg-gray-100',
              textColor: 'text-gray-800'
            };
            return (
              <div
                key={candidate.id}
                className="bg-white rounded-lg shadow p-4 cursor-pointer active:bg-gray-50"
                onClick={() => setSelectedCandidate(candidate)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-semibold text-gray-900">{candidate.name}</div>
                    <div className="text-sm text-gray-600">{candidate.position}</div>
                  </div>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig.bgColor} ${statusConfig.textColor}`}>
                    {statusConfig.label}
                  </span>
                </div>
                {(candidate as any).targetJobLabel && (
                  <div className="text-xs text-indigo-600 mb-1">
                    🎯 {(candidate as any).targetJobLabel}
                  </div>
                )}
                <div className="text-xs text-gray-500 mb-3">
                  顧問：{candidate.consultant || '-'} · {candidate.years > 0 ? `${candidate.years} 年` : '年資未知'}
                </div>
                <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                  {(!candidate.consultant || candidate.consultant === '' || candidate.consultant === '未指派') && (
                    <button
                      onClick={(e) => handleAssignToMe(candidate, e)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-500 text-white text-xs font-medium rounded hover:bg-green-600 transition-colors"
                    >
                      <Shield className="w-3.5 h-3.5" />
                      指派給我
                    </button>
                  )}
                  {onNavigateToMatching && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigateToMatching(candidate.id.toString());
                      }}
                      className="px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 transition-all flex items-center gap-1"
                    >
                      <Sparkles size={14} />
                      AI 配對
                    </button>
                  )}
                  {/* 快速聯繫按鈕 */}
                  {(candidate as any).linkedin_url && (
                    <a
                      href={(candidate as any).linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors"
                      title="開啟 LinkedIn 頁面"
                    >
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
                      聯繫
                    </a>
                  )}
                  {(candidate as any).github_url && !(candidate as any).linkedin_url && (
                    <a
                      href={(candidate as any).github_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-800 text-white text-xs font-medium rounded hover:bg-gray-900 transition-colors"
                      title="開啟 GitHub 頁面"
                    >
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                      GitHub
                    </a>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 桌機版候選人列表 */}
      <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
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
          <table className="min-w-full divide-y divide-gray-200" style={{ minWidth: '900px' }}>
          <thead className="bg-gray-50 sticky top-0 z-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ minWidth: '60px' }}>
                編號
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ minWidth: '180px' }}>
                <div className="flex items-center">
                  姓名
                  <ColumnTooltip {...COLUMN_DESCRIPTIONS.name} />
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ minWidth: '200px' }}>
                <div className="flex items-center">
                  候選人背景
                  <ColumnTooltip {...COLUMN_DESCRIPTIONS.position} />
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ minWidth: '160px' }}>
                <div className="flex items-center">
                  🎯 目標職缺
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ minWidth: '80px' }}>
                <div className="flex items-center">
                  年資
                  <ColumnTooltip {...COLUMN_DESCRIPTIONS.experience} />
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ minWidth: '90px' }}>
                <div className="flex items-center">
                  穩定度
                  <ColumnTooltip {...COLUMN_DESCRIPTIONS.stability} />
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ minWidth: '90px' }}>
                <div className="flex items-center">
                  綜合評級
                  <ColumnTooltip {...COLUMN_DESCRIPTIONS.talentGrade} />
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ minWidth: '160px' }}>
                <div className="flex items-center">
                  聯繫方式
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ minWidth: '100px' }}>
                <div className="flex items-center">
                  狀態
                  <ColumnTooltip {...COLUMN_DESCRIPTIONS.status} />
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ minWidth: '100px' }}>
                <div className="flex items-center">
                  顧問
                  <ColumnTooltip {...COLUMN_DESCRIPTIONS.consultant} />
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ minWidth: '100px' }}>
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
                  <td className="px-4 py-4 whitespace-nowrap">
                    <span className="text-xs font-mono text-gray-400">#{candidate.id}</span>
                  </td>
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

                  {/* 目標職缺 */}
                  <td className="px-6 py-4">
                    {(candidate as any).targetJobLabel ? (
                      <div className="text-sm">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-medium text-xs leading-relaxed">
                          🎯 {(candidate as any).targetJobLabel}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">未指定</span>
                    )}
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {candidate.years > 0 ? `${candidate.years} 年` : <span className="text-gray-400">-</span>}
                    </div>
                    <div className="text-sm text-gray-500">
                      {candidate.jobChanges > 0 ? `${candidate.jobChanges} 次` : <span className="text-gray-400">-</span>}
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    {candidate.stabilityScore > 0 ? (
                      <div className="text-sm">
                        <span className={`font-bold ${
                          candidate.stabilityScore >= 80 ? 'text-green-600' :
                          candidate.stabilityScore >= 60 ? 'text-blue-600' :
                          candidate.stabilityScore >= 40 ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>{candidate.stabilityScore}</span>
                        <span className="text-gray-400 text-xs ml-1">分</span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    {(candidate as any).talent_level ? (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border ${
                        (candidate as any).talent_level === 'S' ? 'bg-purple-100 text-purple-800 border-purple-300' :
                        (candidate as any).talent_level === 'A' ? 'bg-green-100 text-green-800 border-green-300' :
                        (candidate as any).talent_level === 'B' ? 'bg-blue-100 text-blue-800 border-blue-300' :
                        (candidate as any).talent_level === 'C' ? 'bg-yellow-100 text-yellow-800 border-yellow-300' :
                        'bg-gray-100 text-gray-700 border-gray-300'
                      }`}>
                        {(candidate as any).talent_level}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </td>

                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">
                      {(() => {
                        const phoneStr = candidate.phone || '';
                        const emailStr = candidate.email || '';
                        
                        // 分離電話號碼
                        let phone = '';
                        if (phoneStr.includes('/')) {
                          phone = phoneStr.split('/')[0].trim();
                        } else if (/\d/.test(phoneStr) && !phoneStr.toLowerCase().includes('linkedin')) {
                          phone = phoneStr;
                        }
                        
                        // 分離 email
                        let email = '';
                        if (emailStr && emailStr.includes('@')) {
                          email = emailStr;
                        } else if (phoneStr.includes('/')) {
                          const parts = phoneStr.split('/');
                          const emailPart = parts.slice(1).join('/').trim();
                          if (emailPart && emailPart.includes('@')) {
                            email = emailPart;
                          }
                        }
                        
                        return (
                          <div className="space-y-1">
                            {phone && (
                              <div className="text-xs">
                                <span className="text-gray-600">📱 </span>
                                <span className="text-gray-900">{phone}</span>
                              </div>
                            )}
                            {email && (
                              <div className="text-xs">
                                <span className="text-gray-600">✉️ </span>
                                <a href={`mailto:${email}`} className="text-blue-600 hover:underline">
                                  {email}
                                </a>
                              </div>
                            )}
                            {!phone && !email && (
                              <span className="text-xs text-gray-400">未提供</span>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig.bgColor} ${statusConfig.textColor}`}>
                      {statusConfig.label}
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
                      {onNavigateToMatching && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigateToMatching(candidate.id.toString());
                          }}
                          className="px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 transition-all flex items-center gap-1"
                        >
                          <Sparkles size={14} />
                          AI 配對
                        </button>
                      )}
                      {/* 快速聯繫：LinkedIn */}
                      {(candidate as any).linkedin_url && (
                        <a
                          href={(candidate as any).linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors"
                          title="LinkedIn 聯繫"
                        >
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
                          LinkedIn
                        </a>
                      )}
                      {/* 快速聯繫：GitHub（無 LinkedIn 時顯示） */}
                      {(candidate as any).github_url && !(candidate as any).linkedin_url && (
                        <a
                          href={(candidate as any).github_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-800 text-white text-xs font-medium rounded hover:bg-gray-900 transition-colors"
                          title="GitHub 頁面"
                        >
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                          GitHub
                        </a>
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
              {searchQuery || statusFilter !== 'all' || sourceFilter !== 'all' || consultantFilter !== 'all' || jobFilter !== 'all' || todayOnly
                ? (todayOnly && filteredCandidates.length === 0 ? '今日尚無自動匯入的候選人' : '請調整篩選條件')
                : '開始新增候選人吧！'}
            </p>
          </div>
        )}
      </div>
      {/* 桌機版列表結束 */}

      {/* Candidate Detail Modal */}
      {selectedCandidate && (
        <CandidateModal
          candidate={selectedCandidate}
          onClose={() => setSelectedCandidate(null)}
          currentUserName={userProfile.displayName}
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
          onAssignRecruiter={(candidateId, recruiter) => {
            setCandidates(prev =>
              prev.map(c => c.id === candidateId ? { ...c, consultant: recruiter } : c)
            );
          }}
        />
      )}

      {/* 新增候選人 Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-bold text-slate-900">新增候選人</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">姓名 *</label>
                  <input value={addForm.name} onChange={e => setAddForm(p => ({...p, name: e.target.value}))} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="王小明" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">應徵職位</label>
                  <input value={addForm.position} onChange={e => setAddForm(p => ({...p, position: e.target.value}))} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Frontend Engineer" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Email</label>
                  <input value={addForm.email} onChange={e => setAddForm(p => ({...p, email: e.target.value}))} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="wang@example.com" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">電話</label>
                  <input value={addForm.phone} onChange={e => setAddForm(p => ({...p, phone: e.target.value}))} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="0912-345-678" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">地點</label>
                  <input value={addForm.location} onChange={e => setAddForm(p => ({...p, location: e.target.value}))} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="台北" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">年資（年）</label>
                  <input type="number" min="0" value={addForm.years} onChange={e => setAddForm(p => ({...p, years: e.target.value}))} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="5" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">技能</label>
                <input value={addForm.skills} onChange={e => setAddForm(p => ({...p, skills: e.target.value}))} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="React, TypeScript, Node.js" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">備註</label>
                <textarea value={addForm.notes} onChange={e => setAddForm(p => ({...p, notes: e.target.value}))} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" rows={3} placeholder="其他備註..." />
              </div>
              <p className="text-xs text-slate-400">負責顧問：{userProfile.displayName}（自動帶入）</p>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t">
              <button onClick={() => setShowAddModal(false)} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">取消</button>
              <button onClick={handleAddCandidate} disabled={addLoading} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {addLoading ? '新增中...' : '新增候選人'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
