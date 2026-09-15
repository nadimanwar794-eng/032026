import re

with open('artifacts/iic-study-app-replit/src/components/AdminDashboard.tsx', 'r') as f:
    content = f.read()

# Replace the broken import
find_broken = """import { activateDiamondSub, cancelDiamondSub, isDiamondSubActive, getDiamondSubDaysRemaining, (localSettings.diamondTemplates || [
    { id: 'starter_diamond', name: 'Starter Diamond Pass', icon: '💎', dailyDiamonds: 10, features: [] },
    { id: 'active_diamond', name: 'Active Diamond Pass', icon: '⚡', dailyDiamonds: 20, features: [] },
    { id: 'premium_diamond', name: 'Premium Diamond Pass', icon: '🌟', dailyDiamonds: 30, features: [] },
    { id: 'elite_diamond', name: 'Elite Diamond Pass', icon: '👑', dailyDiamonds: 50, features: [] }
]) } from '../utils/diamondUtils';"""

replace_fixed = """import { activateDiamondSub, cancelDiamondSub, isDiamondSubActive, getDiamondSubDaysRemaining } from '../utils/diamondUtils';"""

content = content.replace(find_broken, replace_fixed)

with open('artifacts/iic-study-app-replit/src/components/AdminDashboard.tsx', 'w') as f:
    f.write(content)

print("Fixed import")
