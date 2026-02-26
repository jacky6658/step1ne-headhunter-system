#!/usr/bin/env python3
"""
Step1ne 人才搜尋執行器 v4
純 Python 標準函式庫（零外部依賴）
GitHub API + LinkedIn Google/Bing/Brave 三層備援
"""
import json
import sys
import time
import random
import argparse
import re
import os
import gzip
import ssl
from urllib.parse import quote, unquote, urlencode
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError
from concurrent.futures import ThreadPoolExecutor, as_completed

def log(msg):
    print(f"[scraper] {msg}", file=sys.stderr, flush=True)

# ============================================================
# HTTP 工具（stdlib-only，支援 gzip、隨機 UA）
# ============================================================
USER_AGENTS = [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
]

# 忽略 SSL 憑證錯誤（某些雲端環境憑證庫不完整）
_SSL_CTX = ssl.create_default_context()
_SSL_CTX.check_hostname = False
_SSL_CTX.verify_mode = ssl.CERT_NONE

def get_browser_headers(extra=None):
    h = {
        'User-Agent': random.choice(USER_AGENTS),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Cache-Control': 'max-age=0',
    }
    if extra:
        h.update(extra)
    return h

def http_get(url, extra_headers=None, timeout=15):
    """stdlib HTTP GET，自動解壓 gzip，回傳 (text, status_code)"""
    headers = get_browser_headers(extra_headers)
    req = Request(url, headers=headers)
    try:
        with urlopen(req, timeout=timeout, context=_SSL_CTX) as resp:
            raw = resp.read()
            enc = resp.headers.get('Content-Encoding', '')
            if 'gzip' in enc:
                try:
                    raw = gzip.decompress(raw)
                except Exception:
                    pass
            return raw.decode('utf-8', errors='replace'), resp.status
    except HTTPError as e:
        return '', e.code
    except Exception:
        return '', 0

def http_get_json(url, extra_headers=None, timeout=15):
    """HTTP GET 並解析 JSON，回傳 (dict, status_code)"""
    headers = get_browser_headers(extra_headers)
    headers['Accept'] = 'application/json'
    req = Request(url, headers=headers)
    try:
        with urlopen(req, timeout=timeout, context=_SSL_CTX) as resp:
            raw = resp.read()
            enc = resp.headers.get('Content-Encoding', '')
            if 'gzip' in enc:
                try:
                    raw = gzip.decompress(raw)
                except Exception:
                    pass
            return json.loads(raw.decode('utf-8', errors='replace')), resp.status
    except HTTPError as e:
        return {}, e.code
    except Exception:
        return {}, 0

def anti_scraping_delay(min_s=2.0, max_s=5.0):
    time.sleep(random.uniform(min_s, max_s))

def is_captcha_page(text):
    indicators = ['g-recaptcha', 'recaptcha', 'unusual traffic', 'Just a moment',
                  'Cloudflare', '/sorry/index', 'sitekey', 'detected unusual']
    lower = text.lower()
    return any(i.lower() in lower for i in indicators)


# ============================================================
# GitHub API 搜尋（純 urllib，並行抓取）
# ============================================================
GITHUB_API = "https://api.github.com"

GITHUB_TOKEN_GUIDE = (
    "⚠️ GitHub API 已達每小時上限（60次/小時，無認證模式）\n\n"
    "請接入 GitHub Personal Access Token 提升至 5000次/小時：\n"
    "1. 前往 GitHub → Settings → Developer settings\n"
    "2. Personal access tokens → Tokens (classic)\n"
    "3. Generate new token（勾選 read:user, user:email）\n"
    "4. 將 token 填入系統右上角 → 個人設定 → GitHub Token\n"
    "申請頁面：https://github.com/settings/tokens"
)

def get_github_headers(token=None):
    h = {'Accept': 'application/vnd.github.v3+json'}
    if token:
        h['Authorization'] = f'token {token}'
    return h

def check_github_rate_limit(token=None):
    data, status = http_get_json(f"{GITHUB_API}/rate_limit",
                                  extra_headers=get_github_headers(token), timeout=10)
    rate = data.get('rate', {})
    return rate.get('remaining', 0), rate.get('limit', 60), rate.get('reset', 0)

def _github_search_page(query, page, gh_headers):
    try:
        anti_scraping_delay(0.3, 0.8)
        params = urlencode({'q': query, 'per_page': 10, 'page': page, 'sort': 'followers'})
        data, status = http_get_json(f"{GITHUB_API}/search/users?{params}",
                                      extra_headers=gh_headers, timeout=15)
        if status == 403:
            return None, True
        if status != 200:
            log(f"GitHub search HTTP {status} page {page}")
            return [], False
        return data.get('items', []), False
    except Exception as e:
        log(f"GitHub search page {page} error: {e}")
        return [], False

