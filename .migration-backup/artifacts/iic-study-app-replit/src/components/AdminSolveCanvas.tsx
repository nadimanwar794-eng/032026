import React, { useRef, useState, useEffect } from 'react';
import {
  X,
  Trash2,
  Sun,
  Moon,
  Grid3X3,
  Presentation,
  MoveHorizontal,
} from 'lucide-react';

interface Props {
  themeMode?: 'light' | 'dark' | 'sepia';
  onClose: () => void;
  className?: string;
  style?: React.CSSProperties;
  boardRatioPct?: number;
  onSetBoardRatioPct?: (pct: number) => void;
}

export const AdminSolveCanvas: React.FC<Props> = ({
  themeMode = 'dark',
  onClose,
  className = '',
  style,
  boardRatioPct = 25,
  onSetBoardRatioPct,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  // Touch resize tracking
  const [isTouchResizing, setIsTouchResizing] = useState(false);
  const touchStartPosRef = useRef<{ clientX: number; clientY: number; startRatio: number } | null>(null);

  // Board style state: 'white' (Whiteboard) or 'dark' (Blackboard/Dark Slate)
  const [boardTheme, setBoardTheme] = useState<'white' | 'dark'>(() => {
    return themeMode === 'light' ? 'white' : 'dark';
  });

  // Background pattern: 'blank' (pure plain) or 'grid' (subtle graph grid) or 'ruled' (lined)
  const [bgPattern, setBgPattern] = useState<'blank' | 'grid'>('blank');

  const isDark = boardTheme === 'dark';
  const boardBg = isDark ? '#0b1120' : '#ffffff';
  const boardBorder = isDark ? '#1e293b' : '#e2e8f0';
  const headerBg = isDark ? '#0f172a' : '#f8fafc';
  const textColor = isDark ? '#f8fafc' : '#0f172a';
  const inkColor = isDark ? '#ffffff' : '#0f172a';

  // Calculate ratio numerator out of 20 (e.g. 25% -> 5/20)
  const ratioNumerator = Math.round((boardRatioPct / 100) * 20);

  // Resize canvas to match display size
  const resizeCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    let prevData: ImageData | null = null;
    const ctx = canvas.getContext('2d');
    if (ctx && canvas.width > 0 && canvas.height > 0) {
      try {
        prevData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      } catch {}
    }

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);

    if (ctx) {
      ctx.scale(dpr, dpr);
      if (prevData) {
        ctx.putImageData(prevData, 0, 0);
      }
    }
  };

  useEffect(() => {
    resizeCanvas();
    const handleResize = () => resizeCanvas();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [boardRatioPct, boardTheme]);

  const clearBoard = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);

    // Touch: Touch se board me na likhayega! Touch is dedicated to resizing (kam / besi).
    if (e.pointerType === 'touch') {
      isDrawingRef.current = false;
      touchStartPosRef.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        startRatio: boardRatioPct,
      };
      setIsTouchResizing(true);
      return;
    }

    // Mouse or Pen stylus: can draw
    isDrawingRef.current = true;
    const coords = getCanvasCoords(e);
    lastPointRef.current = coords;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.arc(coords.x, coords.y, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = inkColor;
      ctx.fill();
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // Touch: Adjust board ratio (drag left -> bigger/besi, drag right -> smaller/kam)
    if (e.pointerType === 'touch') {
      if (touchStartPosRef.current && onSetBoardRatioPct) {
        const deltaX = touchStartPosRef.current.clientX - e.clientX;
        const totalWidth = window.innerWidth || 1000;
        const deltaPct = (deltaX / totalWidth) * 100;
        const newPct = Math.max(15, Math.min(90, Math.round(touchStartPosRef.current.startRatio + deltaPct)));
        onSetBoardRatioPct(newPct);
      }
      return;
    }

    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const coords = getCanvasCoords(e);
    const last = lastPointRef.current || coords;

    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(coords.x, coords.y);
    ctx.strokeStyle = inkColor;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    lastPointRef.current = coords;
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === 'touch') {
      touchStartPosRef.current = null;
      setIsTouchResizing(false);
    } else {
      isDrawingRef.current = false;
      lastPointRef.current = null;
    }
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  };

  return (
    <div
      className={`h-full flex flex-col select-none ${className}`}
      style={{
        background: boardBg,
        borderLeft: `2px solid ${boardBorder}`,
        ...style,
      }}
    >
      {/* ── White Board Header ── */}
      <div
        className="flex items-center justify-between px-2.5 py-1.5 shrink-0 border-b gap-1.5"
        style={{ background: headerBg, borderColor: boardBorder }}
      >
        {/* Title & Ratio Badge */}
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-5 h-5 rounded-md bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
            <Presentation size={12} />
          </div>
          <div className="truncate flex items-center gap-1.5">
            <span className="text-[11px] font-black leading-tight" style={{ color: textColor }}>
              White Board
            </span>
            <span
              className="px-1.5 py-0.5 rounded text-[9px] font-black tracking-wide"
              style={{
                background: isDark ? 'rgba(99,102,241,0.2)' : '#e0e7ff',
                color: isDark ? '#a5b4fc' : '#4338ca',
              }}
              title={`Current Screen Ratio: ${ratioNumerator}/20 (${boardRatioPct}%)`}
            >
              {ratioNumerator}/20
            </span>
          </div>
        </div>

        {/* Right Action Icons: Theme Toggle, Pattern, Clear, Close (Size buttons removed per request) */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Whiteboard / Blackboard Theme Toggle */}
          <button
            type="button"
            onClick={() => setBoardTheme((t) => (t === 'white' ? 'dark' : 'white'))}
            title={isDark ? 'Switch to Whiteboard' : 'Switch to Dark Blackboard'}
            className={`p-1 rounded-md border transition-colors ${
              isDark
                ? 'bg-slate-800 text-amber-400 border-slate-700 hover:bg-slate-700'
                : 'bg-white text-indigo-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            {isDark ? <Sun size={12} /> : <Moon size={12} />}
          </button>

          {/* Grid pattern toggle */}
          <button
            type="button"
            onClick={() => setBgPattern((p) => (p === 'blank' ? 'grid' : 'blank'))}
            title={bgPattern === 'grid' ? 'Pure Blank Slate' : 'Show Subtle Grid Pattern'}
            className={`p-1 rounded-md border transition-colors ${
              bgPattern === 'grid'
                ? 'bg-indigo-600 text-white border-indigo-500'
                : isDark
                  ? 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-slate-200'
                  : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100 hover:text-slate-800'
            }`}
          >
            <Grid3X3 size={12} />
          </button>

          {/* Clear board */}
          <button
            type="button"
            onClick={clearBoard}
            title="Clear Board / Clean Blank"
            className={`p-1 rounded-md border transition-colors ${
              isDark
                ? 'bg-slate-800 text-slate-400 border-slate-700 hover:text-rose-400'
                : 'bg-white text-slate-500 border-slate-200 hover:text-rose-600'
            }`}
          >
            <Trash2 size={12} />
          </button>

          {/* Close White Board */}
          <button
            type="button"
            onClick={onClose}
            title="Close White Board"
            className="p-1 rounded-md bg-rose-500/20 text-rose-400 hover:bg-rose-500 hover:text-white transition-colors"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* ── Blank Board Body (Touch to resize, no touch drawing) ── */}
      <div
        className="flex-1 relative w-full h-full min-h-0 overflow-hidden cursor-crosshair"
        style={{
          background: boardBg,
          backgroundImage:
            bgPattern === 'grid'
              ? isDark
                ? 'radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)'
                : 'radial-gradient(circle, rgba(0,0,0,0.08) 1px, transparent 1px)'
              : undefined,
          backgroundSize: bgPattern === 'grid' ? '20px 20px' : undefined,
          touchAction: 'none',
        }}
        onTouchStart={(e) => {
          if (e.touches.length > 0) {
            touchStartPosRef.current = {
              clientX: e.touches[0].clientX,
              clientY: e.touches[0].clientY,
              startRatio: boardRatioPct,
            };
            setIsTouchResizing(true);
          }
        }}
        onTouchMove={(e) => {
          if (touchStartPosRef.current && onSetBoardRatioPct && e.touches.length > 0) {
            const deltaX = touchStartPosRef.current.clientX - e.touches[0].clientX;
            const totalWidth = window.innerWidth || 1000;
            const deltaPct = (deltaX / totalWidth) * 100;
            const newPct = Math.max(15, Math.min(90, Math.round(touchStartPosRef.current.startRatio + deltaPct)));
            onSetBoardRatioPct(newPct);
          }
        }}
        onTouchEnd={() => {
          touchStartPosRef.current = null;
          setIsTouchResizing(false);
        }}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{ touchAction: 'none' }}
          className="w-full h-full block"
        />

        {/* Real-time Touch Resize Feedback Overlay */}
        {isTouchResizing && (
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 px-3.5 py-2 rounded-xl shadow-xl flex items-center gap-2 pointer-events-none transition-transform scale-105"
            style={{
              background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
              border: `1.5px solid ${isDark ? '#3b82f6' : '#6366f1'}`,
              color: textColor,
            }}
          >
            <MoveHorizontal size={18} className="text-indigo-500 animate-pulse" />
            <div className="flex flex-col">
              <span className="text-[11px] font-black uppercase tracking-wider">
                White Board Size
              </span>
              <span className="text-xs font-black text-indigo-500">
                {ratioNumerator}/20 ({boardRatioPct}%)
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── Subtitle Footer Bar (Clean & Compact) ── */}
      <div
        className="px-2.5 py-1 text-[9px] font-bold flex items-center justify-between border-t shrink-0 opacity-60"
        style={{ background: headerBg, borderColor: boardBorder, color: textColor }}
      >
        <span>White Board • Ratio: {ratioNumerator}/20 ({boardRatioPct}%)</span>
        <span className="hidden sm:inline">Touch drag se size kam ya zyada karein</span>
      </div>
    </div>
  );
};

export default AdminSolveCanvas;
