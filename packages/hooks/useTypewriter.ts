import { useEffect, useMemo, useRef, useState } from "react";

type UseTypewriterOptions = {
  text: string;
  isActive?: boolean;
  charsPerSecond?: number;
  intervalMs?: number;
  onDone?: () => void;
};

export function useTypewriter({
  text,
  isActive = true,
  charsPerSecond = 40,
  intervalMs,
  onDone
}: UseTypewriterOptions): { typed: string } {
  const [typed, setTyped] = useState(isActive ? "" : text);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speed = useMemo(() => {
    if (typeof intervalMs === "number") return intervalMs;
    if (charsPerSecond <= 0) return 0;
    return 1000 / charsPerSecond;
  }, [charsPerSecond, intervalMs]);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!isActive || speed === 0) {
      setTyped(text);
      onDone?.();
      return;
    }
    if (!text) {
      setTyped("");
      onDone?.();
      return;
    }
    let index = 0;
    setTyped("");
    const tick = () => {
      index += 1;
      setTyped(text.slice(0, index));
      if (index >= text.length) {
        timerRef.current = null;
        onDone?.();
        return;
      }
      timerRef.current = setTimeout(tick, speed);
    };
    timerRef.current = setTimeout(tick, speed);
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isActive, onDone, speed, text]);

  return { typed };
}
