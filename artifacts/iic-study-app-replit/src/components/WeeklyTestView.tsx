// @ts-nocheck

import React, { useState, useEffect, useRef } from 'react';
import { WeeklyTest, MCQItem } from '../types';
import { Clock, AlertTriangle, CheckCircle, Trophy, ArrowLeft, ChevronLeft, ChevronRight, SkipForward } from 'lucide-react';
import { CustomAlert, CustomConfirm } from './CustomDialogs';
import { addMistakes, removeMistakeByQuestion } from '../utils/mistakeBank';
import { renderMathInHtml } from '../utils/mathUtils';
import McqQuestionDisplay from './McqQuestionDisplay';
import McqQuestionNavigator from './McqQuestionNavigator';

interface Props {
  test: WeeklyTest;
  onComplete: (score: number, total: number, answers: Record<number, number>) => void;
  onExit: () => void;
}

export const WeeklyTestView: React.FC<Props> = ({ test, onComplete, onExit }) => {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{isOpen: boolean, message: string}>({isOpen: false, message: ''});
  const [confirmConfig, setConfirmConfig] = useState<{isOpen: boolean, title: string, message: string, onConfirm: () => void}>({
      isOpen: false, title: '', message: '', onConfirm: () => {}
  });
  const [postAlertAction, setPostAlertAction] = useState<() => void>(() => {});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [skipped, setSkipped] = useState<Set<number>>(new Set());
  const [showResumeModal, setShowResumeModal] = useState<{
    savedAnswers: Record<number, number>;
    savedIndex: number;
    savedTimeLeft?: number;
    count: number;
  } | null>(null);

  const safeQuestions = Array.isArray(test.questions) ? test.questions : [];

  // Check saved progress on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`weekly_test_progress_${test.id}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        const count = Object.keys(parsed.answers || {}).length;
        if (count > 0) {
          setShowResumeModal({
            savedAnswers: parsed.answers,
            savedIndex: parsed.currentIndex || 0,
            savedTimeLeft: parsed.timeLeft,
            count,
          });
        }
      }
    } catch (e) {
      console.warn('Error reading test progress', e);
    }
  }, [test.id]);

  const handleResume = () => {
    if (!showResumeModal) return;
    setAnswers(showResumeModal.savedAnswers);
    setCurrentIndex(showResumeModal.savedIndex);
    if (typeof showResumeModal.savedTimeLeft === 'number' && showResumeModal.savedTimeLeft > 0) {
      setTimeLeft(showResumeModal.savedTimeLeft);
    }
    setShowResumeModal(null);
  };

  const handleRestart = () => {
    try {
      localStorage.removeItem(`weekly_test_progress_${test.id}`);
      localStorage.removeItem(`weekly_test_start_${test.id}`);
    } catch {}
    setAnswers({});
    setCurrentIndex(0);
    setSkipped(new Set());
    setShowResumeModal(null);
  };

  const handleBack = () => {
    const answeredCount = Object.keys(answers).length;
    if (answeredCount > 0) {
      try {
        localStorage.setItem(`weekly_test_progress_${test.id}`, JSON.stringify({
          answers,
          currentIndex,
          timeLeft,
          savedAt: Date.now(),
        }));
      } catch (e) {
        console.warn('Failed to save test progress', e);
      }
    }
    onExit();
  };

  // Initialize Timer
  useEffect(() => {
    const isDailyChallenge =
      (test as any).challengeType === 'DAILY_CHALLENGE' ||
      test.id.startsWith('daily-challenge-');
    const DURATION_SECONDS = (
      isDailyChallenge
        ? Math.min(test.durationMinutes || 60, 60)
        : (test.durationMinutes || 120)
    ) * 60;
    const STORAGE_KEY = `weekly_test_start_${test.id}`;
    
    let startTime = localStorage.getItem(STORAGE_KEY);
    
    if (!startTime) {
      startTime = Date.now().toString();
      localStorage.setItem(STORAGE_KEY, startTime);
    }
    
    const elapsedSeconds = Math.floor((Date.now() - parseInt(startTime)) / 1000);
    const remaining = Math.max(0, DURATION_SECONDS - elapsedSeconds);
    
    setTimeLeft(remaining);
    
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmit(true); // Auto submit
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [test.id, test.durationMinutes]);

  const handleSubmit = (auto: boolean = false) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    
    // Calculate Score
    let score = 0;
    safeQuestions.forEach((q, idx) => {
      if (answers[idx] === q.correctAnswer) {
        score++;
      }
    });

    // ── MY MISTAKE BANK ──────────────────────────────────────────────
    try {
      const wrongPayload = safeQuestions
        .map((q, idx) => {
          const selected = answers[idx];
          if (selected !== undefined && selected !== q.correctAnswer) {
            return {
              question: q.question,
              options: q.options || [],
              correctAnswer: q.correctAnswer,
              explanation: (q as any).explanation,
              topic: (q as any).topic,
              chapterTitle: test.name || 'Weekly Test',
              subjectName: 'Weekly Test / Challenge',
              classLevel: (test.classLevel as any) || undefined,
              source: 'WEEKLY_TEST',
            };
          }
          return null;
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);
      if (wrongPayload.length > 0) addMistakes(wrongPayload);
      safeQuestions.forEach((q, idx) => {
        if (answers[idx] !== undefined && answers[idx] === q.correctAnswer) {
          removeMistakeByQuestion(q.question, q.correctAnswer);
        }
      });
    } catch (err) { console.warn('mistakeBank update failed:', err); }

    // Clear local storage for this test
    try {
      localStorage.removeItem(`weekly_test_start_${test.id}`);
      localStorage.removeItem(`weekly_test_progress_${test.id}`);
    } catch {}
    
    if (auto) {
        setPostAlertAction(() => () => onComplete(score, safeQuestions.length, answers));
        setAlertConfig({isOpen: true, message: "Time is up! Your test has been submitted automatically."});
    } else {
        onComplete(score, safeQuestions.length, answers);
    }
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <CustomAlert 
          isOpen={alertConfig.isOpen} 
          message={alertConfig.message} 
          onClose={() => {
              setAlertConfig({...alertConfig, isOpen: false});
              postAlertAction();
          }} 
      />
      <CustomConfirm
          isOpen={confirmConfig.isOpen}
          title={confirmConfig.title}
          message={confirmConfig.message}
          onConfirm={() => {
              const submit = confirmConfig.onConfirm;
              setConfirmConfig(prev => ({...prev, isOpen: false}));
              submit();
          }}
          onCancel={() => setConfirmConfig(prev => ({...prev, isOpen: false}))}
      />
      {/* Resume / Restart Progress Dialog */}
      {showResumeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-indigo-50 border-2 border-indigo-200 flex items-center justify-center text-indigo-600">
              <Trophy size={28} />
            </div>
            <h3 className="text-lg font-black text-slate-800 mb-1">Pehle Ki Progress Mili!</h3>
            <p className="text-sm text-slate-600 mb-5 leading-relaxed">
              Aapne is test me <span className="font-bold text-indigo-600">{showResumeModal.count} / {safeQuestions.length}</span> sawal banaye hain.
              <br />
              Kya aap wahin se <span className="font-semibold text-slate-800">Resume</span> karna chahte hain ya fir se <span className="font-semibold text-slate-800">Restart</span> karenge?
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleRestart}
                className="w-full py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs active:scale-95 transition"
              >
                🔄 Restart Karein
              </button>
              <button
                type="button"
                onClick={handleResume}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs active:scale-95 transition shadow-md shadow-indigo-600/20"
              >
                ▶️ Resume Karein
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-slate-200 p-4 shadow-sm flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition active:scale-95 border border-slate-200"
            title="Wapas jayein (Progress save rahegi)"
          >
            <ArrowLeft size={16} />
            <span>Back</span>
          </button>
          <div>
            <h2 className="font-bold text-slate-800 leading-tight">{test.name}</h2>
            <p className="text-xs text-slate-600">Total Questions: {safeQuestions.length}</p>
          </div>
        </div>
        
        <div className={`flex items-center gap-2 font-mono font-bold text-lg px-4 py-2 rounded-lg ${timeLeft < 300 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-blue-50 text-blue-600'}`}>
          <Clock size={20} />
          {formatTime(timeLeft)}
        </div>
      </div>

      {/* Warning Banner */}
      <div className="bg-amber-50 text-amber-800 text-xs px-4 py-2 flex items-center justify-center gap-2 border-b border-amber-100">
        <AlertTriangle size={14} />
        Do not close the app. Test will auto-submit when timer ends.
      </div>

      {/* Question palette + one-question navigator */}
      <div className="flex-1 overflow-y-auto p-4 max-w-3xl mx-auto w-full pb-24">
        {safeQuestions.length === 0 ? (
           <div className="text-center py-20">
               <p className="text-slate-600">No questions found in this test.</p>
           </div>
        ) : (
          <>
            <McqQuestionNavigator
              total={safeQuestions.length}
              currentIndex={currentIndex}
              answers={answers}
              skipped={skipped}
              onJump={setCurrentIndex}
              className="mb-4"
            />
            {(() => {
              const idx = currentIndex;
              const q = safeQuestions[idx];
              return (
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <h4 className="font-bold text-slate-800 mb-4 flex gap-3">
                <span className="bg-indigo-100 text-indigo-700 w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 font-bold mt-0.5">{q.questionNumber ?? idx + 1}</span>
                <span className="flex-1">
                  <McqQuestionDisplay q={q} questionClassName="text-sm font-bold text-slate-800 leading-relaxed" />
                </span>
              </h4>
              <div className="space-y-2">
                {q.options && q.options.map((opt, oIdx) => (
                  <button
                    key={oIdx}
                    onClick={() => {
                      setAnswers(prev => ({ ...prev, [idx]: oIdx }));
                      setSkipped(prev => { const next = new Set(prev); next.delete(idx); return next; });
                    }}
                    className={`w-full text-left p-3 rounded-xl border-2 transition-all text-sm font-medium flex items-center gap-3
                      ${answers[idx] === oIdx 
                        ? 'bg-blue-50 border-blue-500 text-blue-700 ring-1 ring-blue-500' 
                        : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'}`}
                  >
                    <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] font-black shrink-0 ${answers[idx] === oIdx ? 'bg-blue-500 border-blue-500 text-white' : 'border-slate-300 text-slate-500'}`}>
                      {String.fromCharCode(65 + oIdx)}
                    </span>
                    <span className="flex-1" dangerouslySetInnerHTML={{ __html: renderMathInHtml(opt) }} />
                    {answers[idx] === oIdx && <CheckCircle size={16} className="text-blue-600" />}
                  </button>
                ))}
              </div>
            </div>
              );
            })()}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 bg-white border-t border-slate-200 sticky bottom-0 z-10 flex justify-between items-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setCurrentIndex(index => Math.max(0, index - 1))}
          disabled={currentIndex === 0 || isSubmitting}
          className="rounded-xl border border-slate-200 p-2 text-slate-600 disabled:opacity-30"
          aria-label="Previous question"
        ><ChevronLeft size={16} /></button>
        <button
          type="button"
          onClick={() => {
            if (currentIndex >= safeQuestions.length - 1) return;
            setSkipped(prev => answers[currentIndex] === undefined ? new Set(prev).add(currentIndex) : prev);
            setCurrentIndex(index => Math.min(safeQuestions.length - 1, index + 1));
          }}
          disabled={currentIndex >= safeQuestions.length - 1 || isSubmitting}
          className="flex items-center gap-1 rounded-xl border border-amber-200 bg-amber-50 px-2 py-2 text-[10px] font-black text-amber-700 disabled:opacity-30"
        ><SkipForward size={14} /> Skip</button>
        <button
          type="button"
          onClick={() => setCurrentIndex(index => Math.min(safeQuestions.length - 1, index + 1))}
          disabled={currentIndex >= safeQuestions.length - 1 || isSubmitting}
          className="rounded-xl border border-slate-200 p-2 text-slate-600 disabled:opacity-30"
          aria-label="Next question"
        ><ChevronRight size={16} /></button>
        <div className="ml-1 text-xs text-slate-600 font-medium">
          {Object.keys(answers).length} of {safeQuestions.length} Answered
        </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleBack}
            disabled={isSubmitting}
            className="px-4 py-3 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-sm transition active:scale-95 flex items-center gap-1.5"
            title="Wapas jayein (Progress save rahegi)"
          >
            <ArrowLeft size={16} />
            <span>Back</span>
          </button>
          <button
            onClick={() => {
                setConfirmConfig({
                    isOpen: true,
                    title: "Submit Test?",
                    message: "Are you sure you want to submit the test?",
                    onConfirm: () => handleSubmit(false)
                });
            }}
            disabled={isSubmitting}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-xl shadow-lg transition-all active:scale-95 flex items-center gap-2"
          >
            <Trophy size={18} /> Submit Test
          </button>
        </div>
      </div>
    </div>
  );
};
