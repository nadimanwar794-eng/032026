import re

with open('artifacts/iic-study-app-replit/src/components/Store.tsx', 'r') as f:
    content = f.read()

find_durations = """const DIAMOND_SUB_DURATIONS_LIST = [
  { id: '7_DAYS', label: '7D', days: 7, ratePerDiamond: 1.80 },
  { id: '30_DAYS', label: '1M', days: 30, ratePerDiamond: 1.50 },
  { id: '90_DAYS', label: '3M', days: 90, ratePerDiamond: 1.30 },
  { id: '180_DAYS', label: '6M', days: 180, ratePerDiamond: 1.15 },
  { id: '365_DAYS', label: '1Y', days: 365, ratePerDiamond: 1.00 },
];"""

replace_durations = """const DEFAULT_DIAMOND_SUB_DURATIONS_LIST = [
  { id: '7_DAYS', label: '7D', days: 7, ratePerDiamond: 1.80 },
  { id: '30_DAYS', label: '1M', days: 30, ratePerDiamond: 1.50 },
  { id: '90_DAYS', label: '3M', days: 90, ratePerDiamond: 1.30 },
  { id: '180_DAYS', label: '6M', days: 180, ratePerDiamond: 1.15 },
  { id: '365_DAYS', label: '1Y', days: 365, ratePerDiamond: 1.00 },
];"""
content = content.replace(find_durations, replace_durations)

find_templates = """const diamondUnifiedTemplates = [
  {
    id: 'starter_diamond',
    name: 'Starter Diamond Pass',
    icon: '💎',
    dailyDiamonds: 10,
    features: ['Daily 10 💎 Drop Claim', 'Chapters Permanently Unlock', 'Lifetime Content Access', 'Instant Credit Swap Ready']
  },
  {
    id: 'active_diamond',
    name: 'Active Diamond Pass',
    icon: '⚡',
    dailyDiamonds: 20,
    features: ['Daily 20 💎 Drop Claim', 'Tez Chapters Unlocking', 'Permanent Vault Access', '1 💎 = 30 🪙 Auto Swap']
  },
  {
    id: 'premium_diamond',
    name: 'Premium Diamond Pass',
    icon: '🌟',
    dailyDiamonds: 30,
    features: ['Daily 30 💎 Drop Claim', 'Premium Content Unlocks', 'Heavy Diamond Reserve', 'Priority Support Claim']
  },
  {
    id: 'elite_diamond',
    name: 'Elite Diamond Pass',
    icon: '👑',
    dailyDiamonds: 50,
    features: ['Daily 50 💎 Huge Drop', 'Sabse Tez Unlock Speed', 'Max Savings per Diamond', 'VIP Lifetime Diamond Stack']
  }
];"""

replace_templates = """const DEFAULT_diamondUnifiedTemplates = [
  {
    id: 'starter_diamond',
    name: 'Starter Diamond Pass',
    icon: '💎',
    dailyDiamonds: 10,
    features: ['Daily 10 💎 Drop Claim', 'Chapters Permanently Unlock', 'Lifetime Content Access', 'Instant Credit Swap Ready']
  },
  {
    id: 'active_diamond',
    name: 'Active Diamond Pass',
    icon: '⚡',
    dailyDiamonds: 20,
    features: ['Daily 20 💎 Drop Claim', 'Tez Chapters Unlocking', 'Permanent Vault Access', '1 💎 = 30 🪙 Auto Swap']
  },
  {
    id: 'premium_diamond',
    name: 'Premium Diamond Pass',
    icon: '🌟',
    dailyDiamonds: 30,
    features: ['Daily 30 💎 Drop Claim', 'Premium Content Unlocks', 'Heavy Diamond Reserve', 'Priority Support Claim']
  },
  {
    id: 'elite_diamond',
    name: 'Elite Diamond Pass',
    icon: '👑',
    dailyDiamonds: 50,
    features: ['Daily 50 💎 Huge Drop', 'Sabse Tez Unlock Speed', 'Max Savings per Diamond', 'VIP Lifetime Diamond Stack']
  }
];"""
content = content.replace(find_templates, replace_templates)


# Now within the component, derive them from settings.
find_component_start = """  const [tierType, setTierType] = useState<'SUBSCRIPTION' | 'CREDITS' | 'DIAMONDS' | 'EXCHANGE' | 'HISTORY'>(initialTier || 'SUBSCRIPTION');"""

replace_component_start = """  const [tierType, setTierType] = useState<'SUBSCRIPTION' | 'CREDITS' | 'DIAMONDS' | 'EXCHANGE' | 'HISTORY'>(initialTier || 'SUBSCRIPTION');

  const DIAMOND_SUB_DURATIONS_LIST = settings?.diamondDurations && settings.diamondDurations.length > 0 
    ? settings.diamondDurations 
    : DEFAULT_DIAMOND_SUB_DURATIONS_LIST;

  const diamondUnifiedTemplates = settings?.diamondTemplates && settings.diamondTemplates.length > 0 
    ? settings.diamondTemplates 
    : DEFAULT_diamondUnifiedTemplates;
"""
content = content.replace(find_component_start, replace_component_start)


with open('artifacts/iic-study-app-replit/src/components/Store.tsx', 'w') as f:
    f.write(content)

print("Connected Store.tsx to settings")
