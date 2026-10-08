import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Download,
  CheckCircle,
  Crown,
  Lock,
  ArrowLeft,
  Settings,
  MoreVertical,
  Check,
  Repeat,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { PlayerWatermark } from './PlayerWatermark';
import {
  downloadAndSaveOfflineMedia,
  isMediaOffline,
  getOfflineMediaObjectUrl,
  validateOfflinePlaybackAccess,
} from '../services/offlineStorageService';
import {
  VideoQualityLevel,
  getAvailableQualitiesForUser,
  getQualityTransformedUrl,
} from '../utils/mediaQuality';
import { getOptimizedVideoUrl } from '../services/cloudinaryService';
import { rotateScreen } from '../utils/displayPrefs';

interface ModernVideoPlayerProps {
  videoUrl: string;
  title?: string;
  mediaId?: string;
  subject?: string;
  appLogo?: string;
  appName?: string;
  user?: any;
  isAdmin?: boolean;
  onBack?: () => void;
  onNext?: () => void;
  onUpgradeRequired?: (feature: string) => void;
  onFullscreenChange?: (isFullscreen: boolean) => void;
  autoPlay?: boolean;
  isOfflinePlayback?: boolean;
  isFirstLesson?: boolean;
}

export const ModernVideoPlayer: React.FC<ModernVideoPlayerProps> = ({
  videoUrl,
  title = 'Video Lecture',
  mediaId,
  subject,
  appLogo,
  appName = 'IIC',
  user,
  isAdmin = false,
  onBack,
  onNext,
  onUpgradeRequired,
  onFullscreenChange,
  autoPlay = false,
  isOfflinePlayback = false,
  isFirstLesson = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isTopBarHidden, setIsTopBarHidden] = useState(false);
  const [isRotated, setIsRotated] = useState(false);
  const [currentPlayUrl, setCurrentPlayUrl] = useState('');
  const [selectedQuality, setSelectedQuality] = useState<VideoQualityLevel>('Auto');
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isLooping, setIsLooping] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  // Double-tap / Multi-tap gesture state (Left: -10s, Center: Play/Pause, Right: +10s)
  const tapStateRef = useRef<{
    zone: 'left' | 'center' | 'right' | null;
    count: number;
    lastTapTime: number;
    accumulatedSec: number;
    resetTimer: ReturnType<typeof setTimeout> | null;
  }>({
    zone: null,
    count: 0,
    lastTapTime: 0,
    accumulatedSec: 0,
    resetTimer: null,
  });

  const [tapFeedback, setTapFeedback] = useState<{
    zone: 'left' | 'center' | 'right';
    text?: string;
    action?: 'play' | 'pause';
    key: number;
  } | null>(null);

  useEffect(() => {
    return () => {
      if (tapStateRef.current.resetTimer) {
        clearTimeout(tapStateRef.current.resetTimer);
      }
    };
  }, []);

  // Download state
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  // Access control
  const [accessBlocked, setAccessBlocked] = useState(false);
  const [blockedReason, setBlockedReason] = useState<string | null>(null);

  const userTier = (user?.subscriptionTier || user?.subscriptionLevel || 'FREE').toUpperCase();
  const isUltraUser = isAdmin || userTier === 'ULTRA';
  const itemId = mediaId || `vid_${encodeURIComponent(videoUrl).slice(0, 32)}`;

  // Helper to extract YouTube video ID
  const getYouTubeId = (url: string) => {
    const match = url.match(
      /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/
    );
    return match ? match[1] : null;
  };

  // Helper to extract Google Drive file ID
  const getDriveId = (url: string) => {
    const match = url.match(/\/d\/(.*?)\/|\/d\/(.*?)$|id=(.*?)(&|$)/);
    return match ? match[1] || match[2] || match[3] : null;
  };

  const isYouTube = videoUrl ? (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) : false;
  const isDrive = videoUrl ? (videoUrl.includes('drive.google.com') && !videoUrl.includes('export=download')) : false;
  const ytId = isYouTube ? getYouTubeId(videoUrl) : null;
  const driveId = isDrive ? getDriveId(videoUrl) : null;

  // Lesson 1 Special: Full High Quality (HD/1080p) unlocked for all users
  const isFirstLessonSpecial = Boolean(
    isFirstLesson ||
    /lesson[\s_-]*0?1\b/i.test(title || '') ||
    /chapter[\s_-]*0?1\b/i.test(title || '') ||
    /भाग[\s_-]*0?1\b/i.test(title || '') ||
    /पाठ[\s_-]*0?1\b/i.test(title || '') ||
    /अध्याय[\s_-]*0?1\b/i.test(title || '')
  );

  // Initialize playback URL and check offline status
  useEffect(() => {
    let active = true;
    (async () => {
      const offline = await isMediaOffline(itemId);
      if (active) setIsDownloaded(offline);

      if (offline || isOfflinePlayback) {
        const res = await getOfflineMediaObjectUrl(itemId);
        if (res && active) {
          const validation = validateOfflinePlaybackAccess(res.record, user);
          if (!validation.allowed) {
            setAccessBlocked(true);
            setBlockedReason(
              validation.reason === 'EXPIRED'
                ? 'Aapka Ultra Plan expire ho chuka hai! Offline video dekhne ke liye renew karein.'
                : 'Ye offline video Ultra VIP members ke liye exclusive hai.'
            );
            return;
          }
          setCurrentPlayUrl(res.url);
          return;
        }
      }

      if (active) {
        setCurrentPlayUrl(getOptimizedVideoUrl(videoUrl));
        setVideoError(null);
      }
    })();

    return () => {
      active = false;
    };
  }, [itemId, isOfflinePlayback, user, videoUrl]);

  // Fullscreen state synchronization with document and body class
  const toggleFullscreen = useCallback(() => {
    const nextState = !isFullscreen;
    setIsFullscreen(nextState);
    onFullscreenChange?.(nextState);

    if (nextState) {
      document.body.classList.add('nsta-video-fullscreen-active');
      document.documentElement.classList.add('nsta-video-fullscreen-active');
    } else {
      document.body.classList.remove('nsta-video-fullscreen-active');
      document.documentElement.classList.remove('nsta-video-fullscreen-active');
    }

    try {
      window.dispatchEvent(
        new CustomEvent('nsta-video-fullscreen', { detail: { isFullscreen: nextState } })
      );
    } catch {}

    try {
      if (nextState) {
        if (!document.fullscreenElement && containerRef.current?.requestFullscreen) {
          containerRef.current.requestFullscreen().catch(() => {});
        }
      } else {
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
      }
    } catch {}
  }, [isFullscreen, onFullscreenChange]);

  useEffect(() => {
    const handleFsChange = () => {
      const isFs = !!document.fullscreenElement;
      setIsFullscreen(isFs);
      onFullscreenChange?.(isFs);
      if (isFs) {
        document.body.classList.add('nsta-video-fullscreen-active');
        document.documentElement.classList.add('nsta-video-fullscreen-active');
      } else {
        document.body.classList.remove('nsta-video-fullscreen-active');
        document.documentElement.classList.remove('nsta-video-fullscreen-active');
      }
      try {
        window.dispatchEvent(
          new CustomEvent('nsta-video-fullscreen', { detail: { isFullscreen: isFs } })
        );
      } catch {}
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
      document.body.classList.remove('nsta-video-fullscreen-active');
      document.documentElement.classList.remove('nsta-video-fullscreen-active');
      try {
        window.dispatchEvent(
          new CustomEvent('nsta-video-fullscreen', { detail: { isFullscreen: false } })
        );
      } catch {}
    };
  }, [onFullscreenChange]);

  // Screen orientation auto-detection (landscape vs portrait)
  useEffect(() => {
    const handleOrientation = () => {
      const isLandscape =
        window.matchMedia('(orientation: landscape)').matches ||
        (typeof screen !== 'undefined' &&
          ((screen as any).orientation?.type?.includes('landscape') ||
            (screen as any).orientation?.angle === 90 ||
            (screen as any).orientation?.angle === 270));
      setIsRotated(!!isLandscape);
    };
    handleOrientation();
    window.addEventListener('resize', handleOrientation);
    window.addEventListener('orientationchange', handleOrientation);
    return () => {
      window.removeEventListener('resize', handleOrientation);
      window.removeEventListener('orientationchange', handleOrientation);
    };
  }, []);

  // Screen rotate toggle (landscape / portrait)
  const toggleRotate = useCallback(async () => {
    const nextRot = !isRotated;
    setIsRotated(nextRot);
    // When rotating to landscape, hide top bar for an immersive rotated experience
    if (nextRot) {
      setIsTopBarHidden(true);
      try {
        window.dispatchEvent(
          new CustomEvent('nsta-video-topbar-change', { detail: { isTopBarHidden: true } })
        );
      } catch {}
    } else {
      setIsTopBarHidden(false);
      try {
        window.dispatchEvent(
          new CustomEvent('nsta-video-topbar-change', { detail: { isTopBarHidden: false } })
        );
      } catch {}
    }

    try {
      const so: any = (screen as any).orientation;
      if (so && typeof so.lock === 'function') {
        if (nextRot) {
          if (!document.fullscreenElement && containerRef.current?.requestFullscreen) {
            await containerRef.current.requestFullscreen().catch(() => {});
          }
          await so.lock('landscape').catch(() => {});
        } else {
          await so.unlock?.().catch(() => {});
          if (document.fullscreenElement && document.exitFullscreen) {
            await document.exitFullscreen().catch(() => {});
          }
        }
      } else {
        await rotateScreen();
      }
    } catch {}
  }, [isRotated]);

  // NSTA logo tap: toggles top bar visibility (hide / show)
  const handleNstaLogoClick = useCallback(() => {
    setShowSettingsMenu(false);
    setIsTopBarHidden((prev) => {
      const next = !prev;
      try {
        window.dispatchEvent(
          new CustomEvent('nsta-video-topbar-change', { detail: { isTopBarHidden: next } })
        );
      } catch {}
      return next;
    });
  }, []);

  // Fullscreen button tap: toggles fullscreen AND hides top bar for immersive view
  const handleFullscreenClick = useCallback(() => {
    if (!isFullscreen) {
      setIsTopBarHidden(true);
      try {
        window.dispatchEvent(
          new CustomEvent('nsta-video-topbar-change', { detail: { isTopBarHidden: true } })
        );
      } catch {}
    } else {
      setIsTopBarHidden(false);
      try {
        window.dispatchEvent(
          new CustomEvent('nsta-video-topbar-change', { detail: { isTopBarHidden: false } })
        );
      } catch {}
    }
    toggleFullscreen();
  }, [isFullscreen, toggleFullscreen]);

  const handleSpeedChange = (speed: number) => {
    setPlaybackRate(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  };

  const handleLoopToggle = () => {
    const nextLoop = !isLooping;
    setIsLooping(nextLoop);
    if (videoRef.current) {
      videoRef.current.loop = nextLoop;
    }
  };

  const handleQualitySelect = (q: VideoQualityLevel, isLocked: boolean) => {
    if (isLocked) {
      setShowSettingsMenu(false);
      if (onUpgradeRequired) {
        onUpgradeRequired('1080p / 4K Ultra VIP Quality');
      } else {
        alert('👑 1080p & 4K streaming Ultra VIP members ke liye exclusive hai!');
      }
      return;
    }
    setSelectedQuality(q);
    setShowSettingsMenu(false);

    // Apply quality only when explicitly selected
    const transformed = getQualityTransformedUrl(videoUrl, q);
    if (transformed && videoRef.current) {
      const prevTime = videoRef.current.currentTime || 0;
      const wasPlaying = !videoRef.current.paused;
      setCurrentPlayUrl(transformed);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.currentTime = prevTime;
          if (wasPlaying) {
            videoRef.current.play().catch(() => {});
          }
        }
      }, 100);
    }
  };

  const handleDownload = async () => {
    if (isYouTube) {
      alert('ℹ️ YouTube Video Offline Info:\n\nYouTube platform policies ke anusaar YouTube video lectures raw file ke roop me download nahi ho sakte. Ye video app me online direct high-speed stream hoti hai.\n\nApp ke sabhi Direct MP4 aur Cloudinary study lectures ko Ultra VIP plan me bina internet ke offline download kiya ja sakta hai!');
      return;
    }

    if (!isUltraUser) {
      if (onUpgradeRequired) {
        onUpgradeRequired('Offline Video Downloads');
      } else {
        alert('👑 Video In-App Offline Download sirf Ultra VIP members ke liye uplabdh hai! Kripya Ultra VIP plan activate karein.');
      }
      return;
    }

    if (isDownloaded) {
      alert('✅ Ye video pehle se hi app ke andar offline download hai! Aap ise kabhi bhi bina internet ke chala sakte hain.');
      return;
    }

    // Prioritize currently active playable stream URL if available, fallback to videoUrl
    const effectiveUrl = (currentPlayUrl && !currentPlayUrl.startsWith('blob:') && currentPlayUrl.length > 5)
      ? currentPlayUrl
      : videoUrl;

    if (!effectiveUrl) {
      alert('Video download karne ke liye valid video URL uplabdh nahi hai.');
      return;
    }

    try {
      setIsDownloading(true);
      setDownloadProgress(5);

      await downloadAndSaveOfflineMedia(
        {
          id: itemId,
          title: title || 'Video Lecture',
          subject: subject || 'General',
          kind: 'video',
          originalUrl: effectiveUrl,
          mimeType: 'video/mp4',
          requiredTier: 'ULTRA',
          subscriptionExpiry: user?.subscriptionExpiresAt || null,
        },
        (pct) => setDownloadProgress(pct)
      );

      setIsDownloaded(true);
      setIsDownloading(false);
      setDownloadProgress(100);
      alert('✅ Video offline download ho gaya! Ab aap ise bina internet ke "Offline Downloads" section mein kabhi bhi dekh sakte hain.');
    } catch (err: any) {
      console.error('Download error:', err);
      setIsDownloading(false);
      const detail = err?.message ? `\n\nKaran: ${err.message}` : '';
      alert(`Video in-app offline download nahi ho paya.${detail}\n\nKripya apna internet connection check karein ya thodi der baad dobara koshish karein.`);
    }
  };

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const togglePlayPause = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  // Screen Tap Gesture Handler:
  // - Center 2 taps: Play / Pause toggle
  // - Right 2 taps: +10s forward (+10s more on each additional tap: 2 taps = +10s, 3 taps = +20s, etc.)
  // - Left 2 taps: -10s rewind (-10s more on each additional tap: 2 taps = -10s, 3 taps = -20s, etc.)
  const handleVideoScreenTap = (e: React.MouseEvent<HTMLDivElement>) => {
    if (showSettingsMenu) {
      setShowSettingsMenu(false);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width || 1;
    const ratio = clickX / width;

    const zone: 'left' | 'center' | 'right' =
      ratio < 0.35 ? 'left' : ratio > 0.65 ? 'right' : 'center';

    const now = Date.now();
    const state = tapStateRef.current;
    const maxGap = state.count >= 2 && state.zone === zone && zone !== 'center' ? 650 : 400;
    const isSameStreak = state.zone === zone && now - state.lastTapTime <= maxGap;

    if (!isSameStreak) {
      if (state.resetTimer) clearTimeout(state.resetTimer);
      state.zone = zone;
      state.count = 1;
      state.lastTapTime = now;
      state.accumulatedSec = 0;
      state.resetTimer = setTimeout(() => {
        state.zone = null;
        state.count = 0;
        state.accumulatedSec = 0;
      }, 450);
      return;
    }

    state.count += 1;
    state.lastTapTime = now;
    if (state.resetTimer) clearTimeout(state.resetTimer);

    if (zone === 'center') {
      if (!videoRef.current) return;
      const willPlay = videoRef.current.paused;
      if (willPlay) {
        videoRef.current.play().catch(() => {});
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
      setTapFeedback({
        zone: 'center',
        action: willPlay ? 'play' : 'pause',
        key: now,
      });
      state.zone = null;
      state.count = 0;
      state.accumulatedSec = 0;
      state.resetTimer = setTimeout(() => {
        setTapFeedback(null);
      }, 650);
      return;
    }

    // Left (-10s) or Right (+10s) — 2nd tap = 10s, 3rd tap = 20s, 4th tap = 30s, etc.
    state.accumulatedSec += 10;
    if (videoRef.current) {
      if (zone === 'right') {
        const maxDur =
          videoRef.current.duration && !isNaN(videoRef.current.duration)
            ? videoRef.current.duration
            : duration;
        videoRef.current.currentTime =
          maxDur > 0
            ? Math.min(maxDur, videoRef.current.currentTime + 10)
            : videoRef.current.currentTime + 10;
      } else {
        videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
      }
      setCurrentTime(videoRef.current.currentTime);
    }

    setTapFeedback({
      zone,
      text: zone === 'right' ? `+${state.accumulatedSec}s` : `-${state.accumulatedSec}s`,
      key: now,
    });

    state.resetTimer = setTimeout(() => {
      state.zone = null;
      state.count = 0;
      state.accumulatedSec = 0;
      setTapFeedback(null);
    }, 700);
  };

  // If playback access is blocked due to expired subscription
  if (accessBlocked) {
    return (
      <div className="w-full aspect-video min-h-[300px] bg-slate-950 rounded-2xl flex flex-col items-center justify-center p-6 text-center text-white border border-rose-900/50 shadow-2xl relative overflow-hidden">
        <PlayerWatermark appLogo={appLogo} appName={appName} />
        <div className="w-16 h-16 rounded-full bg-rose-600/20 border border-rose-500/40 flex items-center justify-center mb-4">
          <Lock size={32} className="text-rose-400" />
        </div>
        <h3 className="text-lg font-black text-white mb-2">Offline Playback Locked</h3>
        <p className="text-xs text-rose-200/80 max-w-sm mb-5 leading-relaxed">{blockedReason}</p>
        <button
          onClick={() => onUpgradeRequired?.('Renew Ultra Subscription')}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-rose-600 font-bold text-xs shadow-lg active:scale-95 transition flex items-center gap-2"
        >
          <Crown size={15} /> Ultra Plan Renew Karein
        </button>
      </div>
    );
  }

  const containerClass = `group/player ${
    isFullscreen
      ? 'fixed inset-0 z-[99999] w-screen h-screen max-w-none max-h-none rounded-none'
      : 'relative w-full aspect-video min-h-[220px] sm:min-h-[300px] rounded-2xl shadow-2xl'
  } bg-black overflow-hidden select-none flex flex-col justify-between`;

  // ── YOUTUBE PLAYER EMBED ──
  if (isYouTube && ytId) {
    const ytEmbedUrl = `https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&controls=1&modestbranding=1&rel=0&playsinline=1&enablejsapi=1`;
    return (
      <div
        ref={containerRef}
        className={containerClass}
        style={{ backgroundColor: '#000000' }}
      >
        <PlayerWatermark
          appLogo={appLogo}
          appName={appName}
          position="bottom-right"
          onClick={handleNstaLogoClick}
          isFullscreen={isFullscreen}
          isTopBarHidden={isTopBarHidden}
        />

        {/* Top Bar Header Overlay */}
        <div
          className={`absolute top-0 left-0 right-0 p-3 flex items-center justify-between bg-gradient-to-b from-black/90 via-black/50 to-transparent z-20 transition-all duration-300 ${
            isTopBarHidden
              ? '-translate-y-full opacity-0 pointer-events-none'
              : 'translate-y-0 opacity-100 pointer-events-auto'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0 pr-4">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition active:scale-90"
                title="Go Back"
              >
                <ArrowLeft size={16} />
              </button>
            )}

            <div className="min-w-0">
              <h4 className="text-xs font-bold text-white truncate drop-shadow">{title}</h4>
              {subject && <p className="text-[10px] text-slate-300 font-semibold uppercase">{subject}</p>}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={toggleRotate}
              className={`p-1.5 rounded-lg transition active:scale-90 ${
                isRotated ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
              title={isRotated ? 'Rotate Portrait' : 'Rotate Landscape (Screen Ghumayein)'}
            >
              <RotateCw size={14} className={isRotated ? 'rotate-90 transition-transform' : ''} />
            </button>
          </div>
        </div>

        {/* Embedded YouTube Iframe */}
        <iframe
          src={ytEmbedUrl}
          className="w-full h-full border-0 flex-1 bg-black"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          title={title}
        />
      </div>
    );
  }

  // ── GOOGLE DRIVE VIDEO PLAYER EMBED ──
  if (isDrive && driveId) {
    const drivePreviewUrl = `https://drive.google.com/file/d/${driveId}/preview`;
    return (
      <div
        ref={containerRef}
        className={containerClass}
        style={{ backgroundColor: '#000000' }}
      >
        <PlayerWatermark
          appLogo={appLogo}
          appName={appName}
          position="bottom-right"
          onClick={handleNstaLogoClick}
          isFullscreen={isFullscreen}
          isTopBarHidden={isTopBarHidden}
        />

        {/* Top Bar Header Overlay */}
        <div
          className={`absolute top-0 left-0 right-0 p-3 flex items-center justify-between bg-gradient-to-b from-black/90 via-black/50 to-transparent z-20 transition-all duration-300 ${
            isTopBarHidden
              ? '-translate-y-full opacity-0 pointer-events-none'
              : 'translate-y-0 opacity-100 pointer-events-auto'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0 pr-4">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition active:scale-90"
                title="Go Back"
              >
                <ArrowLeft size={16} />
              </button>
            )}

            <div className="min-w-0">
              <h4 className="text-xs font-bold text-white truncate drop-shadow">{title}</h4>
              {subject && <p className="text-[10px] text-slate-300 font-semibold uppercase">{subject}</p>}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={toggleRotate}
              className={`p-1.5 rounded-lg transition active:scale-90 ${
                isRotated ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
              title={isRotated ? 'Rotate Portrait' : 'Rotate Landscape (Screen Ghumayein)'}
            >
              <RotateCw size={14} className={isRotated ? 'rotate-90 transition-transform' : ''} />
            </button>
          </div>
        </div>

        <iframe
          src={drivePreviewUrl}
          className="w-full h-full border-0 flex-1 bg-black"
          allow="autoplay"
          title={title}
        />
      </div>
    );
  }

  // ── DIRECT VIDEO STREAM (HTML5 / CLOUDINARY / MP4) ──
  const availableQualities = getAvailableQualitiesForUser(videoUrl || '', userTier, isAdmin, isFirstLessonSpecial);

  const handleVideoError = () => {
    console.warn('[ModernVideoPlayer] Video load error for URL:', currentPlayUrl);
    if (currentPlayUrl !== videoUrl && videoUrl) {
      setCurrentPlayUrl(videoUrl);
      return;
    }
    setVideoError('Video stream load nahi ho payi. Internet connection ya video format check karein.');
  };

  const playerNode = (
    <div
      ref={containerRef}
      className={containerClass}
      style={{ backgroundColor: '#000000' }}
      onClick={() => {
        if (showSettingsMenu) setShowSettingsMenu(false);
      }}
    >
      {/* ── Top Bar Header Overlay (With Rotate & 3-Dot Options Button) ── */}
      <div
        className={`absolute top-0 left-0 right-0 p-3 flex items-center justify-between bg-gradient-to-b from-black/90 via-black/50 to-transparent z-30 transition-all duration-300 ${
          isTopBarHidden
            ? '-translate-y-full opacity-0 pointer-events-none'
            : 'translate-y-0 opacity-100 pointer-events-auto'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 pr-4">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition active:scale-90"
              title="Go Back"
            >
              <ArrowLeft size={16} />
            </button>
          )}

          <div className="min-w-0">
            <h4 className="text-xs font-bold text-white truncate drop-shadow">{title}</h4>
            {subject && <p className="text-[10px] text-slate-300 font-semibold uppercase">{subject}</p>}
          </div>
        </div>

        {/* Top Right: Rotate & 3-Dot Options Menu */}
        <div className="flex items-center gap-1.5 relative">
          <button
            type="button"
            onClick={toggleRotate}
            className={`p-1.5 rounded-lg transition active:scale-90 ${
              isRotated ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
            title={isRotated ? 'Rotate Portrait' : 'Rotate Landscape (Screen Ghumayein)'}
          >
            <RotateCw size={14} className={isRotated ? 'rotate-90 transition-transform' : ''} />
          </button>

          {/* 3-Dot Options Button in Top Bar */}
          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowSettingsMenu((v) => !v);
              }}
              className={`p-1.5 rounded-lg transition active:scale-90 flex items-center justify-center cursor-pointer ${
                showSettingsMenu
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
              title="Options (Quality Change, Speed, Loop, Save)"
              aria-label="Video Options"
            >
              <MoreVertical size={16} />
            </button>

            {/* 3-Dot Settings & Quality Dropdown Popup (Opens Downward From Top Bar) */}
            {showSettingsMenu && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 top-full mt-2 w-60 max-h-[70vh] overflow-y-auto bg-slate-900/98 backdrop-blur-xl border border-slate-700/80 rounded-2xl p-3 shadow-2xl text-white z-50 animate-in fade-in zoom-in-95 space-y-3"
              >
                {/* Quality Change Section */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Quality / Resolution
                    </p>
                    <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                      {selectedQuality}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {availableQualities.map((q) => (
                      <button
                        key={q.quality}
                        onClick={() => handleQualitySelect(q.quality, q.isLocked)}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-left text-xs transition active:scale-95 ${
                          selectedQuality === q.quality
                            ? 'bg-indigo-600 text-white font-bold shadow'
                            : 'hover:bg-slate-800 text-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {selectedQuality === q.quality && (
                            <Check size={12} className="text-white shrink-0" />
                          )}
                          <span>{q.label}</span>
                        </div>
                        {q.isLocked && <Lock size={12} className="text-amber-400 shrink-0" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Playback Speed Section */}
                <div className="pt-2 border-t border-slate-800">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                    Playback Speed
                  </p>
                  <div className="grid grid-cols-4 gap-1">
                    {[0.75, 1, 1.25, 1.5].map((speed) => (
                      <button
                        key={speed}
                        onClick={() => handleSpeedChange(speed)}
                        className={`py-1 rounded-lg text-center text-xs font-bold transition active:scale-90 ${
                          playbackRate === speed
                            ? 'bg-indigo-600 text-white shadow'
                            : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300'
                        }`}
                      >
                        {speed}x
                      </button>
                    ))}
                  </div>
                </div>

                {/* Loop Video Option */}
                <div className="pt-2 border-t border-slate-800">
                  <button
                    onClick={handleLoopToggle}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold transition active:scale-95 ${
                      isLooping
                        ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40'
                        : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Repeat size={13} className={isLooping ? 'text-indigo-400' : 'text-slate-400'} />
                      <span>Loop Video</span>
                    </div>
                    <span className="text-[10px] uppercase font-black">{isLooping ? 'ON' : 'OFF'}</span>
                  </button>
                </div>

                {/* Offline Save inside App Option */}
                <div className="pt-2 border-t border-slate-800">
                  {isDownloaded ? (
                    <div className="flex items-center justify-between px-2.5 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle size={13} /> App Me Saved Hai
                      </span>
                      <span className="text-[9px] uppercase font-black bg-emerald-500/20 px-1.5 py-0.5 rounded">
                        Offline
                      </span>
                    </div>
                  ) : isDownloading ? (
                    <div className="flex items-center justify-between px-2.5 py-2 rounded-xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-200 text-xs font-bold animate-pulse">
                      <span className="flex items-center gap-1.5">
                        <Download size={13} className="animate-bounce" /> Downloading...
                      </span>
                      <span className="text-[10px] font-black">{downloadProgress}%</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setShowSettingsMenu(false);
                        handleDownload();
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold transition active:scale-95 shadow ${
                        isUltraUser
                          ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:brightness-110'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        {isUltraUser ? <Download size={13} /> : <Crown size={13} />}
                        <span>Save Inside App</span>
                      </span>
                      <span className="text-[9px] uppercase font-black px-1.5 py-0.5 rounded bg-black/30">
                        {isUltraUser ? 'Offline' : 'Ultra'}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Video Element & Multi-Tap Gesture Surface ── */}
      <div
        className="w-full h-full flex-1 relative flex items-center justify-center bg-black pt-8 pb-12 cursor-pointer select-none"
        onClick={handleVideoScreenTap}
        onDoubleClick={(e) => e.preventDefault()}
      >
        {videoUrl ? (
          <>
            <video
              ref={videoRef}
              src={currentPlayUrl}
              playsInline
              preload="metadata"
              autoPlay={autoPlay}
              onDoubleClick={(e) => e.preventDefault()}
              className="w-full h-full max-h-full object-contain bg-black pointer-events-none"
              onError={handleVideoError}
              onTimeUpdate={() => {
                if (videoRef.current) {
                  setCurrentTime(videoRef.current.currentTime);
                  if (videoRef.current.duration && !isNaN(videoRef.current.duration)) {
                    setDuration(videoRef.current.duration);
                  }
                }
              }}
              onLoadedMetadata={() => {
                if (videoRef.current && videoRef.current.duration) {
                  setDuration(videoRef.current.duration);
                }
              }}
              onPlay={() => {
                setIsPlaying(true);
                setVideoError(null);
              }}
              onPause={() => setIsPlaying(false)}
              onEnded={() => {
                setIsPlaying(false);
                if (onNext) onNext();
              }}
            />

            {/* Left Rewind Visual Feedback (-10s, -20s, ...) */}
            {tapFeedback && tapFeedback.zone === 'left' && (
              <div
                key={tapFeedback.key}
                className="pointer-events-none absolute left-6 top-1/2 -translate-y-1/2 flex flex-col items-center justify-center bg-black/70 backdrop-blur-md text-white px-5 py-3.5 rounded-full border border-white/15 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
              >
                <RotateCcw size={24} className="text-indigo-400 mb-1" />
                <span className="text-xs font-black tracking-wide">{tapFeedback.text}</span>
              </div>
            )}

            {/* Center Play/Pause Visual Feedback */}
            {tapFeedback && tapFeedback.zone === 'center' && (
              <div
                key={tapFeedback.key}
                className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center w-16 h-16 bg-black/70 backdrop-blur-md text-white rounded-full border border-white/15 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
              >
                {tapFeedback.action === 'play' ? (
                  <Play size={28} className="text-white ml-1" fill="currentColor" />
                ) : (
                  <Pause size={28} className="text-white" fill="currentColor" />
                )}
              </div>
            )}

            {/* Right Forward Visual Feedback (+10s, +20s, ...) */}
            {tapFeedback && tapFeedback.zone === 'right' && (
              <div
                key={tapFeedback.key}
                className="pointer-events-none absolute right-6 top-1/2 -translate-y-1/2 flex flex-col items-center justify-center bg-black/70 backdrop-blur-md text-white px-5 py-3.5 rounded-full border border-white/15 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
              >
                <RotateCw size={24} className="text-indigo-400 mb-1" />
                <span className="text-xs font-black tracking-wide">{tapFeedback.text}</span>
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 bg-slate-950 p-6 text-center">
            <AlertTriangle size={36} className="text-amber-500 mb-2 opacity-80" />
            <p className="text-sm font-bold text-white">Video Available Nahi Hai</p>
            <p className="text-xs text-slate-500 mt-1">Admin ne is lesson ke liye video link add nahi kiya hai.</p>
          </div>
        )}
      </div>

      {/* ── BOTTOM CONTROLS BAR (NSTA Logo Button in place of 3-Dot Button; stays here even on rotate) ── */}
      <div className="absolute bottom-0 left-0 right-0 px-3 pb-2 pt-6 bg-gradient-to-t from-black/95 via-black/60 to-transparent z-20 pointer-events-auto">
        {/* Progress Scrubber */}
        <div
          className="h-1.5 bg-slate-700/80 hover:h-2.5 rounded-full w-full cursor-pointer transition-all duration-150 mb-2 relative group"
          onClick={(e) => {
            if (videoRef.current && duration > 0) {
              const rect = e.currentTarget.getBoundingClientRect();
              const percent = (e.clientX - rect.left) / rect.width;
              videoRef.current.currentTime = percent * duration;
            }
          }}
        >
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full relative"
            style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full shadow border border-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>

        {/* Bottom Controls Row */}
        <div className="flex items-center justify-between text-white text-xs">
          {/* Left Controls: Mute & Time */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                if (videoRef.current) {
                  videoRef.current.muted = !isMuted;
                  setIsMuted(!isMuted);
                }
              }}
              className="p-1 rounded-md text-slate-300 hover:text-white transition active:scale-90"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
            </button>

            <span className="text-[11px] font-mono text-slate-300 ml-1">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          {/* Right Controls: Quality Badge & NSTA Logo Button (replaces 3-Dot Button at bottom, stays here on rotate) */}
          <div className="flex items-center gap-2 relative">
            {/* Active Quality Badge */}
            <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-indigo-500/30 text-indigo-300 border border-indigo-500/40">
              {selectedQuality}
            </span>

            {/* NSTA Logo Button (Fixed in bottom bar where 3-dot button was; never moves to top on rotate) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleNstaLogoClick();
              }}
              title={
                isTopBarHidden
                  ? 'Top Bar Dikhayein (Tap to show top bar)'
                  : 'NSTA Logo • Tap karein to Top Bar hide/show hoga'
              }
              aria-label="Toggle Top Bar"
              className={`select-none flex items-center gap-1.5 px-2.5 py-1 rounded-full backdrop-blur-md transition-all duration-200 cursor-pointer hover:opacity-100 hover:scale-105 active:scale-95 shadow-lg ${
                isTopBarHidden ? 'ring-2 ring-indigo-400/60 shadow-indigo-500/30' : ''
              }`}
              style={{
                background: isTopBarHidden ? 'rgba(30, 27, 75, 0.92)' : 'rgba(15, 23, 42, 0.85)',
                border: isTopBarHidden
                  ? '1px solid rgba(165, 180, 252, 0.5)'
                  : '1px solid rgba(255, 255, 255, 0.25)',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.45)',
              }}
            >
              <img
                src={appLogo || '/branding/nsta-logo.png'}
                alt={appName || 'NSTA'}
                className="w-4 h-4 object-contain rounded-full shadow-sm shrink-0"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = 'none';
                }}
              />
              <span className="text-[10px] font-black tracking-wider text-white drop-shadow-md uppercase whitespace-nowrap">
                {appName || 'NSTA'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Video Error Overlay with Retry ── */}
      {videoError && (
        <div className="absolute inset-0 z-30 bg-slate-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center text-white">
          <AlertTriangle size={36} className="text-amber-400 mb-3" />
          <h4 className="text-sm font-bold text-white mb-1">Video Chalane Me Samasya Aayi</h4>
          <p className="text-xs text-slate-400 max-w-sm mb-4">{videoError}</p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setVideoError(null);
                setCurrentPlayUrl(videoUrl);
                if (videoRef.current) {
                  videoRef.current.load();
                  videoRef.current.play().catch(() => {});
                }
              }}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 active:scale-95 transition"
            >
              <RefreshCw size={13} /> Dobara Chalayein
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return playerNode;
};
