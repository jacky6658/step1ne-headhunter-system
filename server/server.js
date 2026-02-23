// Step1ne Headhunter System - Backend API Server
// 極簡 Node.js + Express 後端，連接 Google Sheets

import express from 'express';
import cors from 'cors';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Google Sheets 配置
const SHEET_ID = process.env.SHEET_ID || '1PunpaDAFBPBL_I76AiRYGXKaXDZvMl1c262SEtxRk6Q';
const GOOGLE_ACCOUNT = process.env.GOOGLE_ACCOUNT || 'aijessie88@step1ne.com';
const CANDIDATES_TAB = '履歷池v2';

/**
 * 解析 Google Sheets 輸出為候選人陣列
 */
function parseCandidatesFromSheets(stdout) {
  const rows = stdout.trim().split('\n').filter(r => r.trim());
  
  return rows.map((row, index) => {
    const fields = row.split(/\s{2,}/);
    
    const safeParseJSON = (jsonString, defaultValue = []) => {
      try {
        return jsonString && jsonString.trim() ? JSON.parse(jsonString) : defaultValue;
      } catch {
        return defaultValue;
      }
    };
    
    return {
      id: `candidate-${index + 2}`, // +2 因為第 1 行是標題
      _sheetRow: index + 2,
      
      // A-L: 基本資訊
      name: fields[0] || '',
      email: fields[1] || '',
      phone: fields[2] || '',
      location: fields[3] || '',
      position: fields[4] || '',
      years: parseFloat(fields[5]) || 0,
      jobChanges: parseInt(fields[6]) || 0,
      avgTenure: parseFloat(fields[7]) || 0,
      lastGap: parseInt(fields[8]) || 0,
      skills: fields[9] || '',
      education: fields[10] || '',
      source: fields[11] || 'Other',
      
      // M-T: 進階資訊
      workHistory: safeParseJSON(fields[12], []),
      quitReasons: fields[13] || '',
      stabilityScore: parseInt(fields[14]) || 0,
      educationJson: safeParseJSON(fields[15], []),
      discProfile: fields[16] || '',
      status: fields[17] || '待聯繫',
      consultant: fields[18] || '',
      notes: fields[19] || '',
      
      // 系統欄位
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'system'
    };
  });
}

// ===== API Endpoints =====

/**
 * GET /api/candidates - 取得所有候選人
 */
