/**
 * MaintenanceScreen.tsx
 * Smart Crash Protection & Zero-Downtime System Upgrade Interface.
 * Designed with high-end enterprise cyber-minimalism, precision orbital mechanics,
 * Pedro AI voice guidance with live soundwave visualizer, and live deployment telemetry.
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Home, RotateCcw, Volume2, VolumeX, ShieldCheck, ArrowRight, Sparkles, CheckCircle2, RefreshCw } from 'lucide-react';
import { pedroSpeak } from '../utils/pedroVoiceManager';
import { Pedro3DMascot } from './Pedro3DMascot';

interface Props {
  title?: string;
  message?: string;
  pageName?: string;
  retryMinutes?: number;
  /** If true, shows a compact banner instead of full-page */
  compact?: boolean;
  onRetry?: () => void;
  onGoHome?: () => void;
}

// Fallback visual for Pedro if WebGL is unavailable in crashed state
const PedroCyberFallback: React.FC<{ isSpeaking?: boolean; onClick?: () => void }> = ({ isSpeaking, onClick }) => (
  <div 
    onClick={onClick}
    className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-b from-indigo-950 via-slate-900 to-indigo-950 p-2 shadow-[0_0_20px_rgba(99,102,241,0.3)] border border-indigo-500/40 flex flex-col items-center justify-center cursor-pointer active:scale-95 transition-transform relative select-none"
    title="Pedro AI Assistant"
  >
    {/* Antenna with live pulse */}
    <div className="w-1.5 h-2.5 bg-cyan-400 rounded-full mb-1 shadow-[0_0_8px_#22d3ee] animate-pulse" />
    {/* Visor */}
    <div className="w-12 h-7 bg-slate-950 rounded-lg flex items-center justify-center gap-1.5 px-1 shadow-inner border border-cyan-400/40">
      <div className={`w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee] ${isSpeaking ? 'animate-bounce' : 'animate-pulse'}`} />
      <div className={`w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee] ${isSpeaking ? 'animate-bounce' : 'animate-pulse'}`} />
    </div>
    {/* Live status beacon */}
    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 text-slate-950 rounded-full flex items-center justify-center text-[10px] font-black shadow-md border-2 border-slate-900">
      ✓
    </div>
  </div>
);

