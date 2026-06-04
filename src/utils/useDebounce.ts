import { useState, useEffect, useRef, useCallback } from 'react';

export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function useDebouncedCallback<T extends (...args: any[]) => any>(
  fn: T,
  delay: number = 300
): T {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  return useCallback((...args: any[]) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => fn(...args), delay);
  }, [fn, delay]) as T;
}

export function useThrottle<T>(value: T, limit: number = 300): T {
  const [throttled, setThrottled] = useState<T>(value);
  const last = useRef<number>(0);
  useEffect(() => {
    const now = Date.now();
    if (now - last.current >= limit) {
      last.current = now;
      setThrottled(value);
    } else {
      const timer = setTimeout(() => {
        last.current = Date.now();
        setThrottled(value);
      }, limit - (now - last.current));
      return () => clearTimeout(timer);
    }
  }, [value, limit]);
  return throttled;
}
