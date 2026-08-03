// @ts-nocheck
import { User, ActiveSubscription, SystemSettings } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// SECURITY: Subscription Sanitizer
// Tampered ya malformed activeSubscriptions entries ko reject karta hai.
// Defense-in-depth layer — Firestore Rules ke saath milke kaam karta hai.
// ─────────────────────────────────────────────────────────────────────────────
const VALID_TIERS   = new Set(['LIFETIME','YEARLY','3_MONTHLY','MONTHLY','WEEKLY','CUSTOM']);
const VALID_LEVELS  = new Set(['ULTRA','BASIC']);
const VALID_SOURCES = new Set(['ADMIN','PURCHASE','ENGAGEMENT_REWARD','LEGACY']);
const MAX_SUBS      = 20;       // 20 se zyada subscriptions suspicious hain
const MAX_END_YEAR  = 2200;     // 2200 ke baad ki dates invalid manenge

function sanitizeActiveSubscriptions(subs: any[]): ActiveSubscription[] {
    if (!Array.isArray(subs)) return [];

    const seen = new Set<string>();
    const valid: ActiveSubscription[] = [];

    for (const sub of subs.slice(0, MAX_SUBS)) {
        // 1. Object hona chahiye
        if (!sub || typeof sub !== 'object') continue;

        // 2. Required fields hone chahiye
        const { id, tier, level, startDate, endDate, source } = sub;
        if (!id || !tier || !level || !startDate || !endDate) continue;

        // 3. Duplicate id skip karo
        if (seen.has(String(id))) continue;
        seen.add(String(id));

        // 4. Allowed values check
        if (!VALID_TIERS.has(tier))   continue;
        if (!VALID_LEVELS.has(level)) continue;
        // source optional hai (legacy mein nahi tha) — agar hai toh validate karo
        if (source && !VALID_SOURCES.has(source)) continue;

        // 5. Valid dates check
        const start = new Date(startDate).getTime();
        const end   = new Date(endDate).getTime();
        if (isNaN(start) || isNaN(end)) continue;
        if (end <= start) continue; // end pehle nahi ho sakta
        if (new Date(endDate).getFullYear() > MAX_END_YEAR) continue; // 2200+ invalid

        // 6. String fields type check
        if (typeof tier !== 'string' || typeof level !== 'string') continue;

        valid.push(sub as ActiveSubscription);
    }

    return valid;
}

