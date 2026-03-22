"use client";
import { useEffect, useMemo, useState } from "react";

type TypewriterOptions = {
  text: string;
  charsPerSecond?: number;
  isActive?: boolean;
};

export function useTypewriter({ text, charsPerSecond = 42, isActive = true }: TypewriterOptions) {
  const speed = useMemo(() => {
    if (charsPerSecond <= 0) return 0;
    return 1000 / charsPerSecond;
  }, [charsPerSecond]);

  const [revealed, setRevealed] = useState(isActive ? "" : text);

  useEffect(() => {
    if (!isActive || speed === 0) {
      setRevealed(text);
      return;
    }

    setRevealed("");
    if (!text) return;

    let i = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = () => {
      i += 1;
      setRevealed(text.slice(0, i));
      if (i < text.length) timer = setTimeout(tick, speed);
    };

    timer = setTimeout(tick, speed);
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [text, speed, isActive]);

  return revealed;
}