import re

with open('artifacts/iic-study-app-replit/src/components/AdminDashboard.tsx', 'r') as f:
    content = f.read()


# 1. Broadcast Credit Pass
bc_credit_find = """                      {broadcastType === 'CREDIT_SUBSCRIPTION' && (
                          <div className="flex flex-col gap-2 p-3 bg-indigo-50/60 rounded-xl border border-indigo-200 col-span-full">
                              <div>
                                  <label className="text-[10px] font-bold text-indigo-700 uppercase block mb-1">Select Credit Plan or Custom</label>
                                  <select
                                      value={broadcastCreditPlanId}
                                      onChange={e => {
                                          const val = e.target.value;
                                          setBroadcastCreditPlanId(val);
                                          const found = (localSettings.creditSubscriptionPlans || DEFAULT_CREDIT_SUB_PLANS).find(p => p.id === val);
                                          if (found) {
                                              setBroadcastCreditDaily(found.dailyCredits);
                                              setBroadcastCreditDays(found.durationDays);
                                              setBroadcastCreditPlanName(found.name);
                                          }
                                      }}
                                      className="w-full p-2.5 rounded-xl border border-indigo-200 bg-white font-bold text-sm"
                                  >
                                      <option value="">Custom Daily Pass</option>
                                      {(localSettings.creditSubscriptionPlans || DEFAULT_CREDIT_SUB_PLANS).map(p => (
                                          <option key={p.id} value={p.id}>{p.name} — +{p.dailyCredits} CR/d ({p.durationDays} Days)</option>
                                      ))}
                                  </select>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                  <div>
                                      <label className="text-[10px] font-bold text-indigo-700 uppercase block mb-1">🪙 Daily Credits</label>
                                      <input type="number" min={1} value={broadcastCreditDaily} onChange={e => setBroadcastCreditDaily(Number(e.target.value))} className="w-full p-2.5 rounded-xl border border-indigo-200 font-bold bg-white text-sm" />
                                  </div>
                                  <div>
                                      <label className="text-[10px] font-bold text-indigo-700 uppercase block mb-1">📅 Duration (Days)</label>
                                      <input type="number" min={1} value={broadcastCreditDays} onChange={e => setBroadcastCreditDays(Number(e.target.value))} className="w-full p-2.5 rounded-xl border border-indigo-200 font-bold bg-white text-sm" />
                                  </div>
                              </div>
                              <p className="text-[9px] text-indigo-700 font-medium">⚡ Saare recipients ko roz +{broadcastCreditDaily} credits milenge ({broadcastCreditDays} din tak Store me claim karne ke liye).</p>
                          </div>
                      )}"""

bc_credit_replace = """                      {broadcastType === 'CREDIT_SUBSCRIPTION' && (
                          <div className="flex flex-col gap-3 p-3 bg-indigo-50/60 rounded-xl border border-indigo-200 col-span-full">
                              <label className="text-[10px] font-bold text-indigo-700 uppercase block">⚡ Select Credit Plan</label>
                              <div className="grid grid-cols-2 gap-2">
                                  {(localSettings.creditSubscriptionPlans || DEFAULT_CREDIT_SUB_PLANS).map(p => (
                                      <button 
                                          key={p.id}
                                          type="button"
                                          onClick={() => {
                                              setBroadcastCreditPlanId(p.id);
                                              setBroadcastCreditDaily(p.dailyCredits);
                                              setBroadcastCreditPlanName(p.name);
                                          }}
                                          className={`p-2 rounded font-bold text-[11px] border leading-tight ${broadcastCreditPlanId === p.id ? 'bg-indigo-100 border-indigo-400 text-indigo-900 shadow-sm' : 'bg-white border-indigo-100 text-indigo-600 hover:bg-indigo-50'}`}>
                                          <div className="text-indigo-700 truncate">{p.name.replace('Credit Pass', 'Pass')}</div>
                                          <div className="opacity-80 font-normal">+{p.dailyCredits} CR/d</div>
                                      </button>
                                  ))}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[10px] font-bold text-indigo-600 uppercase w-16">Validity:</span>
                                  <div className="flex-1 grid grid-cols-4 gap-1">
                                      {[
                                          { label: '1M', days: 30 },
                                          { label: '3M', days: 90 },
                                          { label: '6M', days: 180 },
                                          { label: '1Y', days: 365 }
                                      ].map(opt => (
                                          <button 
                                              key={opt.days}
                                              type="button"
                                              onClick={() => setBroadcastCreditDays(opt.days)}
                                              className={`py-1.5 rounded font-bold text-[11px] border ${broadcastCreditDays === opt.days ? 'bg-indigo-700 border-indigo-800 text-white shadow-sm' : 'bg-white border-indigo-200 text-indigo-600 hover:bg-indigo-50'}`}>
                                              {opt.label}
                                          </button>
                                      ))}
                                  </div>
                              </div>
                              <p className="text-[9px] text-indigo-700 font-medium mt-1">⚡ Redeemer ko har din +{broadcastCreditDaily} credits milenge ({broadcastCreditDays} din tak).</p>
                          </div>
                      )}"""

