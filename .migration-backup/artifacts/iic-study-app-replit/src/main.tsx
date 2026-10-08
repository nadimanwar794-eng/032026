import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './app.css';
import 'katex/dist/katex.min.css';
import { ErrorBoundary } from './components/ErrorBoundary';
import { registerSW } from 'virtual:pwa-register';
import { installStorageQuotaProtection } from './utils/safeUtils';
import { logErrorToFirebase } from './utils/errorLogger';

// Intercept and protect localStorage against QuotaExceededError crashes
installStorageQuotaProtection();

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

// Intercept benign Firestore offline transition and network warnings so they don't get logged as fatal uncaught console errors
const _origConsoleError = console.error;
console.error = (...args: any[]) => {
  const text = args.map(a => (a?.stack || a?.message || String(a || ''))).join(' ').toLowerCase();
  if (
    text.includes('could not reach cloud firestore backend') ||
    text.includes('client will operate in offline mode') ||
    text.includes("backend didn't respond within") ||
    text.includes('pending promise was never set') ||
    (text.includes('@firebase/auth') && text.includes('internal assertion failed')) ||
    (text.includes('@firebase/firestore') && (text.includes('offline') || text.includes('10 seconds'))) ||
    text.includes('failed to reload') ||
    (text.includes('[vite]') && (text.includes('reload') || text.includes('hmr') || text.includes('connecting')))
  ) {
    console.warn('[IIC Notice]', ...args);
    return;
  }
  _origConsoleError.apply(console, args);
};

const isBenignError = (reason: any): boolean => {
  if (!reason) return true;
  const code = reason.code || reason.name || '';
  const msg = (reason.message || String(reason)).toLowerCase();
  return (
    code === 'unavailable' ||
    code === 'failed-precondition' ||
    code === 'deadline-exceeded' ||
    code === 'cancelled' ||
    code === 'AbortError' ||
    code === 'NetworkError' ||
    code === 'QuotaExceededError' ||
    code === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    msg.includes('script error') ||
    msg === 'script error.' ||
    msg === 'script error' ||
    msg.includes('network') ||
    msg.includes('offline') ||
    msg.includes('failed to fetch') ||
    msg.includes('load failed') ||
    msg.includes('client is offline') ||
    msg.includes('could not reach cloud firestore backend') ||
    msg.includes("backend didn't respond") ||
    msg.includes('client will operate in offline mode') ||
    msg.includes('pending promise was never set') ||
    msg.includes('internal assertion failed') ||
    msg.includes('quota') ||
    msg.includes('exceeded the quota')
  );
};

// Auto-capture console.error calls containing Error objects or error strings
const _originalConsoleError = console.error;
let _isLoggingConsoleError = false;
console.error = function (...args: any[]) {
  try {
    _originalConsoleError.apply(console, args);
  } catch {}
  if (_isLoggingConsoleError) return;
  try {
    _isLoggingConsoleError = true;
    for (const arg of args) {
      if (arg instanceof Error) {
        logErrorToFirebase(arg, { type: 'runtime' }).catch(() => {});
        break;
      } else if (typeof arg === 'string' && (arg.toLowerCase().includes('error') || arg.toLowerCase().includes('failed') || arg.toLowerCase().includes('uncaught'))) {
        if (!isBenignError(arg)) {
          logErrorToFirebase(new Error(arg), { type: 'runtime' }).catch(() => {});
          break;
        }
      }
    }
  } catch {} finally {
    _isLoggingConsoleError = false;
  }
};

window.addEventListener('unhandledrejection', (event) => {
  if (isBenignError(event.reason)) {
    console.warn('[suppressed rejection]:', event.reason);
    event.preventDefault();
    return;
  }
  const err = event.reason instanceof Error ? event.reason : new Error(String(event.reason ?? 'Unhandled Promise Rejection'));
  logErrorToFirebase(err, { type: 'promise' }).catch(() => {});
});

window.addEventListener('error', (event) => {
  if (!event.error && (event.message === 'Script error.' || event.message === 'Script error')) {
    event.preventDefault();
    if (event.stopImmediatePropagation) event.stopImmediatePropagation();
    return;
  }
  if (isBenignError(event.error || event.message)) {
    console.warn('[suppressed error]:', event.error || event.message);
    event.preventDefault();
    if (event.stopImmediatePropagation) event.stopImmediatePropagation();
    return;
  }
  logErrorToFirebase(event.error || new Error(event.message || 'Unknown runtime error'), {
    type: 'runtime',
  }).catch(() => {});
}, true);

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

if (typeof (window as any).hidePreReactSplash === 'function') {
  (window as any).hidePreReactSplash();
}
