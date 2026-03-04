/**
 * jobs.js - routes
 */
const express = require('express');
const router = express.Router();
const { pool } = require('../utils/db');
const { sanitizeId, writeLog, syncSQLToSheets } = require('../utils/helpers');

router.param('id', (req, _res, next, value) => {
  req.params.id = sanitizeId(value);
  next();
});

// ==================== 職缺 API ====================

/**
 * GET /api/jobs
 * 列出所有職缺（從 SQL）
 */
router.get('/jobs', async (req, res) => {
  try {
    const client = await pool.connect();
    
    const result = await client.query(`
      SELECT 
        id,
        position_name,
        client_company,
        department,
        open_positions,
        salary_range,
        key_skills,
        experience_required,
        education_required,
        location,
        job_status,
        language_required,
        special_conditions,
        industry_background,
        team_size,
        key_challenges,
        attractive_points,
        recruitment_difficulty,
        interview_process,
        consultant_notes,
        job_description,
        company_profile,
        talent_profile,
        search_primary,
        search_secondary,
        welfare_tags,
        welfare_detail,
        work_hours,
        vacation_policy,
        remote_work,
        business_trip,
        job_url,
        created_at,
        updated_at
      FROM jobs_pipeline
      ORDER BY created_at DESC
      LIMIT 1000
    `);

    const jobs = result.rows.map(row => ({
      id: row.id,
      position_name: row.position_name,
      client_company: row.client_company,
      department: row.department,
      open_positions: row.open_positions,
      salary_range: row.salary_range,
      key_skills: row.key_skills,
      experience_required: row.experience_required,
      education_required: row.education_required,
      location: row.location,
      job_status: row.job_status,
      language_required: row.language_required,
      special_conditions: row.special_conditions,
      industry_background: row.industry_background,
      team_size: row.team_size,
      key_challenges: row.key_challenges,
      attractive_points: row.attractive_points,
      recruitment_difficulty: row.recruitment_difficulty,
      interview_process: row.interview_process,
      consultant_notes: row.consultant_notes,
      job_description: row.job_description,
      company_profile: row.company_profile,
      talent_profile: row.talent_profile,
      search_primary: row.search_primary,
      search_secondary: row.search_secondary,
      welfare_tags: row.welfare_tags,
      welfare_detail: row.welfare_detail,
      work_hours: row.work_hours,
      vacation_policy: row.vacation_policy,
      remote_work: row.remote_work,
      business_trip: row.business_trip,
      job_url: row.job_url,
      lastUpdated: row.updated_at
    }));

    client.release();

    res.json({
      success: true,
      data: jobs,
      count: jobs.length
    });
  } catch (error) {
    console.error('❌ GET /jobs error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/jobs/:id
 * 獲取單一職缺
 */
router.get('/jobs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const client = await pool.connect();
    
    const result = await client.query(
      `SELECT * FROM jobs_pipeline WHERE id = $1`,
      [id]
    );

    client.release();

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ GET /jobs/:id error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/jobs/:id
 * 更新職缺（只更新有傳入的欄位，不覆蓋空值）
 */
router.put('/jobs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      position_name, client_company, department, open_positions,
      salary_range, key_skills, experience_required, education_required,
      location, language_required, special_conditions, industry_background,
      team_size, key_challenges, attractive_points, recruitment_difficulty,
      interview_process,
      job_status, consultant_notes, job_description,
      company_profile, talent_profile, search_primary, search_secondary,
      welfare_tags, welfare_detail, work_hours, vacation_policy,
      remote_work, business_trip, job_url,
    } = req.body;

    const client = await pool.connect();

    // 先取得現有資料，避免覆蓋空值
    const current = await client.query('SELECT * FROM jobs_pipeline WHERE id = $1', [id]);
    if (current.rows.length === 0) {
      client.release();
      return res.status(404).json({ success: false, error: 'Job not found' });
    }
    const existing = current.rows[0];

    const result = await client.query(
      `UPDATE jobs_pipeline
       SET position_name = $1, job_status = $2, consultant_notes = $3,
           job_description = $4,
           company_profile = $5, talent_profile = $6,
           search_primary = $7, search_secondary = $8,
           welfare_tags = $9, welfare_detail = $10,
           work_hours = $11, vacation_policy = $12,
           remote_work = $13, business_trip = $14, job_url = $15,
           client_company = $17, department = $18, open_positions = $19,
           salary_range = $20, key_skills = $21, experience_required = $22,
           education_required = $23, location = $24, language_required = $25,
           special_conditions = $26, industry_background = $27, team_size = $28,
           key_challenges = $29, attractive_points = $30, recruitment_difficulty = $31,
           interview_process = $32,
           last_updated = NOW()
       WHERE id = $16
       RETURNING *`,
      [
        position_name    !== undefined ? position_name    : existing.position_name,
        job_status       !== undefined ? job_status       : existing.job_status,
        consultant_notes !== undefined ? consultant_notes : existing.consultant_notes,
        job_description  !== undefined ? job_description  : existing.job_description,
        company_profile  !== undefined ? company_profile  : existing.company_profile,
        talent_profile   !== undefined ? talent_profile   : existing.talent_profile,
        search_primary   !== undefined ? search_primary   : existing.search_primary,
        search_secondary !== undefined ? search_secondary : existing.search_secondary,
        welfare_tags     !== undefined ? welfare_tags     : existing.welfare_tags,
        welfare_detail   !== undefined ? welfare_detail   : existing.welfare_detail,
        work_hours       !== undefined ? work_hours       : existing.work_hours,
        vacation_policy  !== undefined ? vacation_policy  : existing.vacation_policy,
        remote_work      !== undefined ? remote_work      : existing.remote_work,
        business_trip    !== undefined ? business_trip    : existing.business_trip,
        job_url          !== undefined ? job_url          : existing.job_url,
        id,
        client_company       !== undefined ? client_company       : existing.client_company,
        department           !== undefined ? department           : existing.department,
        open_positions       !== undefined ? open_positions       : existing.open_positions,
        salary_range         !== undefined ? salary_range         : existing.salary_range,
        key_skills           !== undefined ? key_skills           : existing.key_skills,
        experience_required  !== undefined ? experience_required  : existing.experience_required,
        education_required   !== undefined ? education_required   : existing.education_required,
        location             !== undefined ? location             : existing.location,
        language_required    !== undefined ? language_required    : existing.language_required,
        special_conditions   !== undefined ? special_conditions   : existing.special_conditions,
        industry_background  !== undefined ? industry_background  : existing.industry_background,
        team_size            !== undefined ? team_size            : existing.team_size,
        key_challenges       !== undefined ? key_challenges       : existing.key_challenges,
        attractive_points    !== undefined ? attractive_points    : existing.attractive_points,
        recruitment_difficulty !== undefined ? recruitment_difficulty : existing.recruitment_difficulty,
        interview_process    !== undefined ? interview_process    : existing.interview_process,
      ]
    );

    client.release();

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Job updated successfully'
    });
  } catch (error) {
    console.error('❌ PUT /jobs/:id error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/jobs/:id/status
 * 專用：只更新職缺狀態（供 AIbot 使用）
 * Body: { job_status: "招募中" | "暫停" | "已滿額" | "關閉", actor: "aibot名稱" }
 */
router.patch('/jobs/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { job_status, actor } = req.body;

    const VALID_STATUSES = ['招募中', '暫停', '已滿額', '關閉'];
    if (!job_status) {
      return res.status(400).json({ success: false, error: '缺少 job_status 欄位' });
    }
    if (!VALID_STATUSES.includes(job_status)) {
      return res.status(400).json({
        success: false,
        error: `無效狀態，允許值：${VALID_STATUSES.join('、')}`
      });
    }

    const client = await pool.connect();

    const current = await client.query('SELECT * FROM jobs_pipeline WHERE id = $1', [id]);
    if (current.rows.length === 0) {
      client.release();
      return res.status(404).json({ success: false, error: 'Job not found' });
    }
    const oldStatus = current.rows[0].job_status;

    const result = await client.query(
      `UPDATE jobs_pipeline SET job_status = $1, last_updated = NOW() WHERE id = $2 RETURNING *`,
      [job_status, id]
    );

    // 寫入 system_logs
    await client.query(
      `INSERT INTO system_logs (action, actor, actor_type, candidate_id, candidate_name, detail)
       VALUES ('UPDATE', $1, 'AIBOT', $2, $3, $4)`,
      [
        actor || 'aibot',
        id,
        result.rows[0].position_name || `Job#${id}`,
        JSON.stringify({ field: 'job_status', old: oldStatus, new: job_status })
      ]
    ).catch(() => {}); // log 失敗不影響主流程

    client.release();

    res.json({
      success: true,
      data: result.rows[0],
      message: `職缺狀態已從「${oldStatus}」更新為「${job_status}」`,
      changed: { from: oldStatus, to: job_status }
    });
  } catch (error) {
    console.error('❌ PATCH /jobs/:id/status error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/jobs/:id
 * 刪除職缺
 */
router.delete('/jobs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const client = await pool.connect();

    const result = await client.query(
      'DELETE FROM jobs_pipeline WHERE id = $1 RETURNING id, position_name, client_company',
      [id]
    );

    if (result.rows.length === 0) {
      client.release();
      return res.status(404).json({ success: false, error: 'Job not found' });
    }

    // 寫入 system_logs
    await client.query(
      `INSERT INTO system_logs (action, actor, actor_type, candidate_id, candidate_name, detail)
       VALUES ('DELETE', $1, 'HUMAN', $2, $3, $4)`,
      [
        'user',
        id,
        result.rows[0].position_name || `Job#${id}`,
        JSON.stringify({ type: 'job', company: result.rows[0].client_company })
      ]
    ).catch(() => {}); // log 失敗不影響主流程

    client.release();

    res.json({
      success: true,
      message: `職缺「${result.rows[0].position_name}」已刪除`,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ DELETE /jobs/:id error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/jobs
 * 新增職缺（支援所有欄位）
 */
router.post('/jobs', async (req, res) => {
  try {
    const b = req.body;

    if (!b.position_name) {
      return res.status(400).json({ success: false, error: 'position_name 為必填欄位' });
    }

    const dbClient = await pool.connect();

    // 先查表有哪些欄位（動態適應 ALTER TABLE 擴充）
    const tableInfo = await dbClient.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name='jobs_pipeline'
    `);
    const availableCols = new Set(tableInfo.rows.map(r => r.column_name));

    // 所有支援的欄位與對應值
    const allFields = {
      position_name:           b.position_name,
      client_company:          b.client_company || b.company_name || '',
      company_name:            b.company_name || b.client_company || '',
      department:              b.department || '',
      open_positions:          b.open_positions || b.headcount || '',
      salary_range:            b.salary_range || '',
      salary_min:              b.salary_min || null,
      salary_max:              b.salary_max || null,
      key_skills:              b.key_skills || b.required_skills || '',
      required_skills:         b.required_skills || b.key_skills || '',
      experience_required:     b.experience_required || '',
      education_required:      b.education_required || '',
      location:                b.location || '',
      language_required:       b.language_required || '',
      special_conditions:      b.special_conditions || '',
      industry_background:     b.industry_background || '',
      team_size:               b.team_size || '',
      key_challenges:          b.key_challenges || '',
      attractive_points:       b.attractive_points || '',
      recruitment_difficulty:  b.recruitment_difficulty || '',
      interview_process:       b.interview_process || '',
      job_description:         b.job_description || '',
      consultant_notes:        b.consultant_notes || '',
      company_profile:         b.company_profile || '',
      talent_profile:          b.talent_profile || '',
      search_primary:          b.search_primary || '',
      search_secondary:        b.search_secondary || '',
      welfare_tags:            b.welfare_tags || '',
      welfare_detail:          b.welfare_detail || '',
      work_hours:              b.work_hours || '',
      vacation_policy:         b.vacation_policy || '',
      remote_work:             b.remote_work || '',
      business_trip:           b.business_trip || '',
      job_url:                 b.job_url || '',
      job_status:              b.job_status || b.status || '招募中',
      source:                  b.source || '104',
    };

    // 只保留表中實際存在的欄位
    const colsToInsert = Object.keys(allFields).filter(f => availableCols.has(f));
    const valsToInsert = colsToInsert.map(f => allFields[f]);
    const placeholders = colsToInsert.map((_, i) => `$${i + 1}`);

    const result = await dbClient.query(
      `INSERT INTO jobs_pipeline (${colsToInsert.join(', ')}, created_at, last_updated)
       VALUES (${placeholders.join(', ')}, NOW(), NOW())
       RETURNING *`,
      valsToInsert
    );

    dbClient.release();

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Job created successfully'
    });
  } catch (error) {
    console.error('❌ POST /jobs error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});


module.exports = router;
