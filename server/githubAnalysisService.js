/**
 * GitHub 分析服務
 * 用於評估候選人的 GitHub 技術能力、活躍度、影響力
 */

const https = require('https');

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
        console.log(`[GitHub API] ${url} returned ${res.statusCode}`);
        if (res.statusCode === 200) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            console.error('[GitHub API] Parse error:', e.message);
            reject(new Error('Failed to parse GitHub API response'));
          }
        } else if (res.statusCode === 404) {
          console.warn(`[GitHub API] User not found: ${url}`);
          resolve(null); // User not found
        } else {
          console.error(`[GitHub API] Error ${res.statusCode}: ${data.substring(0, 200)}`);
          reject(new Error(`GitHub API returned ${res.statusCode}`));
        }
      });
    });

    req.on('error', (err) => {
      console.error('[GitHub API] Request error:', err.message);
      reject(err);
    });
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

module.exports = {
  analyzeGithubProfile,
  getGithubQuickStats,
  extractGithubUsername
};
