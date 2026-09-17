// @ts-nocheck
import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft, Sparkles, Rocket, BrainCircuit, MessageSquare,
  Users, School, Building2, ChevronRight, ChevronLeft, Clock, Trophy,
  Flame, CheckCircle, Zap, Tag, Gift, Bell, Calendar,
  ExternalLink, ShieldCheck, ArrowRight, Percent, Globe,
  Coins, TrendingUp, Palette, Check, Sparkle, Headphones
} from 'lucide-react';
import type { User, SystemSettings, Challenge20 } from '../types';
import { isDailyChallenge20, getChallengeDateKey } from '../utils/challengeGenerator';

interface Props {
  user: User;
  settings?: SystemSettings;
  tierTheme?: any;
  isDarkMode?: boolean;
  onBack: () => void;
  dailyChallenges?: Challenge20[];
  onStartDailyChallenge?: (challenge: Challenge20) => void;
  onClaimDailyChallenge?: (challenge: Challenge20) => void | Promise<void>;
  onOpenRevisionHub: () => void;
  onOpenMessenger: () => void;
  onOpenStudyRoom: () => void;
  onOpenStore?: () => void;
  onOpenThemeStudio?: () => void;
  onOpenPracticeMcq?: () => void;
  onOpenAudioStudio?: () => void;
  userSchool?: any;
  onOpenSchool?: () => void;
  onOpenSchoolPicker?: () => void;
  userCoachingId?: string | null;
  userCoachingName?: string | null;
  isCoachingAdmin?: boolean;
  onOpenCoaching?: () => void;
  onOpenCoachingPicker?: () => void;
}

interface EventItem {
  id: string;
  key?: string;
  title: string;
  badge: string;
  emoji: string;
  description: string;
  startsAt?: string;
  endsAt?: string;
  isLive: boolean;
  accent: string;
  gradient: string;
  actionText?: string;
  actionType?: 'MCQ' | 'STORE' | 'THEME_STUDIO' | 'EXPLORE' | 'REVISION';
  highlights?: string[];
}

