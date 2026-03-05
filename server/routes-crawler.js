/**
 * routes-crawler.js - 爬蟲整合 API 路由
 *
 * 1. Proxy 路由：轉發到爬蟲 Flask API (port 5000)
 * 2. 本地路由：效益指標快照 (PostgreSQL)
 */

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL ||
  'postgresql://root:etUh2zkR4Mr8gfWLs059S7Dm1T6Yby3Q@tpe1.clusters.zeabur.com:27883/zeabur';

const pool = new Pool({ connectionString: DATABASE_URL });

// 爬蟲 API 位址（環境變數或預設本地）
const CRAWLER_URL = process.env.CRAWLER_API_URL || 'http://localhost:5000';

// ══════════════════════════════════════════════
// 自動建表 Migration
// ══════════════════════════════════════════════

pool.query(`
  CREATE TABLE IF NOT EXISTS crawler_metrics_history (
    id SERIAL PRIMARY KEY,
    snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_candidates_crawled INT DEFAULT 0,
    today_new INT DEFAULT 0,
    linkedin_count INT DEFAULT 0,
    github_count INT DEFAULT 0,
    grade_a INT DEFAULT 0,
    grade_b INT DEFAULT 0,
    grade_c INT DEFAULT 0,
    grade_d INT DEFAULT 0,
    pipeline_total INT DEFAULT 0,
    pipeline_contacted INT DEFAULT 0,
    pipeline_interviewed INT DEFAULT 0,
    pipeline_offered INT DEFAULT 0,
    pipeline_onboarded INT DEFAULT 0,
    pipeline_rejected INT DEFAULT 0,
    contact_rate NUMERIC(5,2) DEFAULT 0,
    interview_rate NUMERIC(5,2) DEFAULT 0,
    offer_rate NUMERIC(5,2) DEFAULT 0,
    placement_rate NUMERIC(5,2) DEFAULT 0,
    consultant_metrics JSONB DEFAULT '{}',
    source_metrics JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(snapshot_date)
  )
`).then(() => console.log('✅ crawler_metrics_history table ready'))
  .catch(err => console.warn('crawler_metrics_history migration:', err.message));

// ══════════════════════════════════════════════
// 通用 Proxy 函數
// ══════════════════════════════════════════════

async function proxyCrawler(method, path, body = null, timeout = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const url = `${CRAWLER_URL}/api${path}`;
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      signal: controller.signal,
    };
    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      opts.body = JSON.stringify(body);
    }
    const resp = await fetch(url, opts);
    const data = await resp.json();
    return data;
  } catch (e) {
    if (e.name === 'AbortError') {
      return { success: false, error: '爬蟲服務連線逾時', crawler_offline: true };
    }
    return { success: false, error: '爬蟲服務未啟動', crawler_offline: true };
  } finally {
    clearTimeout(timer);
  }
}

