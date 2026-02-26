/**
 * talentSourceService.js - 人才智能搜尋服務
 * 完整流程：
 * 1. 分析公司畫像 + 人才畫像
 * 2. GitHub API + Google→LinkedIn 搜尋（2-3頁）
 * 3. 去重（比對現有候選人）
 * 4. 評分（對比職缺要求）
 * 5. 寫入 candidates_pipeline（notes 含 AI 報告）
 * 6. 輸出優先推薦名單
 */

const { exec } = require('child_process');
const util = require('util');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const execPromise = util.promisify(exec);

const DATABASE_URL = process.env.DATABASE_URL ||
  'postgresql://root:etUh2zkR4Mr8gfWLs059S7Dm1T6Yby3Q@tpe1.clusters.zeabur.com:27883/zeabur';

const pool = new Pool({ connectionString: DATABASE_URL });

const TALENT_SOURCING_DIR = path.join(__dirname, 'talent-sourcing');
const SCRAPER_SCRIPT = path.join(TALENT_SOURCING_DIR, 'search-plan-executor.py');
const SCORER_SCRIPT = path.join(TALENT_SOURCING_DIR, 'candidate-scoring-system-v2.py');
const MIGRATION_SCRIPT = path.join(TALENT_SOURCING_DIR, 'industry-migration-analyzer.py');

function validateScripts() {
  const scripts = [SCRAPER_SCRIPT, SCORER_SCRIPT, MIGRATION_SCRIPT];
  const missing = scripts.filter(s => !fs.existsSync(s));
  if (missing.length > 0) {
    console.warn('⚠️ 缺少爬蟲腳本：', missing.map(p => path.basename(p)));
    return false;
  }
  return true;
}

// ============================================================
// 評分邏輯（Node.js，直接對比職缺要求）
// ============================================================

function scoreCandidate(candidate, job) {
  const rawSkills = [job.key_skills, job.experience_required, job.special_conditions]
    .filter(Boolean).join(',');
  const requiredSkills = rawSkills
    .split(/[,、\n\/；;]/)
    .map(s => s.trim().toLowerCase())
    .filter(s => s.length > 1 && s.length < 30);

  const candidateSkills = (candidate.skills || []).map(s => (s || '').toLowerCase());
  const candidateBio = (candidate.bio || '').toLowerCase();
  const candidateName = (candidate.name || '').toLowerCase();

  // 技能比對（60%）
  const matched = requiredSkills.filter(req =>
    candidateSkills.some(cs => cs.includes(req) || req.includes(cs)) ||
    candidateBio.includes(req)
  );
  const skillScore = requiredSkills.length > 0
    ? Math.round((matched.length / requiredSkills.length) * 100)
    : 50;

  // 個人資料品質（40%）
  let profileScore = 40;
  if (candidate.source === 'github') {
    const repos = candidate.public_repos || 0;
    const followers = candidate.followers || 0;
    if (repos > 30 || followers > 100) profileScore = 95;
    else if (repos > 15 || followers > 30) profileScore = 80;
    else if (repos > 5) profileScore = 65;
    else profileScore = 45;
  } else if (candidate.source === 'linkedin') {
    profileScore = 62;
  }

  const totalScore = Math.round(skillScore * 0.6 + profileScore * 0.4);

  let grade;
  if (totalScore >= 90) grade = 'S';
  else if (totalScore >= 85) grade = 'A+';
  else if (totalScore >= 75) grade = 'A';
  else if (totalScore >= 60) grade = 'B';
  else grade = 'C';

  const missingSkills = requiredSkills.filter(r => !matched.includes(r));

  return { totalScore, skillScore, profileScore, grade, matchedSkills: matched, missingSkills };
}

// ============================================================
// AI 評估報告生成
// ============================================================

