/**
 * PdfViewer — enhanced PDF/iframe viewer
 *
 * Features:
 *  1. Rotate Mode     — CSS transform (stable, works on all browsers incl. iOS)
 *  2. Full Screen     — requestFullscreen + immersive mode (tap to show/hide bar)
 *  3. Last Page       — manual page tracker saved in localStorage, reopens at saved page
 *  4. Jump to Page    — page number input, updates iframe src with #page=N
 *  5. Night / Sepia   — CSS filter overlay on iframe
 *  6. Progress milestones — 25 / 50 / 75 / 100 % based on manual page tracking
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ArrowLeft, Maximize, Minimize, RotateCcw, Moon, Sun,
  ExternalLink, ChevronLeft, ChevronRight, Search, X, BookOpen, Check, MoreVertical,
  ZoomIn, ZoomOut, LayoutGrid
} from 'lucide-react';
import { tryEarnScore } from '../utils/scoreSystem';
import { ReadingScoreSession, ReadingScoreState } from '../utils/readingScoreEngine';
import { ReadingScoreHUD } from './ReadingScoreHUD';

interface Props {
  url: string;
  title: string;
  onBack: () => void;
  /** Unique key for remembering last page (e.g. content ID or chapter ID) */
  sessionKey?: string;
  /** User data for score milestones */
  userId?: string;
  userLevel?: number;
  subscriptionLevel?: string;
  isPremium?: boolean;
  boostPercent?: number;
  onScoreEarned?: (pts: number) => void;
  /** Next chapter navigation */
  onNext?: () => void;
  nextTitle?: string;
  /** School mode: opens mode-switch sheet */
  onSchoolModeSwitch?: () => void;
  /** Admin board navigation */
  isAdmin?: boolean;
  onAdminBoard?: () => void;
}

type NightMode = 'normal' | 'night' | 'sepia';

const PAGE_KEY = (k: string) => `nst_pdf_pg_${k}`;
const TOTAL_KEY = (k: string) => `nst_pdf_total_${k}`;

