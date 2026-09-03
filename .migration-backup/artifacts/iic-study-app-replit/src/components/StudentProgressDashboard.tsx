// @ts-nocheck
import React, { useState, useMemo, useEffect } from "react";
import {
  ChevronLeft, TrendingUp, Target, Zap, Flame, BookOpen,
  AlertTriangle, CheckCircle, BarChart2, Calendar, Award, Brain,
  RefreshCw, Star, Clock, RotateCcw, FileText, Video, Layers,
  ChevronDown, ChevronUp, Trophy, XCircle, BookMarked, GraduationCap,
  School, Dumbbell, ClipboardList
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { getMistakeBankSync, MistakeEntry } from "../utils/mistakeBank";
import { getScoreLog, ScoreLogEntry } from "../utils/scoreSystem";
import { getLevelInfo, getNextLevelInfo } from "../utils/levelSystem";
import { getScoreLogFromFirebase } from "../firebase";
import { getAllBuckets, getDueItems, type TopicBucket } from "../utils/revisionTrackerV2";

interface Props {
  user: any;
  onBack: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const getLocalDate = (offsetDays = 0): string => {
  const d = new Date();
  if (offsetDays) d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
const fmt = (n: number) => n.toLocaleString('en-IN');

const ACTIVITY_LABELS: Record<string, { label: string; color: string; isStudy: boolean }> = {
  MCQ_CORRECT:               { label: 'MCQ Sahi',           color: '#22c55e', isStudy: true },
  MCQ_WRONG:                 { label: 'MCQ Galat',          color: '#f87171', isStudy: true },
  MCQ_STREAK_3:              { label: 'MCQ Streak 3x',      color: '#fb923c', isStudy: true },
  MCQ_STREAK_5:              { label: 'MCQ Streak 5x',      color: '#fbbf24', isStudy: true },
  READ_ACTIVE_30S:           { label: 'Notes Padha',        color: '#38bdf8', isStudy: true },
  READ_TTS_HIGHLIGHT:        { label: 'TTS Suna',           color: '#a78bfa', isStudy: true },
  READ_MANUAL_TOPIC_10S:     { label: 'Topic Engage',       color: '#fb923c', isStudy: true },
  WRITE_ACTIVE_5MIN:         { label: 'Notes Likha',        color: '#34d399', isStudy: true },
  PDF_MILESTONE:             { label: 'PDF Padha',          color: '#f472b6', isStudy: true },
  READ_NOTES_TIME:           { label: 'Notes Time',         color: '#818cf8', isStudy: true },
  AUDIO_TTS:                 { label: 'Audio Suna',         color: '#34d399', isStudy: true },
  NOTES_GK_TTS:              { label: 'GK Suna',            color: '#f472b6', isStudy: true },
  VIDEO:                     { label: 'Video Dekha',        color: '#3b82f6', isStudy: true },
  PDF:                       { label: 'PDF Read',           color: '#8b5cf6', isStudy: true },
  DAILY_LOGIN:               { label: 'Daily Login',        color: '#10b981', isStudy: false },
  MILESTONE:                 { label: 'Milestone',          color: '#06b6d4', isStudy: true },
  COACHING_HW_MCQ_CORRECT:   { label: 'Coaching MCQ Sahi',  color: '#10b981', isStudy: true },
  COACHING_HW_NOTES:         { label: 'Coaching Notes',     color: '#8b5cf6', isStudy: true },
};

const PIE_COLORS = ['#6366f1','#f59e0b','#10b981','#f43f5e','#3b82f6','#a78bfa','#fb923c','#34d399'];

const TIER_META = {
  weak:     { label: 'Weak',     emoji: '🔴', bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-700',    pill: 'bg-red-100 text-red-700' },
  average:  { label: 'Average',  emoji: '🟡', bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-700',  pill: 'bg-amber-100 text-amber-700' },
  strong:   { label: 'Strong',   emoji: '🟢', bg: 'bg-emerald-50',border: 'border-emerald-200',text: 'text-emerald-700',pill: 'bg-emerald-100 text-emerald-700' },
  mastered: { label: 'Mastered', emoji: '⭐', bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700', pill: 'bg-indigo-100 text-indigo-700' },
};

// ─── Tabs config ─────────────────────────────────────────────────────────────
const TABS = [
  { id: 'overview',    label: 'Overview',    emoji: '📊' },
  { id: 'class',       label: 'Class 6-12',  emoji: '📚' },
  { id: 'competition', label: 'Competition', emoji: '🏆' },
  { id: 'school',      label: 'School',      emoji: '🏫' },
  { id: 'coaching',    label: 'Coaching',    emoji: '🎓' },
  { id: 'revision',    label: 'Revision Hub',emoji: '🔄' },
  { id: 'mistakes',    label: 'My Mistakes', emoji: '❌' },
] as const;
type TabId = typeof TABS[number]['id'];

// ─── Data helpers ─────────────────────────────────────────────────────────────
function getRevisionStats() {
  const all = getAllBuckets();
  const due = getDueItems();
  const todayStart = (() => { const d = new Date(); d.setHours(0,0,0,0); return d.getTime(); })();
  const tierCounts = { weak: 0, average: 0, strong: 0, mastered: 0 };
  let completedToday = 0;
  all.forEach(b => {
    const tier = b.lastTier || 'weak';
    if (tierCounts[tier] !== undefined) tierCounts[tier]++;
    if (b.nextDueAt && b.nextDueAt > todayStart && b.lastAttemptAt && b.lastAttemptAt >= todayStart) completedToday++;
  });
  const bySubject: Record<string, { name: string; weak: number; average: number; strong: number; mastered: number }> = {};
  all.forEach(b => {
    const sub = b.subjectName || b.subjectId || 'Other';
    if (!bySubject[sub]) bySubject[sub] = { name: sub, weak: 0, average: 0, strong: 0, mastered: 0 };
    const tier = b.lastTier || 'weak';
    if (bySubject[sub][tier] !== undefined) bySubject[sub][tier]++;
  });
  const subjectRows = Object.values(bySubject)
    .map(r => ({ ...r, total: r.weak + r.average + r.strong + r.mastered }))
    .sort((a, b) => b.total - a.total);
  return { all, due, tierCounts, totalTracked: all.length, dueCount: due.length, completedToday, subjectRows };
}

function getTodayStats(log: ScoreLogEntry[]) {
  const today = getLocalDate(0);
  const e = log.filter(x => x.date === today);
  // MCQ accuracy: only MCQ_CORRECT / MCQ_WRONG (general MCQs).
  // COACHING_HW_MCQ_CORRECT is NOT counted here because coaching has no
  // corresponding wrong activity, which would make accuracy calculation wrong.
  const mcqCorrect    = e.filter(x => x.activity === 'MCQ_CORRECT').length;
  const mcqWrong      = e.filter(x => x.activity === 'MCQ_WRONG').length;
  const mcqTotal      = mcqCorrect + mcqWrong;
  const accuracy      = mcqTotal > 0 ? Math.round((mcqCorrect / mcqTotal) * 100) : 0;
  // Coaching MCQ sahi counted separately so Overview card can show both
  const coachingMcq   = e.filter(x => x.activity === 'COACHING_HW_MCQ_CORRECT').length;
  // Notes: school notes sessions only (coaching notes shown in Coaching tab separately)
  const notesRead     = e.filter(x => x.activity === 'READ_ACTIVE_30S' || x.activity === 'READ_NOTES_TIME').length;
  const coachingNotes = e.filter(x => x.activity === 'COACHING_HW_NOTES').length;
  const videosWatched = e.filter(x => x.activity === 'VIDEO').length;
  const pdfsRead      = e.filter(x => x.activity === 'PDF' || x.activity === 'PDF_MILESTONE').length;
  const xpToday       = e.reduce((s, x) => s + (x.pts || 0), 0);
  return { mcqCorrect, mcqWrong, mcqTotal, accuracy, coachingMcq, notesRead, coachingNotes, videosWatched, pdfsRead, xpToday };
}

// ─── Reusable UI pieces ───────────────────────────────────────────────────────
function StatCard({ icon, label, value, color = 'indigo' }: { icon: string; label: string; value: string; color?: string }) {
  const isEmpty = value === '—' || value === '0' || value === '0%';
  return (
    <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2.5">
      <span className="text-base shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] text-slate-500 font-medium truncate">{label}</p>
        <p className={`text-sm font-black ${isEmpty ? 'text-slate-300' : 'text-slate-800'}`}>{value}</p>
      </div>
    </div>
  );
}

function SectionHeader({ emoji, title, subtitle, gradient }: { emoji: string; title: string; subtitle?: string; gradient: string }) {
  return (
    <div className={`rounded-2xl px-4 py-3 flex items-center gap-3 ${gradient}`}>
      <span className="text-2xl">{emoji}</span>
      <div>
        <p className="text-white font-black text-sm">{title}</p>
        {subtitle && <p className="text-white/70 text-[10px] font-medium">{subtitle}</p>}
      </div>
    </div>
  );
}

function EmptyState({ emoji, msg }: { emoji: string; msg: string }) {
  return (
    <div className="text-center py-8">
      <p className="text-4xl mb-2">{emoji}</p>
      <p className="text-[12px] font-bold text-slate-500">{msg}</p>
    </div>
  );
}

function MistakeSubjectCard({ sub }: { sub: { subject: string; topics: string[]; count: number; source?: string } }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-red-50 border border-red-100 rounded-xl overflow-hidden">
      <button className="w-full flex items-center justify-between px-3 py-2.5" onClick={() => setOpen(v => !v)}>
        <div className="text-left">
          <p className="text-[12px] font-black text-red-700">{sub.subject}</p>
          {sub.source && <p className="text-[10px] text-red-400">{sub.source}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-black bg-red-100 text-red-600 px-2 py-0.5 rounded-full">{sub.count} mistakes</span>
          {open ? <ChevronUp size={14} className="text-red-400" /> : <ChevronDown size={14} className="text-red-400" />}
        </div>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-1 border-t border-red-100 pt-2">
          {sub.topics.slice(0, 8).map(t => (
            <p key={t} className="text-[11px] text-red-600 font-medium">• {t}</p>
          ))}
          {sub.topics.length > 8 && <p className="text-[10px] text-red-400">+{sub.topics.length - 8} aur topics...</p>}
        </div>
      )}
    </div>
  );
}

// ─── Individual Tabs ──────────────────────────────────────────────────────────

function OverviewTab({ user, log, rev }: { user: any; log: ScoreLogEntry[]; rev: any }) {
  const levelInfo = useMemo(() => getLevelInfo(user?.totalScore || 0), [user?.totalScore]);
  const nextLevel = useMemo(() => getNextLevelInfo(user?.totalScore || 0), [user?.totalScore]);
  const xpToNext  = nextLevel ? nextLevel.minScore - (user?.totalScore || 0) : 0;
  const xpProgress = nextLevel
    ? Math.min(100, Math.round(((user?.totalScore || 0) - levelInfo.minScore) / (nextLevel.minScore - levelInfo.minScore) * 100))
    : 100;
  const todayStats = useMemo(() => getTodayStats(log), [log]);
  const last7Days = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = getLocalDate(-i);
      const dayEntries = log.filter(e => e.date === date);
      const mcqCorrect = dayEntries.filter(e => e.activity === 'MCQ_CORRECT').length;
      const studyPts   = dayEntries.filter(e => ACTIVITY_LABELS[e.activity]?.isStudy).reduce((s, e) => s + e.pts, 0);
      const pts        = dayEntries.reduce((s, e) => s + e.pts, 0);
      const d          = new Date(date + 'T00:00:00');
      const label      = i === 0 ? 'Aaj' : i === 1 ? 'Kal' : d.toLocaleDateString('en-IN', { weekday: 'short' });
      days.push({ date, label, pts, mcqCorrect, studyPts });
    }
    return days;
  }, [log]);
  const activityBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    log.forEach(e => {
      const meta = ACTIVITY_LABELS[e.activity];
      if (!meta?.isStudy) return;
      map[meta.label] = (map[meta.label] || 0) + e.pts;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0,6);
  }, [log]);

  const todaySummary = (() => {
    const parts = [];
    if (todayStats.mcqTotal > 0)      parts.push(`${todayStats.mcqTotal} MCQ (${todayStats.accuracy}% accuracy)`);
    if (todayStats.coachingMcq > 0)   parts.push(`${todayStats.coachingMcq} coaching MCQ`);
    if (todayStats.notesRead > 0)     parts.push(`${todayStats.notesRead} notes sessions`);
    if (todayStats.coachingNotes > 0) parts.push(`${todayStats.coachingNotes} coaching notes`);
    if (todayStats.videosWatched > 0) parts.push(`${todayStats.videosWatched} videos`);
    if (rev.completedToday > 0)       parts.push(`${rev.completedToday} revision topics`);
    if (parts.length === 0) return 'Aaj abhi padhai start nahi ki. Chalo shuru karo! 🚀';
    return `Aaj tumne ${parts.join(', ')} complete kiya. ${todayStats.xpToday > 0 ? `+${todayStats.xpToday} XP kamaya!` : ''} 💪`;
  })();

  // Combined today total for display (general MCQ + coaching MCQ, kept separate for accuracy)
  const todayMcqAll = todayStats.mcqTotal + todayStats.coachingMcq;
  const todayNotesAll = todayStats.notesRead + todayStats.coachingNotes;

  return (
    <div className="space-y-4">
      {/* Today card */}
      <div className="rounded-2xl overflow-hidden border border-indigo-100 shadow-sm">
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 flex items-center gap-2">
          <span className="text-lg">📅</span>
          <div>
            <p className="text-white font-black text-sm">Aaj Ka Learning Card</p>
            <p className="text-white/70 text-[10px] font-medium">
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
        </div>
        <div className="bg-white px-4 py-3 grid grid-cols-2 gap-2">
          {[
            { icon: '📚', label: 'Notes Sessions',     value: todayNotesAll > 0 ? String(todayNotesAll) : '—' },
            { icon: '❓', label: 'MCQs Solve Kiye',    value: todayMcqAll > 0 ? String(todayMcqAll) : '—' },
            { icon: '🎯', label: 'MCQ Accuracy',        value: todayStats.mcqTotal > 0 ? `${todayStats.accuracy}%` : '—' },
            { icon: '🔄', label: 'Revision Complete',   value: rev.completedToday > 0 ? String(rev.completedToday) : '—' },
            { icon: '🎥', label: 'Videos Dekhe',        value: todayStats.videosWatched > 0 ? String(todayStats.videosWatched) : '—' },
            { icon: '📄', label: 'PDFs Padhe',          value: todayStats.pdfsRead > 0 ? String(todayStats.pdfsRead) : '—' },
          ].map(({ icon, label, value }) => <StatCard key={label} icon={icon} label={label} value={value} />)}
        </div>
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-2.5 flex items-center justify-between border-t border-orange-100">
          <div className="flex items-center gap-1.5"><span className="text-base">⭐</span><p className="text-sm font-black text-amber-700">+{todayStats.xpToday} XP Aaj</p></div>
          <div className="flex items-center gap-1.5"><span className="text-base">🔥</span><p className="text-sm font-black text-orange-700">{user?.streak || 0} Din Streak</p></div>
          <div className="flex items-center gap-1.5"><span className="text-base">🏆</span><p className="text-sm font-black text-indigo-700">Lv {levelInfo.level}</p></div>
        </div>
        <div className="bg-indigo-50 px-4 py-2.5 border-t border-indigo-100">
          <p className="text-[11px] text-indigo-700 font-medium leading-snug">💬 {todaySummary}</p>
        </div>
      </div>

      {/* XP / Level */}
      <div className="rounded-2xl p-4 text-white relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${levelInfo.color}, #1e1b4b)` }}>
        <div className="flex items-center gap-3 mb-3">
          <span className="text-4xl">{levelInfo.emoji}</span>
          <div className="flex-1">
            <p className="text-xs font-bold opacity-80 uppercase tracking-wide">Level {levelInfo.level}</p>
            <p className="text-lg font-black leading-tight">{levelInfo.label}</p>
            <p className="text-xs opacity-75">Total XP: {fmt(user?.totalScore || 0)}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black">🔥 {user?.streak || 0}</p>
            <p className="text-[10px] opacity-75 font-bold">Day Streak</p>
          </div>
        </div>
        {nextLevel && (
          <div>
            <div className="flex justify-between text-[10px] font-bold opacity-80 mb-1">
              <span>Next: Level {nextLevel.level} {nextLevel.emoji}</span>
              <span>{xpProgress}% • {fmt(xpToNext)} XP baaki</span>
            </div>
            <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-white/80 rounded-full transition-all duration-700" style={{ width: `${xpProgress}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Streak */}
      <div className="bg-gradient-to-r from-orange-50 to-red-50 border border-orange-100 rounded-2xl p-4">
        <p className="text-sm font-black text-orange-800 mb-2 flex items-center gap-2"><Flame size={15} className="text-orange-500" /> Streak & Consistency</p>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-white rounded-xl p-3 text-center">
            <p className="text-2xl font-black text-orange-600">🔥 {user?.streak || 0}</p>
            <p className="text-[10px] font-bold text-slate-500">Current Streak</p>
          </div>
          <div className="bg-white rounded-xl p-3 text-center">
            <p className="text-2xl font-black text-amber-600">⭐ {user?.longestStreak || user?.streak || 0}</p>
            <p className="text-[10px] font-bold text-slate-500">Longest Streak</p>
          </div>
        </div>
        <p className="text-[10px] font-black text-orange-700 mb-1.5">Last 7 Days:</p>
        <div className="flex gap-1">
          {last7Days.map(d => (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-0.5">
              <div className={`w-full h-7 rounded-lg flex items-center justify-center text-[10px] font-black ${d.pts > 0 ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-300'}`}>{d.pts > 0 ? '✓' : '·'}</div>
              <span className="text-[8px] font-bold text-slate-400">{d.label.slice(0,2)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 7-day chart */}
      <div className="bg-white rounded-2xl p-4 border border-slate-100">
        <p className="text-sm font-black text-slate-800 mb-3 flex items-center gap-2"><BarChart2 size={15} className="text-blue-500" /> Last 7 Days Activity</p>
        {last7Days.some(d => d.pts > 0) ? (
          <>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={last7Days} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#64748b', fontWeight: 700 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 8, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: number, name: string) => [fmt(v), name === 'studyPts' ? 'Study Points' : 'MCQ Sahi']} contentStyle={{ fontSize: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                <Bar dataKey="studyPts"   fill="#6366f1" radius={[4,4,0,0]} name="studyPts" />
                <Bar dataKey="mcqCorrect" fill="#22c55e" radius={[4,4,0,0]} name="mcqCorrect" />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex gap-3 mt-1">
              <span className="flex items-center gap-1 text-[9px] font-bold text-indigo-600"><span className="w-2.5 h-2.5 rounded-sm bg-indigo-500 inline-block" /> Study Points</span>
              <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-600"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" /> MCQ Sahi</span>
            </div>
          </>
        ) : <EmptyState emoji="📭" msg="Koi activity nahi pichle 7 din mein. Padhai shuru karo! 📚" />}
      </div>

      {/* Activity breakdown */}
      {activityBreakdown.length > 0 && (
        <div className="bg-white rounded-2xl p-4 border border-slate-100">
          <p className="text-sm font-black text-slate-800 mb-3 flex items-center gap-2"><TrendingUp size={15} className="text-violet-500" /> Padhai Ka Tarika</p>
          <div className="space-y-2">
            {activityBreakdown.map((item, i) => {
              const max = activityBreakdown[0].value;
              const pct = Math.round((item.value / max) * 100);
              return (
                <div key={item.name}>
                  <div className="flex justify-between text-[10px] font-bold text-slate-600 mb-0.5"><span>{item.name}</span><span>{fmt(item.value)} pts</span></div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ClassTab({ log, mistakes, user }: { log: ScoreLogEntry[]; mistakes: MistakeEntry[]; user: any }) {
  const classMistakes = useMemo(() =>
    mistakes.filter(m => m.classLevel && m.classLevel !== 'COMPETITION' && m.board !== 'COMPETITION'),
  [mistakes]);

  const mcqStats = useMemo(() => {
    const correct = log.filter(e => e.activity === 'MCQ_CORRECT').length;
    const wrong   = log.filter(e => e.activity === 'MCQ_WRONG').length;
    const total   = correct + wrong;
    return { correct, wrong, total, accuracy: total > 0 ? Math.round((correct / total) * 100) : 0 };
  }, [log]);

  const notesTotal = useMemo(() =>
    log.filter(e => ['READ_ACTIVE_30S','READ_NOTES_TIME','WRITE_ACTIVE_5MIN','READ_TTS_HIGHLIGHT','READ_MANUAL_TOPIC_10S'].includes(e.activity)).length,
  [log]);

  const videoTotal = useMemo(() => log.filter(e => e.activity === 'VIDEO').length, [log]);
  const pdfTotal   = useMemo(() => log.filter(e => e.activity === 'PDF' || e.activity === 'PDF_MILESTONE').length, [log]);

  const bySubject = useMemo(() => {
    const map: Record<string, { subject: string; topics: string[]; count: number; source?: string }> = {};
    classMistakes.forEach(m => {
      const sub = m.subjectName || m.board || 'Other';
      if (!map[sub]) map[sub] = { subject: sub, topics: [], count: 0, source: m.classLevel ? `Class ${m.classLevel}` : undefined };
      if (m.topic && !map[sub].topics.includes(m.topic)) map[sub].topics.push(m.topic);
      map[sub].count++;
    });
    return Object.values(map).sort((a,b) => b.count - a.count);
  }, [classMistakes]);

  return (
    <div className="space-y-4">
      <SectionHeader emoji="📚" title={`Class ${user?.classLevel || '6-12'} Progress`} subtitle={user?.board || 'School Board'} gradient="bg-gradient-to-r from-blue-600 to-cyan-600" />

      {/* Study activity */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100"><p className="text-sm font-black text-slate-800">📈 Study Activity (All Time)</p></div>
        <div className="px-4 py-3 grid grid-cols-2 gap-2">
          <StatCard icon="❓" label="MCQ Try Kiye"  value={mcqStats.total > 0 ? fmt(mcqStats.total) : '—'} />
          <StatCard icon="🎯" label="MCQ Accuracy"  value={mcqStats.total > 0 ? `${mcqStats.accuracy}%` : '—'} />
          <StatCard icon="✅" label="MCQ Sahi"       value={mcqStats.correct > 0 ? fmt(mcqStats.correct) : '—'} />
          <StatCard icon="❌" label="MCQ Galat"      value={mcqStats.wrong > 0 ? fmt(mcqStats.wrong) : '—'} />
          <StatCard icon="📖" label="Notes Sessions" value={notesTotal > 0 ? String(notesTotal) : '—'} />
          <StatCard icon="🎥" label="Videos Dekhe"   value={videoTotal > 0 ? String(videoTotal) : '—'} />
          <StatCard icon="📄" label="PDFs Padhe"     value={pdfTotal > 0 ? String(pdfTotal) : '—'} />
        </div>
      </div>

      {/* MCQ accuracy bar */}
      {mcqStats.total > 0 && (
        <div className="bg-white rounded-2xl p-4 border border-slate-100">
          <p className="text-sm font-black text-slate-800 mb-3 flex items-center gap-2"><CheckCircle size={15} className="text-emerald-500" /> MCQ Performance</p>
          <div className="flex items-center gap-3">
            <div className="flex-1 space-y-1.5">
              <div className="flex justify-between text-[10px] font-bold text-emerald-700"><span>✅ Sahi: {fmt(mcqStats.correct)}</span><span>{Math.round(mcqStats.correct/mcqStats.total*100)}%</span></div>
              <div className="w-full h-2.5 bg-emerald-100 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 rounded-full" style={{ width: `${mcqStats.correct/mcqStats.total*100}%` }} /></div>
              <div className="flex justify-between text-[10px] font-bold text-red-500"><span>❌ Galat: {fmt(mcqStats.wrong)}</span><span>{Math.round(mcqStats.wrong/mcqStats.total*100)}%</span></div>
              <div className="w-full h-2.5 bg-red-100 rounded-full overflow-hidden"><div className="h-full bg-red-400 rounded-full" style={{ width: `${mcqStats.wrong/mcqStats.total*100}%` }} /></div>
            </div>
            <div className="w-20 h-20 shrink-0">
              <PieChart width={80} height={80}>
                <Pie data={[{value:mcqStats.correct},{value:mcqStats.wrong}]} cx={36} cy={36} innerRadius={22} outerRadius={38} dataKey="value" startAngle={90} endAngle={-270}>
                  <Cell fill="#22c55e" /><Cell fill="#f87171" />
                </Pie>
              </PieChart>
            </div>
          </div>
        </div>
      )}

      {/* Weak topics from class subjects */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <p className="text-sm font-black text-slate-800 flex items-center gap-2"><AlertTriangle size={15} className="text-red-500" /> Weak Topics</p>
          {classMistakes.length > 0 && <span className="text-[10px] bg-red-100 text-red-600 font-black px-2 py-0.5 rounded-full">{classMistakes.length} mistakes</span>}
        </div>
        <div className="px-4 py-3">
          {bySubject.length === 0
            ? <EmptyState emoji="🎉" msg="Class subjects mein koi weak topic nahi! Bahut achha!" />
            : <div className="space-y-2">{bySubject.slice(0,6).map(s => <MistakeSubjectCard key={s.subject} sub={s} />)}</div>
          }
        </div>
      </div>
    </div>
  );
}

function CompetitionTab({ log, mistakes }: { log: ScoreLogEntry[]; mistakes: MistakeEntry[] }) {
  // Competition mistakes only — board/classLevel tagged as COMPETITION in the mistake bank
  const compMistakes = useMemo(() =>
    mistakes.filter(m => m.board === 'COMPETITION' || m.classLevel === 'COMPETITION'),
  [mistakes]);

  // Competition-specific activity from score log
  // NOTE: MCQ_CORRECT/WRONG in score log are not tagged by subject/book,
  // so we only track what we CAN distinguish: Lucent GK TTS audio
  const compActivity = useMemo(() => {
    const today = getLocalDate(0);
    const gkAll    = log.filter(e => e.activity === 'NOTES_GK_TTS').length;
    const gkToday  = log.filter(e => e.date === today && e.activity === 'NOTES_GK_TTS').length;
    const audioAll = log.filter(e => e.activity === 'AUDIO_TTS').length;
    return { gkAll, gkToday, audioAll };
  }, [log]);

  // Subject-wise breakdown from mistake bank
  const bySubject = useMemo(() => {
    const map: Record<string, { subject: string; topics: string[]; count: number }> = {};
    compMistakes.forEach(m => {
      const sub = m.subjectName || 'Other';
      if (!map[sub]) map[sub] = { subject: sub, topics: [], count: 0 };
      if (m.topic && !map[sub].topics.includes(m.topic)) map[sub].topics.push(m.topic);
      map[sub].count++;
    });
    return Object.values(map).sort((a,b) => b.count - a.count);
  }, [compMistakes]);

  // Subject coverage from mistake bank — how many unique topics per book
  const bookCoverage = useMemo(() => {
    const books: Record<string, Set<string>> = {};
    compMistakes.forEach(m => {
      const book = m.chapterTitle || m.subjectName || 'Other';
      if (!books[book]) books[book] = new Set();
      if (m.topic) books[book].add(m.topic);
    });
    return Object.entries(books).map(([book, topics]) => ({ book, topicCount: topics.size, mistakeCount: compMistakes.filter(m => (m.chapterTitle || m.subjectName) === book).length })).sort((a,b) => b.mistakeCount - a.mistakeCount);
  }, [compMistakes]);

  return (
    <div className="space-y-4">
      <SectionHeader emoji="🏆" title="Competition Progress" subtitle="Speedy Science · Social · Sar Sangrah · Lucent" gradient="bg-gradient-to-r from-amber-500 to-orange-600" />

      {/* Mistake bank summary — only competition data */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-center">
          <p className="text-2xl font-black text-amber-700">{compMistakes.length}</p>
          <p className="text-[9px] font-bold text-amber-600">Competition Mistakes</p>
          <p className="text-[8px] text-amber-500 mt-0.5">(Mistake Bank se)</p>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-3 text-center">
          <p className="text-2xl font-black text-orange-700">{bySubject.length}</p>
          <p className="text-[9px] font-bold text-orange-600">Weak Subjects</p>
          <p className="text-[8px] text-orange-500 mt-0.5">(Jisme mistakes hain)</p>
        </div>
      </div>

      {/* Lucent GK Audio — only trackable competition activity */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <p className="text-sm font-black text-slate-800">🔊 Lucent GK Audio Activity</p>
          <p className="text-[9px] text-slate-400 mt-0.5">Competition ke liye GK sunna — yahi track hota hai score log mein</p>
        </div>
        <div className="px-4 py-3 grid grid-cols-2 gap-2">
          <StatCard icon="🎧" label="GK TTS Sessions (Total)" value={compActivity.gkAll > 0 ? String(compActivity.gkAll) : '—'} />
          <StatCard icon="📅" label="GK TTS Aaj"              value={compActivity.gkToday > 0 ? String(compActivity.gkToday) : '—'} />
          <StatCard icon="🔉" label="Audio Sessions (Total)"  value={compActivity.audioAll > 0 ? String(compActivity.audioAll) : '—'} />
        </div>
        {compActivity.gkAll === 0 && compActivity.audioAll === 0 && (
          <div className="px-4 pb-3">
            <p className="text-[10px] text-slate-400 text-center">GK Audio abhi use nahi kiya. Lucent GK section mein jaao aur suno! 🎧</p>
          </div>
        )}
      </div>

      {/* Competition tips */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4">
        <p className="text-sm font-black text-amber-800 mb-2">🏆 Competition Tips</p>
        <div className="space-y-1.5">
          {[
            'Roz 50+ competition MCQ practice karo',
            'Lucent GK TTS se roz suno',
            'Speedy Science ke weak topics dobara padhein',
            'Sar Sangrah current affairs daily',
            'Weak subjects ko zyada time do',
          ].map(tip => (
            <p key={tip} className="text-[11px] text-amber-700 font-medium">• {tip}</p>
          ))}
        </div>
      </div>

      {/* Subject-wise weak topics from mistake bank */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <p className="text-sm font-black text-slate-800 flex items-center gap-2">
            <AlertTriangle size={15} className="text-red-500" /> Competition Weak Topics
          </p>
          {compMistakes.length > 0 && (
            <span className="text-[10px] bg-red-100 text-red-600 font-black px-2 py-0.5 rounded-full">
              {compMistakes.length} mistakes
            </span>
          )}
        </div>
        <div className="px-4 py-3">
          {bySubject.length === 0
            ? <EmptyState emoji="💪" msg="Competition subjects mein koi mistake nahi abhi tak! MCQ practice karo." />
            : <div className="space-y-2">{bySubject.map(s => <MistakeSubjectCard key={s.subject} sub={s} />)}</div>
          }
        </div>
      </div>
    </div>
  );
}

// School tab shows school padhai activity (notes reading, writing, PDF, video)
// NOT revision hub data — that is in the dedicated Revision Hub tab
function SchoolTab({ log, mistakes, user }: { log: ScoreLogEntry[]; mistakes: MistakeEntry[]; user: any }) {
  // Class-specific activities from score log
  const activity = useMemo(() => {
    const today = getLocalDate(0);

    // Reading/notes activities — these are school notes/textbook sessions
    const notesReadAll   = log.filter(e => e.activity === 'READ_ACTIVE_30S').length;
    const notesTimeAll   = log.filter(e => e.activity === 'READ_NOTES_TIME').length;
    const writingAll     = log.filter(e => e.activity === 'WRITE_ACTIVE_5MIN').length;
    const ttsAll         = log.filter(e => e.activity === 'READ_TTS_HIGHLIGHT').length;
    const topicEngageAll = log.filter(e => e.activity === 'READ_MANUAL_TOPIC_10S').length;
    const videoAll       = log.filter(e => e.activity === 'VIDEO').length;
    const pdfAll         = log.filter(e => e.activity === 'PDF' || e.activity === 'PDF_MILESTONE').length;
    // AUDIO_TTS is NOT counted in School tab — it is ambiguous (could be GK/competition audio).
    // GK audio is tracked in Competition tab via NOTES_GK_TTS.

    const notesReadToday = log.filter(e => e.date === today && e.activity === 'READ_ACTIVE_30S').length;
    const videoToday     = log.filter(e => e.date === today && e.activity === 'VIDEO').length;
    const pdfToday       = log.filter(e => e.date === today && (e.activity === 'PDF' || e.activity === 'PDF_MILESTONE')).length;
    const writingToday   = log.filter(e => e.date === today && e.activity === 'WRITE_ACTIVE_5MIN').length;

    // XP from school study activities (exclude coaching, login, and ambiguous audio)
    const schoolXp = log
      .filter(e => ['READ_ACTIVE_30S','READ_NOTES_TIME','WRITE_ACTIVE_5MIN','READ_TTS_HIGHLIGHT',
                    'READ_MANUAL_TOPIC_10S','VIDEO','PDF','PDF_MILESTONE','MCQ_CORRECT','MCQ_WRONG',
                    'MCQ_STREAK_3','MCQ_STREAK_5','MILESTONE'].includes(e.activity))
      .reduce((s, e) => s + e.pts, 0);

    // 7-day reading sessions chart
    const last7 = [];
    for (let i = 6; i >= 0; i--) {
      const date = getLocalDate(-i);
      const dayLog = log.filter(e => e.date === date);
      const notes = dayLog.filter(e => ['READ_ACTIVE_30S','READ_NOTES_TIME','WRITE_ACTIVE_5MIN'].includes(e.activity)).length;
      const media = dayLog.filter(e => ['VIDEO','PDF','PDF_MILESTONE'].includes(e.activity)).length;
      const d = new Date(date + 'T00:00:00');
      const label = i === 0 ? 'Aaj' : i === 1 ? 'Kal' : d.toLocaleDateString('en-IN', { weekday: 'short' });
      last7.push({ date, label, notes, media });
    }

    return { notesReadAll, notesTimeAll, writingAll, ttsAll, topicEngageAll,
             videoAll, pdfAll, notesReadToday, videoToday, pdfToday, writingToday,
             schoolXp, last7 };
  }, [log]);

  // Class mistakes (non-competition only)
  const classMistakes = useMemo(() =>
    mistakes.filter(m => m.classLevel && m.classLevel !== 'COMPETITION' && m.board !== 'COMPETITION'),
  [mistakes]);

  const bySubject = useMemo(() => {
    const map: Record<string, { subject: string; topics: string[]; count: number }> = {};
    classMistakes.forEach(m => {
      const sub = m.subjectName || 'Other';
      if (!map[sub]) map[sub] = { subject: sub, topics: [], count: 0 };
      if (m.topic && !map[sub].topics.includes(m.topic)) map[sub].topics.push(m.topic);
      map[sub].count++;
    });
    return Object.values(map).sort((a,b) => b.count - a.count);
  }, [classMistakes]);

  const hasAnyActivity = activity.notesReadAll > 0 || activity.videoAll > 0 || activity.pdfAll > 0 || activity.writingAll > 0;

  return (
    <div className="space-y-4">
      <SectionHeader
        emoji="🏫"
        title={`School Padhai (${user?.board || 'Board'})`}
        subtitle="Notes · PDF · Video · Reading activity"
        gradient="bg-gradient-to-r from-emerald-600 to-teal-600"
      />

      {/* Aaj ki activity highlight */}
      {(activity.notesReadToday > 0 || activity.videoToday > 0 || activity.pdfToday > 0 || activity.writingToday > 0) && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3">
          <p className="text-[11px] font-black text-emerald-700 mb-1.5">✅ Aaj Padha</p>
          <div className="flex flex-wrap gap-2">
            {activity.notesReadToday > 0 && <span className="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded-full">📖 {activity.notesReadToday} Notes</span>}
            {activity.videoToday > 0     && <span className="text-[10px] bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full">🎥 {activity.videoToday} Video</span>}
            {activity.pdfToday > 0       && <span className="text-[10px] bg-violet-100 text-violet-700 font-bold px-2 py-0.5 rounded-full">📄 {activity.pdfToday} PDF</span>}
            {activity.writingToday > 0   && <span className="text-[10px] bg-teal-100 text-teal-700 font-bold px-2 py-0.5 rounded-full">✏️ {activity.writingToday} Writing</span>}
          </div>
        </div>
      )}

      {/* All-time activity stats — only school study activities */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <p className="text-sm font-black text-slate-800">📈 School Study Activity (All Time)</p>
          <p className="text-[9px] text-slate-400 mt-0.5">Sirf school padhai ki activity — coaching ka data yahan nahi</p>
        </div>
        <div className="px-4 py-3 grid grid-cols-2 gap-2">
          <StatCard icon="📖" label="Notes Padhne ke Sessions"   value={activity.notesReadAll > 0 ? String(activity.notesReadAll) : '—'} />
          <StatCard icon="🔊" label="TTS Listen Sessions"        value={activity.ttsAll > 0 ? String(activity.ttsAll) : '—'} />
          <StatCard icon="✏️" label="Notes Likhna (Writing)"     value={activity.writingAll > 0 ? String(activity.writingAll) : '—'} />
          <StatCard icon="🖱️" label="Topic Engage Sessions"      value={activity.topicEngageAll > 0 ? String(activity.topicEngageAll) : '—'} />
          <StatCard icon="🎥" label="Videos Dekhe"               value={activity.videoAll > 0 ? String(activity.videoAll) : '—'} />
          <StatCard icon="📄" label="PDFs Padhe"                 value={activity.pdfAll > 0 ? String(activity.pdfAll) : '—'} />
        </div>
        {!hasAnyActivity && (
          <div className="px-4 pb-4">
            <EmptyState emoji="📭" msg="School padhai abhi start nahi ki. Notes padhna aur videos dekhna shuru karo!" />
          </div>
        )}
      </div>

      {/* 7-day study chart */}
      {activity.last7.some(d => d.notes > 0 || d.media > 0) && (
        <div className="bg-white rounded-2xl p-4 border border-slate-100">
          <p className="text-sm font-black text-slate-800 mb-3 flex items-center gap-2">
            <BarChart2 size={15} className="text-emerald-500" /> Last 7 Days School Activity
          </p>
          <ResponsiveContainer width="100%" height={130}>
            <BarChart data={activity.last7} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#64748b', fontWeight: 700 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 8, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
              <Bar dataKey="notes" fill="#10b981" radius={[4,4,0,0]} name="Notes Sessions" />
              <Bar dataKey="media" fill="#3b82f6" radius={[4,4,0,0]} name="Video/PDF" />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-3 mt-1">
            <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-600"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" /> Notes</span>
            <span className="flex items-center gap-1 text-[9px] font-bold text-blue-600"><span className="w-2.5 h-2.5 rounded-sm bg-blue-500 inline-block" /> Video/PDF</span>
          </div>
        </div>
      )}

      {/* School subject weak topics from mistake bank */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <p className="text-sm font-black text-slate-800 flex items-center gap-2">
            <AlertTriangle size={15} className="text-red-500" /> School Weak Topics
          </p>
          {classMistakes.length > 0 && (
            <span className="text-[10px] bg-red-100 text-red-600 font-black px-2 py-0.5 rounded-full">
              {classMistakes.length} mistakes
            </span>
          )}
        </div>
        <div className="px-4 py-3">
          {bySubject.length === 0
            ? <EmptyState emoji="🎉" msg="School subjects mein koi weak topic nahi! Bahut achha!" />
            : <div className="space-y-2">{bySubject.map(s => <MistakeSubjectCard key={s.subject} sub={s} />)}</div>
          }
        </div>
      </div>

      {/* Reminder — Revision Hub is separate */}
      <div className="bg-violet-50 border border-violet-200 rounded-2xl px-4 py-3 flex items-center gap-3">
        <span className="text-2xl">🔄</span>
        <div>
          <p className="text-[11px] font-black text-violet-700">Revision Hub alag tab mein hai</p>
          <p className="text-[9px] text-violet-500 font-medium">MCQ topic tracking (Weak/Strong/Mastered) ke liye "Revision Hub" tab dekho</p>
        </div>
      </div>
    </div>
  );
}

function CoachingTab({ log }: { log: ScoreLogEntry[] }) {
  const stats = useMemo(() => {
    const today = getLocalDate(0);
    const mcqAll    = log.filter(e => e.activity === 'COACHING_HW_MCQ_CORRECT').length;
    const notesAll  = log.filter(e => e.activity === 'COACHING_HW_NOTES').length;
    const xpAll     = log.filter(e => e.activity === 'COACHING_HW_MCQ_CORRECT' || e.activity === 'COACHING_HW_NOTES').reduce((s, e) => s + e.pts, 0);
    const mcqToday  = log.filter(e => e.date === today && e.activity === 'COACHING_HW_MCQ_CORRECT').length;
    const notesToday= log.filter(e => e.date === today && e.activity === 'COACHING_HW_NOTES').length;
    const activeDays= new Set(log.filter(e => e.activity === 'COACHING_HW_MCQ_CORRECT' || e.activity === 'COACHING_HW_NOTES').map(e => e.date)).size;

    // 7-day daily breakdown
    const last7 = [];
    for (let i = 6; i >= 0; i--) {
      const date = getLocalDate(-i);
      const dayLog = log.filter(e => e.date === date);
      const mcq  = dayLog.filter(e => e.activity === 'COACHING_HW_MCQ_CORRECT').length;
      const notes= dayLog.filter(e => e.activity === 'COACHING_HW_NOTES').length;
      const d    = new Date(date + 'T00:00:00');
      const label= i === 0 ? 'Aaj' : i === 1 ? 'Kal' : d.toLocaleDateString('en-IN', { weekday: 'short' });
      last7.push({ date, label, mcq, notes });
    }
    return { mcqAll, notesAll, xpAll, mcqToday, notesToday, activeDays, last7 };
  }, [log]);

  const hasAny = stats.mcqAll > 0 || stats.notesAll > 0;

  return (
    <div className="space-y-4">
      <SectionHeader emoji="🎓" title="Coaching Homework Progress" subtitle="MCQ + Notes activity" gradient="bg-gradient-to-r from-teal-600 to-emerald-600" />

      {!hasAny ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-6">
          <EmptyState emoji="📭" msg="Abhi tak koi Coaching Homework attempt nahi kiya." />
        </div>
      ) : (
        <>
          {/* All-time stats */}
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100"><p className="text-sm font-black text-slate-800">📊 Coaching Stats (All Time)</p></div>
            <div className="px-4 py-3 grid grid-cols-2 gap-2">
              <StatCard icon="✅" label="MCQs Sahi"          value={stats.mcqAll > 0 ? String(stats.mcqAll) : '—'} />
              <StatCard icon="📖" label="Notes Sessions"     value={stats.notesAll > 0 ? String(stats.notesAll) : '—'} />
              <StatCard icon="⭐" label="XP Kamaya"          value={stats.xpAll > 0 ? `+${stats.xpAll}` : '—'} />
              <StatCard icon="📅" label="Active Days"        value={stats.activeDays > 0 ? String(stats.activeDays) : '—'} />
            </div>
          </div>

          {/* Today */}
          {(stats.mcqToday > 0 || stats.notesToday > 0) && (
            <div className="bg-teal-50 border border-teal-200 rounded-2xl px-4 py-3 flex items-center justify-between">
              <p className="text-[12px] font-black text-teal-700">📅 Aaj Ka</p>
              <div className="flex gap-4">
                <span className="text-[11px] font-bold text-teal-600">✅ {stats.mcqToday} MCQ Sahi</span>
                <span className="text-[11px] font-bold text-emerald-600">📖 {stats.notesToday} Notes</span>
              </div>
            </div>
          )}

          {/* 7-day chart */}
          <div className="bg-white rounded-2xl p-4 border border-slate-100">
            <p className="text-sm font-black text-slate-800 mb-3">📈 Last 7 Days</p>
            {stats.last7.some(d => d.mcq > 0 || d.notes > 0) ? (
              <>
                <ResponsiveContainer width="100%" height={130}>
                  <BarChart data={stats.last7} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                    <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#64748b', fontWeight: 700 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 8, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ fontSize: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                    <Bar dataKey="mcq"   fill="#10b981" radius={[4,4,0,0]} name="MCQ Sahi" />
                    <Bar dataKey="notes" fill="#8b5cf6" radius={[4,4,0,0]} name="Notes Sessions" />
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex gap-3 mt-1">
                  <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-600"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" /> MCQ Sahi</span>
                  <span className="flex items-center gap-1 text-[9px] font-bold text-violet-600"><span className="w-2.5 h-2.5 rounded-sm bg-violet-500 inline-block" /> Notes Sessions</span>
                </div>
              </>
            ) : <EmptyState emoji="📭" msg="Pichle 7 din mein koi coaching activity nahi." />}
          </div>
        </>
      )}
    </div>
  );
}

function RevisionTab({ rev }: { rev: any }) {
  const revDonut = [
    { name: 'Weak',     value: rev.tierCounts.weak,     fill: '#f87171' },
    { name: 'Average',  value: rev.tierCounts.average,  fill: '#fbbf24' },
    { name: 'Strong',   value: rev.tierCounts.strong,   fill: '#34d399' },
    { name: 'Mastered', value: rev.tierCounts.mastered, fill: '#818cf8' },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-4">
      <SectionHeader emoji="🔄" title="Revision Hub" subtitle="Spaced Repetition Tracking" gradient="bg-gradient-to-r from-violet-600 to-purple-600" />

      {rev.totalTracked === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-6">
          <EmptyState emoji="📭" msg="Abhi tak koi MCQ attempt nahi kiya. MCQ solve karo — Revision Hub track karega." />
        </div>
      ) : (
        <>
          {/* Tier summary */}
          <div className="grid grid-cols-4 gap-2">
            {(Object.entries(rev.tierCounts) as [keyof typeof TIER_META, number][]).map(([tier, count]) => {
              const m = TIER_META[tier];
              return (
                <div key={tier} className={`${m.bg} border ${m.border} rounded-2xl p-2.5 text-center`}>
                  <p className="text-xl">{m.emoji}</p>
                  <p className={`text-lg font-black ${m.text}`}>{count}</p>
                  <p className={`text-[9px] font-bold ${m.text}`}>{m.label}</p>
                </div>
              );
            })}
          </div>

          {/* Donut + stats */}
          <div className="bg-white rounded-2xl p-4 border border-slate-100">
            <div className="flex items-center gap-4">
              {revDonut.length > 0 && (
                <div className="w-24 h-24 shrink-0">
                  <PieChart width={96} height={96}>
                    <Pie data={revDonut} cx={44} cy={44} innerRadius={28} outerRadius={44} dataKey="value" startAngle={90} endAngle={-270}>
                      {revDonut.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Pie>
                  </PieChart>
                </div>
              )}
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between text-[11px]"><span className="font-medium text-slate-600">Total topics tracked</span><span className="font-black text-slate-800">{rev.totalTracked}</span></div>
                <div className="flex items-center justify-between text-[11px]"><span className="font-medium text-slate-600">Aaj due hain</span><span className={`font-black ${rev.dueCount > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{rev.dueCount > 0 ? `${rev.dueCount} topics` : '✓ Sab done'}</span></div>
                <div className="flex items-center justify-between text-[11px]"><span className="font-medium text-slate-600">Aaj complete kiye</span><span className="font-black text-violet-600">{rev.completedToday}</span></div>
              </div>
            </div>
          </div>

          {/* Due today */}
          {rev.dueCount > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
              <p className="text-[12px] font-black text-red-700 mb-3">⏰ Aaj Revision Baaki ({rev.dueCount})</p>
              <div className="space-y-2">
                {rev.due.map((b: any, i: number) => {
                  const m = TIER_META[b.lastTier || 'weak'];
                  return (
                    <div key={i} className="flex items-center gap-2 bg-white rounded-xl px-3 py-2">
                      <span className="text-sm">{m.emoji}</span>
                      <div className="flex-1 min-w-0"><p className="text-[11px] font-bold text-slate-700 truncate">{b.topic}</p><p className="text-[9px] text-slate-400 truncate">{b.chapterTitle || b.chapterId}</p></div>
                      <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full ${m.pill}`}>{m.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* All subjects breakdown */}
          {rev.subjectRows.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100"><p className="text-sm font-black text-slate-800">📋 Subject-wise Breakdown</p></div>
              <div className="px-4 py-3 space-y-3">
                {rev.subjectRows.map((row: any) => {
                  const total = row.total || 1;
                  const mastPct = Math.round(row.mastered / total * 100);
                  return (
                    <div key={row.name} className="bg-slate-50 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-[11px] font-black text-slate-800 truncate max-w-[55%]">{row.name}</p>
                        <span className="text-[9px] font-bold text-slate-500">{row.total} topics · {mastPct}% mastered</span>
                      </div>
                      <div className="flex gap-0.5 h-2.5 rounded-full overflow-hidden mb-1">
                        {row.weak     > 0 && <div className="bg-red-400"     style={{ width: `${row.weak/total*100}%` }} />}
                        {row.average  > 0 && <div className="bg-amber-400"   style={{ width: `${row.average/total*100}%` }} />}
                        {row.strong   > 0 && <div className="bg-emerald-400" style={{ width: `${row.strong/total*100}%` }} />}
                        {row.mastered > 0 && <div className="bg-indigo-400"  style={{ width: `${row.mastered/total*100}%` }} />}
                      </div>
                      <div className="flex gap-2">
                        {row.weak     > 0 && <span className="text-[8px] text-red-500 font-bold">🔴{row.weak}W</span>}
                        {row.average  > 0 && <span className="text-[8px] text-amber-600 font-bold">🟡{row.average}A</span>}
                        {row.strong   > 0 && <span className="text-[8px] text-emerald-600 font-bold">🟢{row.strong}S</span>}
                        {row.mastered > 0 && <span className="text-[8px] text-indigo-600 font-bold">⭐{row.mastered}M</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MistakesTab({ mistakes }: { mistakes: MistakeEntry[] }) {
  const [filter, setFilter] = useState<'all' | 'class' | 'competition'>('all');

  const filtered = useMemo(() => {
    if (filter === 'class')       return mistakes.filter(m => m.classLevel && m.board !== 'COMPETITION');
    if (filter === 'competition') return mistakes.filter(m => m.board === 'COMPETITION' || m.classLevel === 'COMPETITION');
    return mistakes;
  }, [mistakes, filter]);

  const bySubject = useMemo(() => {
    const map: Record<string, { subject: string; topics: string[]; count: number; source?: string; classLevel?: string }> = {};
    filtered.forEach(m => {
      const sub = m.subjectName || 'Other';
      if (!map[sub]) map[sub] = { subject: sub, topics: [], count: 0, source: m.board || m.classLevel ? `${m.classLevel || ''}${m.board ? ' · '+m.board : ''}`.trim() : undefined };
      if (m.topic && !map[sub].topics.includes(m.topic)) map[sub].topics.push(m.topic);
      map[sub].count++;
    });
    return Object.values(map).sort((a,b) => b.count - a.count);
  }, [filtered]);

  const recent = useMemo(() => [...mistakes].sort((a,b) => b.addedAt - a.addedAt).slice(0, 5), [mistakes]);

  return (
    <div className="space-y-4">
      <SectionHeader emoji="❌" title="My Mistakes Bank" subtitle="Galat jawab dobara practice karo" gradient="bg-gradient-to-r from-red-500 to-rose-600" />

      {/* Summary */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-3 text-center">
          <p className="text-xl font-black text-red-600">{mistakes.length}</p>
          <p className="text-[9px] font-bold text-red-500">Total Mistakes</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-center">
          <p className="text-xl font-black text-amber-600">{mistakes.filter(m => m.board !== 'COMPETITION').length}</p>
          <p className="text-[9px] font-bold text-amber-500">Class Mistakes</p>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-3 text-center">
          <p className="text-xl font-black text-orange-600">{mistakes.filter(m => m.board === 'COMPETITION' || m.classLevel === 'COMPETITION').length}</p>
          <p className="text-[9px] font-bold text-orange-500">Comp. Mistakes</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(['all','class','competition'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`flex-1 py-2 rounded-xl text-[11px] font-black transition-all ${filter === f ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
            {f === 'all' ? '🔍 Sab' : f === 'class' ? '📚 Class' : '🏆 Competition'}
          </button>
        ))}
      </div>

      {mistakes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-6">
          <EmptyState emoji="🎉" msg="Abhi tak koi mistake save nahi hui. MCQ solve karo!" />
        </div>
      ) : (
        <>
          {/* By subject */}
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <p className="text-sm font-black text-slate-800">📋 Subject-wise ({filtered.length} mistakes)</p>
            </div>
            {bySubject.length === 0
              ? <div className="px-4 py-4"><EmptyState emoji="✅" msg="Is filter mein koi mistake nahi." /></div>
              : <div className="px-4 py-3 space-y-2">{bySubject.map(s => <MistakeSubjectCard key={s.subject} sub={s} />)}</div>
            }
          </div>

          {/* Recent mistakes */}
          {recent.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100"><p className="text-sm font-black text-slate-800">🕐 Recent Mistakes</p></div>
              <div className="px-4 py-3 space-y-2">
                {recent.map((m, i) => (
                  <div key={m.id || i} className="bg-red-50 rounded-xl p-3">
                    <p className="text-[11px] font-bold text-slate-800 leading-snug line-clamp-2">{m.question}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      {m.subjectName && <span className="text-[9px] bg-red-100 text-red-600 font-bold px-1.5 py-0.5 rounded-full">{m.subjectName}</span>}
                      {m.topic && <span className="text-[9px] text-slate-400 font-medium truncate">{m.topic}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export const StudentProgressDashboard: React.FC<Props> = ({ user, onBack }) => {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [log, setLog]             = useState<ScoreLogEntry[]>([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    const local = getScoreLog(user?.id || '');
    setLog(local);
    setLoading(false);
    if (user?.id) {
      getScoreLogFromFirebase(user.id).then(remote => {
        if (remote.length > local.length) setLog(remote);
      }).catch(() => {});
    }
  }, [user?.id]);

  const mistakes = useMemo(() => getMistakeBankSync(), []);
  const rev      = useMemo(() => getRevisionStats(), []);

  const activeTabMeta = TABS.find(t => t.id === activeTab)!;

  return (
    <div className="fixed inset-0 z-[300] bg-slate-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-4 pt-safe-top pb-3 shrink-0">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={onBack} className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center active:scale-90 transition-all">
            <ChevronLeft size={20} className="text-slate-700" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-black text-slate-900 truncate">📊 Mera Progress</h1>
            <p className="text-[10px] text-slate-500 font-medium">{activeTabMeta.emoji} {activeTabMeta.label}</p>
          </div>
          {loading && <RefreshCw size={16} className="text-slate-400 animate-spin" />}
        </div>

        {/* Tab bar */}
        <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-none" style={{ scrollbarWidth: 'none' }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black transition-all ${activeTab === tab.id ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600'}`}
            >
              <span>{tab.emoji}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-8">
        <div className="px-4 py-4">
          {activeTab === 'overview'    && <OverviewTab    user={user} log={log} rev={rev} />}
          {activeTab === 'class'       && <ClassTab       log={log}  mistakes={mistakes} user={user} />}
          {activeTab === 'competition' && <CompetitionTab log={log}  mistakes={mistakes} />}
          {activeTab === 'school'      && <SchoolTab      log={log} mistakes={mistakes} user={user} />}
          {activeTab === 'coaching'    && <CoachingTab    log={log} />}
          {activeTab === 'revision'    && <RevisionTab    rev={rev} />}
          {activeTab === 'mistakes'    && <MistakesTab    mistakes={mistakes} />}
        </div>
      </div>
    </div>
  );
};