export function MaintenanceScreen({
  title,
  message,
  pageName,
  retryMinutes = 30,
  compact = false,
  onRetry,
  onGoHome,
}: Props) {
  const [secondsLeft, setSecondsLeft] = useState(retryMinutes * 60);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [hasWebGLError, setHasWebGLError] = useState(false);
  const hasSpokenOnceRef = useRef(false);

  // Fallback defaults for missing/empty strings
  const displayTitle = (title && title.trim().length > 0) ? title : 'System Upgrade in Progress';
  const displayMessage = (message && message.trim().length > 0)
    ? message
    : 'Hum is section ko naye features, ultra-fast speed aur behtar stability ke sath upgrade kar rahe hain. Kripya thodi der baad dobara check karein.';

  const resolvedPageLabel = pageName
    ? pageName.replace(/([A-Z])/g, ' $1').trim()
    : 'Selected Section';

  useEffect(() => {
    setSecondsLeft(retryMinutes * 60);
  }, [retryMinutes]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = setInterval(() => setSecondsLeft(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [secondsLeft]);

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  const speakMaintenanceMessage = useCallback((onFinished?: () => void) => {
    if (isSpeaking) {
      // Toggle off if already speaking
      try {
        if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      } catch {}
      setIsSpeaking(false);
      return;
    }

    setIsSpeaking(true);
    const speechText = 'Aap abhi is page pe the. Is page ko update kiya ja raha hai, 30 minute ya 1 ghante baad aaiye is page pe aap! Chaliye main aapko Home page par le chalta hoon.';
    pedroSpeak(speechText, {
      rate: 1.05,
      pitch: 1.15,
      showBubble: true,
      onEnd: () => {
        setIsSpeaking(false);
        if (onFinished) onFinished();
      },
    });

    // Auto reset speaking animation safeguard
    setTimeout(() => {
      setIsSpeaking(false);
      if (onFinished) onFinished();
    }, 6500);
  }, [isSpeaking]);

  // Soft auto-greeting on screen mount (with user gesture safety)
  useEffect(() => {
    if (!compact && !hasSpokenOnceRef.current) {
      hasSpokenOnceRef.current = true;
      const timer = setTimeout(() => {
        try {
          speakMaintenanceMessage();
        } catch {}
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [compact, speakMaintenanceMessage]);

  const handleRetry = () => {
    setIsRetrying(true);
    setTimeout(() => {
      if (onRetry) {
        onRetry();
      } else {
        window.location.reload();
      }
    }, 450);
  };

  const handleGoHome = () => {
    setIsNavigating(true);
    setIsSpeaking(true);
    pedroSpeak('Chaliye Home page par chalte hain!', {
      rate: 1.1,
      pitch: 1.15,
      onEnd: () => {
        executeGoHome();
      },
    });
    // Fallback navigation timeout in case speech synth hangs
    setTimeout(() => {
      executeGoHome();
    }, 900);
  };

  const executeGoHome = () => {
    try {
      localStorage.setItem('nst_active_student_tab', 'HOME');
      localStorage.removeItem('nst_active_view');
      localStorage.removeItem('iic_last_crash');
      sessionStorage.removeItem('nst_crash_state');
    } catch {}

    // Dispatch global events so active React trees pick it up
    try {
      window.dispatchEvent(new CustomEvent('nst-navigate-home'));
      window.dispatchEvent(new CustomEvent('nst-tab-change', { detail: 'HOME' }));
    } catch {}

    if (onGoHome) {
      onGoHome();
    } else {
      try { window.history.pushState({}, '', '/'); } catch {}
      window.location.href = window.location.origin + window.location.pathname;
    }
  };

  // Compact inline banner
  if (compact) {
    return (
      <div className="w-full flex items-center gap-3 bg-gradient-to-r from-slate-900 via-indigo-950/80 to-slate-900 border border-indigo-500/30 rounded-2xl px-4 py-3 shadow-lg animate-in fade-in text-white">
        <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/40 text-cyan-400 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(99,102,241,0.3)]">
          <RefreshCw size={17} className="animate-spin text-cyan-300" style={{ animationDuration: '4s' }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-black text-indigo-300 uppercase tracking-wider">NSTA Engine Update</span>
          </div>
          <p className="text-xs font-black text-slate-100 leading-tight truncate">{displayTitle}</p>
          <p className="text-[10px] text-slate-400 mt-0.5 leading-snug line-clamp-1">{displayMessage}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleGoHome}
            className="text-[11px] font-black text-white bg-gradient-to-r from-indigo-600 to-purple-600 px-3 py-1.5 rounded-xl hover:from-indigo-500 hover:to-purple-500 transition-all flex items-center gap-1 shadow-sm"
          >
            <Home size={12} /> Home
          </button>
          <button
            onClick={handleRetry}
            className="text-[11px] font-bold text-slate-300 hover:text-white bg-white/10 hover:bg-white/20 border border-white/15 px-3 py-1.5 rounded-xl transition-all"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="min-h-screen relative flex flex-col items-center justify-center p-4 sm:p-6 text-center font-sans overflow-x-hidden selection:bg-indigo-900 selection:text-white"
      style={{
        background: 'radial-gradient(ellipse at 50% -10%, #15112e 0%, #090a14 55%, #04050a 100%)',
      }}
    >
      {/* Ambient background glows */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[520px] h-[350px] bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none -z-10" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-cyan-500/5 rounded-full blur-[80px] pointer-events-none -z-10" />
      <div className="absolute top-1/3 left-10 w-72 h-72 bg-purple-600/5 rounded-full blur-[90px] pointer-events-none -z-10" />

      {/* Top Header Floating Badge */}
      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/80 backdrop-blur-xl border border-slate-800 shadow-[0_4px_20px_rgba(0,0,0,0.4)] mb-5 select-none animate-in fade-in slide-in-from-top-2 duration-300">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        <span className="text-[11px] font-black text-slate-200 tracking-wider">
          NSTA INFRASTRUCTURE
        </span>
        <span className="text-slate-600">·</span>
        <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
          <ShieldCheck size={12} className="text-emerald-400" /> High-Availability Mode
        </span>
      </div>

      {/* Main Luxury Glass Container */}
      <div className="bg-slate-900/85 backdrop-blur-2xl rounded-3xl shadow-[0_25px_70px_-15px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.08)] border border-purple-500/20 w-full max-w-md p-6 sm:p-7 relative transition-all text-white overflow-hidden">
        
        {/* Subtle top edge specular highlight line */}
        <div className="absolute top-0 left-12 right-12 h-[1px] bg-gradient-to-r from-transparent via-indigo-400/50 to-transparent pointer-events-none" />

        {/* ─── HERO STAGE: Precision Rotating Orbital Rings + Holographic Mascot ─── */}
        <div className="relative flex flex-col items-center justify-center my-3">
          {/* Outer concentric glowing rings */}
          <div className="relative w-28 h-28 sm:w-32 sm:h-32 flex items-center justify-center">
            
            {/* Ambient halo glow */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-cyan-500/15 via-indigo-500/20 to-purple-500/15 blur-xl animate-pulse" />

            {/* Orbital Ring 1 (Smooth SVG Gear/Grid ticks) */}
            <div 
              className="absolute inset-0 rounded-full border border-indigo-500/30 animate-spin"
              style={{ animationDuration: '24s' }}
            >
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-indigo-400/80" />
            </div>

            {/* Orbital Ring 2 (Counter-spin) */}
            <div 
              className="absolute inset-2.5 rounded-full border border-dashed border-cyan-400/30 animate-spin"
              style={{ animationDirection: 'reverse', animationDuration: '18s' }}
            />

            {/* Inner illuminated glass pedestal */}
            <div 
              id="maintenance-pedro-mascot-btn"
              onClick={handleGoHome}
              className="relative z-10 w-20 h-20 sm:w-22 sm:h-22 rounded-2xl bg-gradient-to-b from-slate-800/90 via-slate-900/90 to-indigo-950/90 border border-indigo-500/40 shadow-[0_0_25px_rgba(99,102,241,0.25)] flex items-center justify-center cursor-pointer group hover:scale-105 active:scale-95 transition-all"
              title="Pedro AI Assistant — Home jane ke liye tap karein"
            >
              {!hasWebGLError ? (
                <div 
                  className="w-full h-full flex items-center justify-center overflow-hidden rounded-2xl"
                  onError={() => setHasWebGLError(true)}
                >
                  <Pedro3DMascot
                    size={76}
                    pose={isSpeaking ? 'wave' : 'idle'}
                    isSpeaking={isSpeaking}
                    colorScheme="cyber"
                  />
                </div>
              ) : (
                <PedroCyberFallback isSpeaking={isSpeaking} onClick={handleGoHome} />
              )}

              {/* Status pill badge on pedestal */}
              <div className="absolute -bottom-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-[9px] font-black px-2.5 py-0.5 rounded-full shadow-[0_0_12px_rgba(99,102,241,0.6)] whitespace-nowrap flex items-center gap-1 border border-indigo-300/40 tracking-wider uppercase">
                <Sparkles size={9} className="text-amber-300" /> Pedro AI
              </div>
            </div>
          </div>
        </div>

        {/* ─── DYNAMIC TITLE & SECTION IDENTIFIER ─── */}
        <div className="mt-4 mb-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-400/30 text-indigo-300 text-[10px] font-black uppercase tracking-wider mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping inline-block" />
            <span>Target: {resolvedPageLabel}</span>
          </div>

          <h1 className="text-xl sm:text-2xl font-black text-white leading-tight tracking-tight drop-shadow-sm">
            {displayTitle}
          </h1>

          <p className="text-slate-300/90 text-xs sm:text-sm leading-relaxed mt-1.5 max-w-sm mx-auto font-medium">
            {displayMessage}
          </p>
        </div>

        {/* ─── PEDRO AUDIO GUIDE & WAVEFORM MODULE (High-End Voice Bar) ─── */}
        <div 
          onClick={() => speakMaintenanceMessage()}
          className="my-4 p-3 bg-gradient-to-r from-slate-900/90 via-indigo-950/60 to-slate-900/90 border border-indigo-500/30 hover:border-indigo-400/50 rounded-2xl text-left cursor-pointer transition-all shadow-md group relative overflow-hidden"
        >
          {/* Subtle neon left accent */}
          <div className="absolute top-0 bottom-0 left-0 w-1 bg-gradient-to-b from-cyan-400 via-indigo-500 to-purple-500" />

          <div className="flex items-center justify-between pl-1">
            <div className="flex items-center gap-2.5 min-w-0">
              {/* Animated Sound Wave Visualizer */}
              <div className="flex items-end gap-1 h-5 shrink-0 px-1">
                <span className={`w-1 rounded-full bg-cyan-400 transition-all ${isSpeaking ? 'h-4 animate-pulse' : 'h-1.5'}`} />
                <span className={`w-1 rounded-full bg-indigo-400 transition-all ${isSpeaking ? 'h-5 animate-pulse delay-75' : 'h-3'}`} />
                <span className={`w-1 rounded-full bg-purple-400 transition-all ${isSpeaking ? 'h-3.5 animate-pulse delay-150' : 'h-2'}`} />
                <span className={`w-1 rounded-full bg-pink-400 transition-all ${isSpeaking ? 'h-4.5 animate-pulse delay-100' : 'h-1.5'}`} />
              </div>

              <div className="min-w-0">
                <p className="text-[10px] font-black text-indigo-300 uppercase tracking-wider flex items-center gap-1.5 leading-none">
                  <span>Pedro Voice Guidance</span>
                  {isSpeaking && (
                    <span className="text-[9px] bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 px-1.5 rounded-full font-bold">
                      PLAYING
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-slate-200 font-semibold truncate mt-1 leading-snug">
                  "Is page ko update kiya ja raha hai, 30 min baad aaiye!"
                </p>
              </div>
            </div>

            {/* Listen button */}
            <div className={`px-2.5 py-1 rounded-xl text-[11px] font-black flex items-center gap-1 transition-all shrink-0 ml-2 border ${
              isSpeaking
                ? 'bg-rose-500/20 text-rose-300 border-rose-400/40 shadow-[0_0_10px_rgba(244,63,94,0.3)]'
                : 'bg-white/10 group-hover:bg-white/20 text-cyan-300 border-white/10'
            }`}>
              {isSpeaking ? (
                <>
                  <VolumeX size={12} />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Volume2 size={12} className="text-cyan-400 animate-pulse" />
                  <span>Sunein</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ─── COUNTDOWN TIMER & TELEMETRY PROGRESS ─── */}
        {secondsLeft > 0 && (
          <div className="mb-5 bg-slate-950/60 border border-slate-800 rounded-2xl p-3.5 shadow-inner">
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <RefreshCw size={11} className="text-cyan-400 animate-spin" style={{ animationDuration: '6s' }} />
                Estimated Wait Time
              </span>
              <span className="text-[10px] font-black text-emerald-400 flex items-center gap-1">
                <CheckCircle2 size={11} /> Auto Sync Active
              </span>
            </div>

            {/* Sculpted Digital Monospace Clock Modules */}
            <div className="flex items-center justify-center gap-2">
              <div className="bg-slate-900/90 rounded-xl px-4 py-2 border border-slate-800 shadow-md min-w-[62px]">
                <span className="text-2xl sm:text-3xl font-black text-cyan-400 font-mono leading-none tracking-tight drop-shadow-[0_0_8px_rgba(34,211,238,0.4)]">
                  {mm}
                </span>
                <p className="text-[8px] text-slate-400 font-black uppercase mt-1 tracking-wider">Minutes</p>
              </div>

              <span className="text-2xl font-black text-indigo-400 animate-pulse">:</span>

              <div className="bg-slate-900/90 rounded-xl px-4 py-2 border border-slate-800 shadow-md min-w-[62px]">
                <span className="text-2xl sm:text-3xl font-black text-cyan-400 font-mono leading-none tracking-tight drop-shadow-[0_0_8px_rgba(34,211,238,0.4)]">
                  {ss}
                </span>
                <p className="text-[8px] text-slate-400 font-black uppercase mt-1 tracking-wider">Seconds</p>
              </div>
            </div>

            {/* Live deployment progress bar */}
            <div className="mt-3 pt-2.5 border-t border-slate-800/80">
              <div className="flex items-center justify-between text-[9px] text-slate-400 font-bold mb-1">
                <span>Deploying Security & Core Modules</span>
                <span className="text-indigo-300 font-mono">92%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden relative">
                <div 
                  className="h-full bg-gradient-to-r from-indigo-500 via-cyan-400 to-emerald-400 rounded-full animate-pulse"
                  style={{ width: '92%' }}
                />
              </div>
            </div>
          </div>
        )}

        {/* ─── ACTION BUTTONS (High-End Tactile Controls) ─── */}
        <div className="space-y-2.5">
          {/* Primary Action: Go to Home Dashboard */}
          <button
            id="maintenance-go-home-btn"
            onClick={handleGoHome}
            disabled={isNavigating}
            className="w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-black py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2 shadow-[0_4px_25px_rgba(79,70,229,0.35)] active:scale-[0.98] transition-all cursor-pointer text-sm border border-indigo-400/30 group"
          >
            <Home size={18} className="text-white drop-shadow" />
            <span>Home Page Par Jayein</span>
            <ArrowRight size={16} className="ml-1 text-cyan-300 group-hover:translate-x-1 transition-transform" />
          </button>

          {/* Secondary Action: Refresh / Try Again */}
          <button
            id="maintenance-retry-btn"
            onClick={handleRetry}
            disabled={isRetrying}
            className="w-full bg-white/5 hover:bg-white/10 active:bg-white/15 text-slate-200 hover:text-white font-bold py-3 px-4 rounded-2xl flex items-center justify-center gap-2 border border-white/10 hover:border-white/20 shadow-sm active:scale-[0.98] transition-all cursor-pointer text-xs sm:text-sm"
          >
            <RotateCcw size={15} className={`text-slate-400 ${isRetrying ? 'animate-spin' : ''}`} />
            <span>{isRetrying ? 'Connecting...' : 'Page Refresh Karein (Check Again)'}</span>
          </button>
        </div>

        {/* ─── SECURITY REASSURANCE ─── */}
        <div className="mt-4 pt-3.5 border-t border-slate-800/80 flex items-center justify-center gap-1.5 text-[11px] text-slate-400 font-medium">
          <ShieldCheck size={14} className="text-emerald-400 shrink-0" />
          <span>Aapki test series, notes aur study progress 100% surakshit hain.</span>
        </div>
      </div>

      {/* ─── OFFICIAL PLATFORM SIGNATURE FOOTER ─── */}
      <div className="mt-5 flex items-center gap-2 text-xs text-slate-500 font-bold select-none">
        <span>— NSTA Engineering Team</span>
        <span className="w-1 h-1 rounded-full bg-slate-700" />
        <span className="text-[10px] text-slate-400 font-medium">Zero-Loss Protection Protocol</span>
      </div>
    </div>
  );
}

/** Compact banner shown at the top of home when maintenance is active */
export function MaintenanceBanner({
  title,
  message,
  onClick,
}: {
  title: string;
  message: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 rounded-2xl px-4 py-3 hover:border-indigo-400/50 transition-all text-left animate-in fade-in mb-3 shadow-lg cursor-pointer text-white"
    >
      <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/40 text-cyan-400 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(99,102,241,0.25)]">
        <RefreshCw size={17} className="animate-spin text-cyan-300" style={{ animationDuration: '4s' }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] font-black text-indigo-300 uppercase tracking-wider">NSTA Platform Update</span>
        </div>
        <p className="text-xs font-black text-slate-100 leading-tight">{title}</p>
        <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{message}</p>
      </div>
      <span className="text-[11px] font-black text-white bg-indigo-600/80 border border-indigo-400/40 px-3 py-1.5 rounded-xl shrink-0 shadow-xs flex items-center gap-1">
        Dekhein →
      </span>
    </button>
  );
}

/** Popup shown to admin when admin dashboard crashed — displayed on student dashboard */
export function AdminCrashPopup({
  errorMessage,
  crashedAt,
  onMarkFixed,
  onDismiss,
}: {
  errorMessage: string;
  crashedAt: number;
  onMarkFixed: () => void;
  onDismiss: () => void;
}) {
  const ago = crashedAt
    ? (() => {
        const d = Date.now() - crashedAt;
        if (d < 60000) return `${Math.floor(d / 1000)}s ago`;
        if (d < 3600000) return `${Math.floor(d / 60000)}m ago`;
        return `${Math.floor(d / 3600000)}h ago`;
      })()
    : 'just now';

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-sm bg-slate-900 rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 border border-rose-500/30 text-white">
        {/* Header */}
        <div className="bg-gradient-to-r from-rose-600 to-orange-600 p-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">⚠️</span>
              <span className="font-black text-sm">NSTA System Alert</span>
            </div>
            <button
              onClick={onDismiss}
              className="w-7 h-7 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors text-white font-black text-sm cursor-pointer"
            >
              ×
            </button>
          </div>
          <p className="text-rose-100 text-[10px] mt-1">
            Dashboard reload request detected — student view active ({ago})
          </p>
        </div>

        {/* Error details */}
        <div className="px-4 py-3 bg-slate-950 border-b border-slate-800">
          <p className="text-[9px] font-black text-rose-400 uppercase mb-1">Status</p>
          <p className="text-xs font-bold text-rose-200 line-clamp-3 font-mono">
            {errorMessage || 'Unknown error'}
          </p>
        </div>

        {/* Actions */}
        <div className="p-4 space-y-2.5">
          <p className="text-[10px] text-slate-400 text-center">
            Bug fix karne ke baad "Mark as Fixed" dabayein — sab normal ho jayega.
          </p>
          <button
            onClick={onMarkFixed}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm py-3 rounded-2xl transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/30"
          >
            ✅ Mark as Fixed
          </button>
          <button
            onClick={onDismiss}
            className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm py-2.5 rounded-2xl transition-colors cursor-pointer"
          >
            Baad Mein Dekhta Hoon
          </button>
        </div>
      </div>
    </div>
  );
}
