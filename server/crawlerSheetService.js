/**
 * crawlerSheetService.js - 從爬蟲 Google Sheet 直接讀取候選人資料
 *
 * 當 Flask 爬蟲服務離線時（雲端部署），作為 fallback
 * 直接從 Google Sheet (爬蟲履歷池) 讀取資料，提供與 Flask API 相同的格式。
 *
 * Google Sheet 結構：
 * - 每個客戶一個分頁（tab）
 * - 候選人欄位：id, name, source, github_url, linkedin_url, email,
 *   location, bio, company, title, skills, public_repos, followers,
 *   job_title, search_date, task_id, status, created_at, score, grade, score_detail
 * - 「去重」分頁：存放已處理的候選人 URL（用於去重）
 */

const https = require('https');
const http = require('http');

// 爬蟲履歷池 Google Sheet ID
const CRAWLER_SHEET_ID = process.env.CRAWLER_SHEET_ID || '15X2NNK9bSmSl-GfCmfO2q8lS2wAinR9fNMZr4vqrMug';

// 快取（5 分鐘）
let _cache = { data: null, clients: null, timestamp: 0 };
const CACHE_TTL = 5 * 60 * 1000; // 5 分鐘

/**
 * 從 Google Sheet 讀取 CSV 資料（支援重定向）
 */
function fetchURL(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    protocol.get(url, { headers: { 'Accept': 'text/csv' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) {
        const redirectUrl = res.headers.location;
        if (!redirectUrl) return reject(new Error('Redirect without location'));
        fetchURL(redirectUrl).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

/**
 * 解析 CSV 文字為物件陣列
 */
function parseCSV(csvText) {
  const lines = csvText.split('\n');
  if (lines.length < 2) return [];

  // 解析標題列
  const headers = parseCSVLine(lines[0]);

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const fields = parseCSVLine(line);
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h.trim()] = (fields[idx] || '').trim();
    });
    rows.push(obj);
  }
  return rows;
}

/**
 * 解析單行 CSV（處理引號內的逗號和換行）
 */
function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

/**
 * 取得所有客戶名稱（從「去重」分頁）
 */
async function getClientNames() {
  try {
    const url = `https://docs.google.com/spreadsheets/d/${CRAWLER_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent('去重')}&tq=${encodeURIComponent('SELECT D, COUNT(C) GROUP BY D')}`;
    const csv = await fetchURL(url);
    const rows = parseCSV(csv);
    return rows
      .map(r => r['client_name'] || r[Object.keys(r)[0]])
      .filter(name => name && name !== 'client_name');
  } catch (err) {
    console.warn('⚠️ Failed to get client names from sheet:', err.message);
    return [];
  }
}

/**
 * 從指定客戶分頁讀取候選人
 */
async function getCandidatesFromTab(clientName) {
  try {
    const url = `https://docs.google.com/spreadsheets/d/${CRAWLER_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(clientName)}&tq=${encodeURIComponent('SELECT * LIMIT 500')}`;
    const csv = await fetchURL(url);
    const rows = parseCSV(csv);

    return rows.map((r, idx) => ({
      id: r.id || `${clientName}-${idx}`,
      name: r.name || '',
      source: r.source || 'github',
      github_url: r.github_url || '',
      linkedin_url: r.linkedin_url || '',
      email: r.email || '',
      location: r.location || '',
      bio: r.bio || '',
      company: r.company || '',
      title: r.title || '',
      skills: r.skills || '',
      public_repos: parseInt(r.public_repos) || 0,
      followers: parseInt(r.followers) || 0,
      job_title: r.job_title || clientName,
      search_date: r.search_date || '',
      task_id: r.task_id || '',
      status: r.status || 'new',
      created_at: r.created_at || '',
      score: parseInt(r.score) || 0,
      grade: r.grade || '',
      score_detail: r.score_detail || '',
      client_name: clientName,
    }));
  } catch (err) {
    console.warn(`⚠️ Failed to read tab "${clientName}":`, err.message);
    return [];
  }
}

