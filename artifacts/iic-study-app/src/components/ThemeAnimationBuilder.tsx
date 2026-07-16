import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { User, UserCustomTheme, UserCustomAnimation, ScheduledTheme } from '../types';
import { TOP_BAR_EFFECTS, TopBarEffectsLayer } from '../utils/topBarEffects';
import { ThemeBrowser } from './ThemeBrowser';
import type { AppTheme } from '../utils/themeLibrary';
import {
    saveUserTheme, saveUserAnimation,
    publishTheme, publishAnimation,
    subscribePublishedThemes, subscribePublishedAnimations,
    likePublishedTheme, likePublishedAnimation
} from '../firebase';
import { applyDeduction, getTotalCredits } from '../utils/creditSystem';
import {
    ArrowLeft, Palette, Sparkles, Eye, Check, RotateCcw,
    Layers, Navigation, Square, Type, Zap, Star, Globe,
    Heart, Copy, ChevronRight
} from 'lucide-react';

interface Props {
    user: User;
    onUpdateUser: (u: User) => void;
    onBack: () => void;
}

const THEME_COST = 200;
const ANIMATION_COST = 200;
const APPLY_HOURS = 24;

interface ThemeState {
    bgColor: string;
    topBarStart: string;
    topBarEnd: string;
    navBg: string;
    navActive: string;
    navBorder: string;
    cardBg: string;
    cardBorder: string;
    btnStart: string;
    btnEnd: string;
    textPrimary: string;
    textSecondary: string;
    accentGlow: string;
    progressColor: string;
}

const DEFAULT_THEME: ThemeState = {
    bgColor: '#080a10',
    topBarStart: '#1e3a5f',
    topBarEnd: '#0f1e3c',
    navBg: '#0d0f18',
    navActive: '#3b82f6',
    navBorder: '#1e2a3f',
    cardBg: '#111827',
    cardBorder: '#1e293b',
    btnStart: '#3b82f6',
    btnEnd: '#6366f1',
    textPrimary: '#f1f5f9',
    textSecondary: '#94a3b8',
    accentGlow: '#3b82f6',
    progressColor: '#3b82f6',
};

const PRESET_THEMES: Array<{ name: string; emoji: string; colors: ThemeState }> = [
    {
        name: 'Ocean Blue', emoji: '🌊',
        colors: {
            bgColor: '#050d1a', topBarStart: '#0c2d6b', topBarEnd: '#061635',
            navBg: '#080f1f', navActive: '#38bdf8', navBorder: '#0f2040',
            cardBg: '#0d1a33', cardBorder: '#1a3050',
            btnStart: '#0ea5e9', btnEnd: '#6366f1',
            textPrimary: '#e0f2fe', textSecondary: '#7dd3fc',
            accentGlow: '#38bdf8', progressColor: '#0ea5e9',
        }
    },
    {
        name: 'Sakura', emoji: '🌸',
        colors: {
            bgColor: '#120008', topBarStart: '#7b1045', topBarEnd: '#3d0820',
            navBg: '#18040e', navActive: '#f43f5e', navBorder: '#3d1020',
            cardBg: '#200a12', cardBorder: '#3d1525',
            btnStart: '#f43f5e', btnEnd: '#ec4899',
            textPrimary: '#ffe4e6', textSecondary: '#fda4af',
            accentGlow: '#f43f5e', progressColor: '#e11d48',
        }
    },
    {
        name: 'Forest', emoji: '🌿',
        colors: {
            bgColor: '#030d06', topBarStart: '#064e20', topBarEnd: '#022b10',
            navBg: '#040e07', navActive: '#22c55e', navBorder: '#083a16',
            cardBg: '#07150b', cardBorder: '#0d2e14',
            btnStart: '#16a34a', btnEnd: '#059669',
            textPrimary: '#dcfce7', textSecondary: '#86efac',
            accentGlow: '#22c55e', progressColor: '#16a34a',
        }
    },
    {
        name: 'Gold Rush', emoji: '⚡',
        colors: {
            bgColor: '#0d0800', topBarStart: '#7c4a00', topBarEnd: '#3d2200',
            navBg: '#110900', navActive: '#f59e0b', navBorder: '#3d2500',
            cardBg: '#180f00', cardBorder: '#3d2200',
            btnStart: '#f59e0b', btnEnd: '#f97316',
            textPrimary: '#fef9c3', textSecondary: '#fde68a',
            accentGlow: '#f59e0b', progressColor: '#d97706',
        }
    },
    {
        name: 'Violet', emoji: '💜',
        colors: {
            bgColor: '#06020e', topBarStart: '#4a1d96', topBarEnd: '#2e1065',
            navBg: '#080316', navActive: '#a855f7', navBorder: '#2e1065',
            cardBg: '#0f0520', cardBorder: '#2d1060',
            btnStart: '#8b5cf6', btnEnd: '#ec4899',
            textPrimary: '#f3e8ff', textSecondary: '#d8b4fe',
            accentGlow: '#a855f7', progressColor: '#7c3aed',
        }
    },
    {
        name: 'Sunset', emoji: '🔥',
        colors: {
            bgColor: '#0d0400', topBarStart: '#9a2a00', topBarEnd: '#4d1500',
            navBg: '#100500', navActive: '#f97316', navBorder: '#4d1800',
            cardBg: '#180600', cardBorder: '#3d1200',
            btnStart: '#f97316', btnEnd: '#ef4444',
            textPrimary: '#ffedd5', textSecondary: '#fed7aa',
            accentGlow: '#f97316', progressColor: '#ea580c',
        }
    },
    {
        name: 'Arctic', emoji: '❄️',
        colors: {
            bgColor: '#020d14', topBarStart: '#0e4060', topBarEnd: '#061a2b',
            navBg: '#040e18', navActive: '#67e8f9', navBorder: '#0e3050',
            cardBg: '#071520', cardBorder: '#0e2535',
            btnStart: '#22d3ee', btnEnd: '#06b6d4',
            textPrimary: '#ecfeff', textSecondary: '#a5f3fc',
            accentGlow: '#22d3ee', progressColor: '#0891b2',
        }
    },
    {
        name: 'Ruby', emoji: '❤️',
        colors: {
            bgColor: '#0d0000', topBarStart: '#7f1d1d', topBarEnd: '#450a0a',
            navBg: '#100000', navActive: '#ef4444', navBorder: '#450a0a',
            cardBg: '#1a0505', cardBorder: '#3d1010',
            btnStart: '#ef4444', btnEnd: '#dc2626',
            textPrimary: '#fee2e2', textSecondary: '#fca5a5',
            accentGlow: '#ef4444', progressColor: '#dc2626',
        }
    },
    {
        name: 'Midnight', emoji: '🌌',
        colors: {
            bgColor: '#02020a', topBarStart: '#1a1a3a', topBarEnd: '#0d0d1f',
            navBg: '#030308', navActive: '#818cf8', navBorder: '#1a1a35',
            cardBg: '#08081a', cardBorder: '#1a1a30',
            btnStart: '#6366f1', btnEnd: '#4f46e5',
            textPrimary: '#e0e7ff', textSecondary: '#a5b4fc',
            accentGlow: '#818cf8', progressColor: '#4f46e5',
        }
    },
    {
        name: 'Emerald', emoji: '💎',
        colors: {
            bgColor: '#020d0a', topBarStart: '#065f46', topBarEnd: '#022c20',
            navBg: '#030e0a', navActive: '#10b981', navBorder: '#064e38',
            cardBg: '#061510', cardBorder: '#0a2e20',
            btnStart: '#10b981', btnEnd: '#059669',
            textPrimary: '#d1fae5', textSecondary: '#6ee7b7',
            accentGlow: '#10b981', progressColor: '#059669',
        }
    },
    {
        name: 'Royal', emoji: '👑',
        colors: {
            bgColor: '#020610', topBarStart: '#1e3a8a', topBarEnd: '#0f1e5c',
            navBg: '#030818', navActive: '#60a5fa', navBorder: '#1e2d6b',
            cardBg: '#060e25', cardBorder: '#1a2555',
            btnStart: '#2563eb', btnEnd: '#1d4ed8',
            textPrimary: '#dbeafe', textSecondary: '#93c5fd',
            accentGlow: '#3b82f6', progressColor: '#1d4ed8',
        }
    },
    {
        name: 'Rose Gold', emoji: '🌹',
        colors: {
            bgColor: '#0d0608', topBarStart: '#881337', topBarEnd: '#4c0519',
            navBg: '#100508', navActive: '#fb7185', navBorder: '#4c0a1e',
            cardBg: '#1a0610', cardBorder: '#3d1020',
            btnStart: '#fb7185', btnEnd: '#f43f5e',
            textPrimary: '#ffe4e6', textSecondary: '#fda4af',
            accentGlow: '#fb7185', progressColor: '#e11d48',
        }
    },
];

