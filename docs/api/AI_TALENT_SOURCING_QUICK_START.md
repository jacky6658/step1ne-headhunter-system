# 🚀 智慧人才搜尋系統 - 快速開始指南

**給 AI 助理的簡明手冊**

---

## ⚡ 30 秒快速入門

```bash
# 第一次？先查看搜尋策略（不執行爬蟲）
python3 /Users/user/clawd/hr-tools/talent_sourcing_pipeline.py --job-id 51 --dry-run

# 準備好了？開始搜尋、評分、上傳
python3 /Users/user/clawd/hr-tools/talent_sourcing_pipeline.py --job-id 51 --execute
```

**結果**：15-50 位候選人自動上傳到系統（5-10 分鐘）

---

## 🎯 系統做什麼？

| 階段 | 自動執行 | 耗時 |
|------|---------|------|
| 1. JD 分析 | 分解職缺要求、提取搜尋關鍵字 | 2-3 秒 |
| 2. 雙管道搜尋 | GitHub (60s) + LinkedIn (45s) + 人類行為延遲 | 90 秒 |
| 3. 智慧去重 | 自動移除重複、如果 0 人則自動重試 | 2-5 秒 |
| 4. AI 評分 | 6 維度評分，0-100 分 | 20-30 秒 |
| 5. 批量上傳 | 根據等級自動分類（推薦 vs 備選）、上傳 API | 10-20 秒 |

---

## 📊 評分等級一目瞭然

```
🎯 AI推薦（立即聯繫）
  • S  級: 95+  分 ⭐⭐⭐
  • A+ 級: 90-94 分 ⭐⭐
  • A  級: 80-89 分 ⭐
  • B  級: 70-79 分 🔶

📋 備選人才（有潛力）
  • C  級: 60-69 分 ⚪
  • D  級: <60  分 ❌
```

---

## 🔧 3 種運行模式

```bash
# 模式 1: DRY-RUN（只分析，不搜尋）
--dry-run

# 模式 2: EXECUTE（完整執行）
--execute

# 模式 3: TEST（驗證智慧回退邏輯）
--execute --test-zero-dedup
```

---

## 📁 關鍵文件位置

| 文件 | 位置 | 用途 |
|------|------|------|
| **主程式** | `/Users/user/clawd/hr-tools/talent_sourcing_pipeline.py` | 執行爬蟲的入口 |
| **完整文檔** | `/Users/user/clawd/hr-tools/TALENT_SOURCING_SYSTEM.md` | 系統詳細說明（給新 AI 讀） |
| **前端文檔** | `/Users/user/clawd/projects/.../pages/HelpPage.tsx` | Web UI 中的使用說明 |

---

## 🤖 給新 AI 的提示詞

如果你要啟動一個新 AI 來做人才搜尋，給它這個提示：

```
你是 Step1ne 系統的 AI 智能配對引擎。

📚 必讀文檔：
1. /Users/user/clawd/hr-tools/TALENT_SOURCING_SYSTEM.md（完整說明）
2. https://backendstep1ne.zeabur.app/api/guide（API 操作指南）

🎯 你的職責：
1. 分析職缺需求
2. 搜尋候選人（GitHub + LinkedIn）
3. 去重 + 智慧回退
4. AI 評分（6 維度）
5. 自動分類 + 上傳

⚡ 快速開始：
python3 /Users/user/clawd/hr-tools/talent_sourcing_pipeline.py --job-id {JOB_ID} --execute

成功標準：
- 找到 15+ 人才
- A-B 級佔 60%+
- 0 個上傳失敗
```

---

## ✅ 常見任務

### 搜尋 C++ Developer（職缺 51）
```bash
python3 /Users/user/clawd/hr-tools/talent_sourcing_pipeline.py --job-id 51 --execute
```

### 搜尋資安工程師（職缺 15）
```bash
python3 /Users/user/clawd/hr-tools/talent_sourcing_pipeline.py --job-id 15 --execute
```

### 同時搜尋 3 個職缺
```bash
python3 /Users/user/clawd/hr-tools/talent_sourcing_pipeline.py --job-ids 51,15,16 --execute
```

### 只分析，不搜尋
```bash
python3 /Users/user/clawd/hr-tools/talent_sourcing_pipeline.py --job-id 51 --dry-run
```

---

## 🔬 6 維度評分詳解

| 維度 | 權重 | 評估內容 |
|------|------|---------|
| **技能匹配** | 35% | 核心技能符合 + 進階技能加分 |
| **工作經驗** | 25% | 相關產業年資 + 層級匹配 |
| **產業適配** | 20% | 文化相似度 + 公司發展階段 |
| **成長信號** | 10% | GitHub 提交頻率 + 學習主動性 |
| **文化契合** | 5% | 工作地點 + 遠端意願 |
| **可觸達性** | 5% | LinkedIn 活躍度 + 聯繫方式 |

---

## 🧠 智慧回退機制

```
去重後 0 人？ 
  ↓
系統自動觸發「智慧回退」
  ↓
放寬搜尋條件（降低 20% 技能要求）
  ↓
重試第 1 次 → 有人? YES ✅ / NO 繼續
  ↓
重試第 2 次 → 有人? YES ✅ / NO ❌ 中止，通知用戶
```

---

## 📈 預期效能

| 指標 | 預期值 |
|------|--------|
| 搜尋時間 | 2-5 分鐘 |
| 候選人數 | 20-50 人 |
| A-B 級比例 | 60%+ |
| 上傳成功率 | >95% |

---

## ❓ 遇到問題？

1. **去重後 0 人？** → 系統自動重試，放寬條件
2. **上傳失敗？** → 檢查 `/tmp/upload-report-*.txt` 日誌
3. **候選人品質差？** → 調整 JD 分析或評分維度

---

## 📚 延伸閱讀

- 完整系統文檔：`/Users/user/clawd/hr-tools/TALENT_SOURCING_SYSTEM.md`
- 前端使用說明：Web UI 的「幫助」→「AI 智能配對」區塊
- API 文檔：`https://backendstep1ne.zeabur.app/api/guide`

---

**最後更新**：2026-02-27  
**系統狀態**：✅ 生產就緒
