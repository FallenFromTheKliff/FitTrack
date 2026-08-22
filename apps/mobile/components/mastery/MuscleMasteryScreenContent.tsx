import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  FlatList,
  findNodeHandle,
  type GestureResponderEvent,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import {
  Badge,
  Dumbbell,
  Flame,
  History,
  Lock,
  Medal,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  Trophy,
  X,
  type LucideIcon,
} from "lucide-react-native";
import { R } from "@fittrack/ui/tokens";
import type {
  FitnessExpProgressionRecord,
  FitnessMasteryRank,
  FitnessMuscleLeaderboardEntryRecord,
  FitnessMilestoneProgressRecord,
  FitnessSeasonHistoryRecord,
} from "@fittrack/types";

import { useTheme } from "@/contexts/ThemeContext";
import PremiumFeatureGate from "@/components/membership/PremiumFeatureGate";
import { FitButton, FitAvatarImage, FitCard, FitFilter, FitSearch, FitSection, FitText } from "@/components/fit";

import type { useMuscleMasteryScreen } from "@/hooks/mastery/useMuscleMasteryScreen";
import {
  MILESTONE_NARROW_GEOMETRY,
  resolveMilestoneBurstAnchor,
  resolveMilestoneCardDisclosure,
  resolveMilestoneFooterState,
  resolveReducedMotionPreference,
} from "./milestonePresentation";

type MuscleMasteryScreenController = ReturnType<typeof useMuscleMasteryScreen>;
type MasteryTab = MuscleMasteryScreenController["activeTab"];

const RANK_FILTERS: Array<{
  label: string;
  value: FitnessMasteryRank | "all";
}> = [
  { label: "All", value: "all" },
  { label: "Bronze", value: "bronze" },
  { label: "Silver", value: "silver" },
  { label: "Gold", value: "gold" },
  { label: "Platinum", value: "platinum" },
  { label: "Adamantite", value: "adamantite" },
];

const TABS: Array<{ label: string; value: MasteryTab }> = [
  { label: "Summary", value: "summary" },
  { label: "Milestones", value: "milestones" },
  { label: "Muscle EXP", value: "muscles" },
  { label: "Leaderboard", value: "leaderboard" },
];

const RANK_COLORS: Record<FitnessMasteryRank, string> = {
  bronze: "#CD7F32",
  silver: "#A8B0BC",
  gold: "#D4AF37",
  platinum: "#6D657E",
  adamantite: "#8E2F38",
};

const LIBRARY_ICONS: Record<string, LucideIcon> = {
  badge: Badge,
  dumbbell: Dumbbell,
  flame: Flame,
  medal: Medal,
  star: Sparkles,
  target: SlidersHorizontal,
  trophy: Trophy,
};

function getRankColor(rank: FitnessMasteryRank) {
  return RANK_COLORS[rank];
}

export const getMasteryRankColor = getRankColor;

function getLibraryIcon(iconKey: string | null | undefined, fallback = Dumbbell) {
  return LIBRARY_ICONS[iconKey ?? ""] ?? fallback;
}

function getRankLabel(rank: FitnessMasteryRank) {
  return formatTitle(rank);
}

function makeStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    actionGrid: {
      gap: 10,
    },
    achievementList: {
      gap: 8,
    },
    achievementMeta: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: "700",
      opacity: 0.74,
    },
    achievementRow: {
      borderRadius: R.md,
      borderWidth: 1,
      gap: 4,
      padding: 10,
    },
    achievementTitle: {
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: "700",
      lineHeight: 17,
    },
    burstDot: {
      borderRadius: 999,
      height: 10,
      position: "absolute",
      width: 10,
    },
    claimBurstLayer: {
      alignItems: "center",
      height: 1,
      justifyContent: "center",
      left: 28,
      position: "absolute",
      top: 28,
      width: 1,
      zIndex: 12,
    },
    emptyMessage: {
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 20,
    },
    heroCard: {
      gap: 10,
      paddingVertical: 2,
    },
    heroMetaPill: {
      borderRadius: R.md,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    heroMetaRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    heroMetaText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: "600",
    },
    heroPrimaryRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 12,
      justifyContent: "space-between",
    },
    heroProgressFill: {
      borderRadius: 999,
      height: 7,
    },
    heroProgressMeta: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
      opacity: 0.9,
    },
    heroProgressTrack: {
      backgroundColor: colors.brand + "18",
      borderRadius: 999,
      height: 7,
      overflow: "hidden",
    },
    heroTitle: {
      color: colors.textPrimary,
      fontSize: 24,
      fontWeight: "700",
      lineHeight: 30,
    },
    heroValue: {
      color: colors.brand,
      fontSize: 22,
      fontWeight: "800",
      lineHeight: 26,
    },
    heroValueLabel: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0.8,
      opacity: 0.72,
    },
    heroValueRow: {
      flexDirection: "row",
      gap: 16,
    },
    leaderboardAvatar: {
      alignItems: "center",
      borderRadius: 16,
      height: 40,
      justifyContent: "center",
      width: 40,
    },
    leaderboardAvatarText: {
      fontSize: 13,
      fontWeight: "700",
    },
    leaderboardAvatarShell: {
      borderRadius: 20,
      height: 40,
      overflow: "hidden",
      width: 40,
    },
    leaderboardMeta: {
      alignItems: "flex-end",
      gap: 2,
    },
    leaderboardName: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: "600",
    },
    leaderboardRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 12,
      paddingVertical: 10,
    },
    leaderboardSubtitle: {
      color: colors.textMuted,
      fontSize: 12,
    },
    leaderboardXp: {
      color: colors.brand,
      fontSize: 13,
      fontWeight: "700",
    },
    leaderboardControls: {
      gap: 8,
      marginBottom: 10,
      position: "relative",
      zIndex: 20,
    },
    leaderboardControlRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    leaderboardChip: {
      alignItems: "center",
      borderRadius: R.md,
      borderWidth: 1,
      minHeight: 36,
      paddingHorizontal: 12,
      justifyContent: "center",
    },
    leaderboardChipText: {
      fontSize: 12,
      fontWeight: "700",
    },
    leaderboardFilterButton: {
      alignItems: "center",
      borderRadius: R.md,
      borderWidth: 1,
      height: 42,
      justifyContent: "center",
      width: 44,
    },
    leaderboardFilterDropdown: {
      left: 0,
      right: 0,
      top: 92,
      zIndex: 220,
      elevation: 14,
    },
    leaderboardSearchRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 8,
    },
    leaderboardSearchField: {
      flex: 1,
    },
    loadMoreButton: {
      marginTop: 12,
    },
    seasonHistoryBlock: {
      gap: 10,
    },
    seasonHistoryHeader: {
      alignItems: "center",
      flexDirection: "row",
      gap: 8,
      justifyContent: "space-between",
    },
    seasonHistoryList: {
      gap: 6,
    },
    seasonHistoryRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 10,
      paddingVertical: 7,
    },
    list: {
      gap: 10,
    },
    milestoneGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
    },
    milestoneActions: {
      flexDirection: "row",
      marginTop: "auto",
    },
    claimButton: {
      alignItems: "center",
      borderRadius: R.md,
      borderWidth: 1,
      flex: 1,
      flexDirection: "row",
      gap: 6,
      justifyContent: "center",
      minHeight: MILESTONE_NARROW_GEOMETRY.claimTargetMinHeight,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    milestoneCard: {
      borderRadius: R.lg,
      borderWidth: 1,
      flexBasis: "48%",
      gap: 10,
      marginBottom: 10,
      maxWidth: "48%",
      minHeight: 188,
      overflow: "visible",
      padding: 11,
      position: "relative",
    },
    milestoneIcon: {
      alignItems: "center",
      borderRadius: R.md,
      height: 34,
      justifyContent: "center",
      overflow: "hidden",
      width: 34,
    },
    milestoneIconImage: {
      borderRadius: R.md,
      height: 34,
      overflow: "hidden",
      width: 34,
    },
    milestoneCardHeader: {
      alignItems: "flex-start",
      flexDirection: "column",
      gap: 6,
    },
    milestoneProgressCopy: {
      alignItems: "center",
      flexDirection: "row",
      gap: 6,
      justifyContent: "space-between",
    },
    milestoneTitle: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: "700",
      flexShrink: 1,
      lineHeight: 20,
      minHeight: MILESTONE_NARROW_GEOMETRY.titleMinHeight,
    },
    milestoneSearchRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 8,
      marginBottom: 10,
    },
    milestoneSearchField: {
      flex: 1,
    },
    milestoneFilterButton: {
      alignItems: "center",
      borderRadius: R.md,
      borderWidth: 1,
      height: 42,
      justifyContent: "center",
      width: 44,
    },
    milestoneFilterDropdown: {
      left: 0,
      right: 0,
      top: 48,
      zIndex: 220,
      elevation: 14,
    },
    lazyFooter: {
      alignItems: "center",
      gap: 8,
      paddingBottom: 6,
      paddingTop: 12,
      width: "100%",
    },
    noticeCard: {
      borderRadius: R.lg,
      borderWidth: 1,
      gap: 6,
      padding: 14,
    },
    noticeTitle: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: "700",
    },
    sectionPager: {
      alignItems: "center",
      marginTop: 0,
    },
    progressMeta: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
    },
    progressionCard: {
      borderRadius: R.lg,
      borderWidth: 1,
      gap: 8,
      padding: 12,
    },
    progressionGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
    progressionLabel: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0.4,
      textTransform: "uppercase",
    },
    progressionLevel: {
      fontSize: 18,
      fontWeight: "800",
    },
    progressionXp: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: "700",
    },
    progressionTrack: {
      backgroundColor: colors.border,
      borderRadius: 999,
      height: 6,
      overflow: "hidden",
    },
    progressionFill: {
      borderRadius: 999,
      height: 6,
    },
    progressionMeta: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: "700",
    },
    privatePanel: {
      alignItems: "center",
      borderRadius: R.lg,
      borderWidth: 1,
      gap: 8,
      padding: 18,
      textAlign: "center",
    },
    privatePanelTitle: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: "800",
      textAlign: "center",
    },
    privatePanelText: {
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 19,
      textAlign: "center",
    },
    summaryTopMuscleLabel: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0.8,
      marginBottom: 6,
      textTransform: "uppercase",
    },
    root: {
      gap: 12,
      position: "relative",
    },
    muscleControls: {
      gap: 8,
      position: "relative",
      zIndex: 20,
      elevation: 12,
    },
    muscleFilterDropdown: {
      left: 0,
      right: 0,
      top: 54,
      zIndex: 220,
      elevation: 12,
    },
    muscleFilterButton: {
      alignItems: "center",
      alignSelf: "stretch",
      justifyContent: "center",
      minWidth: 42,
      paddingLeft: 10,
      paddingVertical: 6,
    },
    muscleSearchField: {
      flex: 1,
    },
    muscleSearchRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 8,
    },
    sectionMessage: {
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 20,
    },
    separator: {
      height: 1,
      marginVertical: 4,
    },
    statGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
    statTile: {
      flexBasis: "47%",
      flexGrow: 1,
      minWidth: 0,
    },
    tabButton: {
      alignItems: "center",
      borderRadius: R.md,
      borderWidth: 1,
      flexGrow: 1,
      paddingHorizontal: 10,
      paddingVertical: 10,
    },
    tabRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 14,
    },
    tabText: {
      fontSize: 12,
      fontWeight: "700",
    },
    toast: {
      borderRadius: R.md,
      borderWidth: 1,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    modalBackdrop: {
      alignItems: "center",
      backgroundColor: "rgba(0,0,0,0.62)",
      flex: 1,
      justifyContent: "center",
      padding: 12,
    },
    modalCard: {
      borderRadius: R.xl,
      borderWidth: 1,
      gap: 12,
      maxHeight: "92%",
      padding: 16,
      width: "100%",
    },
    modalHeader: {
      alignItems: "flex-start",
      flexDirection: "row",
      gap: 10,
      justifyContent: "space-between",
    },
    modalTitle: {
      color: colors.textPrimary,
      fontSize: 20,
      fontWeight: "800",
      lineHeight: 24,
      flexShrink: 1,
      minWidth: 0,
    },
    modalClose: {
      alignItems: "center",
      borderRadius: R.md,
      borderWidth: 1,
      height: 36,
      justifyContent: "center",
      width: 36,
    },
    modalControlRow: {
      alignItems: "center",
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    modalMuscleFilterRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 8,
      position: "relative",
      zIndex: 30,
      elevation: 16,
    },
    modalFilterButton: {
      alignItems: "center",
      borderRadius: R.md,
      borderWidth: 1,
      height: 40,
      justifyContent: "center",
      width: 40,
    },
    modalFilterDropdown: {
      left: 0,
      right: 0,
      top: 48,
      zIndex: 220,
      elevation: 16,
    },
    modalChip: {
      alignItems: "center",
      borderRadius: R.md,
      borderWidth: 1,
      minHeight: 36,
      paddingHorizontal: 11,
      justifyContent: "center",
    },
    modalChipText: {
      fontSize: 12,
      fontWeight: "800",
    },
    modalList: {
      flexGrow: 0,
    },
    modalRow: {
      alignItems: "center",
      borderRadius: R.md,
      borderWidth: 1,
      flexDirection: "row",
      gap: 10,
      marginBottom: 8,
      minHeight: 56,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    modalRank: {
      alignItems: "center",
      borderRadius: R.md,
      height: 32,
      justifyContent: "center",
      minWidth: 34,
      paddingHorizontal: 5,
    },
    modalRankText: {
      fontSize: 12,
      fontWeight: "900",
    },
    modalAvatar: {
      borderRadius: 17,
      height: 34,
      overflow: "hidden",
      width: 34,
    },
    modalCopy: {
      flex: 1,
      gap: 2,
    },
    modalName: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: "800",
    },
    modalValue: {
      fontSize: 13,
      fontWeight: "800",
    },
    modalHint: {
      color: colors.textMuted,
      fontSize: 11,
    },
    milestoneDetailsBody: {
      gap: 14,
      paddingBottom: 4,
    },
    milestoneDetailsDescription: {
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 21,
    },
    milestoneDetailsHeader: {
      alignItems: "center",
      flex: 1,
      flexDirection: "row",
      gap: 12,
    },
    milestoneDetailsMeta: {
      borderRadius: R.md,
      borderWidth: 1,
      gap: 4,
      padding: 12,
    },
    modalEmpty: {
      alignItems: "center",
      gap: 8,
      justifyContent: "center",
      minHeight: 180,
      padding: 12,
    },
    pickerCard: {
      borderRadius: R.xl,
      borderWidth: 1,
      gap: 12,
      maxHeight: "86%",
      padding: 16,
      width: "100%",
    },
    pickerList: {
      flexGrow: 0,
    },
    pickerRow: {
      borderRadius: R.md,
      borderWidth: 1,
      gap: 3,
      marginBottom: 8,
      padding: 12,
    },
  });
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatTitle(value: string) {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getMilestoneStatusLabel(milestone: FitnessMilestoneProgressRecord) {
  if (milestone.status === "claimed") return "Claimed";
  if (milestone.status === "unlocked") return "Unlocked";
  if (milestone.status === "pending_review" || milestone.status === "rejected") {
    return "Recalculating";
  }
  return "Locked";
}

function getMilestoneTone(milestone: FitnessMilestoneProgressRecord, colors: ReturnType<typeof useTheme>["colors"]) {
  if (milestone.status === "claimed") return colors.success ?? colors.brand;
  if (milestone.status === "unlocked") return colors.brand;
  if (milestone.status === "pending_review" || milestone.status === "rejected") {
    return colors.textMuted;
  }
  return colors.textMuted;
}

type FocusableMilestoneElement = View & { focus?: () => void };

function focusMilestoneElement(element: FocusableMilestoneElement | null) {
  if (!element) return;
  if (Platform.OS === "web" && typeof element.focus === "function") {
    element.focus();
    return;
  }
  const nativeTag = findNodeHandle(element);
  if (typeof nativeTag === "number") {
    AccessibilityInfo.setAccessibilityFocus(nativeTag);
  }
}

function useMilestoneReducedMotionPreference() {
  const [nativePreference, setNativePreference] = useState(false);
  const [webMediaPreference, setWebMediaPreference] = useState(() =>
    Platform.OS === "web" && typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false,
  );

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) setNativePreference(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setNativePreference,
    );
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (event: MediaQueryListEvent) =>
      setWebMediaPreference(event.matches);
    setWebMediaPreference(mediaQuery.matches);
    mediaQuery.addEventListener("change", onChange);
    return () => mediaQuery.removeEventListener("change", onChange);
  }, []);

  return resolveReducedMotionPreference(
    nativePreference,
    webMediaPreference,
  );
}

