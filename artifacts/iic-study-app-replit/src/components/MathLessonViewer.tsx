import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  BookOpen,
  FileText,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  ScrollText,
  Layers,
  Check,
  X,
  Timer,
  RefreshCw,
  Sparkles,
  HelpCircle,
  Share2,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { renderMathInHtml } from '../utils/mathUtils';
import { saveTestResult, saveUserHistory } from '../firebase';
import { LessonContent, MCQItem, User, MathImagePage } from '../types';
import { DraggableNstaLogoFab } from './DraggableNstaLogoFab';

export type MathMode = 'BOOK' | 'PREMIUM_NOTES' | 'SOLUTION' | 'MCQ';

interface Props {
  content: LessonContent;
  chapterTitle: string;
  subjectName?: string;
  user: User;
  appLogo?: string;
  appName?: string;
  isImmersive?: boolean;
  onToggleImmersive?: () => void;
  onBack: () => void;
  onUpdateUser?: (u: User) => void;
  onSessionCreditsEarned?: (credits: number) => void;
  onModeChange?: (mode: MathMode) => void;
}

export const MathLessonViewer: React.FC<Props> = ({
  content,
  chapterTitle,
  subjectName = 'Mathematics',
  user,
  appLogo,
  appName = 'NSTA',
  isImmersive: propIsImmersive,
  onToggleImmersive: propOnToggleImmersive,
  onBack,
  onUpdateUser,
  onSessionCreditsEarned,
  onModeChange,
}) => {
  // Extract pages safely
  const bookPages: MathImagePage[] = content.mathBookPages || [];
  const premiumNotesPages: MathImagePage[] = content.mathPremiumNotesPages || [];
  const solutionPages: MathImagePage[] = content.mathSolutionPages || [];
  const mcqs: MCQItem[] = content.mcqData || [];

  // Dynamic modes list — only include modes that have content!
  const availableModes = React.useMemo(() => {
    const list: { id: MathMode; label: string; icon: any; count: number; badgeColor: string }[] = [];
    if (bookPages.length > 0) {
      list.push({
        id: 'BOOK',
        label: 'Book Pages',
        icon: BookOpen,
        count: bookPages.length,
        badgeColor: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      });
    }
    if (premiumNotesPages.length > 0) {
      list.push({
        id: 'PREMIUM_NOTES',
        label: 'Premium Notes',
        icon: FileText,
        count: premiumNotesPages.length,
        badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      });
    }
    if (solutionPages.length > 0) {
      list.push({
        id: 'SOLUTION',
        label: 'Book Solution',
        icon: CheckCircle2,
        count: solutionPages.length,
        badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      });
    }
    if (mcqs.length > 0) {
      list.push({
        id: 'MCQ',
        label: 'MCQ Practice',
        icon: Sparkles,
        count: mcqs.length,
        badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      });
    }
    return list;
  }, [bookPages.length, premiumNotesPages.length, solutionPages.length, mcqs.length]);

  // Active mode state (default to first available mode)
  const [activeMode, setActiveMode] = useState<MathMode>(() => {
    return availableModes[0]?.id || 'BOOK';
  });

  // Ensure active mode is valid if modes change
  useEffect(() => {
    if (availableModes.length > 0 && !availableModes.some(m => m.id === activeMode)) {
      setActiveMode(availableModes[0].id);
    }
  }, [availableModes, activeMode]);

  useEffect(() => {
    onModeChange?.(activeMode);
  }, [activeMode, onModeChange]);

  // Reading view type: 'SCROLL' (Continuous vertical roll) vs 'FLIP' (Page-by-page next/prev)
  const [viewType, setViewType] = useState<'SCROLL' | 'FLIP'>('SCROLL');
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);
  // Page Rotation state (0, 90, 180, 270 degrees) for rotating scans/pages upright
  const [pageRotation, setPageRotation] = useState<number>(0);

  // Unified Immersive State (Controls BOTH top bar AND bottom nav)
  const [internalImmersive, setInternalImmersive] = useState(false);
  const isImmersive = propIsImmersive !== undefined ? propIsImmersive : internalImmersive;
  const toggleImmersive = () => {
    if (propOnToggleImmersive) {
      propOnToggleImmersive();
    } else {
      setInternalImmersive(prev => !prev);
    }
  };

  // Helper to format clean page title (e.g. cleans up ugly "Page 1328601" into "Page 1")
  const getCleanPageTitle = (rawTitle: string | undefined, idx: number) => {
    if (!rawTitle) return `Page ${idx + 1}`;
    const trimmed = rawTitle.trim();
    if (/^page[\s_-]*\d{4,}$/i.test(trimmed) || /^\d{4,}$/.test(trimmed)) {
      return `Page ${idx + 1}`;
    }
    return trimmed;
  };

  // Panning & Touch Gestures for Zoom
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const initialPinchDistRef = useRef<number | null>(null);
  const initialZoomRef = useRef(1);
  const lastTapRef = useRef<number>(0);

  // Current active pages based on activeMode
  const currentPages: MathImagePage[] = React.useMemo(() => {
    if (activeMode === 'BOOK') return bookPages;
    if (activeMode === 'PREMIUM_NOTES') return premiumNotesPages;
    if (activeMode === 'SOLUTION') return solutionPages;
    return [];
  }, [activeMode, bookPages, premiumNotesPages, solutionPages]);

  // Reset pan and zoom on page or mode change
  useEffect(() => {
    if (zoomLevel <= 1) {
      setPan({ x: 0, y: 0 });
    }
  }, [zoomLevel, currentPageIndex, activeMode]);

  useEffect(() => {
    setCurrentPageIndex(0);
    setZoomLevel(1);
    setPan({ x: 0, y: 0 });
    setPageRotation(0);
  }, [activeMode]);

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Track active page during continuous scrolling
  useEffect(() => {
    if (viewType !== 'SCROLL' || !scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const handleScroll = () => {
      const pageElements = container.querySelectorAll<HTMLElement>('[data-math-page]');
      const containerTop = container.scrollTop;
      const containerCenter = containerTop + container.clientHeight / 3;

      pageElements.forEach((el, idx) => {
        const top = el.offsetTop;
        const bottom = top + el.offsetHeight;
        if (containerCenter >= top && containerCenter <= bottom) {
          setCurrentPageIndex(idx);
        }
      });
    };
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [viewType, currentPages.length]);

  // Zoom controls
  const handleZoomIn = () => setZoomLevel(prev => Math.min(Number((prev + 0.25).toFixed(2)), 3.0));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(Number((prev - 0.25).toFixed(2)), 0.75));
  const handleZoomReset = () => {
    setZoomLevel(1);
    setPan({ x: 0, y: 0 });
  };

  // Check if physical screen is in landscape mode
  const [isWindowLandscape, setIsWindowLandscape] = useState(() => {
    return typeof window !== 'undefined' ? window.innerWidth > window.innerHeight : false;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsWindowLandscape(window.innerWidth > window.innerHeight);
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  // Touch and Mouse handlers for interactive Zoom & Pan
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      initialPinchDistRef.current = dist;
      initialZoomRef.current = zoomLevel;
    } else if (e.touches.length === 1) {
      const now = Date.now();
      if (now - lastTapRef.current < 300) {
        // Double-tap to toggle zoom
        if (zoomLevel > 1.1) {
          handleZoomReset();
        } else {
          setZoomLevel(1.8);
        }
        lastTapRef.current = 0;
        return;
      }
      lastTapRef.current = now;

      if (zoomLevel > 1) {
        isDraggingRef.current = true;
        dragStartRef.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
          panX: pan.x,
          panY: pan.y,
        };
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialPinchDistRef.current) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const factor = dist / initialPinchDistRef.current;
      const newZoom = Math.min(Math.max(Number((initialZoomRef.current * factor).toFixed(2)), 0.75), 3.0);
      setZoomLevel(newZoom);
    } else if (e.touches.length === 1 && isDraggingRef.current && zoomLevel > 1) {
      const dx = e.touches[0].clientX - dragStartRef.current.x;
      const dy = e.touches[0].clientY - dragStartRef.current.y;
      setPan({
        x: dragStartRef.current.panX + dx,
        y: dragStartRef.current.panY + dy,
      });
    }
  };

  const handleTouchEnd = () => {
    initialPinchDistRef.current = null;
    isDraggingRef.current = false;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomLevel > 1) {
      isDraggingRef.current = true;
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        panX: pan.x,
        panY: pan.y,
      };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current || zoomLevel <= 1) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPan({
      x: dragStartRef.current.panX + dx,
      y: dragStartRef.current.panY + dy,
    });
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  // Container is always naturally positioned so headers stay top, controls stay upright,
  // and outer navigation integrates perfectly without letterboxing or black gaps.
  const containerStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  };

  // ===================== MCQ QUIZ STATE =====================
  const [currentMcqIndex, setCurrentMcqIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [revealedExplanations, setRevealedExplanations] = useState<Record<number, boolean>>({});
  const [quizFinished, setQuizFinished] = useState(false);
  const [quizSeconds, setQuizSeconds] = useState(0);

  // Quiz timer
  useEffect(() => {
    if (activeMode !== 'MCQ' || quizFinished || mcqs.length === 0) return;
    const timer = setInterval(() => {
      setQuizSeconds(s => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [activeMode, quizFinished, mcqs.length]);

  const handleSelectOption = (optIndex: number) => {
    if (quizFinished || selectedAnswers[currentMcqIndex] !== undefined) return;
    setSelectedAnswers(prev => ({ ...prev, [currentMcqIndex]: optIndex }));
    setRevealedExplanations(prev => ({ ...prev, [currentMcqIndex]: true }));
  };

  const handleFinishQuiz = async () => {
    setQuizFinished(true);
    let correctCount = 0;
    mcqs.forEach((q, idx) => {
      if (selectedAnswers[idx] === q.correctAnswer) {
        correctCount++;
      }
    });

    const score = Math.round((correctCount / Math.max(mcqs.length, 1)) * 100);
    const resultPayload = {
      id: `math_result_${Date.now()}`,
      userId: user.id,
      chapterId: content.id || 'math_chapter',
      subjectId: 'math',
      subjectName,
      chapterTitle,
      date: new Date().toISOString(),
      totalQuestions: mcqs.length,
      correctCount,
      wrongCount: mcqs.length - correctCount,
      score,
      totalTimeSeconds: quizSeconds,
      averageTimePerQuestion: Math.round(quizSeconds / Math.max(mcqs.length, 1)),
      performanceTag: (score >= 80 ? 'EXCELLENT' : score >= 50 ? 'GOOD' : 'BAD') as any,
      questions: mcqs,
      userAnswers: selectedAnswers,
      createdAt: new Date().toISOString(),
    };

    try {
      await saveTestResult(user.id, resultPayload as any);
      await saveUserHistory(user.id, {
        id: resultPayload.id,
        title: `Math MCQ: ${chapterTitle}`,
        type: 'MCQ_ANALYSIS',
        score,
        date: new Date().toISOString(),
        details: `${correctCount}/${mcqs.length} correct`,
      } as any);

      // Award credits
      if (onSessionCreditsEarned && correctCount > 0) {
        onSessionCreditsEarned(Math.min(correctCount * 2, 20));
      }
    } catch (err) {
      console.warn('Could not save math test result:', err);
    }
  };

  const handleRestartQuiz = () => {
    setSelectedAnswers({});
    setRevealedExplanations({});
    setCurrentMcqIndex(0);
    setQuizFinished(false);
    setQuizSeconds(0);
  };

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div
      ref={containerRef}
      className="flex flex-col bg-slate-950 text-slate-100 select-none overflow-hidden"
      style={containerStyle}
    >
      {/* ── TOP BAR: BACK & LESSON TITLE & READING MODES & CONTROLS ── */}
      <div
        className={`sticky top-0 z-30 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-2.5 sm:px-3 py-2 flex items-center justify-between gap-2 shadow-md transition-all duration-200 ${
          isImmersive ? '-translate-y-full opacity-0 pointer-events-none h-0 py-0 border-none overflow-hidden' : 'translate-y-0 opacity-100'
        }`}
      >
        {/* Left: Back Button + Lesson Name (where Mathematics was) + Flip & Scroll Mode Buttons (where lesson name was) */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button
            onClick={onBack}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center shrink-0 active:scale-95 transition cursor-pointer border border-slate-700/50"
            title="Wapas Jayein"
          >
            <ArrowLeft size={17} />
          </button>

          {/* Lesson Title in place of Mathematics */}
          <h1
            className="text-xs sm:text-sm font-black text-white truncate max-w-[130px] xs:max-w-[170px] sm:max-w-[220px] md:max-w-xs shrink-0"
            title={chapterTitle}
          >
            {chapterTitle}
          </h1>

          {/* Flip Mode & Scroll Mode buttons in place of lesson title */}
          {activeMode !== 'MCQ' && currentPages.length > 1 && (
            <div className="flex items-center bg-slate-800/90 rounded-xl p-0.5 border border-slate-700/60 shrink-0 ml-0.5">
              <button
                onClick={() => setViewType('SCROLL')}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] sm:text-[11px] font-bold transition-all cursor-pointer ${
                  viewType === 'SCROLL'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Continuous Scroll Mode: Ek single roll me saare pages niche scroll honge"
              >
                <ScrollText size={12} />
                <span className="hidden xs:inline">Scroll Mode</span>
                <span className="xs:hidden">Scroll</span>
              </button>
              <button
                onClick={() => setViewType('FLIP')}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] sm:text-[11px] font-bold transition-all cursor-pointer ${
                  viewType === 'FLIP'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Flip Mode: Next / Previous buttons se ek-ek page badlein"
              >
                <Layers size={12} />
                <span className="hidden xs:inline">Flip Mode</span>
                <span className="xs:hidden">Flip</span>
              </button>
            </div>
          )}
        </div>

        {/* Right: Quick Action Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Zoom In/Out (Available for Picture Modes) - Visible on mobile & desktop */}
          {activeMode !== 'MCQ' && (
            <div className="flex items-center bg-slate-800/80 rounded-xl p-0.5 border border-slate-700/60 shrink-0">
              <button
                onClick={handleZoomOut}
                disabled={zoomLevel <= 0.75}
                className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-700/60 disabled:opacity-30 active:scale-90 transition cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut size={13} />
              </button>
              <button
                onClick={handleZoomReset}
                className="px-1.5 sm:px-2 h-6 sm:h-7 text-[10px] font-mono font-bold text-slate-300 hover:text-white cursor-pointer"
                title="Reset Zoom (100%)"
              >
                {Math.round(zoomLevel * 100)}%
              </button>
              <button
                onClick={handleZoomIn}
                disabled={zoomLevel >= 3.0}
                className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-700/60 disabled:opacity-30 active:scale-90 transition cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn size={13} />
              </button>
            </div>
          )}

          {/* Rotate Page (0°, 90°, 180°, 270°) - Keeps header upright & accessible */}
          {activeMode !== 'MCQ' && (
            <button
              onClick={() => setPageRotation(r => (r + 90) % 360)}
              className={`w-8 h-8 rounded-xl flex items-center justify-center transition active:scale-95 border cursor-pointer ${
                pageRotation !== 0
                  ? 'bg-blue-600 text-white border-blue-400 shadow-md ring-2 ring-blue-400/40'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border-slate-700/60'
              }`}
              title={pageRotation !== 0 ? `Page Rotated (${pageRotation}°). Tap to rotate to ${(pageRotation + 90) % 360}°` : "Rotate Page (0° -> 90° -> 180° -> 270°)"}
            >
              <RotateCw size={14} className={pageRotation !== 0 ? 'text-white' : ''} />
            </button>
          )}

          {/* Focus Mode Toggle Button (Toggles BOTH Top Bar and Bottom Nav) */}
          <button
            onClick={toggleImmersive}
            className={`w-8 h-8 rounded-xl flex items-center justify-center transition active:scale-95 border cursor-pointer ${
              isImmersive
                ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-md ring-2 ring-amber-400/40'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border-slate-700/60'
            }`}
            title={isImmersive ? "बॉटम व टॉप बार दिखाएं" : "बॉटम व टॉप बार छुपाएं (Full Focus)"}
          >
            {isImmersive ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
        </div>
      </div>

      {/* ── MODE SELECTOR BAR (ONLY SHOWN IF MULTIPLE CONTENT MODES EXIST) ── */}
      {availableModes.length > 1 && (
        <div
          className={`bg-slate-900/90 border-b border-slate-800/80 px-2.5 py-1.5 flex items-center justify-start gap-2 overflow-x-auto scrollbar-none transition-all duration-200 ${
            isImmersive ? '-translate-y-full opacity-0 pointer-events-none h-0 py-0 overflow-hidden' : ''
          }`}
        >
          {/* Tabs row: Book -> Premium Notes -> Solution -> MCQ */}
          <div className="flex items-center gap-1.5 shrink-0">
            {availableModes.map(mode => {
              const Icon = mode.icon;
              const isActive = activeMode === mode.id;
              return (
                <button
                  key={mode.id}
                  onClick={() => {
                    setActiveMode(mode.id);
                    setZoomLevel(1);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap active:scale-95 border ${
                    isActive
                      ? 'bg-blue-600 text-white border-blue-400 shadow-sm shadow-blue-500/30'
                      : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border-slate-700/40'
                  }`}
                >
                  <Icon size={14} className={isActive ? 'text-white' : 'text-slate-400'} />
                  <span>{mode.label}</span>
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                      isActive ? 'bg-white/20 text-white' : mode.badgeColor
                    }`}
                  >
                    {mode.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── MAIN CONTENT AREA ── */}
      <div className="flex-1 relative flex flex-col overflow-hidden bg-slate-950">
        {/* NO CONTENT STATE */}
        {availableModes.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-400">
            <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-3xl mb-3 shadow-lg">
              📐
            </div>
            <h3 className="text-base font-bold text-white mb-1">Math Material Available Nahi Hai</h3>
            <p className="text-xs text-slate-400 max-w-sm">
              Admin ne is chapter me abhi Book, Premium Notes ya MCQ add nahi kiya hai.
            </p>
          </div>
        )}

        {/* ── PICTURE MODES (BOOK, PREMIUM NOTES, SOLUTION) ── */}
        {activeMode !== 'MCQ' && currentPages.length > 0 && (
          <div className="relative flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Quick floating reset zoom / rotation pill if zoomed or rotated */}
            {(zoomLevel !== 1 || pageRotation !== 0) && (
              <button
                onClick={() => {
                  handleZoomReset();
                  setPageRotation(0);
                }}
                className="absolute top-2 left-1/2 -translate-x-1/2 z-30 bg-slate-900/90 hover:bg-slate-800 text-amber-300 border border-amber-500/40 rounded-full px-3 py-1 text-[11px] font-bold shadow-lg flex items-center gap-1.5 backdrop-blur-md active:scale-95 transition cursor-pointer"
              >
                <span>🔍 {Math.round(zoomLevel * 100)}%</span>
                {pageRotation !== 0 && (
                  <>
                    <span className="text-slate-400">•</span>
                    <span>🔄 {pageRotation}°</span>
                  </>
                )}
                <span className="text-slate-400">•</span>
                <span className="text-xs text-white">Reset</span>
              </button>
            )}

            {/* OPTION B: CONTINUOUS SCROLL MODE (SINGLE VERTICAL ROLL) */}
            {viewType === 'SCROLL' ? (
              <div
                ref={scrollContainerRef}
                className="flex-1 overflow-y-auto overflow-x-auto p-2 sm:p-4 space-y-4 pb-24 scroll-smooth"
              >
                <div
                  className="mx-auto flex flex-col items-center transition-transform duration-150 origin-top"
                  style={{
                    transform: `scale(${zoomLevel})`,
                    transformOrigin: 'top center',
                    width: zoomLevel > 1 ? `${Math.round(zoomLevel * 100)}%` : '100%',
                    maxWidth: zoomLevel > 1 ? 'none' : '56rem',
                  }}
                >
                  {currentPages.map((page, idx) => (
                    <div
                      key={page.id || `page_${idx}`}
                      data-math-page={idx}
                      className="w-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl mb-4 group"
                    >
                      {/* Page Header Strip */}
                      <div className="bg-slate-800/80 px-4 py-2 flex items-center justify-between border-b border-slate-700/50">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[10px] font-mono font-black flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <span className="text-xs font-bold text-slate-300">
                            {getCleanPageTitle(page.title, idx)}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400">
                          {idx + 1} / {currentPages.length}
                        </span>
                      </div>

                      {/* Image Content */}
                      <div className="relative bg-black flex items-center justify-center min-h-[300px] overflow-hidden p-1">
                        <img
                          src={page.imageUrl}
                          alt={getCleanPageTitle(page.title, idx)}
                          loading="lazy"
                          className="w-full h-auto object-contain max-h-[85vh] select-none pointer-events-auto transition-transform duration-200"
                          style={pageRotation !== 0 ? {
                            transform: `rotate(${pageRotation}deg)`,
                            transformOrigin: 'center center',
                          } : undefined}
                        />
                      </div>

                      {page.caption && (
                        <div className="p-2.5 bg-slate-900/90 border-t border-slate-800 text-[11px] text-slate-300">
                          {page.caption}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* OPTION A: FLIP MODE (PAGE-BY-PAGE NEXT / PREV) */
              <div className="flex-1 relative flex flex-col items-center justify-center p-2 sm:p-4 overflow-hidden">
                <div
                  className={`w-full max-w-3xl flex-1 flex flex-col items-center justify-center overflow-hidden transition-transform duration-100 ${
                    zoomLevel > 1 ? 'cursor-grab active:cursor-grabbing touch-none' : ''
                  }`}
                  style={{
                    transform: `scale(${zoomLevel}) rotate(${pageRotation}deg) translate(${pan.x / zoomLevel}px, ${pan.y / zoomLevel}px)`,
                    transformOrigin: 'center center',
                  }}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                >
                  {currentPages[currentPageIndex] && (
                    <div className="w-full h-full flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
                      {/* Top Page Header */}
                      <div className="bg-slate-800/90 px-4 py-2 flex items-center justify-between border-b border-slate-700/60">
                        <span className="text-xs font-bold text-slate-200">
                          {getCleanPageTitle(currentPages[currentPageIndex].title, currentPageIndex)}
                        </span>
                        <span className="text-xs font-mono font-black px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                          Page {currentPageIndex + 1} of {currentPages.length}
                        </span>
                      </div>

                      {/* Single Page Image */}
                      <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden min-h-0">
                        <img
                          src={currentPages[currentPageIndex].imageUrl}
                          alt={getCleanPageTitle(currentPages[currentPageIndex].title, currentPageIndex)}
                          className="w-full h-full object-contain pointer-events-none select-none max-h-[75vh] sm:max-h-[82vh]"
                          draggable={false}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Flip Mode Navigation Controls */}
                <div
                  className={`w-full max-w-md mx-auto mt-3 flex items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 rounded-2xl px-4 py-2 shadow-lg transition-all duration-200 ${
                    isImmersive ? 'translate-y-full opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'
                  }`}
                >
                  <button
                    onClick={() => setCurrentPageIndex(p => Math.max(p - 1, 0))}
                    disabled={currentPageIndex === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 text-slate-200 hover:bg-slate-700 disabled:opacity-30 active:scale-95 transition cursor-pointer"
                  >
                    <ChevronLeft size={16} />
                    <span>Previous</span>
                  </button>

                  <span className="text-xs font-mono font-black text-slate-300">
                    {currentPageIndex + 1} / {currentPages.length}
                  </span>

                  <button
                    onClick={() => setCurrentPageIndex(p => Math.min(p + 1, currentPages.length - 1))}
                    disabled={currentPageIndex >= currentPages.length - 1}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-30 active:scale-95 transition cursor-pointer shadow-sm"
                  >
                    <span>Next</span>
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* Bottom Floating Page Status Bar */}
            <div
              className={`absolute bottom-2 left-1/2 -translate-x-1/2 z-20 bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-full px-4 py-1.5 flex items-center gap-3 shadow-xl transition-all duration-200 ${
                isImmersive ? 'translate-y-full opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'
              }`}
            >
              <span className="text-[11px] font-mono font-black text-slate-300">
                📄 Page {currentPageIndex + 1} of {currentPages.length}
              </span>
              <div className="w-px h-3 bg-slate-700" />
              <span className="text-[10px] font-bold text-slate-400">
                {activeMode === 'BOOK' ? '📖 Book' : activeMode === 'PREMIUM_NOTES' ? '📑 Notes' : '💡 Solution'}
              </span>
            </div>
          </div>
        )}

        {/* ── MODE 4: MCQ PRACTICE (LIVE INTERACTIVE QUIZ) ── */}
        {activeMode === 'MCQ' && mcqs.length > 0 && (
          <div className="flex-1 overflow-y-auto p-3 sm:p-5 flex flex-col justify-between max-w-3xl mx-auto w-full">
            {!quizFinished ? (
              <div className="flex-1 flex flex-col justify-between space-y-4">
                {/* MCQ Header Strip */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 flex items-center justify-between gap-3 shadow-md">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-black px-2.5 py-1 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Q {currentMcqIndex + 1} / {mcqs.length}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-400">
                      {chapterTitle}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 text-xs font-mono font-black text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-xl border border-emerald-500/20">
                      <Timer size={13} />
                      <span>{formatTimer(quizSeconds)}</span>
                    </div>
                  </div>
                </div>

                {/* Question Card */}
                {mcqs[currentMcqIndex] && (
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
                    <div className="flex items-start gap-3">
                      <span className="w-7 h-7 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 font-black text-xs flex items-center justify-center shrink-0">
                        {currentMcqIndex + 1}
                      </span>
                      <div
                        className="text-sm sm:text-base font-bold text-white leading-relaxed flex-1"
                        dangerouslySetInnerHTML={{
                          __html: renderMathInHtml(mcqs[currentMcqIndex].question),
                        }}
                      />
                    </div>

                    {/* Options Grid */}
                    <div className="space-y-2.5 pt-2">
                      {mcqs[currentMcqIndex].options.map((opt, optIdx) => {
                        const optLetter = String.fromCharCode(65 + optIdx);
                        const isSelected = selectedAnswers[currentMcqIndex] === optIdx;
                        const isCorrect = optIdx === mcqs[currentMcqIndex].correctAnswer;
                        const hasAnswered = selectedAnswers[currentMcqIndex] !== undefined;

                        let btnStyle = 'bg-slate-800/70 hover:bg-slate-800 border-slate-700/60 text-slate-200';
                        if (hasAnswered) {
                          if (isCorrect) {
                            btnStyle = 'bg-emerald-600/25 border-emerald-500 text-emerald-200 shadow-sm';
                          } else if (isSelected) {
                            btnStyle = 'bg-red-600/25 border-red-500 text-red-200 shadow-sm';
                          } else {
                            btnStyle = 'bg-slate-900/40 border-slate-800 text-slate-500 opacity-60';
                          }
                        }

                        return (
                          <button
                            key={optIdx}
                            onClick={() => handleSelectOption(optIdx)}
                            disabled={hasAnswered}
                            className={`w-full p-3.5 rounded-xl border text-left flex items-center gap-3 transition-all cursor-pointer ${btnStyle}`}
                          >
                            <span
                              className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center shrink-0 border ${
                                hasAnswered && isCorrect
                                  ? 'bg-emerald-500 text-white border-emerald-400'
                                  : hasAnswered && isSelected
                                  ? 'bg-red-500 text-white border-red-400'
                                  : 'bg-slate-700 text-slate-300 border-slate-600'
                              }`}
                            >
                              {optLetter}
                            </span>
                            <div
                              className="text-xs sm:text-sm font-semibold flex-1 leading-snug"
                              dangerouslySetInnerHTML={{ __html: renderMathInHtml(opt) }}
                            />
                            {hasAnswered && isCorrect && <Check size={16} className="text-emerald-400 shrink-0" />}
                            {hasAnswered && isSelected && !isCorrect && <X size={16} className="text-red-400 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>

                    {/* Step-by-Step Math Solution / Explanation */}
                    {revealedExplanations[currentMcqIndex] && mcqs[currentMcqIndex].explanation && (
                      <div className="mt-4 p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/70 space-y-1.5 animate-in fade-in duration-200">
                        <div className="flex items-center gap-1.5 text-xs font-black text-amber-400">
                          <HelpCircle size={14} />
                          <span>Math Explanation &amp; Solution:</span>
                        </div>
                        <div
                          className="text-xs sm:text-sm text-slate-300 leading-relaxed pl-5 font-medium"
                          dangerouslySetInnerHTML={{
                            __html: renderMathInHtml(mcqs[currentMcqIndex].explanation),
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Bottom Navigation Buttons */}
                <div className="flex items-center justify-between gap-3 pt-2">
                  <button
                    onClick={() => setCurrentMcqIndex(p => Math.max(p - 1, 0))}
                    disabled={currentMcqIndex === 0}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-30 active:scale-95 transition cursor-pointer"
                  >
                    <ChevronLeft size={16} />
                    <span>Previous</span>
                  </button>

                  {currentMcqIndex < mcqs.length - 1 ? (
                    <button
                      onClick={() => setCurrentMcqIndex(p => p + 1)}
                      className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-black bg-blue-600 hover:bg-blue-500 text-white active:scale-95 transition cursor-pointer shadow-md shadow-blue-500/25"
                    >
                      <span>Next Question</span>
                      <ChevronRight size={16} />
                    </button>
                  ) : (
                    <button
                      onClick={handleFinishQuiz}
                      className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white active:scale-95 transition cursor-pointer shadow-lg shadow-emerald-500/30"
                    >
                      <CheckCircle2 size={16} />
                      <span>Submit Test &amp; Save Score</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              /* QUIZ RESULT SUMMARY */
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl text-center space-y-5 my-auto animate-in zoom-in-95 duration-200">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center mx-auto shadow-lg shadow-amber-500/30 text-3xl">
                  🏆
                </div>
                <div>
                  <h2 className="text-xl font-black text-white">Test Complete!</h2>
                  <p className="text-xs text-slate-400 mt-1">{chapterTitle} MCQ Scorecard</p>
                </div>

                {/* Score Stats Grid */}
                {(() => {
                  let correct = 0;
                  mcqs.forEach((q, idx) => {
                    if (selectedAnswers[idx] === q.correctAnswer) correct++;
                  });
                  const percentage = Math.round((correct / Math.max(mcqs.length, 1)) * 100);

                  return (
                    <div className="grid grid-cols-3 gap-2.5 max-w-sm mx-auto">
                      <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-3">
                        <p className="text-xs text-slate-400 font-bold">Total Score</p>
                        <p className="text-xl font-black text-amber-400 mt-1">{percentage}%</p>
                      </div>
                      <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-3">
                        <p className="text-xs text-emerald-400 font-bold">Correct</p>
                        <p className="text-xl font-black text-emerald-300 mt-1">
                          {correct}/{mcqs.length}
                        </p>
                      </div>
                      <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-3">
                        <p className="text-xs text-slate-400 font-bold">Time Taken</p>
                        <p className="text-xl font-black text-blue-400 mt-1">{formatTimer(quizSeconds)}</p>
                      </div>
                    </div>
                  );
                })()}

                <div className="flex items-center justify-center gap-3 pt-3">
                  <button
                    onClick={handleRestartQuiz}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 active:scale-95 transition cursor-pointer"
                  >
                    <RefreshCw size={15} />
                    <span>Re-attempt Quiz</span>
                  </button>
                  <button
                    onClick={onBack}
                    className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-xs font-black bg-blue-600 hover:bg-blue-500 text-white active:scale-95 transition cursor-pointer shadow-md"
                  >
                    <span>Finish &amp; Return</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Draggable Floating NSTA Logo FAB — only rendered if parent does not provide one, and never in MCQ mode */}
      {!propOnToggleImmersive && activeMode !== 'MCQ' && (
        <DraggableNstaLogoFab
          isActive={isImmersive}
          onToggle={toggleImmersive}
          appLogo={appLogo || '/branding/nsta-logo.svg'}
          appName={appName || 'NSTA'}
          title={isImmersive ? 'बॉटम व टॉप बार दिखाएं • Screen pe move kar sakte hain' : 'बॉटम व टॉप बार छुपाएं • Screen pe move kar sakte hain'}
          defaultPosition={{
            bottom: isImmersive ? 20 : 92,
            right: 16,
          }}
          zIndex={99999}
        />
      )}
    </div>
  );
};

export default MathLessonViewer;
