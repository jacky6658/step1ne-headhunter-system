#!/usr/bin/env node
// 🦞 龍蝦巡邏推播 — 掃描人選資料庫 → 推播 Telegram
// --full  完整早報（每日 10:00）
// --quick 快速巡邏（每 2 小時）

const https = require('https');
const http = require('http');

// ── Config ──
const API_BASE = 'http://localhost:3003';
const API_KEY = 'PotfZ42-qPyY4uqSwqstpxllQB1alxVfjJsm3Mgp3HQ';
const TG_TOKEN = '8375770979:AAFuC3emSd05sjRxSyxpP6kTmd7LyKpA2cg';
const TG_CHAT = '-1003231629634';
const TG_TOPIC = 1247;

const MODE = process.argv.includes('--full') ? 'full' : 'quick';

// ── Helpers ──

function apiGet(path) {
  return new Promise((resolve, reject) => {
    const req = http.get(`${API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
      timeout: 60000,
    }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (e) { reject(new Error(`JSON parse error: ${body.slice(0, 100)}`)); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// 分頁拉全部（每頁 500，用 paginated API 避免 summary 超時）
async function fetchAllCandidates() {
  const PAGE = 500;
  const first = await apiGet(`/api/candidates?limit=${PAGE}&offset=0&include_counts=true`);
  const all = first.data || [];
  const total = first.total || all.length;
  const statusCounts = first.statusCounts || {};
  const sourceCounts = first.sourceCounts || {};

  if (all.length < total) {
    const pages = [];
    for (let off = PAGE; off < total; off += PAGE) {
      pages.push(apiGet(`/api/candidates?limit=${PAGE}&offset=${off}`));
    }
    const results = await Promise.all(pages);
    for (const r of results) all.push(...(r.data || []));
  }
  return { data: all, total, statusCounts, sourceCounts };
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

function todayTW() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });
}

function nowTW() {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Taipei' }).slice(0, 16);
}

function daysSince(dateStr) {
  if (!dateStr) return 999;
  try {
    const d = new Date(dateStr.endsWith('Z') ? dateStr : dateStr + 'Z');
    return Math.floor((Date.now() - d.getTime()) / 86400000);
  } catch { return 999; }
}

// ── Quick Patrol ──

async function quickPatrol() {
  const summary = await fetchAllCandidates();
  const candidates = summary.data || [];
  const today = todayTW();
  const time = nowTW();

  // 待認領（有核心資料但沒顧問）
  const unclaimed = candidates.filter(c =>
    (!c.consultant || c.consultant === '待指派') &&
    c.targetJobId && c.talentLevel && c.skills && c.position
  );

  // 顧問超時（聯繫階段 > 3 天未更新）
  const stale = candidates
    .filter(c => c.status === '聯繫階段' && daysSince(c.updatedAt) >= 3)
    .map(c => ({ ...c, days: daysSince(c.updatedAt) }))
    .sort((a, b) => b.days - a.days);

  // 今日新增
  const todayNew = candidates.filter(c => {
    if (!c.createdAt) return false;
    const d = new Date(c.createdAt.endsWith('Z') ? c.createdAt : c.createdAt + 'Z');
    return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' }) === today;
  });

  const lines = [`🦞 <b>巡邏快報</b> ${time}`];
  let hasContent = false;

  if (todayNew.length > 0) {
    lines.push(`\n🆕 今日新增 <b>${todayNew.length}</b> 位人選`);
    hasContent = true;
  }

  if (unclaimed.length > 0) {
    lines.push(`\n🙋 <b>待認領人選</b>（${unclaimed.length} 位）`);
    unclaimed.slice(0, 5).forEach(c => {
      lines.push(`• <b>${c.name}</b> #${c.id} → ${c.targetJobLabel || '未指定職缺'}`);
    });
    if (unclaimed.length > 5) lines.push(`  ...還有 ${unclaimed.length - 5} 位`);
    hasContent = true;
  }

  if (stale.length > 0) {
    lines.push(`\n⏰ <b>顧問追蹤提醒</b>（${stale.length} 位）`);
    stale.slice(0, 5).forEach(c => {
      lines.push(`• <b>${c.consultant || '?'}</b> — ${c.name} #${c.id} 已 ${c.days} 天未更新`);
    });
    if (stale.length > 5) lines.push(`  ...還有 ${stale.length - 5} 位`);
    hasContent = true;
  }

  if (!hasContent) {
    lines.push('\n✅ 目前一切正常，無需處理');
  }

  return lines.join('\n');
}

// ── Full Patrol (Daily Report) ──

