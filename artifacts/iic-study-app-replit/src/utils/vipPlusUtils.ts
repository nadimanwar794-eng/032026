import { SubscriptionPlan } from '../types';

/**
 * Default Daily Diamond distribution for VIP+ plans as requested:
 * PRO+:
 *   - Weekly: 10 diamonds / day
 *   - Monthly: 25 diamonds / day
 *   - 3-Monthly (Quarterly): 40 diamonds / day
 *   - Yearly: 60 diamonds / day
 *
 * MAX+:
 *   - Weekly: 35 diamonds / day
 *   - Monthly: 50 diamonds / day
 *   - 3-Monthly (Quarterly): 70 diamonds / day
 *   - Yearly: 100 diamonds / day
 */

export function getVipPlusDiamondsPerDay(plan: SubscriptionPlan | any, tier: 'PRO_PLUS' | 'MAX_PLUS'): number {
  if (!plan) return tier === 'MAX_PLUS' ? 50 : 25;

  if (tier === 'PRO_PLUS' && plan.proPlusDailyDiamonds && plan.proPlusDailyDiamonds > 0) {
    return plan.proPlusDailyDiamonds;
  }
  if (tier === 'MAX_PLUS' && plan.maxPlusDailyDiamonds && plan.maxPlusDailyDiamonds > 0) {
    return plan.maxPlusDailyDiamonds;
  }

  const dur = `${plan.duration || ''} ${plan.name || ''}`.toLowerCase();

  if (tier === 'PRO_PLUS') {
    if (dur.includes('week') || dur.includes('7')) return 10;
    if (dur.includes('3 month') || dur.includes('90') || dur.includes('quarter')) return 40;
    if (dur.includes('year') || dur.includes('365') || dur.includes('annual')) return 60;
    return 25; // Default Monthly
  } else {
    if (dur.includes('week') || dur.includes('7')) return 35;
    if (dur.includes('3 month') || dur.includes('90') || dur.includes('quarter')) return 70;
    if (dur.includes('year') || dur.includes('365') || dur.includes('annual')) return 100;
    return 50; // Default Monthly
  }
}

/**
 * Returns default or custom VIP+ price:
 * By default: 1.5x of the PRO / MAX plan price.
 * Admin can override via Store Manager.
 */
export function getVipPlusBasePrice(plan: SubscriptionPlan | any, tier: 'PRO_PLUS' | 'MAX_PLUS'): number {
  if (!plan) return tier === 'MAX_PLUS' ? 299 : 224;

  if (tier === 'PRO_PLUS') {
    if (typeof plan.proPlusPrice === 'number' && plan.proPlusPrice > 0) {
      return plan.proPlusPrice;
    }
    const base = plan.basicPrice || 99;
    return Math.round(base * 1.5);
  } else {
    if (typeof plan.maxPlusPrice === 'number' && plan.maxPlusPrice > 0) {
      return plan.maxPlusPrice;
    }
    const base = plan.ultraPrice || 149;
    return Math.round(base * 1.5);
  }
}

export function getVipPlusOriginalPrice(plan: SubscriptionPlan | any, tier: 'PRO_PLUS' | 'MAX_PLUS'): number {
  if (!plan) return tier === 'MAX_PLUS' ? 599 : 449;

  if (tier === 'PRO_PLUS') {
    if (typeof plan.proPlusOriginalPrice === 'number' && plan.proPlusOriginalPrice > 0) {
      return plan.proPlusOriginalPrice;
    }
    const base = plan.basicOriginalPrice || (plan.basicPrice ? plan.basicPrice * 2 : 199);
    return Math.round(base * 1.5);
  } else {
    if (typeof plan.maxPlusOriginalPrice === 'number' && plan.maxPlusOriginalPrice > 0) {
      return plan.maxPlusOriginalPrice;
    }
    const base = plan.ultraOriginalPrice || (plan.ultraPrice ? plan.ultraPrice * 2 : 299);
    return Math.round(base * 1.5);
  }
}

/**
 * Approximate duration in days
 */
export function getPlanDurationDays(plan: any): number {
  if (!plan) return 30;
  if (plan.durationDays && plan.durationDays > 0) return plan.durationDays;
  const dur = `${plan.duration || ''} ${plan.name || ''}`.toLowerCase();
  if (dur.includes('year') || dur.includes('365') || dur.includes('annual')) return 365;
  if (dur.includes('3 month') || dur.includes('90') || dur.includes('quarter')) return 90;
  if (dur.includes('week') || dur.includes('7')) return 7;
  return 30;
}

export interface VipPlusDiscountInfo {
  tier: 'PRO_PLUS' | 'MAX_PLUS';
  basePrice: number;
  originalPrice: number;
  durDiscount: number;
  eventDiscount: number;
  eventEffectiveDiscount: number;
  subDiscount: number;
  userBonusDiscount: number;
  totalEffectiveDiscount: number;
  finalPrice: number;
  perDayCost: string;
  dailyDiamonds: number;
  totalDiamonds: number;
  durationDays: number;
}

