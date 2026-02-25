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

// 環境變數相容：支援 DATABASE_URL 或 POSTGRES_URI（Zeabur 自動生成）
if (!process.env.DATABASE_URL && process.env.POSTGRES_URI) {
  process.env.DATABASE_URL = process.env.POSTGRES_URI;
}

const sqlService = require('./sqlService');
const candidatesRouter = require('./routes-candidates');

const app = express();
const PORT = process.env.PORT || 3001;

// ==================== 中間件 ====================

app.use(cors({
  origin: process.env.FRONTEND_URL || ['http://localhost:3000', 'https://step1ne.com'],
  credentials: true
}));

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

// 請求日誌中間件
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// ==================== 路由 ====================

// 主要的候選人 API
app.use('/api', candidatesRouter);

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
  try {
    // 1. 測試 PostgreSQL 連線
    console.log('🔍 Testing PostgreSQL connection...');
    const health = await sqlService.healthCheck();
    console.log(`✅ PostgreSQL connected at ${health.timestamp}`);

    // 2. 啟動 Express 服務器
    const server = app.listen(PORT, () => {
      console.log(`
╔═══════════════════════════════════════╗
║  🚀 Step1ne Backend Started            ║
║  📍 http://localhost:${PORT}              ║
║  🗄️  PostgreSQL: Connected            ║
║  📊 Mode: SQL + Google Sheets Sync    ║
╚═══════════════════════════════════════╝
      `);
    });

    // 3. 定期同步待處理項目（每 5 分鐘）
    const syncInterval = setInterval(async () => {
      try {
        console.log('🔄 Periodic sync triggered');
        await require('./candidatesService').syncPendingChanges();
      } catch (err) {
        console.error('⚠️ Periodic sync failed:', err.message);
      }
    }, 5 * 60 * 1000); // 5 分鐘

    // 4. 優雅關閉
    process.on('SIGTERM', async () => {
      console.log('🛑 SIGTERM received, shutting down...');
      clearInterval(syncInterval);
      server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
}

startServer();

module.exports = app;
