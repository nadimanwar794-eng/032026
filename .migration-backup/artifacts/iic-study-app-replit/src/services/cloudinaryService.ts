import { uploadToTelegramStorage, resolveTelegramUrl } from './telegramStorageService';

// Telegram Cloud Storage powered Media Service (Drop-in replacement for Cloudinary)
// Provides unlimited free media hosting for Video, Audio, PDF, and Images
export interface CloudinaryUploadResult {
  url: string;
  secure_url: string;
  public_id: string;
  format: string;
  duration?: number;
  resource_type: string;
  bytes: number;
}

export const CLOUDINARY_CONFIG = {
  cloudName: 'nsta_telegram_vault',
  uploadPreset: 'telegram_cloud',
  folder: 'nsta_media',
};

export type CloudinaryMediaKind = 'video' | 'audio' | 'pdf' | 'image' | 'auto';

/**
 * Universal media upload powered by Telegram Cloud Storage.
 * Retains Cloudinary API signature for backwards compatibility across all UI components.
 */
export const uploadToCloudinary = async (
  file: File,
  resourceType: CloudinaryMediaKind = 'auto',
  onProgress?: (progressPercent: number) => void
): Promise<CloudinaryUploadResult> => {
  const mime = (file.type || '').toLowerCase();
  const name = (file.name || '').toLowerCase();
  const isVideoOrAudio =
    resourceType === 'video' ||
    resourceType === 'audio' ||
    mime.startsWith('video/') ||
    mime.startsWith('audio/') ||
    /\.(mp4|webm|mov|m4v|mkv|mp3|wav|m4a|ogg|aac|flac)$/.test(name);
  const isPdf =
    resourceType === 'pdf' ||
    mime === 'application/pdf' ||
    name.endsWith('.pdf');

  const targetResourceType = isVideoOrAudio ? 'video' : isPdf ? 'pdf' : 'image';

  try {
    if (onProgress) onProgress(10);

    const tgRes = await uploadToTelegramStorage(file, {
      fileName: file.name,
      caption: `NSTA ${targetResourceType.toUpperCase()}: ${file.name}`,
      onProgress: (pct) => {
        if (onProgress) onProgress(pct);
      },
    });

    const format = file.name.split('.').pop()?.toLowerCase() || 'bin';

    return {
      url: tgRes.url,
      secure_url: tgRes.url,
      public_id: tgRes.fileId,
      format,
      resource_type: targetResourceType,
      bytes: tgRes.fileSize || file.size,
    };
  } catch (err: any) {
    console.error('[Media Upload via Telegram] Upload failed:', err);
    let errMsg = err?.message || 'Media upload fail ho gaya';
    if (
      errMsg.includes('Unexpected end of JSON') ||
      errMsg.includes('Failed to execute') ||
      errMsg.includes('SyntaxError')
    ) {
      errMsg = 'Storage server se response nahi mila. Kripya apna internet connection check karein ya chhota video upload karein.';
    }
    throw new Error(errMsg);
  }
};

/**
 * Generates safe, optimized streaming URL.
 * Automatically resolves Telegram URLs to prevent CORS blocks and enable Range seeking.
 */
export const getOptimizedVideoUrl = (rawUrl: string): string => {
  if (!rawUrl) return '';
  return resolveTelegramUrl(rawUrl);
};
