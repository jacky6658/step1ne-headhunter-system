/**
 * routes-api.js - 完整 API 路由（candidates + jobs）
 * 整合 SQL 資料層
 */

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const https = require('https');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const DATABASE_URL = process.env.DATABASE_URL || 
  'postgresql://root:etUh2zkR4Mr8gfWLs059S7Dm1T6Yby3Q@tpe1.clusters.zeabur.com:27883/zeabur';

const pool = new Pool({ connectionString: DATABASE_URL });

// 確保 progress_tracking 欄位存在
pool.query(`
  ALTER TABLE candidates_pipeline
  ADD COLUMN IF NOT EXISTS progress_tracking JSONB DEFAULT '[]'
`).catch(err => console.warn('progress_tracking migration:', err.message));

// ==================== SQL → Google Sheets 同步 ====================

const GOG_SHEET_ID = process.env.SHEET_ID || '1PunpaDAFBPBL_I76AiRYGXKaXDZvMl1c262SEtxRk6Q';
const GOG_SHEET_NAME = 'candidates';

/**
 * SQL → Sheets 非同步同步（匯入後自動觸發）
 * 新增的人選 → append 到 Sheets
 * 更新的人選 → 找到行號並更新
 */
async function syncSQLToSheets(candidateRows) {
  if (!candidateRows || candidateRows.length === 0) return;

  // 檢查 gog 是否可用
  try {
    await execPromise('which gog', { timeout: 5000 });
  } catch {
    console.warn('⚠️ gog CLI 不可用，跳過 Sheets 同步');
    return;
  }

  console.log(`📤 SQL → Sheets 同步 ${candidateRows.length} 筆...`);

  for (const row of candidateRows) {
    try {
      // 從 SQL 取得完整資料
      const full = await pool.query('SELECT * FROM candidates_pipeline WHERE id = $1', [row.id]);
      if (full.rows.length === 0) continue;
      const c = full.rows[0];

      // 先搜尋 Sheets 中是否已有此人
      let sheetsRowNum = null;
      try {
        const { stdout } = await execPromise(
          `gog sheets get "${GOG_SHEET_ID}" "${GOG_SHEET_NAME}!A2:A1000" --json`,
          { timeout: 15000, maxBuffer: 5 * 1024 * 1024 }
        );
        const names = JSON.parse(stdout);
        const idx = names.findIndex(r => (r[0] || '').trim().toLowerCase() === (c.name || '').trim().toLowerCase());
        if (idx >= 0) sheetsRowNum = idx + 2; // 第 2 行開始
      } catch (e) {
        console.warn(`⚠️ Sheets 查詢失敗: ${e.message}`);
      }

      // 構建行資料（A-W 共 23 欄）
      const rowData = [
        c.name || '',                                   // A 姓名
        '',                                             // B Email
        c.phone || '',                                  // C 電話
        c.location || '',                               // D 地點
        c.current_position || '',                       // E 職位
        c.years_experience || '',                       // F 年資
        c.job_changes || '',                            // G 轉職次數
        c.avg_tenure_months || '',                      // H 平均任職
        c.recent_gap_months || '',                      // I 最近gap
        c.skills || '',                                 // J 技能
        c.education || '',                              // K 學歷
        c.source || '',                                 // L 來源
        c.work_history ? JSON.stringify(c.work_history) : '', // M 工作經歷
        c.leaving_reason || '',                         // N 離職原因
        c.stability_score || '',                        // O 穩定性
        c.education_details ? JSON.stringify(c.education_details) : '', // P 學歷JSON
        c.personality_type || '',                       // Q DISC
        c.status || '未開始',                             // R 狀態
        c.recruiter || '',                              // S 顧問
        c.notes || '',                                  // T 備註
        c.contact_link || '',                           // U 履歷連結
        c.talent_level || '',                           // V 人才等級
        c.progress_tracking ? JSON.stringify(c.progress_tracking) : '' // W 進度
      ].map(v => String(v).replace(/\n/g, ' ').replace(/\r/g, ' ').replace(/"/g, "'")).join('|');

      if (sheetsRowNum) {
        // 更新既有行
        const cleanData = rowData.replace(/"/g, '\\"');
        await execPromise(
          `gog sheets update "${GOG_SHEET_ID}" "${GOG_SHEET_NAME}!A${sheetsRowNum}:W${sheetsRowNum}" "${cleanData}"`,
          { timeout: 15000 }
        );
        console.log(`  ✅ Sheets 更新: ${c.name} (row ${sheetsRowNum})`);
      } else {
        // 新增行
        const cleanData = rowData.replace(/"/g, '\\"');
        await execPromise(
          `gog sheets append "${GOG_SHEET_ID}" "${GOG_SHEET_NAME}" "${cleanData}"`,
          { timeout: 15000 }
        );
        console.log(`  ✅ Sheets 新增: ${c.name}`);
      }

      // 延遲 2 秒，避免 Google API 限流
      await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
      console.warn(`  ⚠️ Sheets 同步 ${row.name} 失敗: ${err.message}`);
    }
  }

  console.log('📤 SQL → Sheets 同步完成');
}

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
        progress_tracking,
        created_at,
        updated_at
      FROM candidates_pipeline
      ORDER BY id ASC
      LIMIT 1000
    `);

    const candidates = result.rows.map(row => ({
      // 基本必需欄位（Candidate interface）
      id: row.id.toString(),
      name: row.name || '',
      email: '', // 數據庫沒有，使用空值
      phone: row.phone || '',
      location: row.location || '', // 數據庫沒有，使用空值
      position: row.current_position || '',
      years: isNaN(parseInt(row.years_experience)) ? 0 : parseInt(row.years_experience),
      jobChanges: isNaN(parseInt(row.job_changes)) ? 0 : parseInt(row.job_changes),
      avgTenure: isNaN(parseInt(row.avg_tenure_months)) ? 0 : parseInt(row.avg_tenure_months),
      lastGap: isNaN(parseInt(row.recent_gap_months)) ? 0 : parseInt(row.recent_gap_months),
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
      resumeLink: row.contact_link || '',
      workHistory: row.work_history || [],
      quitReasons: row.leaving_reason || '',
      educationJson: row.education_details || [],
      discProfile: row.personality_type || '',
      progressTracking: row.progress_tracking || [],
      
      // 向後相容：保留 DB 字段名
      contact_link: row.contact_link || '',
      current_position: row.current_position || '',
      years_experience: row.years_experience || '',
      job_changes: row.job_changes || '',
      avg_tenure_months: row.avg_tenure_months || '',
      recent_gap_months: row.recent_gap_months || '',
      work_history: row.work_history || [],
      leaving_reason: row.leaving_reason || '',
      stability_score: row.stability_score || '',
      education_details: row.education_details || [],
      personality_type: row.personality_type || '',
      recruiter: row.recruiter || 'Jacky',
      talent_level: row.talent_level || ''
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
    const { status, notes, consultant, name, progressTracking } = req.body;

    const client = await pool.connect();

    const result = await client.query(
      `UPDATE candidates_pipeline
       SET status = $1, notes = $2, recruiter = $3,
           progress_tracking = $4, updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [status || '', notes || '', consultant || '',
       JSON.stringify(progressTracking || []), id]
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
 * PATCH /api/candidates/:id
 * 局部更新候選人（支援欄位：status, progressTracking, recruiter, notes, talent_level, name）
 * 適用於前端操作及 AIbot 呼叫
 */
router.patch('/candidates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, progressTracking, recruiter, notes, talent_level, name } = req.body;

    const client = await pool.connect();

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

    const validStatuses = ['未開始', '已聯繫', '已面試', 'Offer', '已上職', '婉拒', '其他'];
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
          updated_at = NOW()
        WHERE id = $19
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
          existing.rows[0].id
        ]
      );
    } else {
      // 新人選 → 建立
      action = 'created';
      result = await client.query(
        `INSERT INTO candidates_pipeline
         (name, phone, contact_link, location, current_position, years_experience,
          skills, education, source, status, recruiter, notes,
          stability_score, personality_type, job_changes, avg_tenure_months,
          recent_gap_months, work_history, education_details, leaving_reason,
          talent_level, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,NOW(),NOW())
         RETURNING id, name, contact_link, current_position, status`,
        [
          c.name.trim(), c.phone || '', c.contact_link || '', c.location || '',
          c.current_position || '', String(c.years_experience || '0'),
          c.skills || '', c.education || '', c.source || 'GitHub',
          c.status || '未開始', c.recruiter || 'Jacky', c.notes || '',
          String(c.stability_score || '0'), c.personality_type || '',
          String(c.job_changes || '0'), String(c.avg_tenure_months || '0'),
          String(c.recent_gap_months || '0'),
          c.work_history ? JSON.stringify(c.work_history) : null,
          c.education_details ? JSON.stringify(c.education_details) : null,
          c.leaving_reason || '', c.talent_level || ''
        ]
      );
    }

    client.release();

    // 非同步觸發 SQL → Sheets 同步
    syncSQLToSheets([result.rows[0]]).catch(err =>
      console.warn('⚠️ Sheets sync failed (non-blocking):', err.message)
    );

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
    const { candidates } = req.body;

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
              updated_at = NOW()
            WHERE id = $19
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
              existingId
            ]
          );
          results.updated.push(result.rows[0]);
        } else {
          // 新人選 → 建立
          const result = await client.query(
            `INSERT INTO candidates_pipeline
             (name, phone, contact_link, location, current_position, years_experience,
              skills, education, source, status, recruiter, notes,
              stability_score, personality_type, job_changes, avg_tenure_months,
              recent_gap_months, work_history, education_details, leaving_reason,
              talent_level, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, NOW(), NOW())
             RETURNING id, name, contact_link, current_position, status`,
            [
              c.name.trim(),
              c.phone || '',
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
              (notes || '').trim(),
              trunc(talentGrade, 50),
              existingId
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
              created_at, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,NOW(),NOW())`,
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
              (notes || '').trim(),
              trunc(talentGrade, 50),
              parsedProgress
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
