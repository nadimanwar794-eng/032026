import React, { useState, useMemo } from 'react';
import { X, Check, Lock, Crown, Search, Sparkles, Filter, ShieldCheck, Zap } from 'lucide-react';
import { SystemSettings } from '../types';
import { getMergedTierFeatures, TierFeatureItem } from '../constants/tierConfig';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  settings?: SystemSettings;
  discountActive?: boolean;
}

export const FeatureMatrixModal: React.FC<Props> = ({ isOpen, onClose, settings }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  const allFeatures = useMemo(() => {
    return getMergedTierFeatures(settings?.featureConfig);
  }, [settings?.featureConfig]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    allFeatures.forEach(f => {
      if (f.category) set.add(f.category);
    });
    return ['ALL', ...Array.from(set)];
  }, [allFeatures]);

  const filteredFeatures = useMemo(() => {
    return allFeatures.filter(f => {
      if (selectedCategory !== 'ALL' && f.category !== selectedCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchLabel = f.label.toLowerCase().includes(q);
        const matchCategory = f.category.toLowerCase().includes(q);
        const matchId = f.id.toLowerCase().includes(q);
        const matchDesc = f.description ? f.description.toLowerCase().includes(q) : false;
        return matchLabel || matchCategory || matchId || matchDesc;
      }
      return true;
    });
  }, [allFeatures, selectedCategory, searchQuery]);

  if (!isOpen) return null;

  const renderCellBadge = (val: string, tier: 'free' | 'basic' | 'ultra', unlockLevel?: number) => {
    const text = val || '—';
    const isDenied = text === '✗' || text.toLowerCase().includes('locked');
    const isFullCheck = text === '✓' || text === 'Free' || text.toLowerCase().includes('unlimited');
    const hasLevel = text.toLowerCase().includes('level') || unlockLevel;

    if (isDenied) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-200">
          <X size={12} className="stroke-[2.5]" />
          <span>Locked</span>
        </span>
      );
    }

    if (isFullCheck) {
      const colorCls = tier === 'ultra'
        ? 'text-purple-700 bg-purple-50 border-purple-200'
        : tier === 'basic'
        ? 'text-blue-700 bg-blue-50 border-blue-200'
        : 'text-emerald-700 bg-emerald-50 border-emerald-200';

      return (
        <span className={`inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded-lg border ${colorCls}`}>
          <Check size={13} className="stroke-[3]" />
          <span>{text === 'Free' ? 'Free' : 'Included'}</span>
        </span>
      );
    }

    // Custom formatted text (e.g. "20 cr / 5 diamond", "✓ Level 2", "50 cr", "1500", "1.5x", etc.)
    return (
      <span
        className={`inline-flex items-center justify-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg text-center ${
          tier === 'ultra'
            ? 'bg-purple-50/90 text-purple-900 border border-purple-200/80 font-black'
            : tier === 'basic'
            ? 'bg-blue-50/90 text-blue-900 border border-blue-200/80 font-bold'
            : 'bg-slate-100 text-slate-800 border border-slate-200 font-medium'
        }`}
      >
        {hasLevel && <span className="text-[10px]">⭐</span>}
        {text}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-2.5 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden max-h-[94vh] flex flex-col border border-slate-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 p-4 sm:p-6 text-white shrink-0 border-b border-white/10">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-xl bg-amber-400/20 border border-amber-400/30 text-amber-300">
                  <Crown size={20} className="fill-amber-400 text-amber-400" />
                </span>
                <h2 className="text-xl sm:text-2xl font-black tracking-tight">Plan Features Matrix</h2>
                <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-400/30">
                  FREE vs BASIC vs ULTRA
                </span>
              </div>
              <p className="text-slate-400 text-xs font-medium">
                Sabhi 31+ features, study modes, revision slates aur messenger limits ki complete tulna
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-slate-300 hover:text-white transition-all cursor-pointer"
              title="Close"
            >
              <X size={18} />
            </button>
          </div>

          {/* Search & Category Filter Bar */}
          <div className="mt-4 flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search any feature (e.g. Reading mode, MCQ, Video, Slate)..."
                className="w-full bg-white/10 border border-white/15 text-white placeholder-slate-400 text-xs rounded-xl pl-9 pr-3 py-2 outline-none focus:border-sky-400 focus:bg-white/15 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="text-[11px] text-slate-400 font-medium self-end sm:self-center">
              Total {filteredFeatures.length} features listed
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex gap-1.5 overflow-x-auto pt-3 pb-1 scrollbar-none text-[10px]">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-lg font-bold whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'bg-white/5 text-slate-300 hover:bg-white/10 border border-white/5'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Sticky Column Headers */}
        <div className="grid grid-cols-12 bg-slate-100 border-b border-slate-200 shrink-0 text-center sticky top-0 z-20 shadow-xs text-xs font-black">
          <div className="col-span-5 sm:col-span-4 p-3 pl-4 flex items-center justify-start text-slate-600 uppercase tracking-wider text-[11px]">
            Feature / Item
          </div>
          <div className="col-span-2 sm:col-span-2 p-3 bg-emerald-50/90 text-emerald-800 border-l border-white">
            <span className="block text-xs font-black">FREE</span>
            <span className="block text-[9px] font-semibold text-emerald-600">Starter Plan</span>
          </div>
          <div className="col-span-2 sm:col-span-3 p-3 bg-sky-50/90 text-sky-800 border-l border-white">
            <span className="block text-xs font-black">⭐ BASIC</span>
            <span className="block text-[9px] font-semibold text-sky-600">Pro Plan</span>
          </div>
          <div className="col-span-3 sm:col-span-3 p-3 bg-purple-50/90 text-purple-900 border-l border-white">
            <span className="block text-xs font-black flex items-center justify-center gap-1">
              👑 ULTRA
            </span>
            <span className="block text-[9px] font-semibold text-purple-600">All Unlocked</span>
          </div>
        </div>

        {/* Scrollable Table Body */}
        <div className="overflow-y-auto flex-1 custom-scrollbar divide-y divide-slate-100 bg-white">
          {filteredFeatures.length === 0 ? (
            <div className="p-12 text-center text-slate-400 space-y-2">
              <p className="font-bold text-sm">Koi feature match nahi hua.</p>
              <p className="text-xs">Search query ya category filter clear karke dekhein.</p>
              <button
                onClick={() => { setSearchQuery(''); setSelectedCategory('ALL'); }}
                className="mt-2 px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
              >
                Filters Reset Karein
              </button>
            </div>
          ) : (
            filteredFeatures.map((f, idx) => {
              const isLockedByAdmin = f.visible === false;
              return (
                <div
                  key={f.id}
                  className={`grid grid-cols-12 items-center py-2.5 px-1 hover:bg-slate-50/80 transition-colors ${
                    isLockedByAdmin ? 'bg-slate-50/60 opacity-60' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'
                  }`}
                >
                  {/* Feature Title & Category */}
                  <div className="col-span-5 sm:col-span-4 pl-3 pr-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[9px] font-black text-slate-400 bg-slate-100 px-1 rounded font-mono">
                        #{f.sn}
                      </span>
                      <span className="font-bold text-xs text-slate-800 leading-snug">
                        {f.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="text-[9px] font-semibold text-slate-500">
                        {f.category}
                      </span>
                      {f.unlockLevel ? (
                        <span className="text-[8.5px] font-black bg-amber-100 text-amber-800 px-1 rounded border border-amber-200">
                          🔒 Level {f.unlockLevel}+ Required
                        </span>
                      ) : null}
                      {f.description && (
                        <span className="text-[9px] text-slate-400 hidden sm:inline truncate max-w-[200px]" title={f.description}>
                          • {f.description}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Free Column */}
                  <div className="col-span-2 sm:col-span-2 text-center px-1">
                    {renderCellBadge(f.free, 'free', f.unlockLevel)}
                  </div>

                  {/* Basic Column */}
                  <div className="col-span-2 sm:col-span-3 text-center px-1">
                    {renderCellBadge(f.basic, 'basic', f.unlockLevel)}
                  </div>

                  {/* Ultra Column */}
                  <div className="col-span-3 sm:col-span-3 text-center px-1">
                    {renderCellBadge(f.ultra, 'ultra', f.unlockLevel)}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 shrink-0">
          <div className="text-[10px] text-slate-500 font-medium text-center sm:text-left">
            * Features and limits are dynamically synced with Admin NSTA Control. Unlocks below required levels remain locked until reached.
          </div>
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-bold text-xs rounded-xl transition cursor-pointer"
          >
            Close Matrix
          </button>
        </div>

      </div>
    </div>
  );
};
