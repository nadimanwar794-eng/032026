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
  LayoutGrid
} from 'lucide-react';
import { tryEarnScore } from '../utils/scoreSystem';
import { ReadingScoreSession, ReadingScoreState } from '../utils/readingScoreEngine';
import { ReadingScoreHUD } from './ReadingScoreHUD';
import { PaginatedPdfViewer, PaginatedPdfHandle } from './PaginatedPdfViewer';
import { fireSessionComplete } from '../utils/sessionNotify';

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
  /** Called when credits are earned directly (does NOT affect pts/totalScore) */
  onCreditsEarned?: (credits: number, activity: string) => void;
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
  onCreditsEarned,
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
  const [rotated, setRotated] = useState(false);
  const [nightMode, setNightMode] = useState<NightMode>('normal');
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Immersive by default — controls hide on open, tap anywhere to reveal
  const [headerVisible, setHeaderVisible] = useState(false);
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
  const [pdfLoadFailed, setPdfLoadFailed] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const paginatedRef = useRef<PaginatedPdfHandle>(null);
  const headerHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const jumpInputRef = useRef<HTMLInputElement>(null);

  // ── PDF time-based score session: 60s/min → +10 credits with ≥5% scroll check ──
  const pdfScoreSessionRef = useRef<ReadingScoreSession | null>(null);
  const [pdfScoreState, setPdfScoreState] = useState<ReadingScoreState | null>(null);

  // Score chip tooltip
  const [pdfScoreTooltip, setPdfScoreTooltip] = useState(false);
  // Track credits earned this PDF session so we can queue a session-complete event on exit
  const pdfSessionCreditsRef = useRef(0);
  const pdfSessionStartMsRef = useRef(Date.now());

  useEffect(() => {
    if (!userId) return;
    pdfSessionStartMsRef.current = Date.now();
    pdfSessionCreditsRef.current = 0;
    const session = new ReadingScoreSession(
      {
        userId,
        userLevel,
        subscriptionLevel,
        isPremium,
        boostPercent: boostPercent || 0,
        mode: 'pdf',
        // PDF earns pts — onScoreEarned updates totalScore
        onScoreEarned: (pts) => {
          pdfSessionCreditsRef.current += pts;
          onScoreEarned?.(pts);
        },
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

  /** Back handler — fires session-complete event then calls onBack. */
  const handleBack = useCallback(() => {
    if (pdfSessionCreditsRef.current > 0) {
      const secs = Math.round((Date.now() - pdfSessionStartMsRef.current) / 1000);
      fireSessionComplete({
        type: 'LESSON',
        subject: '',
        chapter: title || '',
        timeSecs: secs,
        activityType: 'PDF',
        sessionScore: pdfSessionCreditsRef.current,
      });
      pdfSessionCreditsRef.current = 0;
    }
    onBack();
  }, [onBack, title]);

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
    // Paginated viewer: scroll to that page
    paginatedRef.current?.scrollToPage(valid);
    // Iframe fallback: reload src with #page=N
    if (pdfLoadFailed) setIframeSrc(buildSrc(url, valid));
  }, [url, totalPages, savePage, pdfLoadFailed]);

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

  // Progress milestones + scroll % update for credit session
  useEffect(() => {
    if (!userId || totalPages <= 0) return;
    const pct = Math.round((currentPage / totalPages) * 100);

    // Feed scroll % into the credit session so it can check ≥5% scroll/min
    pdfScoreSessionRef.current?.updateProgress(pct);

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

  // Exit fullscreen + unlock orientation when PDF viewer is closed/unmounted
  useEffect(() => {
    return () => {
      try { if (document.fullscreenElement) document.exitFullscreen(); } catch (_) {}
      try {
        const so: any = (screen as any).orientation;
        if (so && typeof so.unlock === 'function') so.unlock();
      } catch (_) {}
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

  // Auto-fullscreen on mobile when PDF opens
  useEffect(() => {
    const isMobile = /Mobi|Android/i.test(navigator.userAgent);
    if (isMobile && containerRef.current && !document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-hide header after 3s whenever visible (immersive mode — fullscreen or not)
  useEffect(() => {
    if (!headerVisible) return;
    if (headerHideTimer.current) clearTimeout(headerHideTimer.current);
    headerHideTimer.current = setTimeout(() => setHeaderVisible(false), 3000);
    return () => { if (headerHideTimer.current) clearTimeout(headerHideTimer.current); };
  }, [headerVisible]);

  const revealHeader = () => {
    setHeaderVisible(true);
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
  // Toggle rotate: CSS rotation + device orientation lock so the whole phone rotates
  const toggleRotate = useCallback(async () => {
    const next = !rotated;
    setRotated(next);
    showToast(next ? 'Landscape mode' : 'Portrait mode');

    try {
      const so: any = (screen as any).orientation;
      if (!so || typeof so.lock !== 'function') return;

      if (next) {
        // Going landscape — try without fullscreen first (works in PWA / Android Chrome)
        let locked = false;
        for (const target of ['landscape-primary', 'landscape'] as const) {
          try { await so.lock(target); locked = true; break; } catch { /* try next */ }
        }
        if (!locked) {
          // Fallback: enter fullscreen briefly so lock API is allowed
          try {
            const el: any = document.documentElement;
            if (el.requestFullscreen) await el.requestFullscreen();
            else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
            for (const target of ['landscape-primary', 'landscape'] as const) {
              try { await so.lock(target); break; } catch { /* try next */ }
            }
          } catch { /* orientation lock not supported — CSS rotation still works */ }
        }
      } else {
        // Going back to portrait — unlock so the OS takes over again
        so.unlock();
      }
    } catch { /* device/browser doesn't support orientation lock — CSS fallback is enough */ }
  }, [rotated, showToast]);

  // Rotate the entire viewer container like a video player going landscape.
  // Must override right/bottom from the className's inset-0 so they don't
  // constrain the swapped width/height when rotated.
  const containerStyle: React.CSSProperties = rotated
    ? {
        position: 'fixed',
        top: '50%',
        left: '50%',
        right: 'auto',
        bottom: 'auto',
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
      className="fixed inset-0 z-50 bg-black"
      style={containerStyle}
      onTouchStart={revealHeader}
      onPointerMove={revealHeader}
    >
      {/* ── PDF fills the full screen, always ── */}
      {!pdfLoadFailed ? (
        <PaginatedPdfViewer
          ref={paginatedRef}
          url={url}
          nightFilter={nightFilter}
          onLoadSuccess={(n) => {
            if (n > 0 && totalPages !== n) {
              setTotalPages(n);
              try { localStorage.setItem(TOTAL_KEY(key), String(n)); } catch {}
            }
          }}
          onPageChange={(page) => {
            setCurrentPage(page);
            savePage(page);
          }}
          onLoadError={() => setPdfLoadFailed(true)}
        />
      ) : (
        /* ── CORS fallback: classic iframe ── */
        <div className="absolute inset-0 overflow-auto" style={{ filter: nightFilter }}>
          <iframe
            ref={iframeRef}
            key={iframeSrc}
            src={iframeSrc}
            className="w-full h-full border-none"
            title={title}
            allowFullScreen
          />
        </div>
      )}

      {/* ── Overlaid Header (slides in/out from top) ── */}
      <header
        className={`absolute top-0 left-0 right-0 bg-slate-900/95 backdrop-blur text-white px-3 py-2 flex items-center gap-2 z-20 transition-all duration-300 ${
          !headerVisible ? 'opacity-0 pointer-events-none -translate-y-full' : 'opacity-100'
        }`}
      >
        {/* Back */}
        <button onClick={handleBack} className="p-2 bg-white/10 rounded-xl active:bg-white/20 transition shrink-0">
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

        {/* Live PDF score chip — always visible */}
        <div className="relative shrink-0" style={{ zIndex: 50 }}>
          <span
            onClick={() => { setPdfScoreTooltip(true); setTimeout(() => setPdfScoreTooltip(false), 2500); }}
            style={{ fontSize: '10px', fontWeight: 900, color: '#86efac', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.28)', borderRadius: 99, padding: '2px 7px', whiteSpace: 'nowrap', cursor: 'pointer', display: 'block' }}>
            📖 {pdfScoreState
              ? `+${pdfScoreState.totalSessionScore}pts`
              : '+0pts'}
          </span>
           {pdfScoreTooltip && (
            <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 6, background: 'linear-gradient(135deg,#eef2ff,#f5f3ff)', border: '1.5px solid rgba(99,102,241,0.2)', borderTopWidth: 2, borderTopColor: '#16a34a', borderTop: '2px solid #16a34a', borderRadius: 12, padding: '7px 12px', whiteSpace: 'nowrap', zIndex: 100, boxShadow: '0 4px 20px rgba(22,163,74,0.15), inset 0 -1px 0 #c7d2fe', animation: 'rshud-slide 0.18s ease', display: 'flex', alignItems: 'center', gap: 8, minWidth: 260 }}>
              <span style={{ fontSize: 14, flexShrink: 0 }}>📄</span>
              <span style={{ fontSize: 10, fontWeight: 900, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>PDF Score</span>
              <div style={{ width: 1, height: 14, background: '#e2e8f0', flexShrink: 0 }} />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 7, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1 }}>Score</span>
                <span style={{ fontSize: 13, fontWeight: 900, color: '#16a34a', lineHeight: 1.2 }}>+{pdfScoreState ? pdfScoreState.totalSessionScore : 0}</span>
              </div>
              <div style={{ width: 1, height: 14, background: '#e2e8f0', flexShrink: 0 }} />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 7, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1 }}>Progress</span>
                <span style={{ fontSize: 13, fontWeight: 900, color: '#16a34a', lineHeight: 1.2 }}>{pdfScoreState ? `${Math.round(pdfScoreState.progressPercent ?? 0)}%` : '0%'}</span>
              </div>
              <div style={{ width: 1, height: 14, background: '#e2e8f0', flexShrink: 0 }} />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 7, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1 }}>Next</span>
                <span style={{ fontSize: 11, fontWeight: 900, color: pdfScoreState?.isPermanentlyStopped ? '#ef4444' : '#f59e0b', lineHeight: 1.2 }}>
                  {pdfScoreState?.isPermanentlyStopped ? 'Scroll karo' : pdfScoreState?.isPaused ? 'Paused' : `+5 in ${pdfScoreState?.nextRewardInSec ?? 30}s`}
                </span>
              </div>
              <div style={{ flex: 1 }} />
              <button onClick={() => setPdfScoreTooltip(false)} style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 11, fontWeight: 900, cursor: 'pointer', flexShrink: 0, padding: 0 }}>✕</button>
            </div>
          )}        </div>

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

      {/* More menu — slides in just below the header */}
      {showMoreMenu && headerVisible && (
        <div className="absolute top-[48px] left-0 right-0 bg-slate-800/98 border-t border-white/10 flex items-stretch z-20 animate-in slide-in-from-top-1 duration-150">
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
        </div>
      )}

      {/* Progress bar — thin strip above bottom bar when controls visible */}
      {totalPages > 0 && headerVisible && (
        <div className="absolute bottom-[52px] left-0 right-0 h-1 bg-slate-700/60 z-20">
          <div
            className="h-full bg-gradient-to-r from-indigo-400 to-violet-400 transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}

      {/* ── Overlaid Bottom toolbar (slides in/out from bottom) ── */}
      <div className={`absolute bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur text-white px-3 py-2 flex items-center gap-2 z-20 transition-all duration-300 ${!headerVisible ? 'opacity-0 pointer-events-none translate-y-full' : 'opacity-100'}`}>
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

      {/* ── Modals / overlays ── */}

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
