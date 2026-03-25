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
const { parseResumePDF } = require('./resumePDFService');
const { computeDataQuality } = require('./taxonomy/matchSkills');
const { isForeignName } = require('./foreignNameFilter');

// ══════════════════════════════════════════════
// 共用工具：AI Analysis Schema 驗證
// ══════════════════════════════════════════════
function validateAiAnalysisSchema(ai_analysis) {
  const errors = [];
  if (ai_analysis.version !== '1.0') errors.push('version 必須是 "1.0"');
  if (!ai_analysis.analyzed_at) errors.push('缺少 analyzed_at');
  if (!ai_analysis.analyzed_by) errors.push('缺少 analyzed_by');
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
  if (!ai_analysis.recommendation) errors.push('缺少 recommendation');

  // consultant_questions 為選填，但若有提供則驗證結構
  if (ai_analysis.consultant_questions) {
    const cq = ai_analysis.consultant_questions;
    if (!Array.isArray(cq.questions)) {
      errors.push('consultant_questions.questions 必須是陣列');
    } else {
      if (cq.questions.length < 5 || cq.questions.length > 15) {
        errors.push('consultant_questions.questions 建議 5-15 題');
      }
      const validCategories = [
        'career_motivation', 'current_satisfaction', 'technical_depth',
        'management_style', 'salary_expectation', 'culture_preference',
        'work_life_balance', 'long_term_goal', 'market_awareness',
        'collaboration_style', 'job_exploration'
      ];
      cq.questions.forEach((q, i) => {
        if (!q.question) errors.push(`consultant_questions.questions[${i}] 缺少 question`);
        if (!q.why_ask) errors.push(`consultant_questions.questions[${i}] 缺少 why_ask`);
        if (q.category && !validCategories.includes(q.category)) {
          errors.push(`consultant_questions.questions[${i}].category "${q.category}" 不在允許清單`);
        }
        // related_jobs 為選填，有的話檢查結構
        if (q.related_jobs && !Array.isArray(q.related_jobs)) {
          errors.push(`consultant_questions.questions[${i}].related_jobs 必須是陣列`);
        }
      });
    }
  }

  return errors;
}

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
      aiAnalysis: row.ai_analysis || null,
      existing_ai_analysis: row.ai_analysis || null,  // 向下相容，待移除

      // AI 匹配結果
      aiMatchResult: row.ai_match_result || null,

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

    // ── 硬性要求：必須有履歷附件才能寫入分析 ──
    const resumeCheck = await pool.query(
      'SELECT resume_files FROM candidates_pipeline WHERE id = $1', [id]
    );
    if (resumeCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: '找不到此候選人' });
    }
    const resumeFiles = resumeCheck.rows[0].resume_files || [];
    if (!Array.isArray(resumeFiles) || resumeFiles.length === 0) {
      return res.status(400).json({
        success: false,
        error: '此人選尚未上傳履歷 PDF，請先上傳履歷附件後再執行 AI 分析',
        hint: 'POST /api/candidates/:id/resume 上傳履歷'
      });
    }

    // ── JSON Schema 驗證（使用共用函數） ──
    const errors = validateAiAnalysisSchema(ai_analysis);
    if (errors.length > 0) {
      return res.status(400).json({ success: false, error: 'JSON 驗證失敗', details: errors });
    }

    // ── 寫入 DB ──
    const result = await pool.query(
      `UPDATE candidates_pipeline
       SET ai_analysis = $1::jsonb, updated_at = NOW()
       WHERE id = $2
       RETURNING id, name, ai_analysis IS NOT NULL AS write_confirmed`,
      [JSON.stringify(ai_analysis), id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: '找不到此候選人' });
    }

    // ── Write-back 驗證：確認資料確實寫入 ──
    if (!result.rows[0].write_confirmed) {
      console.error(`[ai-analysis] Write-back 驗證失敗：candidate ${id} ai_analysis 寫入後仍為 null`);
      return res.status(500).json({ success: false, error: 'AI 分析寫入驗證失敗，資料可能未儲存' });
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
      write_verified: true,
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

// ══════════════════════════════════════════════
// POST /candidates/import-complete - 原子匯入（建檔 + PDF + AI 分析一次完成）
// ══════════════════════════════════════════════

router.post('/candidates/import-complete', async (req, res) => {
  const client = await pool.connect();
  let stage = 'validation';

  try {
    const { candidate: c, resume_pdf, ai_analysis, actor, require_complete } = req.body;

    // ── ① 驗證 payload ──
    if (!c || !c.name || !c.name.trim()) {
      return res.status(400).json({ success: false, error: 'candidate.name 為必填', stage, candidate_written: false });
    }

    // 驗證 ai_analysis（如有提供）
    if (ai_analysis) {
      const schemaErrors = validateAiAnalysisSchema(ai_analysis);
      if (schemaErrors.length > 0) {
        return res.status(400).json({
          success: false, error: 'ai_analysis 驗證失敗', stage: 'ai_validation',
          details: schemaErrors, candidate_written: false,
        });
      }
    }

    // 驗證 resume_pdf base64（如有提供）
    let pdfBuffer = null;
    if (resume_pdf && resume_pdf.base64) {
      try {
        pdfBuffer = Buffer.from(resume_pdf.base64, 'base64');
        if (pdfBuffer.length < 100) throw new Error('PDF 資料太小，可能不是有效的 PDF');
      } catch (e) {
        return res.status(400).json({
          success: false, error: `PDF base64 解碼失敗：${e.message}`, stage: 'validation',
          candidate_written: false,
        });
      }
    }

    // require_complete 檢查
    if (require_complete) {
      const missing = [];
      if (!pdfBuffer) missing.push('resume_pdf');
      if (!c.target_job_id) missing.push('target_job_id');
      if (!c.talent_level) missing.push('talent_level');
      if (missing.length > 0) {
        return res.status(400).json({
          success: false, error: `require_complete=true 但缺少：${missing.join(', ')}`,
          stage: 'validation', missing_fields: missing, candidate_written: false,
        });
      }
    }

    // ── ③ 解析 PDF（在 transaction 之前，避免長時間鎖 DB） ──
    let parsed = null;
    if (pdfBuffer) {
      stage = 'resume_parse';
      try {
        parsed = await parseResumePDF(pdfBuffer, false, resume_pdf.format || 'auto');
      } catch (e) {
        return res.status(400).json({
          success: false, error: `PDF 解析失敗：${e.message}`, stage,
          candidate_written: false,
        });
      }
    }

    // ── BEGIN TRANSACTION ──
    await client.query('BEGIN');
    stage = 'dedup';

    // ── ② 去重：LinkedIn URL > Email > Name ──
    const nameKey = c.name.trim().toLowerCase();
    let existingId = null;
    let matchMethod = null;

    if (c.linkedin_url && c.linkedin_url.trim()) {
      const normalizedLi = c.linkedin_url.trim().toLowerCase()
        .replace('://www.', '://').replace(/\/+$/, '');
      if (normalizedLi.includes('linkedin.com')) {
        const r = await client.query(
          `SELECT id FROM candidates_pipeline
           WHERE LOWER(TRIM(REPLACE(REGEXP_REPLACE(linkedin_url, '/+$', ''), '://www.', '://'))) = $1
             AND linkedin_url IS NOT NULL AND linkedin_url <> '' LIMIT 1`,
          [normalizedLi]
        );
        if (r.rows.length > 0) { existingId = r.rows[0].id; matchMethod = 'linkedin_url'; }
      }
    }
    if (!existingId && c.email && c.email.trim() && c.email.includes('@')) {
      const r = await client.query(
        `SELECT id FROM candidates_pipeline WHERE LOWER(TRIM(email)) = $1 AND email IS NOT NULL AND email != '' LIMIT 1`,
        [c.email.trim().toLowerCase()]
      );
      if (r.rows.length > 0) { existingId = r.rows[0].id; matchMethod = 'email'; }
    }
    if (!existingId) {
      const r = await client.query(
        'SELECT id FROM candidates_pipeline WHERE LOWER(TRIM(name)) = $1 LIMIT 1', [nameKey]
      );
      if (r.rows.length > 0) { existingId = r.rows[0].id; matchMethod = 'name'; }
    }

    // ── ④ 合併欄位（明確傳入 > PDF 解析 > 既有 DB） ──
    stage = 'db_write';

    // 組合 resume_files entry
    let resumeFileEntry = null;
    if (pdfBuffer) {
      resumeFileEntry = {
        id: `rf_${Date.now()}`,
        filename: (resume_pdf.filename || `Resume_${c.name.trim()}.pdf`),
        data: resume_pdf.base64,
        mimetype: 'application/pdf',
        size: pdfBuffer.length,
        uploaded_at: new Date().toISOString(),
        uploaded_by: actor || 'Lobster',
      };
    }

    // 用 PDF 解析結果補充空欄位
    const skills = c.skills || (parsed && Array.isArray(parsed.skills) ? parsed.skills.join('、') : '') || '';
    const location = c.location || (parsed && parsed.location) || '';
    const yearsExp = c.years_experience || (parsed && parsed.years != null ? String(Math.round(parsed.years)) : '') || '';
    const workHistory = c.work_history || (parsed && parsed.workHistory?.length > 0 ? parsed.workHistory : null);
    const eduDetails = c.education_details || (parsed && parsed.educationJson?.length > 0 ? parsed.educationJson : null);
    const education = c.education || (parsed && parsed.education) || '';
    const currentPosition = c.current_position || (parsed && parsed.position) || '';
    const currentCompany = c.current_company || (parsed && parsed.currentCompany) || '';

    let result;
    let action;

    if (existingId) {
      // ── UPDATE existing ──
      action = 'updated';

      // 取得既有 resume_files 以 append
      const existingRow = await client.query(
        'SELECT resume_files FROM candidates_pipeline WHERE id = $1', [existingId]
      );
      const existingFiles = existingRow.rows[0]?.resume_files || [];
      const newFiles = resumeFileEntry && existingFiles.length < 3
        ? [...existingFiles, resumeFileEntry] : existingFiles;

      result = await client.query(
        `UPDATE candidates_pipeline SET
          phone = COALESCE(NULLIF(phone, ''), $1),
          location = COALESCE(NULLIF(location, ''), $2),
          current_position = COALESCE(NULLIF(current_position, ''), $3),
          current_company = COALESCE(NULLIF(current_company, ''), $4),
          years_experience = COALESCE(NULLIF(years_experience, ''), NULLIF(years_experience, '0'), $5),
          skills = COALESCE(NULLIF(skills, ''), $6),
          education = COALESCE(NULLIF(education, ''), $7),
          source = COALESCE(NULLIF(source, ''), $8),
          notes = CASE WHEN $9 = '' THEN notes ELSE CONCAT(notes, CASE WHEN notes != '' THEN E'\\n' ELSE '' END, $9) END,
          talent_level = CASE WHEN $10 != '' THEN $10 ELSE COALESCE(NULLIF(talent_level, ''), $10) END,
          email = COALESCE(NULLIF(email, ''), $11),
          linkedin_url = COALESCE(NULLIF(linkedin_url, ''), $12),
          github_url = COALESCE(NULLIF(github_url, ''), $13),
          ai_match_result = CASE WHEN $14::jsonb IS NOT NULL THEN $14::jsonb ELSE ai_match_result END,
          target_job_id = COALESCE($15::int, target_job_id),
          work_history = COALESCE($16::jsonb, work_history),
          education_details = COALESCE($17::jsonb, education_details),
          resume_files = $18::jsonb,
          ai_analysis = CASE WHEN $19::jsonb IS NOT NULL THEN $19::jsonb ELSE ai_analysis END,
          recruiter = COALESCE(NULLIF(recruiter, ''), NULLIF(recruiter, '待指派'), $20),
          updated_at = NOW()
        WHERE id = $21
        RETURNING id, name, resume_files IS NOT NULL AND resume_files != '[]'::jsonb AS has_resume,
                  ai_analysis IS NOT NULL AS has_ai_analysis, target_job_id, talent_level`,
        [
          c.phone || '', location, currentPosition, currentCompany,
          yearsExp, skills, education, c.source || '爬蟲匯入',
          c.notes || '', c.talent_level || '',
          c.email || '', c.linkedin_url || '', c.github_url || '',
          c.ai_match_result ? JSON.stringify(c.ai_match_result) : null,
          c.target_job_id || null,
          workHistory ? JSON.stringify(workHistory) : null,
          eduDetails ? JSON.stringify(eduDetails) : null,
          JSON.stringify(newFiles),
          ai_analysis ? JSON.stringify(ai_analysis) : null,
          c.recruiter || '待指派',
          existingId,
        ]
      );
    } else {
      // ── INSERT new ──
      action = 'created';
      const foreignFiltered = isForeignName(c.name.trim());
      const assignedStatus = foreignFiltered ? '外籍已過濾' : (c.status || '未開始');

      // Recruiter 白名單驗證
      const validUsersResult = await client.query("SELECT display_name FROM users WHERE is_active = true");
      const validNames = new Set(validUsersResult.rows.map(r => r.display_name));
      const validatedRecruiter = (c.recruiter && validNames.has(c.recruiter)) ? c.recruiter : '待指派';

      const resumeFilesJson = resumeFileEntry ? JSON.stringify([resumeFileEntry]) : null;

      result = await client.query(
        `INSERT INTO candidates_pipeline
         (name, phone, email, linkedin_url, github_url, location,
          current_position, current_company, years_experience,
          skills, education, source, status, recruiter, notes,
          talent_level, ai_match_result, target_job_id,
          work_history, education_details, resume_files, ai_analysis,
          created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,NOW(),NOW())
         RETURNING id, name, resume_files IS NOT NULL AND resume_files != '[]'::jsonb AS has_resume,
                   ai_analysis IS NOT NULL AS has_ai_analysis, target_job_id, talent_level`,
        [
          c.name.trim(), c.phone || '', c.email || '',
          c.linkedin_url || '', c.github_url || '', location,
          currentPosition, currentCompany, yearsExp,
          skills, education, c.source || '爬蟲匯入',
          assignedStatus, validatedRecruiter, c.notes || '',
          c.talent_level || '',
          c.ai_match_result ? JSON.stringify(c.ai_match_result) : null,
          c.target_job_id || null,
          workHistory ? JSON.stringify(workHistory) : null,
          eduDetails ? JSON.stringify(eduDetails) : null,
          resumeFilesJson,
          ai_analysis ? JSON.stringify(ai_analysis) : null,
        ]
      );
    }

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(500).json({ success: false, error: 'DB 寫入無回傳', stage, candidate_written: false });
    }

    const row = result.rows[0];

    // ── ⑦ Write-back 驗證 ──
    if (pdfBuffer && !row.has_resume) {
      await client.query('ROLLBACK');
      return res.status(500).json({
        success: false, error: 'Write-back 驗證失敗：PDF 已提供但 resume_files 為空',
        stage: 'write_verify', candidate_written: false,
      });
    }
    if (ai_analysis && !row.has_ai_analysis) {
      await client.query('ROLLBACK');
      return res.status(500).json({
        success: false, error: 'Write-back 驗證失敗：ai_analysis 已提供但寫入後為空',
        stage: 'write_verify', candidate_written: false,
      });
    }

    // ── ⑧ 寫 progress_tracking ──
    const progressNote = [
      `原子匯入${action === 'created' ? '建檔' : '更新'}`,
      pdfBuffer ? '✅ PDF' : '',
      ai_analysis ? '✅ AI分析' : '',
      c.target_job_id ? `✅ 職缺#${c.target_job_id}` : '',
      c.talent_level ? `✅ ${c.talent_level}級` : '',
    ].filter(Boolean).join('，');

    await client.query(
      `UPDATE candidates_pipeline
       SET progress_tracking = COALESCE(progress_tracking, '[]'::jsonb) || $1::jsonb
       WHERE id = $2`,
      [JSON.stringify([{
        date: new Date().toISOString().slice(0, 10),
        event: action === 'created' ? '新增' : '其他',
        by: actor || 'Lobster',
        note: progressNote,
      }]), row.id]
    );

    // ── COMMIT ──
    await client.query('COMMIT');

    // 計算完整度（transaction 外，不影響原子性）
    let completeness = {};
    try {
      const fullRow = await pool.query('SELECT * FROM candidates_pipeline WHERE id = $1', [row.id]);
      if (fullRow.rows.length > 0) {
        const dq = computeDataQuality(fullRow.rows[0]);
        completeness = {
          resume_uploaded: !!pdfBuffer,
          ai_analysis_written: !!ai_analysis,
          talent_level: row.talent_level || null,
          target_job_id: row.target_job_id || null,
          precision_score: dq.completenessScore,
          missing_core_fields: dq.missingCoreFields,
        };
      }
    } catch (_) { /* non-critical */ }

    // 寫操作日誌（transaction 外）
    try {
      await pool.query(
        `INSERT INTO system_logs (action, actor, actor_type, detail) VALUES ($1, $2, $3, $4)`,
        ['ATOMIC_IMPORT', actor || 'Lobster', 'AIBOT', JSON.stringify({
          candidate_id: row.id, action, matchMethod,
          has_resume: !!pdfBuffer, has_ai_analysis: !!ai_analysis,
        })]
      );
    } catch (_) { /* non-critical */ }

    res.status(action === 'created' ? 201 : 200).json({
      success: true,
      action,
      candidate_id: row.id,
      candidate_name: row.name,
      completeness,
      dedup: { matched_by: matchMethod, existing_id: existingId },
      write_verified: true,
    });

  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(`[import-complete] ROLLBACK at stage=${stage}:`, error.message);
    safeError(res, error, 'POST /ai-agent/candidates/import-complete');
  } finally {
    client.release();
  }
});

module.exports = router;
