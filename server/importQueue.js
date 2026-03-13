/**
 * importQueue.js - 匯入佇列引擎
 *
 * DBA P2：將同步匯入改為佇列 + 背景 Worker，
 * API 立即回 202 + import_id，Worker 非同步處理。
 *
 * 佇列存在 DB (import_queue 表) 中，單一 Worker
 * 以 setInterval 定時消費，確保同一時間只有一條
 * DB 連線在做匯入寫入。
 */

const { pool, withClient } = require('./db');
const { processBulkImport } = require('./crawlerImportService');

// ── 自動建表 ──
const MIGRATION_SQL = `
  CREATE TABLE IF NOT EXISTS import_queue (
    id            SERIAL PRIMARY KEY,
    status        VARCHAR(20) NOT NULL DEFAULT 'pending',
    actor         VARCHAR(100) NOT NULL DEFAULT 'system',
    source        VARCHAR(50)  NOT NULL DEFAULT 'api',
    total_count   INTEGER NOT NULL DEFAULT 0,
    created_count INTEGER NOT NULL DEFAULT 0,
    updated_count INTEGER NOT NULL DEFAULT 0,
    failed_count  INTEGER NOT NULL DEFAULT 0,
    payload       JSONB NOT NULL,
    result        JSONB,
    error_message TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at    TIMESTAMPTZ,
    finished_at   TIMESTAMPTZ
  );
  CREATE INDEX IF NOT EXISTS idx_import_queue_status ON import_queue(status);
`;

let _migrated = false;
async function ensureMigration() {
  if (_migrated) return;
  try {
    await pool.query(MIGRATION_SQL);
    _migrated = true;
    console.log('✅ import_queue table ready');
  } catch (err) {
    console.error('❌ import_queue migration failed:', err.message);
  }
}

/**
 * 將匯入請求加入佇列
 * @param {Object[]} candidates - 候選人資料陣列
 * @param {string} actor - 操作者
 * @param {string} source - 來源 ('api' | 'crawler')
 * @returns {{ import_id: number }}
 */
async function enqueue(candidates, actor, source = 'api') {
  await ensureMigration();
  const { rows } = await pool.query(
    `INSERT INTO import_queue (actor, source, total_count, payload)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [actor || 'system', source, candidates.length, JSON.stringify(candidates)]
  );
  return { import_id: rows[0].id };
}

/**
 * 查詢匯入狀態
 */
async function getStatus(importId) {
  const { rows } = await pool.query(
    `SELECT id, status, actor, source, total_count, created_count, updated_count, failed_count,
            result, error_message, created_at, started_at, finished_at
     FROM import_queue WHERE id = $1`,
    [importId]
  );
  return rows[0] || null;
}

// ── Worker 邏輯 ──

let _workerRunning = false;

async function processNext() {
  if (_workerRunning) return; // 防止重入
  _workerRunning = true;
  try {
    // 搶一筆 pending job（FOR UPDATE SKIP LOCKED 避免多 Worker 衝突）
    const job = await withClient(async (client) => {
      const { rows } = await client.query(
        `UPDATE import_queue
         SET status = 'processing', started_at = NOW()
         WHERE id = (
           SELECT id FROM import_queue
           WHERE status = 'pending'
           ORDER BY id
           LIMIT 1
           FOR UPDATE SKIP LOCKED
         )
         RETURNING *`
      );
      return rows[0] || null;
    });

    if (!job) return; // 沒有待處理的

    console.log(`[ImportQueue] Processing job #${job.id} (${job.total_count} candidates, actor=${job.actor})`);

    try {
      const candidates = job.payload;
      const result = await processBulkImport(pool, candidates, job.actor);

      await pool.query(
        `UPDATE import_queue
         SET status = 'done',
             created_count = $1,
             updated_count = $2,
             failed_count = $3,
             result = $4,
             finished_at = NOW()
         WHERE id = $5`,
        [
          result.created.length,
          result.updated.length,
          result.failed.length,
          JSON.stringify({
            created: result.created,
            updated: result.updated,
            failed: result.failed,
          }),
          job.id,
        ]
      );

      console.log(`[ImportQueue] Job #${job.id} done: +${result.created.length} / ~${result.updated.length} / !${result.failed.length}`);
    } catch (err) {
      await pool.query(
        `UPDATE import_queue
         SET status = 'failed', error_message = $1, finished_at = NOW()
         WHERE id = $2`,
        [err.message, job.id]
      );
      console.error(`[ImportQueue] Job #${job.id} failed:`, err.message);
    }
  } catch (err) {
    console.error('[ImportQueue] Worker error:', err.message);
  } finally {
    _workerRunning = false;
  }
}

/**
 * 啟動背景 Worker（每 5 秒輪詢一次）
 */
let _intervalId = null;
function startWorker(intervalMs = 5000) {
  if (_intervalId) return;
  ensureMigration();
  _intervalId = setInterval(processNext, intervalMs);
  console.log(`✅ ImportQueue Worker started (interval=${intervalMs}ms)`);
}

function stopWorker() {
  if (_intervalId) {
    clearInterval(_intervalId);
    _intervalId = null;
  }
}

module.exports = { enqueue, getStatus, startWorker, stopWorker, ensureMigration };
