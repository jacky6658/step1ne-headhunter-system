/**
 * matchSkills.js - Unified skill matching for all scoring systems
 *
 * Replaces:
 * - SKILL_SYNONYMS in talentSourceService.js
 * - SKILL_ALIASES in githubAnalysisService.js
 * - Inline synonym matching in routes-api.js job-ranking
 *
 * All 3 systems now share this single canonical skill taxonomy.
 */

const fs = require('fs');
const path = require('path');

// Load taxonomy once at startup
const TAXONOMY_PATH = path.join(__dirname, 'skill-taxonomy.json');
let _taxonomy = null;
let _reverseLookup = null; // alias → canonical

function loadTaxonomy() {
  if (_taxonomy) return _taxonomy;
  const raw = JSON.parse(fs.readFileSync(TAXONOMY_PATH, 'utf-8'));
  // Remove _meta key
  const { _meta, ...skills } = raw;
  _taxonomy = skills;

  // Build reverse lookup: lowercased alias → canonical name
  _reverseLookup = new Map();
  for (const [canonical, aliases] of Object.entries(_taxonomy)) {
    _reverseLookup.set(canonical.toLowerCase(), canonical);
    for (const alias of aliases) {
      _reverseLookup.set(alias.toLowerCase(), canonical);
    }
  }

  return _taxonomy;
}

/**
 * Normalize a single skill string to its canonical form.
 * @param {string} skill - Raw skill string
 * @returns {string} Canonical skill name, or original trimmed string if no match
 */
function normalizeSkill(skill) {
  if (!skill) return '';
  loadTaxonomy();
  const s = skill.trim().toLowerCase();

  // Direct lookup
  if (_reverseLookup.has(s)) return _reverseLookup.get(s);

  // Substring matching for longer strings (e.g., "3+ years Python experience" → "Python")
  for (const [canonical, aliases] of Object.entries(_taxonomy)) {
    const all = [canonical.toLowerCase(), ...aliases];
    for (const alias of all) {
      if (s.includes(alias) && alias.length >= 2) {
        return canonical;
      }
    }
  }

  return skill.trim(); // Return original if no match
}

/**
 * Normalize an array of skills, or parse from string.
 * Handles: Array, JSON string, comma/semicolon/頓號 separated string.
 * @param {string|string[]} skills - Raw skills input
 * @returns {string[]} Deduplicated array of canonical skill names
 */
function normalizeSkillsArray(skills) {
  if (!skills) return [];

  let arr;
  if (Array.isArray(skills)) {
    arr = skills;
  } else if (typeof skills === 'string') {
    try {
      const parsed = JSON.parse(skills);
      if (Array.isArray(parsed)) {
        arr = parsed;
      } else {
        arr = [skills];
      }
    } catch {
      arr = skills.split(/[,、;；\n]/).map(s => s.trim()).filter(s => s.length > 0);
    }
  } else {
    return [];
  }

  const canonicalSet = new Set();
  for (const s of arr) {
    const trimmed = s.trim();
    if (trimmed.length === 0) continue;
    const canonical = normalizeSkill(trimmed);
    if (canonical.length > 0) canonicalSet.add(canonical);
  }

  return [...canonicalSet];
}

/**
 * Match candidate skills against job required skills.
 * Uses canonical normalization before comparison.
 *
 * @param {string|string[]} candidateSkills - Candidate's skills
 * @param {string|string[]} jobSkills - Job's required skills
 * @returns {{ matchedSkills: string[], missingSkills: string[], extraSkills: string[], matchRatio: number }}
 */
