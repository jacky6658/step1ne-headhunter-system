# Google Drive 履歷庫配置

**最後更新**：2026-02-23

---

## 📁 資料夾結構

```
📁 Step1ne 履歷庫/
├── 📁 pending/      (待處理 - 待聯繫/已聯繫)
├── 📁 interviewed/  (已面試 - 面試中/Offer)
├── 📁 hired/        (已錄用 - 已上職)
└── 📁 rejected/     (已拒絕 - 婉拒/不適合)
```

---

## 🔑 資料夾 ID 對應表

| 資料夾 | Folder ID | 用途 | 對應狀態 |
|--------|-----------|------|---------|
| **Root** | `16IOJW0jR2mBgzBnc5QI_jEHcRBw3VnKj` | 根目錄 | - |
| **pending** | `1M3jX7JbtQtEwtjfj_GG3UPnSRIcmGezu` | 待處理 | 待聯繫、已聯繫 |
| **interviewed** | `1SNK01mbBXB6kTIdTE0UCfiilx6fZQiZK` | 已面試 | 面試中、Offer |
| **hired** | `1m9uUt_S-9Rik3Uzzw0Kqoa-s9VJkm0fk` | 已錄用 | 已上職 |
| **rejected** | `1lTuP8RCU4K2bpg-TNODN1xPm4EOru2RN` | 已拒絕 | 婉拒、不適合 |

---

## 🔗 快速連結

- **Root**: https://drive.google.com/drive/u/0/folders/16IOJW0jR2mBgzBnc5QI_jEHcRBw3VnKj
- **pending**: https://drive.google.com/drive/u/0/folders/1M3jX7JbtQtEwtjfj_GG3UPnSRIcmGezu
- **interviewed**: https://drive.google.com/drive/u/0/folders/1SNK01mbBXB6kTIdTE0UCfiilx6fZQiZK
- **hired**: https://drive.google.com/drive/u/0/folders/1m9uUt_S-9Rik3Uzzw0Kqoa-s9VJkm0fk
- **rejected**: https://drive.google.com/drive/u/0/folders/1lTuP8RCU4K2bpg-TNODN1xPm4EOru2RN

---

## 📋 候選人狀態 → 資料夾對應邏輯

```javascript
const STATUS_TO_FOLDER = {
  '待聯繫': 'pending',
  '已聯繫': 'pending',
  '面試中': 'interviewed',
  'Offer': 'interviewed',
  '已上職': 'hired',
  '婉拒': 'rejected',
  '不適合': 'rejected'
};
```

---

## 📄 檔案命名規則

**格式**：`履歷-{候選人姓名}.pdf`

**範例**：
- `履歷-陳宥樺Ava.pdf`
- `履歷-王大明.pdf`
- `履歷-張小華.pdf`

**說明**：
- 使用中文姓名（與 Google Sheets 一致）
- 不包含 ID 或日期（避免重複上傳時檔名不同）
- 重複上傳會自動覆蓋舊檔案

---

## 🔄 自動分類邏輯

**上傳流程**：
```
1. 前端上傳 PDF → 後端 API
2. 讀取候選人當前狀態（從 Google Sheets）
3. 根據狀態選擇目標資料夾
4. 上傳到對應的 Google Drive 資料夾
5. 更新 Google Sheets 的「履歷連結」欄位
```

**狀態變更時**：
- **不會自動移動檔案**（避免連結失效）
- 需要手動移動或重新上傳（未來可考慮自動化）

---

## 🛠️ 維護指引

### 如何新增資料夾

1. 在 Google Drive 中手動建立新資料夾
2. 取得資料夾 ID（從 URL）
3. 更新 `resumeService.js` 中的 `DRIVE_FOLDERS` 常數
4. 更新 `STATUS_TO_FOLDER` 對應表
5. 更新本檔案

### 如何查看資料夾內容

```bash
# 查看 pending 資料夾
gog drive ls --parent 1M3jX7JbtQtEwtjfj_GG3UPnSRIcmGezu --account aijessie88@step1ne.com

# 查看 interviewed 資料夾
gog drive ls --parent 1SNK01mbBXB6kTIdTE0UCfiilx6fZQiZK --account aijessie88@step1ne.com
```

### 如何手動上傳履歷

```bash
gog drive upload "履歷.pdf" \
  --name "履歷-候選人姓名.pdf" \
  --parent 1M3jX7JbtQtEwtjfj_GG3UPnSRIcmGezu \
  --account aijessie88@step1ne.com
```

---

## 🔐 權限設定

**Google 帳號**：aijessie88@step1ne.com

**權限要求**：
- Drive API 讀寫權限
- 可以上傳、刪除、移動檔案
- 可以分享檔案（設定為「知道連結的人可以檢視」）

---

## 📊 目前統計（2026-02-23）

| 資料夾 | 檔案數量 |
|--------|---------|
| pending | 10+ 個（包含 Ava Chen） |
| interviewed | - |
| hired | - |
| rejected | - |

---

**相關文件**：
- `resumeService.js` - 履歷上傳服務
- `server.js` - API 端點（POST /api/candidates/:id/upload-resume）
- `CandidatesPage.tsx` - 前端上傳 UI
