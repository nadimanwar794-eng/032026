/**
 * Credit System — Level-based permanent vs gifted credit deduction ratios.
 *
 * All subscription and earned credits are permanent (user.credits).
 * Only gifted credits (user.giftedCredits) are expiry-based.
 *
 * When a user spends credits, the split between permanent (user.credits)
 * and gifted (user.giftedCredits) depends on their level:
 *
 * L1 : 100% permanent / 0% gifted
 * L2 :  80% permanent / 20% gifted
 * L3 :  70% permanent / 30% gifted
 * L4 :  60% permanent / 40% gifted
 * L5 :  50% permanent / 50% gifted
 * L6 :  40% permanent / 60% gifted
 * L7 :  30% permanent / 70% gifted
 * L8 :  25% permanent / 75% gifted
 *
 * Higher level = more gifted credits used first → permanent credits are protected.
 */

import { getLevelInfo } from './levelSystem';

const LEVEL_RATIOS: Record<number, [number, number]> = {
  1:  [1.00, 0.00],
  2:  [0.80, 0.20],
  3:  [0.70, 0.30],
  4:  [0.60, 0.40],
  5:  [0.50, 0.50],
  6:  [0.40, 0.60],
  7:  [0.30, 0.70],
  8:  [0.25, 0.75],
  9:  [0.20, 0.80],
  10: [0.15, 0.85],
  11: [0.10, 0.90],
};

export type CreditUser = {
  credits?: number;
  bonusCredits?: number;
  giftedCredits?: number;
  giftedCreditsExpiry?: string;
  totalScore?: number;
  role?: string;
};

/** Total spendable credits (permanent including any legacy bonusCredits + active gifted) */
export const getTotalCredits = (user: CreditUser): number => {
  // bonusCredits are now treated as permanent credits
  const permanent = (user.credits ?? 0) + (user.bonusCredits ?? 0);
  const giftedExpiry = user.giftedCreditsExpiry
    ? new Date(user.giftedCreditsExpiry).getTime()
    : 0;
  const gifted =
    !user.giftedCreditsExpiry || giftedExpiry > Date.now()
      ? (user.giftedCredits ?? 0)
      : 0;
  return permanent + gifted;
};

/**
 * Compute the updated credits/giftedCredits after spending `amount`.
 * bonusCredits are merged into permanent credits pool.
 * Returns null if total credits are insufficient.
 * Admins always succeed with no deduction.
 */
export const applyDeduction = <T extends CreditUser>(
  user: T,
  amount: number,
  chargeStaff = false,
): T | null => {
  if (!chargeStaff && (user.role === 'ADMIN' || user.role === 'SUB_ADMIN')) return user;

  // Fold legacy bonusCredits into permanent
  const permanent = (user.credits ?? 0) + (user.bonusCredits ?? 0);
  const giftedExpiry = user.giftedCreditsExpiry
    ? new Date(user.giftedCreditsExpiry).getTime()
    : 0;
  const giftedActive =
    !user.giftedCreditsExpiry || giftedExpiry > Date.now()
      ? (user.giftedCredits ?? 0)
      : 0;

  const totalAvailable = permanent + giftedActive;
  if (totalAvailable < amount) return null;

  const level = getLevelInfo(user.totalScore ?? 0).level;
  const [permRatio] = LEVEL_RATIOS[level] ?? [1.0, 0.0];

  let fromPermanent = Math.round(amount * permRatio);
  let fromExpiry = amount - fromPermanent;

  // Clamp: not enough gifted → take more permanent
  if (fromExpiry > giftedActive) {
    fromExpiry = giftedActive;
    fromPermanent = amount - fromExpiry;
  }
  // Clamp: not enough permanent → take more gifted
  if (fromPermanent > permanent) {
    fromPermanent = permanent;
    fromExpiry = amount - fromPermanent;
  }

  const newGiftedCredits = Math.max(0, (user.giftedCredits ?? 0) - fromExpiry);

  const result = {
    ...user,
    credits: Math.max(0, permanent - fromPermanent),
    bonusCredits: 0,
    giftedCredits: newGiftedCredits,
  };

  // Referral Royalty Cashback: Level 1 (0.01%) to Level 15 (0.15%)
  try {
    const referrerId = (user as any).referrerId;
    if (referrerId && amount > 0 && typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('nst_users');
      if (stored) {
        const allUsers: any[] = JSON.parse(stored);
        const refIndex = allUsers.findIndex(
          (u) => u.id === referrerId || (u.displayId && u.displayId.toUpperCase() === String(referrerId).toUpperCase())
        );
        if (refIndex >= 0) {
          const referrer = allUsers[refIndex];
          const effLevel = Math.min(15, Math.max(1, referrer.level || 1));
          const ratePercent = effLevel * 0.01; // e.g. 0.01% - 0.15%
          const cashback = parseFloat(((amount * ratePercent) / 100).toFixed(4));
          if (cashback > 0) {
            const newBal = parseFloat(((referrer.referralCommissionBalance || 0) + cashback).toFixed(4));
            const newLog = {
              id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              friendId: (user as any).id || 'student',
              friendName: (user as any).name || 'Friend',
              creditsSpent: amount,
              ratePercent,
              earnedCredits: cashback,
              date: new Date().toISOString(),
            };
            const updatedLogs = [newLog, ...(referrer.referralCommissionLogs || [])].slice(0, 50);
            allUsers[refIndex] = {
              ...referrer,
              credits: (referrer.credits || 0) + (cashback >= 1 ? Math.floor(cashback) : 0),
              referralCommissionBalance: newBal,
              referralCommissionLogs: updatedLogs,
            };
            localStorage.setItem('nst_users', JSON.stringify(allUsers));
          }
        }
      }
    }
  } catch {}

  return result;
};

