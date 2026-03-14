/**
 * GitHub 分析服務 v2
 * 用於評估候選人的 GitHub 技術能力、活躍度、影響力
 *
 * v2 新增：4 維度評分（技能匹配 40%、專案品質 30%、活躍度 20%、影響力 10%）
 * 支援與職缺技能連動的智慧分析
 */

const https = require('https');

// ============================================================
// Unified skill taxonomy (from shared taxonomy/skill-taxonomy.json)
// Replaces the old inline SKILL_ALIASES dictionary.
// ============================================================
const _unifiedTaxonomy = (() => {
  try {
    const raw = require('./taxonomy/skill-taxonomy.json');
    const { _meta, ...skills } = raw;
    // Convert to lowercase alias format compatible with existing code
    const aliases = {};
    for (const [canonical, aliasList] of Object.entries(skills)) {
      aliases[canonical.toLowerCase()] = aliasList.map(a => a.toLowerCase());
    }
    return aliases;
  } catch {
    // Fallback to inline if taxonomy file not found
    return null;
  }
})();

const SKILL_ALIASES = _unifiedTaxonomy || {
  // Legacy fallback — kept only in case taxonomy file is missing
  'javascript': ['js', 'javascript', 'ecmascript', 'es6', 'es2015'],
  'typescript': ['ts', 'typescript'],
  'react': ['react', 'reactjs', 'react.js', 'react-native'],
  'vue': ['vue', 'vuejs', 'vue.js', 'vue3', 'nuxt'],
  'angular': ['angular', 'angularjs', 'angular.js'],
  'nextjs': ['next', 'nextjs', 'next.js'],
  'nodejs': ['node', 'nodejs', 'node.js', 'express', 'expressjs'],
  'python': ['python', 'python3', 'py', 'django', 'flask', 'fastapi'],
  'java': ['java', 'jdk', 'jvm', 'openjdk'],
  'spring': ['spring', 'spring-boot', 'springboot', 'spring-framework', 'spring-cloud'],
  'kotlin': ['kotlin', 'android-kotlin'],
  'swift': ['swift', 'swiftui', 'ios-swift'],
  'golang': ['go', 'golang'],
  'rust': ['rust', 'rust-lang'],
  'c++': ['cpp', 'c++', 'cplusplus', 'c-plus-plus'],
  'csharp': ['csharp', 'c#', 'c-sharp', 'dotnet', '.net', 'aspnet', 'asp.net'],
  'ruby': ['ruby', 'rails', 'ruby-on-rails'],
  'php': ['php', 'laravel', 'symfony'],
  'docker': ['docker', 'dockerfile', 'container', 'docker-compose', 'containerization'],
  'kubernetes': ['kubernetes', 'k8s', 'helm', 'kubectl'],
  'terraform': ['terraform', 'hcl', 'infrastructure-as-code'],
  'ansible': ['ansible', 'ansible-playbook'],
  'ci/cd': ['cicd', 'ci-cd', 'github-actions', 'jenkins', 'gitlab-ci', 'circleci', 'travis-ci'],
  'postgresql': ['postgresql', 'postgres', 'pg', 'postgis'],
  'mysql': ['mysql', 'mariadb'],
  'mongodb': ['mongodb', 'mongo', 'mongoose'],
  'redis': ['redis', 'redis-cache'],
  'elasticsearch': ['elasticsearch', 'elastic', 'elk', 'opensearch'],
  'kafka': ['kafka', 'apache-kafka', 'confluent'],
  'rabbitmq': ['rabbitmq', 'amqp', 'message-queue'],
  'aws': ['aws', 'amazon-web-services', 'ec2', 's3', 'lambda', 'cloudformation'],
  'gcp': ['gcp', 'google-cloud', 'google-cloud-platform', 'gke'],
  'azure': ['azure', 'microsoft-azure'],
  'aliyun': ['aliyun', 'alibaba-cloud', 'alicloud'],
  'graphql': ['graphql', 'apollo', 'hasura'],
  'rest': ['rest', 'restful', 'rest-api', 'openapi', 'swagger'],
  'microservices': ['microservices', 'microservice', 'micro-service'],
  'linux': ['linux', 'ubuntu', 'debian', 'centos', 'fedora'],
  'devops': ['devops', 'sre', 'site-reliability'],
  'grafana': ['grafana', 'prometheus', 'monitoring'],
  'machine-learning': ['machine-learning', 'ml', 'deep-learning', 'tensorflow', 'pytorch', 'ai'],
};

