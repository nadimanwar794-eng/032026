import React from 'react';
import { User } from '../types';
import {
  LEVEL_INFO,
  getLevelInfo,
  getLevelProgress,
  getMaxReadingSeconds,
  getLevelDailyLimitsWithOverride,
} from '../utils/levelSystem';
import { loadRoutineData } from '../utils/routineStorage';

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
  const [copiedField, setCopiedField] = React.useState<string | null>(null);

  const copyToClipboard = (text: string, fieldName: string) => {
    try {
      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopiedField(fieldName);
      setTimeout(() => {
        setCopiedField((prev) => (prev === fieldName ? null : prev));
      }, 2000);
    } catch (e) {
      console.error('Clipboard copy failed', e);
    }
  };

  const totalScore =
    user.role === 'ADMIN' || user.role === 'SUB_ADMIN'
      ? 999999999
      : user.totalScore || 0;
  const userLvl = getLevelInfo(totalScore, settings);
  const nextUserLvl = LEVEL_INFO[userLvl.level] ?? null;
  const progressPct = getLevelProgress(totalScore);

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

  // Routine status & Class
  const routineData = (() => {
    try {
      return loadRoutineData(user.id);
    } catch {
      return null;
    }
  })();

  const routineOn = routineData?.enabled ?? false;
  let routineClassText = 'Routine OFF';
  let routineClassBadge = 'bg-slate-800/80 text-slate-400 border-slate-700';

  if (routineOn) {
    if (routineData?.routineMode === 'COMPETITION') {
      routineClassText = 'Competition Mode (ON)';
      routineClassBadge = 'bg-emerald-950/80 text-emerald-400 border-emerald-500/50';
    } else if (routineData?.selectedClass) {
      const b = routineData.selectedBoard ? ` · ${routineData.selectedBoard}` : '';
      routineClassText = `Class ${routineData.selectedClass}${b} (ON)`;
      routineClassBadge = 'bg-emerald-950/80 text-emerald-400 border-emerald-500/50';
    } else if (user.classLevel) {
      routineClassText = `Class ${user.classLevel} (ON)`;
      routineClassBadge = 'bg-emerald-950/80 text-emerald-400 border-emerald-500/50';
    } else {
      routineClassText = 'Routine ON';
      routineClassBadge = 'bg-emerald-950/80 text-emerald-400 border-emerald-500/50';
    }
  } else {
    if (routineData?.selectedClass) {
      routineClassText = `Class ${routineData.selectedClass} (OFF)`;
    } else if (user.classLevel) {
      routineClassText = `Class ${user.classLevel} (OFF)`;
    }
  }

  // Subscription Tier display
  const subscriptionText = (() => {
    if (user.role === 'ADMIN' || user.role === 'SUB_ADMIN') return '👑 Administrator';
    if (user.isPremium) {
      const tier = user.subscriptionTier || 'PREMIUM';
      const lvl = user.subscriptionLevel ? ` · ${user.subscriptionLevel}` : '';
      return `💎 ${tier}${lvl}`;
    }
    return '🌱 Free Tier';
  })();

  // Join Date display
  const joinDateText = (() => {
    if (!user.createdAt) return 'N/A';
    try {
      const d = new Date(user.createdAt);
      if (isNaN(d.getTime())) return user.createdAt;
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return user.createdAt;
    }
  })();

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
      {/* ── 1. REDESIGNED STUDENT DIGITAL SMART ID PASS ── */}
      <div
        id="student-id-card"
        className="rounded-3xl border border-white/15 relative overflow-hidden transition-all shadow-2xl backdrop-blur-md"
        style={{
          background: `linear-gradient(145deg, rgba(23, 29, 48, 0.96) 0%, rgba(15, 19, 32, 0.98) 55%, rgba(9, 12, 20, 1) 100%)`,
          boxShadow: `0 14px 40px -10px ${userLvl.color}30, 0 0 0 1px ${userLvl.color}25, inset 0 1px 0 rgba(255,255,255,0.15)`,
        }}
      >
        {/* Top Metallic / Hologram Accent Strip */}
        <div
          className="h-1.5 w-full"
          style={{
            background: `linear-gradient(90deg, ${userLvl.color}, #38bdf8, #818cf8, #f59e0b, ${userLvl.color})`,
          }}
        />

        <div className="p-4 md:p-5">
          {/* Card Header: Official Digital Student ID Badge */}
          <div className="flex items-center justify-between pb-3.5 border-b border-white/10">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-amber-400/15 border border-amber-400/30 flex items-center justify-center text-xs">
                💳
              </span>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-300 flex items-center gap-1.5">
                  <span>Student Identity Pass</span>
                </p>
                <p className="text-[8px] font-medium text-slate-400">
                  Official IIC Study Platform
                </p>
              </div>
            </div>

            {/* Live Verified Status Badge */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/35">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[9px] font-black text-emerald-300 tracking-wider">
                VERIFIED ACTIVE
              </span>
            </div>
          </div>

          {/* Student Hero Row (Avatar & Names & Primary Badges) */}
          <div className="py-4 flex items-center gap-3.5 border-b border-white/10">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black text-white shadow-xl flex-shrink-0 relative"
              style={{
                background: `linear-gradient(135deg, ${userLvl.color}50 0%, #111524 100%)`,
                border: `2px solid ${userLvl.color}`,
                boxShadow: `0 0 20px ${userLvl.glowColor}`,
              }}
            >
              {user.name ? user.name.charAt(0).toUpperCase() : 'S'}
              <div
                className="absolute -bottom-1 -right-1 text-xs rounded-full w-6 h-6 flex items-center justify-center bg-[#0d101a] border border-white/30 shadow-md"
                title={`Level ${userLvl.level} · ${userLvl.label}`}
              >
                {userLvl.emoji}
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-black text-white truncate tracking-tight">
                {user.name || 'Student'}
              </h3>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <span
                  className="text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-sm"
                  style={{
                    background: `${userLvl.color}25`,
                    color: userLvl.color,
                    border: `1px solid ${userLvl.color}50`,
                  }}
                >
                  {userLvl.emoji} Level {userLvl.level} · {userLvl.label}
                </span>

                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  {user.role}
                </span>

                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-slate-300 border border-white/15">
                  ⭐ {totalScore.toLocaleString('en-IN')} pts
                </span>
              </div>
            </div>
          </div>

          {/* Student Details Grid (Redesigned with rich colors, icons & copy action) */}
          <div className="pt-4 space-y-2.5">
            {/* 1. Official Student ID Card (Gold Amber Highlight) */}
            <div
              className="rounded-2xl p-3 border transition-all flex items-center justify-between gap-3 shadow-md"
              style={{
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.14) 0%, rgba(180, 83, 9, 0.06) 100%)',
                borderColor: 'rgba(245, 158, 11, 0.35)',
              }}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-sm flex-shrink-0">
                  🪪
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] font-black uppercase tracking-wider text-amber-400/90">
                    Official Student ID
                  </p>
                  <p className="text-sm font-mono font-black text-amber-200 tracking-wider select-text">
                    {user.displayId || user.id}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => copyToClipboard(user.displayId || user.id, 'studentId')}
                className="px-2.5 py-1 rounded-lg text-[10px] font-black tracking-wide transition-all active:scale-95 flex items-center gap-1 bg-amber-500/25 hover:bg-amber-500/35 text-amber-200 border border-amber-500/40"
                title="Copy Student ID"
              >
                {copiedField === 'studentId' ? (
                  <>
                    <span className="text-emerald-400">✓</span>
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <span>📋</span>
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>

            {/* 2. Account UID (Tech Indigo Card) */}
            <div
              className="rounded-2xl p-3 border transition-all flex items-center justify-between gap-3"
              style={{
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(30, 41, 59, 0.4) 100%)',
                borderColor: 'rgba(99, 102, 241, 0.25)',
              }}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-sm flex-shrink-0">
                  🔑
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] font-black uppercase tracking-wider text-indigo-300/90">
                    Account UID (System Key)
                  </p>
                  <p className="text-xs font-mono font-bold text-slate-200 truncate select-text">
                    {user.id}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => copyToClipboard(user.id, 'uid')}
                className="px-2.5 py-1 rounded-lg text-[10px] font-black tracking-wide transition-all active:scale-95 flex items-center gap-1 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 border border-indigo-500/35"
                title="Copy Account UID"
              >
                {copiedField === 'uid' ? (
                  <>
                    <span className="text-emerald-400">✓</span>
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <span>📋</span>
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>

            {/* 3. Routine Status & Class Card */}
            <div
              className="rounded-2xl p-3 border transition-all flex items-center justify-between gap-3"
              style={{
                background: routineOn
                  ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(6, 78, 59, 0.2) 100%)'
                  : 'linear-gradient(135deg, rgba(51, 65, 85, 0.25) 0%, rgba(15, 23, 42, 0.4) 100%)',
                borderColor: routineOn ? 'rgba(16, 185, 129, 0.35)' : 'rgba(255,255,255,0.1)',
              }}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div
                  className={`w-8 h-8 rounded-xl border flex items-center justify-center text-sm flex-shrink-0 ${
                    routineOn
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                      : 'bg-slate-700/40 border-slate-600/40 text-slate-400'
                  }`}
                >
                  📚
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] font-black uppercase tracking-wider text-slate-300">
                    Routine Status & Academic Class
                  </p>
                  <p className="text-xs font-black text-white mt-0.5">
                    {routineClassText}
                  </p>
                </div>
              </div>

              <span
                className={`text-[10px] font-black px-2.5 py-1 rounded-full border shadow-sm ${
                  routineOn
                    ? 'bg-emerald-500/25 text-emerald-300 border-emerald-500/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {routineOn ? '🟢 ACTIVE' : '⚪ OFF'}
              </span>
            </div>

            {/* 4. Subscription Tier Card (Sapphire Diamond) */}
            <div
              className="rounded-2xl p-3 border transition-all flex items-center justify-between gap-3"
              style={{
                background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.14) 0%, rgba(59, 130, 246, 0.08) 100%)',
                borderColor: 'rgba(56, 189, 248, 0.3)',
              }}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-sm flex-shrink-0">
                  💎
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] font-black uppercase tracking-wider text-cyan-300/90">
                    Subscription Tier
                  </p>
                  <p className="text-xs font-black text-cyan-200 mt-0.5">
                    {subscriptionText}
                  </p>
                </div>
              </div>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                Plan
              </span>
            </div>

            {/* 5, 6, 7. Mobile, Email & Join Date Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-2 pt-1">
              {/* Mobile */}
              <div className="bg-white/[0.04] hover:bg-white/[0.07] transition-all rounded-2xl p-2.5 border border-white/10 flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-xs flex-shrink-0">
                  📱
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[8px] font-black uppercase tracking-wider text-slate-400">
                    Mobile Number
                  </p>
                  <p className="text-xs font-mono font-medium text-white truncate">
                    {user.mobile || (user as any).phone || 'Not provided'}
                  </p>
                </div>
              </div>

              {/* Email */}
              <div className="bg-white/[0.04] hover:bg-white/[0.07] transition-all rounded-2xl p-2.5 border border-white/10 flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-xs flex-shrink-0">
                  ✉️
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[8px] font-black uppercase tracking-wider text-slate-400">
                    Email Address
                  </p>
                  <p className="text-xs font-medium text-white truncate" title={user.email || 'Not provided'}>
                    {user.email || 'Not provided'}
                  </p>
                </div>
              </div>

              {/* Join Date */}
              <div className="bg-white/[0.04] hover:bg-white/[0.07] transition-all rounded-2xl p-2.5 border border-white/10 flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-xs flex-shrink-0">
                  📅
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[8px] font-black uppercase tracking-wider text-slate-400">
                    Account Join Date
                  </p>
                  <p className="text-xs font-medium text-slate-200">
                    {joinDateText}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

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
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-white/10">
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
                    ? `Level 9+ Bonus: +${(userLvl.level - 8) * 30}s extra reading time`
                    : 'Notes/PDF/Video study time window'}
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

        {/* Current Level Pill in Header */}
        <div className="flex items-center gap-2">
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
            SCROLLABLE LEVEL 1 SE 15 TAK SAARI DETAILS
           ═════════════════════════════════════════════════════════════════ */}
        <div
          id="level-roadmap-column"
          className="flex-1 overflow-y-auto no-scrollbar p-4 md:p-6 space-y-4 order-2 lg:order-1"
        >
          {/* Mobile Only: Top Profile & Features block */}
          <div className="block lg:hidden mb-6">
            {renderStudentProfileAndFeatures()}
          </div>

          <div className="flex items-center justify-between px-1 pb-1">
            <div>
              <h2 className="text-sm md:text-base font-black text-white flex items-center gap-2">
                <span>🏅</span> Level 1 se 15 Tak Saari Details
              </h2>
              <p className="text-[11px] text-slate-400">
                Pehle Level 1 aur usme milne wali cheezein, phir aage ke levels
              </p>
            </div>
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-white/5 text-slate-300 border border-white/10">
              Total 15 Levels
            </span>
          </div>

          {/* Map through all 15 levels */}
          {LEVEL_INFO.map((lvl) => {
            const isUserLevel = userLvl.level === lvl.level;
            const isUnlocked = totalScore >= lvl.minScore;
            const ptsNeeded = Math.max(0, lvl.minScore - totalScore);
            const lvlBonusCredits =
              getLevelDailyLimitsWithOverride(lvl.level, settings)?.bonusLoginCredits ?? 0;
            const readingSecs = getMaxReadingSeconds(lvl.level);
            const animIntensity = lvl.animationIntensity;

            // Progress Bonus (L4+) or Daily Limit Multiplier (L9+)
            const bonusText = (() => {
              if (lvl.level >= 14) return 'Daily Limit Multiplier: Up to 500%';
              if (lvl.level === 13) return 'Daily Limit Multiplier: Up to 400%';
              if (lvl.level === 12) return 'Daily Limit Multiplier: Up to 320%';
              if (lvl.level === 11) return 'Daily Limit Multiplier: Up to 250%';
              if (lvl.level === 10) return 'Daily Limit Multiplier: Up to 200%';
              if (lvl.level === 9) return 'Daily Limit Multiplier: Up to 100%';
              if (lvl.level >= 8) return 'Progress Bonus: Up to 45%';
              if (lvl.level === 7) return 'Progress Bonus: Up to 38%';
              if (lvl.level === 6) return 'Progress Bonus: Up to 30%';
              if (lvl.level === 5) return 'Progress Bonus: Up to 22%';
              if (lvl.level === 4) return 'Progress Bonus: Up to 15%';
              return 'Progress Bonus: Level 4 se start';
            })();

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
                {/* Card Top Row */}
                <div className="flex items-center justify-between gap-3 pb-3.5 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 shadow-md"
                      style={{
                        background: `${lvl.color}20`,
                        border: `1.5px solid ${lvl.color}50`,
                      }}
                    >
                      {lvl.emoji}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm md:text-base font-black text-white">
                          Level {lvl.level}
                        </span>
                        <span
                          className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md"
                          style={{ background: `${lvl.color}25`, color: lvl.color }}
                        >
                          {lvl.label}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 font-bold mt-0.5">
                        Required Score: {lvl.minScore.toLocaleString('en-IN')} pts
                      </p>
                    </div>
                  </div>

                  {/* Unlock / Current Badge */}
                  <div>
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
                  </div>
                </div>

                {/* Features & Benefits for this specific Level */}
                <div className="pt-3.5 space-y-2.5">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                    Is Level Me Milne Wali Suvidhayein (Features & Perks):
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
                            ? `Reading Window: ${readingSecs}s (${Math.floor(readingSecs / 60)}m ${readingSecs % 60}s)`
                            : 'Reading Window: 300s (5 min)'}
                        </p>
                        <p className="text-[9px] text-slate-400">
                          {lvl.level >= 9
                            ? `L9+ Bonus: +${(lvl.level - 8) * 30} sec extra reading time window`
                            : 'Notes, PDF, Video study scoring window'}
                        </p>
                      </div>
                    </div>

                    {/* Progress Bonus or Limit Boost */}
                    <div className="bg-[#12192b] rounded-xl p-2.5 border border-white/10 flex items-start gap-2.5">
                      <span className="text-base mt-0.5">🚀</span>
                      <div>
                        <p className="text-[11px] font-black text-amber-400">
                          {bonusText}
                        </p>
                        <p className="text-[9px] text-slate-400">
                          Daily study consistency par extra boost
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Events Access Pills */}
                  <div className="mt-2 bg-[#12192b] rounded-xl p-2.5 border border-white/10">
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
    </div>
  );
};
export default StudentLevelPage;
