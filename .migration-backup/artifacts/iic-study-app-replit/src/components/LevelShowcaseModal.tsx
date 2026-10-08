import React, { useEffect, useState } from 'react';
import { X, Sparkles, Trophy, Award, ArrowRight, Share2, Check, ShieldCheck, Zap } from 'lucide-react';
import { User } from '../types';
import {
  LEVEL_INFO,
  getLevelInfo,
  getLevelProgress,
  getLevelSubTier,
  getNextLevelInfo,
  isLevel15DiamondGammaV,
  formatScoreNumber,
  formatScoreCompact,
} from '../utils/levelSystem';
import { RankInsignia } from './RankInsignia';
import { UserNameTierBadge, UserLevelBadge } from './UserLevelBadge';

interface LevelShowcaseModalProps {
  user: Partial<User> | null;
  score?: number;
  isOpen: boolean;
  onClose: () => void;
}

export const playRankChime = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'triangle';
    osc2.type = 'sine';

    // Maj 7th chord arpeggio
    osc1.frequency.setValueAtTime(523.25, now); // C5
    osc1.frequency.exponentialRampToValueAtTime(659.25, now + 0.1); // E5
    osc1.frequency.exponentialRampToValueAtTime(783.99, now + 0.2); // G5
    osc1.frequency.exponentialRampToValueAtTime(1046.5, now + 0.3); // C6

    osc2.frequency.setValueAtTime(1046.5, now);
    osc2.frequency.setValueAtTime(1318.5, now + 0.15);

    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.65);
    osc2.stop(now + 0.65);
  } catch {}
};

