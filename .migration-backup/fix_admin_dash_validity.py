import re

with open('artifacts/iic-study-app-replit/src/components/AdminDashboard.tsx', 'r') as f:
    content = f.read()

# 1. Add selectedUserDiamondSubDuration
content = content.replace(
    "const [selectedUserCreditSubDuration, setSelectedUserCreditSubDuration] = useState<number>(30);",
    "const [selectedUserCreditSubDuration, setSelectedUserCreditSubDuration] = useState<number>(30);\n  const [selectedUserDiamondSubDuration, setSelectedUserDiamondSubDuration] = useState<number>(30);"
)

# 2. Update the Credit Pass validity selector to include 1W
credit_validity_old = """                                              {[
                                                  { label: '1M', days: 30 },
                                                  { label: '3M', days: 90 },
                                                  { label: '6M', days: 180 },
                                                  { label: '1Y', days: 365 }
                                              ]"""
credit_validity_new = """                                              {[
                                                  { label: '1W', days: 7 },
                                                  { label: '1M', days: 30 },
                                                  { label: '3M', days: 90 },
                                                  { label: '6M', days: 180 },
                                                  { label: '1Y', days: 365 }
                                              ]"""
content = content.replace(credit_validity_old, credit_validity_new)

with open('artifacts/iic-study-app-replit/src/components/AdminDashboard.tsx', 'w') as f:
    f.write(content)
print("Step 1 done")
