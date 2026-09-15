import re

with open('artifacts/iic-study-app-replit/src/components/AdminDashboard.tsx', 'r') as f:
    content = f.read()

# Add states
find_state_diamond = "const [newCodeDiamondSubPlan, setNewCodeDiamondSubPlan] = useState<string>('7_DAYS_PASS');"
replace_state_diamond = """const [newCodeDiamondSubPlan, setNewCodeDiamondSubPlan] = useState<string>('starter_diamond');
  const [newCodeDiamondSubDays, setNewCodeDiamondSubDays] = useState<number>(30);
  const [newCodeDiamondSubDaily, setNewCodeDiamondSubDaily] = useState<number>(10);
  const [newCodeDiamondSubName, setNewCodeDiamondSubName] = useState<string>('Starter Diamond Pass');"""
content = content.replace(find_state_diamond, replace_state_diamond)

find_state_broadcast = "const [broadcastDiamondSubPlan, setBroadcastDiamondSubPlan] = useState<string>('7_DAYS_PASS');"
replace_state_broadcast = """const [broadcastDiamondSubPlan, setBroadcastDiamondSubPlan] = useState<string>('starter_diamond');
  const [broadcastDiamondSubDays, setBroadcastDiamondSubDays] = useState<number>(30);
  const [broadcastDiamondSubDaily, setBroadcastDiamondSubDaily] = useState<number>(10);
  const [broadcastDiamondSubName, setBroadcastDiamondSubName] = useState<string>('Starter Diamond Pass');"""
content = content.replace(find_state_broadcast, replace_state_broadcast)

# Fix Redemptions
find_redeem_new = """                  ...(newCodeType === 'DIAMOND_SUBSCRIPTION' ? { diamondSubPlanId: newCodeDiamondSubPlan || '7_DAYS_PASS' } : {}),"""
replace_redeem_new = """                  ...(newCodeType === 'DIAMOND_SUBSCRIPTION' ? { 
                      diamondSubPlanId: newCodeDiamondSubPlan || 'starter_diamond',
                      diamondSubPlanName: newCodeDiamondSubName,
                      diamondSubDailyAmount: newCodeDiamondSubDaily,
                      diamondSubDurationDays: newCodeDiamondSubDays,
                  } : {}),"""
content = content.replace(find_redeem_new, replace_redeem_new)

find_redeem_bc = """              diamondSubPlanId: broadcastType === 'DIAMOND_SUBSCRIPTION' ? broadcastDiamondSubPlan : undefined,"""
replace_redeem_bc = """              diamondSubPlanId: broadcastType === 'DIAMOND_SUBSCRIPTION' ? broadcastDiamondSubPlan : undefined,
              diamondSubPlanName: broadcastType === 'DIAMOND_SUBSCRIPTION' ? broadcastDiamondSubName : undefined,
              diamondSubDailyAmount: broadcastType === 'DIAMOND_SUBSCRIPTION' ? broadcastDiamondSubDaily : undefined,
              diamondSubDurationDays: broadcastType === 'DIAMOND_SUBSCRIPTION' ? broadcastDiamondSubDays : undefined,"""
content = content.replace(find_redeem_bc, replace_redeem_bc)

with open('artifacts/iic-study-app-replit/src/components/AdminDashboard.tsx', 'w') as f:
    f.write(content)
print("Updated states")
