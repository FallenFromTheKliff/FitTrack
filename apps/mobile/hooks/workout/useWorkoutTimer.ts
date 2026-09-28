import { useCallback, useRef, useState } from "react";

export function useWorkoutTimer() {
  const secondsRef = useRef(0);
  const [, setTick] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    secondsRef.current = 0;
    intervalRef.current = setInterval(() => {
      secondsRef.current += 1;
      setTick((v) => v + 1);
    }, 1000);
  }, []);

  const resume = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    intervalRef.current = setInterval(() => {
      secondsRef.current += 1;
      setTick((v) => v + 1);
    }, 1000);
  }, []);

  const pause = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    pause();
    secondsRef.current = 0;
    setTick(0);
  }, [pause]);

  const stop = useCallback(() => {
    pause();
  }, [pause]);

  const cleanup = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  return {
    secondsRef,
    start,
    resume,
    pause,
    stop,
    reset,
    cleanup
  };
}