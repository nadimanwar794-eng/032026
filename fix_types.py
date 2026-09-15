import re

with open('artifacts/iic-study-app-replit/src/types.ts', 'r') as f:
    content = f.read()

find_str = "creditSubscriptionPlans?: CreditSubscriptionPlan[]; // Daily Credit Subscription Plans managed by Admin"
replace_str = """creditSubscriptionPlans?: CreditSubscriptionPlan[]; // Daily Credit Subscription Plans managed by Admin
  diamondTemplates?: {
    id: string;
    name: string;
    icon: string;
    dailyDiamonds: number;
    features: string[];
  }[];
  diamondDurations?: {
    id: string;
    label: string;
    days: number;
    ratePerDiamond: number;
  }[];"""

content = content.replace(find_str, replace_str)

with open('artifacts/iic-study-app-replit/src/types.ts', 'w') as f:
    f.write(content)

print("Fixed types")
