import React, { useState, useEffect, useRef } from 'react';
import { User, SystemSettings } from '../types';
import { getLevelInfo, getNextLevelInfo, getLevelProgress } from '../utils/levelSystem';
import { Zap } from 'lucide-react';

interface TopBarRow2XpBarProps {
  user: User;
  settings?: SystemSettings;
  activeTab: string;
  onOpenScorePanel: () => void;
}

export const TopBarRow2XpBar: React.FC<TopBarRow2XpBarProps> = ({
  user,
  settings,
  activeTab,
  onOpenScorePanel,
}) => {
  const currentTotalScore = user.totalScore || 0;
  const currentLevelInfo = getLevelInfo(currentTotalScore, settings);
  const nextLevelInfo = getNextLevelInfo(currentTotalScore);
  const currentLevelPct = getLevelProgress(currentTotalScore);

  // Track previous score to detect live score increases
  const prevScoreRef = useRef<number>(currentTotalScore);
  const isInitialMount = useRef<boolean>(true);

  // Displayed percentage for smooth bar animation
  const [displayedPct, setDisplayedPct] = useState<number>(currentLevelPct);

  // Shimmer key to trigger the shine sweep animation
  const [shimmerKey, setShimmerKey] = useState<number>(0);

  // Calculation badge state: "1184 + 80 = 1264"
  const [xpGainAnim, setXpGainAnim] = useState<{
    oldScore: number;
    delta: number;
    newScore: number;
  } | null>(null);

  // 1. Shimmer shine sweep once when entering HOME tab
  useEffect(() => {
    if (activeTab === 'HOME') {
      const timer = setTimeout(() => {
        setShimmerKey(k => k + 1);
      }, 180);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [activeTab]);

  // 2. Animate bar and show calculation on XP increase
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      prevScoreRef.current = currentTotalScore;
      setDisplayedPct(currentLevelPct);
      return undefined;
    }

    const prev = prevScoreRef.current;
    if (currentTotalScore > prev && prev > 0) {
      const delta = currentTotalScore - prev;
      const oldPct = getLevelProgress(prev);
      const newPct = getLevelProgress(currentTotalScore);

      // Start from oldPct so bar smoothly fills forward
      setDisplayedPct(oldPct);

      setXpGainAnim({
        oldScore: prev,
        delta,
        newScore: currentTotalScore,
      });

      const animTimer = setTimeout(() => {
        setDisplayedPct(newPct);
        setShimmerKey(k => k + 1);
      }, 60);

      const hideTimer = setTimeout(() => {
        setXpGainAnim(null);
      }, 10000); // Show for exactly 10 seconds, then automatically switch to new total score

      prevScoreRef.current = currentTotalScore;
      return () => {
        clearTimeout(animTimer);
        clearTimeout(hideTimer);
      };
    } else {
      setDisplayedPct(currentLevelPct);
      prevScoreRef.current = currentTotalScore;
      return undefined;
    }
  }, [currentTotalScore, currentLevelPct]);

  const clampedPct = Math.min(100, Math.max(0, displayedPct));
  const levelColor = currentLevelInfo.color || '#38bdf8';
  const levelGlow = currentLevelInfo.glowColor || 'rgba(56,189,248,0.75)';

  return (
    <div className="flex items-center gap-1.5 flex-1 min-w-0 max-w-[280px] sm:max-w-[360px] mx-1">
      {/* Embedded CSS for shimmer sweep & pop animation */}
      <style>{`
        @keyframes row2ShimmerSweep {
          0% {
            transform: translateX(-150%) skewX(-20deg);
            opacity: 0;
          }
          20% {
            opacity: 0.9;
          }
          60% {
            opacity: 1;
          }
          85% {
            opacity: 0.9;
          }
          100% {
            transform: translateX(350%) skewX(-20deg);
            opacity: 0;
          }
        }
        @keyframes row2GainPop {
          0% {
            transform: scale(0.85);
            opacity: 0;
          }
          50% {
            transform: scale(1.05);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        @keyframes row2BinduPulse {
          0%, 100% {
            transform: translate(-50%, -50%) scale(1);
            box-shadow: 0 0 8px 2px ${levelGlow}, 0 0 3px #fff;
          }
          50% {
            transform: translate(-50%, -50%) scale(1.2);
            box-shadow: 0 0 12px 3px ${levelGlow}, 0 0 5px #fff;
          }
        }
      `}</style>

      {/* THE COMPACT XP STATUS BAR WITH HIGHLIGHTED BINDU */}
      <div
        id="topbar-row2-xp-track-container"
        onClick={onOpenScorePanel}
        className="relative flex-1 min-w-[50px] cursor-pointer py-1 group"
        title={`Level ${currentLevelInfo.level}: ${Math.round(clampedPct)}% (${currentTotalScore.toLocaleString('en-IN')} XP)`}
      >
        {/* Track bar */}
        <div className="relative w-full h-1.5 sm:h-2 rounded-full overflow-hidden bg-white/20 border border-white/25">
          {/* Filled portion */}
          <div
            className="h-full rounded-full relative"
            style={{
              width: `${clampedPct}%`,
              background: `linear-gradient(90deg, ${levelColor}, #818cf8)`,
              boxShadow: `0 0 6px ${levelGlow}`,
              transition: 'width 1.2s cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          >
            {/* Shimmer light sweep — sweeps on Home tab land or on XP gain */}
            <div
              key={shimmerKey}
              className="absolute inset-0 pointer-events-none"
              style={{
                width: '60%',
                background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.95) 50%, transparent 100%)',
                animation: shimmerKey > 0 ? 'row2ShimmerSweep 1.2s cubic-bezier(0.4, 0, 0.2, 1) forwards' : 'none',
              }}
            />
          </div>
        </div>

        {/* HIGHLIGHTED BINDU (GLOWING INDICATOR DOT) AT PROGRESS ENDPOINT */}
        <div
          id="topbar-row2-xp-bindu"
          className="absolute top-1/2 pointer-events-none z-10"
          style={{
            left: `${clampedPct}%`,
            transition: 'left 1.2s cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          <div
            className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-white border border-amber-300 pointer-events-none"
            style={{
              animation: 'row2BinduPulse 2s infinite ease-in-out',
            }}
          />
        </div>
      </div>

      {/* TOTAL XP BUTTON (FULL DETAILS, NEVER 1.1K) OR XP GAIN ANIMATION BADGE */}
      {xpGainAnim ? (
        /* Animated calculation badge: 1184 + 80 = 1264 */
        <div
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 border select-none"
          style={{
            animation: 'row2GainPop 0.35s ease-out forwards',
            background: 'linear-gradient(135deg, #f59e0b, #ea580c)',
            borderColor: '#fde047',
            color: '#ffffff',
            boxShadow: '0 1px 8px rgba(245, 158, 11, 0.45)',
          }}
        >
          <Zap size={10} className="text-yellow-200 fill-yellow-200 animate-pulse" />
          <span className="tabular-nums font-bold text-amber-100">{xpGainAnim.oldScore.toLocaleString('en-IN')}</span>
          <span className="text-yellow-300 font-bold">+{xpGainAnim.delta.toLocaleString('en-IN')}</span>
          <span className="text-amber-200 font-bold">=</span>
          <span className="tabular-nums font-black text-white underline decoration-yellow-300">
            {xpGainAnim.newScore.toLocaleString('en-IN')}
          </span>
        </div>
      ) : (
        /* Total XP button in full details (e.g. 1,184 XP) */
        <button
          id="topbar-row2-total-xp-btn"
          onClick={onOpenScorePanel}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full active:scale-95 transition-all shrink-0 cursor-pointer group select-none"
          style={{
            background: 'rgba(56, 189, 248, 0.18)',
            border: '1px solid rgba(56, 189, 248, 0.38)',
            boxShadow: '0 1px 6px rgba(56, 189, 248, 0.2)',
          }}
          title="Total XP Details — Tap karke Level details dekhein"
        >
          <span className="text-[10px] leading-none select-none">🏆</span>
          <span className="font-black text-[10.5px] tabular-nums text-sky-200 group-hover:text-sky-100">
            {currentTotalScore.toLocaleString('en-IN')} XP
          </span>
        </button>
      )}
    </div>
  );
};