function generateAINotes(candidate, job, clientInfo, scoreResult, jobList) {
  const { grade, totalScore, skillScore, matchedSkills, missingSkills } = scoreResult;
  const today = new Date().toISOString().slice(0, 10);
  const company = clientInfo?.company_name || job.client_company || '客戶公司';
  const industry = clientInfo?.industry || '科技業';

  const gradeEmoji = { S: '🏆', 'A+': '⭐', A: '✅', B: '📋', C: '📝' }[grade] || '';
  const priorityText =
    (grade === 'S' || grade === 'A+') ? '⚡ 建議今天聯繫' :
    grade === 'A' ? '📅 建議本週內聯繫' : '📌 已存入系統備查';

  // 來源說明
  let sourceInfo = '';
  if (candidate.source === 'github') {
    sourceInfo = `GitHub @${candidate.github_username}（公開 repo：${candidate.public_repos}，followers：${candidate.followers}）`;
    if (candidate.top_repos?.length) {
      sourceInfo += `\n主要專案：${candidate.top_repos.slice(0, 3).join('、')}`;
    }
  } else {
    sourceInfo = `LinkedIn: ${candidate.linkedin_url}（via Google 搜尋）`;
  }

  // 優勢
  const strengths = [];
  if (matchedSkills.length > 0) strengths.push(`${matchedSkills.slice(0, 4).join('、')} 技能符合職缺要求（${skillScore}%）`);
  if (candidate.source === 'github' && (candidate.public_repos || 0) > 10)
    strengths.push(`GitHub 活躍（${candidate.public_repos} 個公開 repo，${candidate.followers} followers）`);
  if (candidate.company) strengths.push(`現任 ${candidate.company}`);
  if (candidate.bio) strengths.push(candidate.bio.slice(0, 60));
  if (!strengths.length) strengths.push('基本條件符合，需面談進一步確認');

  // 劣勢/風險
  const weaknesses = [];
  if (missingSkills.length > 0) weaknesses.push(`缺少技能：${missingSkills.slice(0, 3).join('、')}`);
  if (candidate.source === 'linkedin') weaknesses.push('僅有 LinkedIn 基本資訊，技術深度待確認');
  const loc = (candidate.location || '').toLowerCase();
  if (loc && !loc.includes('taiwan') && !loc.includes('台灣') && !loc.includes('taipei') && !loc.includes('新北') && !loc.includes('台北')) {
    weaknesses.push(`目前位置：${candidate.location}，需確認是否可配合在地工作`);
  }
  if (!weaknesses.length) weaknesses.push('尚無明確劣勢，建議面談確認穩定性與薪資期望');

  // 聯繫時需深入瞭解
  const questions = [
    `目前薪資期望是否符合 ${company} 職缺範圍？`,
    `對 ${industry} 產業的興趣與轉換動機？`,
    '最快可到職時間？',
    '目前是否同時在其他公司面試中？',
  ];
  if (missingSkills.length > 0)
    questions.push(`對 ${missingSkills[0]} 的熟悉程度？是否有實際專案經驗？`);
  if (candidate.source === 'github')
    questions.push('是否有意願接受獵頭推薦？目前工作狀態如何？');

  // 匹配職缺列表
  const matchLines = jobList.slice(0, 3).map((j, i) => {
    const matchPct = i === 0 ? skillScore : Math.max(40, skillScore - (i * 8));
    return `${['①', '②', '③'][i]} ${j.position_name}（${company}）- 符合度 ${matchPct}%`;
  });

  return `【AI 人才評估報告】${today}

▌ 綜合評級：${gradeEmoji} ${grade}（${totalScore}分）
${priorityText}

▌ 為什麼推薦此人選
${candidate.bio ? candidate.bio + '\n' : ''}技能符合度 ${skillScore}%，整體評分 ${totalScore}/100。${candidate.source === 'github' ? `GitHub 活躍開發者，${candidate.public_repos} 個公開專案。` : 'LinkedIn 在職專業人士。'}

▌ 最佳匹配職缺（${company}）
${matchLines.join('\n')}

▌ 優勢
${strengths.map(s => `- ${s}`).join('\n')}

▌ 劣勢 / 風險
${weaknesses.map(w => `- ${w}`).join('\n')}

▌ 聯繫時需深入瞭解
${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

▌ 資料來源
${sourceInfo}

▌ AI 自動評分產出 by Step1ne 獵頭系統`;
}

// ============================================================
// 去重邏輯
// ============================================================

