import re

with open('artifacts/iic-study-app-replit/src/components/Store.tsx', 'r') as f:
    content = f.read()

compare_matrix_code = """

const compareData = [
  { category: 'Account & Limits', items: [
    { label: 'Leaderboard Unlock', free: 'Level 2 Unlock', basic: 'Instant (Level 1)', ultra: 'Instant (Level 1)' },
    { label: 'Daily MCQ Limit', free: '300 / day', basic: '1,500 / day', ultra: '3,000 / day' },
    { label: 'Daily XP Cap', free: '1,500 XP', basic: '2,500 XP', ultra: '3,500 XP' },
    { label: 'XP Multiplier', free: '1.0x', basic: '1.5x', ultra: '2.0x' },
    { label: 'Store Discount (Credits)', free: '0%', basic: '5%', ultra: '10%' },
    { label: 'Daily Store Rewards', free: '—', basic: '50 Credits / day', ultra: '5 Diamonds / day' },
    { label: 'Profile Name Change', free: '100 🪙 or 20 💎', basic: '100 🪙 or 20 💎', ultra: '100 🪙 or 20 💎' },
  ]},
  { category: 'Study Content & Modes', items: [
    { label: 'PDF Notes / Material', free: '5 💎', basic: '✅ Free Included', ultra: '✅ Free Included' },
    { label: 'Flashcard & Video', free: '5 💎', basic: '5 💎', ultra: '✅ Free / Unlocked' },
    { label: 'Study Modes (Read/Write/etc)', free: '20 🪙 or 5 💎', basic: '20 🪙 or 5 💎', ultra: '20 🪙 or 5 💎' },
    { label: 'MCQ Full Analysis', free: '20 🪙 or 5 💎', basic: '20 🪙 or 5 💎', ultra: '20 🪙 or 5 💎' },
    { label: 'MCQ Marksheet & Solution', free: '✅ Free', basic: '✅ Free', ultra: '✅ Free' },
    { label: 'Editor / Study Utilities', free: '❌ Locked', basic: '✅ Enabled', ultra: '✅ Enabled' },
    { label: 'Revision Hub', free: '100 🪙 or 20 💎', basic: '100 🪙 or 20 💎', ultra: '100 🪙 or 20 💎' },
  ]},
  { category: 'Routine Engine', items: [
    { label: 'Routine Default Slots', free: '2 Slots', basic: '3 Slots', ultra: '4 Slots' },
    { label: 'Routine Books Selection', free: 'Lucent Only', basic: 'Lucent Only', ultra: 'Multiple Books Allowed' },
    { label: 'Routine Penalty (Inactive)', free: 'Credits Rate Reduced', basic: 'No Penalty', ultra: 'No Penalty' },
    { label: 'Routine Progression Slots', free: '+1 (Lvl 5), +1 (Lvl 8)', basic: '+1 (Lvl 5), +1 (Lvl 8)', ultra: '+1 (Lvl 5), +1 (Lvl 8)' },
    { label: 'Routine Paid Slot', free: '100 🪙 / slot', basic: '100 🪙 / slot', ultra: '100 🪙 / slot' },
  ]},
  { category: 'Community & Chat', items: [
    { label: 'Global Chat', free: 'View & Like Only', basic: 'View & Like Only', ultra: '✅ Send Messages Allowed' },
    { label: 'MCQ Sharing', free: 'Solve Only', basic: '✅ Post MCQs Allowed', ultra: '✅ Post MCQs Allowed' },
    { label: 'Admin Support', free: '10 🪙 or 5 💎 / msg', basic: '✅ Free', ultra: '✅ Free' },
    { label: 'Messenger Friend Limit', free: '10 Friends', basic: '30 Friends', ultra: '60 Friends' },
    { label: 'Messenger Expansion', free: 'Up to 50 max', basic: 'Up to 50+', ultra: 'Unlimited' },
    { label: 'Daily Message Limit', free: '50 / day', basic: '100 / day', ultra: '300 / day' },
    { label: 'Message Limit Extension', free: '+50 first, +100 next', basic: '+100 per upgrade', ultra: '+100 per upgrade' },
    { label: 'Chat Security & Actions', free: '✅ Free', basic: '✅ Free', ultra: '✅ Free' },
  ]},
  { category: 'Customization & Themes', items: [
    { label: 'Theme Studio Access', free: 'Level 3 Unlock', basic: '✅ Instant Unlock', ultra: '✅ Instant Unlock' },
    { label: 'Score History', free: 'Level 3 Unlock', basic: '✅ Instant Access', ultra: '✅ Instant Access' },
    { label: 'Theme Library Packs', free: 'Free themes only', basic: 'Basic themes free', ultra: 'Ultra themes free' },
    { label: 'Theme Pricing (Rental)', free: '1D: 10🪙, 7D: 50🪙, 30D: 100🪙', basic: '1D: 10🪙, 7D: 50🪙, 30D: 100🪙', ultra: '1D: 10🪙, 7D: 50🪙, 30D: 100🪙' },
  ]}
];

const CompareMatrix = () => {
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="rounded-3xl p-5 border border-sky-400/20 bg-sky-950/20 shadow-xl overflow-hidden relative">
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-sky-500/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="text-center mb-6">
          <span className="inline-block px-3 py-1 rounded-full bg-sky-500/20 text-sky-400 text-[10px] font-black uppercase tracking-widest mb-2 border border-sky-400/20">Full Transparency</span>
          <h2 className="text-xl font-black text-white">Feature Comparison Matrix</h2>
          <p className="text-xs text-slate-400 mt-1">See exactly what you get across Free, Basic, and Ultra tiers</p>
        </div>

        <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-sky-500/30 scrollbar-track-transparent">
          <table className="w-full text-left min-w-[700px] border-collapse">
            <thead>
              <tr>
                <th className="p-3 border-b-2 border-white/10 text-xs font-black text-slate-300 w-[28%]">Feature / Module</th>
                <th className="p-3 border-b-2 border-slate-700 text-center w-[24%] bg-slate-900/40 rounded-tl-xl border-l border-t border-slate-700/50">
                  <div className="text-[10px] uppercase text-slate-400 font-bold">Standard</div>
                  <div className="text-sm font-black text-slate-200 mt-0.5">Free User</div>
                </th>
                <th className="p-3 border-b-2 border-sky-500/40 text-center w-[24%] bg-sky-900/20 border-l border-t border-sky-500/20">
                  <div className="text-[10px] uppercase text-sky-400 font-bold flex justify-center gap-1"><span>⭐</span> Pro</div>
                  <div className="text-sm font-black text-sky-300 mt-0.5">Basic User</div>
                </th>
                <th className="p-3 border-b-2 border-purple-500/50 text-center w-[24%] bg-purple-900/30 rounded-tr-xl border-l border-t border-r border-purple-500/30">
                  <div className="text-[10px] uppercase text-purple-300 font-bold flex justify-center gap-1"><span>👑</span> Max</div>
                  <div className="text-sm font-black text-purple-200 mt-0.5">Ultra User</div>
                </th>
              </tr>
            </thead>
            <tbody>
              {compareData.map((group, gIdx) => (
                <React.Fragment key={gIdx}>
                  {/* Category Header */}
                  <tr>
                    <td colSpan={4} className="py-4 px-2 pt-6">
                      <div className="flex items-center gap-2">
                        <div className="h-px bg-slate-700 flex-1" />
                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{group.category}</span>
                        <div className="h-px bg-slate-700 flex-1" />
                      </div>
                    </td>
                  </tr>
                  
                  {/* Items */}
                  {group.items.map((item, iIdx) => (
                    <tr key={iIdx} className="group hover:bg-white/[0.02] transition-colors">
                      <td className="p-3 border-b border-white/5 text-xs text-slate-300 font-medium group-hover:text-white transition-colors">{item.label}</td>
                      
                      {/* Free Col */}
                      <td className="p-3 border-b border-l border-white/5 text-center text-xs text-slate-400 bg-slate-900/20">
                        <span className={item.free.includes('❌') ? 'text-rose-400/80' : item.free.includes('✅') ? 'text-emerald-400/80 font-bold' : ''}>{item.free}</span>
                      </td>
                      
                      {/* Basic Col */}
                      <td className="p-3 border-b border-l border-sky-500/10 text-center text-xs text-sky-200/80 bg-sky-900/10 group-hover:bg-sky-900/20 transition-colors">
                        <span className={item.basic.includes('❌') ? 'text-rose-400' : item.basic.includes('✅') ? 'text-emerald-400 font-bold' : ''}>{item.basic}</span>
                      </td>
                      
                      {/* Ultra Col */}
                      <td className="p-3 border-b border-l border-r border-purple-500/20 text-center text-xs text-purple-200/90 bg-purple-900/20 group-hover:bg-purple-900/30 transition-colors">
                        <span className={item.ultra.includes('❌') ? 'text-rose-400' : item.ultra.includes('✅') ? 'text-emerald-400 font-bold' : item.ultra.includes('Unlimited') || item.ultra.includes('Instant') ? 'text-amber-300 font-bold' : ''}>{item.ultra}</span>
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

/* ─── Main Store Screen Component ─── */
"""

