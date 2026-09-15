import re

with open('artifacts/iic-study-app-replit/src/components/Store.tsx', 'r') as f:
    lines = f.readlines()

new_lines = []
skip = False

for i, line in enumerate(lines):
    # Remove the side-by-side modal
    if "── SIDE-BY-SIDE MODAL: ALL 14-15 FEATURES COMPARE ──" in line:
        skip = True
        
    if skip and "{/* ── SUPPORT / WHATSAPP CHECKOUT MODAL ── */}" in line:
        skip = False
        
    # Remove the Free vs VIP tab button
    if "{/* 1. FREE VS VIP BUTTON (START MEIN) */}" in line:
        skip = True
        
    if skip and "{/* 2. MAIN TABS" in line:
        skip = False
        
    if not skip:
        new_lines.append(line)

with open('artifacts/iic-study-app-replit/src/components/Store.tsx', 'w') as f:
    f.writelines(new_lines)
    
print("Removed Free vs VIP modal and button")
