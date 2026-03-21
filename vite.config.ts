
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  server: {
    port: 3002,
    host: '0.0.0.0',
    allowedHosts: ['hrsystem.step1ne.com', 'localhost'],
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        // 移除 Origin header，避免生產 CORS 白名單拒絕 localhost
        headers: {
          Origin: '',
        },
      },
    },
  },
  plugins: [react()],
  define: {
    // 移除會抹除 process.env 的定義，讓系統能正確抓到注入的 API_KEY
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    // 僅暴露 VITE_ 開頭的環境變數給客戶端（防止洩漏 DB 密碼、API Key 等敏感資訊）
    'process.env': JSON.stringify(
      Object.fromEntries(
        Object.entries(process.env).filter(([k]) => k.startsWith('VITE_'))
      )
    )
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          // 重型函式庫獨立拆分，避免主 bundle 過大
          'vendor-charts': ['recharts'],
          'vendor-icons': ['lucide-react'],
        },
      },
    },
  }
});
