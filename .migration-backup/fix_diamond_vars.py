import re

with open('artifacts/iic-study-app-replit/src/components/Store.tsx', 'r') as f:
    content = f.read()

find_str = """  const [showFreeAdModal, setShowFreeAdModal] = useState(false);"""

replace_str = """  const [showFreeAdModal, setShowFreeAdModal] = useState(false);

  const DIAMOND_SUB_DURATIONS_LIST = settings?.diamondDurations && settings.diamondDurations.length > 0 
    ? settings.diamondDurations 
    : DEFAULT_DIAMOND_SUB_DURATIONS_LIST;

  const diamondUnifiedTemplates = settings?.diamondTemplates && settings.diamondTemplates.length > 0 
    ? settings.diamondTemplates 
    : DEFAULT_diamondUnifiedTemplates;
"""

content = content.replace(find_str, replace_str)

with open('artifacts/iic-study-app-replit/src/components/Store.tsx', 'w') as f:
    f.write(content)

print("Injected diamond variables")
