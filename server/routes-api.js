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

/**
 * 清洗 URL param 中的 id：移除 AI Bot 可能帶來的多餘 JSON 引號
 * e.g. '"184"' → '184'，'\"184\"' → '184'
 * 使用 router.param() 讓所有路由自動套用，無需逐一修改。
 */
function sanitizeId(rawId) {
  if (rawId == null) return rawId;
  return String(rawId).replace(/^["']+|["']+$/g, '').trim();
}

// 全局 id 參數清洗：所有 :id 路由在進入 handler 前自動去除多餘引號
router.param('id', (req, _res, next, value) => {
  req.params.id = sanitizeId(value);
  next();
});

// 確保 progress_tracking 欄位存在
pool.query(`
  ALTER TABLE candidates_pipeline
  ADD COLUMN IF NOT EXISTS progress_tracking JSONB DEFAULT '[]'
`).catch(err => console.warn('progress_tracking migration:', err.message));

// 確保 linkedin_url / github_url / email 欄位存在
pool.query(`
  ALTER TABLE candidates_pipeline
  ADD COLUMN IF NOT EXISTS linkedin_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS github_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS email VARCHAR(255)
`).catch(err => console.warn('linkedin_url/github_url/email migration:', err.message));

// 確保 ai_match_result 欄位存在
pool.query(`
  ALTER TABLE candidates_pipeline
  ADD COLUMN IF NOT EXISTS ai_match_result JSONB
`).catch(err => console.warn('ai_match_result migration:', err.message));

// 確保 system_logs 資料表存在
pool.query(`
  CREATE TABLE IF NOT EXISTS system_logs (
    id SERIAL PRIMARY KEY,
    action VARCHAR(50) NOT NULL,
    actor VARCHAR(100) NOT NULL,
    actor_type VARCHAR(10) NOT NULL DEFAULT 'HUMAN',
    candidate_id INTEGER,
    candidate_name VARCHAR(255),
    detail JSONB,
    created_at TIMESTAMP DEFAULT NOW()
  )
`).catch(err => console.warn('system_logs migration:', err.message));

// 確保 user_contacts 資料表存在
pool.query(`
  CREATE TABLE IF NOT EXISTS user_contacts (
    display_name VARCHAR(100) PRIMARY KEY,
    contact_phone VARCHAR(50),
    contact_email VARCHAR(255),
    line_id VARCHAR(100),
    telegram_handle VARCHAR(100),
    updated_at TIMESTAMP DEFAULT NOW()
  )
`).catch(err => console.warn('user_contacts migration:', err.message));

// 確保 github_token 欄位存在
pool.query(`
  ALTER TABLE user_contacts
  ADD COLUMN IF NOT EXISTS github_token VARCHAR(500)
`).catch(err => console.warn('github_token migration:', err.message));

// 確保 linkedin_token 欄位存在（保留欄位，未使用）
pool.query(`
  ALTER TABLE user_contacts
  ADD COLUMN IF NOT EXISTS linkedin_token TEXT
`).catch(err => console.warn('linkedin_token migration:', err.message));

// 確保 brave_api_key 欄位存在（Brave Search API）
pool.query(`
  ALTER TABLE user_contacts
  ADD COLUMN IF NOT EXISTS brave_api_key VARCHAR(500)
`).catch(err => console.warn('brave_api_key migration:', err.message));

// 確保 job_description 欄位存在（職缺完整 JD）
pool.query(`
  ALTER TABLE jobs_pipeline
  ADD COLUMN IF NOT EXISTS job_description TEXT
`).catch(err => console.warn('job_description migration:', err.message));

// 確保爬蟲搜尋設定欄位存在（公司畫像、人才畫像、搜尋關鍵字）
pool.query(`
  ALTER TABLE jobs_pipeline ADD COLUMN IF NOT EXISTS company_profile TEXT;
  ALTER TABLE jobs_pipeline ADD COLUMN IF NOT EXISTS talent_profile TEXT;
  ALTER TABLE jobs_pipeline ADD COLUMN IF NOT EXISTS search_primary TEXT;
  ALTER TABLE jobs_pipeline ADD COLUMN IF NOT EXISTS search_secondary TEXT;
`).catch(err => console.warn('search profile migration:', err.message));

// 確保 104 富文本欄位存在（福利、上班時段、休假制度、遠端、出差、連結）
pool.query(`
  ALTER TABLE jobs_pipeline ADD COLUMN IF NOT EXISTS welfare_tags TEXT;
  ALTER TABLE jobs_pipeline ADD COLUMN IF NOT EXISTS welfare_detail TEXT;
  ALTER TABLE jobs_pipeline ADD COLUMN IF NOT EXISTS work_hours TEXT;
  ALTER TABLE jobs_pipeline ADD COLUMN IF NOT EXISTS vacation_policy TEXT;
  ALTER TABLE jobs_pipeline ADD COLUMN IF NOT EXISTS remote_work TEXT;
  ALTER TABLE jobs_pipeline ADD COLUMN IF NOT EXISTS business_trip TEXT;
  ALTER TABLE jobs_pipeline ADD COLUMN IF NOT EXISTS job_url TEXT;
`).catch(err => console.warn('104 fields migration:', err.message));

// 確保 github_analysis_cache 欄位存在（GitHub v2 分析快取）
pool.query(`
  ALTER TABLE candidates_pipeline ADD COLUMN IF NOT EXISTS github_analysis_cache JSONB;
`).catch(err => console.warn('github_analysis_cache migration:', err.message));

// 目標職缺欄位：改為直接 FK 對應 jobs_pipeline（不再存在 notes 文字內）
pool.query(`
  ALTER TABLE candidates_pipeline
  ADD COLUMN IF NOT EXISTS target_job_id INTEGER REFERENCES jobs_pipeline(id) ON DELETE SET NULL
`).catch(err => console.warn('target_job_id migration:', err.message));

// 一次性資料清理：target_job_id 指向不存在職缺的候選人 → 清為 NULL（顯示「未指定」）
pool.query(`
  UPDATE candidates_pipeline
  SET target_job_id = NULL
  WHERE target_job_id IS NOT NULL
    AND target_job_id NOT IN (SELECT id FROM jobs_pipeline)
`).then(r => {
  if (r.rowCount > 0) {
    console.log(`✅ 孤立職缺清理：${r.rowCount} 位候選人的 target_job_id 已重設為 NULL（職缺不存在）`);
  }
}).catch(err => console.warn('orphan target_job_id cleanup:', err.message));

// 一次性資料清理：將歷史遺留的「待聯繫」「待審核」狀態統一轉為「未開始」，顧問設為「待指派」
pool.query(`
  UPDATE candidates_pipeline
  SET status = '未開始',
      recruiter = '待指派',
      updated_at = NOW()
  WHERE status IN ('待聯繫', '待審核')
`).then(r => {
  if (r.rowCount > 0) {
    console.log(`✅ 歷史狀態清理：${r.rowCount} 位「待聯繫/待審核」候選人已轉為「未開始/待指派」`);
  }
}).catch(err => console.warn('legacy status migration:', err.message));

// 確保 bot_config 資料表存在（Bot 排程設定）
pool.query(`
  CREATE TABLE IF NOT EXISTS bot_config (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB,
    updated_at TIMESTAMP DEFAULT NOW()
  )
`).catch(err => console.warn('bot_config migration:', err.message));

// 寫入 system_logs 輔助函數
async function writeLog({ action, actor, candidateId, candidateName, detail }) {
  // 判斷 AIBOT：包含 "aibot" 或以 "bot" 結尾（如 Jackeybot、Phoebebot）
  const actorType = /aibot|bot$/i.test(actor) ? 'AIBOT' : 'HUMAN';
  try {
    await pool.query(
      `INSERT INTO system_logs (action, actor, actor_type, candidate_id, candidate_name, detail)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [action, actor || 'system', actorType, candidateId || null, candidateName || null,
       detail ? JSON.stringify(detail) : null]
    );
  } catch (err) {
    console.warn('⚠️ writeLog 失敗（非阻塞）:', err.message);
  }
}

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

    // 支援查詢參數篩選
    const { status, limit, created_today } = req.query;
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
      LIMIT ${limitVal}
    `, params);

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

// ==================== AI 指南端點 ====================

/**
 * GET /api/guide
 * 回傳 AIbot 操作指南（Markdown 格式）
 * AIbot 可透過此端點學習所有 API 端點、欄位說明、評分標準
 */
const fs = require('fs');
const path = require('path');

router.get('/guide', (req, res) => {
  try {
    const guidePath = path.join(__dirname, 'guides/AIBOT-API-GUIDE.md');
    if (!fs.existsSync(guidePath)) {
      return res.status(404).json({ success: false, error: 'Guide file not found' });
    }
    const content = fs.readFileSync(guidePath, 'utf-8');
    // 根據 Accept 標頭決定回傳格式
    const accept = req.headers['accept'] || '';
    if (accept.includes('application/json')) {
      res.json({ success: true, content });
    } else {
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.send(content);
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/migrate/extract-links — 從舊欄位 (email / notes / phone / contact_link) 提取 LinkedIn / GitHub 連結到專屬欄位
// Google Sheets 欄位對應：B欄(連結/信箱) → email 欄位(含LinkedIn URL) / T欄(備註) → notes 欄位(含GitHub URL)
router.post('/migrate/extract-links', async (req, res) => {
  try {
    // 取出 linkedin_url 或 github_url 為空的所有候選人，同時讀取 email 欄位（Sheets B欄）
    const result = await pool.query(`
      SELECT id, name, email, phone, contact_link, notes, linkedin_url, github_url
      FROM candidates_pipeline
      WHERE (linkedin_url IS NULL OR linkedin_url = '')
         OR (github_url IS NULL OR github_url = '')
    `);

    let updated = 0;
    const details = [];

    for (const row of result.rows) {
      const email       = (row.email        || '').trim();
      const phone       = (row.phone        || '').trim();
      const contactLink = (row.contact_link || '').trim();
      const notes       = (row.notes        || '').trim();

      let newLinkedin = (row.linkedin_url || '').trim();
      let newGithub   = (row.github_url   || '').trim();

      // ── LinkedIn 提取 ─────────────────────────────────
      if (!newLinkedin) {
        // 1. email 欄位（Sheets B欄「連結/信箱」，常直接存 LinkedIn URL）
        const liInEmail = email.match(/(https?:\/\/(www\.)?linkedin\.com\/[^\s"'<>]+)/i);
        if (liInEmail) newLinkedin = liInEmail[1].replace(/[,;]+$/, '');
      }

      if (!newLinkedin) {
        // 2. notes 欄位（Sheets T欄「備註」，格式如 "LinkedIn: https://..."）
        const liInNotes = notes.match(/(https?:\/\/(www\.)?linkedin\.com\/[^\s"'<>]+)/i);
        if (liInNotes) newLinkedin = liInNotes[1].replace(/[,;]+$/, '');
        if (!newLinkedin) {
          const liTextInNotes = notes.match(/LinkedIn[:\s]+(https?:\/\/[^\s,;]+)/i);
          if (liTextInNotes) newLinkedin = liTextInNotes[1].replace(/[,;]+$/, '');
        }
      }

      if (!newLinkedin) {
        // 3. phone 或 contact_link 欄位（舊資料備用）
        const liInOther = (phone + ' ' + contactLink).match(/(https?:\/\/(www\.)?linkedin\.com\/[^\s"'<>]+)/i);
        if (liInOther) newLinkedin = liInOther[1].replace(/[,;]+$/, '');
      }

      // ── GitHub 提取 ───────────────────────────────────
      if (!newGithub) {
        // 1. notes 欄位（Sheets T欄「備註」，常直接存 GitHub URL）
        const ghInNotes = notes.match(/(https?:\/\/(www\.)?github\.com\/[^\s"'<>]+)/i);
        if (ghInNotes) newGithub = ghInNotes[1].replace(/[,;]+$/, '');
        if (!newGithub) {
          const ghTextInNotes = notes.match(/GitHub[:\s]+(https?:\/\/[^\s,;]+)/i);
          if (ghTextInNotes) newGithub = ghTextInNotes[1].replace(/[,;]+$/, '');
        }
      }

      if (!newGithub) {
        // 2. phone 或 contact_link 欄位（舊資料備用）
        const ghInOther = (phone + ' ' + contactLink).match(/(https?:\/\/(www\.)?github\.com\/[^\s"'<>]+)/i);
        if (ghInOther) newGithub = ghInOther[1].replace(/[,;]+$/, '');
      }

      // ── 只有找到新值才寫入 ────────────────────────────
      const linkedinChanged = newLinkedin && newLinkedin !== (row.linkedin_url || '');
      const githubChanged   = newGithub   && newGithub   !== (row.github_url   || '');

      if (linkedinChanged || githubChanged) {
        await pool.query(
          `UPDATE candidates_pipeline
           SET linkedin_url = COALESCE(NULLIF($1,''), linkedin_url),
               github_url   = COALESCE(NULLIF($2,''), github_url)
           WHERE id = $3`,
          [newLinkedin || '', newGithub || '', row.id]
        );
        updated++;
        details.push({
          id:      row.id,
          name:    row.name,
          ...(linkedinChanged ? { linkedin: newLinkedin } : {}),
          ...(githubChanged   ? { github:   newGithub   } : {}),
        });
      }
    }

    res.json({
      success: true,
      message: `已從現有欄位提取並更新 ${updated} 筆連結`,
      total_scanned: result.rows.length,
      updated,
      details,
    });
  } catch (error) {
    console.error('extract-links migration error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/scoring-guide — 回傳評分 Bot 執行指南（供 openclaw / AI Agent 定時評分使用）
router.get('/scoring-guide', (req, res) => {
  try {
    const guidePath = path.join(__dirname, 'guides/SCORING-GUIDE.md');
    if (!fs.existsSync(guidePath)) {
      return res.status(404).json({ success: false, error: 'Scoring guide not found' });
    }
    const content = fs.readFileSync(guidePath, 'utf-8');
    const accept = req.headers['accept'] || '';
    if (accept.includes('application/json')) {
      res.json({ success: true, content });
    } else {
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.send(content);
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/jobs-import-guide — 回傳職缺匯入 Bot 執行指南
router.get('/jobs-import-guide', (req, res) => {
  try {
    const guidePath = path.join(__dirname, 'guides/JOB-IMPORT-GUIDE.md');
    if (!fs.existsSync(guidePath)) {
      return res.status(404).json({ success: false, error: 'Job import guide not found' });
    }
    const content = fs.readFileSync(guidePath, 'utf-8');
    const accept = req.headers['accept'] || '';
    if (accept.includes('application/json')) {
      res.json({ success: true, content });
    } else {
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.send(content);
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/resume-guide — 回傳履歷分析教學指南（供 AIbot 學習使用）
router.get('/resume-guide', (req, res) => {
  try {
    const guidePath = path.join(__dirname, 'guides/RESUME-ANALYSIS-GUIDE.md');
    if (!fs.existsSync(guidePath)) {
      return res.status(404).json({ success: false, error: 'Resume analysis guide not found' });
    }
    const content = fs.readFileSync(guidePath, 'utf-8');
    const accept = req.headers['accept'] || '';
    if (accept.includes('application/json')) {
      res.json({ success: true, content });
    } else {
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.send(content);
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/resume-import-guide — 履歷匯入 + 即時評分合併執行指南
router.get('/resume-import-guide', (req, res) => {
  try {
    const guidePath = path.join(__dirname, 'guides/RESUME-IMPORT-GUIDE.md');
    if (!fs.existsSync(guidePath)) {
      return res.status(404).json({ success: false, error: 'Resume import guide not found' });
    }
    const content = fs.readFileSync(guidePath, 'utf-8');
    const accept = req.headers['accept'] || '';
    if (accept.includes('application/json')) {
      res.json({ success: true, content });
    } else {
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.send(content);
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/github-analysis-guide — GitHub 分析指南（供 OpenClaw / AI Agent 使用）
router.get('/github-analysis-guide', (req, res) => {
  try {
    const guidePath = path.join(__dirname, 'guides/GITHUB-ANALYSIS-GUIDE.md');
    if (!fs.existsSync(guidePath)) {
      return res.status(404).json({ success: false, error: 'GitHub analysis guide not found' });
    }
    const content = fs.readFileSync(guidePath, 'utf-8');
    const accept = req.headers['accept'] || '';
    if (accept.includes('application/json')) {
      res.json({ success: true, content });
    } else {
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.send(content);
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 人才智能爬蟲 API (NEW - 2026-02-26) ====================
// 整合 step1ne-headhunter-skill 的爬蟲系統

const talentSourcingRoutes = require('./talent-sourcing/routes');
router.use('/talent-sourcing', talentSourcingRoutes);
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
// ==================== Bot 排程設定 ====================
// 每位顧問各自獨立一份設定，key 格式：cfg__顧問名
// 例：cfg__Jacky, cfg__Phoebe — 互不干擾

const BOT_CONFIG_DEFAULTS = {
  enabled: false,
  schedule_type: 'daily',
  schedule_time: '09:00',
  schedule_days: [1],
  schedule_interval_hours: 12,
  schedule_once_at: '',
  target_job_ids: [],
  consultant: '',
  last_run_at: null,
  last_run_status: null,
  last_run_summary: null,
};

/**
 * GET /api/bot-config?consultant=Jacky
 * 取得指定顧問的 Bot 設定（各自獨立，互不干擾）
 */
router.get('/bot-config', async (req, res) => {
  try {
    const consultant = (req.query.consultant || '').trim();
    if (!consultant) {
      return res.status(400).json({ success: false, error: '請提供 consultant 查詢參數' });
    }
    const key = `cfg__${consultant}`;
    const result = await pool.query(`SELECT value FROM bot_config WHERE key = $1`, [key]);
    const saved = result.rows[0]?.value || {};
    res.json({
      success: true,
      data: { ...BOT_CONFIG_DEFAULTS, ...saved, consultant },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/bot-configs — 取得所有顧問的設定（雲端排程器使用）
 */
router.get('/bot-configs', async (req, res) => {
  try {
    const result = await pool.query(`SELECT key, value FROM bot_config WHERE key LIKE 'cfg__%'`);
    const configs = result.rows.map(row => ({
      consultant: row.key.replace(/^cfg__/, ''),
      ...BOT_CONFIG_DEFAULTS,
      ...row.value,
    }));
    res.json({ success: true, data: configs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/bot-config — 儲存指定顧問的 Bot 設定
 * body: { consultant, enabled, schedule_type, schedule_time, ... }
 */
router.post('/bot-config', async (req, res) => {
  try {
    const {
      consultant,
      enabled, schedule_type, schedule_time, schedule_days,
      schedule_interval_hours, schedule_once_at, target_job_ids,
    } = req.body;
    if (!consultant) {
      return res.status(400).json({ success: false, error: '請提供 consultant 欄位' });
    }
    const key = `cfg__${consultant}`;
    // 先讀舊設定（保留 last_run_* 等欄位）
    const existing = await pool.query(`SELECT value FROM bot_config WHERE key = $1`, [key]);
    const old = existing.rows[0]?.value || {};
    const newConfig = {
      ...old,
      consultant,
      ...(enabled             !== undefined && { enabled }),
      ...(schedule_type       !== undefined && { schedule_type }),
      ...(schedule_time       !== undefined && { schedule_time }),
      ...(schedule_days       !== undefined && { schedule_days }),
      ...(schedule_interval_hours !== undefined && { schedule_interval_hours }),
      ...(schedule_once_at    !== undefined && { schedule_once_at }),
      ...(target_job_ids      !== undefined && { target_job_ids }),
    };
    await pool.query(
      `INSERT INTO bot_config (key, value, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2::jsonb, updated_at = NOW()`,
      [key, JSON.stringify(newConfig)]
    );
    res.json({ success: true, message: `${consultant} 的 Bot 設定已儲存` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** POST /api/bot/run-now - 立即觸發 Bot 執行一次 */
router.post('/bot/run-now', async (req, res) => {
  try {
    const { target_job_ids, pages, sample_per_page, consultant } = req.body;
    if (!target_job_ids || target_job_ids.length === 0) {
      return res.status(400).json({ success: false, error: '請指定至少一個目標職缺' });
    }

    const crawlPages      = Math.max(1, Math.min(10, parseInt(pages)      || 10));
    const crawlSamplePer  = Math.max(1, Math.min(10, parseInt(sample_per_page) || 5));
    const consultantName  = (consultant || '').trim();

    // 先記錄 log
    await writeLog({
      action: 'BOT_RUN_NOW',
      actor: consultantName || 'scheduler-ui',
      candidateId: null,
      candidateName: null,
      detail: { target_job_ids, pages: crawlPages, sample_per_page: crawlSamplePer, consultant: consultantName, triggered_by: 'manual' },
    });

    // 嘗試找到 Python 腳本路徑
    const path = require('path');
    const fs = require('fs');
    const possibleScripts = [
      path.join(__dirname, 'one-bot-pipeline.py'),
      path.join(__dirname, 'talent-sourcing', 'one-bot-pipeline.py'),
      path.join(__dirname, 'talent-sourcing', 'search-plan-executor.py'),
    ];
    const scriptPath = possibleScripts.find(p => fs.existsSync(p));

    if (!scriptPath) {
      // 腳本找不到，回傳路徑資訊供除錯
      return res.json({
        success: true,
        message: 'Python 腳本找不到',
        script_found: false,
        checked_paths: possibleScripts,
        cwd: __dirname,
      });
    }

    // 背景執行腳本（不阻塞 API），每個顧問獨立 log 檔避免混用
    const jobIdsArg = target_job_ids.join(',');
    const safeConsultant = consultantName.replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]/g, '_') || 'shared';
    const logFilePath = path.join(__dirname, `bot-${safeConsultant}-latest.log`);
    // 寫入啟動標頭
    fs.writeFileSync(logFilePath,
      `=== Bot 啟動時間：${new Date().toISOString()} ===\n` +
      `腳本：${scriptPath}\n` +
      `顧問：${consultantName || '(未指定)'}\n` +
      `參數：--job-ids ${jobIdsArg} --pages ${crawlPages} --sample-per-page ${crawlSamplePer}\n` +
      `=======================================================\n`
    );
    const logFd = fs.openSync(logFilePath, 'a');
    const pythonArgs = [
      scriptPath,
      '--job-ids',          jobIdsArg,
      '--pages',            String(crawlPages),
      '--sample-per-page',  String(crawlSamplePer),
    ];
    if (consultantName) pythonArgs.push('--consultant', consultantName);

    const child = require('child_process').spawn('python3', pythonArgs,
      {
        detached: true,
        stdio: ['ignore', logFd, logFd],
        // 告訴 Python 腳本正確的 API 位址（同一容器內部）
        env: { ...process.env, API_BASE_URL: `http://localhost:${process.env.PORT || 3001}` },
      }
    );
    child.unref();

    res.json({
      success: true,
      message: `Bot 已啟動（PID: ${child.pid}）— ${crawlPages} 頁 × 每頁抽 ${crawlSamplePer} 筆，背景執行中`,
      script_found: true,
      pid: child.pid,
      pages: crawlPages,
      sample_per_page: crawlSamplePer,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** GET /api/bot/run-log - 取得最近一次 Bot 執行的 Python stdout/stderr 輸出 */
router.get('/bot/run-log', (req, res) => {
  try {
    // 每個顧問讀自己的 log 檔，用 ?consultant=Jacky 區分
    const consultant = (req.query.consultant || '').trim();
    const safeConsultant = consultant.replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]/g, '_') || 'shared';
    const logFilePath = path.join(__dirname, `bot-${safeConsultant}-latest.log`);
    if (!fs.existsSync(logFilePath)) {
      return res.json({ success: true, log: '（尚無執行記錄，請先按「立即執行」啟動 Bot）' });
    }
    const log = fs.readFileSync(logFilePath, 'utf8');
    const lines = log.split('\n');
    const tail = lines.slice(-200).join('\n');
    res.json({ success: true, log: tail, total_lines: lines.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** GET /api/bot-logs - 取得 Bot 執行紀錄（最近 50 筆） */
router.get('/bot-logs', async (req, res) => {
  try {
    const db = await pool.connect();
    const result = await db.query(`
      SELECT id, action, actor, candidate_name, detail, created_at
      FROM system_logs
      WHERE actor_type = 'AIBOT'
      ORDER BY created_at DESC
      LIMIT 50
    `);
    db.release();
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
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
const githubAnalysis = require('./githubAnalysisService');

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

const { parseResumePDF } = require('./resumePDFService');

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

module.exports = router;

