import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  X,
  RotateCcw,
  RotateCw,
  Zap,
  Maximize2,
  Minimize2,
  AlertTriangle,
  Headphones,
  Music,
} from 'lucide-react';
import { globalAudioService, GlobalAudioState } from '../services/globalAudioService';

interface Props {
  track?: { url: string; title: string; subtitle?: string } | null;
  onClose?: () => void;
  isBottomNavHidden?: boolean;
}

export const MiniPlayer: React.FC<Props> = ({
  track: propTrack,
  onClose: propOnClose,
  isBottomNavHidden = false,
}) => {
  const [globalState, setGlobalState] = useState<GlobalAudioState>(() => globalAudioService.getState());
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const unsubscribe = globalAudioService.subscribe((state) => {
      setGlobalState(state);
    });
    return unsubscribe;
  }, []);

  // Sync propTrack to globalAudioService if passed
  useEffect(() => {
    if (propTrack && propTrack.url && propTrack.url !== globalState.track?.url) {
      globalAudioService.playTrack({
        url: propTrack.url,
        title: propTrack.title,
        subtitle: propTrack.subtitle,
      });
    }
  }, [propTrack]);

  const activeTrack = globalState.track || propTrack;
  const isPlaying = globalState.isPlaying;
  const progress = globalState.currentTime;
  const duration = globalState.duration;
  const playbackRate = globalState.playbackRate;
  const error = globalState.error;

  if (!activeTrack || !activeTrack.url) return null;

  const isDrive = activeTrack.url.includes('drive.google.com');
  const isNotebookLM = activeTrack.url.includes('notebooklm.google.com');

  const getDriveId = (url: string) => {
    const match = url.match(/\/d\/(.*?)\/|\/d\/(.*?)$|id=(.*?)(&|$)/);
    return match ? match[1] || match[2] || match[3] : null;
  };

  const togglePlay = () => {
    globalAudioService.togglePlay();
  };

  const skip = (seconds: number) => {
    globalAudioService.skip(seconds);
  };

  const toggleSpeed = () => {
    const rates = [0.75, 1.0, 1.25, 1.5, 2.0];
    const nextIdx = (rates.indexOf(playbackRate) + 1) % rates.length;
    globalAudioService.setPlaybackRate(rates[nextIdx]);
  };

  const handleClose = () => {
    globalAudioService.close();
    propOnClose?.();
  };

  const formatTime = (time: number) => {
    if (!time || isNaN(time)) return '0:00';
    const m = Math.floor(time / 60);
    const s = Math.floor(time % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const bottomClass = isBottomNavHidden
    ? 'bottom-3 sm:bottom-4'
    : 'bottom-[72px] sm:bottom-[76px]';

  return (
    <div
      className={`fixed left-2 right-2 max-w-2xl mx-auto z-[95] transition-all duration-300 ease-in-out shadow-2xl bg-slate-950/95 backdrop-blur-xl border border-indigo-500/30 rounded-2xl overflow-hidden ${bottomClass} ${
        isDrive || isNotebookLM
          ? 'h-64'
          : isExpanded || error
          ? 'h-44'
          : 'h-16'
      }`}
    >
      {/* ── GOOGLE DRIVE / NOTEBOOKLM EMBED ── */}
      {isDrive || isNotebookLM ? (
        <div className="w-full h-full flex flex-col">
          <div className="bg-slate-900 px-4 py-2 flex justify-between items-center border-b border-white/10">
            <div className="flex items-center gap-2 text-white/90 overflow-hidden">
              <Headphones size={16} className="shrink-0 text-indigo-400" />
              <span className="text-xs font-bold uppercase truncate">
                {activeTrack.title || 'AUDIO PLAYER'}
              </span>
            </div>
            <button
              onClick={handleClose}
              className="text-slate-400 hover:text-white shrink-0 ml-2 p-1 active:scale-95 transition"
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 p-2 flex flex-col items-center justify-center gap-3">
            {(isDrive && getDriveId(activeTrack.url)) || isNotebookLM ? (
              <div className="relative w-full h-full rounded-lg overflow-hidden border border-slate-700 bg-black">
                <iframe
                  src={
                    isDrive
                      ? `https://drive.google.com/file/d/${getDriveId(activeTrack.url)}/preview`
                      : activeTrack.url
                  }
                  className="w-full h-full"
                  title={activeTrack.title || 'AUDIO PLAYER'}
                  allow="autoplay"
                />
              </div>
            ) : (
              <div className="text-center p-4">
                <p className="text-slate-400 text-xs">Invalid Link.</p>
              </div>
            )}
          </div>
        </div>
      ) : !error ? (
        <div className="flex flex-col h-full justify-between">
          {/* PROGRESS BAR SCRUBBER */}
          <div
            className="h-1.5 bg-slate-800 w-full cursor-pointer group relative"
            onClick={(e) => {
              if (duration > 0) {
                const rect = e.currentTarget.getBoundingClientRect();
                const percent = (e.clientX - rect.left) / rect.width;
                globalAudioService.seek(percent * duration);
              }
            }}
          >
            <div
              className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 relative transition-all duration-100"
              style={{ width: `${duration > 0 ? (progress / duration) * 100 : 0}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-lg border border-indigo-400 opacity-90 group-hover:scale-125 transition-transform" />
            </div>
          </div>

          {/* MAIN PLAYER ROW */}
          <div className="flex items-center justify-between px-3.5 h-full gap-2">
            {/* TRACK INFO */}
            <div className="flex items-center gap-2.5 overflow-hidden flex-1 min-w-0">
              <div
                className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 flex items-center justify-center shrink-0 shadow-md ${
                  isPlaying ? 'ring-2 ring-indigo-400/50' : 'opacity-80'
                }`}
              >
                {isPlaying ? (
                  <div className="flex items-end gap-0.5 h-4 mb-0.5">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="w-1 bg-white rounded-full animate-bounce"
                        style={{
                          height: `${8 + (i % 3) * 4}px`,
                          animationDelay: `${i * 0.12}s`,
                          animationDuration: '0.8s',
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <Music size={18} className="text-white" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-black uppercase px-1 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    Audio
                  </span>
                  <h4 className="text-white text-xs font-bold truncate">
                    {activeTrack.title}
                  </h4>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-0.5">
                  <span>
                    {formatTime(progress)} / {formatTime(duration)}
                  </span>
                  {activeTrack.subtitle && (
                    <span className="truncate max-w-[120px] text-slate-500 hidden xs:inline">
                      • {activeTrack.subtitle}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* CONTROLS */}
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              {/* Skip -10s */}
              <button
                onClick={() => skip(-10)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition active:scale-90"
                title="-10 seconds"
              >
                <RotateCcw size={16} />
              </button>

              {/* Play / Pause */}
              <button
                onClick={togglePlay}
                className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-indigo-600/40 shrink-0"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <Pause size={18} fill="currentColor" />
                ) : (
                  <Play size={18} fill="currentColor" className="ml-0.5" />
                )}
              </button>

              {/* Skip +10s */}
              <button
                onClick={() => skip(10)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition active:scale-90"
                title="+10 seconds"
              >
                <RotateCw size={16} />
              </button>

              {/* Speed rate */}
              <button
                onClick={toggleSpeed}
                className="text-slate-300 hover:text-white transition flex items-center text-[10px] font-bold gap-0.5 bg-white/10 hover:bg-white/15 px-2 py-1 rounded-md"
                title="Playback Speed"
              >
                <Zap size={11} className="text-amber-400" /> {playbackRate}x
              </button>

              {/* Close */}
              <button
                onClick={handleClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition active:scale-90"
                title="Stop & Close"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="w-full h-full flex items-center justify-between px-4 bg-slate-900 text-center">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-amber-400 shrink-0" />
            <span className="text-white text-xs font-bold">Audio chalane me samasya aayi</span>
          </div>
          <button
            onClick={handleClose}
            className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white text-xs rounded-lg transition"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
};
