#!/usr/bin/env node
/**
 * 一次性回填：將 notes 含評分文字的候選人，解析並寫入 ai_match_result
 */
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL ||
  'postgresql://root:etUh2zkR4Mr8gfWLs059S7Dm1T6Yby3Q@tpe1.clusters.zeabur.com:27883/zeabur';

const pool = new Pool({ connectionString: DATABASE_URL });

function parseNotes(notesText, actor) {
  if (!notesText || !/\d+\/100/.test(notesText)) return null;

  try {
    const scoreMatch = notesText.match(/(\d+)\/100/);
    if (!scoreMatch) return null;
    const score = parseInt(scoreMatch[1]);

    const recommendation =
      score >= 85 ? '強力推薦' :
      score >= 70 ? '推薦' :
      score >= 55 ? '觀望' : '不推薦';

    const jobTitleMatch = notesText.match(/職位[：:]\s*(.+)/);
    const job_title = jobTitleMatch ? jobTitleMatch[1].trim() : undefined;

    const skillsMatch = notesText.match(/技能[：:]\s*(.+)/);
    const skillsRaw = skillsMatch
      ? skillsMatch[1].split(/[,，、]/).map(s => s.trim()).filter(Boolean)
      : [];

    const dimScores = {};
    const dimRegex = /([^\n:：]{2,8})\s*\(\d+%\)[：:]\s*(\d+)\/(\d+)/g;
    let m;
    while ((m = dimRegex.exec(notesText)) !== null) {
      dimScores[m[1].trim()] = parseInt(m[2]) / parseInt(m[3]);
    }

    const skillMatchRatio = dimScores['技能匹配'] || dimScores['技能'] || 0.7;
    const matchedCount = Math.ceil(skillsRaw.length * Math.min(skillMatchRatio + 0.1, 1));
    const matched_skills = skillsRaw.slice(0, matchedCount);
    const missing_skills = skillsRaw.slice(matchedCount);

    const strengths = Object.entries(dimScores)
      .filter(([, r]) => r >= 0.8)
      .map(([dim, r]) => `${dim}符合度高（${Math.round(r * 100)}%）`);
    if (strengths.length === 0 && score >= 70) strengths.push('整體評分良好，具備基本條件');

    const probing_questions = [];
    if ((dimScores['技能匹配'] || 1) < 0.8) probing_questions.push('目前主力技術棧為何？是否有補足相關技能的計劃？');
    probing_questions.push('期望薪資與可到職時間？');
    probing_questions.push('離開現職的主要考量為何？');
    probing_questions.push('是否同時面試其他機會？');

    const liMatch = notesText.match(/LinkedIn[：:\s]+(https?:\/\/\S+)/i);

    return {
      score,
      recommendation,
      job_title,
      matched_skills,
      missing_skills,
      strengths,
      probing_questions,
      conclusion: notesText.trim(),
      evaluated_at: new Date().toISOString(),
      evaluated_by: actor || '一通數位 AIbot',
      _linkedin_url: liMatch ? liMatch[1] : null,
    };
  } catch (e) {
    console.error('parse error:', e.message);
    return null;
  }
}

async function main() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`
      SELECT id, name, notes, recruiter
      FROM candidates_pipeline
      WHERE notes ~ '\\d+/100'
        AND ai_match_result IS NULL
      ORDER BY id
    `);

    console.log(`找到 ${rows.length} 筆需要回填`);

    let success = 0;
    for (const row of rows) {
      const parsed = parseNotes(row.notes, '一通數位 AIbot');
      if (!parsed) {
        console.log(`  ✗ #${row.id} ${row.name} 解析失敗`);
        continue;
      }

      const li = parsed._linkedin_url;
      delete parsed._linkedin_url;

      const updates = [`ai_match_result = $1`, `updated_at = NOW()`];
      const vals = [JSON.stringify(parsed), row.id];

      if (li) {
        updates.splice(1, 0, `linkedin_url = $2`);
        vals.splice(1, 0, li);
        vals[vals.length - 1] = row.id;  // re-set id position
        await client.query(
          `UPDATE candidates_pipeline SET ai_match_result = $1, linkedin_url = $2, updated_at = NOW() WHERE id = $3`,
          [JSON.stringify(parsed), li, row.id]
        );
      } else {
        await client.query(
          `UPDATE candidates_pipeline SET ai_match_result = $1, updated_at = NOW() WHERE id = $2`,
          [JSON.stringify(parsed), row.id]
        );
      }

      console.log(`  ✓ #${row.id} ${row.name} → 評分 ${parsed.score} (${parsed.recommendation})`);
      success++;
    }

    console.log(`\n完成：${success}/${rows.length} 筆回填成功`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
