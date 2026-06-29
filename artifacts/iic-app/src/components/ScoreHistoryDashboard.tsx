// @ts-nocheck
import React, { useState, useMemo, useEffect, useRef } from "react";
import { ChevronLeft, ChevronDown, ChevronUp, TrendingUp, Award, Calendar, Zap, ArrowUp, ArrowDown, Minus, Clock } from "lucide-react";
import { getScoreLog, ScoreLogEntry, getDailyScoreEarned, getDailyScoreLimit } from "../utils/scoreSystem";
import { getLevelInfo, getNextLevelInfo } from "../utils/levelSystem";
import { getScoreLogFromFirebase, saveScoreLogToFirebase } from "../firebase";

interface Props {
  user: { id: string; totalScore?: number; subscriptionLevel?: string; isPremium?: boolean };
  onBack: () => void;
}

const ACTIVITY_META: Record<string, { emoji: string; label: string; sublabel: string; color: string; bg: string }> = {
  MCQ_CORRECT:        { emoji: '✅', label: 'MCQ Correct Answer',    sublabel: 'Reward for correct answer (+2 base)',         color: '#22c55e', bg: 'rgba(34,197,94,0.12)'   },
  MCQ_WRONG:          { emoji: '📝', label: 'MCQ Attempt',           sublabel: 'Reward for trying even if wrong (+1)',        color: '#60a5fa', bg: 'rgba(96,165,250,0.12)'  },
  MCQ_STREAK_3:       { emoji: '🔥', label: 'Streak Bonus 3×',       sublabel: '3 correct in a row bonus (+5)',              color: '#fb923c', bg: 'rgba(251,146,60,0.12)'  },
  MCQ_STREAK_5:       { emoji: '⚡', label: 'Streak Bonus 5×',       sublabel: '5 correct in a row bonus (+10)',             color: '#fbbf24', bg: 'rgba(251,191,36,0.12)'  },
  READ_TTS_HIGHLIGHT:     { emoji: '🎙️', label: 'Notes TTS Read',        sublabel: '1 topic read via TTS (+1)',                  color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  READ_ACTIVE_30S:        { emoji: '📖', label: 'Notes Reading Reward',  sublabel: 'Continuous 30 sec read (+5 base)',           color: '#38bdf8', bg: 'rgba(56,189,248,0.12)'  },
  READ_MANUAL_TOPIC_10S:  { emoji: '👆', label: 'Topic Engage Reward',   sublabel: '10 sec ek topic pe rukne ka reward (+2)',    color: '#fb923c', bg: 'rgba(251,146,60,0.12)'  },
  WRITE_ACTIVE_5MIN:      { emoji: '✍️', label: 'Notes Writing Reward',  sublabel: '5 min active writing (+25 base)',            color: '#34d399', bg: 'rgba(52,211,153,0.12)'  },
  PDF_MILESTONE:      { emoji: '📄', label: 'PDF Progress Reward',   sublabel: 'PDF 25/50/75/100% complete milestone',       color: '#f472b6', bg: 'rgba(244,114,182,0.12)' },
  READ_NOTES_TIME:    { emoji: '📚', label: 'Notes Reading Time',    sublabel: 'Continuous 30 sec notes read (+5 base)',     color: '#818cf8', bg: 'rgba(129,140,248,0.12)' },
  AUDIO_TTS:          { emoji: '🎵', label: 'Audio Listened',        sublabel: 'Audio/TTS content (30 sec = +5)',            color: '#34d399', bg: 'rgba(52,211,153,0.12)'  },
  NOTES_GK_TTS:       { emoji: '🎧', label: 'GK TTS Read',           sublabel: 'Lucent GK text-to-speech milestone',         color: '#f472b6', bg: 'rgba(244,114,182,0.12)' },
  VIDEO:              { emoji: '📹', label: 'Video Watched',          sublabel: 'Video content reward (30 sec = +5)',         color: '#3b82f6', bg: 'rgba(59,130,246,0.12)'  },
  PDF:                { emoji: '📄', label: 'PDF Read',               sublabel: 'PDF content reading milestone',             color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)'  },
  MILESTONE:          { emoji: '🏅', label: 'Progress Milestone',    sublabel: 'Content progress milestone reward',          color: '#06b6d4', bg: 'rgba(6,182,212,0.12)'   },
  DAILY_LOGIN:        { emoji: '🌅', label: 'Daily Login',           sublabel: 'Bonus for logging in every day',            color: '#10b981', bg: 'rgba(16,185,129,0.12)'  },
  CREDIT_SPEND:       { emoji: '💎', label: 'Credit Invest Bonus',   sublabel: 'Bonus score for using credits', color: '#eab308', bg: 'rgba(234,179,8,0.12)'   },
  REDEEM_CODE:        { emoji: '🎟️', label: 'Redeem Code',          sublabel: 'Code redeem reward',                         color: '#ec4899', bg: 'rgba(236,72,153,0.12)'  },
  SUBSCRIPTION:       { emoji: '👑', label: 'Subscription Bonus',    sublabel: 'Premium subscription bonus',                color: '#f59e0b', bg: 'rgba(245,158,11,0.12)'  },
  OTHER:              { emoji: '⭐', label: 'Other Activity',        sublabel: 'Other activity',                            color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
};

const getMeta = (activity: string) => ACTIVITY_META[activity] ?? ACTIVITY_META['OTHER'];
const fmt = (n: number) => n.toLocaleString('en-IN');

/** Local timezone YYYY-MM-DD — avoids UTC rollover at 5:30 AM IST */
const getLocalDate = (offsetDays = 0): string => {
  const d = new Date();
  if (offsetDays) d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr + 'T00:00:00');
  const today = getLocalDate();
  const yesterday = getLocalDate(-1);
  if (dateStr === today) return 'Aaj';
  if (dateStr === yesterday) return 'Kal';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', weekday: 'short' });
};

const getWeekRange = (weeksAgo: number) => {
  const days: string[] = [];
  const startOffset = -(weeksAgo + 1) * 7;
  for (let i = 0; i < 7; i++) {
    days.push(getLocalDate(startOffset + i));
  }
  return days;
};

const getMidnightCountdown = (): string => {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const diff = Math.max(0, midnight.getTime() - now.getTime());
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${h}h ${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`;
};

export const ScoreHistoryDashboard: React.FC<Props> = ({ user, onBack }) => {
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set(['today']));
  const [touchedBarIdx, setTouchedBarIdx] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(getMidnightCountdown());
  const [showAllActivities, setShowAllActivities] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const dayRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // log as state so Firebase sync can update it
  const [log, setLog] = useState<ScoreLogEntry[]>(() => getScoreLog(user.id));

  useEffect(() => {
    const t = setInterval(() => setCountdown(getMidnightCountdown()), 1000);
    return () => clearInterval(t);
  }, []);

  // On mount: load from Firebase, merge with localStorage, save unified log back
  useEffect(() => {
    if (!user.id) return;
    setSyncing(true);
    getScoreLogFromFirebase(user.id).then(fbLog => {
      const local = getScoreLog(user.id);
      // Merge: union by (date + ts + activity), keep all unique entries
      const seen = new Set<string>();
      const merged: ScoreLogEntry[] = [];
      for (const e of [...fbLog, ...local]) {
        const key = `${e.date}_${e.ts}_${e.activity}`;
        if (!seen.has(key)) { seen.add(key); merged.push(e); }
      }
      merged.sort((a, b) => a.ts - b.ts);
      // Prune to 30 days
      const cutoff = (() => {
        const d = new Date(); d.setDate(d.getDate() - 30);
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      })();
      const pruned = merged.filter(e => e.date >= cutoff).slice(-900);
      // Save merged back to localStorage + Firebase
      try { localStorage.setItem(`nst_score_log_${user.id}`, JSON.stringify(pruned)); } catch {}
      saveScoreLogToFirebase(user.id, pruned).catch(() => {});
      setLog(pruned);
    }).catch(() => {}).finally(() => setSyncing(false));
  }, [user.id]);

  const today = getLocalDate();
  const todayKey = today;

  const dayMap = useMemo(() => {
    const m: Record<string, { total: number; entries: ScoreLogEntry[]; activities: Record<string, number> }> = {};
    for (const e of log) {
      if (!m[e.date]) m[e.date] = { total: 0, entries: [], activities: {} };
      m[e.date].total += e.pts;
      m[e.date].entries.push(e);
      m[e.date].activities[e.activity] = (m[e.date].activities[e.activity] || 0) + e.pts;
    }
    return m;
  }, [log]);

  const sortedDays = useMemo(() =>
    Object.keys(dayMap).sort((a, b) => b.localeCompare(a)).slice(0, 30),
  [dayMap]);

  const chartDays = useMemo(() => {
    // Always show last 14 days (even if 0 pts) + any extra days with data
    const datesSet = new Set<string>();
    for (let i = 13; i >= 0; i--) datesSet.add(getLocalDate(-i));
    sortedDays.forEach(d => datesSet.add(d));
    return [...datesSet]
      .sort((a, b) => a.localeCompare(b))
      .map(date => ({ date, pts: dayMap[date]?.total ?? 0 }));
  }, [sortedDays, dayMap]);

  const maxChartPts = Math.max(...chartDays.map(d => d.pts), 1);

  const thisWeekDays  = useMemo(() => getWeekRange(0), []);
  const lastWeekDays  = useMemo(() => getWeekRange(1), []);

  const thisWeekTotal = useMemo(() => thisWeekDays.reduce((t, d) => t + (dayMap[d]?.total ?? 0), 0), [dayMap, thisWeekDays]);
  const lastWeekTotal = useMemo(() => lastWeekDays.reduce((t, d) => t + (dayMap[d]?.total ?? 0), 0), [dayMap, lastWeekDays]);

  const growthPercent = lastWeekTotal === 0
    ? (thisWeekTotal > 0 ? 100 : 0)
    : Math.round(((thisWeekTotal - lastWeekTotal) / lastWeekTotal) * 100);

  const bestDay = useMemo(() => {
    let best = { date: '', pts: 0 };
    for (const [date, data] of Object.entries(dayMap)) {
      if (data.total > best.pts) best = { date, pts: data.total };
    }
    return best;
  }, [dayMap]);

  const topActivity = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const e of log) totals[e.activity] = (totals[e.activity] || 0) + e.pts;
    let top = { activity: '', pts: 0 };
    for (const [a, p] of Object.entries(totals)) if (p > top.pts) top = { activity: a, pts: p };
    return top;
  }, [log]);

  const currentLevel = getLevelInfo(user.totalScore || 0);
  const nextLevel    = getNextLevelInfo(user.totalScore || 0);
  const score        = user.totalScore || 0;

  const levelProgress = (() => {
    if (!nextLevel) return 100;
    const range  = nextLevel.minScore - currentLevel.minScore;
    const gained = score - currentLevel.minScore;
    return Math.min(100, Math.max(0, Math.round((gained / range) * 100)));
  })();

  const ptsToNext = nextLevel ? Math.max(0, nextLevel.minScore - score) : 0;

  const toggleDay = (date: string) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date); else next.add(date);
      return next;
    });
  };

  // Chart bar tap → expand that day and scroll to it
  const handleBarTap = (i: number) => {
    const date = chartDays[i].date;
    setTouchedBarIdx(prev => prev === i ? null : i);
    if (dayMap[date]) {
      setExpandedDays(prev => {
        const next = new Set(prev);
        next.add(date);
        return next;
      });
      setTimeout(() => {
        dayRefs.current[date]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  };

  const noData = log.length === 0;

  const ALL_SCORE_ROWS = [
    { emoji:'✅', act:'MCQ Correct Answer',        base:'+2',        note:'Correct answer gives +2 base. Free=2×, Basic=2.4×, Ultra=3× pts.' },
    { emoji:'📝', act:'MCQ Attempt (even wrong)',  base:'+1',        note:'Wrong attempts are also rewarded for effort.' },
    { emoji:'🔥', act:'3 MCQ Streak Bonus',        base:'+5',        note:'Bonus for every 3 correct answers in a row.' },
    { emoji:'⚡', act:'5 MCQ Streak Bonus',        base:'+10',       note:'Bigger bonus for every 5 correct answers in a row.' },
    { emoji:'🎙️', act:'TTS Topic Read',            base:'+1',        note:'For every topic listened to via speaker.' },
    { emoji:'📖', act:'Notes Reading (30 sec)',    base:'+5',        note:'Reward for every 30 sec of active reading.' },
    { emoji:'✍️', act:'Notes Writing (5 min)',     base:'+25',       note:'Every 5 min of active writing = +25.' },
    { emoji:'📄', act:'PDF Progress Milestones',  base:'+5 to +25', note:'25%=+5, 50%=+10, 75%=+15, 100%=+25.' },
    { emoji:'📹', act:'Video Watch (30 sec)',      base:'+5',        note:'Reward for every 30 sec of video watched.' },
    { emoji:'🎵', act:'Audio Listen (30 sec)',     base:'+5',        note:'Reward for every 30 sec of audio/TTS content.' },
    { emoji:'🌅', act:'Daily Login',              base:'+5',        note:'Bonus for logging in every day.' },
    { emoji:'💎', act:'Credit Invest Bonus',      base:'variable',  note:'Score bonus for using/investing credits.' },
    { emoji:'🎟️', act:'Redeem Code',              base:'variable',  note:'Special bonus for redeeming a code.' },
  ];

  const visibleRows = showAllActivities ? ALL_SCORE_ROWS : ALL_SCORE_ROWS.slice(0, 6);

  return (
    <div className="min-h-screen" style={{ background: '#0a0a12', color: '#e2e8f0' }}>
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3.5 border-b"
        style={{ background: 'rgba(10,10,18,0.95)', backdropFilter: 'blur(12px)', borderColor: 'rgba(255,255,255,0.08)' }}>
        <button onClick={onBack}
          className="w-9 h-9 rounded-xl flex items-center justify-center active:scale-90 transition-all shrink-0"
          style={{ background: 'rgba(255,255,255,0.07)' }}>
          <ChevronLeft size={18} color="#94a3b8" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-black text-white text-base leading-none">📊 Score History</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Tera score ka full record</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-slate-500">Level</p>
          <p className="text-sm font-black" style={{ color: currentLevel.color }}>{currentLevel.emoji} L{currentLevel.level}</p>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4 pb-20">

        {/* ── DAILY LIMIT + MIDNIGHT COUNTDOWN ── */}
        {(() => {
          const earned    = getDailyScoreEarned(user.id);
          const limit     = getDailyScoreLimit(user.subscriptionLevel, user.isPremium, (user as any).scoreLimitBoostPercent, (user as any).scoreLimitBoostExpiry);
          const pct       = Math.min(100, Math.round((earned / limit) * 100));
          const remaining = Math.max(0, limit - earned);
          const tierLabel = user.isPremium
            ? (user.subscriptionLevel === 'ULTRA' ? '⚡ Ultra' : '🔵 Basic')
            : '🔓 Free';
          return (
            <div className="rounded-2xl p-4" style={{ background: 'linear-gradient(135deg,rgba(124,58,237,0.18),rgba(30,27,75,0.35))', border: '1px solid rgba(124,58,237,0.3)' }}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-violet-400 mb-0.5">Aaj Ka Daily Score</p>
                  <p className="text-2xl font-black text-white leading-none">
                    {fmt(earned)} <span className="text-base font-normal text-slate-400">/ {fmt(limit)}</span>
                  </p>
                  <p className="text-[9px] text-slate-500 mt-0.5">{tierLabel} · {remaining > 0 ? `${fmt(remaining)} pts baki` : '🎉 Aaj ka limit pura!'}</p>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className="text-[8px] text-slate-600 uppercase tracking-widest mb-0.5">Reset hoga</p>
                  <div className="flex items-center gap-1 justify-end">
                    <Clock size={10} color="#f87171" />
                    <p className="text-[11px] font-black text-rose-400">{countdown}</p>
                  </div>
                  <p className="text-[8px] text-slate-600 mt-0.5">Raat 12:00 baje</p>
                </div>
              </div>
              <div className="h-2.5 rounded-full overflow-hidden mb-1.5" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, background: pct >= 100 ? 'linear-gradient(90deg,#fbbf24,#f59e0b)' : 'linear-gradient(90deg,#7c3aed,#a78bfa)' }} />
              </div>
              <p className="text-[9px] text-slate-500">{pct}% complete · daily limit raat 12 baje reset hoga</p>
            </div>
          );
        })()}

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: <Calendar size={14} />, label: 'Is Hafte',     value: `+${fmt(thisWeekTotal)} pts`, color: '#3b82f6' },
            { icon: <Award   size={14} />,  label: 'Best Din',      value: bestDay.pts > 0 ? `+${fmt(bestDay.pts)} pts` : '—', color: '#f59e0b' },
            { icon: <TrendingUp size={14}/>,label: 'Kul (Logged)',  value: `+${fmt(log.reduce((s,e)=>s+e.pts,0))} pts`, color: '#10b981' },
          ].map(s => (
            <div key={s.label} className="rounded-2xl p-3 text-center"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex justify-center mb-1.5" style={{ color: s.color }}>{s.icon}</div>
              <p className="text-[9px] text-slate-500 uppercase tracking-wider">{s.label}</p>
              <p className="text-[11px] font-black text-white mt-0.5 leading-tight">{s.value}</p>
            </div>
          ))}
        </div>

        {/* ── Weekly Summary ── */}
        <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-2 px-4 pt-4 pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <Zap size={13} color="#a855f7" />
            <p className="text-[10px] font-black text-white uppercase tracking-wider">Weekly Summary</p>
          </div>
          <div className="grid grid-cols-3 divide-x" style={{ divideColor: 'rgba(255,255,255,0.06)' }}>
            <div className="p-3 text-center" style={{ borderRight: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-[9px] text-slate-500 mb-1">This Week</p>
              <p className="text-base font-black text-white">+{fmt(thisWeekTotal)}</p>
              <p className="text-[9px] text-slate-600">pts</p>
            </div>
            <div className="p-3 text-center" style={{ borderRight: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-[9px] text-slate-500 mb-1">Last Week</p>
              <p className="text-base font-black text-white">+{fmt(lastWeekTotal)}</p>
              <p className="text-[9px] text-slate-600">pts</p>
            </div>
            <div className="p-3 text-center">
              <p className="text-[9px] text-slate-500 mb-1">Growth</p>
              <div className="flex items-center justify-center gap-1">
                {growthPercent > 0
                  ? <ArrowUp size={12} color="#22c55e" />
                  : growthPercent < 0
                    ? <ArrowDown size={12} color="#f87171" />
                    : <Minus size={12} color="#64748b" />}
                <p className="text-base font-black"
                  style={{ color: growthPercent > 0 ? '#22c55e' : growthPercent < 0 ? '#f87171' : '#64748b' }}>
                  {Math.abs(growthPercent)}%
                </p>
              </div>
              <p className="text-[9px] text-slate-600">vs last week</p>
            </div>
          </div>
        </div>

        {/* ── Level Progress Card ── */}
        <div className="rounded-2xl p-4 relative overflow-hidden"
          style={{ background: `${currentLevel.color}0d`, border: `1.5px solid ${currentLevel.color}30` }}>
          <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full pointer-events-none"
            style={{ background: `${currentLevel.color}10`, filter: 'blur(24px)' }} />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">{currentLevel.emoji}</span>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-wider" style={{ color: currentLevel.color }}>Current Level</p>
                  <p className="font-black text-white text-sm">{currentLevel.label} · L{currentLevel.level}</p>
                </div>
              </div>
              {nextLevel && (
                <div className="text-right">
                  <p className="text-[9px] text-slate-500">Next Level</p>
                  <p className="font-black text-sm" style={{ color: nextLevel.color }}>{nextLevel.emoji} L{nextLevel.level}</p>
                </div>
              )}
            </div>
            {nextLevel ? (
              <>
                <div className="w-full rounded-full h-2.5 mb-2" style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <div className="h-2.5 rounded-full transition-all duration-500"
                    style={{ width: `${levelProgress}%`, background: `linear-gradient(90deg, ${currentLevel.color}, ${nextLevel.color})` }} />
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-[10px] font-black" style={{ color: currentLevel.color }}>
                    {fmt(score - currentLevel.minScore)} / {fmt(nextLevel.minScore - currentLevel.minScore)} pts
                  </p>
                  <p className="text-[10px] font-bold text-slate-400">
                    <span style={{ color: '#f87171' }}>{fmt(ptsToNext)} pts</span> remaining
                  </p>
                </div>
              </>
            ) : (
              <div className="text-center py-1">
                <p className="text-[11px] font-black" style={{ color: currentLevel.color }}>🏆 Max Level Reached!</p>
              </div>
            )}
          </div>
        </div>

        {/* Top Activity */}
        {topActivity.activity && (
          <div className="rounded-2xl p-3 flex items-center gap-3"
            style={{ background: getMeta(topActivity.activity).bg, border: `1px solid ${getMeta(topActivity.activity).color}30` }}>
            <span className="text-xl shrink-0">{getMeta(topActivity.activity).emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-slate-400">Sabse zyada score kahan se mila</p>
              <p className="text-sm font-black text-white">{getMeta(topActivity.activity).label}</p>
            </div>
            <div className="text-right">
              <p className="text-[9px] text-slate-500">Total</p>
              <p className="text-sm font-black" style={{ color: getMeta(topActivity.activity).color }}>+{fmt(topActivity.pts)} pts</p>
            </div>
          </div>
        )}

        {/* ── Bar Chart — all days with data (up to 30 days) ── */}
        <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-2 mb-1">
            <Zap size={12} color="#fbbf24" />
            <p className="text-[10px] font-black text-white uppercase tracking-wider">Score History</p>
            {touchedBarIdx !== null && (
              <span className="ml-auto text-[10px] font-black px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}>
                {new Date(chartDays[touchedBarIdx].date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                {' · '}+{fmt(chartDays[touchedBarIdx].pts)} pts
              </span>
            )}
          </div>
          {touchedBarIdx !== null && dayMap[chartDays[touchedBarIdx].date] && (
            <p className="text-[9px] text-amber-400 mb-2 pl-1">↓ See that day's details below</p>
          )}
          {touchedBarIdx !== null && !dayMap[chartDays[touchedBarIdx].date] && (
            <p className="text-[9px] text-slate-600 mb-2 pl-1">No activity on this day</p>
          )}
          <div className="flex items-end gap-1 h-20">
            {chartDays.map((d, i) => {
              const h = d.pts > 0 ? Math.max(4, Math.round((d.pts / maxChartPts) * 72)) : 2;
              const isToday   = d.date === today;
              const isTouched = touchedBarIdx === i;
              const dayLabel  = new Date(d.date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric' });
              return (
                <div key={d.date}
                  className="flex flex-col items-center flex-1 gap-1 cursor-pointer relative"
                  onClick={() => handleBarTap(i)}>
                  {isTouched && d.pts > 0 && (
                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap text-[8px] font-black px-1.5 py-0.5 rounded-md z-10"
                      style={{ background: '#fbbf24', color: '#000' }}>
                      +{fmt(d.pts)}
                    </div>
                  )}
                  <div className="w-full rounded-t-sm transition-all"
                    style={{
                      height: `${h}px`,
                      background: isTouched
                        ? 'linear-gradient(180deg, #fbbf24, #f59e0b)'
                        : isToday
                          ? 'linear-gradient(180deg, #fbbf24, #f59e0b)'
                          : d.pts > 0
                            ? 'linear-gradient(180deg, #3b82f6aa, #1d4ed8aa)'
                            : 'rgba(255,255,255,0.06)',
                      boxShadow: isTouched ? '0 0 8px rgba(251,191,36,0.6)' : undefined,
                    }} />
                  <p className="text-[7px] leading-none"
                    style={{ color: isToday || isTouched ? '#fbbf24' : '#475569' }}>{dayLabel}</p>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-1">
            <p className="text-[8px] text-slate-600">
              {chartDays.length > 1
                ? new Date(chartDays[0].date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                : 'Pehla Din'}
            </p>
            <p className="text-[8px] text-amber-500">Aaj · tap = us din ka detail</p>
          </div>
        </div>

        {/* ── Day-by-day List ── */}
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 px-1">Din Ka Hisab</p>

          {noData ? (
            <div className="rounded-2xl p-8 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <p className="text-3xl mb-2">📊</p>
              <p className="font-black text-white text-sm">No data yet</p>
              <p className="text-[11px] text-slate-500 mt-1">Attempt MCQs, watch videos, login — your history will appear here!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sortedDays.map(date => {
                const data = dayMap[date];
                const isExpanded = expandedDays.has(date);
                const isToday = date === todayKey;
                const isHighlighted = touchedBarIdx !== null && chartDays[touchedBarIdx]?.date === date;

                const activityGroups = Object.entries(data.activities)
                  .sort((a, b) => b[1] - a[1]);

                return (
                  <div
                    key={date}
                    ref={el => { dayRefs.current[date] = el; }}
                    className="rounded-2xl overflow-hidden transition-all"
                    style={{
                      background: isHighlighted
                        ? 'rgba(251,191,36,0.08)'
                        : isToday
                          ? 'rgba(251,191,36,0.05)'
                          : 'rgba(255,255,255,0.03)',
                      border: isHighlighted
                        ? '1.5px solid rgba(251,191,36,0.5)'
                        : isToday
                          ? '1px solid rgba(251,191,36,0.25)'
                          : '1px solid rgba(255,255,255,0.07)',
                    }}>

                    <button className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-white/5 transition-colors"
                      onClick={() => toggleDay(date)}>
                      <div className="w-10 h-10 rounded-xl flex flex-col items-center justify-center shrink-0"
                        style={{ background: isHighlighted || isToday ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.06)' }}>
                        <p className="text-[8px] font-black uppercase" style={{ color: isHighlighted || isToday ? '#fbbf24' : '#64748b' }}>
                          {new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short' })}
                        </p>
                        <p className="text-sm font-black" style={{ color: isHighlighted || isToday ? '#fbbf24' : '#94a3b8' }}>
                          {new Date(date + 'T00:00:00').getDate()}
                        </p>
                      </div>

                      <div className="flex-1 text-left min-w-0">
                        <p className="font-black text-white text-sm">{formatDate(date)}</p>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          {activityGroups.map(([act]) => (
                            <span key={act} className="text-[9px]">{getMeta(act).emoji}</span>
                          ))}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="font-black text-sm" style={{ color: isHighlighted || isToday ? '#fbbf24' : '#22c55e' }}>+{fmt(data.total)}</p>
                        <p className="text-[9px] text-slate-500">pts</p>
                      </div>

                      {isExpanded
                        ? <ChevronUp size={14} color="#475569" className="shrink-0" />
                        : <ChevronDown size={14} color="#475569" className="shrink-0" />
                      }
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-3.5 space-y-1.5 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider pt-2.5 mb-2">Activity Breakdown</p>
                        {activityGroups.map(([act, pts]) => {
                          const meta  = getMeta(act);
                          const count = data.entries.filter(e => e.activity === act).length;
                          return (
                            <div key={act} className="flex items-center gap-2.5 rounded-xl px-3 py-2"
                              style={{ background: meta.bg }}>
                              <span className="text-base shrink-0">{meta.emoji}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-black text-white">{meta.label}</p>
                                <p className="text-[9px] text-slate-500">{count}× · {meta.sublabel}</p>
                              </div>
                              <p className="font-black text-sm shrink-0" style={{ color: meta.color }}>+{fmt(pts)}</p>
                            </div>
                          );
                        })}

                        {data.entries.length > 0 && (
                          <div className="mt-2 pt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                            <p className="text-[9px] text-slate-600 mb-1.5">Recent Activity</p>
                            <div className="space-y-1">
                              {[...data.entries].sort((a, b) => b.ts - a.ts).map((e, i) => {
                                const meta = getMeta(e.activity);
                                const time = new Date(e.ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
                                return (
                                  <div key={i} className="flex items-center gap-2">
                                    <p className="text-[8px] text-slate-600 w-10 shrink-0">{time}</p>
                                    <span className="text-[10px]">{meta.emoji}</span>
                                    <p className="text-[9px] text-slate-400 flex-1">{meta.label}</p>
                                    <p className="text-[9px] font-black" style={{ color: meta.color }}>+{e.pts}</p>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── SCORE SAMJHAO CARD ── */}
        <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-2 px-4 pt-4 pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <Award size={13} color="#fbbf24" />
            <p className="text-[10px] font-black text-white uppercase tracking-wider">Score Kaise Milta Hai?</p>
          </div>
          <div className="divide-y" style={{ divideColor: 'rgba(255,255,255,0.05)' }}>
            {visibleRows.map((row, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-3" style={{ borderTop: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.05)' }}>
                <span className="text-base shrink-0 mt-0.5">{row.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-black text-white">{row.act}</p>
                  <p className="text-[9px] text-slate-500 leading-snug mt-0.5">{row.note}</p>
                </div>
                <span className="text-[11px] font-black text-emerald-400 shrink-0 mt-0.5">{row.base}</span>
              </div>
            ))}
          </div>

          {/* More / Less toggle */}
          <button
            className="w-full flex items-center justify-center gap-1.5 py-3 active:bg-white/5 transition-colors"
            style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
            onClick={() => setShowAllActivities(v => !v)}>
            <span className="text-[10px] font-black text-violet-400">
              {showAllActivities ? 'Kam Dikao' : `Aur Dekho (${ALL_SCORE_ROWS.length - 6} more)`}
            </span>
            {showAllActivities
              ? <ChevronUp size={12} color="#a78bfa" />
              : <ChevronDown size={12} color="#a78bfa" />
            }
          </button>

          {/* Daily limit info */}
          <div className="px-4 py-3 mx-3 mb-3 mt-0 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <p className="text-[10px] font-black text-rose-300 mb-0.5">⚠️ No score earned after the Daily Limit</p>
            <p className="text-[9px] text-slate-500 leading-snug">
              Free=1500 pts/day · Basic=2500 pts/day · Ultra=3500 pts/day.
              <span className="text-amber-400 font-bold"> Studying a little every day is the most effective approach.</span>
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ScoreHistoryDashboard;