/**
 * 讀取所有候選人（所有客戶分頁）
 * 有 5 分鐘快取
 */
async function getAllCandidates() {
  const now = Date.now();
  if (_cache.data && (now - _cache.timestamp) < CACHE_TTL) {
    return { candidates: _cache.data, clients: _cache.clients };
  }

  console.log('📊 Fetching crawler data from Google Sheet...');
  const clients = await getClientNames();
  if (clients.length === 0) {
    return { candidates: [], clients: [] };
  }

  // 並行讀取所有客戶分頁
  const results = await Promise.allSettled(
    clients.map(name => getCandidatesFromTab(name))
  );

  const allCandidates = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      allCandidates.push(...result.value);
    }
  }

  // 更新快取
  _cache = { data: allCandidates, clients, timestamp: now };
  console.log(`✅ Loaded ${allCandidates.length} candidates from ${clients.length} clients`);

  return { candidates: allCandidates, clients };
}

/**
 * 提供與 Flask /api/candidates 相同格式的回應
 */
async function getCandidatesResponse(query = {}) {
  const { candidates, clients } = await getAllCandidates();

  let filtered = [...candidates];

  // 篩選等級
  if (query.grade && query.grade !== 'all') {
    filtered = filtered.filter(c => c.grade === query.grade);
  }

  // 篩選客戶
  if (query.client && query.client !== '全部客戶') {
    filtered = filtered.filter(c => c.client_name === query.client);
  }

  // 搜尋
  if (query.search) {
    const s = query.search.toLowerCase();
    filtered = filtered.filter(c =>
      (c.name || '').toLowerCase().includes(s) ||
      (c.skills || '').toLowerCase().includes(s) ||
      (c.title || '').toLowerCase().includes(s)
    );
  }

  // 分頁
  const page = parseInt(query.page) || 1;
  const limit = parseInt(query.limit) || 50;
  const start = (page - 1) * limit;
  const paged = filtered.slice(start, start + limit);

  return {
    data: paged,
    total: filtered.length,
    page,
    limit,
    source: 'google_sheets',
  };
}

/**
 * 提供與 Flask /api/dashboard/stats 相同格式的回應
 */
async function getStatsResponse() {
  const { candidates, clients } = await getAllCandidates();

  // 計算等級分布
  const grades = { A: 0, B: 0, C: 0, D: 0 };
  const sources = { linkedin: 0, github: 0 };
  let todayNew = 0;
  const today = new Date().toISOString().split('T')[0];

  for (const c of candidates) {
    const g = (c.grade || '').toUpperCase();
    if (grades[g] !== undefined) grades[g]++;

    const src = (c.source || '').toLowerCase();
    if (src.includes('linkedin')) sources.linkedin++;
    else if (src.includes('github')) sources.github++;

    if (c.created_at && c.created_at.startsWith(today)) todayNew++;
  }

  // 客戶分布
  const clientStats = {};
  for (const c of candidates) {
    const cn = c.client_name || '未分類';
    clientStats[cn] = (clientStats[cn] || 0) + 1;
  }

  return {
    total_candidates: candidates.length,
    today_new: todayNew,
    running_tasks: 0,
    scheduled_tasks: 0,
    clients: clientStats,
    sources,
    grades,
    recent_runs: [],
    source: 'google_sheets',
  };
}

/**
 * 提供與 Flask /api/clients 相同格式的回應
 */
async function getClientsResponse() {
  const { clients } = await getAllCandidates();
  return clients;
}

/**
 * 提供與 Flask /api/health 相同格式的回應
 * (Google Sheet fallback 模式)
 */
function getHealthResponse() {
  return {
    status: 'ok',
    mode: 'google_sheets_fallback',
    timestamp: new Date().toISOString(),
  };
}

/**
 * 清除快取（手動刷新時使用）
 */
function clearCache() {
  _cache = { data: null, clients: null, timestamp: 0 };
}

module.exports = {
  getAllCandidates,
  getCandidatesResponse,
  getStatsResponse,
  getClientsResponse,
  getHealthResponse,
  clearCache,
};
