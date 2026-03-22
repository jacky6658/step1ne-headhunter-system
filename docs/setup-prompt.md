# 設定提示詞

> 貼給另一台電腦的 Claude Code，讓他幫你更新兩隻龍蝦的提示詞文件

```
幫我做以下事情：

1. git pull 這兩個 repo 到最新版：
   - https://github.com/jacky6658/step1ne-headhunter-system
   - https://github.com/jacky6658/headhunter-crawler

2. 我本機有兩隻龍蝦（兩個獨立的 workspace），每隻龍蝦都有自己的提示詞文件（agent.md、soul.md、tool.md、user.md、heartbeat.md）

3. 找到兩隻龍蝦的 workspace 目錄，跟我說在哪裡

4. 用 GitHub 上最新的內容更新他們的提示詞文件：
   - 執行長龍蝦 → 用 step1ne-headhunter-system/docs/ceo/ 的內容更新他的 agent.md、user.md、tool.md
   - 獵頭顧問龍蝦 → 用 step1ne-headhunter-system/docs/agent/ 的內容更新他的 agent.md、user.md、tool.md

5. 獵頭顧問龍蝦還需要讀閉環提示詞，把 headhunter-crawler/docs/閉環執行提示詞.md 的路徑或內容放進他能讀到的地方

6. 確認本機環境（PostgreSQL、後端 API、爬蟲系統、Chrome CDP）都能跑

7. 設定好後跟我說，我再去開那兩隻龍蝦讓他們開始工作
```

---

## Claude Code 讀到這裡的說明

### 你要做的事

1. **找到兩隻龍蝦的 workspace 目錄**（他們各自有 agent.md、soul.md、tool.md、user.md、heartbeat.md）
2. **用 GitHub 最新版本覆蓋他們的提示詞文件**：

| 龍蝦 | 他的文件 | 用 GitHub 哪份更新 |
|------|---------|-------------------|
| 執行長 AI | agent.md | `docs/ceo/agent.md` |
| 執行長 AI | user.md | `docs/ceo/user.md` |
| 執行長 AI | tool.md | `docs/ceo/tool.md` |
| 獵頭顧問龍蝦 | agent.md | `docs/agent/agent.md` |
| 獵頭顧問龍蝦 | user.md | `docs/agent/user.md` |
| 獵頭顧問龍蝦 | tool.md | `docs/agent/tool.md` |

3. **獵頭顧問龍蝦額外需要**：閉環執行提示詞（`headhunter-crawler/docs/閉環執行提示詞.md`）放到他能讀到的位置
4. **soul.md 和 heartbeat.md 不要動**（除非主人說要改）
5. **確認環境**能跑

### 環境資訊

| 項目 | 值 |
|------|-----|
| 後端 API | http://localhost:3001 |
| 爬蟲系統 | http://localhost:5050 |
| PostgreSQL | postgresql://step1ne@localhost:5432/step1ne |
| API Key | PotfZ42-qPyY4uqSwqstpxllQB1alxVfjJsm3Mgp3HQ |
| Chrome CDP | localhost:9222 |
| Telegram Bot ID | 8342445243 |
| Telegram Topic ID | 1247 |
| 主人 | Jacky |
