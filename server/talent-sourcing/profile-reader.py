#!/usr/bin/env python3
"""
profile-reader.py — 用 Playwright 真實瀏覽器讀取候選人 GitHub / LinkedIn 個人頁
供 one-bot-pipeline.py 評分階段使用

Anti-detection 機制：
  - 隨機 User-Agent（每次建立 Context 都換）
  - 隨機 viewport 尺寸
  - 隨機延遲（模擬閱讀 / 思考時間）
  - 隨機滾動行為（速度 + 幅度隨機）
  - 隨機滑鼠晃動
  - 隱藏 webdriver / automation 特徵（JS injection）
  - 候選人之間長時間停頓（10-20 秒）
  - 模擬台灣時區 + 語言設定
"""

import time
import random
import re
import sys
from typing import Optional, Dict, List

try:
    from playwright.sync_api import sync_playwright, Page, BrowserContext
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False


# ─── 常數 ─────────────────────────────────────────────────────────────────────

USER_AGENTS = [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
]

STEALTH_JS = """
    // 隱藏 webdriver 特徵
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

    // 偽裝 plugins（空的 plugins 是機器人特徵）
    Object.defineProperty(navigator, 'plugins', {
        get: () => {
            const arr = [1, 2, 3, 4, 5];
            arr.__proto__ = PluginArray.prototype;
            return arr;
        }
    });

    // 語言設定
    Object.defineProperty(navigator, 'languages', {
        get: () => ['zh-TW', 'zh', 'en-US', 'en']
    });

    // 偽裝 Chrome runtime
    window.chrome = { runtime: {}, loadTimes: () => {}, csi: () => {}, app: {} };

    // 移除 automation 旗標
    delete window.__playwright;
    delete window.__pwInitScripts;
"""


# ─── 輔助函數 ──────────────────────────────────────────────────────────────────

def _log(msg: str):
    print(f"[profile-reader] {msg}", file=sys.stderr, flush=True)


def _human_delay(min_s: float = 1.5, max_s: float = 4.0):
    """模擬人類閱讀/思考的停頓"""
    t = random.uniform(min_s, max_s)
    time.sleep(t)


def _human_scroll(page: 'Page', total_distance: int = None):
    """
    模擬人類滾動：分多次滾動、速度不均勻、偶爾往回滾一小段。
    """
    if total_distance is None:
        total_distance = random.randint(600, 1800)

    scrolled = 0
    while scrolled < total_distance:
        # 每次滾動幅度：80-350px，模擬滑鼠滾輪
        chunk = random.randint(80, 350)
        # 偶爾往回滾一小段（7% 機率）
        if random.random() < 0.07 and scrolled > 200:
            chunk = -random.randint(50, 150)
        page.evaluate(f"window.scrollBy(0, {chunk})")
        scrolled += chunk
        time.sleep(random.uniform(0.08, 0.35))

    # 最後停留一下，模擬閱讀
    _human_delay(0.5, 1.5)


def _random_mouse_wiggle(page: 'Page'):
    """滑鼠隨機晃動，讓行為更像人類"""
    try:
        w = random.randint(400, 1200)
        h = random.randint(200, 600)
        page.mouse.move(w, h, steps=random.randint(5, 15))
        time.sleep(random.uniform(0.1, 0.3))
        page.mouse.move(
            w + random.randint(-80, 80),
            h + random.randint(-60, 60),
            steps=random.randint(3, 10)
        )
    except Exception:
        pass  # 滑鼠晃動失敗不影響主流程


def _between_candidates_delay():
    """候選人之間的長停頓（防止連續高頻請求被偵測）"""
    t = random.uniform(10, 20)
    _log(f"  候選人間隔停頓 {t:.1f} 秒（反偵測）")
    time.sleep(t)


# ─── 主類別 ────────────────────────────────────────────────────────────────────

