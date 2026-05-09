"use client";

import { FitText } from "@/components/fit";

type AiPageHeaderProps = {
  dangerColor: string;
  lastError: string;
  message: string;
  mutedColor: string;
  onStartFresh: () => void;
};

export default function AiPageHeader({
  dangerColor,
  lastError,
  message,
  mutedColor
}: AiPageHeaderProps) {
  if (!lastError && !message) return null;

  return (
    <div className="mb-2 flex min-h-[22px] flex-wrap items-center gap-3">
      <div style={{ minHeight: 22 }}>
        {lastError ? (
          <FitText as="p" style={{ fontSize: 12, color: dangerColor, margin: 0 }}>
            {lastError}
          </FitText>
        ) : null}
        {message ? (
          <FitText as="p" style={{ fontSize: 12, color: mutedColor, margin: 0 }}>
            {message}
          </FitText>
        ) : null}
      </div>
    </div>
  );
}
