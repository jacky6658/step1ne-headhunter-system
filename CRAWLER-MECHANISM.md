# Step1ne 爬蟲閉環機制文件

> 最後更新：2026-02-26
> 適用版本：one-bot-pipeline.py v2 / search-plan-executor.py v5 / profile-reader.py v1

---

## 一、整體閉環架構

```
前端 Bot 排程設定頁
  │  (設定職缺、頁數、每頁抽樣、排程時間)
  │
  ▼
POST /api/bot/run-now  ─── 手動觸發
  │   or Zeabur Scheduler ─── 定時觸發
  │
  ▼
one-bot-pipeline.py  (Python 主管線)
  │
  ├─── 【SCRAPE 階段】 search-plan-executor.py
  │      ├─ GitHub API 搜尋（並行，5000次/hr 上限）
  │      └─ LinkedIn 搜尋（4層備援：Playwright → Google → Bing → Brave）
  │
  ├─── 【DB去重】 比對現有 LinkedIn URL / GitHub URL / GitHub username
  │
  ├─── 【IMPORT】 POST /api/candidates（狀態=未開始，今日新增）
  │
  ├─── 【SCORE 階段】 profile-reader.py + candidate-scoring-system-v2.py
  │      ├─ Playwright 開啟 GitHub 個人頁（讀 README、pinned repos、followers）
  │      ├─ Playwright 開啟 LinkedIn 個人頁（讀 headline、公司、summary）
  │      └─ 6 維確定性評分（無 LLM，零成本）
  │
  └─── 【ROUTE】 PATCH /api/candidates/:id
         ├─ ≥ 80 分 → 狀態 = AI推薦（進入 Kanban AI推薦欄）
         └─ < 80 分 → 狀態 = 備選人才
```

---

## 二、搜尋引擎策略（search-plan-executor.py）

### GitHub 搜尋
- 使用 **GitHub Search API**（`/search/users?q=language:xxx+location:Taiwan`）
- **多查詢策略**：主語言1 AND 主語言2 + 次語言輪替
- 並行抓取用戶詳細資料（`ThreadPoolExecutor(max_workers=4)`）
- Rate limit：無 Token 60次/小時，有 Token 5000次/小時

### LinkedIn 搜尋（4層備援）

| 層 | 方法 | 效果 |
|---|---|---|
| 1 | **Playwright 真實 Chrome**（主） | 最不易被 CAPTCHA 擋 |
| 2 | Google urllib | Playwright 失敗時備援 |
| 3 | Bing urllib | Google 被 CAPTCHA 時備援 |
| 4 | Brave Search API | 有 API Key 時額外補充 |

### 搜尋 Query 結構
```
site:linkedin.com/in/ "Python" ("Go" OR "Golang")
  ("Kubernetes" OR "K8s" OR "Docker") "台灣"
```
- 主技能（前2個）：AND（候選人必須同時具備）
- 次技能（第3-6個）：OR 群組（有其一即符合）
- 每個技能自動展開同義詞（React → "React" OR "React.js" OR "ReactJS"）

### 每頁抽樣
每個搜尋結果頁隨機抽取 N 筆（預設 5 筆），避免每次都取相同的前排名人選，增加候選人多樣性。

---

## 三、反爬蟲機制

### 搜尋階段（search-plan-executor.py）
| 機制 | 實作 |
|---|---|
| 隨機 User-Agent | 5 種主流瀏覽器 UA 輪換 |
| 請求間延遲 | `anti_scraping_delay(2.0, 5.0)` |
| Playwright 頁面間延遲 | `random.uniform(2.5, 5.0)` 秒 |
| Playwright 頁間跳轉延遲 | `random.uniform(3.0, 6.0)` 秒 |
| CAPTCHA 偵測 | 偵測後自動切換備援方式 |
| 隱藏 webdriver 特徵 | JS 注入（navigator.webdriver → undefined） |

### Profile 讀取階段（profile-reader.py）
| 機制 | 實作 |
|---|---|
| 真實 Chromium 瀏覽器 | Playwright headless mode |
| 隱藏自動化特徵 | Stealth JS（webdriver、plugins、languages、chrome runtime） |
| 隨機 User-Agent | 每次建立 Context 都換 |
| 隨機 Viewport | 1280-1440 × 700-900 px |
| 台灣時區 + 語言設定 | `Asia/Taipei` / `zh-TW` |
| 人類滾動模擬 | 分多次、速度不均、偶爾往回滾（7% 機率） |
| 滑鼠晃動 | `page.mouse.move()` 隨機座標 |
| 候選人間長停頓 | **10-20 秒**（`random.uniform(10, 20)`） |
| Context 輪換 | 每讀 5 位候選人建立新 Context（換指紋） |
| 關閉自動化旗標 | `--disable-blink-features=AutomationControlled` |

---

## 四、DB 去重機制

去重在**匯入前**執行，比對整個 DB 候選人池（非當次爬取批次）。

### 識別碼
1. LinkedIn URL（完整，去尾斜線）
2. GitHub URL（完整，去尾斜線）
3. GitHub username（小寫）

