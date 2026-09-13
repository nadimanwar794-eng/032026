import React, { useState, useEffect } from 'react';
import { User, SystemSettings } from '../types';
import { getLevelInfo, getLevelProgress, getNextLevelInfo, LEVEL_INFO } from '../utils/levelSystem';
import { Trophy, Medal, Star, ChevronRight, X, BarChart2, Video, FileText, Headphones, Edit3, Crown, Search, Users, EyeOff } from 'lucide-react';
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
  dailyStudySeconds?: number;
  referralCount?: number;
  credits?: number;
  giftedCredits?: number;
  role?: string;
  photoURL?: string;
  avatarChoice?: string;
  classLevel?: string;
}

type TabType = 'LEVEL' | 'STUDY' | 'MCQ' | 'VIDEO' | 'PDF' | 'WRITE' | 'STREAK' | 'REFERRAL';
type TimeFilter = 'TODAY' | 'WEEK' | 'MONTH' | 'ALL';

export const LevelLeaderboard: React.FC<Props> = ({ user, settings, onBack }) => {
  const [leaderboardUsers, setLeaderboardUsers] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<LeaderboardUser | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('LEVEL');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('ALL');
  const [classFilter, setClassFilter] = useState<string>('ALL');
  const [hideName, setHideName] = useState(() => localStorage.getItem('nst_hide_name') === 'true');

  useEffect(() => {
    localStorage.setItem('nst_hide_name', String(hideName));
  }, [hideName]);

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
        dailyStudySeconds: u.dailyStudySeconds || 0,
        referralCount: u.referralCount || 0,
        credits: u.credits || 0,
        giftedCredits: u.giftedCredits || 0,
        role: u.role,
        photoURL: u.photoURL || '',
        avatarChoice: u.avatarChoice || 'app',
        classLevel: u.classLevel || '10',
      });
      const isStudent = (u: LeaderboardUser) => u.role !== 'ADMIN' && u.role !== 'SUB_ADMIN';

      try {
        let rtdbUsers: LeaderboardUser[] = [];
        let fsUsers: LeaderboardUser[] = [];

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

        const rtdbIds = new Set(rtdbUsers.map(u => u.id));
        const extraFs = fsUsers.filter(u => u.id && !rtdbIds.has(u.id));
        let allUsers = [...rtdbUsers, ...extraFs];

        if (allUsers.length === 0) {
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

  const getFilteredUsers = (): LeaderboardUser[] => {
    let list = [...leaderboardUsers];
    if (classFilter !== 'ALL') {
      list = list.filter(u => u.classLevel === classFilter);
    }
    return list;
  };

  const getSortedUsers = (): LeaderboardUser[] => {
    const list = getFilteredUsers();
    switch (activeTab) {
      case 'LEVEL': return list.sort((a, b) => b.totalScore - a.totalScore);
      case 'STUDY': return list.sort((a, b) => (b.dailyStudySeconds || 0) - (a.dailyStudySeconds || 0));
      case 'MCQ':   return list.sort((a, b) => (b.totalMcqSolved || 0) - (a.totalMcqSolved || 0));
      case 'VIDEO': return list.sort((a, b) => (b.totalVideoWatched || 0) - (a.totalVideoWatched || 0));
      case 'PDF':   return list.sort((a, b) => (b.totalPdfViewed || 0) - (a.totalPdfViewed || 0));
      case 'WRITE': return list.sort((a, b) => (b.totalWriteUsed || 0) - (a.totalWriteUsed || 0));
      case 'STREAK':return list.sort((a, b) => (b.streak || 0) - (a.streak || 0));
      case 'REFERRAL':return list.sort((a, b) => (b.referralCount || 0) - (a.referralCount || 0));
      default:      return list;
    }
  };

  const formatTime = (secs: number) => {
    if (!secs) return '0m';
    const hrs = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${m}m`;
    return `${m}m`;
  };

  const getTabValue = (u: LeaderboardUser): string => {
    switch (activeTab) {
      case 'LEVEL':  return `${u.totalScore} pts`;
      case 'STUDY':  return formatTime(u.dailyStudySeconds || 0);
      case 'MCQ':    return `${u.totalMcqSolved || 0} MCQ`;
      case 'VIDEO':  return `${u.totalVideoWatched || 0} Vids`;
      case 'PDF':    return `${u.totalPdfViewed || 0} PDFs`;
      case 'WRITE':  return `${u.totalWriteUsed || 0} Tasks`;
      case 'STREAK': return `🔥 ${u.streak || 0} Days`;
      case 'REFERRAL': return `🚀 ${u.referralCount || 0} Refers`;
      default: return '';
    }
  };

  const currentUserRank = getSortedUsers().findIndex(u => u.id === user.id) + 1;
  const sortedUsers = getSortedUsers();

  const tabs: {id: TabType, label: string, icon: string}[] = [
    { id: 'LEVEL', label: 'Overall XP', icon: '🏆' },
    { id: 'STUDY', label: 'Time', icon: '⏱️' },
    { id: 'STREAK', label: 'Streak', icon: '🔥' },
    { id: 'MCQ', label: 'Tests', icon: '📝' },
    { id: 'VIDEO', label: 'Video', icon: '📹' },
    { id: 'PDF', label: 'Reading', icon: '📚' },
    { id: 'WRITE', label: 'Practice', icon: '✍️' },
    { id: 'REFERRAL', label: 'Invites', icon: '🚀' },
  ];

  const displayName = (u: LeaderboardUser) => {
    if (u.id === user.id && hideName) return u.displayId || u.id.slice(0, 8)?.toUpperCase();
    if (hideName && u.id !== user.id) return `NSTA-${u.id.slice(0, 6)?.toUpperCase()}`;
    return u.name;
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white animate-in fade-in duration-300 pb-20">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#0a0a0a] px-4 py-3 border-b border-white/8">
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/8 text-slate-400 hover:bg-white/15 transition-colors">
              <ChevronRight size={16} className="rotate-180" />
            </button>
          )}
          <div className="flex-1">
            <h1 className="text-lg font-black text-white flex items-center gap-2">
              <Trophy size={18} className="text-yellow-400" />
              Mega Leaderboard
            </h1>
            <p className="text-[10px] text-slate-400">Compete & track your academic journey</p>
          </div>
          <button 
            onClick={() => setHideName(!hideName)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[10px] font-black border transition-colors ${
              hideName ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' : 'bg-white/5 text-slate-400 border-white/10'
            }`}
          >
            <EyeOff size={12} />
            {hideName ? 'Privacy On' : 'Hide Name'}
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-2 mt-4">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1">
            {["ALL", "TODAY", "WEEK", "MONTH"].map(t => (
              <button key={t} onClick={() => setTimeFilter(t as TimeFilter)}
                className={`px-3 py-1.5 rounded-full text-[10px] font-bold shrink-0 transition-colors ${
                  timeFilter === t ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30" : "bg-white/5 text-slate-400 border border-transparent"
                }`}>
                {t === "ALL" ? "All Time" : t === "TODAY" ? "Today" : t === "WEEK" ? "This Week" : "This Month"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1">
            {['ALL', '9', '10', '11', '12', 'COMPETITION'].map(c => (
              <button key={c} onClick={() => setClassFilter(c)}
                className={`px-3 py-1.5 rounded-full text-[10px] font-bold shrink-0 transition-colors ${
                  classFilter === c ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'bg-white/5 text-slate-400 border border-transparent'
                }`}>
                {c === 'ALL' ? 'All Classes' : c === 'COMPETITION' ? 'Comp' : `Class ${c}`}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Category Tabs */}
        <div className="flex flex-wrap gap-2">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex-1 min-w-[30%] flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition-all ${
                activeTab === t.id
                  ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg border border-indigo-400/50'
                  : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
              }`}
            >
              <span className="text-sm">{t.icon}</span> <span className="truncate">{t.label}</span>
            </button>
          ))}
        </div>

        {/* Top 3 Podium Display */}
        {!loading && sortedUsers.length >= 3 && (
          <div className="flex items-end justify-center gap-2 pt-8 pb-4">
            {/* Rank 2 */}
            <div className="flex flex-col items-center w-1/3">
              <div className="w-12 h-12 rounded-full border-[3px] border-slate-300 bg-slate-800 flex items-center justify-center font-bold text-lg mb-2 relative overflow-hidden">
                {sortedUsers[1].photoURL && sortedUsers[1].avatarChoice === 'gmail' ? <img src={sortedUsers[1].photoURL} className="w-full h-full object-cover"/> : sortedUsers[1].name.charAt(0)}
                <div className="absolute -bottom-1 w-full bg-slate-300 text-slate-800 text-[9px] font-black text-center py-0.5">#2</div>
              </div>
              <p className="text-[10px] font-bold text-center truncate w-full text-slate-300">{displayName(sortedUsers[1])}</p>
              <p className="text-[9px] font-black text-slate-400">{getTabValue(sortedUsers[1])}</p>
              <div className="w-full h-16 bg-gradient-to-t from-slate-500/40 to-slate-400/10 rounded-t-lg border-t-2 border-slate-400 mt-2 flex items-center justify-center">🥈</div>
            </div>
            {/* Rank 1 */}
            <div className="flex flex-col items-center w-1/3 -mt-6">
              <div className="w-16 h-16 rounded-full border-[3px] border-yellow-400 bg-slate-800 flex items-center justify-center font-bold text-2xl mb-2 relative overflow-hidden shadow-[0_0_15px_rgba(250,204,21,0.5)] z-10">
                {sortedUsers[0].photoURL && sortedUsers[0].avatarChoice === 'gmail' ? <img src={sortedUsers[0].photoURL} className="w-full h-full object-cover"/> : sortedUsers[0].name.charAt(0)}
                <div className="absolute -bottom-1 w-full bg-yellow-400 text-yellow-900 text-[10px] font-black text-center py-0.5">#1</div>
              </div>
              <p className="text-[11px] font-black text-center truncate w-full text-yellow-400">{displayName(sortedUsers[0])}</p>
              <p className="text-[10px] font-black text-yellow-200/80">{getTabValue(sortedUsers[0])}</p>
              <div className="w-full h-24 bg-gradient-to-t from-yellow-500/40 to-yellow-400/10 rounded-t-lg border-t-2 border-yellow-400 mt-2 flex items-center justify-center">🥇</div>
            </div>
            {/* Rank 3 */}
            <div className="flex flex-col items-center w-1/3">
              <div className="w-12 h-12 rounded-full border-[3px] border-amber-600 bg-slate-800 flex items-center justify-center font-bold text-lg mb-2 relative overflow-hidden">
                {sortedUsers[2].photoURL && sortedUsers[2].avatarChoice === 'gmail' ? <img src={sortedUsers[2].photoURL} className="w-full h-full object-cover"/> : sortedUsers[2].name.charAt(0)}
                <div className="absolute -bottom-1 w-full bg-amber-600 text-amber-100 text-[9px] font-black text-center py-0.5">#3</div>
              </div>
              <p className="text-[10px] font-bold text-center truncate w-full text-amber-500">{displayName(sortedUsers[2])}</p>
              <p className="text-[9px] font-black text-amber-500/80">{getTabValue(sortedUsers[2])}</p>
              <div className="w-full h-12 bg-gradient-to-t from-amber-600/40 to-amber-600/10 rounded-t-lg border-t-2 border-amber-600 mt-2 flex items-center justify-center">🥉</div>
            </div>
          </div>
        )}

        {/* Current User Rank Bar */}
        {currentUserRank > 0 && (
          <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-3 flex items-center justify-between shadow-[0_0_15px_rgba(99,102,241,0.1)]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center font-black text-indigo-300">#{currentUserRank}</div>
              <div>
                <p className="text-[11px] text-indigo-300/80 font-bold">Your Ranking</p>
                <p className="text-sm font-black text-white">{activeTab} Leaderboard</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-base font-black text-indigo-400">{getTabValue(sortedUsers[currentUserRank - 1])}</p>
            </div>
          </div>
        )}

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
            <p className="text-sm font-bold">No students found for this class.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sortedUsers.slice(3, 100).map((u, idx) => {
              const lvl = getLevelInfo(u.totalScore);
              const isMe = u.id === user.id;
              const actualRank = idx + 4;
              
              return (
                <button
                  key={u.id}
                  onClick={() => setSelectedUser(u)}
                  className={`w-full flex items-center gap-3 p-3 rounded-2xl border transition-all active:scale-[0.98] text-left ${
                    isMe
                      ? 'bg-indigo-500/10 border-indigo-500/30 shadow-sm'
                      : 'bg-white/3 border-white/6 hover:bg-white/6'
                  }`}
                >
                  <div className="w-8 text-center shrink-0">
                    <span className="text-xs font-black text-slate-500">#{actualRank}</span>
                  </div>

                  <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 overflow-hidden"
                    style={{
                      background: `${lvl.color}22`,
                      border: `1.5px solid ${lvl.color}55`,
                    }}>
                    {u.photoURL && u.avatarChoice === 'gmail' && !hideName
                      ? <img src={u.photoURL} alt="avatar" className="w-full h-full object-cover" />
                      : <span style={{ color: lvl.color }}>{(displayName(u) || 'S').charAt(0)}</span>
                    }
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-black truncate text-white">
                        {displayName(u)}
                        {isMe && <span className="text-[9px] text-indigo-400 font-normal ml-1">(You)</span>}
                      </p>
                      {u.subscriptionLevel === 'ULTRA' && (
                        <span className="text-[8px] font-black bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1 py-0.5 rounded shrink-0">⚡ULTRA</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[9px]">{lvl.emoji}</span>
                      <span className="text-[9px] font-bold" style={{ color: lvl.color }}>L{lvl.level} · Class {u.classLevel || '10'}</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-sm font-black" style={{ color: activeTab === 'LEVEL' ? lvl.color : '#e2e8f0' }}>{getTabValue(u)}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Profile Sheet (Truncated for brevity but keeping same functionality) */}
      {selectedUser && (
        <div className="fixed inset-0 z-[9999] flex flex-col justify-end" style={{ background: 'rgba(0,0,0,0.75)' }} onClick={() => setSelectedUser(null)}>
          <div className="bg-[#0e0e0e] rounded-t-3xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-[#0e0e0e] pt-2 pb-3 px-5 flex items-center justify-between border-b border-white/6 z-10">
              <div className="w-10 h-1 bg-slate-700 rounded-full absolute left-1/2 -translate-x-1/2 top-1.5" />
              <p className="text-sm font-black text-white mt-3">Student Profile</p>
              <button onClick={() => setSelectedUser(null)} className="w-7 h-7 mt-3 flex items-center justify-center rounded-full bg-white/8 text-slate-400">✕</button>
            </div>
            <div className="px-4 py-6 text-center space-y-4">
              <div className="w-20 h-20 mx-auto rounded-full border-[3px] border-indigo-500/50 flex items-center justify-center overflow-hidden bg-slate-800 text-3xl font-black text-slate-400">
                {selectedUser.photoURL && selectedUser.avatarChoice === 'gmail' && !hideName ? <img src={selectedUser.photoURL} className="w-full h-full object-cover"/> : displayName(selectedUser).charAt(0)}
              </div>
              <div>
                <p className="text-2xl font-black text-white">{displayName(selectedUser)}</p>
                <p className="text-xs text-slate-500">Level {selectedUser.level} · Class {selectedUser.classLevel || '10'}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-4 text-left">
                <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Total XP</p>
                  <p className="text-lg font-black text-yellow-400">{selectedUser.totalScore} pts</p>
                </div>
                <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Study Time</p>
                  <p className="text-lg font-black text-blue-400">{formatTime(selectedUser.dailyStudySeconds || 0)}</p>
                </div>
                <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">MCQs Solved</p>
                  <p className="text-lg font-black text-emerald-400">{selectedUser.totalMcqSolved || 0}</p>
                </div>
                <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Streak</p>
                  <p className="text-lg font-black text-orange-400">🔥 {selectedUser.streak || 0}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
