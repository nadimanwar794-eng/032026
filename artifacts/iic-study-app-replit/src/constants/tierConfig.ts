export type SubscriptionTierType = 'FREE' | 'BASIC' | 'ULTRA';

export interface TierFeatureItem {
    sn: string | number;
    id: string;
    label: string;
    category: string;
    free: string;
    basic: string;
    ultra: string;
    allowedTiers: SubscriptionTierType[];
    unlockLevel?: number; // Minimum user level required to see/use (features with unlockLevel are locked/hidden below that level)
    creditCost?: number;
    diamondCost?: number;
    limits?: {
        free?: number;
        basic?: number;
        ultra?: number;
    };
    visible?: boolean;
    description?: string;
}

export const MASTER_TIER_FEATURES: TierFeatureItem[] = [
    // ── Table 1: Core Features & Modes ──
    {
        sn: 1,
        id: 'LEADER_BOARD',
        label: 'Leader Board',
        category: '⭐ Core Features',
        free: '✓ Level 2',
        basic: '✓ Level 2',
        ultra: '✓ Level 2',
        allowedTiers: ['FREE', 'BASIC', 'ULTRA'],
        unlockLevel: 2,
        visible: true,
        description: 'Level 2 hone par hi leaderboard unlock aur visible hota hai.'
    },
    {
        sn: 2,
        id: 'READING_MODE',
        label: 'Reading mode',
        category: '⭐ Core Features',
        free: '20 cr / 5 diamond',
        basic: '20 cr / 5 diamond',
        ultra: '20 cr / 5 diamond',
        allowedTiers: ['FREE', 'BASIC', 'ULTRA'],
        creditCost: 20,
        diamondCost: 5,
        visible: true
    },
    {
        sn: 3,
        id: 'WRITING_MODE',
        label: 'Writing mode',
        category: '⭐ Core Features',
        free: '20 cr / 5 diamond',
        basic: '20 cr / 5 diamond',
        ultra: '20 cr / 5 diamond',
        allowedTiers: ['FREE', 'BASIC', 'ULTRA'],
        creditCost: 20,
        diamondCost: 5,
        visible: true
    },
    {
        sn: 4,
        id: 'MCQ_MODE',
        label: 'MCQ mode',
        category: '⭐ Core Features',
        free: '20 cr / 5 diamond',
        basic: '20 cr / 5 diamond',
        ultra: '20 cr / 5 diamond',
        allowedTiers: ['FREE', 'BASIC', 'ULTRA'],
        creditCost: 20,
        diamondCost: 5,
        visible: true
    },
    {
        sn: 5,
        id: 'PROJECTOR_MODE',
        label: 'Projector mode',
        category: '⭐ Core Features',
        free: '20 cr / 5 diamond',
        basic: '20 cr / 5 diamond',
        ultra: '20 cr / 5 diamond',
        allowedTiers: ['FREE', 'BASIC', 'ULTRA'],
        creditCost: 20,
        diamondCost: 5,
        visible: true
    },
    {
        sn: 6,
        id: 'FLASHCARD',
        label: 'Flashcard',
        category: '📚 Study Content',
        free: '5 diamond',
        basic: '5 diamond',
        ultra: '✓ Free',
        allowedTiers: ['FREE', 'BASIC', 'ULTRA'],
        diamondCost: 5,
        visible: true,
        description: 'Free & Basic: 5 diamonds | Ultra: Completely free'
    },
    {
        sn: 7,
        id: 'PDF',
        label: 'PDF Notes',
        category: '📚 Study Content',
        free: '5 diamond',
        basic: '5 diamond',
        ultra: 'Free',
        allowedTiers: ['FREE', 'BASIC', 'ULTRA'],
        diamondCost: 5,
        visible: true,
        description: 'Free & Basic: 5 diamonds | Ultra: Completely free'
    },
    {
        sn: 8,
        id: 'VIDEO',
        label: 'Video Lectures',
        category: '📚 Study Content',
        free: '5 diamond',
        basic: '5 diamond',
        ultra: 'Free',
        allowedTiers: ['FREE', 'BASIC', 'ULTRA'],
        diamondCost: 5,
        visible: true,
        description: 'Free & Basic: 5 diamonds | Ultra: Completely free'
    },
    {
        sn: 9,
        id: 'SOLUTION_MCQ',
        label: 'Solution (MCQ)',
        category: '📚 Study Content',
        free: '✓',
        basic: '✓',
        ultra: '✓',
        allowedTiers: ['FREE', 'BASIC', 'ULTRA'],
        visible: true
    },
    {
        sn: 10,
        id: 'OFFICIAL_MARKSHEET',
        label: 'Official Marksheet',
        category: '📚 Study Content',
        free: '✓',
        basic: '✓',
        ultra: '✓',
        allowedTiers: ['FREE', 'BASIC', 'ULTRA'],
        visible: true
    },
    {
        sn: 11,
        id: 'FULL_ANALYSIS',
        label: 'Full Analysis',
        category: '📊 Analytics & Insights',
        free: '✗',
        basic: '✓',
        ultra: '✓',
        allowedTiers: ['BASIC', 'ULTRA'],
        visible: true,
        description: 'Free user ke liye locked, Basic aur Ultra me unlimtied full analysis'
    },
    {
        sn: 12,
        id: 'REVISION_HUB',
        label: 'Revision Hub',
        category: '🧠 Revision Hub',
        free: '100 cr / 20 diamond',
        basic: '100 cr / 20 diamond',
        ultra: '100 cr / 20 diamond',
        allowedTiers: ['FREE', 'BASIC', 'ULTRA'],
        creditCost: 100,
        diamondCost: 20,
        visible: true
    },
    {
        sn: '14.1',
        id: 'GLOBAL_MESSAGE',
        label: 'Community: Global message',
        category: '👥 Community',
        free: '✗',
        basic: '✗',
        ultra: '✓',
        allowedTiers: ['ULTRA'],
        visible: true,
        description: 'Sirf Ultra users hi Global message send kar sakte hain'
    },
    {
        sn: '14.2',
        id: 'COMMUNITY_MCQ',
        label: 'Community: MCQ',
        category: '👥 Community',
        free: '✓',
        basic: '✓',
        ultra: '✓',
        allowedTiers: ['FREE', 'BASIC', 'ULTRA'],
        visible: true
    },
    {
        sn: '14.3',
        id: 'HELP_ADMIN',
        label: 'Community: Help (Admin Support)',
        category: '👥 Community',
        free: '✓',
        basic: '✓',
        ultra: '✓',
        allowedTiers: ['FREE', 'BASIC', 'ULTRA'],
        visible: true
    },
    {
        sn: 15,
        id: 'THEME_STUDIO',
        label: 'Theme Studio',
        category: '🎨 Themes & Styling',
        free: '✓',
        basic: '✓',
        ultra: '✓',
        allowedTiers: ['FREE', 'BASIC', 'ULTRA'],
        visible: true
    },
    {
        sn: 16,
        id: 'SCORE_HISTORY',
        label: 'Score History',
        category: '📊 Analytics & Insights',
        free: '✓',
        basic: '✓',
        ultra: '✓',
        allowedTiers: ['FREE', 'BASIC', 'ULTRA'],
        visible: true
    },
    {
        sn: 17,
        id: 'REVISION_COMPILATION',
        label: 'Revision multiple Books compilation',
        category: '🧠 Revision Hub',
        free: '✗',
        basic: '✗',
        ultra: '✓',
        allowedTiers: ['ULTRA'],
        visible: true,
        description: 'Multi-book revision compilation sirf Ultra plan me available'
    },
    {
        sn: 18,
        id: 'REVISION_HUB_LIMIT',
        label: 'Revision Hub (Unlock/Limit)',
        category: '🧠 Revision Hub',
        free: 'Unlock',
        basic: '✓',
        ultra: '✓',
        allowedTiers: ['FREE', 'BASIC', 'ULTRA'],
        visible: true
    },
    {
        sn: 19,
        id: 'NSTA_MESSENGER',
        label: 'Nsta Messenger',
        category: '💬 Nsta Messenger',
        free: '✓',
        basic: '✓',
        ultra: '✓',
        allowedTiers: ['FREE', 'BASIC', 'ULTRA'],
        visible: true
    },
    {
        sn: 20,
        id: 'DAILY_LIMIT',
        label: 'Daily Limit',
        category: '⚡ Limits & Multipliers',
        free: '1500',
        basic: '2500',
        ultra: '3500',
        allowedTiers: ['FREE', 'BASIC', 'ULTRA'],
        limits: { free: 1500, basic: 2500, ultra: 3500 },
        visible: true
    },
    {
        sn: 21,
        id: 'XP_MULTIPLIER',
        label: 'XP multiplier',
        category: '⚡ Limits & Multipliers',
        free: '1x',
        basic: '1.5x',
        ultra: '2.0x',
        allowedTiers: ['FREE', 'BASIC', 'ULTRA'],
        limits: { free: 1, basic: 1.5, ultra: 2 },
        visible: true
    },
    {
        sn: 22,
        id: 'AD_DISCOUNT',
        label: 'Ad discount',
        category: '⚡ Limits & Multipliers',
        free: '0%',
        basic: '10%',
        ultra: '20%',
        allowedTiers: ['FREE', 'BASIC', 'ULTRA'],
        limits: { free: 0, basic: 10, ultra: 20 },
        visible: true
    },
    {
        sn: 23,
        id: 'FONT_STYLE_COLOR',
        label: 'Text & Style color',
        category: '🎨 Themes & Styling',
        free: '✗',
        basic: '✓',
        ultra: '✓',
        allowedTiers: ['BASIC', 'ULTRA'],
        visible: true
    },
    {
        sn: 24,
        id: 'OFFLINE_DOWNLOAD',
        label: 'Offline Download',
        category: '📚 Study Content',
        free: '✗',
        basic: '✓',
        ultra: '✓',
        allowedTiers: ['BASIC', 'ULTRA'],
        visible: true
    },
    {
        sn: 25,
        id: 'DAILY_CLAIM',
        label: 'Daily claim',
        category: '⚡ Limits & Multipliers',
        free: '50 cr',
        basic: '5 diamond',
        ultra: '5 diamond',
        allowedTiers: ['FREE', 'BASIC', 'ULTRA'],
        visible: true,
        description: 'Free: 50 Coins | Basic: 5 Diamonds | Ultra: 5 Diamonds'
    },
    {
        sn: 26,
        id: 'STORE_DISCOUNT',
        label: 'Store discount',
        category: '⚡ Limits & Multipliers',
        free: '5%',
        basic: '10%',
        ultra: '10%',
        allowedTiers: ['FREE', 'BASIC', 'ULTRA'],
        limits: { free: 5, basic: 10, ultra: 10 },
        visible: true
    },
    {
        sn: 27,
        id: 'WRITING_CORRECTION',
        label: 'Writing & Correction mode',
        category: '⭐ Core Features',
        free: 'Free',
        basic: 'Basic',
        ultra: 'Ultra',
        allowedTiers: ['FREE', 'BASIC', 'ULTRA'],
        visible: true
    },
    {
        sn: 28,
        id: 'BASIC_THEME',
        label: 'Basic theme',
        category: '🎨 Themes & Styling',
        free: '✗',
        basic: '✓',
        ultra: '✓',
        allowedTiers: ['BASIC', 'ULTRA'],
        visible: true
    },
    {
        sn: 29,
        id: 'ULTRA_THEME',
        label: 'Ultra theme',
        category: '🎨 Themes & Styling',
        free: '✗',
        basic: '✗',
        ultra: '✓',
        allowedTiers: ['ULTRA'],
        visible: true
    },
    {
        sn: 30,
        id: 'MCQ_LIMIT',
        label: 'MCQ Limit',
        category: '⚡ Limits & Multipliers',
        free: '300 / day',
        basic: '1500 / day',
        ultra: '3000 / day',
        allowedTiers: ['FREE', 'BASIC', 'ULTRA'],
        limits: { free: 300, basic: 1500, ultra: 3000 },
        visible: true
    },
    {
        sn: 31,
        id: 'NAME_CHANGE',
        label: 'Name change',
        category: '⭐ Core Features',
        free: '100 cr / 10 diamond',
        basic: 'Same',
        ultra: 'Same',
        allowedTiers: ['FREE', 'BASIC', 'ULTRA'],
        creditCost: 100,
        diamondCost: 10,
        visible: true
    },

    // ── Table 2: Revision Slate ──
    {
        sn: 'RS.1',
        id: 'REVISION_FREE_SLATES',
        label: 'Revision Slate: Free Slates',
        category: '📝 Revision Slate',
        free: '2 free',
        basic: '3 free',
        ultra: '4 free',
        allowedTiers: ['FREE', 'BASIC', 'ULTRA'],
        limits: { free: 2, basic: 3, ultra: 4 },
        visible: true
    },
    {
        sn: 'RS.2',
        id: 'REVISION_BUY_SLATE',
        label: 'Revision Slate: 100 cr buy 1 slate',
        category: '📝 Revision Slate',
        free: '100 cr buy 1 slate',
        basic: 'Same',
        ultra: 'Same',
        allowedTiers: ['FREE', 'BASIC', 'ULTRA'],
        creditCost: 100,
        visible: true
    },
    {
        sn: 'RS.3',
        id: 'REVISION_LVL5_REWARD',
        label: 'Revision Slate: Level 5 reward',
        category: '📝 Revision Slate',
        free: 'Lev 5 - 1 slate',
        basic: 'Same',
        ultra: 'Same',
        allowedTiers: ['FREE', 'BASIC', 'ULTRA'],
        unlockLevel: 5,
        visible: true,
        description: 'Level 5 reach hone par 1 slate reward milta hai'
    },
    {
        sn: 'RS.4',
        id: 'REVISION_LVL8_REWARD',
        label: 'Revision Slate: Level 8 reward',
        category: '📝 Revision Slate',
        free: 'Lev 8 - 1 slate',
        basic: 'Same',
        ultra: 'Same',
        allowedTiers: ['FREE', 'BASIC', 'ULTRA'],
        unlockLevel: 8,
        visible: true,
        description: 'Level 8 reach hone par 1 slate reward milta hai'
    },

    // ── Table 3: Nsta Messenger ──
    {
        sn: 'NM.1',
        id: 'MESSENGER_FRIEND_LIMIT',
        label: 'Messenger: Friend Message (Limit)',
        category: '💬 Nsta Messenger',
        free: '10 / 20',
        basic: '20 / 50',
        ultra: '30 / 50',
        allowedTiers: ['FREE', 'BASIC', 'ULTRA'],
        limits: { free: 10, basic: 20, ultra: 30 },
        visible: true
    },
    {
        sn: 'NM.2',
        id: 'MESSENGER_DAILY_MSGS',
        label: 'Messenger: Messages per day',
        category: '💬 Nsta Messenger',
        free: '50 / day',
        basic: '100 / day',
        ultra: '300 / day',
        allowedTiers: ['FREE', 'BASIC', 'ULTRA'],
        limits: { free: 50, basic: 100, ultra: 300 },
        visible: true
    },
    {
        sn: 'NM.3',
        id: 'MESSENGER_CHAT_LOCK',
        label: 'Messenger: Chat Lock',
        category: '💬 Nsta Messenger',
        free: '✓',
        basic: '✓',
        ultra: '✓',
        allowedTiers: ['FREE', 'BASIC', 'ULTRA'],
        visible: true
    },
    {
        sn: 'NM.4',
        id: 'MESSENGER_CHANGE_PASSWORD',
        label: 'Messenger: Change Password',
        category: '💬 Nsta Messenger',
        free: '✓',
        basic: '✓',
        ultra: '✓',
        allowedTiers: ['FREE', 'BASIC', 'ULTRA'],
        visible: true
    }
];

