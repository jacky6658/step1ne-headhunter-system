import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { Target, Users, Building2, Sparkles, Download, FileText, TrendingUp, CheckCircle2, AlertCircle } from 'lucide-react';

interface AIMatchingPageProps {
  userProfile: UserProfile;
}

interface Job {
  title: string;
  department: string;
  requiredSkills: string[];
  preferredSkills: string[];
  yearsRequired: number;
  educationRequired: string;
  responsibilities: string[];
  benefits: string[];
}

interface Company {
  name: string;
  industry: string;
  size: string;
  stage: string;
  culture: string;
  techStack: string[];
  workLocation: string;
  remotePolicy: string;
}

interface Candidate {
  id: string;
  name: string;
  position: string;
  years: number;
  skills: string;
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

export const AIMatchingPage: React.FC<AIMatchingPageProps> = ({ userProfile }) => {
  const [step, setStep] = useState<'setup' | 'selecting' | 'matching' | 'results'>('setup');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);
  const [matchResults, setMatchResults] = useState<BatchMatchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 職缺資訊（暫時寫死，未來可改為動態表單）
  const [job, setJob] = useState<Job>({
    title: 'AI 工程師',
    department: '技術部',
    requiredSkills: ['Python', 'Machine Learning', 'Deep Learning'],
    preferredSkills: ['PyTorch', 'TensorFlow', 'NLP'],
    yearsRequired: 3,
    educationRequired: '大學',
    responsibilities: ['開發 AI 模型', '資料處理與分析', '模型部署與優化'],
    benefits: ['彈性工時', '遠端辦公', '教育訓練補助']
  });

  // 公司資訊（暫時寫死，未來可改為動態表單）
  const [company, setCompany] = useState<Company>({
    name: '創新科技股份有限公司',
    industry: '軟體科技',
    size: '100-500',
    stage: '成長期',
    culture: '自主型',
    techStack: ['Python', 'PyTorch', 'AWS', 'Docker'],
    workLocation: '台北',
    remotePolicy: '混合辦公'
  });

  // 載入候選人列表
  useEffect(() => {
    fetchCandidates();
  }, []);

