import { PlanCompareGroup } from '../types';

/**
 * ── 1. VIP FEATURE COMPARISON MATRIX (CRADIT OFF) ──
 * Exact data from user screenshot for VIP Page (Credit OFF / Standard Subscription)
 */
export const DEFAULT_VIP_CREDIT_OFF_COMPARE_GROUPS: PlanCompareGroup[] = [
  {
    id: 'grp-study',
    category: 'STUDY CONTENT & MODES',
    items: [
      {
        id: 'SEQ_READING',
        label: 'Sequential Page Reading',
        free: '🔒 Always ON (Strict)',
        basic: '⚙ Configurable (Self ON/OFF in Settings)',
        ultra: '⚙ Configurable (Self ON/OFF in Settings)',
        tooltip: 'Free users must read sequentially. Basic and Ultra can toggle ON/OFF.',
        highlight: true
      },
      {
        id: 'PDF_NOTES',
        label: 'PDF Notes / Material',
        free: '🔒',
        basic: '✔ Free Included',
        ultra: '✔ Free Included'
      },
      {
        id: 'FLASHCARD_VIDEO',
        label: 'Flashcard & Video',
        free: '🔒',
        basic: '🔒',
        ultra: '✔ Free / Unlocked'
      },
      {
        id: 'STUDY_MODES',
        label: 'Study Modes (Read/Write/etc)',
        free: 'Sequential Page Reading',
        basic: 'Free',
        ultra: 'Free'
      },
      {
        id: 'MCQ_ANALYSIS',
        label: 'MCQ Full Analysis',
        free: 'Free',
        basic: 'Free',
        ultra: 'Free'
      },
      {
        id: 'MCQ_MARKSHEET',
        label: 'MCQ Marksheet & Solution',
        free: '✔ Free',
        basic: '✔ Free',
        ultra: '✔ Free'
      },
      {
        id: 'EDITOR_UTILITIES',
        label: 'Editor / Study Utilities',
        free: '❌ Limited',
        basic: '✔ Enabled',
        ultra: '✔ Enabled'
      },
      {
        id: 'REVISION_HUB',
        label: 'Revision Hub',
        free: 'Sequential Page Reading',
        basic: 'Free',
        ultra: 'Free'
      }
    ]
  },
  {
    id: 'grp-account',
    category: 'ACCOUNT & LIMITS',
    items: [
      {
        id: 'LEADERBOARD',
        label: 'Leaderboard Unlock',
        free: 'Level 2 Unlock',
        basic: 'Instant (Level 1)',
        ultra: 'Instant (Level 1)'
      },
      {
        id: 'DAILY_MCQ',
        label: 'Daily MCQ Limit',
        free: '300 / day',
        basic: '1,500 / day',
        ultra: '3,000 / day'
      },
      {
        id: 'DAILY_XP',
        label: 'Daily XP Cap',
        free: '1,500 XP',
        basic: '2,500 XP',
        ultra: '3,500 XP'
      },
      {
        id: 'XP_MULT',
        label: 'XP Multiplier',
        free: '1.0x',
        basic: '1.5x',
        ultra: '2.0x'
      },
      {
        id: 'STORE_DISCOUNT',
        label: 'Store Discount (Credits)',
        free: '0%',
        basic: '5%',
        ultra: '10%'
      },
      {
        id: 'PEDRO_LEVEL_8',
        label: 'Pedro Level 8',
        free: '—',
        basic: '—',
        ultra: '✔ Pedro Level 8 (Till Subscription)',
        tooltip: 'Pedro Level 8 companion unlocked for Ultra tier for the duration of the subscription.'
      },
      {
        id: 'NAME_CHANGE',
        label: 'Profile Name Change',
        free: '100 🪙 or 20 💎',
        basic: '100 🪙 or 20 💎',
        ultra: '100 🪙 or 20 💎'
      }
    ]
  },
  {
    id: 'grp-routine',
    category: 'ROUTINE ENGINE',
    items: [
      {
        id: 'ROUTINE_SLOTS',
        label: 'Routine Default Slots',
        free: '2 Slots',
        basic: '3 Slots',
        ultra: '4 Slots'
      },
      {
        id: 'ROUTINE_BOOKS',
        label: 'Routine Books Selection',
        free: 'Lucent Only',
        basic: 'Lucent Only',
        ultra: 'Multiple Books Allowed'
      },
      {
        id: 'ROUTINE_PENALTY',
        label: 'Routine Penalty (Inactive)',
        free: 'Credits Rate Reduced',
        basic: 'No Penalty',
        ultra: 'No Penalty'
      },
      {
        id: 'ROUTINE_PROG',
        label: 'Routine Progression Slots',
        free: '+1 (Lvl 5), +1 (Lvl 8)',
        basic: '+1 (Lvl 5), +1 (Lvl 8)',
        ultra: '+1 (Lvl 5), +1 (Lvl 8)'
      },
      {
        id: 'ROUTINE_PAID',
        label: 'Routine Paid Slot',
        free: '100 🪙 / slot',
        basic: '100 🪙 / slot',
        ultra: '100 🪙 / slot'
      }
    ]
  },
  {
    id: 'grp-community',
    category: 'COMMUNITY & CHAT',
    items: [
      {
        id: 'GLOBAL_CHAT',
        label: 'Global Chat',
        free: 'View & Like Only',
        basic: 'View & Like Only',
        ultra: '✔ Send Messages Allowed'
      },
      {
        id: 'MCQ_SHARING',
        label: 'MCQ Sharing',
        free: 'Solve Only',
        basic: '✔ Post MCQs Allowed',
        ultra: '✔ Post MCQs Allowed'
      },
      {
        id: 'ADMIN_SUPPORT',
        label: 'Admin Support',
        free: 'Free',
        basic: '✔ Free',
        ultra: '✔ Free'
      },
      {
        id: 'MESSENGER_FRIENDS',
        label: 'Messenger Friend Limit',
        free: '10 Friends',
        basic: '30 Friends',
        ultra: '50 Friends'
      },
      {
        id: 'MESSENGER_EXP',
        label: 'Messenger Expansion',
        free: 'Up to 50 max',
        basic: 'Up to 50+',
        ultra: 'Unlimited'
      },
      {
        id: 'DAILY_MSG_LIMIT',
        label: 'Daily Message Limit',
        free: '50 / day',
        basic: '100 / day',
        ultra: '300 / day'
      },
      {
        id: 'MSG_LIMIT_EXT',
        label: 'Message Limit Extension',
        free: '+50 first, +100 next',
        basic: '+100 per upgrade',
        ultra: '+100 per upgrade'
      }
    ]
  },
  {
    id: 'grp-themes',
    category: 'CUSTOMIZATION & THEMES',
    items: [
      {
        id: 'THEME_STUDIO',
        label: 'Theme Studio Access',
        free: 'Level 2 Unlock',
        basic: '✔ Instant Unlock',
        ultra: '✔ Instant Unlock'
      },
      {
        id: 'SCORE_HISTORY',
        label: 'Score History',
        free: 'Level 3 Unlock',
        basic: '✔ Instant Access',
        ultra: '✔ Instant Access'
      },
      {
        id: 'THEME_PACKS',
        label: 'Theme Library Packs',
        free: 'Free themes only',
        basic: 'Basic themes free',
        ultra: 'Ultra themes free'
      },
      {
        id: 'THEME_PRICING',
        label: 'Theme Pricing (Rentals)',
        free: '1D: 10🪙, 7D: 50🪙, 30D: 100🪙',
        basic: '1D: 10🪙, 7D: 50🪙, 30D: 100🪙',
        ultra: '1D: 10🪙, 7D: 50🪙, 30D: 100🪙'
      }
    ]
  }
];

