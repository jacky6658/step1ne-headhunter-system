/**
 * candidatesService.js - 候選人服務層
 * 方案 A+B：整合 SQL（方案 B）+ Google Sheets（方案 A）
 * 
 * 邏輯流程：
 * 1. 所有寫入 → 先寫 SQL（PostgreSQL）
 * 2. 異步同步 → Google Sheets（用於報表/備份）
 * 3. 讀取時 → 優先讀 SQL（快），Fallback Google Sheets
 */

const sqlService = require('./sqlService');
const sheetsService = require('./sheetsService-v2-sql');

/**
 * 更新候選人狀態（核心）
 * 方案 A 實現：前端改狀態 → 呼叫此 API → 同時更新 SQL + Google Sheets
 */
async function updateCandidateStatus(candidateId, name, newStatus, consultant, notes = null) {
  try {
    console.log(`📝 Updating status: ${candidateId} → ${newStatus}`);

    // 步驟 1：寫入 SQL（Primary）
    const sqlResult = await sqlService.updateCandidateStatus(
      candidateId,
      name,
      newStatus,
      consultant,
      notes
    );

    console.log(`✅ SQL updated: ${candidateId}`);

    // 步驟 2：異步同步到 Google Sheets（Background）
    // 不要等待，避免 API 變慢
    (async () => {
      try {
        await syncToGoogleSheets(candidateId, newStatus);
        await sqlService.markSyncToSheetsDone(candidateId, null);
        console.log(`✅ Google Sheets synced: ${candidateId}`);
      } catch (err) {
        console.error(`⚠️ Sheets sync failed (non-blocking): ${err.message}`);
        // 記錄到 sync_log 表，待下次重試
      }
    })();

    return sqlResult;
  } catch (error) {
    console.error('❌ updateCandidateStatus error:', error.message);
    throw error;
  }
}

/**
 * 新增候選人
 */
async function createCandidate(candidateData) {
  try {
    // Step 1: SQL
    const sqlResult = await sqlService.createCandidatePipeline(candidateData);

    // Step 2: Google Sheets (非同步)
    (async () => {
      try {
        await sheetsService.appendCandidateRow(candidateData);
      } catch (err) {
        console.error(`⚠️ Sheets append failed: ${err.message}`);
      }
    })();

    return sqlResult;
  } catch (error) {
    console.error('❌ createCandidate error:', error.message);
    throw error;
  }
}

/**
 * 獲取候選人詳情
 */
async function getCandidate(candidateId) {
  try {
    // 優先讀 SQL
    const sqlCandidate = await sqlService.getCandidatePipeline(candidateId);
    
    if (sqlCandidate) {
      console.log(`✅ Candidate found in SQL: ${candidateId}`);
      return sqlCandidate;
    }

    // Fallback：讀 Google Sheets
    console.log(`⚠️ Candidate not in SQL, reading from Sheets: ${candidateId}`);
    const sheetsCandidate = await sheetsService.searchCandidate(candidateId);
    
    // 補充到 SQL
    if (sheetsCandidate) {
      await sqlService.createCandidatePipeline(sheetsCandidate);
    }

    return sheetsCandidate;
  } catch (error) {
    console.error('❌ getCandidate error:', error.message);
    throw error;
  }
}

/**
 * 保存 AI 配對結果
 */
async function saveAIMatches(candidateId, jobMatches, scores) {
  try {
    // SQL 優先
    const result = await sqlService.saveAIMatchScores(candidateId, jobMatches, scores);

    // 異步同步 Sheets（如果需要）
    (async () => {
      try {
        // 可選：更新 Google Sheets 的配對分數欄
        await sheetsService.updateAIScores(candidateId, scores);
      } catch (err) {
        console.error(`⚠️ Sheets AI scores update failed: ${err.message}`);
      }
    })();

    return result;
  } catch (error) {
    console.error('❌ saveAIMatches error:', error.message);
    throw error;
  }
}

/**
 * 同步到 Google Sheets（核心同步邏輯）
 */
async function syncToGoogleSheets(candidateId, newStatus) {
  try {
    // 從 SQL 讀取完整資料
    const candidate = await sqlService.getCandidatePipeline(candidateId);
    
    if (!candidate) {
      throw new Error(`Candidate not found in SQL: ${candidateId}`);
    }

    // 找到對應的 Google Sheets 行號
    const sheetsRowNum = await sheetsService.findCandidateRowNum(candidate.name);
    
    if (!sheetsRowNum) {
      console.warn(`⚠️ Candidate not found in Sheets: ${candidate.name}`);
      return null;
    }

    // 更新 Sheets（T 欄 = Status）
    await sheetsService.updateCell(
      sheetsRowNum,
      'T',  // Status 欄
      newStatus
    );

    console.log(`✅ Synced to Sheets: Row ${sheetsRowNum}, Status: ${newStatus}`);
    return sheetsRowNum;
  } catch (error) {
    console.error('❌ syncToGoogleSheets error:', error.message);
    throw error;
  }
}

/**
 * 定期同步待處理項目（Cron Job）
 */
async function syncPendingChanges() {
  try {
    const pending = await sqlService.getPendingSyncToSheets();
    console.log(`🔄 Found ${pending.length} pending syncs`);

    for (const item of pending) {
      try {
        const sheetsRowNum = await syncToGoogleSheets(item.candidate_id, item.new_status);
        await sqlService.markSyncToSheetsDone(item.candidate_id, sheetsRowNum);
      } catch (err) {
        console.error(`❌ Failed to sync ${item.candidate_id}: ${err.message}`);
      }
    }

    console.log(`✅ Sync completed`);
  } catch (error) {
    console.error('❌ syncPendingChanges error:', error.message);
  }
}

/**
 * 查詢所有候選人（用於前端列表）
 */
async function getAllCandidates(consultant = null) {
  try {
    // 從 SQL 讀取（快速）
    const candidates = await sqlService.getAllCandidatePipelines(consultant);
    return candidates;
  } catch (error) {
    console.error('❌ getAllCandidates error:', error.message);
    throw error;
  }
}

module.exports = {
  updateCandidateStatus,
  createCandidate,
  getCandidate,
  saveAIMatches,
  syncToGoogleSheets,
  syncPendingChanges,
  getAllCandidates
};
