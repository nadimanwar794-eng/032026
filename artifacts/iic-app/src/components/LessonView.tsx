// @ts-nocheck

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import { LessonContent, Subject, ClassLevel, Chapter, MCQItem, ContentType, User, SystemSettings } from '../types';
import { ArrowLeft, Clock, AlertTriangle, ExternalLink, CheckCircle, XCircle, Trophy, BookOpen, Play, Lock, ChevronRight, ChevronLeft, Save, X, Maximize, Volume2, Square, Zap, StopCircle, Globe, Lightbulb, FileText, BrainCircuit, Grip, CheckSquare, List, Download, BarChart3, RotateCcw, Monitor, CloudOff } from 'lucide-react';
import { CustomConfirm, CustomAlert } from './CustomDialogs';
import { CustomPlayer } from './CustomPlayer';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { decodeHtml } from '../utils/htmlDecoder';
import { storage } from '../utils/storage';
import { getChapterData, saveUserHistory, saveTestResult, saveUserToLive } from '../firebase';
import { SpeakButton } from './SpeakButton';
import { McqSpeakButtons } from './McqSpeakButtons';
import { ChunkedNotesReader } from './ChunkedNotesReader';
import { renderMathInHtml } from '../utils/mathUtils';
import { stopSpeaking } from '../utils/ttsHighlighter';
import { speakText, stripHtml } from '../utils/textToSpeech';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { DownloadOptionsModal } from './DownloadOptionsModal';
import { downloadAsMHTML } from '../utils/downloadUtils';
import { saveOfflineItem } from '../utils/offlineStorage';
import { rotateScreen, isDesktopModeOn, setDesktopMode } from '../utils/displayPrefs';
import { applyDeduction, getTotalCredits } from '../utils/creditSystem';
import { getLevelFromScore } from '../utils/levelSystem';
import { getActiveBoost } from '../utils/scoreSystem';
import { PdfViewer } from './PdfViewer';


interface Props {
  content: LessonContent | null;
  subject: Subject;
  classLevel: ClassLevel;
  chapter: Chapter;
  loading: boolean;
  onBack: () => void;
  onMCQComplete?: (count: number, answers: Record<number, number>, usedData: MCQItem[], timeTaken: number, questionTimes?: Record<number, number>) => void;
  user?: User; // Optional for non-MCQ views
  onUpdateUser?: (user: User) => void;
  settings?: SystemSettings; // New Prop for Pricing
  isStreaming?: boolean; // Support for streaming content
  onLaunchContent?: (content: any) => void;
  onToggleAutoTts?: (enabled: boolean) => void;
  instantExplanation?: boolean; // NEW: Instant Feedback Mode
  onShowMarksheet?: (result?: any) => void; // NEW: Marksheet Trigger
  onImmersiveChange?: (isImmersive: boolean) => void;
}

