require('dotenv').config();
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URI;
if (!DATABASE_URL) { console.error('❌ DATABASE_URL 未設定'); process.exit(1); }

const pool = new Pool({ connectionString: DATABASE_URL });

async function main() {
  const client = await pool.connect();
  
  // 列出所有包含「德」的候選人
  const result = await client.query(
    "SELECT id, name, current_position, work_history, education_details FROM candidates_pipeline WHERE name LIKE '%德%' LIMIT 10"
  );
  
  console.log(`\n找到 ${result.rows.length} 位包含「德」的候選人：\n`);
  result.rows.forEach(row => {
    console.log(`[${row.id}] ${row.name}`);
    console.log(`   職位: ${row.current_position}`);
    console.log(`   工作經歷: ${row.work_history ? '有' : '無'}`);
    console.log(`   教育背景: ${row.education_details ? '有' : '無'}`);
    console.log('');
  });

  client.release();
  await pool.end();
}

main().catch(console.error);
