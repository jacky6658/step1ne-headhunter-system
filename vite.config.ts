
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [react()],
  define: {
    // 移除會抹除 process.env 的定義，讓系統能正確抓到注入的 API_KEY
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    // 將環境變數暴露給客戶端（僅以 VITE_ 開頭的變數會被暴露）
    'process.env': JSON.stringify(process.env)
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  }
});
