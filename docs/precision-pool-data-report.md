# Precision Pool 資料品質報告

> 報告日期：2026-03-14
> 資料筆數：1,556 位候選人
> Precision Pool 合格人數：1 人

---

## 一、資料完整度分佈

| 完整度區間 | 人數 | 比例 |
|-----------|------|------|
| 80–99% | 1 | 0.06% |
| 60–79% | 3 | 0.19% |
| 40–59% | 224 | 14.4% |
| 20–39% | 772 | 49.6% |
| 1–19% | 552 | 35.5% |
| 0% | 0 | 0% |

**現況**：超過 85% 的候選人資料完整度低於 40%，距離 Precision Pool 門檻（80%）有較大差距。

---

## 二、Match Core 10 欄位缺失統計

| # | 欄位 | 中文名 | 缺失人數 | 已有率 | 資料來源 |
|---|------|--------|---------|--------|---------|
| 1 | `canonicalRole` | 標準職務類別 | 1,552 | **0.3%** | AI 解析履歷 / 顧問手動 |
| 2 | `industryTag` | 產業標籤 | 1,551 | **0.3%** | AI 解析履歷 / 顧問手動 |
| 3 | `normalizedSkills` (≥3) | 核心技能 | 852 | **45.2%** | AI 解析履歷 / 自動正規化 |
| 4 | `expectedSalaryMin` | 期望薪資下限 | 1,550 | **0.4%** | 顧問面談 |
| 5 | `expectedSalaryMax` | 期望薪資上限 | 1,550 | **0.4%** | 顧問面談 |
| 6 | `jobSearchStatusEnum` | 求職狀態 | 1,548 | **0.5%** | 顧問面談 |
| 7 | `noticePeriodEnum` | 到職時間 | 1,547 | **0.6%** | 顧問面談 |
| 8 | `currentCompany` | 目前公司 | 1,269 | **18.4%** | AI 解析履歷 / LinkedIn |
| 9 | `location` | 所在地區 | 690 | **55.7%** | AI 解析履歷 / LinkedIn |
| 10 | `totalYears` | 總年資 | 12 | **99.2%** | AI 計算 work_history |

### 缺失率排行（最嚴重 → 最輕微）

```
canonicalRole     ████████████████████████████████████████ 99.7% 缺失
industryTag       ████████████████████████████████████████ 99.7% 缺失
expectedSalaryMin ████████████████████████████████████████ 99.6% 缺失
expectedSalaryMax ████████████████████████████████████████ 99.6% 缺失
jobSearchStatus   ████████████████████████████████████████ 99.5% 缺失
noticePeriodEnum  ████████████████████████████████████████ 99.4% 缺失
currentCompany    ████████████████████████████████████     81.6% 缺失
normalizedSkills  ██████████████████████                   54.8% 缺失
location          ██████████████████                       44.3% 缺失
totalYears        █                                        0.8% 缺失
```

---

## 三、欄位填寫方式分類

### A. 可由 AI 自動解析（從履歷/LinkedIn 資料提取）

| 欄位 | 說明 | 資料來源 | 自動化可行性 |
|------|------|---------|------------|
| `canonicalRole` | 標準職務類別 (e.g., Backend Engineer) | 解析 `current_position` + `work_history` | **高** — 可用 LLM 映射到標準職類 |
| `industryTag` | 產業標籤 (e.g., SaaS, Fintech) | 解析 `current_company` + `work_history` 公司名 | **高** — 可用 LLM 根據公司名判斷產業 |
| `currentCompany` | 目前公司 | 取 `work_history[0].company` | **高** — 已有邏輯但部分候選人沒有 work_history |
| `normalizedSkills` | 標準化技能陣列 | 解析 `skills` 字串 + 履歷內容 | **高** — 已實作正規化，但原始 skills 為空的無法自動 |
| `location` | 所在地區 | 解析 LinkedIn 地區 / 履歷地址 | **中** — LinkedIn 爬蟲有地區資訊 |
| `totalYears` | 總年資 | 計算 `work_history` 起迄 | **高** — 已有 99.2% 覆蓋 |

### B. 必須由顧問面談後手動填寫

| 欄位 | 說明 | 為什麼不能自動 |
|------|------|--------------|
| `expectedSalaryMin` | 期望薪資下限 | 屬於人選主觀意願，必須面談確認 |
| `expectedSalaryMax` | 期望薪資上限 | 同上 |
| `noticePeriodEnum` | 到職時間 | 取決於人選目前合約與個人狀況 |
| `jobSearchStatusEnum` | 求職狀態 (主動/被動/暫不考慮) | 隨時間變動，需顧問定期確認 |

### C. 複合型（AI 初填 + 顧問確認）

| 欄位 | AI 可先填的部分 | 顧問需確認的部分 |
|------|---------------|----------------|
| `canonicalRole` | 從職稱自動映射到標準職類 | 確認是否正確（例：PM 是 Product Manager 還是 Project Manager）|
| `industryTag` | 從公司名推斷產業 | 確認是否正確（例：跨產業公司的歸屬） |
| `expectedSalary` | 可從 `current_salary` 推估參考範圍 | 必須面談後填入人選實際期望 |

