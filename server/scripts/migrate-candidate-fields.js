/**
 * migrate-candidate-fields.js
 * Sprint 1: Backfill structured fields for all existing candidates.
 *
 * Usage:
 *   node migrate-candidate-fields.js --dry-run    # Preview changes (no DB writes)
 *   node migrate-candidate-fields.js              # Execute migration
 *
 * What it does:
 * 1. skills → normalized_skills (using skill taxonomy)
 * 2. current_salary / expected_salary → min/max integers
 * 3. current_position → current_title
 * 4. work_history[0].company → current_company
 * 5. years_experience → total_years
 * 6. notice_period → notice_period_enum
 * 7. job_search_status → job_search_status_enum
 * 8. education_details → education_level + education_summary
 * 9. work_history → auto_derived (jobChanges, avgTenure, lastGap, stabilityScore)
 * 10. talent_level (S/A+/A/B/C) → grade_level (A/B/C/D)
 * 11. Compute data_quality for each candidate
 * 12. Compute heat_level from job_search_status + lastContactAt
 */

const { pool } = require('../db');
const {
  normalizeSkillsArray,
  parseSalaryText,
  parseNoticePeriod,
  parseJobSearchStatus,
  computeAutoDerived,
  computeDataQuality,
} = require('../taxonomy/matchSkills');

const DRY_RUN = process.argv.includes('--dry-run');

