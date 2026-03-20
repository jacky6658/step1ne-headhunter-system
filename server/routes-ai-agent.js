/**
 * routes-ai-agent.js - AI Agent API 路由
 *
 * 供任何外部 AI Agent（TG Bot、Claude Code、GPT 等）使用的 API。
 * 流程：取提示詞 → 取人選資料 → 取職缺 → AI 產出分析 → 寫回系統
 *
 * 端點：
 *   GET  /api/ai-agent/prompts/matching                      - 取匹配提示詞
 *   GET  /api/ai-agent/prompts/outreach                      - 取開發信提示詞
 *   GET  /api/ai-agent/candidates/:id/full-profile            - 取人選完整資料
 *   GET  /api/ai-agent/candidates/:id/resume-text             - 取履歷 PDF base64
 *   GET  /api/ai-agent/jobs/match-candidates                  - 取最匹配的職缺
 *   PUT  /api/ai-agent/candidates/:id/ai-analysis             - 寫入分析結果
 *   PUT  /api/ai-agent/candidates/:id/outreach-letter         - 寫入開發信
 */

const express = require('express');
const router = express.Router();
const { pool } = require('./db');
const { safeError } = require('./safeError');

// ══════════════════════════════════════════════
// GET /prompts/matching - 取 AI 顧問分析提示詞
// ══════════════════════════════════════════════

router.get('/prompts/matching', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, title, content, updated_at
       FROM prompt_library
       WHERE category = '人選評估' AND is_pinned = true
       ORDER BY updated_at DESC LIMIT 1`
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: '找不到匹配提示詞，請先在 prompt_library 建立' });
    }
    const row = result.rows[0];
    res.json({
      success: true,
      data: {
        prompt_id: row.id,
        title: row.title,
        content: row.content,
        updated_at: row.updated_at
      }
    });
  } catch (error) {
    safeError(res, error, 'GET /ai-agent/prompts/matching');
  }
});

// ══════════════════════════════════════════════
// GET /prompts/outreach - 取開發信提示詞
// ══════════════════════════════════════════════

router.get('/prompts/outreach', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, title, content, updated_at
       FROM prompt_library
       WHERE category = '陌生開發（開發信）' AND is_pinned = true
       ORDER BY updated_at DESC LIMIT 1`
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: '找不到開發信提示詞' });
    }
    const row = result.rows[0];
    res.json({
      success: true,
      data: {
        prompt_id: row.id,
        title: row.title,
        content: row.content,
        updated_at: row.updated_at
      }
    });
  } catch (error) {
    safeError(res, error, 'GET /ai-agent/prompts/outreach');
  }
});

// ══════════════════════════════════════════════
// GET /candidates/:id/full-profile - 人選完整資料（AI 匹配用）
// ══════════════════════════════════════════════

