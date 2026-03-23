module.exports = {
  apps: [
    {
      name: 'step1ne-backend',
      script: 'server.js',
      cwd: '/Users/step1ne/step1ne-headhunter-system/server',
      watch: false,
      autorestart: true,           // 掛掉自動重啟
      max_restarts: 50,            // 最多重啟 50 次
      restart_delay: 3000,         // 重啟間隔 3 秒
      max_memory_restart: '512M',  // 記憶體超過 512MB 自動重啟
      env: {
        NODE_ENV: 'production',
        PORT: 3003,
        API_SECRET_KEY: 'PotfZ42-qPyY4uqSwqstpxllQB1alxVfjJsm3Mgp3HQ',
        OPENCLAW_API_KEY: 'O39cJZAHsVEdz5dN8hvzu90FDT0xwYDPGQTWIeaK',
      },
      // 日誌設定
      error_file: '/tmp/step1ne-server-error.log',
      out_file: '/tmp/step1ne-server.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    {
      name: 'step1ne-frontend',
      script: 'npx',
      args: 'vite --host 0.0.0.0 --port 3002',
      cwd: '/Users/step1ne/step1ne-headhunter-system',
      autorestart: true,
      max_restarts: 50,
      restart_delay: 3000,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
      },
      error_file: '/tmp/step1ne-frontend-error.log',
      out_file: '/tmp/step1ne-frontend.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    // ─── Agile Hub ───
    {
      name: 'agile-backend',
      script: 'server/server.js',
      cwd: '/Users/step1ne/Downloads/agile-hub',
      autorestart: true,
      max_restarts: 50,
      restart_delay: 3000,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'development',
        PORT: 3001,
        DATABASE_URL: 'postgresql://step1ne@localhost:5432/agile_hub',
      },
      error_file: '/tmp/agile-backend-error.log',
      out_file: '/tmp/agile-backend.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    {
      name: 'agile-frontend',
      script: 'npx',
      args: 'vite --host 0.0.0.0 --port 3000',
      cwd: '/Users/step1ne/Downloads/agile-hub',
      autorestart: true,
      max_restarts: 50,
      restart_delay: 3000,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
      },
      error_file: '/tmp/agile-frontend-error.log',
      out_file: '/tmp/agile-frontend.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    // ─── Headhunter Crawler (Python) ───
    {
      name: 'crawler',
      script: 'app.py',
      cwd: '/Users/step1ne/headhunter-crawler',
      interpreter: '/usr/bin/python3',
      autorestart: true,
      max_restarts: 50,
      restart_delay: 3000,
      max_memory_restart: '512M',
      env: {
        PORT: 5001,
      },
      error_file: '/tmp/crawler-error.log',
      out_file: '/tmp/crawler.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    // ─── Cloudflare Tunnel ───
    {
      name: 'cloudflared',
      script: 'cloudflared',
      args: 'tunnel run',
      autorestart: true,
      max_restarts: 100,
      restart_delay: 5000,
      // 日誌
      error_file: '/tmp/cloudflared-error.log',
      out_file: '/tmp/cloudflared.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    }
  ]
};
