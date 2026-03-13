require('dotenv').config();
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URI;
if (!DATABASE_URL) { console.error('❌ DATABASE_URL 未設定'); process.exit(1); }

const pool = new Pool({ connectionString: DATABASE_URL });

async function main() {
  const client = await pool.connect();
  
  console.log('\n📊 檢查空白 name 記錄：\n');
  
  // 統計空白 name
  const empty = await client.query(
    "SELECT COUNT(*) as count FROM candidates_pipeline WHERE name IS NULL OR name = ''"
  );
  console.log(`❌ 空白 name 的候選人：${empty.rows[0].count}`);
  
  // 列出前 10 筆
  const list = await client.query(`
    SELECT id, name, current_position
    FROM candidates_pipeline
    WHERE name IS NULL OR name = ''
    LIMIT 10
  `);
  
  console.log('\n前 10 筆（name 為空）：');
  list.rows.forEach(row => {
    console.log(`  [${row.id}] name="${row.name}" | position="${row.current_position}"`);
  });

  client.release();
  await pool.end();
}

main().catch(console.error);
