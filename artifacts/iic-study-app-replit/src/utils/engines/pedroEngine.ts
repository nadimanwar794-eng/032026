import { User } from '../../types';
import { SubscriptionEngine } from './subscriptionEngine';
import { getLevelInfo } from '../levelSystem';

export interface PedroLevelConfig {
  level: number;
  title: string;
  badge: string;
  icon: string;
  summary: string;
  description?: string;
  visualLook: string;
  minScore: number;
  minXp?: number;
  nextLevelXp?: number;
  topBarState: {
    showStreakButton: boolean;
    showMailboxButton: boolean;
  };
  features: {
    appGuide: boolean;
    dailyStreakAnnounce: boolean;
    requiredReadingTime: boolean;
    mailboxNotifications: boolean;
    rewardExpiryReminders: boolean;
    autoClaimMailbox: boolean;
    autoClaimVip: boolean;
    studyFocusBooster: boolean;
    roomCommander: boolean;
  };
  powers: string[];
  perks?: string[];
}

export const PEDRO_LEVELS: PedroLevelConfig[] = [
  {
    level: 1,
    title: 'Rookie Mascot (Sar / Head Only)',
    badge: 'Head Only',
    icon: '👤',
    summary: 'Pedro ka bas sar dikhega! Top bar par Mailbox aur Streak buttons visible rahenge.',
    description: 'Pedro ka bas sar dikhega! Top bar par Mailbox aur Streak buttons visible rahenge.',
    visualLook: 'Bas sar dikhega (Only head visible)',
    minScore: 0,
    minXp: 0,
    nextLevelXp: 1000,
    topBarState: {
      showStreakButton: true,
      showMailboxButton: true,
    },
    features: {
      appGuide: true,
      dailyStreakAnnounce: false,
      requiredReadingTime: false,
      mailboxNotifications: false,
      rewardExpiryReminders: false,
      autoClaimMailbox: false,
      autoClaimVip: false,
      studyFocusBooster: false,
      roomCommander: false,
    },
    powers: [
      'Pedro Look: Bas sar dikhega (Head only view)',
      'Interactive App Guide for all pages & features',
      'Top bar par Mailbox aur Streak buttons dono visible',
      'VIP Subscription 24-hr Expiry Warning on login'
    ],
    perks: [
      'Pedro Look: Bas sar dikhega (Head only view)',
      'Interactive App Guide for all pages & features',
      'Top bar par Mailbox aur Streak buttons dono visible',
      'VIP Subscription 24-hr Expiry Warning on login'
    ],
  },
  {
    level: 2,
    title: 'Robo-Guide (Haath Aayenge)',
    badge: 'Arms Unlocked',
    icon: '🦾',
    summary: 'Pedro ke haath aayenge! Streak button gayab, Pedro khud daily streak announce karega & Required reading time batayega.',
    description: 'Pedro ke haath aayenge! Streak button gayab, Pedro khud daily streak announce karega & Required reading time batayega.',
    visualLook: 'Haath aayenge (Robotic arms appear)',
    minScore: 1000,
    minXp: 1000,
    nextLevelXp: 2500,
    topBarState: {
      showStreakButton: false, // Streak button gayab ho jayega
      showMailboxButton: true,
    },
    features: {
      appGuide: true,
      dailyStreakAnnounce: true,
      requiredReadingTime: true,
      mailboxNotifications: false,
      rewardExpiryReminders: false,
      autoClaimMailbox: false,
      autoClaimVip: false,
      studyFocusBooster: false,
      roomCommander: false,
    },
    powers: [
      'Pedro Look: Haath aayenge (Arms & hands unlocked)',
      'Top bar se Streak button gayab (clean minimal top bar)',
      'Streak ka koi popup nahi aayega — Pedro khud daily announce karega',
      'Required Reading Time: Kis page ko kitna der padhna hai Pedro batayega'
    ],
    perks: [
      'Pedro Look: Haath aayenge (Arms & hands unlocked)',
      'Top bar se Streak button gayab (clean minimal top bar)',
      'Streak ka koi popup nahi aayega — Pedro khud daily announce karega',
      'Required Reading Time: Kis page ko kitna der padhna hai Pedro batayega'
    ],
  },
  {
    level: 3,
    title: 'Complete Humanoid (Pair Bhi Aayenge)',
    badge: 'Legs Unlocked',
    icon: '🦿',
    summary: 'Pedro ke pair bhi aayenge! Mailbox ke updates radar aur circulars ka Pedro alert dega.',
    description: 'Pedro ke pair bhi aayenge! Mailbox ke updates radar aur circulars ka Pedro alert dega.',
    visualLook: 'Pair bhi aayenge (Full legs & feet appear)',
    minScore: 2500,
    minXp: 2500,
    nextLevelXp: 5000,
    topBarState: {
      showStreakButton: false,
      showMailboxButton: true,
    },
    features: {
      appGuide: true,
      dailyStreakAnnounce: true,
      requiredReadingTime: true,
      mailboxNotifications: true,
      rewardExpiryReminders: false,
      autoClaimMailbox: false,
      autoClaimVip: false,
      studyFocusBooster: false,
      roomCommander: false,
    },
    powers: [
      'Pedro Look: Pair bhi aayenge (Full character legs & thrusters)',
      'Mailbox circulars & update announcements live radar',
      'Naya study material ya notice aate hi Pedro voice announcement karega'
    ],
    perks: [
      'Pedro Look: Pair bhi aayenge (Full character legs & thrusters)',
      'Mailbox circulars & update announcements live radar',
      'Naya study material ya notice aate hi Pedro voice announcement karega'
    ],
  },
  {
    level: 4,
    title: 'Titan Guardian (Glow Hat Jayega & Pedro Bara Ho Jayega)',
    badge: 'No Glow & Mega Size',
    icon: '⚡',
    summary: 'Background glow hat jayega aur Pedro bara ho jayega! Reward expire hone se pehle alert karega.',
    description: 'Background glow hat jayega aur Pedro bara ho jayega! Reward expire hone se pehle alert karega.',
    visualLook: 'Glow hat jayega & Pedro bara ho jayega',
    minScore: 5000,
    minXp: 5000,
    nextLevelXp: 10000,
    topBarState: {
      showStreakButton: false,
      showMailboxButton: true,
    },
    features: {
      appGuide: true,
      dailyStreakAnnounce: true,
      requiredReadingTime: true,
      mailboxNotifications: true,
      rewardExpiryReminders: true,
      autoClaimMailbox: false,
      autoClaimVip: false,
      studyFocusBooster: false,
      roomCommander: false,
    },
    powers: [
      'Pedro Look: Background glow hat jayega aur Pedro bara ho jayega',
      '24-hour reward expiration proactive countdown alert',
      'Store discount & daily task claim deadline reminders'
    ],
    perks: [
      'Pedro Look: Background glow hat jayega aur Pedro bara ho jayega',
      '24-hour reward expiration proactive countdown alert',
      'Store discount & daily task claim deadline reminders'
    ],
  },
  {
    level: 5,
    title: 'Autonomous Scholar (Chasma Pahnega)',
    badge: 'Glasses On',
    icon: '👓',
    summary: 'Pedro stylish chasma pahnega! Mailbox ke free rewards Pedro khud se claim kar lega, Top bar se Mailbox gayab.',
    description: 'Pedro stylish chasma pahnega! Mailbox ke free rewards Pedro khud se claim kar lega, Top bar se Mailbox gayab.',
    visualLook: 'Chasma pahnega (Smart 3D specs unlocked)',
    minScore: 10000,
    minXp: 10000,
    nextLevelXp: 25000,
    topBarState: {
      showStreakButton: false,
      showMailboxButton: false, // Top bar se Mailbox gayab ho jayega
    },
    features: {
      appGuide: true,
      dailyStreakAnnounce: true,
      requiredReadingTime: true,
      mailboxNotifications: true,
      rewardExpiryReminders: true,
      autoClaimMailbox: true,
      autoClaimVip: false,
      studyFocusBooster: false,
      roomCommander: false,
    },
    powers: [
      'Pedro Look: Chasma pahnega (Futuristic golden smart glasses)',
      'Top bar se Mailbox button gayab (Pedro handles all inbox claims!)',
      'Free coins, gifts aur routine task bonus rewards automatic claim'
    ],
    perks: [
      'Pedro Look: Chasma pahnega (Futuristic golden smart glasses)',
      'Top bar se Mailbox button gayab (Pedro handles all inbox claims!)',
      'Free coins, gifts aur routine task bonus rewards automatic claim'
    ],
  },
  {
    level: 6,
    title: 'Rocket Aviator (Headphone & Pichhe Aag Wala Booster)',
    badge: 'Headphone & Rocket',
    icon: '🎧',
    summary: 'Headphone pahnega aur booster lag jayenge pichhe aag ke saath! VIP daily diamond & credits drop auto-claim.',
    description: 'Headphone pahnega aur booster lag jayenge pichhe aag ke saath! VIP daily diamond & credits drop auto-claim.',
    visualLook: 'Headphone pahnega & pichhe booster aag ke saath',
    minScore: 25000,
    minXp: 25000,
    nextLevelXp: 75000,
    topBarState: {
      showStreakButton: false,
      showMailboxButton: false,
    },
    features: {
      appGuide: true,
      dailyStreakAnnounce: true,
      requiredReadingTime: true,
      mailboxNotifications: true,
      rewardExpiryReminders: true,
      autoClaimMailbox: true,
      autoClaimVip: true,
      studyFocusBooster: false,
      roomCommander: false,
    },
    powers: [
      'Pedro Look: Headphone pahnega aur pichhe booster aag ke saath',
      'Daily VIP Diamond drop automatic claim',
      'Daily VIP Credits drop automatic claim bina manual click ke'
    ],
    perks: [
      'Pedro Look: Headphone pahnega aur pichhe booster aag ke saath',
      'Daily VIP Diamond drop automatic claim',
      'Daily VIP Credits drop automatic claim bina manual click ke'
    ],
  },
  {
    level: 7,
    title: 'NSTA Magician & Supreme Chroma (Magic Book + 2 Color Themes)',
    badge: 'Magic Book & 2 Colors',
    icon: '📖',
    summary: 'Pedro haath me NSTA ki book lega aur gayab karega + 2 Colors (Cosmic Purple & Cyber Cyan) unlock honge! Proactive study streak & deep focus.',
    description: 'Pedro haath me NSTA ki book lega aur gayab karega + 2 Colors (Cosmic Purple & Cyber Cyan) unlock honge! Proactive study streak & deep focus.',
    visualLook: 'NSTA magic book haath me lega + 2 Color change options',
    minScore: 75000,
    minXp: 75000,
    nextLevelXp: 200000,
    topBarState: {
      showStreakButton: false,
      showMailboxButton: false,
    },
    features: {
      appGuide: true,
      dailyStreakAnnounce: true,
      requiredReadingTime: true,
      mailboxNotifications: true,
      rewardExpiryReminders: true,
      autoClaimMailbox: true,
      autoClaimVip: true,
      studyFocusBooster: true,
      roomCommander: false,
    },
    powers: [
      'Pedro Look: NSTA ka book lega haath me aur magic se gayab karega',
      '2 Color Change Options Unlocked (Cosmic Purple vs Cyber Cyan)',
      'Proactive routine track & smart revision booster reminders',
      'Deep study focus recommendations & streak bonus multipliers'
    ],
    perks: [
      'Pedro Look: NSTA ka book lega haath me aur magic se gayab karega',
      '2 Color Change Options Unlocked (Cosmic Purple vs Cyber Cyan)',
      'Proactive routine track & smart revision booster reminders',
      'Deep study focus recommendations & streak bonus multipliers'
    ],
  },
  {
    level: 8,
    title: 'Supreme Overdrive (24h 2x Study XP + Bonus Credits)',
    badge: '🔥 24h 2x Overdrive',
    icon: '⚡',
    summary: 'Primary study mode me 2x XP (Double XP) + Saath me Free Credits! 24 hours active rehta hai, phir Level 7 par drop hokar 6-7 din recharge hota hai.',
    description: 'Primary study mode me 2x XP (Double XP) + Saath me Free Credits! 24 hours active rehta hai, phir Level 7 par drop hokar 6-7 din recharge hota hai.',
    visualLook: 'Golden Champion Crown 👑 + Fiery Supercharged Booster',
    minScore: 200000,
    minXp: 200000,
    nextLevelXp: undefined,
    topBarState: {
      showStreakButton: false,
      showMailboxButton: false,
    },
    features: {
      appGuide: true,
      dailyStreakAnnounce: true,
      requiredReadingTime: true,
      mailboxNotifications: true,
      rewardExpiryReminders: true,
      autoClaimMailbox: true,
      autoClaimVip: true,
      studyFocusBooster: true,
      roomCommander: true,
    },
    powers: [
      'Primary Study Mode: 2x XP (Double score jitna mila utna aur add ho jayega)',
      'Instant Matching Credits: Har study XP ke barabar bonus Credits wallet me add honge',
      '24-Hour Active Window: 24 ghante baad automatically Level 7 par drop hoga',
      'Recharge Cycle: Level 7 par rehte hue 6 din (warna 7 din) me fully recharge hoga'
    ],
    perks: [
      'Primary Study Mode: 2x XP (Double score jitna mila utna aur add ho jayega)',
      'Instant Matching Credits: Har study XP ke barabar bonus Credits wallet me add honge',
      '24-Hour Active Window: 24 ghante baad automatically Level 7 par drop hoga',
      'Recharge Cycle: Level 7 par rehte hue 6 din (warna 7 din) me fully recharge hoga'
    ],
  },
];

