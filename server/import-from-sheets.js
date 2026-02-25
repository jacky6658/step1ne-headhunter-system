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
 * 
 * gid 參數用來指定特定工作表
 */
function fetchSheetAsCSV(sheetId, gid = 142613837) {
  return new Promise((resolve, reject) => {
    // 下載特定工作表（通過 gid 參數）
    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
    
    console.log(`📥 下載 CSV: ${csvUrl.split('?')[0]}...`);
    
    https.get(csvUrl, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`✅ 下載完成，大小: ${(data.length / 1024).toFixed(2)} KB\n`);
        resolve(data);
      });
    }).on('error', reject);
  });
}

/**
 * CSV 解析（支援引號欄位）
 */
function parseCSV(csvText) {
  const rows = [];
  let currentRow = [];
  let currentField = '';
  let insideQuotes = false;
  let lineNumber = 0;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        // 處理 "" （轉義引號）
        currentField += '"';
        i++; // 跳過下一個引號
      } else {
        // 切換引號狀態
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      // 欄位分隔符
      currentRow.push(currentField.trim());
      currentField = '';
    } else if ((char === '\n' || char === '\r') && !insideQuotes) {
      // 行尾
      if (currentField || currentRow.length > 0) {
        currentRow.push(currentField.trim());
        
        // 跳過標題行（第 0 行）
        if (lineNumber > 0 && currentRow[0]) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
        lineNumber++;
      }
      
      // 跳過 \r\n
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
    } else if (char !== '\r') {
      currentField += char;
    }
  }

  // 最後一個欄位
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (lineNumber > 0) {
      rows.push(currentRow);
    }
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

    // 清空舊資料（可選）
    // await client.query('DELETE FROM candidates_pipeline WHERE source = \'Google Sheets\'');

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
        const name = row[0];
        if (!name) {
          skippedCount++;
          continue;
        }

        // 使用 LinkedIn ID 或名字作為候選人 ID
        const email = row[1];
        const candidateId = email ? email.split('@')[0] : `candidate_${name.replace(/\s+/g, '_')}_${i}`;
        
        const phone = row[2];
        const location = row[3];
        const currentTitle = row[4];
        const yearsExperience = row[5];
        const jobChanges = row[6];
        const avgTenure = row[7];
        const recentGap = row[8];
        const skills = row[9];
        const education = row[10];
        const source = row[11] || 'Google Sheets';
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
          ON CONFLICT (candidate_id) DO UPDATE SET
            name = EXCLUDED.name,
            status = EXCLUDED.status,
            consultant = EXCLUDED.consultant,
            notes = EXCLUDED.notes,
            last_updated = CURRENT_TIMESTAMP
        `;

        const notesArray = [
          email && `Email: ${email}`,
          phone && `Phone: ${phone}`,
          location && `Location: ${location}`,
          currentTitle && `Title: ${currentTitle}`,
          yearsExperience && `Experience: ${yearsExperience} years`,
          skills && `Skills: ${skills}`,
          remarks && `Remarks: ${remarks}`
        ].filter(Boolean);
        
        const notes = notesArray.join('\n');

        await client.query(query, [
          `${candidateId}_${Date.now()}`,
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
