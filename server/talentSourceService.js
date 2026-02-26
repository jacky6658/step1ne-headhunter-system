/**
 * talentSourceService.js - 人才智能爬蟲服務層
 * 調用內建的爬蟲系統（位於 ./talent-sourcing/）
 * 
 * 功能：
 * 1. 調用 Python 爬蟲搜尋候選人
 * 2. 調用評分系統評分
 * 3. 調用遷移分析器分析跨產業能力
 * 
 * 注意：爬蟲腳本與本服務層在同一目錄，部署友善
 */

const { exec } = require('child_process');
const util = require('util');
const fs = require('fs');
const path = require('path');

const execPromise = util.promisify(exec);

// 爬蟲腳本位置（相對於本文件）
const TALENT_SOURCING_DIR = path.join(__dirname, 'talent-sourcing');
const SCRAPER_SCRIPT = path.join(TALENT_SOURCING_DIR, 'search-plan-executor.py');
const SCORER_SCRIPT = path.join(TALENT_SOURCING_DIR, 'candidate-scoring-system-v2.py');
const MIGRATION_SCRIPT = path.join(TALENT_SOURCING_DIR, 'industry-migration-analyzer.py');

/**
 * 驗證 Python 爬蟲腳本是否存在
 */
function validateScripts() {
  const scripts = [SCRAPER_SCRIPT, SCORER_SCRIPT, MIGRATION_SCRIPT];
  const missing = scripts.filter(script => !fs.existsSync(script));
  
  if (missing.length > 0) {
    console.warn('⚠️ 缺少爬蟲腳本：', missing);
    return false;
  }
  return true;
}

class TalentSourceService {
  constructor() {
    this.isReady = validateScripts();
  }

  /**
   * 執行爬蟲搜尋
   * @param {Object} params - { jobTitle, industry, requiredSkills, layer }
   * @returns {Promise<Object>} { success, data, message, executionTime }
   */
  async searchCandidates(params) {
    const {
      jobTitle = '',
      industry = '',
      requiredSkills = [],
      layer = 1  // 1 = P0 (優先), 2 = P1 (次要)
    } = params;

    if (!this.isReady) {
      return {
        success: false,
        error: `爬蟲腳本未就緒，請檢查 ${TALENT_SOURCING_DIR}`,
        data: []
      };
    }

    try {
      const skillsStr = Array.isArray(requiredSkills) 
        ? requiredSkills.join(',') 
        : requiredSkills;

      // 構建命令行
      const cmd = `cd ${TALENT_SOURCING_DIR} && python3 search-plan-executor.py \
        --job-title "${jobTitle}" \
        --industry "${industry}" \
        --required-skills "${skillsStr}" \
        --layer ${layer} \
        --output-format json`;

      console.log(`🔍 搜尋候選人: ${jobTitle} (${industry}) - Layer ${layer}`);
      
      const startTime = Date.now();
      const { stdout, stderr } = await execPromise(cmd, {
        timeout: 600000,  // 10 分鐘
        maxBuffer: 20 * 1024 * 1024,
        shell: '/bin/bash'
      });
      const executionTime = Date.now() - startTime;

      // 解析 Python 輸出（JSON）
      let results = [];
      try {
        // 尋找 JSON 格式的輸出
        const jsonMatch = stdout.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          results = JSON.parse(jsonMatch[0]);
        }
      } catch (parseErr) {
        console.warn('⚠️ 無法解析爬蟲輸出:', parseErr.message);
        results = [];
      }

      return {
        success: true,
        data: results,
        candidateCount: Array.isArray(results) ? results.length : 0,
        executionTime: `${(executionTime / 1000).toFixed(2)}s`,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ 爬蟲搜尋失敗:', error.message);
      return {
        success: false,
        error: error.message,
        data: [],
        executionTime: null
      };
    }
  }

