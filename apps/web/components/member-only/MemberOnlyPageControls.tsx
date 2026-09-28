"use client";

import type { LucideIcon } from "lucide-react";

import { useMemberOnlyAccess } from "@/hooks/member-only/useMemberOnlyData";

import {
  ChipButton,
  MemberOnlyScreen,
  MemberSection,
  PremiumGate,
} from "./MemberOnlyPrimitives";

export function AccessGate({ featureName, icon }: { featureName: string; icon?: LucideIcon }) {
  const access = useMemberOnlyAccess(featureName);
  return (
    <MemberOnlyScreen>
      <MemberSection heading="Access">
        <PremiumGate
          actionHref="/profile"
          actionLabel="Open Membership Details"
          icon={icon}
          message={access.lockMessage}
          statusLabel={access.statusLabel}
          title={`${featureName} stays locked`}
        />
      </MemberSection>
    </MemberOnlyScreen>
  );
}

export function FilterChips<T extends string>({
  disabled,
  onChange,
  options,
  value,
}: {
  disabled?: boolean;
  onChange: (value: T) => void;
  options: ReadonlyArray<{ label: string; value: T }>;
  value: T;
}) {
  return (
    <div className="member-only-chip-row">
      {options.map((option) => (
        <ChipButton
          key={option.value}
          active={option.value === value}
          disabled={disabled}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </ChipButton>
      ))}
    </div>
  );
}
