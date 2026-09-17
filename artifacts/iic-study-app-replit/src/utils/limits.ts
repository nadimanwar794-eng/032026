/**
 * src/utils/limits.ts
 * Centralized tier-based limits, unlock costs, and monetization rules.
 */

export type SubscriptionTierName = 'FREE' | 'BASIC' | 'ULTRA';

export const UNLOCK_COSTS = {
  // Lesson Modes: 20 Credits or 5 Diamonds
  READING_MODE: { credits: 20, diamonds: 5 },
  WRITING_MODE: { credits: 20, diamonds: 5 },
  MCQ_PRACTICE: { credits: 20, diamonds: 5 },
  PROJECTOR_MODE: { credits: 20, diamonds: 5 },

  // Revision Hub MCQ Session: 100 Credits or 20 Diamonds
  REVISION_HUB_MCQ: { credits: 100, diamonds: 20 },

  // Full Analysis on Marksheet: 20 Credits or 5 Diamonds
  FULL_ANALYSIS: { credits: 20, diamonds: 5 },

  // Theme Rental Costs
  THEME_RENTAL: {
    DAY_1: { credits: 10, diamonds: 1 },
    WEEK_1: { credits: 50, diamonds: 5 },
    MONTH_1: { credits: 100, diamonds: 15 },
  },

  // Routine Extra Slot: 100 Credits
  ROUTINE_EXTRA_SLOT: { credits: 100 },

  // Exclusive Features (Diamond-only for non-subscribers):
  // Flashcard & Video: Ultra exclusive -> 5 Diamonds for Free/Basic
  // PDF: Basic/Ultra exclusive -> 5 Diamonds for Free
  FLASHCARD_DIAMONDS: 5,
  VIDEO_DIAMONDS: 5,
  PDF_DIAMONDS: 5,

  // Mode Diamond Costs: 5 Diamonds per single mode
  DIAMONDS_PER_MODE: 5,
  TOTAL_STUDY_MODES: 7,
} as const;

/**
 * Calculates diamond cost for unlocking all modes for a page based on subscription tier:
 * - Free user: 7 modes × 5 = 35 Diamonds
 * - Basic user: PDF free in Basic -> 6 modes × 5 = 30 Diamonds
 * - Ultra user: PDF, Flashcard & Video free in Ultra -> 4 modes × 5 = 20 Diamonds
 */
export function getAllModesDiamondCost(tier: 'FREE' | 'BASIC' | 'ULTRA'): {
  totalDiamonds: number;
  paidModesCount: number;
  freeModesCount: number;
  breakdown: string;
} {
  if (tier === 'ULTRA') {
    return {
      totalDiamonds: 20,
      paidModesCount: 4,
      freeModesCount: 3,
      breakdown: '4 Modes × 5 = 20 💎 (PDF, Flashcard & Video Free)',
    };
  }
  if (tier === 'BASIC') {
    return {
      totalDiamonds: 30,
      paidModesCount: 6,
      freeModesCount: 1,
      breakdown: '6 Modes × 5 = 30 💎 (PDF Free)',
    };
  }
  return {
    totalDiamonds: 35,
    paidModesCount: 7,
    freeModesCount: 0,
    breakdown: '7 Modes × 5 = 35 💎',
  };
}

export const LEADERBOARD_MIN_LEVEL = {
  FREE: 2,
  BASIC: 1,
  ULTRA: 1,
} as const;

export const ROUTINE_SLOTS = {
  BASE_FREE: 2,
  BASIC_EXTRA: 1, // Total 3
  ULTRA_EXTRA: 2, // Total 4
  LEVEL_5_BONUS: 1,
  LEVEL_8_BONUS: 1,
  PURCHASE_COST_CREDITS: 100,
} as const;

/**
 * Calculates diamond cost based on credit cost or reason
 */
export function getDiamondUnlockCost(creditCost: number, reason?: string): number {
  if (reason && /revision hub/i.test(reason)) {
    return UNLOCK_COSTS.REVISION_HUB_MCQ.diamonds; // 20 diamonds
  }
  if (reason && /analysis/i.test(reason)) {
    return UNLOCK_COSTS.FULL_ANALYSIS.diamonds; // 5 diamonds
  }
  if (creditCost >= 100) return 20;
  if (creditCost >= 20) return 5;
  return Math.max(1, Math.ceil(creditCost / 4));
}
