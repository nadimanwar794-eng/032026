/**
 * Reading Score Engine — time-based active reading/writing rewards
 *
 * Reading Mode:
 *   • Every 30 sec of active reading  → +5 pts
 *   • Max reward window by level (L1-L8: 5 min … L15: 10 min)
 *   • Progress validation every 2 min: need ≥10% net forward progress
 *   • TTS topic highlight → +1 pts; Manual topic 10s → +2 pts
 *
 * Writing Mode:
 *   • Every 60 sec → +10 pts (earns pts, not credits)
 *   • Scroll check: need ≥5% net scroll per 60 sec (independent timer)
 *   • After 2 consecutive failed scroll checks: scoring stops (isPermanentlyStopped)
 *   • Resumes when user scrolls again
 *
 * Video Mode:
 *   • Every 6 sec of active play → +1 pts
 *   • Every 60 sec of active play → +10 credits
 *   • No reward when paused/stopped (call setVideoPlaying(bool))
 *
 * PDF Mode:
 *   • Every 30 sec → +5 pts (earns pts, not credits)
 *   • Scroll check: need ≥2.5% net scroll per 30 sec (independent timer)
 *   • Stop after 2 consecutive fails; resumes when user scrolls again
 *
 * Q&A Mode:
 *   • Every 30 sec → +5 pts (earns pts, not credits)
 *   • Scroll check: need ≥5% net scroll per 30 sec (independent timer)
 *   • Stop after 2 consecutive fails; resumes when user scrolls again
 *
 * Audio Mode:
 *   • Every 30 sec → +5 pts
 */

import { tryEarnScore } from './scoreSystem';

/** Max reward window in seconds by level */
export const getReadingWindowSeconds = (level: number): number => {
  if (level <= 8) return 300;
  if (level === 9)  return 330;
  if (level === 10) return 360;
  if (level === 11) return 390;
  if (level === 12) return 420;
  if (level === 13) return 450;
  if (level === 14) return 480;
  return 600;
};

export type WarningLevel = 0 | 1 | 2 | 3;

export interface ReadingScoreState {
  warningLevel: WarningLevel;
  isPaused: boolean;
  nextRewardInSec: number;
  sessionElapsedSec: number;
  maxWindowSec: number;
  lastScoreEarned: number;
  totalSessionScore: number;
  progressPercent: number;
  mode: 'reading' | 'writing' | 'video' | 'audio' | 'pdf' | 'qa';
  isWindowClosed: boolean;
  touchProtectionActive: boolean;
  touchProtectionCooldownSec: number;
  // Scroll-based stop state (writing, pdf, qa, video)
  isPermanentlyStopped: boolean;  // stopped due to 2 consecutive scroll fails
  scrollFailStreak: number;       // 0-2: how many consecutive fails
  totalCreditsEarned: number;     // credits earned this session
}

export interface ReadingScoreConfig {
  userId: string;
  userLevel: number;
  subscriptionLevel?: string;
  isPremium?: boolean;
  boostPercent?: number;
  mode?: 'reading' | 'writing' | 'video' | 'audio' | 'pdf' | 'qa';
  /** Context label shown in coin history */
  lessonLabel?: string;
  /** Called when pts are earned (updates totalScore). Reading mode only. */
  onScoreEarned?: (pts: number, activity: string) => void;
  /** Called when credits are earned directly (does NOT affect pts/totalScore).
   *  Used for Video (60s), PDF (60s), Writing (60s), Q&A (60s). */
  onCreditsEarned?: (credits: number, activity: string) => void;
}

// ── Constants ────────────────────────────────────────────────────────────────
const READING_INTERVAL_SEC        = 30;   // +5 pts every 30s
const WRITING_INTERVAL_SEC        = 60;   // +10 pts every 60s
const WRITING_SCROLL_CHECK_SEC    = 60;   // scroll check every 60s (independent)
const VIDEO_PTS_INTERVAL_SEC      = 30;   // +5 pts every 30s of playing
const VIDEO_CR_INTERVAL_SEC       = 60;   // +10 credits every 60s of playing
const AUDIO_INTERVAL_SEC          = 30;   // +5 pts every 30s
const PDF_INTERVAL_SEC            = 30;   // +5 pts every 30s
const PDF_SCROLL_CHECK_SEC        = 30;   // scroll check every 30s (independent)
const QA_INTERVAL_SEC             = 30;   // +5 pts every 30s
const QA_SCROLL_CHECK_SEC         = 30;   // scroll check every 30s (independent)

