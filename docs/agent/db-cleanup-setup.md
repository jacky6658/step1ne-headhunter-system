# 🦞 Step1ne DB 自動清理工具包

## 📁 檔案清單

| 檔案 | 用途 |
|------|------|
| `DB自動清理提示詞.md` | 給 AI 的提示詞模板（手動執行用） |
| `db-cleanup.sh` | 自動化清理腳本（排程用） |
| `README-安裝說明.md` | 本檔案 |

## 🚀 快速安裝（3 步驟）

### Step 1：把腳本放到正確位置
```bash
cp db-cleanup.sh ~/scripts/db-cleanup.sh
chmod +x ~/scripts/db-cleanup.sh
mkdir -p ~/logs
```

### Step 2：先手動跑一次測試
```bash
bash ~/scripts/db-cleanup.sh
```
確認 log 輸出正常，沒有報錯。

### Step 3：設定每週自動排程

**方式 A — 用 crontab（推薦）**
```bash
crontab -e
# 加入這行：每週日凌晨 3 點執行
0 3 * * 0 /bin/bash /Users/user/scripts/db-cleanup.sh >> /Users/user/logs/db-cleanup.log 2>&1
```

**方式 B — 用 macOS launchd**
```bash
cat > ~/Library/LaunchAgents/com.step1ne.db-cleanup.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.step1ne.db-cleanup</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>/Users/user/scripts/db-cleanup.sh</string>
    </array>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Weekday</key>
        <integer>0</integer>
        <key>Hour</key>
        <integer>3</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>
    <key>StandardOutPath</key>
    <string>/Users/user/logs/db-cleanup.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/user/logs/db-cleanup-error.log</string>
</dict>
</plist>
EOF

# 載入排程
launchctl load ~/Library/LaunchAgents/com.step1ne.db-cleanup.plist
```

## 📋 清理規則摘要

| # | 規則 | 說明 |
|---|------|------|
| 1 | 公司/組織帳號 | LinkedIn 是公司不是個人 |
| 2 | 資料全空 | 只有名字，其他全空 |
| 3 | 三無人選 | 無 LinkedIn + 無現職 + 無技能 |
| 4 | 無聯繫方式 | 無 LinkedIn + 無 GitHub + 無 Email |
| 5 | 重複人選 | LinkedIn URL 重複，保留最早的 |

## ⚠️ 重要注意事項

- **D 級人選不會被刪除** — D 級只是跟某職缺不匹配，不代表人選沒價值
- **每次清理都會自動備份** — 備份在 `~/Downloads/db-cleanup-records/`
- **清理後會自動 push GitHub** — 到 step1ne-db-backups 倉庫
- **Log 檔案** — `~/logs/db-cleanup.log`

## 🔍 查看歷史清理紀錄
```bash
cat ~/logs/db-cleanup.log
```

## 🔄 手動觸發清理
```bash
bash ~/scripts/db-cleanup.sh
```

## ❌ 停止自動排程
```bash
# crontab 方式
crontab -e  # 刪除該行

# launchd 方式
launchctl unload ~/Library/LaunchAgents/com.step1ne.db-cleanup.plist
```
