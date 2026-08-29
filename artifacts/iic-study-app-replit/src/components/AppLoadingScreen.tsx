// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { 
  BookOpen, 
  HelpCircle, 
  Video, 
  Headphones, 
  BrainCircuit, 
  BarChart2, 
  WifiOff, 
  Zap, 
  FileCheck, 
  TrendingUp, 
  CalendarCheck, 
  RotateCcw 
} from 'lucide-react';
import { APP_VERSION } from '../constants';

interface AppLoadingScreenProps {
  onComplete: () => void;
  onBack?: () => void;
  onApply?: () => void;
  isPreview?: boolean;
  isPremium?: boolean;
  subscriptionLevel?: 'FREE' | 'BASIC' | 'ULTRA';
  userId?: string;
  userRole?: string;
  loadingScreenSlotAssignments?: Record<string, number>;
  loadingScreenSlotUnlocks?: Record<string, boolean>;
  loadingScreenUnlocks?: Record<string, number>;
}

interface BlockItem {
  id: number;
  val: number;
  slot: number;
  isLifted: boolean;
  isSorted: boolean;
  isComparing: boolean;
}

export const AppLoadingScreen: React.FC<AppLoadingScreenProps> = ({ 
  onComplete,
  onBack,
  onApply,
  isPreview = false,
  isPremium = false, 
  subscriptionLevel = 'FREE',
  userId,
  userRole,
  loadingScreenSlotAssignments,
  loadingScreenSlotUnlocks,
  loadingScreenUnlocks,
}) => {
  // ── Selected style ──
  const [styleVariant] = useState<number>(() => {
    try {
      const previewStyle = isPreview ? sessionStorage.getItem('nst_splash_preview_style') : null;
      const selected = parseInt(
        previewStyle ||
        (userId ? localStorage.getItem(`nst_splash_style_preference_${userId}`) : null) ||
        localStorage.getItem('nst_splash_style_preference') ||
        '1',
        10,
      );
      if (isPreview) return !isNaN(selected) && selected >= 1 && selected <= 4 ? selected : 1;

      // Every user gets all four designs. Rotate globally for that user's
      // next app open; no slots, unlocks, subscription, or credit checks.
      const rotationKey = `nst_splash_rotation_${userId || 'guest'}`;
      const rotationIndex = parseInt(localStorage.getItem(rotationKey) || '0', 10);
      const candidate = (rotationIndex % 4) + 1;
      localStorage.setItem(rotationKey, String((rotationIndex + 1) % 4));
      return candidate;
    } catch {
      return 1;
    }
  });

  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('Loading Your Learning Journey...');
  const [stepPhase1, setStepPhase1] = useState(-1);
  const [stepPhase2, setStepPhase2] = useState(-1);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  // ── 6 Orbit Nodes Config (For Variants 2 & 4) ──
  const orbitNodes = [
    { id: 'notes', label: 'Smart Notes', icon: BookOpen, color: '#38bdf8', angleDeg: 270, showAt: 10 },
    { id: 'mcq', label: 'MCQ Practice', icon: FileCheck, color: '#60a5fa', angleDeg: 330, showAt: 25 },
    { id: 'progress', label: 'Progress Tracking', icon: TrendingUp, color: '#34d399', angleDeg: 30, showAt: 40 },
    { id: 'routine', label: 'Daily Routine', icon: CalendarCheck, color: '#f472b6', angleDeg: 90, showAt: 55 },
    { id: 'revision', label: 'Revision Hub', icon: RotateCcw, color: '#fbbf24', angleDeg: 150, showAt: 70 },
    { id: 'ai', label: 'AI Study Assistant', icon: BrainCircuit, color: '#c084fc', angleDeg: 210, showAt: 85 },
  ];

  // ── Bubble Sort & Crane Engine States (for Variant 3) ──
  const [blocks, setBlocks] = useState<BlockItem[]>([
    { id: 0, val: 3, slot: 0, isLifted: false, isSorted: false, isComparing: false },
    { id: 1, val: 2, slot: 1, isLifted: false, isSorted: false, isComparing: false },
    { id: 2, val: 7, slot: 2, isLifted: false, isSorted: false, isComparing: false },
    { id: 3, val: 5, slot: 3, isLifted: false, isSorted: false, isComparing: false },
    { id: 4, val: 8, slot: 4, isLifted: false, isSorted: false, isComparing: false },
    { id: 5, val: 4, slot: 5, isLifted: false, isSorted: false, isComparing: false },
    { id: 6, val: 1, slot: 6, isLifted: false, isSorted: false, isComparing: false },
    { id: 7, val: 6, slot: 7, isLifted: false, isSorted: false, isComparing: false },
  ]);

  const [craneSlot, setCraneSlot] = useState<number>(0);
  const [wireHeight, setWireHeight] = useState<number>(10);
  const [isClawClosed, setIsClawClosed] = useState<boolean>(false);
  const [actionPrompt, setActionPrompt] = useState<string>('a[0] > a[1] ?');

  const developerName = 'Nadim Anwar';
  const isSortMode = styleVariant === 3;
  const SLOT_WIDTH = 40;
  const RIG_PAD = 14;

  const statusMilestones = [
    { at: 0, text: 'Initializing App Modules...' },
    { at: 20, text: 'Loading Your Learning Journey...' },
    { at: 55, text: 'Syncing Study Routine & Daily Goals...' },
    { at: 80, text: 'Preparing Fast Revision Engine...' },
    { at: 96, text: 'Welcome to NSTA!' }
  ];

  // ── Engine 1: Linear Timer Progress (Variant 1: 5s | Variants 2, 4: 8s) ──
  useEffect(() => {
    if (isSortMode) return;

    const duration = styleVariant === 1 ? 5000 : 8000;
    const intervalTime = 25;
    const steps = duration / intervalTime;
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      const currentProgress = Math.min(Math.floor((currentStep / steps) * 100), 100);
      setProgress(currentProgress);

      if (currentProgress < 50) {
        if (currentProgress >= 10) setStepPhase1(0);
        if (currentProgress >= 20) setStepPhase1(1);
        if (currentProgress >= 30) setStepPhase1(2);
        if (currentProgress >= 40) setStepPhase1(3);
      } else {
        setStepPhase1(-1);
        if (currentProgress >= 50) setStepPhase2(0);
        if (currentProgress >= 60) setStepPhase2(1);
        if (currentProgress >= 70) setStepPhase2(2);
        if (currentProgress >= 80) setStepPhase2(3);
      }

      for (let s = statusMilestones.length - 1; s >= 0; s--) {
        if (currentProgress >= statusMilestones[s].at) {
          setStatusText(statusMilestones[s].text);
          break;
        }
      }

      if (currentStep >= steps) {
        clearInterval(timer);
        if (!isPreview) {
          setTimeout(() => onCompleteRef.current(), 350);
        }
      }
    }, intervalTime);

    return () => clearInterval(timer);
  }, [styleVariant, isSortMode]);

  // ── Engine 2: Real-time Algorithm Sort Progress (Variant 3) -> Exact ~7.8s ──
  useEffect(() => {
    if (!isSortMode) return;
    let isCancelled = false;
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

    const runSortEngine = async () => {
      let state = [
        { id: 0, val: 3 },
        { id: 1, val: 2 },
        { id: 2, val: 7 },
        { id: 3, val: 5 },
        { id: 4, val: 8 },
        { id: 5, val: 4 },
        { id: 6, val: 1 },
        { id: 7, val: 6 },
      ];

      const n = state.length;
      const totalComparisons = (n * (n - 1)) / 2;
      let stepsCompleted = 0;

      const syncBlocks = (overrides = {}) => {
        setBlocks(prev =>
          prev.map(b => {
            const currentSlot = state.findIndex(s => s.id === b.id);
            return {
              ...b,
              slot: currentSlot,
              ...overrides[b.id],
            };
          })
        );
      };

      for (let p = 0; p < n - 1; p++) {
        let swappedAny = false;

        for (let i = 0; i < n - 1 - p; i++) {
          if (isCancelled) return;

          const itemA = state[i];
          const itemB = state[i + 1];

          // 1. Crane arrives & compares
          setCraneSlot(i);
          setWireHeight(10);
          setIsClawClosed(false);
          setActionPrompt(`a[${i}] > a[${i + 1}] ?`);

          syncBlocks({
            [itemA.id]: { isComparing: true, isLifted: false },
            [itemB.id]: { isComparing: true, isLifted: false },
          });

          await sleep(95);
          if (isCancelled) return;

          // 2. Swap sequence
          if (itemA.val > itemB.val) {
            setActionPrompt(`swap a[${i}], a[${i + 1}]`);

            // Cable descends
            setWireHeight(58);
            await sleep(70);
            if (isCancelled) return;

            // Claw grips
            setIsClawClosed(true);
            await sleep(50);
            if (isCancelled) return;

            // Lift block
            setWireHeight(10);
            syncBlocks({
              [itemA.id]: { isLifted: true, isComparing: false },
              [itemB.id]: { isComparing: false },
            });
            await sleep(105);
            if (isCancelled) return;

            // Move crane
            setCraneSlot(i + 1);

            const temp = state[i];
            state[i] = state[i + 1];
            state[i + 1] = temp;

            syncBlocks({
              [itemA.id]: { isLifted: true, isComparing: false },
              [itemB.id]: { isComparing: false, isLifted: false },
            });
            await sleep(120);
            if (isCancelled) return;

            // Cable lowers
            setWireHeight(58);
            await sleep(70);
            if (isCancelled) return;

            // Release claw
            setIsClawClosed(false);
            syncBlocks({
              [itemA.id]: { isLifted: false, isComparing: false },
              [itemB.id]: { isComparing: false, isLifted: false },
            });
            await sleep(45);
            if (isCancelled) return;

            setWireHeight(10);
            swappedAny = true;
          } else {
             // Even when the pair is already in order, the crane still
             // performs a deliberate inspect cycle: descend to the boxes,
             // then return to the overhead wire before continuing.
             setWireHeight(58);
             await sleep(70);
             if (isCancelled) return;
             setWireHeight(10);
            syncBlocks({
              [itemA.id]: { isComparing: false },
              [itemB.id]: { isComparing: false },
            });
             await sleep(110);
          }

          stepsCompleted++;
          const pct = Math.min(Math.floor((stepsCompleted / totalComparisons) * 98), 98);
          setProgress(pct);

          for (let s = statusMilestones.length - 1; s >= 0; s--) {
            if (pct >= statusMilestones[s].at) {
              setStatusText(statusMilestones[s].text);
              break;
            }
          }
        }

        const sortedId = state[n - 1 - p].id;
        setBlocks(prev =>
          prev.map(b => (b.id === sortedId ? { ...b, isSorted: true } : b))
        );

        if (!swappedAny) break;
      }

      setBlocks(prev => prev.map(b => ({ ...b, isSorted: true, isComparing: false, isLifted: false })));
      setActionPrompt('OPTIMAL_SORT_COMPLETE ✅');
      setStatusText('Welcome to NSTA!');
      setCraneSlot(3.5);
      setWireHeight(10);
      setProgress(100);

      await sleep(250);
      if (!isCancelled && !isPreview) onCompleteRef.current();
    };

    runSortEngine();
    return () => { isCancelled = true; };
  }, [isSortMode]);

  return (
    <div 
       className="fixed inset-0 z-[99999] w-screen h-screen min-h-screen flex flex-col items-center justify-between px-6 pt-9 pb-7 select-none overflow-hidden font-sans"
      style={{
         background: 'radial-gradient(circle at 50% 18%, #1e1b4b 0%, #0c1033 40%, #030717 100%)',
      }}
    >
      <style>{`
        @keyframes shineSweep {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes floatCenter {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-4px) scale(1.02); }
        }
        @keyframes orbitSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes counterOrbitSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(-360deg); }
        }
         .sort-scene-3d {
           perspective: 900px;
           transform-style: preserve-3d;
         }
         .sort-block-3d {
           transform-style: preserve-3d;
           transform-origin: 50% 100%;
           will-change: transform;
           isolation: isolate;
         }
         .sort-block-3d::before {
           content: '';
           position: absolute;
           top: -7px;
           left: 1px;
           width: calc(100% - 2px);
           height: 7px;
           border: 1px solid color-mix(in srgb, var(--block-top) 75%, white);
           border-bottom: 0;
           border-radius: 5px 4px 0 0;
           background: linear-gradient(135deg, color-mix(in srgb, var(--block-top) 92%, white), var(--block-top));
           transform: skewX(-38deg);
           transform-origin: left bottom;
           z-index: -1;
         }
         .sort-block-3d::after {
           content: '';
           position: absolute;
           top: 2px;
           right: -7px;
           width: 7px;
           height: calc(100% - 2px);
           border-right: 1px solid color-mix(in srgb, var(--block-side) 80%, white);
           border-bottom: 1px solid color-mix(in srgb, var(--block-side) 80%, white);
           border-radius: 0 3px 4px 0;
           background: linear-gradient(180deg, var(--block-side), color-mix(in srgb, var(--block-side) 70%, black));
           transform: skewY(-28deg);
           transform-origin: left top;
           z-index: -1;
         }
      `}</style>

      {/* Ambient Background Glows */}
      <div 
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(99, 102, 241, 0.3) 0%, transparent 70%)', filter: 'blur(70px)' }}
      />
      <div 
        className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-[500px] h-[300px] pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(37, 99, 235, 0.35) 0%, transparent 70%)', filter: 'blur(70px)' }}
      />
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[620px] h-[620px] rounded-full border border-sky-400/10 pointer-events-none"
      />

      {/* ── TOP NSTA BRANDING & FEATURE BADGES ── */}
      <div className="relative z-10 flex flex-col items-center w-full max-w-md">
        <div className="w-40 h-28 flex items-center justify-center">
          <svg className="w-full h-full drop-shadow-[0_0_24px_rgba(56,189,248,0.65)]" viewBox="0 0 220 180" fill="none">
            <defs>
              <linearGradient id="mainPageLeft" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#0284c7" />
                <stop offset="60%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#818cf8" />
              </linearGradient>
              <linearGradient id="mainPageRight" x1="1" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#9333ea" />
                <stop offset="60%" stopColor="#c084fc" />
                <stop offset="100%" stopColor="#818cf8" />
              </linearGradient>
              <linearGradient id="glowBase" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#ffffff" />
              </linearGradient>
            </defs>

            <path d="M110 148 C65 125 25 138 12 110 C50 102 85 118 110 138 Z" fill="#0369a1" opacity="0.6" />
            <path d="M110 148 C155 125 195 138 208 110 C170 102 135 118 110 138 Z" fill="#7e22ce" opacity="0.6" />
            <path d="M110 140 C70 115 32 124 20 100 C56 94 90 108 110 128 Z" fill="url(#mainPageLeft)" />
            <path d="M110 140 C150 115 188 124 200 100 C164 94 130 108 110 128 Z" fill="url(#mainPageRight)" />
            <path d="M110 130 C75 105 45 112 35 90 C68 84 95 98 110 118 Z" fill="#e0f2fe" opacity="0.95" />
            <path d="M110 130 C145 105 175 112 185 90 C152 84 125 98 110 118 Z" fill="#f3e8ff" opacity="0.95" />
            <path d="M108 152 L112 152 L111 65 L109 65 Z" fill="url(#glowBase)" filter="drop-shadow(0 0 8px #38bdf8)" />

            <path d="M110 40 L160 58 L110 76 L60 58 Z" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
            <path d="M88 68 L88 84 C88 94 132 94 132 84 L132 68 Z" fill="#0f172a" />
            <path d="M160 58 L170 82 L166 84 L156 60 Z" fill="#fbbf24" />
          </svg>
        </div>

        <h1 className="text-5xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-b from-white via-blue-100 to-blue-300 drop-shadow-[0_4px_18px_rgba(255,255,255,0.25)]">
          NSTA
        </h1>

        <div className="flex items-center gap-1.5 mt-1 text-slate-100 text-sm font-bold">
          <span className="text-sky-400 text-xs">✦</span>
          <span>National Study & Tracking App</span>
          <span className="text-sky-400 text-xs">✦</span>
        </div>

        <div className="flex items-center justify-center gap-2.5 mt-2.5 text-xs font-bold flex-wrap">
          <div className="flex items-center gap-1 text-sky-400">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="7" r="4"/><path d="M5.5 21a8.5 8.5 0 0 1 13 0"/></svg>
            <span>Self Study</span>
          </div>
          <span className="w-1 h-1 rounded-full bg-slate-600" />
          <div className="flex items-center gap-1 text-emerald-400">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/></svg>
            <span>Discipline</span>
          </div>
          <span className="w-1 h-1 rounded-full bg-slate-600" />
          <div className="flex items-center gap-1 text-amber-400">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
            <span>Routine</span>
          </div>
          <span className="w-1 h-1 rounded-full bg-slate-600" />
          <div className="flex items-center gap-1 text-purple-400">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
            <span>Revision</span>
          </div>
        </div>
      </div>

      {/* ── MIDDLE DYNAMIC CONTENT (1 TO 4) ── */}
      {styleVariant === 1 && (
        /* 1. Feature Grid Flip Cards (5s Duration) */
        <div className="relative z-10 w-full max-w-[340px] h-[210px] perspective-1000 flex items-center justify-center">
          <div className={`absolute inset-0 grid grid-cols-2 gap-3 transition-all duration-500 ${progress < 50 ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
            <div className={`flex flex-col items-center justify-center p-4 rounded-xl bg-slate-900/80 border border-slate-700/60 shadow-lg transition-all duration-500 transform ${stepPhase1 >= 0 ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-6 scale-95'}`}>
              <BookOpen size={28} className="text-blue-400 mb-2" />
              <span className="text-xs font-bold text-slate-200">Notes Hub</span>
            </div>
            <div className={`flex flex-col items-center justify-center p-4 rounded-xl bg-slate-900/80 border border-slate-700/60 shadow-lg transition-all duration-500 transform ${stepPhase1 >= 1 ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-6 scale-95'}`}>
              <HelpCircle size={28} className="text-purple-400 mb-2" />
              <span className="text-xs font-bold text-slate-200">MCQ Practice</span>
            </div>
            <div className={`flex flex-col items-center justify-center p-4 rounded-xl bg-slate-900/80 border border-slate-700/60 shadow-lg transition-all duration-500 transform ${stepPhase1 >= 2 ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-6 scale-95'}`}>
              <Video size={28} className="text-rose-400 mb-2" />
              <span className="text-xs font-bold text-slate-200">Video Classes</span>
            </div>
            <div className={`flex flex-col items-center justify-center p-4 rounded-xl bg-slate-900/80 border border-slate-700/60 shadow-lg transition-all duration-500 transform ${stepPhase1 >= 3 ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-6 scale-95'}`}>
              <Headphones size={28} className="text-emerald-400 mb-2" />
              <span className="text-xs font-bold text-slate-200">Audio TTS</span>
            </div>
          </div>

          <div className={`absolute inset-0 grid grid-cols-2 gap-3 transition-all duration-500 ${progress >= 50 ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
            <div className={`flex flex-col items-center justify-center p-4 rounded-xl bg-slate-900/80 border border-slate-700/60 shadow-lg transition-all duration-500 transform ${stepPhase2 >= 0 ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-6 scale-95'}`}>
              <BrainCircuit size={28} className="text-amber-400 mb-2" />
              <span className="text-xs font-bold text-slate-200">Smart Revision</span>
            </div>
            <div className={`flex flex-col items-center justify-center p-4 rounded-xl bg-slate-900/80 border border-slate-700/60 shadow-lg transition-all duration-500 transform ${stepPhase2 >= 1 ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-6 scale-95'}`}>
              <BarChart2 size={28} className="text-indigo-400 mb-2" />
              <span className="text-xs font-bold text-slate-200">Leaderboard</span>
            </div>
            <div className={`flex flex-col items-center justify-center p-4 rounded-xl bg-slate-900/80 border border-slate-700/60 shadow-lg transition-all duration-500 transform ${stepPhase2 >= 2 ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-6 scale-95'}`}>
              <WifiOff size={28} className="text-teal-400 mb-2" />
              <span className="text-xs font-bold text-slate-200">Offline Mode</span>
            </div>
            <div className={`flex flex-col items-center justify-center p-4 rounded-xl bg-slate-900/80 border border-slate-700/60 shadow-lg transition-all duration-500 transform ${stepPhase2 >= 3 ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-6 scale-95'}`}>
              <Zap size={28} className="text-orange-400 mb-2" />
              <span className="text-xs font-bold text-slate-200">Level System</span>
            </div>
          </div>
        </div>
      )}

      {styleVariant === 2 && (
        /* 2. Frameless Continuous Spinning Orbit Ring (8s Duration) */
        <div className="relative z-10 w-[345px] h-[345px] flex items-center justify-center my-auto">
          <div className="absolute w-[250px] h-[250px] rounded-full border border-sky-500/25 shadow-[0_0_24px_rgba(56,189,248,0.18)] pointer-events-none" />
          <div className="absolute w-[280px] h-[280px] rounded-full border border-dashed border-indigo-400/20 pointer-events-none" />

          {/* Original Glowing 3D Open Book Center Hub */}
          <div 
            className="relative z-20 flex flex-col items-center justify-center text-center px-2 pointer-events-none"
            style={{ animation: 'floatCenter 4s ease-in-out infinite' }}
          >
            <div className="w-28 h-16 relative flex items-center justify-center">
              <div className="absolute -top-3 w-20 h-20 bg-gradient-to-t from-sky-400/30 to-transparent rounded-full blur-md pointer-events-none" />
              
               <svg className="w-full h-full drop-shadow-[0_0_18px_rgba(56,189,248,0.95)]" viewBox="0 0 160 110" fill="none" aria-label="Open book">
                <defs>
                  <linearGradient id="orbBookLeftLarge" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#38bdf8" />
                    <stop offset="100%" stopColor="#2563eb" />
                  </linearGradient>
                  <linearGradient id="orbBookRightLarge" x1="1" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#c084fc" />
                    <stop offset="100%" stopColor="#6366f1" />
                  </linearGradient>
                </defs>
                 <path d="M80 88 C57 76 30 78 12 62 C16 81 43 94 80 96 Z" fill="#0284c7" opacity="0.72" />
                 <path d="M80 88 C103 76 130 78 148 62 C144 81 117 94 80 96 Z" fill="#7c3aed" opacity="0.72" />
                 <path d="M80 82 C58 69 33 70 16 57 C23 74 47 85 80 90 Z" fill="url(#orbBookLeftLarge)" />
                 <path d="M80 82 C102 69 127 70 144 57 C137 74 113 85 80 90 Z" fill="url(#orbBookRightLarge)" />
                 <path d="M80 77 C59 63 38 64 22 53 C31 67 51 76 80 84 Z" fill="#f8fcff" />
                 <path d="M80 77 C101 63 122 64 138 53 C129 67 109 76 80 84 Z" fill="#fffaff" />
                  <path d="M80 84 C61 72 44 70 29 66 M80 84 C99 72 116 70 131 66" stroke="#bfdbfe" strokeWidth="1.2" opacity="0.8" />
                  <path d="M34 58 C48 61 64 67 78 77 M34 65 C48 68 63 73 77 82 M126 58 C112 61 96 67 82 77 M126 65 C112 68 97 73 83 82" stroke="#64748b" strokeWidth="1.4" opacity="0.65" strokeLinecap="round" />
                  <path d="M80 78 C80 61 80 47 80 35" stroke="#ffffff" strokeWidth="2.6" strokeLinecap="round" opacity="0.95" />
                  <path d="M80 91 C67 85 51 81 32 80 M80 91 C93 85 109 81 128 80" stroke="#38bdf8" strokeWidth="1.4" opacity="0.8" />
              </svg>
            </div>

            <p className="text-[11px] font-semibold text-slate-300 mt-1 leading-tight">Your All-in-One</p>
            <p className="text-sm font-black text-sky-400 leading-tight drop-shadow-[0_0_10px_rgba(56,189,248,0.75)]">Study Partner</p>
          </div>

          {/* Orbit Items Layer (Smooth 360 Spin) */}
          <div 
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{ animation: 'orbitSpin 22s linear infinite' }}
          >
            {orbitNodes.map((node) => {
              const rad = (node.angleDeg * Math.PI) / 180;
              const x = Math.round(125 * Math.cos(rad));
              const y = Math.round(125 * Math.sin(rad));
              const IconComp = node.icon;

              return (
                <div
                  key={node.id}
                  className="absolute flex flex-col items-center justify-center text-center"
                  style={{
                    transform: `translate(${x}px, ${y}px)`,
                    width: '82px',
                  }}
                >
                  <div 
                    style={{ animation: 'counterOrbitSpin 22s linear infinite' }} 
                    className="flex flex-col items-center"
                  >
                    <div 
                      className="w-11 h-11 rounded-full flex items-center justify-center shadow-lg transition-transform duration-300"
                      style={{
                        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.95))',
                        border: `1.5px solid ${node.color}`,
                        boxShadow: `0 0 14px ${node.color}55, inset 0 0 7px ${node.color}35`,
                      }}
                    >
                      <IconComp size={18} style={{ color: node.color }} />
                    </div>
                    <span 
                      className="text-[9.5px] font-bold text-slate-200 mt-1.5 leading-tight text-center whitespace-normal"
                      style={{ textShadow: '0 2px 4px rgba(0,0,0,0.9)' }}
                    >
                      {node.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {styleVariant === 3 && (
        /* 3. Frameless Bubble Sort with Crane (Direct on Main Screen) */
         <div className="sort-scene-3d relative z-10 w-full max-w-[345px] h-[210px] flex flex-col justify-between my-auto">
          {/* Top Crane Track & Trolley */}
          <div className="relative w-full h-8">
             <div className="absolute top-0 left-8 right-8 h-px bg-cyan-300/50 shadow-[0_0_8px_rgba(34,211,238,0.65)]" />
             <div className="absolute top-2 left-2 right-2 h-1.5 bg-slate-800 rounded-full border border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.3)] flex items-center">
              <div 
                 className="absolute -top-1.5 w-10 h-5 rounded-md bg-gradient-to-b from-cyan-300 via-cyan-500 to-cyan-800 border border-cyan-100 shadow-[0_0_15px_#06b6d4] transition-transform duration-500 ease-in-out flex flex-col items-center z-40 -ml-1"
                 style={{ transform: `translate3d(${RIG_PAD + craneSlot * SLOT_WIDTH}px, 0, 24px)`, transformStyle: 'preserve-3d' }}
              >
                <div className="absolute top-5 w-7 h-28 bg-gradient-to-b from-cyan-400/20 to-transparent pointer-events-none blur-[2px]" />
                 <div className="w-3.5 flex justify-between" style={{ height: `${wireHeight}px`, transition: 'height 420ms cubic-bezier(0.22, 1, 0.36, 1)', transformStyle: 'preserve-3d' }}>
                   <div className="w-0.5 bg-cyan-100 shadow-[0_0_6px_#22d3ee] h-full rounded-full" />
                   <div className="w-0.5 bg-cyan-100 shadow-[0_0_6px_#22d3ee] h-full rounded-full" />
                </div>
                <div className="relative -mt-0.5 flex items-center justify-center">
                   <div className={`w-8 h-2.5 rounded-t border ${isClawClosed ? 'bg-amber-400 border-amber-100 scale-95' : 'bg-cyan-500 border-cyan-200'} transition-all duration-300 flex justify-between px-0.5 shadow-md`}>
                    <div className={`w-1 h-5 rounded-b ${isClawClosed ? 'bg-amber-300 rotate-[18deg] shadow-[0_0_8px_#fbbf24]' : 'bg-cyan-300 -rotate-[16deg]'} transition-all origin-top-left`} />
                    <div className={`w-1 h-5 rounded-b ${isClawClosed ? 'bg-amber-300 -rotate-[18deg] shadow-[0_0_8px_#fbbf24]' : 'bg-cyan-300 rotate-[16deg]'} transition-all origin-top-right`} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Floor Shadow Line */}
          <div className="absolute bottom-6 left-2 right-2 h-2.5 rounded-full bg-slate-950 border-t border-cyan-900/50 blur-[1px]" />

          {/* Number Bars */}
          <div className="relative w-full h-full pt-10 px-1">
            {blocks.map((block) => {
              const barHeight = block.val * 9 + 18;
              const posX = RIG_PAD + block.slot * SLOT_WIDTH;

              let colorClass = 'bg-slate-800/90 border-slate-700 text-slate-300 shadow-md';
              if (block.isSorted) {
                colorClass = 'bg-emerald-500 border-emerald-300 text-black font-black shadow-[0_0_16px_rgba(16,185,129,0.9)]';
              } else if (block.isLifted) {
                colorClass = 'bg-gradient-to-t from-amber-500 via-amber-400 to-yellow-200 border-yellow-100 text-black font-black shadow-[0_0_24px_rgba(245,158,11,1)] scale-105';
              } else if (block.isComparing) {
                colorClass = 'bg-cyan-500 border-cyan-300 text-black font-black shadow-[0_0_14px_rgba(6,182,212,0.9)] -translate-y-1';
              }
               const block3DColors = block.isSorted
                 ? { top: '#86efac', side: '#047857' }
                 : block.isLifted
                   ? { top: '#fef08a', side: '#b45309' }
                   : block.isComparing
                     ? { top: '#a5f3fc', side: '#0e7490' }
                     : { top: '#475569', side: '#0f172a' };

              return (
                <React.Fragment key={block.id}>
                  {block.isLifted && (
                    <div 
                      className="absolute bottom-7 w-6 h-1.5 rounded-full bg-cyan-950 border border-cyan-500/40 blur-[1px] transition-all duration-120"
                      style={{ left: `${posX}px` }}
                    />
                  )}
                  <div
                     className={`sort-block-3d absolute bottom-7 w-6 rounded-t-md border flex flex-col items-center justify-start pt-0.5 font-mono text-[11px] font-bold transition-all duration-300 ease-out ${colorClass}`}
                    style={{
                      left: `${posX}px`,
                      height: `${barHeight}px`,
                       transform: block.isLifted
                         ? 'translate3d(0, -58px, 24px) rotateX(-5deg) rotateY(-5deg)'
                         : 'translate3d(0, 0, 0) rotateX(0deg) rotateY(0deg)',
                      zIndex: block.isLifted ? 50 : 10,
                       '--block-top': block3DColors.top,
                       '--block-side': block3DColors.side,
                    }}
                  >
                    <span>{block.val}</span>
                  </div>
                </React.Fragment>
              );
            })}
          </div>

          {/* Action Prompt */}
          <div className="w-full text-center pb-0.5 font-mono text-[11px] text-cyan-300 font-bold tracking-wide">
            {actionPrompt}
          </div>
        </div>
      )}

      {styleVariant === 4 && (
        /* 4. Frameless Sequential Discovery Ring (8s Duration) */
        <div className="relative z-10 w-[345px] h-[345px] flex items-center justify-center my-auto">
          <div className="absolute w-[250px] h-[250px] rounded-full border border-sky-500/25 shadow-[0_0_24px_rgba(56,189,248,0.18)] pointer-events-none" />
          <div className="absolute w-[280px] h-[280px] rounded-full border border-dashed border-indigo-400/20 pointer-events-none" />

          {/* Original Glowing 3D Open Book Center Hub */}
          <div 
            className="relative z-20 flex flex-col items-center justify-center text-center px-2 pointer-events-none"
            style={{ animation: 'floatCenter 4s ease-in-out infinite' }}
          >
            <div className="w-28 h-16 relative flex items-center justify-center">
              <div className="absolute -top-3 w-20 h-20 bg-gradient-to-t from-sky-400/30 to-transparent rounded-full blur-md pointer-events-none" />
              
               <svg className="w-full h-full drop-shadow-[0_0_18px_rgba(56,189,248,0.95)]" viewBox="0 0 160 110" fill="none" aria-label="Open book">
                <defs>
                  <linearGradient id="orbBookLeftLarge4" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#38bdf8" />
                    <stop offset="100%" stopColor="#2563eb" />
                  </linearGradient>
                  <linearGradient id="orbBookRightLarge4" x1="1" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#c084fc" />
                    <stop offset="100%" stopColor="#6366f1" />
                  </linearGradient>
                </defs>
                 <path d="M80 88 C57 76 30 78 12 62 C16 81 43 94 80 96 Z" fill="#0284c7" opacity="0.72" />
                 <path d="M80 88 C103 76 130 78 148 62 C144 81 117 94 80 96 Z" fill="#7c3aed" opacity="0.72" />
                 <path d="M80 82 C58 69 33 70 16 57 C23 74 47 85 80 90 Z" fill="url(#orbBookLeftLarge4)" />
                 <path d="M80 82 C102 69 127 70 144 57 C137 74 113 85 80 90 Z" fill="url(#orbBookRightLarge4)" />
                 <path d="M80 77 C59 63 38 64 22 53 C31 67 51 76 80 84 Z" fill="#f8fcff" />
                 <path d="M80 77 C101 63 122 64 138 53 C129 67 109 76 80 84 Z" fill="#fffaff" />
                  <path d="M80 84 C61 72 44 70 29 66 M80 84 C99 72 116 70 131 66" stroke="#bfdbfe" strokeWidth="1.2" opacity="0.8" />
                  <path d="M34 58 C48 61 64 67 78 77 M34 65 C48 68 63 73 77 82 M126 58 C112 61 96 67 82 77 M126 65 C112 68 97 73 83 82" stroke="#64748b" strokeWidth="1.4" opacity="0.65" strokeLinecap="round" />
                  <path d="M80 78 C80 61 80 47 80 35" stroke="#ffffff" strokeWidth="2.6" strokeLinecap="round" opacity="0.95" />
                  <path d="M80 91 C67 85 51 81 32 80 M80 91 C93 85 109 81 128 80" stroke="#38bdf8" strokeWidth="1.4" opacity="0.8" />
              </svg>
            </div>

            <p className="text-[11px] font-semibold text-slate-300 mt-1 leading-tight">Your All-in-One</p>
            <p className="text-sm font-black text-sky-400 leading-tight drop-shadow-[0_0_10px_rgba(56,189,248,0.75)]">Study Partner</p>
          </div>

          {/* Staggered Pop-In Orbit Nodes */}
          {orbitNodes.map((node) => {
            const isVisible = progress >= node.showAt;
            const rad = (node.angleDeg * Math.PI) / 180;
            const x = Math.round(125 * Math.cos(rad));
            const y = Math.round(125 * Math.sin(rad));
            const IconComp = node.icon;

            return (
              <div
                key={node.id}
                className="absolute flex flex-col items-center justify-center text-center transition-all duration-500 ease-out"
                style={{
                  transform: `translate(${x}px, ${y}px) scale(${isVisible ? 1 : 0.3})`,
                  opacity: isVisible ? 1 : 0,
                  width: '82px',
                }}
              >
                <div 
                  className="w-11 h-11 rounded-full flex items-center justify-center shadow-lg transition-transform duration-300"
                  style={{
                    background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.95))',
                    border: `1.5px solid ${node.color}`,
                    boxShadow: `0 0 14px ${node.color}55, inset 0 0 7px ${node.color}35`,
                  }}
                >
                  <IconComp size={18} style={{ color: node.color }} />
                </div>
                <span 
                  className="text-[9.5px] font-bold text-slate-200 mt-1.5 leading-tight text-center whitespace-normal"
                  style={{ textShadow: '0 2px 4px rgba(0,0,0,0.9)' }}
                >
                  {node.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── LOADING PROGRESS SECTION ── */}
      <div className="relative z-10 w-full max-w-sm flex flex-col items-center gap-2 px-3">
        <div className="text-xs font-semibold text-slate-200">{statusText}</div>
        <div className="w-full flex items-center gap-3">
          <div className="flex-1 h-2.5 bg-slate-950/80 rounded-full p-[1.5px] border border-white/10 overflow-hidden shadow-inner">
            <div 
              className="h-full rounded-full bg-gradient-to-r from-sky-400 via-indigo-400 to-purple-400 relative shadow-[0_0_16px_rgba(99,102,241,0.9)]"
              style={{ width: `${progress}%` }}
            >
              <div 
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                style={{ animation: 'shineSweep 1.4s infinite' }}
              />
            </div>
          </div>
          <span className="text-sm font-extrabold text-slate-100 tabular-nums min-w-9 text-right">
            {progress}%
          </span>
        </div>
      </div>

      {isPreview && (
        <div className="relative z-10 w-full max-w-sm flex items-center gap-3 px-3 pb-1">
          <button
            type="button"
            onClick={onBack}
            className="flex-1 rounded-xl border border-white/15 bg-white/5 py-2.5 text-xs font-black text-slate-200 active:scale-95 transition-transform"
          >
            ← Back
          </button>
          <button
            type="button"
            onClick={onApply}
            className="flex-1 rounded-xl bg-gradient-to-r from-sky-400 via-indigo-400 to-purple-400 py-2.5 text-xs font-black text-white shadow-[0_0_18px_rgba(99,102,241,0.45)] active:scale-95 transition-transform"
          >
            ✓ Apply this
          </button>
        </div>
      )}

      {/* ── DEVELOPER CREDIT FOOTER ── */}
      <div className="relative z-10 flex flex-col items-center gap-0.5">
        <svg className="w-10 h-7 drop-shadow-[0_0_10px_rgba(56,189,248,0.7)]" viewBox="0 0 60 40" fill="none">
          <line x1="30" y1="2" x2="30" y2="7" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round"/>
          <line x1="16" y1="8" x2="20" y2="12" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round"/>
          <line x1="44" y1="8" x2="40" y2="12" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round"/>
          <path d="M30 14 L30 36 M30 36 C20 31 10 33 5 37 L5 16 C10 12 20 10 30 14 C40 10 50 12 55 16 L55 37 C50 33 40 31 30 36 Z" fill="#38bdf8" fillOpacity="0.25" stroke="#38bdf8" strokeWidth="2.2"/>
        </svg>

        <div className="flex items-center gap-2">
          <div className="w-6 h-[1px] bg-gradient-to-r from-transparent to-slate-400" />
          <span className="text-[11px] font-semibold text-slate-400">Developed & Managed by</span>
          <div className="w-6 h-[1px] bg-gradient-to-l from-transparent to-slate-400" />
        </div>

        <div className="text-lg font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-indigo-400 to-purple-400 drop-shadow-[0_0_12px_rgba(99,102,241,0.5)]">
          {developerName}
        </div>

        <div className="text-[10px] font-semibold text-slate-500 flex items-center gap-1">
          <span className="text-indigo-400">♥</span>
          <span>Built for Students, Designed for Success</span>
        </div>
      </div>
    </div>
  );
};

export default AppLoadingScreen;