function BurstParticle({ activeKey, color, index }: { activeKey: number; color: string; index: number }) {
  const progress = useSharedValue(1);
  const angle = (Math.PI * 2 * index) / 12;
  const distance = 42 + (index % 3) * 12;

  useEffect(() => {
    if (activeKey <= 0) return;
    progress.value = 0;
    progress.value = withTiming(1, {
      duration: 720,
      easing: Easing.out(Easing.cubic),
    });
  }, [activeKey, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: Math.max(0, 1 - progress.value),
    transform: [
      { translateX: Math.cos(angle) * distance * progress.value },
      { translateY: Math.sin(angle) * distance * progress.value },
      { scale: 1 - progress.value * 0.35 },
    ],
  }));

  return (
    <Animated.View
      style={[
        {
          backgroundColor: color,
          borderRadius: 999,
          height: index % 2 === 0 ? 10 : 7,
          position: "absolute",
          width: index % 2 === 0 ? 10 : 7,
        },
        style,
      ]}
    />
  );
}

function MilestoneClaimBurst({ activeKey, color }: { activeKey: number; color: string }) {
  if (activeKey <= 0) return null;
  return (
    <>
      {Array.from({ length: 12 }, (_, index) => (
        <BurstParticle
          key={`${activeKey}-${index}`}
          activeKey={activeKey}
          color={index % 2 === 0 ? color : "#FFFFFF"}
          index={index}
        />
      ))}
    </>
  );
}

