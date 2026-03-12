/**
 * server.js - Step1ne 後端主服務器
 * 方案 A + B 完整實現
 * 
 * 啟動方式：
 * node server.js
 * 
 * 環境變數：
 * DATABASE_URL=postgresql://user:pass@host:port/db
 * SHEET_ID=xxx
 * PORT=3001
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const { execSync } = require('child_process');

// ── Python 依賴自動安裝（Zeabur 容器啟動時）────────────────────
(function ensurePythonDeps() {
  try {
    execSync('python3 -c "import requests; import bs4"', { stdio: 'ignore' });
    console.log('✅ Python 依賴已就緒');
  } catch {
    console.log('⏳ 安裝 Python 依賴（requests, beautifulsoup4, lxml）...');
    const cmds = [
      'python3 -m pip install requests beautifulsoup4 lxml --break-system-packages -q',
      'python3 -m pip install requests beautifulsoup4 lxml --user -q',
      'python3 -m pip install requests beautifulsoup4 lxml -q',
      'pip3 install requests beautifulsoup4 lxml --break-system-packages -q',
      'pip install requests beautifulsoup4 lxml -q',
    ];
    for (const cmd of cmds) {
      try {
        execSync(cmd, { stdio: 'inherit', timeout: 120000 });
        console.log('✅ Python 依賴安裝成功');
        return;
      } catch { /* 嘗試下一個 */ }
    }
    console.warn('⚠️ Python 依賴安裝失敗，LinkedIn 搜尋功能可能無法使用');
  }
})();

// 環境變數相容：支援 DATABASE_URL 或 POSTGRES_URI（Zeabur 自動生成）
if (!process.env.DATABASE_URL && process.env.POSTGRES_URI) {
  process.env.DATABASE_URL = process.env.POSTGRES_URI;
}

const apiRouter = require('./routes-api');

// PostgreSQL 連線池（調高連線數 + 超時設定，避免 503）
const pool = new Pool({
  connectionString: process.env.DATABASE_URL ||
    'postgresql://root:etUh2zkR4Mr8gfWLs059S7Dm1T6Yby3Q@tpe1.clusters.zeabur.com:27883/zeabur',
  max: 30,                        // 最大連線數（預設 10 太少）
  min: 5,                         // 最小閒置連線
  idleTimeoutMillis: 30000,       // 閒置 30 秒後釋放
  connectionTimeoutMillis: 10000, // 等超過 10 秒就報錯（而非無限等待）
  allowExitOnIdle: true,
});

const app = express();
const PORT = process.env.PORT || 3001;

// ==================== 中間件 ====================

// CORS 設定：允許特定的 origins
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:5173',
  'https://step1ne.zeabur.app',
  'https://step1ne.com'
];

app.use(cors({
  origin: function(origin, callback) {
    // 允許沒有 origin 的請求（如 curl, mobile apps）
    // 允許所有 localhost 開發 port
    if (!origin || allowedOrigins.includes(origin) || /^http:\/\/localhost:\d+$/.test(origin) || /^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS 拒絕: ${origin}`);
      callback(new Error('CORS 不允許此 origin'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-OpenClaw-Key']
}));

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

// Multer：PDF 上傳（memory storage，Zeabur 雲端友善）
const multer = require('multer');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('僅接受 PDF 檔案'), false);
  },
});
app.locals.upload = upload; // 掛載到 app.locals 讓 router 取用

// 請求日誌中間件
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// ==================== 路由 ====================

// 完整的 API 路由（候選人 + 職缺）
app.use('/api', apiRouter);

// 爬蟲整合 API 路由（proxy + 效益指標）
const crawlerRouter = require('./routes-crawler');
app.use('/api/crawler', crawlerRouter);

// OpenClaw 批量 API 路由（本地 AI 工具讀寫候選人）
const openclawRouter = require('./routes-openclaw');
app.use('/api/openclaw', openclawRouter);

// 根路由
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Step1ne Backend - API v1',
    endpoints: {
      candidates: '/api/candidates',
      health: '/api/health',
      sync: '/api/sync/pending'
    }
  });
});

// ==================== 錯誤處理 ====================

app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err.message);
  res.status(500).json({
    success: false,
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// ==================== 啟動服務器 ====================

async function startServer() {
  let dbConnected = false;

  // 1. 測試 PostgreSQL 連線（失敗不中止，降級模式繼續啟動）
  try {
    console.log('🔍 Testing PostgreSQL connection...');
    const client = await Promise.race([
      pool.connect(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout (10s)')), 10000))
    ]);
    const result = await client.query('SELECT NOW()');
    client.release();
    dbConnected = true;
    console.log(`✅ PostgreSQL connected at ${result.rows[0].now}`);
  } catch (error) {
    console.warn(`⚠️ PostgreSQL unavailable: ${error.message}`);
    console.warn('⚠️ Starting in DEGRADED MODE (DB-dependent endpoints will return 503)');
  }

  // 2. 啟動 Express 服務器（不論 DB 是否正常）
  const server = app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════╗
║  🚀 Step1ne Backend Started            ║
║  📍 http://localhost:${PORT}              ║
║  🗄️  PostgreSQL: ${dbConnected ? 'Connected  ' : 'UNAVAILABLE'}        ║
║  📊 Mode: ${dbConnected ? 'SQL + Google Sheets' : 'DEGRADED (no DB)  '}   ║
╚═══════════════════════════════════════╝
    `);
  });

  // 3. 優雅關閉
  process.on('SIGTERM', async () => {
    console.log('🛑 SIGTERM received, shutting down...');
    server.close(() => {
      console.log('✅ Server closed');
      process.exit(0);
    });
  });
}

startServer();

module.exports = app;
// Force rebuild Wed Feb 25 23:05:00 CST 2026
