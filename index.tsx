// 核心修復：在所有導入前確保 process 變數就緒，防止部署後 ReferenceError
if (typeof window !== 'undefined') {
  (window as any).process = (window as any).process || { env: {} };
}

import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; // 引入 Tailwind 樣式
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("找不到 root 節點，請檢查 index.html");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);