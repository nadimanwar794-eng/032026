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
  if (key === 'nst_users') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return safeSaveUsersCache(parsed);
      }
    } catch {}
  }

  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err: any) {
    // Check if error is QuotaExceededError
    const isQuota =
      err?.name === 'QuotaExceededError' ||
      err?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      err?.code === 22 ||
      err?.code === 1014 ||
      String(err?.message || '').toLowerCase().includes('quota');

    if (isQuota) {
      try {
        // Attempt automatic emergency storage cleanup
        pruneLocalStorageForQuota();
        if (key === 'nst_users') {
          try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) return safeSaveUsersCache(parsed);
          } catch {}
        }
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
 * Deduplicates inbox items by id (or by text+date if id is missing)
 */
export function deduplicateInbox(inbox?: any[]): any[] {
  if (!Array.isArray(inbox)) return [];
  const seen = new Set<string>();
  const result: any[] = [];
  for (const item of inbox) {
    if (!item) continue;
    const key = item.id || `${item.text || ''}_${item.date || ''}_${item.type || ''}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}

/**
 * Strips bulky / heavyweight fields from user objects so they fit safely in localStorage cache.
 */
export function compactUserForCache(user: any): any {
  if (!user || typeof user !== 'object') return user;
  const {
    // Drop heavy properties that cause multi-megabyte bloat
    history,
    quizHistory,
    examHistory,
    activityLog,
    detailedProgress,
    chatMessages,
    routinePlan,
    revisionTracker,
    ...rest
  } = user;

  // Trim arrays that can grow indefinitely
  const trimmedReferredList = Array.isArray(rest.referredUsersList)
    ? rest.referredUsersList.slice(0, 5)
    : rest.referredUsersList;

  const trimmedInbox = Array.isArray(rest.inbox)
    ? deduplicateInbox(rest.inbox).slice(0, 10)
    : rest.inbox;

  const trimmedCommissionLogs = Array.isArray(rest.referralCommissionLogs)
    ? rest.referralCommissionLogs.slice(0, 5)
    : rest.referralCommissionLogs;

  return {
    ...rest,
    referredUsersList: trimmedReferredList,
    inbox: trimmedInbox,
    referralCommissionLogs: trimmedCommissionLogs,
  };
}

/**
 * Safely writes 'nst_users' to localStorage without throwing QuotaExceededError.
 * Compacts user objects, limits count if necessary, and catches quota issues gracefully.
 */
export function safeSaveUsersCache(users: any[]): boolean {
  if (!Array.isArray(users)) return false;
  try {
    // 1. Compact users to essential cache representation
    const compacted = users.map(compactUserForCache);

    // Try saving compacted users (capped at max 60 to protect quota)
    const listToSave = compacted.slice(0, 60);
    const jsonStr = JSON.stringify(listToSave);

    try {
      localStorage.setItem('nst_users', jsonStr);
      return true;
    } catch (err: any) {
      // If quota exceeded, prune storage and try smaller subset
      pruneLocalStorageForQuota();

      // Try with top 20 users
      const smallerList = compacted.slice(0, 20);
      try {
        localStorage.setItem('nst_users', JSON.stringify(smallerList));
        return true;
      } catch {
        // Try with top 5 users or remove nst_users if localStorage is completely exhausted
        try {
          const minimalList = compacted.slice(0, 5);
          localStorage.setItem('nst_users', JSON.stringify(minimalList));
          return true;
        } catch {
          try { localStorage.removeItem('nst_users'); } catch {}
          console.warn('[safeSaveUsersCache] Quota exceeded; cleared nst_users cache to protect app.');
          return false;
        }
      }
    }
  } catch (e) {
    console.warn('[safeSaveUsersCache] Failed to cache users safely:', e);
    return false;
  }
}

/**
 * Installs global quota protection on Storage.prototype.setItem so that
 * direct localStorage.setItem calls across any component or library
 * automatically recover from QuotaExceededError without throwing unhandled exceptions.
 */
let quotaProtectionInstalled = false;
export function installStorageQuotaProtection(): void {
  if (quotaProtectionInstalled || typeof window === 'undefined' || !window.localStorage) return;
  try {
    const originalSetItem = window.localStorage.setItem.bind(window.localStorage);
    window.localStorage.setItem = function (key: string, value: string) {
      try {
        if (key === 'nst_users') {
          try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) {
              safeSaveUsersCache(parsed);
              return;
            }
          } catch {}
        }
        originalSetItem(key, value);
      } catch (err: any) {
        const isQuota =
          err?.name === 'QuotaExceededError' ||
          err?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
          err?.code === 22 ||
          err?.code === 1014 ||
          String(err?.message || '').toLowerCase().includes('quota');

        if (isQuota) {
          console.warn(`[StorageQuotaProtection] Quota exceeded for "${key}". Recovering...`);
          try {
            if (key === 'nst_users') {
              try {
                const parsed = JSON.parse(value);
                if (Array.isArray(parsed)) {
                  safeSaveUsersCache(parsed);
                  return;
                }
              } catch {}
              try { window.localStorage.removeItem('nst_users'); } catch {}
              return;
            }

            pruneLocalStorageForQuota();
            originalSetItem(key, value);
          } catch (retryErr) {
            // Backup to sessionStorage if localStorage is completely exhausted
            try {
              window.sessionStorage.setItem(key, value);
            } catch {}
            console.warn(`[StorageQuotaProtection] LocalStorage full for "${key}". Saved to sessionStorage.`);
          }
        } else {
          throw err;
        }
      }
    };
    quotaProtectionInstalled = true;
  } catch (e) {
    console.warn('[installStorageQuotaProtection] Failed to hook Storage.prototype.setItem:', e);
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

    // Check if nst_users itself is oversized (> 100KB) and compact it
    try {
      const usersRaw = localStorage.getItem('nst_users');
      if (usersRaw && usersRaw.length > 100000) {
        try {
          const parsed = JSON.parse(usersRaw);
          if (Array.isArray(parsed)) {
            const compacted = parsed.slice(0, 20).map(compactUserForCache);
            localStorage.setItem('nst_users', JSON.stringify(compacted));
          }
        } catch {
          localStorage.removeItem('nst_users');
        }
      }
    } catch {}

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
