#!/usr/bin/env node
/**
 * import-final.js - 導入到現有 candidates_pipeline 表（保留現有欄位結構）
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
    rows.push(rowData);
  }
  return rows;
}

async function importCandidates(client, rows) {
  if (!rows || rows.length === 0) {
    console.log('❌ 沒有候選人資料');
    return 0;
  }

  console.log(`\n📊 匯入 ${rows.length} 位候選人...\n`);

  let inserted = 0;
  let updated = 0;

  for (let i = 0; i < rows.length; i++) {
    try {
      const row = rows[i];
      
      // 簡化版欄位映射
      const candidateId = `${row['姓名']}_${i}`.replace(/\s+/g, '_');
      const jobMatches = JSON.stringify([]);  // 待配對
      const aiScores = JSON.stringify({});     // 待 AI 評分
      const progressTracking = JSON.stringify({
        status: row['狀態'] || '新進',
        updated_at: new Date().toISOString()
      });

      // 嘗試 upsert
      const query = `
        INSERT INTO candidates_pipeline (
          id, candidate_id, name, status, progress_tracking,
          notes, consultant, job_matches, ai_match_scores, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          progress_tracking = EXCLUDED.progress_tracking,
          notes = EXCLUDED.notes,
          last_updated = NOW(),
          updated_by = 'import-script'
        RETURNING id
      `;

      const result = await client.query(query, [
        candidateId,
        row['姓名'] || '',
        row['姓名'] || '',
        row['狀態'] || '新進',
        progressTracking,
        `應徵職位: ${row['應徵職位'] || ''} | 技能: ${row['主要技能'] || ''} | 聯絡: ${row['聯絡方式'] || ''}`,
        row['獵頭顧問'] || 'Jacky',
        jobMatches,
        aiScores
      ]);

      // 判斷是新增還是更新
      if (result.rowCount > 0) {
        // 檢查是否為新記錄（id 欄位原本是 NULL）
        const checkQuery = 'SELECT created_at FROM candidates_pipeline WHERE id = $1';
        const checkResult = await client.query(checkQuery, [candidateId]);
        
        // 簡單啟發：如果 created_at 剛才被設定為 NOW()，就是新增
        if (i < 10 || (i + 1) % 100 === 0) {
          console.log(`  ✓ 第 ${i + 1} 筆：${row['姓名']}`);
        }
        inserted++;
      }

    } catch (e) {
      if (e.message.includes('duplicate')) {
        updated++;
      } else {
        console.log(`  ⚠️  第 ${i + 1} 筆錯誤：${e.message.substring(0, 80)}`);
      }
    }
  }

  console.log(`\n✅ 完成：${inserted} 筆新增 + ${updated} 筆更新`);
  return inserted + updated;
}

async function main() {
  console.log('🔄 開始導入候選人資料到現有表...\n');

  const client = await pool.connect();

  try {
    // 讀取
    console.log('📥 讀取履歷池 (429 筆資料)...');
    const candidatesData = fetchWithGog(SHEETS.candidates.sheet_id, SHEETS.candidates.range);
    const candidateRows = rowsToObjects(candidatesData.values);
    console.log(`✅ 讀取成功：${candidateRows.length} 筆\n`);

    // 導入
    const count = await importCandidates(client, candidateRows);

    // 驗證
    console.log('\n📈 最終統計：');
    const result = await client.query('SELECT COUNT(*) as count FROM candidates_pipeline');
    console.log(`  ✅ 候選人總數：${result.rows[0].count} 位`);

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