const READING_REWARD_BASE  = 5;
const WRITING_PTS_BASE     = 10;   // pts (not credits)
const VIDEO_PTS_BASE       = 5;
const VIDEO_CREDIT_BASE    = 10;
const AUDIO_REWARD_BASE    = 5;    // 5 pts (was 6)
const PDF_PTS_BASE         = 5;    // pts (not credits)
const QA_PTS_BASE          = 5;    // pts (not credits)

const TTS_HIGHLIGHT_REWARD   = 1;
const VALIDATION_INTERVAL_SEC = 120;
const MIN_PROGRESS_PCT        = 10;   // reading: 10% per 2min
const WRITING_MIN_SCROLL_PCT  = 5;    // writing: 5% per 60s check
const PDF_MIN_SCROLL_PCT      = 2.5;  // pdf: 2.5% per 30s check
const QA_MIN_SCROLL_PCT       = 5;    // Q&A: 5% per 30s check
const MAX_SCROLL_FAIL_STREAK  = 2;    // stop after 2 consecutive fails

const WARN1_THRESHOLD_SEC = 120;
const WARN2_THRESHOLD_SEC = 180;
const PAUSE_THRESHOLD_SEC = 240;

const MANUAL_STAY_MS    = 10_000;
const MANUAL_REWARD_PTS = 2;
const TTS_MIN_INTERVAL_MS = 3_000;

export class ReadingScoreSession {
  private config: ReadingScoreConfig;
  private startTime = 0;
  private lastRewardTime = 0;       // general: reading/audio
  private lastPtsRewardTime = 0;    // video: 6s pts ticker
  private lastCreditRewardTime = 0; // video/pdf/writing/qa: 60s credit ticker
  private lastValidationTime = 0;
  private lastValidationProgress = 0;
  private maxProgressReached = 0;
  private noProgressSec = 0;
  private lastIntervalProgress = 0; // scroll % at last writing/pdf/qa interval check
  private warningLevel: WarningLevel = 0;
  private isPaused = false;
  private totalSessionScore = 0;
  private totalCreditsEarned = 0;
  private lastScoreEarned = 0;
  private sessionElapsedSec = 0;
  private isWindowClosed = false;
  private mode: 'reading' | 'writing' | 'video' | 'audio' | 'pdf' | 'qa';
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private onStateChange?: (state: ReadingScoreState) => void;
  private currentProgress = 0;
  private ttsProgressSinceValidation = false;

  // Video play state
  private isVideoPlaying = false;
  private videoPlayingSecsSinceLastPts = 0;   // counts up to VIDEO_PTS_INTERVAL_SEC
  private videoPlayingSecsSinceLastCr  = 0;   // counts up to VIDEO_CR_INTERVAL_SEC

  // Scroll-fail tracking (writing/pdf/qa)
  private scrollFailStreak = 0;
  private isPermanentlyStopped = false;
  private lastScrollCheckTime = 0;   // separate from credit timer

  // TTS rate-limit
  private lastTtsHighlightRewardTime = 0;

  // Touch Protection
  private touchProtectionActive = false;
  private touchProtectionTopicIdx = -1;
  private touchProtectionStartMs = 0;
  private touchProtectionTimeoutId: ReturnType<typeof setTimeout> | null = null;

  // Page Visibility — pause when tab/app is hidden
  private isPageVisible = true;
  private visibilityHandler: (() => void) | null = null;

  constructor(config: ReadingScoreConfig, onStateChange?: (state: ReadingScoreState) => void) {
    this.config = config;
    this.mode = config.mode ?? 'reading';
    this.onStateChange = onStateChange;
  }

