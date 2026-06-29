import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './app.css';
import 'katex/dist/katex.min.css';
import { ErrorBoundary } from './components/ErrorBoundary';
import { registerSW } from 'virtual:pwa-register';

registerSW({
  onNeedRefresh() {},
  onOfflineReady() {
    console.log('[PWA] App is ready to work offline');
  },
});

// Request persistent storage so the browser does NOT auto-evict
// IndexedDB data (nst_content_* chapter cache, nst_user_history, etc.)
// This prevents the daily content-deletion issue on mobile Chrome.
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().then(granted => {
    console.log(`[IIC] Persistent storage ${granted ? 'granted ✅' : 'not granted (browser may still evict)'}`);
  }).catch(() => {});
}

const isNetworkLikeError = (reason: any): boolean => {
  if (!reason) return false;
  const code = reason.code || reason.name || '';
  const msg = (reason.message || String(reason)).toLowerCase();
  return (
    code === 'unavailable' ||
    code === 'failed-precondition' ||
    code === 'deadline-exceeded' ||
    code === 'cancelled' ||
    code === 'AbortError' ||
    code === 'NetworkError' ||
    msg.includes('network') ||
    msg.includes('offline') ||
    msg.includes('failed to fetch') ||
    msg.includes('load failed') ||
    msg.includes('client is offline')
  );
};

window.addEventListener('unhandledrejection', (event) => {
  if (isNetworkLikeError(event.reason)) {
    console.warn('[offline] suppressed network rejection:', event.reason);
    event.preventDefault();
  }
});

window.addEventListener('error', (event) => {
  if (isNetworkLikeError(event.error || event.message)) {
    console.warn('[offline] suppressed network error:', event.error || event.message);
    event.preventDefault();
  }
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
