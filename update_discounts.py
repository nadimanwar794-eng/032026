import re

files_to_update = {
    'artifacts/iic-study-app-replit/src/components/AdminDashboard.tsx': [
        (r"'Credit Off Anywhere: 20%'", r"'Credit Off Anywhere: 10%'"),
        (r"'Credit Off Anywhere: 40%'", r"'Credit Off Anywhere: 20%'")
    ],
    'artifacts/iic-study-app-replit/src/components/Store.tsx': [
        (r"'Credit Off Anywhere: 20%'", r"'Credit Off Anywhere: 10%'"),
        (r"'Credit Off Anywhere: 40%'", r"'Credit Off Anywhere: 20%'"),
        (r"Flat 20% OFF Everywhere", r"Flat 10% OFF Everywhere"),
        (r"Maximum 40% OFF Everywhere", r"Maximum 20% OFF Everywhere")
    ]
}

for filepath, replacements in files_to_update.items():
    with open(filepath, 'r') as f:
        content = f.read()
    
    for old_str, new_str in replacements:
        content = re.sub(old_str, new_str, content)
        
    with open(filepath, 'w') as f:
        f.write(content)
        
print("Updated discounts in Store.tsx and AdminDashboard.tsx")
