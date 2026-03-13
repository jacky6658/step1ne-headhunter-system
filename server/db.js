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

const DATABASE_URL = process.env.DATABASE_URL ||
  process.env.POSTGRES_URI ||
  'postgresql://root:etUh2zkR4Mr8gfWLs059S7Dm1T6Yby3Q@tpe1.clusters.zeabur.com:27883/zeabur';

const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 30,                        // 單一 Pool 最大連線數
  min: 3,                         // 最小閒置連線
  idleTimeoutMillis: 30000,       // 閒置 30 秒後釋放
  connectionTimeoutMillis: 10000, // 等超過 10 秒就報錯
  allowExitOnIdle: true,
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