function formatCountdown(targetMs: number, nowMs: number): string {
  const diff = targetMs - nowMs;
  if (diff <= 0) return '00:00:00';
  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => String(n).padStart(2, '0');

  if (days > 0) {
    return `${days}d ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
  }
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export const UpdatesPage: React.FC<Props> = ({
  user,
  settings,
  tierTheme,
  isDarkMode = false,
  onBack,
  dailyChallenges = [],
  onStartDailyChallenge,
  onClaimDailyChallenge,
  onOpenRevisionHub,
  onOpenMessenger,
  onOpenStudyRoom,
  onOpenStore,
  onOpenThemeStudio,
  onOpenPracticeMcq,
  onOpenAudioStudio,
  userSchool,
  onOpenSchool,
  onOpenSchoolPicker,
  userCoachingId,
  userCoachingName,
  isCoachingAdmin,
  onOpenCoaching,
  onOpenCoachingPicker,
}) => {
  const [activeBannerIdx, setActiveBannerIdx] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [isClaiming, setIsClaiming] = useState(false);

  // Live countdown timer ticking every 1 second
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Compute test attempts for Daily Challenge
  const testAttempts = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem(`nst_test_attempts_${user?.id}`) || '{}');
    } catch {
      return {};
    }
  }, [user?.id]);

  // Find today's daily challenge
  const activeDaily = useMemo(() => {
    return dailyChallenges.find((c) => isDailyChallenge20(c)) || null;
  }, [dailyChallenges]);

  const dailyStatus = useMemo(() => {
    if (!activeDaily) {
      // Check localStorage fallback
      const lastCompleted = localStorage.getItem('nst_last_daily_challenge_completed');
      const today = getChallengeDateKey();
      const isDone = lastCompleted === today;
      return {
        completed: isDone,
        claimed: isDone,
      };
    }
    const attempt = testAttempts[activeDaily.id];
    return {
      completed: !!attempt?.isCompleted,
      claimed: !!attempt?.claimed,
      score: attempt?.score || 0,
      totalQuestions: activeDaily.questions?.length || 100,
    };
  }, [activeDaily, testAttempts]);

  // Handler for banner & card action buttons
  const handleEventAction = (ev: EventItem) => {
    if (ev.actionType === 'THEME_STUDIO') {
      if (onOpenThemeStudio) {
        onOpenThemeStudio();
      } else {
        onBack();
        window.dispatchEvent(new CustomEvent('nst-open-tab', { detail: 'THEME_CUSTOMIZER' }));
      }
    } else if (ev.actionType === 'STORE') {
      if (onOpenStore) {
        onOpenStore();
      } else {
        onBack();
        window.dispatchEvent(new CustomEvent('nst-open-tab', { detail: 'STORE' }));
      }
    } else if (ev.actionType === 'MCQ') {
      if (onOpenPracticeMcq) {
        onOpenPracticeMcq();
      } else if (activeDaily && onStartDailyChallenge) {
        onStartDailyChallenge(activeDaily);
      } else {
        onBack();
        window.dispatchEvent(new CustomEvent('nst-open-tab', { detail: 'MCQ' }));
      }
    } else if (ev.actionType === 'EXPLORE') {
      onBack();
      window.dispatchEvent(new CustomEvent('nst-open-tab', { detail: 'HOME' }));
    } else {
      onOpenRevisionHub();
    }
  };

  // Gather exactly the 8 Admin Events in the requested sequence:
  // 1. Daily Limit Boost
  // 2. Credit Bonus Event
  // 3. Credit Free Event
  // 4. Global Free Access
  // 5. Special Discount (Validity-based)
  // 6. Discount Event (Flat Store Sale)
  // 7. Theme Studio
  // 8. Score Boost
  const eventsList: EventItem[] = useMemo(() => {
    const list: EventItem[] = [];

    // Helper to evaluate live vs coming soon status
    const calcStatus = (enabled?: boolean, startsAt?: string, endsAt?: string) => {
      // If not enabled by admin, it is coming soon
      if (!enabled) {
        return { isLive: false, badge: 'COMING SOON' };
      }
      const s = startsAt ? new Date(startsAt).getTime() : undefined;
      const e = endsAt ? new Date(endsAt).getTime() : undefined;
      // Scheduled for the future
      if (s && s > now) {
        return { isLive: false, badge: 'COMING SOON' };
      }
      // Expired or ended event
      if (e && e < now) {
        return { isLive: false, badge: 'COMING SOON' };
      }
      // Live now
      return { isLive: true, badge: 'LIVE' };
    };

    // 1. Daily Limit Boost Event
    const dailyLimitBoostEv = (settings as any)?.dailyLimitBoostEvent;
    const dlbStatus = calcStatus(
      dailyLimitBoostEv?.enabled,
      dailyLimitBoostEv?.startsAt,
      dailyLimitBoostEv?.endsAt
    );
    const freeB = dailyLimitBoostEv?.mcqBoostFree ?? 50;
    const basicB = dailyLimitBoostEv?.mcqBoostBasic ?? 100;
    const ultraB = dailyLimitBoostEv?.mcqBoostUltra ?? 200;
    list.push({
      id: 'ev-daily-limit-boost',
      key: 'dailyLimitBoost',
      title: dailyLimitBoostEv?.eventName || 'Daily Limit Boost',
      badge: dlbStatus.badge,
      emoji: '📈',
      description: `Daily MCQ aur score limits mein bhari badhotari! Free students ko +${freeB}, Basic ko +${basicB}, Ultra ko +${ultraB} extra daily test attempts milenge bina kisi deduction ke.`,
      startsAt: dailyLimitBoostEv?.startsAt,
      endsAt: dailyLimitBoostEv?.endsAt,
      isLive: dlbStatus.isLive,
      accent: '#6366f1',
      gradient: 'from-indigo-600 via-violet-600 to-purple-700',
      actionText: 'Attempt Extra MCQs',
      actionType: 'MCQ',
      highlights: [
        `Free Tier: +${freeB} extra tests/day`,
        `Basic Tier: +${basicB} extra tests/day`,
        `Ultra Tier: +${ultraB} extra attempts`,
      ],
    });

    // 2. Credit Bonus Event (MCQ Prizes & Gifts Bonus)
    const creditBonusEv = settings?.creditBonusEvent;
    const cbStatus = calcStatus(
      creditBonusEv?.enabled,
      creditBonusEv?.startsAt,
      creditBonusEv?.endsAt
    );
    const bonusPct = creditBonusEv?.bonusPercent ?? 50;
    list.push({
      id: 'ev-credit-bonus',
      key: 'creditBonus',
      title: creditBonusEv?.eventName || 'Credit Bonus Event',
      badge: cbStatus.badge,
      emoji: '🎁',
      description: `Sabhi MCQ rewards aur gift coins par +${bonusPct}% EXTRA bonus coins! Roz padhai karein aur dher saare extra coins jeetein.`,
      startsAt: creditBonusEv?.startsAt,
      endsAt: creditBonusEv?.endsAt,
      isLive: cbStatus.isLive,
      accent: '#22c55e',
      gradient: 'from-emerald-600 via-green-600 to-teal-700',
      actionText: 'Earn Bonus Coins',
      actionType: 'MCQ',
      highlights: [
        `+${bonusPct}% Extra Reward Coins`,
        creditBonusEv?.applyToMcqPrize !== false ? '✅ Applied to MCQ test prizes' : 'MCQ test prizes included',
        creditBonusEv?.applyToGifts !== false ? '✅ Applied to inbox gifts & rewards' : 'Special gifts included',
      ],
    });

    // 3. Credit Free Event (Zero-Coin Actions)
    const creditFreeEv = settings?.creditFreeEvent;
    const cfStatus = calcStatus(
      creditFreeEv?.enabled ?? (settings?.isCreditFreeEvent as any),
      (creditFreeEv as any)?.startsAt,
      (creditFreeEv as any)?.endsAt
    );
    list.push({
      id: 'ev-credit-free',
      key: 'creditFree',
      title: (creditFreeEv as any)?.eventName || 'Credit Free Event',
      badge: cfStatus.badge,
      emoji: '🪙',
      description: 'Sabhi credit-based actions temporarily 100% FREE hain! Bina kisi coin deduction ke practice tests, AI helpers aur PDF access karein.',
      startsAt: (creditFreeEv as any)?.startsAt,
      endsAt: (creditFreeEv as any)?.endsAt,
      isLive: cfStatus.isLive,
      accent: '#d97706',
      gradient: 'from-amber-600 via-orange-600 to-yellow-600',
      actionText: 'Zero-Coin Practice',
      actionType: 'MCQ',
      highlights: [
        '0 coins deducted per test',
        'Free content downloads & unlocks',
        'Wallet coins 100% protected',
      ],
    });

    // 4. Global Free Access
    const globalFreeEv = settings?.globalFreeAccessEvent;
    const gfStatus = calcStatus(
      globalFreeEv?.enabled ?? settings?.isGlobalFreeMode,
      globalFreeEv?.startsAt,
      globalFreeEv?.endsAt
    );
    list.push({
      id: 'ev-global-free',
      key: 'globalFree',
      title: globalFreeEv?.eventName || 'Global Free Access',
      badge: gfStatus.badge,
      emoji: '🌍',
      description: 'Sabhi premium video lectures, detailed notes, question banks aur test series temporarily sabhi students ke liye 100% FREE hai!',
      startsAt: globalFreeEv?.startsAt,
      endsAt: globalFreeEv?.endsAt,
      isLive: gfStatus.isLive,
      accent: '#10b981',
      gradient: 'from-teal-600 via-emerald-600 to-cyan-700',
      actionText: 'Explore All Free',
      actionType: 'EXPLORE',
      highlights: [
        'All premium chapters 100% unlocked',
        'Zero subscription requirement',
        'Full access to test solutions',
      ],
    });

    // 5. Special Discount (Validity-Based Offer)
    const validityEv = settings?.validityDiscountEvent;
    const vdStatus = calcStatus(
      validityEv?.enabled,
      validityEv?.startsAt,
      validityEv?.endsAt
    );
    const m = validityEv?.monthlyPercent ?? 10;
    const t = validityEv?.threeMonthlyPercent ?? 15;
    const s = validityEv?.sixMonthlyPercent ?? 20;
    const y = validityEv?.yearlyPercent ?? 25;
    list.push({
      id: 'ev-special-discount',
      key: 'specialDiscount',
      title: validityEv?.eventName || 'Special Discount',
      badge: vdStatus.badge,
      emoji: '✨',
      description: `Monthly (${m}%), 3-Month (${t}%), 6-Month (${s}%) aur Yearly (${y}% OFF) par step-up validities discount! Kam rate me plan upgrade karein.`,
      startsAt: validityEv?.startsAt,
      endsAt: validityEv?.endsAt,
      isLive: vdStatus.isLive,
      accent: '#8b5cf6',
      gradient: 'from-violet-600 via-purple-600 to-fuchsia-700',
      actionText: 'Check Validity Offers',
      actionType: 'STORE',
      highlights: [
        `1-Month: ${m}% OFF | 3-Month: ${t}% OFF`,
        `6-Month: ${s}% OFF | 1-Year: ${y}% OFF`,
        'Auto-applied on subscription checkout',
      ],
    });

    // 6. Discount Event (Flat Store Sale)
    const specialDiscEv = settings?.specialDiscountEvent;
    const sdStatus = calcStatus(
      specialDiscEv?.enabled,
      specialDiscEv?.startsAt,
      specialDiscEv?.endsAt
    );
    const discPct = specialDiscEv?.discountPercent ?? 20;
    list.push({
      id: 'ev-discount-event',
      key: 'discountEvent',
      title: specialDiscEv?.eventName || 'Discount Event',
      badge: sdStatus.badge,
      emoji: '🏷️',
      description: `Sabhi premium plans aur subscriptions par flat ${discPct}% ki bhari chhoot! Limited time mega flash sale ka turant labh uthayein.`,
      startsAt: specialDiscEv?.startsAt,
      endsAt: specialDiscEv?.endsAt,
      isLive: sdStatus.isLive,
      accent: '#ec4899',
      gradient: 'from-pink-600 via-rose-600 to-purple-700',
      actionText: 'Avail Store Discount',
      actionType: 'STORE',
      highlights: [
        `Flat ${discPct}% OFF on all plans`,
        specialDiscEv?.couponCode ? `Coupon Code: ${specialDiscEv.couponCode}` : 'Instant auto-applied discount',
        'Open for all students',
      ],
    });

    // 7. Theme Studio Event
    const themeStudioEv = (settings as any)?.themeStudioEvent;
    const tsStatus = calcStatus(
      themeStudioEv?.enabled,
      themeStudioEv?.startsAt,
      themeStudioEv?.endsAt
    );
    const studioDays = themeStudioEv?.days ?? 7;
    list.push({
      id: 'ev-theme-studio',
      key: 'themeStudio',
      title: themeStudioEv?.eventName || 'Theme Studio',
      badge: tsStatus.badge,
      emoji: '🎨',
      description: 'Theme Studio Festival! Custom themes, vibrant UI palettes, ambient gradient backgrounds aur animated card borders explore aur personalize karein.',
      startsAt: themeStudioEv?.startsAt,
      endsAt: themeStudioEv?.endsAt,
      isLive: tsStatus.isLive,
      accent: '#a855f7',
      gradient: 'from-fuchsia-600 via-purple-600 to-indigo-700',
      actionText: 'Open Theme Studio',
      actionType: 'THEME_STUDIO',
      highlights: [
        'Custom UI Themes & Presets',
        'Special Animated Card Borders',
        `${studioDays} Days Studio access window`,
      ],
    });

    // 8. Score Boost Event
    const scoreBoostEv = settings?.scoreBoostEvent;
    const sbStatus = calcStatus(
      scoreBoostEv?.enabled,
      scoreBoostEv?.startsAt,
      scoreBoostEv?.endsAt
    );
    const boostPct = scoreBoostEv?.boostPercent ?? 50;
    list.push({
      id: 'ev-score-boost',
      key: 'scoreBoost',
      title: scoreBoostEv?.eventName || 'Score Boost',
      badge: sbStatus.badge,
      emoji: '🚀',
      description: `Sabhi MCQ tests aur daily practice par +${boostPct}% extra XP score milega! Har practice se leaderboard me double speed se aage badhein.`,
      startsAt: scoreBoostEv?.startsAt,
      endsAt: scoreBoostEv?.endsAt,
      isLive: sbStatus.isLive,
      accent: '#f59e0b',
      gradient: 'from-amber-500 via-orange-600 to-rose-600',
      actionText: 'Boost My Score',
      actionType: 'MCQ',
      highlights: [
        `+${boostPct}% Extra Score on all tests`,
        'Fast XP & Level-up Accelerator',
        'Leaderboard rank boost multiplier',
      ],
    });

    // Custom active events from settings.activeEvents if configured
    if (settings?.activeEvents && Array.isArray(settings.activeEvents)) {
      settings.activeEvents.forEach((ev, i) => {
        if (!ev.enabled) return;
        list.push({
          id: `custom-ev-${i}`,
          key: `custom_${i}`,
          title: ev.title || 'Special App Event',
          badge: 'FEATURED',
          emoji: '🎉',
          description: ev.subtitle || 'App par chal rahe special offer aur update ka fayda uthayein.',
          isLive: true,
          accent: ev.bgColor || '#7c3aed',
          gradient: 'from-violet-600 via-indigo-600 to-purple-700',
          actionText: 'View Details',
          actionType: 'EXPLORE',
          highlights: ['Special community event', 'Live rewards active'],
        });
      });
    }

    return list;
  }, [settings, now]);

  // Auto cycle event banner every 5s if multiple events
  useEffect(() => {
    if (eventsList.length <= 1) return;
    const interval = setInterval(() => {
      setActiveBannerIdx((prev) => (prev + 1) % eventsList.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [eventsList.length]);

  const currentEvent = eventsList[activeBannerIdx] || eventsList[0];

  // Calculate live countdown text for current event
  const countdownDisplay = useMemo(() => {
    if (!currentEvent) return null;
    if (currentEvent.isLive && currentEvent.endsAt) {
      const endMs = new Date(currentEvent.endsAt).getTime();
      return {
        label: 'Offer Live Hai • Ending in',
        time: formatCountdown(endMs, now),
        isEnding: true,
      };
    } else if (currentEvent.isLive) {
      return {
        label: 'Offer Live Hai • Limited Time',
        time: 'Active Now • Labh Uthayein',
        isEnding: true,
      };
    } else if (!currentEvent.isLive && currentEvent.startsAt) {
      const startMs = new Date(currentEvent.startsAt).getTime();
      return {
        label: 'Offer Status • Starting in',
        time: formatCountdown(startMs, now),
        isEnding: false,
      };
    } else if (!currentEvent.isLive) {
      return {
        label: 'Offer Status',
        time: 'Coming Soon • Jaldi Shuru Hoga',
        isEnding: false,
      };
    }
    return null;
  }, [currentEvent, now]);

  const handleClaim = async () => {
    if (!activeDaily || !onClaimDailyChallenge || isClaiming) return;
    try {
      setIsClaiming(true);
      await onClaimDailyChallenge(activeDaily);
    } finally {
      setIsClaiming(false);
    }
  };

  // ── Theme-Derived Dynamic Styling (Synchronized with Home Page & Active Tier/Custom Theme) ──
  const themePrimary = tierTheme?.primary || '#2563eb';
  const themeMid     = tierTheme?.mid || themePrimary;
  const themeBorder  = settings?.homeClass612CardBorder || (tierTheme as any)?.cardBorderColor || tierTheme?.primary || themePrimary;
  const themeCardBg  = isDarkMode
    ? (settings?.darkThemeCardBg || tierTheme?.profileCardBg || '#0b0f17')
    : (settings?.lightThemeCardBg || tierTheme?.cardBg || '#ffffff');
  const themeBtnGrad = tierTheme?.btnGrad || `linear-gradient(135deg, ${themePrimary}, ${themeMid})`;
  const is3D         = settings?.homeAllCards3D ?? false;

  const homeCardStyle: React.CSSProperties = {
    background: themeCardBg,
    border: `2px solid ${themeBorder}`,
    boxShadow: is3D
      ? `0 1px 0 rgba(255,255,255,0.85) inset, 0 4px 0 ${themeBorder}bb, 0 7px 18px ${themeBorder}28`
      : (isDarkMode
          ? `0 4px 16px -2px rgba(0,0,0,0.5), 0 0 0 1px ${themeBorder}40`
          : `0 2px 10px -2px rgba(0,0,0,0.06), 0 0 0 1px ${themeBorder}25`),
    transform: is3D ? 'translateY(-1px)' : 'none',
  };

  const chipStyle: React.CSSProperties = {
    background: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'}`,
    color: isDarkMode ? '#cbd5e1' : '#475569',
  };

  return (
    <div className={`min-h-screen pb-28 ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800'}`}>
      {/* ── TOP APP BAR ── */}
      <div className={`sticky top-0 z-30 px-4 py-3.5 flex items-center justify-between backdrop-blur-md border-b ${
        isDarkMode ? 'bg-slate-950/85 border-slate-800' : 'bg-white/85 border-slate-200/80 shadow-xs'
      }`}>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className={`p-2 rounded-xl active:scale-95 transition-all cursor-pointer ${
              isDarkMode ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-600'
            }`}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-1.5">
              <Sparkles size={16} className="text-amber-500 fill-amber-500 animate-pulse" />
              <h1 className="text-base font-black tracking-tight">Updates & Central Hub</h1>
            </div>
            <p className="text-[10px] text-slate-400 font-medium">All Events, Daily Challenge & Portals</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-violet-100 text-violet-700 dark:bg-violet-950/80 dark:text-violet-300 border border-violet-200 dark:border-violet-800">
            Hub 2.0
          </span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 pt-4 space-y-5">
        {/* ── 1. FEATURED EVENT CARD (SAME CARD SIZE & LOOK, FULL DETAILS IN CRISP COMPACT TEXT) ── */}
        {currentEvent && (
          <div
            className="nst-card-animated relative rounded-2xl p-4.5 flex flex-col justify-between active:scale-[0.985] transition-all"
            style={homeCardStyle}
          >
            <div className="space-y-3">
              {/* Header: Event Emoji + Title & Subtitle + Live/Soon Badge & Switcher */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-xs bg-gradient-to-br ${currentEvent.gradient} text-white`}
                  >
                    <span className="text-2xl drop-shadow-xs">{currentEvent.emoji}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-black text-slate-900 dark:text-white truncate">
                        {currentEvent.title}
                      </h4>
                      {eventsList.length > 1 && (
                        <div
                          className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold shrink-0"
                          style={chipStyle}
                        >
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveBannerIdx((prev) => (prev > 0 ? prev - 1 : eventsList.length - 1));
                            }}
                            className="p-0.5 rounded hover:opacity-75 active:scale-95 transition-all cursor-pointer"
                            title="Previous Event"
                          >
                            <ChevronLeft size={12} />
                          </button>
                          <span className="font-mono">
                            {activeBannerIdx + 1}/{eventsList.length}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveBannerIdx((prev) => (prev < eventsList.length - 1 ? prev + 1 : 0));
                            }}
                            className="p-0.5 rounded hover:opacity-75 active:scale-95 transition-all cursor-pointer"
                            title="Next Event"
                          >
                            <ChevronRight size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">
                      {currentEvent.description}
                    </p>
                  </div>
                </div>

                <span
                  className={`px-2.5 py-1 rounded-xl text-[10px] font-black shrink-0 uppercase tracking-wider shadow-2xs select-none ${
                    currentEvent.isLive
                      ? 'bg-emerald-500 text-white'
                      : 'bg-amber-400 text-slate-950 ring-1 ring-amber-300'
                  }`}
                >
                  {currentEvent.isLive ? '🟢 LIVE' : '⏳ COMING SOON'}
                </span>
              </div>

              {/* Details & Highlights & Live Countdown Chips (Chhote text me saare details bina kam kiye) */}
              <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold">
                {countdownDisplay && (
                  <span
                    className="px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-2xs"
                    style={{
                      background: currentEvent.isLive ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                      border: `1px solid ${currentEvent.isLive ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                      color: currentEvent.isLive ? '#059669' : '#d97706',
                    }}
                  >
                    <Clock size={12} className={`shrink-0 ${currentEvent.isLive ? 'animate-spin' : ''}`} style={{ animationDuration: '6s' }} />
                    <span>{countdownDisplay.label}:</span>
                    <span className="font-mono font-black">{countdownDisplay.time}</span>
                  </span>
                )}

                {currentEvent.highlights && currentEvent.highlights.map((hl, hIdx) => (
                  <span key={hIdx} className="px-2.5 py-1 rounded-lg" style={chipStyle}>
                    ✨ {hl}
                  </span>
                ))}
              </div>
            </div>

            {/* Event Action Button */}
            {currentEvent.actionText && (
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => handleEventAction(currentEvent)}
                  className="w-full py-2.5 rounded-xl text-xs font-black shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
                  style={{
                    background: themeBtnGrad,
                    color: '#ffffff',
                    boxShadow: `0 4px 14px ${themePrimary}35`,
                  }}
                >
                  <span>{currentEvent.actionText}</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── SECTION HEADER ── */}
        <div className="flex items-center justify-between px-1 pt-1">
          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full animate-ping shrink-0"
              style={{ background: themePrimary }}
            />
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
              Apps, Tools & Portals
            </h3>
          </div>
          <span
            className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full"
            style={{
              background: `${themeBorder}18`,
              color: themeBorder,
              border: `1px solid ${themeBorder}30`,
            }}
          >
            All Features
          </span>
        </div>

        {/* ── 2. CARDS GRID (HOME PAGE CARD STYLE & THEME COLOR REACTIVE) ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* ── CARD 1: DAILY CHALLENGE 2.0 ── */}
          <div
            className="nst-card-animated relative rounded-2xl p-4.5 flex flex-col justify-between active:scale-[0.985] transition-all"
            style={homeCardStyle}
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-xs"
                    style={{ background: `${themeBorder}18`, color: themeBorder }}
                  >
                    <Rocket size={22} />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900 dark:text-white">Daily Challenge</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Sabhi students ke liye 100 MCQs ka timed test</p>
                  </div>
                </div>
                <span
                  className="px-2.5 py-1 rounded-xl text-[10px] font-black shrink-0 uppercase tracking-wider shadow-2xs"
                  style={{
                    background: `${themeBorder}18`,
                    color: themeBorder,
                    border: `1px solid ${themeBorder}35`,
                  }}
                >
                  +100 XP
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold">
                <span className="px-2.5 py-1 rounded-lg" style={chipStyle}>
                  🎯 100 MCQs
                </span>
                <span className="px-2.5 py-1 rounded-lg" style={chipStyle}>
                  ⏱️ 60 Min
                </span>
                <span className="px-2.5 py-1 rounded-lg" style={chipStyle}>
                  🏆 Fair Seeded Leaderboard
                </span>
              </div>
            </div>

            {/* Daily Challenge Action */}
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
              {dailyStatus.completed ? (
                dailyStatus.claimed ? (
                  <div className="w-full py-2.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center justify-center gap-1.5 text-xs font-black text-emerald-700 dark:text-emerald-300">
                    <CheckCircle size={15} />
                    <span>Aaj Ka Challenge Complete (+100 XP Claimed)</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleClaim}
                    disabled={isClaiming}
                    className="w-full py-2.5 rounded-xl text-xs font-black shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
                    style={{
                      background: 'linear-gradient(135deg, #f59e0b, #ea580c)',
                      color: '#ffffff',
                    }}
                  >
                    <Gift size={15} />
                    <span>{isClaiming ? 'Claim ho raha hai...' : '🎁 Claim +100 XP Reward'}</span>
                  </button>
                )
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (activeDaily && onStartDailyChallenge) {
                      onStartDailyChallenge(activeDaily);
                    }
                  }}
                  className="w-full py-2.5 rounded-xl text-xs font-black shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
                  style={{
                    background: themeBtnGrad,
                    color: '#ffffff',
                    boxShadow: `0 4px 14px ${themePrimary}35`,
                  }}
                >
                  <Rocket size={15} />
                  <span>Start Daily Challenge →</span>
                </button>
              )}
            </div>
          </div>

          {/* ── CARD 2: REVISION HUB ── */}
          <div
            className="nst-card-animated relative rounded-2xl p-4.5 flex flex-col justify-between active:scale-[0.985] transition-all"
            style={homeCardStyle}
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-xs"
                    style={{ background: `${themeBorder}18`, color: themeBorder }}
                  >
                    <BrainCircuit size={22} />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900 dark:text-white">Revision Hub</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Smart spaced repetition & flashcards drill</p>
                  </div>
                </div>
                <span
                  className="px-2.5 py-1 rounded-xl text-[10px] font-black shrink-0 uppercase tracking-wider shadow-2xs"
                  style={{
                    background: `${themeBorder}18`,
                    color: themeBorder,
                    border: `1px solid ${themeBorder}35`,
                  }}
                >
                  Smart AI
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold">
                <span className="px-2.5 py-1 rounded-lg" style={chipStyle}>
                  🧠 Spaced Repetition
                </span>
                <span className="px-2.5 py-1 rounded-lg" style={chipStyle}>
                  📝 Quick Notes
                </span>
                <span className="px-2.5 py-1 rounded-lg" style={chipStyle}>
                  ⚡ Weak MCQs
                </span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={onOpenRevisionHub}
                className="w-full py-2.5 rounded-xl text-xs font-black shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
                style={{
                  background: themeBtnGrad,
                  color: '#ffffff',
                  boxShadow: `0 4px 14px ${themePrimary}35`,
                }}
              >
                <span>Open Revision Hub →</span>
              </button>
            </div>
          </div>

          {/* ── CARD 3: NSTA MESSENGER ── */}
          <div
            className="nst-card-animated relative rounded-2xl p-4.5 flex flex-col justify-between active:scale-[0.985] transition-all"
            style={homeCardStyle}
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-xs"
                    style={{ background: `${themeBorder}18`, color: themeBorder }}
                  >
                    <MessageSquare size={22} />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900 dark:text-white">Nsta Messenger</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Classmates chat, doubts & study groups</p>
                  </div>
                </div>
                <span
                  className="px-2.5 py-1 rounded-xl text-[10px] font-black shrink-0 uppercase tracking-wider shadow-2xs"
                  style={{
                    background: `${themeBorder}18`,
                    color: themeBorder,
                    border: `1px solid ${themeBorder}35`,
                  }}
                >
                  Instant Chat
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold">
                <span className="px-2.5 py-1 rounded-lg" style={chipStyle}>
                  💬 1-on-1 Messages
                </span>
                <span className="px-2.5 py-1 rounded-lg" style={chipStyle}>
                  👨‍🦱 Find Classmates
                </span>
                <span className="px-2.5 py-1 rounded-lg" style={chipStyle}>
                  🔒 PIN Lock
                </span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={onOpenMessenger}
                className="w-full py-2.5 rounded-xl text-xs font-black shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
                style={{
                  background: themeBtnGrad,
                  color: '#ffffff',
                  boxShadow: `0 4px 14px ${themePrimary}35`,
                }}
              >
                <span>Open Nsta Messenger →</span>
              </button>
            </div>
          </div>

          {/* ── CARD 4: STUDY ROOM (GROUP STUDY) ── */}
          <div
            className="nst-card-animated relative rounded-2xl p-4.5 flex flex-col justify-between active:scale-[0.985] transition-all"
            style={homeCardStyle}
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-xs"
                    style={{ background: `${themeBorder}18`, color: themeBorder }}
                  >
                    <Users size={22} />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900 dark:text-white">Study Room</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Virtual study rooms with peers & focus timer</p>
                  </div>
                </div>
                <span
                  className="px-2.5 py-1 rounded-xl text-[10px] font-black shrink-0 uppercase tracking-wider shadow-2xs"
                  style={{
                    background: `${themeBorder}18`,
                    color: themeBorder,
                    border: `1px solid ${themeBorder}35`,
                  }}
                >
                  Focus Mode
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold">
                <span className="px-2.5 py-1 rounded-lg" style={chipStyle}>
                  ⏱️ Pomodoro Timer
                </span>
                <span className="px-2.5 py-1 rounded-lg" style={chipStyle}>
                  👥 Live Classmates
                </span>
                <span className="px-2.5 py-1 rounded-lg" style={chipStyle}>
                  🎧 Silent Study
                </span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={onOpenStudyRoom}
                className="w-full py-2.5 rounded-xl text-xs font-black shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
                style={{
                  background: themeBtnGrad,
                  color: '#ffffff',
                  boxShadow: `0 4px 14px ${themePrimary}35`,
                }}
              >
                <span>Join Study Room →</span>
              </button>
            </div>
          </div>

          {/* ── CARD 5: SCHOOL PORTAL ── */}
          <div
            className="nst-card-animated relative rounded-2xl p-4.5 flex flex-col justify-between active:scale-[0.985] transition-all"
            style={homeCardStyle}
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-xs"
                    style={{ background: `${themeBorder}18`, color: themeBorder }}
                  >
                    <School size={22} />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-black text-slate-900 dark:text-white truncate">
                      {userSchool?.name || 'School Portal'}
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {userSchool ? `School Code: ${userSchool.code || userSchool.id}` : 'Connect school for timetable & notice board'}
                    </p>
                  </div>
                </div>
                <span
                  className="px-2.5 py-1 rounded-xl text-[10px] font-black shrink-0 uppercase tracking-wider shadow-2xs"
                  style={{
                    background: `${themeBorder}18`,
                    color: themeBorder,
                    border: `1px solid ${themeBorder}35`,
                  }}
                >
                  {userSchool ? 'Joined' : 'Connect School'}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold">
                <span className="px-2.5 py-1 rounded-lg" style={chipStyle}>
                  📅 Timetable
                </span>
                <span className="px-2.5 py-1 rounded-lg" style={chipStyle}>
                  📋 Homework Sync
                </span>
                <span className="px-2.5 py-1 rounded-lg" style={chipStyle}>
                  📢 School Notices
                </span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
              {userSchool ? (
                <>
                  <button
                    type="button"
                    onClick={onOpenSchool}
                    className="flex-1 py-2.5 rounded-xl text-xs font-black shadow-md flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-98"
                    style={{
                      background: themeBtnGrad,
                      color: '#ffffff',
                      boxShadow: `0 4px 14px ${themePrimary}35`,
                    }}
                  >
                    <span>Open School Dashboard</span>
                  </button>
                  <button
                    type="button"
                    onClick={onOpenSchoolPicker}
                    className={`px-3 py-2.5 rounded-xl text-xs font-bold border active:scale-95 transition-all cursor-pointer ${
                      isDarkMode ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    Change
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={onOpenSchoolPicker || onOpenSchool}
                  className="w-full py-2.5 rounded-xl text-xs font-black shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
                  style={{
                    background: themeBtnGrad,
                    color: '#ffffff',
                    boxShadow: `0 4px 14px ${themePrimary}35`,
                  }}
                >
                  <School size={15} />
                  <span>Join / Connect School →</span>
                </button>
              )}
            </div>
          </div>

          {/* ── CARD 6: COACHING PORTAL ── */}
          <div
            className="nst-card-animated relative rounded-2xl p-4.5 flex flex-col justify-between active:scale-[0.985] transition-all"
            style={homeCardStyle}
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-xs"
                    style={{ background: `${themeBorder}18`, color: themeBorder }}
                  >
                    <Building2 size={22} />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-black text-slate-900 dark:text-white truncate">
                      {userCoachingName || 'Coaching Classes'}
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {userCoachingId ? 'Batch homework, tests & assignments' : 'Connect coaching institute for batch classes'}
                    </p>
                  </div>
                </div>
                <span
                  className="px-2.5 py-1 rounded-xl text-[10px] font-black shrink-0 uppercase tracking-wider shadow-2xs"
                  style={{
                    background: `${themeBorder}18`,
                    color: themeBorder,
                    border: `1px solid ${themeBorder}35`,
                  }}
                >
                  {userCoachingId ? 'Enrolled' : 'Join Coaching'}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold">
                <span className="px-2.5 py-1 rounded-lg" style={chipStyle}>
                  📚 Batch Lectures
                </span>
                <span className="px-2.5 py-1 rounded-lg" style={chipStyle}>
                  📝 Homework & DPP
                </span>
                <span className="px-2.5 py-1 rounded-lg" style={chipStyle}>
                  📊 Institute Tests
                </span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
              {isCoachingAdmin ? (
                <button
                  type="button"
                  onClick={onOpenCoaching}
                  className="w-full py-2.5 rounded-xl text-xs font-black shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
                  style={{
                    background: themeBtnGrad,
                    color: '#ffffff',
                    boxShadow: `0 4px 14px ${themePrimary}35`,
                  }}
                >
                  <Building2 size={15} />
                  <span>Manage Coaching Institute →</span>
                </button>
              ) : userCoachingId ? (
                <>
                  <button
                    type="button"
                    onClick={onOpenCoaching}
                    className="flex-1 py-2.5 rounded-xl text-xs font-black shadow-md flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-98"
                    style={{
                      background: themeBtnGrad,
                      color: '#ffffff',
                      boxShadow: `0 4px 14px ${themePrimary}35`,
                    }}
                  >
                    <span>View Coaching Batch</span>
                  </button>
                  <button
                    type="button"
                    onClick={onOpenCoachingPicker}
                    className={`px-3 py-2.5 rounded-xl text-xs font-bold border active:scale-95 transition-all cursor-pointer ${
                      isDarkMode ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    Change
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={onOpenCoachingPicker || onOpenCoaching}
                  className="w-full py-2.5 rounded-xl text-xs font-black shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
                  style={{
                    background: themeBtnGrad,
                    color: '#ffffff',
                    boxShadow: `0 4px 14px ${themePrimary}35`,
                  }}
                >
                  <Building2 size={15} />
                  <span>Join Coaching Institute →</span>
                </button>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
