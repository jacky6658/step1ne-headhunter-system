// Step1ne Headhunter System - 候選人詳情 Modal
import React, { useState } from 'react';
import { Candidate, CandidateStatus } from '../types';
import { CANDIDATE_STATUS_CONFIG } from '../constants';
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
  
  // 禁止背景滾動
  React.useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);
  
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
  
  // 解析工作經歷 JSON
  const workHistory = candidate.workHistory ? 
    (typeof candidate.workHistory === 'string' ? 
      (() => { try { return JSON.parse(candidate.workHistory); } catch { return []; } })() 
      : candidate.workHistory) : [];
  
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
                  <p className="text-blue-100">{candidate.position}</p>
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
              {/* Contact Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <Mail className="w-5 h-5 text-gray-400" />
                  <div>
                    <div className="text-xs text-gray-500">Email</div>
                    <div className="font-medium">{candidate.email || '未提供'}</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <Phone className="w-5 h-5 text-gray-400" />
                  <div>
                    <div className="text-xs text-gray-500">電話</div>
                    <div className="font-medium">{candidate.phone || '未提供'}</div>
                  </div>
                </div>
              </div>
              
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
                    工作經歷
                  </h3>
                  <div className="space-y-3">
                    {workHistory.map((job: any, i: number) => (
                      <div key={i} className="border-l-2 border-blue-200 pl-4 py-2">
                        <div className="font-medium text-gray-900">{job.company}</div>
                        <div className="text-sm text-gray-600">{job.position}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {job.startDate} ~ {job.endDate} ({job.duration})
                        </div>
                        {job.description && (
                          <p className="text-sm text-gray-600 mt-2">{job.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
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
              
              {/* Resume Link */}
              {candidate.resumeUrl && (
                <div>
                  <a 
                    href={candidate.resumeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                    查看完整履歷
                  </a>
                </div>
              )}
            </div>
          )}
          
          {activeTab === 'history' && (
            <div className="space-y-4">
              {/* Progress Timeline */}
              <div className="text-center py-8 text-gray-400">
                <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>進度追蹤功能開發中...</p>
                <p className="text-sm mt-2">即將支援：聯繫記錄、面試安排、狀態變更歷史</p>
              </div>
              
              {/* Example Timeline */}
              <div className="space-y-3 opacity-50">
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    </div>
                    <div className="flex-1 w-0.5 bg-gray-200 my-1" />
                  </div>
                  <div className="flex-1 pb-4">
                    <div className="font-medium">已聯繫候選人</div>
                    <div className="text-sm text-gray-600">透過 Email 初步聯繫，候選人回覆有興趣</div>
                    <div className="text-xs text-gray-400 mt-1">2026-02-23 14:30</div>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                      <AlertCircle className="w-4 h-4 text-blue-600" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">候選人已加入履歷池</div>
                    <div className="text-sm text-gray-600">來源：GitHub</div>
                    <div className="text-xs text-gray-400 mt-1">2026-02-23 10:00</div>
                  </div>
                </div>
              </div>
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
