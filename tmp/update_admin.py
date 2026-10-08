with open('artifacts/iic-study-app-replit/src/components/AdminDashboard.tsx', 'r') as f:
    content = f.read()

start_marker = '                              {/* ── ADVANCED: HOME PAGE SECTION CARD COLORS ── */}'
end_marker = '                              {/* ── DESIGN TOKENS LIVE PREVIEW ── */}'

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

assert start_idx != -1, 'start_marker not found'
assert end_idx != -1, 'end_marker not found'

new_block = '''                              {/* ── ADVANCED: HOME PAGE 6 CARDS 3D EFFECT & COLORS (MODERN CARDS) ── */}
                              <div className="mt-4 p-3 sm:p-4 bg-indigo-50/70 rounded-2xl border border-indigo-200 space-y-3.5">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                  <div>
                                    <label className="text-xs font-black text-indigo-900 uppercase flex items-center gap-1.5">
                                      <span>🎨</span>
                                      <span>Home Page Naye Cards — 3D Effect & Color Customizer</span>
                                    </label>
                                    <p className="text-[10px] text-indigo-600 font-medium">
                                      Home page ke 6 naye cards: Academic, Practice Set, Daily Challenge, Live Room, Revision Hub aur Mistakes ke 3D depth, border aur colors update karein.
                                    </p>
                                  </div>
                                  <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase shrink-0 self-start sm:self-auto ${
                                    (localSettings.homeAllCards3D || localSettings.globalCards3D) ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-200 text-slate-600'
                                  }`}>
                                    {(localSettings.homeAllCards3D || localSettings.globalCards3D) ? '🎲 3D Active' : '⬜ 2D Flat'}
                                  </span>
                                </div>

                                {/* Wallpaper transparency notice if active */}
                                {Boolean(localSettings.homeBackgroundImage) && (
                                  <div className="p-2.5 rounded-xl bg-purple-100/80 border border-purple-300 text-purple-900 text-[10px] font-medium flex items-center gap-2">
                                    <span className="text-base">🖼️</span>
                                    <span>
                                      <strong>Home Wallpaper Active:</strong> Cards ka container background automatically transparent rahega taaki wallpaper dikhe, jabki border aur text colors sharp rahenge.
                                    </span>
                                  </div>
                                )}

                                {/* Master 3D Toggle for all 6 cards */}
                                <div className="p-3 bg-white rounded-xl border border-indigo-200 shadow-2xs">
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                                    <div>
                                      <p className="text-[11px] font-black text-slate-800 flex items-center gap-1">
                                        <span>🎲</span> Master 3D — Sabhi 6 Naye Cards
                                      </p>
                                      <p className="text-[9px] text-slate-500 mt-0.5">
                                        Ek click me sabhi cards ko 3D raised depth & elevation dein ya flat 2D banayein.
                                      </p>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const nextState = !localSettings.homeAllCards3D;
                                        const updated = {
                                          ...localSettings,
                                          homeAllCards3D: nextState,
                                          globalCards3D: nextState,
                                          homeAcademicCard3D: nextState,
                                          homeClass612Card3D: nextState,
                                          homePracticeCard3D: nextState,
                                          homeDailyChallengeCard3D: nextState,
                                          homeLiveRoomCard3D: nextState,
                                          homeStudyRoomCard3D: nextState,
                                          homeRevisionHubCard3D: nextState,
                                          homeRevisionCard3D: nextState,
                                          homeMistakesCard3D: nextState,
                                        };
                                        setLocalSettings(updated);
                                        if (onUpdateSettings) onUpdateSettings(updated);
                                        localStorage.setItem('nst_system_settings', JSON.stringify(updated));
                                        saveSystemSettings(updated);
                                        adminToast.success(nextState ? '🎲 Sabhi 6 Cards 3D ON ho gaye!' : '⬜ Sabhi Cards 2D Flat ho gaye!');
                                      }}
                                      className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all border shrink-0 cursor-pointer active:scale-95 shadow-sm ${
                                        localSettings.homeAllCards3D
                                          ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white border-indigo-700 shadow-indigo-200'
                                          : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                                      }`}
                                    >
                                      {localSettings.homeAllCards3D ? '🎲 ALL 6 CARDS 3D ON' : '⬜ ALL 6 CARDS 2D FLAT'}
                                    </button>
                                  </div>
                                </div>

                                {/* Responsive Card Switcher Navigation (Mobile Friendly) */}
                                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 min-w-0 no-scrollbar">
                                  {[
                                    { id: 'ALL' as const, label: 'All 6 Cards', icon: '👁️' },
                                    { id: 'ACADEMIC' as const, label: 'Academic', icon: '🎯' },
                                    { id: 'PRACTICE' as const, label: 'Practice Set', icon: '🧠' },
                                    { id: 'DAILY' as const, label: 'Daily Challenge', icon: '🚀' },
                                    { id: 'ROOM' as const, label: 'Study Room', icon: '👥' },
                                    { id: 'REVISION' as const, label: 'Revision Hub', icon: '💡' },
                                    { id: 'MISTAKES' as const, label: 'My Mistakes', icon: '❌' },
                                  ].map((tab) => {
                                    const isSel = adminHomeCardTab === tab.id;
                                    return (
                                      <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => setAdminHomeCardTab(tab.id)}
                                        className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black shrink-0 transition-all flex items-center gap-1 cursor-pointer border ${
                                          isSel
                                            ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                                            : 'bg-white text-slate-600 border-slate-200 hover:bg-indigo-50 hover:text-indigo-600'
                                        }`}
                                      >
                                        <span>{tab.icon}</span>
                                        <span>{tab.label}</span>
                                      </button>
                                    );
                                  })}
                                </div>

                                {/* ── THE 6 CARDS MANAGERS LIST ── */}
                                {(() => {
                                  const cardsConfig = [
                                    {
                                      id: 'ACADEMIC' as const,
                                      title: 'Academic / Competitive Class Card',
                                      emoji: '🎯',
                                      desc: 'School Class 6-12 & Govt. Exams Mode selector card',
                                      bgVal: localSettings.homeAcademicCardBg || localSettings.homeClass612CardBg,
                                      borderVal: localSettings.homeAcademicCardBorder || localSettings.homeClass612CardBorder || '#6366f1',
                                      is3D: localSettings.homeAcademicCard3D !== undefined ? localSettings.homeAcademicCard3D : (localSettings.homeClass612Card3D || localSettings.homeAllCards3D),
                                      onBgChange: (v?: string) => setLocalSettings({ ...localSettings, homeAcademicCardBg: v, homeClass612CardBg: v }),
                                      onBorderChange: (v?: string) => setLocalSettings({ ...localSettings, homeAcademicCardBorder: v, homeClass612CardBorder: v }),
                                      on3DToggle: () => {
                                        const cur = localSettings.homeAcademicCard3D !== undefined ? localSettings.homeAcademicCard3D : (localSettings.homeClass612Card3D || localSettings.homeAllCards3D);
                                        setLocalSettings({ ...localSettings, homeAcademicCard3D: !cur, homeClass612Card3D: !cur });
                                      },
                                      previewBadge: 'Class 10 · Academic Mode',
                                      previewTitle: 'Class 10 & Board Prep',
                                      previewChips: ['📚 6 Subjects', '📖 45 Lessons', '⚡ 320 MCQs'],
                                      previewBtnText: 'Open Class 10 Syllabus',
                                      previewIcon: '🎓',
                                    },
                                    {
                                      id: 'PRACTICE' as const,
                                      title: 'Practice Set Card',
                                      emoji: '🧠',
                                      desc: 'Interactive Drill, mixed topics & high-yield live MCQs card',
                                      bgVal: localSettings.homePracticeCardBg,
                                      borderVal: localSettings.homePracticeCardBorder || '#10b981',
                                      is3D: localSettings.homePracticeCard3D !== undefined ? localSettings.homePracticeCard3D : localSettings.homeAllCards3D,
                                      onBgChange: (v?: string) => setLocalSettings({ ...localSettings, homePracticeCardBg: v }),
                                      onBorderChange: (v?: string) => setLocalSettings({ ...localSettings, homePracticeCardBorder: v }),
                                      on3DToggle: () => {
                                        const cur = localSettings.homePracticeCard3D !== undefined ? localSettings.homePracticeCard3D : localSettings.homeAllCards3D;
                                        setLocalSettings({ ...localSettings, homePracticeCard3D: !cur });
                                      },
                                      previewBadge: 'Interactive Drill · Live MCQs',
                                      previewTitle: 'Practice Set Drill',
                                      previewChips: ['🧠 10+ Practice Sets', '🎯 Topic-wise', '⚡ High Yield'],
                                      previewBtnText: 'Start Practice Set',
                                      previewIcon: '📝',
                                    },
                                    {
                                      id: 'DAILY' as const,
                                      title: 'Daily Challenge Card',
                                      emoji: '🚀',
                                      desc: 'Daily 100 MCQs timed test, leaderboard & live claim card',
                                      bgVal: localSettings.homeDailyChallengeCardBg,
                                      borderVal: localSettings.homeDailyChallengeCardBorder || '#f59e0b',
                                      is3D: localSettings.homeDailyChallengeCard3D !== undefined ? localSettings.homeDailyChallengeCard3D : localSettings.homeAllCards3D,
                                      onBgChange: (v?: string) => setLocalSettings({ ...localSettings, homeDailyChallengeCardBg: v }),
                                      onBorderChange: (v?: string) => setLocalSettings({ ...localSettings, homeDailyChallengeCardBorder: v }),
                                      on3DToggle: () => {
                                        const cur = localSettings.homeDailyChallengeCard3D !== undefined ? localSettings.homeDailyChallengeCard3D : localSettings.homeAllCards3D;
                                        setLocalSettings({ ...localSettings, homeDailyChallengeCard3D: !cur });
                                      },
                                      previewBadge: 'Daily Challenge · Live Test',
                                      previewTitle: 'Daily Challenge 2.0',
                                      previewChips: ['🎯 100 MCQs', '⏱️ 60 Min', '🏆 +100 XP'],
                                      previewBtnText: 'Start Daily Challenge',
                                      previewIcon: '🚀',
                                    },
                                    {
                                      id: 'ROOM' as const,
                                      title: 'Live Study Room Card',
                                      emoji: '👥',
                                      desc: 'Virtual study room with peers, pomodoro timer & live invite card',
                                      bgVal: localSettings.homeLiveRoomCardBg || localSettings.homeStudyRoomCardBg,
                                      borderVal: localSettings.homeLiveRoomCardBorder || localSettings.homeStudyRoomCardBorder || '#8b5cf6',
                                      is3D: localSettings.homeLiveRoomCard3D !== undefined ? localSettings.homeLiveRoomCard3D : (localSettings.homeStudyRoomCard3D !== undefined ? localSettings.homeStudyRoomCard3D : localSettings.homeAllCards3D),
                                      onBgChange: (v?: string) => setLocalSettings({ ...localSettings, homeLiveRoomCardBg: v, homeStudyRoomCardBg: v }),
                                      onBorderChange: (v?: string) => setLocalSettings({ ...localSettings, homeLiveRoomCardBorder: v, homeStudyRoomCardBorder: v }),
                                      on3DToggle: () => {
                                        const cur = localSettings.homeLiveRoomCard3D !== undefined ? localSettings.homeLiveRoomCard3D : (localSettings.homeStudyRoomCard3D || localSettings.homeAllCards3D);
                                        setLocalSettings({ ...localSettings, homeLiveRoomCard3D: !cur, homeStudyRoomCard3D: !cur });
                                      },
                                      previewBadge: 'Virtual Study · Peers',
                                      previewTitle: 'Live Study Room',
                                      previewChips: ['⏱️ Pomodoro Timer', '👥 Live Peers', '📢 1-Tap Invite'],
                                      previewBtnText: 'Join Study Room',
                                      previewIcon: '👥',
                                    },
                                    {
                                      id: 'REVISION' as const,
                                      title: 'Revision Hub Card',
                                      emoji: '💡',
                                      desc: 'Spaced repetition, quick notes memory engine & weak drill card',
                                      bgVal: localSettings.homeRevisionHubCardBg || localSettings.homeRevisionCardBg,
                                      borderVal: localSettings.homeRevisionHubCardBorder || localSettings.homeRevisionCardBorder || '#ec4899',
                                      is3D: localSettings.homeRevisionHubCard3D !== undefined ? localSettings.homeRevisionHubCard3D : (localSettings.homeRevisionCard3D !== undefined ? localSettings.homeRevisionCard3D : localSettings.homeAllCards3D),
                                      onBgChange: (v?: string) => setLocalSettings({ ...localSettings, homeRevisionHubCardBg: v, homeRevisionCardBg: v }),
                                      onBorderChange: (v?: string) => setLocalSettings({ ...localSettings, homeRevisionHubCardBorder: v, homeRevisionCardBorder: v }),
                                      on3DToggle: () => {
                                        const cur = localSettings.homeRevisionHubCard3D !== undefined ? localSettings.homeRevisionHubCard3D : (localSettings.homeRevisionCard3D || localSettings.homeAllCards3D);
                                        setLocalSettings({ ...localSettings, homeRevisionHubCard3D: !cur, homeRevisionCard3D: !cur });
                                      },
                                      previewBadge: 'Memory Engine · Drill',
                                      previewTitle: 'Revision Hub',
                                      previewChips: ['🧠 Spaced Repetition', '📝 Quick Notes', '🎯 Weak Drill'],
                                      previewBtnText: 'Open Revision Hub',
                                      previewIcon: '💡',
                                    },
                                    {
                                      id: 'MISTAKES' as const,
                                      title: 'My Mistakes Card',
                                      emoji: '❌',
                                      desc: 'Wrongly answered questions bank, instant re-test & review card',
                                      bgVal: localSettings.homeMistakesCardBg,
                                      borderVal: localSettings.homeMistakesCardBorder || '#ef4444',
                                      is3D: localSettings.homeMistakesCard3D !== undefined ? localSettings.homeMistakesCard3D : localSettings.homeAllCards3D,
                                      onBgChange: (v?: string) => setLocalSettings({ ...localSettings, homeMistakesCardBg: v }),
                                      onBorderChange: (v?: string) => setLocalSettings({ ...localSettings, homeMistakesCardBorder: v }),
                                      on3DToggle: () => {
                                        const cur = localSettings.homeMistakesCard3D !== undefined ? localSettings.homeMistakesCard3D : localSettings.homeAllCards3D;
                                        setLocalSettings({ ...localSettings, homeMistakesCard3D: !cur });
                                      },
                                      previewBadge: 'Weak Areas · Correction',
                                      previewTitle: 'My Mistakes Review',
                                      previewChips: ['❌ Wrong Answers', '🔄 Instant Re-test', '📈 Boost Accuracy'],
                                      previewBtnText: 'Fix My Mistakes',
                                      previewIcon: '❌',
                                    },
                                  ];

                                  const filteredCards = adminHomeCardTab === 'ALL'
                                    ? cardsConfig
                                    : cardsConfig.filter(c => c.id === adminHomeCardTab);

                                  const depthPx = localSettings.cardDepth3D === 'subtle' ? '2.5px' : localSettings.cardDepth3D === 'deep' ? '7px' : '4px';
                                  const liftPx = localSettings.cardDepth3D === 'subtle' ? '-1.5px' : localSettings.cardDepth3D === 'deep' ? '-3.5px' : '-2px';

                                  return (
                                    <div className="space-y-4">
                                      {filteredCards.map((c) => {
                                        const cardBorder = c.borderVal || '#3b82f6';
                                        const cardBg = c.bgVal || '#ffffff';
                                        return (
                                          <div key={c.id} className="p-3.5 bg-white rounded-2xl border border-indigo-100 shadow-xs space-y-3">
                                            {/* Card Title & 3D Toggle */}
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                                              <div>
                                                <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                                                  <span className="text-base">{c.emoji}</span>
                                                  <span>{c.title}</span>
                                                </h4>
                                                <p className="text-[10px] text-slate-500">{c.desc}</p>
                                              </div>
                                              <button
                                                type="button"
                                                onClick={c.on3DToggle}
                                                className={`px-3 py-1.5 rounded-xl text-[10px] font-black transition-all border shrink-0 cursor-pointer flex items-center gap-1 ${
                                                  c.is3D
                                                    ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                                                    : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200'
                                                }`}
                                              >
                                                <span>{c.is3D ? '🎲' : '⬜'}</span>
                                                <span>{c.is3D ? '3D ON (Raised)' : '2D FLAT'}</span>
                                              </button>
                                            </div>

                                            {/* Responsive Color Pickers */}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                              {/* Background Color */}
                                              <div className="space-y-1.5">
                                                <p className="text-[10px] font-bold text-slate-700">🎨 Card Background Color</p>
                                                <div className="flex items-center gap-1.5">
                                                  <input
                                                    type="color"
                                                    value={c.bgVal || '#ffffff'}
                                                    onChange={(e) => c.onBgChange(e.target.value)}
                                                    className="w-8 h-8 rounded-lg cursor-pointer border border-slate-200 shrink-0"
                                                  />
                                                  <input
                                                    type="text"
                                                    value={c.bgVal || ''}
                                                    onChange={(e) => c.onBgChange(e.target.value)}
                                                    placeholder="Default White"
                                                    className="flex-1 min-w-0 p-1.5 border rounded-lg text-[10px] uppercase font-mono bg-slate-50"
                                                  />
                                                  {c.bgVal && (
                                                    <button
                                                      type="button"
                                                      onClick={() => c.onBgChange(undefined)}
                                                      className="text-[10px] text-red-500 font-bold px-1.5 py-1 rounded hover:bg-red-50 shrink-0"
                                                    >
                                                      ✕
                                                    </button>
                                                  )}
                                                </div>
                                                <div className="flex gap-1 flex-wrap pt-0.5">
                                                  {['#ffffff', '#f8fafc', '#eff6ff', '#f0fdf4', '#fef3c7', '#fdf4ff', '#fff1f2', '#1e293b'].map((hex) => (
                                                    <button
                                                      key={hex}
                                                      type="button"
                                                      onClick={() => c.onBgChange(hex)}
                                                      className="w-5 h-5 rounded border transition-all hover:scale-110"
                                                      style={{ background: hex, borderColor: (c.bgVal || '#ffffff') === hex ? '#6366f1' : '#cbd5e1' }}
                                                      title={hex}
                                                    />
                                                  ))}
                                                </div>
                                              </div>

                                              {/* Border / 3D Outline Color */}
                                              <div className="space-y-1.5">
                                                <p className="text-[10px] font-bold text-slate-700">🖼️ Border / 3D Outline Color</p>
                                                <div className="flex items-center gap-1.5">
                                                  <input
                                                    type="color"
                                                    value={c.borderVal || '#3b82f6'}
                                                    onChange={(e) => c.onBorderChange(e.target.value)}
                                                    className="w-8 h-8 rounded-lg cursor-pointer border border-slate-200 shrink-0"
                                                  />
                                                  <input
                                                    type="text"
                                                    value={c.borderVal || ''}
                                                    onChange={(e) => c.onBorderChange(e.target.value)}
                                                    placeholder="Default Border"
                                                    className="flex-1 min-w-0 p-1.5 border rounded-lg text-[10px] uppercase font-mono bg-slate-50"
                                                  />
                                                  {c.borderVal && (
                                                    <button
                                                      type="button"
                                                      onClick={() => c.onBorderChange(undefined)}
                                                      className="text-[10px] text-red-500 font-bold px-1.5 py-1 rounded hover:bg-red-50 shrink-0"
                                                    >
                                                      ✕
                                                    </button>
                                                  )}
                                                </div>
                                                <div className="flex gap-1 flex-wrap pt-0.5">
                                                  {['#3b82f6', '#8b5cf6', '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#0f172a'].map((hex) => (
                                                    <button
                                                      key={hex}
                                                      type="button"
                                                      onClick={() => c.onBorderChange(hex)}
                                                      className="w-5 h-5 rounded border transition-all hover:scale-110"
                                                      style={{ background: hex, borderColor: c.borderVal === hex ? '#6366f1' : '#cbd5e1' }}
                                                      title={hex}
                                                    />
                                                  ))}
                                                </div>
                                              </div>
                                            </div>

                                            {/* Live Mini Card Preview with Real 3D Depth & Elevation */}
                                            <div className="pt-2 border-t border-slate-100">
                                              <div className="flex items-center justify-between mb-1.5">
                                                <span className="text-[9.5px] font-black text-slate-500 uppercase tracking-wider">
                                                  Live Card Preview (Home Screen Pe Aisa Dikhega)
                                                </span>
                                                <span className="text-[9px] font-bold text-slate-500">
                                                  {c.is3D ? `🎲 3D (${depthPx} Depth)` : '⬜ 2D Flat'}
                                                </span>
                                              </div>

                                              <div
                                                className="w-full relative overflow-hidden rounded-2xl text-left transition-all p-3.5 border cursor-default"
                                                style={{
                                                  background: localSettings.homeBackgroundImage ? 'transparent' : cardBg,
                                                  backgroundColor: localSettings.homeBackgroundImage ? 'transparent' : cardBg,
                                                  borderColor: cardBorder,
                                                  borderWidth: '2px',
                                                  boxShadow: c.is3D
                                                    ? `0 1px 0 rgba(255,255,255,0.85) inset, 0 ${depthPx} 0 ${cardBorder}bb, 0 calc(${depthPx} + 3px) 16px ${cardBorder}28`
                                                    : '0 4px 14px rgba(0,0,0,0.06)',
                                                  transform: c.is3D ? `translateY(${liftPx})` : 'none',
                                                }}
                                              >
                                                <div className="flex items-start justify-between gap-2.5">
                                                  <div className="flex-1 min-w-0 pr-1">
                                                    <div className="flex items-center gap-1.5 mb-1">
                                                      <span
                                                        className="px-2 py-0.5 rounded-full text-[8.5px] font-black uppercase tracking-wider shrink-0"
                                                        style={{
                                                          background: `${cardBorder}18`,
                                                          color: cardBorder,
                                                          border: `1px solid ${cardBorder}35`,
                                                        }}
                                                      >
                                                        {c.previewBadge}
                                                      </span>
                                                      <span className="px-1.5 py-0.2 rounded-full text-[8.5px] font-black bg-amber-400 text-amber-900 shadow-xs">
                                                        ⚡ Active
                                                      </span>
                                                    </div>
                                                    <h4 className="text-[16px] font-black leading-tight text-slate-900 mb-1">
                                                      {c.previewTitle}
                                                    </h4>
                                                    <div className="flex items-center flex-wrap gap-1">
                                                      {c.previewChips.map((chip, idx) => (
                                                        <span
                                                          key={idx}
                                                          className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-slate-100 border border-slate-200 text-slate-700"
                                                        >
                                                          {chip}
                                                        </span>
                                                      ))}
                                                    </div>
                                                  </div>
                                                  <div className="text-[32px] leading-none shrink-0 select-none pt-0.5">
                                                    {c.previewIcon}
                                                  </div>
                                                </div>

                                                {/* Bottom Action CTA */}
                                                <div className="mt-2.5 pt-2 border-t w-full border-slate-100">
                                                  <div
                                                    className="w-full py-1.5 px-3 rounded-xl text-[11px] font-black shadow-xs flex items-center justify-center gap-1 text-white"
                                                    style={{
                                                      background: `linear-gradient(135deg, ${cardBorder}, ${localSettings.themeColor || '#6366f1'})`,
                                                      boxShadow: `0 3px 10px ${cardBorder}35`,
                                                    }}
                                                  >
                                                    <span>{c.previewBtnText}</span>
                                                    <span>→</span>
                                                  </div>
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  );
                                })()}

                                {/* ── COLLAPSIBLE: LEGACY & SECONDARY CARDS ── */}
                                <details className="p-3 bg-white/90 rounded-xl border border-indigo-100 text-xs text-slate-700">
                                  <summary className="font-bold cursor-pointer text-indigo-700 hover:text-indigo-900">
                                    📋 Legacy Cards (School, Coaching & Content List) — Click to open
                                  </summary>
                                  <div className="mt-3 space-y-3 pt-2 border-t border-slate-100">
                                    {/* School Card */}
                                    <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50">
                                      <p className="text-[10px] font-black text-slate-700 mb-1">🏫 School Card (Legacy)</p>
                                      <div className="flex flex-col sm:flex-row gap-2">
                                        <div className="flex-1">
                                          <p className="text-[9px] text-slate-400 mb-0.5">Background</p>
                                          <div className="flex items-center gap-1.5">
                                            <input type="color" value={localSettings.homeSchoolCardBg || '#ffffff'} onChange={e => setLocalSettings({...localSettings, homeSchoolCardBg: e.target.value})} className="w-7 h-7 rounded cursor-pointer" />
                                            <input type="text" value={localSettings.homeSchoolCardBg || ''} onChange={e => setLocalSettings({...localSettings, homeSchoolCardBg: e.target.value})} placeholder="Default" className="flex-1 min-w-0 p-1 border rounded text-[9px] uppercase font-mono" />
                                          </div>
                                        </div>
                                        <div className="flex-1">
                                          <p className="text-[9px] text-slate-400 mb-0.5">Border</p>
                                          <div className="flex items-center gap-1.5">
                                            <input type="color" value={localSettings.homeSchoolCardBorder || '#6366f1'} onChange={e => setLocalSettings({...localSettings, homeSchoolCardBorder: e.target.value})} className="w-7 h-7 rounded cursor-pointer" />
                                            <input type="text" value={localSettings.homeSchoolCardBorder || ''} onChange={e => setLocalSettings({...localSettings, homeSchoolCardBorder: e.target.value})} placeholder="Default" className="flex-1 min-w-0 p-1 border rounded text-[9px] uppercase font-mono" />
                                          </div>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Coaching Card */}
                                    <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50">
                                      <p className="text-[10px] font-black text-slate-700 mb-1">🏫 Coaching Card (Legacy)</p>
                                      <div className="flex flex-col sm:flex-row gap-2">
                                        <div className="flex-1">
                                          <p className="text-[9px] text-slate-400 mb-0.5">Background</p>
                                          <div className="flex items-center gap-1.5">
                                            <input type="color" value={localSettings.homeCoachingCardBg || '#ffffff'} onChange={e => setLocalSettings({...localSettings, homeCoachingCardBg: e.target.value})} className="w-7 h-7 rounded cursor-pointer" />
                                            <input type="text" value={localSettings.homeCoachingCardBg || ''} onChange={e => setLocalSettings({...localSettings, homeCoachingCardBg: e.target.value})} placeholder="Default" className="flex-1 min-w-0 p-1 border rounded text-[9px] uppercase font-mono" />
                                          </div>
                                        </div>
                                        <div className="flex-1">
                                          <p className="text-[9px] text-slate-400 mb-0.5">Border</p>
                                          <div className="flex items-center gap-1.5">
                                            <input type="color" value={localSettings.homeCoachingCardBorder || '#6366f1'} onChange={e => setLocalSettings({...localSettings, homeCoachingCardBorder: e.target.value})} className="w-7 h-7 rounded cursor-pointer" />
                                            <input type="text" value={localSettings.homeCoachingCardBorder || ''} onChange={e => setLocalSettings({...localSettings, homeCoachingCardBorder: e.target.value})} placeholder="Default" className="flex-1 min-w-0 p-1 border rounded text-[9px] uppercase font-mono" />
                                          </div>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Book / Lesson List Card Colors */}
                                    <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50">
                                      <p className="text-[10px] font-black text-slate-700 mb-1">📋 Book / Lesson / Page List Cards</p>
                                      <div className="flex flex-col sm:flex-row gap-2">
                                        <div className="flex-1">
                                          <p className="text-[9px] text-slate-400 mb-0.5">Background</p>
                                          <div className="flex items-center gap-1.5">
                                            <input type="color" value={localSettings.contentListCardBg || '#ffffff'} onChange={e => setLocalSettings({...localSettings, contentListCardBg: e.target.value})} className="w-7 h-7 rounded cursor-pointer" />
                                            <input type="text" value={localSettings.contentListCardBg || ''} onChange={e => setLocalSettings({...localSettings, contentListCardBg: e.target.value})} placeholder="Default" className="flex-1 min-w-0 p-1 border rounded text-[9px] uppercase font-mono" />
                                          </div>
                                        </div>
                                        <div className="flex-1">
                                          <p className="text-[9px] text-slate-400 mb-0.5">Border</p>
                                          <div className="flex items-center gap-1.5">
                                            <input type="color" value={localSettings.contentListCardBorder || '#3b82f6'} onChange={e => setLocalSettings({...localSettings, contentListCardBorder: e.target.value})} className="w-7 h-7 rounded cursor-pointer" />
                                            <input type="text" value={localSettings.contentListCardBorder || ''} onChange={e => setLocalSettings({...localSettings, contentListCardBorder: e.target.value})} placeholder="Default" className="flex-1 min-w-0 p-1 border rounded text-[9px] uppercase font-mono" />
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </details>
                              </div>

'''

new_content = content[:start_idx] + new_block + content[end_idx:]

with open('artifacts/iic-study-app-replit/src/components/AdminDashboard.tsx', 'w') as f:
    f.write(new_content)

print('AdminDashboard updated successfully!')
