# Bot 上傳履歷完整流程使用說明

**版本**: v1.0  
**最後更新**: 2026-02-23

---

## 🎯 流程總覽

```
獵頭顧問（Telegram/WhatsApp）
    ↓ 上傳履歷 PDF
Bot（@HRyuqi_bot）
    ↓ 解析履歷
後端 API (/api/candidates)
    ↓ 資料驗證 + 計算評級
Google Sheets（履歷池v2）
    ↓ 寫入資料
前端系統（30分鐘快取）
    ↓ 自動同步
獵頭顧問查看候選人
```

---

## 📝 詳細步驟說明

### 步驟 1：獵頭顧問上傳履歷

**使用者**: Jacky、Phoebe 或其他獵頭顧問  
**平台**: Telegram（@HRyuqi_bot）或 WhatsApp

**操作方式**:
```
1. 在 Telegram 中找到 @HRyuqi_bot
2. 傳送履歷 PDF 檔案
3. 或直接轉發包含履歷附件的訊息
```

**範例**:
```
Phoebe: [上傳 resume_王小明.pdf]

@HRyuqi_bot: 
✅ 收到履歷檔案！
📄 檔名：resume_王小明.pdf
📦 大小：2.3 MB
🔄 開始處理...
```

---

### 步驟 2：Bot 解析履歷

**執行者**: @HRyuqi_bot  
**工具**: `resume-parser-v2.py`

**解析內容**:
```python
{
  "name": "王小明",
  "email": "wang@example.com",
  "phone": "0912-345-678",
  "location": "台北市",
  "position": "資深前端工程師",
  "years": 5.5,
  "jobChanges": 3,
  "avgTenure": 1.8,
  "lastGap": 2,
  "skills": "React, TypeScript, Next.js, Tailwind CSS, Node.js, Git",
  "education": "國立台灣大學 資訊工程系 學士",
  "workHistory": [
    {
      "company": "某科技公司",
      "title": "資深前端工程師",
      "start": "2021-03",
      "end": "2026-02",
      "duration_months": 59
    },
    ...
  ],
  "educationJson": [
    {
      "school": "國立台灣大學",
      "degree": "學士",
      "major": "資訊工程系",
      "start": "2014",
      "end": "2018"
    }
  ]
}
```

**處理時間**: 約 5-10 秒

---

### 步驟 3：呼叫後端 API

**執行者**: @HRyuqi_bot  
**端點**: `POST https://backendstep1ne.zeabur.app/api/candidates`

**請求範例**:
```bash
curl -X POST https://backendstep1ne.zeabur.app/api/candidates \
  -H "Content-Type: application/json" \
  -d '{
    "name": "王小明",
    "email": "wang@example.com",
    "phone": "0912-345-678",
    "position": "資深前端工程師",
    "location": "台北市",
    "years": 5.5,
    "jobChanges": 3,
    "skills": "React, TypeScript, Next.js, Tailwind CSS, Node.js, Git",
    "education": "國立台灣大學 資訊工程系 學士",
    "workHistory": [...],
    "educationJson": [...],
    "source": "Gmail 進件",
    "consultant": "Phoebe",
    "createdBy": "bot"
  }'
```

---

### 步驟 4：後端驗證與計算

**執行者**: 後端 API Server  
**處理內容**:

#### A. 資料驗證
```javascript
// 必填欄位檢查
if (!candidate.name || !candidate.email) {
  return { success: false, error: '缺少必填欄位' };
}

// Email 格式驗證
if (!isValidEmail(candidate.email)) {
  return { success: false, error: 'Email 格式錯誤' };
}

// 去重檢查
const existing = await checkDuplicate(candidate.email);
if (existing) {
  return { success: false, error: '候選人已存在' };
}
```

#### B. 計算工作穩定性
```javascript
const stabilityScore = calculateStabilityScore({
  years: 5.5,
  jobChanges: 3,
  lastGap: 2
});
// 結果: 68 分 (B級)
```