export function calculateVipPlusPlanDiscount(
  plan: any,
  tier: 'PRO_PLUS' | 'MAX_PLUS',
  options: {
    durDiscount: number;
    baseAccountDiscount: number;
    eventDiscountPercent: number;
    subDiscount?: number;
    userBonusDiscount?: number;
  }
): VipPlusDiscountInfo {
  const basePrice = getVipPlusBasePrice(plan, tier);
  const originalPrice = getVipPlusOriginalPrice(plan, tier);
  const durationDays = getPlanDurationDays(plan);
  const dailyDiamonds = getVipPlusDiamondsPerDay(plan, tier);
  const totalDiamonds = dailyDiamonds * durationDays;

  const durDiscount = options.durDiscount || 0;
  const baseDiscount = Math.min(100, durDiscount + (options.baseAccountDiscount || 0));

  let eventEffectiveDiscount = 0;
  const eventDiscountPercent = options.eventDiscountPercent || 0;
  if (eventDiscountPercent > 0 && baseDiscount < 100) {
    const remainingBalance = 100 - baseDiscount;
    eventEffectiveDiscount = Math.round((remainingBalance * eventDiscountPercent) / 100);
  }

  const totalEffectiveDiscount = Math.min(100, baseDiscount + eventEffectiveDiscount);
  const finalPrice = Math.max(0, Math.round(basePrice * (1 - totalEffectiveDiscount / 100)));
  const perDayCost = durationDays > 0 ? (finalPrice / durationDays).toFixed(1) : '0';

  return {
    tier,
    basePrice,
    originalPrice,
    durDiscount,
    eventDiscount: eventDiscountPercent,
    eventEffectiveDiscount,
    subDiscount: options.subDiscount || 0,
    userBonusDiscount: options.userBonusDiscount || 0,
    totalEffectiveDiscount,
    finalPrice,
    perDayCost,
    dailyDiamonds,
    totalDiamonds,
    durationDays,
  };
}

/**
 * Checks if user has an active VIP+ subscription (PRO+ or MAX+)
 */
export function isVipPlusUser(user: any): boolean {
  if (!user || !user.isPremium) return false;
  if (user.subscriptionEndDate && new Date(user.subscriptionEndDate) <= new Date()) return false;
  return user.vipPlusTier === 'PRO_PLUS' || user.vipPlusTier === 'MAX_PLUS';
}

/**
 * Helper to activate VIP+ on user
 */
export function activateVipPlusSubscription(
  user: any,
  tier: 'PRO_PLUS' | 'MAX_PLUS',
  plan: any
): any {
  const durationDays = getPlanDurationDays(plan);
  const dailyDiamonds = getVipPlusDiamondsPerDay(plan, tier);
  const now = new Date();
  const endDate = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
  const planName = plan?.name || (tier === 'MAX_PLUS' ? 'MAX+ Elite Pass' : 'PRO+ Learner Pass');

  const diamondSub = {
    planId: `vipplus_${tier.toLowerCase()}_${Date.now()}`,
    planName: `${planName} (${tier === 'MAX_PLUS' ? 'MAX+' : 'PRO+'})`,
    dailyDiamonds,
    totalDays: durationDays,
    startDate: now.toISOString(),
    endDate: endDate.toISOString(),
    totalClaimedDays: 0,
    totalDiamondsClaimed: 0,
    pricePaid: getVipPlusBasePrice(plan, tier),
    status: 'ACTIVE' as const,
  };

  const activeSub = {
    id: `sub_vipplus_${Date.now()}`,
    tier: durationDays <= 7 ? 'WEEKLY' : durationDays <= 30 ? 'MONTHLY' : durationDays <= 90 ? '3_MONTHLY' : 'YEARLY',
    level: tier === 'MAX_PLUS' ? 'ULTRA' : 'BASIC',
    startDate: now.toISOString(),
    endDate: endDate.toISOString(),
    source: 'VIP_PLUS',
  };

  const existingSubs = Array.isArray(user.activeSubscriptions) ? [...user.activeSubscriptions] : [];
  existingSubs.push(activeSub);

  return {
    ...user,
    isPremium: true,
    subscriptionLevel: tier === 'MAX_PLUS' ? 'ULTRA' : 'BASIC',
    subscriptionTier: activeSub.tier,
    subscriptionEndDate: endDate.toISOString(),
    vipPlusTier: tier,
    dailyVipDiamonds: dailyDiamonds,
    diamondSubscription: diamondSub,
    studyMode: 'CREDIT',
    activeSubscriptions: existingSubs,
  };
}
