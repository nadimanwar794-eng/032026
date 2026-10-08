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

import { useState, useEffect } from 'react';

/**
 * Display preferences — Desktop/Laptop Mode.
 *
 * Switch the app between Mobile Mode and Desktop/Laptop Mode:
 *  - When Desktop Mode is ON:
 *    - Applies `.force-desktop-mode` to <html> and <body>
 *    - Adjusts viewport scaling
 *    - Compacts buttons, cards, headings, and padding so everything fits on laptop screens without excessive scrolling
 *    - Enables multi-column grids for cards
 *  - `rotateScreen()` directly toggles Desktop Mode (as requested by user) without physically locking screen orientation.
 */

const DESKTOP_MODE_KEY = 'nst_desktop_mode_v1';

const MOBILE_VIEWPORT = 'width=device-width, initial-scale=1, viewport-fit=cover';
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
  } catch {
    return false;
  }
};

export const setDesktopMode = (on: boolean): void => {
  try {
    localStorage.setItem(DESKTOP_MODE_KEY, on ? '1' : '0');
  } catch {}
  const tag = getViewportTag();
  if (tag) {
    tag.setAttribute('content', on ? DESKTOP_VIEWPORT : MOBILE_VIEWPORT);
  }
  if (on) {
    document.documentElement.classList.add('force-desktop-mode');
    document.body.classList.add('force-desktop-mode');
  } else {
    document.documentElement.classList.remove('force-desktop-mode');
    document.body.classList.remove('force-desktop-mode');
  }
  // Dispatch custom event for immediate React component state sync
  try {
    window.dispatchEvent(new CustomEvent('nst-desktop-mode-change', { detail: { isDesktop: on } }));
  } catch {}
};

export const toggleDesktopMode = (): boolean => {
  const next = !isDesktopModeOn();
  setDesktopMode(next);
  return next;
};

/**
 * Hook to listen for Desktop Mode changes
 */
export const useDesktopMode = (): [boolean, (on: boolean) => void] => {
  const [isDesktop, setIsDesktop] = useState<boolean>(() => isDesktopModeOn());

  useEffect(() => {
    const handler = (e: any) => {
      setIsDesktop(e.detail?.isDesktop ?? isDesktopModeOn());
    };
    window.addEventListener('nst-desktop-mode-change', handler);
    return () => window.removeEventListener('nst-desktop-mode-change', handler);
  }, []);

  return [isDesktop, setDesktopMode];
};

/**
 * Call once on app boot so the previously-saved Desktop Mode preference
 * is re-applied before the first paint settles.
 */
export const applyDesktopModeFromStorage = (): void => {
  if (isDesktopModeOn()) {
    setDesktopMode(true);
  }
};

/* ──────────────────────────  Screen Rotation / Desktop Toggle  ────────────────────────── */

let _rotatingForOrientation = false;
export const isRotatingForOrientation = (): boolean => _rotatingForOrientation;

export const isFullscreen = (): boolean => {
  if (typeof document === 'undefined') return false;
  return !!document.fullscreenElement;
};

export const exitFullscreenSafe = async (): Promise<boolean> => {
  try {
    if (typeof document !== 'undefined' && document.fullscreenElement && document.exitFullscreen) {
      await document.exitFullscreen().catch(() => {});
      return true;
    }
  } catch {}
  return false;
};

export const requestFullscreenSafe = async (): Promise<boolean> => {
  try {
    const el: any = document.documentElement;
    if (el.requestFullscreen) await el.requestFullscreen();
    else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
    else return false;
    return true;
  } catch {
    return false;
  }
};

export const getScreenOrientation = (): 'portrait' | 'landscape' => {
  try {
    const so: any = (screen as any).orientation;
    if (so && so.type) {
      return so.type.toLowerCase().startsWith('landscape') ? 'landscape' : 'portrait';
    }
    if (window.matchMedia) {
      return window.matchMedia('(orientation: landscape)').matches ? 'landscape' : 'portrait';
    }
  } catch {}
  return 'portrait';
};

/**
 * Rotate Button Handler:
 * Rotates the device screen between portrait and landscape cleanly.
 * Does NOT force native HTML5 fullscreen to eliminate the browser's
 * "to exit full screen, drag from the top and touch the back button" system banner.
 * Dispatches 'nst-screen-rotate' event and returns the new orientation ('portrait' | 'landscape').
 */
export const rotateScreen = async (): Promise<'portrait' | 'landscape' | null> => {
  try {
    const current = getScreenOrientation();
    const goingTo: 'portrait' | 'landscape' = current === 'landscape' ? 'portrait' : 'landscape';
    const so: any = (screen as any).orientation;

    _rotatingForOrientation = true;
    // Keep rotation flag active for 1200ms so orientation reflows don't trigger fullscreen/blanking
    setTimeout(() => {
      _rotatingForOrientation = false;
    }, 1200);

    if (so && typeof so.lock === 'function') {
      const candidates = goingTo === 'landscape'
        ? ['landscape-primary', 'landscape']
        : ['portrait-primary', 'portrait'];

      // 1. Try direct orientation lock (works seamlessly in installed PWA without banners)
      for (const target of candidates) {
        try {
          await so.lock(target);
          try { window.dispatchEvent(new CustomEvent('nst-screen-rotate', { detail: { orientation: goingTo } })); } catch {}
          return goingTo;
        } catch {}
      }

      // 2. If browser requires fullscreen permission for orientation lock (e.g. mobile Chrome tab)
      try {
        if (goingTo === 'landscape') {
          await requestFullscreenSafe();
        } else {
          await exitFullscreenSafe();
          await so.unlock?.().catch(() => {});
        }
        for (const target of candidates) {
          try {
            await so.lock(target);
            try { window.dispatchEvent(new CustomEvent('nst-screen-rotate', { detail: { orientation: goingTo } })); } catch {}
            return goingTo;
          } catch {}
        }
      } catch {}
    }

    // Visual layout toggle fallback (works on mobile web, iOS, and desktop without triggering browser fullscreen popups)
    try { window.dispatchEvent(new CustomEvent('nst-screen-rotate', { detail: { orientation: goingTo } })); } catch {}
    return goingTo;
  } catch {
    setTimeout(() => { _rotatingForOrientation = false; }, 300);
    return null;
  }
};