async function migrate() {
  console.log(`\n========== Step1ne Candidate Field Migration ==========`);
  console.log(`Mode: ${DRY_RUN ? '🔍 DRY RUN (no writes)' : '🚀 LIVE MIGRATION'}\n`);

  // Fetch all candidates
  const { rows } = await pool.query(`
    SELECT id, name, current_position, skills, years_experience,
           current_salary, expected_salary, notice_period, job_search_status,
           work_history, education_details, talent_level, notes,
           last_updated, consultant_note
    FROM candidates_pipeline
    ORDER BY id
  `);

  console.log(`Found ${rows.length} candidates to process.\n`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;
  const issues = [];

  for (const row of rows) {
    try {
      const updates = {};

      // 1. skills → normalized_skills
      if (row.skills) {
        const normalized = normalizeSkillsArray(row.skills);
        if (normalized.length > 0) {
          updates.normalized_skills = JSON.stringify(normalized);
        }
      }

      // 2. current_salary → current_salary_min/max
      if (row.current_salary) {
        const parsed = parseSalaryText(row.current_salary);
        if (parsed.min != null) {
          updates.current_salary_min = parsed.min;
          updates.current_salary_max = parsed.max || parsed.min;
          updates.salary_currency = parsed.currency;
          updates.salary_period = parsed.period;
        }
      }

      // 2b. expected_salary → expected_salary_min/max
      if (row.expected_salary) {
        const parsed = parseSalaryText(row.expected_salary);
        if (parsed.min != null) {
          updates.expected_salary_min = parsed.min;
          updates.expected_salary_max = parsed.max || parsed.min;
        }
      }

      // 3. current_position → current_title
      if (row.current_position) {
        updates.current_title = row.current_position;
      }

      // 4. work_history[0].company → current_company
      let workHistory = null;
      if (row.work_history) {
        try {
          workHistory = typeof row.work_history === 'string'
            ? JSON.parse(row.work_history)
            : row.work_history;
          if (Array.isArray(workHistory) && workHistory.length > 0) {
            updates.current_company = workHistory[0].company || null;
          }
        } catch { /* ignore parse errors */ }
      }

      // 5. years_experience → total_years
      if (row.years_experience != null) {
        updates.total_years = parseFloat(row.years_experience) || 0;
      }

      // 6. notice_period → notice_period_enum
      if (row.notice_period) {
        const np = parseNoticePeriod(row.notice_period);
        if (np) updates.notice_period_enum = np;
      }

      // 7. job_search_status → job_search_status_enum
      if (row.job_search_status) {
        const jss = parseJobSearchStatus(row.job_search_status);
        if (jss) updates.job_search_status_enum = jss;
      }

      // 8. education_details → education_level + education_summary
      if (row.education_details) {
        try {
          const edu = typeof row.education_details === 'string'
            ? JSON.parse(row.education_details)
            : row.education_details;
          if (Array.isArray(edu) && edu.length > 0) {
            // Extract highest education level
            const levelOrder = { '博士': 4, 'PhD': 4, '碩士': 3, 'Master': 3, 'MBA': 3, '大學': 2, 'Bachelor': 2, '專科': 1 };
            let highestLevel = null;
            let highestScore = 0;
            for (const e of edu) {
              const deg = e.degree || '';
              for (const [level, score] of Object.entries(levelOrder)) {
                if (deg.includes(level) && score > highestScore) {
                  highestLevel = level;
                  highestScore = score;
                }
              }
            }
            if (highestLevel) updates.education_level = highestLevel;

            // Generate summary
            const summary = edu.map(e => {
              const parts = [e.school, e.degree, e.major].filter(Boolean);
              return parts.join(' ');
            }).join(' | ');
            if (summary) updates.education_summary = summary;
          }
        } catch { /* ignore */ }
      }

      // 9. work_history → auto_derived
      if (Array.isArray(workHistory) && workHistory.length > 0) {
        const derived = computeAutoDerived(workHistory);
        updates.auto_derived = JSON.stringify(derived);
      }

      // 10. talent_level → grade_level
      if (row.talent_level) {
        const tl = row.talent_level.trim().toUpperCase();
        if (tl === 'S' || tl === 'A+') updates.grade_level = 'A';
        else if (tl === 'A') updates.grade_level = 'B';
        else if (tl === 'B') updates.grade_level = 'C';
        else if (tl === 'C' || tl === 'D') updates.grade_level = 'D';
      }

      // 11. Compute heat_level
      const jssEnum = updates.job_search_status_enum || null;
      if (jssEnum === 'active') {
        updates.heat_level = 'Hot';
      } else if (jssEnum === 'passive') {
        // Check last contact date
        const lastContact = row.last_updated ? new Date(row.last_updated) : null;
        const daysSince = lastContact ? Math.floor((Date.now() - lastContact) / (1000 * 60 * 60 * 24)) : 999;
        updates.heat_level = daysSince <= 14 ? 'Warm' : 'Cold';
      } else if (jssEnum === 'not_open') {
        updates.heat_level = 'Cold';
      }

      // 12. Compute data_quality
      const combined = { ...row, ...updates };
      const quality = computeDataQuality(combined);
      updates.data_quality = JSON.stringify(quality);

      // Check if there are any updates
      const updateKeys = Object.keys(updates);
      if (updateKeys.length === 0) {
        skipped++;
        continue;
      }

      if (DRY_RUN) {
        console.log(`[DRY RUN] #${row.id} ${row.name || '(unnamed)'}: ${updateKeys.length} fields`);
        if (updates.normalized_skills) {
          console.log(`  skills: "${(row.skills || '').substring(0, 50)}" → ${updates.normalized_skills.substring(0, 80)}`);
        }
        if (updates.current_salary_min != null) {
          console.log(`  salary: "${row.current_salary}" → ${updates.current_salary_min}~${updates.current_salary_max} ${updates.salary_currency || 'TWD'}`);
        }
        if (updates.grade_level) {
          console.log(`  grade: "${row.talent_level}" → ${updates.grade_level}`);
        }
        updated++;
        continue;
      }

      // Build SQL UPDATE
      const setClauses = [];
      const values = [];
      let idx = 1;
      for (const [key, value] of Object.entries(updates)) {
        setClauses.push(`${key} = $${idx}`);
        values.push(value);
        idx++;
      }
      values.push(row.id);

      await pool.query(
        `UPDATE candidates_pipeline SET ${setClauses.join(', ')} WHERE id = $${idx}`,
        values
      );

      updated++;
      if (updated % 50 === 0) {
        console.log(`  ...processed ${updated}/${rows.length}`);
      }
    } catch (err) {
      errors++;
      issues.push({ id: row.id, name: row.name, error: err.message });
      console.error(`  Error processing #${row.id} ${row.name}: ${err.message}`);
    }
  }

  console.log(`\n========== Migration Summary ==========`);
  console.log(`Total candidates: ${rows.length}`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped (no changes): ${skipped}`);
  console.log(`Errors: ${errors}`);
  if (issues.length > 0) {
    console.log(`\nIssues:`);
    issues.forEach(i => console.log(`  #${i.id} ${i.name}: ${i.error}`));
  }
  console.log(`\n${DRY_RUN ? '🔍 This was a DRY RUN. No changes were made.' : '✅ Migration complete.'}\n`);
}

migrate()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
