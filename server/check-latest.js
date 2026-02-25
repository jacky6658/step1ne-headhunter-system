const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://root:etUh2zkR4Mr8gfWLs059S7Dm1T6Yby3Q@tpe1.clusters.zeabur.com:27883/zeabur'
});

async function main() {
  const client = await pool.connect();
  
  const result = await client.query(`
    SELECT COUNT(*) as total, 
           COUNT(CASE WHEN current_position != '' THEN 1 END) as with_pos,
           MIN(id) as min_id, MAX(id) as max_id,
           DATE(created_at) as latest_date
    FROM candidates_pipeline
    GROUP BY DATE(created_at)
    ORDER BY DATE(created_at) DESC
    LIMIT 3
  `);
  
  console.log('\n📊 最新資料狀態：\n');
  result.rows.forEach(row => {
    console.log(`  ${row.latest_date}：${row.total} 筆 (有職位: ${row.with_pos}) [ID: ${row.min_id}-${row.max_id}]`);
  });

  // 列出最新有職位的
  const preview = await client.query(`
    SELECT id, name, current_position, years_experience
    FROM candidates_pipeline
    WHERE current_position IS NOT NULL AND current_position != ''
    ORDER BY id DESC
    LIMIT 5
  `);
  
  console.log(`\n  📋 最新有職位的 5 筆：`);
  preview.rows.forEach(row => {
    console.log(`     [${row.id}] ${row.name} | ${row.current_position} | ${row.years_experience}年`);
  });

  client.release();
  await pool.end();
}

main().catch(console.error);
