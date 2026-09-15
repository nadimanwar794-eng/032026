import re

with open('artifacts/iic-study-app-replit/src/utils/creditSystem.ts', 'r') as f:
    content = f.read()

find_str = """export const getCreditCost = (
  key: string,
  fallback: number,
  userTier?: string,
  directSettings?: any
): number => {
  try {
    let s = directSettings;
    if (!s && typeof window !== 'undefined') {
      const raw = localStorage.getItem('nst_system_settings');
      if (raw) s = JSON.parse(raw);
    }
    if (s) {
      const rawTier = (userTier || 'FREE').toUpperCase();
      const normTier = rawTier === 'ULTRA' ? 'ultra' : rawTier === 'BASIC' ? 'basic' : 'free';

      // 1. Check Tiered Credit Costs table
      if (s.tieredCreditCosts && s.tieredCreditCosts[key]) {
        const tierVal = s.tieredCreditCosts[key][normTier];
        if (typeof tierVal === 'number' && !isNaN(tierVal)) return Math.max(0, tierVal);
      }

      // 2. Check Custom Economy Items
      if (Array.isArray(s.customEconomyItems)) {
        const item = s.customEconomyItems.find((i: any) => i.id === key);
        if (item) {
          const costProp = `${normTier}Cost`;
          if (typeof item[costProp] === 'number' && !isNaN(item[costProp])) return Math.max(0, item[costProp]);
        }
      }

      // 3. Check Granular Feature Costs array
      if (Array.isArray(s.featureCosts)) {
        const fc = s.featureCosts.find((f: any) => f.featureId === key);
        if (fc) {
          const costProp = `${normTier}Cost`;
          if (typeof fc[costProp] === 'number' && !isNaN(fc[costProp])) return Math.max(0, fc[costProp]);
        }
      }

      // 4. Check direct key on settings
      if (typeof s[key] === 'number' && !isNaN(s[key])) return Math.max(0, s[key]);
    }
  } catch {}
  return fallback;
};"""

replace_str = """export const getCreditCost = (
  key: string,
  fallback: number,
  userTier?: string,
  directSettings?: any
): number => {
  try {
    let s = directSettings;
    if (!s && typeof window !== 'undefined') {
      const raw = localStorage.getItem('nst_system_settings');
      if (raw) s = JSON.parse(raw);
    }
    
    let baseCost = fallback;
    const rawTier = (userTier || 'FREE').toUpperCase();
    const normTier = rawTier === 'ULTRA' ? 'ultra' : rawTier === 'BASIC' ? 'basic' : 'free';

    if (s) {
      // 1. Check Tiered Credit Costs table
      if (s.tieredCreditCosts && s.tieredCreditCosts[key]) {
        const tierVal = s.tieredCreditCosts[key][normTier];
        if (typeof tierVal === 'number' && !isNaN(tierVal)) return Math.max(0, tierVal);
      }

      // 2. Check Custom Economy Items
      if (Array.isArray(s.customEconomyItems)) {
        const item = s.customEconomyItems.find((i: any) => i.id === key);
        if (item) {
          const costProp = `${normTier}Cost`;
          if (typeof item[costProp] === 'number' && !isNaN(item[costProp])) return Math.max(0, item[costProp]);
        }
      }

      // 3. Check Granular Feature Costs array
      if (Array.isArray(s.featureCosts)) {
        const fc = s.featureCosts.find((f: any) => f.featureId === key);
        if (fc) {
          const costProp = `${normTier}Cost`;
          if (typeof fc[costProp] === 'number' && !isNaN(fc[costProp])) return Math.max(0, fc[costProp]);
        }
      }

      // 4. Check direct key on settings
      if (typeof s[key] === 'number' && !isNaN(s[key])) {
          baseCost = Math.max(0, s[key]);
      }
    }
    
    // Apply VIP "Credit Off Anywhere" discount (10% for Basic, 20% for Ultra)
    // Only applied if we didn't use a specific Tiered override above!
    if (baseCost > 0) {
      if (normTier === 'ultra') return Math.ceil(baseCost * 0.80);
      if (normTier === 'basic') return Math.ceil(baseCost * 0.90);
    }
    
    return baseCost;

  } catch {}
  
  return fallback;
};"""

content = content.replace(find_str, replace_str)

with open('artifacts/iic-study-app-replit/src/utils/creditSystem.ts', 'w') as f:
    f.write(content)
    
print("Updated getCreditCost")
