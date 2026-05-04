import { MessageSquarePlus } from "lucide-react";

import { FitButton, FitText } from "@/components/fit";

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
  mutedColor,
  onStartFresh
}: AiPageHeaderProps) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
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
      <div className="flex flex-wrap gap-2">
        <FitButton variant="ghost" icon={MessageSquarePlus} label="New Chat" onClick={onStartFresh} />
      </div>
    </div>
  );
}
