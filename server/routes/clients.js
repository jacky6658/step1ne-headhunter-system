/**
 * clients.js - routes
 */
const express = require('express');
const router = express.Router();
const { pool } = require('../utils/db');
const { sanitizeId, writeLog, syncSQLToSheets } = require('../utils/helpers');

router.param('id', (req, _res, next, value) => {
  req.params.id = sanitizeId(value);
  next();
});

// ==================== BD 客戶開發 API ====================

const BD_STATUSES = ['開發中', '接洽中', '提案中', '合約階段', '合作中', '暫停', '流失'];

/** GET /api/clients - 列表 */
router.get('/clients', async (req, res) => {
  try {
    const { bd_status, consultant } = req.query;
    const client = await pool.connect();
    let query = `
      SELECT c.*,
        COUNT(j.id)::int AS job_count
      FROM clients c
      LEFT JOIN jobs_pipeline j ON j.client_id = c.id
    `;
    const params = [];
    const conditions = [];
    if (bd_status && bd_status !== 'all') { params.push(bd_status); conditions.push(`c.bd_status = $${params.length}`); }
    if (consultant && consultant !== 'all') { params.push(consultant); conditions.push(`c.consultant = $${params.length}`); }
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' GROUP BY c.id ORDER BY c.created_at DESC';
    const result = await client.query(query, params);
    client.release();
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('❌ GET /clients error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/** GET /api/clients/:id - 詳情 */
router.get('/clients/:id', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT * FROM clients WHERE id = $1', [req.params.id]);
    client.release();
    if (!result.rows.length) return res.status(404).json({ success: false, error: 'Client not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** POST /api/clients - 新增客戶 */
router.post('/clients', async (req, res) => {
  try {
    const {
      company_name, industry, company_size, website,
      bd_status = '開發中', bd_source,
      contact_name, contact_title, contact_email, contact_phone, contact_linkedin,
      consultant, contract_type, fee_percentage, contract_start, contract_end, notes
    } = req.body;
    if (!company_name) return res.status(400).json({ success: false, error: '缺少 company_name' });
    const client = await pool.connect();
    const result = await client.query(
      `INSERT INTO clients
        (company_name, industry, company_size, website, bd_status, bd_source,
         contact_name, contact_title, contact_email, contact_phone, contact_linkedin,
         consultant, contract_type, fee_percentage, contract_start, contract_end, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       RETURNING *`,
      [company_name, industry, company_size, website, bd_status, bd_source,
       contact_name, contact_title, contact_email, contact_phone, contact_linkedin,
       consultant, contract_type, fee_percentage, contract_start, contract_end, notes]
    );
    client.release();
    res.json({ success: true, data: result.rows[0], message: '客戶已新增' });
  } catch (error) {
    console.error('❌ POST /clients error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/** PATCH /api/clients/:id - 更新客戶資料 */
router.patch('/clients/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const fields = ['industry','company_size','website','bd_status','bd_source',
      'contact_name','contact_title','contact_email','contact_phone','contact_linkedin',
      'consultant','contract_type','fee_percentage','contract_start','contract_end','notes',
      'url_104','url_1111'];
    const db = await pool.connect();
    const cur = await db.query('SELECT * FROM clients WHERE id = $1', [id]);
    if (!cur.rows.length) { db.release(); return res.status(404).json({ success: false, error: 'Client not found' }); }
    const existing = cur.rows[0];
    const values = fields.map(f => req.body[f] !== undefined ? req.body[f] : existing[f]);
    const result = await db.query(
      `UPDATE clients SET ${fields.map((f, i) => `${f} = $${i + 1}`).join(', ')}, updated_at = NOW()
       WHERE id = $${fields.length + 1} RETURNING *`,
      [...values, id]
    );
    db.release();
    res.json({ success: true, data: result.rows[0], message: '客戶資料已更新' });
  } catch (error) {
    console.error('❌ PATCH /clients/:id error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/clients/:id/status
 * 專用：更新 BD 狀態（AIbot 可呼叫）
 * Body: { bd_status, actor }
 * 當狀態轉為「合作中」時，回應包含 prompt_add_job: true
 */
router.patch('/clients/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { bd_status, actor } = req.body;
    if (!bd_status) return res.status(400).json({ success: false, error: '缺少 bd_status' });
    if (!BD_STATUSES.includes(bd_status)) {
      return res.status(400).json({ success: false, error: `無效狀態，允許值：${BD_STATUSES.join('、')}` });
    }
    const db = await pool.connect();
    const cur = await db.query('SELECT * FROM clients WHERE id = $1', [id]);
    if (!cur.rows.length) { db.release(); return res.status(404).json({ success: false, error: 'Client not found' }); }
    const oldStatus = cur.rows[0].bd_status;
    const result = await db.query(
      'UPDATE clients SET bd_status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [bd_status, id]
    );
    // 寫入 system_logs
    await db.query(
      `INSERT INTO system_logs (action, actor, actor_type, candidate_id, candidate_name, detail)
       VALUES ('BD_STATUS_CHANGE', $1, 'AIBOT', $2, $3, $4)`,
      [actor || 'system', id, cur.rows[0].company_name, JSON.stringify({ field: 'bd_status', old: oldStatus, new: bd_status })]
    ).catch(() => {});
    db.release();
    res.json({
      success: true,
      data: result.rows[0],
      message: `BD 狀態已從「${oldStatus}」更新為「${bd_status}」`,
      changed: { from: oldStatus, to: bd_status },
      prompt_add_job: bd_status === '合作中' && oldStatus !== '合作中'
    });
  } catch (error) {
    console.error('❌ PATCH /clients/:id/status error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/** GET /api/clients/:id/jobs - 該客戶的所有職缺 */
router.get('/clients/:id/jobs', async (req, res) => {
  try {
    const db = await pool.connect();
    const result = await db.query(
      'SELECT * FROM jobs_pipeline WHERE client_id = $1 ORDER BY created_at DESC',
      [req.params.id]
    );
    db.release();
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** GET /api/clients/:id/contacts - 聯絡記錄 */
router.get('/clients/:id/contacts', async (req, res) => {
  try {
    const db = await pool.connect();
    const result = await db.query(
      'SELECT * FROM bd_contacts WHERE client_id = $1 ORDER BY contact_date DESC',
      [req.params.id]
    );
    db.release();
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** POST /api/clients/:id/contacts - 新增聯絡記錄 */
router.post('/clients/:id/contacts', async (req, res) => {
  try {
    const { contact_date, contact_type, summary, next_action, next_action_date, by_user } = req.body;
    if (!contact_date) return res.status(400).json({ success: false, error: '缺少 contact_date' });
    const db = await pool.connect();
    const result = await db.query(
      `INSERT INTO bd_contacts (client_id, contact_date, contact_type, summary, next_action, next_action_date, by_user)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.params.id, contact_date, contact_type, summary, next_action, next_action_date, by_user]
    );
    db.release();
    res.json({ success: true, data: result.rows[0], message: '聯絡記錄已新增' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
