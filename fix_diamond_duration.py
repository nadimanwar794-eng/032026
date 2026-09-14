import re

with open('artifacts/iic-study-app-replit/src/components/AdminDashboard.tsx', 'r') as f:
    content = f.read()

# First replace the invalid `{p.durationDays}d` with `d` to clean it up, or just leave it. The screenshot has `· d`. I'll replace it with a cleaner look or leave it.

# Now insert the validity block for diamond pass
old_diamond_btn_block = """                                      </div>
                                      <button
                                          type="button"
                                          onClick={async () => {"""

new_diamond_btn_block = """                                      </div>
                                      <div className="flex items-center gap-2">
                                          <span className="text-[10px] font-bold text-slate-500 uppercase w-16">Validity:</span>
                                          <div className="flex-1 grid grid-cols-5 gap-1">
                                              {[
                                                  { label: '1W', days: 7 },
                                                  { label: '1M', days: 30 },
                                                  { label: '3M', days: 90 },
                                                  { label: '6M', days: 180 },
                                                  { label: '1Y', days: 365 }
                                              ].map(opt => (
                                                  <button 
                                                      key={opt.days}
                                                      type="button"
                                                      onClick={() => setSelectedUserDiamondSubDuration(opt.days)}
                                                      className={`py-1.5 rounded font-bold text-[11px] border ${selectedUserDiamondSubDuration === opt.days ? 'bg-sky-800 border-sky-900 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                                                      {opt.label}
                                                  </button>
                                              ))}
                                          </div>
                                      </div>
                                      <button
                                          type="button"
                                          onClick={async () => {"""

content = content.replace(old_diamond_btn_block, new_diamond_btn_block)

# And pass the duration to activateDiamondSub
# find: const updated = activateDiamondSub(editingUser, plan.id);
# replace: const durDays = selectedUserDiamondSubDuration || 30;
#          const updated = activateDiamondSub(editingUser, plan.id, durDays);
content = content.replace(
    "const updated = activateDiamondSub(editingUser, plan.id);",
    "const durDays = selectedUserDiamondSubDuration || 30;\n                                              const updated = activateDiamondSub(editingUser, plan.id, durDays);"
)

with open('artifacts/iic-study-app-replit/src/components/AdminDashboard.tsx', 'w') as f:
    f.write(content)

print("Diamond duration fixed")
