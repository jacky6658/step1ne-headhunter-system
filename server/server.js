// Step1ne Headhunter System - Backend API Server
// Node.js + Express + Google Sheets API

import express from 'express';
import cors from 'cors';
import * as sheetsService from './sheetsService.js';

const app = express();
const PORT = process.env.PORT || 3001;

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

// 取得用戶列表（登入驗證用）
app.get('/api/users', (req, res) => {
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
  
  res.json({ success: true, data: users, count: users.length });
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
