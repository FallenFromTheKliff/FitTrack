import { useState, useEffect, useRef } from "react";

const DOT_FRAMES = ["", ".", ". .", ". . ."] as const;

export function useLoadingText(baseText: string, isLoading: boolean): string {
  const [dotCount, setDotCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (isLoading) {
      setDotCount(0);
      intervalRef.current = setInterval(() => {
        setDotCount((prev) => (prev + 1) % 4);
      }, 300);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setDotCount(0);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isLoading]);
  return isLoading
    ? `${baseText}${DOT_FRAMES[dotCount] ? ` ${DOT_FRAMES[dotCount]}` : ""}`
    : baseText;
}