---

## 四、最接近 Precision Pool 的候選人

### 已進入 Precision Pool（1 人）

| ID | 姓名 | 完整度 | 缺少欄位 | Skills | 薪資 | 到職 | 求職狀態 |
|----|------|--------|---------|--------|------|------|---------|
| #622 | close su | 90% | canonicalRole | 9 | 1,020 | 1month | active |

### 差 1–3 個欄位即可達標（優先補資料）

| ID | 姓名 | 完整度 | 缺少欄位 | 建議動作 |
|----|------|--------|---------|---------|
| #622 | close su | 90% | canonicalRole | **AI 可自動填** — 補職務類別即 100% |
| #1521 | Himanshu Tiwari | 70% | canonicalRole, industryTag, noticePeriodEnum | AI 填前 2 個 + 顧問補到職時間 |
| #2128 | 林廷宇 | 60% | canonicalRole, industryTag, expectedSalary x2 | AI 填前 2 個 + 顧問面談補薪資 |
| #2441 | Hsing Kai Huang | 60% | canonicalRole, industryTag, expectedSalary x2 | AI 填前 2 個 + 顧問面談補薪資 |

### 差 4–6 個欄位（需較多補充）

| ID | 姓名 | 完整度 | 缺少欄位數 |
|----|------|--------|----------|
| #208 | 陳宥樺 | 50% | 5 個 |
| #1881 | 黃子哲 | 50% | 5 個 |

---

## 五、行動計劃

### Phase 1：AI 自動回填（預計可提升 200+ 人到 40%+）

**目標欄位**：`canonicalRole`、`industryTag`

**方法**：
1. 從 `current_position` 用 LLM 映射到標準職務類別（Backend / Frontend / DevOps / PM ...）
2. 從 `current_company` + `work_history` 公司名用 LLM 推斷產業標籤（SaaS / Fintech / SI ...）
3. 批量跑一次 migration 腳本，自動填入這 2 個欄位

**預估影響**：
- 目前有 864 人已有 `location`，598 人已有 `normalizedSkills ≥ 3`
- 如果 AI 補上 `canonicalRole` + `industryTag`，加上已有的 `location` + `skills` + `totalYears`
- 預計 **200–400 人**可提升到 50%–70% 完整度

### Phase 2：顧問面談回填（核心商業資料）

**目標欄位**：`expectedSalaryMin/Max`、`noticePeriodEnum`、`jobSearchStatusEnum`

**方法**：
1. 在 CandidateModal 的「Precision Pool: NO」banner 旁加上「一鍵補資料」快捷入口
2. 顧問每次面談/通話後，填入 4 個商業欄位
3. 系統 PATCH 自動重算 → 即時更新 Precision Pool 狀態

**優先順序建議**：
1. 先補 Grade A/B 的候選人（品質最高、最有成交可能）
2. 再補 Heat = Hot / Warm 的候選人（正在積極求職）
3. 最後是 Source Tier T1 的候選人（頂尖公司出身）

### Phase 3：履歷 PDF 解析強化

**目標**：解決 `normalizedSkills` 和 `currentCompany` 大量缺失問題

**方法**：
1. 使用系統已有的「📄 匯入履歷」功能解析 PDF，自動提取技能、公司、職稱
2. 對有 `resume_files` 但缺少結構化資料的候選人，批量觸發 AI 解析
3. 解析結果寫入 `normalized_skills`、`current_company`、`canonical_role` 等欄位

---

## 六、Precision Pool 進入條件（規格回顧）

候選人需**同時滿足**以下條件才能進入精準匹配池：

```
Data Quality Score >= 80%       （10 個核心欄位至少填 8 個）
AND normalizedSkills >= 3       （至少 3 個標準化技能）
AND expectedSalaryMin != null   （有期望薪資）
AND noticePeriodEnum != null    （有到職時間）
AND jobSearchStatusEnum != null （有求職狀態）
```

未進入 Precision Pool 的候選人：
- AI 匹配時**降權處理**
- 不進入 **Top Candidate 排序**
- 卡片上顯示灰色完整度百分比 + **Precision Pool: NO**

---

## 七、系統功能對照

| 功能 | 位置 | 狀態 |
|------|------|------|
| Data Quality 自動計算 | PATCH /api/candidates/:id | ✅ 已實作 |
| Precision Pool 判斷 | PATCH 自動重算 | ✅ 已實作 |
| CandidateModal 提示 | 卡片頂部 banner | ✅ 已實作（顯示缺少欄位 + YES/NO badge）|
| TalentCard badge | 看板卡片右下角 | ✅ 已實作（綠色 Precision / 灰色 %）|
| Precision Only 篩選 | 看板篩選列 checkbox | ✅ 已實作 |
| AI 自動回填 canonicalRole | 排程 / migration | ⏳ 待開發（Phase 1）|
| AI 自動回填 industryTag | 排程 / migration | ⏳ 待開發（Phase 1）|
| 一鍵補資料快捷入口 | CandidateModal banner | ⏳ 待開發（Phase 2）|
| 批量 PDF 解析回填 | 排程腳本 | ⏳ 待開發（Phase 3）|