#### C. 計算綜合評級
```javascript
const talentGrade = calculateTalentGrade({
  education: "學士",
  years: 5.5,
  skills: "React, TypeScript, ...",
  stabilityScore: 68,
  workHistory: [...],
  notes: ""
});
// 結果: 
// {
//   total: 74.5,
//   grade: "A",
//   breakdown: {
//     education: 7.5,
//     experience: 11,
//     skills: 15,
//     stability: 13.6,
//     trajectory: 25,
//     bonus: 2
//   }
// }
```

---

### 步驟 5：寫入 Google Sheets

**執行者**: 後端 API Server  
**工具**: `gog sheets append`

**執行命令**:
```bash
gog sheets append \
  --sheet-id "1PunpaDAFBPBL_I76AiRYGXKaXDZvMl1c262SEtxRk6Q" \
  --tab "履歷池v2" \
  --account "aijessie88@step1ne.com" \
  --values "王小明|wang@example.com|0912-345-678|台北市|資深前端工程師|5.5|3|1.8|2|React, TypeScript, ...|國立台灣大學 資訊工程系 學士|Gmail 進件|[JSON...]|待聯繫|68|[JSON...]|無|Phoebe|無|2026-02-23|A|74.5"
```

**寫入欄位對應**（A-V, 22欄）:
```
A: 姓名
B: Email
C: 電話
D: 地點
E: 職位
F: 年資
G: 離職次數
H: 平均任期
I: 最後離職間隔
J: 技能
K: 學歷
L: 來源
M: 工作經歷 JSON
N: 狀態
O: 穩定度評分
P: 教育背景 JSON
Q: 離職原因
R: 顧問
S: 備註
T: 日期
U: 綜合評級 (S/A+/A/B/C)
V: 綜合評級分數 (0-100)
```

---

### 步驟 6：回傳結果給 Bot

**執行者**: 後端 API Server  
**回傳格式**:
```json
{
  "success": true,
  "data": {
    "id": "candidate-250",
    "name": "王小明",
    "email": "wang@example.com",
    "stabilityScore": 68,
    "talentGrade": "A",
    "talentScore": 74.5,
    "_sheetRow": 250
  },
  "message": "候選人新增成功"
}
```

---

### 步驟 7：Bot 回報給獵頭顧問

**執行者**: @HRyuqi_bot  
**回報訊息**:
```
@HRyuqi_bot:
✅ 履歷處理完成！

👤 候選人：王小明
📧 Email：wang@example.com
📍 職位：資深前端工程師（台北市）
📊 工作穩定性：68 分（B級）
⭐ 綜合評級：A 級（74.5 分）

📋 已匯入履歷池（第 250 筆）
🔗 查看詳情：https://step1ne.zeabur.app
```

---

### 步驟 8：前端自動同步

**時機**: 30 分鐘快取過期後  
**或**: 用戶點擊「🔄 重新整理」按鈕

**同步流程**:
```
1. 前端偵測快取過期
2. 呼叫 GET /api/candidates
3. 後端從 Google Sheets 讀取最新資料
4. 前端更新候選人列表（現在有 250 筆）
5. 顯示新候選人「王小明」
```

---

## 🛡️ 錯誤處理

### 錯誤 1：PDF 解析失敗

**原因**: PDF 格式特殊、掃描檔、圖片履歷

**Bot 回應**:
```
⚠️ 履歷解析失敗

📄 檔案：resume_王小明.pdf
❌ 原因：無法提取文字內容（可能是圖片格式）

💡 解決方案：
1. 請提供純文字 PDF（非掃描檔）
2. 或手動提供候選人資訊
```

**處理方式**: 顧問手動輸入資料或重新取得 PDF

---

### 錯誤 2：Email 重複

**原因**: 候選人已在履歷池中

**Bot 回應**:
```
⚠️ 候選人已存在

👤 姓名：王小明
📧 Email：wang@example.com
📅 首次匯入：2026-01-15
👔 負責顧問：Phoebe

❓ 是否要更新履歷？
[更新履歷] [取消]
```