async function checkDuplicate(candidate) {
  try {
    const checks = [];

    if (candidate.github_url) {
      checks.push(pool.query(
        `SELECT id, name FROM candidates_pipeline WHERE github_url = $1 LIMIT 1`,
        [candidate.github_url]
      ));
    }
    if (candidate.linkedin_url) {
      checks.push(pool.query(
        `SELECT id, name FROM candidates_pipeline WHERE linkedin_url = $1 LIMIT 1`,
        [candidate.linkedin_url]
      ));
    }
    if (candidate.email) {
      checks.push(pool.query(
        `SELECT id, name FROM candidates_pipeline WHERE email = $1 LIMIT 1`,
        [candidate.email]
      ));
    }
    if (!checks.length) return null;

    const results = await Promise.all(checks);
    for (const r of results) {
      if (r.rows.length > 0) return r.rows[0];
    }
    return null;
  } catch (e) {
    console.warn('去重查詢失敗:', e.message);
    return null;
  }
}

// ============================================================
// 寫入候選人
// ============================================================

async function saveCandidate(candidate, job, notes, scoreResult, actor) {
  const skillsStr = Array.isArray(candidate.skills) ? candidate.skills.join(', ') : '';
  const db = await pool.connect();
  try {
    const result = await db.query(`
      INSERT INTO candidates_pipeline (
        name, email, phone, location, position_name,
        years_experience, skills, github_url, linkedin_url,
        contact_link, notes, status, recruiter, talent_level,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9,
        $10, $11, '未開始', $12, $13,
        NOW(), NOW()
      ) RETURNING id
    `, [
      candidate.name || '未命名',
      candidate.email || '',
      '',
      candidate.location || '',
      job.position_name || '',
      0,
      skillsStr,
      candidate.github_url || '',
      candidate.linkedin_url || '',
      candidate.github_url || candidate.linkedin_url || '',
      notes,
      actor || 'AI搜尋',
      scoreResult.grade,
    ]);
    return result.rows[0]?.id;
  } finally {
    db.release();
  }
}

// ============================================================
// 公司畫像 + 人才畫像分析
// ============================================================

function analyzeCompanyProfile(clientInfo, jobs) {
  const company = clientInfo?.company_name || '客戶公司';
  const industry = clientInfo?.industry || '科技業';
  const size = clientInfo?.company_size || '未知';
  const bdStatus = clientInfo?.bd_status || '';

  const allSkills = jobs.flatMap(j =>
    (j.key_skills || '').split(/[,、\n]/).map(s => s.trim()).filter(Boolean)
  );
  const uniqueSkills = [...new Set(allSkills)];

  return {
    company,
    industry,
    size,
    bd_status: bdStatus,
    key_skills: uniqueSkills.slice(0, 10),
    job_count: jobs.length,
    description: `${company} 為 ${industry} 產業，規模 ${size}，目前有 ${jobs.length} 個職缺開放中。主要技術需求：${uniqueSkills.slice(0, 5).join('、')}。`,
  };
}

function analyzeTalentProfile(job, companyProfile) {
  const skills = (job.key_skills || '').split(/[,、\n]/).map(s => s.trim()).filter(Boolean);
  const experience = job.experience_required || '不限';
  const education = job.education_required || '不限';

  return {
    target_role: job.position_name,
    required_skills: skills,
    experience_required: experience,
    education_required: education,
    industry: companyProfile.industry,
    ideal_profile: `理想人選應具備 ${skills.slice(0, 3).join('、')} 等核心技能，${experience}，具備 ${companyProfile.industry} 產業背景尤佳。`,
  };
}

// ============================================================
// 優先推薦名單生成
// ============================================================

