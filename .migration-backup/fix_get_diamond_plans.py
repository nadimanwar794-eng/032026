import re

with open('artifacts/iic-study-app-replit/src/utils/diamondUtils.ts', 'r') as f:
    content = f.read()

find_fn = """export function getDiamondSubscriptionPlans(settings?: SystemSettings): DiamondSubscriptionPlan[] {
  if (settings?.diamondSubscriptionPlans && settings.diamondSubscriptionPlans.length > 0) {
    return settings.diamondSubscriptionPlans;
  }
  return DIAMOND_SUBSCRIPTION_PLANS;
}"""

replace_fn = """export function getDiamondSubscriptionPlans(settings?: SystemSettings): DiamondSubscriptionPlan[] {
  if (settings?.diamondTemplates && settings.diamondTemplates.length > 0) {
    return settings.diamondTemplates.map(t => ({
        id: t.id,
        name: t.name,
        price: 0,
        dailyDiamonds: t.dailyDiamonds,
        durationDays: 30, // Default fallback
        totalDiamonds: t.dailyDiamonds * 30,
    }));
  }
  return DIAMOND_SUBSCRIPTION_PLANS;
}"""

content = content.replace(find_fn, replace_fn)

with open('artifacts/iic-study-app-replit/src/utils/diamondUtils.ts', 'w') as f:
    f.write(content)

print("Fixed getDiamondSubscriptionPlans")
