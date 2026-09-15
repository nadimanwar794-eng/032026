import re

with open('artifacts/iic-study-app-replit/src/components/AdminDashboard.tsx', 'r') as f:
    content = f.read()

# 1. ADD STATES FOR DIAMOND
states_find = """  const [newCspBadge, setNewCspBadge] = useState('');
  const [newCspScoreMultiplier, setNewCspScoreMultiplier] = useState('');"""

states_replace = """  const [newCspBadge, setNewCspBadge] = useState('');
  const [newCspScoreMultiplier, setNewCspScoreMultiplier] = useState('');

  // Diamond Templates States
  const [newDiamondTemplateName, setNewDiamondTemplateName] = useState('');
  const [newDiamondTemplateIcon, setNewDiamondTemplateIcon] = useState('💎');
  const [newDiamondTemplateDaily, setNewDiamondTemplateDaily] = useState('');
  const [newDiamondTemplateFeatures, setNewDiamondTemplateFeatures] = useState('');

  // Diamond Durations States
  const [newDiamondDurationLabel, setNewDiamondDurationLabel] = useState('');
  const [newDiamondDurationDays, setNewDiamondDurationDays] = useState('');
  const [newDiamondDurationRate, setNewDiamondDurationRate] = useState('');"""
content = content.replace(states_find, states_replace)


# 2. ADD LOGIC FOR DIAMOND
logic_find = """  const addCreditSubPreset = (preset: (typeof PRESET_CREDIT_SUB_TEMPLATES)[0]) => {"""

logic_replace = """  const addDiamondTemplate = () => {
    if (!newDiamondTemplateName || !newDiamondTemplateDaily) return;
    const newTemplate = {
      id: `dia_tmpl_${Date.now()}`,
      name: newDiamondTemplateName,
      icon: newDiamondTemplateIcon || '💎',
      dailyDiamonds: Number(newDiamondTemplateDaily),
      features: newDiamondTemplateFeatures.split(',').map(f => f.trim()).filter(Boolean)
    };
    const current = localSettings.diamondTemplates || [
      { id: 'starter_diamond', name: 'Starter Diamond Pass', icon: '💎', dailyDiamonds: 10, features: ['Daily 10 💎 Drop Claim', 'Chapters Permanently Unlock'] },
      { id: 'active_diamond', name: 'Active Diamond Pass', icon: '⚡', dailyDiamonds: 20, features: ['Daily 20 💎 Drop Claim', 'Tez Chapters Unlocking'] },
      { id: 'premium_diamond', name: 'Premium Diamond Pass', icon: '🌟', dailyDiamonds: 30, features: ['Daily 30 💎 Drop Claim', 'Premium Content Unlocks'] },
      { id: 'elite_diamond', name: 'Elite Diamond Pass', icon: '👑', dailyDiamonds: 50, features: ['Daily 50 💎 Huge Drop', 'Sabse Tez Unlock Speed'] }
    ];
    setLocalSettings({ ...localSettings, diamondTemplates: [...current, newTemplate] });
    setNewDiamondTemplateName(''); setNewDiamondTemplateDaily(''); setNewDiamondTemplateFeatures('');
  };

  const removeDiamondTemplate = (id: string) => {
    if (!confirm('Are you sure?')) return;
    const current = localSettings.diamondTemplates || [];
    setLocalSettings({ ...localSettings, diamondTemplates: current.filter(t => t.id !== id) });
  };

  const updateDiamondTemplate = (id: string, field: string, value: any) => {
    const current = localSettings.diamondTemplates || [];
    const updated = current.map(t => {
      if (t.id !== id) return t;
      if (field === 'features') {
         return { ...t, features: value.split(',').map((f: string) => f.trim()).filter(Boolean) };
      }
      return { ...t, [field]: value };
    });
    setLocalSettings({ ...localSettings, diamondTemplates: updated });
  };

  const addDiamondDuration = () => {
    if (!newDiamondDurationLabel || !newDiamondDurationDays || !newDiamondDurationRate) return;
    const newDur = {
      id: `dia_dur_${Date.now()}`,
      label: newDiamondDurationLabel,
      days: Number(newDiamondDurationDays),
      ratePerDiamond: Number(newDiamondDurationRate)
    };
    const current = localSettings.diamondDurations || [
      { id: '7_DAYS', label: '7D', days: 7, ratePerDiamond: 1.80 },
      { id: '30_DAYS', label: '1M', days: 30, ratePerDiamond: 1.50 },
      { id: '90_DAYS', label: '3M', days: 90, ratePerDiamond: 1.30 },
      { id: '180_DAYS', label: '6M', days: 180, ratePerDiamond: 1.15 },
      { id: '365_DAYS', label: '1Y', days: 365, ratePerDiamond: 1.00 }
    ];
    setLocalSettings({ ...localSettings, diamondDurations: [...current, newDur] });
    setNewDiamondDurationLabel(''); setNewDiamondDurationDays(''); setNewDiamondDurationRate('');
  };

  const removeDiamondDuration = (id: string) => {
    if (!confirm('Are you sure?')) return;
    const current = localSettings.diamondDurations || [];
    setLocalSettings({ ...localSettings, diamondDurations: current.filter(d => d.id !== id) });
  };

  const updateDiamondDuration = (id: string, field: string, value: any) => {
    const current = localSettings.diamondDurations || [];
    const updated = current.map(d => {
      if (d.id !== id) return d;
      return { ...d, [field]: value };
    });
    setLocalSettings({ ...localSettings, diamondDurations: updated });
  };

  const addCreditSubPreset = (preset: (typeof PRESET_CREDIT_SUB_TEMPLATES)[0]) => {"""
content = content.replace(logic_find, logic_replace)

# 3. FIX CREDIT UI TO NEW SPEC
ui_csp_find = """                                      <div>
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
                                  </div>
                                  <div className="flex gap-2">
                                      <div className="flex-1">
                                          <input
                                              type="text"
                                              placeholder="Badge (Optional: e.g. POPULAR, VALUE, BESTSELLER)"
                                              value={newCspBadge}
                                              onChange={e => setNewCspBadge(e.target.value)}
                                              className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                                          />
                                      </div>"""

ui_csp_replace = """                                      <div>
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
                                          <label className="text-[10px] font-bold uppercase text-slate-400">XP Boost (1.2)</label>
                                          <input
                                              type="number"
                                              step="0.1"
                                              placeholder="1.1"
                                              value={newCspScoreMultiplier}
                                              onChange={e => setNewCspScoreMultiplier(e.target.value)}
                                              className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                                          />
                                      </div>
                                  </div>
                                  <div className="flex gap-2">
                                      <div className="flex-1">
                                          <input
                                              type="text"
                                              placeholder="Badge (Optional: e.g. POPULAR, VALUE, BESTSELLER)"
                                              value={newCspBadge}
                                              onChange={e => setNewCspBadge(e.target.value)}
                                              className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                                          />
                                      </div>"""
content = content.replace(ui_csp_find, ui_csp_replace)

ui_csp_list_find = """                                                      <div className="flex items-center gap-1">
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
                                                      </div>"""

ui_csp_list_replace = """                                                      <div className="flex items-center gap-1">
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
                                                      </div>"""
content = content.replace(ui_csp_list_find, ui_csp_list_replace)

with open('artifacts/iic-study-app-replit/src/components/AdminDashboard.tsx', 'w') as f:
    f.write(content)

print("Updated scripts")
