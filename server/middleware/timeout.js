/**
 * Request Timeout Middleware
 *
 * 防止長跑查詢永遠佔住連線。
 * 路由可透過 req.timeoutMs 覆蓋預設值。
 */
function requestTimeout(defaultMs = 30000) {
  return (req, res, next) => {
    const ms = req.timeoutMs || defaultMs;

    const timer = setTimeout(() => {
      if (!res.headersSent) {
        console.error(`⏰ Timeout: ${req.method} ${req.path} (${ms}ms)`);
        res.status(504).json({
          success: false,
          error: '請求處理超時，請稍後再試',
        });
      }
    }, ms);

    res.on('finish', () => clearTimeout(timer));
    res.on('close', () => clearTimeout(timer));

    next();
  };
}

module.exports = requestTimeout;