function generatePriorityList(scoredCandidates) {
  const sorted = [...scoredCandidates].sort((a, b) => b.score.totalScore - a.score.totalScore);

  const topCandidates = sorted.slice(0, 3);
  const others = sorted.slice(3);

  const gradeEmoji = { S: '🏆', 'A+': '⭐', A: '✅', B: '📋', C: '📝' };
  const rankEmoji = ['🥇', '🥈', '🥉'];

  let summary = '';

  if (topCandidates.length === 0) {
    summary = '未找到符合條件的候選人，建議調整搜尋條件後重試。';
  } else {
    summary = `🎯 建議優先聯繫（依評級 + 符合度排序）：\n\n`;
    topCandidates.forEach((item, idx) => {
      const { candidate, score } = item;
      const emoji = rankEmoji[idx] || `${idx + 1}.`;
      const gradeE = gradeEmoji[score.grade] || '';
      const urgency = (score.grade === 'S' || score.grade === 'A+') ? '⚡ 建議今天聯繫' :
                      score.grade === 'A' ? '📅 建議本週內聯繫' : '📌 備查';
      const source = candidate.source === 'github'
        ? `GitHub @${candidate.github_username}，${candidate.public_repos} repos`
        : `LinkedIn ${candidate.linkedin_username || ''}`;

      summary += `${emoji} 第${idx + 1}位：${candidate.name}（${gradeE}${score.grade}, ${score.totalScore}分）\n`;
      summary += `   ${source}\n`;
      if (score.matchedSkills.length > 0) {
        summary += `   技能：${score.matchedSkills.slice(0, 3).join('、')}\n`;
      }
      summary += `   ${urgency}\n\n`;
    });

    if (others.length > 0) {
      const bCount = others.filter(i => i.score.grade === 'B').length;
      const cCount = others.filter(i => i.score.grade === 'C').length;
      summary += `⚠️ 其餘 ${others.length} 位（B級：${bCount}、C級：${cCount}）已存入系統備查\n`;
    }

    summary += `\n📋 前往系統查看完整名單 → 候選人總表`;
  }

  return { sorted, summary };
}

// ============================================================
// 核心：完整人才搜尋流程
// ============================================================

class TalentSourceService {
  constructor() {
    this.isReady = validateScripts();
  }

