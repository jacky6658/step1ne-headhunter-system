#!/usr/bin/env python3
"""
claude-conclusion-generator.py
使用本機安裝的 Claude Code CLI（claude -p）產生候選人 AI 評估結語

用法：
  from claude_conclusion_generator import generate_conclusion

  conclusion = generate_conclusion(
      candidate={"name": "陳宥樺", "score": 82, "skills": ["Python", "Go"], ...},
      job={"title": "Senior Backend Engineer", "company": "某科技公司", ...},
      scoring_result=scoring_result_dict,  # 來自 candidate-scoring-system-v2.py
  )

前提：
  - 本機已安裝 Claude Code CLI：npm install -g @anthropic-ai/claude-code
  - 已登入：claude login（或設定 ANTHROPIC_API_KEY 環境變數）
  - 執行 `claude -p "hello"` 能正常回應

成本：
  - 使用你的 Claude Code 訂閱額度，不額外付費
  - 或使用 API Key（pay-per-token，每次約 NT$0.5-2 元）
"""

import subprocess
import json
import sys
import os
from typing import Optional, Dict, Any


# ─── 設定 ───────────────────────────────────────────────
CLAUDE_MODEL   = os.getenv('CLAUDE_MODEL', 'claude-sonnet-4-6')  # 可改 haiku 節省額度
TIMEOUT_SECS   = int(os.getenv('CLAUDE_TIMEOUT', '60'))
MAX_RETRIES    = 1


# ─── 主函數 ─────────────────────────────────────────────

def generate_conclusion(
    candidate: Dict[str, Any],
    job: Dict[str, Any],
    scoring_result: Optional[Dict[str, Any]] = None,
) -> Optional[str]:
    """
    呼叫 Claude Code CLI 產生候選人評估結語。
    成功時回傳結語字串；失敗時回傳 None（不中斷評分流程）。
    """
    prompt = _build_prompt(candidate, job, scoring_result)

    for attempt in range(1, MAX_RETRIES + 2):
        result = _call_claude_cli(prompt)
        if result is not None:
            return result.strip()
        if attempt <= MAX_RETRIES:
            print(f"  ⚠️  Claude CLI 第 {attempt} 次失敗，重試...")

    print("  ⚠️  Claude CLI 無法使用，改用模板結語")
    return _template_conclusion(candidate, job, scoring_result)


# ─── CLI 呼叫 ────────────────────────────────────────────

def _call_claude_cli(prompt: str) -> Optional[str]:
    """執行 claude -p 並回傳純文字回應"""
    try:
        # 移除 CLAUDECODE 環境變數，避免「nested session」錯誤
        env = {k: v for k, v in os.environ.items() if k != 'CLAUDECODE'}
        proc = subprocess.run(
            ['claude', '-p', prompt,
             '--model', CLAUDE_MODEL,
             '--output-format', 'text'],
            capture_output=True,
            text=True,
            timeout=TIMEOUT_SECS,
            env=env,
        )
        if proc.returncode == 0 and proc.stdout.strip():
            return proc.stdout.strip()
        # 印出錯誤供除錯
        if proc.stderr:
            print(f"  claude stderr: {proc.stderr[:200]}")
        return None
    except FileNotFoundError:
        print("  ❌ 找不到 claude 指令。請確認已安裝：npm install -g @anthropic-ai/claude-code")
        return None
    except subprocess.TimeoutExpired:
        print(f"  ❌ Claude CLI 超時（{TIMEOUT_SECS}s）")
        return None
    except Exception as e:
        print(f"  ❌ Claude CLI 例外：{e}")
        return None


# ─── Prompt 建構 ─────────────────────────────────────────

