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
  const [runId, setRunId] = useState(0);
  const indexRef = useRef(0);
  const onDoneRef = useRef(onDone);
  const textRef = useRef(text);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speed = useMemo(() => {
    if (typeof intervalMs === "number") return intervalMs;
    if (charsPerSecond <= 0) return 0;
    return 1000 / charsPerSecond;
  }, [charsPerSecond, intervalMs]);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    textRef.current = text;
    indexRef.current = 0;
    setTyped(isActive && speed > 0 && text ? "" : text);
    if (isActive && speed > 0 && text) {
      setRunId((current) => current + 1);
      return;
    }
    if (!isActive || speed === 0 || !text) {
      onDoneRef.current?.();
    }
  }, [isActive, speed, text]);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!isActive || speed === 0 || !textRef.current) {
      return;
    }
    const tick = () => {
      const currentText = textRef.current;
      indexRef.current += 1;
      setTyped(currentText.slice(0, indexRef.current));
      if (indexRef.current >= currentText.length) {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }
        timerRef.current = null;
        onDoneRef.current?.();
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
  }, [isActive, runId, speed]);

  return { typed };
}
