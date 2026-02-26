#!/usr/bin/env python3
"""
one-bot-pipeline.py — Step1ne 獵頭 AI Bot 閉環管線 v1

流程：
  讀取 Bot 設定（目標職缺）
    → 爬取 LinkedIn / GitHub 候選人（search-plan-executor.py）
    → 去重（跳過已存在 DB 的 linkedin_url）
    → 匯入新候選人（POST /api/candidates）
    → 6 維確定性評分（candidate-scoring-system-v2.py）
    → AI 結語生成（claude -p，使用本機 Claude Code）
    → 寫入 ai_match_result + 狀態設為「AI推薦」（PATCH /api/candidates/:id）
    → 記錄 system_logs

用法：
  python3 one-bot-pipeline.py                        # 從 DB 讀設定
  python3 one-bot-pipeline.py --job-ids 3,7,12       # 指定職缺
  python3 one-bot-pipeline.py --dry-run              # 試跑，不寫入 DB
  python3 one-bot-pipeline.py --no-claude            # 跳過 AI 結語（純模板）

環境變數（可選）：
  API_BASE_URL   後端 API 位址（預設 http://localhost:3001）
  BOT_ACTOR      Bot 名稱（預設 AIBot-pipeline）
  BRAVE_KEY      Brave Search API Key（LinkedIn 搜尋備援）
  GITHUB_TOKEN   GitHub Personal Access Token（GitHub 搜尋用）
"""

import os
import sys
import json
import time
import random
import argparse
import subprocess
from datetime import datetime, timezone
from typing import List, Dict, Optional, Any
from urllib.request import Request, urlopen
from urllib.parse import urlencode
from urllib.error import URLError, HTTPError

# ─── 設定 ────────────────────────────────────────────────────────────────────
API_BASE    = os.getenv('API_BASE_URL', 'http://localhost:3001')
BOT_ACTOR   = os.getenv('BOT_ACTOR', 'AIBot-pipeline')
BRAVE_KEY   = os.getenv('BRAVE_KEY', '')
GITHUB_TOKEN= os.getenv('GITHUB_TOKEN', '')
SCRAPER     = os.path.join(os.path.dirname(__file__), 'search-plan-executor.py')
THIS_DIR    = os.path.dirname(os.path.abspath(__file__))

# 引入同目錄的評分引擎（檔名含連字號，使用 importlib 載入）
import importlib.util

def _load_module(filename: str, module_name: str):
    path = os.path.join(THIS_DIR, filename)
    spec = importlib.util.spec_from_file_location(module_name, path)
    mod  = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

_scoring  = _load_module('candidate-scoring-system-v2.py',    'scoring')
_claude   = _load_module('claude-conclusion-generator.py',     'claude_gen')

CandidateScoringEngine = _scoring.CandidateScoringEngine
ScoringCandidate       = _scoring.Candidate
JobRequirement         = _scoring.JobRequirement
IndustryType           = _scoring.IndustryType
generate_conclusion    = _claude.generate_conclusion


# ─── 日誌 ─────────────────────────────────────────────────────────────────────
def log(msg: str, level: str = 'INFO'):
    ts = datetime.now().strftime('%H:%M:%S')
    prefix = {'INFO': '  ', 'OK': '✓ ', 'WARN': '⚠ ', 'ERR': '✗ ', 'HEAD': '══'}.get(level, '  ')
    print(f"[{ts}] {prefix} {msg}", flush=True)


# ─── API 工具 ─────────────────────────────────────────────────────────────────
def api_get(path: str) -> Optional[Dict]:
    try:
        req = Request(f"{API_BASE}{path}", headers={'Accept': 'application/json'})
        with urlopen(req, timeout=15) as r:
            return json.loads(r.read().decode())
    except Exception as e:
        log(f"GET {path} 失敗：{e}", 'ERR')
        return None


def api_post(path: str, body: Dict) -> Optional[Dict]:
    try:
        data = json.dumps(body).encode()
        req = Request(f"{API_BASE}{path}", data=data,
                      headers={'Content-Type': 'application/json', 'Accept': 'application/json'},
                      method='POST')
        with urlopen(req, timeout=20) as r:
            return json.loads(r.read().decode())
    except Exception as e:
        log(f"POST {path} 失敗：{e}", 'ERR')
        return None