/**
 * ── 2. VIP+ FEATURE COMPARISON MATRIX (CRADIT ON) ──
 * Exact data from user screenshot for VIP+ Page (Credit Economy ON)
 */
export const DEFAULT_VIP_PLUS_CREDIT_ON_COMPARE_GROUPS: PlanCompareGroup[] = [
  {
    id: 'grp-study',
    category: 'STUDY CONTENT & MODES',
    items: [
      {
        id: 'SEQ_READING',
        label: 'Sequential Page Reading',
        free: '🔓 Always OFF',
        basic: '🔓 Always OFF',
        ultra: '🔓 Always OFF',
        tooltip: 'In VIP+ (Credit ON), sequential page reading is always OFF for flexible chapter access.',
        highlight: true
      },
      {
        id: 'PDF_NOTES',
        label: 'PDF Notes / Material',
        free: '5 💎',
        basic: '✔ Free Included',
        ultra: '✔ Free Included'
      },
      {
        id: 'FLASHCARD_VIDEO',
        label: 'Flashcard & Video',
        free: '5 💎',
        basic: '5 💎',
        ultra: '✔ Free / Unlocked'
      },
      {
        id: 'STUDY_MODES',
        label: 'Study Modes (Read/Write/etc)',
        free: '20 🪙 / 5 💎',
        basic: '20 🪙 / 5 💎',
        ultra: '20 🪙 / 5 💎'
      },
      {
        id: 'MCQ_ANALYSIS',
        label: 'MCQ Full Analysis',
        free: '20 🪙 / 5 💎',
        basic: 'Free',
        ultra: 'Free'
      },
      {
        id: 'MCQ_MARKSHEET',
        label: 'MCQ Marksheet & Solution',
        free: 'Free',
        basic: '✔ Free',
        ultra: '✔ Free'
      },
      {
        id: 'EDITOR_UTILITIES',
        label: 'Editor / Study Utilities',
        free: '❌ Limited',
        basic: '✔ Enabled',
        ultra: '✔ Enabled'
      },
      {
        id: 'REVISION_HUB',
        label: 'Revision Hub',
        free: 'Sequential Page Reading',
        basic: '100 🪙',
        ultra: '100 🪙'
      }
    ]
  },
  {
    id: 'grp-account',
    category: 'ACCOUNT & LIMITS',
    items: [
      {
        id: 'LEADERBOARD',
        label: 'Leaderboard Unlock',
        free: 'Level 2 Unlock',
        basic: 'Instant (Level 1)',
        ultra: 'Instant (Level 1)'
      },
      {
        id: 'DAILY_MCQ',
        label: 'Daily MCQ Limit',
        free: '300 / day',
        basic: '1,500 / day',
        ultra: '3,000 / day'
      },
      {
        id: 'DAILY_XP',
        label: 'Daily XP Cap',
        free: '1,500 XP',
        basic: '2,500 XP',
        ultra: '3,500 XP'
      },
      {
        id: 'XP_MULT',
        label: 'XP Multiplier',
        free: '1.0x',
        basic: '1.5x',
        ultra: '2.0x'
      },
      {
        id: 'STORE_DISCOUNT',
        label: 'Store Discount (Credits)',
        free: '0%',
        basic: '5%',
        ultra: '10%'
      },
      {
        id: 'PEDRO_LEVEL_8',
        label: 'Pedro Level 8',
        free: '—',
        basic: '—',
        ultra: '✔ Pedro Level 8 (Till Subscription)',
        tooltip: 'Pedro Level 8 companion unlocked for Ultra tier for the duration of the subscription.'
      },
      {
        id: 'NAME_CHANGE',
        label: 'Profile Name Change',
        free: '100 🪙 or 20 💎',
        basic: '100 🪙 or 20 💎',
        ultra: '100 🪙 or 20 💎'
      }
    ]
  },
  {
    id: 'grp-routine',
    category: 'ROUTINE ENGINE',
    items: [
      {
        id: 'ROUTINE_SLOTS',
        label: 'Routine Default Slots',
        free: '2 Slots',
        basic: '3 Slots',
        ultra: '4 Slots'
      },
      {
        id: 'ROUTINE_BOOKS',
        label: 'Routine Books Selection',
        free: 'Lucent Only',
        basic: 'Lucent Only',
        ultra: 'Multiple Books Allowed'
      },
      {
        id: 'ROUTINE_PENALTY',
        label: 'Routine Penalty (Inactive)',
        free: 'Credits Rate Reduced',
        basic: 'No Penalty',
        ultra: 'No Penalty'
      },
      {
        id: 'ROUTINE_PROG',
        label: 'Routine Progression Slots',
        free: '+1 (Lvl 5), +1 (Lvl 8)',
        basic: '+1 (Lvl 5), +1 (Lvl 8)',
        ultra: '+1 (Lvl 5), +1 (Lvl 8)'
      },
      {
        id: 'ROUTINE_PAID',
        label: 'Routine Paid Slot',
        free: '100 🪙 / slot',
        basic: '100 🪙 / slot',
        ultra: '100 🪙 / slot'
      }
    ]
  },
  {
    id: 'grp-community',
    category: 'COMMUNITY & CHAT',
    items: [
      {
        id: 'GLOBAL_CHAT',
        label: 'Global Chat',
        free: 'View & Like Only',
        basic: 'View & Like Only',
        ultra: '✔ Send Messages Allowed'
      },
      {
        id: 'MCQ_SHARING',
        label: 'MCQ Sharing',
        free: 'Solve Only',
        basic: '✔ Post MCQs Allowed',
        ultra: '✔ Post MCQs Allowed'
      },
      {
        id: 'ADMIN_SUPPORT',
        label: 'Admin Support',
        free: 'Free',
        basic: '✔ Free',
        ultra: '✔ Free'
      },
      {
        id: 'MESSENGER_FRIENDS',
        label: 'Messenger Friend Limit',
        free: '10 Friends',
        basic: '30 Friends',
        ultra: '50 Friends'
      },
      {
        id: 'MESSENGER_EXP',
        label: 'Messenger Expansion',
        free: 'Up to 50 max',
        basic: 'Up to 50+',
        ultra: 'Unlimited'
      },
      {
        id: 'DAILY_MSG_LIMIT',
        label: 'Daily Message Limit',
        free: '50 / day',
        basic: '100 / day',
        ultra: '300 / day'
      },
      {
        id: 'MSG_LIMIT_EXT',
        label: 'Message Limit Extension',
        free: '+50 first, +100 next',
        basic: '+100 per upgrade',
        ultra: '+100 per upgrade'
      }
    ]
  },
  {
    id: 'grp-themes',
    category: 'CUSTOMIZATION & THEMES',
    items: [
      {
        id: 'THEME_STUDIO',
        label: 'Theme Studio Access',
        free: 'Level 2 Unlock',
        basic: '✔ Instant Unlock',
        ultra: '✔ Instant Unlock'
      },
      {
        id: 'SCORE_HISTORY',
        label: 'Score History',
        free: 'Level 3 Unlock',
        basic: '✔ Instant Access',
        ultra: '✔ Instant Access'
      },
      {
        id: 'THEME_PACKS',
        label: 'Theme Library Packs',
        free: 'Free themes only',
        basic: 'Basic themes free',
        ultra: 'Ultra themes free'
      },
      {
        id: 'THEME_PRICING',
        label: 'Theme Pricing (Rentals)',
        free: '1D: 10🪙, 7D: 50🪙, 30D: 100🪙',
        basic: '1D: 10🪙, 7D: 50🪙, 30D: 100🪙',
        ultra: '1D: 10🪙, 7D: 50🪙, 30D: 100🪙'
      }
    ]
  }
];

export const DEFAULT_PLAN_COMPARE_GROUPS = DEFAULT_VIP_PLUS_CREDIT_ON_COMPARE_GROUPS;
