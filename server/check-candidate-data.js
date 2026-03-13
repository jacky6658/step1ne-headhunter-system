require('dotenv').config();
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URI;
if (!DATABASE_URL) { console.error('❌ DATABASE_URL 未設定'); process.exit(1); }

const pool = new Pool({ connectionString: DATABASE_URL });

async function main() {
  const client = await pool.connect();
  
  console.log('\n🔍 查詢王禧恩的詳細資料：\n');
  
  const result = await client.query(
    "SELECT name, current_position, years_experience, skills, education, work_history, education_details FROM candidates_pipeline WHERE name = '王禧恩' LIMIT 1"
  );
  
  if (result.rows.length === 0) {
    console.log('❌ 找不到王禧恩');
  } else {
    const row = result.rows[0];
    console.log(`姓名: ${row.name}`);
    console.log(`職位: ${row.current_position}`);
    console.log(`年資: ${row.years_experience}`);
    console.log(`技能: ${row.skills}`);
    console.log(`教育: ${row.education}`);
    console.log(`\n工作經歷: ${row.work_history ? JSON.stringify(row.work_history).substring(0, 100) : '無'}`);
    console.log(`\n教育背景: ${row.education_details ? JSON.stringify(row.education_details).substring(0, 100) : '無'}`);
  }

  client.release();
  await pool.end();
}

main().catch(console.error);
