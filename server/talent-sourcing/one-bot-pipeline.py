#!/usr/bin/env python3
"""
one-bot-pipeline.py — Step1ne 獵頭 AI Bot 閉環管線 v2

兩段式流程：
  【scrape 模式（預設）】
    讀取 Bot 設定（目標職缺）
      → 爬取 LinkedIn / GitHub 候選人（search-plan-executor.py）
      → 去重（跳過已存在 DB 的 linkedin_url）
      → 匯入新候選人（POST /api/candidates），狀態 = 「未開始」（出現在今日新增）

  【score 模式（本機 AI 評分）】
    從 API 查詢今日「未開始」狀態候選人
      → 6 維確定性評分（candidate-scoring-system-v2.py）
      → AI 結語生成（claude -p，使用本機 Claude Code）
      → 評分 ≥ 80 → 狀態改為「AI推薦」
      → 評分  < 80 → 狀態改為「備選人才」
      → 寫入 ai_match_result（PATCH /api/candidates/:id）

  【full 模式】
    依序執行 scrape → score

用法：
  python3 one-bot-pipeline.py                        # 預設：full 模式
  python3 one-bot-pipeline.py --mode scrape          # 只爬取匯入
  python3 one-bot-pipeline.py --mode score           # 只評分今日新增
  python3 one-bot-pipeline.py --mode full            # 爬取 + 評分
  python3 one-bot-pipeline.py --job-ids 3,7,12       # 指定職缺（scrape/full 模式）
  python3 one-bot-pipeline.py --dry-run              # 試跑，不寫入 DB
  python3 one-bot-pipeline.py --no-claude            # 跳過 AI 結語（純模板）

Step1ne 正式後端位址：
  https://backendstep1ne.zeabur.app

本機執行範例（建議先 dry-run 確認）：
  API_BASE_URL=https://backendstep1ne.zeabur.app python3 one-bot-pipeline.py --mode score --dry-run
  API_BASE_URL=https://backendstep1ne.zeabur.app python3 one-bot-pipeline.py --mode score
  API_BASE_URL=https://backendstep1ne.zeabur.app python3 one-bot-pipeline.py --mode scrape --job-ids 3,7

環境變數（可選）：
  API_BASE_URL   後端 API 位址（預設 http://localhost:3001，正式用上方網址）
  BOT_ACTOR      Bot 名稱（預設 AIBot-pipeline）
  BRAVE_KEY      Brave Search API Key（LinkedIn 搜尋備援）
  GITHUB_TOKEN   GitHub Personal Access Token（GitHub 搜尋用）

⏰ 定時任務設定提醒（本機 AI 評分機器）：
  建議設定 cron 每 2 小時自動執行一次 score 模式，範例：

  # crontab -e  →  加入以下這行（每 2 小時整點執行）
  0 */2 * * * API_BASE_URL=https://backendstep1ne.zeabur.app \
              /usr/bin/python3 /path/to/one-bot-pipeline.py \
              --mode score >> /tmp/step1ne-score.log 2>&1

  macOS 也可用 launchd，或用 claude 幫你寫 plist 設定檔。
  預設每 2 小時輪詢一次；若當天無新增候選人則自動跳過。
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

# 負責顧問（從 bot-config 讀取，可被 --consultant 覆蓋）
BOT_CONSULTANT = os.getenv('BOT_CONSULTANT', '')  # 留空則從 API 讀取

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
_analyzer = _load_module('job-profile-analyzer.py',            'job_analyzer')

CandidateScoringEngine = _scoring.CandidateScoringEngine
ScoringCandidate       = _scoring.Candidate
JobRequirement         = _scoring.JobRequirement
IndustryType           = _scoring.IndustryType
generate_conclusion    = _claude.generate_conclusion
analyze_job_for_search = _analyzer.analyze_job_for_search


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
def scrape_candidates(job: Dict, pages: int = 2, use_claude_analyze: bool = True) -> List[Dict]:
    """
    多角度人才搜尋：
    1. Claude 分析職缺 → 產生搜尋策略（人才畫像）
    2. 每個搜尋角度各跑一輪爬蟲（primary AND + secondary OR）
    3. 結果去重合併回傳
    適用所有職位類型（工程師/業務/設計師/行銷...）
    """
    job_title = job.get('title', '')

    # Step 1：Claude 分析職缺，取得多角度搜尋策略
    log(f"分析職缺人才畫像：{job_title}...")
    strategy = analyze_job_for_search(job, use_claude=use_claude_analyze)
    role_type = strategy.get('role_type', 'other')
    angles    = strategy.get('search_angles', [])
    log(f"  職位類型：{role_type} | 搜尋角度：{len(angles)} 個")
    for a in angles:
        log(f"  角度「{a.get('description','')}」：主={a.get('primary',[])} 次={a.get('secondary',[])}")

    # Step 2：逐一執行每個搜尋角度
    all_candidates: List[Dict] = []
    seen_linkedin: set = set()
    seen_github:   set = set()

    for angle_idx, angle in enumerate(angles, 1):
        primary   = angle.get('primary',   [])
        secondary = angle.get('secondary', [])
        desc      = angle.get('description', f'角度{angle_idx}')

        log(f"[角度 {angle_idx}/{len(angles)}] {desc}")

        primary_str   = ','.join(primary)
        secondary_str = ','.join(secondary)

        cmd = [
            sys.executable, SCRAPER,
            '--job-title',       job_title,
            '--primary-skills',  primary_str,
            '--secondary-skills', secondary_str,
            '--location',        'Taiwan',
            '--pages',           str(pages),
        ]
        if GITHUB_TOKEN:
            cmd += ['--github-token', GITHUB_TOKEN]
        if BRAVE_KEY:
            cmd += ['--brave-key', BRAVE_KEY]

        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
            if result.returncode != 0:
                log(f"  爬蟲退出碼 {result.returncode}", 'WARN')
            data = json.loads(result.stdout) if result.stdout.strip() else {}
            batch = data.get('all_candidates', [])
        except subprocess.TimeoutExpired:
            log(f"  角度{angle_idx} 爬蟲超時", 'ERR')
            batch = []
        except Exception as e:
            log(f"  角度{angle_idx} 例外：{e}", 'ERR')
            batch = []

        # 去重（LinkedIn URL / GitHub username）
        new_count = 0
        for c in batch:
            li  = (c.get('linkedin_url', '') or '').strip().rstrip('/')
            gh  = (c.get('github_username', '') or '').lower()
            dup = (li and li in seen_linkedin) or (gh and gh in seen_github)
            if not dup:
                if li: seen_linkedin.add(li)
                if gh: seen_github.add(gh)
                all_candidates.append(c)
                new_count += 1

        log(f"  本角度：{len(batch)} 位，新增不重複：{new_count} 位")

        # 角度之間加延遲（防止連續打搜尋引擎）
        if angle_idx < len(angles):
            delay = random.uniform(8, 15)
            log(f"  等待 {delay:.0f} 秒後執行下一個角度...")
            time.sleep(delay)

    log(f"多角度搜尋完成，共 {len(all_candidates)} 位不重複候選人")
    return all_candidates


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
def import_candidate(raw: Dict, job: Dict, dry_run: bool = False, consultant: str = '') -> Optional[int]:
    """
    將爬蟲原始資料轉換後匯入 DB，回傳候選人 ID。
    raw 欄位來自 search-plan-executor.py 的輸出格式。
    consultant: 負責顧問 displayName（從 bot-config 讀取）
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
    assigned = consultant or BOT_ACTOR   # 指派給設定的顧問，未設定則記 Bot 名稱

    payload = {
        'name':        name,
        'position':    title or job.get('title', ''),
        'skills':      ', '.join(skills),
        'linkedin_url': li_url,
        'github_url':  gh_url,
        'source':      source,
        'status':      '未開始',   # 匯入時先進「今日新增」，等本機 AI 評分後再路由
        'consultant':  assigned,
        'notes':       f"Bot 自動匯入 | 目標職缺：{job.get('title','')} | 負責顧問：{assigned} | {datetime.now().strftime('%Y-%m-%d')}",
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
def process_job(job: Dict, existing_urls: set, args, consultant: str = '') -> Dict:
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
        cid = import_candidate(raw, job, dry_run=args.dry_run, consultant=consultant)
        if cid is None:
            stats['errors'] += 1
            continue
        stats['imported'] += 1
        if li_url:
            existing_urls.add(li_url)  # 更新本地去重集合

        if args.dry_run:
            continue

        # 4. 反爬蟲延遲（每位候選人之間 1-3 秒）
        if i < len(raw_candidates):
            time.sleep(random.uniform(1.0, 3.0))

    return stats


# ─── 評分階段：處理今日「未開始」候選人 ──────────────────────────────────────────
SCORE_THRESHOLD = 80   # ≥ 80 → AI推薦，< 80 → 備選人才


def fetch_today_new_candidates() -> List[Dict]:
    """從 API 取得今天建立且狀態為「未開始」的候選人"""
    today = datetime.now().strftime('%Y-%m-%d')
    # 先取全部未開始候選人，前端過濾今日建立
    resp = api_get('/api/candidates?status=未開始&limit=500')
    if not resp or not resp.get('success'):
        log("無法取得候選人列表", 'ERR')
        return []

    all_cands = resp.get('data', [])
    today_new = []
    for c in all_cands:
        created = (c.get('createdAt') or c.get('created_at') or '')[:10]
        if created == today:
            today_new.append(c)

    log(f"今日新增（未開始）候選人：{len(today_new)} 位")
    return today_new


def score_and_route_candidate(c: Dict, args) -> str:
    """
    對單一候選人評分並路由狀態。
    回傳最終狀態字串：'AI推薦' 或 '備選人才'
    """
    cid  = c.get('id')
    name = c.get('name', f'#{cid}')
    log(f"  評分：{name}（#{cid}）")

    # 從 notes 嘗試解析目標職缺資訊（Bot 匯入時記錄在 notes）
    notes  = c.get('notes', '')
    skills_raw = c.get('skills', '')
    skills = [s.strip() for s in skills_raw.split(',') if s.strip()] if isinstance(skills_raw, str) else (skills_raw or [])

    # 建立虛擬 job（從 notes 解析職缺名稱）
    import re as _re
    job_title_match = _re.search(r'目標職缺：([^|]+)', notes)
    job_title = job_title_match.group(1).strip() if job_title_match else '目標職缺'
    job = {
        'title':           job_title,
        'company':         '',
        'required_skills': skills[:8],
        'years_required':  3,
        'location':        c.get('location', '台灣'),
    }

    # 組裝 ScoringCandidate
    raw_for_score = {
        'name':        name,
        'title':       c.get('position', ''),
        'company':     '',
        'linkedin_url': c.get('linkedinUrl') or c.get('linkedin_url', ''),
        'github_url':  c.get('githubUrl')   or c.get('github_url', ''),
    }

    try:
        scoring   = score_candidate(raw_for_score, job)
        score_val = round(scoring.get('overall_score', 0))
        level     = scoring.get('talent_level', '?')
        log(f"    分數：{score_val}/100（{level}）")
    except Exception as e:
        log(f"    評分例外：{e}", 'WARN')
        return '備選人才'   # 評分失敗 → 備選

    # 決定狀態
    new_status = 'AI推薦' if score_val >= SCORE_THRESHOLD else '備選人才'

    if args.dry_run:
        log(f"    [DRY-RUN] {name} → {new_status}", 'OK')
        return new_status

    # AI 結語
    conclusion = None
    if not args.no_claude:
        candidate_for_claude = {
            'name':               name,
            'position':           c.get('position', ''),
            'years_experience':   estimate_years(c.get('position', '')),
            'location':           c.get('location', '台灣'),
            'skills':             skills,
            'company_background': [],
            'education':          c.get('education', ''),
        }
        conclusion = generate_conclusion(candidate_for_claude, job, scoring)
        if conclusion:
            log(f"    結語已生成（{len(conclusion)} 字）")

    # 寫入 DB
    ai_result = build_ai_match_result(scoring, job, conclusion, not args.no_claude)
    patch_resp = api_patch(f'/api/candidates/{cid}', {
        'ai_match_result': ai_result,
        'status':          new_status,
        'actor':           BOT_ACTOR,
        'by':              BOT_ACTOR,
    })
    if patch_resp and patch_resp.get('success'):
        log(f"    寫入完成：{name} → {new_status} ✓", 'OK')
    else:
        log(f"    寫入失敗：{patch_resp}", 'WARN')

    return new_status


def run_score_phase(args):
    """評分階段：讀取今日新增，評分後路由狀態"""
    log(f"{'='*50}", 'HEAD')
    log("評分階段：處理今日「未開始」候選人", 'HEAD')
    log(f"{'='*50}", 'HEAD')
    log(f"閾值：≥{SCORE_THRESHOLD} 分 → AI推薦，<{SCORE_THRESHOLD} 分 → 備選人才")

    candidates = fetch_today_new_candidates()
    if not candidates:
        log("今日無新增候選人，評分結束", 'WARN')
        return

    ai_count    = 0
    backup_count = 0
    error_count  = 0

    for i, c in enumerate(candidates, 1):
        log(f"[{i}/{len(candidates)}]")
        try:
            status = score_and_route_candidate(c, args)
            if status == 'AI推薦':
                ai_count += 1
            else:
                backup_count += 1
        except Exception as e:
            log(f"  例外：{e}", 'ERR')
            error_count += 1

        # 每位之間稍微停頓（避免 Claude CLI 過熱）
        if i < len(candidates):
            time.sleep(random.uniform(0.5, 1.5))

    log(f"{'='*50}", 'HEAD')
    log(f"評分完成：AI推薦 {ai_count}，備選人才 {backup_count}，錯誤 {error_count}", 'OK')


def load_consultant_configs(consultant_name: str = '') -> List[Dict]:
    """
    讀取顧問 Bot 設定。
    - consultant_name 指定 → 只讀該顧問設定（/api/bot-config?consultant=xxx）
    - consultant_name 空   → 讀所有啟用中的顧問設定（/api/bot-configs）
    回傳 list of config dict。
    """
    if consultant_name:
        resp = api_get(f'/api/bot-config?consultant={consultant_name}')
        if resp and resp.get('success'):
            return [resp['data']]
        log(f"無法讀取 {consultant_name} 的設定", 'ERR')
        return []
    else:
        resp = api_get('/api/bot-configs')
        if resp and resp.get('success'):
            enabled = [c for c in resp['data'] if c.get('enabled')]
            log(f"共 {len(enabled)} 位顧問啟用 Bot 排程")
            return enabled
        log("無法讀取所有顧問設定", 'ERR')
        return []


def run_scrape_phase(args):
    """爬取匯入階段：抓取候選人並以「未開始」狀態存入 DB"""
    # 優先順序：--consultant CLI 參數 > BOT_CONSULTANT 環境變數 > 讀取所有啟用顧問
    cli_consultant = getattr(args, 'consultant', '') or BOT_CONSULTANT

    configs = load_consultant_configs(cli_consultant)
    if not configs:
        if args.job_ids:
            # fallback：命令列直接指定職缺，使用 BOT_ACTOR 作顧問
            configs = [{'consultant': BOT_ACTOR, 'target_job_ids':
                        [int(x.strip()) for x in args.job_ids.split(',') if x.strip().isdigit()]}]
        else:
            log("無啟用的 Bot 設定，請在系統 Bot 排程設定頁面啟用", 'WARN')
            sys.exit(0)

    # 取得現有 LinkedIn URLs（去重用，所有顧問共用）
    log("載入現有候選人 LinkedIn URLs...")
    existing_urls = get_existing_linkedin_urls()
    log(f"DB 中已有 {len(existing_urls)} 個 LinkedIn URL")

    # 依序執行每位顧問的設定（顧問間加延遲，避免同時爬蟲被偵測）
    all_stats = []
    for cfg_idx, cfg in enumerate(configs):
        consultant = cfg.get('consultant', BOT_ACTOR)
        job_ids    = args.job_ids and [int(x.strip()) for x in args.job_ids.split(',') if x.strip().isdigit()] \
                     or cfg.get('target_job_ids', [])

        if not job_ids:
            log(f"[{consultant}] 目標職缺清單為空，跳過", 'WARN')
            continue

        log(f"{'='*50}", 'HEAD')
        log(f"顧問：{consultant} | 目標職缺 ID：{job_ids}", 'HEAD')
        log(f"{'='*50}", 'HEAD')

        # 顧問之間加延遲（避免多顧問同時爬蟲）
        if cfg_idx > 0:
            delay = random.uniform(60, 120)
            log(f"下一位顧問前等待 {delay:.0f} 秒（防止爬蟲頻率過高）...")
            if not args.dry_run:
                time.sleep(delay)

        # 逐一處理此顧問的每個職缺
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

            stats = process_job(job, existing_urls, args, consultant=consultant)
            all_stats.append(stats)

            # 職缺之間加較長延遲（反爬蟲）
            if job_id != job_ids[-1]:
                delay = random.uniform(30, 60)
                log(f"下個職缺前等待 {delay:.0f} 秒...")
                time.sleep(delay)

    # 爬取摘要
    log(f"{'='*50}", 'HEAD')
    log("爬取完畢 — 摘要：", 'HEAD')
    total_imported = sum(s['imported'] for s in all_stats)
    total_skipped  = sum(s['skipped']  for s in all_stats)
    total_errors   = sum(s['errors']   for s in all_stats)
    for s in all_stats:
        log(f"  {s['job']}: 找到 {s['found']} | 匯入 {s['imported']} | 跳過 {s['skipped']} | 錯誤 {s['errors']}")
    log(f"合計：匯入 {total_imported}（狀態=未開始），跳過 {total_skipped}，錯誤 {total_errors}", 'OK')
    log("提示：請在本機執行 --mode score 讓 AI 評分路由", 'INFO')


def main():
    parser = argparse.ArgumentParser(description='Step1ne AI Bot 閉環管線 v2')
    parser.add_argument('--mode',       default='full',
                        choices=['full', 'scrape', 'score'],
                        help='full=爬取+評分（預設），scrape=只爬取匯入，score=只評分今日新增')
    parser.add_argument('--consultant', default='', help='指定顧問名稱（空=讀取所有已啟用顧問）')
    parser.add_argument('--job-ids',   default='', help='指定職缺 ID（逗號分隔），覆蓋 DB 設定')
    parser.add_argument('--pages',     type=int, default=2, help='每次搜尋頁數（1-3）')
    parser.add_argument('--dry-run',   action='store_true', help='試跑，不寫入 DB')
    parser.add_argument('--no-claude', action='store_true', help='跳過 AI 結語，使用模板')
    args = parser.parse_args()
    args.pages = max(1, min(3, args.pages))

    log(f"Step1ne AI Bot Pipeline v2 啟動", 'HEAD')
    log(f"模式：{args.mode} | API: {API_BASE} | Actor: {BOT_ACTOR} | Dry-run: {args.dry_run} | Claude: {not args.no_claude}", 'HEAD')

    if args.mode in ('scrape', 'full'):
        run_scrape_phase(args)

    if args.mode in ('score', 'full'):
        # score 模式在 full 時自動接在 scrape 後執行
        if args.mode == 'full':
            log("爬取完成，等待 5 秒後開始評分...", 'INFO')
            if not args.dry_run:
                time.sleep(5)
        run_score_phase(args)


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
