import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { History, RefreshCw, SlidersHorizontal, X } from "lucide-react-native";
import { useInfiniteQuery } from "@tanstack/react-query";

import { nutritionLogsInfiniteQueryOptions } from "@fittrack/query";
import type { NutritionLogRecord } from "@fittrack/types";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useThemeTransitionAnim } from "@/hooks/animations/core/useThemeTransition";
import {
  formatNutritionLogSubtitle,
  MEAL_NAME_OPTIONS,
  type NutritionMealName
} from "@/data/nutrition";
import { formatLongDate } from "@fittrack/utils";
import { mobileApiClient } from "@/lib/api-client";
import { makeGoalsModalStyles } from "@/styles/modals/GoalsStyles";
import { R } from "@fittrack/ui/tokens";

import { FitText } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";
import FitFilter, { type FitFilterChipOption } from "@/components/fit/FitFilter";
import FitSearch from "@/components/fit/FitSearch";
import CalendarModal from "@/components/modals/shared/CalendarModal";
import NutritionMealIcon from "@/components/nutrition/NutritionMealIcon";

type Props = {
  isVisible: boolean;
  onClose: () => void;
  onEdit: (entry: NutritionLogRecord) => void;
};

type SortMode = "newest" | "oldest";
type CalendarTarget = "start" | "end" | null;

const PAGE_LIMIT = 10;
const MEAL_FILTER_OPTIONS: FitFilterChipOption[] = [
  { label: "All meals", value: "all" },
  ...MEAL_NAME_OPTIONS.map((option) => ({ label: option.label, value: option.value }))
];
const SORT_OPTIONS: FitFilterChipOption[] = [
  { label: "Newest", value: "newest" },
  { label: "Oldest", value: "oldest" }
];

const localStyles = StyleSheet.create({
  body: {
    flex: 1,
    gap: 12,
    minHeight: 0,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20
  },
  endLabel: {
    fontSize: 11,
    lineHeight: 16,
    paddingVertical: 12,
    textAlign: "center"
  },
  emptyState: {
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 34
  },
  emptyHint: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center"
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center"
  },
  filterButton: {
    alignItems: "center",
    borderRadius: R.md,
    borderWidth: 1,
    flexShrink: 0,
    height: 44,
    justifyContent: "center",
    position: "relative",
    width: 44
  },
  filterDropdown: {
    left: 0,
    position: "relative",
    right: 0,
    top: 0,
    width: "100%",
    zIndex: 0
  },
  filterCount: {
    alignItems: "center",
    borderRadius: 9,
    height: 18,
    justifyContent: "center",
    minWidth: 18,
    paddingHorizontal: 4,
    position: "absolute",
    right: -5,
    top: -5
  },
  filterCountText: {
    fontSize: 10,
    fontWeight: "800"
  },
  historyRow: {
    alignItems: "center",
    borderRadius: R.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12
  },
  historyRowCopy: {
    flex: 1,
    gap: 2
  },
  historyRowDate: {
    fontSize: 11,
    fontWeight: "700",
    textAlign: "right"
  },
  historyRowSubtitle: {
    fontSize: 11,
    lineHeight: 16
  },
  historyRowTitle: {
    fontSize: 14,
    fontWeight: "700"
  },
  list: {
    flex: 1,
    minHeight: 0
  },
  listContent: {
    flexGrow: 1,
    gap: 8,
    paddingBottom: 12
  },
  listFooter: {
    alignItems: "center",
    gap: 6,
    minHeight: 46,
    justifyContent: "center"
  },
  searchField: {
    flex: 1,
    minWidth: 0
  },
  searchRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8
  },
  updatingLabel: {
    fontSize: 11,
    marginTop: -4
  }
});

