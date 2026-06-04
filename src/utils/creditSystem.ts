/**
 * Credit System — Level-based permanent vs expiry credit deduction ratios.
 *
 * When a user spends credits, the split between permanent (user.credits)
 * and expiry (user.bonusCredits + user.giftedCredits) depends on their level:
 *
 * L1 : 100% permanent / 0% expiry
 * L2 :  80% permanent / 20% expiry
 * L3 :  70% permanent / 30% expiry
 * L4 :  60% permanent / 40% expiry
 * L5 :  50% permanent / 50% expiry
 * L6 :  40% permanent / 60% expiry
 * L7 :  30% permanent / 70% expiry
 * L8 :  25% permanent / 75% expiry
 *
 * Higher level = more expiry credits used first → permanent credits are protected.
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

/** Total spendable credits (permanent + active expiry) */
export const getTotalCredits = (user: CreditUser): number => {
  const permanent = user.credits ?? 0;
  const bonus = user.bonusCredits ?? 0;
  const giftedExpiry = user.giftedCreditsExpiry
    ? new Date(user.giftedCreditsExpiry).getTime()
    : 0;
  const gifted =
    !user.giftedCreditsExpiry || giftedExpiry > Date.now()
      ? (user.giftedCredits ?? 0)
      : 0;
  return permanent + bonus + gifted;
};

/**
 * Compute the updated credits/bonusCredits/giftedCredits after spending `amount`.
 * Returns null if total credits are insufficient.
 * Admins always succeed with no deduction.
 */
export const applyDeduction = <T extends CreditUser>(
  user: T,
  amount: number,
): T | null => {
  if (user.role === 'ADMIN' || user.role === 'SUB_ADMIN') return user;

  const permanent = user.credits ?? 0;
  const bonusC = user.bonusCredits ?? 0;
  const giftedExpiry = user.giftedCreditsExpiry
    ? new Date(user.giftedCreditsExpiry).getTime()
    : 0;
  const giftedActive =
    !user.giftedCreditsExpiry || giftedExpiry > Date.now()
      ? (user.giftedCredits ?? 0)
      : 0;

  const expiryTotal = bonusC + giftedActive;
  const totalAvailable = permanent + expiryTotal;
  if (totalAvailable < amount) return null;

  const level = getLevelInfo(user.totalScore ?? 0).level;
  const [permRatio] = LEVEL_RATIOS[level] ?? [1.0, 0.0];

  let fromPermanent = Math.round(amount * permRatio);
  let fromExpiry = amount - fromPermanent;

  // Clamp: not enough expiry → take more permanent
  if (fromExpiry > expiryTotal) {
    fromExpiry = expiryTotal;
    fromPermanent = amount - fromExpiry;
  }
  // Clamp: not enough permanent → take more expiry
  if (fromPermanent > permanent) {
    fromPermanent = permanent;
    fromExpiry = amount - fromPermanent;
  }

  // Deduct expiry: bonusCredits first, then giftedCredits
  let newBonusCredits = bonusC;
  let newGiftedCredits = user.giftedCredits ?? 0;
  let expiryLeft = fromExpiry;

  const fromBonus = Math.min(expiryLeft, bonusC);
  newBonusCredits -= fromBonus;
  expiryLeft -= fromBonus;

  if (expiryLeft > 0) {
    newGiftedCredits -= expiryLeft;
  }

  const result = {
    ...user,
    credits: Math.max(0, permanent - fromPermanent),
    bonusCredits: Math.max(0, newBonusCredits),
    giftedCredits: Math.max(0, newGiftedCredits),
  };

  return result;
};
