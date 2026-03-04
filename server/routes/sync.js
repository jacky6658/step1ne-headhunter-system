/**
 * sync.js - routes
 */
const express = require('express');
const router = express.Router();
const { pool } = require('../utils/db');
const { sanitizeId, writeLog, syncSQLToSheets } = require('../utils/helpers');

router.param('id', (req, _res, next, value) => {
  req.params.id = sanitizeId(value);
  next();
});

const https = require('https');

// ==================== 同步 API ====================

const SHEET_ID = process.env.SHEET_ID || '1PunpaDAFBPBL_I76AiRYGXKaXDZvMl1c262SEtxRk6Q';
const CANDIDATES_TAB_GID = process.env.TAB_GID || '142613837';

/**
 * 從 Google Sheets 匯出 CSV（處理重定向）
 */
function fetchSheetAsCSV() {
  return new Promise((resolve, reject) => {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${CANDIDATES_TAB_GID}`;

    const follow = (targetUrl) => {
      https.get(targetUrl, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) {
          return follow(res.headers.location);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode}: 無法存取 Google Sheets`));
        }
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
      }).on('error', reject);
    };

    follow(url);
  });
}

/**
 * 簡單 CSV 解析（處理引號和逗號）
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

/**
 * POST /api/sync/sheets-to-sql
 * 從 Google Sheets 讀取最新資料並同步到 SQL
 */