**處理方式**: 
- 點擊「更新履歷」→ 覆蓋舊資料
- 點擊「取消」→ 保留原資料

---

### 錯誤 3：API 連接失敗

**原因**: 後端伺服器暫時無法連線

**Bot 回應**:
```
❌ 系統暫時無法連線

🔧 正在重試... (1/3)
⏰ 預計 10 秒後重試
```

**處理方式**: 自動重試 3 次，失敗則通知管理員

---

## 📊 資料流向圖

```
┌─────────────┐
│ 獵頭顧問     │ 上傳 PDF
│ (Telegram)  │────────┐
└─────────────┘        │
                       ▼
                ┌─────────────┐
                │   Bot       │ 解析履歷
                │ @HRyuqi_bot │────────┐
                └─────────────┘        │
                                       ▼
                                ┌─────────────┐
                                │  後端 API   │ 驗證 + 計算
                                │ (Node.js)   │────────┐
                                └─────────────┘        │
                                                       ▼
                                                ┌─────────────┐
                                                │Google Sheets│
                                                │  履歷池v2   │
                                                └─────────────┘
                                                       │
                                                       ▼
                                                ┌─────────────┐
                                                │  前端系統   │ 查看
                                                │ (React)     │◄───── 獵頭顧問
                                                └─────────────┘
```

---

## 🔐 權限與安全

### Bot 認證
- 只有授權的獵頭顧問可以上傳履歷
- Bot Token 儲存在環境變數中
- 每個 Bot 綁定一位顧問（Phoebe → @HRyuqi_bot）

### API 安全
- 後端驗證請求來源
- Rate limiting（每分鐘最多 10 個請求）
- 資料加密傳輸（HTTPS）

### 資料隱私
- 候選人資料只有負責顧問和管理員可見
- Google Sheets 權限控管
- 不公開敏感資訊（電話、Email）

---

## 🚀 使用範例

### 範例 1：Phoebe 上傳新履歷

```
[2026-02-23 10:30]
Phoebe → @HRyuqi_bot: [上傳 resume_張大明.pdf]

@HRyuqi_bot:
✅ 收到履歷！開始處理...

[10秒後]
@HRyuqi_bot:
✅ 完成！

👤 張大明
📧 chang@example.com
📍 DevOps 工程師（新竹市）
📊 穩定性：85 分（A級）
⭐ 綜合評級：A+ 級（82 分）

已匯入履歷池（第 251 筆）
```

---

### 範例 2：Jacky 上傳重複履歷

```
[2026-02-23 14:00]
Jacky → @YuQi0923_bot: [上傳 resume_李小華.pdf]

@YuQi0923_bot:
⚠️ 候選人已存在

👤 李小華
📧 lee@example.com
📅 首次匯入：2026-02-10
👔 負責顧問：Phoebe

是否要更新履歷？
[更新履歷] [取消]

Jacky: [點擊「更新履歷」]

@YuQi0923_bot:
✅ 履歷已更新！
📊 穩定性：70 → 75 分
⭐ 綜合評級：A → A+ 級
```

---

## 📋 檢查清單（開發用）

### 後端 API 實作
- [ ] POST /api/candidates 端點
- [ ] 資料驗證邏輯
- [ ] 計算穩定性評分
- [ ] 計算綜合評級
- [ ] Google Sheets 寫入
- [ ] 錯誤處理與重試
- [ ] Rate limiting

### Bot 整合
- [ ] PDF 上傳接收
- [ ] 呼叫 resume-parser-v2.py
- [ ] 呼叫後端 API
- [ ] 成功/失敗訊息回報
- [ ] 重複履歷處理
- [ ] 錯誤重試機制

### 前端同步
- [ ] 30 分鐘快取機制
- [ ] 手動更新按鈕
- [ ] 新候選人高亮顯示
- [ ] 即時通知（可選）

---

**文檔版本**:
- v1.0 (2026-02-23): 初版，完整流程說明
