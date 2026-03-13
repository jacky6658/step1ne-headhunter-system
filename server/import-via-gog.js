/**
 * import-via-gog.js - 使用 gog sheets 命令從 Google Sheets 匯入資料
 */

require('dotenv').config();
const { Pool } = require('pg');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URI;
if (!DATABASE_URL) { console.error('❌ DATABASE_URL 未設定'); process.exit(1); }

const pool = new Pool({ connectionString: DATABASE_URL });

const SHEET_ID_CANDIDATES = '1PunpaDAFBPBL_I76AiRYGXKaXDZvMl1c262SEtxRk6Q';
const SHEET_ID_JOBS = '1QPaeOm-slNVFCeM8Q3gg3DawKjzp2tYwyfquvdHlZFE';

/**
 * 使用 gog sheets get 讀取資料
 */
async function importCandidates(client) {
  console.log('\n📖 匯入候選人（透過 gog sheets）...');

  try {
    // 使用 gog sheets get 讀取履歷池數據
    const { stdout } = await execPromise(
      `gog sheets get "${SHEET_ID_CANDIDATES}" "A2:V500" --account aiagentg888@gmail.com --plain`,
      { maxBuffer: 50 * 1024 * 1024 }
    );

    const lines = stdout.trim().split('\n');
    console.log(`✅ 讀取 ${lines.length} 筆候選人資料`);

    // 清空舊資料
    await client.query('DELETE FROM candidates_pipeline WHERE 1=1');

    let importedCount = 0;

    for (const [idx, line] of lines.entries()) {
      try {
        const fields = line.split('\t'); // TSV 格式

        if (!fields[0]) continue;

        const candidateId = fields[1] ? fields[1].split('@')[0] : `candidate_${idx}`;
        const name = fields[0];

        // 插入候選人到 candidates_pipeline
        await client.query(`
          INSERT INTO candidates_pipeline (
            id, candidate_id, name, status, consultant, notes, last_updated, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT (candidate_id) DO UPDATE SET
            name = EXCLUDED.name,
            status = EXCLUDED.status,
            last_updated = CURRENT_TIMESTAMP
        `, [
          `${candidateId}_${Date.now()}`,
          candidateId,
          name,
          fields[17] || '待聯繫',  // 狀態
          fields[18],  // 獵頭顧問
          `Email: ${fields[1]}\nPhone: ${fields[2]}\nLocation: ${fields[3]}\nTitle: ${fields[4]}\nSkills: ${fields[9]}`
        ]);

        importedCount++;

        if (importedCount % 50 === 0) {
          console.log(`  ⏳ 已匯入 ${importedCount} 筆...`);
        }

      } catch (err) {
        console.error(`  ⚠️  行 ${idx + 2} 匯入失敗:`, err.message);
      }
    }

    console.log(`✅ 候選人匯入完成！成功: ${importedCount} 筆`);
    return importedCount;

  } catch (error) {
    console.error('❌ 候選人匯入失敗:', error.message);
    throw error;
  }
}

/**
 * 匯入職缺
 */
async function importJobs(client) {
  console.log('\n📋 匯入職缺（透過 gog sheets）...');

  try {
    // 使用 gog sheets get 讀取職缺數據
    const { stdout } = await execPromise(
      `gog sheets get "${SHEET_ID_JOBS}" "A2:U100" --account aiagentg888@gmail.com --plain`,
      { maxBuffer: 50 * 1024 * 1024 }
    );

    const lines = stdout.trim().split('\n');
    console.log(`✅ 讀取 ${lines.length} 筆職缺資料`);

    // 先檢查表是否存在
    const jobsTableExists = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'jobs'
      )
    `);

    if (!jobsTableExists.rows[0].exists) {
      console.log('⚠️  jobs 表不存在，跳過職缺匯入');
      return 0;
    }

    // 清空舊資料
    await client.query('DELETE FROM jobs');

    let importedCount = 0;

    for (const [idx, line] of lines.entries()) {
      try {
        const fields = line.split('\t'); // TSV 格式

        if (!fields[0]) continue;

        const jobId = `job_${idx + 2}`;

        // 插入職缺
        await client.query(`
          INSERT INTO jobs (
            job_id, title, client_company, department, headcount, salary_range,
            main_skills, experience_required, education_required, work_location,
            job_status, created_date, last_updated_date
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          ON CONFLICT (job_id) DO NOTHING
        `, [
          jobId,
          fields[0],  // 職位名稱
          fields[1],  // 客戶公司
          fields[2],  // 部門
          parseFloat(fields[3]) || null,  // 需求人數
          fields[4],  // 薪資範圍
          fields[5],  // 主要技能
          fields[6],  // 經驗要求
          fields[7],  // 學歷要求
          fields[8],  // 工作地點
          fields[9] || '開放中',  // 職位狀態
          null,  // 建立日期
          null   // 最後更新
        ]);

        importedCount++;

        if (importedCount % 10 === 0) {
          console.log(`  ⏳ 已匯入 ${importedCount} 筆...`);
        }

      } catch (err) {
        console.error(`  ⚠️  行 ${idx + 2} 匯入失敗:`, err.message);
      }
    }

    console.log(`✅ 職缺匯入完成！成功: ${importedCount} 筆`);
    return importedCount;

  } catch (error) {
    console.error('❌ 職缺匯入失敗:', error.message);
    throw error;
  }
}

/**
 * 主函數
 */
async function main() {
  const client = await pool.connect();

  try {
    console.log('🔄 開始從 Google Sheets 匯入資料...');

    await importCandidates(client);
    await importJobs(client);

    // 驗證
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