### 流程
```python
get_existing_identifiers()
  → 查 /api/candidates?limit=5000
  → 回傳 (linkedin_urls: set, github_ids: set)

process_job() 逐一檢查每位候選人：
  if li_url in existing_linkedin: 跳過
  if gh_url in existing_github:   跳過
  if gh_user in existing_github:  跳過
  → 通過 → 匯入 → 立即加入去重集合（同批次內再去重）
```

---

## 五、評分系統（6維確定性評分）

### 評分維度
評分引擎：`candidate-scoring-system-v2.py`

| 維度 | 說明 |
|---|---|
| 技能匹配 | 候選人技能 vs 職缺必要技能 |
| 年資符合 | 從職稱估算年資（Senior=6年，Junior=1年...） |
| 穩定度 | 平均任期、跳槽頻率 |
| 可觸達性 | 有 LinkedIn/GitHub URL |
| 地點符合 | 台灣在地 |
| 活躍度 | GitHub 近期貢獻（有 ProfileReader 時） |

### 路由規則
- **≥ 80 分** → 狀態 = `AI推薦`（Kanban AI推薦欄）
- **< 80 分** → 狀態 = `備選人才`

### Profile 讀取強化評分
當 Playwright 可用時，ProfileReader 開啟真實頁面補充：

**GitHub 讀取項目：**
- 姓名、bio、公司、地點、followers 數
- Pinned repos（名稱、描述、語言、Stars）
- Profile README 全文（最多 3000 字元）
- 貢獻活躍度（近期 >15 天有活動 → `is_active=True`）
- 求職關鍵字偵測（"open to work"、"求職"...）

**LinkedIn 讀取項目：**
- 姓名、headline（職稱）、地點
- About/Summary（最多 1000 字元）
- 目前職位、公司
- 求職關鍵字偵測

---

## 六、可調參數

### 前端 Bot 排程設定頁
| 參數 | 範圍 | 預設 | 說明 |
|---|---|---|---|
| 搜尋頁數 | 1-10 | 10 | 每個查詢翻幾頁 |
| 每頁抽取人數 | 1-10 | 5 | 每頁隨機抽取幾筆 |
| 目標職缺 | 最多 5 個 | — | 哪些職缺要搜尋 |

### 環境變數
| 變數 | 說明 |
|---|---|
| `API_BASE_URL` | 後端 API 位址（預設 `http://localhost:3001`） |
| `GITHUB_TOKEN` | GitHub Personal Access Token（提升 API 速率） |
| `BRAVE_KEY` | Brave Search API Key（LinkedIn 搜尋補充） |
| `BOT_ACTOR` | Bot 顯示名稱（日誌用） |
| `BOT_CONSULTANT` | 預設負責顧問（空=讀取 DB 設定） |

### CLI 參數（one-bot-pipeline.py）
```bash
python3 one-bot-pipeline.py \
  --mode full \          # full / scrape / score
  --job-ids 3,7,12 \    # 指定職缺 ID
  --pages 10 \          # 搜尋頁數（1-10）
  --sample-per-page 5 \ # 每頁抽取（1-10）
  --dry-run \           # 試跑，不寫入 DB
  --no-claude \         # 跳過 AI 結語
  --no-profile-read     # 跳過 Playwright 讀頁面
```

---

## 七、部署說明（Zeabur）

### 安裝設定（zbpack.json）
```json
{
  "install_command": "npm install && pip3 install playwright && python3 -m playwright install chromium",
  "start_command": "node server.js"
}
```

### Python 依賴
```
playwright>=1.40.0
```

### 定時排程（Zeabur Scheduler）
在系統 Bot 排程設定頁取得 Cron 表達式，填入 Zeabur → Bot 服務 → Scheduler。

範例（每天 09:00）：
```
0 9 * * *
```

### 本機執行評分（Score Only）
爬取由 Zeabur 執行，評分（含讀頁面）可在本機有 GUI 的環境執行（Playwright 需要 X11 或 headless）：
```bash
API_BASE_URL=https://backendstep1ne.zeabur.app \
  python3 one-bot-pipeline.py --mode score
```

---

## 八、執行紀錄查看

- **系統操作記錄**：Bot 排程設定頁 → 「Bot 執行紀錄」
- **系統日誌**：系統日誌頁面（搜尋 `BOT_RUN_NOW`、`BOT_IMPORT`）
- **候選人結果**：候選人管理頁 → 篩選「未開始」或「AI推薦」

---

## 九、注意事項

1. **LinkedIn 未登入限制**：未登入 LinkedIn 時，Profile 讀取僅能取得公開資訊（姓名、headline、地點），詳細 About/Experience 需登入。評分器在此情況下退回已知資訊。

2. **Playwright 環境**：確保 Zeabur 部署時已執行 `playwright install chromium`，否則自動降級到 urllib 備援。

3. **GitHub Token**：無 Token 時每小時上限 60 次 API 請求（約 6 頁 × 10 筆）。有 Token 可達 5000 次/小時，建議在系統設定頁填入。

4. **反爬蟲延遲**：候選人間隔 10-20 秒，職缺間隔 30-60 秒，多顧問間隔 60-120 秒。完整執行一批可能需要 30-60 分鐘。

5. **評分無 LLM**：評分完全確定性，成本 $0。如需 AI 結語文字，在 Claude Code 環境執行 `--mode score`（不加 `--no-claude`），約每位候選人消耗少量 API 用量。
