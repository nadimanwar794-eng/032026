// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { User, UserCustomTheme, SystemSettings, ThemeHistoryEntry } from '../types';
import { saveUserToLive, saveSystemSettings } from '../firebase';
import { getTotalCredits, applyDeduction } from '../utils/creditSystem';
import {
    ArrowLeft, Sparkles, RotateCcw, Eye, Palette,
    Layers, Navigation, Square, Type, Zap, Star,
    ChevronRight, Check, X, AlertCircle, Globe, Clock, Users, BarChart2, CheckCircle, Home
} from 'lucide-react';

interface Props {
    user: User;
    onUpdateUser: (u: User) => void;
    onBack: () => void;
    settings?: SystemSettings | null;
    onUpdateSettings?: (s: SystemSettings) => void;
}

const THEME_COST = 200;

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
    flashcardBg1?: string;
    flashcardBg2?: string;
    chapterAccent?: string;
    mcqTabActive?: string;
    topBarEffect?: string;
    animColor?: string;
    animSpeed?: number;
    themeName?: string;
    themeEmoji?: string;
}

const DEFAULT_THEME: ThemeState = {
    bgColor: '#ffffff',
    topBarStart: '#1e3a5f',
    topBarEnd: '#0f1e3c',
    navBg: '#ffffff',
    navActive: '#3b82f6',
    navBorder: '#e2e8f0',
    cardBg: '#f8fafc',
    cardBorder: '#e2e8f0',
    btnStart: '#3b82f6',
    btnEnd: '#6366f1',
    textPrimary: '#1e293b',
    textSecondary: '#64748b',
    accentGlow: '#3b82f6',
    progressColor: '#3b82f6',
    flashcardBg1: '#0c2d6b',
    flashcardBg2: '#1e40af',
    chapterAccent: '#3b82f6',
    mcqTabActive: '#3b82f6',
};

const PRESETS: Array<{ name: string; emoji: string; colors: ThemeState; isDefault?: boolean }> = [
    {
        name: 'Default — ULTRA', emoji: '💙', isDefault: true,
        colors: {
            bgColor: '#ffffff', topBarStart: '#020714', topBarEnd: '#071232',
            navBg: '#ffffff', navActive: '#1e3a8a', navBorder: '#bfdbfe',
            cardBg: '#eff6ff', cardBorder: '#bfdbfe',
            btnStart: '#1e3a8a', btnEnd: '#2563eb',
            textPrimary: '#1e3a8a', textSecondary: '#1d4ed8',
            accentGlow: '#2563eb', progressColor: '#1e3a8a',
            flashcardBg1: '#04091e', flashcardBg2: '#071232',
            chapterAccent: '#1e3a8a', mcqTabActive: '#1e3a8a',
        }
    },
    {
        name: 'Default — BASIC', emoji: '⭐', isDefault: true,
        colors: {
            bgColor: '#ffffff', topBarStart: '#060c1a', topBarEnd: '#0a1535',
            navBg: '#ffffff', navActive: '#2563eb', navBorder: '#dbeafe',
            cardBg: '#eff6ff', cardBorder: '#dbeafe',
            btnStart: '#2563eb', btnEnd: '#3b82f6',
            textPrimary: '#1d4ed8', textSecondary: '#2563eb',
            accentGlow: '#3b82f6', progressColor: '#2563eb',
            flashcardBg1: '#0c1e55', flashcardBg2: '#1a3a8a',
            chapterAccent: '#2563eb', mcqTabActive: '#2563eb',
        }
    },
    {
        name: 'Default — FREE', emoji: '🎓', isDefault: true,
        colors: {
            bgColor: '#ffffff', topBarStart: '#0369a1', topBarEnd: '#0284c7',
            navBg: '#ffffff', navActive: '#0ea5e9', navBorder: '#bae6fd',
            cardBg: '#f0f9ff', cardBorder: '#bae6fd',
            btnStart: '#0284c7', btnEnd: '#0ea5e9',
            textPrimary: '#0369a1', textSecondary: '#0284c7',
            accentGlow: '#38bdf8', progressColor: '#0ea5e9',
            flashcardBg1: '#0284c7', flashcardBg2: '#0ea5e9',
            chapterAccent: '#0ea5e9', mcqTabActive: '#0ea5e9',
        }
    },
    {
        name: 'Ocean Blue', emoji: '🌊',
        colors: {
            bgColor: '#ffffff', topBarStart: '#0c2d6b', topBarEnd: '#061635',
            navBg: '#ffffff', navActive: '#38bdf8', navBorder: '#e0f2fe',
            cardBg: '#f0f9ff', cardBorder: '#bae6fd',
            btnStart: '#0ea5e9', btnEnd: '#6366f1',
            textPrimary: '#0c1a2e', textSecondary: '#0369a1',
            accentGlow: '#38bdf8', progressColor: '#0ea5e9',
            flashcardBg1: '#0c2d6b', flashcardBg2: '#0369a1',
            chapterAccent: '#0ea5e9', mcqTabActive: '#0ea5e9',
        }
    },
    {
        name: 'Sakura', emoji: '🌸',
        colors: {
            bgColor: '#ffffff', topBarStart: '#7b1045', topBarEnd: '#9d174d',
            navBg: '#ffffff', navActive: '#f43f5e', navBorder: '#fecdd3',
            cardBg: '#fff1f2', cardBorder: '#fecdd3',
            btnStart: '#f43f5e', btnEnd: '#ec4899',
            textPrimary: '#1e0a10', textSecondary: '#9f1239',
            accentGlow: '#f43f5e', progressColor: '#e11d48',
            flashcardBg1: '#7b1045', flashcardBg2: '#9d174d',
            chapterAccent: '#f43f5e', mcqTabActive: '#f43f5e',
        }
    },
    {
        name: 'Forest', emoji: '🌿',
        colors: {
            bgColor: '#ffffff', topBarStart: '#064e20', topBarEnd: '#065f46',
            navBg: '#ffffff', navActive: '#22c55e', navBorder: '#dcfce7',
            cardBg: '#f0fdf4', cardBorder: '#bbf7d0',
            btnStart: '#16a34a', btnEnd: '#059669',
            textPrimary: '#052e16', textSecondary: '#166534',
            accentGlow: '#22c55e', progressColor: '#16a34a',
            flashcardBg1: '#064e20', flashcardBg2: '#065f46',
            chapterAccent: '#22c55e', mcqTabActive: '#16a34a',
        }
    },
    {
        name: 'Gold', emoji: '⚡',
        colors: {
            bgColor: '#ffffff', topBarStart: '#7c4a00', topBarEnd: '#92400e',
            navBg: '#ffffff', navActive: '#f59e0b', navBorder: '#fef3c7',
            cardBg: '#fffbeb', cardBorder: '#fde68a',
            btnStart: '#f59e0b', btnEnd: '#f97316',
            textPrimary: '#1c0a00', textSecondary: '#92400e',
            accentGlow: '#f59e0b', progressColor: '#d97706',
            flashcardBg1: '#7c4a00', flashcardBg2: '#92400e',
            chapterAccent: '#f59e0b', mcqTabActive: '#f59e0b',
        }
    },
    {
        name: 'Violet', emoji: '💜',
        colors: {
            bgColor: '#ffffff', topBarStart: '#4a1d96', topBarEnd: '#6d28d9',
            navBg: '#ffffff', navActive: '#a855f7', navBorder: '#f3e8ff',
            cardBg: '#faf5ff', cardBorder: '#e9d5ff',
            btnStart: '#8b5cf6', btnEnd: '#ec4899',
            textPrimary: '#1e0a3c', textSecondary: '#6d28d9',
            accentGlow: '#a855f7', progressColor: '#7c3aed',
            flashcardBg1: '#4a1d96', flashcardBg2: '#6d28d9',
            chapterAccent: '#a855f7', mcqTabActive: '#8b5cf6',
        }
    },
    {
        name: 'Sunset', emoji: '🔥',
        colors: {
            bgColor: '#ffffff', topBarStart: '#9a2a00', topBarEnd: '#c2410c',
            navBg: '#ffffff', navActive: '#f97316', navBorder: '#ffedd5',
            cardBg: '#fff7ed', cardBorder: '#fed7aa',
            btnStart: '#f97316', btnEnd: '#ef4444',
            textPrimary: '#1c0a00', textSecondary: '#c2410c',
            accentGlow: '#f97316', progressColor: '#ea580c',
            flashcardBg1: '#9a2a00', flashcardBg2: '#c2410c',
            chapterAccent: '#f97316', mcqTabActive: '#f97316',
        }
    },
    {
        name: 'Arctic', emoji: '❄️',
        colors: {
            bgColor: '#ffffff', topBarStart: '#0e4060', topBarEnd: '#0e7490',
            navBg: '#ffffff', navActive: '#67e8f9', navBorder: '#cffafe',
            cardBg: '#ecfeff', cardBorder: '#a5f3fc',
            btnStart: '#22d3ee', btnEnd: '#06b6d4',
            textPrimary: '#082f49', textSecondary: '#0e7490',
            accentGlow: '#22d3ee', progressColor: '#0891b2',
            flashcardBg1: '#0e4060', flashcardBg2: '#0e7490',
            chapterAccent: '#22d3ee', mcqTabActive: '#06b6d4',
        }
    },
    {
        name: 'Ruby', emoji: '❤️',
        colors: {
            bgColor: '#ffffff', topBarStart: '#7f1d1d', topBarEnd: '#991b1b',
            navBg: '#ffffff', navActive: '#ef4444', navBorder: '#fee2e2',
            cardBg: '#fff5f5', cardBorder: '#fecaca',
            btnStart: '#ef4444', btnEnd: '#dc2626',
            textPrimary: '#1c0a0a', textSecondary: '#991b1b',
            accentGlow: '#ef4444', progressColor: '#dc2626',
            flashcardBg1: '#7f1d1d', flashcardBg2: '#991b1b',
            chapterAccent: '#ef4444', mcqTabActive: '#ef4444',
        }
    },
    {
        name: 'Midnight', emoji: '🌌',
        colors: {
            bgColor: '#ffffff', topBarStart: '#1a1a3a', topBarEnd: '#312e81',
            navBg: '#ffffff', navActive: '#818cf8', navBorder: '#e0e7ff',
            cardBg: '#eef2ff', cardBorder: '#c7d2fe',
            btnStart: '#6366f1', btnEnd: '#4f46e5',
            textPrimary: '#1e1b4b', textSecondary: '#4338ca',
            accentGlow: '#818cf8', progressColor: '#4f46e5',
            flashcardBg1: '#1a1a3a', flashcardBg2: '#312e81',
            chapterAccent: '#818cf8', mcqTabActive: '#6366f1',
        }
    },
    {
        name: 'Emerald', emoji: '💎',
        colors: {
            bgColor: '#ffffff', topBarStart: '#065f46', topBarEnd: '#047857',
            navBg: '#ffffff', navActive: '#10b981', navBorder: '#d1fae5',
            cardBg: '#ecfdf5', cardBorder: '#a7f3d0',
            btnStart: '#10b981', btnEnd: '#059669',
            textPrimary: '#022c22', textSecondary: '#065f46',
            accentGlow: '#10b981', progressColor: '#059669',
            flashcardBg1: '#065f46', flashcardBg2: '#047857',
            chapterAccent: '#10b981', mcqTabActive: '#059669',
        }
    },
    {
        name: 'Royal', emoji: '👑',
        colors: {
            bgColor: '#ffffff', topBarStart: '#1e3a8a', topBarEnd: '#1e40af',
            navBg: '#ffffff', navActive: '#60a5fa', navBorder: '#dbeafe',
            cardBg: '#eff6ff', cardBorder: '#bfdbfe',
            btnStart: '#2563eb', btnEnd: '#1d4ed8',
            textPrimary: '#1e3a8a', textSecondary: '#1d4ed8',
            accentGlow: '#3b82f6', progressColor: '#1d4ed8',
            flashcardBg1: '#1e3a8a', flashcardBg2: '#1e40af',
            chapterAccent: '#2563eb', mcqTabActive: '#60a5fa',
        }
    },
    {
        name: 'Rose Gold', emoji: '🌹',
        colors: {
            bgColor: '#ffffff', topBarStart: '#881337', topBarEnd: '#be123c',
            navBg: '#ffffff', navActive: '#fb7185', navBorder: '#ffe4e6',
            cardBg: '#fff1f2', cardBorder: '#fecdd3',
            btnStart: '#fb7185', btnEnd: '#f43f5e',
            textPrimary: '#1c0a0e', textSecondary: '#be123c',
            accentGlow: '#fb7185', progressColor: '#e11d48',
            flashcardBg1: '#881337', flashcardBg2: '#be123c',
            chapterAccent: '#fb7185', mcqTabActive: '#f43f5e',
        }
    },
    {
        name: 'Neon Cyan', emoji: '💠',
        colors: {
            bgColor: '#ffffff', topBarStart: '#003d50', topBarEnd: '#0e7490',
            navBg: '#ffffff', navActive: '#06b6d4', navBorder: '#cffafe',
            cardBg: '#ecfeff', cardBorder: '#a5f3fc',
            btnStart: '#00bcd4', btnEnd: '#00acc1',
            textPrimary: '#082f49', textSecondary: '#0e7490',
            accentGlow: '#06b6d4', progressColor: '#00bcd4',
            flashcardBg1: '#003d50', flashcardBg2: '#0e7490',
            chapterAccent: '#06b6d4', mcqTabActive: '#00bcd4',
        }
    },
    {
        name: 'Dracula', emoji: '🧛',
        colors: {
            bgColor: '#ffffff', topBarStart: '#44005c', topBarEnd: '#6b21a8',
            navBg: '#ffffff', navActive: '#bd93f9', navBorder: '#f3e8ff',
            cardBg: '#faf5ff', cardBorder: '#e9d5ff',
            btnStart: '#bd93f9', btnEnd: '#ff79c6',
            textPrimary: '#1a0030', textSecondary: '#6b21a8',
            accentGlow: '#bd93f9', progressColor: '#6272a4',
            flashcardBg1: '#44005c', flashcardBg2: '#6b21a8',
            chapterAccent: '#bd93f9', mcqTabActive: '#bd93f9',
        }
    },
    {
        name: 'Harvest', emoji: '🍂',
        colors: {
            bgColor: '#ffffff', topBarStart: '#78340f', topBarEnd: '#92400e',
            navBg: '#ffffff', navActive: '#fb923c', navBorder: '#ffedd5',
            cardBg: '#fff7ed', cardBorder: '#fed7aa',
            btnStart: '#ea580c', btnEnd: '#b45309',
            textPrimary: '#1c0a00', textSecondary: '#92400e',
            accentGlow: '#fb923c', progressColor: '#c2410c',
            flashcardBg1: '#78340f', flashcardBg2: '#92400e',
            chapterAccent: '#fb923c', mcqTabActive: '#ea580c',
        }
    },
    {
        name: 'Jade', emoji: '🍃',
        colors: {
            bgColor: '#ffffff', topBarStart: '#005f3d', topBarEnd: '#047857',
            navBg: '#ffffff', navActive: '#34d399', navBorder: '#d1fae5',
            cardBg: '#ecfdf5', cardBorder: '#a7f3d0',
            btnStart: '#059669', btnEnd: '#047857',
            textPrimary: '#022c22', textSecondary: '#065f46',
            accentGlow: '#34d399', progressColor: '#059669',
            flashcardBg1: '#005f3d', flashcardBg2: '#047857',
            chapterAccent: '#34d399', mcqTabActive: '#059669',
        }
    },
    {
        name: 'Crimson', emoji: '🔴',
        colors: {
            bgColor: '#ffffff', topBarStart: '#7f0010', topBarEnd: '#9f1239',
            navBg: '#ffffff', navActive: '#f43f5e', navBorder: '#fff1f2',
            cardBg: '#fff1f2', cardBorder: '#fecdd3',
            btnStart: '#e11d48', btnEnd: '#be123c',
            textPrimary: '#1c0008', textSecondary: '#9f1239',
            accentGlow: '#f43f5e', progressColor: '#dc2626',
            flashcardBg1: '#7f0010', flashcardBg2: '#9f1239',
            chapterAccent: '#f43f5e', mcqTabActive: '#e11d48',
        }
    },
    {
        name: 'Saffron', emoji: '🌼',
        colors: {
            bgColor: '#ffffff', topBarStart: '#92400e', topBarEnd: '#b45309',
            navBg: '#ffffff', navActive: '#fbbf24', navBorder: '#fef3c7',
            cardBg: '#fffbeb', cardBorder: '#fde68a',
            btnStart: '#f59e0b', btnEnd: '#d97706',
            textPrimary: '#1c0e00', textSecondary: '#92400e',
            accentGlow: '#fbbf24', progressColor: '#b45309',
            flashcardBg1: '#92400e', flashcardBg2: '#b45309',
            chapterAccent: '#fbbf24', mcqTabActive: '#f59e0b',
        }
    },
    {
        name: 'Deep Space', emoji: '🚀',
        colors: {
            bgColor: '#ffffff', topBarStart: '#0f0f30', topBarEnd: '#1e1b4b',
            navBg: '#ffffff', navActive: '#7c6fcd', navBorder: '#e0e7ff',
            cardBg: '#eef2ff', cardBorder: '#c7d2fe',
            btnStart: '#4c46a8', btnEnd: '#3730a3',
            textPrimary: '#1e1b4b', textSecondary: '#3730a3',
            accentGlow: '#7c6fcd', progressColor: '#5b54c2',
            flashcardBg1: '#0f0f30', flashcardBg2: '#1e1b4b',
            chapterAccent: '#7c6fcd', mcqTabActive: '#4c46a8',
        }
    },
    {
        name: 'Bubblegum', emoji: '🍬',
        colors: {
            bgColor: '#ffffff', topBarStart: '#701a75', topBarEnd: '#a21caf',
            navBg: '#ffffff', navActive: '#e879f9', navBorder: '#fdf4ff',
            cardBg: '#fdf4ff', cardBorder: '#f0abfc',
            btnStart: '#d946ef', btnEnd: '#c026d3',
            textPrimary: '#1a0620', textSecondary: '#a21caf',
            accentGlow: '#e879f9', progressColor: '#a21caf',
            flashcardBg1: '#701a75', flashcardBg2: '#a21caf',
            chapterAccent: '#e879f9', mcqTabActive: '#d946ef',
        }
    },
    {
        name: 'Bronze', emoji: '🥉',
        colors: {
            bgColor: '#ffffff', topBarStart: '#7a3c00', topBarEnd: '#92400e',
            navBg: '#ffffff', navActive: '#cd7f32', navBorder: '#fef3c7',
            cardBg: '#fffbeb', cardBorder: '#fde68a',
            btnStart: '#b45309', btnEnd: '#92400e',
            textPrimary: '#1c0e00', textSecondary: '#92400e',
            accentGlow: '#cd7f32', progressColor: '#a16207',
            flashcardBg1: '#7a3c00', flashcardBg2: '#92400e',
            chapterAccent: '#cd7f32', mcqTabActive: '#b45309',
        }
    },
    {
        name: 'Electric Lime', emoji: '⚡',
        colors: {
            bgColor: '#ffffff', topBarStart: '#2d5a00', topBarEnd: '#3f6212',
            navBg: '#ffffff', navActive: '#a3e635', navBorder: '#ecfccb',
            cardBg: '#f7fee7', cardBorder: '#d9f99d',
            btnStart: '#84cc16', btnEnd: '#65a30d',
            textPrimary: '#1a2e05', textSecondary: '#3f6212',
            accentGlow: '#a3e635', progressColor: '#65a30d',
            flashcardBg1: '#2d5a00', flashcardBg2: '#3f6212',
            chapterAccent: '#a3e635', mcqTabActive: '#84cc16',
        }
    },
    {
        name: 'Glacier', emoji: '🧊',
        colors: {
            bgColor: '#ffffff', topBarStart: '#0c3352', topBarEnd: '#075985',
            navBg: '#ffffff', navActive: '#7dd3fc', navBorder: '#e0f2fe',
            cardBg: '#f0f9ff', cardBorder: '#bae6fd',
            btnStart: '#0ea5e9', btnEnd: '#0284c7',
            textPrimary: '#0c2038', textSecondary: '#075985',
            accentGlow: '#7dd3fc', progressColor: '#38bdf8',
            flashcardBg1: '#0c3352', flashcardBg2: '#075985',
            chapterAccent: '#7dd3fc', mcqTabActive: '#0ea5e9',
        }
    },
    {
        name: 'Inferno', emoji: '🌋',
        colors: {
            bgColor: '#ffffff', topBarStart: '#991b1b', topBarEnd: '#b91c1c',
            navBg: '#ffffff', navActive: '#f87171', navBorder: '#fee2e2',
            cardBg: '#fff5f5', cardBorder: '#fecaca',
            btnStart: '#dc2626', btnEnd: '#b91c1c',
            textPrimary: '#1c0a0a', textSecondary: '#991b1b',
            accentGlow: '#f87171', progressColor: '#ef4444',
            flashcardBg1: '#991b1b', flashcardBg2: '#b91c1c',
            chapterAccent: '#f87171', mcqTabActive: '#dc2626',
        }
    },
    {
        name: 'Purple Haze', emoji: '🔮',
        colors: {
            bgColor: '#ffffff', topBarStart: '#5b21b6', topBarEnd: '#7e22ce',
            navBg: '#ffffff', navActive: '#c084fc', navBorder: '#faf5ff',
            cardBg: '#faf5ff', cardBorder: '#e9d5ff',
            btnStart: '#9333ea', btnEnd: '#7e22ce',
            textPrimary: '#1a0a3c', textSecondary: '#7e22ce',
            accentGlow: '#c084fc', progressColor: '#7c3aed',
            flashcardBg1: '#5b21b6', flashcardBg2: '#7e22ce',
            chapterAccent: '#c084fc', mcqTabActive: '#9333ea',
        }
    },
    {
        name: 'Cobalt', emoji: '💙',
        colors: {
            bgColor: '#ffffff', topBarStart: '#0e2870', topBarEnd: '#1e3a8a',
            navBg: '#ffffff', navActive: '#60a5fa', navBorder: '#dbeafe',
            cardBg: '#eff6ff', cardBorder: '#bfdbfe',
            btnStart: '#2563eb', btnEnd: '#1d4ed8',
            textPrimary: '#0a1a50', textSecondary: '#1e3a8a',
            accentGlow: '#60a5fa', progressColor: '#3b82f6',
            flashcardBg1: '#0e2870', flashcardBg2: '#1e3a8a',
            chapterAccent: '#60a5fa', mcqTabActive: '#2563eb',
        }
    },
    {
        name: 'Coral', emoji: '🪸',
        colors: {
            bgColor: '#ffffff', topBarStart: '#9a3412', topBarEnd: '#c2410c',
            navBg: '#ffffff', navActive: '#fb923c', navBorder: '#ffedd5',
            cardBg: '#fff7ed', cardBorder: '#fed7aa',
            btnStart: '#f97316', btnEnd: '#ea580c',
            textPrimary: '#1c0a00', textSecondary: '#c2410c',
            accentGlow: '#fb923c', progressColor: '#c2410c',
            flashcardBg1: '#9a3412', flashcardBg2: '#c2410c',
            chapterAccent: '#fb923c', mcqTabActive: '#f97316',
        }
    },
    {
        name: 'Onyx', emoji: '⬛',
        colors: {
            bgColor: '#ffffff', topBarStart: '#1a1a1a', topBarEnd: '#374151',
            navBg: '#ffffff', navActive: '#6b7280', navBorder: '#f1f5f9',
            cardBg: '#f8fafc', cardBorder: '#e2e8f0',
            btnStart: '#475569', btnEnd: '#334155',
            textPrimary: '#0f172a', textSecondary: '#475569',
            accentGlow: '#6b7280', progressColor: '#64748b',
            flashcardBg1: '#1a1a1a', flashcardBg2: '#374151',
            chapterAccent: '#6b7280', mcqTabActive: '#475569',
        }
    },
    {
        name: 'Cosmic', emoji: '🌠',
        colors: {
            bgColor: '#ffffff', topBarStart: '#1a003d', topBarEnd: '#4c1d95',
            navBg: '#ffffff', navActive: '#a78bfa', navBorder: '#f5f3ff',
            cardBg: '#f5f3ff', cardBorder: '#ddd6fe',
            btnStart: '#7c3aed', btnEnd: '#c026d3',
            textPrimary: '#1a0040', textSecondary: '#4c1d95',
            accentGlow: '#a78bfa', progressColor: '#8b5cf6',
            flashcardBg1: '#1a003d', flashcardBg2: '#4c1d95',
            chapterAccent: '#a78bfa', mcqTabActive: '#7c3aed',
        }
    },
    {
        name: 'Turquoise', emoji: '🐟',
        colors: {
            bgColor: '#ffffff', topBarStart: '#0f5a52', topBarEnd: '#0f766e',
            navBg: '#ffffff', navActive: '#2dd4bf', navBorder: '#ccfbf1',
            cardBg: '#f0fdfa', cardBorder: '#99f6e4',
            btnStart: '#0d9488', btnEnd: '#0f766e',
            textPrimary: '#042f2e', textSecondary: '#0f766e',
            accentGlow: '#2dd4bf', progressColor: '#14b8a6',
            flashcardBg1: '#0f5a52', flashcardBg2: '#0f766e',
            chapterAccent: '#2dd4bf', mcqTabActive: '#0d9488',
        }
    },
];

