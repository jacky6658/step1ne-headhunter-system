/**
 * Socket.IO 即時推播服務
 * 連線到後端 WebSocket，接收候選人更新事件
 */
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;
const reconnectCallbacks: Set<() => void> = new Set();

/**
 * 取得 Socket.IO 連線 URL
 */
function getSocketUrl(): string {
  if (typeof window === 'undefined') return 'https://api-hr.step1ne.com';
  const host = window.location.hostname;
  if (host === 'hrsystem.step1ne.com') return 'https://api-hr.step1ne.com';
  return `http://localhost:${3003}`;
}

/**
 * 初始化 Socket.IO 連線（單例模式）
 */
export function getSocket(): Socket {
  if (!socket) {
    socket = io(getSocketUrl(), {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,           // 從 Infinity 改為 10 次
      reconnectionDelay: 2000,            // 初始 2 秒
      reconnectionDelayMax: 30000,        // 最大 30 秒（指數退避上限）
      randomizationFactor: 0.3,           // 30% jitter 避免 thundering herd
      timeout: 20000,                     // 連線 timeout 20 秒
    });

    socket.on('connect', () => {
      console.log('🔌 Socket.IO 已連線:', socket?.id);
      // 重連後通知所有訂閱者重新載入資料
      reconnectCallbacks.forEach(cb => cb());
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 Socket.IO 斷線:', reason);
    });

    socket.on('connect_error', (err) => {
      console.warn('🔌 Socket.IO 連線失敗:', err.message);
    });

    // 10 次重連都失敗後，等 60 秒再嘗試
    socket.on('reconnect_failed', () => {
      console.warn('🔌 Socket.IO 重連失敗（已嘗試 10 次），60 秒後重試');
      setTimeout(() => {
        if (socket && socket.disconnected) {
          socket.connect();
        }
      }, 60_000);
    });

    // 監聽頁面可見性變化（閒置回來自動重載）
    attachVisibilityListener();
  }
  return socket;
}

/**
 * 候選人即時更新事件型別
 */
export type CandidateEvent =
  | { type: 'updated'; id: number; data: any }
  | { type: 'created'; id: number; data: any }
  | { type: 'deleted'; id: number }
  | { type: 'batch-updated'; ids: number[]; status: string };

/**
 * 訂閱候選人即時更新
 * @returns 取消訂閱的函數
 */
export function onCandidateChange(callback: (event: CandidateEvent) => void): () => void {
  const s = getSocket();

  const handleUpdated = (payload: { id: number; data: any }) => {
    callback({ type: 'updated', id: payload.id, data: payload.data });
  };
  const handleCreated = (payload: { id: number; data: any }) => {
    callback({ type: 'created', id: payload.id, data: payload.data });
  };
  const handleDeleted = (payload: { id: number }) => {
    callback({ type: 'deleted', id: payload.id });
  };
  const handleBatchUpdated = (payload: { ids: number[]; status: string }) => {
    callback({ type: 'batch-updated', ids: payload.ids, status: payload.status });
  };

  s.on('candidate:updated', handleUpdated);
  s.on('candidate:created', handleCreated);
  s.on('candidate:deleted', handleDeleted);
  s.on('candidate:batch-updated', handleBatchUpdated);

  // 回傳取消訂閱函數
  return () => {
    s.off('candidate:updated', handleUpdated);
    s.off('candidate:created', handleCreated);
    s.off('candidate:deleted', handleDeleted);
    s.off('candidate:batch-updated', handleBatchUpdated);
  };
}

/**
 * 註冊重連回呼（斷線恢復後自動重新載入資料）
 * @returns 取消註冊的函數
 */
export function onReconnect(callback: () => void): () => void {
  reconnectCallbacks.add(callback);
  getSocket(); // 確保 socket 已初始化
  return () => { reconnectCallbacks.delete(callback); };
}

/**
 * 頁面可見性變化監聽 — 閒置回來後自動重連 + 重載資料
 * 瀏覽器背景標籤會被節流（Tab Throttling），WebSocket 可能斷線，
 * 回到頁面時觸發 reconnect callbacks 確保資料最新
 */
let visibilityListenerAttached = false;

function attachVisibilityListener(): void {
  if (visibilityListenerAttached || typeof document === 'undefined') return;
  visibilityListenerAttached = true;

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && socket) {
      console.log('👁️ 頁面回到前景，檢查連線狀態...');
      if (socket.disconnected) {
        console.log('🔄 Socket 已斷線，嘗試重連...');
        socket.connect();
      } else {
        // 即使連線中，閒置超過 2 分鐘也主動重載資料（可能錯過事件）
        reconnectCallbacks.forEach(cb => cb());
      }
    }
  });
}

/**
 * 斷開 Socket.IO 連線
 */
export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
