// @ts-nocheck
import React, { useState, useMemo } from 'react';
import { MCQResult, User } from '../types';
import {
  TrendingUp, Award, Target, Zap, ChevronRight, X,
  Flame, BookOpen, Clock, Brain, AlertTriangle, Star,
  BarChart2, ChevronDown, ChevronUp, Lightbulb
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts';

interface Props {
  history: MCQResult[];
  user: User;
  onViewNotes?: (topic: string) => void;
}

function formatTime(seconds: number): string {
  if (!seconds || seconds <= 0) return '0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export const PerformanceGraph: React.FC<Props> = ({ history, user, onViewNotes }) => {
  const [expanded, setExpanded] = useState(false);

  const sorted = useMemo(
    () => [...history].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [history]
  );

  // ── Core Metrics ─────────────────────────────────────────────────────────
  const totalTests = history.length;

  const totalMcqs = history.reduce((acc, h) => acc + (h.totalQuestions || 0), 0);

  const overallAccuracy = totalTests > 0
    ? Math.round(history.reduce((acc, h) => acc + (h.totalQuestions > 0 ? (h.score / h.totalQuestions) * 100 : 0), 0) / totalTests)
    : 0;

  const totalStudySecs = history.reduce((acc, h) => acc + (h.totalTimeSeconds || 0), 0);

  const uniqueChapters = new Set(history.map(h => h.chapterId || h.chapterTitle)).size;

  const streak = user?.streak || 0;
  const longestStreak = user?.longestStreak || streak;

  // ── Weak / Strong Topics from topicStrength ───────────────────────────────
  const topicStrength = user?.topicStrength || {};
  const weakTopics: string[] = [];
  const strongTopics: string[] = [];
  Object.entries(topicStrength).forEach(([topic, data]: [string, any]) => {
    if (!data || data.total === 0) return;
    const pct = (data.correct / data.total) * 100;
    if (pct < 50) weakTopics.push(topic);
    else if (pct >= 70) strongTopics.push(topic);
  });

  // Fallback: derive from mcqHistory topicAnalysis if topicStrength is sparse
  const topicMap: Record<string, { correct: number; total: number }> = {};
  history.forEach(h => {
    if (h.topicAnalysis) {
      Object.entries(h.topicAnalysis).forEach(([topic, data]: [string, any]) => {
        if (!topicMap[topic]) topicMap[topic] = { correct: 0, total: 0 };
        topicMap[topic].correct += data.correct || 0;
        topicMap[topic].total += data.total || 0;
      });
    }
  });
  const derivedWeak = weakTopics.length === 0
    ? Object.entries(topicMap).filter(([, d]) => d.total > 0 && (d.correct / d.total) * 100 < 50).map(([t]) => t)
    : weakTopics;
  const derivedStrong = strongTopics.length === 0
    ? Object.entries(topicMap).filter(([, d]) => d.total > 0 && (d.correct / d.total) * 100 >= 70).map(([t]) => t)
    : strongTopics;

  // ── Recommended Next Chapter ─────────────────────────────────────────────
  const chapterScoreMap: Record<string, { score: number; total: number; title: string }> = {};
  history.forEach(h => {
    const key = h.chapterId || h.chapterTitle;
    if (!chapterScoreMap[key]) chapterScoreMap[key] = { score: 0, total: 0, title: h.chapterTitle };
    chapterScoreMap[key].score += h.score;
    chapterScoreMap[key].total += h.totalQuestions;
  });
  const worstChapter = Object.values(chapterScoreMap)
    .filter(c => c.total > 0)
    .sort((a, b) => (a.score / a.total) - (b.score / b.total))[0];

  // ── Last 7 Days Graph ─────────────────────────────────────────────────────
  const last7Days = useMemo(() => {
    const days: { day: string; accuracy: number; tests: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStr = d.toDateString();
      const dayLabel = d.toLocaleDateString('en-IN', { weekday: 'short' });
      const dayTests = history.filter(h => new Date(h.date).toDateString() === dayStr);
      const accuracy = dayTests.length > 0
        ? Math.round(dayTests.reduce((acc, h) => acc + (h.totalQuestions > 0 ? (h.score / h.totalQuestions) * 100 : 0), 0) / dayTests.length)
        : 0;
      days.push({ day: dayLabel, accuracy, tests: dayTests.length });
    }
    return days;
  }, [history]);

  // ── Circular Accuracy Ring ────────────────────────────────────────────────
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (overallAccuracy / 100) * circumference;
  const ringColor = overallAccuracy >= 75 ? '#22c55e' : overallAccuracy >= 50 ? '#3b82f6' : '#ef4444';

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
      {/* ── Header ── */}
      <div className="p-5 pb-4">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="font-black text-slate-800 text-lg">Performance</h3>
            <p className="text-xs text-slate-500">Your Learning Analytics</p>
          </div>
          <button
            onClick={() => setExpanded(v => !v)}
            className="text-blue-600 bg-blue-50 px-3 py-2 rounded-xl hover:bg-blue-100 transition-colors flex items-center gap-1.5 text-xs font-bold"
          >
            {expanded ? <><ChevronUp size={14}/> Less</> : <><ChevronDown size={14}/> Full Report</>}
          </button>
        </div>

        {/* ── Ring + Quick Stats ── */}
        <div className="flex items-center gap-5">
          <div className="relative w-22 h-22 flex-shrink-0" style={{ width: 88, height: 88 }}>
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 96 96">
              <circle cx="48" cy="48" r={radius} stroke="#f1f5f9" strokeWidth="9" fill="transparent" />
              <circle
                cx="48" cy="48" r={radius}
                stroke={ringColor} strokeWidth="9" fill="transparent"
                strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
                strokeLinecap="round" className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-black text-slate-800">{overallAccuracy}%</span>
              <span className="text-[9px] font-bold text-slate-500 uppercase">Accuracy</span>
            </div>
          </div>

          <div className="flex-1 grid grid-cols-2 gap-2">
            <Stat icon={<Flame size={12}/>} color="orange" label="Streak" value={`${streak}d`} />
            <Stat icon={<BookOpen size={12}/>} color="blue" label="Chapters" value={uniqueChapters} />
            <Stat icon={<Brain size={12}/>} color="purple" label="MCQs" value={totalMcqs} />
            <Stat icon={<Clock size={12}/>} color="green" label="Study Time" value={formatTime(totalStudySecs)} />
          </div>
        </div>
      </div>

      {/* ── Expanded Report ── */}
      {expanded && (
        <div className="border-t border-slate-100 animate-in slide-in-from-top-2">

          {/* 7-Day Chart */}
          <div className="px-5 pt-4 pb-2">
            <div className="flex items-center gap-2 mb-3">
              <BarChart2 size={14} className="text-blue-500" />
              <span className="text-xs font-bold text-slate-700">Last 7 Days</span>
            </div>
            <ResponsiveContainer width="100%" height={110}>
              <BarChart data={last7Days} barSize={22} margin={{ top: 4, right: 0, bottom: 0, left: -24 }}>
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#cbd5e1' }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(148,163,184,0.1)' }}
                  formatter={(val: number) => [`${val}%`, 'Accuracy']}
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
                />
                <Bar dataKey="accuracy" radius={[6, 6, 0, 0]}>
                  {last7Days.map((entry, i) => (
                    <Cell key={i} fill={entry.accuracy >= 75 ? '#22c55e' : entry.accuracy >= 50 ? '#3b82f6' : entry.tests === 0 ? '#e2e8f0' : '#f97316'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Weak Topics */}
          {derivedWeak.length > 0 && (
            <div className="px-5 py-3 border-t border-slate-50">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={13} className="text-red-500" />
                <span className="text-xs font-bold text-slate-700">Needs Work ({derivedWeak.length})</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {derivedWeak.slice(0, 6).map((t, i) => (
                  <button
                    key={i}
                    onClick={() => onViewNotes?.(t)}
                    className="text-[10px] font-semibold bg-red-50 text-red-600 px-2.5 py-1 rounded-full border border-red-100 hover:bg-red-100 transition-colors"
                  >
                    {t}
                  </button>
                ))}
                {derivedWeak.length > 6 && (
                  <span className="text-[10px] text-slate-400 self-center">+{derivedWeak.length - 6} more</span>
                )}
              </div>
            </div>
          )}

          {/* Strong Topics */}
          {derivedStrong.length > 0 && (
            <div className="px-5 py-3 border-t border-slate-50">
              <div className="flex items-center gap-2 mb-2">
                <Star size={13} className="text-yellow-500" />
                <span className="text-xs font-bold text-slate-700">Strong Topics ({derivedStrong.length})</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {derivedStrong.slice(0, 6).map((t, i) => (
                  <span key={i} className="text-[10px] font-semibold bg-green-50 text-green-700 px-2.5 py-1 rounded-full border border-green-100">
                    {t}
                  </span>
                ))}
                {derivedStrong.length > 6 && (
                  <span className="text-[10px] text-slate-400 self-center">+{derivedStrong.length - 6} more</span>
                )}
              </div>
            </div>
          )}

          {/* Recommended Chapter */}
          {worstChapter && (
            <div className="mx-5 my-3 bg-amber-50 border border-amber-100 rounded-2xl p-3 flex items-center gap-3">
              <div className="bg-amber-100 p-2 rounded-xl flex-shrink-0">
                <Lightbulb size={16} className="text-amber-600" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-amber-700 uppercase mb-0.5">Revise Next</p>
                <p className="text-xs font-black text-amber-900 truncate">{worstChapter.title}</p>
                <p className="text-[10px] text-amber-600">
                  {Math.round((worstChapter.score / worstChapter.total) * 100)}% avg — needs more practice
                </p>
              </div>
            </div>
          )}

          {/* Recent Activity */}
          <div className="px-5 pt-1 pb-4 border-t border-slate-50">
            <p className="text-[10px] font-bold text-slate-500 uppercase mb-2 mt-2">Recent Tests</p>
            {sorted.length === 0 && (
              <p className="text-center text-xs text-slate-400 py-2">No tests taken yet.</p>
            )}
            <div className="space-y-2">
              {sorted.slice(0, 5).map((test, i) => {
                const pct = test.totalQuestions > 0 ? Math.round((test.score / test.totalQuestions) * 100) : 0;
                return (
                  <div key={i} className="flex items-center gap-3">
                    <div className={`w-1.5 h-8 rounded-full flex-shrink-0 ${pct >= 75 ? 'bg-green-500' : pct >= 50 ? 'bg-blue-500' : 'bg-red-400'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">{test.chapterTitle}</p>
                      <p className="text-[10px] text-slate-400">{test.subjectId} · {new Date(test.date).toLocaleDateString('en-IN')}</p>
                    </div>
                    <span className={`text-xs font-black ${pct >= 75 ? 'text-green-600' : pct >= 50 ? 'text-blue-600' : 'text-red-500'}`}>{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Stat: React.FC<{ icon: React.ReactNode; color: string; label: string; value: string | number }> = ({ icon, color, label, value }) => {
  const colorMap: Record<string, string> = {
    orange: 'bg-orange-100 text-orange-600',
    blue: 'bg-blue-100 text-blue-600',
    purple: 'bg-purple-100 text-purple-600',
    green: 'bg-green-100 text-green-600',
  };
  return (
    <div className="bg-slate-50 p-2 rounded-xl">
      <div className="flex items-center gap-1.5 mb-0.5">
        <div className={`p-1 rounded-lg ${colorMap[color]}`}>{icon}</div>
        <span className="text-[9px] font-bold text-slate-500 uppercase">{label}</span>
      </div>
      <p className="text-sm font-black text-slate-800">{value}</p>
    </div>
  );
};
