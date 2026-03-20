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
const http = require('http');
const cors = require('cors');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Server: SocketIOServer } = require('socket.io');

// 環境變數相容：支援 DATABASE_URL 或 POSTGRES_URI
if (!process.env.DATABASE_URL && process.env.POSTGRES_URI) {
  process.env.DATABASE_URL = process.env.POSTGRES_URI;
}

const apiRouter = require('./routes-api');
const { pool } = require('./db'); // 共享連線池

const app = express();
const httpServer = http.createServer(app);
const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';

// ==================== Socket.IO 即時推播 ====================
const io = new SocketIOServer(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  path: '/socket.io',
  transports: ['websocket', 'polling'],
});

io.on('connection', (socket) => {
  console.log(`🔌 Socket 連線: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`🔌 Socket 斷線: ${socket.id}`);
  });
});

// 掛到 app.locals 讓 routes 可以取用
app.locals.io = io;

// Cloudflare Tunnel / Reverse Proxy：信任 proxy 的 X-Forwarded-For header
// 讓 rate-limit 能正確辨識真實用戶 IP
app.set('trust proxy', 1);

// ==================== 安全中間件 ====================

// Security headers（CSP 由前端 SPA 自行處理）
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// Rate limiting：每分鐘 200 次（防止惡意爆量，正常使用不受影響）
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: '請求過於頻繁，請稍後再試（每分鐘上限 200 次）' },
});
app.use('/api', limiter);

// ==================== CORS ====================

const allowedOrigins = [
  'https://step1ne.com',
  'https://hrsystem.step1ne.com',
  'https://api-hr.step1ne.com',
  // 允許本地開發代理（Vite proxy changeOrigin 仍會帶 localhost Origin）
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:3003',
  'http://localhost:5173',
];

app.use(cors({
  origin: function(origin, callback) {
    // 允許沒有 origin 的請求（如 curl, server-to-server, OpenClaw）
    // 允許空字串 origin（Vite proxy headers.Origin = '' 的情況）
    if (!origin || origin === '' || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else if (/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) {
      // 內部工具，允許任何 localhost port
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

// ==================== Body Parser ====================

// 保留 rawBody 供 GitHub Webhook HMAC 簽名驗證使用
// 跳過 multipart 請求的 body parsing（讓 multer 處理）
app.use((req, res, next) => {
  const ct = req.headers['content-type'] || '';
  if (ct.startsWith('multipart/')) return next();
  bodyParser.json({ limit: '10mb', verify: (req, _res, buf) => { req.rawBody = buf; } })(req, res, next);
});
app.use((req, res, next) => {
  const ct = req.headers['content-type'] || '';
  if (ct.startsWith('multipart/')) return next();
  bodyParser.urlencoded({ limit: '10mb', extended: true })(req, res, next);
});

// Multer：PDF 上傳（memory storage）
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

// 文件上傳（PDF/DOC/DOCX/XLS/XLSX/PNG/JPG）
const ALLOWED_DOC_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png', 'image/jpeg',
];
const uploadDoc = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_DOC_TYPES.includes(file.mimetype)) cb(null, true);
    else cb(new Error('不支援的檔案格式'), false);
  },
});
app.locals.uploadDoc = uploadDoc;

// 請求日誌中間件
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// ==================== API 認證中間件 ====================

const API_SECRET_KEY = process.env.API_SECRET_KEY;
if (!API_SECRET_KEY) {
  console.warn('⚠️ API_SECRET_KEY 未設定，API 端點將不受認證保護');
}

function apiAuth(req, res, next) {
  // 未設定 key 時跳過認證（開發模式相容）
  if (!API_SECRET_KEY) return next();

  // 白名單：不需要認證的端點
  // 注意：因為 app.use('/api', apiAuth) 會 strip 掉 /api 前綴
  // 所以 req.path 是 /health 而非 /api/health
  const publicPaths = [
    '/health',
    '/webhooks/github',     // GitHub webhook 有自己的 HMAC 驗證
    '/ai-guide',            // AI 統一入口手冊（公開，供外部 AI 學習）
    '/guide/clients',       // AI 客戶模組手冊
    '/guide/jobs',          // AI 職缺模組手冊
    '/guide/candidates',    // AI 人選模組手冊
    '/guide/talent-ops',    // AI 人才AI模組手冊
    '/guide',               // 舊版完整手冊
    '/scoring-guide',       // 評分指南
    '/jobs-import-guide',   // 職缺匯入指南
    '/resume-guide',        // 履歷分析指南
    '/resume-import-guide', // 履歷匯入指南
    '/github-analysis-guide', // GitHub 分析指南
    '/consultant-sop',      // 顧問 SOP 手冊
    '/users',               // 用戶相關操作（登入、清單、更新個人資料、在線狀態）
  ];
  if (publicPaths.some(p => req.path === p || req.path.startsWith(p + '/'))) {
    return next();
  }

  // OpenClaw 路由有自己的 X-OpenClaw-Key 認證，這裡允許通過
  if (req.path.startsWith('/openclaw')) {
    return next();
  }

  // 檢查 Bearer token（header 或 query param ?token=xxx，用於 window.open 下載）
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : (req.query.token || null);

  if (!token || token !== API_SECRET_KEY) {
    return res.status(401).json({
      success: false,
      error: '未授權：缺少或無效的 API Key'
    });
  }

  next();
}

app.use('/api', apiAuth);

// ==================== 路由 ====================

// 完整的 API 路由（候選人 + 職缺）
app.use('/api', apiRouter);

// 爬蟲整合 API 路由（proxy + 效益指標）
const crawlerRouter = require('./routes-crawler');
app.use('/api/crawler', crawlerRouter);

// OpenClaw 批量 API 路由（本地 AI 工具讀寫候選人）
const openclawRouter = require('./routes-openclaw');
app.use('/api/openclaw', openclawRouter);

// AI Agent API 路由（外部 AI 取提示詞 + 人選 + 職缺 → 寫回分析結果）
const aiAgentRouter = require('./routes-ai-agent');
app.use('/api/ai-agent', aiAgentRouter);

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
  if (err.stack) console.error(err.stack);
  res.status(500).json({
    success: false,
    error: isProduction ? '伺服器內部錯誤' : err.message
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

  // 1.5 啟動匯入佇列 Worker（DBA P2）
  if (dbConnected) {
    try {
      const { startWorker } = require('./importQueue');
      startWorker(5000); // 每 5 秒輪詢
    } catch (err) {
      console.warn('⚠️ ImportQueue Worker failed to start:', err.message);
    }
  }

  // 2. 啟動 HTTP + Socket.IO 服務器（不論 DB 是否正常）
  const server = httpServer.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════╗
║  🚀 Step1ne Backend Started            ║
║  📍 http://localhost:${PORT}              ║
║  🗄️  PostgreSQL: ${dbConnected ? 'Connected  ' : 'UNAVAILABLE'}        ║
║  📊 Mode: ${dbConnected ? 'SQL + Google Sheets' : 'DEGRADED (no DB)  '}   ║
║  🔒 Security: helmet + rate-limit      ║
║  🔌 WebSocket: Socket.IO enabled       ║
╚═══════════════════════════════════════╝
    `);
  });

  // 3. 優雅關閉
  process.on('SIGTERM', async () => {
    console.log('🛑 SIGTERM received, shutting down...');
    try { require('./importQueue').stopWorker(); } catch (_) {}
    server.close(() => {
      console.log('✅ Server closed');
      process.exit(0);
    });
  });
}

startServer();

module.exports = app;
