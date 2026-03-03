// Step1ne Headhunter System - 候選人詳情 Modal
import React, { useState } from 'react';
import { Candidate, CandidateStatus, AiMatchResult } from '../types';
import { CANDIDATE_STATUS_CONFIG } from '../constants';
import { apiPatch, apiGet, getApiUrl } from '../config/api';
import {
  X, User, Mail, Phone, MapPin, Briefcase, Calendar,
  TrendingUp, Award, FileText, MessageSquare, Clock,
  CheckCircle2, AlertCircle, Bot, Star, ThumbsUp, ThumbsDown,
  HelpCircle, Sparkles, Target
} from 'lucide-react';

interface CandidateModalProps {
  candidate: Candidate;
  onClose: () => void;
  onUpdateStatus?: (candidateId: string, newStatus: CandidateStatus) => void;
  currentUserName?: string;
  onAssignRecruiter?: (candidateId: string, recruiter: string) => void;
  onCandidateUpdate?: (candidateId: string, updates: Partial<Candidate>) => void;
}

export function CandidateModal({ candidate, onClose, onUpdateStatus, currentUserName, onAssignRecruiter, onCandidateUpdate }: CandidateModalProps) {
  const [activeTab, setActiveTab] = useState<'info' | 'history' | 'notes' | 'ai_match'>('info');
  const [showResume, setShowResume] = useState(false);
  const [addingProgress, setAddingProgress] = useState(false);
  const [newProgressEvent, setNewProgressEvent] = useState('');
  const [newProgressNote, setNewProgressNote] = useState('');
  const [showInviteMessage, setShowInviteMessage] = useState(false);
  const [inviteMessage, setInviteMessage] = useState('');
  const [editingRecruiter, setEditingRecruiter] = useState(false);
  const [recruiterInput, setRecruiterInput] = useState(candidate.consultant || '');
  const [newNoteText, setNewNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [localNotes, setLocalNotes] = useState(candidate.notes || '');
  // 目標職缺
  const [editingTargetJob, setEditingTargetJob] = useState(false);
  const [targetJobInput, setTargetJobInput] = useState(() => {
    const notes = candidate.notes || '';
    const m = notes.match(/目標職缺：(.+?)(?:\s*\||\s*$)/);
    return m ? m[1].trim() : '';
  });
  const [savingTargetJob, setSavingTargetJob] = useState(false);
  const [editingLinkedin, setEditingLinkedin] = useState(false);
  const [editingGithub, setEditingGithub] = useState(false);
  const [linkedinInput, setLinkedinInput] = useState((candidate as any).linkedinUrl || '');
  const [githubInput, setGithubInput] = useState((candidate as any).githubUrl || '');
  const [savingLinkedin, setSavingLinkedin] = useState(false);
  const [savingGithub, setSavingGithub] = useState(false);
  const [enrichedCandidate, setEnrichedCandidate] = useState(candidate);

  // 負責顧問 / 目標職缺 下拉清單
  const [users, setUsers] = useState<string[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [recruiterSearch, setRecruiterSearch] = useState('');
  const [jobs, setJobs] = useState<{ id: number; position_name: string; client_company: string }[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [targetJobSearch, setTargetJobSearch] = useState('');

  // 禁止背景滾動
  React.useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);
  
  // 重新 fetch 候選人資料以獲得最新的 aiMatchResult
  React.useEffect(() => {
    const fetchLatest = async () => {
      try {
        const response = await fetch(getApiUrl(`/candidates/${candidate.id}`));
        if (response.ok) {
          const result = await response.json();
          const data = result.data || {};
          // 合併後端資料到 candidate，確保 aiMatchResult 存在
          setEnrichedCandidate({
            ...candidate,
            aiMatchResult: data.ai_match_result || data.aiMatchResult || candidate.aiMatchResult || null
          });
        }
      } catch (error) {
        console.error('Fetch candidate detail failed:', error);
        setEnrichedCandidate(candidate);
      }
    };
    fetchLatest();
  }, [candidate.id, candidate]);

  // 預載入顧問清單與職缺清單
  React.useEffect(() => {
    setLoadingUsers(true);
    apiGet<{ success: boolean; data: string[] }>('/api/users')
      .then(res => { if (res.success) setUsers(res.data); })
      .catch(() => {})
      .finally(() => setLoadingUsers(false));

    setLoadingJobs(true);
    apiGet<any>('/api/jobs')
      .then(res => {
        const arr = Array.isArray(res) ? res : (res.data || []);
        setJobs(arr.map((j: any) => ({ id: j.id, position_name: j.position_name || '', client_company: j.client_company || '' })));
      })
      .catch(() => {})
      .finally(() => setLoadingJobs(false));
  }, []);

  // 新增進度記錄
  const handleAddProgress = async (eventType: string) => {
    setNewProgressEvent(eventType);
    setAddingProgress(true);
  };
  
  // 進度事件 → 候選人狀態映射（與 Pipeline 階段一致）
  const eventToStatus: Record<string, string> = {
    '未開始':  '未開始',
    'AI推薦':  'AI推薦',
    '已聯繫':  '已聯繫',
    '已面試':  '已面試',
    'Offer':   'Offer',
    '已上職':  '已上職',
    '婉拒':    '婉拒',
    '備選人才': '備選人才',
  };

  // 確認新增進度
  const handleConfirmAddProgress = async () => {
    if (!newProgressEvent) return;

    try {
      const user = JSON.parse(localStorage.getItem('step1ne-user') || '{}');
      const userName = user.name || 'Unknown';

      const newEvent = {
        date: new Date().toISOString().split('T')[0],
        event: newProgressEvent,
        by: userName,
        ...(newProgressNote ? { note: newProgressNote } : {})
      };

      const updatedProgress = [...(candidate.progressTracking || []), newEvent];
      const newStatus = eventToStatus[newProgressEvent] || candidate.status;

      // 用 PATCH 同時更新 status + progressTracking
      await apiPatch(`/api/candidates/${candidate.id}`, {
        status: newStatus,
        progressTracking: updatedProgress,
        actor: currentUserName || userName,
      });

      alert('✅ 進度新增成功！看板與 Pipeline 欄位已同步更新');
      window.location.reload();

    } catch (error) {
      console.error('❌ 新增進度失敗:', error);
      alert('❌ 新增進度失敗，請稍後再試');
    } finally {
      setAddingProgress(false);
      setNewProgressEvent('');
      setNewProgressNote('');
    }
  };
  
  // Task A: 生成 GitHub 候選人邀請訊息
  const handleGenerateInviteMessage = () => {
    const skills = Array.isArray(candidate.skills) 
      ? candidate.skills 
      : candidate.skills.split(/[、,，]/);
    
    const topSkills = skills.slice(0, 3).join('、');
    const targetJob = candidate.notes?.match(/應徵：(.+?) \((.+?)\)/);
    const jobTitle = targetJob ? targetJob[1] : '相關職位';
    const companyName = targetJob ? targetJob[2] : '我們公司';
    
    const message = `Hi ${candidate.name}，

我在 GitHub 上看到您的專案，對您的 ${topSkills} 技術能力印象深刻！

我們目前有一個 ${jobTitle} 的機會，工作內容與您的技術背景非常匹配。${companyName} 是一家【公司簡介】，團隊氛圍開放，技術棧包括【技術棧】。

如果您有興趣了解更多，歡迎回覆這封訊息或加我 LinkedIn，我們可以安排時間聊聊！

期待與您交流 😊

---
最佳問候
${JSON.parse(localStorage.getItem('step1ne-user') || '{}').name || 'HR Team'}
Step1ne Recruitment`;
    
    setInviteMessage(message);
    setShowInviteMessage(true);
  };
  
  // 指派/更新負責顧問
  const handleSaveRecruiter = async () => {
    try {
      await apiPatch(`/api/candidates/${candidate.id}`, {
        recruiter: recruiterInput,
        actor: currentUserName || 'system',
      });
      candidate.consultant = recruiterInput;
      onAssignRecruiter?.(candidate.id, recruiterInput);
      setEditingRecruiter(false);
    } catch (err) {
      alert('❌ 指派失敗，請稍後再試');
    }
  };

  // 儲存目標職缺（更新 notes 中的目標職缺欄位）
  const handleSaveTargetJob = async () => {
    setSavingTargetJob(true);
    try {
      const currentNotes = localNotes;
      const newValue = targetJobInput.trim();
      let newNotes: string;
      if (/目標職缺：/.test(currentNotes)) {
        // 替換現有值
        newNotes = currentNotes.replace(/目標職缺：.+?(?=\s*\||$)/, `目標職缺：${newValue}`);
      } else {
        // 在 notes 前加入
        newNotes = newValue
          ? (currentNotes ? `目標職缺：${newValue} | ${currentNotes}` : `目標職缺：${newValue}`)
          : currentNotes;
      }
      await apiPatch(`/api/candidates/${candidate.id}`, {
        notes: newNotes,
        actor: currentUserName || 'system',
      });
      setLocalNotes(newNotes);
      setEditingTargetJob(false);
      onCandidateUpdate?.(candidate.id, { notes: newNotes });
    } catch (err) {
      alert('❌ 儲存目標職缺失敗，請稍後再試');
    } finally {
      setSavingTargetJob(false);
    }
  };

  // 儲存新備註（附加到現有備註後）
  const handleSaveNote = async () => {
    if (!newNoteText.trim()) return;
    setSavingNote(true);
    try {
      const timestamp = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false });
      const author = currentUserName || JSON.parse(localStorage.getItem('step1ne-user') || '{}').name || '顧問';
      const newEntry = `[${timestamp}] ${author}：${newNoteText.trim()}`;
      const merged = localNotes ? `${localNotes}\n${newEntry}` : newEntry;

      await apiPatch(`/api/candidates/${candidate.id}`, {
        notes: merged,
        actor: author,
      });

      setLocalNotes(merged);
      setNewNoteText('');
    } catch (err) {
      alert('❌ 儲存備註失敗，請稍後再試');
    } finally {
      setSavingNote(false);
    }
  };

  // 儲存 LinkedIn URL
  const handleSaveLinkedin = async () => {
    setSavingLinkedin(true);
    try {
      await apiPatch(`/api/candidates/${candidate.id}`, {
        linkedin_url: linkedinInput.trim(),
        actor: currentUserName || 'system',
      });
      (candidate as any).linkedinUrl = linkedinInput.trim();
      setEditingLinkedin(false);
    } catch (err) {
      alert('❌ 儲存 LinkedIn 失敗，請稍後再試');
    } finally {
      setSavingLinkedin(false);
    }
  };

  // 儲存 GitHub URL
  const handleSaveGithub = async () => {
    setSavingGithub(true);
    try {
      await apiPatch(`/api/candidates/${candidate.id}`, {
        github_url: githubInput.trim(),
        actor: currentUserName || 'system',
      });
      (candidate as any).githubUrl = githubInput.trim();
      setEditingGithub(false);
    } catch (err) {
      alert('❌ 儲存 GitHub 失敗，請稍後再試');
    } finally {
      setSavingGithub(false);
    }
  };

  // 複製邀請訊息到剪貼簿
  const handleCopyInviteMessage = () => {
    navigator.clipboard.writeText(inviteMessage).then(() => {
      alert('✅ 邀請訊息已複製到剪貼簿！');
    }).catch(err => {
      console.error('複製失敗:', err);
      alert('❌ 複製失敗，請手動複製');
    });
  };
  
  const getStabilityGrade = (score: number) => {
    if (score >= 80) return { grade: 'A', color: 'text-green-600', bg: 'bg-green-50' };
    if (score >= 60) return { grade: 'B', color: 'text-blue-600', bg: 'bg-blue-50' };
    if (score >= 40) return { grade: 'C', color: 'text-yellow-600', bg: 'bg-yellow-50' };
    if (score >= 20) return { grade: 'D', color: 'text-orange-600', bg: 'bg-orange-50' };
    return { grade: 'F', color: 'text-red-600', bg: 'bg-red-50' };
  };
  
  const stability = getStabilityGrade(candidate.stabilityScore);
  
  // 安全地取得狀態配置（加上 fallback）
  const currentStatus = CANDIDATE_STATUS_CONFIG[candidate.status] || {
    label: candidate.status || '未知',
    color: 'gray',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-800',
    borderColor: 'border-gray-300'
  };
  
  // 解析工作經歷（支援純文字與 JSON 格式）
  const workHistory = (() => {
    if (!candidate.workHistory) return [];
    
    const rawHistory = candidate.workHistory;
    
    // 嘗試 JSON 格式
    if (typeof rawHistory === 'object' && Array.isArray(rawHistory)) {
      return rawHistory;
    }
    
    if (typeof rawHistory === 'string') {
      // 嘗試解析 JSON 字串
      try {
        const parsed = JSON.parse(rawHistory);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
      
      // 解析純文字格式：「公司名 時間(起-訖): 職位描述; 公司名 時間(起-訖): 職位描述」
      const jobs = rawHistory.split(';').map(job => {
        const trimmed = job.trim();
        if (!trimmed) return null;
        
        // 提取：公司名 時間(...): 職位描述
        const match = trimmed.match(/^(.+?)\s+(\d+年?)?\(([^)]+)\):\s*(.+)$/);
        if (match) {
          const [, company, duration, period, description] = match;
          return {
            company: company.trim(),
            duration: duration?.trim() || '',
            period: period.trim(),
            description: description.trim()
          };
        }
        
        // 簡化格式：公司名: 職位描述
        const simpleMatch = trimmed.match(/^(.+?):\s*(.+)$/);
        if (simpleMatch) {
          return {
            company: simpleMatch[1].trim(),
            duration: '',
            period: '',
            description: simpleMatch[2].trim()
          };
        }
        
        return null;
      }).filter(Boolean);
      
      return jobs;
    }
    
    return [];
  })();
  
  // 解析教育背景 JSON（使用 educationJson 欄位）
  const education = candidate.educationJson || [];
  
  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        className="bg-white rounded-xl shadow-2xl w-[95vw] sm:w-full max-w-4xl h-[95vh] sm:h-[90vh] overflow-hidden flex flex-col mx-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-3 sm:p-6 flex-shrink-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-2 sm:gap-3 mb-2">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                  <User className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                    <h2 className="text-lg sm:text-2xl font-bold truncate">{candidate.name}</h2>
                    <span className="text-[10px] sm:text-xs font-mono bg-white/20 text-white/80 px-1.5 sm:px-2 py-0.5 rounded shrink-0">#{candidate.id}</span>
                  </div>
                  <p className="text-blue-100 text-xs sm:text-sm truncate">候選人背景：{candidate.position}</p>
                </div>
              </div>
              
              {/* Quick Stats */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-2 sm:mt-4 text-[10px] sm:text-sm">
                <div className="flex items-center gap-0.5 sm:gap-1.5 whitespace-nowrap">
                  <MapPin className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
                  <span className="truncate">{candidate.location}</span>
                </div>
                <div className="flex items-center gap-0.5 sm:gap-1.5 whitespace-nowrap">
                  <Briefcase className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
                  <span>{candidate.years > 0 ? `${candidate.years} 年經驗` : '年資未知'}</span>
                </div>
                <div className={`flex items-center gap-0.5 sm:gap-1.5 px-1.5 sm:px-2 py-0.5 rounded whitespace-nowrap ${currentStatus.bgColor} ${currentStatus.textColor}`}>
                  {currentStatus.label}
                </div>
              </div>
            </div>
            
            <button 
              onClick={onClose}
              className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 sm:p-2 rounded-lg transition-all shrink-0"
            >
              <X className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="border-b border-gray-200 bg-gray-50 overflow-x-auto">
          <div className="flex whitespace-nowrap min-w-max sm:min-w-0">
            <button
              onClick={() => setActiveTab('info')}
              className={`px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'info' 
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-white' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-1 sm:gap-2">
                <FileText className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">基本資訊</span>
                <span className="sm:hidden">資訊</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'history' 
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-white' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-1 sm:gap-2">
                <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">進度追蹤</span>
                <span className="sm:hidden">進度</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('notes')}
              className={`px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'notes'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-1 sm:gap-2">
                <MessageSquare className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">備註紀錄</span>
                <span className="sm:hidden">備註</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('ai_match')}
              className={`px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'ai_match'
                  ? 'text-violet-600 border-b-2 border-violet-600 bg-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-1 sm:gap-2">
                <Sparkles className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">AI 匹配結語</span>
                <span className="sm:hidden">AI評分</span>
                {candidate.aiMatchResult && (
                  <span className="text-[8px] sm:text-[10px] px-1 sm:px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 font-bold">
                    {candidate.aiMatchResult.score}
                  </span>
                )}
              </div>
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {activeTab === 'info' && (
            <div className="space-y-6">
              {/* 負責顧問 */}
              <div className="bg-indigo-50 rounded-lg border border-indigo-100">
                <div className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <User className="w-4 h-4 text-indigo-500 shrink-0" />
                    <span className="text-xs text-indigo-600 font-medium shrink-0">負責顧問</span>
                    {!editingRecruiter && (
                      <span className="ml-2 text-sm font-semibold text-indigo-900 truncate">
                        {recruiterInput || '未指派'}
                      </span>
                    )}
                    {editingRecruiter && recruiterInput && (
                      <span className="ml-2 text-xs text-indigo-700 font-medium truncate">已選：{recruiterInput}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {editingRecruiter ? (
                      <>
                        <button onClick={handleSaveRecruiter} className="text-xs px-2 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700">儲存</button>
                        <button onClick={() => { setEditingRecruiter(false); setRecruiterInput(candidate.consultant || ''); setRecruiterSearch(''); }} className="text-xs px-2 py-1 border border-slate-200 rounded text-slate-600 hover:bg-slate-50">取消</button>
                      </>
                    ) : (
                      <>
                        {currentUserName && (
                          <button
                            onClick={() => { setRecruiterInput(currentUserName); setRecruiterSearch(currentUserName); setEditingRecruiter(true); }}
                            className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                          >
                            指派給我
                          </button>
                        )}
                        <button onClick={() => { setRecruiterSearch(recruiterInput); setEditingRecruiter(true); }} className="text-xs px-2 py-1 border border-indigo-200 rounded text-indigo-600 hover:bg-indigo-100">
                          更改
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {editingRecruiter && (
                  <div className="px-3 pb-3">
                    <input
                      value={recruiterSearch}
                      onChange={e => setRecruiterSearch(e.target.value)}
                      className="border border-indigo-300 rounded px-2 py-1 text-sm w-full focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      placeholder="搜尋顧問..."
                      autoFocus
                    />
                    <div className="mt-1 max-h-36 overflow-y-auto border border-indigo-200 rounded bg-white">
                      {loadingUsers ? (
                        <div className="px-3 py-2 text-xs text-gray-400">載入中...</div>
                      ) : users.filter(u => !recruiterSearch || u.toLowerCase().includes(recruiterSearch.toLowerCase())).length === 0 ? (
                        <div className="px-3 py-2 text-xs text-gray-400">無符合的顧問</div>
                      ) : (
                        users
                          .filter(u => !recruiterSearch || u.toLowerCase().includes(recruiterSearch.toLowerCase()))
                          .map(u => (
                            <button
                              key={u}
                              onClick={() => setRecruiterInput(u)}
                              className={`w-full text-left px-3 py-1.5 text-sm hover:bg-indigo-50 transition-colors ${recruiterInput === u ? 'bg-indigo-100 font-medium text-indigo-700' : 'text-gray-700'}`}
                            >
                              {u}
                            </button>
                          ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 目標職缺 */}
              <div className="bg-amber-50 rounded-lg border border-amber-100">
                <div className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Target className="w-4 h-4 text-amber-500 shrink-0" />
                    <span className="text-xs text-amber-600 font-medium shrink-0">目標職缺</span>
                    {!editingTargetJob && (
                      <span className="ml-2 text-sm font-semibold text-amber-900 truncate">
                        {targetJobInput || '未指定'}
                      </span>
                    )}
                    {editingTargetJob && targetJobInput && (
                      <span className="ml-2 text-xs text-amber-700 font-medium truncate max-w-[140px]">已選：{targetJobInput}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {editingTargetJob ? (
                      <>
                        <button onClick={handleSaveTargetJob} disabled={savingTargetJob} className="text-xs px-2 py-1 bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-60">
                          {savingTargetJob ? '儲存中...' : '儲存'}
                        </button>
                        <button onClick={() => { setEditingTargetJob(false); setTargetJobSearch(''); }} className="text-xs px-2 py-1 border border-slate-200 rounded text-slate-600 hover:bg-slate-50">取消</button>
                      </>
                    ) : (
                      <button onClick={() => { setTargetJobSearch(''); setEditingTargetJob(true); }} className="text-xs px-2 py-1 border border-amber-200 rounded text-amber-600 hover:bg-amber-100">
                        {targetJobInput ? '更改' : '指定'}
                      </button>
                    )}
                  </div>
                </div>
                {editingTargetJob && (
                  <div className="px-3 pb-3">
                    <input
                      value={targetJobSearch}
                      onChange={e => setTargetJobSearch(e.target.value)}
                      className="border border-amber-300 rounded px-2 py-1 text-sm w-full focus:outline-none focus:ring-1 focus:ring-amber-500"
                      placeholder="搜尋職缺名稱或公司..."
                      autoFocus
                    />
                    <div className="mt-1 max-h-40 overflow-y-auto border border-amber-200 rounded bg-white">
                      {loadingJobs ? (
                        <div className="px-3 py-2 text-xs text-gray-400">載入中...</div>
                      ) : jobs.filter(j => !targetJobSearch || `${j.position_name} ${j.client_company}`.toLowerCase().includes(targetJobSearch.toLowerCase())).length === 0 ? (
                        <div className="px-3 py-2 text-xs text-gray-400">無符合的職缺</div>
                      ) : (
                        jobs
                          .filter(j => !targetJobSearch || `${j.position_name} ${j.client_company}`.toLowerCase().includes(targetJobSearch.toLowerCase()))
                          .map(j => (
                            <button
                              key={j.id}
                              onClick={() => setTargetJobInput(j.position_name)}
                              className={`w-full text-left px-3 py-2 text-sm hover:bg-amber-50 transition-colors border-b border-gray-50 last:border-0 ${targetJobInput === j.position_name ? 'bg-amber-100 text-amber-700' : 'text-gray-700'}`}
                            >
                              <div className="font-medium">{j.position_name}</div>
                              {j.client_company && <div className="text-xs text-gray-500 mt-0.5">{j.client_company}</div>}
                            </button>
                          ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Contact Info - 智能分離電話 + Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 電話號碼 */}
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <Phone className="w-5 h-5 text-gray-400" />
                  <div>
                    <div className="text-xs text-gray-500">電話</div>
                    <div className="font-medium text-sm">
                      {(() => {
                        // 嘗試從 phone 欄位分離出電話號碼
                        const phoneStr = candidate.phone || '';
                        const emailStr = candidate.email || '';
                        
                        // 如果 phone 包含 / 或 @，可能是混合格式
                        if (phoneStr.includes('/')) {
                          const parts = phoneStr.split('/');
                          const phoneNum = parts[0].trim();
                          return phoneNum || '未提供';
                        }
                        
                        // 如果 phone 是 LinkedIn/GitHub 格式，返回 N/A
                        if (phoneStr.toLowerCase().includes('linkedin') || phoneStr.toLowerCase().includes('github')) {
                          return '未提供';
                        }
                        
                        // 檢查是否是電話號碼格式（含數字）
                        if (/\d/.test(phoneStr)) {
                          return phoneStr;
                        }
                        
                        return '未提供';
                      })()}
                    </div>
                  </div>
                </div>
                
                {/* Email */}
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <Mail className="w-5 h-5 text-gray-400" />
                  <div>
                    <div className="text-xs text-gray-500">Email / 聯絡</div>
                    <div className="font-medium text-sm break-all">
                      {(() => {
                        const phoneStr = candidate.phone || '';
                        const emailStr = candidate.email || '';
                        
                        // 優先檢查 email 欄位
                        if (emailStr && emailStr.includes('@')) {
                          return (
                            <a href={`mailto:${emailStr}`} className="text-blue-600 hover:underline">
                              {emailStr}
                            </a>
                          );
                        }
                        
                        // 從 phone 欄位分離 email（包含 / 的格式）
                        if (phoneStr.includes('/')) {
                          const parts = phoneStr.split('/');
                          const email = parts.slice(1).join('/').trim();
                          if (email && email.includes('@')) {
                            return (
                              <a href={`mailto:${email}`} className="text-blue-600 hover:underline">
                                {email}
                              </a>
                            );
                          }
                        }
                        
                        // 檢查 LinkedIn
                        if (phoneStr.toLowerCase().includes('linkedin')) {
                          const username = phoneStr.replace(/^(LinkedIn|linkedin):\s*/i, '').trim();
                          const linkedinUrl = username.startsWith('http') 
                            ? username 
                            : `https://www.linkedin.com/in/${username}`;
                          return (
                            <a 
                              href={linkedinUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline flex items-center gap-1"
                            >
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                              </svg>
                              LinkedIn
                            </a>
                          );
                        }
                        
                        return emailStr || '未提供';
                      })()}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* 外部連結：LinkedIn / GitHub / Google Drive（始終顯示，可編輯） */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">外部連結</h3>

                {/* LinkedIn */}
                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <svg className="w-5 h-5 text-blue-600 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                  </svg>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-500 mb-1">LinkedIn</div>
                    {editingLinkedin ? (
                      <div className="flex items-center gap-2">
                        <input
                          value={linkedinInput}
                          onChange={e => setLinkedinInput(e.target.value)}
                          placeholder="https://linkedin.com/in/username"
                          className="flex-1 border border-blue-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                          autoFocus
                        />
                        <button onClick={handleSaveLinkedin} disabled={savingLinkedin} className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-60">儲存</button>
                        <button onClick={() => { setEditingLinkedin(false); setLinkedinInput((candidate as any).linkedinUrl || ''); }} className="text-xs px-2 py-1 border border-slate-200 rounded text-slate-600 hover:bg-slate-50">取消</button>
                      </div>
                    ) : linkedinInput ? (
                      <div className="flex items-center gap-2">
                        <a href={linkedinInput} target="_blank" rel="noopener noreferrer"
                          className="text-sm font-medium text-blue-600 hover:underline truncate flex-1">
                          {linkedinInput}
                        </a>
                        <button onClick={() => setEditingLinkedin(true)} className="text-xs px-2 py-0.5 border border-blue-200 rounded text-blue-600 hover:bg-blue-100 shrink-0">編輯</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-400 italic flex-1">未設定</span>
                        <button onClick={() => setEditingLinkedin(true)} className="text-xs px-2 py-0.5 border border-blue-200 rounded text-blue-600 hover:bg-blue-100 shrink-0">+ 新增</button>
                      </div>
                    )}
                  </div>
                </div>

                {/* GitHub */}
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <svg className="w-5 h-5 text-gray-700 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-500 mb-1">GitHub</div>
                    {editingGithub ? (
                      <div className="flex items-center gap-2">
                        <input
                          value={githubInput}
                          onChange={e => setGithubInput(e.target.value)}
                          placeholder="https://github.com/username"
                          className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-gray-500"
                          autoFocus
                        />
                        <button onClick={handleSaveGithub} disabled={savingGithub} className="text-xs px-2 py-1 bg-gray-700 text-white rounded hover:bg-gray-800 disabled:opacity-60">儲存</button>
                        <button onClick={() => { setEditingGithub(false); setGithubInput((candidate as any).githubUrl || ''); }} className="text-xs px-2 py-1 border border-slate-200 rounded text-slate-600 hover:bg-slate-50">取消</button>
                      </div>
                    ) : githubInput ? (
                      <div className="flex items-center gap-2">
                        <a href={githubInput} target="_blank" rel="noopener noreferrer"
                          className="text-sm font-medium text-gray-700 hover:underline truncate flex-1">
                          {githubInput}
                        </a>
                        <button onClick={() => setEditingGithub(true)} className="text-xs px-2 py-0.5 border border-gray-200 rounded text-gray-600 hover:bg-gray-100 shrink-0">編輯</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-400 italic flex-1">未設定</span>
                        <button onClick={() => setEditingGithub(true)} className="text-xs px-2 py-0.5 border border-gray-200 rounded text-gray-600 hover:bg-gray-100 shrink-0">+ 新增</button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Google Drive 履歷 */}
                {candidate.resumeLink && (
                  <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                    <FileText className="w-5 h-5 text-green-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-gray-500">完整履歷（Google Drive）</div>
                      <a href={candidate.resumeLink} target="_blank" rel="noopener noreferrer"
                        className="text-sm font-medium text-green-700 hover:underline truncate block">
                        查看完整履歷 →
                      </a>
                    </div>
                  </div>
                )}
              </div>
              
              {/* 穩定度 & 綜合評級 並排 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 穩定度 */}
                <div className={`p-4 rounded-lg border-2 ${stability.bg}`}>
                  <div className="flex items-center gap-1 mb-2">
                    <TrendingUp className={`w-4 h-4 ${stability.color}`} />
                    <span className="text-xs font-semibold text-gray-600">穩定度評分</span>
                    <div className="relative group ml-1">
                      <div className="w-4 h-4 rounded-full bg-gray-200 text-gray-500 text-xs flex items-center justify-center cursor-help select-none">?</div>
                      <div className="absolute left-0 bottom-6 w-56 bg-gray-800 text-white text-xs rounded-lg p-2.5 hidden group-hover:block z-20 shadow-lg leading-relaxed">
                        <p className="font-semibold mb-1">穩定度評分說明</p>
                        <p>基於轉職次數、平均任期與工作年資計算（20-100分）</p>
                        <p className="mt-1">🟢 80+分 A級 穩定</p>
                        <p>🔵 60-79分 B級 一般</p>
                        <p>🟡 40-59分 C級 頻繁轉職</p>
                        <p>🔴 &lt;40分 D級 不穩定</p>
                      </div>
                    </div>
                  </div>
                  <div className={`text-2xl font-bold ${stability.color}`}>
                    {candidate.stabilityScore > 0 ? candidate.stabilityScore : '—'}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {candidate.stabilityScore > 0 ? `${stability.grade} 級` : '待評分'} · 離職 {candidate.jobChanges} 次 · 平均 {(candidate.years / Math.max(candidate.jobChanges, 1)).toFixed(1)} 年
                  </div>
                </div>

                {/* 綜合評級 */}
                <div className="p-4 rounded-lg border-2 bg-purple-50 border-purple-200">
                  <div className="flex items-center gap-1 mb-2">
                    <Award className="w-4 h-4 text-purple-600" />
                    <span className="text-xs font-semibold text-gray-600">綜合評級</span>
                    <div className="relative group ml-1">
                      <div className="w-4 h-4 rounded-full bg-gray-200 text-gray-500 text-xs flex items-center justify-center cursor-help select-none">?</div>
                      <div className="absolute left-0 bottom-6 w-60 bg-gray-800 text-white text-xs rounded-lg p-2.5 hidden group-hover:block z-20 shadow-lg leading-relaxed">
                        <p className="font-semibold mb-1">綜合評級說明</p>
                        <p>由 AI 分析技能、年資、學歷、穩定性等 6 大維度後填入</p>
                        <p className="mt-1">🟣 S（90+）頂尖人才（稀缺）</p>
                        <p>🟢 A+（80-89）優秀（強力推薦）</p>
                        <p>🔵 A（70-79）合格（可推薦）</p>
                        <p>🟡 B（60-69）基本合格</p>
                        <p>⚪ C（&lt;60）需補強</p>
                      </div>
                    </div>
                  </div>
                  {(candidate as any).talent_level ? (
                    <div className={`text-2xl font-bold ${
                      (candidate as any).talent_level === 'S' ? 'text-purple-700' :
                      (candidate as any).talent_level.startsWith('A') ? 'text-green-700' :
                      (candidate as any).talent_level === 'B' ? 'text-blue-700' :
                      'text-gray-600'
                    }`}>
                      {(candidate as any).talent_level}
                    </div>
                  ) : (
                    <div className="text-2xl font-bold text-gray-300">—</div>
                  )}
                  <div className="text-xs text-gray-500 mt-1">
                    {(candidate as any).talent_level ? '已評分' : '待 AI 分析後填入'}
                  </div>
                </div>
              </div>
              
              {/* Skills */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <Award className="w-5 h-5 text-blue-600" />
                  核心技能
                </h3>
                <div className="flex flex-wrap gap-2">
                  {(Array.isArray(candidate.skills) 
                    ? candidate.skills 
                    : candidate.skills.split(/[、,，]/)
                  ).map((skill, i) => (
                    <span 
                      key={i}
                      className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm"
                    >
                      {skill.trim()}
                    </span>
                  ))}
                </div>
              </div>
              
              {/* Work History */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-blue-600" />
                  💼 工作經歷
                </h3>
                {workHistory.length > 0 ? (
                  <>
                    <div className="text-xs text-gray-500 mb-3">
                      顯示前 {Math.min(3, workHistory.length)} 段工作經歷
                    </div>
                    <div className="space-y-4">
                      {workHistory.slice(0, 3).map((job: any, i: number) => (
                        <div key={i} className="border-l-4 border-blue-400 pl-4 py-2 bg-blue-50/30 rounded-r-lg">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            <div className="font-semibold text-gray-900 text-base">{job.company}</div>
                          </div>
                          
                          {job.period && (
                            <div className="text-sm text-gray-600 mb-2 flex items-center gap-2">
                              <Calendar className="w-3.5 h-3.5 text-gray-400" />
                              {job.duration && <span className="font-medium">{job.duration}</span>}
                              <span>({job.period})</span>
                            </div>
                          )}
                          
                          {job.description && (
                            <div className="text-sm text-gray-700 leading-relaxed mt-2 bg-white/50 p-2 rounded">
                              {job.description}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    
                    {workHistory.length > 3 && (
                      <div className="text-xs text-gray-400 mt-3 text-center">
                        還有 {workHistory.length - 3} 段工作經歷未顯示
                      </div>
                    )}
                  </>
                ) : (
                  <div className="p-4 bg-gray-50 rounded-lg text-center text-gray-500 text-sm">
                    暫無工作經歷資料
                  </div>
                )}
              </div>
              
              {/* Education */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Award className="w-5 h-5 text-blue-600" />
                  教育背景
                </h3>
                {education.length > 0 ? (
                  <div className="space-y-2">
                    {education.map((edu: any, i: number) => (
                      <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                        <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{edu.school}</div>
                          <div className="text-sm text-gray-600">
                            {edu.degree} - {edu.major}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {edu.startYear} ~ {edu.endYear}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 bg-gray-50 rounded-lg text-center text-gray-500 text-sm">
                    暫無教育背景資料
                  </div>
                )}
              </div>
              
              {/* Action Buttons */}
              <div className="flex gap-3">
                {/* Resume Link */}
                {candidate.resumeLink && (
                  <button
                    onClick={() => setShowResume(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                    📄 查看完整履歷
                  </button>
                )}
                
                {/* GitHub Invite Message (Task A) */}
                {candidate.source === 'GitHub' && (
                  <button
                    onClick={handleGenerateInviteMessage}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    <MessageSquare className="w-4 h-4" />
                    💌 生成邀請訊息
                  </button>
                )}
              </div>
              
              {/* Resume Preview Modal */}
              {showResume && candidate.resumeLink && (
                <div
                  className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-sm"
                  onClick={() => setShowResume(false)}
                >
                  <div
                    className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[95vh] sm:h-[90vh] flex flex-col"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Resume Modal Header */}
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4 rounded-t-xl flex items-center justify-between">
                      <h3 className="text-lg font-semibold">
                        {candidate.name} - 完整履歷
                      </h3>
                      <button
                        onClick={() => setShowResume(false)}
                        className="text-white/80 hover:text-white hover:bg-white/10 p-2 rounded-lg transition-all"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    
                    {/* Resume iframe */}
                    <div className="flex-1 overflow-hidden">
                      <iframe
                        src={candidate.resumeLink}
                        className="w-full h-full border-0"
                        title={`${candidate.name} 履歷`}
                      />
                    </div>
                  </div>
                </div>
              )}
              
              {/* GitHub Invite Message Modal (Task A) */}
              {showInviteMessage && (
                <div
                  className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-sm"
                  onClick={() => setShowInviteMessage(false)}
                >
                  <div
                    className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Invite Message Header */}
                    <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-4 rounded-t-xl flex items-center justify-between">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <MessageSquare className="w-5 h-5" />
                        GitHub 候選人邀請訊息
                      </h3>
                      <button
                        onClick={() => setShowInviteMessage(false)}
                        className="text-white/80 hover:text-white hover:bg-white/10 p-2 rounded-lg transition-all"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    
                    {/* Invite Message Content */}
                    <div className="flex-1 overflow-y-auto p-6">
                      <div className="mb-4">
                        <div className="text-sm text-gray-600 mb-2">
                          📝 此訊息已根據候選人技能自動生成，請視情況調整後使用：
                        </div>
                        <textarea
                          value={inviteMessage}
                          onChange={(e) => setInviteMessage(e.target.value)}
                          className="w-full h-64 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none font-mono text-sm"
                        />
                      </div>
                      
                      <div className="flex gap-2">
                        <button
                          onClick={handleCopyInviteMessage}
                          className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          複製到剪貼簿
                        </button>
                        <button
                          onClick={() => setShowInviteMessage(false)}
                          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          關閉
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {activeTab === 'history' && (
            <div className="space-y-4">
              {/* Progress Timeline */}
              {candidate.progressTracking && candidate.progressTracking.length > 0 ? (
                <div className="space-y-3">
                  {candidate.progressTracking.map((event: any, i: number) => {
                    const isLast = i === candidate.progressTracking!.length - 1;
                    const eventColors: Record<string, {bg: string, text: string, icon: string}> = {
                      '已聯繫': {bg: 'bg-blue-100', text: 'text-blue-600', icon: '📞'},
                      '已面試': {bg: 'bg-purple-100', text: 'text-purple-600', icon: '💼'},
                      'Offer': {bg: 'bg-green-100', text: 'text-green-600', icon: '📝'},
                      '已上職': {bg: 'bg-emerald-100', text: 'text-emerald-600', icon: '🎉'},
                      '婉拒': {bg: 'bg-red-100', text: 'text-red-600', icon: '❌'},
                      '其他': {bg: 'bg-gray-100', text: 'text-gray-600', icon: '📌'}
                    };
                    const color = eventColors[event.event] || eventColors['其他'];
                    
                    return (
                      <div key={i} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className={`w-8 h-8 rounded-full ${color.bg} flex items-center justify-center`}>
                            <span className="text-sm">{color.icon}</span>
                          </div>
                          {!isLast && <div className="flex-1 w-0.5 bg-gray-200 my-1 min-h-[24px]" />}
                        </div>
                        <div className="flex-1 pb-4">
                          <div className="flex items-center gap-2">
                            <div className={`font-medium ${color.text}`}>{event.event}</div>
                            <span className="text-xs text-gray-400">by {event.by}</span>
                          </div>
                          {event.note && (
                            <div className="text-sm text-gray-600 mt-1">{event.note}</div>
                          )}
                          <div className="text-xs text-gray-400 mt-1">{event.date}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>尚無進度追蹤記錄</p>
                  <p className="text-sm mt-2">開始追蹤候選人的招聘進度</p>
                </div>
              )}
              
              {/* Quick Add Progress Button */}
              <div className="border-t border-gray-200 pt-4">
                <div className="text-xs text-gray-500 mb-2">快速新增進度</div>
                <div className="grid grid-cols-3 gap-2">
                  {['未開始', 'AI推薦', '已聯繫', '已面試', 'Offer', '已上職', '婉拒', '備選人才'].map(eventType => (
                    <button
                      key={eventType}
                      className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-blue-400 transition-colors"
                      onClick={() => handleAddProgress(eventType)}
                    >
                      {eventType}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Add Progress Modal */}
              {addingProgress && (
                <div 
                  className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/50 backdrop-blur-sm"
                  onClick={() => {
                    setAddingProgress(false);
                    setNewProgressEvent('');
                    setNewProgressNote('');
                  }}
                >
                  <div
                    className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      新增進度：{newProgressEvent}
                    </h3>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          備註（選填）
                        </label>
                        <textarea
                          value={newProgressNote}
                          onChange={(e) => setNewProgressNote(e.target.value)}
                          placeholder="例如：電話聯繫順利，候選人有興趣..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                          rows={3}
                        />
                      </div>
                      
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setAddingProgress(false);
                            setNewProgressEvent('');
                            setNewProgressNote('');
                          }}
                          className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          取消
                        </button>
                        <button
                          onClick={handleConfirmAddProgress}
                          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          確認新增
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {activeTab === 'notes' && (
            <div className="space-y-4">
              {/* 現有備註 */}
              <div>
                <h3 className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  備註紀錄
                </h3>
                {localNotes ? (
                  <div className="space-y-2">
                    {localNotes.split('\n').filter(line => line.trim()).map((line, i) => {
                      // 嘗試解析 [時間] 作者：內容 格式
                      const match = line.match(/^\[(.+?)\]\s*(.+?)：(.+)$/);
                      if (match) {
                        const [, time, author, content] = match;
                        return (
                          <div key={i} className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-semibold text-yellow-800">{author}</span>
                              <span className="text-xs text-gray-400">{time}</span>
                            </div>
                            <p className="text-sm text-gray-800 whitespace-pre-wrap">{content}</p>
                          </div>
                        );
                      }
                      // 未格式化的行直接顯示
                      return (
                        <div key={i} className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                          <p className="text-sm text-gray-800 whitespace-pre-wrap">{line}</p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-6 text-gray-400">
                    <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">尚無備註紀錄</p>
                    <p className="text-xs mt-1">顧問或 AIbot 新增的備註將顯示於此</p>
                  </div>
                )}
              </div>

              {/* 新增備註 */}
              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">新增備註</h3>
                <textarea
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  placeholder="輸入備註內容，儲存後將附加時間戳與您的名稱..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
                  rows={3}
                />
                <div className="flex justify-end mt-2">
                  <button
                    onClick={handleSaveNote}
                    disabled={!newNoteText.trim() || savingNote}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                  >
                    {savingNote ? '儲存中...' : '儲存備註'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'ai_match' && (() => {
            // 後端已轉換格式，直接使用
            const ai = (enrichedCandidate.aiMatchResult || (enrichedCandidate as any).ai_match_result) as AiMatchResult | null | undefined;

            const recConfig: Record<string, { color: string; bg: string; icon: React.ReactNode }> = {
              '強力推薦': { color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: <ThumbsUp className="w-4 h-4" /> },
              '推薦':     { color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-200',       icon: <ThumbsUp className="w-4 h-4" /> },
              '觀望':     { color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200',     icon: <HelpCircle className="w-4 h-4" /> },
              '不推薦':   { color: 'text-rose-700',    bg: 'bg-rose-50 border-rose-200',       icon: <ThumbsDown className="w-4 h-4" /> },
            };

            if (!ai) {
              return (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-16 h-16 rounded-full bg-violet-50 flex items-center justify-center mb-4">
                    <Bot className="w-8 h-8 text-violet-300" />
                  </div>
                  <p className="text-slate-600 font-semibold">尚未進行 AI 匹配評分</p>
                  <p className="text-slate-400 text-sm mt-2 max-w-xs">
                    請透過職缺管理的「AI 配對」功能，或由 AIbot 呼叫評分 API，結果將顯示在此
                  </p>
                  <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-200 text-left max-w-sm w-full">
                    <p className="text-xs font-semibold text-slate-600 mb-2">AIbot 寫入欄位：</p>
                    <code className="text-xs text-violet-700 break-all">
                      PATCH /api/candidates/{'{id}'}<br/>
                      {'{ "ai_match_result": { ... } }'}
                    </code>
                  </div>
                </div>
              );
            }

            const rec = recConfig[ai.recommendation] || recConfig['觀望'];
            const scoreColor =
              ai.score >= 85 ? 'text-emerald-600' :
              ai.score >= 70 ? 'text-blue-600' :
              ai.score >= 55 ? 'text-amber-600' : 'text-rose-600';
            const scoreRing =
              ai.score >= 85 ? 'border-emerald-400' :
              ai.score >= 70 ? 'border-blue-400' :
              ai.score >= 55 ? 'border-amber-400' : 'border-rose-400';

            return (
              <div className="space-y-4 sm:space-y-5">
                {/* 頂部：分數 + 推薦等級 + 對應職缺 */}
                <div className="flex flex-col gap-3 sm:gap-4 items-start sm:items-center">
                  {/* 分數環 */}
                  <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 ${scoreRing} flex flex-col items-center justify-center shrink-0 bg-white shadow-sm`}>
                    <span className={`text-2xl sm:text-3xl font-black ${scoreColor}`}>{ai.score}</span>
                    <span className="text-[8px] sm:text-[10px] text-slate-400 font-medium">/ 100</span>
                  </div>

                  <div className="flex-1 w-full sm:w-auto space-y-2">
                    {/* 推薦等級 */}
                    <div className={`inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg border font-bold text-xs sm:text-sm ${rec.bg} ${rec.color}`}>
                      {rec.icon}
                      {ai.recommendation}
                    </div>

                    {/* 對應職缺 */}
                    {ai.job_title && (
                      <div className="flex items-start sm:items-center gap-2 text-xs sm:text-sm text-slate-600">
                        <Target className="w-3 h-3 sm:w-4 sm:h-4 text-violet-500 shrink-0 mt-0.5 sm:mt-0" />
                        <div className="break-words">
                          <span>對應職缺：</span>
                          <span className="font-semibold text-slate-800 block sm:inline sm:ml-1">
                            {ai.job_title}
                            {ai.job_id && <span className="text-slate-400 font-normal sm:ml-1"> #{ai.job_id}</span>}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* 評分時間 */}
                    <div className="text-[10px] sm:text-xs text-slate-400 break-words">
                      由 <span className="font-medium text-violet-600">{ai.evaluated_by}</span> 評分
                      {ai.evaluated_at && (
                        <span className="block sm:inline"> · {new Date(ai.evaluated_at).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 技能符合度 */}
                {(ai.matched_skills?.length > 0 || ai.missing_skills?.length > 0) && (
                  <div className="space-y-2">
                    <h4 className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider">技能符合度</h4>
                    {ai.matched_skills?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {ai.matched_skills.map((s, i) => (
                          <span key={i} className="inline-flex items-center gap-0.5 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[11px] sm:text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 break-words">
                            <CheckCircle2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" /> <span>{s}</span>
                          </span>
                        ))}
                      </div>
                    )}
                    {ai.missing_skills?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {ai.missing_skills.map((s, i) => (
                          <span key={i} className="inline-flex items-center gap-0.5 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[11px] sm:text-xs font-medium bg-rose-50 text-rose-600 border border-rose-200">
                            <AlertCircle className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" /> <span>{s}</span>
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2 sm:gap-3 text-[10px] sm:text-[11px] text-slate-400 mt-1">
                      <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />符合</span>
                      <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-rose-400 inline-block" />缺少</span>
                    </div>
                  </div>
                )}

                {/* 優勢亮點 */}
                {ai.strengths?.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                      <Star className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-500 shrink-0" /> 優勢亮點
                    </h4>
                    <ul className="space-y-1">
                      {ai.strengths.map((s, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs sm:text-sm text-slate-700">
                          <span className="mt-0.5 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0 text-amber-600 text-[8px] sm:text-[10px] font-bold flex-none">{i + 1}</span>
                          <span className="break-words">{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 面谈重点 */}
                {ai.probing_questions?.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                      <MessageSquare className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-500 shrink-0" /> 面谈重点
                    </h4>
                    <div className="space-y-1.5">
                      {ai.probing_questions.map((q, i) => (
                        <div key={i} className="flex items-start gap-2 p-2 sm:p-2.5 bg-blue-50 border border-blue-100 rounded-lg text-xs sm:text-sm text-blue-800">
                          <span className="shrink-0 font-bold text-blue-400 text-[10px] sm:text-sm min-w-5 sm:min-w-6">Q{i + 1}</span>
                          <span className="break-words">{q}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 待確認 */}
                {ai.missing_skills?.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-rose-500 shrink-0" /> 待確認
                    </h4>
                    <ul className="space-y-1">
                      {ai.missing_skills.map((item, i) => (
                        <li key={i} className="text-xs sm:text-sm text-slate-700 flex items-start gap-2 p-2 bg-rose-50 border border-rose-100 rounded">
                          <span className="text-rose-400 mt-0.5 shrink-0">▪</span>
                          <span className="break-words">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 薪資符合度 */}
                {ai.salary_fit && (
                  <div className="p-2 sm:p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-700 flex items-start gap-2">
                    <span className="text-base shrink-0">💰</span>
                    <div>
                      <span className="text-[10px] sm:text-xs font-semibold text-slate-500 block mb-0.5">薪資符合度</span>
                      <span className="break-words">{ai.salary_fit}</span>
                    </div>
                  </div>
                )}

                {/* 建議詢問問題（顧問用） */}
                {ai.probing_questions?.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                      <HelpCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-500 shrink-0" /> 建議顧問詢問
                    </h4>
                    <div className="space-y-1.5">
                      {ai.probing_questions.map((q, i) => (
                        <div key={i} className="flex items-start gap-2 p-2 sm:p-2.5 bg-blue-50 border border-blue-100 rounded-lg text-xs sm:text-sm text-blue-800">
                          <span className="shrink-0 font-bold text-blue-400 text-[10px] sm:text-sm min-w-5 sm:min-w-6">Q{i + 1}</span>
                          <span className="break-words">{q}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* AI 完整結論 */}
                {ai.conclusion && (
                  <div className="space-y-2">
                    <h4 className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                      <Bot className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-violet-500 shrink-0" /> AI 完整結論
                    </h4>
                    <div className="p-2.5 sm:p-4 bg-violet-50 border border-violet-100 rounded-xl text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
                      {ai.conclusion}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* Footer Actions */}
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              <span>負責顧問：</span>
              <span className="font-medium text-gray-900 ml-1">
                {candidate.consultant || '未分配'}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
              >
                關閉
              </button>
              
              {onUpdateStatus && (
                <div className="relative group">
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                    更新狀態
                  </button>
                  {/* Dropdown menu (future enhancement) */}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