router.post('/sync/sheets-to-sql', async (req, res) => {
  try {
    console.log('🔄 開始 Google Sheets → SQL 同步...');

    // 1. 從 Google Sheets 讀取 CSV
    const csvText = await fetchSheetAsCSV();
    const lines = csvText.split('\n').filter(line => line.trim());
    const rows = lines.slice(1); // 跳過標題行

    console.log(`📊 從 Sheets 讀取到 ${rows.length} 行資料`);

    // 2. 取得 SQL 中所有現有候選人（用 name 做比對）
    const client = await pool.connect();
    const existing = await client.query('SELECT id, name FROM candidates_pipeline');
    const existingMap = new Map();
    for (const row of existing.rows) {
      const key = (row.name || '').trim().toLowerCase();
      if (key) existingMap.set(key, row.id);
    }

    const results = { updated: 0, created: 0, skipped: 0, errors: [] };

    for (const line of rows) {
      try {
        const fields = parseCSVLine(line);
        const [
          name, email, phone, location, currentPosition,
          totalYears, jobChanges, avgTenure, recentGap,
          skills, education, source, workHistory, leaveReason,
          stabilityScore, educationDetail, personality,
          status, consultant, notes, resumeLink, talentGrade, progressTracking
        ] = fields;

        if (!name || !name.trim()) {
          results.skipped++;
          continue;
        }

        const trimmedName = name.trim().substring(0, 255);
        const nameKey = trimmedName.toLowerCase();

        // 截斷超長欄位，防止 varchar 溢出
        const trunc = (val, max = 255) => (val || '').trim().substring(0, max);

        // 解析 JSON 欄位
        let parsedWorkHistory = null;
        if (workHistory && workHistory.trim()) {
          try { parsedWorkHistory = JSON.parse(workHistory); } catch (e) { /* ignore */ }
        }
        let parsedEducationDetail = null;
        if (educationDetail && educationDetail.trim()) {
          try { parsedEducationDetail = JSON.parse(educationDetail); } catch (e) { /* ignore */ }
        }
        let parsedProgress = '[]';
        if (progressTracking && progressTracking.trim()) {
          try { JSON.parse(progressTracking); parsedProgress = progressTracking.trim(); } catch (e) { /* ignore */ }
        }

        // ── 從 Sheets 欄位偵測 LinkedIn / GitHub URL ──────────────────
        // B欄 (email 變數)：「連結/信箱」— 可能是 LinkedIn URL 或真實 email
        // T欄 (notes 變數)：「備註」— 可能含 GitHub URL 或 LinkedIn: https://...
        const emailVal = (email || '').trim();
        const notesVal = (notes || '').trim();

        let sheetLinkedin = '';
        let sheetGithub   = '';

        // 從 email 欄(B欄)抓 LinkedIn URL
        const liInEmail = emailVal.match(/(https?:\/\/(www\.)?linkedin\.com\/[^\s"'<>]+)/i);
        if (liInEmail) sheetLinkedin = liInEmail[1].replace(/[,;]+$/, '');

        // 從 notes 欄(T欄)抓 GitHub URL
        const ghInNotes = notesVal.match(/(https?:\/\/(www\.)?github\.com\/[^\s"'<>]+)/i);
        if (ghInNotes) sheetGithub = ghInNotes[1].replace(/[,;]+$/, '');

        // 若 notes 欄也含 LinkedIn（"LinkedIn: https://..."），且 email 欄未提供
        if (!sheetLinkedin) {
          const liInNotes = notesVal.match(/(https?:\/\/(www\.)?linkedin\.com\/[^\s"'<>]+)/i);
          if (liInNotes) sheetLinkedin = liInNotes[1].replace(/[,;]+$/, '');
          if (!sheetLinkedin) {
            const liText = notesVal.match(/LinkedIn[:\s]+(https?:\/\/[^\s,;]+)/i);
            if (liText) sheetLinkedin = liText[1].replace(/[,;]+$/, '');
          }
        }

        if (existingMap.has(nameKey)) {
          // UPDATE：已存在的候選人 — 用 Sheets 資料更新
          const existingId = existingMap.get(nameKey);
          if (typeof existingId !== 'number') {
            // 已在本次同步中插入過的重複姓名，跳過
            results.skipped++;
            continue;
          }
          await client.query(
            `UPDATE candidates_pipeline SET
              phone = COALESCE(NULLIF($1, ''), phone),
              contact_link = COALESCE(NULLIF($2, ''), contact_link),
              location = COALESCE(NULLIF($3, ''), location),
              current_position = COALESCE(NULLIF($4, ''), current_position),
              years_experience = COALESCE(NULLIF($5, ''), years_experience),
              job_changes = COALESCE(NULLIF($6, ''), job_changes),
              avg_tenure_months = COALESCE(NULLIF($7, ''), avg_tenure_months),
              recent_gap_months = COALESCE(NULLIF($8, ''), recent_gap_months),
              skills = COALESCE(NULLIF($9, ''), skills),
              education = COALESCE(NULLIF($10, ''), education),
              source = COALESCE(NULLIF($11, ''), source),
              work_history = COALESCE($12, work_history),
              leaving_reason = COALESCE(NULLIF($13, ''), leaving_reason),
              stability_score = COALESCE(NULLIF($14, ''), stability_score),
              education_details = COALESCE($15, education_details),
              personality_type = COALESCE(NULLIF($16, ''), personality_type),
              status = COALESCE(NULLIF($17, ''), status),
              recruiter = COALESCE(NULLIF($18, ''), recruiter),
              notes = COALESCE(NULLIF($19, ''), notes),
              talent_level = COALESCE(NULLIF($20, ''), talent_level),
              linkedin_url = COALESCE(NULLIF($22, ''), linkedin_url),
              github_url   = COALESCE(NULLIF($23, ''), github_url),
              updated_at = NOW()
            WHERE id = $21`,
            [
              trunc(phone, 50),
              trunc(resumeLink, 500),
              trunc(location, 100),
              trunc(currentPosition),
              trunc(totalYears, 50),
              trunc(jobChanges, 50),
              trunc(avgTenure, 50),
              trunc(recentGap, 50),
              (skills || '').trim(),
              trunc(education, 100),
              trunc(source, 100),
              parsedWorkHistory ? JSON.stringify(parsedWorkHistory) : null,
              (leaveReason || '').trim(),
              trunc(stabilityScore, 50),
              parsedEducationDetail ? JSON.stringify(parsedEducationDetail) : null,
              trunc(personality, 100),
              trunc(status, 50),
              trunc(consultant, 100),
              notesVal,
              trunc(talentGrade, 50),
              existingId,
              trunc(sheetLinkedin, 500),
              trunc(sheetGithub, 500),
            ]
          );
          results.updated++;
        } else {
          // INSERT：新候選人
          await client.query(
            `INSERT INTO candidates_pipeline
             (name, phone, contact_link, location, current_position, years_experience,
              job_changes, avg_tenure_months, recent_gap_months, skills, education, source,
              work_history, leaving_reason, stability_score, education_details,
              personality_type, status, recruiter, notes, talent_level, progress_tracking,
              linkedin_url, github_url,
              created_at, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,NOW(),NOW())`,
            [
              trimmedName,
              trunc(phone, 50),
              trunc(resumeLink, 500),
              trunc(location, 100),
              trunc(currentPosition),
              trunc(totalYears, 50),
              trunc(jobChanges, 50),
              trunc(avgTenure, 50),
              trunc(recentGap, 50),
              (skills || '').trim(),
              trunc(education, 100),
              trunc(source, 100),
              parsedWorkHistory ? JSON.stringify(parsedWorkHistory) : null,
              (leaveReason || '').trim(),
              trunc(stabilityScore, 50),
              parsedEducationDetail ? JSON.stringify(parsedEducationDetail) : null,
              trunc(personality, 100),
              trunc(status || '未開始', 50),
              trunc(consultant, 100),
              notesVal,
              trunc(talentGrade, 50),
              parsedProgress,
              trunc(sheetLinkedin, 500),
              trunc(sheetGithub, 500),
            ]
          );
          existingMap.set(nameKey, 'inserted'); // 標記已插入，避免同名重複
          results.created++;
        }
      } catch (err) {
        results.errors.push(err.message);
      }
    }

    client.release();

    console.log(`✅ Sheets → SQL 同步完成: 更新 ${results.updated}, 新增 ${results.created}, 跳過 ${results.skipped}`);

    res.json({
      success: true,
      message: `同步完成：更新 ${results.updated} 筆，新增 ${results.created} 筆，跳過 ${results.skipped} 筆`,
      ...results
    });
  } catch (error) {
    console.error('❌ POST /sync/sheets-to-sql error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== 系統日誌 API ====================

/**
 * GET /api/system-logs
 * 查詢操作日誌
 * Query params:
 *   limit  - 回傳筆數，預設 200，最大 1000
 *   actor  - 篩選操作者（模糊比對）
 *   action - 篩選操作類型（PIPELINE_CHANGE / IMPORT_CREATE / IMPORT_UPDATE / BULK_IMPORT / UPDATE）
 *   type   - 篩選操作者類型（HUMAN / AIBOT）
 */
router.get('/system-logs', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 200, 1000);
    const { actor, action, type } = req.query;

    const conditions = [];
    const values = [];
    let idx = 1;

    if (actor) {
      conditions.push(`actor ILIKE $${idx++}`);
      values.push(`%${actor}%`);
    }
    if (action) {
      conditions.push(`action = $${idx++}`);
      values.push(action);
    }
    if (type) {
      conditions.push(`actor_type = $${idx++}`);
      values.push(type.toUpperCase());
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    values.push(limit);

    const result = await pool.query(
      `SELECT id, action, actor, actor_type, candidate_id, candidate_name, detail, created_at
       FROM system_logs
       ${where}
       ORDER BY created_at DESC
       LIMIT $${idx}`,
      values
    );

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('❌ GET /system-logs error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 系統 API ====================

/**
 * GET /api/health
 * 健康檢查
 */
router.get('/health', async (req, res) => {
  let dbStatus = 'connected';
  try {
    const client = await Promise.race([
      pool.connect(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
    ]);
    await client.query('SELECT 1');
    client.release();
  } catch (error) {
    dbStatus = 'unavailable';
  }
  // 始終回 200，讓 Zeabur startup probe 通過；DB 狀態在 body 中說明
  res.json({
    success: true,
    status: 'ok',
    database: dbStatus,
    timestamp: new Date().toISOString()
  });
});

// ==================== 顧問聯絡資訊 API ====================

/**
 * GET /api/users — 取得所有顧問名單（從 user_contacts + candidates recruiter 合併去重）
 */

module.exports = router;
