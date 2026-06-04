import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, ChevronRight, RotateCw, Volume2, Square, Shuffle } from 'lucide-react';
import type { MCQItem } from '../types';
import type { User, SystemSettings } from '../types';
import { speakText, stopSpeech } from '../utils/textToSpeech';
import { recordFlashcardSession } from '../utils/flashcardHistory';
import { getLevelFromScore, getEffectiveDailyLimit } from '../utils/levelSystem';
import { getUserTier } from '../utils/permissionUtils';
import { applyDeduction } from '../utils/creditSystem';
import { saveUserToLive } from '../firebase';
import { fireCreditNotify } from '../utils/creditNotify';
import { useAppTheme } from '../utils/themeContext';

interface Props {
  questions: MCQItem[];
  title?: string;
  subtitle?: string;
  subject?: string;
  onBack: () => void;
  user?: User;
  settings?: SystemSettings | null;
  onUpdateUser?: (u: User) => void;
}

const CREDIT_COST = 5;

const stripHtml = (s: string) => (s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const sampleN = <T,>(arr: T[], n: number): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
};

const getTodayKey = (userId: string) =>
  `nst_fc_daily_${userId}_${new Date().toDateString()}`;

const getTodayCount = (userId: string): number => {
  try { return parseInt(localStorage.getItem(getTodayKey(userId)) || '0', 10); } catch { return 0; }
};

const addTodayCount = (userId: string, n: number) => {
  try { localStorage.setItem(getTodayKey(userId), String(getTodayCount(userId) + n)); } catch {}
};

