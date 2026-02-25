const { execSync } = require('child_process');

console.log('🔍 測試 gog CLI 讀取...\n');

try {
  const cmd = `gog sheets get "1PunpaDAFBPBL_I76AiRYGXKaXDZvMl1c262SEtxRk6Q" "A1:L500" --account aiagentg888@gmail.com --json`;
  console.log(`執行命令：\n${cmd}\n`);
  
  const output = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  const data = JSON.parse(output);
  
  console.log(`✅ 成功讀取！\n`);
  console.log(`   Sheet 1 - 表頭：${data.values[0].join(' | ')}\n`);
  console.log(`   前 3 筆資料：`);
  
  for (let i = 1; i <= 3; i++) {
    const row = data.values[i];
    console.log(`   [${i}] ${row[0]} | ${row[2]} | ${row[3]}`);
  }
} catch (error) {
  console.error(`❌ 失敗：${error.message}`);
}
