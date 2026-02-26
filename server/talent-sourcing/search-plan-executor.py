#!/usr/bin/env python3
"""
Step1ne 人才搜尋執行器 v2
GitHub API 真實搜尋 + Google/Bing 搜尋 LinkedIn 個人頁
含反爬蟲機制：隨機 UA、隨機延遲、Bing 備援（Google 被封鎖時自動切換）
"""
import json
import sys
import time
import random
import argparse
import re
from urllib.parse import quote, unquote

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    print(json.dumps({
        "error": "missing_dependencies",
        "message": "請執行：pip3 install requests beautifulsoup4"
    }), flush=True)
    sys.exit(1)

# ============================================================
# 反爬蟲設定
# ============================================================
USER_AGENTS = [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Safari/605.1.15',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
]

def get_browser_headers():
    """隨機 User-Agent，對抗 UA 指紋識別"""
    return {
        'User-Agent': random.choice(USER_AGENTS),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Cache-Control': 'max-age=0',
    }

def anti_scraping_delay(min_s=2.0, max_s=5.0):
    """隨機延遲，對抗速率限制"""
    delay = random.uniform(min_s, max_s)
    time.sleep(delay)

def is_captcha_page(html_text):
    """偵測 Google CAPTCHA / 封鎖頁面"""
    indicators = [
        'g-recaptcha',
        'recaptcha',
        'unusual traffic',
        'detected unusual',
        'Just a moment',
        'Cloudflare',
        'cf-browser-verification',
        '/sorry/index',
        'sitekey',
    ]
    lower = html_text.lower()
    return any(ind.lower() in lower for ind in indicators)

def log(msg):
    print(f"[scraper] {msg}", file=sys.stderr, flush=True)


# ============================================================
# GitHub API 搜尋
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
    headers = {'Accept': 'application/vnd.github.v3+json'}
    if token:
        headers['Authorization'] = f'token {token}'
    return headers

def check_github_rate_limit(token=None):
    try:
        resp = requests.get(
            f"{GITHUB_API}/rate_limit",
            headers=get_github_headers(token),
            timeout=10
        )
        rate = resp.json().get('rate', {})
        return rate.get('remaining', 0), rate.get('limit', 60), rate.get('reset', 0)
    except Exception:
        return 0, 60, 0

def search_github_users(skills, location="Taiwan", token=None, pages=2):
    """GitHub API 搜尋開發者，支援 2-3 頁"""
    remaining, limit, _ = check_github_rate_limit(token)
    log(f"GitHub rate limit: {remaining}/{limit} remaining")

    if remaining < 10:
        return {
            'success': False,
            'rate_limit_warning': True,
            'rate_limit_guide': GITHUB_TOKEN_GUIDE,
            'data': []
        }

    headers = get_github_headers(token)
    all_users = []
    seen_logins = set()

    # 主查詢：用語言 + 地區
    primary_langs = [s for s in skills[:2] if s]
    lang_query = ' '.join(f'language:{s}' for s in primary_langs) if primary_langs else ''
    search_query = f'{lang_query} location:{location}'.strip()

    for page in range(1, pages + 1):
        try:
            anti_scraping_delay(0.5, 1.5)
            resp = requests.get(
                f"{GITHUB_API}/search/users",
                params={'q': search_query, 'per_page': 10, 'page': page, 'sort': 'followers'},
                headers=headers,
                timeout=15
            )

            if resp.status_code == 403:
                return {
                    'success': False,
                    'rate_limit_warning': not bool(token),
                    'rate_limit_guide': GITHUB_TOKEN_GUIDE if not token else '',
                    'data': all_users
                }
            if resp.status_code != 200:
                log(f"GitHub search HTTP {resp.status_code} on page {page}")
                continue

            items = resp.json().get('items', [])
            if not items:
                break

            for user in items:
                login = user.get('login', '')
                if login in seen_logins:
                    continue
                seen_logins.add(login)
                anti_scraping_delay(0.3, 0.8)
                detail = fetch_github_user_detail(login, headers)
                if detail:
                    all_users.append(detail)

        except Exception as e:
            log(f"GitHub page {page} error: {e}")
            continue

    return {'success': True, 'data': all_users}


