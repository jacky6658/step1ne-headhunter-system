// Step1ne Headhunter System - Backend API Server
// Node.js + Express + Google Sheets API

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import * as sheetsService from './sheetsService.js';
import * as gradingService from './gradingService.js';

const app = express();
const PORT = process.env.PORT || 3001;

// 設定檔案上傳（使用 multer）
const upload = multer({ 
  dest: '/tmp/uploads/',
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('只接受 PDF 檔案'));
    }
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'step1ne-headhunter-api',
    version: '1.0.0'
  });
});

// 用戶資料（共用）
const users = [
  {
    id: '1',
    username: 'admin',
    name: 'Admin',
    email: 'admin@step1ne.com',
    role: 'ADMIN',
    consultant: 'Admin'
  },
  {
    id: '2',
    username: 'jacky',
    name: 'Jacky Chen',
    email: 'jacky@step1ne.com',
    role: 'REVIEWER',
    consultant: 'Jacky'
  },
  {
    id: '3',
    username: 'phoebe',
    name: 'Phoebe',
    email: 'phoebe@step1ne.com',
    role: 'REVIEWER',
    consultant: 'Phoebe'
  }
];

// 取得用戶列表（登入驗證用）
app.get('/api/users', (req, res) => {
  res.json({ success: true, data: users, count: users.length });
});

// 取得單一用戶（by id 或 username）
app.get('/api/users/:id', (req, res) => {
  const userId = req.params.id;
  const user = users.find(u => u.id === userId || u.username === userId);
  
  if (!user) {
    return res.status(404).json({ 
      success: false, 
      error: '找不到用戶' 
    });
  }
  
  res.json({ success: true, data: user });
});

// 取得所有候選人
app.get('/api/candidates', async (req, res) => {
  try {
    const candidates = await sheetsService.getCandidates();
    res.json({ success: true, data: candidates, count: candidates.length });
  } catch (error) {
    console.error('取得候選人失敗:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// 取得單一候選人
app.get('/api/candidates/:id', async (req, res) => {
  try {
    const candidate = await sheetsService.getCandidate(req.params.id);
    
    if (!candidate) {
      return res.status(404).json({ 
        success: false, 
        error: '找不到候選人' 
      });
    }
    
    res.json({ success: true, data: candidate });
  } catch (error) {
    console.error('取得候選人失敗:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// 新增候選人
app.post('/api/candidates', async (req, res) => {
  try {
    const result = await sheetsService.addCandidate(req.body);
    res.json(result);
  } catch (error) {
    console.error('新增候選人失敗:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// 更新候選人狀態
app.put('/api/candidates/:id', async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({ 
        success: false, 
        error: '缺少 status 欄位' 
      });
    }
    
    const result = await sheetsService.updateCandidateStatus(req.params.id, status);
    res.json(result);
  } catch (error) {
    console.error('更新候選人失敗:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// 刪除候選人（軟刪除）
app.delete('/api/candidates/:id', async (req, res) => {
  try {
    const result = await sheetsService.deleteCandidate(req.params.id);
    res.json(result);
  } catch (error) {
    console.error('刪除候選人失敗:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// 批量更新候選人狀態
app.post('/api/candidates/batch-update-status', async (req, res) => {
  try {
    const { updates } = req.body;
    
    if (!updates || !Array.isArray(updates)) {
      return res.status(400).json({ 
        success: false, 
        error: '缺少 updates 陣列' 
      });
    }
    
    const result = await sheetsService.batchUpdateStatus(updates);
    res.json(result);
  } catch (error) {
    console.error('批量更新失敗:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// 評級候選人（呼叫 grading-logic.py + 寫入 Google Sheets Column U）
app.post('/api/candidates/:id/grade', async (req, res) => {
  try {
    const candidateId = req.params.id;
    
    // 取得候選人資料
    const candidate = await sheetsService.getCandidate(candidateId);
    
    if (!candidate) {
      return res.status(404).json({ 
        success: false, 
        error: '找不到候選人' 
      });
    }
    
    // 執行評級 + 寫入 Google Sheets
    const result = await gradingService.gradeAndSave(candidate);
    
    res.json(result);
    
  } catch (error) {
    console.error('評級候選人失敗:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// 上傳履歷 PDF
app.post('/api/candidates/:id/upload-resume', upload.single('resume'), async (req, res) => {
  try {
    const candidateId = req.params.id;
    const candidateName = req.body.candidateName;
    
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: '沒有上傳檔案' 
      });
    }
    
    console.log('📤 收到履歷上傳請求');
    console.log('候選人:', candidateName, `(ID: ${candidateId})`);
    console.log('檔案:', req.file.originalname);
    
    // 使用簡化版的處理流程（直接在這裡實作，避免模組化問題）
    const filePath = req.file.path;
    
    // 1. 模擬上傳到 Google Drive（實際上先跳過，只記錄檔案位置）
    console.log('✅ 履歷已暫存:', filePath);
    const driveUrl = `file://${filePath}`; // 暫時使用本地路徑
    
    // 2. 模擬 AI 解析（暫時返回空資料）
    const parsedData = {
      email: 'test@example.com', // 待實作
      phone: '0912345678', // 待實作
      skills: ['待解析'], // 待實作
      workHistory: [], // 待實作
      education: [] // 待實作
    };
    
    console.log('✅ AI 解析完成（模擬）');
    
    // 3. 返回結果
    res.json({
      success: true,
      driveUrl,
      fileName: req.file.originalname,
      parsedData,
      message: '履歷上傳成功（待完整整合 Google Drive 與 AI 解析）'
    });
    
  } catch (error) {
    console.error('❌ 上傳履歷失敗:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// 批量評級所有候選人
app.post('/api/candidates/batch-grade', async (req, res) => {
  try {
    const candidates = await sheetsService.getCandidates();
    const results = [];
    const errors = [];
    
    for (const candidate of candidates) {
      try {
        const result = await gradingService.gradeAndSave(candidate);
        results.push(result);
      } catch (error) {
        errors.push({
          candidateId: candidate.id,
          name: candidate.name,
          error: error.message
        });
      }
    }
    
    res.json({
      success: true,
      total: candidates.length,
      graded: results.length,
      errors: errors.length,
      results,
      errors
    });
    
  } catch (error) {
    console.error('批量評級失敗:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// 404 處理
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    error: 'API endpoint not found' 
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    success: false, 
    error: 'Internal server error' 
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Step1ne Headhunter API running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📋 Candidates API: http://localhost:${PORT}/api/candidates`);
});