export const LevelShowcaseModal: React.FC<LevelShowcaseModalProps> = ({
  user,
  score: propScore,
  isOpen,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      playRankChime();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const effectiveScore = propScore ?? (user?.role === 'ADMIN' || user?.role === 'SUB_ADMIN' ? 999999999 : (user?.totalScore || 0));
  const levelInfo = getLevelInfo(effectiveScore);
  const nextLvl = getNextLevelInfo(effectiveScore);
  const progressPct = getLevelProgress(effectiveScore);
  const subTier = getLevelSubTier(levelInfo.level, progressPct);
  const isPinnacle = isLevel15DiamondGammaV(effectiveScore);

  const ptsToNext = nextLvl ? Math.max(0, nextLvl.minScore - effectiveScore) : 0;

  const handleCopyRank = () => {
    const text = `🏆 IIC STUDY ACADEMY RANK ACHIEVED!
👤 Student: ${user?.name || 'Student'}
🆔 Student ID: ${user?.displayId || user?.id || 'N/A'}
🎖️ Rank: Level ${levelInfo.level} · ${subTier.fullTitle}
⭐ Total XP: ${formatScoreNumber(effectiveScore)} pts
💎 Plan: ${user?.isPremium ? (user?.subscriptionLevel || 'PREMIUM') : 'FREE'}
${isPinnacle ? '👑 PINNACLE CHAMPION: Level 15 (Absolute Legend) Diamond Gamma V Unlocked (100 💎 + 1000 🪙)!' : ''}`;

    try {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {}
  };

  return (
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative max-w-md w-full rounded-3xl overflow-hidden shadow-2xl border border-white/20 transition-all select-none"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: isPinnacle
            ? 'linear-gradient(145deg, #0b0f1a 0%, #1a1638 50%, #0d1222 100%)'
            : `linear-gradient(145deg, #0d111d 0%, #151a2d 50%, #0a0d16 100%)`,
          boxShadow: isPinnacle
            ? '0 20px 60px rgba(192, 132, 252, 0.4), inset 0 1px 0 rgba(255,255,255,0.2)'
            : `0 20px 50px rgba(0,0,0,0.7), 0 0 30px ${levelInfo.glowColor}, inset 0 1px 0 rgba(255,255,255,0.15)`,
        }}
      >
        {/* Top Animated Metallic Ribbon */}
        <div
          className="h-1.5 w-full"
          style={{
            background: isPinnacle
              ? 'linear-gradient(90deg, #38bdf8, #c084fc, #fbbf24, #f43f5e, #38bdf8)'
              : `linear-gradient(90deg, ${levelInfo.color}, #38bdf8, #fbbf24, ${levelInfo.color})`,
          }}
        />

        {/* Ambient Halo behind Crest */}
        <div
          className="absolute top-12 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full blur-3xl pointer-events-none opacity-40"
          style={{
            background: isPinnacle
              ? 'radial-gradient(circle, #c084fc 0%, #38bdf8 50%, transparent 70%)'
              : levelInfo.color,
          }}
        />

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-90 text-white/80 hover:text-white flex items-center justify-center transition-all cursor-pointer z-20 border border-white/10"
        >
          <X size={15} />
        </button>

        <div className="p-6 pt-5 flex flex-col items-center text-center">
          {/* Rank Insignia */}
          <div className="my-2">
            <RankInsignia
              level={levelInfo.level}
              isPinnacleDiamondV={isPinnacle}
              size={80}
            />
          </div>

          {/* Student Name & Tier Badges */}
          <div className="mt-1 flex items-center gap-2 flex-wrap justify-center">
            <h3 className="text-lg font-black text-white tracking-tight">
              {user?.name || 'Student'}
            </h3>
            <UserNameTierBadge user={user} size="xs" />
          </div>

          <div className="mt-1">
            <UserLevelBadge user={user} size="sm" score={effectiveScore} inspectable={false} />
          </div>

          {/* Full Rank Title & Subtitle */}
          <div className="mt-3">
            <h2 className="text-xl font-black tracking-wide text-white">
              {subTier.fullTitle}
            </h2>
            <p className="text-[11px] font-semibold text-slate-400 mt-0.5">
              {isPinnacle
                ? '👑 THE PINNACLE OF IIC STUDY PLATFORM (100 💎 + 1000 🪙)'
                : `${levelInfo.label} Division · Tier ${subTier.roman}`}
            </p>
          </div>

          {/* XP Progress Card */}
          <div className="w-full mt-4 bg-white/[0.04] border border-white/10 rounded-2xl p-3.5">
            <div className="flex items-center justify-between text-xs font-black mb-1.5">
              <span className="text-slate-300">Experience (XP)</span>
              <span className="text-amber-300 font-mono">{formatScoreNumber(effectiveScore)} pts</span>
            </div>

            {/* Glowing Progress Track */}
            <div className="w-full h-2.5 bg-black/50 rounded-full overflow-hidden p-0.5 border border-white/10">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${progressPct}%`,
                  background: isPinnacle
                    ? 'linear-gradient(90deg, #38bdf8, #c084fc, #fbbf24)'
                    : `linear-gradient(90deg, ${levelInfo.color}, #38bdf8)`,
                  boxShadow: `0 0 10px ${levelInfo.glowColor}`,
                }}
              />
            </div>

            <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2 font-mono">
              <span>{progressPct}% Completed</span>
              <span>
                {nextLvl
                  ? `${formatScoreCompact(ptsToNext)} pts to Level ${nextLvl.level}`
                  : 'Max Level Reached 👑'}
              </span>
            </div>
          </div>

          {/* Perks Grid */}
          <div className="w-full grid grid-cols-3 gap-2 mt-3 text-left">
            {/* 1. Store Discount */}
            <div className="bg-white/[0.03] border border-white/10 rounded-xl p-2.5">
              <span className="text-[8px] font-black uppercase tracking-wider text-slate-400 block">
                Store Discount
              </span>
              <span className="text-xs font-black text-emerald-400 font-mono mt-0.5 block">
                {levelInfo.discount > 0 ? `${levelInfo.discount}% OFF` : '0%'}
              </span>
            </div>

            {/* 2. Sub-Rank Reward */}
            <div className="bg-white/[0.03] border border-white/10 rounded-xl p-2.5">
              <span className="text-[8px] font-black uppercase tracking-wider text-slate-400 block">
                Rank Reward
              </span>
              <span className="text-xs font-black text-amber-300 font-mono mt-0.5 block">
                {isPinnacle ? '100 💎 + 1k 🪙' : '+50 Coins 🪙'}
              </span>
            </div>

            {/* 3. Daily Bonus */}
            <div className="bg-white/[0.03] border border-white/10 rounded-xl p-2.5">
              <span className="text-[8px] font-black uppercase tracking-wider text-slate-400 block">
                Login Bonus
              </span>
              <span className="text-xs font-black text-cyan-300 font-mono mt-0.5 block">
                +{levelInfo.coinReward || 20} CR
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="w-full flex items-center gap-2 mt-4 pt-1">
            <button
              type="button"
              onClick={handleCopyRank}
              className="flex-1 py-2.5 px-3 rounded-xl text-xs font-black text-white bg-white/10 hover:bg-white/15 border border-white/15 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {copied ? <Check size={14} className="text-emerald-400" /> : <Share2 size={14} />}
              <span>{copied ? 'Copied!' : 'Share Card'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