router.get('/candidates/:id/full-profile', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT c.*,
              j.position_name AS target_job_label,
              j.client_company AS target_job_company
       FROM candidates_pipeline c
       LEFT JOIN jobs_pipeline j ON j.id = c.target_job_id
       WHERE c.id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: '找不到此候選人' });
    }
    const row = result.rows[0];

    // 安全解析 JSONB 陣列
    const safeArr = (v) => {
      if (!v) return [];
      if (Array.isArray(v)) return v;
      if (typeof v === 'string') { try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return []; } }
      return [];
    };

    // 回傳 AI 匹配需要的所有欄位（不含 resume PDF base64）
    const profile = {
      id: row.id,
      name: row.name || '',
      email: row.email || '',
      phone: row.phone || '',
      location: row.location || '',
      current_title: row.current_title || row.current_position || '',
      current_company: row.current_company || '',
      current_position: row.current_position || '',
      total_years: row.total_years != null ? parseFloat(row.total_years) : (parseInt(row.years_experience) || 0),
      role_family: row.role_family || '',
      canonical_role: row.canonical_role || '',
      seniority_level: row.seniority_level || '',
      industry: row.industry || '',
      industry_tag: row.industry_tag || '',

      // 技能
      skills: row.skills || '',
      normalized_skills: safeArr(row.normalized_skills),
      skill_evidence: safeArr(row.skill_evidence),

      // 工作經歷 & 學歷
      work_history: safeArr(row.work_history),
      education_details: safeArr(row.education_details),
      education: row.education || '',
      education_level: row.education_level || '',
      education_summary: row.education_summary || '',

      // 薪資 & 可用性
      salary_info: {
        current_salary: row.current_salary || '',
        expected_salary: row.expected_salary || '',
        current_min: row.current_salary_min || null,
        current_max: row.current_salary_max || null,
        expected_min: row.expected_salary_min || null,
        expected_max: row.expected_salary_max || null,
        currency: row.salary_currency || 'TWD',
        period: row.salary_period || 'monthly',
      },
      notice_period: row.notice_period || '',
      notice_period_enum: row.notice_period_enum || '',
      job_search_status: row.job_search_status || '',
      job_search_status_enum: row.job_search_status_enum || '',

      // 語言 & 證照
      languages: row.languages || '',
      certifications: row.certifications || '',
      management_experience: row.management_experience || false,
      team_size: row.team_size || '',

      // 動機 & 交易條件
      reason_for_change: row.reason_for_change || '',
      motivation: row.motivation || '',
      deal_breakers: row.deal_breakers || '',

      // 人格 & 評估
      personality_type: row.personality_type || '',
      consultant_evaluation: row.consultant_evaluation || null,
      voice_assessments: safeArr(row.voice_assessments),
      biography: row.biography || '',

      // LinkedIn / GitHub
      linkedin_url: row.linkedin_url || '',
      github_url: row.github_url || '',

      // 目標職缺
      target_job_id: row.target_job_id || null,
      target_job_label: row.target_job_label ? `${row.target_job_label}${row.target_job_company ? ` (${row.target_job_company})` : ''}` : null,

      // 履歷附件 metadata（不含 base64，用 /resume-text 端點另外取）
      resume_files: safeArr(row.resume_files).map(f => ({
        id: f.id,
        filename: f.filename,
        mimetype: f.mimetype,
        size: f.size,
        uploaded_at: f.uploaded_at,
      })),

      // 已有的 AI 分析（供參考）
      existing_ai_analysis: row.ai_analysis || null,

      // 品質 & 分類
      grade_level: row.grade_level || '',
      heat_level: row.heat_level || '',
      data_quality: row.data_quality || null,
    };

    res.json({ success: true, data: profile });
  } catch (error) {
    safeError(res, error, 'GET /ai-agent/candidates/:id/full-profile');
  }
});

// ══════════════════════════════════════════════
// GET /candidates/:id/resume-text - 取履歷 PDF base64
// ══════════════════════════════════════════════

router.get('/candidates/:id/resume-text', async (req, res) => {
  try {
    const { id } = req.params;
    const fileId = req.query.fileId;

    const result = await pool.query(
      'SELECT resume_files FROM candidates_pipeline WHERE id = $1',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: '找不到此候選人' });
    }

    const files = result.rows[0].resume_files || [];
    if (files.length === 0) {
      return res.status(404).json({ success: false, error: '此候選人沒有上傳履歷 PDF' });
    }

    // 找指定的檔案或回傳第一個
    let file;
    if (fileId) {
      file = files.find(f => f.id === fileId);
      if (!file) return res.status(404).json({ success: false, error: `找不到檔案 ${fileId}` });
    } else {
      file = files[0]; // 預設最新的（第一個）
    }

    res.json({
      success: true,
      data: {
        file_id: file.id,
        filename: file.filename,
        mimetype: file.mimetype || 'application/pdf',
        base64: file.data || '', // base64 encoded PDF content
      }
    });
  } catch (error) {
    safeError(res, error, 'GET /ai-agent/candidates/:id/resume-text');
  }
});

// ══════════════════════════════════════════════
// GET /jobs/match-candidates - 取最匹配的職缺
// Query: ?candidateId=123&limit=3
// ══════════════════════════════════════════════

