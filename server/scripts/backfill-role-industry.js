/**
 * backfill-role-industry.js
 * 自動回填 canonical_role / role_family / seniority_level / industry_tag
 * 使用現有 role-taxonomy.json + industry-taxonomy.json 純規則比對
 *
 * Usage:
 *   node scripts/backfill-role-industry.js --dry-run   # 預覽（不寫 DB）
 *   node scripts/backfill-role-industry.js              # 正式執行
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const { computePrecisionEligible } = require('../taxonomy/matchSkills');

const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URI;
if (!DATABASE_URL) { console.error('❌ DATABASE_URL 未設定'); process.exit(1); }
const pool = new Pool({ connectionString: DATABASE_URL });
const DRY_RUN = process.argv.includes('--dry-run');

// ========== 1. Load Taxonomies ==========

const roleTaxonomy = JSON.parse(fs.readFileSync(path.join(__dirname, '../taxonomy/role-taxonomy.json'), 'utf-8'));
const industryTaxonomy = JSON.parse(fs.readFileSync(path.join(__dirname, '../taxonomy/industry-taxonomy.json'), 'utf-8'));

// ========== 2. Build Role Reverse Lookup ==========

// canonicalRole (lowercased) → { roleFamily, canonicalRole }
const roleReverseLookup = new Map();
// keyword → roleFamily (fallback fuzzy match)
const roleFuzzyKeywords = [];

for (const [family, config] of Object.entries(roleTaxonomy)) {
  if (family === '_meta') continue;
  for (const role of (config.canonicalRoles || [])) {
    roleReverseLookup.set(role.toLowerCase(), { roleFamily: family, canonicalRole: role });
  }
}

// Fuzzy keyword rules (order matters - more specific first)
const ROLE_KEYWORD_RULES = [
  // Specific compound terms first
  { keywords: ['product manager', 'product owner', 'technical pm', 'program manager'], family: 'PM' },
  { keywords: ['project manager'], family: 'PM' },
  { keywords: ['ui/ux', 'uiux', 'ui designer', 'ux designer', 'product designer', 'interaction designer'], family: 'UIUX' },
  { keywords: ['react native', 'flutter engineer'], family: 'Mobile' },
  { keywords: ['tech lead', 'team lead', 'engineering manager'], family: null }, // seniority only
  { keywords: ['machine learning', 'ml engineer', 'deep learning'], family: 'Data' },
  { keywords: ['data engineer', 'data analyst', 'data scientist', 'bi analyst', 'analytics'], family: 'Data' },
  { keywords: ['devops', 'sre', 'site reliability', 'infrastructure', 'cloud engineer', 'platform engineer'], family: 'DevOps' },
  { keywords: ['backend', '後端', 'server engineer', 'api engineer'], family: 'Backend' },
  { keywords: ['frontend', '前端', 'web developer', 'ui engineer'], family: 'Frontend' },
  { keywords: ['fullstack', 'full stack', 'full-stack', '全端'], family: 'Fullstack' },
  { keywords: ['ios', 'android', 'mobile', '行動'], family: 'Mobile' },
  { keywords: ['qa engineer', 'quality assurance', 'sdet', 'test engineer', 'automation test', '品質保證', '測試工程'], family: 'QA' },
  { keywords: ['security', '資安', 'infosec', 'penetration', 'ciso'], family: 'Security' },
  { keywords: ['bim', 'mep', '建築', 'structural'], family: 'BIM' },
  { keywords: ['finance', 'financial analyst', '財務', '會計', 'accountant', 'auditor', 'cfo', 'treasury'], family: 'Finance' },
  { keywords: ['sales', '業務', 'account executive', 'business development', 'pre-sales', 'bd manager'], family: 'Sales' },
  { keywords: ['recruiter', 'talent acquisition', 'hr manager', 'hrbp', '人資', '人力資源', 'c&b'], family: 'HR' },
  { keywords: ['產品', 'pm'], family: 'PM' },
  { keywords: ['設計', 'design', 'visual'], family: 'UIUX' },
  { keywords: ['data', '數據', 'ai engineer', '人工智慧'], family: 'Data' },
  // Very generic - only if nothing else matched
  { keywords: ['software engineer', 'software developer', '軟體工程師'], family: 'Fullstack' },
];

// ========== 3. Build Industry Lookup ==========

const industryAliasMap = new Map(); // alias (lowercased) → tag
for (const ind of (industryTaxonomy.industries || [])) {
  if (ind.tag === 'Other') continue;
  industryAliasMap.set(ind.tag.toLowerCase(), ind.tag);
  for (const alias of (ind.aliases || [])) {
    if (alias.length >= 2) {
      industryAliasMap.set(alias.toLowerCase(), ind.tag);
    }
  }
}

// Known company → industry mapping (~80 companies)
const COMPANY_INDUSTRY_MAP = {
  // Semiconductor
  'tsmc': 'Semiconductor', '台積電': 'Semiconductor', 'mediatek': 'Semiconductor', '聯發科': 'Semiconductor',
  'realtek': 'Semiconductor', '瑞昱': 'Semiconductor', 'novatek': 'Semiconductor', '聯詠': 'Semiconductor',
  'asm': 'Semiconductor', 'asml': 'Semiconductor', 'micron': 'Semiconductor', '美光': 'Semiconductor',
  'intel': 'Semiconductor', 'amd': 'Semiconductor', 'nvidia': 'Semiconductor', 'qualcomm': 'Semiconductor',
  'broadcom': 'Semiconductor', 'marvell': 'Semiconductor', 'arm': 'Semiconductor',
  'synopsys': 'Semiconductor', 'cadence': 'Semiconductor',

  // Internet / Platform
  'google': 'Internet', 'meta': 'Internet', 'facebook': 'Internet', 'amazon': 'Internet',
  'microsoft': 'Internet', 'apple': 'Internet', 'netflix': 'Internet', 'twitter': 'Internet',
  'linkedin': 'Internet', 'uber': 'Internet', 'grab': 'Internet', 'line': 'Internet',
  'yahoo': 'Internet', 'bytedance': 'Internet', 'tiktok': 'Internet', 'spotify': 'Internet',

  // Banking / Finance
  '國泰': 'Banking', '中信': 'Banking', '玉山': 'Banking', '富邦': 'Banking', '台新': 'Banking',
  '元大': 'Banking', '永豐': 'Banking', '第一銀': 'Banking', '合庫': 'Banking', '彰銀': 'Banking',
  '華南': 'Banking', '兆豐': 'Banking', '土銀': 'Banking',
  'cathay': 'Banking', 'ctbc': 'Banking', 'fubon': 'Banking', 'e.sun': 'Banking',
  'jpmorgan': 'Banking', 'goldman': 'Banking', 'morgan stanley': 'Banking', 'citi': 'Banking',
  'hsbc': 'Banking', 'ubs': 'Banking', 'deutsche bank': 'Banking', 'barclays': 'Banking',
  'evercore': 'Banking',

  // E-commerce
  'shopee': 'E-commerce', 'momo': 'E-commerce', 'pchome': 'E-commerce', 'shopline': 'E-commerce',
  '蝦皮': 'E-commerce', 'amazon': 'E-commerce', '91app': 'E-commerce',
  'foodpanda': 'E-commerce', 'uber eats': 'E-commerce', 'deliveroo': 'E-commerce',

  // SaaS / AI
  'appier': 'AI', 'gogolook': 'SaaS', 'whoscall': 'SaaS', 'dcard': 'Internet',
  'ubiik': 'AI', '優必克': 'AI', 'cacafly': 'SaaS', 'ikala': 'AI',
  'awoo': 'SaaS', 'rosetta.ai': 'AI', 'kronos': 'SaaS',
  'salesforce': 'SaaS', 'hubspot': 'SaaS', 'slack': 'SaaS', 'atlassian': 'SaaS',
  'datadog': 'SaaS', 'cloudflare': 'SaaS', 'twilio': 'SaaS', 'stripe': 'Fintech',

  // Fintech
  'maicoin': 'Fintech', '街口': 'Fintech', 'jkopay': 'Fintech',
  'binance': 'Fintech', 'coinbase': 'Fintech',

  // Gaming
  'garena': 'Gaming', 'igs': 'Gaming', 'x-legend': 'Gaming', '傳奇': 'Gaming',
  'riot': 'Gaming', 'blizzard': 'Gaming', 'ea': 'Gaming', 'ubisoft': 'Gaming',
  'gamania': 'Gaming', '遊戲橘子': 'Gaming',

  // SI / IT Services
  'accenture': 'Consulting', 'deloitte': 'Consulting', 'ey': 'Consulting', 'kpmg': 'Consulting', 'pwc': 'Consulting',
  'tcs': 'SI', 'infosys': 'SI', 'wipro': 'SI', 'capgemini': 'SI',
  '精誠': 'SI', '資拓宏宇': 'SI', '中華電信': 'Telecom', '遠傳': 'Telecom', '台灣大哥大': 'Telecom',

  // Hardware / Electronics
  'asus': 'Hardware', '華碩': 'Hardware', 'acer': 'Hardware', '宏碁': 'Hardware',
  'foxconn': 'Manufacturing', '鴻海': 'Manufacturing', 'pegatron': 'Manufacturing', '和碩': 'Manufacturing',
  'quanta': 'Hardware', '廣達': 'Hardware', 'compal': 'Hardware', '仁寶': 'Hardware',
  'delta': 'Hardware', '台達': 'Hardware', 'htc': 'Hardware',
  'logitech': 'Hardware',

  // Healthcare
  '長庚': 'Healthcare', '台大醫院': 'Healthcare', '榮總': 'Healthcare',

  // Automotive
  'tesla': 'Automotive', 'toyota': 'Automotive', 'gogoro': 'Automotive',

  // Construction
  '元宏': 'Construction', '大陸工程': 'Construction', '中鼎': 'Construction',

  // Education
  'hahow': 'Education', 'voicetube': 'Education', 'tutorABC': 'Education',

  // Government
  'undp': 'Government', '中研院': 'Government', '工研院': 'Government', 'itri': 'Government',
};

// ========== 4. Matching Functions ==========

/**
 * Derive role_family + canonical_role from position title
 */