def _build_prompt(
    candidate: Dict,
    job: Dict,
    scoring_result: Optional[Dict],
) -> str:
    """組合完整的評估提示詞（繁體中文獵頭顧問語氣）"""

    name     = candidate.get('name', '（未知）')
    position = candidate.get('position', '')
    years    = candidate.get('years_experience', '—')
    location = candidate.get('location', '—')
    skills   = ', '.join(candidate.get('skills', [])) or '—'
    companies = ', '.join(candidate.get('company_background', [])) or '—'
    education = candidate.get('education', '—')

    job_title   = job.get('title', job.get('position_name', '（職缺）'))
    job_company = job.get('company', job.get('client_company', '（公司）'))
    req_skills  = ', '.join(job.get('required_skills', [])) or '—'
    req_years   = job.get('years_required', '—')

    scores_block = ''
    signal_block = ''
    if scoring_result:
        s = scoring_result.get('scores', {})
        scores_block = f"""
評分明細（滿分 100）：
  綜合得分：{scoring_result.get('overall_score', '—')} 分 【{scoring_result.get('talent_level', '—')}】
  技能匹配：{s.get('skill_match', '—')}  年資符合：{s.get('experience_fit', '—')}
  地點適配：{s.get('location_fit', '—')}  求職意願：{s.get('hiring_signal', '—')}
  公司等級：{s.get('company_level', '—')}  產業經驗：{s.get('industry_experience', '—')}
優勢：{'; '.join(scoring_result.get('strengths', []))}
待確認：{'; '.join(scoring_result.get('weaknesses', []))}"""

        breakdown = scoring_result.get('hiring_signal_breakdown', {})
        triggered = [v['label'] for v in breakdown.values() if v.get('triggered')]
        if triggered:
            signal_block = f"求職信號：{'; '.join(triggered[:4])}"

    prompt = f"""你是一位資深獵頭顧問，請用繁體中文為以下候選人撰寫一份簡短的 AI 評估結語（150-250字），
供顧問決定是否優先聯繫此候選人使用。語氣專業、直接、重點式。

【目標職缺】
職位：{job_title}
公司：{job_company}
需求技能：{req_skills}
要求年資：{req_years} 年

【候選人資料】
姓名：{name}
現職：{position}
年資：{years} 年
地點：{location}
技能：{skills}
前公司：{companies}
學歷：{education}
{scores_block}
{signal_block}

請包含：
1. 候選人與職缺的整體適配結論（1-2句）
2. 最值得關注的 1-2 個亮點
3. 需要顧問確認或注意的 1 個重點
4. 建議是否優先聯繫（強力推薦 / 推薦 / 觀望 / 暫不推薦）

只輸出結語內容，不需要標題或 markdown 格式。"""
    return prompt


# ─── 模板備援（Claude CLI 不可用時）─────────────────────

def _template_conclusion(
    candidate: Dict,
    job: Dict,
    scoring_result: Optional[Dict],
) -> str:
    """純模板結語，不需 AI，作為備援"""
    name      = candidate.get('name', '此候選人')
    job_title = job.get('title', job.get('position_name', '目標職位'))
    score     = scoring_result.get('overall_score', 0) if scoring_result else 0
    level     = scoring_result.get('talent_level', 'B') if scoring_result else 'B'
    strengths = scoring_result.get('strengths', []) if scoring_result else []
    weaknesses= scoring_result.get('weaknesses', []) if scoring_result else []

    if score >= 85:
        rec = '強力推薦'
        opener = f"{name} 與{job_title}高度契合"
    elif score >= 70:
        rec = '推薦'
        opener = f"{name} 具備擔任{job_title}的核心條件"
    elif score >= 55:
        rec = '觀望'
        opener = f"{name} 部分條件符合{job_title}需求，建議進一步確認"
    else:
        rec = '暫不推薦'
        opener = f"{name} 目前與{job_title}匹配度偏低"

    strength_text = f"主要優勢：{strengths[0]}" if strengths else ''
    weakness_text = f"待確認：{weaknesses[0]}" if weaknesses else ''

    return (
        f"{opener}（綜合評分 {score:.0f}/100，等級 {level}）。"
        f"{strength_text}。{weakness_text}。"
        f"建議：{rec}。"
    )


# ─── 獨立測試 ────────────────────────────────────────────

if __name__ == '__main__':
    print("測試 Claude Code CLI 結語生成...\n")

    test_candidate = {
        'name': '陳宥樺',
        'position': 'Senior Backend Engineer',
        'years_experience': 7,
        'location': '台北',
        'skills': ['Python', 'Go', 'Kubernetes', 'PostgreSQL'],
        'company_background': ['Shopee', 'LINE Taiwan'],
        'education': '台大資工碩士',
        'notes': '剛離職，Open to Work',
        'quit_reasons': '想挑戰更大規模系統',
    }

    test_job = {
        'title': 'Senior Backend Engineer',
        'company': '某 FinTech 獨角獸',
        'required_skills': ['Python', 'Go', 'Kubernetes'],
        'years_required': 5,
    }

    test_scores = {
        'overall_score': 82.5,
        'talent_level': 'A',
        'scores': {
            'skill_match': 90.0,
            'experience_fit': 85.0,
            'location_fit': 100.0,
            'hiring_signal': 97.0,
            'company_level': 85.0,
            'industry_experience': 70.0,
        },
        'strengths': ['技能契合度高 (90%)', '求職意願明確（剛離職 2 個月）'],
        'weaknesses': [],
        'hiring_signal_breakdown': {
            'gap': {'label': '剛離職 2 個月', 'delta': 30, 'triggered': True},
            'open_to_work': {'label': 'Open to Work 關鍵字', 'delta': 22, 'triggered': True},
        }
    }

    conclusion = generate_conclusion(test_candidate, test_job, test_scores)

    print("=" * 60)
    print("AI 評估結語：")
    print("=" * 60)
    print(conclusion)
    print("=" * 60)
