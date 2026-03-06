/**
 * perplexityService.js - Perplexity AI 候選人深度分析服務
 *
 * 透過 Perplexity Sonar API 搜尋候選人公開資料，
 * 自動充實 work_history、education_details、stability_score 等欄位。
 */

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';
const MODEL = 'sonar'; // Perplexity Sonar (搜尋增強)

/**
 * 呼叫 Perplexity Sonar API
 * @param {string} systemPrompt - 系統提示詞
 * @param {string} userPrompt - 使用者提示詞
 * @returns {string} AI 回應文字
 */
async function callPerplexity(systemPrompt, userPrompt) {
  if (!PERPLEXITY_API_KEY) {
    throw new Error('PERPLEXITY_API_KEY 未設定');
  }

  const response = await fetch(PERPLEXITY_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 3000,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Perplexity API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

/**
 * 深度分析單一候選人
 * @param {Object} candidate - 候選人資料 (name, current_position, linkedin_url, github_url, location, skills, email)
 * @returns {Object} 充實後的欄位
 */
async function enrichCandidate(candidate) {
  const { name, current_position, linkedin_url, github_url, location, skills, email } = candidate;

  // 組合搜尋線索
  const clues = [];
  if (name) clues.push(`姓名: ${name}`);
  if (current_position) clues.push(`目前職稱: ${current_position}`);
  if (linkedin_url) clues.push(`LinkedIn: ${linkedin_url}`);
  if (github_url) clues.push(`GitHub: ${github_url}`);
  if (location) clues.push(`地點: ${location}`);
  if (skills) clues.push(`技能: ${skills}`);
  if (email) clues.push(`Email: ${email}`);

  if (clues.length < 2) {
    return { error: '資料不足，至少需要姓名和一個其他資訊' };
  }

  const systemPrompt = `你是一位專業的獵頭顧問助理。你的任務是根據候選人的公開資訊，分析並整理出結構化的候選人檔案。

請用繁體中文回答，並以嚴格的 JSON 格式輸出，不要加任何 markdown 標記或額外文字。

JSON 結構如下：
{
  "work_history": [
    {"company": "公司名", "title": "職稱", "period": "2020-2023", "description": "主要職責"}
  ],
  "education_details": [
    {"school": "學校名", "degree": "學位", "major": "科系", "year": "畢業年份"}
  ],
  "years_experience": 數字（預估總年資），
  "stability_score": 數字 0-100（工作穩定度，基於平均在職時間），
  "job_changes": 數字（換工作次數），
  "avg_tenure_months": 數字（平均每份工作月數），
  "leaving_reason": "可能的離職原因或動機",
  "personality_type": "推測的職場人格特質（如：技術導向、管理型、創業型）",
  "summary": "一段 2-3 句的候選人摘要，包含核心優勢和適合的職位類型",
  "skills_enriched": "補充發現的技能（用頓號分隔）"
}

規則：
- 只使用公開可查到的資訊，不確定的標記為 null
- stability_score: 平均在職 > 3年 = 80+, 2-3年 = 60-79, 1-2年 = 40-59, < 1年 = 20-39
- 如果找不到資訊，對應欄位設為 null，不要編造`;

  const userPrompt = `請搜尋並分析以下候選人的公開資料：

${clues.join('\n')}

請盡量找到此人的工作經歷、學歷、專業技能等公開資訊，並以 JSON 格式回傳分析結果。`;

  try {
    const rawResponse = await callPerplexity(systemPrompt, userPrompt);

    // 嘗試解析 JSON（處理可能的 markdown 包裹）
    let jsonStr = rawResponse;

    // 1. 移除 markdown code block
    const jsonMatch = rawResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    // 2. 提取最外層 { ... }
    const braceMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (braceMatch) {
      jsonStr = braceMatch[0];
    }

    // 3. 嘗試直接解析
    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (firstErr) {
      // 4. 修復常見 JSON 問題：移除尾部逗號、修復未轉義引號
      let fixed = jsonStr
        .replace(/,\s*([}\]])/g, '$1')        // 移除尾部逗號
        .replace(/[\r\n]+/g, ' ')              // 移除換行
        .replace(/\t/g, ' ');                  // 移除 tab
      try {
        parsed = JSON.parse(fixed);
      } catch (secondErr) {
        // 5. 最後手段：逐欄位用 regex 提取
        console.warn('⚠️ JSON parse failed, trying regex extraction...');
        console.warn('Raw response:', rawResponse.slice(0, 500));
        parsed = extractFieldsWithRegex(rawResponse);
      }
    }
    return {
      success: true,
      data: {
        work_history: parsed.work_history || null,
        education_details: parsed.education_details || null,
        years_experience: parsed.years_experience || null,
        stability_score: parsed.stability_score || null,
        job_changes: parsed.job_changes || null,
        avg_tenure_months: parsed.avg_tenure_months || null,
        leaving_reason: parsed.leaving_reason || null,
        personality_type: parsed.personality_type || null,
        summary: parsed.summary || null,
        skills_enriched: parsed.skills_enriched || null,
      },
      raw: rawResponse,
    };
  } catch (err) {
    console.error('❌ Perplexity enrichment error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * 將充實結果寫入資料庫
 * @param {Pool} pool - PostgreSQL 連線池
 * @param {number} candidateId - 候選人 ID
 * @param {Object} enrichData - enrichCandidate 回傳的 data
 * @param {string} actor - 操作者
 * @returns {Object} 更新結果
 */
async function saveEnrichment(pool, candidateId, enrichData, actor) {
  const {
    work_history,
    education_details,
    years_experience,
    stability_score,
    job_changes,
    avg_tenure_months,
    leaving_reason,
    personality_type,
    summary,
    skills_enriched,
  } = enrichData;

  // 組合 AI 分析結果文字
  const aiNotes = [];
  if (summary) aiNotes.push(`📋 AI 摘要: ${summary}`);
  if (leaving_reason) aiNotes.push(`💡 離職動機: ${leaving_reason}`);
  if (skills_enriched) aiNotes.push(`🔧 補充技能: ${skills_enriched}`);
  const aiNotesStr = aiNotes.join('\n');

  const result = await pool.query(
    `UPDATE candidates_pipeline SET
      work_history = COALESCE($1, work_history),
      education_details = COALESCE($2, education_details),
      years_experience = CASE WHEN $3::text != '' AND $3::text != '0' THEN $3 ELSE COALESCE(NULLIF(years_experience, ''), NULLIF(years_experience, '0'), $3) END,
      stability_score = CASE WHEN $4::text != '' AND $4::text != '0' THEN $4 ELSE COALESCE(NULLIF(stability_score, ''), NULLIF(stability_score, '0'), $4) END,
      job_changes = CASE WHEN $5::text != '' AND $5::text != '0' THEN $5 ELSE COALESCE(NULLIF(job_changes, ''), NULLIF(job_changes, '0'), $5) END,
      avg_tenure_months = CASE WHEN $6::text != '' AND $6::text != '0' THEN $6 ELSE COALESCE(NULLIF(avg_tenure_months, ''), NULLIF(avg_tenure_months, '0'), $6) END,
      leaving_reason = COALESCE(NULLIF($7, ''), leaving_reason),
      personality_type = COALESCE(NULLIF($8, ''), personality_type),
      notes = CASE WHEN $9 = '' THEN notes ELSE CONCAT(notes, CASE WHEN notes != '' THEN E'\n---\n' ELSE '' END, $9) END,
      skills = CASE WHEN $10 != '' THEN CONCAT(skills, CASE WHEN skills != '' THEN '、' ELSE '' END, $10) ELSE skills END,
      education = COALESCE(NULLIF(education, ''), $11),
      updated_at = NOW()
    WHERE id = $12
    RETURNING id, name, years_experience, stability_score, job_changes, personality_type`,
    [
      work_history ? JSON.stringify(work_history) : null,
      education_details ? JSON.stringify(education_details) : null,
      String(years_experience || ''),
      String(stability_score || ''),
      String(job_changes || ''),
      String(avg_tenure_months || ''),
      leaving_reason || '',
      personality_type || '',
      aiNotesStr,
      skills_enriched || '',
      // 從 education_details 提取最高學歷
      education_details?.length
        ? `${education_details[0].school || ''} ${education_details[0].degree || ''} ${education_details[0].major || ''}`.trim()
        : '',
      candidateId,
    ]
  );

  // 寫入操作日誌
  try {
    await pool.query(
      `INSERT INTO system_logs (action, actor, actor_type, detail)
       VALUES ($1, $2, $3, $4)`,
      [
        'PERPLEXITY_ENRICH',
        actor || 'System',
        'AIBOT',
        JSON.stringify({
          candidate_id: candidateId,
          fields_enriched: Object.entries(enrichData)
            .filter(([_, v]) => v != null)
            .map(([k]) => k),
        }),
      ]
    );
  } catch (logErr) {
    console.warn('⚠️ enrich log failed:', logErr.message);
  }

  return result.rows[0] || null;
}

/**
 * 最後手段：用 regex 從原始文字中逐欄位提取
 * @param {string} raw - Perplexity 原始回應
 * @returns {Object} 盡可能提取的欄位
 */
function extractFieldsWithRegex(raw) {
  const result = {};

  // 提取字串欄位
  const strFields = ['leaving_reason', 'personality_type', 'summary', 'skills_enriched'];
  for (const field of strFields) {
    const m = raw.match(new RegExp(`"${field}"\\s*:\\s*"([^"]*(?:\\\\"[^"]*)*)"`, 's'));
    if (m) result[field] = m[1].replace(/\\"/g, '"');
  }

  // 提取數字欄位
  const numFields = ['years_experience', 'stability_score', 'job_changes', 'avg_tenure_months'];
  for (const field of numFields) {
    const m = raw.match(new RegExp(`"${field}"\\s*:\\s*(\\d+(?:\\.\\d+)?)`));
    if (m) result[field] = Number(m[1]);
  }

  // 提取 work_history 陣列 — 嘗試找到完整 JSON 陣列
  const whMatch = raw.match(/"work_history"\s*:\s*(\[[\s\S]*?\])\s*(?:,\s*")/);
  if (whMatch) {
    try {
      result.work_history = JSON.parse(whMatch[1]);
    } catch {
      // 無法解析就跳過
    }
  }

  // 提取 education_details 陣列
  const edMatch = raw.match(/"education_details"\s*:\s*(\[[\s\S]*?\])\s*(?:,\s*")/);
  if (edMatch) {
    try {
      result.education_details = JSON.parse(edMatch[1]);
    } catch {
      // 無法解析就跳過
    }
  }

  console.log('📦 Regex extracted fields:', Object.keys(result));
  return result;
}

module.exports = { enrichCandidate, saveEnrichment, callPerplexity };
