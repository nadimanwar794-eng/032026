import React, { useState } from 'react';
import { Crown, Zap, Sparkles } from 'lucide-react';
import {
  LEVEL_INFO,
  getLevelInfo,
  getLevelProgress,
  getLevelSubTier,
  isLevel15DiamondGammaV,
  type LevelSubTier,
} from '../utils/levelSystem';
import { User } from '../types';
import { LevelShowcaseModal } from './LevelShowcaseModal';

export interface UserLevelBadgeProps {
  level?: number;
  score?: number;
  user?: Partial<User> | null;
  subTier?: LevelSubTier;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showSubTier?: boolean;
  compact?: boolean;
  className?: string;
  onClick?: () => void;
  inspectable?: boolean;
}

/**
 * Animated Level Badge for students.
 * Unique per level (Level 1–15) with their level's color animation.
 * Progressively more premium on level up.
 * Level 15 is ultra-premium, and Level 15 (Absolute Legend) Diamond Gamma V
 * is the supreme pinnacle with rainbow crystal diamond radiance, 100 💎 + 1000 🪙 grand stature!
 */
export const UserLevelBadge: React.FC<UserLevelBadgeProps> = ({
  level: propLevel,
  score: propScore,
  user,
  subTier: propSubTier,
  size = 'sm',
  showSubTier = true,
  compact = false,
  className = '',
  onClick,
  inspectable = true,
}) => {
  const [isInspectOpen, setIsInspectOpen] = useState(false);
  const effectiveScore = propScore ?? (user?.role === 'ADMIN' || user?.role === 'SUB_ADMIN' ? 999999999 : (user?.totalScore || 0));
  const levelInfo = getLevelInfo(effectiveScore);
  const currentLevel = propLevel ?? levelInfo.level;
  const progressPct = getLevelProgress(effectiveScore);
  const currentSubTier = propSubTier ?? getLevelSubTier(currentLevel, progressPct);

  const isDiamondGammaV = isLevel15DiamondGammaV(effectiveScore) || (
    currentLevel === 15 &&
    currentSubTier.metal === 'Diamond' &&
    currentSubTier.greek === 'Gamma' &&
    currentSubTier.roman === 'V'
  );

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClick) {
      onClick();
    } else if (inspectable) {
      setIsInspectOpen(true);
    }
  };

  // Size styling tokens
  const sizeStyles = {
    xs: {
      pad: 'px-1.5 py-0.5',
      text: 'text-[7.5px]',
      icon: 'text-[9px]',
      sparkleSize: 8,
    },
    sm: {
      pad: 'px-2 py-0.5',
      text: 'text-[8.5px]',
      icon: 'text-[10.5px]',
      sparkleSize: 9.5,
    },
    md: {
      pad: 'px-2.5 py-1',
      text: 'text-[9.5px]',
      icon: 'text-[12px]',
      sparkleSize: 11,
    },
    lg: {
      pad: 'px-3 py-1.5',
      text: 'text-[11px]',
      icon: 'text-[14px]',
      sparkleSize: 13,
    },
  }[size];

  // Determine progressive tier effects based on level
  let animClass = '';
  if (currentLevel >= 11) {
    animClass = 'level-badge-cosmic-active';
  } else if (currentLevel >= 7) {
    animClass = 'level-badge-pulse-active';
  }

  const bgStyle = {
    background:
      currentLevel >= 11
        ? `linear-gradient(135deg, ${levelInfo.color}35 0%, rgba(15,23,42,0.85) 100%)`
        : currentLevel >= 7
        ? `linear-gradient(135deg, ${levelInfo.color}25 0%, rgba(15,23,42,0.8) 100%)`
        : `${levelInfo.color}18`,
    borderColor: `${levelInfo.color}65`,
    color: levelInfo.color,
    '--lvl-color': levelInfo.color,
    '--lvl-border': `${levelInfo.color}80`,
    '--lvl-glow': levelInfo.glowColor,
  } as React.CSSProperties;

  return (
    <div
      onClick={handleClick}
        title={
          isDiamondGammaV
            ? '👑 LEVEL 15 (ABSOLUTE LEGEND) Diamond Gamma V — Pinnacle Champion (100 💎 + 1000 🪙 Claimed)'
            : `Level ${currentLevel} (${levelInfo.label}) · ${currentSubTier.fullTitle} (Click karke Rank Card dekhein)`
        }
        className={`user-level-badge-base rounded-full ${
          isDiamondGammaV
            ? 'level-badge-pinnacle-diamond-v shadow-lg'
            : currentLevel >= 15
            ? 'level-badge-l15-apex border border-violet-400/70 shadow-md'
            : `border ${animClass}`
        } ${sizeStyles.pad} ${className} cursor-pointer active:scale-95`}
        style={
          isDiamondGammaV
            ? { boxShadow: '0 0 16px rgba(192, 132, 252, 0.75), 0 0 30px rgba(56, 189, 248, 0.45)' }
            : currentLevel >= 15
            ? ({
                '--lvl-color': '#a5f3fc',
                '--lvl-border': 'rgba(192, 132, 252, 0.8)',
                '--lvl-glow': 'rgba(192, 132, 252, 0.5)',
              } as React.CSSProperties)
            : bgStyle
        }
      >
        {isDiamondGammaV ? (
          <>
            <span className="pinnacle-sparkle-icon">👑</span>
            <span className="pinnacle-sparkle-icon text-[11px]">💎</span>
            <span
              className={`${sizeStyles.text} font-black tracking-wider bg-gradient-to-r from-cyan-200 via-purple-200 to-amber-200 bg-clip-text text-transparent`}
            >
              {compact ? 'L15 γ-V' : 'ABSOLUTE LEGEND · γ-V'}
            </span>
            <Sparkles size={sizeStyles.sparkleSize} className="text-amber-300 animate-pulse shrink-0" />
          </>
        ) : currentLevel >= 15 ? (
          <>
            <span className="level-badge-shimmer-layer" />
            <span className={sizeStyles.icon}>{levelInfo.emoji}</span>
            <span className={`${sizeStyles.text} font-black text-cyan-100 tracking-wide`}>
              {compact
                ? `L15 ${showSubTier ? currentSubTier.shortBadgeText : ''}`
                : `L15 ${levelInfo.label}${showSubTier ? ` · ${currentSubTier.badgeText}` : ''}`}
            </span>
          </>
        ) : (
          <>
            {/* Light sweep shimmer for level 4 and above */}
            {currentLevel >= 4 && <span className="level-badge-shimmer-layer" />}
            <span className={sizeStyles.icon}>{levelInfo.emoji}</span>
            <span className={`${sizeStyles.text} font-black leading-none drop-shadow-xs`}>
              {compact ? (
                `L${currentLevel} ${showSubTier ? currentSubTier.shortBadgeText : ''}`
              ) : (
                <>
                  <span>L{currentLevel}</span>
                  <span className="opacity-90 ml-0.5">
                    {showSubTier && currentSubTier.shortBadgeText ? currentSubTier.shortBadgeText : levelInfo.label}
                  </span>
                </>
              )}
            </span>
          </>
        )}

        {isInspectOpen && (
          <LevelShowcaseModal
            user={user || {}}
            score={effectiveScore}
            isOpen={isInspectOpen}
            onClose={() => setIsInspectOpen(false)}
          />
        )}
      </div>
  );
};

