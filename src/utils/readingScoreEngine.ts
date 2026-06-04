/**
 * Reading Score Engine — time-based active reading/writing rewards
 *
 * Reading Mode:
 *   • Every 30 sec of active reading  → +5 score
 *   • Max reward window by level (L1-L8: 5 min, L9: 5.5 min … L15: 10 min)
 *   • Progress validation every 2 min: need ≥10% net forward progress
 *   • Anti-spam: only net forward topic progress counts
 *   • TTS topic highlight: each topic read via TTS → +1 score
 *
 * Writing Mode:
 *   • Every 5 min of validated writing → +25 score
 *   • Need ≥5% forward progress every 5 min
 */

import { tryEarnScore, logScoreActivity } from './scoreSystem';

/** Max reward window in seconds by level */
export const getReadingWindowSeconds = (level: number): number => {
  if (level <= 8) return 300;     // 5 min
  if (level === 9)  return 330;   // 5.5 min
  if (level === 10) return 360;   // 6 min
  if (level === 11) return 390;   // 6.5 min
  if (level === 12) return 420;   // 7 min
  if (level === 13) return 450;   // 7.5 min
  if (level === 14) return 480;   // 8 min
  return 600;                     // L15 = 10 min
};

export type WarningLevel = 0 | 1 | 2 | 3;
// 0 = scoring active, 1 = warn (2 min no progress), 2 = about to pause (3 min), 3 = paused

export interface ReadingScoreState {
  warningLevel: WarningLevel;
  isPaused: boolean;
  nextRewardInSec: number;
  sessionElapsedSec: number;
  maxWindowSec: number;
  lastScoreEarned: number;        // pts earned in last tick (for popup)
  totalSessionScore: number;
  progressPercent: number;        // net forward progress %
  mode: 'reading' | 'writing';
  isWindowClosed: boolean;        // max window reached
}

export interface ReadingScoreConfig {
  userId: string;
  userLevel: number;
  subscriptionLevel?: string;
  isPremium?: boolean;
  boostPercent?: number;
  mode?: 'reading' | 'writing';
  /** Called whenever score is earned. Parent should update totalScore in Firebase. */
  onScoreEarned?: (pts: number, activity: string) => void;
}

const READING_INTERVAL_SEC = 30;       // reward every 30s
const WRITING_INTERVAL_SEC = 300;      // reward every 5 min (300s)
const READING_REWARD_BASE = 5;         // +5 base per interval
const WRITING_REWARD_BASE = 25;        // +25 base per 5 min
const TTS_HIGHLIGHT_REWARD = 1;        // +1 per TTS topic read
const VALIDATION_INTERVAL_SEC = 120;   // check progress every 2 min
const MIN_PROGRESS_PCT = 10;           // 10% net forward required per 2 min
const WRITING_MIN_PROGRESS_PCT = 5;    // 5% net forward for write mode

const WARN1_THRESHOLD_SEC = 120;       // 2 min no progress → warn1
const WARN2_THRESHOLD_SEC = 180;       // 3 min → warn2
const PAUSE_THRESHOLD_SEC = 240;       // 4 min → pause

export class ReadingScoreSession {
  private config: ReadingScoreConfig;
  private startTime = 0;
  private lastRewardTime = 0;
  private lastValidationTime = 0;
  private lastValidationProgress = 0;
  private maxProgressReached = 0;      // highest % seen (anti-spam)
  private noProgressSec = 0;           // continuous seconds without progress
  private warningLevel: WarningLevel = 0;
  private isPaused = false;
  private totalSessionScore = 0;
  private lastScoreEarned = 0;
  private sessionElapsedSec = 0;
  private isWindowClosed = false;
  private mode: 'reading' | 'writing';
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private onStateChange?: (state: ReadingScoreState) => void;
  private currentProgress = 0;
  private ttsProgressSinceValidation = false; // new TTS section read

  constructor(config: ReadingScoreConfig, onStateChange?: (state: ReadingScoreState) => void) {
    this.config = config;
    this.mode = config.mode ?? 'reading';
    this.onStateChange = onStateChange;
  }

