import re

with open('artifacts/iic-study-app-replit/src/components/Store.tsx', 'r') as f:
    content = f.read()

# Fix diamond unified templates
find_diamond = """  const [tierType, setTierType] = useState<'SUBSCRIPTION' | 'CREDITS' | 'DIAMONDS' | 'EXCHANGE' | 'HISTORY'>(() => {
    if (initialTier === 'DIAMONDS') return 'DIAMONDS';
    if (initialTier === 'EXCHANGE') return 'EXCHANGE';
    return initialTier || 'SUBSCRIPTION';
  });"""

replace_diamond = """  const [tierType, setTierType] = useState<'SUBSCRIPTION' | 'CREDITS' | 'DIAMONDS' | 'EXCHANGE' | 'HISTORY'>(() => {
    if (initialTier === 'DIAMONDS') return 'DIAMONDS';
    if (initialTier === 'EXCHANGE') return 'EXCHANGE';
    return initialTier || 'SUBSCRIPTION';
  });

  const DIAMOND_SUB_DURATIONS_LIST = settings?.diamondDurations && settings.diamondDurations.length > 0 
    ? settings.diamondDurations 
    : DEFAULT_DIAMOND_SUB_DURATIONS_LIST;

  const diamondUnifiedTemplates = settings?.diamondTemplates && settings.diamondTemplates.length > 0 
    ? settings.diamondTemplates 
    : DEFAULT_diamondUnifiedTemplates;
"""

content = content.replace(find_diamond, replace_diamond)

# Fix credit plans
find_credit = """          const creditSubPlans = rawCreditSubPlans.length > 0 ? rawCreditSubPlans : [
            { id: 'starter_credit_pass', name: 'Starter Credit Pass', badge: 'STARTER PASS', dailyCredits: 50,  scoreMultiplier: 1.1, weeklyPrice: 40,  price: 150 },
            { id: 'smart_credit_pass',   name: 'Smart Credit Pass',   badge: 'POPULAR PASS', dailyCredits: 100, scoreMultiplier: 1.2, weeklyPrice: 70,  price: 260 },
            { id: 'super_credit_pass',   name: 'Super Credit Pass',   badge: 'VALUE PASS',   dailyCredits: 150, scoreMultiplier: 1.3, weeklyPrice: 100, price: 380 },
            { id: 'mega_credit_pass',    name: 'Mega Credit Pass',    badge: 'MEGA PACK',    dailyCredits: 250, scoreMultiplier: 1.5, weeklyPrice: 150, price: 550 },
          ];"""

replace_credit = """          const creditSubPlans = rawCreditSubPlans;"""

content = content.replace(find_credit, replace_credit)

with open('artifacts/iic-study-app-replit/src/components/Store.tsx', 'w') as f:
    f.write(content)

print("Fixed Store.tsx")