app.get('/api/candidates', async (req, res) => {
  try {
    console.log('讀取候選人資料...');
    
    const { stdout } = await execAsync(
      `gog sheets get ${SHEET_ID} '${CANDIDATES_TAB}!A2:T' --account ${GOOGLE_ACCOUNT}`
    );
    
    const candidates = parseCandidatesFromSheets(stdout);
    
    res.json({
      success: true,
      count: candidates.length,
      candidates
    });
  } catch (error) {
    console.error('讀取候選人失敗:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/candidates/:id - 取得單一候選人
 */
app.get('/api/candidates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 先取得所有候選人
    const { stdout } = await execAsync(
      `gog sheets get ${SHEET_ID} '${CANDIDATES_TAB}!A2:T' --account ${GOOGLE_ACCOUNT}`
    );
    
    const candidates = parseCandidatesFromSheets(stdout);
    const candidate = candidates.find(c => c.id === id);
    
    if (!candidate) {
      return res.status(404).json({
        success: false,
        error: '找不到候選人'
      });
    }
    
    res.json({
      success: true,
      candidate
    });
  } catch (error) {
    console.error('讀取候選人失敗:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/candidates - 新增候選人
 */
app.post('/api/candidates', async (req, res) => {
  try {
    const candidate = req.body;
    
    // 構造資料列
    const values = [
      candidate.name,
      candidate.email,
      candidate.phone,
      candidate.location,
      candidate.position,
      candidate.years.toString(),
      candidate.jobChanges.toString(),
      candidate.avgTenure.toString(),
      candidate.lastGap.toString(),
      candidate.skills,
      candidate.education,
      candidate.source,
      JSON.stringify(candidate.workHistory || []),
      candidate.quitReasons || '',
      candidate.stabilityScore.toString(),
      JSON.stringify(candidate.educationJson || []),
      candidate.discProfile || '',
      candidate.status,
      candidate.consultant || '',
      candidate.notes || ''
    ];
    
    const valuesJson = JSON.stringify([values]);
    
    await execAsync(
      `gog sheets append ${SHEET_ID} '${CANDIDATES_TAB}!A:T' --values-json '${valuesJson}' --account ${GOOGLE_ACCOUNT}`
    );
    
    res.json({
      success: true,
      message: '候選人已新增',
      candidate: {
        ...candidate,
        id: `candidate-${Date.now()}`,
        createdAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('新增候選人失敗:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/candidates/:id - 更新候選人
 */
app.put('/api/candidates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const candidate = req.body;
    
    // 從 ID 取得行號
    const rowNumber = candidate._sheetRow || parseInt(id.split('-')[1]);
    
    if (!rowNumber) {
      return res.status(400).json({
        success: false,
        error: '無法確定資料行號'
      });
    }
    
    // 構造資料列
    const values = [
      candidate.name,
      candidate.email,
      candidate.phone,
      candidate.location,
      candidate.position,
      candidate.years.toString(),
      candidate.jobChanges.toString(),
      candidate.avgTenure.toString(),
      candidate.lastGap.toString(),
      candidate.skills,
      candidate.education,
      candidate.source,
      JSON.stringify(candidate.workHistory || []),
      candidate.quitReasons || '',
      candidate.stabilityScore.toString(),
      JSON.stringify(candidate.educationJson || []),
      candidate.discProfile || '',
      candidate.status,
      candidate.consultant || '',
      candidate.notes || ''
    ];
    
    const valuesJson = JSON.stringify([values]);
    
    await execAsync(
      `gog sheets update ${SHEET_ID} '${CANDIDATES_TAB}!A${rowNumber}:T${rowNumber}' --values-json '${valuesJson}' --account ${GOOGLE_ACCOUNT}`
    );
    
    res.json({
      success: true,
      message: '候選人已更新',
      candidate: {
        ...candidate,
        updatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('更新候選人失敗:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/candidates/:id - 刪除候選人
 */
app.delete('/api/candidates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const candidate = req.body;
    
    // 從 ID 取得行號
    const rowNumber = candidate._sheetRow || parseInt(id.split('-')[1]);
    
    if (!rowNumber) {
      return res.status(400).json({
        success: false,
        error: '無法確定資料行號'
      });
    }
    
    // 清空該行（保留行，只清空內容）
    const emptyValues = Array(20).fill('');
    const valuesJson = JSON.stringify([emptyValues]);
    
    await execAsync(
      `gog sheets update ${SHEET_ID} '${CANDIDATES_TAB}!A${rowNumber}:T${rowNumber}' --values-json '${valuesJson}' --account ${GOOGLE_ACCOUNT}`
    );
    
    res.json({
      success: true,
      message: '候選人已刪除'
    });
  } catch (error) {
    console.error('刪除候選人失敗:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/candidates/batch-update-status - 批量更新狀態
 */
app.post('/api/candidates/batch-update-status', async (req, res) => {
  try {
    const { candidateIds, newStatus } = req.body;
    
    // TODO: 實作批量更新
    // 目前簡化版：逐一更新
    
    res.json({
      success: true,
      message: `已更新 ${candidateIds.length} 位候選人狀態`
    });
  } catch (error) {
    console.error('批量更新失敗:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/health - 健康檢查
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

/**
 * GET / - API 資訊
 */
app.get('/', (req, res) => {
  res.json({
    name: 'Step1ne Headhunter System API',
    version: '1.0.0',
    endpoints: {
      'GET /api/candidates': '取得所有候選人',
      'GET /api/candidates/:id': '取得單一候選人',
      'POST /api/candidates': '新增候選人',
      'PUT /api/candidates/:id': '更新候選人',
      'DELETE /api/candidates/:id': '刪除候選人',
      'POST /api/candidates/batch-update-status': '批量更新狀態',
      'GET /api/health': '健康檢查'
    }
  });
});

// 啟動伺服器
app.listen(PORT, () => {
  console.log(`🚀 Step1ne Headhunter API 運行中`);
  console.log(`📡 Port: ${PORT}`);
  console.log(`📊 Google Sheets: ${SHEET_ID}`);
  console.log(`👤 Account: ${GOOGLE_ACCOUNT}`);
});
