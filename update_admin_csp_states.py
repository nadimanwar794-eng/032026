import re

with open('artifacts/iic-study-app-replit/src/components/AdminDashboard.tsx', 'r') as f:
    content = f.read()

find_str = """  const [newCspName, setNewCspName] = useState('');
  const [newCspPrice, setNewCspPrice] = useState('');
  const [newCspDummyPrice, setNewCspDummyPrice] = useState('');
  const [newCspDailyCredits, setNewCspDailyCredits] = useState('');
  const [newCspDurationDays, setNewCspDurationDays] = useState('30');
  const [newCspBadge, setNewCspBadge] = useState('');"""

replace_str = """  const [newCspName, setNewCspName] = useState('');
  const [newCspPrice, setNewCspPrice] = useState('');
  const [newCspWeeklyPrice, setNewCspWeeklyPrice] = useState('');
  const [newCspDummyPrice, setNewCspDummyPrice] = useState('');
  const [newCspDailyCredits, setNewCspDailyCredits] = useState('');
  const [newCspDurationDays, setNewCspDurationDays] = useState('30');
  const [newCspBadge, setNewCspBadge] = useState('');
  const [newCspScoreMultiplier, setNewCspScoreMultiplier] = useState('');"""

content = content.replace(find_str, replace_str)

# Add addCreditSubPlan logic modification
find_add = """    const newPlan = {
      id: `csp_${Date.now()}`,
      name: newCspName,
      price: Number(newCspPrice),
      dummyPrice: newCspDummyPrice ? Number(newCspDummyPrice) : undefined,
      dailyCredits: Number(newCspDailyCredits),
      durationDays: Number(newCspDurationDays),
      badge: newCspBadge || undefined,
      description: `Roz ${newCspDailyCredits} Credits milenge (Total ${Number(newCspDailyCredits) * Number(newCspDurationDays)} Credits)`,
      isActive: true,
    };
    const currentPlans = localSettings.creditSubscriptionPlans || DEFAULT_CREDIT_SUB_PLANS;
    setLocalSettings({ ...localSettings, creditSubscriptionPlans: [...currentPlans, newPlan] });
    setNewCspName(''); setNewCspPrice(''); setNewCspDummyPrice(''); setNewCspDailyCredits('');
    setNewCspDurationDays('30');
    setNewCspBadge('');"""

replace_add = """    const newPlan = {
      id: `csp_${Date.now()}`,
      name: newCspName,
      price: Number(newCspPrice),
      weeklyPrice: newCspWeeklyPrice ? Number(newCspWeeklyPrice) : undefined,
      dummyPrice: newCspDummyPrice ? Number(newCspDummyPrice) : undefined,
      dailyCredits: Number(newCspDailyCredits),
      durationDays: Number(newCspDurationDays),
      badge: newCspBadge || undefined,
      scoreMultiplier: newCspScoreMultiplier ? Number(newCspScoreMultiplier) : undefined,
      description: `Roz ${newCspDailyCredits} Credits milenge`,
      isActive: true,
    };
    const currentPlans = localSettings.creditSubscriptionPlans || DEFAULT_CREDIT_SUB_PLANS;
    setLocalSettings({ ...localSettings, creditSubscriptionPlans: [...currentPlans, newPlan] });
    setNewCspName(''); setNewCspPrice(''); setNewCspWeeklyPrice(''); setNewCspDummyPrice(''); setNewCspDailyCredits('');
    setNewCspDurationDays('30');
    setNewCspBadge(''); setNewCspScoreMultiplier('');"""
content = content.replace(find_add, replace_add)

with open('artifacts/iic-study-app-replit/src/components/AdminDashboard.tsx', 'w') as f:
    f.write(content)

print("Updated add logic")
