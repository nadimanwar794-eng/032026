import re

with open('artifacts/iic-study-app-replit/src/utils/diamondUtils.ts', 'r') as f:
    content = f.read()

find_plans = """export const DIAMOND_SUBSCRIPTION_PLANS: DiamondSubscriptionPlan[] = [
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
  {
    id: '90_DAYS_PASS',
    name: '3 Months Diamond Pass',
    price: 2500,
    dailyDiamonds: 30,
    durationDays: 90,
    totalDiamonds: 2700,
    badge: 'Super Value (2700 💎)',
  },
  {
    id: '365_DAYS_PASS',
    name: 'Yearly Diamond Pass',
    price: 8000,
    dailyDiamonds: 40,
    durationDays: 365,
    totalDiamonds: 14600,
    badge: 'Ultimate Value (14600 💎)',
  },
];"""

replace_plans = """export const DIAMOND_SUBSCRIPTION_PLANS: DiamondSubscriptionPlan[] = [
  {
    id: 'starter_diamond',
    name: 'Starter Diamond Pass',
    price: 450, // Base 1 Month price
    dailyDiamonds: 10,
    durationDays: 30,
    totalDiamonds: 300,
    badge: 'STARTER',
  },
  {
    id: 'active_diamond',
    name: 'Active Diamond Pass',
    price: 900, // Base 1 Month price
    dailyDiamonds: 20,
    durationDays: 30,
    totalDiamonds: 600,
    badge: 'POPULAR',
  },
  {
    id: 'premium_diamond',
    name: 'Premium Diamond Pass',
    price: 1350, // Base 1 Month price
    dailyDiamonds: 30,
    durationDays: 30,
    totalDiamonds: 900,
    badge: 'PREMIUM',
  },
  {
    id: 'elite_diamond',
    name: 'Elite Diamond Pass',
    price: 2250, // Base 1 Month price
    dailyDiamonds: 50,
    durationDays: 30,
    totalDiamonds: 1500,
    badge: 'ELITE',
  },
];"""

content = content.replace(find_plans, replace_plans)

# Also need to update activateDiamondSub to take durationDays if passed
find_activate = """export function activateDiamondSub(
  user: User,
  planId: string
): User {"""

replace_activate = """export function activateDiamondSub(
  user: User,
  planId: string,
  customDurationDays?: number,
  customPlanName?: string
): User {"""

content = content.replace(find_activate, replace_activate)

find_activate_impl = """  const plan = DIAMOND_SUBSCRIPTION_PLANS.find(p => p.id === planId) || DIAMOND_SUBSCRIPTION_PLANS[0];
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
  };"""

replace_activate_impl = """  const plan = DIAMOND_SUBSCRIPTION_PLANS.find(p => p.id === planId) || DIAMOND_SUBSCRIPTION_PLANS[0];
  const duration = customDurationDays || plan.durationDays;
  const nameToUse = customPlanName || plan.name;
  const startDate = new Date();
  const endDate = new Date(startDate.getTime() + duration * 24 * 60 * 60 * 1000);
  const newSub: UserDiamondSubscription = {
    planId: plan.id,
    planName: nameToUse,
    dailyDiamonds: plan.dailyDiamonds,
    totalDays: duration,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    totalClaimedDays: 0,
    totalDiamondsClaimed: 0,
    pricePaid: plan.price, // might need adjustment based on duration if actually charging
    status: 'ACTIVE',
  };"""

content = content.replace(find_activate_impl, replace_activate_impl)

with open('artifacts/iic-study-app-replit/src/utils/diamondUtils.ts', 'w') as f:
    f.write(content)
print("Updated diamondUtils.ts")
