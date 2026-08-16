/**
 * HomeToastNotification — 2-row top-bar overlay
 * Row 1 (top-bar height): Credits  — 10,663🪙 → +30 CR = 10,693🪙
 * Row 2 (below top-bar) : XP       — 3,570 XP → +10 XP = 3,580 XP
 *
 * Slides down from top, fully covers the app top-bar.
 * Auto-dismisses after DISPLAY_MS.
 */

import React, { useEffect, useState } from 'react';

export interface HomeToastData {
  xpBefore: number;
  xpEarned: number;
  xpAfter: number;
  creditsBefore: number;
  creditsEarned: number;
  creditsAfter: number;
}

interface Props {
  data: HomeToastData;
  onDismiss: () => void;
}

const DISPLAY_MS = 3500;

export const HomeToastNotification: React.FC<Props> = ({ data, onDismiss }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const showT = setTimeout(() => setVisible(true), 40);
    const hideT = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 350);
    }, DISPLAY_MS);
    return () => { clearTimeout(showT); clearTimeout(hideT); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showXp = data.xpEarned > 0;
  const showCr = data.creditsEarned > 0;
  if (!showXp && !showCr) return null;

  // Number formatter: 10693 → "10,693"
  const fmt = (n: number) => n.toLocaleString('en-IN');

  return (
    <div
      className="fixed left-0 right-0 z-[99999] pointer-events-none"
      style={{
        top: 0,
        background: 'var(--nst-top-bar-grad)',
        transform: visible ? 'translateY(0)' : 'translateY(-110%)',
        transition: 'transform 0.35s cubic-bezier(.34,1.4,.64,1)',
        boxShadow: '0 6px 24px rgba(0,0,0,0.45)',
      }}
    >
      {/* Safe area (notch) */}
      <div style={{ height: 'env(safe-area-inset-top, 0px)' }} />

      {/* ── Row 1 — Credits (same height as original top bar) ── */}
      {showCr && (
        <div
          className="flex items-center justify-center gap-[6px] px-4"
          style={{ height: 36 }}
        >
          <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            {fmt(data.creditsBefore)}🪙
          </span>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>→</span>
          <span style={{ color: '#34d399', fontSize: 13, fontWeight: 900, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            +{data.creditsEarned} CR
          </span>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>=</span>
          <span style={{ color: '#fff', fontSize: 13, fontWeight: 900, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            {fmt(data.creditsAfter)}🪙
          </span>
        </div>
      )}

      {/* Thin divider between rows */}
      {showCr && showXp && (
        <div style={{ height: 1, background: 'rgba(255,255,255,0.12)', marginLeft: 16, marginRight: 16 }} />
      )}

      {/* ── Row 2 — XP (extends below the top bar) ── */}
      {showXp && (
        <div
          className="flex items-center justify-center gap-[6px] px-4"
          style={{ height: 36 }}
        >
          <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            {fmt(data.xpBefore)} XP
          </span>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>→</span>
          <span style={{ color: '#a78bfa', fontSize: 13, fontWeight: 900, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            +{data.xpEarned} XP
          </span>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>=</span>
          <span style={{ color: '#fff', fontSize: 13, fontWeight: 900, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            {fmt(data.xpAfter)} XP
          </span>
        </div>
      )}

      {/* Progress bar */}
      <div className="h-[2px] relative overflow-hidden" style={{ background: 'rgba(255,255,255,0.12)' }}>
        <div
          className="h-full absolute left-0 top-0"
          style={{
            background: 'linear-gradient(90deg, #34d399, #a78bfa)',
            animation: `credit-toast-bar ${DISPLAY_MS}ms linear forwards`,
          }}
        />
      </div>
    </div>
  );
};
