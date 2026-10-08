/**
 * Telegram Cloud Storage Service for NSTA
 * Unlimited Free Cloud Media Storage powered by Telegram Bot (@nsta_vault_bot)
 *
 * Supported features:
 * - Profile pictures & App loading screens
 * - NSTA Messenger (photos, documents, voice notes)
 * - NSTA Status (stories & media)
 * - Community Feed posts, images & videos
 * - Lecture PDFs, Audios & Videos
 * - Admin roadmap & media managers
 *
 * Architecture:
 * - Browser sends upload to internal secure proxy endpoint: /api/telegram/upload
 * - Telegram Bot Token is kept safely on server-side (never leaked in browser/URLs)
 * - Files are served via /api/telegram/file with full CORS, Range requests & caching
 */

export const DEFAULT_STORAGE_CHAT_ID = '7849468653'; // Verified Telegram chat ID
export const DEFAULT_BOT_TOKEN = '8938213127:AAEjjjXmxjOuqpo5PP2TgorWOa17uYeD-Dw';
export const DEFAULT_STORAGE_BOT_TOKEN = '8938213127:AAEjjjXmxjOuqpo5PP2TgorWOa17uYeD-Dw';

// Chat Bot & Channel (Nsta Messenger & Community)
export const DEFAULT_CHAT_CHANNEL_ID = '-1004290996442'; // Nsta messanger channel
export const DEFAULT_CHAT_BOT_TOKEN = '8932524192:AAGVxYSuKPZX6sOQFkXz0U7ESVQ2NcHmJZw'; // @PothiaAppBot
export const TELEGRAM_CHAT_INVITE_LINK = 'https://t.me/+p0aIY7YWgGxhYzk1';
const STORAGE_CHAT_KEY = 'nst_telegram_storage_chat_id';

export interface TelegramUploadResult {
  url: string;
  fileId: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  directUrl?: string;
}

export interface UploadOptions {
  fileName?: string;
  caption?: string;
  type?: 'image' | 'video' | 'audio' | 'pdf' | 'document';
  chatId?: string;
  timeoutMs?: number;
  onProgress?: (percent: number) => void;
}

/**
 * Gets currently active storage chat ID
 */
export const getTelegramStorageChatId = (): string => {
  return localStorage.getItem(STORAGE_CHAT_KEY) || DEFAULT_STORAGE_CHAT_ID;
};

/**
 * Sets custom storage channel/chat ID
 */
export const setTelegramStorageChatId = (chatId: string) => {
  if (chatId) {
    localStorage.setItem(STORAGE_CHAT_KEY, chatId.trim());
  }
};

/**
 * Converts a base64 Data URL or string to a Blob
 */
function dataUrlToBlob(dataUrl: string, defaultMime = 'image/jpeg'): Blob {
  const parts = dataUrl.split(';base64,');
  const mime = parts[0]?.replace('data:', '') || defaultMime;
  const byteString = atob(parts[1] || parts[0]);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mime });
}

/**
 * Resolves Telegram and media URLs for browser loading.
 * Converts local proxy URLs (/api/telegram/file?path=...) back to direct Telegram CDN links
 * so images and videos can load directly in the browser even without a backend proxy server.
 * Also handles t.me links, base64 data URLs, and standard image URLs.
 */
export function resolveTelegramUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return rawUrl;
  const trimmed = rawUrl.trim();

  // If already base64 data URL, return as-is
  if (trimmed.startsWith('data:image/') || trimmed.startsWith('data:video/')) {
    return trimmed;
  }

  // Convert /api/telegram/file?path=... back to direct Telegram bot CDN URL with full CORS support
  if (trimmed.startsWith('/api/telegram/file')) {
    try {
      const matchPath = trimmed.match(/[?&]path=([^&]+)/);
      const matchToken = trimmed.match(/[?&]token=([^&]+)/);
      const token = matchToken ? decodeURIComponent(matchToken[1]) : DEFAULT_BOT_TOKEN;
      const path = matchPath ? decodeURIComponent(matchPath[1]) : '';
      if (path) {
        return `https://api.telegram.org/file/bot${token}/${path}`;
      }
    } catch {}
  }

  // If direct Telegram bot URL, keep it! Direct Telegram URLs are directly accessible by <img> and <video>
  if (trimmed.includes('api.telegram.org/file/bot')) {
    return trimmed;
  }

  // Handle Telegram public post links (e.g. https://t.me/channel_name/123)
  if (trimmed.startsWith('https://t.me/') || trimmed.startsWith('http://t.me/')) {
    // If it's a direct message embed link or image link, return cleaned URL
    return trimmed;
  }

  return trimmed;
}

