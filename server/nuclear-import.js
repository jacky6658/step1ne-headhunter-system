#!/usr/bin/env node
/**
 * nuclear-import.js - 核選項：DELETE ALL + 重新建表 + 導入
 */

require('dotenv').config();
const { Pool } = require('pg');
const { execSync } = require('child_process');

const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URI;
if (!DATABASE_URL) { console.error('❌ DATABASE_URL 未設定'); process.exit(1); }

const pool = new Pool({ connectionString: DATABASE_URL });

function rowsToObjects(values) {
  if (!values || values.length < 2) return [];
  const headers = values[0];
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const rowData = {};
    for (let j = 0; j < headers.length; j++) {
      rowData[headers[j]] = values[i][j] || '';
    }
    if (rowData['姓名'] && rowData['姓名'].trim()) {
      rows.push(rowData);
    }
  }
  return rows;
}

function fetchWithGog(sheetId, range) {
  try {
    const cmd = `gog sheets get ${sheetId} "${range}" --account aiagentg888@gmail.com --json`;
    const output = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    return JSON.parse(output);
  } catch (error) {
    throw new Error(`gog 讀取失敗：${error.message}`);
  }
}

async function main() {
  console.log('🔥 開始核選項導入（DELETE ALL + 重新建表）...\n');

  const client = await pool.connect();

  try {
    // 完全刪除
    console.log('☢️  DELETE ALL...');
    await client.query('DELETE FROM candidates_pipeline');
    console.log('✅ 刪除完成\n');

    // 重置 ID 序列
    console.log('🔄 重置 ID 序列...');
    await client.query('ALTER SEQUENCE candidates_pipeline_id_seq RESTART WITH 1');
    console.log('✅ 重置完成\n');

    // 讀取 CSV
    console.log('📥 從 Google Sheets 讀取...');
    const data = fetchWithGog('1PunpaDAFBPBL_I76AiRYGXKaXDZvMl1c262SEtxRk6Q', 'A1:L500');
    const rows = rowsToObjects(data.values);
    console.log(`✅ 讀取 ${rows.length} 筆\n`);

    // 分批導入
    console.log(`📊 分批導入 ${rows.length} 筆資料...\n`);
    let inserted = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      
      const name = row['姓名'] || '';
      const phone = row['聯絡方式'] || '';
      const currentPosition = row['應徵職位'] || '';
      const skills = row['主要技能'] || '';
      const yearsExperience = row['工作經驗(年)'] || '';
      const education = row['學歷'] || '';
      const contactLink = row['履歷檔案連結'] || '';
      const status = row['狀態'] || '新進';
      const recruiter = row['獵頭顧問'] || 'Jacky';
      const notes = row['備註'] || '';

      let createdAt = new Date().toISOString();
      let updatedAt = createdAt;
      
      try {
        if (row['新增日期']) createdAt = new Date(row['新增日期']).toISOString();
        if (row['最後更新']) updatedAt = new Date(row['最後更新']).toISOString();
      } catch (e) {
        // keep defaults
      }

      try {
        const query = `
          INSERT INTO candidates_pipeline (
            name, phone, current_position, years_experience,
            skills, education, contact_link, status, recruiter, notes,
            created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `;

        await client.query(query, [
          name, phone, currentPosition, yearsExperience,
          skills, education, contactLink, status, recruiter, notes,
          createdAt, updatedAt
        ]);
        inserted++;

        if ((i + 1) % 50 === 0) {
          console.log(`  ✓ ${i + 1} / ${rows.length}`);
        }
      } catch (e) {
        if (!e.message.includes('character varying')) {
          console.log(`  ⚠️  [${i + 1}] ${name}: ${e.message.substring(0, 60)}`);
        }
      }
    }

    console.log(`\n✅ 導入完成：${inserted} 筆\n`);

    // 驗證
    console.log('📈 驗收：');
    const result = await client.query('SELECT COUNT(*) as count, MIN(id) as min_id, MAX(id) as max_id FROM candidates_pipeline');
    const count = result.rows[0].count;
    const minId = result.rows[0].min_id;
    const maxId = result.rows[0].max_id;
    console.log(`  ✅ 總數：${count} | ID: ${minId}-${maxId}`);

    const withPos = await client.query(
      "SELECT COUNT(*) as count FROM candidates_pipeline WHERE current_position IS NOT NULL AND current_position != ''"
    );
    console.log(`  ✅ 有職位：${withPos.rows[0].count}`);

    // 列出前 3 筆
    const preview = await client.query(`
      SELECT id, name, current_position, years_experience
      FROM candidates_pipeline
      ORDER BY id ASC
      LIMIT 3
    `);
    console.log(`\n  📋 前 3 筆：`);
    preview.rows.forEach(row => {
      console.log(`     [${row.id}] ${row.name} | ${row.current_position} | ${row.years_experience}年`);
    });

    console.log('\n✅ 完成！');
    process.exit(0);
  } catch (error) {
    console.error(`\n❌ 失敗：${error.message}`);
    process.exit(1);
  } finally {
    await client.release();
    await pool.end();
  }
}

main();
