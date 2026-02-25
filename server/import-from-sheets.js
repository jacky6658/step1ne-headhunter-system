/**
 * import-from-sheets.js - 從 Google Sheets 匯入候選人到 PostgreSQL
 * 
 * 用法：
 * node server/import-from-sheets.js
 */

const { Pool } = require('pg');
const https = require('https');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://root:etUh2zkR4Mr8gfWLs059S7Dm1T6Yby3Q@tpe1.clusters.zeabur.com:27883/zeabur'
});

const SHEET_ID = process.env.SHEET_ID || '1PunpaDAFBPBL_I76AiRYGXKaXDZvMl1c262SEtxRk6Q';

/**
 * 從 Google Sheets CSV export 下載資料
 */
function fetchSheetAsCSV(sheetId) {
  return new Promise((resolve, reject) => {
    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
    
    https.get(csvUrl, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

/**
 * 簡單 CSV 解析
 */
function parseCSV(csvText) {
  const lines = csvText.split('\n');
  const rows = [];
  
  for (let i = 1; i < lines.length; i++) { // 跳過標題行
    if (!lines[i].trim()) continue;
    
    // 簡單分割（假設沒有複雜的引號）
    const fields = lines[i].split(',');
    rows.push(fields);
  }
  
  return rows;
}

async function importCandidates() {
  const client = await pool.connect();

  try {
    console.log('🔄 從 Google Sheets 讀取候選人資料...\n');

    // 下載 CSV
    const csvText = await fetchSheetAsCSV(SHEET_ID);
    const rows = parseCSV(csvText);
    console.log(`✅ 讀取 ${rows.length} 筆候選人資料\n`);

    // 開始交易
    await client.query('BEGIN');

    let importedCount = 0;
    let skippedCount = 0;

    // 逐筆插入
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      
      // 驗證必要欄位
      if (!row[0]) {
        skippedCount++;
        continue;
      }

      try {
        const candidateId = `candidate_${i + 2}`; // A2 開始
        const name = row[0];
        const email = row[1];
        const phone = row[2];
        const location = row[3];
        const currentTitle = row[4];
        const yearsExperience = row[5];
        const jobChanges = row[6];
        const avgTenure = row[7];
        const recentGap = row[8];
        const skills = row[9];
        const education = row[10];
        const source = row[11] || '手動匯入';
        const workHistory = row[12];
        const resignReason = row[13];
        const stabilityScore = row[14];
        const educationJson = row[15];
        const disc = row[16];
        const status = row[17] || '待聯繫';
        const consultant = row[18];
        const remarks = row[19];

        const query = `
          INSERT INTO candidates_pipeline (
            id, candidate_id, name, status, consultant, notes, last_updated, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT (candidate_id) DO NOTHING
        `;

        const notes = `
Email: ${email}
Phone: ${phone}
Location: ${location}
Title: ${currentTitle}
Experience: ${yearsExperience} years
Skills: ${skills}
Remarks: ${remarks}
        `.trim();

        await client.query(query, [
          candidateId,
          candidateId,
          name,
          status,
          consultant || 'System',
          notes
        ]);

        importedCount++;

        // 進度顯示
        if (importedCount % 50 === 0) {
          console.log(`  ⏳ 已匯入 ${importedCount} 筆...`);
        }
      } catch (err) {
        console.error(`  ⚠️ 匯入失敗 (Row ${i + 2}):`, err.message);
        skippedCount++;
      }
    }

    // 提交交易
    await client.query('COMMIT');

    console.log(`\n✅ 匯入完成！`);
    console.log(`   ✓ 成功: ${importedCount} 筆`);
    console.log(`   ⊗ 跳過: ${skippedCount} 筆`);

    // 驗證
    const result = await client.query(
      'SELECT COUNT(*) as total FROM candidates_pipeline'
    );
    console.log(`\n📊 目前 SQL 中有 ${result.rows[0].total} 筆候選人`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ 匯入失敗:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// 執行
importCandidates();
