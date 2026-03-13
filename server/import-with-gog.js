#!/usr/bin/env node
/**
 * import-with-gog.js - 使用 gog CLI 讀取 Google Sheets，然後導入 PostgreSQL
 */

require('dotenv').config();
const { Pool } = require('pg');
const { execSync } = require('child_process');
const fs = require('fs');

const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URI;
if (!DATABASE_URL) { console.error('❌ DATABASE_URL 未設定'); process.exit(1); }

const pool = new Pool({ connectionString: DATABASE_URL });

const SHEETS = {
  candidates: {
    sheet_id: '1PunpaDAFBPBL_I76AiRYGXKaXDZvMl1c262SEtxRk6Q',
    name: '履歷池',
    range: 'A1:L500'  // 429 行 + 12 列
  },
  jobs: {
    sheet_id: '1QPaeOm-slNVFCeM8Q3gg3DawKjzp2tYwyfquvdHlZFE',
    name: '職缺管理',
    range: 'A1:U100'  // 53 行 + 21 列
  }
};

/**
 * 使用 gog 讀取 Google Sheets
 */
function fetchWithGog(sheetId, range) {
  try {
    const cmd = `gog sheets get ${sheetId} "${range}" --account aiagentg888@gmail.com --json`;
    const output = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    return JSON.parse(output);
  } catch (error) {
    throw new Error(`gog 讀取失敗：${error.message}`);
  }
}

/**
 * 將行陣列轉換為物件（使用標題作為鍵）
 */
function rowsToObjects(values) {
  if (!values || values.length < 2) return [];
  
  const headers = values[0];
  const rows = [];
  
  for (let i = 1; i < values.length; i++) {
    const rowData = {};
    for (let j = 0; j < headers.length; j++) {
      rowData[headers[j]] = values[i][j] || '';
    }
    rows.push(rowData);
  }
  
  return rows;
}

/**
 * 匯入候選人
 */
async function importCandidates(client, rows) {
  if (!rows || rows.length === 0) {
    console.log('❌ 沒有候選人資料');
    return 0;
  }

  console.log(`\n📊 匯入 ${rows.length} 位候選人...`);

  // 建立表
  await client.query(`
    CREATE TABLE IF NOT EXISTS candidates_pipeline (
      id VARCHAR(50) PRIMARY KEY,
      name VARCHAR(255),
      email VARCHAR(255),
      phone VARCHAR(20),
      location VARCHAR(100),
      current_position VARCHAR(255),
      years_experience INT,
      job_changes INT,
      avg_tenure_months INT,
      recent_gap_months INT,
      skills JSONB,
      education VARCHAR(255),
      source VARCHAR(100),
      work_history JSONB,
      leaving_reason TEXT,
      stability_score INT,
      education_details JSONB,
      personality JSONB,
      status VARCHAR(50),
      recruiter VARCHAR(100),
      notes TEXT,
      resume_url TEXT,
      created_at TIMESTAMP,
      updated_at TIMESTAMP,
      sync_to_sheets_at TIMESTAMP
    )
  `);

  let inserted = 0;

  for (let i = 0; i < rows.length; i++) {
    try {
      const row = rows[i];
      
      // 簡單的欄位映射（根據實際 Sheet 欄位）
      const skills = (row['主要技能'] || '')
        .split(',')
        .map(s => s.trim())
        .filter(s => s);

      const candidateId = `${row['姓名']}_${i}`.replace(/\s+/g, '_');

      const query = `
        INSERT INTO candidates_pipeline (
          id, name, email, phone, location, current_position,
          years_experience, job_changes, avg_tenure_months, recent_gap_months,
          skills, education, source, work_history, leaving_reason, stability_score,
          education_details, personality, status, recruiter, notes, resume_url,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
          $17, $18, $19, $20, $21, $22, NOW(), NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          status = EXCLUDED.status,
          updated_at = NOW()
      `;

      // 解析工作經驗年數（可能是 "6-7年" 或 "30" 格式）
      let yearsExp = 0;
      const expStr = row['工作經驗(年)'] || '';
      const matches = expStr.match(/\d+/);
      if (matches) yearsExp = parseInt(matches[0]);

      await client.query(query, [
        candidateId,
        row['姓名'] || '',
        (row['聯絡方式'] || '').match(/[\w.-]+@[\w.-]+/)?.[0] || '',  // 從聯絡方式提取 email
        (row['聯絡方式'] || '').match(/\d{4}-?\d{3}-?\d{3}/)?.[0] || '',  // 提取電話
        '',  // location
        row['應徵職位'] || '',
        yearsExp,
        0,  // job_changes
        0,  // avg_tenure_months
        0,  // recent_gap_months
        JSON.stringify(skills),
        row['學歷'] || '',
        '履歷進件',  // source
        '{}',  // work_history
        '',  // leaving_reason
        0,  // stability_score
        '{}',  // education_details
        '{}',  // personality
        row['狀態'] || '新進',
        row['獵頭顧問'] || 'Jacky',
        row['備註'] || '',
        row['履歷檔案連結'] || ''
      ]);

      inserted++;

      if ((i + 1) % 100 === 0) {
        console.log(`  ✓ 已匯入 ${i + 1} 筆...`);
      }
    } catch (e) {
      console.log(`  ⚠️  第 ${i + 1} 筆錯誤：${e.message}`);
    }
  }

  console.log(`✅ 成功匯入 ${inserted}/${rows.length} 位候選人`);
  return inserted;
}

