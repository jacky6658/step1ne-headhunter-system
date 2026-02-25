import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { Target, Users, Building2, Sparkles, Download, FileText, TrendingUp, CheckCircle2, AlertCircle, Briefcase } from 'lucide-react';
import { generateMatchingReportPDF } from '../utils/pdfGenerator';
import { apiGet, apiPost, getApiUrl } from '../config/api';

interface AIMatchingPageProps {
  userProfile: UserProfile;
  preSelectedJobId?: string | null;
}

interface JobFromAPI {
  id: string;
  title: string;
  department: string;
  headcount: number;
  salaryRange: string;
  requiredSkills: string[];
  preferredSkills: string[];
  yearsRequired: number;
  educationRequired: string;
  status: string;
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

interface Candidate {
  id: string;
  name: string;
  position: string;
  years: number;
  skills: string | string[];  // 支援字串和陣列兩種格式
  talentGrade?: string;
}

interface MatchResult {
  candidate: {
    id: string;
    name: string;
  };
  總分: number;
  等級: string;
  推薦優先級: string;
  維度評分: {
    技能匹配: number;
    成長匹配: number;
    文化匹配: number;
    動機匹配: number;
  };
  適配亮點: string[];
  風險提示: string[];
  建議: {
    面試重點: string[];
    薪資策略: string;
    留任策略: string;
  };
}

interface BatchMatchResponse {
  success: boolean;
  company: {
    name: string;
    jobTitle: string;
  };
  result: {
    summary: {
      total_candidates: number;
      grade_distribution: {
        S: number;
        A: number;
        B: number;
        C: number;
        D: number;
      };
      average_score: number;
      top_5: Array<{
        name: string;
        total_score: number;
        grade: string;
        priority: string;
      }>;
    };
    matches: MatchResult[];
  };
}

export const AIMatchingPage: React.FC<AIMatchingPageProps> = ({ userProfile, preSelectedJobId }) => {
  const [step, setStep] = useState<'job-selection' | 'selecting' | 'matching' | 'results'>('job-selection');
  
  // 職缺相關
  const [jobs, setJobs] = useState<JobFromAPI[]>([]);
  const [selectedJob, setSelectedJob] = useState<JobFromAPI | null>(null);
  const [loadingJobs, setLoadingJobs] = useState(true);
  
  // 候選人相關
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);
  
  // 配對相關
  const [matchResults, setMatchResults] = useState<BatchMatchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 載入職缺列表
  useEffect(() => {
    fetchJobs();
    fetchCandidates();
  }, []);

  // 自動選擇職缺（從職缺管理頁面跳轉過來時）
  useEffect(() => {
    if (preSelectedJobId && jobs.length > 0 && !selectedJob) {
      const job = jobs.find(j => j.id === preSelectedJobId);
      if (job) {
        setSelectedJob(job);
        setStep('selecting');
      }
    }
  }, [preSelectedJobId, jobs, selectedJob]);

  const fetchJobs = async () => {
    setLoadingJobs(true);
    try {
      const data = await apiGet<{ success: boolean; data: JobFromAPI[] }>('/jobs');
      if (data.success) {
        setJobs(data.data);
      } else {
        setError('載入職缺失敗');
      }
    } catch (err) {
      console.error('載入職缺失敗:', err);
      setError('載入職缺失敗');
    } finally {
      setLoadingJobs(false);
    }
  };

  const fetchCandidates = async () => {
    try {
      const data = await apiGet<{ success: boolean; data: Candidate[] }>('/candidates');
      if (data.success) {
        // 確保 years 是 number 型（API 可能返回 string）
        const candidatesWithTypes = data.data.map(c => ({
          ...c,
          years: typeof c.years === 'string' ? parseInt(c.years) || 0 : c.years || 0
        }));
        setCandidates(candidatesWithTypes);
      }
    } catch (err) {
      console.error('載入候選人失敗:', err);
    }
  };

  const handleJobSelect = (job: JobFromAPI) => {
    setSelectedJob(job);
    setStep('selecting');
    setSelectedCandidates([]);
    setMatchResults(null);
  };

  const handleCandidateToggle = (candidateId: string) => {
    setSelectedCandidates(prev => 
      prev.includes(candidateId)
        ? prev.filter(id => id !== candidateId)
        : [...prev, candidateId]
    );
  };