  /**
   * 評分候選人
   * @param {Array} candidates - 候選人列表
   * @param {Object} jobRequirement - 職位要求 { title, requiredSkills, years }
   * @returns {Promise<Object>} { success, data }
   */
  async scoreCandidates(candidates, jobRequirement) {
    if (!Array.isArray(candidates) || candidates.length === 0) {
      return {
        success: false,
        error: '無候選人資料',
        data: []
      };
    }

    if (!this.isReady) {
      return {
        success: false,
        error: '評分系統未就緒',
        data: []
      };
    }

    try {
      // 準備 Python 輸入（JSON）
      const inputData = {
        candidates: candidates,
        jobRequirement: jobRequirement || {}
      };

      const tempFile = `/tmp/scoring-input-${Date.now()}.json`;
      fs.writeFileSync(tempFile, JSON.stringify(inputData));

      const cmd = `cd ${TALENT_SOURCING_DIR} && python3 candidate-scoring-system-v2.py \
        --input-file ${tempFile} \
        --output-format json`;

      console.log(`📊 評分 ${candidates.length} 位候選人...`);

      const startTime = Date.now();
      const { stdout } = await execPromise(cmd, {
        timeout: 120000,
        maxBuffer: 20 * 1024 * 1024
      });
      const executionTime = Date.now() - startTime;

      // 清理暫存檔案
      fs.unlinkSync(tempFile);

      // 解析輸出
      let scores = [];
      try {
        const jsonMatch = stdout.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
        if (jsonMatch) {
          scores = JSON.parse(jsonMatch[0]);
        }
      } catch (parseErr) {
        console.warn('⚠️ 無法解析評分輸出:', parseErr.message);
      }

      return {
        success: true,
        data: scores,
        executionTime: `${(executionTime / 1000).toFixed(2)}s`,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ 評分失敗:', error.message);
      return {
        success: false,
        error: error.message,
        data: []
      };
    }
  }

  /**
   * 分析遷移能力 - 評估候選人跨產業轉移的可能性
   * @param {Array} candidates - 候選人列表
   * @param {String} targetIndustry - 目標產業 (internet, gaming, fintech, etc)
   * @returns {Promise<Object>} { success, data }
   */
  async analyzeMigration(candidates, targetIndustry) {
    if (!Array.isArray(candidates) || candidates.length === 0) {
      return {
        success: false,
        error: '無候選人資料',
        data: []
      };
    }

    if (!targetIndustry) {
      return {
        success: false,
        error: '未指定目標產業',
        data: []
      };
    }

    if (!this.isReady) {
      return {
        success: false,
        error: '遷移分析系統未就緒',
        data: []
      };
    }

    try {
      const inputData = {
        candidates: candidates,
        targetIndustry: targetIndustry
      };

      const tempFile = `/tmp/migration-input-${Date.now()}.json`;
      fs.writeFileSync(tempFile, JSON.stringify(inputData));

      const cmd = `cd ${TALENT_SOURCING_DIR} && python3 industry-migration-analyzer.py \
        --input-file ${tempFile} \
        --target-industry "${targetIndustry}" \
        --output-format json`;

      console.log(`🔄 分析遷移能力: ${targetIndustry}`);

      const startTime = Date.now();
      const { stdout } = await execPromise(cmd, {
        timeout: 120000,
        maxBuffer: 20 * 1024 * 1024
      });
      const executionTime = Date.now() - startTime;

      // 清理暫存檔案
      fs.unlinkSync(tempFile);

      let analysis = [];
      try {
        const jsonMatch = stdout.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
        if (jsonMatch) {
          analysis = JSON.parse(jsonMatch[0]);
        }
      } catch (parseErr) {
        console.warn('⚠️ 無法解析遷移分析輸出:', parseErr.message);
      }

      return {
        success: true,
        data: analysis,
        executionTime: `${(executionTime / 1000).toFixed(2)}s`,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ 遷移分析失敗:', error.message);
      return {
        success: false,
        error: error.message,
        data: []
      };
    }
  }

  /**
   * 健康檢查 - 驗證爬蟲系統是否可用
   */
  async healthCheck() {
    return {
      scriptsReady: this.isReady,
      toolsDir: TALENT_SOURCING_DIR,
      scriptsAvailable: {
        scraper: fs.existsSync(SCRAPER_SCRIPT),
        scorer: fs.existsSync(SCORER_SCRIPT),
        migration: fs.existsSync(MIGRATION_SCRIPT)
      }
    };
  }
}

module.exports = new TalentSourceService();
