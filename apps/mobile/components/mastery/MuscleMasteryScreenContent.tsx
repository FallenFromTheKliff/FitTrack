import { useEffect, useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import {
  Bot,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Lock,
  RefreshCw,
  Search,
  Sparkles,
  Target,
  Trophy,
  type LucideIcon,
} from "lucide-react-native";
import { R } from "@fittrack/ui/tokens";
import type {
  FitnessMasteryRank,
  FitnessMilestoneProgressRecord,
} from "@fittrack/types";

import { useTheme } from "@/contexts/ThemeContext";
import PremiumFeatureGate from "@/components/membership/PremiumFeatureGate";
import {
  FitButton,
  FitCard,
  FitSection,
  FitText,
  FitTextInput,
} from "@/components/fit";

import type { useMuscleMasteryScreen } from "@/hooks/mastery/useMuscleMasteryScreen";

type MuscleMasteryScreenController = ReturnType<typeof useMuscleMasteryScreen>;
type MasteryTab = MuscleMasteryScreenController["activeTab"];

const RANK_FILTERS: Array<{ label: string; value: FitnessMasteryRank | "all" }> =
  [
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

function makeStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    actionGrid: {
      gap: 10,
    },
    burstDot: {
      borderRadius: 999,
      height: 10,
      position: "absolute",
      width: 10,
    },
    burstLayer: {
      alignItems: "center",
      height: 1,
      justifyContent: "center",
      left: 0,
      position: "absolute",
      right: 0,
      top: 92,
      zIndex: 12,
    },
    chip: {
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    chipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    emptyMessage: {
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 20,
    },
    heroCard: {
      borderRadius: R.xl,
      gap: 16,
      padding: 18,
    },
    heroEyebrow: {
      color: colors.onBrand ?? "#FFFFFF",
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 1.1,
    },
    heroMetaPill: {
      borderRadius: 999,
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
      color: colors.onBrand ?? "#FFFFFF",
      fontSize: 12,
      fontWeight: "600",
    },
    heroProgressFill: {
      borderRadius: 999,
      height: 7,
    },
    heroProgressMeta: {
      color: colors.onBrand ?? "#FFFFFF",
      fontSize: 12,
      fontWeight: "700",
      opacity: 0.9,
    },
    heroProgressTrack: {
      backgroundColor: (colors.onBrand ?? "#FFFFFF") + "22",
      borderRadius: 999,
      height: 7,
      overflow: "hidden",
    },
    heroSubtitle: {
      color: colors.onBrand ?? "#FFFFFF",
      fontSize: 14,
      lineHeight: 20,
      opacity: 0.92,
    },
    heroTitle: {
      color: colors.onBrand ?? "#FFFFFF",
      fontSize: 24,
      fontWeight: "700",
      lineHeight: 30,
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
    list: {
      gap: 10,
    },
    milestoneActions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      marginTop: 10,
    },
    milestoneCard: {
      borderRadius: R.lg,
      borderWidth: 1,
      gap: 8,
      padding: 14,
    },
    milestoneDescription: {
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 18,
    },
    milestoneMeta: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    milestoneTitle: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: "700",
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
    pager: {
      alignItems: "center",
      flexDirection: "row",
      gap: 10,
      justifyContent: "space-between",
      marginTop: 12,
    },
    pagerLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
    },
    progressMeta: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
    },
    root: {
      gap: 12,
      position: "relative",
    },
    searchRow: {
      alignItems: "center",
      borderRadius: R.md,
      borderWidth: 1,
      flexDirection: "row",
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    searchInput: {
      color: colors.textPrimary,
      flex: 1,
      fontSize: 14,
      padding: 0,
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
    },
    tabButton: {
      alignItems: "center",
      borderRadius: 999,
      borderWidth: 1,
      flexGrow: 1,
      paddingHorizontal: 10,
      paddingVertical: 10,
    },
    tabRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
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
  return "Locked";
}

function getMilestoneIcon(milestone: FitnessMilestoneProgressRecord): LucideIcon {
  if (milestone.status === "claimed") return Trophy;
  if (milestone.status === "unlocked") return Sparkles;
  return Lock;
}

function getMilestoneTone(
  milestone: FitnessMilestoneProgressRecord,
  colors: ReturnType<typeof useTheme>["colors"],
) {
  if (milestone.status === "claimed") return colors.success ?? colors.brand;
  if (milestone.status === "unlocked") return colors.brand;
  return colors.textMuted;
}

function BurstParticle({
  activeKey,
  color,
  index,
}: {
  activeKey: number;
  color: string;
  index: number;
}) {
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

function MilestoneClaimBurst({
  activeKey,
  color,
}: {
  activeKey: number;
  color: string;
}) {
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

function PaginationControls({
  currentPage,
  onPageChange,
  totalPages,
}: {
  currentPage: number;
  onPageChange: (page: number) => void;
  totalPages: number;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const safeTotalPages = Math.max(1, totalPages);

  return (
    <View style={styles.pager}>
      <FitButton
        label="Prev"
        icon={ChevronLeft}
        onPress={() => onPageChange(Math.max(1, currentPage - 1))}
        variant="ghost"
        disabled={currentPage <= 1}
        flex={1}
      />
      <FitText style={styles.pagerLabel}>
        {currentPage} / {safeTotalPages}
      </FitText>
      <FitButton
        label="Next"
        icon={ChevronRight}
        onPress={() => onPageChange(Math.min(safeTotalPages, currentPage + 1))}
        variant="ghost"
        disabled={currentPage >= safeTotalPages}
        flex={1}
      />
    </View>
  );
}

export default function MuscleMasteryScreenContent({
  controller,
}: {
  controller: MuscleMasteryScreenController;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const maxXp = controller.mastery[0]?.xpPoints ?? 0;
  const heroProgressPercent = Math.min(
    Math.max(controller.totalXpProgress, 0),
    1,
  );

  const renderSummary = () => (
    <>
      {controller.integrityNotice ? (
        <FitSection heading="Progress Status">
          <View
            style={[
              styles.noticeCard,
              {
                backgroundColor: colors.warning + "12",
                borderColor: colors.warning + "55",
              },
            ]}
          >
            <FitText style={styles.noticeTitle}>
              {controller.integrityNotice.title}
            </FitText>
            <FitText style={styles.sectionMessage}>
              {controller.integrityNotice.body}
            </FitText>
          </View>
        </FitSection>
      ) : null}

      <FitSection heading="Snapshot">
        <View style={styles.statGrid}>
          {controller.summaryCards.map((item) => (
            <View key={item.id} style={styles.statTile}>
              <FitCard label={item.label} statValue={item.value} />
            </View>
          ))}
        </View>
        {controller.topMuscle ? (
          <View style={{ marginTop: 12 }}>
            <FitCard
              label={controller.topMuscle.muscleGroup}
              subtitle={`${controller.topMuscle.xpPoints.toLocaleString("en-US")} EXP | ${controller.topMuscle.totalVolumeKg.toLocaleString("en-US")} kg total volume`}
              trailingLabel={controller.topMuscle.rankDisplay}
              trailingLabelColor={colors.brand}
              progress={maxXp > 0 ? controller.topMuscle.xpPoints / maxXp : 0}
              icon={Sparkles}
              noChevron
            />
          </View>
        ) : null}
      </FitSection>

      <FitSection heading="Quick Links">
        <View style={styles.actionGrid}>
          <FitButton
            label="Open Workout"
            icon={Dumbbell}
            onPress={controller.onOpenWorkout}
            variant="primary"
          />
          <FitButton
            label="Open Nutrition"
            icon={Target}
            onPress={controller.onOpenNutrition}
            variant="ghost"
          />
          <FitButton
            label="Ask BrodigyAI"
            icon={Bot}
            onPress={controller.onOpenChatbot}
            variant="ghost"
          />
        </View>
      </FitSection>
    </>
  );

  const renderMilestones = () => (
    <FitSection heading="Milestones">
      {controller.sortedMilestones.length > 0 ? (
        <View style={styles.list}>
          {controller.sortedMilestones.map((milestone) => {
            const Icon = getMilestoneIcon(milestone);
            const tone = getMilestoneTone(milestone, colors);
            const canClaim = milestone.status === "unlocked";

            return (
              <View
                key={milestone.milestoneDefinitionId}
                style={[
                  styles.milestoneCard,
                  {
                    backgroundColor: canClaim
                      ? colors.brand + "10"
                      : colors.surfaceRaised,
                    borderColor: canClaim ? colors.brand + "55" : colors.border,
                  },
                ]}
              >
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Icon size={22} color={tone} strokeWidth={2} />
                  <View style={{ flex: 1 }}>
                    <FitText style={styles.milestoneTitle}>
                      {milestone.title}
                    </FitText>
                    <FitText style={styles.milestoneDescription}>
                      {milestone.description ??
                        `${formatTitle(milestone.triggerType)} milestone progress.`}
                    </FitText>
                  </View>
                </View>
                <View style={styles.milestoneMeta}>
                  <FitText style={styles.progressMeta}>
                    {formatTitle(milestone.category)}
                  </FitText>
                  <FitText style={styles.progressMeta}>
                    {milestone.progressValue.toLocaleString("en-US")} /{" "}
                    {milestone.targetValue.toLocaleString("en-US")}
                  </FitText>
                  <FitText style={[styles.progressMeta, { color: tone }]}>
                    {getMilestoneStatusLabel(milestone)}
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
                      width: `${Math.min(Math.max(milestone.progressPercent, 0), 100)}%`,
                    }}
                  />
                </View>
                {canClaim ? (
                  <View style={styles.milestoneActions}>
                    <FitButton
                      label="Claim"
                      icon={Sparkles}
                      onPress={() => void controller.onClaimMilestone(milestone)}
                      variant="primary"
                      disabled={controller.isClaimingMilestone}
                      loading={controller.isClaimingMilestone}
                    />
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : (
        <FitText style={styles.sectionMessage}>
          Visible milestones will appear after the progression backbone publishes
          active goals for this member account.
        </FitText>
      )}
    </FitSection>
  );

  const renderMuscles = () => (
    <FitSection heading="Muscle EXP">
      <View
        style={[
          styles.searchRow,
          { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
        ]}
      >
        <Search size={18} color={colors.textMuted} strokeWidth={2} />
        <FitTextInput
          value={controller.muscleSearch}
          placeholder="Search muscle group"
          placeholderTextColor={colors.textMuted}
          onChangeText={controller.setMuscleSearch}
          style={styles.searchInput}
        />
      </View>
      <View style={[styles.chipRow, { marginTop: 12 }]}>
        {RANK_FILTERS.map((option) => {
          const active = controller.muscleRankFilter === option.value;
          return (
            <Pressable
              key={option.value}
              style={[
                styles.chip,
                {
                  backgroundColor: active
                    ? colors.brand + "12"
                    : colors.surfaceRaised,
                  borderColor: active ? colors.brand : colors.border,
                },
              ]}
              onPress={() => controller.setMuscleRankFilter(option.value)}
            >
              <FitText
                style={{
                  color: active ? colors.brand : colors.textSecondary,
                  fontSize: 12,
                  fontWeight: active ? "700" : "600",
                }}
              >
                {option.label}
              </FitText>
            </Pressable>
          );
        })}
      </View>
      <View style={[styles.list, { marginTop: 12 }]}>
        {controller.musclePageItems.length > 0 ? (
          controller.musclePageItems.map((entry) => (
            <FitCard
              key={entry.id}
              label={entry.muscleGroup}
              subtitle={`${entry.xpPoints.toLocaleString("en-US")} EXP | ${entry.totalVolumeKg.toLocaleString("en-US")} kg total volume`}
              trailingLabel={entry.rankDisplay}
              trailingLabelColor={colors.brand}
              progress={maxXp > 0 ? entry.xpPoints / maxXp : 0}
              icon={Sparkles}
              noChevron
            />
          ))
        ) : (
          <FitText style={styles.sectionMessage}>
            No muscle EXP entries match the current filters.
          </FitText>
        )}
      </View>
      <PaginationControls
        currentPage={controller.musclePage}
        onPageChange={controller.setMusclePage}
        totalPages={controller.muscleTotalPages}
      />
    </FitSection>
  );

  const renderLeaderboard = () => (
    <FitSection heading="Leaderboard">
      {controller.rankingVisibility === "private" ? (
        <FitText style={styles.sectionMessage}>
          Your visible ranking is private. Progression still counts in history,
          but member-facing leaderboards hide your standing.
        </FitText>
      ) : controller.leaderboard.length > 0 ? (
        <View>
          {controller.leaderboard.map((entry, index) => (
            <View key={`${entry.userId}-${entry.rankPosition}`}>
              <View style={styles.leaderboardRow}>
                <View
                  style={[
                    styles.leaderboardAvatar,
                    { backgroundColor: colors.brand + "18" },
                  ]}
                >
                  <FitText
                    style={[
                      styles.leaderboardAvatarText,
                      { color: colors.brand },
                    ]}
                  >
                    {getInitials(entry.displayName)}
                  </FitText>
                </View>
                <View style={{ flex: 1 }}>
                  <FitText style={styles.leaderboardName}>
                    {entry.displayName}
                  </FitText>
                  <FitText style={styles.leaderboardSubtitle}>
                    Rank #{entry.rankPosition}
                  </FitText>
                </View>
                <View style={styles.leaderboardMeta}>
                  <FitText style={styles.leaderboardXp}>
                    {entry.totalXp.toLocaleString("en-US")} EXP
                  </FitText>
                  <FitText style={styles.leaderboardSubtitle}>
                    {controller.leaderboardEntry?.userId === entry.userId
                      ? "You"
                      : "Gym member"}
                  </FitText>
                </View>
              </View>
              {index < controller.leaderboard.length - 1 ? (
                <View
                  style={[
                    styles.separator,
                    { backgroundColor: colors.border },
                  ]}
                />
              ) : null}
            </View>
          ))}
        </View>
      ) : (
        <FitText style={styles.sectionMessage}>
          No visible leaderboard entries are available for this season yet.
        </FitText>
      )}
      <PaginationControls
        currentPage={controller.leaderboardMeta.page}
        onPageChange={controller.setLeaderboardPage}
        totalPages={controller.leaderboardMeta.total_pages}
      />
    </FitSection>
  );

  return (
    <View style={styles.root}>
      <View pointerEvents="none" style={styles.burstLayer}>
        <MilestoneClaimBurst
          activeKey={controller.celebrationKey}
          color={colors.brand}
        />
      </View>

      <View style={[styles.heroCard, { backgroundColor: colors.brand }]}>
        <FitText style={styles.heroEyebrow}>MUSCLE MASTERY</FitText>
        <View style={styles.heroMetaRow}>
          <View
            style={[
              styles.heroMetaPill,
              { borderColor: (colors.onBrand ?? "#FFFFFF") + "44" },
            ]}
          >
            <FitText style={styles.heroMetaText}>
              {controller.seasonRankLabel}
            </FitText>
          </View>
          <View
            style={[
              styles.heroMetaPill,
              { borderColor: (colors.onBrand ?? "#FFFFFF") + "44" },
            ]}
          >
            <FitText style={styles.heroMetaText}>
              {controller.topMuscle
                ? `${controller.topMuscle.muscleGroup} leads`
                : "No muscles tracked yet"}
            </FitText>
          </View>
        </View>
        <FitText style={styles.heroTitle}>
          {controller.progressionProfile
            ? `${controller.progressionProfile.currentStreak} day streak in motion`
            : controller.topMuscle
              ? `${controller.topMuscle.rankDisplay} momentum is building`
              : "Build your first mastery streak"}
        </FitText>
        <FitText style={styles.heroSubtitle}>
          {controller.progressionProfile
            ? `${controller.seasonCaption}. ${controller.totalXp.toLocaleString("en-US")} confirmed EXP now drives mastery, milestones, and season standing.`
            : "Workout progress, season standing, milestone claims, and muscle EXP now live in one cleaner surface."}
        </FitText>
        <View style={{ gap: 8 }}>
          <View style={styles.heroProgressTrack}>
            <View
              style={[
                styles.heroProgressFill,
                {
                  backgroundColor: colors.onBrand ?? "#FFFFFF",
                  width: `${heroProgressPercent * 100}%`,
                },
              ]}
            />
          </View>
          <FitText style={styles.heroProgressMeta}>
            {controller.totalXp.toLocaleString("en-US")} /{" "}
            {controller.totalXpGoal.toLocaleString("en-US")} EXP
          </FitText>
        </View>
      </View>

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
          <FitText style={[styles.sectionMessage, { color: colors.brand }]}>
            {controller.statusMessage}
          </FitText>
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
            Loading mastery progress, milestones, season standing, and
            governance status...
          </FitText>
        </FitSection>
      ) : controller.isError ? (
        <FitSection heading="Overview">
          <FitText style={styles.sectionMessage}>
            {controller.errorMessage}
          </FitText>
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
            No progression has landed on this account yet. Finish a tracked
            workout to start earning EXP, milestone progress, and season points.
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
          <FitSection heading="Mastery Views">
            <View style={styles.tabRow}>
              {TABS.map((tab) => {
                const active = controller.activeTab === tab.value;
                return (
                  <Pressable
                    key={tab.value}
                    style={[
                      styles.tabButton,
                      {
                        backgroundColor: active
                          ? colors.brand + "12"
                          : colors.surfaceRaised,
                        borderColor: active ? colors.brand : colors.border,
                      },
                    ]}
                    onPress={() => controller.setActiveTab(tab.value)}
                  >
                    <FitText
                      style={[
                        styles.tabText,
                        { color: active ? colors.brand : colors.textSecondary },
                      ]}
                    >
                      {tab.label}
                    </FitText>
                  </Pressable>
                );
              })}
            </View>
          </FitSection>

          {controller.activeTab === "summary" ? renderSummary() : null}
          {controller.activeTab === "milestones" ? renderMilestones() : null}
          {controller.activeTab === "muscles" ? renderMuscles() : null}
          {controller.activeTab === "leaderboard" ? renderLeaderboard() : null}
        </>
      )}
    </View>
  );
}
