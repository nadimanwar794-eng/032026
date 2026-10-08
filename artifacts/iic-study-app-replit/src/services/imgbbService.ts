import { uploadImageToTelegram, resolveTelegramUrl } from './telegramStorageService';

/**
 * Universal Image Upload Service powered by Telegram Cloud Storage (@nsta_vault_bot)
 * Unlimited Free Cloud CDN hosting for profile photos, status updates, community posts,
 * homework attachments, and admin formulas.
 */

export interface ImgBBUploadResponse {
  success: boolean;
  url?: string;
  displayUrl?: string;
  deleteUrl?: string;
  error?: string;
}

/**
 * Compresses an image File/Blob to high quality web JPEG Base64
 * Keeps size optimized (~100-300KB) for instant loading
 */
export async function compressImage(
  file: File | Blob | string,
  maxWidth = 1600,
  maxHeight = 1600,
  quality = 0.82
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof file === 'string' && file.startsWith('data:image/')) {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(file);
      img.src = file;
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    };
    reader.onerror = reject;
    if (typeof file !== 'string') {
      reader.readAsDataURL(file as any);
    } else {
      resolve(String(file));
    }
  });
}

export interface UploadImageOptions {
  isHd?: boolean;
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

/**
 * Uploads an image directly to Telegram Cloud Storage (@nsta_vault_bot).
 * Supports HD mode: high resolution up to 3200px & 0.95 quality for crystal-clear notes and formulas.
 */
export async function uploadImageToImgBB(
  file: File | Blob | string,
  name?: string,
  options?: UploadImageOptions | boolean
): Promise<string> {
  const isHd = typeof options === 'boolean' ? options : !!options?.isHd;
  const targetMaxWidth = (typeof options === 'object' && options?.maxWidth) ? options.maxWidth : isHd ? 3200 : 1600;
  const targetMaxHeight = (typeof options === 'object' && options?.maxHeight) ? options.maxHeight : isHd ? 3200 : 1600;
  const targetQuality = (typeof options === 'object' && options?.quality) ? options.quality : isHd ? 0.95 : 0.85;

  let base64Data = '';
  try {
    // Compress first for fast network transit
    base64Data = await compressImage(file, targetMaxWidth, targetMaxHeight, targetQuality);
  } catch (err) {
    console.warn('[Image Upload Service] Pre-compression skipped:', err);
  }

  // ── Strategy 1: Telegram Cloud Storage (@nsta_vault_bot) via Secure Proxy ──
  try {
    const inputPayload = (file instanceof File || file instanceof Blob) ? file : (base64Data || file);
    const directTelegramUrl = await uploadImageToTelegram(
      inputPayload,
      name || `nsta_img_${Date.now()}.jpg`,
      'NSTA App Media'
    );
    if (directTelegramUrl && typeof directTelegramUrl === 'string' && directTelegramUrl.trim()) {
      return resolveTelegramUrl(directTelegramUrl.trim());
    }
  } catch (tgErr: any) {
    console.warn('[Image Upload Service] Telegram storage attempt error:', tgErr?.message || tgErr);
  }

  // ── Strategy 2: In-App Compressed Data URL Fallback (For offline & network resilience) ──
  try {
    const fallbackWidth = isHd ? 1280 : 800;
    const fallbackHeight = isHd ? 1280 : 800;
    const fallbackQuality = isHd ? 0.82 : 0.72;
    const ultraCompact = await compressImage(file, fallbackWidth, fallbackHeight, fallbackQuality);
    if (ultraCompact) {
      return ultraCompact;
    }
  } catch (compErr) {
    console.warn('[Image Upload Service] Fallback compression error:', compErr);
  }

  if (base64Data) {
    return base64Data;
  }

  throw new Error('Photo process nahi ho payi. Kripya dobara koshish karein.');
}
