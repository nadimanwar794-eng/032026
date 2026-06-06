import React, { useState, useMemo, useEffect, useRef } from 'react';
import { X as XIcon, Check, AlertCircle, RefreshCw, Trophy, ChevronRight, ChevronLeft, Flame, Crown, Zap, Star } from 'lucide-react';
import { MistakeEntry, removeMistakes } from '../utils/mistakeBank';
import { saveMistakeSession } from '../utils/mistakeAnalytics';

interface Props {
  mistakes: MistakeEntry[];
  onClose: () => void;
  onComplete?: (removedIds: string[]) => void;
}

const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const getDifficultyBadge = (attempts: number) => {
  if (attempts >= 7) return { label: 'Revision King', icon: '👑', bg: 'bg-gradient-to-r from-amber-400 to-yellow-500', text: 'text-white' };
  if (attempts >= 4) return { label: 'Hard', icon: '🔴', bg: 'bg-gradient-to-r from-red-500 to-rose-600', text: 'text-white' };
  if (attempts >= 2) return { label: 'Medium', icon: '🟡', bg: 'bg-gradient-to-r from-amber-400 to-orange-500', text: 'text-white' };
  return { label: 'Easy', icon: '🟢', bg: 'bg-gradient-to-r from-emerald-400 to-green-500', text: 'text-white' };
};

