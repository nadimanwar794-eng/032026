import re

with open('artifacts/iic-study-app-replit/src/components/Store.tsx', 'r') as f:
    content = f.read()

# Replace visitDiscount logic
content = re.sub(
    r"const \[visitCount, setVisitCount\] = useState<number>\(0\);\n.*?}, \[user\.id, visitDiscountEnabled\]\);",
    "// Store visit discount removed",
    content,
    flags=re.DOTALL
)

content = re.sub(
    r"\(visitDiscount > 0 \? visitDiscount : 0\);",
    "0;",
    content
)

with open('artifacts/iic-study-app-replit/src/components/Store.tsx', 'w') as f:
    f.write(content)
print("Removed from Store.tsx")
