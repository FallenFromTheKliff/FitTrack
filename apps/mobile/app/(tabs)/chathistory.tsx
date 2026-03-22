import { useCallback, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import Animated, { useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useFocusEffect, useRouter } from "expo-router";
import { Bot, MessageSquarePlus, Trash2, X, SlidersHorizontal } from "lucide-react-native";

import { MOCK_SESSIONS } from "@/data/chat";
import { type FABMenuItem, useFABState } from "@/contexts/FABStateContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useThemeTransitionAnim } from "@/hooks/animations/core/useThemeTransition";
import { usePassageAnim } from "@/hooks/animations/screen/usePassageAnim";
import { useDebounce } from "@fittrack/hooks";
import { getTodayString } from "@/data/bookings";
import { formatGroupLabel, nextDate } from "@/utils/date";
import { groupByDate } from "@/utils/grouping";
import { makeScreenStyles, makeBookingsScreenStyles } from "@/styles/shared/ScreenStyles";

import { FitText } from "@/components/fit/FitText";
import FitCard from "@/components/fit/FitCard";
import FitSearch from "@/components/fit/FitSearch";
import FitButton from "@/components/fit/FitButton";
import FitFilter from "@/components/fit/FitFilter";
import ConfirmModal from "@/components/modals/shared/ConfirmModal";
import CalendarModal from "@/components/modals/shared/CalendarModal";

export default function ChatHistoryScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { registerFAB, unregisterFAB, isFabOpen, setFabOpen } = useFABState();
  const { ic } = useThemeTransitionAnim();
  const { opacity, translateY } = usePassageAnim({ mode: "focus" });
  const base = useMemo(() => makeScreenStyles(colors), [colors]);
  const s = useMemo(() => makeBookingsScreenStyles(colors), [colors]);

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
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => { scrollY.value = e.contentOffset.y; }
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
    registerFAB({ screenIcon: Bot, menuItems, scrollY, visible: !deleteMode });
    return () => {
      setIsFilterOpen(false);
      unregisterFAB();
    };
  }, [deleteMode, menuItems, registerFAB, scrollY, unregisterFAB]));

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
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const exitDeleteMode = useCallback(() => {
    setDeleteMode(false);
    setSelectedIds(new Set());
  }, []);

  const handleDeleteSelected = async () => {
    setIsDeleting(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setDeletedIds((prev) => {
      const next = new Set(prev);
      selectedIds.forEach((id) => next.add(id));
      return next;
    });
    setIsDeleting(false);
    exitDeleteMode();
    setConfirmDeleteVisible(false);
  };

  const screenStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const contentStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const dividerStyle = useAnimatedStyle(() => ({ backgroundColor: ic.value.border }));

  const filteredSessions = useMemo(() => {
    let result = MOCK_SESSIONS.filter((session) => !deletedIds.has(session.id));
    if (debouncedSearchQuery.trim()) {
      const q = debouncedSearchQuery.toLowerCase();
      result = result.filter((session) =>
        session.title.toLowerCase().includes(q) || session.preview.toLowerCase().includes(q)
      );
    }
    if (startDate) result = result.filter((session) => session.date >= startDate);
    if (endDate) result = result.filter((session) => session.date <= endDate);
    return result;
  }, [debouncedSearchQuery, startDate, endDate, deletedIds]);

  const grouped = groupByDate(filteredSessions, "desc");
  const isEmpty = filteredSessions.length === 0;
  const selectedCount = selectedIds.size;

  return (
    <View style={base.screen}>
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
          {isEmpty ? (
            <View style={s.emptyState}>
              <Bot size={40} color={colors.textMuted} strokeWidth={1.5} />
              <FitText style={s.emptyTitle}>No conversations yet</FitText>
              <FitText style={s.emptyHint}>Start a new chat with BrodigyAI</FitText>
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
                        {deleteMode && (
                          <Pressable
                            style={[s.checkbox, isSelected && s.checkboxSelected]}
                            onPress={() => toggleSelect(session.id)}
                          >
                            {isSelected && <X size={16} color={colors.surface} strokeWidth={2.5} />}
                          </Pressable>
                        )}
                        <View style={s.cardWrap}>
                          <FitCard
                            icon={Bot}
                            label={session.title}
                            subtitle={`${session.messageCount} messages · ${session.preview.slice(0, 40)}...`}
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
      {deleteMode && (
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
      )}
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