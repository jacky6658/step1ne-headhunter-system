/**
 * aiAnalysisValidator.js - AI 顧問分析結果 schema 驗證
 *
 * 共用於 routes-ai-agent.js 和 routes-crawler.js
 */

function validateAiAnalysisSchema(ai_analysis) {
  const errors = [];
  if (ai_analysis.version !== '1.0') errors.push('version 必須是 "1.0"');
  if (!ai_analysis.analyzed_at) errors.push('缺少 analyzed_at');
  if (!ai_analysis.analyzed_by) errors.push('缺少 analyzed_by');
  if (!ai_analysis.candidate_evaluation) {
    errors.push('缺少 candidate_evaluation');
  } else {
    if (!ai_analysis.candidate_evaluation.career_curve) errors.push('缺少 candidate_evaluation.career_curve');
    if (!ai_analysis.candidate_evaluation.personality) errors.push('缺少 candidate_evaluation.personality');
    if (!ai_analysis.candidate_evaluation.role_positioning) errors.push('缺少 candidate_evaluation.role_positioning');
    if (!ai_analysis.candidate_evaluation.salary_estimate) errors.push('缺少 candidate_evaluation.salary_estimate');
  }
  if (!Array.isArray(ai_analysis.job_matchings)) {
    errors.push('job_matchings 必須是陣列');
  } else if (ai_analysis.job_matchings.length > 3) {
    errors.push('job_matchings 最多 3 個職缺');
  } else {
    ai_analysis.job_matchings.forEach((m, i) => {
      if (typeof m.match_score !== 'number' || m.match_score < 0 || m.match_score > 100) {
        errors.push(`job_matchings[${i}].match_score 必須是 0-100 的數字`);
      }
      if (Array.isArray(m.must_have)) {
        m.must_have.forEach((h, j) => {
          if (!['pass', 'warning', 'fail'].includes(h.result)) {
            errors.push(`job_matchings[${i}].must_have[${j}].result 只能是 pass/warning/fail`);
          }
        });
      }
      if (Array.isArray(m.nice_to_have)) {
        m.nice_to_have.forEach((h, j) => {
          if (!['pass', 'warning', 'fail'].includes(h.result)) {
            errors.push(`job_matchings[${i}].nice_to_have[${j}].result 只能是 pass/warning/fail`);
          }
        });
      }
    });
  }
  if (!ai_analysis.recommendation) errors.push('缺少 recommendation');

  if (ai_analysis.consultant_questions) {
    const cq = ai_analysis.consultant_questions;
    if (!Array.isArray(cq.questions)) {
      errors.push('consultant_questions.questions 必須是陣列');
    } else {
      if (cq.questions.length < 5 || cq.questions.length > 15) {
        errors.push('consultant_questions.questions 建議 5-15 題');
      }
      const validCategories = [
        'career_motivation', 'current_satisfaction', 'technical_depth',
        'management_style', 'salary_expectation', 'culture_preference',
        'work_life_balance', 'long_term_goal', 'market_awareness',
        'collaboration_style', 'job_exploration'
      ];
      cq.questions.forEach((q, i) => {
        if (!q.question) errors.push(`consultant_questions.questions[${i}] 缺少 question`);
        if (!q.why_ask) errors.push(`consultant_questions.questions[${i}] 缺少 why_ask`);
        if (q.category && !validCategories.includes(q.category)) {
          errors.push(`consultant_questions.questions[${i}].category "${q.category}" 不在允許清單`);
        }
        if (q.related_jobs && !Array.isArray(q.related_jobs)) {
          errors.push(`consultant_questions.questions[${i}].related_jobs 必須是陣列`);
        }
      });
    }
  }

  return errors;
}

module.exports = { validateAiAnalysisSchema };