/**
 * Returns merged features combining default master tier configuration
 * with any admin overrides stored in settings.featureConfig.
 */
export function getMergedTierFeatures(settingsFeatureConfig?: Record<string, any>): TierFeatureItem[] {
    const customConfig = settingsFeatureConfig || {};
    const seenIds = new Set<string>();

    const merged = MASTER_TIER_FEATURES.map(def => {
        seenIds.add(def.id);
        const override = customConfig[def.id];
        if (override) {
            return {
                ...def,
                ...override,
                // preserve sn and category unless explicitly changed
                sn: override.sn ?? def.sn,
                category: override.category ?? def.category,
            };
        }
        return def;
    });

    // Append any newly added custom features created by Admin
    Object.keys(customConfig).forEach(id => {
        if (!seenIds.has(id)) {
            const custom = customConfig[id];
            merged.push({
                sn: custom.sn || '+',
                id: custom.id || id,
                label: custom.label || id,
                category: custom.category || 'Custom Features',
                free: custom.free || (custom.allowedTiers?.includes('FREE') ? '✓' : '✗'),
                basic: custom.basic || (custom.allowedTiers?.includes('BASIC') ? '✓' : '✗'),
                ultra: custom.ultra || (custom.allowedTiers?.includes('ULTRA') ? '✓' : '✗'),
                allowedTiers: custom.allowedTiers || ['FREE', 'BASIC', 'ULTRA'],
                unlockLevel: custom.unlockLevel,
                creditCost: custom.creditCost,
                diamondCost: custom.diamondCost,
                limits: custom.limits,
                visible: custom.visible !== false,
                description: custom.description
            });
        }
    });

    return merged;
}

