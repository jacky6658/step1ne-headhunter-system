/**
 * helpers.js - 共用工具函數
 */
const { pool } = require('./db');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

/**
 * 清洗 URL param 中的 id：移除 AI Bot 可能帶來的多餘 JSON 引號
 * e.g. '"184"' → '184'，'\"184\"' → '184'
 */
function sanitizeId(rawId) {
  if (rawId == null) return rawId;
  return String(rawId).replace(/^["']+|["']+$/g, '').trim();
}

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

module.exports = { sanitizeId, writeLog, syncSQLToSheets };
