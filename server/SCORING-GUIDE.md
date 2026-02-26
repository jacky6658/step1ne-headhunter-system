# Step1ne 評分 Bot 操作指南

> 本文件供 openclaw / AI Agent 定時評分任務使用
> 適用腳本版本：one-bot-pipeline.py v2

---

## 你的身份與任務

你是 Step1ne 獵頭系統的本地評分代理人。
每次被觸發時，依照以下流程完成今日評分任務，不需等待使用者進一步指示。
操作者身份：`{你的名字}-scoring-bot`（例如：`Jacky-scoring-bot`）

---

## 執行前：確認今日是否有候選人需要評分

呼叫以下 API，確認今日新增且尚未評分的候選人數量：

```
GET https://backendstep1ne.zeabur.app/api/candidates?status=未開始&limit=500
```

回應中的 `data` 陣列，篩選 `created_at` 日期為今天的項目。

- **若數量為 0**：今日無需評分，回報「今日無新增候選人，評分任務結束」，停止執行。
- **若數量 > 0**：繼續下一步。

---

## 步驟一：確認腳本環境

在本機終端機確認以下環境已就緒：

```bash
# 確認 Python 版本（需 3.8+）
python3 --version

# 確認 Playwright 已安裝
python3 -c "from playwright.sync_api import sync_playwright; print('Playwright OK')"

# 確認腳本位置（擇一）
ls server/talent-sourcing/one-bot-pipeline.py
ls ~/step1ne/server/talent-sourcing/one-bot-pipeline.py
```

若 Playwright 未安裝，執行：
```bash
pip3 install playwright
python3 -m playwright install chromium
```

若腳本不存在，從 GitHub 取得：
```bash
git clone https://github.com/jacky6658/step1ne-headhunter-system.git
cd step1ne-headhunter-system/server/talent-sourcing
```

---

## 步驟二：執行評分腳本

進入腳本所在目錄後執行：

```bash
cd server/talent-sourcing

API_BASE_URL=https://backendstep1ne.zeabur.app \
  python3 one-bot-pipeline.py --mode score
```

### 執行說明

| 參數 | 說明 |
|---|---|
| `--mode score` | 只執行評分，不重新爬取 |
| `--mode full` | 爬取 + 評分（完整流程） |
| `--no-profile-read` | 跳過 Playwright 讀頁面（快速模式） |
| `--dry-run` | 試跑，不寫入 DB |
| `--no-claude` | 跳過 AI 結語文字 |

### 評分腳本會自動執行以下動作

1. 呼叫 API 取得今日「未開始」候選人清單
2. 對每位候選人：
   - 用 Playwright 開啟 GitHub 個人頁（讀 README、Pinned repos、followers、活躍度）
   - 用 Playwright 開啟 LinkedIn 個人頁（讀 headline、公司、summary）
   - 執行 6 維確定性評分
3. 評分結果寫回系統：
   - **≥ 80 分** → 狀態更新為 `AI推薦`（進入 Kanban AI推薦欄）
   - **< 80 分** → 狀態更新為 `備選人才`

---

## 步驟三：回報執行結果

腳本執行完畢後，在終端機輸出中找到摘要行（以 `══` 標記）：

```
[HH:MM:SS] ══ 評分完成：AI推薦 X，備選人才 Y，錯誤 Z
```

將結果以以下格式呼叫 API 記錄到系統日誌：

```
POST https://backendstep1ne.zeabur.app/api/system-log
Content-Type: application/json

{
  "action": "SCORE_COMPLETE",
  "actor": "{你的名字}-scoring-bot",
  "detail": "評分完成：AI推薦 X，備選人才 Y，錯誤 Z"
}
```

---

## 評分維度說明（6 維）

| 維度 | 權重 | 評估方式 |
|---|---|---|
| 技能匹配 | 30% | 候選人技能 vs 職缺必要技能重疊度 |
| 年資符合 | 20% | 從職稱估算年資，對比職缺要求 |
| 穩定度 | 15% | 平均任期、跳槽頻率（GitHub 活躍度輔助判斷） |
| 可觸達性 | 15% | 有 LinkedIn / GitHub URL 可聯繫 |
| 地點符合 | 10% | 台灣在地優先 |
| 活躍度信號 | 10% | GitHub 近期貢獻、open to work 關鍵字偵測 |

---

## 路由規則

```
評分 ≥ 80 分 → 狀態 = AI推薦  → 出現在 Kanban「AI推薦」欄，顧問優先處理
評分 < 80 分 → 狀態 = 備選人才 → 出現在 Kanban「備選人才」欄，備用
```

---

## 反爬蟲等待時間

每位候選人之間自動停頓 **10–20 秒**（random），請勿強制中止腳本。
10 位候選人預計約需 **5–8 分鐘**完成。

---

## 常見問題

**Q: Playwright 開啟頁面失敗怎麼辦？**
A: 腳本自動退回無頁面評分模式（分數略低），不會中斷整批流程。

**Q: LinkedIn 要求登入？**
A: 偵測到登入牆時，LinkedIn 欄位留空，改用已知資訊評分。

**Q: API_BASE_URL 不用設定嗎？**
A: 若在 Zeabur 環境執行，系統自動使用本地 `http://localhost:3001`。本機遠端執行需加 `API_BASE_URL=https://backendstep1ne.zeabur.app`。
