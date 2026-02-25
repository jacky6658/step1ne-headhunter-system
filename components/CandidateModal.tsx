// Step1ne Headhunter System - 候選人詳情 Modal
import React, { useState } from 'react';
import { Candidate, CandidateStatus } from '../types';
import { CANDIDATE_STATUS_CONFIG } from '../constants';
import { apiPut } from '../config/api';
import { 
  X, User, Mail, Phone, MapPin, Briefcase, Calendar, 
  TrendingUp, Award, FileText, MessageSquare, Clock,
  CheckCircle2, AlertCircle
} from 'lucide-react';

interface CandidateModalProps {
  candidate: Candidate;
  onClose: () => void;
  onUpdateStatus?: (candidateId: string, newStatus: CandidateStatus) => void;
}

export function CandidateModal({ candidate, onClose, onUpdateStatus }: CandidateModalProps) {
  const [activeTab, setActiveTab] = useState<'info' | 'history' | 'notes'>('info');
  const [showResume, setShowResume] = useState(false);
  const [addingProgress, setAddingProgress] = useState(false);
  const [newProgressEvent, setNewProgressEvent] = useState('');
  const [newProgressNote, setNewProgressNote] = useState('');
  const [showInviteMessage, setShowInviteMessage] = useState(false);
  const [inviteMessage, setInviteMessage] = useState('');
  
  // 禁止背景滾動
  React.useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);
  
  // 新增進度記錄
  const handleAddProgress = async (eventType: string) => {
    setNewProgressEvent(eventType);
    setAddingProgress(true);
  };
  
  // 確認新增進度
  const handleConfirmAddProgress = async () => {
    if (!newProgressEvent) return;
    
    try {
      const user = JSON.parse(localStorage.getItem('step1ne-user') || '{}');
      const userName = user.name || 'Unknown';
      
      // 建立新的進度事件
      const newEvent = {
        date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
        event: newProgressEvent,
        by: userName,
        ...(newProgressNote ? { note: newProgressNote } : {})
      };
      
      // 更新候選人的進度追蹤
      const updatedProgress = [...(candidate.progressTracking || []), newEvent];
      
      // 方案 A + B：同時更新 SQL + Google Sheets
      // API 會先寫入 SQL（即時），再異步同步到 Google Sheets
      await apiPut(`/api/candidates/${candidate.id}`, {
        name: candidate.name,
        consultant: candidate.consultant || userName,
        status: candidate.status,
        notes: `${newProgressEvent}：${newProgressNote || ''}`,
        progressTracking: updatedProgress
      });
      
      // 成功後重新載入頁面以顯示最新資料
      alert('✅ 進度新增成功！已同步到後端 + Google Sheets');
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
        className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                  <User className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">{candidate.name}</h2>
                  <p className="text-blue-100 text-sm">候選人背景：{candidate.position}</p>
                </div>
              </div>
              
              {/* Quick Stats */}
              <div className="flex items-center gap-4 mt-4 text-sm">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4" />
                  {candidate.location}
                </div>
                <div className="flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4" />
                  {candidate.years} 年經驗
                </div>
                <div className={`flex items-center gap-1.5 px-2 py-1 rounded ${currentStatus.bgColor} ${currentStatus.textColor}`}>
                  {currentStatus.label}
                </div>
              </div>
            </div>
            
            <button 
              onClick={onClose}
              className="text-white/80 hover:text-white hover:bg-white/10 p-2 rounded-lg transition-all"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="border-b border-gray-200 bg-gray-50">
          <div className="flex">
            <button
              onClick={() => setActiveTab('info')}
              className={`px-6 py-3 text-sm font-medium transition-all ${
                activeTab === 'info' 
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-white' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                基本資訊
              </div>
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-6 py-3 text-sm font-medium transition-all ${
                activeTab === 'history' 
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-white' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                進度追蹤
              </div>
            </button>
            <button
              onClick={() => setActiveTab('notes')}
              className={`px-6 py-3 text-sm font-medium transition-all ${
                activeTab === 'notes' 
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-white' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                備註紀錄
              </div>
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'info' && (
            <div className="space-y-6">
              {/* Contact Info - 智能分離電話 + Email */}
              <div className="grid grid-cols-2 gap-4">
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
              
              {/* 履歷連結 */}
              {candidate.resumeLink && (
                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <div className="flex-1">
                    <div className="text-xs text-gray-500">完整履歷</div>
                    <a 
                      href={candidate.resumeLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-blue-600 hover:text-blue-800 hover:underline text-sm"
                    >
                      Google Drive 預覽 →
                    </a>
                  </div>
                </div>
              )}
              
              {/* Stability Score */}
              <div className={`p-4 rounded-lg border-2 ${stability.bg} border-${stability.color.replace('text-', '')}-200`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <TrendingUp className={`w-6 h-6 ${stability.color}`} />
                    <div>
                      <div className="text-sm text-gray-600">穩定度評分</div>
                      <div className={`text-2xl font-bold ${stability.color}`}>
                        {stability.grade} 級 ({candidate.stabilityScore} 分)
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right text-sm text-gray-600">
                    <div>離職次數: {candidate.jobChanges} 次</div>
                    <div>平均任期: {(candidate.years / Math.max(candidate.jobChanges, 1)).toFixed(1)} 年</div>
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
              {workHistory.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-blue-600" />
                    💼 工作經歷
                  </h3>
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
                </div>
              )}
              
              {/* Education */}
              {education.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Award className="w-5 h-5 text-blue-600" />
                    教育背景
                  </h3>
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
                </div>
              )}
              
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
                    className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col"
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
                  {['已聯繫', '已面試', 'Offer', '已上職', '婉拒', '其他'].map(eventType => (
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
            <div className="text-center py-8 text-gray-400">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>備註功能開發中...</p>
              <p className="text-sm mt-2">即將支援：新增備註、標記重點、團隊協作</p>
            </div>
          )}
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
