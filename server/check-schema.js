require('dotenv').config();
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URI;
if (!DATABASE_URL) { console.error('❌ DATABASE_URL 未設定'); process.exit(1); }

const pool = new Pool({ connectionString: DATABASE_URL });

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
