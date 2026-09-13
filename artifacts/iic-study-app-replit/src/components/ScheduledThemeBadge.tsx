import React, { useEffect, useRef, useState } from 'react';
import type { SystemSettings } from '../types';
import type { ScheduledTheme } from '../types';
import { Zap } from 'lucide-react';

interface Props {
  settings?: SystemSettings;
  userTier?: string;
  accentColor?: string;
}

// ─── Reactive now() — updates every second ─────────────────────────────────────
function useNow(): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

// ─── Countdown hook ─────────────────────────────────────────────────────────────
function useCountdown(targetISO: string | null): { label: string; secs: number } {
  const [state, setState] = useState({ label: '', secs: 0 });
  useEffect(() => {
    if (!targetISO) { setState({ label: '', secs: 0 }); return; }
    const update = () => {
      const diff = new Date(targetISO).getTime() - Date.now();
      if (diff <= 0) { setState({ label: '', secs: 0 }); return; }
      const totalSecs = Math.floor(diff / 1000);
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      let label = '';
      if (h > 48) {
        const d = Math.floor(h / 24);
        label = `${d}d ${h % 24}h`;
      } else if (h > 0) {
        label = `${h}h ${m}m`;
      } else if (m > 0) {
        label = `${m}m ${s}s`;
      } else {
        label = `${s}s`;
      }
      setState({ label, secs: totalSecs });
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [targetISO]);
  return state;
}

// ─── Theme Start Toast — fires once when upcoming → active ─────────────────────
function ThemeStartToast({ theme, onDone }: { theme: ScheduledTheme; onDone: () => void }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), 50);
    const t2 = setTimeout(() => { setVisible(false); }, 3200);
    const t3 = setTimeout(onDone, 3700);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onDone]);

  return (
    <div
      className="fixed top-16 inset-x-0 flex justify-center z-[300] pointer-events-none px-4"
      style={{ transition: 'opacity 0.4s ease, transform 0.4s ease', opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(-12px)' }}
    >
      <div
        className="flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border border-white/15 max-w-sm w-full"
        style={{
          background: `linear-gradient(135deg, ${theme.themeColors?.topBarStart || '#1e3a8a'}, ${theme.themeColors?.topBarEnd || '#0f1e3c'})`,
        }}
      >
        <span className="text-2xl">{theme.themeEmoji || '🎨'}</span>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-black text-white/60 uppercase tracking-wider">🎉 Theme Event Shuru!</p>
          <p className="text-sm font-black text-white leading-tight truncate">{theme.themeName}</p>
        </div>
        <span
          className="text-[9px] font-black px-2 py-0.5 rounded-full bg-green-400/20 text-green-300 uppercase shrink-0"
        >Live</span>
      </div>
    </div>
  );
}

// ─── Main Badge ─────────────────────────────────────────────────────────────────
export function ScheduledThemeBadge({ settings, userTier, accentColor = '#3b82f6' }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const prevWasUpcoming = useRef(false);

  // Reactive time — updates every second so transitions work automatically
  const now = useNow();

  const scheduledThemes: ScheduledTheme[] = (settings as any)?.scheduledThemes || [];

  const relevantTheme = scheduledThemes.find(t => {
    if (t.target !== 'ALL') {
      const tierMap: Record<string, string> = { ultra: 'ULTRA', basic: 'BASIC', free: 'FREE' };
      const mappedTier = tierMap[userTier || 'free'] || 'FREE';
      if (t.target !== mappedTier) return false;
    }
    const start = new Date(t.scheduledAt).getTime();
    const end = start + t.durationHours * 3600000;
    return now < end;
  });

  const startMs = relevantTheme ? new Date(relevantTheme.scheduledAt).getTime() : 0;
  const endMs = relevantTheme ? startMs + relevantTheme.durationHours * 3600000 : 0;
  const isActive = relevantTheme ? now >= startMs && now < endMs : false;
  const isUpcoming = relevantTheme ? now < startMs : false;

  // Fire toast once when theme transitions from upcoming → active
  useEffect(() => {
    if (!relevantTheme) { prevWasUpcoming.current = false; return; }
    if (prevWasUpcoming.current && isActive && !showToast) {
      setShowToast(true);
    }
    prevWasUpcoming.current = isUpcoming;
  }, [isActive, isUpcoming, relevantTheme, showToast]);

  if (!relevantTheme) return null;
  if (dismissed === relevantTheme.id) return null;

  const countdownTarget = isUpcoming
    ? relevantTheme.scheduledAt
    : isActive ? new Date(endMs).toISOString() : null;

  return (
    <>
      {/* Transition toast */}
      {showToast && (
        <ThemeStartToast
          theme={relevantTheme}
          onDone={() => setShowToast(false)}
        />
      )}

      <BadgeInner
        theme={relevantTheme}
        isActive={isActive}
        isUpcoming={isUpcoming}
        countdownTarget={countdownTarget}
        accentColor={accentColor}
        showModal={showModal}
        setShowModal={setShowModal}
        startMs={startMs}
        endMs={endMs}
        onDismiss={() => setDismissed(relevantTheme.id)}
      />
    </>
  );
}

// ─── Badge Button ───────────────────────────────────────────────────────────────
function BadgeInner({
  theme, isActive, isUpcoming, countdownTarget, accentColor,
  showModal, setShowModal, startMs, endMs, onDismiss,
}: {
  theme: ScheduledTheme;
  isActive: boolean;
  isUpcoming: boolean;
  countdownTarget: string | null;
  accentColor: string;
  showModal: boolean;
  setShowModal: (v: boolean) => void;
  startMs: number;
  endMs: number;
  onDismiss: () => void;
}) {
  const { label: countdown } = useCountdown(countdownTarget);

  // If countdown finished but parent hasn't re-rendered yet to switch mode
  // just show a brief "starting..." label instead of disappearing
  const displayCountdown = countdown || (isActive ? '…' : null);
  if (!displayCountdown) return null;

  // ── Active: expiry countdown ──────────────────────────────────────────────────
  if (isActive) {
    return (
      <>
        <style>{`
          @keyframes themeActiveBorder { 0%,100%{border-color:rgba(255,255,255,0.3)} 50%{border-color:rgba(255,255,255,0.7)} }
        `}</style>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1 px-2 py-1 rounded-full border text-white transition-all active:scale-90 shrink-0"
          style={{
            background: `linear-gradient(135deg, ${theme.themeColors?.topBarStart || accentColor}CC, ${theme.themeColors?.btnEnd || accentColor}CC)`,
            borderColor: 'rgba(255,255,255,0.3)',
            animation: 'themeActiveBorder 2s ease-in-out infinite',
            backdropFilter: 'blur(4px)',
            minWidth: 0,
          }}
          title={`Theme active — expires in ${displayCountdown}`}
        >
          <span className="text-[11px]">{theme.themeEmoji || '🎨'}</span>
          <div className="flex flex-col items-start leading-none">
            <span className="text-[6px] font-black text-white/70 uppercase tracking-wide">Expires</span>
            <span className="text-[9px] font-black text-white tabular-nums">{displayCountdown}</span>
          </div>
        </button>

        {showModal && (
          <ActiveThemeModal
            theme={theme}
            countdown={displayCountdown}
            endMs={endMs}
            accentColor={accentColor}
            onClose={() => setShowModal(false)}
          />
        )}
      </>
    );
  }

  // ── Upcoming: "Coming Soon" countdown ────────────────────────────────────────
  if (isUpcoming) {
    return (
      <>
        <style>{`
          @keyframes comingSoonBlink { 0%,100%{opacity:1} 50%{opacity:0.55} }
        `}</style>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1 px-2 py-1 rounded-full border text-white transition-all active:scale-90 shrink-0"
          style={{
            background: 'rgba(255,255,255,0.1)',
            borderColor: 'rgba(255,255,255,0.2)',
            backdropFilter: 'blur(6px)',
            minWidth: 0,
          }}
          title={`Coming soon: ${theme.themeName} in ${displayCountdown}`}
        >
          <span className="text-[10px]">{theme.themeEmoji || '🎨'}</span>
          <div className="flex flex-col items-start leading-none">
            <span
              className="text-[6px] font-black uppercase tracking-wide"
              style={{ color: theme.themeColors?.navActive || '#93c5fd', animation: 'comingSoonBlink 2s ease-in-out infinite' }}
            >
              Coming
            </span>
            <span className="text-[9px] font-black text-white tabular-nums">{displayCountdown}</span>
          </div>
        </button>

        {showModal && (
          <ComingSoonModal
            theme={theme}
            countdown={displayCountdown}
            startMs={startMs}
            endMs={endMs}
            accentColor={accentColor}
            onClose={() => setShowModal(false)}
            onDismiss={onDismiss}
          />
        )}
      </>
    );
  }

  return null;
}

// ─── Active Theme Modal ─────────────────────────────────────────────────────────
function ActiveThemeModal({ theme, countdown, endMs, accentColor, onClose }: {
  theme: ScheduledTheme; countdown: string; endMs: number;
  accentColor: string; onClose: () => void;
}) {
  const totalMs = theme.durationHours * 3600000;
  const startMs = new Date(theme.scheduledAt).getTime();
  const elapsed = Date.now() - startMs;
  const progress = Math.max(0, Math.min(1, elapsed / totalMs));

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm mx-4 mb-6 rounded-3xl overflow-hidden shadow-2xl border border-white/10"
        style={{ background: '#0a0c14' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header band */}
        <div
          className="h-28 flex items-end p-4 relative overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${theme.themeColors?.topBarStart || '#1e3a8a'}, ${theme.themeColors?.topBarEnd || '#0f1e3c'})`,
          }}
        >
          <div className="absolute bottom-0 left-0 right-0 h-3 flex opacity-70">
            {[theme.themeColors?.navActive, theme.themeColors?.btnStart, theme.themeColors?.btnEnd,
              theme.themeColors?.accentGlow, theme.themeColors?.progressColor].filter(Boolean).map((c, i) => (
              <div key={i} className="flex-1" style={{ background: c }} />
            ))}
          </div>
          <div className="flex items-end gap-3 relative z-10">
            <span className="text-4xl">{theme.themeEmoji || '🎨'}</span>
            <div>
              <span className="text-[8px] font-black px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 uppercase">
                🟢 Active Now
              </span>
              <p className="text-base font-black text-white mt-1">{theme.themeName}</p>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Expiry countdown */}
          <div className="rounded-2xl p-4 border border-white/8" style={{ background: '#080a10' }}>
            <p className="text-[8px] text-white/35 uppercase font-black tracking-wider mb-1">Theme khatam hoga</p>
            <p className="text-3xl font-black text-white tabular-nums">{countdown}</p>
            <div className="mt-3 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${(1 - progress) * 100}%`,
                  background: `linear-gradient(90deg, ${theme.themeColors?.btnStart || accentColor}, ${theme.themeColors?.navActive || accentColor})`,
                }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[7px] text-white/20">Shuru hua</span>
              <span className="text-[7px] text-white/20">{theme.durationHours}h baad khatam</span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[9px] text-white/40">
            <span>👥</span>
            <span>
              Target: {theme.target === 'ALL' ? 'Sabhi users' : theme.target}
              {theme.applyToProfile ? ' · Profile ✓' : ''}{theme.applyToBackground ? ' · Background ✓' : ''}
            </span>
          </div>

          {theme.topBarEffect && (
            <div className="flex items-center gap-2 text-[9px] text-white/40">
              <Zap size={10} className="text-yellow-400" />
              <span>Animated top bar effect included</span>
            </div>
          )}

          <button
            onClick={onClose}
            className="w-full py-3 rounded-2xl font-black text-sm text-white active:scale-95 transition-all"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            Band Karo
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Coming Soon Modal ──────────────────────────────────────────────────────────
function ComingSoonModal({ theme, countdown, startMs, endMs, accentColor, onClose, onDismiss }: {
  theme: ScheduledTheme; countdown: string; startMs: number; endMs: number;
  accentColor: string; onClose: () => void; onDismiss: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm mx-4 mb-6 rounded-3xl overflow-hidden shadow-2xl border border-white/10"
        style={{ background: '#0a0c14' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Preview header — blurred/dimmed to indicate "not yet" */}
        <div
          className="h-28 flex items-end p-4 relative overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${theme.themeColors?.topBarStart || '#1e3a8a'}70, ${theme.themeColors?.topBarEnd || '#0f1e3c'}70)`,
          }}
        >
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <div className="text-center">
              <div className="text-3xl mb-1">⏳</div>
              <span
                className="text-xs font-black px-3 py-1 rounded-full"
                style={{
                  background: `${theme.themeColors?.navActive || accentColor}25`,
                  color: theme.themeColors?.navActive || accentColor,
                  border: `1px solid ${theme.themeColors?.navActive || accentColor}40`,
                }}
              >
                Coming Soon
              </span>
            </div>
          </div>
          <div className="flex items-end gap-3 relative z-10">
            <span className="text-4xl opacity-50">{theme.themeEmoji || '🎨'}</span>
            <p className="text-base font-black text-white opacity-60">{theme.themeName}</p>
          </div>
        </div>

        {/* Color palette strip preview */}
        <div className="h-2.5 flex opacity-40">
          {[theme.themeColors?.navActive, theme.themeColors?.btnStart, theme.themeColors?.btnEnd,
            theme.themeColors?.accentGlow, theme.themeColors?.progressColor].filter(Boolean).map((c, i) => (
            <div key={i} className="flex-1" style={{ background: c }} />
          ))}
        </div>

        <div className="p-5 space-y-4">
          {/* "New theme event is coming soon!" headline */}
          <div className="text-center pt-1">
            <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">🎉 New Theme Event</p>
            <p
              className="text-base font-black mt-0.5"
              style={{ color: theme.themeColors?.navActive || accentColor }}
            >
              {theme.themeName}
            </p>
            <p className="text-[10px] text-white/30 mt-0.5">is coming soon!</p>
          </div>

          {/* Countdown box */}
          <div className="rounded-2xl p-4 border border-white/8" style={{ background: '#080a10' }}>
            <p className="text-[8px] text-white/35 uppercase font-black tracking-wider mb-1">Shuru hoga</p>
            <p className="text-3xl font-black tabular-nums" style={{ color: theme.themeColors?.navActive || '#93c5fd' }}>
              {countdown}
            </p>
            <p className="text-[8px] text-white/25 mt-1">
              {theme.durationHours}h chalega · Target: {theme.target === 'ALL' ? 'Sabhi users' : theme.target}
            </p>
          </div>

          {/* Feature chips */}
          <div className="space-y-1.5">
            {theme.applyToProfile && (
              <div className="flex items-center gap-2 text-[9px] text-white/50">
                <span>👤</span><span>Profile page background bhi badlega</span>
              </div>
            )}
            {theme.applyToBackground && (
              <div className="flex items-center gap-2 text-[9px] text-white/50">
                <span>🖼️</span><span>App background bhi badlega</span>
              </div>
            )}
            {theme.topBarEffect && (
              <div className="flex items-center gap-2 text-[9px] text-white/50">
                <Zap size={9} className="text-yellow-400" /><span>Animated top bar effect included</span>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => { onClose(); onDismiss(); }}
              className="flex-1 py-3 rounded-2xl font-black text-sm text-white/50 active:scale-95 transition-all border border-white/8"
              style={{ background: 'rgba(255,255,255,0.04)' }}
            >
              Dismiss
            </button>
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-2xl font-black text-sm text-white active:scale-95 transition-all"
              style={{
                background: `linear-gradient(135deg, ${theme.themeColors?.btnStart || accentColor}, ${theme.themeColors?.btnEnd || accentColor})`,
              }}
            >
              Samajh Gaya!
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