function deriveRole(title) {
  if (!title || typeof title !== 'string') return null;
  const t = title.trim().toLowerCase();
  if (t.length < 2) return null;

  // Phase 1: Direct match against canonical roles
  for (const [canonical, info] of roleReverseLookup) {
    if (t.includes(canonical) || canonical.includes(t)) {
      return info;
    }
  }

  // Phase 2: Keyword fuzzy match
  for (const rule of ROLE_KEYWORD_RULES) {
    if (rule.family === null) continue; // seniority-only rules
    for (const kw of rule.keywords) {
      if (t.includes(kw)) {
        // Try to pick the best canonical role based on keyword
        const familyConfig = roleTaxonomy[rule.family];
        const roles = familyConfig?.canonicalRoles || [];
        // Find the canonical role whose name best matches the keyword
        let canonicalRole = roles.find(r => r.toLowerCase().includes(kw)) || roles[0] || rule.family + ' Engineer';
        // Special cases: pick more specific role
        if (rule.family === 'Mobile') {
          if (t.includes('android')) canonicalRole = 'Android Engineer';
          else if (t.includes('ios')) canonicalRole = 'iOS Engineer';
          else if (t.includes('flutter')) canonicalRole = 'Flutter Engineer';
          else if (t.includes('react native')) canonicalRole = 'React Native Engineer';
          else canonicalRole = 'Mobile Engineer';
        }
        return { roleFamily: rule.family, canonicalRole };
      }
    }
  }

  return null;
}

