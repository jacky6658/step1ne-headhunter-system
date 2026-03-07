/**
 * crawlerImportService.js - 爬蟲候選人匯入欄位映射 + 批次工具
 *
 * 將爬蟲格式的候選人資料映射為 Step1ne candidates_pipeline 格式
 */

// 爬蟲匯入的候選人統一標記來源為「爬蟲匯入」，
// 方便顧問在候選人總表透過來源篩選快速辨識
const CRAWLER_SOURCE = '爬蟲匯入';

/**
 * 將單筆爬蟲候選人映射為 Step1ne 系統格式
 * @param {Object} raw - 爬蟲原始候選人資料
 * @returns {Object} Step1ne candidates_pipeline 格式
 */
function mapCrawlerCandidate(raw) {
  // 組合備註欄
  const notesParts = [];
  if (raw.company) notesParts.push(`公司: ${raw.company}`);
  if (raw.bio) notesParts.push(`簡介: ${raw.bio}`);
  if (raw.score != null) notesParts.push(`Crawler 評分: ${raw.score} (${raw.grade || '未評'})`);
  if (raw.client_name) notesParts.push(`客戶: ${raw.client_name}`);
  if (raw.job_title) notesParts.push(`職缺: ${raw.job_title}`);

  const mapped = {
    name: (raw.name || '').trim(),
    email: raw.email || '',
    linkedin_url: raw.linkedin_url || '',
    github_url: raw.github_url || '',
    location: raw.location || '',
    current_position: raw.title || '',
    skills: Array.isArray(raw.skills) ? raw.skills.join('、') : (raw.skills || ''),
    talent_level: raw.grade || '',
    source: CRAWLER_SOURCE,
    notes: notesParts.join('\n'),
    status: (() => {
      const aiGrade = (raw.ai_grade || raw.grade || '').toUpperCase();
      // B 級以上 → AI推薦，讓顧問優先處理高品質人選
      return (aiGrade === 'A' || aiGrade === 'A+' || aiGrade === 'S' || aiGrade === 'B') ? 'AI推薦' : '未開始';
    })(),
  };

  // 爬蟲任務的 step1ne_job_id → 系統的 target_job_id
  if (raw.step1ne_job_id) {
    mapped.target_job_id = Number(raw.step1ne_job_id);
  }

  // ── 深度分析充實資料 (Perplexity/Jina enrichment) ──
  // 只傳遞非空陣列（避免空陣列覆蓋已有資料）
  if (Array.isArray(raw.work_history) && raw.work_history.length > 0) {
    mapped.work_history = raw.work_history;
  }
  if (Array.isArray(raw.education_details) && raw.education_details.length > 0) {
    mapped.education_details = raw.education_details;
  }
  if (raw.years_experience) mapped.years_experience = String(raw.years_experience);
  if (raw.stability_score) mapped.stability_score = String(raw.stability_score);
  if (raw.job_changes) mapped.job_changes = String(raw.job_changes);
  if (raw.avg_tenure_months) mapped.avg_tenure_months = String(raw.avg_tenure_months);
  if (raw.recent_gap_months) mapped.recent_gap_months = String(raw.recent_gap_months);
  if (raw.education) mapped.education = raw.education;
  if (raw.leaving_reason) mapped.leaving_reason = raw.leaving_reason;
  if (raw.personality_type) mapped.personality_type = raw.personality_type;
  if (raw.ai_match_result) mapped.ai_match_result = raw.ai_match_result;

  // AI 評等（覆蓋關鍵字評等）
  if (raw.ai_grade) mapped.talent_level = raw.ai_grade;

  // AI 分析報告 → 附加到 notes
  if (raw.ai_report) {
    mapped.notes = (mapped.notes ? mapped.notes + '\n\n' : '') + raw.ai_report;
  }

  return mapped;
}

/**
 * 將陣列分割為固定大小的批次
 * @param {Array} arr - 來源陣列
 * @param {number} size - 每批大小（預設 100）
 * @returns {Array[]} 分批後的二維陣列
 */
function chunkArray(arr, size = 100) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

/**
 * 執行批量匯入核心邏輯（與 routes-api.js 共用）
 * @param {Pool} pool - PostgreSQL 連線池
 * @param {Array} candidates - Step1ne 格式的候選人陣列
 * @param {string} actor - 操作者名稱
 * @returns {Object} { created, updated, failed }
 */