function matchSkills(candidateSkills, jobSkills) {
  const candNorm = normalizeSkillsArray(candidateSkills);
  const jobNorm = normalizeSkillsArray(jobSkills);

  if (jobNorm.length === 0) {
    return {
      matchedSkills: [],
      missingSkills: [],
      extraSkills: candNorm,
      matchRatio: 0,
    };
  }

  const candSet = new Set(candNorm.map(s => s.toLowerCase()));

  const matchedSkills = [];
  const missingSkills = [];

  for (const skill of jobNorm) {
    if (candSet.has(skill.toLowerCase())) {
      matchedSkills.push(skill);
    } else {
      missingSkills.push(skill);
    }
  }

  const jobSet = new Set(jobNorm.map(s => s.toLowerCase()));
  const extraSkills = candNorm.filter(s => !jobSet.has(s.toLowerCase()));

  const matchRatio = jobNorm.length > 0 ? matchedSkills.length / jobNorm.length : 0;

  return {
    matchedSkills,
    missingSkills,
    extraSkills,
    matchRatio,
  };
}

/**
 * Get all canonical skill names from the taxonomy.
 * @returns {string[]} Sorted array of canonical skill names
 */
function getAllCanonicalSkills() {
  loadTaxonomy();
  return Object.keys(_taxonomy).sort();
}

/**
 * Parse salary text into numeric min/max.
 * Handles: "90K", "90K+", "90K-120K", "90,000", "9萬", "年薪120萬", "$5,000 USD" etc.
 * @param {string} salaryText - Raw salary string
 * @returns {{ min: number|null, max: number|null, currency: string, period: string }}
 */
function parseSalaryText(salaryText) {
  if (!salaryText || typeof salaryText !== 'string') {
    return { min: null, max: null, currency: 'TWD', period: 'monthly' };
  }

  const text = salaryText.trim().toLowerCase();

  // Detect currency
  let currency = 'TWD';
  if (/usd|\$us|美金|美元/.test(text)) currency = 'USD';
  else if (/sgd|新幣|新加坡/.test(text)) currency = 'SGD';
  else if (/hkd|港幣/.test(text)) currency = 'HKD';
  else if (/jpy|日幣|日圓/.test(text)) currency = 'JPY';
  else if (/cny|rmb|人民幣/.test(text)) currency = 'CNY';

  // Detect period
  let period = 'monthly';
  if (/年薪|annual|yearly|per year|\/yr/.test(text)) period = 'annual';

  // Parse numbers
  let min = null;
  let max = null;

  // "9萬" or "90K"
  const wanMatch = text.match(/(\d+(?:\.\d+)?)\s*萬/);
  const kMatch = text.match(/(\d+(?:\.\d+)?)\s*k/i);

  // Range: "90K-120K", "9萬-12萬", "90,000 - 120,000"
  const rangeMatch = text.match(/(\d+(?:[.,]\d+)?)\s*([k萬])?\s*[-~至到]\s*(\d+(?:[.,]\d+)?)\s*([k萬])?/i);

  if (rangeMatch) {
    let v1 = parseFloat(rangeMatch[1].replace(/,/g, ''));
    let v2 = parseFloat(rangeMatch[3].replace(/,/g, ''));
    const unit1 = (rangeMatch[2] || '').toLowerCase();
    const unit2 = (rangeMatch[4] || rangeMatch[2] || '').toLowerCase();

    if (unit1 === 'k' || unit1 === 'k') v1 *= 1000;
    else if (unit1 === '萬') v1 *= 10000;
    if (unit2 === 'k') v2 *= 1000;
    else if (unit2 === '萬') v2 *= 10000;

    min = Math.round(v1);
    max = Math.round(v2);
  } else if (wanMatch) {
    const val = parseFloat(wanMatch[1]) * 10000;
    min = Math.round(val);
    max = text.includes('+') || text.includes('以上') ? null : Math.round(val);
  } else if (kMatch) {
    const val = parseFloat(kMatch[1]) * 1000;
    min = Math.round(val);
    max = text.includes('+') || text.includes('以上') ? null : Math.round(val);
  } else {
    // Plain numbers: "90000", "90,000"
    const numMatch = text.match(/(\d{2,}(?:,\d{3})*)/);
    if (numMatch) {
      const val = parseInt(numMatch[1].replace(/,/g, ''));
      if (val > 0) {
        min = val;
        max = text.includes('+') || text.includes('以上') ? null : val;
      }
    }
  }

  return { min, max, currency, period };
}

