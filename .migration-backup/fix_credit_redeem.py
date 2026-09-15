import re

with open('artifacts/iic-study-app-replit/src/components/RedeemSection.tsx', 'r') as f:
    content = f.read()

find_else = """        } else {
            // Handle Credits (Default)
            const amount = targetCode.amount || 0;"""

replace_else = """        } else if (targetCode.type === 'CREDIT_SUBSCRIPTION') {
            const planId = targetCode.creditPlanId || 'csp_100';
            const daily = targetCode.creditDailyAmount || 100;
            const days = targetCode.creditDurationDays || 30;
            const pName = targetCode.creditPlanName || 'Credit Pass';
            
            updatedUser.creditSubscription = {
                planId: planId,
                planName: pName,
                dailyCredits: daily,
                totalDays: days,
                startDate: new Date().toISOString(),
                endDate: new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString(),
                totalClaimedDays: 0,
                totalCreditsClaimed: 0,
                status: 'ACTIVE',
            };
            successMessage = `⚡ Mubarak ho! ${pName} Activate ho gaya! Roz +${daily} Credits claim karein ${days} din tak.`;
        } else {
            // Handle Credits (Default)
            const amount = targetCode.amount || 0;"""

content = content.replace(find_else, replace_else)

with open('artifacts/iic-study-app-replit/src/components/RedeemSection.tsx', 'w') as f:
    f.write(content)
print("Updated Redeem for Credit Sub")
