# Step1ne Bot 整合範例

這個目錄包含多種程式語言的 Step1ne API 整合範例，讓獵頭顧問的 AI Bot 可以輕鬆呼叫 Step1ne 系統。

---

## 📁 檔案列表

| 檔案 | 語言 | 說明 |
|------|------|------|
| `python-bot.py` | Python | 基礎 Python 整合範例（適用任何 Bot 框架）|
| `telegram-bot.py` | Python | 完整的 Telegram Bot 範例（含指令處理、按鈕互動）|
| `nodejs-bot.js` | Node.js | Node.js 整合範例（適用任何 Bot 框架）|

---

## 🚀 快速開始

### Python Bot（基礎範例）

**1. 安裝依賴**：
```bash
pip install requests
```

**2. 執行測試**：
```bash
python python-bot.py
```

**3. 整合到您的 Bot**：
```python
from python_bot import search_candidates, match_candidates_to_job

# 在您的 Bot 指令處理中
async def handle_search_command(update, context):
    candidates = search_candidates(grade='A')
    # 回傳給用戶...
```

---

### Telegram Bot（完整範例）

**1. 安裝依賴**：
```bash
pip install python-telegram-bot requests
```

**2. 建立 Telegram Bot**：
- 在 Telegram 搜尋 `@BotFather`
- 輸入 `/newbot` 建立新 Bot
- 複製取得的 Token

**3. 設定 Token**：
編輯 `telegram-bot.py`，替換 `YOUR_BOT_TOKEN_HERE`：
```python
TELEGRAM_TOKEN = '7123456789:ABCdefGhIjKlmNoPqRsTuVwXyz'
```

**4. 啟動 Bot**：
```bash
python telegram-bot.py
```

**5. 測試**：
- 在 Telegram 搜尋您的 Bot
- 輸入 `/start` 開始使用
- 輸入 `/search_candidates` 搜尋候選人
- 輸入 `/search_jobs` 搜尋職缺
- 輸入 `/match_job-1` 執行 AI 配對

**支援的指令**：
- `/start` - 開始使用
- `/search_candidates` - 搜尋候選人
- `/search_jobs` - 搜尋職缺
- `/match_job-{id}` - 配對職缺與候選人
- `/view_{id}` - 查看候選人詳情

---

### Node.js Bot（基礎範例）

**1. 安裝依賴**：
```bash
npm install axios
```

**2. 執行測試**：
```bash
node nodejs-bot.js
```

**3. 整合到您的 Bot**：
```javascript
const { searchCandidates, matchCandidatesToJob } = require('./nodejs-bot');

// 在您的 Bot 指令處理中
bot.command('search', async (ctx) => {
  const candidates = await searchCandidates({ grade: 'A' });
  ctx.reply(`找到 ${candidates.length} 位 A 級候選人`);
});
```

---

## 📖 API 功能說明

### 候選人管理

| 功能 | Python | Node.js | 說明 |
|------|--------|---------|------|
| 搜尋候選人 | `search_candidates()` | `searchCandidates()` | 支援關鍵字、狀態、評級篩選 |
| 取得單一候選人 | `get_candidate(id)` | `getCandidate(id)` | 取得詳細資料 |
| 更新狀態 | `update_candidate_status()` | `updateCandidateStatus()` | 更新候選人狀態 |
| AI 評級 | `grade_candidate(id)` | `gradeCandidate(id)` | 自動評級（S/A+/A/B/C）|

### 職缺管理

| 功能 | Python | Node.js | 說明 |
|------|--------|---------|------|
| 搜尋職缺 | `search_jobs()` | `searchJobs()` | 支援狀態、公司、技能篩選 |
| 取得單一職缺 | `get_job(id)` | `getJob(id)` | 取得詳細資料 |

### AI 配對

| 功能 | Python | Node.js | 說明 |
|------|--------|---------|------|
| 批量配對 | `match_candidates_to_job()` | `matchCandidatesToJob()` | 一個職缺 vs 多個候選人 |
| 單一配對 | `match_single_candidate()` | `matchSingleCandidate()` | 一對一配對 |

