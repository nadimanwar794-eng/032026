import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { hapticLight } from '../utils/haptic';

export interface DraggableNstaLogoFabProps {
  /** Whether focus / immersive mode (bars hidden) is currently active */
  isActive: boolean;
  /** Callback fired on tap/click (ignored when dragging) */
  onToggle: () => void;
  /** App logo URL, fallback to /branding/nsta-logo.svg */
  appLogo?: string;
  /** App short name or app name for initial letter fallback */
  appName?: string;
  /** Custom title/tooltip */
  title?: string;
  /** Storage key to persist user's chosen position */
  storageKey?: string;
  /** Default position when no stored position exists */
  defaultPosition?: { bottom?: number; right?: number; x?: number; y?: number };
  /** Extra z-index */
  zIndex?: number;
  /** Size in pixels (default 54) */
  size?: number;
  /** Custom children inside the button if needed */
  children?: React.ReactNode;
  /** Extra class names */
  className?: string;
}

const DEFAULT_STORAGE_KEY = 'nsta_floating_logo_pos';

// Bottom navigation bar clearance:
// When !isActive (navigation bar is visible), height of bottom nav is ~64-80px + safe-area padding.
// Enforcing 92px clearance guarantees the button stays comfortably ABOVE the bottom nav and never overlaps or sinks behind it.
// When isActive (immersive/focus mode), bottom nav is hidden, so 20px clearance from screen bottom is safe.
const getClearanceFromBottom = (immersive: boolean) => (immersive ? 20 : 92);

const getMaxY = (immersive: boolean, fabSize: number) => {
  const h = typeof window !== 'undefined' ? window.innerHeight : 800;
  const clearance = getClearanceFromBottom(immersive);
  return Math.max(6, h - fabSize - clearance);
};

