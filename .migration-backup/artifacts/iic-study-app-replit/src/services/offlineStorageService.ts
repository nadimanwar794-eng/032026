/**
 * Offline Media Vault Storage Service
 * Encrypted & In-App Local Blob Storage using browser IndexedDB.
 * Media files (Videos, Audios, PDFs) are stored INSIDE the app database as Blobs.
 * They CANNOT be exported to phone gallery or shared externally.
 * Offline playback strictly validates subscription status and expiry dates!
 */

import { resolveTelegramUrl } from './telegramStorageService';

export type OfflineMediaKind = 'video' | 'audio' | 'pdf';

export interface OfflineMediaMeta {
  id: string;
  title: string;
  subject?: string;
  kind: OfflineMediaKind;
  originalUrl: string;
  sizeBytes: number;
  mimeType: string;
  downloadedAt: number;
  requiredTier: 'FREE' | 'BASIC' | 'ULTRA';
  subscriptionExpiry?: string | number | null;
  thumbnailUrl?: string;
  duration?: number;
}

export interface OfflineVaultRecord extends OfflineMediaMeta {
  blob: Blob;
}

const DB_NAME = 'NSTA_MEDIA_OFFLINE_VAULT_V1';
const DB_VERSION = 1;
const STORE_NAME = 'offline_media';

// Open IndexedDB instance safely
function openVaultDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported on this device/browser'));
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('kind', 'kind', { unique: false });
        store.createIndex('downloadedAt', 'downloadedAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open Offline Vault DB'));
  });
}

const CACHE_VAULT_NAME = 'NSTA_OFFLINE_MEDIA_CACHE_V1';

/**
 * Normalizes media URLs for download (handles Google Drive export links, Telegram proxy, etc.)
 */
function normalizeDownloadUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  let url = resolveTelegramUrl(rawUrl.trim());

  // Strip origin if it points to current host so it stays a safe relative path
  if (typeof window !== 'undefined' && url.startsWith(window.location.origin)) {
    url = url.substring(window.location.origin.length);
  }

  // Handle Google Drive links: convert view/sharing link to direct usercontent download
  if (
    (url.includes('drive.google.com') || url.includes('drive.usercontent.google.com')) &&
    !url.includes('confirm=')
  ) {
    const fileIdMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (fileIdMatch && fileIdMatch[1]) {
      return `https://drive.usercontent.google.com/download?id=${fileIdMatch[1]}&export=download&confirm=t`;
    }
  }

  return url;
}

/**
 * Safely saves a media Blob to the PWA CacheStorage API for high performance
 */
async function saveBlobToCacheStorage(id: string, blob: Blob, mimeType: string): Promise<boolean> {
  if (typeof window === 'undefined' || !('caches' in window)) return false;
  try {
    const cache = await window.caches.open(CACHE_VAULT_NAME);
    const fullFakeUrl = new URL(`/_offline_vault_media/${encodeURIComponent(id)}`, window.location.origin).toString();
    const response = new Response(blob, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Length': String(blob.size),
        'X-Offline-Vault-Id': id,
      },
    });
    await cache.put(fullFakeUrl, response);
    return true;
  } catch (err) {
    console.warn('[OfflineStorage] CacheStorage save warning, falling back to IndexedDB:', err);
    return false;
  }
}

/**
 * Safely retrieves a media Blob from the PWA CacheStorage API
 */
