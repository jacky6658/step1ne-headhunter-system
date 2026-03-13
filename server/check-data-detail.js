require('dotenv').config();
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URI;
if (!DATABASE_URL) { console.error('❌ DATABASE_URL 未設定'); process.exit(1); }

const pool = new Pool({ connectionString: DATABASE_URL });

async function main() {
  const client = await pool.connect();
  
  console.log('\n📋 2/25 導入的資料檢查：\n');
  
  // 查 2/25 導入的無職位資料
  const noPos = await client.query(`
    SELECT id, name, current_position, skills, notes
    FROM candidates_pipeline
    WHERE DATE(created_at) = '2026-02-25' AND (current_position IS NULL OR current_position = '')
    LIMIT 10
  `);
  
  console.log(`無職位資料（前 10 筆）：`);
  noPos.rows.forEach(row => {
    console.log(`  [${row.id}] ${row.name}`);
    console.log(`      position: "${row.current_position}"`);
    console.log(`      skills: "${row.skills}"`);
    console.log(`      notes: "${row.notes.substring(0, 60)}..."`);
  });
  
  // 查 2/25 導入的有職位資料
  const withPos = await client.query(`
    SELECT id, name, current_position, skills, years_experience
    FROM candidates_pipeline
    WHERE DATE(created_at) = '2026-02-25' AND current_position IS NOT NULL AND current_position != ''
    LIMIT 5
  `);
  
  console.log(`\n有職位資料（前 5 筆）：`);
  withPos.rows.forEach(row => {
    console.log(`  [${row.id}] ${row.name} | ${row.current_position} | ${row.years_experience}年`);
  });
  
  // 查 CSV 前幾筆
  console.log('\n\n📊 CSV 原始數據檢查（用 gog CLI）：');
  const { execSync } = require('child_process');
  try {
    const result = execSync(
      `gog sheets get "1PunpaDAFBPBL_I76AiRYGXKaXDZvMl1c262SEtxRk6Q" "A1:L5" --account aiagentg888@gmail.com`,
      { encoding: 'utf8' }
    );
    console.log(result);
  } catch (e) {
    console.log('讀取失敗:', e.message.substring(0, 100));
  }
  
  client.release();
  await pool.end();
}

main().catch(console.error);
