import { useCallback, useEffect, useRef, useState } from 'react';

const showDelayMs = 300;
const minimumVisibleMs = 600;
const timeoutMs = 10_000;

/** Delays skeletons to avoid flicker, holds them briefly, and exposes a hard timeout. */
export function useSkeletonGate(loading: boolean) {
  const [visible, setVisible] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [cycle, setCycle] = useState(0);
  const shownAt = useRef(0);
  const visibleRef = useRef(false);

  useEffect(() => {
    let delayTimer: ReturnType<typeof setTimeout> | undefined;
    let timeoutTimer: ReturnType<typeof setTimeout> | undefined;
    let minimumTimer: ReturnType<typeof setTimeout> | undefined;

    if (loading) {
      setTimedOut(false);
      delayTimer = setTimeout(() => {
        shownAt.current = Date.now();
        visibleRef.current = true;
        setVisible(true);
      }, showDelayMs);
      timeoutTimer = setTimeout(() => setTimedOut(true), timeoutMs);
    } else {
      setTimedOut(false);
      const remaining = visibleRef.current
        ? Math.max(0, minimumVisibleMs - (Date.now() - shownAt.current))
        : 0;
      minimumTimer = setTimeout(() => {
        visibleRef.current = false;
        setVisible(false);
      }, remaining);
    }

    return () => {
      if (delayTimer) clearTimeout(delayTimer);
      if (timeoutTimer) clearTimeout(timeoutTimer);
      if (minimumTimer) clearTimeout(minimumTimer);
    };
  }, [loading, cycle]);

  const restart = useCallback(() => {
    visibleRef.current = false;
    shownAt.current = 0;
    setVisible(false);
    setTimedOut(false);
    setCycle((value) => value + 1);
  }, []);

  return { visible, timedOut, restart };
}
