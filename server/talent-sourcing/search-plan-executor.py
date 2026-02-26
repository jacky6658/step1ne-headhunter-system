#!/usr/bin/env python3
"""
Step1ne 人才搜尋執行器 v2
GitHub API 真實搜尋 + Google 搜尋 LinkedIn 個人頁
含反爬蟲機制：隨機 UA、隨機延遲、robots.txt 遵守、停用自動化識別
"""
import json
import sys
import time
import random
import argparse
import re
from urllib.parse import quote, unquote
from urllib.robotparser import RobotFileParser

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
        'Accept-Encoding': 'gzip, deflate, br',
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

def check_robots_txt(base_url):
    """遵守 robots.txt"""
    try:
        rp = RobotFileParser()
        rp.set_url(f"{base_url}/robots.txt")
        rp.read()
        return rp
    except Exception:
        return None

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
    rp = check_robots_txt("https://www.google.com")
    session = requests.Session()
    results = []
    seen_urls = set()

    skill_query = ' '.join(f'"{s}"' for s in skills[:3])
    query = f'site:linkedin.com/in/ {skill_query} "{location}"'

    for page in range(pages):
        start = page * 10
        search_url = f"https://www.google.com/search?q={quote(query)}&start={start}&num=10&hl=zh-TW"

        # 對抗指紋識別：每頁換 User-Agent
        session.headers.update(get_browser_headers())

        # 遵守 robots.txt
        if rp and not rp.can_fetch('*', search_url):
            log(f"robots.txt 不允許: {search_url}")
            continue

        # 對抗速率限制：隨機延遲 2-5 秒
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

    return {'success': True, 'data': results}


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

    # 2. LinkedIn via Google
    log(f"[2/2] LinkedIn (Google) 搜尋 ({pages} 頁)...")
    linkedin_result = search_linkedin_via_google(skills, location='台灣', pages=pages)
    linkedin_candidates = linkedin_result.get('data', [])
    output['linkedin']['success'] = linkedin_result.get('success', False)
    output['linkedin']['count'] = len(linkedin_candidates)
    log(f"LinkedIn: {len(linkedin_candidates)} 位")

    # 3. 合併
    all_candidates = github_candidates + linkedin_candidates
    output['all_candidates'] = all_candidates
    output['total_found'] = len(all_candidates)
    log(f"完成，共 {len(all_candidates)} 位候選人")

    print(json.dumps(output, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    main()
