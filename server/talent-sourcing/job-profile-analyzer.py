#!/usr/bin/env python3
"""
job-profile-analyzer.py
使用 Claude Code CLI 分析職缺，產生多角度人才搜尋策略

適用所有職位類型：工程師 / 業務 / 設計師 / 行銷 / 財務 / HR / 管理職 ...
Claude 會根據 JD 內容舉一反三，不依賴寫死的關鍵字表

輸出：
  {
    "role_type":          "backend_engineer",
    "primary_keywords":   ["Python", "Backend"],          ← AND
    "secondary_keywords": ["Go", "Node.js", "FastAPI"],   ← OR
    "title_variants":     ["Backend Engineer", "Server Engineer"],
    "search_angles": [                                     ← 多角度搜尋
      { "description": "語言技術棧角度",
        "primary":   ["Python"],
        "secondary": ["Go", "Golang", "Node.js"] },
      { "description": "框架/平台角度",
        "primary":   ["FastAPI", "Backend"],
        "secondary": ["Django", "Flask", "REST API"] }
    ]
  }

使用：
  from job_profile_analyzer import analyze_job_for_search
  strategy = analyze_job_for_search(job_dict)
"""

import subprocess
import json
import re
import os
from typing import Dict, List, Optional

# 使用 haiku 節省額度（分析任務不需要複雜推理）
CLAUDE_MODEL   = os.getenv('CLAUDE_MODEL_ANALYZE', 'claude-haiku-4-5-20251001')
TIMEOUT_SECS   = int(os.getenv('CLAUDE_TIMEOUT', '45'))


# ─── 主函數 ─────────────────────────────────────────────────────────────────

def analyze_job_for_search(job: Dict, use_claude: bool = True) -> Dict:
    """
    分析職缺產生搜尋策略。
    use_claude=True：呼叫 Claude 動態分析（推薦）
    use_claude=False：使用 required_skills 直接建立基本策略（離線備援）
    """
    if use_claude:
        prompt = _build_prompt(job)
        raw = _call_claude(prompt)
        if raw:
            return _parse_result(raw, job)

    # fallback：直接用 required_skills 建立基本策略
    return _fallback_strategy(job)


# ─── Prompt 建構 ─────────────────────────────────────────────────────────────

def _build_prompt(job: Dict) -> str:
    title       = job.get('title', '（未命名）')
    company     = job.get('company', '（未知公司）')
    skills_raw  = job.get('required_skills', [])
    skills_str  = ', '.join(skills_raw) if skills_raw else '（未指定）'
    years       = job.get('years_required', '不限')
    description = (job.get('description', '') or '')[:600]
    location    = job.get('location', '台灣')

    return f"""你是一位資深獵頭顧問，專精台灣人才市場。
請分析以下職缺，為 LinkedIn/GitHub 人才搜尋產生最佳策略。

職位可能是任何類型（後端工程師、前端、全端、DevOps、資料科學、AI/ML、
業務、BD、行銷、設計師、PM、財務、HR、管理職等），請根據實際職位舉一反三。

【職缺資訊】
職位名稱：{title}
公司：{company}
地點：{location}
要求技能/條件：{skills_str}
年資要求：{years} 年以上
職缺描述：{description if description else '（未提供，請根據職位名稱推斷）'}

請輸出以下 JSON 格式（只輸出 JSON，不要任何額外說明或 markdown）：
{{
  "role_type": "職位類型（從這些選一個：backend_engineer / frontend_engineer / fullstack / data_engineer / devops_sre / mobile_engineer / ai_ml / embedded / cybersecurity / product_manager / designer_ui_ux / sales / business_development / marketing / data_analyst / finance / hr / management / other）",
  "primary_keywords": ["最核心必備關鍵字1", "最核心必備關鍵字2"],
  "secondary_keywords": ["次要關鍵字1", "次要關鍵字2", "次要關鍵字3", "次要關鍵字4"],
  "title_variants": ["職稱變體1", "職稱變體2", "職稱變體3"],
  "search_angles": [
    {{
      "description": "角度1的說明（用什麼思路搜）",
      "primary": ["主關鍵字A", "主關鍵字B"],
      "secondary": ["次關鍵字X", "次關鍵字Y", "次關鍵字Z"]
    }},
    {{
      "description": "角度2（不同組合，覆蓋另一群人選）",
      "primary": ["不同主關鍵字"],
      "secondary": ["不同次關鍵字A", "不同次關鍵字B"]
    }},
    {{
      "description": "角度3（可選，最廣泛覆蓋）",
      "primary": ["職稱類關鍵字"],
      "secondary": ["產業關鍵字A", "產業關鍵字B"]
    }}
  ]
}}

設計原則：
• primary_keywords / search_angles.primary：候選人必備（AND），每組最多 2 個
• secondary_keywords / search_angles.secondary：有其中一個即符合（OR），3-6 個
• search_angles：2-3 個不同搜尋角度，不同角度用完全不同的關鍵字組合，
  才能搜出不重疊的人才池
• 關鍵字優先用英文（LinkedIn 為主），中文關鍵字可加在 secondary（台灣在地職位）
• 非工程職位範例：
  - 業務：["Sales", "BD"] + ["業務", "Account Manager", "客戶"]
  - 行銷：["Marketing", "數位行銷"] + ["SEO", "內容行銷", "社群"]
  - 設計師：["UI/UX", "Designer"] + ["Figma", "Sketch", "產品設計"]
  - PM：["Product Manager", "產品經理"] + ["Roadmap", "Agile", "用戶研究"]"""