---

## 🔧 設定說明

### API Base URL

**開發環境**（本機）：
```python
API_BASE = 'http://localhost:3001/api'
```

**正式環境**（龍蝦主機）：
```python
API_BASE = 'https://api-hr.step1ne.com/api'
```

### 認證（未來版本）

當 API 啟用認證後，需要在 headers 加入 API Key：

```python
# Python
headers = {'Authorization': f'Bearer {API_KEY}'}

# Node.js
const headers = { 'Authorization': `Bearer ${API_KEY}` };
```

---

## 💡 使用範例

### 範例 1：搜尋並更新候選人狀態

```python
# 搜尋待聯繫的 A 級候選人
candidates = search_candidates(grade='A', status='待聯繫')

# 更新第一位候選人狀態為「已聯繫」
if candidates:
    candidate_id = candidates[0]['id']
    update_candidate_status(candidate_id, '已聯繫')
    print(f"已更新 {candidates[0]['name']} 狀態為「已聯繫」")
```

### 範例 2：自動配對並推薦

```python
# 取得開放中的職缺
jobs = search_jobs(status='開放中')

# 取得所有 A 級候選人
candidates = search_candidates(grade='A')

# 執行 AI 配對
if jobs and candidates:
    job_id = jobs[0]['id']
    candidate_ids = [c['id'] for c in candidates[:10]]
    
    result = match_candidates_to_job(job_id, candidate_ids)
    
    # 顯示 Top 3 推薦
    print(f"職缺：{jobs[0]['title']}")
    print(f"Top 3 推薦：")
    for i, match in enumerate(result['matches'][:3], 1):
        print(f"{i}. {match['candidate']['name']} - {match['score']:.1f}分")
```

### 範例 3：批量評級候選人

```python
# 取得所有未評級的候選人
candidates = search_candidates()
ungraded = [c for c in candidates if not c.get('grade')]

print(f"找到 {len(ungraded)} 位未評級候選人，開始評級...")

# 批量評級
for candidate in ungraded:
    try:
        result = grade_candidate(candidate['id'])
        print(f"✅ {candidate['name']}: {result['grade']}級 ({result['score']}分)")
    except Exception as e:
        print(f"❌ {candidate['name']}: 評級失敗 - {str(e)}")
```

---

## 🧪 測試

每個範例檔案都可以直接執行來測試 API 連線：

```bash
# Python 基礎範例
python python-bot.py

# Telegram Bot（需要先設定 Token）
python telegram-bot.py

# Node.js 基礎範例
node nodejs-bot.js
```

---

## ❓ 常見問題

### 1. 連線錯誤？

**問題**：`ConnectionRefusedError` 或 `ECONNREFUSED`

**解決方案**：
- 確認 Step1ne 後端是否運行（`http://localhost:3001/api/health`）
- 確認 `API_BASE` 設定正確
- 檢查防火牆設定

### 2. 找不到候選人？

**問題**：`search_candidates()` 回傳空列表

**解決方案**：
- 確認 Google Sheets 履歷池是否有資料
- 確認篩選條件（grade, status）是否過於嚴格
- 使用無參數的 `search_candidates()` 取得所有候選人

### 3. 配對失敗？

**問題**：`match_candidates_to_job()` 拋出錯誤

**解決方案**：
- 確認候選人 ID 有效
- 確認候選人資料完整（有技能、經驗等）
- 檢查後端 Python 環境是否正確安裝

---

## 📚 進階閱讀

- [完整 API 文檔](../API.md)
- [系統架構說明](../ARCHITECTURE.md)
- [常見問題 FAQ](../FAQ.md)

---

## 🤝 支援

遇到問題？
- GitHub Issues: https://github.com/jacky6658/step1ne-headhunter-system/issues
- Email: support@step1ne.com

---

**祝您使用愉快！** 🚀
