import re

with open('artifacts/iic-study-app-replit/src/utils/diamondUtils.ts', 'r') as f:
    content = f.read()

find_block = """  const plan = DIAMOND_SUBSCRIPTION_PLANS.find(p => p.id === planId) || DIAMOND_SUBSCRIPTION_PLANS[0];
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

replace_block = """  const plan = DIAMOND_SUBSCRIPTION_PLANS.find(p => p.id === planId) || DIAMOND_SUBSCRIPTION_PLANS[0];
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
    pricePaid: plan.price,
    status: 'ACTIVE',
  };"""

content = content.replace(find_block, replace_block)

with open('artifacts/iic-study-app-replit/src/utils/diamondUtils.ts', 'w') as f:
    f.write(content)
print("Fixed activateDiamondSub")
