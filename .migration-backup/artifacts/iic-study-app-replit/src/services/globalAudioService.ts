/**
 * Global Persistent Audio Service
 * Enables continuous audio playback across the entire app (background playback).
 * Users can freely navigate anywhere in the app without interrupting audio.
 */

export interface GlobalAudioTrack {
  url: string;
  title: string;
  subtitle?: string;
  mediaId?: string;
  duration?: number;
  appLogo?: string;
}

export interface GlobalAudioState {
  track: GlobalAudioTrack | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  isMuted: boolean;
  volume: number;
  error: string | null;
}

type AudioListener = (state: GlobalAudioState) => void;

class GlobalAudioManager {
  private audioElement: HTMLAudioElement | null = null;
  private currentTrack: GlobalAudioTrack | null = null;
  private isPlaying = false;
  private currentTime = 0;
  private duration = 0;
  private playbackRate = 1.0;
  private isMuted = false;
  private volume = 1.0;
  private error: string | null = null;
  private listeners: Set<AudioListener> = new Set();
  private isInitialized = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initAudio();
    }
  }

  private initAudio() {
    if (this.isInitialized || typeof window === 'undefined') return;
    try {
      this.audioElement = new Audio();
      this.audioElement.preload = 'metadata';
      this.audioElement.playbackRate = this.playbackRate;

      this.audioElement.addEventListener('play', () => {
        this.isPlaying = true;
        this.error = null;
        this.notify();
      });

      this.audioElement.addEventListener('pause', () => {
        this.isPlaying = false;
        this.notify();
      });

      this.audioElement.addEventListener('ended', () => {
        this.isPlaying = false;
        this.currentTime = 0;
        this.notify();
      });

      this.audioElement.addEventListener('timeupdate', () => {
        if (this.audioElement) {
          this.currentTime = this.audioElement.currentTime;
          if (this.audioElement.duration && !isNaN(this.audioElement.duration)) {
            this.duration = this.audioElement.duration;
          }
          this.notify();
        }
      });

      this.audioElement.addEventListener('loadedmetadata', () => {
        if (this.audioElement && this.audioElement.duration && !isNaN(this.audioElement.duration)) {
          this.duration = this.audioElement.duration;
        }
        this.notify();
      });

      this.audioElement.addEventListener('error', (e) => {
        console.warn('[GlobalAudioService] Audio error:', e);
        this.error = 'Audio load karne me samasya aayi';
        this.isPlaying = false;
        this.notify();
      });

      this.isInitialized = true;
    } catch (e) {
      console.warn('[GlobalAudioService] Initialization error:', e);
    }
  }

  public subscribe(listener: AudioListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const state = this.getState();
    this.listeners.forEach((fn) => {
      try {
        fn(state);
      } catch (e) {
        console.error('[GlobalAudioService] listener error', e);
      }
    });

    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(
          new CustomEvent('nsta-global-audio-change', { detail: state })
        );
      } catch {}
    }
  }

  public getState(): GlobalAudioState {
    return {
      track: this.currentTrack,
      isPlaying: this.isPlaying,
      currentTime: this.currentTime,
      duration: this.duration,
      playbackRate: this.playbackRate,
      isMuted: this.isMuted,
      volume: this.volume,
      error: this.error,
    };
  }

  public async playTrack(track: GlobalAudioTrack, autoPlay = true): Promise<void> {
    this.initAudio();
    if (!this.audioElement) return;

    const isSameTrack = this.currentTrack?.url === track.url;
    this.currentTrack = track;
    this.error = null;

    if (!isSameTrack) {
      this.audioElement.src = track.url;
      this.currentTime = 0;
      this.duration = track.duration || 0;
    }

    this.audioElement.playbackRate = this.playbackRate;

    if (autoPlay) {
      try {
        await this.audioElement.play();
        this.isPlaying = true;
      } catch (err) {
        console.warn('[GlobalAudioService] Autoplay error:', err);
        this.isPlaying = false;
      }
    }
    this.notify();
  }

  public async togglePlay(): Promise<void> {
    if (!this.audioElement || !this.currentTrack) return;
    if (this.isPlaying) {
      this.pause();
    } else {
      await this.resume();
    }
  }

  public pause(): void {
    if (this.audioElement && this.isPlaying) {
      this.audioElement.pause();
      this.isPlaying = false;
      this.notify();
    }
  }

  public async resume(): Promise<void> {
    if (this.audioElement && this.currentTrack) {
      try {
        await this.audioElement.play();
        this.isPlaying = true;
        this.notify();
      } catch (err) {
        console.warn('[GlobalAudioService] Resume error:', err);
      }
    }
  }

  public seek(seconds: number): void {
    if (this.audioElement) {
      const clamped = Math.max(0, Math.min(seconds, this.duration || 999999));
      this.audioElement.currentTime = clamped;
      this.currentTime = clamped;
      this.notify();
    }
  }

  public skip(deltaSeconds: number): void {
    if (this.audioElement) {
      const nextTime = Math.max(0, Math.min(this.currentTime + deltaSeconds, this.duration || 999999));
      this.seek(nextTime);
    }
  }

  public setPlaybackRate(rate: number): void {
    this.playbackRate = rate;
    if (this.audioElement) {
      this.audioElement.playbackRate = rate;
    }
    this.notify();
  }

  public toggleMute(): void {
    this.isMuted = !this.isMuted;
    if (this.audioElement) {
      this.audioElement.muted = this.isMuted;
    }
    this.notify();
  }

  public close(): void {
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.src = '';
    }
    this.currentTrack = null;
    this.isPlaying = false;
    this.currentTime = 0;
    this.duration = 0;
    this.notify();
  }
}

export const globalAudioService = new GlobalAudioManager();