/**
 * Check if a feature is unlocked and visible for a specific user level and tier.
 */
export function checkFeatureAccess(
    featureId: string,
    userTier: 'free' | 'basic' | 'ultra',
    userLevel: number = 1,
    settingsFeatureConfig?: Record<string, any>
): {
    unlocked: boolean;
    visible: boolean;
    reason?: string;
    requiredLevel?: number;
    requiredTier?: SubscriptionTierType;
    feature?: TierFeatureItem;
} {
    const allFeatures = getMergedTierFeatures(settingsFeatureConfig);
    const feature = allFeatures.find(f => f.id === featureId);

    if (!feature) {
        return { unlocked: true, visible: true };
    }

    if (feature.visible === false) {
        return {
            unlocked: false,
            visible: false,
            reason: 'Feature deactivated by admin',
            feature
        };
    }

    // Level requirement check: if user level < unlockLevel, the feature is hidden/locked
    if (feature.unlockLevel && userLevel < feature.unlockLevel) {
        return {
            unlocked: false,
            visible: false, // "utne level tak wo chijhe hide rahega"
            reason: `Unlocks at Level ${feature.unlockLevel}`,
            requiredLevel: feature.unlockLevel,
            feature
        };
    }

    // Tier requirement check
    const normalizedUserTier = (userTier?.toUpperCase() as SubscriptionTierType) || 'FREE';
    const allowed = feature.allowedTiers || ['FREE', 'BASIC', 'ULTRA'];

    if (!allowed.includes(normalizedUserTier)) {
        const requiredTier: SubscriptionTierType = allowed.includes('BASIC') ? 'BASIC' : 'ULTRA';
        return {
            unlocked: false,
            visible: true,
            reason: `${requiredTier} Plan Required`,
            requiredTier,
            feature
        };
    }

    return { unlocked: true, visible: true, feature };
}
