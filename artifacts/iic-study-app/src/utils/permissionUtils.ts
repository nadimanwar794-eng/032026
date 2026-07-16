import { SystemSettings, User } from '../types';
import { ALL_FEATURES } from './featureRegistry';
import { getLevelFromScore } from './levelSystem';

export type UserTier = 'FREE' | 'BASIC' | 'ULTRA';

export interface FeatureAccessResult {
    hasAccess: boolean;
    isHidden: boolean; // Indicates if the feature is completely hidden (e.g. from UI)
    cost: number;
    limit?: number; // Limit for current tier
    allowedTiers: UserTier[];
    userTier: UserTier;
    isDummy: boolean;
    reason?: 'TIER_RESTRICTED' | 'CREDIT_LOCKED' | 'DUMMY_FEATURE' | 'GRANTED' | 'FEED_LOCKED';
}

/**
 * Determines the effective tier of a user, accounting for subscription expiry.
 */
export const getUserTier = (user: User | null): UserTier => {
    if (!user) return 'FREE';

    // LIFETIME subscriptions never expire
    const isLifetime = user.subscriptionTier === 'LIFETIME';

    // Check expiry for non-lifetime subscriptions
    const isExpired = !isLifetime && user.subscriptionEndDate
        ? new Date(user.subscriptionEndDate).getTime() < Date.now()
        : false;

    if (isExpired) return 'FREE';

    // Check if subscription is active
    const isSubscribed = !!(user.subscriptionTier && user.subscriptionTier !== 'FREE');
    const isPremium = user.isPremium || isSubscribed;

    if (!isPremium) return 'FREE';

    // If premium, check level
    if (user.subscriptionLevel === 'ULTRA') return 'ULTRA';

    // Default to BASIC for any other premium status
    return 'BASIC';
};

/**
 * HTML se locked data-tier blocks hata deta hai — readable/chunked mode ke liye.
 * CSS gating sirf styled mode mein kaam karta hai; plain-text path ke liye yeh zaroor hai.
 * - FREE  → data-tier="basic" aur data-tier="ultra" dono remove
 * - BASIC → data-tier="ultra" remove
 * - ULTRA → kuch nahi remove
 */
export const filterHtmlByTier = (html: string, tier: UserTier): string => {
    if (tier === 'ULTRA') return html; // sab dikhao
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const tiersToRemove: string[] = tier === 'FREE' ? ['basic', 'ultra'] : ['ultra'];
        tiersToRemove.forEach(t => {
            doc.querySelectorAll(`[data-tier="${t}"]`).forEach(el => el.remove());
        });
        return doc.body.innerHTML;
    } catch {
        // DOMParser unavailable (SSR/test) — fallback: strip data-tier blocks via regex
        let result = html;
        const tiersToRemove: string[] = tier === 'FREE' ? ['basic', 'ultra'] : ['ultra'];
        tiersToRemove.forEach(t => {
            result = result.replace(
                new RegExp(`<[^>]+data-tier="${t}"[^>]*>[\\s\\S]*?<\\/[^>]+>`, 'gi'),
                ''
            );
        });
        return result;
    }
};

/**
 * Auto-detects emoji section markers in HTML notes content and wraps each
 * section in an appropriate `data-tier` div so the existing CSS + JS gating works.
 *
 * Marker → tier:
 *   📖 Book Text / 📌 TOC  → FREE  (no wrapper — visible to all)
 *   📝 Smart Notes         → data-tier="basic"
 *   💡 Explanation         → data-tier="ultra"
 *   ⚠️ / ⚠ Exam tips      → data-tier="ultra"
 *
 * Skipped when the HTML already contains data-tier attributes (admin-tagged),
 * or when no tier markers are present (fast-path).
 */
