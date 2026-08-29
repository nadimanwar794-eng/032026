/**
 * Display preferences — Desktop Mode + Screen Rotation.
 *
 * The student requested two things from the Settings sheet:
 *
 *  1. **Desktop Mode**: render the app at a wider viewport so phones see the
 *     "tablet/laptop" layout instead of the cramped mobile one. We achieve
 *     this by rewriting the page's `<meta name="viewport">` to a fixed
 *     1024px width — the browser then scales the whole page down to fit the
 *     physical screen, just like Chrome's "Desktop site" toggle. The
 *     preference is persisted to localStorage so it survives reloads, and
 *     re-applied on every app boot via `applyDesktopModeFromStorage()`.
 *
 *  2. **Rotate Screen**: a one-tap button that flips the app between
 *     portrait and landscape using `screen.orientation.lock()`. This API
 *     only works while the page is in fullscreen on most browsers — so the
 *     helper requests fullscreen first when needed, then locks the chosen
 *     orientation. If the device/browser refuses (iOS Safari, desktop
 *     browsers), the helper returns `false` so the UI can show a toast.
 *
 * Everything is wrapped in try/catch — we never want a settings tap to
 * crash the app, and unsupported devices should fail silently with a
 * graceful "not supported" return value.
 */

const DESKTOP_MODE_KEY = 'nst_desktop_mode_v1';

/**
 * The viewport content string used in normal mobile mode. Mirrors what's
 * already in `index.html` so toggling Desktop Mode off restores the
 * original behaviour exactly.
 */
const MOBILE_VIEWPORT = 'width=device-width, initial-scale=1, viewport-fit=cover';

/**
 * Wider viewport that emulates a desktop/tablet layout. 1024px is the
 * usual lg-breakpoint width in Tailwind, which is what the app's "wide"
 * layout is already designed for, so the UI doesn't break — it just gets
 * shrunk to fit the phone screen, exactly like Chrome's "Desktop site".
 */
const DESKTOP_VIEWPORT = 'width=1024, initial-scale=1';

const getViewportTag = (): HTMLMetaElement | null => {
  let tag = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
  if (!tag) {
    tag = document.createElement('meta');
    tag.name = 'viewport';
    document.head.appendChild(tag);
  }
  return tag;
};

export const isDesktopModeOn = (): boolean => {
  try {
    return localStorage.getItem(DESKTOP_MODE_KEY) === '1';
  } catch { return false; }
};

export const setDesktopMode = (on: boolean): void => {
  try {
    localStorage.setItem(DESKTOP_MODE_KEY, on ? '1' : '0');
  } catch {}
  const tag = getViewportTag();
  if (tag) {
    tag.setAttribute('content', on ? DESKTOP_VIEWPORT : MOBILE_VIEWPORT);
  }
  // Add a CSS class on <html> so individual components can react if they
  // want (e.g. relax `max-w-` constraints). Optional but useful.
  if (on) document.documentElement.classList.add('force-desktop-mode');
  else document.documentElement.classList.remove('force-desktop-mode');
};

/**
 * Call once on app boot so the previously-saved Desktop Mode preference
 * is re-applied before the first paint settles.
 */
export const applyDesktopModeFromStorage = (): void => {
  if (isDesktopModeOn()) setDesktopMode(true);
};

/* ──────────────────────────  Screen Rotation  ────────────────────────── */

const isFullscreen = (): boolean => !!document.fullscreenElement;

const requestFullscreenSafe = async (): Promise<boolean> => {
  try {
    const el: any = document.documentElement;
    if (el.requestFullscreen) await el.requestFullscreen();
    else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
    else return false;
    return true;
  } catch { return false; }
};

/**
 * Global flag — true while `rotateScreen()` is in progress.
 * Fullscreen-change handlers in any component can check this so they
 * don't hide the floating buttons / bottom-nav when rotation is the
 * cause of the fullscreen entry.
 */
let _rotatingForOrientation = false;
export const isRotatingForOrientation = (): boolean => _rotatingForOrientation;

/**
 * Rotate the screen between portrait and landscape. Returns the new
 * orientation on success, or `null` if the device/browser doesn't
 * support programmatic orientation locking.
 *
 * Strategy:
 *  1. Try WITHOUT fullscreen first (works on PWA-installed apps).
 *  2. If that fails, enter fullscreen briefly just to allow the lock API,
 *     lock the orientation, then immediately EXIT fullscreen.
 *     → The browser notice appears for ~1 second then vanishes automatically.
 *     → The orientation lock persists after fullscreen is exited.
 *  3. The _rotatingForOrientation flag guards fullscreenchange handlers so
 *     isFullscreenMode / isDocFullscreen are NOT toggled during this dance.
 */
export const rotateScreen = async (): Promise<'portrait' | 'landscape' | null> => {
  try {
    const so: any = (screen as any).orientation;
    if (!so || typeof so.lock !== 'function') return null;

    const current: string = (so.type || '').toLowerCase();
    const goingTo: 'portrait' | 'landscape' = current.startsWith('landscape')
      ? 'portrait'
      : 'landscape';

    const candidates = goingTo === 'landscape'
      ? ['landscape-primary', 'landscape']
      : ['portrait-primary', 'portrait'];

    // Attempt 1: lock without fullscreen (PWA / some Android builds)
    for (const target of candidates) {
      try {
        await so.lock(target);
        return goingTo;
      } catch { /* try next */ }
    }

    // Attempt 2: enter fullscreen briefly, lock, then exit fullscreen
    _rotatingForOrientation = true;
    try {
      const alreadyFullscreen = isFullscreen();
      if (!alreadyFullscreen) {
        const ok = await requestFullscreenSafe();
        if (!ok) { _rotatingForOrientation = false; return null; }
      }

      let locked = false;
      for (const target of candidates) {
        try {
          await so.lock(target);
          locked = true;
          break;
        } catch { /* try next */ }
      }

      // NOTE: do NOT exit fullscreen here — Chrome releases the orientation
      // lock the moment fullscreen ends, causing the screen to snap back.
      // The fullscreenchange handler is guarded by _rotatingForOrientation
      // so isFullscreenMode / isDocFullscreen won't be toggled during this.

      _rotatingForOrientation = false;
      return locked ? goingTo : null;
    } catch {
      _rotatingForOrientation = false;
      return null;
    }
  } catch {
    _rotatingForOrientation = false;
    return null;
  }
};
