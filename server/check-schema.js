const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://root:etUh2zkR4Mr8gfWLs059S7Dm1T6Yby3Q@tpe1.clusters.zeabur.com:27883/zeabur'
});

async function main() {
  const client = await pool.connect();
  
  const result = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'candidates_pipeline'
    ORDER BY ordinal_position
  `);
  
  console.log('\n📋 candidates_pipeline 表結構：\n');
  result.rows.forEach(row => {
    const nullable = row.is_nullable === 'YES' ? '(nullable)' : '(not null)';
    console.log(`  ${row.column_name.padEnd(25)} | ${row.data_type.padEnd(20)} ${nullable}`);
  });
  
  client.release();
  await pool.end();
}

main().catch(console.error);
