import React, { useEffect, useState } from 'react';
import { getDailyChallengeLeaderboard, DailyChallengeEntry } from '../firebase';
import { Trophy, Medal, TrendingUp, Users, X } from 'lucide-react';

interface Props {
    userId: string;
    classLevel: string;
    onClose: () => void;
}

interface RankResult {
    rank: number;
    totalParticipants: number;
    entry: DailyChallengeEntry;
    top3: DailyChallengeEntry[];
}

function getYesterdayDate(): string {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
}

function rankLabel(rank: number): string {
    if (rank === 1) return '🥇 1st';
    if (rank === 2) return '🥈 2nd';
    if (rank === 3) return '🥉 3rd';
    return `#${rank}`;
}

function rankColor(rank: number): string {
    if (rank === 1) return 'from-yellow-400 to-amber-500';
    if (rank === 2) return 'from-slate-400 to-slate-500';
    if (rank === 3) return 'from-orange-400 to-orange-500';
    if (rank <= 10) return 'from-blue-500 to-blue-600';
    return 'from-slate-500 to-slate-600';
}

export const DailyChallengeRankCard: React.FC<Props> = ({ userId, classLevel, onClose }) => {
    const [result, setResult] = useState<RankResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        const yesterday = getYesterdayDate();
        getDailyChallengeLeaderboard(yesterday, classLevel)
            .then(entries => {
                if (entries.length === 0) { setError(true); setLoading(false); return; }
                const rank = entries.findIndex(e => e.userId === userId) + 1;
                if (rank === 0) { setError(true); setLoading(false); return; }
                setResult({
                    rank,
                    totalParticipants: entries.length,
                    entry: entries[rank - 1],
                    top3: entries.slice(0, 3),
                });
                setLoading(false);
            })
            .catch(() => { setError(true); setLoading(false); });
    }, [userId, classLevel]);

    if (loading) return (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/40">
            <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl flex items-center justify-center gap-3">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-slate-600 font-medium">Kal ka rank dhundh rahe hain…</span>
            </div>
        </div>
    );

    if (error || !result) return null;

    const { rank, totalParticipants, entry, top3 } = result;
    const percentile = Math.round(((totalParticipants - rank) / totalParticipants) * 100);

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">

                {/* Header gradient */}
                <div className={`bg-gradient-to-r ${rankColor(rank)} p-6 text-white text-center relative`}>
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 bg-white/20 rounded-full p-1.5 hover:bg-white/30 transition-colors"
                    >
                        <X size={16} />
                    </button>
                    <p className="text-white/80 text-sm font-medium mb-1">Kal ka Daily Challenge</p>
                    <div className="text-5xl font-black mb-1">{rankLabel(rank)}</div>
                    <p className="text-white/90 text-sm">
                        {totalParticipants} participants mein se
                    </p>
                    {percentile > 0 && (
                        <div className="mt-2 bg-white/20 rounded-full px-4 py-1 inline-block text-sm font-bold">
                            Top {100 - percentile}% students se aage
                        </div>
                    )}
                </div>

                {/* Score row */}
                <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100">
                    <div className="p-4 text-center">
                        <p className="text-2xl font-black text-slate-800">{entry.score}</p>
                        <p className="text-xs text-slate-500 mt-0.5">Sahi</p>
                    </div>
                    <div className="p-4 text-center">
                        <p className="text-2xl font-black text-slate-800">{entry.totalQuestions - entry.score}</p>
                        <p className="text-xs text-slate-500 mt-0.5">Galat</p>
                    </div>
                    <div className="p-4 text-center">
                        <p className="text-2xl font-black text-slate-800">{Math.round(entry.percentage)}%</p>
                        <p className="text-xs text-slate-500 mt-0.5">Score</p>
                    </div>
                </div>

                {/* Top 3 leaderboard */}
                {top3.length > 0 && (
                    <div className="p-4 space-y-2">
                        <div className="flex items-center gap-2 mb-3">
                            <Trophy size={16} className="text-amber-500" />
                            <p className="text-sm font-bold text-slate-700">Top Performers</p>
                        </div>
                        {top3.map((e, i) => {
                            const isMe = e.userId === userId;
                            return (
                                <div
                                    key={e.userId}
                                    className={`flex items-center gap-3 p-2.5 rounded-xl ${isMe ? 'bg-blue-50 border border-blue-200' : 'bg-slate-50'}`}
                                >
                                    <span className="text-lg w-8 text-center">
                                        {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <p className={`font-bold text-sm truncate ${isMe ? 'text-blue-700' : 'text-slate-800'}`}>
                                            {e.userName} {isMe && '(Tum)'}
                                        </p>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <p className="font-black text-sm text-slate-800">{Math.round(e.percentage)}%</p>
                                        <p className="text-xs text-slate-400">{e.score}/{e.totalQuestions}</p>
                                    </div>
                                </div>
                            );
                        })}

                        {/* Show user's own row if not in top 3 */}
                        {rank > 3 && (
                            <>
                                <div className="text-center text-xs text-slate-400 py-1">• • •</div>
                                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-blue-50 border border-blue-200">
                                    <span className="text-sm font-black text-blue-700 w-8 text-center">#{rank}</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-sm text-blue-700 truncate">{entry.userName} (Tum)</p>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <p className="font-black text-sm text-slate-800">{Math.round(entry.percentage)}%</p>
                                        <p className="text-xs text-slate-400">{entry.score}/{entry.totalQuestions}</p>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* Footer */}
                <div className="px-4 pb-4">
                    <button
                        onClick={onClose}
                        className="w-full py-3 bg-slate-800 text-white font-black rounded-xl hover:bg-slate-700 transition-colors"
                    >
                        Theek hai!
                    </button>
                </div>
            </div>
        </div>
    );
};