  /**
   * findAndSaveCandidates - 完整六步流程
   * @param {Object} params - { company, jobTitle, jobId, actor, githubToken, linkedinToken, pages }
   */
  async findAndSaveCandidates({ company, jobTitle, jobId, actor, githubToken, linkedinToken, pages = 2 }) {
    const db = await pool.connect();

    try {
      // ── Step 1：取得職缺 + 客戶資料 ──────────────────────
      let jobQuery;
      if (jobId) {
        jobQuery = await db.query(
          `SELECT * FROM jobs_pipeline WHERE id = $1 LIMIT 1`, [jobId]
        );
      } else {
        // 用公司名 + 職稱搜尋
        jobQuery = await db.query(`
          SELECT * FROM jobs_pipeline
          WHERE LOWER(client_company) LIKE LOWER($1)
            AND LOWER(position_name) LIKE LOWER($2)
          LIMIT 1
        `, [`%${company}%`, `%${jobTitle}%`]);
      }

      if (!jobQuery.rows.length) {
        return {
          success: false,
          error: `找不到職缺：${company} / ${jobTitle}，請確認職缺已匯入系統。`
        };
      }

      const job = jobQuery.rows[0];
      const clientCompany = job.client_company;

      // 同公司所有職缺
      const allJobsQuery = await db.query(
        `SELECT * FROM jobs_pipeline WHERE LOWER(client_company) = LOWER($1) AND job_status = '招募中'`,
        [clientCompany]
      );
      const allJobs = allJobsQuery.rows;

      // 客戶資料
      const clientQuery = await db.query(
        `SELECT * FROM clients WHERE LOWER(company_name) LIKE LOWER($1) LIMIT 1`,
        [`%${clientCompany}%`]
      );
      const clientInfo = clientQuery.rows[0] || null;

      // ── Step 2：分析畫像 ────────────────────────────────
      const companyProfile = analyzeCompanyProfile(clientInfo, allJobs);
      const talentProfile = analyzeTalentProfile(job, companyProfile);

      console.log(`[Step1] 公司：${companyProfile.company} | 職缺：${job.position_name}`);
      console.log(`[Step1] 人才畫像：${talentProfile.ideal_profile}`);

      db.release();

      // ── Step 3：搜尋（Python）───────────────────────────
      if (!this.isReady) {
        return { success: false, error: '爬蟲腳本未就緒，請確認 talent-sourcing/ 目錄' };
      }

      const skills = talentProfile.required_skills;
      const skillsArg = skills.join(',');
      const tokenArg = githubToken ? `--github-token "${githubToken}"` : '';
      const liAtArg = linkedinToken ? `--linkedin-token "${linkedinToken}"` : '';
      const pagesArg = Math.min(3, Math.max(1, pages));

      // Escape shell args
      const safeJobTitle = jobTitle.replace(/"/g, '\\"');
      const safeSkills = skillsArg.replace(/"/g, '\\"');

      const cmd = `cd "${TALENT_SOURCING_DIR}" && python3 search-plan-executor.py \
        --job-title "${safeJobTitle}" \
        --required-skills "${safeSkills}" \
        --industry "${companyProfile.industry}" \
        --location "Taiwan" \
        --pages ${pagesArg} \
        ${tokenArg} \
        ${liAtArg}`;

      console.log(`[Step2] 執行搜尋... pages=${pagesArg}, skills=${skillsArg}`);
      const startTime = Date.now();

      let scraperOutput;
      try {
        const { stdout, stderr } = await execPromise(cmd, {
          timeout: 600000,
          maxBuffer: 20 * 1024 * 1024,
          shell: '/bin/bash',
        });
        if (stderr) console.log(`[scraper stderr] ${stderr.slice(0, 500)}`);

        // 解析 JSON 輸出
        const jsonMatch = stdout.match(/\{[\s\S]*\}/);
        scraperOutput = jsonMatch ? JSON.parse(jsonMatch[0]) : { all_candidates: [] };
      } catch (e) {
        const stderr = (e.stderr || '').slice(0, 800);
        const stdout = (e.stdout || '').slice(0, 800);
        console.error('[Step2] 搜尋失敗:', e.message, '\nstderr:', stderr, '\nstdout:', stdout);
        return {
          success: false,
          error: `搜尋失敗：${e.message}`,
          debug_stderr: stderr || '（無 stderr）',
          debug_stdout: stdout || '（無 stdout）',
        };
      }

      const execTime = ((Date.now() - startTime) / 1000).toFixed(1);
      const rawCandidates = scraperOutput.all_candidates || [];
      const rateLimitWarning = scraperOutput.rate_limit_warning || null;

      console.log(`[Step2] 找到 ${rawCandidates.length} 位原始候選人（${execTime}s）`);

      // ── Step 4 & 5：去重 + 評分 + 寫入 ──────────────────
      const imported = [];
      const skipped = [];
      const scoredAll = [];

      for (const candidate of rawCandidates) {
        // 去重
        const existing = await checkDuplicate(candidate);
        if (existing) {
          skipped.push({ name: candidate.name, reason: `已存在（ID: ${existing.id}）` });
          continue;
        }

        // 評分
        const scoreResult = scoreCandidate(candidate, job);

        // 生成 AI notes
        const notes = generateAINotes(candidate, job, clientInfo, scoreResult, allJobs);

        // 寫入 DB
        let savedId;
        try {
          savedId = await saveCandidate(candidate, job, notes, scoreResult, actor);
          imported.push({ ...candidate, id: savedId, score: scoreResult });
          scoredAll.push({ candidate: { ...candidate, id: savedId }, score: scoreResult });
          console.log(`[Step4] 匯入：${candidate.name} (${scoreResult.grade}, ${scoreResult.totalScore}分)`);
        } catch (e) {
          console.error(`[Step4] 寫入失敗（${candidate.name}）:`, e.message);
          skipped.push({ name: candidate.name, reason: `寫入失敗: ${e.message}` });
        }
      }

      // ── Step 6：優先推薦名單 ──────────────────────────────
      const { sorted, summary: prioritySummary } = generatePriorityList(scoredAll);

      // 組裝最終回應
      const finalSummary =
        `✅ 已匯入 ${imported.length} 位候選人到系統\n` +
        `（略過 ${skipped.length} 位重複人選）\n\n` +
        prioritySummary +
        (rateLimitWarning ? `\n\n${rateLimitWarning}` : '');

      return {
        success: true,
        company: companyProfile.company,
        job_title: job.position_name,
        company_profile: companyProfile,
        talent_profile: talentProfile,
        imported_count: imported.length,
        skipped_count: skipped.length,
        skipped,
        candidates: sorted,
        priority_summary: prioritySummary,
        full_summary: finalSummary,
        rate_limit_warning: rateLimitWarning,
        execution_time: `${execTime}s`,
        github_count: scraperOutput.github?.count || 0,
        linkedin_count: scraperOutput.linkedin?.count || 0,
      };

    } catch (error) {
      console.error('❌ findAndSaveCandidates 失敗:', error.message);
      return { success: false, error: error.message };
    }
  }

  // ── 舊有方法保留（供其他端點使用）──────────────────────────

  async searchCandidates({ jobTitle, industry, requiredSkills, layer, githubToken }) {
    if (!this.isReady) return { success: false, error: '爬蟲腳本未就緒', data: [] };
    try {
      const skillsStr = Array.isArray(requiredSkills) ? requiredSkills.join(',') : requiredSkills;
      const tokenArg = githubToken ? `--github-token "${githubToken}"` : '';
      const cmd = `cd "${TALENT_SOURCING_DIR}" && python3 search-plan-executor.py \
        --job-title "${jobTitle}" --industry "${industry}" \
        --required-skills "${skillsStr}" --pages 2 ${tokenArg}`;
      const { stdout } = await execPromise(cmd, { timeout: 600000, maxBuffer: 20 * 1024 * 1024 });
      const jsonMatch = stdout.match(/\{[\s\S]*\}/);
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
      const results = parsed.all_candidates || [];
      return { success: true, data: results, candidateCount: results.length, timestamp: new Date().toISOString() };
    } catch (error) {
      return { success: false, error: error.message, data: [] };
    }
  }

  async scoreCandidates(candidates, jobRequirement) {
    if (!Array.isArray(candidates) || candidates.length === 0)
      return { success: false, error: '無候選人資料', data: [] };
    if (!this.isReady) return { success: false, error: '評分系統未就緒', data: [] };
    try {
      const inputData = { candidates, jobRequirement: jobRequirement || {} };
      const tempFile = `/tmp/scoring-input-${Date.now()}.json`;
      fs.writeFileSync(tempFile, JSON.stringify(inputData));
      const { stdout } = await execPromise(
        `cd "${TALENT_SOURCING_DIR}" && python3 candidate-scoring-system-v2.py --input-file ${tempFile} --output-format json`,
        { timeout: 120000, maxBuffer: 20 * 1024 * 1024 }
      );
      fs.unlinkSync(tempFile);
      const jsonMatch = stdout.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
      const scores = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
      return { success: true, data: scores, timestamp: new Date().toISOString() };
    } catch (error) {
      return { success: false, error: error.message, data: [] };
    }
  }

  async analyzeMigration(candidates, targetIndustry) {
    if (!Array.isArray(candidates) || candidates.length === 0)
      return { success: false, error: '無候選人資料', data: [] };
    if (!this.isReady) return { success: false, error: '遷移分析系統未就緒', data: [] };
    try {
      const tempFile = `/tmp/migration-input-${Date.now()}.json`;
      fs.writeFileSync(tempFile, JSON.stringify({ candidates, targetIndustry }));
      const { stdout } = await execPromise(
        `cd "${TALENT_SOURCING_DIR}" && python3 industry-migration-analyzer.py --input-file ${tempFile} --target-industry "${targetIndustry}" --output-format json`,
        { timeout: 120000, maxBuffer: 20 * 1024 * 1024 }
      );
      fs.unlinkSync(tempFile);
      const jsonMatch = stdout.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
      const analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
      return { success: true, data: analysis, timestamp: new Date().toISOString() };
    } catch (error) {
      return { success: false, error: error.message, data: [] };
    }
  }

  async healthCheck() {
    return {
      scriptsReady: this.isReady,
      toolsDir: TALENT_SOURCING_DIR,
      scriptsAvailable: {
        scraper: fs.existsSync(SCRAPER_SCRIPT),
        scorer: fs.existsSync(SCORER_SCRIPT),
        migration: fs.existsSync(MIGRATION_SCRIPT),
      }
    };
  }
}

module.exports = new TalentSourceService();
