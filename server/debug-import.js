const { execSync } = require('child_process');

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

try {
  const cmd = `gog sheets get "1PunpaDAFBPBL_I76AiRYGXKaXDZvMl1c262SEtxRk6Q" "A1:L500" --account aiagentg888@gmail.com --json`;
  const output = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  const data = JSON.parse(output);
  
  const rows = rowsToObjects(data.values);
  
  console.log(`✅ 解析結果：\n`);
  console.log(`   總筆數：${data.values.length}`);
  console.log(`   有姓名的：${rows.length}\n`);
  
  console.log(`前 5 筆：`);
  rows.slice(0, 5).forEach((row, i) => {
    console.log(`[${i+1}] ${row['姓名']} | 職位: ${row['應徵職位']} | 技能: ${row['主要技能'].substring(0, 40)}...`);
  });
  
} catch (error) {
  console.error(`❌ 失敗：${error.message}`);
}
