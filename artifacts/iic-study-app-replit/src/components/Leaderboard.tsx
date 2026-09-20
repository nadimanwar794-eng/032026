import React, { useState, useEffect, useMemo } from 'react';
import { LeaderboardEntry, User, SystemSettings } from '../types';
import { Trophy, Medal, Zap, Users, Gift, CheckCircle, Clock, Sparkles, Award } from 'lucide-react';
import { getDailyChallengeLeaderboard, DailyChallengeEntry } from '../firebase';
import { 
  getYesterdayDateKey, 
  formatChallengeDate, 
  fetchChallengeLeaderboardWithPrizes, 
  claimDailyChallengePrize, 
  isChallengePrizeClaimed,
  getChallengePrizeTiers,
  RankedChallengeParticipant 
} from '../utils/challengePrizeSystem';

interface Props {
  user: User;
  settings?: SystemSettings;
  onUpdateUser?: (updatedUser: User) => void;
}

export const Leaderboard: React.FC<Props> = ({ user, settings, onUpdateUser }) => {
    const [localEntries, setLocalEntries] = useState<LeaderboardEntry[]>([]);
    const [challengeEntries, setChallengeEntries] = useState<DailyChallengeEntry[]>([]);
    const [yesterdayRanked, setYesterdayRanked] = useState<RankedChallengeParticipant[]>([]);
    const [yesterdayUserEntry, setYesterdayUserEntry] = useState<RankedChallengeParticipant | null>(null);
    const [tab, setTab] = useState<'YESTERDAY' | 'TODAY' | 'ALL'>('YESTERDAY');
    const [loading, setLoading] = useState(false);
    const [isClaiming, setIsClaiming] = useState(false);
    const [claimMsg, setClaimMsg] = useState<string | null>(null);

    const yesterdayDate = useMemo(() => getYesterdayDateKey(), []);
    const formattedYesterday = useMemo(() => formatChallengeDate(yesterdayDate), [yesterdayDate]);
    const prizeTiers = useMemo(() => getChallengePrizeTiers(settings?.prizeRules), [settings?.prizeRules]);

    const isYesterdayClaimed = useMemo(() => {
        return isChallengePrizeClaimed(yesterdayDate, user?.id);
    }, [yesterdayDate, user?.id, claimMsg]);

    // Load all-time local leaderboard
    useEffect(() => {
        const stored = localStorage.getItem('nst_leaderboard');
        if (stored) {
            try {
                const data: LeaderboardEntry[] = JSON.parse(stored);
                if (Array.isArray(data)) {
                    const sorted = data.sort((a, b) => b.score - a.score || new Date(b.date).getTime() - new Date(a.date).getTime());
                    setLocalEntries(sorted);
                }
            } catch (e) {
                console.error("Failed to load leaderboard", e);
                localStorage.removeItem('nst_leaderboard');
            }
        }
    }, []);

    // Load yesterday's challenge leaderboard with prizes
    useEffect(() => {
        if (tab !== 'YESTERDAY') return;
        setLoading(true);
        const classLevel = user?.classLevel || '10';
        fetchChallengeLeaderboardWithPrizes(yesterdayDate, classLevel, user?.id, settings?.prizeRules)
            .then(({ entries, userEntry }) => {
                setYesterdayRanked(entries);
                setYesterdayUserEntry(userEntry);
            })
            .catch(() => {
                setYesterdayRanked([]);
                setYesterdayUserEntry(null);
            })
            .finally(() => setLoading(false));
    }, [tab, yesterdayDate, user?.classLevel, user?.id, settings?.prizeRules]);

    // Load today's challenge leaderboard from Firestore (same questions → fair comparison)
    useEffect(() => {
        if (tab !== 'TODAY') return;
        setLoading(true);
        const today = new Date().toISOString().split('T')[0];
        const classLevel = user?.classLevel || '10';
        getDailyChallengeLeaderboard(today, classLevel)
            .then(entries => setChallengeEntries(entries))
            .catch(() => setChallengeEntries([]))
            .finally(() => setLoading(false));
    }, [tab, user?.classLevel]);

    const handleClaimYesterdayPrize = async () => {
        if (!yesterdayUserEntry || !user || isClaiming || isYesterdayClaimed) return;
        setIsClaiming(true);
        try {
            const res = await claimDailyChallengePrize(
                user,
                yesterdayDate,
                yesterdayUserEntry,
                settings?.prizeRules,
                settings
            );
            if (res.success) {
                setClaimMsg(res.message);
                if (onUpdateUser) onUpdateUser(res.updatedUser);
            } else {
                alert(res.message);
            }
        } catch (e) {
            console.error('Failed to claim prize:', e);
        } finally {
            setIsClaiming(false);
        }
    };

    const myTodayRank = tab === 'TODAY'
        ? challengeEntries.findIndex(e => e.userId === user?.id) + 1
        : 0;

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <h3 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3">
                    <Trophy className="text-yellow-500" /> Challenge Leaderboard
                </h3>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-bold">
                    Class {user?.classLevel || '10'} • Fair Seeded
                </span>
            </div>

            {/* Tab Toggle */}
            <div className="flex flex-wrap gap-2 mb-5">
                <button
                    onClick={() => setTab('YESTERDAY')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
                        tab === 'YESTERDAY'
                            ? 'bg-amber-500 text-black shadow-md'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                >
                    <Award size={15} />
                    <span>Kal Ka Challenge (Ranks & Prizes)</span>
                </button>
                <button
                    onClick={() => setTab('TODAY')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
                        tab === 'TODAY'
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                >
                    <Zap size={15} />
                    <span>Aaj Ka Live Challenge</span>
                </button>
                <button
                    onClick={() => setTab('ALL')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
                        tab === 'ALL'
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                >
                    <Users size={15} />
                    <span>All Records</span>
                </button>
            </div>

            {/* YESTERDAY'S CHALLENGE LEADERBOARD & PRIZES */}
            {tab === 'YESTERDAY' && (
                <div className="space-y-4">
                    {/* User's Yesterday Rank & Prize Banner */}
                    {yesterdayUserEntry && (
                        <div className="bg-gradient-to-r from-amber-500/10 via-yellow-500/10 to-orange-500/10 border border-amber-300/40 dark:border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-600 text-black font-black text-lg flex items-center justify-center shadow-md shrink-0">
                                    #{yesterdayUserEntry.rank}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-black uppercase text-amber-700 dark:text-amber-300">
                                            Aapki Kal Ki Rank #{yesterdayUserEntry.rank} (Top {Math.max(1, Math.round(((yesterdayRanked.length - yesterdayUserEntry.rank + 1) / yesterdayRanked.length) * 100))}%)
                                        </span>
                                    </div>
                                    <p className="text-sm font-black text-slate-800 dark:text-white mt-0.5">
                                        Score: {Math.round(yesterdayUserEntry.percentage)}% • Prize: {yesterdayUserEntry.prize.label}
                                    </p>
                                </div>
                            </div>

                            <div className="shrink-0 w-full sm:w-auto">
                                {isYesterdayClaimed ? (
                                    <div className="px-4 py-2 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 rounded-xl text-xs font-black flex items-center justify-center gap-1.5">
                                        <CheckCircle size={15} />
                                        <span>Prize Claimed</span>
                                    </div>
                                ) : (
                                    <button
                                        onClick={handleClaimYesterdayPrize}
                                        disabled={isClaiming}
                                        className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-black text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                                    >
                                        <Gift size={15} />
                                        <span>{isClaiming ? 'Claiming...' : '🎁 Claim My Prize'}</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {claimMsg && (
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                            <CheckCircle size={16} className="text-emerald-500 shrink-0" />
                            <span>{claimMsg}</span>
                        </div>
                    )}

                    {/* Full List of Yesterday's Rank & Percentage Prizes */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                        <div className="bg-slate-50 dark:bg-slate-800/80 px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                            <div>
                                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                    Kal Ka Official Result ({formattedYesterday})
                                </h4>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                    Sabhi students ke scores, ranks aur unke % par mile prizes
                                </p>
                            </div>
                            <span className="text-xs font-black text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2.5 py-1 rounded-lg border border-amber-200 dark:border-amber-800">
                                {yesterdayRanked.length} Participants
                            </span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50/50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 text-xs uppercase font-bold">
                                    <tr>
                                        <th className="p-3.5">Rank</th>
                                        <th className="p-3.5">Student</th>
                                        <th className="p-3.5 text-center">Score %</th>
                                        <th className="p-3.5 text-center">Time</th>
                                        <th className="p-3.5 text-right">Prize Won (% Reward)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {loading && (
                                        <tr><td colSpan={5} className="p-8 text-center text-slate-400">Loading yesterday rankings...</td></tr>
                                    )}
                                    {!loading && yesterdayRanked.length === 0 && (
                                        <tr><td colSpan={5} className="p-8 text-center text-slate-500">Kal ke challenge ka koi record nahi mila.</td></tr>
                                    )}
                                    {!loading && yesterdayRanked.map((entry) => {
                                        const isCurrentUser = entry.userId === user?.id;
                                        const isTop1 = entry.rank === 1;
                                        const isTop2 = entry.rank === 2;
                                        const isTop3 = entry.rank === 3;

                                        return (
                                            <tr
                                                key={entry.userId}
                                                className={`${
                                                    isCurrentUser ? 'bg-blue-50/60 dark:bg-blue-950/40' :
                                                    isTop1 ? 'bg-amber-50/40 dark:bg-amber-950/20' : ''
                                                } hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors`}
                                            >
                                                <td className="p-3.5 font-black text-slate-700 dark:text-slate-300">
                                                    {isTop1 && <span className="flex items-center gap-1 text-amber-500"><Medal size={18} /> 1st</span>}
                                                    {isTop2 && <span className="flex items-center gap-1 text-slate-400"><Medal size={18} /> 2nd</span>}
                                                    {isTop3 && <span className="flex items-center gap-1 text-amber-700"><Medal size={18} /> 3rd</span>}
                                                    {!isTop1 && !isTop2 && !isTop3 && `#${entry.rank}`}
                                                </td>
                                                <td className="p-3.5 font-bold text-slate-800 dark:text-white">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-700 dark:text-slate-300">
                                                            {entry.userName.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-1.5">
                                                                <span>{entry.userName}</span>
                                                                {isCurrentUser && (
                                                                    <span className="px-1.5 py-0.2 bg-blue-500 text-white text-[9px] font-black rounded">
                                                                        Aap
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <span className="text-[10px] text-slate-400 font-normal">
                                                                {entry.score}/{entry.totalQuestions} Sahi
                                                            </span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-3.5 text-center font-black text-blue-600 dark:text-blue-400">
                                                    {Math.round(entry.percentage)}%
                                                </td>
                                                <td className="p-3.5 text-center text-xs text-slate-500 dark:text-slate-400 font-medium">
                                                    {Math.round(entry.timeTakenSeconds / 60)}m {entry.timeTakenSeconds % 60}s
                                                </td>
                                                <td className="p-3.5 text-right">
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[11px] font-black">
                                                        <span>{entry.prize.icon}</span>
                                                        <span>{entry.prize.label}</span>
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Percentage Prize Tiers Summary Card */}
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800">
                            <h5 className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                <Sparkles size={14} className="text-amber-500" />
                                <span>Percentage Prize Structure (% ke aadhar par prize):</span>
                            </h5>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                                {prizeTiers.map((t) => (
                                    <div key={t.id} className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-2">
                                        <span className="text-base">{t.icon}</span>
                                        <div>
                                            <span className="font-bold text-amber-600 dark:text-amber-400 block">{t.minPercentage}%{t.maxPercentage ? `-${t.maxPercentage}%` : '+'}</span>
                                            <span className="text-slate-600 dark:text-slate-400 text-[10px] leading-tight block">{t.label}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Today's Challenge Leaderboard — same questions for all, fair ranking */}
            {tab === 'TODAY' && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                    {myTodayRank > 0 && (
                        <div className="bg-blue-50 dark:bg-blue-950/50 border-b border-blue-100 dark:border-blue-900 px-4 py-2.5 text-xs font-bold text-blue-700 dark:text-blue-300 flex items-center justify-between">
                            <span>🎯 Aapki live rank: #{myTodayRank} out of {challengeEntries.length}</span>
                            <span className="text-[11px] text-blue-500">Kal iska final prize aayega</span>
                        </div>
                    )}
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 text-xs uppercase font-bold">
                                <tr>
                                    <th className="p-4">Rank</th>
                                    <th className="p-4">Student</th>
                                    <th className="p-4 text-right">Score %</th>
                                    <th className="p-4 text-right">Time</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {loading && (
                                    <tr><td colSpan={4} className="p-8 text-center text-slate-400">Loading...</td></tr>
                                )}
                                {!loading && challengeEntries.length === 0 && (
                                    <tr><td colSpan={4} className="p-8 text-center text-slate-500">
                                        Abhi koi record nahi. Pehle aaj ka challenge complete karo!
                                    </td></tr>
                                )}
                                {!loading && challengeEntries.map((entry, idx) => (
                                    <tr
                                        key={entry.userId}
                                        className={`${idx < 3 ? 'bg-yellow-50/30 dark:bg-yellow-950/20' : ''} ${entry.userId === user?.id ? 'bg-blue-50/50 dark:bg-blue-950/40' : ''}`}
                                    >
                                        <td className="p-4 font-bold text-slate-600 dark:text-slate-300">
                                            {idx === 0 && <Medal size={20} className="text-yellow-500 inline mr-1" />}
                                            {idx === 1 && <Medal size={20} className="text-slate-400 inline mr-1" />}
                                            {idx === 2 && <Medal size={20} className="text-orange-600 inline mr-1" />}
                                            {idx > 2 ? `#${idx + 1}` : `${idx + 1}`}
                                        </td>
                                        <td className="p-4 font-medium text-slate-800 dark:text-white flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300">
                                                {entry.userName.charAt(0)}
                                            </div>
                                            <span>{entry.userName}{entry.userId === user?.id ? ' (Aap)' : ''}</span>
                                        </td>
                                        <td className="p-4 text-right font-black text-blue-600 dark:text-blue-400">
                                            {entry.percentage}%
                                            <span className="text-xs text-slate-400 font-normal ml-1">
                                                ({entry.score}/{entry.totalQuestions})
                                            </span>
                                        </td>
                                        <td className="p-4 text-right text-sm text-slate-500 dark:text-slate-400">
                                            {Math.round(entry.timeTakenSeconds / 60)}m {entry.timeTakenSeconds % 60}s
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <p className="text-xs text-slate-400 text-center p-3 border-t border-slate-100 dark:border-slate-800">
                        Sabhi students ne aaj ek hi challenge diya — kal iska final result aur % prize milega 🏆
                    </p>
                </div>
            )}

            {/* All-time local leaderboard */}
            {tab === 'ALL' && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs uppercase font-bold">
                                <tr>
                                    <th className="p-4">Rank</th>
                                    <th className="p-4">Student</th>
                                    <th className="p-4">Topic</th>
                                    <th className="p-4 text-right">Score</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {localEntries.length === 0 && (
                                    <tr><td colSpan={4} className="p-8 text-center text-slate-500">No records yet. Be the first!</td></tr>
                                )}
                                {localEntries.map((entry, idx) => (
                                    <tr key={entry.id} className={idx < 3 ? 'bg-yellow-50/30 dark:bg-yellow-950/20' : ''}>
                                        <td className="p-4 font-bold text-slate-600 dark:text-slate-300">
                                            {idx === 0 && <Medal size={20} className="text-yellow-500 inline mr-1" />}
                                            {idx === 1 && <Medal size={20} className="text-slate-400 inline mr-1" />}
                                            {idx === 2 && <Medal size={20} className="text-orange-600 inline mr-1" />}
                                            {idx > 2 ? `#${idx + 1}` : `${idx + 1}`}
                                        </td>
                                        <td className="p-4 font-medium text-slate-800 dark:text-white flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300">
                                                {entry.userName.charAt(0)}
                                            </div>
                                            {entry.userName}
                                        </td>
                                        <td className="p-4 text-sm text-slate-600 dark:text-slate-400">{entry.topic}</td>
                                        <td className="p-4 text-right font-black text-blue-600 dark:text-blue-400">{entry.score} pts</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};
