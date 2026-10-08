/**
 * Video Quality Resolution Engine
 * Handles dynamic resolution switching (360p, 480p, 720p HD, 1080p Ultra VIP 4K)
 * Transforms Cloudinary URLs on-the-fly and manages tier lock rules.
 */

export type VideoQualityLevel = 'Auto' | '360p' | '480p' | '720p' | '1080p';

export interface QualityOption {
  quality: VideoQualityLevel;
  label: string;
  description: string;
  url: string;
  isLocked: boolean;
  requiredTier: 'FREE' | 'BASIC' | 'ULTRA';
}

/**
 * Returns dynamic transformed URL for Cloudinary videos
 */
export function getQualityTransformedUrl(originalUrl: string, quality: VideoQualityLevel): string {
  if (!originalUrl) return '';
  if (quality === 'Auto') return originalUrl;
  if (!originalUrl.includes('cloudinary.com') || !originalUrl.includes('/upload/')) {
    // Return original url as-is for non-Cloudinary videos
    return originalUrl;
  }

  // Cloudinary URL transformation mapping
  const qualityTransformations: Record<Exclude<VideoQualityLevel, 'Auto'>, string> = {
    '360p': 'q_auto:eco,w_640,h_360,c_limit,f_auto',
    '480p': 'q_auto:good,w_854,h_480,c_limit,f_auto',
    '720p': 'q_auto:good,w_1280,h_720,c_limit,f_auto',
    '1080p': 'q_auto:best,w_1920,h_1080,c_limit,f_auto',
  };

  const transform = qualityTransformations[quality];
  // Replace '/upload/' with '/upload/<transform>/'
  // Remove existing transformations if already present
  const cleanedUrl = originalUrl.replace(/\/upload\/(?:[a-zA-Z0-9_:,]+(?:\/)?)*\//, '/upload/');
  return cleanedUrl.replace('/upload/', `/upload/${transform}/`);
}

/**
 * Returns all available quality choices for a video, marking locked options based on user tier
 */
export function getAvailableQualitiesForUser(
  rawUrl: string,
  userTier: string = 'FREE',
  isAdmin: boolean = false,
  isFirstLesson: boolean = false
): QualityOption[] {
  const tier = (userTier || 'FREE').toUpperCase();
  const isUltra = isAdmin || tier === 'ULTRA' || isFirstLesson;
  const isBasic = isAdmin || isUltra || tier === 'BASIC' || isFirstLesson;

  return [
    {
      quality: '360p',
      label: '360p',
      description: 'Data Saver (Kam Internet)',
      url: getQualityTransformedUrl(rawUrl, '360p'),
      isLocked: false,
      requiredTier: 'FREE',
    },
    {
      quality: '480p',
      label: '480p',
      description: 'Standard Quality',
      url: getQualityTransformedUrl(rawUrl, '480p'),
      isLocked: false,
      requiredTier: 'FREE',
    },
    {
      quality: '720p',
      label: '720p HD',
      description: isFirstLesson ? '🎁 Lesson 1 Special: HD Unlocked' : 'High Definition',
      url: getQualityTransformedUrl(rawUrl, '720p'),
      isLocked: !isBasic,
      requiredTier: 'BASIC',
    },
    {
      quality: '1080p',
      label: isFirstLesson ? '1080p / 4K 🎁 (Lesson 1 Free)' : '1080p / 4K 👑',
      description: isFirstLesson ? '🎁 Lesson 1 Special: 1080p Unlocked' : 'Ultra Crystal Clear VIP',
      url: getQualityTransformedUrl(rawUrl, '1080p'),
      isLocked: !isUltra,
      requiredTier: 'ULTRA',
    },
  ];
}