def fetch_github_user_detail(username, headers):
    """取得 GitHub 用戶詳細資訊 + 語言統計"""
    try:
        resp = requests.get(f"{GITHUB_API}/users/{username}", headers=headers, timeout=10)
        if resp.status_code != 200:
            return None
        user = resp.json()

        repos_resp = requests.get(
            f"{GITHUB_API}/users/{username}/repos",
            params={'sort': 'updated', 'per_page': 10, 'type': 'owner'},
            headers=headers,
            timeout=10
        )
        repos = repos_resp.json() if repos_resp.status_code == 200 else []

        languages = []
        for r in repos:
            lang = r.get('language')
            if lang and lang not in languages:
                languages.append(lang)

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


# ============================================================
# LinkedIn via Google 搜尋
# ============================================================

def search_linkedin_via_google(skills, location="台灣", pages=2):
    """透過 Google 搜尋 LinkedIn 個人頁，支援 2-3 頁"""
    session = requests.Session()
    results = []
    seen_urls = set()
    captcha_detected = False

    skill_query = ' '.join(f'"{s}"' for s in skills[:3])
    query = f'site:linkedin.com/in/ {skill_query} "{location}"'

    for page in range(pages):
        start = page * 10
        search_url = f"https://www.google.com/search?q={quote(query)}&start={start}&num=10&hl=zh-TW"

        session.headers.update(get_browser_headers())
        anti_scraping_delay(2.0, 5.0)

        try:
            resp = session.get(search_url, timeout=15)

            if resp.status_code == 429:
                log("Google 速率限制 429，暫停 15 秒")
                time.sleep(15)
                continue
            if resp.status_code != 200:
                log(f"Google search HTTP {resp.status_code}")
                continue

            if is_captcha_page(resp.text):
                log("Google 偵測到 CAPTCHA / 封鎖頁面，停止 Google 搜尋")
                captcha_detected = True
                break

            soup = BeautifulSoup(resp.text, 'html.parser')
            extracted = extract_linkedin_urls_from_soup(soup)

            for item in extracted:
                url = item.get('linkedin_url', '')
                if url and url not in seen_urls:
                    seen_urls.add(url)
                    results.append(item)

        except Exception as e:
            log(f"Google search page {page + 1} error: {e}")
            continue

    return {'success': True, 'data': results, 'captcha': captcha_detected}


def search_linkedin_via_bing(skills, location="Taiwan", pages=2):
    """透過 Bing 搜尋 LinkedIn 個人頁（備援，Google 被封鎖時啟用）
    Bing 直接提供真實 href，不需處理 /url?q= 重定向。
    """
    session = requests.Session()
    results = []
    seen_urls = set()

    skill_query = ' '.join(f'"{s}"' for s in skills[:3])
    # Bing 同時支援英文與中文地區關鍵字
    location_en = location if location in ('Taiwan', 'Singapore', 'Hong Kong') else 'Taiwan'
    query = f'site:linkedin.com/in/ {skill_query} "{location_en}"'

    for page in range(pages):
        first = page * 10 + 1  # Bing: first=1 代表第 1 筆
        search_url = f"https://www.bing.com/search?q={quote(query)}&first={first}&count=10"

        session.headers.update(get_browser_headers())
        anti_scraping_delay(2.0, 4.0)

        try:
            resp = session.get(search_url, timeout=15)

            if resp.status_code != 200:
                log(f"Bing search HTTP {resp.status_code}")
                continue

            soup = BeautifulSoup(resp.text, 'html.parser')
            extracted = _extract_linkedin_from_bing(soup)

            for item in extracted:
                url = item.get('linkedin_url', '')
                if url and url not in seen_urls:
                    seen_urls.add(url)
                    results.append(item)

        except Exception as e:
            log(f"Bing search page {page + 1} error: {e}")
            continue

    log(f"Bing LinkedIn: {len(results)} 筆")
    return {'success': True, 'data': results}


