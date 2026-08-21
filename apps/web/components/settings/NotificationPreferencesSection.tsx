"use client";

import { useMemo } from "react";
import { Bell } from "lucide-react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  notificationPreferencesQueryOptions,
  updateNotificationPreferencesMutationOptions
} from "@fittrack/query";
import {
  NOTIFICATION_PREFERENCE_GROUPS,
  buildNotificationPreferenceGroupPatch,
  isNotificationPreferenceGroupEnabled
} from "@fittrack/types";

import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import FitSection from "@/components/fit/FitSection";
import { FitText } from "@/components/fit/FitText";
import { webApiClient } from "@/lib/api-client";

function PreferenceToggle({
  checked,
  disabled,
  label,
  onCheckedChange
}: {
  checked: boolean;
  disabled: boolean;
  label: string;
  onCheckedChange: (next: boolean) => void;
}) {
  const { colors } = useTheme();

  return (
    <SwitchPrimitive.Root
      checked={checked}
      disabled={disabled}
      onCheckedChange={onCheckedChange}
      aria-label={label}
      style={{
        width: 62,
        height: 34,
        borderRadius: 12,
        border: `1px solid ${checked ? colors.brand : colors.borderStrong}`,
        backgroundColor: checked ? colors.brand : colors.border,
        padding: 3,
        position: "relative",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1
      }}
    >
      <SwitchPrimitive.Thumb
        style={{
          display: "block",
          width: 26,
          height: 26,
          borderRadius: 8,
          backgroundColor: checked ? colors.base : colors.surface,
          boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
          position: "absolute",
          top: 3,
          left: checked ? 33 : 3,
          transition: "left 0.2s ease"
        }}
      />
    </SwitchPrimitive.Root>
  );
}

export default function NotificationPreferencesSection() {
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const { user } = useAuth();
  const userId = user?.id;
  const preferencesQuery = useQuery({
    ...notificationPreferencesQueryOptions(webApiClient, userId),
    enabled: Boolean(userId)
  });
  const updatePreferencesMutation = useMutation(
    updateNotificationPreferencesMutationOptions(webApiClient, queryClient, userId)
  );

  const helperLabel = useMemo(() => {
    if (preferencesQuery.isLoading) return "Loading preferences...";
    if (updatePreferencesMutation.isPending) return "Saving notification preferences...";
    return "Email delivery follows your saved preference groups.";
  }, [preferencesQuery.isLoading, updatePreferencesMutation.isPending]);

  return (
    <FitSection
      heading="Notification Preferences"
      headingStyle={{ fontSize: 13 }}
      action={<Bell size={13} color={colors.brand} />}
    >
      <div style={{ padding: 16, display: "grid", gap: 12 }}>
        <FitText as="p" style={{ fontSize: 13, color: colors.textMuted }}>
          {helperLabel}
        </FitText>
        {NOTIFICATION_PREFERENCE_GROUPS.map((group) => {
          const enabled = preferencesQuery.data
            ? isNotificationPreferenceGroupEnabled(preferencesQuery.data, group)
            : false;

          return (
            <div
              key={group.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "14px 0",
                borderTop: `1px solid ${colors.border}`
              }}
            >
              <div style={{ flex: 1 }}>
                <FitText style={{ fontSize: 15, fontWeight: 600 }}>
                  {group.label}
                </FitText>
                <FitText
                  as="p"
                  style={{ fontSize: 13, color: colors.textMuted, marginTop: 4 }}
                >
                  {group.description}
                </FitText>
              </div>
              <PreferenceToggle
                checked={enabled}
                disabled={
                  preferencesQuery.isLoading || updatePreferencesMutation.isPending
                }
                label={group.label}
                onCheckedChange={(next) => {
                  void updatePreferencesMutation.mutateAsync(
                    buildNotificationPreferenceGroupPatch(group.fields, next)
                  );
                }}
              />
            </div>
          );
        })}
      </div>
    </FitSection>
  );
}