class ProfileReader:
    """
    單一 Playwright Chromium 實例，讀取多位候選人頁面。
    使用 with 語法確保瀏覽器正確關閉：

        with ProfileReader() as reader:
            github_data = reader.read_github_profile("https://github.com/xxx")
            li_data     = reader.read_linkedin_profile("https://linkedin.com/in/xxx")
    """

    def __init__(self):
        self._pw      = None
        self._browser = None
        self._context: Optional[BrowserContext] = None
        self._candidate_count = 0  # 讀過幾位候選人（用於觸發 context 輪換）

    def __enter__(self):
        if PLAYWRIGHT_AVAILABLE:
            self._start()
        return self

    def __exit__(self, *_):
        self._stop()

    def _start(self):
        self._pw = sync_playwright().start()
        self._browser = self._pw.chromium.launch(
            headless=True,
            args=[
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-blink-features=AutomationControlled',
                '--disable-infobars',
                '--disable-extensions',
                f'--window-size={random.randint(1280,1440)},{random.randint(760,900)}',
            ]
        )
        self._new_context()

    def _new_context(self):
        """建立新的瀏覽器 Context（每讀 5 位候選人換一次，增加多樣性）"""
        if self._context:
            try:
                self._context.close()
            except Exception:
                pass

        self._context = self._browser.new_context(
            user_agent=random.choice(USER_AGENTS),
            viewport={
                'width':  random.randint(1280, 1440),
                'height': random.randint(700,  900),
            },
            locale='zh-TW',
            timezone_id='Asia/Taipei',
            extra_http_headers={
                'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'DNT': '1',
            }
        )
        self._context.add_init_script(STEALTH_JS)

    def _stop(self):
        try:
            if self._context: self._context.close()
            if self._browser: self._browser.close()
            if self._pw:      self._pw.stop()
        except Exception:
            pass

    def _open_page(self, url: str, timeout_ms: int = 25000) -> Optional['Page']:
        """開啟頁面，回傳 Page 物件；失敗回傳 None"""
        if not PLAYWRIGHT_AVAILABLE or not self._context:
            return None
        # 每 5 位候選人換一次 Context
        self._candidate_count += 1
        if self._candidate_count % 5 == 0:
            _log("  輪換瀏覽器 Context（反偵測）")
            self._new_context()

        page = self._context.new_page()
        try:
            page.goto(url, wait_until='domcontentloaded', timeout=timeout_ms)
            _human_delay(1.5, 3.5)
            _random_mouse_wiggle(page)
            _human_scroll(page)
            return page
        except Exception as e:
            _log(f"  開啟頁面失敗 {url}：{e}")
            try: page.close()
            except Exception: pass
            return None

    # ──────────────────────────────────────────────────────────────────────────
    # GitHub
    # ──────────────────────────────────────────────────────────────────────────

    def read_github_profile(self, github_url: str) -> Dict:
        """
        開啟 GitHub 個人頁，讀取：
          - 姓名、bio、公司、地點、追蹤者數
          - Pinned repos（名稱 + 描述 + 語言）
          - Profile README 全文（有的話）
          - 貢獻圖活躍度
        """
        result: Dict = {
            'url': github_url,
            'name': '', 'bio': '', 'company': '', 'location': '',
            'followers': 0,
            'pinned_repos': [],   # [{name, description, language}, ...]
            'languages': [],       # 所有 pinned repo 語言（去重）
            'readme_text': '',     # Profile README 文字（最多 3000 字元）
            'is_active': False,    # 貢獻圖近期有活動
            'read_success': False,
        }

        if not PLAYWRIGHT_AVAILABLE or not self._context:
            return result

        _log(f"  讀取 GitHub：{github_url}")
        page = self._open_page(github_url)
        if not page:
            return result

        try:
            # ── 基本資訊 ──
            for sel, field in [
                ('[itemprop="name"], .p-name',          'name'),
                ('[data-bio-text], .p-note',             'bio'),
                ('[itemprop="worksFor"], .p-org',        'company'),
                ('[itemprop="homeLocation"], .p-label',  'location'),
            ]:
                el = page.query_selector(sel)
                if el:
                    result[field] = el.inner_text().strip()

            # ── 追蹤者 ──
            followers_el = page.query_selector('a[href$="?tab=followers"] .text-bold')
            if followers_el:
                try:
                    result['followers'] = int(
                        followers_el.inner_text().replace(',', '').replace('k', '000').strip()
                    )
                except ValueError:
                    pass

            # ── Pinned repos ──
            for item in page.query_selector_all('.pinned-item-list-item')[:6]:
                name_el  = item.query_selector('.repo')
                desc_el  = item.query_selector('p.pinned-item-desc')
                lang_el  = item.query_selector('[itemprop="programmingLanguage"]')
                stars_el = item.query_selector('.pinned-item-meta svg.octicon-star + span')
                if name_el:
                    lang = lang_el.inner_text().strip() if lang_el else ''
                    result['pinned_repos'].append({
                        'name':        name_el.inner_text().strip(),
                        'description': desc_el.inner_text().strip() if desc_el else '',
                        'language':    lang,
                        'stars':       stars_el.inner_text().strip() if stars_el else '0',
                    })
                    if lang and lang not in result['languages']:
                        result['languages'].append(lang)

            # ── Profile README ──
            readme_el = page.query_selector('.markdown-body')
            if readme_el:
                result['readme_text'] = readme_el.inner_text().strip()[:3000]

            # ── 活躍度（貢獻圖） ──
            contrib_svg = page.query_selector('.js-calendar-graph-svg')
            if contrib_svg:
                contrib_html = contrib_svg.inner_html()
                active_days = len(re.findall(r'data-count="([1-9]\d*)"', contrib_html))
                result['is_active'] = active_days > 15

            result['read_success'] = True
            _log(f"    ✓ GitHub 讀取成功：{result['name'] or '(無姓名)'} | "
                 f"語言：{result['languages']} | 活躍：{result['is_active']}")

        except Exception as e:
            result['error'] = str(e)
            _log(f"    ✗ GitHub 讀取例外：{e}")
        finally:
            page.close()

        return result

    # ──────────────────────────────────────────────────────────────────────────
    # LinkedIn
    # ──────────────────────────────────────────────────────────────────────────

    def read_linkedin_profile(self, linkedin_url: str) -> Dict:
        """
        嘗試讀取 LinkedIn 個人頁公開資訊。
        - 未登入：可讀取姓名、職稱、公司、摘要前幾行
        - 被導向登入頁：login_required=True，評分器退回已知資訊
        """
        result: Dict = {
            'url': linkedin_url,
            'name': '', 'headline': '', 'location': '',
            'summary': '',
            'current_position': '', 'current_company': '',
            'read_success': False,
            'login_required': False,
        }

        if not PLAYWRIGHT_AVAILABLE or not self._context:
            return result

        _log(f"  讀取 LinkedIn：{linkedin_url}")
        page = self._open_page(linkedin_url, timeout_ms=30000)
        if not page:
            return result

        try:
            current_url = page.url

            # 偵測登入牆
            if any(kw in current_url for kw in ['linkedin.com/login', 'linkedin.com/checkpoint',
                                                  'linkedin.com/authwall']):
                result['login_required'] = True
                _log("    ⚠ LinkedIn 要求登入（未登入狀態）")
                return result

            # ── 姓名 ──
            for sel in [
                'h1.top-card-layout__title',
                'h1[class*="name"]',
                '.top-card__title',
                'h1',
            ]:
                el = page.query_selector(sel)
                if el:
                    text = el.inner_text().strip()
                    if text and len(text) < 80:
                        result['name'] = text
                        break

            # ── Headline（職稱摘要）──
            for sel in [
                '.top-card-layout__headline',
                '.top-card-layout__second-subline',
                '[class*="headline"]',
                '.top-card__sublines .top-card__subline-item:first-child',
            ]:
                el = page.query_selector(sel)
                if el:
                    text = el.inner_text().strip()
                    if text:
                        result['headline'] = text
                        break

            # ── 地點 ──
            for sel in [
                '.top-card__subline-item',
                '[class*="location"]',
                '.profile-info-subheader .not-first-middot',
            ]:
                el = page.query_selector(sel)
                if el:
                    text = el.inner_text().strip()
                    if text and len(text) < 60:
                        result['location'] = text
                        break

            # ── About / Summary ──
            for sel in [
                '.core-section-container__content .show-more-less-html__markup',
                '.about-section p',
                '[class*="about"] p',
                '.summary',
            ]:
                el = page.query_selector(sel)
                if el:
                    result['summary'] = el.inner_text().strip()[:1000]
                    break

            # ── 目前職位（第一個 experience item）──
            for pos_sel, comp_sel in [
                ('.experience-item h3', '.experience-item h4'),
                ('.experience__list-item h3', '.experience__list-item h4'),
            ]:
                pos_el  = page.query_selector(pos_sel)
                comp_el = page.query_selector(comp_sel)
                if pos_el:
                    result['current_position'] = pos_el.inner_text().strip()
                if comp_el:
                    result['current_company'] = comp_el.inner_text().strip()
                if pos_el:
                    break

            result['read_success'] = bool(result['name'] or result['headline'])
            _log(f"    {'✓' if result['read_success'] else '✗'} LinkedIn："
                 f"{result['name']} | {result['headline'][:40] if result['headline'] else '(無 headline)'}")

        except Exception as e:
            result['error'] = str(e)
            _log(f"    ✗ LinkedIn 讀取例外：{e}")
        finally:
            page.close()

        return result


