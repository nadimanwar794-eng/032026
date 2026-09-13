/**
 * Performance Mode — for low-end devices.
 *
 * When enabled:
 *  - Adds `data-perf="1"` to <body>
 *  - CSS selectors on that attribute kill heavy animations, blurs, shadows
 *  - Persisted to localStorage so it survives reloads
 */

const PERF_KEY = 'nst_perf_mode_v1';

export function isPerfModeActive(): boolean {
  try {
    return localStorage.getItem(PERF_KEY) === '1';
  } catch {
    return false;
  }
}

function applyPerfMode(enabled: boolean): void {
  if (enabled) {
    document.body.setAttribute('data-perf', '1');
  } else {
    document.body.removeAttribute('data-perf');
  }
}

export function initPerfMode(): void {
  applyPerfMode(isPerfModeActive());
}

export function togglePerfMode(): boolean {
  const next = !isPerfModeActive();
  try {
    localStorage.setItem(PERF_KEY, next ? '1' : '0');
  } catch {}
  applyPerfMode(next);
  return next;
}

export function setPerfMode(enabled: boolean): void {
  try {
    localStorage.setItem(PERF_KEY, enabled ? '1' : '0');
  } catch {}
  applyPerfMode(enabled);
}
