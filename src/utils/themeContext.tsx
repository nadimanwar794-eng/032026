import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { TIER_THEME } from './tierTheme';

export type TierThemeObj = typeof TIER_THEME[keyof typeof TIER_THEME] & {
  flashcardBg1?: string;
  flashcardBg2?: string;
  chapterAccent?: string;
  mcqTabActive?: string;
  navActive?: string;
  navBorderColor?: string;
  cardBorderColor?: string;
  textPrimary?: string;
  textSecondary?: string;
  progressColor?: string;
  accentGlowColor?: string;
  appBgColor?: string | null;
};

const DEFAULT_THEME: TierThemeObj = {
  ...TIER_THEME.free,
  flashcardBg1: '#0284c7',
  flashcardBg2: '#0ea5e9',
  chapterAccent: '#0ea5e9',
  mcqTabActive: '#0ea5e9',
};

export const ThemeContext = createContext<TierThemeObj>(DEFAULT_THEME);

export const useAppTheme = () => useContext(ThemeContext);

export const ThemeProvider: React.FC<{ theme: TierThemeObj; children: React.ReactNode }> = ({ theme, children }) => {
  const [flash, setFlash] = useState(false);
  const prevPrimary = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (prevPrimary.current !== null && prevPrimary.current !== theme.primary) {
      setFlash(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setFlash(false), 1000);
    }
    prevPrimary.current = theme.primary;
  }, [theme.primary]);

  return (
    <ThemeContext.Provider value={theme}>
      {children}
      {flash && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 99999,
            background: '#000',
            pointerEvents: 'none',
            animation: 'themeFlash 1s ease-in-out forwards',
          }}
        />
      )}
    </ThemeContext.Provider>
  );
};