export const MistakePracticeView: React.FC<Props> = ({ mistakes, onClose, onComplete }) => {
  const session = useMemo(() => shuffle(mistakes), [mistakes]);
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [correctIds, setCorrectIds] = useState<string[]>([]);
  const [wrongCount, setWrongCount] = useState(0);
  const [finished, setFinished] = useState(false);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [streakFlash, setStreakFlash] = useState(false);
  const [revealAnim, setRevealAnim] = useState(false);
  const explanationRef = useRef<HTMLDivElement>(null);
  const sessionStartRef = useRef(Date.now());

  const total = session.length;
  const current = session[idx];
  const completed = idx + (revealed ? 1 : 0);

  useEffect(() => {
    if (revealed) {
      requestAnimationFrame(() => setRevealAnim(true));
    } else {
      setRevealAnim(false);
    }
  }, [revealed]);

  const resetQuestion = () => {
    setSelected(null);
    setRevealed(false);
    setRevealAnim(false);
  };

  const goTo = (newIdx: number) => {
    setIdx(newIdx);
    resetQuestion();
  };

  const handleSelect = (optIdx: number) => {
    if (revealed || !current) return;
    setSelected(optIdx);
    setRevealed(true);
    if (optIdx === current.correctAnswer) {
      setCorrectIds(prev => prev.includes(current.id) ? prev : [...prev, current.id]);
      const newStreak = streak + 1;
      setStreak(newStreak);
      setMaxStreak(s => Math.max(s, newStreak));
      if (newStreak >= 3) {
        setStreakFlash(true);
        setTimeout(() => setStreakFlash(false), 800);
      }
    } else {
      setWrongCount(c => c + 1);
      setStreak(0);
    }
  };

  const handleNext = () => {
    if (idx + 1 >= total) {
      const durationSec = Math.round((Date.now() - sessionStartRef.current) / 1000);
      saveMistakeSession({
        total,
        correct: correctIds.length,
        wrong: wrongCount,
        maxStreak,
        durationSec,
      });
      removeMistakes(correctIds).finally(() => {
        setFinished(true);
        onComplete?.(correctIds);
      });
      return;
    }
    goTo(idx + 1);
  };

  const handleBack = () => {
    if (idx > 0) goTo(idx - 1);
  };

  if (total === 0) {
    return (
      <div className="fixed inset-0 z-[80] bg-slate-900/60 backdrop-blur flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <Trophy className="text-emerald-600" size={28} />
          </div>
          <h3 className="text-xl font-black text-slate-800 mb-2">No mistakes to practice!</h3>
          <p className="text-sm text-slate-500 mb-6">Sab clean hai. Naye MCQ try karein.</p>
          <button onClick={onClose} className="w-full py-3 rounded-2xl bg-slate-800 text-white font-black">Close</button>
        </div>
      </div>
    );
  }

  if (finished) {
    const fixed = correctIds.length;
    const remaining = total - fixed;
    return (
      <div className="fixed inset-0 z-[80] bg-slate-900/60 backdrop-blur flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-7 max-w-md w-full shadow-2xl text-center">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center mx-auto mb-4 text-white">
            <Trophy size={30} />
          </div>
          <h3 className="text-xl font-black text-slate-800 mb-1">Practice Complete!</h3>
          <p className="text-sm text-slate-500 mb-5">Galtiyon se seekha kuch toh sahi.</p>
          {maxStreak >= 3 && (
            <div className="mb-4 bg-orange-50 border border-orange-200 rounded-2xl px-4 py-3 flex items-center justify-center gap-2">
              <Flame size={18} className="text-orange-500" />
              <span className="text-sm font-black text-orange-700">Best Streak: {maxStreak} correct in a row! 🔥</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3">
              <div className="text-2xl font-black text-emerald-600">{fixed}</div>
              <div className="text-[10px] font-bold text-emerald-700 uppercase">Fixed ✓</div>
            </div>
            <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3">
              <div className="text-2xl font-black text-amber-600">{remaining}</div>
              <div className="text-[10px] font-bold text-amber-700 uppercase">Still Wrong ✗</div>
            </div>
          </div>
          <button onClick={onClose} className="w-full py-3 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-black shadow-lg">
            Done
          </button>
        </div>
      </div>
    );
  }

  const isCorrect = revealed && selected === current.correctAnswer;
  const progressPct = Math.round((completed / total) * 100);
  const difficulty = getDifficultyBadge(current.attempts || 1);

  return (
    <div className="fixed inset-0 z-[99999] bg-slate-900/70 backdrop-blur-sm flex items-stretch sm:items-center justify-center sm:p-4">
      <div className="bg-gradient-to-b from-slate-50 to-white sm:rounded-3xl w-full sm:max-w-lg flex flex-col shadow-2xl overflow-hidden" style={{ maxHeight: '100dvh' }}>

        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-rose-500 to-orange-500 text-white shrink-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <AlertCircle size={18} />
              <h3 className="text-base font-black tracking-tight">My Mistake Practice</h3>
            </div>
            <div className="flex items-center gap-2">
              {/* Streak badge */}
              {streak >= 3 && (
                <div className={`flex items-center gap-1 bg-white/20 rounded-full px-2.5 py-1 transition-all duration-300 ${streakFlash ? 'scale-125 bg-yellow-400/40' : ''}`}>
                  <Flame size={13} className="text-yellow-300" />
                  <span className="text-xs font-black text-yellow-100">{streak} streak</span>
                </div>
              )}
              <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center active:scale-95 transition-all">
                <XIcon size={16} />
              </button>
            </div>
          </div>

          {/* Session progress: "23 / 80 completed" */}
          <div className="flex items-center justify-between mb-2 text-[11px] font-bold">
            <div className="flex items-center gap-2">
              <span className="bg-white/20 rounded-full px-2.5 py-0.5">
                <span className="text-white font-black">{completed}</span>
                <span className="text-white/70"> / {total} completed</span>
              </span>
              <span className="bg-emerald-400/30 rounded-full px-2 py-0.5">✓ {correctIds.length}</span>
              <span className="bg-rose-400/30 rounded-full px-2 py-0.5">✗ {wrongCount}</span>
            </div>
            {streak >= 1 && streak < 3 && (
              <span className="bg-white/15 rounded-full px-2 py-0.5 text-white/80">🔥 {streak}</span>
            )}
          </div>
          <div className="h-2 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white transition-all duration-500 rounded-full"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4">

          {/* Question card — premium */}
          <div className="rounded-3xl bg-white border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.08)] p-5 mb-4 active:scale-[0.995] transition-transform duration-150">
            {/* Top row: difficulty badge + source chips */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {/* Difficulty badge */}
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black shadow-sm ${difficulty.bg} ${difficulty.text}`}>
                <span>{difficulty.icon}</span>
                <span>{difficulty.label}</span>
              </span>
              {current.subjectName && (
                <span className="text-[10px] font-bold bg-slate-100 text-slate-600 rounded-full px-2 py-0.5">{current.subjectName}</span>
              )}
              {current.chapterTitle && (
                <span className="text-[10px] font-bold bg-slate-100 text-slate-600 rounded-full px-2 py-0.5">{current.chapterTitle}</span>
              )}
              {current.topic && (
                <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 rounded-full px-2 py-0.5">{current.topic}</span>
              )}
            </div>

            {/* Question text */}
            <p className="text-[15px] font-bold text-slate-800 leading-relaxed">{current.question}</p>
          </div>

          {/* Options */}
          <div className="space-y-2.5 mb-4">
            {current.options.map((opt, oi) => {
              const isSelected = selected === oi;
              const isCorrectOpt = oi === current.correctAnswer;
              let base = 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/40 hover:shadow-md';
              if (revealed) {
                if (isCorrectOpt) base = 'border-emerald-400 bg-gradient-to-r from-emerald-50 to-green-50 shadow-md shadow-emerald-100';
                else if (isSelected) base = 'border-rose-400 bg-gradient-to-r from-rose-50 to-red-50 shadow-md shadow-rose-100';
                else base = 'border-slate-200 bg-slate-50 opacity-50';
              } else if (isSelected) {
                base = 'border-indigo-400 bg-indigo-50 shadow-md shadow-indigo-100';
              }
              return (
                <button
                  key={oi}
                  onClick={() => handleSelect(oi)}
                  disabled={revealed}
                  className={`w-full text-left rounded-2xl border-2 p-3.5 flex items-center gap-3 transition-all duration-200 active:scale-[0.98] shadow-sm ${base}`}
                >
                  <span className={`shrink-0 w-8 h-8 rounded-full font-black text-sm flex items-center justify-center transition-all ${
                    revealed && isCorrectOpt ? 'bg-emerald-500 text-white scale-110' :
                    revealed && isSelected   ? 'bg-rose-500 text-white' :
                    isSelected               ? 'bg-indigo-500 text-white' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {revealed && isCorrectOpt ? <Check size={14} /> : String.fromCharCode(65 + oi)}
                  </span>
                  <span className="text-sm text-slate-800 leading-snug flex-1">{opt}</span>
                </button>
              );
            })}
          </div>

          {/* Explanation — smooth expand animation */}
          <div
            ref={explanationRef}
            className="overflow-hidden transition-all duration-500 ease-out"
            style={{
              maxHeight: revealAnim ? '400px' : '0px',
              opacity: revealAnim ? 1 : 0,
              transform: revealAnim ? 'translateY(0)' : 'translateY(-8px)',
            }}
          >
            {revealed && (
              <div className={`rounded-2xl border p-4 ${isCorrect ? 'bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-200' : 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200'}`}>
                <div className={`text-xs font-black mb-1.5 flex items-center gap-1.5 ${isCorrect ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {isCorrect ? (
                    <><Check size={13} className="text-emerald-600" /> Bilkul sahi! {streak >= 3 ? `🔥 ${streak} streak!` : ''}</>
                  ) : (
                    <><span>💡</span> Yaad rakhein:</>
                  )}
                </div>
                {current.explanation && (
                  <p className="text-xs text-slate-700 leading-relaxed">{current.explanation}</p>
                )}
                {!isCorrect && (
                  <div className="mt-2 pt-2 border-t border-amber-200 flex items-center gap-1.5">
                    <span className="text-[10px] font-black text-amber-700">Sahi jawab:</span>
                    <span className="text-[10px] font-bold text-slate-800 bg-white/70 rounded-lg px-2 py-0.5">{current.options[current.correctAnswer]}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pt-4 pb-[max(24px,calc(env(safe-area-inset-bottom,0px)+16px))] border-t border-slate-100 bg-white shrink-0">
          <div className="flex gap-3">
            <button
              onClick={handleBack}
              disabled={idx === 0}
              className={`flex items-center justify-center gap-1.5 px-5 py-4 rounded-2xl font-black text-sm transition-all active:scale-95 shrink-0 ${
                idx === 0
                  ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={handleNext}
              disabled={!revealed}
              className={`flex-1 py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all duration-200 ${
                revealed
                  ? `shadow-lg active:scale-[0.98] ${isCorrect
                      ? 'bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-emerald-200'
                      : 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-indigo-200'
                    }`
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              {!revealed ? (
                <>Jawab chunein <Zap size={16} /></>
              ) : idx + 1 >= total ? (
                <><Trophy size={16} /> Finish</>
              ) : (
                <>Agle sawaal par <ChevronRight size={16} /></>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
