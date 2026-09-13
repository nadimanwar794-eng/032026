import { User, ReferredUserRecord, ReferralMilestone, ReferralCommissionLog } from '../types';
import { addSubscription } from './subscriptionUtils';
import { getUserDiamonds } from './diamondUtils';

// ─── REFERRAL MILESTONES (EXACT USER SPECIFICATION) ──────────────────────────
export const REFERRAL_MILESTONES: ReferralMilestone[] = [
  {
    target: 1,
    title: '1st User Joined',
    rewardDescription: '+50 Credits & +5 Diamonds 💎 (Dost ko 100 Credits 1h padhai baad)',
    rewardType: 'CURRENCY',
    credits: 50,
    diamonds: 5,
    badgeLabel: 'Starter 🚀',
  },
  {
    target: 3,
    title: '3 Users Joined',
    rewardDescription: '+100 Credits & +10 Diamonds 💎',
    rewardType: 'CURRENCY',
    credits: 100,
    diamonds: 10,
    badgeLabel: 'Bronze 🥉',
  },
  {
    target: 5,
    title: '5 Users Joined',
    rewardDescription: '+300 Credits 🪙',
    rewardType: 'CURRENCY',
    credits: 300,
    badgeLabel: 'Silver 🥈',
  },
  {
    target: 10,
    title: '10 Users Joined',
    rewardDescription: '+500 Credits & +20 Diamonds 💎',
    rewardType: 'CURRENCY',
    credits: 500,
    diamonds: 20,
    badgeLabel: 'Gold 🥇',
  },
  {
    target: 20,
    title: '20 Users Joined',
    rewardDescription: '+1,000 Credits 🪙',
    rewardType: 'CURRENCY',
    credits: 1000,
    badgeLabel: 'Platinum 💎',
  },
  {
    target: 50,
    title: '50 Users Joined',
    rewardDescription: 'Free Weekly Basic Subscription ⚡',
    rewardType: 'SUBSCRIPTION',
    subTier: 'WEEKLY',
    subLevel: 'BASIC',
    subDurationDays: 7,
    badgeLabel: 'Weekly Basic ⚡',
  },
  {
    target: 100,
    title: '100 Users Joined',
    rewardDescription: 'Free Weekly Basic Membership ⚡',
    rewardType: 'SUBSCRIPTION',
    subTier: 'WEEKLY',
    subLevel: 'BASIC',
    subDurationDays: 7,
    badgeLabel: 'Weekly Basic ⚡',
  },
  {
    target: 200,
    title: '200 Users Joined',
    rewardDescription: 'Free Weekly Ultra Membership 👑',
    rewardType: 'SUBSCRIPTION',
    subTier: 'WEEKLY',
    subLevel: 'ULTRA',
    subDurationDays: 7,
    badgeLabel: 'Weekly Ultra 👑',
  },
  {
    target: 500,
    title: '500 Users Joined',
    rewardDescription: 'Free 1-Month Ultra Membership 👑',
    rewardType: 'SUBSCRIPTION',
    subTier: 'MONTHLY',
    subLevel: 'ULTRA',
    subDurationDays: 30,
    badgeLabel: '1-Month Ultra 👑',
  },
  {
    target: 1000,
    title: '1,000 Users Joined',
    rewardDescription: 'Free 3-Month Basic Subscription ⚡',
    rewardType: 'SUBSCRIPTION',
    subTier: '3_MONTHLY',
    subLevel: 'BASIC',
    subDurationDays: 90,
    badgeLabel: '3-Month Basic ⚡',
  },
  {
    target: 2000,
    title: '2,000 Users Joined',
    rewardDescription: 'Free 3-Month Ultra Membership 👑',
    rewardType: 'SUBSCRIPTION',
    subTier: '3_MONTHLY',
    subLevel: 'ULTRA',
    subDurationDays: 90,
    badgeLabel: '3-Month Ultra 👑',
  },
  {
    target: 5000,
    title: '5,000 Users Joined',
    rewardDescription: 'Free 6-Month Basic Subscription ⚡',
    rewardType: 'SUBSCRIPTION',
    subTier: 'CUSTOM',
    subLevel: 'BASIC',
    subDurationDays: 180,
    badgeLabel: '6-Month Basic ⚡',
  },
  {
    target: 10000,
    title: '10,000 Users Joined',
    rewardDescription: 'Free 6-Month Ultra Membership 👑',
    rewardType: 'SUBSCRIPTION',
    subTier: 'CUSTOM',
    subLevel: 'ULTRA',
    subDurationDays: 180,
    badgeLabel: '6-Month Ultra 👑',
  },
  {
    target: 20000,
    title: '20,000 Users Joined',
    rewardDescription: 'Free 1-Year Basic Membership ⚡',
    rewardType: 'SUBSCRIPTION',
    subTier: 'YEARLY',
    subLevel: 'BASIC',
    subDurationDays: 365,
    badgeLabel: '1-Year Basic ⚡',
  },
  {
    target: 50000,
    title: '50,000 Users Joined',
    rewardDescription: 'Free 1-Year Ultra Membership 👑',
    rewardType: 'SUBSCRIPTION',
    subTier: 'YEARLY',
    subLevel: 'ULTRA',
    subDurationDays: 365,
    badgeLabel: '1-Year Ultra VIP 👑',
  },
];

// 7 days in milliseconds for inactivity detection (Dead User)
export const DEAD_USER_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;
// 1 Hour study time requirement (3600 seconds)
export const REQUIRED_STUDY_SECONDS_FOR_REFERRAL = 3600;

