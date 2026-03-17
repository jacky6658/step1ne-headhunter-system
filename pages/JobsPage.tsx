import React, { useState, useEffect, useRef, useMemo } from 'react';
import { UserProfile } from '../types';
import { Briefcase, Search, Building2, Users, Target, TrendingUp, FileText, Edit3, Save, X as XIcon, Bot, Plus, Trash2, AlertTriangle, ClipboardCheck, ShieldAlert, Hash, Sparkles } from 'lucide-react';
import { apiGet, apiPut, apiPost, apiDelete } from '../config/api';
import { fmtDate } from '../utils/dateFormat';
import { toast } from '../components/Toast';

interface JobsPageProps {
  userProfile: UserProfile;
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
  marketing_description: string;
  company_profile: string;
  talent_profile: string;
  search_primary: string;
  search_secondary: string;
  target_companies: string;    // 逗號分隔，目標公司（從這些公司挖人）
  title_variants: string;      // 逗號分隔，職稱變體
  exclusion_keywords: string;  // 逗號分隔，排除關鍵字
  welfare_tags: string;      // 逗號分隔，福利標籤
  welfare_detail: string;    // 詳細福利說明
  work_hours: string;        // 上班時段
  vacation_policy: string;   // 休假制度
  remote_work: string;       // 遠端工作
  business_trip: string;     // 出差外派
  job_url: string;           // 104/1111 原始連結
  // 新增欄位
  submission_criteria: string;
  interview_stages: number;
  interview_stage_detail: string;
  priority: string;
  salary_min: number;
  salary_max: number;
  rejection_criteria: string;
  created_at: string;
  lastUpdated: string;
}

type ModalTab = 'basic' | 'description' | 'matching';

// 新增職缺空白模板
const emptyJob: Partial<Job> = {
  position_name: '', client_company: '', department: '', open_positions: '',
  salary_range: '', salary_min: 0, salary_max: 0, key_skills: '',
  experience_required: '', education_required: '', location: '', job_status: '招募中',
  language_required: '', special_conditions: '', industry_background: '', team_size: '',
  key_challenges: '', attractive_points: '', recruitment_difficulty: '', interview_process: '',
  consultant_notes: '', job_description: '', company_profile: '', talent_profile: '',
  search_primary: '', search_secondary: '', submission_criteria: '', interview_stages: 0,
  interview_stage_detail: '', priority: '一般', rejection_criteria: '',
};

