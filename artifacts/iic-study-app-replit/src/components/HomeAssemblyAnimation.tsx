import React, { useState, useEffect, useRef } from 'react';
import { FastForward, ShieldCheck, Mail, ShoppingBag, Sparkles } from 'lucide-react';
import { User, AppSettings } from '../types';
import { hapticLight, hapticMedium, hapticStrong } from '../utils/haptic';

interface HomeAssemblyAnimationProps {
  user: User;
  settings?: AppSettings;
  onSoulTouch?: () => void;
  onComplete: () => void;
}

interface OrbitToolItem {
  id: string;
  title: string;
  emoji: string;
  bgGrad: string;
  borderGlow: string;
}

const ORBIT_TOOLS: OrbitToolItem[] = [
  { id: 'MESSENGER', title: 'Nsta Messenger', emoji: '💬', bgGrad: 'linear-gradient(135deg, #ec4899, #8b5cf6)', borderGlow: '#ec4899' },
  { id: 'VIDEO',     title: 'Video Lectures', emoji: '▶️', bgGrad: 'linear-gradient(135deg, #ef4444, #f97316)', borderGlow: '#ef4444' },
  { id: 'PROGRESS',  title: 'Progress & Stats', emoji: '📊', bgGrad: 'linear-gradient(135deg, #3b82f6, #06b6d4)', borderGlow: '#3b82f6' },
  { id: 'STARRED',   title: 'Important Notes', emoji: '⭐', bgGrad: 'linear-gradient(135deg, #f59e0b, #eab308)', borderGlow: '#f59e0b' },
  { id: 'READING',   title: 'Reading Notes', emoji: '📖', bgGrad: 'linear-gradient(135deg, #10b981, #059669)', borderGlow: '#10b981' },
  { id: 'FLASHCARDS',title: 'Flashcards', emoji: '🃏', bgGrad: 'linear-gradient(135deg, #8b5cf6, #6366f1)', borderGlow: '#8b5cf6' },
  { id: 'OFFLINE',   title: 'Offline Storage', emoji: '💾', bgGrad: 'linear-gradient(135deg, #06b6d4, #0284c7)', borderGlow: '#06b6d4' },
  { id: 'ACTIVITY',  title: 'MCQ Activity', emoji: '📈', bgGrad: 'linear-gradient(135deg, #6366f1, #3b82f6)', borderGlow: '#6366f1' },
  { id: 'CREDITS',   title: 'Credits & Coins', emoji: '💰', bgGrad: 'linear-gradient(135deg, #eab308, #d97706)', borderGlow: '#eab308' },
  { id: 'MISTAKES',  title: 'My Mistakes', emoji: '❌', bgGrad: 'linear-gradient(135deg, #f43f5e, #be123c)', borderGlow: '#f43f5e' },
];

