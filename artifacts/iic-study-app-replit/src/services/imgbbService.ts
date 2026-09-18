/**
 * Cloud Image Upload Service with Auto-Fallback & Optimization
 * Primary Provider: FreeImage.host (High speed direct CDN, no throttling)
 * Secondary Provider: ImgBB
 * Offline/Fallback: Compressed Data URL (guarantees upload NEVER fails)
 */

const FREEIMAGE_API_KEY = '6d207e02198a847aa98d0a2a901485a5';
const FREEIMAGE_UPLOAD_URL = 'https://freeimage.host/api/1/upload';

const IMGBB_API_KEY = '09685f54349874efecdd6b764314d492';
const IMGBB_UPLOAD_URL = `https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`;

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
 * Uploads an image directly to high-availability CDN with multiple fallback layers:
 * 1. FreeImage.host CDN (High speed direct iili.io links)
 * 2. ImgBB CDN
 * 3. Compact Compressed Data URL (100% resilient fallback)
 *
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
    // Compress first for fast network transit (higher resolution & quality when HD enabled)
    base64Data = await compressImage(file, targetMaxWidth, targetMaxHeight, targetQuality);
  } catch (err) {
    console.warn('[Cloud Image Service] Pre-compression failed, continuing raw:', err);
  }

  // ── Strategy 1: FreeImage.host Direct CDN ──
  try {
    const formData = new FormData();
    formData.append('key', FREEIMAGE_API_KEY);
    formData.append('action', 'upload');
    formData.append('format', 'json');

    if (base64Data) {
      const rawBase64 = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
      formData.append('source', rawBase64);
    } else if (typeof file !== 'string') {
      formData.append('source', file as any);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);
    const res = await fetch(FREEIMAGE_UPLOAD_URL, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const json = await res.json();
      const directUrl =
        json?.image?.url ||
        json?.image?.display_url ||
        json?.data?.url ||
        json?.image?.image?.url;
      if (directUrl && typeof directUrl === 'string') {
        return directUrl;
      }
    }
  } catch (err) {
    console.warn('[Cloud Image Service] FreeImage host attempt failed, trying fallback:', err);
  }

  // ── Strategy 2: ImgBB Cloud Fallback ──
  try {
    const formData = new FormData();
    if (base64Data) {
      const rawBase64 = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
      formData.append('image', rawBase64);
    } else if (typeof file === 'string') {
      const cleanBase64 = file.replace(/^data:image\/[a-z]+;base64,/, '');
      formData.append('image', cleanBase64);
    } else {
      formData.append('image', file);
    }
    if (name) formData.append('name', name);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);
    const res = await fetch(IMGBB_UPLOAD_URL, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const directUrl = data?.data?.display_url || data?.data?.image?.url || data?.data?.url;
      if (directUrl) {
        return directUrl;
      }
    }
  } catch (err) {
    console.warn('[Cloud Image Service] ImgBB fallback attempt failed:', err);
  }

  // ── Strategy 3: Guaranteed In-App Compressed Data URL ──
  // If external CDN servers are blocked by network/ISP or API rate-limits,
  // compress image cleanly so it instantly delivers without throwing an error
  try {
    const fallbackWidth = isHd ? 1920 : 960;
    const fallbackHeight = isHd ? 1920 : 960;
    const fallbackQuality = isHd ? 0.88 : 0.70;
    const ultraCompact = await compressImage(file, fallbackWidth, fallbackHeight, fallbackQuality);
    if (ultraCompact) {
      return ultraCompact;
    }
  } catch {}

  if (base64Data) {
    return base64Data;
  }

  throw new Error('Photo upload nahi ho payi. Kripya dobara koshish karein.');
}

