import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import {
  ClipboardCheck,
  Dumbbell,
  Lock,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
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
  FitFilter,
  FitPager,
  FitSearch,
  FitSection,
  FitText,
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
    claimButton: {
      minWidth: 128,
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
    milestoneReviewHint: {
      borderRadius: R.md,
      borderWidth: 1,
      marginTop: 2,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    milestoneReviewHintText: {
      fontSize: 12,
      fontWeight: "700",
      lineHeight: 17,
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
    sectionPager: {
      alignItems: "center",
      marginTop: 0,
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
  if (milestone.status === "pending_review") return "Pending review";
  if (milestone.status === "rejected") return "Needs proof";
  return "Locked";
}

function getMilestoneIcon(milestone: FitnessMilestoneProgressRecord): LucideIcon {
  if (milestone.status === "claimed") return Trophy;
  if (milestone.status === "unlocked") return Sparkles;
  if (milestone.status === "pending_review") return ClipboardCheck;
  if (milestone.status === "rejected") return Sparkles;
  return Lock;
}

function getMilestoneTone(
  milestone: FitnessMilestoneProgressRecord,
  colors: ReturnType<typeof useTheme>["colors"],
) {
  if (milestone.status === "claimed") return colors.success ?? colors.brand;
  if (milestone.status === "unlocked") return colors.brand;
  if (milestone.status === "pending_review") return colors.warning;
  if (milestone.status === "rejected") return colors.danger;
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

export function MuscleMasteryHeaderPanel({
  controller,
}: {
  controller: MuscleMasteryScreenController;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const heroProgressPercent = Math.min(
    Math.max(controller.totalXpProgress, 0),
    1,
  );
  const currentStreak = controller.progressionProfile?.currentStreak ?? 0;
  const streakLabel = `${currentStreak} day streak`;
  const totalXpLabel = `${controller.totalXp.toLocaleString("en-US")} EXP`;

  return (
    <View style={styles.heroCard}>
      <View style={styles.heroPrimaryRow}>
        <FitText style={styles.heroTitle}>{streakLabel}</FitText>
        <View>
          <FitText style={styles.heroValueLabel}>TOTAL EXP</FitText>
          <FitText style={styles.heroValue}>{totalXpLabel}</FitText>
        </View>
      </View>
      <View style={{ gap: 8 }}>
        <View style={styles.heroProgressTrack}>
          <View
            style={[
              styles.heroProgressFill,
              {
                backgroundColor: colors.brand,
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
  );
}

export default function MuscleMasteryScreenContent({
  controller,
}: {
  controller: MuscleMasteryScreenController;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [isMuscleFilterOpen, setIsMuscleFilterOpen] = useState(false);
  const maxXp = controller.mastery[0]?.xpPoints ?? 0;

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

      <FitSection heading="Summary" cardStyle={{ padding: 14 }}>
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

      <FitSection heading="Season" cardStyle={{ padding: 14 }}>
        <FitCard
          label={controller.seasonCaption}
          subtitle="Season standing and points are tracked from confirmed progression."
          trailingLabel={controller.seasonRankLabel}
          trailingLabelColor={colors.brand}
          icon={Trophy}
          noChevron
        />
      </FitSection>
    </>
  );

  const renderMilestones = () => (
    <>
      <FitSection heading="Milestones" cardStyle={{ padding: 14 }}>
        {controller.sortedMilestones.length > 0 ? (
          <View style={styles.list}>
            {controller.milestonePageItems.map((milestone) => {
              const Icon = getMilestoneIcon(milestone);
              const tone = getMilestoneTone(milestone, colors);
              const canClaim = milestone.status === "unlocked";
              const needsReview = milestone.status === "pending_review";
              const wasRejected = milestone.status === "rejected";
              const reviewHint = needsReview
                ? "Waiting for staff or admin approval."
                : wasRejected
                  ? "Proof was rejected. Submit a new photo or video proof."
                  : null;

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
                  {reviewHint ? (
                    <View
                      style={[
                        styles.milestoneReviewHint,
                        {
                          backgroundColor: tone + "12",
                          borderColor: tone + "55",
                        },
                      ]}
                    >
                      <FitText style={[styles.milestoneReviewHintText, { color: tone }]}>
                        {reviewHint}
                      </FitText>
                    </View>
                  ) : null}
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
                        style={styles.claimButton}
                        textStyle={{ textAlign: "center" }}
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
      {controller.milestoneTotalPages > 1 ? (
        <FitPager
          currentPage={controller.milestonePage}
          onPageChange={controller.setMilestonePage}
          style={styles.sectionPager}
          totalPages={controller.milestoneTotalPages}
        />
      ) : null}
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
            accessibilityState={{ expanded: isMuscleFilterOpen }}
            hitSlop={8}
            onPress={() => setIsMuscleFilterOpen((open) => !open)}
            style={styles.muscleFilterButton}
          >
            <SlidersHorizontal
              size={20}
              color={isMuscleFilterOpen ? colors.brand : colors.textMuted}
              strokeWidth={2}
            />
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
      </FitSection>
      {controller.muscleTotalPages > 1 ? (
        <FitPager
          currentPage={controller.musclePage}
          onPageChange={controller.setMusclePage}
          style={styles.sectionPager}
          totalPages={controller.muscleTotalPages}
        />
      ) : null}
    </>
  );

  const renderLeaderboard = () => (
    <>
      <FitSection heading="Leaderboard" cardStyle={{ paddingHorizontal: 14, paddingVertical: 4 }}>
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
      </FitSection>
      {controller.rankingVisibility !== "private" &&
      controller.leaderboardMeta.total_pages > 1 ? (
        <FitPager
          currentPage={controller.leaderboardMeta.page}
          onPageChange={controller.setLeaderboardPage}
          style={styles.sectionPager}
          totalPages={controller.leaderboardMeta.total_pages}
        />
      ) : null}
    </>
  );

  return (
    <View style={styles.root}>
      <View pointerEvents="none" style={styles.burstLayer}>
        <MilestoneClaimBurst
          activeKey={controller.celebrationKey}
          color={colors.brand}
        />
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

          {controller.activeTab === "summary" ? renderSummary() : null}
          {controller.activeTab === "milestones" ? renderMilestones() : null}
          {controller.activeTab === "muscles" ? renderMuscles() : null}
          {controller.activeTab === "leaderboard" ? renderLeaderboard() : null}
        </>
      )}
    </View>
  );
}
