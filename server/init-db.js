/**
 * init-db.js - PostgreSQL 初始化腳本
 * 
 * 用法：
 * node init-db.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://root:etUh2zkR4Mr8gfWLs059S7Dm1T6Yby3Q@tpe1.clusters.zeabur.com:27883/zeabur'
});

async function initDatabase() {
  const client = await pool.connect();

  try {
    console.log('🔄 連線到 PostgreSQL...');
    
    // 讀取初始化腳本
    const sqlFilePath = path.join(__dirname, 'db', 'init-postgres.sql');
    const sqlScript = fs.readFileSync(sqlFilePath, 'utf-8');

    console.log('⚙️  執行初始化腳本...\n');

    // 執行 SQL 腳本
    await client.query(sqlScript);

    console.log('✅ PostgreSQL 初始化完成！\n');

    // 驗證表已建立
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log('✅ 已建立的表：');
    for (const row of result.rows) {
      console.log(`   📋 ${row.table_name}`);
    }

    // 驗證索引
    const indexResult = await client.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE schemaname = 'public'
      ORDER BY indexname
    `);

    console.log('\n✅ 已建立的索引：');
    for (const row of indexResult.rows) {
      console.log(`   🔑 ${row.indexname}`);
    }

    console.log('\n✅ 資料庫初始化成功！🎉');

  } catch (error) {
    console.error('❌ 初始化失敗:', error.message);
    console.error('\n詳細錯誤：');
    console.error(error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// 執行
initDatabase();
