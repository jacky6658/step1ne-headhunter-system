#!/usr/bin/env node
/**
 * import-from-csv.js - 從 CSV 完整導入到 PostgreSQL
 * 用法：node server/import-from-csv.js <candidates.csv> <jobs.csv>
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const csv = require('csv-parse/sync');

const DATABASE_URL = process.env.DATABASE_URL || 
  'postgresql://root:etUh2zkR4Mr8gfWLs059S7Dm1T6Yby3Q@tpe1.clusters.zeabur.com:27883/zeabur';

const pool = new Pool({ connectionString: DATABASE_URL });

/**
 * 讀取 CSV 並解析
 */
function readCSV(filePath) {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const records = csv.parse(fileContent, { 
      columns: true,
      skip_empty_lines: true 
    });
    return records;
  } catch (error) {
    console.error(`❌ 讀取 CSV 失敗: ${filePath}`);
    console.error(error.message);
    return [];
  }
}

/**
 * 初始化資料庫表
 */
async function initDatabase(client) {
  try {
    console.log('🔄 初始化資料庫表...');
    
    // 讀取 init-schema-v2.sql
    const schemaSql = fs.readFileSync(
      path.join(__dirname, 'init-schema-v2.sql'), 
      'utf-8'
    );
    
    // 執行 SQL
    await client.query(schemaSql);
    console.log('✅ 資料庫表初始化完成');
  } catch (error) {
    console.error('❌ 初始化失敗:', error.message);
    throw error;
  }
}

/**
 * 導入職缺資料
 */
async function importJobs(client, records) {
  if (records.length === 0) {
    console.log('⚠️  沒有職缺資料');
    return 0;
  }

  console.log(`\n📊 導入 ${records.length} 個職缺...`);

  let inserted = 0;
  for (let i = 0; i < records.length; i++) {
    try {
      const row = records[i];

      const query = `
        INSERT INTO jobs_pipeline (
          position_name, client_company, department, open_positions,
          salary_range, key_skills, experience_required, education_required,
          location, job_status, created_date, last_updated,
          language_required, special_conditions, industry_background,
          team_size, key_challenges, attractive_points,
          recruitment_difficulty, interview_process, consultant_notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
      `;

      await client.query(query, [
        row['職位名稱'] || '',
        row['客戶公司'] || '',
        row['部門'] || '',
        row['需求人數'] || '',
        row['薪資範圍'] || '',
        row['主要技能'] || '',
        row['經驗要求'] || '',
        row['學歷要求'] || '',
        row['工作地點'] || '',
        row['職位狀態'] || '',
        row['建立日期'] || '',
        row['最後更新'] || '',
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

      if ((i + 1) % 10 === 0) {
        console.log(`  ✓ 已導入 ${i + 1} 個...`);
      }
    } catch (error) {
      console.log(`  ⚠️  第 ${i + 1} 個職缺失敗: ${error.message.substring(0, 80)}`);
    }
  }

  console.log(`✅ 成功導入 ${inserted}/${records.length} 個職缺`);
  return inserted;
}

/**
 * 導入候選人資料
 */
async function importCandidates(client, records) {
  if (records.length === 0) {
    console.log('⚠️  沒有候選人資料');
    return 0;
  }

  console.log(`\n📊 導入 ${records.length} 位候選人...`);

  let inserted = 0;
  for (let i = 0; i < records.length; i++) {
    try {
      const row = records[i];

      // 解析 JSON 欄位
      let workHistory = {};
      try {
        if (row['工作經歷JSON']) {
          workHistory = JSON.parse(row['工作經歷JSON']);
        }
      } catch (e) {
        workHistory = {};
      }

      let educationDetails = {};
      try {
        if (row['學歷JSON']) {
          educationDetails = JSON.parse(row['學歷JSON']);
        }
      } catch (e) {
        educationDetails = {};
      }

      const query = `
        INSERT INTO candidates_pipeline (
          name, contact_link, phone, location, current_position,
          years_experience, job_changes, avg_tenure_months, recent_gap_months,
          skills, education, source, work_history, leaving_reason,
          stability_score, education_details, personality_type,
          status, recruiter, notes, talent_level
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
      `;

      await client.query(query, [
        row['姓名'] || '',
        row['連結／信箱'] || '',
        row['電話'] || '',
        row['地點'] || '',
        row['目前職位'] || '',
        row['總年資(年)'] || '',
        row['轉職次數'] || '',
        row['平均任職(月)'] || '',
        row['最近gap(月)'] || '',
        row['技能'] || '',
        row['學歷'] || '',
        row['來源'] || '',
        JSON.stringify(workHistory),
        row['離職原因'] || '',
        row['穩定性評分'] || '',
        JSON.stringify(educationDetails),
        row['DISC/Big Five'] || '',
        row['狀態'] || '',
        row['獵頭顧問'] || '',
        row['備註'] || '',
        row['人才等級'] || ''
      ]);

      inserted++;

      if ((i + 1) % 100 === 0) {
        console.log(`  ✓ 已導入 ${i + 1} 位...`);
      }
    } catch (error) {
      console.log(`  ⚠️  第 ${i + 1} 位失敗: ${error.message.substring(0, 80)}`);
    }
  }

  console.log(`✅ 成功導入 ${inserted}/${records.length} 位候選人`);
  return inserted;
}

/**
 * 主函數
 */
async function main() {
  const candidatesPath = process.argv[2];
  const jobsPath = process.argv[3];

  if (!candidatesPath || !jobsPath) {
    console.log('用法: node import-from-csv.js <candidates.csv> <jobs.csv>');
    process.exit(1);
  }

  console.log('🚀 開始匯入資料...\n');

  const client = await pool.connect();

  try {
    // 1. 初始化資料庫
    await initDatabase(client);

    // 2. 導入職缺
    const jobRecords = readCSV(jobsPath);
    const jobCount = await importJobs(client, jobRecords);

    // 3. 導入候選人
    const candidateRecords = readCSV(candidatesPath);
    const candidateCount = await importCandidates(client, candidateRecords);

    // 4. 驗證
    console.log('\n📈 匯入結果統計：');
    const jobResult = await client.query('SELECT COUNT(*) as count FROM jobs_pipeline');
    const candidateResult = await client.query('SELECT COUNT(*) as count FROM candidates_pipeline');
    
    console.log(`  ✅ 職缺：${jobResult.rows[0].count} 個`);
    console.log(`  ✅ 候選人：${candidateResult.rows[0].count} 位`);

    console.log('\n✅ 匯入完成！所有資料已準備好');
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
