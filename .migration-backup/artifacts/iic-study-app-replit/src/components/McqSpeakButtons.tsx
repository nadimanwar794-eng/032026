import React, { useEffect, useRef, useState } from 'react';
import { Volume2, Square, ListChecks } from 'lucide-react';
import { speakText, stopSpeech } from '../utils/textToSpeech';

const TTS_SPEED_KEY = 'nst_tts_speed';
export const getStoredTtsSpeed = (): number => {
  try {
    const v = parseFloat(localStorage.getItem(TTS_SPEED_KEY) || '1');
    return isNaN(v) ? 1.0 : v;
  } catch { return 1.0; }
};
export const setStoredTtsSpeed = (rate: number) => {
  try { localStorage.setItem(TTS_SPEED_KEY, String(rate)); } catch {}
};

interface AllQ {
  question: string;
  options: string[];
  correctAnswer: number;
}

interface Props {
  question: string;
  options: string[];
  correctAnswer: number;
  className?: string;
  iconSize?: number;
  language?: string;
  /** Optional unique id used to coordinate between multiple instances on the page. */
  scopeId?: string;
  /**
   * If provided, both buttons chain-read every question from `index` onwards:
   *   - "Q+Ans" : question + correct answer (no options)
   *   - "All"   : question + every option + correct answer
   * Falls back to single-question reading when omitted.
   */
  allQuestions?: AllQ[];
  index?: number;
  /**
   * When false, both buttons skip the answer in their TTS output —
   * they read ONLY the question (and options for the "All" button).
   * Used by Class 6-12 MCQ Interactive List in MCQ mode: while the
   * student hasn't answered every question yet, the speaker should not
   * spoil the correct answer. Once allAnswered → set to true and the
   * answer also gets played. In Q&A mode this stays true throughout.
   * Default: true (preserves existing behaviour for all current callers).
   */
  revealAnswer?: boolean;
  /** Compact single-icon variant — used by Lucent-style MCQ cards. */
  compact?: boolean;
  /**
   * When provided, the component renders a SINGLE small speaker icon (no
   * Q+Ans / All pills) and speaks using this mode for the current question
   * only — i.e. no chain through `allQuestions`. The parent decides the mode
   * via a top-of-page toggle. Used by the Homework MCQ Practice list so each
   * question card stays uncluttered.
   */
  mode?: 'qa' | 'all';
  /** TTS playback rate. Defaults to value stored in localStorage. */
  rate?: number;
}

