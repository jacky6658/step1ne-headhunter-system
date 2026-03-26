#!/bin/bash
# ============================================
# Step1ne DB 自動清理腳本
# 排程：每週日 03:00
# 用途：清理 candidates_pipeline 垃圾資料
# ============================================

set -euo pipefail

# ── 設定 ──────────────────────────────────────
DB_USER="user"
DB_NAME="step1ne"
BACKUP_REPO="/Users/user/Downloads/step1ne-db-backups"
BACKUP_DIR="$BACKUP_REPO/backups/$(date +%Y)/$(date +%m)"
CLEANUP_BACKUP_DIR="/Users/user/Downloads/db-cleanup-records"
LOG_FILE="/Users/user/logs/db-cleanup.log"
DATE_TAG=$(date +%Y-%m-%d_%H%M)
PSQL="psql -U $DB_USER -d $DB_NAME -t -A"

# ── 工具函數 ──────────────────────────────────
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# ── 開始 ──────────────────────────────────────
log "=========================================="
log "🦞 Step1ne DB 自動清理開始"
log "=========================================="

mkdir -p "$BACKUP_DIR" "$CLEANUP_BACKUP_DIR"

# ── Step 0：清理前總數 ────────────────────────
BEFORE_COUNT=$($PSQL -c "SELECT count(*) FROM candidates_pipeline;")
log "📊 清理前總人選：$BEFORE_COUNT 人"

# ── Step 1：清理前完整備份 ────────────────────
log "💾 執行清理前完整備份..."
pg_dump -U "$DB_USER" -d "$DB_NAME" | gzip > "$BACKUP_DIR/step1ne_${DATE_TAG}_pre-cleanup.sql.gz"
log "✅ 備份完成：step1ne_${DATE_TAG}_pre-cleanup.sql.gz"

# ── 規則 1：公司/組織帳號 ────────────────────
RULE1_SQL="
  name ILIKE '%公司%' OR name ILIKE '%協會%' OR name ILIKE '%基金會%'
  OR name ILIKE '%學會%' OR name ILIKE '%商會%'
  OR name ILIKE '%center%' OR name ILIKE '%association%'
  OR name ILIKE '%institute%' OR name ILIKE '%university%'
  OR name ILIKE '%Inc%' OR name ILIKE '%Corp%' OR name ILIKE '%Ltd%'
  OR name ILIKE '%co.%' OR name ILIKE '%group%'
  OR name ILIKE '%lab %' OR name ILIKE '%studio%'
  OR name ILIKE '%同意並加入%' OR name ILIKE '%登入或註冊%'
  OR current_position ILIKE '%company%'
"

# 先排除真人誤判（名字含 Inc 但其實是人名的情況，用 linkedin_url 有值來保護）
# 只刪沒有 linkedin_url 或 current_position 明顯是組織的
RULE1_SAFE_SQL="
  ($RULE1_SQL)
  AND (
    linkedin_url IS NULL OR linkedin_url = '' OR linkedin_url = E'\\\\N'
    OR current_position ILIKE '%company%'
    OR name ILIKE '%同意並加入%' OR name ILIKE '%登入或註冊%'
    OR name ILIKE '%Trade Center%'
  )
"

RULE1_COUNT=$($PSQL -c "SELECT count(*) FROM candidates_pipeline WHERE $RULE1_SAFE_SQL;")
log "🏢 規則1 - 公司/組織帳號：$RULE1_COUNT 人"

if [ "$RULE1_COUNT" -gt 0 ]; then
    $PSQL -c "COPY (SELECT * FROM candidates_pipeline WHERE $RULE1_SAFE_SQL) TO STDOUT WITH CSV HEADER;" > "$CLEANUP_BACKUP_DIR/rule1_org_${DATE_TAG}.csv"
    $PSQL -c "DELETE FROM candidates_pipeline WHERE $RULE1_SAFE_SQL;"
    log "  ✅ 已刪除 $RULE1_COUNT 人（備份：rule1_org_${DATE_TAG}.csv）"
