require('dotenv').config();
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URI;
if (!DATABASE_URL) { console.error('❌ DATABASE_URL 未設定'); process.exit(1); }

const pool = new Pool({ connectionString: DATABASE_URL });

async function main() {
  const client = await pool.connect();
  
  console.log('\n🔍 數據庫驗證：\n');
  
  // 檢查 ID 1 是否存在
  const id1 = await client.query('SELECT id, name, current_position, years_experience FROM candidates_pipeline WHERE id = 1');
  console.log('ID 1:');
  console.log(id1.rows.length > 0 ? JSON.stringify(id1.rows[0]) : '❌ 不存在');
  
  // 檢查最小 ID
  const minId = await client.query('SELECT MIN(id) as min_id, MAX(id) as max_id, COUNT(*) as count FROM candidates_pipeline');
  const { min_id, max_id, count } = minId.rows[0];
  console.log(`\n總數：${count}`);
  console.log(`ID 範圍：${min_id}-${max_id}`);
  
  // 列出最新的 5 筆
  const latest = await client.query(`
    SELECT id, name, current_position, years_experience
    FROM candidates_pipeline
    ORDER BY id DESC
    LIMIT 5
  `);
  console.log('\n最新 5 筆（倒序）：');
  latest.rows.forEach(row => {
    console.log(`  [${row.id}] ${row.name} | ${row.current_position || 'N/A'}`);
  });
  
  // 查 Maggie Chen
  const maggie = await client.query(
    "SELECT id, name, current_position FROM candidates_pipeline WHERE name = 'Maggie Chen'"
  );
  console.log('\nMaggie Chen：');
  console.log(maggie.rows.length > 0 ? JSON.stringify(maggie.rows[0]) : '❌ 不存在');

  client.release();
  await pool.end();
}

main().catch(console.error);