export const JobsPage: React.FC<JobsPageProps> = ({ userProfile }) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  // ── Tab 狀態 ──
  const [activeTab, setActiveTab] = useState<ModalTab>('basic');

  // ── 編輯狀態（三個 Tab 共用） ──
  const [editingBasic, setEditingBasic] = useState(false);
  const [basicDraft, setBasicDraft] = useState<Partial<Job>>({});
  const [savingBasic, setSavingBasic] = useState(false);

  // ── JD 編輯 ──
  const [editingJD, setEditingJD] = useState(false);
  const [jdDraft, setJdDraft] = useState('');
  const [savingJD, setSavingJD] = useState(false);
  const [editingMD, setEditingMD] = useState(false);
  const [mdDraft, setMdDraft] = useState('');
  const [savingMD, setSavingMD] = useState(false);

  // ── 新增職缺 ──
  const [isCreating, setIsCreating] = useState(false);
  const [savingCreate, setSavingCreate] = useState(false);

  // ── 刪除狀態 ──
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // ── 爬蟲搜尋設定狀態 ──
  const [editingSearch, setEditingSearch] = useState(false);
  const [companyProfileDraft, setCompanyProfileDraft] = useState('');
  const [talentProfileDraft, setTalentProfileDraft] = useState('');
  const [primaryTags, setPrimaryTags] = useState<string[]>([]);
  const [secondaryTags, setSecondaryTags] = useState<string[]>([]);
  const [primaryTagInput, setPrimaryTagInput] = useState('');
  const [secondaryTagInput, setSecondaryTagInput] = useState('');
  const [targetCompaniesTags, setTargetCompaniesTags] = useState<string[]>([]);
  const [titleVariantsTags, setTitleVariantsTags] = useState<string[]>([]);
  const [exclusionKeywordsTags, setExclusionKeywordsTags] = useState<string[]>([]);
  const [targetCompaniesInput, setTargetCompaniesInput] = useState('');
  const [titleVariantsInput, setTitleVariantsInput] = useState('');
  const [exclusionKeywordsInput, setExclusionKeywordsInput] = useState('');
  const [savingSearch, setSavingSearch] = useState(false);
  const primaryInputRef = useRef<HTMLInputElement>(null);
  const secondaryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchJobs();
  }, []);

  // 從職缺清單萃取不重複客戶公司名（供篩選用）
  const uniqueClients = useMemo(() => {
    const set = new Set<string>();
    jobs.forEach(j => { if (j.client_company) set.add(j.client_company); });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'zh-TW'));
  }, [jobs]);

  useEffect(() => {
    let result = jobs;
    if (clientFilter) {
      result = result.filter(job => job.client_company === clientFilter);
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(job => {
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
    }
    setFilteredJobs(result);
  }, [searchQuery, clientFilter, jobs]);

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
        showNotification('success', `已同步 ${data.data.length} 個職缺`);
      }
    } catch (error) {
      console.error('同步職缺失敗:', error);
      showNotification('error', '同步失敗');
    } finally {
      setSyncing(false);
    }
  };

  const showNotification = (type: 'success' | 'error', message: string) => {
    if (type === 'success') toast.success(message);
    else toast.error(message);
  };

  const parseTags = (str: string | undefined) =>
    str ? str.split(',').map(s => s.trim()).filter(Boolean) : [];

  const parseSkills = (skillsStr: string | undefined) => {
    if (!skillsStr) return [];
    return skillsStr.split('、').map(s => s.trim()).filter(s => s.length > 0);
  };

  // ── 計算缺少的重要欄位 ──
  const getMissingFields = (job: Job | Partial<Job>) => {
    const checks: { field: string; label: string; tab: ModalTab }[] = [
      { field: 'submission_criteria', label: '客戶送人條件', tab: 'matching' },
      { field: 'interview_stages', label: '面試階段數', tab: 'description' },
      { field: 'interview_stage_detail', label: '面試各階段說明', tab: 'description' },
      { field: 'rejection_criteria', label: '淘汰條件', tab: 'matching' },
      { field: 'salary_min', label: '薪資下限', tab: 'basic' },
      { field: 'salary_max', label: '薪資上限', tab: 'basic' },
    ];
    return checks.filter(c => {
      const v = (job as any)[c.field];
      return !v || v === '' || v === 0;
    });
  };

  // ── 開啟既有職缺 ──
  const handleJobClick = (job: Job) => {
    setSelectedJob(job);
    setIsCreating(false);
    setActiveTab('basic');
    setEditingJD(false);
    setJdDraft(job.job_description || '');
    setEditingBasic(false);
    setBasicDraft({});
    setShowDeleteConfirm(false);
    setEditingSearch(false);
    setCompanyProfileDraft(job.company_profile || '');
    setTalentProfileDraft(job.talent_profile || '');
    setPrimaryTags(parseTags(job.search_primary));
    setSecondaryTags(parseTags(job.search_secondary));
    setTargetCompaniesTags(parseTags(job.target_companies));
    setTitleVariantsTags(parseTags(job.title_variants));
    setExclusionKeywordsTags(parseTags(job.exclusion_keywords));
    setPrimaryTagInput('');
    setSecondaryTagInput('');
    setTargetCompaniesInput('');
    setTitleVariantsInput('');
    setExclusionKeywordsInput('');
  };

  // ── 開啟新增職缺 ──
  const handleCreateNew = () => {
    setSelectedJob({ ...emptyJob, id: '' } as Job);
    setIsCreating(true);
    setActiveTab('basic');
    setEditingBasic(true);
    setBasicDraft({ ...emptyJob });
    setJdDraft('');
    setEditingJD(false);
    setShowDeleteConfirm(false);
    setEditingSearch(false);
    setCompanyProfileDraft('');
    setTalentProfileDraft('');
    setPrimaryTags([]);
    setSecondaryTags([]);
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
      const target_companies  = targetCompaniesTags.join(',');
      const title_variants    = titleVariantsTags.join(',');
      const exclusion_keywords = exclusionKeywordsTags.join(',');
      await apiPut(`/api/jobs/${selectedJob.id}`, {
        company_profile: companyProfileDraft,
        talent_profile:  talentProfileDraft,
        search_primary,
        search_secondary,
        target_companies,
        title_variants,
        exclusion_keywords,
      });
      setSelectedJob(prev => prev ? {
        ...prev,
        company_profile: companyProfileDraft,
        talent_profile:  talentProfileDraft,
        search_primary,
        search_secondary,
        target_companies,
        title_variants,
        exclusion_keywords,
      } : null);
      setEditingSearch(false);
    } catch {
      toast.error('儲存失敗，請稍後再試');
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
      setJobs(prev => prev.map(j => j.id === selectedJob.id ? { ...j, job_description: jdDraft } : j));
      setEditingJD(false);
    } catch {
      toast.error('儲存失敗，請稍後再試');
    } finally {
      setSavingJD(false);
    }
  };

  const handleSaveMD = async () => {
    if (!selectedJob) return;
    setSavingMD(true);
    try {
      await apiPut(`/api/jobs/${selectedJob.id}`, { marketing_description: mdDraft });
      setSelectedJob(prev => prev ? { ...prev, marketing_description: mdDraft } : null);
      setEditingMD(false);
    } catch (err) {
      alert('❌ 儲存失敗，請稍後再試');
    } finally {
      setSavingMD(false);
    }
  };

  // ── 編輯基本資料（所有 Tab 共用） ──
  const handleStartEditBasic = () => {
    if (!selectedJob) return;
    setBasicDraft({
      position_name: selectedJob.position_name,
      client_company: selectedJob.client_company,
      department: selectedJob.department,
      open_positions: selectedJob.open_positions,
      salary_range: selectedJob.salary_range,
      salary_min: selectedJob.salary_min || 0,
      salary_max: selectedJob.salary_max || 0,
      location: selectedJob.location,
      key_skills: selectedJob.key_skills,
      experience_required: selectedJob.experience_required,
      education_required: selectedJob.education_required,
      language_required: selectedJob.language_required,
      job_status: selectedJob.job_status,
      priority: selectedJob.priority || '一般',
      // Tab 1 新增可編輯欄位
      industry_background: selectedJob.industry_background,
      team_size: selectedJob.team_size,
      // Tab 2 欄位
      interview_process: selectedJob.interview_process,
      interview_stages: selectedJob.interview_stages || 0,
      interview_stage_detail: selectedJob.interview_stage_detail,
      key_challenges: selectedJob.key_challenges,
      attractive_points: selectedJob.attractive_points,
      recruitment_difficulty: selectedJob.recruitment_difficulty,
      special_conditions: selectedJob.special_conditions,
      job_description: selectedJob.job_description,
      // Tab 3 欄位
      submission_criteria: selectedJob.submission_criteria,
      rejection_criteria: selectedJob.rejection_criteria,
      consultant_notes: selectedJob.consultant_notes,
    });
    setEditingBasic(true);
  };

  const handleSaveBasic = async () => {
    if (!selectedJob) return;

    // 新增模式
    if (isCreating) {
      if (!basicDraft.position_name?.trim()) {
        toast.warning('職位名稱為必填欄位');
        return;
      }
      setSavingCreate(true);
      try {
        const payload = { ...basicDraft };
        const res = await apiPost<{ success: boolean; data: Job; missing_fields?: any[] }>('/api/jobs', payload);
        if (res.success && res.data) {
          setJobs(prev => [res.data, ...prev]);
          setSelectedJob(res.data);
          setIsCreating(false);
          setEditingBasic(false);
          setBasicDraft({});
          showNotification('success', '職缺建立成功');
        }
      } catch {
        toast.error('建立職缺失敗，請稍後再試');
      } finally {
        setSavingCreate(false);
      }
      return;
    }

    // 編輯模式
    setSavingBasic(true);
    try {
      await apiPut(`/api/jobs/${selectedJob.id}`, basicDraft);
      const updatedJob = { ...selectedJob, ...basicDraft };
      setSelectedJob(updatedJob as Job);
      setJobs(prev => prev.map(j => j.id === selectedJob.id ? { ...j, ...basicDraft } as Job : j));
      setEditingBasic(false);
    } catch {
      toast.error('儲存失敗，請稍後再試');
    } finally {
      setSavingBasic(false);
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    setDeletingJobId(jobId);
    try {
      await apiDelete(`/api/jobs/${jobId}`);
      setJobs(prev => prev.filter(j => j.id !== jobId));
      if (selectedJob?.id === jobId) {
        setSelectedJob(null);
      }
      setShowDeleteConfirm(false);
      showNotification('success', '職缺已成功刪除');
    } catch {
      toast.error('刪除失敗，請稍後再試');
    } finally {
      setDeletingJobId(null);
    }
  };

  const closeModal = () => {
    setSelectedJob(null);
    setEditingJD(false);
    setEditingSearch(false);
    setEditingBasic(false);
    setIsCreating(false);
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

  const getPriorityColor = (priority: string | undefined) => {
    if (!priority || priority === '一般') return 'bg-blue-100 text-blue-700 border-blue-300';
    if (priority === '急件') return 'bg-red-100 text-red-700 border-red-300';
    if (priority === '備用') return 'bg-gray-100 text-gray-600 border-gray-300';
    return 'bg-blue-100 text-blue-700 border-blue-300';
  };

  // ── 通用可編輯欄位組件 ──
  const EditableField = ({ label, field, type = 'text', placeholder = '', rows = 3, className = '' }: {
    label: string; field: keyof Job; type?: 'text' | 'textarea' | 'number' | 'select'; placeholder?: string; rows?: number; className?: string;
  }) => {
    const value = editingBasic ? (basicDraft as any)[field] : (selectedJob as any)?.[field];
    if (editingBasic) {
      if (type === 'textarea') {
        return (
          <div className={className}>
            <label className="text-xs font-semibold text-slate-600 uppercase">{label}</label>
            <textarea
              value={value || ''}
              onChange={e => setBasicDraft(prev => ({ ...prev, [field]: e.target.value }))}
              rows={rows}
              placeholder={placeholder}
              className="w-full text-sm text-slate-900 border border-slate-300 rounded-lg px-2 py-1.5 mt-0.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-y"
            />
          </div>
        );
      }
      if (type === 'number') {
        return (
          <div className={className}>
            <label className="text-xs font-semibold text-slate-600 uppercase">{label}</label>
            <input
              type="number"
              value={value || ''}
              onChange={e => setBasicDraft(prev => ({ ...prev, [field]: parseInt(e.target.value) || 0 }))}
              placeholder={placeholder}
              className="w-full text-sm text-slate-900 border border-slate-300 rounded-lg px-2 py-1.5 mt-0.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
        );
      }
      return (
        <div className={className}>
          <label className="text-xs font-semibold text-slate-600 uppercase">{label}</label>
          <input
            type="text"
            value={value || ''}
            onChange={e => setBasicDraft(prev => ({ ...prev, [field]: e.target.value }))}
            placeholder={placeholder}
            className="w-full text-sm text-slate-900 border border-slate-300 rounded-lg px-2 py-1.5 mt-0.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
      );
    }
    // 唯讀模式
    if (!value && value !== 0) return null;
    return (
      <div className={className}>
        <label className="text-xs font-semibold text-slate-600 uppercase">{label}</label>
        <p className="text-sm text-slate-900 mt-1 whitespace-pre-line">{value}</p>
      </div>
    );
  };

  // ── Tab 定義 ──
  const tabs: { key: ModalTab; icon: React.ReactNode; label: string }[] = [
    { key: 'basic', icon: <ClipboardCheck size={14} />, label: '基本資訊' },
    { key: 'description', icon: <FileText size={14} />, label: '職缺描述' },
    { key: 'matching', icon: <Target size={14} />, label: '配對與送人' },
  ];

  // ── 取得列表欄位中是否有缺欄位 ──
  const jobHasMissingFields = (job: Job) => getMissingFields(job).length > 0;

  return (
    <div className="max-w-7xl mx-auto px-3 py-4 sm:p-6">
      {/* Header */}
      <div className="mb-4 sm:mb-8">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div>
            <h1 className="text-lg sm:text-3xl font-bold text-slate-900 flex items-center gap-2 sm:gap-3">
              <Briefcase className="text-indigo-600 shrink-0" size={24} />
              職缺管理
            </h1>
            <p className="text-slate-600 mt-1 sm:mt-2 text-xs sm:text-base">
              管理所有客戶職缺，追蹤招募狀態
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCreateNew}
              className="px-3 py-2 sm:px-5 sm:py-2.5 rounded-xl font-semibold flex items-center gap-1.5 sm:gap-2 transition-all bg-emerald-600 text-white hover:bg-emerald-700 shadow-md hover:shadow-lg text-sm sm:text-base"
            >
              <Plus size={16} />
              <span className="hidden xs:inline">新增</span>職缺
            </button>
            <button
              onClick={syncJobs}
              disabled={syncing}
              className={`px-3 py-2 sm:px-5 sm:py-2.5 rounded-xl font-semibold flex items-center gap-1.5 sm:gap-2 transition-all text-sm sm:text-base ${
                syncing
                  ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md hover:shadow-lg'
              }`}
            >
              <svg
                className={`w-4 h-4 sm:w-5 sm:h-5 ${syncing ? 'animate-spin' : ''}`}
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
              {syncing ? '同步中...' : '同步'}
            </button>
          </div>
        </div>
      </div>

      {/* 統計卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs sm:text-sm text-slate-600 mb-0.5 sm:mb-1">總職缺數</div>
              <div className="text-2xl sm:text-3xl font-bold text-slate-900">{jobs.length}</div>
            </div>
            <Briefcase className="text-indigo-600 hidden sm:block" size={32} />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs sm:text-sm text-slate-600 mb-0.5 sm:mb-1">開放中</div>
              <div className="text-2xl sm:text-3xl font-bold text-green-600">
                {jobs.filter(j => j.job_status && (j.job_status.includes('開放') || j.job_status.includes('招募'))).length}
              </div>
            </div>
            <TrendingUp className="text-green-600 hidden sm:block" size={32} />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs sm:text-sm text-slate-600 mb-0.5 sm:mb-1">獨立公司</div>
              <div className="text-2xl sm:text-3xl font-bold text-indigo-600">
                {new Set(jobs.map(j => j.client_company)).size}
              </div>
            </div>
            <Building2 className="text-indigo-600 hidden sm:block" size={32} />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs sm:text-sm text-slate-600 mb-0.5 sm:mb-1">急件</div>
              <div className="text-2xl sm:text-3xl font-bold text-red-600">
                {jobs.filter(j => j.priority === '急件').length}
              </div>
            </div>
            <AlertTriangle className="text-red-500 hidden sm:block" size={32} />
          </div>
        </div>
      </div>

      {/* 搜尋列 + 客戶篩選 */}
      <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row gap-2 sm:gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="搜尋職位、公司、技能..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 sm:pl-12 pr-4 py-2.5 sm:py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm sm:text-base"
          />
        </div>
        <div className="relative sm:min-w-[200px]">
          <select
            value={clientFilter}
            onChange={e => setClientFilter(e.target.value)}
            className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm appearance-none bg-white"
          >
            <option value="">全部客戶 ({jobs.length})</option>
            {uniqueClients.map(c => (
              <option key={c} value={c}>{c} ({jobs.filter(j => j.client_company === c).length})</option>
            ))}
          </select>
          {clientFilter && (
            <button
              onClick={() => setClientFilter('')}
              className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm"
            >&times;</button>
          )}
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
        {/* 手機版卡片列表 — 不顯示刪除按鈕，進 Modal 後再操作 */}
        <div className="block md:hidden space-y-2">
          {filteredJobs.map((job) => (
            <div
              key={job.id}
              className="bg-white rounded-xl border border-slate-200 px-3 py-2.5 cursor-pointer active:bg-slate-50 transition-colors"
              onClick={() => handleJobClick(job)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-slate-900 truncate flex items-center gap-1">
                    <span className="text-xs text-slate-400 font-mono">#{job.id}</span>
                    {job.position_name}
                    {jobHasMissingFields(job) && <AlertTriangle size={12} className="text-amber-500 shrink-0" />}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 truncate">{job.client_company}{job.location ? ` · ${job.location}` : ''}</div>
                </div>
                <div className="flex items-center gap-1 shrink-0 mt-0.5">
                  {job.priority === '急件' && (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold rounded border bg-red-100 text-red-700 border-red-300">
                      急
                    </span>
                  )}
                  <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded border ${getStatusColor(job.job_status)}`}>
                    {job.job_status}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 桌機版表格列表 */}
        <div className="hidden md:block bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider w-12">編號</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">職位名稱</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">客戶公司</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider min-w-[80px]">優先級</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider min-w-[100px]">部門</th>
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
                    <td className="px-4 py-3 text-sm text-slate-400 font-mono">#{job.id}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                        {job.position_name}
                        {jobHasMissingFields(job) && <AlertTriangle size={13} className="text-amber-500 shrink-0" title="有欄位待補填" />}
                      </div>
                      <div className="text-xs text-slate-500">{job.location}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900">{job.client_company}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded border ${getPriorityColor(job.priority)}`}>
                        {job.priority || '一般'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 min-w-[100px] whitespace-nowrap">{job.department || '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {job.salary_min && job.salary_max ? `${job.salary_min}K ~ ${job.salary_max}K` : (job.salary_range || '-')}
                    </td>
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
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`確定要刪除「${job.position_name}」？此操作無法復原。`)) {
                              handleDeleteJob(job.id);
                            }
                          }}
                          disabled={deletingJobId === job.id}
                          className="px-2 py-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          title="刪除職缺"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </>
      )}

      {/* ======== 職缺詳情 Modal ======== */}
      {selectedJob && (
        <div
          className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 sm:p-4"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-t-2xl sm:rounded-2xl max-w-3xl w-full max-h-[92vh] sm:max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── Header ── */}
            <div className="p-3 sm:p-5 border-b border-slate-200 shrink-0">
              {/* 手機版頂部拖曳條 */}
              <div className="flex justify-center mb-2 sm:hidden">
                <div className="w-10 h-1 bg-slate-300 rounded-full" />
              </div>
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  {editingBasic ? (
                    <input
                      type="text"
                      value={basicDraft.position_name || ''}
                      onChange={e => setBasicDraft(prev => ({ ...prev, position_name: e.target.value }))}
                      className="text-base sm:text-xl font-bold text-slate-900 w-full border-b-2 border-indigo-400 focus:outline-none bg-transparent pb-1"
                      placeholder="職位名稱（必填）"
                    />
                  ) : (
                    <h2 className="text-base sm:text-xl font-bold text-slate-900 leading-tight">
                      <span className="text-sm text-slate-400 font-mono mr-1.5">#{selectedJob.id}</span>
                      {selectedJob.position_name}
                    </h2>
                  )}
                  {editingBasic ? (
                    <input
                      type="text"
                      value={basicDraft.client_company || ''}
                      onChange={e => setBasicDraft(prev => ({ ...prev, client_company: e.target.value }))}
                      className="text-slate-600 mt-1 w-full border-b border-indigo-300 focus:outline-none bg-transparent pb-0.5 text-xs sm:text-sm"
                      placeholder="客戶公司"
                    />
                  ) : (
                    <p className="text-xs sm:text-sm text-slate-600 mt-0.5">{selectedJob.client_company}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 sm:gap-2 ml-2 sm:ml-3 flex-shrink-0">
                  {!editingBasic ? (
                    <>
                      <button
                        onClick={handleStartEditBasic}
                        className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 px-1.5 sm:px-2 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors"
                        title="編輯"
                      >
                        <Edit3 size={14} />
                        <span className="hidden sm:inline">編輯</span>
                      </button>
                      {/* 刪除按鈕：小 icon、低對比度、不易誤觸 */}
                      {!isCreating && (
                        <button
                          onClick={() => setShowDeleteConfirm(true)}
                          className="text-slate-300 hover:text-red-500 p-1 rounded transition-colors"
                          title="刪除職缺"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <button
                        onClick={handleSaveBasic}
                        disabled={savingBasic || savingCreate}
                        className="flex items-center gap-1 text-xs bg-indigo-600 text-white px-2.5 sm:px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                      >
                        <Save size={12} />
                        {savingBasic || savingCreate ? '...' : (isCreating ? '建立' : '儲存')}
                      </button>
                      <button
                        onClick={() => {
                          if (isCreating) { closeModal(); return; }
                          setEditingBasic(false);
                          setBasicDraft({});
                        }}
                        className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 px-1.5 sm:px-2 py-1.5"
                      >
                        <XIcon size={14} />
                        <span className="hidden sm:inline">取消</span>
                      </button>
                    </>
                  )}
                  <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 ml-0.5 sm:ml-1">
                    <XIcon size={16} />
                  </button>
                </div>
              </div>

              {/* 刪除確認 — 2 步驟，不會誤觸 */}
              {showDeleteConfirm && (
                <div className="mt-2 p-2.5 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-xs text-red-800 mb-2">
                    確定刪除「{selectedJob.position_name}」？無法復原。
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDeleteJob(selectedJob.id)}
                      disabled={deletingJobId === selectedJob.id}
                      className="px-2.5 py-1 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 disabled:opacity-50 transition-all"
                    >
                      {deletingJobId === selectedJob.id ? '刪除中...' : '確認刪除'}
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-2.5 py-1 bg-white text-slate-600 text-xs rounded-lg border border-slate-300 hover:bg-slate-50 transition-all"
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}

              {/* ── 缺欄位提醒 ── */}
              {!isCreating && getMissingFields(selectedJob).length > 0 && (
                <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-1.5">
                  <AlertTriangle size={13} className="text-amber-500 shrink-0 mt-0.5" />
                  <div className="text-[11px] sm:text-xs text-amber-800 flex-1 leading-relaxed">
                    <span className="font-semibold">{getMissingFields(selectedJob).length} 項待補：</span>
                    {getMissingFields(selectedJob).map((f, i) => (
                      <button
                        key={i}
                        className="inline-flex items-center mx-0.5 px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] sm:text-[11px] hover:bg-amber-200 transition-colors"
                        onClick={() => { setActiveTab(f.tab); if (!editingBasic) handleStartEditBasic(); }}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Tab 切換 ── */}
              <div className="flex gap-0.5 sm:gap-1 mt-2 sm:mt-3 -mb-[1px] relative z-[1]">
                {tabs.map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs font-semibold rounded-t-lg border transition-colors ${
                      activeTab === tab.key
                        ? 'bg-white text-indigo-700 border-slate-200 border-b-white'
                        : 'bg-slate-50 text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Tab 內容 ── */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-5">

              {/* ======== Tab 1: 基本資訊 ======== */}
              {activeTab === 'basic' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <EditableField label="部門" field="department" />
                    <div>
                      <label className="text-xs font-semibold text-slate-600 uppercase">需求人數</label>
                      {editingBasic ? (
                        <input
                          type="text"
                          value={basicDraft.open_positions || ''}
                          onChange={e => setBasicDraft(prev => ({ ...prev, open_positions: e.target.value }))}
                          className="w-full text-sm text-slate-900 border border-slate-300 rounded-lg px-2 py-1.5 mt-0.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        />
                      ) : (
                        <p className="text-sm text-slate-900 mt-1">{selectedJob.open_positions || '-'}</p>
                      )}
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600 uppercase">狀態</label>
                      {editingBasic ? (
                        <select
                          value={basicDraft.job_status || '招募中'}
                          onChange={e => setBasicDraft(prev => ({ ...prev, job_status: e.target.value }))}
                          className="w-full text-sm text-slate-900 border border-slate-300 rounded-lg px-2 py-1.5 mt-0.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        >
                          <option value="招募中">招募中</option>
                          <option value="暫停">暫停</option>
                          <option value="已滿額">已滿額</option>
                          <option value="關閉">關閉</option>
                        </select>
                      ) : (
                        <p className="mt-1">
                          <span className={`px-2 py-0.5 text-xs font-semibold rounded border ${getStatusColor(selectedJob.job_status)}`}>
                            {selectedJob.job_status}
                          </span>
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600 uppercase">優先級</label>
                      {editingBasic ? (
                        <select
                          value={basicDraft.priority || '一般'}
                          onChange={e => setBasicDraft(prev => ({ ...prev, priority: e.target.value }))}
                          className="w-full text-sm text-slate-900 border border-slate-300 rounded-lg px-2 py-1.5 mt-0.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        >
                          <option value="急件">急件</option>
                          <option value="一般">一般</option>
                          <option value="備用">備用</option>
                        </select>
                      ) : (
                        <p className="mt-1">
                          <span className={`px-2 py-0.5 text-xs font-semibold rounded border ${getPriorityColor(selectedJob.priority)}`}>
                            {selectedJob.priority || '一般'}
                          </span>
                        </p>
                      )}
                    </div>
                    <EditableField label="地點" field="location" />
                    <div>
                      <label className="text-xs font-semibold text-slate-600 uppercase">薪資範圍（文字）</label>
                      {editingBasic ? (
                        <input
                          type="text"
                          value={basicDraft.salary_range || ''}
                          onChange={e => setBasicDraft(prev => ({ ...prev, salary_range: e.target.value }))}
                          className="w-full text-sm text-slate-900 border border-slate-300 rounded-lg px-2 py-1.5 mt-0.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                          placeholder="如：年薪 150-200 萬"
                        />
                      ) : (
                        <p className="text-sm text-slate-900 mt-1">{selectedJob.salary_range || '-'}</p>
                      )}
                    </div>
                    <EditableField label="薪資下限（K/月）" field="salary_min" type="number" placeholder="如：80" />
                    <EditableField label="薪資上限（K/月）" field="salary_max" type="number" placeholder="如：120" />
                    <EditableField label="產業背景" field="industry_background" />
                    <EditableField label="團隊規模" field="team_size" />
                  </div>

                  <EditableField label="經驗要求" field="experience_required" />
                  <EditableField label="學歷要求" field="education_required" />
                  <EditableField label="語言要求" field="language_required" />

                  <div>
                    <label className="text-xs font-semibold text-slate-600 uppercase">主要技能</label>
                    {editingBasic ? (
                      <input
                        type="text"
                        value={basicDraft.key_skills || ''}
                        onChange={e => setBasicDraft(prev => ({ ...prev, key_skills: e.target.value }))}
                        className="w-full text-sm text-slate-900 border border-slate-300 rounded-lg px-2 py-1.5 mt-1 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        placeholder="用「、」分隔，例：React、TypeScript、Node.js"
                      />
                    ) : (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {parseSkills(selectedJob.key_skills).map((skill, idx) => (
                          <span key={idx} className="px-3 py-1 bg-indigo-50 text-indigo-700 text-sm rounded-lg">
                            {skill}
                          </span>
                        ))}
                        {!selectedJob.key_skills && <span className="text-sm text-slate-400">-</span>}
                      </div>
                    )}
                    {selectedJob.title_variants && (
                      <div>
                        <span className="text-xs text-slate-400">職稱變體</span>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {parseTags(selectedJob.title_variants).map((t, i) => (
                            <span key={i} className="px-2 py-0.5 bg-violet-100 text-violet-800 text-xs rounded-full">{t}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {selectedJob.target_companies && (
                      <div>
                        <span className="text-xs text-slate-400">目標公司</span>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {parseTags(selectedJob.target_companies).map((t, i) => (
                            <span key={i} className="px-2 py-0.5 bg-amber-100 text-amber-800 text-xs rounded-full">{t}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {selectedJob.exclusion_keywords && (
                      <div>
                        <span className="text-xs text-slate-400">排除關鍵字</span>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {parseTags(selectedJob.exclusion_keywords).map((t, i) => (
                            <span key={i} className="px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded-full">{t}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 時間戳 */}
                  {!isCreating && (
                    <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                      <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase">建立時間</label>
                        <p className="text-xs text-slate-600 mt-1">{fmtDate(selectedJob.created_at)}</p>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase">更新時間</label>
                        <p className="text-xs text-slate-600 mt-1">{fmtDate(selectedJob.lastUpdated)}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ======== Tab 2: 職缺描述 ======== */}
              {activeTab === 'description' && (
                <div className="space-y-4">
                  {/* JD 工作內容 */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold text-slate-600 uppercase flex items-center gap-1.5">
                        <FileText size={13} />
                        工作內容 JD
                      </label>
                      {!editingBasic && !isCreating && (
                        !editingJD ? (
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
                        )
                      )}
                    </div>

                    {editingBasic ? (
                      <textarea
                        value={basicDraft.job_description || ''}
                        onChange={e => setBasicDraft(prev => ({ ...prev, job_description: e.target.value }))}
                        rows={10}
                        placeholder="貼上完整 JD..."
                        className="w-full border border-slate-200 rounded-xl p-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-y font-mono leading-relaxed"
                      />
                    ) : editingJD ? (
                      <textarea
                        value={jdDraft}
                        onChange={e => setJdDraft(e.target.value)}
                        rows={12}
                        placeholder="貼上職缺完整 JD..."
                        className="w-full border border-slate-200 rounded-xl p-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-y font-mono leading-relaxed"
                      />
                    ) : selectedJob.job_description ? (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-slate-800 whitespace-pre-line leading-relaxed max-h-72 overflow-y-auto">
                        {selectedJob.job_description}
                      </div>
                    ) : (
                      <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-6 text-center text-slate-400 text-sm">
                        尚未填入工作內容 JD
                      </div>
                    )}
                  </div>

                  {/* ── 行銷描述（對外網站顯示） ── */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold text-slate-600 uppercase flex items-center gap-1.5">
                        <Sparkles size={13} />
                        行銷描述 Marketing
                      </label>
                      {!editingBasic && !isCreating && (
                        !editingMD ? (
                          <button
                            onClick={() => { setEditingMD(true); setMdDraft(selectedJob.marketing_description || ''); }}
                            className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-800 transition-colors"
                          >
                            <Edit3 size={12} />
                            {selectedJob.marketing_description ? '編輯' : '新增'}
                          </button>
                        ) : (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={handleSaveMD}
                              disabled={savingMD}
                              className="flex items-center gap-1 text-xs bg-emerald-600 text-white px-2 py-1 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                            >
                              <Save size={11} />
                              {savingMD ? '儲存中...' : '儲存'}
                            </button>
                            <button
                              onClick={() => setEditingMD(false)}
                              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
                            >
                              <XIcon size={12} />
                              取消
                            </button>
                          </div>
                        )
                      )}
                    </div>

                    {editingMD ? (
                      <textarea
                        value={mdDraft}
                        onChange={e => setMdDraft(e.target.value)}
                        rows={12}
                        placeholder={`撰寫面向候選人的行銷文案，例如：\n\n【公司亮點】\n- 知名國際企業，年營收超過...\n\n【職位特色】\n- 有機會參與百萬用戶級產品開發\n\n【團隊文化】\n- 扁平化管理，鼓勵創新`}
                        className="w-full border border-slate-200 rounded-xl p-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-y font-mono leading-relaxed"
                      />
                    ) : selectedJob.marketing_description ? (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-slate-800 whitespace-pre-line leading-relaxed max-h-72 overflow-y-auto">
                        {selectedJob.marketing_description}
                      </div>
                    ) : (
                      <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-6 text-center text-slate-400 text-sm">
                        尚未填入行銷描述，點擊「新增」撰寫面向候選人的行銷文案
                      </div>
                    )}
                  </div>

                  {/* 面試流程 */}
                  <EditableField label="面試流程" field="interview_process" type="textarea" rows={3} placeholder="如：電話篩選 → 技術面試 → 主管面談" />

                  {/* 面試階段數 + 各階段說明 */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <EditableField label="面試階段數" field="interview_stages" type="number" placeholder="如：3" className="sm:col-span-1" />
                    <EditableField label="各階段詳細說明" field="interview_stage_detail" type="textarea" rows={3} placeholder="第一關：HR 電話篩選（30min）&#10;第二關：技術面試（1hr）&#10;第三關：主管面談（30min）" className="sm:col-span-3" />
                  </div>

                  {/* 主要挑戰 */}
                  <EditableField label="主要挑戰" field="key_challenges" type="textarea" rows={2} placeholder="如：高併發系統設計" />

                  {/* 吸引亮點 */}
                  <EditableField label="吸引亮點" field="attractive_points" type="textarea" rows={2} placeholder="如：彈性工時、股票選擇權" />

                  {/* 招募難度 */}
                  <div>
                    <label className="text-xs font-semibold text-slate-600 uppercase">招募難度</label>
                    {editingBasic ? (
                      <select
                        value={basicDraft.recruitment_difficulty || ''}
                        onChange={e => setBasicDraft(prev => ({ ...prev, recruitment_difficulty: e.target.value }))}
                        className="w-full text-sm text-slate-900 border border-slate-300 rounded-lg px-2 py-1.5 mt-0.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      >
                        <option value="">--</option>
                        <option value="高">高</option>
                        <option value="中">中</option>
                        <option value="低">低</option>
                      </select>
                    ) : selectedJob.recruitment_difficulty ? (
                      <p className="text-sm text-slate-900 mt-1">{selectedJob.recruitment_difficulty}</p>
                    ) : null}
                  </div>

                  {/* 特殊條件 */}
                  <EditableField label="特殊條件" field="special_conditions" type="textarea" rows={2} placeholder="如：需有資安背景加分" />

                  {/* ── 104/1111 資訊（維持唯讀） ── */}
                  {(selectedJob.work_hours || selectedJob.vacation_policy || selectedJob.remote_work || selectedJob.business_trip) && (
                    <div className="pt-3 border-t border-slate-200">
                      <label className="text-xs font-semibold text-slate-500 uppercase mb-2 block">104/1111 資訊</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {selectedJob.work_hours && (
                          <div>
                            <label className="text-[10px] text-slate-400 uppercase">上班時段</label>
                            <p className="text-sm text-slate-900">{selectedJob.work_hours}</p>
                          </div>
                        )}
                        {selectedJob.vacation_policy && (
                          <div>
                            <label className="text-[10px] text-slate-400 uppercase">休假制度</label>
                            <p className="text-sm text-slate-900">{selectedJob.vacation_policy}</p>
                          </div>
                        )}
                        {selectedJob.remote_work && (
                          <div>
                            <label className="text-[10px] text-slate-400 uppercase">遠端工作</label>
                            <p className="text-sm text-slate-900">{selectedJob.remote_work}</p>
                          </div>
                        )}
                        {selectedJob.business_trip && (
                          <div>
                            <label className="text-[10px] text-slate-400 uppercase">出差外派</label>
                            <p className="text-sm text-slate-900">{selectedJob.business_trip}</p>
                          </div>
                        )}
                      </div>
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
                </div>
              )}

              {/* ======== Tab 3: 配對與送人 ======== */}
              {activeTab === 'matching' && (
                <div className="space-y-4">
                  {/* 客戶送人條件 — amber 色框顯眼 */}
                  <div>
                    <label className="text-xs font-semibold text-amber-700 uppercase flex items-center gap-1.5 mb-1">
                      <ClipboardCheck size={13} className="text-amber-600" />
                      客戶送人條件
                    </label>
                    {editingBasic ? (
                      <textarea
                        value={basicDraft.submission_criteria || ''}
                        onChange={e => setBasicDraft(prev => ({ ...prev, submission_criteria: e.target.value }))}
                        rows={4}
                        placeholder="1. 必須有 K8s 生產環境經驗&#10;2. 英文可作為工作語言&#10;3. 薪資期望不超過 130K"
                        className="w-full text-sm text-slate-900 border-2 border-amber-300 bg-amber-50 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-y"
                      />
                    ) : selectedJob.submission_criteria ? (
                      <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 text-sm text-slate-800 whitespace-pre-line leading-relaxed">
                        {selectedJob.submission_criteria}
                      </div>
                    ) : (
                      <div className="bg-amber-50/50 border-2 border-dashed border-amber-300 rounded-xl p-4 text-center text-amber-500 text-sm">
                        尚未填入客戶送人條件 — 此欄位影響 AI 配對精準度
                      </div>
                    )}
                  </div>

                  {/* 淘汰條件 — red 色框 */}
                  <div>
                    <label className="text-xs font-semibold text-red-700 uppercase flex items-center gap-1.5 mb-1">
                      <ShieldAlert size={13} className="text-red-600" />
                      淘汰條件
                    </label>
                    {editingBasic ? (
                      <textarea
                        value={basicDraft.rejection_criteria || ''}
                        onChange={e => setBasicDraft(prev => ({ ...prev, rejection_criteria: e.target.value }))}
                        rows={3}
                        placeholder="1. 無雲端經驗&#10;2. 跳槽次數 > 5&#10;3. 無法英文溝通"
                        className="w-full text-sm text-slate-900 border-2 border-red-300 bg-red-50 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-400 resize-y"
                      />
                    ) : selectedJob.rejection_criteria ? (
                      <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 text-sm text-slate-800 whitespace-pre-line leading-relaxed">
                        {selectedJob.rejection_criteria}
                      </div>
                    ) : (
                      <div className="bg-red-50/50 border-2 border-dashed border-red-300 rounded-xl p-4 text-center text-red-400 text-sm">
                        尚未填入淘汰條件
                      </div>
                    )}
                  </div>

                  {/* 顧問備註 — 可編輯 textarea + Markdown */}
                  <div>
                    <label className="text-xs font-semibold text-slate-600 uppercase flex items-center gap-1.5 mb-1">
                      <Edit3 size={13} />
                      顧問備註
                    </label>
                    {editingBasic ? (
                      <textarea
                        value={basicDraft.consultant_notes || ''}
                        onChange={e => setBasicDraft(prev => ({ ...prev, consultant_notes: e.target.value }))}
                        rows={4}
                        placeholder="顧問內部備註，支援 Markdown 格式..."
                        className="w-full text-sm text-slate-900 border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-y font-mono"
                      />
                    ) : selectedJob.consultant_notes ? (
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-800 whitespace-pre-line leading-relaxed">
                        {selectedJob.consultant_notes}
                      </div>
                    ) : (
                      <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-4 text-center text-slate-400 text-sm">
                        尚未填入顧問備註
                      </div>
                    )}
                  </div>

                  {/* 企業畫像 */}
                  {(selectedJob.company_profile || editingBasic) && (
                    <div className="pt-2 border-t border-slate-200">
                      <label className="text-xs font-semibold text-slate-600 uppercase flex items-center gap-1.5 mb-2">
                        <Building2 size={13} />
                        企業畫像
                      </label>
                      {!editingSearch && !editingBasic && selectedJob.company_profile ? (
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-slate-800 whitespace-pre-line leading-relaxed">
                          {selectedJob.company_profile}
                        </div>
                      ) : null}
                    </div>
                  )}

                  {/* 人才畫像 */}
                  {(selectedJob.talent_profile || editingBasic) && (
                    <div className="pt-2 border-t border-slate-200">
                      <label className="text-xs font-semibold text-slate-600 uppercase flex items-center gap-1.5 mb-2">
                        <Users size={13} />
                        人才畫像
                      </label>
                      {!editingSearch && !editingBasic && selectedJob.talent_profile ? (
                        <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 text-sm text-slate-800 whitespace-pre-line leading-relaxed">
                          {selectedJob.talent_profile}
                        </div>
                      ) : null}
                    </div>
                  )}

                  {/* ── 爬蟲搜尋設定 ── */}
                  <div className="pt-2 border-t border-slate-200">
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-xs font-semibold text-slate-600 uppercase flex items-center gap-1.5">
                        <Bot size={13} />
                        爬蟲搜尋設定
                      </label>
                      {!editingSearch && !editingBasic ? (
                        <button
                          onClick={() => setEditingSearch(true)}
                          className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 transition-colors"
                        >
                          <Edit3 size={12} />
                          {(selectedJob.search_primary || selectedJob.search_secondary || selectedJob.company_profile || selectedJob.talent_profile) ? '編輯' : '設定'}
                        </button>
                      ) : editingSearch ? (
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
                      ) : null}
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
                            placeholder="例：台灣獨角獸 SaaS 公司，專攻 B2B 電商解決方案..."
                            className="w-full border border-slate-200 rounded-xl p-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-y"
                          />
                        </div>

                        {/* 人才畫像 */}
                        <div>
                          <label className="text-xs text-slate-500 mb-1 block">理想人才畫像</label>
                          <textarea
                            value={talentProfileDraft}
                            onChange={e => setTalentProfileDraft(e.target.value)}
                            rows={3}
                            placeholder="例：有新創或高成長環境背景，主導過大型系統重構..."
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
                                <button onClick={() => setPrimaryTags(primaryTags.filter((_, i) => i !== idx))} className="text-indigo-400 hover:text-indigo-700 leading-none">&times;</button>
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
                                <button onClick={() => setSecondaryTags(secondaryTags.filter((_, i) => i !== idx))} className="text-emerald-400 hover:text-emerald-700 leading-none">&times;</button>
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
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
};
