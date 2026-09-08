import { User, CreditSubscriptionPlan, UserCreditSubscription, SystemSettings } from '../types';
import { recordCreditTx } from './creditHistory';

export const DEFAULT_CREDIT_SUB_PLANS: CreditSubscriptionPlan[] = [
  {
    id: 'csp_100',
    name: 'Starter Credit Pass',
    price: 100,
    dummyPrice: 199,
    dailyCredits: 50,
    durationDays: 30,
    badge: 'STARTER',
    description: 'Roz 50 Credits milenge (Total 1,500 Credits)',
    isActive: true,
  },
  {
    id: 'csp_200',
    name: 'Smart Credit Pass',
    price: 200,
    dummyPrice: 399,
    dailyCredits: 110,
    durationDays: 30,
    badge: 'POPULAR',
    description: 'Roz 110 Credits milenge (Total 3,300 Credits)',
    isActive: true,
  },
  {
    id: 'csp_300',
    name: 'Super Credit Pass',
    price: 300,
    dummyPrice: 599,
    dailyCredits: 175,
    durationDays: 30,
    badge: 'VALUE',
    description: 'Roz 175 Credits milenge (Total 5,250 Credits)',
    isActive: true,
  },
  {
    id: 'csp_500',
    name: 'Mega Credit Pass',
    price: 500,
    dummyPrice: 999,
    dailyCredits: 300,
    durationDays: 30,
    badge: 'MEGA',
    description: 'Roz 300 Credits milenge (Total 9,000 Credits)',
    isActive: true,
  },
];

export const PRESET_CREDIT_SUB_TEMPLATES = [
  {
    name: 'Quarterly Credit Pass',
    durationDays: 90,
    price: 550,
    dummyPrice: 1099,
    dailyCredits: 120,
    badge: '3-MONTH',
    description: 'Roz 120 Credits · 90 Din Valid (Total 10,800 Credits)',
  },
  {
    name: 'Half-Yearly Pass',
    durationDays: 180,
    price: 999,
    dummyPrice: 1999,
    dailyCredits: 130,
    badge: '6-MONTH',
    description: 'Roz 130 Credits · 180 Din Valid (Total 23,400 Credits)',
  },
  {
    name: 'Annual Mega Pass',
    durationDays: 365,
    price: 1800,
    dummyPrice: 3999,
    dailyCredits: 150,
    badge: 'YEARLY',
    description: 'Roz 150 Credits · 365 Din Valid (Total 54,750 Credits)',
  },
];

export type CreditSubDurationId = '1_MONTH' | '3_MONTH' | '6_MONTH' | '1_YEAR';

export interface CreditSubDurationOption {
  id: CreditSubDurationId;
  label: string;
  subLabel: string;
  months: number;
  durationDays: number;
  multiplier: number; // 1, 3, 6, 12
  durationDiscountPercent: number; // 0, 10, 25, 25
  badge?: string;
  highlight?: boolean;
}

export const CREDIT_SUB_DURATIONS: CreditSubDurationOption[] = [
  {
    id: '1_MONTH',
    label: '1 Month',
    subLabel: '30 Din',
    months: 1,
    durationDays: 30,
    multiplier: 1,
    durationDiscountPercent: 5,
    badge: '5% OFF',
  },
  {
    id: '3_MONTH',
    label: '3 Months',
    subLabel: '90 Din',
    months: 3,
    durationDays: 90,
    multiplier: 3,
    durationDiscountPercent: 10,
    badge: '10% OFF',
  },
  {
    id: '6_MONTH',
    label: '6 Months',
    subLabel: '180 Din',
    months: 6,
    durationDays: 180,
    multiplier: 6,
    durationDiscountPercent: 15,
    badge: '15% OFF',
  },
  {
    id: '1_YEAR',
    label: '1 Year',
    subLabel: '365 Din',
    months: 12,
    durationDays: 365,
    multiplier: 12,
    durationDiscountPercent: 25,
    badge: '25% OFF',
    highlight: true,
  },
];

/**
 * Calculates pricing for a credit subscription plan based on selected duration.
 * Note: Duration discounts apply (1M: 5%, 3M: 10%, 6M: 15%, 1Y: 25%).
 */