export const DraggableNstaLogoFab: React.FC<DraggableNstaLogoFabProps> = ({
  isActive,
  onToggle,
  appLogo,
  appName = 'NSTA',
  title,
  storageKey = DEFAULT_STORAGE_KEY,
  defaultPosition,
  zIndex = 99999,
  size = 54,
  children,
  className = '',
}) => {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') {
          const w = typeof window !== 'undefined' ? window.innerWidth : 800;
          const maxY = getMaxY(isActive, size);
          return {
            x: Math.max(6, Math.min(w - size - 6, parsed.x)),
            y: Math.max(6, Math.min(maxY, parsed.y)),
          };
        }
      }
    } catch {}
    return null;
  });

  const [isDragging, setIsDragging] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const isMovedRef = useRef(false);
  const startRef = useRef({ px: 0, py: 0, bx: 0, by: 0 });
  const posRef = useRef<{ x: number; y: number } | null>(pos);

  useEffect(() => {
    posRef.current = pos;
  }, [pos]);

  // When isActive changes (e.g. bottom nav shown vs hidden), automatically clamp pos so button never sits in bottom nav area
  useEffect(() => {
    setPos(prev => {
      if (!prev) return null;
      const w = typeof window !== 'undefined' ? window.innerWidth : 800;
      const maxY = getMaxY(isActive, size);
      const clampedX = Math.max(6, Math.min(w - size - 6, prev.x));
      const clampedY = Math.max(6, Math.min(maxY, prev.y));
      if (clampedX !== prev.x || clampedY !== prev.y) {
        const updated = { x: clampedX, y: clampedY };
        posRef.current = updated;
        return updated;
      }
      return prev;
    });
  }, [isActive, size]);

  // Keep clamped to viewport on window resize / screen rotation
  useEffect(() => {
    const handleResize = () => {
      setPos(prev => {
        if (!prev) return null;
        const w = typeof window !== 'undefined' ? window.innerWidth : 800;
        const maxY = getMaxY(isActive, size);
        const clampedX = Math.max(6, Math.min(w - size - 6, prev.x));
        const clampedY = Math.max(6, Math.min(maxY, prev.y));
        const updated = { x: clampedX, y: clampedY };
        posRef.current = updated;
        return updated;
      });
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [isActive, size]);

  // If no stored pos, calculate default initial position with clearance
  const getRenderStyle = (): React.CSSProperties => {
    if (pos) {
      const w = typeof window !== 'undefined' ? window.innerWidth : 800;
      const maxY = getMaxY(isActive, size);
      const clampedX = Math.max(6, Math.min(w - size - 6, pos.x));
      const clampedY = Math.max(6, Math.min(maxY, pos.y));
      return {
        left: `${clampedX}px`,
        top: `${clampedY}px`,
        bottom: 'auto',
        right: 'auto',
      };
    }
    const defBottom = defaultPosition?.bottom != null
      ? (!isActive ? Math.max(defaultPosition.bottom, 92) : defaultPosition.bottom)
      : (!isActive ? 92 : 20);
    const defRight = defaultPosition?.right ?? 16;
    return {
      bottom: `${defBottom}px`,
      right: `${defRight}px`,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    const btn = btnRef.current;
    if (!btn) return;
    try {
      btn.setPointerCapture(e.pointerId);
    } catch {}

    const rect = btn.getBoundingClientRect();
    const curX = posRef.current ? posRef.current.x : rect.left;
    const curY = posRef.current ? posRef.current.y : rect.top;

    isMovedRef.current = false;
    startRef.current = { px: e.clientX, py: e.clientY, bx: curX, by: curY };

    if (!posRef.current) {
      const maxY = getMaxY(isActive, size);
      const initial = {
        x: Math.max(6, Math.min(window.innerWidth - size - 6, curX)),
        y: Math.max(6, Math.min(maxY, curY)),
      };
      posRef.current = initial;
      setPos(initial);
    }
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isDragging) return;
    const dx = e.clientX - startRef.current.px;
    const dy = e.clientY - startRef.current.py;

    // Movement threshold (5px) to distinguish drag from accidental tap
    if (Math.hypot(dx, dy) > 5) {
      isMovedRef.current = true;
    }

    const maxY = getMaxY(isActive, size);
    const nextX = Math.max(6, Math.min(window.innerWidth - size - 6, startRef.current.bx + dx));
    // User cannot drag the button into or below the bottom navigation bar
    const nextY = Math.max(6, Math.min(maxY, startRef.current.by + dy));

    const next = { x: nextX, y: nextY };
    posRef.current = next;
    setPos(next);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isDragging) return;
    setIsDragging(false);
    try {
      btnRef.current?.releasePointerCapture(e.pointerId);
    } catch {}

    // Save final placed position so it remembers where user kept it (clamped)
    if (posRef.current) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(posRef.current));
      } catch {}
    }

    // If user tapped without moving, trigger the toggle action
    if (!isMovedRef.current) {
      hapticLight();
      onToggle();
    }
  };

  const officialLogo = (appLogo && !appLogo.includes('placeholder'))
    ? appLogo
    : '/branding/nsta-logo.svg';

  const defaultTitle = isActive
    ? 'नेविगेशन बार व टॉप बार दिखाएं • Drag to move anywhere'
    : 'नेविगेशन बार व टॉप बार छुपाएं • Drag to move anywhere';

  const fabElement = (
    <button
      ref={btnRef}
      type="button"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={`fixed select-none touch-none cursor-grab active:cursor-grabbing shadow-2xl flex items-center justify-center pointer-events-auto ${isDragging ? 'scale-105 opacity-95' : 'hover:scale-105 active:scale-95 transition-transform duration-150'} ${className}`}
      style={{
        ...getRenderStyle(),
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        zIndex,
        background: isActive ? 'radial-gradient(circle, #1e1b4b 0%, #0f172a 100%)' : 'radial-gradient(circle, #0f172a 0%, #020617 100%)',
        border: isActive ? '2.5px solid rgba(99, 102, 241, 0.95)' : '2.5px solid rgba(251, 191, 36, 0.9)',
        boxShadow: isActive
          ? '0 8px 25px -2px rgba(99, 102, 241, 0.65), 0 0 16px rgba(99, 102, 241, 0.45)'
          : '0 8px 25px -2px rgba(124, 58, 237, 0.55), 0 0 16px rgba(251, 191, 36, 0.45)',
        backdropFilter: 'blur(10px)',
      }}
      title={title || defaultTitle}
      aria-label={title || defaultTitle}
    >
      {children ? (
        children
      ) : (
        <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center bg-slate-900/90 pointer-events-none p-1">
          <img
            src={officialLogo}
            alt={appName}
            className="w-full h-full object-contain rounded-full drop-shadow-md select-none pointer-events-none"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = '/branding/nsta-logo.png';
            }}
          />
        </div>
      )}

      {/* Focus / Visibility status indicator dot */}
      <span
        className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white pointer-events-none shadow-md transition-colors duration-200"
        style={{
          background: isActive ? '#6366f1' : '#22c55e',
        }}
      />
    </button>
  );

  // Render via portal directly into document.body to ensure it is never trapped under parent stacking contexts (like z-[150])
  if (typeof document !== 'undefined' && document.body) {
    return createPortal(fabElement, document.body);
  }

  return fabElement;
};

export default DraggableNstaLogoFab;