# ─── Claude CLI 呼叫 ──────────────────────────────────────────────────────────

def _call_claude(prompt: str) -> Optional[str]:
    try:
        env = {k: v for k, v in os.environ.items() if k != 'CLAUDECODE'}
        proc = subprocess.run(
            ['claude', '-p', prompt,
             '--model', CLAUDE_MODEL,
             '--output-format', 'text'],
            capture_output=True, text=True,
            timeout=TIMEOUT_SECS, env=env
        )
        if proc.returncode == 0 and proc.stdout.strip():
            return proc.stdout.strip()
        if proc.stderr:
            print(f"  [analyzer] claude stderr: {proc.stderr[:200]}")
        return None
    except FileNotFoundError:
        print("  [analyzer] claude CLI 未安裝，使用備援策略")
        return None
    except subprocess.TimeoutExpired:
        print(f"  [analyzer] Claude 分析超時（{TIMEOUT_SECS}s），使用備援策略")
        return None
    except Exception as e:
        print(f"  [analyzer] 例外：{e}")
        return None


# ─── 結果解析 ─────────────────────────────────────────────────────────────────

def _parse_result(raw: str, job: Dict) -> Dict:
    """解析 Claude 回傳的 JSON，失敗時回退到 fallback"""
    try:
        m = re.search(r'\{[\s\S]*\}', raw)
        if not m:
            raise ValueError("no JSON block found")
        data = json.loads(m.group())
        # 確保必要欄位存在
        if not data.get('search_angles'):
            raise ValueError("missing search_angles")
        # 確保每個 angle 有 primary 和 secondary
        for angle in data['search_angles']:
            if not angle.get('primary'):
                angle['primary'] = data.get('primary_keywords', [])[:2]
            if not angle.get('secondary'):
                angle['secondary'] = data.get('secondary_keywords', [])
        return data
    except Exception as e:
        print(f"  [analyzer] JSON 解析失敗（{e}），使用備援策略")
        return _fallback_strategy(job)


# ─── 備援策略（Claude 不可用時）──────────────────────────────────────────────

def _fallback_strategy(job: Dict) -> Dict:
    """直接用 required_skills 建立基本搜尋策略"""
    skills = job.get('required_skills', [])
    title  = job.get('title', '')
    return {
        'role_type':          'other',
        'primary_keywords':   skills[:2],
        'secondary_keywords': skills[2:6],
        'title_variants':     [title] if title else [],
        'search_angles': [
            {
                'description': '技能直接搜尋（備援策略）',
                'primary':     skills[:2],
                'secondary':   skills[2:6],
            }
        ]
    }


# ─── 獨立測試 ─────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    import sys

    test_cases = [
        {
            'title': 'Senior Backend Engineer',
            'company': '某 FinTech 獨角獸',
            'required_skills': ['Python', 'Go', 'PostgreSQL', 'Kubernetes'],
            'years_required': 5,
        },
        {
            'title': '資深業務經理',
            'company': '企業軟體新創',
            'required_skills': ['B2B 銷售', 'SaaS', 'CRM'],
            'years_required': 3,
        },
        {
            'title': 'UI/UX Designer',
            'company': '電商平台',
            'required_skills': ['Figma', 'User Research', 'Prototyping'],
            'years_required': 2,
        },
    ]

    job_index = int(sys.argv[1]) if len(sys.argv) > 1 else 0
    test_job = test_cases[job_index % len(test_cases)]

    print(f"\n分析職缺：{test_job['title']}")
    print("─" * 60)
    result = analyze_job_for_search(test_job)
    print(json.dumps(result, ensure_ascii=False, indent=2))
