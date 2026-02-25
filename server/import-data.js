#!/usr/bin/env node
/**
 * import-data.js - 從 Google Sheets CSV export 匯入到 PostgreSQL
 * 使用 Node.js + pg (已安裝在項目中)
 */

const { Pool } = require('pg');
const https = require('https');
const csv = require('csv-parse/sync');

const DATABASE_URL = process.env.DATABASE_URL || 
  'postgresql://root:etUh2zkR4Mr8gfWLs059S7Dm1T6Yby3Q@tpe1.clusters.zeabur.com:27883/zeabur';

const pool = new Pool({ connectionString: DATABASE_URL });

const SHEETS = {
  candidates: {
    sheet_id: '1PunpaDAFBPBL_I76AiRYGXKaXDZvMl1c262SEtxRk6Q',
    gid: '142613837',
    name: '履歷池索引'
  },
  jobs: {
    sheet_id: '1QPaeOm-slNVFCeM8Q3gg3DawKjzp2tYwyfquvdHlZFE',
    gid: '0',
    name: '職缺管理'
  }
};

/**
 * 下載 CSV
 */
function fetchCSV(sheetId, gid) {
  return new Promise((resolve, reject) => {
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
    
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (data.includes('<HTML>') || data.includes('<html>')) {
          reject(new Error('返回 HTML，可能是認證問題'));
        } else {
          resolve(data);
        }
      });
    }).on('error', reject);
  });
}

/**
 * 解析 CSV
 */
function parseCSV(csvText) {
  try {
    const records = csv.parse(csvText, { columns: true });
    return records;
  } catch (e) {
    throw new Error(`CSV 解析錯誤：${e.message}`);
  }
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

  // 建立表（如果不存在）
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

      // 解析技能
      const skills = (row['技能'] || '')
        .split(',')
        .map(s => s.trim())
        .filter(s => s);

      const candidateId = `${row['姓名']}_${i}`.replace(/\s+/g, '_');

      // 安全的 upsert
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
          email = EXCLUDED.email,
          status = EXCLUDED.status,
          updated_at = NOW()
      `;

      await client.query(query, [
        candidateId,
        row['姓名'] || '',
        row['Email'] || '',
        row['電話'] || '',
        row['地點'] || '',
        row['目前職位'] || '',
        parseInt(row['總年資(年)']) || 0,
        parseInt(row['轉職次數']) || 0,
        parseInt(row['平均任職(月)']) || 0,
        parseInt(row['最近gap(月)']) || 0,
        JSON.stringify(skills),
        row['學歷'] || '',
        row['來源'] || '',
        row['工作經歷JSON'] || '{}',
        row['離職原因'] || '',
        parseInt(row['穩定性評分']) || 0,
        row['學歷JSON'] || '{}',
        row['DISC/Big Five'] || '{}',
        row['狀態'] || '新進',
        row['獵頭顧問'] || 'Jacky',
        row['備註'] || '',
        row['履歷連結'] || ''
      ]);

      inserted++;

      if ((i + 1) % 50 === 0) {
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

  // 建立表（如果不存在）
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

      // 解析技能
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
  console.log('🔄 開始從 Google Sheets 匯入資料...\n');

  const client = await pool.connect();

  try {
    // 下載並匯入候選人
    console.log('📥 下載履歷池索引...');
    const candidatesCSV = await fetchCSV(SHEETS.candidates.sheet_id, SHEETS.candidates.gid);
    const candidateRows = parseCSV(candidatesCSV);
    console.log(`✅ 下載成功：${candidateRows.length} 行`);

    const candidateCount = await importCandidates(client, candidateRows);

    // 下載並匯入職缺
    console.log('\n📥 下載職缺管理...');
    const jobsCSV = await fetchCSV(SHEETS.jobs.sheet_id, SHEETS.jobs.gid);
    const jobRows = parseCSV(jobsCSV);
    console.log(`✅ 下載成功：${jobRows.length} 行`);

    const jobCount = await importJobs(client, jobRows);

    // 驗證
    console.log('\n\n📈 匯入結果統計：');
    
    const candidateResult = await client.query('SELECT COUNT(*) as count FROM candidates_pipeline');
    console.log(`  ✅ 候選人：${candidateResult.rows[0].count} 位`);

    const jobResult = await client.query('SELECT COUNT(*) as count FROM jobs_pipeline');
    console.log(`  ✅ 職缺：${jobResult.rows[0].count} 個`);

    console.log('\n✅ 匯入完成！');
    process.exit(0);
  } catch (error) {
    console.error(`\n❌ 匯入失敗：${error.message}`);
    process.exit(1);
  } finally {
    await client.release();
    await pool.end();
  }
}

main();
