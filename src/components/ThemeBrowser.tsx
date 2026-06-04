import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { ALL_THEMES, THEME_CATEGORIES, getThemesByCategory, AppTheme, ThemeCategory, ThemeRarity } from '../utils/themeLibrary';
import type { User, SystemSettings } from '../types';
import { TopBarEffectsLayer } from '../utils/topBarEffects';
import { Search, X, Lock, Zap, Clock, CheckCircle2, ChevronDown, ChevronUp, Calendar, Users, Star, Palette, Globe, Shield } from 'lucide-react';
import { getLevelInfo } from '../utils/levelSystem';

interface Props {
  user: User;
  settings?: SystemSettings;
  isAdmin?: boolean;
  onApplyTheme?: (theme: AppTheme) => void;
  onScheduleTheme?: (theme: AppTheme) => void;
  onBack?: () => void;
  accentColor?: string;
}

const RARITY_COLORS: Record<ThemeRarity, string> = {
  COMMON: '#64748b',
  RARE: '#3b82f6',
  EPIC: '#a855f7',
  LEGENDARY: '#f59e0b',
};
const RARITY_LABELS: Record<ThemeRarity, string> = {
  COMMON: 'Common',
  RARE: 'Rare',
  EPIC: 'Epic',
  LEGENDARY: 'Legendary✨',
};
const RARITY_GLOW: Record<ThemeRarity, string> = {
  COMMON: 'none',
  RARE: '0 0 10px #3b82f640',
  EPIC: '0 0 14px #a855f740',
  LEGENDARY: '0 0 20px #f59e0b60',
};

const CAT_META: Record<string, { emoji: string; label: string; desc: string; color: string }> = {
  STUDY:   { emoji: '📚', label: 'Study',   desc: 'Calm & focus — easy on eyes',      color: '#22d3ee' },
  AMOLED:  { emoji: '🌑', label: 'AMOLED',  desc: 'True black — battery saver',       color: '#94a3b8' },
  REWARD:  { emoji: '🏆', label: 'Reward',  desc: 'Unlock by reaching levels',        color: '#f59e0b' },
  EVENT:   { emoji: '🎉', label: 'Event',   desc: 'Festival & temporary themes',      color: '#f472b6' },
  PREMIUM: { emoji: '💎', label: 'Premium', desc: 'Rare animated premium themes',     color: '#a855f7' },
};

const PAGE_SIZE = 60;

// Animated shimmer for legendary cards
function LegendaryShimmer({ color }: { color: string }) {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        background: `linear-gradient(105deg, transparent 40%, ${color}30 50%, transparent 60%)`,
        backgroundSize: '200% 100%',
        animation: 'shimmer 2.5s infinite linear',
      }}
    />
  );
}

// Color mix animation strip for card preview
function ColorMixStrip({ colors, animated }: { colors: string[]; animated: boolean }) {
  return (
    <div className="flex h-full">
      {colors.map((c, i) => (
        <div
          key={i}
          className="flex-1 transition-all"
          style={{
            background: c,
            animation: animated ? `colorPulse${i % 3} ${2 + i * 0.4}s ease-in-out infinite alternate` : 'none',
          }}
        />
      ))}
    </div>
  );
}

