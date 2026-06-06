/**
 * ReadingScoreHUD — Smart minimal HUD for reading/writing sessions.
 *
 * Default:  Hidden — only a small floating icon (📖 / ✍️) at bottom-right.
 * Tap icon: Shows info popup for 3 s, then auto-hides.
 * Reward:   Auto-shows green reward popup for 2 s.
 * Warning:  Auto-shows warning popup for 3 s.
 * All popups slide up from the icon and fade out automatically.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ReadingScoreState, WarningLevel } from '../utils/readingScoreEngine';

interface Props {
  state: ReadingScoreState;
  visible: boolean;
  levelColor?: string;
  levelLabel?: string;
  hideFloatingButton?: boolean;
}

type PopupKind = 'none' | 'info' | 'reward' | 'warning' | 'touch';

const fmt2 = (n: number) => String(Math.max(0, n)).padStart(2, '0');

export const ReadingScoreHUD: React.FC<Props> = ({
  state,
  visible,
  levelColor = '#6366f1',
  levelLabel,
  hideFloatingButton = false,
}) => {
  const [popup, setPopup]         = useState<PopupKind>('none');
  const [rewardPts, setRewardPts] = useState(0);
  const [mounted, setMounted]     = useState(false);
  const timerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevScore    = useRef(0);
  const prevWarning  = useRef<WarningLevel>(0);

  const clearTimer = () => { if (timerRef.current) clearTimeout(timerRef.current); };

  const showFor = useCallback((kind: PopupKind, ms: number) => {
    clearTimer();
    setMounted(true);
    setPopup(kind);
    timerRef.current = setTimeout(() => {
      setPopup('none');
    }, ms);
  }, []);

  /* Reward: no popup — score is shown live in the top bar instead */
  useEffect(() => {
    prevScore.current = state.totalSessionScore;
  }, [state.totalSessionScore]);

  /* Warning auto-popup (3 s) */
  useEffect(() => {
    if (state.warningLevel > 0 && state.warningLevel !== prevWarning.current) {
      prevWarning.current = state.warningLevel;
      showFor('warning', 3000);
    }
    if (state.warningLevel === 0) prevWarning.current = 0;
  }, [state.warningLevel, showFor]);

  /* Touch protection indicator — stays visible while countdown is active */
  const prevTouchProtection = useRef(false);
  useEffect(() => {
    if (state.touchProtectionActive && !prevTouchProtection.current) {
      // Became active → switch to touch popup and keep it open
      clearTimer();
      setMounted(true);
      setPopup('touch');
    }
    if (!state.touchProtectionActive && prevTouchProtection.current) {
      // Countdown ended → hide touch popup
      setPopup(p => (p === 'touch' ? 'none' : p));
    }
    prevTouchProtection.current = state.touchProtectionActive;
  }, [state.touchProtectionActive]);

  /* Cleanup on unmount */
  useEffect(() => { return () => clearTimer(); }, []);

  if (!visible || state.isWindowClosed) return null;

  const isReading  = state.mode === 'reading';
  const modeIcon   = isReading ? '📖' : '✍️';
  const remaining  = Math.max(0, state.maxWindowSec - state.sessionElapsedSec);
  const remMin     = Math.floor(remaining / 60);
  const remSec     = fmt2(remaining % 60);
  const progress   = Math.min(100, Math.round(state.progressPercent));

  const handleIconTap = () => {
    if (popup === 'info') { clearTimer(); setPopup('none'); }
    else showFor('info', 3000);
  };

  /* shared popup wrapper style */
  const popupBase: React.CSSProperties = {
    position:        'absolute',
    bottom:          '100%',
    right:           0,
    marginBottom:    10,
    borderRadius:    16,
    backdropFilter:  'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
    boxShadow:       '0 8px 32px rgba(0,0,0,0.5)',
    animation:       'rshud-slide 0.18s ease',
  };

  return (
    <>
      <style>{`
        @keyframes rshud-slide {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
      `}</style>

      <div
        style={{
          position:       'fixed',
          bottom:         80,
          right:          16,
          zIndex:         55,
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'flex-end',
          pointerEvents:  'none',
        }}
      >
        {/* ── INFO POPUP ── */}
        {popup === 'info' && (
          <div
            style={{
              ...popupBase,
              background:  'rgba(10,10,20,0.93)',
              border:      `1px solid ${levelColor}44`,
              padding:     '12px 14px',
              minWidth:    192,
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <span style={{ fontSize: 15 }}>{modeIcon}</span>
              <span style={{ color: '#94a3b8', fontSize: 10, fontWeight: 700, letterSpacing: '0.05em' }}>
                Score Session
              </span>
              {state.isPaused && (
                <span style={{ marginLeft: 'auto', background: '#ef4444cc', color: '#fff', fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 99 }}>
                  PAUSED
                </span>
              )}
            </div>

            {/* Progress row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 5 }}>
              <span style={{ color: '#94a3b8' }}>Progress</span>
              <span style={{ color: '#fff', fontWeight: 700 }}>{progress}%</span>
            </div>

            {/* Progress bar */}
            <div style={{ width: '100%', height: 3, background: '#1e2030', borderRadius: 99, overflow: 'hidden', marginBottom: 8 }}>
              <div style={{ width: `${progress}%`, height: '100%', background: levelColor, borderRadius: 99, transition: 'width 0.5s ease' }} />
            </div>

            {/* Next reward + time left */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, alignItems: 'center' }}>
              {!state.isPaused ? (
                <span style={{ color: levelColor, fontWeight: 900 }}>
                  +{isReading ? 5 : 25} in {state.nextRewardInSec}s
                </span>
              ) : (
                <span style={{ color: '#f87171', fontWeight: 700 }}>Score paused</span>
              )}
              <span style={{ color: '#64748b', fontSize: 9 }}>{remMin}:{remSec} left</span>
            </div>

            {/* Level badge */}
            {levelLabel && (
              <div style={{ marginTop: 8, paddingTop: 7, borderTop: '1px solid #ffffff18' }}>
                <span style={{ color: levelColor, fontSize: 9, fontWeight: 800 }}>{levelLabel}</span>
              </div>
            )}
          </div>
        )}

        {/* ── TOUCH PROTECTION POPUP ── hidden when floating button is hidden (top bar handles it) */}
        {popup === 'touch' && !hideFloatingButton && (
          <div
            style={{
              ...popupBase,
              background: 'rgba(8,12,28,0.96)',
              border: '1px solid #6366f155',
              padding: '12px 14px',
              minWidth: 200,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
              <span style={{ fontSize: 16 }}>🛡️</span>
              <span style={{ color: '#a5b4fc', fontSize: 11, fontWeight: 900, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Touch Protection
              </span>
            </div>
            <div style={{ color: '#94a3b8', fontSize: 10, marginBottom: 8, lineHeight: 1.5 }}>
              Topic par <span style={{ color: '#e2e8f0', fontWeight: 700 }}>10 sec</span> rukne ke baad<br />
              <span style={{ color: '#86efac', fontWeight: 700 }}>+2 reward</span> milega
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div
                style={{
                  flex: 1,
                  height: 4,
                  background: '#1e2030',
                  borderRadius: 99,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${Math.round(((10 - state.touchProtectionCooldownSec) / 10) * 100)}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #6366f1, #818cf8)',
                    borderRadius: 99,
                    transition: 'width 0.9s linear',
                  }}
                />
              </div>
              <span style={{ color: '#818cf8', fontWeight: 900, fontSize: 12, minWidth: 24, textAlign: 'right' }}>
                {fmt2(state.touchProtectionCooldownSec)}s
              </span>
            </div>
          </div>
        )}

        {/* ── WARNING POPUP ── */}
        {popup === 'warning' && (
          <div
            style={{
              ...popupBase,
              background:  state.isPaused ? 'rgba(69,10,10,0.95)' : 'rgba(67,20,7,0.95)',
              border:      `1px solid ${state.isPaused ? '#ef444455' : '#f9731655'}`,
              padding:     '10px 13px',
              minWidth:    182,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <span style={{ fontSize: 16, lineHeight: 1.3 }}>{state.isPaused ? '⏸️' : '⚠️'}</span>
              <div>
                <div style={{ color: '#fff', fontSize: 11, fontWeight: 900 }}>
                  {state.isPaused ? 'Score Paused' : 'Progress Required'}
                </div>
                <div style={{ color: '#cbd5e1', fontSize: 9, marginTop: 3 }}>
                  {state.isPaused
                    ? 'Aage padhein to resume hoga'
                    : '10% reading progress needed'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── FLOATING ICON BUTTON — hidden when moved to top bar ── */}
        {!hideFloatingButton && <button
          onClick={handleIconTap}
          aria-label="Reading score"
          style={{
            pointerEvents:   'auto',
            width:           40,
            height:          40,
            borderRadius:    '50%',
            border:          `1.5px solid ${levelColor}55`,
            background:      popup === 'info'
              ? levelColor
              : 'rgba(10,10,20,0.82)',
            backdropFilter:  'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'center',
            fontSize:        18,
            cursor:          'pointer',
            boxShadow:       popup === 'info'
              ? `0 0 12px ${levelColor}66`
              : '0 2px 12px rgba(0,0,0,0.4)',
            transition:      'all 0.2s ease',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          {modeIcon}
        </button>}
      </div>
    </>
  );
};
