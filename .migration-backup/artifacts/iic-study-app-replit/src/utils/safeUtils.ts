/**
 * safeUtils.ts — Defensive utility wrappers to prevent common runtime crashes.
 * Use these instead of raw JSON.parse, array access, and async calls.
 */

/**
 * Safe JSON.parse — returns fallback on any error instead of throwing.
 */
export function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed as T;
  } catch {
    return fallback;
  }
}

/**
 * Safe array cast — ensures a value is always an array, never undefined/null.
 */
export function safeArray<T>(val: T[] | null | undefined): T[] {
  return Array.isArray(val) ? val : [];
}

/**
 * Safe localStorage.getItem — returns null silently if storage is unavailable.
 */
export function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Safe localStorage.setItem — fails gracefully and attempts quota cleanup on QuotaExceededError.
 */
export function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err: any) {
    // Check if error is QuotaExceededError
    const isQuota =
      err?.name === 'QuotaExceededError' ||
      err?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      err?.code === 22 ||
      err?.code === 1014;

    if (isQuota) {
      try {
        // Attempt automatic emergency storage cleanup
        pruneLocalStorageForQuota();
        localStorage.setItem(key, value);
        return true;
      } catch {
        // Backup to sessionStorage if localStorage is completely exhausted
        try {
          sessionStorage.setItem(key, value);
        } catch {}
        console.warn(`[safeSetItem] LocalStorage quota exceeded for key "${key}". Cleaned up and preserved transiently.`);
        window.dispatchEvent(new CustomEvent('nst_storage_quota_warning', { detail: { key } }));
        return false;
      }
    }
    return false;
  }
}

/**
 * Emergency cleanup for localStorage: removes stale temp/preview keys and trims oversized historical logs.
 */
export function pruneLocalStorageForQuota(): void {
  try {
    const keysToRemove: string[] = [];
    const keysToTrim: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;

      // Drop disposable temporary keys
      if (
        k.startsWith('nst_temp_') ||
        k.startsWith('nst_preview_') ||
        k.startsWith('nst_cached_search_') ||
        k.includes('_preview') ||
        k.startsWith('nst_draft_')
      ) {
        keysToRemove.push(k);
      } else if (
        k.startsWith('nst_app_notifications_') ||
        k.startsWith('nst_activity_history_') ||
        k.startsWith('nst_score_log_') ||
        k.startsWith('nst_universal_analysis_logs')
      ) {
        keysToTrim.push(k);
      }
    }

    // Remove temporary keys first
    for (const k of keysToRemove) {
      try { localStorage.removeItem(k); } catch {}
    }

    // Trim oversized array keys to the most recent 20 items
    for (const k of keysToTrim) {
      try {
        const raw = localStorage.getItem(k);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 20) {
            localStorage.setItem(k, JSON.stringify(parsed.slice(-20)));
          }
        }
      } catch {}
    }
  } catch (e) {
    console.warn('[pruneLocalStorageForQuota] Error during storage pruning:', e);
  }
}

/**
 * Safe localStorage.removeItem — fails silently.
 */
export function safeRemoveItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {}
}

/**
 * Safe JSON parse from localStorage in one call.
 * safeStorageJson('key', []) → parsed array or []
 */
export function safeStorageJson<T>(key: string, fallback: T): T {
  return safeJsonParse<T>(safeGetItem(key), fallback);
}

/**
 * Safe async wrapper — catches any rejection and returns fallback.
 * const data = await safeAsync(fetchSomething(), null);
 */
export async function safeAsync<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch {
    return fallback;
  }
}

/**
 * Defensive object property getter — returns fallback if path is undefined.
 * safeGet(user, 'profile.name', 'Unknown')
 */
export function safeGet<T>(obj: unknown, path: string, fallback: T): T {
  try {
    const parts = path.split('.');
    let current: unknown = obj;
    for (const part of parts) {
      if (current == null || typeof current !== 'object') return fallback;
      current = (current as Record<string, unknown>)[part];
    }
    return current == null ? fallback : (current as T);
  } catch {
    return fallback;
  }
}

/**
 * Clamp a number within [min, max].
 */
export function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}

/**
 * Safe number cast — returns fallback if value is NaN/null/undefined.
 */
export function safeNum(val: unknown, fallback: number = 0): number {
  const n = Number(val);
  return isNaN(n) ? fallback : n;
}

/**
 * Safe string cast — returns empty string for null/undefined.
 */
export function safeStr(val: unknown, fallback: string = ''): string {
  if (val == null) return fallback;
  return String(val);
}
