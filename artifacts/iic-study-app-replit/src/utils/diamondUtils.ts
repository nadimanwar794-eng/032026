import { User, UserDiamondSubscription, DiamondPack, DiamondSubscriptionPlan } from '../types';

/**
 * Direct Diamond Packs as requested:
 * 100 rs -> 50 diamonds
 * 200 rs -> 105 diamonds
 * 400 rs -> 250 diamonds
 * 1000 rs -> 650 diamonds
 * 2000 rs -> 1400 diamonds
 * 5000 rs -> 5000 diamonds
 * Fixed pricing (no arbitrary discounts on diamonds)
 */
export const DIAMOND_PACKS: DiamondPack[] = [
  {
    id: 'pack_50_dia',
    name: 'Starter Pouch',
    price: 100,
    diamonds: 50,
    bonusDiamonds: 0,
    popular: false,
  },
  {
    id: 'pack_105_dia',
    name: 'Value Sack',
    price: 200,
    diamonds: 105,
    bonusDiamonds: 5,
    popular: true,
  },
  {
    id: 'pack_250_dia',
    name: 'Pro Treasure',
    price: 400,
    diamonds: 250,
    bonusDiamonds: 50,
    popular: false,
  },
  {
    id: 'pack_650_dia',
    name: 'Royal Chest',
    price: 1000,
    diamonds: 650,
    bonusDiamonds: 150,
    popular: false,
  },
  {
    id: 'pack_1400_dia',
    name: 'Master Vault',
    price: 2000,
    diamonds: 1400,
    bonusDiamonds: 400,
    popular: false,
  },
  {
    id: 'pack_5000_dia',
    name: 'Supreme Hoard',
    price: 5000,
    diamonds: 5000,
    bonusDiamonds: 2500,
    popular: true,
  },
];

/**
 * Diamond Subscriptions:
 * 100 rs -> daily 10 diamonds for 7 days (Total 70 diamonds)
 * 1000 rs -> daily 25 diamonds for 30 days (Total 750 diamonds)
 */
export const DIAMOND_SUBSCRIPTION_PLANS: DiamondSubscriptionPlan[] = [
  {
    id: '7_DAYS_PASS',
    name: 'Weekly Diamond Pass',
    price: 100,
    dailyDiamonds: 10,
    durationDays: 7,
    totalDiamonds: 70,
    badge: 'Popular Pass',
  },
  {
    id: '30_DAYS_PASS',
    name: 'Monthly Diamond Pass',
    price: 1000,
    dailyDiamonds: 25,
    durationDays: 30,
    totalDiamonds: 750,
    badge: 'Mega Value Pass (750 💎)',
  },
];

/**
 * Exchange Rate: 1 Diamond = 20 Credits
 */
export const DIAMOND_TO_CREDIT_RATE = 20;
export const CREDITS_PER_DIAMOND = 20;

/**
 * Safely get user's diamonds count
 */
export function getUserDiamonds(user?: User | null): number {
  if (!user) return 0;
  return Number(user.diamonds ?? 0);
}

/**
 * Convert Diamonds to Credits:
 * Checks if user has enough diamonds, deducts diamonds and adds credits (numDiamonds * 20)
 */
export function exchangeDiamondsForCredits(
  user: User,
  numDiamonds: number
): { success: boolean; updatedUser: User; creditsAdded: number; creditsEarned: number; error?: string } {
  if (numDiamonds <= 0) {
    return { success: false, updatedUser: user, creditsAdded: 0, creditsEarned: 0, error: 'Diamonds ki sankhya 1 ya usse zyada honi chahiye' };
  }
  const currentDiamonds = getUserDiamonds(user);
  if (currentDiamonds < numDiamonds) {
    return {
      success: false,
      updatedUser: user,
      creditsAdded: 0,
      creditsEarned: 0,
      error: `Aapke paas paryapt Diamonds nahi hain. Chahiye: ${numDiamonds} 💎, Hai: ${currentDiamonds} 💎`,
    };
  }

  const creditsToAdd = numDiamonds * DIAMOND_TO_CREDIT_RATE;
  const updatedUser: User = {
    ...user,
    diamonds: currentDiamonds - numDiamonds,
    credits: (user.credits ?? 0) + creditsToAdd,
  };

  return {
    success: true,
    updatedUser,
    creditsAdded: creditsToAdd,
    creditsEarned: creditsToAdd,
  };
}

/**
 * Check if Diamond Subscription is currently active
 */
export function isDiamondSubActive(user?: User | null): boolean {
  if (!user?.diamondSubscription) return false;
  const sub = user.diamondSubscription;
  if (sub.status === 'EXPIRED') return false;
  const now = new Date().getTime();
  const end = new Date(sub.endDate).getTime();
  return end > now;
}

/**
 * Check if user can claim today's daily diamonds from active subscription
 */
export function canClaimDiamondSubToday(user?: User | null): boolean {
  if (!user || !isDiamondSubActive(user)) return false;
  const today = new Date().toISOString().split('T')[0];
  return user.diamondSubscription?.lastClaimDate !== today;
}

/**
 * Alias for canClaimDiamondSubToday
 */
export const canClaimDailyDiamonds = canClaimDiamondSubToday;

/**
 * Remaining days of active diamond subscription
 */
export function getDiamondSubDaysRemaining(user?: User | null): number {
  if (!user || !isDiamondSubActive(user)) return 0;
  const now = new Date().getTime();
  const end = new Date(user.diamondSubscription!.endDate).getTime();
  const diff = Math.max(0, end - now);
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * Claim today's daily diamonds from active subscription
 */
export function claimDailyDiamonds(
  user: User
): { success: boolean; earned: number; updatedUser: User } | null {
  if (!canClaimDiamondSubToday(user)) return null;
  const sub = user.diamondSubscription!;
  const today = new Date().toISOString().split('T')[0];
  const dailyAmount = sub.dailyDiamonds;

  const updatedSub: UserDiamondSubscription = {
    ...sub,
    lastClaimDate: today,
    totalClaimedDays: (sub.totalClaimedDays || 0) + 1,
    totalDiamondsClaimed: (sub.totalDiamondsClaimed || 0) + dailyAmount,
  };

  const updatedUser: User = {
    ...user,
    diamonds: getUserDiamonds(user) + dailyAmount,
    diamondSubscription: updatedSub,
  };

  return {
    success: true,
    earned: dailyAmount,
    updatedUser,
  };
}

/**
 * Helper to activate diamond subscription upon purchase
 */
export function activateDiamondSub(
  user: User,
  planId: string
): User {
  const plan = DIAMOND_SUBSCRIPTION_PLANS.find(p => p.id === planId) || DIAMOND_SUBSCRIPTION_PLANS[0];
  const startDate = new Date();
  const endDate = new Date(startDate.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);

  const newSub: UserDiamondSubscription = {
    planId: plan.id,
    planName: plan.name,
    dailyDiamonds: plan.dailyDiamonds,
    totalDays: plan.durationDays,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    totalClaimedDays: 0,
    totalDiamondsClaimed: 0,
    pricePaid: plan.price,
    status: 'ACTIVE',
  };

  return {
    ...user,
    diamondSubscription: newSub,
  };
}

/**
 * Helper to cancel/revoke diamond subscription (Admin action)
 */
export function cancelDiamondSub(user: User): User {
  return {
    ...user,
    diamondSubscription: undefined,
  };
}