def fetch_github_user_detail(username, gh_headers):
    try:
        user, s1 = http_get_json(f"{GITHUB_API}/users/{username}",
                                   extra_headers=gh_headers, timeout=10)
        if s1 != 200:
            return None
        params = urlencode({'sort': 'updated', 'per_page': 10, 'type': 'owner'})
        repos, s2 = http_get_json(f"{GITHUB_API}/users/{username}/repos?{params}",
                                   extra_headers=gh_headers, timeout=10)
        if s2 != 200:
            repos = []
        languages = list({r.get('language') for r in repos if r.get('language')})
        recent_push = repos[0].get('pushed_at', '') if repos else ''
        top_repos = [r.get('name', '') for r in repos[:5]]
        return {
            'source': 'github',
            'name': user.get('name') or username,
            'github_url': user.get('html_url', f'https://github.com/{username}'),
            'github_username': username,
            'linkedin_url': '',
            'location': user.get('location', '') or '',
            'bio': user.get('bio', '') or '',
            'company': (user.get('company', '') or '').lstrip('@').strip(),
            'email': user.get('email', '') or '',
            'public_repos': user.get('public_repos', 0),
            'followers': user.get('followers', 0),
            'skills': languages,
            'recent_push': recent_push,
            'top_repos': top_repos,
        }
    except Exception as e:
        log(f"GitHub detail error ({username}): {e}")
        return None

def search_github_users(skills, location="Taiwan", token=None, pages=2):
    remaining, limit, _ = check_github_rate_limit(token)
    log(f"GitHub rate limit: {remaining}/{limit} remaining")
    if remaining < 10:
        return {'success': False, 'rate_limit_warning': True,
                'rate_limit_guide': GITHUB_TOKEN_GUIDE, 'data': []}

    gh_headers = get_github_headers(token)
    seen_logins = set()
    all_logins = []

    primary_langs = [s for s in skills[:2] if s]
    lang_query = ' '.join(f'language:{s}' for s in primary_langs) if primary_langs else ''
    location_variants = [location, 'Taipei'] if location.lower() == 'taiwan' else [location]
    queries = [f'{lang_query} location:{loc}'.strip() for loc in location_variants]

    for query in queries:
        for page in range(1, pages + 1):
            items, rate_limited = _github_search_page(query, page, gh_headers)
            if rate_limited:
                return {'success': False, 'rate_limit_warning': not bool(token),
                        'rate_limit_guide': GITHUB_TOKEN_GUIDE if not token else '', 'data': []}
            if not items:
                break
            for user in items:
                login = user.get('login', '')
                if login and login not in seen_logins:
                    seen_logins.add(login)
                    all_logins.append(login)

    log(f"GitHub: 收集到 {len(all_logins)} 個帳號，開始並行抓取詳細資料...")
    all_users = []
    with ThreadPoolExecutor(max_workers=4) as executor:
        future_map = {executor.submit(fetch_github_user_detail, login, gh_headers): login
                      for login in all_logins}
        for future in as_completed(future_map):
            detail = future.result()
            if detail:
                all_users.append(detail)
    return {'success': True, 'data': all_users}


# ============================================================
# LinkedIn URL 工具
# ============================================================
def clean_linkedin_url(href):
    try:
        url = unquote(str(href))
        url = url.split('?')[0].split('%3F')[0]
        url = re.sub(r'^https?://[a-z]{2,3}\.linkedin\.com', 'https://www.linkedin.com', url)
        if not re.search(r'linkedin\.com/in/[\w\-]+', url):
            return None
        if not url.endswith('/'):
            url += '/'
        return url
    except Exception:
        return None

def _make_linkedin_item(url, name='', title='', company=''):
    username = url.rstrip('/').split('/')[-1]
    return {
        'source': 'linkedin',
        'name': name or username.replace('-', ' ').title(),
        'github_url': '', 'github_username': '',
        'linkedin_url': url, 'linkedin_username': username,
        'location': '', 'bio': title, 'company': company,
        'email': '', 'public_repos': 0, 'followers': 0,
        'skills': [], 'recent_push': '', 'top_repos': [],
    }

def _parse_title_text(raw):
    """從 'Name - Title | LinkedIn' 格式拆出姓名和職稱"""
    text = re.sub(r'\s*\|\s*LinkedIn.*$', '', raw, flags=re.IGNORECASE).strip()
    m = re.match(r'^(.+?)\s*[-–]\s*(.+)$', text)
    if m:
        return m.group(1).strip(), m.group(2).strip()
    return text, ''

