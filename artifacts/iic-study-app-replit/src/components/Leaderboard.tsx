
import React, { useState, useEffect } from 'react';
import { LeaderboardEntry, User, SystemSettings } from '../types';
import { Trophy, Medal, Zap, Users } from 'lucide-react';
import { getDailyChallengeLeaderboard, DailyChallengeEntry } from '../firebase';

interface Props {
  user: User;
  settings?: SystemSettings;
}

export const Leaderboard: React.FC<Props> = ({ user, settings }) => {
    const [localEntries, setLocalEntries] = useState<LeaderboardEntry[]>([]);
    const [challengeEntries, setChallengeEntries] = useState<DailyChallengeEntry[]>([]);
    const [tab, setTab] = useState<'TODAY' | 'ALL'>('TODAY');
    const [loading, setLoading] = useState(false);

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

    const myRank = tab === 'TODAY'
        ? challengeEntries.findIndex(e => e.userId === user?.id) + 1
        : 0;

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4">
            <h3 className="text-2xl font-black text-slate-800 mb-4 flex items-center gap-3">
                <Trophy className="text-yellow-500" /> Challenge Leaderboard
            </h3>

            {/* Tab Toggle */}
            <div className="flex gap-2 mb-5">
                <button
                    onClick={() => setTab('TODAY')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                        tab === 'TODAY'
                            ? 'bg-blue-600 text-white shadow'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                >
                    <Zap size={14} />
                    Aaj Ka Challenge
                </button>
                <button
                    onClick={() => setTab('ALL')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                        tab === 'ALL'
                            ? 'bg-blue-600 text-white shadow'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                >
                    <Users size={14} />
                    All Records
                </button>
            </div>

            {/* Today's Challenge Leaderboard — same questions for all, fair ranking */}
            {tab === 'TODAY' && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    {myRank > 0 && (
                        <div className="bg-blue-50 border-b border-blue-100 px-4 py-2 text-sm font-semibold text-blue-700">
                            🎯 Aapki rank: #{myRank} out of {challengeEntries.length}
                        </div>
                    )}
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 text-slate-600 text-xs uppercase font-bold">
                                <tr>
                                    <th className="p-4">Rank</th>
                                    <th className="p-4">Student</th>
                                    <th className="p-4 text-right">Score %</th>
                                    <th className="p-4 text-right">Time</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading && (
                                    <tr><td colSpan={4} className="p-8 text-center text-slate-400">Loading...</td></tr>
                                )}
                                {!loading && challengeEntries.length === 0 && (
                                    <tr><td colSpan={4} className="p-8 text-center text-slate-500">
                                        Abhi koi record nahi. Pehle challenge complete karo!
                                    </td></tr>
                                )}
                                {!loading && challengeEntries.map((entry, idx) => (
                                    <tr
                                        key={entry.userId}
                                        className={`${idx < 3 ? 'bg-yellow-50/30' : ''} ${entry.userId === user?.id ? 'bg-blue-50/50' : ''}`}
                                    >
                                        <td className="p-4 font-bold text-slate-600">
                                            {idx === 0 && <Medal size={20} className="text-yellow-500" />}
                                            {idx === 1 && <Medal size={20} className="text-slate-500" />}
                                            {idx === 2 && <Medal size={20} className="text-orange-600" />}
                                            {idx > 2 && `#${idx + 1}`}
                                        </td>
                                        <td className="p-4 font-medium text-slate-800 flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
                                                {entry.userName.charAt(0)}
                                            </div>
                                            <span>{entry.userName}{entry.userId === user?.id ? ' (Aap)' : ''}</span>
                                        </td>
                                        <td className="p-4 text-right font-black text-blue-600">
                                            {entry.percentage}%
                                            <span className="text-xs text-slate-400 font-normal ml-1">
                                                ({entry.score}/{entry.totalQuestions})
                                            </span>
                                        </td>
                                        <td className="p-4 text-right text-sm text-slate-500">
                                            {Math.round(entry.timeTakenSeconds / 60)}m {entry.timeTakenSeconds % 60}s
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <p className="text-xs text-slate-400 text-center p-3 border-t border-slate-100">
                        Sabhi students ne aaj ek hi challenge diya — yeh ranking fair hai 🏆
                    </p>
                </div>
            )}

            {/* All-time local leaderboard */}
            {tab === 'ALL' && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 text-slate-600 text-xs uppercase font-bold">
                                <tr>
                                    <th className="p-4">Rank</th>
                                    <th className="p-4">Student</th>
                                    <th className="p-4">Topic</th>
                                    <th className="p-4 text-right">Score</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {localEntries.length === 0 && (
                                    <tr><td colSpan={4} className="p-8 text-center text-slate-500">No records yet. Be the first!</td></tr>
                                )}
                                {localEntries.map((entry, idx) => (
                                    <tr key={entry.id} className={idx < 3 ? 'bg-yellow-50/30' : ''}>
                                        <td className="p-4 font-bold text-slate-600">
                                            {idx === 0 && <Medal size={20} className="text-yellow-500" />}
                                            {idx === 1 && <Medal size={20} className="text-slate-500" />}
                                            {idx === 2 && <Medal size={20} className="text-orange-600" />}
                                            {idx > 2 && `#${idx + 1}`}
                                        </td>
                                        <td className="p-4 font-medium text-slate-800 flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
                                                {entry.userName.charAt(0)}
                                            </div>
                                            {entry.userName}
                                        </td>
                                        <td className="p-4 text-sm text-slate-600">{entry.topic}</td>
                                        <td className="p-4 text-right font-black text-blue-600">{entry.score} pts</td>
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
