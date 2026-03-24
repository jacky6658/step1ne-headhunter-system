# Step1ne 獵頭龍蝦模板

## 安裝方式

把這個資料夾的檔案複製到新龍蝦的 agent 目錄：

```bash
# 假設新龍蝦叫 new-agent
cp SOUL.md ~/.openclaw/agents/new-agent/agent/
cp MEMORY.md ~/.openclaw/agents/new-agent/agent/
cp USER.md ~/.openclaw/agents/new-agent/agent/
```

## 包含的檔案

| 檔案 | 用途 |
|---|---|
| SOUL.md | 龍蝦的人格設定（獵頭助理角色） |
| MEMORY.md | 完整的 API 格式 + import-complete 模板 + 查詢端點 |
| USER.md | Jacky 的資訊 + 溝通偏好 |

## 裝完後

1. 龍蝦第一次啟動會讀 SOUL.md 知道自己是誰
2. 需要匯入人選時讀 MEMORY.md 拿 API 格式
3. 不需要額外訓練，直接能用 import-complete API
