with open('artifacts/iic-study-app-replit/src/components/Store.tsx', 'r') as f:
    lines = f.readlines()

new_lines = []
skip = False
for line in lines:
    if "useEffect(() => {" in line and "free_plan_ad_seen_" in "".join(lines):
        # We need a safer way. I'll just use simple state removal
        pass