export const injectSectionTierTags = (html: string): string => {
    if (!html || /data-tier=/.test(html)) return html;
    // Fast-path: no tier markers at all → nothing to do
    if (!/📝|💡|⚠️|⚠/.test(html)) return html;

    const TIER_MAP: Array<{ markers: string[]; tier: 'basic' | 'ultra' }> = [
        { markers: ['📝'], tier: 'basic' },
        { markers: ['💡', '⚠️', '⚠'], tier: 'ultra' },
    ];
    const FREE_MARKERS = ['📖', '📌'];

    const getTier = (text: string): 'basic' | 'ultra' | 'free' | null => {
        for (const { markers, tier } of TIER_MAP) {
            if (markers.some(m => text.includes(m))) return tier;
        }
        if (FREE_MARKERS.some(m => text.includes(m))) return 'free';
        return null;
    };

    /** Walk down single-block-child wrappers until we reach a container that
     *  has at least one tier-marked heading as a DIRECT child, or we can't go
     *  deeper. This handles the common case of content wrapped in one or more
     *  outer <div>/<section> elements. */
    const findContainer = (root: Element): Element => {
        let el = root;
        for (;;) {
            const directHeadingWithMarker = Array.from(el.children).some(
                c => /^h[1-6]$/i.test(c.tagName) && /📝|💡|⚠️|⚠/.test(c.textContent || '')
            );
            if (directHeadingWithMarker) return el;
            // Dive into a single block-level wrapper child
            if (el.children.length === 1 && /^(div|section|article|main)$/i.test(el.children[0].tagName)) {
                el = el.children[0];
            } else {
                break;
            }
        }
        return el; // best-effort fallback
    };

    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const container = findContainer(doc.body);

        // Snapshot before any mutation so moves don't corrupt iteration
        const children = Array.from(container.children);

        let currentWrapper: Element | null = null;

        children.forEach(el => {
            const isHeading = /^h[1-6]$/i.test(el.tagName);

            if (isHeading) {
                const text = el.textContent || '';
                const tier = getTier(text);

                if (tier === 'basic' || tier === 'ultra') {
                    // Start a new gated section wrapper
                    currentWrapper = doc.createElement('div');
                    currentWrapper.setAttribute('data-tier', tier);
                    container.insertBefore(currentWrapper, el);
                    currentWrapper.appendChild(el);
                } else if (tier === 'free') {
                    // Explicit free-section heading — close any gated wrapper
                    currentWrapper = null;
                    // el stays in container (no move)
                } else {
                    // Unmarked sub-heading → keep in current gated wrapper if open
                    if (currentWrapper) currentWrapper.appendChild(el);
                }
            } else {
                if (currentWrapper) currentWrapper.appendChild(el);
            }
        });

        return doc.body.innerHTML;
    } catch {
        return html; // DOMParser unavailable (SSR/test env) — return unmodified
    }
};

/**
 * Tier-based notes content visibility for Class 6-12:
 * - First lesson of each subject → sab dikhega (ALL free)
 * - Level 8+ → Smart Notes permanently free (BASIC tier)
 * - Level 10+ → Explanation bhi permanently free (ULTRA tier)
 * - Baaki subscription tier se control hoga
 */
export const getEffectiveNotesTier = (
    user: User | null,
    isFirstLesson: boolean,
): UserTier => {
    // First lesson → sab free (ULTRA = max)
    if (isFirstLesson) return 'ULTRA';

    const level = getLevelFromScore(user?.totalScore || 0);
    const subTier = getUserTier(user);

    // Level 10+ → Explanation bhi permanently free
    if (level >= 10) return 'ULTRA';

    // Level 8+ → Smart Notes permanently free, Explanation subscription se
    if (level >= 8) {
        return subTier === 'ULTRA' ? 'ULTRA' : 'BASIC';
    }

    // Level < 8 → sirf subscription tier
    return subTier;
};

/**
 * Checks if a user has access to a specific feature based on dynamic settings and static registry.
 */
