/**
 * 爬蟲整合儀表板 — TypeScript 型別定義
 */

export interface CrawlerHealth {
  status: string;
  connected: boolean;
}

export interface CrawlerStats {
  total_candidates: number;
  today_new: number;
  running_tasks: number;
  scheduled_tasks: number;
  clients: Record<string, number>;
  sources: { linkedin: number; github: number; 'li+ocr': number };
  grades: { A: number; B: number; C: number; D: number; '': number };
  recent_runs: CrawlerRecentRun[];
}

export interface CrawlerRecentRun {
  task_id: string;
  client_name: string;
  job_title: string;
  status: string;
  last_run: string;
  last_result_count: number;
  progress: number;
}

export interface CrawlerCandidate {
  id: string;
  name: string;
  source: string;
  score: number;
  grade: string;
  skills: string[];
  location: string;
  title: string;
  company: string;
  bio: string;
  linkedin_url: string;
  github_url: string;
  score_detail: string;
  client_name: string;
  job_title: string;
  status: string;
  created_at: string;
  search_date: string;
}

export interface CrawlerTask {
  id: string;
  client_name: string;
  job_title: string;
  primary_skills: string[];
  secondary_skills: string[];
  location: string;
  pages: number;
  schedule_type: string;
  schedule_time: string;
  schedule_interval_hours: number;
  status: string;
  progress: number;
  progress_detail: string;
  last_run: string;
  last_result_count: number;
  linkedin_count: number;
  github_count: number;
  created_at: string;
  updated_at: string;
}

export interface MetricsSnapshot {
  snapshot_date: string;
  total_candidates_crawled: number;
  today_new: number;
  linkedin_count: number;
  github_count: number;
  grade_a: number;
  grade_b: number;
  grade_c: number;
  grade_d: number;
  pipeline_total: number;
  pipeline_contacted: number;
  pipeline_interviewed: number;
  pipeline_offered: number;
  pipeline_onboarded: number;
  pipeline_rejected: number;
  contact_rate: number;
  interview_rate: number;
  offer_rate: number;
  placement_rate: number;
  consultant_metrics: Record<string, ConsultantMetric>;
  source_metrics: Record<string, SourceMetric>;
}

export interface ConsultantMetric {
  total: number;
  contacted: number;
  interviewed: number;
  onboarded: number;
}

export interface SourceMetric {
  total: number;
  contacted: number;
  onboarded: number;
}

export interface ScoreBreakdown {
  total_score: number;
  grade: string;
  breakdown: {
    must_have: ScoreCategory;
    core: ScoreCategory;
    nice_to_have: ScoreCategory;
    context: ScoreCategory;
    github_bonus: number;
  };
  skill_match_rate: number;
  matched_skills: string[];
  missing_critical: string[];
  constraints_pass: boolean;
  constraint_flags: string[];
}

export interface ScoreCategory {
  score: number;
  max: number;
  matched: string[];
  missing: string[];
}

export interface EfficiencyData {
  pipeline: {
    total: number;
    contacted: number;
    interviewed: number;
    offered: number;
    onboarded: number;
    rejected: number;
    ai_recommended: number;
    not_started: number;
  };
  rates: {
    contact: number;
    interview: number;
    offer: number;
    placement: number;
  };
  consultants: ConsultantPerformance[];
  sources: SourcePerformance[];
  previous: {
    date: string;
    contactRate: number;
    placementRate: number;
    pipelineTotal: number;
  } | null;
}

export interface ConsultantPerformance {
  name: string;
  total: number;
  contacted: number;
  interviewed: number;
  offered: number;
  onboarded: number;
  rejected: number;
  contactRate: number;
  placementRate: number;
}

export interface SourcePerformance {
  name: string;
  total: number;
  contacted: number;
  interviewed: number;
  onboarded: number;
  contactRate: number;
  placementRate: number;
}

// ── 匯入相關型別 ──

export interface ImportResult {
  success: boolean;
  message: string;
  created_count: number;
  updated_count: number;
  failed_count: number;
  data: {
    created: ImportedCandidate[];
    updated: ImportedCandidate[];
  };
  failed: ImportFailure[];
}

export interface ImportedCandidate {
  id: number;
  name: string;
  contact_link: string;
  current_position: string;
  status: string;
}

export interface ImportFailure {
  name: string;
  error: string;
}

export interface ImportStatusResult {
  success: boolean;
  existing: {
    name: string;
    id: number;
    status: string;
  }[];
}
