import React, { useState, useMemo } from 'react';
import {
  X,
  Gift,
  Check,
  ArrowRight,
  Share2,
  Copy,
  Users,
  Sparkles,
  Award,
  AlertTriangle,
  Clock,
  Zap,
  Crown,
  Percent,
  ShieldCheck,
  UserCheck,
  UserX,
  MessageCircle,
  Search,
} from 'lucide-react';
import { User, ReferredUserRecord, SystemSettings } from '../types';
import { saveUserToLive } from '../firebase';
import { safeSaveUsersCache } from '../utils/safeUtils';
import {
  REFERRAL_MILESTONES,
  getEffectiveReferralMilestones,
  getReferralStats,
  claimReferralMilestoneReward,
  getReferrerRoyaltyRate,
} from '../utils/referralEngine';

interface Props {
  user: User;
  settings?: SystemSettings;
  onClose: () => void;
  onUpdateUser: (u: User) => void;
}

export const ReferralPopup: React.FC<Props> = ({ user, settings, onClose, onUpdateUser }) => {
  // Consolidated into 2 rich, uniform tabs
  const [activeTab, setActiveTab] = useState<'FRIENDS' | 'MILESTONES'>('FRIENDS');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'PENDING' | 'INACTIVE'>('ALL');
  const [showEnterCode, setShowEnterCode] = useState(!user.redeemedReferralCode);

  const effectiveMilestones = useMemo(
    () => getEffectiveReferralMilestones(settings?.referralMilestones),
    [settings?.referralMilestones]
  );
  const myReferralCode = user.displayId || user.id;
  const stats = getReferralStats(user);
  const royaltyRate = getReferrerRoyaltyRate(user.level);
  const claimedMilestones = user.claimedReferralMilestones || [];

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(myReferralCode);
    setCopied(true);
    showToast('Referral code copied to clipboard!');
    setTimeout(() => setCopied(false), 2500);
  };

  const handleShareWhatsApp = () => {
    const text = `🌟 Bhai IIC Study App download kar! Mere referral code "${myReferralCode}" se signup karega aur 1 ghanta padhai karega toh tujhe turant +100 Credits free milenge! Saare Notes, MCQs aur Live Chat unlock kar: ${window.location.origin}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleRemindFriend = (friend: ReferredUserRecord) => {
    const text = `👋 Hey ${friend.userName}, IIC Study App par aapka revision ruka hua hai! Jaldi se app kholo aur daily test complete karo taaki aapka streak bana rahe: ${window.location.origin}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleRemindAllDead = () => {
    const text = `🔥 Doston, IIC Study App par naye chapters aur tests aa gaye hain! App kholo aur padhai shuru karo: ${window.location.origin}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleClaimMilestone = async (target: number) => {
    const res = claimReferralMilestoneReward(user, target, effectiveMilestones);
    if (!res.success) {
      showToast(res.message);
      return;
    }

    onUpdateUser(res.updatedUser);
    try {
      localStorage.setItem('nst_current_user', JSON.stringify(res.updatedUser));
      const stored = localStorage.getItem('nst_users');
      if (stored) {
        const allUsers: User[] = JSON.parse(stored);
        const updatedAll = allUsers.map((u) => (u.id === res.updatedUser.id ? res.updatedUser : u));
        safeSaveUsersCache(updatedAll);
      }
      window.dispatchEvent(new CustomEvent('user-updated', { detail: res.updatedUser }));
    } catch {}

    await saveUserToLive(res.updatedUser).catch((err) => {
      console.warn('[ReferralPopup] saveUserToLive notice:', err);
    });

    showToast(res.message);
  };

  const handleApplyCode = async () => {
    if (!code.trim()) return;
    const cleanCode = code.trim().toUpperCase();

    if (cleanCode === (user.displayId || user.id).toUpperCase()) {
      setError('Aap apna hi referral code use nahi kar sakte.');
      return;
    }

    if (user.redeemedReferralCode) {
      setError('Aap pehle hi ek referral code claim kar chuke hain.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const stored = localStorage.getItem('nst_users');
      const allUsers: User[] = stored ? JSON.parse(stored) : [];
      const referrer = allUsers.find(
        (u) =>
          (u.displayId && u.displayId.toUpperCase() === cleanCode) ||
          (u.id && u.id.toUpperCase() === cleanCode) ||
          u.mobile === cleanCode
      );

      // Save referral linkage to current user
      const updatedUser: User = {
        ...user,
        redeemedReferralCode: cleanCode,
        referrerId: referrer ? referrer.id : cleanCode,
        referralStudySeconds: user.referralStudySeconds || 0,
        referralRewardClaimed: false,
      };

      if (referrer) {
        const newRecord: ReferredUserRecord = {
          userId: user.id,
          userName: user.name || 'New Student',
          userPhoto: user.photoURL,
          joinedAt: new Date().toISOString(),
          activeMinutes: Math.floor((user.referralStudySeconds || 0) / 60),
          isCompleted: false,
          lastActiveAt: new Date().toISOString(),
          isDead: false,
          totalCreditsSpent: 0,
          commissionEarned: 0,
        };

        const existingList = referrer.referredUsersList || [];
        const filtered = existingList.filter((r) => r.userId !== user.id);
        const updatedList = [newRecord, ...filtered];

        const updatedReferrer: User = {
          ...referrer,
          referralCount: (referrer.referralCount || 0) + 1,
          referredUsersList: updatedList,
        };

        const newUsersList = allUsers.map((u) => {
          if (u.id === user.id) return updatedUser;
          if (u.id === referrer.id) return updatedReferrer;
          return u;
        });
        safeSaveUsersCache(newUsersList);
        saveUserToLive(updatedReferrer).catch(() => {});
      }

      await saveUserToLive(updatedUser).catch(() => {});
      onUpdateUser(updatedUser);
      setShowEnterCode(false);
      showToast('Referral code applied! 60 min study complete karte hi 100 credits milenge.');
    } catch (e: any) {
      setError(e.message || 'Referral code verify karne me samasya aayi.');
    } finally {
      setLoading(false);
    }
  };

  const inviteeStudyMinutes = Math.floor((user.referralStudySeconds || 0) / 60);
  const inviteeProgressPct = Math.min(100, Math.round((inviteeStudyMinutes / 60) * 100));

  // Filtered friends list for search & status
  const filteredFriends = useMemo(() => {
    return stats.list.filter((friend) => {
      const matchesSearch = friend.userName.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;
      if (statusFilter === 'ACTIVE') return friend.isCompleted && !friend.isDead;
      if (statusFilter === 'PENDING') return !friend.isCompleted;
      if (statusFilter === 'INACTIVE') return friend.isCompleted && friend.isDead;
      return true;
    });
  }, [stats.list, searchQuery, statusFilter]);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      {/* Uniform fixed height container across all views: prevents jumping/shifting */}
      <div className="bg-slate-950 rounded-3xl w-full max-w-xl h-[88vh] max-h-[740px] min-h-[580px] flex flex-col shadow-2xl border border-slate-800 relative text-white overflow-hidden">
        
        {/* Toast Notification */}
        {toastMsg && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 text-slate-950 font-black text-xs px-4 py-2 rounded-full shadow-2xl border border-amber-300 flex items-center gap-1.5 animate-in slide-in-from-top duration-200">
            <Check size={14} strokeWidth={3.5} />
            <span>{toastMsg}</span>
          </div>
        )}

        {/* Header - Fixed Height */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-gradient-to-r from-slate-900 via-purple-950/40 to-slate-900 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-400 via-purple-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-900/40 border border-amber-300/30 shrink-0">
              <Gift size={22} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">Refer & Earn</h2>
                <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-400/15 text-amber-300 border border-amber-400/40 shadow-sm">
                  VIP Rewards
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Doston ko bulayein aur Free Subscriptions, Diamonds 💎 & Credits paayein!
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-400 hover:text-white transition-colors shrink-0 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* 2-Tab Navigation Bar - Fixed Height */}
        <div className="grid grid-cols-2 gap-2 p-2 bg-slate-900/90 border-b border-slate-800 text-xs font-bold shrink-0">
          <button
            onClick={() => setActiveTab('FRIENDS')}
            className={`py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-2 ${
              activeTab === 'FRIENDS'
                ? 'bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 text-white shadow-lg shadow-indigo-900/40 border border-indigo-400/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Users size={15} />
            <span>Friends & Invites ({stats.totalInvited})</span>
          </button>

          <button
            onClick={() => setActiveTab('MILESTONES')}
            className={`py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-2 ${
              activeTab === 'MILESTONES'
                ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 text-slate-950 font-black shadow-lg shadow-amber-500/25 border border-amber-300/40'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Award size={15} />
            <span>Milestones & Royalty</span>
          </button>
        </div>

        {/* Scrollable Content Body with uniform flex-1 min-h-0 */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4 text-slate-200">
          
          {/* TAB 1: FRIENDS & INVITES (MAIN PAGE) */}
          {activeTab === 'FRIENDS' && (
            <div className="space-y-4">
              
              {/* Top Card: Unique Referral Code & Instant WhatsApp Share */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-indigo-950/70 border border-slate-800 shadow-inner">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Aapka Unique Referral Code
                    </span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-mono font-black text-2xl tracking-wider text-amber-300">
                        {myReferralCode}
                      </span>
                      <button
                        onClick={handleCopyCode}
                        className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-white flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
                      >
                        {copied ? <Check size={13} className="text-amber-300" /> : <Copy size={13} />}
                        <span>{copied ? 'Copied!' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={handleShareWhatsApp}
                    className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black rounded-xl shadow-lg shadow-purple-900/40 border border-indigo-400/30 flex items-center justify-center gap-2 active:scale-95 transition-all text-xs cursor-pointer"
                  >
                    <Share2 size={15} /> WhatsApp Par Invite Karein
                  </button>
                </div>

                {/* Redeemed Referral Code Status (If user already used one code) */}
                {user.redeemedReferralCode && (
                  <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                      <span className="text-slate-400 text-[11px]">Applied Code:</span>
                      <span className="font-mono font-bold text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/30 text-[11px]">
                        {user.redeemedReferralCode}
                      </span>
                    </div>
                    <div className="text-[11px] font-semibold text-slate-300">
                      {user.referralRewardClaimed || inviteeStudyMinutes >= 60 ? (
                        <span className="text-amber-300 font-bold flex items-center gap-1">
                          <Check size={12} strokeWidth={3} /> +100 Welcome Credits Unlocked
                        </span>
                      ) : (
                        <span className="text-amber-300">
                          Study Gift: {inviteeStudyMinutes}/60 min ({inviteeProgressPct}%)
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Inline "Have a Friend's Referral Code?" Input Card (Only if code not redeemed yet) */}
              {!user.redeemedReferralCode && (
                <div className="p-3.5 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 text-xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-indigo-300 flex items-center gap-1.5">
                      <Sparkles size={14} className="text-indigo-400" />
                      Dost Ka Code Hai? +100 Credits Paayein
                    </span>
                    <button
                      onClick={() => setShowEnterCode(!showEnterCode)}
                      className="text-[11px] text-indigo-400 hover:text-indigo-200 underline font-semibold"
                    >
                      {showEnterCode ? 'Chhupayein' : 'Code Daalein'}
                    </button>
                  </div>

                  {showEnterCode && (
                    <div className="space-y-2.5 pt-1 animate-in fade-in duration-200">
                      <p className="text-[11px] text-slate-300">
                        Kisi dost ka referral code enter karein. Uske baad app me <strong>1 ghanta (60 min)</strong> study karte hi aapko turant <strong>+100 Welcome Credits 🪙</strong> milenge!
                      </p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={code}
                          onChange={(e) => setCode(e.target.value.toUpperCase())}
                          placeholder="REFERRAL CODE DAALEIN"
                          className="flex-1 px-3 py-2 bg-black/40 border border-white/10 rounded-xl font-mono text-center font-bold tracking-wider text-white text-xs outline-none uppercase focus:border-indigo-400"
                        />
                        <button
                          onClick={handleApplyCode}
                          disabled={loading || !code.trim()}
                          className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 text-white font-bold rounded-xl text-xs flex items-center gap-1 disabled:opacity-40"
                        >
                          {loading ? 'Verifying...' : 'Apply'}
                          <ArrowRight size={13} />
                        </button>
                      </div>
                      {error && <p className="text-rose-400 text-[11px] font-bold">{error}</p>}
                    </div>
                  )}
                </div>
              )}

              {/* 4-Stat Metric Box */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Total Invited</p>
                  <p className="text-lg font-black text-white mt-0.5">{stats.totalInvited}</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-cyan-500/30 text-center">
                  <p className="text-[10px] font-bold text-cyan-300 uppercase flex items-center justify-center gap-1">
                    <UserCheck size={11} /> Active
                  </p>
                  <p className="text-lg font-black text-cyan-300 mt-0.5">{stats.activeCount}</p>
                  <p className="text-[9px] text-slate-500">Last 7 Days</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-rose-500/30 text-center">
                  <p className="text-[10px] font-bold text-rose-400 uppercase flex items-center justify-center gap-1">
                    <UserX size={11} /> Inactive / Dead
                  </p>
                  <p className="text-lg font-black text-rose-400 mt-0.5">{stats.deadCount}</p>
                  <p className="text-[9px] text-slate-500">&gt; 7 Days Idle</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-amber-500/30 text-center">
                  <p className="text-[10px] font-bold text-amber-300 uppercase flex items-center justify-center gap-1">
                    <Percent size={11} /> Royalty
                  </p>
                  <p className="text-lg font-black text-amber-300 mt-0.5">
                    {stats.totalCommission.toFixed(2)}
                  </p>
                  <p className="text-[9px] text-slate-500">Lv {user.level || 1} ({royaltyRate}%)</p>
                </div>
              </div>

              {/* Inactive Users Remind Banner if any */}
              {stats.deadCount > 0 && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={16} className="text-amber-400 shrink-0" />
                    <span>
                      <strong>{stats.deadCount} dost inactive hain.</strong> Unhe remind karein taaki aapka next milestone unlock ho sake!
                    </span>
                  </div>
                  <button
                    onClick={handleRemindAllDead}
                    className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold rounded-xl border border-amber-500/30 text-[11px] flex items-center justify-center gap-1 shrink-0"
                  >
                    <MessageCircle size={12} /> Remind Inactive
                  </button>
                </div>
              )}

              {/* Friends List Controls: Search & Status Filters */}
              <div className="space-y-2 pt-1">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                  {/* Search input */}
                  <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Dost ka naam search karein..."
                      className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  {/* Filter chips */}
                  <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
                    {(['ALL', 'ACTIVE', 'PENDING', 'INACTIVE'] as const).map((tab) => {
                      const labels = {
                        ALL: `All (${stats.totalInvited})`,
                        ACTIVE: `Active (${stats.activeCount})`,
                        PENDING: `Pending (${stats.totalInvited - stats.completedCount})`,
                        INACTIVE: `Inactive (${stats.deadCount})`,
                      };
                      return (
                        <button
                          key={tab}
                          onClick={() => setStatusFilter(tab)}
                          className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold whitespace-nowrap transition-colors ${
                            statusFilter === tab
                              ? 'bg-sky-500 text-white'
                              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                          }`}
                        >
                          {labels[tab]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Friend Cards List */}
                {filteredFriends.length === 0 ? (
                  <div className="text-center py-10 px-4 rounded-2xl bg-slate-900/60 border border-slate-800/80">
                    <Users size={34} className="mx-auto text-slate-600 mb-2" />
                    <p className="text-sm font-bold text-slate-300">
                      {stats.totalInvited === 0
                        ? 'Abhi tak koi dost invite nahi hua hai'
                        : 'Is filter me koi dost nahi mila'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      Apna referral code WhatsApp par share karein aur doston ko join karwayein!
                    </p>
                    {stats.totalInvited === 0 && (
                      <button
                        onClick={handleShareWhatsApp}
                        className="mt-3 px-4 py-2 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-xl text-xs inline-flex items-center gap-2 cursor-pointer shadow-lg shadow-purple-900/30 border border-indigo-400/30"
                      >
                        <Share2 size={13} /> WhatsApp Par Share Karein
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredFriends.map((friend, idx) => {
                      const studyDone = friend.activeMinutes || 0;
                      const studyPct = Math.min(100, Math.round((studyDone / 60) * 100));

                      return (
                        <div
                          key={friend.userId || idx}
                          className="p-3 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-3 hover:border-slate-700 transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-300 text-xs shrink-0 relative overflow-hidden">
                              {friend.userPhoto ? (
                                <img
                                  src={friend.userPhoto}
                                  alt={friend.userName}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    (e.currentTarget as HTMLElement).style.display = 'none';
                                  }}
                                />
                              ) : (
                                friend.userName.charAt(0).toUpperCase()
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-white truncate">{friend.userName}</p>
                              <p className="text-[10px] text-slate-400">
                                Joined: {new Date(friend.joinedAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {!friend.isCompleted ? (
                              <div className="text-right">
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                  ⏳ {studyDone}/60 min
                                </span>
                                <div className="w-16 h-1 bg-slate-800 rounded-full overflow-hidden mt-1 ml-auto">
                                  <div
                                    className="h-full bg-amber-400 rounded-full"
                                    style={{ width: `${studyPct}%` }}
                                  />
                                </div>
                              </div>
                            ) : friend.isDead ? (
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
                                  💤 Inactive (&gt;7d)
                                </span>
                                <button
                                  onClick={() => handleRemindFriend(friend)}
                                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition cursor-pointer"
                                  title="WhatsApp Reminder"
                                >
                                  <MessageCircle size={13} />
                                </button>
                              </div>
                            ) : (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                                🔵 Active
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: MILESTONES & ROYALTY (CONSOLIDATED REWARDS VIEW) */}
          {activeTab === 'MILESTONES' && (
            <div className="space-y-4">
              
              {/* Royalty Cashback Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 via-purple-950/30 to-slate-900 border border-amber-500/30 space-y-3 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                      Lifetime Spend Cashback
                    </span>
                    <h3 className="text-xl font-black text-white mt-0.5">
                      {stats.totalCommission.toFixed(2)} Credits
                    </h3>
                  </div>
                  <div className="px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/30 text-right">
                    <p className="text-[10px] text-slate-400 font-bold">Your Royalty Rate</p>
                    <p className="text-sm font-black text-amber-300">
                      Level {user.level || 1} ({royaltyRate}%)
                    </p>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 text-[11px] text-slate-300 space-y-1">
                  <p className="font-bold text-amber-300 flex items-center gap-1">
                    <Zap size={12} /> Royalty Rule:
                  </p>
                  <p>• Level 1 par <strong>0.01%</strong> cashback se start hokar Level 15 par <strong>0.15%</strong> tak milta hai.</p>
                  <p>• Doston dwara spent har ek credit par aapko automatic wallet return milta hai!</p>
                </div>
              </div>

              {/* 1-Hour Study Requirement & Anti-Loop Policy */}
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-[11px] text-slate-400 space-y-1">
                <p className="font-bold text-slate-300 flex items-center gap-1.5">
                  <Clock size={13} className="text-sky-400" />
                  1-Hour Active Study &amp; Single-Claim Rule:
                </p>
                <p>
                  • Invited dost jab kam se kam <strong>1 ghanta (60 min)</strong> study complete karenge, tabhi unhe 100 credits milenge aur aapka active referral milestone count hoga.
                </p>
                <p>
                  • Ek milestone reward lifetime me <strong>sirf 1 baar</strong> claim ho sakta hai. Inactive users hone ke baad dobara us sankhya par aane par duplicate reward nahi milta.
                </p>
              </div>

              {/* ALL 15 MILESTONES LADDER - EXPANDED LUXURY REWARD BOXES */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <Crown size={15} className="text-amber-400" /> All {effectiveMilestones.length} Milestone Rewards
                  </h3>
                  <span className="text-[11px] font-bold text-slate-400">
                    Active: <strong className="text-amber-300 font-mono">{stats.activeCount.toLocaleString('en-IN')} Users</strong>
                  </span>
                </div>

                <div className="space-y-3">
                  {effectiveMilestones.map((m) => {
                    const isClaimed = claimedMilestones.includes(m.target);
                    const canClaim = !isClaimed && stats.activeCount >= m.target;
                    const progressPct = Math.min(100, Math.round((stats.activeCount / m.target) * 100));

                    return (
                      <div
                        key={m.target}
                        className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                          isClaimed
                            ? 'bg-slate-900/60 border-slate-800/80 shadow-md'
                            : canClaim
                            ? 'bg-gradient-to-br from-amber-500/20 via-purple-950/40 to-slate-900 border-2 border-amber-400 shadow-xl shadow-amber-500/25 ring-1 ring-amber-400/30'
                            : 'bg-gradient-to-br from-slate-900/90 via-slate-900/60 to-indigo-950/30 border border-slate-800/90 hover:border-purple-500/40 shadow-md'
                        }`}
                      >
                        {/* Top Header: Title, Milestone Tag, Active Count Badge */}
                        <div className="flex items-center justify-between gap-2 flex-wrap mb-2.5">
                          <div className="flex items-center gap-2">
                            <div className={`w-auto min-w-[1.75rem] px-1.5 h-7 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                              canClaim
                                ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/30'
                                : isClaimed
                                ? 'bg-slate-800 text-amber-300'
                                : 'bg-purple-950 text-purple-300 border border-purple-500/30'
                            }`}>
                              #{m.target.toLocaleString('en-IN')}
                            </div>
                            <h4 className="text-sm font-black text-white tracking-wide">{m.title}</h4>
                          </div>
                          
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10.5px] font-black px-2.5 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30 shadow-sm">
                              {m.badgeLabel}
                            </span>
                            <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full border ${
                              canClaim
                                ? 'bg-amber-400/20 text-amber-300 border-amber-400/50 font-black animate-pulse'
                                : isClaimed
                                ? 'bg-slate-800 text-slate-400 border-slate-700'
                                : 'bg-slate-800/80 text-cyan-300 border-cyan-500/30'
                            }`}>
                              {stats.activeCount.toLocaleString('en-IN')}/{m.target.toLocaleString('en-IN')} Active
                            </span>
                          </div>
                        </div>

                        {/* Middle: Prominent Prize / Reward Showcase Box */}
                        <div className={`p-3 sm:p-3.5 rounded-xl mb-3 flex items-center justify-between gap-3 border ${
                          canClaim
                            ? 'bg-amber-500/15 border-amber-400/40'
                            : isClaimed
                            ? 'bg-black/30 border-white/5'
                            : 'bg-black/40 border-white/10'
                        }`}>
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-400 to-yellow-500 flex items-center justify-center shrink-0 shadow-md shadow-amber-500/25 text-slate-950 font-black text-lg">
                              {m.rewardType === 'SUBSCRIPTION' ? '👑' : m.diamonds ? '💎' : '🪙'}
                            </div>
                            <div className="min-w-0">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Inaam / Reward Prize</p>
                              <p className="text-xs sm:text-sm font-black text-amber-300 truncate">
                                {m.rewardDescription}
                              </p>
                            </div>
                          </div>

                          {/* Quick visual reward badges on desktop */}
                          <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                            {m.credits && (
                              <span className="text-[10.5px] font-black px-2 py-1 rounded-lg bg-amber-400/10 text-amber-300 border border-amber-400/30">
                                +{m.credits.toLocaleString()} 🪙
                              </span>
                            )}
                            {m.diamonds && (
                              <span className="text-[10.5px] font-black px-2 py-1 rounded-lg bg-cyan-400/10 text-cyan-300 border border-cyan-400/30">
                                +{m.diamonds.toLocaleString()} 💎
                              </span>
                            )}
                            {m.rewardType === 'SUBSCRIPTION' && (
                              <span className="text-[10.5px] font-black px-2 py-1 rounded-lg bg-purple-400/10 text-purple-300 border border-purple-400/30">
                                Free VIP Pass
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Bottom Row: Progress Meter & CLAIM BUTTON (Always clearly visible!) */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                          {/* Progress bar info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between text-[10.5px] font-semibold text-slate-400 mb-1">
                              <span>Pragati: {progressPct}%</span>
                              <span className="text-slate-300">
                                {isClaimed
                                  ? 'Milestone Completed'
                                  : canClaim
                                  ? 'Ready to Claim!'
                                  : `${Math.max(0, m.target - stats.activeCount).toLocaleString('en-IN')} aur active ${m.target - stats.activeCount === 1 ? 'dost' : 'doston'} ki zaroorat`}
                              </span>
                            </div>
                            <div className="w-full h-2 bg-slate-800/90 rounded-full overflow-hidden border border-slate-700/50">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  isClaimed
                                    ? 'bg-amber-400/50'
                                    : canClaim
                                    ? 'bg-gradient-to-r from-amber-400 to-yellow-300 shadow-[0_0_8px_rgba(251,191,36,0.6)]'
                                    : 'bg-gradient-to-r from-indigo-500 to-purple-500'
                                }`}
                                style={{ width: `${progressPct}%` }}
                              />
                            </div>
                          </div>

                          {/* CLAIM BUTTON (Prominent in all 3 states) */}
                          <div className="shrink-0 pt-0.5 sm:pt-0">
                            {isClaimed ? (
                              <button
                                disabled
                                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-800/90 text-amber-300/80 font-bold text-xs flex items-center justify-center gap-1.5 border border-amber-500/20 cursor-not-allowed select-none"
                                title="Milestone inaam claim ho chuka hai"
                              >
                                <Check size={14} strokeWidth={3} className="text-amber-400" />
                                <span>Reward Claimed ✓</span>
                              </button>
                            ) : canClaim ? (
                              <button
                                onClick={() => handleClaimMilestone(m.target)}
                                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/30 active:scale-95 transition-all flex items-center justify-center gap-2 animate-pulse cursor-pointer border border-amber-300 tracking-wide"
                              >
                                <Gift size={15} strokeWidth={2.5} />
                                <span>Claim Reward Now 🎁</span>
                              </button>
                            ) : (
                              <button
                                disabled
                                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-white/5 text-slate-400 font-bold text-xs flex items-center justify-center gap-1.5 border border-white/10 select-none cursor-not-allowed"
                                title={`${m.target.toLocaleString('en-IN')} active doston par unlock hoga`}
                              >
                                <span className="text-xs">🔒</span>
                                <span>Claim Locked ({stats.activeCount.toLocaleString('en-IN')}/{m.target.toLocaleString('en-IN')})</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
