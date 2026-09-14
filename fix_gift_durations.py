import re

with open('artifacts/iic-study-app-replit/src/components/AdminDashboard.tsx', 'r') as f:
    content = f.read()

find_array = """                                      {[
                                          { label: '7D', days: 7 },
                                          { label: '1M', days: 30 },
                                          { label: '3M', days: 90 },
                                          { label: '6M', days: 180 },
                                          { label: '1Y', days: 365 }
                                      ].map(opt => ("""

replace_array = """                                      {(localSettings.diamondDurations || [
                                          { label: '7D', days: 7 },
                                          { label: '1M', days: 30 },
                                          { label: '3M', days: 90 },
                                          { label: '6M', days: 180 },
                                          { label: '1Y', days: 365 }
                                      ]).map(opt => ("""

content = content.replace(find_array, replace_array)

with open('artifacts/iic-study-app-replit/src/components/AdminDashboard.tsx', 'w') as f:
    f.write(content)

print("Updated durations mapping for all")