export const recalculateSubscriptionStatus = (user: User, settings?: SystemSettings): User => {
    const now = new Date();
    let updatedUser = { ...user };

    // SECURITY: activeSubscriptions sanitize karo — tampered entries nikalo
    if (Array.isArray(updatedUser.activeSubscriptions)) {
        updatedUser.activeSubscriptions = sanitizeActiveSubscriptions(updatedUser.activeSubscriptions);
    }

    // 0. Check Free Access Override (Admin Config)
    if (settings?.freeAccessConfig) {
        const { validUntil, classes } = settings.freeAccessConfig;
        if (validUntil && new Date(validUntil) > now) {
            // Check Class Match
            const userClass = user.classLevel || '';
            // Handle comma separated list cleaning if needed, but config assumes array
            if (classes && classes.length > 0 && (classes.includes(userClass) || classes.includes('ALL'))) {
                // Override as ULTRA
                updatedUser.isPremium = true;
                updatedUser.subscriptionTier = 'CUSTOM'; // Special Tier
                updatedUser.subscriptionLevel = 'ULTRA';
                updatedUser.subscriptionEndDate = validUntil;
                updatedUser.customSubscriptionName = 'Admin Free Access';
                return updatedUser;
            }
        }
    }

    // 1. Migration: If no activeSubscriptions but legacy fields exist, migrate them.
    if ((!updatedUser.activeSubscriptions || updatedUser.activeSubscriptions.length === 0) && updatedUser.subscriptionEndDate) {
        const legacyEndDate = new Date(updatedUser.subscriptionEndDate);
        if (legacyEndDate > now) {
            const currentTier = updatedUser.subscriptionTier === 'FREE' ? 'MONTHLY' : (updatedUser.subscriptionTier || 'MONTHLY');
            const legacySub: ActiveSubscription = {
                id: `legacy_${Date.now()}`,
                tier: currentTier,
                level: updatedUser.subscriptionLevel || 'BASIC',
                startDate: new Date().toISOString(), // Approximation
                endDate: updatedUser.subscriptionEndDate,
                source: updatedUser.grantedByAdmin ? 'ADMIN' : 'PURCHASE'
            };
            updatedUser.activeSubscriptions = [legacySub];
        }
    }

    const resetToFree = () => {
        updatedUser.isPremium = false;
        updatedUser.subscriptionTier = 'FREE';
        updatedUser.subscriptionLevel = undefined;
        updatedUser.subscriptionEndDate = undefined;
        updatedUser.activeSubscriptions = [];
        return updatedUser;
    };

    // If still no active subs or empty array
    if (!updatedUser.activeSubscriptions || updatedUser.activeSubscriptions.length === 0) {
        return resetToFree();
    }

    // 2. Filter Active Subscriptions (We only consider those not expired for the status)
    const activeSubs = updatedUser.activeSubscriptions.filter(sub => {
        const expDate = new Date(sub.endDate).getTime();
        return !isNaN(expDate) && expDate > now.getTime();
    });

    if (activeSubs.length === 0) {
        return resetToFree();
    }

    // 3. Find Best Subscription
    // Priority: Tier Value (LIFETIME > YEARLY > ...) -> Level (ULTRA > BASIC) -> Expiry (Later > Earlier)

    let bestSub = activeSubs[0];

    // Helper to score Tier Value
    const getTierScore = (tier: string) => {
        if (tier === 'LIFETIME') return 10;
        if (tier === 'YEARLY') return 5;
        if (tier === '3_MONTHLY') return 4;
        if (tier === 'MONTHLY') return 3;
        if (tier === 'WEEKLY') return 2;
        return 1;
    };

    // Helper to score Level
    const getLevelScore = (level: string) => {
        if (level === 'ULTRA') return 2;
        if (level === 'BASIC') return 1;
        return 0;
    };

    for (const sub of activeSubs) {
        // PRIORITY LOGIC:
        // 1. Highest Level wins (ULTRA > BASIC)
        // 2. If Levels Equal, Highest Tier Value wins (LIFETIME > YEARLY > ...)
        // 3. If Tiers Equal, Longest Duration wins (Later Expiry > Earlier)

        const bestLevelScore = getLevelScore(bestSub.level);
        const currentLevelScore = getLevelScore(sub.level);

        if (currentLevelScore > bestLevelScore) {
            bestSub = sub; // Upgrade Level takes precedence for ACCESS
        } else if (currentLevelScore === bestLevelScore) {
            // Level Tie-Breaker: Check Tier Value
            const bestTierScore = getTierScore(bestSub.tier);
            const currentTierScore = getTierScore(sub.tier);

            if (currentTierScore > bestTierScore) {
                bestSub = sub; // Higher Tier wins (e.g., Lifetime vs Weekly)
            } else if (currentTierScore === bestTierScore) {
                // Tier Tie-Breaker: Check Expiry
                // Note: Lifetime usually has very distant expiry, so this covers it too.
                const subExp = new Date(sub.endDate).getTime();
                const bestExp = new Date(bestSub.endDate).getTime();
                if (!isNaN(subExp) && !isNaN(bestExp) && subExp > bestExp) {
                    bestSub = sub;
                }
            }
        }
    }

    // Find the subscription with the absolute longest duration (to prevent display panic)
    let longestSub = activeSubs[0];
    for (const sub of activeSubs) {
        const subExp = new Date(sub.endDate).getTime();
        const longestExp = new Date(longestSub.endDate).getTime();
        if (!isNaN(subExp) && !isNaN(longestExp) && subExp > longestExp) {
            longestSub = sub;
        }
    }

    // 4. Update User Fields with the Best Subscription details
    updatedUser.isPremium = true;

    // DISPLAY FIX:
    // If we have a short-term ULTRA and a long-term BASIC (like Lifetime Basic),
    // the user might panic if their tier changes to "Weekly" and expiry looks short.
    // So we will grant them the `bestSub.level` (e.g. ULTRA) for access,
    // but the displayed Tier and Expiry will correspond to their longest active subscription.

    updatedUser.subscriptionTier = longestSub.tier;
    updatedUser.subscriptionLevel = bestSub.level;
    updatedUser.subscriptionEndDate = longestSub.endDate;

    return updatedUser;
};

export const addSubscription = (user: User, newSub: ActiveSubscription, settings?: SystemSettings): User => {
    const updatedUser = { ...user };
    if (!updatedUser.activeSubscriptions) updatedUser.activeSubscriptions = [];

    const now = Date.now();

    // STACKING: find the furthest end date among all non-expired active subscriptions.
    // New subscription queues AFTER existing ones (Ultra → Basic, 5x Yearly → 5 years, etc.)
    const nonExpired = updatedUser.activeSubscriptions.filter(s => {
        const exp = new Date(s.endDate).getTime();
        return !isNaN(exp) && exp > now;
    });

    if (nonExpired.length > 0) {
        const furthestEnd = Math.max(...nonExpired.map(s => new Date(s.endDate).getTime()));
        const origStart = new Date(newSub.startDate).getTime();
        const origEnd = new Date(newSub.endDate).getTime();
        const duration = origEnd - origStart;
        // Only queue if duration is calculable and there are active subscriptions to stack after
        if (duration > 0 && furthestEnd > now) {
            newSub = {
                ...newSub,
                startDate: new Date(furthestEnd).toISOString(),
                endDate: new Date(furthestEnd + duration).toISOString(),
            };
        }
    }

    updatedUser.activeSubscriptions.push(newSub);

    // Recalculate the effective status
    return recalculateSubscriptionStatus(updatedUser, settings);
};
