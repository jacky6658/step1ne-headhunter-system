# 前端整合指南 - 方案 A + B

## 概述

前端需要改進以支持新的 API 層（SQL + Google Sheets 同步）。核心改動只有 **3 個地方**。

---

## 1️⃣ 改進 `AIMatchingPage.tsx`

### 問題
當前：改狀態 → 只改前端 React state → 登出後消失

### 解決
改狀態時 → 同時發 API 請求 → SQL + Sheets 同步

### 程式碼改動

**Before（舊邏輯）**：
```tsx
const handleStatusChange = (candidateId, newStatus) => {
  // 只改本地 state
  setCandidates(prev => 
    prev.map(c => c.id === candidateId ? {...c, status: newStatus} : c)
  );
};
```

**After（新邏輯）**：
```tsx
const handleStatusChange = async (candidateId, name, newStatus) => {
  try {
    // 步驟 1：更新本地 UI（快速反應）
    setCandidates(prev => 
      prev.map(c => c.id === candidateId ? {...c, status: newStatus} : c)
    );

    // 步驟 2：呼叫 API（同時更新 SQL + Sheets）
    const response = await fetch(`/api/candidates/${candidateId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: newStatus,
        name: name,
        consultant: getCurrentConsultant(), // 從本地取得
        notes: `手動更新於 ${new Date().toLocaleString()}`
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ Status updated in backend:', data);

    // 可選：顯示成功通知
    showNotification({
      type: 'success',
      message: `✅ 已更新為「${newStatus}」（已同步到 SQL + Google Sheets）`
    });

  } catch (error) {
    console.error('❌ Failed to update status:', error);
    
    // 失敗時回滾本地狀態
    await reloadCandidates();
    
    showNotification({
      type: 'error',
      message: '❌ 更新失敗，請稍後再試'
    });
  }
};
```

---

## 2️⃣ 改進 `Pipeline.tsx`（進度追蹤）

### 程式碼改動

**Before**：
```tsx
const saveProgress = (trackingData) => {
  setProgressTracking(trackingData); // 只存本地
};
```

**After**：
```tsx
const saveProgress = async (trackingData) => {
  try {
    // 本地更新
    setProgressTracking(trackingData);

    // API 同步
    const response = await fetch(`/api/candidates/${candidateId}/progress`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ progressTracking: trackingData })
    });

    if (!response.ok) throw new Error('Failed to save');
    console.log('✅ Progress saved to backend');

  } catch (error) {
    console.error('❌ Failed to save progress:', error);
    showNotification({ type: 'error', message: '進度保存失敗' });
  }
};
```

---

## 3️⃣ 改進 `CandidateList.tsx`（列表載入）

### 程式碼改動

**Before**：
```tsx
useEffect(() => {
  // 從本地記憶體或 Google Sheets 讀取
  loadFromGoogleSheets();
}, []);
```

**After**：
```tsx
useEffect(() => {
  // 從 SQL 讀取（速度快 + 狀態最新）
  loadCandidatesFromSQL();
}, []);

const loadCandidatesFromSQL = async () => {
  try {
    const response = await fetch('/api/candidates?consultant=Jacky');
    
    if (!response.ok) throw new Error('Failed to load');
    
    const data = await response.json();
    setCandidates(data.candidates);
    console.log(`✅ Loaded ${data.count} candidates from SQL`);

  } catch (error) {
    console.error('❌ Failed to load candidates:', error);
    showNotification({ type: 'error', message: '載入候選人失敗' });
  }
};
```

---

## 4️⃣ 新增 API 工具函數

**Create `api-utils.ts`**：

```typescript
/**
 * API 工具函數（統一管理）
 */

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

export async function updateCandidateStatus(
  candidateId: string,
  name: string,
  status: string,
  consultant?: string
) {
  const response = await fetch(`${API_BASE}/candidates/${candidateId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, name, consultant })
  });

  if (!response.ok) throw new Error(`Status code: ${response.status}`);
  return response.json();
}

export async function getCandidates(consultant?: string) {
  const url = consultant 
    ? `${API_BASE}/candidates?consultant=${consultant}`
    : `${API_BASE}/candidates`;

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Status code: ${response.status}`);
  return response.json();
}

export async function getCandidate(candidateId: string) {
  const response = await fetch(`${API_BASE}/candidates/${candidateId}`);
  if (!response.ok) throw new Error(`Status code: ${response.status}`);
  return response.json();
}

export async function saveAIMatches(candidateId: string, jobMatches: any, scores: any) {
  const response = await fetch(`${API_BASE}/candidates/${candidateId}/ai-matches`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobMatches, scores })
  });

  if (!response.ok) throw new Error(`Status code: ${response.status}`);
  return response.json();
}

export async function triggerSync() {
  const response = await fetch(`${API_BASE}/sync/pending`, {
    method: 'POST'
  });

  if (!response.ok) throw new Error(`Status code: ${response.status}`);
  return response.json();
}
```

---

## 5️⃣ 環境變數設定

### `.env.local`（本地開發）
```
REACT_APP_API_URL=http://localhost:3001/api
```

### `.env.production`（生產環境 - Zeabur）
```
REACT_APP_API_URL=https://backendstep1ne.zeabur.app/api
```

---

## 6️⃣ 測試流程

### ✅ 測試步驟 1：改狀態 + 不登出
```
1. 改候選人狀態 → "已聯繫"
2. 觀看 Network 標籤 → 確認 PUT 成功 (200 OK)
3. 刷新頁面 → 狀態保留 ✅
```

### ✅ 測試步驟 2：改狀態 + 登出再登入
```
1. 改候選人狀態 → "已發送開發信"
2. 等待 2-3 秒（同步時間）
3. 登出
4. 重新登入
5. 刷新頁面 → 狀態保留 ✅
```

### ✅ 測試步驟 3：檢查 Google Sheets 同步
```
1. 改狀態 → "已聯繫"
2. 等待 5 秒
3. 打開 Google Sheets
4. 該候選人的 Status 欄 → 已更新 ✅
```

---

## 7️⃣ 常見問題

### Q: 改狀態後為什麼有延遲？
A: API 先更新 SQL（立即），再異步同步 Google Sheets（2-5 秒）。這是正常的。

### Q: 如果改狀態失敗怎麼辦？
A: 會自動回滾本地狀態，並顯示錯誤訊息。建議檢查：
- 後端是否運行？
- PostgreSQL 是否連接？
- 候選人是否存在？

### Q: 可以批量改狀態嗎？
A: 可以，但建議一次改 10-20 筆，間隔 1-2 秒，避免 API 限流。

### Q: Google Sheets 何時會同步？
A: 
- 實時同步：立即（但非同步，不會阻擋 API 回應）
- 定期同步：每 5 分鐘自動一次（Cron Job）
- 手動同步：呼叫 `POST /api/sync/pending`

---

## 📋 改進清單

- [ ] 改 `AIMatchingPage.tsx` 的 `handleStatusChange`
- [ ] 改 `Pipeline.tsx` 的 `saveProgress`
- [ ] 改 `CandidateList.tsx` 的 `loadCandidates`
- [ ] 新增 `api-utils.ts`
- [ ] 設定 `.env.local` 和 `.env.production`
- [ ] 測試流程 1-3
- [ ] 部署到 Zeabur

---

## 🚀 預期結果

**Before**：改狀態 → 登出 → 狀態消失 ❌

**After**：改狀態 → 登出 → 狀態保留 + Google Sheets 同步 ✅
