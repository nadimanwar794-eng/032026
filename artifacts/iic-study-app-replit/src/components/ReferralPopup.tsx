import React, { useState } from 'react';
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
  ChevronRight,
  Percent,
  ShieldCheck,
  UserCheck,
  UserX,
  MessageCircle,
} from 'lucide-react';
import { User, ReferredUserRecord } from '../types';
import { saveUserToLive } from '../firebase';
import {
  REFERRAL_MILESTONES,
  getReferralStats,
  claimReferralMilestoneReward,
  getReferrerRoyaltyRate,
} from '../utils/referralEngine';

interface Props {
  user: User;
  onClose: () => void;
  onUpdateUser: (u: User) => void;
}

export const ReferralPopup: React.FC<Props> = ({ user, onClose, onUpdateUser }) => {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'FRIENDS' | 'ROYALTY' | 'ENTER_CODE'>(
    user.redeemedReferralCode ? 'OVERVIEW' : 'OVERVIEW'
  );
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

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
    const res = claimReferralMilestoneReward(user, target);
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
        localStorage.setItem('nst_users', JSON.stringify(updatedAll));
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

      // Save referral linkage to current user (Reward will unlock after 1 hour active study)
      const updatedUser: User = {
        ...user,
        redeemedReferralCode: cleanCode,
        referrerId: referrer ? referrer.id : cleanCode,
        referralStudySeconds: user.referralStudySeconds || 0,
        referralRewardClaimed: false,
      };

      if (referrer) {
        // Add invitee record to referrer's list as Pending (needs 60 mins)
        const newRecord: ReferredUserRecord = {
          userId: user.id,
          userName: user.name || 'New Student',
          userPhoto: user.photoURL,
          joinedAt: new Date().toISOString(),
          activeMinutes: Math.floor((user.referralStudySeconds || 0) / 60),
          isCompleted: false, // unlocked only when reaches 60 minutes
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
        localStorage.setItem('nst_users', JSON.stringify(newUsersList));
        saveUserToLive(updatedReferrer).catch(() => {});
      }

      await saveUserToLive(updatedUser).catch(() => {});
      onUpdateUser(updatedUser);
      setSuccess(true);
    } catch (e: any) {
      setError(e.message || 'Referral code verify karne me samasya aayi.');
    } finally {
      setLoading(false);
    }
  };

  const inviteeStudyMinutes = Math.floor((user.referralStudySeconds || 0) / 60);
  const inviteeProgressPct = Math.min(100, Math.round((inviteeStudyMinutes / 60) * 100));

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="bg-slate-950 rounded-3xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-800 relative text-white overflow-hidden">
        
        {/* Toast Notification */}
        {toastMsg && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-500 text-white font-bold text-xs px-4 py-2 rounded-full shadow-xl border border-emerald-400 flex items-center gap-1.5 animate-in slide-in-from-top duration-200">
            <Check size={14} strokeWidth={3} />
            <span>{toastMsg}</span>
          </div>
        )}

        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Gift size={22} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">Refer & Earn Program</h2>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
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
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className={`grid ${user.redeemedReferralCode ? 'grid-cols-3' : 'grid-cols-4'} gap-1 p-2 bg-slate-900/90 border-b border-slate-800 text-xs font-bold`}>
          <button
            onClick={() => setActiveTab('OVERVIEW')}
            className={`py-2 px-1 rounded-xl transition-all flex flex-col sm:flex-row items-center justify-center gap-1 ${
              activeTab === 'OVERVIEW'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Award size={14} />
            <span className="truncate">Milestones</span>
          </button>
          <button
            onClick={() => setActiveTab('FRIENDS')}
            className={`py-2 px-1 rounded-xl transition-all flex flex-col sm:flex-row items-center justify-center gap-1 ${
              activeTab === 'FRIENDS'
                ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users size={14} />
            <span className="truncate">Friends ({stats.totalInvited})</span>
          </button>
          <button
            onClick={() => setActiveTab('ROYALTY')}
            className={`py-2 px-1 rounded-xl transition-all flex flex-col sm:flex-row items-center justify-center gap-1 ${
              activeTab === 'ROYALTY'
                ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Percent size={14} />
            <span className="truncate">Royalty</span>
          </button>
          {!user.redeemedReferralCode && (
            <button
              onClick={() => setActiveTab('ENTER_CODE')}
              className={`py-2 px-1 rounded-xl transition-all flex flex-col sm:flex-row items-center justify-center gap-1 ${
                activeTab === 'ENTER_CODE'
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sparkles size={14} />
              <span className="truncate">Have Code?</span>
            </button>
          )}
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-slate-200">
          
          {/* TAB 1: OVERVIEW & MILESTONES */}
          {activeTab === 'OVERVIEW' && (
            <div className="space-y-4">
              
              {/* Share Code & WhatsApp Bar */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-indigo-950/60 border border-slate-800 shadow-inner">
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
                        className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-white flex items-center gap-1 active:scale-95 transition-all"
                      >
                        {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                        <span>{copied ? 'Copied!' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={handleShareWhatsApp}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all text-xs"
                  >
                    <Share2 size={15} /> WhatsApp Par Invite Karein
                  </button>
                </div>

                {/* Redeemed Referral Code Status (If user already used one code) */}
                {user.redeemedReferralCode && (
                  <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-slate-400 text-[11px]">Applied Code:</span>
                      <span className="font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30 text-[11px]">
                        {user.redeemedReferralCode}
                      </span>
                    </div>
                    <div className="text-[11px] font-semibold text-slate-300">
                      {user.referralRewardClaimed || inviteeStudyMinutes >= 60 ? (
                        <span className="text-emerald-400 font-bold flex items-center gap-1">
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

              {/* 4-Stat Metric Box */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Total Invited</p>
                  <p className="text-lg font-black text-white mt-0.5">{stats.totalInvited}</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-emerald-500/30 text-center">
                  <p className="text-[10px] font-bold text-emerald-400 uppercase flex items-center justify-center gap-1">
                    <UserCheck size={11} /> Active
                  </p>
                  <p className="text-lg font-black text-emerald-400 mt-0.5">{stats.activeCount}</p>
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

              {/* ACTIVE VS DEAD USERS WARNING BANNER (EXACT USER REQUIREMENT) */}
              {stats.deadCount > 0 ? (
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-2 animate-in fade-in">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-black text-amber-300">
                        {stats.deadCount} of your invited users are inactive/dead. Total Active: {stats.activeCount}/{stats.completedCount}. Next milestone unlocks only on Active Users!
                      </p>
                      <p className="text-[11px] text-amber-300/80 mt-1 leading-relaxed">
                        Aapka purana claim kiya hua reward wapis nahi liya gaya hai, lekin naye milestone rewards unlock karne ke liye aapke active users count hona zaroori hai. Inhe WhatsApp par remind karein!
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleRemindAllDead}
                    className="w-full py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold rounded-xl border border-amber-500/30 flex items-center justify-center gap-1.5 transition text-[11px]"
                  >
                    <MessageCircle size={13} /> Inactive Doston ko Padhai ke liye Remind Karein
                  </button>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2 text-emerald-300 text-xs">
                  <ShieldCheck size={16} className="text-emerald-400 shrink-0" />
                  <span>Sabhi doston ka active status up-to-date hai. Har 7 din me login hone par count barkarar rehta hai!</span>
                </div>
              )}

              {/* Notice About 1-Hour Rule & Anti-Loop Policy */}
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-[11px] text-slate-400 space-y-1">
                <p className="font-bold text-slate-300 flex items-center gap-1.5">
                  <Clock size={13} className="text-sky-400" />
                  1-Hour Study Requirement &amp; Single-Claim Rule:
                </p>
                <p>
                  • Invited dost jab app ko kam se kam <strong>1 ghanta (60 min)</strong> study use karenge, tabhi unhe 100 credits milenge aur aapka active referral count count hoga.
                </p>
                <p>
                  • Ek milestone ka reward lifetime me <strong>sirf 1 baar</strong> claim ho sakta hai. Inactive users badhne ke baad dobara us sankhya par aane par duplicate reward nahi milega (Already Claimed dikhega).
                </p>
              </div>

              {/* MILESTONE REWARDS LADDER */}
              <div className="space-y-2.5 pt-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Crown size={14} className="text-amber-400" /> All 15 Milestone Rewards
                  </h3>
                  <span className="text-[11px] font-bold text-slate-400">
                    Active: <strong className="text-emerald-400">{stats.activeCount} Users</strong>
                  </span>
                </div>

                <div className="space-y-2">
                  {REFERRAL_MILESTONES.map((m) => {
                    const isClaimed = claimedMilestones.includes(m.target);
                    const canClaim = !isClaimed && stats.activeCount >= m.target;
                    const progressPct = Math.min(100, Math.round((stats.activeCount / m.target) * 100));

                    return (
                      <div
                        key={m.target}
                        className={`p-3.5 rounded-2xl border transition-all ${
                          isClaimed
                            ? 'bg-slate-900/40 border-slate-800/80 opacity-80'
                            : canClaim
                            ? 'bg-gradient-to-r from-emerald-950/40 to-slate-900 border-emerald-500/50 shadow-lg shadow-emerald-500/10'
                            : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-black text-white">{m.title}</span>
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-white/5 text-amber-300 border border-white/10">
                                {m.badgeLabel}
                              </span>
                            </div>
                            <p className="text-xs font-bold text-emerald-400 mt-1">{m.rewardDescription}</p>
                          </div>

                          {/* Action Button */}
                          <div className="shrink-0">
                            {isClaimed ? (
                              <button
                                disabled
                                className="px-3.5 py-1.5 rounded-xl bg-slate-800 text-emerald-400 font-bold text-xs flex items-center gap-1 border border-emerald-500/30 cursor-not-allowed"
                                title="Already Claimed. Inactive users hone ke baad dobara aane par duplicate reward nahi milta."
                              >
                                <Check size={13} />
                                <span>Already Claimed</span>
                              </button>
                            ) : canClaim ? (
                              <button
                                onClick={() => handleClaimMilestone(m.target)}
                                className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-black text-xs shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center gap-1.5 animate-pulse"
                              >
                                <Gift size={13} />
                                <span>Claim Reward</span>
                              </button>
                            ) : (
                              <div className="text-right">
                                <span className="text-[10px] font-mono font-bold text-slate-400 block mb-1">
                                  {stats.activeCount}/{m.target} Active
                                </span>
                                <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-sky-500 rounded-full transition-all"
                                    style={{ width: `${progressPct}%` }}
                                  />
                                </div>
                              </div>
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

          {/* TAB 2: MY INVITED FRIENDS (LIVE BREAKDOWN) */}
          {activeTab === 'FRIENDS' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-400">
                  Total Friends: <strong className="text-white">{stats.totalInvited}</strong> (Active: <strong className="text-emerald-400">{stats.activeCount}</strong>, Inactive: <strong className="text-rose-400">{stats.deadCount}</strong>)
                </span>
                {stats.deadCount > 0 && (
                  <button
                    onClick={handleRemindAllDead}
                    className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold rounded-lg border border-amber-500/30 text-[10px] flex items-center gap-1"
                  >
                    <MessageCircle size={11} /> Remind Inactive
                  </button>
                )}
              </div>

              {stats.list.length === 0 ? (
                <div className="text-center py-10 px-4 rounded-2xl bg-slate-900 border border-slate-800">
                  <Users size={36} className="mx-auto text-slate-600 mb-2" />
                  <p className="text-sm font-bold text-slate-300">Abhi tak koi dost invite nahi hua hai</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Apna referral code WhatsApp par share karein aur rewards earn karna start karein!
                  </p>
                  <button
                    onClick={handleShareWhatsApp}
                    className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs inline-flex items-center gap-2"
                  >
                    <Share2 size={13} /> WhatsApp Par Share Karein
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {stats.list.map((friend, idx) => {
                    return (
                      <div
                        key={friend.userId || idx}
                        className="p-3 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-300 text-xs shrink-0">
                            {friend.userName.charAt(0)}
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
                                ⏳ {friend.activeMinutes}/60 min study done
                              </span>
                              <p className="text-[9px] text-slate-500 mt-0.5">Needs 1h study</p>
                            </div>
                          ) : friend.isDead ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
                                💤 Inactive (&gt;7d)
                              </span>
                              <button
                                onClick={() => handleRemindFriend(friend)}
                                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition"
                                title="WhatsApp Reminder"
                              >
                                <MessageCircle size={13} />
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              🟢 Active
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ROYALTY COMMISSION */}
          {activeTab === 'ROYALTY' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 via-slate-900 to-indigo-950/40 border border-amber-500/30 space-y-3">
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

                <div className="p-3 rounded-xl bg-black/40 border border-white/5 text-xs text-slate-300 space-y-1 leading-relaxed">
                  <p className="font-bold text-amber-300 flex items-center gap-1.5">
                    <Zap size={13} /> Royalty Formula:
                  </p>
                  <p>• Level 1 par <strong>0.01%</strong> cashback return milta hai.</p>
                  <p>• Level 15 par <strong>0.15%</strong> cashback return milta hai.</p>
                  <p>• Jab bhi aapka bulaya hua dost koi tests, notes ya feature unlock karega, aapke wallet me returns credit honge!</p>
                </div>
              </div>

              {/* Commission Logs */}
              <div>
                <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-2">
                  Recent Royalty Earnings
                </h4>
                {user.referralCommissionLogs && user.referralCommissionLogs.length > 0 ? (
                  <div className="space-y-1.5">
                    {user.referralCommissionLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs"
                      >
                        <div>
                          <p className="font-bold text-white">{log.friendName}</p>
                          <p className="text-[10px] text-slate-500">
                            Spent {log.creditsSpent} credits • {new Date(log.date).toLocaleDateString()}
                          </p>
                        </div>
                        <span className="font-mono font-black text-emerald-400 text-xs">
                          +{log.earnedCredits} Credits
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center text-xs text-slate-500">
                    Abhi tak koi credit spend royalty record nahi hai. Jaise hi doston ne credits use kiye, yahan dikhega.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: ENTER REFERRAL CODE (Hidden permanently once a code is redeemed) */}
          {!user.redeemedReferralCode && activeTab === 'ENTER_CODE' && (
            <div className="space-y-4">
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-slate-300 space-y-2">
                  <p className="font-black text-indigo-300 text-sm flex items-center gap-1.5">
                    <Gift size={16} /> Dost ka Code Daalein Aur 100 Credits Paayein!
                  </p>
                  <p className="text-slate-300 leading-relaxed">
                    Kisi dost ka referral code enter karein. Uske baad jaise hi aap app me <strong>1 ghanta (60 minutes)</strong> study complete karenge, aapko turant <strong>+100 Welcome Credits 🪙</strong> milenge!
                  </p>
                </div>

                <div>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="Dost Ka Referral Code Daalein"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl font-mono text-center font-black tracking-widest text-white text-base outline-none uppercase focus:border-indigo-500 focus:bg-white/10 transition-all"
                  />
                  {error && <p className="text-rose-400 text-xs font-bold mt-2 text-center">{error}</p>}
                </div>

                <button
                  onClick={handleApplyCode}
                  disabled={loading || !code.trim()}
                  className="w-full py-3.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-black rounded-xl shadow-lg disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-95 transition-all text-sm"
                >
                  {loading ? (
                    'Verifying...'
                  ) : (
                    <>
                      <span>Apply Referral Code</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
