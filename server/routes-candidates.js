/**
 * routes-candidates.js - 候選人相關 API 路由
 * 方案 A + B 的 REST API 層
 */

const express = require('express');
const router = express.Router();
const candidatesService = require('./candidatesService');

/**
 * PUT /api/candidates/:id
 * 更新候選人狀態（方案 A 核心端點）
 * 
 * 請求體：
 * {
 *   "status": "已聯繫",
 *   "consultant": "Jacky",
 *   "notes": "已發送開發信"
 * }
 * 
 * 響應：
 * {
 *   "success": true,
 *   "candidateId": "xxx",
 *   "status": "已聯繫",
 *   "syncedToSheets": true,
 *   "message": "狀態已更新並同步到 Google Sheets"
 * }
 */
router.put('/candidates/:id', async (req, res) => {
  try {
    const { id: candidateId } = req.params;
    const { status, consultant, notes, name } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'Status is required'
      });
    }

    console.log(`📝 API request: PUT /candidates/${candidateId}`);

    // 調用服務層
    const result = await candidatesService.updateCandidateStatus(
      candidateId,
      name || candidateId,
      status,
      consultant || 'Unknown',
      notes || null
    );

    res.json({
      success: true,
      candidateId,
      status,
      sqlId: result.id,
      message: 'Status updated in SQL. Sheets sync in progress (non-blocking).',
      timestamp: new Date().toISOString()
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
 * GET /api/candidates/:id
 * 獲取候選人詳情
 */
router.get('/candidates/:id', async (req, res) => {
  try {
    const { id: candidateId } = req.params;

    const candidate = await candidatesService.getCandidate(candidateId);

    if (!candidate) {
      return res.status(404).json({
        success: false,
        error: 'Candidate not found'
      });
    }

    res.json({
      success: true,
      candidate
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
 * GET /api/candidates
 * 列出所有候選人
 * 查詢參數：?consultant=Jacky
 */
router.get('/candidates', async (req, res) => {
  try {
    const { consultant } = req.query;

    const candidates = await candidatesService.getAllCandidates(consultant);

    res.json({
      success: true,
      count: candidates.length,
      candidates
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
 * POST /api/candidates
 * 新增候選人
 */
router.post('/candidates', async (req, res) => {
  try {
    const candidateData = req.body;

    const result = await candidatesService.createCandidate(candidateData);

    res.status(201).json({
      success: true,
      candidate: result,
      message: 'Candidate created in SQL. Sheets append in progress.'
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
 * POST /api/candidates/:id/ai-matches
 * 保存 AI 配對結果
 */
router.post('/candidates/:id/ai-matches', async (req, res) => {
  try {
    const { id: candidateId } = req.params;
    const { jobMatches, scores } = req.body;

    const result = await candidatesService.saveAIMatches(
      candidateId,
      jobMatches,
      scores
    );

    res.json({
      success: true,
      message: 'AI matches saved',
      result
    });
  } catch (error) {
    console.error('❌ POST /ai-matches error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/sync/pending
 * 手動觸發待處理同步
 * 用於 Cron Job 或 Admin 操作
 */
router.post('/sync/pending', async (req, res) => {
  try {
    console.log('🔄 Manual sync triggered');

    await candidatesService.syncPendingChanges();

    res.json({
      success: true,
      message: 'Pending changes synced to Google Sheets'
    });
  } catch (error) {
    console.error('❌ POST /sync/pending error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/health
 * 健康檢查
 */
router.get('/health', async (req, res) => {
  try {
    const sqlService = require('./sqlService');
    const health = await sqlService.healthCheck();

    res.json({
      success: true,
      status: 'ok',
      database: health.status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    res.status(500).json({
      success: false,
      status: 'error',
      error: error.message
    });
  }
});

module.exports = router;