/**
 * Derive seniority_level from position title
 */
function deriveSeniority(title) {
  if (!title || typeof title !== 'string') return null;
  const t = title.trim().toLowerCase();

  // Order matters: more specific first
  if (/\b(cto|ceo|cfo|ciso|coo)\b/.test(t)) return 'CXO';
  if (/\b(vp|vice president|副總)\b/.test(t)) return 'VP';
  if (/\b(director|總監)\b/.test(t)) return 'Director';
  if (/\b(engineering manager|manager|經理)\b/.test(t) && !/project manager|product manager/.test(t)) return 'Manager';
  if (/\b(principal|首席|distinguished)\b/.test(t)) return 'Principal';
  if (/\b(staff)\b/.test(t)) return 'Staff';
  if (/\b(tech lead|team lead|lead)\b/.test(t)) return 'Lead';
  if (/\b(senior|sr\.?|資深)\b/.test(t)) return 'Senior';
  if (/\b(junior|jr\.?|初級)\b/.test(t)) return 'Junior';
  if (/\b(intern|實習)\b/.test(t)) return 'Intern';

  return 'IC'; // default: Individual Contributor
}

/**
 * Derive industry_tag from company name(s) and industry field
 */
function deriveIndustry(currentCompany, workHistory, industryField) {
  // Phase 1: Check existing industry field against taxonomy
  if (industryField && typeof industryField === 'string' && industryField.trim()) {
    const ind = industryField.trim().toLowerCase();
    for (const [alias, tag] of industryAliasMap) {
      if (ind.includes(alias) || alias.includes(ind)) {
        return tag;
      }
    }
  }

  // Collect all company names
  const companies = [];
  if (currentCompany && typeof currentCompany === 'string') companies.push(currentCompany.trim());
  if (Array.isArray(workHistory)) {
    for (const wh of workHistory) {
      if (wh.company && typeof wh.company === 'string') companies.push(wh.company.trim());
    }
  }

  if (companies.length === 0) return null;

  // Phase 2: Known company mapping
  for (const company of companies) {
    const cl = company.toLowerCase();
    for (const [key, tag] of Object.entries(COMPANY_INDUSTRY_MAP)) {
      if (cl.includes(key.toLowerCase()) || key.toLowerCase().includes(cl)) {
        return tag;
      }
    }
  }

  // Phase 3: Industry taxonomy alias matching against company names
  for (const company of companies) {
    const cl = company.toLowerCase();
    for (const [alias, tag] of industryAliasMap) {
      if (cl.includes(alias) && alias.length >= 3) {
        return tag;
      }
    }
  }

  return null;
}

// ========== 5. Main Migration ==========