content = content.replace(bc_credit_find, bc_credit_replace)

# 2. Broadcast Diamond Pass
bc_diamond_find = """                      {broadcastType === 'DIAMOND_SUBSCRIPTION' && (
                          <div className="flex flex-col gap-2 p-3 bg-sky-50/70 rounded-xl border border-sky-200 col-span-full">
                              <label className="text-[10px] font-bold text-sky-800 uppercase block mb-1">💎 Diamond Subscription Plan</label>
                              <select
                                  value={broadcastDiamondSubPlan}
                                  onChange={e => setBroadcastDiamondSubPlan(e.target.value)}
                                  className="w-full p-2.5 rounded-xl border border-sky-300 bg-white font-bold text-sm text-sky-900"
                              >
                                  {DIAMOND_SUBSCRIPTION_PLANS.map(p => (
                                      <option key={p.id} value={p.id}>{p.name} (+{p.dailyDiamonds} 💎 / day = {p.totalDiamonds} total)</option>
                                  ))}
                              </select>
                              <p className="text-[10px] text-sky-700">Subscribers ko daily diamonds claim karne ka pass milega.</p>
                          </div>
                      )}"""

bc_diamond_replace = """                      {broadcastType === 'DIAMOND_SUBSCRIPTION' && (
                          <div className="flex flex-col gap-3 p-3 bg-sky-50/70 rounded-xl border border-sky-200 col-span-full">
                              <label className="text-[10px] font-bold text-sky-800 uppercase block">💎 Diamond Subscription Plan</label>
                              <div className="grid grid-cols-2 gap-2">
                                  {DIAMOND_SUBSCRIPTION_PLANS.map(p => (
                                      <button 
                                          key={p.id}
                                          type="button"
                                          onClick={() => {
                                              setBroadcastDiamondSubPlan(p.id);
                                              setBroadcastDiamondSubDaily(p.dailyDiamonds);
                                              setBroadcastDiamondSubName(p.name);
                                          }}
                                          className={`p-2 rounded font-bold text-[11px] border leading-tight ${broadcastDiamondSubPlan === p.id ? 'bg-sky-100 border-sky-400 text-sky-900 shadow-sm' : 'bg-white border-sky-100 text-sky-600 hover:bg-sky-50'}`}>
                                          <div className="text-sky-700 truncate">{p.name.replace('Diamond Pass', 'Pass')}</div>
                                          <div className="opacity-80 font-normal">+{p.dailyDiamonds} 💎/d</div>
                                      </button>
                                  ))}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[10px] font-bold text-sky-600 uppercase w-16">Validity:</span>
                                  <div className="flex-1 grid grid-cols-5 gap-1">
                                      {[
                                          { label: '7D', days: 7 },
                                          { label: '1M', days: 30 },
                                          { label: '3M', days: 90 },
                                          { label: '6M', days: 180 },
                                          { label: '1Y', days: 365 }
                                      ].map(opt => (
                                          <button 
                                              key={opt.days}
                                              type="button"
                                              onClick={() => setBroadcastDiamondSubDays(opt.days)}
                                              className={`py-1.5 rounded font-bold text-[10px] border ${broadcastDiamondSubDays === opt.days ? 'bg-sky-700 border-sky-800 text-white shadow-sm' : 'bg-white border-sky-200 text-sky-600 hover:bg-sky-50'}`}>
                                              {opt.label}
                                          </button>
                                      ))}
                                  </div>
                              </div>
                              <p className="text-[9px] text-sky-700 mt-1">💎 Redeemer ko har din +{broadcastDiamondSubDaily} diamonds milenge ({broadcastDiamondSubDays} din tak).</p>
                          </div>
                      )}"""

