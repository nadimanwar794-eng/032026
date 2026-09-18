import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { hapticLight, hapticMedium, hapticStrong } from '../utils/haptic';

export interface NstaQuickWheelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenMessenger: () => void;
  onQuickAccess: (action: 'VIDEO' | 'PROGRESS' | 'STARRED' | 'READING' | 'FLASHCARDS' | 'OFFLINE' | 'ACTIVITY' | 'CREDITS' | 'MISTAKES') => void;
  onGoHome?: () => void;
  mistakeCount?: number;
  appName?: string;
  appLogo?: string;
  themePrimary?: string;
  isDarkMode?: boolean;
}

interface WheelToolItem {
  id: string;
  title: string;
  fullName: string;
  shortLabel: string;
  emoji: string;
  bgGrad: string;
  borderGlow: string;
  badge?: string;
  type: 'MESSENGER' | 'QUICK';
  action?: 'VIDEO' | 'PROGRESS' | 'STARRED' | 'READING' | 'FLASHCARDS' | 'OFFLINE' | 'ACTIVITY' | 'CREDITS' | 'MISTAKES';
}

export const NstaQuickWheelModal: React.FC<NstaQuickWheelModalProps> = ({
  isOpen,
  onClose,
  onOpenMessenger,
  onQuickAccess,
  onGoHome,
  mistakeCount = 0,
  appName = 'NSTA',
  appLogo = '/branding/nsta-logo.svg',
  themePrimary = '#6366f1',
}) => {
  const [rotation, setRotation] = useState<number>(0);
  const wheelRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef<boolean>(false);
  const startAngleRef = useRef<number>(0);
  const startRotationRef = useRef<number>(0);
  const lastAngleRef = useRef<number>(0);
  const velocityRef = useRef<number>(0);
  const animFrameRef = useRef<number | null>(null);
  const lastMoveTimeRef = useRef<number>(0);

  // Dynamically size wheel for comfortable label display
  const [wheelSize, setWheelSize] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const minDim = Math.min(window.innerWidth * 0.95, window.innerHeight * 0.78);
      return Math.max(380, Math.min(minDim, 450));
    }
    return 400;
  });

  useEffect(() => {
    const handleResize = () => {
      const minDim = Math.min(window.innerWidth * 0.95, window.innerHeight * 0.78);
      setWheelSize(Math.max(380, Math.min(minDim, 450)));
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const tools: WheelToolItem[] = [
    {
      id: 'MESSENGER',
      title: 'Nsta Messenger',
      fullName: 'Nsta Messenger',
      shortLabel: 'Messenger',
      emoji: '💬',
      bgGrad: 'linear-gradient(135deg, #ec4899, #8b5cf6)',
      borderGlow: '#ec4899',
      type: 'MESSENGER',
    },
    {
      id: 'VIDEO',
      title: 'Video Lectures',
      fullName: 'Video Lectures',
      shortLabel: 'Video',
      emoji: '▶️',
      bgGrad: 'linear-gradient(135deg, #ef4444, #f97316)',
      borderGlow: '#ef4444',
      type: 'QUICK',
      action: 'VIDEO',
    },
    {
      id: 'PROGRESS',
      title: 'Progress & Stats',
      fullName: 'Progress & Stats',
      shortLabel: 'Progress',
      emoji: '📊',
      bgGrad: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
      borderGlow: '#3b82f6',
      type: 'QUICK',
      action: 'PROGRESS',
    },
    {
      id: 'STARRED',
      title: 'Important Notes',
      fullName: 'Important Notes',
      shortLabel: 'Important',
      emoji: '⭐',
      bgGrad: 'linear-gradient(135deg, #f59e0b, #eab308)',
      borderGlow: '#f59e0b',
      type: 'QUICK',
      action: 'STARRED',
    },
    {
      id: 'READING',
      title: 'Continue Reading',
      fullName: 'Reading Notes',
      shortLabel: 'Reading',
      emoji: '📖',
      bgGrad: 'linear-gradient(135deg, #10b981, #059669)',
      borderGlow: '#10b981',
      type: 'QUICK',
      action: 'READING',
    },
    {
      id: 'FLASHCARDS',
      title: 'Flashcards',
      fullName: 'Flashcards',
      shortLabel: 'Flashcards',
      emoji: '🃏',
      bgGrad: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
      borderGlow: '#8b5cf6',
      type: 'QUICK',
      action: 'FLASHCARDS',
    },
    {
      id: 'OFFLINE',
      title: 'Offline Storage',
      fullName: 'Offline Storage',
      shortLabel: 'Offline',
      emoji: '💾',
      bgGrad: 'linear-gradient(135deg, #06b6d4, #0284c7)',
      borderGlow: '#06b6d4',
      type: 'QUICK',
      action: 'OFFLINE',
    },
    {
      id: 'ACTIVITY',
      title: 'MCQ Activity',
      fullName: 'MCQ Activity',
      shortLabel: 'Activity',
      emoji: '📈',
      bgGrad: 'linear-gradient(135deg, #6366f1, #3b82f6)',
      borderGlow: '#6366f1',
      type: 'QUICK',
      action: 'ACTIVITY',
    },
    {
      id: 'CREDITS',
      title: 'Credits & Coins',
      fullName: 'Credits & Coins',
      shortLabel: 'Credits',
      emoji: '💰',
      bgGrad: 'linear-gradient(135deg, #eab308, #d97706)',
      borderGlow: '#eab308',
      type: 'QUICK',
      action: 'CREDITS',
    },
    {
      id: 'MISTAKES',
      title: 'My Mistakes',
      fullName: 'My Mistakes',
      shortLabel: 'Mistakes',
      emoji: '❌',
      badge: mistakeCount > 0 ? `${mistakeCount}` : undefined,
      bgGrad: 'linear-gradient(135deg, #f43f5e, #be123c)',
      borderGlow: '#f43f5e',
      type: 'QUICK',
      action: 'MISTAKES',
    },
  ];

  const totalTools = tools.length;
  const anglePerItem = 360 / totalTools; // 36 degrees per item

  const handleLaunch = useCallback((tool: WheelToolItem) => {
    hapticStrong();
    onClose();
    if (tool.type === 'MESSENGER') {
      onOpenMessenger();
    } else if (tool.action) {
      onQuickAccess(tool.action);
    }
  }, [onClose, onOpenMessenger, onQuickAccess]);

  // Pointer drag to rotate wheel
  const handlePointerDown = (e: React.PointerEvent) => {
    if (!wheelRef.current) return;
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    const rect = wheelRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const radians = Math.atan2(e.clientY - cy, e.clientX - cx);
    const degrees = (radians * 180) / Math.PI;

    isDraggingRef.current = true;
    startAngleRef.current = degrees;
    startRotationRef.current = rotation;
    lastAngleRef.current = degrees;
    lastMoveTimeRef.current = performance.now();
    velocityRef.current = 0;
    try {
      (e.target as HTMLElement)?.setPointerCapture?.(e.pointerId);
    } catch (_) {}
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current || !wheelRef.current) return;
    const rect = wheelRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const radians = Math.atan2(e.clientY - cy, e.clientX - cx);
    const degrees = (radians * 180) / Math.PI;

    const delta = degrees - startAngleRef.current;
    const newRot = startRotationRef.current + delta;

    const now = performance.now();
    const dt = now - lastMoveTimeRef.current;
    if (dt > 10) {
      let dAngle = degrees - lastAngleRef.current;
      if (dAngle > 180) dAngle -= 360;
      if (dAngle < -180) dAngle += 360;
      velocityRef.current = dAngle / dt;
      lastAngleRef.current = degrees;
      lastMoveTimeRef.current = now;
    }

    setRotation(newRot);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    try {
      (e.target as HTMLElement)?.releasePointerCapture?.(e.pointerId);
    } catch (_) {}

    // Inertia rotation with friction
    let currentVel = velocityRef.current * 16;
    if (Math.abs(currentVel) > 0.4) {
      hapticLight();
      const step = () => {
        currentVel *= 0.94;
        if (Math.abs(currentVel) > 0.12) {
          setRotation((prev) => prev + currentVel);
          animFrameRef.current = requestAnimationFrame(step);
        } else {
          animFrameRef.current = null;
        }
      };
      animFrameRef.current = requestAnimationFrame(step);
    }
  };

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  if (!isOpen) return null;

  // Wheel orbit radius based on enlarged wheel size
  const radius = Math.round(wheelSize * 0.385);

  return (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-200 select-none overflow-hidden touch-none"
      onClick={onClose}
    >
      {/* Sleek Floating Close Button at Top */}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-6 right-6 z-50 p-2.5 rounded-full bg-white/10 hover:bg-white/20 active:scale-90 text-white/80 hover:text-white transition-all border border-white/15 shadow-xl backdrop-blur-sm"
        title="Band karein"
      >
        <X size={20} />
      </button>

      {/* ── ONLY THE CIRCLE AND ITS 10 TOOLS ── */}
      <div
        ref={wheelRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={(e) => e.stopPropagation()}
        className="relative rounded-full flex items-center justify-center touch-none cursor-grab active:cursor-grabbing select-none transition-all duration-200"
        style={{
          width: `${wheelSize}px`,
          height: `${wheelSize}px`,
          maxWidth: '96vw',
          maxHeight: '96vw',
          background: 'radial-gradient(circle, rgba(30, 27, 75, 0.82) 0%, rgba(15, 23, 42, 0.9) 60%, rgba(2, 6, 23, 0.98) 100%)',
          border: '2.5px dashed rgba(255, 255, 255, 0.28)',
          boxShadow: `0 0 60px -5px ${themePrimary}66, inset 0 0 40px rgba(0, 0, 0, 0.8)`,
        }}
      >
        {/* Subtle Ambient Pulse behind circle */}
        <div
          className="absolute inset-0 rounded-full blur-2xl opacity-30 pointer-events-none"
          style={{ background: themePrimary }}
        />

        {/* Center Hub: Official App Circular Emblem (Enlarged & edge-to-edge covering the center circle) */}
        <div
          onClick={() => {
            hapticMedium();
            onClose();
            if (onGoHome) onGoHome();
          }}
          className="relative z-20 w-28 h-28 sm:w-32 sm:h-32 rounded-full flex items-center justify-center shadow-2xl border-[3px] border-amber-400 cursor-pointer active:scale-95 transition-transform overflow-hidden p-0"
          style={{
            background: '#ffffff',
            boxShadow: '0 0 35px rgba(251, 191, 36, 0.65), 0 0 15px rgba(251, 191, 36, 0.4)',
          }}
          title={appName || 'NSTA'}
        >
          <img
            src={appLogo || '/branding/nsta-logo.svg'}
            alt={`${appName || 'NSTA'} Official Logo`}
            className="w-full h-full object-cover select-none pointer-events-none scale-110 transition-transform"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = '/branding/nsta-logo.png';
            }}
          />
        </div>

        {/* ── THE 10 TOOLS (ALWAYS UPRIGHT / SIDHA — NO ROTATION ON NAME/ICON) ── */}
        {tools.map((tool, idx) => {
          const itemAngle = idx * anglePerItem - 90; // -90 deg starts top (12 o'clock)
          const totalAngle = itemAngle + rotation;
          const rad = (totalAngle * Math.PI) / 180;
          const x = radius * Math.cos(rad);
          const y = radius * Math.sin(rad);

          return (
            <button
              key={tool.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleLaunch(tool);
              }}
              className="absolute z-20 flex flex-col items-center justify-center active:scale-90 transition-transform cursor-pointer select-none group"
              style={{
                left: '50%',
                top: '50%',
                // Pure Cartesian translation: Icon and text stay 100% HORIZONTAL & UPRIGHT (SIDHA) at all times!
                transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                width: '78px',
              }}
              title={tool.title}
            >
              {/* Tool Icon Circle / Rounded Box */}
              <div
                className="relative w-12 h-12 sm:w-[50px] sm:h-[50px] rounded-2xl flex items-center justify-center text-xl shadow-lg border border-white/30 backdrop-blur-md transition-all group-hover:scale-110"
                style={{
                  background: tool.bgGrad,
                  boxShadow: `0 6px 16px -2px ${tool.borderGlow}88, inset 0 1px 1px rgba(255, 255, 255, 0.4)`,
                }}
              >
                <span>{tool.emoji}</span>

                {/* Badge for mistakes / notifications */}
                {tool.badge && (
                  <span className="absolute -top-1 -right-1 px-1 min-w-[15px] h-[15px] rounded-full bg-rose-500 text-white text-[8px] font-black flex items-center justify-center border border-slate-900 shadow">
                    {tool.badge}
                  </span>
                )}
              </div>

              {/* Tool Name Label — Full name visible without cutting off */}
              <span className="text-[10px] sm:text-[11px] font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)] text-center whitespace-normal mt-1 leading-[1.15] tracking-tight max-w-[78px] break-words">
                {tool.fullName}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
