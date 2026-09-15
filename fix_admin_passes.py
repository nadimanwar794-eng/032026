import re

with open('artifacts/iic-study-app-replit/src/components/AdminDashboard.tsx', 'r') as f:
    content = f.read()

# Replace Credit Pass Select UI
credit_find = """                                  <div className="flex flex-col gap-2">
                                      <div className="flex gap-2">
                                          <select
                                              value={selectedUserCreditSubPlanId}
                                              onChange={e => setSelectedUserCreditSubPlanId(e.target.value)}
                                              className="flex-1 p-2 border rounded-lg text-xs bg-white">
                                              <option value="">-- Credit Plan Chunein --</option>
                                              {(localSettings.creditSubscriptionPlans || DEFAULT_CREDIT_SUB_PLANS).map(p => (
                                                  <option key={p.id} value={p.id}>
                                                      {p.name} (Base ₹{p.price} · +{p.dailyCredits} CR/d)
                                                  </option>
                                              ))}
                                          </select>
                                          <select
                                              value={selectedUserCreditSubDuration}
                                              onChange={e => setSelectedUserCreditSubDuration(Number(e.target.value))}
                                              className="w-36 p-2 border rounded-lg text-xs bg-white font-medium">
                                              <option value="30">1 Month (30d · 5% off)</option>
                                              <option value="90">3 Months (90d · 10% off)</option>
                                              <option value="180">6 Months (180d · 15% off)</option>
                                              <option value="365">1 Year (365d · 25% off)</option>
                                          </select>
                                      </div>"""

credit_replace = """                                  <div className="flex flex-col gap-3">
                                      <div className="grid grid-cols-2 gap-2">
                                          {(localSettings.creditSubscriptionPlans || DEFAULT_CREDIT_SUB_PLANS).map(p => (
                                              <button 
                                                  key={p.id}
                                                  type="button"
                                                  onClick={() => setSelectedUserCreditSubPlanId(p.id)}
                                                  className={`p-2 rounded font-bold text-[11px] border leading-tight ${selectedUserCreditSubPlanId === p.id ? 'bg-amber-100 border-amber-400 text-amber-900 shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                                                  <div className="text-amber-600 truncate">{p.name.replace('Credit Pass', 'Pass')}</div>
                                                  <div className="opacity-80 font-normal">+{p.dailyCredits} CR/d</div>
                                              </button>
                                          ))}
                                      </div>
                                      <div className="flex items-center gap-2">
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
                                                      onClick={() => setSelectedUserCreditSubDuration(opt.days)}
                                                      className={`py-1.5 rounded font-bold text-[11px] border ${selectedUserCreditSubDuration === opt.days ? 'bg-slate-800 border-slate-900 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                                                      {opt.label}
                                                  </button>
                                              ))}
                                          </div>
                                      </div>"""

content = content.replace(credit_find, credit_replace)

# Replace Diamond Pass Select UI
diamond_find = """                                  <div className="flex gap-2">
                                      <select
                                          value={selectedUserDiamondSubPlanId}
                                          onChange={e => setSelectedUserDiamondSubPlanId(e.target.value)}
                                          className="flex-1 p-2 border border-sky-200 rounded-lg text-xs bg-white font-medium">
                                          {DIAMOND_SUBSCRIPTION_PLANS.map(p => (
                                              <option key={p.id} value={p.id}>
                                                  {p.name} (+{p.dailyDiamonds} 💎/d · {p.durationDays} Days · Total {p.totalDiamonds} 💎)
                                              </option>
                                          ))}
                                      </select>
                                      <button
                                          type="button"
                                          onClick={async () => {"""

diamond_replace = """                                  <div className="flex flex-col gap-3">
                                      <div className="grid grid-cols-2 gap-2">
                                          {DIAMOND_SUBSCRIPTION_PLANS.map(p => (
                                              <button 
                                                  key={p.id}
                                                  type="button"
                                                  onClick={() => setSelectedUserDiamondSubPlanId(p.id)}
                                                  className={`p-2 rounded font-bold text-[11px] border leading-tight ${selectedUserDiamondSubPlanId === p.id ? 'bg-sky-100 border-sky-400 text-sky-900 shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                                                  <div className="text-sky-600 truncate">{p.name.replace('Diamond Pass', 'Pass')}</div>
                                                  <div className="opacity-80 font-normal">+{p.dailyDiamonds}💎/d · {p.durationDays}d</div>
                                              </button>
                                          ))}
                                      </div>
                                      <button
                                          type="button"
                                          onClick={async () => {"""

content = content.replace(diamond_find, diamond_replace)

with open('artifacts/iic-study-app-replit/src/components/AdminDashboard.tsx', 'w') as f:
    f.write(content)

print("Done")