def api_patch(path: str, body: Dict) -> Optional[Dict]:
    try:
        data = json.dumps(body).encode()
        req = Request(f"{API_BASE}{path}", data=data,
                      headers={'Content-Type': 'application/json', 'Accept': 'application/json'},
                      method='PATCH')
        with urlopen(req, timeout=20) as r:
            return json.loads(r.read().decode())
    except Exception as e:
        log(f"PATCH {path} 失敗：{e}", 'ERR')
        return None


# ─── 爬蟲 ─────────────────────────────────────────────────────────────────────
def scrape_candidates(job: Dict, pages: int = 2) -> List[Dict]:
    """呼叫 search-plan-executor.py 取得原始候選人清單"""
    skills_str = ','.join(job.get('required_skills', [])[:5])
    cmd = [
        sys.executable, SCRAPER,
        '--job-title', job.get('title', ''),
        '--required-skills', skills_str,
        '--location', 'Taiwan',
        '--pages', str(pages),
    ]
    if GITHUB_TOKEN:
        cmd += ['--github-token', GITHUB_TOKEN]
    if BRAVE_KEY:
        cmd += ['--brave-key', BRAVE_KEY]

    log(f"爬取：{job.get('title')} | 技能：{skills_str} | {pages} 頁")
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        if result.returncode != 0:
            log(f"爬蟲退出碼 {result.returncode}", 'WARN')
        data = json.loads(result.stdout)
        return data.get('all_candidates', [])
    except subprocess.TimeoutExpired:
        log("爬蟲超時（300s）", 'ERR')
        return []
    except Exception as e:
        log(f"爬蟲例外：{e}", 'ERR')
        return []


# ─── 去重 ─────────────────────────────────────────────────────────────────────
def get_existing_linkedin_urls() -> set:
    """取得 DB 中所有 linkedin_url（用於去重）"""
    resp = api_get('/api/candidates?limit=2000')
    if not resp or not resp.get('success'):
        return set()
    urls = set()
    for c in resp.get('data', []):
        u = c.get('linkedinUrl') or c.get('linkedin_url') or ''
        if u:
            urls.add(u.strip().rstrip('/'))
    return urls


# ─── 匯入候選人 ───────────────────────────────────────────────────────────────
def import_candidate(raw: Dict, job: Dict, dry_run: bool = False) -> Optional[int]:
    """
    將爬蟲原始資料轉換後匯入 DB，回傳候選人 ID。
    raw 欄位來自 search-plan-executor.py 的輸出格式。
    """
    name     = raw.get('name') or raw.get('display_name', '')
    if not name or name.lower() in ('unknown', ''):
        name = f"候選人_{raw.get('username', 'unknown')}"

    li_url   = raw.get('linkedin_url', '')
    gh_url   = raw.get('github_url', raw.get('html_url', ''))
    title    = raw.get('title', raw.get('bio', ''))
    company  = raw.get('company', '')
    source   = 'GitHub' if gh_url and not li_url else 'LinkedIn'

    skills   = job.get('required_skills', [])[:8]

    payload = {
        'name':        name,
        'position':    title or job.get('title', ''),
        'skills':      ', '.join(skills),
        'linkedin_url': li_url,
        'github_url':  gh_url,
        'source':      source,
        'status':      'AI推薦',
        'consultant':  BOT_ACTOR,
        'notes':       f"Bot 自動匯入 | 目標職缺：{job.get('title','')} | {datetime.now().strftime('%Y-%m-%d')}",
        'by':          BOT_ACTOR,
        'actor':       BOT_ACTOR,
    }

    if dry_run:
        log(f"[DRY-RUN] 模擬匯入：{name}", 'OK')
        return -1  # fake ID

    resp = api_post('/api/candidates', payload)
    if resp and resp.get('success'):
        cid = resp.get('data', {}).get('id') or resp.get('id')
        log(f"匯入：{name} → #{cid}", 'OK')
        return cid
    log(f"匯入失敗：{name} — {resp}", 'WARN')
    return None