// 通用 proxy handler 工廠
function proxyGet(crawlerPath) {
  return async (req, res) => {
    try {
      // 帶上 query string
      const qs = new URLSearchParams(req.query).toString();
      const fullPath = qs ? `${crawlerPath}?${qs}` : crawlerPath;
      const data = await proxyCrawler('GET', fullPath);
      if (data.crawler_offline) return res.status(503).json(data);
      res.json(data);
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  };
}

function proxyPost(crawlerPath) {
  return async (req, res) => {
    try {
      const data = await proxyCrawler('POST', crawlerPath, req.body);
      if (data.crawler_offline) return res.status(503).json(data);
      res.json(data);
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  };
}

function proxyDelete(crawlerPath) {
  return async (req, res) => {
    try {
      const data = await proxyCrawler('DELETE', crawlerPath);
      if (data.crawler_offline) return res.status(503).json(data);
      res.json(data);
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  };
}

// ══════════════════════════════════════════════
// Proxy 路由（轉發到爬蟲 :5000）
// ══════════════════════════════════════════════

// Health
router.get('/health', proxyGet('/health'));

// Dashboard stats
router.get('/stats', proxyGet('/dashboard/stats'));

// Candidates
router.get('/candidates', proxyGet('/candidates'));
router.get('/candidates/:id', (req, res) => {
  proxyGet(`/candidates/${req.params.id}`)(req, res);
});

// Tasks
router.get('/tasks', proxyGet('/tasks'));
router.post('/tasks', proxyPost('/tasks'));
router.post('/tasks/:id/run', (req, res) => {
  proxyPost(`/tasks/${req.params.id}/run`)(req, res);
});
router.get('/tasks/:id/status', (req, res) => {
  proxyGet(`/tasks/${req.params.id}/status`)(req, res);
});
router.patch('/tasks/:id', async (req, res) => {
  try {
    const data = await proxyCrawler('PATCH', `/tasks/${req.params.id}`, req.body);
    if (data.crawler_offline) return res.status(503).json(data);
    res.json(data);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});
router.delete('/tasks/:id', (req, res) => {
  proxyDelete(`/tasks/${req.params.id}`)(req, res);
});

// Scoring
router.post('/score/candidates', proxyPost('/score/candidates'));
router.get('/score/detail/:id', (req, res) => {
  proxyGet(`/score/detail/${req.params.id}`)(req, res);
});

// Keywords
router.post('/keywords/generate', proxyPost('/keywords/generate'));

// Clients
router.get('/clients', proxyGet('/clients'));

// System jobs (from Step1ne via crawler)
router.get('/system/jobs', proxyGet('/system/jobs'));

// ══════════════════════════════════════════════
// 本地路由（PostgreSQL）
// ══════════════════════════════════════════════

// --- 爬蟲 URL 設定 ---
router.get('/config', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT value FROM bot_config WHERE key = 'crawler_url'`
    );
    const url = result.rows.length > 0
      ? result.rows[0].value
      : { url: CRAWLER_URL };
    res.json({ success: true, config: url });
  } catch (e) {
    res.json({ success: true, config: { url: CRAWLER_URL } });
  }
});

router.post('/config', async (req, res) => {
  try {
    const { url } = req.body;
    await pool.query(
      `INSERT INTO bot_config (key, value, updated_at) VALUES ('crawler_url', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
      [JSON.stringify({ url })]
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// --- 效益指標快照 ---
router.post('/metrics/snapshot', async (req, res) => {
  try {
    // 1. 從爬蟲取得數據
    const crawlerStats = await proxyCrawler('GET', '/dashboard/stats');
    const crawlerData = crawlerStats.crawler_offline ? {} : crawlerStats;

    // 2. 從系統 DB 取得 pipeline 數據
    const pipelineResult = await pool.query(`
      SELECT
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE status = '聯繫階段')::int as contacted,
        COUNT(*) FILTER (WHERE status = '面試階段')::int as interviewed,
        COUNT(*) FILTER (WHERE status = 'Offer')::int as offered,
        COUNT(*) FILTER (WHERE status = 'on board')::int as onboarded,
        COUNT(*) FILTER (WHERE status = '婉拒')::int as rejected
      FROM candidates_pipeline
    `);
    const p = pipelineResult.rows[0];

    // 3. 顧問分組統計
    const consultantResult = await pool.query(`
      SELECT
        COALESCE(recruiter, '未指派') as consultant,
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE status = '聯繫階段')::int as contacted,
        COUNT(*) FILTER (WHERE status = '面試階段')::int as interviewed,
        COUNT(*) FILTER (WHERE status = 'on board')::int as onboarded
      FROM candidates_pipeline
      WHERE recruiter IS NOT NULL AND recruiter != ''
      GROUP BY recruiter
    `);

    // 4. 來源分組統計
    const sourceResult = await pool.query(`
      SELECT
        COALESCE(source, '其他') as source,
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE status = '聯繫階段')::int as contacted,
        COUNT(*) FILTER (WHERE status = 'on board')::int as onboarded
      FROM candidates_pipeline
      GROUP BY source
    `);

    // 5. 計算比率
    const contactRate = p.total > 0 ? (p.contacted / p.total * 100) : 0;
    const interviewRate = p.contacted > 0 ? (p.interviewed / p.contacted * 100) : 0;
    const offerRate = p.interviewed > 0 ? (p.offered / p.interviewed * 100) : 0;
    const placementRate = p.offered > 0 ? (p.onboarded / p.offered * 100) : 0;

    // 6. 組裝顧問 & 來源 JSONB
    const consultantMetrics = {};
    for (const row of consultantResult.rows) {
      consultantMetrics[row.consultant] = {
        total: row.total,
        contacted: row.contacted,
        interviewed: row.interviewed,
        onboarded: row.onboarded,
      };
    }

    const sourceMetrics = {};
    for (const row of sourceResult.rows) {
      sourceMetrics[row.source] = {
        total: row.total,
        contacted: row.contacted,
        onboarded: row.onboarded,
      };
    }

    // 7. UPSERT
    const grades = crawlerData.grades || {};
    const sources = crawlerData.sources || {};

    await pool.query(`
      INSERT INTO crawler_metrics_history (
        snapshot_date,
        total_candidates_crawled, today_new,
        linkedin_count, github_count,
        grade_a, grade_b, grade_c, grade_d,
        pipeline_total, pipeline_contacted, pipeline_interviewed,
        pipeline_offered, pipeline_onboarded, pipeline_rejected,
        contact_rate, interview_rate, offer_rate, placement_rate,
        consultant_metrics, source_metrics
      ) VALUES (
        CURRENT_DATE,
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14,
        $15, $16, $17, $18,
        $19, $20
      )
      ON CONFLICT (snapshot_date) DO UPDATE SET
        total_candidates_crawled = EXCLUDED.total_candidates_crawled,
        today_new = EXCLUDED.today_new,
        linkedin_count = EXCLUDED.linkedin_count,
        github_count = EXCLUDED.github_count,
        grade_a = EXCLUDED.grade_a,
        grade_b = EXCLUDED.grade_b,
        grade_c = EXCLUDED.grade_c,
        grade_d = EXCLUDED.grade_d,
        pipeline_total = EXCLUDED.pipeline_total,
        pipeline_contacted = EXCLUDED.pipeline_contacted,
        pipeline_interviewed = EXCLUDED.pipeline_interviewed,
        pipeline_offered = EXCLUDED.pipeline_offered,
        pipeline_onboarded = EXCLUDED.pipeline_onboarded,
        pipeline_rejected = EXCLUDED.pipeline_rejected,
        contact_rate = EXCLUDED.contact_rate,
        interview_rate = EXCLUDED.interview_rate,
        offer_rate = EXCLUDED.offer_rate,
        placement_rate = EXCLUDED.placement_rate,
        consultant_metrics = EXCLUDED.consultant_metrics,
        source_metrics = EXCLUDED.source_metrics,
        created_at = NOW()
    `, [
      crawlerData.total_candidates || 0,
      crawlerData.today_new || 0,
      (sources.linkedin || 0),
      (sources.github || 0),
      grades.A || 0, grades.B || 0, grades.C || 0, grades.D || 0,
      p.total, p.contacted, p.interviewed,
      p.offered, p.onboarded, p.rejected,
      contactRate.toFixed(2), interviewRate.toFixed(2),
      offerRate.toFixed(2), placementRate.toFixed(2),
      JSON.stringify(consultantMetrics),
      JSON.stringify(sourceMetrics),
    ]);

    res.json({
      success: true,
      snapshot: {
        date: new Date().toISOString().split('T')[0],
        crawler: { total: crawlerData.total_candidates || 0, offline: !!crawlerStats.crawler_offline },
        pipeline: p,
        rates: { contactRate, interviewRate, offerRate, placementRate },
        consultants: consultantMetrics,
        sources: sourceMetrics,
      }
    });
  } catch (e) {
    console.error('Metrics snapshot error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// --- 歷史指標查詢 ---
router.get('/metrics/history', async (req, res) => {
  try {
    const { from, to } = req.query;
    let query = 'SELECT * FROM crawler_metrics_history';
    const params = [];

    if (from && to) {
      query += ' WHERE snapshot_date BETWEEN $1 AND $2';
      params.push(from, to);
    } else if (from) {
      query += ' WHERE snapshot_date >= $1';
      params.push(from);
    } else {
      // 預設最近 30 天
      query += ' WHERE snapshot_date >= CURRENT_DATE - INTERVAL \'30 days\'';
    }

    query += ' ORDER BY snapshot_date ASC';

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// --- 即時效益 KPI ---
router.get('/metrics/efficiency', async (req, res) => {
  try {
    // Pipeline 統計
    const pipelineResult = await pool.query(`
      SELECT
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE status = '聯繫階段')::int as contacted,
        COUNT(*) FILTER (WHERE status = '面試階段')::int as interviewed,
        COUNT(*) FILTER (WHERE status = 'Offer')::int as offered,
        COUNT(*) FILTER (WHERE status = 'on board')::int as onboarded,
        COUNT(*) FILTER (WHERE status = '婉拒')::int as rejected,
        COUNT(*) FILTER (WHERE status = 'AI推薦')::int as ai_recommended,
        COUNT(*) FILTER (WHERE status = '未開始')::int as not_started
      FROM candidates_pipeline
    `);
    const p = pipelineResult.rows[0];

    // 顧問績效
    const consultantResult = await pool.query(`
      SELECT
        COALESCE(recruiter, '未指派') as consultant,
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE status = '聯繫階段')::int as contacted,
        COUNT(*) FILTER (WHERE status = '面試階段')::int as interviewed,
        COUNT(*) FILTER (WHERE status = 'Offer')::int as offered,
        COUNT(*) FILTER (WHERE status = 'on board')::int as onboarded,
        COUNT(*) FILTER (WHERE status = '婉拒')::int as rejected
      FROM candidates_pipeline
      WHERE recruiter IS NOT NULL AND recruiter != ''
      GROUP BY recruiter
      ORDER BY total DESC
    `);

    // 來源分析
    const sourceResult = await pool.query(`
      SELECT
        COALESCE(source, '其他') as source,
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE status = '聯繫階段')::int as contacted,
        COUNT(*) FILTER (WHERE status = '面試階段')::int as interviewed,
        COUNT(*) FILTER (WHERE status = 'on board')::int as onboarded
      FROM candidates_pipeline
      GROUP BY source
      ORDER BY total DESC
    `);

    // 最近一期歷史快照（前一天對比用）
    const prevResult = await pool.query(`
      SELECT * FROM crawler_metrics_history
      WHERE snapshot_date < CURRENT_DATE
      ORDER BY snapshot_date DESC LIMIT 1
    `);
    const prev = prevResult.rows.length > 0 ? prevResult.rows[0] : null;

    const contactRate = p.total > 0 ? (p.contacted / p.total * 100) : 0;
    const interviewRate = p.contacted > 0 ? (p.interviewed / p.contacted * 100) : 0;
    const offerRate = p.interviewed > 0 ? (p.offered / p.interviewed * 100) : 0;
    const placementRate = p.offered > 0 ? (p.onboarded / p.offered * 100) : 0;

    res.json({
      success: true,
      pipeline: p,
      rates: {
        contact: parseFloat(contactRate.toFixed(1)),
        interview: parseFloat(interviewRate.toFixed(1)),
        offer: parseFloat(offerRate.toFixed(1)),
        placement: parseFloat(placementRate.toFixed(1)),
      },
      consultants: consultantResult.rows.map(r => ({
        name: r.consultant,
        total: r.total,
        contacted: r.contacted,
        interviewed: r.interviewed,
        offered: r.offered,
        onboarded: r.onboarded,
        rejected: r.rejected,
        contactRate: r.total > 0 ? parseFloat((r.contacted / r.total * 100).toFixed(1)) : 0,
        placementRate: r.total > 0 ? parseFloat((r.onboarded / r.total * 100).toFixed(1)) : 0,
      })),
      sources: sourceResult.rows.map(r => ({
        name: r.source,
        total: r.total,
        contacted: r.contacted,
        interviewed: r.interviewed,
        onboarded: r.onboarded,
        contactRate: r.total > 0 ? parseFloat((r.contacted / r.total * 100).toFixed(1)) : 0,
        placementRate: r.total > 0 ? parseFloat((r.onboarded / r.total * 100).toFixed(1)) : 0,
      })),
      previous: prev ? {
        date: prev.snapshot_date,
        contactRate: parseFloat(prev.contact_rate),
        placementRate: parseFloat(prev.placement_rate),
        pipelineTotal: prev.pipeline_total,
      } : null,
    });
  } catch (e) {
    console.error('Efficiency metrics error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ══════════════════════════════════════════════
// 爬蟲候選人匯入 Step1ne 系統
// ══════════════════════════════════════════════

const { mapCrawlerCandidate, chunkArray, processBulkImport } = require('./crawlerImportService');

/**
 * POST /api/crawler/import
 * 將爬蟲候選人匯入 Step1ne candidates_pipeline
 *
 * Body: {
 *   candidates: [ { name, title, skills, grade, source, ... } ],  // 爬蟲格式
 *   actor: "Crawler" | "OpenClaw" | ...,
 *   filters?: { min_grade?: "A"|"B"|"C"|"D" }
 * }
 *
 * 回傳: { success, message, created_count, updated_count, failed_count, data, failed }
 */
router.post('/import', async (req, res) => {
  try {
    const { candidates, actor, filters } = req.body;

    if (!Array.isArray(candidates) || candidates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'candidates array is required and must not be empty'
      });
    }

    // 可選篩選：最低等級
    let filtered = candidates;
    if (filters?.min_grade) {
      const gradeOrder = { A: 1, B: 2, C: 3, D: 4 };
      const minRank = gradeOrder[filters.min_grade] || 4;
      filtered = candidates.filter(c => {
        const rank = gradeOrder[(c.grade || '').toUpperCase()] || 5;
        return rank <= minRank;
      });
    }

    if (filtered.length === 0) {
      return res.json({
        success: true,
        message: '篩選後無符合條件的候選人',
        created_count: 0,
        updated_count: 0,
        failed_count: 0,
        data: { created: [], updated: [] },
        failed: []
      });
    }

    // 映射欄位：爬蟲格式 → Step1ne 格式
    const mapped = filtered.map(c => mapCrawlerCandidate(c));

    // 分批匯入（每批 100 筆）
    const batches = chunkArray(mapped, 100);
    const aggregated = { created: [], updated: [], failed: [] };

    for (const batch of batches) {
      const result = await processBulkImport(pool, batch, actor || 'Crawler');
      aggregated.created.push(...result.created);
      aggregated.updated.push(...result.updated);
      aggregated.failed.push(...result.failed);
    }

    // 寫入操作日誌
    try {
      await pool.query(
        `INSERT INTO system_logs (action, actor, actor_type, detail)
         VALUES ($1, $2, $3, $4)`,
        [
          'CRAWLER_IMPORT',
          actor || 'Crawler',
          /aibot|bot$/i.test(actor || '') ? 'AIBOT' : 'SYSTEM',
          JSON.stringify({
            source: 'crawler',
            total: filtered.length,
            created: aggregated.created.length,
            updated: aggregated.updated.length,
            failed: aggregated.failed.length,
          })
        ]
      );
    } catch (logErr) {
      console.warn('⚠️ import log failed:', logErr.message);
    }

    const total = filtered.length;
    res.status(201).json({
      success: true,
      message: `爬蟲匯入完成：新增 ${aggregated.created.length} 筆，更新 ${aggregated.updated.length} 筆，失敗 ${aggregated.failed.length} 筆（共 ${total} 筆）`,
      created_count: aggregated.created.length,
      updated_count: aggregated.updated.length,
      failed_count: aggregated.failed.length,
      data: { created: aggregated.created, updated: aggregated.updated },
      failed: aggregated.failed
    });
  } catch (error) {
    console.error('❌ POST /crawler/import error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/crawler/import-status?names=name1,name2,...
 * 查詢哪些候選人名字已在系統中存在
 *
 * 回傳: { success, existing: [{ name, id, status }] }
 */
router.get('/import-status', async (req, res) => {
  try {
    const namesParam = req.query.names || '';
    const names = namesParam.split(',').map(n => n.trim()).filter(Boolean);

    if (names.length === 0) {
      return res.json({ success: true, existing: [] });
    }

    // 查詢所有候選人名字（大小寫不敏感）
    const placeholders = names.map((_, i) => `LOWER(TRIM($${i + 1}))`).join(', ');
    const result = await pool.query(
      `SELECT id, name, status FROM candidates_pipeline
       WHERE LOWER(TRIM(name)) IN (${placeholders})`,
      names
    );

    res.json({
      success: true,
      existing: result.rows.map(r => ({
        name: r.name,
        id: r.id,
        status: r.status,
      }))
    });
  } catch (error) {
    console.error('❌ GET /crawler/import-status error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