def _extract_linkedin_from_bing(soup):
    """解析 Bing 搜尋結果中的 LinkedIn 個人頁 URL
    Bing 結構：<li class="b_algo"><h2><a href="https://linkedin.com/in/...">Name - Title</a></h2>
    """
    found = []
    seen = set()

    def add_candidate(url, name='', title='', company=''):
        if url in seen:
            return
        seen.add(url)
        username = url.rstrip('/').split('/')[-1]
        found.append({
            'source': 'linkedin',
            'name': name or username.replace('-', ' ').title(),
            'github_url': '',
            'github_username': '',
            'linkedin_url': url,
            'linkedin_username': username,
            'location': '',
            'bio': title,
            'company': company,
            'email': '',
            'public_repos': 0,
            'followers': 0,
            'skills': [],
            'recent_push': '',
            'top_repos': [],
        })

    # Bing 每個搜尋結果在 <li class="b_algo">
    for result in soup.find_all('li', class_='b_algo'):
        h2 = result.find('h2')
        if not h2:
            continue
        a = h2.find('a', href=True)
        if not a:
            continue
        href = a.get('href', '')
        if 'linkedin.com/in/' not in href:
            continue
        url = clean_linkedin_url(href)
        if not url:
            continue

        # 解析姓名與職稱（格式：「Name - Title | LinkedIn」或「Name | LinkedIn」）
        title_text = a.get_text(strip=True)
        name, job_title = '', ''
        # 移除 " | LinkedIn" 後綴
        title_text = re.sub(r'\s*\|\s*LinkedIn.*$', '', title_text, flags=re.IGNORECASE)
        m = re.match(r'^(.+?)\s*[-–]\s*(.+)$', title_text)
        if m:
            name = m.group(1).strip()
            job_title = m.group(2).strip()
        else:
            name = title_text.strip()

        # 嘗試從摘要取公司
        caption = result.find('div', class_='b_caption') or result.find('p')
        company = ''
        if caption:
            cap_text = caption.get_text(separator=' ', strip=True)
            mc = re.search(r'(?:at|@)\s+([\w\s,\.]+?)(?:\s*·|\s*\||$)', cap_text)
            if mc:
                company = mc.group(1).strip()

        add_candidate(url, name, job_title, company)

    # 備用：直接掃所有 <a> 標籤（有時 Bing 結構不同）
    for tag in soup.find_all('a', href=True):
        href = tag.get('href', '')
        if 'linkedin.com/in/' in href and href.startswith('http'):
            url = clean_linkedin_url(href)
            if url:
                add_candidate(url)

    return found


def search_linkedin_with_fallback(skills, location_zh="台灣", location_en="Taiwan", pages=2):
    """LinkedIn 搜尋：優先 Google，被封鎖時自動切換 Bing"""
    log("LinkedIn: 嘗試 Google...")
    google_result = search_linkedin_via_google(skills, location=location_zh, pages=pages)
    google_data = google_result.get('data', [])

    # 如果 Google 回傳 CAPTCHA 或結果 < 3 筆，切換到 Bing
    if google_result.get('captcha') or len(google_data) < 3:
        reason = "CAPTCHA 封鎖" if google_result.get('captcha') else f"結果不足（{len(google_data)} 筆）"
        log(f"LinkedIn: Google {reason}，切換 Bing 備援...")
        bing_result = search_linkedin_via_bing(skills, location=location_en, pages=pages)
        bing_data = bing_result.get('data', [])

        # 合併去重
        seen = {item['linkedin_url'] for item in google_data}
        for item in bing_data:
            if item['linkedin_url'] not in seen:
                seen.add(item['linkedin_url'])
                google_data.append(item)

        log(f"LinkedIn 最終（Google+Bing 合併）：{len(google_data)} 筆")
        return {'success': True, 'data': google_data, 'source': 'google+bing'}

    log(f"LinkedIn: Google 搜尋成功，{len(google_data)} 筆")
    return {'success': True, 'data': google_data, 'source': 'google'}


def clean_linkedin_url(href):
    """清理並標準化 LinkedIn URL"""
    try:
        url = unquote(href)
        url = url.split('?')[0].split('%3F')[0]
        # 標準化網域
        url = re.sub(r'^https?://[a-z]{2,3}\.linkedin\.com', 'https://www.linkedin.com', url)
        if not re.search(r'linkedin\.com/in/[\w\-]+', url):
            return None
        if not url.endswith('/'):
            url += '/'
        return url
    except Exception:
        return None


