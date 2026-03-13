require('dotenv').config();
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URI;
if (!DATABASE_URL) { console.error('❌ DATABASE_URL 未設定'); process.exit(1); }

const pool = new Pool({ connectionString: DATABASE_URL });

async function main() {
  const client = await pool.connect();
  
  console.log('\n📊 數據庫狀態檢查：\n');
  
  // 總計
  const total = await client.query('SELECT COUNT(*) as count FROM candidates_pipeline');
  console.log(`1️⃣  總候選人數：${total.rows[0].count}`);
  
  // 有 position 的
  const hasPos = await client.query(
    "SELECT COUNT(*) as count FROM candidates_pipeline WHERE current_position IS NOT NULL AND current_position != ''"
  );
  console.log(`2️⃣  有職位的：${hasPos.rows[0].count}`);
  
  // 有 skills 的
  const hasSkills = await client.query(
    "SELECT COUNT(*) as count FROM candidates_pipeline WHERE skills IS NOT NULL AND skills != ''"
  );
  console.log(`3️⃣  有技能的：${hasSkills.rows[0].count}`);
  
  // 按 created_at 分析
  const byDate = await client.query(`
    SELECT 
      DATE(created_at) as date,
      COUNT(*) as count,
      COUNT(CASE WHEN current_position != '' THEN 1 END) as with_position
    FROM candidates_pipeline
    GROUP BY DATE(created_at)
    ORDER BY date DESC
    LIMIT 5
  `);
  
  console.log(`\n4️⃣  按日期統計：`);
  byDate.rows.forEach(row => {
    console.log(`   ${row.date}: ${row.count} 筆 (有職位: ${row.with_position})`);
  });
  
  // 前 5 筆最新的有職位的
  const newest = await client.query(`
    SELECT id, name, current_position, years_experience, skills, created_at
    FROM candidates_pipeline
    WHERE current_position IS NOT NULL AND current_position != ''
    ORDER BY created_at DESC
    LIMIT 5
  `);
  
  console.log(`\n5️⃣  最新有職位的 5 筆：`);
  newest.rows.forEach(row => {
    console.log(`   [${row.id}] ${row.name} | ${row.current_position} | ${row.years_experience}年`);
  });
  
  client.release();
  await pool.end();
}

main().catch(console.error);
