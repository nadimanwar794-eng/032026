import React, { useState, useEffect } from 'react';
import { User, SystemSettings } from '../types';
import { getLevelInfo, getLevelProgress, getNextLevelInfo, LEVEL_INFO } from '../utils/levelSystem';
import { Trophy, Medal, Star, ChevronRight, X, BarChart2, Video, FileText, Headphones, Edit3, Crown } from 'lucide-react';
import { db, rtdb } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { ref, get } from 'firebase/database';

interface Props {
  user: User;
  settings?: SystemSettings;
  onBack?: () => void;
}

interface LeaderboardUser {
  id: string;
  name: string;
  displayId?: string;
  totalScore: number;
  level: number;
  subscriptionLevel?: string;
  subscriptionTier?: string;
  streak?: number;
  dailyMcqCount?: number;
  dailyVideoCount?: number;
  dailyPdfCount?: number;
  dailyWriteCount?: number;
  totalMcqSolved?: number;
  totalVideoWatched?: number;
  totalPdfViewed?: number;
  totalWriteUsed?: number;
  credits?: number;
  giftedCredits?: number;
  role?: string;
  photoURL?: string;
  avatarChoice?: string;
}

export const LevelLeaderboard: React.FC<Props> = ({ user, settings, onBack }) => {
  const [leaderboardUsers, setLeaderboardUsers] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<LeaderboardUser | null>(null);
  const [activeTab, setActiveTab] = useState<'LEVEL' | 'MCQ' | 'VIDEO' | 'PDF' | 'WRITE' | 'STREAK'>('LEVEL');

  useEffect(() => {
    const loadUsers = async () => {
      setLoading(true);
      const mapUser = (u: any): LeaderboardUser => ({
        id: u.id || '',
        name: u.name || 'Student',
        displayId: u.displayId,
        totalScore: u.totalScore || 0,
        level: getLevelInfo(u.totalScore || 0).level,
        subscriptionLevel: u.subscriptionLevel,
        subscriptionTier: u.subscriptionTier,
        streak: u.streak || 0,
        dailyMcqCount: u.dailyMcqCount || 0,
        dailyVideoCount: u.dailyVideoCount || 0,
        dailyPdfCount: u.dailyPdfCount || 0,
        dailyWriteCount: u.dailyWriteCount || 0,
        totalMcqSolved: u.totalMcqSolved || 0,
        totalVideoWatched: u.totalVideoWatched || 0,
        totalPdfViewed: u.totalPdfViewed || 0,
        totalWriteUsed: u.totalWriteUsed || 0,
        credits: u.credits || 0,
        giftedCredits: u.giftedCredits || 0,
        role: u.role,
        photoURL: u.photoURL || '',
        avatarChoice: u.avatarChoice || 'app',
      });
      const isStudent = (u: LeaderboardUser) => u.role !== 'ADMIN' && u.role !== 'SUB_ADMIN';

      try {
        let rtdbUsers: LeaderboardUser[] = [];
        let fsUsers: LeaderboardUser[] = [];

        // Fetch RTDB + Firestore in parallel
        const [rtdbSnap, fsSnap] = await Promise.allSettled([
          get(ref(rtdb, 'users')),
          getDocs(collection(db, 'users')),
        ]);

        if (rtdbSnap.status === 'fulfilled' && rtdbSnap.value.exists()) {
          rtdbUsers = (Object.values(rtdbSnap.value.val()) as any[])
            .map(mapUser).filter(isStudent);
        }

        if (fsSnap.status === 'fulfilled') {
          fsUsers = fsSnap.value.docs
            .map(d => mapUser({ id: d.id, ...d.data() }))
            .filter(isStudent);
        }

        // Merge: RTDB is authoritative; add any Firestore users missing from RTDB
        const rtdbIds = new Set(rtdbUsers.map(u => u.id));
        const extraFs = fsUsers.filter(u => u.id && !rtdbIds.has(u.id));
        let allUsers = [...rtdbUsers, ...extraFs];

        if (allUsers.length === 0) {
          // Last-resort fallback to localStorage cache
          const stored = localStorage.getItem('nst_users');
          if (stored) {
            const parsed: any[] = JSON.parse(stored);
            allUsers = parsed.map(mapUser).filter(isStudent);
          }
        }

        setLeaderboardUsers(allUsers);
      } catch (e) {
        console.error('Failed to load leaderboard', e);
      } finally {
        setLoading(false);
      }
    };
    loadUsers();
  }, []);

  const getSortedUsers = (): LeaderboardUser[] => {
    const list = [...leaderboardUsers];
    switch (activeTab) {
      case 'LEVEL': return list.sort((a, b) => b.totalScore - a.totalScore);
      case 'MCQ':   return list.sort((a, b) => (b.totalMcqSolved || 0) - (a.totalMcqSolved || 0));
      case 'VIDEO': return list.sort((a, b) => (b.totalVideoWatched || 0) - (a.totalVideoWatched || 0));
      case 'PDF':   return list.sort((a, b) => (b.totalPdfViewed || 0) - (a.totalPdfViewed || 0));
      case 'WRITE': return list.sort((a, b) => (b.totalWriteUsed || 0) - (a.totalWriteUsed || 0));
      case 'STREAK':return list.sort((a, b) => (b.streak || 0) - (a.streak || 0));
      default:      return list;
    }
  };

  const getTabValue = (u: LeaderboardUser): string => {
    switch (activeTab) {
      case 'LEVEL':  return `${u.totalScore} pts`;
      case 'MCQ':    return `${u.totalMcqSolved || 0} MCQ`;
      case 'VIDEO':  return `${u.totalVideoWatched || 0} Videos`;
      case 'PDF':    return `${u.totalPdfViewed || 0} PDFs`;
      case 'WRITE':  return `${u.totalWriteUsed || 0} Sessions`;
      case 'STREAK': return `🔥 ${u.streak || 0} Days`;
      default: return '';
    }
  };

  // Level distribution for mini chart
  const levelCounts = LEVEL_INFO.map(l => ({
    ...l,
    count: leaderboardUsers.filter(u => u.level === l.level).length
  }));
  const maxCount = Math.max(1, ...levelCounts.map(l => l.count));

  const currentUserRank = getSortedUsers().findIndex(u => u.id === user.id) + 1;
  const sortedUsers = getSortedUsers();

  const tabs = [
    { id: 'LEVEL' as const, label: 'Level', icon: '🏆' },
    { id: 'MCQ' as const, label: 'MCQ', icon: '📝' },
    { id: 'VIDEO' as const, label: 'Video', icon: '📹' },
    { id: 'PDF' as const, label: 'PDF', icon: '📄' },
    { id: 'WRITE' as const, label: 'Write', icon: '✍️' },
    { id: 'STREAK' as const, label: 'Streak', icon: '🔥' },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white animate-in fade-in duration-300 pb-20">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-gradient-to-r from-[#0a0a0a] via-[#111] to-[#0a0a0a] px-4 py-3 border-b border-white/8 flex items-center gap-3">
        {onBack && (
          <button onClick={onBack} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/8 text-slate-400 hover:bg-white/15 transition-colors">
            <ChevronRight size={16} className="rotate-180" />
          </button>
        )}
        <div className="flex-1">
          <h1 className="text-base font-black text-white flex items-center gap-2">
            <Trophy size={16} className="text-yellow-400" />
            Level Leaderboard
          </h1>
          <p className="text-[10px] text-slate-500">{leaderboardUsers.length} students · Tap on a student to view full profile</p>
        </div>
        {currentUserRank > 0 && (
          <div className="text-right">
            <p className="text-[9px] text-slate-500 uppercase tracking-widest">Your Rank</p>
            <p className="text-base font-black text-yellow-400">#{currentUserRank}</p>
          </div>
        )}
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Level Distribution Chart */}
        <div className="rounded-2xl bg-white/4 border border-white/8 p-4">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Level Distribution</p>
          <div className="flex items-end gap-1.5 h-16">
            {levelCounts.map(l => (
              <div key={l.level} className="flex-1 flex flex-col items-center gap-0.5">
                <p className="text-[8px] text-slate-600 font-bold">{l.count}</p>
                <div
                  className="w-full rounded-t-sm transition-all"
                  style={{
                    height: `${Math.max(4, (l.count / maxCount) * 40)}px`,
                    background: l.count > 0 ? l.color : '#1e293b',
                    boxShadow: l.count > 0 ? `0 0 8px ${l.glowColor}` : 'none',
                  }}
                />
                <p className="text-[8px] text-slate-600">{l.emoji}</p>
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-1">
            {levelCounts.map(l => (
              <p key={l.level} className="text-[7px] text-slate-700 flex-1 text-center">L{l.level}</p>
            ))}
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-black transition-all ${
                activeTab === t.id
                  ? 'bg-white text-black shadow-sm'
                  : 'bg-white/8 text-slate-400 border border-white/10'
              }`}
            >
              <span>{t.icon}</span> {t.label}
            </button>
          ))}
        </div>

        {/* Leaderboard List */}
        {loading ? (
          <div className="space-y-2">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="h-16 rounded-2xl bg-white/4 border border-white/6 animate-pulse" />
            ))}
          </div>
        ) : sortedUsers.length === 0 ? (
          <div className="text-center py-16 text-slate-600">
            <Trophy size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm font-bold">Koi students nahi mile</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sortedUsers.slice(0, 100).map((u, idx) => {
              const lvl = getLevelInfo(u.totalScore);
              const isMe = u.id === user.id;
              const isTop3 = idx < 3;
              return (
                <button
                  key={u.id}
                  onClick={() => setSelectedUser(u)}
                  className={`w-full flex items-center gap-3 p-3 rounded-2xl border transition-all active:scale-[0.98] text-left ${
                    isMe
                      ? 'bg-white/10 border-white/20 shadow-sm'
                      : isTop3
                        ? 'bg-white/6 border-white/12'
                        : 'bg-white/3 border-white/6 hover:bg-white/6'
                  }`}
                >
                  {/* Rank */}
                  <div className="w-8 text-center shrink-0">
                    {idx === 0 ? <span className="text-xl">🥇</span>
                    : idx === 1 ? <span className="text-xl">🥈</span>
                    : idx === 2 ? <span className="text-xl">🥉</span>
                    : <span className="text-sm font-black text-slate-500">#{idx + 1}</span>}
                  </div>

                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 overflow-hidden"
                    style={{
                      background: `${lvl.color}22`,
                      border: `1.5px solid ${lvl.color}55`,
                      boxShadow: isTop3 ? `0 0 10px ${lvl.glowColor}` : 'none',
                    }}>
                    {u.photoURL && u.avatarChoice === 'gmail'
                      ? <img src={u.photoURL} alt={u.name} className="w-full h-full object-cover" />
                      : <span style={{ color: lvl.color }}>{(u.name || 'S').charAt(0)}</span>
                    }
                  </div>

                  {/* Name + Level */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-black truncate"
                        style={{ color: lvl.nameColor || (lvl.level >= 4 ? lvl.color : 'white') }}>
                        {u.name}
                        {isMe && <span className="text-[9px] text-slate-400 font-normal ml-1">(You)</span>}
                      </p>
                      {u.subscriptionLevel === 'ULTRA' && (
                        <span className="text-[8px] font-black bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1 py-0.5 rounded shrink-0">⚡ULTRA</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[9px]">{lvl.emoji}</span>
                      <span className="text-[9px] font-bold" style={{ color: lvl.color }}>L{lvl.level} · {lvl.label}</span>
                      {u.streak && u.streak >= 3 && (
                        <span className="text-[9px] text-orange-400">🔥{u.streak}</span>
                      )}
                    </div>
                  </div>

                  {/* Value */}
                  <div className="text-right shrink-0">
                    <p className="text-sm font-black" style={{ color: lvl.color }}>{getTabValue(u)}</p>
                  </div>
                  <ChevronRight size={12} className="text-slate-700 shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* User Profile Sheet */}
      {selectedUser && (() => {
        const lvl = getLevelInfo(selectedUser.totalScore);
        const nextLvl = getNextLevelInfo(selectedUser.totalScore);
        const progress = getLevelProgress(selectedUser.totalScore);
        const isMe = selectedUser.id === user.id;
        return (
          <div className="fixed inset-0 z-[9999] flex flex-col justify-end" style={{ background: 'rgba(0,0,0,0.75)' }} onClick={() => setSelectedUser(null)}>
            <div className="bg-[#0e0e0e] rounded-t-3xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="sticky top-0 bg-[#0e0e0e] pt-2 pb-3 px-5 flex items-center justify-between border-b border-white/6 z-10">
                <div className="w-10 h-1 bg-slate-700 rounded-full absolute left-1/2 -translate-x-1/2 top-1.5" />
                <p className="text-sm font-black text-white mt-3">Student Profile</p>
                <button onClick={() => setSelectedUser(null)} className="w-7 h-7 mt-3 flex items-center justify-center rounded-full bg-white/8 text-slate-400">✕</button>
              </div>

              <div className="px-4 py-4 space-y-3">
                {/* Level card */}
                <div className="rounded-2xl p-4 text-center"
                  style={{ background: `linear-gradient(135deg, ${lvl.color}15, ${lvl.color}06)`, border: `1px solid ${lvl.color}40`, boxShadow: `0 0 28px ${lvl.glowColor}` }}>
                  <div className="text-4xl mb-2" style={{ filter: `drop-shadow(0 0 10px ${lvl.glowColor})` }}>{lvl.emoji}</div>
                  <p className="font-black text-xl mb-0.5" style={{ color: lvl.nameColor || lvl.color }}>{selectedUser.name}</p>
                  <p className="text-[10px] text-slate-500 mb-2">{selectedUser.displayId || selectedUser.id.substring(0, 8)}</p>
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border mb-2"
                    style={{ background: `${lvl.color}20`, borderColor: `${lvl.color}50` }}>
                    <span className="text-sm font-black text-white">Level {lvl.level}</span>
                    <span className="text-sm font-black" style={{ color: lvl.color }}>· {lvl.label}</span>
                  </div>
                  <p className="text-2xl font-black" style={{ color: lvl.color }}>{selectedUser.totalScore.toLocaleString('en-IN')} pts</p>
                  {lvl.discount > 0 && (
                    <div className="mt-2 inline-block px-2 py-0.5 rounded-full text-[10px] font-black text-white" style={{ background: lvl.color }}>
                      🏷️ {lvl.discount}% Discount
                    </div>
                  )}
                </div>

                {/* Progress bar */}
                {nextLvl && (
                  <div className="rounded-xl p-3 bg-white/4 border border-white/8">
                    <div className="flex justify-between mb-1.5">
                      <span className="text-[10px] text-slate-400 font-bold">To Level {nextLvl.level} {nextLvl.emoji}</span>
                      <span className="text-[10px] text-slate-500">{nextLvl.minScore - selectedUser.totalScore} pts left</span>
                    </div>
                    <div className="h-2 bg-white/8 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${progress}%`, background: `linear-gradient(90deg, ${lvl.color}88, ${lvl.color})` }} />
                    </div>
                  </div>
                )}

                {/* Activity Stats */}
                <div className="rounded-2xl bg-white/4 border border-white/8 p-4">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Activity Stats</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { icon: '📝', label: 'Total MCQ', val: selectedUser.totalMcqSolved || 0, color: 'text-blue-400' },
                      { icon: '📹', label: 'Total Videos', val: selectedUser.totalVideoWatched || 0, color: 'text-red-400' },
                      { icon: '📄', label: 'Total PDFs', val: selectedUser.totalPdfViewed || 0, color: 'text-green-400' },
                      { icon: '✍️', label: 'Total Write', val: selectedUser.totalWriteUsed || 0, color: 'text-purple-400' },
                      { icon: '🔥', label: 'Day Streak', val: selectedUser.streak || 0, color: 'text-orange-400' },
                      { icon: '🪙', label: 'Credits', val: (selectedUser.credits || 0) + (selectedUser.giftedCredits || 0), color: 'text-amber-400' },
                    ].map(s => (
                      <div key={s.label} className="bg-white/4 rounded-xl py-2.5 px-3 border border-white/6">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-base">{s.icon}</span>
                          <span className={`text-base font-black ${s.color}`}>{s.val}</span>
                        </div>
                        <p className="text-[9px] font-bold text-slate-600 uppercase tracking-wide">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Subscription */}
                {selectedUser.subscriptionLevel && (
                  <div className={`rounded-xl px-4 py-2.5 border flex items-center gap-2 ${
                    selectedUser.subscriptionLevel === 'ULTRA'
                      ? 'bg-purple-500/10 border-purple-500/30'
                      : 'bg-sky-500/10 border-sky-500/30'
                  }`}>
                    <Crown size={14} className={selectedUser.subscriptionLevel === 'ULTRA' ? 'text-purple-400' : 'text-sky-400'} />
                    <p className="text-sm font-black text-white">
                      {selectedUser.subscriptionLevel === 'ULTRA' ? '⚡ Ultra' : '★ Basic'} ·{' '}
                      {selectedUser.subscriptionTier || 'Active'}
                    </p>
                  </div>
                )}

                {isMe && (
                  <p className="text-center text-[10px] text-slate-600 pb-2">👆 Yeh aapka profile hai</p>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
