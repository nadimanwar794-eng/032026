import React, { useState, useEffect, useRef } from 'react';
import { User, SystemSettings } from '../types';
import { getLevelInfo, getNextLevelInfo, getLevelProgress } from '../utils/levelSystem';
import { Zap } from 'lucide-react';

interface TopBarRow2XpBarProps {
  user: User;
  settings?: SystemSettings;
  activeTab: string;
  onOpenScorePanel: () => void;
  levelAnimOff?: boolean;
}

export const TopBarRow2XpBar: React.FC<TopBarRow2XpBarProps> = ({
  user,
  settings,
  activeTab,
  onOpenScorePanel,
  levelAnimOff: propLevelAnimOff,
}) => {
  const isLevelAnimDisabled = propLevelAnimOff ?? (() => {
    try { return localStorage.getItem('nst_level_anim_off') === '1'; } catch { return false; }
  })();
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

  // Level-up celebration state (e.g. Lv 2)
  const [levelUpAnim, setLevelUpAnim] = useState<number | null>(null);

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

  // 2. Animate bar on score increase and celebrate if level increased
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      prevScoreRef.current = currentTotalScore;
      setDisplayedPct(currentLevelPct);
      return undefined;
    }

    const prev = prevScoreRef.current;
    if (currentTotalScore > prev && prev > 0) {
      const oldLevel = getLevelInfo(prev, settings).level;
      const newLevel = getLevelInfo(currentTotalScore, settings).level;
      const oldPct = getLevelProgress(prev);
      const newPct = getLevelProgress(currentTotalScore);

      // Start from oldPct so bar smoothly fills forward
      setDisplayedPct(oldPct);

      let hideTimer: ReturnType<typeof setTimeout> | undefined;
      if (newLevel > oldLevel) {
        setLevelUpAnim(newLevel);
        hideTimer = setTimeout(() => {
          setLevelUpAnim(null);
        }, 5000);
      }

      const animTimer = setTimeout(() => {
        setDisplayedPct(newPct);
        setShimmerKey(k => k + 1);
      }, 60);

      prevScoreRef.current = currentTotalScore;
      return () => {
        clearTimeout(animTimer);
        if (hideTimer) clearTimeout(hideTimer);
      };
    } else {
      setDisplayedPct(currentLevelPct);
      prevScoreRef.current = currentTotalScore;
      return undefined;
    }
  }, [currentTotalScore, currentLevelPct, settings]);

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
            transform: scale(1);
            box-shadow: 0 0 8px 2px ${levelGlow}, 0 0 3px #fff;
          }
          50% {
            transform: scale(1.2);
            box-shadow: 0 0 12px 3px ${levelGlow}, 0 0 5px #fff;
          }
        }
      `}</style>

      {/* THE COMPACT XP STATUS BAR WITH HIGHLIGHTED BINDU */}
      <div
        id="topbar-row2-xp-track-container"
        onClick={onOpenScorePanel}
        className="relative flex-1 min-w-[50px] cursor-pointer py-1 group"
        title={`Level ${currentLevelInfo.level} (${currentLevelInfo.label}): ${Math.round(clampedPct)}%`}
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
            {!isLevelAnimDisabled && (
              <div
                key={shimmerKey}
                className="absolute inset-0 pointer-events-none"
                style={{
                  width: '60%',
                  background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.95) 50%, transparent 100%)',
                  animation: shimmerKey > 0 ? 'row2ShimmerSweep 1.2s cubic-bezier(0.4, 0, 0.2, 1) forwards' : 'none',
                }}
              />
            )}
          </div>
        </div>

        {/* HIGHLIGHTED BINDU (GLOWING INDICATOR DOT) AT PROGRESS ENDPOINT */}
        <div
          id="topbar-row2-xp-bindu"
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10"
          style={{
            left: `${clampedPct}%`,
            transition: 'left 1.2s cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          <div
            className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-white border border-amber-300 pointer-events-none"
            style={{
              animation: isLevelAnimDisabled ? 'none' : 'row2BinduPulse 2s infinite ease-in-out',
              boxShadow: isLevelAnimDisabled ? `0 0 4px ${levelGlow}` : undefined,
            }}
          />
        </div>
      </div>

      {/* LEVEL DISPLAY BUTTON (e.g. Lv 1) OR LEVEL UP ANIMATION BADGE */}
      {levelUpAnim ? (
        /* Animated level-up celebration badge */
        <button
          id="topbar-row2-total-xp-btn"
          onClick={onOpenScorePanel}
          className="inline-flex items-center gap-0.5 px-1 py-0.5 select-none active:scale-95 cursor-pointer"
          style={{
            animation: 'row2GainPop 0.35s ease-out forwards',
          }}
          title={`Level Up! Level ${levelUpAnim} — Tap karke details dekhein`}
        >
          <Zap size={10} className="text-yellow-300 fill-yellow-300 animate-pulse" />
          <span className="font-black text-[11px] text-amber-300 whitespace-nowrap">Lv {levelUpAnim}</span>
        </button>
      ) : (
        /* Level button showing Lv {level} (e.g. Lv 1) - no background */
        <button
          id="topbar-row2-total-xp-btn"
          onClick={onOpenScorePanel}
          className="inline-flex items-center gap-0.5 px-1 py-0.5 active:scale-95 transition-all shrink-0 cursor-pointer group select-none"
          title={`Level ${currentLevelInfo.level} (${currentLevelInfo.label}) — Tap karke Level details dekhein`}
        >
          <span className="font-black text-[11px] tabular-nums text-sky-200 group-hover:text-sky-100 whitespace-nowrap tracking-wide">
            Lv {currentLevelInfo.level}
          </span>
        </button>
      )}
    </div>
  );
};