export interface PedroL8OverdriveInfo {
  isActive: boolean;
  isCharging: boolean;
  canActivate: boolean;
  hoursRemaining: number;
  minutesRemaining: number;
  secondsRemaining: number;
  chargeDaysTotal: number;
  chargeDaysRemaining: number;
  chargePercent: number;
  expiresAt: number;
}

export interface PedroEnergyStatus {
  energyPct: number;
  isSleeping: boolean;
  isUltraShielded: boolean;
  tiredReason?: string;
  reviveStudyMinsRequired: number;
  reviveStudyMinsDone: number;
  canReviveNow: boolean;
}

export interface PedroPenaltyState {
  hasPenalty: boolean;
  isNaraj: boolean;
  originalLevel: number;
  currentPenaltyLevel: number;
  targetLevel: number;
  daysNeeded: number;
  daysCompleted: number;
  daysRemaining: number;
  reason: string;
  penaltyDate: string;
}

export const PedroEngine = {
  /**
   * Retrieves Pedro's own Mascot level (1 to 8), saved on user profile.
   * Separate from student's study/exam level.
   */
  getPedroBaseLevel: (user: User | null | undefined): number => {
    if (!user) return 1;
    if (typeof user.pedroLevel === 'number' && user.pedroLevel >= 1) {
      return Math.min(8, Math.max(1, user.pedroLevel));
    }
    try {
      if (typeof window !== 'undefined') {
        const stored = (user.id ? localStorage.getItem(`nst_pedro_level_${user.id}`) : null) || localStorage.getItem('pedro_level');
        if (stored) return Math.min(8, Math.max(1, Number(stored)));
      }
    } catch {}
    return 1;
  },

  /**
   * Updates and saves Pedro's level for user profile in app
   */
  setPedroLevel: (user: User, newLevel: number): User => {
    const clamped = Math.min(8, Math.max(1, newLevel));
    const updated = { ...user, pedroLevel: clamped };
    try {
      if (typeof window !== 'undefined') {
        if (user.id) localStorage.setItem(`nst_pedro_level_${user.id}`, String(clamped));
        localStorage.setItem('pedro_level', String(clamped));
        window.dispatchEvent(new CustomEvent('nst-pedro-level-change', { detail: { level: clamped } }));
      }
    } catch {}
    return updated;
  },

  /**
   * Calculates effective Pedro level:
   * - Based on Pedro's own mascot level (user.pedroLevel), distinct from student study level.
   * - If streak broken: Level drops by 1 (proportional recovery needed).
   * - Level 8 is a 24-hour Supercharged state.
   * - Once 24 hours expire, Pedro drops to Level 7 and recharges over 6-7 days.
   * - Ultra VIP / Pedro Level 8 students enter Level 8 when Overdrive is active.
   */
  getEffectiveLevel: (user: User | null | undefined): number => {
    if (!user) return 1;

    // Use Pedro's own mascot level, separate from user's study level!
    const pedroBase = PedroEngine.getPedroBaseLevel(user);

    // 1. Check if user has an active streak break penalty
    const penalty = PedroEngine.getPenaltyState(user.id, pedroBase);
    if (penalty.hasPenalty) {
      return Math.max(1, penalty.currentPenaltyLevel);
    }

    const isUltra =
      SubscriptionEngine.isPremium(user) &&
      (user.subscriptionLevel === 'ULTRA' || user.subscriptionTier === 'ULTRA' || user.subscriptionTier === 'LIFETIME');

    // 2. Ultra / Max subscribers get Pedro Level 8 till subscription!
    if (isUltra) {
      return 8;
    }

    if (pedroBase >= 8) {
      const active = PedroEngine.isL8OverdriveActive(user.id, pedroBase, isUltra);
      if (active) return 8;
      return 8;
    }

    return Math.min(8, Math.max(1, pedroBase));
  },

  /**
   * Get current streak break recharge / cooldown state (Clean Premium Mode)
   */
  getPenaltyState: (userId: string | undefined | null, userLevel?: number): PedroPenaltyState => {
    const defaultState: PedroPenaltyState = {
      hasPenalty: false,
      isNaraj: false,
      originalLevel: userLevel || 1,
      currentPenaltyLevel: userLevel || 1,
      targetLevel: userLevel || 1,
      daysNeeded: 0,
      daysCompleted: 0,
      daysRemaining: 0,
      reason: '',
      penaltyDate: '',
    };
    if (!userId) return defaultState;

    try {
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem(`nst_pedro_penalty_${userId}`);
        if (!raw) return defaultState;
        const parsed = JSON.parse(raw);
        if (!parsed || !parsed.hasPenalty) return defaultState;

        const daysNeeded = parsed.daysNeeded || Math.max(1, (parsed.targetLevel || 2) - 1);
        const daysCompleted = parsed.daysCompleted || 0;
        const daysRemaining = Math.max(0, daysNeeded - daysCompleted);

        if (daysRemaining <= 0) {
          localStorage.removeItem(`nst_pedro_penalty_${userId}`);
          return defaultState;
        }

        return {
          hasPenalty: true,
          isNaraj: false, // Never sulk or pout — always clean & premium
          originalLevel: parsed.originalLevel || (userLevel || 1),
          currentPenaltyLevel: Math.max(1, parsed.currentPenaltyLevel || 1),
          targetLevel: parsed.targetLevel || (userLevel || 2),
          daysNeeded,
          daysCompleted,
          daysRemaining,
          reason: parsed.reason || '24 ghante study miss hone par power cooldown active hua.',
          penaltyDate: parsed.penaltyDate || new Date().toISOString(),
        };
      }
    } catch {
      return defaultState;
    }

    return defaultState;
  },

  /**
   * Trigger level drop when student misses study for > 24 hours:
   * - Level drops 1 step (Level 8 -> 7, Level 7 -> 6, Level 6 -> 5, Level 2 -> 1)
   * - Recovery days needed = Target Level - 1
   * - Clean, motivating, futuristic status (NO childish tantrum or "naraj" drama)
   */
  triggerStreakBreakPenalty: (userId: string | undefined | null, currentLevel: number): PedroPenaltyState => {
    const baseLevel = Math.max(1, currentLevel || 1);
    const currentPenaltyLevel = Math.max(1, baseLevel - 1);
    const targetLevel = baseLevel;
    const daysNeeded = Math.max(1, targetLevel - 1);

    const penaltyState: PedroPenaltyState = {
      hasPenalty: baseLevel > 1,
      isNaraj: false,
      originalLevel: baseLevel,
      currentPenaltyLevel,
      targetLevel,
      daysNeeded,
      daysCompleted: 0,
      daysRemaining: daysNeeded,
      reason: '24 ghante study miss hone par Pedro recharge mode me chala gaya hai.',
      penaltyDate: new Date().toISOString(),
    };

    try {
      if (userId && typeof window !== 'undefined') {
        if (baseLevel > 1) {
          localStorage.setItem(`nst_pedro_penalty_${userId}`, JSON.stringify(penaltyState));
        } else {
          localStorage.removeItem(`nst_pedro_penalty_${userId}`);
        }
        window.dispatchEvent(new CustomEvent('nst-pedro-penalty-change', { detail: penaltyState }));
        window.dispatchEvent(new CustomEvent('nst-pedro-level-change', { detail: { level: currentPenaltyLevel } }));
        window.dispatchEvent(new CustomEvent('nst-pedro-naraj', { detail: { isNaraj: false } }));
      }
    } catch {}

    return penaltyState;
  },

  /**
   * Check and advance penalty recovery when student maintains daily streak
   */
  checkAndAdvancePenaltyStreak: (userId: string | undefined | null, currentStreak: number): PedroPenaltyState => {
    if (!userId) return PedroEngine.getPenaltyState(userId);
    const state = PedroEngine.getPenaltyState(userId);
    if (!state.hasPenalty) return state;

    const completed = Math.min(state.daysNeeded, Math.max(1, currentStreak));
    if (completed >= state.daysNeeded) {
      // Penalty fully cleared and level restored!
      try {
        localStorage.removeItem(`nst_pedro_penalty_${userId}`);
        window.dispatchEvent(new CustomEvent('nst-pedro-penalty-change', { detail: { hasPenalty: false, isNaraj: false } }));
        window.dispatchEvent(new CustomEvent('nst-pedro-level-change', { detail: { level: state.targetLevel } }));
        window.dispatchEvent(new CustomEvent('nst-pedro-naraj', { detail: { isNaraj: false } }));
      } catch {}
      return {
        ...state,
        hasPenalty: false,
        isNaraj: false,
        currentPenaltyLevel: state.targetLevel,
        daysCompleted: state.daysNeeded,
        daysRemaining: 0,
      };
    } else {
      const updated: PedroPenaltyState = {
        ...state,
        daysCompleted: completed,
        daysRemaining: Math.max(0, state.daysNeeded - completed),
      };
      try {
        localStorage.setItem(`nst_pedro_penalty_${userId}`, JSON.stringify(updated));
        window.dispatchEvent(new CustomEvent('nst-pedro-penalty-change', { detail: updated }));
      } catch {}
      return updated;
    }
  },

  /**
   * Clear penalty manually (e.g. via streak freeze or admin)
   */
  clearPenalty: (userId: string | undefined | null): void => {
    if (!userId) return;
    try {
      localStorage.removeItem(`nst_pedro_penalty_${userId}`);
      window.dispatchEvent(new CustomEvent('nst-pedro-penalty-change', { detail: { hasPenalty: false, isNaraj: false } }));
      window.dispatchEvent(new CustomEvent('nst-pedro-naraj', { detail: { isNaraj: false } }));
    } catch {}
  },

  /**
   * Check if Pedro is currently in "Naraj" state
   */
  isPedroNaraj: (userId: string | undefined | null): boolean => {
    if (!userId) return false;
    return PedroEngine.getPenaltyState(userId).isNaraj;
  },

  /**
   * Level 8 Overdrive State Manager:
   * - 24 hours active duration
   * - Drops to Level 7 after 24 hours
   * - 6 days cooldown/recharge if user is at Level 7, else 7 days
   */
  getL8OverdriveState: (userId: string | undefined | null, userLevel?: number, isUltra?: boolean): PedroL8OverdriveInfo => {
    const defaultState: PedroL8OverdriveInfo = {
      isActive: false,
      isCharging: false,
      canActivate: false,
      hoursRemaining: 0,
      minutesRemaining: 0,
      secondsRemaining: 0,
      chargeDaysTotal: 7,
      chargeDaysRemaining: 0,
      chargePercent: 100,
      expiresAt: 0,
    };

    if (!userId) return defaultState;

    const qualifies = isUltra || (userLevel && userLevel >= 8);
    if (!qualifies) return defaultState;

    const cooldownDays = userLevel && userLevel >= 7 ? 6 : 7;
    const cooldownMs = cooldownDays * 24 * 3600 * 1000;
    const key = `nst_pedro_l8_overdrive_${userId}`;

    let stored: any = null;
    try {
      const raw = localStorage.getItem(key);
      if (raw) stored = JSON.parse(raw);
    } catch {}

    const now = Date.now();

    // First time unlocking Level 8: automatically activate the first 24h boost!
    if (!stored || (!stored.activatedAt && !stored.cooldownStartedAt)) {
      const expiresAt = now + 24 * 3600 * 1000;
      const initial = {
        isActive: true,
        activatedAt: now,
        expiresAt,
        cooldownStartedAt: 0,
        cooldownEndsAt: 0,
        cooldownDays,
      };
      try { localStorage.setItem(key, JSON.stringify(initial)); } catch {}
      return {
        isActive: true,
        isCharging: false,
        canActivate: false,
        hoursRemaining: 24,
        minutesRemaining: 0,
        secondsRemaining: 24 * 3600,
        chargeDaysTotal: cooldownDays,
        chargeDaysRemaining: 0,
        chargePercent: 100,
        expiresAt,
      };
    }

    // Check if 24h active window is currently ongoing
    if (stored.expiresAt && now < stored.expiresAt) {
      const diffMs = stored.expiresAt - now;
      const hoursRemaining = Math.floor(diffMs / (3600 * 1000));
      const minutesRemaining = Math.floor((diffMs % (3600 * 1000)) / (60 * 1000));
      const secondsRemaining = Math.floor(diffMs / 1000);
      return {
        isActive: true,
        isCharging: false,
        canActivate: false,
        hoursRemaining,
        minutesRemaining,
        secondsRemaining,
        chargeDaysTotal: cooldownDays,
        chargeDaysRemaining: 0,
        chargePercent: 100,
        expiresAt: stored.expiresAt,
      };
    }

    // 24h has expired: Pedro drops to Level 7 and is now in recharge/cooldown mode
    let cooldownStart = stored.cooldownStartedAt;
    if (!cooldownStart || cooldownStart === 0) {
      cooldownStart = stored.expiresAt || now;
      stored.isActive = false;
      stored.cooldownStartedAt = cooldownStart;
      stored.cooldownEndsAt = cooldownStart + cooldownMs;
      try { localStorage.setItem(key, JSON.stringify(stored)); } catch {}
    }

    const cooldownEnd = cooldownStart + cooldownMs;
    if (now >= cooldownEnd) {
      // Cooldown complete! Fully charged and ready to activate!
      return {
        isActive: false,
        isCharging: false,
        canActivate: true,
        hoursRemaining: 0,
        minutesRemaining: 0,
        secondsRemaining: 0,
        chargeDaysTotal: cooldownDays,
        chargeDaysRemaining: 0,
        chargePercent: 100,
        expiresAt: 0,
      };
    }

    // Still recharging
    const elapsed = now - cooldownStart;
    const remainingMs = cooldownEnd - now;
    const chargeDaysRemaining = Math.max(1, Math.ceil(remainingMs / (24 * 3600 * 1000)));
    const chargePercent = Math.min(99, Math.max(1, Math.round((elapsed / cooldownMs) * 100)));

    return {
      isActive: false,
      isCharging: true,
      canActivate: false,
      hoursRemaining: 0,
      minutesRemaining: 0,
      secondsRemaining: 0,
      chargeDaysTotal: cooldownDays,
      chargeDaysRemaining,
      chargePercent,
      expiresAt: 0,
    };
  },

  /**
   * Manually activate Level 8 Overdrive for 24 hours once charged
   */
  activateL8Overdrive: (userId: string | undefined | null, userLevel?: number): boolean => {
    if (!userId) return false;
    const now = Date.now();
    const expiresAt = now + 24 * 3600 * 1000;
    const cooldownDays = userLevel && userLevel >= 7 ? 6 : 7;
    const state = {
      isActive: true,
      activatedAt: now,
      expiresAt,
      cooldownStartedAt: 0,
      cooldownEndsAt: 0,
      cooldownDays,
    };
    try {
      localStorage.setItem(`nst_pedro_l8_overdrive_${userId}`, JSON.stringify(state));
      window.dispatchEvent(new CustomEvent('nst-pedro-overdrive-change', { detail: state }));
      window.dispatchEvent(new CustomEvent('nst-pedro-level-change', { detail: { level: 8 } }));
    } catch {}
    return true;
  },

  /**
   * Fast check if Level 8 Overdrive is actively running right now
   */
  isL8OverdriveActive: (userId: string | undefined | null, userLevel?: number, isUltra?: boolean): boolean => {
    if (!userId) return false;
    const st = PedroEngine.getL8OverdriveState(userId, userLevel, isUltra);
    return st.isActive;
  },

  /**
   * Returns Pedro level configuration object for given level (1 to 8).
   */
  getLevelConfig: (level: number): PedroLevelConfig => {
    const clamped = Math.min(8, Math.max(1, level));
    return PEDRO_LEVELS[clamped - 1] || PEDRO_LEVELS[0];
  },

  /**
   * Evaluates top bar elements visibility based on Pedro level:
   * Level 1: showStreakButton = true, showMailboxButton = true
   * Level 2-4: showStreakButton = false, showMailboxButton = true
   * Level 5-8: showStreakButton = false, showMailboxButton = false
   */
  getTopBarVisibility: (user: User | null | undefined) => {
    const level = PedroEngine.getEffectiveLevel(user);
    const cfg = PedroEngine.getLevelConfig(level);
    return cfg.topBarState;
  },

  /**
   * Option 1 + Streak Freeze: Pedro Energy & Sleep Mechanic
   * - If streak is broken / missed: Pedro enters Sleep / Weak mode (0% energy).
   * - Auto-claims and proactive voice alerts freeze while Pedro sleeps.
   * - Revive: 15–20 minutes of study in Study Mode OR Streak Freeze item.
   * - Ultra VIP: 100% immune from sleep (Ultra Auto-Shield).
   */
  getEnergyStatus: (user: User | null | undefined, currentStudyTimerSeconds: number = 0): PedroEnergyStatus => {
    if (!user) {
      return {
        energyPct: 100,
        isSleeping: false,
        isUltraShielded: false,
        reviveStudyMinsRequired: 15,
        reviveStudyMinsDone: 0,
        canReviveNow: false,
      };
    }

    const isUltra =
      SubscriptionEngine.isPremium(user) &&
      (user.subscriptionLevel === 'ULTRA' || user.subscriptionTier === 'ULTRA' || user.subscriptionTier === 'LIFETIME');

    // Ultra users are permanently shielded and immune from sleep!
    if (isUltra) {
      return {
        energyPct: 100,
        isSleeping: false,
        isUltraShielded: true,
        reviveStudyMinsRequired: 0,
        reviveStudyMinsDone: 0,
        canReviveNow: false,
      };
    }

    // Check if streak was broken or student has explicit sleep flag
    let storedSleep = false;
    let sleepTimestamp = 0;
    try {
      const sleepVal = localStorage.getItem(`nst_pedro_energy_sleep_${user.id}`);
      if (sleepVal) {
        const parsed = JSON.parse(sleepVal);
        storedSleep = !!parsed.isSleeping;
        sleepTimestamp = parsed.timestamp || 0;
      }
    } catch {}

    // Streak broken check (e.g. user streak was reset to 0 or last active study day was missed)
    const isStreakBroken = (user.streak === 0 || storedSleep);

    const studyMinsDone = Math.floor(currentStudyTimerSeconds / 60);
    const studyMinsRequired = 15; // 15-20 mins required study to wake up
    const canReviveNow = studyMinsDone >= studyMinsRequired;

    if (isStreakBroken && !canReviveNow) {
      return {
        energyPct: Math.min(90, Math.round((studyMinsDone / studyMinsRequired) * 100)),
        isSleeping: true,
        isUltraShielded: false,
        tiredReason: 'Study streak miss hone ke karan Pedro Power Sleep mode me hai.',
        reviveStudyMinsRequired: studyMinsRequired,
        reviveStudyMinsDone: studyMinsDone,
        canReviveNow: false,
      };
    }

    // Fully awake
    return {
      energyPct: 100,
      isSleeping: false,
      isUltraShielded: false,
      reviveStudyMinsRequired: studyMinsRequired,
      reviveStudyMinsDone: studyMinsDone,
      canReviveNow: true,
    };
  },

  /**
   * Revive Pedro manually (via study completion or Streak Freeze item)
   */
  revivePedro: (userId: string) => {
    try {
      localStorage.removeItem(`nst_pedro_energy_sleep_${userId}`);
      localStorage.removeItem('nst_pedro_sleeping');
      window.dispatchEvent(new CustomEvent('nst-restore-pedro', { detail: { wakeUp: true } }));
      window.dispatchEvent(new CustomEvent('nst-pedro-energy-change', { detail: { isSleeping: false, energyPct: 100 } }));
    } catch {}
  },

  /**
   * Puts Pedro in Sleep mode (e.g. when streak break is detected)
   */
  putPedroToSleep: (userId: string, reason: string = 'Streak broken') => {
    try {
      localStorage.setItem(
        `nst_pedro_energy_sleep_${userId}`,
        JSON.stringify({ isSleeping: true, timestamp: Date.now(), reason })
      );
      window.dispatchEvent(new CustomEvent('nst-pedro-energy-change', { detail: { isSleeping: true, energyPct: 0 } }));
    } catch {}
  },

  /**
   * VIP / Subscription Expiry Warning Check:
   * "Pedro level 1 se hi warning dega vip user ko 24 hour pehle se har login pe warning dega"
   */
  checkVipExpiryWarning: (user: User | null | undefined): { needsWarning: boolean; hoursRemaining: number; message: string; isExpired: boolean } => {
    if (!user) {
      return { needsWarning: false, hoursRemaining: 0, message: '', isExpired: false };
    }

    // Lifetime users never expire
    if (user.subscriptionTier === 'LIFETIME') {
      return { needsWarning: false, hoursRemaining: 0, message: '', isExpired: false };
    }

    const hasActiveSub = Boolean(user.subscriptionEndDate && user.subscriptionTier && user.subscriptionTier !== 'FREE');
    const isVip = Boolean(user.isPremium || hasActiveSub || user.subscriptionLevel === 'ULTRA' || user.subscriptionLevel === 'BASIC');
    if (!user.subscriptionEndDate || !isVip) {
      return { needsWarning: false, hoursRemaining: 0, message: '', isExpired: false };
    }

    const endMs = new Date(user.subscriptionEndDate).getTime();
    if (isNaN(endMs)) {
      return { needsWarning: false, hoursRemaining: 0, message: '', isExpired: false };
    }

    const diff = endMs - Date.now();
    const hours = Math.ceil(diff / (1000 * 60 * 60));

    if (hours > 0 && hours <= 24) {
      return {
        needsWarning: true,
        hoursRemaining: hours,
        isExpired: false,
        message: `⚠️ VIP Alert! Aapki VIP Membership agle ${hours} ghante mein expire hone wali hai! Apni study streak aur VIP features bachane ke liye Store se renew karein!`,
      };
    } else if (diff <= 0 && diff > -24 * 3600 * 1000) {
      return {
        needsWarning: true,
        hoursRemaining: 0,
        isExpired: true,
        message: `⚠️ VIP Expired! Aapki membership expire ho chuki hai. Renew karke Pedro ke saare VIP perks aur streak wapas payein!`,
      };
    }

    return { needsWarning: false, hoursRemaining: Math.max(0, hours), message: '', isExpired: false };
  },

  /**
   * Check if Pedro can auto-claim mailbox rewards (Unlocked at Level 5+)
   */
  canAutoClaimMailbox: (user: User | null | undefined): boolean => {
    if (!user) return false;
    const level = PedroEngine.getEffectiveLevel(user);
    const cfg = PedroEngine.getLevelConfig(level);
    if (!cfg.features.autoClaimMailbox) return false;
    const energy = PedroEngine.getEnergyStatus(user);
    return !energy.isSleeping;
  },

  /**
   * Check if Pedro can auto-claim VIP daily perks (Unlocked at Level 6+)
   */
  canAutoClaimVip: (user: User | null | undefined): boolean => {
    if (!user) return false;
    const level = PedroEngine.getEffectiveLevel(user);
    const cfg = PedroEngine.getLevelConfig(level);
    if (!cfg.features.autoClaimVip) return false;
    const energy = PedroEngine.getEnergyStatus(user);
    return !energy.isSleeping;
  },

  /**
   * Check if Pedro can announce streak updates (Unlocked at Level 2+)
   */
  canAnnounceStreak: (user: User | null | undefined): boolean => {
    if (!user) return false;
    const level = PedroEngine.getEffectiveLevel(user);
    const cfg = PedroEngine.getLevelConfig(level);
    return !!cfg.features.dailyStreakAnnounce;
  },

  /**
   * Check if Pedro can announce required reading time (Unlocked at Level 3+)
   */
  canAnnounceRequiredReading: (user: User | null | undefined): boolean => {
    if (!user) return false;
    const level = PedroEngine.getEffectiveLevel(user);
    const cfg = PedroEngine.getLevelConfig(level);
    return !!cfg.features.requiredReadingTime;
  },
};
