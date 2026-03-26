# 🦞 龍蝦 DB 自動清理 — 提示詞模板

> 適用於：step1ne 獵頭顧問系統
> DB：PostgreSQL（本機 `psql -U user -d step1ne`）
> 備份倉庫：https://github.com/jacky6658/step1ne-db-backups

---

## 📋 提示詞（直接複製貼上給 AI）

```
你是 step1ne 獵頭顧問系統的 DBA，請對本機 PostgreSQL 執行定期 DB 清理。

## 連線資訊
- 指令：psql -U user -d step1ne
- 主表：candidates_pipeline

## 清理規則（依序執行）

### 規則 1：刪除公司/組織帳號（非個人）
條件：name 符合以下任一關鍵字（不分大小寫）：
- 中文：公司、協會、基金會、學會、商會
- 英文：Inc、Corp、Ltd、Co.、Group、Center、Association、Institute、University、Lab、Studio
- LinkedIn 殘留：「同意並加入」「登入或註冊」
- current_position 包含 'company'（非個人職稱）

### 規則 2：刪除資料全空的人選
條件：同時滿足以下所有條件
- current_position 為空
- skills 為空
- linkedin_url 為空
- email 為空 或 = 'unknown@github.com'
- ai_score 為 NULL

### 規則 3：刪除無 LinkedIn + 無現職 + 無技能
條件：同時滿足以下所有條件
- linkedin_url 為空
- current_position 為空
- skills 為空

### 規則 4：刪除無任何聯繫方式的人選
條件：同時滿足以下所有條件
- linkedin_url 為空
- github_url 為空
- email 為空 或 = 'unknown@github.com'

### 規則 5：去除重複人選
- 以 linkedin_url 為主鍵比對，若有重複保留 id 最小的那筆（最早建立的）
- 以 name + current_position 比對，若完全相同則保留有較多資料的那筆

## 執行步驟（每次清理必須遵守）

1. **先報告**：執行清理前，先 SELECT count 每個規則會影響多少筆，彙報給我
2. **先備份**：用 COPY TO 把即將刪除的資料匯出到 CSV
   - 備份路徑：~/Downloads/step1ne_cleanup_[日期].csv
3. **再刪除**：確認備份成功後才執行 DELETE
4. **驗證**：刪除後 SELECT count 確認總數
5. **推送備份**：
   - pg_dump 完整備份到 ~/Downloads/step1ne-db-backups/backups/[年]/[月]/
   - git add + commit + push 到 GitHub

## 輸出格式

清理完成後，產出以下報告：

| 規則 | 刪除原因 | 刪除人數 |
|------|---------|---------|
| 1 | 公司/組織帳號 | X 人 |
| 2 | 資料全空 | X 人 |
| 3 | 無LinkedIn+無現職+無技能 | X 人 |
| 4 | 無任何聯繫方式 | X 人 |
| 5 | 重複人選 | X 人 |
| **合計** | | **X 人** |
| 清理前 → 清理後 | | XXXX → XXXX 人 |

## 注意事項
- 「為空」的定義：IS NULL 或 = '' 或 = '\N'
- D 級人選不要刪！D 級只是跟特定職缺不匹配，不代表人選沒價值
- 每次清理都要備份，絕對不能跳過
- 備份 CSV 和 DB dump 都要推到 GitHub
```

---

## ⏰ 如果要設定定期排程（cron）

```bash
# 每週日凌晨 3 點自動清理
# 加到 crontab -e
0 3 * * 0 /Users/user/scripts/db-cleanup.sh >> /Users/user/logs/db-cleanup.log 2>&1
```

需要我幫你寫 `db-cleanup.sh` 自動化腳本的話，提示詞如下：

```
幫我寫一個 bash 腳本 db-cleanup.sh，自動執行上述 5 個清理規則，
每次執行前先備份，清理後自動 push 到 GitHub。
腳本要有 log 輸出，記錄每次清理了多少筆。
```

---

## 🔄 完整工作流程

```
每週日 03:00
    │
    ▼
┌─────────────┐
│  pg_dump 備份 │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│ 規則 1~5 清理    │
│ (先 SELECT 再    │
│  COPY 再 DELETE) │
└──────┬──────────┘
       │
       ▼
┌──────────────┐
│ pg_dump 清理後 │
│ 完整備份       │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ git push 到   │
│ GitHub 備份庫  │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ 產出清理報告   │
│ 通知 owner    │
└──────────────┘
```
