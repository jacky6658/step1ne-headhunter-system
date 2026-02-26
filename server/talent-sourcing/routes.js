/**
 * talent-sourcing/routes.js - 人才智能爬蟲 API 路由
 *
 * 端點：
 * POST   /api/talent-sourcing/find-candidates - 完整 6 步驟獵才流程（AIbot 觸發）
 * POST   /api/talent-sourcing/search          - 搜尋候選人（舊版）
 * POST   /api/talent-sourcing/score           - 評分候選人
 * POST   /api/talent-sourcing/migration       - 分析遷移能力
 * GET    /api/talent-sourcing/health          - 健康檢查
 */

const express = require('express');
const router = express.Router();
const talentSourceService = require('../talentSourceService');

/**
 * POST /api/talent-sourcing/find-candidates
 * 完整 6 步驟獵才流程（由 AIbot 觸發）
 *
 * Body 參數：
 * {
 *   "company": "一通數位",
 *   "jobTitle": "Java Developer",
 *   "actor": "Jackeybot",
 *   "github_token": "ghp_xxx",   // 可選，來自用戶設定
 *   "brave_api_key": "BSA-xxx",  // 可選，Brave Search API（第三層備援）
 *   "pages": 2                    // 可選，預設 2，最多 3
 * }
 */
router.post('/find-candidates', async (req, res) => {
  try {
    const { company, jobTitle, actor, github_token, brave_api_key, pages } = req.body;

    if (!company || !jobTitle) {
      return res.status(400).json({
        success: false,
        error: '缺少必要參數: company, jobTitle'
      });
    }

    console.log(`🔍 [find-candidates] ${actor || 'system'} 觸發：${company} - ${jobTitle}`);

    const result = await talentSourceService.findAndSaveCandidates({
      company,
      jobTitle,
      actor: actor || 'system',
      githubToken: github_token || null,
      braveApiKey: brave_api_key || null,
      pages: pages || 2,
    });

    console.log(`✅ [find-candidates] 完成：匯入 ${result.imported_count} 位，跳過 ${result.skipped_count} 位`);

    res.json(result);
  } catch (error) {
    console.error('❌ [find-candidates] 錯誤:', error);
    res.status(500).json({
      success: false,
      error: '服務器內部錯誤: ' + error.message
    });
  }
});

/**
 * POST /api/talent-sourcing/search
 * 搜尋候選人
 * 
 * Body 參數：
 * {
 *   "jobTitle": "AI工程師",
 *   "industry": "internet",
 *   "requiredSkills": ["Python", "機器學習"],
 *   "layer": 1  // 1=P0(優先), 2=P1(次要)
 * }
 */
router.post('/search', async (req, res) => {
  try {
    const { jobTitle, industry, requiredSkills, layer = 1 } = req.body;

    // 驗證必要參數
    if (!jobTitle || !industry) {
      return res.status(400).json({
        success: false,
        error: '缺少必要參數: jobTitle, industry'
      });
    }

    // 調用爬蟲服務
    const result = await talentSourceService.searchCandidates({
      jobTitle,
      industry,
      requiredSkills: requiredSkills || [],
      layer
    });

    // 記錄搜尋日誌
    if (result.success) {
      console.log(`✅ 搜尋完成: ${result.candidateCount} 位候選人 (${result.executionTime})`);
    }

    res.json(result);
  } catch (error) {
    console.error('搜尋端點錯誤:', error);
    res.status(500).json({
      success: false,
      error: '服務器內部錯誤: ' + error.message
    });
  }
});

/**
 * POST /api/talent-sourcing/score
 * 評分候選人
 * 
 * Body 參數：
 * {
 *   "candidates": [
 *     {
 *       "id": "1",
 *       "name": "陳宥樺",
 *       "skills": ["Python", "Go"],
 *       "experience_years": 5,
 *       ...
 *     }
 *   ],
 *   "jobRequirement": {
 *     "title": "AI工程師",
 *     "requiredSkills": ["Python"],
 *     "years": 3
 *   }
 * }
 */
router.post('/score', async (req, res) => {
  try {
    const { candidates, jobRequirement } = req.body;

    // 驗證必要參數
    if (!candidates || !Array.isArray(candidates) || candidates.length === 0) {
      return res.status(400).json({
        success: false,
        error: '缺少候選人資料'
      });
    }

    // 調用評分服務
    const result = await talentSourceService.scoreCandidates(
      candidates,
      jobRequirement
    );

    if (result.success) {
      console.log(`✅ 評分完成: ${candidates.length} 位候選人 (${result.executionTime})`);
    }

    res.json(result);
  } catch (error) {
    console.error('評分端點錯誤:', error);
    res.status(500).json({
      success: false,
      error: '服務器內部錯誤: ' + error.message
    });
  }
});

/**
 * POST /api/talent-sourcing/migration
 * 分析遷移能力 - 評估候選人跨產業轉移可能性
 * 
 * Body 參數：
 * {
 *   "candidates": [...],
 *   "targetIndustry": "fintech"
 * }
 */
router.post('/migration', async (req, res) => {
  try {
    const { candidates, targetIndustry } = req.body;

    // 驗證必要參數
    if (!candidates || !Array.isArray(candidates) || candidates.length === 0) {
      return res.status(400).json({
        success: false,
        error: '缺少候選人資料'
      });
    }

    if (!targetIndustry) {
      return res.status(400).json({
        success: false,
        error: '缺少目標產業'
      });
    }

    // 調用遷移分析服務
    const result = await talentSourceService.analyzeMigration(
      candidates,
      targetIndustry
    );

    if (result.success) {
      console.log(`✅ 遷移分析完成: ${result.executionTime}`);
    }

    res.json(result);
  } catch (error) {
    console.error('遷移分析端點錯誤:', error);
    res.status(500).json({
      success: false,
      error: '服務器內部錯誤: ' + error.message
    });
  }
});

/**
 * GET /api/talent-sourcing/health
 * 健康檢查 - 驗證爬蟲系統是否就緒
 */
router.get('/health', async (req, res) => {
  try {
    const health = await talentSourceService.healthCheck();
    
    const allReady = health.scriptsReady && 
                    Object.values(health.scriptsAvailable).every(v => v);

    res.json({
      success: true,
      health: health,
      status: allReady ? 'ready' : 'not-ready'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
