import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Download,
  CheckCircle,
  Crown,
  Lock,
  Headphones,
  ArrowLeft,
  Minimize2,
} from 'lucide-react';
import { PlayerWatermark } from './PlayerWatermark';
import {
  downloadAndSaveOfflineMedia,
  isMediaOffline,
  getOfflineMediaObjectUrl,
  validateOfflinePlaybackAccess,
} from '../services/offlineStorageService';
import { globalAudioService, GlobalAudioState } from '../services/globalAudioService';

interface ModernAudioPlayerProps {
  audioUrl: string;
  title?: string;
  subtitle?: string;
  mediaId?: string;
  appLogo?: string;
  appName?: string;
  user?: any;
  isAdmin?: boolean;
  onBack?: () => void;
  onUpgradeRequired?: (feature: string) => void;
  autoPlay?: boolean;
  isOfflinePlayback?: boolean;
}

export const ModernAudioPlayer: React.FC<ModernAudioPlayerProps> = ({
  audioUrl,
  title = 'Audio Lecture',
  subtitle,
  mediaId,
  appLogo = '/nsta-logo.png',
  appName = 'NSTA ACADEMY',
  user,
  isAdmin = false,
  onBack,
  onUpgradeRequired,
  autoPlay = false,
  isOfflinePlayback = false,
}) => {
  const [currentPlayUrl, setCurrentPlayUrl] = useState(audioUrl);
  const [globalState, setGlobalState] = useState<GlobalAudioState>(() => globalAudioService.getState());

  // Download state
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  // Expiry check
  const [accessBlocked, setAccessBlocked] = useState(false);
  const [blockedReason, setBlockedReason] = useState<string | null>(null);

  const userTier = (user?.subscriptionTier || user?.subscriptionLevel || 'FREE').toUpperCase();
  const canDownloadAudio = isAdmin || userTier === 'ULTRA';
  const itemId = mediaId || `aud_${encodeURIComponent(audioUrl).slice(0, 32)}`;

  // Subscribe to persistent audio service
  useEffect(() => {
    const unsub = globalAudioService.subscribe((state) => {
      setGlobalState(state);
    });
    return unsub;
  }, []);

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
                ? 'Aapka Ultra Plan expire ho chuka hai! Offline audio sunne ke liye renew karein.'
                : 'Ye audio lecture Ultra VIP members ke liye exclusive hai.'
            );
            return;
          }
          setCurrentPlayUrl(res.url);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [itemId, isOfflinePlayback, user]);

  // If autoPlay is requested or when track matches
  useEffect(() => {
    if (autoPlay && currentPlayUrl) {
      globalAudioService.playTrack(
        {
          url: currentPlayUrl,
          title,
          subtitle,
          mediaId: itemId,
          appLogo,
        },
        true
      );
    }
  }, [autoPlay, currentPlayUrl]);

  const isCurrentTrack = globalState.track?.url === currentPlayUrl;
  const isPlaying = isCurrentTrack && globalState.isPlaying;
  const currentTime = isCurrentTrack ? globalState.currentTime : 0;
  const duration = isCurrentTrack ? globalState.duration : 0;
  const playbackSpeed = globalState.playbackRate;
  const isMuted = globalState.isMuted;

  const togglePlay = () => {
    if (!isCurrentTrack) {
      globalAudioService.playTrack({
        url: currentPlayUrl,
        title,
        subtitle,
        mediaId: itemId,
        appLogo,
      });
    } else {
      globalAudioService.togglePlay();
    }
  };

  const skipTime = (seconds: number) => {
    if (isCurrentTrack) {
      globalAudioService.skip(seconds);
    }
  };

  const handleSpeedCycle = () => {
    const speeds = [1, 1.25, 1.5, 2, 0.75];
    const nextIdx = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
    globalAudioService.setPlaybackRate(speeds[nextIdx]);
  };

  const handleDownload = async () => {
    if (!canDownloadAudio) {
      if (onUpgradeRequired) {
        onUpgradeRequired('Offline Audio Downloads');
      } else {
        alert('👑 Audio Offline Download Ultra VIP members ke liye exclusive hai!');
      }
      return;
    }

    if (isDownloaded) return;

    try {
      setIsDownloading(true);
      setDownloadProgress(0);

      await downloadAndSaveOfflineMedia(
        {
          id: itemId,
          title,
          subject: subtitle,
          kind: 'audio',
          originalUrl: audioUrl,
          mimeType: 'audio/mpeg',
          requiredTier: 'ULTRA',
          subscriptionExpiry: user?.subscriptionExpiresAt || null,
        },
        (pct) => setDownloadProgress(pct)
      );

      setIsDownloaded(true);
      setIsDownloading(false);
    } catch (err) {
      console.error('Audio download error:', err);
      setIsDownloading(false);
    }
  };

  const formatTime = (timeInSec: number) => {
    if (!timeInSec || isNaN(timeInSec)) return '0:00';
    const min = Math.floor(timeInSec / 60);
    const sec = Math.floor(timeInSec % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  if (accessBlocked) {
    return (
      <div className="w-full bg-slate-950 rounded-2xl p-6 text-center text-white border border-rose-900/50 shadow-2xl relative overflow-hidden">
        <PlayerWatermark appLogo={appLogo} appName={appName} />
        <div className="w-14 h-14 rounded-full bg-rose-600/20 border border-rose-500/40 flex items-center justify-center mx-auto mb-3">
          <Lock size={28} className="text-rose-400" />
        </div>
        <h4 className="text-base font-black text-white mb-1.5">Offline Audio Locked</h4>
        <p className="text-xs text-rose-200/80 max-w-sm mx-auto mb-4">{blockedReason}</p>
        <button
          onClick={() => onUpgradeRequired?.('Renew Ultra Subscription')}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-rose-600 font-bold text-xs shadow-lg active:scale-95 transition inline-flex items-center gap-1.5"
        >
          <Crown size={14} /> Ultra Plan Renew Karein
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full rounded-2xl overflow-hidden bg-gradient-to-br from-indigo-950 via-slate-900 to-purple-950 border border-indigo-900/40 p-4 sm:p-5 shadow-2xl select-none">
      {/* ── Corner Official Logo Watermark ── */}
      <PlayerWatermark appLogo={appLogo} appName={appName} position="top-right" />

      {/* Header Row */}
      <div className="flex items-center justify-between gap-3 mb-4 pr-24">
        <div className="flex items-center gap-2.5 min-w-0">
          {onBack && (
            <button
              onClick={onBack}
              className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition active:scale-90 shrink-0"
              title="Mini player me rakhein aur app me ghoomein"
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center shrink-0">
            <Headphones size={20} className="text-indigo-300" />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-bold text-white truncate">{title}</h4>
            {subtitle && (
              <p className="text-[10px] text-indigo-300/80 font-semibold uppercase">{subtitle}</p>
            )}
          </div>
        </div>

        {/* Action Buttons: Background minimize + Offline Download */}
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              onClick={onBack}
              className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 text-indigo-200 text-[10px] font-bold transition active:scale-95"
              title="Background me chalte rahega, aap app me ghoom sakte hain"
            >
              <Minimize2 size={12} />
              <span>Background Play</span>
            </button>
          )}

          <div>
            {isDownloaded ? (
              <span className="flex items-center gap-1 text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full">
                <CheckCircle size={11} /> Saved
              </span>
            ) : isDownloading ? (
              <span className="flex items-center gap-1 text-[10px] font-bold bg-indigo-500/30 text-indigo-200 border border-indigo-500/40 px-2 py-0.5 rounded-full animate-pulse">
                <Download size={11} className="animate-bounce" /> {downloadProgress}%
              </span>
            ) : (
              <button
                onClick={handleDownload}
                className={`flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-full transition active:scale-95 shadow ${
                  canDownloadAudio
                    ? 'bg-indigo-600 text-white hover:bg-indigo-500'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                }`}
              >
                {canDownloadAudio ? <Download size={11} /> : <Crown size={11} />}
                {canDownloadAudio ? 'Save' : 'Ultra'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Animated Sound Waveform Bars */}
      <div className="flex items-center justify-center gap-1 h-10 mb-4 px-4">
        {[40, 75, 50, 90, 60, 30, 85, 45, 95, 70, 50, 80, 65, 90, 40, 70, 55, 85, 45, 60].map(
          (h, i) => (
            <div
              key={i}
              className={`w-1 rounded-full transition-all duration-300 ${
                isPlaying ? 'bg-indigo-400' : 'bg-slate-700'
              }`}
              style={{
                height: isPlaying ? `${Math.max(15, (h * (isPlaying ? 1 : 0.3)))}%` : '15%',
                opacity: isPlaying ? 0.9 : 0.3,
                animation: isPlaying ? `pulse 1.2s ease-in-out infinite ${i * 0.05}s` : 'none',
              }}
            />
          )
        )}
      </div>

      {/* Progress Slider */}
      <div className="space-y-1 mb-4">
        <input
          type="range"
          min={0}
          max={duration || 100}
          value={currentTime}
          onChange={(e) => {
            if (isCurrentTrack) {
              globalAudioService.seek(parseFloat(e.target.value));
            }
          }}
          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400"
        />
        <div className="flex justify-between text-[10px] text-slate-400 font-mono">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={handleSpeedCycle}
          className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold font-mono transition"
          title="Playback Speed"
        >
          {playbackSpeed}x
        </button>

        <div className="flex items-center gap-4">
          <button
            onClick={() => skipTime(-10)}
            className="p-2 rounded-full bg-white/5 hover:bg-white/15 text-slate-200 transition active:scale-90 flex flex-col items-center"
            title="-10s"
          >
            <RotateCcw size={16} />
            <span className="text-[7px] font-black mt-0.5">-10s</span>
          </button>

          <button
            onClick={togglePlay}
            className="w-12 h-12 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-xl shadow-indigo-600/40 flex items-center justify-center active:scale-95 transition"
          >
            {isPlaying ? <Pause size={22} /> : <Play size={22} className="translate-x-0.5" />}
          </button>

          <button
            onClick={() => skipTime(10)}
            className="p-2 rounded-full bg-white/5 hover:bg-white/15 text-slate-200 transition active:scale-90 flex flex-col items-center"
            title="+10s"
          >
            <RotateCw size={16} />
            <span className="text-[7px] font-black mt-0.5">+10s</span>
          </button>
        </div>

        <button
          onClick={() => globalAudioService.toggleMute()}
          className="p-2 text-slate-400 hover:text-white transition"
        >
          {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
      </div>
    </div>
  );
};