# ─── 從 profile 資料建立評分用摘要 ───────────────────────────────────────────

def enrich_candidate_for_scoring(raw: Dict, github_data: Dict, linkedin_data: Dict) -> Dict:
    """
    把 ProfileReader 讀到的真實內容合併回 raw（供評分引擎使用）。
    raw 是 one-bot-pipeline.py 傳入的候選人原始 dict。
    """
    enriched = dict(raw)

    # ── 從 GitHub 補充 ──
    if github_data.get('read_success'):
        # 語言 → 補入 skills
        existing_skills = [s.strip() for s in (enriched.get('skills', '') or '').split(',') if s.strip()]
        gh_langs = github_data.get('languages', [])
        merged = list(dict.fromkeys(existing_skills + gh_langs))  # 去重保順序
        enriched['skills'] = ', '.join(merged[:12])

        # 公司
        if github_data.get('company') and not enriched.get('company'):
            enriched['company'] = github_data['company']

        # 地點
        if github_data.get('location') and not enriched.get('location'):
            enriched['location'] = github_data['location']

        # 活躍度 → 寫入 notes（評分器偵測）
        notes_parts = [enriched.get('notes', '') or '']
        if github_data.get('is_active'):
            notes_parts.append('GitHub近期活躍')
        if github_data.get('followers', 0) > 100:
            notes_parts.append(f"GitHub {github_data['followers']} followers")

        # README / bio 含求職關鍵字 → 寫入 notes
        text_to_scan = ' '.join([
            github_data.get('bio', ''),
            github_data.get('readme_text', ''),
        ]).lower()
        if any(kw in text_to_scan for kw in [
            'open to work', 'seeking', 'looking for', '求職', '尋找機會',
            'available for', 'job hunting', 'opentowork',
        ]):
            notes_parts.append('Open to Work（GitHub README偵測）')

        enriched['notes'] = ' | '.join(filter(None, notes_parts))

        # Pinned repo 描述 → 補入 bio
        if github_data.get('pinned_repos'):
            repo_summary = '; '.join(
                f"{r['name']}（{r['description'][:40]}）"
                for r in github_data['pinned_repos'][:3]
                if r.get('description')
            )
            if repo_summary:
                enriched['bio'] = (enriched.get('bio') or '') + f' | Pinned: {repo_summary}'

    # ── 從 LinkedIn 補充 ──
    if linkedin_data.get('read_success'):
        if linkedin_data.get('headline') and not enriched.get('title'):
            enriched['title'] = linkedin_data['headline']
        if linkedin_data.get('current_company') and not enriched.get('company'):
            enriched['company'] = linkedin_data['current_company']
        if linkedin_data.get('location') and not enriched.get('location'):
            enriched['location'] = linkedin_data['location']

        # Summary 含求職關鍵字
        summary_lower = (linkedin_data.get('summary', '') or '').lower()
        if any(kw in summary_lower for kw in [
            'open to', 'seeking', 'looking for', '求職', '積極尋找',
        ]):
            enriched['notes'] = (enriched.get('notes') or '') + ' | Open to Work（LinkedIn摘要偵測）'

    return enriched


# ─── 獨立測試 ─────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    import json

    urls = sys.argv[1:] if len(sys.argv) > 1 else [
        'https://github.com/torvalds',
    ]

    with ProfileReader() as reader:
        for url in urls:
            print(f"\n{'='*60}", file=sys.stderr)
            if 'linkedin.com' in url:
                data = reader.read_linkedin_profile(url)
            else:
                data = reader.read_github_profile(url)
            print(json.dumps(data, ensure_ascii=False, indent=2))

            if len(urls) > 1:
                _between_candidates_delay()
