const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://root:etUh2zkR4Mr8gfWLs059S7Dm1T6Yby3Q@tpe1.clusters.zeabur.com:27883/zeabur'
});

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
