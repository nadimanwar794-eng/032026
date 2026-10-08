// Centralized, disciplined voice controller for Pedro

let isVoiceMuted = typeof window !== 'undefined' ? localStorage.getItem('nst_pedro_muted') === 'true' : false;

export const setPedroVoiceMuted = (muted: boolean) => {
  isVoiceMuted = muted;
  if (typeof window !== 'undefined') {
    localStorage.setItem('nst_pedro_muted', String(muted));
    window.dispatchEvent(new CustomEvent('nst-pedro-muted-change', { detail: { isMuted: muted } }));
  }
  if (muted && typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {}
  }
};

export const getPedroVoiceMuted = (): boolean => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('nst_pedro_muted') === 'true';
  }
  return isVoiceMuted;
};

export interface PedroSpeakOptions {
  isAutomated?: boolean;
  rate?: number;
  pitch?: number;
  onEnd?: () => void;
  showBubble?: boolean;
}

/**
 * Main disciplined Pedro speech function.
 * If isAutomated is true, speech is blocked (silent) to protect student focus.
 */
export const pedroSpeak = (
  text: string,
  options?: PedroSpeakOptions | boolean
): boolean => {
  const opts: PedroSpeakOptions = typeof options === 'boolean' ? { isAutomated: options } : (options || {});

  // 1. Block automated speech (e.g., page turns, opening routine, idle sleep)
  if (opts.isAutomated) {
    // Keep visual bubble optionally or log, but 0% audio into student's ears
    if (opts.showBubble && typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('nst_pedro_speech_bubble', {
          detail: { text }
        })
      );
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('nst_pedro_speaking_end'));
      }, 3500);
    }
    return false;
  }

  // 2. Check if user has muted Pedro voice or unsupported browser
  if (getPedroVoiceMuted() || typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return false;
  }

  try {
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/<[^>]*>/g, '').trim();
    if (!cleanText) return false;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'hi-IN';
    utterance.rate = opts.rate ?? 1.08; // Crisp and brisk
    utterance.pitch = opts.pitch ?? 1.15; // Friendly robot assistant tone

    // Show visual speech bubble on floating mascot
    if (opts.showBubble !== false) {
      window.dispatchEvent(
        new CustomEvent('nst_pedro_speech_bubble', {
          detail: { text: cleanText }
        })
      );
    }

    utterance.onend = () => {
      window.dispatchEvent(new CustomEvent('nst_pedro_speaking_end'));
      if (opts.onEnd) opts.onEnd();
    };

    utterance.onerror = () => {
      window.dispatchEvent(new CustomEvent('nst_pedro_speaking_end'));
      if (opts.onEnd) opts.onEnd();
    };

    window.speechSynthesis.speak(utterance);
    return true;
  } catch (err) {
    console.warn('[PedroVoiceManager] Speech error:', err);
    if (opts.onEnd) opts.onEnd();
    return false;
  }
};

export const stopPedroVoice = () => {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
      window.dispatchEvent(new CustomEvent('nst_pedro_speaking_end'));
    } catch {}
  }
};

/**
 * Soft subtle chime sound effect for dismiss / double-tap
 */
export const playSoftChime = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
    osc.start();
    osc.stop(ctx.currentTime + 0.23);
  } catch {}
};