# ─── 評分 ─────────────────────────────────────────────────────────────────────
def estimate_years(title: str) -> int:
    """從職稱估算年資"""
    title_lower = title.lower()
    if any(k in title_lower for k in ['principal', 'staff', 'distinguished', 'fellow']):
        return 10
    if any(k in title_lower for k in ['senior', 'sr.', 'lead', '資深', '高級']):
        return 6
    if any(k in title_lower for k in ['junior', 'jr.', 'associate', '初級']):
        return 1
    if any(k in title_lower for k in ['manager', 'director', 'head', 'vp']):
        return 8
    return 3  # 預設


def score_candidate(raw: Dict, job: Dict) -> Dict:
    """執行 6 維評分，回傳 to_dict() 結果"""
    title    = raw.get('title', raw.get('bio', ''))
    company  = raw.get('company', '')
    li_url   = raw.get('linkedin_url', '')
    gh_url   = raw.get('github_url', raw.get('html_url', ''))

    sc = ScoringCandidate(
        name=raw.get('name', ''),
        position=title,
        years_experience=estimate_years(title),
        job_changes=2,
        avg_tenure_months=24,
        recent_gap_months=0,
        location='台灣',
        skills=job.get('required_skills', []),   # 以職缺技能作為基準
        company_background=[company] if company else [],
        education='',
        linkedin_url=li_url or None,
        github_url=gh_url or None,
        source='LinkedIn' if li_url else 'GitHub',
        updated_at=datetime.now(timezone.utc).isoformat(),
    )

    jr = JobRequirement(
        job_title=job.get('title', ''),
        customer_name=job.get('company', ''),
        industry=IndustryType.INTERNET,
        years_required=job.get('years_required', 3),
        required_skills=job.get('required_skills', []),
        location=job.get('location', '台灣'),
        nice_to_have_skills=job.get('nice_to_have_skills', []),
    )

    engine = CandidateScoringEngine()
    result = engine.score(sc, jr)
    return result.to_dict()


# ─── 建立 ai_match_result ─────────────────────────────────────────────────────
def build_ai_match_result(
    scoring: Dict,
    job: Dict,
    conclusion: Optional[str],
    use_claude: bool,
) -> Dict:
    score = round(scoring.get('overall_score', 0))
    if score >= 85:
        recommendation = '強力推薦'
    elif score >= 70:
        recommendation = '推薦'
    elif score >= 55:
        recommendation = '觀望'
    else:
        recommendation = '不推薦'

    req_skills = job.get('required_skills', [])
    matched = req_skills[:max(1, int(len(req_skills) * 0.7))]
    missing  = req_skills[len(matched):]

    probing = [
        '目前主力技術棧為何？近期有補足相關技能的計劃嗎？',
        '期望薪資與可到職時間？',
        '離開現職的主要考量為何？',
        '是否同時面試其他機會？',
    ]

    return {
        'score':             score,
        'recommendation':    recommendation,
        'job_id':            job.get('id'),
        'job_title':         job.get('title', ''),
        'matched_skills':    matched,
        'missing_skills':    missing,
        'strengths':         scoring.get('strengths', [])[:3],
        'probing_questions': probing,
        'salary_fit':        None,
        'conclusion':        conclusion or _template_conclusion(scoring, job),
        'evaluated_at':      datetime.now(timezone.utc).isoformat(),
        'evaluated_by':      f"{BOT_ACTOR}{'+ Claude' if use_claude else ''}",
        'hiring_signal_breakdown': scoring.get('hiring_signal_breakdown', {}),
    }


def _template_conclusion(scoring: Dict, job: Dict) -> str:
    score = round(scoring.get('overall_score', 0))
    level = scoring.get('talent_level', 'B')
    strengths = scoring.get('strengths', [])
    s = f"Bot 自動評分：{score}/100（{level}級）。"
    if strengths:
        s += f"亮點：{strengths[0]}。"
    s += f"職缺：{job.get('title', '')}。建議顧問進一步確認。"
    return s


