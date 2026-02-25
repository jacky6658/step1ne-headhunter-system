/**
 * sqlService.js - PostgreSQL 連線 + CRUD 操作
 * 方案 B：SQL Database 作為 Pipeline 的唯一真相來源
 */

const { Pool } = require('pg');

// PostgreSQL 連線配置
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://root:etUh2zkR4Mr8gfWLs059S7Dm1T6Yby3Q@tpe1.clusters.zeabur.com:27883/zeabur'
});

// 測試連線
pool.on('connect', () => {
  console.log('✅ PostgreSQL connected');
});

pool.on('error', (err) => {
  console.error('❌ PostgreSQL connection error:', err);
});

// ==================== CRUD 操作 ====================

/**
 * 查詢候選人 Pipeline 狀態
 */
async function getCandidatePipeline(candidateId) {
  try {
    const query = `
      SELECT * FROM candidates_pipeline
      WHERE candidate_id = $1
    `;
    const result = await pool.query(query, [candidateId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('❌ getCandidatePipeline error:', error.message);
    throw error;
  }
}

/**
 * 更新候選人狀態（核心方法）
 * 同時記錄 sync log
 */
async function updateCandidateStatus(candidateId, name, newStatus, consultant, notes = null) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. 更新 candidates_pipeline 表
    const updateQuery = `
      INSERT INTO candidates_pipeline (id, candidate_id, name, status, consultant, notes, last_updated, updated_by)
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, $7)
      ON CONFLICT (candidate_id) DO UPDATE SET
        status = $4,
        notes = $6,
        last_updated = CURRENT_TIMESTAMP,
        updated_by = $7
      RETURNING *
    `;
    
    const result = await client.query(updateQuery, [
      `${candidateId}_${Date.now()}`, // 生成唯一 ID
      candidateId,
      name,
      newStatus,
      consultant,
      notes,
      'system'
    ]);

    // 2. 記錄同步日誌（標記為 pending sync）
    const logQuery = `
      INSERT INTO google_sheets_sync_log (candidate_id, action, new_status, synced_to_sheets)
      VALUES ($1, $2, $3, $4)
    `;
    
    await client.query(logQuery, [
      candidateId,
      'status_change',
      newStatus,
      false  // 標記為待同步到 Google Sheets
    ]);

    await client.query('COMMIT');
    
    console.log(`✅ Status updated in SQL: ${candidateId} → ${newStatus}`);
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ updateCandidateStatus error:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 新增候選人到 Pipeline
 */
async function createCandidatePipeline(candidateData) {
  try {
    const query = `
      INSERT INTO candidates_pipeline (
        id, candidate_id, name, status, consultant, notes, last_updated
      ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
      ON CONFLICT (candidate_id) DO NOTHING
      RETURNING *
    `;

    const result = await pool.query(query, [
      `${candidateData.candidateId}_${Date.now()}`,
      candidateData.candidateId,
      candidateData.name,
      candidateData.status || '待聯繫',
      candidateData.consultant || null,
      candidateData.notes || null
    ]);

    console.log(`✅ Candidate created in SQL: ${candidateData.name}`);
    return result.rows[0];
  } catch (error) {
    console.error('❌ createCandidatePipeline error:', error.message);
    throw error;
  }
}

/**
 * 保存 AI 配對結果
 */
async function saveAIMatchScores(candidateId, jobMatches, scores) {
  try {
    const query = `
      UPDATE candidates_pipeline
      SET 
        job_matches = $1,
        ai_match_scores = $2,
        last_updated = CURRENT_TIMESTAMP
      WHERE candidate_id = $3
      RETURNING *
    `;

    const result = await pool.query(query, [
      JSON.stringify(jobMatches),
      JSON.stringify(scores),
      candidateId
    ]);

    console.log(`✅ AI match scores saved: ${candidateId}`);
    return result.rows[0];
  } catch (error) {
    console.error('❌ saveAIMatchScores error:', error.message);
    throw error;
  }
}

/**
 * 記錄進度追蹤
 */
async function updateProgressTracking(candidateId, trackingData) {
  try {
    const query = `
      UPDATE candidates_pipeline
      SET 
        progress_tracking = $1,
        last_updated = CURRENT_TIMESTAMP
      WHERE candidate_id = $2
      RETURNING *
    `;

    const result = await pool.query(query, [
      JSON.stringify(trackingData),
      candidateId
    ]);

    return result.rows[0];
  } catch (error) {
    console.error('❌ updateProgressTracking error:', error.message);
    throw error;
  }
}

/**
 * 查詢待同步到 Google Sheets 的記錄
 */
async function getPendingSyncToSheets() {
  try {
    const query = `
      SELECT DISTINCT ON (candidate_id) candidate_id, new_status, sync_timestamp
      FROM google_sheets_sync_log
      WHERE synced_to_sheets = FALSE
      ORDER BY candidate_id, sync_timestamp DESC
      LIMIT 50
    `;

    const result = await pool.query(query);
    return result.rows;
  } catch (error) {
    console.error('❌ getPendingSyncToSheets error:', error.message);
    throw error;
  }
}

/**
 * 標記已同步到 Google Sheets
 */
async function markSyncToSheetsDone(candidateId, sheetsRowNumber) {
  try {
    const query = `
      UPDATE google_sheets_sync_log
      SET 
        synced_to_sheets = TRUE,
        sheets_row_number = $1,
        sync_timestamp = CURRENT_TIMESTAMP
      WHERE candidate_id = $2
      AND synced_to_sheets = FALSE
    `;

    await pool.query(query, [sheetsRowNumber, candidateId]);
    console.log(`✅ Marked as synced to sheets: ${candidateId}`);
  } catch (error) {
    console.error('❌ markSyncToSheetsDone error:', error.message);
    throw error;
  }
}

/**
 * 查詢所有候選人 Pipeline（用於前端顯示）
 */
async function getAllCandidatePipelines(consultant = null) {
  try {
    let query = `SELECT * FROM candidates_pipeline`;
    const params = [];

    if (consultant) {
      query += ` WHERE consultant = $1`;
      params.push(consultant);
    }

    query += ` ORDER BY last_updated DESC LIMIT 100`;
    
    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('❌ getAllCandidatePipelines error:', error.message);
    throw error;
  }
}

/**
 * 健康檢查
 */
async function healthCheck() {
  try {
    const result = await pool.query('SELECT NOW()');
    return { status: 'ok', timestamp: result.rows[0].now };
  } catch (error) {
    console.error('❌ Database health check failed:', error.message);
    throw error;
  }
}

module.exports = {
  pool,
  getCandidatePipeline,
  updateCandidateStatus,
  createCandidatePipeline,
  saveAIMatchScores,
  updateProgressTracking,
  getPendingSyncToSheets,
  markSyncToSheetsDone,
  getAllCandidatePipelines,
  healthCheck
};