async function backfill() {
  console.log(`\n========== Backfill Role + Industry ==========`);
  console.log(`Mode: ${DRY_RUN ? '🔍 DRY RUN (no writes)' : '🚀 LIVE EXECUTION'}\n`);

  const { rows } = await pool.query(`
    SELECT id, name, current_position, current_title, current_company,
           role_family, canonical_role, seniority_level, industry_tag, industry,
           work_history, normalized_skills, total_years, years_experience,
           location, expected_salary_min, expected_salary_max,
           notice_period_enum, notice_period, job_search_status_enum, job_search_status,
           skills
    FROM candidates_pipeline
    ORDER BY id
  `);

  console.log(`Found ${rows.length} candidates.\n`);

  let roleFilledCount = 0;
  let industryFilledCount = 0;
  let seniorityFilledCount = 0;
  let precisionChangedCount = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const updates = {};

      // ── Role derivation ──
      const hasRole = row.canonical_role && row.canonical_role.trim();
      if (!hasRole) {
        const title = row.current_title || row.current_position || '';
        // Also try work_history[0].title
        let whTitle = '';
        if (Array.isArray(row.work_history) && row.work_history.length > 0) {
          whTitle = row.work_history[0].title || '';
        }
        const roleResult = deriveRole(title) || deriveRole(whTitle);
        if (roleResult) {
          updates.role_family = roleResult.roleFamily;
          updates.canonical_role = roleResult.canonicalRole;
          roleFilledCount++;
        }
      }

      // ── Seniority derivation ──
      const hasSeniority = row.seniority_level && row.seniority_level.trim();
      if (!hasSeniority) {
        const title = row.current_title || row.current_position || '';
        const seniority = deriveSeniority(title);
        if (seniority) {
          updates.seniority_level = seniority;
          seniorityFilledCount++;
        }
      }

      // ── Industry derivation ──
      const hasIndustry = row.industry_tag && row.industry_tag.trim();
      if (!hasIndustry) {
        const industry = deriveIndustry(row.current_company, row.work_history, row.industry);
        if (industry) {
          updates.industry_tag = industry;
          industryFilledCount++;
        }
      }

      // Skip if no updates
      if (Object.keys(updates).length === 0) {
        skipped++;
        continue;
      }

      // ── Recalculate data_quality + precision_eligible ──
      const merged = { ...row, ...updates };
      const precision = computePrecisionEligible(merged);
      updates.data_quality = JSON.stringify({
        completenessScore: precision.dataQualityScore,
        missingCoreFields: precision.missingCoreFields,
        normalizationWarnings: [],
      });
      updates.precision_eligible = precision.precisionEligible;

      if (precision.precisionEligible && !row.precision_eligible) {
        precisionChangedCount++;
      }

      if (DRY_RUN) {
        const parts = [];
        if (updates.canonical_role) parts.push(`role: "${row.current_position || row.current_title || '?'}" → ${updates.role_family}/${updates.canonical_role}`);
        if (updates.seniority_level) parts.push(`seniority: ${updates.seniority_level}`);
        if (updates.industry_tag) parts.push(`industry: "${row.current_company || '?'}" → ${updates.industry_tag}`);
        if (precision.precisionEligible) parts.push(`🎯 PRECISION ELIGIBLE! (${precision.dataQualityScore}%)`);
        console.log(`[DRY] #${row.id} ${row.name || '(unnamed)'}: ${parts.join(' | ')}`);
      } else {
        // Build SQL UPDATE
        const setClauses = [];
        const values = [];
        let idx = 1;
        for (const [key, value] of Object.entries(updates)) {
          setClauses.push(`${key} = $${idx}`);
          values.push(value);
          idx++;
        }
        values.push(row.id);
        await pool.query(
          `UPDATE candidates_pipeline SET ${setClauses.join(', ')} WHERE id = $${idx}`,
          values
        );
      }

      if ((i + 1) % 100 === 0) {
        console.log(`  ...processed ${i + 1}/${rows.length}`);
      }
    } catch (err) {
      errors++;
      console.error(`  ❌ #${row.id} ${row.name}: ${err.message}`);
    }
  }

  console.log(`\n========== Backfill Summary ==========`);
  console.log(`Total candidates: ${rows.length}`);
  console.log(`Role filled:      ${roleFilledCount}`);
  console.log(`Seniority filled: ${seniorityFilledCount}`);
  console.log(`Industry filled:  ${industryFilledCount}`);
  console.log(`Skipped (no match or already filled): ${skipped}`);
  console.log(`New Precision Pool entries: ${precisionChangedCount}`);
  console.log(`Errors: ${errors}`);

  if (DRY_RUN) {
    console.log(`\n🔍 This was a DRY RUN. No changes were made.`);
  } else {
    console.log(`\n✅ Backfill complete.`);
  }

  await pool.end();
}

backfill().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
