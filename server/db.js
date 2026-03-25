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

const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URI;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL 或 POSTGRES_URI 環境變數未設定，無法連接資料庫');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 20,                        // 單一 Pool 最大連線數（防止並發打爆 postmaster）
  min: 2,                         // 最小閒置連線
  idleTimeoutMillis: 30000,       // 閒置 30 秒後釋放
  connectionTimeoutMillis: 10000, // 等超過 10 秒就報錯
  allowExitOnIdle: true,
  statement_timeout: 30000,       // 單一 query 最多跑 30 秒（VACUUM 後大 query 約需 2-5 秒，留足餘量）
  query_timeout: 30000,           // pg driver 層面的 query timeout
});

// 連線事件日誌
pool.on('connect', () => {
  // 僅首次啟動時印出，避免高頻 log
});

pool.on('error', (err) => {
  console.error('❌ PostgreSQL Pool 背景錯誤:', err.message);
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

module.exports = { pool, withClient };
