import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { ErrorBoundary } from './components/ErrorBoundary';

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
    event.preventDefault();
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