fi

# ── 規則 2：資料全空（僅有名字）──────────────
RULE2_SQL="
  (current_position IS NULL OR current_position = '' OR current_position = E'\\\\N')
  AND (skills IS NULL OR skills = '' OR skills = E'\\\\N')
  AND (linkedin_url IS NULL OR linkedin_url = '' OR linkedin_url = E'\\\\N')
  AND (email IS NULL OR email = '' OR email = E'\\\\N')
  AND (ai_score IS NULL)
  AND name IS NOT NULL AND name != ''
"

RULE2_COUNT=$($PSQL -c "SELECT count(*) FROM candidates_pipeline WHERE $RULE2_SQL;")
log "📭 規則2 - 資料全空：$RULE2_COUNT 人"

if [ "$RULE2_COUNT" -gt 0 ]; then
    $PSQL -c "COPY (SELECT * FROM candidates_pipeline WHERE $RULE2_SQL) TO STDOUT WITH CSV HEADER;" > "$CLEANUP_BACKUP_DIR/rule2_empty_${DATE_TAG}.csv"
    $PSQL -c "DELETE FROM candidates_pipeline WHERE $RULE2_SQL;"
    log "  ✅ 已刪除 $RULE2_COUNT 人（備份：rule2_empty_${DATE_TAG}.csv）"
fi

# ── 規則 3：無 LinkedIn + 無現職 + 無技能 ────
RULE3_SQL="
  (linkedin_url IS NULL OR linkedin_url = '' OR linkedin_url = E'\\\\N')
  AND (current_position IS NULL OR current_position = '' OR current_position = E'\\\\N')
  AND (skills IS NULL OR skills = '' OR skills = E'\\\\N')
"

RULE3_COUNT=$($PSQL -c "SELECT count(*) FROM candidates_pipeline WHERE $RULE3_SQL;")
log "🚫 規則3 - 無LinkedIn+無現職+無技能：$RULE3_COUNT 人"

if [ "$RULE3_COUNT" -gt 0 ]; then
    $PSQL -c "COPY (SELECT * FROM candidates_pipeline WHERE $RULE3_SQL) TO STDOUT WITH CSV HEADER;" > "$CLEANUP_BACKUP_DIR/rule3_no_info_${DATE_TAG}.csv"
    $PSQL -c "DELETE FROM candidates_pipeline WHERE $RULE3_SQL;"
    log "  ✅ 已刪除 $RULE3_COUNT 人（備份：rule3_no_info_${DATE_TAG}.csv）"
fi

# ── 規則 4：無任何聯繫方式 ───────────────────
RULE4_SQL="
  (linkedin_url IS NULL OR linkedin_url = '' OR linkedin_url = E'\\\\N')
  AND (github_url IS NULL OR github_url = '' OR github_url = E'\\\\N')
  AND (email IS NULL OR email = '' OR email = E'\\\\N' OR email = 'unknown@github.com')
"

RULE4_COUNT=$($PSQL -c "SELECT count(*) FROM candidates_pipeline WHERE $RULE4_SQL;")
log "📵 規則4 - 無任何聯繫方式：$RULE4_COUNT 人"

if [ "$RULE4_COUNT" -gt 0 ]; then
    $PSQL -c "COPY (SELECT * FROM candidates_pipeline WHERE $RULE4_SQL) TO STDOUT WITH CSV HEADER;" > "$CLEANUP_BACKUP_DIR/rule4_no_contact_${DATE_TAG}.csv"
    $PSQL -c "DELETE FROM candidates_pipeline WHERE $RULE4_SQL;"
    log "  ✅ 已刪除 $RULE4_COUNT 人（備份：rule4_no_contact_${DATE_TAG}.csv）"
fi

