import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile } from '../types';
import { getApiUrl, getAuthHeaders } from '../config/api';
import { GRADE_CONFIG } from '../constants';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { RefreshCw, Users, Filter, Shield, PieChart as PieChartIcon, BarChart3 } from 'lucide-react';
import { PageGuide } from '../components/PageGuide';
import { OnboardingTour, TourStep } from '../components/OnboardingTour';

interface TalentMapPageProps {
  userProfile: UserProfile;
}

interface Job {
  id: number;
  position_name: string;
  client_company: string;
  key_skills: string;
  job_status: string;
}

const PIE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#94a3b8'];
const BAR_COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe', '#ede9fe', '#818cf8', '#4f46e5'];

export function TalentMapPage({ userProfile }: TalentMapPageProps) {
  const [candidates, setCandidates] = useState<any[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [tourActive, setTourActive] = useState(false);

  const guideSteps = [
    { icon: <Filter size={14} className="text-blue-600" />, title: '選擇職缺', desc: '從下拉選單選擇職缺，圖表會顯示該職缺相關人才分布' },
    { icon: <PieChartIcon size={14} className="text-blue-600" />, title: '等級分布', desc: '圓餅圖顯示 A/B/C/D 各等級人選比例' },
    { icon: <BarChart3 size={14} className="text-blue-600" />, title: '數據分析', desc: '長條圖顯示公司來源 TOP 10、薪資區間、年資分布' },
    { icon: <Shield size={14} className="text-blue-600" />, title: '權限說明', desc: '非管理員只能看到自己負責的人選資料' },
  ];

  const tourSteps: TourStep[] = [
    { target: 'map-job-selector', title: '選擇職缺', content: '從下拉選單選擇一個職缺，圖表會篩選出技能相符的候選人', placement: 'bottom' },
    { target: 'map-grade-chart', title: '等級分布', content: '圓餅圖顯示人選的 A/B/C/D 等級比例，快速了解人才池品質', placement: 'bottom' },
    { target: 'map-company-chart', title: '公司來源', content: '顯示人選來自哪些公司 TOP 10，了解人才來源分布', placement: 'bottom' },
    { target: 'map-salary-chart', title: '薪資分布', content: '直方圖顯示人選的薪資區間分布，幫助定價', placement: 'top' },
  ];

  const fetchData = async () => {
    setLoading(true);
    try {
      const [candRes, jobsRes] = await Promise.all([
        fetch(getApiUrl('/candidates?limit=2000'), { headers: getAuthHeaders() }),
        fetch(getApiUrl('/jobs'), { headers: getAuthHeaders() }),
      ]);
      const candJson = await candRes.json();
      const jobsJson = await jobsRes.json();
      setCandidates(candJson.data || []);
      setJobs((jobsJson.data || []).filter((j: Job) => j.job_status === '招募中' || j.job_status === '開放中'));
    } catch (e) {
      console.error('TalentMap fetch error:', e);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // Role-based filtering: non-admin only sees their own candidates
  const myCandidates = useMemo(() => {
    if (userProfile.role === 'ADMIN') return candidates;
    return candidates.filter(c => c.consultant === userProfile.displayName);
  }, [candidates, userProfile]);

  // Filter by selected job's role_family if applicable
  const filteredCandidates = useMemo(() => {
    if (!selectedJobId) return myCandidates;
    const job = jobs.find(j => j.id === selectedJobId);
    if (!job) return myCandidates;
    // Filter candidates that match this job (by role family or skills overlap)
    const jobSkills = (job.key_skills || '').split(/[,，、\s]+/).map(s => s.trim().toLowerCase()).filter(Boolean);
    return myCandidates.filter(c => {
      const cSkills = Array.isArray(c.normalized_skills)
        ? c.normalized_skills.map((s: string) => s.toLowerCase())
        : (typeof c.skills === 'string' ? c.skills.toLowerCase().split(/[,，、|]+/) : []);
      return jobSkills.some(js => cSkills.some((cs: string) => cs.includes(js) || js.includes(cs)));
    });
  }, [myCandidates, selectedJobId, jobs]);

  // Chart 1: Grade distribution (pie)
  const gradeData = useMemo(() => {
    const counts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, '未分級': 0 };
    filteredCandidates.forEach(c => {
      const g = c.gradeLevel || c.grade_level || '未分級';
      counts[g] = (counts[g] || 0) + 1;
    });
    return Object.entries(counts).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));
  }, [filteredCandidates]);

  // Chart 2: Company source top 10 (bar)
  const companyData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredCandidates.forEach(c => {
      const company = c.current_company || c.workHistory?.[0]?.company || '未知';
      counts[company] = (counts[company] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name: name.length > 12 ? name.slice(0, 12) + '...' : name, count }));
  }, [filteredCandidates]);

  // Chart 3: Salary distribution (bar histogram)
  const salaryData = useMemo(() => {
    const buckets = [
      { range: '<40K', min: 0, max: 40000 },
      { range: '40-60K', min: 40000, max: 60000 },
      { range: '60-80K', min: 60000, max: 80000 },
      { range: '80-100K', min: 80000, max: 100000 },
      { range: '100-120K', min: 100000, max: 120000 },
      { range: '120-150K', min: 120000, max: 150000 },
      { range: '>150K', min: 150000, max: Infinity },
    ];
    const counts = buckets.map(b => ({ range: b.range, count: 0 }));
    filteredCandidates.forEach(c => {
      const salary = c.expected_salary_max || c.current_salary_max || c.expected_salary_min || c.current_salary_min;
      if (!salary) return;
      const idx = buckets.findIndex(b => salary >= b.min && salary < b.max);
      if (idx >= 0) counts[idx].count++;
    });
    return counts;
  }, [filteredCandidates]);

  // Chart 4: Years of experience distribution (bar)
  const yearsData = useMemo(() => {
    const buckets = [
      { range: '0-2Y', min: 0, max: 2 },
      { range: '2-5Y', min: 2, max: 5 },
      { range: '5-8Y', min: 5, max: 8 },
      { range: '8-12Y', min: 8, max: 12 },
      { range: '12-20Y', min: 12, max: 20 },
      { range: '>20Y', min: 20, max: Infinity },
    ];
    const counts = buckets.map(b => ({ range: b.range, count: 0 }));
    filteredCandidates.forEach(c => {
      const yrs = c.total_years || c.years || 0;
      if (!yrs) return;
      const idx = buckets.findIndex(b => yrs >= b.min && yrs < b.max);
      if (idx >= 0) counts[idx].count++;
    });
    return counts;
  }, [filteredCandidates]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Onboarding Tour */}
      <OnboardingTour
        storageKey="step1ne-talent-map-tour"
        steps={tourSteps}
        active={tourActive}
        onComplete={() => setTourActive(false)}
      />

      {/* Page Guide */}
      <PageGuide
        storageKey="step1ne-talent-map-guide"
        title="如何使用人才地圖"
        steps={guideSteps}
        onStartTour={() => { localStorage.removeItem('step1ne-talent-map-tour'); setTourActive(true); }}
      />

      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3" data-tour="map-job-selector">
          <Filter size={16} className="text-gray-400" />
          <select
            value={selectedJobId ?? ''}
            onChange={e => setSelectedJobId(e.target.value ? Number(e.target.value) : null)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 max-w-xs"
          >
            <option value="">全部候選人</option>
            {jobs.map(j => (
              <option key={j.id} value={j.id}>{j.position_name} ({j.client_company})</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500 flex items-center gap-1">
            <Users size={14} />
            {filteredCandidates.length} 位候選人
          </span>
          <button onClick={fetchData} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <RefreshCw size={16} />
          </button>
          {userProfile.role !== 'ADMIN' && (
            <span className="flex items-center gap-1 text-xs text-blue-500">
              <Shield size={12} />
              只顯示您負責的人選
            </span>
          )}
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Grade Distribution */}
        <div className="bg-white rounded-xl border border-gray-200 p-5" data-tour="map-grade-chart">
          <h3 className="text-sm font-bold text-gray-800 mb-4">Grade 等級分布</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={gradeData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={90}
                dataKey="value"
                label={({ name, value }) => `${name} (${value})`}
                labelLine={false}
              >
                {gradeData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Company Source Top 10 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5" data-tour="map-company-chart">
          <h3 className="text-sm font-bold text-gray-800 mb-4">公司來源 TOP 10</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={companyData} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {companyData.map((_, i) => (
                  <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Salary Distribution */}
        <div className="bg-white rounded-xl border border-gray-200 p-5" data-tour="map-salary-chart">
          <h3 className="text-sm font-bold text-gray-800 mb-4">薪資分布 (TWD/月)</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={salaryData} margin={{ left: 0, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="range" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Years Distribution */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-bold text-gray-800 mb-4">年資分布</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={yearsData} margin={{ left: 0, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="range" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export default TalentMapPage;
