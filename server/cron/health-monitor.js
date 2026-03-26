#!/usr/bin/env node
// 🖥️ 基礎設施健康監控 + 自動修復 — 每 10 分鐘執行
// PM2: pm2 start server/cron/health-monitor.js --name health-monitor --cron-restart "*/10 * * * *" --no-autorestart

const http = require('http');
const https = require('https');
const { execSync } = require('child_process');

// ── Config ──
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const TG_TOKEN = process.env.TG_BOT_TOKEN || '8375770979:AAFuC3emSd05sjRxSyxpP6kTmd7LyKpA2cg';
const TG_CHAT = process.env.TG_CHAT_ID || '-1003231629634';
const TG_TOPIC = parseInt(process.env.TG_TOPIC_ID) || 1360;
const API_KEY = process.env.API_SECRET_KEY || '';

// 自動修復閾值
const DB_CONN_DANGER = 15;
const API_TIMEOUT_MS = 8000;

// ── Helpers ──

function run(cmd, timeout = 10000) {
  try {
    return execSync(cmd, { timeout, encoding: 'utf-8' }).trim();
  } catch (e) {
    return `ERROR: ${e.message}`;
  }
}

function httpCheck(url, headers = {}, timeout = 10000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { headers, timeout }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ code: res.statusCode, time: (Date.now() - start) / 1000, body }));
    });
    req.on('error', (e) => resolve({ code: 0, time: 0, body: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ code: 0, time: timeout / 1000, body: 'timeout' }); });
  });
}

