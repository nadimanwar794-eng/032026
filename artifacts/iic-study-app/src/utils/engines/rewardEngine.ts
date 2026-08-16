import { User, SystemSettings } from '../../types';
import { getLevelInfo, getLevelLimitBonus } from '../levelSystem';

export const RewardEngine = {
    calculateDailyBonus: (user: User, settings?: SystemSettings): number => {
        let baseBonus = settings?.loginBonusConfig?.freeBonus ?? 3;

        if (user.subscriptionTier !== 'FREE') {
            const level = user.subscriptionLevel || 'BASIC';
            if (level === 'BASIC') baseBonus = settings?.loginBonusConfig?.basicBonus ?? 5;
            if (level === 'ULTRA') baseBonus = settings?.loginBonusConfig?.ultraBonus ?? 10;
        }

        // Add level-based bonus credits (L6: +2, L7: +3, L8: +5)
        const userLevel = getLevelInfo(user.totalScore || 0).level;
        baseBonus += getLevelLimitBonus(userLevel).bonusLoginCredits;

        return baseBonus;
    },

    canClaimDaily: (user: User, dailyStudySeconds: number, targetSeconds: number): boolean => {
        const today = new Date().toDateString();
        const lastClaim = user.lastRewardClaimDate ? new Date(user.lastRewardClaimDate).toDateString() : '';

        return lastClaim !== today && dailyStudySeconds >= targetSeconds;
    },

    processClaim: (user: User, bonusAmount: number): User => {
        return {
            ...user,
            credits: (user.credits || 0) + bonusAmount,
            lastRewardClaimDate: new Date().toISOString()
        };
    }
};
