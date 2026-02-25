const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://root:etUh2zkR4Mr8gfWLs059S7Dm1T6Yby3Q@tpe1.clusters.zeabur.com:27883/zeabur'
});

async function main() {
  const client = await pool.connect();
  
  console.log('\n🧪 測試新的 API 排序：\n');
  
  const result = await client.query(`
    SELECT 
      id, 
      name, 
      current_position,
      years_experience,
      skills
    FROM candidates_pipeline
    ORDER BY id ASC
    LIMIT 5
  `);

  console.log('✅ 前 5 筆（正確順序）：');
  result.rows.forEach(row => {
    console.log(`  [${row.id}] ${row.name} | ${row.current_position || 'N/A'} | ${row.years_experience || 'N/A'}年 | ${(row.skills || '').substring(0, 30)}`);
  });

  client.release();
  await pool.end();
}

main().catch(console.error);
