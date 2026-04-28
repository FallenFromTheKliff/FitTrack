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
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <FitText style={{ fontSize: 20, fontWeight: 700 }}>BrodigyAI</FitText>
        <FitText as="p" style={{ fontSize: 13, color: mutedColor, marginTop: 4 }}>
          Live AI chat now runs through the mounted Nest API and shared query layer.
        </FitText>
        {lastError ? (
          <FitText as="p" style={{ fontSize: 12, color: dangerColor, marginTop: 8 }}>
            {lastError}
          </FitText>
        ) : null}
        {message ? (
          <FitText as="p" style={{ fontSize: 12, color: mutedColor, marginTop: 8 }}>
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