router.get('/jobs/match-candidates', async (req, res) => {
  try {
    const candidateId = parseInt(req.query.candidateId);
    const limit = Math.min(parseInt(req.query.limit) || 3, 10);

    if (!candidateId) {
      return res.status(400).json({ success: false, error: '需要 candidateId 參數' });
    }

    // 取人選資料
    const candRes = await pool.query(
      `SELECT id, name, skills, normalized_skills, work_history,
              years_experience, total_years, location, current_position,
              current_title, role_family, canonical_role, industry_tag, industry,
              expected_salary_min, expected_salary_max, salary_currency, salary_period,
              target_job_id
       FROM candidates_pipeline WHERE id = $1`,
      [candidateId]
    );
    if (candRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: '找不到此候選人' });
    }
    const candidate = candRes.rows[0];

    // 取所有開放職缺（完整 JD 資料給 AI 用）
    const jobsRes = await pool.query(
      `SELECT id, position_name, client_company, department,
              key_skills, experience_required, education_required,
              language_required, special_conditions,
              salary_range, salary_min, salary_max,
              job_description, marketing_description,
              company_profile, talent_profile,
              industry_background, team_size, key_challenges,
              attractive_points, recruitment_difficulty,
              interview_process, submission_criteria,
              rejection_criteria, consultant_notes,
              search_primary, search_secondary,
              location, job_status, remote_work,
              welfare_tags, welfare_detail, work_hours
       FROM jobs_pipeline
       WHERE job_status IS NULL OR job_status NOT IN ('已關閉', '已成交')
       ORDER BY created_at DESC LIMIT 200`
    );

    // 簡易匹配排序：技能 overlap + 目標職缺優先
    const candSkills = (() => {
      let s = candidate.normalized_skills;
      if (!s) return [];
      if (typeof s === 'string') { try { s = JSON.parse(s); } catch { return []; } }
      return Array.isArray(s) ? s.map(sk => sk.toLowerCase()) : [];
    })();

    const scored = jobsRes.rows.map(job => {
      const jobSkills = (job.key_skills || '').toLowerCase().split(/[,、;]+/).map(s => s.trim()).filter(Boolean);
      const overlap = candSkills.filter(s => jobSkills.some(js => js.includes(s) || s.includes(js))).length;
      const isTarget = candidate.target_job_id && job.id === candidate.target_job_id;
      return { ...job, _score: overlap + (isTarget ? 100 : 0) };
    });

    scored.sort((a, b) => b._score - a._score);
    const topJobs = scored.slice(0, limit);

    // 回傳完整 JD 資料
    const matched_jobs = topJobs.map(job => ({
      job_id: job.id,
      position_name: job.position_name || '',
      client_company: job.client_company || '',
      department: job.department || '',
      salary_range: job.salary_range || '',
      salary_min: job.salary_min || null,
      salary_max: job.salary_max || null,
      key_skills: job.key_skills || '',
      experience_required: job.experience_required || '',
      education_required: job.education_required || '',
      language_required: job.language_required || '',
      special_conditions: job.special_conditions || '',
      location: job.location || '',
      job_status: job.job_status || '',
      job_description: job.job_description || '',
      marketing_description: job.marketing_description || '',
      company_profile: job.company_profile || '',
      talent_profile: job.talent_profile || '',
      industry_background: job.industry_background || '',
      team_size: job.team_size || '',
      key_challenges: job.key_challenges || '',
      attractive_points: job.attractive_points || '',
      recruitment_difficulty: job.recruitment_difficulty || '',
      interview_process: job.interview_process || '',
      submission_criteria: job.submission_criteria || '',
      rejection_criteria: job.rejection_criteria || '',
      consultant_notes: job.consultant_notes || '',
      remote_work: job.remote_work || '',
      welfare_tags: job.welfare_tags || '',
      work_hours: job.work_hours || '',
    }));

    res.json({
      success: true,
      data: {
        candidate_id: candidateId,
        candidate_name: candidate.name,
        total_matched: matched_jobs.length,
        matched_jobs
      }
    });
  } catch (error) {
    safeError(res, error, 'GET /ai-agent/jobs/match-candidates');
  }
});

// ══════════════════════════════════════════════
// PUT /candidates/:id/ai-analysis - 寫入 AI 顧問分析結果
// ══════════════════════════════════════════════