type Tab = 'THEME' | 'ANIMATION' | 'GALLERY' | 'LIBRARY';
type ColorSection = 'BACKGROUND' | 'TOPBAR' | 'NAVIGATION' | 'CARDS' | 'BUTTONS' | 'TEXT' | 'ACCENTS';

const SECTION_INFO: Record<ColorSection, { label: string; icon: React.ReactNode; desc: string }> = {
    BACKGROUND: { label: 'Background', icon: <Layers size={14} />, desc: 'App ki main background color' },
    TOPBAR: { label: 'Top Bar', icon: <ChevronRight size={14} />, desc: 'Header gradient ke dono colors' },
    NAVIGATION: { label: 'Navigation', icon: <Navigation size={14} />, desc: 'Bottom nav ka pura look' },
    CARDS: { label: 'Cards', icon: <Square size={14} />, desc: 'Cards ka background aur border' },
    BUTTONS: { label: 'Buttons', icon: <Zap size={14} />, desc: 'Action buttons ka gradient' },
    TEXT: { label: 'Text', icon: <Type size={14} />, desc: 'Primary aur secondary text' },
    ACCENTS: { label: 'Accents', icon: <Star size={14} />, desc: 'Glow aur progress bars' },
};

interface ColorRowProps {
    label: string;
    sub?: string;
    value: string;
    onChange: (v: string) => void;
}

