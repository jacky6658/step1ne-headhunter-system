/**
 * db.js - 統一的 PostgreSQL 連線池
 *
 * 所有後端模組共享這一個 Pool，避免多個 Pool 實例搶佔連線。
 * 提供 withClient() helper 自動管理 connect / release（try/finally），
 * 徹底消除 connection leak 風險。
 *
 * 使用方式：
 *   const { pool, withClient } = require('./db');
 *
 *   // 方式 1：簡單查詢（不需要 transaction）
 *   const rows = await pool.query('SELECT 1');
 *
 *   // 方式 2：需要 client（transaction、多步驟查詢）
 *   const result = await withClient(async (client) => {
 *     await client.query('BEGIN');
 *     // ... 多步驟 ...
 *     await client.query('COMMIT');
 *     return someValue;
 *   });
 */

const { Pool } = require('pg');
const CircuitBreaker = require('./utils/circuitBreaker');

const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URI;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL 或 POSTGRES_URI 環境變數未設定，無法連接資料庫');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 15,                        // 本機 PG 夠用，避免佔過多連線（兩套系統共用 max_connections=100）
  min: 2,                         // 最小閒置連線
  idleTimeoutMillis: 10000,       // 閒置 10 秒後釋放（本機連線成本低，無需長時間保持）
  connectionTimeoutMillis: 5000,  // 等超過 5 秒就報錯（本機連線應該很快）
  allowExitOnIdle: true,
  statement_timeout: 15000,       // 單一 query 最多跑 15 秒
  query_timeout: 15000,           // pg driver 層面的 query timeout
  application_name: 'hr-backend', // 方便 pg_stat_activity 追蹤來源
});

// 背景錯誤處理 — PG 重啟後 pool 中的舊連線會收到錯誤，
// 這裡捕捉後 pool 會自動建立新連線，不需要手動處理
pool.on('error', (err) => {
  console.error('❌ PostgreSQL Pool 背景錯誤:', err.message);
  // pool 會自動丟棄壞連線並在下次 query 時建立新連線
});

// 啟動時印一次
let _logged = false;
pool.on('connect', () => {
  if (!_logged) {
    _logged = true;
    console.log('✅ PostgreSQL Pool connected (shared db.js)');
  }
});

/**
 * withClient - 安全取得 client 並自動 release
 *
 * @param {(client: import('pg').PoolClient) => Promise<T>} fn
 * @returns {Promise<T>}
 *
 * 所有使用 pool.connect() 的地方都應改用此 helper，
 * 確保 client.release() 一定在 finally 中被呼叫。
 */
async function withClient(fn) {
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

// 斷路器 — 保護外部服務呼叫（可在其他模組中使用）
const dbBreaker = new CircuitBreaker('PostgreSQL', { failureThreshold: 5, resetTimeout: 30000 });

module.exports = { pool, withClient, CircuitBreaker, dbBreaker };