  const fetchCandidates = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/candidates');
      const data = await response.json();
      if (data.success) {
        setCandidates(data.data);
      }
    } catch (err) {
      console.error('載入候選人失敗:', err);
      setError('載入候選人失敗');
    }
  };

  const handleCandidateToggle = (candidateId: string) => {
    setSelectedCandidates(prev => 
      prev.includes(candidateId)
        ? prev.filter(id => id !== candidateId)
        : [...prev, candidateId]
    );
  };

  const handleStartMatching = async () => {
    if (selectedCandidates.length === 0) {
      alert('請至少選擇 1 位候選人');
      return;
    }

    setLoading(true);
    setError(null);
    setStep('matching');

    try {
      const response = await fetch('http://localhost:3001/api/personas/batch-match', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          job,
          company,
          candidateIds: selectedCandidates
        })
      });

      const data: BatchMatchResponse = await response.json();

      if (data.success) {
        setMatchResults(data);
        setStep('results');
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

  // Setup 階段
  if (step === 'setup') {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Sparkles className="text-indigo-600" size={32} />
            AI 配對推薦
          </h1>
          <p className="text-slate-600 mt-2">
            使用 AI 人才畫像 + 公司畫像雙引擎匹配系統，找出最適合的候選人
          </p>
        </div>

        {/* 職缺與公司資訊預覽 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* 職缺資訊 */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <Building2 className="text-indigo-600" size={24} />
              <h2 className="text-xl font-bold text-slate-900">職缺資訊</h2>
            </div>
            <div className="space-y-3">
              <div>
                <span className="text-sm font-medium text-slate-700">職位：</span>
                <span className="text-sm text-slate-900 ml-2">{job.title}</span>
              </div>
              <div>
                <span className="text-sm font-medium text-slate-700">部門：</span>
                <span className="text-sm text-slate-900 ml-2">{job.department}</span>
              </div>
              <div>
                <span className="text-sm font-medium text-slate-700">必備技能：</span>
                <div className="flex flex-wrap gap-2 mt-2">
                  {job.requiredSkills.map((skill, idx) => (
                    <span key={idx} className="px-2 py-1 bg-indigo-100 text-indigo-800 text-xs rounded-lg">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-sm font-medium text-slate-700">加分技能：</span>
                <div className="flex flex-wrap gap-2 mt-2">
                  {job.preferredSkills.map((skill, idx) => (
                    <span key={idx} className="px-2 py-1 bg-slate-100 text-slate-700 text-xs rounded-lg">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 公司資訊 */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <Target className="text-indigo-600" size={24} />
              <h2 className="text-xl font-bold text-slate-900">公司資訊</h2>
            </div>
            <div className="space-y-3">
              <div>
                <span className="text-sm font-medium text-slate-700">公司名稱：</span>
                <span className="text-sm text-slate-900 ml-2">{company.name}</span>
              </div>
              <div>
                <span className="text-sm font-medium text-slate-700">產業：</span>
                <span className="text-sm text-slate-900 ml-2">{company.industry}</span>
              </div>
              <div>
                <span className="text-sm font-medium text-slate-700">階段：</span>
                <span className="text-sm text-slate-900 ml-2">{company.stage}</span>
              </div>
              <div>
                <span className="text-sm font-medium text-slate-700">企業文化：</span>
                <span className="text-sm text-slate-900 ml-2">{company.culture}</span>
              </div>
              <div>
                <span className="text-sm font-medium text-slate-700">工作模式：</span>
                <span className="text-sm text-slate-900 ml-2">{company.remotePolicy}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 開始配對按鈕 */}
        <div className="flex justify-center">
          <button
            onClick={() => setStep('selecting')}
            className="px-8 py-4 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/30 flex items-center gap-3 text-lg font-semibold"
          >
            <Users size={24} />
            選擇候選人開始配對
          </button>
        </div>
      </div>
    );
  }

  // Selecting 階段
  if (step === 'selecting') {
    return (
      <div className="max-w-7xl mx-auto p-6">
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
                {candidates.slice(0, 50).map((candidate) => (
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
                    <td className="px-4 py-3 text-sm text-slate-600">{candidate.position}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{candidate.years} 年</td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      <div className="max-w-xs truncate">{candidate.skills}</div>
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
            onClick={() => setStep('setup')}
            className="px-6 py-3 bg-slate-200 text-slate-700 rounded-xl hover:bg-slate-300 transition-all"
          >
            返回上一步
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

  // Results 階段
  if (step === 'results' && matchResults) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <CheckCircle2 className="text-green-600" size={28} />
            配對結果
          </h1>
          <p className="text-slate-600 mt-1">
            {matchResults.company.name} - {matchResults.company.jobTitle}
          </p>
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
            {matchResults.result.summary.top_5.map((candidate, idx) => (
              <div key={idx} className="bg-white rounded-lg p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-2xl font-bold text-slate-400">#{idx + 1}</div>
                  <div>
                    <div className="font-semibold text-slate-900">{candidate.name}</div>
                    <div className="text-sm text-slate-600">
                      總分 {candidate.total_score} · 優先級 <span className={getPriorityColor(candidate.priority)}>{candidate.priority}</span>
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

        {/* 詳細配對報告 */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
            <FileText className="text-indigo-600" size={24} />
            詳細配對報告
          </h2>
          <div className="space-y-6">
            {matchResults.result.matches.map((match, idx) => (
              <div key={idx} className="border border-slate-200 rounded-lg p-6">
                {/* 候選人基本資訊 */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{match.candidate.name}</h3>
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
              setStep('setup');
              setSelectedCandidates([]);
              setMatchResults(null);
            }}
            className="px-6 py-3 bg-slate-200 text-slate-700 rounded-xl hover:bg-slate-300 transition-all"
          >
            重新配對
          </button>
          <button
            onClick={() => alert('PDF 匯出功能開發中')}
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