export default function NutritionHistoryModal({ isVisible, onClose, onEdit }: Props) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { ic } = useThemeTransitionAnim();
  const s = useMemo(() => makeGoalsModalStyles(colors), [colors]);
  const listRef = useRef<FlatList<NutritionLogRecord> | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [mealFilter, setMealFilter] = useState<NutritionMealName | "all">("all");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [calendarTarget, setCalendarTarget] = useState<CalendarTarget>(null);

  const queryParams = useMemo(
    () => ({
      limit: PAGE_LIMIT,
      ...(startDate ? { startDate } : {}),
      ...(endDate ? { endDate } : {}),
      ...(searchQuery.trim() ? { search: searchQuery.trim() } : {}),
      ...(mealFilter !== "all" ? { mealType: mealFilter } : {}),
      sort: sortMode
    }),
    [endDate, mealFilter, searchQuery, sortMode, startDate]
  );
  const historyQuery = useInfiniteQuery({
    ...nutritionLogsInfiniteQueryOptions<NutritionLogRecord>(mobileApiClient, user?.id, queryParams),
    enabled: isVisible && !!user?.id,
    retry: 1
  });

  useEffect(() => {
    const timeout = setTimeout(() => setSearchQuery(searchInput.trim()), 300);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    if (isVisible) listRef.current?.scrollToOffset({ animated: false, offset: 0 });
  }, [endDate, isVisible, mealFilter, searchQuery, sortMode, startDate]);

  const historyLogs = useMemo(() => {
    const seen = new Set<string>();
    return (historyQuery.data?.pages ?? []).flatMap((page) => page.data).filter((entry) => {
      if (seen.has(entry.id)) return false;
      seen.add(entry.id);
      return true;
    });
  }, [historyQuery.data?.pages]);
  const fetchMoreHistory = () => {
    void historyQuery.fetchNextPage();
  };
  const activeFilterCount = [startDate, endDate, mealFilter !== "all", sortMode !== "newest"]
    .filter(Boolean).length;
  const errorMessage = historyQuery.error instanceof Error
    ? historyQuery.error.message
    : "Unable to load meal history.";
  const hasActiveQuery = !!searchInput.trim() || activeFilterCount > 0;

  const backdropStyle = useAnimatedStyle(() => ({ backgroundColor: ic.value.overlay }));
  const cardStyle = useAnimatedStyle(() => ({
    backgroundColor: ic.value.surface,
    borderColor: ic.value.border
  }));
  const headerBorderStyle = useAnimatedStyle(() => ({ borderBottomColor: ic.value.border }));
  const footerBorderStyle = useAnimatedStyle(() => ({ borderTopColor: ic.value.border }));

  const selectCalendarDate = (date: string) => {
    if (calendarTarget === "start") {
      setStartDate(date);
      if (endDate && date > endDate) setEndDate("");
    } else if (calendarTarget === "end") {
      setEndDate(date);
    }
    setCalendarTarget(null);
    setIsFilterOpen(false);
  };

  return (
    <Modal visible={isVisible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <Animated.View style={[s.backdrop, backdropStyle]}>
        <Animated.View style={[s.card, cardStyle]}>
          <Animated.View style={[s.header, headerBorderStyle]}>
            <View style={s.headerIcon}>
              <History size={18} color={colors.brand} strokeWidth={2} />
            </View>
            <View style={s.headerText}>
              <FitText style={s.headerTitle}>Meal History</FitText>
              <FitText style={s.headerSubtitle}>All-time logs from the live nutrition backend</FitText>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close meal history"
              hitSlop={8}
              onPress={onClose}
            >
              <X size={20} color={colors.textMuted} strokeWidth={2} />
            </Pressable>
          </Animated.View>
          <View style={localStyles.body}>
            <View style={localStyles.searchRow}>
              <View style={localStyles.searchField}>
                <FitSearch
                  placeholder="Search meals..."
                  value={searchInput}
                  onChangeText={setSearchInput}
                />
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Filter meal history"
                accessibilityState={{ expanded: isFilterOpen, busy: historyQuery.isFetching }}
                onPress={() => setIsFilterOpen((open) => !open)}
                style={[
                  localStyles.filterButton,
                  {
                    backgroundColor: isFilterOpen ? colors.brand + "18" : colors.fieldBg,
                    borderColor: isFilterOpen || activeFilterCount > 0 ? colors.brand : colors.fieldBorder
                  }
                ]}
              >
                <SlidersHorizontal
                  size={20}
                  color={isFilterOpen || activeFilterCount > 0 ? colors.brand : colors.textMuted}
                  strokeWidth={2}
                />
                {activeFilterCount > 0 ? (
                  <View style={[localStyles.filterCount, { backgroundColor: colors.brand }]}>
                    <FitText style={[localStyles.filterCountText, { color: colors.onBrand ?? "#FFFFFF" }]}>
                      {activeFilterCount}
                    </FitText>
                  </View>
                ) : null}
              </Pressable>
            </View>
            <FitFilter
              isOpen={isFilterOpen}
              dropdownStyle={localStyles.filterDropdown}
              topChipLabel="Sort"
              topChipOptions={SORT_OPTIONS}
              activeTopChip={sortMode}
              onTopChipChange={(value) => {
                setSortMode(value as SortMode);
                setIsFilterOpen(false);
              }}
              chipLabel="Meal type"
              chipOptions={MEAL_FILTER_OPTIONS}
              activeChip={mealFilter}
              onChipChange={(value) => {
                setMealFilter(value as NutritionMealName | "all");
                setIsFilterOpen(false);
              }}
              showDateRange
              startDate={startDate}
              endDate={endDate}
              startDateLabel={startDate ? formatLongDate(startDate) : "All Dates"}
              endDateLabel={endDate ? formatLongDate(endDate) : "End Date"}
              onStartDatePress={() => setCalendarTarget("start")}
              onEndDatePress={() => setCalendarTarget("end")}
              onStartDateReset={() => setStartDate("")}
              onEndDateReset={() => setEndDate("")}
            />
            {historyQuery.isFetching && !historyQuery.isPending && !historyQuery.isFetchingNextPage ? (
              <FitText style={[localStyles.updatingLabel, { color: colors.textMuted }]}>Updating meal history...</FitText>
            ) : null}

            {historyQuery.isPending ? (
              <View style={localStyles.emptyState}>
                <ActivityIndicator color={colors.brand} />
                <FitText style={[localStyles.emptyTitle, { color: colors.textPrimary }]}>Loading meal history</FitText>
                <FitText style={[localStyles.emptyHint, { color: colors.textMuted }]}>Pulling a bounded page of your saved meals.</FitText>
              </View>
            ) : historyQuery.isError ? (
              <View style={localStyles.emptyState}>
                <History size={28} color={colors.danger} strokeWidth={2} />
                <FitText style={[localStyles.emptyTitle, { color: colors.textPrimary }]}>History unavailable</FitText>
                <FitText style={[localStyles.emptyHint, { color: colors.textMuted }]}>{errorMessage}</FitText>
                <FitButton
                  label="Retry"
                  icon={RefreshCw}
                  iconSize={16}
                  variant="ghost"
                  onPress={() => void historyQuery.refetch()}
                />
              </View>
            ) : (
              <FlatList
                ref={listRef}
                data={historyLogs}
                style={localStyles.list}
                contentContainerStyle={localStyles.listContent}
                keyExtractor={(entry) => entry.id}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled
                showsVerticalScrollIndicator={false}
                initialNumToRender={PAGE_LIMIT}
                maxToRenderPerBatch={PAGE_LIMIT}
                windowSize={5}
                onEndReachedThreshold={0.35}
                onEndReached={() => {
                  if (historyQuery.hasNextPage && !historyQuery.isFetchingNextPage) {
                    fetchMoreHistory();
                  }
                }}
                renderItem={({ item: entry }) => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${entry.mealName}, ${entry.foodItem}, ${formatLongDate(entry.logDate)}`}
                    onPress={() => onEdit(entry)}
                    style={[localStyles.historyRow, { backgroundColor: colors.fieldBg, borderColor: colors.fieldBorder }]}
                  >
                    <View style={[s.headerIcon, { width: 34, height: 34, borderColor: colors.brand + "44" }]}>
                      <NutritionMealIcon color={colors.brand} icon={entry.icon} size={16} />
                    </View>
                    <View style={localStyles.historyRowCopy}>
                      <FitText numberOfLines={1} style={[localStyles.historyRowTitle, { color: colors.textPrimary }]}>
                        {entry.foodItem}
                      </FitText>
                      <FitText style={[localStyles.historyRowSubtitle, { color: colors.textMuted }]}>
                        {`${entry.mealName} | ${formatNutritionLogSubtitle(entry)} | ${entry.quantity.toFixed(0)} ${entry.unit}`}
                      </FitText>
                    </View>
                    <FitText style={[localStyles.historyRowDate, { color: colors.brand }]}>
                      {formatLongDate(entry.logDate)}
                    </FitText>
                  </Pressable>
                )}
                ListEmptyComponent={(
                  <View style={localStyles.emptyState}>
                    <History size={28} color={colors.textMuted} strokeWidth={1.8} />
                    <FitText style={[localStyles.emptyTitle, { color: colors.textPrimary }] }>
                      {hasActiveQuery ? "No matching meals" : "No meal history yet"}
                    </FitText>
                    <FitText style={[localStyles.emptyHint, { color: colors.textMuted }] }>
                      {hasActiveQuery
                        ? "Clear the search or filters to bring your meals back into view."
                        : "Saved meals will appear here after your first log."}
                    </FitText>
                  </View>
                )}
                ListFooterComponent={historyLogs.length > 0 ? (
                  <View style={localStyles.listFooter}>
                    {historyQuery.isFetchingNextPage ? (
                      <>
                        <ActivityIndicator color={colors.brand} size="small" />
                        <FitText style={[localStyles.endLabel, { color: colors.textMuted }]}>Loading more meals...</FitText>
                      </>
                    ) : historyQuery.isFetchNextPageError ? (
                      <FitButton label="Retry more" icon={RefreshCw} iconSize={15} variant="ghost" onPress={fetchMoreHistory} />
                    ) : !historyQuery.hasNextPage ? (
                      <FitText style={[localStyles.endLabel, { color: colors.textMuted }]}>End of meal history</FitText>
                    ) : null}
                  </View>
                ) : null}
              />
            )}
          </View>
          <Animated.View style={[s.footer, footerBorderStyle]}>
            <FitButton label="Close" variant="ghost" onPress={onClose} flex={1} />
          </Animated.View>
        </Animated.View>
      </Animated.View>
      <CalendarModal
        isVisible={calendarTarget !== null}
        selectedDate={calendarTarget === "end" ? endDate : startDate}
        minDate={calendarTarget === "end" ? startDate || undefined : undefined}
        maxDate={calendarTarget === "start" ? endDate || undefined : undefined}
        defaultYear={new Date().getFullYear()}
        defaultMonth={new Date().getMonth() + 1}
        onSelect={selectCalendarDate}
        onClose={() => setCalendarTarget(null)}
      />
    </Modal>
  );
}
