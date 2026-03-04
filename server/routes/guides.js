/**
 * guides.js - routes
 */
const express = require('express');
const router = express.Router();
const { pool } = require('../utils/db');
const { sanitizeId, writeLog, syncSQLToSheets } = require('../utils/helpers');

router.param('id', (req, _res, next, value) => {
  req.params.id = sanitizeId(value);
  next();
});

const fs = require('fs');
const path = require('path');

// ==================== AI 指南端點 ====================

/**
 * GET /api/guide
 * 回傳 AIbot 操作指南（Markdown 格式）
 * AIbot 可透過此端點學習所有 API 端點、欄位說明、評分標準
 */

router.get('/guide', (req, res) => {
  try {
    const guidePath = path.join(__dirname, '../guides/AIBOT-API-GUIDE.md');
    if (!fs.existsSync(guidePath)) {
      return res.status(404).json({ success: false, error: 'Guide file not found' });
    }
    const content = fs.readFileSync(guidePath, 'utf-8');
    // 根據 Accept 標頭決定回傳格式
    const accept = req.headers['accept'] || '';
    if (accept.includes('application/json')) {
      res.json({ success: true, content });
    } else {
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.send(content);
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/migrate/extract-links — 從舊欄位 (email / notes / phone / contact_link) 提取 LinkedIn / GitHub 連結到專屬欄位
// Google Sheets 欄位對應：B欄(連結/信箱) → email 欄位(含LinkedIn URL) / T欄(備註) → notes 欄位(含GitHub URL)
router.post('/migrate/extract-links', async (req, res) => {
  try {
    // 取出 linkedin_url 或 github_url 為空的所有候選人，同時讀取 email 欄位（Sheets B欄）
    const result = await pool.query(`
      SELECT id, name, email, phone, contact_link, notes, linkedin_url, github_url
      FROM candidates_pipeline
      WHERE (linkedin_url IS NULL OR linkedin_url = '')
         OR (github_url IS NULL OR github_url = '')
    `);

    let updated = 0;
    const details = [];

    for (const row of result.rows) {
      const email       = (row.email        || '').trim();
      const phone       = (row.phone        || '').trim();
      const contactLink = (row.contact_link || '').trim();
      const notes       = (row.notes        || '').trim();

      let newLinkedin = (row.linkedin_url || '').trim();
      let newGithub   = (row.github_url   || '').trim();

      // ── LinkedIn 提取 ─────────────────────────────────
      if (!newLinkedin) {
        // 1. email 欄位（Sheets B欄「連結/信箱」，常直接存 LinkedIn URL）
        const liInEmail = email.match(/(https?:\/\/(www\.)?linkedin\.com\/[^\s"'<>]+)/i);
        if (liInEmail) newLinkedin = liInEmail[1].replace(/[,;]+$/, '');
      }

      if (!newLinkedin) {
        // 2. notes 欄位（Sheets T欄「備註」，格式如 "LinkedIn: https://..."）
        const liInNotes = notes.match(/(https?:\/\/(www\.)?linkedin\.com\/[^\s"'<>]+)/i);
        if (liInNotes) newLinkedin = liInNotes[1].replace(/[,;]+$/, '');
        if (!newLinkedin) {
          const liTextInNotes = notes.match(/LinkedIn[:\s]+(https?:\/\/[^\s,;]+)/i);
          if (liTextInNotes) newLinkedin = liTextInNotes[1].replace(/[,;]+$/, '');
        }
      }

      if (!newLinkedin) {
        // 3. phone 或 contact_link 欄位（舊資料備用）
        const liInOther = (phone + ' ' + contactLink).match(/(https?:\/\/(www\.)?linkedin\.com\/[^\s"'<>]+)/i);
        if (liInOther) newLinkedin = liInOther[1].replace(/[,;]+$/, '');
      }

      // ── GitHub 提取 ───────────────────────────────────
      if (!newGithub) {
        // 1. notes 欄位（Sheets T欄「備註」，常直接存 GitHub URL）
        const ghInNotes = notes.match(/(https?:\/\/(www\.)?github\.com\/[^\s"'<>]+)/i);
        if (ghInNotes) newGithub = ghInNotes[1].replace(/[,;]+$/, '');
        if (!newGithub) {
          const ghTextInNotes = notes.match(/GitHub[:\s]+(https?:\/\/[^\s,;]+)/i);
          if (ghTextInNotes) newGithub = ghTextInNotes[1].replace(/[,;]+$/, '');
        }
      }

      if (!newGithub) {
        // 2. phone 或 contact_link 欄位（舊資料備用）
        const ghInOther = (phone + ' ' + contactLink).match(/(https?:\/\/(www\.)?github\.com\/[^\s"'<>]+)/i);
        if (ghInOther) newGithub = ghInOther[1].replace(/[,;]+$/, '');
      }

      // ── 只有找到新值才寫入 ────────────────────────────
      const linkedinChanged = newLinkedin && newLinkedin !== (row.linkedin_url || '');
      const githubChanged   = newGithub   && newGithub   !== (row.github_url   || '');

      if (linkedinChanged || githubChanged) {
        await pool.query(
          `UPDATE candidates_pipeline
           SET linkedin_url = COALESCE(NULLIF($1,''), linkedin_url),
               github_url   = COALESCE(NULLIF($2,''), github_url)
           WHERE id = $3`,
          [newLinkedin || '', newGithub || '', row.id]
        );
        updated++;
        details.push({
          id:      row.id,
          name:    row.name,
          ...(linkedinChanged ? { linkedin: newLinkedin } : {}),
          ...(githubChanged   ? { github:   newGithub   } : {}),
        });
      }
    }

    res.json({
      success: true,
      message: `已從現有欄位提取並更新 ${updated} 筆連結`,
      total_scanned: result.rows.length,
      updated,
      details,
    });
  } catch (error) {
    console.error('extract-links migration error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/scoring-guide — 回傳評分 Bot 執行指南（供 openclaw / AI Agent 定時評分使用）
router.get('/scoring-guide', (req, res) => {
  try {
    const guidePath = path.join(__dirname, '../guides/SCORING-GUIDE.md');
    if (!fs.existsSync(guidePath)) {
      return res.status(404).json({ success: false, error: 'Scoring guide not found' });
    }
    const content = fs.readFileSync(guidePath, 'utf-8');
    const accept = req.headers['accept'] || '';
    if (accept.includes('application/json')) {
      res.json({ success: true, content });
    } else {
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.send(content);
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/jobs-import-guide — 回傳職缺匯入 Bot 執行指南
router.get('/jobs-import-guide', (req, res) => {
  try {
    const guidePath = path.join(__dirname, '../guides/JOB-IMPORT-GUIDE.md');
    if (!fs.existsSync(guidePath)) {
      return res.status(404).json({ success: false, error: 'Job import guide not found' });
    }
    const content = fs.readFileSync(guidePath, 'utf-8');
    const accept = req.headers['accept'] || '';
    if (accept.includes('application/json')) {
      res.json({ success: true, content });
    } else {
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.send(content);
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/resume-guide — 回傳履歷分析教學指南（供 AIbot 學習使用）
router.get('/resume-guide', (req, res) => {
  try {
    const guidePath = path.join(__dirname, '../guides/RESUME-ANALYSIS-GUIDE.md');
    if (!fs.existsSync(guidePath)) {
      return res.status(404).json({ success: false, error: 'Resume analysis guide not found' });
    }
    const content = fs.readFileSync(guidePath, 'utf-8');
    const accept = req.headers['accept'] || '';
    if (accept.includes('application/json')) {
      res.json({ success: true, content });
    } else {
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.send(content);
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/resume-import-guide — 履歷匯入 + 即時評分合併執行指南
router.get('/resume-import-guide', (req, res) => {
  try {
    const guidePath = path.join(__dirname, '../guides/RESUME-IMPORT-GUIDE.md');
    if (!fs.existsSync(guidePath)) {
      return res.status(404).json({ success: false, error: 'Resume import guide not found' });
    }
    const content = fs.readFileSync(guidePath, 'utf-8');
    const accept = req.headers['accept'] || '';
    if (accept.includes('application/json')) {
      res.json({ success: true, content });
    } else {
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.send(content);
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/github-analysis-guide — GitHub 分析指南（供 OpenClaw / AI Agent 使用）
router.get('/github-analysis-guide', (req, res) => {
  try {
    const guidePath = path.join(__dirname, '../guides/GITHUB-ANALYSIS-GUIDE.md');
    if (!fs.existsSync(guidePath)) {
      return res.status(404).json({ success: false, error: 'GitHub analysis guide not found' });
    }
    const content = fs.readFileSync(guidePath, 'utf-8');
    const accept = req.headers['accept'] || '';
    if (accept.includes('application/json')) {
      res.json({ success: true, content });
    } else {
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.send(content);
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 人才智能爬蟲 API (NEW - 2026-02-26) ====================
// 整合 step1ne-headhunter-skill 的爬蟲系統


module.exports = router;
