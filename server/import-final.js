#!/usr/bin/env node
/**
 * import-final.js - 完整導入所有 12 個 CSV 欄位到 candidates_pipeline
 * 
 * 表結構：id (auto-increment integer), name, contact_link, phone, location, 
 * current_position, years_experience (varchar), skills, education, status, etc.
 */

const { Pool } = require('pg');
const { execSync } = require('child_process');

const DATABASE_URL = process.env.DATABASE_URL || 
  'postgresql://root:etUh2zkR4Mr8gfWLs059S7Dm1T6Yby3Q@tpe1.clusters.zeabur.com:27883/zeabur';

const pool = new Pool({ connectionString: DATABASE_URL });

const SHEETS = {
  candidates: {
    sheet_id: '1PunpaDAFBPBL_I76AiRYGXKaXDZvMl1c262SEtxRk6Q',
    name: '履歷池',
    range: 'A1:L500'
  }
};

function fetchWithGog(sheetId, range) {
  try {
    const cmd = `gog sheets get ${sheetId} "${range}" --account aiagentg888@gmail.com --json`;
    const output = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    return JSON.parse(output);
  } catch (error) {
    throw new Error(`gog 讀取失敗：${error.message}`);
  }
}

function rowsToObjects(values) {
  if (!values || values.length < 2) return [];
  const headers = values[0];
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const rowData = {};
    for (let j = 0; j < headers.length; j++) {
      rowData[headers[j]] = values[i][j] || '';
    }
    // 只加入有姓名的記錄
    if (rowData['姓名'] && rowData['姓名'].trim()) {
      rows.push(rowData);
    }
  }
  return rows;
}

async function importCandidates(client, rows) {
  if (!rows || rows.length === 0) {
    console.log('❌ 沒有候選人資料');
    return 0;
  }

  console.log(`\n📊 匯入 ${rows.length} 位候選人（完整 12 個欄位）...\n`);

  let inserted = 0;
  let updated = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i++) {
    try {
      const row = rows[i];
      
      // 完整欄位映射（對應實際 SQL 欄位）
      const name = row['姓名'] || '';
      const phone = row['聯絡方式'] || '';
      const currentPosition = row['應徵職位'] || '';
      const skills = row['主要技能'] || '';
      const yearsExperience = row['工作經驗(年)'] || '';  // 保持為字串
      const education = row['學歷'] || '';
      const contactLink = row['履歷檔案連結'] || '';
      const status = row['狀態'] || '新進';
      const recruiter = row['獵頭顧問'] || 'Jacky';
      const notes = row['備註'] || '';
      
      // 解析日期
      let createdAt = null;
      let updatedAt = null;
      if (row['新增日期']) {
        try {
          createdAt = new Date(row['新增日期']).toISOString();
        } catch (e) {
          createdAt = new Date().toISOString();
        }
      } else {
        createdAt = new Date().toISOString();
      }
      
      if (row['最後更新']) {
        try {
          updatedAt = new Date(row['最後更新']).toISOString();
        } catch (e) {
          updatedAt = new Date().toISOString();
        }
      } else {
        updatedAt = createdAt;
      }

      // 嘗試 INSERT（id 自增，無需指定）
      const query = `
        INSERT INTO candidates_pipeline (
          name, 
          phone, 
          current_position,
          years_experience,
          skills,
          education,
          contact_link,
          status,
          recruiter,
          notes,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id
      `;

      const result = await client.query(query, [
        name,
        phone,
        currentPosition,
        yearsExperience,
        skills,
        education,
        contactLink,
        status,
        recruiter,
        notes,
        createdAt,
        updatedAt
      ]);

      if (result.rowCount > 0) {
        if (i < 5 || (i + 1) % 50 === 0) {
          console.log(`  ✓ 第 ${i + 1} 筆（ID: ${result.rows[0].id}）：${name} | 職位: ${currentPosition} | 年資: ${yearsExperience}`);
        }
        inserted++;
      }

    } catch (e) {
      console.log(`  ⚠️  第 ${i + 1} 筆錯誤：${e.message.substring(0, 100)}`);
      failed++;
    }
  }

  console.log(`\n✅ 完成：${inserted} 筆新增 + ${failed} 筆失敗`);
  return inserted;
}

async function main() {
  console.log('🔄 開始完整導入候選人資料...\n');

  const client = await pool.connect();

  try {
    // 清空舊資料
    console.log('🗑️  清空舊資料...');
    await client.query('TRUNCATE TABLE candidates_pipeline CASCADE');
    console.log('✅ 清空完成\n');

    // 讀取
    console.log('📥 讀取履歷池索引 (A1:L500)...');
    const candidatesData = fetchWithGog(SHEETS.candidates.sheet_id, SHEETS.candidates.range);
    const candidateRows = rowsToObjects(candidatesData.values);
    console.log(`✅ 讀取成功：${candidateRows.length} 筆\n`);

    // 導入
    const count = await importCandidates(client, candidateRows);

    // 驗證
    console.log('\n📈 最終統計：');
    const result = await client.query('SELECT COUNT(*) as count FROM candidates_pipeline');
    console.log(`  ✅ 候選人總數：${result.rows[0].count} 位`);

    // 驗證資料完整性
    const fieldCheck = await client.query(`
      SELECT 
        COUNT(CASE WHEN name IS NOT NULL AND name != '' THEN 1 END) as has_name,
        COUNT(CASE WHEN phone IS NOT NULL AND phone != '' THEN 1 END) as has_phone,
        COUNT(CASE WHEN current_position IS NOT NULL AND current_position != '' THEN 1 END) as has_position,
        COUNT(CASE WHEN skills IS NOT NULL AND skills != '' THEN 1 END) as has_skills,
        COUNT(CASE WHEN years_experience IS NOT NULL AND years_experience != '' THEN 1 END) as has_years
      FROM candidates_pipeline
    `);
    
    console.log(`\n  📊 欄位完整性檢查：`);
    console.log(`     - 姓名：${fieldCheck.rows[0].has_name} 筆`);
    console.log(`     - 聯絡方式：${fieldCheck.rows[0].has_phone} 筆`);
    console.log(`     - 目前職位：${fieldCheck.rows[0].has_position} 筆`);
    console.log(`     - 技能：${fieldCheck.rows[0].has_skills} 筆`);
    console.log(`     - 年資：${fieldCheck.rows[0].has_years} 筆`);

    const jobResult = await client.query('SELECT COUNT(*) as count FROM jobs_pipeline');
    console.log(`  ✅ 職缺總數：${jobResult.rows[0].count} 個`);

    console.log('\n✅ 導入完成！系統已就緒');
    process.exit(0);
  } catch (error) {
    console.error(`\n❌ 導入失敗：${error.message}`);
    process.exit(1);
  } finally {
    await client.release();
    await pool.end();
  }
}

main();
