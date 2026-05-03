"use client";
import { useEffect, useState } from "react";
import { useTheme } from "@/contexts/ThemeContext";

type Props = {
  onCommit: () => Promise<unknown>;
  onDone: (result: unknown) => void;
};

export default function BufferPage({ onCommit, onDone }: Props) {
  const { colors } = useTheme();
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const fadeIn = requestAnimationFrame(() => setOpacity(1));

    const run = async () => {
      const [commitResult] = await Promise.all([
        onCommit(),
        new Promise((resolve) => setTimeout(resolve, 260)),
      ]);

      if (!cancelled) {
        onDone(commitResult);
      }
    };

    void run();

    return () => {
      cancelled = true;
      cancelAnimationFrame(fadeIn);
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
        transition: "opacity 180ms ease",
      }}
    />
  );
}