export const HomeAssemblyAnimation: React.FC<HomeAssemblyAnimationProps> = ({
  user,
  settings,
  onSoulTouch,
  onComplete,
}) => {
  // ── NEW STREAMLINED FLOW (EXACT USER SPECIFICATION) ──
  // 1. Circle & Tools assemble (0.0s - 3.2s)
  // 2. Tools fold inward, exact logo travels down to button position and stays (3.2s - 4.8s)
  // 3. Top bar, Greeting & XP, Reading Card, Classes 6-12, Govt Exams (4.8s - 8.2s)
  // 4. My Routine actual size assemble (8.2s - 10.2s) - highlighted in full size
  // 5. Revision Hub actual size assemble (10.2s - 12.2s) - viewport smooth scrolls down
  // 6. Bottom navigation bar docks (12.2s - 14.0s) - viewport smooth scrolls back to top
  // 7. All elements arrive & fully visible (14.0s - 15.0s)
  // 8. "jaise hi pura sari chijhe aajayega apne aap gayab ho jayega animition wala part aur ab main home screen aajayega" (15.0s):
  //    - Animation overlay completely disappears!
  //    - Real main home screen is 100% visible underneath!
  // 9. "aur home screen ke bich me dot dikhega phir aur ishke charo or ek ring hoga chamakta hua" (15.2s - 16.8s):
  //    - In the middle of the real home screen, a radiant Dot appears with a glowing, sparkling ring around it!
  // 10. "ye dot ja ke nsta me lagega" (16.8s - 18.0s):
  //    - Dot takes flight from center and travels up to the Top Bar Main NSTA!
  // 11. "nsta animate hoga kuchh der phir sab khatam" (18.0s - 19.8s):
  //    - Dot hits NSTA, triggers soul infusion; main NSTA animates with golden glow & color change for a moment!
  //    - At 19.8s, animation finishes completely and cleanly!
  const TOTAL_DURATION = 19800;

  const [progress, setProgress] = useState(0); // in ms
  const [isSkipped, setIsSkipped] = useState(false);
  const startTimeRef = useRef<number>(Date.now());
  const animReqRef = useRef<number | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const officialLogo = (settings?.appLogo && !settings.appLogo.includes('placeholder'))
    ? settings.appLogo
    : '/branding/nsta-logo.svg';

  const studentDisplayName = user?.name || user?.displayName || 'Nadim Anwar';

  // Coordinates of Top Bar Main NSTA
  const [mainNstaCoords, setMainNstaCoords] = useState<{ x: number; y: number }>({ x: 65, y: 30 });

  useEffect(() => {
    const updateTargetCoords = () => {
      const el = document.getElementById('nsta-header-brand-btn');
      if (el) {
        const rect = el.getBoundingClientRect();
        setMainNstaCoords({
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        });
      }
    };

    updateTargetCoords();
    window.addEventListener('resize', updateTargetCoords);
    return () => window.removeEventListener('resize', updateTargetCoords);
  }, []);

  useEffect(() => {
    startTimeRef.current = Date.now();

    const updateFrame = () => {
      const elapsed = Date.now() - startTimeRef.current;
      setProgress(elapsed);

      if (elapsed >= TOTAL_DURATION) {
        hapticStrong();
        onComplete();
      } else {
        animReqRef.current = requestAnimationFrame(updateFrame);
      }
    };

    animReqRef.current = requestAnimationFrame(updateFrame);

    return () => {
      if (animReqRef.current) cancelAnimationFrame(animReqRef.current);
    };
  }, [onComplete]);

  // Haptics & Events
  const hapticPlayedRef = useRef<Record<string, boolean>>({});
  useEffect(() => {
    const sec = progress / 1000;
    if (sec >= 2.8 && !hapticPlayedRef.current['complete']) {
      hapticPlayedRef.current['complete'] = true;
      hapticMedium();
    }
    if (sec >= 3.4 && !hapticPlayedRef.current['close']) {
      hapticPlayedRef.current['close'] = true;
      hapticLight();
    }
    if (sec >= 4.7 && !hapticPlayedRef.current['docked']) {
      hapticPlayedRef.current['docked'] = true;
      hapticMedium();
    }
    if (sec >= 8.3 && !hapticPlayedRef.current['routine']) {
      hapticPlayedRef.current['routine'] = true;
      hapticLight();
    }
    if (sec >= 10.3 && !hapticPlayedRef.current['rev_hub']) {
      hapticPlayedRef.current['rev_hub'] = true;
      hapticLight();
    }
    if (sec >= 12.3 && !hapticPlayedRef.current['bottom_nav']) {
      hapticPlayedRef.current['bottom_nav'] = true;
      hapticLight();
    }
    // Middle dot appears with shining ring at 15.2s
    if (sec >= 15.2 && !hapticPlayedRef.current['dot_ring_appear']) {
      hapticPlayedRef.current['dot_ring_appear'] = true;
      hapticMedium();
    }
    // Dot flies at 16.8s
    if (sec >= 16.8 && !hapticPlayedRef.current['dot_fly']) {
      hapticPlayedRef.current['dot_fly'] = true;
      hapticLight();
    }
    // Dot hits main NSTA at 18.0s -> NSTA animates!
    if (sec >= 18.0 && !hapticPlayedRef.current['nsta_hit']) {
      hapticPlayedRef.current['nsta_hit'] = true;
      if (onSoulTouch) onSoulTouch();
      hapticStrong();
    }
  }, [progress, onSoulTouch]);

  // Smooth Viewport Auto-Scroll
  // 8.0s - 12.0s: Smooth scroll down to highlight Revision Hub & Routine at full size
  // 12.2s - 13.8s: Smooth scroll back to top so user sees the full assembled layout
  useEffect(() => {
    const sec = progress / 1000;
    if (scrollContainerRef.current) {
      if (sec >= 8.0 && sec < 12.2) {
        const p = Math.min(1, (sec - 8.0) / 2.8);
        const ease = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        scrollContainerRef.current.scrollTop = ease * 420;
      } else if (sec >= 12.2 && sec < 13.8) {
        const p = Math.min(1, (sec - 12.2) / 1.4);
        const ease = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        scrollContainerRef.current.scrollTop = 420 * (1 - ease);
      } else if (sec >= 13.8) {
        scrollContainerRef.current.scrollTop = 0;
      }
    }
  }, [progress]);

  const handleSkip = () => {
    setIsSkipped(true);
    hapticMedium();
    if (animReqRef.current) cancelAnimationFrame(animReqRef.current);
    if (onSoulTouch) onSoulTouch();
    onComplete();
  };

  if (isSkipped) return null;

  const sec = progress / 1000;

  // ── 1. CIRCLE ASSEMBLY (0.0s to 3.2s) ──
  const logoInitialScale = sec < 0.2 ? 0 : Math.min(1, (sec - 0.2) / 0.5);
  const orbitRingOpacity = sec < 0.5 ? 0 : Math.min(1, (sec - 0.5) / 0.4);

  const getToolProgress = (index: number) => {
    const itemStart = 0.5 + index * 0.18;
    if (sec < itemStart) return 0;
    return Math.min(1, (sec - itemStart) / 0.22);
  };
  const orbitAngleOffset = sec > 0.5 ? (sec - 0.5) * 14 : 0;
  const isCircleComplete = sec >= 2.6 && sec < 3.2;

  // ── 2. TOOLS FOLD IN & LOGO TRAVELS (3.2s to 4.8s) ──
  const isFolding = sec >= 3.2 && sec < 3.9;
  const foldProg = sec < 3.2 ? 0 : Math.min(1, (sec - 3.2) / 0.7);

  const isLogoTraveling = sec >= 3.9 && sec < 4.8;
  const isLogoDocked = sec >= 4.8;
  const rawTravelProg = isLogoDocked ? 1 : isLogoTraveling ? (sec - 3.9) / 0.9 : 0;
  
  const easeLogoTravel = rawTravelProg < 0.5
    ? 4 * rawTravelProg * rawTravelProg * rawTravelProg
    : 1 - Math.pow(-2 * rawTravelProg + 2, 3) / 2;

  // ── 3. HOME PAGE ELEMENTS ASSEMBLE (4.8s to 14.0s) ──
  const topBarProg = sec < 4.8 ? 0 : Math.min(1, (sec - 4.8) / 0.7);
  const profileProg = sec < 5.4 ? 0 : Math.min(1, (sec - 5.4) / 0.7);
  const readingProg = sec < 6.0 ? 0 : Math.min(1, (sec - 6.0) / 0.7);
  const classProg = sec < 6.6 ? 0 : Math.min(1, (sec - 6.6) / 0.7);
  const govtExamsProg = sec < 7.3 ? 0 : Math.min(1, (sec - 7.3) / 0.7);

  // My Routine (8.2s - 10.2s)
  const routineProg = sec < 8.2 ? 0 : Math.min(1, (sec - 8.2) / 0.8);
  const isRoutineAssembling = sec >= 8.2 && sec < 10.2;

  // Revision Hub (10.2s - 12.2s)
  const revisionProg = sec < 10.2 ? 0 : Math.min(1, (sec - 10.2) / 0.8);
  const isRevisionAssembling = sec >= 10.2 && sec < 12.2;

  // Bottom Navigation Bar (12.2s - 14.0s)
  const bottomNavProg = sec < 12.2 ? 0 : Math.min(1, (sec - 12.2) / 0.8);
  const isBottomNavAssembling = sec >= 12.2 && sec < 14.0;

  // ── 4. "jaise hi pura sari chijhe aajayega apne aap gayab ho jayega animition wala part aur ab main home screen aajayega" ──
  // At 14.8s - 15.2s, the mock animation overlay simply fades away to transparent, revealing the real home screen!
  const isAnimationFading = sec >= 14.8;
  const mockFadeOutProg = sec < 14.8 ? 0 : Math.min(1, (sec - 14.8) / 0.4);
  const isAnimationCompletelyGone = sec >= 15.2;

  // ── 5. "home screen ke bich me dot dikhega phir aur ishke charo or ek ring hoga chamakta hua" (15.2s - 16.8s) ──
  const showCenterDotAndRing = sec >= 15.2 && sec < 18.0;
  const centerDotAppearProg = sec < 15.2 ? 0 : Math.min(1, (sec - 15.2) / 0.5);

  // ── 6. "ye dot ja ke nsta me lagega aur nsta animate hoga kuchh der phir sab khatam" (16.8s - 19.8s) ──
  const isDotFlying = sec >= 16.8 && sec < 18.0;
  const flightProg = sec < 16.8 ? 0 : Math.min(1, (sec - 16.8) / 1.1);
  const flightEase = flightProg < 0.5 
    ? 2 * flightProg * flightProg 
    : 1 - Math.pow(-2 * flightProg + 2, 2) / 2;

  const hasHitNsta = sec >= 18.0;
  const hitImpactProg = sec < 18.0 ? 0 : Math.min(1, (sec - 18.0) / 1.8);

  // Dynamic status text
  let statusText = 'Assembling Circular Orbit...';
  if (sec < 2.6) statusText = 'Assembling 10 Satellite Tools Around NSTA...';
  else if (sec < 3.2) statusText = '✨ Circle Complete!';
  else if (sec < 3.9) statusText = 'Tools Folding Inward...';
  else if (sec < 4.8) statusText = '🚀 Moving Logo to Circular Button Dock...';
  else if (sec < 6.6) statusText = 'Assembling Top Bar, XP Level & Classes 6-12...';
  else if (sec < 8.2) statusText = 'Assembling Govt. Exams...';
  else if (sec < 10.2) statusText = '📅 Assembling My Routine (Timetable & Habit Streak)...';
  else if (sec < 12.2) statusText = '🧠 Assembling Revision Hub (Spaced Repetition & AI)...';
  else if (sec < 14.0) statusText = '📱 Assembling Bottom Navigation Bar...';
  else if (sec < 15.2) statusText = '✨ All Elements Assembled! Revealing Real Home Screen...';
  else if (sec < 16.8) statusText = '🌟 Radiant Soul Dot Appearing at Screen Center...';
  else if (sec < 18.0) statusText = '⚡ Soul Dot Flying to Main Homepage NSTA...';
  else statusText = '🌟 Main NSTA Animating with Soul Infusion!';

  return (
    <div 
      id="home-assembly-cinematic-screen"
      className="fixed inset-0 z-[99999] text-white flex flex-col justify-between overflow-hidden select-none font-sans transition-colors duration-300"
      style={{
        backgroundColor: isAnimationCompletelyGone ? 'transparent' : undefined,
        background: !isAnimationCompletelyGone 
          ? `radial-gradient(ellipse at 50% 25%, rgba(13, 23, 51, ${1 - mockFadeOutProg}) 0%, rgba(6, 10, 23, ${1 - mockFadeOutProg}) 65%, rgba(2, 4, 10, ${1 - mockFadeOutProg}) 100%)`
          : 'transparent',
        pointerEvents: isAnimationCompletelyGone ? 'none' : 'auto',
      }}
    >
      {/* ── TOP HUD CONTROLS (Only while mock animation is assembling) ── */}
      {!isAnimationCompletelyGone && (
        <div 
          className="relative z-50 px-4 pt-3 pb-2 flex items-center justify-between border-b border-white/10 bg-[#070b19]/90 backdrop-blur-md shrink-0 transition-opacity duration-300"
          style={{ opacity: 1 - mockFadeOutProg }}
        >
          <div className="flex items-center gap-2 min-w-0 pr-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
            <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-indigo-300 truncate">
              {statusText}
            </span>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <span className="text-[10px] font-mono font-bold text-slate-400">
              {Math.min(100, Math.round((progress / TOTAL_DURATION) * 100))}%
            </span>
            <button
              type="button"
              id="btn-skip-home-assembly"
              onClick={handleSkip}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 border border-white/20 text-white text-xs font-bold transition shadow-lg backdrop-blur-md cursor-pointer pointer-events-auto"
            >
              <span>Skip</span>
              <FastForward size={13} className="text-amber-400" />
            </button>
          </div>
        </div>
      )}

      {/* Linear progress bar */}
      {!isAnimationCompletelyGone && (
        <div 
          className="w-full h-1 bg-white/5 relative overflow-hidden shrink-0 transition-opacity duration-300"
          style={{ opacity: 1 - mockFadeOutProg }}
        >
          <div 
            className="h-full bg-gradient-to-r from-blue-600 via-indigo-500 via-amber-400 to-yellow-300 transition-all duration-75"
            style={{ width: `${Math.min(100, (progress / TOTAL_DURATION) * 100)}%` }}
          />
        </div>
      )}

      {/* ── CENTRAL STAGE VIEWPORT (Mock Assembly Part) ── */}
      {/* "jaise hi pura sari chijhe aajayega apne aap gayab ho jayega animition wala part aur ab main home screen aajayega" */}
      {!isAnimationCompletelyGone && (
        <div 
          className="relative flex-1 w-full max-w-lg mx-auto overflow-hidden flex flex-col justify-start transition-opacity duration-400"
          style={{
            opacity: 1 - mockFadeOutProg,
          }}
        >
          {/* ── 1. CIRCLE & TRAVELING LOGO (0.0s to 4.8s) ── */}
          {sec < 4.8 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
              {isLogoTraveling && (
                <div 
                  className="absolute pointer-events-none rounded-full blur-xl bg-gradient-to-tr from-amber-400/50 via-yellow-400/30 to-indigo-500/30"
                  style={{
                    width: `${140 * (1 - easeLogoTravel * 0.4)}px`,
                    height: `${140 * (1 - easeLogoTravel * 0.4)}px`,
                    transform: `translate(${easeLogoTravel * 60}px, ${easeLogoTravel * 140}px)`,
                    opacity: 1 - easeLogoTravel * 0.4,
                  }}
                />
              )}

              <div className="relative w-[340px] h-[340px] flex items-center justify-center">
                <div 
                  className="absolute inset-0 rounded-full border-2 border-dashed border-indigo-400/50 transition-all duration-500"
                  style={{
                    opacity: isFolding || isLogoTraveling 
                      ? Math.max(0, 1 - foldProg * 1.5) 
                      : orbitRingOpacity,
                    transform: `rotate(${orbitAngleOffset}deg) scale(${1 - foldProg * 0.3})`,
                    boxShadow: isCircleComplete 
                      ? '0 0 50px rgba(245, 158, 11, 0.6), inset 0 0 40px rgba(99, 102, 241, 0.4)'
                      : '0 0 35px rgba(99, 102, 241, 0.25)',
                  }}
                />

                {isCircleComplete && (
                  <div className="absolute -top-7 z-40 px-3.5 py-1 rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black text-[11px] shadow-lg flex items-center gap-1.5 animate-bounce border border-amber-300">
                    <Sparkles size={13} className="text-white" />
                    <span>Circle Complete! Folding In...</span>
                  </div>
                )}

                {!isLogoTraveling && ORBIT_TOOLS.map((tool, idx) => {
                  const toolProg = getToolProgress(idx);
                  if (toolProg <= 0) return null;

                  const baseAngle = (idx * 36) - 90;
                  const currentAngle = (baseAngle + orbitAngleOffset) * (Math.PI / 180);
                  const currentRadius = 138 * toolProg * (1 - foldProg);

                  const posX = Math.cos(currentAngle) * currentRadius;
                  const posY = Math.sin(currentAngle) * currentRadius;

                  const badgeScale = (1 - foldProg) * (toolProg < 0.7 ? toolProg * 1.2 : 1.0);
                  const badgeOpacity = (1 - foldProg) * Math.min(1, toolProg * 1.5);

                  return (
                    <div
                      key={tool.id}
                      className="absolute flex flex-col items-center justify-center transition-transform"
                      style={{
                        left: `calc(50% + ${posX}px)`,
                        top: `calc(50% + ${posY}px)`,
                        transform: `translate(-50%, -50%) scale(${badgeScale})`,
                        opacity: badgeOpacity,
                      }}
                    >
                      <div 
                        className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center text-lg sm:text-xl shadow-lg border border-white/30"
                        style={{
                          background: tool.bgGrad,
                          boxShadow: `0 4px 14px ${tool.borderGlow}66`,
                        }}
                      >
                        {tool.emoji}
                      </div>
                      {foldProg < 0.3 && (
                        <span className="text-[9px] font-bold text-white tracking-tight mt-1 whitespace-nowrap drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] bg-slate-950/80 px-2 py-0.5 rounded-full border border-white/10">
                          {tool.title}
                        </span>
                      )}
                    </div>
                  );
                })}

                {!isLogoDocked && (
                  <div 
                    className="relative z-30 transition-none"
                    style={{
                      transform: isLogoTraveling 
                        ? `translate(${easeLogoTravel * 135}px, ${easeLogoTravel * 265}px) scale(${1 - easeLogoTravel * 0.45})`
                        : `scale(${logoInitialScale})`,
                    }}
                  >
                    <div 
                      className="w-22 h-22 sm:w-24 sm:h-24 rounded-full p-1 bg-gradient-to-tr from-amber-400 via-yellow-200 to-amber-500 shadow-2xl flex items-center justify-center"
                      style={{
                        boxShadow: isCircleComplete 
                          ? '0 0 60px rgba(245, 158, 11, 0.8)' 
                          : '0 0 45px rgba(245, 158, 11, 0.45)',
                      }}
                    >
                      <div className="w-full h-full rounded-full bg-white flex items-center justify-center p-2.5 overflow-hidden shadow-inner">
                        <img 
                          src={officialLogo} 
                          alt="NSTA Logo" 
                          className="w-full h-full object-contain drop-shadow"
                        />
                      </div>
                    </div>

                    {sec >= 0.5 && !isLogoTraveling && (
                      <div 
                        className="absolute -inset-1.5 rounded-full border-2 border-amber-300/80 border-t-transparent animate-spin"
                        style={{ animationDuration: '2.5s' }}
                      />
                    )}
                  </div>
                )}

              </div>
            </div>
          )}

          {/* ── 2. THE EXACT TRAVELING BUTTON LANDS & STAYS HERE ── */}
          {isLogoDocked && (
            <div 
              className="fixed bottom-[76px] right-3 sm:right-6 z-[450] pointer-events-auto flex items-center gap-2"
            >
              <div 
                className="relative flex items-center justify-center w-14 h-14 sm:w-15 sm:h-15 rounded-full shadow-2xl p-1 animate-in zoom-in-95 duration-200"
                style={{
                  background: 'radial-gradient(circle, #0f172a 0%, #020617 100%)',
                  border: '2.5px solid rgba(251, 191, 36, 0.9)',
                  boxShadow: '0 8px 25px -2px rgba(124, 58, 237, 0.55), 0 0 16px rgba(251, 191, 36, 0.45)',
                }}
              >
                <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center bg-slate-900/90">
                  <img 
                    src={officialLogo} 
                    alt="NSTA Quick Wheel" 
                    className="w-full h-full object-contain p-1"
                  />
                </div>
                <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-slate-900 animate-pulse" />
              </div>
            </div>
          )}

          {/* ── 3. HOME PAGE DASHBOARD ASSEMBLY ── */}
          <div 
            ref={scrollContainerRef}
            className="w-full h-full px-3.5 pt-2 pb-28 flex flex-col gap-3.5 overflow-y-auto transition-opacity duration-500 custom-scrollbar relative"
            style={{
              opacity: sec < 4.7 ? 0 : 1,
            }}
          >
            {/* Top Bar Header (Real Size) */}
            <div 
              className="flex items-center justify-between px-3 sm:px-4 py-2.5 rounded-2xl bg-[#0a0f1d] border border-white/10 shadow-lg transition-all duration-500 ease-out shrink-0 w-full"
              style={{
                transform: `translateY(${(1 - topBarProg) * -20}px)`,
                opacity: topBarProg,
              }}
            >
              {/* LEFT: exact Logo + NSTA title + Verified Badge */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="relative shrink-0">
                  <img
                    src={officialLogo}
                    alt="Logo"
                    className="w-7 h-7 rounded-lg object-contain bg-white/10 p-0.5 border border-white/20 shadow-sm"
                  />
                </div>
                <span className="font-black text-[20px] sm:text-[23px] leading-tight tracking-tight uppercase text-white">
                  {settings?.appShortName || settings?.appName || "NSTA"}
                </span>
                <span className="text-blue-400 shrink-0">
                  <ShieldCheck size={18} className="inline text-blue-400" />
                </span>
              </div>

              {/* RIGHT: real header action items */}
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <div className="px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-400/30 text-[10px] font-black text-amber-300 flex items-center gap-1 shadow-xs">
                  <span>🚀 Score Boost</span>
                </div>
                <div className="relative p-1.5 rounded-full bg-white/5 border border-white/10 text-slate-200">
                  <Mail size={16} />
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-[9px] font-black text-white flex items-center justify-center shadow-xs">5</span>
                </div>
                <div className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-black text-emerald-400 flex items-center gap-1 shadow-xs">
                  <ShoppingBag size={13} /> Store VIP
                </div>
              </div>
            </div>

            {/* User Greeting & XP Level */}
            <div 
              className="flex items-center justify-between px-4 py-3 rounded-2xl bg-[#0d172e] border border-white/10 text-xs transition-all duration-500 ease-out shadow-md shrink-0"
              style={{
                transform: `translateX(${(1 - profileProg) * -30}px)`,
                opacity: profileProg,
              }}
            >
              <span className="font-bold text-slate-100 truncate pr-2 text-sm sm:text-base">
                Hey, {studentDisplayName} 👋
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-24 sm:w-28 h-2.5 bg-slate-800 rounded-full overflow-hidden border border-white/10">
                  <div 
                    className="h-full bg-gradient-to-r from-amber-400 to-yellow-500 rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(100, Math.max(15, profileProg * 65))}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-amber-300 font-bold">Lv 1</span>
              </div>
            </div>

            {/* Continue Reading Card */}
            <div 
              className="p-4 rounded-2xl bg-gradient-to-r from-[#0d1633] via-[#0f1d42] to-[#12193b] border border-blue-500/35 transition-all duration-500 ease-out shadow-lg shrink-0"
              style={{
                transform: `scale(${0.92 + 0.08 * readingProg}) translateY(${(1 - readingProg) * 20}px)`,
                opacity: readingProg,
              }}
            >
              <div className="flex items-center justify-between text-[11px] font-bold text-indigo-300 mb-2">
                <span className="flex items-center gap-1.5 font-black uppercase tracking-wider">
                  📖 Continue Reading
                </span>
                <span className="text-[11px] text-indigo-200/70 font-semibold">Resume &gt;</span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <div>
                  <p className="font-black text-base text-white">Lucent General Knowledge</p>
                  <p className="text-[11px] text-slate-300 mt-0.5">Page 1 · 30% Completed</p>
                </div>
                <button 
                  type="button"
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-black text-xs shadow-md"
                >
                  Resume
                </button>
              </div>
            </div>

            {/* ── SELECT YOUR CLASS (REAL SIZE) ── */}
            <div 
              className="space-y-2.5 shrink-0 transition-all duration-500 ease-out"
              style={{ opacity: classProg }}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="flex-1 h-px bg-white/10" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Select Your Class
                </span>
                <span className="flex-1 h-px bg-white/10" />
              </div>

              {/* Row 1: Classes 6, 7, 8, 9 (Real Size) */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { cls: '6', subj: '5 Subj.', icon: '📖' },
                  { cls: '7', subj: '5 Subj.', icon: '🧪' },
                  { cls: '8', subj: '5 Subj.', icon: '🌍' },
                  { cls: '9', subj: '8 Subj.', icon: '📚' },
                ].map((c) => (
                  <div 
                    key={c.cls}
                    className="relative flex flex-col p-2.5 rounded-xl border-2 border-indigo-500/35 bg-[#0d172e] shadow-md text-left transition-all"
                  >
                    <span className="absolute top-1.5 right-1.5 text-sm leading-none opacity-80">{c.icon}</span>
                    <p className="text-[7px] font-black uppercase tracking-widest text-slate-400 mb-0.5">CLASS</p>
                    <p className="text-2xl font-black leading-none mb-1 text-indigo-400">{c.cls}</p>
                    <p className="text-[9px] font-bold leading-tight text-slate-300">{c.subj}</p>
                  </div>
                ))}
              </div>

              {/* Row 2: Classes 10, 11, 12 (Real Size) */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { cls: '10', subj: '8 Subj.', icon: '👑', isBoard: true },
                  { cls: '11', subj: '4 Subj.', icon: '🚀' },
                  { cls: '12', subj: '4 Subj.', icon: '👑', isBoard: true },
                ].map((c) => (
                  <div 
                    key={c.cls}
                    className="relative flex flex-col p-2.5 rounded-xl border-2 border-indigo-500/35 bg-[#0d172e] shadow-md text-left transition-all"
                  >
                    {c.isBoard ? (
                      <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-full text-[7px] font-black bg-amber-400 text-amber-900 leading-none shadow-xs">
                        👑
                      </span>
                    ) : (
                      <span className="absolute top-1.5 right-1.5 text-sm leading-none opacity-80">{c.icon}</span>
                    )}
                    <p className="text-[7px] font-black uppercase tracking-widest text-slate-400 mb-0.5">CLASS</p>
                    <p className="text-2xl font-black leading-none mb-1 text-indigo-400">{c.cls}</p>
                    <p className="text-[9px] font-bold leading-tight text-slate-300">{c.subj}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ── COMPETITIVE · GOVT. EXAMS (REAL SIZE) ── */}
            <div 
              className="space-y-2 shrink-0 transition-all duration-500"
              style={{
                transform: `translateY(${(1 - govtExamsProg) * 20}px)`,
                opacity: govtExamsProg,
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="flex-1 h-px bg-white/10" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Competitive · Govt. Exams
                </span>
                <span className="flex-1 h-px bg-white/10" />
              </div>
              <div 
                className="w-full relative overflow-hidden rounded-2xl text-left bg-gradient-to-br from-[#0f172a] via-[#111d38] to-[#1e293b] border-2 border-blue-500/70 shadow-xl"
              >
                <div className="flex items-center justify-between px-4 py-4">
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider text-blue-400 bg-blue-500/20 border border-blue-500/35">
                        Competitive Mode
                      </span>
                    </div>
                    <h3 className="text-[24px] font-black leading-tight mb-1 text-white">Govt. Exams</h3>
                    <div className="mb-3 flex items-center flex-wrap gap-1.5">
                      <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-white/10 border border-white/10 text-slate-300">
                        📚 7 Books
                      </span>
                      <span className="text-[10px] font-medium text-slate-400">
                        SSC · UPSC · Railway · BPSC · BSSC · Police
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-[11px] font-black text-white bg-blue-600 shadow-md">
                      <span>Tap to open</span>
                      <span>→</span>
                    </span>
                  </div>
                  <div className="text-[56px] leading-none shrink-0 select-none">🏛️</div>
                </div>
              </div>
            </div>

            {/* My Routine (Full Actual Size) - Renders and animates FIRST */}
            <div 
              id="anim-card-my-routine"
              className="w-full relative overflow-hidden rounded-2xl p-4 text-left transition-all duration-700 shadow-xl bg-[#0d172e] shrink-0"
              style={{
                transform: `translateY(${(1 - routineProg) * 35}px) scale(${0.92 + routineProg * 0.08})`,
                opacity: routineProg,
                border: isRoutineAssembling ? '2px solid rgba(96, 165, 250, 0.9)' : '2px solid rgba(59, 130, 246, 0.4)',
                boxShadow: isRoutineAssembling 
                  ? '0 0 30px rgba(59, 130, 246, 0.45), 0 8px 25px rgba(0,0,0,0.5)' 
                  : '0 4px 20px rgba(59, 130, 246, 0.15)',
              }}
            >
              {isRoutineAssembling && (
                <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/30 border border-blue-300 text-blue-200 text-[8px] font-black uppercase tracking-widest animate-pulse">
                  <span>⚡ Assembling Routine</span>
                </div>
              )}

              <div className="space-y-3 w-full">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 text-2xl bg-blue-500/20 border border-blue-400/30 text-blue-400 shadow-sm transition-transform duration-500"
                      style={{
                        transform: isRoutineAssembling ? 'scale(1.1) rotate(-5deg)' : 'scale(1)',
                      }}
                    >
                      📅
                    </div>
                    <div>
                      <h4 className="text-base font-black text-white leading-tight">
                        My Routine
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5 font-medium leading-tight">
                        Daily timetable &amp; study target
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider shrink-0 bg-blue-500/20 text-blue-300 border border-blue-400/35">
                    Daily Planner
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 text-[9px] font-bold pt-0.5">
                  <span className="px-2.5 py-1 rounded-lg bg-white/10 border border-white/10 text-slate-300 transition-all">
                    📅 Daily Timetable
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-white/10 border border-white/10 text-slate-300 transition-all">
                    ⏱️ Study Targets
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-white/10 border border-white/10 text-slate-300 transition-all">
                    🔥 Habit Streak
                  </span>
                </div>
              </div>

              <div className="mt-3.5 pt-2.5 border-t border-white/10 w-full flex items-center justify-between">
                <span className="text-[11px] font-black text-blue-400">
                  Open My Routine →
                </span>
                <span className="w-7 h-7 rounded-xl flex items-center justify-center text-white text-xs font-black bg-gradient-to-r from-blue-600 to-indigo-600 shadow-sm">
                  →
                </span>
              </div>
            </div>

            {/* Revision Hub (Full Actual Size) - Renders and animates SECOND */}
            <div 
              id="anim-card-revision-hub"
              className="w-full relative overflow-hidden rounded-2xl p-4 text-left transition-all duration-700 shadow-xl bg-[#0d172e] shrink-0"
              style={{
                transform: `translateY(${(1 - revisionProg) * 35}px) scale(${0.92 + revisionProg * 0.08})`,
                opacity: revisionProg,
                border: isRevisionAssembling ? '2px solid rgba(192, 132, 252, 0.9)' : '2px solid rgba(168, 85, 247, 0.4)',
                boxShadow: isRevisionAssembling 
                  ? '0 0 30px rgba(168, 85, 247, 0.45), 0 8px 25px rgba(0,0,0,0.5)' 
                  : '0 4px 20px rgba(168, 85, 247, 0.15)',
              }}
            >
              {isRevisionAssembling && (
                <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/30 border border-purple-300 text-purple-200 text-[8px] font-black uppercase tracking-widest animate-pulse">
                  <span>⚡ Assembling Hub</span>
                </div>
              )}

              <div className="space-y-3 w-full">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 text-2xl bg-purple-500/20 border border-purple-400/30 text-purple-400 shadow-sm transition-transform duration-500"
                      style={{
                        transform: isRevisionAssembling ? 'scale(1.1) rotate(5deg)' : 'scale(1)',
                      }}
                    >
                      🧠
                    </div>
                    <div>
                      <h4 className="text-base font-black text-white leading-tight">
                        Revision Hub
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5 font-medium leading-tight">
                        Spaced repetition &amp; memory drill
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider shrink-0 bg-purple-500/20 text-purple-300 border border-purple-400/35">
                    Smart AI
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 text-[9px] font-bold pt-0.5">
                  <span className="px-2.5 py-1 rounded-lg bg-white/10 border border-white/10 text-slate-300 transition-all">
                    🧠 Spaced Repetition
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-white/10 border border-white/10 text-slate-300 transition-all">
                    📝 Quick Notes
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-white/10 border border-white/10 text-slate-300 transition-all">
                    🎯 Weak Area Drill
                  </span>
                </div>
              </div>

              <div className="mt-3.5 pt-2.5 border-t border-white/10 w-full flex items-center justify-between">
                <span className="text-[11px] font-black text-purple-400">
                  Open Revision Hub →
                </span>
                <span className="w-7 h-7 rounded-xl flex items-center justify-center text-white text-xs font-black bg-gradient-to-r from-purple-600 to-indigo-600 shadow-sm">
                  →
                </span>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* ── BOTTOM DOCKED NAVIGATION BAR (Only while mock animation is assembling) ── */}
      {!isAnimationCompletelyGone && (
        <div 
          id="anim-bottom-navigation-bar"
          className="relative z-40 w-full px-6 py-2.5 bg-[#070c1c]/95 border-t backdrop-blur-md flex items-center justify-between text-xs transition-all duration-700 ease-out shrink-0"
          style={{
            transform: `translateY(${(1 - bottomNavProg) * 60}px)`,
            opacity: bottomNavProg * (1 - mockFadeOutProg),
            borderColor: isBottomNavAssembling ? 'rgba(56, 189, 248, 0.6)' : 'rgba(255, 255, 255, 0.1)',
            boxShadow: isBottomNavAssembling 
              ? '0 -8px 25px rgba(56, 189, 248, 0.3)' 
              : '0 -4px 15px rgba(0,0,0,0.4)',
          }}
        >
          <div className="flex flex-col items-center gap-0.5 text-blue-400 font-bold relative">
            <span className="text-base transition-transform duration-300" style={{ transform: isBottomNavAssembling ? 'scale(1.2)' : 'scale(1)' }}>🏠</span>
            <span className="text-[10px]">Home</span>
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_8px_#60a5fa] mt-0.5" />
          </div>
          <div className="flex flex-col items-center gap-0.5 text-slate-400 font-medium">
            <span className="text-base">✨</span>
            <span className="text-[10px]">Pro+</span>
          </div>
          <div className="flex flex-col items-center gap-0.5 text-slate-400 font-medium">
            <span className="text-base">💬</span>
            <span className="text-[10px]">Community</span>
          </div>
          <div className="flex flex-col items-center gap-0.5 text-slate-400 font-medium">
            <span className="text-base">📖</span>
            <span className="text-[10px]">MCQ</span>
          </div>
          <div className="flex flex-col items-center gap-0.5 text-slate-400 font-medium">
            <span className="text-base">👤</span>
            <span className="text-[10px]">Profile</span>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          "home screen ke bich me dot dikhega phir aur ishke charo or ek ring hoga chamakta hua"
          "ye dot ja ke nsta me lagega aur nsta animate hoga kuchh der phir sab khatam"
          (15.2s to 19.8s):
          Overlaid directly on top of the real, 100% visible Home Screen!
         ───────────────────────────────────────────────────────────── */}
      {sec >= 15.2 && (
        <div 
          id="soul-dot-and-shining-ring-layer"
          className="fixed inset-0 z-[100001] pointer-events-none overflow-hidden flex items-center justify-center"
        >
          {(() => {
            const startX = typeof window !== 'undefined' ? window.innerWidth * 0.5 : 200;
            const startY = typeof window !== 'undefined' ? window.innerHeight * 0.48 : 380;

            const targetX = mainNstaCoords.x || 65;
            const targetY = mainNstaCoords.y || 26;

            // Flight interpolation from center of screen to Top Bar NSTA
            const curX = sec < 16.8 
              ? startX 
              : (1 - flightEase) * (1 - flightEase) * startX + 2 * (1 - flightEase) * flightEase * (startX * 0.35) + flightEase * flightEase * targetX;

            const curY = sec < 16.8 
              ? startY 
              : (1 - flightEase) * (1 - flightEase) * startY + 2 * (1 - flightEase) * flightEase * (startY * 0.15) + flightEase * flightEase * targetY;

            // Scale of the dot
            const dotScale = sec < 16.8 
              ? Math.min(1.2, centerDotAppearProg * 1.2) 
              : Math.max(0.4, 1.2 - flightEase * 0.7);

            // Ring opacity & scale: Ring shines and pulses around the dot while in the center
            const ringOpacity = sec < 16.8 
              ? centerDotAppearProg 
              : Math.max(0, 1 - flightEase * 1.8);

            return (
              <>
                {/* 1. THE RADIANT SOUL DOT (No outer ring as requested) */}
                {!hasHitNsta && (
                  <div 
                    className="absolute pointer-events-none flex items-center justify-center transition-none"
                    style={{
                      left: `${curX}px`,
                      top: `${curY}px`,
                      transform: 'translate(-50%, -50%)',
                    }}
                  >
                    {/* Halo Glow */}
                    <div 
                      className="absolute rounded-full blur-md bg-gradient-to-tr from-amber-400 via-yellow-300 to-amber-500"
                      style={{
                        width: `${40 * dotScale}px`,
                        height: `${40 * dotScale}px`,
                        opacity: 0.9,
                      }}
                    />

                    {/* Dot Core */}
                    <div 
                      className="relative rounded-full flex items-center justify-center"
                      style={{
                        width: `${26 * dotScale}px`,
                        height: `${26 * dotScale}px`,
                        boxShadow: '0 0 35px #f59e0b, 0 0 60px #eab308, inset 0 0 10px #ffffff',
                        background: 'radial-gradient(circle, #ffffff 25%, #fef08a 55%, #f59e0b 100%)',
                      }}
                    >
                      <div className="w-2.5 h-2.5 rounded-full bg-white shadow-sm animate-ping" />
                    </div>

                    {/* Starlight sparkle */}
                    <div className="absolute text-amber-200 text-sm animate-spin" style={{ animationDuration: '1s' }}>
                      ✨
                    </div>
                  </div>
                )}

                {/* 3. IMPACT SHOCKWAVE ON MAIN NSTA ("nsta animate hoga kuchh der") */}
                {hasHitNsta && (
                  <div 
                    className="absolute pointer-events-none rounded-full border-2 border-amber-300"
                    style={{
                      left: `${targetX}px`,
                      top: `${targetY}px`,
                      width: '45px',
                      height: '45px',
                      transform: `translate(-50%, -50%) scale(${1 + hitImpactProg * 3.5})`,
                      opacity: Math.max(0, 1 - hitImpactProg),
                      boxShadow: '0 0 30px rgba(245, 158, 11, 0.95)',
                    }}
                  />
                )}
              </>
            );
          })()}
        </div>
      )}

    </div>
  );
};
