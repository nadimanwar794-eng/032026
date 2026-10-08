import React from 'react';
import { User } from '../types';
import {
  LEVEL_INFO,
  getLevelInfo,
  getLevelProgress,
  getMaxReadingSeconds,
  getLevelDailyLimitsWithOverride,
  getLevelSubTier,
  getAllSubTiersForLevel,
  ROMAN_STEPS,
  SUB_TIER_COIN_REWARD,
  formatScoreNumber,
  formatScoreCompact,
  getAllGlobalSubTiers,
  type GlobalSubTierRow,
  isLevel15DiamondGammaV,
  LEVEL_15_DIAMOND_GAMMA_V_COINS,
  LEVEL_15_DIAMOND_GAMMA_V_DIAMONDS,
} from '../utils/levelSystem';
import { UserLevelBadge, UserNameTierBadge, UserBadgeGroup } from './UserLevelBadge';
import { RankInsignia } from './RankInsignia';
import { LevelShowcaseModal } from './LevelShowcaseModal';

interface StudentLevelPageProps {
  user: User;
  settings?: any;
  onClose: () => void;
}

const EVENT_MIN_LEVELS = {
  specialDiscount: 1,
  creditBonus: 1,
  dailyLimitBoost: 3,
  scoreBoost: 5,
  themeStudio: 7,
  creditFree: 8,
  globalFreeAccess: 10,
} as const;

const animLabels = [
  'None',
  'Subtle Shimmer ✨',
  'Glow Effect 🌟',
  'Strong Glow + Sparks 💫',
  'Legendary Animation 🌈',
];

