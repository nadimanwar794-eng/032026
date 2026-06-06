// @ts-nocheck
import React, { useState } from 'react';
import { SystemSettings, FeatureCategory } from '../types';
import { DollarSign, Eye, EyeOff, Save, Search, Settings, Lock, Package, Trash2, Edit3, X, Plus, Crown, LayoutGrid, List, CheckSquare, Gamepad2, BrainCircuit, Activity, BarChart3, Star, Zap, PenTool, Banknote, Layers, Bell, Ticket, Flame, Video, GraduationCap, ShoppingBag, Home as HomeIcon, Navigation, TrendingUp } from 'lucide-react';
import { ALL_FEATURES } from '../utils/featureRegistry';
import { getLevelDailyLimits, LEVEL_INFO, MAX_LEVEL } from '../utils/levelSystem';

interface Props {
    settings: SystemSettings;
    onUpdate: (s: SystemSettings) => void;
}

export const AdminPowerManager: React.FC<Props> = ({ settings, onUpdate }) => {
    const [activeTab, setActiveTab] = useState<'PRICING' | 'DAILY_LIMITS' | 'LEVEL_LIMITS' | 'VISIBILITY' | 'TOPBAR' | 'BOTTOMNAV' | 'HOMEGRID' | 'SCORE_THRESHOLDS'>('PRICING');
    const [selectedLevel, setSelectedLevel] = useState<number>(1);
    const [localSettings, setLocalSettings] = useState<SystemSettings>(settings);

    const updateSetting = (key: keyof SystemSettings, value: any) => {
        const newSettings = { ...localSettings, [key]: value };
        setLocalSettings(newSettings);
        onUpdate(newSettings);
    };

    // Helper: toggle item in a hidden-list array setting
    const toggleHidden = (key: 'hiddenTopBarButtons' | 'hiddenBottomNavButtons' | 'hiddenHomeButtons', id: string) => {
        const current = (localSettings[key] as string[]) || [];
        const updated = current.includes(id) ? current.filter(x => x !== id) : [...current, id];
        updateSetting(key, updated);
    };

    // Top bar buttons we expose for hiding
    const TOPBAR_BUTTONS = [
        { id: 'STREAK', label: 'Streak Badge', Icon: Flame, hint: 'The 🔥 day-counter chip' },
        { id: 'CREDITS', label: 'Credits Chip', Icon: Crown, hint: '"50 CR" coin balance pill' },
        { id: 'LIGHTNING', label: 'Lightning ⚡', Icon: Zap, hint: 'Custom Page / Updates button' },
        { id: 'NOTIFICATION', label: 'Notification 🔔', Icon: Bell, hint: 'Bell icon with red dot' },
        { id: 'SALE', label: 'Sale Discount Chip', Icon: Ticket, hint: 'Special offer "% OFF" badge' },
    ];

    // Bottom nav slots we expose for hiding
    const BOTTOM_NAV_BUTTONS = [
        { id: 'HOMEWORK', label: 'Homework', Icon: GraduationCap, hint: 'Shown when active homework exists' },
        { id: 'REVISION_V2', label: 'Revision Hub', Icon: BrainCircuit, hint: 'Brain-circuit icon — Revision tab' },
        { id: 'GK', label: 'Important', Icon: Star, hint: 'Star icon — opens Important Notes' },
        { id: 'VIDEO', label: 'Video', Icon: Video, hint: 'When video is in bottom nav (not top bar)' },
        { id: 'PROFILE', label: 'Profile', Icon: Crown, hint: 'When video is moved to top bar' },
        { id: 'APP_STORE', label: 'Apps Store', Icon: ShoppingBag, hint: 'Apps marketplace tab' },
    ];

    // Home grid features (Layer 1+2 features — student-facing dashboard buttons)
    const HOME_GRID_FEATURES = ALL_FEATURES.filter(f => (f.surfaceLevel === 1 || f.surfaceLevel === 2) && !f.requiresSuperAdmin);

    return (
        <div className="p-6 bg-white min-h-[500px]">
            {/* TABS */}
            <div className="flex flex-wrap gap-2 mb-6 bg-slate-100 p-1.5 rounded-xl">
                {[
                    { id: 'PRICING', icon: DollarSign, label: 'Pricing & Costs' },
                    { id: 'DAILY_LIMITS', icon: BarChart3, label: 'Daily Limits' },
                    { id: 'LEVEL_LIMITS', icon: TrendingUp, label: 'Level Limits' },
                    { id: 'VISIBILITY', icon: Eye, label: 'Modules' },
                    { id: 'TOPBAR', icon: Crown, label: 'Top Bar' },
                    { id: 'BOTTOMNAV', icon: Navigation, label: 'Bottom Nav' },
                    { id: 'HOMEGRID', icon: HomeIcon, label: 'Home Grid' },
                    { id: 'SCORE_THRESHOLDS', icon: Star, label: 'Score Thresholds' },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === tab.id ? 'bg-white shadow text-slate-800' : 'text-slate-600 hover:bg-white/50'}`}
                    >
                        <tab.icon size={14} /> {tab.label}
                    </button>
                ))}
            </div>

            {/* TAB 1: PRICING */}
            {activeTab === 'PRICING' && (
                <div className="space-y-6">
                    {/* GLOBAL COSTS */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <h4 className="font-bold text-slate-800 text-sm mb-4 flex items-center gap-2"><DollarSign size={16} /> Content Credit Costs (0 = Free)</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                             {[
                                { key: 'defaultPdfCost', label: 'PDF Access', default: 5 },
                                { key: 'defaultVideoCost', label: 'Video Access', default: 5 },
                                { key: 'mcqTestCost', label: 'MCQ Test Entry', default: 2 },
                                { key: 'mcqAnalysisCost', label: 'MCQ Analysis', default: 5 },
                                { key: 'mcqAnalysisCostUltra', label: 'Ultra Analysis', default: 20 },
                                { key: 'mcqHistoryCost', label: 'History View', default: 1 },
                                { key: 'chatCost', label: 'AI Chat Msg', default: 1 },
                                { key: 'gameCost', label: 'Spin Wheel', default: 0 },
                            ].map((item) => (
                                <div key={item.key} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                                    <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">{item.label}</label>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs">🪙</span>
                                        <input
                                            type="number"
                                            // @ts-ignore
                                            value={localSettings[item.key] !== undefined ? localSettings[item.key] : item.default}
                                            onChange={(e) => updateSetting(item.key as keyof SystemSettings, Number(e.target.value))}
                                            className="w-full p-1.5 border rounded font-bold text-sm"
                                            min="0"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB: DAILY LIMITS */}
            {activeTab === 'DAILY_LIMITS' && (
                <div className="space-y-5">
                    <p className="text-[11px] text-slate-500 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 font-medium">
                        ⚠️ Yahan changes karne par sab students pe turant effect hoga. Save karna mat bhoolein.
                    </p>

                    {/* WRITE MODE LIMITS */}
                    <div className="bg-teal-50 border border-teal-200 rounded-xl p-4">
                        <h4 className="font-black text-teal-800 text-sm mb-1 flex items-center gap-2">✍️ Write Mode (HTML Notes)</h4>
                        <p className="text-[10px] text-teal-600 mb-3">Free views/day per plan aur credit system config</p>
                        <div className="grid grid-cols-3 gap-3 mb-3">
                            <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                                <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Free (0 free)</label>
                                <p className="text-[10px] text-slate-500">Always credits-only</p>
                            </div>
                            <div className="bg-white p-3 rounded-lg border border-sky-200 shadow-sm">
                                <label className="text-[9px] font-black text-sky-600 uppercase block mb-1">Basic Free/Day</label>
                                <input type="number" min="0"
                                    value={localSettings.basicHtmlDailyLimit ?? 5}
                                    onChange={e => updateSetting('basicHtmlDailyLimit', Number(e.target.value))}
                                    className="w-full p-1.5 border rounded font-bold text-sm" />
                            </div>
                            <div className="bg-white p-3 rounded-lg border border-violet-200 shadow-sm">
                                <label className="text-[9px] font-black text-violet-600 uppercase block mb-1">Ultra Free/Day</label>
                                <input type="number" min="0"
                                    value={localSettings.ultraHtmlDailyLimit ?? 10}
                                    onChange={e => updateSetting('ultraHtmlDailyLimit', Number(e.target.value))}
                                    className="w-full p-1.5 border rounded font-bold text-sm" />
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                                <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Credit Cost (Free user)</label>
                                <input type="number" min="1"
                                    value={localSettings.htmlUnlockCost ?? 5}
                                    onChange={e => updateSetting('htmlUnlockCost', Number(e.target.value))}
                                    className="w-full p-1.5 border rounded font-bold text-sm" />
                            </div>
                            <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                                <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Credit Cost (Paid, after free)</label>
                                <input type="number" min="1"
                                    value={(localSettings as any).writeModeCreditPaid ?? 10}
                                    onChange={e => updateSetting('writeModeCreditPaid' as any, Number(e.target.value))}
                                    className="w-full p-1.5 border rounded font-bold text-sm" />
                            </div>
                            <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                                <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Max Credit Unlocks/Day</label>
                                <input type="number" min="1"
                                    value={(localSettings as any).writeModeMaxLimit ?? 100}
                                    onChange={e => updateSetting('writeModeMaxLimit' as any, Number(e.target.value))}
                                    className="w-full p-1.5 border rounded font-bold text-sm" />
                            </div>
                        </div>
                    </div>

                    {/* MCQ LIMITS */}
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                        <h4 className="font-black text-amber-800 text-sm mb-1 flex items-center gap-2">📝 MCQ Practice (Daily Limit)</h4>
                        <p className="text-[10px] text-amber-600 mb-3">Har plan ke liye daily MCQ questions limit</p>
                        <div className="grid grid-cols-3 gap-3">
                            <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                                <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Free/Day</label>
                                <input type="number" min="1"
                                    value={localSettings.mcqLimitFree ?? 50}
                                    onChange={e => updateSetting('mcqLimitFree', Number(e.target.value))}
                                    className="w-full p-1.5 border rounded font-bold text-sm" />
                            </div>
                            <div className="bg-white p-3 rounded-lg border border-sky-200 shadow-sm">
                                <label className="text-[9px] font-black text-sky-600 uppercase block mb-1">Basic/Day</label>
                                <input type="number" min="1"
                                    value={localSettings.mcqLimitBasic ?? 70}
                                    onChange={e => updateSetting('mcqLimitBasic', Number(e.target.value))}
                                    className="w-full p-1.5 border rounded font-bold text-sm" />
                            </div>
                            <div className="bg-white p-3 rounded-lg border border-violet-200 shadow-sm">
                                <label className="text-[9px] font-black text-violet-600 uppercase block mb-1">Ultra/Day</label>
                                <input type="number" min="1"
                                    value={localSettings.mcqLimitUltra ?? 100}
                                    onChange={e => updateSetting('mcqLimitUltra', Number(e.target.value))}
                                    className="w-full p-1.5 border rounded font-bold text-sm" />
                            </div>
                        </div>
                    </div>

                    {/* HTML DOWNLOADS LIMITS */}
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                        <h4 className="font-black text-blue-800 text-sm mb-1 flex items-center gap-2">📥 HTML Downloads (Daily Limit)</h4>
                        <p className="text-[10px] text-blue-600 mb-3">Notes download limit per plan per day</p>
                        <div className="grid grid-cols-3 gap-3">
                            <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                                <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Free/Day</label>
                                <input type="number" min="0"
                                    value={(localSettings as any).htmlDownloadLimitFree ?? 2}
                                    onChange={e => updateSetting('htmlDownloadLimitFree' as any, Number(e.target.value))}
                                    className="w-full p-1.5 border rounded font-bold text-sm" />
                            </div>
                            <div className="bg-white p-3 rounded-lg border border-sky-200 shadow-sm">
                                <label className="text-[9px] font-black text-sky-600 uppercase block mb-1">Basic/Day</label>
                                <input type="number" min="0"
                                    value={(localSettings as any).htmlDownloadLimitBasic ?? 5}
                                    onChange={e => updateSetting('htmlDownloadLimitBasic' as any, Number(e.target.value))}
                                    className="w-full p-1.5 border rounded font-bold text-sm" />
                            </div>
                            <div className="bg-white p-3 rounded-lg border border-violet-200 shadow-sm">
                                <label className="text-[9px] font-black text-violet-600 uppercase block mb-1">Ultra/Day</label>
                                <input type="number" min="0"
                                    value={(localSettings as any).htmlDownloadLimitUltra ?? 10}
                                    onChange={e => updateSetting('htmlDownloadLimitUltra' as any, Number(e.target.value))}
                                    className="w-full p-1.5 border rounded font-bold text-sm" />
                            </div>
                        </div>
                    </div>

                    {/* VIDEO LIMITS */}
                    <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
                        <h4 className="font-black text-rose-800 text-sm mb-1 flex items-center gap-2">🎬 Video Lectures</h4>
                        <p className="text-[10px] text-rose-600 mb-3">Free videos/day (Basic & Ultra). Free users always pay coins.</p>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-white p-3 rounded-lg border border-sky-200 shadow-sm">
                                <label className="text-[9px] font-black text-sky-600 uppercase block mb-1">Basic Free/Day</label>
                                <input type="number" min="0"
                                    value={localSettings.videoFreeLimitBasic ?? 5}
                                    onChange={e => updateSetting('videoFreeLimitBasic', Number(e.target.value))}
                                    className="w-full p-1.5 border rounded font-bold text-sm" />
                            </div>
                            <div className="bg-white p-3 rounded-lg border border-violet-200 shadow-sm">
                                <label className="text-[9px] font-black text-violet-600 uppercase block mb-1">Ultra Free/Day</label>
                                <input type="number" min="0"
                                    value={(localSettings as any).videoFreeLimitUltra ?? 10}
                                    onChange={e => updateSetting('videoFreeLimitUltra' as any, Number(e.target.value))}
                                    className="w-full p-1.5 border rounded font-bold text-sm" />
                            </div>
                        </div>
                    </div>

                    {/* PDF LIMITS */}
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                        <h4 className="font-black text-emerald-800 text-sm mb-1 flex items-center gap-2">📄 PDF / Notes Access</h4>
                        <p className="text-[10px] text-emerald-600 mb-3">Free PDF accesses/day (Basic & Ultra). Free users always pay coins.</p>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-white p-3 rounded-lg border border-sky-200 shadow-sm">
                                <label className="text-[9px] font-black text-sky-600 uppercase block mb-1">Basic Free/Day</label>
                                <input type="number" min="0"
                                    value={localSettings.pdfFreeLimitBasic ?? 5}
                                    onChange={e => updateSetting('pdfFreeLimitBasic', Number(e.target.value))}
                                    className="w-full p-1.5 border rounded font-bold text-sm" />
                            </div>
                            <div className="bg-white p-3 rounded-lg border border-violet-200 shadow-sm">
                                <label className="text-[9px] font-black text-violet-600 uppercase block mb-1">Ultra Free/Day</label>
                                <input type="number" min="0"
                                    value={(localSettings as any).pdfFreeLimitUltra ?? 10}
                                    onChange={e => updateSetting('pdfFreeLimitUltra' as any, Number(e.target.value))}
                                    className="w-full p-1.5 border rounded font-bold text-sm" />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB: LEVEL LIMITS */}
            {activeTab === 'LEVEL_LIMITS' && (() => {
                const lvlOverride = (localSettings.levelLimitsOverride || {}) as Record<string, any>;
                const baseLD = getLevelDailyLimits(selectedLevel);
                const ov = lvlOverride[String(selectedLevel)] || {};

                const getVal = (feature: string, tier: 'free' | 'basic' | 'ultra'): number => {
                    const ovFeature = ov[feature];
                    if (ovFeature && ovFeature[tier] !== undefined) return ovFeature[tier];
                    return (baseLD as any)[feature]?.[tier] ?? 0;
                };
                const getSingle = (key: string): number => {
                    if (ov[key] !== undefined) return ov[key];
                    return (baseLD as any)[key] ?? 0;
                };

                const updateLevelVal = (feature: string, tier: string, value: number) => {
                    const newOv = { ...lvlOverride };
                    if (!newOv[String(selectedLevel)]) newOv[String(selectedLevel)] = {};
                    if (!newOv[String(selectedLevel)][feature]) newOv[String(selectedLevel)][feature] = {};
                    newOv[String(selectedLevel)][feature][tier] = value;
                    updateSetting('levelLimitsOverride', newOv);
                };
                const updateLevelSingle = (key: string, value: number) => {
                    const newOv = { ...lvlOverride };
                    if (!newOv[String(selectedLevel)]) newOv[String(selectedLevel)] = {};
                    newOv[String(selectedLevel)][key] = value;
                    updateSetting('levelLimitsOverride', newOv);
                };
                const resetLevel = () => {
                    const newOv = { ...lvlOverride };
                    delete newOv[String(selectedLevel)];
                    updateSetting('levelLimitsOverride', newOv);
                };
                const hasOverride = !!lvlOverride[String(selectedLevel)];

                const currentLvlInfo = LEVEL_INFO.find(l => l.level === selectedLevel)!;

                type FeatureRow = { key: string; label: string; icon: string; hasTiers: boolean; tiers?: ('free'|'basic'|'ultra')[]; singleKey?: string; singleLabel?: string };
                const featureRows: FeatureRow[] = [
                    { key: 'mcq',   label: 'MCQ Practice',       icon: '❓', hasTiers: true,  tiers: ['free', 'basic', 'ultra'] },
                    { key: 'dl',    label: 'HTML Downloads',      icon: '📥', hasTiers: true,  tiers: ['free', 'basic', 'ultra'] },
                    { key: 'pdf',   label: 'PDF / Notes',         icon: '📄', hasTiers: true,  tiers: ['free', 'basic', 'ultra'] },
                    { key: 'video', label: 'Video Lectures',      icon: '🎬', hasTiers: true,  tiers: ['free', 'basic', 'ultra'] },
                    { key: 'notes', label: 'Notes Reading',       icon: '📖', hasTiers: true,  tiers: ['free', 'basic', 'ultra'] },
                    { key: 'tts',   label: 'Audio / TTS',         icon: '🔊', hasTiers: true,  tiers: ['free', 'basic', 'ultra'] },
                    { key: 'write', label: 'Write Mode (Free)',   icon: '✍️', hasTiers: true,  tiers: ['free', 'basic', 'ultra'] },
                    { key: 'creditWriteMax',    label: 'Write Mode Max (Credit)',  icon: '💎', hasTiers: false, singleKey: 'creditWriteMax',    singleLabel: 'Max/Day' },
                    { key: 'bonusLoginCredits', label: 'Daily Login Bonus CR',     icon: '💰', hasTiers: false, singleKey: 'bonusLoginCredits', singleLabel: 'Bonus CR' },
                ];

                const tierColors = { free: 'border-slate-300 text-slate-600', basic: 'border-sky-300 text-sky-600', ultra: 'border-violet-300 text-violet-600' };
                const tierLabels = { free: '🆓 Free', basic: '🔵 Basic', ultra: '⚡ Ultra' };

                return (
                    <div className="space-y-4">
                        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3">
                            <p className="text-[11px] font-black text-indigo-800 mb-1">📊 Level-wise Daily Limits Override</p>
                            <p className="text-[10px] text-indigo-600">Har level aur subscription tier ka alag limit set karo. Default values level system se aate hain.</p>
                        </div>

                        {/* Level selector */}
                        <div className="flex flex-wrap gap-2">
                            {LEVEL_INFO.map(li => (
                                <button key={li.level} onClick={() => setSelectedLevel(li.level)}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-black border-2 transition-all ${selectedLevel === li.level ? 'shadow-md text-white border-transparent' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}
                                    style={selectedLevel === li.level ? { background: li.color, borderColor: li.color } : {}}>
                                    {li.emoji} L{li.level}
                                    {lvlOverride[String(li.level)] && <span className="ml-1 text-[8px]">✏️</span>}
                                </button>
                            ))}
                        </div>

                        {/* Selected level header */}
                        <div className="flex items-center justify-between p-3 rounded-xl border-2"
                            style={{ borderColor: `${currentLvlInfo.color}60`, background: `${currentLvlInfo.color}10` }}>
                            <div className="flex items-center gap-2">
                                <span className="text-2xl">{currentLvlInfo.emoji}</span>
                                <div>
                                    <p className="text-sm font-black" style={{ color: currentLvlInfo.color }}>Level {selectedLevel} · {currentLvlInfo.label}</p>
                                    <p className="text-[10px] text-slate-500">Min Score: {currentLvlInfo.minScore.toLocaleString('en-IN')} pts</p>
                                </div>
                            </div>
                            {hasOverride && (
                                <button onClick={resetLevel} className="text-[10px] font-black text-red-500 border border-red-200 bg-red-50 px-2 py-1 rounded-lg hover:bg-red-100">
                                    ↩ Reset to Default
                                </button>
                            )}
                        </div>

                        {/* Feature rows */}
                        <div className="space-y-3">
                            {featureRows.map(row => (
                                <div key={row.key} className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-base">{row.icon}</span>
                                        <p className="text-xs font-black text-slate-700">{row.label}</p>
                                        {row.hasTiers && (
                                            <span className="text-[8px] text-slate-400 font-medium ml-auto">
                                                Default: {row.tiers!.map(t => `${t[0].toUpperCase()}=${(baseLD as any)[row.key]?.[t] ?? '—'}`).join(' / ')}
                                            </span>
                                        )}
                                        {!row.hasTiers && (
                                            <span className="text-[8px] text-slate-400 font-medium ml-auto">Default: {(baseLD as any)[row.singleKey!] ?? '—'}</span>
                                        )}
                                    </div>
                                    {row.hasTiers ? (
                                        <div className="grid grid-cols-3 gap-2">
                                            {row.tiers!.map(tier => (
                                                <div key={tier} className={`bg-white p-2 rounded-lg border ${tierColors[tier]} shadow-sm`}>
                                                    <label className={`text-[9px] font-black uppercase block mb-1 ${tierColors[tier].split(' ')[1]}`}>{tierLabels[tier]}</label>
                                                    <input type="number" min="0" max="9999"
                                                        value={getVal(row.key, tier)}
                                                        onChange={e => updateLevelVal(row.key, tier, Number(e.target.value))}
                                                        className="w-full p-1.5 border border-slate-200 rounded font-bold text-sm text-center" />
                                                    <p className="text-[7px] text-slate-400 text-center mt-0.5">9999 = Unlimited</p>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="max-w-[140px]">
                                            <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">{row.singleLabel}</label>
                                            <input type="number" min="0"
                                                value={getSingle(row.singleKey!)}
                                                onChange={e => updateLevelSingle(row.singleKey!, Number(e.target.value))}
                                                className="w-full p-1.5 border border-slate-200 rounded font-bold text-sm text-center" />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Copy from level */}
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                            <p className="text-[10px] font-black text-amber-800">💡 Tip: 9999 enter karo = Unlimited. Changes turant save hote hain. Ek level change karne ke baad doosra level select karo.</p>
                        </div>
                    </div>
                );
            })()}

            {/* TAB 2: VISIBILITY */}
            {activeTab === 'VISIBILITY' && (
                <div className="space-y-6">
                     <div className="p-4 border rounded-xl bg-slate-50 col-span-1 md:col-span-2">
                         <h4 className="font-bold text-slate-700 text-sm mb-4">Module Visibility</h4>
                         <div className="flex flex-wrap gap-4">
                             {[
                                 {key: 'isChatEnabled', label: 'Chat Module'},
                                 {key: 'isGameEnabled', label: 'Game Module'},
                                 {key: 'isPaymentEnabled', label: 'Payment Gateway'},
                                 {key: 'allowSignup', label: 'Allow Signups'},
                             ].map(mod => (
                                 <label key={mod.key} className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border shadow-sm cursor-pointer hover:bg-slate-50">
                                     <input
                                        type="checkbox"
                                        // @ts-ignore
                                        checked={localSettings[mod.key] !== false}
                                        onChange={e => updateSetting(mod.key as keyof SystemSettings, e.target.checked)}
                                        className="accent-green-600 w-4 h-4"
                                     />
                                     <span className="text-xs font-bold text-slate-700">{mod.label}</span>
                                 </label>
                             ))}
                         </div>
                     </div>
                </div>
            )}

            {/* TAB 3: TOP BAR — per-button hide/unhide */}
            {activeTab === 'TOPBAR' && (
                <div className="space-y-3">
                    <div className="p-4 rounded-xl bg-gradient-to-br from-amber-50 to-white border border-amber-200">
                        <h4 className="font-black text-slate-800 text-sm mb-1 flex items-center gap-2">
                            <Crown size={16} className="text-amber-600" /> Top Bar Buttons
                        </h4>
                        <p className="text-[11px] text-slate-600 mb-4">
                            Har button ko alag se hide ya show kar sakte hain. Greyed-out = hidden from students.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {TOPBAR_BUTTONS.map(btn => {
                                const isHidden = (localSettings.hiddenTopBarButtons || []).includes(btn.id);
                                return (
                                    <button
                                        key={btn.id}
                                        onClick={() => toggleHidden('hiddenTopBarButtons', btn.id)}
                                        className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${isHidden ? 'bg-slate-50 border-slate-200 opacity-60' : 'bg-white border-amber-300 shadow-sm hover:shadow-md'}`}
                                    >
                                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isHidden ? 'bg-slate-200 text-slate-400' : 'bg-amber-100 text-amber-700'}`}>
                                            <btn.Icon size={16} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs font-black text-slate-800">{btn.label}</div>
                                            <div className="text-[10px] text-slate-500 truncate">{btn.hint}</div>
                                        </div>
                                        <div className={`shrink-0 w-9 h-5 rounded-full p-0.5 transition-all ${isHidden ? 'bg-slate-300' : 'bg-emerald-500'}`}>
                                            <div className={`w-4 h-4 rounded-full bg-white shadow transition-all ${isHidden ? '' : 'translate-x-4'}`} />
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 4: BOTTOM NAV — per-slot hide/unhide */}
            {activeTab === 'BOTTOMNAV' && (
                <div className="space-y-3">
                    <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-white border border-blue-200">
                        <h4 className="font-black text-slate-800 text-sm mb-1 flex items-center gap-2">
                            <Navigation size={16} className="text-blue-600" /> Bottom Navigation Slots
                        </h4>
                        <p className="text-[11px] text-slate-600 mb-4">
                            Hide karne par baki buttons automatically slide ho jaayenge.
                            <span className="font-bold"> Home button hamesha visible rehta hai.</span>
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {BOTTOM_NAV_BUTTONS.map(btn => {
                                const isHidden = (localSettings.hiddenBottomNavButtons || []).includes(btn.id);
                                return (
                                    <button
                                        key={btn.id}
                                        onClick={() => toggleHidden('hiddenBottomNavButtons', btn.id)}
                                        className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${isHidden ? 'bg-slate-50 border-slate-200 opacity-60' : 'bg-white border-blue-300 shadow-sm hover:shadow-md'}`}
                                    >
                                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isHidden ? 'bg-slate-200 text-slate-400' : 'bg-blue-100 text-blue-700'}`}>
                                            <btn.Icon size={16} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs font-black text-slate-800">{btn.label}</div>
                                            <div className="text-[10px] text-slate-500 truncate">{btn.hint}</div>
                                        </div>
                                        <div className={`shrink-0 w-9 h-5 rounded-full p-0.5 transition-all ${isHidden ? 'bg-slate-300' : 'bg-emerald-500'}`}>
                                            <div className={`w-4 h-4 rounded-full bg-white shadow transition-all ${isHidden ? '' : 'translate-x-4'}`} />
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 5: HOME GRID — feature buttons on home page */}
            {activeTab === 'HOMEGRID' && (
                <div className="space-y-3">
                    <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-white border border-emerald-200">
                        <h4 className="font-black text-slate-800 text-sm mb-1 flex items-center gap-2">
                            <HomeIcon size={16} className="text-emerald-600" /> Home Page Buttons
                        </h4>
                        <p className="text-[11px] text-slate-600 mb-4">
                            Sabhi home grid feature buttons. Hide karne par yeh button student ke home par nahi dikhega.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[480px] overflow-y-auto pr-1">
                            {HOME_GRID_FEATURES.map(f => {
                                const isHidden = (localSettings.hiddenHomeButtons || []).includes(f.id) || (localSettings.hiddenFeatures || []).includes(f.id);
                                return (
                                    <button
                                        key={f.id}
                                        onClick={() => toggleHidden('hiddenHomeButtons', f.id)}
                                        className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${isHidden ? 'bg-slate-50 border-slate-200 opacity-60' : 'bg-white border-emerald-300 shadow-sm hover:shadow-md'}`}
                                    >
                                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isHidden ? 'bg-slate-200 text-slate-400' : 'bg-emerald-100 text-emerald-700'}`}>
                                            {isHidden ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs font-black text-slate-800 truncate">{f.label}</div>
                                            <div className="text-[10px] text-slate-500 truncate">{f.description || f.id}</div>
                                        </div>
                                        <div className={`shrink-0 w-9 h-5 rounded-full p-0.5 transition-all ${isHidden ? 'bg-slate-300' : 'bg-emerald-500'}`}>
                                            <div className={`w-4 h-4 rounded-full bg-white shadow transition-all ${isHidden ? '' : 'translate-x-4'}`} />
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                        <p className="text-[10px] text-slate-500 mt-3 italic">
                            Tip: Aap pre-existing "Hidden Features" list ka bhi use kar sakte hain (yeh dono respect kiye jaate hain).
                        </p>
                    </div>
                </div>
            )}

            {/* TAB: SCORE THRESHOLDS */}
            {activeTab === 'SCORE_THRESHOLDS' && (
                <div className="space-y-3">
                    <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-5 rounded-2xl border border-amber-200 space-y-4">
                        <div>
                            <h4 className="font-black text-amber-900 flex items-center gap-2 text-sm">
                                <Star size={16} className="text-amber-600" /> Level Score Thresholds
                            </h4>
                            <p className="text-[11px] text-amber-700 mt-0.5">Har level ke liye minimum score set karo. Khali chhodo = default system value use hogi.</p>
                        </div>
                        <div className="grid grid-cols-1 gap-2 max-h-[420px] overflow-y-auto pr-1">
                            {[
                                {level:1,label:'Beginner',emoji:'🌱',def:0},
                                {level:2,label:'Apprentice',emoji:'🌿',def:200},
                                {level:3,label:'Explorer',emoji:'🔍',def:500},
                                {level:4,label:'Scholar',emoji:'✨',def:1000},
                                {level:5,label:'Expert',emoji:'⚡',def:5000},
                                {level:6,label:'Veteran',emoji:'🔥',def:10000},
                                {level:7,label:'Master',emoji:'💫',def:20000},
                                {level:8,label:'GrandMaster',emoji:'💎',def:50000},
                                {level:9,label:'Titan',emoji:'🌟',def:100000},
                                {level:10,label:'Mythic',emoji:'👑',def:500000},
                                {level:11,label:'Supreme',emoji:'🏆',def:2500000},
                                {level:12,label:'Legend',emoji:'🔮',def:5000000},
                                {level:13,label:'Immortal',emoji:'⚜️',def:10000000},
                                {level:14,label:'Divine',emoji:'🌠',def:20000000},
                                {level:15,label:'Absolute',emoji:'💠',def:50000000},
                            ].map(({level, label, emoji, def}) => {
                                const cur = (localSettings.levelScoreOverride as any)?.[String(level)];
                                return (
                                    <div key={level} className="flex items-center gap-3 bg-white rounded-xl px-3 py-2 border border-amber-100 shadow-sm">
                                        <span className="text-lg w-7 text-center">{emoji}</span>
                                        <div className="w-20 shrink-0">
                                            <p className="text-xs font-bold text-slate-700">L{level} {label}</p>
                                            <p className="text-[10px] text-slate-400">Default: {def.toLocaleString()}</p>
                                        </div>
                                        <input
                                            type="number"
                                            min={0}
                                            value={cur ?? ''}
                                            placeholder={String(def)}
                                            onChange={e => {
                                                const val = e.target.value;
                                                const overrides = {...((localSettings.levelScoreOverride as any) || {})};
                                                if (val === '' || val === undefined) {
                                                    delete overrides[String(level)];
                                                } else {
                                                    overrides[String(level)] = Number(val);
                                                }
                                                const updated = { ...localSettings, levelScoreOverride: overrides };
                                                setLocalSettings(updated);
                                                onUpdate(updated);
                                            }}
                                            className="flex-1 p-2 border rounded-lg text-sm font-bold text-right focus:outline-none focus:border-amber-400"
                                        />
                                        {cur !== undefined && (
                                            <button onClick={() => {
                                                const overrides = {...((localSettings.levelScoreOverride as any) || {})};
                                                delete overrides[String(level)];
                                                const updated = { ...localSettings, levelScoreOverride: overrides };
                                                setLocalSettings(updated);
                                                onUpdate(updated);
                                            }} className="text-[10px] text-red-400 hover:text-red-600 shrink-0 font-bold">Reset</button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        <button
                            onClick={() => {
                                const updated = { ...localSettings, levelScoreOverride: {} };
                                setLocalSettings(updated);
                                onUpdate(updated);
                            }}
                            className="w-full py-2 rounded-xl border border-amber-200 text-amber-700 text-xs font-bold hover:bg-amber-50 transition-all"
                        >
                            Reset All Levels to Default
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
