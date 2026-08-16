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
): T | null => {
  if (user.role === 'ADMIN' || user.role === 'SUB_ADMIN') return user;

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

  return result;
};
