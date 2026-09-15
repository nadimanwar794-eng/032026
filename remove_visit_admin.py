with open('artifacts/iic-study-app-replit/src/components/AdminDashboard.tsx', 'r') as f:
    lines = f.readlines()

new_lines = []
skip = False

for i, line in enumerate(lines):
    if "{/* Store Visit Discount Setting */}" in line:
        skip = True
        
    if skip and "{/* MCQ Reward Rules */}" in line:
        skip = False
        
    if not skip:
        new_lines.append(line)

with open('artifacts/iic-study-app-replit/src/components/AdminDashboard.tsx', 'w') as f:
    f.writelines(new_lines)
    
print("Removed from AdminDashboard")