def extract_linkedin_urls_from_html(html_text):
    """從 Google/Bing HTML 用 regex 抽取 LinkedIn 個人頁 URL（不需 BeautifulSoup）"""
    found = []
    seen = set()

    def add(url, name='', title='', company=''):
        if url in seen:
            return
        seen.add(url)
        found.append(_make_linkedin_item(url, name, title, company))

    # Pattern 1：Google redirect  /url?q=https://linkedin.com/in/...
    for m in re.finditer(r'href="(/url\?q=https?://(?:www\.)?linkedin\.com/in/[^"&]+)', html_text):
        raw = unquote(m.group(1).replace('/url?q=', ''))
        url = clean_linkedin_url(raw)
        if url:
            # 嘗試從附近 HTML 拿標題
            snippet = html_text[max(0, m.start()-300):m.end()+300]
            title_m = re.search(r'<(?:h3|h2)[^>]*>([^<]{5,80})</(?:h3|h2)>', snippet)
            name, title = _parse_title_text(title_m.group(1)) if title_m else ('', '')
            add(url, name, title)

    # Pattern 2：直接 href 到 linkedin.com/in/
    for m in re.finditer(r'href="(https?://(?:www\.)?linkedin\.com/in/[\w\-]+/?)(?:[^"]*)"', html_text):
        url = clean_linkedin_url(m.group(1))
        if url:
            snippet = html_text[max(0, m.start()-200):m.end()+200]
            title_m = re.search(r'>([^<]{5,80})</(?:h[23]|a)>', snippet)
            name, title = _parse_title_text(title_m.group(1)) if title_m else ('', '')
            add(url, name, title)

    # Pattern 3：<cite> 或純文字中的 linkedin.com/in/username
    for m in re.finditer(r'linkedin\.com/in/([\w\-]+)', html_text):
        url = clean_linkedin_url(f'https://www.linkedin.com/in/{m.group(1)}/')
        if url:
            add(url)

    return found


# ============================================================
# LinkedIn via Google / Bing / Brave
# ============================================================
def search_linkedin_via_google(skills, location="台灣", pages=2):
    results = []
    seen_urls = set()
    captcha_detected = False

    skill_query = ' '.join(f'"{s}"' for s in skills[:3])
    query = f'site:linkedin.com/in/ {skill_query} "{location}"'

    for page in range(pages):
        start = page * 10
        search_url = f"https://www.google.com/search?q={quote(query)}&start={start}&num=10&hl=zh-TW"
        anti_scraping_delay(2.0, 5.0)

        text, status = http_get(search_url)
        if status == 429:
            log("Google 速率限制 429，暫停 15 秒")
            time.sleep(15)
            continue
        if status != 200:
            log(f"Google search HTTP {status}")
            continue
        if is_captcha_page(text):
            log("Google 偵測到 CAPTCHA，停止 Google 搜尋")
            captcha_detected = True
            break

        for item in extract_linkedin_urls_from_html(text):
            url = item['linkedin_url']
            if url not in seen_urls:
                seen_urls.add(url)
                results.append(item)

    log(f"Google LinkedIn: {len(results)} 筆")
    return {'success': True, 'data': results, 'captcha': captcha_detected}


def search_linkedin_via_bing(skills, location="Taiwan", pages=2):
    results = []
    seen_urls = set()

    skill_query = ' '.join(f'"{s}"' for s in skills[:3])
    location_en = location if location in ('Taiwan', 'Singapore', 'Hong Kong') else 'Taiwan'
    query = f'site:linkedin.com/in/ {skill_query} "{location_en}"'

    for page in range(pages):
        first = page * 10 + 1
        search_url = f"https://www.bing.com/search?q={quote(query)}&first={first}&count=10"
        anti_scraping_delay(2.0, 4.0)

        text, status = http_get(search_url)
        if status != 200:
            log(f"Bing search HTTP {status}")
            continue

        for item in extract_linkedin_urls_from_html(text):
            url = item['linkedin_url']
            if url not in seen_urls:
                seen_urls.add(url)
                results.append(item)

    log(f"Bing LinkedIn: {len(results)} 筆")
    return {'success': True, 'data': results}


def search_linkedin_via_brave(skills, brave_api_key, location="Taiwan", pages=2):
    """Brave Search API（官方 JSON API，不需解析 HTML）"""
    results = []
    seen_urls = set()

    skill_query = ' '.join(f'"{s}"' for s in skills[:3])
    query = f'site:linkedin.com/in/ {skill_query} "{location}"'
    endpoint = "https://api.search.brave.com/res/v1/web/search"
    brave_headers = {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': brave_api_key,
    }

    for page in range(pages):
        params = urlencode({'q': query, 'count': 10, 'offset': page * 10})
        data, status = http_get_json(f"{endpoint}?{params}", extra_headers=brave_headers, timeout=15)

        if status == 401:
            log("Brave API: 金鑰無效（401）")
            break
        if status == 429:
            log("Brave API: 速率限制（429）")
            break
        if status != 200:
            log(f"Brave API: HTTP {status}")
            continue

        anti_scraping_delay(0.5, 1.5)
        for r in data.get('web', {}).get('results', []):
            url = clean_linkedin_url(r.get('url', ''))
            if not url or url in seen_urls:
                continue
            seen_urls.add(url)
            name, title = _parse_title_text(r.get('title', ''))
            desc = r.get('description', '')
            company = ''
            mc = re.search(r'(?:at|@|·)\s+([\w\s,\.]+?)(?:\s*·|\s*\||$)', desc)
            if mc:
                company = mc.group(1).strip()
            results.append(_make_linkedin_item(url, name, title, company))

    log(f"Brave LinkedIn: {len(results)} 筆")
    return {'success': True, 'data': results}


