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
        candidate_id, 
        name, 
        status, 
        progress_tracking,
        notes, 
        consultant,
        job_matches,
        ai_match_scores,
        created_at,
        last_updated
      FROM candidates_pipeline
      ORDER BY created_at DESC
      LIMIT 500
    `);

    const candidates = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      status: row.status,
      consultant: row.consultant,
      notes: row.notes,
      jobMatches: row.job_matches,
      aiScores: row.ai_match_scores,
      lastUpdated: row.last_updated
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
        last_updated
      FROM jobs_pipeline
      ORDER BY created_at DESC
      LIMIT 500
    `);

    const jobs = result.rows.map(row => ({
      id: row.id,
      title: row.position_name,
      company: {
        name: row.client_company
      },
      department: row.department,
      headcount: row.open_positions,
      salaryRange: row.salary_range,
      requiredSkills: row.key_skills ? JSON.parse(row.key_skills) : [],
      yearsRequired: parseInt(row.experience_required) || 0,
      educationRequired: row.education_required,
      workLocation: row.location,
      status: row.job_status,
      languageRequirement: row.language_required,
      specialConditions: row.special_conditions,
      industryBackground: row.industry_background,
      teamSize: row.team_size,
      keyChallenge: row.key_challenges,
      highlights: row.attractive_points,
      recruitmentDifficulty: row.recruitment_difficulty,
      lastUpdated: row.last_updated
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
