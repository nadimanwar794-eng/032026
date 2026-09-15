import re

with open('artifacts/iic-study-app-replit/src/components/Store.tsx', 'r') as f:
    content = f.read()

find_logic = """          const calculateCustomCreditPrice = (plan: any, durOpt: any, durDisc: number) => {
            let basePrice = 0;
            const pId = (plan.id || '').toLowerCase();
            const pName = (plan.name || '').toLowerCase();
            if (durOpt.id === '7_DAYS') {
              if (plan.weeklyPrice) {
                basePrice = plan.weeklyPrice;
              } else if (pId.includes('starter') || pName.includes('starter')) {
                basePrice = 40;
              } else if (pId.includes('smart') || pName.includes('smart')) {
                basePrice = 70;
              } else if (pId.includes('super') || pName.includes('super')) {
                basePrice = 100;
              } else if (pId.includes('mega') || pName.includes('mega')) {
                basePrice = 150;
              } else {
                basePrice = Math.round((plan.price || 150) * 0.28);
              }
            } else {"""

replace_logic = """          const calculateCustomCreditPrice = (plan: any, durOpt: any, durDisc: number) => {
            let basePrice = 0;
            const pId = (plan.id || '').toLowerCase();
            const pName = (plan.name || '').toLowerCase();
            if (durOpt.id === '7_DAYS') {
              if (plan.weeklyPrice) {
                basePrice = Number(plan.weeklyPrice);
              } else if (pId.includes('starter') || pName.includes('starter')) {
                basePrice = 40;
              } else if (pId.includes('smart') || pName.includes('smart')) {
                basePrice = 70;
              } else if (pId.includes('super') || pName.includes('super')) {
                basePrice = 100;
              } else if (pId.includes('mega') || pName.includes('mega')) {
                basePrice = 150;
              } else {
                basePrice = Math.round((plan.price || 150) * 0.28);
              }
            } else {"""

content = content.replace(find_logic, replace_logic)

with open('artifacts/iic-study-app-replit/src/components/Store.tsx', 'w') as f:
    f.write(content)

print("Fixed calculateCustomCreditPrice")