function sendTelegram(text) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      chat_id: TG_CHAT,
      message_thread_id: TG_TOPIC,
      parse_mode: 'HTML',
      text,
    });
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${TG_TOKEN}/sendMessage`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      timeout: 10000,
    }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch { resolve({ ok: false }); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function nowTW() {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Taipei' }).replace('T', ' ').slice(0, 16);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Auto-Fix ──

function fixDbConnections() {
  const actions = [];
  try {
    const killed = run(`psql -d step1ne -t -c "SELECT count(*) FROM (SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE pid != pg_backend_pid() AND state = 'active' AND query_start < NOW() - INTERVAL '30 seconds') t;"`).trim();
    actions.push(`清理卡住 query: ${killed} 個`);
  } catch (e) {
    actions.push(`清理 query 失敗`);
  }
  return actions;
}

function fixService(name) {
  try { run(`pm2 restart ${name}`, 15000); return [`重啟 ${name}`]; }
  catch { return [`重啟 ${name} 失敗`]; }
}

function stopService(name) {
  try { run(`pm2 stop ${name}`); return [`停止 ${name}`]; }
  catch { return [`停止 ${name} 失敗`]; }
}

// ── Main ──

async function main() {
  const issues = [];
  const warnings = [];
  const okItems = [];
  const fixes = [];
  const authHeaders = { Authorization: `Bearer ${API_KEY}` };

  // ── 1. PostgreSQL ──
  const dbReady = run('pg_isready');
  const dbActive = run(`psql -d step1ne -t -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';"`).trim();
  const dbActiveN = parseInt(dbActive) || -1;

  if (!dbReady.includes('accepting')) {
    issues.push('DB: 🔴 無回應');
    run('brew services restart postgresql@16', 15000);
    fixes.push('🔧 重啟 PostgreSQL');
  } else if (dbActiveN > DB_CONN_DANGER) {
    issues.push(`DB: 🔴 ${dbActiveN} active connections`);
    fixes.push(...fixDbConnections().map(a => `🔧 ${a}`));
    await sleep(2000);
    const after = run(`psql -d step1ne -t -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';"`).trim();
    fixes.push(`🔧 清理後: ${after} connections`);
  } else {
    okItems.push(`DB: ✅ (${dbActiveN} conn)`);
  }

  // ── 2. PM2 服務 ──
  const criticals = ['hr-backend', 'hr-frontend', 'agile-backend', 'agile-frontend', 'cloudflared'];
  const mustStop = ['lobster-dashboard'];

  try {
    const pm2List = JSON.parse(run('pm2 jlist'));
    for (const svc of pm2List) {
      const name = svc.name;
      const status = svc.pm2_env?.status;
      const restarts = svc.pm2_env?.restart_time || 0;

      if (mustStop.includes(name) && status === 'online') {
        issues.push(`${name}: 🔴 不應啟動`);
        fixes.push(...stopService(name).map(a => `🔧 ${a}`));
        continue;
      }

      if (criticals.includes(name) && status !== 'online') {
        issues.push(`${name}: 🔴 ${status}`);
        fixes.push(...fixService(name).map(a => `🔧 ${a}`));
      }
    }
  } catch {
    issues.push('PM2: 無法讀取');
  }

  if (fixes.length > 0) await sleep(5000);

  // ── 3. 本地 API ──
  const locals = [
    { name: 'HR Backend', url: 'http://localhost:3003/api/health', headers: authHeaders, pm2: 'hr-backend' },
    { name: 'HR Frontend', url: 'http://localhost:3002/', headers: {}, pm2: 'hr-frontend' },
    { name: 'Agile Backend', url: 'http://localhost:3001/api/health', headers: {}, pm2: 'agile-backend' },
    { name: 'Agile Frontend', url: 'http://localhost:3000/', headers: {}, pm2: 'agile-frontend' },
  ];

  for (const svc of locals) {
    const r = await httpCheck(svc.url, svc.headers, API_TIMEOUT_MS);
    if (r.code === 200) {
      // DB 斷線檢查
      if (r.body.includes('"database"')) {
        try {
          if (JSON.parse(r.body).database !== 'connected') {
            issues.push(`${svc.name}: 🔴 DB 斷線`);
            fixes.push(...fixService(svc.pm2).map(a => `🔧 ${a}（DB 斷線）`));
            continue;
          }
        } catch {}
      }
      if (r.time > 5) warnings.push(`${svc.name}: ⚠️ ${r.time.toFixed(1)}s`);
      else okItems.push(`${svc.name}: ✅ ${r.time.toFixed(1)}s`);
    } else {
      issues.push(`${svc.name}: 🔴 ${r.body === 'timeout' ? 'timeout' : 'HTTP ' + r.code}`);
      fixes.push(...fixService(svc.pm2).map(a => `🔧 ${a}`));
    }
  }

  // ── 4. 外網 Tunnel ──
  const externals = [
    { name: 'hrsystem', url: 'https://hrsystem.step1ne.com/', headers: {} },
    { name: 'api-hr', url: 'https://api-hr.step1ne.com/api/health', headers: authHeaders },
    { name: 'agile', url: 'https://agile.step1ne.com/', headers: {} },
  ];

  let extOk = 0, extDown = 0;
  for (const svc of externals) {
    const r = await httpCheck(svc.url, svc.headers, 15000);
    if (r.code === 200) {
      extOk++;
      if (r.time > 8) warnings.push(`外網 ${svc.name}: ⚠️ ${r.time.toFixed(1)}s`);
    } else {
      extDown++;
      issues.push(`外網 ${svc.name}: 🔴 ${r.code || 'timeout'}`);
    }
  }
  // 外網多數不通 → 重啟 tunnel
  if (extDown >= 2) {
    fixes.push(...fixService('cloudflared').map(a => `🔧 ${a}（外網 ${extDown}/3 不通）`));
  }
  okItems.push(`Tunnel: ${extOk >= 2 ? '✅' : '⚠️'} ${extOk}/3`);

  // ── 5. CPU / RAM / 磁碟 ──
  try {
    // CPU load
    const loadAvg = run("sysctl -n vm.loadavg").match(/[\d.]+/g);
    const cpuCores = parseInt(run("sysctl -n hw.ncpu")) || 4;
    const load1m = parseFloat(loadAvg?.[0]) || 0;
    const cpuPct = Math.round((load1m / cpuCores) * 100);
    if (cpuPct > 90) issues.push(`CPU: 🔴 ${cpuPct}% (load ${load1m})`);
    else if (cpuPct > 70) warnings.push(`CPU: ⚠️ ${cpuPct}% (load ${load1m})`);
    else okItems.push(`CPU: ✅ ${cpuPct}%`);

    // RAM
    const totalMem = parseInt(run("sysctl -n hw.memsize")) || 0;
    const pageSize = parseInt(run("sysctl -n hw.pagesize")) || 4096;
    const freePages = parseInt(run("vm_stat | head -2 | tail -1").match(/\d+/)?.[0]) || 0;
    const freeMem = freePages * pageSize;
    const memPct = totalMem > 0 ? Math.round(((totalMem - freeMem) / totalMem) * 100) : 0;
    if (memPct > 90) issues.push(`RAM: 🔴 ${memPct}%`);
    else if (memPct > 80) warnings.push(`RAM: ⚠️ ${memPct}%`);
    else okItems.push(`RAM: ✅ ${memPct}%`);

    // Disk
    const diskPct = parseInt(run("df -h / | tail -1 | awk '{print $5}'").replace('%', '')) || 0;
    if (diskPct > 90) issues.push(`磁碟: 🔴 ${diskPct}%`);
    else if (diskPct > 80) warnings.push(`磁碟: ⚠️ ${diskPct}%`);
    else okItems.push(`磁碟: ✅ ${diskPct}%`);
  } catch {}

  // ── 6. 修復後驗證 ──
  if (fixes.length > 0) {
    await sleep(5000);
    const recheck = await httpCheck('http://localhost:3003/api/health', authHeaders, 10000);
    if (recheck.code === 200 && recheck.body.includes('"connected"')) {
      fixes.push('✅ 修復驗證通過');
    } else {
      fixes.push('❌ 修復後仍異常，需人工處理');
    }
    run('pm2 save');
  }

  // ── 7. 推播 ──
  const time = nowTW();
  const parts = [`🖥️ <b>系統監控</b> ${time}`];

  if (issues.length === 0 && warnings.length === 0 && fixes.length === 0) {
    parts.push('✅ 全部正常');
    okItems.forEach(i => parts.push(`• ${i}`));
  } else {
    if (fixes.length > 0) {
      parts.push('', '🔧 <b>自動修復</b>');
      fixes.forEach(f => parts.push(`• ${f}`));
    }
    if (issues.length > 0) {
      parts.push('', '🔴 <b>異常</b>');
      issues.forEach(i => parts.push(`• ${i}`));
    }
    if (warnings.length > 0) {
      parts.push('', '⚠️ <b>警告</b>');
      warnings.forEach(w => parts.push(`• ${w}`));
    }
    parts.push('', '✅ <b>正常</b>');
    okItems.forEach(i => parts.push(`• ${i}`));
  }

  try {
    const result = await sendTelegram(parts.join('\n'));
    console.log(`[${time}] ok=${result.ok} | issues=${issues.length} | fixes=${fixes.length}`);
  } catch (e) {
    console.error(`[${time}] TG failed:`, e.message);
  }

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