# ── 規則 5：LinkedIn URL 去重 ────────────────
RULE5_SQL="
  id NOT IN (
    SELECT MIN(id) FROM candidates_pipeline
    WHERE linkedin_url IS NOT NULL AND linkedin_url != '' AND linkedin_url != E'\\\\N'
    GROUP BY linkedin_url
  )
  AND linkedin_url IN (
    SELECT linkedin_url FROM candidates_pipeline
    WHERE linkedin_url IS NOT NULL AND linkedin_url != '' AND linkedin_url != E'\\\\N'
    GROUP BY linkedin_url
    HAVING count(*) > 1
  )
"

RULE5_COUNT=$($PSQL -c "SELECT count(*) FROM candidates_pipeline WHERE $RULE5_SQL;")
log "👥 規則5 - LinkedIn重複：$RULE5_COUNT 人"

if [ "$RULE5_COUNT" -gt 0 ]; then
    $PSQL -c "COPY (SELECT * FROM candidates_pipeline WHERE $RULE5_SQL) TO STDOUT WITH CSV HEADER;" > "$CLEANUP_BACKUP_DIR/rule5_duplicates_${DATE_TAG}.csv"
    $PSQL -c "DELETE FROM candidates_pipeline WHERE $RULE5_SQL;"
    log "  ✅ 已刪除 $RULE5_COUNT 人（備份：rule5_duplicates_${DATE_TAG}.csv）"
fi

# ── 清理後統計 ────────────────────────────────
AFTER_COUNT=$($PSQL -c "SELECT count(*) FROM candidates_pipeline;")
TOTAL_DELETED=$((BEFORE_COUNT - AFTER_COUNT))

log ""
log "=========================================="
log "📊 清理報告"
log "=========================================="
log "| 規則 | 刪除原因                   | 人數 |"
log "|------|---------------------------|------|"
log "| 1    | 公司/組織帳號              | $RULE1_COUNT |"
log "| 2    | 資料全空                   | $RULE2_COUNT |"
log "| 3    | 無LinkedIn+無現職+無技能   | $RULE3_COUNT |"
log "| 4    | 無任何聯繫方式             | $RULE4_COUNT |"
log "| 5    | LinkedIn重複               | $RULE5_COUNT |"
log "|------|---------------------------|------|"
log "| 合計 |                           | $TOTAL_DELETED |"
log "| 清理前 → 清理後 | $BEFORE_COUNT → $AFTER_COUNT 人 |"
log "=========================================="

# ── 清理後完整備份 ────────────────────────────
if [ "$TOTAL_DELETED" -gt 0 ]; then
    log "💾 執行清理後完整備份..."
    pg_dump -U "$DB_USER" -d "$DB_NAME" --schema-only > "$BACKUP_DIR/schema_${DATE_TAG}_post-cleanup.sql"
    pg_dump -U "$DB_USER" -d "$DB_NAME" | gzip > "$BACKUP_DIR/step1ne_${DATE_TAG}_post-cleanup.sql.gz"
    log "✅ 備份完成"

    # ── Push 到 GitHub ────────────────────────
    log "📤 推送到 GitHub..."
    cd "$BACKUP_REPO"
    git add -A backups/
    git commit -m "chore: weekly DB cleanup ${DATE_TAG} - removed ${TOTAL_DELETED} garbage candidates (${BEFORE_COUNT} → ${AFTER_COUNT})

Rules applied:
- Rule 1 (org accounts): ${RULE1_COUNT}
- Rule 2 (empty data): ${RULE2_COUNT}
- Rule 3 (no linkedin+position+skills): ${RULE3_COUNT}
- Rule 4 (no contact info): ${RULE4_COUNT}
- Rule 5 (duplicates): ${RULE5_COUNT}

Co-Authored-By: Step1ne DB Cleanup Bot <noreply@step1ne.com>" || true
    git pull --rebase origin main 2>/dev/null || true
    git push origin main 2>/dev/null && log "✅ 已推送到 GitHub" || log "⚠️ GitHub 推送失敗，請手動處理"
else
    log "✨ 沒有需要清理的資料，DB 很乾淨！"
fi

log ""
log "🦞 清理完成！"
log ""