/**
 * Map notice period text to enum value.
 * @param {string} text - Raw notice period text
 * @returns {string|null} Enum value: immediate/2weeks/1month/2months/3months/negotiable
 */
function parseNoticePeriod(text) {
  if (!text) return null;
  const t = text.trim().toLowerCase();

  if (/即刻|即時|immediate|立即|馬上|asap|隨時/.test(t)) return 'immediate';
  if (/2\s*週|兩週|two\s*week|14天/.test(t)) return '2weeks';
  if (/1\s*個?月|一個?月|one\s*month|30天/.test(t)) return '1month';
  if (/2\s*個?月|兩個?月|two\s*month|60天/.test(t)) return '2months';
  if (/3\s*個?月|三個?月|three\s*month|90天/.test(t)) return '3months';
  if (/可議|negotiable|flexible|彈性/.test(t)) return 'negotiable';

  return null;
}

/**
 * Map job search status text to enum value.
 * @param {string} text - Raw job search status
 * @returns {string|null} Enum value: active/passive/not_open
 */
function parseJobSearchStatus(text) {
  if (!text) return null;
  const t = text.trim().toLowerCase();

  if (/主動|active|積極|找工作/.test(t)) return 'active';
  if (/被動|passive|觀望|看看/.test(t)) return 'passive';
  if (/暫不|not.?open|不考慮|不想|穩定/.test(t)) return 'not_open';

  return null;
}

/**
 * Compute auto-derived stability metrics from work history.
 * @param {Array} workHistory - Array of { company, title, start, end, duration_months }
 * @returns {{ jobChanges: number, avgTenureMonths: number, lastGapMonths: number, stabilityScore: number }}
 */
function computeAutoDerived(workHistory) {
  if (!Array.isArray(workHistory) || workHistory.length === 0) {
    return { jobChanges: 0, avgTenureMonths: 0, lastGapMonths: 0, stabilityScore: 50 };
  }

  const jobChanges = workHistory.length;

  // Calculate durations
  const durations = workHistory.map(w => {
    if (w.duration_months) return w.duration_months;
    if (w.start && w.end) {
      const s = new Date(w.start);
      const e = new Date(w.end);
      return Math.max(1, Math.round((e - s) / (1000 * 60 * 60 * 24 * 30)));
    }
    return 24; // default 2 years
  });

  const avgTenureMonths = durations.length > 0
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : 0;

  // Last gap (between most recent 2 jobs)
  let lastGapMonths = 0;
  if (workHistory.length >= 2) {
    const sorted = [...workHistory].sort((a, b) => new Date(b.start || 0) - new Date(a.start || 0));
    const prev = sorted[1];
    const curr = sorted[0];
    if (prev.end && curr.start) {
      const gap = (new Date(curr.start) - new Date(prev.end)) / (1000 * 60 * 60 * 24 * 30);
      lastGapMonths = Math.max(0, Math.round(gap));
    }
  }

  // Stability score (0-100)
  let stabilityScore = 50;
  if (avgTenureMonths >= 36) stabilityScore = 90;
  else if (avgTenureMonths >= 24) stabilityScore = 75;
  else if (avgTenureMonths >= 18) stabilityScore = 60;
  else if (avgTenureMonths >= 12) stabilityScore = 40;
  else stabilityScore = 20;

  // Penalty for many job changes
  if (jobChanges > 6) stabilityScore = Math.max(10, stabilityScore - 20);
  else if (jobChanges > 4) stabilityScore = Math.max(10, stabilityScore - 10);

  // Penalty for long gaps
  if (lastGapMonths > 6) stabilityScore = Math.max(10, stabilityScore - 15);
  else if (lastGapMonths > 3) stabilityScore = Math.max(10, stabilityScore - 5);

  return { jobChanges, avgTenureMonths, lastGapMonths, stabilityScore };
}