type ColorSection = 'BACKGROUND' | 'TOPBAR' | 'NAVIGATION' | 'CARDS' | 'BUTTONS' | 'TEXT' | 'ACCENTS' | 'FLASHCARD' | 'CHAPTERS' | 'MCQ_TABS';

const SECTIONS: Array<{ id: ColorSection; label: string; icon: React.ReactNode; desc: string }> = [
    { id: 'BACKGROUND', label: 'Background', icon: <Layers size={13} />,      desc: 'App ki main background color' },
    { id: 'TOPBAR',     label: 'Top Bar',    icon: <ChevronRight size={13} />, desc: 'Header gradient — dono colors alag' },
    { id: 'NAVIGATION', label: 'Navigation', icon: <Navigation size={13} />,   desc: 'Bottom nav — 3 colors alag' },
    { id: 'CARDS',      label: 'Cards',      icon: <Square size={13} />,       desc: 'Card background aur border alag' },
    { id: 'CHAPTERS',   label: 'Chapters',   icon: <BarChart2 size={13} />,    desc: 'Chapter list ka accent color' },
    { id: 'BUTTONS',    label: 'Buttons',    icon: <Zap size={13} />,          desc: 'Button gradient — dono alag' },
    { id: 'MCQ_TABS',   label: 'MCQ Tabs',   icon: <Globe size={13} />,        desc: 'MCQ/Q&A/Flashcard active tab color' },
    { id: 'FLASHCARD',  label: 'Flashcard',  icon: <Sparkles size={13} />,     desc: 'Flashcard screen background gradient' },
    { id: 'TEXT',       label: 'Text',       icon: <Type size={13} />,         desc: 'Primary aur secondary text alag' },
    { id: 'ACCENTS',    label: 'Accents',    icon: <Star size={13} />,         desc: 'Glow aur progress bar alag' },
];

