import React, { useState, useEffect, useRef } from 'react';
import { UserProfile } from '../types';
import { Briefcase, Search, Building2, Users, Target, TrendingUp, Sparkles, FileText, Edit3, Save, X as XIcon, Bot, Plus } from 'lucide-react';
import { apiGet, apiPut } from '../config/api';

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
  job_description: string;
  company_profile: string;
  talent_profile: string;
  search_primary: string;
  search_secondary: string;
  welfare_tags: string;      // 逗號分隔，福利標籤
  welfare_detail: string;    // 詳細福利說明
  work_hours: string;        // 上班時段
  vacation_policy: string;   // 休假制度
  remote_work: string;       // 遠端工作
  business_trip: string;     // 出差外派
  job_url: string;           // 104/1111 原始連結
  lastUpdated: string;
}

export const JobsPage: React.FC<JobsPageProps> = ({ userProfile, onNavigateToMatching }) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [editingJD, setEditingJD] = useState(false);
  const [jdDraft, setJdDraft] = useState('');
  const [savingJD, setSavingJD] = useState(false);

  // ── 爬蟲搜尋設定狀態 ──
  const [editingSearch, setEditingSearch] = useState(false);
  const [companyProfileDraft, setCompanyProfileDraft] = useState('');
  const [talentProfileDraft, setTalentProfileDraft] = useState('');
  const [primaryTags, setPrimaryTags] = useState<string[]>([]);
  const [secondaryTags, setSecondaryTags] = useState<string[]>([]);
  const [primaryTagInput, setPrimaryTagInput] = useState('');
  const [secondaryTagInput, setSecondaryTagInput] = useState('');
  const [savingSearch, setSavingSearch] = useState(false);
  const primaryInputRef = useRef<HTMLInputElement>(null);
  const secondaryInputRef = useRef<HTMLInputElement>(null);

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

  const parseTags = (str: string | undefined) =>
    str ? str.split(',').map(s => s.trim()).filter(Boolean) : [];

  const handleJobClick = (job: Job) => {
    setSelectedJob(job);
    setEditingJD(false);
    setJdDraft(job.job_description || '');
    setEditingSearch(false);
    setCompanyProfileDraft(job.company_profile || '');
    setTalentProfileDraft(job.talent_profile || '');
    setPrimaryTags(parseTags(job.search_primary));
    setSecondaryTags(parseTags(job.search_secondary));
    setPrimaryTagInput('');
    setSecondaryTagInput('');
  };

  const addTag = (
    input: string,
    tags: string[],
    setTags: React.Dispatch<React.SetStateAction<string[]>>,
    setInput: React.Dispatch<React.SetStateAction<string>>,
  ) => {
    const val = input.trim().replace(/,+$/, '');
    if (val && !tags.includes(val)) setTags([...tags, val]);
    setInput('');
  };

  const handleSaveSearch = async () => {
    if (!selectedJob) return;
    setSavingSearch(true);
    try {
      const search_primary   = primaryTags.join(',');
      const search_secondary = secondaryTags.join(',');
      await apiPut(`/api/jobs/${selectedJob.id}`, {
        company_profile: companyProfileDraft,
        talent_profile:  talentProfileDraft,
        search_primary,
        search_secondary,
      });
      setSelectedJob(prev => prev ? {
        ...prev,
        company_profile: companyProfileDraft,
        talent_profile:  talentProfileDraft,
        search_primary,
        search_secondary,
      } : null);
      setEditingSearch(false);
    } catch {
      alert('❌ 儲存失敗，請稍後再試');
    } finally {
      setSavingSearch(false);
    }
  };

  const handleSaveJD = async () => {
    if (!selectedJob) return;
    setSavingJD(true);
    try {
      await apiPut(`/api/jobs/${selectedJob.id}`, { job_description: jdDraft });
      setSelectedJob(prev => prev ? { ...prev, job_description: jdDraft } : null);
      setEditingJD(false);
    } catch (err) {
      alert('❌ 儲存失敗，請稍後再試');
    } finally {
      setSavingJD(false);
    }
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
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl sm:text-3xl font-bold text-slate-900 flex items-center gap-3">
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
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
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
        <>
        {/* 手機版卡片列表 */}
        <div className="block md:hidden space-y-3">
          {filteredJobs.map((job) => (
            <div
              key={job.id}
              className="bg-white rounded-xl border border-slate-200 p-4 cursor-pointer active:bg-slate-50"
              onClick={() => handleJobClick(job)}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="font-semibold text-slate-900">{job.position_name}</div>
                  <div className="text-sm text-slate-600">{job.client_company}</div>
                </div>
                <span className={`px-2 py-1 text-xs font-semibold rounded border ${getStatusColor(job.job_status)}`}>
                  {job.job_status}
                </span>
              </div>
              <div className="text-xs text-slate-500 mb-3">
                {job.location && <span>{job.location} · </span>}
                建立：{job.lastUpdated ? new Date(job.lastUpdated).toLocaleDateString('zh-TW') : '-'}
              </div>
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
            </div>
          ))}
        </div>

        {/* 桌機版表格列表 */}
        <div className="hidden md:block bg-white rounded-xl border border-slate-200 overflow-hidden">
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
        {/* 桌機版列表結束 */}
        </>
      )}

      {/* 職缺詳情 Modal */}
      {selectedJob && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => { setSelectedJob(null); setEditingJD(false); setEditingSearch(false); }}
        >
          <div 
            className="bg-white rounded-2xl max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 sm:p-6 border-b border-slate-200 sticky top-0 bg-white">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">{selectedJob.position_name}</h2>
                  <p className="text-slate-600 mt-1">{selectedJob.client_company}</p>
                </div>
                <button
                  onClick={() => { setSelectedJob(null); setEditingJD(false); setEditingSearch(false); }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-3 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

              {/* ── 104 富文本欄位 ── */}
              {(selectedJob.work_hours || selectedJob.vacation_policy || selectedJob.remote_work || selectedJob.business_trip) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {selectedJob.work_hours && (
                    <div>
                      <label className="text-xs font-semibold text-slate-600 uppercase">上班時段</label>
                      <p className="text-sm text-slate-900 mt-1">{selectedJob.work_hours}</p>
                    </div>
                  )}
                  {selectedJob.vacation_policy && (
                    <div>
                      <label className="text-xs font-semibold text-slate-600 uppercase">休假制度</label>
                      <p className="text-sm text-slate-900 mt-1">{selectedJob.vacation_policy}</p>
                    </div>
                  )}
                  {selectedJob.remote_work && (
                    <div>
                      <label className="text-xs font-semibold text-slate-600 uppercase">遠端工作</label>
                      <p className="text-sm text-slate-900 mt-1">{selectedJob.remote_work}</p>
                    </div>
                  )}
                  {selectedJob.business_trip && (
                    <div>
                      <label className="text-xs font-semibold text-slate-600 uppercase">出差外派</label>
                      <p className="text-sm text-slate-900 mt-1">{selectedJob.business_trip}</p>
                    </div>
                  )}
                </div>
              )}

              {selectedJob.welfare_tags && (
                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase">員工福利</label>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {selectedJob.welfare_tags.split(',').map((t, i) => (
                      <span key={i} className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs rounded-full border border-emerald-200">
                        {t.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedJob.welfare_detail && (
                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase">福利詳情</label>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-700 whitespace-pre-line leading-relaxed max-h-48 overflow-y-auto mt-1">
                    {selectedJob.welfare_detail}
                  </div>
                </div>
              )}

              {selectedJob.job_url && (
                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase">原始職缺連結</label>
                  <a
                    href={selectedJob.job_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-indigo-600 hover:text-indigo-800 underline mt-1 block truncate"
                  >
                    {selectedJob.job_url}
                  </a>
                </div>
              )}

              {selectedJob.industry_background && (
                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase">產業背景</label>
                  <p className="text-sm text-slate-900 mt-1">{selectedJob.industry_background}</p>
                </div>
              )}

              {selectedJob.team_size && (
                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase">團隊規模</label>
                  <p className="text-sm text-slate-900 mt-1">{selectedJob.team_size}</p>
                </div>
              )}

              {selectedJob.key_challenges && (
                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase">主要挑戰</label>
                  <p className="text-sm text-slate-900 mt-1">{selectedJob.key_challenges}</p>
                </div>
              )}

              {selectedJob.special_conditions && (
                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase">特殊條件</label>
                  <p className="text-sm text-slate-900 mt-1">{selectedJob.special_conditions}</p>
                </div>
              )}

              {selectedJob.recruitment_difficulty && (
                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase">招募難度</label>
                  <p className="text-sm text-slate-900 mt-1">{selectedJob.recruitment_difficulty}</p>
                </div>
              )}

              {selectedJob.interview_process && (
                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase">面試流程</label>
                  <p className="text-sm text-slate-900 mt-1 whitespace-pre-line">{selectedJob.interview_process}</p>
                </div>
              )}

              {selectedJob.consultant_notes && (
                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase">顧問備注</label>
                  <p className="text-sm text-slate-900 mt-1 whitespace-pre-line">{selectedJob.consultant_notes}</p>
                </div>
              )}

              {/* ── 企業畫像 ── */}
              {selectedJob.company_profile && (
                <div className="pt-2 border-t border-slate-200">
                  <label className="text-xs font-semibold text-slate-600 uppercase flex items-center gap-1.5 mb-2">
                    <Building2 size={13} />
                    企業畫像
                  </label>
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-slate-800 whitespace-pre-line leading-relaxed">
                    {selectedJob.company_profile}
                  </div>
                </div>
              )}

              {/* ── 人才畫像 ── */}
              {selectedJob.talent_profile && (
                <div className="pt-2 border-t border-slate-200">
                  <label className="text-xs font-semibold text-slate-600 uppercase flex items-center gap-1.5 mb-2">
                    <Users size={13} />
                    人才畫像
                  </label>
                  <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 text-sm text-slate-800 whitespace-pre-line leading-relaxed">
                    {selectedJob.talent_profile}
                  </div>
                </div>
              )}

              {/* JD 工作內容區塊 */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-600 uppercase flex items-center gap-1.5">
                    <FileText size={13} />
                    工作內容 JD
                  </label>
                  {!editingJD ? (
                    <button
                      onClick={() => { setEditingJD(true); setJdDraft(selectedJob.job_description || ''); }}
                      className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 transition-colors"
                    >
                      <Edit3 size={12} />
                      {selectedJob.job_description ? '編輯' : '新增 JD'}
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleSaveJD}
                        disabled={savingJD}
                        className="flex items-center gap-1 text-xs bg-indigo-600 text-white px-2 py-1 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                      >
                        <Save size={11} />
                        {savingJD ? '儲存中...' : '儲存'}
                      </button>
                      <button
                        onClick={() => setEditingJD(false)}
                        className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
                      >
                        <XIcon size={12} />
                        取消
                      </button>
                    </div>
                  )}
                </div>

                {editingJD ? (
                  <textarea
                    value={jdDraft}
                    onChange={e => setJdDraft(e.target.value)}
                    rows={12}
                    placeholder={`貼上職缺完整 JD，例如：\n\n自我介紹\n我們是一家...\n\n工作內容\n- 負責...\n- 維護...\n\n職位需求\n- 3年以上經驗\n- 熟悉 React`}
                    className="w-full border border-slate-200 rounded-xl p-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-y font-mono leading-relaxed"
                  />
                ) : selectedJob.job_description ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-slate-800 whitespace-pre-line leading-relaxed max-h-72 overflow-y-auto">
                    {selectedJob.job_description}
                  </div>
                ) : (
                  <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-6 text-center text-slate-400 text-sm">
                    尚未填入工作內容 JD，點擊「新增 JD」貼上職缺說明
                  </div>
                )}
              </div>

              {/* ── 爬蟲搜尋設定 ── */}
              <div className="pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-semibold text-slate-600 uppercase flex items-center gap-1.5">
                    <Bot size={13} />
                    爬蟲搜尋設定
                  </label>
                  {!editingSearch ? (
                    <button
                      onClick={() => setEditingSearch(true)}
                      className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 transition-colors"
                    >
                      <Edit3 size={12} />
                      {(selectedJob.search_primary || selectedJob.search_secondary || selectedJob.company_profile || selectedJob.talent_profile) ? '編輯' : '設定'}
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleSaveSearch}
                        disabled={savingSearch}
                        className="flex items-center gap-1 text-xs bg-indigo-600 text-white px-2 py-1 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                      >
                        <Save size={11} />
                        {savingSearch ? '儲存中...' : '儲存'}
                      </button>
                      <button
                        onClick={() => setEditingSearch(false)}
                        className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
                      >
                        <XIcon size={12} />
                        取消
                      </button>
                    </div>
                  )}
                </div>

                {editingSearch ? (
                  <div className="space-y-3">
                    {/* 公司畫像 */}
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">公司畫像（讓 AI 了解客戶）</label>
                      <textarea
                        value={companyProfileDraft}
                        onChange={e => setCompanyProfileDraft(e.target.value)}
                        rows={3}
                        placeholder="例：台灣獨角獸 SaaS 公司，專攻 B2B 電商解決方案，目前 Series B，工程團隊 80 人..."
                        className="w-full border border-slate-200 rounded-xl p-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-y"
                      />
                    </div>

                    {/* 人才畫像 */}
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">理想人才畫像（描述期望人選特質）</label>
                      <textarea
                        value={talentProfileDraft}
                        onChange={e => setTalentProfileDraft(e.target.value)}
                        rows={3}
                        placeholder="例：有新創或高成長環境背景，主導過大型系統重構，重視工程品質..."
                        className="w-full border border-slate-200 rounded-xl p-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-y"
                      />
                    </div>

                    {/* 主關鍵字 AND */}
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">
                        主關鍵字 AND <span className="text-slate-400">（候選人必須同時符合，建議 1-2 個）</span>
                      </label>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {primaryTags.map((tag, idx) => (
                          <span key={idx} className="flex items-center gap-1 px-2 py-0.5 bg-indigo-100 text-indigo-800 text-xs rounded-full">
                            {tag}
                            <button onClick={() => setPrimaryTags(primaryTags.filter((_, i) => i !== idx))} className="text-indigo-400 hover:text-indigo-700 leading-none">×</button>
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input
                          ref={primaryInputRef}
                          type="text"
                          value={primaryTagInput}
                          onChange={e => setPrimaryTagInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' || e.key === ',') {
                              e.preventDefault();
                              addTag(primaryTagInput, primaryTags, setPrimaryTags, setPrimaryTagInput);
                            }
                          }}
                          placeholder="輸入後按 Enter 新增，例：Python"
                          className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        />
                        <button
                          onClick={() => addTag(primaryTagInput, primaryTags, setPrimaryTags, setPrimaryTagInput)}
                          className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>

                    {/* 次關鍵字 OR */}
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">
                        次關鍵字 OR <span className="text-slate-400">（符合任一即可，建議 3-6 個）</span>
                      </label>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {secondaryTags.map((tag, idx) => (
                          <span key={idx} className="flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 text-xs rounded-full">
                            {tag}
                            <button onClick={() => setSecondaryTags(secondaryTags.filter((_, i) => i !== idx))} className="text-emerald-400 hover:text-emerald-700 leading-none">×</button>
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input
                          ref={secondaryInputRef}
                          type="text"
                          value={secondaryTagInput}
                          onChange={e => setSecondaryTagInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' || e.key === ',') {
                              e.preventDefault();
                              addTag(secondaryTagInput, secondaryTags, setSecondaryTags, setSecondaryTagInput);
                            }
                          }}
                          placeholder="輸入後按 Enter 新增，例：Go"
                          className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        />
                        <button
                          onClick={() => addTag(secondaryTagInput, secondaryTags, setSecondaryTags, setSecondaryTagInput)}
                          className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (selectedJob.search_primary || selectedJob.search_secondary) ? (
                  <div className="space-y-2 text-sm">
                    {selectedJob.search_primary && (
                      <div>
                        <span className="text-xs text-slate-400">主關鍵字 AND</span>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {parseTags(selectedJob.search_primary).map((t, i) => (
                            <span key={i} className="px-2 py-0.5 bg-indigo-100 text-indigo-800 text-xs rounded-full">{t}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {selectedJob.search_secondary && (
                      <div>
                        <span className="text-xs text-slate-400">次關鍵字 OR</span>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {parseTags(selectedJob.search_secondary).map((t, i) => (
                            <span key={i} className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-xs rounded-full">{t}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-4 text-center text-slate-400 text-xs">
                    尚未設定爬蟲關鍵字，點擊「設定」填入後爬蟲將直接使用
                  </div>
                )}
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