content = content.replace(bc_diamond_find, bc_diamond_replace)

# 3. Single Credit Pass
s_credit_find = """                      ) : newCodeType === 'CREDIT_SUBSCRIPTION' ? (
                          <div className="flex flex-col gap-2 p-3 bg-white rounded-xl border border-pink-200">
                              <div>
                                  <label className="text-xs font-bold text-pink-700 uppercase block mb-1">Select Credit Plan or Custom</label>
                                  <select
                                      value={newCodeCreditPlanId}
                                      onChange={e => {
                                          const val = e.target.value;
                                          setNewCodeCreditPlanId(val);
                                          const found = (localSettings.creditSubscriptionPlans || DEFAULT_CREDIT_SUB_PLANS).find(p => p.id === val);
                                          if (found) {
                                              setNewCodeCreditDaily(found.dailyCredits);
                                              setNewCodeCreditDays(found.durationDays);
                                              setNewCodeCreditPlanName(found.name);
                                          }
                                      }}
                                      className="p-3 rounded-xl border border-pink-200 bg-white font-bold text-sm w-full"
                                  >
                                      <option value="">Custom Daily Pass</option>
                                      {(localSettings.creditSubscriptionPlans || DEFAULT_CREDIT_SUB_PLANS).map(p => (
                                          <option key={p.id} value={p.id}>{p.name} — +{p.dailyCredits} CR/d ({p.durationDays} Days)</option>
                                      ))}
                                  </select>
                              </div>
                              <div className="flex gap-2">
                                  <div>
                                      <label className="text-[10px] font-bold text-pink-700 uppercase block mb-1">🪙 Daily Credits</label>
                                      <input type="number" min={1} value={newCodeCreditDaily} onChange={e => setNewCodeCreditDaily(Number(e.target.value))} className="p-2.5 rounded-xl border border-pink-200 w-28 font-bold text-sm" />
                                  </div>
                                  <div>
                                      <label className="text-[10px] font-bold text-pink-700 uppercase block mb-1">📅 Days</label>
                                      <input type="number" min={1} value={newCodeCreditDays} onChange={e => setNewCodeCreditDays(Number(e.target.value))} className="p-2.5 rounded-xl border border-pink-200 w-24 font-bold text-sm" />
                                  </div>
                              </div>
                              <p className="text-[10px] text-pink-700 font-semibold">⚡ Redeemer ko har din +{newCodeCreditDaily} Credits milenge Store se claim karne ke liye {newCodeCreditDays} dino tak.</p>
                          </div>"""

s_credit_replace = """                      ) : newCodeType === 'CREDIT_SUBSCRIPTION' ? (
                          <div className="flex flex-col gap-3 p-3 bg-white rounded-xl border border-pink-200">
                              <label className="text-xs font-bold text-pink-700 uppercase block">⚡ Select Credit Plan</label>
                              <div className="grid grid-cols-2 gap-2">
                                  {(localSettings.creditSubscriptionPlans || DEFAULT_CREDIT_SUB_PLANS).map(p => (
                                      <button 
                                          key={p.id}
                                          type="button"
                                          onClick={() => {
                                              setNewCodeCreditPlanId(p.id);
                                              setNewCodeCreditDaily(p.dailyCredits);
                                              setNewCodeCreditPlanName(p.name);
                                          }}
                                          className={`p-2 rounded font-bold text-[11px] border leading-tight ${newCodeCreditPlanId === p.id ? 'bg-pink-50 border-pink-400 text-pink-900 shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                                          <div className="text-pink-600 truncate">{p.name.replace('Credit Pass', 'Pass')}</div>
                                          <div className="opacity-80 font-normal">+{p.dailyCredits} CR/d</div>
                                      </button>
                                  ))}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[10px] font-bold text-slate-500 uppercase w-16">Validity:</span>
                                  <div className="flex-1 grid grid-cols-4 gap-1">
                                      {[
                                          { label: '1M', days: 30 },
                                          { label: '3M', days: 90 },
                                          { label: '6M', days: 180 },
                                          { label: '1Y', days: 365 }
                                      ].map(opt => (
                                          <button 
                                              key={opt.days}
                                              type="button"
                                              onClick={() => setNewCodeCreditDays(opt.days)}
                                              className={`py-1.5 rounded font-bold text-[11px] border ${newCodeCreditDays === opt.days ? 'bg-pink-600 border-pink-700 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                                              {opt.label}
                                          </button>
                                      ))}
                                  </div>
                              </div>
                              <p className="text-[10px] text-pink-700 font-semibold mt-1">⚡ Redeemer ko har din +{newCodeCreditDaily} credits milenge ({newCodeCreditDays} din tak).</p>
                          </div>"""

