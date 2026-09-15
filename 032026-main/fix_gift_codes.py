import re

with open('artifacts/iic-study-app-replit/src/components/AdminDashboard.tsx', 'r') as f:
    content = f.read()

# Replace Broadcast Diamond Sub UI
b_diamond_find = """                                  <option value="7_DAYS_PASS">7 Days Pass (+10 💎 / day = 70 total)</option>
                                  <option value="30_DAYS_PASS">Monthly Pass (+25 💎 / day = 750 total)</option>
                              </select>"""

b_diamond_replace = """                                  {DIAMOND_SUBSCRIPTION_PLANS.map(p => (
                                      <option key={p.id} value={p.id}>{p.name} (+{p.dailyDiamonds} 💎 / day = {p.totalDiamonds} total)</option>
                                  ))}
                              </select>"""

content = content.replace(b_diamond_find, b_diamond_replace)


# Replace Single Code Diamond Sub UI
s_diamond_find = """                                  <option value="7_DAYS_PASS">7 Days Pass (+10 💎 / day = 70 total)</option>
                                  <option value="30_DAYS_PASS">Monthly Pass (+25 💎 / day = 750 total)</option>
                              </select>"""

s_diamond_replace = """                                  {DIAMOND_SUBSCRIPTION_PLANS.map(p => (
                                      <option key={p.id} value={p.id}>{p.name} (+{p.dailyDiamonds} 💎 / day = {p.totalDiamonds} total)</option>
                                  ))}
                              </select>"""

content = content.replace(s_diamond_find, s_diamond_replace)

with open('artifacts/iic-study-app-replit/src/components/AdminDashboard.tsx', 'w') as f:
    f.write(content)

print("Done")