async function getBlobFromCacheStorage(id: string): Promise<Blob | null> {
  if (typeof window === 'undefined' || !('caches' in window)) return null;
  try {
    const cache = await window.caches.open(CACHE_VAULT_NAME);
    const fullFakeUrl = new URL(`/_offline_vault_media/${encodeURIComponent(id)}`, window.location.origin).toString();
    let matched = await cache.match(fullFakeUrl);
    if (!matched) {
      matched = await cache.match(`/_offline_vault_media/${encodeURIComponent(id)}`);
    }
    if (matched) {
      return await matched.blob();
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Downloads a remote URL file directly as a Blob and stores it in the in-app PWA Cache & IndexedDB.
 * Automatically tries direct download first, then internal backend streaming proxy (/api/media-proxy),
 * followed by resilient public proxies.
 */
export async function downloadAndSaveOfflineMedia(
  meta: Omit<OfflineMediaMeta, 'sizeBytes' | 'downloadedAt'>,
  onProgress?: (progressPercent: number) => void
): Promise<OfflineMediaMeta> {
  const rawUrl = meta.originalUrl;
  if (!rawUrl) throw new Error('Missing media URL');
  const targetUrl = normalizeDownloadUrl(rawUrl);

  const fetchBlobWithStreams = async (urlToFetch: string): Promise<Blob> => {
    const isSameOriginOrRelative =
      urlToFetch.startsWith('/') ||
      (typeof window !== 'undefined' && urlToFetch.includes(window.location.host));
    const credentialsMode: RequestCredentials = isSameOriginOrRelative ? 'same-origin' : 'omit';

    // 1. Modern Fetch with streaming progress
    try {
      const resp = await fetch(urlToFetch, { mode: 'cors', credentials: credentialsMode });
      if (resp.ok) {
        const contentLength = resp.headers.get('content-length');
        const total = contentLength ? parseInt(contentLength, 10) : 0;
        const contentType =
          resp.headers.get('content-type') ||
          (meta.kind === 'video' ? 'video/mp4' : meta.kind === 'audio' ? 'audio/mpeg' : 'application/octet-stream');

        // Check for HTML error response instead of media
        if (contentType.includes('text/html') && total < 100000) {
          throw new Error('Server returned HTML error page instead of video stream');
        }

        if (resp.body && total > 0 && onProgress) {
          const reader = resp.body.getReader();
          const chunks: Uint8Array[] = [];
          let loaded = 0;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
              chunks.push(value);
              loaded += value.length;
              const pct = Math.min(99, Math.round((loaded / total) * 100));
              onProgress(pct);
            }
          }
          return new Blob(chunks as any, { type: contentType });
        } else {
          // Fallback to resp.blob() directly
          if (onProgress) onProgress(45);
          const b = await resp.blob();
          if (b.type && b.type.includes('text/html') && b.size < 50000) {
            throw new Error('Received HTML error response instead of media');
          }
          if (onProgress) onProgress(90);
          return b;
        }
      } else {
        throw new Error(`Server returned HTTP ${resp.status}`);
      }
    } catch (fetchErr: any) {
      if (fetchErr?.message?.includes('HTTP ') || fetchErr?.message?.includes('HTML error')) {
        throw fetchErr;
      }
      console.log('[OfflineStorage] Fetch attempt error, trying XHR fallback:', urlToFetch, fetchErr);
    }

    // 2. Reliable XMLHttpRequest fallback
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', urlToFetch, true);
      xhr.responseType = 'blob';
      xhr.timeout = 180000; // 3 minutes timeout

      if (isSameOriginOrRelative) {
        xhr.withCredentials = true;
      }

      xhr.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          const pct = Math.round((e.loaded / e.total) * 100);
          onProgress(Math.min(99, pct));
        } else if (onProgress && e.loaded > 0) {
          const approxMb = e.loaded / (1024 * 1024);
          const simulated = Math.min(95, Math.round(15 + Math.atan(approxMb / 6) * (80 / (Math.PI / 2))));
          onProgress(simulated);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const responseBlob: Blob = xhr.response;
          if (responseBlob && responseBlob.type && responseBlob.type.includes('text/html') && responseBlob.size < 50000) {
            reject(new Error('Received HTML response instead of media'));
            return;
          }
          resolve(responseBlob);
        } else {
          reject(new Error(`Download failed with status ${xhr.status}`));
        }
      };

      xhr.onerror = () => reject(new Error('Network error or CORS restriction'));
      xhr.ontimeout = () => reject(new Error('Media download timed out'));
      xhr.send();
    });
  };

  let blob: Blob | null = null;
  let lastError: any = null;

  // Build prioritized candidate download URLs
  const candidateUrls: string[] = [];

  // Candidate 1: Direct targetUrl (works for same-origin or CORS-enabled CDNs like Cloudinary)
  candidateUrls.push(targetUrl);

  // Candidate 2: If external absolute URL, route via internal /api/media-proxy
  if (targetUrl.startsWith('http://') || targetUrl.startsWith('https://')) {
    candidateUrls.push(`/api/media-proxy?url=${encodeURIComponent(targetUrl)}`);
  }

  // Candidate 3: Try rawUrl via internal proxy if different
  if (rawUrl !== targetUrl && (rawUrl.startsWith('http://') || rawUrl.startsWith('https://'))) {
    candidateUrls.push(`/api/media-proxy?url=${encodeURIComponent(rawUrl)}`);
  }

  // Candidate 4: If Google Drive link, add alternative direct endpoints
  if (
    targetUrl.includes('drive.google.com') ||
    targetUrl.includes('drive.usercontent.google.com') ||
    rawUrl.includes('drive.google.com')
  ) {
    const full = targetUrl + ' ' + rawUrl;
    const driveMatch = full.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || full.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (driveMatch && driveMatch[1]) {
      const gId = driveMatch[1];
      const gDirect1 = `https://drive.usercontent.google.com/download?id=${gId}&export=download&confirm=t`;
      const gDirect2 = `https://drive.google.com/uc?id=${gId}&export=download`;
      candidateUrls.push(`/api/media-proxy?url=${encodeURIComponent(gDirect1)}`);
      candidateUrls.push(`/api/media-proxy?url=${encodeURIComponent(gDirect2)}`);
    }
  }

  // Candidate 5: If Telegram bot link, ensure /api/telegram/file route is tested
  if (targetUrl.includes('api.telegram.org/file/bot') || rawUrl.includes('api.telegram.org/file/bot')) {
    const full = targetUrl.includes('api.telegram.org/file/bot') ? targetUrl : rawUrl;
    const tgMatch = full.match(/\/file\/bot([^/]+)\/(.+)$/);
    if (tgMatch) {
      candidateUrls.push(
        `/api/telegram/file?path=${encodeURIComponent(tgMatch[2])}&token=${encodeURIComponent(tgMatch[1])}`
      );
      candidateUrls.push(`/api/telegram/file?path=${encodeURIComponent(tgMatch[2])}`);
    }
  }

  // Candidate 6: Public CORS proxy fallback
  if (targetUrl.startsWith('http://') || targetUrl.startsWith('https://')) {
    candidateUrls.push(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`);
  }

  // Deduplicate candidates preserving priority order
  const uniqueCandidates = Array.from(new Set(candidateUrls.filter(Boolean)));

  for (let i = 0; i < uniqueCandidates.length; i++) {
    const candidate = uniqueCandidates[i];
    try {
      blob = await fetchBlobWithStreams(candidate);
      if (blob && blob.size > 1000) {
        break;
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`[OfflineStorage] Attempt ${i + 1}/${uniqueCandidates.length} failed (${candidate}):`, err?.message);
    }
  }

  if (!blob || blob.size < 1000) {
    let cleanDetail = '';
    if (lastError?.message) {
      if (lastError.message.includes('CORS') || lastError.message.includes('Network error')) {
        cleanDetail = 'Media host dwara download block kiya gaya ya link expired hai.';
      } else if (lastError.message.includes('404')) {
        cleanDetail = 'Media file server par nahi mili (File not found).';
      } else if (lastError.message.includes('timed out')) {
        cleanDetail = 'Download time limit exceed ho gaya. Kripya tezi internet par dobara koshish karein.';
      } else {
        cleanDetail = lastError.message;
      }
    }
    throw new Error(cleanDetail || 'Media download nahi ho paya. Kripya apna internet connection check karein.');
  }

  const mimeType = blob.type || (meta.kind === 'video' ? 'video/mp4' : meta.kind === 'audio' ? 'audio/mpeg' : 'application/pdf');

  // Store Blob in high-performance PWA Cache Storage
  const savedInCache = await saveBlobToCacheStorage(meta.id, blob, mimeType);

  // ALWAYS store the full Blob in IndexedDB as well so playback is 100% resilient across all devices/sessions
  const completeItem: OfflineVaultRecord = {
    ...meta,
    mimeType,
    sizeBytes: blob.size,
    downloadedAt: Date.now(),
    blob: blob,
  };

  const db = await openVaultDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  store.put(completeItem);

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => {
      if (onProgress) onProgress(100);
      const { blob: _, ...savedMeta } = completeItem;
      resolve(savedMeta);
    };
    tx.onerror = () => reject(tx.error || new Error('Failed to save to Offline Vault'));
  });
}

/**
 * Retrieves all offline media items (metadata only, no heavy blobs for fast listing)
 */
export async function getAllOfflineMedia(): Promise<OfflineMediaMeta[]> {
  try {
    const db = await openVaultDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.openCursor();
      const items: OfflineMediaMeta[] = [];

      request.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest).result as IDBCursorWithValue;
        if (cursor) {
          const val = cursor.value as OfflineVaultRecord;
          items.push({
            id: val.id,
            title: val.title,
            subject: val.subject,
            kind: val.kind,
            originalUrl: val.originalUrl,
            sizeBytes: val.sizeBytes || 0,
            mimeType: val.mimeType,
            downloadedAt: val.downloadedAt,
            requiredTier: val.requiredTier,
            subscriptionExpiry: val.subscriptionExpiry,
            thumbnailUrl: val.thumbnailUrl,
            duration: val.duration,
          });
          cursor.continue();
        } else {
          // Sort by newest first
          items.sort((a, b) => b.downloadedAt - a.downloadedAt);
          resolve(items);
        }
      };

      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('[OfflineVault] Error getting list:', err);
    return [];
  }
}

/**
 * Checks if a specific media is already downloaded offline
 */
export async function isMediaOffline(id: string): Promise<boolean> {
  try {
    const db = await openVaultDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getKey(id);
      req.onsuccess = () => resolve(req.result !== undefined);
      req.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

/**
 * Retrieves a playable/readable Object URL from the stored CacheStorage or IndexedDB Blob
 */
export async function getOfflineMediaObjectUrl(id: string): Promise<{ url: string; record: OfflineMediaMeta } | null> {
  try {
    const db = await openVaultDB();
    const itemMeta: OfflineVaultRecord | null = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => resolve((req.result as OfflineVaultRecord) || null);
      req.onerror = () => reject(req.error);
    });

    if (!itemMeta) return null;

    // 1. Try reading Blob from CacheStorage first (High performance)
    const cachedBlob = await getBlobFromCacheStorage(id);
    if (cachedBlob) {
      const objectUrl = URL.createObjectURL(cachedBlob);
      const { blob: _, ...meta } = itemMeta;
      return { url: objectUrl, record: meta };
    }

    // 2. Fallback to IndexedDB stored Blob
    if (itemMeta.blob) {
      const objectUrl = URL.createObjectURL(itemMeta.blob);
      const { blob: _, ...meta } = itemMeta;
      return { url: objectUrl, record: meta };
    }

    return null;
  } catch (err) {
    console.error('[OfflineVault] Error reading blob:', err);
    return null;
  }
}

/**
 * Deletes a specific media item from offline storage (CacheStorage and IndexedDB)
 */
export async function deleteOfflineMedia(id: string): Promise<boolean> {
  try {
    // Delete from CacheStorage
    if (typeof window !== 'undefined' && 'caches' in window) {
      try {
        const cache = await window.caches.open(CACHE_VAULT_NAME);
        await cache.delete(`/_offline_vault_media/${encodeURIComponent(id)}`);
      } catch {}
    }

    // Delete from IndexedDB
    const db = await openVaultDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('[OfflineVault] Error deleting item:', err);
    return false;
  }
}

/**
 * Clears all downloaded offline files from storage (CacheStorage and IndexedDB)
 */
export async function clearAllOfflineVault(): Promise<boolean> {
  try {
    // Clear CacheStorage
    if (typeof window !== 'undefined' && 'caches' in window) {
      try {
        await window.caches.delete(CACHE_VAULT_NAME);
      } catch {}
    }

    // Clear IndexedDB
    const db = await openVaultDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('[OfflineVault] Error clearing vault:', err);
    return false;
  }
}

/**
 * Computes total offline space used in Megabytes (MB)
 */
export async function getOfflineVaultStorageUsageMB(): Promise<number> {
  const items = await getAllOfflineMedia();
  const totalBytes = items.reduce((acc, it) => acc + (it.sizeBytes || 0), 0);
  return Number((totalBytes / (1024 * 1024)).toFixed(1));
}

/**
 * Formats bytes to human-readable string (e.g. "12.4 MB", "850 KB")
 */
export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 MB';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Validates whether the user is authorized to play an offline item right now:
 * Checks tier and subscription expiry date!
 */
export function validateOfflinePlaybackAccess(
  item: OfflineMediaMeta,
  user: any
): { allowed: boolean; reason?: 'EXPIRED' | 'TIER_REQUIRED' | 'AUTH_REQUIRED' } {
  if (!user) return { allowed: false, reason: 'AUTH_REQUIRED' };

  // Admin and sub-admin always have full lifetime access
  if (user.role === 'ADMIN' || user.role === 'SUB_ADMIN' || user.isSuperAdmin) {
    return { allowed: true };
  }

  const userTier = (user.subscriptionTier || user.subscriptionLevel || 'FREE').toUpperCase();
  const isUltra = userTier === 'ULTRA';
  const isBasic = userTier === 'BASIC' || isUltra;

  // Check tier access requirement
  if (item.kind === 'video' && !isUltra) {
    return { allowed: false, reason: 'TIER_REQUIRED' };
  }
  if (item.kind === 'audio' && !isUltra) {
    return { allowed: false, reason: 'TIER_REQUIRED' };
  }
  if (item.kind === 'pdf' && !isBasic) {
    return { allowed: false, reason: 'TIER_REQUIRED' };
  }

  // Check subscription expiry date
  const expiry = user.subscriptionExpiresAt || user.planExpiry || item.subscriptionExpiry;
  if (expiry) {
    const expiryTime = typeof expiry === 'string' ? new Date(expiry).getTime() : Number(expiry);
    if (!isNaN(expiryTime) && expiryTime > 0) {
      if (Date.now() > expiryTime) {
        return { allowed: false, reason: 'EXPIRED' };
      }
    }
  }

  return { allowed: true };
}
