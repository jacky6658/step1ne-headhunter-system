# 後端轉 SQL 實作備忘錄 (Internal Tech Note)

如果您決定開始將專案轉向 SQL，請參考此架構調整建議：

## 1. 推薦架構
推薦使用 **Supabase** (PostgreSQL 託管) 作為第一首選，因為它對前端開發者最友好，且保留了您目前習慣的「即時更新」特性。

## 2. 核心 SQL 建表語句 (DML)

```sql
-- 建立使用者表
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  role TEXT CHECK (role IN ('ADMIN', 'REVIEWER')) DEFAULT 'REVIEWER',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 建立案件表
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  platform TEXT NOT NULL,
  platform_id TEXT,
  need TEXT NOT NULL,
  budget_text TEXT,
  posted_at TIMESTAMPTZ,
  status TEXT DEFAULT '待篩選',
  decision TEXT DEFAULT 'pending',
  priority INTEGER DEFAULT 3,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 建立審計日誌
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  changes JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 3. 前端 Service 改動預演
當切換到 SQL 後，您的 `leadService.ts` 將會從：
```typescript
onSnapshot(query(collection(db, 'leads')), (snap) => { ... });
```
變更為（以 Supabase 為例）：
```typescript
supabase.from('leads').select('*').on('INSERT', (payload) => { ... }).subscribe();
```

## 4. 下一步建議
如果您現在就想切換，我建議我們先從 **Supabase** 開始，因為這樣您不需要自己架設後端伺服器 (Node.js)，可以維持現在的開發效率。
