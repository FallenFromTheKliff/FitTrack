import { useMemo } from "react";
import { View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Animated from "react-native-reanimated";
import {
  markAllNotificationsReadMutationOptions,
  notificationInboxQueryOptions,
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
import { useThemeTransition } from "@/hooks/animations/core/useThemeTransition";
import { makePrefModalStyles } from "@/styles/modals/PrefStyles";
import { mobileApiClient } from "@/lib/api-client";
import { FitSquareToggle } from "@/components/fit/FitSquareToggle";
import { AnimatedFitText, FitText } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";

export default function NotificationsPreferencesPanel({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { colors, settings } = useTheme();
  const { surfaceStyle, textMutedStyle } = useThemeTransition();
  const s = useMemo(() => makePrefModalStyles(colors), [colors]);
  const userId = user?.id;

  const preferencesQuery = useQuery({
    ...notificationPreferencesQueryOptions(mobileApiClient, userId),
    enabled: Boolean(userId)
  });
  const inboxQuery = useQuery({
    ...notificationInboxQueryOptions(mobileApiClient, userId, { limit: 5, page: 1 }),
    enabled: Boolean(userId)
  });
  const updatePreferencesMutation = useMutation(
    updateNotificationPreferencesMutationOptions(mobileApiClient, queryClient, userId)
  );
  const markAllReadMutation = useMutation(
    markAllNotificationsReadMutationOptions(mobileApiClient, queryClient, userId)
  );

  return (
    <Animated.View style={[s.body, surfaceStyle]}>
      <AnimatedFitText style={[s.sectionLabel, textMutedStyle]}>ALERTS</AnimatedFitText>
      <View style={s.infoCard}>
        {NOTIFICATION_PREFERENCE_GROUPS.map((group, index) => {
          const enabled = preferencesQuery.data
            ? isNotificationPreferenceGroupEnabled(preferencesQuery.data, group)
            : false;

          return (
            <View key={group.id}>
              <View style={s.toggleRow}>
                <View style={s.toggleInfo}>
                  <FitText style={s.toggleLabel}>{group.label}</FitText>
                  <FitText style={s.toggleHint}>{group.description}</FitText>
                </View>
                <FitSquareToggle
                  value={enabled}
                  onValueChange={(next) => {
                    void updatePreferencesMutation.mutateAsync(
                      buildNotificationPreferenceGroupPatch(group.fields, next)
                    );
                  }}
                  activeColor={colors.brand}
                  inactiveColor={colors.border}
                  useAnimations={settings.animationLevel === "full"}
                />
              </View>
              {index < NOTIFICATION_PREFERENCE_GROUPS.length - 1 ? (
                <View style={s.infoCardDivider} />
              ) : null}
            </View>
          );
        })}
      </View>

      <View>
        <AnimatedFitText style={[s.sectionLabel, textMutedStyle]}>
          RECENT DELIVERY HISTORY
        </AnimatedFitText>
        <View style={s.infoCard}>
          {(inboxQuery.data?.data ?? []).length === 0 ? (
            <FitText style={s.infoCardHint}>No notifications yet. You are all caught up.</FitText>
          ) : (
            (inboxQuery.data?.data ?? []).map((item, index, items) => (
              <View key={item.id}>
                <FitText style={s.infoCardTitle}>{item.title}</FitText>
                <FitText style={s.infoCardHint}>{item.body}</FitText>
                <FitText style={[s.toggleHint, { marginTop: 4 }]}>
                  {new Date(item.createdAt).toLocaleString()}
                </FitText>
                {index < items.length - 1 ? <View style={s.infoCardDivider} /> : null}
              </View>
            ))
          )}
        </View>
      </View>

      <View style={s.footer}>
        <FitButton
          label="Mark all read"
          variant="ghost"
          onPress={() => void markAllReadMutation.mutateAsync()}
          disabled={markAllReadMutation.isPending}
          flex={1}
        />
        <FitButton label="Close" variant="primary" onPress={onClose} flex={1} />
      </View>
    </Animated.View>
  );
}