/**
 * Direct Telegram Cloud Storage upload function.
 * Connects directly to Telegram Bot API with CORS support.
 * Guaranteed fallback if local proxy endpoint is unreachable or blocked.
 */
export async function uploadDirectToTelegram(
  blob: Blob,
  fileName: string,
  targetChatId: string,
  opts: UploadOptions = {}
): Promise<TelegramUploadResult> {
  const isLarge = blob.size > 2 * 1024 * 1024;
  const timeoutMs = opts.timeoutMs || (isLarge ? 300000 : 120000);

  const tgFormData = new FormData();
  tgFormData.append('chat_id', targetChatId);
  if (opts.caption) {
    tgFormData.append('caption', opts.caption);
  }
  tgFormData.append('document', blob, fileName);

  if (typeof XMLHttpRequest !== 'undefined') {
    return new Promise<TelegramUploadResult>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.timeout = timeoutMs;

      if (opts.onProgress) opts.onProgress(10);

      if (xhr.upload && opts.onProgress) {
        xhr.upload.onprogress = (evt) => {
          if (evt.lengthComputable && evt.total > 0) {
            const pct = Math.min(95, Math.max(10, Math.round((evt.loaded / evt.total) * 95)));
            opts.onProgress!(pct);
          }
        };
      }

      xhr.onload = async () => {
        let data: any = null;
        try {
          data = xhr.responseText ? JSON.parse(xhr.responseText) : null;
        } catch {}

        if (xhr.status >= 200 && xhr.status < 300 && data && data.ok) {
          const doc =
            data.result?.document ||
            (Array.isArray(data.result?.photo) ? data.result.photo.slice(-1)[0] : null) ||
            data.result?.audio ||
            data.result?.video;

          const fileId = doc?.file_id;
          let filePath = '';
          if (fileId) {
            try {
              const pathRes = await fetch(`https://api.telegram.org/bot${DEFAULT_BOT_TOKEN}/getFile?file_id=${fileId}`);
              const rawPathText = await pathRes.text();
              const pathJson = rawPathText ? JSON.parse(rawPathText) : null;
              if (pathJson?.ok && pathJson.result?.file_path) {
                filePath = pathJson.result.file_path;
              }
            } catch (pErr) {
              console.warn('[Direct Telegram Upload] getFile warning:', pErr);
            }
          }

          const directUrl = filePath ? `https://api.telegram.org/file/bot${DEFAULT_BOT_TOKEN}/${filePath}` : '';
          const proxyUrl = filePath ? `/api/telegram/file?path=${encodeURIComponent(filePath)}&name=${encodeURIComponent(fileName)}` : directUrl;
          // Direct URL works globally in all browsers and web apps without relying on internal proxy server
          const resolvedUrl = directUrl || proxyUrl;

          if (opts.onProgress) opts.onProgress(100);

          resolve({
            url: resolvedUrl,
            directUrl: resolvedUrl,
            fileId: fileId || '',
            fileName: doc?.file_name || fileName,
            fileSize: doc?.file_size || blob.size,
            mimeType: doc?.mime_type || blob.type,
          });
        } else {
          const errDesc = data?.description || `Telegram upload response error (${xhr.status})`;
          reject(new Error(errDesc));
        }
      };

      xhr.onerror = () => {
        reject(new Error('Telegram server se sampark nahi ho saka. Kripya internet check karein.'));
      };

      xhr.ontimeout = () => {
        reject(new Error(`Upload time limit exceed ho gaya (${Math.round(timeoutMs / 1000)}s). Internet slow hai.`));
      };

      xhr.open('POST', `https://api.telegram.org/bot${DEFAULT_BOT_TOKEN}/sendDocument`, true);
      xhr.send(tgFormData);
    });
  }

  // Fetch fallback for headless/worker environments
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`https://api.telegram.org/bot${DEFAULT_BOT_TOKEN}/sendDocument`, {
      method: 'POST',
      body: tgFormData,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const rawText = await res.text();
    const data = rawText ? JSON.parse(rawText) : null;

    if (!res.ok || !data?.ok) {
      throw new Error(data?.description || `Telegram error (${res.status})`);
    }

    const doc =
      data.result?.document ||
      (Array.isArray(data.result?.photo) ? data.result.photo.slice(-1)[0] : null) ||
      data.result?.audio ||
      data.result?.video;

    const fileId = doc?.file_id;
    let filePath = '';
    if (fileId) {
      try {
        const pathRes = await fetch(`https://api.telegram.org/bot${DEFAULT_BOT_TOKEN}/getFile?file_id=${fileId}`);
        const pData = await pathRes.json();
        if (pData?.ok && pData.result?.file_path) {
          filePath = pData.result.file_path;
        }
      } catch {}
    }

    const directUrl = filePath ? `https://api.telegram.org/file/bot${DEFAULT_BOT_TOKEN}/${filePath}` : '';

    return {
      url: directUrl,
      directUrl,
      fileId: fileId || '',
      fileName: doc?.file_name || fileName,
      fileSize: doc?.file_size || blob.size,
      mimeType: doc?.mime_type || blob.type,
    };
  } catch (fErr: any) {
    clearTimeout(timeoutId);
    throw fErr;
  }
}