content = content.replace(s_credit_find, s_credit_replace)

# 4. Single Diamond Pass
s_diamond_find = """                      ) : newCodeType === 'DIAMOND_SUBSCRIPTION' ? (
                          <div className="flex flex-col gap-2">
                              <label className="text-xs font-bold text-sky-700 uppercase block mb-1">💎 Diamond Subscription Plan</label>
                              <select 
                                  value={newCodeDiamondSubPlan} 
                                  onChange={e => setNewCodeDiamondSubPlan(e.target.value)} 
                                  className="p-3 rounded-xl border border-sky-300 font-bold text-sky-900 bg-white"
                              >
                                  {DIAMOND_SUBSCRIPTION_PLANS.map(p => (
                                      <option key={p.id} value={p.id}>{p.name} (+{p.dailyDiamonds} 💎 / day = {p.totalDiamonds} total)</option>
                                  ))}
                              </select>
                              <p className="text-[10px] text-sky-600">Redeemer ko daily diamonds claim karne ka pass active hoga.</p>
                          </div>"""

s_diamond_replace = """                      ) : newCodeType === 'DIAMOND_SUBSCRIPTION' ? (
                          <div className="flex flex-col gap-3">
                              <label className="text-xs font-bold text-sky-700 uppercase block">💎 Diamond Subscription Plan</label>
                              <div className="grid grid-cols-2 gap-2">
                                  {DIAMOND_SUBSCRIPTION_PLANS.map(p => (
                                      <button 
                                          key={p.id}
                                          type="button"
                                          onClick={() => {
                                              setNewCodeDiamondSubPlan(p.id);
                                              setNewCodeDiamondSubDaily(p.dailyDiamonds);
                                              setNewCodeDiamondSubName(p.name);
                                          }}
                                          className={`p-2 rounded font-bold text-[11px] border leading-tight ${newCodeDiamondSubPlan === p.id ? 'bg-sky-50 border-sky-400 text-sky-900 shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                                          <div className="text-sky-600 truncate">{p.name.replace('Diamond Pass', 'Pass')}</div>
                                          <div className="opacity-80 font-normal">+{p.dailyDiamonds} 💎/d</div>
                                      </button>
                                  ))}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[10px] font-bold text-slate-500 uppercase w-16">Validity:</span>
                                  <div className="flex-1 grid grid-cols-5 gap-1">
                                      {[
                                          { label: '7D', days: 7 },
                                          { label: '1M', days: 30 },
                                          { label: '3M', days: 90 },
                                          { label: '6M', days: 180 },
                                          { label: '1Y', days: 365 }
                                      ].map(opt => (
                                          <button 
                                              key={opt.days}
                                              type="button"
                                              onClick={() => setNewCodeDiamondSubDays(opt.days)}
                                              className={`py-1.5 rounded font-bold text-[10px] border ${newCodeDiamondSubDays === opt.days ? 'bg-sky-600 border-sky-700 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                                              {opt.label}
                                          </button>
                                      ))}
                                  </div>
                              </div>
                              <p className="text-[10px] text-sky-600">Redeemer ko har din +{newCodeDiamondSubDaily} diamonds milenge ({newCodeDiamondSubDays} din tak).</p>
                          </div>"""

content = content.replace(s_diamond_find, s_diamond_replace)

with open('artifacts/iic-study-app-replit/src/components/AdminDashboard.tsx', 'w') as f:
    f.write(content)
print("Updated UI")