  start() {
    this.startTime = Date.now();
    this.lastRewardTime = this.startTime;
    this.lastPtsRewardTime = this.startTime;
    this.lastCreditRewardTime = this.startTime;
    this.lastValidationTime = this.startTime;
    this.lastValidationProgress = 0;
    this.maxProgressReached = 0;
    this.noProgressSec = 0;
    this.warningLevel = 0;
    this.isPaused = false;
    this.totalSessionScore = 0;
    this.totalCreditsEarned = 0;
    this.lastScoreEarned = 0;
    this.sessionElapsedSec = 0;
    this.isWindowClosed = false;
    this.ttsProgressSinceValidation = false;
    this.lastTtsHighlightRewardTime = 0;
    this.lastIntervalProgress = 0;
    this.scrollFailStreak = 0;
    this.isPermanentlyStopped = false;
    this.lastScrollCheckTime = this.startTime;
    this.isVideoPlaying = false;
    this.videoPlayingSecsSinceLastPts = 0;
    this.videoPlayingSecsSinceLastCr  = 0;
    this._clearTouchProtection();

    // ── Page Visibility: pause timers when user switches apps/tabs ──────────
    if (typeof document !== 'undefined') {
      this.isPageVisible = !document.hidden;
      this.visibilityHandler = () => {
        const nowVisible = !document.hidden;
        if (nowVisible && !this.isPageVisible) {
          // Just became visible — reset all timer anchors so hidden time is NOT counted
          const now = Date.now();
          this.lastRewardTime       = now;
          this.lastPtsRewardTime    = now;
          this.lastCreditRewardTime = now;
          this.lastValidationTime   = now;
        }
        this.isPageVisible = nowVisible;
      };
      document.addEventListener('visibilitychange', this.visibilityHandler);
    }

    this.intervalId = setInterval(() => this.tick(), 1000);
    this.emitState();
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    // Remove visibility listener
    if (this.visibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
    this._clearTouchProtection();
  }

  /** Update scroll/reading progress (0-100). For reading: topic progress. For writing/pdf/qa: scroll %. */
  updateProgress(percent: number) {
    const clipped = Math.max(0, Math.min(100, percent));
    const isScrollMode = this.mode === 'writing' || this.mode === 'pdf' || this.mode === 'qa';

    // Net forward progress only
    if (clipped > this.maxProgressReached) {
      this.maxProgressReached = clipped;

      // Reading mode: reset stall warnings on progress
      if (this.mode === 'reading') {
        if (this.warningLevel > 0 || this.isPaused) {
          this.noProgressSec = 0;
          this.warningLevel = 0;
          this.isPaused = false;
          this.emitState();
        }
      }

      // Scroll modes: if permanently stopped, resume on new scroll progress
      if (isScrollMode && this.isPermanentlyStopped) {
        this.isPermanentlyStopped = false;
        this.scrollFailStreak = 0;
        this.lastIntervalProgress = clipped; // reset baseline from here
        this.lastCreditRewardTime = Date.now(); // restart credit timer
        this.lastScrollCheckTime = Date.now(); // restart scroll check timer
        this.emitState();
      }
    }
    this.currentProgress = clipped;
  }

  /** For video mode: call when play/pause state changes. */
  setVideoPlaying(playing: boolean) {
    this.isVideoPlaying = playing;
    this.emitState();
  }

  /** TTS highlight event — reading mode only */
  onTtsHighlight() {
    this.ttsProgressSinceValidation = true;
    if (this.warningLevel > 0 || this.isPaused) {
      this.noProgressSec = 0;
      this.warningLevel = 0;
      this.isPaused = false;
    }
    if (this.isWindowClosed) return;
    if (this.touchProtectionActive) return;

    const now = Date.now();
    if (this.lastTtsHighlightRewardTime > 0 && now - this.lastTtsHighlightRewardTime < TTS_MIN_INTERVAL_MS) return;

    const pts = tryEarnScore(
      this.config.userId,
      TTS_HIGHLIGHT_REWARD,
      this.config.subscriptionLevel,
      this.config.isPremium,
      this.config.boostPercent,
      'READ_TTS_HIGHLIGHT',
      undefined,
      undefined,
      this.config.lessonLabel,
    );
    if (pts > 0) {
      this.lastTtsHighlightRewardTime = now;
      this.totalSessionScore += pts;
      this.lastScoreEarned = pts;
      this.config.onScoreEarned?.(pts, 'READ_TTS_HIGHLIGHT');
      this.emitState();
    }
  }

  /** Manual topic tap (Touch Protection) — reading mode only */
  onManualTopicEnter(topicIdx: number): void {
    if (this.isWindowClosed) return;
    if (this.touchProtectionActive && this.touchProtectionTopicIdx === topicIdx) return;

    this._clearTouchProtection();
    this.touchProtectionActive = true;
    this.touchProtectionTopicIdx = topicIdx;
    this.touchProtectionStartMs = Date.now();
    this.emitState();

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
        undefined,
        undefined,
        this.config.lessonLabel,
      );
      if (pts > 0) {
        this.totalSessionScore += pts;
        this.lastScoreEarned = pts;
        this.ttsProgressSinceValidation = true;
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
    const now = Date.now();

    // nextRewardInSec: depends on mode
    let nextRewardInSec = 0;
    if (this.mode === 'reading') {
      const elapsed = this.intervalId ? (now - this.lastRewardTime) / 1000 : 0;
      nextRewardInSec = Math.max(0, Math.ceil(READING_INTERVAL_SEC - elapsed));
    } else if (this.mode === 'audio') {
      const elapsed = this.intervalId ? (now - this.lastRewardTime) / 1000 : 0;
      nextRewardInSec = Math.max(0, Math.ceil(AUDIO_INTERVAL_SEC - elapsed));
    } else if (this.mode === 'video') {
      // Show countdown to next pts reward (30s)
      const secsLeft = VIDEO_PTS_INTERVAL_SEC - this.videoPlayingSecsSinceLastPts;
      nextRewardInSec = Math.max(0, secsLeft);
    } else {
      // writing/pdf/qa: show countdown to next credit tick
      const elapsed = this.intervalId ? (now - this.lastCreditRewardTime) / 1000 : 0;
      const interval = this.mode === 'writing' ? WRITING_INTERVAL_SEC : this.mode === 'qa' ? QA_INTERVAL_SEC : PDF_INTERVAL_SEC;
      nextRewardInSec = Math.max(0, Math.ceil(interval - elapsed));
    }

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
      isPermanentlyStopped: this.isPermanentlyStopped,
      scrollFailStreak: this.scrollFailStreak,
      totalCreditsEarned: this.totalCreditsEarned,
    };
  }

