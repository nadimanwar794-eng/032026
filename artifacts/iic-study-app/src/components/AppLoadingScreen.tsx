// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { Check } from 'lucide-react';
import { APP_VERSION } from '../constants';

interface AppLoadingScreenProps {
  onComplete: () => void;
  isPremium?: boolean;
  subscriptionLevel?: 'FREE' | 'BASIC' | 'ULTRA';
}

interface BlockItem {
  id: number;
  val: number;
  slot: number;
  isLifted: boolean;
  isSorted: boolean;
  isComparing: boolean;
}

export const AppLoadingScreen: React.FC<AppLoadingScreenProps> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  // Initial sequence: [3, 8, 2, 7, 5, 4, 1, 6]
  const [blocks, setBlocks] = useState<BlockItem[]>([
    { id: 0, val: 3, slot: 0, isLifted: false, isSorted: false, isComparing: false },
    { id: 1, val: 8, slot: 1, isLifted: false, isSorted: false, isComparing: false },
    { id: 2, val: 2, slot: 2, isLifted: false, isSorted: false, isComparing: false },
    { id: 3, val: 7, slot: 3, isLifted: false, isSorted: false, isComparing: false },
    { id: 4, val: 5, slot: 4, isLifted: false, isSorted: false, isComparing: false },
    { id: 5, val: 4, slot: 5, isLifted: false, isSorted: false, isComparing: false },
    { id: 6, val: 1, slot: 6, isLifted: false, isSorted: false, isComparing: false },
    { id: 7, val: 6, slot: 7, isLifted: false, isSorted: false, isComparing: false },
  ]);

  // Crane Mechanics States
  const [craneSlot, setCraneSlot] = useState<number>(0);
  const [wireHeight, setWireHeight] = useState<number>(14);
  const [isClawClosed, setIsClawClosed] = useState<boolean>(false);
  const [actionPrompt, setActionPrompt] = useState<string>('a[0] > a[1] ?');
  const [activeCodeLine, setActiveCodeLine] = useState<number>(6);

  const developerName = 'Nadim Anwar';
  const appVersion = APP_VERSION || 'v1.0.1';

  const SLOT_WIDTH = 40; 
  const RIG_LEFT_PAD = 14;

  useEffect(() => {
    let isCancelled = false;
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

    // 10.0 Seconds Precise Loop
    const runFastTenSecondSort = async () => {
      let state = [
        { id: 0, val: 3 },
        { id: 1, val: 8 },
        { id: 2, val: 2 },
        { id: 3, val: 7 },
        { id: 4, val: 5 },
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

          // ── 1. Crane arrives & compares ──
          setCraneSlot(i);
          setWireHeight(14);
          setIsClawClosed(false);
          setActiveCodeLine(6);
          setActionPrompt(`a[${i}] > a[${i + 1}] ?`);

          syncBlocks({
            [itemA.id]: { isComparing: true, isLifted: false },
            [itemB.id]: { isComparing: true, isLifted: false },
          });

          await sleep(75);
          if (isCancelled) return;

          // ── 2. Swap sequence with visible lift & carry ──
          if (itemA.val > itemB.val) {
            setActiveCodeLine(7);
            setActionPrompt(`swap a[${i}], a[${i + 1}]`);

            // Cable descends over Block A
            setWireHeight(68);
            await sleep(60);
            if (isCancelled) return;

            // Claws grip Block A
            setIsClawClosed(true);
            await sleep(45);
            if (isCancelled) return;

            // Lift Block A up into the air
            setWireHeight(14);
            syncBlocks({
              [itemA.id]: { isLifted: true, isComparing: false },
              [itemB.id]: { isComparing: false },
            });
            await sleep(95);
            if (isCancelled) return;

            // Crane carries Block A to next slot / Block B slides left
            setCraneSlot(i + 1);

            const temp = state[i];
            state[i] = state[i + 1];
            state[i + 1] = temp;

            syncBlocks({
              [itemA.id]: { isLifted: true, isComparing: false },
              [itemB.id]: { isComparing: false, isLifted: false },
            });
            await sleep(110);
            if (isCancelled) return;

            // Cable lowers Block A down
            setWireHeight(68);
            await sleep(60);
            if (isCancelled) return;

            // Release claw
            setIsClawClosed(false);
            syncBlocks({
              [itemA.id]: { isLifted: false, isComparing: false },
              [itemB.id]: { isComparing: false, isLifted: false },
            });
            await sleep(40);
            if (isCancelled) return;

            setWireHeight(14);
            swappedAny = true;
          } else {
            // No swap needed
            syncBlocks({
              [itemA.id]: { isComparing: false },
              [itemB.id]: { isComparing: false },
            });
            await sleep(30);
          }

          stepsCompleted++;
          setProgress(Math.min(Math.floor((stepsCompleted / totalComparisons) * 96), 96));
        }

        // Mark current sorted block as green
        const sortedId = state[n - 1 - p].id;
        setBlocks(prev =>
          prev.map(b => (b.id === sortedId ? { ...b, isSorted: true } : b))
        );

        if (!swappedAny) break;
      }

      // ── Finish & Sorted State ──
      setBlocks(prev => prev.map(b => ({ ...b, isSorted: true, isComparing: false, isLifted: false })));
      setActionPrompt('sorted!');
      setActiveCodeLine(10);
      setCraneSlot(3.5);
      setWireHeight(14);
      setProgress(100);

      // Brief finish pause before transition
      await sleep(300);
      if (!isCancelled) onCompleteRef.current();
    };

    runFastTenSecondSort();
    return () => { isCancelled = true; };
  }, []);

  const codeRows = [
    { num: 1, kw: 'def', rest: ' bubble_sort(a):' },
    { num: 2, kw: '    n =', rest: ' len(a)' },
    { num: 3, kw: '    for', rest: ' p in range(n - 1):' },
    { num: 4, kw: '        swapped =', rest: ' False' },
    { num: 5, kw: '        for', rest: ' i in range(n - 1 - p):' },
    { num: 6, kw: '            if', rest: ' a[i] > a[i + 1]:' },
    { num: 7, kw: '                a[i], a[i + 1] =', rest: ' a[i + 1], a[i]' },
    { num: 8, kw: '                swapped =', rest: ' True' },
    { num: 9, kw: '        if not', rest: ' swapped:' },
    { num: 10, kw: '            break', rest: '' },
  ];

  return (
    <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-[#040813] text-white select-none px-4 py-4 font-sans overflow-hidden">
      
      {/* ── ISOMETRIC GRID BACKGROUND ── */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(0, 229, 255, 0.1) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(0, 229, 255, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '24px 24px'
        }}
      />

      {/* ── COMPACT MAIN CARD CONTAINER ── */}
      <div className="relative z-10 w-full max-w-[360px] flex flex-col items-center gap-3">
        
        {/* ── APP NAME LOGO & BADGES ── */}
        <div className="flex flex-col items-center">
          {/* IIC 3D Gradient Text Logo */}
          <h1 className="text-4xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-400 drop-shadow-[0_0_20px_rgba(6,182,212,0.6)]">
            IIC
          </h1>

          {/* Badges */}
          <div className="flex items-center gap-2 mt-1.5">
            <div className="px-2.5 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-[10px] font-mono font-bold text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.25)]">
              ⚙ BUBBLE SORT
            </div>
            <div className="px-2.5 py-0.5 rounded-full bg-indigo-950/80 border border-indigo-500/40 text-[10px] font-mono font-bold text-indigo-300 shadow-[0_0_10px_rgba(99,102,241,0.25)]">
              O(n²)
            </div>
          </div>
        </div>

        {/* ── MECHANICAL 3D GANTRY CRANE STAGE ── */}
        <div className="relative w-full h-[225px] rounded-2xl bg-[#060c1d]/95 border border-cyan-500/35 shadow-[0_0_35px_rgba(2,132,199,0.25)] p-2.5 overflow-hidden">
          
          {/* Tech Corner Accents */}
          <div className="absolute top-1.5 left-1.5 w-3 h-3 border-t-2 border-l-2 border-cyan-400" />
          <div className="absolute top-1.5 right-1.5 w-3 h-3 border-t-2 border-r-2 border-cyan-400" />
          <div className="absolute bottom-1.5 left-1.5 w-3 h-3 border-b-2 border-l-2 border-cyan-400" />
          <div className="absolute bottom-1.5 right-1.5 w-3 h-3 border-b-2 border-r-2 border-cyan-400" />

          {/* Steel Pillars */}
          <div className="absolute top-3 left-2.5 bottom-5 w-1.5 bg-slate-700 rounded-full border border-slate-600 shadow-md" />
          <div className="absolute top-3 right-2.5 bottom-5 w-1.5 bg-slate-700 rounded-full border border-slate-600 shadow-md" />

          {/* Top Crane Track */}
          <div className="absolute top-3.5 left-3 right-3 h-2 bg-slate-800 rounded-full border border-cyan-500/40 shadow-inner flex items-center">
            
            {/* LARGE CRANE TROLLEY & CLAW */}
            <div 
              className="absolute -top-2 w-11 h-6 rounded-md bg-gradient-to-b from-cyan-400 to-cyan-700 border border-white shadow-[0_0_18px_#06b6d4] transition-all duration-150 ease-out flex flex-col items-center z-40 -ml-1.5"
              style={{ 
                transform: `translateX(${RIG_LEFT_PAD + craneSlot * SLOT_WIDTH}px)` 
              }}
            >
              {/* Dual Heavy Cables */}
              <div 
                className="w-4 flex justify-between transition-all duration-100 ease-out"
                style={{ height: `${wireHeight}px` }}
              >
                <div className="w-0.5 bg-cyan-200 shadow-[0_0_8px_#22d3ee] h-full" />
                <div className="w-0.5 bg-cyan-200 shadow-[0_0_8px_#22d3ee] h-full" />
              </div>

              {/* HEAVY-DUTY CLAW HEAD */}
              <div className="relative -mt-1 flex items-center justify-center">
                <div className={`w-9 h-3 rounded-t-md border-2 ${isClawClosed ? 'bg-amber-400 border-amber-100 scale-95' : 'bg-cyan-500 border-cyan-200'} transition-all flex justify-between px-0.5 shadow-md`}>
                  {/* Left Grip Arm */}
                  <div className={`w-1.5 h-7 rounded-b-md ${isClawClosed ? 'bg-amber-300 rotate-[18deg] shadow-[0_0_10px_#fbbf24]' : 'bg-cyan-300 -rotate-[16deg]'} transition-all origin-top-left`} />
                  {/* Right Grip Arm */}
                  <div className={`w-1.5 h-7 rounded-b-md ${isClawClosed ? 'bg-amber-300 -rotate-[18deg] shadow-[0_0_10px_#fbbf24]' : 'bg-cyan-300 rotate-[16deg]'} transition-all origin-top-right`} />
                </div>
              </div>
            </div>

          </div>

          {/* 3D Platform Floor Shadow */}
          <div className="absolute bottom-2.5 left-3 right-3 h-3 rounded-full bg-slate-900 border-t border-cyan-950/70 blur-[1px]" />

          {/* ── 3D NUMBERED BLOCKS ── */}
          <div className="relative w-full h-full pt-12 px-1">
            {blocks.map((block) => {
              const barHeight = block.val * 10 + 20;
              const posX = RIG_LEFT_PAD + block.slot * SLOT_WIDTH;

              let colorClass = 'bg-slate-700/90 border-slate-600 text-slate-300 shadow-md';
              if (block.isSorted) {
                colorClass = 'bg-emerald-500 border-emerald-300 text-black font-black shadow-[0_0_20px_rgba(16,185,129,0.95)]';
              } else if (block.isLifted) {
                colorClass = 'bg-gradient-to-t from-amber-500 via-amber-400 to-yellow-200 border-yellow-100 text-black font-black shadow-[0_0_30px_rgba(245,158,11,1)] scale-105';
              } else if (block.isComparing) {
                colorClass = 'bg-cyan-500 border-cyan-300 text-black font-black shadow-[0_0_16px_rgba(6,182,212,0.9)] -translate-y-1';
              }

              return (
                <React.Fragment key={block.id}>
                  {/* Ground Shadow while lifted */}
                  {block.isLifted && (
                    <div 
                      className="absolute bottom-3.5 w-7 h-2 rounded-full bg-cyan-950/80 border border-cyan-500/40 blur-[1px] transition-all duration-150"
                      style={{ left: `${posX}px` }}
                    />
                  )}

                  {/* 3D Block */}
                  <div
                    className={`absolute bottom-3.5 w-7 rounded-t-lg border flex flex-col items-center justify-start pt-1 font-mono text-xs font-bold transition-all duration-150 ease-out ${colorClass}`}
                    style={{
                      left: `${posX}px`,
                      height: `${barHeight}px`,
                      transform: block.isLifted ? 'translateY(-72px)' : 'translateY(0px)',
                      zIndex: block.isLifted ? 50 : 10,
                    }}
                  >
                    <span>{block.val}</span>
                  </div>
                </React.Fragment>
              );
            })}
          </div>

        </div>

        {/* Dynamic Action Prompt (No Extra Vertical Gap) */}
        <div className="flex items-center justify-center h-5">
          {actionPrompt === 'sorted!' ? (
            <div className="flex items-center gap-1.5 text-emerald-400 font-mono font-bold text-xs tracking-wider animate-pulse">
              <Check size={14} className="text-emerald-400" />
              <span>sorted!</span>
            </div>
          ) : (
            <span className="font-mono text-xs text-cyan-300 font-bold tracking-wide">
              {actionPrompt}
            </span>
          )}
        </div>

        {/* ── PYTHON CODE SNIPPET BOX ── */}
        <div className="w-full rounded-xl bg-[#02050f]/95 border border-cyan-950/80 p-2.5 shadow-inner">
          <div className="font-mono text-[10.5px] leading-snug space-y-0.5">
            {codeRows.map((line) => {
              const isActive = activeCodeLine === line.num;
              return (
                <div 
                  key={line.num} 
                  className={`flex items-center gap-3 px-2 py-0.5 rounded transition-all duration-75 ${
                    isActive 
                      ? 'bg-cyan-950/90 border border-cyan-500/60 text-cyan-300 font-bold shadow-[0_0_10px_rgba(6,182,212,0.3)]' 
                      : 'text-slate-500'
                  }`}
                >
                  <span className="w-4 text-right text-slate-600 select-none text-[9.5px]">{line.num}</span>
                  <span className={isActive ? 'text-cyan-200' : 'text-slate-400'}>
                    <span className="text-pink-400">{line.kw}</span>
                    <span>{line.rest}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── FOOTER PROGRESS BAR & METADATA ── */}
        <div className="w-full mt-1">
          <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-cyan-950/50 mb-1.5">
            <div 
              className="h-full bg-gradient-to-r from-cyan-400 via-blue-500 to-emerald-400 rounded-full transition-all duration-75 shadow-[0_0_10px_#22d3ee]"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10.5px] font-mono text-slate-400 px-1">
            <span className="text-cyan-400 font-bold">{progress}%</span>
            <span className="text-slate-500">Dev: {developerName}</span>
            <span className="text-slate-500">{appVersion}</span>
          </div>
        </div>

      </div>

    </div>
  );
};

export default AppLoadingScreen;

