# 候選人資料清理腳本

## 目的
清理候選人的「顧問」欄位，統一資料品質。

## 需要清理的資料

### 1. AI自動 → 未指派（空字串）
- **數量**：26 位
- **原因**：「AI自動」應改為空字串（未指派），方便所有顧問查看和認領
- **影響**：清理後這些候選人會被歸類為「未指派」

### 2. Mike → Phoebe
- **數量**：7 位
- **原因**：Mike 是 Phoebe 的 AI bot，應統一為 Phoebe
- **影響**：清理後這 7 位候選人會顯示為 Phoebe 負責

## 當前候選人分布

| 顧問 | 數量 | 清理後數量 | 說明 |
|------|------|------------|------|
| Jacky | 55 | 55 | 不變 |
| Phoebe | 25 | 32 | +7 (Mike) |
| Mike | 7 | 0 | → Phoebe |
| AI自動 | 26 | 0 | → 未指派 |
| 未指派 | 101 | 127 | +26 (AI自動) |
| **總計** | **216** | **216** | - |

## 執行方式

### 選項 A：手動執行腳本（推薦）

```bash
bash /tmp/cleanup-consultants.sh
```

**預計時間**：約 20 秒（33 筆資料 × 0.5 秒延遲）

### 選項 B：使用 API 批量更新

```bash
# 更新 AI自動 → 未指派
curl -s "http://localhost:3001/api/candidates" | \
  jq -r '.data[] | select(.consultant == "AI自動") | .id' | \
  while read id; do
    curl -X PUT "http://localhost:3001/api/candidates/$id" \
      -H "Content-Type: application/json" \
      -d '{"consultant": ""}'
    sleep 0.5
  done

# 更新 Mike → Phoebe
curl -s "http://localhost:3001/api/candidates" | \
  jq -r '.data[] | select(.consultant == "Mike") | .id' | \
  while read id; do
    curl -X PUT "http://localhost:3001/api/candidates/$id" \
      -H "Content-Type: application/json" \
      -d '{"consultant": "Phoebe"}'
    sleep 0.5
  done
```

### 選項 C：手動在 Google Sheets 修改
直接編輯 [履歷池v2](https://docs.google.com/spreadsheets/d/1PunpaDAFBPBL_I76AiRYGXKaXDZvMl1c262SEtxRk6Q/edit) S 欄（顧問欄位）

## 驗證

清理後執行以下指令驗證：

```bash
# 檢查候選人分布
curl -s "http://localhost:3001/api/candidates" | \
  jq '[.data[].consultant] | group_by(.) | map({consultant: .[0], count: length})'
```

預期結果：
```json
[
  { "consultant": "", "count": 127 },
  { "consultant": "Jacky", "count": 55 },
  { "consultant": "Phoebe", "count": 32 },
  { "consultant": "待指派", "count": 2 }
]
```

## 注意事項

1. **執行前備份**：建議先在 Google Sheets 創建副本
2. **測試環境**：可先在測試環境執行一筆資料驗證
3. **API 限制**：腳本已加入 0.5 秒延遲，避免 rate limit

## 執行時機

建議在以下時間執行：
- ✅ 離峰時間（晚上或週末）
- ✅ 確認無人正在編輯 Google Sheets
- ✅ 已通知團隊成員

---

**需要執行嗎？請確認後回覆，我會立刻執行！**
