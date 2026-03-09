/**
 * routes-openclaw.js - OpenClaw 批量 API 路由
 *
 * OpenClaw 是獨立的本地 AI 工具，透過這組 API 讀取 Step1ne 中
 * status='爬蟲初篩' 的候選人，做深度分析後回寫結果。
 *
 * 端點：
 *   GET  /api/openclaw/pending       - 取得待分析候選人
 *   POST /api/openclaw/batch-update   - 批量回寫 AI 分析結果
 */

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL ||
  'postgresql://root:etUh2zkR4Mr8gfWLs059S7Dm1T6Yby3Q@tpe1.clusters.zeabur.com:27883/zeabur';

const pool = new Pool({ connectionString: DATABASE_URL });

// ══════════════════════════════════════════════
// 認證 Middleware
// ══════════════════════════════════════════════

const OPENCLAW_API_KEY = process.env.OPENCLAW_API_KEY || 'openclaw-dev-key';

function openclawAuth(req, res, next) {
  const key = req.headers['x-openclaw-key'];
  if (!key || key !== OPENCLAW_API_KEY) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: invalid or missing X-OpenClaw-Key header'
    });
  }
  next();
}

// 所有路由都需要 API Key 認證
router.use(openclawAuth);

// ══════════════════════════════════════════════
// GET /pending - 取得待分析候選人
// ══════════════════════════════════════════════

router.get('/pending', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const offset = parseInt(req.query.offset) || 0;
    const jobId = req.query.job_id;

    let query = `
      SELECT
        id, name, email, phone, location,
        current_position, skills, talent_level,
        source, linkedin_url, github_url,
        work_history, education_details,
        ai_match_result, ai_score, ai_grade, ai_report, ai_recommendation,
        notes, target_job_id, status, recruiter,
        created_at, updated_at
      FROM candidates_pipeline
      WHERE status = '爬蟲初篩'
    `;
    const params = [];
    let paramIdx = 1;

    if (jobId) {
      query += ` AND target_job_id = $${paramIdx}`;
      params.push(parseInt(jobId));
      paramIdx++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // 取得總數
    let countQuery = `SELECT COUNT(*) FROM candidates_pipeline WHERE status = '爬蟲初篩'`;
    const countParams = [];
    if (jobId) {
      countQuery += ` AND target_job_id = $1`;
      countParams.push(parseInt(jobId));
    }
    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        total,
        limit,
        offset,
        has_more: offset + limit < total
      }
    });
  } catch (err) {
    console.error('❌ OpenClaw GET /pending error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ══════════════════════════════════════════════
// POST /batch-update - 批量回寫 AI 分析結果
// ══════════════════════════════════════════════

router.post('/batch-update', async (req, res) => {
  try {
    const { candidates } = req.body;

    if (!Array.isArray(candidates) || candidates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Request body must contain a non-empty "candidates" array'
      });
    }

    if (candidates.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 100 candidates per batch'
      });
    }

    const client = await pool.connect();
    const results = { updated: 0, failed: 0, errors: [] };

    try {
      await client.query('BEGIN');

      for (const c of candidates) {
        try {
          if (!c.id) {
            results.failed++;
            results.errors.push({ id: null, error: 'Missing candidate id' });
            continue;
          }

          // 動態建構 SET 子句，只更新有提供的欄位
          const setClauses = [];
          const values = [];
          let idx = 1;

          const allowedFields = {
            ai_match_result: 'jsonb',
            ai_score: 'int',
            ai_grade: 'text',
            ai_report: 'text',
            ai_recommendation: 'text',
            status: 'text',
            talent_level: 'text',
            notes: 'text',
          };

          for (const [field, type] of Object.entries(allowedFields)) {
            if (c[field] !== undefined) {
              if (type === 'jsonb') {
                setClauses.push(`${field} = $${idx}::jsonb`);
                values.push(typeof c[field] === 'string' ? c[field] : JSON.stringify(c[field]));
              } else if (type === 'int') {
                setClauses.push(`${field} = $${idx}`);
                values.push(parseInt(c[field]) || 0);
              } else {
                setClauses.push(`${field} = $${idx}`);
                values.push(c[field]);
              }
              idx++;
            }
          }

          if (setClauses.length === 0) {
            results.failed++;
            results.errors.push({ id: c.id, error: 'No updatable fields provided' });
            continue;
          }

          // 加入 updated_at
          setClauses.push(`updated_at = NOW()`);

          // 加入 progress_tracking 記錄
          setClauses.push(`progress_tracking = COALESCE(progress_tracking, '[]'::jsonb) || $${idx}::jsonb`);
          values.push(JSON.stringify([{
            event: c.status || 'AI分析完成',
            by: 'OpenClaw',
            at: new Date().toISOString(),
            note: c.ai_grade ? `AI評等: ${c.ai_grade}` : 'AI 分析回寫'
          }]));
          idx++;

          values.push(c.id);
          const updateQuery = `
            UPDATE candidates_pipeline
            SET ${setClauses.join(', ')}
            WHERE id = $${idx}
          `;

          const updateResult = await client.query(updateQuery, values);
          if (updateResult.rowCount > 0) {
            results.updated++;
          } else {
            results.failed++;
            results.errors.push({ id: c.id, error: 'Candidate not found' });
          }
        } catch (rowErr) {
          results.failed++;
          results.errors.push({ id: c.id, error: rowErr.message });
        }
      }

      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }

    res.json({
      success: true,
      results
    });
  } catch (err) {
    console.error('❌ OpenClaw POST /batch-update error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