  const handleStartMatching = async () => {
    if (!selectedJob) {
      alert('請先選擇職缺');
      return;
    }

    if (selectedCandidates.length === 0) {
      alert('請至少選擇 1 位候選人');
      return;
    }

    setLoading(true);
    setError(null);
    setStep('matching');

    try {
      const data: BatchMatchResponse = await apiPost('/personas/batch-match', {
        job: {
          title: selectedJob.title,
          department: selectedJob.department,
          requiredSkills: selectedJob.requiredSkills,
          preferredSkills: selectedJob.preferredSkills || [],
          yearsRequired: selectedJob.yearsRequired,
          educationRequired: selectedJob.educationRequired,
          responsibilities: selectedJob.responsibilities || [],
          benefits: selectedJob.benefits || []
        },
        company: selectedJob.company,
        candidateIds: selectedCandidates
      });

      if (data.success) {
        setMatchResults(data);
        setStep('results');
        
        // Task C: 為推薦候選人更新 T 欄位（備註）
        // 格式：應徵：{職位} ({公司名})
        const targetNote = `應徵：${selectedJob.title} (${selectedJob.company.name})`;
        
        // 只更新被推薦的候選人（P0/P1/P2 優先級）
        const recommendedCandidates = data.result.matches
          .filter(match => ['P0', 'P1', 'P2'].includes(match.推薦優先級))
          .map(match => match.candidate.id);
        
        // 批量更新候選人備註（背景執行，不阻塞 UI）
        if (recommendedCandidates.length > 0) {
          console.log(`📝 更新 ${recommendedCandidates.length} 位推薦候選人的應徵職位備註`);
          
          Promise.all(
            recommendedCandidates.map(candidateId =>
              fetch(getApiUrl(`/api/candidates/${candidateId}`), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notes: targetNote })
              }).catch(err => console.warn(`更新候選人 ${candidateId} 備註失敗:`, err))
            )
          ).then(() => {
            console.log(`✅ 已更新推薦候選人的應徵職位備註：${targetNote}`);
          });
        }
      } else {
        throw new Error('配對失敗');
      }
    } catch (err: any) {
      console.error('配對錯誤:', err);
      setError(err.message || '配對失敗，請稍後再試');
      setStep('selecting');
    } finally {
      setLoading(false);
    }
  };

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'S': return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'A': return 'bg-green-100 text-green-800 border-green-300';
      case 'B': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'C': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'D': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case '高': return 'text-red-600';
      case '中': return 'text-yellow-600';
      case '低': return 'text-gray-600';
      default: return 'text-gray-600';
    }
  };

  // Job Selection 階段 - 選擇職缺
  if (step === 'job-selection') {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Sparkles className="text-indigo-600" size={32} />
            AI 配對推薦
          </h1>
          <p className="text-slate-600 mt-2">
            使用 AI 人才畫像 + 公司畫像雙引擎匹配系統，找出最適合的候選人
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
            <AlertCircle className="text-red-600" size={20} />
            <span className="text-red-800">{error}</span>
          </div>
        )}

        {/* 職缺列表 */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <Briefcase className="text-indigo-600" size={24} />
            <h2 className="text-xl font-bold text-slate-900">選擇職缺</h2>
            {loadingJobs && (
              <div className="ml-auto">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
              </div>
            )}
          </div>

          {loadingJobs ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
              <p className="text-slate-600">載入職缺中...</p>
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-12">
              <Briefcase className="mx-auto text-slate-300" size={48} />
              <p className="text-slate-600 mt-4">目前沒有招募中的職缺</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {jobs.map((job) => (
                <button
                  key={job.id}
                  onClick={() => handleJobSelect(job)}
                  className="text-left p-5 border-2 border-slate-200 rounded-xl hover:border-indigo-500 hover:shadow-lg transition-all group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                      {job.title}
                    </h3>
                    <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded">
                      招募中
                    </span>
                  </div>
                  
                  <div className="space-y-2 text-sm text-slate-600 mb-4">
                    <div className="flex items-center gap-2">
                      <Building2 size={14} className="text-slate-400" />
                      <span>{job.company.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users size={14} className="text-slate-400" />
                      <span>{job.department} · 需求 {job.headcount} 人</span>
                    </div>
                    {job.salaryRange && (
                      <div className="flex items-center gap-2">
                        <Target size={14} className="text-slate-400" />
                        <span>{job.salaryRange}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
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

                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>{job.company.stage}</span>
                      <span>·</span>
                      <span>{job.company.culture}</span>
                      <span>·</span>
                      <span>{job.company.remotePolicy}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Selecting 階段 - 選擇候選人
  if (step === 'selecting' && selectedJob) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        {/* 職缺資訊摘要 */}
        <div className="mb-6 bg-indigo-50 border border-indigo-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-indigo-900">{selectedJob.title}</h2>
              <p className="text-sm text-indigo-700 mt-1">
                {selectedJob.company.name} · {selectedJob.department}
              </p>
            </div>
            <button
              onClick={() => setStep('job-selection')}
              className="px-4 py-2 bg-white border border-indigo-300 text-indigo-700 rounded-lg hover:bg-indigo-50 transition-all text-sm font-medium"
            >
              更換職缺
            </button>
          </div>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <Users className="text-indigo-600" size={28} />
            選擇候選人
          </h1>
          <p className="text-slate-600 mt-1">
            已選擇 <span className="font-semibold text-indigo-600">{selectedCandidates.length}</span> 位候選人
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
            <AlertCircle className="text-red-600" size={20} />
            <span className="text-red-800">{error}</span>
          </div>
        )}

        {/* 候選人列表 */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    <input
                      type="checkbox"
                      checked={selectedCandidates.length === candidates.length && candidates.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedCandidates(candidates.map(c => c.id));
                        } else {
                          setSelectedCandidates([]);
                        }
                      }}
                      className="rounded border-slate-300"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">姓名</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">目前職位</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">年資</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">技能</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">人才評級</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {candidates
                  .filter(c => c && c.id && c.name)  // 防守：過濾掉無效候選人
                  .slice(0, 50)
                  .map((candidate) => (
                  <tr
                    key={candidate.id}
                    className={`hover:bg-slate-50 transition-colors ${
                      selectedCandidates.includes(candidate.id) ? 'bg-indigo-50' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedCandidates.includes(candidate.id)}
                        onChange={() => handleCandidateToggle(candidate.id)}
                        className="rounded border-slate-300"
                      />
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{candidate.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{candidate.position || '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{candidate.years || 0} 年</td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      <div className="max-w-xs truncate">
                        {Array.isArray(candidate.skills) 
                          ? candidate.skills.join(', ') 
                          : candidate.skills || '-'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {candidate.talentGrade && (
                        <span className={`px-2 py-1 text-xs font-semibold rounded border ${getGradeColor(candidate.talentGrade)}`}>
                          {candidate.talentGrade}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 操作按鈕 */}
        <div className="flex justify-between items-center">
          <button
            onClick={() => setStep('job-selection')}
            className="px-6 py-3 bg-slate-200 text-slate-700 rounded-xl hover:bg-slate-300 transition-all"
          >
            返回選擇職缺
          </button>
          <button
            onClick={handleStartMatching}
            disabled={selectedCandidates.length === 0}
            className="px-8 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/30 flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Sparkles size={20} />
            開始 AI 配對 ({selectedCandidates.length})
          </button>
        </div>
      </div>
    );
  }

  // Matching 階段
  if (step === 'matching') {
    return (
      <div className="max-w-4xl mx-auto p-6 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mb-6"></div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">AI 配對分析中...</h2>
          <p className="text-slate-600">正在分析 {selectedCandidates.length} 位候選人的畫像</p>
          <div className="mt-6 space-y-2 text-sm text-slate-500">
            <p>✓ 生成人才畫像</p>
            <p>✓ 生成公司畫像</p>
            <p className="text-indigo-600 font-semibold">⏳ 執行配對分析...</p>
          </div>
        </div>
      </div>
    );
  }

  // Results 階段 - 配對結果（與原版相同，省略重複代碼）
  // ...（保留原來的 Results 階段代碼）
  
  if (step === 'results' && matchResults) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        {/* 職缺資訊摘要 */}
        <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="text-green-600" size={24} />
                <h2 className="text-xl font-bold text-green-900">配對完成</h2>
              </div>
              <p className="text-sm text-green-700 mt-1">
                {matchResults.company.name} · {matchResults.company.jobTitle}
              </p>
            </div>
          </div>
        </div>

        {/* 摘要統計 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-sm text-slate-600 mb-1">總候選人數</div>
            <div className="text-3xl font-bold text-slate-900">
              {matchResults.result.summary.total_candidates}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-sm text-slate-600 mb-1">平均分</div>
            <div className="text-3xl font-bold text-indigo-600">
              {matchResults.result.summary.average_score}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-sm text-slate-600 mb-1">S/A 級候選人</div>
            <div className="text-3xl font-bold text-green-600">
              {matchResults.result.summary.grade_distribution.S + matchResults.result.summary.grade_distribution.A}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-sm text-slate-600 mb-1">等級分布</div>
            <div className="flex gap-2 mt-2">
              {Object.entries(matchResults.result.summary.grade_distribution).map(([grade, count]) => (
                count > 0 && (
                  <span key={grade} className={`px-2 py-1 text-xs font-semibold rounded border ${getGradeColor(grade)}`}>
                    {grade}×{count}
                  </span>
                )
              ))}
            </div>
          </div>
        </div>

        {/* Top 5 推薦 */}
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border border-indigo-200 p-6 mb-6">
          <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
            <TrendingUp className="text-indigo-600" size={24} />
            Top 5 推薦
          </h2>
          <div className="space-y-3">
            {matchResults.result.summary.top_5
              .filter(c => c && c.name)  // 防守：過濾掉無效候選人
              .map((candidate, idx) => (
              <div key={idx} className="bg-white rounded-lg p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-2xl font-bold text-slate-400">#{idx + 1}</div>
                  <div>
                    <div className="font-semibold text-slate-900">{candidate.name || '未知'}</div>
                    <div className="text-sm text-slate-600">
                      總分 {candidate.total_score || 0} · 優先級 <span className={getPriorityColor(candidate.priority)}>{candidate.priority}</span>
                    </div>
                  </div>
                </div>
                <span className={`px-3 py-1.5 text-sm font-semibold rounded-lg border ${getGradeColor(candidate.grade)}`}>
                  {candidate.grade} 級
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 詳細配對報告 - 簡化版，只顯示 Top 3 */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
            <FileText className="text-indigo-600" size={24} />
            詳細配對報告（Top 3）
          </h2>
          <div className="space-y-6">
            {matchResults.result.matches.slice(0, 3).map((match, idx) => (
              <div key={idx} className="border border-slate-200 rounded-lg p-6">
                {/* 候選人基本資訊 */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">#{idx + 1} {match.candidate.name}</h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className={`px-2 py-1 text-xs font-semibold rounded border ${getGradeColor(match.等級)}`}>
                        {match.等級} 級
                      </span>
                      <span className="text-sm text-slate-600">
                        總分 <span className="font-semibold text-indigo-600">{match.總分}</span> / 100
                      </span>
                      <span className={`text-sm font-semibold ${getPriorityColor(match.推薦優先級)}`}>
                        優先級：{match.推薦優先級}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 維度評分 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  {Object.entries(match.維度評分).map(([dimension, score]) => (
                    <div key={dimension} className="bg-slate-50 rounded-lg p-3">
                      <div className="text-xs text-slate-600 mb-1">{dimension}</div>
                      <div className="text-2xl font-bold text-slate-900">{score}</div>
                    </div>
                  ))}
                </div>

                {/* 適配亮點 */}
                {match.適配亮點 && match.適配亮點.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-slate-700 mb-2">✓ 適配亮點</h4>
                    <ul className="space-y-1">
                      {match.適配亮點.map((highlight, i) => (
                        <li key={i} className="text-sm text-green-700 flex items-start gap-2">
                          <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                          <span>{highlight}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 風險提示 */}
                {match.風險提示 && match.風險提示.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-slate-700 mb-2">⚠️ 風險提示</h4>
                    <ul className="space-y-1">
                      {match.風險提示.map((risk, i) => (
                        <li key={i} className="text-sm text-yellow-700 flex items-start gap-2">
                          <AlertCircle size={16} className="mt-0.5 shrink-0" />
                          <span>{risk}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 建議 */}
                {match.建議 && (
                  <div className="bg-blue-50 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-slate-700 mb-2">💡 建議</h4>
                    <div className="space-y-2 text-sm text-slate-700">
                      {match.建議.面試重點 && match.建議.面試重點.length > 0 && (
                        <div>
                          <span className="font-semibold">面試重點：</span>
                          <span className="ml-2">{match.建議.面試重點.join('、')}</span>
                        </div>
                      )}
                      {match.建議.薪資策略 && (
                        <div>
                          <span className="font-semibold">薪資策略：</span>
                          <span className="ml-2">{match.建議.薪資策略}</span>
                        </div>
                      )}
                      {match.建議.留任策略 && (
                        <div>
                          <span className="font-semibold">留任策略：</span>
                          <span className="ml-2">{match.建議.留任策略}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 操作按鈕 */}
        <div className="flex justify-between items-center">
          <button
            onClick={() => {
              setStep('job-selection');
              setSelectedJob(null);
              setSelectedCandidates([]);
              setMatchResults(null);
            }}
            className="px-6 py-3 bg-slate-200 text-slate-700 rounded-xl hover:bg-slate-300 transition-all"
          >
            重新配對
          </button>
          <button
            onClick={() => {
              if (matchResults) {
                generateMatchingReportPDF({
                  jobTitle: selectedJob?.title || '未指定職缺',
                  companyName: selectedJob?.company.name || '未指定公司',
                  summary: matchResults.summary,
                  matches: matchResults.matches
                });
              }
            }}
            className="px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all flex items-center gap-2"
          >
            <Download size={20} />
            匯出 PDF 報告
          </button>
        </div>
      </div>
    );
  }

  return null;
};
