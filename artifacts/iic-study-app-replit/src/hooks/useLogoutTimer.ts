import { useState, useEffect, useRef } from 'react';

/**
 * Manages the countdown logout timer shown to the user when they tap Sign Out.
 * Extracted from App.tsx.
 *
 * Usage:
 *   const { logoutPending, logoutTimeLeft, startLogout, cancelLogout } = useLogoutTimer(10, onLogoutComplete);
 */
export function useLogoutTimer(
  durationSeconds: number,
  onComplete: () => void
) {
  const [logoutPending, setLogoutPending]   = useState(false);
  const [logoutTimeLeft, setLogoutTimeLeft] = useState(durationSeconds);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!logoutPending) return;
    setLogoutTimeLeft(durationSeconds);
    timerRef.current = setInterval(() => {
      setLogoutTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          onComplete();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [logoutPending]);

  const startLogout  = () => setLogoutPending(true);
  const cancelLogout = () => {
    setLogoutPending(false);
    setLogoutTimeLeft(durationSeconds);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  return { logoutPending, logoutTimeLeft, startLogout, cancelLogout };
}
