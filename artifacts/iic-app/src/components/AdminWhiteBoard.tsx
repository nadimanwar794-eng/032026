// @ts-nocheck
/**
 * AdminWhiteBoard — Floating draggable + resizable blank white panel for admin/subadmin.
 *
 * States:
 *   expanded  → white panel, draggable by header, resizable from bottom-right corner
 *   minimized → small round IIC logo button (draggable anywhere)
 *
 * Max size: 95vw × 95vh. Admin can freely resize between 160×120 and the max.
 */
import React, { useRef, useState, useCallback, useEffect } from 'react';
import { X, Minus, GripVertical } from 'lucide-react';

interface Props {
  onClose: () => void;
}

type BoardState = 'expanded' | 'minimized';

const MIN_W = 160;
const MIN_H = 120;

export const AdminWhiteBoard: React.FC<Props> = ({ onClose }) => {
  const [boardState, setBoardState] = useState<BoardState>('expanded');
  const [pos, setPos] = useState({ x: 16, y: 80 });
  const [size, setSize] = useState(() => ({
    w: Math.min(window.innerWidth - 32, 340),
    h: Math.min(window.innerHeight * 0.6, 420),
  }));

  const panelRef = useRef<HTMLDivElement>(null);

  // ── Drag (move) logic ────────────────────────────────────────────────────────
  const dragging = useRef(false);
  const dragStart = useRef({ px: 0, py: 0, ox: 0, oy: 0 });

  const startDrag = useCallback((cx: number, cy: number) => {
    dragging.current = true;
    dragStart.current = { px: cx, py: cy, ox: pos.x, oy: pos.y };
  }, [pos]);

  const moveDrag = useCallback((cx: number, cy: number) => {
    if (!dragging.current) return;
    const dx = cx - dragStart.current.px;
    const dy = cy - dragStart.current.py;
    const pw = panelRef.current?.offsetWidth ?? size.w;
    const ph = panelRef.current?.offsetHeight ?? size.h;
    setPos({
      x: Math.max(0, Math.min(window.innerWidth - pw, dragStart.current.ox + dx)),
      y: Math.max(0, Math.min(window.innerHeight - ph, dragStart.current.oy + dy)),
    });
  }, [size]);

  const endDrag = useCallback(() => { dragging.current = false; }, []);

  // ── Resize logic ─────────────────────────────────────────────────────────────
  const resizing = useRef(false);
  const resizeStart = useRef({ px: 0, py: 0, ow: 0, oh: 0 });

  const startResize = useCallback((cx: number, cy: number) => {
    resizing.current = true;
    resizeStart.current = { px: cx, py: cy, ow: size.w, oh: size.h };
  }, [size]);

  const moveResize = useCallback((cx: number, cy: number) => {
    if (!resizing.current) return;
    const dx = cx - resizeStart.current.px;
    const dy = cy - resizeStart.current.py;
    const maxW = Math.floor(window.innerWidth * 0.95);
    const maxH = Math.floor(window.innerHeight * 0.95);
    setSize({
      w: Math.max(MIN_W, Math.min(maxW, resizeStart.current.ow + dx)),
      h: Math.max(MIN_H, Math.min(maxH, resizeStart.current.oh + dy)),
    });
  }, []);

  const endResize = useCallback(() => { resizing.current = false; }, []);

  // ── Global pointer listeners ─────────────────────────────────────────────────
  useEffect(() => {
    const onMove = (e: MouseEvent) => { moveDrag(e.clientX, e.clientY); moveResize(e.clientX, e.clientY); };
    const onUp   = () => { endDrag(); endResize(); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [moveDrag, moveResize, endDrag, endResize]);

  // ── Minimized state ───────────────────────────────────────────────────────────
  if (boardState === 'minimized') {
    return (
      <div
        ref={panelRef}
        style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 999, touchAction: 'none', userSelect: 'none' }}
        onMouseDown={(e) => { e.preventDefault(); startDrag(e.clientX, e.clientY); }}
        onTouchStart={(e) => { const t = e.touches[0]; startDrag(t.clientX, t.clientY); }}
        onTouchMove={(e) => { const t = e.touches[0]; moveDrag(t.clientX, t.clientY); }}
        onTouchEnd={endDrag}
      >
        <button
          onClick={(e) => { e.stopPropagation(); if (!dragging.current) setBoardState('expanded'); }}
          style={{
            width: 54, height: 54, borderRadius: '50%', border: 'none', padding: 0,
            cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
            overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#fff', WebkitTapHighlightColor: 'transparent',
          }}
          aria-label="Open Whiteboard"
        >
          <img
            src="/splash-logo.png"
            alt="IIC"
            style={{ width: 54, height: 54, objectFit: 'cover', borderRadius: '50%', pointerEvents: 'none' }}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
              const p = e.currentTarget.parentElement;
              if (p) p.innerHTML = '<span style="font-size:18px;font-weight:900;color:#1e293b">IIC</span>';
            }}
          />
        </button>
      </div>
    );
  }

  // ── Expanded state ────────────────────────────────────────────────────────────
  return (
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        zIndex: 999,
        width: size.w,
        height: size.h,
        background: '#ffffff',
        borderRadius: 14,
        boxShadow: '0 8px 40px rgba(0,0,0,0.28), 0 2px 8px rgba(0,0,0,0.12)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        border: '1.5px solid rgba(0,0,0,0.08)',
        userSelect: 'none',
      }}
    >
      {/* ── Header / drag handle ── */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '9px 10px',
          background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
          cursor: 'grab', flexShrink: 0, touchAction: 'none',
        }}
        onMouseDown={(e) => { e.preventDefault(); startDrag(e.clientX, e.clientY); }}
        onTouchStart={(e) => { const t = e.touches[0]; startDrag(t.clientX, t.clientY); }}
        onTouchMove={(e) => { const t = e.touches[0]; moveDrag(t.clientX, t.clientY); }}
        onTouchEnd={endDrag}
      >
        <img
          src="/splash-logo.png"
          alt="IIC"
          style={{ width: 22, height: 22, objectFit: 'cover', borderRadius: '50%', flexShrink: 0, border: '1px solid rgba(255,255,255,0.2)', pointerEvents: 'none' }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
        <GripVertical size={13} style={{ color: 'rgba(255,255,255,0.35)', flexShrink: 0, pointerEvents: 'none' }} />
        <span style={{ flex: 1, fontSize: 10, fontWeight: 800, color: '#fff', letterSpacing: '0.07em', textTransform: 'uppercase', pointerEvents: 'none' }}>
          Admin Board
        </span>
        {/* Minimize */}
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onClick={() => setBoardState('minimized')}
          style={{
            width: 24, height: 24, borderRadius: 7, border: 'none',
            background: 'rgba(255,255,255,0.12)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', flexShrink: 0, WebkitTapHighlightColor: 'transparent',
          }}
          aria-label="Minimize"
        >
          <Minus size={12} />
        </button>
        {/* Close */}
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onClick={onClose}
          style={{
            width: 24, height: 24, borderRadius: 7, border: 'none',
            background: 'rgba(239,68,68,0.28)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fca5a5', flexShrink: 0, WebkitTapHighlightColor: 'transparent',
          }}
          aria-label="Close"
        >
          <X size={12} />
        </button>
      </div>

      {/* ── Blank white body ── */}
      <div
        style={{ flex: 1, background: '#ffffff', touchAction: 'pan-y' }}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      />

      {/* ── Resize handle (bottom-right corner) ── */}
      <div
        style={{
          position: 'absolute', bottom: 0, right: 0,
          width: 28, height: 28,
          cursor: 'nwse-resize',
          touchAction: 'none',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end',
          padding: '4px',
        }}
        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); startResize(e.clientX, e.clientY); }}
        onTouchStart={(e) => { e.stopPropagation(); const t = e.touches[0]; startResize(t.clientX, t.clientY); }}
        onTouchMove={(e) => { e.stopPropagation(); const t = e.touches[0]; moveResize(t.clientX, t.clientY); }}
        onTouchEnd={(e) => { e.stopPropagation(); endResize(); }}
      >
        {/* Resize grip dots */}
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="5" cy="9"  r="1.3" fill="#94a3b8" />
          <circle cx="9" cy="9"  r="1.3" fill="#94a3b8" />
          <circle cx="9" cy="5"  r="1.3" fill="#94a3b8" />
          <circle cx="13" cy="9" r="1.3" fill="#cbd5e1" />
          <circle cx="13" cy="13" r="1.3" fill="#94a3b8" />
          <circle cx="9" cy="13" r="1.3" fill="#cbd5e1" />
        </svg>
      </div>
    </div>
  );
};