export const checkFeatureAccess = (
    featureId: string,
    user: User | null,
    settings: SystemSettings
): FeatureAccessResult => {
    // 0. Admin / Sub-Admin Bypass
    if (user?.role === 'ADMIN' || user?.isSubAdmin) {
        return {
            hasAccess: true,
            isHidden: false,
            cost: 0,
            allowedTiers: ['FREE', 'BASIC', 'ULTRA'],
            userTier: 'ULTRA',
            isDummy: false,
            reason: 'GRANTED'
        };
    }

    const userTier = getUserTier(user);

    // 1. Get Dynamic Config from Settings (FEED)
    // Supports both old Array format (featureAccess) and new Map format (featureConfig)
    let dynamicConfig = settings.featureConfig?.[featureId];

    if (!dynamicConfig && settings.featureAccess) {
        dynamicConfig = settings.featureAccess.find(c => c.featureId === featureId);
    }

    // 2. Get Static Config from Registry
    const staticConfig = ALL_FEATURES.find(f => f.id === featureId);

    // 3. Determine Allowed Tiers
    let allowedTiers: UserTier[] = [];
    let isFeedControl = false;

    // --- STRICT FEED CONTROL LOGIC ---
    // If a configuration exists in Feature Access (Feed), it overrides EVERYTHING.
    if (dynamicConfig) {
        isFeedControl = true;

        // If visible is explicitly FALSE, it's locked for everyone (unless overridden by tiers?)
        // The previous logic said "if visible is FALSE, fallback to Matrix".
        // User requested: "plan Matrix nahibkarega Future lock unlock... sab control karega Future access page".
        // This implies if it's in Feed, Feed rules apply 100%.

        if (dynamicConfig.visible === false) {
            // STRICT FEED CONTROL: User explicitly requested App Soul to control all access.
            // If visible is FALSE, it means "LOCKED" (No Access), NOT "Use Matrix".
            allowedTiers = []; // Explicitly Deny Access
            // Keep isFeedControl = true to prevent Matrix fallback
        } else {
            // FEED MODE IS ACTIVE
            if (dynamicConfig.allowedTiers && dynamicConfig.allowedTiers.length > 0) {
                allowedTiers = dynamicConfig.allowedTiers;
            } else if (dynamicConfig.minTier) {
                // Legacy support
                if (dynamicConfig.minTier === 'ULTRA') allowedTiers = ['ULTRA'];
                else if (dynamicConfig.minTier === 'BASIC') allowedTiers = ['BASIC', 'ULTRA'];
                else allowedTiers = ['FREE', 'BASIC', 'ULTRA'];
            } else {
                // If config exists but no tiers specified, assume NO ACCESS (Strict) or FULL ACCESS?
                // Admin UI defaults to all selected. If empty, it means none selected.
                allowedTiers = [];
            }
        }
    }

    // --- MATRIX FALLBACK (Only if Feed is NOT active) ---
    if (!isFeedControl) {
        if (settings.tierPermissions) {
            if (settings.tierPermissions.FREE?.includes(featureId)) allowedTiers.push('FREE');
            if (settings.tierPermissions.BASIC?.includes(featureId)) allowedTiers.push('BASIC');
            if (settings.tierPermissions.ULTRA?.includes(featureId)) allowedTiers.push('ULTRA');
        }

        // Final Fallback to Static Registry if Matrix is empty/missing
        if (allowedTiers.length === 0) {
             if (staticConfig?.requiredSubscription) {
                if (staticConfig.requiredSubscription === 'ULTRA') allowedTiers = ['ULTRA'];
                else if (staticConfig.requiredSubscription === 'BASIC') allowedTiers = ['BASIC', 'ULTRA'];
                else allowedTiers = ['FREE', 'BASIC', 'ULTRA'];
             } else {
                allowedTiers = ['FREE', 'BASIC', 'ULTRA'];
             }
        }
    }

    // 4. Determine Cost (Feed Only)
    const cost = (isFeedControl && dynamicConfig?.creditCost !== undefined) ? dynamicConfig.creditCost : 0;

    // 5. Determine Dummy Status (Feed overrides)
    const isDummy = (isFeedControl && dynamicConfig?.isDummy !== undefined) ? dynamicConfig.isDummy : (staticConfig?.isDummy || false);

    // 6. Determine Limit (Feed Only)
    let limit: number | undefined;
    if (isFeedControl && dynamicConfig?.limits) {
        if (userTier === 'FREE') limit = dynamicConfig.limits.free;
        else if (userTier === 'BASIC') limit = dynamicConfig.limits.basic;
        else if (userTier === 'ULTRA') limit = dynamicConfig.limits.ultra;
    }

    // 7. Check Access
    const hasAccess = allowedTiers.includes(userTier);

    // 8. Determine Hidden Status
    // A feature is considered "hidden" if the dynamic config explicitly sets `visible` to false.
    // The prompt requested: "hide kiya hua chijhe wo logo ko na dikhega".
    const isHidden = dynamicConfig?.visible === false;

    let reason: FeatureAccessResult['reason'] = hasAccess ? 'GRANTED' : 'TIER_RESTRICTED';

    if (!hasAccess && isFeedControl) {
        reason = 'FEED_LOCKED'; // Explicitly blocked by Feed
    }

    if (isDummy) {
        reason = 'DUMMY_FEATURE';
    }

    return {
        hasAccess,
        isHidden,
        cost,
        limit,
        allowedTiers,
        userTier,
        isDummy,
        reason
    };
};
