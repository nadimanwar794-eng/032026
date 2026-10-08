import React, { useEffect, useState, useMemo } from 'react';
import { User, SystemSettings } from '../types';
import { 
  Trophy, Medal, TrendingUp, Users, X, Gift, Sparkles, CheckCircle, 
  Clock, Target, Search, ArrowRight, ShieldCheck, Award, Flame, Star, ChevronRight
} from 'lucide-react';
import { 
  getYesterdayDateKey, 
  getTodayDateKey, 
  formatChallengeDate, 
  fetchChallengeLeaderboardWithPrizes, 
  claimDailyChallengePrize, 
  isChallengePrizeClaimed,
  getChallengePrizeTiers,
  RankedChallengeParticipant,
  ChallengePrizeTier
} from '../utils/challengePrizeSystem';

interface Props {
  userId: string;
  classLevel?: string;
  user?: User;
  settings?: SystemSettings;
  onUpdateUser?: (updatedUser: User) => void;
  onClose: () => void;
  onStartTodayChallenge?: () => void;
}

export const DailyChallengeRankCard: React.FC<Props> = ({
  userId,
  classLevel = '10',
  user,
  settings,
  onUpdateUser,
  onClose,
  onStartTodayChallenge
}) => {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<RankedChallengeParticipant[]>([]);
  const [userEntry, setUserEntry] = useState<RankedChallengeParticipant | null>(null);
  const [activeTab, setActiveTab] = useState<'LIST' | 'RULES'>('LIST');
  const [searchQuery, setSearchQuery] = useState('');
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimedSuccess, setClaimedSuccess] = useState<string | null>(null);

  const yesterdayDate = useMemo(() => getYesterdayDateKey(), []);
  const formattedYesterday = useMemo(() => formatChallengeDate(yesterdayDate), [yesterdayDate]);
  const prizeTiers = useMemo(() => getChallengePrizeTiers(settings?.prizeRules), [settings?.prizeRules]);

  const alreadyClaimed = useMemo(() => {
    return isChallengePrizeClaimed(yesterdayDate, userId);
  }, [yesterdayDate, userId, claimedSuccess]);

  // Load yesterday's leaderboard
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    fetchChallengeLeaderboardWithPrizes(yesterdayDate, classLevel, userId, settings?.prizeRules)
      .then(({ entries: rankedEntries, userEntry: foundUserEntry }) => {
        if (!isMounted) return;
        setEntries(rankedEntries);
        setUserEntry(foundUserEntry);
        setLoading(false);
      })
      .catch(() => {
        if (!isMounted) return;
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [yesterdayDate, classLevel, userId, settings?.prizeRules]);

  const handleClaimPrize = async () => {
    if (!userEntry || !user || isClaiming || alreadyClaimed) return;
    setIsClaiming(true);

    try {
      const result = await claimDailyChallengePrize(
        user,
        yesterdayDate,
        userEntry,
        settings?.prizeRules,
        settings
      );

      if (result.success) {
        setClaimedSuccess(result.message);
        if (onUpdateUser) {
          onUpdateUser(result.updatedUser);
        }
      } else {
        alert(result.message);
      }
    } catch (e) {
      console.error('Failed to claim prize:', e);
    } finally {
      setIsClaiming(false);
    }
  };

  // Filtered entries for search
  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return entries;
    const q = searchQuery.toLowerCase().trim();
    return entries.filter(e => e.userName.toLowerCase().includes(q));
  }, [entries, searchQuery]);

  const userRank = userEntry ? userEntry.rank : 0;
  const totalCount = entries.length;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/70 rounded-3xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden relative text-white">
        
        {/* Header Bar */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-500/20 via-indigo-500/20 to-purple-500/20 border-b border-slate-800 flex items-center justify-between relative">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
              <Trophy size={24} className="text-white drop-shadow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
                  Kal Ka Challenge Result
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase">
                  Final Ranks
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                <span>📅 {formattedYesterday}</span>
                <span>•</span>
                <span>Class {classLevel}</span>
                <span>•</span>
                <span>{totalCount} Participants</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-800/80 hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-white transition-colors border border-slate-700"
          >
            <X size={18} />
          </button>
        </div>

        {/* User's Personal Result & Prize Claim Box */}
        <div className="p-4 bg-gradient-to-b from-slate-800/90 to-slate-900 border-b border-slate-800">
          {loading ? (
            <div className="flex items-center justify-center py-6 gap-3 text-slate-400 text-sm">
              <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
              <span>Kal ka leaderboard load ho raha hai...</span>
            </div>
          ) : userEntry ? (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-800/70 p-3.5 rounded-2xl border border-slate-700/80">
                <div className="flex items-center gap-3">
                  <div className={`w-13 h-13 rounded-2xl flex flex-col items-center justify-center font-black shadow-md shrink-0 ${
                    userRank === 1 ? 'bg-gradient-to-br from-yellow-400 to-amber-600 text-black' :
                    userRank === 2 ? 'bg-gradient-to-br from-slate-200 to-slate-400 text-black' :
                    userRank === 3 ? 'bg-gradient-to-br from-amber-600 to-orange-700 text-white' :
                    'bg-slate-700 text-white'
                  }`}>
                    <span className="text-xs uppercase font-bold leading-none">Rank</span>
                    <span className="text-lg font-black leading-tight">#{userRank}</span>
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm sm:text-base font-black text-white">{userEntry.userName}</h4>
                      <span className="px-1.5 py-0.2 bg-blue-500/20 text-blue-300 text-[10px] font-bold rounded">Tum</span>
                    </div>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Score: <span className="font-bold text-emerald-400">{userEntry.score}/{userEntry.totalQuestions} ({Math.round(userEntry.percentage)}%)</span> • Time: <span className="font-medium text-slate-300">{Math.round(userEntry.timeTakenSeconds / 60)}m {userEntry.timeTakenSeconds % 60}s</span>
                    </p>
                  </div>
                </div>

                <div className="text-left sm:text-right shrink-0">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Percentile</span>
                  <span className="text-xs sm:text-sm font-black text-amber-400">
                    {totalCount > 1 ? `Top ${Math.max(1, Math.round(((totalCount - userRank + 1) / totalCount) * 100))}% Students` : 'Participant'}
                  </span>
                </div>
              </div>

              {/* Prize Reward Banner for User */}
              <div className="bg-gradient-to-r from-amber-500/15 via-purple-500/15 to-indigo-500/15 border border-amber-500/30 rounded-2xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{userEntry.prize.icon}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                        Aapka Prize ({Math.round(userEntry.percentage)}% Score Par)
                      </span>
                    </div>
                    <p className="text-sm font-black text-white mt-0.5">
                      {userEntry.prize.label}
                    </p>
                  </div>
                </div>

                <div className="w-full sm:w-auto shrink-0">
                  {alreadyClaimed ? (
                    <div className="px-4 py-2 bg-emerald-500/20 border border-emerald-500/40 rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-300">
                      <CheckCircle size={15} />
                      <span>Prize Claimed</span>
                    </div>
                  ) : (
                    <button
                      onClick={handleClaimPrize}
                      disabled={isClaiming}
                      className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-black text-xs rounded-xl shadow-lg shadow-amber-500/25 flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                    >
                      <Gift size={15} />
                      <span>{isClaiming ? 'Claim ho raha hai...' : '🎁 Claim My Prize'}</span>
                    </button>
                  )}
                </div>
              </div>

              {claimedSuccess && (
                <div className="p-3 bg-emerald-950/80 border border-emerald-600 rounded-xl text-xs text-emerald-300 font-bold flex items-center gap-2 animate-in fade-in">
                  <CheckCircle size={16} className="text-emerald-400 shrink-0" />
                  <span>{claimedSuccess}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-800/60 p-3.5 rounded-2xl border border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-black text-slate-300 flex items-center gap-1.5">
                  <span>ℹ️ Kal ke challenge me aapka entry nahi mila</span>
                </h4>
                <p className="text-[11px] text-slate-400 mt-1">
                  Aap kal ke sabhi winners ki list dekh sakte hain. Aaj ka challenge de kar agle prize ke liye qualify karein!
                </p>
              </div>

              {onStartTodayChallenge && (
                <button
                  onClick={() => {
                    onClose();
                    onStartTodayChallenge();
                  }}
                  className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shrink-0 transition-all cursor-pointer"
                >
                  <span>Start Aaj Ka Challenge</span>
                  <ArrowRight size={14} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Navigation Tabs: Leaderboard List vs Prize Rules */}
        <div className="flex items-center gap-2 px-4 pt-3 pb-2 bg-slate-900 border-b border-slate-800">
          <button
            onClick={() => setActiveTab('LIST')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'LIST'
                ? 'bg-amber-500 text-black shadow-md'
                : 'bg-slate-800/70 text-slate-400 hover:text-white'
            }`}
          >
            <Users size={14} />
            <span>Sabhi Students Ki Rank List ({entries.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('RULES')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'RULES'
                ? 'bg-amber-500 text-black shadow-md'
                : 'bg-slate-800/70 text-slate-400 hover:text-white'
            }`}
          >
            <Award size={14} />
            <span>% Prize Criteria ({prizeTiers.length} Tiers)</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {activeTab === 'LIST' ? (
            <>
              {/* Search Bar */}
              <div className="relative">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search student by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              {/* Leaderboard Table / Cards */}
              {loading ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  Loading rankings...
                </div>
              ) : filteredEntries.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  Koi student nahi mila.
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredEntries.map((entry) => {
                    const isUser = entry.userId === userId;
                    const isTop1 = entry.rank === 1;
                    const isTop2 = entry.rank === 2;
                    const isTop3 = entry.rank === 3;

                    return (
                      <div
                        key={entry.userId}
                        className={`p-3 rounded-2xl flex items-center justify-between gap-3 border transition-all ${
                          isUser
                            ? 'bg-blue-950/40 border-blue-500/60 shadow-lg shadow-blue-500/10'
                            : isTop1
                            ? 'bg-amber-950/25 border-amber-500/40'
                            : isTop2
                            ? 'bg-slate-800/80 border-slate-600/50'
                            : isTop3
                            ? 'bg-orange-950/20 border-orange-600/40'
                            : 'bg-slate-800/50 border-slate-700/60'
                        }`}
                      >
                        {/* Left: Rank & Avatar & Name */}
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                            isTop1 ? 'bg-gradient-to-br from-yellow-400 to-amber-600 text-black shadow-sm' :
                            isTop2 ? 'bg-gradient-to-br from-slate-200 to-slate-400 text-black shadow-sm' :
                            isTop3 ? 'bg-gradient-to-br from-amber-600 to-orange-700 text-white shadow-sm' :
                            'bg-slate-700 text-slate-300'
                          }`}>
                            {isTop1 ? '🥇' : isTop2 ? '🥈' : isTop3 ? '🥉' : `#${entry.rank}`}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className={`font-bold text-xs sm:text-sm truncate ${isUser ? 'text-blue-300 font-black' : 'text-white'}`}>
                                {entry.userName}
                              </p>
                              {isUser && (
                                <span className="px-1.5 py-0.2 bg-blue-500 text-white text-[9px] font-black rounded shrink-0">
                                  Aap
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              {entry.score}/{entry.totalQuestions} sahi • {Math.round(entry.timeTakenSeconds / 60)}m {entry.timeTakenSeconds % 60}s
                            </p>
                          </div>
                        </div>

                        {/* Right: Percentage & Prize Won */}
                        <div className="text-right shrink-0">
                          <div className="text-xs sm:text-sm font-black text-emerald-400">
                            {Math.round(entry.percentage)}%
                          </div>
                          <div className="inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[10px] font-bold">
                            <span>{entry.prize.icon}</span>
                            <span className="truncate max-w-[120px] sm:max-w-[160px]">{entry.prize.label}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            /* PRIZE RULES / PERCENTAGE CRITERIA TAB */
            <div className="space-y-3">
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
                <h4 className="text-xs font-black text-amber-300 flex items-center gap-1.5 mb-1">
                  <Sparkles size={14} />
                  <span>Percentage Rewards Policy</span>
                </h4>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Daily Challenge me aapka jitna % score aayega, agle din subah result aane par utna prize aapko milega:
                </p>
              </div>

              <div className="space-y-2.5">
                {prizeTiers.map((tier) => (
                  <div
                    key={tier.id}
                    className="p-3.5 bg-slate-800/70 border border-slate-700 rounded-2xl flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-700/80 flex items-center justify-center text-xl shrink-0">
                        {tier.icon}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-white">{tier.label}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Criteria: <span className="font-bold text-amber-400">{tier.minPercentage}%{tier.maxPercentage ? ` - ${tier.maxPercentage}%` : '+'}</span> Score
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-black uppercase">
                        {tier.badge}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-3">
          <p className="text-[11px] text-slate-400">
            Sabhi students ke liye fair leaderboard 🏆
          </p>

          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer border border-slate-700"
          >
            Theek hai
          </button>
        </div>
      </div>
    </div>
  );
};