async function fullPatrol() {
  const summary = await fetchAllCandidates();
  let jobs = [];
  try {
    const jobsData = await apiGet('/api/jobs');
    const list = jobsData.data || [];
    jobs = Array.isArray(list) ? list.filter(j => j.job_status !== '已關閉' && j.job_status !== '暫停') : [];
  } catch {}

  const candidates = summary.data || [];
  const total = summary.total || candidates.length;
  const today = todayTW();

  // 核心資料齊全（summary 層面）
  const coreComplete = candidates.filter(c =>
    c.position && c.skills && c.targetJobId && c.talentLevel
  );
  const incomplete = total - coreComplete.length;

  // 顧問超時
  const stale = candidates
    .filter(c => c.status === '聯繫階段' && daysSince(c.updatedAt) >= 3)
    .map(c => ({ ...c, days: daysSince(c.updatedAt) }))
    .sort((a, b) => b.days - a.days);

  // 待認領
  const unclaimed = coreComplete.filter(c => !c.consultant || c.consultant === '待指派');

  // 缺資料分類
  const missingCore = candidates.filter(c => c.position && (!c.targetJobId || !c.talentLevel));
  const missingMultiple = candidates.filter(c => !c.position && !c.targetJobId);

  // 抽樣檢查 full-profile（最多 20 位核心齊全的）確認 AI 分析 + 履歷
  let aiComplete = 0;
  let resumeComplete = 0;
  const sampleSize = Math.min(coreComplete.length, 20);
  const sample = coreComplete.slice(0, sampleSize);

  for (const c of sample) {
    try {
      const profile = await apiGet(`/api/ai-agent/candidates/${c.id}/full-profile`);
      const d = profile.data || profile;
      if (d.resumeFiles && d.resumeFiles.length > 0) resumeComplete++;
      if (d.aiAnalysis && d.aiAnalysis.candidate_evaluation && d.aiAnalysis.job_matchings?.length > 0) aiComplete++;
    } catch {}
  }

  const resumeRate = sampleSize > 0 ? Math.round(resumeComplete / sampleSize * 100) : 0;
  const aiRate = sampleSize > 0 ? Math.round(aiComplete / sampleSize * 100) : 0;

  // 組裝訊息
  const lines = [
    `🦞 <b>龍蝦巡邏早報</b> — ${today}`,
    '',
    '━━━━━━━━━━━━━━━━',
    '📊 <b>人才庫概況</b>',
    '━━━━━━━━━━━━━━━━',
    `• 總人選：${total} 位`,
    `• ✅ 核心資料齊全：${coreComplete.length} 位`,
    `• ⚠️ 資料缺失：${incomplete} 位`,
    `• 📋 進行中職缺：${jobs.length} 個`,
    `• 📎 履歷附件率：~${resumeRate}%（抽樣 ${sampleSize} 位）`,
    `• 🤖 AI 分析率：~${aiRate}%（抽樣 ${sampleSize} 位）`,
  ];

  // 待認領
  if (unclaimed.length > 0) {
    lines.push('', '━━━━━━━━━━━━━━━━');
    lines.push('🆕 <b>待認領人選</b>（未指派顧問 + 核心資料齊全）');
    lines.push('━━━━━━━━━━━━━━━━');
    unclaimed.slice(0, 10).forEach(c => {
      lines.push(`• <b>${c.name}</b> #${c.id} → ${c.targetJobLabel || '未指定'}`);
    });
    if (unclaimed.length > 10) lines.push(`  ...還有 ${unclaimed.length - 10} 位`);
  }

  // 顧問追蹤
  if (stale.length > 0) {
    lines.push('', '━━━━━━━━━━━━━━━━');
    lines.push('⏰ <b>顧問追蹤提醒</b>');
    lines.push('━━━━━━━━━━━━━━━━');
    stale.slice(0, 10).forEach(c => {
      lines.push(`• <b>${c.consultant || '?'}</b> — ${c.name} #${c.id} 已 ${c.days} 天未更新`);
    });
    if (stale.length > 10) lines.push(`  ...還有 ${stale.length - 10} 位`);
  }

  // 缺資料
  lines.push('', '━━━━━━━━━━━━━━━━');
  lines.push('🔧 <b>待補齊資料</b>');
  lines.push('━━━━━━━━━━━━━━━━');
  lines.push(`🟡 缺核心欄位（目標職缺/人才等級）：${missingCore.length} 位`);
  lines.push(`🟠 缺多項資料：${missingMultiple.length} 位`);
  lines.push('');
  lines.push('💡 以上缺資料人選請 Agent 優先處理');

  return lines.join('\n');
}

// ── Entry ──

async function main() {
  const time = nowTW();
  console.log(`[${time}] Lobster patrol starting (mode=${MODE})...`);

  try {
    const msg = MODE === 'full' ? await fullPatrol() : await quickPatrol();
    const result = await sendTelegram(msg);
    console.log(`[${time}] Sent: ok=${result.ok}`);
  } catch (e) {
    console.error(`[${time}] Error:`, e.message);
    // Send error notification
    try {
      await sendTelegram(`🚨 <b>龍蝦巡邏異常</b>\n${e.message}\n請工程師檢查`);
    } catch {}
  }

  process.exit(0);
}

main();