export function calculateCreditSubPrice(
  base30DayPlan: CreditSubscriptionPlan,
  durationOption: CreditSubDurationOption,
  _isUltraUser?: boolean
): {
  basePrice: number;
  dummyPrice: number;
  durationDiscountPercent: number;
  totalDiscountPercent: number;
  finalPrice: number;
  totalCredits: number;
  perDayCost: string;
  perCreditCost: string;
} {
  // Base price multiplied by duration months (1x, 3x, 6x, 12x)
  const basePrice = base30DayPlan.price * durationOption.multiplier;
  const dummyMultiplier = durationOption.multiplier;
  const dummyPrice = (base30DayPlan.dummyPrice || Math.round(base30DayPlan.price * 1.8)) * dummyMultiplier;

  // Duration discount (1 month: 5%, 3 months: 10%, 6 months: 15%, 1 year: 25%)
  const durationDiscountPercent = durationOption.durationDiscountPercent;
  const totalDiscountPercent = durationDiscountPercent;

  // Discounted final price
  const finalPrice = totalDiscountPercent > 0
    ? Math.max(1, Math.round(basePrice * (1 - totalDiscountPercent / 100)))
    : basePrice;

  const totalCredits = base30DayPlan.dailyCredits * durationOption.durationDays;
  const perDayCost = (finalPrice / durationOption.durationDays).toFixed(1);
  const perCreditCost = totalCredits > 0 ? (finalPrice / totalCredits).toFixed(2) : '0';

  return {
    basePrice,
    dummyPrice,
    durationDiscountPercent,
    totalDiscountPercent,
    finalPrice,
    totalCredits,
    perDayCost,
    perCreditCost,
  };
}

export function getCreditSubPlans(settings?: SystemSettings | null): CreditSubscriptionPlan[] {
  if (settings?.creditSubscriptionPlans && settings.creditSubscriptionPlans.length > 0) {
    return settings.creditSubscriptionPlans;
  }
  return DEFAULT_CREDIT_SUB_PLANS;
}

export function isCreditSubActive(user?: User | null): boolean {
  if (!user || !user.creditSubscription) return false;
  const sub = user.creditSubscription;
  if (sub.status === 'EXPIRED') return false;
  const end = new Date(sub.endDate).getTime();
  return !Number.isNaN(end) && end > Date.now();
}

export function getTodayDateString(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

export function canClaimCreditSubToday(user?: User | null): boolean {
  if (!isCreditSubActive(user)) return false;
  const sub = user!.creditSubscription!;
  const today = getTodayDateString();
  return sub.lastClaimDate !== today;
}

export function getCreditSubDaysRemaining(sub?: UserCreditSubscription | null): number {
  if (!sub || !sub.endDate) return 0;
  const end = new Date(sub.endDate).getTime();
  if (Number.isNaN(end)) return 0;
  const diff = end - Date.now();
  if (diff <= 0) return 0;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * Grants or activates a credit subscription for a user.
 * STRICT CRITICAL RULE:
 * This ONLY grants daily credits. It DOES NOT set `isPremium: true` or touch `subscriptionTier`/`subscriptionLevel`.
 */
export function grantCreditSubscription(
  user: User,
  plan: CreditSubscriptionPlan,
  customDurationDays?: number,
  customPricePaid?: number,
  customPlanName?: string
): User {
  const days = customDurationDays || plan.durationDays || 30;
  const now = new Date();
  const endDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  const sub: UserCreditSubscription = {
    planId: plan.id,
    planName: customPlanName || plan.name,
    dailyCredits: plan.dailyCredits,
    startDate: now.toISOString(),
    endDate: endDate.toISOString(),
    lastClaimDate: '', // Can claim immediately for today
    totalClaimedDays: 0,
    totalCreditsClaimed: 0,
    pricePaid: customPricePaid !== undefined ? customPricePaid : plan.price,
    status: 'ACTIVE',
  };

  return {
    ...user,
    creditSubscription: sub,
  };
}

/**
 * Claims today's daily credits for a user with an active credit subscription.
 * Returns the updated user object and the amount of credits earned, or null if cannot claim.
 */
export function claimDailyCreditSub(user: User): { updatedUser: User; earned: number } | null {
  if (!canClaimCreditSubToday(user)) return null;

  const sub = user.creditSubscription!;
  const today = getTodayDateString();
  const earned = sub.dailyCredits;
  const newCredits = (user.credits || 0) + earned;

  const updatedSub: UserCreditSubscription = {
    ...sub,
    lastClaimDate: today,
    totalClaimedDays: (sub.totalClaimedDays || 0) + 1,
    totalCreditsClaimed: (sub.totalCreditsClaimed || 0) + earned,
    status: 'ACTIVE',
  };

  const updatedUser: User = {
    ...user,
    credits: newCredits,
    creditSubscription: updatedSub,
  };

  // Record in credit transaction history for transparency
  recordCreditTx(
    user.id,
    earned,
    'EARN_DAILY_SUB',
    `Daily Credit Pass: +${earned} Credits claimed (${sub.planName})`,
    newCredits
  );

  return { updatedUser, earned };
}

/**
 * Revokes / expires an active credit subscription.
 */
export function cancelCreditSubscription(user: User): User {
  if (!user.creditSubscription) return user;
  return {
    ...user,
    creditSubscription: {
      ...user.creditSubscription,
      status: 'EXPIRED',
    },
  };
}