router.put('/candidates/:id/ai-analysis', async (req, res) => {
  try {
    const { id } = req.params;
    const { ai_analysis, actor } = req.body;

    if (!ai_analysis) {
      return res.status(400).json({ success: false, error: '缺少 ai_analysis 欄位' });
    }

    // ── JSON Schema 驗證 ──
    const errors = [];

    if (ai_analysis.version !== '1.0') {
      errors.push('version 必須是 "1.0"');
    }
    if (!ai_analysis.analyzed_at) {
      errors.push('缺少 analyzed_at');
    }
    if (!ai_analysis.analyzed_by) {
      errors.push('缺少 analyzed_by');
    }
    if (!ai_analysis.candidate_evaluation) {
      errors.push('缺少 candidate_evaluation');
    } else {
      if (!ai_analysis.candidate_evaluation.career_curve) errors.push('缺少 candidate_evaluation.career_curve');
      if (!ai_analysis.candidate_evaluation.personality) errors.push('缺少 candidate_evaluation.personality');
      if (!ai_analysis.candidate_evaluation.role_positioning) errors.push('缺少 candidate_evaluation.role_positioning');
      if (!ai_analysis.candidate_evaluation.salary_estimate) errors.push('缺少 candidate_evaluation.salary_estimate');
    }
    if (!Array.isArray(ai_analysis.job_matchings)) {
      errors.push('job_matchings 必須是陣列');
    } else if (ai_analysis.job_matchings.length > 3) {
      errors.push('job_matchings 最多 3 個職缺');
    } else {
      ai_analysis.job_matchings.forEach((m, i) => {
        if (typeof m.match_score !== 'number' || m.match_score < 0 || m.match_score > 100) {
          errors.push(`job_matchings[${i}].match_score 必須是 0-100 的數字`);
        }
        if (Array.isArray(m.must_have)) {
          m.must_have.forEach((h, j) => {
            if (!['pass', 'warning', 'fail'].includes(h.result)) {
              errors.push(`job_matchings[${i}].must_have[${j}].result 只能是 pass/warning/fail`);
            }
          });
        }
        if (Array.isArray(m.nice_to_have)) {
          m.nice_to_have.forEach((h, j) => {
            if (!['pass', 'warning', 'fail'].includes(h.result)) {
              errors.push(`job_matchings[${i}].nice_to_have[${j}].result 只能是 pass/warning/fail`);
            }
          });
        }
      });
    }
    if (!ai_analysis.recommendation) {
      errors.push('缺少 recommendation');
    }

    if (errors.length > 0) {
      return res.status(400).json({ success: false, error: 'JSON 驗證失敗', details: errors });
    }

    // ── 寫入 DB ──
    const result = await pool.query(
      `UPDATE candidates_pipeline
       SET ai_analysis = $1::jsonb, updated_at = NOW()
       WHERE id = $2
       RETURNING id, name`,
      [JSON.stringify(ai_analysis), id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: '找不到此候選人' });
    }

    // 附加進度追蹤記錄
    const jobCount = ai_analysis.job_matchings ? ai_analysis.job_matchings.length : 0;
    const topScore = jobCount > 0 ? Math.max(...ai_analysis.job_matchings.map(m => m.match_score)) : 0;
    await pool.query(
      `UPDATE candidates_pipeline
       SET progress_tracking = COALESCE(progress_tracking, '[]'::jsonb) || $1::jsonb
       WHERE id = $2`,
      [JSON.stringify([{
        date: new Date().toISOString().slice(0, 10),
        event: '其他',
        by: actor || ai_analysis.analyzed_by || 'AI Agent',
        note: `AI 顧問分析完成：匹配 ${jobCount} 個職缺，最高分 ${topScore}`
      }]), id]
    );

    res.json({
      success: true,
      message: 'AI 分析結果已儲存',
      candidate_id: id,
      candidate_name: result.rows[0].name,
    });
  } catch (error) {
    safeError(res, error, 'PUT /ai-agent/candidates/:id/ai-analysis');
  }
});

// ══════════════════════════════════════════════
// PUT /candidates/:id/outreach-letter - 寫入開發信
// ══════════════════════════════════════════════

router.put('/candidates/:id/outreach-letter', async (req, res) => {
  try {
    const { id } = req.params;
    const { outreach_letter, actor } = req.body;

    if (!outreach_letter) {
      return res.status(400).json({ success: false, error: '缺少 outreach_letter 欄位' });
    }

    // 基本驗證
    if (!outreach_letter.job_id) {
      return res.status(400).json({ success: false, error: '缺少 job_id' });
    }
    if (!['linkedin', 'email', 'sms'].includes(outreach_letter.channel)) {
      return res.status(400).json({ success: false, error: 'channel 必須是 linkedin/email/sms' });
    }
    if (!outreach_letter.body) {
      return res.status(400).json({ success: false, error: '缺少 body（開發信內容）' });
    }

    // 從 jobs_pipeline 取職缺名和公司
    const jobRes = await pool.query(
      'SELECT position_name, client_company FROM jobs_pipeline WHERE id = $1',
      [outreach_letter.job_id]
    );

    const letter = {
      id: `ol_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      job_id: outreach_letter.job_id,
      job_title: jobRes.rows.length > 0 ? jobRes.rows[0].position_name : (outreach_letter.job_title || ''),
      company: jobRes.rows.length > 0 ? jobRes.rows[0].client_company : (outreach_letter.company || ''),
      channel: outreach_letter.channel,
      subject: outreach_letter.subject || null,
      body: outreach_letter.body,
      generated_at: new Date().toISOString(),
      generated_by: actor || 'AI Agent',
    };

    // Append 到陣列
    const result = await pool.query(
      `UPDATE candidates_pipeline
       SET outreach_letters = COALESCE(outreach_letters, '[]'::jsonb) || $1::jsonb,
           updated_at = NOW()
       WHERE id = $2
       RETURNING id, name`,
      [JSON.stringify([letter]), id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: '找不到此候選人' });
    }

    res.json({
      success: true,
      message: '開發信已儲存',
      candidate_id: id,
      letter_id: letter.id,
    });
  } catch (error) {
    safeError(res, error, 'PUT /ai-agent/candidates/:id/outreach-letter');
  }
});

module.exports = router;
