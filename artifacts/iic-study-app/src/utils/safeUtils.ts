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
 * Safe localStorage.setItem — fails silently instead of throwing QuotaExceededError.
 */
export function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
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