function ProgressionSummary({
  label,
  points,
  pointsLabel,
  progression,
}: {
  label: string;
  points: number;
  pointsLabel: string;
  progression: FitnessExpProgressionRecord;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const rankColor = getRankColor(progression.level);
  const progress = Math.min(Math.max(progression.progressPercent, 0), 100);
  const nextLabel = progression.nextLevelExp
    ? `${progression.remainingExp?.toLocaleString("en-US") ?? 0} EXP to ${getRankLabel(
        progression.level === "bronze"
          ? "silver"
          : progression.level === "silver"
            ? "gold"
            : progression.level === "gold"
              ? "platinum"
              : "adamantite",
      )}`
    : "Max rank reached";

  return (
    <View
      style={[
        styles.progressionCard,
        {
          borderColor: rankColor + "66",
          backgroundColor: colors.surfaceRaised,
        },
      ]}
    >
      <FitText style={styles.progressionLabel}>{label}</FitText>
      <FitText style={[styles.progressionLevel, { color: rankColor }]}>{getRankLabel(progression.level)}</FitText>
      <FitText style={styles.progressionXp}>
        {points.toLocaleString("en-US")} {pointsLabel}
      </FitText>
      <View style={styles.progressionTrack}>
        <View style={[styles.progressionFill, { backgroundColor: rankColor, width: `${progress}%` }]} />
      </View>
      <FitText style={styles.progressionMeta}>
        {progress}% to next level · {nextLabel}
      </FitText>
    </View>
  );
}

function MasteryIcon({
  alt,
  iconAssetKey,
  iconKey,
  iconKind,
  size = 34,
  tone,
}: {
  alt: string;
  iconAssetKey?: string | null;
  iconKey?: string | null;
  iconKind?: "library" | "custom";
  size?: number;
  tone: string;
}) {
  const { colors } = useTheme();
  const Icon = getLibraryIcon(iconKey);
  const fallback = (
    <View
      style={{
        alignItems: "center",
        backgroundColor: tone + "18",
        borderColor: tone + "55",
        borderRadius: R.md,
        borderWidth: 1,
        height: size,
        justifyContent: "center",
        width: size,
      }}
    >
      <Icon size={Math.max(16, size * 0.52)} color={tone || colors.brand} strokeWidth={2} />
    </View>
  );

  if (iconKind === "custom" && iconAssetKey?.trim()) {
    return (
      <View style={{ height: size, width: size }}>
        <FitAvatarImage alt={alt} borderRadius={R.md} fallback={fallback} uri={iconAssetKey} />
      </View>
    );
  }

  return fallback;
}

function LeaderboardAvatar({
  displayName,
  styles,
  uri,
}: {
  displayName: string;
  styles: ReturnType<typeof makeStyles>;
  uri?: string | null;
}) {
  const { colors } = useTheme();
  const initials = getInitials(displayName);
  return (
    <View style={[styles.leaderboardAvatarShell, { backgroundColor: colors.brand + "18" }]}>
      <FitAvatarImage
        alt={`${displayName} avatar`}
        borderRadius={20}
        fallback={
          <View style={styles.leaderboardAvatar}>
            <FitText style={[styles.leaderboardAvatarText, { color: colors.brand }]}>{initials}</FitText>
          </View>
        }
        uri={uri}
      />
    </View>
  );
}

export function MuscleMasteryHeaderPanel({ controller }: { controller: MuscleMasteryScreenController }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const heroProgressPercent = Math.min(Math.max(controller.totalXpProgress, 0), 1);
  const heroAccentColor = getRankColor(controller.lifetimeProgression.level);
  const currentStreak = controller.progressionProfile?.currentStreak ?? 0;
  const streakLabel = `${currentStreak} day streak`;
  const totalXpLabel = `${controller.totalXp.toLocaleString("en-US")} EXP`;

  return (
    <View style={styles.heroCard}>
      <View style={styles.heroPrimaryRow}>
        <FitText style={styles.heroTitle}>{streakLabel}</FitText>
        <View>
          <FitText style={styles.heroValueLabel}>TOTAL EXP</FitText>
          <FitText style={[styles.heroValue, { color: heroAccentColor }]}>{totalXpLabel}</FitText>
        </View>
      </View>
      <View style={{ gap: 8 }}>
        <View style={[styles.heroProgressTrack, { backgroundColor: heroAccentColor + "18" }]}>
          <View
            style={[
              styles.heroProgressFill,
              {
                backgroundColor: heroAccentColor,
                width: `${heroProgressPercent * 100}%`,
              },
            ]}
          />
        </View>
        <FitText style={styles.heroProgressMeta}>
          {controller.totalXp.toLocaleString("en-US")} / {controller.totalXpGoal.toLocaleString("en-US")} EXP
        </FitText>
      </View>
    </View>
  );
}

export default function MuscleMasteryScreenContent({ controller }: { controller: MuscleMasteryScreenController }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [isMilestoneFilterOpen, setIsMilestoneFilterOpen] = useState(false);
  const [isMuscleFilterOpen, setIsMuscleFilterOpen] = useState(false);
  const [isLeaderboardMuscleFilterOpen, setIsLeaderboardMuscleFilterOpen] = useState(false);
  const [selectedMilestone, setSelectedMilestone] = useState<FitnessMilestoneProgressRecord | null>(null);
  const milestoneCardRefs = useRef(
    new Map<string, FocusableMilestoneElement>(),
  );
  const originatingMilestoneIdRef = useRef<string | null>(null);
  const reduceMotion = useMilestoneReducedMotionPreference();
  const maxXp = controller.mastery[0]?.xpPoints ?? 0;

  const openMilestoneDetails = useCallback(
    (milestone: FitnessMilestoneProgressRecord) => {
      originatingMilestoneIdRef.current = milestone.milestoneDefinitionId;
      setSelectedMilestone(milestone);
    },
    [],
  );

  const closeMilestoneDetails = useCallback(() => {
    const originatingMilestoneId = originatingMilestoneIdRef.current;
    setSelectedMilestone(null);
    if (!originatingMilestoneId) return;
    requestAnimationFrame(() => {
      focusMilestoneElement(
        milestoneCardRefs.current.get(originatingMilestoneId) ?? null,
      );
    });
  }, []);

  const renderSummary = () => (
    <>
      <FitSection heading="Summary" cardStyle={{ padding: 14 }}>
        <View style={styles.statGrid}>
          {controller.summaryCards.map((item) =>
            item.id === "xp" ? (
              <View
                key={item.id}
                style={[
                  styles.statTile,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderRadius: R.lg,
                    borderWidth: 1,
                    alignItems: "center",
                    padding: 12,
                  },
                ]}
              >
                <FitText style={[styles.heroValue, { color: colors.success }]}>{item.value}</FitText>
                <FitText style={styles.heroValueLabel}>TOTAL EXP</FitText>
              </View>
            ) : (
              <View key={item.id} style={styles.statTile}>
                <FitCard label={item.label} statValue={item.value} />
              </View>
            ),
          )}
        </View>
        <View style={{ gap: 10, marginTop: 12 }}>
          <FitText style={styles.progressionLabel}>Overall progression</FitText>
          <View style={styles.progressionGrid}>
            <View style={{ flexBasis: "48%", flexGrow: 1 }}>
              <ProgressionSummary
                label="Lifetime"
                points={controller.totalXp}
                pointsLabel="EXP"
                progression={controller.lifetimeProgression}
              />
            </View>
            <View style={{ flexBasis: "48%", flexGrow: 1 }}>
              <ProgressionSummary
                label="Season"
                points={controller.seasonStanding?.seasonPoints ?? 0}
                pointsLabel="points"
                progression={controller.seasonProgression}
              />
            </View>
          </View>
        </View>
        {controller.topMuscle ? (
          <View style={{ marginTop: 12 }}>
            <FitText style={styles.summaryTopMuscleLabel}>Top muscle</FitText>
            <FitCard
              label={controller.topMuscle.muscleGroup}
              subtitle={`${controller.topMuscle.xpPoints.toLocaleString("en-US")} EXP | ${controller.topMuscle.totalVolumeKg.toLocaleString("en-US")} kg total volume`}
              trailingLabel={getRankLabel(controller.topMuscle.rank)}
              trailingLabelColor={getRankColor(controller.topMuscle.rank)}
              progress={maxXp > 0 ? controller.topMuscle.xpPoints / maxXp : 0}
              icon={getLibraryIcon(controller.topMuscle.iconKey, Sparkles)}
              noChevron
            />
          </View>
        ) : null}
      </FitSection>

      <FitSection heading="Season" cardStyle={{ padding: 14 }}>
        <FitCard
          label={controller.seasonCaption}
          subtitle="Season standing and points are tracked from confirmed progression."
          trailingLabel={controller.seasonRankLabel}
          trailingLabelColor={getRankColor(controller.seasonProgression.level)}
          icon={Trophy}
          noChevron
        />
      </FitSection>
    </>
  );

  const renderMilestones = () => (
    <>
      <View style={styles.muscleControls}>
        <View style={styles.milestoneSearchRow}>
          <View style={styles.milestoneSearchField}>
            <FitSearch
              value={controller.milestoneSearch}
              placeholder="Search milestones"
              onChangeText={controller.setMilestoneSearch}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Filter milestones: ${controller.milestoneFilter}`}
            accessibilityState={{ expanded: isMilestoneFilterOpen }}
            onPress={() => setIsMilestoneFilterOpen((open) => !open)}
            style={[
              styles.milestoneFilterButton,
              {
                backgroundColor: isMilestoneFilterOpen ? colors.brand + "16" : colors.surfaceRaised,
                borderColor: isMilestoneFilterOpen ? colors.brand : colors.border,
              },
            ]}
          >
            <SlidersHorizontal
              size={19}
              color={isMilestoneFilterOpen ? colors.brand : colors.textMuted}
              strokeWidth={2}
            />
          </Pressable>
        </View>
        <FitFilter
          isOpen={isMilestoneFilterOpen}
          topChipLabel="Milestone state"
          topChipOptions={[
            { label: "All", value: "all" },
            { label: "Achieved", value: "achieved" },
            { label: "Unachieved", value: "unachieved" },
          ]}
          dropdownStyle={styles.milestoneFilterDropdown}
          activeTopChip={controller.milestoneFilter}
          onTopChipChange={(value) => {
            controller.setMilestoneFilter(value as "all" | "achieved" | "unachieved");
            setIsMilestoneFilterOpen(false);
          }}
        />
      </View>

      <FitSection heading="Milestones" cardStyle={{ overflow: "visible", padding: 14 }}>
        {controller.sortedMilestones.length === 0 ? (
          <FitText style={styles.sectionMessage}>
            Visible milestones will appear after the progression backbone publishes active goals for this member
            account.
          </FitText>
        ) : controller.milestonePageItems.length === 0 ? (
          <FitText style={styles.sectionMessage}>No milestones match the current search and state filter.</FitText>
        ) : (
          <View accessibilityLabel="Milestone list" style={styles.milestoneGrid} testID="milestone-grid">
            {controller.milestonePageItems.map((milestone) => {
              const card = resolveMilestoneCardDisclosure(milestone);
              const tone = getMilestoneTone(milestone, colors);
              const canClaim = milestone.status === "unlocked";
              const statusLabel = getMilestoneStatusLabel(milestone);
              const burstAnchor = resolveMilestoneBurstAnchor(
                controller.celebratedMilestoneId,
                milestone.milestoneDefinitionId,
                controller.celebrationKey,
                reduceMotion,
              );

              return (
                <View
                  key={milestone.milestoneDefinitionId}
                  style={[
                    styles.milestoneCard,
                    {
                      backgroundColor: canClaim ? colors.brand + "10" : colors.surfaceRaised,
                      borderColor: canClaim ? colors.brand + "55" : colors.border,
                    },
                  ]}
                  testID={`milestone-card-${milestone.milestoneDefinitionId}`}
                >
                  <Pressable
                    accessibilityHint="Opens milestone details"
                    accessibilityLabel={`${milestone.title}, ${statusLabel}`}
                    accessibilityRole="button"
                    onPress={() => openMilestoneDetails(milestone)}
                    ref={(element) => {
                      if (element) {
                        milestoneCardRefs.current.set(
                          milestone.milestoneDefinitionId,
                          element as FocusableMilestoneElement,
                        );
                      } else {
                        milestoneCardRefs.current.delete(
                          milestone.milestoneDefinitionId,
                        );
                      }
                    }}
                    style={StyleSheet.absoluteFill}
                    testID={`milestone-details-trigger-${milestone.milestoneDefinitionId}`}
                  />
                  {burstAnchor ? (
                    <View
                      accessibilityElementsHidden
                      importantForAccessibility="no-hide-descendants"
                      pointerEvents="none"
                      style={styles.claimBurstLayer}
                      testID={`milestone-burst-${burstAnchor.milestoneDefinitionId}`}
                    >
                      <MilestoneClaimBurst activeKey={burstAnchor.celebrationKey} color={colors.brand} />
                    </View>
                  ) : null}
                  <View pointerEvents="none" style={{ gap: 10 }}>
                    <View style={styles.milestoneCardHeader}>
                      <MasteryIcon
                        alt={`${milestone.title} icon`}
                        iconAssetKey={milestone.iconAssetKey}
                        iconKey={milestone.iconKey}
                        iconKind={milestone.iconKind}
                        tone={tone}
                      />
                      <View style={{ flex: 1 }}>
                        <FitText
                          numberOfLines={MILESTONE_NARROW_GEOMETRY.titleLineCount}
                          style={styles.milestoneTitle}
                        >
                          {card.title}
                        </FitText>
                      </View>
                    </View>
                    <View style={styles.milestoneProgressCopy}>
                      <FitText numberOfLines={1} style={styles.progressMeta}>
                        {card.progressValue.toLocaleString("en-US")} / {card.targetValue.toLocaleString("en-US")}
                      </FitText>
                      <FitText style={[styles.progressMeta, { color: tone }]}>
                        {Math.round(card.progressPercent)}%
                      </FitText>
                    </View>
                    <View
                      style={{
                        backgroundColor: colors.border,
                        borderRadius: 999,
                        height: 5,
                        overflow: "hidden",
                      }}
                    >
                      <View
                        style={{
                          backgroundColor: tone,
                          height: 5,
                          width: `${card.progressPercent}%`,
                        }}
                      />
                    </View>
                  </View>
                  <View style={styles.milestoneActions}>
                    <Pressable
                      accessibilityLabel={canClaim ? `Claim ${milestone.title}` : statusLabel}
                      accessibilityRole="button"
                      accessibilityState={{
                        disabled: !canClaim || controller.isClaimingMilestone,
                      }}
                      disabled={!canClaim || controller.isClaimingMilestone}
                      onPress={(event: GestureResponderEvent) => {
                        event.stopPropagation();
                        void controller.onClaimMilestone(milestone);
                      }}
                      style={[
                        styles.claimButton,
                        {
                          backgroundColor: canClaim ? colors.brand : colors.surface,
                          borderColor: canClaim ? colors.brand : colors.border,
                          opacity: controller.isClaimingMilestone ? 0.65 : 1,
                        },
                      ]}
                      testID={`milestone-claim-${milestone.milestoneDefinitionId}`}
                    >
                      {canClaim ? <Sparkles size={14} color={colors.onBrand ?? "#FFFFFF"} /> : null}
                      <FitText
                        style={{
                          color: canClaim ? (colors.onBrand ?? "#FFFFFF") : tone,
                          fontSize: 12,
                          fontWeight: "800",
                        }}
                      >
                        {canClaim && controller.isClaimingMilestone ? "Claiming..." : canClaim ? "Claim" : statusLabel}
                      </FitText>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        )}
        {controller.milestonePageItems.length > 0
          ? (() => {
              const footer = resolveMilestoneFooterState({
                hasMore: controller.milestoneHasMore,
                total: controller.filteredMilestoneCount,
                visible: controller.milestonePageItems.length,
              });
              return (
                <View style={styles.lazyFooter} testID="milestone-list-footer">
                  <FitButton
                    accessibilityLabel={footer.label}
                    disabled={footer.disabled}
                    label={footer.label}
                    onPress={controller.onLoadMoreMilestones}
                    style={{ alignSelf: "stretch", width: "100%" }}
                    variant={controller.milestoneHasMore ? "primary" : "ghost"}
                  />
                  <FitText style={styles.progressMeta}>{footer.summary}</FitText>
                </View>
              );
            })()
          : null}
      </FitSection>
    </>
  );

  const renderMuscles = () => (
    <>
      <View style={styles.muscleControls}>
        <View style={styles.muscleSearchRow}>
          <View style={styles.muscleSearchField}>
            <FitSearch
              value={controller.muscleSearch}
              placeholder="Search muscle group"
              onChangeText={controller.setMuscleSearch}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Filter muscle EXP by rank: ${controller.muscleRankFilter === "all" ? "All" : controller.muscleRankFilter}`}
            accessibilityState={{ expanded: isMuscleFilterOpen }}
            hitSlop={8}
            onPress={() => setIsMuscleFilterOpen((open) => !open)}
            style={styles.muscleFilterButton}
          >
            <SlidersHorizontal size={20} color={isMuscleFilterOpen ? colors.brand : colors.textMuted} strokeWidth={2} />
          </Pressable>
        </View>
        <FitFilter
          isOpen={isMuscleFilterOpen}
          topChipLabel="Rank"
          topChipOptions={RANK_FILTERS}
          dropdownStyle={styles.muscleFilterDropdown}
          activeTopChip={controller.muscleRankFilter}
          onTopChipChange={(value) => {
            controller.setMuscleRankFilter(value as FitnessMasteryRank | "all");
            setIsMuscleFilterOpen(false);
          }}
        />
      </View>
      <FitSection heading="Muscle EXP" cardStyle={{ padding: 14 }}>
        <View style={styles.list}>
          {controller.filteredMuscleCount > 0 ? (
            controller.mastery
              .filter((entry) =>
                controller.muscleSearch.trim()
                  ? entry.muscleGroup.toLowerCase().includes(controller.muscleSearch.trim().toLowerCase())
                  : true,
              )
              .filter((entry) => controller.muscleRankFilter === "all" || entry.rank === controller.muscleRankFilter)
              .map((entry) => {
                const lifetimeColor = getRankColor(entry.lifetimeProgression.level);
                const seasonColor = getRankColor(entry.seasonProgression.level);
                return (
                  <View
                    key={entry.id}
                    style={[
                      styles.progressionCard,
                      {
                        backgroundColor: colors.surfaceRaised,
                        borderColor: lifetimeColor + "55",
                      },
                    ]}
                  >
                    <View
                      style={{
                        alignItems: "center",
                        flexDirection: "row",
                        gap: 10,
                      }}
                    >
                      <MasteryIcon
                        alt={`${entry.muscleGroup} icon`}
                        iconAssetKey={entry.iconAssetKey}
                        iconKey={entry.iconKey}
                        iconKind={entry.iconKind}
                        tone={lifetimeColor}
                      />
                      <View style={{ flex: 1, gap: 3 }}>
                        <FitText style={styles.milestoneTitle}>{entry.muscleGroup}</FitText>
                        <FitText style={styles.progressMeta}>
                          {entry.totalVolumeKg.toLocaleString("en-US")} kg total volume
                        </FitText>
                      </View>
                      <FitText style={[styles.progressionLevel, { color: lifetimeColor, fontSize: 14 }]}>
                        {getRankLabel(entry.lifetimeProgression.level)}
                      </FitText>
                    </View>
                    <View style={{ gap: 6 }}>
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                        }}
                      >
                        <FitText style={styles.progressionLabel}>Lifetime</FitText>
                        <FitText style={styles.progressionXp}>
                          {entry.lifetimeProgression.currentExp.toLocaleString("en-US")} EXP ·{" "}
                          {entry.lifetimeProgression.progressPercent}%
                        </FitText>
                      </View>
                      <View style={styles.progressionTrack}>
                        <View
                          style={[
                            styles.progressionFill,
                            {
                              backgroundColor: lifetimeColor,
                              width: `${entry.lifetimeProgression.progressPercent}%`,
                            },
                          ]}
                        />
                      </View>
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                        }}
                      >
                        <FitText style={styles.progressionLabel}>Season</FitText>
                        <FitText style={[styles.progressionXp, { color: seasonColor }]}>
                          {entry.seasonProgression.currentExp.toLocaleString("en-US")} EXP ·{" "}
                          {entry.seasonProgression.progressPercent}%
                        </FitText>
                      </View>
                      <View style={styles.progressionTrack}>
                        <View
                          style={[
                            styles.progressionFill,
                            {
                              backgroundColor: seasonColor,
                              width: `${entry.seasonProgression.progressPercent}%`,
                            },
                          ]}
                        />
                      </View>
                    </View>
                  </View>
                );
              })
          ) : (
            <FitText style={styles.sectionMessage}>No muscle EXP entries match the current filters.</FitText>
          )}
        </View>
      </FitSection>
    </>
  );

  const renderLeaderboard = () => {
    const leaderboardEntries =
      controller.leaderboardMode === "muscle" ? controller.muscleLeaderboard : controller.leaderboard;
    const hasMore =
      controller.leaderboardMode === "muscle" ? controller.muscleLeaderboardHasMore : controller.leaderboardHasMore;
    const muscleDefinitionsBlocked =
      controller.leaderboardMode === "muscle" &&
      (controller.muscleDefinitionsLoading ||
        !!controller.muscleDefinitionsError ||
        controller.leaderboardMuscleOptions.length === 0);
    const renderMuscleDefinitionsState = () => {
      if (controller.muscleDefinitionsLoading) {
        return (
          <View style={{ alignItems: "center", paddingVertical: 8 }}>
            <ActivityIndicator color={colors.brand} />
            <FitText style={styles.sectionMessage}>Loading active muscle filters...</FitText>
          </View>
        );
      }
      if (controller.muscleDefinitionsError) {
        return (
          <View style={{ alignItems: "center", paddingVertical: 8 }}>
            <FitText style={styles.sectionMessage}>
              Unable to load active muscle filters. {controller.muscleDefinitionsError}
            </FitText>
            <FitButton label="Retry" icon={RefreshCw} onPress={() => void controller.onRefresh()} variant="ghost" />
          </View>
        );
      }
      return (
        <View style={{ alignItems: "center", paddingVertical: 8 }}>
          <FitText style={styles.sectionMessage}>No active muscle definitions are available yet.</FitText>
        </View>
      );
    };

    return (
      <>
        <FitSection heading="Leaderboard" cardStyle={{ paddingHorizontal: 14, paddingVertical: 10 }}>
          <View style={styles.leaderboardControls}>
            <View style={styles.leaderboardControlRow}>
              {[
                { label: "Overall", value: "overall" as const },
                { label: "By Muscle", value: "muscle" as const },
              ].map((option) => {
                const active = controller.leaderboardMode === option.value;
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="button"
                    accessibilityLabel={`Leaderboard: ${option.label}`}
                    accessibilityState={{ selected: active }}
                    onPress={() => controller.setLeaderboardMode(option.value)}
                    style={[
                      styles.leaderboardChip,
                      {
                        backgroundColor: active ? colors.brand + "16" : colors.surfaceRaised,
                        borderColor: active ? colors.brand : colors.border,
                      },
                    ]}
                  >
                    <FitText
                      style={[styles.leaderboardChipText, { color: active ? colors.brand : colors.textSecondary }]}
                    >
                      {option.label}
                    </FitText>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.leaderboardSearchRow}>
              <View style={styles.leaderboardSearchField}>
                <FitSearch
                  value={controller.leaderboardSearch}
                  placeholder={controller.leaderboardMode === "muscle" ? "Search By Muscle" : "Search Overall"}
                  onChangeText={controller.setLeaderboardSearch}
                />
              </View>
              {controller.leaderboardMode === "muscle" && !muscleDefinitionsBlocked ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Filter By Muscle: ${formatTitle(controller.selectedLeaderboardMuscle)} (${controller.leaderboardMuscleOptions.length} active muscles)`}
                  accessibilityState={{
                    expanded: isLeaderboardMuscleFilterOpen,
                  }}
                  onPress={() => setIsLeaderboardMuscleFilterOpen((open) => !open)}
                  style={[
                    styles.leaderboardFilterButton,
                    {
                      backgroundColor: isLeaderboardMuscleFilterOpen ? colors.brand + "16" : colors.surfaceRaised,
                      borderColor: isLeaderboardMuscleFilterOpen ? colors.brand : colors.border,
                    },
                  ]}
                >
                  <SlidersHorizontal
                    size={19}
                    color={isLeaderboardMuscleFilterOpen ? colors.brand : colors.textMuted}
                    strokeWidth={2}
                  />
                </Pressable>
              ) : null}
            </View>
            {controller.leaderboardMode === "muscle" && !muscleDefinitionsBlocked ? (
              <>
                <FitFilter
                  isOpen={isLeaderboardMuscleFilterOpen}
                  topChipLabel="Muscle"
                  topChipOptions={controller.leaderboardMuscleOptions.map((muscle) => ({
                    label: formatTitle(muscle),
                    value: muscle,
                  }))}
                  dropdownStyle={styles.leaderboardFilterDropdown}
                  activeTopChip={controller.selectedLeaderboardMuscle}
                  onTopChipChange={(value) => {
                    controller.setSelectedLeaderboardMuscle(value);
                    setIsLeaderboardMuscleFilterOpen(false);
                  }}
                />
                <View style={styles.leaderboardControlRow}>
                  {(["season", "lifetime"] as const).map((scope) => {
                    const active = controller.muscleLeaderboardScope === scope;
                    return (
                      <Pressable
                        key={scope}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        onPress={() => controller.setMuscleLeaderboardScope(scope)}
                        style={[
                          styles.leaderboardChip,
                          {
                            backgroundColor: active ? colors.brand + "16" : colors.surfaceRaised,
                            borderColor: active ? colors.brand : colors.border,
                          },
                        ]}
                      >
                        <FitText
                          style={[
                            styles.leaderboardChipText,
                            {
                              color: active ? colors.brand : colors.textSecondary,
                            },
                          ]}
                        >
                          {scope === "season" ? "This season" : "Lifetime"}
                        </FitText>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : muscleDefinitionsBlocked ? (
              renderMuscleDefinitionsState()
            ) : null}
          </View>

          {controller.rankingVisibility === "private" ? (
            <View
              style={[
                styles.privatePanel,
                {
                  backgroundColor: colors.surfaceRaised,
                  borderColor: colors.border,
                },
              ]}
            >
              <Lock size={24} color={colors.textMuted} strokeWidth={2} />
              <FitText style={styles.privatePanelTitle}>Leaderboard is private</FitText>
              <FitText style={styles.privatePanelText}>
                Your progression still counts in history, but no member rows are shown while ranking visibility is
                private.
              </FitText>
            </View>
          ) : muscleDefinitionsBlocked ? null : leaderboardEntries.length > 0 ? (
            <View>
              {leaderboardEntries.map((entry, index) => {
                const xp = "xpPoints" in entry ? entry.xpPoints : entry.totalXp;
                const isCurrent =
                  ("isCurrentUser" in entry && entry.isCurrentUser) ||
                  controller.leaderboardEntry?.userId === entry.userId;
                return (
                  <View key={`${entry.userId}-${entry.rankPosition}`}>
                    <View style={styles.leaderboardRow}>
                      <LeaderboardAvatar displayName={entry.displayName} styles={styles} uri={entry.avatarUrl} />
                      <View style={{ flex: 1 }}>
                        <FitText style={styles.leaderboardName} numberOfLines={1}>
                          {entry.displayName}
                        </FitText>
                        <FitText style={styles.leaderboardSubtitle}>Rank #{entry.rankPosition}</FitText>
                      </View>
                      <View style={styles.leaderboardMeta}>
                        <FitText style={styles.leaderboardXp}>{xp.toLocaleString("en-US")} EXP</FitText>
                        <FitText style={styles.leaderboardSubtitle}>
                          {isCurrent
                            ? "You"
                            : controller.leaderboardMode === "muscle"
                              ? formatTitle(controller.selectedLeaderboardMuscle)
                              : "Gym member"}
                        </FitText>
                      </View>
                    </View>
                    {index < leaderboardEntries.length - 1 ? (
                      <View style={[styles.separator, { backgroundColor: colors.border }]} />
                    ) : null}
                  </View>
                );
              })}
            </View>
          ) : (
            <FitText style={styles.sectionMessage}>No visible rankings match this search or filter yet.</FitText>
          )}
          {controller.rankingVisibility !== "private" && hasMore ? (
            <FitButton
              label={controller.isLoadingMoreLeaderboard ? "Loading more..." : "Load more"}
              icon={controller.isLoadingMoreLeaderboard ? undefined : RefreshCw}
              loading={controller.isLoadingMoreLeaderboard}
              disabled={controller.isLoadingMoreLeaderboard}
              onPress={() => void controller.onLoadMoreLeaderboard()}
              variant="ghost"
              style={styles.loadMoreButton}
            />
          ) : null}
        </FitSection>

        <FitSection heading="Season history" cardStyle={{ padding: 14 }}>
          <View style={styles.seasonHistoryBlock}>
            <FitText style={styles.sectionMessage}>
              Review a fixed top-10 from completed seasons, with overall and muscle views.
            </FitText>
            <FitButton
              label="Open season history"
              icon={History}
              onPress={controller.onOpenSeasonHistory}
              variant="primary"
            />
          </View>
        </FitSection>
      </>
    );
  };

  return (
    <View style={styles.root}>
      {controller.statusMessage ? (
        <View
          style={[
            styles.toast,
            {
              backgroundColor: colors.brand + "10",
              borderColor: colors.brand + "55",
            },
          ]}
        >
          <FitText style={[styles.sectionMessage, { color: colors.brand }]}>{controller.statusMessage}</FitText>
        </View>
      ) : null}

      {controller.isMemberLocked ? (
        <FitSection heading="Access">
          <PremiumFeatureGate
            eyebrow="MEMBERSHIP CARD REQUIRED"
            statusLabel={controller.memberLockStatusLabel}
            title={
              controller.memberLockStatusLabel === "Pending verification"
                ? "Muscle Mastery is pending verification"
                : "Muscle Mastery stays locked"
            }
            message={controller.memberLockMessage}
            actionLabel="Open Membership Details"
            onActionPress={controller.onOpenProfile}
          />
        </FitSection>
      ) : controller.isLoading ? (
        <FitSection heading="Overview">
          <FitText style={styles.sectionMessage}>
            Loading mastery progress, milestones, season standing, and leaderboard...
          </FitText>
        </FitSection>
      ) : controller.isError ? (
        <FitSection heading="Overview">
          <FitText style={styles.sectionMessage}>{controller.errorMessage}</FitText>
          <FitButton
            label="Retry"
            icon={RefreshCw}
            onPress={() => void controller.onRefresh()}
            variant="ghost"
            style={{ marginTop: 12 }}
          />
        </FitSection>
      ) : controller.isEmpty ? (
        <FitSection heading="Overview">
          <FitText style={styles.emptyMessage}>
            No progression has landed on this account yet. Finish a tracked workout to start earning EXP, milestone
            progress, and season points.
          </FitText>
          <FitButton
            label="Start First Workout"
            icon={Dumbbell}
            onPress={controller.onOpenWorkout}
            variant="primary"
            style={{ marginTop: 12 }}
          />
        </FitSection>
      ) : (
        <>
          <View style={styles.tabRow}>
            {TABS.map((tab) => {
              const active = controller.activeTab === tab.value;
              return (
                <Pressable
                  key={tab.value}
                  style={[
                    styles.tabButton,
                    {
                      backgroundColor: active ? colors.brand + "12" : colors.surfaceRaised,
                      borderColor: active ? colors.brand : colors.border,
                    },
                  ]}
                  onPress={() => controller.setActiveTab(tab.value)}
                  accessibilityRole="tab"
                  accessibilityLabel={`Show ${tab.label}`}
                  accessibilityState={{ selected: active }}
                >
                  <FitText style={[styles.tabText, { color: active ? colors.brand : colors.textSecondary }]}>
                    {tab.label}
                  </FitText>
                </Pressable>
              );
            })}
          </View>

          {controller.activeTab === "summary" ? renderSummary() : null}
          {controller.activeTab === "milestones" ? renderMilestones() : null}
          {controller.activeTab === "muscles" ? renderMuscles() : null}
          {controller.activeTab === "leaderboard" ? renderLeaderboard() : null}
        </>
      )}
      <MilestoneDetailsModal
        milestone={selectedMilestone}
        onClose={closeMilestoneDetails}
      />
      <SeasonHistoryModal controller={controller} />
    </View>
  );
}

function getMilestoneRewardLabel(rewardPayload: Record<string, unknown> | null): string | null {
  if (!rewardPayload) return null;
  const xp = rewardPayload.xp;
  if (typeof xp === "number" && Number.isFinite(xp)) {
    return `${xp.toLocaleString("en-US")} EXP`;
  }
  return null;
}

function MilestoneDetailsModal({
  milestone,
  onClose,
}: {
  milestone: FitnessMilestoneProgressRecord | null;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { height, width } = useWindowDimensions();
  const closeControlRef = useRef<FocusableMilestoneElement | null>(null);

  useEffect(() => {
    if (!milestone || Platform.OS !== "web" || typeof window === "undefined") {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [milestone, onClose]);

  if (!milestone) return null;

  const tone = getMilestoneTone(milestone, colors);
  const rewardLabel = getMilestoneRewardLabel(milestone.rewardPayload);
  const progressPercent = Math.min(Math.max(milestone.progressPercent, 0), 100);

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      onShow={() =>
        requestAnimationFrame(() =>
          focusMilestoneElement(closeControlRef.current),
        )
      }
      transparent
      visible
    >
      <Pressable
        accessibilityLabel="Dismiss milestone details"
        onPress={onClose}
        style={styles.modalBackdrop}
        testID="milestone-details-backdrop"
      >
        <Pressable
          accessibilityLabel={`${milestone.title} milestone details`}
          accessibilityViewIsModal
          onPress={(event) => event.stopPropagation()}
          role="dialog"
          style={[
            styles.modalCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              maxHeight: Math.min(height - 24, 620),
              maxWidth: Math.min(Math.max(width - 24, 300), 560),
            },
          ]}
          testID="milestone-details-modal"
        >
          <View style={styles.modalHeader}>
            <View style={styles.milestoneDetailsHeader}>
              <MasteryIcon
                alt={`${milestone.title} icon`}
                iconAssetKey={milestone.iconAssetKey}
                iconKey={milestone.iconKey}
                iconKind={milestone.iconKind}
                tone={tone}
              />
              <FitText style={styles.modalTitle}>{milestone.title}</FitText>
            </View>
            <Pressable
              accessibilityLabel="Close milestone details"
              accessibilityRole="button"
              onPress={onClose}
              ref={(element) => {
                closeControlRef.current =
                  element as FocusableMilestoneElement | null;
              }}
              style={[styles.modalClose, { borderColor: colors.border }]}
              testID="milestone-details-close"
            >
              <X size={18} color={colors.textSecondary} />
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={styles.milestoneDetailsBody}
            nestedScrollEnabled={false}
            showsVerticalScrollIndicator={false}
          >
            <FitText style={styles.milestoneDetailsDescription}>
              {milestone.description ?? `${formatTitle(milestone.triggerType)} milestone progress.`}
            </FitText>
            <View
              style={[
                styles.milestoneDetailsMeta,
                {
                  backgroundColor: colors.surfaceRaised,
                  borderColor: colors.border,
                },
              ]}
            >
              <View style={styles.milestoneProgressCopy}>
                <FitText style={styles.progressMeta}>
                  {milestone.progressValue.toLocaleString("en-US")} / {milestone.targetValue.toLocaleString("en-US")}
                </FitText>
                <FitText style={[styles.progressMeta, { color: tone }]}>{Math.round(progressPercent)}%</FitText>
              </View>
              <View
                style={{
                  backgroundColor: colors.border,
                  borderRadius: 999,
                  height: 7,
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    backgroundColor: tone,
                    height: 7,
                    width: `${progressPercent}%`,
                  }}
                />
              </View>
              <FitText style={[styles.progressMeta, { color: tone }]}>
                {getMilestoneStatusLabel(milestone)}
                {rewardLabel ? ` · Reward: ${rewardLabel}` : ""}
              </FitText>
            </View>
          </ScrollView>
          <FitButton label="Close" onPress={onClose} variant="ghost" />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function SeasonHistoryModal({ controller }: { controller: MuscleMasteryScreenController }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { height, width } = useWindowDimensions();
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isSeasonHistoryMuscleFilterOpen, setIsSeasonHistoryMuscleFilterOpen] = useState(false);
  const [seasonSearch, setSeasonSearch] = useState("");
  const modalWidth = Math.min(Math.max(width - 24, 300), 680);
  const listHeight = Math.min(Math.max(height * 0.48, 260), 430);
  const pickerListHeight = Math.min(Math.max(height * 0.52, 280), 480);
  const selectedSeason = controller.seasonHistory.find(
    (season) => season.seasonId === controller.selectedSeasonHistoryId,
  );
  const filteredSeasons = controller.seasonHistory.filter((season) => {
    const search = seasonSearch.trim().toLowerCase();
    return !search || season.title.toLowerCase().includes(search);
  });
  const muscleRows = controller.seasonHistoryMuscleLeaderboard;
  const muscleDefinitionsBlocked =
    controller.seasonHistoryScope === "muscle" &&
    (controller.muscleDefinitionsLoading ||
      !!controller.muscleDefinitionsError ||
      controller.seasonHistoryMuscleOptions.length === 0);
  const renderMuscleDefinitionsState = () => {
    if (controller.muscleDefinitionsLoading) {
      return (
        <View style={{ alignItems: "center", paddingVertical: 8 }}>
          <ActivityIndicator color={colors.brand} />
          <FitText style={styles.sectionMessage}>Loading active muscle filters...</FitText>
        </View>
      );
    }
    if (controller.muscleDefinitionsError) {
      return (
        <View style={{ alignItems: "center", paddingVertical: 8 }}>
          <FitText style={styles.sectionMessage}>
            Unable to load active muscle filters. {controller.muscleDefinitionsError}
          </FitText>
          <FitButton label="Retry" icon={RefreshCw} onPress={() => void controller.onRefresh()} variant="ghost" />
        </View>
      );
    }
    return (
      <View style={{ alignItems: "center", paddingVertical: 8 }}>
        <FitText style={styles.sectionMessage}>No active muscle definitions are available yet.</FitText>
      </View>
    );
  };

  const renderOverallRow = ({ item }: { item: FitnessSeasonHistoryRecord["topPerformers"][number] }) => {
    const isTopThree = item.rankPosition <= 3;
    return (
      <View
        style={[
          styles.modalRow,
          {
            backgroundColor: isTopThree ? colors.brand + (item.rankPosition === 1 ? "22" : "12") : colors.surfaceRaised,
            borderColor: isTopThree ? colors.brand + "66" : colors.border,
          },
        ]}
      >
        <View
          style={[
            styles.modalRank,
            {
              backgroundColor: isTopThree ? colors.brand + "2a" : colors.surface,
              minWidth: item.rankPosition <= 3 ? 38 : 34,
            },
          ]}
        >
          <FitText style={[styles.modalRankText, { color: isTopThree ? colors.brand : colors.textSecondary }]}>
            #{item.rankPosition}
          </FitText>
        </View>
        <View style={styles.modalAvatar}>
          <FitAvatarImage
            alt={`${item.displayName} avatar`}
            borderRadius={17}
            fallback={
              <View style={[styles.leaderboardAvatar, { backgroundColor: colors.brand + "18" }]}>
                <FitText style={[styles.leaderboardAvatarText, { color: colors.brand }]}>
                  {getInitials(item.displayName)}
                </FitText>
              </View>
            }
          />
        </View>
        <View style={styles.modalCopy}>
          <FitText numberOfLines={1} style={styles.modalName}>
            {item.displayName}
          </FitText>
          <FitText style={styles.modalHint}>Overall season standing</FitText>
        </View>
        <FitText style={[styles.modalValue, { color: isTopThree ? colors.brand : colors.textSecondary }]}>
          {item.seasonPoints.toLocaleString("en-US")} pts
        </FitText>
      </View>
    );
  };

  const renderMuscleRow = ({ item }: { item: FitnessMuscleLeaderboardEntryRecord }) => {
    const isTopThree = item.rankPosition <= 3;
    const rankColor = getRankColor(item.progression?.level ?? "bronze");
    return (
      <View
        style={[
          styles.modalRow,
          {
            backgroundColor: isTopThree ? rankColor + "18" : colors.surfaceRaised,
            borderColor: isTopThree ? rankColor + "66" : colors.border,
          },
        ]}
      >
        <View style={[styles.modalRank, { backgroundColor: rankColor + "24" }]}>
          <FitText style={[styles.modalRankText, { color: rankColor }]}>#{item.rankPosition}</FitText>
        </View>
        <LeaderboardAvatar displayName={item.displayName} styles={styles} uri={item.avatarUrl} />
        <View style={styles.modalCopy}>
          <FitText numberOfLines={1} style={styles.modalName}>
            {item.displayName}
          </FitText>
          <FitText style={styles.modalHint}>
            {getRankLabel(item.progression?.level ?? "bronze")} · {formatTitle(controller.seasonHistoryMuscleKey)}
          </FitText>
        </View>
        <FitText style={[styles.modalValue, { color: rankColor }]}>{item.xpPoints.toLocaleString("en-US")} EXP</FitText>
      </View>
    );
  };

  return (
    <>
      <Modal
        visible={controller.seasonHistoryOpen}
        transparent
        animationType="fade"
        onRequestClose={controller.onCloseSeasonHistory}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                maxWidth: modalWidth,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <View style={{ flex: 1, gap: 4 }}>
                <FitText style={styles.modalTitle}>Season history</FitText>
                <FitText style={styles.sectionMessage}>
                  Fixed top-10 · {selectedSeason?.title ?? "Select a season"}
                </FitText>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close season history"
                onPress={controller.onCloseSeasonHistory}
                style={[styles.modalClose, { borderColor: colors.border }]}
              >
                <X size={19} color={colors.textMuted} strokeWidth={2} />
              </Pressable>
            </View>

            <View style={styles.modalControlRow}>
              {[
                { label: "Overall", value: "overall" as const },
                { label: "By muscle", value: "muscle" as const },
              ].map((option) => {
                const active = controller.seasonHistoryScope === option.value;
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => {
                      controller.setSeasonHistoryScope(option.value);
                      if (option.value !== "muscle") {
                        setIsSeasonHistoryMuscleFilterOpen(false);
                      }
                    }}
                    style={[
                      styles.modalChip,
                      {
                        backgroundColor: active ? colors.brand + "16" : colors.surfaceRaised,
                        borderColor: active ? colors.brand : colors.border,
                      },
                    ]}
                  >
                    <FitText style={[styles.modalChipText, { color: active ? colors.brand : colors.textSecondary }]}>
                      {option.label}
                    </FitText>
                  </Pressable>
                );
              })}
              {controller.seasonHistoryScope !== "muscle" ? (
                <FitButton
                  label={selectedSeason?.title ?? "Choose season"}
                  icon={History}
                  onPress={() => setIsPickerOpen(true)}
                  variant="ghost"
                  style={{ flexGrow: 1, minHeight: 36 }}
                  textStyle={{ fontSize: 11 }}
                />
              ) : null}
            </View>

            {controller.seasonHistoryScope === "muscle" ? (
              <View style={styles.modalMuscleFilterRow}>
                <FitButton
                  label={selectedSeason?.title ?? "Choose season"}
                  icon={History}
                  onPress={() => setIsPickerOpen(true)}
                  variant="ghost"
                  style={{ flex: 1, minHeight: 36 }}
                  textStyle={{ fontSize: 11 }}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Filter season history muscles: ${formatTitle(controller.seasonHistoryMuscleKey)} (${controller.seasonHistoryMuscleOptions.length} active muscles)`}
                  accessibilityState={{
                    expanded: isSeasonHistoryMuscleFilterOpen,
                  }}
                  onPress={() => setIsSeasonHistoryMuscleFilterOpen((open) => !open)}
                  disabled={muscleDefinitionsBlocked}
                  style={[
                    styles.modalFilterButton,
                    {
                      backgroundColor: isSeasonHistoryMuscleFilterOpen ? colors.brand + "16" : colors.surfaceRaised,
                      borderColor: isSeasonHistoryMuscleFilterOpen ? colors.brand : colors.border,
                    },
                  ]}
                >
                  <SlidersHorizontal
                    size={18}
                    color={isSeasonHistoryMuscleFilterOpen ? colors.brand : colors.textMuted}
                    strokeWidth={2}
                  />
                </Pressable>
                <FitFilter
                  isOpen={isSeasonHistoryMuscleFilterOpen && !muscleDefinitionsBlocked}
                  topChipLabel="Muscle"
                  topChipOptions={controller.seasonHistoryMuscleOptions.map((muscle) => ({
                    label: formatTitle(muscle),
                    value: muscle,
                  }))}
                  dropdownStyle={styles.modalFilterDropdown}
                  activeTopChip={controller.seasonHistoryMuscleKey}
                  onTopChipChange={(value) => {
                    controller.setSeasonHistoryMuscleKey(value);
                    setIsSeasonHistoryMuscleFilterOpen(false);
                  }}
                />
              </View>
            ) : null}

            {muscleDefinitionsBlocked ? (
              renderMuscleDefinitionsState()
            ) : controller.seasonHistoryLoading ? (
              <View style={styles.modalEmpty}>
                <ActivityIndicator color={colors.brand} />
                <FitText style={styles.sectionMessage}>Loading completed seasons...</FitText>
              </View>
            ) : controller.seasonHistoryError ? (
              <View style={styles.modalEmpty}>
                <FitText style={styles.sectionMessage}>{controller.seasonHistoryError}</FitText>
                <FitButton
                  label="Retry"
                  icon={RefreshCw}
                  onPress={() => void controller.onRefreshSeasonHistory()}
                  variant="ghost"
                />
              </View>
            ) : controller.seasonHistoryScope === "muscle" && controller.seasonHistoryMuscleLoading ? (
              <View style={styles.modalEmpty}>
                <ActivityIndicator color={colors.brand} />
                <FitText style={styles.sectionMessage}>Loading muscle season rankings...</FitText>
              </View>
            ) : controller.seasonHistoryScope === "muscle" && controller.seasonHistoryMuscleError ? (
              <View style={styles.modalEmpty}>
                <FitText style={styles.sectionMessage}>{controller.seasonHistoryMuscleError}</FitText>
                <FitButton
                  label="Retry"
                  icon={RefreshCw}
                  onPress={() => void controller.onRefreshSeasonHistory()}
                  variant="ghost"
                />
              </View>
            ) : controller.seasonHistoryScope === "muscle" ? (
              muscleRows.length > 0 ? (
                <FlatList
                  data={muscleRows}
                  keyExtractor={(entry) => `${entry.userId}-${entry.rankPosition}`}
                  renderItem={renderMuscleRow}
                  style={[styles.modalList, { height: listHeight }]}
                  showsVerticalScrollIndicator
                />
              ) : (
                <View style={styles.modalEmpty}>
                  <FitText style={styles.sectionMessage}>
                    No muscle season rankings are available for this season yet.
                  </FitText>
                </View>
              )
            ) : selectedSeason && selectedSeason.topPerformers.length > 0 ? (
              <FlatList
                data={selectedSeason.topPerformers.slice(0, 10)}
                keyExtractor={(entry) => `${selectedSeason.seasonId}-${entry.userId}`}
                renderItem={renderOverallRow}
                style={[styles.modalList, { height: listHeight }]}
                showsVerticalScrollIndicator
              />
            ) : (
              <View style={styles.modalEmpty}>
                <FitText style={styles.sectionMessage}>
                  Completed season results will appear here after the first season closes.
                </FitText>
              </View>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={isPickerOpen && controller.seasonHistoryOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsPickerOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.pickerCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                maxWidth: modalWidth,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <FitText style={styles.modalTitle}>Choose a season</FitText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close season picker"
                onPress={() => setIsPickerOpen(false)}
                style={[styles.modalClose, { borderColor: colors.border }]}
              >
                <X size={19} color={colors.textMuted} strokeWidth={2} />
              </Pressable>
            </View>
            <FitSearch value={seasonSearch} placeholder="Search seasons" onChangeText={setSeasonSearch} />
            <FlatList
              data={filteredSeasons}
              keyExtractor={(season) => season.seasonId}
              style={[styles.pickerList, { height: pickerListHeight }]}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item: season }) => {
                const active = season.seasonId === controller.selectedSeasonHistoryId;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => {
                      controller.setSelectedSeasonHistoryId(season.seasonId);
                      setIsPickerOpen(false);
                    }}
                    style={[
                      styles.pickerRow,
                      {
                        backgroundColor: active ? colors.brand + "12" : colors.surfaceRaised,
                        borderColor: active ? colors.brand : colors.border,
                      },
                    ]}
                  >
                    <FitText style={[styles.modalName, { color: active ? colors.brand : colors.textPrimary }]}>
                      {season.title}
                    </FitText>
                    <FitText style={styles.modalHint}>
                      {new Date(season.startsAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}{" "}
                      –{" "}
                      {new Date(season.endsAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </FitText>
                  </Pressable>
                );
              }}
              ListEmptyComponent={
                <View style={styles.modalEmpty}>
                  <FitText style={styles.sectionMessage}>No seasons match this search.</FitText>
                </View>
              }
            />
          </View>
        </View>
      </Modal>
    </>
  );
}
