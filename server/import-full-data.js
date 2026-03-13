/**
 * import-full-data.js - 從 Google Sheets 匯入所有資料到 PostgreSQL
 * 
 * 用法：
 * node server/import-full-data.js
 * 
 * 功能：
 * - 匯入 361 筆候選人（履歷池索引）
 * - 匯入 53 筆職缺（職缺管理）
 */

require('dotenv').config();
const { Pool } = require('pg');
const https = require('https');
const csv = require('csv-parse/sync');

const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URI;
if (!DATABASE_URL) { console.error('❌ DATABASE_URL 未設定'); process.exit(1); }

const pool = new Pool({ connectionString: DATABASE_URL });

// Google Sheets 配置
const SHEETS = {
  candidates: {
    id: '1PunpaDAFBPBL_I76AiRYGXKaXDZvMl1c262SEtxRk6Q',
    gid: '142613837',
    name: '履歷池索引'
  },
  jobs: {
    id: '1QPaeOm-slNVFCeM8Q3gg3DawKjzp2tYwyfquvdHlZFE',
    gid: '0',
    name: '職缺管理'
  }
};

/**
 * 下載 Google Sheets CSV 資料
 */
function fetchSheetCSV(sheetId, gid) {
  return new Promise((resolve, reject) => {
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
    
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

/**
 * 匯入候選人資料
 */
async function importCandidates(client, csvData) {
  const records = csv.parse(csvData, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  console.log(`\n📖 匯入候選人（${records.length} 筆）...`);

  let importedCount = 0;
  let skippedCount = 0;

  // 清空舊資料
  await client.query('DELETE FROM candidates');
  await client.query('DELETE FROM candidates_pipeline');

  for (const [idx, record] of records.entries()) {
    try {
      if (!record['姓名']) {
        skippedCount++;
        continue;
      }

      const candidateId = record['Email'] ? record['Email'].split('@')[0] : `candidate_${idx}`;

      // 插入候選人基本資訊
      await client.query(`
        INSERT INTO candidates (
          candidate_id, name, email, phone, location, current_title,
          years_experience, job_changes, avg_tenure, recent_gap,
          skills, education, source, work_history, resign_reason,
          stability_score, education_json, disc, status, consultant, remarks, talent_grade
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
        ON CONFLICT (candidate_id) DO UPDATE SET
          name = EXCLUDED.name,
          status = EXCLUDED.status,
          last_updated = CURRENT_TIMESTAMP
      `, [
        candidateId,
        record['姓名'],
        record['Email'],
        record['電話'],
        record['地點'],
        record['目前職位'],
        parseFloat(record['總年資(年)']) || null,
        parseFloat(record['轉職次數']) || null,
        parseFloat(record['平均任職(月)']) || null,
        parseFloat(record['最近gap(月)']) || null,
        record['技能'],
        record['學歷'],
        record['來源'] || 'Google Sheets',
        record['工作經歷JSON'],
        record['離職原因'],
        parseFloat(record['穩定性評分']) || null,
        record['學歷JSON'],
        record['DISC/Big Five'],
        record['狀態'] || '待聯繫',
        record['獵頭顧問'],
        record['備註'],
        record['人才等級']
      ]);

      importedCount++;

      if (importedCount % 50 === 0) {
        console.log(`  ⏳ 已匯入 ${importedCount} 筆...`);
      }

    } catch (err) {
      console.error(`  ⚠️  行 ${idx + 2} 匯入失敗:`, err.message);
      skippedCount++;
    }
  }

  console.log(`✅ 候選人匯入完成！`);
  console.log(`   成功: ${importedCount} 筆`);
  console.log(`   失敗: ${skippedCount} 筆`);

  return importedCount;
}

/**
 * 匯入職缺資料
 */
async function importJobs(client, csvData) {
  const records = csv.parse(csvData, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  console.log(`\n📋 匯入職缺（${records.length} 筆）...`);

  let importedCount = 0;
  let skippedCount = 0;

  // 清空舊資料
  await client.query('DELETE FROM jobs');

  for (const [idx, record] of records.entries()) {
    try {
      if (!record['職位名稱']) {
        skippedCount++;
        continue;
      }

      const jobId = `job_${idx + 2}`;

      // 插入職缺資訊
      await client.query(`
        INSERT INTO jobs (
          job_id, title, client_company, department, headcount, salary_range,
          main_skills, experience_required, education_required, work_location,
          job_status, created_date, last_updated_date, language_required,
          special_conditions, industry_background, team_size,
          key_challenges, attractions, recruitment_difficulty, interview_process, consultant_notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
        ON CONFLICT (job_id) DO UPDATE SET
          title = EXCLUDED.title,
          job_status = EXCLUDED.job_status,
          last_sync = CURRENT_TIMESTAMP
      `, [
        jobId,
        record['職位名稱'],
        record['客戶公司'],
        record['部門'],
        parseFloat(record['需求人數']) || null,
        record['薪資範圍'],
        record['主要技能'],
        record['經驗要求'],
        record['學歷要求'],
        record['工作地點'],
        record['職位狀態'] || '開放中',
        record['建立日期'] ? new Date(record['建立日期']) : null,
        record['最後更新'] ? new Date(record['最後更新']) : null,
        record['語言要求'],
        record['特殊條件'],
        record['產業背景要求'],
        record['團隊規模'],
        record['關鍵挑戰'],
        record['吸引亮點'],
        record['招募困難點'],
        record['面試流程'],
        record['顧問面談備註']
      ]);

      importedCount++;

      if (importedCount % 10 === 0) {
        console.log(`  ⏳ 已匯入 ${importedCount} 筆...`);
      }

    } catch (err) {
      console.error(`  ⚠️  行 ${idx + 2} 匯入失敗:`, err.message);
      skippedCount++;
    }
  }

  console.log(`✅ 職缺匯入完成！`);
  console.log(`   成功: ${importedCount} 筆`);
  console.log(`   失敗: ${skippedCount} 筆`);

  return importedCount;
}

/**
 * 主函數
 */
async function main() {
  const client = await pool.connect();

  try {
    console.log('🔄 開始從 Google Sheets 匯入資料...\n');

    // 1. 匯入候選人
    console.log(`📥 下載 ${SHEETS.candidates.name}...`);
    const candidatesCSV = await fetchSheetCSV(SHEETS.candidates.id, SHEETS.candidates.gid);
    const candidatesCount = await importCandidates(client, candidatesCSV);

    // 2. 匯入職缺
    console.log(`\n📥 下載 ${SHEETS.jobs.name}...`);
    const jobsCSV = await fetchSheetCSV(SHEETS.jobs.id, SHEETS.jobs.gid);
    const jobsCount = await importJobs(client, jobsCSV);

    // 3. 驗證
    const candResult = await client.query('SELECT COUNT(*) as count FROM candidates');
    const jobsResult = await client.query('SELECT COUNT(*) as count FROM jobs');

    console.log(`\n✅ 匯入完成！`);
    console.log(`   📊 資料庫現有：${candResult.rows[0].count} 位候選人，${jobsResult.rows[0].count} 個職缺`);

  } catch (error) {
    console.error('❌ 匯入失敗:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// 執行
main();