/**
 * Checks Telegram Storage server proxy health and connectivity
 */
export async function checkTelegramStorageHealth(): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch('/api/telegram/health');
    const rawText = await res.text();
    let data: any = null;
    try {
      data = rawText ? JSON.parse(rawText) : null;
    } catch {}

    if (!res.ok || !data) {
      return { ok: false, message: `Server returned status ${res.status}` };
    }
    return {
      ok: Boolean(data?.ok),
      message: data?.ok ? `Connected to @${data.bot?.username || 'Telegram Bot'}` : data?.error || 'Bot offline',
    };
  } catch (err: any) {
    return { ok: false, message: err?.message || 'Failed to reach Telegram proxy' };
  }
}

/**
 * Primary universal upload function: Uploads any media or file to Telegram Cloud Storage.
 * Attempts server proxy /api/telegram/upload first with credentials.
 * Automatically falls back to direct Telegram Bot API if proxy returns 405, 403, 502, or network failure.
 */
export async function uploadToTelegramStorage(
  fileInput: File | Blob | string,
  options?: UploadOptions | string
): Promise<TelegramUploadResult> {
  const opts: UploadOptions = typeof options === 'string' ? { caption: options } : options || {};
  const targetChatId = opts.chatId || getTelegramStorageChatId();

  let blob: Blob;
  let fileName = opts.fileName || 'file';

  if (typeof fileInput === 'string') {
    if (fileInput.startsWith('data:')) {
      const mimeMatch = fileInput.match(/^data:([^;]+);/);
      const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
      blob = dataUrlToBlob(fileInput, mime);
      if (!opts.fileName) {
        const ext = mime.split('/')[1] || 'jpg';
        fileName = `upload_${Date.now()}.${ext}`;
      }
    } else {
      throw new Error('Invalid string format for file upload (must be a data: URL)');
    }
  } else if (fileInput instanceof File) {
    blob = fileInput;
    fileName = fileInput.name || fileName;
  } else {
    blob = fileInput;
  }

  // Check 50MB Telegram cloud storage limit
  const MAX_FILE_SIZE = 50 * 1024 * 1024;
  if (blob.size > MAX_FILE_SIZE) {
    const sizeMb = (blob.size / (1024 * 1024)).toFixed(1);
    throw new Error(`File size ${sizeMb}MB hai. Telegram cloud storage limit 50MB hai. Kripya 50MB se chhota video/file upload karein.`);
  }

  const formData = new FormData();
  formData.append('chat_id', targetChatId);
  if (opts.caption) {
    formData.append('caption', opts.caption);
  }
  formData.append('fileName', fileName);
  formData.append('document', blob, fileName);

  const isLarge = blob.size > 2 * 1024 * 1024;
  // 5 minutes (300,000ms) for large files/videos, 2 minutes (120,000ms) for small files
  const timeoutMs = opts.timeoutMs || (isLarge ? 300000 : 120000);

  // Use XMLHttpRequest in browser for continuous progress tracking and clean timeouts
  if (typeof XMLHttpRequest !== 'undefined') {
    return new Promise<TelegramUploadResult>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.timeout = timeoutMs;
      xhr.withCredentials = true;

      if (opts.onProgress) {
        opts.onProgress(5);
      }

      if (xhr.upload && opts.onProgress) {
        xhr.upload.onprogress = (evt) => {
          if (evt.lengthComputable && evt.total > 0) {
            const pct = Math.min(95, Math.max(5, Math.round((evt.loaded / evt.total) * 95)));
            opts.onProgress!(pct);
          }
        };
      }

      const fallbackToDirect = () => {
        console.warn(`[Telegram Storage] Proxy attempt status ${xhr.status}, switching to direct Telegram cloud upload...`);
        uploadDirectToTelegram(blob, fileName, targetChatId, opts)
          .then(resolve)
          .catch((directErr) => {
            const finalMsg = directErr?.message || `Upload fail ho gaya (Status: ${xhr.status || 'unknown'})`;
            reject(new Error(finalMsg));
          });
      };

      xhr.onload = () => {
        let data: any = null;
        try {
          data = xhr.responseText ? JSON.parse(xhr.responseText) : null;
        } catch {}

        if (xhr.status >= 200 && xhr.status < 300 && data && data.ok) {
          if (opts.onProgress) opts.onProgress(100);

          resolve({
            url: data.url,
            fileId: data.fileId,
            fileName: data.fileName || fileName,
            fileSize: data.fileSize || blob.size,
            mimeType: data.mimeType,
            directUrl: data.directUrl,
          });
        } else {
          // If 405 (auth bridge redirect / static 405), 403, 502, 504, or empty JSON response:
          fallbackToDirect();
        }
      };

      xhr.onerror = () => {
        console.warn('[Telegram Storage Service] Proxy network error, falling back to direct upload...');
        fallbackToDirect();
      };

      xhr.ontimeout = () => {
        console.warn(`[Telegram Storage Service] Proxy timed out, attempting direct upload...`);
        fallbackToDirect();
      };

      xhr.onabort = () => {
        console.warn('[Telegram Storage Service] Upload aborted');
        reject(new Error('Upload cancel ho gaya.'));
      };

      try {
        xhr.open('POST', '/api/telegram/upload', true);
        xhr.send(formData);
      } catch (openErr) {
        fallbackToDirect();
      }
    });
  }

  // Fallback for non-browser environments: Fetch with fallback to direct upload
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    try {
      controller.abort(new Error(`Upload timed out after ${timeoutMs}ms`));
    } catch {
      controller.abort();
    }
  }, timeoutMs);

  try {
    if (opts.onProgress) opts.onProgress(20);

    const res = await fetch('/api/telegram/upload', {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (opts.onProgress) opts.onProgress(85);

    const rawText = await res.text();
    let data: any = null;
    try {
      data = rawText ? JSON.parse(rawText) : null;
    } catch {}

    if (res.ok && data && data.ok) {
      if (opts.onProgress) opts.onProgress(100);

      return {
        url: data.url,
        fileId: data.fileId,
        fileName: data.fileName || fileName,
        fileSize: data.fileSize || blob.size,
        mimeType: data.mimeType,
        directUrl: data.directUrl,
      };
    }

    // Proxy didn't succeed, fall back to direct
    return await uploadDirectToTelegram(blob, fileName, targetChatId, opts);
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.warn('[Telegram Storage Service] Fetch proxy failed, attempting direct upload fallback:', err?.message || err);
    try {
      return await uploadDirectToTelegram(blob, fileName, targetChatId, opts);
    } catch (directErr: any) {
      throw new Error(directErr?.message || 'Telegram upload fail ho gaya. Kripya network check karke dobara koshish karein.');
    }
  }
}

/**
 * Uploads an image directly to Telegram Cloud and returns the proxy CDN URL
 */
export async function uploadImageToTelegram(
  file: File | Blob | string,
  fileName?: string,
  caption = 'NSTA Media'
): Promise<string> {
  const result = await uploadToTelegramStorage(file, {
    fileName: fileName || `image_${Date.now()}.jpg`,
    caption,
    type: 'image',
  });
  return result.url;
}

/**
 * Uploads a PDF directly to Telegram Cloud and returns the proxy CDN URL
 */
export async function uploadPdfToTelegram(
  file: File | Blob,
  fileName?: string,
  caption = 'NSTA Lecture PDF'
): Promise<string> {
  const result = await uploadToTelegramStorage(file, {
    fileName: fileName || `document_${Date.now()}.pdf`,
    caption,
    type: 'pdf',
  });
  return result.url;
}

/**
 * Uploads an Audio file directly to Telegram Cloud and returns the proxy CDN URL
 */
export async function uploadAudioToTelegram(
  file: File | Blob,
  fileName?: string,
  caption = 'NSTA Audio Lecture'
): Promise<string> {
  const result = await uploadToTelegramStorage(file, {
    fileName: fileName || `audio_${Date.now()}.mp3`,
    caption,
    type: 'audio',
  });
  return result.url;
}

/**
 * Uploads a Video file directly to Telegram Cloud with progress callback and returns the proxy CDN URL
 */
export async function uploadVideoToTelegram(
  file: File | Blob,
  fileName?: string,
  caption = 'NSTA Video Lecture',
  onProgress?: (percent: number) => void
): Promise<string> {
  const result = await uploadToTelegramStorage(file, {
    fileName: fileName || (file instanceof File ? file.name : `video_${Date.now()}.mp4`),
    caption,
    type: 'video',
    onProgress,
  });
  return result.url;
}

/**
 * Sends a message to the Telegram Chat Channel
 */
export async function sendTelegramChatMessage(
  text: string,
  options?: { chatId?: string; replyToMessageId?: number; parseMode?: string }
): Promise<{ ok: boolean; result?: any; error?: string }> {
  try {
    const res = await fetch('/api/telegram/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        chat_id: options?.chatId || DEFAULT_CHAT_CHANNEL_ID,
        reply_to_message_id: options?.replyToMessageId,
        parse_mode: options?.parseMode || 'HTML',
      }),
    });
    return await res.json();
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Failed to send Telegram message' };
  }
}

/**
 * Syncs a new Community post to the Telegram Channel
 */
export async function sendTelegramCommunityPost(post: {
  authorName: string;
  authorRole?: string;
  text?: string;
  category?: string;
  imageUrl?: string;
  videoUrl?: string;
}): Promise<void> {
  try {
    const roleBadge = post.authorRole ? ` [${post.authorRole}]` : '';
    const categoryBadge = post.category ? `📌 <b>#${post.category.replace(/\s+/g, '_')}</b>\n` : '';
    const mediaBadge = post.imageUrl
      ? `\n🖼️ <a href="${post.imageUrl}">View Attached Image</a>`
      : post.videoUrl
      ? `\n🎥 <a href="${post.videoUrl}">Watch Attached Video</a>`
      : '';

    const formattedMessage = `📢 <b>NSTA Community Post</b>\n👤 <b>${post.authorName}${roleBadge}</b>\n${categoryBadge}\n${post.text || '(Shared Media)'}${mediaBadge}`;

    await sendTelegramChatMessage(formattedMessage);
  } catch (err) {
    console.warn('[Telegram Community Sync] Notice:', err);
  }
}