/**
 * 調用 GitHub API
 */
function githubApiCall(url) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: url,
      method: 'GET',
      headers: {
        'User-Agent': 'Step1ne-Headhunter-System',
        'Accept': 'application/vnd.github.v3+json'
      }
    };

    // 如果有 GitHub Token，使用認證
    const githubToken = process.env.GITHUB_TOKEN;
    if (githubToken) {
      options.headers['Authorization'] = `token ${githubToken}`;
    }

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error('Failed to parse GitHub API response'));
          }
        } else if (res.statusCode === 404) {
          resolve(null); // User not found
        } else {
          reject(new Error(`GitHub API returned ${res.statusCode}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('GitHub API timeout'));
    });
    
    req.end();
  });
}

/**
 * 從 GitHub URL 提取用戶名
 */
function extractGithubUsername(githubUrl) {
  if (!githubUrl) return null;
  
  // 支援格式：
  // https://github.com/username
  // github.com/username
  // username
  const match = githubUrl.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([^\/\?#]+)/);
  if (match) {
    return match[1];
  }
  
  // 如果沒有 URL 格式，假設是用戶名
  if (githubUrl && !githubUrl.includes('/') && !githubUrl.includes('.')) {
    return githubUrl;
  }
  
  return null;
}

/**
 * 獲取用戶基本資訊
 */
async function getUserProfile(username) {
  try {
    const user = await githubApiCall(`/users/${username}`);
    return user;
  } catch (error) {
    console.error(`Failed to fetch GitHub user ${username}:`, error.message);
    return null;
  }
}

/**
 * 獲取用戶的倉庫列表
 */
async function getUserRepos(username, maxRepos = 30) {
  try {
    const repos = await githubApiCall(`/users/${username}/repos?sort=updated&per_page=${maxRepos}`);
    return repos || [];
  } catch (error) {
    console.error(`Failed to fetch repos for ${username}:`, error.message);
    return [];
  }
}

/**
 * 分析編程語言分布
 */
function analyzeLanguages(repos) {
  const languageStats = {};
  let totalSize = 0;

  repos.forEach(repo => {
    if (repo.language) {
      languageStats[repo.language] = (languageStats[repo.language] || 0) + (repo.size || 1);
      totalSize += (repo.size || 1);
    }
  });

  // 計算百分比
  const languages = Object.entries(languageStats)
    .map(([name, size]) => ({
      name,
      percentage: totalSize > 0 ? Math.round((size / totalSize) * 100) : 0
    }))
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 5); // 只保留前 5 種語言

  return languages;
}

/**
 * 分析活躍度
 */
function analyzeActivity(repos, profile) {
  if (!repos || repos.length === 0) {
    return {
      lastCommit: null,
      recentActivity: 0,
      status: 'inactive',
      statusText: '無活動',
      score: 0
    };
  }

  // 找最近更新的倉庫
  const latestRepo = repos.reduce((latest, repo) => {
    const repoDate = new Date(repo.pushed_at || repo.updated_at);
    const latestDate = new Date(latest.pushed_at || latest.updated_at);
    return repoDate > latestDate ? repo : latest;
  }, repos[0]);

  const lastCommitDate = new Date(latestRepo.pushed_at || latestRepo.updated_at);
  const now = new Date();
  const daysSinceLastCommit = Math.floor((now - lastCommitDate) / (1000 * 60 * 60 * 24));

  // 計算最近 3 個月的活躍倉庫數
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  
  const recentActivity = repos.filter(repo => {
    const repoDate = new Date(repo.pushed_at || repo.updated_at);
    return repoDate > threeMonthsAgo;
  }).length;

  // 判斷活躍狀態
  let status, statusText, score;
  if (daysSinceLastCommit <= 7) {
    status = 'very_active';
    statusText = '非常活躍';
    score = 100;
  } else if (daysSinceLastCommit <= 30) {
    status = 'active';
    statusText = '活躍';
    score = 80;
  } else if (daysSinceLastCommit <= 90) {
    status = 'moderate';
    statusText = '中等活躍';
    score = 60;
  } else if (daysSinceLastCommit <= 180) {
    status = 'low';
    statusText = '較不活躍';
    score = 40;
  } else {
    status = 'inactive';
    statusText = '不活躍';
    score = 20;
  }

  return {
    lastCommitDate,
    daysSinceLastCommit,
    recentActivity,
    status,
    statusText,
    score
  };
}

/**
 * 分析影響力
 */
function analyzeInfluence(profile, repos) {
  const followers = profile.followers || 0;
  const totalStars = repos.reduce((sum, repo) => sum + (repo.stargazers_count || 0), 0);
  const publicRepos = profile.public_repos || 0;

  // 找出最受歡迎的項目
  const topRepos = repos
    .filter(repo => repo.stargazers_count > 0)
    .sort((a, b) => b.stargazers_count - a.stargazers_count)
    .slice(0, 3)
    .map(repo => ({
      name: repo.name,
      stars: repo.stargazers_count,
      description: repo.description || '',
      language: repo.language
    }));

  // 計算影響力評分（0-100）
  let score = 0;
  
  // Followers 權重 40%
  if (followers >= 1000) score += 40;
  else if (followers >= 500) score += 35;
  else if (followers >= 100) score += 25;
  else if (followers >= 50) score += 15;
  else if (followers >= 10) score += 5;

  // Stars 權重 40%
  if (totalStars >= 1000) score += 40;
  else if (totalStars >= 500) score += 35;
  else if (totalStars >= 100) score += 25;
  else if (totalStars >= 50) score += 15;
  else if (totalStars >= 10) score += 5;

  // Public Repos 權重 20%
  if (publicRepos >= 50) score += 20;
  else if (publicRepos >= 30) score += 15;
  else if (publicRepos >= 10) score += 10;
  else if (publicRepos >= 5) score += 5;

  return {
    followers,
    totalStars,
    publicRepos,
    topRepos,
    score
  };
}

/**
 * 計算星級評分（1-5 星）
 */
function calculateStarRating(totalScore) {
  if (totalScore >= 90) return 5;
  if (totalScore >= 75) return 4;
  if (totalScore >= 60) return 3;
  if (totalScore >= 40) return 2;
  return 1;
}

/**
 * 完整 GitHub 分析
 */
async function analyzeGithubProfile(githubUrl) {
  const username = extractGithubUsername(githubUrl);
  
  if (!username) {
    return {
      success: false,
      error: 'Invalid GitHub URL'
    };
  }

  try {
    // 獲取用戶資訊
    const profile = await getUserProfile(username);
    if (!profile) {
      return {
        success: false,
        error: 'GitHub user not found'
      };
    }

    // 獲取倉庫列表
    const repos = await getUserRepos(username);

    // 分析各項指標
    const languages = analyzeLanguages(repos);
    const activity = analyzeActivity(repos, profile);
    const influence = analyzeInfluence(profile, repos);

    // 計算綜合評分
    const activityScore = activity.score;
    const influenceScore = influence.score;
    
    // 加權平均：活躍度 50%、影響力 50%
    const totalScore = Math.round((activityScore * 0.5) + (influenceScore * 0.5));
    const stars = calculateStarRating(totalScore);

    return {
      success: true,
      username,
      profileUrl: `https://github.com/${username}`,
      avatar: profile.avatar_url,
      bio: profile.bio,
      company: profile.company,
      location: profile.location,
      languages,
      activity,
      influence,
      totalScore,
      stars,
      analyzedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('GitHub analysis failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 簡化版本（用於卡片顯示）
 */
async function getGithubQuickStats(githubUrl) {
  const result = await analyzeGithubProfile(githubUrl);
  
  if (!result.success) {
    return null;
  }

  return {
    score: result.totalScore,
    stars: result.stars,
    activity: {
      status: result.activity.status,
      statusText: result.activity.statusText,
      daysAgo: result.activity.daysSinceLastCommit
    },
    topLanguage: result.languages[0]?.name || 'Unknown',
    followers: result.influence.followers,
    totalStars: result.influence.totalStars
  };
}

// ============================================================
// v2 新增函式：4 維度分析
// ============================================================

/**
 * 標準化技能名稱（回傳 canonical name）
 */
function normalizeSkill(raw) {
  const s = (raw || '').trim().toLowerCase().replace(/[.\-_\s]+/g, '-');
  for (const [canonical, aliases] of Object.entries(SKILL_ALIASES)) {
    if (aliases.some(a => s === a || s.includes(a) || a.includes(s))) {
      return canonical;
    }
  }
  return s; // 找不到就回傳原始值
}

/**
 * 從職缺資料提取標準化技能列表
 * @param {string} keySkills - 職缺的 key_skills 欄位（逗號分隔）
 * @param {string} talentProfile - 職缺的 talent_profile 人才畫像
 * @returns {string[]} 標準化後的技能陣列（去重）
 */
function parseJobSkills(keySkills, talentProfile) {
  const raw = [keySkills, talentProfile].filter(Boolean).join(',');
  const skills = raw
    .split(/[,、\n\/；;：:（）()+]+/)
    .map(s => s.trim().toLowerCase())
    .filter(s => s.length > 1 && s.length < 40);

  const normalized = new Set();
  skills.forEach(s => {
    const n = normalizeSkill(s);
    if (n && n.length > 1) normalized.add(n);
  });
  return [...normalized];
}

/**
 * 維度 1：技能匹配分析（40% 權重）
 * 從 repo metadata 提取候選人的技術信號，與職缺技能比對
 *
 * @param {Array} repos - GitHub repos 陣列
 * @param {Object} profile - GitHub user profile
 * @param {string[]} jobSkills - 標準化後的職缺技能列表
 * @returns {{ score: number, matchedSkills: string[], missingSkills: string[], candidateSignals: string[] }}
 */
function analyzeSkillMatch(repos, profile, jobSkills) {
  if (!jobSkills || jobSkills.length === 0) {
    return { score: 50, matchedSkills: [], missingSkills: [], candidateSignals: [] };
  }

  // 從多個來源提取候選人技能信號
  const signalSet = new Set();

  repos.forEach(repo => {
    // 1. repo 主要語言
    if (repo.language) signalSet.add(normalizeSkill(repo.language));

    // 2. repo topics（GitHub 標籤，免費可用！）
    if (repo.topics && Array.isArray(repo.topics)) {
      repo.topics.forEach(t => signalSet.add(normalizeSkill(t)));
    }

    // 3. repo name 包含的技術關鍵字
    const repoName = (repo.name || '').toLowerCase();
    for (const [canonical, aliases] of Object.entries(SKILL_ALIASES)) {
      if (aliases.some(a => repoName.includes(a))) {
        signalSet.add(canonical);
      }
    }

    // 4. repo description 包含的技術關鍵字
    const desc = (repo.description || '').toLowerCase();
    if (desc.length > 5) {
      for (const [canonical, aliases] of Object.entries(SKILL_ALIASES)) {
        if (aliases.some(a => desc.includes(a))) {
          signalSet.add(canonical);
        }
      }
    }
  });

  // 5. profile bio
  const bio = (profile.bio || '').toLowerCase();
  if (bio.length > 3) {
    for (const [canonical, aliases] of Object.entries(SKILL_ALIASES)) {
      if (aliases.some(a => bio.includes(a))) {
        signalSet.add(canonical);
      }
    }
  }

  const candidateSignals = [...signalSet].filter(s => s.length > 1);

  // 比對
  const matchedSkills = jobSkills.filter(skill => candidateSignals.includes(skill));
  const missingSkills = jobSkills.filter(skill => !candidateSignals.includes(skill));

  // 計算分數
  const matchRatio = matchedSkills.length / jobSkills.length;
  let score;
  if (matchRatio >= 0.8) score = 95;
  else if (matchRatio >= 0.6) score = 80;
  else if (matchRatio >= 0.4) score = 65;
  else if (matchRatio >= 0.2) score = 45;
  else if (candidateSignals.length > 0) score = 25; // 有技能但不匹配
  else score = 10;

  return { score, matchedSkills, missingSkills, candidateSignals };
}

/**
 * 維度 2：專案品質分析（30% 權重）
 *
 * @param {Array} repos - GitHub repos 陣列
 * @returns {{ score: number, originalCount: number, forkCount: number, totalStars: number, substantialCount: number, maxStarRepo: Object|null }}
 */
function analyzeProjectQuality(repos) {
  if (!repos || repos.length === 0) {
    return { score: 0, originalCount: 0, forkCount: 0, totalStars: 0, substantialCount: 0, maxStarRepo: null };
  }

  const originalRepos = repos.filter(r => !r.fork);
  const forkedRepos = repos.filter(r => r.fork);

  // Sub-score A: 原創 vs Fork 比例（30%）
  const originalRatio = repos.length > 0 ? originalRepos.length / repos.length : 0;
  const ratioScore = Math.min(100, Math.round(originalRatio * 120)); // >83% 原創 = 100

  // Sub-score B: Star 品質（30%）
  const totalStars = originalRepos.reduce((s, r) => s + (r.stargazers_count || 0), 0);
  const starRepos = originalRepos.filter(r => (r.stargazers_count || 0) > 0);
  const maxStar = starRepos.length > 0
    ? starRepos.reduce((max, r) => (r.stargazers_count || 0) > (max.stargazers_count || 0) ? r : max, starRepos[0])
    : null;
  const maxStarCount = maxStar ? maxStar.stargazers_count : 0;

  let starScore = 0;
  if (maxStarCount >= 100) starScore = 100;
  else if (maxStarCount >= 50) starScore = 85;
  else if (maxStarCount >= 10) starScore = 70;
  else if (totalStars >= 10) starScore = 55;
  else if (totalStars >= 3) starScore = 35;
  else if (totalStars >= 1) starScore = 20;
  else starScore = 10;

  // Sub-score C: Repo 實質性（20%）— size > 50KB + 有 description
  const substantialRepos = originalRepos.filter(r =>
    (r.size || 0) > 50 && r.description
  );
  const substanceScore = originalRepos.length > 0
    ? Math.min(100, Math.round((substantialRepos.length / originalRepos.length) * 120))
    : 0;

  // Sub-score D: 文檔信號（20%）— has_wiki / has_pages / homepage
  const withDocs = originalRepos.filter(r => r.has_wiki || r.has_pages || r.homepage);
  const docScore = originalRepos.length > 0
    ? Math.min(100, Math.round((withDocs.length / originalRepos.length) * 150))
    : 0;

  const score = Math.round(
    ratioScore * 0.30 + starScore * 0.30 + substanceScore * 0.20 + docScore * 0.20
  );

  return {
    score,
    originalCount: originalRepos.length,
    forkCount: forkedRepos.length,
    totalStars,
    substantialCount: substantialRepos.length,
    maxStarRepo: maxStar ? { name: maxStar.name, stars: maxStar.stargazers_count, language: maxStar.language } : null
  };
}

/**
 * 維度 3：活躍度 v2（20% 權重）
 * 在原有 recency 基礎上，新增 6 個月一致性分數
 *
 * @param {Array} repos
 * @param {Object} profile
 * @returns {{ score: number, recencyScore: number, consistencyScore: number, activeMonths: number, monthlyActivity: number[], daysSinceLastCommit: number, status: string, statusText: string }}
 */
function analyzeActivityV2(repos, profile) {
  if (!repos || repos.length === 0) {
    return {
      score: 0, recencyScore: 0, consistencyScore: 0,
      activeMonths: 0, monthlyActivity: [0, 0, 0, 0, 0, 0],
      daysSinceLastCommit: 999, status: 'inactive', statusText: '無活動'
    };
  }

  // 找最近更新的倉庫
  const latestRepo = repos.reduce((latest, repo) => {
    const repoDate = new Date(repo.pushed_at || repo.updated_at);
    const latestDate = new Date(latest.pushed_at || latest.updated_at);
    return repoDate > latestDate ? repo : latest;
  }, repos[0]);

  const lastCommitDate = new Date(latestRepo.pushed_at || latestRepo.updated_at);
  const now = new Date();
  const daysSinceLastCommit = Math.floor((now - lastCommitDate) / (1000 * 60 * 60 * 24));

  // Recency score（與原有邏輯一致）
  let recencyScore, status, statusText;
  if (daysSinceLastCommit <= 7) {
    recencyScore = 100; status = 'very_active'; statusText = '非常活躍';
  } else if (daysSinceLastCommit <= 30) {
    recencyScore = 80; status = 'active'; statusText = '活躍';
  } else if (daysSinceLastCommit <= 90) {
    recencyScore = 60; status = 'moderate'; statusText = '中等活躍';
  } else if (daysSinceLastCommit <= 180) {
    recencyScore = 40; status = 'low'; statusText = '較不活躍';
  } else {
    recencyScore = 20; status = 'inactive'; statusText = '不活躍';
  }

  // 新增：6 個月一致性
  const monthlyActivity = [0, 0, 0, 0, 0, 0]; // [本月, 1個月前, ..., 5個月前]
  repos.forEach(repo => {
    const pushDate = new Date(repo.pushed_at || repo.updated_at);
    const monthsAgo = Math.floor((now - pushDate) / (1000 * 60 * 60 * 24 * 30));
    if (monthsAgo >= 0 && monthsAgo < 6) {
      monthlyActivity[monthsAgo]++;
    }
  });

  const activeMonths = monthlyActivity.filter(count => count > 0).length;
  let consistencyScore;
  if (activeMonths >= 6) consistencyScore = 100;
  else if (activeMonths >= 5) consistencyScore = 85;
  else if (activeMonths >= 4) consistencyScore = 70;
  else if (activeMonths >= 3) consistencyScore = 55;
  else if (activeMonths >= 2) consistencyScore = 40;
  else if (activeMonths >= 1) consistencyScore = 25;
  else consistencyScore = 10;

  const score = Math.round(recencyScore * 0.5 + consistencyScore * 0.5);

  return {
    score, recencyScore, consistencyScore,
    activeMonths, monthlyActivity,
    daysSinceLastCommit, lastCommitDate,
    status, statusText
  };
}

/**
 * v2 完整 GitHub 分析（4 維度）
 *
 * @param {string} githubUrl - GitHub profile URL
 * @param {Object} options - { jobSkills?: string[], keySkills?: string, talentProfile?: string }
 * @returns {Object} 完整 4 維度分析結果
 */
async function analyzeGithubProfileV2(githubUrl, options = {}) {
  const username = extractGithubUsername(githubUrl);

  if (!username) {
    return { success: false, error: 'Invalid GitHub URL' };
  }

  try {
    // 獲取用戶資訊（API call 1）
    const profile = await getUserProfile(username);
    if (!profile) {
      return { success: false, error: 'GitHub user not found' };
    }

    // 獲取倉庫列表（API call 2）— 只需 2 次 API call
    const repos = await getUserRepos(username);

    // 解析職缺技能
    let jobSkills = options.jobSkills || [];
    if (jobSkills.length === 0 && (options.keySkills || options.talentProfile)) {
      jobSkills = parseJobSkills(options.keySkills || '', options.talentProfile || '');
    }

    // 4 維度分析
    const skillMatch = analyzeSkillMatch(repos, profile, jobSkills);
    const projectQuality = analyzeProjectQuality(repos);
    const activity = analyzeActivityV2(repos, profile);
    const influence = analyzeInfluence(profile, repos);
    const languages = analyzeLanguages(repos);

    // 加權總分
    const totalScore = Math.round(
      skillMatch.score * 0.40 +
      projectQuality.score * 0.30 +
      activity.score * 0.20 +
      influence.score * 0.10
    );
    const stars = calculateStarRating(totalScore);

    return {
      success: true,
      version: 2,
      username,
      profileUrl: `https://github.com/${username}`,
      avatar: profile.avatar_url,
      bio: profile.bio,
      company: profile.company,
      location: profile.location,
      createdAt: profile.created_at,

      // 4 維度 breakdown
      skillMatch,
      projectQuality,
      activity,
      influence,

      // 語言分布
      languages,

      // 綜合評分
      totalScore,
      stars,
      weights: { skillMatch: 0.40, projectQuality: 0.30, activity: 0.20, influence: 0.10 },

      // 元資料
      analyzedAt: new Date().toISOString(),
      jobSkillsUsed: jobSkills
    };
  } catch (error) {
    console.error('GitHub analysis v2 failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * v2 簡化版（用於卡片顯示）
 */
async function getGithubQuickStatsV2(githubUrl, options = {}) {
  const result = await analyzeGithubProfileV2(githubUrl, options);

  if (!result.success) {
    return null;
  }

  return {
    score: result.totalScore,
    stars: result.stars,
    activity: {
      status: result.activity.status,
      statusText: result.activity.statusText,
      daysAgo: result.activity.daysSinceLastCommit,
      activeMonths: result.activity.activeMonths,
      score: result.activity.score
    },
    topLanguage: result.languages[0]?.name || 'Unknown',
    followers: result.influence.followers,
    totalStars: result.influence.totalStars,
    // v2 新增
    skillMatch: result.skillMatch ? {
      score: result.skillMatch.score,
      matchedSkills: result.skillMatch.matchedSkills,
      missingSkills: result.skillMatch.missingSkills
    } : undefined,
    projectQuality: {
      score: result.projectQuality.score,
      originalCount: result.projectQuality.originalCount,
      forkCount: result.projectQuality.forkCount
    },
    influence: {
      score: result.influence.score
    },
    version: 2
  };
}

module.exports = {
  // v1（向後相容）
  analyzeGithubProfile,
  getGithubQuickStats,
  extractGithubUsername,
  // v2
  analyzeGithubProfileV2,
  getGithubQuickStatsV2,
  analyzeSkillMatch,
  analyzeProjectQuality,
  analyzeActivityV2,
  parseJobSkills,
  normalizeSkill,
  SKILL_ALIASES
};