def search_linkedin_with_fallback(skills, location_zh="台灣", location_en="Taiwan", pages=2, brave_key=None):
    """三層備援：Google → Bing → Brave API"""
    log("LinkedIn: 嘗試 Google...")
    google_result = search_linkedin_via_google(skills, location=location_zh, pages=pages)
    all_data = list(google_result.get('data', []))
    seen = {item['linkedin_url'] for item in all_data}
    source_used = ['google']

    if google_result.get('captcha') or len(all_data) < 3:
        reason = "CAPTCHA" if google_result.get('captcha') else f"結果不足（{len(all_data)} 筆）"
        log(f"LinkedIn: Google {reason}，切換 Bing...")
        for item in search_linkedin_via_bing(skills, location=location_en, pages=pages).get('data', []):
            if item['linkedin_url'] not in seen:
                seen.add(item['linkedin_url'])
                all_data.append(item)
        source_used.append('bing')

    if brave_key:
        brave_pages = pages if len(all_data) < 5 else 1
        log(f"LinkedIn: Brave API 補充（{brave_pages} 頁）...")
        for item in search_linkedin_via_brave(skills, brave_key, location=location_en, pages=brave_pages).get('data', []):
            if item['linkedin_url'] not in seen:
                seen.add(item['linkedin_url'])
                all_data.append(item)
        source_used.append('brave')

    source_str = '+'.join(source_used)
    log(f"LinkedIn 最終（{source_str}）：{len(all_data)} 筆")
    return {'success': True, 'data': all_data, 'source': source_str}


# ============================================================
# Main
# ============================================================
def main():
    parser = argparse.ArgumentParser(description='Step1ne 人才搜尋執行器 v4（零依賴）')
    parser.add_argument('--job-title', required=True)
    parser.add_argument('--required-skills', default='')
    parser.add_argument('--industry', default='')
    parser.add_argument('--location', default='Taiwan')
    parser.add_argument('--github-token', default='')
    parser.add_argument('--brave-key', default='')
    parser.add_argument('--pages', type=int, default=2)
    parser.add_argument('--output-format', default='json')
    args = parser.parse_args()

    skills = [s.strip() for s in args.required_skills.split(',') if s.strip()]
    token = args.github_token.strip() or None
    brave_key = args.brave_key.strip() or None
    pages = max(1, min(3, args.pages))

    log(f"v4 搜尋: {args.job_title} | 技能: {skills} | 頁數: {pages} | GitHub: {'有' if token else '無'} | Brave: {'有' if brave_key else '無'}")

    output = {
        'job_title': args.job_title,
        'industry': args.industry,
        'rate_limit_warning': None,
        'github': {'success': False, 'count': 0},
        'linkedin': {'success': False, 'count': 0},
        'all_candidates': [],
        'total_found': 0,
    }

    log(f"[1/2] GitHub 搜尋（並行 + 多地區）...")
    github_result = search_github_users(skills, location=args.location, token=token, pages=pages)
    if github_result.get('rate_limit_warning'):
        output['rate_limit_warning'] = github_result.get('rate_limit_guide', '')
    github_candidates = github_result.get('data', [])
    output['github']['success'] = github_result.get('success', False)
    output['github']['count'] = len(github_candidates)
    log(f"GitHub: {len(github_candidates)} 位")

    log(f"[2/2] LinkedIn 搜尋（Google→Bing→Brave 三層備援）...")
    linkedin_result = search_linkedin_with_fallback(
        skills, location_zh='台灣', location_en=args.location, pages=pages, brave_key=brave_key
    )
    linkedin_candidates = linkedin_result.get('data', [])
    output['linkedin']['success'] = linkedin_result.get('success', False)
    output['linkedin']['count'] = len(linkedin_candidates)
    output['linkedin']['source'] = linkedin_result.get('source', 'google')
    log(f"LinkedIn: {len(linkedin_candidates)} 位（來源: {output['linkedin']['source']}）")

    all_candidates = github_candidates + linkedin_candidates
    output['all_candidates'] = all_candidates
    output['total_found'] = len(all_candidates)
    log(f"完成，共 {len(all_candidates)} 位候選人")

    print(json.dumps(output, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    main()