interface ColorRowProps {
    label: string;
    sub?: string;
    value: string;
    onChange: (v: string) => void;
    accent: string;
}
const ColorRow: React.FC<ColorRowProps> = ({ label, sub, value, onChange, accent }) => {
    const [hexInput, setHexInput] = React.useState(value.toUpperCase());
    const [hexError, setHexError] = React.useState(false);

    React.useEffect(() => {
        setHexInput(value.toUpperCase());
        setHexError(false);
    }, [value]);

    const handleHexChange = (raw: string) => {
        let v = raw.trim();
        if (!v.startsWith('#')) v = '#' + v;
        v = v.replace(/[^#0-9a-fA-F]/g, '');
        if (v.length > 7) v = v.slice(0, 7);
        setHexInput(v.toUpperCase());
        const isValid = /^#[0-9a-fA-F]{6}$/.test(v);
        setHexError(!isValid && v.length > 1);
        if (isValid) { onChange(v); setHexError(false); }
    };

    const handleHexBlur = () => {
        if (!/^#[0-9a-fA-F]{6}$/.test(hexInput)) {
            setHexInput(value.toUpperCase());
            setHexError(false);
        }
    };

    return (
        <div className="py-2.5 border-b border-white/5 last:border-0">
            <div className="flex items-center gap-3">
                <div
                    className="w-10 h-10 rounded-xl border-2 shrink-0 cursor-pointer relative overflow-hidden shadow-lg"
                    style={{ background: value, borderColor: `${accent}40` }}
                >
                    <input
                        type="color" value={value}
                        onChange={e => onChange(e.target.value)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white/90">{label}</p>
                    {sub && <p className="text-[9px] text-white/35 mt-0.5">{sub}</p>}
                </div>
                <div
                    className="w-6 h-6 rounded-lg border border-white/10 cursor-pointer relative overflow-hidden shrink-0"
                    style={{ background: value }}
                >
                    <input
                        type="color" value={value}
                        onChange={e => onChange(e.target.value)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                </div>
            </div>
            {/* Hex code input */}
            <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 flex items-center rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)', border: hexError ? '1px solid rgba(239,68,68,0.6)' : '1px solid rgba(255,255,255,0.1)' }}>
                    <span className="px-2.5 text-[10px] font-black text-white/30 border-r border-white/10 select-none py-2">#</span>
                    <input
                        type="text"
                        value={hexInput.replace('#', '')}
                        onChange={e => handleHexChange(e.target.value)}
                        onBlur={handleHexBlur}
                        placeholder="Code daalo (e.g. FF5733)"
                        maxLength={6}
                        className="flex-1 px-2 py-2 text-[10px] font-mono font-bold bg-transparent outline-none placeholder-white/15"
                        style={{ color: hexError ? '#f87171' : 'rgba(255,255,255,0.75)' }}
                    />
                    {!hexError && hexInput.length === 7 && (
                        <div className="w-4 h-4 rounded-full mx-2 shrink-0 border border-white/20" style={{ background: value }} />
                    )}
                    {hexError && (
                        <span className="text-[9px] text-red-400 px-2 shrink-0">❌</span>
                    )}
                </div>
                <span className="text-[8px] text-white/20 font-bold shrink-0">Hex</span>
            </div>
        </div>
    );
};

const stateFromTheme = (t: UserCustomTheme | undefined): ThemeState => {
    if (!t) return { ...DEFAULT_THEME };
    const accent = t.accentColor || t.btnStart || DEFAULT_THEME.btnStart;
    return {
        bgColor:       t.bgColor       || DEFAULT_THEME.bgColor,
        topBarStart:   t.topBarStart   || DEFAULT_THEME.topBarStart,
        topBarEnd:     t.topBarEnd     || DEFAULT_THEME.topBarEnd,
        navBg:         t.navBg         || DEFAULT_THEME.navBg,
        navActive:     t.navActive     || accent || DEFAULT_THEME.navActive,
        navBorder:     t.navBorder     || DEFAULT_THEME.navBorder,
        cardBg:        t.cardBg        || t.cardColor   || DEFAULT_THEME.cardBg,
        cardBorder:    t.cardBorder    || DEFAULT_THEME.cardBorder,
        btnStart:      t.btnStart      || accent || DEFAULT_THEME.btnStart,
        btnEnd:        t.btnEnd        || DEFAULT_THEME.btnEnd,
        textPrimary:   t.textColor     || DEFAULT_THEME.textPrimary,
        textSecondary: t.textSecondary || DEFAULT_THEME.textSecondary,
        accentGlow:    t.accentGlow    || accent || DEFAULT_THEME.accentGlow,
        progressColor: t.progressColor || accent || DEFAULT_THEME.progressColor,
        flashcardBg1:  t.flashcardBg1  || t.topBarStart || DEFAULT_THEME.flashcardBg1,
        flashcardBg2:  t.flashcardBg2  || t.topBarEnd   || DEFAULT_THEME.flashcardBg2,
        chapterAccent: t.chapterAccent || accent || DEFAULT_THEME.chapterAccent,
        mcqTabActive:  t.mcqTabActive  || accent || DEFAULT_THEME.mcqTabActive,
        topBarEffect:  t.topBarEffect,
        animColor:     t.animColor,
        animSpeed:     t.animSpeed,
        themeName:     t.themeName,
        themeEmoji:    t.themeEmoji,
    };
};

export const ThemeCustomizer: React.FC<Props> = ({ user, onUpdateUser, onBack, settings, onUpdateSettings }) => {
    const isAdmin = user.role === 'ADMIN' || user.role === 'SUB_ADMIN';

    const totalCoins = getTotalCredits(user);
    const isFirstTime = !user.personalTheme;


    /* ── STATE ── */
    const [theme, setTheme]               = useState<ThemeState>(() => stateFromTheme(user.personalTheme));
    const [saving, setSaving]             = useState(false);
    const [activeSection, setActiveSection] = useState<ColorSection>('TOPBAR');

    /* ── CUSTOM THEME BUILDER ── */
    const [builderMode, setBuilderMode]         = useState<'SIMPLE' | 'ADVANCED'>('SIMPLE');
    const [simpleColor, setSimpleColor]         = useState<string>(() => user.personalTheme?.btnStart || DEFAULT_THEME.btnStart);
    const [simpleBorderColor, setSimpleBorderColor] = useState<string>(() => user.personalTheme?.cardBorder || DEFAULT_THEME.cardBorder);

    /* Entry popup — shown once when user opens Theme Studio */
    const [showEntryPopup, setShowEntryPopup] = useState(true);
    /* Selected preset index in the entry popup (-1 = none) */
    const [popupPresetIdx, setPopupPresetIdx] = useState<number>(-1);

    /* Coin confirmation popup — shown before applying a 2nd/changed theme */
    const [showCoinPopup, setShowCoinPopup]   = useState(false);

    /* ── ADMIN OFFICIAL TIER APPLY STATE ── */
    const [showOfficialPopup, setShowOfficialPopup] = useState(false);
    const [officialTier, setOfficialTier] = useState<'ultra' | 'basic' | 'free'>('free');
    const [officialSaving, setOfficialSaving] = useState(false);
    const [showDefaultPopup, setShowDefaultPopup] = useState(false);
    const [defaultSaving, setDefaultSaving] = useState(false);

    /* ── ADMIN THEME SCHEDULE STATE ── */
    const [showSchedulePopup, setShowSchedulePopup] = useState(false);
    const [scheduleEventName, setScheduleEventName] = useState('');
    const [scheduleStartDt,   setScheduleStartDt]   = useState('');
    const [scheduleDurationH, setScheduleDurationH] = useState<number>(2);
    const [scheduleTier,      setScheduleTier]       = useState<'ALL' | 'ULTRA' | 'BASIC' | 'FREE'>('ALL');
    const [scheduleApplyProfile, setScheduleApplyProfile] = useState(false);
    const [scheduleApplyBg,      setScheduleApplyBg]      = useState(false);
    const [scheduleSaving,       setScheduleSaving]        = useState(false);
    /* Local live state so admin sees immediate feedback after apply/remove */
    const [liveAdminTheme, setLiveAdminTheme]   = useState(settings?.adminAppliedTheme);

    /* ── ADMIN GLOBAL APPLY NOW STATE ── */
    const [showGlobalNowPopup, setShowGlobalNowPopup] = useState(false);
    const [globalNowTier, setGlobalNowTier] = useState<'ALL' | 'ULTRA' | 'BASIC' | 'FREE'>('ALL');
    const [globalNowHours, setGlobalNowHours] = useState<number>(24);
    const [globalNowPermanent, setGlobalNowPermanent] = useState<boolean>(false);
    const [globalNowSaving, setGlobalNowSaving] = useState(false);

    /* ── ADMIN PROFILE THEME STATE ── */
    const [showProfileThemePopup, setShowProfileThemePopup] = useState(false);
    const [profileThemeTier, setProfileThemeTier] = useState<'free' | 'basic' | 'ultra' | 'all'>('all');
    const [profileThemeBg, setProfileThemeBg] = useState<string>('#0d0f1a');
    const [profileThemeCard, setProfileThemeCard] = useState<string>('#1a1f35');
    const [profileThemeAccent, setProfileThemeAccent] = useState<string>('#6366f1');
    const [profileThemePermanent, setProfileThemePermanent] = useState<boolean>(true);
    const [profileThemeDurationUnit, setProfileThemeDurationUnit] = useState<'hours' | 'days' | 'months' | 'years'>('days');
    const [profileThemeDurationVal, setProfileThemeDurationVal] = useState<number>(7);
    const [profileThemeSaving, setProfileThemeSaving] = useState(false);

    /* ── USER HISTORY STATE ── */
    const [userThemeSaving, setUserThemeSaving]       = useState(false);

    /* ── ADMIN HISTORY PREVIEW STATE ── */
    const [adminHistoryPreview, setAdminHistoryPreview] = useState<ThemeHistoryEntry | null>(null);
    const [adminHistorySaving, setAdminHistorySaving]   = useState(false);

    /* ── ONE-TIME: clear old adminThemeLibrary data from Firestore ── */
    useEffect(() => {
        if (!isAdmin) return;
        const lib = (settings as any)?.adminThemeLibrary;
        if (lib && lib.length > 0) {
            const cleaned = { ...(settings || {}), adminThemeLibrary: [] };
            saveSystemSettings(cleaned as any)
                .then(() => onUpdateSettings?.(cleaned as any))
                .catch(() => {});
        }
    }, []);

    const setColor = (key: keyof ThemeState) => (v: string) =>
        setTheme(prev => ({ ...prev, [key]: v }));

    /* ── SIMPLE THEME: derive all fields from 1 color + 1 border ── */
    const applySimpleTheme = (color: string, borderColor: string) => {
        setTheme(prev => ({
            ...prev,
            topBarStart:   color,
            topBarEnd:     color,
            navActive:     color,
            btnStart:      color,
            btnEnd:        color,
            accentGlow:    color,
            progressColor: color,
            chapterAccent: color,
            mcqTabActive:  color,
            flashcardBg1:  color,
            flashcardBg2:  color,
            textPrimary:   color,
            cardBorder:    borderColor,
            navBorder:     borderColor,
        }));
    };

    /* ─────────────────────────────────────────
       APPLY THEME
    ───────────────────────────────────────── */
    const doApply = async () => {
        setSaving(true);
        setShowCoinPopup(false);

        const themeObj: UserCustomTheme = {
            id: `ptheme_${user.id}_${Date.now()}`,
            userId: user.id,
            userName: user.name,
            bgColor:       isAdmin ? theme.bgColor : '#ffffff',
            accentColor:   theme.btnStart,
            textColor:     theme.textPrimary,
            cardColor:     isAdmin ? theme.cardBg : '#f8fafc',
            topBarStart:   theme.topBarStart,
            topBarEnd:     theme.topBarEnd,
            navBg:         isAdmin ? theme.navBg : '#ffffff',
            navActive:     theme.navActive,
            navBorder:     theme.navBorder,
            cardBg:        isAdmin ? theme.cardBg : '#f8fafc',
            cardBorder:    theme.cardBorder,
            btnStart:      theme.btnStart,
            btnEnd:        theme.btnEnd,
            textSecondary: theme.textSecondary,
            accentGlow:    theme.accentGlow,
            progressColor: theme.progressColor,
            flashcardBg1:  theme.flashcardBg1,
            flashcardBg2:  theme.flashcardBg2,
            chapterAccent: theme.chapterAccent,
            mcqTabActive:  theme.mcqTabActive,
            topBarEffect:  theme.topBarEffect,
            animColor:     theme.animColor,
            animSpeed:     theme.animSpeed,
            themeName:     theme.themeName,
            themeEmoji:    theme.themeEmoji,
            createdAt:     new Date().toISOString(),
            likes:         0,
        };

        let baseUser: User;
        if (isAdmin || isFirstTime) {
            /* Admin = free always. First time user = free. */
            baseUser = { ...user };
        } else {
            /* Paid apply — deduct 200 coins */
            const deducted = applyDeduction(user, THEME_COST);
            if (!deducted) {
                /* Should not reach here (we checked before showing popup), but safety net */
                alert(`⚠️ Coins insufficient. Theme apply nahi hua.`);
                setSaving(false);
                return;
            }
            baseUser = { ...deducted };
        }

        const updated: User = {
            ...baseUser,
            personalTheme:      themeObj,
            personalThemeColor: theme.btnStart,
        };
        // If score boost event has theme studio enabled, add theme expiry
        const sbe = (settings as any)?.scoreBoostEvent;
        if (!isAdmin && sbe?.enabled && sbe?.themeStudioEnabled) {
            const days = Math.min(sbe.themeStudioDays ?? 7, 7);
            (updated as any).personalThemeExpiry = new Date(Date.now() + days * 24 * 3600000).toISOString();
        } else if (!isAdmin) {
            delete (updated as any).personalThemeExpiry;
        }
        // User explicitly set a custom theme — clear the "lock to default" flag
        delete (updated as any).useDefaultTheme;

        onUpdateUser(updated);
        try { await saveUserToLive(updated); } catch {}
        setSaving(false);

        const msg = isAdmin
            ? '✅ Theme apply ho gayi! (Admin — free)'
            : isFirstTime
                ? '✅ Pehli baar FREE mein theme apply ho gayi! 🎉\nAgle baar theme change karne pe 200 coins lagenge.'
                : `✅ Theme apply ho gayi! 200 🪙 coins kat gaye.`;
        alert(msg);
    };

    const handleApplyClick = () => {
        if (isAdmin || isFirstTime) {
            doApply();
            return;
        }
        if (totalCoins < THEME_COST) {
            alert(`❌ Coins kam hain!\nTheme change karne ke liye ${THEME_COST} coins chahiye.\nAapke paas sirf ${totalCoins} coins hain.`);
            return;
        }
        setShowCoinPopup(true);
    };

    /* ─────────────────────────────────────────
       ADMIN GLOBAL BROADCAST APPLY
    ───────────────────────────────────────── */
    const buildThemeObj = (): UserCustomTheme => ({
        id: `ptheme_${user.id}_${Date.now()}`,
        userId: user.id,
        userName: user.name,
        bgColor:       theme.bgColor,
        accentColor:   theme.btnStart,
        textColor:     theme.textPrimary,
        cardColor:     theme.cardBg,
        topBarStart:   theme.topBarStart,
        topBarEnd:     theme.topBarEnd,
        navBg:         theme.navBg,
        navActive:     theme.navActive,
        navBorder:     theme.navBorder,
        cardBg:        theme.cardBg,
        cardBorder:    theme.cardBorder,
        btnStart:      theme.btnStart,
        btnEnd:        theme.btnEnd,
        textSecondary: theme.textSecondary,
        accentGlow:    theme.accentGlow,
        progressColor: theme.progressColor,
        flashcardBg1:  theme.flashcardBg1,
        flashcardBg2:  theme.flashcardBg2,
        chapterAccent: theme.chapterAccent,
        mcqTabActive:  theme.mcqTabActive,
        topBarEffect:  theme.topBarEffect,
        animColor:     theme.animColor,
        animSpeed:     theme.animSpeed,
        themeName:     theme.themeName,
        themeEmoji:    theme.themeEmoji,
        createdAt:     new Date().toISOString(),
        likes:         0,
    });

    const doScheduleTheme = async () => {
        if (!scheduleStartDt) { alert('❌ Start date/time select karo pehle.'); return; }
        if (scheduleDurationH <= 0) { alert('❌ Duration kam se kam 1 ghanta hona chahiye.'); return; }
        setScheduleSaving(true);
        setShowSchedulePopup(false);
        const themeObj = buildThemeObj();
        const scheduledEntry: ScheduledTheme = {
            id: `sched_${Date.now()}`,
            themeId: themeObj.id || `th_${Date.now()}`,
            themeName: scheduleEventName.trim() || themeObj.themeName || `Theme Event — ${new Date(scheduleStartDt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`,
            themeEmoji: themeObj.themeEmoji || '🎨',
            themeColors: {
                bgColor:       themeObj.bgColor,
                topBarStart:   themeObj.topBarStart,
                topBarEnd:     themeObj.topBarEnd,
                navBg:         themeObj.navBg,
                navActive:     themeObj.navActive,
                navBorder:     themeObj.navBorder,
                cardBg:        themeObj.cardBg,
                cardBorder:    themeObj.cardBorder,
                btnStart:      themeObj.btnStart,
                btnEnd:        themeObj.btnEnd,
                textPrimary:   themeObj.textPrimary,
                textSecondary: themeObj.textSecondary,
                accentGlow:    themeObj.accentGlow,
                progressColor: themeObj.progressColor,
            },
            topBarEffect:     themeObj.topBarEffect,
            animColor:        themeObj.animColor,
            scheduledAt:      new Date(scheduleStartDt).toISOString(),
            durationHours:    scheduleDurationH,
            target:           scheduleTier,
            applyToProfile:   scheduleApplyProfile,
            applyToBackground: scheduleApplyBg,
            createdBy:        user.id,
            createdAt:        new Date().toISOString(),
        };
        const prevScheduled: ScheduledTheme[] = (settings as any)?.scheduledThemes || [];
        const newSettings = {
            ...(settings || {}),
            scheduledThemes: [scheduledEntry, ...prevScheduled].slice(0, 20),
        };
        try {
            await saveSystemSettings(newSettings as any);
            onUpdateSettings?.(newSettings as any);
            setScheduleEventName('');
            setScheduleStartDt('');
            setScheduleDurationH(2);
            alert(`✅ Theme event schedule ho gaya!\n📅 Shuru: ${new Date(scheduledEntry.scheduledAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}\n⏱ Duration: ${scheduleDurationH} ghante\n👥 Target: ${scheduleTier === 'ALL' ? 'Sabhi users' : scheduleTier}`);
        } catch {
            alert('❌ Kuch galat hua — dobara try karo.');
        }
        setScheduleSaving(false);
    };

    const doGlobalApplyNow = async () => {
        setGlobalNowSaving(true);
        setShowGlobalNowPopup(false);
        const themeObj = buildThemeObj();
        const expiresAt = globalNowPermanent
            ? null
            : globalNowHours > 0
                ? new Date(Date.now() + globalNowHours * 3600000).toISOString()
                : null;
        const tierVal = globalNowTier === 'ALL' ? 'all'
            : globalNowTier === 'ULTRA' ? 'ultra'
            : globalNowTier === 'BASIC' ? 'basic'
            : 'free';
        const adminAppliedTheme = {
            theme: themeObj,
            targetTier: tierVal as 'all' | 'ultra' | 'basic' | 'free',
            expiresAt: expiresAt,
            appliedAt: new Date().toISOString(),
        };
        const historyEntry: ThemeHistoryEntry = {
            id: `th_hist_${Date.now()}`,
            name: theme.themeName || `Theme ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}`,
            themeData: themeObj,
            targetTier: tierVal as 'all' | 'ultra' | 'basic' | 'free',
            appliedAt: new Date().toISOString(),
            expiresAt: expiresAt,
        };
        const prevHistory: ThemeHistoryEntry[] = (settings as any)?.themeHistory || [];
        const newSettings = {
            ...(settings || {}),
            adminAppliedTheme,
            themeHistory: [historyEntry, ...prevHistory].slice(0, 30),
        };
        try {
            await saveSystemSettings(newSettings as any);
            onUpdateSettings?.(newSettings as any);
            setLiveAdminTheme(adminAppliedTheme as any);
            alert(`✅ Theme abhi apply ho gayi!\n👥 ${globalNowTier === 'ALL' ? 'Sabhi users' : globalNowTier}\n⏱ ${globalNowPermanent ? 'Permanent' : globalNowHours + 'h ke liye'}`);
        } catch {
            alert('❌ Error — dobara try karo.');
        }
        setGlobalNowSaving(false);
    };

    /* ── ADMIN: REAPPLY FROM THEME HISTORY ── */
    const doReapplyFromHistory = async (entry: ThemeHistoryEntry) => {
        if (!confirm(`"${entry.name}" ko dubara apply karna chahte ho?\nIs baar bhi same settings rahegi (Tier: ${entry.targetTier}, Expiry: ${entry.expiresAt ? new Date(entry.expiresAt).toLocaleDateString('en-IN') : 'Permanent'})`)) return;
        setAdminHistorySaving(true);
        const newExpiresAt = entry.expiresAt
            ? new Date(Date.now() + (new Date(entry.expiresAt).getTime() - new Date(entry.appliedAt).getTime())).toISOString()
            : null;
        const adminAppliedTheme = {
            theme: entry.themeData,
            targetTier: entry.targetTier,
            expiresAt: newExpiresAt,
            appliedAt: new Date().toISOString(),
        };
        const newHistEntry: ThemeHistoryEntry = {
            id: `th_hist_${Date.now()}`,
            name: `${entry.name} (Reapplied)`,
            themeData: entry.themeData,
            targetTier: entry.targetTier,
            appliedAt: new Date().toISOString(),
            expiresAt: newExpiresAt,
        };
        const prevHist: ThemeHistoryEntry[] = (settings as any)?.themeHistory || [];
        const newSettings = {
            ...(settings || {}),
            adminAppliedTheme,
            themeHistory: [newHistEntry, ...prevHist].slice(0, 30),
        };
        try {
            await saveSystemSettings(newSettings as any);
            onUpdateSettings?.(newSettings as any);
            setLiveAdminTheme(adminAppliedTheme as any);
            setAdminHistoryPreview(null);
            alert(`✅ "${entry.name}" reapply ho gayi!`);
        } catch {
            alert('❌ Error — dobara try karo.');
        }
        setAdminHistorySaving(false);
    };

    const doDeleteHistoryEntry = async (entryId: string) => {
        if (!confirm('Is theme history entry ko hatana chahte ho?')) return;
        const prevHist: ThemeHistoryEntry[] = (settings as any)?.themeHistory || [];
        const newSettings = { ...(settings || {}), themeHistory: prevHist.filter(e => e.id !== entryId) };
        try {
            await saveSystemSettings(newSettings as any);
            onUpdateSettings?.(newSettings as any);
            if (adminHistoryPreview?.id === entryId) setAdminHistoryPreview(null);
        } catch {
            alert('❌ Error — dobara try karo.');
        }
    };

    const doApplyProfileTheme = async () => {
        setProfileThemeSaving(true);
        setShowProfileThemePopup(false);
        let expiresAt: string | null = null;
        if (!profileThemePermanent) {
            const ms = profileThemeDurationUnit === 'years' ? profileThemeDurationVal * 365 * 24 * 3600000
                : profileThemeDurationUnit === 'months' ? profileThemeDurationVal * 30 * 24 * 3600000
                : profileThemeDurationUnit === 'days'   ? profileThemeDurationVal * 24 * 3600000
                : profileThemeDurationVal * 3600000;
            expiresAt = new Date(Date.now() + ms).toISOString();
        }
        const entry = { bgColor: profileThemeBg, cardColor: profileThemeCard, accentColor: profileThemeAccent, expiresAt, appliedAt: new Date().toISOString() };
        const prev = (settings as any)?.profilePageThemes || {};
        const updated = profileThemeTier === 'all'
            ? { free: entry, basic: entry, ultra: entry }
            : { ...prev, [profileThemeTier]: entry };
        const newSettings = { ...(settings || {}), profilePageThemes: updated };
        try {
            await saveSystemSettings(newSettings as any);
            onUpdateSettings?.(newSettings as any);
            alert(`✅ Profile page theme apply ho gayi!\n👥 ${profileThemeTier === 'all' ? 'Sabhi tiers' : profileThemeTier.toUpperCase()}\n⏱ ${profileThemePermanent ? 'Permanent' : profileThemeDurationVal + ' ' + profileThemeDurationUnit}`);
        } catch {
            alert('❌ Error — dobara try karo.');
        }
        setProfileThemeSaving(false);
    };

    const doRemoveProfileTheme = async (tier: 'free' | 'basic' | 'ultra' | 'all') => {
        if (!confirm(`Profile theme hatana chahte ho? (${tier === 'all' ? 'Sabhi tiers' : tier.toUpperCase()})`)) return;
        const prev = (settings as any)?.profilePageThemes || {};
        let updated: any;
        if (tier === 'all') {
            updated = {};
        } else {
            updated = { ...prev };
            delete updated[tier];
        }
        const newSettings = { ...(settings || {}), profilePageThemes: updated };
        try {
            await saveSystemSettings(newSettings as any);
            onUpdateSettings?.(newSettings as any);
        } catch {
            alert('❌ Error — dobara try karo.');
        }
    };

    const doRemoveGlobal = async () => {
        if (!confirm('App se global theme hatana chahte ho? Sab users default pe wapas jaayenge.')) return;
        setSaving(true);
        const newSettings = { ...(settings || {}) };
        delete (newSettings as any).adminAppliedTheme;
        try {
            await saveSystemSettings(newSettings);
            onUpdateSettings?.(newSettings as any);
            setLiveAdminTheme(undefined);
            alert('✅ Global theme hata di gayi.');
        } catch {
            alert('❌ Error — dobara try karo.');
        }
        setSaving(false);
    };

    /* ── APP DEFAULT THEME (sets all 3 tiers at once) ── */
    const doSetAppDefault = async () => {
        setShowDefaultPopup(false);
        setDefaultSaving(true);
        const themeObj = buildThemeObj();
        const newSettings = {
            ...(settings || {}),
            officialFreeTheme:  themeObj,
            officialBasicTheme: themeObj,
            officialUltraTheme: themeObj,
        };
        try {
            await saveSystemSettings(newSettings);
            onUpdateSettings?.(newSettings as any);
            alert('✅ App ka default theme set ho gaya! Ab sabhi users (FREE/BASIC/ULTRA) ko yeh theme milegi jab tak unka koi custom/broadcast theme active na ho.');
        } catch {
            alert('❌ Kuch galat hua — dobara try karo.');
        }
        setDefaultSaving(false);
    };

    const doRemoveAppDefault = async () => {
        if (!confirm('App ka default theme hatana chahte ho? Sabhi users hardcoded tier theme pe wapas chale jaayenge.')) return;
        setDefaultSaving(true);
        const newSettings = { ...(settings || {}) };
        delete (newSettings as any).officialFreeTheme;
        delete (newSettings as any).officialBasicTheme;
        delete (newSettings as any).officialUltraTheme;
        try {
            await saveSystemSettings(newSettings);
            onUpdateSettings?.(newSettings as any);
            alert('✅ App default theme hata diya — ab sab hardcoded defaults pe hain.');
        } catch {
            alert('❌ Error — dobara try karo.');
        }
        setDefaultSaving(false);
    };

    /* ── ADMIN OFFICIAL TIER APPLY ── */
    const doOfficialTierApply = async () => {
        setShowOfficialPopup(false);
        setOfficialSaving(true);
        const themeObj = buildThemeObj();
        const key =
            officialTier === 'ultra' ? 'officialUltraTheme' :
            officialTier === 'basic' ? 'officialBasicTheme' :
            'officialFreeTheme';
        const newSettings = { ...(settings || {}), [key]: themeObj };
        try {
            await saveSystemSettings(newSettings);
            onUpdateSettings?.(newSettings as any);
            alert(`✅ ${officialTier.toUpperCase()} tier ka official theme set ho gaya!\nIs tier ke SARE users ko ab yeh theme milegi — chahe unka apna theme set ho ya na ho.\nHatane ke baad unki apni theme wapas aayegi.`);
        } catch {
            alert('❌ Kuch galat hua — dobara try karo.');
        }
        setOfficialSaving(false);
    };

    const doRemoveOfficialTier = async (tier: 'ultra' | 'basic' | 'free') => {
        if (!confirm(`${tier.toUpperCase()} tier ka official theme hatana chahte ho?`)) return;
        setOfficialSaving(true);
        const key =
            tier === 'ultra' ? 'officialUltraTheme' :
            tier === 'basic' ? 'officialBasicTheme' :
            'officialFreeTheme';
        const newSettings = { ...(settings || {}) };
        delete (newSettings as any)[key];
        try {
            await saveSystemSettings(newSettings);
            onUpdateSettings?.(newSettings as any);
            alert(`✅ ${tier.toUpperCase()} ka official theme hata diya — ab default theme show hoga.`);
        } catch {
            alert('❌ Error — dobara try karo.');
        }
        setOfficialSaving(false);
    };

    const handleReset = async () => {
        if (!confirm('Apni custom theme hatana chahte ho aur default pe wapas jaana chahte ho?')) return;
        setSaving(true);
        const updated: User = { ...user };
        delete (updated as any).personalTheme;
        delete (updated as any).personalThemeColor;
        delete (updated as any).useDefaultTheme;
        onUpdateUser(updated);
        try { await saveUserToLive(updated); } catch {}
        setSaving(false);
        setTheme({ ...DEFAULT_THEME });
    };





    /* ─────────────────────────────────────────
       USER: SET ACTIVE HISTORY THEME
    ───────────────────────────────────────── */
    const doSetUserActiveTheme = async (themeId: string | 'default') => {
        setUserThemeSaving(true);
        const updated = { ...user, activeAppliedThemeId: themeId } as User;
        onUpdateUser(updated);
        try { await saveUserToLive(updated); } catch {}
        setUserThemeSaving(false);
    };

    const sectionColors: Record<ColorSection, React.ReactNode> = {
        BACKGROUND: isAdmin ? (
            <ColorRow label="App Background" sub="Puri app ki main background (Admin only)" value={theme.bgColor} onChange={setColor('bgColor')} accent={theme.btnStart} />
        ) : (
            <div className="py-4 px-2 text-center">
                <div className="text-2xl mb-2">🔒</div>
                <p className="text-white/70 text-xs font-semibold">Background Locked</p>
                <p className="text-white/40 text-[10px] mt-1">White mode mein background hamesha white rahta hai. Sirf admin is setting ko change kar sakta hai.</p>
            </div>
        ),
        TOPBAR: (
            <>
                <ColorRow label="Gradient — Left Color"  sub="Top bar ka baayi taraf"  value={theme.topBarStart} onChange={setColor('topBarStart')} accent={theme.btnStart} />
                <ColorRow label="Gradient — Right Color" sub="Top bar ka seedha taraf" value={theme.topBarEnd}   onChange={setColor('topBarEnd')}   accent={theme.btnStart} />
            </>
        ),
        NAVIGATION: (
            <>
                {isAdmin && (
                    <ColorRow label="Nav Background" sub="Bottom bar ka background (Admin only)" value={theme.navBg} onChange={setColor('navBg')} accent={theme.btnStart} />
                )}
                <ColorRow label="Active Tab Color" sub="Selected tab color + underline" value={theme.navActive} onChange={setColor('navActive')} accent={theme.btnStart} />
                <ColorRow label="Nav Border"       sub="Top border line ka color"       value={theme.navBorder} onChange={setColor('navBorder')} accent={theme.btnStart} />
            </>
        ),
        CARDS: (
            <>
                {isAdmin && (
                    <ColorRow label="Card Background" sub="Cards ki background (Admin only)" value={theme.cardBg} onChange={setColor('cardBg')} accent={theme.btnStart} />
                )}
                <ColorRow label="Card Border/Accent" sub="Cards ke around border aur accent color" value={theme.cardBorder} onChange={setColor('cardBorder')} accent={theme.btnStart} />
            </>
        ),
        CHAPTERS: (
            <ColorRow label="Chapter Accent" sub="Chapter list — left bar, number aur play button ka color" value={theme.chapterAccent || theme.btnStart} onChange={setColor('chapterAccent')} accent={theme.btnStart} />
        ),
        BUTTONS: (
            <>
                <ColorRow label="Button Gradient — Start" sub="Pehla color" value={theme.btnStart} onChange={setColor('btnStart')} accent={theme.btnStart} />
                <ColorRow label="Button Gradient — End"   sub="Doosra color" value={theme.btnEnd}   onChange={setColor('btnEnd')}   accent={theme.btnStart} />
            </>
        ),
        MCQ_TABS: (
            <ColorRow label="MCQ / Q&A / Flashcard Tab" sub="Active tab button ka color (MCQ screen)" value={theme.mcqTabActive || theme.btnStart} onChange={setColor('mcqTabActive')} accent={theme.btnStart} />
        ),
        FLASHCARD: (
            <>
                <ColorRow label="Flashcard Background — Top"    sub="Gradient ka pehla color"  value={theme.flashcardBg1 || theme.topBarStart} onChange={setColor('flashcardBg1')} accent={theme.btnStart} />
                <ColorRow label="Flashcard Background — Bottom" sub="Gradient ka doosra color" value={theme.flashcardBg2 || theme.topBarEnd}   onChange={setColor('flashcardBg2')} accent={theme.btnStart} />
            </>
        ),
        TEXT: (
            <>
                <ColorRow label="Primary Text"   sub="Main headings aur important text" value={theme.textPrimary}   onChange={setColor('textPrimary')}   accent={theme.btnStart} />
                <ColorRow label="Secondary Text" sub="Descriptions aur sub-text"        value={theme.textSecondary} onChange={setColor('textSecondary')} accent={theme.btnStart} />
            </>
        ),
        ACCENTS: (
            <>
                <ColorRow label="Glow / Accent" sub="Avatar glow, level ring, highlights" value={theme.accentGlow}    onChange={setColor('accentGlow')}    accent={theme.btnStart} />
                <ColorRow label="Progress Bar"  sub="Score bars, loading bars ka color"   value={theme.progressColor} onChange={setColor('progressColor')} accent={theme.btnStart} />
            </>
        ),
    };

    return (
        <>
        <div className="min-h-screen pb-32 select-none" style={{ background: '#06080f' }}>

            {/* ══════════════════════════════════════════
                ENTRY POPUP — shown when user first opens
            ══════════════════════════════════════════ */}
            {showEntryPopup && (
                <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.80)', backdropFilter: 'blur(8px)' }}>
                    <div
                        className="w-full rounded-t-3xl overflow-hidden shadow-2xl flex flex-col"
                        style={{ background: '#0d0f1a', border: '1px solid rgba(255,255,255,0.08)', maxHeight: '88vh' }}
                    >
                        {/* Top gradient strip */}
                        <div className="h-1 w-full shrink-0" style={{ background: `linear-gradient(90deg, ${theme.btnStart}, ${theme.btnEnd})` }} />

                        {/* Header */}
                        <div className="flex items-center gap-3 px-4 pt-4 pb-2 shrink-0">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0" style={{ background: `linear-gradient(135deg,${theme.btnStart}40,${theme.btnEnd}30)`, border: `1px solid ${theme.btnStart}50` }}>🎨</div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-black text-white leading-none">Theme Studio</p>
                                <p className="text-[10px] text-white/40 mt-0.5">Preset chunno ya custom colors set karo</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="h-6 rounded-full px-2.5 flex items-center gap-1 text-[10px] font-black text-amber-400" style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.2)' }}>
                                    🪙 {isAdmin ? '∞' : totalCoins}
                                </div>
                                {isFirstTime && <div className="h-6 rounded-full px-2 flex items-center text-[9px] font-black text-green-300" style={{ background: 'rgba(34,197,94,0.15)' }}>FREE</div>}
                                <button onClick={onBack} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.08)' }}>
                                    <X size={13} className="text-white/60" />
                                </button>
                            </div>
                        </div>

                        {/* Section label */}
                        <p className="px-4 pb-2 text-[10px] font-bold text-white/30 uppercase tracking-widest shrink-0">33 Ready-made Presets</p>

                        {/* Preset grid — scrollable */}
                        <div className="overflow-y-auto flex-1 px-3 pb-2" style={{ WebkitOverflowScrolling: 'touch' }}>
                            {/* ── Default Tier Themes ── */}
                            <p className="text-[9px] font-black text-amber-400/70 uppercase tracking-widest mb-1.5 mt-0.5">App Default Themes</p>
                            <div className="grid grid-cols-3 gap-2 mb-3">
                                {PRESETS.filter(p => p.isDefault).map((p, _i) => {
                                    const i = PRESETS.indexOf(p);
                                    const sel = popupPresetIdx === i;
                                    return (
                                        <button
                                            key={p.name}
                                            onClick={() => { setPopupPresetIdx(i); setTheme({ ...p.colors }); }}
                                            className="rounded-2xl overflow-hidden active:scale-95 transition-all flex flex-col"
                                            style={{
                                                border: sel ? `2px solid ${p.colors.btnStart}` : '2px solid rgba(251,191,36,0.22)',
                                                background: '#0a0c14',
                                                boxShadow: sel ? `0 0 12px ${p.colors.btnStart}60` : '0 0 0 0',
                                            }}
                                        >
                                            <div className="h-10 w-full relative" style={{ background: `linear-gradient(135deg, ${p.colors.topBarStart}, ${p.colors.topBarEnd})` }}>
                                                <div className="absolute top-1 left-1 bg-amber-400/90 rounded px-1 py-px text-[7px] font-black text-black leading-none tracking-wide">DEFAULT</div>
                                                <div className="absolute bottom-1.5 right-1.5 flex gap-1">
                                                    <div className="w-3 h-3 rounded-full border border-white/30" style={{ background: p.colors.navActive }} />
                                                    <div className="w-3 h-3 rounded-full border border-white/30" style={{ background: p.colors.btnStart }} />
                                                </div>
                                                {sel && (
                                                    <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-white/90 flex items-center justify-center">
                                                        <Check size={9} className="text-black" strokeWidth={3} />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="px-2 py-1.5 flex items-center gap-1">
                                                <span className="text-sm leading-none">{p.emoji}</span>
                                                <p className="text-[9px] font-bold leading-tight truncate" style={{ color: sel ? p.colors.btnStart : 'rgba(251,191,36,0.80)' }}>{p.name}</p>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                            {/* ── All Other Presets ── */}
                            <p className="text-[9px] font-black text-white/30 uppercase tracking-widest mb-1.5">Custom Presets</p>
                            <div className="grid grid-cols-3 gap-2">
                                {PRESETS.filter(p => !p.isDefault).map((p, _i) => {
                                    const i = PRESETS.indexOf(p);
                                    const sel = popupPresetIdx === i;
                                    return (
                                        <button
                                            key={p.name}
                                            onClick={() => { setPopupPresetIdx(i); setTheme({ ...p.colors }); }}
                                            className="rounded-2xl overflow-hidden active:scale-95 transition-all flex flex-col"
                                            style={{
                                                border: sel ? `2px solid ${p.colors.btnStart}` : '2px solid rgba(255,255,255,0.06)',
                                                background: '#0a0c14',
                                                boxShadow: sel ? `0 0 12px ${p.colors.btnStart}60` : 'none',
                                            }}
                                        >
                                            <div className="h-10 w-full relative" style={{ background: `linear-gradient(135deg, ${p.colors.topBarStart}, ${p.colors.topBarEnd})` }}>
                                                <div className="absolute bottom-1.5 right-1.5 flex gap-1">
                                                    <div className="w-3 h-3 rounded-full border border-white/30" style={{ background: p.colors.navActive }} />
                                                    <div className="w-3 h-3 rounded-full border border-white/30" style={{ background: p.colors.btnStart }} />
                                                </div>
                                                {sel && (
                                                    <div className="absolute top-1 left-1 w-4 h-4 rounded-full bg-white/90 flex items-center justify-center">
                                                        <Check size={9} className="text-black" strokeWidth={3} />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="px-2 py-1.5 flex items-center gap-1">
                                                <span className="text-sm leading-none">{p.emoji}</span>
                                                <p className="text-[9px] font-bold leading-tight truncate" style={{ color: sel ? p.colors.btnStart : 'rgba(255,255,255,0.55)' }}>{p.name}</p>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Bottom action area */}
                        <div className="px-4 pt-2 pb-5 shrink-0 flex flex-col gap-2.5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                            {popupPresetIdx >= 0 ? (
                                <button
                                    onClick={() => {
                                        /* Apply the selected preset directly */
                                        setTheme({ ...PRESETS[popupPresetIdx].colors });
                                        setShowEntryPopup(false);
                                        /* Trigger apply flow */
                                        if (isFirstTime || isAdmin) {
                                            doApply();
                                        } else {
                                            setShowCoinPopup(true);
                                        }
                                    }}
                                    className="w-full py-3.5 rounded-2xl font-black text-sm text-white active:scale-95 transition-all"
                                    style={{ background: `linear-gradient(135deg, ${theme.btnStart}, ${theme.btnEnd})`, boxShadow: `0 6px 20px ${theme.btnStart}50` }}
                                >
                                    {isFirstTime || isAdmin ? `✅ Apply — ${PRESETS[popupPresetIdx].emoji} ${PRESETS[popupPresetIdx].name}` : `🪙 Apply (${THEME_COST} coins) — ${PRESETS[popupPresetIdx].emoji} ${PRESETS[popupPresetIdx].name}`}
                                </button>
                            ) : (
                                <button
                                    onClick={() => setShowEntryPopup(false)}
                                    className="w-full py-3.5 rounded-2xl font-black text-sm text-white active:scale-95 transition-all"
                                    style={{ background: `linear-gradient(135deg, ${theme.btnStart}, ${theme.btnEnd})`, boxShadow: `0 6px 20px ${theme.btnStart}50` }}
                                >
                                    {isFirstTime ? '🎁 Studio Kholo (Free)' : '🎨 Studio Kholo'}
                                </button>
                            )}
                            <button
                                onClick={() => setShowEntryPopup(false)}
                                className="w-full py-2 text-xs font-bold text-white/40 active:text-white/70 transition-colors"
                            >
                                Custom colors set karo →
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════
                COIN CONFIRM POPUP — before 2nd+ apply
            ══════════════════════════════════════════ */}
            {showCoinPopup && (
                <div className="fixed inset-0 z-50 flex items-center justify-center px-6" style={{ background: 'rgba(0,0,0,0.80)', backdropFilter: 'blur(6px)' }}>
                    <div
                        className="w-full max-w-xs rounded-3xl overflow-hidden shadow-2xl"
                        style={{ background: '#0d0f1a', border: '1px solid rgba(255,255,255,0.08)' }}
                    >
                        <div
                            className="h-1.5 w-full"
                            style={{ background: `linear-gradient(90deg, ${theme.btnStart}, ${theme.btnEnd})` }}
                        />
                        <div className="p-5">
                            <div className="text-center mb-4">
                                <div className="text-4xl mb-2">🪙</div>
                                <p className="text-base font-black text-white">Theme Change</p>
                                <p className="text-xs text-white/40 mt-1">Naya theme apply karne ke liye coins spend honge</p>
                            </div>

                            {/* Cost breakdown */}
                            <div
                                className="rounded-2xl p-3.5 mb-4 border"
                                style={{ background: `${theme.btnStart}12`, borderColor: `${theme.btnStart}30` }}
                            >
                                <div className="flex justify-between items-center mb-2">
                                    <p className="text-xs text-white/50">Aapke paas</p>
                                    <p className="text-sm font-black text-amber-400">🪙 {totalCoins}</p>
                                </div>
                                <div className="flex justify-between items-center mb-2">
                                    <p className="text-xs text-white/50">Theme cost</p>
                                    <p className="text-sm font-black text-red-400">− {THEME_COST} 🪙</p>
                                </div>
                                <div
                                    className="h-px my-2"
                                    style={{ background: 'rgba(255,255,255,0.08)' }}
                                />
                                <div className="flex justify-between items-center">
                                    <p className="text-xs font-black text-white/70">Apply ke baad</p>
                                    <p className="text-sm font-black" style={{ color: theme.btnStart }}>🪙 {totalCoins - THEME_COST}</p>
                                </div>
                            </div>

                            {totalCoins < THEME_COST ? (
                                <div
                                    className="flex items-center gap-2 rounded-xl p-3 mb-4"
                                    style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}
                                >
                                    <AlertCircle size={14} className="text-red-400 shrink-0" />
                                    <p className="text-[10px] text-red-300 font-bold">Coins kam hain! {THEME_COST - totalCoins} aur coins chahiye.</p>
                                </div>
                            ) : null}

                            <div className="flex gap-2">
                                <button
                                    onClick={() => setShowCoinPopup(false)}
                                    className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-2xl font-bold text-sm text-white/50 border border-white/10 active:scale-95 transition-all"
                                    style={{ background: 'rgba(255,255,255,0.04)' }}
                                >
                                    <X size={14} /> Cancel
                                </button>
                                <button
                                    onClick={doApply}
                                    disabled={saving || totalCoins < THEME_COST}
                                    className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-2xl font-black text-sm text-white active:scale-95 transition-all disabled:opacity-40"
                                    style={{
                                        background: totalCoins >= THEME_COST
                                            ? `linear-gradient(135deg, ${theme.btnStart}, ${theme.btnEnd})`
                                            : '#374151',
                                        boxShadow: totalCoins >= THEME_COST ? `0 4px 14px ${theme.btnStart}50` : 'none',
                                    }}
                                >
                                    <Sparkles size={14} />
                                    {saving ? 'Applying...' : `Apply (${THEME_COST} 🪙)`}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── HEADER ── */}
            <div
                className="sticky top-0 z-20 shadow-xl"
                style={{
                    background: `linear-gradient(135deg, ${theme.topBarStart}, ${theme.topBarEnd})`,
                    boxShadow: `0 4px 20px ${theme.accentGlow}30`,
                }}
            >
                <div className="px-4 py-3 flex items-center gap-3">
                    <button
                        onClick={onBack}
                        className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center shrink-0 active:scale-90 transition-transform"
                    >
                        <ArrowLeft size={16} className="text-white" />
                    </button>
                    <div className="flex-1">
                        <p className="text-sm font-black text-white">🎨 Theme Studio</p>
                        <p className="text-[9px] text-white/60">Har element ka alag color</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {!isAdmin && (
                            <div
                                className="h-6 rounded-full px-2.5 flex items-center gap-1 text-[9px] font-black"
                                style={{ background: 'rgba(255,255,255,0.15)', color: 'white' }}
                            >
                                🪙 {totalCoins}
                            </div>
                        )}
                        {isFirstTime && !isAdmin && (
                            <div
                                className="h-6 rounded-full px-2.5 flex items-center text-[9px] font-black text-green-300"
                                style={{ background: 'rgba(34,197,94,0.2)' }}
                            >
                                FREE 🎁
                            </div>
                        )}
                        {isAdmin && (
                            <div
                                className="h-6 rounded-full px-2.5 flex items-center text-[9px] font-black text-amber-300"
                                style={{ background: 'rgba(245,158,11,0.2)' }}
                            >
                                Admin ∞
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ══════════════════════════════════════════════════
                EDITOR VIEW — main content below
            ══════════════════════════════════════════════════ */}
            <div className="px-4 pt-4 space-y-4">

                {/* ── ACTIVE THEME STATUS ── */}
                <div
                    className="rounded-2xl p-3.5 border"
                    style={{ background: `${theme.btnStart}10`, borderColor: `${theme.btnStart}28` }}
                >
                    <div className="flex items-center gap-2 mb-2">
                        <Eye size={11} style={{ color: theme.btnStart }} />
                        <p className="text-[9px] font-black text-white/40 uppercase tracking-widest">Abhi Active Theme</p>
                    </div>
                    {!isFirstTime ? (
                        <div className="flex items-center gap-2">
                            <div
                                className="w-5 h-5 rounded-full shrink-0 border-2 border-white/20"
                                style={{ background: `linear-gradient(135deg, ${user.personalTheme?.btnStart || theme.btnStart}, ${user.personalTheme?.btnEnd || theme.btnEnd})` }}
                            />
                            <p className="text-sm font-bold text-white flex-1">Custom Theme Active ✅</p>
                            <button
                                onClick={handleReset}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black text-red-300 border border-red-500/22 active:scale-95 transition-all"
                                style={{ background: 'rgba(239,68,68,0.07)' }}
                            >
                                <RotateCcw size={9} /> Reset
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full shrink-0 border-2 border-white/15" style={{ background: '#3b82f6' }} />
                            <p className="text-sm font-bold text-white/40">Default Theme</p>
                            <span
                                className="ml-auto text-[9px] font-black px-2 py-0.5 rounded-full text-green-300"
                                style={{ background: 'rgba(34,197,94,0.15)' }}
                            >
                                🎁 Pehla theme free!
                            </span>
                        </div>
                    )}
                </div>

                {/* ═══════════════════════════════════════
                    USER: ADMIN APPLIED THEMES HISTORY
                ═══════════════════════════════════════ */}
                {!isAdmin && (() => {
                    const history: ThemeHistoryEntry[] = (settings as any)?.themeHistory || [];
                    const userTierStr = user.isPremium && (user as any).subscriptionLevel === 'ULTRA' ? 'ultra'
                        : user.isPremium && (user as any).subscriptionLevel === 'BASIC' ? 'basic' : 'free';
                    const applicable = history.filter(e => e.targetTier === 'all' || e.targetTier === userTierStr);
                    if (!applicable.length) return null;
                    const activeId = (user as any).activeAppliedThemeId as string | undefined;
                    return (
                        <div>
                            <p className="text-[9px] font-black text-white/30 uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
                                🎨 Admin Applied Themes
                            </p>
                            <div className="space-y-2">
                                {/* Default option */}
                                <button
                                    onClick={() => doSetUserActiveTheme('default')}
                                    disabled={userThemeSaving}
                                    className="w-full flex items-center gap-2.5 rounded-2xl px-3 py-2.5 transition-all active:scale-95 border text-left"
                                    style={{
                                        background: (!activeId || activeId === 'default') ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.03)',
                                        borderColor: (!activeId || activeId === 'default') ? 'rgba(59,130,246,0.40)' : 'rgba(255,255,255,0.07)',
                                    }}
                                >
                                    <div className="w-9 h-9 rounded-xl shrink-0 border-2 border-white/15" style={{ background: 'linear-gradient(135deg,#1e3a5f,#3b82f6)' }} />
                                    <div className="flex-1">
                                        <p className="text-xs font-black text-white">Default Tier Theme</p>
                                        <p className="text-[9px] text-white/30">Apne tier ka default theme</p>
                                    </div>
                                    {(!activeId || activeId === 'default') && (
                                        <span className="text-[9px] font-black px-2 py-0.5 rounded-full text-green-300 shrink-0" style={{ background: 'rgba(34,197,94,0.15)' }}>ACTIVE</span>
                                    )}
                                </button>

                                {applicable.map(entry => {
                                    const expired = !!(entry.expiresAt && new Date(entry.expiresAt) <= new Date());
                                    const isActive = activeId === entry.id;
                                    const timeLeft = (() => {
                                        if (!entry.expiresAt) return 'Permanent';
                                        const ms = new Date(entry.expiresAt).getTime() - Date.now();
                                        if (ms <= 0) return 'Expired';
                                        const d = Math.floor(ms / 86400000);
                                        const h = Math.floor((ms % 86400000) / 3600000);
                                        const m = Math.floor((ms % 3600000) / 60000);
                                        if (d > 0) return `${d}d ${h}h bachi`;
                                        if (h > 0) return `${h}h ${m}m bachi`;
                                        return `${m}m bachi`;
                                    })();
                                    return (
                                        <button
                                            key={entry.id}
                                            onClick={() => !expired && doSetUserActiveTheme(entry.id)}
                                            disabled={expired || userThemeSaving}
                                            className="w-full flex items-center gap-2.5 rounded-2xl px-3 py-2.5 transition-all active:scale-95 border disabled:opacity-40 text-left"
                                            style={{
                                                background: isActive ? `${entry.themeData.btnStart || '#3b82f6'}15` : expired ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.04)',
                                                borderColor: isActive ? `${entry.themeData.btnStart || '#3b82f6'}50` : expired ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.08)',
                                            }}
                                        >
                                            <div className="w-9 h-9 rounded-xl shrink-0 border border-white/10"
                                                style={{
                                                    background: `linear-gradient(135deg, ${entry.themeData.topBarStart || '#1e3a5f'}, ${entry.themeData.btnStart || '#3b82f6'})`,
                                                    opacity: expired ? 0.4 : 1,
                                                }} />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-black text-white truncate">{entry.name}</p>
                                                <p className="text-[9px]" style={{ color: expired ? '#ef4444' : entry.expiresAt ? '#f59e0b' : '#22c55e' }}>
                                                    {expired ? '⛔ Expire ho gayi' : entry.expiresAt ? `⏱ ${timeLeft}` : '✅ Permanent'}
                                                </p>
                                            </div>
                                            {isActive && !expired ? (
                                                <span className="text-[9px] font-black px-2 py-0.5 rounded-full text-green-300 shrink-0" style={{ background: 'rgba(34,197,94,0.15)' }}>ACTIVE</span>
                                            ) : !expired ? (
                                                <span className="text-[9px] font-black px-2 py-0.5 rounded-full text-white/40 border border-white/10 shrink-0">Use</span>
                                            ) : null}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })()}

                {/* ── LIVE PREVIEW ── */}
                <div>
                    <p className="text-[9px] font-black text-white/30 uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
                        <Eye size={10} /> Live Preview
                    </p>
                    <div
                        className="rounded-3xl overflow-hidden shadow-2xl border"
                        style={{ borderColor: `${theme.accentGlow}22` }}
                    >
                        <div className="px-4 py-3 flex items-center gap-2" style={{ background: `linear-gradient(135deg, ${theme.topBarStart}, ${theme.topBarEnd})` }}>
                            <div className="flex-1">
                                <div className="h-2 w-16 rounded-full" style={{ background: theme.textPrimary, opacity: 0.65 }} />
                                <div className="h-1.5 w-24 rounded-full mt-1" style={{ background: theme.textSecondary, opacity: 0.45 }} />
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="h-5 px-2 rounded-full text-[8px] font-black flex items-center" style={{ background: 'rgba(255,255,255,0.18)', color: theme.textPrimary }}>💠 L15</div>
                                <div className="h-5 px-2 rounded-full text-[8px] font-black flex items-center" style={{ background: 'rgba(255,255,255,0.12)', color: theme.textPrimary }}>🪙 {totalCoins}</div>
                            </div>
                        </div>
                        <div className="p-3 space-y-2.5" style={{ background: theme.bgColor }}>
                            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: `${theme.progressColor}22` }}>
                                <div className="h-full w-3/5 rounded-full" style={{ background: `linear-gradient(90deg, ${theme.progressColor}, ${theme.accentGlow})` }} />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                {[['📚', 'Notes', '24 chapters'], ['🎯', 'MCQ', '500+'], ['🎓', 'Courses', '6 subjects'], ['🏆', 'Rank', 'Top 10%']].map(([e, l, s]) => (
                                    <div key={l} className="rounded-xl p-2.5" style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}` }}>
                                        <span className="text-sm">{e}</span>
                                        <p className="text-[9px] font-black mt-1" style={{ color: theme.textPrimary }}>{l}</p>
                                        <p className="text-[8px]" style={{ color: theme.textSecondary }}>{s}</p>
                                    </div>
                                ))}
                            </div>
                            <div className="rounded-xl py-2.5 text-center" style={{ background: `linear-gradient(135deg, ${theme.btnStart}, ${theme.btnEnd})`, boxShadow: `0 4px 14px ${theme.btnStart}50` }}>
                                <span className="text-[10px] font-black text-white">⚡ Start Learning</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black text-white shrink-0"
                                    style={{ background: `linear-gradient(135deg, ${theme.btnStart}, ${theme.btnEnd})`, boxShadow: `0 0 12px ${theme.accentGlow}60` }}>
                                    {(user.name || 'U')[0].toUpperCase()}
                                </div>
                                <div>
                                    <p className="text-[10px] font-black" style={{ color: theme.textPrimary }}>{user.name || 'Student'}</p>
                                    <p className="text-[8px]" style={{ color: theme.textSecondary }}>Level 15 • 1200 XP</p>
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-4 border-t" style={{ background: theme.navBg, borderColor: theme.navBorder }}>
                            {[['🏠', 'Home', true], ['📖', 'Study', false], ['🎯', 'MCQ', false], ['👤', 'Profile', false]].map(([ic, lb, ac]) => (
                                <div key={lb as string} className="flex flex-col items-center py-2.5 gap-0.5" style={{ opacity: ac ? 1 : 0.35 }}>
                                    <span className="text-base">{ic as string}</span>
                                    <p className="text-[8px] font-bold" style={{ color: ac ? theme.navActive : theme.textSecondary }}>{lb as string}</p>
                                    <div className="h-0.5 w-4 rounded-full" style={{ background: ac ? theme.navActive : 'transparent' }} />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ── PRESET CHIPS ── */}
                <div>
                    <p className="text-[9px] font-black text-white/30 uppercase tracking-widest mb-2.5">Quick Presets</p>
                    <div className="grid grid-cols-4 gap-2">
                        {PRESETS.map(p => {
                            const isActive = theme.topBarStart === p.colors.topBarStart && theme.btnStart === p.colors.btnStart;
                            return (
                                <button
                                    key={p.name}
                                    onClick={() => setTheme({ ...p.colors })}
                                    className="flex flex-col items-center gap-1 py-2.5 px-1 rounded-2xl active:scale-90 transition-all border relative"
                                    style={{
                                        background: isActive ? `${p.colors.btnStart}22` : `${p.colors.btnStart}0d`,
                                        borderColor: isActive ? p.colors.btnStart : 'rgba(255,255,255,0.06)',
                                    }}
                                >
                                    {isActive && (
                                        <div className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center" style={{ background: p.colors.btnStart }}>
                                            <Check size={8} className="text-white" strokeWidth={3} />
                                        </div>
                                    )}
                                    <div className="w-8 h-8 rounded-full border-2 border-white/10"
                                        style={{ background: `linear-gradient(135deg, ${p.colors.topBarStart}, ${p.colors.btnEnd})` }} />
                                    <span className="text-[8px] font-black text-white/70">{p.emoji}</span>
                                    <span className="text-[7px] font-bold text-white/45 leading-tight text-center">{p.name}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* ── RESET TO DEFAULT ── */}
                <button
                    onClick={() => setTheme({ ...DEFAULT_THEME })}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold text-white/30 border border-white/6 active:scale-95 transition-all"
                    style={{ background: '#0d0f1a' }}
                >
                    <RotateCcw size={11} /> Preview Default Pe Reset Karo
                </button>

                {/* ── CUSTOM THEME BUILDER ── */}
                <div>
                    {/* Header + mode toggle */}
                    <p className="text-[9px] font-black text-white/30 uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
                        <Palette size={10} /> Custom Theme Builder
                    </p>
                    <div className="flex rounded-2xl overflow-hidden border mb-3" style={{ borderColor: 'rgba(255,255,255,0.08)', background: '#0d0f1a' }}>
                        <button
                            onClick={() => setBuilderMode('SIMPLE')}
                            className="flex-1 py-2.5 flex flex-col items-center gap-0.5 transition-all active:scale-95"
                            style={{
                                background: builderMode === 'SIMPLE' ? `${theme.btnStart}22` : 'transparent',
                                borderBottom: builderMode === 'SIMPLE' ? `2px solid ${theme.btnStart}` : '2px solid transparent',
                            }}
                        >
                            <span className="text-base">✨</span>
                            <span className="text-[10px] font-black" style={{ color: builderMode === 'SIMPLE' ? theme.btnStart : 'rgba(255,255,255,0.40)' }}>Simple</span>
                            <span className="text-[8px]" style={{ color: 'rgba(255,255,255,0.22)' }}>Ek color — sab jagah</span>
                        </button>
                        <div style={{ width: '1px', background: 'rgba(255,255,255,0.07)', alignSelf: 'stretch' }} />
                        <button
                            onClick={() => isAdmin ? setBuilderMode('ADVANCED') : undefined}
                            className="flex-1 py-2.5 flex flex-col items-center gap-0.5 transition-all active:scale-95"
                            style={{
                                background: builderMode === 'ADVANCED' ? `${theme.btnStart}22` : 'transparent',
                                borderBottom: builderMode === 'ADVANCED' ? `2px solid ${theme.btnStart}` : '2px solid transparent',
                                opacity: !isAdmin ? 0.45 : 1,
                                cursor: !isAdmin ? 'not-allowed' : 'pointer',
                            }}
                        >
                            <span className="text-base">🔧</span>
                            <span className="text-[10px] font-black" style={{ color: builderMode === 'ADVANCED' ? theme.btnStart : 'rgba(255,255,255,0.40)' }}>Advanced</span>
                            <span className="text-[8px]" style={{ color: 'rgba(255,255,255,0.22)' }}>{isAdmin ? 'Har element alag' : '🔒 Admin Only'}</span>
                        </button>
                    </div>

                    {/* ═══════════════════════════════════
                        SIMPLE MODE
                    ═══════════════════════════════════ */}
                    {builderMode === 'SIMPLE' && (
                        <div className="space-y-3">
                            {/* Color pickers */}
                            <div className="rounded-2xl p-3.5 border" style={{ background: 'rgba(255,255,255,0.025)', borderColor: 'rgba(255,255,255,0.07)' }}>
                                <p className="text-[9px] text-white/40 mb-3 leading-relaxed">
                                    Ek <strong className="text-white/65">main color</strong> chunno — top bar, buttons, nav, accents sab usi color mein ho jaayenge. Alag <strong className="text-white/65">border color</strong> bhi set kar sakte ho.
                                </p>
                                <ColorRow
                                    label="App Main Color"
                                    sub="Top bar · Buttons · Nav · Accents — puri app"
                                    value={simpleColor}
                                    onChange={v => { setSimpleColor(v); applySimpleTheme(v, simpleBorderColor); }}
                                    accent={theme.btnStart}
                                />
                                <ColorRow
                                    label="Border Color"
                                    sub="Har card aur nav border — sirf yahi alag"
                                    value={simpleBorderColor}
                                    onChange={v => { setSimpleBorderColor(v); applySimpleTheme(simpleColor, v); }}
                                    accent={theme.btnStart}
                                />
                            </div>
                            {/* Simple mode live mini-preview */}
                            <div>
                                <p className="text-[9px] font-black text-white/25 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                                    <Eye size={9} /> Preview
                                </p>
                                <div className="rounded-2xl overflow-hidden border" style={{ borderColor: `${simpleColor}40` }}>
                                    <div className="h-11 flex items-center px-3 gap-2" style={{ background: simpleColor }}>
                                        <div className="flex-1">
                                            <div className="h-2 w-16 rounded-full bg-white/35 mb-1" />
                                            <div className="h-1.5 w-10 rounded-full bg-white/20" />
                                        </div>
                                        <div className="h-6 px-2 rounded-full text-[8px] font-black flex items-center text-white bg-white/20">🪙 100</div>
                                        <div className="h-6 px-2 rounded-full text-[8px] font-black flex items-center text-white bg-white/15">💠 L10</div>
                                    </div>
                                    <div className="p-2.5" style={{ background: theme.bgColor }}>
                                        <div className="grid grid-cols-2 gap-1.5 mb-1.5">
                                            {[['📚', 'Notes', '24 chapters'], ['🎯', 'MCQ', '500+ Qs']].map(([e, l, s]) => (
                                                <div key={l} className="rounded-xl p-2.5" style={{ background: theme.cardBg, border: `1.5px solid ${simpleBorderColor}` }}>
                                                    <span className="text-sm">{e}</span>
                                                    <p className="text-[9px] font-black mt-0.5" style={{ color: simpleColor }}>{l}</p>
                                                    <p className="text-[8px] text-black/35">{s}</p>
                                                </div>
                                            ))}
                                        </div>
                                        <button className="w-full py-2.5 rounded-xl text-[10px] font-black text-white" style={{ background: simpleColor, boxShadow: `0 4px 14px ${simpleColor}55` }}>
                                            ⚡ Start Learning
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-4 border-t" style={{ background: theme.navBg, borderColor: simpleBorderColor }}>
                                        {[['🏠', 'Home', true], ['📖', 'Study', false], ['🎯', 'MCQ', false], ['👤', 'Profile', false]].map(([ic, lb, ac]) => (
                                            <div key={lb as string} className="flex flex-col items-center py-2.5 gap-0.5" style={{ opacity: ac ? 1 : 0.35 }}>
                                                <span className="text-base">{ic as string}</span>
                                                <p className="text-[8px] font-bold" style={{ color: ac ? simpleColor : theme.textSecondary }}>{lb as string}</p>
                                                <div className="h-0.5 w-4 rounded-full" style={{ background: ac ? simpleColor : 'transparent' }} />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ═══════════════════════════════════
                        ADVANCED MODE — Admin Only
                    ═══════════════════════════════════ */}
                    {builderMode === 'ADVANCED' && isAdmin && (
                    <div>
                    <div className="grid grid-cols-4 gap-1.5 mb-3">
                        {SECTIONS.map(sec => {
                            const active = activeSection === sec.id;
                            return (
                                <button
                                    key={sec.id}
                                    onClick={() => setActiveSection(sec.id)}
                                    className="flex flex-col items-center gap-1 py-2 px-1 rounded-xl text-center active:scale-90 transition-all border"
                                    style={{
                                        background: active ? `${theme.btnStart}22` : '#0d0f1a',
                                        borderColor: active ? `${theme.btnStart}55` : 'rgba(255,255,255,0.06)',
                                    }}
                                >
                                    <span style={{ color: active ? theme.btnStart : 'rgba(255,255,255,0.30)' }}>{sec.icon}</span>
                                    <span className="text-[7px] font-black leading-tight" style={{ color: active ? theme.textPrimary : 'rgba(255,255,255,0.35)' }}>
                                        {sec.label}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* ── SECTION LIVE PREVIEW ── zoomed view of the exact element being edited ── */}
                    <div className="rounded-2xl overflow-hidden mb-3 border" style={{ borderColor: `${theme.btnStart}40`, boxShadow: `0 0 0 1px ${theme.btnStart}25, 0 8px 32px ${theme.btnStart}20` }}>
                        {/* Section label strip */}
                        <div className="flex items-center gap-2 px-3 py-2" style={{ background: `${theme.btnStart}18`, borderBottom: `1px solid ${theme.btnStart}25` }}>
                            <span className="text-xs" style={{ color: theme.btnStart }}>{SECTIONS.find(s => s.id === activeSection)?.icon}</span>
                            <p className="text-[9px] font-black text-white/60 uppercase tracking-widest flex-1">Live Preview — {SECTIONS.find(s => s.id === activeSection)?.label}</p>
                            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: theme.btnStart }} />
                        </div>

                        {/* TOPBAR preview */}
                        {activeSection === 'TOPBAR' && (
                            <div className="px-4 py-4 flex items-center gap-3" style={{ background: `linear-gradient(135deg, ${theme.topBarStart}, ${theme.topBarEnd})` }}>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-black text-white shrink-0"
                                            style={{ background: `${theme.btnStart}55`, border: `1.5px solid ${theme.btnStart}80` }}>
                                            {(user.name || 'A')[0].toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="text-xs font-black leading-none" style={{ color: theme.textPrimary }}>{user.name || 'Admin'}</p>
                                            <p className="text-[9px] leading-none mt-0.5" style={{ color: theme.textSecondary, opacity: 0.7 }}>Namaste! 👋</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="h-7 px-2.5 rounded-full text-[9px] font-black flex items-center gap-1" style={{ background: 'rgba(255,255,255,0.18)', color: theme.textPrimary }}>💠 L15</div>
                                    <div className="h-7 px-2.5 rounded-full text-[9px] font-black flex items-center gap-1" style={{ background: 'rgba(255,255,255,0.14)', color: theme.textPrimary }}>🪙 {totalCoins}</div>
                                    <div className="h-7 w-7 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.12)' }}>
                                        <span className="text-sm">🔔</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* NAVIGATION preview */}
                        {activeSection === 'NAVIGATION' && (
                            <div style={{ background: theme.bgColor, padding: '8px 8px 0' }}>
                                <p className="text-[8px] text-white/20 text-center mb-1">— App Content —</p>
                                <div className="grid grid-cols-4 rounded-t-xl overflow-hidden" style={{ background: theme.navBg, borderTop: `1.5px solid ${theme.navBorder}` }}>
                                    {[['🏠', 'Home', true], ['📖', 'Study', false], ['🎯', 'MCQ', false], ['👤', 'Profile', false]].map(([ic, lb, ac]) => (
                                        <div key={lb as string} className="flex flex-col items-center py-3 gap-1" style={{ opacity: ac ? 1 : 0.45 }}>
                                            <span className="text-lg">{ic as string}</span>
                                            <p className="text-[9px] font-bold" style={{ color: ac ? theme.navActive : theme.textSecondary }}>{lb as string}</p>
                                            <div className="h-0.5 w-5 rounded-full" style={{ background: ac ? theme.navActive : 'transparent' }} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* CARDS preview */}
                        {activeSection === 'CARDS' && (
                            <div className="p-3" style={{ background: theme.bgColor }}>
                                <div className="grid grid-cols-2 gap-2">
                                    {[['📚', 'Notes', 'Class 10 · 24 chapters', '#3b82f6'], ['🎯', 'MCQ Practice', '500+ questions', '#8b5cf6'], ['🎓', 'Courses', '6 subjects avail.', '#f59e0b'], ['🏆', 'My Rank', 'Top 10% students', '#10b981']].map(([e, l, s, c]) => (
                                        <div key={l as string} className="rounded-2xl p-3 flex flex-col gap-1.5" style={{ background: theme.cardBg, border: `1.5px solid ${theme.cardBorder}` }}>
                                            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base" style={{ background: `${c}22` }}>
                                                {e as string}
                                            </div>
                                            <p className="text-[10px] font-black leading-tight" style={{ color: theme.textPrimary }}>{l as string}</p>
                                            <p className="text-[8px] leading-tight" style={{ color: theme.textSecondary }}>{s as string}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* BUTTONS preview */}
                        {activeSection === 'BUTTONS' && (
                            <div className="p-4 flex flex-col gap-3" style={{ background: theme.bgColor }}>
                                <button className="w-full py-3.5 rounded-2xl font-black text-sm text-white flex items-center justify-center gap-2"
                                    style={{ background: `linear-gradient(135deg, ${theme.btnStart}, ${theme.btnEnd})`, boxShadow: `0 6px 20px ${theme.btnStart}55` }}>
                                    <Sparkles size={15} /> Start Learning
                                </button>
                                <button className="w-full py-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2"
                                    style={{ background: `${theme.btnStart}18`, border: `1.5px solid ${theme.btnStart}40`, color: theme.btnStart }}>
                                    <Star size={13} /> View All Chapters
                                </button>
                                <div className="flex gap-2">
                                    <button className="flex-1 py-2.5 rounded-xl font-bold text-[10px] text-white flex items-center justify-center gap-1"
                                        style={{ background: `linear-gradient(135deg, ${theme.btnStart}cc, ${theme.btnEnd})` }}>
                                        ✅ Submit
                                    </button>
                                    <button className="flex-1 py-2.5 rounded-xl font-bold text-[10px] flex items-center justify-center gap-1"
                                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.5)' }}>
                                        ✕ Cancel
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* BACKGROUND preview */}
                        {activeSection === 'BACKGROUND' && (
                            <div className="p-3" style={{ background: theme.bgColor }}>
                                <div className="rounded-2xl p-3 mb-2" style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}` }}>
                                    <p className="text-xs font-black text-white/80 mb-1">App Background Color</p>
                                    <p className="text-[9px]" style={{ color: theme.textSecondary }}>Yeh color puri app ke peeche dikhta hai — home screen, notes, MCQ, har jagah.</p>
                                </div>
                                <div className="flex items-center gap-3 mt-2">
                                    <div className="w-12 h-12 rounded-2xl border-2 border-white/10 flex items-center justify-center text-xl"
                                        style={{ background: theme.bgColor, boxShadow: `0 0 0 3px ${theme.btnStart}40` }}>
                                        🎨
                                    </div>
                                    <div>
                                        <p className="text-xs font-black" style={{ color: theme.textPrimary }}>Background</p>
                                        <p className="text-[9px] font-mono" style={{ color: theme.textSecondary }}>{theme.bgColor}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TEXT preview */}
                        {activeSection === 'TEXT' && (
                            <div className="p-4 flex flex-col gap-3" style={{ background: theme.bgColor }}>
                                <div>
                                    <p className="text-base font-black leading-tight" style={{ color: theme.textPrimary }}>Rajasthan Geography</p>
                                    <p className="text-xs mt-1 leading-relaxed" style={{ color: theme.textSecondary }}>Rajasthan India ka sabse bada rajya hai. Iska total area 342,239 km² hai aur population approximately 8 crore se zyada hai.</p>
                                </div>
                                <div className="h-px" style={{ background: `${theme.textSecondary}25` }} />
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white"
                                        style={{ background: `linear-gradient(135deg, ${theme.btnStart}, ${theme.btnEnd})` }}>A</div>
                                    <div>
                                        <p className="text-[11px] font-bold leading-none" style={{ color: theme.textPrimary }}>Primary Text</p>
                                        <p className="text-[9px] leading-none mt-0.5" style={{ color: theme.textSecondary }}>Secondary / subtitle text</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ACCENTS preview */}
                        {activeSection === 'ACCENTS' && (
                            <div className="p-4 flex flex-col gap-4" style={{ background: theme.bgColor }}>
                                <div>
                                    <div className="flex justify-between mb-1.5">
                                        <p className="text-[9px] font-black" style={{ color: theme.textPrimary }}>Daily Progress</p>
                                        <p className="text-[9px] font-bold" style={{ color: theme.progressColor }}>72%</p>
                                    </div>
                                    <div className="h-2.5 rounded-full overflow-hidden" style={{ background: `${theme.progressColor}20` }}>
                                        <div className="h-full rounded-full w-[72%] transition-all" style={{ background: `linear-gradient(90deg, ${theme.progressColor}, ${theme.accentGlow})` }} />
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="relative">
                                        <div className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-black text-white"
                                            style={{ background: `linear-gradient(135deg, ${theme.btnStart}, ${theme.btnEnd})`, boxShadow: `0 0 0 3px ${theme.accentGlow}50, 0 0 20px ${theme.accentGlow}40` }}>
                                            {(user.name || 'A')[0].toUpperCase()}
                                        </div>
                                        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-black text-white border-2 border-black"
                                            style={{ background: theme.accentGlow }}>15</div>
                                    </div>
                                    <div>
                                        <p className="text-sm font-black" style={{ color: theme.textPrimary }}>{user.name || 'Admin'}</p>
                                        <p className="text-[9px]" style={{ color: theme.textSecondary }}>Level 15 · 1,250 XP</p>
                                        <div className="flex items-center gap-1 mt-1">
                                            <div className="h-1.5 rounded-full w-20" style={{ background: `${theme.progressColor}22` }}>
                                                <div className="h-full rounded-full w-[60%]" style={{ background: theme.progressColor }} />
                                            </div>
                                            <p className="text-[8px]" style={{ color: theme.progressColor }}>750/1250</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="rounded-2xl p-4 border" style={{ background: '#0d0f1a', borderColor: `${theme.btnStart}18` }}>
                        <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-white/5">
                            <span style={{ color: theme.btnStart }}>{SECTIONS.find(s => s.id === activeSection)?.icon}</span>
                            <div>
                                <p className="text-xs font-black text-white">{SECTIONS.find(s => s.id === activeSection)?.label}</p>
                                <p className="text-[9px] text-white/30">{SECTIONS.find(s => s.id === activeSection)?.desc}</p>
                            </div>
                        </div>
                        {sectionColors[activeSection]}
                    </div>
                    </div>
                    )}

                </div>

                {/* ── APPLY BUTTONS ── */}
                <div className="flex gap-2.5 pt-1">
                    {!isFirstTime && (
                        <button
                            onClick={handleReset}
                            disabled={saving}
                            className="flex items-center gap-1.5 px-4 py-3.5 rounded-2xl font-bold text-xs text-red-300 border border-red-500/20 active:scale-95 transition-all shrink-0"
                            style={{ background: 'rgba(239,68,68,0.07)' }}
                        >
                            <RotateCcw size={12} /> Default
                        </button>
                    )}
                    <button
                        onClick={handleApplyClick}
                        disabled={saving}
                        className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-black text-sm text-white active:scale-95 transition-all disabled:opacity-60"
                        style={{
                            background: `linear-gradient(135deg, ${theme.btnStart}, ${theme.btnEnd})`,
                            boxShadow: `0 6px 24px ${theme.btnStart}55`,
                        }}
                    >
                        <Sparkles size={16} />
                        {saving ? 'Saving...' : 'Apni Profile Pe Apply'}
                    </button>
                </div>

                {/* ── ADMIN GLOBAL APPLY NOW BUTTON ── */}
                {isAdmin && (
                    <div className="flex gap-2 pt-1">
                        <button
                            onClick={() => setShowGlobalNowPopup(true)}
                            disabled={globalNowSaving}
                            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-black text-sm text-white active:scale-95 transition-all disabled:opacity-60 border"
                            style={{
                                background: `linear-gradient(135deg,${theme.btnStart}28,${theme.btnEnd}28)`,
                                borderColor: `${theme.btnStart}55`,
                            }}
                        >
                            <span>🌐</span>
                            <span style={{ color: theme.navActive }}>Abhi Apply Karo (Tier + Time)</span>
                        </button>
                    </div>
                )}

                {/* ── ADMIN THEME SCHEDULE BUTTON ── */}
                {isAdmin && (
                    <div className="flex gap-2 pt-1">
                        <button
                            onClick={() => {
                                const now = new Date();
                                now.setMinutes(now.getMinutes() + 30);
                                const pad = (n: number) => String(n).padStart(2, '0');
                                setScheduleStartDt(`${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`);
                                setShowSchedulePopup(true);
                            }}
                            disabled={scheduleSaving}
                            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-black text-sm text-white active:scale-95 transition-all disabled:opacity-60 border"
                            style={{
                                background: 'rgba(99,102,241,0.15)',
                                borderColor: 'rgba(99,102,241,0.35)',
                            }}
                        >
                            <span className="text-base">📅</span>
                            <span className="text-indigo-300">Theme Event Schedule Karo</span>
                        </button>
                    </div>
                )}
                {isAdmin && liveAdminTheme && (
                    <div className="rounded-xl px-3 py-2 flex items-center gap-2" style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
                        <Globe size={11} className="text-indigo-400 shrink-0" />
                        <p className="text-[10px] text-indigo-300 flex-1">
                            Global theme active — {liveAdminTheme.targetTier === 'all' ? 'Sabhi users' : liveAdminTheme.targetTier.toUpperCase()}
                            {liveAdminTheme.expiresAt ? ` · expires ${new Date(liveAdminTheme.expiresAt).toLocaleDateString('en-IN')}` : ' · Permanent'}
                        </p>
                    </div>
                )}

                {/* ═══════════════════════════════════════
                    ADMIN: THEME HISTORY
                ═══════════════════════════════════════ */}
                {isAdmin && (() => {
                    const history: ThemeHistoryEntry[] = (settings as any)?.themeHistory || [];
                    if (!history.length) return null;
                    return (
                        <div>
                            <p className="text-[9px] font-black text-white/30 uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
                                🕐 Theme History ({history.length})
                            </p>
                            <div className="space-y-1.5">
                                {history.map(entry => {
                                    const isExpired = !!(entry.expiresAt && new Date(entry.expiresAt) <= new Date());
                                    const timeStr = (() => {
                                        if (!entry.expiresAt) return 'Permanent';
                                        if (isExpired) return 'Expired';
                                        const ms = new Date(entry.expiresAt).getTime() - Date.now();
                                        const d = Math.floor(ms / 86400000);
                                        const h = Math.floor((ms % 86400000) / 3600000);
                                        if (d > 0) return `${d}d ${h}h bachi`;
                                        return `${h}h bachi`;
                                    })();
                                    const isPreviewing = adminHistoryPreview?.id === entry.id;
                                    return (
                                        <div key={entry.id}>
                                            <button
                                                onClick={() => setAdminHistoryPreview(isPreviewing ? null : entry)}
                                                className="w-full flex items-center gap-2.5 rounded-2xl px-3 py-2.5 transition-all active:scale-95 border text-left"
                                                style={{
                                                    background: isPreviewing ? `${entry.themeData.btnStart || '#6366f1'}18` : 'rgba(255,255,255,0.04)',
                                                    borderColor: isPreviewing ? `${entry.themeData.btnStart || '#6366f1'}45` : 'rgba(255,255,255,0.08)',
                                                }}
                                            >
                                                <div className="w-9 h-9 rounded-xl shrink-0 border border-white/10 flex-shrink-0"
                                                    style={{ background: `linear-gradient(135deg, ${entry.themeData.topBarStart || '#1e3a5f'}, ${entry.themeData.btnStart || '#6366f1'})` }} />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-black text-white truncate">{entry.name}</p>
                                                    <p className="text-[9px] text-white/40">
                                                        {entry.targetTier.toUpperCase()} · {new Date(entry.appliedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · <span style={{ color: isExpired ? '#ef4444' : '#22c55e' }}>{timeStr}</span>
                                                    </p>
                                                </div>
                                                <span className="text-[9px] font-bold text-white/30 shrink-0">{isPreviewing ? '▲' : '▼'}</span>
                                            </button>
                                            {isPreviewing && (
                                                <div className="mx-2 mt-1 rounded-2xl overflow-hidden border" style={{ borderColor: `${entry.themeData.btnStart || '#6366f1'}30` }}>
                                                    {/* Mini Preview */}
                                                    <div className="px-3 py-2 flex items-center gap-2"
                                                        style={{ background: `linear-gradient(135deg, ${entry.themeData.topBarStart || '#1e3a5f'}, ${entry.themeData.topBarEnd || entry.themeData.btnStart || '#3b82f6'})` }}>
                                                        <div className="flex-1">
                                                            <div className="h-1.5 w-12 rounded-full bg-white/50" />
                                                            <div className="h-1 w-16 rounded-full mt-1 bg-white/30" />
                                                        </div>
                                                        <div className="h-4 px-2 rounded-full text-[7px] font-black flex items-center bg-white/20 text-white">PREVIEW</div>
                                                    </div>
                                                    <div className="p-2.5 grid grid-cols-2 gap-1.5"
                                                        style={{ background: entry.themeData.bgColor || '#0d0f1a' }}>
                                                        {[['📚', 'Notes'], ['🎯', 'MCQ'], ['🎓', 'Learn'], ['🏆', 'Rank']].map(([e, l]) => (
                                                            <div key={l} className="rounded-lg p-2"
                                                                style={{ background: entry.themeData.cardBg || '#1a1f35', border: `1px solid ${entry.themeData.cardBorder || '#ffffff15'}` }}>
                                                                <span className="text-xs">{e}</span>
                                                                <p className="text-[8px] font-black mt-0.5" style={{ color: entry.themeData.textColor || '#ffffff' }}>{l}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <div className="px-2.5 pb-2.5 flex gap-2"
                                                        style={{ background: entry.themeData.bgColor || '#0d0f1a' }}>
                                                        <button
                                                            onClick={() => doReapplyFromHistory(entry)}
                                                            disabled={adminHistorySaving}
                                                            className="flex-1 py-2 rounded-xl text-[10px] font-black text-white transition-all active:scale-95 disabled:opacity-50"
                                                            style={{ background: `linear-gradient(135deg, ${entry.themeData.btnStart || '#6366f1'}, ${entry.themeData.btnEnd || entry.themeData.btnStart || '#8b5cf6'})` }}
                                                        >
                                                            🔄 Reapply
                                                        </button>
                                                        <button
                                                            onClick={() => doDeleteHistoryEntry(entry.id)}
                                                            className="px-3 py-2 rounded-xl text-[10px] font-black text-red-400 transition-all active:scale-95"
                                                            style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}
                                                        >
                                                            ✕ Hata
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })()}

                {/* ── ADMIN DEFAULT + OFFICIAL TIER THEME BUTTONS ── */}
                {isAdmin && (
                    <div className="flex flex-col gap-2 pt-1">
                        {/* App Default Theme — sets ALL tiers at once */}
                        <button
                            onClick={() => setShowDefaultPopup(true)}
                            disabled={defaultSaving}
                            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-black text-sm text-white active:scale-95 transition-all disabled:opacity-60 border"
                            style={{
                                background: `linear-gradient(135deg,${theme.btnStart}22,${theme.btnEnd}22)`,
                                borderColor: `${theme.btnStart}50`,
                            }}
                        >
                            <Home size={15} style={{ color: theme.btnStart }} />
                            <span style={{ color: theme.btnStart }}>App Ka Default Theme Badlo</span>
                        </button>
                        {/* Default theme active indicator */}
                        {(() => {
                            const allSet = !!(settings as any)?.officialFreeTheme && !!(settings as any)?.officialBasicTheme && !!(settings as any)?.officialUltraTheme;
                            const anySet = !!(settings as any)?.officialFreeTheme || !!(settings as any)?.officialBasicTheme || !!(settings as any)?.officialUltraTheme;
                            if (!anySet) return null;
                            return (
                                <div className="rounded-xl px-3 py-2 flex items-center gap-2" style={{ background: `${theme.btnStart}12`, border: `1px solid ${theme.btnStart}30` }}>
                                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: theme.btnStart }} />
                                    <p className="text-[10px] flex-1" style={{ color: theme.btnStart }}>
                                        {allSet ? 'Custom default theme active (sabhi tiers)' : 'Kuch tiers ka custom default active'}
                                    </p>
                                    <button
                                        onClick={doRemoveAppDefault}
                                        className="text-[9px] font-bold text-red-400 shrink-0"
                                    >Hatao ✕</button>
                                </div>
                            );
                        })()}
                        {/* Per-tier override button */}
                        <button
                            onClick={() => setShowOfficialPopup(true)}
                            disabled={officialSaving}
                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl font-black text-xs text-white active:scale-95 transition-all disabled:opacity-60 border"
                            style={{
                                background: 'rgba(16,185,129,0.10)',
                                borderColor: 'rgba(16,185,129,0.25)',
                            }}
                        >
                            <CheckCircle size={13} className="text-emerald-400" />
                            <span className="text-emerald-400">Alag Tier Ka Theme Override Karo</span>
                        </button>
                        {/* Status badges for each tier */}
                        <div className="grid grid-cols-3 gap-1.5">
                            {(['ultra','basic','free'] as const).map(t => {
                                const key = t === 'ultra' ? 'officialUltraTheme' : t === 'basic' ? 'officialBasicTheme' : 'officialFreeTheme';
                                const active = !!(settings as any)?.[key];
                                const colors = { ultra: '#1e3a8a', basic: '#2563eb', free: '#0ea5e9' };
                                return (
                                    <div key={t} className="rounded-xl px-2 py-1.5 flex items-center gap-1.5" style={{ background: active ? `${colors[t]}18` : 'rgba(255,255,255,0.04)', border: `1px solid ${active ? colors[t] + '40' : 'rgba(255,255,255,0.08)'}` }}>
                                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: active ? colors[t] : 'rgba(255,255,255,0.15)' }} />
                                        <p className="text-[9px] font-bold flex-1" style={{ color: active ? '#fff' : 'rgba(255,255,255,0.3)' }}>{t.toUpperCase()}</p>
                                        {active && (
                                            <button onClick={() => doRemoveOfficialTier(t)} className="text-[8px] text-red-400 font-bold hover:text-red-300" title="Remove">✕</button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Profile Page Theme Button */}
                        <button
                            onClick={() => setShowProfileThemePopup(true)}
                            disabled={profileThemeSaving}
                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl font-black text-xs text-white active:scale-95 transition-all disabled:opacity-60 border"
                            style={{ background: 'rgba(236,72,153,0.10)', borderColor: 'rgba(236,72,153,0.25)' }}
                        >
                            <span>🎨</span>
                            <span className="text-pink-400">Profile Page Ka Alag Theme Set Karo</span>
                        </button>
                        {/* Profile theme status badges */}
                        {(() => {
                            const pt = (settings as any)?.profilePageThemes || {};
                            const tiers = ['free','basic','ultra'] as const;
                            const any = tiers.some(t => !!pt[t]);
                            if (!any) return null;
                            return (
                                <div className="grid grid-cols-3 gap-1.5">
                                    {tiers.map(t => {
                                        const e = pt[t];
                                        const active = !!e && (!e.expiresAt || new Date(e.expiresAt) > new Date());
                                        const colors = { ultra: '#7c3aed', basic: '#2563eb', free: '#0ea5e9' };
                                        return (
                                            <div key={t} className="rounded-xl px-2 py-1.5 flex items-center gap-1.5" style={{ background: active ? `${colors[t]}18` : 'rgba(255,255,255,0.04)', border: `1px solid ${active ? colors[t] + '40' : 'rgba(255,255,255,0.08)'}` }}>
                                                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: active ? e?.accentColor || colors[t] : 'rgba(255,255,255,0.15)' }} />
                                                <p className="text-[9px] font-bold flex-1" style={{ color: active ? '#fff' : 'rgba(255,255,255,0.3)' }}>P-{t.toUpperCase()}</p>
                                                {active && <button onClick={() => doRemoveProfileTheme(t)} className="text-[8px] text-red-400 font-bold">✕</button>}
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })()}
                    </div>
                )}

                <p className="text-[8px] text-white/20 text-center pb-4">
                    {isAdmin
                        ? 'Admin ko coins nahi lagte · Global Apply se puri app ke users ka theme badlega'
                        : isFirstTime
                            ? `✨ Pehla theme free! Iske baad ${THEME_COST} coins lagenge`
                            : 'Ye theme permanently rahegi jab tak tum khud reset nahi karte'}
                </p>
            </div>
        </div>

        {/* ══════════════════════════════════════════════════
            ADMIN GLOBAL APPLY NOW POPUP
        ══════════════════════════════════════════════════ */}
        {showGlobalNowPopup && (
            <div className="fixed inset-0 z-[300] flex items-end justify-center pb-6 px-4" style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(6px)' }}>
                <div className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl" style={{ background: '#0d0f1a', border: `1px solid ${theme.btnStart}50` }}>
                    {/* Header */}
                    <div className="px-5 py-4 flex items-center gap-3" style={{ background: `linear-gradient(135deg,${theme.btnStart}30,${theme.btnEnd}20)`, borderBottom: `1px solid ${theme.btnStart}30` }}>
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl" style={{ background: `${theme.btnStart}25` }}>🌐</div>
                        <div className="flex-1">
                            <p className="text-white font-black text-sm">Abhi Apply Karo</p>
                            <p className="text-[10px]" style={{ color: `${theme.navActive}99` }}>Selected tier ke users ka theme turant badlega</p>
                        </div>
                        <button onClick={() => setShowGlobalNowPopup(false)} className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
                            <X size={13} className="text-white/70" />
                        </button>
                    </div>
                    <div className="p-5 pb-8 flex flex-col gap-4 overflow-y-auto max-h-[72vh]">
                        {/* Tier selection */}
                        <div>
                            <p className="text-white/60 text-xs font-bold mb-2">👥 Kis Ko Apply Karo?</p>
                            <div className="grid grid-cols-4 gap-1.5">
                                {(['ALL','ULTRA','BASIC','FREE'] as const).map((tier) => {
                                    const colors: Record<string, string> = { ALL: '#6366f1', ULTRA: '#1e3a8a', BASIC: '#2563eb', FREE: '#0ea5e9' };
                                    const emojis: Record<string, string> = { ALL: '🌐', ULTRA: '💎', BASIC: '⭐', FREE: '🎓' };
                                    const sel = globalNowTier === tier;
                                    return (
                                        <button key={tier} onClick={() => setGlobalNowTier(tier)}
                                            className="py-2.5 rounded-2xl flex flex-col items-center gap-0.5 text-[10px] font-black transition-all active:scale-95"
                                            style={{
                                                background: sel ? `${colors[tier]}30` : 'rgba(255,255,255,0.05)',
                                                border: `2px solid ${sel ? colors[tier] + '80' : 'transparent'}`,
                                                color: sel ? '#fff' : 'rgba(255,255,255,0.35)',
                                            }}
                                        >
                                            <span className="text-base">{emojis[tier]}</span>
                                            {tier === 'ALL' ? 'Sabhi' : tier}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        {/* Duration */}
                        <div>
                            <p className="text-white/60 text-xs font-bold mb-2">⏱ Kitne Time Ke Liye?</p>
                            {/* Permanent toggle */}
                            <button
                                onClick={() => setGlobalNowPermanent(p => !p)}
                                className="w-full py-2.5 rounded-xl font-black text-[11px] mb-2 transition-all active:scale-95 flex items-center justify-center gap-2"
                                style={{
                                    background: globalNowPermanent ? 'linear-gradient(135deg,#7c3aed,#6366f1)' : 'rgba(255,255,255,0.06)',
                                    border: `1.5px solid ${globalNowPermanent ? '#7c3aed' : 'transparent'}`,
                                    color: globalNowPermanent ? '#fff' : 'rgba(255,255,255,0.5)',
                                }}
                            >
                                <span>♾️</span> {globalNowPermanent ? 'Permanent ✓ — Koi expiry nahi' : 'Permanent Karo'}
                            </button>
                            {!globalNowPermanent && (
                                <>
                                    <div className="grid grid-cols-5 gap-1.5 mb-2">
                                        {[1, 6, 12, 24, 48].map(h => (
                                            <button key={h} onClick={() => setGlobalNowHours(h)}
                                                className="py-2 rounded-xl text-[10px] font-bold transition-all active:scale-95"
                                                style={{
                                                    background: globalNowHours === h ? `linear-gradient(135deg,${theme.btnStart},${theme.btnEnd})` : 'rgba(255,255,255,0.06)',
                                                    color: globalNowHours === h ? '#fff' : 'rgba(255,255,255,0.5)',
                                                    border: `1px solid ${globalNowHours === h ? theme.btnStart + '80' : 'transparent'}`,
                                                }}
                                            >{h}h</button>
                                        ))}
                                    </div>
                                    <div className="flex items-center gap-2 rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                                        <button className="w-10 h-9 flex items-center justify-center text-white/50 text-lg font-bold active:scale-90" onClick={() => setGlobalNowHours(h => Math.max(1, h - 1))}>−</button>
                                        <input type="number" min={1} value={globalNowHours}
                                            onChange={e => setGlobalNowHours(Math.max(1, parseInt(e.target.value) || 1))}
                                            className="flex-1 text-center text-sm font-black text-white outline-none bg-transparent py-2"
                                        />
                                        <span className="text-white/40 text-xs pr-2">ghante</span>
                                        <button className="w-10 h-9 flex items-center justify-center text-white/50 text-lg font-bold active:scale-90" onClick={() => setGlobalNowHours(h => h + 1)}>+</button>
                                    </div>
                                </>
                            )}
                        </div>
                        {/* Summary */}
                        <div className="rounded-2xl p-3" style={{ background: `${theme.btnStart}12`, border: `1px solid ${theme.btnStart}25` }}>
                            <p className="text-[10px] text-white/50 font-bold uppercase tracking-wide mb-1">Summary</p>
                            <p className="text-xs text-white font-bold">
                                👥 {globalNowTier === 'ALL' ? 'Sabhi users' : globalNowTier} · ⏱ {globalNowPermanent ? 'Permanent (koi expiry nahi)' : `${globalNowHours}h ke liye`}
                            </p>
                            {!globalNowPermanent && (
                                <p className="text-[10px] text-white/40 mt-0.5">
                                    Expires: {new Date(Date.now() + globalNowHours * 3600000).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                                </p>
                            )}
                        </div>
                        {/* Buttons */}
                        <div className="flex gap-2">
                            <button onClick={() => setShowGlobalNowPopup(false)}
                                className="flex-1 py-3 rounded-2xl font-bold text-sm text-white/40 border border-white/10 active:scale-95 transition-all"
                                style={{ background: 'rgba(255,255,255,0.04)' }}
                            >Cancel</button>
                            <button onClick={doGlobalApplyNow} disabled={globalNowSaving}
                                className="flex-1 py-3 rounded-2xl font-black text-sm text-white active:scale-95 transition-all disabled:opacity-40"
                                style={{ background: `linear-gradient(135deg,${theme.btnStart},${theme.btnEnd})`, boxShadow: `0 4px 16px ${theme.btnStart}40` }}
                            >
                                {globalNowSaving ? 'Applying...' : '🌐 Abhi Apply Karo'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* ══════════════════════════════════════════════════
            ADMIN PROFILE PAGE THEME POPUP
        ══════════════════════════════════════════════════ */}
        {showProfileThemePopup && (
            <div className="fixed inset-0 z-[300] flex items-end justify-center pb-6 px-4" style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(6px)' }}>
                <div className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl" style={{ background: '#0d0f1a', border: '1px solid rgba(236,72,153,0.40)' }}>
                    <div className="px-5 py-4 flex items-center gap-3" style={{ background: 'linear-gradient(135deg,rgba(236,72,153,0.25),rgba(168,85,247,0.15))', borderBottom: '1px solid rgba(236,72,153,0.25)' }}>
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl" style={{ background: 'rgba(236,72,153,0.20)' }}>🎨</div>
                        <div className="flex-1">
                            <p className="text-white font-black text-sm">Profile Page Theme</p>
                            <p className="text-[10px] text-pink-300/70">Alag tier ke liye alag profile colors</p>
                        </div>
                        <button onClick={() => setShowProfileThemePopup(false)} className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center"><X size={13} className="text-white/70" /></button>
                    </div>
                    <div className="p-5 pb-8 flex flex-col gap-4 overflow-y-auto max-h-[78vh]">
                        {/* Tier */}
                        <div>
                            <p className="text-white/60 text-xs font-bold mb-2">👥 Kis Tier Ke Liye?</p>
                            <div className="grid grid-cols-4 gap-1.5">
                                {(['all','ultra','basic','free'] as const).map(t => {
                                    const cols: Record<string,string> = { all:'#ec4899', ultra:'#7c3aed', basic:'#2563eb', free:'#0ea5e9' };
                                    const emojis: Record<string,string> = { all:'🌐', ultra:'💎', basic:'⭐', free:'🎓' };
                                    const sel = profileThemeTier === t;
                                    return (
                                        <button key={t} onClick={() => setProfileThemeTier(t)}
                                            className="py-2.5 rounded-2xl flex flex-col items-center gap-0.5 text-[10px] font-black transition-all active:scale-95"
                                            style={{ background: sel ? `${cols[t]}30` : 'rgba(255,255,255,0.05)', border: `2px solid ${sel ? cols[t]+'80' : 'transparent'}`, color: sel ? '#fff' : 'rgba(255,255,255,0.35)' }}>
                                            <span className="text-base">{emojis[t]}</span>
                                            {t === 'all' ? 'Sabhi' : t.toUpperCase()}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        {/* Color Pickers */}
                        <div>
                            <p className="text-white/60 text-xs font-bold mb-2">🎨 Colors</p>
                            <div className="flex flex-col gap-2">
                                {[
                                    { label: 'Profile Background', key: 'bg' as const, val: profileThemeBg, set: setProfileThemeBg },
                                    { label: 'Card Background', key: 'card' as const, val: profileThemeCard, set: setProfileThemeCard },
                                    { label: 'Accent Color', key: 'accent' as const, val: profileThemeAccent, set: setProfileThemeAccent },
                                ].map(({ label, val, set }) => (
                                    <div key={label} className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                                        <div className="w-8 h-8 rounded-lg overflow-hidden border border-white/20 shrink-0">
                                            <input type="color" value={val} onChange={e => set(e.target.value)} className="w-12 h-12 -m-2 cursor-pointer border-none outline-none bg-transparent" style={{ appearance: 'none' }} />
                                        </div>
                                        <p className="text-[11px] font-bold text-white/70 flex-1">{label}</p>
                                        <span className="text-[10px] font-mono text-white/40">{val.toUpperCase()}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        {/* Duration */}
                        <div>
                            <p className="text-white/60 text-xs font-bold mb-2">⏱ Kitne Time Ke Liye?</p>
                            <button
                                onClick={() => setProfileThemePermanent(p => !p)}
                                className="w-full py-2.5 rounded-xl font-black text-[11px] mb-2 flex items-center justify-center gap-2 transition-all active:scale-95"
                                style={{ background: profileThemePermanent ? 'linear-gradient(135deg,#7c3aed,#ec4899)' : 'rgba(255,255,255,0.06)', border: `1.5px solid ${profileThemePermanent ? '#7c3aed' : 'transparent'}`, color: profileThemePermanent ? '#fff' : 'rgba(255,255,255,0.5)' }}
                            >♾️ {profileThemePermanent ? 'Permanent ✓' : 'Permanent Karo'}</button>
                            {!profileThemePermanent && (
                                <div className="flex gap-2">
                                    <div className="flex items-center gap-1.5 rounded-xl overflow-hidden flex-1" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}>
                                        <button className="w-9 h-9 flex items-center justify-center text-white/50 font-bold" onClick={() => setProfileThemeDurationVal(v => Math.max(1, v-1))}>−</button>
                                        <input type="number" min={1} value={profileThemeDurationVal} onChange={e => setProfileThemeDurationVal(Math.max(1, parseInt(e.target.value)||1))} className="flex-1 text-center text-sm font-black text-white outline-none bg-transparent py-2" />
                                        <button className="w-9 h-9 flex items-center justify-center text-white/50 font-bold" onClick={() => setProfileThemeDurationVal(v => v+1)}>+</button>
                                    </div>
                                    <div className="grid grid-cols-4 gap-1">
                                        {(['hours','days','months','years'] as const).map(u => (
                                            <button key={u} onClick={() => setProfileThemeDurationUnit(u)}
                                                className="py-1.5 rounded-lg text-[9px] font-black transition-all active:scale-95"
                                                style={{ background: profileThemeDurationUnit === u ? '#ec4899' : 'rgba(255,255,255,0.06)', color: profileThemeDurationUnit === u ? '#fff' : 'rgba(255,255,255,0.4)' }}>
                                                {u === 'hours' ? 'Hrs' : u === 'days' ? 'Days' : u === 'months' ? 'Mon' : 'Yrs'}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        {/* Preview */}
                        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.10)' }}>
                            <div className="px-4 py-3 flex items-center gap-3" style={{ background: profileThemeBg }}>
                                <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-white" style={{ background: profileThemeAccent }}>A</div>
                                <div>
                                    <p className="text-[12px] font-black" style={{ color: profileThemeAccent }}>Profile Preview</p>
                                    <p className="text-[10px]" style={{ color: profileThemeAccent + '80' }}>Bg + Accent preview</p>
                                </div>
                            </div>
                            <div className="p-3" style={{ background: profileThemeCard }}>
                                <div className="h-6 rounded-lg w-3/4" style={{ background: profileThemeAccent + '30' }} />
                            </div>
                        </div>
                        {/* Buttons */}
                        <div className="flex gap-2">
                            <button onClick={() => setShowProfileThemePopup(false)} className="flex-1 py-3 rounded-2xl font-bold text-sm text-white/40 border border-white/10 active:scale-95" style={{ background: 'rgba(255,255,255,0.04)' }}>Cancel</button>
                            <button onClick={doApplyProfileTheme} disabled={profileThemeSaving} className="flex-1 py-3 rounded-2xl font-black text-sm text-white active:scale-95 disabled:opacity-40" style={{ background: 'linear-gradient(135deg,#ec4899,#a855f7)', boxShadow: '0 4px 16px rgba(236,72,153,0.40)' }}>
                                {profileThemeSaving ? 'Applying...' : '🎨 Apply Karo'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* ══════════════════════════════════════════════════
            ADMIN OFFICIAL TIER APPLY POPUP
        ══════════════════════════════════════════════════ */}
        {showOfficialPopup && (
            <div className="fixed inset-0 z-[300] flex items-end justify-center pb-6 px-4" style={{ background: 'rgba(0,0,0,0.80)', backdropFilter: 'blur(6px)' }}>
                <div className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl" style={{ background: '#0d1209', border: '1px solid rgba(16,185,129,0.30)' }}>
                    <div className="px-5 py-4 flex items-center gap-3" style={{ background: 'linear-gradient(135deg,#064e3b,#022c22)', borderBottom: '1px solid rgba(16,185,129,0.2)' }}>
                        <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                            <CheckCircle size={18} className="text-emerald-300" />
                        </div>
                        <div className="flex-1">
                            <p className="text-white font-black text-sm">Official Tier Theme</p>
                            <p className="text-emerald-300/70 text-[10px]">Is tier ke SARE users ka theme override ho jaayega</p>
                        </div>
                        <button onClick={() => setShowOfficialPopup(false)} className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
                            <X size={13} className="text-white/70" />
                        </button>
                    </div>
                    <div className="p-5 flex flex-col gap-4">
                        <div>
                            <p className="text-white/60 text-xs font-bold mb-2.5">Kis Tier Ka Official Theme Banao?</p>
                            <div className="grid grid-cols-3 gap-2">
                                {([
                                    ['free',  'FREE',  '#0ea5e9', '🎓'],
                                    ['basic', 'BASIC', '#2563eb', '⭐'],
                                    ['ultra', 'ULTRA', '#1e3a8a', '💙'],
                                ] as const).map(([val, label, color, emoji]) => (
                                    <button key={val} onClick={() => setOfficialTier(val)}
                                        className="py-3 rounded-2xl flex flex-col items-center gap-1 transition-all active:scale-95 text-xs font-black"
                                        style={{
                                            background: officialTier === val ? `${color}28` : 'rgba(255,255,255,0.05)',
                                            border: `2px solid ${officialTier === val ? color + '70' : 'transparent'}`,
                                            color: officialTier === val ? '#fff' : 'rgba(255,255,255,0.35)',
                                        }}
                                    >
                                        <span className="text-lg">{emoji}</span>
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="rounded-2xl p-3 text-[10px] text-emerald-300/70" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' }}>
                            ⚡ Yeh theme us tier ke <strong className="text-emerald-200">SARE users</strong> ko milegi — chahe unka apna personal theme set ho ya na ho. Isko hatane ke baad users ki apni theme wapas aayegi.
                        </div>
                        <button
                            onClick={doOfficialTierApply}
                            disabled={officialSaving}
                            className="w-full py-3.5 rounded-2xl font-black text-sm text-white active:scale-95 transition-all disabled:opacity-60"
                            style={{ background: 'linear-gradient(135deg,#059669,#10b981)', boxShadow: '0 4px 20px rgba(16,185,129,0.35)' }}
                        >
                            {officialSaving ? 'Setting...' : `✅ ${officialTier.toUpperCase()} Ka Official Theme Set Karo`}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* ══════════════════════════════════════════════════
            ADMIN APP DEFAULT THEME POPUP
        ══════════════════════════════════════════════════ */}
        {showDefaultPopup && (
            <div className="fixed inset-0 z-[300] flex items-end justify-center pb-6 px-4" style={{ background: 'rgba(0,0,0,0.80)', backdropFilter: 'blur(6px)' }}>
                <div className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl" style={{ background: '#0d0f1a', border: `1px solid ${theme.btnStart}40` }}>
                    {/* Header */}
                    <div className="px-5 py-4 flex items-center gap-3" style={{ background: `linear-gradient(135deg,${theme.btnStart},${theme.btnEnd})`, borderBottom: `1px solid ${theme.btnStart}30` }}>
                        <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
                            <Home size={18} className="text-white" />
                        </div>
                        <div className="flex-1">
                            <p className="text-white font-black text-sm">App Ka Default Theme</p>
                            <p className="text-white/70 text-[10px]">SABHI tiers ka permanent base theme badlo</p>
                        </div>
                        <button onClick={() => setShowDefaultPopup(false)} className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center">
                            <X size={13} className="text-white/80" />
                        </button>
                    </div>
                    <div className="p-5 flex flex-col gap-4">
                        {/* Preview strip */}
                        <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${theme.btnStart}30` }}>
                            <div className="px-4 py-3 flex items-center gap-2" style={{ background: `linear-gradient(135deg,${theme.topBarStart},${theme.topBarEnd})` }}>
                                <div className="flex-1">
                                    <div className="h-2 w-20 rounded-full mb-1" style={{ background: theme.textPrimary, opacity: 0.7 }} />
                                    <div className="h-1.5 w-14 rounded-full" style={{ background: theme.textSecondary, opacity: 0.45 }} />
                                </div>
                                <div className="h-6 px-3 rounded-full text-[9px] font-black flex items-center text-white" style={{ background: `linear-gradient(135deg,${theme.btnStart},${theme.btnEnd})` }}>New Default</div>
                            </div>
                        </div>
                        {/* Info */}
                        <div className="rounded-2xl p-3 flex flex-col gap-1.5" style={{ background: `${theme.btnStart}10`, border: `1px solid ${theme.btnStart}20` }}>
                            <p className="text-white/80 text-[11px] font-bold">Yeh kya karega?</p>
                            <p className="text-white/50 text-[10px] leading-relaxed">
                                • <span className="text-white/70">FREE, BASIC, aur ULTRA</span> — teeno tiers ka default theme yeh ban jaayega<br/>
                                • Jo users apna custom theme set nahi kiya, unhe <span className="text-white/70">yahi theme milegi</span><br/>
                                • Broadcast theme still works as override upar se<br/>
                                • Hatane ke baad sab purane hardcoded defaults pe wapas
                            </p>
                        </div>
                        {/* Tiers indicator */}
                        <div className="grid grid-cols-3 gap-2">
                            {([['FREE','#0ea5e9','🎓'],['BASIC','#2563eb','⭐'],['ULTRA','#6d28d9','💙']] as const).map(([label, color, emoji]) => (
                                <div key={label} className="rounded-xl py-2 flex flex-col items-center gap-1" style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
                                    <span className="text-base">{emoji}</span>
                                    <span className="text-[9px] font-black" style={{ color }}>{label}</span>
                                    <span className="text-[8px] text-white/40">→ New</span>
                                </div>
                            ))}
                        </div>
                        {/* Confirm button */}
                        <button
                            onClick={doSetAppDefault}
                            disabled={defaultSaving}
                            className="w-full py-3.5 rounded-2xl font-black text-sm text-white active:scale-95 transition-all disabled:opacity-60"
                            style={{ background: `linear-gradient(135deg,${theme.btnStart},${theme.btnEnd})`, boxShadow: `0 4px 20px ${theme.btnStart}40` }}
                        >
                            {defaultSaving ? 'Saving...' : '🏠 Sabhi Tiers Ka Default Set Karo'}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* ══════════════════════════════════════════════════
            ADMIN GLOBAL APPLY POPUP
        ══════════════════════════════════════════════════ */}

        {showSchedulePopup && (
            <div className="fixed inset-0 z-[300] flex items-end justify-center pb-6 px-4" style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(8px)' }}>
                <div className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl" style={{ background: '#0d0f1a', border: '1px solid rgba(99,102,241,0.3)' }}>
                    <div className="px-5 py-4 flex items-center gap-3" style={{ background: 'linear-gradient(135deg,#312e81,#1e1b4b)', borderBottom: '1px solid rgba(99,102,241,0.2)' }}>
                        <span className="text-2xl">📅</span>
                        <div className="flex-1">
                            <p className="text-white font-black text-sm">Theme Event Schedule Karo</p>
                            <p className="text-indigo-300/70 text-[10px]">Future mein theme event set karo — discount event jaisa</p>
                        </div>
                        <button onClick={() => setShowSchedulePopup(false)} className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
                            <X size={13} className="text-white/70" />
                        </button>
                    </div>
                    <div className="p-5 pb-8 flex flex-col gap-4 overflow-y-auto max-h-[72vh]">
                        {/* Theme preview strip */}
                        <div className="rounded-2xl overflow-hidden border border-white/08">
                            <div className="h-8 w-full flex items-center px-3 gap-2" style={{ background: `linear-gradient(135deg,${theme.topBarStart},${theme.topBarEnd})` }}>
                                <div className="w-3 h-3 rounded-full" style={{ background: theme.navActive }} />
                                <span className="text-[9px] font-black text-white/80">{theme.themeName || 'Current Theme'} {theme.themeEmoji || '🎨'}</span>
                            </div>
                        </div>

                        {/* Event name */}
                        <div>
                            <p className="text-white/60 text-[11px] font-bold mb-1.5">🎉 Event Ka Naam</p>
                            <input
                                type="text"
                                value={scheduleEventName}
                                onChange={e => setScheduleEventName(e.target.value)}
                                placeholder={`Diwali Theme, Independence Day...`}
                                className="w-full rounded-xl px-3 py-2.5 text-sm font-bold text-white outline-none"
                                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(99,102,241,0.25)' }}
                                maxLength={40}
                            />
                        </div>

                        {/* Start date/time */}
                        <div>
                            <p className="text-white/60 text-[11px] font-bold mb-1.5">⏰ Kab Shuru Hoga?</p>
                            <input
                                type="datetime-local"
                                value={scheduleStartDt}
                                onChange={e => setScheduleStartDt(e.target.value)}
                                min={new Date().toISOString().slice(0,16)}
                                className="w-full rounded-xl px-3 py-2.5 text-sm font-bold text-white outline-none"
                                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(99,102,241,0.25)', colorScheme: 'dark' }}
                            />
                        </div>

                        {/* Duration — quick presets */}
                        <div>
                            <p className="text-white/60 text-[11px] font-bold mb-1.5">⏱ Kitne Ghante Chalega?</p>
                            <div className="grid grid-cols-4 gap-1.5 mb-2">
                                {([1,2,4,6,12,24,48,72] as number[]).map(h => (
                                    <button key={h} onClick={() => setScheduleDurationH(h)}
                                        className="py-2 rounded-xl text-[10px] font-bold transition-all active:scale-95"
                                        style={{
                                            background: scheduleDurationH === h ? `linear-gradient(135deg,${theme.btnStart},${theme.btnEnd})` : 'rgba(255,255,255,0.06)',
                                            color: scheduleDurationH === h ? '#fff' : 'rgba(255,255,255,0.5)',
                                            border: `1px solid ${scheduleDurationH === h ? theme.btnStart+'80' : 'transparent'}`,
                                        }}
                                    >{h}h</button>
                                ))}
                            </div>
                            <div className="flex items-center gap-2 rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                                <button className="w-10 h-9 flex items-center justify-center text-white/50 text-lg font-bold active:scale-90" onClick={() => setScheduleDurationH(h => Math.max(1, h-1))}>−</button>
                                <input type="number" min={1} max={720} value={scheduleDurationH}
                                    onChange={e => setScheduleDurationH(Math.max(1, Math.min(720, parseInt(e.target.value)||1)))}
                                    className="flex-1 text-center text-sm font-black text-white outline-none bg-transparent py-2"
                                />
                                <span className="text-white/40 text-xs pr-2">ghante</span>
                                <button className="w-10 h-9 flex items-center justify-center text-white/50 text-lg font-bold active:scale-90" onClick={() => setScheduleDurationH(h => Math.min(720, h+1))}>+</button>
                            </div>
                        </div>

                        {/* Target tier */}
                        <div>
                            <p className="text-white/60 text-[11px] font-bold mb-1.5">👥 Kis Ko Milega?</p>
                            <div className="grid grid-cols-4 gap-1.5">
                                {(['ALL','ULTRA','BASIC','FREE'] as const).map(tier => (
                                    <button key={tier} onClick={() => setScheduleTier(tier)}
                                        className="py-2 rounded-xl text-[10px] font-bold transition-all active:scale-95"
                                        style={{
                                            background: scheduleTier === tier ? `linear-gradient(135deg,${theme.btnStart},${theme.btnEnd})` : 'rgba(255,255,255,0.06)',
                                            color: scheduleTier === tier ? '#fff' : 'rgba(255,255,255,0.5)',
                                            border: `1px solid ${scheduleTier === tier ? theme.btnStart+'80' : 'transparent'}`,
                                        }}
                                    >{tier === 'ALL' ? 'Sabhi' : tier}</button>
                                ))}
                            </div>
                        </div>

                        {/* Options */}
                        <div className="flex gap-3">
                            {[
                                { label: 'Profile bg bhi', state: scheduleApplyProfile, set: setScheduleApplyProfile },
                                { label: 'App bg bhi', state: scheduleApplyBg, set: setScheduleApplyBg },
                            ].map(({ label, state, set }) => (
                                <button key={label} onClick={() => set(!state)}
                                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10px] font-bold transition-all active:scale-95"
                                    style={{
                                        background: state ? `${theme.btnStart}25` : 'rgba(255,255,255,0.05)',
                                        color: state ? theme.navActive : 'rgba(255,255,255,0.4)',
                                        border: `1px solid ${state ? theme.btnStart+'50' : 'rgba(255,255,255,0.08)'}`,
                                    }}
                                >
                                    <span>{state ? '✓' : '○'}</span> {label}
                                </button>
                            ))}
                        </div>

                        {/* Summary card */}
                        {scheduleStartDt && (
                            <div className="rounded-2xl p-3" style={{ background: `${theme.btnStart}12`, border: `1px solid ${theme.btnStart}25` }}>
                                <p className="text-[10px] text-white/50 font-bold uppercase tracking-wide mb-1">Event Summary</p>
                                <p className="text-xs text-white font-bold">{scheduleEventName || 'Theme Event'}</p>
                                <p className="text-[10px] text-white/50 mt-0.5">
                                    📅 {new Date(scheduleStartDt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                                    {' '}→ {scheduleDurationH}h chalega
                                </p>
                                <p className="text-[10px] text-white/50">
                                    👥 {scheduleTier === 'ALL' ? 'Sabhi users' : scheduleTier}
                                </p>
                            </div>
                        )}

                        <div className="flex gap-2 pt-1">
                            <button onClick={() => setShowSchedulePopup(false)}
                                className="flex-1 py-3 rounded-2xl font-bold text-sm text-white/40 border border-white/10 active:scale-95 transition-all"
                                style={{ background: 'rgba(255,255,255,0.04)' }}
                            >Cancel</button>
                            <button onClick={doScheduleTheme} disabled={scheduleSaving || !scheduleStartDt}
                                className="flex-1 py-3 rounded-2xl font-black text-sm text-white active:scale-95 transition-all disabled:opacity-40"
                                style={{ background: `linear-gradient(135deg,${theme.btnStart},${theme.btnEnd})`, boxShadow: `0 4px 16px ${theme.btnStart}40` }}
                            >
                                {scheduleSaving ? 'Saving...' : '📅 Schedule Karo'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        </>
    );
};