async function processBulkImport(pool, candidates, actor) {
  const client = await pool.connect();
  try {
    // 取得所有現有候選人（用 name 比對）
    const existing = await client.query('SELECT id, name FROM candidates_pipeline');
    const existingMap = new Map();
    for (const row of existing.rows) {
      const key = (row.name || '').trim().toLowerCase();
      if (key) existingMap.set(key, row.id);
    }

    const results = { created: [], updated: [], failed: [] };

    for (const c of candidates) {
      try {
        if (!c.name) {
          results.failed.push({ name: '(empty)', error: 'Name is required' });
          continue;
        }

        const nameKey = c.name.trim().toLowerCase();

        if (existingMap.has(nameKey)) {
          // 既有人選 → 補充空欄位 + 覆寫 enrichment/AI 資料
          const existingId = existingMap.get(nameKey);
          const result = await client.query(
            `UPDATE candidates_pipeline SET
              phone = COALESCE(NULLIF(phone, ''), $1),
              contact_link = COALESCE(NULLIF(contact_link, ''), $2),
              location = COALESCE(NULLIF(location, ''), $3),
              current_position = COALESCE(NULLIF(current_position, ''), $4),
              years_experience = COALESCE(NULLIF(years_experience, ''), NULLIF(years_experience, '0'), $5),
              skills = COALESCE(NULLIF(skills, ''), $6),
              education = COALESCE(NULLIF(education, ''), $7),
              source = CASE WHEN $8 = '爬蟲匯入' THEN $8 ELSE COALESCE(NULLIF(source, ''), $8) END,
              notes = CASE WHEN $9 = '' THEN notes ELSE CONCAT(notes, CASE WHEN notes != '' THEN E'\n' ELSE '' END, $9) END,
              stability_score = COALESCE(NULLIF(stability_score, ''), NULLIF(stability_score, '0'), $10),
              personality_type = COALESCE(NULLIF(personality_type, ''), $11),
              job_changes = COALESCE(NULLIF(job_changes, ''), NULLIF(job_changes, '0'), $12),
              avg_tenure_months = COALESCE(NULLIF(avg_tenure_months, ''), NULLIF(avg_tenure_months, '0'), $13),
              recent_gap_months = COALESCE(NULLIF(recent_gap_months, ''), NULLIF(recent_gap_months, '0'), $14),
              work_history = CASE WHEN $15::jsonb IS NOT NULL AND jsonb_array_length($15::jsonb) > 0 THEN $15::jsonb ELSE work_history END,
              education_details = CASE WHEN $16::jsonb IS NOT NULL AND jsonb_array_length($16::jsonb) > 0 THEN $16::jsonb ELSE education_details END,
              leaving_reason = COALESCE(NULLIF(leaving_reason, ''), $17),
              talent_level = CASE WHEN $18 != '' THEN $18 ELSE COALESCE(NULLIF(talent_level, ''), $18) END,
              email = COALESCE(NULLIF(email, ''), $19),
              linkedin_url = COALESCE(NULLIF(linkedin_url, ''), $20),
              github_url = COALESCE(NULLIF(github_url, ''), $21),
              target_job_id = COALESCE(target_job_id, $23),
              ai_match_result = CASE WHEN $24::jsonb IS NOT NULL THEN $24::jsonb ELSE ai_match_result END,
              updated_at = NOW()
            WHERE id = $22
            RETURNING id, name, contact_link, current_position, status, target_job_id`,
            [
              c.phone || '',
              c.contact_link || '',
              c.location || '',
              c.current_position || '',
              String(c.years_experience || ''),
              c.skills || '',
              c.education || '',
              c.source || '',
              c.notes || '',
              String(c.stability_score || ''),
              c.personality_type || '',
              String(c.job_changes || ''),
              String(c.avg_tenure_months || ''),
              String(c.recent_gap_months || ''),
              c.work_history ? JSON.stringify(c.work_history) : null,
              c.education_details ? JSON.stringify(c.education_details) : null,
              c.leaving_reason || '',
              c.talent_level || '',
              c.email || '',
              c.linkedin_url || '',
              c.github_url || '',
              existingId,
              c.target_job_id || null,
              c.ai_match_result ? (typeof c.ai_match_result === 'string' ? c.ai_match_result : JSON.stringify(c.ai_match_result)) : null
            ]
          );
          results.updated.push(result.rows[0]);
        } else {
          // 新人選 → 建立
          const result = await client.query(
            `INSERT INTO candidates_pipeline
             (name, phone, email, linkedin_url, github_url, contact_link,
              location, current_position, years_experience,
              skills, education, source, status, recruiter, notes,
              stability_score, personality_type, job_changes, avg_tenure_months,
              recent_gap_months, work_history, education_details, leaving_reason,
              talent_level, target_job_id, ai_match_result, created_at, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21::jsonb,$22::jsonb,$23,$24,$25,$26::jsonb,NOW(),NOW())
             RETURNING id, name, contact_link, current_position, status, target_job_id`,
            [
              c.name.trim(),
              c.phone || '',
              c.email || '',
              c.linkedin_url || '',
              c.github_url || '',
              c.contact_link || '',
              c.location || '',
              c.current_position || '',
              String(c.years_experience || '0'),
              c.skills || '',
              c.education || '',
              c.source || CRAWLER_SOURCE,
              c.status || '未開始',
              c.recruiter || actor || 'Crawler',
              c.notes || '',
              String(c.stability_score || '0'),
              c.personality_type || '',
              String(c.job_changes || '0'),
              String(c.avg_tenure_months || '0'),
              String(c.recent_gap_months || '0'),
              c.work_history ? JSON.stringify(c.work_history) : null,
              c.education_details ? JSON.stringify(c.education_details) : null,
              c.leaving_reason || '',
              c.talent_level || '',
              c.target_job_id || null,
              c.ai_match_result ? (typeof c.ai_match_result === 'string' ? c.ai_match_result : JSON.stringify(c.ai_match_result)) : null
            ]
          );
          existingMap.set(nameKey, result.rows[0].id);
          results.created.push(result.rows[0]);
        }
      } catch (err) {
        console.error(`❌ Import failed for "${c.name}": ${err.message}${err.code ? ` (${err.code})` : ''}${err.detail ? ` - ${err.detail}` : ''}`);
        results.failed.push({ name: c.name || '(unknown)', error: err.message, code: err.code || '' });
      }
    }

    return results;
  } finally {
    client.release();
  }
}

module.exports = { mapCrawlerCandidate, chunkArray, processBulkImport };
