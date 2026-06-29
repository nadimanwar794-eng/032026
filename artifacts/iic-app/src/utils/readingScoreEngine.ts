/**
 * Reading Score Engine — time-based active reading/writing rewards
 *
 * Reading Mode:
 *   • Every 30 sec of active reading  → +5 score
 *   • Max reward window by level (L1-L8: 5 min, L9: 5.5 min … L15: 10 min)
 *   • Progress validation every 2 min: need ≥10% net forward progress
 *   • Anti-spam: only net forward topic progress counts
 *   • TTS topic highlight: each topic read via TTS → +1 score (NO cooldown — natural timing)
 *   • Manual topic tap: user must stay on topic for 10 sec → +2 score (Touch Protection)
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
  mode: 'reading' | 'writing' | 'video' | 'audio' | 'pdf';
  isWindowClosed: boolean;        // max window reached
  // Touch Protection (manual tap anti-abuse)
  touchProtectionActive: boolean; // true while 10-sec countdown is running
  touchProtectionCooldownSec: number; // seconds remaining in current countdown
}

export interface ReadingScoreConfig {
  userId: string;
  userLevel: number;
  subscriptionLevel?: string;
  isPremium?: boolean;
  boostPercent?: number;
  mode?: 'reading' | 'writing' | 'video' | 'audio' | 'pdf';
  /** Called whenever score is earned. Parent should update totalScore in Firebase. */
  onScoreEarned?: (pts: number, activity: string) => void;
}

const READING_INTERVAL_SEC = 30;       // reward every 30s
const WRITING_INTERVAL_SEC = 300;      // reward every 5 min (300s)
const VIDEO_INTERVAL_SEC   = 30;       // reward every 30s (same as reading)
const AUDIO_INTERVAL_SEC   = 30;       // reward every 30s (same as reading)
const PDF_INTERVAL_SEC     = 30;       // reward every 30s (same as reading)
const READING_REWARD_BASE = 5;         // +5 base per interval
const WRITING_REWARD_BASE = 25;        // +25 base per 5 min
const VIDEO_REWARD_BASE   = 8;         // +8 base per 60s watch
const AUDIO_REWARD_BASE   = 6;         // +6 base per 60s listen
const PDF_REWARD_BASE     = 5;         // +5 base per 60s read
const TTS_HIGHLIGHT_REWARD = 1;        // +1 per TTS topic read
const VALIDATION_INTERVAL_SEC = 120;   // check progress every 2 min
const MIN_PROGRESS_PCT = 10;           // 10% net forward required per 2 min
const WRITING_MIN_PROGRESS_PCT = 5;    // 5% net forward for write mode

const WARN1_THRESHOLD_SEC = 120;       // 2 min no progress → warn1
const WARN2_THRESHOLD_SEC = 180;       // 3 min → warn2
const PAUSE_THRESHOLD_SEC = 240;       // 4 min → pause

const MANUAL_STAY_MS = 10_000;         // must stay on topic 10s to earn manual reward
const MANUAL_REWARD_PTS = 2;           // +2 for manual topic engagement

