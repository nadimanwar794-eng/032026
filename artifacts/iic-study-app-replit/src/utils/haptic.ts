/**
 * Haptic feedback utility using the Web Vibration API.
 * Silently no-ops on browsers/devices that don't support it.
 * Can be disabled globally via localStorage key `nst_haptic_enabled` = '0'.
 */
export const haptic = (pattern: number | number[]): void => {
  try {
    if (localStorage.getItem('nst_haptic_enabled') === '0') return;
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch {}
};

export const hapticLight  = () => haptic(15);
export const hapticMedium = () => haptic(35);
export const hapticStrong = () => haptic(60);

/** Correct answer — two short sharp taps (feels like ✅ confirmation) */
export const hapticCorrect = () => haptic([40, 60, 40]);

/** Wrong answer — one long heavy buzz (feels like ❌ warning) */
export const hapticWrong = () => haptic(120);