const stripHtml = (s: string) => (s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

export const McqSpeakButtons: React.FC<Props> = ({
  question,
  options,
  correctAnswer,
  className,
  iconSize = 14,
  language = 'hi-IN',
  allQuestions,
  index = 0,
  revealAnswer = true,
  compact = false,
  mode: externalMode,
  rate,
}) => {
  const [active, setActive] = useState<null | 'qa' | 'all'>(null);
  const cancelRef = useRef(false);

  const getRate = () => rate ?? getStoredTtsSpeed();

  const cleanQ = stripHtml(question);
  const cleanOpts = options.map(o => stripHtml(o));
  const correctText = cleanOpts[correctAnswer] ?? '';

  const qaText = revealAnswer
    ? `Question: ${cleanQ}. Sahi jawab: ${correctText}.`
    : `Question: ${cleanQ}.`;
  const allText = revealAnswer
    ? `Question: ${cleanQ}. Options ye hain: ${cleanOpts
        .map((o, i) => `Option ${String.fromCharCode(65 + i)}: ${o}`)
        .join('. ')}. Sahi jawab: Option ${String.fromCharCode(65 + correctAnswer)}, ${correctText}.`
    : `Question: ${cleanQ}. Options ye hain: ${cleanOpts
        .map((o, i) => `Option ${String.fromCharCode(65 + i)}: ${o}`)
        .join('. ')}.`;

  const stopAll = () => {
    cancelRef.current = true;
    stopSpeech();
    setActive(null);
  };

  const speakOnce = (text: string) =>
    new Promise<void>((resolve) => {
      speakText(text, null, getRate(), language, () => {}, () => resolve())
        .catch(() => resolve());
    });

  const playChain = async (mode: 'qa' | 'all') => {
    if (!allQuestions || allQuestions.length === 0) return;
    const start = Math.max(0, Math.min(index, allQuestions.length - 1));
    cancelRef.current = false;
    setActive(mode);
    for (let i = start; i < allQuestions.length; i++) {
      if (cancelRef.current) break;
      const q = allQuestions[i];
      const cq = stripHtml(q.question);
      const cOpts = (q.options || []).map((o) => stripHtml(o));
      const cAns = cOpts[q.correctAnswer] ?? '';
      const text =
        mode === 'qa'
          ? (revealAnswer
              ? `Question ${i + 1}: ${cq}. Sahi jawab: ${cAns}.`
              : `Question ${i + 1}: ${cq}.`)
          : (revealAnswer
              ? `Question ${i + 1}: ${cq}. Options ye hain: ${cOpts
                  .map((o, oi) => `Option ${String.fromCharCode(65 + oi)}: ${o}`)
                  .join('. ')}. Sahi jawab: Option ${String.fromCharCode(65 + q.correctAnswer)}, ${cAns}.`
              : `Question ${i + 1}: ${cq}. Options ye hain: ${cOpts
                  .map((o, oi) => `Option ${String.fromCharCode(65 + oi)}: ${o}`)
                  .join('. ')}.`);
      try {
        await speakOnce(text);
      } catch {
        break;
      }
      if (cancelRef.current) break;
    }
    setActive((cur) => (cur === mode ? null : cur));
  };

  const play = (mode: 'qa' | 'all') => {
    if (active === mode) {
      stopAll();
      return;
    }
    cancelRef.current = false;
    stopSpeech();
    if (allQuestions && allQuestions.length > 0) {
      playChain(mode);
      return;
    }
    setActive(mode);
    const text = mode === 'qa' ? qaText : allText;
    speakText(
      text,
      null,
      getRate(),
      language,
      () => setActive(mode),
      () => setActive(null)
    ).catch(() => setActive(null));
  };

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && active) stopAll();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [active]);

  useEffect(() => {
    return () => {
      cancelRef.current = true;
      if (active) stopSpeech();
    };
  }, []);

  const baseBtn =
    'inline-flex items-center gap-1 px-2 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wide transition-colors active:scale-95';

  const isChainCapable = !!(allQuestions && allQuestions.length > 1);

  if (externalMode) {
    const isPlaying = active === externalMode;
    const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isPlaying) { stopAll(); return; }
      cancelRef.current = false;
      stopSpeech();
      setActive(externalMode);
      const text = externalMode === 'qa' ? qaText : allText;
      speakText(text, null, getRate(), language, () => setActive(externalMode), () => setActive(null))
        .catch(() => setActive(null));
    };
    const tip = externalMode === 'qa'
      ? (revealAnswer ? 'Question + sahi jawab sune' : 'Question sune')
      : (revealAnswer ? 'Question + saare options + sahi jawab sune' : 'Question + saare options sune');
    return (
      <button
        type="button"
        onClick={handleClick}
        title={tip}
        aria-label={tip}
        className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors active:scale-95 ${
          isPlaying
            ? 'bg-red-100 text-red-600 animate-pulse'
            : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
        } ${className || ''}`}
      >
        {isPlaying ? <Square size={iconSize} fill="currentColor" /> : <Volume2 size={iconSize} />}
      </button>
    );
  }

  if (compact) {
    const tip = revealAnswer
      ? (isChainCapable ? 'Saare questions + sahi jawab sune' : 'Question + sahi jawab sune')
      : (isChainCapable ? 'Saare questions sune (bina jawab ke)' : 'Question sune (bina jawab ke)');
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); play('qa'); }}
        title={tip}
        aria-label={tip}
        className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-colors active:scale-95 ${
          active === 'qa'
            ? 'bg-red-100 text-red-600 animate-pulse'
            : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
        } ${className || ''}`}
      >
        {active === 'qa' ? <Square size={iconSize + 2} fill="currentColor" /> : <Volume2 size={iconSize + 2} />}
      </button>
    );
  }

  return (
    <div className={`flex items-center gap-1.5 shrink-0 ${className || ''}`}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); play('qa'); }}
        title={isChainCapable ? 'Saare questions + sahi jawab sune (bina options ke)' : 'Question + sahi jawab sune'}
        aria-label="Read question and answer"
        className={`${baseBtn} ${
          active === 'qa'
            ? 'bg-red-100 text-red-600 animate-pulse'
            : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
        }`}
      >
        {active === 'qa' ? <Square size={iconSize} fill="currentColor" /> : <Volume2 size={iconSize} />}
        {isChainCapable ? 'Read All' : 'Q+Ans'}
      </button>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); play('all'); }}
        title={isChainCapable ? 'Saare questions + options + sahi jawab sune' : 'Question + saare options + sahi jawab sune'}
        aria-label="Read question, options and answer"
        className={`${baseBtn} ${
          active === 'all'
            ? 'bg-red-100 text-red-600 animate-pulse'
            : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
        }`}
      >
        {active === 'all' ? <Square size={iconSize} fill="currentColor" /> : <ListChecks size={iconSize} />}
        All
      </button>
    </div>
  );
};