export function ThemeBrowser({ user, settings, isAdmin, onApplyTheme, onScheduleTheme, onBack, accentColor = '#3b82f6' }: Props) {
  const [selectedCat, setSelectedCat] = useState<ThemeCategory | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [selectedTheme, setSelectedTheme] = useState<AppTheme | null>(null);
  const [showSchedulePanel, setShowSchedulePanel] = useState(false);
  const [showRealtimePanel, setShowRealtimePanel] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [rarityFilter, setRarityFilter] = useState<ThemeRarity | 'ALL'>('ALL');
  const [animatedOnly, setAnimatedOnly] = useState(false);

  // Schedule options
  const [schedTarget, setSchedTarget] = useState<'ALL' | 'FREE' | 'BASIC' | 'ULTRA'>('ALL');
  // Start delay: D/H/M/S
  const [schedDelayDays,  setSchedDelayDays]  = useState(0);
  const [schedDelayHours, setSchedDelayHours] = useState(0);
  const [schedDelayMins,  setSchedDelayMins]  = useState(0);
  const [schedDelaySecs,  setSchedDelaySecs]  = useState(0);
  // Duration: D/H/M/S
  const [schedDurDays,  setSchedDurDays]  = useState(1);
  const [schedDurHours, setSchedDurHours] = useState(0);
  const [schedDurMins,  setSchedDurMins]  = useState(0);
  const [schedDurSecs,  setSchedDurSecs]  = useState(0);
  const [schedApplyProfile, setSchedApplyProfile] = useState(false);
  const [schedApplyBg, setSchedApplyBg] = useState(false);
  const [schedSaved, setSchedSaved] = useState(false);
  const [themeForScope, setThemeForScope] = useState<AppTheme | null>(null);
  const [applyScope, setApplyScope] = useState({
    topBar: true, background: true, cards: true, navBar: true, buttons: true, text: true, progress: true,
  });

  const userLevel = getLevelInfo(user.totalScore || 0).level;

  const filtered = useMemo(() => {
    let list = selectedCat === 'ALL' ? ALL_THEMES : getThemesByCategory(selectedCat as ThemeCategory);
    if (rarityFilter !== 'ALL') list = list.filter(t => t.rarity === rarityFilter);
    if (animatedOnly) list = list.filter(t => t.isAnimated);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(t =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.tags.some(tag => tag.includes(q))
      );
    }
    return list;
  }, [selectedCat, search, rarityFilter, animatedOnly]);

  const prevFilterKey = useRef('');
  const filterKey = selectedCat + '|' + search + '|' + rarityFilter + '|' + animatedOnly;
  if (filterKey !== prevFilterKey.current) {
    prevFilterKey.current = filterKey;
    if (visibleCount !== PAGE_SIZE) setVisibleCount(PAGE_SIZE);
  }

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  const handleApply = useCallback((theme: AppTheme) => {
    if (theme.unlockLevel && userLevel < theme.unlockLevel && !isAdmin) return;
    if (isAdmin) {
      setSelectedTheme(null);
      onApplyTheme?.(theme);
    } else {
      setThemeForScope(theme);
      setApplyScope({ topBar: true, background: true, cards: true, navBar: true, buttons: true, text: true, progress: true });
    }
  }, [userLevel, isAdmin, onApplyTheme]);

  const confirmApply = useCallback(() => {
    if (!themeForScope) return;
    setSelectedTheme(null);
    setThemeForScope(null);
    onApplyTheme?.(themeForScope);
  }, [themeForScope, onApplyTheme]);

  const schedDelayMs = (schedDelayDays * 86400 + schedDelayHours * 3600 + schedDelayMins * 60 + schedDelaySecs) * 1000;
  const schedDurMs   = (schedDurDays  * 86400 + schedDurHours  * 3600 + schedDurMins  * 60 + schedDurSecs)  * 1000;

  const handleSchedule = useCallback(() => {
    if (!selectedTheme) return;
    const delayMs    = (schedDelayDays * 86400 + schedDelayHours * 3600 + schedDelayMins * 60 + schedDelaySecs) * 1000;
    const durationMs = (schedDurDays  * 86400 + schedDurHours  * 3600 + schedDurMins  * 60 + schedDurSecs)  * 1000;
    const scheduledAt = new Date(Date.now() + delayMs).toISOString();
    onScheduleTheme?.({
      ...selectedTheme,
      _scheduleConfig: {
        target: schedTarget,
        durationMs,
        delayMs,
        scheduledAt,
        applyToProfile: schedApplyProfile,
        applyToBackground: schedApplyBg,
      } as any,
    } as AppTheme);
    setShowSchedulePanel(false);
    setShowRealtimePanel(false);
    setSelectedTheme(null);
    setSchedSaved(true);
    setTimeout(() => setSchedSaved(false), 3000);
  }, [selectedTheme, schedTarget, schedDurDays, schedDurHours, schedDurMins, schedDurSecs,
      schedDelayDays, schedDelayHours, schedDelayMins, schedDelaySecs,
      schedApplyProfile, schedApplyBg, onScheduleTheme]);

  const handleBroadcastNow = useCallback(() => {
    if (!selectedTheme) return;
    const durationMs = (schedDurDays  * 86400 + schedDurHours  * 3600 + schedDurMins  * 60 + schedDurSecs)  * 1000;
    const scheduledAt = new Date().toISOString();
    onScheduleTheme?.({
      ...selectedTheme,
      _scheduleConfig: {
        target: schedTarget,
        durationMs,
        delayMs: 0,
        scheduledAt,
        applyToProfile: schedApplyProfile,
        applyToBackground: schedApplyBg,
      } as any,
    } as AppTheme);
    setShowRealtimePanel(false);
    setShowSchedulePanel(false);
    setSelectedTheme(null);
    setSchedSaved(true);
    setTimeout(() => setSchedSaved(false), 3000);
  }, [selectedTheme, schedTarget, schedDurDays, schedDurHours, schedDurMins, schedDurSecs,
      schedApplyProfile, schedApplyBg, onScheduleTheme]);

  const catCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: ALL_THEMES.length };
    THEME_CATEGORIES.forEach(cat => {
      counts[cat.id] = ALL_THEMES.filter(t => t.category === cat.id).length;
    });
    return counts;
  }, []);

  return (
    <div className="flex flex-col min-h-screen pb-32 select-none" style={{ background: '#06080f' }}>
      <style>{`
        @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes colorPulse0 { from{opacity:0.85} to{opacity:1} }
        @keyframes colorPulse1 { from{opacity:0.9} to{opacity:1} }
        @keyframes colorPulse2 { from{opacity:0.8} to{opacity:1} }
        @keyframes legendaryPulse { 0%,100%{box-shadow:0 0 16px #f59e0b50} 50%{box-shadow:0 0 28px #f59e0b90} }
        @keyframes epicPulse { 0%,100%{box-shadow:0 0 10px #a855f730} 50%{box-shadow:0 0 20px #a855f760} }
        @keyframes rarePulse { 0%,100%{box-shadow:0 0 6px #3b82f620} 50%{box-shadow:0 0 14px #3b82f650} }
        @keyframes floatBadge { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-2px)} }
      `}</style>

      {/* Header */}
      <div
        className="sticky top-0 z-20 px-4 py-3 shadow-2xl"
        style={{ background: `linear-gradient(135deg, #0f1e3c, #1e3a5f)`, boxShadow: `0 4px 24px ${accentColor}25` }}
      >
        <div className="flex items-center gap-3 mb-3">
          {onBack && (
            <button
              onClick={onBack}
              className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center shrink-0 active:scale-90 transition-transform"
            >
              <X size={14} className="text-white" />
            </button>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-white">🎨 Theme Library</p>
            <p className="text-[9px] text-white/45">
              {ALL_THEMES.length} themes · 5 categories · {ALL_THEMES.filter(t => t.isAnimated).length} animated
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[8px] text-white/35 uppercase font-bold">Your Level</p>
            <p className="text-sm font-black text-amber-400">Lv.{userLevel}</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Theme naam, tag ya color dhundho..."
            className="w-full bg-white/8 border border-white/10 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:border-white/20"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X size={10} className="text-white/30" />
            </button>
          )}
        </div>

        {/* Quick filter row */}
        <div className="flex gap-2 mt-2">
          <button
            onClick={() => setAnimatedOnly(v => !v)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black border transition-all"
            style={{
              background: animatedOnly ? '#f59e0b20' : 'transparent',
              borderColor: animatedOnly ? '#f59e0b60' : 'rgba(255,255,255,0.1)',
              color: animatedOnly ? '#f59e0b' : 'rgba(255,255,255,0.4)',
            }}
          >
            <Zap size={8} /> Animated Only
          </button>
          {(['ALL', 'LEGENDARY', 'EPIC', 'RARE'] as const).map(r => (
            <button
              key={r}
              onClick={() => setRarityFilter(r)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black border transition-all"
              style={{
                background: rarityFilter === r ? `${RARITY_COLORS[r as ThemeRarity] || accentColor}20` : 'transparent',
                borderColor: rarityFilter === r ? `${RARITY_COLORS[r as ThemeRarity] || accentColor}60` : 'rgba(255,255,255,0.08)',
                color: rarityFilter === r ? (RARITY_COLORS[r as ThemeRarity] || accentColor) : 'rgba(255,255,255,0.3)',
              }}
            >
              {r === 'ALL' ? 'All' : r === 'LEGENDARY' ? '✨ Legend' : r === 'EPIC' ? '💜 Epic' : '💙 Rare'}
            </button>
          ))}
        </div>
      </div>

      {/* Category tabs */}
      <div className="px-4 pt-3 pb-1 overflow-x-auto scrollbar-none">
        <div className="flex gap-2 w-max">
          <CategoryTab
            id="ALL"
            label="✨ All"
            count={catCounts.ALL}
            selected={selectedCat === 'ALL'}
            color={accentColor}
            onClick={() => setSelectedCat('ALL')}
          />
          {THEME_CATEGORIES.map(cat => {
            const meta = CAT_META[cat.id];
            return (
              <CategoryTab
                key={cat.id}
                id={cat.id}
                label={`${meta?.emoji || cat.emoji} ${meta?.label || cat.label}`}
                count={catCounts[cat.id] || 0}
                selected={selectedCat === cat.id}
                color={meta?.color || accentColor}
                desc={meta?.desc}
                onClick={() => setSelectedCat(cat.id as ThemeCategory)}
              />
            );
          })}
        </div>
      </div>

      {/* Category description */}
      {selectedCat !== 'ALL' && CAT_META[selectedCat] && (
        <div className="px-4 py-1.5">
          <p className="text-[9px] text-white/30 font-bold">{CAT_META[selectedCat].desc}</p>
        </div>
      )}

      {/* Results count */}
      <div className="px-4 pt-1 pb-1 flex items-center gap-3">
        <p className="text-[9px] text-white/20 font-bold uppercase tracking-wider flex-1">
          {filtered.length} themes
          {hasMore ? ` · showing ${visible.length}` : ''}
          {animatedOnly ? ' · animated only' : ''}
        </p>
        {schedSaved && (
          <span className="text-[9px] text-green-400 font-black flex items-center gap-1 animate-pulse">
            <CheckCircle2 size={9} /> Scheduled!
          </span>
        )}
      </div>

      {/* Theme grid */}
      <div className="flex-1 px-4 grid grid-cols-2 gap-3 pb-4">
        {visible.map(theme => {
          const locked = !isAdmin && !!theme.unlockLevel && userLevel < theme.unlockLevel;
          return (
            <ThemeCard
              key={theme.id}
              theme={theme}
              locked={locked}
              onSelect={() => setSelectedTheme(theme)}
              accentColor={accentColor}
            />
          );
        })}
        {filtered.length === 0 && (
          <div className="col-span-2 text-center py-16">
            <p className="text-4xl mb-3">🔍</p>
            <p className="text-sm font-black text-white/30">Koi theme nahi mila</p>
            <p className="text-[10px] text-white/15 mt-1">Dusre keywords try karo</p>
          </div>
        )}
        {hasMore && (
          <div className="col-span-2 py-3">
            <button
              onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
              className="w-full py-3 rounded-2xl text-xs font-black transition-all active:scale-95 border"
              style={{
                background: `${accentColor}12`,
                borderColor: `${accentColor}35`,
                color: accentColor,
              }}
            >
              Aur Load Karo · {filtered.length - visible.length} baki
            </button>
          </div>
        )}
      </div>

      {/* Theme Detail Modal */}
      {selectedTheme && (
        <ThemeDetailModal
          theme={selectedTheme}
          isAdmin={!!isAdmin}
          userLevel={userLevel}
          accentColor={accentColor}
          showSchedulePanel={showSchedulePanel}
          setShowSchedulePanel={setShowSchedulePanel}
          showRealtimePanel={showRealtimePanel}
          setShowRealtimePanel={setShowRealtimePanel}
          schedTarget={schedTarget}
          setSchedTarget={setSchedTarget}
          schedDelayDays={schedDelayDays}   setSchedDelayDays={setSchedDelayDays}
          schedDelayHours={schedDelayHours} setSchedDelayHours={setSchedDelayHours}
          schedDelayMins={schedDelayMins}   setSchedDelayMins={setSchedDelayMins}
          schedDelaySecs={schedDelaySecs}   setSchedDelaySecs={setSchedDelaySecs}
          schedDurDays={schedDurDays}       setSchedDurDays={setSchedDurDays}
          schedDurHours={schedDurHours}     setSchedDurHours={setSchedDurHours}
          schedDurMins={schedDurMins}       setSchedDurMins={setSchedDurMins}
          schedDurSecs={schedDurSecs}       setSchedDurSecs={setSchedDurSecs}
          schedDelayMs={schedDelayMs}
          schedDurMs={schedDurMs}
          schedApplyProfile={schedApplyProfile}
          setSchedApplyProfile={setSchedApplyProfile}
          schedApplyBg={schedApplyBg}
          setSchedApplyBg={setSchedApplyBg}
          onApply={handleApply}
          onSchedule={handleSchedule}
          onBroadcastNow={handleBroadcastNow}
          onClose={() => { setSelectedTheme(null); setShowSchedulePanel(false); setShowRealtimePanel(false); }}
        />
      )}
    </div>
  );
}

// ─── Category Tab ────────────────────────────────────────────────────────────
function CategoryTab({ id, label, count, selected, color, desc, onClick }: {
  id: string; label: string; count: number; selected: boolean;
  color: string; desc?: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="shrink-0 flex flex-col items-center px-3 py-2 rounded-2xl text-left transition-all active:scale-90 border"
      style={{
        background: selected ? `linear-gradient(135deg, ${color}25, ${color}12)` : '#0d0f1a',
        borderColor: selected ? `${color}60` : 'rgba(255,255,255,0.06)',
        boxShadow: selected ? `0 4px 16px ${color}25` : 'none',
        minWidth: 72,
      }}
    >
      <div className="flex items-center gap-1.5 w-full">
        <span
          className="text-[10px] font-black"
          style={{ color: selected ? color : 'rgba(255,255,255,0.5)' }}
        >
          {label}
        </span>
        <span
          className="ml-auto text-[7px] font-black px-1.5 py-0.5 rounded-full"
          style={{
            background: selected ? `${color}30` : 'rgba(255,255,255,0.05)',
            color: selected ? color : 'rgba(255,255,255,0.3)',
          }}
        >
          {count}
        </span>
      </div>
      {selected && desc && (
        <p className="text-[7px] mt-0.5 w-full" style={{ color: `${color}90` }}>{desc}</p>
      )}
    </button>
  );
}

// ─── Theme Card ──────────────────────────────────────────────────────────────
function ThemeCard({ theme, locked, onSelect, accentColor }: {
  theme: AppTheme; locked: boolean; onSelect: () => void; accentColor: string;
}) {
  const rarityColor = RARITY_COLORS[theme.rarity];
  const isLegendary = theme.rarity === 'LEGENDARY';
  const isEpic = theme.rarity === 'EPIC';
  const isRare = theme.rarity === 'RARE';

  const colorMixColors = [
    theme.colors.topBarStart,
    theme.colors.navActive,
    theme.colors.btnStart,
    theme.colors.accentGlow,
    theme.colors.topBarEnd,
  ];

  return (
    <button
      onClick={onSelect}
      className="rounded-2xl overflow-hidden text-left active:scale-95 transition-all relative"
      style={{
        background: '#0d0f1a',
        border: `1px solid ${locked ? 'rgba(255,255,255,0.05)' : `${rarityColor}35`}`,
        opacity: locked ? 0.55 : 1,
        animation:
          isLegendary && !locked ? 'legendaryPulse 2.5s ease-in-out infinite' :
          isEpic && !locked ? 'epicPulse 3s ease-in-out infinite' :
          isRare && !locked ? 'rarePulse 3.5s ease-in-out infinite' : 'none',
      }}
    >
      {/* Top bar preview with color mix + animation */}
      <div
        className="relative h-16 overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${theme.colors.topBarStart}, ${theme.colors.topBarEnd})` }}
      >
        {/* Color mixing strip at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-4 flex overflow-hidden opacity-70">
          {colorMixColors.map((c, i) => (
            <div
              key={i}
              className="flex-1"
              style={{
                background: c,
                filter: 'blur(1px)',
                animation: theme.isAnimated ? `colorPulse${i % 3} ${1.8 + i * 0.3}s ease-in-out infinite alternate` : 'none',
              }}
            />
          ))}
        </div>

        {/* Animated effect layer */}
        {theme.isAnimated && theme.topBarEffect && !locked && (
          <div className="absolute inset-0 overflow-hidden">
            <TopBarEffectsLayer effects={[{
              id: theme.topBarEffect,
              enabled: true,
              color: theme.animColor || theme.colors.accentGlow,
              speed: (theme.animSpeed || 1) * 0.6,
            }]} />
          </div>
        )}

        {/* Legendary shimmer */}
        {isLegendary && !locked && (
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(105deg, transparent 35%, ${rarityColor}20 50%, transparent 65%)`,
              backgroundSize: '200% 100%',
              animation: 'shimmer 2s infinite linear',
            }}
          />
        )}

        {/* Lock overlay */}
        {locked && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 gap-1">
            <Lock size={14} className="text-amber-400" />
            <span className="text-[7px] text-amber-400 font-black">Lv.{theme.unlockLevel}</span>
          </div>
        )}

        {/* Rarity badge */}
        <div
          className="absolute top-1.5 right-1.5 text-[6px] font-black px-1.5 py-0.5 rounded-full"
          style={{
            background: `${rarityColor}30`,
            color: rarityColor,
            backdropFilter: 'blur(4px)',
            animation: isLegendary ? 'floatBadge 2s ease-in-out infinite' : 'none',
          }}
        >
          {isLegendary ? '✨' : isEpic ? '💜' : isRare ? '💙' : ''}{RARITY_LABELS[theme.rarity].charAt(0)}
        </div>

        {/* Animated indicator */}
        {theme.isAnimated && !locked && (
          <div
            className="absolute top-1.5 left-1.5 w-4 h-4 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
          >
            <Zap size={8} className="text-yellow-300" />
          </div>
        )}

        {/* Emoji */}
        <div className="absolute bottom-4 left-2.5">
          <span className="text-xl drop-shadow-lg">{theme.emoji}</span>
        </div>
      </div>

      {/* Card body bg preview strip */}
      <div className="h-2.5 flex overflow-hidden">
        <div className="flex-1" style={{ background: theme.colors.navBg }} />
        <div className="flex-1" style={{ background: theme.colors.cardBg }} />
        <div className="flex-1" style={{ background: theme.colors.btnStart }} />
        <div className="flex-1" style={{ background: theme.colors.navBg }} />
      </div>

      {/* Info */}
      <div className="p-2.5 pt-2">
        <p className="text-[10px] font-black text-white truncate leading-tight">{theme.name}</p>
        <p className="text-[7px] text-white/35 mt-0.5 leading-tight line-clamp-2">{theme.description}</p>

        {/* Color dots row */}
        <div className="flex items-center gap-1 mt-1.5">
          {[
            theme.colors.navActive,
            theme.colors.btnStart,
            theme.colors.btnEnd,
            theme.colors.accentGlow,
            theme.colors.progressColor,
          ].map((c, i) => (
            <div
              key={i}
              className="w-3 h-3 rounded-full border border-white/15 shadow-sm"
              style={{ background: c }}
            />
          ))}
          {theme.isAnimated && (
            <span className="ml-auto text-[7px] font-black text-yellow-400 flex items-center gap-0.5">
              <Zap size={7} />anim
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// ─── Theme Detail Modal ───────────────────────────────────────────────────────
function ThemeDetailModal({
  theme, isAdmin, userLevel, accentColor,
  showSchedulePanel, setShowSchedulePanel,
  showRealtimePanel, setShowRealtimePanel,
  schedTarget, setSchedTarget,
  schedDelayDays, setSchedDelayDays,
  schedDelayHours, setSchedDelayHours,
  schedDelayMins, setSchedDelayMins,
  schedDelaySecs, setSchedDelaySecs,
  schedDurDays, setSchedDurDays,
  schedDurHours, setSchedDurHours,
  schedDurMins, setSchedDurMins,
  schedDurSecs, setSchedDurSecs,
  schedDelayMs, schedDurMs,
  schedApplyProfile, setSchedApplyProfile,
  schedApplyBg, setSchedApplyBg,
  onApply, onSchedule, onBroadcastNow, onClose,
}: {
  theme: AppTheme;
  isAdmin: boolean;
  userLevel: number;
  accentColor: string;
  showSchedulePanel: boolean;
  setShowSchedulePanel: (v: boolean) => void;
  showRealtimePanel: boolean;
  setShowRealtimePanel: (v: boolean) => void;
  schedTarget: 'ALL' | 'FREE' | 'BASIC' | 'ULTRA';
  setSchedTarget: (v: 'ALL' | 'FREE' | 'BASIC' | 'ULTRA') => void;
  schedDelayDays: number; setSchedDelayDays: (v: number) => void;
  schedDelayHours: number; setSchedDelayHours: (v: number) => void;
  schedDelayMins: number; setSchedDelayMins: (v: number) => void;
  schedDelaySecs: number; setSchedDelaySecs: (v: number) => void;
  schedDurDays: number; setSchedDurDays: (v: number) => void;
  schedDurHours: number; setSchedDurHours: (v: number) => void;
  schedDurMins: number; setSchedDurMins: (v: number) => void;
  schedDurSecs: number; setSchedDurSecs: (v: number) => void;
  schedDelayMs: number;
  schedDurMs: number;
  schedApplyProfile: boolean;
  setSchedApplyProfile: (v: boolean) => void;
  schedApplyBg: boolean;
  setSchedApplyBg: (v: boolean) => void;
  onApply: (t: AppTheme) => void;
  onSchedule: () => void;
  onBroadcastNow: () => void;
  onClose: () => void;
}) {
  const rarityColor = RARITY_COLORS[theme.rarity];
  const isLocked = !isAdmin && !!theme.unlockLevel && userLevel < theme.unlockLevel;
  const isLegendary = theme.rarity === 'LEGENDARY';
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if ((showSchedulePanel || showRealtimePanel) && scrollRef.current) {
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
        }
      }, 100);
    }
  }, [showSchedulePanel, showRealtimePanel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm mx-2 mb-4 rounded-3xl overflow-hidden shadow-2xl border border-white/10"
        style={{ background: '#0a0c14', maxHeight: '92vh' }}
        onClick={e => e.stopPropagation()}
      >
      <div ref={scrollRef} style={{ overflowY: 'auto', maxHeight: '92vh', WebkitOverflowScrolling: 'touch' }}>
        {/* Preview top bar */}
        <div
          className="relative h-32 flex flex-col justify-between p-4"
          style={{ background: `linear-gradient(135deg, ${theme.colors.topBarStart}, ${theme.colors.topBarEnd})` }}
        >
          {theme.topBarEffect && (
            <div className="absolute inset-0 overflow-hidden">
              <TopBarEffectsLayer effects={[{
                id: theme.topBarEffect,
                enabled: true,
                color: theme.animColor || theme.colors.accentGlow,
                speed: theme.animSpeed,
              }]} />
            </div>
          )}
          {isLegendary && (
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(105deg, transparent 35%, ${rarityColor}18 50%, transparent 65%)`,
                backgroundSize: '200% 100%',
                animation: 'shimmer 2s infinite linear',
              }}
            />
          )}

          <div className="flex justify-between items-start relative z-10">
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-black/35 flex items-center justify-center active:scale-90 transition-transform"
            >
              <X size={12} className="text-white" />
            </button>
            <span
              className="text-[8px] font-black px-2.5 py-1 rounded-full"
              style={{ background: `${rarityColor}30`, color: rarityColor }}
            >
              {RARITY_LABELS[theme.rarity]}
            </span>
          </div>

          <div className="flex items-end gap-3 relative z-10">
            <span className="text-5xl drop-shadow-2xl">{theme.emoji}</span>
            <div>
              <p className="text-base font-black text-white leading-tight">{theme.name}</p>
              <p className="text-[9px] text-white/55 mt-0.5">{theme.description}</p>
            </div>
          </div>
        </div>

        {/* Color mixing preview band */}
        <div className="h-4 flex overflow-hidden">
          {[
            theme.colors.topBarStart, theme.colors.navActive, theme.colors.btnStart,
            theme.colors.accentGlow, theme.colors.btnEnd, theme.colors.progressColor,
          ].map((c, i) => (
            <div
              key={i}
              className="flex-1"
              style={{
                background: c,
                animation: theme.isAnimated ? `colorPulse${i % 3} ${1.5 + i * 0.25}s ease-in-out infinite alternate` : 'none',
              }}
            />
          ))}
        </div>

        {/* App preview section */}
        <div className="p-3" style={{ background: theme.colors.bgColor }}>
          <div className="grid grid-cols-3 gap-1.5 mb-1.5">
            {['📚 Notes', '🎯 MCQ', '🏆 Rank'].map(label => (
              <div
                key={label}
                className="rounded-xl p-2 text-center"
                style={{ background: theme.colors.cardBg, border: `1px solid ${theme.colors.cardBorder}` }}
              >
                <p className="text-[8px] font-bold" style={{ color: theme.colors.textPrimary }}>{label}</p>
              </div>
            ))}
          </div>
          <div
            className="rounded-xl py-2 text-center"
            style={{ background: `linear-gradient(135deg, ${theme.colors.btnStart}, ${theme.colors.btnEnd})` }}
          >
            <p className="text-[8px] font-black text-white">⚡ Padhna Shuru Karo</p>
          </div>
        </div>

        {/* Nav preview */}
        <div
          className="flex border-t"
          style={{ background: theme.colors.navBg, borderColor: theme.colors.navBorder }}
        >
          {['🏠', '📖', '🎯', '👤'].map((icon, i) => (
            <div
              key={icon}
              className="flex-1 py-2 flex flex-col items-center gap-0.5"
              style={{ opacity: i === 0 ? 1 : 0.3 }}
            >
              <span className="text-[11px]">{icon}</span>
              <div className="h-0.5 w-4 rounded-full" style={{ background: i === 0 ? theme.colors.navActive : 'transparent' }} />
            </div>
          ))}
        </div>

        {/* Details */}
        <div className="p-4 space-y-3">
          {/* Tags */}
          {theme.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {theme.tags.slice(0, 8).map(tag => (
                <span
                  key={tag}
                  className="text-[8px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: `${rarityColor}12`, color: rarityColor }}
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Color palette */}
          <div>
            <p className="text-[8px] text-white/25 font-bold uppercase tracking-wider mb-1.5">Color Palette</p>
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { label: 'Nav', color: theme.colors.navActive },
                { label: 'Btn', color: theme.colors.btnStart },
                { label: 'Btn2', color: theme.colors.btnEnd },
                { label: 'Glow', color: theme.colors.accentGlow },
                { label: 'Progress', color: theme.colors.progressColor },
                { label: 'Card', color: theme.colors.cardBg },
                { label: 'Bar', color: theme.colors.topBarStart },
              ].map(({ label, color }) => (
                <div key={label} className="flex flex-col items-center gap-0.5">
                  <div className="w-6 h-6 rounded-lg border border-white/15 shadow-lg" style={{ background: color }} />
                  <span className="text-[6px] text-white/25">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Animated effect badge */}
          {theme.isAnimated && theme.topBarEffect && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-yellow-500/20 bg-yellow-500/5">
              <Zap size={11} className="text-yellow-400 shrink-0" />
              <div>
                <p className="text-[9px] font-black text-yellow-300">Animated Top Bar Effect</p>
                <p className="text-[7px] text-white/30">Effect ID: {theme.topBarEffect}</p>
              </div>
            </div>
          )}

          {/* Level requirement */}
          {theme.unlockLevel && theme.unlockLevel > 0 && (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-xl border"
              style={{
                background: '#0a0800',
                borderColor: userLevel >= theme.unlockLevel ? '#15803d40' : '#92400e40',
              }}
            >
              {userLevel >= theme.unlockLevel ? (
                <CheckCircle2 size={13} className="text-green-400 shrink-0" />
              ) : (
                <Lock size={13} className="text-amber-500 shrink-0" />
              )}
              <p className="text-[9px] font-bold" style={{ color: userLevel >= theme.unlockLevel ? '#4ade80' : '#fbbf24' }}>
                {userLevel >= theme.unlockLevel
                  ? `Unlocked! (Lv.${theme.unlockLevel} required)`
                  : `Lv.${theme.unlockLevel} pe unlock hoga (Aap: Lv.${userLevel})`}
              </p>
            </div>
          )}

          {/* ── ACTION BUTTONS ── */}
          {isAdmin ? (
            <AdminActionButtons
              theme={theme}
              showSchedulePanel={showSchedulePanel}
              setShowSchedulePanel={setShowSchedulePanel}
              showRealtimePanel={showRealtimePanel}
              setShowRealtimePanel={setShowRealtimePanel}
              schedTarget={schedTarget}
              setSchedTarget={setSchedTarget}
              schedDelayDays={schedDelayDays} setSchedDelayDays={setSchedDelayDays}
              schedDelayHours={schedDelayHours} setSchedDelayHours={setSchedDelayHours}
              schedDelayMins={schedDelayMins} setSchedDelayMins={setSchedDelayMins}
              schedDelaySecs={schedDelaySecs} setSchedDelaySecs={setSchedDelaySecs}
              schedDurDays={schedDurDays} setSchedDurDays={setSchedDurDays}
              schedDurHours={schedDurHours} setSchedDurHours={setSchedDurHours}
              schedDurMins={schedDurMins} setSchedDurMins={setSchedDurMins}
              schedDurSecs={schedDurSecs} setSchedDurSecs={setSchedDurSecs}
              schedDelayMs={schedDelayMs}
              schedDurMs={schedDurMs}
              schedApplyProfile={schedApplyProfile}
              setSchedApplyProfile={setSchedApplyProfile}
              schedApplyBg={schedApplyBg}
              setSchedApplyBg={setSchedApplyBg}
              onApply={onApply}
              onSchedule={onSchedule}
              onBroadcastNow={onBroadcastNow}
              accentColor={accentColor}
            />
          ) : (
            <button
              onClick={() => onApply(theme)}
              disabled={isLocked}
              className="w-full py-3 rounded-2xl font-black text-sm text-white active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: isLocked
                  ? '#1a0f00'
                  : `linear-gradient(135deg, ${theme.colors.btnStart}, ${theme.colors.btnEnd})`,
                boxShadow: isLocked ? 'none' : `0 6px 20px ${theme.colors.btnStart}40`,
              }}
            >
              {isLocked
                ? `🔒 Lv.${theme.unlockLevel} pe unlock hoga`
                : '🎨 Theme Apply Karo'}
            </button>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}

// ─── DHMS Time Picker ────────────────────────────────────────────────────────
function DHMSPicker({
  label, days, hours, mins, secs,
  onDays, onHours, onMins, onSecs, accent,
}: {
  label: string;
  days: number; hours: number; mins: number; secs: number;
  onDays: (v: number) => void; onHours: (v: number) => void;
  onMins: (v: number) => void; onSecs: (v: number) => void;
  accent: string;
}) {
  const spin = (cur: number, min: number, max: number, set: (v: number) => void, delta: number) => {
    const next = cur + delta;
    if (next < min || next > max) return;
    set(next);
  };
  const Cell = ({ val, min, max, setFn, unitLabel }: { val: number; min: number; max: number; setFn: (v: number) => void; unitLabel: string }) => (
    <div className="flex flex-col items-center gap-0.5">
      <button
        className="w-7 h-5 rounded-md flex items-center justify-center active:scale-90 transition-transform text-white/60 hover:text-white"
        style={{ background: `${accent}18` }}
        onClick={() => spin(val, min, max, setFn, 1)}
      >
        <span className="text-[10px] font-black">▲</span>
      </button>
      <input
        type="number" min={min} max={max} value={val}
        onChange={e => { const n = Math.min(max, Math.max(min, Number(e.target.value))); setFn(n); }}
        className="w-9 text-center bg-white/8 border border-white/12 rounded-lg py-1 text-sm font-black text-white focus:outline-none focus:border-white/30"
        style={{ borderColor: `${accent}40` }}
      />
      <button
        className="w-7 h-5 rounded-md flex items-center justify-center active:scale-90 transition-transform text-white/60 hover:text-white"
        style={{ background: `${accent}18` }}
        onClick={() => spin(val, min, max, setFn, -1)}
      >
        <span className="text-[10px] font-black">▼</span>
      </button>
      <span className="text-[6px] text-white/30 font-black uppercase tracking-wider">{unitLabel}</span>
    </div>
  );
  return (
    <div>
      <p className="text-[8px] text-white/40 font-black uppercase tracking-wider mb-2">{label}</p>
      <div className="flex items-center gap-1.5 justify-center py-2 px-3 rounded-xl bg-white/3 border border-white/6">
        <Cell val={days}  min={0}  max={365} setFn={onDays}  unitLabel="Din" />
        <span className="text-white/20 font-black text-base pb-5">:</span>
        <Cell val={hours} min={0}  max={23}  setFn={onHours} unitLabel="Ghante" />
        <span className="text-white/20 font-black text-base pb-5">:</span>
        <Cell val={mins}  min={0}  max={59}  setFn={onMins}  unitLabel="Min" />
        <span className="text-white/20 font-black text-base pb-5">:</span>
        <Cell val={secs}  min={0}  max={59}  setFn={onSecs}  unitLabel="Sec" />
      </div>
    </div>
  );
}

// ─── Schedule Clock Display ───────────────────────────────────────────────────
function ScheduleClockDisplay({ delayMs, durMs, accent }: { delayMs: number; durMs: number; accent: string }) {
  const now = Date.now();
  const startTs = now + delayMs;
  const endTs   = startTs + durMs;
  const fmt = (ts: number) => {
    const d = new Date(ts);
    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const hh = d.getHours().toString().padStart(2, '0');
    const mm = d.getMinutes().toString().padStart(2, '0');
    const ss = d.getSeconds().toString().padStart(2, '0');
    return {
      day:  days[d.getDay()],
      date: `${d.getDate()} ${months[d.getMonth()]}`,
      time: `${hh}:${mm}:${ss}`,
      ampm: d.getHours() < 12 ? 'AM' : 'PM',
    };
  };
  const start = fmt(startTs);
  const end   = fmt(endTs);
  const ClockFace = ({ ts, label, color }: { ts: number; label: string; color: string }) => {
    const d = new Date(ts);
    const h = d.getHours() % 12;
    const m = d.getMinutes();
    const s = d.getSeconds();
    const hDeg = (h / 12) * 360 + (m / 60) * 30;
    const mDeg = (m / 60) * 360 + (s / 60) * 6;
    const sDeg = (s / 60) * 360;
    const hand = (deg: number, len: number, width: number, clr: string) => {
      const rad = ((deg - 90) * Math.PI) / 180;
      const cx = 24, cy = 24;
      const ex = cx + len * Math.cos(rad);
      const ey = cy + len * Math.sin(rad);
      return <line x1={cx} y1={cy} x2={ex} y2={ey} stroke={clr} strokeWidth={width} strokeLinecap="round" />;
    };
    return (
      <div className="flex flex-col items-center gap-1">
        <p className="text-[7px] font-black uppercase tracking-wider" style={{ color }}>{label}</p>
        <div className="relative">
          <svg width={48} height={48} viewBox="0 0 48 48">
            <circle cx={24} cy={24} r={22} fill="rgba(0,0,0,0.4)" stroke={`${color}40`} strokeWidth={1} />
            {[...Array(12)].map((_, i) => {
              const rad = ((i * 30 - 90) * Math.PI) / 180;
              return <circle key={i} cx={24 + 18 * Math.cos(rad)} cy={24 + 18 * Math.sin(rad)} r={i % 3 === 0 ? 1.2 : 0.7} fill={`${color}60`} />;
            })}
            {hand(hDeg, 11, 2, color)}
            {hand(mDeg, 16, 1.5, `${color}cc`)}
            {hand(sDeg, 18, 1, '#ef4444')}
            <circle cx={24} cy={24} r={1.5} fill={color} />
          </svg>
        </div>
        <p className="text-[9px] font-black text-white">{fmt(ts).time}</p>
        <p className="text-[7px] text-white/40">{fmt(ts).day}, {fmt(ts).date}</p>
      </div>
    );
  };
  return (
    <div className="rounded-xl p-3 border border-white/8 bg-black/30">
      <div className="flex items-center justify-around">
        <ClockFace ts={startTs} label="Shuru" color={accent} />
        <div className="flex flex-col items-center gap-1 px-2">
          <div className="text-[7px] text-white/25 font-black">DURATION</div>
          <div className="w-0.5 h-8 rounded-full" style={{ background: `${accent}30` }} />
          <div className="text-[7px] text-white/40 font-black text-center">
            {durMs > 0 ? fmtDuration(durMs) : '—'}
          </div>
          <div className="w-0.5 h-8 rounded-full" style={{ background: `${accent}30` }} />
        </div>
        <ClockFace ts={endTs} label="Khatam" color="#f43f5e" />
      </div>
    </div>
  );
}

function fmtDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sc = s % 60;
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (sc > 0 && d === 0) parts.push(`${sc}s`);
  return parts.join(' ') || '0s';
}

// ─── Admin Action Buttons ─────────────────────────────────────────────────────
function AdminActionButtons({
  theme, showSchedulePanel, setShowSchedulePanel,
  showRealtimePanel, setShowRealtimePanel,
  schedTarget, setSchedTarget,
  schedDelayDays, setSchedDelayDays,
  schedDelayHours, setSchedDelayHours,
  schedDelayMins, setSchedDelayMins,
  schedDelaySecs, setSchedDelaySecs,
  schedDurDays, setSchedDurDays,
  schedDurHours, setSchedDurHours,
  schedDurMins, setSchedDurMins,
  schedDurSecs, setSchedDurSecs,
  schedDelayMs, schedDurMs,
  schedApplyProfile, setSchedApplyProfile,
  schedApplyBg, setSchedApplyBg,
  onApply, onSchedule, onBroadcastNow, accentColor,
}: {
  theme: AppTheme;
  showSchedulePanel: boolean;
  setShowSchedulePanel: (v: boolean) => void;
  showRealtimePanel: boolean;
  setShowRealtimePanel: (v: boolean) => void;
  schedTarget: 'ALL' | 'FREE' | 'BASIC' | 'ULTRA';
  setSchedTarget: (v: 'ALL' | 'FREE' | 'BASIC' | 'ULTRA') => void;
  schedDelayDays: number; setSchedDelayDays: (v: number) => void;
  schedDelayHours: number; setSchedDelayHours: (v: number) => void;
  schedDelayMins: number; setSchedDelayMins: (v: number) => void;
  schedDelaySecs: number; setSchedDelaySecs: (v: number) => void;
  schedDurDays: number; setSchedDurDays: (v: number) => void;
  schedDurHours: number; setSchedDurHours: (v: number) => void;
  schedDurMins: number; setSchedDurMins: (v: number) => void;
  schedDurSecs: number; setSchedDurSecs: (v: number) => void;
  schedDelayMs: number;
  schedDurMs: number;
  schedApplyProfile: boolean;
  setSchedApplyProfile: (v: boolean) => void;
  schedApplyBg: boolean;
  setSchedApplyBg: (v: boolean) => void;
  onApply: (t: AppTheme) => void;
  onSchedule: () => void;
  onBroadcastNow: () => void;
  accentColor: string;
}) {
  return (
    <div className="space-y-2">
      {/* Admin notice */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/8 border border-amber-500/20">
        <Shield size={11} className="text-amber-400 shrink-0" />
        <p className="text-[8px] text-amber-300/80 font-bold">Admin Controls — Sirf aapko dikhega</p>
      </div>

      {/* Try for admin only */}
      <button
        onClick={() => onApply(theme)}
        className="w-full py-3 rounded-2xl font-black text-sm text-white active:scale-95 transition-all flex items-center justify-center gap-2"
        style={{
          background: `linear-gradient(135deg, ${theme.colors.btnStart}, ${theme.colors.btnEnd})`,
          boxShadow: `0 6px 20px ${theme.colors.btnStart}40`,
        }}
      >
        <Palette size={13} />
        Try — Sirf Mere Liye Apply Karo
      </button>

      {/* Real-time broadcast */}
      <button
        onClick={() => { setShowRealtimePanel(!showRealtimePanel); setShowSchedulePanel(false); }}
        className="w-full py-3 rounded-2xl font-black text-sm text-white active:scale-95 transition-all border flex items-center justify-center gap-2"
        style={{ background: showRealtimePanel ? '#0a1a10' : '#080f0a', borderColor: 'rgba(34,197,94,0.35)' }}
      >
        <span className="text-green-400 flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          Abhi Real-time Broadcast Karo
        </span>
        {showRealtimePanel ? <ChevronUp size={12} className="text-green-400" /> : <ChevronDown size={12} className="text-green-400" />}
      </button>

      {/* Real-time Panel */}
      {showRealtimePanel && (
        <div className="rounded-2xl p-4 border border-green-500/25 space-y-4" style={{ background: '#050d07' }}>
          <p className="text-[9px] font-black text-green-400 uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse inline-block" /> Live Broadcast — Abhi Shuru
          </p>
          <p className="text-[8px] text-white/35 leading-relaxed">
            Theme <span className="text-green-300 font-black">{theme.emoji} {theme.name}</span> turant sabke liye live ho jayega. Koi delay nahi.
          </p>

          {/* Target tier */}
          <div>
            <label className="text-[9px] text-white/40 font-black uppercase tracking-wider">Target Tier</label>
            <div className="flex gap-1.5 mt-1.5">
              {(['ALL', 'FREE', 'BASIC', 'ULTRA'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setSchedTarget(t)}
                  className="flex-1 py-2 rounded-xl text-[8px] font-black border transition-all active:scale-90"
                  style={{
                    background: schedTarget === t ? '#16a34a20' : '#0d0f1a',
                    borderColor: schedTarget === t ? '#16a34a80' : 'rgba(255,255,255,0.08)',
                    color: schedTarget === t ? '#4ade80' : 'rgba(255,255,255,0.35)',
                  }}
                >
                  {t === 'ALL' ? '🌍 ALL' : t === 'FREE' ? '🎓 FREE' : t === 'BASIC' ? '⭐ BASIC' : '💎 ULTRA'}
                </button>
              ))}
            </div>
          </div>

          {/* Duration */}
          <DHMSPicker
            label="Kitne time tak chalega?"
            days={schedDurDays}  hours={schedDurHours}
            mins={schedDurMins}  secs={schedDurSecs}
            onDays={setSchedDurDays} onHours={setSchedDurHours}
            onMins={setSchedDurMins} onSecs={setSchedDurSecs}
            accent="#4ade80"
          />

          {/* Apply to profile/bg */}
          <div className="space-y-2">
            <ToggleRow
              label="Profile Page Background"
              sub="User ke profile page ka background badlega"
              value={schedApplyProfile}
              onChange={setSchedApplyProfile}
              color="#4ade80"
            />
            <ToggleRow
              label="App Background"
              sub="Puri app ka background color badlega"
              value={schedApplyBg}
              onChange={setSchedApplyBg}
              color="#4ade80"
            />
          </div>

          {/* Summary */}
          <div className="rounded-xl p-3 border border-green-500/15 bg-green-500/5">
            <p className="text-[8px] text-green-300/70 font-bold leading-relaxed">
              ⚡ {theme.emoji} {theme.name} → Abhi live,{' '}
              {schedDurMs > 0 ? fmtDuration(schedDurMs) : '∞'} chalega,{' '}
              target: <span className="text-green-300">{schedTarget}</span>
              {schedApplyProfile ? ' · Profile ✓' : ''}{schedApplyBg ? ' · AppBg ✓' : ''}
            </p>
          </div>

          <button
            onClick={onBroadcastNow}
            disabled={schedDurMs <= 0}
            className="w-full py-3 rounded-2xl font-black text-sm text-white active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', boxShadow: '0 6px 20px #16a34a40' }}
          >
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            Abhi Broadcast Karo
          </button>
        </div>
      )}

      {/* Scheduled broadcast */}
      <button
        onClick={() => { setShowSchedulePanel(!showSchedulePanel); setShowRealtimePanel(false); }}
        className="w-full py-3 rounded-2xl font-black text-sm text-white active:scale-95 transition-all border flex items-center justify-center gap-2"
        style={{ background: '#120d00', borderColor: 'rgba(251,191,36,0.3)' }}
      >
        <Calendar size={13} className="text-amber-400" />
        <span className="text-amber-300">Baad Mein Schedule Karo</span>
        {showSchedulePanel ? <ChevronUp size={12} className="text-amber-400" /> : <ChevronDown size={12} className="text-amber-400" />}
      </button>

      {/* Schedule Panel */}
      {showSchedulePanel && (
        <div className="rounded-2xl p-4 border border-amber-500/20 space-y-4" style={{ background: '#0a0800' }}>
          <p className="text-[9px] font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
            <Calendar size={9} /> Schedule Theme for Users
          </p>

          {/* Target tier */}
          <div>
            <label className="text-[9px] text-white/40 font-black uppercase tracking-wider">Target Tier</label>
            <div className="flex gap-1.5 mt-1.5">
              {(['ALL', 'FREE', 'BASIC', 'ULTRA'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setSchedTarget(t)}
                  className="flex-1 py-2 rounded-xl text-[8px] font-black border transition-all active:scale-90"
                  style={{
                    background: schedTarget === t ? `${accentColor}20` : '#0d0f1a',
                    borderColor: schedTarget === t ? `${accentColor}60` : 'rgba(255,255,255,0.08)',
                    color: schedTarget === t ? accentColor : 'rgba(255,255,255,0.35)',
                  }}
                >
                  {t === 'ALL' ? '🌍 ALL' : t === 'FREE' ? '🎓 FREE' : t === 'BASIC' ? '⭐ BASIC' : '💎 ULTRA'}
                </button>
              ))}
            </div>
          </div>

          {/* Start delay D/H/M/S */}
          <DHMSPicker
            label="Kitne time baad shuru? (0 = abhi)"
            days={schedDelayDays}  hours={schedDelayHours}
            mins={schedDelayMins}  secs={schedDelaySecs}
            onDays={setSchedDelayDays} onHours={setSchedDelayHours}
            onMins={setSchedDelayMins} onSecs={setSchedDelaySecs}
            accent={accentColor}
          />

          {/* Duration D/H/M/S */}
          <DHMSPicker
            label="Kitne time tak chalega?"
            days={schedDurDays}  hours={schedDurHours}
            mins={schedDurMins}  secs={schedDurSecs}
            onDays={setSchedDurDays} onHours={setSchedDurHours}
            onMins={setSchedDurMins} onSecs={setSchedDurSecs}
            accent="#f59e0b"
          />

          {/* Clock display */}
          <ScheduleClockDisplay delayMs={schedDelayMs} durMs={schedDurMs} accent={accentColor} />

          {/* Apply to profile/bg */}
          <div>
            <label className="text-[9px] text-white/40 font-black uppercase tracking-wider mb-2 block">
              Kahan apply karna hai?
            </label>
            <div className="space-y-2">
              <ToggleRow
                label="Profile Page Background"
                sub="User ke profile page ka background badlega"
                value={schedApplyProfile}
                onChange={setSchedApplyProfile}
                color={accentColor}
              />
              <ToggleRow
                label="App Background"
                sub="Puri app ka background color badlega"
                value={schedApplyBg}
                onChange={setSchedApplyBg}
                color={accentColor}
              />
            </div>
          </div>

          {/* Summary */}
          <div className="rounded-xl p-3 border border-white/6 bg-white/3">
            <p className="text-[8px] text-white/50 font-bold leading-relaxed">
              📋 {theme.emoji} {theme.name} →{' '}
              {schedDelayMs === 0 ? 'Abhi shuru' : `${fmtDuration(schedDelayMs)} baad shuru`},{' '}
              {schedDurMs > 0 ? fmtDuration(schedDurMs) : '∞'} chalega,{' '}
              target: <span className="text-amber-300">{schedTarget}</span>
              {schedApplyProfile ? ' · Profile ✓' : ''}{schedApplyBg ? ' · AppBg ✓' : ''}
            </p>
          </div>

          <button
            onClick={onSchedule}
            disabled={schedDurMs <= 0}
            className="w-full py-3 rounded-2xl font-black text-sm text-white active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: `linear-gradient(135deg, #d97706, #c2410c)`, boxShadow: '0 6px 20px #d9770640' }}
          >
            <Calendar size={14} />
            Schedule Karo Abhi
          </button>
        </div>
      )}

      {/* ── THEME SCOPE SELECTOR POPUP ── */}
      {themeForScope && (
        <div
          className="fixed inset-0 z-[400] flex items-end justify-center"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
          onClick={() => setThemeForScope(null)}
        >
          <div
            className="w-full max-w-sm rounded-t-3xl overflow-hidden shadow-2xl"
            style={{ background: '#0a0c1a' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>
            <div className="px-5 pt-2 pb-4 border-b border-white/10">
              <div className="flex items-center gap-3 mb-1.5">
                <span className="text-3xl">{themeForScope.emoji}</span>
                <div>
                  <p className="text-base font-black text-white leading-tight">{themeForScope.name}</p>
                  <p className="text-[9px] font-black uppercase tracking-widest mt-0.5" style={{ color: accentColor }}>Theme Apply Scope</p>
                </div>
              </div>
              <p className="text-[10px] text-white/40">Kya kya badlega choose karo — uncheck karo jo same rehna chahiye</p>
            </div>
            <div className="px-4 py-3 space-y-1.5">
              {([
                { key: 'topBar',     icon: '🎨', label: 'Top Bar / Header',    sub: 'Header aur status bar ka color' },
                { key: 'background', icon: '🌑', label: 'App Background',       sub: 'Screen ka background color' },
                { key: 'cards',      icon: '🃏', label: 'Cards & Panels',       sub: 'Content cards aur section panels' },
                { key: 'navBar',     icon: '⬛', label: 'Navigation Bar',       sub: 'Bottom navigation bar' },
                { key: 'buttons',    icon: '🔘', label: 'Buttons & Accents',    sub: 'Buttons, highlights, glow effects' },
                { key: 'text',       icon: '📝', label: 'Text Colors',          sub: 'Primary aur secondary text' },
                { key: 'progress',   icon: '📊', label: 'Progress Bars',        sub: 'Level bar, progress indicators' },
              ] as const).map(item => {
                const on = applyScope[item.key];
                return (
                  <button
                    key={item.key}
                    onClick={() => setApplyScope(prev => ({ ...prev, [item.key]: !prev[item.key] }))}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all active:scale-[0.98]"
                    style={{
                      background: on ? `${themeForScope.colors.btnStart}14` : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${on ? themeForScope.colors.btnStart + '45' : 'rgba(255,255,255,0.07)'}`,
                    }}
                  >
                    <span className="text-lg shrink-0">{item.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-black leading-tight" style={{ color: on ? '#ffffff' : 'rgba(255,255,255,0.35)' }}>{item.label}</p>
                      <p className="text-[8px] mt-0.5" style={{ color: on ? 'rgba(255,255,255,0.38)' : 'rgba(255,255,255,0.18)' }}>{item.sub}</p>
                    </div>
                    <div
                      className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-all"
                      style={{
                        background: on ? themeForScope.colors.btnStart : 'rgba(255,255,255,0.06)',
                        border: `1.5px solid ${on ? themeForScope.colors.btnStart : 'rgba(255,255,255,0.12)'}`,
                      }}
                    >
                      {on && <span className="text-[10px] font-black text-white">✓</span>}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="px-4 pt-1 pb-8 flex gap-3">
              <button
                onClick={() => setThemeForScope(null)}
                className="flex-1 py-3 rounded-2xl text-sm font-black transition-all active:scale-95"
                style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.50)', border: '1px solid rgba(255,255,255,0.10)' }}
              >
                Cancel
              </button>
              <button
                onClick={confirmApply}
                className="flex-[2] py-3 rounded-2xl text-sm font-black text-white active:scale-95 transition-transform"
                style={{
                  background: `linear-gradient(135deg, ${themeForScope.colors.btnStart}, ${themeForScope.colors.btnEnd})`,
                  boxShadow: `0 6px 20px ${themeForScope.colors.btnStart}45`,
                }}
              >
                🎨 Apply Karo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Toggle Row ───────────────────────────────────────────────────────────────
function ToggleRow({ label, sub, value, onChange, color }: {
  label: string; sub: string; value: boolean;
  onChange: (v: boolean) => void; color: string;
}) {
  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-xl bg-white/3 border border-white/5">
      <div className="flex-1 min-w-0">
        <p className="text-[9px] font-black text-white/70">{label}</p>
        <p className="text-[7px] text-white/30">{sub}</p>
      </div>
      <div
        className="w-10 h-5 rounded-full relative transition-colors cursor-pointer shrink-0"
        style={{ background: value ? color : '#334155' }}
        onClick={() => onChange(!value)}
      >
        <div
          className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all"
          style={{ left: value ? '22px' : '2px' }}
        />
      </div>
    </div>
  );
}
