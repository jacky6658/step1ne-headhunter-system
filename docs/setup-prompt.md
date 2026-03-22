# 設定提示詞

> 貼給另一台電腦的 Claude Code，讓他幫你設定兩隻龍蝦

```
幫我做以下事情：

1. git pull 這兩個 repo 到最新版：
   - https://github.com/jacky6658/step1ne-headhunter-system
   - https://github.com/jacky6658/headhunter-crawler

2. 讀 step1ne-headhunter-system/docs/setup-prompt.md，裡面有完整說明

3. 我本機有兩隻龍蝦（兩個獨立的 Claude Code session），
   幫我在他們各自的專案目錄下寫好 CLAUDE.md：
   - 一隻是執行長 AI → 用 docs/ceo/ 的三份文件當提示詞
   - 一隻是獵頭顧問龍蝦 → 用 docs/agent/ 的三份文件 + headhunter-crawler/docs/閉環執行提示詞.md 當提示詞

4. 確認本機環境（PostgreSQL、後端 API、爬蟲系統、Chrome CDP）都能跑

5. 設定好後跟我說，我再去開那兩隻龍蝦讓他們開始工作
```

---

## Claude Code 讀到這裡的說明

如果你是被叫來設定龍蝦的 Claude Code，以下是完整資訊：

### 兩隻龍蝦的身份

| 龍蝦 | 身份 | 提示詞來源 | CLAUDE.md 要寫什麼 |
|------|------|-----------|-------------------|
| 執行長 AI | 監督層，盯另一隻龍蝦有沒有做好 | `docs/ceo/agent.md` + `user.md` + `tool.md` | 整合三份文件的核心內容 |
| 獵頭顧問龍蝦 | 執行層，實際跑閉環找人 | `docs/agent/agent.md` + `user.md` + `tool.md` + `headhunter-crawler/docs/閉環執行提示詞.md` | 整合四份文件的核心內容 |

### 環境資訊

| 項目 | 值 |
|------|-----|
| 後端 API | http://localhost:3001（或 https://api-hr.step1ne.com） |
| 爬蟲系統 | http://localhost:5050（或 https://crawler.step1ne.com） |
| PostgreSQL | postgresql://step1ne@localhost:5432/step1ne |
| API Key | PotfZ42-qPyY4uqSwqstpxllQB1alxVfjJsm3Mgp3HQ |
| Chrome CDP | localhost:9222 |
| Telegram Bot ID | 8342445243 |
| Telegram Topic ID | 1247 |
| 主人 | Jacky（有 SQL 直連權限） |

### 你要做的事

1. **找到兩隻龍蝦的專案目錄**（問主人或自己找）
2. **在每個目錄下寫 CLAUDE.md**，把對應的提示詞文件內容整合進去
3. **確認環境**：PostgreSQL 能連、後端 API 能用（不能用的話龍蝦可以用 SQL 直連）、爬蟲系統能用、Chrome CDP 能用
4. **設定 Telegram 通知**：環境變數 `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`
5. **設定 Cron 排程**（參考 `headhunter-crawler/docs/啟動指南.md`）
6. **回報主人**，讓他去開兩隻龍蝦
