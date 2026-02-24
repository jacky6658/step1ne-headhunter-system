import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { Briefcase, Search, Building2, Users, Target, TrendingUp, Sparkles } from 'lucide-react';
import { apiGet } from '../config/api';

interface JobsPageProps {
  userProfile: UserProfile;
}

interface Job {
  id: string;
  title: string;
  department: string;
  headcount: number;
  salaryRange: string;
  requiredSkills: string[];
  preferredSkills: string[];
  yearsRequired: number;
  educationRequired: string;
  workLocation: string;
  status: string;
  languageRequirement: string;
  specialConditions: string;
  industryBackground: string;
  teamSize: string;
  keyChallenge: string;
  highlights: string;
  recruitmentDifficulty: string;
  responsibilities: string[];
  benefits: string[];
  company: {
    name: string;
    industry: string;
    size: string;
    stage: string;
    culture: string;
    techStack: string[];
    workLocation: string;
    remotePolicy: string;
  };
}

export const JobsPage: React.FC<JobsPageProps> = ({ userProfile }) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  useEffect(() => {
    fetchJobs();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredJobs(jobs);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = jobs.filter(job => 
        job.title.toLowerCase().includes(query) ||
        job.company.name.toLowerCase().includes(query) ||
        job.department.toLowerCase().includes(query) ||
        job.requiredSkills.some(skill => skill.toLowerCase().includes(query))
      );
      setFilteredJobs(filtered);
    }
  }, [searchQuery, jobs]);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const data = await apiGet<{ success: boolean; data: Job[] }>('/jobs');
      if (data.success) {
        setJobs(data.data);
        setFilteredJobs(data.data);
      }
    } catch (error) {
      console.error('載入職缺失敗:', error);
    } finally {
      setLoading(false);
    }
  };

  const syncJobs = async () => {
    setSyncing(true);
    try {
      const data = await apiGet<{ success: boolean; data: Job[] }>('/jobs');
      if (data.success) {
        setJobs(data.data);
        setFilteredJobs(data.data);
        
        // 顯示成功提示
        const notification = document.createElement('div');
        notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 flex items-center gap-2';
        notification.innerHTML = `
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
          </svg>
          <span>已同步 ${data.data.length} 個職缺</span>
        `;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
      }
    } catch (error) {
      console.error('同步職缺失敗:', error);
      
      // 顯示錯誤提示
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 flex items-center gap-2';
      notification.innerHTML = `
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
        <span>同步失敗，請稍後重試</span>
      `;
      document.body.appendChild(notification);
      setTimeout(() => notification.remove(), 3000);
    } finally {
      setSyncing(false);
    }
  };

  const handleJobClick = (job: Job) => {
    setSelectedJob(job);
  };

  const handleStartMatching = (jobId: string) => {
    // 跳轉到 AI 配對頁面，並預先選擇該職缺
    window.location.href = `#ai-matching?jobId=${jobId}`;
  };

  const getStatusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('開放') || s.includes('招募') || s.includes('急徵')) {
      return 'bg-green-100 text-green-800 border-green-300';
    }
    if (s.includes('暫停') || s.includes('關閉')) {
      return 'bg-gray-100 text-gray-800 border-gray-300';
    }
    if (s.includes('已滿') || s.includes('結束')) {
      return 'bg-red-100 text-red-800 border-red-300';
    }
    return 'bg-blue-100 text-blue-800 border-blue-300';
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <Briefcase className="text-indigo-600" size={32} />
              職缺管理
            </h1>
            <p className="text-slate-600 mt-2">
              管理所有客戶職缺，追蹤招募狀態
            </p>
          </div>
          
          {/* 同步職缺按鈕 */}
          <button
            onClick={syncJobs}
            disabled={syncing}
            className={`px-5 py-2.5 rounded-xl font-semibold flex items-center gap-2 transition-all ${
              syncing
                ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md hover:shadow-lg'
            }`}
          >
            <svg 
              className={`w-5 h-5 ${syncing ? 'animate-spin' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
              />
            </svg>
            {syncing ? '同步中...' : '同步職缺'}
          </button>
        </div>
      </div>

      {/* 統計卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-600 mb-1">總職缺數</div>
              <div className="text-3xl font-bold text-slate-900">{jobs.length}</div>
            </div>
            <Briefcase className="text-indigo-600" size={32} />
          </div>
        </div>
        
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-600 mb-1">開放中</div>
              <div className="text-3xl font-bold text-green-600">
                {jobs.filter(j => j.status.includes('開放') || j.status.includes('招募')).length}
              </div>
            </div>
            <TrendingUp className="text-green-600" size={32} />
          </div>
        </div>
        
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-600 mb-1">總需求人數</div>
              <div className="text-3xl font-bold text-indigo-600">
                {jobs.reduce((sum, job) => sum + job.headcount, 0)}
              </div>
            </div>
            <Users className="text-indigo-600" size={32} />
          </div>
        </div>
        
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-600 mb-1">客戶公司</div>
              <div className="text-3xl font-bold text-purple-600">
                {new Set(jobs.map(j => j.company.name)).size}
              </div>
            </div>
            <Building2 className="text-purple-600" size={32} />
          </div>
        </div>
      </div>

      {/* 搜尋列 */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="搜尋職缺名稱、公司、技能..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* 職缺列表 */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
          <p className="text-slate-600">載入職缺中...</p>
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
          <Briefcase className="mx-auto text-slate-300 mb-4" size={48} />
          <p className="text-slate-600">
            {searchQuery ? '找不到符合條件的職缺' : '目前沒有職缺'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">職位名稱</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">客戶公司</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider min-w-[100px]">部門</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">需求人數</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">薪資範圍</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">主要技能</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">狀態</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredJobs.map((job) => (
                  <tr
                    key={job.id}
                    className="hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => handleJobClick(job)}
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{job.title}</div>
                      <div className="text-xs text-slate-500">{job.workLocation}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-slate-900">{job.company.name}</div>
                      <div className="text-xs text-slate-500">{job.company.industry}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 min-w-[100px] whitespace-nowrap">{job.department || '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-900 font-medium">{job.headcount} 人</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{job.salaryRange || '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {job.requiredSkills.slice(0, 3).map((skill, idx) => (
                          <span key={idx} className="px-2 py-1 bg-indigo-50 text-indigo-700 text-xs rounded">
                            {skill}
                          </span>
                        ))}
                        {job.requiredSkills.length > 3 && (
                          <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded">
                            +{job.requiredSkills.length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs font-semibold rounded border ${getStatusColor(job.status)}`}>
                        {job.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartMatching(job.id);
                        }}
                        className="px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 transition-all flex items-center gap-1"
                      >
                        <Sparkles size={14} />
                        AI 配對
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 職缺詳情 Modal */}
      {selectedJob && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedJob(null)}
        >
          <div 
            className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">{selectedJob.title}</h2>
                  <p className="text-slate-600 mt-1">{selectedJob.company.name}</p>
                </div>
                <button
                  onClick={() => setSelectedJob(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* 基本資訊 */}
              <div className="mb-6">
                <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  基本資訊
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 rounded-lg p-4">
                    <div className="text-sm text-slate-600 mb-1">部門</div>
                    <div className="font-semibold text-slate-900">{selectedJob.department || '-'}</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-4">
                    <div className="text-sm text-slate-600 mb-1">需求人數</div>
                    <div className="font-semibold text-slate-900">{selectedJob.headcount} 人</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-4">
                    <div className="text-sm text-slate-600 mb-1">薪資範圍</div>
                    <div className="font-semibold text-slate-900">{selectedJob.salaryRange || '-'}</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-4">
                    <div className="text-sm text-slate-600 mb-1">工作地點</div>
                    <div className="font-semibold text-slate-900">{selectedJob.workLocation}</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-4">
                    <div className="text-sm text-slate-600 mb-1">經驗要求</div>
                    <div className="font-semibold text-slate-900">{selectedJob.yearsRequired}年以上</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-4">
                    <div className="text-sm text-slate-600 mb-1">學歷要求</div>
                    <div className="font-semibold text-slate-900">{selectedJob.educationRequired || '-'}</div>
                  </div>
                </div>
              </div>

              {/* 技能要求 */}
              <div className="mb-6">
                <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  技能要求
                </h3>
                <div className="flex flex-wrap gap-2">
                  {selectedJob.requiredSkills.map((skill, idx) => (
                    <span key={idx} className="px-3 py-1.5 bg-indigo-100 text-indigo-800 rounded-lg text-sm font-medium">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              {/* 額外要求（語言、特殊條件、產業背景） */}
              {(selectedJob.languageRequirement || selectedJob.specialConditions || selectedJob.industryBackground) && (
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    額外要求
                  </h3>
                  <div className="space-y-3">
                    {selectedJob.languageRequirement && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <div className="text-sm font-semibold text-amber-900 mb-1">語言要求</div>
                        <div className="text-sm text-amber-800">{selectedJob.languageRequirement}</div>
                      </div>
                    )}
                    {selectedJob.specialConditions && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <div className="text-sm font-semibold text-amber-900 mb-1">特殊條件</div>
                        <div className="text-sm text-amber-800">{selectedJob.specialConditions}</div>
                      </div>
                    )}
                    {selectedJob.industryBackground && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <div className="text-sm font-semibold text-amber-900 mb-1">產業背景要求</div>
                        <div className="text-sm text-amber-800">{selectedJob.industryBackground}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 團隊與挑戰 */}
              {(selectedJob.teamSize || selectedJob.keyChallenge || selectedJob.highlights) && (
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    團隊與職位亮點
                  </h3>
                  <div className="space-y-3">
                    {selectedJob.teamSize && (
                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                        <div className="text-sm font-semibold text-purple-900 mb-1">團隊規模</div>
                        <div className="text-sm text-purple-800">{selectedJob.teamSize}</div>
                      </div>
                    )}
                    {selectedJob.keyChallenge && (
                      <div className="bg-rose-50 border border-rose-200 rounded-lg p-4">
                        <div className="text-sm font-semibold text-rose-900 mb-1">關鍵挑戰</div>
                        <div className="text-sm text-rose-800">{selectedJob.keyChallenge}</div>
                      </div>
                    )}
                    {selectedJob.highlights && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                        <div className="text-sm font-semibold text-emerald-900 mb-1">吸引亮點</div>
                        <div className="text-sm text-emerald-800">{selectedJob.highlights}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 招募資訊（困難點、面試流程） */}
              {(selectedJob.recruitmentDifficulty || selectedJob.interviewProcess) && (
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                    招募資訊
                  </h3>
                  <div className="space-y-3">
                    {selectedJob.recruitmentDifficulty && (
                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                        <div className="text-sm font-semibold text-orange-900 mb-1">招募困難點</div>
                        <div className="text-sm text-orange-800">{selectedJob.recruitmentDifficulty}</div>
                      </div>
                    )}
                    {selectedJob.interviewProcess && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="text-sm font-semibold text-blue-900 mb-1">面試流程</div>
                        <div className="text-sm text-blue-800 whitespace-pre-wrap">{selectedJob.interviewProcess}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 顧問備註 */}
              {selectedJob.consultantNotes && (
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    顧問面談備註
                  </h3>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                    <div className="text-sm text-slate-700 whitespace-pre-wrap">{selectedJob.consultantNotes}</div>
                  </div>
                </div>
              )}

              {/* 公司資訊 */}
              <div className="mb-6">
                <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  公司資訊
                </h3>
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-slate-600">產業：</span>
                      <span className="font-semibold text-slate-900 ml-2">{selectedJob.company.industry}</span>
                    </div>
                    <div>
                      <span className="text-slate-600">規模：</span>
                      <span className="font-semibold text-slate-900 ml-2">{selectedJob.company.size}</span>
                    </div>
                    <div>
                      <span className="text-slate-600">階段：</span>
                      <span className="font-semibold text-slate-900 ml-2">{selectedJob.company.stage}</span>
                    </div>
                    <div>
                      <span className="text-slate-600">文化：</span>
                      <span className="font-semibold text-slate-900 ml-2">{selectedJob.company.culture}</span>
                    </div>
                    <div>
                      <span className="text-slate-600">工作模式：</span>
                      <span className="font-semibold text-slate-900 ml-2">{selectedJob.company.remotePolicy}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 時間資訊 */}
              {(selectedJob.createdDate || selectedJob.lastUpdated) && (
                <div className="mb-6">
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    {selectedJob.createdDate && (
                      <div>建立日期：{selectedJob.createdDate}</div>
                    )}
                    {selectedJob.lastUpdated && (
                      <div>最後更新：{selectedJob.lastUpdated}</div>
                    )}
                  </div>
                </div>
              )}

              {/* 操作按鈕 */}
              <div className="flex gap-3">
                <button
                  onClick={() => handleStartMatching(selectedJob.id)}
                  className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 font-semibold"
                >
                  <Sparkles size={20} />
                  開始 AI 配對
                </button>
                <button
                  onClick={() => setSelectedJob(null)}
                  className="px-6 py-3 bg-slate-200 text-slate-700 rounded-xl hover:bg-slate-300 transition-all font-semibold"
                >
                  關閉
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
