import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useFocusEffect } from "expo-router";
import {
  ClipboardCheck,
  MessageSquareText,
  NotebookText,
  SlidersHorizontal,
  Star,
} from "lucide-react-native";
import { useQuery } from "@tanstack/react-query";
import type { AppointmentRecord } from "@fittrack/api-client";
import { appointmentsQueryOptions } from "@fittrack/query";
import type { ThemeColors } from "@fittrack/types";
import { R } from "@fittrack/ui/tokens";
import { formatGroupLabel, groupItemsByDate } from "@fittrack/utils";

import { useAuth } from "@/contexts/AuthContext";
import { useFABState } from "@/contexts/FABStateContext";
import { useTheme } from "@/contexts/ThemeContext";
import { usePassageAnim } from "@/hooks/animations/screen/usePassageAnim";
import { mobileApiClient } from "@/lib/api-client";
import { makeBookingsScreenStyles, makeScreenStyles } from "@/styles/shared/ScreenStyles";

import { FitFilter, FitPager, FitSearch, FitText } from "@/components/fit";

type AssessmentTimelineItem = {
  body: string;
  label: string;
  tone: "coach" | "member" | "report";
};

type AssessmentCardModel = {
  coachName: string;
  date: string;
  id: string;
  scheduledAt: string;
  status: string;
  timeline: AssessmentTimelineItem[];
};

type AssessmentFilter = "all" | "assessment" | "coach_reply" | "member_rating";

const FILTER_OPTIONS: Array<{ label: string; value: AssessmentFilter }> = [
  { label: "All", value: "all" },
  { label: "Coach assessments", value: "assessment" },
  { label: "Coach replies", value: "coach_reply" },
  { label: "My coach ratings", value: "member_rating" },
];
const ASSESSMENTS_PAGE_SIZE = 4;

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Schedule unavailable";

  return date.toLocaleDateString("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
  });
}

