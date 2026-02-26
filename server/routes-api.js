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
    
    const result = await client.query(`
      SELECT
        id,
        name,
        contact_link,
        phone,
        email,
        linkedin_url,
        github_url,
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
      talent_level: row.talent_level || '',
      aiMatchResult: row.ai_match_result || null,
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

    // 寫入操作日誌
    const actor = consultant || 'system';
    writeLog({
      action: 'PIPELINE_CHANGE',
      actor,
      candidateId: parseInt(id),
      candidateName: result.rows[0].name,
      detail: { status, notes: notes?.substring(0, 100) }
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
    const { status, progressTracking, recruiter, talent_level, name,
            stability_score, linkedin_url, github_url, ai_match_result } = req.body;
    // 支援 notes 與 remarks 兩種欄位名稱（AIbot 相容性）
    const notes = req.body.notes !== undefined ? req.body.notes : req.body.remarks;
    const email = req.body.email;
    const actor = req.body.actor || req.body.by || '';
    const isAIBot = /aibot|bot$/i.test(actor);

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
    // 優先使用顯式傳入的 ai_match_result；若未傳但 AIBot 寫了評分備註，自動解析
    let resolvedAiMatch = ai_match_result;
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

    const validStatuses = ['未開始', '已聯繫', '已面試', 'Offer', '已上職', '婉拒', '其他'];

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
          updated_at = NOW()
        WHERE id = $22
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
          talent_level, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,NOW(),NOW())
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
          c.leaving_reason || '', c.talent_level || ''
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
    const { position_name, job_status, consultant_notes, job_description } = req.body;

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
           job_description = $4, last_updated = NOW()
       WHERE id = $5
       RETURNING *`,
      [
        position_name !== undefined ? position_name : existing.position_name,
        job_status !== undefined ? job_status : existing.job_status,
        consultant_notes !== undefined ? consultant_notes : existing.consultant_notes,
        job_description !== undefined ? job_description : existing.job_description,
        id
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
    const guidePath = path.join(__dirname, 'AIBOT-API-GUIDE.md');
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

// GET /api/resume-guide — 回傳履歷分析教學指南（供 AIbot 學習使用）
router.get('/resume-guide', (req, res) => {
  try {
    const guidePath = path.join(__dirname, 'RESUME-ANALYSIS-GUIDE.md');
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
    const { target_job_ids } = req.body;
    if (!target_job_ids || target_job_ids.length === 0) {
      return res.status(400).json({ success: false, error: '請指定至少一個目標職缺' });
    }

    // 先記錄 log
    await writeLog({
      action: 'BOT_RUN_NOW',
      actor: 'scheduler-ui',
      candidateId: null,
      candidateName: null,
      detail: { target_job_ids, triggered_by: 'manual' },
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
      // 腳本尚未建立時，仍回傳 success 並提示
      return res.json({
        success: true,
        message: '已記錄執行請求。注意：one-bot-pipeline.py 尚未部署，請先在 Zeabur 上傳腳本後再使用此功能。',
        script_found: false,
      });
    }

    // 背景執行腳本（不阻塞 API）
    const jobIdsArg = target_job_ids.join(',');
    const child = require('child_process').spawn(
      'python3', [scriptPath, '--job-ids', jobIdsArg],
      { detached: true, stdio: 'ignore' }
    );
    child.unref();

    res.json({
      success: true,
      message: `Bot 已啟動（PID: ${child.pid}），背景執行中`,
      script_found: true,
      pid: child.pid,
    });
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

module.exports = router;
