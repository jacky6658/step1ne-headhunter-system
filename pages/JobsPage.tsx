import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { Briefcase, Search, Building2, Users, Target, TrendingUp, Sparkles } from 'lucide-react';

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
      const response = await fetch('http://localhost:3001/api/jobs');
      const data = await response.json();
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
        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
          <Briefcase className="text-indigo-600" size={32} />
          職缺管理
        </h1>
        <p className="text-slate-600 mt-2">
          管理所有客戶職缺，追蹤招募狀態
        </p>
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
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">部門</th>
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
                    <td className="px-4 py-3 text-sm text-slate-600">{job.department || '-'}</td>
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
              <div className="grid grid-cols-2 gap-4 mb-6">
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
              </div>

              {/* 技能要求 */}
              <div className="mb-6">
                <h3 className="text-lg font-bold text-slate-900 mb-3">技能要求</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedJob.requiredSkills.map((skill, idx) => (
                    <span key={idx} className="px-3 py-1.5 bg-indigo-100 text-indigo-800 rounded-lg text-sm font-medium">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              {/* 公司資訊 */}
              <div className="mb-6">
                <h3 className="text-lg font-bold text-slate-900 mb-3">公司資訊</h3>
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
