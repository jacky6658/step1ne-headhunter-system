/**
 * routes-api.js - 完整 API 路由（candidates + jobs）
 * 整合 SQL 資料層
 */

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || 
  'postgresql://root:etUh2zkR4Mr8gfWLs059S7Dm1T6Yby3Q@tpe1.clusters.zeabur.com:27883/zeabur';

const pool = new Pool({ connectionString: DATABASE_URL });

// ==================== 候選人 API ====================

/**
 * GET /api/candidates
 * 列出所有候選人（從 SQL）
 */
router.get('/candidates', async (req, res) => {
  try {
    const client = await pool.connect();
    
    const result = await client.query(`
      SELECT 
        id, 
        name, 
        contact_link,
        phone,
        location,
        current_position,
        years_experience,
        job_changes,
        avg_tenure_months,
        recent_gap_months,
        skills,
        education,
        source,
        work_history,
        leaving_reason,
        stability_score,
        education_details,
        personality_type,
        status, 
        recruiter,
        notes,
        talent_level,
        created_at,
        updated_at
      FROM candidates_pipeline
      ORDER BY created_at DESC
      LIMIT 1000
    `);

    const candidates = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      contact_link: row.contact_link,
      phone: row.phone,
      location: row.location,
      current_position: row.current_position,
      years_experience: row.years_experience,
      job_changes: row.job_changes,
      avg_tenure_months: row.avg_tenure_months,
      recent_gap_months: row.recent_gap_months,
      skills: row.skills,
      education: row.education,
      source: row.source,
      work_history: row.work_history,
      leaving_reason: row.leaving_reason,
      stability_score: row.stability_score,
      education_details: row.education_details,
      personality_type: row.personality_type,
      status: row.status,
      recruiter: row.recruiter,
      notes: row.notes,
      talent_level: row.talent_level,
      lastUpdated: row.updated_at
    }));

    client.release();

    res.json({
      success: true,
      data: candidates,
      count: candidates.length
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
    const client = await pool.connect();
    
    const result = await client.query(
      `SELECT * FROM candidates_pipeline WHERE id = $1`,
      [id]
    );

    client.release();

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Candidate not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
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
    const { status, notes, consultant } = req.body;

    const client = await pool.connect();

    const result = await client.query(
      `UPDATE candidates_pipeline 
       SET status = $1, notes = $2, consultant = $3, last_updated = NOW()
       WHERE id = $4
       RETURNING *`,
      [status, notes || '', consultant || '', id]
    );

    client.release();

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Candidate not found'
      });
    }

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
 * POST /api/candidates
 * 新增候選人
 */
router.post('/candidates', async (req, res) => {
  try {
    const { name, consultant, status = '新進', notes = '' } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Name is required'
      });
    }

    const client = await pool.connect();

    const candidateId = `${name}_${Date.now()}`.replace(/\s+/g, '_');

    const result = await client.query(
      `INSERT INTO candidates_pipeline 
       (id, candidate_id, name, status, consultant, notes, created_at, last_updated)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING *`,
      [candidateId, candidateId, name, status, consultant || 'Jacky', notes]
    );

    client.release();

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Candidate created successfully'
    });
  } catch (error) {
    console.error('❌ POST /candidates error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
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
 * 更新職缺
 */
router.put('/jobs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { position_name, job_status, consultant_notes } = req.body;

    const client = await pool.connect();

    const result = await client.query(
      `UPDATE jobs_pipeline 
       SET position_name = $1, job_status = $2, consultant_notes = $3, last_updated = NOW()
       WHERE id = $4
       RETURNING *`,
      [position_name || '', job_status || '', consultant_notes || '', id]
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
      data: result.rows[0],
      message: 'Job updated successfully'
    });
  } catch (error) {
    console.error('❌ PUT /jobs/:id error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/jobs
 * 新增職缺
 */
router.post('/jobs', async (req, res) => {
  try {
    const { position_name, client_company, department, job_status = '招募中' } = req.body;

    if (!position_name) {
      return res.status(400).json({
        success: false,
        error: 'Position name is required'
      });
    }

    const client = await pool.connect();

    const jobId = `${position_name}_${Date.now()}`.replace(/\s+/g, '_');

    const result = await client.query(
      `INSERT INTO jobs_pipeline 
       (id, position_name, client_company, department, job_status, created_at, last_updated)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING *`,
      [jobId, position_name, client_company || '', department || '', job_status]
    );

    client.release();

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Job created successfully'
    });
  } catch (error) {
    console.error('❌ POST /jobs error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== 系統 API ====================

/**
 * GET /api/health
 * 健康檢查
 */
router.get('/health', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT 1');
    client.release();

    res.json({
      success: true,
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      status: 'error',
      error: error.message
    });
  }
});

module.exports = router;