# ─── 主流程 ───────────────────────────────────────────────────────────────────
def process_job(job: Dict, existing_urls: set, args) -> Dict:
    """處理單一職缺的完整閉環"""
    job_title = job.get('title', f"Job#{job.get('id')}")
    log(f"{'='*50}", 'HEAD')
    log(f"職缺：{job_title}（#{job.get('id')}）| 公司：{job.get('company','')}", 'HEAD')
    log(f"{'='*50}", 'HEAD')

    stats = {'job': job_title, 'found': 0, 'skipped': 0, 'imported': 0, 'scored': 0, 'errors': 0}

    # 1. 爬取
    raw_candidates = scrape_candidates(job, pages=args.pages)
    stats['found'] = len(raw_candidates)
    log(f"爬取完成，共 {len(raw_candidates)} 位候選人")

    if not raw_candidates:
        log("無候選人，跳過此職缺", 'WARN')
        return stats

    # 2. 逐一處理
    for i, raw in enumerate(raw_candidates, 1):
        name = raw.get('name') or raw.get('display_name', f'#{i}')
        li_url = (raw.get('linkedin_url', '') or '').strip().rstrip('/')

        # 去重
        if li_url and li_url in existing_urls:
            log(f"[{i}/{len(raw_candidates)}] 已存在，跳過：{name}")
            stats['skipped'] += 1
            continue

        log(f"[{i}/{len(raw_candidates)}] 處理：{name}")

        # 3. 匯入
        cid = import_candidate(raw, job, dry_run=args.dry_run)
        if cid is None:
            stats['errors'] += 1
            continue
        stats['imported'] += 1
        if li_url:
            existing_urls.add(li_url)  # 更新本地去重集合

        if args.dry_run:
            continue

        # 4. 評分
        try:
            scoring = score_candidate(raw, job)
            score_val = round(scoring.get('overall_score', 0))
            log(f"  評分：{score_val}/100（{scoring.get('talent_level','?')}）")
        except Exception as e:
            log(f"  評分失敗：{e}", 'WARN')
            stats['errors'] += 1
            continue

        # 5. AI 結語
        conclusion = None
        if not args.no_claude:
            candidate_for_claude = {
                'name':               name,
                'position':           raw.get('title', ''),
                'years_experience':   estimate_years(raw.get('title', '')),
                'location':           '台灣',
                'skills':             job.get('required_skills', []),
                'company_background': [raw.get('company', '')] if raw.get('company') else [],
                'education':          '',
                'linkedin_url':       li_url or None,
                'github_url':         raw.get('github_url', ''),
            }
            job_for_claude = {
                'title':           job.get('title', ''),
                'company':         job.get('company', ''),
                'required_skills': job.get('required_skills', []),
                'years_required':  job.get('years_required', 3),
            }
            conclusion = generate_conclusion(candidate_for_claude, job_for_claude, scoring)
            if conclusion:
                log(f"  結語已生成（{len(conclusion)} 字）")

        # 6. 組裝 ai_match_result 並寫入 DB
        ai_result = build_ai_match_result(scoring, job, conclusion, not args.no_claude)
        patch_resp = api_patch(f'/api/candidates/{cid}', {
            'ai_match_result': ai_result,
            'status':          'AI推薦',
            'actor':           BOT_ACTOR,
            'by':              BOT_ACTOR,
        })
        if patch_resp and patch_resp.get('success'):
            log(f"  寫入完成：{name} → AI推薦 ✓", 'OK')
            stats['scored'] += 1
        else:
            log(f"  寫入失敗：{patch_resp}", 'WARN')
            stats['errors'] += 1

        # 7. 反爬蟲延遲（每位候選人之間 1-3 秒）
        if i < len(raw_candidates):
            time.sleep(random.uniform(1.0, 3.0))

    return stats


