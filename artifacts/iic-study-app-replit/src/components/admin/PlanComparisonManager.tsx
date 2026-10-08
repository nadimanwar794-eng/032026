import React, { useState } from 'react';
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  MoveUp,
  MoveDown,
  RotateCcw,
  Search,
  Check,
  Eye,
  SlidersHorizontal,
  Info,
  Layers,
  Sparkles,
  HelpCircle,
  Edit3
} from 'lucide-react';
import { SystemSettings, PlanCompareGroup, PlanCompareItem } from '../../types';
import { DEFAULT_PLAN_COMPARE_GROUPS } from '../../constants/planComparisonDefaults';

interface Props {
  settings: SystemSettings;
  onUpdateSettings: (s: SystemSettings) => void;
  onBack: () => void;
}

export const PlanComparisonManager: React.FC<Props> = ({
  settings,
  onUpdateSettings,
  onBack
}) => {
  const initialData: PlanCompareGroup[] =
    settings?.planComparisonData && settings.planComparisonData.length > 0
      ? JSON.parse(JSON.stringify(settings.planComparisonData))
      : JSON.parse(JSON.stringify(DEFAULT_PLAN_COMPARE_GROUPS));

  const [groups, setGroups] = useState<PlanCompareGroup[]>(initialData);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [hasChanges, setHasChanges] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [previewMode, setPreviewMode] = useState<boolean>(false);

  // New Row Modal / Drawer State
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [targetCategory, setTargetCategory] = useState<string>('');
  const [newLabel, setNewLabel] = useState<string>('');
  const [newFree, setNewFree] = useState<string>('');
  const [newBasic, setNewBasic] = useState<string>('');
  const [newUltra, setNewUltra] = useState<string>('');
  const [newTooltip, setNewTooltip] = useState<string>('');

  // Add Category State
  const [showAddCatModal, setShowAddCatModal] = useState<boolean>(false);
  const [newCatName, setNewCatName] = useState<string>('');

  const markChanged = (updatedGroups: PlanCompareGroup[]) => {
    setGroups(updatedGroups);
    setHasChanges(true);
    setSaveSuccess(false);
  };

  const handleSave = () => {
    const updatedSettings: SystemSettings = {
      ...settings,
      planComparisonData: groups
    };
    onUpdateSettings(updatedSettings);
    setHasChanges(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3500);
  };

  const handleResetDefaults = () => {
    if (
      window.confirm(
        'Kya aap pura comparison table original defaults par reset karna chahte hain? Sabhi custom edits hat jayenge.'
      )
    ) {
      const reset = JSON.parse(JSON.stringify(DEFAULT_PLAN_COMPARE_GROUPS));
      markChanged(reset);
    }
  };

  // Row update helpers
  const handleItemChange = (
    groupIndex: number,
    itemIndex: number,
    field: keyof PlanCompareItem,
    value: string
  ) => {
    const next = [...groups];
    next[groupIndex].items[itemIndex] = {
      ...next[groupIndex].items[itemIndex],
      [field]: value
    };
    markChanged(next);
  };

  const handleDeleteItem = (groupIndex: number, itemIndex: number) => {
    const item = groups[groupIndex].items[itemIndex];
    if (window.confirm(`"${item.label}" feature ko remove karein?`)) {
      const next = [...groups];
      next[groupIndex].items.splice(itemIndex, 1);
      markChanged(next);
    }
  };

  const handleMoveItem = (groupIndex: number, itemIndex: number, dir: -1 | 1) => {
    const next = [...groups];
    const items = [...next[groupIndex].items];
    const targetIdx = itemIndex + dir;
    if (targetIdx < 0 || targetIdx >= items.length) return;
    const temp = items[itemIndex];
    items[itemIndex] = items[targetIdx];
    items[targetIdx] = temp;
    next[groupIndex].items = items;
    markChanged(next);
  };

  // Category update helpers
  const handleCategoryNameChange = (groupIndex: number, newName: string) => {
    const next = [...groups];
    next[groupIndex].category = newName;
    markChanged(next);
  };

  const handleDeleteCategory = (groupIndex: number) => {
    const cat = groups[groupIndex].category;
    if (window.confirm(`Category "${cat}" aur iske sabhi items delete karein?`)) {
      const next = [...groups];
      next.splice(groupIndex, 1);
      markChanged(next);
    }
  };

  const handleMoveCategory = (groupIndex: number, dir: -1 | 1) => {
    const targetIdx = groupIndex + dir;
    if (targetIdx < 0 || targetIdx >= groups.length) return;
    const next = [...groups];
    const temp = next[groupIndex];
    next[groupIndex] = next[targetIdx];
    next[targetIdx] = temp;
    markChanged(next);
  };

  const handleAddCategory = () => {
    if (!newCatName.trim()) return;
    const newGroup: PlanCompareGroup = {
      id: `grp-${Date.now()}`,
      category: newCatName.trim(),
      items: []
    };
    markChanged([...groups, newGroup]);
    setNewCatName('');
    setShowAddCatModal(false);
  };

  const handleAddRow = () => {
    if (!newLabel.trim()) return;
    const targetCat = targetCategory || groups[0]?.category || 'General';
    const targetGroupIdx = groups.findIndex(g => g.category === targetCat);

    const newItem: PlanCompareItem = {
      id: `item-${Date.now()}`,
      label: newLabel.trim(),
      free: newFree.trim() || '—',
      basic: newBasic.trim() || '—',
      ultra: newUltra.trim() || '—',
      tooltip: newTooltip.trim() || undefined
    };

    const next = [...groups];
    if (targetGroupIdx >= 0) {
      next[targetGroupIdx].items.push(newItem);
    } else {
      next.push({
        id: `grp-${Date.now()}`,
        category: targetCat,
        items: [newItem]
      });
    }

    markChanged(next);
    setNewLabel('');
    setNewFree('');
    setNewBasic('');
    setNewUltra('');
    setNewTooltip('');
    setShowAddModal(false);
  };

  // Quick Emoji / Text Insert
  const applyQuickTag = (
    groupIndex: number,
    itemIndex: number,
    field: 'free' | 'basic' | 'ultra',
    tag: string
  ) => {
    handleItemChange(groupIndex, itemIndex, field, tag);
  };

  // Filtered list based on category & search
  const filteredGroups = groups
    .filter(g => selectedCategory === 'ALL' || g.category === selectedCategory)
    .map(g => {
      if (!searchQuery.trim()) return g;
      const q = searchQuery.toLowerCase();
      const filteredItems = g.items.filter(
        i =>
          i.label.toLowerCase().includes(q) ||
          i.free.toLowerCase().includes(q) ||
          i.basic.toLowerCase().includes(q) ||
          i.ultra.toLowerCase().includes(q) ||
          g.category.toLowerCase().includes(q)
      );
      return { ...g, items: filteredItems };
    })
    .filter(g => g.items.length > 0 || !searchQuery.trim());

  const totalFeatures = groups.reduce((acc, g) => acc + g.items.length, 0);

  return (
    <div className="bg-slate-50 min-h-screen p-4 sm:p-6 pb-28 text-slate-800">
      {/* ── TOP NAV & HEADER ── */}
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={onBack}
                className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 transition active:scale-95"
                title="Wapas Dashboard jayein"
              >
                <ArrowLeft size={20} />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-600 flex items-center justify-center font-bold">
                    <SlidersHorizontal size={18} />
                  </div>
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                    Plan Compare Matrix (Compare)
                  </h1>
                  <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-700 border border-sky-200">
                    Live Sync ⚡
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Free, Basic aur Ultra plans ka pura comparison table, limits aur features edit karein. Sabhi updates Store me live dikhenge.
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setPreviewMode(!previewMode)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition border ${
                  previewMode
                    ? 'bg-purple-600 text-white border-purple-600 shadow-md'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                <Eye size={15} />
                <span>{previewMode ? 'Exit Store Preview' : 'Store Live Preview'}</span>
              </button>

              <button
                onClick={handleResetDefaults}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white text-slate-600 border border-slate-300 hover:bg-slate-100 flex items-center gap-1.5 transition"
                title="Reset to default comparison data"
              >
                <RotateCcw size={14} />
                <span>Reset Defaults</span>
              </button>

              <button
                onClick={handleSave}
                disabled={!hasChanges && !saveSuccess}
                className={`px-5 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition shadow-md ${
                  saveSuccess
                    ? 'bg-emerald-600 text-white'
                    : hasChanges
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white ring-2 ring-emerald-400/40 animate-pulse'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                {saveSuccess ? <Check size={16} /> : <Save size={16} />}
                <span>{saveSuccess ? 'Saved to App! ✅' : hasChanges ? 'Save Changes Now 💾' : 'Saved'}</span>
              </button>
            </div>
          </div>

          {/* Quick Stats & Highlight Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-100">
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <span className="text-[10px] uppercase font-bold text-slate-400">Total Categories</span>
              <p className="text-base font-black text-slate-800 mt-0.5">{groups.length} Groups</p>
            </div>
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <span className="text-[10px] uppercase font-bold text-slate-400">Total Features</span>
              <p className="text-base font-black text-slate-800 mt-0.5">{totalFeatures} Rows</p>
            </div>
            <div className="bg-sky-50/70 p-3 rounded-2xl border border-sky-100 col-span-2 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-sky-700">Sequential Page Reading</span>
                <p className="text-xs font-medium text-sky-900 mt-0.5">
                  Free: <strong>Sequential Page Reading</strong> | Basic & Ultra: <strong>0 🪙 / 0 💎</strong>
                </p>
              </div>
              <span className="text-xs px-2 py-1 rounded-lg bg-sky-200/70 text-sky-800 font-black">Active ⭐</span>
            </div>
          </div>
        </div>

        {/* ── STORE PREVIEW MODE ── */}
        {previewMode && (
          <div className="bg-slate-950 p-6 rounded-3xl border border-sky-500/30 shadow-2xl mb-6 text-white animate-in fade-in">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                <h3 className="text-base font-black text-white">Student Store Live View</h3>
              </div>
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-sky-500/20 text-sky-300 border border-sky-400/30">
                Preview Mode Active
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[650px] border-collapse">
                <thead>
                  <tr>
                    <th className="p-3 border-b-2 border-white/10 text-xs font-black text-slate-300 w-[28%]">
                      Feature / Module
                    </th>
                    <th className="p-3 border-b-2 border-slate-700 text-center w-[24%] bg-slate-900/60 rounded-tl-xl border-l border-t border-slate-700/50">
                      <div className="text-[10px] uppercase text-slate-400 font-bold">Standard</div>
                      <div className="text-sm font-black text-slate-200 mt-0.5">Free User</div>
                    </th>
                    <th className="p-3 border-b-2 border-sky-500/40 text-center w-[24%] bg-sky-900/30 border-l border-t border-sky-500/20">
                      <div className="text-[10px] uppercase text-sky-400 font-bold flex justify-center gap-1">
                        <span>⭐</span> Pro
                      </div>
                      <div className="text-sm font-black text-sky-300 mt-0.5">Basic User</div>
                    </th>
                    <th className="p-3 border-b-2 border-purple-500/50 text-center w-[24%] bg-purple-900/40 rounded-tr-xl border-l border-t border-r border-purple-500/30">
                      <div className="text-[10px] uppercase text-purple-300 font-bold flex justify-center gap-1">
                        <span>👑</span> Max
                      </div>
                      <div className="text-sm font-black text-purple-200 mt-0.5">Ultra User</div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((grp, gIdx) => (
                    <React.Fragment key={gIdx}>
                      <tr>
                        <td colSpan={4} className="py-4 px-2 pt-6">
                          <div className="flex items-center gap-2">
                            <div className="h-px bg-slate-700 flex-1" />
                            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">
                              {grp.category}
                            </span>
                            <div className="h-px bg-slate-700 flex-1" />
                          </div>
                        </td>
                      </tr>
                      {grp.items.map((item, iIdx) => (
                        <tr key={iIdx} className="hover:bg-white/[0.03] transition-colors border-b border-white/5">
                          <td className="p-3 text-xs text-slate-300 font-medium">
                            <div className="flex items-center gap-1.5">
                              <span>{item.label}</span>
                              {item.highlight && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 font-bold border border-amber-400/30">
                                  NEW
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3 border-l border-white/5 text-center text-xs text-slate-400 bg-slate-900/20">
                            <span>{item.free}</span>
                          </td>
                          <td className="p-3 border-l border-sky-500/10 text-center text-xs text-sky-200/90 bg-sky-900/10">
                            <span>{item.basic}</span>
                          </td>
                          <td className="p-3 border-l border-r border-purple-500/20 text-center text-xs text-purple-200/95 bg-purple-900/20 font-medium">
                            <span>{item.ultra}</span>
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── CONTROLS TOOLBAR: Search & Filters & Add Buttons ── */}
        <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-200 mb-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search any feature or limit..."
                className="w-full pl-10 pr-4 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Add Buttons */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                onClick={() => setShowAddCatModal(true)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1.5 transition"
              >
                <Layers size={15} />
                <span>+ Category</span>
              </button>

              <button
                onClick={() => {
                  setTargetCategory(groups[0]?.category || '');
                  setShowAddModal(true);
                }}
                className="px-4 py-2 rounded-xl text-xs font-black bg-sky-600 hover:bg-sky-700 text-white flex items-center gap-1.5 transition shadow-sm"
              >
                <Plus size={16} />
                <span>+ Naya Feature Add Karein</span>
              </button>
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pt-3 mt-3 border-t border-slate-100 scrollbar-none">
            <button
              onClick={() => setSelectedCategory('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition ${
                selectedCategory === 'ALL'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Categories ({totalFeatures})
            </button>
            {groups.map(g => (
              <button
                key={g.id}
                onClick={() => setSelectedCategory(g.category)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition flex items-center gap-1.5 ${
                  selectedCategory === g.category
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>{g.category}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                    selectedCategory === g.category ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {g.items.length}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* ── GROUPS & ROWS EDITING LIST ── */}
        <div className="space-y-6">
          {filteredGroups.map((group, gIdx) => {
            const realGroupIndex = groups.findIndex(g => g.id === group.id);

            return (
              <div
                key={group.id}
                className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden"
              >
                {/* Category Header */}
                <div className="bg-slate-100/80 px-5 py-3.5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-xs font-black px-2 py-0.5 rounded-lg bg-sky-500/15 text-sky-700 font-mono">
                      #{realGroupIndex + 1}
                    </span>
                    <input
                      type="text"
                      value={group.category}
                      onChange={e => handleCategoryNameChange(realGroupIndex, e.target.value)}
                      className="text-sm font-black text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-sky-500 focus:bg-white px-1 py-0.5 rounded focus:outline-none transition w-full max-w-sm"
                      title="Click to rename category"
                    />
                    <span className="text-[11px] font-bold text-slate-400">
                      ({group.items.length} items)
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleMoveCategory(realGroupIndex, -1)}
                      disabled={realGroupIndex === 0}
                      className="p-1.5 rounded-lg bg-white hover:bg-slate-200 disabled:opacity-30 text-slate-600"
                      title="Move Category Up"
                    >
                      <MoveUp size={14} />
                    </button>
                    <button
                      onClick={() => handleMoveCategory(realGroupIndex, 1)}
                      disabled={realGroupIndex === groups.length - 1}
                      className="p-1.5 rounded-lg bg-white hover:bg-slate-200 disabled:opacity-30 text-slate-600"
                      title="Move Category Down"
                    >
                      <MoveDown size={14} />
                    </button>

                    <button
                      onClick={() => {
                        setTargetCategory(group.category);
                        setShowAddModal(true);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-bold flex items-center gap-1 border border-sky-200 ml-1"
                    >
                      <Plus size={13} />
                      <span>Add Row</span>
                    </button>

                    <button
                      onClick={() => handleDeleteCategory(realGroupIndex)}
                      className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition ml-1"
                      title="Delete Category"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Items Table / Cards */}
                {group.items.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    Is category mein abhi koi features nahi hain. "Add Row" par click karke add karein.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {/* Header Columns for Desktop */}
                    <div className="hidden lg:grid grid-cols-12 gap-3 px-5 py-2.5 bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-400">
                      <div className="col-span-4">Feature Name & Rules</div>
                      <div className="col-span-2 text-center">Standard Free Limit</div>
                      <div className="col-span-2 text-center text-sky-700">Pro Basic Limit</div>
                      <div className="col-span-2 text-center text-purple-700">Max Ultra Limit</div>
                      <div className="col-span-2 text-right">Actions</div>
                    </div>

                    {group.items.map((item, iIdx) => {
                      const isSequential =
                        item.id === 'SEQ_READING' ||
                        item.label.toLowerCase().includes('sequential');

                      return (
                        <div
                          key={item.id || iIdx}
                          className={`p-4 sm:px-5 sm:py-3.5 transition hover:bg-slate-50/80 ${
                            isSequential ? 'bg-sky-50/40 border-l-4 border-l-sky-500' : ''
                          }`}
                        >
                          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
                            {/* Feature Label & Highlight */}
                            <div className="lg:col-span-4">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-mono text-slate-400 shrink-0">
                                  #{iIdx + 1}
                                </span>
                                <input
                                  type="text"
                                  value={item.label}
                                  onChange={e =>
                                    handleItemChange(realGroupIndex, iIdx, 'label', e.target.value)
                                  }
                                  className="w-full text-xs sm:text-sm font-bold text-slate-800 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-400"
                                  placeholder="Feature Name (e.g. Daily MCQ Limit)"
                                />
                              </div>
                              {isSequential && (
                                <p className="text-[10px] text-sky-700 font-semibold mt-1 pl-6 flex items-center gap-1">
                                  <span>🔒 Free: Always ON | Basic & Ultra: User self ON/OFF</span>
                                </p>
                              )}
                            </div>

                            {/* Free Tier Value */}
                            <div className="lg:col-span-2">
                              <div className="flex flex-col">
                                <label className="text-[9px] uppercase font-bold text-slate-400 lg:hidden mb-1">
                                  Free Limit
                                </label>
                                <input
                                  type="text"
                                  value={item.free}
                                  onChange={e =>
                                    handleItemChange(realGroupIndex, iIdx, 'free', e.target.value)
                                  }
                                  className="w-full text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-center focus:outline-none focus:ring-2 focus:ring-slate-300"
                                  placeholder="Free Value"
                                />
                                {/* Quick Tag Shortcuts */}
                                <div className="flex justify-center gap-1 mt-1">
                                  <button
                                    onClick={() => applyQuickTag(realGroupIndex, iIdx, 'free', '❌ Locked')}
                                    className="text-[9px] px-1 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600"
                                    title="Lock"
                                  >
                                    ❌ Lock
                                  </button>
                                  <button
                                    onClick={() => applyQuickTag(realGroupIndex, iIdx, 'free', '✅ Included')}
                                    className="text-[9px] px-1 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600"
                                    title="Include"
                                  >
                                    ✅ Free
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Basic Tier Value */}
                            <div className="lg:col-span-2">
                              <div className="flex flex-col">
                                <label className="text-[9px] uppercase font-bold text-sky-700 lg:hidden mb-1">
                                  Basic Limit
                                </label>
                                <input
                                  type="text"
                                  value={item.basic}
                                  onChange={e =>
                                    handleItemChange(realGroupIndex, iIdx, 'basic', e.target.value)
                                  }
                                  className="w-full text-xs font-semibold text-sky-900 bg-sky-50/50 border border-sky-200 rounded-xl px-2.5 py-1.5 text-center focus:outline-none focus:ring-2 focus:ring-sky-400"
                                  placeholder="Basic Value"
                                />
                                <div className="flex justify-center gap-1 mt-1">
                                  <button
                                    onClick={() => applyQuickTag(realGroupIndex, iIdx, 'basic', '✅ Yes')}
                                    className="text-[9px] px-1 py-0.5 rounded bg-sky-100 hover:bg-sky-200 text-sky-700"
                                  >
                                    ✅ Yes
                                  </button>
                                  <button
                                    onClick={() => applyQuickTag(realGroupIndex, iIdx, 'basic', '⚙️ Settings')}
                                    className="text-[9px] px-1 py-0.5 rounded bg-sky-100 hover:bg-sky-200 text-sky-700"
                                  >
                                    ⚙️ Toggle
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Ultra Tier Value */}
                            <div className="lg:col-span-2">
                              <div className="flex flex-col">
                                <label className="text-[9px] uppercase font-bold text-purple-700 lg:hidden mb-1">
                                  Ultra Limit
                                </label>
                                <input
                                  type="text"
                                  value={item.ultra}
                                  onChange={e =>
                                    handleItemChange(realGroupIndex, iIdx, 'ultra', e.target.value)
                                  }
                                  className="w-full text-xs font-bold text-purple-900 bg-purple-50/50 border border-purple-200 rounded-xl px-2.5 py-1.5 text-center focus:outline-none focus:ring-2 focus:ring-purple-400"
                                  placeholder="Ultra Value"
                                />
                                <div className="flex justify-center gap-1 mt-1">
                                  <button
                                    onClick={() => applyQuickTag(realGroupIndex, iIdx, 'ultra', '✅ Unlimited')}
                                    className="text-[9px] px-1 py-0.5 rounded bg-purple-100 hover:bg-purple-200 text-purple-700"
                                  >
                                    👑 Unlimited
                                  </button>
                                  <button
                                    onClick={() => applyQuickTag(realGroupIndex, iIdx, 'ultra', '⚙️ Settings')}
                                    className="text-[9px] px-1 py-0.5 rounded bg-purple-100 hover:bg-purple-200 text-purple-700"
                                  >
                                    ⚙️ Toggle
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Row Actions */}
                            <div className="lg:col-span-2 flex items-center justify-end gap-1 pt-2 lg:pt-0">
                              <button
                                onClick={() => handleMoveItem(realGroupIndex, iIdx, -1)}
                                disabled={iIdx === 0}
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-20 text-slate-600"
                                title="Move Up"
                              >
                                <MoveUp size={13} />
                              </button>
                              <button
                                onClick={() => handleMoveItem(realGroupIndex, iIdx, 1)}
                                disabled={iIdx === group.items.length - 1}
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-20 text-slate-600"
                                title="Move Down"
                              >
                                <MoveDown size={13} />
                              </button>
                              <button
                                onClick={() => handleDeleteItem(realGroupIndex, iIdx)}
                                className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition"
                                title="Delete Item"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── MODAL: ADD NEW FEATURE ROW ── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center font-black">
                  <Plus size={18} />
                </div>
                <h3 className="text-base font-black text-slate-900">Naya Feature Add Karein</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 py-4">
              <div>
                <label className="text-[11px] font-bold uppercase text-slate-500 block mb-1">
                  Category Choose Karein
                </label>
                <select
                  value={targetCategory}
                  onChange={e => setTargetCategory(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-semibold bg-white"
                >
                  {groups.map(g => (
                    <option key={g.id} value={g.category}>
                      {g.category}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase text-slate-500 block mb-1">
                  Feature / Limit Name
                </label>
                <input
                  type="text"
                  value={newLabel}
                  onChange={e => setNewLabel(e.target.value)}
                  placeholder="e.g. Daily MCQ Limit, Offline Download, etc."
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-sky-400"
                />
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                    Free Value
                  </label>
                  <input
                    type="text"
                    value={newFree}
                    onChange={e => setNewFree(e.target.value)}
                    placeholder="e.g. 🔒 Locked / 30"
                    className="w-full p-2 rounded-xl border border-slate-200 text-xs font-medium text-center"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-sky-700 block mb-1">
                    Basic Value
                  </label>
                  <input
                    type="text"
                    value={newBasic}
                    onChange={e => setNewBasic(e.target.value)}
                    placeholder="e.g. ✅ 50 / day"
                    className="w-full p-2 rounded-xl border border-sky-200 bg-sky-50/50 text-xs font-medium text-center"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-purple-700 block mb-1">
                    Ultra Value
                  </label>
                  <input
                    type="text"
                    value={newUltra}
                    onChange={e => setNewUltra(e.target.value)}
                    placeholder="e.g. ✅ Unlimited"
                    className="w-full p-2 rounded-xl border border-purple-200 bg-purple-50/50 text-xs font-medium text-center"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase text-slate-500 block mb-1">
                  Tooltip / Rule Detail (Optional)
                </label>
                <input
                  type="text"
                  value={newTooltip}
                  onChange={e => setNewTooltip(e.target.value)}
                  placeholder="Optional explanatory note"
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-medium"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleAddRow}
                disabled={!newLabel.trim()}
                className="px-5 py-2 rounded-xl text-xs font-black bg-sky-600 hover:bg-sky-700 disabled:opacity-40 text-white shadow-md"
              >
                Add Feature Row 🚀
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: ADD NEW CATEGORY ── */}
      {showAddCatModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-900">Nayi Category Jodein</h3>
              <button
                onClick={() => setShowAddCatModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"
              >
                ✕
              </button>
            </div>

            <div className="py-4">
              <label className="text-[11px] font-bold uppercase text-slate-500 block mb-1">
                Category Title
              </label>
              <input
                type="text"
                value={newCatName}
                onChange={e => setNewCatName(e.target.value)}
                placeholder="e.g. VIP Special Access, AI Tools..."
                className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-sky-400"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowAddCatModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCategory}
                disabled={!newCatName.trim()}
                className="px-5 py-2 rounded-xl text-xs font-black bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white shadow-md"
              >
                Create Category
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