const buildSrc = (url: string, page: number): string => {
  let base = url;
  if (base.includes('drive.google.com')) {
    base = base.replace(/[#?].*$/, '');
    if (!base.includes('/preview')) {
      base = base.replace(/\/(view|edit).*$/, '/preview');
    }
    if (!base.includes('rm=minimal')) {
      base += base.includes('?') ? '&rm=minimal' : '?rm=minimal';
    }
  }
  if (page > 1) base += `#page=${page}`;
  return base;
};

const MILESTONE_SCORES = [
  { pct: 25, base: 5, label: '25%' },
  { pct: 50, base: 10, label: '50%' },
  { pct: 75, base: 15, label: '75%' },
  { pct: 100, base: 25, label: '100%' },
];

export const PdfViewer: React.FC<Props> = ({
  url, title, onBack, sessionKey,
  userId, userLevel = 1, subscriptionLevel, isPremium, boostPercent = 0, onScoreEarned,
  onNext, nextTitle, onSchoolModeSwitch, isAdmin, onAdminBoard,
}) => {
  const key = sessionKey || btoa(url).replace(/[^a-z0-9]/gi, '').slice(0, 24);

  const [currentPage, setCurrentPage] = useState<number>(() => {
    try { return Math.max(1, parseInt(localStorage.getItem(PAGE_KEY(key)) || '1', 10)); } catch { return 1; }
  });
  const [totalPages, setTotalPages] = useState<number>(() => {
    try { return Math.max(0, parseInt(localStorage.getItem(TOTAL_KEY(key)) || '0', 10)); } catch { return 0; }
  });
  const [iframeSrc, setIframeSrc] = useState(() => buildSrc(url, currentPage));
  const [rotated, setRotated] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [nightMode, setNightMode] = useState<NightMode>('normal');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [headerVisible, setHeaderVisible] = useState(true);
  const [jumpInput, setJumpInput] = useState('');
  const [showJump, setShowJump] = useState(false);
  const [totalInput, setTotalInput] = useState('');
  const [showTotalInput, setShowTotalInput] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [milestoneHit, setMilestoneHit] = useState<string | null>(null);
  const [awardedMilestones, setAwardedMilestones] = useState<Set<number>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(`nst_pdf_ms_${key}`) || '[]')); } catch { return new Set(); }
  });
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const headerHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const jumpInputRef = useRef<HTMLInputElement>(null);

  // ── PDF time-based score session (no scroll tracking possible in iframe) ──
  const pdfScoreSessionRef = useRef<ReadingScoreSession | null>(null);
  const [pdfScoreState, setPdfScoreState] = useState<ReadingScoreState | null>(null);

  useEffect(() => {
    if (!userId) return;
    const session = new ReadingScoreSession(
      {
        userId,
        userLevel,
        subscriptionLevel,
        isPremium,
        boostPercent: boostPercent || 0,
        mode: 'pdf',
        onScoreEarned: (pts) => onScoreEarned?.(pts),
      },
      (state) => setPdfScoreState(state),
    );
    pdfScoreSessionRef.current = session;
    session.start();
    return () => {
      session.stop();
      pdfScoreSessionRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, url]);

  const showToast = useCallback((msg: string, ms = 2000) => {
    setToast(msg);
    setTimeout(() => setToast(null), ms);
  }, []);

  const savePage = useCallback((p: number) => {
    try { localStorage.setItem(PAGE_KEY(key), String(p)); } catch {}
  }, [key]);

  const goToPage = useCallback((p: number) => {
    const valid = Math.max(1, totalPages > 0 ? Math.min(p, totalPages) : p);
    setCurrentPage(valid);
    savePage(valid);
    setIframeSrc(buildSrc(url, valid));
  }, [url, totalPages, savePage]);

  const nextPage = () => goToPage(currentPage + 1);
  const prevPage = () => goToPage(Math.max(1, currentPage - 1));

  const handleJump = () => {
    const n = parseInt(jumpInput, 10);
    if (!isNaN(n) && n > 0) { goToPage(n); setShowJump(false); setJumpInput(''); }
  };

  const handleSetTotal = () => {
    const n = parseInt(totalInput, 10);
    if (!isNaN(n) && n > 0) {
      setTotalPages(n);
      try { localStorage.setItem(TOTAL_KEY(key), String(n)); } catch {}
      setShowTotalInput(false);
      setTotalInput('');
      showToast(`Total pages set to ${n}`);
    }
  };

  // Progress milestones
  useEffect(() => {
    if (!userId || totalPages <= 0) return;
    const pct = Math.round((currentPage / totalPages) * 100);
    for (const ms of MILESTONE_SCORES) {
      if (pct >= ms.pct && !awardedMilestones.has(ms.pct)) {
        const earned = tryEarnScore(userId, ms.base, subscriptionLevel, isPremium, boostPercent, 'PDF_MILESTONE');
        if (earned > 0) {
          const updated = new Set([...awardedMilestones, ms.pct]);
          setAwardedMilestones(updated);
          try { localStorage.setItem(`nst_pdf_ms_${key}`, JSON.stringify([...updated])); } catch {}
          setMilestoneHit(`📖 ${ms.label} complete! +${earned} pts`);
          onScoreEarned?.(earned);
          setTimeout(() => setMilestoneHit(null), 3000);
        }
      }
    }
  }, [currentPage, totalPages, userId]);


  // Fullscreen listener
  useEffect(() => {
    const h = () => {
      const fs = !!document.fullscreenElement;
      setIsFullscreen(fs);
      if (!fs) setHeaderVisible(true);
    };
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, []);

  // Exit fullscreen when PDF viewer is closed/unmounted
  useEffect(() => {
    return () => {
      try { if (document.fullscreenElement) document.exitFullscreen(); } catch (_) {}
    };
  }, []);

  const toggleFullscreen = () => {
    setShowMoreMenu(false);
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => showToast('Fullscreen not supported'));
    } else {
      document.exitFullscreen();
    }
  };

  // Auto-hide header after 3s in fullscreen
  useEffect(() => {
    if (!isFullscreen) return;
    if (headerHideTimer.current) clearTimeout(headerHideTimer.current);
    headerHideTimer.current = setTimeout(() => setHeaderVisible(false), 3000);
    return () => { if (headerHideTimer.current) clearTimeout(headerHideTimer.current); };
  }, [isFullscreen, headerVisible]);

  const revealHeader = () => {
    if (isFullscreen) setHeaderVisible(true);
  };

  // Night mode filter string for iframe wrapper
  const nightFilter = nightMode === 'night'
    ? 'invert(0.9) hue-rotate(180deg) brightness(0.85)'
    : nightMode === 'sepia'
    ? 'sepia(0.8) brightness(0.9) contrast(0.9)'
    : 'none';

  const nightLabel = { normal: '☀️', night: '🌙', sepia: '📜' };
  const cycleNight = () => setNightMode(m => m === 'normal' ? 'night' : m === 'night' ? 'sepia' : 'normal');

  // CSS rotation — stable across all browsers
  const zoomIn = () => setZoomLevel(z => Math.min(3.0, parseFloat((z + 0.25).toFixed(2))));
  const zoomOut = () => setZoomLevel(z => Math.max(0.5, parseFloat((z - 0.25).toFixed(2))));
  const zoomReset = () => setZoomLevel(1.0);

  // Toggle rotate: CSS-only rotation of the PDF iframe — never rotates the whole app
  const toggleRotate = useCallback(() => {
    const next = !rotated;
    setRotated(next);
    showToast(next ? 'Landscape mode' : 'Portrait mode');
  }, [rotated, showToast]);

  // When rotated: iframe wrapper is normal (no individual rotation needed)
  const iframeWrapStyle: React.CSSProperties = {
    position: 'relative',
    width: `${zoomLevel * 100}%`,
    minWidth: '100%',
    height: `${zoomLevel * 100}%`,
    minHeight: '100%',
  };

  // Rotate the entire viewer container like a video player going landscape.
  // The container is fixed inset-0 so it covers full screen.
  // When rotated: swap w/h and rotate 90deg so it fills the screen landscape.
  const containerStyle: React.CSSProperties = rotated
    ? {
        position: 'fixed',
        top: '50%',
        left: '50%',
        width: '100vh',
        height: '100vw',
        transform: 'translate(-50%, -50%) rotate(90deg)',
        transformOrigin: 'center center',
        zIndex: 50,
      }
    : {};

  const progressPct = totalPages > 0 ? Math.round((currentPage / totalPages) * 100) : 0;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-black flex flex-col"
      style={containerStyle}
      onTouchStart={revealHeader}
      onMouseMove={revealHeader}
    >
      {/* Toast */}
      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[9999] bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-lg animate-in fade-in">
          {toast}
        </div>
      )}

      {/* Milestone popup */}
      {milestoneHit && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[9998] bg-emerald-600 text-white text-sm font-bold px-5 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 animate-in slide-in-from-top-4">
          <Check size={16} /> {milestoneHit}
        </div>
      )}

      {/* Jump-to-page overlay */}
      {showJump && (
        <div
          className="fixed inset-0 z-[9997] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setShowJump(false)}
        >
          <div
            className="bg-white rounded-2xl p-5 mx-4 w-full max-w-xs shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <p className="font-black text-slate-800 mb-3 text-center">📄 Which page do you want to go to?</p>
            <input
              ref={jumpInputRef}
              type="number"
              min={1}
              max={totalPages || undefined}
              value={jumpInput}
              onChange={e => setJumpInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleJump()}
              placeholder={`Page number ${totalPages > 0 ? `(1–${totalPages})` : ''}`}
              className="w-full border-2 border-indigo-300 rounded-xl px-4 py-2 text-center font-black text-lg focus:outline-none focus:border-indigo-500 mb-3"
              autoFocus
            />
            <button
              onClick={handleJump}
              className="w-full py-2 rounded-xl bg-indigo-600 text-white font-black active:scale-95 transition"
            >
              Go ▶
            </button>
          </div>
        </div>
      )}

      {/* Set total pages overlay */}
      {showTotalInput && (
        <div
          className="fixed inset-0 z-[9997] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setShowTotalInput(false)}
        >
          <div
            className="bg-white rounded-2xl p-5 mx-4 w-full max-w-xs shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <p className="font-black text-slate-800 mb-1 text-center">📚 Set Total Pages</p>
            <p className="text-xs text-slate-500 text-center mb-3">Enter the last page number of the PDF</p>
            <input
              type="number"
              min={1}
              value={totalInput}
              onChange={e => setTotalInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSetTotal()}
              placeholder="e.g. 250"
              className="w-full border-2 border-indigo-300 rounded-xl px-4 py-2 text-center font-black text-lg focus:outline-none focus:border-indigo-500 mb-3"
              autoFocus
            />
            <button
              onClick={handleSetTotal}
              className="w-full py-2 rounded-xl bg-indigo-600 text-white font-black active:scale-95 transition"
            >
              Save ✓
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header
        className={`flex-shrink-0 bg-slate-900/95 backdrop-blur text-white px-3 py-2 flex items-center gap-2 z-20 transition-all duration-300 ${
          isFullscreen && !headerVisible ? 'opacity-0 pointer-events-none -translate-y-full' : 'opacity-100'
        }`}
      >
        {/* Back */}
        <button onClick={onBack} className="p-2 bg-white/10 rounded-xl active:bg-white/20 transition shrink-0">
          <ArrowLeft size={18} />
        </button>

        {/* School mode switch */}
        {onSchoolModeSwitch && (
          <button
            onClick={onSchoolModeSwitch}
            className="p-2 bg-indigo-500/30 rounded-xl active:bg-indigo-500/50 transition shrink-0"
            title="Switch Mode"
          >
            <LayoutGrid size={16} className="text-indigo-200" />
          </button>
        )}

        {/* Title */}
        <h2 className="flex-1 font-bold text-sm truncate min-w-0">{title}</h2>

        {/* Page counter */}
        <button
          onClick={() => { setShowJump(true); setTimeout(() => jumpInputRef.current?.focus(), 80); }}
          className="flex items-center gap-1 bg-white/10 px-2.5 py-1.5 rounded-xl text-xs font-black active:bg-white/20 transition shrink-0"
        >
          <BookOpen size={13} />
          <span>{currentPage}{totalPages > 0 ? `/${totalPages}` : ''}</span>
        </button>

        {/* Night mode */}
        <button
          onClick={cycleNight}
          className="p-2 bg-white/10 rounded-xl active:bg-white/20 transition text-base shrink-0"
          title={`Mode: ${nightMode}`}
        >
          {nightLabel[nightMode]}
        </button>

        {/* Fullscreen */}
        <button
          onClick={toggleFullscreen}
          className={`p-2 rounded-xl active:scale-90 transition shrink-0 ${isFullscreen ? 'bg-indigo-500' : 'bg-white/10'}`}
          title="Full Screen"
        >
          {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
        </button>

        {/* More menu toggle */}
        <button
          onClick={() => setShowMoreMenu(m => !m)}
          className={`p-2 rounded-xl active:scale-90 transition shrink-0 ${showMoreMenu ? 'bg-indigo-500 text-white' : 'bg-white/10'}`}
          title="More options"
        >
          <MoreVertical size={16} />
        </button>
      </header>

      {/* Slim controls bar — visible when 3-dot is active, hides on fullscreen */}
      {showMoreMenu && (
        <div className="flex-shrink-0 bg-slate-800/98 border-t border-white/10 flex items-stretch z-10 animate-in slide-in-from-top-1 duration-150">
          <button onClick={zoomOut} disabled={zoomLevel <= 0.5} className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 px-1 hover:bg-white/10 active:bg-white/20 transition disabled:opacity-30 border-r border-white/10">
            <ZoomOut size={13} className="text-slate-300" />
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Out</span>
          </button>
          <button onClick={zoomReset} className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 px-1 hover:bg-white/10 active:bg-white/20 transition border-r border-white/10">
            <span className="text-xs font-black text-white">{Math.round(zoomLevel * 100)}%</span>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Zoom</span>
          </button>
          <button onClick={zoomIn} disabled={zoomLevel >= 3.0} className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 px-1 hover:bg-white/10 active:bg-white/20 transition disabled:opacity-30 border-r border-white/10">
            <ZoomIn size={13} className="text-slate-300" />
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">In</span>
          </button>
          <button onClick={() => { toggleRotate(); setShowMoreMenu(false); }} className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 px-1 hover:bg-white/10 active:bg-white/20 transition border-r border-white/10 ${rotated ? 'text-indigo-300' : 'text-slate-300'}`}>
            <RotateCcw size={13} />
            <span className={`text-[9px] font-black uppercase tracking-wider ${rotated ? 'text-indigo-400' : 'text-slate-400'}`}>{rotated ? 'Portrait' : 'Rotate'}</span>
          </button>
          {isAdmin && onAdminBoard && (
            <button onClick={() => { setShowMoreMenu(false); onAdminBoard(); }} className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 px-1 hover:bg-white/10 active:bg-white/20 transition border-r border-white/10 text-emerald-300">
              <LayoutGrid size={13} />
              <span className="text-[9px] font-black uppercase tracking-wider text-emerald-400">Admin</span>
            </button>
          )}
          <a href={url} target="_blank" rel="noopener noreferrer" onClick={() => setShowMoreMenu(false)} className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 px-1 hover:bg-white/10 active:bg-white/20 transition text-indigo-300">
            <ExternalLink size={13} />
            <span className="text-[9px] font-black uppercase tracking-wider text-indigo-400">Open</span>
          </a>
        </div>
      )}

      {/* Progress bar */}
      {totalPages > 0 && (
        <div className="h-1 bg-slate-700 flex-shrink-0 z-10">
          <div
            className="h-full bg-gradient-to-r from-indigo-400 to-violet-400 transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}

      {/* iframe container — overflow-auto so zoom can scroll */}
      <div className="flex-1 relative overflow-auto bg-slate-800">
        <div style={{ ...iframeWrapStyle, filter: nightFilter }}>
          <iframe
            ref={iframeRef}
            key={iframeSrc}
            src={iframeSrc}
            className="w-full h-full border-none"
            title={title}
            allowFullScreen
          />
        </div>
      </div>

      {/* Bottom toolbar */}
      <div className="flex-shrink-0 bg-slate-900/95 backdrop-blur text-white px-3 py-2 flex items-center gap-2 z-20">
        {/* Prev page */}
        <button
          onClick={prevPage}
          disabled={currentPage <= 1}
          className="p-2 bg-white/10 rounded-xl disabled:opacity-30 active:scale-90 transition shrink-0"
        >
          <ChevronLeft size={18} />
        </button>

        {/* Center: page + set total */}
        <div className="flex items-center gap-2 flex-1 justify-center">
          <button
            onClick={() => setShowJump(true)}
            className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-xl text-sm font-black active:bg-white/20 transition"
          >
            <Search size={13} />
            Page {currentPage}
            {totalPages > 0 && <span className="text-slate-400 font-normal"> / {totalPages}</span>}
          </button>
          <button
            onClick={() => setShowTotalInput(true)}
            className="text-[10px] text-slate-400 font-bold bg-white/5 px-2 py-1 rounded-lg active:bg-white/10 transition"
            title="Set total pages"
          >
            {totalPages > 0 ? `📚 ${progressPct}%` : '📚 Set'}
          </button>
        </div>

        {/* Next page */}
        <button
          onClick={nextPage}
          disabled={totalPages > 0 && currentPage >= totalPages}
          className="p-2 bg-white/10 rounded-xl disabled:opacity-30 active:scale-90 transition shrink-0"
        >
          <ChevronRight size={18} />
        </button>

        {/* Next Chapter button — only when next exists */}
        {onNext && (
          <button
            onClick={onNext}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-[11px] font-black active:scale-95 transition shrink-0"
            style={{ background: 'rgba(59,130,246,0.30)', border: '1px solid rgba(59,130,246,0.45)', color: '#93c5fd' }}
            title={nextTitle ? `Next: ${nextTitle}` : 'Next Chapter'}
          >
            <span className="max-w-[80px] truncate hidden xs:block">{nextTitle || 'Next'}</span>
            <ChevronRight size={14} />
          </button>
        )}
      </div>

      {/* Fullscreen tap-to-show hint */}
      {isFullscreen && !headerVisible && (
        <div
          className="absolute top-0 left-0 right-0 h-16 z-10 cursor-pointer"
          onClick={revealHeader}
        />
      )}

      {/* ── PDF time-based score HUD ── */}
      {pdfScoreState && (
        <ReadingScoreHUD
          state={pdfScoreState}
          visible={true}
          levelColor="#6366f1"
        />
      )}
    </div>
  );
};