content = content.replace("/* ─── Main Store Screen Component ─── */", compare_matrix_code)

# Add COMPARE to tierType state
content = re.sub(
    r"useState<'SUBSCRIPTION' \| 'CREDITS' \| 'DIAMONDS' \| 'EXCHANGE' \| 'HISTORY'>",
    "useState<'SUBSCRIPTION' | 'COMPARE' | 'CREDITS' | 'DIAMONDS' | 'EXCHANGE' | 'HISTORY'>",
    content
)

# Insert COMPARE tab to allTabs
compare_tab_str = "{ id: 'COMPARE'      as const, label: 'Compare',      emoji: '⚖️', color: '#38bdf8', bg: 'rgba(56,189,248,0.16)', border: 'rgba(56,189,248,0.35)', glow: 'rgba(56,189,248,0.25)' },"
content = re.sub(
    r"({ id: 'SUBSCRIPTION' as const.*? glow: 'rgba\(192,132,252,0\.25\)' },)",
    r"\1\n    " + compare_tab_str,
    content
)

# Render COMPARE tab block
render_block = """
        {/* ── COMPARE MATRIX ── */}
        {tierType === 'COMPARE' && <CompareMatrix />}
"""
content = re.sub(
    r"({\/\* ── 2\. VIP SUBSCRIPTIONS \(CLEAN PRO & MAX PASS CARDS\) ── \*\/})",
    render_block + r"\n        \1",
    content
)

with open('artifacts/iic-study-app-replit/src/components/Store.tsx', 'w') as f:
    f.write(content)

print("Added Compare Matrix to Store.tsx")
