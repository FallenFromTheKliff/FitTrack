"use client";
import { useEffect, useState } from "react";
import { useTheme } from "@/contexts/ThemeContext";

type Props = {
  onCommit: () => Promise<void>;
  onDone: () => void;
};

export default function BufferPage({ onCommit, onDone }: Props) {
  const { colors } = useTheme();
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    const fadeIn = requestAnimationFrame(() => setOpacity(1));
    const commitTimer = setTimeout(async () => {
      await onCommit();
    }, 400);
    const doneTimer = setTimeout(() => {
      onDone();
    }, 900);
    return () => {
      cancelAnimationFrame(fadeIn);
      clearTimeout(commitTimer);
      clearTimeout(doneTimer);
    };
  }, [onCommit, onDone]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: colors.base,
        zIndex: 9999,
        opacity,
        transition: "opacity 180ms ease"
      }}
    />
  );
}