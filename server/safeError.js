/**
 * safeError.js - 安全的錯誤回應
 *
 * 伺服器端記錄完整錯誤，客戶端只看到通用訊息。
 * 避免洩漏資料庫表名、欄位名、SQL 語法等內部資訊。
 */
function safeError(res, err, context = 'Unknown') {
  console.error(`❌ ${context}:`, err.message);
  if (err.stack && process.env.NODE_ENV !== 'production') {
    console.error(err.stack);
  }
  // 不回傳 err.message，避免洩漏內部資訊
  res.status(500).json({
    success: false,
    error: '伺服器內部錯誤，請稍後再試'
  });
}

module.exports = { safeError };
