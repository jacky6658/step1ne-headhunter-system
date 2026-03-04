/**
 * routes-api.js - API 路由薄層聚合器
 * 各功能模組分別在 server/routes/ 目錄下
 */
const express = require('express');
const router = express.Router();

// 啟動時執行 DB migrations
require('./utils/migrations');

// 人才智能爬蟲（talent-sourcing 子模組）
const talentSourcingRoutes = require('./talent-sourcing/routes');
router.use('/talent-sourcing', talentSourcingRoutes);

// 掛載各功能模組路由
router.use('/', require('./routes/candidates'));
router.use('/', require('./routes/jobs'));
router.use('/', require('./routes/clients'));
router.use('/', require('./routes/users'));
router.use('/', require('./routes/sync'));
router.use('/', require('./routes/bot'));
router.use('/', require('./routes/guides'));

module.exports = router;
