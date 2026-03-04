/**
 * bot.js - routes
 */
const express = require('express');
const router = express.Router();
const { pool } = require('../utils/db');
const { sanitizeId, writeLog, syncSQLToSheets } = require('../utils/helpers');

router.param('id', (req, _res, next, value) => {
  req.params.id = sanitizeId(value);
  next();
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


module.exports = router;
