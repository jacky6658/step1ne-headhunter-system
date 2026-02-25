const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://root:etUh2zkR4Mr8gfWLs059S7Dm1T6Yby3Q@tpe1.clusters.zeabur.com:27883/zeabur'
});

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
