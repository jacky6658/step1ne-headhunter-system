module.exports = {
  apps: [
    {
      name: 'step1ne-backend',
      script: 'server.js',
      cwd: '/Users/step1ne/step1ne-headhunter-system/server',
      watch: false,
      autorestart: true,
      max_restarts: 50,
      restart_delay: 3000,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3003,
        // API keys 從 server/.env 讀取，不再硬編碼
      },
      // 日誌寫入永久目錄（不再寫 /tmp）
      error_file: '/Users/step1ne/logs/step1ne/error.log',
      out_file: '/Users/step1ne/logs/step1ne/out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    {
      name: 'step1ne-frontend',
      script: 'npx',
      args: 'vite preview --host 0.0.0.0 --port 3002',
      cwd: '/Users/step1ne/step1ne-headhunter-system',
      autorestart: true,
      max_restarts: 50,
      restart_delay: 3000,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
      },
      error_file: '/Users/step1ne/logs/step1ne/frontend-error.log',
      out_file: '/Users/step1ne/logs/step1ne/frontend-out.log',
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
      error_file: '/Users/step1ne/logs/agile/error.log',
      out_file: '/Users/step1ne/logs/agile/out.log',
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
      error_file: '/Users/step1ne/logs/agile/frontend-error.log',
      out_file: '/Users/step1ne/logs/agile/frontend-out.log',
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
      error_file: '/Users/step1ne/logs/crawler/error.log',
      out_file: '/Users/step1ne/logs/crawler/out.log',
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
      error_file: '/Users/step1ne/logs/cloudflared/error.log',
      out_file: '/Users/step1ne/logs/cloudflared/out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    }
  ]
};
