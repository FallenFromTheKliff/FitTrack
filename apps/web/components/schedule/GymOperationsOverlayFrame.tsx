"use client";

import type { ReactNode } from "react";

import { FitModal } from "@/components/modals";

export function OverlayFrame({
  children,
  isOpen,
  maxWidth = 820,
  onClose,
  subtitle = "Review or schedule coaching operations.",
  title = "Gym Operations",
}: {
  children: ReactNode;
  isOpen: boolean;
  maxWidth?: number;
  onClose: () => void;
  subtitle?: string;
  title?: string;
}) {
  return (
    <FitModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      maxWidth={maxWidth}
      overlayStyle={{
        alignItems: "center",
        padding: 24,
      }}
      containerStyle={{
        width: `min(${maxWidth}px, calc(100vw - 48px))`,
        maxWidth: "calc(100vw - 48px)",
        maxHeight: "calc(100vh - 48px)",
        borderRadius: 8,
      }}
      contentStyle={{
        maxHeight: "calc(100vh - 180px)",
        overflowY: "auto",
        padding: 20,
      }}
    >
      {children}
    </FitModal>
  );
}
