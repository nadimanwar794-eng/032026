import { useState, useEffect, useRef } from 'react';

const DAILY_KEY = 'nst_daily_study_secs';
const DATE_KEY  = 'nst_daily_study_date';

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Tracks daily study time in seconds.
 * Resets automatically when the calendar date changes.
 * Persisted in localStorage so it survives page reloads.
 * Extracted from App.tsx.
 */
export function useDailyStudyTimer(): number {
  const [seconds, setSeconds] = useState<number>(() => {
    try {
      const date = localStorage.getItem(DATE_KEY);
      if (date !== todayISO()) return 0;
      return parseInt(localStorage.getItem(DAILY_KEY) ?? '0', 10) || 0;
    } catch { return 0; }
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setSeconds(s => {
        const today = todayISO();
        const storedDate = localStorage.getItem(DATE_KEY);
        const next = storedDate === today ? s + 1 : 0;
        try {
          localStorage.setItem(DAILY_KEY, String(next));
          localStorage.setItem(DATE_KEY, today);
        } catch {}
        return next;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  return seconds;
}
