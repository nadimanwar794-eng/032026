import re

with open('artifacts/iic-study-app-replit/src/types.ts', 'r') as f:
    content = f.read()

# Add to CreditSubscriptionPlan
find_csp = """  scoreMultiplier?: number; // XP Multiplier: Starter (1.1x), Smart (1.2x), Super (1.3x), Mega (1.5x)
}"""
replace_csp = """  scoreMultiplier?: number; // XP Multiplier: Starter (1.1x), Smart (1.2x), Super (1.3x), Mega (1.5x)
  weeklyPrice?: number; // Price for 7 days
}"""
content = content.replace(find_csp, replace_csp)

# Add Diamond settings to SystemSettings
find_sys = """  creditSubscriptionPlans?: CreditSubscriptionPlan[]; // Daily Credit Subscription Plans managed by Admin
}"""
replace_sys = """  creditSubscriptionPlans?: CreditSubscriptionPlan[]; // Daily Credit Subscription Plans managed by Admin
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
  }[];
}"""
content = content.replace(find_sys, replace_sys)

with open('artifacts/iic-study-app-replit/src/types.ts', 'w') as f:
    f.write(content)

print("Updated types.ts")
