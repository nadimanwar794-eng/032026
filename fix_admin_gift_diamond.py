import re

with open('artifacts/iic-study-app-replit/src/components/AdminDashboard.tsx', 'r') as f:
    content = f.read()

fallback_templates = """(localSettings.diamondTemplates || [
    { id: 'starter_diamond', name: 'Starter Diamond Pass', icon: '💎', dailyDiamonds: 10, features: [] },
    { id: 'active_diamond', name: 'Active Diamond Pass', icon: '⚡', dailyDiamonds: 20, features: [] },
    { id: 'premium_diamond', name: 'Premium Diamond Pass', icon: '🌟', dailyDiamonds: 30, features: [] },
    { id: 'elite_diamond', name: 'Elite Diamond Pass', icon: '👑', dailyDiamonds: 50, features: [] }
])"""

content = content.replace("DIAMOND_SUBSCRIPTION_PLANS", fallback_templates)

with open('artifacts/iic-study-app-replit/src/components/AdminDashboard.tsx', 'w') as f:
    f.write(content)

print("Fixed gift codes")
