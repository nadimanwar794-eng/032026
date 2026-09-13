import React, { useState, useEffect, useMemo } from 'react';
import { SystemSettings } from '../../types';
import { MASTER_TIER_FEATURES, getMergedTierFeatures, TierFeatureItem } from '../../constants/tierConfig';
import {
  Save, Lock, Unlock, Zap, CheckCircle, Settings, Plus, Trash2,
  RotateCcw, BrainCircuit, Palette, ChevronDown, ChevronUp, Clock,
  Users, Search, Wifi, WifiOff, Activity, ShieldAlert, Sparkles, Filter
} from 'lucide-react';
import { ADMIN_NAMED_THEMES } from '../../utils/tierTheme';
import { LEVEL_INFO } from '../../utils/levelSystem';

interface Props {
  settings: SystemSettings;
  onUpdateSettings: (s: SystemSettings) => void;
  onBack: () => void;
  users?: any[];
}

export const NstaFeatureManager: React.FC<Props> = ({ settings, onUpdateSettings, onBack, users = [] }) => {
  // Top-level tab switcher: Features or User Activity / Last Seen
  const [managerTab, setManagerTab] = useState<'FEATURES' | 'USERS_LAST_SEEN'>('FEATURES');
  const [userSearch, setUserSearch] = useState('');
  const [userFilter, setUserFilter] = useState<'ALL' | 'ONLINE' | 'ACTIVE_TODAY' | 'INACTIVE'>('ALL');

  // Search & Filter for Features
  const [featureSearch, setFeatureSearch] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState<'ALL' | 'ACTIVE' | 'DEACTIVATED'>('ACTIVE');
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [showThemeSection, setShowThemeSection] = useState(false);

  // Helper: Online status (active in last 6 minutes = app open or studying)
  const isUserOnline = (u: any): boolean => {
    if (!u?.lastActiveTime) return false;
    try {
      const diff = Date.now() - new Date(u.lastActiveTime).getTime();
      return diff < 6 * 60 * 1000;
    } catch {
      return false;
    }
  };

  // Helper: Format Last Seen
  const formatLastSeen = (lastActiveTime?: string): string => {
    if (!lastActiveTime) return 'Never seen';
    try {
      const date = new Date(lastActiveTime);
      const diffMs = Date.now() - date.getTime();
      if (diffMs < 0) return 'Just now';
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 6) return '🟢 Online now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'Unknown';
    }
  };

  const onlineUsersCount = useMemo(() => users.filter(isUserOnline).length, [users]);
  const activeTodayCount = useMemo(() => {
    const now = Date.now();
    return users.filter(u => {
      if (!u?.lastActiveTime) return false;
      try { return now - new Date(u.lastActiveTime).getTime() < 24 * 60 * 60 * 1000; } catch { return false; }
    }).length;
  }, [users]);

  const filteredUsersList = useMemo(() => {
    let list = [...users];
    if (userFilter === 'ONLINE') {
      list = list.filter(isUserOnline);
    } else if (userFilter === 'ACTIVE_TODAY') {
      const now = Date.now();
      list = list.filter(u => {
        if (!u?.lastActiveTime) return false;
        try { return now - new Date(u.lastActiveTime).getTime() < 24 * 60 * 60 * 1000; } catch { return false; }
      });
    } else if (userFilter === 'INACTIVE') {
      list = list.filter(u => !isUserOnline(u));
    }

    if (userSearch.trim()) {
      const q = userSearch.toLowerCase().trim();
      list = list.filter(u =>
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.displayId && u.displayId.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.mobile && u.mobile.includes(q)) ||
        (u.id && u.id.toLowerCase().includes(q))
      );
    }

    return list.sort((a, b) => {
      const aOnline = isUserOnline(a) ? 1 : 0;
      const bOnline = isUserOnline(b) ? 1 : 0;
      if (aOnline !== bOnline) return bOnline - aOnline;
      const aTime = a.lastActiveTime ? new Date(a.lastActiveTime).getTime() : 0;
      const bTime = b.lastActiveTime ? new Date(b.lastActiveTime).getTime() : 0;
      return bTime - aTime;
    });
  }, [users, userFilter, userSearch]);

  // Master Features state: merged from settings or default master table
  const [config, setConfig] = useState<TierFeatureItem[]>(() => {
    return getMergedTierFeatures(settings.featureConfig);
  });

  // Tier theme colors local state
  const [tierColors, setTierColors] = useState({
    free:  settings.freeThemeColor  || '',
    basic: settings.basicThemeColor || '',
    ultra: settings.ultraThemeColor || '',
  });

  // Level-wise theme colors local state
  const [levelColors, setLevelColors] = useState<Record<string, string>>(
    (settings as any).levelColorOverride || {}
  );
  const [showLevelColors, setShowLevelColors] = useState(false);

  // Dynamic Categories from all configured features
  const categories = useMemo(() => {
    const cats = new Set<string>();
    config.forEach(f => {
      if (f.category) cats.add(f.category);
    });
    return ['ALL', ...Array.from(cats)];
  }, [config]);

  // State for Adding New Feature
  const [showAddModal, setShowAddModal] = useState(false);
  const [newFeature, setNewFeature] = useState({
    id: '',
    label: '',
    category: 'Custom Features',
    unlockLevel: 1,
    allowedTiers: ['FREE', 'BASIC', 'ULTRA'] as ('FREE' | 'BASIC' | 'ULTRA')[],
    freeLimit: '',
    basicLimit: '',
    ultraLimit: '',
    creditCost: 0,
    diamondCost: 0,
    freeText: '✓',
    basicText: '✓',
    ultraText: '✓',
    description: '',
  });

  // Filtered features list based on Category, Search query, and Visibility filter
  const displayedFeatures = useMemo(() => {
    return config.filter(f => {
      // Visibility filter
      if (visibilityFilter === 'ACTIVE' && f.visible === false) return false;
      if (visibilityFilter === 'DEACTIVATED' && f.visible !== false) return false;

      // Category filter
      if (activeCategory !== 'ALL' && f.category !== activeCategory) return false;

      // Search filter
      if (featureSearch.trim()) {
        const q = featureSearch.toLowerCase().trim();
        const mLabel = f.label.toLowerCase().includes(q);
        const mId = f.id.toLowerCase().includes(q);
        const mCat = f.category.toLowerCase().includes(q);
        return mLabel || mId || mCat;
      }

      return true;
    });
  }, [config, visibilityFilter, activeCategory, featureSearch]);

  // Save Changes handler
  const saveChanges = () => {
    const featureConfigMap: Record<string, TierFeatureItem> = {};
    config.forEach(f => {
      featureConfigMap[f.id] = f;
    });

    const updatedSettings: SystemSettings = {
      ...settings,
      featureConfig: featureConfigMap as any,
      freeThemeColor:  tierColors.free  || undefined,
      basicThemeColor: tierColors.basic || undefined,
      ultraThemeColor: tierColors.ultra || undefined,
      ...(Object.keys(levelColors).length > 0 ? { levelColorOverride: levelColors } : {}),
    } as any;

    onUpdateSettings(updatedSettings);
    localStorage.setItem('nst_system_settings', JSON.stringify(updatedSettings));
    alert("NSTA Features & Tier Configuration Saved Successfully!");
  };

  const handleReset = () => {
    if (confirm("Reset all features to Master Table Defaults? This will restore original Free, Basic, and Ultra limits and unlock levels.")) {
      setConfig([...MASTER_TIER_FEATURES]);
    }
  };

  const toggleVisibility = (id: string) => {
    setConfig(prev => prev.map(f => f.id === id ? { ...f, visible: f.visible === false ? true : false } : f));
  };

  const handleTierToggle = (id: string, tier: 'FREE' | 'BASIC' | 'ULTRA') => {
    setConfig(prev => prev.map(f => {
      if (f.id !== id) return f;
      const current = f.allowedTiers || ['FREE', 'BASIC', 'ULTRA'];
      const next = current.includes(tier) ? current.filter(t => t !== tier) : [...current, tier];
      return { ...f, allowedTiers: next };
    }));
  };

  const handleLimitChange = (id: string, tierKey: 'free' | 'basic' | 'ultra', val: string) => {
    setConfig(prev => prev.map(f => {
      if (f.id !== id) return f;
      const limits = { ...(f.limits || {}) };
      if (val === '') {
        delete limits[tierKey];
      } else {
        limits[tierKey] = Number(val);
      }
      return { ...f, limits };
    }));
  };

  const handleUnlockLevelChange = (id: string, levelVal: string) => {
    const lvl = Math.max(1, Number(levelVal) || 1);
    setConfig(prev => prev.map(f => f.id === id ? { ...f, unlockLevel: lvl } : f));
  };

  const handleCostChange = (id: string, costType: 'creditCost' | 'diamondCost', val: string) => {
    const amount = Math.max(0, Number(val) || 0);
    setConfig(prev => prev.map(f => f.id === id ? { ...f, [costType]: amount } : f));
  };

  const handleTableTextChange = (id: string, tierCol: 'free' | 'basic' | 'ultra', val: string) => {
    setConfig(prev => prev.map(f => f.id === id ? { ...f, [tierCol]: val } : f));
  };

  const handleAddFeature = () => {
    if (!newFeature.id.trim() || !newFeature.label.trim()) {
      return alert("Feature ID aur Label dono required hain!");
    }
    const cleanId = newFeature.id.toUpperCase().trim().replace(/\s+/g, '_');
    
    if (config.some(f => f.id === cleanId)) {
      return alert(`Feature ID "${cleanId}" already exist karta hai. Unique ID use karein.`);
    }

    const limits: { free?: number; basic?: number; ultra?: number } = {};
    if (newFeature.freeLimit !== '') limits.free = Number(newFeature.freeLimit);
    if (newFeature.basicLimit !== '') limits.basic = Number(newFeature.basicLimit);
    if (newFeature.ultraLimit !== '') limits.ultra = Number(newFeature.ultraLimit);

    const newItem: TierFeatureItem = {
      sn: config.length + 1,
      id: cleanId,
      label: newFeature.label.trim(),
      category: newFeature.category.trim() || 'Custom Features',
      free: newFeature.freeText.trim() || '✓',
      basic: newFeature.basicText.trim() || '✓',
      ultra: newFeature.ultraText.trim() || '✓',
      unlockLevel: Math.max(1, Number(newFeature.unlockLevel) || 1),
      allowedTiers: newFeature.allowedTiers.length > 0 ? newFeature.allowedTiers : ['FREE', 'BASIC', 'ULTRA'],
      limits,
      creditCost: Number(newFeature.creditCost) || 0,
      diamondCost: Number(newFeature.diamondCost) || 0,
      visible: true,
      description: newFeature.description.trim() || undefined,
    };

    setConfig([...config, newItem]);
    setShowAddModal(false);
    setNewFeature({
      id: '',
      label: '',
      category: 'Custom Features',
      unlockLevel: 1,
      allowedTiers: ['FREE', 'BASIC', 'ULTRA'],
      freeLimit: '',
      basicLimit: '',
      ultraLimit: '',
      creditCost: 0,
      diamondCost: 0,
      freeText: '✓',
      basicText: '✓',
      ultraText: '✓',
      description: '',
    });
  };

  const handleDeleteFeature = (id: string) => {
    if (confirm(`Feature "${id}" ko delete karna chahte hain?`)) {
      setConfig(prev => prev.filter(f => f.id !== id));
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen p-3 sm:p-6 animate-in fade-in pb-32">
      
      {/* ── TOP HEADER BAR ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 transition cursor-pointer"
            title="Back"
          >
            &larr;
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
              <Zap className="text-violet-600 fill-violet-500" size={24} />
              Feature & Tier Manager
            </h1>
            <p className="text-slate-500 text-xs font-semibold">
              Free, Basic, Ultra Tier Limits, Unlock Levels & Study Costs Control
            </p>
          </div>
        </div>

        {/* Manager Tab Pill: Features vs Live Presence */}
        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-between sm:justify-end">
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
            <button
              onClick={() => setManagerTab('FEATURES')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                managerTab === 'FEATURES'
                  ? 'bg-violet-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ⚡ Features ({config.length})
            </button>
            <button
              onClick={() => setManagerTab('USERS_LAST_SEEN')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                managerTab === 'USERS_LAST_SEEN'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Live Users ({onlineUsersCount})
            </button>
          </div>

          {managerTab === 'FEATURES' && (
            <div className="flex gap-1.5">
              <button
                onClick={handleReset}
                className="p-2 sm:px-3 sm:py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1 transition cursor-pointer"
                title="Reset to Master Defaults"
              >
                <RotateCcw size={15} />
                <span className="hidden sm:inline">Reset</span>
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-xl flex items-center gap-1 transition shadow-xs cursor-pointer"
              >
                <Plus size={15} />
                <span>Add Feature</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════ TAB 1: USERS LIVE PRESENCE ═══════════ */}
      {managerTab === 'USERS_LAST_SEEN' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative w-full md:w-80">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                placeholder="Search user name, ID, mobile..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold outline-none focus:border-violet-500"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto scrollbar-none text-xs">
              <button
                onClick={() => setUserFilter('ALL')}
                className={`px-3 py-1.5 rounded-xl font-bold cursor-pointer transition ${userFilter === 'ALL' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}
              >
                All ({users.length})
              </button>
              <button
                onClick={() => setUserFilter('ONLINE')}
                className={`px-3 py-1.5 rounded-xl font-bold cursor-pointer transition flex items-center gap-1 ${userFilter === 'ONLINE' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700'}`}
              >
                🟢 Online ({onlineUsersCount})
              </button>
              <button
                onClick={() => setUserFilter('ACTIVE_TODAY')}
                className={`px-3 py-1.5 rounded-xl font-bold cursor-pointer transition ${userFilter === 'ACTIVE_TODAY' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700'}`}
              >
                📅 Today ({activeTodayCount})
              </button>
              <button
                onClick={() => setUserFilter('INACTIVE')}
                className={`px-3 py-1.5 rounded-xl font-bold cursor-pointer transition ${userFilter === 'INACTIVE' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600'}`}
              >
                Offline ({users.length - onlineUsersCount})
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-3">Student</th>
                  <th className="p-3">Live Status</th>
                  <th className="p-3">Last Seen</th>
                  <th className="p-3">Tier</th>
                  <th className="p-3 text-right">Credits / Streak</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsersList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400">
                      Koi user nahi mila.
                    </td>
                  </tr>
                ) : (
                  filteredUsersList.map(u => {
                    const online = isUserOnline(u);
                    return (
                      <tr key={u.id} className="hover:bg-slate-50 transition">
                        <td className="p-3">
                          <div className="font-bold text-slate-900">{u.name || 'Anonymous User'}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{u.displayId || u.id}</div>
                        </td>
                        <td className="p-3">
                          {online ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                              Online Now
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[10px]">Offline</span>
                          )}
                        </td>
                        <td className="p-3 text-slate-600 font-medium text-[11px]">
                          {formatLastSeen(u.lastActiveTime)}
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-slate-100 text-slate-700 uppercase">
                            {u.subscriptionLevel || u.subscriptionTier || 'FREE'}
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono">
                          <span className="font-bold text-amber-600">🪙 {u.credits ?? 0}</span>
                          {u.streak ? <span className="ml-2 text-rose-500 font-bold">🔥 {u.streak}d</span> : null}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════ TAB 2: MASTER FEATURES & TIER CONTROLS ═══════════ */}
      {managerTab === 'FEATURES' && (
        <>
          {/* Theme Colors Section Accordion */}
          <div className="bg-white rounded-2xl border border-violet-100 shadow-xs mb-4 overflow-hidden">
            <button
              onClick={() => setShowThemeSection(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-violet-50/50 transition cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Palette size={18} className="text-violet-600" />
                <span className="font-black text-slate-800 text-xs sm:text-sm">Tier & Level Theme Colors</span>
                <span className="text-[9px] bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-bold uppercase">
                  Appearance
                </span>
              </div>
              {showThemeSection ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
            </button>

            {showThemeSection && (
              <div className="px-4 pb-4 border-t border-violet-50 pt-3 space-y-4">
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Subscription Tier Colors</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {([
                      { key: 'free',  label: 'Free',  emoji: '💎', defaultHex: '#366669', bg: 'bg-teal-50',   border: 'border-teal-200' },
                      { key: 'basic', label: 'Basic', emoji: '⭐', defaultHex: '#213252', bg: 'bg-blue-50',   border: 'border-blue-200' },
                      { key: 'ultra', label: 'Ultra', emoji: '👑', defaultHex: '#374151', bg: 'bg-purple-50', border: 'border-purple-200' },
                    ] as const).map(({ key, label, emoji, defaultHex, bg, border }) => (
                      <div key={key} className={`${bg} ${border} border rounded-xl p-2.5 flex items-center justify-between gap-2`}>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={tierColors[key] || defaultHex}
                            onChange={e => setTierColors(p => ({ ...p, [key]: e.target.value }))}
                            className="w-7 h-7 rounded-lg border-none cursor-pointer shrink-0"
                          />
                          <div>
                            <span className="text-xs font-black text-slate-800">{emoji} {label}</span>
                            <span className="block text-[9px] font-mono text-slate-500">{tierColors[key] || defaultHex}</span>
                          </div>
                        </div>
                        {tierColors[key] && (
                          <button
                            onClick={() => setTierColors(p => ({ ...p, [key]: '' }))}
                            className="text-[9px] text-rose-500 hover:underline font-bold"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Search, Status Filter & Category Scroll Bar */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs mb-4 space-y-3">
            <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
              {/* Search Bar */}
              <div className="relative flex-1 max-w-md">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={featureSearch}
                  onChange={e => setFeatureSearch(e.target.value)}
                  placeholder="Search feature by name, ID or category..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold outline-none focus:border-violet-500 transition"
                />
                {featureSearch && (
                  <button onClick={() => setFeatureSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs">✕</button>
                )}
              </div>

              {/* Visibility Filter Chips: Active vs Deactivated vs All */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold self-end sm:self-center">
                <button
                  onClick={() => setVisibilityFilter('ACTIVE')}
                  className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${visibilityFilter === 'ACTIVE' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600'}`}
                >
                  ✓ Active ({config.filter(f => f.visible !== false).length})
                </button>
                <button
                  onClick={() => setVisibilityFilter('DEACTIVATED')}
                  className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${visibilityFilter === 'DEACTIVATED' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-600'}`}
                >
                  🔒 Hidden ({config.filter(f => f.visible === false).length})
                </button>
                <button
                  onClick={() => setVisibilityFilter('ALL')}
                  className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${visibilityFilter === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
                >
                  All ({config.length})
                </button>
              </div>
            </div>

            {/* Categories Scrollable Pills */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[10px]">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3 py-1 rounded-lg font-bold whitespace-nowrap transition cursor-pointer ${
                    activeCategory === cat
                      ? 'bg-violet-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* ══════ MASTER FEATURE CARDS GRID ══════ */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pb-24">
            {displayedFeatures.length === 0 ? (
              <div className="col-span-1 md:col-span-2 p-12 bg-white rounded-2xl border border-slate-200 text-center text-slate-400">
                Koi feature match nahi hua. Filters check karein.
              </div>
            ) : (
              displayedFeatures.map(f => {
                const isDeactivated = f.visible === false;
                const allowedTiers = f.allowedTiers || ['FREE', 'BASIC', 'ULTRA'];
                const unlockLvl = f.unlockLevel || 1;

                return (
                  <div
                    key={f.id}
                    className={`bg-white rounded-2xl border p-3.5 transition-all flex flex-col justify-between shadow-xs ${
                      isDeactivated
                        ? 'border-rose-200 bg-rose-50/20'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {/* Header Row: SN, Label, Category, Visibility & Delete */}
                    <div>
                      <div className="flex justify-between items-start gap-2 mb-2.5 pb-2 border-b border-slate-100">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono">
                              #{f.sn}
                            </span>
                            <span className="text-[9px] font-bold bg-violet-50 text-violet-700 px-2 py-0.5 rounded-full uppercase">
                              {f.category}
                            </span>
                            {unlockLvl > 1 && (
                              <span className="text-[9px] font-black bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded border border-amber-200">
                                🔒 Lvl {unlockLvl}+
                              </span>
                            )}
                          </div>
                          <h3 className="font-bold text-sm text-slate-900 mt-1 truncate">
                            {f.label}
                          </h3>
                          <p className="text-[9px] font-mono text-slate-400 truncate">{f.id}</p>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {/* Visibility Toggle */}
                          <button
                            onClick={() => toggleVisibility(f.id)}
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition cursor-pointer ${
                              !isDeactivated
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                                : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                            }`}
                            title={isDeactivated ? "Activate Feature" : "Deactivate Feature"}
                          >
                            {!isDeactivated ? <CheckCircle size={12} /> : <Lock size={12} />}
                            <span>{!isDeactivated ? 'Active' : 'Hidden'}</span>
                          </button>

                          {/* Delete Button */}
                          <button
                            onClick={() => handleDeleteFeature(f.id)}
                            className="p-1.5 text-slate-300 hover:text-rose-500 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                            title="Delete Feature"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Controls Area */}
                      <div className={`space-y-2.5 ${isDeactivated ? 'opacity-60 pointer-events-none' : ''}`}>
                        
                        {/* 1. Tiers Access Selector & Unlock Level */}
                        <div className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-2 rounded-xl border border-slate-200">
                          {/* Tiers Toggles */}
                          <div className="col-span-7 flex gap-1">
                            {(['FREE', 'BASIC', 'ULTRA'] as const).map(tier => {
                              const isSelected = allowedTiers.includes(tier);
                              const colorStyle =
                                tier === 'FREE'
                                  ? isSelected ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white text-slate-400 border border-slate-200'
                                  : tier === 'BASIC'
                                  ? isSelected ? 'bg-sky-600 text-white shadow-xs' : 'bg-white text-slate-400 border border-slate-200'
                                  : isSelected ? 'bg-purple-600 text-white shadow-xs' : 'bg-white text-slate-400 border border-slate-200';

                              return (
                                <button
                                  key={tier}
                                  type="button"
                                  onClick={() => handleTierToggle(f.id, tier)}
                                  className={`flex-1 py-1 rounded-lg text-[9px] font-black transition cursor-pointer ${colorStyle}`}
                                >
                                  {tier}
                                </button>
                              );
                            })}
                          </div>

                          {/* Unlock Level Input */}
                          <div className="col-span-5 flex items-center justify-end gap-1.5">
                            <span className="text-[9px] font-black text-slate-500 uppercase">Unlock Lvl:</span>
                            <input
                              type="number"
                              min={1}
                              max={15}
                              value={unlockLvl}
                              onChange={e => handleUnlockLevelChange(f.id, e.target.value)}
                              className="w-12 py-1 px-1.5 text-xs font-black text-center bg-white border border-slate-200 rounded-lg outline-none focus:border-violet-500"
                            />
                          </div>
                        </div>

                        {/* 2. Tier Limits Inputs */}
                        <div className="space-y-1">
                          <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
                            Tier Numeric Limits (Leave empty for ∞ / table text)
                          </div>
                          <div className="grid grid-cols-3 gap-1.5">
                            <div>
                              <label className="block text-[8px] font-bold text-emerald-700">Free Limit</label>
                              <input
                                type="number"
                                placeholder={allowedTiers.includes('FREE') ? "∞" : "-"}
                                disabled={!allowedTiers.includes('FREE')}
                                value={f.limits?.free ?? ''}
                                onChange={e => handleLimitChange(f.id, 'free', e.target.value)}
                                className="w-full py-1 px-2 text-[11px] font-bold bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-violet-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[8px] font-bold text-sky-700">Basic Limit</label>
                              <input
                                type="number"
                                placeholder={allowedTiers.includes('BASIC') ? "∞" : "-"}
                                disabled={!allowedTiers.includes('BASIC')}
                                value={f.limits?.basic ?? ''}
                                onChange={e => handleLimitChange(f.id, 'basic', e.target.value)}
                                className="w-full py-1 px-2 text-[11px] font-bold bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-violet-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[8px] font-bold text-purple-700">Ultra Limit</label>
                              <input
                                type="number"
                                placeholder={allowedTiers.includes('ULTRA') ? "∞" : "-"}
                                disabled={!allowedTiers.includes('ULTRA')}
                                value={f.limits?.ultra ?? ''}
                                onChange={e => handleLimitChange(f.id, 'ultra', e.target.value)}
                                className="w-full py-1 px-2 text-[11px] font-bold bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-violet-500"
                              />
                            </div>
                          </div>
                        </div>

                        {/* 3. Currency Costs (🪙 Coins / 💎 Diamonds) */}
                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                          <div>
                            <label className="block text-[8.5px] font-black text-amber-700 flex items-center gap-1">
                              <span>🪙 Credit Cost</span>
                            </label>
                            <input
                              type="number"
                              min={0}
                              value={f.creditCost || 0}
                              onChange={e => handleCostChange(f.id, 'creditCost', e.target.value)}
                              className="w-full py-1 px-2 text-[11px] font-bold bg-amber-50/50 border border-amber-200 text-amber-900 rounded-lg outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[8.5px] font-black text-sky-700 flex items-center gap-1">
                              <span>💎 Diamond Cost</span>
                            </label>
                            <input
                              type="number"
                              min={0}
                              value={f.diamondCost || 0}
                              onChange={e => handleCostChange(f.id, 'diamondCost', e.target.value)}
                              className="w-full py-1 px-2 text-[11px] font-bold bg-sky-50/50 border border-sky-200 text-sky-900 rounded-lg outline-none"
                            />
                          </div>
                        </div>

                        {/* 4. Display Strings in Store Comparison Matrix */}
                        <div className="space-y-1 pt-1 border-t border-slate-100">
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-wide">
                            Table Matrix Display Labels
                          </span>
                          <div className="grid grid-cols-3 gap-1.5">
                            <input
                              type="text"
                              value={f.free || ''}
                              onChange={e => handleTableTextChange(f.id, 'free', e.target.value)}
                              placeholder="Free display"
                              className="w-full py-0.5 px-1.5 text-[9px] font-semibold bg-slate-50 border border-slate-200 rounded text-slate-700 outline-none"
                              title="Free column display string"
                            />
                            <input
                              type="text"
                              value={f.basic || ''}
                              onChange={e => handleTableTextChange(f.id, 'basic', e.target.value)}
                              placeholder="Basic display"
                              className="w-full py-0.5 px-1.5 text-[9px] font-semibold bg-slate-50 border border-slate-200 rounded text-slate-700 outline-none"
                              title="Basic column display string"
                            />
                            <input
                              type="text"
                              value={f.ultra || ''}
                              onChange={e => handleTableTextChange(f.id, 'ultra', e.target.value)}
                              placeholder="Ultra display"
                              className="w-full py-0.5 px-1.5 text-[9px] font-semibold bg-slate-50 border border-slate-200 rounded text-slate-700 outline-none"
                              title="Ultra column display string"
                            />
                          </div>
                        </div>

                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Sticky Bottom Save Button */}
          <div className="fixed inset-x-0 bottom-6 max-w-xl mx-auto px-4 z-40">
            <button
              onClick={saveChanges}
              className="w-full py-3.5 px-6 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:opacity-95 active:scale-[0.98] text-white font-black text-sm rounded-2xl shadow-xl flex items-center justify-center gap-2 border border-emerald-400/40 cursor-pointer"
            >
              <Save size={18} />
              <span>Save NSTA Features & Tier Changes</span>
            </button>
          </div>
        </>
      )}

      {/* ═══════════ ADD FEATURE MODAL ═══════════ */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl p-5 sm:p-6 w-full max-w-lg shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
              <h3 className="font-black text-lg text-slate-900 flex items-center gap-2">
                <Plus size={18} className="text-violet-600" />
                Add New Feature / Study Mode
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Feature Label (Name)</label>
                <input
                  type="text"
                  value={newFeature.label}
                  onChange={e => setNewFeature({ ...newFeature, label: e.target.value })}
                  placeholder="e.g. AI Audio Summarizer"
                  className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:border-violet-500 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Unique Feature ID</label>
                  <input
                    type="text"
                    value={newFeature.id}
                    onChange={e => setNewFeature({ ...newFeature, id: e.target.value })}
                    placeholder="e.g. AUDIO_SUMMARIZER"
                    className="w-full p-2 border border-slate-200 rounded-xl font-mono uppercase text-xs outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Category</label>
                  <input
                    type="text"
                    value={newFeature.category}
                    onChange={e => setNewFeature({ ...newFeature, category: e.target.value })}
                    className="w-full p-2 border border-slate-200 rounded-xl font-semibold text-xs outline-none focus:border-violet-500"
                    list="new-categories"
                  />
                  <datalist id="new-categories">
                    {categories.filter(c => c !== 'ALL').map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <div className="col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Allowed Tiers</label>
                  <div className="flex gap-1">
                    {(['FREE', 'BASIC', 'ULTRA'] as const).map(tier => {
                      const isSel = newFeature.allowedTiers.includes(tier);
                      return (
                        <button
                          key={tier}
                          type="button"
                          onClick={() => {
                            const cur = newFeature.allowedTiers;
                            const next = cur.includes(tier) ? cur.filter(t => t !== tier) : [...cur, tier];
                            setNewFeature({ ...newFeature, allowedTiers: next });
                          }}
                          className={`flex-1 py-1 rounded-lg text-[9px] font-black transition ${
                            isSel ? 'bg-violet-600 text-white' : 'bg-white text-slate-400 border border-slate-200'
                          }`}
                        >
                          {tier}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Unlock Lvl</label>
                  <input
                    type="number"
                    min={1}
                    max={15}
                    value={newFeature.unlockLevel}
                    onChange={e => setNewFeature({ ...newFeature, unlockLevel: Number(e.target.value) || 1 })}
                    className="w-full p-1.5 text-center border border-slate-200 rounded-lg font-black bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-amber-700 mb-1">🪙 Credit Cost</label>
                  <input
                    type="number"
                    min={0}
                    value={newFeature.creditCost}
                    onChange={e => setNewFeature({ ...newFeature, creditCost: Number(e.target.value) || 0 })}
                    className="w-full p-2 bg-amber-50/50 border border-amber-200 rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-sky-700 mb-1">💎 Diamond Cost</label>
                  <input
                    type="number"
                    min={0}
                    value={newFeature.diamondCost}
                    onChange={e => setNewFeature({ ...newFeature, diamondCost: Number(e.target.value) || 0 })}
                    className="w-full p-2 bg-sky-50/50 border border-sky-200 rounded-xl font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Store Matrix Labels (Free / Basic / Ultra)</label>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={newFeature.freeText}
                    onChange={e => setNewFeature({ ...newFeature, freeText: e.target.value })}
                    placeholder="Free text"
                    className="p-2 border rounded-xl text-[11px] font-semibold"
                  />
                  <input
                    type="text"
                    value={newFeature.basicText}
                    onChange={e => setNewFeature({ ...newFeature, basicText: e.target.value })}
                    placeholder="Basic text"
                    className="p-2 border rounded-xl text-[11px] font-semibold"
                  />
                  <input
                    type="text"
                    value={newFeature.ultraText}
                    onChange={e => setNewFeature({ ...newFeature, ultraText: e.target.value })}
                    placeholder="Ultra text"
                    className="p-2 border rounded-xl text-[11px] font-semibold"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2.5 mt-6">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddFeature}
                className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl transition shadow-xs cursor-pointer"
              >
                Add Feature
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
