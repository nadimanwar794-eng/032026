import re

with open('artifacts/iic-study-app-replit/src/components/RedeemSection.tsx', 'r') as f:
    content = f.read()

find_redeem = """        } else if (targetCode.type === 'DIAMOND_SUBSCRIPTION') {
            // Handle Diamond Subscription Pass Redeem Code
            const planId = targetCode.diamondSubPlanId || '7_DAYS_PASS';
            updatedUser = activateDiamondSub(updatedUser, planId);
            const planName = planId === '30_DAYS_PASS' ? 'Monthly Diamond Pass (25💎/day)' : '7-Day Diamond Pass (10💎/day)';
            successMessage = `💎 Mubarak ho! ${planName} Activate ho gaya! Store se roz apne diamonds claim karein!`;
        }"""

replace_redeem = """        } else if (targetCode.type === 'DIAMOND_SUBSCRIPTION') {
            // Handle Diamond Subscription Pass Redeem Code
            const planId = targetCode.diamondSubPlanId || 'starter_diamond';
            updatedUser = activateDiamondSub(updatedUser, planId, targetCode.diamondSubDurationDays, targetCode.diamondSubPlanName);
            const planName = targetCode.diamondSubPlanName || 'Diamond Pass';
            successMessage = `💎 Mubarak ho! ${planName} Activate ho gaya! Store se roz apne diamonds claim karein!`;
        }"""

content = content.replace(find_redeem, replace_redeem)

with open('artifacts/iic-study-app-replit/src/components/RedeemSection.tsx', 'w') as f:
    f.write(content)
print("Updated RedeemSection")
