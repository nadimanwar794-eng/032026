import re

with open('artifacts/iic-study-app-replit/src/utils/diamondUtils.ts', 'r') as f:
    content = f.read()

new_func = """export function getDiamondSubscriptionPlans(settings?: SystemSettings): DiamondSubscriptionPlan[] {
  if (settings?.diamondSubscriptionPlans && settings.diamondSubscriptionPlans.length > 0) {
    return settings.diamondSubscriptionPlans;
  }
  return DIAMOND_SUBSCRIPTION_PLANS;
}

export function activateDiamondSub(
  user: User,
  planId: string,
  customDurationDays?: number,
  customPlanName?: string,
  settings?: SystemSettings
): User {
  const plans = getDiamondSubscriptionPlans(settings);
  const plan = plans.find(p => p.id === planId) || plans[0];"""

# Replace activateDiamondSub signature and add getDiamondSubscriptionPlans
find_str = """export function activateDiamondSub(
  user: User,
  planId: string,
  customDurationDays?: number,
  customPlanName?: string
): User {
  const plan = DIAMOND_SUBSCRIPTION_PLANS.find(p => p.id === planId) || DIAMOND_SUBSCRIPTION_PLANS[0];"""

content = content.replace(find_str, new_func)

# Fix imports in diamondUtils
import_find = "import { User, UserDiamondSubscription } from '../types';"
import_replace = "import { User, UserDiamondSubscription, SystemSettings } from '../types';"
content = content.replace(import_find, import_replace)

with open('artifacts/iic-study-app-replit/src/utils/diamondUtils.ts', 'w') as f:
    f.write(content)

print("Updated diamondUtils.ts")