function formatStatus(value?: string) {
  return (value ?? "unknown")
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getCoachName(appointment: AppointmentRecord) {
  const coachName = appointment.coach?.displayName?.trim();
  return coachName && !coachName.includes("@") ? coachName : "Coach Session";
}

function buildTimeline(appointment: AppointmentRecord): AssessmentTimelineItem[] {
  const timeline: AssessmentTimelineItem[] = [];

  if (appointment.sessionNotes) {
    timeline.push({
      body: appointment.sessionNotes,
      label: "Session notes",
      tone: "report",
    });
  }

  if (appointment.assessmentReport) {
    timeline.push({
      body: appointment.assessmentReport,
      label: "Coach assessment",
      tone: "report",
    });
  }

  if (appointment.coachFeedback) {
    timeline.push({
      body: appointment.coachFeedback,
      label: "Coach to member",
      tone: "coach",
    });
  }

  if (appointment.review) {
    timeline.push({
      body: appointment.review.comment?.trim() || "Rating submitted without a written review.",
      label: `Member to coach / ${appointment.review.rating} star${appointment.review.rating === 1 ? "" : "s"}`,
      tone: "member",
    });
  }

  return timeline;
}

function buildAssessmentCards(appointments: AppointmentRecord[]) {
  return appointments
    .map<AssessmentCardModel>((appointment) => ({
      coachName: getCoachName(appointment),
      date: appointment.scheduledAt.slice(0, 10),
      id: appointment.id,
      scheduledAt: appointment.scheduledAt,
      status: formatStatus(appointment.status),
      timeline: buildTimeline(appointment),
    }))
    .filter((appointment) => appointment.timeline.length > 0)
    .sort(
      (left, right) =>
        new Date(right.scheduledAt).getTime() -
        new Date(left.scheduledAt).getTime(),
    );
}

export default function AssessmentsScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { registerFAB, setFabOpen, unregisterFAB } = useFABState();
  const { opacity, translateY } = usePassageAnim({ mode: "focus" });
  const base = useMemo(() => makeScreenStyles(colors), [colors]);
  const controls = useMemo(() => makeBookingsScreenStyles(colors), [colors]);
  const s = useMemo(() => makeStyles(colors), [colors]);
  const scrollY = useSharedValue(0);
  const isMember = user?.role === "USER";
  const [coachSearch, setCoachSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<AssessmentFilter>("all");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [assessmentPage, setAssessmentPage] = useState(1);

  const appointmentsQuery = useQuery({
    ...appointmentsQueryOptions<AppointmentRecord>(mobileApiClient, user?.id),
    enabled: Boolean(user?.id) && isMember,
    staleTime: 60_000,
    gcTime: 300_000,
  });

  const assessmentCards = useMemo(() => {
    const search = coachSearch.trim().toLowerCase();

    return buildAssessmentCards(appointmentsQuery.data ?? [])
      .map((card) => ({
        ...card,
        timeline:
          activeFilter === "all"
            ? card.timeline
            : card.timeline.filter((item) => {
                if (activeFilter === "assessment") return item.label === "Coach assessment";
                if (activeFilter === "coach_reply") return item.tone === "coach";
                return item.tone === "member";
              }),
      }))
      .filter((card) => card.timeline.length > 0)
      .filter((card) => !search || card.coachName.toLowerCase().includes(search));
  }, [activeFilter, appointmentsQuery.data, coachSearch]);
  const assessmentTotalPages = Math.max(
    1,
    Math.ceil(assessmentCards.length / ASSESSMENTS_PAGE_SIZE),
  );
  const safeAssessmentPage = Math.min(assessmentPage, assessmentTotalPages);
  const pagedAssessmentCards = useMemo(() => {
    const start = (safeAssessmentPage - 1) * ASSESSMENTS_PAGE_SIZE;
    return assessmentCards.slice(start, start + ASSESSMENTS_PAGE_SIZE);
  }, [assessmentCards, safeAssessmentPage]);
  const groupedAssessmentCards = useMemo(
    () => groupItemsByDate(pagedAssessmentCards, "desc"),
    [pagedAssessmentCards],
  );

  useEffect(() => {
    setAssessmentPage(1);
  }, [activeFilter, coachSearch]);

  useEffect(() => {
    setAssessmentPage((current) => Math.min(current, assessmentTotalPages));
  }, [assessmentTotalPages]);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  useFocusEffect(
    useCallback(() => {
      registerFAB({
        menuItems: [],
        screenIcon: ClipboardCheck,
        scrollY,
        visible: false,
      });

      return () => unregisterFAB();
    }, [registerFAB, scrollY, unregisterFAB]),
  );

  const screenStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const isLoading = appointmentsQuery.isLoading || appointmentsQuery.isFetching;
  const errorMessage = (appointmentsQuery.error as Error | null)?.message;

  return (
    <Animated.View style={[base.screen, { backgroundColor: colors.base }]}>
      <Animated.View style={[controls.searchAnimWrap, contentStyle]}>
        <View style={controls.searchWrap}>
          <View style={controls.searchRow}>
            <View style={controls.searchFieldWrap}>
              <FitSearch
                placeholder="Search coach name..."
                value={coachSearch}
                onChangeText={setCoachSearch}
              />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: isFilterOpen }}
              hitSlop={8}
              onPress={() => {
                setIsFilterOpen((open) => !open);
                setFabOpen(false);
              }}
              style={s.filterButtonHost}
            >
              <SlidersHorizontal
                size={20}
                color={isFilterOpen ? colors.brand : colors.textMuted}
                strokeWidth={2}
              />
            </Pressable>
          </View>
        </View>
        <FitFilter
          isOpen={isFilterOpen}
          chipOptions={FILTER_OPTIONS}
          activeChip={activeFilter}
          onChipChange={(value) => {
            setActiveFilter(value as AssessmentFilter);
            setIsFilterOpen(false);
          }}
        />
      </Animated.View>
      <Animated.ScrollView
        contentContainerStyle={base.scrollContent}
        onScroll={scrollHandler}
        onTouchStart={() => setFabOpen(false)}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        style={[base.content, screenStyle]}
      >
        <Animated.View style={contentStyle}>
          {isLoading ? (
            <View style={s.emptyState}>
              <ActivityIndicator color={colors.brand} />
              <FitText style={s.emptyTitle}>Loading assessments</FitText>
            </View>
          ) : errorMessage ? (
            <View style={s.emptyState}>
              <MessageSquareText size={28} color={colors.danger} strokeWidth={2} />
              <FitText style={s.emptyTitle}>Unable to load assessments</FitText>
              <FitText style={s.emptyHint}>{errorMessage}</FitText>
            </View>
          ) : assessmentCards.length === 0 ? (
            <View style={s.emptyState}>
              <NotebookText size={30} color={colors.textMuted} strokeWidth={2} />
              <FitText style={s.emptyTitle}>No assessments yet</FitText>
              <FitText style={s.emptyHint}>
                Completed coaching sessions with notes, reports, or ratings will appear here.
              </FitText>
            </View>
          ) : (
            <View style={s.cardStack}>
              {groupedAssessmentCards.map(([dateKey, assessments]) => (
                <View key={dateKey} style={s.dateGroup}>
                  <FitText style={s.groupLabel}>{formatGroupLabel(dateKey)}</FitText>
                  <View style={s.groupCards}>
                    {assessments.map((assessment) => (
                      <View key={assessment.id} style={s.assessmentCard}>
                        <View style={s.cardHeader}>
                          <View style={s.cardTitleGroup}>
                            <FitText style={s.cardTitle}>{assessment.coachName}</FitText>
                            <FitText style={s.cardSubtitle}>
                              {formatDateTime(assessment.scheduledAt)}
                            </FitText>
                          </View>
                          <View style={s.statusPill}>
                            <FitText style={s.statusText}>{assessment.status}</FitText>
                          </View>
                        </View>

                        <View style={s.timeline}>
                          {assessment.timeline.map((item, index) => (
                            <View
                              key={`${assessment.id}-${item.label}-${index}`}
                              style={[
                                s.timelineItem,
                                index < assessment.timeline.length - 1
                                  ? s.timelineDivider
                                  : undefined,
                              ]}
                            >
                              <View style={s.timelineIcon}>
                                {item.tone === "member" ? (
                                  <Star
                                    fill={colors.warning}
                                    size={15}
                                    color={colors.warning}
                                    strokeWidth={2}
                                  />
                                ) : item.tone === "coach" ? (
                                  <MessageSquareText size={16} color={colors.brand} strokeWidth={2} />
                                ) : (
                                  <NotebookText size={16} color={colors.success} strokeWidth={2} />
                                )}
                              </View>
                              <View style={s.timelineCopy}>
                                <FitText style={s.timelineLabel}>{item.label}</FitText>
                                <FitText style={s.timelineBody}>{item.body}</FitText>
                              </View>
                            </View>
                          ))}
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
              {assessmentTotalPages > 1 ? (
                <FitPager
                  currentPage={safeAssessmentPage}
                  onPageChange={setAssessmentPage}
                  totalPages={assessmentTotalPages}
                />
              ) : null}
            </View>
          )}
        </Animated.View>
      </Animated.ScrollView>
    </Animated.View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    assessmentCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: R.xl,
      borderWidth: 1,
      overflow: "hidden",
    },
    cardHeader: {
      alignItems: "flex-start",
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      flexDirection: "row",
      gap: 12,
      justifyContent: "space-between",
      padding: 16,
    },
    cardStack: { gap: 14 },
    cardSubtitle: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
    cardTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: "700" },
    cardTitleGroup: { flex: 1 },
    emptyHint: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 19,
      maxWidth: 280,
      textAlign: "center",
    },
    emptyState: {
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 24,
      paddingTop: 48,
    },
    emptyTitle: { color: colors.textSecondary, fontSize: 16, fontWeight: "700" },
    dateGroup: {
      gap: 8,
    },
    filterButtonHost: {
      paddingLeft: 10,
      paddingVertical: 6,
    },
    groupCards: {
      gap: 12,
    },
    groupLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 0.8,
      paddingHorizontal: 2,
    },
    statusPill: {
      backgroundColor: colors.brand + "1F",
      borderColor: colors.brand,
      borderRadius: R.md,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    statusText: { color: colors.brand, fontSize: 11, fontWeight: "800" },
    timeline: { paddingLeft: 16 },
    timelineBody: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
    timelineCopy: { flex: 1, gap: 3 },
    timelineDivider: { borderBottomColor: colors.border, borderBottomWidth: 1 },
    timelineIcon: {
      alignItems: "center",
      backgroundColor: colors.surfaceRaised,
      borderColor: colors.border,
      borderRadius: 14,
      borderWidth: 1,
      height: 28,
      justifyContent: "center",
      width: 28,
    },
    timelineItem: {
      flexDirection: "row",
      gap: 12,
      paddingBottom: 14,
      paddingRight: 16,
      paddingTop: 14,
    },
    timelineLabel: {
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: "800",
      letterSpacing: 0.2,
    },
  });
}
