import { useMemo } from "react";
import { ActivityIndicator, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Animated from "react-native-reanimated";
import {
  markAllNotificationsReadMutationOptions,
  notificationInboxQueryOptions,
} from "@fittrack/query";

import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useThemeTransition } from "@/hooks/animations/core/useThemeTransition";
import { makePrefModalStyles } from "@/styles/modals/PrefStyles";
import { mobileApiClient } from "@/lib/api-client";
import { AnimatedFitText, FitText } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";
import FitModalScrollView from "@/components/modals/shared/FitModalScrollView";

type NotificationInboxPanelProps = {
  onClose: () => void;
};

function formatNotificationDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function NotificationInboxPanel({
  onClose,
}: NotificationInboxPanelProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { colors } = useTheme();
  const { surfaceStyle, textMutedStyle } = useThemeTransition();
  const s = useMemo(() => makePrefModalStyles(colors), [colors]);
  const userId = user?.id;

  const inboxQuery = useQuery({
    ...notificationInboxQueryOptions(mobileApiClient, userId, {
      limit: 10,
      page: 1,
    }),
    enabled: Boolean(userId),
  });
  const markAllReadMutation = useMutation(
    markAllNotificationsReadMutationOptions(mobileApiClient, queryClient, userId),
  );
  const notifications = inboxQuery.data?.data ?? [];
  const unreadCount = notifications.filter((item) => !item.readAt).length;

  return (
    <Animated.View style={[s.body, surfaceStyle]}>
      <View>
        <AnimatedFitText style={[s.sectionLabel, textMutedStyle]}>
          RECENT NOTIFICATIONS
        </AnimatedFitText>
        <View style={s.infoCard}>
          {inboxQuery.isLoading ? (
            <View style={{ alignItems: "center", minHeight: 96, justifyContent: "center" }}>
              <ActivityIndicator color={colors.brand} />
            </View>
          ) : notifications.length > 0 ? (
            <FitModalScrollView
              fill={false}
              style={{ maxHeight: 320 }}
              contentContainerStyle={{ gap: 10 }}
            >
              {notifications.map((notification, index) => (
                <View key={notification.id}>
                  <View style={{ gap: 4 }}>
                    <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                      {!notification.readAt ? (
                        <View
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: colors.brand,
                          }}
                        />
                      ) : null}
                      <FitText style={s.infoCardTitle}>
                        {notification.title}
                      </FitText>
                    </View>
                    <FitText style={s.infoCardHint}>{notification.body}</FitText>
                    <FitText style={[s.toggleHint, { marginTop: 2 }]}>
                      {formatNotificationDate(notification.sentAt ?? notification.createdAt)}
                    </FitText>
                  </View>
                  {index < notifications.length - 1 ? (
                    <View style={[s.infoCardDivider, { marginTop: 10 }]} />
                  ) : null}
                </View>
              ))}
            </FitModalScrollView>
          ) : (
            <FitText style={s.infoCardHint}>
              No notifications yet. New booking, payment, and system updates will appear here.
            </FitText>
          )}
        </View>
      </View>

      <View style={s.footer}>
        <FitButton
          label={markAllReadMutation.isPending ? "Marking..." : "Mark All Read"}
          variant="ghost"
          onPress={() => markAllReadMutation.mutate()}
          disabled={unreadCount === 0 || markAllReadMutation.isPending}
          flex={1}
        />
        <FitButton label="Close" variant="primary" onPress={onClose} flex={1} />
      </View>
    </Animated.View>
  );
}
