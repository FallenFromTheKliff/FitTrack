import { useCallback, useEffect, useRef, useState } from "react";

const DOT_FRAMES = ["", ".", ". .", ". . ."] as const;

export function useTimedMessage(duration = 2000) {
  const [message, setMessage] = useState("");
  const [baseMessage, setBaseMessage] = useState("");
  const [animateDots, setAnimateDots] = useState(false);
  const [dotCount, setDotCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const showMessage = useCallback((text: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const normalized = text.trim();
    const shouldAnimate = /(?:\.{3}|\.\s+\.\s*\.?)$/.test(normalized);
    const nextBaseMessage = shouldAnimate
      ? normalized.replace(/(?:\.\s*){1,3}$/, "").trimEnd()
      : normalized;

    setAnimateDots(shouldAnimate);
    setBaseMessage(nextBaseMessage);
    setDotCount(0);
    setMessage(shouldAnimate ? nextBaseMessage : normalized);
    timerRef.current = setTimeout(() => setMessage(""), duration);
  }, [duration]);
  const clearMessage = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    setAnimateDots(false);
    setBaseMessage("");
    setDotCount(0);
    setMessage("");
  }, []);

  useEffect(() => {
    if (!message || !animateDots) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (!animateDots && message) {
        const nextMessage = baseMessage || message;
        setMessage((current) => (current === nextMessage ? current : nextMessage));
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setDotCount((prev) => (prev + 1) % DOT_FRAMES.length);
    }, 300);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [animateDots, baseMessage, message]);

  useEffect(() => {
    if (!animateDots || !message) return;
    const nextMessage = `${baseMessage}${DOT_FRAMES[dotCount] ? ` ${DOT_FRAMES[dotCount]}` : ""}`;
    setMessage((current) => (current === nextMessage ? current : nextMessage));
  }, [animateDots, baseMessage, dotCount, message]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);
  return { message, showMessage, clearMessage };
}
