import { useCallback, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import Animated, { useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useFocusEffect, useRouter } from "expo-router";
import { Bot, MessageSquarePlus, Trash2, X, SlidersHorizontal } from "lucide-react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useIsFocused } from "@react-navigation/native";
import { getAiContextLabel, getAiSessionDisplayTitle } from "@fittrack/app-config";
import { archiveAiChatSessionMutationOptions, aiChatSessionsQueryOptions } from "@fittrack/query";

import { useAuth } from "@/contexts/AuthContext";
import { type FABMenuItem, useFABState } from "@/contexts/FABStateContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useThemeTransitionAnim } from "@/hooks/animations/core/useThemeTransition";
import { usePassageAnim } from "@/hooks/animations/screen/usePassageAnim";
import { mobileApiClient } from "@/lib/api-client";
import { useDebounce, useTimedMessage } from "@fittrack/hooks";
import { formatGroupLabel, groupItemsByDate, nextDate, timeAgo } from "@fittrack/utils";
import { getTodayString } from "@/data/bookings";
import { makeScreenStyles, makeBookingsScreenStyles } from "@/styles/shared/ScreenStyles";

import { FitText } from "@/components/fit/FitText";
import FitCard from "@/components/fit/FitCard";
import FitSearch from "@/components/fit/FitSearch";
import FitButton from "@/components/fit/FitButton";
import FitFilter from "@/components/fit/FitFilter";
import PremiumFeatureGate from "@/components/membership/PremiumFeatureGate";
import ConfirmModal from "@/components/modals/shared/ConfirmModal";
import CalendarModal from "@/components/modals/shared/CalendarModal";

type HistoryItem = {
  contextLabel: string;
  date: string;
  id: string;
  lastActivityAt: string;
  title: string;
};

export default function ChatHistoryScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { colors } = useTheme();
  const isFocused = useIsFocused();
  const { registerFAB, unregisterFAB, isFabOpen, setFabOpen } = useFABState();
  const { ic } = useThemeTransitionAnim();
  const { opacity, translateY } = usePassageAnim({ mode: "focus" });
  const { message: statusMessage, showMessage } = useTimedMessage(2400);
  const base = useMemo(() => makeScreenStyles(colors), [colors]);
  const s = useMemo(() => makeBookingsScreenStyles(colors), [colors]);
  const membershipCardStatus = user?.membershipCard?.status ?? "none";
  const hasMemberCardAccess = user?.membershipAccess === "member";
  const isMemberLocked = !!user && !hasMemberCardAccess;
  const memberLockStatusLabel = membershipCardStatus === "pending_verification"
    ? "Pending verification"
    : membershipCardStatus === "revoked"
      ? "Revoked"
      : hasMemberCardAccess
        ? "Member"
        : "Non-member";
  const memberLockMessage = membershipCardStatus === "pending_verification"
    ? "Your membership card payment is waiting for verification. BrodigyAI history unlocks as soon as the card becomes active."
    : membershipCardStatus === "revoked"
      ? "Your membership card access is revoked right now. Ask the front desk to repair the account if this is unexpected."
      : "BrodigyAI history unlocks after this account has an active membership card.";

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 250);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isStartCalOpen, setIsStartCalOpen] = useState(false);
  const [isEndCalOpen, setIsEndCalOpen] = useState(false);
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const sessionsQuery = useQuery({
    ...aiChatSessionsQueryOptions(mobileApiClient, { limit: 100 }),
    enabled: isFocused && hasMemberCardAccess
  });
  const archiveMutation = useMutation(archiveAiChatSessionMutationOptions(mobileApiClient, queryClient));

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => { scrollY.value = event.contentOffset.y; }
  });

  const menuItems: FABMenuItem[] = useMemo(() => [
    {
      label: "New Chat",
      icon: MessageSquarePlus,
      iconColor: colors.brand,
      iconBg: colors.brand + "22",
      onPress: () => router.push({ pathname: "/(tabs)/chatbot", params: { sessionId: "new", from: "chathistory" } })
    },
    {
      label: "Delete Conversation",
      icon: Trash2,
      iconColor: colors.danger,
      iconBg: colors.surfaceRaised,
      onPress: () => {
        setDeleteMode(true);
        setSelectedIds(new Set());
        setFabOpen(false);
      }
    }
  ], [colors.brand, colors.danger, colors.surfaceRaised, router, setFabOpen]);

  useFocusEffect(useCallback(() => {
    registerFAB({ screenIcon: Bot, menuItems, scrollY, visible: !deleteMode && !isMemberLocked });
    return () => {
      setIsFilterOpen(false);
      unregisterFAB();
    };
  }, [deleteMode, isMemberLocked, menuItems, registerFAB, scrollY, unregisterFAB]));

  const handleStartDateSelect = (date: string) => {
    setStartDate(date);
    if (endDate && endDate <= date) setEndDate("");
    setIsStartCalOpen(false);
  };

  const handleEndDateSelect = (date: string) => {
    setEndDate(date);
    setIsEndCalOpen(false);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exitDeleteMode = useCallback(() => {
    setDeleteMode(false);
    setSelectedIds(new Set());
  }, []);

  const handleDeleteSelected = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    setIsDeleting(true);
    try {
      await Promise.all(ids.map((sessionId) => archiveMutation.mutateAsync({ sessionId })));
      showMessage(ids.length === 1 ? "Conversation archived." : "Conversations archived.");
      exitDeleteMode();
      setConfirmDeleteVisible(false);
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Unable to archive conversations.");
    } finally {
      setIsDeleting(false);
    }
  };

  const screenStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const contentStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const dividerStyle = useAnimatedStyle(() => ({ backgroundColor: ic.value.border }));

  const filteredSessions = useMemo(() => {
    const sourceSessions = (sessionsQuery.data?.data ?? []).map<HistoryItem>((session) => ({
      contextLabel: getAiContextLabel(session.context_type),
      date: session.last_activity_at.slice(0, 10),
      id: session.id,
      lastActivityAt: session.last_activity_at,
      title: getAiSessionDisplayTitle(session)
    }));

    let result = sourceSessions;
    if (debouncedSearchQuery.trim()) {
      const normalizedQuery = debouncedSearchQuery.toLowerCase();
      result = result.filter((session) =>
        session.title.toLowerCase().includes(normalizedQuery) ||
        session.contextLabel.toLowerCase().includes(normalizedQuery)
      );
    }
    if (startDate) result = result.filter((session) => session.date >= startDate);
    if (endDate) result = result.filter((session) => session.date <= endDate);
    return result;
  }, [debouncedSearchQuery, endDate, sessionsQuery.data, startDate]);

  const clearFilters = useCallback(() => {
    setSearchQuery("");
    setStartDate("");
    setEndDate("");
    setIsFilterOpen(false);
  }, []);

  const grouped = groupItemsByDate(filteredSessions, "desc");
  const isEmpty = filteredSessions.length === 0;
  const hasAnySessions = (sessionsQuery.data?.data ?? []).length > 0;
  const hasFiltersApplied = !!debouncedSearchQuery.trim() || !!startDate || !!endDate;
  const emptyTitle = hasFiltersApplied && hasAnySessions
    ? "No conversations match the current filters"
    : "No conversations yet";
  const emptyHint = hasFiltersApplied
    ? "Clear the search or date range to bring the rest of your AI history back into view."
    : "Start a new chat with BrodigyAI";
  const selectedCount = selectedIds.size;

  return (
    <View style={[base.screen, !isFocused && { display: "none" }]}>
      <Animated.View style={[s.searchAnimWrap, contentStyle]}>
        <View style={s.searchWrap}>
          <View style={s.searchRow}>
            <View style={s.searchFieldWrap}>
              <FitSearch
                placeholder="Search conversations..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                isFabOpen={isFabOpen}
              />
            </View>
            <Pressable
              onPress={() => { setIsFilterOpen((open) => !open); setFabOpen(false); }}
              style={s.filterBtn}
              hitSlop={8}
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
          showDateRange
          startDate={startDate}
          endDate={endDate}
          startDateLabel={startDate ? formatGroupLabel(startDate) : "All Dates"}
          endDateLabel={endDate ? formatGroupLabel(endDate) : "End Date"}
          onStartDatePress={() => setIsStartCalOpen(true)}
          onEndDatePress={() => setIsEndCalOpen(true)}
          onStartDateReset={() => setStartDate("")}
          onEndDateReset={() => setEndDate("")}
        />
      </Animated.View>
      <Animated.ScrollView
        style={[base.content, screenStyle]}
        contentContainerStyle={[base.scrollContent, { paddingBottom: deleteMode ? 120 : 40 }]}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        onTouchStart={() => { if (!deleteMode) setFabOpen(false); }}
        scrollEventThrottle={16}
      >
        <Animated.View style={contentStyle}>
          {statusMessage ? (
            <FitText style={{ fontSize: 12, color: colors.textMuted, marginBottom: 14 }}>
              {statusMessage}
            </FitText>
          ) : null}
          {isMemberLocked ? (
            <PremiumFeatureGate
              eyebrow="MEMBERSHIP CARD REQUIRED"
              statusLabel={memberLockStatusLabel}
              title={memberLockStatusLabel === "Pending verification"
                ? "Membership card verification in progress"
                : "BrodigyAI history stays locked"}
              message={memberLockMessage}
              actionLabel="Open Profile"
              onActionPress={() => router.push("/(tabs)/profile")}
            />
          ) : sessionsQuery.isPending ? (
            <View style={s.emptyState}>
              <Bot size={40} color={colors.textMuted} strokeWidth={1.5} />
              <FitText style={s.emptyTitle}>Loading conversations...</FitText>
              <FitText style={s.emptyHint}>Pulling your latest BrodigyAI sessions from the live stack.</FitText>
            </View>
          ) : sessionsQuery.isError ? (
            <View style={s.emptyState}>
              <Bot size={40} color={colors.danger} strokeWidth={1.5} />
              <FitText style={s.emptyTitle}>Conversation history is unavailable</FitText>
              <FitText style={s.emptyHint}>
                {(sessionsQuery.error as Error | null)?.message ?? "Unable to load conversation history right now."}
              </FitText>
              <FitButton
                label="Retry"
                variant="primary"
                onPress={() => {
                  void sessionsQuery.refetch();
                }}
                style={{ marginTop: 12, minWidth: 160 }}
              />
            </View>
          ) : isEmpty ? (
            <View style={s.emptyState}>
              <Bot size={40} color={colors.textMuted} strokeWidth={1.5} />
              <FitText style={s.emptyTitle}>{emptyTitle}</FitText>
              <FitText style={s.emptyHint}>{emptyHint}</FitText>
              {hasFiltersApplied ? (
                <FitButton
                  label="Clear Filters"
                  variant="ghost"
                  onPress={clearFilters}
                  style={{ marginTop: 12, minWidth: 160 }}
                />
              ) : null}
            </View>
          ) : (
            grouped.map(([dateKey, sessions]) => (
              <View key={dateKey} style={s.group}>
                <Animated.View style={[s.groupDivider, dividerStyle]} />
                <FitText style={s.groupLabel}>{formatGroupLabel(dateKey)}</FitText>
                <View style={s.groupCards}>
                  {sessions.map((session, index) => {
                    const isSelected = selectedIds.has(session.id);
                    return (
                      <View key={session.id} style={s.cardRow}>
                        {deleteMode ? (
                          <Pressable
                            style={[s.checkbox, isSelected && s.checkboxSelected]}
                            onPress={() => toggleSelect(session.id)}
                          >
                            {isSelected ? <X size={16} color={colors.surface} strokeWidth={2.5} /> : null}
                          </Pressable>
                        ) : null}
                        <View style={s.cardWrap}>
                          <FitCard
                            icon={Bot}
                            label={session.title}
                            subtitle={`${session.contextLabel} | Last active ${timeAgo(session.lastActivityAt)}`}
                            hasBorder={index < sessions.length - 1}
                            noChevron={deleteMode}
                            onPress={deleteMode
                              ? () => toggleSelect(session.id)
                              : () => router.push({ pathname: "/(tabs)/chatbot", params: { sessionId: session.id, from: "chathistory" } })
                            }
                          />
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            ))
          )}
        </Animated.View>
      </Animated.ScrollView>
      {deleteMode ? (
        <View style={s.selectionFooter}>
          <FitButton label="Cancel" variant="ghost" onPress={exitDeleteMode} flex={1} />
          <FitButton
            label={`Delete (${selectedCount})`}
            variant="danger"
            icon={Trash2}
            iconSize={18}
            disabled={selectedCount === 0}
            onPress={() => setConfirmDeleteVisible(true)}
            flex={2}
          />
        </View>
      ) : null}
      <ConfirmModal
        isVisible={confirmDeleteVisible}
        title="Delete Conversations?"
        message={`Delete ${selectedCount} conversation${selectedCount !== 1 ? "s" : ""}? This cannot be undone.`}
        yesLabel="Delete"
        noLabel="Keep"
        yesIcon={Trash2}
        isDestructive
        isLoading={isDeleting}
        loadingTitle="Removing conversations..."
        loadingLabel="Deleting"
        onNo={() => { if (!isDeleting) setConfirmDeleteVisible(false); }}
        onYes={handleDeleteSelected}
      />
      <CalendarModal
        isVisible={isStartCalOpen}
        selectedDate={startDate}
        defaultYear={new Date().getFullYear()}
        defaultMonth={new Date().getMonth() + 1}
        onSelect={handleStartDateSelect}
        onClose={() => setIsStartCalOpen(false)}
      />
      <CalendarModal
        isVisible={isEndCalOpen}
        selectedDate=""
        allowEmpty
        minDate={startDate ? nextDate(startDate) : nextDate(getTodayString())}
        defaultYear={new Date().getFullYear()}
        defaultMonth={new Date().getMonth() + 1}
        onSelect={handleEndDateSelect}
        onClose={() => setIsEndCalOpen(false)}
      />
    </View>
  );
}