export const StudentLevelPage: React.FC<StudentLevelPageProps> = ({
  user,
  settings,
  onClose,
}) => {
  const [expandedSubLevelTable, setExpandedSubLevelTable] = React.useState<number | null>(null);
  const [viewMode, setViewMode] = React.useState<'LEVELS' | 'ALL_SUB_LEVELS'>('LEVELS');
  const [subLevelSearch, setSubLevelSearch] = React.useState('');
  const [filterLevel, setFilterLevel] = React.useState<number | 'ALL'>('ALL');
  const [filterStatus, setFilterStatus] = React.useState<'ALL' | 'UNLOCKED' | 'LOCKED' | 'CURRENT'>('ALL');
  const [levelSubMode, setLevelSubMode] = React.useState<Record<number, 'ROW' | 'GRID'>>({});
  const [showShowcaseModal, setShowShowcaseModal] = React.useState(false);
  const [expandedLevels, setExpandedLevels] = React.useState<Record<number, boolean>>(() => ({
    1: true,
  }));

  const toggleLevelCard = (lvlNum: number) => {
    setExpandedLevels((prev) => ({
      ...prev,
      [lvlNum]: !prev[lvlNum],
    }));
  };

  const totalScore =
    user.role === 'ADMIN' || user.role === 'SUB_ADMIN'
      ? 999999999
      : user.totalScore || 0;
  const userLvl = getLevelInfo(totalScore, settings);
  const nextUserLvl = LEVEL_INFO[userLvl.level] ?? null;
  const progressPct = getLevelProgress(totalScore);
  const userSubTier = getLevelSubTier(userLvl.level, progressPct);

  const allGlobalSubTiers = React.useMemo(() => getAllGlobalSubTiers(), []);
  const currentUserGlobalIdx = React.useMemo(() => {
    const found = allGlobalSubTiers.findIndex((st) => totalScore < st.maxScore);
    return found >= 0 ? allGlobalSubTiers[found].globalIndex : allGlobalSubTiers.length;
  }, [allGlobalSubTiers, totalScore]);
  const unlockedSubLevelsCount = React.useMemo(() => {
    return allGlobalSubTiers.filter((st) => totalScore >= st.minScore).length;
  }, [allGlobalSubTiers, totalScore]);

  const scrollToCurrentLevel = React.useCallback(() => {
    const card = document.getElementById(`level-card-${userLvl.level}`);
    const container = document.getElementById('level-roadmap-column');
    if (card && container) {
      const offsetTop = card.offsetTop - 16;
      container.scrollTo({ top: Math.max(0, offsetTop), behavior: 'smooth' });
    } else if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [userLvl.level]);

  React.useEffect(() => {
    const t1 = setTimeout(scrollToCurrentLevel, 120);
    const t2 = setTimeout(scrollToCurrentLevel, 400);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [scrollToCurrentLevel]);

  const lvlFrom = userLvl.minScore;
  const lvlTo = nextUserLvl ? nextUserLvl.minScore : null;
  const ptsLeft = lvlTo ? Math.max(0, lvlTo - totalScore) : 0;

  const currentUserBonusCredits =
    getLevelDailyLimitsWithOverride(userLvl.level, settings)?.bonusLoginCredits ?? 0;
  const currentReadingSecs = getMaxReadingSeconds(userLvl.level);

  // Current Level Progress Bonus / Multiplier description
  const currentBonusDesc = (() => {
    if (userLvl.level >= 14) return 'Daily Limit Multiplier: Up to 500%';
    if (userLvl.level === 13) return 'Daily Limit Multiplier: Up to 400%';
    if (userLvl.level === 12) return 'Daily Limit Multiplier: Up to 320%';
    if (userLvl.level === 11) return 'Daily Limit Multiplier: Up to 250%';
    if (userLvl.level === 10) return 'Daily Limit Multiplier: Up to 200%';
    if (userLvl.level === 9) return 'Daily Limit Multiplier: Up to 100%';
    if (userLvl.level >= 8) return 'Daily Progress Bonus: Up to 45%';
    if (userLvl.level === 7) return 'Daily Progress Bonus: Up to 38%';
    if (userLvl.level === 6) return 'Daily Progress Bonus: Up to 30%';
    if (userLvl.level === 5) return 'Daily Progress Bonus: Up to 22%';
    if (userLvl.level === 4) return 'Daily Progress Bonus: Up to 15%';
    return 'Progress Bonus: Level 4 se shuru';
  })();

  // Student Profile & Current Level Perks component (used in right sidebar on desktop, or at top on mobile)
  const renderStudentProfileAndFeatures = () => (
    <div className="space-y-4">
      {/* ── 2. STUDENT CURRENT LEVEL & UNLOCKED FEATURES ── */}
      <div
        id="student-current-features-card"
        className="rounded-3xl p-4 md:p-5 border border-white/15 relative overflow-hidden shadow-2xl backdrop-blur-md"
        style={{
          borderColor: `${userLvl.color}50`,
          backgroundColor: '#0e1424',
          backgroundImage: `linear-gradient(145deg, ${userLvl.color}20 0%, #121727 60%, #0a0d16 100%)`,
          boxShadow: `0 10px 30px -10px ${userLvl.color}25, 0 0 0 1px ${userLvl.color}20`,
        }}
      >
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-white/10 flex-wrap">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">{userLvl.emoji}</span>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-black text-white">
                  Level {userLvl.level} · {userLvl.label}
                </h4>
                <span
                  className="text-[9px] font-black px-2 py-0.5 rounded-full"
                  style={{ background: `${userLvl.color}30`, color: userLvl.color }}
                >
                  Current Level
                </span>
              </div>
              <p className="text-[10px] text-slate-400">
                Score:{' '}
                <span className="font-black" style={{ color: userLvl.color }}>
                  {totalScore.toLocaleString('en-IN')} pts
                </span>
              </p>
            </div>
          </div>

          {/* Sub-Tier Pill & 3D Rank button */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowShowcaseModal(true)}
              className="px-2.5 py-1 rounded-xl bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/40 text-amber-200 text-[10px] font-black flex items-center gap-1 transition-all active:scale-95 cursor-pointer shadow-sm"
              title="Open Holographic 3D Rank Card"
            >
              <RankInsignia level={userLvl.level} isPinnacleDiamondV={isLevel15DiamondGammaV(totalScore)} size={15} />
              <span>3D Rank</span>
              <span>✨</span>
            </button>

            <div
              className="flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black shadow-md border"
              style={{
                background: userSubTier.bgColor,
                color: userSubTier.color,
                borderColor: userSubTier.borderColor,
                boxShadow: `0 0 12px ${userSubTier.glowColor}`,
              }}
            >
              <span>{userSubTier.metalEmoji || (userSubTier.stageType === 'GREEK' ? '🏛️' : '🎖️')}</span>
              <span>{userSubTier.badgeText}</span>
            </div>
          </div>
        </div>

        {/* ── Sub-Tier Active Status & Progression Box ── */}
        <div
          className="mt-3 rounded-2xl p-3 border transition-all"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)',
            borderColor: `${userSubTier.borderColor}`,
          }}
        >
          <div className="flex items-center justify-between text-[10px] font-black mb-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-xs">{userSubTier.metalEmoji || (userSubTier.stageType === 'GREEK' ? '🏛️' : '🎖️')}</span>
              <span className="text-white font-bold">{userSubTier.fullTitle}</span>
            </div>
            <span
              className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{ background: userSubTier.bgColor, color: userSubTier.color }}
            >
              {userSubTier.stageType === 'BASE' ? 'Base Roman I-V' : userSubTier.stageType === 'GREEK' ? 'Greek Division' : 'Metal League'}
            </span>
          </div>

          {/* Sub-Step Progress inside current tier */}
          <div className="flex items-center justify-between text-[9px] text-slate-300 font-bold mb-1">
            <span>Current Step Progress</span>
            <span className="font-mono text-white font-black">{userSubTier.stepProgressPct}%</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden bg-white/10 mb-2">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${userSubTier.stepProgressPct}%`,
                background: `linear-gradient(90deg, ${userSubTier.color}80, ${userSubTier.color})`,
                boxShadow: `0 0 8px ${userSubTier.glowColor}`,
              }}
            />
          </div>

          {(() => {
            const currentSubTiers = getAllSubTiersForLevel(userLvl.level);
            const activeIdx = currentSubTiers.findIndex((st) => totalScore < st.maxScore);
            const nextBlock = activeIdx >= 0 && activeIdx + 1 < currentSubTiers.length
              ? currentSubTiers[activeIdx + 1]
              : (userLvl.level < 15 ? getAllSubTiersForLevel(userLvl.level + 1)[0] : null);
            const nextMinScore = nextBlock?.minScore ?? null;
            const ptsToNext = nextMinScore != null ? Math.max(0, nextMinScore - totalScore) : 0;

            return (
              <div className="flex flex-wrap items-center justify-between gap-1 text-[9px] pt-1.5 border-t border-white/5 text-slate-400">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span>Agla Goal:</span>
                  <span className="text-amber-300 font-bold flex items-center gap-1">
                    <span>🎯</span>
                    <span>{userSubTier.nextStepTitle}</span>
                  </span>
                  {nextMinScore != null && (
                    <span className="bg-black/50 border border-white/10 px-1.5 py-0.5 rounded text-[8.5px] font-mono font-bold text-slate-300">
                      Score: <span className="text-amber-300 font-black">{formatScoreNumber(nextMinScore)} pts</span>
                      <span className="text-emerald-400 ml-1 font-sans font-bold">({formatScoreNumber(ptsToNext)} pts baki)</span>
                    </span>
                  )}
                </div>
                <span className="text-[8px] bg-amber-400/20 text-amber-200 border border-amber-400/30 px-1.5 py-0.5 rounded font-black shrink-0">
                  +{SUB_TIER_COIN_REWARD} 🪙
                </span>
              </div>
            );
          })()}

          {/* Coins & Diamonds Per Sub-Rank Promotion Banner */}
          <div className="mt-2.5 bg-gradient-to-r from-amber-500/15 via-purple-500/15 to-cyan-500/15 border border-amber-400/40 rounded-xl p-2.5 flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
            <div className="flex items-center gap-2">
              <span className="text-xl">👑</span>
              <div>
                <p className="text-[10px] font-black text-amber-300 flex items-center gap-1.5 flex-wrap">
                  <span>Sub-Rank Rewards:</span>
                  <span className="bg-amber-400 text-slate-950 font-black px-1.5 py-0.2 rounded text-[9px]">
                    +50 Coins Har Rank
                  </span>
                  <span className="bg-gradient-to-r from-purple-500 to-cyan-400 text-white font-black px-1.5 py-0.2 rounded text-[9px] shadow-xs">
                    💎 Level 15 γ-V: 100 💎 + 1000 🪙
                  </span>
                </p>
                <p className="text-[8.5px] text-slate-200 mt-0.5">
                  Har sub-tier unlock par +50 Coins. Aur <strong>Level 15 (Absolute Legend) Diamond Gamma V</strong> par alag hi supreme prize: <strong>100 Diamonds + 1,000 Coins</strong> aur ultimate animated Level Badge!
                </p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="text-[11px] font-black text-cyan-300 tracking-tight block">
                100 💎 + 1k 🪙
              </span>
              <span className="text-[7.5px] text-amber-300 font-bold uppercase">Apex Max</span>
            </div>
          </div>

          {/* Quick link to 475 Sub-Levels Rows View */}
          <button
            type="button"
            onClick={() => {
              setViewMode('ALL_SUB_LEVELS');
              setTimeout(() => {
                const el = document.getElementById(`sub-level-row-${currentUserGlobalIdx}`);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }, 120);
            }}
            className="w-full mt-2 py-2 px-3 rounded-xl bg-gradient-to-r from-amber-500/20 via-yellow-500/15 to-amber-500/20 hover:from-amber-500/30 hover:to-yellow-500/30 border border-amber-400/40 text-amber-200 text-[11px] font-black flex items-center justify-between transition-all shadow-md group"
          >
            <span className="flex items-center gap-1.5">
              <span className="text-base group-hover:scale-110 transition-transform">📑</span>
              <span>Sabhi 475 Sub-Levels Rows View</span>
            </span>
            <span className="bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full text-[9px] font-black shadow-sm">
              {unlockedSubLevelsCount} / 475 Unlocked ➔
            </span>
          </button>
        </div>

        {/* Progress to Next Level Bar */}
        <div className="mt-3 bg-[#111728] rounded-xl p-2.5 border border-white/10">
          <div className="flex items-center justify-between text-[9px] font-bold text-slate-400 mb-1">
            <span>Level {userLvl.level} ({lvlFrom.toLocaleString('en-IN')})</span>
            <span className="text-white font-black">
              {progressPct}% {lvlTo ? `· ${ptsLeft.toLocaleString('en-IN')} pts baki` : '· Max Level'}
            </span>
            <span>{nextUserLvl ? `Level ${nextUserLvl.level} (${lvlTo?.toLocaleString('en-IN')})` : 'Max 🏆'}</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden bg-white/10">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progressPct}%`,
                background: `linear-gradient(90deg, ${userLvl.color}99, ${userLvl.color})`,
              }}
            />
          </div>
        </div>

        {/* Unlocked Features (Future / Perks) at this level */}
        <div className="mt-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-300">
              Aapke Current Level Ke Features (Perks):
            </p>
            <span className="text-[9px] font-bold text-emerald-400">✓ Active</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2 text-xs">
            {/* Store Discount */}
            <div className="bg-[#111728] rounded-xl p-2 border border-white/10 flex items-center gap-2.5">
              <span className="text-base">🏷️</span>
              <div className="min-w-0">
                <p className="text-[11px] font-black text-white">
                  {userLvl.discount > 0
                    ? `${userLvl.discount}% Store Discount`
                    : 'Store Discount: 0%'}
                </p>
                <p className="text-[9px] text-slate-400">
                  {userLvl.discount > 0
                    ? 'Store purchases par automatic discount'
                    : 'Level 3 se start hota hai'}
                </p>
              </div>
            </div>

            {/* Daily Login Bonus Credits */}
            <div className="bg-[#111728] rounded-xl p-2 border border-white/10 flex items-center gap-2.5">
              <span className="text-base">💰</span>
              <div className="min-w-0">
                <p className="text-[11px] font-black text-white">
                  {currentUserBonusCredits > 0
                    ? `+${currentUserBonusCredits} Daily Login Bonus CR`
                    : 'Daily Login Bonus: 0 CR'}
                </p>
                <p className="text-[9px] text-slate-400">
                  {currentUserBonusCredits > 0
                    ? 'Roz first login pe extra credits'
                    : 'Level 2 se start hota hai'}
                </p>
              </div>
            </div>

            {/* Top Bar Animation */}
            <div className="bg-[#111728] rounded-xl p-2 border border-white/10 flex items-center gap-2.5">
              <span className="text-base">✨</span>
              <div className="min-w-0">
                <p className="text-[11px] font-black text-white">
                  Top Bar FX: {animLabels[userLvl.animationIntensity]}
                </p>
                <p className="text-[9px] text-slate-400">
                  {userLvl.animationIntensity > 0
                    ? 'Top bar dynamic glowing animation'
                    : 'Level 3 se start hota hai'}
                </p>
              </div>
            </div>

            {/* Glowing Username Color */}
            <div className="bg-[#111728] rounded-xl p-2 border border-white/10 flex items-center gap-2.5">
              <span className="text-base">🎨</span>
              <div className="min-w-0">
                <p
                  className="text-[11px] font-black"
                  style={{ color: userLvl.nameColor ?? '#cbd5e1' }}
                >
                  {userLvl.nameColor
                    ? `Glowing Username Color (${userLvl.label})`
                    : 'Username Color: Normal'}
                </p>
                <p className="text-[9px] text-slate-400">
                  {userLvl.nameColor
                    ? 'Dashboard aur profile me special glowing name'
                    : 'Level 4 se start hota hai'}
                </p>
              </div>
            </div>

            {/* Reading Time Scoring Window */}
            <div className="bg-[#111728] rounded-xl p-2 border border-white/10 flex items-center gap-2.5">
              <span className="text-base">⏱️</span>
              <div className="min-w-0">
                <p className="text-[11px] font-black text-white">
                  Reading Window: {currentReadingSecs}s ({Math.floor(currentReadingSecs / 60)} min)
                </p>
                <p className="text-[9px] text-slate-400">
                  {userLvl.level >= 9
                    ? `Level 9+ Bonus: +${userLvl.level - 8} min extra reading time`
                    : 'Notes/PDF/Video study time window (10 min base)'}
                </p>
              </div>
            </div>

            {/* Progress Bonus or Limit Multiplier */}
            <div className="bg-[#111728] rounded-xl p-2 border border-white/10 flex items-center gap-2.5">
              <span className="text-base">🚀</span>
              <div className="min-w-0">
                <p className="text-[11px] font-black text-amber-400">
                  {currentBonusDesc}
                </p>
                <p className="text-[9px] text-slate-400">
                  Study consistency par extra score/limit boost
                </p>
              </div>
            </div>
          </div>

          {/* Active Events Access */}
          <div className="mt-2 bg-[#111728] rounded-xl p-2.5 border border-white/10">
            <p className="text-[8px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
              Current Events Access:
            </p>
            <div className="flex flex-wrap gap-1.5 text-[9px] font-bold">
              <span
                className={`px-2 py-0.5 rounded-full ${
                  userLvl.level >= EVENT_MIN_LEVELS.specialDiscount
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-white/5 text-slate-600'
                }`}
              >
                🏷️ Discount Event {userLvl.level >= EVENT_MIN_LEVELS.specialDiscount ? '✓' : '🔒'}
              </span>
              <span
                className={`px-2 py-0.5 rounded-full ${
                  userLvl.level >= EVENT_MIN_LEVELS.creditBonus
                    ? 'bg-green-500/20 text-green-300 border border-green-500/40'
                    : 'bg-white/5 text-slate-600'
                }`}
              >
                🎁 Credit Bonus {userLvl.level >= EVENT_MIN_LEVELS.creditBonus ? '✓' : '🔒'}
              </span>
              <span
                className={`px-2 py-0.5 rounded-full ${
                  userLvl.level >= EVENT_MIN_LEVELS.dailyLimitBoost
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-white/5 text-slate-600'
                }`}
              >
                📈 Limit Boost {userLvl.level >= EVENT_MIN_LEVELS.dailyLimitBoost ? '✓' : '🔒 (L3+)'}
              </span>
              <span
                className={`px-2 py-0.5 rounded-full ${
                  userLvl.level >= EVENT_MIN_LEVELS.scoreBoost
                    ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
                    : 'bg-white/5 text-slate-600'
                }`}
              >
                🚀 Score Boost {userLvl.level >= EVENT_MIN_LEVELS.scoreBoost ? '✓' : '🔒 (L5+)'}
              </span>
              <span
                className={`px-2 py-0.5 rounded-full ${
                  userLvl.level >= EVENT_MIN_LEVELS.creditFree
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'bg-white/5 text-slate-600'
                }`}
              >
                🪙 Credit Free {userLvl.level >= EVENT_MIN_LEVELS.creditFree ? '✓' : '🔒 (L8+)'}
              </span>
              <span
                className={`px-2 py-0.5 rounded-full ${
                  userLvl.level >= EVENT_MIN_LEVELS.globalFreeAccess
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                    : 'bg-white/5 text-slate-600'
                }`}
              >
                🌍 Global Free {userLvl.level >= EVENT_MIN_LEVELS.globalFreeAccess ? '✓' : '🔒 (L10+)'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAllSubLevelsRowsView = () => {
    const filteredRows = allGlobalSubTiers.filter((st) => {
      if (filterLevel !== 'ALL' && st.level !== filterLevel) return false;
      const isReached = totalScore >= st.minScore;
      const isCurrent = st.globalIndex === currentUserGlobalIdx;
      if (filterStatus === 'UNLOCKED' && !isReached) return false;
      if (filterStatus === 'LOCKED' && isReached) return false;
      if (filterStatus === 'CURRENT' && !isCurrent) return false;

      if (subLevelSearch.trim()) {
        const q = subLevelSearch.toLowerCase().trim();
        const matchesName =
          st.title.toLowerCase().includes(q) ||
          st.levelLabel.toLowerCase().includes(q) ||
          (st.metal && st.metal.toLowerCase().includes(q)) ||
          (st.greek && st.greek.toLowerCase().includes(q)) ||
          st.roman.toLowerCase().includes(q) ||
          String(st.minScore).includes(q) ||
          `level ${st.level}`.includes(q);
        if (!matchesName) return false;
      }
      return true;
    });

    return (
      <div className="space-y-3.5">
        {/* Top Summary Banner */}
        <div className="bg-gradient-to-r from-amber-500/15 via-yellow-500/10 to-amber-500/15 rounded-2xl p-4 border border-amber-400/35 flex flex-wrap items-center justify-between gap-3 shadow-xl">
          <div className="flex items-center gap-3">
            <span className="text-3xl">📑</span>
            <div>
              <h3 className="text-sm md:text-base font-black text-white flex items-center gap-2">
                <span>Sabhi 475 Sub-Levels ki Row-by-Row List</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black">
                  Har Sub-Level = 1 Dedicated Row
                </span>
              </h3>
              <p className="text-[11px] text-slate-300 mt-1">
                Aapne <strong className="text-emerald-400 font-black">{unlockedSubLevelsCount}</strong> / 475 Sub-Levels unlock kar liye hain (+{unlockedSubLevelsCount * 50} 🪙 Coins earned)!
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              const el = document.getElementById(`sub-level-row-${currentUserGlobalIdx}`);
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            }}
            className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-950 font-black text-xs shadow-lg flex items-center gap-1.5 transition-all"
          >
            <span>🎯</span>
            <span>Meri Current Row (#{currentUserGlobalIdx})</span>
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-[#0e1424] rounded-2xl p-3 border border-white/10 space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <input
                type="text"
                value={subLevelSearch}
                onChange={(e) => setSubLevelSearch(e.target.value)}
                placeholder="🔍 Search Sub-Level (e.g. Rank II, 200, Alpha, Silver, Level 1)..."
                className="w-full bg-[#12192b] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
              {subLevelSearch && (
                <button
                  type="button"
                  onClick={() => setSubLevelSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Status Pills */}
            <div className="flex items-center gap-1 bg-[#12192b] p-1 rounded-xl border border-white/10 text-[10px] font-black overflow-x-auto no-scrollbar">
              {[
                { id: 'ALL' as const, label: `All (${allGlobalSubTiers.length})` },
                { id: 'UNLOCKED' as const, label: `✓ Unlocked (${unlockedSubLevelsCount})` },
                { id: 'CURRENT' as const, label: `🎯 Current (#${currentUserGlobalIdx})` },
                { id: 'LOCKED' as const, label: `🔒 Locked (${allGlobalSubTiers.length - unlockedSubLevelsCount})` },
              ].map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setFilterStatus(st.id)}
                  className={`px-2 py-1 rounded-lg transition-all whitespace-nowrap ${
                    filterStatus === st.id
                      ? 'bg-amber-400 text-slate-950 font-black shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          {/* Level Filter Pills (All, L1..L15) */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
            <button
              type="button"
              onClick={() => setFilterLevel('ALL')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all shrink-0 ${
                filterLevel === 'ALL'
                  ? 'bg-blue-600 text-white shadow'
                  : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
              }`}
            >
              All Levels
            </button>
            {LEVEL_INFO.map((l) => (
              <button
                key={l.level}
                type="button"
                onClick={() => setFilterLevel(l.level)}
                className={`px-2 py-1 rounded-lg text-[10px] font-black transition-all shrink-0 flex items-center gap-1 ${
                  filterLevel === l.level
                    ? 'bg-amber-400 text-slate-950 shadow'
                    : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                }`}
              >
                <span>{l.emoji}</span>
                <span>L{l.level}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Showing Count */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
          <span>
            Showing <strong className="text-white">{filteredRows.length}</strong> sub-level rows
          </span>
          <span className="text-[10px] text-amber-300 font-bold">
            Har Sub-Level Row par +50 🪙 Coins
          </span>
        </div>

        {/* ── THE 475 ROWS (EACH SUB-LEVEL HAS ITS OWN ROW) ── */}
        <div className="space-y-1.5">
          {filteredRows.map((st, fIdx) => {
            const isReached = totalScore >= st.minScore;
            const isCurrent = st.globalIndex === currentUserGlobalIdx;
            const ptsNeed = Math.max(0, st.minScore - totalScore);

            return (
              <div
                key={`subrow-${st.level}-${st.globalIndex || fIdx}`}
                id={`sub-level-row-${st.globalIndex}`}
                className={`p-3 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                  isCurrent
                    ? 'bg-amber-500/20 border-amber-400 text-amber-200 ring-2 ring-amber-400/50 shadow-xl'
                    : isReached
                    ? 'bg-[#0f172a] border-emerald-500/30 text-emerald-300'
                    : 'bg-[#0b0f19] border-white/5 text-slate-400'
                }`}
              >
                {/* Left: Row Index + Level + Sub-Rank Title */}
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black font-mono shrink-0 shadow-sm ${
                      isCurrent
                        ? 'bg-amber-400 text-slate-950 font-black'
                        : isReached
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-white/5 text-slate-500 border border-white/10'
                    }`}
                  >
                    #{st.globalIndex}
                  </span>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md shrink-0"
                        style={{
                          background: `${st.levelColor}25`,
                          color: st.levelColor,
                          border: `1px solid ${st.levelColor}50`,
                        }}
                      >
                        {st.levelEmoji} Level {st.level} ({st.levelLabel})
                      </span>

                      <span className="text-xs font-black text-white truncate">
                        {st.title}
                      </span>

                      <span className="text-[9px] font-mono text-slate-400 shrink-0">
                        ({st.minPct}% – {st.maxPct}%)
                      </span>
                    </div>

                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Score Range:{' '}
                      <span className="font-mono text-slate-300 font-bold">
                        {formatScoreNumber(st.minScore)} – {formatScoreNumber(st.maxScore)} pts
                      </span>
                    </p>
                  </div>
                </div>

                {/* Right: Required Score + Coin Reward + Status */}
                <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5 shrink-0">
                  <div className="text-left sm:text-right">
                    <div className="text-xs font-black font-mono text-amber-300">
                      {formatScoreNumber(st.minScore)} pts
                    </div>
                    <div className="text-[9px] font-bold text-amber-400 flex items-center sm:justify-end gap-1">
                      <span>+50</span> <span>🪙</span>
                    </div>
                  </div>

                  <div className="w-28 text-right">
                    {isCurrent ? (
                      <span className="text-[9px] px-2.5 py-1 rounded-full bg-amber-400 text-slate-950 font-black inline-block shadow">
                        🎯 CURRENT
                      </span>
                    ) : isReached ? (
                      <span className="text-[9px] px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 inline-block font-bold">
                        ✓ Unlocked
                      </span>
                    ) : (
                      <span className="text-[9px] text-slate-400 font-mono inline-block">
                        🔒 {formatScoreCompact(ptsNeed)} baki
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div
      id="level-system-full-page"
      className="fixed inset-0 z-[9990] text-white flex flex-col h-[100dvh] w-full overflow-hidden select-none bg-[#07090e]"
      style={{
        backgroundColor: '#07090e',
        backgroundImage:
          'radial-gradient(ellipse 90% 50% at 50% -5%, #182442 0%, #0d1424 50%, #07090e 100%)',
      }}
    >
      {/* ── TOP APP-BAR / HEADER ── */}
      <div className="flex-shrink-0 bg-[#0c101c] px-4 md:px-6 py-3 border-b border-white/10 flex items-center justify-between shadow-xl">
        <div className="flex items-center gap-3">
          <button
            id="level-page-back-btn"
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white transition-all text-xs font-black"
          >
            <span>←</span>
            <span>Wapas</span>
          </button>
          <div>
            <h1 className="text-sm md:text-base font-black text-white flex items-center gap-2">
              <span>🏆</span> Level System & Student Profile
            </h1>
            <p className="text-[10px] text-slate-400 hidden sm:block">
              Levels 1 se 15 ki poori details aur aapke active features
            </p>
          </div>
        </div>

        {/* View Switcher & Current Level Pill in Header */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <div className="flex items-center bg-white/10 p-1 rounded-xl border border-white/10 shadow-inner">
            <button
              type="button"
              onClick={() => setViewMode('LEVELS')}
              className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1 ${
                viewMode === 'LEVELS'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <span>🏆</span>
              <span>15 Levels</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('ALL_SUB_LEVELS')}
              className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
                viewMode === 'ALL_SUB_LEVELS'
                  ? 'bg-amber-400 text-slate-950 font-black shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <span>📑</span>
              <span>475 Rows</span>
            </button>
          </div>

          <div
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black"
            style={{
              background: `${userLvl.color}25`,
              color: userLvl.color,
              border: `1px solid ${userLvl.color}60`,
            }}
          >
            <span>{userLvl.emoji}</span>
            <span>Level {userLvl.level} · {userLvl.label}</span>
          </div>
        </div>
      </div>

      {/* ── MAIN FULL-PAGE VIEW (RESPONSIVE 2-SIDE ON DESKTOP, UNIFIED SCROLL ON MOBILE) ── */}
      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row min-h-0">
        {/* ═════════════════════════════════════════════════════════════════
            LEFT SIDE (DESKTOP) / BOTTOM (MOBILE):
            SCROLLABLE LEVEL 1 SE 15 TAK SAARI DETAILS OR ALL 475 SUB-LEVEL ROWS
           ═════════════════════════════════════════════════════════════════ */}
        <div
          id="level-roadmap-column"
          className="flex-1 overflow-y-auto no-scrollbar p-4 md:p-6 space-y-4 order-2 lg:order-1"
        >
          {viewMode === 'ALL_SUB_LEVELS' ? (
            renderAllSubLevelsRowsView()
          ) : (
            <>
              {/* Map through all 15 levels */}
              {LEVEL_INFO.map((lvl) => {
            const isUserLevel = userLvl.level === lvl.level;
            const isUnlocked = totalScore >= lvl.minScore;
            const ptsNeeded = Math.max(0, lvl.minScore - totalScore);
            const lvlBonusCredits =
              getLevelDailyLimitsWithOverride(lvl.level, settings)?.bonusLoginCredits ?? 0;
            const readingSecs = getMaxReadingSeconds(lvl.level);
            const animIntensity = lvl.animationIntensity;
            const isExpanded = expandedLevels[lvl.level] ?? false;

            const branchSummary =
              lvl.level <= 5
                ? '🌿 5 Roman Branches (I, II, III, IV, V)'
                : lvl.level <= 10
                ? '🏛️ 3 Greek Branches (Alpha α, Beta β, Gamma γ) · 15 Sub-Ranks'
                : '👑 5 Metal Grand Leagues (Bronze – Diamond) · 75 Sub-Ranks';

            return (
              <div
                key={lvl.level}
                id={`level-card-${lvl.level}`}
                className={`rounded-2xl p-4 md:p-5 transition-all relative overflow-hidden ${
                  isUserLevel
                    ? 'border-2 shadow-2xl ring-2'
                    : isUnlocked
                    ? 'border'
                    : 'border'
                }`}
                style={{
                  borderColor: isUserLevel ? lvl.color : `${lvl.color}${isUnlocked ? '60' : '25'}`,
                  backgroundColor: isUserLevel ? '#111728' : isUnlocked ? '#0e1422' : '#080d16',
                  backgroundImage: isUserLevel
                    ? `linear-gradient(135deg, ${lvl.color}28 0%, #111728 50%, #0c101c 100%)`
                    : isUnlocked
                    ? `linear-gradient(135deg, ${lvl.color}15 0%, #0e1422 60%, #090d16 100%)`
                    : `linear-gradient(135deg, ${lvl.color}08 0%, #0c101a 60%, #080c14 100%)`,
                  boxShadow: isUserLevel
                    ? `0 0 32px ${lvl.glowColor}, inset 0 0 16px ${lvl.color}20`
                    : `0 4px 16px ${lvl.glowColor}15`,
                }}
              >
                {/* Visual Level Color Accent Line on Top */}
                <div
                  className="absolute top-0 left-0 right-0 h-1"
                  style={{
                    background: `linear-gradient(90deg, transparent, ${lvl.color}, transparent)`,
                  }}
                />

                {/* Card Top Row - Clickable to expand/collapse */}
                <div
                  onClick={() => toggleLevelCard(lvl.level)}
                  className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 cursor-pointer select-none transition-all ${
                    isExpanded ? 'pb-3.5 border-b border-white/10' : ''
                  }`}
                >
                  <div className="flex items-center gap-3 w-full sm:w-auto min-w-0">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 shadow-lg transition-transform active:scale-95"
                      style={{
                        background: `${lvl.color}20`,
                        border: `1.5px solid ${lvl.color}60`,
                        boxShadow: `0 4px 14px ${lvl.color}30`,
                      }}
                    >
                      {lvl.emoji}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base font-black text-white">
                          Level {lvl.level}
                        </span>
                        <span
                          className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md"
                          style={{ background: `${lvl.color}25`, color: lvl.color }}
                        >
                          {lvl.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs font-black text-amber-300">
                          🎯 Required: {lvl.minScore.toLocaleString('en-IN')} pts
                        </span>
                        <span className="text-[10px] text-slate-400 font-semibold hidden md:inline">
                          • {branchSummary}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Unlock / Current Badge & Expand indicator */}
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    {isUserLevel ? (
                      <span
                        className="text-[10px] font-black px-3 py-1 rounded-full text-white tracking-wider flex items-center gap-1 shadow-lg"
                        style={{ background: lvl.color }}
                      >
                        ✦ CURRENT LEVEL
                      </span>
                    ) : isUnlocked ? (
                      <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                        ✓ UNLOCKED
                      </span>
                    ) : (
                      <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-[#162035] text-amber-300 border border-amber-500/30 flex items-center gap-1 shadow-sm">
                        <span>🔒</span> {ptsNeeded.toLocaleString('en-IN')} pts baki
                      </span>
                    )}

                    <span
                      className="px-2.5 py-1 rounded-xl text-[10px] font-black flex items-center gap-1 border transition-all"
                      style={{
                        background: isExpanded ? 'rgba(255,255,255,0.1)' : `${lvl.color}18`,
                        borderColor: isExpanded ? 'rgba(255,255,255,0.2)' : `${lvl.color}40`,
                        color: isExpanded ? '#fff' : lvl.color,
                      }}
                    >
                      <span>{isExpanded ? '▲ Band Karein' : '▼ Shakhaayein Dekhein'}</span>
                    </span>
                  </div>
                </div>

                {/* ── EXPANDED CONTENT: Branches Hierarchy First, then Perks ── */}
                {isExpanded && (
                  <div className="pt-3.5 space-y-3 animate-in fade-in duration-200">
                    {/* 1. BRANCH HIERARCHY (Shakhaayein: Branches, Divisions & Sub-Ranks I-V) */}
                    {(() => {
                      const subTiersForThisLvl = getAllSubTiersForLevel(lvl.level);
                      const isTableExpanded = expandedSubLevelTable === lvl.level;

                      return (
                        <div className="bg-[#0c1220] rounded-xl p-3 border border-white/10">
                          <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/5 flex-wrap gap-2">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm">
                                {lvl.level <= 5 ? '🌿' : lvl.level <= 10 ? '🏛️' : '👑'}
                              </span>
                              <div>
                                <p className="text-[11px] font-black uppercase tracking-wider text-amber-300">
                                  {lvl.level <= 5
                                    ? 'Is Level Ki Shakhaayein: Roman Ranks I – V'
                                    : lvl.level <= 10
                                    ? 'Is Level Ki Shakhaayein: 3 Greek Branches (Alpha, Beta, Gamma) [I–V]'
                                    : 'Is Level Ki Shakhaayein: 5 Metal Grand Leagues · Branches (α, β, γ) [I–V]'}
                                </p>
                                <p className="text-[9px] text-slate-400">
                                  {lvl.level <= 5
                                    ? 'Har Roman branch (I se V) ka exact required score aur +50 🪙 reward'
                                    : lvl.level <= 10
                                    ? '3 Shakhaayein (Alpha 25%, Beta 35%, Gamma 40%) aur har ek mein sub-branches I, II, III, IV, V'
                                    : '5 Leagues (Bronze, Silver, Gold, Platinum, Diamond) aur har ek mein shakhaayein & sub-ranks I se V'}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 ml-auto">
                              {isUserLevel && (
                                <span
                                  className="text-[9px] font-black px-2 py-0.5 rounded-full shadow-sm"
                                  style={{
                                    background: userSubTier.bgColor,
                                    color: userSubTier.color,
                                    border: `1px solid ${userSubTier.borderColor}`,
                                  }}
                                >
                                  Aap Yahan Hain: {userSubTier.badgeText}
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => setExpandedSubLevelTable((prev) => (prev === lvl.level ? null : lvl.level))}
                                className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-white/10 hover:bg-white/15 text-slate-200 border border-white/15 flex items-center gap-1 transition-all"
                              >
                                <span>{isTableExpanded ? '✕ Hide Rows' : `📜 Sub-Level Rows (${subTiersForThisLvl.length})`}</span>
                              </button>
                            </div>
                          </div>

                          {/* Level 1 se 5: 5 Roman Chips with exact required score */}
                          {lvl.level <= 5 && (
                            <div className="grid grid-cols-5 gap-1.5 text-center">
                              {ROMAN_STEPS.map((r, ri) => {
                                const st = subTiersForThisLvl[ri];
                                const isCurrentStep = isUserLevel && userSubTier.roman === r;
                                const isPassedStep = isUnlocked && (!isUserLevel || userSubTier.romanIndex > ri);
                                const reqScore = st ? st.minScore : 0;

                                return (
                                  <div
                                    key={`lvl-${lvl.level}-base-${r}-${ri}`}
                                    className={`rounded-lg py-2 px-1 text-center transition-all ${
                                      isCurrentStep
                                        ? 'ring-2 font-black shadow-lg scale-105'
                                        : isPassedStep
                                        ? 'bg-white/5 text-slate-300'
                                        : 'bg-white/[0.02] text-slate-500'
                                    }`}
                                    style={{
                                      background: isCurrentStep ? userSubTier.bgColor : undefined,
                                      borderColor: isCurrentStep ? userSubTier.color : 'rgba(255,255,255,0.06)',
                                      border: '1px solid',
                                      '--tw-ring-color': isCurrentStep ? userSubTier.color : undefined,
                                    } as React.CSSProperties}
                                  >
                                    <div className="text-[10px] font-black" style={{ color: isCurrentStep ? userSubTier.color : '#f1f5f9' }}>
                                      Rank {r}
                                    </div>
                                    <div
                                      className={`my-0.5 px-0.5 py-0.5 rounded border text-[8.5px] font-black font-mono flex items-center justify-center gap-0.5 ${
                                        isCurrentStep
                                          ? 'bg-amber-400 text-slate-950 border-amber-300 shadow'
                                          : isPassedStep
                                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                          : 'bg-black/50 text-amber-300 border-white/10'
                                      }`}
                                    >
                                      <span>{formatScoreNumber(reqScore)}</span>
                                      <span className="text-[7.5px] opacity-80 font-sans">pts</span>
                                    </div>
                                    <div className="text-[7.5px] opacity-75 font-mono text-slate-400">
                                      {st ? `${st.minPct}%–${st.maxPct}%` : `${ri * 20}%-${(ri + 1) * 20}%`}
                                    </div>
                                    <div className="text-[7.5px] font-bold text-amber-300 mt-0.5">
                                      +50 🪙
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Level 6 se 10: 3 Greek Divisions (Alpha 25%, Beta 35%, Gamma 40%) with scores */}
                          {lvl.level >= 6 && lvl.level <= 10 && (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              {[
                                { name: 'Alpha' as const, sym: 'α', pct: '0% – 25%', color: '#38bdf8' },
                                { name: 'Beta' as const,  sym: 'β', pct: '25% – 60%', color: '#a855f7' },
                                { name: 'Gamma' as const, sym: 'γ', pct: '60% – 100%', color: '#f59e0b' },
                              ].map((g) => {
                                const isCurrentGreek = isUserLevel && userSubTier.greek === g.name;
                                const gBlocks = subTiersForThisLvl.filter((s) => s.greek === g.name);
                                const gMinScore = gBlocks[0]?.minScore ?? 0;
                                const gMaxScore = gBlocks[gBlocks.length - 1]?.maxScore ?? 0;

                                return (
                                  <div
                                    key={`lvl-${lvl.level}-greek-group-${g.name}`}
                                    className={`rounded-xl p-2 border transition-all ${
                                      isCurrentGreek
                                        ? 'shadow-lg ring-1'
                                        : 'bg-white/[0.03] border-white/10'
                                    }`}
                                    style={{
                                      background: isCurrentGreek ? `${g.color}18` : undefined,
                                      borderColor: isCurrentGreek ? g.color : undefined,
                                      '--tw-ring-color': isCurrentGreek ? g.color : undefined,
                                    } as React.CSSProperties}
                                  >
                                    <div className="flex items-center justify-between text-[10px] font-black mb-1">
                                      <span style={{ color: g.color }}>{g.sym} {g.name} Branch</span>
                                      <span className="text-[8px] font-mono text-amber-300 font-bold">+50 🪙/rank</span>
                                    </div>
                                    <div className="text-[8px] font-mono text-slate-300 mb-1.5 flex items-center justify-between">
                                      <span className="text-slate-400">{g.pct}</span>
                                      <span className="font-bold text-amber-300">
                                        {formatScoreCompact(gMinScore)} – {formatScoreCompact(gMaxScore)} pts
                                      </span>
                                    </div>
                                    <div className="grid grid-cols-5 gap-1 text-[8px] font-mono">
                                      {ROMAN_STEPS.map((r, ri) => {
                                        const isStep = isCurrentGreek && userSubTier.roman === r;
                                        const block = gBlocks[ri];
                                        return (
                                          <div
                                            key={`lvl-${lvl.level}-greek-${g.name}-step-${r}-${ri}`}
                                            className={`px-1 py-1 rounded text-center ${
                                              isStep ? 'bg-white font-black text-black shadow' : 'bg-black/40 text-slate-300 border border-white/5'
                                            }`}
                                          >
                                            <div className="font-bold">{r}</div>
                                            <div className={`text-[7px] font-black mt-0.5 ${isStep ? 'text-black' : 'text-amber-300'}`}>
                                              {block ? formatScoreCompact(block.minScore) : ''}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Level 11 se 15: 5 Metal Leagues with exact scores */}
                          {lvl.level >= 11 && (
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                              {[
                                { name: 'Bronze' as const,   emoji: '🥉', pct: '0–20%', color: '#f59e0b' },
                                { name: 'Silver' as const,   emoji: '🥈', pct: '20–40%', color: '#cbd5e1' },
                                { name: 'Gold' as const,     emoji: '🥇', pct: '40–60%', color: '#fbbf24' },
                                { name: 'Platinum' as const, emoji: '💠', pct: '60–80%', color: '#38bdf8' },
                                { name: 'Diamond' as const,  emoji: '💎', pct: '80–100%', color: '#c084fc' },
                              ].map((m) => {
                                const isCurrentMetal = isUserLevel && userSubTier.metal === m.name;
                                const mBlocks = subTiersForThisLvl.filter((s) => s.metal === m.name);
                                const mMinScore = mBlocks[0]?.minScore ?? 0;
                                const mMaxScore = mBlocks[mBlocks.length - 1]?.maxScore ?? 0;

                                return (
                                  <div
                                    key={`lvl-${lvl.level}-metal-${m.name}`}
                                    className={`rounded-xl p-2 border transition-all ${
                                      isCurrentMetal ? 'shadow-lg ring-1 scale-102' : 'bg-white/[0.03] border-white/10'
                                    }`}
                                    style={{
                                      background: isCurrentMetal ? `${m.color}20` : undefined,
                                      borderColor: isCurrentMetal ? m.color : undefined,
                                      '--tw-ring-color': isCurrentMetal ? m.color : undefined,
                                    } as React.CSSProperties}
                                  >
                                    <div className="flex items-center gap-1 text-[10px] font-black">
                                      <span>{m.emoji}</span>
                                      <span style={{ color: m.color }}>{m.name}</span>
                                    </div>
                                    <div className="text-[8px] font-mono text-amber-300 font-bold mt-0.5">
                                      {formatScoreCompact(mMinScore)} – {formatScoreCompact(mMaxScore)} pts
                                    </div>
                                    <div className="text-[7.5px] font-mono text-slate-400">
                                      {m.pct}
                                    </div>
                                    <div className="text-[7.5px] text-amber-300 mt-1 font-mono font-bold">
                                      {lvl.level === 15 && m.name === 'Diamond' ? (
                                        <span className="text-cyan-300 font-black">👑 +100 💎 & +1k 🪙 at γ-V</span>
                                      ) : (
                                        '+50 🪙/rank'
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Expandable Exact Score Table for this level */}
                          {isTableExpanded && (
                            <div className="mt-3 pt-2.5 border-t border-white/10 space-y-1.5 animate-in fade-in duration-200">
                              <div className="flex items-center justify-between text-[9px] font-black text-slate-300 px-1 pb-1 border-b border-white/5">
                                <span>Sub-Level / Rank</span>
                                <span className="text-center">Required Score</span>
                                <span className="text-center">Reward</span>
                                <span className="text-right">Status</span>
                              </div>
                              <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
                                {subTiersForThisLvl.map((st, sIdx) => {
                                  const reached = totalScore >= st.minScore;
                                  const isCurrent = isUserLevel && (
                                    lvl.level <= 5
                                      ? userSubTier.roman === st.roman
                                      : lvl.level <= 10
                                      ? userSubTier.greek === st.greek && userSubTier.roman === st.roman
                                      : userSubTier.metal === st.metal && userSubTier.greek === st.greek && userSubTier.roman === st.roman
                                  );
                                  const ptsNeed = Math.max(0, st.minScore - totalScore);

                                  return (
                                    <div
                                      key={`lvl-${lvl.level}-sub-${st.id || sIdx}-${sIdx}`}
                                      className={`flex items-center justify-between text-[9.5px] py-1.5 px-2 rounded-lg border transition-all ${
                                        st.isSpecialPinnacle
                                          ? 'bg-gradient-to-r from-purple-950/60 via-slate-900 to-cyan-950/60 border-purple-400/60 shadow-md ring-1 ring-purple-400/30'
                                          : isCurrent
                                          ? 'bg-amber-500/20 border-amber-400/50 text-amber-200 font-black ring-1 ring-amber-400/40'
                                          : reached
                                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300 font-bold'
                                          : 'bg-white/[0.02] border-white/5 text-slate-400'
                                      }`}
                                    >
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <span className="font-black text-white">{st.title}</span>
                                        <span className="text-[8px] font-mono text-slate-400">({st.minPct}%–{st.maxPct}%)</span>
                                      </div>
                                      <div className="font-mono font-black text-amber-300">
                                        {formatScoreNumber(st.minScore)} pts
                                      </div>
                                      <div className="text-center">
                                        {st.isSpecialPinnacle ? (
                                          <div className="text-[8.5px] font-black text-cyan-300 flex items-center justify-center gap-0.5">
                                            <span>+{st.diamondReward ?? 100} 💎</span>
                                            <span className="text-amber-300">+{st.coinReward ?? 1000} 🪙</span>
                                          </div>
                                        ) : (
                                          <span className="text-[8.5px] font-bold text-amber-400">+50 🪙</span>
                                        )}
                                      </div>
                                      <div className="text-right">
                                        {isCurrent ? (
                                          <span className="text-[8px] px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 font-black">
                                            CURRENT
                                          </span>
                                        ) : reached ? (
                                          <span className="text-[8px] text-emerald-400 font-bold">
                                            ✓ Unlocked
                                          </span>
                                        ) : (
                                          <span className="text-[8px] text-slate-400 font-mono">
                                            🔒 {formatScoreCompact(ptsNeed)} pts baki
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              <div className="pt-2 px-1 flex items-center justify-between text-[9px] border-t border-white/10 flex-wrap gap-2">
                                <span className="text-slate-400 font-bold">Total {subTiersForThisLvl.length} Sub-Level Rows is level me</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFilterLevel(lvl.level);
                                    setViewMode('ALL_SUB_LEVELS');
                                  }}
                                  className="text-amber-300 hover:text-amber-200 font-black underline flex items-center gap-1 active:scale-95 transition-all"
                                >
                                  <span>Master 475 Rows List me dekhein ➔</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* 2. FEATURES & BENEFITS FOR THIS LEVEL (Perks) */}
                    <div className="space-y-2">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                        🎁 Is Level Me Milne Wali Suvidhayein (Features & Perks):
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {/* Store Discount */}
                        <div className="bg-[#12192b] rounded-xl p-2.5 border border-white/10 flex items-start gap-2.5">
                          <span className="text-base mt-0.5">🏷️</span>
                          <div>
                            <p className="text-[11px] font-black text-white">
                              {lvl.discount > 0
                                ? `${lvl.discount}% Store Discount`
                                : 'Store Discount: 0%'}
                            </p>
                            <p className="text-[9px] text-slate-400">
                              {lvl.discount > 0
                                ? 'App store me purchases par automatic discount'
                                : 'No discount yet (Level 3 se start)'}
                            </p>
                          </div>
                        </div>

                        {/* Daily Login Bonus Credits */}
                        <div className="bg-[#12192b] rounded-xl p-2.5 border border-white/10 flex items-start gap-2.5">
                          <span className="text-base mt-0.5">💰</span>
                          <div>
                            <p className="text-[11px] font-black text-white">
                              {lvlBonusCredits > 0
                                ? `+${lvlBonusCredits} Daily Login Bonus CR`
                                : 'Daily Login Bonus: 0 CR'}
                            </p>
                            <p className="text-[9px] text-slate-400">
                              {lvlBonusCredits > 0
                                ? 'Roz app open karne par extra bonus credits'
                                : 'Bonus credits Level 2 se start'}
                            </p>
                          </div>
                        </div>

                        {/* Top Bar Animation Effect */}
                        <div className="bg-[#12192b] rounded-xl p-2.5 border border-white/10 flex items-start gap-2.5">
                          <span className="text-base mt-0.5">✨</span>
                          <div>
                            <p className="text-[11px] font-black text-white">
                              Top Bar FX: {animLabels[animIntensity]}
                            </p>
                            <p className="text-[9px] text-slate-400">
                              {animIntensity > 0
                                ? 'Top bar pe dynamic glowing animation'
                                : 'No animation (Level 3 se start)'}
                            </p>
                          </div>
                        </div>

                        {/* Username Glow Color */}
                        <div className="bg-[#12192b] rounded-xl p-2.5 border border-white/10 flex items-start gap-2.5">
                          <span className="text-base mt-0.5">🎨</span>
                          <div>
                            <p
                              className="text-[11px] font-black"
                              style={{ color: lvl.nameColor ?? '#cbd5e1' }}
                            >
                              {lvl.nameColor
                                ? `Glowing Name Color (${lvl.label})`
                                : 'Username Color: Normal'}
                            </p>
                            <p className="text-[9px] text-slate-400">
                              {lvl.nameColor
                                ? 'Profile aur leaderboard pe glowing name color'
                                : 'Normal name color (Level 4 se start)'}
                            </p>
                          </div>
                        </div>

                        {/* Reading Time Scoring Window */}
                        <div className="bg-[#12192b] rounded-xl p-2.5 border border-white/10 flex items-start gap-2.5">
                          <span className="text-base mt-0.5">⏱️</span>
                          <div>
                            <p className="text-[11px] font-black text-white">
                              {lvl.level >= 9
                                ? `Reading Window: ${readingSecs}s (${Math.floor(readingSecs / 60)} min)`
                                : `Reading Window: ${readingSecs}s (${Math.floor(readingSecs / 60)} min)`}
                            </p>
                            <p className="text-[9px] text-slate-400">
                              {lvl.level >= 9
                                ? `L9+ Bonus: +${lvl.level - 8} min extra reading time window`
                                : 'Notes, PDF, Video study scoring window (Base 10 min)'}
                            </p>
                          </div>
                        </div>

                        {/* Level Coin Reward */}
                        <div className="bg-[#12192b] rounded-xl p-2.5 border border-amber-500/30 flex items-start gap-2.5">
                          <span className="text-base mt-0.5">🪙</span>
                          <div>
                            <p className="text-[11px] font-black text-amber-300">
                              {lvl.coinReward > 0 ? `+${lvl.coinReward} Coins Reward` : 'Starting Level (0 Coins)'}
                            </p>
                            <p className="text-[9px] text-slate-400">
                              {isUnlocked && lvl.coinReward > 0 ? '✓ Reached & Added to Wallet' : 'Level unlock hone par seedhe wallet me'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 3. Special Events Access */}
                    <div className="bg-[#12192b] rounded-xl p-2.5 border border-white/10">
                      <p className="text-[8px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                        Special Events Access:
                      </p>
                      <div className="flex flex-wrap gap-1.5 text-[8px] font-bold">
                        <span
                          className={`px-2 py-0.5 rounded-full ${
                            lvl.level >= EVENT_MIN_LEVELS.specialDiscount
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-white/5 text-slate-600'
                          }`}
                        >
                          🏷️ Discount Event {lvl.level >= EVENT_MIN_LEVELS.specialDiscount ? '✓' : '🔒'}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full ${
                            lvl.level >= EVENT_MIN_LEVELS.creditBonus
                              ? 'bg-green-500/20 text-green-300'
                              : 'bg-white/5 text-slate-600'
                          }`}
                        >
                          🎁 Credit Bonus Event {lvl.level >= EVENT_MIN_LEVELS.creditBonus ? '✓' : '🔒'}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full ${
                            lvl.level >= EVENT_MIN_LEVELS.dailyLimitBoost
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-white/5 text-slate-600'
                          }`}
                        >
                          📈 Limit Boost (L3+) {lvl.level >= EVENT_MIN_LEVELS.dailyLimitBoost ? '✓' : '🔒'}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full ${
                            lvl.level >= EVENT_MIN_LEVELS.scoreBoost
                              ? 'bg-orange-500/20 text-orange-300'
                              : 'bg-white/5 text-slate-600'
                          }`}
                        >
                          🚀 Score Boost (L5+) {lvl.level >= EVENT_MIN_LEVELS.scoreBoost ? '✓' : '🔒'}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full ${
                            lvl.level >= EVENT_MIN_LEVELS.creditFree
                              ? 'bg-cyan-500/20 text-cyan-300'
                              : 'bg-white/5 text-slate-600'
                          }`}
                        >
                          🪙 Credit Free (L8+) {lvl.level >= EVENT_MIN_LEVELS.creditFree ? '✓' : '🔒'}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full ${
                            lvl.level >= EVENT_MIN_LEVELS.globalFreeAccess
                              ? 'bg-purple-500/20 text-purple-300'
                              : 'bg-white/5 text-slate-600'
                          }`}
                        >
                          🌍 Global Free (L10+) {lvl.level >= EVENT_MIN_LEVELS.globalFreeAccess ? '✓' : '🔒'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Sticky Quick-Jump to Current Level */}
          <div className="sticky bottom-3 z-30 flex justify-center pointer-events-none mt-2">
            <button
              onClick={scrollToCurrentLevel}
              type="button"
              className="pointer-events-auto px-4 py-2 rounded-full text-xs font-black text-white shadow-2xl flex items-center gap-2 border border-white/20 active:scale-95 transition-all backdrop-blur-md hover:brightness-110"
              style={{
                background: `linear-gradient(135deg, ${userLvl.color}ee, #0f172a)`,
                boxShadow: `0 4px 20px ${userLvl.glowColor}`,
              }}
            >
              <span className="text-base">{userLvl.emoji}</span>
              <span>Aapka Current Level {userLvl.level} ({userLvl.label})</span>
              <span className="text-[11px] bg-white/20 px-1.5 py-0.5 rounded-full font-bold ml-1">Go to My Level 🎯</span>
            </button>
          </div>
            </>
          )}
        </div>

        {/* ═════════════════════════════════════════════════════════════════
            RIGHT SIDE (DESKTOP):
            FIXED STUDENT ID DETAILS + CURRENT LEVEL + ACTIVE UNLOCKED FEATURES
           ═════════════════════════════════════════════════════════════════ */}
        <div
          id="student-profile-column"
          className="hidden lg:block w-[380px] xl:w-[420px] bg-[#0b0e18] border-l border-white/10 overflow-y-auto no-scrollbar p-5 order-1 lg:order-2 shrink-0"
        >
          {renderStudentProfileAndFeatures()}
        </div>
      </div>

      {showShowcaseModal && (
        <LevelShowcaseModal
          user={user}
          score={totalScore}
          isOpen={showShowcaseModal}
          onClose={() => setShowShowcaseModal(false)}
          onOpenRoadmap={scrollToCurrentLevel}
        />
      )}
    </div>
  );
};
export default StudentLevelPage;
