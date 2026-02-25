#!/usr/bin/env node
/**
 * import-clean-v2.js - 清空 + 完整導入
 * 直接插入正確的 12 個欄位
 */

const { Pool } = require('pg');
const { execSync } = require('child_process');

const DATABASE_URL = process.env.DATABASE_URL || 
  'postgresql://root:etUh2zkR4Mr8gfWLs059S7Dm1T6Yby3Q@tpe1.clusters.zeabur.com:27883/zeabur';

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

async function importBatch(client, rows, batchSize = 20) {
  let inserted = 0;
  let failed = 0;

  for (let batch = 0; batch < rows.length; batch += batchSize) {
    const batchRows = rows.slice(batch, batch + batchSize);
    
    try {
      for (const row of batchRows) {
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
          // 保持默認值
        }

        const query = `
          INSERT INTO candidates_pipeline (
            name, phone, current_position, years_experience,
            skills, education, contact_link, status, recruiter, notes,
            created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          RETURNING id
        `;

        await client.query(query, [
          name, phone, currentPosition, yearsExperience,
          skills, education, contactLink, status, recruiter, notes,
          createdAt, updatedAt
        ]);
        inserted++;
      }
      
      if ((batch + batchSize) % 100 === 0 || batch + batchSize >= rows.length) {
        console.log(`  ✓ 已導入 ${Math.min(batch + batchSize, rows.length)} / ${rows.length} 筆`);
      }
    } catch (e) {
      failed += batchRows.length;
      console.log(`  ⚠️  批次 ${batch / batchSize + 1} 失敗：${e.message.substring(0, 80)}`);
    }
  }

  return { inserted, failed };
}

async function main() {
  console.log('🔄 開始清空 + 完整導入...\n');

  const client = await pool.connect();

  try {
    // 清空
    console.log('🗑️  清空舊資料...');
    await client.query('TRUNCATE TABLE candidates_pipeline CASCADE');
    console.log('✅ 清空完成\n');

    // 讀取
    console.log('📥 從 Google Sheets 讀取履歷池...');
    const data = fetchWithGog('1PunpaDAFBPBL_I76AiRYGXKaXDZvMl1c262SEtxRk6Q', 'A1:L500');
    const rows = rowsToObjects(data.values);
    console.log(`✅ 讀取 ${rows.length} 筆資料\n`);

    // 導入
    console.log(`📊 匯入資料到 PostgreSQL...\n`);
    const { inserted, failed } = await importBatch(client, rows, 20);
    
    console.log(`\n✅ 導入完成：${inserted} 筆成功 + ${failed} 筆失敗\n`);

    // 驗證
    console.log('📈 驗收：');
    const result = await client.query('SELECT COUNT(*) as count FROM candidates_pipeline');
    console.log(`  ✅ 總候選人：${result.rows[0].count}`);

    const withPos = await client.query(
      "SELECT COUNT(*) as count FROM candidates_pipeline WHERE current_position IS NOT NULL AND current_position != ''"
    );
    console.log(`  ✅ 有職位：${withPos.rows[0].count}`);

    const withSkills = await client.query(
      "SELECT COUNT(*) as count FROM candidates_pipeline WHERE skills IS NOT NULL AND skills != ''"
    );
    console.log(`  ✅ 有技能：${withSkills.rows[0].count}`);

    // 列出前 3 筆
    const preview = await client.query(`
      SELECT id, name, current_position, skills, years_experience
      FROM candidates_pipeline
      LIMIT 3
    `);
    console.log(`\n  📋 前 3 筆預覽：`);
    preview.rows.forEach(row => {
      console.log(`     [${row.id}] ${row.name} | ${row.current_position} | ${row.years_experience}年`);
    });

    const jobCount = await client.query('SELECT COUNT(*) as count FROM jobs_pipeline');
    console.log(`\n  ✅ 職缺總數：${jobCount.rows[0].count}`);

    console.log('\n✅ 系統就緒！');
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