  start() {
    this.startTime = Date.now();
    this.lastRewardTime = this.startTime;
    this.lastValidationTime = this.startTime;
    this.lastValidationProgress = 0;
    this.maxProgressReached = 0;
    this.noProgressSec = 0;
    this.warningLevel = 0;
    this.isPaused = false;
    this.totalSessionScore = 0;
    this.lastScoreEarned = 0;
    this.sessionElapsedSec = 0;
    this.isWindowClosed = false;
    this.ttsProgressSinceValidation = false;

    this.intervalId = setInterval(() => this.tick(), 1000);
    this.emitState();
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /** Call whenever the user's reading progress changes (0-100) */
  updateProgress(percent: number) {
    const clipped = Math.max(0, Math.min(100, percent));
    // Net forward progress only (anti-spam)
    if (clipped > this.maxProgressReached) {
      this.maxProgressReached = clipped;
      // Progress made → reset no-progress timer, clear warnings
      if (this.warningLevel > 0 || this.isPaused) {
        this.noProgressSec = 0;
        this.warningLevel = 0;
        this.isPaused = false;
        this.emitState();
      }
    }
    this.currentProgress = clipped;
  }

  /** Call when a TTS topic/line is read aloud (+1 score, counts as progress) */
  onTtsHighlight() {
    this.ttsProgressSinceValidation = true;
    if (this.isWindowClosed) return;
    const pts = tryEarnScore(
      this.config.userId,
      TTS_HIGHLIGHT_REWARD,
      this.config.subscriptionLevel,
      this.config.isPremium,
      this.config.boostPercent,
      'READ_TTS_HIGHLIGHT',
    );
    if (pts > 0) {
      this.totalSessionScore += pts;
      this.lastScoreEarned = pts;
      this.config.onScoreEarned?.(pts, 'READ_TTS_HIGHLIGHT');
      this.emitState();
    }
    // Treat TTS activity as progress (reset warning)
    if (this.warningLevel > 0 || this.isPaused) {
      this.noProgressSec = 0;
      this.warningLevel = 0;
      this.isPaused = false;
    }
  }

  getState(): ReadingScoreState {
    const intervalSec = this.mode === 'reading' ? READING_INTERVAL_SEC : WRITING_INTERVAL_SEC;
    const now = Date.now();
    const elapsed = this.intervalId ? (now - this.lastRewardTime) / 1000 : 0;
    const nextRewardInSec = Math.max(0, Math.ceil(intervalSec - elapsed));

    return {
      warningLevel: this.warningLevel,
      isPaused: this.isPaused,
      nextRewardInSec,
      sessionElapsedSec: this.sessionElapsedSec,
      maxWindowSec: getReadingWindowSeconds(this.config.userLevel),
      lastScoreEarned: this.lastScoreEarned,
      totalSessionScore: this.totalSessionScore,
      progressPercent: this.maxProgressReached,
      mode: this.mode,
      isWindowClosed: this.isWindowClosed,
    };
  }

  private tick() {
    this.sessionElapsedSec++;
    const maxWindow = getReadingWindowSeconds(this.config.userLevel);

    // Max window reached → close scoring
    if (this.sessionElapsedSec >= maxWindow) {
      if (!this.isWindowClosed) {
        this.isWindowClosed = true;
        this.stop();
        this.emitState();
      }
      return;
    }

    // Validation check every 2 min
    const secSinceValidation = (Date.now() - this.lastValidationTime) / 1000;
    if (secSinceValidation >= VALIDATION_INTERVAL_SEC) {
      const netProgress = this.maxProgressReached - this.lastValidationProgress;
      const minRequired = this.mode === 'reading' ? MIN_PROGRESS_PCT : WRITING_MIN_PROGRESS_PCT;
      const validProgress = netProgress >= minRequired || this.ttsProgressSinceValidation;

      if (!validProgress) {
        this.noProgressSec += Math.round(secSinceValidation);
      } else {
        this.noProgressSec = 0;
        this.warningLevel = 0;
      }

      this.lastValidationProgress = this.maxProgressReached;
      this.lastValidationTime = Date.now();
      this.ttsProgressSinceValidation = false;
    }

    // Warning / pause logic
    if (this.noProgressSec >= PAUSE_THRESHOLD_SEC) {
      this.warningLevel = 3;
      this.isPaused = true;
    } else if (this.noProgressSec >= WARN2_THRESHOLD_SEC) {
      this.warningLevel = 2;
      this.isPaused = false;
    } else if (this.noProgressSec >= WARN1_THRESHOLD_SEC) {
      this.warningLevel = 1;
      this.isPaused = false;
    } else {
      this.warningLevel = 0;
      this.isPaused = false;
    }

    // Award score on interval (if not paused / window closed)
    if (!this.isPaused && !this.isWindowClosed) {
      const intervalSec = this.mode === 'reading' ? READING_INTERVAL_SEC : WRITING_INTERVAL_SEC;
      const elapsed = (Date.now() - this.lastRewardTime) / 1000;
      if (elapsed >= intervalSec) {
        this.lastRewardTime = Date.now();
        const baseScore = this.mode === 'reading' ? READING_REWARD_BASE : WRITING_REWARD_BASE;
        const activity = this.mode === 'reading' ? 'READ_ACTIVE_30S' : 'WRITE_ACTIVE_5MIN';
        const pts = tryEarnScore(
          this.config.userId,
          baseScore,
          this.config.subscriptionLevel,
          this.config.isPremium,
          this.config.boostPercent,
          activity,
        );
        if (pts > 0) {
          this.totalSessionScore += pts;
          this.lastScoreEarned = pts;
          this.config.onScoreEarned?.(pts, activity);
        } else {
          this.lastScoreEarned = 0;
        }
      }
    }

    this.emitState();
  }

  private emitState() {
    this.onStateChange?.(this.getState());
  }
}