export interface ReferralStats {
  totalInvited: number;
  completedCount: number;
  activeCount: number;
  deadCount: number;
  pendingCount: number;
  totalCommission: number;
  list: ReferredUserRecord[];
}

/**
 * Calculates current active vs dead referrals accurately based on 7-day activity window
 */
export const getReferralStats = (user: User): ReferralStats => {
  const rawList: ReferredUserRecord[] = user.referredUsersList || [];
  const now = Date.now();

  let completedCount = 0;
  let activeCount = 0;
  let deadCount = 0;
  let pendingCount = 0;

  const list: ReferredUserRecord[] = rawList.map((ref) => {
    const isCompleted = !!ref.isCompleted;
    if (!isCompleted) {
      pendingCount++;
      return { ...ref, isDead: false };
    }

    completedCount++;
    const lastActiveTime = ref.lastActiveAt ? new Date(ref.lastActiveAt).getTime() : new Date(ref.joinedAt).getTime();
    const isDead = now - lastActiveTime > DEAD_USER_THRESHOLD_MS;

    if (isDead) {
      deadCount++;
    } else {
      activeCount++;
    }

    return {
      ...ref,
      isDead,
    };
  });

  return {
    totalInvited: rawList.length,
    completedCount,
    activeCount,
    deadCount,
    pendingCount,
    totalCommission: user.referralCommissionBalance || 0,
    list,
  };
};

/**
 * Calculates the royalty commission percentage for referrer based on their level.
 * Level 1: 0.01%
 * Level 15: 0.15%
 * Formula: Level * 0.01%
 */
export const getReferrerRoyaltyRate = (level?: number): number => {
  const effLevel = Math.min(15, Math.max(1, level || 1));
  return effLevel * 0.01; // e.g. 0.01 for level 1, 0.15 for level 15
};

/**
 * Claims a milestone reward for the user.
 * Guarantees that claimed milestones are recorded in claimedReferralMilestones
 * so duplicate rewards can NEVER be re-claimed if active count drops and rises again.
 */
export const claimReferralMilestoneReward = (
  user: User,
  target: number
): { success: boolean; message: string; updatedUser: User } => {
  const milestone = REFERRAL_MILESTONES.find((m) => m.target === target);
  if (!milestone) {
    return { success: false, message: 'Invalid milestone', updatedUser: user };
  }

  const claimedList = user.claimedReferralMilestones || [];
  if (claimedList.includes(target)) {
    return {
      success: false,
      message: 'Already Claimed! Yeh reward pehle hi claim kiya ja chuka hai.',
      updatedUser: user,
    };
  }

  const stats = getReferralStats(user);
  if (stats.activeCount < target) {
    return {
      success: false,
      message: `Abhi aapke paas ${stats.activeCount} active users hain. Is reward ke liye ${target} active users chahiye.`,
      updatedUser: user,
    };
  }

  let updated: User = {
    ...user,
    claimedReferralMilestones: [...claimedList, target],
  };

  if (milestone.rewardType === 'CURRENCY') {
    if (milestone.credits) {
      updated.credits = (updated.credits || 0) + milestone.credits;
    }
    if (milestone.diamonds) {
      updated.diamonds = getUserDiamonds(updated) + milestone.diamonds;
    }
  } else if (milestone.rewardType === 'SUBSCRIPTION' && milestone.subTier && milestone.subLevel) {
    const durationDays = milestone.subDurationDays || 7;
    const now = Date.now();
    const endDate = new Date(now + durationDays * 24 * 60 * 60 * 1000).toISOString();

    updated = addSubscription(updated, {
      id: `ref_milestone_${target}_${Date.now()}`,
      tier: milestone.subTier,
      level: milestone.subLevel,
      startDate: new Date().toISOString(),
      endDate,
      source: 'REWARD',
    });
  }

  return {
    success: true,
    message: `🎉 Mubarak Ho! ${milestone.title} ka reward successfully claim ho gaya!`,
    updatedUser: updated,
  };
};

/**
 * Records credit spend cashback to referrer when an invitee spends credits.
 */
export const distributeReferralCashback = (
  invitee: User,
  spentCredits: number,
  allUsers: User[]
): { updatedReferrer: User | null; cashback: number } => {
  if (!invitee.referrerId || spentCredits <= 0) {
    return { updatedReferrer: null, cashback: 0 };
  }

  const referrer = allUsers.find(
    (u) => u.id === invitee.referrerId || u.displayId === invitee.referrerId
  );
  if (!referrer) return { updatedReferrer: null, cashback: 0 };

  const ratePercent = getReferrerRoyaltyRate(referrer.level);
  const cashback = parseFloat(((spentCredits * ratePercent) / 100).toFixed(4));
  if (cashback <= 0) return { updatedReferrer: null, cashback: 0 };

  const newBalance = parseFloat(((referrer.referralCommissionBalance || 0) + cashback).toFixed(4));
  const newLog: ReferralCommissionLog = {
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    friendId: invitee.id,
    friendName: invitee.name || 'Friend',
    creditsSpent: spentCredits,
    ratePercent,
    earnedCredits: cashback,
    date: new Date().toISOString(),
  };

  const updatedLogs = [newLog, ...(referrer.referralCommissionLogs || [])].slice(0, 50);

  const updatedReferrer: User = {
    ...referrer,
    credits: (referrer.credits || 0) + Math.round(cashback >= 1 ? cashback : 0),
    referralCommissionBalance: newBalance,
    referralCommissionLogs: updatedLogs,
  };

  return { updatedReferrer, cashback };
};