/**
 * 匯入職缺
 */
async function importJobs(client, rows) {
  if (!rows || rows.length === 0) {
    console.log('❌ 沒有職缺資料');
    return 0;
  }

  console.log(`\n📊 匯入 ${rows.length} 個職缺...`);

  // 建立表
  await client.query(`
    CREATE TABLE IF NOT EXISTS jobs_pipeline (
      id VARCHAR(50) PRIMARY KEY,
      position_name VARCHAR(255),
      client_company VARCHAR(255),
      department VARCHAR(100),
      open_positions INT,
      salary_range VARCHAR(100),
      key_skills JSONB,
      experience_required VARCHAR(100),
      education_required VARCHAR(100),
      location VARCHAR(100),
      job_status VARCHAR(50),
      language_required VARCHAR(100),
      special_conditions TEXT,
      industry_background VARCHAR(100),
      team_size VARCHAR(50),
      key_challenges TEXT,
      attractive_points TEXT,
      recruitment_difficulty TEXT,
      interview_process TEXT,
      consultant_notes TEXT,
      created_at TIMESTAMP,
      updated_at TIMESTAMP,
      sync_to_sheets_at TIMESTAMP
    )
  `);

  let inserted = 0;

  for (let i = 0; i < rows.length; i++) {
    try {
      const row = rows[i];

      const keySkills = (row['主要技能'] || '')
        .split(',')
        .map(s => s.trim())
        .filter(s => s);

      const jobId = `${row['職位名稱']}_${i}`.replace(/\s+/g, '_');

      const query = `
        INSERT INTO jobs_pipeline (
          id, position_name, client_company, department, open_positions,
          salary_range, key_skills, experience_required, education_required,
          location, job_status, language_required, special_conditions,
          industry_background, team_size, key_challenges, attractive_points,
          recruitment_difficulty, interview_process, consultant_notes,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
          $16, $17, $18, $19, $20, NOW(), NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          position_name = EXCLUDED.position_name,
          updated_at = NOW()
      `;

      await client.query(query, [
        jobId,
        row['職位名稱'] || '',
        row['客戶公司'] || '',
        row['部門'] || '',
        parseInt(row['需求人數']) || 1,
        row['薪資範圍'] || '',
        JSON.stringify(keySkills),
        row['經驗要求'] || '',
        row['學歷要求'] || '',
        row['工作地點'] || '',
        row['職位狀態'] || '招募中',
        row['語言要求'] || '',
        row['特殊條件'] || '',
        row['產業背景要求'] || '',
        row['團隊規模'] || '',
        row['關鍵挑戰'] || '',
        row['吸引亮點'] || '',
        row['招募困難點'] || '',
        row['面試流程'] || '',
        row['顧問面談備註'] || ''
      ]);

      inserted++;

      if ((i + 1) % 20 === 0) {
        console.log(`  ✓ 已匯入 ${i + 1} 個...`);
      }
    } catch (e) {
      console.log(`  ⚠️  第 ${i + 1} 個錯誤：${e.message}`);
    }
  }

  console.log(`✅ 成功匯入 ${inserted}/${rows.length} 個職缺`);
  return inserted;
}

/**
 * 主函數
 */
async function main() {
  console.log('🔄 開始導入資料...\n');

  const client = await pool.connect();

  try {
    // 下載並匯入候選人
    console.log('📥 讀取履歷池 (429 筆資料)...');
    const candidatesData = fetchWithGog(SHEETS.candidates.sheet_id, SHEETS.candidates.range);
    const candidateRows = rowsToObjects(candidatesData.values);
    console.log(`✅ 讀取成功：${candidateRows.length} 筆`);

    await importCandidates(client, candidateRows);

    // 下載並匯入職缺
    console.log('\n📥 讀取職缺 (53 筆資料)...');
    const jobsData = fetchWithGog(SHEETS.jobs.sheet_id, SHEETS.jobs.range);
    const jobRows = rowsToObjects(jobsData.values);
    console.log(`✅ 讀取成功：${jobRows.length} 筆`);

    await importJobs(client, jobRows);

    // 驗證
    console.log('\n\n📈 導入結果：');
    
    const candidateResult = await client.query('SELECT COUNT(*) as count FROM candidates_pipeline');
    console.log(`  ✅ 候選人：${candidateResult.rows[0].count} 位`);

    const jobResult = await client.query('SELECT COUNT(*) as count FROM jobs_pipeline');
    console.log(`  ✅ 職缺：${jobResult.rows[0].count} 個`);

    console.log('\n✅ 導入完成！');
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