/**
 * Compute data quality score for a candidate.
 * @param {Object} candidate - Candidate record
 * @returns {{ completenessScore: number, missingCoreFields: string[], normalizationWarnings: string[] }}
 */
function computeDataQuality(candidate) {
  // Match Core 10 欄位 — 對齊 Precision Evaluation Gate 規格表
  const coreFields = [
    { key: 'canonical_role', fallback: 'role_family', label: 'canonicalRole' },
    { key: 'normalized_skills', label: 'normalizedSkills' },
    { key: 'total_years', fallback: 'years_experience', label: 'totalYears' },
    { key: 'location', label: 'location' },
    { key: 'current_company', label: 'currentCompany' },
    { key: 'industry_tag', fallback: 'industry', label: 'industryTag' },
    { key: 'expected_salary_min', label: 'expectedSalaryMin' },
    { key: 'expected_salary_max', label: 'expectedSalaryMax' },
    { key: 'notice_period_enum', fallback: 'notice_period', label: 'noticePeriodEnum' },
    { key: 'job_search_status_enum', fallback: 'job_search_status', label: 'jobSearchStatusEnum' },
  ];

  const missingCoreFields = [];
  const normalizationWarnings = [];
  let filledCount = 0;

  for (const field of coreFields) {
    const value = candidate[field.key] || (field.fallback ? candidate[field.fallback] : null);
    if (!value || (Array.isArray(value) && value.length === 0) || value === '[]') {
      missingCoreFields.push(field.label);
    } else {
      filledCount++;
    }
  }

  // Check normalization issues
  if (candidate.skills && typeof candidate.skills === 'string' && !candidate.normalized_skills) {
    normalizationWarnings.push('技能尚未標準化');
  }
  if (candidate.current_salary && !candidate.current_salary_min) {
    normalizationWarnings.push('薪資尚未結構化');
  }
  if (candidate.current_position && !candidate.role_family) {
    normalizationWarnings.push('職位尚未分類');
  }

  const completenessScore = Math.round((filledCount / coreFields.length) * 100);

  return { completenessScore, missingCoreFields, normalizationWarnings };
}

/**
 * Compute precision pool eligibility for a candidate.
 * Based on candidate_precision_evaluation_spec.md
 * @param {Object} candidate - Candidate record (DB column names: snake_case)
 * @returns {{ precisionEligible: boolean, dataQualityScore: number, missingCoreFields: string[] }}
 */
function computePrecisionEligible(candidate) {
  const { completenessScore, missingCoreFields, normalizationWarnings } = computeDataQuality(candidate);

  // Parse normalized_skills (could be JSONB array or JSON string)
  let skills = candidate.normalized_skills;
  if (typeof skills === 'string') {
    try { skills = JSON.parse(skills); } catch { skills = []; }
  }
  if (!Array.isArray(skills)) skills = [];

  // Precision Pool 進入條件
  const precisionEligible = (
    completenessScore >= 80 &&
    skills.length >= 3 &&
    candidate.expected_salary_min != null && candidate.expected_salary_min !== '' &&
    candidate.notice_period_enum != null && candidate.notice_period_enum !== '' &&
    candidate.job_search_status_enum != null && candidate.job_search_status_enum !== ''
  );

  return {
    precisionEligible,
    dataQualityScore: completenessScore,
    missingCoreFields,
  };
}

module.exports = {
  normalizeSkill,
  normalizeSkillsArray,
  matchSkills,
  getAllCanonicalSkills,
  parseSalaryText,
  parseNoticePeriod,
  parseJobSearchStatus,
  computeAutoDerived,
  computeDataQuality,
  computePrecisionEligible,
  loadTaxonomy,
};