def extract_linkedin_urls_from_soup(soup):
    """從 Google 搜尋結果解析 LinkedIn URL"""
    found = []
    seen = set()

    def add_candidate(url, name='', title='', company=''):
        if url in seen:
            return
        seen.add(url)
        username = url.rstrip('/').split('/')[-1]
        found.append({
            'source': 'linkedin',
            'name': name or username.replace('-', ' ').title(),
            'github_url': '',
            'github_username': '',
            'linkedin_url': url,
            'linkedin_username': username,
            'location': '',
            'bio': title,
            'company': company,
            'email': '',
            'public_repos': 0,
            'followers': 0,
            'skills': [],
            'recent_push': '',
            'top_repos': [],
        })

    # 方法一：從 <a href> 中找
    for tag in soup.find_all('a', href=True):
        href = tag.get('href', '')
        url = None
        if 'linkedin.com/in/' in href:
            if href.startswith('/url?q='):
                url = href.split('/url?q=')[1].split('&')[0]
            elif href.startswith('http'):
                url = href
        if url:
            url = clean_linkedin_url(url)
            if url:
                name, title = _extract_name_from_tag(tag)
                add_candidate(url, name, title)

    # 方法二：從 <cite> 文字中找
    for cite in soup.find_all('cite'):
        text = cite.get_text()
        m = re.search(r'(?:https?://)?(?:www\.)?linkedin\.com/in/([\w\-]+)', text)
        if m:
            username = m.group(1)
            url = f'https://www.linkedin.com/in/{username}/'
            add_candidate(url)

    return found


def _extract_name_from_tag(tag):
    """嘗試從搜尋結果片段提取姓名和職稱"""
    name, title = '', ''
    try:
        parent = tag
        for _ in range(6):
            if parent is None:
                break
            parent = getattr(parent, 'parent', None)
            if parent is None:
                break
            text = parent.get_text(separator=' ', strip=True)
            if len(text) > 20:
                m = re.match(r'^([^\-\|·–\n]{3,40}?)[\s]*[-–|·][\s]*(.{3,80}?)[\s]*[\|–\n]', text)
                if m:
                    name = m.group(1).strip()
                    title = m.group(2).strip()
                break
    except Exception:
        pass
    return name, title


# ============================================================
# Main
# ============================================================

def main():
    parser = argparse.ArgumentParser(description='Step1ne 人才搜尋執行器 v2')
    parser.add_argument('--job-title', required=True)
    parser.add_argument('--required-skills', default='')
    parser.add_argument('--industry', default='')
    parser.add_argument('--location', default='Taiwan')
    parser.add_argument('--github-token', default='')
    parser.add_argument('--pages', type=int, default=2)
    parser.add_argument('--output-format', default='json')
    args = parser.parse_args()

    skills = [s.strip() for s in args.required_skills.split(',') if s.strip()]
    token = args.github_token.strip() or None
    pages = max(1, min(3, args.pages))

    log(f"搜尋: {args.job_title} | 技能: {skills} | 頁數: {pages} | token: {'有' if token else '無（無認證模式）'}")

    output = {
        'job_title': args.job_title,
        'industry': args.industry,
        'rate_limit_warning': None,
        'github': {'success': False, 'count': 0},
        'linkedin': {'success': False, 'count': 0},
        'all_candidates': [],
        'total_found': 0,
    }

    # 1. GitHub
    log(f"[1/2] GitHub 搜尋 ({pages} 頁)...")
    github_result = search_github_users(skills, location=args.location, token=token, pages=pages)
    if github_result.get('rate_limit_warning'):
        output['rate_limit_warning'] = github_result.get('rate_limit_guide', '')
    github_candidates = github_result.get('data', [])
    output['github']['success'] = github_result.get('success', False)
    output['github']['count'] = len(github_candidates)
    log(f"GitHub: {len(github_candidates)} 位")

    # 2. LinkedIn via Google（自動備援 Bing）
    log(f"[2/2] LinkedIn 搜尋 ({pages} 頁)，Google 優先，Bing 備援...")
    linkedin_result = search_linkedin_with_fallback(
        skills, location_zh='台灣', location_en=args.location, pages=pages
    )
    linkedin_candidates = linkedin_result.get('data', [])
    linkedin_source = linkedin_result.get('source', 'google')
    output['linkedin']['success'] = linkedin_result.get('success', False)
    output['linkedin']['count'] = len(linkedin_candidates)
    output['linkedin']['source'] = linkedin_source
    log(f"LinkedIn: {len(linkedin_candidates)} 位（來源: {linkedin_source}）")

    # 3. 合併
    all_candidates = github_candidates + linkedin_candidates
    output['all_candidates'] = all_candidates
    output['total_found'] = len(all_candidates)
    log(f"完成，共 {len(all_candidates)} 位候選人")

    print(json.dumps(output, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    main()