export interface UserNameTierBadgeProps {
  user?: Partial<User> | null;
  tier?: 'FREE' | 'BASIC' | 'ULTRA';
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

/**
 * Name Badge: exactly 3 types (Free, Basic, Ultra) as specified by user mandate:
 * "name badge to free basic ultra bas 3 type ke honge"
 */
export const UserNameTierBadge: React.FC<UserNameTierBadgeProps> = ({
  user,
  tier: propTier,
  size = 'xs',
  className = '',
}) => {
  const isPremium = user?.isPremium || false;
  const subLevel = user?.subscriptionLevel || user?.subscriptionTier || '';
  const resolvedTier: 'FREE' | 'BASIC' | 'ULTRA' =
    propTier || (isPremium && subLevel === 'ULTRA' ? 'ULTRA' : isPremium && subLevel === 'BASIC' ? 'BASIC' : 'FREE');

  const sizeCls = size === 'xs' ? 'text-[7.5px] px-1.5 py-0.2' : size === 'sm' ? 'text-[8.5px] px-2 py-0.5' : 'text-[9.5px] px-2.5 py-0.5';

  if (resolvedTier === 'ULTRA') {
    return (
      <span
        title="Ultra Plan Member"
        className={`tier-badge-ultra rounded-full font-black inline-flex items-center gap-0.5 uppercase tracking-wider ${sizeCls} ${className}`}
      >
        <Crown size={size === 'xs' ? 8.5 : 10} className="fill-amber-300 text-amber-400 shrink-0" />
        <span>ULTRA</span>
      </span>
    );
  }

  if (resolvedTier === 'BASIC') {
    return (
      <span
        title="Basic Plan Member"
        className={`tier-badge-basic rounded-full font-black inline-flex items-center gap-0.5 uppercase tracking-wider ${sizeCls} ${className}`}
      >
        <Zap size={size === 'xs' ? 8.5 : 10} className="fill-sky-300 text-sky-400 shrink-0" />
        <span>BASIC</span>
      </span>
    );
  }

  return (
    <span
      title="Free Plan Member"
      className={`tier-badge-free rounded-full font-bold inline-flex items-center uppercase tracking-wider ${sizeCls} ${className}`}
    >
      FREE
    </span>
  );
};

export interface UserBadgeGroupProps {
  user: Partial<User> | null;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showTier?: boolean;
  showLevel?: boolean;
  className?: string;
  nameClassName?: string;
  onClickLevel?: () => void;
}

/**
 * Renders user's name with both their Name Badge (Free/Basic/Ultra - 3 types)
 * AND their animated Level Badge (unique for every level, animated in level color).
 */
export const UserBadgeGroup: React.FC<UserBadgeGroupProps> = ({
  user,
  name,
  size = 'sm',
  showTier = true,
  showLevel = true,
  className = '',
  nameClassName = '',
  onClickLevel,
}) => {
  const displayName = name || user?.name || 'Student';

  return (
    <div className={`inline-flex items-center gap-1.5 flex-wrap ${className}`}>
      <span className={`font-black text-white ${nameClassName}`}>
        {displayName}
      </span>
      {showTier && <UserNameTierBadge user={user} size={size === 'lg' ? 'sm' : 'xs'} />}
      {showLevel && (
        <UserLevelBadge
          user={user}
          size={size === 'lg' ? 'md' : size === 'md' ? 'sm' : 'xs'}
          onClick={onClickLevel}
        />
      )}
    </div>
  );
};
