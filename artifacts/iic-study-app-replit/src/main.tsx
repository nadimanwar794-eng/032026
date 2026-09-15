import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './app.css';
import 'katex/dist/katex.min.css';
import { ErrorBoundary } from './components/ErrorBoundary';
import { registerSW } from 'virtual:pwa-register';

// Service-worker registration must never block the first React paint. A stale
// PWA worker can otherwise leave the browser between its native splash and the
// app's own loading screen with only the HTML background visible.
try {
  registerSW({
    immediate: true,
    onNeedRefresh() {},
    onOfflineReady() {
      console.info('[PWA] App is ready to work offline');
    },
  });
} catch (error) {
  console.warn('[PWA] Service worker registration skipped:', error);
}

// Request persistent storage so the browser does NOT auto-evict
// IndexedDB data (nst_content_* chapter cache, nst_user_history, etc.)
// This prevents the daily content-deletion issue on mobile Chrome.
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().then(granted => {
    console.log(`[IIC] Persistent storage ${granted ? 'granted ✅' : 'not granted (browser may still evict)'}`);
  }).catch(() => {});
}

// Intercept benign Firestore offline transition and network warnings so they don't get logged as fatal uncaught console errors
const _origConsoleError = console.error;
console.error = (...args: any[]) => {
  const text = args.map(a => (a?.stack || a?.message || String(a || ''))).join(' ').toLowerCase();
  if (
    text.includes('could not reach cloud firestore backend') ||
    text.includes('client will operate in offline mode') ||
    text.includes("backend didn't respond within") ||
    (text.includes('@firebase/firestore') && (text.includes('offline') || text.includes('10 seconds')))
  ) {
    console.warn('[IIC Offline Mode Notice]', ...args);
    return;
  }
  _origConsoleError.apply(console, args);
};

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
    msg.includes('client is offline') ||
    msg.includes('could not reach cloud firestore backend') ||
    msg.includes("backend didn't respond") ||
    msg.includes('client will operate in offline mode')
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
