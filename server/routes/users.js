/**
 * users.js - routes
 */
const express = require('express');
const router = express.Router();
const { pool } = require('../utils/db');
const { sanitizeId, writeLog, syncSQLToSheets } = require('../utils/helpers');

router.param('id', (req, _res, next, value) => {
  req.params.id = sanitizeId(value);
  next();
});

router.get('/users', async (req, res) => {
  try {
    // 從 user_contacts 取登入過的顧問
    const uc = await pool.query('SELECT display_name FROM user_contacts ORDER BY display_name');
    // 從 candidates_pipeline 取出現過的 recruiter 名稱（補充未存聯絡資訊的顧問）
    const cp = await pool.query(`
      SELECT DISTINCT recruiter AS display_name
      FROM candidates_pipeline
      WHERE recruiter IS NOT NULL AND recruiter <> '' AND recruiter NOT LIKE 'AIBot%'
      ORDER BY 1
    `);
    const names = Array.from(new Set([
      ...uc.rows.map(r => r.display_name),
      ...cp.rows.map(r => r.display_name),
    ])).filter(Boolean).sort();
    res.json({ success: true, data: names });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/users/register — 顧問登入時自動呼叫，確保顧問名單完整
 * body: { displayName }
 */
router.post('/users/register', async (req, res) => {
  try {
    const { displayName } = req.body;
    if (!displayName) return res.status(400).json({ success: false, error: 'displayName 必填' });
    // upsert：有就更新 updated_at，沒有就新增（不覆蓋其他欄位）
    await pool.query(
      `INSERT INTO user_contacts (display_name, updated_at)
       VALUES ($1, NOW())
       ON CONFLICT (display_name) DO UPDATE SET updated_at = NOW()`,
      [displayName]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/users/:displayName/contact
 * 取得顧問聯絡資訊（供 AIbot 使用）
 */
router.get('/users/:displayName/contact', async (req, res) => {
  try {
    const { displayName } = req.params;
    const result = await pool.query(
      'SELECT * FROM user_contacts WHERE display_name = $1',
      [displayName]
    );
    if (result.rows.length === 0) {
      return res.json({ success: true, data: { display_name: displayName } });
    }
    const row = result.rows[0];
    res.json({
      success: true,
      data: {
        displayName: row.display_name,
        contactPhone: row.contact_phone,
        contactEmail: row.contact_email,
        lineId: row.line_id,
        telegramHandle: row.telegram_handle,
        githubToken: row.github_token,
        linkedinToken: row.linkedin_token,
        braveApiKey: row.brave_api_key,
      }
    });
  } catch (error) {
    console.error('❌ GET /users/:displayName/contact error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/users/:displayName/contact
 * 儲存顧問聯絡資訊（前端儲存設定時呼叫）
 */
router.put('/users/:displayName/contact', async (req, res) => {
  try {
    const { displayName } = req.params;
    const { contactPhone, contactEmail, lineId, telegramHandle, githubToken, linkedinToken, braveApiKey } = req.body;

    await pool.query(`
      INSERT INTO user_contacts (display_name, contact_phone, contact_email, line_id, telegram_handle, github_token, linkedin_token, brave_api_key, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      ON CONFLICT (display_name) DO UPDATE SET
        contact_phone = EXCLUDED.contact_phone,
        contact_email = EXCLUDED.contact_email,
        line_id = EXCLUDED.line_id,
        telegram_handle = EXCLUDED.telegram_handle,
        github_token = EXCLUDED.github_token,
        linkedin_token = EXCLUDED.linkedin_token,
        brave_api_key = EXCLUDED.brave_api_key,
        updated_at = NOW()
    `, [displayName, contactPhone || null, contactEmail || null, lineId || null, telegramHandle || null, githubToken || null, linkedinToken || null, braveApiKey || null]);

    res.json({ success: true, message: '聯絡資訊已儲存' });
  } catch (error) {
    console.error('❌ PUT /users/:displayName/contact error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});


module.exports = router;