export const LessonView: React.FC<Props> = ({ 
  content, 
  subject, 
  classLevel, 
  chapter,
  loading, 
  onBack,
  onMCQComplete,
  user,
  onUpdateUser,
  settings,
  isStreaming = false,
  onLaunchContent,
  onToggleAutoTts,
  instantExplanation = false, // Default to standard mode
  onShowMarksheet,
  onImmersiveChange
}) => {
  const [mcqState, setMcqState] = useState<Record<number, number | null>>({});
  const [revealedAnswers, setRevealedAnswers] = useState<Set<number>>(new Set());
  const [timeSpentPerQuestion, setTimeSpentPerQuestion] = useState<Record<number, number>>({});
  const [showResults, setShowResults] = useState(false); // Used to trigger Analysis Mode
  const [localMcqData, setLocalMcqData] = useState<MCQItem[]>([]);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [analysisUnlocked, setAnalysisUnlocked] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [language, setLanguage] = useState<'English' | 'Hindi'>('English');
  const [notesViewMode, setNotesViewMode] = useState<'readable' | 'styled'>('readable');
  const _modeToggleFn = useRef<((mode: 'readable' | 'styled') => void) | null>(null);
  const [isLandscape, setIsLandscape] = useState<boolean>(() => {
    try { return window.matchMedia('(orientation: landscape)').matches; } catch { return false; }
  });
  const [viewingNoteChunkMode, setViewingNoteChunkMode] = useState(false);
  const [showModeUnlockAlert, setShowModeUnlockAlert] = useState(false);
  const [htmlUnlocked, setHtmlUnlocked] = useState<boolean>(() => {
    try {
      const key = `nst_html_unlock_${content?.id || content?.title || 'note'}`;
      return localStorage.getItem(key) === '1';
    } catch { return false; }
  });
  const [universalNotes, setUniversalNotes] = useState<any[]>([]);
  const [recLoading, setRecLoading] = useState(false);
  const [viewingNote, setViewingNote] = useState<any>(null); // New state for HTML Note Modal
  const [isDesktopMode, setIsDesktopMode] = useState<boolean>(isDesktopModeOn);
  const [rotateToast, setRotateToast] = useState<string | null>(null);
  const [isImmersive, setIsImmersive] = useState(false);
  useEffect(() => {
    if (onImmersiveChange) onImmersiveChange(isImmersive);
  }, [isImmersive]);

  // ── Reading Score Config ──────────────────────────────────────────────────
  // userRef always has the latest user — prevents stale closure when TTS fires
  // multiple onScoreEarned calls rapidly (each would see same old totalScore otherwise)
  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  const onUpdateUserRef = useRef(onUpdateUser);
  useEffect(() => { onUpdateUserRef.current = onUpdateUser; }, [onUpdateUser]);

  const handleReadingScoreEarned = useCallback((pts: number, _activity: string) => {
    const _user = userRef.current;
    const _onUpdateUser = onUpdateUserRef.current;
    if (!_user || !_onUpdateUser || pts <= 0) return;
    const updated = { ..._user, totalScore: (_user.totalScore || 0) + pts };
    _onUpdateUser(updated);
  }, []);

  const readingScoreConfig = user?.id ? {
    userId: user.id,
    userLevel: getLevelFromScore(user.totalScore || 0),
    subscriptionLevel: user.subscriptionTier || 'FREE',
    isPremium: !!(user.isPremium || (user.subscriptionTier && user.subscriptionTier !== 'FREE')),
    boostPercent: getActiveBoost(user),
    onScoreEarned: handleReadingScoreEarned,
  } : undefined;

  // On mount: always re-apply stored desktop mode preference to the viewport
  useEffect(() => {
    const current = isDesktopModeOn();
    setDesktopMode(current);
    setIsDesktopMode(current);
  }, []);

  // Re-apply desktop mode whenever orientation changes (manual or programmatic rotation)
  useEffect(() => {
    const reapply = () => {
      // Wait for browser to settle after rotation then re-apply viewport
      setTimeout(() => {
        const current = isDesktopModeOn();
        setDesktopMode(current);
        setIsDesktopMode(current);
      }, 400);
    };
    window.addEventListener('orientationchange', reapply);
    window.addEventListener('resize', reapply);
    return () => {
      window.removeEventListener('orientationchange', reapply);
      window.removeEventListener('resize', reapply);
    };
  }, []);

  const handleRotate = async () => {
    const desktopWasOn = isDesktopModeOn();
    const result = await rotateScreen();
    if (!result) {
      setRotateToast('Is device mein screen rotation supported nahi hai');
      setTimeout(() => setRotateToast(null), 2500);
    } else {
      // Re-apply desktop mode after rotation settles (rotation can reset viewport)
      setTimeout(() => {
        if (desktopWasOn) {
          setDesktopMode(true);
          setIsDesktopMode(true);
        }
      }, 500);
    }
  };

  const toggleDesktopMode = () => {
    const newVal = !isDesktopMode;
    setDesktopMode(newVal);
    setIsDesktopMode(newVal);
  };

  const [showQuestionDrawer, setShowQuestionDrawer] = useState(false);
  const [showTopicSidebar, setShowTopicSidebar] = useState(false);
  const [batchIndex, setBatchIndex] = useState(0);
  const [comparisonMsg, setComparisonMsg] = useState('');
  const [activeAnalysisTab, setActiveAnalysisTab] = useState<'CHAPTER_ANALYSIS' | 'OVERVIEW' | 'QUESTIONS' | 'MISTAKES'>('CHAPTER_ANALYSIS');
  // Auto-enable TTS for Premium Instant Explanation Mode
  const [autoReadEnabled, setAutoReadEnabled] = useState(settings?.isAutoTtsEnabled || instantExplanation || false);
  const BATCH_SIZE = 1;

  // Per-topic star system (same storage as StudentDashboard: nst_starred_notes_v1)
  const noteKey = chapter?.id ? `chapter_${chapter.id}` : '';
  type StarEntry = { id: string; noteKey: string; topicText: string; savedAt: string };
  const [lessonStars, setLessonStars] = useState<StarEntry[]>(() => {
    try {
      const raw = localStorage.getItem('nst_starred_notes_v1');
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });
  const isTopicStarred = (text: string) =>
    lessonStars.some(n => n.noteKey === noteKey && n.topicText === text);
  const toggleTopicStar = (text: string) => {
    setLessonStars(prev => {
      const exists = prev.find(n => n.noteKey === noteKey && n.topicText === text);
      const updated = exists
        ? prev.filter(n => !(n.noteKey === noteKey && n.topicText === text))
        : [...prev, { id: Date.now().toString(), noteKey, topicText: text, savedAt: new Date().toISOString() }];
      try { localStorage.setItem('nst_starred_notes_v1', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const submitRef = useRef<() => void>();

  useEffect(() => {
      if (settings?.isAutoTtsEnabled !== undefined) {
          setAutoReadEnabled(settings.isAutoTtsEnabled);
      } else if (instantExplanation) {
          setAutoReadEnabled(true);
      }
  }, [settings?.isAutoTtsEnabled, instantExplanation]);

  // LANDSCAPE DETECTION
  useEffect(() => {
    try {
      const mq = window.matchMedia('(orientation: landscape)');
      const handler = (e: MediaQueryListEvent) => setIsLandscape(e.matches);
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    } catch {}
  }, []);

  // LANGUAGE AUTO-SELECT
  useEffect(() => {
    if (user?.board === 'BSEB') {
        setLanguage('Hindi');
    } else if (user?.board === 'CBSE') {
        setLanguage('English');
    }
  }, [user?.board]);

  // LOAD UNIVERSAL NOTES FOR ANALYSIS
  useEffect(() => {
      if (content?.type === 'MCQ_ANALYSIS' && universalNotes.length === 0) {
          setRecLoading(true);
          getChapterData('nst_universal_notes').then(data => {
              if (data && data.notesPlaylist) {
                  setUniversalNotes(data.notesPlaylist);
              }
              setRecLoading(false);
          });
      }
  }, [content?.type]);

  // Full Screen Ref
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullScreen = () => {
      if (!document.fullscreenElement) {
          containerRef.current?.requestFullscreen().then(() => {
              setIsFullscreen(true);
          }).catch(e => console.error(e));
      } else {
          document.exitFullscreen().then(() => {
              setIsFullscreen(false);
          });
      }
  };

  useEffect(() => {
      const handleFullscreenChange = () => {
          setIsFullscreen(!!document.fullscreenElement);
      };
      document.addEventListener('fullscreenchange', handleFullscreenChange);
      return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // TIMER STATE
  const [sessionTime, setSessionTime] = useState(0); // Total seconds
  
      // TIMER EFFECT (UPDATED: Track Per Question)
  useEffect(() => {
      let interval: any;
          if (!showResults && !showSubmitModal && !showResumePrompt && content?.mcqData) {
          interval = setInterval(() => {
              setSessionTime(prev => prev + 1);

                  // Track time for current question (only if viewing 1 question at a time or first in batch)
                  // Assuming batchIndex corresponds to question index if BATCH_SIZE is 1
                  if (true) { // BATCH_SIZE is confirmed 1 in render logic
                      setTimeSpentPerQuestion(prev => ({
                          ...prev,
                          [batchIndex]: (prev[batchIndex] || 0) + 1
                      }));
                  }
          }, 1000);
      }
      return () => clearInterval(interval);
      }, [showResults, showSubmitModal, showResumePrompt, batchIndex, content]);

  // ANTI-CHEAT (Exam Mode)
  useEffect(() => {
      if (content?.subtitle?.includes('Premium Test') && !showResults && !showSubmitModal) {
          const handleVisibilityChange = () => {
              if (document.hidden) {
                  setAlertConfig({isOpen: true, message: "⚠️ Exam Mode Violation! Test Submitted Automatically."});
                  // Defer the submit call to avoid circular dependency before definition
                  // Since handleConfirmSubmit is defined below, we might need a ref or define it earlier.
                  // However, useEffect runs after render, so `handleConfirmSubmit` const should be available if defined in scope.
                  // The issue is likely `handleConfirmSubmit` is used before definition in this closure?
                  // No, hoisting applies to function declarations, not const arrow functions.
                  if (submitRef.current) {
                      submitRef.current();
                  }
              }
          };
          document.addEventListener("visibilitychange", handleVisibilityChange);
          return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
  }, [content, showResults, showSubmitModal, mcqState]);

  // Custom Dialog State
  const [alertConfig, setAlertConfig] = useState<{isOpen: boolean, message: string, type?: 'ERROR' | 'SUCCESS' | 'INFO'}>({isOpen: false, message: ''});
  const [confirmConfig, setConfirmConfig] = useState<{isOpen: boolean, title: string, message: string, onConfirm: () => void}>({isOpen: false, title: '', message: '', onConfirm: () => {}});

  // TTS STATE
  const contentRef = useRef<HTMLDivElement>(null);
  const plainTextContent = content ? decodeHtml(content.aiHtmlContent || content.content || "") : "";

  if (loading) {
      return (
          <div className="h-[70vh] flex flex-col items-center justify-center text-center p-8">
              <div className="w-16 h-16 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-4"></div>
              <h3 className="text-xl font-bold text-slate-800 animate-pulse">Loading Content...</h3>
              <p className="text-slate-600 text-sm">Please wait while we fetch the data.</p>
          </div>
      );
  }

  if (!content) return null;

  // 1. AI IMAGE/HTML NOTES
  const activeContentValue = (language === 'Hindi' && content.schoolPremiumNotesHtml_HI) 
      ? content.schoolPremiumNotesHtml_HI 
      : (content.content || content.pdfUrl || content.videoUrl || '');

  const contentValue = activeContentValue;
  const isImage = contentValue && (contentValue.startsWith('data:image') || contentValue.match(/\.(jpeg|jpg|gif|png|webp|bmp)$/i));
  const isHtml = content.aiHtmlContent || (contentValue && !contentValue.startsWith('http') && contentValue.includes('<'));

  // SCHOOL MODE FREE NOTES FIX
  const isFree = content.type === 'PDF_FREE' || content.type === 'NOTES_HTML_FREE' || (content.type === 'VIDEO_LECTURE' && content.videoPlaylist?.some(v => v.access === 'FREE'));
  
  const [fabOpen, setFabOpen] = useState(false);

  const handleSaveNotesOffline = () => {
    if (!user) return;
    const htmlContent = content?.aiHtmlContent || (content?.content?.includes('<') ? content.content : null);
    saveOfflineItem({
      id: `notes_${chapter.id}`,
      type: 'NOTE',
      title: chapter.title,
      subtitle: subject.name,
      data: {
        html: htmlContent,
        theory: content?.content,
        topicNotes: content?.topicNotes,
        questions: localMcqData,
      }
    });
    setAlertConfig({ isOpen: true, message: '✅ Notes offline save ho gaye! Offline tab mein dekho.', type: 'SUCCESS' });
  };

  // FLOATING IMMERSIVE BUTTON — always rendered via portal into document.body
  // so it escapes any fixed/overflow parent stacking context.
  const fabBottom = isImmersive ? 16 : 80;
  const floatingBtn = createPortal(
    <>
      {/* Backdrop — close menu on outside tap */}
      {fabOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9190 }}
          onClick={() => setFabOpen(false)}
        />
      )}

      {/* Sub-action buttons above FAB */}
      {fabOpen && (
        <div style={{ position: 'fixed', bottom: fabBottom + 68, right: '16px', zIndex: 9200, display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
          <button
            onClick={() => { handleSaveNotesOffline(); setFabOpen(false); }}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#059669', color: '#fff', border: 'none', borderRadius: '24px', padding: '8px 14px', fontSize: '12px', fontWeight: 900, boxShadow: '0 4px 16px rgba(5,150,105,0.35)', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            <CloudOff size={14} /> Save Offline
          </button>
          <button
            onClick={() => { setIsImmersive(v => !v); setFabOpen(false); }}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: isImmersive ? '#4f46e5' : '#1e293b', color: '#fff', border: 'none', borderRadius: '24px', padding: '8px 14px', fontSize: '12px', fontWeight: 900, boxShadow: '0 4px 16px rgba(0,0,0,0.25)', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            {isImmersive ? '↩ Exit Focus' : '🎯 Focus Mode'}
          </button>
          {isHtml && (
            <button
              onClick={() => { _modeToggleFn.current?.(notesViewMode === 'readable' ? 'styled' : 'readable'); setFabOpen(false); }}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: notesViewMode === 'styled' ? '#0f766e' : '#6366f1', color: '#fff', border: 'none', borderRadius: '24px', padding: '8px 14px', fontSize: '12px', fontWeight: 900, boxShadow: '0 4px 16px rgba(0,0,0,0.25)', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              {notesViewMode === 'styled' ? <><Volume2 size={14} /> TTS Reader</> : <><FileText size={14} /> Notes Maker</>}
            </button>
          )}
        </div>
      )}

      {/* Main FAB button */}
      <button
        onClick={() => setFabOpen(v => !v)}
        className="shadow-2xl flex items-center justify-center"
        style={{
          position: 'fixed',
          bottom: fabBottom,
          right: '16px',
          width: '52px',
          height: '52px',
          borderRadius: '50%',
          background: fabOpen ? 'rgba(79,70,229,0.95)' : isImmersive ? 'rgba(30,27,75,0.95)' : 'rgba(15,23,42,0.88)',
          border: fabOpen ? '2.5px solid rgba(99,102,241,0.9)' : isImmersive ? '2.5px solid rgba(99,102,241,0.9)' : '2.5px solid rgba(255,255,255,0.5)',
          backdropFilter: 'blur(10px)',
          zIndex: 9200,
          transition: 'background 0.2s',
        }}
        title={fabOpen ? 'Close menu' : 'Options'}
      >
        {fabOpen ? (
          <X size={22} style={{ color: '#fff', pointerEvents: 'none' }} />
        ) : settings?.appLogo ? (
          <img src={settings.appLogo} alt="App" style={{ width: '38px', height: '38px', objectFit: 'contain', borderRadius: '50%', pointerEvents: 'none' }} />
        ) : (
          <span style={{ fontSize: '18px', fontWeight: 900, color: '#fff', pointerEvents: 'none' }}>
            {(settings?.appShortName || settings?.appName || 'A').charAt(0)}
          </span>
        )}
        {!fabOpen && <span style={{ position: 'absolute', top: '3px', right: '3px', width: '10px', height: '10px', borderRadius: '50%', background: isImmersive ? '#6366f1' : '#22c55e', border: '2px solid #fff', pointerEvents: 'none' }} />}
      </button>
    </>,
    document.body
  );

  // FREE HTML NOTE MODAL
  if (viewingNote) {
      return (
          <div className="fixed inset-0 z-[200] bg-white flex flex-col animate-in fade-in">
              {/* Header */}
              <header className="bg-white border-b border-slate-200 p-4 flex items-center justify-between shadow-sm sticky top-0 z-10">
                  <div className="flex items-center gap-3"><button onClick={toggleFullScreen} className="p-2 bg-slate-100 rounded-full text-slate-600 hover:bg-slate-200" title="Toggle Fullscreen"><Maximize size={20} /></button>
                      {settings?.appLogo && <img src={settings.appLogo} className="w-8 h-8 object-contain" />}
                      <div>
                          <h2 className="font-black text-slate-800 uppercase text-sm">{settings?.appName || 'Free Notes'}</h2>
                          <p className="text-[10px] text-orange-600 font-bold uppercase tracking-widest">Recommended Reading</p>
                      </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setViewingNoteChunkMode(m => !m)}
                      className={`p-2 rounded-full transition-colors ${viewingNoteChunkMode ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                      title={viewingNoteChunkMode ? 'HTML Mode' : 'TTS Reader'}
                    >
                      <Volume2 size={18} />
                    </button>
                    <button onClick={() => { setViewingNote(null); setViewingNoteChunkMode(false); }} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200"><X size={20}/></button>
                  </div>
              </header>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-6 bg-slate-50">
                  <div className="w-full mx-auto bg-white p-6 rounded-3xl shadow-sm border border-slate-100 min-h-[50vh]">
                      <h1 className="text-2xl font-black text-slate-900 mb-6 border-b pb-4">{viewingNote.title}</h1>
                      {viewingNoteChunkMode ? (
                          <ChunkedNotesReader
                              key={`viewing-note-chunk-${viewingNote.title}`}
                              content={decodeHtml(viewingNote.content)
                                  .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                                  .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                                  .replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>|<\/div>|<\/li>|<\/h[1-6]>/gi, '\n')
                                  .replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ')
                                  .replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()}
                              topBarLabel={viewingNote.title}
                              preferChunkMode
                              hideTopBar={false}
                          />
                      ) : (
                          <div
                              className="notes-html-content"
                              dangerouslySetInnerHTML={{ __html: decodeHtml(viewingNote.content) }}
                          />
                      )}
                  </div>
              </div>

          </div>
      );
  }

  if (content.type === 'NOTES_IMAGE_AI' || isImage || isHtml) {
      const preventMenu = (e: React.MouseEvent | React.TouchEvent) => e.preventDefault();
      
      if (isHtml) {
          const htmlToRender = content.aiHtmlContent || content.content;
          const decodedContent = decodeHtml(htmlToRender);
          const strippedContent = decodedContent
              .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
              .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
              .replace(/<[^>]*>/g, ' ')
              .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
              .replace(/\s+/g, ' ').trim();

          const isPremiumUser = !!(user?.isPremium || (user?.subscriptionTier && user.subscriptionTier !== 'FREE'));
          const HTML_UNLOCK_COST = 10;
          const htmlUnlockKey = `nst_html_unlock_${content?.id || content?.title || 'note'}`;

          const handleNotesMakerDownload = async () => {
              // Ensure desktop mode is on for the download (full-width render)
              const wasDesktop = isDesktopModeOn();
              if (!wasDesktop) { setDesktopMode(true); setIsDesktopMode(true); }
              await new Promise(r => setTimeout(r, 300));
              await downloadAsMHTML('notes-maker-printable', `${content.title}_Notes`, {
                  appName: 'IIC',
                  pageTitle: content.title,
                  subtitle: chapter?.subject || 'Notes',
              });
              if (!wasDesktop) { setDesktopMode(false); setIsDesktopMode(false); }
          };

          const handleModeToggle = (targetMode: 'readable' | 'styled') => {
              if (targetMode === notesViewMode) return;
              // Sync desktop mode state from localStorage before switching modes
              const currentDesktop = isDesktopModeOn();
              setIsDesktopMode(currentDesktop);
              setDesktopMode(currentDesktop);
              if (targetMode === 'styled') {
                  // HTML Notes — premium free, free users need 10 credits (lifetime per note)
                  if (isPremiumUser || htmlUnlocked) {
                      setNotesViewMode('styled');
                  } else {
                      if (!user || !onUpdateUser) {
                          setAlertConfig({ isOpen: true, message: `HTML Notes unlock karne ke liye ${HTML_UNLOCK_COST} coins chahiye.` });
                          return;
                      }
                      if (getTotalCredits(user) < HTML_UNLOCK_COST) {
                          setAlertConfig({ isOpen: true, message: `HTML Notes unlock karne ke liye ${HTML_UNLOCK_COST} coins chahiye. Aapke paas sirf ${getTotalCredits(user)} coins hain.` });
                          return;
                      }
                      const updatedUser = applyDeduction(user, HTML_UNLOCK_COST)!;
                      onUpdateUser(updatedUser);
                      saveUserToLive(updatedUser);
                      try { localStorage.setItem(htmlUnlockKey, '1'); } catch {}
                      setHtmlUnlocked(true);
                      setNotesViewMode('styled');
                  }
              } else {
                  // TTS Reader — always free
                  setNotesViewMode('readable');
              }
          };
          _modeToggleFn.current = handleModeToggle;

          // Strip leading title heading from HTML to avoid showing title twice
          const deduplicatedHtml = decodedContent.replace(/^(\s*<(div|section)[^>]*>\s*)?<h[12][^>]*>[^<]*<\/h[12]>/i, '');

          // Mode switcher panel (shared for both portrait and landscape)
          const modeSwitcher = (
              <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-1">
                      <div className="flex items-center bg-slate-200 rounded-2xl p-1 gap-1 shadow-inner flex-1">
                          <button
                              onClick={() => handleModeToggle('readable')}
                              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wide transition-all duration-200 ${
                                  notesViewMode === 'readable'
                                      ? 'bg-white text-indigo-700 shadow-md'
                                      : 'text-slate-500 hover:text-slate-700'
                              }`}
                          >
                              <Volume2 size={14} />
                              TTS Reader
                          </button>
                          <button
                              onClick={() => handleModeToggle('styled')}
                              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wide transition-all duration-200 ${
                                  notesViewMode === 'styled'
                                      ? 'bg-white text-teal-700 shadow-md'
                                      : 'text-slate-500 hover:text-slate-700'
                              }`}
                          >
                              <FileText size={14} />
                              Notes Maker
                              {!isPremiumUser && !htmlUnlocked && (
                                  <span className="text-[9px] bg-amber-500 text-white rounded-full px-1.5 py-0.5 font-black leading-none">
                                      {HTML_UNLOCK_COST}🪙
                                  </span>
                              )}
                          </button>
                      </div>
                      {/* Rotate button — accessible in both read and write modes */}
                      <button
                          onClick={handleRotate}
                          className="p-2.5 bg-slate-200 hover:bg-slate-300 rounded-2xl text-slate-600 transition-colors flex-shrink-0"
                          title="Screen Rotate"
                      >
                          <RotateCcw size={15} />
                      </button>
                  </div>
                  {isLandscape && (
                      <div className="text-[10px] text-slate-400 text-center mt-1">
                          {notesViewMode === 'readable' ? 'TTS Reader' : 'Notes Maker'} mode
                      </div>
                  )}
              </div>
          );

          // Notes content panel (shared for both portrait and landscape)
          const notesContent = (
              <>
                  {notesViewMode === 'readable' ? (
                      <ChunkedNotesReader
                          content={strippedContent}
                          language={language === 'Hindi' ? 'hi-IN' : 'en-US'}
                          topBarLabel={content.title}
                          className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-100 mt-2"
                          noteKey={noteKey}
                          isStarred={isTopicStarred}
                          onStarToggle={toggleTopicStar}
                          preferChunkMode
                          hideTopBar={isImmersive}
                          onDesktopModeChange={setIsDesktopMode}
                          readingScoreConfig={readingScoreConfig}
                      />
                  ) : (
                      <>
                      {/* Notes Maker top bar — label, download, exit */}
                      <div className="flex items-center justify-between px-1 py-1 mb-1">
                          <span className="text-[10px] font-black text-teal-600 uppercase tracking-widest flex items-center gap-1">
                              <FileText size={11} /> Notes Maker
                          </span>
                          <div className="flex items-center gap-2">
                              <button
                                  onClick={handleNotesMakerDownload}
                                  className="flex items-center gap-1 text-[10px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 hover:bg-emerald-100 active:scale-95 transition-all"
                              >
                                  <Download size={10} /> Save
                              </button>
                              <button
                                  onClick={() => handleModeToggle('readable')}
                                  className="flex items-center gap-1 text-[10px] font-black text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200 hover:bg-slate-200 active:scale-95 transition-all"
                              >
                                  <X size={10} /> Exit
                              </button>
                          </div>
                      </div>
                      {/* Printable container: wraps all Notes Maker HTML for download */}
                      <div id="notes-maker-printable">
                      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mt-2">
                          <div
                              className="notes-html-content p-4 sm:p-6"
                              dangerouslySetInnerHTML={{ __html: deduplicatedHtml }}
                              style={{ fontSize: '15px', lineHeight: '1.8' }}
                          />
                      </div>
                      {/* MULTI-HTML SECTIONS: Additional HTML blocks on same page */}
                      {(() => {
                          const sections = (content as any).schoolHtmlSections || (content as any).competitionHtmlSections || (content as any).htmlSections;
                          if (!sections || sections.length === 0) return null;
                          return sections.map((sec: { id: string; title?: string; html: string; chunkNotes?: string }, idx: number) => {
                              const hasChunk = !!(sec.chunkNotes?.trim());
                              const hasHtml  = !!(sec.html?.trim());
                              return (
                                  <div key={sec.id || idx} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mt-3">
                                      {sec.title && (
                                          <div className="px-4 pt-4 pb-1">
                                              <h3 className="text-sm font-black text-slate-700 flex items-center gap-2">
                                                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 text-[10px] font-black flex items-center justify-center">{idx + 1}</span>
                                                  {sec.title}
                                              </h3>
                                              <div className="h-px bg-slate-100 mt-2" />
                                          </div>
                                      )}
                                      {/* Read mode plain text (shown as a clean readable block) */}
                                      {hasChunk && (
                                          <div className="notes-html-content p-4 sm:p-6 border-b border-slate-100 whitespace-pre-wrap text-slate-700" style={{ fontSize: '15px', lineHeight: '1.8' }}>
                                              {sec.chunkNotes}
                                          </div>
                                      )}
                                      {/* Write mode HTML */}
                                      {hasHtml && (
                                          <div
                                              className="notes-html-content p-4 sm:p-6"
                                              dangerouslySetInnerHTML={{ __html: sec.html || '' }}
                                              style={{ fontSize: '15px', lineHeight: '1.8' }}
                                          />
                                      )}
                                  </div>
                              );
                          });
                      })()}
                      </div>
                      </>
                  )}
                  {isStreaming && (
                      <div className="flex items-center gap-2 text-slate-600 mt-4 animate-pulse pb-4">
                          <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                          <span className="text-xs font-bold">AI writing...</span>
                      </div>
                  )}
              </>
          );

          return (
              <div className="fixed inset-0 z-50 bg-white flex flex-col animate-in fade-in">
                  {/* Rotate toast */}
                  {rotateToast && (
                      <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[9999] bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-lg animate-in fade-in">
                          {rotateToast}
                      </div>
                  )}
                  {/* Header */}
                  <header className={`bg-white/95 backdrop-blur-md text-slate-800 px-4 py-3 flex-shrink-0 z-10 flex items-center justify-between border-b border-slate-100 shadow-sm${isImmersive ? ' hidden' : ''}`}>
                      <div className="flex items-center gap-3">
                          <button onClick={toggleFullScreen} className="p-2 bg-slate-100 rounded-full text-slate-600 hover:bg-slate-200" title="Toggle Fullscreen"><Maximize size={20} /></button>
                          <button onClick={onBack} className="p-2 bg-slate-100 rounded-full"><ArrowLeft size={20} /></button>
                          <h2 className="text-sm font-bold truncate max-w-[120px]">{content.title}</h2>
                      </div>
                      <div className="flex items-center gap-2">
                          <button
                              onClick={handleRotate}
                              className="p-2 bg-slate-100 rounded-full text-slate-600 hover:bg-slate-200 transition-colors"
                              title="Screen Rotate"
                          >
                              <RotateCcw size={18} />
                          </button>
                          <button
                              onClick={toggleDesktopMode}
                              className={`p-2 rounded-full transition-colors ${isDesktopMode ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                              title={isDesktopMode ? 'Desktop Mode ON' : 'Desktop Mode OFF'}
                          >
                              <Monitor size={18} />
                          </button>
                          <button
                              onClick={() => setLanguage(l => l === 'English' ? 'Hindi' : 'English')}
                              className="px-3 py-1.5 bg-slate-100 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-200 border border-slate-200 flex items-center gap-1 transition-all"
                          >
                              <Globe size={14} /> {language === 'English' ? 'हिंदी' : 'Eng'}
                          </button>
                          <button onClick={onBack} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"><X size={20} /></button>
                      </div>
                  </header>

                  {isLandscape ? (
                      /* ── LANDSCAPE: Split screen — controls left, notes right ── */
                      <div className="flex-1 flex flex-row overflow-hidden bg-slate-50">
                          {/* Left panel: mode switcher controls */}
                          <div className={`w-[220px] flex-shrink-0 bg-white border-r border-slate-100 flex flex-col p-4 gap-3 overflow-y-auto${isImmersive ? ' hidden' : ''}`}>
                              {/* Language toggle */}
                              <div className="mt-2">
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Language</p>
                                  <button
                                      onClick={() => setLanguage(l => l === 'English' ? 'Hindi' : 'English')}
                                      className="w-full px-3 py-2 bg-slate-100 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 border border-slate-200 flex items-center justify-center gap-1 transition-all"
                                  >
                                      <Globe size={14} /> {language === 'English' ? 'हिंदी में बदलें' : 'Switch to English'}
                                  </button>
                              </div>
                              {/* Rotate & Desktop Mode */}
                              <div className="mt-1">
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Screen</p>
                                  <div className="flex gap-2">
                                      <button
                                          onClick={handleRotate}
                                          className="flex-1 flex items-center justify-center gap-1 py-2 bg-slate-100 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 border border-slate-200 transition-all"
                                          title="Screen Rotate"
                                      >
                                          <RotateCcw size={14} /> Rotate
                                      </button>
                                      <button
                                          onClick={toggleDesktopMode}
                                          className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-bold border transition-all ${isDesktopMode ? 'bg-indigo-100 text-indigo-600 border-indigo-200' : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'}`}
                                          title={isDesktopMode ? 'Desktop Mode ON' : 'Desktop Mode'}
                                      >
                                          <Monitor size={14} /> {isDesktopMode ? 'Desktop' : 'Desktop'}
                                      </button>
                                  </div>
                              </div>
                          </div>
                          {/* Right panel: notes content */}
                          <div className="flex-1 overflow-y-auto px-4 py-3 min-w-0">
                              {notesContent}
                          </div>
                      </div>
                  ) : (
                      /* ── PORTRAIT: Normal single-column layout ── */
                      <div className="flex-1 overflow-y-auto w-full pb-6 bg-slate-50">
                          <div className="w-full max-w-5xl mx-auto px-4 md:px-8">
                              {notesContent}
                          </div>
                      </div>
                  )}
              {floatingBtn}
              </div>
          );
      }
      
      if (isImage) {
          return (
              <div className="fixed inset-0 z-50 bg-[#111] flex flex-col animate-in fade-in">
                  <header className={`bg-black/90 backdrop-blur-md text-white p-4 absolute top-0 left-0 right-0 z-10 flex items-center justify-between border-b border-white/10${isImmersive ? ' hidden' : ''}`}>
                      <div className="flex items-center gap-3"><button onClick={toggleFullScreen} className="p-2 bg-slate-100 rounded-full text-slate-600 hover:bg-slate-200" title="Toggle Fullscreen"><Maximize size={20} /></button>
                          <button onClick={onBack} className="p-2 bg-white/10 rounded-full"><ArrowLeft size={20} /></button>
                          <div>
                              <h2 className="text-sm font-bold text-white/90">{content.title}</h2>
                              <p className="text-[10px] text-teal-400 font-bold uppercase tracking-widest">Image Notes</p>
                          </div>
                      </div>
                      <button onClick={onBack} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors backdrop-blur-md"><X size={20} /></button>
                  </header>
                  <div className="flex-1 overflow-y-auto pt-16 flex items-start justify-center" onContextMenu={preventMenu}>
                      <img src={content.content} alt="Notes" className="w-full h-auto object-contain" draggable={false} />
                  </div>
              {floatingBtn}
              </div>
          );
      }
  }

  // 2. URL LINK / PDF NOTES (Strict HTTP check)
  const isUrl = contentValue && (contentValue.startsWith('http://') || contentValue.startsWith('https://'));
  if (['PDF_FREE', 'PDF_PREMIUM', 'PDF_ULTRA', 'PDF_VIEWER'].includes(content.type) || isUrl) {
      const isGoogleDriveAudio = (contentValue.includes('drive.google.com') || contentValue.includes('notebooklm.google.com')) && (content.title.toLowerCase().includes('audio') || content.title.toLowerCase().includes('podcast') || content.type.includes('AUDIO'));

      if (isGoogleDriveAudio) {
          return (
              <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col animate-in fade-in">
                  <header className={`bg-slate-900/90 backdrop-blur-md text-white p-4 flex items-center justify-between border-b border-white/10 z-20${isImmersive ? ' hidden' : ''}`}>
                      <div className="flex items-center gap-3"><button onClick={toggleFullScreen} className="p-2 bg-slate-100 rounded-full text-slate-600 hover:bg-slate-200" title="Toggle Fullscreen"><Maximize size={20} /></button>
                          <button onClick={onBack} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors"><ArrowLeft size={20} /></button>
                          <div>
                            <h2 className="font-bold text-white leading-tight">{content.title}</h2>
                            <p className="text-[10px] text-blue-400 font-black uppercase tracking-widest">Premium Audio Experience</p>
                          </div>
                      </div>
                      <button onClick={onBack} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors"><X size={20} /></button>
                  </header>
                  <div className="flex-1 flex items-center justify-center p-4 bg-slate-950 relative overflow-hidden">
                      {/* Animated Background Gradients */}
                      <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-600/10 rounded-full blur-[100px] animate-pulse"></div>
                      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-purple-600/10 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }}></div>
                      
                      <div className="w-full aspect-video relative z-10 rounded-2xl overflow-hidden shadow-2xl border border-white/5">
                          <CustomPlayer videoUrl={contentValue} />
                      </div>
                  </div>
              {floatingBtn}
              </div>
          );
      }

      return (
          <PdfViewer
              url={contentValue}
              title={content.title}
              onBack={onBack}
              sessionKey={chapter?.id ? `chapter_${chapter.id}` : undefined}
              userId={user?.id}
              subscriptionLevel={user?.subscriptionTier || 'FREE'}
              isPremium={!!(user?.isPremium || (user?.subscriptionTier && user.subscriptionTier !== 'FREE'))}
              boostPercent={getActiveBoost(user as any)}
              onScoreEarned={handleReadingScoreEarned}
          />
      );
  }

  // 3. MANUAL TEXT / MARKDOWN NOTES (Fallback)
  if (content.content || isStreaming) {
      return (
          <div className="flex flex-col h-full bg-white animate-in fade-in">
              {rotateToast && (
                  <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[9999] bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-lg animate-in fade-in">
                      {rotateToast}
                  </div>
              )}
              <header className={`bg-white border-b p-4 flex items-center justify-between sticky top-0 z-10${isImmersive ? ' hidden' : ''}`}>
                  <div className="flex items-center gap-3"><button onClick={toggleFullScreen} className="p-2 bg-slate-100 rounded-full text-slate-600 hover:bg-slate-200" title="Toggle Fullscreen"><Maximize size={20} /></button>
                      <button onClick={onBack} className="p-2 bg-slate-100 rounded-full"><ArrowLeft size={20} /></button>
                      <h2 className="font-bold truncate max-w-[140px]">{content.title}</h2>
                  </div>
                  <div className="flex items-center gap-2">
                      <button
                          onClick={handleRotate}
                          className="p-2 bg-slate-100 rounded-full text-slate-600 hover:bg-slate-200 transition-colors"
                          title="Screen Rotate"
                      >
                          <RotateCcw size={18} />
                      </button>
                      <button
                          onClick={toggleDesktopMode}
                          className={`p-2 rounded-full transition-colors ${isDesktopMode ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                          title={isDesktopMode ? 'Desktop Mode ON' : 'Desktop Mode OFF'}
                      >
                          <Monitor size={18} />
                      </button>
                      <button 
                          onClick={() => setLanguage(l => l === 'English' ? 'Hindi' : 'English')}
                          className="px-3 py-1.5 bg-slate-100 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-200 border border-slate-200 mr-1 flex items-center gap-1 transition-all"
                      >
                          <Globe size={14} /> {language === 'English' ? 'Hindi (हिंदी)' : 'English'}
                      </button>
                      <button onClick={onBack} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"><X size={20} /></button>
                  </div>
              </header>
              <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-white">
                  <div className="w-full max-w-5xl mx-auto">
                      <ChunkedNotesReader
                          content={content.content || ''}
                          language={language === 'Hindi' ? 'hi-IN' : 'en-US'}
                          topBarLabel={content.title}
                          noteKey={noteKey}
                          isStarred={isTopicStarred}
                          onStarToggle={toggleTopicStar}
                          preferChunkMode
                          hideTopBar={isImmersive}
                          onDesktopModeChange={setIsDesktopMode}
                          readingScoreConfig={readingScoreConfig}
                      />
                      {isStreaming && (
                        <div className="flex items-center gap-2 text-slate-600 mt-4 animate-pulse">
                            <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                            <span className="text-xs font-bold">AI writing...</span>
                        </div>
                      )}
                  </div>
              </div>
          {floatingBtn}
          </div>
      );
  }

  if (content.isComingSoon) {
      return (
          <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-6 bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 rounded-2xl m-4 border-2 border-dashed border-orange-200">
              <div className="relative mb-4">
                <div className="absolute inset-0 bg-orange-300/30 blur-2xl rounded-full" />
                <Clock size={72} className="relative text-orange-500 opacity-90" />
              </div>
              <h2 className="text-2xl font-black text-slate-800 mb-2">Coming Soon</h2>
              <p className="text-slate-600 max-w-xs mx-auto mb-4 text-sm">
                  Yeh content abhi Admin ke dwara taiyar ki ja rahi hai. Jaldi hi available hogi.
              </p>
              {/* Diagnostic chip — helps the user tell admin EXACTLY what's missing */}
              <div className="bg-white/80 backdrop-blur border border-orange-200 rounded-xl px-3 py-2 mb-4 text-[11px] text-slate-700 font-semibold shadow-sm">
                <div className="text-[9px] font-black text-orange-600 uppercase tracking-widest mb-1">Missing Content</div>
                <div>📖 <b>{chapter?.title || content.title}</b></div>
                {content.subjectName && <div className="text-slate-500 mt-0.5">📚 {content.subjectName}</div>}
              </div>
              <button onClick={onBack} className="px-6 py-2.5 rounded-xl bg-slate-700 text-white font-bold text-sm hover:bg-slate-800 active:scale-95 transition shadow-md">
                  Go Back
              </button>
          </div>
      );
  }

  // --- MCQ RENDERER ---
  if ((content.type === 'MCQ_ANALYSIS' || content.type === 'MCQ_SIMPLE' || content.type === 'MCQ_RESULT') && content.mcqData) {
      // --- INITIALIZATION & RESUME LOGIC ---
      useEffect(() => {
          if (!content.mcqData) return;
          
          const sourceData = (language === 'Hindi' && content.manualMcqData_HI && content.manualMcqData_HI.length > 0)
              ? content.manualMcqData_HI
              : content.mcqData;

          if (content.userAnswers) {
              setMcqState(content.userAnswers);
              setShowResults(true);
              setAnalysisUnlocked(true);
              setLocalMcqData(sourceData);
              return;
          }

          const key = `nst_mcq_progress_${chapter.id}`;
          storage.getItem(key).then(saved => {
              if (saved) {
                  setShowResumePrompt(true);
                  setLocalMcqData(sourceData);
              } else {
                  setLocalMcqData(sourceData);
              }
          });
      }, [content.mcqData, content.manualMcqData_HI, chapter.id, content.userAnswers, language]);

      // --- SAVE PROGRESS LOGIC ---
      useEffect(() => {
          if (!showResults && Object.keys(mcqState).length > 0) {
              const key = `nst_mcq_progress_${chapter.id}`;
              storage.setItem(key, {
                  mcqState,
                  batchIndex,
                  localMcqData
              });
          }
      }, [mcqState, batchIndex, chapter.id, localMcqData, showResults]);

      const handleResume = () => {
          const key = `nst_mcq_progress_${chapter.id}`;
          storage.getItem(key).then(saved => {
              if (saved) {
                  const parsed = saved;
                  setMcqState(parsed.mcqState || {});
                  setBatchIndex(parsed.batchIndex || 0);
                  if (parsed.localMcqData) setLocalMcqData(parsed.localMcqData);
              }
              setShowResumePrompt(false);
          });
      };

      const handleRestart = () => {
          const key = `nst_mcq_progress_${chapter.id}`;
          storage.removeItem(key);
          setMcqState({});
          setBatchIndex(0);
          setLocalMcqData([...(content.mcqData || [])].sort(() => Math.random() - 0.5));
          setShowResumePrompt(false);
          setAnalysisUnlocked(false);
          setShowResults(false);
      };

      const handleRecreate = () => {
          setConfirmConfig({
              isOpen: true,
              title: "Restart Quiz?",
              message: "This will shuffle questions and reset your current progress.",
              onConfirm: () => {
                  const shuffled = [...(content.mcqData || [])].sort(() => Math.random() - 0.5);
                  setLocalMcqData(shuffled);
                  setMcqState({});
                  setBatchIndex(0);
                  setShowResults(false);
                  setAnalysisUnlocked(false);
                  const key = `nst_mcq_progress_${chapter.id}`;
                  storage.removeItem(key);
                  setConfirmConfig(prev => ({...prev, isOpen: false}));
              }
          });
      };

      const displayData = localMcqData.length > 0 ? localMcqData : (content.mcqData || []);
      const currentBatchData = displayData.slice(batchIndex * BATCH_SIZE, (batchIndex + 1) * BATCH_SIZE);
      const hasMore = (batchIndex + 1) * BATCH_SIZE < displayData.length;

      const score = Object.keys(mcqState).reduce((acc, key) => {
          const qIdx = parseInt(key);
          return acc + (mcqState[qIdx] === displayData[qIdx].correctAnswer ? 1 : 0);
      }, 0);

      const currentCorrect = score;
      const currentWrong = Object.keys(mcqState).length - currentCorrect;
      const attemptedCount = Object.keys(mcqState).length;
      const minRequired = Math.min(30, displayData.length);
      const canSubmit = attemptedCount >= minRequired;

      const currentBatchAttemptedCount = currentBatchData.reduce((acc, _, localIdx) => {
          const idx = (batchIndex * BATCH_SIZE) + localIdx;
          return acc + (mcqState[idx] !== undefined && mcqState[idx] !== null ? 1 : 0);
      }, 0);
      const canGoNext = currentBatchAttemptedCount >= 1;

      const nextQuestion = () => {
          setBatchIndex(prev => prev + 1);
          const container = document.querySelector('.mcq-container');
          if (container) container.scrollTop = 0;
      };

      const handleOptionSelect = (qIdx: number, oIdx: number) => {
          setMcqState(prev => ({ ...prev, [qIdx]: oIdx }));
          const isCorrect = oIdx === displayData[qIdx].correctAnswer;

          // Auto-Next Logic — only for instantExplanation (premium) mode
          if (!showResults && (batchIndex + 1) * BATCH_SIZE < displayData.length) {
              if (instantExplanation) {
                  // PREMIUM FLOW
                  if (isCorrect) {
                      // Correct: Short delay then next
                      setTimeout(nextQuestion, 1000);
                  } else {
                      // Wrong: Speak feedback then next
                      const correctOpt = displayData[qIdx].options[displayData[qIdx].correctAnswer];
                      const explanation = displayData[qIdx].explanation || "";

                      const feedback = `Wrong Answer. The correct answer is ${stripHtml(correctOpt)}. ${stripHtml(explanation)}`;

                      speakText(
                          feedback,
                          null,
                          1.0,
                          language === 'Hindi' ? 'hi-IN' : 'en-US',
                          undefined,
                          () => {
                              nextQuestion();
                          }
                      );
                  }
              }
              // STANDARD FLOW: No auto-next. User clicks Next button manually.
          }
      };

      const handleSubmitRequest = () => {
          setShowSubmitModal(true);
      };

    // COMPARISON LOGIC
    useEffect(() => {
        if (showResults && user?.mcqHistory) {
            // Find previous attempts for THIS chapter
            const attempts = user.mcqHistory
                .filter(h => h.chapterId === chapter.id)
                .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            // Current result is effectively the "latest" one we just submitted or viewing?
            // If we are viewing results in LessonView, we might not have saved it to history YET if McqView handles it.
            // But LessonView is also used for "Review".
            // Let's compare with the *latest* in history (which is the previous one if we consider the current session as new).
            // Actually, if showResults is true, the user has just finished.
            // The history might update via parent.

            if (attempts.length > 0) {
                const last = attempts[0]; // Most recent in history
                // If the current session score is available
                const currentScore = Object.keys(mcqState).reduce((acc, key) => {
                    const qIdx = parseInt(key);
                    return acc + (mcqState[qIdx] === displayData[qIdx].correctAnswer ? 1 : 0);
                }, 0);

                const currPct = Math.round((currentScore / displayData.length) * 100);
                const prevPct = Math.round((last.score / last.totalQuestions) * 100);

                const getStatus = (p: number) => p >= 80 ? 'STRONG' : p >= 50 ? 'AVERAGE' : 'WEAK';
                const prevStatus = getStatus(prevPct);
                const currStatus = getStatus(currPct);

                let msg = '';
                if (currPct >= prevPct) {
                    const improvement = currPct - prevPct;
                    msg = `Welcome ${user.name}, aapne achhi mehnat ki! Pichhli test me ${prevPct}% aapka marks tha, ish baar aapne ${currPct}% kiya. ${improvement > 0 ? `Improvement: ${improvement}%!` : 'Consistent performance!'}`;
                } else if (prevStatus === 'STRONG' && (currStatus === 'AVERAGE' || currStatus === 'WEAK')) {
                    msg = `Pichhli baar aapka ${prevPct}% aaya tha, ish baar ${currPct}%. Thoda aur mehnat kijiye aur revision kijiye. Next attempt me achha result aayega. Do hard work ${user.name}!`;
                }
                setComparisonMsg(msg);
            }
        }
    }, [showResults, user]);

    const handleConfirmSubmit = () => {
        setShowSubmitModal(false);
        const key = `nst_mcq_progress_${chapter.id}`;
        storage.removeItem(key);
        
        // Don't show results or unlock analysis immediately
        // This allows the MarksheetCard in McqView to handle the flow
        setShowResults(false);
        setAnalysisUnlocked(false);
        
        // CHECK WARNING (Rushed Questions)
        const rushedCount = Object.keys(timeSpentPerQuestion).filter(k => timeSpentPerQuestion[parseInt(k)] < 5).length;
        if (rushedCount > 5) {
            setAlertConfig({
                isOpen: true,
                type: 'ERROR',
                message: "Warning: It seems you finished too fast. Try to read questions carefully next time!"
            });
        }

        if (onMCQComplete) {
            onMCQComplete(score, mcqState as Record<number, number>, displayData, sessionTime, timeSpentPerQuestion);
        }

        // EXTRA SYNC FOR HISTORY (Ensuring it saves even if parent is busy)
        const historyItem = {
            id: `mcq_${chapter.id}_${Date.now()}`,
            type: 'MCQ_RESULT',
            title: `${chapter.title} - Test`,
            date: new Date().toISOString(),
            score,
            totalQuestions: displayData.length,
            timeTaken: sessionTime,
            chapterId: chapter.id,
            subjectId: subject.id,
            classLevel,
            userAnswers: mcqState
        };

        if (user?.id) {
            saveUserHistory(user.id, historyItem);
            saveTestResult(user.id, historyItem);
        }
    };

    // Keep submitRef updated for Anti-Cheat
    useEffect(() => {
        submitRef.current = handleConfirmSubmit;
    }, [handleConfirmSubmit]);

    const [downloadModalOpen, setDownloadModalOpen] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);

    const handleDownloadRequest = () => {
        if (!user) return;
        setDownloadModalOpen(true);
    };

    const handleSaveOffline = () => {
        if (!user) return;

        // Save both MCQ data and any associated notes
        const payload: any = {
            questions: localMcqData
        };

        if (content?.content) payload.theory = content.content; // Markdown fallback
        if (content?.topicNotes) payload.topicNotes = content.topicNotes;

        saveOfflineItem({
            id: `lesson_mcq_${chapter.id}_${Date.now()}`,
            type: 'MCQ',
            title: chapter.title,
            subtitle: subject.name,
            data: payload
        });
        setAlertConfig({isOpen: true, message: "MCQ & Notes Saved Offline!"});
    };

    const handleConfirmDownload = async (type: 'PDF' | 'MHTML') => {
        if (!user || !onUpdateUser) return;

        let cost = 10;
        // Level gates: creditFreeEvent requires L8, globalFreeMode requires L10
        const _dlUserLevel = (() => {
          if (!user) return 1;
          const score = user.totalScore || 0;
          const levels = [0, 100, 250, 500, 1000, 2000, 3500, 5500, 8000, 11000, 15000, 20000, 26000, 33000, 41000];
          let lvl = 1;
          for (let i = levels.length - 1; i >= 0; i--) { if (score >= levels[i]) { lvl = i + 1; break; } }
          return lvl;
        })();
        if ((settings?.isCreditFreeEvent && _dlUserLevel >= 8) || (settings?.isGlobalFreeMode && _dlUserLevel >= 10)) {
            cost = 0;
        }

        if (user.credits < cost) {
            setAlertConfig({isOpen: true, message: `Insufficient Credits! Download costs ${cost} coins.`});
            return;
        }

        // Deduct
        if (cost > 0) {
            const updatedUser = applyDeduction(user, cost) ?? user;
            onUpdateUser(updatedUser);
            localStorage.setItem('nst_current_user', JSON.stringify(updatedUser));
            saveUserToLive(updatedUser);
        }

        setIsDownloading(true);
        setDownloadModalOpen(false);

        // Allow UI to update (show hidden container if needed, though it's always there but maybe hidden via CSS)
        // We use a timeout to let the UI thread breathe
        setTimeout(async () => {
            // Temporarily apply desktop mode for download so content renders at full width
            const wasDesktop = isDesktopModeOn();
            if (!wasDesktop) setDesktopMode(true);

            // Small extra delay to let viewport change settle
            await new Promise(r => setTimeout(r, 200));

            if (type === 'MHTML') {
                downloadAsMHTML('printable-analysis-report', `${chapter.title}_Analysis`);
            } else {
                const element = document.getElementById('printable-analysis-report');
                if (element) {
                    try {
                        const canvas = await html2canvas(element, { scale: 1.5, backgroundColor: '#ffffff', useCORS: true });
                        const imgData = canvas.toDataURL('image/png');

                        const pdf = new jsPDF('p', 'mm', 'a4');
                        const pdfWidth = pdf.internal.pageSize.getWidth();
                        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

                        let heightLeft = pdfHeight;
                        let position = 0;
                        const pageHeight = pdf.internal.pageSize.getHeight();

                        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
                        heightLeft -= pageHeight;

                        while (heightLeft >= 0) {
                            position = heightLeft - pdfHeight;
                            pdf.addPage();
                            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
                            heightLeft -= pageHeight;
                        }

                        pdf.save(`${chapter.title}_Analysis.pdf`);
                    } catch (e) {
                        console.error("PDF Gen Error", e);
                        setAlertConfig({isOpen: true, message: "PDF Generation Failed."});
                    }
                }
            }

            // Restore original viewport if we changed it
            if (!wasDesktop) { setDesktopMode(false); setIsDesktopMode(false); }
            setIsDownloading(false);
            setAlertConfig({isOpen: true, message: `Download Complete! (${cost} Coins Deducted)`});
        }, 500);
    };

    const renderAnalysisDashboard = () => {
        const isPremium = content?.analysisType === 'PREMIUM';

        // Allow download even if not premium analysis? User asked for download button "analysis, revision hub dono ke pass".
        // We render it here.

        return (
            <div className="space-y-6 mb-8 animate-in slide-in-from-top-4">
                {comparisonMsg && (
                    <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl mb-4 animate-in slide-in-from-top-2">
                        <p className="text-sm text-blue-800 font-bold leading-relaxed">
                            {comparisonMsg}
                        </p>
                    </div>
                )}

                {/* TABS HEADER */}
                <div className="flex p-1 bg-slate-100 rounded-xl mb-4">
                    <button onClick={() => setActiveAnalysisTab('OVERVIEW')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeAnalysisTab === 'OVERVIEW' ? 'bg-white shadow text-slate-800' : 'text-slate-600'}`}>Overview</button>
                    <button onClick={() => setActiveAnalysisTab('QUESTIONS')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeAnalysisTab === 'QUESTIONS' ? 'bg-white shadow text-slate-800' : 'text-slate-600'}`}>All Questions</button>
                    <button onClick={() => setActiveAnalysisTab('MISTAKES')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeAnalysisTab === 'MISTAKES' ? 'bg-white shadow text-slate-800' : 'text-slate-600'}`}>Mistakes</button>
                </div>

                <div className="flex justify-end mb-4 gap-2">
                    <button
                        onClick={handleDownloadRequest}
                        className="bg-green-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg hover:bg-green-700 flex items-center gap-2"
                    >
                        <Download size={16} /> Download Report (10 CR)
                    </button>
                    <button
                        onClick={handleSaveOffline}
                        className="bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg hover:bg-slate-900 flex items-center gap-2 border border-slate-700 transition-all"
                    >
                        <Download size={16} className="animate-bounce" /> Save Offline
                    </button>
                </div>

                {/* AI REPORT (PREMIUM ONLY) */}
                {isPremium && content?.aiAnalysisText && (
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-purple-100 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-purple-100 rounded-full blur-3xl opacity-50 -mr-10 -mt-10"></div>
                    <div className="flex items-center justify-between mb-4 relative z-10">
                        <div className="flex items-center gap-3"><button onClick={toggleFullScreen} className="p-2 bg-slate-100 rounded-full text-slate-600 hover:bg-slate-200" title="Toggle Fullscreen"><Maximize size={20} /></button>
                            <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-lg shadow-purple-200">
                                <BrainCircuit size={20} />
                            </div>
                            <div>
                                <h3 className="font-black text-slate-800 text-lg">AI Performance Report</h3>
                                <p className="text-xs text-purple-600 font-bold">Deep Insights & Strategy</p>
                            </div>
                        </div>
                        <SpeakButton text={content.aiAnalysisText} className="p-2 bg-purple-50 text-purple-600 hover:bg-purple-100" />
                    </div>
                    <div className="prose prose-sm prose-slate max-w-none w-full prose-p:text-slate-600 prose-headings:font-black prose-headings:text-slate-800 bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <ReactMarkdown>{content.aiAnalysisText}</ReactMarkdown>
                    </div>
                </div>
                )}
            </div>
        );
    };

    const renderRecommendedNotes = () => {
        const isPremium = content?.analysisType === 'PREMIUM';

        // Filter Notes by Chapter AND Topic (if available)
        const notes = universalNotes.filter(n => {
            const isChapterMatch = n.chapterId === chapter.id;
            // Also show if subtopic name matches
            return isChapterMatch;
        });

        // Group Notes by Topic
        const groupedNotes: Record<string, any[]> = {};
        notes.forEach(n => {
            const t = n.topic || 'General';
            if (!groupedNotes[t]) groupedNotes[t] = [];
            groupedNotes[t].push(n);
        });

        return (
            <div className={`p-6 rounded-3xl shadow-sm border relative overflow-hidden mt-8 animate-in slide-in-from-bottom-4 ${isPremium ? 'bg-white border-red-100' : 'bg-white border-orange-100'}`}>
                <div className="flex items-center gap-3 mb-4 relative z-10">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg ${isPremium ? 'bg-red-600 text-white shadow-red-200' : 'bg-orange-500 text-white shadow-orange-200'}`}>
                        {isPremium ? <FileText size={20} /> : <Lightbulb size={20} />}
                    </div>
                    <div>
                        <h3 className="font-black text-slate-800 text-lg">{isPremium ? 'Premium Study Notes' : 'Recommended Reading'}</h3>
                        <p className={`text-xs font-bold ${isPremium ? 'text-red-600' : 'text-orange-600'}`}>
                            {isPremium ? 'High-Yield PDFs for Weak Topics' : 'Topic-wise Revision Notes'}
                        </p>
                    </div>
                </div>

                {recLoading ? (
                    <div className="text-center py-8 text-slate-500 font-bold animate-pulse">Finding best notes...</div>
                ) : notes.length === 0 ? (
                    <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        <p className="text-slate-500 font-bold text-sm">No specific notes found for this chapter.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {Object.keys(groupedNotes).map((topic, i) => (
                            <div key={i} className="space-y-2">
                                <h4 className="text-xs font-black text-slate-600 uppercase tracking-widest pl-1">{topic}</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {groupedNotes[topic].map((note, idx) => (
                                        <div key={idx} className="bg-slate-50 p-4 rounded-xl border border-slate-200 hover:border-blue-300 transition-colors group flex justify-between items-center">
                                            <div>
                                                <h4 className="font-bold text-slate-800 text-sm mb-1 group-hover:text-blue-700">{note.title}</h4>
                                            </div>
                                            {isPremium ? (
                                                <a href={note.url} target="_blank" rel="noopener noreferrer" className="py-1 px-3 bg-red-600 text-white rounded-lg text-[10px] font-bold hover:bg-red-700 shadow transition-all">
                                                    PDF
                                                </a>
                                            ) : (
                                                <button onClick={() => setViewingNote(note)} className="py-1 px-3 bg-orange-500 text-white rounded-lg text-[10px] font-bold hover:bg-orange-600 shadow transition-all">
                                                    Read
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

      const handleNextPage = () => {
          setBatchIndex(prev => prev + 1);
          const container = document.querySelector('.mcq-container');
          if(container) container.scrollTop = 0;
      };

      const handlePrevPage = () => {
          if (batchIndex > 0) {
              setBatchIndex(prev => prev - 1);
              const container = document.querySelector('.mcq-container');
              if(container) container.scrollTop = 0;
          }
      };

      return (
          <div className="flex flex-col h-full bg-slate-50 animate-in fade-in relative mcq-container overflow-y-auto">
               <CustomAlert 
                   isOpen={alertConfig.isOpen} 
                   message={alertConfig.message} 
                   type="ERROR"
                   onClose={() => setAlertConfig({...alertConfig, isOpen: false})} 
               />
               <CustomConfirm
                   isOpen={confirmConfig.isOpen}
                   title={confirmConfig.title}
                   message={confirmConfig.message}
                   onConfirm={confirmConfig.onConfirm}
                   onCancel={() => setConfirmConfig({...confirmConfig, isOpen: false})}
               />

               {showResumePrompt && !showResults && (
                   <div className="absolute inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
                       <div className="bg-white rounded-2xl p-6 w-full text-center shadow-2xl">
                           <h3 className="text-xl font-black text-slate-800 mb-2">Resume Session?</h3>
                           <p className="text-slate-600 text-sm mb-6">You have a saved session for this chapter.</p>
                           <div className="flex gap-3">
                               <button onClick={handleRestart} className="flex-1 py-3 border border-slate-200 text-slate-600 font-bold rounded-xl">Restart</button>
                               <button onClick={handleResume} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg">Resume</button>
                           </div>
                       </div>
                   </div>
               )}

               {showSubmitModal && (
                   <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
                       <div className="bg-white rounded-2xl p-6 w-full text-center shadow-2xl animate-in zoom-in duration-200">
                           <Trophy size={48} className="mx-auto text-yellow-400 mb-4" />
                           <h3 className="text-xl font-black text-slate-800 mb-2">Submit Test?</h3>
                           <p className="text-slate-600 text-sm mb-6">
                               You have answered {Object.keys(mcqState).length} out of {displayData.length} questions.
                           </p>
                           <div className="flex gap-3">
                               <button onClick={() => setShowSubmitModal(false)} className="flex-1 py-3 border border-slate-200 text-slate-600 font-bold rounded-xl active:scale-95 transition-all">Cancel</button>
                               <button onClick={handleConfirmSubmit} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-200 active:scale-95 transition-all">Yes, Submit</button>
                           </div>
                       </div>
                   </div>
               )}

               {/* Topic Sidebar Overlay */}
               {showTopicSidebar && (
                   <div className="fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-sm flex justify-end" onClick={() => setShowTopicSidebar(false)}>
                        <div className="w-80 bg-white h-full shadow-2xl animate-in slide-in-from-right duration-200 flex flex-col" onClick={e => e.stopPropagation()}>
                            <div className="p-4 border-b flex items-center justify-between bg-slate-50">
                                <h3 className="font-bold text-slate-800 flex items-center gap-2"><List size={18}/> Topic Breakdown</h3>
                                <button onClick={() => setShowTopicSidebar(false)} className="p-2 hover:bg-slate-200 rounded-full"><X size={18}/></button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4">
                                {(() => {
                                    // Calculate Topic Counts
                                    const topicCounts: Record<string, {total: number, answered: number}> = {};
                                    displayData.forEach((q, idx) => {
                                        const t = q.topic || 'General';
                                        if (!topicCounts[t]) topicCounts[t] = {total: 0, answered: 0};
                                        topicCounts[t].total++;
                                        if (mcqState[idx] !== undefined) topicCounts[t].answered++;
                                    });

                                    // Identify Current Topic
                                    const currentQ = displayData[batchIndex];
                                    const currentTopic = currentQ?.topic || 'General';

                                    return (
                                        <div className="space-y-3">
                                            {Object.keys(topicCounts).map((t, i) => {
                                                const stats = topicCounts[t];
                                                const isCurrent = t === currentTopic;
                                                return (
                                                    <div key={i} className={`p-3 rounded-xl border ${isCurrent ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-100'}`}>
                                                        <div className="flex justify-between items-center mb-1">
                                                            <p className={`text-xs font-bold ${isCurrent ? 'text-blue-700' : 'text-slate-700'}`}>{t}</p>
                                                            {isCurrent && <span className="text-[9px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-bold">Active</span>}
                                                        </div>
                                                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                                            <div className="h-full bg-green-500 transition-all" style={{width: `${(stats.answered/stats.total)*100}%`}}></div>
                                                        </div>
                                                        <p className="text-[10px] text-slate-500 mt-1 text-right">{stats.answered} / {stats.total}</p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                   </div>
               )}

               {/* Question Drawer Overlay */}
               {showQuestionDrawer && (
                   <div className="fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-sm flex justify-end" onClick={() => setShowQuestionDrawer(false)}>
                        <div className="w-80 bg-white h-full shadow-2xl animate-in slide-in-from-right duration-200 flex flex-col" onClick={e => e.stopPropagation()}>
                            <div className="p-4 border-b flex items-center justify-between bg-[#FDFBF7] shadow-sm rounded-t-xl border-amber-100">
                                <h3 className="font-bold text-amber-900 flex items-center gap-2 text-lg"><Grip size={20} className="text-amber-500"/> Question Palette</h3>
                                <button onClick={() => setShowQuestionDrawer(false)} className="px-3 py-1.5 flex items-center gap-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg font-medium transition-colors border border-amber-200 shadow-sm"><X size={16}/> Back</button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-5 bg-gradient-to-b from-white to-slate-50">
                                <div className="grid grid-cols-5 gap-3">
                                    {displayData.map((_, idx) => {
                                        const isAnswered = mcqState[idx] !== undefined && mcqState[idx] !== null;
                                        const isCurrent = idx === batchIndex;

                                        let btnClass = "aspect-square rounded-xl text-sm font-bold flex items-center justify-center transition-all border shadow-sm ";
                                        if (isCurrent) {
                                            btnClass += "bg-amber-500 text-white border-amber-600 shadow-md shadow-amber-200 scale-105 ring-4 ring-amber-100";
                                        } else if (isAnswered) {
                                            btnClass += "bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100 ring-1 ring-emerald-100/50";
                                        } else {
                                            btnClass += "bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:border-slate-300";
                                        }

                                        return (
                                            <button
                                                key={idx}
                                                onClick={() => {
                                                    setBatchIndex(idx);
                                                    setShowQuestionDrawer(false);
                                                }}
                                                className={btnClass}
                                            >
                                                {idx + 1}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="p-4 border-t bg-[#FDFBF7] text-sm font-medium text-slate-600 flex justify-center gap-4 flex-wrap rounded-b-xl border-amber-100">
                                <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-md bg-emerald-50 border border-emerald-200 shadow-sm"></div> <span className="text-emerald-700">Answered</span></div>
                                <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-md bg-amber-500 border border-amber-600 shadow-sm"></div> <span className="text-amber-700">Current</span></div>
                                <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-md bg-white border border-slate-200 shadow-sm"></div> <span>Unattempted</span></div>
                            </div>
                        </div>
                   </div>
               )}

               {rotateToast && (
                   <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[9999] bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-lg animate-in fade-in">
                       {rotateToast}
                   </div>
               )}
               <div className={`flex items-center justify-between p-4 bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm${isImmersive ? ' hidden' : ''}`}>
                   <div className="flex gap-2">
                       <button onClick={onBack} className="flex items-center gap-2 text-slate-600 font-bold text-sm bg-slate-100 px-3 py-2 rounded-lg hover:bg-slate-200 transition-colors">
                           <ArrowLeft size={16} /> Exit
                       </button>
                       {(content.manualMcqData_HI && content.manualMcqData_HI.length > 0) && (
                           <button 
                               onClick={() => setLanguage(l => l === 'English' ? 'Hindi' : 'English')}
                               className="flex items-center gap-2 text-slate-600 font-bold text-xs bg-slate-100 border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-200 transition-colors"
                           >
                               <Globe size={14} /> {language === 'English' ? 'English' : 'हिंदी'}
                           </button>
                       )}

                   </div>
                   <div className="flex items-center gap-3">
                       <button
                           onClick={handleRotate}
                           className="p-2 bg-slate-100 rounded-full text-slate-600 hover:bg-slate-200 transition-colors"
                           title="Screen Rotate"
                       >
                           <RotateCcw size={18} />
                       </button>
                       <button
                           onClick={toggleDesktopMode}
                           className={`p-2 rounded-full transition-colors ${isDesktopMode ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                           title={isDesktopMode ? 'Desktop Mode ON' : 'Desktop Mode OFF'}
                       >
                           <Monitor size={18} />
                       </button>
                       <button onClick={toggleFullScreen} className="p-2 bg-slate-100 rounded-full text-slate-600 hover:bg-slate-200" title="Toggle Fullscreen"><Maximize size={20} /></button>
                       <button onClick={() => setShowTopicSidebar(true)} className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200" title="View Topic Progress">
                           <List size={20} />
                       </button>

                       {/* Auto Read Toggle (Global) */}
                       <button
                           onClick={() => {
                               const newState = !autoReadEnabled;
                               setAutoReadEnabled(newState);
                               if (onToggleAutoTts) onToggleAutoTts(newState);
                               if (!newState) window.speechSynthesis.cancel();
                           }}
                           className={`p-2 rounded-lg transition-all ${autoReadEnabled ? 'bg-indigo-100 text-indigo-600 ring-2 ring-indigo-200' : 'bg-slate-100 text-slate-500'}`}
                           title="Toggle Auto-Read"
                       >
                           {autoReadEnabled ? <Volume2 size={18} /> : <Volume2 size={18} className="opacity-50" />}
                       </button>

                       {/* Timer Display - Prominent */}
                       <div className="flex items-center gap-3 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                           <div className="flex flex-col items-end">
                               <span className="text-[9px] font-bold text-slate-500 uppercase leading-none">Total</span>
                               <span className="text-xs font-mono font-bold text-slate-700 leading-none">
                                   {Math.floor(sessionTime / 60)}:{String(sessionTime % 60).padStart(2, '0')}
                               </span>
                           </div>
                           <div className="h-6 w-px bg-slate-200"></div>
                           <div className="flex flex-col items-end">
                               <span className="text-[9px] font-bold text-slate-500 uppercase leading-none">Q-Time</span>
                               <span className={`text-xs font-mono font-bold leading-none ${(timeSpentPerQuestion[batchIndex] || 0) > 60 ? 'text-red-500' : 'text-slate-700'}`}>
                                   {Math.floor((timeSpentPerQuestion[batchIndex] || 0) / 60)}:{String((timeSpentPerQuestion[batchIndex] || 0) % 60).padStart(2, '0')}
                               </span>
                           </div>
                       </div>

                       <button
                           onClick={() => setShowQuestionDrawer(true)}
                           className="flex items-center gap-2 text-slate-600 font-bold text-xs bg-slate-100 border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-200 transition-colors"
                       >
                           <Grip size={16} /> <span className="hidden sm:inline">All Questions</span>
                           <span className="bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded text-[10px] ml-1">
                               {attemptedCount}/{displayData.length}
                           </span>
                       </button>
                   </div>
               </div>
               
               <div className="flex-1 overflow-y-auto p-4 space-y-6 w-full mx-auto w-full pb-4 mcq-container">
                   {/* 1. TOPIC HEADER (ANALYSIS ONLY) */}
                   {showResults && content.type === 'MCQ_ANALYSIS' && (
                       <div className="mb-4">
                           <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                               <Zap size={24} className="text-orange-500" />
                               {content.topic ? `${content.topic} Analysis` : 'Chapter Analysis'}
                           </h2>
                           <p className="text-sm text-slate-600 font-medium ml-8">Review your performance and study recommended notes.</p>
                       </div>
                   )}

                   {/* 2. AI REPORT (Top) */}
                   {showResults && (content.type === 'MCQ_ANALYSIS' || content.type === 'MCQ_RESULT') && renderAnalysisDashboard()}

                   {/* 3. QUESTIONS LIST (Grouped by Topic if Analysis Mode) */}
                   {(() => {
                       // Premium Analysis Mode with Topic Grouping
                       if (showResults && (content.type === 'MCQ_ANALYSIS' || content.type === 'MCQ_RESULT')) {

                           // CHAPTER ANALYSIS TAB (FULL PAGE VIEW)
                           if (activeAnalysisTab === 'CHAPTER_ANALYSIS') {
                               const attempted = Object.keys(mcqState).length;
                               const correct = displayData.reduce((acc, q, i) => acc + (mcqState[i] === q.correctAnswer ? 1 : 0), 0);
                               const wrong = attempted - correct;
                               const percent = displayData.length > 0 ? Math.round((correct / displayData.length) * 100) : 0;

                               // Topic Stats
                               const topicStats: Record<string, {total: number, correct: number}> = {};
                               displayData.forEach((q, idx) => {
                                   const t = q.topic || 'General';
                                   if (!topicStats[t]) topicStats[t] = {total: 0, correct: 0};
                                   topicStats[t].total++;
                                   if (mcqState[idx] === q.correctAnswer) topicStats[t].correct++;
                               });

                               // Recent Progress (Last 3 Attempts)
                               const pastAttempts = user?.mcqHistory
                                  ?.filter(h => h.chapterId === chapter.id)
                                  .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                                  .slice(-3) || [];

                               // Mistake Patterns (Weak Topics < 50%)
                               const weakTopics = Object.keys(topicStats)
                                  .filter(t => (topicStats[t].correct / topicStats[t].total) < 0.5)
                                  .map(t => ({ topic: t, score: topicStats[t].correct, total: topicStats[t].total }));

                               // TEACHER INSIGHT (Human Language - Expanded for All Topics)
                               const getTeacherFeedback = () => {
                                   let msg = "";
                                   let overallComparison = "";

                                   // 1. Overall Trend (Comparing with previous attempt if exists)
                                   if (pastAttempts.length > 0) {
                                       const last = pastAttempts[pastAttempts.length - 1]; // Previous attempt
                                       const prevScore = Math.round((last.score / last.totalQuestions) * 100);
                                       const currScore = percent;
                                       const diff = currScore - prevScore;

                                       if (diff > 10) overallComparison = `### 🌟 Outstanding Progress!\nBohot badhiya improvement hai! Pichhli baar **${prevScore}%** tha, ish baar **${currScore}%** aaya hai.`;
                                       else if (diff > 0) overallComparison = `### 👍 Good Improvement\nSahi ja rahe ho! Score ${prevScore}% se badh kar ${currScore}% ho gaya hai.`;
                                       else if (diff < -10) overallComparison = `### 📉 Needs Attention\nBeta, score kaafi gir gaya (${prevScore}% -> ${currScore}%). Kya samajh nahi aaya?`;
                                       else if (diff < 0) overallComparison = `### ⚠️ Slight Drop\nThoda dhyan do. Pichhli baar ${prevScore}% tha, ish baar ${currScore}% ho gaya. Consistency zaroori hai.`;
                                       else overallComparison = `### ⚖️ Consistent Performance\nConsistency achhi hai (**${currScore}%**), par hume ab next level pe jana hai.`;
                                   } else {
                                       overallComparison = `### 👋 Welcome!\nFirst attempt hai! Chalo dekhte hain kahan improvement ki zarurat hai.`;
                                   }

                                   msg += overallComparison + "\n\n";

                                   // 2. Comprehensive Topic Analysis
                                   const allTopics = Object.keys(topicStats);
                                   if (allTopics.length > 0) {
                                       msg += `#### 🧠 Topic-wise Feedback:\n`;

                                       allTopics.forEach(topic => {
                                           const stats = topicStats[topic];
                                           const accuracy = (stats.correct / stats.total) * 100;

                                           if (accuracy >= 80) {
                                               msg += `- ✅ **${topic}**: Shabash! Yahan pakad mazboot hai (${Math.round(accuracy)}%).\n`;
                                           } else if (accuracy >= 50) {
                                               msg += `- ⚖️ **${topic}**: Thik hai (${Math.round(accuracy)}%), par thoda aur revision chahiye.\n`;
                                           } else {
                                               msg += `- ❌ **${topic}**: Yahan dikkat hai (${Math.round(accuracy)}%). Is topic ko dubara padhna padega.\n`;
                                           }
                                       });
                                   }

                                   return msg;
                               };

                               const teacherMsg = getTeacherFeedback();

                               return (
                                   <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">

                                       {/* TEACHER INSIGHT CARD */}
                                       {teacherMsg && (
                                           <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 p-5 rounded-2xl flex gap-4 items-start relative overflow-hidden shadow-sm">
                                               {/* Decorative Elements */}
                                               <div className="absolute -right-4 -top-4 w-20 h-20 bg-indigo-100 rounded-full blur-2xl opacity-50"></div>

                                               <div className="w-12 h-12 rounded-full bg-white border-2 border-indigo-200 flex items-center justify-center shrink-0 shadow-sm z-10">
                                                   {/* Use an emoji or icon for the teacher avatar */}
                                                   <span className="text-2xl">👨‍🏫</span>
                                               </div>
                                               <div className="z-10 flex-1">
                                                   <h4 className="font-black text-indigo-900 text-sm mb-1 uppercase tracking-wide">Teacher's Remarks</h4>
                                                   <p className="text-indigo-800 text-sm font-medium leading-relaxed">
                                                       <ReactMarkdown>{teacherMsg}</ReactMarkdown>
                                                   </p>
                                               </div>
                                           </div>
                                       )}

                                       {/* HEADER & MARKSHEET BUTTON */}
                                       <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                           <div>
                                               <h2 className="text-2xl font-black text-slate-800">Analysis Dashboard</h2>
                                               <p className="text-slate-600 font-medium">Deep dive into your performance.</p>
                                           </div>
                                           {onShowMarksheet && (
                                                <button
                                                    onClick={() => onShowMarksheet(content.analytics)}
                                                    className="bg-slate-800 text-white px-5 py-3 rounded-xl text-sm font-bold shadow-lg hover:bg-slate-900 flex items-center justify-center gap-2 transition-all active:scale-95"
                                                >
                                                    <FileText size={18} /> View Official Marksheet
                                                </button>
                                           )}
                                       </div>

                                       {/* Performance Summary */}
                                       <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                                           <h3 className="font-black text-slate-800 text-lg mb-4">Performance Summary</h3>
                                           <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                                               <div className="p-3 bg-slate-50 rounded-xl border border-slate-100"><div className="text-xs text-slate-600 uppercase font-bold">Score</div><div className="text-2xl font-black text-slate-800">{correct}/{displayData.length}</div></div>
                                               <div className="p-3 bg-slate-50 rounded-xl border border-slate-100"><div className="text-xs text-slate-600 uppercase font-bold">Accuracy</div><div className="text-2xl font-black text-blue-600">{percent}%</div></div>
                                               <div className="p-3 bg-green-50 rounded-xl border border-green-100"><div className="text-xs text-green-600 uppercase font-bold">Correct</div><div className="text-2xl font-black text-green-700">{correct}</div></div>
                                               <div className="p-3 bg-red-50 rounded-xl border border-red-100"><div className="text-xs text-red-600 uppercase font-bold">Wrong</div><div className="text-2xl font-black text-red-700">{wrong}</div></div>
                                           </div>
                                       </div>

                                       {/* RECENT PROGRESS (Last 3 Attempts) */}
                                       {pastAttempts.length > 0 && (
                                           <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                                               <h3 className="font-black text-slate-800 text-lg mb-4 flex items-center gap-2"><BarChart3 size={18}/> Recent Progress</h3>
                                               <div className="flex items-end gap-2 h-32 pb-2">
                                                   {pastAttempts.map((att, idx) => {
                                                       const p = Math.round((att.score / att.totalQuestions) * 100);
                                                       return (
                                                           <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full gap-2 group">
                                                               <span className="text-xs font-bold text-slate-600 group-hover:text-blue-600 transition-colors">{p}%</span>
                                                               <div className="w-full max-w-[40px] bg-slate-100 rounded-t-lg relative overflow-hidden group-hover:bg-blue-50 transition-colors" style={{height: `${p}%`, minHeight: '10%'}}>
                                                                   <div className="absolute bottom-0 left-0 right-0 top-0 bg-blue-500 opacity-20"></div>
                                                                   <div className="absolute bottom-0 left-0 right-0 bg-blue-600 transition-all group-hover:bg-blue-500" style={{height: '4px'}}></div>
                                                               </div>
                                                               <span className="text-[10px] font-bold text-slate-500 uppercase">{new Date(att.date).toLocaleDateString(undefined, {month:'short', day:'numeric'})}</span>
                                                           </div>
                                                       );
                                                   })}
                                               </div>
                                           </div>
                                       )}

                                       {/* MISTAKE PATTERNS (Weak Areas) */}
                                       {weakTopics.length > 0 && (
                                           <div className="bg-red-50 p-6 rounded-3xl border border-red-100">
                                                <h3 className="font-black text-red-900 text-lg mb-4 flex items-center gap-2"><AlertTriangle size={18}/> Weak Areas (Needs Focus)</h3>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    {weakTopics.map((item, idx) => (
                                                        <div key={idx} className="bg-white p-3 rounded-xl border border-red-100 flex items-center justify-between">
                                                            <span className="font-bold text-slate-700 text-sm">{item.topic}</span>
                                                            <span className="text-xs font-black text-red-600 bg-red-50 px-2 py-1 rounded-lg">
                                                                {Math.round((item.score/item.total)*100)}% Accuracy
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                           </div>
                                       )}

                                       {/* AI Analysis (If Available) */}
                                       {content?.aiAnalysisText && (
                                           <div className="bg-white p-6 rounded-3xl shadow-sm border border-purple-100 relative overflow-hidden">
                                               <div className="flex items-center justify-between mb-4 relative z-10">
                                                   <h3 className="font-black text-slate-800 text-lg flex items-center gap-2"><BrainCircuit size={18}/> AI Performance Report</h3>
                                                   <SpeakButton text={content.aiAnalysisText} className="p-2 bg-purple-50 text-purple-600 hover:bg-purple-100" />
                                               </div>
                                               <div className="prose prose-sm prose-slate max-w-none w-full prose-p:text-slate-600 prose-headings:font-black prose-headings:text-slate-800 bg-slate-50 p-4 rounded-xl border border-slate-100">
                                                   <ReactMarkdown>{content.aiAnalysisText}</ReactMarkdown>
                                               </div>
                                           </div>
                                       )}

                                       {/* Topic Breakdown */}
                                       <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                                           <h3 className="font-black text-slate-800 text-lg mb-4 flex items-center gap-2"><List size={18}/> Topic Breakdown</h3>
                                           <div className="space-y-4">
                                               {Object.keys(topicStats).map((t, i) => {
                                                   const s = topicStats[t];
                                                   const p = Math.round((s.correct/s.total)*100);
                                                   return (
                                                       <div key={i}>
                                                           <div className="flex justify-between mb-1 text-xs font-bold">
                                                               <span className="uppercase text-slate-600">{t}</span>
                                                               <span>{s.correct}/{s.total} ({p}%)</span>
                                                           </div>
                                                           <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                                               <div className={`h-full ${p>=80?'bg-green-500':'bg-red-500'}`} style={{width: `${p}%`}}></div>
                                                           </div>
                                                       </div>
                                                   );
                                               })}
                                           </div>
                                       </div>

                                       {/* Detailed Solutions Hidden by default, redirecting to marksheet instead */}
                                       <div className="mt-8">
                                           <button
                                               onClick={() => {
                                                   if (onShowMarksheet) {
                                                       // Construct temporary result object to pass to marksheet
                                                       const result = {
                                                           id: 'temp',
                                                           userId: user?.id,
                                                           chapterId: chapter.id,
                                                           chapterTitle: chapter.title,
                                                           subjectId: subject.id,
                                                           subjectName: subject.name,
                                                           score: Object.keys(mcqState).reduce((acc, k) => acc + (mcqState[parseInt(k)] === displayData[parseInt(k)].correctAnswer ? 1 : 0), 0),
                                                           totalQuestions: displayData.length,
                                                           totalTimeSeconds: 0,
                                                           omrData: displayData.map((q, i) => ({
                                                               qIndex: i,
                                                               selected: mcqState[i] !== undefined && mcqState[i] !== null ? mcqState[i]! : -1,
                                                               correct: q.correctAnswer
                                                           })),
                                                           date: new Date().toISOString()
                                                       };
                                                       onShowMarksheet(result);
                                                   } else {
                                                       setAlertConfig({isOpen: true, title: "Unavailable", message: "Explanation page is not available here."});
                                                   }
                                               }}
                                               className="w-full bg-blue-100 text-blue-700 font-bold py-4 rounded-2xl flex justify-center items-center gap-2 hover:bg-blue-200 transition-colors"
                                           >
                                               <BookOpen size={20} /> View Full Explanations Page
                                           </button>
                                       </div>
                                   </div>
                               );
                           }

                           // TAB LOGIC
                           if (activeAnalysisTab === 'OVERVIEW') {
                               return (
                                   <div className="grid grid-cols-2 gap-4">
                                       <div className="bg-white p-4 rounded-2xl border shadow-sm">
                                           <div className="text-sm text-slate-600 font-bold uppercase mb-1">Total Questions</div>
                                           <div className="text-3xl font-black text-slate-800">{displayData.length}</div>
                                       </div>
                                       <div className="bg-white p-4 rounded-2xl border shadow-sm">
                                           <div className="text-sm text-slate-600 font-bold uppercase mb-1">Attempted</div>
                                           <div className="text-3xl font-black text-blue-600">{Object.keys(mcqState).length}</div>
                                       </div>
                                       <div className="bg-white p-4 rounded-2xl border shadow-sm border-green-100 bg-green-50">
                                           <div className="text-sm text-green-600 font-bold uppercase mb-1">Correct</div>
                                           <div className="text-3xl font-black text-green-700">
                                               {displayData.reduce((acc, q, i) => acc + (mcqState[i] === q.correctAnswer ? 1 : 0), 0)}
                                           </div>
                                       </div>
                                       <div className="bg-white p-4 rounded-2xl border shadow-sm border-red-100 bg-red-50">
                                           <div className="text-sm text-red-600 font-bold uppercase mb-1">Wrong</div>
                                           <div className="text-3xl font-black text-red-700">
                                               {displayData.reduce((acc, q, i) => acc + (mcqState[i] !== undefined && mcqState[i] !== q.correctAnswer ? 1 : 0), 0)}
                                           </div>
                                       </div>
                                   </div>
                               );
                           }

                           // 1. Group Data
                           const grouped: Record<string, {questions: MCQItem[], indices: number[], correct: number}> = {};
                           displayData.forEach((q, idx) => {
                               // Filter for MISTAKES tab
                               if (activeAnalysisTab === 'MISTAKES') {
                                   if (mcqState[idx] === undefined || mcqState[idx] === q.correctAnswer) return;
                               }

                               const topic = q.topic || 'General';
                               if (!grouped[topic]) grouped[topic] = {questions: [], indices: [], correct: 0};
                               grouped[topic].questions.push(q);
                               grouped[topic].indices.push(idx);
                               if (mcqState[idx] === q.correctAnswer) grouped[topic].correct++;
                           });

                           if (Object.keys(grouped).length === 0) {
                               return (
                                   <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-300">
                                       <p className="text-slate-500 font-bold">No questions found for this filter.</p>
                                   </div>
                               );
                           }

                           return Object.keys(grouped).map((topic, groupIdx) => {
                               const group = grouped[topic];
                               const score = group.correct;
                               const total = group.questions.length;
                               const percentage = Math.round((score / total) * 100);

                               // Find Topic Note (if any)
                               const topicNote = universalNotes.find(n => n.topic === topic && (n.chapterId === chapter.id || n.type === 'HTML')); // Loose match for demo

                               return (
                                   <div key={groupIdx} className="mb-8 border-t-4 border-slate-200 pt-6">
                                       <div className="flex items-center justify-between mb-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                                           <div>
                                               <h3 className="font-black text-slate-800 text-lg flex items-center gap-2">
                                                   <span className="bg-slate-200 text-slate-600 w-6 h-6 rounded flex items-center justify-center text-xs">{groupIdx + 1}</span>
                                                   {topic}
                                               </h3>
                                           </div>
                                           <div className="text-right">
                                               {activeAnalysisTab === 'QUESTIONS' && (
                                                   <>
                                                       <div className="text-2xl font-black text-blue-600">{percentage}%</div>
                                                       <div className="text-xs font-bold text-slate-500">{score}/{total} Correct</div>
                                                   </>
                                               )}
                                               {activeAnalysisTab === 'MISTAKES' && (
                                                   <span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-1 rounded">Needs Improvement</span>
                                               )}
                                           </div>
                                       </div>

                                       <div className="space-y-6">
                                           {group.questions.map((q, localI) => {
                                               const idx = group.indices[localI];
                                               const userAnswer = mcqState[idx];
                                               const isAnswered = userAnswer !== undefined && userAnswer !== null;
                                               const isCorrect = isAnswered && userAnswer === q.correctAnswer;
                                               const isWrong = isAnswered && !isCorrect;
                                               const fullQuestionText = `${q.question}. Options are: ${q.options.map((opt, i) => `Option ${i+1}: ${opt}`).join('. ')}`;

                                               return (
                                                   <div key={idx} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                                                       <div className="flex justify-between items-start mb-4 gap-3">
                                                           <div className="font-bold text-slate-800 flex gap-3 leading-relaxed flex-1">
                                                               <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 font-bold mt-0.5 ${isCorrect ? 'bg-green-100 text-green-700' : isWrong ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                                                                   {idx + 1}
                                                               </span>
                                                               <div className="w-full">
                                                                   <div dangerouslySetInnerHTML={{ __html: renderMathInHtml(q.question) }} className="prose prose-sm max-w-none" />
                                                                   {q.statements && q.statements.length > 0 && (
                                                                       <div className="mt-3 mb-2 flex flex-col space-y-2">
                                                                           {q.statements.map((stmt, sIdx) => (
                                                                               <div key={sIdx} className="bg-slate-50/80 p-3 rounded-lg border-l-4 border-indigo-200 text-slate-700 text-sm font-medium" dangerouslySetInnerHTML={{ __html: renderMathInHtml(stmt) }} />
                                                                           ))}
                                                                       </div>
                                                                   )}
                                                               </div>
                                                           </div>
                                                           <McqSpeakButtons
                                                               question={q.question}
                                                               options={q.options}
                                                               correctAnswer={q.correctAnswer}
                                                               className="shrink-0"
                                                               allQuestions={group.questions as any}
                                                               index={localI}
                                                           />
                                                       </div>
                                                       <div className="space-y-2">
                                                           {q.options.map((opt, oIdx) => {
                                                               let btnClass = "w-full text-left p-3 rounded-xl border transition-all text-sm font-medium relative overflow-hidden ";
                                                               if (oIdx === q.correctAnswer) {
                                                                   btnClass += "bg-green-100 border-green-300 text-green-800";
                                                               } else if (userAnswer === oIdx) {
                                                                   btnClass += "bg-red-100 border-red-300 text-red-800";
                                                               } else {
                                                                   btnClass += "bg-slate-50 border-slate-100 opacity-60 text-slate-800";
                                                               }

                                                               return (
                                                                   <div key={oIdx} className={btnClass}>
                                                                       <span className="relative z-10 flex justify-between items-center w-full gap-2">
                                                                           <div dangerouslySetInnerHTML={{ __html: renderMathInHtml(opt) }} className="flex-1" />
                                                                           <div className="flex items-center gap-2 shrink-0">
                                                                               {oIdx === q.correctAnswer && <CheckCircle size={16} className="text-green-600" />}
                                                                               {userAnswer === oIdx && userAnswer !== q.correctAnswer && <XCircle size={16} className="text-red-500" />}
                                                                           </div>
                                                                       </span>
                                                                   </div>
                                                               );
                                                           })}
                                                       </div>
                                                       {q.explanation && (
                                                           <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-xl">
                                                               <div className="flex items-center justify-between mb-1">
                                                                   <div className="flex items-center gap-2 text-blue-700 font-bold text-xs">
                                                                       <BookOpen size={14} /> Explanation
                                                                   </div>
                                                                   <SpeakButton text={q.explanation} className="p-1 text-blue-400 hover:bg-blue-100" iconSize={14} />
                                                               </div>
                                                               <div className="text-slate-600 text-sm leading-relaxed prose prose-sm max-w-none w-full" dangerouslySetInnerHTML={{ __html: renderMathInHtml(q.explanation) }} />
                                                           </div>
                                                       )}
                                                   </div>
                                               );
                                           })}
                                       </div>

                                       {/* TOPIC NOTE INJECTION */}
                                       {topicNote && (
                                           <div className="mt-6 bg-amber-50 p-4 rounded-xl border border-amber-200">
                                               <h4 className="font-bold text-amber-900 flex items-center gap-2 mb-2">
                                                   <Lightbulb size={18} /> {topic} Revision Note
                                               </h4>
                                               <div className="prose prose-sm max-w-none w-full text-amber-800" dangerouslySetInnerHTML={{ __html: decodeHtml(topicNote.content || topicNote.html || '') }} />
                                           </div>
                                       )}
                                   </div>
                               );
                           });
                       } else {
                           // Standard Batch Rendering (Test Mode)
                           return currentBatchData.map((q, localIdx) => {
                               const idx = (batchIndex * BATCH_SIZE) + localIdx;
                               const userAnswer = mcqState[idx];
                               const isAnswered = userAnswer !== undefined && userAnswer !== null;
                               const isCorrect = isAnswered && userAnswer === q.correctAnswer;
                               const isWrong = isAnswered && !isCorrect;
                               
                               const isRevealed = revealedAnswers.has(idx);
                               const showExplanation = (instantExplanation && isAnswered && isWrong) || isRevealed;
                               const fullQuestionText = `${q.question}. Options are: ${q.options.map((opt, i) => `Option ${i+1}: ${opt}`).join('. ')}`;

                               return (
                                   <div key={idx} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
                                       <div className="flex justify-between items-start mb-4 gap-3">
                                           <div className="font-bold text-slate-800 flex gap-3 leading-relaxed flex-1">
                                               <span className="bg-blue-100 text-blue-700 w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 font-bold mt-0.5">{idx + 1}</span>
                                               <div className="w-full">
                                                   <div dangerouslySetInnerHTML={{ __html: renderMathInHtml(q.question) }} className="prose prose-sm max-w-none" />
                                                   {q.statements && q.statements.length > 0 && (
                                                       <div className="mt-3 mb-2 flex flex-col space-y-2">
                                                           {q.statements.map((stmt, sIdx) => (
                                                               <div key={sIdx} className="bg-slate-50/80 p-3 rounded-lg border-l-4 border-indigo-200 text-slate-700 text-sm font-medium" dangerouslySetInnerHTML={{ __html: renderMathInHtml(stmt) }} />
                                                           ))}
                                                       </div>
                                                   )}
                                               </div>
                                           </div>
                                           <div className="flex flex-col items-end gap-1.5 shrink-0">
                                               <McqSpeakButtons
                                                   question={q.question}
                                                   options={q.options}
                                                   correctAnswer={q.correctAnswer}
                                                   allQuestions={currentBatchData as any}
                                                   index={localIdx}
                                               />
                                               {autoReadEnabled && !showResults && !showSubmitModal && (
                                                   <SpeakButton
                                                       text={fullQuestionText}
                                                       className="hidden"
                                                       settings={settings}
                                                       autoPlay={autoReadEnabled && !showResults && !showSubmitModal}
                                                       onToggleAutoTts={onToggleAutoTts}
                                                   />
                                               )}
                                           </div>
                                       </div>
                                       <div className="space-y-2">
                                           {q.options.map((opt, oIdx) => {
                                               let btnClass = "w-full text-left p-3 rounded-xl border transition-all text-sm font-medium relative overflow-hidden ";

                                               const showColors = (instantExplanation && isAnswered) || isRevealed;

                                               if (showColors) {
                                                   if (oIdx === q.correctAnswer) {
                                                       btnClass += "bg-green-100 border-green-300 text-green-800";
                                                   } else if (userAnswer === oIdx) {
                                                       btnClass += "bg-red-100 border-red-300 text-red-800";
                                                   } else {
                                                       btnClass += "bg-slate-50 border-slate-100 opacity-60 text-slate-800";
                                                   }
                                               }
                                               else if (isAnswered) {
                                                    if (userAnswer === oIdx) {
                                                         btnClass += "bg-blue-100 border-blue-300 text-blue-800";
                                                    } else {
                                                         btnClass += "bg-slate-50 border-slate-100 opacity-60 text-slate-800";
                                                    }
                                               } else {
                                                   btnClass += "bg-white border-slate-200 hover:bg-slate-50 hover:border-blue-200 text-slate-800";
                                               }

                                               return (
                                                   <button
                                                       key={oIdx}
                                                       disabled={isAnswered || showResults}
                                                       onClick={() => handleOptionSelect(idx, oIdx)}
                                                       className={btnClass}
                                                   >
                                                       <span className="relative z-10 flex justify-between items-center w-full gap-2">
                                                           <div dangerouslySetInnerHTML={{ __html: renderMathInHtml(opt) }} className="flex-1" />
                                                           <div className="flex items-center gap-2 shrink-0">
                                                              {showColors && oIdx === q.correctAnswer && <CheckCircle size={16} className="text-green-600" />}
                                                              {showColors && userAnswer === oIdx && userAnswer !== q.correctAnswer && <XCircle size={16} className="text-red-500" />}
                                                           </div>
                                                       </span>
                                                   </button>
                                               );
                                           })}
                                       </div>

                                       {!showResults && !isRevealed && !(instantExplanation && isAnswered) && (
                                           <div className="mt-3 flex justify-end">
                                               <button
                                                   type="button"
                                                   onClick={() => setRevealedAnswers(prev => {
                                                       const next = new Set(prev);
                                                       next.add(idx);
                                                       return next;
                                                   })}
                                                   className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-full transition-colors"
                                               >
                                                   <Lightbulb size={12} /> Show Answer
                                               </button>
                                           </div>
                                       )}

                                       {showExplanation && (
                                           <div className="mt-6 flex flex-col gap-4 animate-in fade-in slide-in-from-top-2">
                                               {q.concept && (
                                                   <div className="p-4 bg-purple-50 border border-purple-100 rounded-xl">
                                                        <div className="flex items-center gap-2 text-purple-700 font-bold text-xs mb-2">
                                                            <BrainCircuit size={14} /> Core Concept
                                                        </div>
                                                        <div className="text-slate-700 text-sm leading-relaxed prose prose-sm max-w-none w-full" dangerouslySetInnerHTML={{ __html: renderMathInHtml(q.concept) }} />
                                                   </div>
                                               )}
                                               {q.explanation && (
                                                   <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
                                                       <div className="flex items-center justify-between mb-1">
                                                           <div className="flex items-center gap-2 text-blue-700 font-bold text-xs">
                                                               <BookOpen size={14} /> Explanation
                                                           </div>
                                                           <SpeakButton text={q.explanation} className="p-1 text-blue-400 hover:bg-blue-100" iconSize={14} />
                                                       </div>
                                                       <div className="text-slate-600 text-sm leading-relaxed prose prose-sm max-w-none w-full" dangerouslySetInnerHTML={{ __html: renderMathInHtml(q.explanation) }} />
                                                   </div>
                                               )}
                                               {q.commonMistake && (
                                                   <div className="p-4 bg-red-50 border border-red-100 rounded-xl">
                                                        <div className="flex items-center gap-2 text-red-700 font-bold text-xs mb-2">
                                                            <AlertTriangle size={14} /> Common Mistake
                                                        </div>
                                                        <div className="text-red-900 text-sm leading-relaxed prose prose-sm max-w-none w-full" dangerouslySetInnerHTML={{ __html: renderMathInHtml(q.commonMistake) }} />
                                                   </div>
                                               )}
                                               {q.examTip && (
                                                   <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                                                        <div className="flex items-center gap-2 text-amber-700 font-bold text-xs mb-2">
                                                            <Lightbulb size={14} /> Exam Tip
                                                        </div>
                                                        <div className="text-amber-900 text-sm leading-relaxed prose prose-sm max-w-none w-full" dangerouslySetInnerHTML={{ __html: renderMathInHtml(q.examTip) }} />
                                                   </div>
                                               )}
                                               {q.mnemonic && (
                                                   <div className="p-4 bg-teal-50 border border-teal-100 rounded-xl">
                                                        <div className="flex items-center gap-2 text-teal-700 font-bold text-xs mb-2">
                                                            <Zap size={14} /> Memory Trick
                                                        </div>
                                                        <div className="text-teal-900 text-sm leading-relaxed font-bold" dangerouslySetInnerHTML={{ __html: renderMathInHtml(q.mnemonic) }} />
                                                   </div>
                                               )}
                                           </div>
                                       )}
                                   </div>
                               );
                           });
                       }
                   })()}

                   {/* 4. RECOMMENDED NOTES (Bottom) */}
                   {showResults && (content.type === 'MCQ_ANALYSIS' || content.type === 'MCQ_RESULT') && renderRecommendedNotes()}
               </div>

                {/* HIDDEN PRINT CONTAINER */}
                <div id="printable-analysis-report" style={{ position: 'absolute', left: '-10000px', width: '800px', backgroundColor: 'white', padding: '40px' }}>
                    <div className="text-center mb-8 border-b-2 border-slate-900 pb-6">
                        <h1 className="text-3xl font-black text-slate-900 uppercase">{settings?.appName || 'Analysis Report'}</h1>
                        <p className="text-lg font-bold text-slate-600">{chapter.title}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-8 text-center">
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                            <p className="text-xs font-bold text-slate-500 uppercase">Score</p>
                            <p className="text-4xl font-black text-slate-900">{Object.keys(mcqState).reduce((acc, k) => acc + (mcqState[parseInt(k)] === (displayData[parseInt(k)]?.correctAnswer) ? 1 : 0), 0)} / {displayData.length}</p>
                        </div>
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                            <p className="text-xs font-bold text-slate-500 uppercase">Accuracy</p>
                            <p className="text-4xl font-black text-blue-600">
                                {displayData.length > 0 ? Math.round((Object.keys(mcqState).reduce((acc, k) => acc + (mcqState[parseInt(k)] === (displayData[parseInt(k)]?.correctAnswer) ? 1 : 0), 0) / displayData.length) * 100) : 0}%
                            </p>
                        </div>
                    </div>

                    <div className="space-y-6">
                        {displayData.map((q, idx) => {
                            const userAnswer = mcqState[idx];
                            const isCorrect = userAnswer === q.correctAnswer;
                            const isAnswered = userAnswer !== undefined && userAnswer !== null;

                            return (
                                <div key={idx} className="border border-slate-200 rounded-xl p-4">
                                    <div className="flex gap-3 mb-2">
                                        <span className={`w-6 h-6 flex-shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${isCorrect ? 'bg-green-100 text-green-700' : isAnswered ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                                            {idx + 1}
                                        </span>
                                        <div className="font-bold text-slate-800 text-sm w-full">
                                            <div dangerouslySetInnerHTML={{ __html: renderMathInHtml(q.question) }}></div>
                                            {q.statements && q.statements.length > 0 && (
                                                <div className="mt-2 flex flex-col space-y-2">
                                                    {q.statements.map((stmt, sIdx) => (
                                                        <div key={sIdx} className="bg-slate-50/80 p-2 rounded-lg border-l-4 border-indigo-200 text-slate-700 text-xs font-medium" dangerouslySetInnerHTML={{ __html: renderMathInHtml(stmt) }} />
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="ml-9 space-y-1 mb-2">
                                        {q.options.map((opt, oIdx) => {
                                            const isSelected = userAnswer === oIdx;
                                            const isAns = q.correctAnswer === oIdx;
                                            let cls = "text-slate-700";
                                            if (isAns) cls = "text-green-700 font-bold";
                                            else if (isSelected) cls = "text-red-700 font-bold line-through";
                                            return (
                                                <div key={oIdx} className={`text-xs ${cls}`}>
                                                    {String.fromCharCode(65 + oIdx)}. <span dangerouslySetInnerHTML={{ __html: renderMathInHtml(opt) }}></span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="ml-9 p-2 bg-slate-50 text-[10px] text-slate-600 italic rounded">
                                        <span className="font-bold">Explanation:</span> <span dangerouslySetInnerHTML={{ __html: renderMathInHtml(q.explanation || 'N/A') }}></span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

               {floatingBtn}
               <DownloadOptionsModal
                   isOpen={downloadModalOpen}
                   onClose={() => setDownloadModalOpen(false)}
                   title="Download Analysis Report"
                   onDownloadPdf={() => handleConfirmDownload('PDF')}
                   onDownloadMhtml={() => handleConfirmDownload('MHTML')}
               />

               <div className={`fixed bottom-0 left-0 right-0 w-full mx-auto p-4 pb-safe sm:pb-4 bg-white border-t border-slate-200 flex gap-3 z-[9999] shadow-[0_-4px_10px_rgba(0,0,0,0.05)]${isImmersive ? ' hidden' : ''}`}>
                   {batchIndex > 0 && (
                       <button onClick={handlePrevPage} className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl flex items-center justify-center gap-2">
                           <ChevronLeft size={20} /> Back
                       </button>
                   )}

                   {/* Logic for Single Question Navigation */}
                   {!showResults && (
                       <>
                           {hasMore ? (
                                <button
                                   onClick={handleNextPage}
                                   disabled={!canGoNext}
                                   className={`flex-[2] py-3 font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg ${canGoNext ? 'bg-blue-600 text-white shadow-blue-100' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                               >
                                   Next <ChevronRight size={20} />
                               </button>
                           ) : (
                               <div className="flex-[2]"></div> // Spacer if no next button on last page
                           )}

                           {/* Submit Button - Always visible if condition met, or on last page */}
                           {(canSubmit || !hasMore) && (
                               <button
                                   onClick={handleSubmitRequest}
                                   disabled={!canSubmit}
                                   className={`flex-[2] py-3 font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg ${canSubmit ? 'bg-green-600 text-white shadow-green-100' : 'bg-slate-200 text-slate-500'}`}
                               >
                                   Submit <Trophy size={20} />
                               </button>
                           )}
                       </>
                   )}

                   {showResults && !hasMore && (
                       <button 
                           onClick={onBack}
                           className="flex-[2] py-3 bg-slate-800 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg"
                       >
                           Finish Review <ArrowLeft size={20} />
                       </button>
                   )}
               </div>
          </div>
      );
  }

  return (
      <div className="h-[70vh] flex flex-col items-center justify-center text-center p-8 bg-slate-50 rounded-2xl m-4 border-2 border-dashed border-slate-200">
          <BookOpen size={64} className="text-slate-300 mb-4" />
          <h2 className="text-2xl font-black text-slate-800 mb-2">No Content</h2>
          <p className="text-slate-600 max-w-xs mx-auto mb-6">
              There is no content available for this lesson.
          </p>
          <button onClick={onBack} className="mt-8 text-slate-500 font-bold hover:text-slate-600">
              Go Back
          </button>
      </div>
  );
};