  private tick() {
    // Skip entirely when page is hidden — no time accumulation, no rewards
    if (!this.isPageVisible) return;

    this.sessionElapsedSec++;
    const maxWindow = getReadingWindowSeconds(this.config.userLevel);

    if (this.sessionElapsedSec >= maxWindow) {
      if (!this.isWindowClosed) {
        this.isWindowClosed = true;
        this.stop();
        this.emitState();
      }
      return;
    }

    // ── Video mode: separate 6s pts + 60s credits ────────────────────────────
    if (this.mode === 'video') {
      if (this.isVideoPlaying) {
        this.videoPlayingSecsSinceLastPts++;
        this.videoPlayingSecsSinceLastCr++;

        // +1 pts every 6 seconds of play
        if (this.videoPlayingSecsSinceLastPts >= VIDEO_PTS_INTERVAL_SEC) {
          this.videoPlayingSecsSinceLastPts = 0;
          const pts = tryEarnScore(
            this.config.userId,
            VIDEO_PTS_BASE,
            this.config.subscriptionLevel,
            this.config.isPremium,
            this.config.boostPercent,
            'VIDEO_WATCH_6S',
            undefined,
            undefined,
            this.config.lessonLabel,
          );
          if (pts > 0) {
            this.totalSessionScore += pts;
            this.lastScoreEarned = pts;
            this.config.onScoreEarned?.(pts, 'VIDEO_WATCH_6S');
          }
        }

        // +10 credits every 60 seconds of play
        if (this.videoPlayingSecsSinceLastCr >= VIDEO_CR_INTERVAL_SEC) {
          this.videoPlayingSecsSinceLastCr = 0;
          this._awardCredits(VIDEO_CREDIT_BASE, 'VIDEO_WATCH_60S');
        }
      }
      this.emitState();
      return;
    }

    // ── Audio mode: unchanged — pts every 30s ────────────────────────────────
    if (this.mode === 'audio') {
      const elapsed = (Date.now() - this.lastRewardTime) / 1000;
      if (elapsed >= AUDIO_INTERVAL_SEC) {
        this.lastRewardTime = Date.now();
        const pts = tryEarnScore(
          this.config.userId,
          AUDIO_REWARD_BASE,
          this.config.subscriptionLevel,
          this.config.isPremium,
          this.config.boostPercent,
          'AUDIO_LISTEN_30S',
          undefined,
          undefined,
          this.config.lessonLabel,
        );
        if (pts > 0) {
          this.totalSessionScore += pts;
          this.lastScoreEarned = pts;
          this.config.onScoreEarned?.(pts, 'AUDIO_LISTEN_30S');
        } else {
          this.lastScoreEarned = 0;
        }
      }
      this.emitState();
      return;
    }

    // ── Reading mode: pts-based with validation ──────────────────────────────
    if (this.mode === 'reading') {
      // Validation check every 2 min
      const secSinceValidation = (Date.now() - this.lastValidationTime) / 1000;
      if (secSinceValidation >= VALIDATION_INTERVAL_SEC) {
        const netProgress = this.maxProgressReached - this.lastValidationProgress;
        const validProgress = netProgress >= MIN_PROGRESS_PCT || this.ttsProgressSinceValidation;
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

      // Warning / pause
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

      if (!this.isPaused) {
        const elapsed = (Date.now() - this.lastRewardTime) / 1000;
        if (elapsed >= READING_INTERVAL_SEC) {
          this.lastRewardTime = Date.now();
          const pts = tryEarnScore(
            this.config.userId,
            READING_REWARD_BASE,
            this.config.subscriptionLevel,
            this.config.isPremium,
            this.config.boostPercent,
            'READ_ACTIVE_30S',
            undefined,
            undefined,
            this.config.lessonLabel,
          );
          if (pts > 0) {
            this.totalSessionScore += pts;
            this.lastScoreEarned = pts;
            this.config.onScoreEarned?.(pts, 'READ_ACTIVE_30S');
          } else {
            this.lastScoreEarned = 0;
          }
        }
      }

      this.emitState();
      return;
    }

    // ── Writing / PDF / Q&A: independent scroll-check + pts-award timers ────
    const minScrollPct = this.mode === 'qa' ? QA_MIN_SCROLL_PCT : this.mode === 'pdf' ? PDF_MIN_SCROLL_PCT : WRITING_MIN_SCROLL_PCT;
    const ptsInterval  = this.mode === 'qa' ? QA_INTERVAL_SEC     : this.mode === 'writing' ? WRITING_INTERVAL_SEC : PDF_INTERVAL_SEC;
    const scrollCheckInt = this.mode === 'qa' ? QA_SCROLL_CHECK_SEC : this.mode === 'writing' ? WRITING_SCROLL_CHECK_SEC : PDF_SCROLL_CHECK_SEC;
    const ptsBase      = this.mode === 'qa' ? QA_PTS_BASE         : this.mode === 'writing' ? WRITING_PTS_BASE        : PDF_PTS_BASE;
    const activityKey  = this.mode === 'qa' ? 'QA_ACTIVE'         : this.mode === 'writing' ? 'WRITE_ACTIVE'          : 'PDF_ACTIVE';

    // ── Scroll check (independent timer) ────────────────────────────────────
    const secSinceScrollCheck = (Date.now() - this.lastScrollCheckTime) / 1000;
    if (secSinceScrollCheck >= scrollCheckInt) {
      this.lastScrollCheckTime = Date.now();
      const netScroll = this.currentProgress - this.lastIntervalProgress;
      if (netScroll < minScrollPct) {
        this.scrollFailStreak = Math.min(this.scrollFailStreak + 1, MAX_SCROLL_FAIL_STREAK);
        if (this.scrollFailStreak >= MAX_SCROLL_FAIL_STREAK) {
          this.isPermanentlyStopped = true;
          this.warningLevel = 3;
        } else {
          this.warningLevel = 1;
        }
      } else {
        this.scrollFailStreak = 0;
        this.warningLevel = 0;
        this.lastIntervalProgress = this.currentProgress;
      }
    }

    // ── Pts award (independent timer) — only if not permanently stopped ─────
    if (!this.isPermanentlyStopped) {
      const elapsed = (Date.now() - this.lastCreditRewardTime) / 1000;
      if (elapsed >= ptsInterval) {
        this.lastCreditRewardTime = Date.now();
        // Award as pts (affects totalScore), not credits
        const pts = tryEarnScore(
          this.config.userId,
          ptsBase,
          this.config.subscriptionLevel,
          this.config.isPremium,
          this.config.boostPercent,
          activityKey,
          undefined,
          undefined,
          this.config.lessonLabel,
        );
        if (pts > 0) {
          this.totalSessionScore += pts;
          this.lastScoreEarned = pts;
          this.config.onScoreEarned?.(pts, activityKey);
        }
      }
    }

    this.emitState();
  }

  /** Award credits directly (no pts/totalScore effect). */
  private _awardCredits(amount: number, activity: string) {
    this.totalCreditsEarned += amount;
    this.lastScoreEarned = amount; // show in HUD (totalCreditsEarned used for display)
    this.config.onCreditsEarned?.(amount, activity);
  }

  private emitState() {
    this.onStateChange?.(this.getState());
  }
}
