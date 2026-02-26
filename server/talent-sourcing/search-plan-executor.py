#!/usr/bin/env python3
"""
Step1ne 人才搜尋執行器 v5
LinkedIn 搜尋：Playwright 真實瀏覽器（主）→ Google/Bing/Brave urllib（備援）
GitHub 搜尋：GitHub API（不變）
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

# Playwright 選用匯入（Zeabur 部署後可用；本機未安裝時自動降級）
try:
    from playwright.sync_api import sync_playwright
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False

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

SAMPLE_PER_PAGE = 5   # 每頁隨機抽取人數（可被 --sample-per-page 覆蓋）


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
        items = data.get('items', [])
        # 每頁隨機抽取，讓結果更多樣（不總是同前幾名）
        if len(items) > SAMPLE_PER_PAGE:
            items = random.sample(items, SAMPLE_PER_PAGE)
        return items, False
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

def search_github_users(skills, location="Taiwan", token=None, pages=10):
    remaining, limit, _ = check_github_rate_limit(token)
    log(f"GitHub rate limit: {remaining}/{limit} remaining")
    if remaining < 10:
        return {'success': False, 'rate_limit_warning': True,
                'rate_limit_guide': GITHUB_TOKEN_GUIDE, 'data': []}

    gh_headers = get_github_headers(token)
    seen_logins = set()
    all_logins = []

    queries = build_github_queries(skills, location)
    log(f"GitHub queries: {queries}")

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
# 技能同義詞 & 生態系展開（Option A：主技能 AND，次技能 OR）
# ============================================================

# 技能 → 常見別名 / 縮寫（搜尋時自動展開）
SKILL_SYNONYMS: dict = {
    # JavaScript 生態
    'javascript':   ['JavaScript', 'JS'],
    'typescript':   ['TypeScript', 'TS'],
    'react':        ['React', 'React.js', 'ReactJS'],
    'vue':          ['Vue', 'Vue.js', 'VueJS'],
    'angular':      ['Angular', 'AngularJS'],
    'next':         ['Next.js', 'NextJS'],
    'nuxt':         ['Nuxt.js', 'NuxtJS'],
    'node':         ['Node.js', 'NodeJS', 'Node'],
    # Python 生態
    'python':       ['Python'],
    'django':       ['Django'],
    'fastapi':      ['FastAPI'],
    'flask':        ['Flask'],
    # Go / Golang
    'go':           ['Go', 'Golang'],
    'golang':       ['Go', 'Golang'],
    # JVM
    'java':         ['Java'],
    'kotlin':       ['Kotlin'],
    'scala':        ['Scala'],
    'spring':       ['Spring', 'Spring Boot'],
    # .NET
    'csharp':       ['C#', '.NET'],
    'dotnet':       ['.NET', 'C#'],
    # 行動開發
    'swift':        ['Swift', 'iOS'],
    'ios':          ['iOS', 'Swift'],
    'android':      ['Android', 'Kotlin'],
    # 資料 / ML
    'ml':           ['Machine Learning', 'ML'],
    'machinelearning': ['Machine Learning', 'ML'],
    'deeplearning': ['Deep Learning', 'DL'],
    'pytorch':      ['PyTorch'],
    'tensorflow':   ['TensorFlow', 'TF'],
    'llm':          ['LLM', 'Large Language Model'],
    'rag':          ['RAG', 'Retrieval Augmented Generation'],
    # 雲端 & DevOps
    'aws':          ['AWS', 'Amazon Web Services'],
    'gcp':          ['GCP', 'Google Cloud'],
    'azure':        ['Azure', 'Microsoft Azure'],
    'kubernetes':   ['Kubernetes', 'K8s'],
    'k8s':          ['Kubernetes', 'K8s'],
    'docker':       ['Docker', 'Container'],
    'devops':       ['DevOps', 'SRE'],
    'sre':          ['SRE', 'DevOps'],
    'ci':           ['CI/CD', 'GitHub Actions', 'Jenkins'],
    'cicd':         ['CI/CD', 'GitHub Actions'],
    # 資料庫
    'postgres':     ['PostgreSQL', 'Postgres'],
    'postgresql':   ['PostgreSQL', 'Postgres'],
    'mysql':        ['MySQL'],
    'mongodb':      ['MongoDB', 'Mongo'],
    'redis':        ['Redis'],
    'elasticsearch':['Elasticsearch', 'ES', 'OpenSearch'],
    # 區塊鏈
    'solidity':     ['Solidity'],
    'web3':         ['Web3', 'Blockchain'],
    # 資安
    'security':     ['Security', '資安', 'Cybersecurity'],
    # 其他
    'rust':         ['Rust'],
    'cpp':          ['C++'],
    'c++':          ['C++'],
    'linux':        ['Linux'],
    'git':          ['Git', 'GitHub'],
}

def _normalize_key(skill: str) -> str:
    return skill.lower().replace('.', '').replace(' ', '').replace('-', '').replace('_', '')

def expand_skill_synonyms(skill: str) -> list:
    """回傳該技能 + 所有已知別名（去重）"""
    key = _normalize_key(skill)
    synonyms = SKILL_SYNONYMS.get(key)
    if synonyms:
        # 確保原始輸入也在清單中
        result = list(dict.fromkeys([skill] + synonyms))
        return result
    return [skill]

def build_linkedin_query(skills: list, location: str) -> str:
    """
    方案 A：主技能 AND + 次技能 OR + 同義詞展開
      - 主技能（前 2 個）：AND — 候選人必須同時具備
      - 次技能（第 3-6 個）：OR 群組 — 有其一即符合
      - 每個技能自動展開同義詞（React → "React" OR "React.js"）

    範例輸出：
      site:linkedin.com/in/ "Python" ("Go" OR "Golang")
        ("Kubernetes" OR "K8s" OR "Docker") "台灣"
    """
    primary   = skills[:2]
    secondary = skills[2:7]

    parts = []

    # 主技能：各自展開同義詞，多個別名用 OR 括號，單一直接引號
    for skill in primary:
        synonyms = expand_skill_synonyms(skill)
        if len(synonyms) > 1:
            parts.append('(' + ' OR '.join(f'"{s}"' for s in synonyms) + ')')
        else:
            parts.append(f'"{skill}"')

    # 次技能：所有技能的同義詞合併成一個大 OR 群組
    secondary_terms = []
    for skill in secondary:
        for s in expand_skill_synonyms(skill):
            term = f'"{s}"'
            if term not in secondary_terms:
                secondary_terms.append(term)

    if secondary_terms:
        parts.append('(' + ' OR '.join(secondary_terms) + ')')

    query = f'site:linkedin.com/in/ ' + ' '.join(parts) + f' "{location}"'
    return query

def build_github_queries(skills: list, location: str) -> list:
    """
    GitHub：主語言 AND，次語言 OR（多查詢策略）
    GitHub Search 不支援 OR，改為：
      - 查詢 1：主語言1 + 主語言2（AND）
      - 查詢 2：主語言1 + 次語言輪替（覆蓋更多人）
    """
    primary   = [s for s in skills[:2] if s]
    secondary = [s for s in skills[2:5] if s]

    location_variants = [location, 'Taipei'] if location.lower() == 'taiwan' else [location]
    queries = []

    # 主查詢：前 2 個主語言 AND
    if primary:
        lang_part = ' '.join(f'language:{s}' for s in primary)
        for loc in location_variants:
            queries.append(f'{lang_part} location:{loc}')

    # 次查詢：主語言1 + 每個次語言
    if primary and secondary:
        for sec in secondary:
            q = f'language:{primary[0]} language:{sec} location:{location}'
            if q not in queries:
                queries.append(q)

    return queries or [f'location:{location}']


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
# LinkedIn via Playwright（真實 Chrome 瀏覽器，主要方法）
# ============================================================
def search_linkedin_via_playwright(skills, location="台灣", pages=10):
    """
    用 Playwright 啟動真實 Chromium，在 Google 搜尋 site:linkedin.com/in/ 關鍵字。
    比 urllib 更不容易被 CAPTCHA 擋。
    需要：pip install playwright && playwright install chromium
    """
    if not PLAYWRIGHT_AVAILABLE:
        log("Playwright 未安裝，跳過（將使用 urllib 備援）")
        return {'success': False, 'data': [], 'reason': 'playwright_not_installed'}

    query = build_linkedin_query(skills, location)
    log(f"Playwright Google query: {query}")

    results = []
    seen_urls = set()

    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(
                headless=True,
                args=[
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--disable-blink-features=AutomationControlled',
                ],
            )
            ctx = browser.new_context(
                user_agent=random.choice(USER_AGENTS),
                locale='zh-TW',
                viewport={'width': 1280, 'height': 800},
                extra_http_headers={
                    'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
                },
            )
            # 隱藏 webdriver 特徵
            ctx.add_init_script(
                "Object.defineProperty(navigator,'webdriver',{get:()=>undefined})"
            )
            page = ctx.new_page()

            try:
                for pg in range(pages):
                    start = pg * 10
                    url = (
                        f"https://www.google.com/search"
                        f"?q={quote(query)}&start={start}&num=10&hl=zh-TW"
                    )
                    page.goto(url, wait_until='domcontentloaded', timeout=30000)
                    time.sleep(random.uniform(2.5, 5.0))

                    html = page.content()

                    if is_captcha_page(html):
                        log("Playwright: Google CAPTCHA 偵測到，停止搜尋")
                        break

                    page_items = extract_linkedin_urls_from_html(html)
                    # 每頁隨機抽 5 筆，增加多樣性
                    if len(page_items) > SAMPLE_PER_PAGE:
                        page_items = random.sample(page_items, SAMPLE_PER_PAGE)
                    for item in page_items:
                        li_url = item['linkedin_url']
                        if li_url not in seen_urls:
                            seen_urls.add(li_url)
                            results.append(item)

                    log(f"Playwright page {pg+1}: 本頁 {len(page_items)} 筆，累計 {len(results)} 筆")

                    if pg < pages - 1:
                        time.sleep(random.uniform(3.0, 6.0))

            finally:
                browser.close()

    except Exception as e:
        log(f"Playwright 執行失敗：{e}（將使用 urllib 備援）")
        return {'success': False, 'data': results, 'reason': str(e)}

    log(f"Playwright LinkedIn: {len(results)} 筆")
    return {'success': True, 'data': results}


# ============================================================
# LinkedIn via Google / Bing / Brave
# ============================================================
def search_linkedin_via_google(skills, location="台灣", pages=10):
    results = []
    seen_urls = set()
    captcha_detected = False

    query = build_linkedin_query(skills, location)
    log(f"Google query: {query}")

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

        page_items = extract_linkedin_urls_from_html(text)
        if len(page_items) > SAMPLE_PER_PAGE:
            page_items = random.sample(page_items, SAMPLE_PER_PAGE)
        for item in page_items:
            url = item['linkedin_url']
            if url not in seen_urls:
                seen_urls.add(url)
                results.append(item)

    log(f"Google LinkedIn: {len(results)} 筆")
    return {'success': True, 'data': results, 'captcha': captcha_detected}


def search_linkedin_via_bing(skills, location="Taiwan", pages=10):
    results = []
    seen_urls = set()

    location_en = location if location in ('Taiwan', 'Singapore', 'Hong Kong') else 'Taiwan'
    query = build_linkedin_query(skills, location_en)
    log(f"Bing query: {query}")

    for page in range(pages):
        first = page * 10 + 1
        search_url = f"https://www.bing.com/search?q={quote(query)}&first={first}&count=10"
        anti_scraping_delay(2.0, 4.0)

        text, status = http_get(search_url)
        if status != 200:
            log(f"Bing search HTTP {status}")
            continue

        page_items = extract_linkedin_urls_from_html(text)
        if len(page_items) > SAMPLE_PER_PAGE:
            page_items = random.sample(page_items, SAMPLE_PER_PAGE)
        for item in page_items:
            url = item['linkedin_url']
            if url not in seen_urls:
                seen_urls.add(url)
                results.append(item)

    log(f"Bing LinkedIn: {len(results)} 筆")
    return {'success': True, 'data': results}


def search_linkedin_via_brave(skills, brave_api_key, location="Taiwan", pages=10):
    """Brave Search API（官方 JSON API，不需解析 HTML）"""
    results = []
    seen_urls = set()

    query = build_linkedin_query(skills, location)
    log(f"Brave query: {query}")
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
        page_raw = data.get('web', {}).get('results', [])
        # 每頁隨機抽 5 筆
        if len(page_raw) > SAMPLE_PER_PAGE:
            page_raw = random.sample(page_raw, SAMPLE_PER_PAGE)
        for r in page_raw:
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
    """
    四層備援：
      1. Playwright 真實 Chrome（主要，最不易被擋）
      2. Google urllib（Playwright 失敗時）
      3. Bing urllib（Google 被 CAPTCHA 擋時）
      4. Brave Search API（有 API Key 時額外補充）
    """
    all_data: list = []
    seen: set = set()
    source_used: list = []

    # ── 1. Playwright（真實瀏覽器，優先） ──────────────────────
    if PLAYWRIGHT_AVAILABLE:
        log("LinkedIn: 嘗試 Playwright（真實 Chrome）...")
        pw_result = search_linkedin_via_playwright(skills, location=location_zh, pages=pages)
        for item in pw_result.get('data', []):
            if item['linkedin_url'] not in seen:
                seen.add(item['linkedin_url'])
                all_data.append(item)
        if pw_result.get('success'):
            source_used.append('playwright')
            log(f"LinkedIn Playwright: {len(all_data)} 筆")
        else:
            log(f"Playwright 失敗（{pw_result.get('reason','')}），切換 urllib 備援...")
    else:
        log("LinkedIn: Playwright 未安裝，直接使用 Google urllib...")

    # ── 2. Google urllib（Playwright 沒有或結果不足） ──────────
    if not PLAYWRIGHT_AVAILABLE or len(all_data) < 3:
        log("LinkedIn: 嘗試 Google urllib...")
        google_result = search_linkedin_via_google(skills, location=location_zh, pages=pages)
        for item in google_result.get('data', []):
            if item['linkedin_url'] not in seen:
                seen.add(item['linkedin_url'])
                all_data.append(item)
        source_used.append('google')

        # ── 3. Bing urllib（Google 被 CAPTCHA 或結果不足） ──────
        if google_result.get('captcha') or len(all_data) < 3:
            reason = "CAPTCHA" if google_result.get('captcha') else f"結果不足（{len(all_data)} 筆）"
            log(f"LinkedIn: Google {reason}，切換 Bing...")
            for item in search_linkedin_via_bing(skills, location=location_en, pages=pages).get('data', []):
                if item['linkedin_url'] not in seen:
                    seen.add(item['linkedin_url'])
                    all_data.append(item)
            source_used.append('bing')

    # ── 4. Brave API（有 Key 時額外補充） ─────────────────────
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
    parser.add_argument('--primary-skills',   default='',
                        help='主關鍵字（AND），逗號分隔。有值時忽略 required-skills 前兩個')
    parser.add_argument('--secondary-skills',  default='',
                        help='次關鍵字（OR），逗號分隔')
    parser.add_argument('--industry', default='')
    parser.add_argument('--location', default='Taiwan')
    parser.add_argument('--github-token', default='')
    parser.add_argument('--brave-key', default='')
    parser.add_argument('--pages', type=int, default=10)
    parser.add_argument('--sample-per-page', type=int, default=5, dest='sample_per_page',
                        help='每頁隨機抽取人數（1-10）')
    parser.add_argument('--output-format', default='json')
    args = parser.parse_args()

    # 動態覆蓋每頁抽樣數（module-level global，thread safe 因已在 threading 前設定）
    global SAMPLE_PER_PAGE
    SAMPLE_PER_PAGE = max(1, min(10, args.sample_per_page))

    # 若有明確指定 primary/secondary，用那個；否則從 required-skills 自動分割
    if args.primary_skills:
        primary_skills   = [s.strip() for s in args.primary_skills.split(',')   if s.strip()]
        secondary_skills = [s.strip() for s in args.secondary_skills.split(',') if s.strip()]
        skills = primary_skills + secondary_skills
    else:
        skills = [s.strip() for s in args.required_skills.split(',') if s.strip()]
        primary_skills   = skills[:2]
        secondary_skills = skills[2:]
    token = args.github_token.strip() or None
    brave_key = args.brave_key.strip() or None
    pages = max(1, min(10, args.pages))

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
