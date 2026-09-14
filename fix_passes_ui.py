import re

with open('artifacts/iic-study-app-replit/src/components/AdminDashboard.tsx', 'r') as f:
    content = f.read()

find_str = """              {/* STORE FEATURE LIST (Moved from General Settings) */}"""

replace_str = """              {/* CREDIT PASSES */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mt-4">
                  <div className="flex items-center justify-between mb-4">
                      <h4 className="font-bold text-slate-800 flex items-center gap-2">⚡ Daily Credit Passes</h4>
                      <button
                          onClick={() => {
                              const newPlan = {
                                  id: `credit-pass-${Date.now()}`,
                                  name: 'New Credit Pass',
                                  dailyCredits: 100,
                                  scoreMultiplier: 1.1,
                                  price: 299,
                                  weeklyPrice: 99,
                                  isActive: true,
                                  popular: false
                              };
                              const current = localSettings.creditSubscriptionPlans || DEFAULT_CREDIT_SUB_PLANS;
                              setLocalSettings({...localSettings, creditSubscriptionPlans: [...current, newPlan]});
                          }}
                          className="bg-slate-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-700 transition-colors flex items-center gap-1"
                      >
                          <Plus size={14} /> Add Credit Pass
                      </button>
                  </div>
                  <div className="space-y-4">
                      {(localSettings.creditSubscriptionPlans || DEFAULT_CREDIT_SUB_PLANS).map((plan, idx) => {
                          const updatePlan = (field: string, value: any) => {
                              const current = localSettings.creditSubscriptionPlans || DEFAULT_CREDIT_SUB_PLANS;
                              const newPlans = [...current];
                              newPlans[idx] = { ...newPlans[idx], [field]: value };
                              setLocalSettings({...localSettings, creditSubscriptionPlans: newPlans});
                          };
                          return (
                              <div key={plan.id} className="bg-white p-3 rounded-lg border border-slate-200 relative grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 items-end">
                                  <button onClick={() => {
                                      if(!confirm('Delete this pass?')) return;
                                      const current = localSettings.creditSubscriptionPlans || DEFAULT_CREDIT_SUB_PLANS;
                                      const newPlans = current.filter(p => p.id !== plan.id);
                                      setLocalSettings({...localSettings, creditSubscriptionPlans: newPlans});
                                  }} className="absolute -top-2 -right-2 bg-red-100 text-red-600 p-1 rounded-full hover:bg-red-200"><X size={14}/></button>

                                  <div>
                                      <label className="text-[10px] text-slate-500 font-bold">Pass Name</label>
                                      <input type="text" value={plan.name} onChange={e => updatePlan('name', e.target.value)} className="w-full p-2 border rounded-lg text-xs font-bold" />
                                  </div>
                                  <div>
                                      <label className="text-[10px] text-slate-500 font-bold">Daily Credits 🪙</label>
                                      <input type="number" value={plan.dailyCredits || 0} onChange={e => updatePlan('dailyCredits', Number(e.target.value))} className="w-full p-2 border rounded-lg text-xs" />
                                  </div>
                                  <div>
                                      <label className="text-[10px] text-slate-500 font-bold">XP Boost (e.g. 1.2 = +20%)</label>
                                      <input type="number" step="0.1" value={plan.scoreMultiplier || 1.0} onChange={e => updatePlan('scoreMultiplier', Number(e.target.value))} className="w-full p-2 border rounded-lg text-xs" />
                                  </div>
                                  <div>
                                      <label className="text-[10px] text-slate-500 font-bold">Monthly Price (₹)</label>
                                      <input type="number" value={plan.price} onChange={e => updatePlan('price', Number(e.target.value))} className="w-full p-2 border rounded-lg text-xs font-bold text-green-600" />
                                  </div>
                                  <div>
                                      <label className="text-[10px] text-slate-500 font-bold">Weekly Price (₹)</label>
                                      <input type="number" value={plan.weeklyPrice || 0} onChange={e => updatePlan('weeklyPrice', Number(e.target.value))} className="w-full p-2 border rounded-lg text-xs font-bold text-blue-600" />
                                  </div>
                                  <div className="flex items-center gap-2 pb-2">
                                      <input type="checkbox" checked={plan.isActive !== false} onChange={e => updatePlan('isActive', e.target.checked)} className="w-4 h-4 accent-green-600"/>
                                      <label className="text-xs font-bold text-slate-700">Active</label>
                                  </div>
                              </div>
                          );
                      })}
                  </div>
              </div>

              {/* DIAMOND PASSES */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mt-4">
                  <div className="flex items-center justify-between mb-4">
                      <h4 className="font-bold text-slate-800 flex items-center gap-2">💎 Diamond Passes</h4>
                  </div>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Diamond Tiers */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <h5 className="font-bold text-sm text-slate-700">Tiers & Daily Drops</h5>
                            <button onClick={() => {
                                const newT = { id: `dia-${Date.now()}`, name: 'New Diamond', icon: '💎', dailyDiamonds: 10, features: [] };
                                const current = localSettings.diamondTemplates || [];
                                setLocalSettings({...localSettings, diamondTemplates: [...current, newT]});
                            }} className="text-xs bg-slate-200 hover:bg-slate-300 px-2 py-1 rounded font-bold text-slate-700">+ Add Tier</button>
                        </div>
                        <div className="space-y-3">
                            {(localSettings.diamondTemplates || [
                                { id: 'starter_diamond', name: 'Starter Diamond Pass', icon: '💎', dailyDiamonds: 10, features: ['Daily 10 💎 Drop Claim'] },
                                { id: 'active_diamond', name: 'Active Diamond Pass', icon: '⚡', dailyDiamonds: 20, features: ['Daily 20 💎 Drop Claim'] },
                                { id: 'premium_diamond', name: 'Premium Diamond Pass', icon: '🌟', dailyDiamonds: 30, features: ['Daily 30 💎 Drop Claim'] },
                                { id: 'elite_diamond', name: 'Elite Diamond Pass', icon: '👑', dailyDiamonds: 50, features: ['Daily 50 💎 Huge Drop'] }
                            ]).map((template) => {
                                const updateT = (field: string, val: any) => {
                                    const current = localSettings.diamondTemplates || [];
                                    const newT = current.map(t => t.id === template.id ? {...t, [field]: val} : t);
                                    setLocalSettings({...localSettings, diamondTemplates: newT});
                                };
                                return (
                                    <div key={template.id} className="bg-white p-3 rounded-lg border border-slate-200 relative flex flex-col gap-2">
                                        <button onClick={() => {
                                            if(!confirm('Delete this tier?')) return;
                                            const current = localSettings.diamondTemplates || [];
                                            setLocalSettings({...localSettings, diamondTemplates: current.filter(t => t.id !== template.id)});
                                        }} className="absolute top-2 right-2 text-red-500 hover:bg-red-50 p-1 rounded"><X size={14}/></button>
                                        <div className="flex gap-2 items-center">
                                            <input type="text" value={template.icon} onChange={e => updateT('icon', e.target.value)} className="w-10 p-2 border rounded-lg text-center" />
                                            <input type="text" value={template.name} onChange={e => updateT('name', e.target.value)} className="flex-1 p-2 border rounded-lg text-xs font-bold" />
                                            <div className="flex items-center gap-1 bg-slate-50 border rounded-lg px-2">
                                                <input type="number" value={template.dailyDiamonds} onChange={e => updateT('dailyDiamonds', Number(e.target.value))} className="w-16 p-1 text-center font-black text-sky-600 bg-transparent outline-none" />
                                                <span className="text-xs font-bold text-slate-500">💎/d</span>
                                            </div>
                                        </div>
                                        <input type="text" value={(template.features||[]).join(', ')} onChange={e => updateT('features', e.target.value.split(',').map(s=>s.trim()).filter(Boolean))} placeholder="Features (comma separated)" className="w-full p-2 border rounded-lg text-xs text-slate-600" />
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Diamond Durations */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <h5 className="font-bold text-sm text-slate-700">Validities & Pricing Multipliers</h5>
                            <button onClick={() => {
                                const newD = { id: `dur-${Date.now()}`, label: 'New', days: 30, ratePerDiamond: 1.5 };
                                const current = localSettings.diamondDurations || [];
                                setLocalSettings({...localSettings, diamondDurations: [...current, newD]});
                            }} className="text-xs bg-slate-200 hover:bg-slate-300 px-2 py-1 rounded font-bold text-slate-700">+ Add Validity</button>
                        </div>
                        <div className="space-y-3">
                            {(localSettings.diamondDurations || [
                                { id: '7_DAYS', label: '7D', days: 7, ratePerDiamond: 2.00 },
                                { id: '30_DAYS', label: '1M', days: 30, ratePerDiamond: 1.50 },
                                { id: '90_DAYS', label: '3M', days: 90, ratePerDiamond: 1.30 },
                                { id: '180_DAYS', label: '6M', days: 180, ratePerDiamond: 1.15 },
                                { id: '365_DAYS', label: '1Y', days: 365, ratePerDiamond: 1.00 }
                            ]).map((dur) => {
                                const updateD = (field: string, val: any) => {
                                    const current = localSettings.diamondDurations || [];
                                    const newD = current.map(d => d.id === dur.id ? {...d, [field]: val} : d);
                                    setLocalSettings({...localSettings, diamondDurations: newD});
                                };
                                return (
                                    <div key={dur.id} className="bg-white p-2 rounded-lg border border-slate-200 relative flex items-center justify-between gap-2">
                                        <button onClick={() => {
                                            if(!confirm('Delete this validity?')) return;
                                            const current = localSettings.diamondDurations || [];
                                            setLocalSettings({...localSettings, diamondDurations: current.filter(d => d.id !== dur.id)});
                                        }} className="absolute -left-2 -top-2 bg-red-100 text-red-600 hover:bg-red-200 p-1 rounded-full"><X size={12}/></button>
                                        <div className="flex items-center gap-2 flex-1 ml-2">
                                            <input type="text" value={dur.label} onChange={e => updateD('label', e.target.value)} className="w-12 p-1.5 border rounded text-xs font-bold text-center" placeholder="e.g. 1M" />
                                            <input type="number" value={dur.days} onChange={e => updateD('days', Number(e.target.value))} className="w-16 p-1.5 border rounded text-xs text-center" placeholder="Days" />
                                            <span className="text-[10px] text-slate-500 font-bold">Days</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-slate-500 font-bold">₹ Rate per 💎:</span>
                                            <input type="number" step="0.01" value={dur.ratePerDiamond} onChange={e => updateD('ratePerDiamond', Number(e.target.value))} className="w-20 p-1.5 border rounded text-xs font-bold text-green-600 bg-green-50 text-right" />
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                  </div>
              </div>

              {/* STORE FEATURE LIST (Moved from General Settings) */}"""

content = content.replace(find_str, replace_str)

with open('artifacts/iic-study-app-replit/src/components/AdminDashboard.tsx', 'w') as f:
    f.write(content)

print("Injected passes UI")