/**
 * Retrieve a configured credit cost with full support for:
 * 1. Tier-specific pricing (Free vs Basic vs Ultra) from tieredCreditCosts
 * 2. Feature cost overrides from featureCosts
 * 3. Custom economy items from customEconomyItems
 * 4. Direct setting key (e.g. s.defaultPdfCost, s.mcqTestCost)
 * 5. Fallback default
 */
export const getCreditCost = (
  key: string,
  fallback: number,
  userTier?: string,
  directSettings?: any
): number => {
  try {
    let s = directSettings;
    if (!s && typeof window !== 'undefined') {
      const raw = localStorage.getItem('nst_system_settings');
      if (raw) s = JSON.parse(raw);
    }
    if (s) {
      const rawTier = (userTier || 'FREE').toUpperCase();
      const normTier = rawTier === 'ULTRA' ? 'ultra' : rawTier === 'BASIC' ? 'basic' : 'free';

      // 1. Check Tiered Credit Costs table
      if (s.tieredCreditCosts && s.tieredCreditCosts[key]) {
        const tierVal = s.tieredCreditCosts[key][normTier];
        if (typeof tierVal === 'number' && !isNaN(tierVal)) return Math.max(0, tierVal);
      }

      // 2. Check Custom Economy Items
      if (Array.isArray(s.customEconomyItems)) {
        const item = s.customEconomyItems.find((i: any) => i.id === key);
        if (item) {
          const costProp = `${normTier}Cost`;
          if (typeof item[costProp] === 'number' && !isNaN(item[costProp])) return Math.max(0, item[costProp]);
        }
      }

      // 3. Check Granular Feature Costs array
      if (Array.isArray(s.featureCosts)) {
        const fc = s.featureCosts.find((f: any) => f.featureId === key);
        if (fc) {
          const costProp = `${normTier}Cost`;
          if (typeof fc[costProp] === 'number' && !isNaN(fc[costProp])) return Math.max(0, fc[costProp]);
        }
      }

      // 4. Check direct key on settings
      if (typeof s[key] === 'number' && !isNaN(s[key])) return Math.max(0, s[key]);
    }
  } catch {}
  return fallback;
};

/**
 * Get required subscription tier for a feature or economy item
 */
export const getRequiredTier = (
  key: string,
  fallback: 'FREE' | 'BASIC' | 'ULTRA' = 'FREE',
  directSettings?: any
): 'FREE' | 'BASIC' | 'ULTRA' => {
  try {
    let s = directSettings;
    if (!s && typeof window !== 'undefined') {
      const raw = localStorage.getItem('nst_system_settings');
      if (raw) s = JSON.parse(raw);
    }
    if (s) {
      if (s.tieredCreditCosts?.[key]?.requiredTier) {
        return s.tieredCreditCosts[key].requiredTier;
      }
      if (Array.isArray(s.customEconomyItems)) {
        const item = s.customEconomyItems.find((i: any) => i.id === key);
        if (item?.requiredTier) return item.requiredTier;
      }
    }
  } catch {}
  return fallback;
};


