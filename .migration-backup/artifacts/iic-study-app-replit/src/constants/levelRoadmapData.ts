// Level Roadmap feature has been removed. All features are permanently unlocked for all users.

export interface FeatureUnlockItem {
  id: string;
  title: string;
  hindiTitle: string;
  category: string;
  stageId: string;
  level: number;
  subStage: string;
  minXpNeeded: number;
  description: string;
}

export interface LevelMilestone {
  level: number;
  levelName: string;
  features: FeatureUnlockItem[];
}

export interface FeatureCustomContent {
  images?: string[];
  videos?: string[];
  customText?: string;
  customHtml?: string;
  customCss?: string;
  badgeText?: string;
  customLevel?: number;
  customStageId?: string;
  customStageLabel?: string;
  customMinXpNeeded?: number;
  customStageOrder?: number;
  customTitle?: string;
  customHindiTitle?: string;
  updatedAt?: string;
}

export interface RoadmapStageOption {
  stageId: string;
  stageLabel: string;
  level: number;
  subStage: string;
  minXpNeeded: number;
  stageOrder: number;
  description: string;
}

export const ROADMAP_STAGE_OPTIONS: RoadmapStageOption[] = [];
export const LEVEL_MILESTONES: LevelMilestone[] = [];
export const ALL_ROADMAP_FEATURES: FeatureUnlockItem[] = [];
export const ROADMAP_CUSTOM_STORAGE_KEY = 'nsta_roadmap_custom_content';

export const getAllRoadmapCustomContent = (): Record<string, FeatureCustomContent> => ({});
export const saveRoadmapCustomContent = (): void => {};
export const getEffectiveFeatureItem = (feat: any) => feat;
export const getEffectiveLevelMilestones = (): LevelMilestone[] => [];
export const getFeaturesUnlockedAtLevel = (_level: number): FeatureUnlockItem[] => [];
export const isFeatureUnlockedForLevel = (_featureId: string, _userLevel: number): boolean => true;

/**
 * Universal unlock check: Always returns true because Level Roadmap restrictions have been removed.
 * All features are fully visible and accessible to every student and admin.
 */
export const isFeatureUnlockedForUser = (
  _featureId: string,
  _userLevel?: number,
  _userXp?: number,
  _userRole?: string
): boolean => true;