const TTS_MIN_INTERVAL_MS = 3_000;     // TTS: min 3 sec between highlights (prevents 3x-speed farming)

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
  private mode: 'reading' | 'writing' | 'video' | 'audio' | 'pdf';
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private onStateChange?: (state: ReadingScoreState) => void;
  private currentProgress = 0;
  private ttsProgressSinceValidation = false;

  // TTS rate-limit (prevents 3x-speed farming)
  private lastTtsHighlightRewardTime = 0;

  // Touch Protection state
  private touchProtectionActive = false;
  private touchProtectionTopicIdx = -1;
  private touchProtectionStartMs = 0;
  private touchProtectionTimeoutId: ReturnType<typeof setTimeout> | null = null;

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
    this.lastTtsHighlightRewardTime = 0;
    this._clearTouchProtection();

    this.intervalId = setInterval(() => this.tick(), 1000);
    this.emitState();
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this._clearTouchProtection();
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

  /** Called when TTS reads a topic aloud.
   *  +1 per topic, but minimum 3 sec between rewards — prevents 3x-speed farming.
   *  Activity still resets stall warnings regardless of reward eligibility. */
  onTtsHighlight() {
    this.ttsProgressSinceValidation = true;
    // TTS activity = progress, reset stall warnings
    if (this.warningLevel > 0 || this.isPaused) {
      this.noProgressSec = 0;
      this.warningLevel = 0;
      this.isPaused = false;
    }
    if (this.isWindowClosed) return;

    // If Touch Protection is active (user just tapped manually), suppress TTS rewards.
    // This prevents manual-tap → TTS-auto-fire → instant reward bypass.
    // After the 10-sec countdown completes (+2 awarded), TTS rewards resume normally.
    if (this.touchProtectionActive) return;

    const now = Date.now();
    // Rate-limit: at most +1 every 3 seconds (normal speed reads fine; 3x-speed capped)
    if (this.lastTtsHighlightRewardTime > 0 && now - this.lastTtsHighlightRewardTime < TTS_MIN_INTERVAL_MS) return;

    const pts = tryEarnScore(
      this.config.userId,
      TTS_HIGHLIGHT_REWARD,
      this.config.subscriptionLevel,
      this.config.isPremium,
      this.config.boostPercent,
      'READ_TTS_HIGHLIGHT',
    );
    if (pts > 0) {
      this.lastTtsHighlightRewardTime = now;
      this.totalSessionScore += pts;
      this.lastScoreEarned = pts;
      this.config.onScoreEarned?.(pts, 'READ_TTS_HIGHLIGHT');
      this.emitState();
    }
  }

  /** Called when user MANUALLY taps a topic (Touch Protection).
   *  User must stay on the same topic for 10 sec to earn +2.
   *  Tapping a different topic before 10 sec cancels the pending reward.
   *  Returns true if a new countdown started, false if same topic (already counting). */
  onManualTopicEnter(topicIdx: number): void {
    if (this.isWindowClosed) return;

    // Same topic tapped again while counting → ignore (already running)
    if (this.touchProtectionActive && this.touchProtectionTopicIdx === topicIdx) return;

    // Cancel any previous pending reward
    this._clearTouchProtection();

    this.touchProtectionActive = true;
    this.touchProtectionTopicIdx = topicIdx;
    this.touchProtectionStartMs = Date.now();
    this.emitState();

    // Award +2 after 10 sec of staying on the same topic
    this.touchProtectionTimeoutId = setTimeout(() => {
      this.touchProtectionTimeoutId = null;
      this.touchProtectionActive = false;

      if (this.isWindowClosed) { this.emitState(); return; }

      const pts = tryEarnScore(
        this.config.userId,
        MANUAL_REWARD_PTS,
        this.config.subscriptionLevel,
        this.config.isPremium,
        this.config.boostPercent,
        'READ_MANUAL_TOPIC_10S',
      );
      if (pts > 0) {
        this.totalSessionScore += pts;
        this.lastScoreEarned = pts;
        this.ttsProgressSinceValidation = true; // counts as valid activity
        this.config.onScoreEarned?.(pts, 'READ_MANUAL_TOPIC_10S');
      }
      this.emitState();
    }, MANUAL_STAY_MS);
  }

  private _clearTouchProtection() {
    if (this.touchProtectionTimeoutId) {
      clearTimeout(this.touchProtectionTimeoutId);
      this.touchProtectionTimeoutId = null;
    }
    this.touchProtectionActive = false;
    this.touchProtectionTopicIdx = -1;
    this.touchProtectionStartMs = 0;
  }

  getState(): ReadingScoreState {
    const intervalSec =
      this.mode === 'reading' ? READING_INTERVAL_SEC :
      this.mode === 'writing' ? WRITING_INTERVAL_SEC :
      this.mode === 'video'   ? VIDEO_INTERVAL_SEC   :
      this.mode === 'audio'   ? AUDIO_INTERVAL_SEC   :
      PDF_INTERVAL_SEC;
    const now = Date.now();
    const elapsed = this.intervalId ? (now - this.lastRewardTime) / 1000 : 0;
    const nextRewardInSec = Math.max(0, Math.ceil(intervalSec - elapsed));

    // Touch protection countdown seconds remaining
    let touchProtectionCooldownSec = 0;
    if (this.touchProtectionActive && this.touchProtectionStartMs > 0) {
      const msElapsed = now - this.touchProtectionStartMs;
      touchProtectionCooldownSec = Math.max(0, Math.ceil((MANUAL_STAY_MS - msElapsed) / 1000));
    }

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
      touchProtectionActive: this.touchProtectionActive,
      touchProtectionCooldownSec,
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

    // Video/Audio/PDF: no scroll validation — always active, never pause
    if (this.mode === 'video' || this.mode === 'audio' || this.mode === 'pdf') {
      this.warningLevel = 0;
      this.isPaused = false;
    } else {
      // Validation check every 2 min (reading / writing only)
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
    }

    // Award score on interval (if not paused / window closed)
    if (!this.isPaused && !this.isWindowClosed) {
      const intervalSec =
        this.mode === 'reading' ? READING_INTERVAL_SEC :
        this.mode === 'writing' ? WRITING_INTERVAL_SEC :
        this.mode === 'video'   ? VIDEO_INTERVAL_SEC   :
        this.mode === 'audio'   ? AUDIO_INTERVAL_SEC   :
        PDF_INTERVAL_SEC;
      const elapsed = (Date.now() - this.lastRewardTime) / 1000;
      if (elapsed >= intervalSec) {
        this.lastRewardTime = Date.now();
        const baseScore =
          this.mode === 'reading' ? READING_REWARD_BASE :
          this.mode === 'writing' ? WRITING_REWARD_BASE :
          this.mode === 'video'   ? VIDEO_REWARD_BASE   :
          this.mode === 'audio'   ? AUDIO_REWARD_BASE   :
          PDF_REWARD_BASE;
        const activity =
          this.mode === 'reading' ? 'READ_ACTIVE_30S'    :
          this.mode === 'writing' ? 'WRITE_ACTIVE_5MIN'  :
          this.mode === 'video'   ? 'VIDEO_WATCH_60S'    :
          this.mode === 'audio'   ? 'AUDIO_LISTEN_60S'   :
          'PDF_READ_60S';
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