const ColorRow: React.FC<ColorRowProps> = ({ label, sub, value, onChange }) => (
    <div className="flex items-center gap-3 py-2.5 border-b border-white/4 last:border-0">
        <div
            className="w-9 h-9 rounded-xl border-2 border-white/10 shrink-0 cursor-pointer relative overflow-hidden"
            style={{ background: value }}
        >
            <input
                type="color"
                value={value}
                onChange={e => onChange(e.target.value)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
        </div>
        <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-white/90">{label}</p>
            {sub && <p className="text-[9px] text-white/35 mt-0.5">{sub}</p>}
        </div>
        <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-mono text-white/30">{value.toUpperCase()}</span>
            <div
                className="w-5 h-5 rounded-md border border-white/10 shrink-0 cursor-pointer relative overflow-hidden"
                style={{ background: value }}
            >
                <input
                    type="color"
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
            </div>
        </div>
    </div>
);

const timeLeft = (isoStr?: string): string | null => {
    if (!isoStr) return null;
    const diff = new Date(isoStr).getTime() - Date.now();
    if (diff <= 0) return null;
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return `${h}h ${m}m`;
};

export const ThemeAnimationBuilder: React.FC<Props> = ({ user, onUpdateUser, onBack }) => {
    const isAdmin = user.role === 'ADMIN' || user.role === 'SUB_ADMIN';
    const totalCoins = getTotalCredits(user);

    const [tab, setTab] = useState<Tab>('LIBRARY');
    const [activeSection, setActiveSection] = useState<ColorSection>('TOPBAR');

    const getInitialTheme = (): ThemeState => {
        const ct = user.customTheme;
        if (ct) {
            return {
                bgColor: ct.bgColor || DEFAULT_THEME.bgColor,
                topBarStart: ct.topBarStart || DEFAULT_THEME.topBarStart,
                topBarEnd: ct.topBarEnd || DEFAULT_THEME.topBarEnd,
                navBg: ct.navBg || DEFAULT_THEME.navBg,
                navActive: ct.navActive || (ct.accentColor || DEFAULT_THEME.navActive),
                navBorder: ct.navBorder || DEFAULT_THEME.navBorder,
                cardBg: ct.cardBg || (ct.cardColor || DEFAULT_THEME.cardBg),
                cardBorder: ct.cardBorder || DEFAULT_THEME.cardBorder,
                btnStart: ct.btnStart || (ct.accentColor || DEFAULT_THEME.btnStart),
                btnEnd: ct.btnEnd || DEFAULT_THEME.btnEnd,
                textPrimary: ct.textColor || DEFAULT_THEME.textPrimary,
                textSecondary: ct.textSecondary || DEFAULT_THEME.textSecondary,
                accentGlow: ct.accentGlow || (ct.accentColor || DEFAULT_THEME.accentGlow),
                progressColor: ct.progressColor || (ct.accentColor || DEFAULT_THEME.progressColor),
            };
        }
        return { ...DEFAULT_THEME };
    };

    const [theme, setTheme] = useState<ThemeState>(getInitialTheme);
    const [themeName, setThemeName] = useState(user.customTheme?.publishedName || '');
    const [themeSaving, setThemeSaving] = useState(false);

    const [selectedEffect, setSelectedEffect] = useState(user.customAnimation?.effectId || 'shimmer-forward');
    const [animColor, setAnimColor] = useState(user.customAnimation?.color || '#a78bfa');
    const [animSpeed, setAnimSpeed] = useState(user.customAnimation?.speed || 1);
    const [animName, setAnimName] = useState(user.customAnimation?.publishedName || '');
    const [animSaving, setAnimSaving] = useState(false);

    const [publishedThemes, setPublishedThemes] = useState<any[]>([]);
    const [publishedAnimations, setPublishedAnimations] = useState<any[]>([]);

    useEffect(() => {
        const u1 = subscribePublishedThemes(setPublishedThemes);
        const u2 = subscribePublishedAnimations(setPublishedAnimations);
        return () => { u1(); u2(); };
    }, []);

    const setColor = (key: keyof ThemeState) => (v: string) =>
        setTheme(prev => ({ ...prev, [key]: v }));

    const applyPreset = (p: typeof PRESET_THEMES[0]) => {
        setTheme({ ...p.colors });
    };

    const themeTimeLeft = timeLeft(user.activeThemeAppliedUntil);
    const animTimeLeft = timeLeft(user.activeAnimationAppliedUntil);

    const SECTION_COLORS: Record<ColorSection, React.ReactNode> = {
        BACKGROUND: (
            <ColorRow label="App Background" sub="Puri app ki main background" value={theme.bgColor} onChange={setColor('bgColor')} />
        ),
        TOPBAR: (
            <>
                <ColorRow label="Gradient Start (Left)" sub="Top bar ka left/baayi side ka color" value={theme.topBarStart} onChange={setColor('topBarStart')} />
                <ColorRow label="Gradient End (Right)" sub="Top bar ka right/seedha side ka color" value={theme.topBarEnd} onChange={setColor('topBarEnd')} />
            </>
        ),
        NAVIGATION: (
            <>
                <ColorRow label="Nav Background" sub="Bottom bar ka background" value={theme.navBg} onChange={setColor('navBg')} />
                <ColorRow label="Active Item Color" sub="Selected tab ka color" value={theme.navActive} onChange={setColor('navActive')} />
                <ColorRow label="Nav Border" sub="Top border line ka color" value={theme.navBorder} onChange={setColor('navBorder')} />
            </>
        ),
        CARDS: (
            <>
                <ColorRow label="Card Background" sub="Chapters, MCQ cards ka bg" value={theme.cardBg} onChange={setColor('cardBg')} />
                <ColorRow label="Card Border" sub="Cards ke around border" value={theme.cardBorder} onChange={setColor('cardBorder')} />
            </>
        ),
        BUTTONS: (
            <>
                <ColorRow label="Button Gradient Start" sub="Action buttons ka pehla color" value={theme.btnStart} onChange={setColor('btnStart')} />
                <ColorRow label="Button Gradient End" sub="Action buttons ka doosra color" value={theme.btnEnd} onChange={setColor('btnEnd')} />
            </>
        ),
        TEXT: (
            <>
                <ColorRow label="Primary Text" sub="Main headings aur important text" value={theme.textPrimary} onChange={setColor('textPrimary')} />
                <ColorRow label="Secondary Text" sub="Descriptions aur sub-text" value={theme.textSecondary} onChange={setColor('textSecondary')} />
            </>
        ),
        ACCENTS: (
            <>
                <ColorRow label="Glow / Accent" sub="Avatar glow, level ring, highlights" value={theme.accentGlow} onChange={setColor('accentGlow')} />
                <ColorRow label="Progress Bar" sub="Score bars, loading bars" value={theme.progressColor} onChange={setColor('progressColor')} />
            </>
        ),
    };

    const handleApplyTheme = async (publish = false) => {
        if (!isAdmin && totalCoins < THEME_COST) {
            alert(`Insufficient coins! Theme banane ke liye ${THEME_COST} coins chahiye.\nAapke paas: ${totalCoins} coins.`);
            return;
        }
        const coinMsg = isAdmin ? '' : `\n🪙 ${THEME_COST} coins spend honge`;
        if (!confirm(`Custom theme apply karein? (${APPLY_HOURS} ghante ke liye)${coinMsg}`)) return;
        setThemeSaving(true);
        const appliedUntil = new Date(Date.now() + APPLY_HOURS * 3600000).toISOString();
        const themeObj: UserCustomTheme = {
            id: `theme_${user.id}_${Date.now()}`,
            userId: user.id,
            userName: user.name,
            bgColor: theme.bgColor,
            accentColor: theme.btnStart,
            textColor: theme.textPrimary,
            cardColor: theme.cardBg,
            topBarStart: theme.topBarStart,
            topBarEnd: theme.topBarEnd,
            navBg: theme.navBg,
            navActive: theme.navActive,
            navBorder: theme.navBorder,
            cardBg: theme.cardBg,
            cardBorder: theme.cardBorder,
            btnStart: theme.btnStart,
            btnEnd: theme.btnEnd,
            textSecondary: theme.textSecondary,
            accentGlow: theme.accentGlow,
            progressColor: theme.progressColor,
            createdAt: new Date().toISOString(),
            appliedUntil,
            publishedName: themeName || undefined,
            likes: 0,
        };
        await saveUserTheme(user.id, themeObj);
        if (publish && themeName.trim()) {
            await publishTheme({ ...themeObj, publishedName: themeName });
        }
        const deducted = isAdmin ? user : (applyDeduction(user, THEME_COST) ?? user);
        const updatedUser: User = {
            ...deducted,
            customTheme: themeObj,
            activeThemeAppliedUntil: appliedUntil,
        };
        onUpdateUser(updatedUser);
        setThemeSaving(false);
        alert(`✅ Theme apply ho gayi! ${APPLY_HOURS} ghante tak active rahegi.${publish ? '\n🌍 Gallery mein bhi publish ho gayi!' : ''}`);
    };

    const handleApplyAnimation = async (publish = false) => {
        if (!isAdmin && getTotalCredits(user) < ANIMATION_COST) {
            alert(`Insufficient coins! Animation ke liye ${ANIMATION_COST} coins chahiye.`);
            return;
        }
        const coinMsg = isAdmin ? '' : `\n🪙 ${ANIMATION_COST} coins spend honge`;
        if (!confirm(`Custom animation apply karein? (${APPLY_HOURS} ghante ke liye)${coinMsg}`)) return;
        setAnimSaving(true);
        const eff = TOP_BAR_EFFECTS.find(e => e.id === selectedEffect);
        const appliedUntil = new Date(Date.now() + APPLY_HOURS * 3600000).toISOString();
        const anim: UserCustomAnimation = {
            id: `anim_${user.id}_${Date.now()}`,
            userId: user.id,
            userName: user.name,
            effectId: selectedEffect,
            effectName: eff?.name || selectedEffect,
            color: animColor,
            speed: animSpeed,
            createdAt: new Date().toISOString(),
            appliedUntil,
            publishedName: animName || undefined,
            likes: 0,
        };
        await saveUserAnimation(user.id, anim);
        if (publish && animName.trim()) {
            await publishAnimation({ ...anim, publishedName: animName });
        }
        const deducted = isAdmin ? user : (applyDeduction(user, ANIMATION_COST) ?? user);
        const updatedUser: User = {
            ...deducted,
            customAnimation: anim,
            activeAnimationAppliedUntil: appliedUntil,
        };
        onUpdateUser(updatedUser);
        setAnimSaving(false);
        alert(`✅ Animation apply ho gayi!${publish ? '\n🌍 Gallery mein bhi publish ho gayi!' : ''}`);
    };

    const EFFECT_CATEGORIES = [...new Set(TOP_BAR_EFFECTS.map(e => e.category))];
    const selectedEffectObj = TOP_BAR_EFFECTS.find(e => e.id === selectedEffect);

    const handleApplyFromLibrary = useCallback((appTheme: AppTheme) => {
        const c = appTheme.colors;
        setTheme({
            bgColor: c.bgColor,
            topBarStart: c.topBarStart,
            topBarEnd: c.topBarEnd,
            navBg: c.navBg,
            navActive: c.navActive,
            navBorder: c.navBorder,
            cardBg: c.cardBg,
            cardBorder: c.cardBorder,
            btnStart: c.btnStart,
            btnEnd: c.btnEnd,
            textPrimary: c.textPrimary,
            textSecondary: c.textSecondary,
            accentGlow: c.accentGlow,
            progressColor: c.progressColor,
        });
        if (appTheme.topBarEffect) {
            setSelectedEffect(appTheme.topBarEffect);
            if (appTheme.animColor) setAnimColor(appTheme.animColor);
        }
        setTab('THEME');
    }, []);

    const handleScheduleFromLibrary = useCallback(async (appTheme: AppTheme) => {
        const cfg = (appTheme as any)._scheduleConfig as {
            target: 'ALL' | 'FREE' | 'BASIC' | 'ULTRA';
            durationMs?: number;
            durationHours?: number;
            scheduledAt: string;
            applyToProfile?: boolean;
            applyToBackground?: boolean;
        } | undefined;
        if (!cfg) return;

        // Fix: ThemeBrowser passes durationMs, convert to hours
        const durationHours = cfg.durationHours ?? ((cfg.durationMs ?? 0) / 3600000);
        if (!durationHours || durationHours <= 0) {
            alert('Duration set karo — kitne ghante chalega? (0 se zyada hona chahiye)');
            return;
        }

        const { doc, updateDoc } = await import('firebase/firestore');
        const { db } = await import('../firebase');
        const scheduledTheme: ScheduledTheme = {
            id: `sched_${Date.now()}`,
            themeId: appTheme.id,
            themeName: appTheme.name,
            themeEmoji: appTheme.emoji,
            themeColors: {
                bgColor: appTheme.colors.bgColor,
                topBarStart: appTheme.colors.topBarStart,
                topBarEnd: appTheme.colors.topBarEnd,
                navBg: appTheme.colors.navBg,
                navActive: appTheme.colors.navActive,
                navBorder: appTheme.colors.navBorder,
                cardBg: appTheme.colors.cardBg,
                cardBorder: appTheme.colors.cardBorder,
                btnStart: appTheme.colors.btnStart,
                btnEnd: appTheme.colors.btnEnd,
                textPrimary: appTheme.colors.textPrimary,
                textSecondary: appTheme.colors.textSecondary,
                accentGlow: appTheme.colors.accentGlow,
                progressColor: appTheme.colors.progressColor,
            },
            topBarEffect: appTheme.topBarEffect,
            animColor: appTheme.animColor,
            scheduledAt: cfg.scheduledAt,
            durationHours,
            target: cfg.target,
            applyToProfile: cfg.applyToProfile,
            applyToBackground: cfg.applyToBackground,
            createdBy: user.id,
            createdAt: new Date().toISOString(),
        };
        try {
            const settingsRef = doc(db, 'settings', 'global');
            await updateDoc(settingsRef, {
                scheduledThemes: [scheduledTheme],
            });
            const delayMs = (appTheme as any)._scheduleConfig?.delayMs ?? 0;
            if (delayMs > 0) {
                const mins = Math.round(delayMs / 60000);
                alert(`✅ Theme scheduled!\n"${appTheme.name}" ${mins} minute baad sabke liye broadcast hoga.\nDuration: ${durationHours.toFixed(1)} ghante`);
            } else {
                alert(`✅ Theme abhi live!\n"${appTheme.name}" real-time broadcast shuru ho gaya.\nDuration: ${durationHours.toFixed(1)} ghante`);
            }
        } catch (e) {
            console.error('Failed to schedule theme:', e);
            alert('Error: Theme save nahi hua. Firestore permissions check karo.');
        }
    }, [user.id]);

    return (
        <div className="min-h-screen pb-32 select-none" style={{ background: '#06080f' }}>

            {/* ── HEADER ── */}
            <div
                className="sticky top-0 z-20 px-4 py-3 flex items-center gap-3 shadow-xl"
                style={{
                    background: `linear-gradient(135deg, ${theme.topBarStart}, ${theme.topBarEnd})`,
                    boxShadow: `0 4px 20px ${theme.accentGlow}30`
                }}
            >
                <button
                    onClick={onBack}
                    className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center shrink-0 active:scale-90 transition-transform"
                >
                    <ArrowLeft size={16} className="text-white" />
                </button>
                <div className="flex-1">
                    <p className="text-sm font-black text-white">🎨 Theme Studio</p>
                    <p className="text-[9px] text-white/60">Har element ka alag color customize karo</p>
                </div>
                <div className="text-right">
                    <p className="text-[8px] text-white/50 font-bold uppercase">Coins</p>
                    <p className="text-sm font-black text-amber-300">🪙 {isAdmin ? '∞' : totalCoins}</p>
                </div>
            </div>

            <div className="px-4 pt-4 space-y-4">

                {/* ── ACTIVE STATUS ── */}
                {(themeTimeLeft || animTimeLeft) && (
                    <div className="flex gap-2">
                        {themeTimeLeft && (
                            <div
                                className="flex-1 rounded-2xl p-3 text-center border"
                                style={{ background: `${theme.btnStart}15`, borderColor: `${theme.btnStart}35` }}
                            >
                                <p className="text-[9px] font-black uppercase tracking-wider" style={{ color: theme.btnStart }}>🎨 Theme Active</p>
                                <p className="text-lg font-black text-white">{themeTimeLeft}</p>
                                <p className="text-[9px] text-white/40">baki hai</p>
                            </div>
                        )}
                        {animTimeLeft && (
                            <div
                                className="flex-1 rounded-2xl p-3 text-center border"
                                style={{ background: `${theme.accentGlow}15`, borderColor: `${theme.accentGlow}35` }}
                            >
                                <p className="text-[9px] font-black uppercase tracking-wider" style={{ color: theme.accentGlow }}>✨ Animation Active</p>
                                <p className="text-lg font-black text-white">{animTimeLeft}</p>
                                <p className="text-[9px] text-white/40">baki hai</p>
                            </div>
                        )}
                    </div>
                )}

                {/* ── COST NOTICE ── */}
                <div
                    className="rounded-2xl p-3 flex items-center gap-3 border"
                    style={{ background: `${theme.btnStart}12`, borderColor: `${theme.btnStart}30` }}
                >
                    <span className="text-2xl shrink-0">🪙</span>
                    <div>
                        <p className="text-xs font-black text-white">
                            {isAdmin ? 'Admin: Free mein apply karo!' : `${THEME_COST} Coins = 24 Ghante`}
                        </p>
                        <p className="text-[9px] text-white/40">
                            {isAdmin
                                ? 'Admin ke liye koi bhi theme/animation free hai'
                                : 'Apply karne ke baad 24 ghante ke liye active rahegi'}
                        </p>
                    </div>
                </div>

                {/* ── TAB BAR ── */}
                <div
                    className="flex rounded-2xl p-1 gap-1"
                    style={{ background: '#0d0f1a', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                    {([
                        { id: 'LIBRARY' as Tab, label: '📚 Library', sub: '1000+' },
                        { id: 'THEME' as Tab, label: '🎨 Custom', sub: isAdmin ? 'Free' : `${THEME_COST} coins` },
                        { id: 'ANIMATION' as Tab, label: '✨ Anim', sub: isAdmin ? 'Free' : `${ANIMATION_COST} coins` },
                        { id: 'GALLERY' as Tab, label: '🌍 Gallery', sub: 'Community' },
                    ]).map(t => (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id)}
                            className="flex-1 py-2.5 rounded-xl transition-all flex flex-col items-center gap-0.5 active:scale-95"
                            style={{
                                background: tab === t.id
                                    ? `linear-gradient(135deg, ${theme.btnStart}, ${theme.btnEnd})`
                                    : 'transparent',
                                boxShadow: tab === t.id ? `0 4px 12px ${theme.btnStart}40` : 'none',
                            }}
                        >
                            <span className="text-[11px] font-black text-white">{t.label}</span>
                            <span className={`text-[8px] font-bold ${tab === t.id ? 'text-white/70' : 'text-white/30'}`}>{t.sub}</span>
                        </button>
                    ))}
                </div>

                {/* ══════════════════════════════════
                    THEME TAB
                ══════════════════════════════════ */}
                {tab === 'THEME' && (
                    <div className="space-y-4">

                        {/* LIVE PREVIEW */}
                        <div>
                            <p className="text-[9px] font-black text-white/30 uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
                                <Eye size={10} /> Live Preview
                            </p>
                            <div
                                className="rounded-3xl overflow-hidden shadow-2xl border"
                                style={{ borderColor: `${theme.accentGlow}30` }}
                            >
                                {/* Phone top bar */}
                                <div
                                    className="px-4 py-3 flex items-center gap-2"
                                    style={{ background: `linear-gradient(135deg, ${theme.topBarStart}, ${theme.topBarEnd})` }}
                                >
                                    <div>
                                        <div className="h-2 w-16 rounded-full" style={{ background: theme.textPrimary, opacity: 0.7 }} />
                                        <div className="h-1.5 w-20 rounded-full mt-1" style={{ background: theme.textSecondary, opacity: 0.5 }} />
                                    </div>
                                    <div className="ml-auto flex items-center gap-1.5">
                                        <div
                                            className="h-5 px-2 rounded-full text-[8px] font-black flex items-center gap-1"
                                            style={{ background: 'rgba(255,255,255,0.18)', color: theme.textPrimary }}
                                        >
                                            💠 L15
                                        </div>
                                        <div
                                            className="h-5 px-2 rounded-full text-[8px] font-black flex items-center gap-1"
                                            style={{ background: 'rgba(255,255,255,0.12)', color: theme.textPrimary }}
                                        >
                                            🪙 {totalCoins}
                                        </div>
                                    </div>
                                </div>

                                {/* Phone content */}
                                <div className="p-3 space-y-2.5" style={{ background: theme.bgColor }}>

                                    {/* Progress bar */}
                                    <div
                                        className="h-1.5 rounded-full overflow-hidden"
                                        style={{ background: `${theme.progressColor}25` }}
                                    >
                                        <div
                                            className="h-full w-3/5 rounded-full transition-all"
                                            style={{ background: `linear-gradient(90deg, ${theme.progressColor}, ${theme.accentGlow})` }}
                                        />
                                    </div>

                                    {/* Cards grid */}
                                    <div className="grid grid-cols-2 gap-2">
                                        {[['📚', 'Notes', '24 chapters'], ['🎯', 'MCQ', '500+ questions'], ['🎓', 'Courses', '6 subjects'], ['🏆', 'Rank', 'Top 10%']].map(([emoji, label, sub]) => (
                                            <div
                                                key={label}
                                                className="rounded-xl p-2.5"
                                                style={{
                                                    background: theme.cardBg,
                                                    border: `1px solid ${theme.cardBorder}`,
                                                }}
                                            >
                                                <span className="text-base">{emoji}</span>
                                                <p className="text-[9px] font-black mt-1" style={{ color: theme.textPrimary }}>{label}</p>
                                                <p className="text-[8px]" style={{ color: theme.textSecondary }}>{sub}</p>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Action button */}
                                    <div
                                        className="rounded-xl py-2.5 text-center"
                                        style={{
                                            background: `linear-gradient(135deg, ${theme.btnStart}, ${theme.btnEnd})`,
                                            boxShadow: `0 4px 14px ${theme.btnStart}50`
                                        }}
                                    >
                                        <span className="text-[10px] font-black text-white">⚡ Start Learning</span>
                                    </div>

                                    {/* Avatar glow demo */}
                                    <div className="flex items-center gap-2">
                                        <div
                                            className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black text-white shrink-0"
                                            style={{
                                                background: `linear-gradient(135deg, ${theme.btnStart}, ${theme.btnEnd})`,
                                                boxShadow: `0 0 12px ${theme.accentGlow}70`
                                            }}
                                        >
                                            {(user.name || 'U')[0].toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black" style={{ color: theme.textPrimary }}>{user.name || 'Student'}</p>
                                            <p className="text-[8px]" style={{ color: theme.textSecondary }}>Level 15 • 1200 XP</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Phone bottom nav */}
                                <div
                                    className="grid grid-cols-4 border-t"
                                    style={{
                                        background: theme.navBg,
                                        borderColor: theme.navBorder,
                                    }}
                                >
                                    {[['🏠', 'Home', true], ['📖', 'Study', false], ['🎯', 'MCQ', false], ['👤', 'Profile', false]].map(([icon, lbl, active]) => (
                                        <div
                                            key={lbl as string}
                                            className="flex flex-col items-center py-2.5 gap-0.5"
                                            style={{ opacity: active ? 1 : 0.35 }}
                                        >
                                            <span className="text-base">{icon as string}</span>
                                            <p className="text-[8px] font-bold" style={{ color: active ? theme.navActive : theme.textSecondary }}>{lbl as string}</p>
                                            <div
                                                className="h-0.5 w-4 rounded-full"
                                                style={{ background: active ? theme.navActive : 'transparent' }}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* PRESET CHIPS */}
                        <div>
                            <p className="text-[9px] font-black text-white/30 uppercase tracking-widest mb-2.5">Quick Presets</p>
                            <div className="grid grid-cols-4 gap-2">
                                {PRESET_THEMES.map(p => (
                                    <button
                                        key={p.name}
                                        onClick={() => applyPreset(p)}
                                        className="flex flex-col items-center gap-1 py-2.5 px-1 rounded-2xl active:scale-90 transition-all border"
                                        style={{
                                            background: `${p.colors.btnStart}15`,
                                            borderColor: `${p.colors.btnStart}35`,
                                        }}
                                    >
                                        <div
                                            className="w-8 h-8 rounded-full relative overflow-hidden border-2 border-white/10"
                                            style={{
                                                background: `linear-gradient(135deg, ${p.colors.topBarStart}, ${p.colors.btnEnd})`,
                                            }}
                                        />
                                        <span className="text-[8px] font-black text-white/70">{p.emoji}</span>
                                        <span className="text-[7px] font-bold text-white/45 leading-tight text-center">{p.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* RESET TO DEFAULT */}
                        <button
                            onClick={() => setTheme({ ...DEFAULT_THEME })}
                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold text-white/40 border border-white/8 active:scale-95 transition-all"
                            style={{ background: '#0d0f1a' }}
                        >
                            <RotateCcw size={11} />
                            Default Colors Pe Reset Karo
                        </button>

                        {/* COLOR SECTION SELECTOR */}
                        <div>
                            <p className="text-[9px] font-black text-white/30 uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
                                <Palette size={10} /> Granular Controls — Har Element Alag
                            </p>
                            <div className="grid grid-cols-4 gap-1.5 mb-3">
                                {(Object.keys(SECTION_INFO) as ColorSection[]).map(sec => {
                                    const active = activeSection === sec;
                                    const info = SECTION_INFO[sec];
                                    return (
                                        <button
                                            key={sec}
                                            onClick={() => setActiveSection(sec)}
                                            className="flex flex-col items-center gap-1 py-2 px-1 rounded-xl text-center active:scale-90 transition-all border"
                                            style={{
                                                background: active ? `${theme.btnStart}25` : '#0d0f1a',
                                                borderColor: active ? `${theme.btnStart}60` : 'rgba(255,255,255,0.06)',
                                            }}
                                        >
                                            <span style={{ color: active ? theme.btnStart : 'rgba(255,255,255,0.35)' }}>
                                                {info.icon}
                                            </span>
                                            <span
                                                className="text-[7px] font-black leading-tight"
                                                style={{ color: active ? theme.textPrimary : 'rgba(255,255,255,0.4)' }}
                                            >
                                                {info.label}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Active section color pickers */}
                            <div
                                className="rounded-2xl p-4 border"
                                style={{ background: '#0d0f1a', borderColor: 'rgba(255,255,255,0.06)' }}
                            >
                                <div className="flex items-center gap-2 mb-3">
                                    <span style={{ color: theme.btnStart }}>{SECTION_INFO[activeSection].icon}</span>
                                    <div>
                                        <p className="text-xs font-black text-white">{SECTION_INFO[activeSection].label}</p>
                                        <p className="text-[9px] text-white/35">{SECTION_INFO[activeSection].desc}</p>
                                    </div>
                                </div>
                                {SECTION_COLORS[activeSection]}
                            </div>
                        </div>

                        {/* PUBLISH NAME */}
                        <div
                            className="rounded-2xl p-4 border"
                            style={{ background: '#0d0f1a', borderColor: 'rgba(255,255,255,0.06)' }}
                        >
                            <p className="text-[9px] font-black text-white/30 uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
                                <Globe size={10} /> Gallery mein Publish? (Optional)
                            </p>
                            <input
                                value={themeName}
                                onChange={e => setThemeName(e.target.value)}
                                placeholder="Theme ka naam likho (e.g. Midnight Ocean)"
                                className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/20 transition-colors"
                            />
                            <p className="text-[8px] text-white/20 mt-1.5">
                                Naam dene par sabhi users ke gallery mein dikhega
                            </p>
                        </div>

                        {/* APPLY BUTTONS */}
                        <div className="flex gap-2.5">
                            <button
                                onClick={() => handleApplyTheme(false)}
                                disabled={themeSaving}
                                className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-black text-sm text-white active:scale-95 transition-all disabled:opacity-50"
                                style={{
                                    background: `linear-gradient(135deg, ${theme.btnStart}, ${theme.btnEnd})`,
                                    boxShadow: `0 6px 20px ${theme.btnStart}50`,
                                }}
                            >
                                <Sparkles size={15} />
                                {themeSaving ? 'Saving...' : isAdmin ? 'Apply (Free)' : `Apply (${THEME_COST} 🪙)`}
                            </button>
                            {themeName.trim() && (
                                <button
                                    onClick={() => handleApplyTheme(true)}
                                    disabled={themeSaving}
                                    className="flex items-center justify-center gap-1.5 px-4 py-3.5 rounded-2xl font-black text-sm text-white active:scale-95 transition-all disabled:opacity-50 border border-white/15"
                                    style={{ background: '#0d0f1a' }}
                                >
                                    <Globe size={13} />
                                    Publish
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* ══════════════════════════════════
                    ANIMATION TAB
                ══════════════════════════════════ */}
                {tab === 'ANIMATION' && (
                    <div className="space-y-4">

                        {/* Color + Speed */}
                        <div
                            className="rounded-2xl p-4 border space-y-4"
                            style={{ background: '#0d0f1a', borderColor: 'rgba(255,255,255,0.06)' }}
                        >
                            <p className="text-[9px] font-black text-white/30 uppercase tracking-widest">Animation Color & Speed</p>

                            <div className="flex items-center gap-3">
                                <div
                                    className="w-12 h-12 rounded-xl border-2 border-white/10 shrink-0 relative overflow-hidden cursor-pointer"
                                    style={{ background: animColor }}
                                >
                                    <input
                                        type="color"
                                        value={animColor}
                                        onChange={e => setAnimColor(e.target.value)}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    />
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs font-bold text-white mb-1.5">Speed: <span style={{ color: animColor }}>{animSpeed.toFixed(1)}x</span></p>
                                    <input
                                        type="range" min={0.3} max={3} step={0.1}
                                        value={animSpeed}
                                        onChange={e => setAnimSpeed(parseFloat(e.target.value))}
                                        className="w-full"
                                        style={{ accentColor: animColor }}
                                    />
                                    <div className="flex justify-between text-[8px] text-white/25 mt-0.5">
                                        <span>Slow</span><span>Fast</span>
                                    </div>
                                </div>
                            </div>

                            {/* Live preview */}
                            <div className="relative overflow-hidden rounded-xl h-11 border border-white/8" style={{ background: '#0f172a' }}>
                                <TopBarEffectsLayer effects={[{ id: selectedEffect, enabled: true, color: animColor, speed: animSpeed }]} />
                                <div className="absolute inset-0 flex items-center justify-center z-10">
                                    <span className="text-[10px] font-bold text-white/60">{selectedEffectObj?.name}</span>
                                </div>
                            </div>
                        </div>

                        {/* Effect picker */}
                        {EFFECT_CATEGORIES.map(cat => {
                            const catEffects = TOP_BAR_EFFECTS.filter(e => e.category === cat);
                            return (
                                <div key={cat}>
                                    <p className="text-[9px] font-black text-white/25 uppercase tracking-widest mb-2">{cat}</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {catEffects.map(eff => (
                                            <button
                                                key={eff.id}
                                                onClick={() => setSelectedEffect(eff.id)}
                                                className="relative overflow-hidden rounded-xl border-2 transition-all active:scale-95"
                                                style={{
                                                    borderColor: selectedEffect === eff.id ? animColor : 'rgba(255,255,255,0.08)',
                                                    boxShadow: selectedEffect === eff.id ? `0 0 14px ${animColor}50` : 'none',
                                                }}
                                            >
                                                <div className="h-9 relative" style={{ background: '#0f172a' }}>
                                                    <TopBarEffectsLayer effects={[{ id: eff.id, enabled: true, color: animColor, speed: animSpeed }]} />
                                                    {selectedEffect === eff.id && (
                                                        <div className="absolute top-1 right-1 z-10">
                                                            <div
                                                                className="w-4 h-4 rounded-full flex items-center justify-center"
                                                                style={{ background: animColor }}
                                                            >
                                                                <Check size={9} className="text-white" strokeWidth={3} />
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                                <p
                                                    className="text-[8px] font-bold py-1 px-2 truncate"
                                                    style={{
                                                        background: selectedEffect === eff.id ? `${animColor}20` : '#0d0f1a',
                                                        color: selectedEffect === eff.id ? animColor : 'rgba(255,255,255,0.5)',
                                                    }}
                                                >
                                                    {eff.name}
                                                </p>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}

                        {/* Publish name */}
                        <div
                            className="rounded-2xl p-4 border"
                            style={{ background: '#0d0f1a', borderColor: 'rgba(255,255,255,0.06)' }}
                        >
                            <p className="text-[9px] font-black text-white/30 uppercase tracking-widest mb-2.5">Gallery mein Publish? (Optional)</p>
                            <input
                                value={animName}
                                onChange={e => setAnimName(e.target.value)}
                                placeholder="Animation ka naam (optional)"
                                className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/20 transition-colors"
                            />
                        </div>

                        {/* Apply buttons */}
                        <div className="flex gap-2.5">
                            <button
                                onClick={() => handleApplyAnimation(false)}
                                disabled={animSaving}
                                className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-black text-sm text-white active:scale-95 transition-all disabled:opacity-50"
                                style={{
                                    background: `linear-gradient(135deg, ${animColor}, ${animColor}99)`,
                                    boxShadow: `0 6px 20px ${animColor}50`,
                                }}
                            >
                                <Sparkles size={15} />
                                {animSaving ? 'Saving...' : isAdmin ? 'Apply (Free)' : `Apply (${ANIMATION_COST} 🪙)`}
                            </button>
                            {animName.trim() && (
                                <button
                                    onClick={() => handleApplyAnimation(true)}
                                    disabled={animSaving}
                                    className="flex items-center justify-center gap-1.5 px-4 py-3.5 rounded-2xl font-black text-sm text-white active:scale-95 transition-all disabled:opacity-50 border border-white/15"
                                    style={{ background: '#0d0f1a' }}
                                >
                                    <Globe size={13} />
                                    Publish
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* ══════════════════════════════════
                    GALLERY TAB
                ══════════════════════════════════ */}
                {/* ══════════════════════════════════
                    LIBRARY TAB
                ══════════════════════════════════ */}
                {tab === 'LIBRARY' && (
                    <div style={{ margin: '0 -16px' }}>
                        <ThemeBrowser
                            user={user}
                            isAdmin={isAdmin}
                            accentColor={theme.btnStart}
                            onApplyTheme={handleApplyFromLibrary}
                            onScheduleTheme={handleScheduleFromLibrary}
                            onBack={() => setTab('THEME')}
                        />
                    </div>
                )}

                {tab === 'GALLERY' && (
                    <div className="space-y-4">

                        {/* Themes gallery */}
                        <div>
                            <p className="text-[9px] font-black text-white/30 uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
                                <Palette size={10} /> Community Themes
                            </p>
                            {publishedThemes.length === 0 ? (
                                <div
                                    className="rounded-2xl p-8 text-center border"
                                    style={{ background: '#0d0f1a', borderColor: 'rgba(255,255,255,0.06)' }}
                                >
                                    <p className="text-3xl mb-2">🎨</p>
                                    <p className="text-sm font-black text-white/50">Abhi koi published theme nahi</p>
                                    <p className="text-[10px] text-white/25 mt-1">Pehle hone wale bano!</p>
                                </div>
                            ) : (
                                <div className="space-y-2.5">
                                    {publishedThemes.map(t => (
                                        <div
                                            key={t.id}
                                            className="rounded-2xl overflow-hidden border"
                                            style={{ borderColor: `${t.accentColor || t.btnStart || '#3b82f6'}30`, background: '#0d0f1a' }}
                                        >
                                            <div
                                                className="h-14 grid grid-cols-4 gap-1 p-2"
                                                style={{ background: t.bgColor || '#0f172a' }}
                                            >
                                                {[1, 2, 3, 4].map(i => (
                                                    <div
                                                        key={i}
                                                        className="rounded-lg flex items-center justify-center"
                                                        style={{
                                                            background: t.cardBg || t.cardColor || '#1e293b',
                                                            border: `1px solid ${t.cardBorder || t.accentColor || '#3b82f6'}30`,
                                                        }}
                                                    >
                                                        <div
                                                            className="h-1 w-6 rounded-full"
                                                            style={{ background: t.btnStart || t.accentColor || '#3b82f6' }}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="px-3 py-2.5 flex items-center justify-between">
                                                <div className="min-w-0">
                                                    <p className="text-xs font-black text-white truncate">{t.publishedName || 'Custom Theme'}</p>
                                                    <p className="text-[9px] text-white/35">by {t.userName}</p>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <div className="flex gap-1">
                                                        {[t.topBarStart || t.bgColor, t.btnStart || t.accentColor, t.navActive || t.accentColor, t.cardBg || t.cardColor].filter(Boolean).map((c, i) => (
                                                            <div key={i} className="w-4 h-4 rounded-full border border-white/15" style={{ background: c }} />
                                                        ))}
                                                    </div>
                                                    <button
                                                        onClick={() => likePublishedTheme(t.id, user.id)}
                                                        className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-black active:scale-95 transition-all"
                                                        style={{ background: '#1a0a0a', color: '#f87171' }}
                                                    >
                                                        <Heart size={9} /> {t.likes || 0}
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setTheme({
                                                                bgColor: t.bgColor || DEFAULT_THEME.bgColor,
                                                                topBarStart: t.topBarStart || DEFAULT_THEME.topBarStart,
                                                                topBarEnd: t.topBarEnd || DEFAULT_THEME.topBarEnd,
                                                                navBg: t.navBg || DEFAULT_THEME.navBg,
                                                                navActive: t.navActive || t.accentColor || DEFAULT_THEME.navActive,
                                                                navBorder: t.navBorder || DEFAULT_THEME.navBorder,
                                                                cardBg: t.cardBg || t.cardColor || DEFAULT_THEME.cardBg,
                                                                cardBorder: t.cardBorder || DEFAULT_THEME.cardBorder,
                                                                btnStart: t.btnStart || t.accentColor || DEFAULT_THEME.btnStart,
                                                                btnEnd: t.btnEnd || DEFAULT_THEME.btnEnd,
                                                                textPrimary: t.textColor || DEFAULT_THEME.textPrimary,
                                                                textSecondary: t.textSecondary || DEFAULT_THEME.textSecondary,
                                                                accentGlow: t.accentGlow || t.accentColor || DEFAULT_THEME.accentGlow,
                                                                progressColor: t.progressColor || t.accentColor || DEFAULT_THEME.progressColor,
                                                            });
                                                            setTab('THEME');
                                                        }}
                                                        className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black text-white active:scale-95 transition-all"
                                                        style={{ background: `${t.btnStart || t.accentColor || '#3b82f6'}40` }}
                                                    >
                                                        <Copy size={8} /> Use
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Animations gallery */}
                        <div>
                            <p className="text-[9px] font-black text-white/30 uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
                                <Sparkles size={10} /> Community Animations
                            </p>
                            {publishedAnimations.length === 0 ? (
                                <div
                                    className="rounded-2xl p-8 text-center border"
                                    style={{ background: '#0d0f1a', borderColor: 'rgba(255,255,255,0.06)' }}
                                >
                                    <p className="text-3xl mb-2">✨</p>
                                    <p className="text-sm font-black text-white/50">Abhi koi published animation nahi</p>
                                    <p className="text-[10px] text-white/25 mt-1">Pehle hone wale bano!</p>
                                </div>
                            ) : (
                                <div className="space-y-2.5">
                                    {publishedAnimations.map(a => (
                                        <div
                                            key={a.id}
                                            className="rounded-2xl overflow-hidden border"
                                            style={{ background: '#0d0f1a', borderColor: `${a.color}30` }}
                                        >
                                            <div className="relative h-10 overflow-hidden" style={{ background: '#0f172a' }}>
                                                <TopBarEffectsLayer effects={[{ id: a.effectId, enabled: true, color: a.color, speed: a.speed }]} />
                                            </div>
                                            <div className="px-3 py-2.5 flex items-center justify-between">
                                                <div className="min-w-0">
                                                    <p className="text-xs font-black text-white truncate">{a.publishedName || a.effectName}</p>
                                                    <p className="text-[9px] text-white/35">by {a.userName} • {a.effectName}</p>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <div className="w-4 h-4 rounded-full border border-white/15" style={{ background: a.color }} />
                                                    <button
                                                        onClick={() => likePublishedAnimation(a.id, user.id)}
                                                        className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-black active:scale-95 transition-all"
                                                        style={{ background: '#1a0a0a', color: '#f87171' }}
                                                    >
                                                        <Heart size={9} /> {a.likes || 0}
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setSelectedEffect(a.effectId);
                                                            setAnimColor(a.color);
                                                            setAnimSpeed(a.speed);
                                                            setTab('ANIMATION');
                                                        }}
                                                        className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black text-white active:scale-95 transition-all"
                                                        style={{ background: `${a.color}40` }}
                                                    >
                                                        <Copy size={8} /> Use
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
