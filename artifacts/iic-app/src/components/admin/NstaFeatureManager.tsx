
import React, { useState, useEffect } from 'react';
import { SystemSettings } from '../../types';
import { NSTA_DEFAULT_FEATURES } from '../../constants';
import { Save, Lock, Zap, CheckCircle, Settings, Plus, Trash2, RotateCcw, BrainCircuit, Palette, ChevronDown, ChevronUp } from 'lucide-react';
import { ADMIN_NAMED_THEMES } from '../../utils/tierTheme';
import { LEVEL_INFO } from '../../utils/levelSystem';

interface Props {
    settings: SystemSettings;
    onUpdateSettings: (s: SystemSettings) => void;
    onBack: () => void;
}

export const NstaFeatureManager: React.FC<Props> = ({ settings, onUpdateSettings, onBack }) => {
    // Initialize config from settings (if exists) or merge with NSTA defaults
    const [config, setConfig] = useState<any[]>(() => {
        const storedConfig = settings.featureConfig || {};

        // Merge stored config with NSTA defaults to ensure all keys exist
        return NSTA_DEFAULT_FEATURES.map(def => {
            const stored = storedConfig[def.id];
            if (stored) {
                return { ...def, ...stored };
            }
            return def;
        });
    });

    const [activeCategory, setActiveCategory] = useState<string>('ALL');
    const [showThemeSection, setShowThemeSection] = useState(true);

    // Tier theme colors local state
    const [tierColors, setTierColors] = useState({
        free:  settings.freeThemeColor  || '',
        basic: settings.basicThemeColor || '',
        ultra: settings.ultraThemeColor || '',
    });

    // Level-wise theme colors local state (levelColorOverride: { "1": "#hex", ... })
    const [levelColors, setLevelColors] = useState<Record<string, string>>(
        (settings as any).levelColorOverride || {}
    );
    const [showLevelColors, setShowLevelColors] = useState(false);

    // Only show categories that have visible features
    const categories = ['ALL', ...Array.from(new Set(config.filter(f => f.visible !== false).map(f => f.category)))];

    // State for Adding New Feature
    const [showAddModal, setShowAddModal] = useState(false);
    const [newFeature, setNewFeature] = useState({ id: '', label: '', category: 'CUSTOM' });

    // Save Changes
    const saveChanges = () => {
        // Convert array back to object map for storage
        const featureConfigMap: Record<string, any> = {};
        config.forEach(f => {
            featureConfigMap[f.id] = f;
        });

        const updatedSettings: SystemSettings = {
            ...settings,
            featureConfig: featureConfigMap,
            freeThemeColor:  tierColors.free  || undefined,
            basicThemeColor: tierColors.basic || undefined,
            ultraThemeColor: tierColors.ultra || undefined,
            ...(Object.keys(levelColors).length > 0 ? { levelColorOverride: levelColors } : {}),
        } as any;

        // Ensure parent component receives update immediately
        onUpdateSettings(updatedSettings);

        // Also persist locally as fallback
        localStorage.setItem('nst_system_settings', JSON.stringify(updatedSettings));

        alert("NSTA Configuration Saved Successfully!");
    };

    const handleReset = () => {
        if(confirm("Reset all features to NSTA Defaults? This will wipe custom limits.")) {
            setConfig(NSTA_DEFAULT_FEATURES);
        }
    };

    const toggleVisibility = (id: string) => {
        setConfig(prev => prev.map(f => f.id === id ? { ...f, visible: !f.visible } : f));
    };

    const handleTierToggle = (id: string, tier: 'FREE' | 'BASIC' | 'ULTRA') => {
        setConfig(prev => prev.map(f => {
            if (f.id !== id) return f;
            const currentTiers = f.allowedTiers || ['FREE', 'BASIC', 'ULTRA'];
            const newTiers = currentTiers.includes(tier)
                ? currentTiers.filter((t: string) => t !== tier)
                : [...currentTiers, tier];
            return { ...f, allowedTiers: newTiers };
        }));
    };

    const handleLimitChange = (id: string, tier: string, value: string) => {
        setConfig(prev => prev.map(f => {
            if (f.id !== id) return f;
            const limits = { ...f.limits, [tier.toLowerCase()]: value === '' ? undefined : Number(value) };
            if (value === '') delete limits[tier.toLowerCase()];
            return { ...f, limits };
        }));
    };

    const handleCostChange = (id: string, value: string) => {
        setConfig(prev => prev.map(f => f.id === id ? { ...f, creditCost: Number(value) } : f));
    };

    const handleAddFeature = () => {
        if (!newFeature.id || !newFeature.label) return alert("ID and Label required!");
        const newItem = {
            id: newFeature.id.toUpperCase().replace(/\s+/g, '_'),
            label: newFeature.label,
            category: newFeature.category,
            visible: true,
            allowedTiers: ['FREE', 'BASIC', 'ULTRA'],
            limits: {},
            creditCost: 0
        };
        setConfig([...config, newItem]);
        setShowAddModal(false);
        setNewFeature({ id: '', label: '', category: 'CUSTOM' });
    };

    const handleDeleteFeature = (id: string) => {
        if(confirm("Delete this feature control?")) {
            setConfig(prev => prev.filter(f => f.id !== id));
        }
    };

    // User requested: "Nsta control .e wahi chijhe dikhegi jo abhi app me hai jo abhi run kar raha jo futur deactive hai wo na dikhega"
    // "Only features that are currently running in the app should be visible in NSTA control. Features that are deactivated should not be shown."
    // I am assuming "deactivated" means `visible === false`.
    const baseConfig = config.filter(f => f.visible !== false);
    const filteredConfig = activeCategory === 'ALL' ? baseConfig : baseConfig.filter(f => f.category === activeCategory);

    const localSettings = settings;
    const setLocalSettings = onUpdateSettings;

    return (
        <div className="bg-slate-50 min-h-screen p-6 animate-in fade-in pb-32">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 bg-white rounded-full shadow-sm hover:bg-slate-100 text-slate-600">
                        &larr;
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                            <Settings className="text-violet-600" /> NSTA Control Panel
                        </h1>
                        <p className="text-slate-600 text-xs font-bold uppercase tracking-widest">Master Feature Management</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={handleReset} className="px-4 py-2 bg-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-300 flex items-center gap-2">
                        <RotateCcw size={16} /> Reset
                    </button>
                    <button onClick={() => setShowAddModal(true)} className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 flex items-center gap-2">
                        <Plus size={16} /> Add Feature
                    </button>
                </div>
            </div>


            {/* ═══ TIER & LEVEL THEME COLORS SECTION ═══ */}
            <div className="bg-white rounded-2xl border border-violet-100 shadow-sm mb-6 overflow-hidden">
                <button
                    onClick={() => setShowThemeSection(v => !v)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-violet-50 transition-colors"
                >
                    <div className="flex items-center gap-2">
                        <Palette size={18} className="text-violet-600" />
                        <span className="font-black text-slate-800 text-sm">Tier & Level Theme Colors</span>
                        <span className="text-[9px] bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-bold uppercase">Admin Power</span>
                    </div>
                    {showThemeSection ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                </button>

                {showThemeSection && (
                    <div className="px-4 pb-4 border-t border-violet-50 pt-3 space-y-5">

                        {/* ── Tier Colors ── */}
                        <div>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Subscription Tier Colors (Free / Basic / Ultra)</p>
                            <div className="grid grid-cols-3 gap-3">
                                {([
                                    { key: 'free',  label: 'Free',  emoji: '🎓', accent: '#10b981', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800' },
                                    { key: 'basic', label: 'Basic', emoji: '⭐', accent: '#2563eb', bg: 'bg-blue-50',    border: 'border-blue-200',    text: 'text-blue-800'    },
                                    { key: 'ultra', label: 'Ultra', emoji: '⚡', accent: '#c8a020', bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-800'   },
                                ] as const).map(({ key, label, emoji, bg, border, text }) => (
                                    <div key={key} className={`${bg} ${border} border rounded-xl p-2.5 flex flex-col gap-2`}>
                                        <div className="flex items-center justify-between">
                                            <span className={`text-[10px] font-black ${text} uppercase`}>{emoji} {label}</span>
                                            {tierColors[key] && (
                                                <button
                                                    onClick={() => setTierColors(p => ({ ...p, [key]: '' }))}
                                                    className="text-[8px] text-red-400 hover:text-red-600 font-bold"
                                                    title="Clear color"
                                                >✕ Clear</button>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <input
                                                type="color"
                                                value={tierColors[key] || '#888888'}
                                                onChange={e => setTierColors(p => ({ ...p, [key]: e.target.value }))}
                                                className="w-8 h-8 rounded-lg border-none cursor-pointer shrink-0"
                                            />
                                            <input
                                                type="text"
                                                value={tierColors[key]}
                                                onChange={e => setTierColors(p => ({ ...p, [key]: e.target.value }))}
                                                placeholder="e.g. #3b82f6"
                                                className="flex-1 text-[9px] font-mono border border-slate-200 rounded-lg px-1.5 py-1 bg-white min-w-0"
                                            />
                                        </div>
                                        {/* Quick preset pills */}
                                        <div className="flex flex-wrap gap-1">
                                            {ADMIN_NAMED_THEMES.slice(0, 6).map(t => (
                                                <button
                                                    key={t.id}
                                                    onClick={() => setTierColors(p => ({ ...p, [key]: t.color }))}
                                                    title={t.name}
                                                    className="w-4 h-4 rounded-full border border-white/50 shadow-sm shrink-0 active:scale-90 transition-transform"
                                                    style={{ background: t.color }}
                                                />
                                            ))}
                                        </div>
                                        {tierColors[key] && (
                                            <div
                                                className="text-[8px] font-black text-center py-1 rounded-lg text-white"
                                                style={{ background: tierColors[key] }}
                                            >Preview</div>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <p className="text-[9px] text-slate-400 mt-2">⚡ Ye color us tier ke saare users ko apply hoga. Empty = default tier color.</p>
                        </div>

                        {/* ── Level-wise Colors ── */}
                        <div>
                            <button
                                onClick={() => setShowLevelColors(v => !v)}
                                className="w-full flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2 border border-slate-200 hover:bg-slate-100 transition-colors"
                            >
                                <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Level-wise Color Override (L1–L15)</span>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[8px] bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-bold">ADVANCED</span>
                                    {showLevelColors ? <ChevronUp size={13} className="text-slate-400" /> : <ChevronDown size={13} className="text-slate-400" />}
                                </div>
                            </button>

                            {showLevelColors && (
                                <div className="mt-3 grid grid-cols-3 gap-2">
                                    {LEVEL_INFO.map(lvl => (
                                        <div key={lvl.level} className="bg-slate-50 border border-slate-200 rounded-xl p-2 flex flex-col gap-1.5">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[9px] font-black text-slate-700">{lvl.emoji} L{lvl.level}</span>
                                                <span className="text-[8px] text-slate-500 truncate max-w-[60px]">{lvl.label}</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <input
                                                    type="color"
                                                    value={levelColors[String(lvl.level)] || lvl.color}
                                                    onChange={e => setLevelColors(p => ({ ...p, [String(lvl.level)]: e.target.value }))}
                                                    className="w-7 h-7 rounded-lg border-none cursor-pointer shrink-0"
                                                />
                                                <input
                                                    type="text"
                                                    value={levelColors[String(lvl.level)] || ''}
                                                    onChange={e => setLevelColors(p => ({ ...p, [String(lvl.level)]: e.target.value }))}
                                                    placeholder={lvl.color}
                                                    className="flex-1 text-[8px] font-mono border border-slate-200 rounded px-1 py-0.5 bg-white min-w-0"
                                                />
                                                {levelColors[String(lvl.level)] && (
                                                    <button
                                                        onClick={() => setLevelColors(p => { const n = { ...p }; delete n[String(lvl.level)]; return n; })}
                                                        className="text-red-400 text-[9px] hover:text-red-600 shrink-0 font-black"
                                                    >✕</button>
                                                )}
                                            </div>
                                            <div
                                                className="h-1.5 rounded-full"
                                                style={{ background: levelColors[String(lvl.level)] || lvl.color }}
                                            />
                                        </div>
                                    ))}
                                    <div className="col-span-3 mt-1">
                                        <button
                                            onClick={() => setLevelColors({})}
                                            className="text-[9px] text-red-400 hover:text-red-600 font-bold"
                                        >✕ Saare Level Colors Reset Karo</button>
                                    </div>
                                </div>
                            )}
                            <p className="text-[9px] text-slate-400 mt-2">🎨 Level color tab apply hoga jab koi user us level par ho. Empty = default level color.</p>
                        </div>

                        <div className="flex justify-end">
                            <button
                                onClick={saveChanges}
                                className="px-5 py-2 bg-violet-600 text-white text-xs font-black rounded-xl hover:bg-violet-700 active:scale-95 transition-all flex items-center gap-2"
                            >
                                <Save size={14} /> Theme Colors Save Karo
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Category Filter - Horizontal Scroll */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide touch-pan-x">
                {categories.map(cat => (
                    <button
                        key={cat}
                        onClick={() => setActiveCategory(cat)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all border shrink-0 ${
                            activeCategory === cat ? 'bg-violet-600 text-white border-violet-600 shadow-md' : 'bg-white text-slate-600 border-slate-200'
                        }`}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            {/* Feature Grid - Mobile Optimized */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-24">
                {filteredConfig.map((feature) => (
                    <div key={feature.id} className={`bg-white p-3 rounded-xl border transition-all ${feature.visible ? 'border-slate-200 shadow-sm' : 'border-red-100 bg-red-50/30 grayscale'}`}>
                        {/* Header Row */}
                        <div className="flex justify-between items-start mb-3">
                            <div className="flex-1 min-w-0 pr-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[9px] font-black bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded uppercase whitespace-nowrap">{feature.category}</span>
                                    <h3 className="font-bold text-sm text-slate-800 truncate">{feature.label}</h3>
                                </div>
                                <p className="text-[8px] font-mono text-slate-500 mt-0.5 truncate">{feature.id}</p>
                            </div>
                            <div className="flex gap-1 shrink-0">
                                <button
                                    onClick={() => toggleVisibility(feature.id)}
                                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${feature.visible ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}
                                >
                                    {feature.visible ? <CheckCircle size={16}/> : <Lock size={16}/>}
                                </button>
                                <button onClick={() => handleDeleteFeature(feature.id)} className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-red-500 rounded hover:bg-slate-50">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>

                        {/* Controls - Compact Grid */}
                        <div className={`space-y-2 ${!feature.visible ? 'opacity-50 pointer-events-none' : ''}`}>
                            {/* Tiers Toggle */}
                            <div className="grid grid-cols-3 gap-1 bg-slate-50 p-1 rounded-lg border border-slate-100">
                                {['FREE', 'BASIC', 'ULTRA'].map(tier => {
                                    const isAllowed = (feature.allowedTiers || ['FREE', 'BASIC', 'ULTRA']).includes(tier);
                                    return (
                                        <button
                                            key={tier}
                                            onClick={() => handleTierToggle(feature.id, tier as any)}
                                            className={`py-1.5 rounded text-[9px] font-bold border transition-all ${
                                                isAllowed
                                                ? (tier === 'FREE' ? 'bg-green-50 border-green-200 text-green-700' : tier === 'BASIC' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-purple-50 border-purple-200 text-purple-700')
                                                : 'bg-white border-slate-200 text-slate-300'
                                            }`}
                                        >
                                            {tier}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Inputs Row */}
                            <div className="grid grid-cols-4 gap-2">
                                {/* Limits */}
                                {['Free', 'Basic', 'Ultra'].map(tier => {
                                    const isAllowed = (feature.allowedTiers || ['FREE', 'BASIC', 'ULTRA']).includes(tier.toUpperCase());
                                    const limitVal = feature.limits?.[tier.toLowerCase()] ?? '';

                                    return (
                                        <div key={tier} className="relative">
                                            <input
                                                type="number"
                                                placeholder={isAllowed ? "∞" : "-"}
                                                disabled={!isAllowed}
                                                value={limitVal}
                                                onChange={(e) => handleLimitChange(feature.id, tier, e.target.value)}
                                                className={`w-full py-1.5 px-1 text-[10px] font-bold text-center border rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-500 ${!isAllowed ? 'bg-slate-100 cursor-not-allowed' : 'bg-white border-slate-200'}`}
                                            />
                                            <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 text-[7px] bg-white px-1 text-slate-500 uppercase font-bold">{tier.charAt(0)}</span>
                                        </div>
                                    );
                                })}

                                {/* Cost */}
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={feature.creditCost || 0}
                                        onChange={(e) => handleCostChange(feature.id, e.target.value)}
                                        className="w-full py-1.5 px-1 text-[10px] font-bold text-center border border-orange-200 bg-orange-50/50 rounded-lg text-orange-700 focus:outline-none"
                                    />
                                    <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 text-[7px] bg-white px-1 text-orange-500 uppercase font-bold">Cost</span>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* STICKY SAVE BUTTON - COMPACT MOBILE */}
            <div className="fixed inset-x-0 bottom-8 w-full mx-auto pointer-events-none z-[9999] flex justify-end px-6 safe-area-bottom">
                <button
                    onClick={saveChanges}
                    className="pointer-events-auto w-12 h-12 bg-green-600 text-white rounded-full shadow-2xl hover:bg-green-700 active:scale-95 transition-all flex items-center justify-center border-2 border-white"
                    title="Save Changes"
                >
                    <Save size={20} />
                </button>
            </div>

            {/* Add Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in">
                    <div className="bg-white rounded-2xl p-6 w-full shadow-xl">
                        <h3 className="font-black text-xl text-slate-800 mb-4">Add New Feature</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-600 uppercase">Category</label>
                                <input
                                    type="text"
                                    value={newFeature.category}
                                    onChange={(e) => setNewFeature({...newFeature, category: e.target.value})}
                                    className="w-full p-2 border rounded-lg mt-1 font-bold"
                                    list="categories"
                                />
                                <datalist id="categories">
                                    {categories.map(c => <option key={c} value={c} />)}
                                </datalist>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-600 uppercase">Feature ID (Unique)</label>
                                <input
                                    type="text"
                                    value={newFeature.id}
                                    onChange={(e) => setNewFeature({...newFeature, id: e.target.value})}
                                    className="w-full p-2 border rounded-lg mt-1 font-mono uppercase"
                                    placeholder="MY_NEW_FEATURE"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-600 uppercase">Label</label>
                                <input
                                    type="text"
                                    value={newFeature.label}
                                    onChange={(e) => setNewFeature({...newFeature, label: e.target.value})}
                                    className="w-full p-2 border rounded-lg mt-1"
                                    placeholder="My Feature Name"
                                />
                            </div>
                        </div>
                        <div className="flex gap-2 mt-6">
                            <button onClick={() => setShowAddModal(false)} className="flex-1 py-2 bg-slate-100 text-slate-600 font-bold rounded-lg">Cancel</button>
                            <button onClick={handleAddFeature} className="flex-1 py-2 bg-violet-600 text-white font-bold rounded-lg hover:bg-violet-700">Add Feature</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
