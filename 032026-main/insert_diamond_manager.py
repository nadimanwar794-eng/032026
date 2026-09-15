import re

with open('artifacts/iic-study-app-replit/src/components/AdminDashboard.tsx', 'r') as f:
    content = f.read()

find_inject = """                                      </button>
                                  </div>
                              </div>
                          </div>
                       </>
                  )}
                  {activeTab === 'CONFIG_ADS' && ("""

replace_inject = """                                      </button>
                                  </div>
                              </div>
                          </div>

                          <div className="bg-slate-900/50 rounded-2xl p-5 border border-sky-500/20 shadow-lg mt-6">
                              <div className="mb-4">
                                  <h3 className="font-black text-base text-sky-400 flex items-center gap-2">
                                      <span className="text-xl">💎</span>
                                      Diamond Pass Categories (Features & Drop)
                                  </h3>
                                  <p className="text-xs text-slate-400 mt-0.5">
                                      Yeh passes users ko roz diamonds claim karne ki power dete hain. Categories manage karein:
                                  </p>
                              </div>

                              <div className="space-y-2 mb-6">
                                  {(localSettings.diamondTemplates || [
                                      { id: 'starter_diamond', name: 'Starter Diamond Pass', icon: '💎', dailyDiamonds: 10, features: ['Daily 10 💎 Drop Claim', 'Chapters Permanently Unlock'] },
                                      { id: 'active_diamond', name: 'Active Diamond Pass', icon: '⚡', dailyDiamonds: 20, features: ['Daily 20 💎 Drop Claim', 'Tez Chapters Unlocking'] },
                                      { id: 'premium_diamond', name: 'Premium Diamond Pass', icon: '🌟', dailyDiamonds: 30, features: ['Daily 30 💎 Drop Claim', 'Premium Content Unlocks'] },
                                      { id: 'elite_diamond', name: 'Elite Diamond Pass', icon: '👑', dailyDiamonds: 50, features: ['Daily 50 💎 Huge Drop', 'Sabse Tez Unlock Speed'] }
                                  ]).map(t => (
                                      <div key={t.id} className="flex flex-col sm:flex-row gap-2 items-start sm:items-center p-3 bg-slate-800/60 border border-slate-700 rounded-xl">
                                          <div className="flex-1 flex gap-2 w-full">
                                              <input
                                                  type="text"
                                                  value={t.icon}
                                                  onChange={(e) => updateDiamondTemplate(t.id, 'icon', e.target.value)}
                                                  className="w-10 p-1.5 bg-slate-900 border border-slate-700 rounded text-sm text-center text-white"
                                              />
                                              <input
                                                  type="text"
                                                  value={t.name}
                                                  onChange={(e) => updateDiamondTemplate(t.id, 'name', e.target.value)}
                                                  className="flex-1 p-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-white"
                                              />
                                              <div className="flex items-center gap-1">
                                                  <input
                                                      type="number"
                                                      value={t.dailyDiamonds}
                                                      onChange={(e) => updateDiamondTemplate(t.id, 'dailyDiamonds', e.target.value)}
                                                      className="w-16 p-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-center text-white"
                                                  />
                                                  <span className="text-[10px] text-slate-400">💎/d</span>
                                              </div>
                                          </div>
                                          <div className="w-full sm:w-2/3 flex gap-2">
                                              <input
                                                  type="text"
                                                  value={t.features.join(', ')}
                                                  onChange={(e) => updateDiamondTemplate(t.id, 'features', e.target.value)}
                                                  placeholder="Comma separated features..."
                                                  className="flex-1 p-1.5 bg-slate-900 border border-slate-700 rounded text-[10px] text-white"
                                              />
                                              <button onClick={() => removeDiamondTemplate(t.id)} className="p-1.5 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30">
                                                  <Trash2 size={14} />
                                              </button>
                                          </div>
                                      </div>
                                  ))}
                              </div>

                              <div className="bg-slate-800/90 p-4 rounded-xl border border-dashed border-sky-500/40 space-y-3 mb-8">
                                  <p className="text-xs font-bold text-sky-300 flex items-center gap-1.5">
                                      <Plus size={14} /> New Diamond Pass Category:
                                  </p>
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                      <input type="text" placeholder="Name (e.g. Starter Pass)" value={newDiamondTemplateName} onChange={e => setNewDiamondTemplateName(e.target.value)} className="p-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white" />
                                      <input type="text" placeholder="Icon (💎)" value={newDiamondTemplateIcon} onChange={e => setNewDiamondTemplateIcon(e.target.value)} className="p-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white" />
                                      <input type="number" placeholder="Daily Diamonds (e.g. 10)" value={newDiamondTemplateDaily} onChange={e => setNewDiamondTemplateDaily(e.target.value)} className="p-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white" />
                                      <input type="text" placeholder="Features (comma sep)" value={newDiamondTemplateFeatures} onChange={e => setNewDiamondTemplateFeatures(e.target.value)} className="p-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white" />
                                  </div>
                                  <button onClick={addDiamondTemplate} className="w-full py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-black rounded-lg text-xs flex items-center justify-center gap-1.5 transition">Add Category</button>
                              </div>

                              {/* Diamond Durations */}
                              <div className="mb-4">
                                  <h3 className="font-black text-sm text-sky-300">⏳ Diamond Pass Validities & Pricing</h3>
                                  <p className="text-[10px] text-slate-400">Har plan ka price total diamonds se banta hai. Yaha decide karein ki kitne days validity hone par 1 diamond ka kya Rate (₹) hoga. (Bada plan sasta hona chahiye)</p>
                              </div>

                              <div className="space-y-2 mb-4">
                                  {(localSettings.diamondDurations || [
                                      { id: '7_DAYS', label: '7D', days: 7, ratePerDiamond: 1.80 },
                                      { id: '30_DAYS', label: '1M', days: 30, ratePerDiamond: 1.50 },
                                      { id: '90_DAYS', label: '3M', days: 90, ratePerDiamond: 1.30 },
                                      { id: '180_DAYS', label: '6M', days: 180, ratePerDiamond: 1.15 },
                                      { id: '365_DAYS', label: '1Y', days: 365, ratePerDiamond: 1.00 }
                                  ]).map(d => (
                                      <div key={d.id} className="flex items-center gap-2 p-2 bg-slate-800/60 border border-slate-700 rounded-xl">
                                          <input type="text" value={d.label} onChange={e => updateDiamondDuration(d.id, 'label', e.target.value)} className="w-16 p-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-center text-white" />
                                          <div className="flex items-center gap-1">
                                              <input type="number" value={d.days} onChange={e => updateDiamondDuration(d.id, 'days', e.target.value)} className="w-16 p-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-center text-white" />
                                              <span className="text-[10px] text-slate-400">Days</span>
                                          </div>
                                          <div className="flex items-center gap-1 flex-1 justify-end">
                                              <span className="text-[10px] text-slate-400">Rate: ₹</span>
                                              <input type="number" step="0.01" value={d.ratePerDiamond} onChange={e => updateDiamondDuration(d.id, 'ratePerDiamond', e.target.value)} className="w-20 p-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-center text-white" />
                                              <span className="text-[10px] text-slate-400">/ 💎</span>
                                          </div>
                                          <button onClick={() => removeDiamondDuration(d.id)} className="p-1.5 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30">
                                              <Trash2 size={14} />
                                          </button>
                                      </div>
                                  ))}
                              </div>

                              <div className="bg-slate-800/90 p-3 rounded-xl border border-dashed border-sky-500/40 flex gap-2 items-center">
                                  <input type="text" placeholder="Label (e.g. 2Y)" value={newDiamondDurationLabel} onChange={e => setNewDiamondDurationLabel(e.target.value)} className="w-20 p-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white" />
                                  <input type="number" placeholder="Days (730)" value={newDiamondDurationDays} onChange={e => setNewDiamondDurationDays(e.target.value)} className="w-20 p-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white" />
                                  <input type="number" step="0.01" placeholder="Rate (0.80)" value={newDiamondDurationRate} onChange={e => setNewDiamondDurationRate(e.target.value)} className="w-24 p-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white" />
                                  <button onClick={addDiamondDuration} className="px-4 py-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold rounded-lg text-[10px] transition">Add Validity</button>
                              </div>
                          </div>
                       </>
                  )}
                  {activeTab === 'CONFIG_ADS' && ("""

content = content.replace(find_inject, replace_inject)

with open('artifacts/iic-study-app-replit/src/components/AdminDashboard.tsx', 'w') as f:
    f.write(content)

print("Injected Diamond Manager")
