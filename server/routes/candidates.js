/**
 * candidates.js - routes
 */
const express = require('express');
const router = express.Router();
const { pool } = require('../utils/db');
const { sanitizeId, writeLog, syncSQLToSheets } = require('../utils/helpers');

router.param('id', (req, _res, next, value) => {
  req.params.id = sanitizeId(value);
  next();
});

const githubAnalysis = require('../githubAnalysisService');
const { parseResumePDF } = require('../resumePDFService');

router.get('/candidates', async (req, res) => {
  try {
    const client = await pool.connect();

    // 支援查詢參數篩選
    const { status, limit, created_today, page, offset } = req.query;
    const conditions = [];
    const params = [];

    if (status) {
      params.push(status);
      conditions.push(`c.status = $${params.length}`);
    }
    if (created_today === 'true') {
      conditions.push(`DATE(c.created_at AT TIME ZONE 'Asia/Taipei') = DATE(NOW() AT TIME ZONE 'Asia/Taipei')`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limitVal = Math.min(Math.max(1, parseInt(limit) || 1000), 2000);

    // 分頁支援（向後相容：不傳 page/offset 則 offsetVal=0，行為與舊版完全相同）
    const offsetVal =
      offset !== undefined ? Math.max(0, parseInt(offset) || 0) :
      page   !== undefined ? (Math.max(1, parseInt(page) || 1) - 1) * limitVal :
      0;

    const result = await client.query(`
      SELECT
        c.id, c.name, c.contact_link, c.phone, c.email,
        c.linkedin_url, c.github_url, c.location, c.current_position,
        c.years_experience, c.job_changes, c.avg_tenure_months, c.recent_gap_months,
        c.skills, c.education, c.source, c.work_history, c.leaving_reason,
        c.stability_score, c.education_details, c.personality_type,
        c.status, c.recruiter, c.notes, c.talent_level, c.progress_tracking,
        c.created_at, c.updated_at, c.ai_match_result, c.target_job_id,
        j.position_name AS target_job_label, j.client_company AS target_job_company
      FROM candidates_pipeline c
      LEFT JOIN jobs_pipeline j ON j.id = c.target_job_id
      ${whereClause}
      ORDER BY c.id ASC
      LIMIT ${limitVal} OFFSET ${offsetVal}
    `, params);

    // 查總筆數（不影響現有資料，額外一次 COUNT query）
    const countResult = await client.query(
      `SELECT COUNT(*) FROM candidates_pipeline c ${whereClause}`,
      params
    );
    const totalCount = parseInt(countResult.rows[0].count);

    const candidates = result.rows.map(row => ({
      // 基本必需欄位（Candidate interface）
      id: row.id.toString(),
      name: row.name || '',
      email: row.email || '',
      phone: row.phone || '',
      location: row.location || '', // 數據庫沒有，使用空值
      position: row.current_position || '',
      years: (() => { const v = parseInt(row.years_experience); return (!isNaN(v) && v >= 0 && v <= 60) ? v : 0; })(),
      jobChanges: (() => { const v = parseInt(row.job_changes); return (!isNaN(v) && v >= 0 && v <= 30) ? v : 0; })(),
      avgTenure: (() => { const v = parseInt(row.avg_tenure_months); return (!isNaN(v) && v >= 0 && v <= 600) ? v : 0; })(),
      lastGap: (() => { const v = parseInt(row.recent_gap_months); return (!isNaN(v) && v >= 0 && v <= 600) ? v : 0; })(),
      skills: row.skills || '',
      education: row.education || '',
      source: row.source || '其他', // CandidateSource enum
      status: row.status || '未開始', // CandidateStatus enum
      consultant: row.recruiter || 'Jacky',
      notes: row.notes || '',
      stabilityScore: isNaN(parseInt(row.stability_score)) ? 0 : parseInt(row.stability_score),
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
      createdBy: 'system',
      
      // 可選欄位（詳細資訊）
      linkedinUrl: row.linkedin_url || '',
      githubUrl: row.github_url || '',
      resumeLink: row.contact_link || '',
      workHistory: (() => { const v = row.work_history; if (!v) return []; if (Array.isArray(v)) return v; if (typeof v === 'string') { try { const p = JSON.parse(v); if (Array.isArray(p)) return p; } catch {} } return []; })(),
      quitReasons: row.leaving_reason || '',
      educationJson: (() => { const v = row.education_details; if (!v) return []; if (Array.isArray(v)) return v; if (typeof v === 'string') { try { const p = JSON.parse(v); if (Array.isArray(p)) return p; } catch {} } return []; })(),
      discProfile: row.personality_type || '',
      progressTracking: row.progress_tracking || [],
      aiMatchResult: row.ai_match_result ? (() => {
        // 支援新舊格式，直接傳遞完整的 ai_match_result 物件
        const am = row.ai_match_result;
        // 確保陣列欄位始終是陣列（AI Bot 有時會寫入字串）
        const toArr = (v) => Array.isArray(v) ? v : (typeof v === 'string' && v.trim() ? v.split(/[,、\n]+/).map(s => s.trim()).filter(Boolean) : []);
        return {
          score: am.score || 0,
          grade: am.grade || 'B',
          recommendation: am.recommendation || (am.grade === 'A+' ? '強力推薦' : am.grade === 'A' ? '推薦' : am.grade === 'B' ? '觀望' : '不推薦'),
          job_title: am.job_title || am.position || '',
          company: am.company || '',
          matched_skills: toArr(am.matched_skills || am.strengths),
          missing_skills: toArr(am.missing_skills || am.to_confirm),
          strengths: toArr(am.strengths),
          probing_questions: toArr(am.probing_questions),
          salary_fit: am.salary_fit || '',
          conclusion: am.conclusion || '',
          suggestion: am.suggestion || '',
          evaluated_by: am.evaluated_by || 'AIBot',
          evaluated_at: am.evaluated_at || am.date || new Date().toISOString(),
          github_url: am.github_url || ''
        };
      })() : null,
      
      // 向後相容：保留 DB 字段名
      contact_link: row.contact_link || '',
      current_position: row.current_position || '',
      years_experience: row.years_experience || '',
      job_changes: row.job_changes || '',
      avg_tenure_months: row.avg_tenure_months || '',
      recent_gap_months: row.recent_gap_months || '',
      work_history: (() => { const v = row.work_history; if (!v) return []; if (Array.isArray(v)) return v; if (typeof v === 'string') { try { const p = JSON.parse(v); if (Array.isArray(p)) return p; } catch {} } return []; })(),
      leaving_reason: row.leaving_reason || '',
      stability_score: row.stability_score || '',
      education_details: (() => { const v = row.education_details; if (!v) return []; if (Array.isArray(v)) return v; if (typeof v === 'string') { try { const p = JSON.parse(v); if (Array.isArray(p)) return p; } catch {} } return []; })(),
      personality_type: row.personality_type || '',
      recruiter: row.recruiter || 'Jacky',
      talent_level: row.talent_level || '',
      targetJobId: row.target_job_id || null,
      targetJobLabel: row.target_job_label
        ? `${row.target_job_label}${row.target_job_company ? ` (${row.target_job_company})` : ''}`
        : null,
    }));

    client.release();

    res.json({
      success: true,
      data: candidates,
      count: candidates.length,
      total: totalCount,                                              // 全部總筆數（含 filter）
      page: Math.floor(offsetVal / limitVal) + 1,                   // 目前頁碼（從 1 開始）
      hasMore: offsetVal + candidates.length < totalCount,           // 是否還有更多資料
    });
  } catch (error) {
    console.error('❌ GET /candidates error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/candidates/:id
 * 獲取單一候選人
 */
router.get('/candidates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!/^\d+$/.test(id)) {
      return res.status(404).json({ success: false, error: 'Candidate not found' });
    }
    const client = await pool.connect();
    
    const result = await client.query(
      `SELECT c.*, j.position_name AS target_job_label, j.client_company AS target_job_company
       FROM candidates_pipeline c
       LEFT JOIN jobs_pipeline j ON j.id = c.target_job_id
       WHERE c.id = $1`,
      [id]
    );

    client.release();

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Candidate not found'
      });
    }

    const row = result.rows[0];
    const candidate = {
      id: row.id.toString(),
      name: row.name || '',
      email: row.email || '',
      phone: row.phone || '',
      location: row.location || '',
      position: row.current_position || '',
      years: parseInt(row.years_experience) || 0,
      jobChanges: parseInt(row.job_changes) || 0,
      avgTenure: parseInt(row.avg_tenure_months) || 0,
      lastGap: parseInt(row.recent_gap_months) || 0,
      skills: row.skills || '',
      education: row.education || '',
      source: row.source || '',
      status: row.status || '',
      consultant: row.recruiter || '',
      notes: row.notes || '',
      stabilityScore: parseInt(row.stability_score) || 0,
      linkedinUrl: row.linkedin_url || '',
      githubUrl: row.github_url || '',
      resumeLink: row.contact_link || '',
      targetJobId: row.target_job_id || null,
      targetJobLabel: row.target_job_label
        ? `${row.target_job_label}${row.target_job_company ? ` (${row.target_job_company})` : ''}`
        : null,
      aiMatchResult: row.ai_match_result ? (() => {
        // 支援新舊格式，直接傳遞完整的 ai_match_result 物件
        const am = row.ai_match_result;
        // 確保陣列欄位始終是陣列（AI Bot 有時會寫入字串）
        const toArr = (v) => Array.isArray(v) ? v : (typeof v === 'string' && v.trim() ? v.split(/[,、\n]+/).map(s => s.trim()).filter(Boolean) : []);
        return {
          score: am.score || 0,
          grade: am.grade || 'B',
          recommendation: am.recommendation || (am.grade === 'A+' ? '強力推薦' : am.grade === 'A' ? '推薦' : am.grade === 'B' ? '觀望' : '不推薦'),
          job_title: am.job_title || am.position || '',
          company: am.company || '',
          matched_skills: toArr(am.matched_skills || am.strengths),
          missing_skills: toArr(am.missing_skills || am.to_confirm),
          strengths: toArr(am.strengths),
          probing_questions: toArr(am.probing_questions),
          salary_fit: am.salary_fit || '',
          conclusion: am.conclusion || '',
          suggestion: am.suggestion || '',
          evaluated_by: am.evaluated_by || 'AIBot',
          evaluated_at: am.evaluated_at || am.date || new Date().toISOString(),
          github_url: am.github_url || ''
        };
      })() : null,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
    };

    res.json({
      success: true,
      data: candidate
    });
  } catch (error) {
    console.error('❌ GET /candidates/:id error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/candidates/:id
 * 更新候選人狀態
 */
router.put('/candidates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!/^\d+$/.test(id)) {
      return res.status(404).json({ success: false, error: 'Candidate not found' });
    }
    const { status, notes, consultant, name, progressTracking, aiMatchResult } = req.body;

    const client = await pool.connect();

    // 支援 aiMatchResult 或 ai_match_result
    const matchResult = aiMatchResult || req.body.ai_match_result || null;

    // 如果沒有傳遞 status，保留原本值；否則使用傳遞的值
    const hasStatus = status !== undefined && status !== null;
    const statusValue = hasStatus ? status : undefined;

    const result = await client.query(
      hasStatus
        ? `UPDATE candidates_pipeline
           SET status = $1, notes = $2, recruiter = $3,
               progress_tracking = $4, ai_match_result = $5, updated_at = NOW()
           WHERE id = $6
           RETURNING *`
        : `UPDATE candidates_pipeline
           SET notes = $1, recruiter = $2,
               progress_tracking = $3, ai_match_result = $4, updated_at = NOW()
           WHERE id = $5
           RETURNING *`,
      hasStatus
        ? [status, notes || '', consultant || '',
           JSON.stringify(progressTracking || []), 
           matchResult ? JSON.stringify(matchResult) : null,
           id]
        : [notes || '', consultant || '',
           JSON.stringify(progressTracking || []), 
           matchResult ? JSON.stringify(matchResult) : null,
           id]
    );

    client.release();

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Candidate not found'
      });
    }

    // 寫入操作日誌
    const actor = consultant || 'system';
    writeLog({
      action: 'PIPELINE_CHANGE',
      actor,
      candidateId: parseInt(id),
      candidateName: result.rows[0].name,
      detail: { status, notes: notes?.substring(0, 100), aiMatchResult: matchResult ? '已更新' : undefined }
    });

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Candidate updated successfully'
    });
  } catch (error) {
    console.error('❌ PUT /candidates/:id error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 從 AIbot 寫入的評分備註文字，自動解析並構建 ai_match_result 結構
 * 支援格式：【xxx評分】86/100 分 ... 6維度評分: ...
 */
function parseNotesToAiMatchResult(notesText, actor) {
  if (!notesText || typeof notesText !== 'string') return null;
  // 只處理含「評分」+ 分數的備註
  if (!/評分.*\d+\/100|\d+\/100.*評分/.test(notesText)) return null;

  try {
    // 提取整體分數
    const scoreMatch = notesText.match(/(\d+)\/100/);
    if (!scoreMatch) return null;
    const score = parseInt(scoreMatch[1]);

    // 推薦等級
    const recommendation =
      score >= 85 ? '強力推薦' :
      score >= 70 ? '推薦' :
      score >= 55 ? '觀望' : '不推薦';

    // 對應職缺（從備註內的「職位:」或「職缺:」取得）
    const jobTitleMatch = notesText.match(/職位[：:]\s*(.+)/);
    const job_title = jobTitleMatch ? jobTitleMatch[1].trim() : undefined;

    // 技能列表
    const skillsMatch = notesText.match(/技能[：:]\s*(.+)/);
    const skillsRaw = skillsMatch ? skillsMatch[1].split(/[,，、]/).map(s => s.trim()).filter(Boolean) : [];

    // 6 維度分數 → 推算 matched/missing
    const dimScores = {};
    const dimRegex = /([^:：\n]{2,8})\s*\(\d+%\)[：:]\s*(\d+)\/(\d+)/g;
    let m;
    while ((m = dimRegex.exec(notesText)) !== null) {
      const ratio = parseInt(m[2]) / parseInt(m[3]);
      dimScores[m[1].trim()] = ratio;
    }

    // 技能匹配維度分數
    const skillMatchRatio = dimScores['技能匹配'] || dimScores['技能'] || 0;
    const matched_skills = skillMatchRatio >= 0.6 ? skillsRaw : skillsRaw.slice(0, Math.ceil(skillsRaw.length * skillMatchRatio));
    const missing_skills = skillMatchRatio < 1.0 && skillsRaw.length > matched_skills.length
      ? skillsRaw.slice(matched_skills.length)
      : [];

    // 構建優勢
    const strengths = Object.entries(dimScores)
      .filter(([, ratio]) => ratio >= 0.8)
      .map(([dim, ratio]) => `${dim}符合度高（${Math.round(ratio * 100)}%）`);
    if (strengths.length === 0 && score >= 70) strengths.push('整體評分良好，具備基本條件');

    // 建議顧問詢問問題（依弱項動態生成）
    const probing_questions = [];
    if ((dimScores['技能匹配'] || 1) < 0.8) probing_questions.push('目前使用的主要技術棧為何？是否有學習相關技能的計劃？');
    if ((dimScores['職場信號'] || dimScores['招聘意願'] || 1) < 0.9) probing_questions.push('目前求職狀態如何？是否已在面試其他機會？');
    probing_questions.push('期望薪資範圍與到職時間？');
    probing_questions.push('離開現職的主要考量為何？');

    // 從備註取得 LinkedIn
    const liMatch = notesText.match(/LinkedIn[：:\s]+(https?:\/\/\S+)/i);

    return {
      score,
      recommendation,
      job_title,
      matched_skills,
      missing_skills,
      strengths,
      probing_questions,
      conclusion: notesText.replace(/LinkedIn[：:\s]+https?:\/\/\S+/gi, '').trim(),
      evaluated_at: new Date().toISOString(),
      evaluated_by: actor || 'AIbot',
      _linkedin_url: liMatch ? liMatch[1] : null,  // 內部用，供 PATCH 一起更新
    };
  } catch (e) {
    return null;
  }
}

/**
 * PATCH /api/candidates/:id
 * 局部更新候選人（支援欄位：status, progressTracking, recruiter, notes, talent_level, name）
 * 適用於前端操作及 AIbot 呼叫
 */
router.patch('/candidates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!/^\d+$/.test(id)) {
      return res.status(404).json({ success: false, error: 'Candidate not found' });
    }
    const { status, progressTracking, recruiter, talent_level, name,
            stability_score, linkedin_url, github_url, ai_match_result } = req.body;
    // 支援 notes 與 remarks 兩種欄位名稱（AIbot 相容性）
    const notes = req.body.notes !== undefined ? req.body.notes : req.body.remarks;
    const email = req.body.email;
    // 人工編輯欄位
    const phone = req.body.phone;
    const location = req.body.location;
    const position = req.body.position !== undefined ? req.body.position : req.body.current_position;
    const years = req.body.years !== undefined ? req.body.years : req.body.years_experience;
    const skills = req.body.skills;
    const education = req.body.education;
    const work_history = req.body.work_history;
    const education_details = req.body.education_details;
    const target_job_id = req.body.target_job_id !== undefined ? req.body.target_job_id : undefined;
    const actor = req.body.actor || req.body.by || '';
    const isAIBot = /aibot|bot$|openclaw|yuqi|ai$/i.test(actor);

    const client = await pool.connect();

    // 任何人更新 status 時（未同時傳入 progressTracking），預先抓目前的 progress_tracking 以自動附加紀錄
    // 防護：不管是 AIBot 還是顧問或外部系統，只改 status 不補 progressTracking 會導致卡片不移動
    let existingProgressForStatus = null;
    if (status !== undefined && progressTracking === undefined) {
      const pData = await client.query(
        'SELECT progress_tracking FROM candidates_pipeline WHERE id = $1', [id]
      );
      existingProgressForStatus = pData.rows[0]?.progress_tracking || [];
    }

    const setClauses = [];
    const values = [];
    let idx = 1;

    if (status !== undefined) {
      setClauses.push(`status = $${idx++}`);
      values.push(status);
    }
    if (progressTracking !== undefined) {
      setClauses.push(`progress_tracking = $${idx++}`);
      values.push(JSON.stringify(progressTracking));
    }
    if (recruiter !== undefined) {
      setClauses.push(`recruiter = $${idx++}`);
      values.push(recruiter);
    }
    if (notes !== undefined) {
      setClauses.push(`notes = $${idx++}`);
      values.push(notes);
    }
    if (talent_level !== undefined) {
      setClauses.push(`talent_level = $${idx++}`);
      values.push(talent_level);
    }
    if (name !== undefined) {
      setClauses.push(`name = $${idx++}`);
      values.push(name);
    }
    if (stability_score !== undefined) {
      setClauses.push(`stability_score = $${idx++}`);
      values.push(String(stability_score));
    }
    if (linkedin_url !== undefined) {
      setClauses.push(`linkedin_url = $${idx++}`);
      values.push(linkedin_url);
    }
    if (github_url !== undefined) {
      setClauses.push(`github_url = $${idx++}`);
      values.push(github_url);
    }
    if (email !== undefined) {
      setClauses.push(`email = $${idx++}`);
      values.push(email);
    }
    if (phone !== undefined) {
      setClauses.push(`phone = $${idx++}`);
      values.push(phone);
    }
    if (location !== undefined) {
      setClauses.push(`location = $${idx++}`);
      values.push(location);
    }
    if (position !== undefined) {
      setClauses.push(`current_position = $${idx++}`);
      values.push(position);
    }
    if (years !== undefined) {
      setClauses.push(`years_experience = $${idx++}`);
      values.push(String(years));
    }
    if (skills !== undefined) {
      setClauses.push(`skills = $${idx++}`);
      values.push(Array.isArray(skills) ? skills.join('、') : skills);
    }
    if (education !== undefined) {
      setClauses.push(`education = $${idx++}`);
      values.push(education);
    }
    if (work_history !== undefined) {
      setClauses.push(`work_history = $${idx++}`);
      values.push(JSON.stringify(work_history));
    }
    if (education_details !== undefined) {
      setClauses.push(`education_details = $${idx++}`);
      values.push(JSON.stringify(education_details));
    }
    if (target_job_id !== undefined) {
      setClauses.push(`target_job_id = $${idx++}`);
      values.push(target_job_id === null ? null : Number(target_job_id));
    }
    // 優先使用顯式傳入的 ai_match_result；若未傳但 AIBot 寫了評分備註，自動解析
    let resolvedAiMatch = ai_match_result;

    // 若 ai_match_result 是字串（AI 寫成純文字），自動轉為結構化 JSON
    if (typeof resolvedAiMatch === 'string' && resolvedAiMatch.trim()) {
      const text = resolvedAiMatch.trim();
      const scoreMatch = text.match(/AI評分\s*(\d+)\s*分/);
      const levelMatch = text.match(/(\d+)\s*分\s*[\/／]\s*([SA+ABCS]+)/);
      const jobMatch = text.match(/配對職位[：:]\s*(.+?)(?:（|$)/);
      const score = scoreMatch ? parseInt(scoreMatch[1]) : (stability_score || 0);
      const level = levelMatch ? levelMatch[2] : (talent_level || '');
      const recommendation = score >= 85 ? '強力推薦' : score >= 70 ? '推薦' : score >= 55 ? '觀望' : '不推薦';

      // 提取優勢列表
      const strengthsMatch = text.match(/優勢[：:]?\s*\n([\s\S]+?)(?=⚠️|待確認|💡|$)/);
      const strengths = strengthsMatch
        ? strengthsMatch[1].split('\n').map(l => l.replace(/^[-•*]\s*/, '').trim()).filter(Boolean)
        : [];

      // 提取待確認列表
      const pendingMatch = text.match(/待確認[：:]?\s*\n([\s\S]+?)(?=💡|顧問建議|$)/);
      const pending = pendingMatch
        ? pendingMatch[1].split('\n').map(l => l.replace(/^[-•*]\s*/, '').trim()).filter(Boolean)
        : [];

      // 提取顧問建議
      const conclusionMatch = text.match(/顧問建議[：:]\s*([\s\S]+?)(?:\n---|\s*$)/);
      const conclusion = conclusionMatch ? conclusionMatch[1].trim() : text;

      resolvedAiMatch = {
        score,
        recommendation,
        job_title: jobMatch ? jobMatch[1].trim() : undefined,
        matched_skills: [],
        missing_skills: pending.slice(0, 3),
        strengths,
        probing_questions: pending,
        conclusion,
        evaluated_at: new Date().toISOString(),
        evaluated_by: actor || 'AIbot',
      };
    }

    if (resolvedAiMatch === undefined && isAIBot && notes) {
      const parsed = parseNotesToAiMatchResult(notes, actor);
      if (parsed) {
        resolvedAiMatch = parsed;
        // 若備註裡有 LinkedIn URL 且 linkedin_url 未被顯式設定，一起更新
        if (parsed._linkedin_url && linkedin_url === undefined) {
          setClauses.push(`linkedin_url = $${idx++}`);
          values.push(parsed._linkedin_url);
        }
        delete parsed._linkedin_url;
      }
    }
    if (resolvedAiMatch !== undefined) {
      setClauses.push(`ai_match_result = $${idx++}`);
      values.push(JSON.stringify(resolvedAiMatch));
    }

    // 自動附加 progressTracking 條目（任何 status 更新都觸發，讓卡片欄位正確移動）
    if (existingProgressForStatus !== null) {
      const today = new Date().toISOString().split('T')[0];
      const autoEntry = {
        date: today,
        event: status,
        by: actor || 'system',
        ...(resolvedAiMatch?.score != null ? { note: `AI評分 ${resolvedAiMatch.score}分` } : {}),
      };
      setClauses.push(`progress_tracking = $${idx++}`);
      values.push(JSON.stringify([...existingProgressForStatus, autoEntry]));
    }

    if (setClauses.length === 0) {
      client.release();
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    setClauses.push(`updated_at = NOW()`);
    values.push(id);

    const result = await client.query(
      `UPDATE candidates_pipeline SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    client.release();

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Candidate not found' });
    }

    // 寫入操作日誌
    writeLog({
      action: 'UPDATE',
      actor: req.body.actor || req.body.recruiter || 'system',
      candidateId: parseInt(id),
      candidateName: result.rows[0].name,
      detail: { fields: Object.keys(req.body).filter(k => k !== 'actor') }
    });

    res.json({ success: true, data: result.rows[0], message: 'Candidate patched successfully' });
  } catch (error) {
    console.error('❌ PATCH /candidates/:id error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/candidates/:id/pipeline-status
 * 專用端點：更新候選人 Pipeline 階段狀態
 * 給 AIbot 及外部系統使用
 *
 * Body: {
 *   status: '未開始' | '已聯繫' | '已面試' | 'Offer' | '已上職' | '婉拒' | '其他',
 *   by: '操作者名稱（顧問名或 AIbot）'
 * }
 */
router.put('/candidates/:id/pipeline-status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, by } = req.body;

    const validStatuses = ['未開始', 'AI推薦', '已聯繫', '已面試', 'Offer', '已上職', '婉拒', '備選人才', '其他'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const client = await pool.connect();

    // 取得目前候選人資料
    const current = await client.query(
      'SELECT * FROM candidates_pipeline WHERE id = $1',
      [id]
    );

    if (current.rows.length === 0) {
      client.release();
      return res.status(404).json({ success: false, error: 'Candidate not found' });
    }

    const candidate = current.rows[0];
    const currentProgress = candidate.progress_tracking || [];

    // 新增進度事件
    const newEvent = {
      date: new Date().toISOString().split('T')[0],
      event: status,
      by: by || 'AIbot'
    };
    const updatedProgress = [...currentProgress, newEvent];

    const result = await client.query(
      `UPDATE candidates_pipeline
       SET status = $1, progress_tracking = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [status, JSON.stringify(updatedProgress), id]
    );

    client.release();

    // 寫入操作日誌
    writeLog({
      action: 'PIPELINE_CHANGE',
      actor: by || 'AIbot',
      candidateId: parseInt(id),
      candidateName: candidate.name,
      detail: { from: candidate.status, to: status }
    });

    res.json({
      success: true,
      data: result.rows[0],
      message: `Pipeline 狀態已更新為「${status}」`
    });
  } catch (error) {
    console.error('❌ PUT /candidates/:id/pipeline-status error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/candidates/batch-status
 * 批量更新多位候選人的 Pipeline 狀態（AIbot 批量操作專用）
 *
 * Body：
 * {
 *   "ids": [123, 124, 125],          // 候選人 ID 陣列
 *   "status": "已面試",               // 目標狀態
 *   "actor": "Jacky-aibot",           // 操作者（可選，預設 AIbot）
 *   "note": "批量完成初篩面試"         // 備註（可選，附加到進度記錄）
 * }
 */
router.patch('/candidates/batch-status', async (req, res) => {
  try {
    const { ids, status, actor, note } = req.body;

    const validStatuses = ['未開始', 'AI推薦', '已聯繫', '已面試', 'Offer', '已上職', '婉拒', '備選人才', '其他'];

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: '缺少 ids 陣列' });
    }
    if (ids.length > 200) {
      return res.status(400).json({ success: false, error: '單次最多 200 筆' });
    }
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `無效狀態，必須為：${validStatuses.join('、')}`
      });
    }

    const operator = actor || 'AIbot';
    const today = new Date().toISOString().split('T')[0];
    const succeeded = [];
    const failed = [];

    for (const id of ids) {
      const client = await pool.connect();
      try {
        const current = await client.query(
          'SELECT id, name, status, progress_tracking FROM candidates_pipeline WHERE id = $1',
          [id]
        );

        if (current.rows.length === 0) {
          failed.push({ id, reason: '找不到此候選人' });
          client.release();
          continue;
        }

        const candidate = current.rows[0];
        const currentProgress = candidate.progress_tracking || [];
        const newEvent = {
          date: today,
          event: status,
          by: operator,
          ...(note ? { note } : {})
        };
        const updatedProgress = [...currentProgress, newEvent];

        await client.query(
          `UPDATE candidates_pipeline
           SET status = $1, progress_tracking = $2, updated_at = NOW()
           WHERE id = $3`,
          [status, JSON.stringify(updatedProgress), id]
        );

        writeLog({
          action: 'PIPELINE_CHANGE',
          actor: operator,
          candidateId: parseInt(id),
          candidateName: candidate.name,
          detail: { from: candidate.status, to: status, batch: true }
        });

        succeeded.push({ id: candidate.id, name: candidate.name });
      } catch (err) {
        failed.push({ id, reason: err.message });
      } finally {
        client.release();
      }
    }

    res.json({
      success: true,
      status,
      succeeded_count: succeeded.length,
      failed_count: failed.length,
      total: ids.length,
      succeeded,
      failed,
      message: `批量更新完成：${succeeded.length} 位成功，${failed.length} 位失敗`
    });
  } catch (error) {
    console.error('❌ PATCH /candidates/batch-status error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/candidates/batch
 * 批量刪除多位候選人（AIbot 批量操作專用）
 *
 * Body：
 * {
 *   "ids": [123, 124, 125],   // 候選人 ID 陣列（最多 200 筆）
 *   "actor": "Jacky-aibot"    // 操作者（必填，用於日誌）
 * }
 *
 * ⚠️ 此操作不可逆，請確認後再執行
 */
router.delete('/candidates/batch', async (req, res) => {
  try {
    const { ids, actor } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'ids 必須為非空陣列' });
    }
    if (ids.length > 200) {
      return res.status(400).json({ success: false, error: '單次最多刪除 200 筆' });
    }
    if (!actor) {
      return res.status(400).json({ success: false, error: 'actor 必填' });
    }

    const client = await pool.connect();
    const succeeded = [];
    const failed = [];

    for (const id of ids) {
      try {
        const result = await client.query(
          'DELETE FROM candidates_pipeline WHERE id = $1 RETURNING id, name',
          [id]
        );
        if (result.rows.length > 0) {
          succeeded.push({ id, name: result.rows[0].name });
          writeLog({
            action: 'DELETE',
            actor,
            candidateId: parseInt(id),
            candidateName: result.rows[0].name,
            detail: { batch: true }
          });
        } else {
          failed.push({ id, reason: '找不到此候選人' });
        }
      } catch (err) {
        failed.push({ id, reason: err.message });
      }
    }

    client.release();

    res.json({
      success: true,
      deleted_count: succeeded.length,
      failed_count: failed.length,
      deleted: succeeded,
      failed,
      message: `批量刪除完成：${succeeded.length} 位成功，${failed.length} 位失敗`
    });
  } catch (error) {
    console.error('❌ DELETE /candidates/batch error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/candidates/:id
 * 刪除單一候選人
 *
 * Body：{ "actor": "Jacky-aibot" }  // 操作者（建議填入，用於日誌）
 *
 * ⚠️ 此操作不可逆
 */
router.delete('/candidates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!/^\d+$/.test(id)) {
      return res.status(404).json({ success: false, error: 'Candidate not found' });
    }
    const { actor } = req.body || {};

    const client = await pool.connect();

    const result = await client.query(
      'DELETE FROM candidates_pipeline WHERE id = $1 RETURNING id, name',
      [id]
    );

    client.release();

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: `找不到候選人 ID ${id}` });
    }

    writeLog({
      action: 'DELETE',
      actor: actor || 'system',
      candidateId: parseInt(id),
      candidateName: result.rows[0].name,
      detail: { batch: false }
    });

    res.json({
      success: true,
      deleted: { id: result.rows[0].id, name: result.rows[0].name },
      message: `候選人「${result.rows[0].name}」已刪除`
    });
  } catch (error) {
    console.error('❌ DELETE /candidates/:id error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/candidates
 * 智慧匯入單一候選人（單一入口 → SQL → Sheets）
 * - 已存在：只補充空欄位
 * - 不存在：建立新紀錄
 */
router.post('/candidates', async (req, res) => {
  try {
    const c = req.body;

    if (!c.name) {
      return res.status(400).json({
        success: false,
        error: 'Name is required'
      });
    }

    const client = await pool.connect();
    const nameKey = c.name.trim().toLowerCase();

    // 檢查是否已存在
    const existing = await client.query(
      'SELECT id FROM candidates_pipeline WHERE LOWER(TRIM(name)) = $1 LIMIT 1',
      [nameKey]
    );

    let result;
    let action;

    if (existing.rows.length > 0) {
      // 既有人選 → 只補充空欄位
      action = 'updated';
      result = await client.query(
        `UPDATE candidates_pipeline SET
          phone = COALESCE(NULLIF(phone, ''), $1),
          contact_link = COALESCE(NULLIF(contact_link, ''), $2),
          location = COALESCE(NULLIF(location, ''), $3),
          current_position = COALESCE(NULLIF(current_position, ''), $4),
          years_experience = COALESCE(NULLIF(years_experience, ''), NULLIF(years_experience, '0'), $5),
          skills = COALESCE(NULLIF(skills, ''), $6),
          education = COALESCE(NULLIF(education, ''), $7),
          source = COALESCE(NULLIF(source, ''), $8),
          notes = CASE WHEN $9 = '' THEN notes ELSE CONCAT(notes, CASE WHEN notes != '' THEN E'\n' ELSE '' END, $9) END,
          stability_score = COALESCE(NULLIF(stability_score, ''), NULLIF(stability_score, '0'), $10),
          personality_type = COALESCE(NULLIF(personality_type, ''), $11),
          job_changes = COALESCE(NULLIF(job_changes, ''), NULLIF(job_changes, '0'), $12),
          avg_tenure_months = COALESCE(NULLIF(avg_tenure_months, ''), NULLIF(avg_tenure_months, '0'), $13),
          recent_gap_months = COALESCE(NULLIF(recent_gap_months, ''), NULLIF(recent_gap_months, '0'), $14),
          work_history = COALESCE(work_history, $15),
          education_details = COALESCE(education_details, $16),
          leaving_reason = COALESCE(NULLIF(leaving_reason, ''), $17),
          talent_level = COALESCE(NULLIF(talent_level, ''), $18),
          email = COALESCE(NULLIF(email, ''), $19),
          linkedin_url = COALESCE(NULLIF(linkedin_url, ''), $20),
          github_url = COALESCE(NULLIF(github_url, ''), $21),
          ai_match_result = CASE WHEN $22::jsonb IS NOT NULL THEN $22::jsonb ELSE ai_match_result END,
          updated_at = NOW()
        WHERE id = $23
        RETURNING id, name, contact_link, current_position, status`,
        [
          c.phone || '', c.contact_link || '', c.location || '',
          c.current_position || '', String(c.years_experience || ''),
          c.skills || '', c.education || '', c.source || '',
          c.notes || '', String(c.stability_score || ''),
          c.personality_type || '', String(c.job_changes || ''),
          String(c.avg_tenure_months || ''), String(c.recent_gap_months || ''),
          c.work_history ? JSON.stringify(c.work_history) : null,
          c.education_details ? JSON.stringify(c.education_details) : null,
          c.leaving_reason || '', c.talent_level || '',
          c.email || '', c.linkedin_url || '', c.github_url || '',
          (c.ai_match_result && typeof c.ai_match_result === 'object') ? JSON.stringify(c.ai_match_result) : null,
          existing.rows[0].id
        ]
      );
    } else {
      // 新人選 → 建立
      action = 'created';
      result = await client.query(
        `INSERT INTO candidates_pipeline
         (name, phone, email, linkedin_url, github_url, contact_link,
          location, current_position, years_experience,
          skills, education, source, status, recruiter, notes,
          stability_score, personality_type, job_changes, avg_tenure_months,
          recent_gap_months, work_history, education_details, leaving_reason,
          talent_level, ai_match_result, target_job_id, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,NOW(),NOW())
         RETURNING id, name, contact_link, current_position, status`,
        [
          c.name.trim(), c.phone || '', c.email || '',
          c.linkedin_url || '', c.github_url || '', c.contact_link || '',
          c.location || '', c.current_position || '', String(c.years_experience || '0'),
          c.skills || '', c.education || '', c.source || 'GitHub',
          c.status || '未開始', c.recruiter || 'Jacky', c.notes || '',
          String(c.stability_score || '0'), c.personality_type || '',
          String(c.job_changes || '0'), String(c.avg_tenure_months || '0'),
          String(c.recent_gap_months || '0'),
          c.work_history ? JSON.stringify(c.work_history) : null,
          c.education_details ? JSON.stringify(c.education_details) : null,
          c.leaving_reason || '', c.talent_level || '',
          (c.ai_match_result && typeof c.ai_match_result === 'object') ? JSON.stringify(c.ai_match_result) : null,
          c.target_job_id || null
        ]
      );
    }

    client.release();

    // 非同步觸發 SQL → Sheets 同步
    syncSQLToSheets([result.rows[0]]).catch(err =>
      console.warn('⚠️ Sheets sync failed (non-blocking):', err.message)
    );

    // 寫入操作日誌
    writeLog({
      action: action === 'created' ? 'IMPORT_CREATE' : 'IMPORT_UPDATE',
      actor: c.actor || c.recruiter || 'system',
      candidateId: result.rows[0].id,
      candidateName: c.name,
      detail: { source: c.source, position: c.current_position }
    });

    res.status(action === 'created' ? 201 : 200).json({
      success: true,
      action,
      data: result.rows[0],
      message: action === 'created'
        ? `新增候選人：${c.name}`
        : `已存在，已補充 ${c.name} 的空白欄位`
    });
  } catch (error) {
    console.error('❌ POST /candidates error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/candidates/bulk
 * 批量智慧匯入候選人（單一入口 → SQL → Sheets）
 * - 已存在的人選：只補充空欄位，不覆蓋既有資料
 * - 新人選：建立新紀錄
 * Body: { candidates: [ { name, contact_link, ... }, ... ] }
 */
router.post('/candidates/bulk', async (req, res) => {
  try {
    const { candidates, actor } = req.body;  // actor: AIbot 或顧問名稱，例如 "AIbot-Phoebe"

    if (!Array.isArray(candidates) || candidates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'candidates array is required and must not be empty'
      });
    }

    if (candidates.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 100 candidates per request'
      });
    }

    const client = await pool.connect();

    // 取得所有現有候選人（用 name 比對）
    const existing = await client.query('SELECT id, name FROM candidates_pipeline');
    const existingMap = new Map();
    for (const row of existing.rows) {
      const key = (row.name || '').trim().toLowerCase();
      if (key) existingMap.set(key, row.id);
    }

    const results = { created: [], updated: [], skipped: [], failed: [] };

    for (const c of candidates) {
      try {
        if (!c.name) {
          results.failed.push({ name: '(empty)', error: 'Name is required' });
          continue;
        }

        const nameKey = c.name.trim().toLowerCase();

        if (existingMap.has(nameKey)) {
          // 既有人選 → 只補充空欄位
          const existingId = existingMap.get(nameKey);
          const result = await client.query(
            `UPDATE candidates_pipeline SET
              phone = COALESCE(NULLIF(phone, ''), $1),
              contact_link = COALESCE(NULLIF(contact_link, ''), $2),
              location = COALESCE(NULLIF(location, ''), $3),
              current_position = COALESCE(NULLIF(current_position, ''), $4),
              years_experience = COALESCE(NULLIF(years_experience, ''), NULLIF(years_experience, '0'), $5),
              skills = COALESCE(NULLIF(skills, ''), $6),
              education = COALESCE(NULLIF(education, ''), $7),
              source = COALESCE(NULLIF(source, ''), $8),
              notes = CASE WHEN $9 = '' THEN notes ELSE CONCAT(notes, CASE WHEN notes != '' THEN E'\n' ELSE '' END, $9) END,
              stability_score = COALESCE(NULLIF(stability_score, ''), NULLIF(stability_score, '0'), $10),
              personality_type = COALESCE(NULLIF(personality_type, ''), $11),
              job_changes = COALESCE(NULLIF(job_changes, ''), NULLIF(job_changes, '0'), $12),
              avg_tenure_months = COALESCE(NULLIF(avg_tenure_months, ''), NULLIF(avg_tenure_months, '0'), $13),
              recent_gap_months = COALESCE(NULLIF(recent_gap_months, ''), NULLIF(recent_gap_months, '0'), $14),
              work_history = COALESCE(work_history, $15),
              education_details = COALESCE(education_details, $16),
              leaving_reason = COALESCE(NULLIF(leaving_reason, ''), $17),
              talent_level = COALESCE(NULLIF(talent_level, ''), $18),
              email = COALESCE(NULLIF(email, ''), $19),
              linkedin_url = COALESCE(NULLIF(linkedin_url, ''), $20),
              github_url = COALESCE(NULLIF(github_url, ''), $21),
              updated_at = NOW()
            WHERE id = $22
            RETURNING id, name, contact_link, current_position, status`,
            [
              c.phone || '',
              c.contact_link || '',
              c.location || '',
              c.current_position || '',
              String(c.years_experience || ''),
              c.skills || '',
              c.education || '',
              c.source || '',
              c.notes || '',
              String(c.stability_score || ''),
              c.personality_type || '',
              String(c.job_changes || ''),
              String(c.avg_tenure_months || ''),
              String(c.recent_gap_months || ''),
              c.work_history ? JSON.stringify(c.work_history) : null,
              c.education_details ? JSON.stringify(c.education_details) : null,
              c.leaving_reason || '',
              c.talent_level || '',
              c.email || '',
              c.linkedin_url || '',
              c.github_url || '',
              existingId
            ]
          );
          results.updated.push(result.rows[0]);
        } else {
          // 新人選 → 建立
          const result = await client.query(
            `INSERT INTO candidates_pipeline
             (name, phone, email, linkedin_url, github_url, contact_link,
              location, current_position, years_experience,
              skills, education, source, status, recruiter, notes,
              stability_score, personality_type, job_changes, avg_tenure_months,
              recent_gap_months, work_history, education_details, leaving_reason,
              talent_level, created_at, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,NOW(),NOW())
             RETURNING id, name, contact_link, current_position, status`,
            [
              c.name.trim(),
              c.phone || '',
              c.email || '',
              c.linkedin_url || '',
              c.github_url || '',
              c.contact_link || '',
              c.location || '',
              c.current_position || '',
              String(c.years_experience || '0'),
              c.skills || '',
              c.education || '',
              c.source || 'OpenClaw AI',
              c.status || '未開始',
              c.recruiter || 'Jacky',
              c.notes || '',
              String(c.stability_score || '0'),
              c.personality_type || '',
              String(c.job_changes || '0'),
              String(c.avg_tenure_months || '0'),
              String(c.recent_gap_months || '0'),
              c.work_history ? JSON.stringify(c.work_history) : null,
              c.education_details ? JSON.stringify(c.education_details) : null,
              c.leaving_reason || '',
              c.talent_level || ''
            ]
          );
          existingMap.set(nameKey, result.rows[0].id);
          results.created.push(result.rows[0]);
        }
      } catch (err) {
        results.failed.push({ name: c.name || '(unknown)', error: err.message });
      }
    }

    client.release();

    // 非同步觸發 SQL → Sheets 同步（不阻塞回應）
    syncSQLToSheets(results.created.concat(results.updated)).catch(err =>
      console.warn('⚠️ Sheets sync failed (non-blocking):', err.message)
    );

    // 寫入操作日誌（一筆批量 log）
    const bulkActor = actor || 'system';
    writeLog({
      action: 'BULK_IMPORT',
      actor: bulkActor,
      candidateId: null,
      candidateName: null,
      detail: {
        created: results.created.length,
        updated: results.updated.length,
        failed: results.failed.length,
        total: candidates.length
      }
    });

    const total = candidates.length;
    res.status(201).json({
      success: true,
      message: `匯入完成：新增 ${results.created.length} 筆，補充更新 ${results.updated.length} 筆，失敗 ${results.failed.length} 筆（共 ${total} 筆）`,
      created_count: results.created.length,
      updated_count: results.updated.length,
      failed_count: results.failed.length,
      data: { created: results.created, updated: results.updated },
      failed: results.failed
    });
  } catch (error) {
    console.error('❌ POST /candidates/bulk error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/migrate/fix-ai-match-result — 修正所有格式錯誤的 ai_match_result（字串 or 欄位名稱錯誤的物件）
router.post('/migrate/fix-ai-match-result', async (req, res) => {
  const client = await pool.connect();
  try {
    // 取出所有有 ai_match_result 的候選人（字串 or 物件都要檢查）
    const rows = await client.query(`
      SELECT id, ai_match_result, stability_score, talent_level
      FROM candidates_pipeline
      WHERE ai_match_result IS NOT NULL
    `);

    const gradeToRec = (g) => {
      if (!g) return null;
      if (['強力推薦','推薦','觀望','不推薦'].includes(g)) return g;
      const score = parseInt(g);
      if (!isNaN(score)) return score >= 85 ? '強力推薦' : score >= 70 ? '推薦' : score >= 55 ? '觀望' : '不推薦';
      // grade 是 S/A+/A/B/C
      if (g === 'S' || g === 'A+') return '強力推薦';
      if (g === 'A') return '推薦';
      if (g === 'B') return '觀望';
      return '不推薦';
    };

    let fixed = 0;
    for (const row of rows.rows) {
      let amr = row.ai_match_result;
      let structured = null;

      if (typeof amr === 'string' && amr.trim()) {
        // 字串格式：解析文字
        const scoreMatch = amr.match(/AI評分\s*(\d+)\s*分/);
        const jobMatch = amr.match(/配對職位[：:]\s*(.+?)(?:（|\(|\n|$)/);
        const score = scoreMatch ? parseInt(scoreMatch[1]) : (row.stability_score || 0);
        const strengthsMatch = amr.match(/優勢[：:]?\s*\n([\s\S]+?)(?=⚠️|待確認|💡|顧問建議|$)/);
        const strengths = strengthsMatch ? strengthsMatch[1].split('\n').map(l=>l.replace(/^[-–•*]\s*/,'').trim()).filter(Boolean) : [];
        const pendingMatch = amr.match(/待確認[：:]?\s*\n([\s\S]+?)(?=💡|顧問建議|$)/);
        const pending = pendingMatch ? pendingMatch[1].split('\n').map(l=>l.replace(/^[-–•*]\s*/,'').trim()).filter(Boolean) : [];
        const conclusionMatch = amr.match(/顧問建議[：:]\s*([\s\S]+?)(?:\n---|\s*$)/);
        structured = {
          score, recommendation: gradeToRec(score.toString()),
          job_title: jobMatch ? jobMatch[1].trim() : undefined,
          matched_skills: [], missing_skills: pending.slice(0,3),
          strengths, probing_questions: pending,
          conclusion: conclusionMatch ? conclusionMatch[1].trim() : '',
          evaluated_at: new Date().toISOString(), evaluated_by: 'AIbot',
        };
      } else if (amr && typeof amr === 'object') {
        // 物件格式：檢查是否用了錯誤的欄位名稱
        const hasWrongFields = amr.grade !== undefined || amr.position !== undefined || amr.suggestion !== undefined || amr.to_confirm !== undefined;
        if (!hasWrongFields) continue; // 欄位正確就跳過
        structured = {
          score: amr.score || row.stability_score || 0,
          recommendation: gradeToRec(amr.recommendation || amr.grade),
          job_title: amr.job_title || (amr.position && amr.company ? `${amr.position}（${amr.company}）` : amr.position) || undefined,
          matched_skills: amr.matched_skills || [],
          missing_skills: amr.missing_skills || amr.to_confirm?.slice(0,3) || [],
          strengths: amr.strengths || [],
          probing_questions: amr.probing_questions || amr.to_confirm || [],
          conclusion: amr.conclusion || amr.suggestion || '',
          evaluated_at: amr.evaluated_at || new Date().toISOString(),
          evaluated_by: amr.evaluated_by || 'AIbot',
        };
      } else {
        continue;
      }

      await client.query(
        `UPDATE candidates_pipeline SET ai_match_result = $1 WHERE id = $2`,
        [JSON.stringify(structured), row.id]
      );
      fixed++;
    }

    client.release();
    res.json({ success: true, fixed, total: rows.rows.length });
  } catch (err) {
    client.release();
    res.status(500).json({ success: false, error: err.message });
  }
});


// ==================== GitHub 分析 API ====================
// ==================== GitHub 分析 API ====================

/**
 * GET /api/github/analyze/:username
 * 完整 GitHub 分析（v2 支援 ?jobId= 查詢參數）
 */
router.get('/github/analyze/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const { jobId } = req.query;

    // 如果有 jobId，取得職缺技能做連動分析
    let options = {};
    if (jobId) {
      const jobResult = await pool.query(
        'SELECT key_skills, talent_profile FROM jobs_pipeline WHERE id = $1',
        [jobId]
      );
      if (jobResult.rows.length > 0) {
        const job = jobResult.rows[0];
        options = { keySkills: job.key_skills, talentProfile: job.talent_profile };
      }
    }

    // 優先使用 v2 分析
    const result = await githubAnalysis.analyzeGithubProfileV2(`https://github.com/${username}`, options);

    if (!result.success) {
      return res.status(404).json({ success: false, error: result.error });
    }

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/candidates/:id/job-rankings
 * 將候選人與系統所有職缺做技能比對，依分數排序回傳推薦列表
 */
router.get('/candidates/:id/job-rankings', async (req, res) => {
  try {
    const { id } = req.params;

    // 1. 抓候選人資料
    const candRes = await pool.query(
      `SELECT id, name, skills, notes AS bio, source
       FROM candidates_pipeline WHERE id = $1`,
      [id]
    );
    if (candRes.rows.length === 0) return res.status(404).json({ error: '候選人不存在' });
    const candidate = candRes.rows[0];

    // 統一 skills 格式
    if (typeof candidate.skills === 'string') {
      try { candidate.skills = JSON.parse(candidate.skills); } catch { candidate.skills = []; }
    }
    if (!Array.isArray(candidate.skills)) candidate.skills = [];

    // 2. 抓所有職缺
    const jobsRes = await pool.query(
      `SELECT id, position_name, client_company, department,
              key_skills, experience_required, special_conditions,
              salary_range, job_status
       FROM jobs_pipeline
       ORDER BY created_at DESC LIMIT 200`
    );

    // 3. 對每個職缺做技能比對（與 talentSourceService.scoreCandidate 同邏輯）
    function rankAgainstJob(cand, job) {
      const rawSkills = [job.key_skills, job.experience_required, job.special_conditions]
        .filter(Boolean).join(',');
      const requiredSkills = rawSkills
        .split(/[,、\n\/；;]/)
        .map(s => s.trim().toLowerCase())
        .filter(s => s.length > 1 && s.length < 30);

      const candidateSkills = (cand.skills || []).map(s => (s || '').toLowerCase());
      const candidateBio = (cand.bio || '').toLowerCase();

      const matched = requiredSkills.filter(req =>
        candidateSkills.some(cs => cs.includes(req) || req.includes(cs)) ||
        candidateBio.includes(req)
      );

      const skillScore = requiredSkills.length > 0
        ? Math.round((matched.length / requiredSkills.length) * 100)
        : 50;

      // 個人資料品質基礎分（依來源給予基準分）
      let profileScore = 40;
      const src = (cand.source || '').toLowerCase();
      if (src === 'github') profileScore = 65;
      else if (src === 'linkedin') profileScore = 62;
      else if (src === 'gmail 進件' || src === 'gmail') profileScore = 55;

      const totalScore = Math.round(skillScore * 0.6 + profileScore * 0.4);
      const missingSkills = requiredSkills.filter(r => !matched.includes(r));

      let recommendation;
      if (totalScore >= 80) recommendation = '強力推薦';
      else if (totalScore >= 65) recommendation = '推薦';
      else if (totalScore >= 50) recommendation = '觀望';
      else recommendation = '不推薦';

      return {
        job_id: job.id,
        job_title: job.position_name,
        company: job.client_company || '',
        department: job.department || '',
        salary_range: job.salary_range || '',
        job_status: job.job_status || '',
        match_score: totalScore,
        skill_score: skillScore,
        matched_skills: matched.slice(0, 10),
        missing_skills: missingSkills.slice(0, 10),
        required_skills_count: requiredSkills.length,
        recommendation,
      };
    }

    const rankings = jobsRes.rows
      .map(job => rankAgainstJob(candidate, job))
      .sort((a, b) => b.match_score - a.match_score);

    res.json({
      candidate_id: id,
      candidate_name: candidate.name,
      total_jobs: rankings.length,
      rankings,
    });
  } catch (error) {
    console.error('❌ GET /candidates/:id/job-rankings error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/candidates/:id/github-stats
 * 獲取候選人的 GitHub 快速統計 v2（支援 ?jobId= 查詢參數 + DB 快取）
 */
router.get('/candidates/:id/github-stats', async (req, res) => {
  try {
    const { id } = req.params;
    const { jobId } = req.query;

    // 從數據庫獲取候選人的 GitHub URL 和快取
    const result = await pool.query(
      'SELECT github_url, github_analysis_cache FROM candidates_pipeline WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: '候選人不存在' });
    }

    const { github_url: githubUrl, github_analysis_cache: cache } = result.rows[0];

    if (!githubUrl || !githubUrl.trim()) {
      return res.json({ success: true, data: null }); // 無 GitHub 連結
    }

    // 檢查快取是否有效（24 小時 TTL + 相同 jobId）
    if (cache && cache.analyzedAt) {
      const cacheAge = Date.now() - new Date(cache.analyzedAt).getTime();
      const cacheFresh = cacheAge < 24 * 60 * 60 * 1000; // 24 小時
      const sameJob = !jobId || String(cache.jobId) === String(jobId);
      if (cacheFresh && sameJob) {
        return res.json({ success: true, data: cache, cached: true });
      }
    }

    // 快取過期或 jobId 不同，重新分析
    let options = {};
    if (jobId) {
      const jobResult = await pool.query(
        'SELECT key_skills, talent_profile FROM jobs_pipeline WHERE id = $1',
        [jobId]
      );
      if (jobResult.rows.length > 0) {
        const job = jobResult.rows[0];
        options = { keySkills: job.key_skills, talentProfile: job.talent_profile };
      }
    }

    const stats = await githubAnalysis.getGithubQuickStatsV2(githubUrl, options);

    // 寫入快取
    if (stats) {
      const cacheData = { ...stats, jobId: jobId || null, analyzedAt: new Date().toISOString() };
      await pool.query(
        'UPDATE candidates_pipeline SET github_analysis_cache = $1 WHERE id = $2',
        [JSON.stringify(cacheData), id]
      ).catch(err => console.warn('Failed to cache github stats:', err.message));
    }

    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/github/ai-analyze
 * 透過 OpenClaw 本地 AI 做 GitHub 深度分析
 * 接收 { candidateId, jobId }，呼叫 OpenClaw API 做 AI 判斷
 */
router.post('/github/ai-analyze', async (req, res) => {
  try {
    const { candidateId, jobId } = req.body;
    if (!candidateId) {
      return res.status(400).json({ success: false, error: '缺少 candidateId' });
    }

    // 1. 取得候選人 GitHub URL
    const candResult = await pool.query(
      'SELECT name, github_url, skills, notes FROM candidates_pipeline WHERE id = $1',
      [candidateId]
    );
    if (candResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: '候選人不存在' });
    }
    const candidate = candResult.rows[0];
    if (!candidate.github_url) {
      return res.status(400).json({ success: false, error: '候選人無 GitHub URL' });
    }

    // 2. 取得 GitHub v2 結構化分析
    let jobOptions = {};
    let jobData = null;
    if (jobId) {
      const jobResult = await pool.query(
        'SELECT position_name, key_skills, talent_profile, company_profile, job_description, client_company FROM jobs_pipeline WHERE id = $1',
        [jobId]
      );
      if (jobResult.rows.length > 0) {
        jobData = jobResult.rows[0];
        jobOptions = { keySkills: jobData.key_skills, talentProfile: jobData.talent_profile };
      }
    }

    const githubData = await githubAnalysis.analyzeGithubProfileV2(candidate.github_url, jobOptions);
    if (!githubData.success) {
      return res.status(400).json({ success: false, error: `GitHub 分析失敗: ${githubData.error}` });
    }

    // 3. 組成 prompt 呼叫 OpenClaw
    const openclawUrl = process.env.OPENCLAW_API_URL || 'http://127.0.0.1:18789';
    const openclawModel = process.env.OPENCLAW_MODEL || 'default';

    const prompt = buildGithubAnalysisPrompt(candidate, githubData, jobData);

    const aiResponse = await callOpenClawAPI(openclawUrl, openclawModel, prompt);

    res.json({
      success: true,
      candidateId,
      candidateName: candidate.name,
      githubAnalysis: githubData,
      aiAnalysis: aiResponse,
      jobId: jobId || null
    });
  } catch (error) {
    console.error('GitHub AI analyze failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 組建 GitHub 分析 prompt（給 OpenClaw / AI）
 */
function buildGithubAnalysisPrompt(candidate, githubData, jobData) {
  const jobSection = jobData ? `
## 目標職缺
- 職位：${jobData.position_name || '未知'}（${jobData.client_company || '未知'}）
- 必要技能：${jobData.key_skills || '未提供'}
- 人才畫像：${jobData.talent_profile || '未提供'}
- 企業畫像：${jobData.company_profile || '未提供'}
- JD：${(jobData.job_description || '未提供').substring(0, 500)}
` : '（無指定職缺，請做通用評估）';

  return `你是一位資深獵頭 AI，請分析以下 GitHub 候選人，判斷其技術能力與職缺適配度。

## 候選人
- 姓名：${candidate.name}
- GitHub：${githubData.profileUrl}
- Bio：${githubData.bio || '無'}
- 公司：${githubData.company || '未知'}
- 地點：${githubData.location || '未知'}
- 現有技能標記：${Array.isArray(candidate.skills) ? candidate.skills.join(', ') : candidate.skills || '無'}

## GitHub 結構化分析（系統自動計算）
### 技能匹配（權重 40%）— 初步分數：${githubData.skillMatch.score}/100
- 匹配技能：${githubData.skillMatch.matchedSkills.join(', ') || '無'}
- 缺少技能：${githubData.skillMatch.missingSkills.join(', ') || '無'}
- 候選人技術信號：${githubData.skillMatch.candidateSignals.join(', ')}

### 專案品質（權重 30%）— 初步分數：${githubData.projectQuality.score}/100
- 原創 repo：${githubData.projectQuality.originalCount} 個
- Fork repo：${githubData.projectQuality.forkCount} 個
- 總 star 數：${githubData.projectQuality.totalStars}
- 最高 star 專案：${githubData.projectQuality.maxStarRepo ? `${githubData.projectQuality.maxStarRepo.name} (${githubData.projectQuality.maxStarRepo.stars} stars, ${githubData.projectQuality.maxStarRepo.language})` : '無'}

### 活躍度（權重 20%）— 初步分數：${githubData.activity.score}/100
- 最後 commit：${githubData.activity.daysSinceLastCommit} 天前
- 最近 6 個月活躍月數：${githubData.activity.activeMonths}/6
- 狀態：${githubData.activity.statusText}

### 影響力（權重 10%）— 初步分數：${githubData.influence.score}/100
- Followers：${githubData.influence.followers}
- 總 Stars：${githubData.influence.totalStars}
- 公開 Repos：${githubData.influence.publicRepos}

### 語言分布
${githubData.languages.map(l => `- ${l.name}: ${l.percentage}%`).join('\n')}

### 系統初步加權總分：${githubData.totalScore}/100（${githubData.stars} 星）

${jobSection}

## 請你做的事：
1. 根據以上資料，用你的 AI 判斷力做 4 維度深度分析（不要只看初步分數）
2. 特別注意 repo 名稱/描述是否暗示相關經驗（例如 "payment-gateway" 對 fintech 有加分）
3. 給出最終 4 維度分數和加權總分（0-100）
4. 給出評級（S/A+/A/B/C）
5. 寫出優勢、風險、顧問建議

請用以下 JSON 格式回覆：
{
  "finalScore": 數字,
  "grade": "S|A+|A|B|C",
  "dimensions": {
    "skillMatch": { "score": 數字, "comment": "說明" },
    "projectQuality": { "score": 數字, "comment": "說明" },
    "activity": { "score": 數字, "comment": "說明" },
    "influence": { "score": 數字, "comment": "說明" }
  },
  "strengths": ["優勢1", "優勢2"],
  "risks": ["風險1", "風險2"],
  "consultantAdvice": "一句話顧問建議",
  "recommendation": "強力推薦|推薦|觀望|不推薦"
}`;
}

/**
 * 呼叫 OpenClaw API（OpenAI-compatible /v1/chat/completions）
 */
async function callOpenClawAPI(baseUrl, model, prompt) {
  return new Promise((resolve, reject) => {
    const url = new URL('/v1/chat/completions', baseUrl);
    const postData = JSON.stringify({
      model: model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 2000
    });

    const protocol = url.protocol === 'https:' ? require('https') : require('http');
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = protocol.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.message?.content || data;
          // 嘗試解析 AI 回傳的 JSON
          try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              resolve(JSON.parse(jsonMatch[0]));
            } else {
              resolve({ raw: content });
            }
          } catch {
            resolve({ raw: content });
          }
        } catch {
          resolve({ raw: data });
        }
      });
    });

    req.on('error', (err) => {
      console.warn('OpenClaw API call failed:', err.message);
      resolve({ error: `OpenClaw 連線失敗: ${err.message}`, hint: '請確認 OpenClaw 是否正在執行' });
    });

    req.setTimeout(60000, () => {
      req.destroy();
      resolve({ error: 'OpenClaw API timeout (60s)' });
    });

    req.write(postData);
    req.end();
  });
}

// ─────────────────────────────────────────────────────────────
// PDF 履歷解析端點
// ─────────────────────────────────────────────────────────────


/**
 * POST /api/resume/parse
 * 單筆 PDF 解析
 * Body: multipart/form-data  file=<PDF>  useAI=true|false
 */
router.post('/resume/parse', (req, res) => {
  const upload = req.app.locals.upload;
  if (!upload) return res.status(500).json({ success: false, error: 'multer 未初始化' });

  upload.single('file')(req, res, async (err) => {
    if (err) return res.status(400).json({ success: false, error: err.message });
    if (!req.file) return res.status(400).json({ success: false, error: '請上傳 PDF 檔案（欄位名稱：file）' });

    const useAI = req.body.useAI === 'true';
    try {
      const parsed = await parseResumePDF(req.file.buffer, useAI);
      res.json({
        success: true,
        filename: req.file.originalname,
        parsed,
      });
    } catch (e) {
      console.error('[/api/resume/parse]', e.message);
      res.status(500).json({ success: false, error: e.message });
    }
  });
});

/**
 * POST /api/resume/batch-parse
 * 批量 PDF 解析（最多 20 份）
 * Body: multipart/form-data  files[]=<PDF>...  useAI=true|false
 * 回傳每份 PDF 解析結果 + 比對現有候選人
 */
router.post('/resume/batch-parse', (req, res) => {
  const upload = req.app.locals.upload;
  if (!upload) return res.status(500).json({ success: false, error: 'multer 未初始化' });

  upload.array('files', 20)(req, res, async (err) => {
    if (err) return res.status(400).json({ success: false, error: err.message });
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: '請上傳至少一個 PDF 檔案（欄位名稱：files）' });
    }

    const useAI = req.body.useAI === 'true';
    const results = [];

    for (const file of req.files) {
      try {
        const parsed = await parseResumePDF(file.buffer, useAI);

        // 比對現有候選人
        let existingMatch = null;

        // 1. 優先：LinkedIn URL 精確比對
        if (parsed.linkedinUrl) {
          const urlResult = await pool.query(
            `SELECT id, name FROM candidates_pipeline WHERE linkedin_url ILIKE $1 LIMIT 1`,
            [parsed.linkedinUrl]
          );
          if (urlResult.rows.length > 0) existingMatch = urlResult.rows[0];
        }

        // 2. Fallback：姓名模糊比對
        if (!existingMatch && parsed.name) {
          const nameResult = await pool.query(
            `SELECT id, name FROM candidates_pipeline WHERE name ILIKE $1 LIMIT 1`,
            [`%${parsed.name}%`]
          );
          if (nameResult.rows.length > 0) existingMatch = nameResult.rows[0];
        }

        results.push({
          filename: file.originalname,
          status: 'ok',
          parsed,
          existingMatch,
        });
      } catch (e) {
        console.error(`[/api/resume/batch-parse] ${file.originalname}:`, e.message);
        results.push({
          filename: file.originalname,
          status: 'error',
          error: e.message,
        });
      }
    }

    res.json({
      success: true,
      total: req.files.length,
      results,
    });
  });
});


// ==================== 結構化備註 API（candidate_notes 表）====================
// 與舊有 notes TEXT 欄位並存，不遷移現有備註，保留 parseNotesToAiMatchResult 等邏輯不動

/**
 * GET /api/candidates/:id/notes
 * 取得該候選人的結構化備註列表（candidate_notes 表）
 */
router.get('/candidates/:id/notes', async (req, res) => {
  try {
    const { id } = req.params;
    if (!/^\d+$/.test(id)) {
      return res.status(404).json({ success: false, error: 'Candidate not found' });
    }
    const result = await pool.query(
      `SELECT id, candidate_id, content, note_type, created_by, created_at, updated_at
       FROM candidate_notes
       WHERE candidate_id = $1
       ORDER BY created_at ASC`,
      [id]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('❌ GET /candidates/:id/notes error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/candidates/:id/notes
 * 新增一則結構化備註
 * body: { content, note_type?, created_by }
 */
router.post('/candidates/:id/notes', async (req, res) => {
  try {
    const { id } = req.params;
    if (!/^\d+$/.test(id)) {
      return res.status(404).json({ success: false, error: 'Candidate not found' });
    }
    const { content, note_type = 'manual', created_by } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, error: 'content is required' });
    }
    const result = await pool.query(
      `INSERT INTO candidate_notes (candidate_id, content, note_type, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING id, candidate_id, content, note_type, created_by, created_at, updated_at`,
      [id, content.trim(), note_type, created_by || 'system']
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('❌ POST /candidates/:id/notes error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/candidates/:id/notes/:noteId
 * 刪除一則結構化備註
 */
router.delete('/candidates/:id/notes/:noteId', async (req, res) => {
  try {
    const { id, noteId } = req.params;
    if (!/^\d+$/.test(id) || !/^\d+$/.test(noteId)) {
      return res.status(404).json({ success: false, error: 'Not found' });
    }
    await pool.query(
      `DELETE FROM candidate_notes WHERE id = $1 AND candidate_id = $2`,
      [noteId, id]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('❌ DELETE /candidates/:id/notes/:noteId error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