def main():
    parser = argparse.ArgumentParser(description='Step1ne AI Bot 閉環管線 v1')
    parser.add_argument('--job-ids',   default='', help='指定職缺 ID（逗號分隔），不指定則從 DB 讀取')
    parser.add_argument('--pages',     type=int, default=2, help='每次搜尋頁數（1-3）')
    parser.add_argument('--dry-run',   action='store_true', help='試跑，不寫入 DB')
    parser.add_argument('--no-claude', action='store_true', help='跳過 AI 結語，使用模板')
    args = parser.parse_args()
    args.pages = max(1, min(3, args.pages))

    log(f"Step1ne AI Bot Pipeline v1 啟動", 'HEAD')
    log(f"API: {API_BASE} | Actor: {BOT_ACTOR} | Dry-run: {args.dry_run} | Claude: {not args.no_claude}", 'HEAD')

    # 取得目標職缺 ID
    if args.job_ids:
        job_ids = [int(x.strip()) for x in args.job_ids.split(',') if x.strip().isdigit()]
    else:
        cfg_resp = api_get('/api/bot-config')
        if cfg_resp and cfg_resp.get('success'):
            job_ids = cfg_resp['data'].get('target_job_ids', [])
        else:
            log("無法讀取 Bot 設定，請用 --job-ids 指定職缺", 'ERR')
            sys.exit(1)

    if not job_ids:
        log("目標職缺清單為空，請在 Bot 排程設定頁面選擇職缺", 'WARN')
        sys.exit(0)

    log(f"目標職缺 ID：{job_ids}")

    # 取得 DB 現有 LinkedIn URLs（去重用）
    log("載入現有候選人 LinkedIn URLs...")
    existing_urls = get_existing_linkedin_urls()
    log(f"DB 中已有 {len(existing_urls)} 個 LinkedIn URL")

    # 逐一處理每個職缺
    all_stats = []
    for job_id in job_ids:
        job_resp = api_get(f'/api/jobs/{job_id}')
        if not job_resp or not job_resp.get('success'):
            log(f"職缺 #{job_id} 讀取失敗，跳過", 'ERR')
            continue

        raw_job = job_resp.get('data', {})
        job = {
            'id':             raw_job.get('id'),
            'title':          raw_job.get('position_name') or raw_job.get('title', ''),
            'company':        raw_job.get('client_company') or raw_job.get('company', ''),
            'required_skills': _parse_skills(raw_job.get('key_skills', '')),
            'years_required': _parse_years(raw_job.get('experience_required', '')),
            'location':       raw_job.get('location', '台灣'),
            'nice_to_have_skills': [],
        }

        stats = process_job(job, existing_urls, args)
        all_stats.append(stats)

        # 職缺之間加較長延遲（反爬蟲）
        if job_id != job_ids[-1]:
            delay = random.uniform(30, 60)
            log(f"下個職缺前等待 {delay:.0f} 秒...")
            time.sleep(delay)

    # 總結報告
    log(f"{'='*50}", 'HEAD')
    log("執行完畢 — 摘要：", 'HEAD')
    total_imported = sum(s['imported'] for s in all_stats)
    total_scored   = sum(s['scored']   for s in all_stats)
    total_skipped  = sum(s['skipped']  for s in all_stats)
    total_errors   = sum(s['errors']   for s in all_stats)
    for s in all_stats:
        log(f"  {s['job']}: 找到 {s['found']} | 匯入 {s['imported']} | 評分 {s['scored']} | 跳過 {s['skipped']} | 錯誤 {s['errors']}")
    log(f"合計：匯入 {total_imported}，評分 {total_scored}，跳過 {total_skipped}，錯誤 {total_errors}", 'OK')


# ─── 工具函數 ─────────────────────────────────────────────────────────────────
def _parse_skills(skills_str: str) -> List[str]:
    """解析技能字串（逗號/換行/頓號分隔）"""
    if not skills_str:
        return []
    import re
    parts = re.split(r'[,，、\n;；]', skills_str)
    return [p.strip() for p in parts if p.strip()][:10]


def _parse_years(exp_str: str) -> int:
    """從「3年以上」「3-5年」等字串解析最低年資"""
    import re
    m = re.search(r'(\d+)', str(exp_str))
    return int(m.group(1)) if m else 3


if __name__ == '__main__':
    main()
