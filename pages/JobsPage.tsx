import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { Briefcase, Search, Building2, Users, Target, TrendingUp, Sparkles } from 'lucide-react';
import { apiGet } from '../config/api';

interface JobsPageProps {
  userProfile: UserProfile;
  onNavigateToMatching: (jobId: string) => void;
}

interface Job {
  id: string;
  position_name: string;
  client_company: string;
  department: string;
  open_positions: string;
  salary_range: string;
  key_skills: string;
  experience_required: string;
  education_required: string;
  location: string;
  job_status: string;
  language_required: string;
  special_conditions: string;
  industry_background: string;
  team_size: string;
  key_challenges: string;
  attractive_points: string;
  recruitment_difficulty: string;
  interview_process: string;
  consultant_notes: string;
  lastUpdated: string;
}

export const JobsPage: React.FC<JobsPageProps> = ({ userProfile, onNavigateToMatching }) => {
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
      const filtered = jobs.filter(job => {
        try {
          return (
            (job.position_name && job.position_name.toLowerCase().includes(query)) ||
            (job.client_company && job.client_company.toLowerCase().includes(query)) ||
            (job.department && job.department.toLowerCase().includes(query)) ||
            (job.key_skills && job.key_skills.toLowerCase().includes(query))
          );
        } catch (e) {
          return false;
        }
      });
      setFilteredJobs(filtered);
    }
  }, [searchQuery, jobs]);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const data = await apiGet<{ success: boolean; data: Job[] }>('/jobs');
      if (data.success && data.data) {
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
      if (data.success && data.data) {
        setJobs(data.data);
        setFilteredJobs(data.data);
        
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
      
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 flex items-center gap-2';
      notification.innerHTML = `
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
        <span>同步失敗</span>
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
    onNavigateToMatching(jobId);
  };

  const getStatusColor = (status: string | undefined) => {
    if (!status) return 'bg-blue-100 text-blue-800 border-blue-300';
    const s = status.toLowerCase();
    if (s.includes('開放') || s.includes('招募') || s.includes('中')) {
      return 'bg-green-100 text-green-800 border-green-300';
    }
    if (s.includes('暫停') || s.includes('關閉') || s.includes('已暫停')) {
      return 'bg-gray-100 text-gray-800 border-gray-300';
    }
    if (s.includes('已滿') || s.includes('結束')) {
      return 'bg-red-100 text-red-800 border-red-300';
    }
    return 'bg-blue-100 text-blue-800 border-blue-300';
  };

  const parseSkills = (skillsStr: string | undefined) => {
    if (!skillsStr) return [];
    return skillsStr.split('、').map(s => s.trim()).filter(s => s.length > 0);
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
                {jobs.filter(j => j.job_status && (j.job_status.includes('開放') || j.job_status.includes('招募'))).length}
              </div>
            </div>
            <TrendingUp className="text-green-600" size={32} />
          </div>
        </div>
        
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-600 mb-1">獨立公司</div>
              <div className="text-3xl font-bold text-indigo-600">
                {new Set(jobs.map(j => j.client_company)).size}
              </div>
            </div>
            <Building2 className="text-indigo-600" size={32} />
          </div>
        </div>
        
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-600 mb-1">招募職位</div>
              <div className="text-3xl font-bold text-purple-600">
                {jobs.reduce((sum, job) => {
                  const num = parseInt(job.open_positions) || 0;
                  return sum + num;
                }, 0)}
              </div>
            </div>
            <Users className="text-purple-600" size={32} />
          </div>
        </div>
      </div>

      {/* 搜尋列 */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="搜尋職位、公司、技能..."
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
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">人數</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">薪資</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">技能</th>
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
                      <div className="font-semibold text-slate-900">{job.position_name}</div>
                      <div className="text-xs text-slate-500">{job.location}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900">{job.client_company}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 min-w-[100px] whitespace-nowrap">{job.department || '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-900 font-medium">{job.open_positions || '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{job.salary_range || '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {parseSkills(job.key_skills).slice(0, 2).map((skill, idx) => (
                          <span key={idx} className="px-2 py-1 bg-indigo-50 text-indigo-700 text-xs rounded">
                            {skill}
                          </span>
                        ))}
                        {parseSkills(job.key_skills).length > 2 && (
                          <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded">
                            +{parseSkills(job.key_skills).length - 2}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs font-semibold rounded border ${getStatusColor(job.job_status)}`}>
                        {job.job_status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartMatching(job.id.toString());
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
            className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-slate-200 sticky top-0 bg-white">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">{selectedJob.position_name}</h2>
                  <p className="text-slate-600 mt-1">{selectedJob.client_company}</p>
                </div>
                <button
                  onClick={() => setSelectedJob(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase">部門</label>
                  <p className="text-sm text-slate-900">{selectedJob.department || '-'}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase">需求人數</label>
                  <p className="text-sm text-slate-900">{selectedJob.open_positions || '-'}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase">薪資範圍</label>
                  <p className="text-sm text-slate-900">{selectedJob.salary_range || '-'}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase">地點</label>
                  <p className="text-sm text-slate-900">{selectedJob.location || '-'}</p>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase">主要技能</label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {parseSkills(selectedJob.key_skills).map((skill, idx) => (
                    <span key={idx} className="px-3 py-1 bg-indigo-50 text-indigo-700 text-sm rounded-lg">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase">經驗要求</label>
                <p className="text-sm text-slate-900 mt-1">{selectedJob.experience_required || '-'}</p>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase">學歷要求</label>
                <p className="text-sm text-slate-900 mt-1">{selectedJob.education_required || '-'}</p>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase">語言要求</label>
                <p className="text-sm text-slate-900 mt-1">{selectedJob.language_required || '-'}</p>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase">吸引亮點</label>
                <p className="text-sm text-slate-900 mt-1">{selectedJob.attractive_points || '-'}</p>
              </div>

              <div className="pt-4 border-t border-slate-200">
                <button
                  onClick={() => {
                    handleStartMatching(selectedJob.id.toString());
                    setSelectedJob(null);
                  }}
                  className="w-full px-4 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                >
                  <Sparkles size={18} />
                  開始 AI 配對
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
