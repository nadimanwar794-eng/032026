import re

with open('artifacts/iic-study-app-replit/src/components/AdminDashboard.tsx', 'r') as f:
    content = f.read()

find_ui = """                                      <div>
                                          <label className="text-[10px] font-bold uppercase text-slate-400">Price (₹)</label>
                                          <input
                                              type="number"
                                              placeholder="100"
                                              value={newCspPrice}
                                              onChange={e => setNewCspPrice(e.target.value)}
                                              className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                                          />
                                      </div>
                                      <div>
                                          <label className="text-[10px] font-bold uppercase text-slate-400">Dummy Cut ₹</label>
                                          <input
                                              type="number"
                                              placeholder="199"
                                              value={newCspDummyPrice}
                                              onChange={e => setNewCspDummyPrice(e.target.value)}
                                              className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                                          />
                                      </div>
                                      <div>
                                          <label className="text-[10px] font-bold uppercase text-slate-400">Daily CR</label>
                                          <input
                                              type="number"
                                              placeholder="50"
                                              value={newCspDailyCredits}
                                              onChange={e => setNewCspDailyCredits(e.target.value)}
                                              className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                                          />
                                      </div>
                                      <div>
                                          <label className="text-[10px] font-bold uppercase text-slate-400">Days (30/90/365)</label>
                                          <input
                                              type="number"
                                              placeholder="30"
                                              value={newCspDurationDays}
                                              onChange={e => setNewCspDurationDays(e.target.value)}
                                              className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                                          />
                                      </div>
                                      <div>
                                          <label className="text-[10px] font-bold uppercase text-slate-400">Badge/Tag</label>
                                          <input
                                              type="text"
                                              placeholder="POPULAR"
                                              value={newCspBadge}
                                              onChange={e => setNewCspBadge(e.target.value)}
                                              className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                                          />
                                      </div>"""

replace_ui = """                                      <div>
                                          <label className="text-[10px] font-bold uppercase text-slate-400">Monthly ₹</label>
                                          <input
                                              type="number"
                                              placeholder="150"
                                              value={newCspPrice}
                                              onChange={e => setNewCspPrice(e.target.value)}
                                              className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                                          />
                                      </div>
                                      <div>
                                          <label className="text-[10px] font-bold uppercase text-slate-400">Weekly ₹</label>
                                          <input
                                              type="number"
                                              placeholder="40"
                                              value={newCspWeeklyPrice}
                                              onChange={e => setNewCspWeeklyPrice(e.target.value)}
                                              className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                                          />
                                      </div>
                                      <div>
                                          <label className="text-[10px] font-bold uppercase text-slate-400">Daily CR</label>
                                          <input
                                              type="number"
                                              placeholder="50"
                                              value={newCspDailyCredits}
                                              onChange={e => setNewCspDailyCredits(e.target.value)}
                                              className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                                          />
                                      </div>
                                      <div>
                                          <label className="text-[10px] font-bold uppercase text-slate-400">XP Boost</label>
                                          <input
                                              type="number"
                                              step="0.1"
                                              placeholder="1.1"
                                              value={newCspScoreMultiplier}
                                              onChange={e => setNewCspScoreMultiplier(e.target.value)}
                                              className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                                          />
                                      </div>
                                      <div>
                                          <label className="text-[10px] font-bold uppercase text-slate-400">Badge</label>
                                          <input
                                              type="text"
                                              placeholder="STARTER"
                                              value={newCspBadge}
                                              onChange={e => setNewCspBadge(e.target.value)}
                                              className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                                          />
                                      </div>"""

content = content.replace(find_ui, replace_ui)

# Update the list mapping for credit plans
find_list = """                                                          <input
                                                              type="number"
                                                              value={plan.dailyCredits}
                                                              onChange={(e) => updateCreditSubPlan(plan.id, 'dailyCredits', e.target.value)}
                                                              className="w-16 p-1 bg-slate-900 border border-slate-700 rounded text-[10px] text-white text-center"
                                                          />
                                                          <span className="text-[10px] text-slate-400">CR/d</span>
                                                      </div>
                                                      <div className="flex items-center gap-1">
                                                          <input
                                                              type="number"
                                                              value={plan.durationDays}
                                                              onChange={(e) => updateCreditSubPlan(plan.id, 'durationDays', e.target.value)}
                                                              className="w-14 p-1 bg-slate-900 border border-slate-700 rounded text-[10px] text-white text-center"
                                                          />
                                                          <span className="text-[10px] text-slate-400">Days</span>
                                                      </div>
                                                      <div className="flex items-center gap-1">
                                                          <span className="text-[10px] text-slate-400">₹</span>
                                                          <input
                                                              type="number"
                                                              value={plan.price}
                                                              onChange={(e) => updateCreditSubPlan(plan.id, 'price', e.target.value)}
                                                              className="w-16 p-1 bg-slate-900 border border-slate-700 rounded text-[10px] text-white text-center"
                                                          />
                                                      </div>
                                                      <button onClick={() => removeCreditSubPlan(plan.id)} className="p-1.5 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30">
                                                          <Trash2 size={12} />
                                                      </button>"""

replace_list = """                                                          <input
                                                              type="number"
                                                              value={plan.dailyCredits}
                                                              onChange={(e) => updateCreditSubPlan(plan.id, 'dailyCredits', e.target.value)}
                                                              className="w-14 p-1 bg-slate-900 border border-slate-700 rounded text-[10px] text-white text-center"
                                                          />
                                                          <span className="text-[10px] text-slate-400">CR/d</span>
                                                      </div>
                                                      <div className="flex items-center gap-1">
                                                          <span className="text-[10px] text-slate-400">XP:</span>
                                                          <input
                                                              type="number"
                                                              step="0.1"
                                                              value={plan.scoreMultiplier || 1}
                                                              onChange={(e) => updateCreditSubPlan(plan.id, 'scoreMultiplier', e.target.value)}
                                                              className="w-12 p-1 bg-slate-900 border border-slate-700 rounded text-[10px] text-white text-center"
                                                          />
                                                      </div>
                                                      <div className="flex items-center gap-1">
                                                          <span className="text-[10px] text-slate-400">1M₹</span>
                                                          <input
                                                              type="number"
                                                              value={plan.price}
                                                              onChange={(e) => updateCreditSubPlan(plan.id, 'price', e.target.value)}
                                                              className="w-14 p-1 bg-slate-900 border border-slate-700 rounded text-[10px] text-white text-center"
                                                          />
                                                      </div>
                                                      <div className="flex items-center gap-1">
                                                          <span className="text-[10px] text-slate-400">1W₹</span>
                                                          <input
                                                              type="number"
                                                              value={plan.weeklyPrice || ''}
                                                              onChange={(e) => updateCreditSubPlan(plan.id, 'weeklyPrice', e.target.value)}
                                                              className="w-14 p-1 bg-slate-900 border border-slate-700 rounded text-[10px] text-white text-center"
                                                          />
                                                      </div>
                                                      <button onClick={() => removeCreditSubPlan(plan.id)} className="p-1.5 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30">
                                                          <Trash2 size={12} />
                                                      </button>"""

content = content.replace(find_list, replace_list)

with open('artifacts/iic-study-app-replit/src/components/AdminDashboard.tsx', 'w') as f:
    f.write(content)

print("Updated Admin UI for Credit Sub")