export const FlashcardMcqView: React.FC<Props> = ({
  questions, title, subtitle, subject, onBack, user, settings, onUpdateUser
}) => {
  const isMountedRef = useRef(true);
  const [pickedIndices, setPickedIndices] = useState<number[]>([]);
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [limitReached, setLimitReached] = useState(false);

  // Confidence level per card position
  const [confidenceMap, setConfidenceMap] = useState<Record<number, 'easy'|'medium'|'hard'>>({});
  // Hard-card review queue (stores positions from main session)
  const [hardQueue, setHardQueue] = useState<number[]>([]);
  const hardQueueRef = useRef<number[]>([]);
  const [hardReviewMode, setHardReviewMode] = useState(false);
  const [hardReviewPos, setHardReviewPos] = useState(0);

  const sessionStartRef = useRef(Date.now());
  const viewedIdxRef = useRef<Set<number>>(new Set([0]));
  const sessionCommittedRef = useRef(false); // prevents double-counting on exit

  const isAdmin = user?.role === 'ADMIN';
  const userId = user?.id || 'guest';
  const userLevel = user ? getLevelFromScore(user.totalScore ?? 0) : 1;
  const userTier = user ? getUserTier(user) : 'FREE';
  const dailyLimit = isAdmin ? 9999 : getEffectiveDailyLimit('flashcard', userLevel, userTier, settings);

  const initSession = useCallback(() => {
    if (questions.length === 0) return;
    const viewedToday = getTodayCount(userId);
    const remaining = isAdmin ? 10 : Math.max(0, dailyLimit - viewedToday);
    if (remaining <= 0) {
      setLimitReached(true);
      setPickedIndices([]);
      return;
    }
    const size = Math.min(dailyLimit, remaining, questions.length);
    const idx = questions.map((_, i) => i);
    setPickedIndices(sampleN(idx, size));
    setPos(0);
    setFlipped(false);
    setLimitReached(false);
    viewedIdxRef.current = new Set([0]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions, userId, dailyLimit, isAdmin]);

  useEffect(() => { return () => { isMountedRef.current = false; }; }, []);

  useEffect(() => {
    initSession();
    sessionStartRef.current = Date.now();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) { stopSpeech(); setSpeaking(false); }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      stopSpeech();
    };
  }, []);

  useEffect(() => {
    return () => {
      const durationSec = Math.round((Date.now() - sessionStartRef.current) / 1000);
      recordFlashcardSession({
        subject: subject || '—',
        lessonTitle: title || 'Flashcards',
        total: pickedIndices.length,
        viewed: viewedIdxRef.current.size,
        durationSec,
      });
      // Track viewed count on back/exit if session wasn't already committed
      if (!sessionCommittedRef.current && viewedIdxRef.current.size > 0) {
        addTodayCount(userId, viewedIdxRef.current.size);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const total = pickedIndices.length;
  const currentQ = total > 0 ? (questions[pickedIndices[pos]] ?? null) : null;
  // In hard-review mode, use the hard queue to pick the active question
  const activeQ = hardReviewMode
    ? (questions[pickedIndices[hardQueue[hardReviewPos]]] ?? null)
    : currentQ;
  const activePos   = hardReviewMode ? hardReviewPos : pos;
  const activeTotal = hardReviewMode ? hardQueue.length : total;

  const speakQuestion = () => {
    if (!currentQ) return;
    const text = `Question ${pos + 1}: ${stripHtml(currentQ.question)}`;
    if (speaking) { stopSpeech(); setSpeaking(false); return; }
    stopSpeech();
    setSpeaking(true);
    speakText(text, null, 1.0, 'hi-IN', () => setSpeaking(true), () => setSpeaking(false))
      .catch(() => setSpeaking(false));
  };

  const goNext = () => {
    stopSpeech();
    setSpeaking(false);
    if (pos >= total - 1) {
      sessionCommittedRef.current = true;
      setFlipped(false);
      const hq = [...hardQueueRef.current];
      setTimeout(() => {
        if (!isMountedRef.current) return;
        if (hq.length > 0) {
          // Start hard-card review instead of reshuffling
          setHardReviewMode(true);
          setHardReviewPos(0);
          setFlipped(false);
          sessionCommittedRef.current = false;
        } else {
          addTodayCount(userId, viewedIdxRef.current.size);
          sessionCommittedRef.current = false;
          setConfidenceMap({});
          setHardQueue([]); hardQueueRef.current = [];
          initSession();
        }
      }, flipped ? 520 : 0);
      return;
    }
    const nextPos = pos + 1;
    if (flipped) {
      setFlipped(false);
      setTimeout(() => {
        if (!isMountedRef.current) return;
        setPos(nextPos);
        viewedIdxRef.current.add(nextPos);
      }, 520);
    } else {
      setPos(nextPos);
      viewedIdxRef.current.add(nextPos);
    }
  };

  const goNextHard = () => {
    stopSpeech();
    setSpeaking(false);
    if (hardReviewPos >= hardQueue.length - 1) {
      // Hard review done — clear and fresh session
      setFlipped(false);
      setTimeout(() => {
        if (!isMountedRef.current) return;
        addTodayCount(userId, hardQueue.length);
        setHardReviewMode(false);
        setHardQueue([]); hardQueueRef.current = [];
        setHardReviewPos(0);
        setConfidenceMap({});
        initSession();
      }, flipped ? 520 : 0);
      return;
    }
    const nextHardPos = hardReviewPos + 1;
    if (flipped) {
      setFlipped(false);
      setTimeout(() => { if (isMountedRef.current) setHardReviewPos(nextHardPos); }, 520);
    } else {
      setHardReviewPos(nextHardPos);
    }
  };

  const goPrevHard = () => {
    stopSpeech();
    setSpeaking(false);
    if (flipped) {
      setFlipped(false);
      setTimeout(() => { if (isMountedRef.current) setHardReviewPos(p => Math.max(0, p - 1)); }, 520);
    } else {
      setHardReviewPos(p => Math.max(0, p - 1));
    }
  };

  const handleConfidence = (level: 'easy'|'medium'|'hard') => {
    if (hardReviewMode) return; // no confidence rating in hard review
    if (confidenceMap[pos] !== undefined) return; // already rated
    setConfidenceMap(prev => ({ ...prev, [pos]: level }));
    if (level === 'hard') {
      const newQ = [...hardQueueRef.current, pos];
      hardQueueRef.current = newQ;
      setHardQueue(newQ);
    }
    // Auto-advance after brief visual feedback
    setTimeout(() => { if (isMountedRef.current) goNext(); }, 480);
  };

  const goPrev = () => {
    stopSpeech();
    setSpeaking(false);
    if (flipped) {
      setFlipped(false);
      setTimeout(() => {
        if (!isMountedRef.current) return;
        setPos(p => Math.max(0, p - 1));
      }, 520);
    } else {
      setPos(p => Math.max(0, p - 1));
    }
  };

  const reshuffle = () => {
    stopSpeech();
    setSpeaking(false);
    addTodayCount(userId, viewedIdxRef.current.size);
    sessionCommittedRef.current = false;
    setConfidenceMap({});
    setHardQueue([]); hardQueueRef.current = [];
    setHardReviewMode(false);
    setHardReviewPos(0);
    sessionStartRef.current = Date.now();
    initSession();
  };

  const payAndContinue = () => {
    if (!user || !onUpdateUser) return;
    const updatedUser = applyDeduction(user, CREDIT_COST) ?? user;
    localStorage.setItem('nst_current_user', JSON.stringify(updatedUser));
    saveUserToLive(updatedUser);
    onUpdateUser(updatedUser);
    fireCreditNotify({ type: 'DEDUCTION', message: `Flashcard extra session: ${CREDIT_COST} CR` });
    try { localStorage.removeItem(getTodayKey(userId)); } catch {}
    sessionStartRef.current = Date.now();
    initSession();
  };

  const appTheme = useAppTheme();
  const fcBg1 = (appTheme as any).flashcardBg1 || appTheme.primary;
  const fcBg2 = (appTheme as any).flashcardBg2 || appTheme.mid;
  const tierBgStyle = { background: `linear-gradient(135deg, ${fcBg1} 0%, ${fcBg2} 50%, ${fcBg1} 100%)` };

  if (limitReached) {
    const canPay = !!(user?.subscriptionLevel && (user.credits ?? 0) >= CREDIT_COST);
    return (
      <div className="fixed inset-0 z-[200] flex flex-col h-[100dvh]" style={tierBgStyle}>
        <div className="px-4 py-3 flex items-center gap-3">
          <button onClick={onBack} className="bg-white/10 text-white p-2 rounded-full active:scale-95">
            <ArrowLeft size={18} />
          </button>
          <h2 className="text-base font-black text-white">Flashcards</h2>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
          <div className="text-5xl mb-4">⚡</div>
          <p className="text-white font-black text-xl mb-2">Daily Limit Khatam!</p>
          <p className="text-white/70 text-sm mb-2">
            Aaj ke <span className="font-black text-white">{dailyLimit}</span> free flashcard ho gaye.
          </p>
          <p className="text-white/50 text-xs mb-8">Kal reset hoga ya credits se continue karo.</p>
          {canPay ? (
            <button
              onClick={payAndContinue}
              className="bg-white font-black px-8 py-3.5 rounded-2xl text-sm shadow-xl active:scale-95 transition mb-3"
              style={{ color: fcBg2 }}
            >
              🪙 {CREDIT_COST} Credits se Continue Karo
            </button>
          ) : user?.subscriptionLevel ? (
            <p className="text-amber-300 text-sm font-bold">Balance kam hai ({user?.credits ?? 0} CR). Credits earn karo!</p>
          ) : (
            <p className="text-amber-300 text-sm font-bold">Plan upgrade karo ya kal vapas aao!</p>
          )}
          <p className="text-white/30 text-xs mt-4">Balance: {user?.credits ?? 0} CR</p>
        </div>
      </div>
    );
  }

  if (!currentQ) {
    return (
      <div className="fixed inset-0 z-[200] flex flex-col h-[100dvh]" style={tierBgStyle}>
        <div className="px-4 py-3 flex items-center gap-3">
          <button onClick={onBack} className="bg-white/10 text-white p-2 rounded-full"><ArrowLeft size={18}/></button>
          <h2 className="text-base font-black text-white">Flashcards</h2>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
          <p className="text-white font-black">Koi MCQ available nahi hai</p>
          <p className="text-white/50 text-xs mt-2">Pehle is chapter ka content load karein.</p>
        </div>
      </div>
    );
  }

  const isLast = pos >= total - 1;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col h-[100dvh]" style={tierBgStyle}>
      {/* Top Bar */}
      <div className="sticky top-0 z-10 px-4 py-3 flex items-center gap-3">
        <button
          onClick={onBack}
          className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-full active:scale-95 transition"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0 flex-1">
          {hardReviewMode ? (
            <>
              <p className="text-[10px] font-black text-red-300 uppercase tracking-widest truncate flex items-center gap-1">
                <span>🔴</span> Hard Cards Review
              </p>
              <h2 className="text-sm font-black text-white truncate">{hardQueue.length} Hard Card{hardQueue.length !== 1 ? 's' : ''} dobara dekho</h2>
            </>
          ) : (
            <>
              <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest truncate">
                Flashcards · {total} cards
                {hardQueueRef.current.length > 0 && (
                  <span className="ml-1 text-red-300">· {hardQueueRef.current.length} Hard</span>
                )}
              </p>
              <h2 className="text-sm font-black text-white truncate">{title || 'Flashcards'}</h2>
              {subtitle && <p className="text-[10px] text-white/50 truncate">{subtitle}</p>}
            </>
          )}
        </div>
        <div className="bg-white/10 px-2.5 py-1 rounded-full shrink-0">
          <span className="text-[10px] font-black text-white/70">
            {getTodayCount(userId)}/{isAdmin ? '∞' : dailyLimit}
          </span>
        </div>
        {!hardReviewMode && (
          <button
            onClick={reshuffle}
            className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-full active:scale-95 transition shrink-0"
            title="Naye cards"
          >
            <Shuffle size={15} />
          </button>
        )}
      </div>

      {/* Progress */}
      <div className="px-4 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-black text-white/70">
            <span className="text-white">{activePos + 1}</span> / {activeTotal}
          </span>
          <div className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 rounded-full ${hardReviewMode ? 'bg-red-400' : 'bg-white/70'}`}
              style={{ width: `${((activePos + 1) / activeTotal) * 100}%` }}
            />
          </div>
          {!hardReviewMode && confidenceMap[pos] && (
            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${
              confidenceMap[pos] === 'easy' ? 'bg-emerald-500/30 text-emerald-200' :
              confidenceMap[pos] === 'medium' ? 'bg-amber-500/30 text-amber-200' :
              'bg-red-500/30 text-red-200'
            }`}>
              {confidenceMap[pos] === 'easy' ? '✓ Easy' : confidenceMap[pos] === 'medium' ? '~ Med' : '✗ Hard'}
            </span>
          )}
        </div>
      </div>

      {/* Flip Card */}
      <div className="flex-1 px-4 flex flex-col justify-center gap-4 overflow-y-auto py-2">
        <div className="w-full max-w-md mx-auto" style={{ perspective: '1200px' }}>
          <div
            className="relative w-full transition-transform duration-500"
            style={{
              transformStyle: 'preserve-3d',
              transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
              minHeight: '280px',
            }}
          >
            {/* ── FRONT: Question ── */}
            <div
              className="absolute inset-0 bg-white rounded-3xl shadow-2xl p-5 flex flex-col"
              style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider ${hardReviewMode ? 'bg-red-100 text-red-700' : 'bg-indigo-100 text-indigo-700'}`}>
                  {hardReviewMode ? '🔴 Hard' : `Q ${activePos + 1}`}
                </span>
                <button
                  type="button"
                  onClick={speakQuestion}
                  className={`p-2 rounded-full transition shrink-0 ${
                    speaking
                      ? 'bg-red-100 text-red-600 animate-pulse'
                      : 'bg-slate-100 text-slate-600 hover:bg-indigo-100 hover:text-indigo-700'
                  }`}
                  title="Question suno"
                >
                  {speaking ? <Square size={13} /> : <Volume2 size={13} />}
                </button>
              </div>

              <p className="text-base font-black text-slate-800 leading-snug flex-1 mb-3">
                {activeQ!.question}
              </p>

              {activeQ!.statements && activeQ!.statements.length > 0 && (
                <div className="mb-3 space-y-1 pl-3 border-l-2 border-slate-200">
                  {activeQ!.statements.map((s, i) => (
                    <p key={i} className="text-sm text-slate-600">{s}</p>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => setFlipped(true)}
                className="mt-auto w-full py-3 rounded-2xl text-white font-black text-sm flex items-center justify-center gap-2 active:scale-95 transition shadow-md"
                style={{ background: appTheme.btnGrad }}
              >
                Answer Dekho <ChevronRight size={16} />
              </button>
            </div>

            {/* ── BACK: Answer ── */}
            <div
              className="absolute inset-0 bg-emerald-50 border-2 border-emerald-200 rounded-3xl shadow-2xl p-5 flex flex-col overflow-y-auto"
              style={{
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="bg-emerald-100 text-emerald-700 text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider">
                  Sahi Jawab
                </span>
                <button
                  type="button"
                  onClick={() => { setFlipped(false); stopSpeech(); setSpeaking(false); }}
                  className="bg-white border border-slate-200 text-slate-600 text-[10px] font-black px-2.5 py-1.5 rounded-lg active:scale-95"
                >
                  ← Question
                </button>
              </div>

              <div className="bg-white border-2 border-emerald-300 rounded-2xl p-4 mb-3">
                <p className="text-base font-black text-emerald-900 leading-snug">
                  {activeQ!.options?.[activeQ!.correctAnswer] || '—'}
                </p>
              </div>

              {activeQ!.explanation && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-2">
                  <p className="text-[10px] font-black uppercase tracking-wider text-blue-700 mb-1">Explanation</p>
                  <p className="text-sm text-blue-900 leading-relaxed">{activeQ!.explanation}</p>
                </div>
              )}
              {activeQ!.concept && (
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 mb-2">
                  <p className="text-[10px] font-black uppercase tracking-wider text-purple-700 mb-1">Concept</p>
                  <p className="text-sm text-purple-900 leading-relaxed">{activeQ!.concept}</p>
                </div>
              )}
              {activeQ!.examTip && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-2">
                  <p className="text-[10px] font-black uppercase tracking-wider text-amber-700 mb-1">Exam Tip</p>
                  <p className="text-sm text-amber-900 leading-relaxed">{activeQ!.examTip}</p>
                </div>
              )}
              {activeQ!.mnemonic && (
                <div className="bg-pink-50 border border-pink-200 rounded-xl p-3 mb-2">
                  <p className="text-[10px] font-black uppercase tracking-wider text-pink-700 mb-1">Memory Trick</p>
                  <p className="text-sm text-pink-900 leading-relaxed">{activeQ!.mnemonic}</p>
                </div>
              )}

              {/* ── Confidence Level Buttons (main session only) ── */}
              {!hardReviewMode && (
                <div className="mt-3 pt-3 border-t border-emerald-200">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2 text-center">
                    Yeh card kitna mushkil laga?
                  </p>
                  {confidenceMap[pos] ? (
                    <div className={`text-center py-2 rounded-xl font-black text-sm ${
                      confidenceMap[pos] === 'easy' ? 'bg-emerald-100 text-emerald-700' :
                      confidenceMap[pos] === 'medium' ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {confidenceMap[pos] === 'easy' ? '✅ Easy — Aage badh rahe hain!' :
                       confidenceMap[pos] === 'medium' ? '🟡 Medium — Thoda aur practice karo' :
                       '🔴 Hard — Baad mein dobara aayega!'}
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => handleConfidence('easy')}
                        className="py-2.5 rounded-xl bg-emerald-500 text-white font-black text-xs active:scale-95 transition shadow-md flex flex-col items-center gap-0.5"
                      >
                        <span className="text-base">✅</span>
                        <span>Easy</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleConfidence('medium')}
                        className="py-2.5 rounded-xl bg-amber-500 text-white font-black text-xs active:scale-95 transition shadow-md flex flex-col items-center gap-0.5"
                      >
                        <span className="text-base">🟡</span>
                        <span>Medium</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleConfidence('hard')}
                        className="py-2.5 rounded-xl bg-red-500 text-white font-black text-xs active:scale-95 transition shadow-md flex flex-col items-center gap-0.5"
                      >
                        <span className="text-base">🔴</span>
                        <span>Hard</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-3 w-full max-w-md mx-auto">
          <button
            disabled={hardReviewMode ? hardReviewPos === 0 : pos === 0}
            onClick={hardReviewMode ? goPrevHard : goPrev}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 rounded-2xl font-bold text-sm transition-all ${
              (hardReviewMode ? hardReviewPos === 0 : pos === 0)
                ? 'bg-white/10 text-white/30 cursor-not-allowed'
                : 'bg-white/15 text-white hover:bg-white/25 active:scale-95'
            }`}
          >
            <ChevronRight size={16} className="rotate-180" /> Back
          </button>
          <button
            onClick={hardReviewMode ? goNextHard : goNext}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 rounded-2xl font-black text-sm active:scale-95 transition shadow-lg ${
              hardReviewMode
                ? 'bg-red-400 text-white hover:bg-red-300'
                : 'bg-white text-indigo-900 hover:bg-white/90'
            }`}
          >
            {hardReviewMode
              ? hardReviewPos >= hardQueue.length - 1
                ? (<><RotateCw size={14} /> Naye Cards</>)
                : (<>Next <ChevronRight size={16} /></>)
              : isLast
                ? (<><RotateCw size={14} /> Naye Cards</>)
                : (<>Next <ChevronRight size={16} /></>)
            }
          </button>
        </div>
      </div>
    </div>
  );
};
