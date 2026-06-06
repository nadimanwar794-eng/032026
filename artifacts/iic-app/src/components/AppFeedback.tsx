import React, { useState } from 'react';
import { ChevronLeft, Send, Star, CheckCircle2 } from 'lucide-react';
import type { User } from '../types';
import type { AppFeedbackAnswer, AppFeedbackEntry } from '../types';
import { saveAppFeedback } from '../firebase';

interface Props {
  user: User;
  onBack: () => void;
}

const QUESTIONS: Array<{
  id: string;
  question: string;
  questionHindi: string;
  type: 'rating' | 'text' | 'choice';
  options?: string[];
}> = [
  {
    id: 'overall',
    question: 'Overall, how would you rate this app?',
    questionHindi: 'Overall app ko kitne stars doge?',
    type: 'rating',
  },
  {
    id: 'best_feature',
    question: 'Which feature do you use the most?',
    questionHindi: 'Sabse zyada kaunsa feature use karte ho?',
    type: 'choice',
    options: ['Notes / Reading', 'MCQ Practice', 'AI Chat', 'Revision Hub', 'Community Chat', 'Videos', 'Aur kuch'],
  },
  {
    id: 'difficulty',
    question: 'Is the app easy to use?',
    questionHindi: 'App use karna kitna aasaan lagta hai?',
    type: 'rating',
  },
  {
    id: 'content_quality',
    question: 'How is the quality of study content?',
    questionHindi: 'Study content ki quality kaisi lagti hai?',
    type: 'rating',
  },
  {
    id: 'suggestion',
    question: 'Any suggestion or improvement you want?',
    questionHindi: 'Koi suggestion ya improvement chahiye?',
    type: 'text',
  },
];

const StarRow: React.FC<{
  value: number;
  onChange: (v: number) => void;
}> = ({ value, onChange }) => {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-2 mt-2">
      {[1, 2, 3, 4, 5].map(s => (
        <button
          key={s}
          type="button"
          onMouseEnter={() => setHover(s)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(s)}
          className="focus:outline-none transition-transform active:scale-90"
        >
          <Star
            size={32}
            className="transition-colors"
            fill={(hover || value) >= s ? '#f59e0b' : 'none'}
            stroke={(hover || value) >= s ? '#f59e0b' : '#94a3b8'}
            strokeWidth={1.5}
          />
        </button>
      ))}
    </div>
  );
};

const AppFeedback: React.FC<Props> = ({ user, onBack }) => {
  const [answers, setAnswers] = useState<Record<string, AppFeedbackAnswer>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const setAnswer = (qId: string, partial: Partial<AppFeedbackAnswer>, question: string) => {
    setAnswers(prev => ({
      ...prev,
      [qId]: {
        questionId: qId,
        question,
        type: partial.type || 'text',
        ...partial,
      },
    }));
  };

  const overallRating = (answers['overall']?.rating) || 0;

  const handleSubmit = async () => {
    if (overallRating === 0) {
      setError('Overall rating dena zaroori hai ⭐');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const entry: AppFeedbackEntry = {
        id: `fb_${user.id}_${Date.now()}`,
        userId: user.id,
        userName: user.name || 'Unknown',
        userRole: user.role,
        userClass: (user as any).class || (user as any).classLevel || '',
        userBoard: (user as any).board || '',
        isPremium: user.isPremium || false,
        subscriptionTier: user.subscriptionTier || '',
        answers: Object.values(answers),
        overallRating,
        submittedAt: new Date().toISOString(),
      };
      await saveAppFeedback(entry);
      setSubmitted(true);
    } catch {
      setError('Submit nahi hua. Internet check karke try karo.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-6 text-center">
        <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mb-5">
          <CheckCircle2 size={40} className="text-emerald-500" />
        </div>
        <h2 className="text-xl font-black text-slate-800 mb-2">Shukriya! 🙏</h2>
        <p className="text-sm text-slate-500 mb-6 max-w-xs">
          Tumhara feedback mil gaya. Isse app ko aur behtar banane mein madad milegi.
        </p>
        <button
          onClick={onBack}
          className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow active:scale-95 transition-transform"
        >
          Profile pe wapas jao
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-100 shadow-sm px-4 py-3 flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-xl flex items-center justify-center bg-slate-100 active:scale-90 transition-transform"
        >
          <ChevronLeft size={20} className="text-slate-700" />
        </button>
        <div>
          <h1 className="text-base font-black text-slate-800 leading-tight">App Feedback</h1>
          <p className="text-[10px] text-slate-400 leading-tight">Apna anubhav share karo</p>
        </div>
      </div>

      <div className="px-4 pt-5 space-y-4 max-w-lg mx-auto">
        {/* Intro banner */}
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl px-4 py-3 flex items-start gap-3">
          <span className="text-2xl mt-0.5">💬</span>
          <div>
            <p className="text-sm font-bold text-indigo-800">Tumhara feedback bahut important hai!</p>
            <p className="text-[11px] text-indigo-600 mt-0.5">
              Seedha admin tak pahunchega. Sach mein batao — good ya bad, sab suno.
            </p>
          </div>
        </div>

        {/* Questions */}
        {QUESTIONS.map((q) => (
          <div
            key={q.id}
            className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-4"
          >
            <p className="text-xs font-black text-indigo-500 uppercase tracking-widest mb-0.5">
              {q.questionHindi}
            </p>
            <p className="text-[11px] text-slate-400 mb-3">{q.question}</p>

            {q.type === 'rating' && (
              <StarRow
                value={answers[q.id]?.rating || 0}
                onChange={v =>
                  setAnswer(q.id, { type: 'rating', rating: v }, q.questionHindi)
                }
              />
            )}

            {q.type === 'choice' && q.options && (
              <div className="flex flex-wrap gap-2 mt-1">
                {q.options.map(opt => {
                  const isSelected = answers[q.id]?.choice === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() =>
                        setAnswer(q.id, { type: 'choice', choice: opt }, q.questionHindi)
                      }
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all active:scale-95 ${
                        isSelected
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow'
                          : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            )}

            {q.type === 'text' && (
              <textarea
                value={answers[q.id]?.text || ''}
                onChange={e =>
                  setAnswer(q.id, { type: 'text', text: e.target.value }, q.questionHindi)
                }
                placeholder="Yahan likho..."
                rows={3}
                className="w-full mt-1 p-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-400 resize-none bg-slate-50 text-slate-800 placeholder-slate-400"
              />
            )}
          </div>
        ))}

        {error && (
          <p className="text-xs text-red-500 font-semibold text-center">{error}</p>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full py-4 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-black rounded-2xl shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-60"
        >
          {submitting ? (
            <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
          ) : (
            <Send size={16} />
          )}
          {submitting ? 'Submit ho raha hai...' : 'Feedback Submit Karo'}
        </button>

        <p className="text-[10px] text-slate-400 text-center pb-4">
          Tumhara naam aur basic info feedback ke saath save hogi.
        </p>
      </div>
    </div>
  );
};

export default AppFeedback;
