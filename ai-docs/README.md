# ai-docs — Step1ne AI 專用文檔

此資料夾包含所有 AI Bot / AI 工具需要的系統文檔。

## 文件清單

| 文件 | 說明 | 更新時機 |
|------|------|---------|
| [API-REFERENCE.md](./API-REFERENCE.md) | 所有 API 端點完整參考（117 個端點） | 新增/修改端點時 |
| [CHANGELOG.md](./CHANGELOG.md) | 系統更新紀錄 | 每次功能更新時 |

## 給 AI Bot 的快速指引

### 認證
```bash
# 一般 API（Bearer Token）
curl -H "Authorization: Bearer YOUR_API_KEY" https://backendstep1ne.zeabur.app/api/candidates

# OpenClaw API（X-OpenClaw-Key）
curl -H "X-OpenClaw-Key: YOUR_OPENCLAW_KEY" https://backendstep1ne.zeabur.app/api/openclaw/pending
```

### 最常用端點

| 操作 | 端點 |
|------|------|
| 列出候選人 | `GET /api/candidates?limit=100` |
| 取得候選人詳情 | `GET /api/candidates/:id` |
| 更新候選人 | `PATCH /api/candidates/:id` |
| 寫入 AI 總結 | `PATCH /api/candidates/:id` + `{ "ai_summary": {...} }` |
| 列出職缺 | `GET /api/jobs` |
| 取得職缺詳情 | `GET /api/jobs/:id` |
| 列出客戶 | `GET /api/clients` |
| 健康檢查 | `GET /api/health` |

### AI 總結回寫格式
```json
PATCH /api/candidates/:id
{
  "ai_summary": {
    "one_liner": "一句話定位",
    "top_matches": [{ "job_id": "", "job_title": "", "match_score": 85 }],
    "strengths": ["優勢1", "優勢2"],
    "risks": ["風險1"],
    "next_steps": "行動建議",
    "evaluated_at": "ISO 8601",
    "evaluated_by": "模型名稱"
  },
  "actor": "AI-summary"
}
```
